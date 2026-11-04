import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, brandType, circle, radius, space } from '../theme';

export type ActionTone = 'green' | 'orange';

export function ActionCard({ icon, title, hint, tone, iconSize, chevronSize, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  tone: ActionTone;
  iconSize: number;
  chevronSize: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const green = tone === 'green';
  const solid = green ? t.accent : t.orange;
  const glow = green ? t.accentBright : t.mango;
  const band = green ? t.accentBright : t.orange;
  const chevronBackground = green ? t.accentSoft : `${t.orange}33`;
  const chevronColor = green ? t.accent : t.warnText;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={({ pressed }) => [s.shell, { backgroundColor: t.panel, boxShadow: t.shadowCard, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={s.clip}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[s.glow, { backgroundColor: glow, opacity: 0.16 }]} />
          <View style={[s.bandBack, { backgroundColor: glow, opacity: 0.55 }]} />
          <View style={[s.band, { backgroundColor: band }]} />
        </View>
        <View style={s.row}>
          <View style={[circle(iconSize), { backgroundColor: solid, boxShadow: t.shadow }]}>
            <Ionicons name={icon} size={Math.round(iconSize * 0.52)} color="#FFFFFF" />
          </View>
          <View style={s.text}>
            <Text style={[brandType.cardTitle, { color: t.fg }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{title}</Text>
            <Text style={[brandType.cardHint, { color: t.muted, marginRight: chevronSize - 2 }]} numberOfLines={3} maxFontSizeMultiplier={1.3}>{hint}</Text>
          </View>
        </View>
        <View pointerEvents="none" style={[circle(chevronSize), s.chevron, { backgroundColor: chevronBackground }]}>
          <Ionicons name="chevron-forward" size={Math.round(chevronSize * 0.62)} color={chevronColor} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1, borderRadius: radius.xl },
  clip: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', paddingHorizontal: 10, paddingTop: space.md, paddingBottom: space.xl, minHeight: 124, justifyContent: 'center' },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -50, bottom: -60 },
  bandBack: { position: 'absolute', left: '-20%', width: '140%', height: 30, bottom: -16, borderRadius: '50%', transform: [{ rotate: '-4deg' }] },
  band: { position: 'absolute', left: '-10%', width: '130%', height: 28, bottom: -17, borderRadius: '50%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { flex: 1, minWidth: 0 },
  chevron: { position: 'absolute', right: space.sm, bottom: space.lg },
});
