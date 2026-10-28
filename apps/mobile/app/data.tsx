import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../src/session';
import { exportProducts, exportSales, importProducts, exportFullBackup, restoreFullBackup } from '../src/backup';
import { useTheme, space, radius, type Theme } from '../src/theme';
import { Screen } from '../src/pos/Screen';

export default function DataScreen() {
  const t = useTheme();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const reload = useSession((s) => s.load);
  const [busy, setBusy] = useState<string | null>(null);

  const confirmRestore = () => {
    showAlert('Restaurar desde respaldo', 'Esto reemplaza TODOS los datos actuales —productos, ventas, clientes y personal— con el archivo de respaldo. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Elegir archivo', style: 'destructive', onPress: () => run('rs', async () => {
        const r = await restoreFullBackup();
        if (!r) return;
        await reload();
        router.replace('/');
        showAlert('Restauración completa', `Se restauraron ${r.rows} registros en ${r.tables} tablas.`);
      }) },
    ]);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { showAlert('Algo salió mal', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <Screen title="Respaldo y CSV">
      <Text style={[s.section, { color: t.muted, marginTop: 0 }]}>Exportar</Text>
      <Group t={t}>
        <Row t={t} icon="cube-outline" title="Exportar productos" subtitle="Comparte tu catálogo como archivo CSV"
          busy={busy === 'ep'} onPress={() => run('ep', async () => {
            const n = await exportProducts(store);
            if (n === 0) showAlert('Nada para exportar', 'Aún no tienes productos.');
          })} />
        <Row t={t} icon="receipt-outline" title="Exportar ventas" subtitle="Comparte todas las líneas de venta en CSV" last
          busy={busy === 'es'} onPress={() => run('es', async () => {
            const n = await exportSales(store);
            if (n === 0) showAlert('Nada para exportar', 'Aún no tienes ventas.');
          })} />
      </Group>

      <Text style={[s.section, { color: t.muted }]}>Importar</Text>
      <Group t={t}>
        <Row t={t} icon="download-outline" title="Importar productos" subtitle="Sube un CSV para agregar o actualizar productos" last
          busy={busy === 'ip'} onPress={() => run('ip', async () => {
            const r = await importProducts(store);
            if (r) showAlert('Importación completa', `${r.created} agregados · ${r.updated} actualizados · ${r.skipped} omitidos.`);
          })} />
      </Group>

      <Text style={[s.section, { color: t.muted }]}>Respaldo completo</Text>
      <Group t={t}>
        <Row t={t} icon="cloud-upload-outline" title="Respaldar todo" subtitle="Guarda una copia completa como archivo .json"
          busy={busy === 'fb'} onPress={() => run('fb', async () => {
            const n = await exportFullBackup(store);
            if (n === 0) showAlert('Nada para respaldar', 'Tu tienda aún no tiene datos.');
          })} />
        <Row t={t} icon="cloud-download-outline" title="Restaurar desde respaldo" subtitle="Reemplaza todos los datos con un archivo de respaldo" last
          busy={busy === 'rs'} onPress={confirmRestore} />
      </Group>

      <View style={[s.note, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="information-circle-outline" size={18} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: space.sm, flex: 1, fontSize: 13 }}>
          La importación cruza por código de barras: los productos existentes se actualizan (nombre, precios, impuesto) y los nuevos se crean con su stock inicial. Columnas: name, barcode, selling_price, cost_price, tax_percent, stock.
        </Text>
      </View>
    </Screen>
  );
}

function Group({ children, t }: { children: React.ReactNode; t: Theme }) {
  return <View style={[s.group, { backgroundColor: t.panel, borderColor: t.line }]}>{children}</View>;
}

function Row({ t, icon, title, subtitle, onPress, busy, last }: {
  t: Theme; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; busy?: boolean; last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[s.row, !last && { borderBottomWidth: 1, borderColor: t.line }]}>
      <View style={[s.icon, { backgroundColor: t.accentSoft }]}><Ionicons name={icon} size={20} color={t.accent} /></View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={{ color: t.fg, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {busy ? <ActivityIndicator color={t.accent} /> : <Ionicons name="chevron-forward" size={18} color={t.muted} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '600', marginTop: space.xl, marginBottom: space.sm, marginLeft: space.xs },
  group: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', borderRadius: radius.md, padding: 14, marginTop: space.xl },
});
