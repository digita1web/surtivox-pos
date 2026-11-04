import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@surtivox/pos-core';
import { formatCopAmount } from '../receiptMoney';
import { normalizePresentation } from '../marketPriceSummary';
import { useTheme, space, radius } from '../theme';
import { useMarketPrices, type MarketPricesHook } from './useMarketPrices';

interface MarketPricesCompactProps {
  ean: string;
}

export function MarketPricesCompact({ ean }: MarketPricesCompactProps) {
  const prices = useMarketPrices(ean);
  return <MarketPricesCompactView prices={prices} />;
}

export function MarketPricesCompactView({ prices }: { prices: MarketPricesHook }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { rows, status, stale, refreshing, refresh, lowest, mixedPresentations, ageLabel, old } = prices;

  const lowestRow = useMemo(() => {
    if (!lowest) return undefined;
    return rows.find((row) => (
      row.price_minor === lowest.price_minor
      && row.supermarket_name === lowest.supermarket_name
      && normalizePresentation(row.presentation) === lowest.presentation
    ));
  }, [lowest, rows]);

  const others = useMemo(() => {
    if (!lowestRow || mixedPresentations) return rows.slice(0, 2);
    return rows.filter((row) => row !== lowestRow).slice(0, 2);
  }, [lowestRow, mixedPresentations, rows]);

  const visibleAge = old || stale ? 'dato antiguo' : ageLabel;

  return (
    <View style={[s.wrap, { borderColor: t.line, backgroundColor: t.panel }]}>
      <View style={s.head}>
        <Text style={[s.title, { color: t.fg }]} numberOfLines={1}>Precio en supermercados</Text>
        <View style={s.headRight}>
          {visibleAge ? (
            <Text style={{ color: old || stale ? t.warnText : t.faint, fontSize: 11 }} numberOfLines={1}>
              {visibleAge}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void refresh()}
            disabled={refreshing}
            hitSlop={10}
            accessibilityLabel="Actualizar precios de supermercados"
            style={s.refresh}
          >
            <Ionicons name="refresh-outline" size={17} color={refreshing ? t.faint : t.accent} />
          </Pressable>
        </View>
      </View>

      {status === 'loading' && rows.length === 0 ? (
        <Text style={[s.state, { color: t.muted }]}>Consultando precios…</Text>
      ) : null}
      {status === 'offline' && rows.length === 0 ? (
        <Text style={[s.state, { color: t.muted }]}>Sin conexión. Sin precios de referencia.</Text>
      ) : null}
      {status === 'empty' ? (
        <Text style={[s.state, { color: t.muted }]}>Sin precios publicados para este código.</Text>
      ) : null}
      {status === 'error' && rows.length === 0 ? (
        <Text style={[s.state, { color: t.muted }]}>No se pudieron consultar los precios.</Text>
      ) : null}

      {lowest && !mixedPresentations ? (
        <View style={[s.lowest, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
          <Text style={{ color: t.accent, fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
            Más bajo · {lowest.supermarket_name}
          </Text>
          <Text style={{ color: t.fg, fontSize: 24, fontWeight: '800', marginTop: 1 }}>
            {formatCopAmount(asMinor(lowest.price_minor))}
          </Text>
          <Text style={{ color: t.muted, fontSize: 11 }} numberOfLines={1}>{lowest.presentation}</Text>
        </View>
      ) : null}

      {mixedPresentations ? (
        <Text style={{ color: t.warnText, fontSize: 11, marginTop: space.sm }}>
          Las presentaciones difieren
        </Text>
      ) : null}

      {others.length > 0 ? (
        <Text style={{ color: t.muted, fontSize: 11, marginTop: space.sm }} numberOfLines={1}>
          {others.map((row) => `${row.supermarket_name} ${formatCopAmount(asMinor(row.price_minor))}`).join(' · ')}
        </Text>
      ) : null}

      {rows.length > 0 ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          hitSlop={8}
          accessibilityLabel={expanded ? 'Ocultar detalle de precios' : 'Ver detalle de precios'}
          style={s.detailButton}
        >
          <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700' }}>
            {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={t.accent} />
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={[s.detail, { borderColor: t.line }]}>
          {rows.map((row) => (
            <View key={`${row.provider_id}:${row.context_key}`} style={[s.detailRow, { borderColor: t.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg, fontWeight: '700', fontSize: 12 }}>{row.supermarket_name}</Text>
                <Text style={{ color: t.muted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{row.product_name}</Text>
                {row.presentation ? <Text style={{ color: t.faint, fontSize: 10 }}>{row.presentation}</Text> : null}
                {row.product_url ? (
                  <Pressable
                    onPress={() => { void Linking.openURL(row.product_url!).catch(() => {}); }}
                    hitSlop={8}
                    accessibilityLabel={`Ver publicación original de ${row.supermarket_name}`}
                    style={{ marginTop: 2 }}
                  >
                    <Text style={{ color: t.accent, fontSize: 10, fontWeight: '700' }}>Ver publicación original</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={{ color: t.fg, fontWeight: '800', fontSize: 12 }}>{formatCopAmount(asMinor(row.price_minor))}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ color: t.faint, fontSize: 11, lineHeight: 14, marginTop: space.sm }}>
        Precios de supermercados, solo de referencia. No cambian los tuyos.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1, fontSize: 13, fontWeight: '800' },
  refresh: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  state: { fontSize: 12, marginTop: space.sm },
  lowest: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginTop: space.sm },
  detailButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, minHeight: 44 },
  detail: { borderTopWidth: 1, marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 7 },
});
