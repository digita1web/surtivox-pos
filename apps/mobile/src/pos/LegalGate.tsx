import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDb } from '../db';
import { recordAcceptance, recordCatalogChoice, type GateStep } from '../legal';
import { CATALOG_NOTICE, LEGAL_CONTACT, PRIVACY_SECTIONS, TERMS_SECTIONS } from '../legalText';
import { useTheme, space, radius } from '../theme';
import { showAlert } from './alert';
import { LegalDoc } from './LegalDoc';

type Doc = 'terms' | 'privacy';

export function LegalGate({ steps, onDone }: { steps: GateStep[]; onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const step = steps[index];

  const advance = () => {
    if (index + 1 < steps.length) setIndex(index + 1);
    else onDone();
  };

  const accept = async () => {
    if (!checked || busy) return;
    setBusy(true);
    try {
      await recordAcceptance(getDb(), Date.now());
      advance();
    } catch (e) {
      showAlert('No se pudo guardar tu aceptación', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = async (optIn: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await recordCatalogChoice(getDb(), optIn);
      advance();
    } catch (e) {
      showAlert('No se pudo guardar tu respuesta', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const link = (label: string, target: Doc) => (
    <Text accessibilityRole="link" onPress={() => setDoc(target)} style={{ color: t.accent, fontWeight: '800', textDecorationLine: 'underline' }}>
      {label}
    </Text>
  );

  const choiceStyle = [s.choice, { borderColor: t.accent, backgroundColor: t.panel, opacity: busy ? 0.6 : 1 }];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 24, paddingBottom: insets.bottom + 32, flexGrow: 1 }}>
        {step === 'terms' ? (
          <>
            <View style={[s.badge, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={30} color={t.accent} />
            </View>
            <Text style={[s.title, { color: t.fg }]}>Bienvenido a Surtivox POS</Text>
            <View style={{ marginTop: space.lg, gap: space.md }}>
              <Text style={[s.line, { color: t.fg }]}>
                • Tus ventas, productos y clientes se guardan <Text style={{ fontWeight: '800' }}>en tu teléfono</Text>. No salen de él a menos que tú actives el respaldo en la nube.
              </Text>
              <Text style={[s.line, { color: t.fg }]}>• Puedes usar la app sin internet y sin crear una cuenta.</Text>
            </View>

            <Pressable
              onPress={() => setChecked((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={[s.checkRow, { borderColor: checked ? t.accent : t.line, backgroundColor: t.panel }]}
            >
              <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={26} color={checked ? t.accent : t.muted} />
              <Text style={[s.checkText, { color: t.fg }]}>
                He leído y acepto los {link('Términos y Condiciones', 'terms')} y el {link('Aviso de Privacidad', 'privacy')}.
              </Text>
            </Pressable>

            <Pressable
              onPress={accept}
              disabled={!checked || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !checked || busy }}
              style={[s.primary, { backgroundColor: t.accent, opacity: checked && !busy ? 1 : 0.4 }]}
            >
              {busy ? <ActivityIndicator color={t.accentFg} /> : <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Aceptar y continuar</Text>}
            </Pressable>

            <Text style={[s.small, { color: t.fg }]}>Si no aceptas, no podrás usar la app.</Text>
            <Text style={[s.small, { color: t.fg, marginTop: space.md }]}>
              Responsable: Mateo Castro (Surtivox POS) · {LEGAL_CONTACT}
            </Text>
          </>
        ) : (
          <>
            <View style={[s.badge, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="people-outline" size={30} color={t.accent} />
            </View>
            <Text style={[s.title, { color: t.fg }]}>{CATALOG_NOTICE.title}</Text>
            <View style={{ marginTop: space.lg, gap: space.md }}>
              {CATALOG_NOTICE.body.map((paragraph) => (
                <Text key={paragraph} style={[s.line, { color: t.fg }]}>{paragraph}</Text>
              ))}
            </View>
            <Text style={[s.small, { color: t.fg, marginTop: space.lg, textAlign: 'left' }]}>{CATALOG_NOTICE.rights}</Text>
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
              <Pressable onPress={() => { void choose(true); }} disabled={busy} accessibilityRole="button" style={choiceStyle}>
                <Text style={[s.choiceText, { color: t.fg }]}>{CATALOG_NOTICE.yes}</Text>
              </Pressable>
              <Pressable onPress={() => { void choose(false); }} disabled={busy} accessibilityRole="button" style={choiceStyle}>
                <Text style={[s.choiceText, { color: t.fg }]}>{CATALOG_NOTICE.no}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={doc !== null} animationType="slide" onRequestClose={() => setDoc(null)}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <View style={[s.docHeader, { paddingTop: insets.top + 12, borderColor: t.line, backgroundColor: t.panel }]}>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 18, flex: 1 }}>
              {doc === 'terms' ? 'Términos y Condiciones' : 'Aviso de Privacidad'}
            </Text>
            <Pressable onPress={() => setDoc(null)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
              <Ionicons name="close" size={28} color={t.fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>
            <LegalDoc sections={doc === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: space.lg, lineHeight: 34 },
  line: { fontSize: 16, lineHeight: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginTop: space.xl },
  checkText: { flex: 1, fontSize: 15, lineHeight: 22 },
  primary: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingVertical: 16, marginTop: space.lg },
  small: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: space.md },
  choice: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 8, minHeight: 56 },
  choiceText: { fontWeight: '800', fontSize: 16, textAlign: 'center' },
  docHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
});
