import { useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useRouter } from 'expo-router';
import { createStore, DEFAULT_RECEIPT_ACCENT, type StoreProfile } from '../src/repos';
import { useSession } from '../src/session';
import { CURRENCIES, defaultCurrencyFor, currencyConfigFor } from '../src/branding';
import { ShopDetailsFields } from '../src/pos/StoreProfileForm';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';

const EMPTY_PROFILE: StoreProfile = {
  name: '', address: '', phone: '', email: '', website: '', taxId: '', tagline: '', logoUri: null,
  receiptFooter: '', receiptTerms: '', receiptAccent: DEFAULT_RECEIPT_ACCENT, receiptPaper: 'a4',
  showLogo: true, showContact: true, showStaff: true,
};

export default function NewShop() {
  const t = useTheme();
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const [profile, setProfile] = useState<StoreProfile>(EMPTY_PROFILE);
  const [code, setCode] = useState(() => defaultCurrencyFor(Intl.DateTimeFormat().resolvedOptions().locale));
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<StoreProfile>) => setProfile((prev) => ({ ...prev, ...p }));

  const create = async () => {
    if (!profile.name.trim() || busy) return;
    setBusy(true);
    try {
      await createStore(profile.name.trim(), currencyConfigFor(code), { ...profile, name: profile.name.trim() });
      await reload();          // new shop is now the active one (created as current)
      router.replace('/');     // fresh shop has no staff yet → straight to Home
    } catch (e) {
      showAlert('No se pudo crear la tienda', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen title="Agregar tienda" subtitle="Una tienda separada en este dispositivo"
      footer={<PrimaryButton label="Crear tienda" onPress={create} busy={busy} disabled={!profile.name.trim()} />}>
      <Text style={{ color: t.muted, marginBottom: space.xs }}>
        El logo, el nombre y los datos de contacto aparecen en los recibos de esta tienda. Solo el nombre es obligatorio; lo demás es opcional y se puede editar después.
      </Text>

      <ShopDetailsFields value={profile} onChange={patch} />

      <Text style={[st.label, { color: t.muted }]}>MONEDA</Text>
      <View style={st.pills}>
        {CURRENCIES.map((c) => {
          const on = code === c.code;
          return (
            <Pressable key={c.code} onPress={() => setCode(c.code)} style={[st.pill, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel }]}>
              <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{c.code}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.faint, fontSize: 12, marginTop: space.md }}>Puedes ajustar el diseño del recibo (tamaño del papel, color y pie) en Perfil de la tienda después de crearla.</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
});
