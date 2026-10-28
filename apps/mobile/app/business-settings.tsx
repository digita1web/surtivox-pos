import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { showAlert } from '../src/pos/alert';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';
import { useSession } from '../src/session';
import { profileOf, updateStoreProfile } from '../src/repos';
import {
  DEFAULT_BUSINESS_PROFILE, getBusinessProfile, saveBusinessProfile, type BusinessProfile,
} from '../src/businessProfile';
import { useTheme, space, radius, type as ty } from '../src/theme';

export default function BusinessSettings() {
  const t = useTheme();
  const router = useRouter();
  const store = useSession((s) => s.store);
  const reload = useSession((s) => s.load);
  const [form, setForm] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBusinessProfile(store).then(setForm);
  }, [store]);

  if (!store) return null;

  const patch = (p: Partial<BusinessProfile>) => setForm((prev) => ({ ...prev, ...p }));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await saveBusinessProfile(store.id, form);
      await updateStoreProfile(store.id, {
        ...profileOf(store),
        name: saved.name,
        address: saved.address,
        phone: saved.phone,
        email: saved.email,
        taxId: saved.taxId,
      });
      await reload();
      showAlert('Datos guardados', 'El recibo usará esta información.', [
        { text: 'Listo', onPress: () => router.back() },
      ]);
    } catch (e) {
      showAlert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof BusinessProfile, placeholder: string, keyboardType?: 'phone-pad' | 'email-address') => (
    <View>
      <Text style={[s.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(value) => patch({ [key]: value })}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType ? 'none' : 'sentences'}
        style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]}
      />
    </View>
  );

  return (
    <Screen
      title="Datos del negocio"
      subtitle="Se imprimen en el recibo"
      footer={<PrimaryButton label="Guardar datos" onPress={save} busy={busy} />}
    >
      <Text style={[ty.body, { color: t.muted, marginBottom: space.lg }]}>
        Estos datos se guardan en este dispositivo y reemplazan los datos de ejemplo del recibo.
      </Text>
      {field('Nombre del negocio', 'name', 'Ej. Mi Negocio')}
      {field('Dirección', 'address', 'Ej. Calle 10 # 20-30, Bogotá')}
      {field('Teléfono', 'phone', 'Ej. +57 300 123 4567', 'phone-pad')}
      {field('Correo electrónico', 'email', 'Ej. ventas@minegocio.com', 'email-address')}
      {field('NIT / ID fiscal', 'taxId', 'Ej. 900123456-7')}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
});
