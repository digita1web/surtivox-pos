import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@openpocket/pos-core';
import { formatCopAmount } from '../receiptMoney';
import { getMarketPricesCache, refreshMarketPrices, type MarketPriceRow } from '../repos';
import { isValidEan } from '../marketPrices';
import { useTheme, space, radius } from '../theme';

type Status = 'loading' | 'ready' | 'empty' | 'offline' | 'error';

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
  const [rows, setRows] = useState<MarketPriceRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isValidEan(ean)) return;
    let active = true;
    setRows([]);
    setFetchedAt(null);
    setStatus('loading');
    setStale(false);
    getMarketPricesCache(ean)
      .then((cached) => {
        if (!active) return;
        setRows(cached.rows);
        setFetchedAt(cached.fetchedAt);
        if (cached.rows.length === 0) return;
        setStatus('ready');
      })
      .catch(() => {});
    refreshMarketPrices(ean)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setFetchedAt(result.fetchedAt);
        setStale(result.status === 'stale');
        if (result.status === 'offline' && result.rows.length === 0) setStatus('offline');
        else if (result.status === 'error' && result.rows.length === 0) setStatus('error');
        else setStatus(result.rows.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (active) setStatus((current) => (current === 'loading' ? 'error' : current));
      });
    return () => { active = false; };
  }, [ean]);

  if (!isValidEan(ean)) return null;

  const update = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const result = await refreshMarketPrices(ean, true);
      setRows(result.rows);
      setFetchedAt(result.fetchedAt);
      setStale(result.status === 'stale');
      if (result.status === 'offline' && result.rows.length === 0) setStatus('offline');
      else if (result.status === 'error' && result.rows.length === 0) setStatus('error');
      else setStatus(result.rows.length > 0 ? 'ready' : 'empty');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[s.wrap, { borderColor: t.line, backgroundColor: t.panel }]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: t.fg }]}>Precios de referencia del mercado</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 3 }}>Información publicada por supermercados. No modifica tus precios ni tu inventario.</Text>
        </View>
        <Pressable onPress={update} disabled={refreshing} hitSlop={10} accessibilityLabel="Actualizar precios de referencia" style={{ padding: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
        <Text style={{ color: t.danger, marginTop: space.md }}>No se pudieron consultar los precios. Intenta de nuevo.</Text>
      )}

      {status === 'empty' && (
        <Text style={{ color: t.muted, marginTop: space.md }}>No hay precios publicados para este EAN en los supermercados compatibles.</Text>
      )}

      {rows.length > 0 && fetchedAt ? (
        <Text style={{ color: t.faint, fontSize: 11, marginTop: space.sm }}>
          Consultado por Surtivox: {formatWhen(fetchedAt)}
        </Text>
      ) : null}

      {stale && rows.length > 0 ? (
        <Text style={{ color: t.warn, fontSize: 11, marginTop: space.sm }}>
          Datos guardados sin actualizar. Pueden estar desactualizados.
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
  row: { borderTopWidth: 1, paddingTop: space.md, marginTop: space.md },
});
