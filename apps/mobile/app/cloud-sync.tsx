import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getSyncState, saveSyncConfig, disconnectSync, syncNow, restoreFromCloud, isConfigured,
  hasHostedSync, turnOnCloudBackup, getKitStatus, changeShopKey, formatCode, type SyncState,
} from '../src/sync';
import { SyncHttpError } from '../src/syncErrors';
import type { KitStatus } from '../src/kitOps';
import { RECOVER_CARD_ACTION, RECOVER_CARD_TITLE, RECOVER_REPLACE_WARNING, recoverEntryOnCloudScreen } from '../src/recoverAccess';
import { getLocalSetting } from '../src/repos';
import { DEVELOPER_MODE_KEY, isDeveloperMode } from '../src/developerMode';
import { newId } from '../src/id';
import { CLOUD_NOTICE } from '../src/legalText';
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
  const [kitStatus, setKitStatus] = useState<KitStatus>('none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getLocalSetting(DEVELOPER_MODE_KEY).then((value) => setDeveloperMode(isDeveloperMode(value))).catch(() => {});
    getKitStatus().then(setKitStatus).catch(() => {});
    getSyncState().then((s) => {
      setState(s);
      setUrl(s.server_url ?? '');
      setToken(s.token ?? '');
    });
  }, []);
  useFocusEffect(refresh);

  const connected = state ? isConfigured(state) : false;
  const recoverEntry = recoverEntryOnCloudScreen({ hosted, connected });
  const shopCode = state?.token ? formatCode(state.token) : '';

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      if (e instanceof SyncHttpError && e.code === 'key_changed') {
        showAlert('La llave cambió', e.message, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ingresar kit', onPress: () => router.push('/recover') },
        ]);
      } else {
        showAlert('Error de sincronización', e instanceof Error ? e.message : String(e));
      }
    }
    finally { setBusy(null); refresh(); }
  };

  // --- one-tap hosted actions ---
  const turnOn = () => showAlert(CLOUD_NOTICE.title, CLOUD_NOTICE.body, [
    { text: CLOUD_NOTICE.cancel, style: 'cancel' },
    { text: CLOUD_NOTICE.confirm, onPress: () => { void run('on', async () => {
      const activation = await turnOnCloudBackup();
      if (activation.words) router.push('/kit?mode=new');
      else showAlert('Respaldo en la nube activado', 'Tu tienda está respaldada.');
    }); } },
  ]);
  const sync = () => run('sync', async () => { await syncNow(); });
  const rotate = () => showAlert(
    kitStatus === 'legacy' ? 'Crear tu kit de recuperación' : 'Cambiar la llave de la tienda',
    'La llave actual dejará de servir. Los otros teléfonos vinculados tendrán que ingresar el nuevo kit para seguir sincronizando.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: kitStatus === 'legacy' ? 'Crear kit' : 'Cambiar llave', style: 'destructive', onPress: () => { void run('rotate', async () => {
        await changeShopKey();
        router.push('/kit?mode=new');
      }); } },
    ],
  );

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

  const disconnect = () => showAlert('¿Desactivar el respaldo en la nube?', 'Tus datos permanecen en este dispositivo; solo deja de sincronizarse. Podrás reactivarlo con el mismo código de tienda.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desactivar', style: 'destructive', onPress: () => run('off', async () => { await disconnectSync(); }) },
  ]);

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
    if (developerMode) {
      return (
        <Pressable onPress={connectAndSync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-upload-outline" size={18} color={t.accentFg} />}
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Conectando…' : 'Conectar y sincronizar esta tienda'}</Text>
        </Pressable>
      );
    }
    return null;
  })();

  return (
    <Screen title="Respaldo en la nube" footer={footer} contentStyle={{ paddingBottom: 160 }}>
      {/* Status */}
      <View style={[s.status, { backgroundColor: connected ? t.accent : t.panel, borderColor: t.line }]}>
        <Ionicons name={connected ? 'cloud-done-outline' : 'cloud-offline-outline'} size={26} color={connected ? t.accentFg : t.muted} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={{ color: connected ? t.accentFg : t.fg, fontWeight: '800', fontSize: 16 }}>{connected ? 'Nube activa' : 'Sin respaldo'}</Text>
          <Text style={{ color: connected ? t.accentFg : t.muted, opacity: connected ? 0.9 : 1, fontSize: 12, marginTop: 2 }}>
            {connected ? (state?.last_synced_at ? `Última sincronización ${new Date(state.last_synced_at).toLocaleString()}` : 'Aún no se ha sincronizado') : 'Mantén esta tienda segura y sincronizada entre tus dispositivos'}
          </Text>
        </View>
      </View>

      <View style={[s.betaCard, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
        <Ionicons name="flask-outline" size={20} color={t.accent} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 14 }}>Versión de pruebas</Text>
          <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
            El respaldo en la nube está activo en modo de prueba y es gratis por ahora. Puede cambiar o dejar de estar disponible. Sigue guardando también copias locales en Respaldo y CSV.
          </Text>
        </View>
      </View>

      {recoverEntry.visible && recoverEntry.placement === 'primary' ? (
        <Pressable
          onPress={() => router.push('/recover')}
          accessibilityRole="button"
          accessibilityLabel={`${RECOVER_CARD_TITLE} ${RECOVER_CARD_ACTION}`}
          style={[s.recoverCard, { borderColor: t.accent, backgroundColor: t.panel }]}
        >
          <View style={[s.bIcon, { backgroundColor: t.accentSoft }]}><Ionicons name="cloud-download-outline" size={20} color={t.accent} /></View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={{ color: t.fg, fontWeight: '800' }}>{RECOVER_CARD_TITLE}</Text>
            <Text style={{ color: t.accent, fontWeight: '700', marginTop: 2 }}>{RECOVER_CARD_ACTION}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.accent} />
        </Pressable>
      ) : null}

      {connected && hosted ? (
        <>
          {kitStatus === 'legacy' && shopCode ? (
            <>
              <Text style={[s.label, { color: t.muted }]}>CÓDIGO DE TU TIENDA</Text>
              <View style={[s.codeCard, { borderColor: t.accent, backgroundColor: t.accentSoft }]}>
                <Text selectable style={[s.code, { color: t.fg }]}>{shopCode}</Text>
              </View>
              <Text style={{ color: t.faint, fontSize: 12, marginTop: 6 }}>
                Este código largo se reemplaza por un kit de 8 palabras. Mantenlo privado: cualquiera que lo tenga puede leer los datos de esta tienda.
              </Text>
            </>
          ) : null}
          <Text style={[s.label, { color: t.muted }]}>KIT DE RECUPERACIÓN</Text>
          <View style={[s.codeCard, { borderColor: kitStatus === 'confirmed' ? t.accent : t.warn, backgroundColor: t.panel }]}>
            <Ionicons name={kitStatus === 'confirmed' ? 'shield-checkmark-outline' : 'alert-circle-outline'} size={22} color={kitStatus === 'confirmed' ? t.accent : t.warnText} />
            <Text style={{ color: t.fg, fontWeight: '700', flex: 1, marginLeft: space.md }}>
              {kitStatus === 'confirmed' ? 'Kit guardado y confirmado' : kitStatus === 'unconfirmed' ? 'Kit sin confirmar' : 'Aún no tienes un kit'}
            </Text>
          </View>
          {kitStatus === 'legacy' ? (
            <Pressable onPress={rotate} disabled={!!busy} style={[s.secondary, { borderColor: t.accent }]}>
              <Ionicons name="key-outline" size={18} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>Crea tu kit de recuperación</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => router.push(kitStatus === 'confirmed' ? '/kit?mode=view' : '/kit?mode=new')} style={[s.secondary, { borderColor: t.accent }]}>
                <Ionicons name="eye-outline" size={18} color={t.accent} />
                <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>{kitStatus === 'confirmed' ? 'Ver mi kit' : 'Ver y confirmar mi kit'}</Text>
              </Pressable>
              <Pressable onPress={rotate} disabled={!!busy} style={[s.secondary, { borderColor: t.line, marginTop: space.md }]}>
                {busy === 'rotate' ? <ActivityIndicator color={t.fg} /> : <Ionicons name="refresh-outline" size={18} color={t.fg} />}
                <Text style={{ color: t.fg, fontWeight: '700', marginLeft: space.sm }}>Cambiar llave</Text>
              </Pressable>
            </>
          )}
          <Text style={{ color: t.faint, fontSize: 12, marginTop: 6 }}>
            En otro teléfono, abre Respaldo en la nube, toca “Ya tengo mi tienda” e ingresa el kit. Quien tenga el kit puede abrir esta tienda.
          </Text>
          <Pressable onPress={disconnect} disabled={!!busy} style={[s.secondary, { borderColor: t.line }]}>
            <Text style={{ color: t.dangerText, fontWeight: '700' }}>Desactivar respaldo en la nube</Text>
          </Pressable>
          {recoverEntry.visible && recoverEntry.placement === 'secondary' ? (
            <View style={{ marginTop: space.xl }}>
              <Pressable onPress={() => router.push('/recover')} accessibilityRole="button" style={[s.secondary, { borderColor: t.line, marginTop: 0 }]}>
                <Ionicons name="cloud-download-outline" size={18} color={t.fg} />
                <Text style={{ color: t.fg, fontWeight: '700', marginLeft: space.sm }}>{RECOVER_CARD_ACTION}</Text>
              </Pressable>
              <Text style={{ color: t.dangerText, fontSize: 12, marginTop: 6, textAlign: 'center' }}>{RECOVER_REPLACE_WARNING}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {/* NOT CONNECTED (hosted): explainer + recover entry */}
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

        </>
      ) : null}

      {/* ADVANCED / self-host, or the whole manual flow when no hosted backend */}
      {developerMode && (!hosted || showAdvanced) && !connected ? (
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
      {developerMode && hosted && !connected ? (
        <Pressable onPress={() => setShowAdvanced((v) => !v)} style={{ alignSelf: 'center', marginTop: space.xl }} hitSlop={10}>
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13 }}>{showAdvanced ? 'Ocultar servidor personalizado' : 'Usar un servidor personalizado'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  betaCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
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
  recoverCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  disclosure: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
});
