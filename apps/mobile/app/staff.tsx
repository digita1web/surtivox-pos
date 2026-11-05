import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listStaff, deleteStaff, type Staff } from '../src/repos';
import { ROLE_LABEL, type Role } from '../src/roles';
import { AUTO_LOCK_OPTIONS, FREE_ATTEMPTS } from '../src/staffRules';
import { useSession } from '../src/session';
import { Screen, IconButton, listProps } from '../src/pos/Screen';
import { EmptyState } from '../src/pos/kit';
import { useTheme, initials, tileColor, space, radius, circle, type Theme } from '../src/theme';

function roleChip(t: Theme, role: Role): { background: string; color: string } {
  if (role === 'owner') return { background: t.accentSoft, color: t.accent };
  if (role === 'manager') return { background: `${t.orange}26`, color: t.warnText };
  return { background: t.surfaceAlt, color: t.muted };
}

export default function StaffScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const me = useSession((s) => s.staff);
  const refreshStaffCount = useSession((s) => s.refreshStaffCount);
  const autoLockMinutes = useSession((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useSession((s) => s.setAutoLockMinutes);
  const [staff, setStaff] = useState<Staff[]>([]);

  const reload = useCallback(() => {
    listStaff(store.id).then(setStaff);
    refreshStaffCount();
  }, [store.id]);
  useFocusEffect(reload);

  const owners = staff.filter((m) => m.role === 'owner').length;
  const isLastOwner = (m: Staff) => m.role === 'owner' && owners <= 1;
  const canRemove = (m: Staff) => m.id !== me?.id && !isLastOwner(m);

  const confirmDelete = (m: Staff) => {
    showAlert('Quitar personal', `¿Quitar a ${m.name}? Sus ventas anteriores se conservan.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: async () => {
        try { await deleteStaff(store.id, m.id, me?.id ?? null); reload(); }
        catch (e) { showAlert('No se pudo quitar', e instanceof Error ? e.message : String(e)); }
      } },
    ]);
  };

  const header = staff.length > 0 ? (
    <Text style={{ color: t.muted, fontSize: 13, marginBottom: space.md }}>
      {staff.length} {staff.length === 1 ? 'persona' : 'personas'} · {owners} {owners === 1 ? 'propietario' : 'propietarios'}
    </Text>
  ) : null;

  const security = (
    <View style={[s.security, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={s.securityHead}>
        <Ionicons name="lock-closed-outline" size={18} color={t.accent} />
        <Text style={{ color: t.fg, fontWeight: '800', marginLeft: space.sm, flex: 1 }}>Bloqueo automático</Text>
      </View>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 6 }}>
        Pide el PIN al volver a la app después de estar en otra aplicación durante:
      </Text>
      <View style={s.chips}>
        {AUTO_LOCK_OPTIONS.map((option) => {
          const on = option.minutes === autoLockMinutes;
          return (
            <Pressable
              key={option.minutes}
              onPress={() => { void setAutoLockMinutes(option.minutes); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[s.chip, { backgroundColor: on ? t.accent : t.surfaceAlt, borderColor: on ? t.accent : t.line }]}
            >
              <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700', fontSize: 13 }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: space.md }}>
        Tras {FREE_ATTEMPTS} PIN incorrectos, esa cuenta se bloquea 30 segundos, y más tiempo si se repite.
      </Text>
    </View>
  );

  return (
    <Screen
      title="Personal y roles"
      scroll={false}
      right={<IconButton icon="person-add-outline" label="Agregar personal" filled onPress={() => router.push('/add-staff')} />}
    >
      <FlatList
        {...listProps}
        data={staff}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={header}
        ListFooterComponent={staff.length > 0 ? security : null}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Aún no hay personal" hint="Agrega cuentas para que cada persona entre con su propio PIN." />}
        renderItem={({ item }) => {
          const chip = roleChip(t, item.role);
          const mine = me?.id === item.id;
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/add-staff', params: { id: item.id, name: item.name, role: item.role } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${ROLE_LABEL[item.role]}${mine ? ', tú' : ''}. Editar`}
              style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}
            >
              <View style={[circle(46), s.avatar, { backgroundColor: tileColor(item.id) }]}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{initials(item.name)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={{ color: t.fg, fontWeight: '700' }} numberOfLines={1}>
                  {item.name}{mine ? <Text style={{ color: t.accent }}>  · tú</Text> : null}
                </Text>
                <View style={s.chipRow}>
                  <View style={[s.roleChip, { backgroundColor: chip.background }]}>
                    <Text style={{ color: chip.color, fontSize: 11.5, fontWeight: '800' }}>{ROLE_LABEL[item.role]}</Text>
                  </View>
                  {isLastOwner(item) ? <Text style={{ color: t.muted, fontSize: 11.5 }}>Único propietario</Text> : null}
                </View>
              </View>
              {canRemove(item) ? (
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar a ${item.name}`}
                  style={s.remove}
                >
                  <Ionicons name="trash-outline" size={20} color={t.dangerText} />
                </Pressable>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={t.faint} style={{ marginHorizontal: space.sm }} />
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  avatar: { borderRadius: 15 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4, flexWrap: 'wrap' },
  roleChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  security: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
  securityHead: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, minHeight: 40, justifyContent: 'center' },
});
