import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getReorderSuggestions, type ReorderRow } from '../src/repos';
import { useSession } from '../src/session';
import { Screen, listProps } from '../src/pos/Screen';
import { EmptyState, PrimaryButton } from '../src/pos/kit';
import { Row } from '../src/pos/ui';
import { showAlert } from '../src/pos/alert';
import { useTheme, space, radius, type as ty } from '../src/theme';

function stockMessage(days: number | null): string {
  if (days === null) return 'Sin historial de ventas';
  if (days === 0) return 'Sin stock';
  return `Se acaba en ${Number(days.toFixed(1))} días`;
}

function urgencyLabel(urgency: ReorderRow['urgency']): string {
  if (urgency === 'critical') return 'Crítico';
  if (urgency === 'low') return 'Bajo';
  return 'OK';
}

function UrgencyBadge({ urgency }: { urgency: ReorderRow['urgency'] }) {
  const t = useTheme();
  const color = urgency === 'critical' ? t.danger : urgency === 'low' ? t.warn : t.ok;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[ty.micro, { color }]}>{urgencyLabel(urgency)}</Text>
    </View>
  );
}

export default function Reorder() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const store = useSession((s) => s.store)!;
  const [rows, setRows] = useState<ReorderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getReorderSuggestions(store.id)
      .then((next) => { if (active) setRows(next); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [store.id]));

  if (loading) {
    return (
      <Screen title="Sugerencia de pedido" subtitle="Sugerencia para los próximos 7 días" scroll={false}>
        <View style={styles.center}><ActivityIndicator color={t.accent} size="large" /></View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Sugerencia de pedido" subtitle="Sugerencia para los próximos 7 días" scroll={false}>
        <EmptyState icon="alert-circle-outline" title="No se pudo cargar la sugerencia" hint={error} />
      </Screen>
    );
  }

  return (
    <Screen title="Sugerencia de pedido" subtitle="Sugerencia para los próximos 7 días" scroll={false}>
      <FlatList
        {...listProps}
        data={rows}
        keyExtractor={(row) => row.product_id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.xxl }]}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListEmptyComponent={<EmptyState icon="checkmark-circle-outline" title="Todo en orden. No hay pedidos urgentes." />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[ty.h2, { color: t.fg }]} numberOfLines={2}>{item.product_name}</Text>
                <Text style={[ty.small, { color: item.days_of_stock_left === 0 ? t.danger : t.muted, marginTop: 2 }]}>
                  {stockMessage(item.days_of_stock_left)}
                </Text>
              </View>
              <UrgencyBadge urgency={item.urgency} />
            </View>
            <View style={{ marginTop: space.md }}>
              <Row label="Stock actual" value={String(item.current_stock)} />
              <Row label="Venta diaria" value={`${item.units_per_day} u/día`} />
            </View>
            <View style={{ marginTop: space.md }}>
              <PrimaryButton
                label={`Pedir ${item.suggested_quantity}`}
                onPress={() => showAlert('Pedido sugerido', `Pedir ${item.suggested_quantity} de ${item.product_name}`)}
              />
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
});
