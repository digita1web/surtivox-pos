import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { asMinor, describeMargin, suggestPrices } from '@surtivox/pos-core';
import { APP_CURRENCY, parseCurrencyInput } from '../branding';
import { useCart } from '../cart';
import { newId } from '../id';
import {
  createDraftProduct,
  getLocalSetting,
  setLocalSetting,
  updateProductImage,
  type Product,
} from '../repos';
import { useSession } from '../session';
import { useTheme, space, radius } from '../theme';
import { downloadProductImage } from './lookup';
import { resolveHints, type ResolveHint } from './resolveBarcode';
import { useMoney } from './ui';
import { useMarketPrices } from './useMarketPrices';
import { MarketPricesCompactView } from './MarketPricesCompact';
import { implicitMarkupBps, markupsForLast } from './marginMemory';

interface UnknownBarcodeSheetProps {
  code: string | null;
  onClose: () => void;
  onAdded: (product: Product, quantity: number, previousQty: number) => void;
}

function formatPriceInput(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parsePrice(value: string): number {
  if (!value.trim()) return 0;
  return parseCurrencyInput(value, APP_CURRENCY.code);
}

export function UnknownBarcodeSheet({ code, onClose, onAdded }: UnknownBarcodeSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const cart = useCart();
  const store = useSession((s) => s.store);
  const prices = useMarketPrices(code ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [costOpen, setCostOpen] = useState(false);
  const [qty, setQty] = useState('1');
  const [saveInventory, setSaveInventory] = useState(true);
  const [resolveHint, setResolveHint] = useState<ResolveHint | null>(null);
  const [markups, setMarkups] = useState<number[]>(markupsForLast(null));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameTouched = useRef(false);

  useEffect(() => {
    setName('');
    setPrice('');
    setCost('');
    setCostOpen(false);
    setQty('1');
    setSaveInventory(true);
    setResolveHint(null);
    setMarkups(markupsForLast(null));
    setErr(null);
    setBusy(false);
    nameTouched.current = false;

    if (!code) return;
    let active = true;
    const controller = new AbortController();
    resolveHints(code, controller.signal)
      .then((result) => {
        if (!active) return;
        setResolveHint(result);
        if (result?.name && !nameTouched.current) setName(result.name);
      })
      .catch(() => {});
    getLocalSetting('last_markup_bps')
      .then((value) => { if (active) setMarkups(markupsForLast(value)); })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [code]);

  const sellingPrice = (() => {
    try { return parsePrice(price); } catch { return 0; }
  })();
  const costPrice = (() => {
    if (!cost.trim()) return null;
    try { return parseCurrencyInput(cost, APP_CURRENCY.code); } catch { return null; }
  })();
  const quantity = Math.max(1, Math.floor(Number(qty) || 1));
  const suggestions = suggestPrices({
    reference: prices.lowest ? asMinor(prices.lowest.price_minor) : null,
    markupsBps: markups,
  });
  const margin = sellingPrice > 0
    ? describeMargin({
      price: asMinor(sellingPrice),
      reference: prices.lowest ? asMinor(prices.lowest.price_minor) : null,
      cost: costPrice === null ? null : asMinor(costPrice),
      referenceName: prices.lowest?.supermarket_name,
    })
    : null;
  const hintColor = margin?.tone === 'danger' ? t.danger : margin?.tone === 'warn' ? t.warn : t.muted;
  const sourceLabel = resolveHint?.nameSource === 'market'
    ? `Sugerido por ${resolveHint.nameProvider ?? 'supermercado'}`
    : resolveHint?.nameSource === 'off'
      ? 'Sugerido por Open Food Facts'
      : null;

  const add = async (inventory = saveInventory) => {
    if (!code || !store || busy) return;
    if (sellingPrice <= 0) {
      setErr('Escribe el precio');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      let product: Product;

      if (inventory) {
        product = await createDraftProduct({
          storeId: store.id,
          barcode: code,
          name: name.trim() || null,
          sellingPrice: asMinor(sellingPrice),
          costPrice: asMinor(costPrice ?? 0),
        });
      } else {
        product = {
          id: `quick-${newId()}`,
          name: name.trim() || `Producto ${code.slice(-4)}`,
          barcode: code,
          image_uri: null,
          selling_price: sellingPrice,
          cost_price: costPrice ?? 0,
          tax_bps: 0,
          stock: Number.MAX_SAFE_INTEGER,
          track_inventory: 0,
          isQuick: true,
        };
      }

      const previousQty = cart.items[product.id]?.quantity ?? 0;
      if (previousQty === 0) cart.add(product);
      cart.setQty(product.id, previousQty + quantity);

      if (prices.lowest) {
        const implicit = implicitMarkupBps(sellingPrice, prices.lowest.price_minor);
        if (implicit !== null) {
          void setLocalSetting('last_markup_bps', String(implicit)).catch(() => {});
        }
      }

      if (inventory && resolveHint?.imageUrl) {
        const imageUrl = resolveHint.imageUrl;
        void downloadProductImage(imageUrl)
          .then((uri) => (uri ? updateProductImage(product.id, uri) : null))
          .catch(() => {});
      }

      onAdded(product, quantity, previousQty);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const quickSale = () => {
    if (sellingPrice <= 0) {
      setErr('Escribe el precio');
      return;
    }
    setSaveInventory(false);
    void add(false);
  };

  const adjustQty = (delta: number) => {
    setQty(String(Math.max(1, quantity + delta)));
  };

  return (
    <Modal visible={code !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.sheet, { backgroundColor: t.panel, paddingBottom: 12 + insets.bottom }]}>
          <View style={[s.grabber, { backgroundColor: t.line }]} />
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={name}
                onChangeText={(value) => { nameTouched.current = true; setName(value); }}
                placeholder="Producto nuevo"
                placeholderTextColor={t.muted}
                style={{ color: t.fg, fontSize: 19, fontWeight: '800', padding: 0 }}
                accessibilityLabel="Nombre del producto"
              />
              <Text style={{ color: t.faint, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{code ?? ''}</Text>
              {sourceLabel ? <Text style={{ color: t.muted, fontSize: 10, marginTop: 1 }}>{sourceLabel}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={t.muted} />
            </Pressable>
          </View>

          <MarketPricesCompactView prices={prices} />

          <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', marginTop: 6, marginBottom: 2 }}>Tu precio de venta</Text>
          <View style={[s.priceBox, { borderColor: err ? t.danger : t.line, backgroundColor: t.bg }]}>
            <Text style={{ color: t.muted, fontSize: 22, fontWeight: '700', marginRight: 4 }}>$</Text>
            <TextInput
              value={price}
              onChangeText={(value) => { setPrice(formatPriceInput(value)); setErr(null); }}
              placeholder="0"
              placeholderTextColor={t.muted}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={() => void add()}
              autoFocus
              style={{ flex: 1, color: t.fg, fontSize: 28, fontWeight: '800', padding: 0 }}
              accessibilityLabel="Tu precio de venta"
            />
          </View>
          {err ? <Text style={{ color: t.danger, fontSize: 11, marginTop: 2 }}>{err}</Text> : null}

          {suggestions.length > 0 ? (
            <View style={s.chips}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={`${suggestion.label}:${suggestion.price}`}
                  onPress={() => { setPrice(formatPriceInput(String(suggestion.price))); setErr(null); }}
                  style={[s.chip, { borderColor: t.line, backgroundColor: t.bg }]}
                  accessibilityLabel={`Usar ${suggestion.label} ${money(asMinor(suggestion.price))}`}
                >
                  <Text style={{ color: t.fg, fontSize: 11, fontWeight: '700' }}>
                    {suggestion.label} {money(asMinor(suggestion.price))}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {margin && (prices.lowest || costPrice !== null) ? (
            <Text style={{ color: hintColor, fontSize: 11, marginTop: 4 }} numberOfLines={2}>{margin.text}</Text>
          ) : null}

          {costOpen ? (
            <View style={[s.costBox, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Text style={{ color: t.muted, fontSize: 16, marginRight: 4 }}>$</Text>
              <TextInput
                value={cost}
                onChangeText={(value) => setCost(formatPriceInput(value))}
                placeholder="Costo por unidad"
                placeholderTextColor={t.muted}
                keyboardType="number-pad"
                style={{ flex: 1, color: t.fg, fontSize: 15, padding: 0 }}
                accessibilityLabel="Costo por unidad"
              />
            </View>
          ) : (
            <Pressable onPress={() => setCostOpen(true)} style={s.costLink} accessibilityLabel="Agregar costo para ver tu ganancia">
              <Ionicons name="analytics-outline" size={14} color={t.accent} />
              <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>Agregar costo para ver tu ganancia</Text>
            </Pressable>
          )}

          <View style={s.optionsRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: t.fg, fontWeight: '700', fontSize: 12 }}>Guardar en inventario</Text>
              <Switch
                value={saveInventory}
                onValueChange={setSaveInventory}
                trackColor={{ false: t.line, true: t.accentSoft }}
                thumbColor={saveInventory ? t.accent : t.muted}
                accessibilityLabel="Guardar en inventario"
              />
            </View>
            <Pressable onPress={quickSale} disabled={busy} hitSlop={8} accessibilityLabel="Venta única">
              <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700' }}>Venta única</Text>
            </Pressable>
          </View>

          <View style={s.qtyRow}>
            <Text style={{ color: t.muted, fontSize: 12 }}>Cantidad</Text>
            <View style={[s.stepper, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Pressable onPress={() => adjustQty(-1)} style={s.stepButton} hitSlop={6} accessibilityLabel="Restar cantidad">
                <Ionicons name="remove" size={16} color={t.fg} />
              </Pressable>
              <TextInput
                value={qty}
                onChangeText={(value) => setQty(value.replace(/\D/g, ''))}
                keyboardType="number-pad"
                style={{ color: t.fg, fontWeight: '800', minWidth: 28, textAlign: 'center', padding: 0 }}
                accessibilityLabel="Cantidad"
              />
              <Pressable onPress={() => adjustQty(1)} style={s.stepButton} hitSlop={6} accessibilityLabel="Sumar cantidad">
                <Ionicons name="add" size={16} color={t.fg} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => void add()}
            disabled={busy}
            accessibilityLabel="Agregar a la venta"
            style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.65 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={t.accentFg} />
            ) : (
              <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
                Agregar a la venta{sellingPrice > 0 ? ` · ${money(asMinor(sellingPrice))}` : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: 16, paddingTop: 8, maxHeight: '96%' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  priceBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  costLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 32, marginTop: 4 },
  costBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 4 },
  stepButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  primary: { borderRadius: radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 10 },
});
