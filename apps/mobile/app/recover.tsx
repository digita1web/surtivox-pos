import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { linkDeviceByCode } from '../src/sync';
import { useSession } from '../src/session';
import { showAlert } from '../src/pos/alert';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';

export default function Recover() {
  const t = useTheme();
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    if (busy) return;
    if (!text.trim()) { setError('Escribe o pega las 8 palabras de tu kit.'); return; }
    setError(null);
    showAlert('¿Recuperar esta tienda?', 'Esto REEMPLAZA todos los datos de este teléfono con los de tu tienda en la nube. Antes se guarda una copia de seguridad de lo que hay ahora.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Recuperar', style: 'destructive', onPress: () => { void run(); } },
    ]);
  };

  const run = async () => {
    setBusy(true);
    try {
      const restored = await linkDeviceByCode(text);
      await reload();
      setText('');
      router.replace('/');
      showAlert('Tienda recuperada', `Se descargaron ${restored} registros. Las fotos y el logotipo no viajan en la nube: tendrás que volver a cargarlos.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Ya tengo mi tienda"
      footer={(
        <Pressable onPress={start} disabled={busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accentFg} />}
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy ? 'Recuperando…' : 'Recuperar mi tienda'}</Text>
        </Pressable>
      )}
    >
      {['Escribe o pega las 8 palabras de tu kit.', 'Toca Recuperar mi tienda.', 'Espera a que se descargue tu tienda.'].map((line, i) => (
        <View key={line} style={s.step}>
          <View style={[s.num, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontWeight: '800' }}>{i + 1}</Text></View>
          <Text style={{ color: t.fg, flex: 1, marginLeft: space.md }}>{line}</Text>
        </View>
      ))}
      <Text style={[s.label, { color: t.muted }]}>TU KIT DE RECUPERACIÓN</Text>
      <TextInput
        value={text}
        onChangeText={(value) => { setText(value); setError(null); }}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="1. palabra  2. palabra  3. palabra …"
        placeholderTextColor={t.muted}
        style={[s.input, { color: t.fg, borderColor: error ? t.danger : t.line, backgroundColor: t.panel }]}
      />
      {error ? <Text style={{ color: t.dangerText, marginTop: space.md, fontWeight: '700' }}>{error}</Text> : null}
      <Text style={{ color: t.faint, fontSize: 12, marginTop: space.md }}>
        También sirve el código largo de 16 caracteres de versiones anteriores. Puedes pegar el kit completo de una vez.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 18, minHeight: 140, textAlignVertical: 'top' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52 },
});
