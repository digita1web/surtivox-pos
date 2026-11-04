import { View, Text, Pressable, ScrollView, Image, Switch, Linking, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSession, useRole } from '../../src/session';
import { can, ROLE_LABEL } from '../../src/roles';
import { useCloudEntitlement } from '../../src/subscription';
import { useTheme, initials, space, type Theme } from '../../src/theme';
import { TabHeader, scrollProps, useTabListInset } from '../../src/pos/Screen';
import { showAlert } from '../../src/pos/alert';
import { getLocalSetting, resetAllData, seedColombianCatalog, setLocalSetting, updateAllStoreCurrencies } from '../../src/repos';
import { clearCatalogQueue } from '../../src/catalog';
import { CURRENCY_CYCLE } from '../../src/branding';
import { resetAppCurrency, setAppCurrency, useAppCurrency } from '../../src/appCurrency';
import { SEED_PRODUCTS } from '../../src/seedCatalog';
import { resetFirstRunGuide } from '../../src/localFlags';
import { getReminderCount, resetReminderCount } from '../../src/fiadoReminderStorage';

export default function More() {
  const t = useTheme();
  const listInset = useTabListInset();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const stores = useSession((s) => s.stores);
  const me = useSession((s) => s.staff);
  const signOut = useSession((s) => s.signOut);
  const reload = useSession((s) => s.load);
  const role = useRole();
  const cloud = useCloudEntitlement();
  const [reminderCount, setReminderCount] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [catalogOptIn, setCatalogOptIn] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const versionTaps = useRef(0);
  const versionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appCode = useAppCurrency((s) => s.code);
  useFocusEffect(useCallback(() => {
    cloud.refresh();
    getReminderCount().then(setReminderCount);
    getLocalSetting('catalog_opt_in').then((value) => setCatalogOptIn(value === '1')).catch(() => {});
    getLocalSetting('developer_mode').then((value) => setDeveloperMode(value === '1')).catch(() => {});
  }, [cloud.refresh]));

  const runReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await resetAllData();
      await resetFirstRunGuide();
      await resetReminderCount();
      await resetAppCurrency();
      signOut();
      await reload();
    } catch (e) {
      setResetting(false);
      showAlert('No se pudo borrar todo', e instanceof Error ? e.message : String(e));
    }
  };

  const confirmReset = () => {
    showAlert('Borrar todos los datos', 'Esto borrará TODO: productos, ventas, clientes y fiados. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' as const },
      {
        text: 'Continuar',
        style: 'destructive' as const,
        onPress: () => {
          showAlert('¿Estás totalmente seguro?', 'Esta acción no se puede deshacer. La app volverá al inicio.', [
            { text: 'Cancelar', style: 'cancel' as const },
            { text: 'Sí, borrar todo', style: 'destructive' as const, onPress: () => { void runReset(); } },
          ]);
        },
      },
    ]);
  };

  const runSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const result = await seedColombianCatalog(store.id);
      showAlert('Catálogo cargado', `${result.inserted} productos agregados. ${result.skipped} ya existían.`);
    } catch (e) {
      showAlert('No se pudo cargar el catálogo', e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  };

  const confirmSeed = () => {
    showAlert('Cargar catálogo de ejemplo', `Se agregarán ${SEED_PRODUCTS.length} productos típicos de tienda de barrio. Los productos existentes no se duplican. ¿Continuar?`, [
      { text: 'Cancelar', style: 'cancel' as const },
      { text: 'Cargar catálogo', onPress: () => { void runSeed(); } },
    ]);
  };

  const tapVersion = () => {
    if (developerMode) return;
    versionTaps.current += 1;
    if (versionTimer.current) clearTimeout(versionTimer.current);
    versionTimer.current = setTimeout(() => { versionTaps.current = 0; }, 1500);
    if (versionTaps.current < 7) return;
    versionTaps.current = 0;
    setDeveloperMode(true);
    void setLocalSetting('developer_mode', '1').catch(() => {});
    showAlert('Modo desarrollador activado', 'La configuración técnica está disponible en Respaldo en la nube.');
  };

  const currencyIndex = CURRENCY_CYCLE.findIndex((code) => code === appCode);
  const nextCurrency = CURRENCY_CYCLE[(currencyIndex + 1) % CURRENCY_CYCLE.length] ?? 'COP';

  const switchCurrency = async () => {
    if (currencyBusy) return;
    setCurrencyBusy(true);
    try {
      await setAppCurrency(nextCurrency);
      await updateAllStoreCurrencies(nextCurrency);
      await reload();
    } catch (e) {
      showAlert('No se pudo cambiar la moneda', e instanceof Error ? e.message : String(e));
    } finally {
      setCurrencyBusy(false);
    }
  };

  // Management links gated by the current role. Selling and sales history are
  // available to everyone; the rest need a capability.
  const allItems: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string; show: boolean }[] = [
    { icon: 'id-card-outline', label: 'Datos del negocio', route: '/business-settings', show: can(role, 'shop') },
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
    { icon: 'shield-checkmark-outline', label: 'Términos y privacidad', route: '/legal', show: true },
    { icon: 'document-text-outline', label: 'Licencias y atribuciones', route: '/licenses', show: true },
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
            <Text style={{ color: t.muted, fontSize: 13 }}>{appCode} · {stores.length > 1 ? `${stores.length} tienda${stores.length === 1 ? '' : 's'}` : 'funciona sin conexión'}</Text>
          </View>
        </View>
        <Ionicons name="swap-horizontal-outline" size={20} color={t.muted} />
      </Pressable>

      {can(role, 'shop') && (
        <Pressable onPress={switchCurrency} disabled={currencyBusy}
          style={[s.currencyBtn, { backgroundColor: t.panel, borderColor: t.line, opacity: currencyBusy ? 0.6 : 1 }]}>
          <View style={[s.itemIcon, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="cash-outline" size={18} color={t.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: t.fg, fontWeight: '800' }}>
              {currencyBusy ? 'Cambiando moneda…' : `Moneda: ${appCode}`}
            </Text>
            <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
              Toca para cambiar a {nextCurrency}. No convierte precios.
            </Text>
          </View>
          <Ionicons name="swap-horizontal-outline" size={18} color={t.faint} />
        </Pressable>
      )}

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
            onPress={() => router.push('/cloud-sync')}
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

      <Text style={[s.section, { color: t.muted }]}>PRIVACIDAD</Text>
      <View style={[s.catalogCard, { backgroundColor: t.panel, borderColor: t.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.fg, fontWeight: '800' }}>Ayudar a mejorar el catálogo</Text>
          <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
            Sin tu nombre ni datos de tu tienda.
          </Text>
          <Pressable onPress={() => { void Linking.openURL('https://digita1web.github.io/surtivox-pos/privacidad.html').catch(() => {}); }} hitSlop={8} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>Política de privacidad</Text>
          </Pressable>
        </View>
        <Switch
          value={catalogOptIn}
          onValueChange={(next) => {
            setCatalogOptIn(next);
            void setLocalSetting('catalog_opt_in', next ? '1' : '0').catch(() => {});
            if (!next) void clearCatalogQueue().catch(() => {});
          }}
          trackColor={{ false: t.line, true: t.accentSoft }}
          thumbColor={catalogOptIn ? t.accent : t.muted}
          accessibilityLabel="Ayudar a mejorar el catálogo"
        />
      </View>

      <View style={{ marginTop: space.sm }}>
        <Group t={t}>
          <Item t={t} icon="pulse-outline" label="Diagnóstico" onPress={() => router.push('/diagnostics')} last />
        </Group>
      </View>

      <Text style={[s.section, { color: t.muted }]}>GESTIÓN</Text>
      <Group t={t}>
        {manage.map((m, i) => (
          <Item key={m.route} t={t} icon={m.icon} label={m.label} onPress={() => router.push(m.route as never)} last={i === manage.length - 1} />
        ))}
      </Group>

      {can(role, 'products') && (
        <>
          <Text style={[s.section, { color: t.muted }]}>CATÁLOGO DE EJEMPLO</Text>
          <Pressable onPress={confirmSeed} disabled={seeding}
            style={[s.seedBtn, { backgroundColor: t.panel, borderColor: t.line, opacity: seeding ? 0.6 : 1 }]}>
            <View style={[s.seedIcon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="albums-outline" size={20} color={t.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: t.fg, fontWeight: '800' }}>
                {seeding ? 'Cargando catálogo…' : 'Cargar catálogo de ejemplo'}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
                {SEED_PRODUCTS.length} productos típicos de tienda de barrio.
              </Text>
            </View>
            {!seeding && <Ionicons name="chevron-forward" size={18} color={t.faint} />}
          </Pressable>
        </>
      )}

      {can(role, 'shop') && (
        <>
          <Text style={[s.section, { color: t.dangerText }]}>Zona de peligro</Text>
          <Pressable onPress={confirmReset} disabled={resetting}
            style={[s.dangerBtn, { borderColor: t.danger, backgroundColor: t.panel, opacity: resetting ? 0.6 : 1 }]}>
            <Ionicons name="trash-outline" size={20} color={t.danger} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: t.dangerText, fontWeight: '800' }}>
                {resetting ? 'Borrando…' : 'Borrar todos los datos de la app'}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
                Productos, ventas, clientes y fiados.
              </Text>
            </View>
          </Pressable>
        </>
      )}

      <View style={[s.tip, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="logo-whatsapp" size={16} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: 8, flex: 1, fontSize: 12 }}>
          Recordatorios enviados: {reminderCount}
        </Text>
      </View>

      <View style={[s.tip, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="print-outline" size={16} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: 8, flex: 1, fontSize: 12 }}>
          Imprime o comparte una factura PDF desde cualquier recibo o venta. La impresión usa el servicio de impresión de tu teléfono; funcionan impresoras Bluetooth, Wi-Fi y USB.
        </Text>
      </View>

      <Pressable onPress={tapVersion} hitSlop={8} accessibilityLabel="Versión de Surtivox POS">
        <Text style={{ color: t.faint, textAlign: 'center', marginTop: 20, fontSize: 12 }}>Surtivox POS · v1.0 · sin conexión</Text>
      </Pressable>
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
  currencyBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 10 },
  catalogCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  seedBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 14 },
  seedIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginTop: 24 },
});
