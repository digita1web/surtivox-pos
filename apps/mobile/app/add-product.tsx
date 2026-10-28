import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Modal, Keyboard, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { toMajorNumber, asMinor } from '@openpocket/pos-core';
import {
  getStore, createProduct, getProduct, updateProductFields, updateProductPrices, deleteProduct, listCategories, ensureCategory,
  findProductByBarcode, DEFAULT_LOW_STOCK, type Store, type Category, type Product,
} from '../src/repos';
import { pickFromGallery, takePhoto } from '../src/pos/images';
import { lookupBarcode, downloadProductImage } from '../src/pos/lookup';
import { ScanModal } from '../src/pos/ScanModal';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { Chip, PrimaryButton } from '../src/pos/kit';
import { useMoney } from '../src/pos/ui';
import { APP_CURRENCY, parseCurrencyInput } from '../src/branding';

const UNITS = ['unit', 'pcs', 'pack', 'box', 'dozen', 'kg', 'g', 'L', 'ml'];
const UNIT_LABEL: Record<string, string> = {
  unit: 'Unidad',
  pcs: 'Pieza',
  pack: 'Paquete',
  box: 'Caja',
  dozen: 'Docena',
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
};

/** Add a product, or edit one when opened with ?id=… (stock is adjusted via Purchases, not here). */
export default function AddProduct() {
  const t = useTheme();
  const router = useRouter();
  const money = useMoney();
  const params = useLocalSearchParams<{ barcode?: string; id?: string }>();
  const editId = params.id;
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [taxPct, setTaxPct] = useState('0');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('unit');
  const [lowStock, setLowStock] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [original, setOriginal] = useState<Product | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getStore().then((s) => {
      setStore(s);
      if (s) listCategories(s.id).then(setCategories);
    });
  }, []);

  // Edit mode: load the product into the form.
  useEffect(() => {
    if (!editId || !store) return;
    getProduct(editId).then((p) => {
      if (!p) return;
      setOriginal(p);
      const d = APP_CURRENCY.decimals;
      setName(p.name); setBarcode(p.barcode ?? ''); setImageUri(p.image_uri);
      setPrice(String(toMajorNumber(asMinor(p.selling_price), d)));
      setCost(p.cost_price ? String(toMajorNumber(asMinor(p.cost_price), d)) : '');
      setTaxPct(String(p.tax_bps / 100)); setSku(p.sku ?? ''); setUnit(p.unit ?? 'unit');
      setLowStock(p.low_stock_threshold != null ? String(p.low_stock_threshold) : '');
      setCategoryId(p.category_id ?? null); setCurrentStock(p.stock);
    });
  }, [editId, store]);

  // Auto-fill from Open Food Facts when we arrive with a scanned barcode.
  useEffect(() => { if (params.barcode) lookup(params.barcode, true); }, [params.barcode]);

  /** Look the barcode up online; fill the name (if empty) and product photo. */
  const lookup = async (code: string, silent = false) => {
    const bc = code.trim();
    if (looking) return;
    if (!/^\d{8,14}$/.test(bc)) {
      if (!silent) showAlert('Ingresa un código de barras', 'Escribe o escanea un código de 8 a 14 dígitos y toca Buscar para completar el nombre y la foto.');
      return;
    }
    setLooking(true);
    try {
      const info = await lookupBarcode(bc);
      if (!info) { if (!silent) showAlert('No encontrado', 'No hay coincidencias para este código en la base de productos.'); return; }
      if (info.name) setName((prev) => prev.trim() ? prev : info.name!);
      if (info.imageUrl && !imageUri) {
        const local = await downloadProductImage(info.imageUrl);
        if (local) setImageUri(local);
      }
      if (!silent && !info.name && !info.imageUrl) showAlert('No encontrado', 'No hay información disponible para este código.');
    } catch {
      if (!silent) showAlert('No se pudo buscar', 'No se pudo conectar con la base de productos. Revisa tu conexión.');
    } finally { setLooking(false); }
  };

  /** A scan is for adding a product: fill it in quietly. If the barcode is
   * already in the catalog, say so (and offer to edit it) instead of starting a
   * duplicate; otherwise auto-fill from Open Food Facts with no "not found"
   * popup — that alert is only for a deliberate "Look up" tap. */
  const onScanned = async (code: string) => {
    const bc = code.trim();
    setBarcode(bc);
    if (store && !editId) {
      const existing = await findProductByBarcode(store.id, bc);
      if (existing) {
        showAlert('Ya está en tu catálogo', `"${existing.name}" ya usa este código de barras.`, [
          { text: 'Editar ese producto', onPress: () => router.replace(`/add-product?id=${existing.id}`) },
          { text: 'Seguir agregando', style: 'cancel' as const },
        ]);
        return;
      }
    }
    lookup(bc, true);
  };

  const generateBarcode = async () => {
    if (!store) return;
    for (let i = 0; i < 20; i += 1) {
      const code = `INT-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await findProductByBarcode(store.id, code))) {
        setBarcode(code);
        return;
      }
    }
    showAlert('No se pudo generar el código', 'Intenta de nuevo.');
  };

  const pick = async (fn: () => Promise<string | null>) => {
    try { const u = await fn(); if (u) setImageUri(u); }
    catch (e) { showAlert('No se pudo agregar la foto', e instanceof Error ? e.message : String(e)); }
  };

  const confirmDelete = async () => {
    if (!editId) return;
    try {
      await deleteProduct(editId);
      router.back();
    } catch (e) {
      showAlert('No se pudo eliminar', e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    if (!editId) return;
    const label = name.trim() || 'este producto';
    showAlert(`¿Eliminar ${label}?`, 'El producto se quitará del catálogo. Las ventas anteriores se conservan.', [
      { text: 'Cancelar', style: 'cancel' as const },
      {
        text: 'Eliminar',
        style: 'destructive' as const,
        onPress: () => {
          showAlert('Esta acción no se puede deshacer. ¿Estás totalmente seguro?', undefined, [
            { text: 'Cancelar', style: 'cancel' as const },
            { text: 'Sí, eliminar', style: 'destructive' as const, onPress: () => { void confirmDelete(); } },
          ]);
        },
      },
    ]);
  };

  // Tapping the photo: view it full-screen if one exists, plus take / gallery.
  // Remove is the ✕ on the preview. The themed alert stacks any number of buttons.
  const chooseImage = () => {
    showAlert('Foto del producto', undefined, [
      ...(imageUri ? [{ text: 'Ver foto', onPress: () => setViewing(true) }] : []),
      { text: imageUri ? 'Reemplazar — tomar foto' : 'Tomar foto', onPress: () => pick(takePhoto) },
      { text: imageUri ? 'Reemplazar — desde galería' : 'Elegir de la galería', onPress: () => pick(pickFromGallery) },
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const save = async () => {
    if (!store || busy) return;
    try {
      if (!name.trim()) throw new Error('El nombre es obligatorio');
      const sellingPrice = parseCurrencyInput(price || '0', APP_CURRENCY.code);
      if (sellingPrice <= 0) throw new Error('El precio de venta debe ser mayor que 0');
      const costPrice = cost ? parseCurrencyInput(cost, APP_CURRENCY.code) : asMinor(0);
      const taxBps = Math.round(parseFloat(taxPct || '0') * 100);
      if (!(taxBps >= 0)) throw new Error('El impuesto debe ser 0 o mayor');
      const openingStock = Math.max(0, Math.floor(parseFloat(stock || '0')));
      const lowStockThreshold = lowStock.trim() === '' ? null : Math.max(0, Math.floor(parseFloat(lowStock)));
      setBusy(true);
      let catId = categoryId;
      if (addingCategory && newCategory.trim()) catId = await ensureCategory(store.id, newCategory);
      const common = { name: name.trim(), barcode: barcode.trim() || null, imageUri, sellingPrice, costPrice, taxBps, sku: sku.trim() || null, unit, categoryId: catId, lowStockThreshold };
      if (editId) {
        const onlyPricesChanged = original !== null
          && original.name === common.name
          && original.barcode === common.barcode
          && original.image_uri === common.imageUri
          && original.tax_bps === common.taxBps
          && (original.sku ?? null) === common.sku
          && (original.unit ?? 'unit') === common.unit
          && (original.category_id ?? null) === common.categoryId
          && (original.low_stock_threshold ?? null) === common.lowStockThreshold;
        if (onlyPricesChanged) {
          await updateProductPrices(store.id, editId, { selling_price: sellingPrice, cost_price: costPrice });
        } else {
          await updateProductFields({ id: editId, ...common });
        }
      } else {
        await createProduct({ storeId: store.id, ...common, openingStock });
      }
      router.back();
    } catch (e) {
      // Surface the reason clearly — the old inline note sat below the fold,
      // hidden by the keyboard, so a failed save looked like nothing happened.
      Keyboard.dismiss();
      showAlert('No se pudo guardar el producto', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, opts?: { kb?: 'decimal-pad' | 'number-pad'; ph?: string; caps?: 'none' | 'sentences' | 'words'; req?: boolean }) => (
    <>
      <Text style={[st.label, { color: t.muted }]}>{label}{opts?.req ? <Text style={{ color: t.danger }}> *</Text> : null}</Text>
      <TextInput value={value} onChangeText={set} placeholder={opts?.ph} placeholderTextColor={t.muted}
        keyboardType={opts?.kb} autoCapitalize={opts?.caps} style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
    </>
  );

  const chip = (label: string, on: boolean, onPress: () => void, key?: string) => (
    <Chip key={key ?? label} label={label} on={on} onPress={onPress} />
  );

  // Margin hint so shopkeepers can sanity-check their pricing.
  const sp = parseFloat(price), cp = parseFloat(cost);
  const margin = sp > 0 && cp > 0 && Number.isFinite(sp) && Number.isFinite(cp) ? Math.round(((sp - cp) / sp) * 100) : null;
  const sellingPreview = (() => {
    if (!store || !price.trim()) return null;
    try { return money(parseCurrencyInput(price, APP_CURRENCY.code)); } catch { return null; }
  })();
  const costPreview = (() => {
    if (!store || !cost.trim()) return null;
    try { return money(parseCurrencyInput(cost, APP_CURRENCY.code)); } catch { return null; }
  })();

  return (
    <Screen title={editId ? 'Editar producto' : 'Agregar producto'}>
      {params.barcode ? (
        <View style={[st.scanned, { borderColor: t.ok, backgroundColor: t.panel }]}>
          <Text style={{ color: t.muted, fontSize: 12 }}>Código escaneado</Text>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>{params.barcode}</Text>
        </View>
      ) : null}

      <View style={{ alignSelf: 'center', marginTop: params.barcode ? space.lg : 0 }}>
        <Pressable onPress={chooseImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={[st.photo, { borderColor: t.line, backgroundColor: '#fff' }]} resizeMode="contain" />
          ) : (
            <View style={[st.photo, st.photoEmpty, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="camera-outline" size={30} color={t.muted} />
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Agregar foto</Text>
            </View>
          )}
        </Pressable>
        {imageUri && (
          <Pressable onPress={() => setImageUri(null)} hitSlop={10} style={[st.remove, { backgroundColor: t.danger }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
          </Pressable>
        )}
      </View>

      {field('Nombre', name, setName, { ph: 'ej. Cola 500 ml', caps: 'words', req: true })}

      <Text style={[st.label, { color: t.muted }]}>Categoría</Text>
      <View style={st.wrap}>
        {chip('Ninguna', !addingCategory && categoryId === null, () => { setAddingCategory(false); setCategoryId(null); })}
        {categories.map((c) => chip(c.name, !addingCategory && categoryId === c.id, () => { setAddingCategory(false); setCategoryId(c.id); }, c.id))}
        {chip('+ Nueva', addingCategory, () => setAddingCategory(true))}
      </View>
      {addingCategory && (
        <TextInput value={newCategory} onChangeText={setNewCategory} placeholder="Nombre de la nueva categoría" placeholderTextColor={t.muted} autoCapitalize="words"
          style={[st.input, { color: t.fg, borderColor: t.accent, backgroundColor: t.panel, marginTop: space.md }]} />
      )}

      <Text style={[st.label, { color: t.muted }]}>Código de barras</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput value={barcode} onChangeText={setBarcode} placeholder="escanea o escribe (opcional)" placeholderTextColor={t.muted}
          style={[st.input, { flex: 1, color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
        <Pressable onPress={() => { Keyboard.dismiss(); setScanning(true); }}
          accessibilityLabel="Escanear código con la cámara" style={[st.scan, { backgroundColor: t.accent }]}>
          <Ionicons name="barcode-outline" size={22} color={t.accentFg} />
        </Pressable>
        <Pressable onPress={() => lookup(barcode)} disabled={looking}
          style={[st.lookup, { backgroundColor: t.accentSoft, opacity: looking ? 0.6 : 1 }]}>
          {looking ? <ActivityIndicator color={t.accent} size="small" /> : <Ionicons name="sparkles-outline" size={18} color={t.accent} />}
          <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Buscar</Text>
        </Pressable>
      </View>
      <Pressable onPress={generateBarcode} style={[st.lookup, { alignSelf: 'flex-start', marginTop: space.sm, paddingVertical: 10, backgroundColor: t.surfaceAlt }]}>
        <Ionicons name="refresh-outline" size={18} color={t.accent} />
        <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Generar código</Text>
      </Pressable>
      <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>Toca la cámara para escanear o escribe un código; se completa el nombre y la foto desde Open Food Facts.</Text>

      {field('Precio de venta', price, setPrice, { kb: 'decimal-pad', ph: '0', req: true })}
      {sellingPreview && <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Se mostrará como {sellingPreview}</Text>}
      {field('Precio de costo', cost, setCost, { kb: 'decimal-pad', ph: '0 (opcional)' })}
      {costPreview && <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Se mostrará como {costPreview}</Text>}
      {margin !== null && (
        <Text style={{ color: margin >= 0 ? t.ok : t.danger, fontSize: 12, marginTop: 6, fontWeight: '600' }}>
          {margin >= 0 ? `Margen ${margin}%` : `Vendiendo por debajo del costo (${margin}%)`}
        </Text>
      )}
      {field('Impuesto %', taxPct, setTaxPct, { kb: 'decimal-pad', ph: '0' })}

      {field('SKU / código interno', sku, setSku, { ph: 'opcional', caps: 'none' })}
      <Text style={[st.label, { color: t.muted }]}>Unidad</Text>
      <View style={st.wrap}>{UNITS.map((u) => chip(UNIT_LABEL[u] ?? u, unit === u, () => setUnit(u)))}</View>

      {editId ? (
        <>
          <Text style={[st.label, { color: t.muted }]}>Stock actual</Text>
          <View style={[st.input, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
            <Text style={{ color: t.fg, fontSize: 16 }}>{currentStock ?? '…'} {UNIT_LABEL[unit] ?? unit}</Text>
          </View>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>Cambia el stock desde Más → Compras / reabastecer para que quede registrado cada movimiento.</Text>
        </>
      ) : (
        field('Stock inicial', stock, setStock, { kb: 'number-pad', ph: '0' })
      )}
      {field('Alerta de stock bajo en', lowStock, setLowStock, { kb: 'number-pad', ph: `${DEFAULT_LOW_STOCK} (predeterminado)` })}

      {/* Save lives at the end of the form (not a pinned bar), so it scrolls up
          with the keyboard the same way the onboarding form does. */}
      <View style={{ marginTop: space.xl }}>
        <PrimaryButton label={editId ? 'Guardar cambios' : 'Guardar producto'} onPress={save} busy={busy} disabled={!store} />
      </View>
      {editId ? (
        <Pressable onPress={remove} disabled={busy} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 14, marginTop: 4 }}>
          <Text style={{ color: t.danger, fontWeight: '700', fontSize: 15 }}>Eliminar producto</Text>
        </Pressable>
      ) : null}

      {/* Full-screen photo viewer */}
      <Modal visible={viewing && !!imageUri} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewing(false)}>
        <Pressable style={st.viewer} onPress={() => setViewing(false)}>
          {imageUri ? <Image source={{ uri: imageUri }} style={st.viewerImg} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewing(false)} hitSlop={12} style={st.viewerClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Camera barcode scanner */}
      <ScanModal visible={scanning} onClose={() => setScanning(false)} onScan={onScanned} />
    </Screen>
  );
}

const st = StyleSheet.create({
  scanned: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  lookup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 14 },
  scan: { width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  photo: { width: 120, height: 120, borderRadius: radius.lg, borderWidth: 1 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  remove: { position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  viewerImg: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: space.xxl, right: space.xl, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
