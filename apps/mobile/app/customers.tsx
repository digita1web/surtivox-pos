import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { asMinor, type Minor } from '@surtivox/pos-core';
import { listCustomers, outstandingCredit, type Customer, type OutstandingTotal } from '../src/repos';
import { useSession } from '../src/session';
import { useMoney } from '../src/pos/ui';
import { Screen, IconButton, listProps } from '../src/pos/Screen';
import { SearchField, Chip, ChipRow, EmptyState } from '../src/pos/kit';
import { useTheme, initials, space, radius } from '../src/theme';

export default function Customers() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingTotal>({ totalOwed: 0, customersWithBalance: 0 });
  const [q, setQ] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);

  useFocusEffect(useCallback(() => {
    listCustomers(store.id).then(setCustomers);
    outstandingCredit(store.id).then(setOutstanding);
  }, [store.id]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return customers.filter((c) =>
      (!onlyDebt || c.balance > 0) &&
      (!s || c.name.toLowerCase().includes(s) || (c.phone ?? '').includes(s)));
  }, [customers, q, onlyDebt]);

  return (
    <Screen
      title="Clientes"
      scroll={false}
      right={<IconButton icon="person-add-outline" label="Agregar cliente" filled onPress={() => router.push('/add-customer')} />}
    >
      <View style={s.pinned}>
        {outstanding.totalOwed > 0 && (
          <View style={[s.summary, { backgroundColor: t.accent }]}>
            <View>
              <Text style={{ color: t.accentFg, opacity: 0.9, fontSize: 12 }}>Fiado pendiente</Text>
              <Text style={{ color: t.accentFg, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{money(asMinor(outstanding.totalOwed))}</Text>
            </View>
            <Text style={{ color: t.accentFg, opacity: 0.9 }}>{outstanding.customersWithBalance} cliente{outstanding.customersWithBalance === 1 ? '' : 's'}</Text>
          </View>
        )}
        <SearchField value={q} onChangeText={setQ} placeholder="Buscar nombre o teléfono" />
        <ChipRow>
          <Chip label="Todos" on={!onlyDebt} onPress={() => setOnlyDebt(false)} />
          <Chip label="Debe fiado" on={onlyDebt} onPress={() => setOnlyDebt(true)} />
        </ChipRow>
      </View>

      <FlatList
        {...listProps}
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Aún no hay clientes" hint="Agrega clientes frecuentes para llevar el fiado." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/customer/${item.id}`)} style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800' }}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.name}</Text>
              {item.phone ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{item.phone}</Text> : null}
            </View>
            {item.balance > 0
              ? <Text style={{ color: t.danger, fontWeight: '800' }}>{money(item.balance as Minor)}</Text>
              : <Text style={{ color: t.muted, fontSize: 12 }}>Al día</Text>}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  pinned: { padding: space.lg, gap: space.md },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.lg, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
