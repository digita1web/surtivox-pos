import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@surtivox/pos-core';
import {
  listProducts, openStockCount, recordStockCount, closeStockCount, stockCountLines, expectedStock,
  type Product, type CountLine,
} from '../src/repos';
import { useSession } from '../src/session';
import { useMoney } from '../src/pos/ui';
import { showAlert } from '../src/pos/alert';
import { ScanModal } from '../src/pos/ScanModal';
import { useTheme, space, radius } from '../src/theme';
import { Screen, IconButton, listProps } from '../src/pos/Screen';
import { SearchField, PrimaryButton, EmptyState } from '../src/pos/kit';
import { countDiff, diffLabel, parseCounted, productForCode, searchCountable, countableProducts } from '../src/stockCount';

export default function StockCount() {
  const t = useTheme();
  const router = useRouter();
  const money = useMoney();
  const store = useSession((s) => s.store)!;
  const staff = useSession((s) => s.staff);

  const [countId, setCountId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<CountLine[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [expected, setExpected] = useState(0);
  const [countedText, setCountedText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const id = await openStockCount(store.id, staff?.id ?? null);
      const [ps, ls] = await Promise.all([listProducts(store.id), stockCountLines(id)]);
      if (!live) return;
      setCountId(id);
      setProducts(ps);
      setLines(ls);
    })().catch((e) => showAlert('No se pudo abrir el conteo', e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [store.id, staff?.id]));

  const matches = useMemo(() => searchCountable(products, query), [products, query]);
  const trackedCount = useMemo(() => countableProducts(products).length, [products]);
  const counted = parseCounted(countedText);
  const preview = selected && counted !== null ? countDiff(expected, counted, selected.cost_price) : null;
  const countedProducts = useMemo(() => new Set(lines.map((l) => l.product_id)).size, [lines]);

  const pick = async (p: Product) => {
    setSelected(p);
    setCountedText('');
    setQuery('');
    setExpected(await expectedStock(p.id));
  };

  const onScan = (code: string) => {
    const p = productForCode(products, code);
    if (p) void pick(p);
    else showAlert('Código sin producto', `No hay un producto con inventario y el código ${code}. Búscalo por nombre.`);
  };

  const confirm = async () => {
    if (!selected || !countId || counted === null || busy) return;
    setBusy(true);
    try {
      const r = await recordStockCount(countId, selected.id, counted);
      setLines(await stockCountLines(countId));
      const changed = r.expected !== expected
        ? ` El sistema pasó de ${expected} a ${r.expected} mientras contabas, y se usó ${r.expected}.`
        : '';
      const value = r.units > 0 ? ` · ${money(asMinor(r.value))} a costo` : '';
      showAlert('Conteo guardado', `${r.name}: ${diffLabel(r)}${value}.${changed}`);
      setSelected(null);
      setCountedText('');
    } catch (e) {
      showAlert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!countId || busy) return;
    setBusy(true);
    try {
      await closeStockCount(countId);
      router.replace('/stock-count-report');
    } catch (e) {
      showAlert('No se pudo terminar el conteo', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const footer = selected ? (
    <PrimaryButton icon="checkmark" label="Confirmar conteo" onPress={confirm} busy={busy} disabled={counted === null} />
  ) : (
    <PrimaryButton
      icon="flag-outline"
      label={countedProducts === 0 ? 'Cuenta al menos un producto' : `Terminar conteo · ${countedProducts} producto${countedProducts === 1 ? '' : 's'}`}
      onPress={finish} busy={busy} disabled={countedProducts === 0}
    />
  );

  return (
    <Screen
      title="Conteo de inventario"
      subtitle="Cuenta lo que hay y compáralo con el sistema"
      scroll={false}
      right={<IconButton icon="document-text-outline" label="Informe de diferencias" onPress={() => router.push('/stock-count-report')} />}
      footer={footer}
    >
      {selected ? (
        <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17 }} numberOfLines={2}>{selected.name}</Text>
          <View style={s.compare}>
            <View style={s.box}>
              <Text style={[s.boxLabel, { color: t.muted }]}>Esperado</Text>
              <Text style={[s.boxValue, { color: t.fg }]}>{expected}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>según el sistema</Text>
            </View>
            <View style={s.box}>
              <Text style={[s.boxLabel, { color: t.muted }]}>Contado</Text>
              <TextInput
                value={countedText} onChangeText={setCountedText} keyboardType="number-pad" autoFocus
                placeholder="0" placeholderTextColor={t.faint} maxLength={7} accessibilityLabel="Cantidad contada"
                style={[s.input, { color: t.fg, borderColor: t.accent, backgroundColor: t.bg }]}
              />
            </View>
          </View>
          {preview ? (
            <View style={[s.diff, { backgroundColor: t.surfaceAlt }]}>
              <Text style={{ color: preview.kind === 'faltante' ? t.warnText : t.fg, fontWeight: '800' }}>{diffLabel(preview)}</Text>
              {preview.units > 0 ? <Text style={{ color: t.muted, marginTop: 2 }}>{money(asMinor(preview.value))} a costo</Text> : null}
            </View>
          ) : countedText ? (
            <Text style={{ color: t.warnText, marginTop: space.md }}>Escribe un número entero de 0 o más.</Text>
          ) : null}
          <Pressable onPress={() => setSelected(null)} hitSlop={8} style={{ marginTop: space.lg, alignSelf: 'center' }}>
            <Text style={{ color: t.muted, fontWeight: '700' }}>Elegir otro producto</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={s.pinned}>
            <SearchField
              value={query} onChangeText={setQuery} placeholder="Buscar producto o código"
              right={<Pressable onPress={() => setScanning(true)} hitSlop={10} accessibilityLabel="Escanear código"><Ionicons name="barcode-outline" size={22} color={t.accent} /></Pressable>}
            />
          </View>
          {query.trim() ? (
            <FlatList
              {...listProps}
              data={matches}
              keyExtractor={(p) => p.id}
              contentContainerStyle={s.list}
              ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
              ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: space.xl }}>Ningún producto con inventario coincide.</Text>}
              renderItem={({ item }) => (
                <Pressable onPress={() => pick(item)} style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
                  <Text style={{ color: t.fg, fontWeight: '700', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={t.muted} />
                </Pressable>
              )}
            />
          ) : lines.length === 0 ? (
            <EmptyState
              icon="clipboard-outline"
              title={trackedCount === 0 ? 'No hay productos con inventario' : 'Empieza a contar'}
              hint={trackedCount === 0 ? 'Activa "controlar inventario" en tus productos para poder contarlos.' : 'Escanea o busca un producto y escribe cuántas unidades hay.'}
            />
          ) : (
            <FlatList
              {...listProps}
              data={lines}
              keyExtractor={(l) => l.id}
              contentContainerStyle={s.list}
              ListHeaderComponent={<Text style={[s.section, { color: t.muted }]}>Contados en este conteo</Text>}
              ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
              renderItem={({ item }) => {
                const d = countDiff(item.expected_qty, item.counted_qty, item.unit_cost);
                return (
                  <View style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.fg, fontWeight: '700' }} numberOfLines={1}>{item.product_name_snapshot}</Text>
                      <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>Esperado {item.expected_qty} · contado {item.counted_qty}</Text>
                    </View>
                    <Text style={{ color: d.kind === 'faltante' ? t.warnText : t.muted, fontWeight: '700' }}>{diffLabel(d)}</Text>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
      <ScanModal visible={scanning} onClose={() => setScanning(false)} onScan={onScan} />
    </Screen>
  );
}

const s = StyleSheet.create({
  pinned: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm },
  section: { fontSize: 13, fontWeight: '600', marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  card: { margin: space.lg, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  compare: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  box: { flex: 1, alignItems: 'center' },
  boxLabel: { fontSize: 13, fontWeight: '600', marginBottom: space.xs },
  boxValue: { fontSize: 34, fontWeight: '800', lineHeight: 52 },
  input: { fontSize: 30, fontWeight: '800', borderWidth: 2, borderRadius: radius.md, minWidth: 110, textAlign: 'center', paddingVertical: space.xs },
  diff: { marginTop: space.lg, borderRadius: radius.md, padding: space.md, alignItems: 'center' },
});
