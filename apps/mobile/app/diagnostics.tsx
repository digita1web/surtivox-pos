import { useEffect, useState } from 'react';
import { View, Text, Pressable, Share, StyleSheet, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import { Screen } from '../src/pos/Screen';
import { getDb } from '../src/db';
import { getLocalSetting } from '../src/repos';
import { CATALOG_URL } from '../src/catalog';
import { isCatalogEnabled } from '../src/catalogCore';
import { buildDiagnosticsText, type DiagnosticsData } from '../src/diagnostics';
import { useTheme, space, radius } from '../src/theme';

export default function DiagnosticsScreen() {
  const t = useTheme();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const db = getDb();
        const info = await FileSystem.getInfoAsync(db.databasePath);
        const migrations = await db.getAllAsync<{ id: string }>('SELECT id FROM _migrations ORDER BY id');
        const lastBackupRaw = await getLocalSetting('last_backup_at');
        const lastBackupParsed = lastBackupRaw === null ? null : Number(lastBackupRaw);
        const lastError = await getLocalSetting('last_error');
        const optInRaw = await getLocalSetting('catalog_opt_in');
        const pending = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM catalog_outbox');
        const next: DiagnosticsData = {
          appVersion: String(Constants.expoConfig?.version ?? 'No disponible'),
          runtimeVersion: Updates.isEnabled ? Updates.runtimeVersion : null,
          updateId: Updates.isEnabled ? Updates.updateId : null,
          dbSizeBytes: info.exists ? info.size : null,
          migrations: migrations.length,
          lastMigration: migrations[migrations.length - 1]?.id ?? null,
          lastBackupAt: lastBackupParsed !== null && Number.isFinite(lastBackupParsed) ? lastBackupParsed : null,
          cameraRestarts: await getLocalSetting('camera_restarts'),
          catalogConfigured: isCatalogEnabled(CATALOG_URL),
          catalogOptIn: optInRaw === '1' ? true : optInRaw === '0' ? false : null,
          catalogPending: pending?.count ?? 0,
          lastError,
        };
        if (!active) return;
        setData(next);
        setText(buildDiagnosticsText(next));
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const share = async () => {
    if (!text) return;
    try {
      await Share.share({ message: text, title: 'Diagnóstico de Surtivox POS' });
    } catch {}
  };

  return (
    <Screen title="Diagnóstico">
      {failed ? (
        <Text style={{ color: t.muted }}>No se pudo cargar el diagnóstico.</Text>
      ) : !data ? (
        <View style={s.loading}><ActivityIndicator color={t.accent} /><Text style={{ color: t.muted, marginTop: 10 }}>Leyendo diagnóstico…</Text></View>
      ) : (
        <>
          <Text selectable style={[s.body, { color: t.fg, backgroundColor: t.panel, borderColor: t.line }]}>{text}</Text>
          <Pressable onPress={() => { void share(); }} style={[s.share, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800' }}>Compartir diagnóstico</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  loading: { alignItems: 'center', marginTop: space.xxl },
  body: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, fontSize: 13, lineHeight: 20 },
  share: { borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center', marginTop: space.lg },
});
