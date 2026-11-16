import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/pos/Screen';
import { Chip, ChipRow, PrimaryButton } from '../src/pos/kit';
import { showAlert } from '../src/pos/alert';
import { useTheme, space, radius } from '../src/theme';
import { BUSINESS_TYPES, type BusinessTypeId, type InstalledPack } from '../src/catalogPack';
import {
  catalogAttribution, getInstalledPack, getPackType, installCatalogPack, removeCatalogPack, setPackType,
} from '../src/catalogPackRuntime';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const typeName = (id: BusinessTypeId) => BUSINESS_TYPES.find((t) => t.id === id)?.name ?? id;

export default function CatalogPack() {
  const t = useTheme();
  const [type, setType] = useState<BusinessTypeId>('tienda');
  const [installed, setInstalled] = useState<InstalledPack | null>(null);
  const [attribution, setAttribution] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [saved, pack] = await Promise.all([getPackType(), getInstalledPack()]);
    setType(pack?.type ?? saved);
    setInstalled(pack);
    setAttribution(pack ? await catalogAttribution() : []);
  }, []);

  useFocusEffect(useCallback(() => { void refresh().catch(() => {}); }, [refresh]));

  const choose = (id: BusinessTypeId) => {
    setType(id);
    void setPackType(id).catch(() => {});
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await installCatalogPack(type);
      await refresh();
      showAlert(
        r.status === 'up_to_date' ? 'Ya tienes la última versión' : 'Catálogo listo',
        r.status === 'up_to_date'
          ? `El catálogo de ${typeName(type)} está al día (${r.version}).`
          : `${r.pack.items.toLocaleString('es-CO')} productos de ${typeName(type)}. Funciona sin internet: al agregar un producto, escribe el nombre o escanea el código.`,
      );
    } catch (e) {
      showAlert('No se pudo descargar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    showAlert('Eliminar catálogo', 'Se borra la lista de productos sugeridos de este teléfono. Tus productos, ventas e inventario no cambian.', [
      { text: 'Cancelar', style: 'cancel' as const },
      { text: 'Eliminar', style: 'destructive' as const, onPress: () => { void removeCatalogPack().then(refresh).catch(() => {}); } },
    ]);
  };

  const switching = installed && installed.type !== type;
  const label = !installed ? 'Descargar catálogo' : switching ? `Cambiar a ${typeName(type)}` : 'Buscar actualización';

  return (
    <Screen title="Catálogo de productos" subtitle="Sugerencias al agregar productos, sin internet">
      <Text style={[s.p, { color: t.muted }]}>
        Descarga una lista de productos de tu tipo de negocio. Al agregar un producto, escribe el nombre o escanea el código y elige la sugerencia: se completan el nombre, la categoría y la unidad. El precio lo pones tú.
      </Text>

      <Text style={[s.label, { color: t.muted }]}>Tipo de negocio</Text>
      <ChipRow>
        {BUSINESS_TYPES.map((b) => <Chip key={b.id} label={b.name} on={type === b.id} onPress={() => choose(b.id)} />)}
      </ChipRow>

      <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
        <Ionicons name={installed ? 'checkmark-circle' : 'cloud-download-outline'} size={22} color={installed ? t.accent : t.muted} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          {installed ? (
            <>
              <Text style={{ color: t.fg, fontWeight: '800' }}>{typeName(installed.type)} · versión {installed.version}</Text>
              <Text style={{ color: t.muted, marginTop: 2 }}>{installed.items.toLocaleString('es-CO')} productos · {mb(installed.bytes)} en el teléfono</Text>
            </>
          ) : (
            <Text style={{ color: t.fg, fontWeight: '700' }}>Aún no hay catálogo en este teléfono</Text>
          )}
        </View>
      </View>

      <PrimaryButton icon="cloud-download-outline" label={busy ? 'Descargando…' : label} onPress={download} busy={busy} />
      {installed ? (
        <Text onPress={remove} style={[s.link, { color: t.dangerText }]} accessibilityRole="button">Eliminar catálogo de este teléfono</Text>
      ) : null}

      <Text style={[s.label, { color: t.muted }]}>Origen de los datos</Text>
      <Text style={[s.small, { color: t.muted }]}>
        Catálogo publicado bajo la Open Database License (ODbL) 1.0. Solo texto: no incluye precios ni fotos.
      </Text>
      {attribution.map((a) => <Text key={a} style={[s.small, { color: t.muted, marginTop: space.xs }]}>• {a}</Text>)}
    </Screen>
  );
}

const s = StyleSheet.create({
  p: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg, marginBottom: space.md },
  link: { textAlign: 'center', fontWeight: '700', marginTop: space.md, paddingVertical: space.sm },
  small: { fontSize: 12.5, lineHeight: 18 },
});
