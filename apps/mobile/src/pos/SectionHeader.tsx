import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, brandType, radius, space } from '../theme';

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={s.row}>
      <View style={s.titleRow}>
        <View style={[s.bar, { backgroundColor: t.accentBright }]} />
        <Text style={[brandType.section, { color: t.fg, flexShrink: 1 }]} numberOfLines={2} maxFontSizeMultiplier={1.25} accessibilityRole="header">{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={[s.action, { backgroundColor: t.accentSoft }]}>
          <Text style={{ color: t.accent, fontWeight: '800', fontSize: 14 }} maxFontSizeMultiplier={1.3}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={t.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  bar: { width: 5, height: 28, borderRadius: 3 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.pill, paddingLeft: 14, paddingRight: 8, paddingVertical: 8, minHeight: 36 },
});
