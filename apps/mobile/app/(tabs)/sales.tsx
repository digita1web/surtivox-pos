import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { asMinor } from '@openpocket/pos-core';
import { listSales, voidSale, type SaleSummary } from '../../src/repos';
import { useSession, useRole } from '../../src/session';
import { can } from '../../src/roles';
import { useCheckoutUI } from '../../src/checkoutUI';
import { showAlert } from '../../src/pos/alert';
import { useMoney } from '../../src/pos/ui';
import { TabHeader, listProps, useTabListInset } from '../../src/pos/Screen';
import { SearchField, Chip, ChipRow, ChipDivider, EmptyState } from '../../src/pos/kit';
import { useTheme, space, radius } from '../../src/theme';

const PAYMENT_LABEL_ES: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', wallet: 'Nequi / Daviplata', bank: 'Transferencia', credit: 'Fiado' };

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.getTime() >= today.getTime() ? `Hoy ${time}` : `${d.toLocaleDateString()} ${time}`;
}

type Range = 'today' | '7d' | '30d' | 'all';
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: 'today', label: 'Hoy', days: 0 },
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: 'all', label: 'Todo el tiempo', days: null },
];
const METHODS: { key: string; label: string }[] = [
  { key: 'all', label: 'Cualquier pago' },
  { key: 'cash', label: 'Efectivo' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'bank', label: 'Transferencia' },
  { key: 'wallet', label: 'Nequi / Daviplata' },
  { key: 'credit', label: 'Fiado' },
];

function sinceFor(range: Range): number | undefined {
  const d = new Date();
  if (range === 'today') { d.setHours(0, 0, 0, 0); return d.getTime(); }
  const days = RANGES.find((r) => r.key === range)?.days;
  if (days == null) return undefined;
  return Date.now() - days * 86400_000;
}

export default function Sales() {
  const t = useTheme();
  const router = useRouter();
  const listInset = useTabListInset();
  const store = useSession((s) => s.store)!; // scope sales to the current shop
  const money = useMoney();
  const canVoid = can(useRole(), 'returns');
  const bumpSales = useCheckoutUI((s) => s.bumpSales);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [range, setRange] = useState<Range>('today');
  const [method, setMethod] = useState('all');
  const [q, setQ] = useState('');

  const refresh = useCallback(() => {
    listSales({ storeId: store.id, since: sinceFor(range) }).then(setSales);
  }, [range, store.id]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const voidOne = async (sale: SaleSummary) => {
    try {
      await voidSale(store.id, sale.id);
      refresh();
      bumpSales();
      showAlert('Venta anulada', `${sale.invoice_no} se anuló y el stock volvió al inventario.`);
    } catch (e) {
      showAlert('No se pudo anular la venta', e instanceof Error ? e.message : String(e));
    }
  };

  const confirmVoid = (sale: SaleSummary) => {
    showAlert('Anular venta', '¿Anular esta venta? El dinero se restará del total del día y los productos volverán al inventario.', [
      { text: 'Cancelar', style: 'cancel' as const },
      { text: 'Anular venta', style: 'destructive' as const, onPress: () => { void voidOne(sale); } },
    ]);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sales.filter((x) =>
      (method === 'all' || x.payment_method === method) &&
      (!s || x.invoice_no.toLowerCase().includes(s) || (x.staff_name ?? '').toLowerCase().includes(s)));
  }, [sales, method, q]);

  const total = useMemo(() => filtered.reduce((sum, x) => sum + x.grand_total, 0), [filtered]);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? '';

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <TabHeader title="Ventas" subtitle={`${rangeLabel} · ${filtered.length} ${filtered.length === 1 ? 'pedido' : 'pedidos'}`}>
        <View style={s.controls}>
          <SearchField value={q} onChangeText={setQ} placeholder="Buscar factura o cajero" />
          <ChipRow>
            {RANGES.map((r) => <Chip key={r.key} label={r.label} on={range === r.key} onPress={() => setRange(r.key)} />)}
            <ChipDivider />
            {METHODS.map((m) => <Chip key={m.key} label={m.label} on={method === m.key} onPress={() => setMethod(m.key)} />)}
          </ChipRow>
        </View>
      </TabHeader>

      <FlatList
        {...listProps}
        data={filtered}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: listInset, flexGrow: 1 }}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={[s.summary, { backgroundColor: t.accent }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.accentFg, opacity: 0.85, fontSize: 12.5 }}>Total de {rangeLabel}</Text>
              <Text style={{ color: t.accentFg, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                {money(asMinor(total))}
              </Text>
            </View>
            <Ionicons name="trending-up" size={28} color={t.accentFg} style={{ opacity: 0.7 }} />
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: space.md }}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No se encontraron ventas" hint="Prueba otro período o filtro de pago." />}
        renderItem={({ item }) => (
          <View style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <Pressable onPress={() => router.push(`/sale/${item.id}`)}
              style={({ pressed }) => [s.rowMain, { opacity: pressed ? 0.85 : 1 }]}>
              <View style={[s.badge, { backgroundColor: t.accentSoft }]}><Ionicons name="receipt-outline" size={20} color={t.accent} /></View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={{ color: t.fg, fontWeight: '700' }}>{item.invoice_no}</Text>
                <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                  {when(item.sold_at)} · {item.item_count} artículo{item.item_count === 1 ? '' : 's'} · {PAYMENT_LABEL_ES[item.payment_method] ?? item.payment_method}
                </Text>
              </View>
              <Text style={{ color: t.fg, fontWeight: '800', fontSize: 16 }}>{money(asMinor(item.grand_total))}</Text>
              <Ionicons name="chevron-forward" size={18} color={t.faint} style={{ marginLeft: space.sm }} />
            </Pressable>
            {canVoid && (
              <Pressable onPress={() => confirmVoid(item)} hitSlop={8} accessibilityLabel={`Anular venta ${item.invoice_no}`}
                style={[s.voidBtn, { backgroundColor: t.danger + '18' }]}>
                <Ionicons name="trash-outline" size={18} color={t.danger} />
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const Gap = () => <View style={{ height: space.sm + 2 }} />;

const s = StyleSheet.create({
  root: { flex: 1 },
  controls: { gap: space.md, marginTop: space.xs },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  voidBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: space.sm },
  badge: { width: 42, height: 42, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
});
