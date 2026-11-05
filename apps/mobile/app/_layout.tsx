import { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabaseHealth, getDb, initDatabase } from '../src/db';
import { useSession, useLocked, useRole } from '../src/session';
import { can, ROLE_LABEL } from '../src/roles';
import { capabilityForPath } from '../src/routeAccess';
import { shouldAutoLock } from '../src/staffRules';
import { loadAppCurrency } from '../src/appCurrency';
import { Onboarding } from '../src/pos/Onboarding';
import { StaffLock } from '../src/pos/StaffLock';
import { AlertHost } from '../src/pos/alert';
import { LaunchIntro } from '../src/pos/LaunchIntro';
import { checkForUpdatesInBackground } from '../src/updates';
import { flushOutbox, CATALOG_URL } from '../src/catalog';
import { isCatalogEnabled } from '../src/catalogCore';
import { loadGateSteps, type GateStep } from '../src/legal';
import { LegalGate } from '../src/pos/LegalGate';
import { exportFullBackup } from '../src/backup';
import { installGlobalErrorHandler } from '../src/crashHandler';
import { truncateErrorMessage } from '../src/diagnostics';
import { showAlert } from '../src/pos/alert';
import { useTheme } from '../src/theme';
import { statusBarToneFor } from '../src/themeMode';
import { useAppearance, useAppearanceSync } from '../src/appearance';
import { light } from '../src/themeColors';

SplashScreen.preventAutoHideAsync().catch(() => {});
installGlobalErrorHandler();

function RouteGuard() {
  const pathname = usePathname();
  const role = useRole();
  const router = useRouter();
  useEffect(() => {
    const capability = capabilityForPath(pathname);
    if (capability && !can(role, capability)) {
      router.replace('/');
      showAlert('Sin permiso', `Tu rol (${ROLE_LABEL[role]}) no permite abrir esta sección.`);
    }
  }, [pathname, role]);
  return null;
}

function AutoLock() {
  const minutes = useSession((s) => s.autoLockMinutes);
  const away = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') { away.current = Date.now(); return; }
      if (state !== 'active') return;
      if (shouldAutoLock({ backgroundedAt: away.current, now: Date.now(), minutes })) useSession.getState().signOut();
      away.current = null;
    });
    return () => subscription.remove();
  }, [minutes]);
  return null;
}

export default function RootLayout() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [gate, setGate] = useState<GateStep[]>([]);
  const loadSession = useSession((s) => s.load);
  const resolvedScheme = useAppearance((s) => s.resolved);
  useAppearanceSync();
  const store = useSession((s) => s.store);
  const locked = useLocked();

  useEffect(() => {
    initDatabase()
      .then(() => {
        const health = getDatabaseHealth();
        if (health.status === 'corrupt') setIntegrityWarning(health.message ?? 'quick_check no devolvió un resultado válido.');
        return loadSession();
      })
      .then(async () => {
        await loadAppCurrency(useSession.getState().store?.currency_code ?? 'COP');
        await useAppearance.getState().load();
      })
      .then(async () => {
        setGate(await loadGateSteps(getDb(), isCatalogEnabled(CATALOG_URL)).catch((): GateStep[] => ['terms']));
      })
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [bootAttempt]);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    void checkForUpdatesInBackground().catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    void flushOutbox();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOutbox();
    });
    return () => subscription.remove();
  }, [ready]);

  return (
    <SafeAreaProvider>
      <StatusBar style={statusBarToneFor(resolvedScheme)} />
      {showIntro ? (
        <LaunchIntro isReady={ready || error !== null} onFinish={() => setShowIntro(false)} />
      ) : error ? (
        <View style={[styles.center, { backgroundColor: t.bg, padding: 24 }]}>
          <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>No se pudo abrir la base de datos</Text>
          <Text style={{ color: t.muted, marginTop: 10, textAlign: 'center' }}>No se borró nada automáticamente.</Text>
          <Pressable
            onPress={() => { setError(null); setReady(false); setIntegrityWarning(null); setBootAttempt((value) => value + 1); }}
            style={[styles.retry, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentFg, fontWeight: '800' }}>Reintentar</Text>
          </Pressable>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 18, textAlign: 'center' }} numberOfLines={4}>{error}</Text>
        </View>
      ) : integrityWarning ? (
        <View style={[styles.center, { backgroundColor: t.bg, padding: 24 }]}>
          <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>La base de datos puede estar dañada</Text>
          <Text style={{ color: t.muted, marginTop: 10, textAlign: 'center' }}>No se borró nada automáticamente. Guarda una copia antes de continuar.</Text>
          {store ? (
            <Pressable
              onPress={() => { void exportFullBackup(store).catch((e) => showAlert('No se pudo guardar la copia', e instanceof Error ? e.message : String(e))); }}
              style={[styles.retry, { backgroundColor: t.accent }]}
            >
              <Text style={{ color: t.accentFg, fontWeight: '800' }}>Guardar copia de mis datos</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setIntegrityWarning(null)} style={{ marginTop: 14, padding: 10 }}>
            <Text style={{ color: t.muted, fontWeight: '700' }}>Continuar de todos modos</Text>
          </Pressable>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 14, textAlign: 'center' }} numberOfLines={3}>{integrityWarning}</Text>
        </View>
      ) : !ready ? (
        <View style={[styles.center, { backgroundColor: t.bg }]}>
          <ActivityIndicator color={t.accent} size="large" />
          <Text style={{ color: t.muted, marginTop: 12 }}>Abriendo tienda…</Text>
        </View>
      ) : gate.length > 0 ? (
        <LegalGate steps={gate} onDone={() => setGate([])} />
      ) : !store ? (
        <Onboarding onCreated={loadSession} />
      ) : locked ? (
        <StaffLock />
      ) : (
        <>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
          <RouteGuard />
          <AutoLock />
        </>
      )}
      <AlertHost />
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  let store: ReturnType<typeof useSession.getState>['store'] = null;
  let databaseReady = false;
  try {
    getDb();
    databaseReady = true;
    store = useSession.getState().store;
  } catch {}
  return (
    <View style={errorStyles.root}>
      <Text style={errorStyles.title}>Algo salió mal</Text>
      <Text style={errorStyles.help}>Puedes reintentar o guardar una copia de tus datos antes de continuar.</Text>
      <Pressable onPress={retry} style={errorStyles.primary}><Text style={errorStyles.primaryText}>Reintentar</Text></Pressable>
      {databaseReady && store ? (
        <Pressable onPress={() => { void exportFullBackup(store).catch(() => {}); }} style={errorStyles.secondary}>
          <Text style={errorStyles.secondaryText}>Guardar copia de mis datos</Text>
        </Pressable>
      ) : null}
      <Text style={errorStyles.technical} numberOfLines={5}>{truncateErrorMessage(error)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, marginTop: 20 },
});

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: light.bg, padding: 24, justifyContent: 'center' },
  title: { color: light.fg, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  help: { color: light.muted, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  primary: { backgroundColor: light.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 22 },
  primaryText: { color: light.accentFg, fontWeight: '800' },
  secondary: { borderColor: light.accent, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: light.accent, fontWeight: '800' },
  technical: { color: light.faint, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
