import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { asMinor } from '@surtivox/pos-core';
import {
  todayStats, recentlySold, listProducts, lowStockProducts, getLocalSetting, setLocalSetting, salesBackupCounts, hasRecovery,
  type TodayStats, type Product, type LowStockItem,
} from '../../src/repos';
import { useSession, useRole } from '../../src/session';
import { can } from '../../src/roles';
import { useCheckoutUI } from '../../src/checkoutUI';
import { useCart } from '../../src/cart';
import { useCloudEntitlement } from '../../src/subscription';
import { HomeHeader } from '../../src/pos/HomeHeader';
import { ActionCard } from '../../src/pos/ActionCard';
import { FrequentProductCard } from '../../src/pos/FrequentProductCard';
import { PromoCard } from '../../src/pos/PromoCard';
import { SectionHeader } from '../../src/pos/SectionHeader';
import { homeMetrics } from '../../src/pos/homeLayout';
import { statusBarToneFor } from '../../src/themeMode';
import { useAppearance } from '../../src/appearance';
import { scrollProps, useTabListInset } from '../../src/pos/Screen';
import { useMoney } from '../../src/pos/ui';
import { TourGuide } from '../../src/components/TourGuide';
import { hasSeenFirstRunGuide } from '../../src/localFlags';
import { useTheme, space, radius, circle } from '../../src/theme';
import { greetingForDate } from '../../src/greeting';
import { exportFullBackup } from '../../src/backup';
import { backupReminderText, backupSnoozeUntil, shouldRemindBackup } from '../../src/backupReminder';
import { showAlert } from '../../src/pos/alert';
import { kitReminderNow, snoozeKitReminder } from '../../src/sync';

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const listInset = useTabListInset();
  const { width, fontScale } = useWindowDimensions();
  const scheme = useAppearance((state) => state.resolved);
  const m = homeMetrics(width, fontScale);
  const store = useSession((s) => s.store)!;
  const cart = useCart();
  const money = useMoney();
  const openQuick = useCheckoutUI((s) => s.openQuick);
  const salesVersion = useCheckoutUI((s) => s.salesVersion);
  const role = useRole();
  const canProducts = can(role, 'products');
  const cloud = useCloudEntitlement();
  const [stats, setStats] = useState<TodayStats>({ totalSales: 0, orders: 0, itemsSold: 0 });
  const [strip, setStrip] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<LowStockItem[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [greeting, setGreeting] = useState(() => greetingForDate(new Date()));
  const [backupNudge, setBackupNudge] = useState<{ lastBackupAt: number | null } | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [recoveryMissing, setRecoveryMissing] = useState(false);
  const [kitNudge, setKitNudge] = useState<{ title: string; body: string } | null>(null);
  const me = useSession((state) => state.staff);
  const staffTotal = useSession((state) => state.staffCount);

  useEffect(() => {
    hasSeenFirstRunGuide().then((seen) => { if (!seen) setGuideOpen(true); });
  }, []);

  useFocusEffect(useCallback(() => {
    const updateGreeting = () => setGreeting(greetingForDate(new Date()));
    updateGreeting();
    const timer = setInterval(updateGreeting, 60_000);
    return () => clearInterval(timer);
  }, []));

  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle(statusBarToneFor(useAppearance.getState().resolved));
  }, []));

  const refreshBackupNudge = useCallback(async () => {
    try {
      const [lastRaw, snoozeRaw] = await Promise.all([
        getLocalSetting('last_backup_at'),
        getLocalSetting('backup_snooze_until'),
      ]);
      const lastParsed = lastRaw === null ? null : Number(lastRaw);
      const lastBackupAt = lastParsed !== null && Number.isFinite(lastParsed) ? lastParsed : null;
      const snoozeParsed = snoozeRaw === null ? null : Number(snoozeRaw);
      const snoozedUntil = snoozeParsed !== null && Number.isFinite(snoozeParsed) ? snoozeParsed : null;
      const counts = await salesBackupCounts(lastBackupAt);
      const remind = shouldRemindBackup({
        now: Date.now(),
        lastBackupAt,
        salesSinceBackup: counts.salesSinceBackup,
        totalSales: counts.totalSales,
        snoozedUntil,
      });
      setBackupNudge(remind ? { lastBackupAt } : null);
    } catch {
      setBackupNudge(null);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    todayStats(store.id).then(setStats);
    recentlySold(store.id).then(async (r) => {
      setStrip(r.length ? r : (await listProducts(store.id)).slice(0, 8));
    });
    lowStockProducts(store.id, 50).then(setAlerts);
    if (me?.role === 'owner' && staffTotal > 0) hasRecovery(store.id).then((ok) => setRecoveryMissing(!ok)).catch(() => setRecoveryMissing(false));
    else setRecoveryMissing(false);
    cloud.refresh();
    void refreshBackupNudge();
    kitReminderNow().then(setKitNudge).catch(() => setKitNudge(null));
  }, [store.id, salesVersion, cloud.refresh, refreshBackupNudge, me?.role, staffTotal]));

  const saveBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await exportFullBackup(store);
      setBackupNudge(null);
    } catch (e) {
      showAlert('No se pudo generar la copia', e instanceof Error ? e.message : String(e));
    } finally {
      setBackupBusy(false);
    }
  };

  const snoozeBackup = () => {
    setBackupNudge(null);
    void setLocalSetting('backup_snooze_until', String(backupSnoozeUntil(Date.now()))).catch(() => {});
  };

  const outCount = alerts.filter((a) => a.stock <= 0).length;
  const lowCount = alerts.length - outCount;

  const productCard = (p: Product) => (
    <FrequentProductCard
      key={p.id}
      name={p.name}
      category={p.category_name}
      imageUri={p.image_uri}
      price={money(asMinor(p.selling_price))}
      qty={cart.items[p.id]?.quantity ?? 0}
      width={m.cardW}
      photoHeight={m.photoH}
      plusSize={m.plusSize}
      onAdd={() => cart.add(p)}
    />
  );

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <HomeHeader
        name={store.name}
        tagline={store.tagline}
        logoUri={store.logo_uri}
        dark={scheme === 'dark'}
        onToggleTheme={() => { void useAppearance.getState().toggle(); }}
        onSearch={() => router.push('/products')}
        onScan={() => router.push('/scan')}
      />
      <ScrollView {...scrollProps} style={s.flex} contentContainerStyle={{ paddingHorizontal: m.pad, paddingTop: space.xs, paddingBottom: listInset }}>
        <View style={[s.actions, { gap: m.gap }, m.actionsStacked && s.actionsStacked]}>
          <ActionCard icon="cart" title="Venta rápida" hint="Vende sin complicaciones" tone="green" iconSize={m.actionIcon} chevronSize={m.actionChevron} vertical={m.actionVertical} onPress={openQuick} />
          {canProducts
            ? <ActionCard icon="add" title="Agregar producto" hint="Nuevo artículo del catálogo" tone="orange" iconSize={m.actionIcon} chevronSize={m.actionChevron} vertical={m.actionVertical} onPress={() => router.push('/add-product')} />
            : <ActionCard icon="barcode-outline" title="Escanear y vender" hint="Escanea un código de barras" tone="orange" iconSize={m.actionIcon} chevronSize={m.actionChevron} vertical={m.actionVertical} onPress={() => router.push('/scan')} />}
        </View>

        <View style={s.sectionGap}>
          <SectionHeader title="Productos frecuentes" actionLabel="Ver todo" onAction={() => router.push('/products')} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[s.stripScroll, { marginHorizontal: -m.pad }]}
          contentContainerStyle={[s.strip, { gap: m.gap, paddingHorizontal: m.pad }]}
        >
          {strip.length === 0 ? (
            <Pressable
              onPress={() => router.push('/add-product')}
              accessibilityRole="button"
              style={[s.empty, { width: m.cardW, height: m.cardH, borderColor: t.line, backgroundColor: t.panel }]}
            >
              <Ionicons name="add-circle-outline" size={26} color={t.muted} />
              <Text style={{ color: t.muted, marginTop: 6, textAlign: 'center' }}>Agrega tu primer producto</Text>
            </Pressable>
          ) : productCard(strip[0]!)}
          <PromoCard key="promo" width={m.promoW} height={m.promoH} />
          {strip.slice(1).map(productCard)}
        </ScrollView>

        <Pressable onPress={() => router.push('/sales')} style={[s.today, { backgroundColor: t.accent, boxShadow: t.shadowStrong }]} accessibilityLabel="Ventas de hoy">
          <View style={s.todayHead}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.accentFg, fontWeight: '600', fontSize: 13, opacity: 0.9 }} numberOfLines={1}>{greeting}</Text>
              <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 15, marginTop: 1 }}>Ventas de hoy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.accentFg} />
          </View>
          <Text style={{ color: t.accentFg, fontSize: 34, lineHeight: 42, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
            {money(asMinor(stats.totalSales))}
          </Text>
          <View style={s.todayStats}>
            <View style={s.todayStat}><Ionicons name="receipt-outline" size={16} color={t.accentFg} /><Text style={[s.todayStatTxt, { color: t.accentFg }]}>{stats.orders} {stats.orders === 1 ? 'pedido' : 'pedidos'}</Text></View>
            <View style={s.todayStat}><Ionicons name="cube-outline" size={16} color={t.accentFg} /><Text style={[s.todayStatTxt, { color: t.accentFg }]}>{stats.itemsSold} artículos vendidos</Text></View>
          </View>
        </Pressable>

        {backupNudge ? (
          <View style={[s.backupNudge, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={s.backupTitle}>
              <Ionicons name="cloud-upload-outline" size={18} color={t.accent} />
              <Text style={{ color: t.fg, fontWeight: '700', flex: 1, marginLeft: space.sm }} numberOfLines={1}>
                {backupReminderText(backupNudge.lastBackupAt, Date.now())}
              </Text>
            </View>
            <View style={s.backupActions}>
              <Pressable onPress={() => { void saveBackup(); }} disabled={backupBusy} style={[s.backupAction, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 12 }}>{backupBusy ? 'Generando…' : 'Guardar copia'}</Text>
              </Pressable>
              <Pressable onPress={snoozeBackup} disabled={backupBusy} style={s.backupSnooze}>
                <Text style={{ color: t.muted, fontWeight: '700', fontSize: 12 }}>Ahora no</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {recoveryMissing ? (
          <Pressable onPress={() => router.push('/staff')} accessibilityRole="button" style={[s.backupNudge, { backgroundColor: t.panel, borderColor: t.warn }]}>
            <View style={s.backupTitle}>
              <Ionicons name="key-outline" size={18} color={t.warnText} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text style={{ color: t.fg, fontWeight: '700' }}>Genera tu código de recuperación</Text>
                <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>Sin él, si olvidas tu PIN no podrás entrar.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.faint} />
            </View>
          </Pressable>
        ) : null}

        {kitNudge && can(role, 'sync') ? (
          <Pressable onPress={() => router.push('/cloud-sync')} accessibilityRole="button" style={[s.backupNudge, { backgroundColor: t.panel, borderColor: t.warn }]}>
            <View style={s.backupTitle}>
              <Ionicons name="key-outline" size={18} color={t.warnText} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text style={{ color: t.fg, fontWeight: '700' }}>{kitNudge.title}</Text>
                <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{kitNudge.body}</Text>
              </View>
              <Pressable onPress={() => { setKitNudge(null); void snoozeKitReminder().catch(() => {}); }} hitSlop={10} accessibilityLabel="Recordarme después">
                <Ionicons name="close" size={18} color={t.faint} />
              </Pressable>
            </View>
          </Pressable>
        ) : null}

        {alerts.length > 0 && canProducts && (
          <Pressable onPress={() => router.push(outCount > 0 ? '/products?filter=out' : '/products?filter=low')} style={[s.alert, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.alertIcon, { backgroundColor: outCount ? `${t.danger}22` : `${t.warn}26` }]}>
              <Ionicons name="alert-circle-outline" size={20} color={outCount ? t.dangerText : t.warnText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>Requiere atención</Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 1 }}>
                {[outCount ? `${outCount} sin stock` : null, lowCount ? `${lowCount} con stock bajo` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.faint} />
          </Pressable>
        )}

        {!cloud.loading && !cloud.active && can(role, 'sync') && (
          <Pressable onPress={() => router.push('/cloud-sync')} style={[s.upgrade, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
            <View style={[s.upgradeIcon, { backgroundColor: t.accent }]}>
              <Ionicons name="cloud-upload-outline" size={22} color={t.accentFg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontWeight: '800', fontSize: 15 }}>Respaldo en la nube · Opcional</Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 1 }}>Respalda y sincroniza tu negocio entre dispositivos</Text>
            </View>
            <View style={[s.upgradeCta, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 13 }}>Activar</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>
      <TourGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'stretch' },
  actionsStacked: { flexDirection: 'column' },
  sectionGap: { marginTop: space.xl, marginBottom: space.md },
  stripScroll: { flexGrow: 0 },
  strip: { alignItems: 'flex-start', paddingVertical: 6 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.xl, padding: space.lg, alignItems: 'center', justifyContent: 'center' },
  today: { borderRadius: radius.xl, padding: space.xl, marginTop: space.xl },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayStats: { flexDirection: 'row', gap: space.xl, marginTop: space.md },
  todayStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayStatTxt: { fontWeight: '600', opacity: 0.95 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  alertIcon: { ...circle(40), borderRadius: radius.md - 2 },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  backupNudge: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  backupTitle: { flexDirection: 'row', alignItems: 'center' },
  backupActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  backupAction: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  backupSnooze: { paddingHorizontal: 8, paddingVertical: 8 },
  upgradeIcon: { ...circle(40), borderRadius: radius.md - 2 },
  upgradeCta: { borderRadius: radius.md - 2, paddingHorizontal: 14, paddingVertical: 8 },
});
