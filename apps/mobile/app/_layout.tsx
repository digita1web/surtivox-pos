import { useEffect, useState } from 'react';
import { AppState, View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb, initDatabase } from '../src/db';
import { useSession, useLocked } from '../src/session';
import { loadAppCurrency } from '../src/appCurrency';
import { Onboarding } from '../src/pos/Onboarding';
import { StaffLock } from '../src/pos/StaffLock';
import { AlertHost } from '../src/pos/alert';
import { LaunchIntro } from '../src/pos/LaunchIntro';
import { checkForUpdatesInBackground } from '../src/updates';
import { flushOutbox } from '../src/catalog';
import { exportFullBackup } from '../src/backup';
import { installGlobalErrorHandler } from '../src/crashHandler';
import { truncateErrorMessage } from '../src/diagnostics';
import { useTheme } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
installGlobalErrorHandler();

export default function RootLayout() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const loadSession = useSession((s) => s.load);
  const store = useSession((s) => s.store);
  const locked = useLocked();

  useEffect(() => {
    initDatabase()
      .then(() => loadSession())
      .then(async () => {
        await loadAppCurrency(useSession.getState().store?.currency_code ?? 'COP');
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
      <StatusBar style="auto" />
      {showIntro ? (
        <LaunchIntro isReady={ready || error !== null} onFinish={() => setShowIntro(false)} />
      ) : error ? (
        <View style={[styles.center, { backgroundColor: t.bg, padding: 24 }]}>
          <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>No se pudo abrir la base de datos</Text>
          <Text style={{ color: t.muted, marginTop: 10, textAlign: 'center' }}>No se borró nada automáticamente.</Text>
          <Pressable
            onPress={() => { setError(null); setReady(false); setBootAttempt((value) => value + 1); }}
            style={[styles.retry, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentFg, fontWeight: '800' }}>Reintentar</Text>
          </Pressable>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 18, textAlign: 'center' }} numberOfLines={4}>{error}</Text>
        </View>
      ) : !ready ? (
        <View style={[styles.center, { backgroundColor: t.bg }]}>
          <ActivityIndicator color={t.accent} size="large" />
          <Text style={{ color: t.muted, marginTop: 12 }}>Abriendo tienda…</Text>
        </View>
      ) : !store ? (
        <Onboarding onCreated={loadSession} />
      ) : locked ? (
        <StaffLock />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
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
  root: { flex: 1, backgroundColor: '#f2f4f7', padding: 24, justifyContent: 'center' },
  title: { color: '#0b1420', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  help: { color: '#707a89', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  primary: { backgroundColor: '#0ca678', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 22 },
  primaryText: { color: '#ffffff', fontWeight: '800' },
  secondary: { borderColor: '#0ca678', borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: '#0ca678', fontWeight: '800' },
  technical: { color: '#9aa4b2', fontSize: 11, textAlign: 'center', marginTop: 20 },
});
