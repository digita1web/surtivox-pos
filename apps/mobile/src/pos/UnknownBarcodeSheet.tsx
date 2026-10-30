import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { asMinor, toMajorNumber } from '@surtivox/pos-core';
import { APP_CURRENCY, parseCurrencyInput } from '../branding';
import { useCart } from '../cart';
import { newId } from '../id';
import {
  createDraftProduct,
  updateProductImage,
  type Product,
} from '../repos';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { formatCopAmount } from '../receiptMoney';
import { downloadProductImage } from './lookup';
import { resolveHints, type ResolveHint } from './resolveBarcode';
import { useMoney } from './ui';

const BILLS = [1000, 2000, 5000, 10000];

interface UnknownBarcodeSheetProps {
  code: string | null;
  onClose: () => void;
  onAdded: (product: Product, quantity: number) => void;
}

export function UnknownBarcodeSheet({ code, onClose, onAdded }: UnknownBarcodeSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const cart = useCart();
  const store = useSession((s) => s.store);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [saveInventory, setSaveInventory] = useState(true);
  const [hint, setHint] = useState<ResolveHint | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameTouched = useRef(false);

  useEffect(() => {
    setName('');
    setPrice('');
    setQty('1');
    setSaveInventory(true);
    setHint(null);
    setErr(null);
    setBusy(false);
    nameTouched.current = false;

    if (!code) return;
    const controller = new AbortController();
    let active = true;
    resolveHints(code, controller.signal)
      .then((result) => {
        if (!active) return;
        setHint(result);
        if (result?.name && !nameTouched.current) setName(result.name);
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [code]);

  const pricePreview = (() => {
    if (!price.trim()) return null;
    try {
      return money(parseCurrencyInput(price, APP_CURRENCY.code));
    } catch {
      return null;
    }
  })();

  const add = async () => {
    if (!code || !store || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const sellingPrice = parseCurrencyInput(price || '0', APP_CURRENCY.code);
      if (sellingPrice <= 0) throw new Error('Ingresa un precio mayor que 0');
      const quantity = Math.max(1, Math.floor(Number(qty) || 1));
      let product: Product;

      if (saveInventory) {
        product = await createDraftProduct({
          storeId: store.id,
          barcode: code,
          name: name.trim() || null,
          sellingPrice,
        });
      } else {
        product = {
          id: `quick-${newId()}`,
          name: name.trim() || `Producto ${code.slice(-4)}`,
          barcode: code,
          image_uri: null,
          selling_price: sellingPrice,
          cost_price: 0,
          tax_bps: 0,
          stock: Number.MAX_SAFE_INTEGER,
          track_inventory: 0,
          isQuick: true,
        };
      }

      const current = cart.items[product.id]?.quantity ?? 0;
      if (current === 0) cart.add(product);
      cart.setQty(product.id, current + quantity);

      if (saveInventory && hint?.imageUrl) {
        const imageUrl = hint.imageUrl;
        void downloadProductImage(imageUrl)
          .then((uri) => (uri ? updateProductImage(product.id, uri) : null))
          .catch(() => {});
      }

      onAdded(product, quantity);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const sourceLabel = hint?.nameSource === 'market'
    ? `Sugerido por ${hint.nameProvider ?? 'supermercado'}`
    : hint?.nameSource === 'off'
      ? 'Sugerido por Open Food Facts'
      : null;

  return (
    <Modal visible={code !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.sheet, { backgroundColor: t.panel, paddingBottom: 18 + insets.bottom }]}>
          <View style={[s.grabber, { backgroundColor: t.line }]} />
          <View style={s.head}>
            <Text style={{ color: t.fg, fontSize: 19, fontWeight: '800' }}>Código desconocido</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={t.muted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[s.label, { color: t.muted }]}>CÓDIGO ESCANEADO</Text>
            <View style={[s.codeBox, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Ionicons name="barcode-outline" size={18} color={t.accent} />
              <Text style={{ color: t.fg, fontFamily: 'monospace', fontSize: 16, marginLeft: 8 }}>{code ?? ''}</Text>
            </View>

            {hint?.reference ? (
              <Pressable
                onPress={() => setPrice(String(toMajorNumber(asMinor(hint.reference!.price_minor), APP_CURRENCY.decimals)))}
                style={[s.reference, { borderColor: t.accent, backgroundColor: t.accentSoft }]}
              >
                <Ionicons name="pricetag-outline" size={16} color={t.accent} />
                <Text style={{ color: t.accent, fontWeight: '700', fontSize: 12, marginLeft: 6 }}>
                  {hint.reference.supermarket_name} {formatCopAmount(asMinor(hint.reference.price_minor))} · usar
                </Text>
              </Pressable>
            ) : null}

            <Text style={[s.label, { color: t.muted }]}>PRECIO *</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.muted}
              style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]}
            />
            {pricePreview ? (
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Se mostrará como {pricePreview}</Text>
            ) : null}
            <View style={s.bills}>
              {BILLS.map((bill) => (
                <Pressable
                  key={bill}
                  onPress={() => setPrice(String(bill))}
                  style={[s.bill, { borderColor: t.line, backgroundColor: t.bg }]}
                >
                  <Text style={{ color: t.fg, fontWeight: '700' }}>${bill.toLocaleString('es-CO')}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[s.label, { color: t.muted }]}>NOMBRE (OPCIONAL)</Text>
            <TextInput
              value={name}
              onChangeText={(value) => {
                nameTouched.current = true;
                setName(value);
              }}
              placeholder={hint?.name ? 'Nombre sugerido' : 'Escribe el nombre'}
              placeholderTextColor={t.muted}
              style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]}
            />
            {sourceLabel ? <Text style={[s.source, { color: t.muted }]}>{sourceLabel}</Text> : null}

            <Text style={[s.label, { color: t.muted }]}>CANTIDAD</Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={t.muted}
              style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]}
            />

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg, fontWeight: '700' }}>Guardar en inventario</Text>
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 3 }}>Se crea como borrador sin stock.</Text>
              </View>
              <Switch
                value={saveInventory}
                onValueChange={setSaveInventory}
                trackColor={{ false: t.line, true: t.accentSoft }}
                thumbColor={saveInventory ? t.accent : t.muted}
              />
            </View>

            {err ? <Text style={{ color: t.danger, marginTop: 12 }}>{err}</Text> : null}

            <Pressable
              onPress={() => void add()}
              disabled={busy}
              style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.65 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator color={t.accentFg} />
              ) : (
                <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Agregar a la venta</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10, maxHeight: '92%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  codeBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18 },
  reference: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  bills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  bill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  source: { fontSize: 11, marginTop: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
});
