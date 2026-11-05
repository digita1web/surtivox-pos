import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Share, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { formatKitForSharing, pickConfirmationPositions } from '@surtivox/pos-core';
import { getKit, confirmKit } from '../src/sync';
import type { KitInfo } from '../src/kitOps';
import { showAlert } from '../src/pos/alert';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';

const randomInt = (max: number) => Crypto.getRandomBytes(1)[0]! % max;

export default function KitScreen() {
  const t = useTheme();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [kit, setKit] = useState<KitInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<'show' | 'confirm'>('show');
  const [positions, setPositions] = useState<[number, number]>([0, 1]);
  const [typed, setTyped] = useState<[string, string]>(['', '']);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    getKit().then((value) => { setKit(value); setLoaded(true); }).catch(() => setLoaded(true));
  }, []));

  const send = async () => {
    if (!kit) return;
    try {
      await Share.share({ message: `Kit de recuperación de mi tienda Surtivox:\n${formatKitForSharing(kit.words)}` });
    } catch {}
  };

  const startConfirm = () => {
    setPositions(pickConfirmationPositions(randomInt));
    setTyped(['', '']);
    setError(null);
    setStep('confirm');
  };

  const submit = async () => {
    const ok = await confirmKit(positions, typed).catch(() => false);
    if (!ok) { setError('Las palabras no coinciden. Revisa tu kit e inténtalo de nuevo.'); return; }
    showAlert('Kit confirmado', 'Listo. Guárdalo en un lugar seguro: con él puedes recuperar tu tienda en otro teléfono.');
    router.replace('/cloud-sync');
  };

  if (loaded && !kit) {
    return (
      <Screen title="Kit de recuperación">
        <Text style={{ color: t.muted }}>Aún no hay un kit en este teléfono. Activa el respaldo en la nube para crearlo.</Text>
      </Screen>
    );
  }

  const words = kit?.words ?? [];
  const confirmed = kit?.confirmedAt != null;

  if (step === 'confirm') {
    return (
      <Screen
        title="Confirma tu kit"
        footer={(
          <Pressable
            onPress={submit}
            disabled={typed[0].trim() === '' || typed[1].trim() === ''}
            accessibilityRole="button"
            style={[s.primary, { backgroundColor: t.accent, opacity: typed[0].trim() === '' || typed[1].trim() === '' ? 0.5 : 1 }]}
          >
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>Confirmar</Text>
          </Pressable>
        )}
      >
        <Text style={{ color: t.fg, fontSize: 15 }}>Para comprobar que lo guardaste, escribe estas dos palabras de tu kit.</Text>
        {[0, 1].map((i) => (
          <View key={i} style={{ marginTop: space.lg }}>
            <Text style={[s.label, { color: t.muted }]}>{`PALABRA ${positions[i]! + 1}`}</Text>
            <TextInput
              value={typed[i]}
              onChangeText={(value) => setTyped((prev) => (i === 0 ? [value, prev[1]] : [prev[0], value]))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={`Palabra ${positions[i]! + 1}`}
              placeholderTextColor={t.muted}
              style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]}
            />
          </View>
        ))}
        {error ? <Text style={{ color: t.dangerText, marginTop: space.md, fontWeight: '700' }}>{error}</Text> : null}
        <Pressable onPress={() => setStep('show')} style={{ marginTop: space.xl, alignSelf: 'center' }} hitSlop={10}>
          <Text style={{ color: t.accent, fontWeight: '700' }}>Ver mi kit otra vez</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen
      title="Tu kit de recuperación"
      footer={confirmed ? (
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>Cerrar</Text>
        </Pressable>
      ) : (
        <Pressable onPress={startConfirm} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>Ya lo guardé, confirmar</Text>
        </Pressable>
      )}
    >
      <View style={[s.warn, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
        <Ionicons name="key-outline" size={20} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: space.md, flex: 1, fontWeight: '700' }}>
          Guarda esto como la llave de tu caja: quien lo tenga puede abrir tu tienda.
        </Text>
      </View>
      {mode === 'view' ? (
        <Text style={{ color: t.muted, fontSize: 12.5, marginTop: space.md }}>Míralo en un lugar privado. Nadie más debe ver tu pantalla.</Text>
      ) : null}
      <View style={[s.grid, { borderColor: t.line, backgroundColor: t.panel }]}>
        {words.map((word, i) => (
          <View key={`${i}-${word}`} style={s.cell}>
            <Text style={{ color: t.muted, fontWeight: '700', width: 22 }}>{i + 1}</Text>
            <Text selectable={false} style={{ color: t.fg, fontSize: 24, fontWeight: '800', flex: 1 }}>{word}</Text>
          </View>
        ))}
      </View>
      {confirmed ? (
        <Text style={{ color: t.accent, fontWeight: '700', marginTop: space.md }}>Kit confirmado.</Text>
      ) : (
        <Text style={{ color: t.warnText, fontWeight: '700', marginTop: space.md }}>Aún no lo has confirmado.</Text>
      )}
      <Pressable onPress={send} accessibilityRole="button" style={[s.secondary, { borderColor: t.accent }]}>
        <Ionicons name="logo-whatsapp" size={18} color={t.accent} />
        <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>Enviar a mi WhatsApp o copiar</Text>
      </Pressable>
      <Text style={{ color: t.faint, fontSize: 12, marginTop: space.sm }}>
        Se abre el menú del teléfono. Envíalo solo a tu propio chat; no lo publiques ni lo reenvíes.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  warn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  grid: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  cell: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 18 },
  primary: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 15, marginTop: space.xl, borderWidth: 1 },
});
