import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@surtivox/pos-core';
import { formatCopAmount } from '../receiptMoney';
import { isValidEan } from '../marketPrices';
import { useTheme, space, radius } from '../theme';
import { useMarketPrices } from './useMarketPrices';

function formatWhen(value: number | null): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function MarketPricesSection({ ean }: { ean: string }) {
  const t = useTheme();
  const { rows, fetchedAt, status, stale, refreshing, refresh, lowest, mixedPresentations, ageLabel: age } = useMarketPrices(ean);

  if (!isValidEan(ean)) return null;

  return (
    <View style={[s.wrap, { borderColor: t.line, backgroundColor: t.panel }]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: t.fg }]}>Precios de referencia del mercado</Text>
          <Text style={{ color: t.muted, fontSize: 11, marginTop: 3 }}>Precios de supermercados, solo de referencia. No cambian los tuyos.</Text>
        </View>
        <Pressable onPress={() => void refresh()} disabled={refreshing} hitSlop={10} accessibilityLabel="Actualizar precios de referencia" style={{ padding: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {refreshing ? <ActivityIndicator size="small" color={t.accent} /> : <Ionicons name="refresh-outline" size={18} color={t.accent} />}
          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>Actualizar</Text>
        </Pressable>
      </View>

      {status === 'loading' && rows.length === 0 && (
        <View style={s.center}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.muted, marginTop: 8 }}>Consultando precios…</Text>
        </View>
      )}

      {status === 'offline' && rows.length === 0 && (
        <Text style={{ color: t.muted, marginTop: space.md }}>Sin conexión. No hay precios guardados para este producto.</Text>
      )}

      {status === 'error' && rows.length === 0 && (
        <Text style={{ color: t.dangerText, marginTop: space.md }}>No se pudieron consultar los precios. Intenta de nuevo.</Text>
      )}

      {status === 'empty' && (
        <Text style={{ color: t.muted, marginTop: space.md }}>No hay precios publicados para este EAN en los supermercados compatibles.</Text>
      )}

      {rows.length > 0 && fetchedAt ? (
        <Text style={{ color: t.faint, fontSize: 11, marginTop: space.sm }}>
          Consultado por Surtivox: {formatWhen(fetchedAt)}{age ? ` · ${age}` : ''}
        </Text>
      ) : null}

      {stale && rows.length > 0 ? (
        <Text style={{ color: t.warnText, fontSize: 11, marginTop: space.sm }}>
          Datos guardados sin actualizar. Pueden estar desactualizados.
        </Text>
      ) : null}

      {lowest ? (
        <View style={[s.summary, { borderColor: t.accent, backgroundColor: t.accentSoft }]}>
          <Text style={{ color: t.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Precio más bajo comparable</Text>
          <Text style={{ color: t.fg, fontSize: 20, fontWeight: '800', marginTop: 3 }}>{formatCopAmount(asMinor(lowest.price_minor))}</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{lowest.supermarket_name} · {lowest.presentation}</Text>
        </View>
      ) : null}

      {mixedPresentations ? (
        <Text style={{ color: t.warnText, fontSize: 11, marginTop: space.sm }}>
          Las presentaciones difieren. Compara productos equivalentes antes de sacar conclusiones.
        </Text>
      ) : null}

      {rows.map((row) => (
        <View key={`${row.provider_id}:${row.context_key}`} style={[s.row, { borderColor: t.line }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: t.fg, fontWeight: '800', fontSize: 14 }}>{row.supermarket_name}</Text>
              <Text style={{ color: t.faint, fontSize: 11 }}>COP</Text>
            </View>
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{row.product_name}</Text>
            {row.presentation ? <Text style={{ color: t.faint, fontSize: 11, marginTop: 2 }}>{row.presentation}</Text> : null}
            {row.location ? <Text style={{ color: t.faint, fontSize: 11, marginTop: 2 }}>{row.location}</Text> : null}
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{formatCopAmount(asMinor(row.price_minor))}</Text>
            {row.source_updated_at ? <Text style={{ color: t.faint, fontSize: 11, marginTop: 3 }}>Actualizado en origen: {formatWhen(row.source_updated_at)}</Text> : null}
            {row.product_url ? (
              <Pressable onPress={() => { void Linking.openURL(row.product_url!).catch(() => {}); }} hitSlop={8} style={{ marginTop: 6 }}>
                <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>Ver publicación original</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { fontSize: 15, fontWeight: '800' },
  center: { alignItems: 'center', paddingVertical: space.lg },
  summary: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  row: { borderTopWidth: 1, paddingTop: space.md, marginTop: space.md },
});
