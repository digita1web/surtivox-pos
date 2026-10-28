import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Share, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getSyncState, saveSyncConfig, disconnectSync, syncNow, restoreFromCloud, isConfigured,
  hasHostedSync, turnOnCloudBackup, linkDeviceByCode, formatCode, type SyncState,
} from '../src/sync';
import { hasCloudSync } from '../src/subscription';
import { newId } from '../src/id';
import { useSession } from '../src/session';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';

export default function CloudSync() {
  const t = useTheme();
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const hosted = hasHostedSync();
  const [state, setState] = useState<SyncState | null>(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // Cloud sync is a paid feature — no subscription → paywall.
    hasCloudSync().then((ok) => { if (!ok) router.replace('/paywall'); });
    getSyncState().then((s) => {
      setState(s);
      setUrl(s.server_url ?? '');
      setToken(s.token ?? '');
    });
  }, []);
  useFocusEffect(refresh);

  const connected = state ? isConfigured(state) : false;
  const shopCode = state?.token ? formatCode(state.token) : '';

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { showAlert('Error de sincronización', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); refresh(); }
  };

  // --- one-tap hosted actions ---
  const turnOn = () => run('on', async () => {
    await turnOnCloudBackup();
    showAlert('Respaldo en la nube activado', 'Tu tienda está respaldada. Usa el código de tienda para agregar otro dispositivo.');
  });
  const sync = () => run('sync', async () => { await syncNow(); });
  const shareCode = async () => {
    if (!shopCode) return;
    try { await Share.share({ message: `Agrega este dispositivo a mi tienda Surtivox con el código: ${shopCode}` }); } catch { /* dismissed */ }
  };
  const link = () => {
    if (!linkCode.trim()) { showAlert('Ingresa un código de tienda', 'Pega el código que aparece en tu otro dispositivo.'); return; }
    showAlert('¿Vincular este dispositivo?', 'Esto REEMPLAZA todos los datos de este dispositivo con la tienda de la nube. Úsalo en un teléfono nuevo o de respaldo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reemplazar y vincular', style: 'destructive', onPress: () => run('link', async () => {
        const n = await linkDeviceByCode(linkCode);
        await reload(); router.replace('/');
        showAlert('Dispositivo vinculado', `Se descargaron ${n} registros de esta tienda.`);
      }) },
    ]);
  };

  const connectAndSync = () => run('sync', async () => {
    if (!url.trim() || !token.trim()) { showAlert('Faltan datos', 'Ingresa la URL del servidor y el token.'); return; }
    await saveSyncConfig(url, token);
    await syncNow();
    showAlert('Sincronizado', 'El respaldo en la nube está activo. Sincronizado hace un momento.');
  });
  const restore = () => {
    if (!url.trim() || !token.trim()) { showAlert('Faltan datos', 'Ingresa la URL del servidor y el token de tu otro dispositivo.'); return; }
    showAlert('Restaurar desde la nube', 'Esto REEMPLAZA todos los datos de este dispositivo con la tienda de la nube.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reemplazar y descargar', style: 'destructive', onPress: () => run('restore', async () => {
        const n = await restoreFromCloud(url, token);
        await reload(); router.replace('/');
        showAlert('Dispositivo vinculado', `Se descargaron ${n} registros de la nube.`);
      }) },
    ]);
  };

  const disconnect = () => showAlert('¿Desactivar el respaldo en la nube?', 'Tus datos permanecen en este dispositivo; solo deja de sincronizarse.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desactivar', style: 'destructive', onPress: () => run('off', async () => { await disconnectSync(); }) },
  ]);

  // Footer: the single primary action for the current state.
  const footer = (() => {
    if (connected) {
      return (
        <Pressable onPress={sync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="sync-outline" size={18} color={t.accentFg} />}
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar ahora'}</Text>
        </Pressable>
      );
    }
    if (hosted) {
      return (
        <Pressable onPress={turnOn} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy === 'on' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-upload-outline" size={18} color={t.accentFg} />}
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'on' ? 'Activando…' : 'Activar respaldo en la nube'}</Text>
        </Pressable>
      );
    }
    return (
      <Pressable onPress={connectAndSync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
        {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-upload-outline" size={18} color={t.accentFg} />}
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Conectando…' : 'Conectar y sincronizar esta tienda'}</Text>
      </Pressable>
    );
  })();

  return (
    <Screen title="Respaldo en la nube" footer={footer}>
      {/* Status */}
      <View style={[s.status, { backgroundColor: connected ? t.accent : t.panel, borderColor: t.line }]}>
        <Ionicons name={connected ? 'cloud-done-outline' : 'cloud-offline-outline'} size={26} color={connected ? t.accentFg : t.muted} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={{ color: connected ? t.accentFg : t.fg, fontWeight: '800', fontSize: 16 }}>{connected ? 'Respaldado' : 'Sin respaldo'}</Text>
          <Text style={{ color: connected ? t.accentFg : t.muted, opacity: connected ? 0.9 : 1, fontSize: 12, marginTop: 2 }}>
            {connected ? (state?.last_synced_at ? `Última sincronización ${new Date(state.last_synced_at).toLocaleString()}` : 'Aún no se ha sincronizado') : 'Mantén esta tienda segura y sincronizada entre tus dispositivos'}
          </Text>
        </View>
      </View>

      {/* CONNECTED (hosted): shop code to add devices */}
      {connected && hosted && shopCode ? (
        <>
          <Text style={[s.label, { color: t.muted }]}>CÓDIGO DE TU TIENDA</Text>
          <View style={[s.codeCard, { borderColor: t.accent, backgroundColor: t.accentSoft }]}>
            <Text selectable style={[s.code, { color: t.fg }]}>{shopCode}</Text>
            <Pressable onPress={shareCode} style={[s.share, { backgroundColor: t.accent }]}>
              <Ionicons name="share-outline" size={16} color={t.accentFg} />
              <Text style={{ color: t.accentFg, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Compartir</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.faint, fontSize: 12, marginTop: 6 }}>
            En otro teléfono, abre Respaldo en la nube, toca “Agregar este dispositivo a una tienda” e ingresa este código. Mantenlo privado: cualquiera que lo tenga puede leer los datos de esta tienda.
          </Text>
          <Pressable onPress={disconnect} disabled={!!busy} style={[s.secondary, { borderColor: t.line }]}>
            <Text style={{ color: t.danger, fontWeight: '700' }}>Desactivar respaldo en la nube</Text>
          </Pressable>
        </>
      ) : null}

      {/* NOT CONNECTED (hosted): explainer + link-with-code */}
      {!connected && hosted ? (
        <>
          <View style={[s.benefit, { borderColor: t.line }]}>
            {[
              ['cloud-done-outline', 'Respaldo automático', 'Tu tienda está segura si pierdes o se daña el teléfono.'],
              ['phone-portrait-outline', 'Entre dispositivos', 'Vende desde dos teléfonos o desde administración a la vez.'],
            ].map(([icon, title, sub]) => (
              <View key={title} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                <View style={[s.bIcon, { backgroundColor: t.accentSoft }]}><Ionicons name={icon as never} size={18} color={t.accent} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: t.fg, fontWeight: '700' }}>{title}</Text>
                  <Text style={{ color: t.muted, fontSize: 12.5 }}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => setShowLink((v) => !v)} style={[s.disclosure, { borderColor: t.line }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={t.accent} />
            <Text style={{ color: t.fg, fontWeight: '700', flex: 1, marginLeft: 10 }}>Agregar este dispositivo a una tienda</Text>
            <Ionicons name={showLink ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
          </Pressable>
          {showLink ? (
            <View style={{ marginTop: space.md }}>
              <Text style={{ color: t.muted, fontSize: 13, marginBottom: space.sm }}>¿Ya vendes desde otro teléfono? Ingresa el código de esa tienda para descargarla aquí.</Text>
              <TextInput value={linkCode} onChangeText={setLinkCode} autoCapitalize="characters" autoCorrect={false}
                placeholder="XXXX-XXXX-XXXX-XXXX" placeholderTextColor={t.muted}
                style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 1 }]} />
              <Pressable onPress={link} disabled={!!busy} style={[s.secondary, { borderColor: t.accent, marginTop: space.md }]}>
                {busy === 'link' ? <ActivityIndicator color={t.accent} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accent} />}
                <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>{busy === 'link' ? 'Vinculando…' : 'Vincular este dispositivo'}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {/* ADVANCED / self-host, or the whole manual flow when no hosted backend */}
      {(!hosted || showAdvanced) && !connected ? (
        <>
          {hosted ? <View style={[s.divider, { borderColor: t.line }]} /> : null}
          <Text style={[s.label, { color: t.muted, marginTop: 0 }]}>{hosted ? 'SERVIDOR PERSONALIZADO' : 'URL DEL SERVIDOR'}</Text>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
            placeholder="https://surtivox-sync.<tu>.workers.dev" placeholderTextColor={t.muted}
            style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
          <Text style={[s.label, { color: t.muted }]}>TOKEN DE LA TIENDA</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false}
              placeholder="un secreto compartido para tu tienda" placeholderTextColor={t.muted}
              style={[s.input, { flex: 1, color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
            <Pressable onPress={() => setToken(newId() + newId())} style={[s.gen, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="key-outline" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Generar</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>
            Usa la misma URL y token en todos los dispositivos de esta tienda. Mantén el token en privado.
          </Text>
          <Pressable onPress={restore} disabled={!!busy} style={[s.secondary, { borderColor: t.accent }]}>
            {busy === 'restore' ? <ActivityIndicator color={t.accent} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accent} />}
            <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>{busy === 'restore' ? 'Descargando…' : 'Restaurar este dispositivo desde un servidor personalizado'}</Text>
          </Pressable>
        </>
      ) : null}

      {/* Toggle to reveal the custom-server option when a hosted backend exists */}
      {hosted && !connected ? (
        <Pressable onPress={() => setShowAdvanced((v) => !v)} style={{ alignSelf: 'center', marginTop: space.xl }} hitSlop={10}>
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13 }}>{showAdvanced ? 'Ocultar servidor personalizado' : 'Usar un servidor personalizado'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  gen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 14 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52, paddingHorizontal: space.xl },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 15, marginTop: space.xl, borderWidth: 1 },
  divider: { borderTopWidth: 1, marginTop: space.xl, marginBottom: space.lg },
  codeCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg },
  code: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  share: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9 },
  benefit: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  bIcon: { width: 36, height: 36, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
  disclosure: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
});
