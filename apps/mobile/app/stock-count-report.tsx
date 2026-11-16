import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@surtivox/pos-core';
import { stockCountReport, stockCountStaff, type CountReport, type CountStaff } from '../src/repos';
import { useSession } from '../src/session';
import { useMoney } from '../src/pos/ui';
import { showAlert } from '../src/pos/alert';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { Chip, ChipRow, EmptyState } from '../src/pos/kit';
import { PERIOD_LABEL, periodRange, type CountPeriod } from '../src/stockCount';
import { NEUTRAL_NOTE } from '../src/countReport';
import { shareCountReportPdf, shareCountReportWhatsApp } from '../src/countShare';

const PERIODS: CountPeriod[] = ['hoy', '7d', '30d', 'todo'];

type StaffFilter = { kind: 'all' } | { kind: 'staff'; id: string; name: string };

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

function dateOf(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function StockCountReport() {
  const t = useTheme();
  const router = useRouter();
  const money = useMoney();
  const store = useSession((s) => s.store)!;
  const [period, setPeriod] = useState<CountPeriod>('30d');
  const [who, setWho] = useState<StaffFilter>({ kind: 'all' });
  const [staff, setStaff] = useState<CountStaff[]>([]);
  const [report, setReport] = useState<CountReport | null>(null);
  const [sharing, setSharing] = useState(false);

  useFocusEffect(useCallback(() => {
    let live = true;
    const filter = { ...periodRange(period, Date.now()), ...(who.kind === 'staff' ? { staffId: who.id } : {}) };
    Promise.all([stockCountReport(store.id, filter), stockCountStaff(store.id)])
      .then(([r, s]) => { if (live) { setReport(r); setStaff(s); } })
      .catch((e) => showAlert('No se pudo cargar el informe', e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [store.id, period, who]));

  const m = (minor: number) => money(asMinor(minor));
  const opts = { storeName: store.name, periodLabel: PERIOD_LABEL[period], staffLabel: who.kind === 'staff' ? who.name : 'Todos', money: m };

  const share = async (how: 'whatsapp' | 'pdf') => {
    if (!report || sharing) return;
    setSharing(true);
    try {
      if (how === 'whatsapp') await shareCountReportWhatsApp(report, opts);
      else await shareCountReportPdf(report, { ...opts, dateOf });
    } catch (e) {
      showAlert('No se pudo compartir', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const tot = report?.totals;
  const short = report?.products.filter((p) => p.shortUnits > 0) ?? [];
  const over = (report?.products.filter((p) => p.overUnits > 0) ?? []).sort((a, b) => b.overValue - a.overValue);

  return (
    <Screen title="Diferencias de inventario" subtitle="Resultado de los conteos físicos">
      <View style={{ padding: space.lg }}>
        <ChipRow>
          {PERIODS.map((p) => <Chip key={p} label={PERIOD_LABEL[p]} on={period === p} onPress={() => setPeriod(p)} />)}
        </ChipRow>
        {staff.length > 0 ? (
          <View style={{ marginTop: space.sm }}>
            <ChipRow>
              <Chip label="Todos" on={who.kind === 'all'} onPress={() => setWho({ kind: 'all' })} />
              {staff.map((e) => (
                <Chip key={e.id} label={e.name} on={who.kind === 'staff' && who.id === e.id} onPress={() => setWho({ kind: 'staff', id: e.id, name: e.name })} />
              ))}
            </ChipRow>
          </View>
        ) : null}

        {!report || !tot ? null : tot.productsCounted === 0 ? (
          <EmptyState
            icon="clipboard-outline" title="Sin conteos en este periodo"
            hint="Cuando cuentes productos, aquí verás qué faltó y qué sobró."
            action={{ label: 'Contar ahora', onPress: () => router.replace('/stock-count') }}
          />
        ) : (
          <>
            <Text style={{ color: t.muted, marginTop: space.lg }}>
              {tot.productsCounted} producto{tot.productsCounted === 1 ? '' : 's'} contado{tot.productsCounted === 1 ? '' : 's'} en {tot.counts} conteo{tot.counts === 1 ? '' : 's'}
            </Text>
            <View style={s.totals}>
              <View style={[s.total, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Text style={{ color: t.muted, fontWeight: '600' }}>Faltante</Text>
                <Text style={{ color: tot.shortUnits ? t.warnText : t.fg, fontWeight: '800', fontSize: 18, marginTop: 2 }}>{m(tot.shortValue)}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{units(tot.shortUnits)} · a costo</Text>
              </View>
              <View style={[s.total, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Text style={{ color: t.muted, fontWeight: '600' }}>Sobrante</Text>
                <Text style={{ color: t.fg, fontWeight: '800', fontSize: 18, marginTop: 2 }}>{m(tot.overValue)}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{units(tot.overUnits)} · a costo</Text>
              </View>
            </View>

            <View style={s.actions}>
              <Pressable onPress={() => share('whatsapp')} disabled={sharing} style={[s.action, { borderColor: t.accent }]}>
                <Ionicons name="logo-whatsapp" size={18} color={t.accent} />
                <Text style={{ color: t.accent, fontWeight: '700' }}>WhatsApp</Text>
              </Pressable>
              <Pressable onPress={() => share('pdf')} disabled={sharing} style={[s.action, { borderColor: t.accent }]}>
                <Ionicons name="document-outline" size={18} color={t.accent} />
                <Text style={{ color: t.accent, fontWeight: '700' }}>PDF</Text>
              </Pressable>
            </View>

            {short.length > 0 ? <Text style={[s.section, { color: t.fg }]}>Faltantes por producto</Text> : null}
            {short.map((p) => (
              <View key={`f-${p.productId}`} style={[s.row, { borderColor: t.line }]}>
                <Text style={{ color: t.fg, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ color: t.warnText, fontWeight: '700' }}>{units(p.shortUnits)} · {m(p.shortValue)}</Text>
              </View>
            ))}
            {over.length > 0 ? <Text style={[s.section, { color: t.fg }]}>Sobrantes por producto</Text> : null}
            {over.map((p) => (
              <View key={`s-${p.productId}`} style={[s.row, { borderColor: t.line }]}>
                <Text style={{ color: t.fg, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ color: t.fg, fontWeight: '700' }}>{units(p.overUnits)} · {m(p.overValue)}</Text>
              </View>
            ))}
            {short.length === 0 && over.length === 0 ? (
              <Text style={{ color: t.fg, marginTop: space.lg, fontWeight: '700' }}>Todo lo contado coincide con el sistema.</Text>
            ) : null}

            <Text style={[s.section, { color: t.fg }]}>Por conteo</Text>
            {report.counts.map((c) => (
              <View key={c.countId} style={[s.count, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Text style={{ color: t.fg, fontWeight: '700' }}>{dateOf(c.startedAt)}{c.closedAt ? '' : ' · en curso'}</Text>
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                  {c.staffName ? `Hecho por ${c.staffName}` : 'Sin empleado'} · {c.products} producto{c.products === 1 ? '' : 's'}
                </Text>
                <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                  Faltante {units(c.shortUnits)} ({m(c.shortValue)}) · Sobrante {units(c.overUnits)} ({m(c.overValue)})
                </Text>
              </View>
            ))}
            <Text style={{ color: t.muted, fontSize: 12, marginTop: space.lg }}>{NEUTRAL_NOTE}</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  totals: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  total: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  action: { flex: 1, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.md, height: 44 },
  section: { fontSize: 15, fontWeight: '800', marginTop: space.xl, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1 },
  count: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm },
});
