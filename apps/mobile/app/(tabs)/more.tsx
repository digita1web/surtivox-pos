import { View, Text, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSession, useRole } from '../../src/session';
import { can, ROLE_LABEL } from '../../src/roles';
import { useCloudEntitlement } from '../../src/subscription';
import { useTheme, initials, space, radius, type Theme } from '../../src/theme';
import { TabHeader, scrollProps, useTabListInset } from '../../src/pos/Screen';

export default function More() {
  const t = useTheme();
  const listInset = useTabListInset();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const stores = useSession((s) => s.stores);
  const me = useSession((s) => s.staff);
  const signOut = useSession((s) => s.signOut);
  const role = useRole();
  const cloud = useCloudEntitlement();
  useFocusEffect(useCallback(() => { cloud.refresh(); }, [cloud.refresh]));

  // Management links gated by the current role. Selling and sales history are
  // available to everyone; the rest need a capability.
  const allItems: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string; show: boolean }[] = [
    { icon: 'storefront-outline', label: 'Perfil y recibos', route: '/store-settings', show: can(role, 'shop') },
    { icon: 'bar-chart-outline', label: 'Reportes', route: '/reports', show: can(role, 'reports') },
    { icon: 'sparkles-outline', label: 'Sugerencia de pedido', route: '/reorder', show: can(role, 'reports') },
    { icon: 'people-outline', label: 'Clientes y fiados', route: '/customers', show: can(role, 'customers') },
    { icon: 'business-outline', label: 'Proveedores', route: '/suppliers', show: can(role, 'suppliers') },
    { icon: 'cart-outline', label: 'Compras / reabastecer', route: '/purchases', show: can(role, 'purchases') },
    { icon: 'cube-outline', label: 'Todos los productos', route: '/products', show: can(role, 'products') },
    { icon: 'receipt-outline', label: 'Historial de ventas', route: '/sales', show: true },
    { icon: 'people-circle-outline', label: 'Personal y roles', route: '/staff', show: can(role, 'staff') },
    { icon: 'swap-vertical-outline', label: 'Respaldo y CSV', route: '/data', show: can(role, 'backup') },
  ];
  const manage = allItems.filter((m) => m.show);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
    <TabHeader title="Más" />
    <ScrollView {...scrollProps} style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, paddingBottom: listInset }}>
      <Pressable onPress={() => router.push('/shops')} style={[s.storeCard, { backgroundColor: t.panel, borderColor: t.line }]}>
        {store.logo_uri ? (
          <Image source={{ uri: store.logo_uri }} style={[s.avatar, { backgroundColor: '#fff', borderWidth: 1, borderColor: t.line }]} resizeMode="contain" />
        ) : (
          <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 18 }}>{initials(store.name)}</Text></View>
        )}
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17 }} numberOfLines={1}>{store.name}</Text>
          {store.tagline ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{store.tagline}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <Ionicons name="cloud-offline-outline" size={13} color={t.muted} />
            <Text style={{ color: t.muted, fontSize: 13 }}>{store.currency_code} · {stores.length > 1 ? `${stores.length} tienda${stores.length === 1 ? '' : 's'}` : 'funciona sin conexión'}</Text>
          </View>
        </View>
        <Ionicons name="swap-horizontal-outline" size={20} color={t.muted} />
      </Pressable>

      {me && (
        <View style={[s.userCard, { backgroundColor: t.panel, borderColor: t.line }]}>
          <View style={[s.avatar, { backgroundColor: t.accentSoft, width: 40, height: 40, borderRadius: 13 }]}>
            <Ionicons name="person" size={20} color={t.accent} />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: t.fg, fontWeight: '700' }}>{me.name}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Sesión iniciada · {ROLE_LABEL[me.role]}</Text>
          </View>
          <Pressable onPress={signOut} hitSlop={8} style={[s.lockBtn, { borderColor: t.line }]}>
            <Ionicons name="lock-closed-outline" size={15} color={t.fg} />
            <Text style={{ color: t.fg, fontWeight: '700', fontSize: 13, marginLeft: 5 }}>Bloquear</Text>
          </Pressable>
        </View>
      )}

      {can(role, 'sync') && (
        <>
          <Text style={[s.section, { color: t.muted }]}>SUSCRIPCIÓN</Text>
          <Pressable
            onPress={() => router.push(cloud.active ? '/cloud-sync' : '/paywall')}
            style={[s.planCard, { backgroundColor: cloud.active ? t.panel : t.accentSoft, borderColor: cloud.active ? t.line : t.accent }]}
          >
            <View style={[s.planIcon, { backgroundColor: t.accent }]}>
              <Ionicons name={cloud.active ? 'cloud-done-outline' : 'cloud-upload-outline'} size={22} color={t.accentFg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontWeight: '800', fontSize: 15 }}>
                {cloud.active ? 'Respaldo en la nube · Activo' : 'Respaldo en la nube · Opcional'}
              </Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 1 }}>
                {cloud.active ? 'Tu negocio está respaldado y sincronizado' : 'Respalda y sincroniza tu negocio entre dispositivos'}
              </Text>
            </View>
            {cloud.active
              ? <Ionicons name="chevron-forward" size={18} color={t.faint} />
              : <View style={[s.planCta, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 13 }}>Activar</Text></View>}
          </Pressable>
        </>
      )}

      <Text style={[s.section, { color: t.muted }]}>GESTIÓN</Text>
      <Group t={t}>
        {manage.map((m, i) => (
          <Item key={m.route} t={t} icon={m.icon} label={m.label} onPress={() => router.push(m.route as never)} last={i === manage.length - 1} />
        ))}
      </Group>

      <View style={[s.tip, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="print-outline" size={16} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: 8, flex: 1, fontSize: 12 }}>
          Imprime o comparte una factura PDF desde cualquier recibo o venta. La impresión usa el servicio de impresión de tu teléfono; funcionan impresoras Bluetooth, Wi-Fi y USB.
        </Text>
      </View>

      <Text style={{ color: t.faint, textAlign: 'center', marginTop: 20, fontSize: 12 }}>Surtivox POS · v1.0 · sin conexión</Text>
    </ScrollView>
    </View>
  );
}

function Group({ children, t }: { children: React.ReactNode; t: Theme }) {
  return <View style={[s.group, { backgroundColor: t.panel, borderColor: t.line }]}>{children}</View>;
}

function Item({ t, icon, label, onPress, muted, last }: { t: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; muted?: boolean; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.item, !last && { borderBottomWidth: 1, borderColor: t.line }]}>
      <View style={[s.itemIcon, { backgroundColor: muted ? t.surfaceAlt : t.accentSoft }]}>
        <Ionicons name={icon} size={18} color={muted ? t.muted : t.accent} />
      </View>
      <Text style={{ color: muted ? t.muted : t.fg, fontWeight: '600', flex: 1 }}>{label}</Text>
      {muted ? <Text style={{ color: t.faint, fontSize: 11, fontWeight: '700' }}>PRONTO</Text> : <Ionicons name="chevron-forward" size={18} color={t.faint} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  storeCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 10 },
  lockBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  avatar: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  planIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planCta: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginTop: 24 },
});
