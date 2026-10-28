import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, radius } from '../theme';
import { markFirstRunGuideSeen } from '../localFlags';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'cube-outline', title: 'Agrega tu producto', text: 'En Productos toca Agregar producto. Si no tiene código de barras, usa Generar código.' },
  { icon: 'scan-outline', title: 'Escanea y cobra', text: 'Abre Escanear, suma artículos al carrito y toca Cobrar para registrar la venta.' },
  { icon: 'bar-chart-outline', title: 'Revisa tus ventas', text: 'En Ventas o Reportes consulta lo que vendiste y el efectivo del día.' },
];

export function FirstRunGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const item = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const close = async () => {
    await markFirstRunGuideSeen();
    setStep(0);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          <View style={s.head}>
            <Text style={[s.kicker, { color: t.muted }]}>GUÍA RÁPIDA · {step + 1} DE {STEPS.length}</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={{ color: t.muted, fontWeight: '700' }}>Omitir</Text>
            </Pressable>
          </View>
          <View style={[s.iconWrap, { backgroundColor: t.accentSoft }]}>
            <Ionicons name={item.icon} size={34} color={t.accent} />
          </View>
          <Text style={[s.title, { color: t.fg }]}>{item.title}</Text>
          <Text style={[s.text, { color: t.muted }]}>{item.text}</Text>
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[s.dot, { backgroundColor: i === step ? t.accent : t.line }]} />
            ))}
          </View>
          <Pressable onPress={() => { if (last) close(); else setStep((v) => v + 1); }} style={[s.primary, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>{last ? 'Empezar a vender' : 'Siguiente'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', borderWidth: 1, borderRadius: radius.xl, padding: 22 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 16 },
  text: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  primary: { borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
});
