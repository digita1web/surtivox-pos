import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, KeyboardAvoidingView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hasRecovery, resetOwnerPin, type Staff } from '../repos';
import { NO_RECOVERY_MESSAGE, recoveryFailureMessage } from '../recoveryMessages';
import { validatePin } from '../staffRules';
import { RecoveryCodeSheet } from './RecoveryCodeSheet';
import { useTheme, radius, space } from '../theme';

export function ForgotPinSheet({ visible, storeId, storeName, owners, initialOwnerId, onClose, onRecovered }: {
  visible: boolean;
  storeId: string;
  storeName: string;
  owners: Staff[];
  initialOwnerId?: string;
  onClose: () => void;
  onRecovered: (owner: Staff) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [ownerId, setOwnerId] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshCode, setFreshCode] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setOwnerId(initialOwnerId && owners.some((o) => o.id === initialOwnerId) ? initialOwnerId : owners[0]?.id ?? '');
    setCode(''); setPin(''); setConfirm(''); setError(null); setFreshCode(null); setAvailable(null);
    hasRecovery(storeId).then(setAvailable).catch(() => setAvailable(false));
  }, [visible, storeId]);

  const owner = owners.find((o) => o.id === ownerId) ?? null;

  const submit = async () => {
    if (!owner || busy) return;
    const pinError = validatePin(pin, confirm);
    if (pinError) { setError(pinError); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await resetOwnerPin({ storeId, ownerId: owner.id, code, newPin: pin });
      if (result.status === 'ok') setFreshCode(result.newCode);
      else setError(recoveryFailureMessage(result, Date.now()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = [s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }];

  return (
    <>
      <Modal visible={visible && freshCode === null} animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ alignSelf: 'flex-start', padding: 4 }}>
              <Ionicons name="close" size={28} color={t.fg} />
            </Pressable>
            <Text style={[s.title, { color: t.fg }]}>Restablecer el PIN</Text>
            <Text style={[s.sub, { color: t.muted }]}>Usa tu código de recuperación de {storeName} para elegir un PIN nuevo.</Text>

            {available === false ? (
              <View style={[s.notice, { backgroundColor: t.accentSoft }]}>
                <Text style={{ color: t.fg, lineHeight: 21 }}>{NO_RECOVERY_MESSAGE}</Text>
              </View>
            ) : (
              <>
                {owners.length > 1 ? (
                  <>
                    <Text style={[s.label, { color: t.muted }]}>¿De quién es el PIN?</Text>
                    <View style={s.chips}>
                      {owners.map((o) => {
                        const on = o.id === ownerId;
                        return (
                          <Pressable key={o.id} onPress={() => setOwnerId(o.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                            style={[s.chip, { backgroundColor: on ? t.accent : t.surfaceAlt, borderColor: on ? t.accent : t.line }]}>
                            <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{o.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : owner ? (
                  <Text style={{ color: t.fg, fontWeight: '700', marginTop: space.lg }}>Cuenta: {owner.name}</Text>
                ) : null}

                <Text style={[s.label, { color: t.muted }]}>Código de recuperación</Text>
                <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={24}
                  placeholder="XXXX-XXXX-XXXX-XXXX" placeholderTextColor={t.muted} accessibilityLabel="Código de recuperación"
                  style={[...input, { letterSpacing: 1, fontFamily: 'monospace' }]} />

                <Text style={[s.label, { color: t.muted }]}>PIN nuevo (4 dígitos)</Text>
                <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4}
                  placeholder="••••" placeholderTextColor={t.muted} style={[...input, { letterSpacing: 8 }]} />
                <Text style={[s.label, { color: t.muted }]}>Confirmar PIN nuevo</Text>
                <TextInput value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4}
                  placeholder="••••" placeholderTextColor={t.muted} style={[...input, { letterSpacing: 8 }]} />

                {error ? <Text accessibilityLiveRegion="polite" style={{ color: t.dangerText, marginTop: space.lg, lineHeight: 20 }}>{error}</Text> : null}

                <Pressable onPress={submit} disabled={busy || !owner || code.trim().length === 0 || available === null}
                  accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy || !owner || code.trim().length === 0 ? 0.5 : 1 }]}>
                  {busy ? <ActivityIndicator color={t.accentFg} /> : <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Restablecer PIN</Text>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <RecoveryCodeSheet
        visible={visible && freshCode !== null}
        code={freshCode ?? ''}
        storeName={storeName}
        onDone={() => {
          const done = owner;
          setFreshCode(null);
          onClose();
          if (done) onRecovered(done);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', marginTop: space.md },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  notice: { borderRadius: radius.lg, padding: space.lg, marginTop: space.xl },
  primary: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingVertical: 16, marginTop: space.xl },
});
