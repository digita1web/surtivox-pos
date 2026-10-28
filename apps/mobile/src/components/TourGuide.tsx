import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markFirstRunGuideSeen } from '../localFlags';
import { TAB_BAR_HEIGHT, radius, useTheme } from '../theme';
import { useTourTargets, type TourTarget } from './tourTargets';

interface Step {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  target?: TourTarget;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OVERLAY = 'rgba(4,8,12,0.82)';
const CARD = '#101820';

const STEPS: Step[] = [
  {
    icon: 'cube-outline',
    title: 'Tu catálogo',
    text: 'Aquí vive tu inventario. Puedes agregar productos a mano, escanear su código de barras o cargar nuestro catálogo de ejemplo.',
    target: 'products',
  },
  {
    icon: 'cart-outline',
    title: 'Cobra en segundos',
    text: 'Así de fácil es cobrar. Selecciona productos, elige si es Efectivo, Nequi, Daviplata o Fiado, y la app calcula el cambio por ti.',
    target: 'home',
  },
  {
    icon: 'book-outline',
    title: 'Fiados bajo control',
    text: '¿Te deben plata? Lleva el control de los fiados y envíales un recordatorio directo a su WhatsApp con un solo toque.',
    target: 'more',
  },
  {
    icon: 'checkmark-circle-outline',
    title: '¡Todo listo!',
    text: '¡Todo listo para empezar a vender! Surtivox POS funciona incluso sin internet. Toca aquí para empezar.',
  },
];

export function TourGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const targets = useTourTargets((state) => state.targets);
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(1)).current;
  const closing = useRef(false);
  const item = STEPS[step]!;
  const last = step === STEPS.length - 1;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [progress, step]);

  const rawTarget = item.target;
  const measured = rawTarget ? targets[rawTarget] : undefined;
  let rect: Rect | null = null;
  if (measured) {
    const padX = 18;
    rect = {
      x: measured.x - padX,
      y: measured.y - 9,
      width: measured.width + padX * 2,
      height: measured.height + 38,
    };
  } else if (rawTarget) {
    const tabWidth = width / 5;
    const index = rawTarget === 'home' ? 0 : rawTarget === 'products' ? 1 : 4;
    const targetWidth = Math.min(64, tabWidth - 12);
    rect = {
      x: tabWidth * index + (tabWidth - targetWidth) / 2,
      y: height - (TAB_BAR_HEIGHT + insets.bottom) + 6,
      width: targetWidth,
      height: 50,
    };
  }

  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    await markFirstRunGuideSeen();
    closing.current = false;
    setStep(0);
    onClose();
  };

  const next = () => {
    if (last) void close();
    else setStep((value) => value + 1);
  };

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const cardWidth = Math.min(width - 40, 420);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => { void close(); }}>
      <View style={s.root}>
        {rect ? (
          <>
            <View pointerEvents="none" style={[s.shade, { left: 0, top: 0, width, height: rect.y }]} />
            <View pointerEvents="none" style={[s.shade, { left: 0, top: rect.y + rect.height, width, height: height - rect.y - rect.height }]} />
            <View pointerEvents="none" style={[s.shade, { left: 0, top: rect.y, width: rect.x, height: rect.height }]} />
            <View pointerEvents="none" style={[s.shade, { left: rect.x + rect.width, top: rect.y, width: width - rect.x - rect.width, height: rect.height }]} />
            <View
              pointerEvents="none"
              style={[s.ring, {
                left: rect.x - 5,
                top: rect.y - 5,
                width: rect.width + 10,
                height: rect.height + 10,
                borderColor: t.accent,
                boxShadow: '0 0 0 6px rgba(25,184,142,0.22)',
              }]}
            />
          </>
        ) : (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY }]} />
        )}

        <Pressable onPress={() => { void close(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Saltar tour" style={[s.skip, { top: insets.top + 16 }]}>
          <Text style={s.skipText}>Saltar</Text>
        </Pressable>

        <Animated.View
          style={[
            s.tooltipWrap,
            rect ? { bottom: height - rect.y + 16 } : { top: 0, bottom: 0, justifyContent: 'center' },
            { opacity: progress, transform: [{ translateY }] },
          ]}
        >
          <View style={[s.card, { width: cardWidth, borderColor: 'rgba(255,255,255,0.12)' }]}>
            <View style={s.head}>
              <Text style={s.kicker}>PASO {step + 1} DE {STEPS.length}</Text>
              <View style={s.dots}>
                {STEPS.map((_, index) => (
                  <View key={index} style={[s.dot, { backgroundColor: index === step ? t.accent : 'rgba(255,255,255,0.22)' }]} />
                ))}
              </View>
            </View>

            <View style={[s.iconWrap, { backgroundColor: t.accent }]}>
              <Ionicons name={item.icon} size={24} color={t.accentFg} />
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.text}>{item.text}</Text>

            <View style={s.footer}>
              {step > 0 && (
                <Pressable onPress={() => setStep((value) => value - 1)} style={({ pressed }) => [s.secondary, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
                  <Text style={s.secondaryText}>Anterior</Text>
                </Pressable>
              )}
              <Pressable onPress={next} style={({ pressed }) => [s.primary, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]} accessibilityRole="button">
                <Text style={[s.primaryText, { color: t.accentFg }]}>{last ? 'Ir a mi tienda' : 'Siguiente'}</Text>
                {!last && <Ionicons name="arrow-forward" size={18} color={t.accentFg} style={{ marginLeft: 8 }} />}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  shade: { position: 'absolute', backgroundColor: OVERLAY },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: 20 },
  skip: { position: 'absolute', right: 20, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)' },
  skipText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  tooltipWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: 20, backgroundColor: CARD, boxShadow: '0 18px 44px rgba(0,0,0,0.45)' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: '#aeb8c4', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  iconWrap: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  text: { color: '#d6dde7', fontSize: 15, lineHeight: 22, marginTop: 7 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 20 },
  secondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  primary: { flex: 1, flexDirection: 'row', borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontWeight: '800', fontSize: 15 },
});
