import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { linkDeviceByCode } from '../sync';
import { showAlert } from './alert';
import { useTheme, space, radius } from '../theme';

export function useRecover(onRecovered: (restored: number) => Promise<void> | void) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const restored = await linkDeviceByCode(text);
      setText('');
      await onRecovered(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (busy) return;
    if (!text.trim()) { setError('Escribe o pega las 8 palabras de tu kit.'); return; }
    setError(null);
    showAlert('¿Recuperar esta tienda?', 'Esto REEMPLAZA todos los datos de este teléfono con los de tu tienda en la nube. Antes se guarda una copia de seguridad de lo que hay ahora.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Recuperar', style: 'destructive', onPress: () => { void run(); } },
    ]);
  };

  const change = (value: string) => { setText(value); setError(null); };

  return { text, change, busy, error, start };
}

export type RecoverState = ReturnType<typeof useRecover>;

export function RecoverBody({ state }: { state: RecoverState }) {
  const t = useTheme();
  return (
    <>
      {['Escribe o pega las 8 palabras de tu kit.', 'Toca Recuperar mi tienda.', 'Espera a que se descargue tu tienda.'].map((line, i) => (
        <View key={line} style={s.step}>
          <View style={[s.num, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontWeight: '800' }}>{i + 1}</Text></View>
          <Text style={{ color: t.fg, flex: 1, marginLeft: space.md }}>{line}</Text>
        </View>
      ))}
      <Text style={[s.label, { color: t.muted }]}>TU KIT DE RECUPERACIÓN</Text>
      <TextInput
        value={state.text}
        onChangeText={state.change}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="1. palabra  2. palabra  3. palabra …"
        placeholderTextColor={t.muted}
        style={[s.input, { color: t.fg, borderColor: state.error ? t.danger : t.line, backgroundColor: t.panel }]}
      />
      {state.error ? <Text style={{ color: t.dangerText, marginTop: space.md, fontWeight: '700' }}>{state.error}</Text> : null}
      <Text style={{ color: t.faint, fontSize: 12, marginTop: space.md }}>
        También sirve el código largo de 16 caracteres de versiones anteriores. Puedes pegar el kit completo de una vez.
      </Text>
    </>
  );
}

export function RecoverButton({ state }: { state: RecoverState }) {
  const t = useTheme();
  return (
    <Pressable onPress={state.start} disabled={state.busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: state.busy ? 0.6 : 1 }]}>
      {state.busy ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accentFg} />}
      <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{state.busy ? 'Recuperando…' : 'Recuperar mi tienda'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 18, minHeight: 140, textAlignVertical: 'top' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52 },
});
