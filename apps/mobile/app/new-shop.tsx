import { useState } from 'react';
import { Text } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useRouter } from 'expo-router';
import { createStore, DEFAULT_RECEIPT_ACCENT, type StoreProfile } from '../src/repos';
import { useSession } from '../src/session';
import { currencyCodeForNewShop, currencyConfigForDisplay } from '../src/branding';
import { ShopDetailsFields } from '../src/pos/StoreProfileForm';
import { useTheme, space } from '../src/theme';
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
  const activeStore = useSession((s) => s.store);
  const code = currencyCodeForNewShop(activeStore);
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<StoreProfile>) => setProfile((prev) => ({ ...prev, ...p }));

  const create = async () => {
    if (!profile.name.trim() || busy) return;
    setBusy(true);
    try {
      await createStore(profile.name.trim(), currencyConfigForDisplay(code), { ...profile, name: profile.name.trim() });
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

      <Text style={{ color: t.muted, marginTop: space.lg }}>Moneda: {code}. Es la misma de tus otras tiendas; puedes cambiarla en Más.</Text>
      <Text style={{ color: t.faint, fontSize: 12, marginTop: space.md }}>Puedes ajustar el diseño del recibo (tamaño del papel, color y pie) en Perfil de la tienda después de crearla.</Text>
    </Screen>
  );
}
