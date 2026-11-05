import { useState } from 'react';
import { View, Text, Pressable, Modal, Share, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { recoveryShareMessage } from '../recoveryCode';
import { useTheme, radius, space } from '../theme';

export function RecoveryCodeSheet({ visible, code, storeName, onDone }: {
  visible: boolean;
  code: string;
  storeName: string;
  onDone: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);

  const share = () => { void Share.share({ message: recoveryShareMessage(storeName, code) }).catch(() => {}); };
  const finish = () => {
    if (!saved) return;
    setSaved(false);
    onDone();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}>
          <View style={[s.badge, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="key-outline" size={30} color={t.accent} />
          </View>
          <Text style={[s.title, { color: t.fg }]}>Guarda tu código de recuperación</Text>
          <Text style={[s.body, { color: t.fg }]}>
            Si algún día olvidas tu PIN de propietario, este código es la <Text style={{ fontWeight: '800' }}>única forma</Text> de volver a entrar.
          </Text>

          <View style={[s.codeBox, { backgroundColor: t.panel, borderColor: t.accent }]}>
            <Text selectable accessibilityLabel={`Código de recuperación: ${code.split('').join(' ')}`} style={[s.code, { color: t.fg }]}>{code}</Text>
          </View>

          <Pressable onPress={share} accessibilityRole="button" style={[s.share, { borderColor: t.accent }]}>
            <Ionicons name="share-outline" size={18} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '800', marginLeft: 8 }}>Copiar o compartir</Text>
          </Pressable>

          <View style={[s.warn, { backgroundColor: t.accentSoft }]}>
            <Text style={{ color: t.fg, fontSize: 13.5, lineHeight: 20 }}>
              • No se mostrará de nuevo.{'\n'}
              • Anótalo en papel o guárdalo en un lugar seguro, fuera de este teléfono.{'\n'}
              • No lo compartas: quien lo tenga puede cambiar el PIN del propietario.
            </Text>
          </View>

          <Pressable
            onPress={() => setSaved((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: saved }}
            style={[s.check, { borderColor: saved ? t.accent : t.line, backgroundColor: t.panel }]}
          >
            <Ionicons name={saved ? 'checkbox' : 'square-outline'} size={26} color={saved ? t.accent : t.muted} />
            <Text style={{ color: t.fg, flex: 1, marginLeft: 12, fontSize: 15 }}>Ya guardé mi código en un lugar seguro</Text>
          </Pressable>

          <Pressable
            onPress={finish}
            disabled={!saved}
            accessibilityRole="button"
            accessibilityState={{ disabled: !saved }}
            style={[s.primary, { backgroundColor: t.accent, opacity: saved ? 1 : 0.4 }]}
          >
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Continuar</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  badge: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: space.lg, lineHeight: 31 },
  body: { fontSize: 15.5, lineHeight: 23, textAlign: 'center', marginTop: space.md },
  codeBox: { borderWidth: 2, borderRadius: radius.lg, paddingVertical: 22, paddingHorizontal: 12, marginTop: space.xl, alignItems: 'center' },
  code: { fontFamily: 'monospace', fontSize: 24, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: radius.lg, paddingVertical: 14, marginTop: space.md },
  warn: { borderRadius: radius.lg, padding: space.lg, marginTop: space.lg },
  check: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  primary: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingVertical: 16, marginTop: space.lg },
});
