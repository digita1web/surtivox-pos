import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppearance } from '../appearance';
import { APPEARANCE_OPTIONS, FROM_OPTIONS, UNTIL_OPTIONS, formatHour, scheduleSummary, type Appearance } from '../themeMode';
import { useTheme, circle, radius, space } from '../theme';

const ICONS: Record<Appearance, keyof typeof Ionicons.glyphMap> = {
  light: 'sunny-outline',
  dark: 'moon-outline',
  auto: 'time-outline',
  system: 'phone-portrait-outline',
};

export function AppearanceCard() {
  const t = useTheme();
  const mode = useAppearance((state) => state.mode);
  const schedule = useAppearance((state) => state.schedule);
  const resolved = useAppearance((state) => state.resolved);
  const setMode = useAppearance((state) => state.setMode);
  const setSchedule = useAppearance((state) => state.setSchedule);

  const hourChip = (hour: number, selected: boolean, onPress: () => void) => (
    <Pressable
      key={hour}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[s.chip, { backgroundColor: selected ? t.accent : t.surfaceAlt, borderColor: selected ? t.accent : t.line }]}
    >
      <Text style={{ color: selected ? t.accentFg : t.fg, fontWeight: '700', fontSize: 12.5 }}>{formatHour(hour)}</Text>
    </Pressable>
  );

  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
      {APPEARANCE_OPTIONS.map((option, index) => {
        const on = option.key === mode;
        return (
          <Pressable
            key={option.key}
            onPress={() => { void setMode(option.key); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${option.label}. ${option.hint}`}
            style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }]}
          >
            <View style={[circle(38), { backgroundColor: on ? t.accent : t.accentSoft }]}>
              <Ionicons name={ICONS[option.key]} size={19} color={on ? t.accentFg : t.accent} />
            </View>
            <View style={s.text}>
              <Text style={{ color: t.fg, fontWeight: '800' }}>{option.label}</Text>
              <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>{option.hint}</Text>
            </View>
            <View style={[s.radio, { borderColor: on ? t.accent : t.line }]}>
              {on ? <View style={[s.radioDot, { backgroundColor: t.accent }]} /> : null}
            </View>
          </Pressable>
        );
      })}

      {mode === 'auto' ? (
        <View style={[s.schedule, { borderTopColor: t.line }]}>
          <Text style={{ color: t.fg, fontWeight: '700' }}>{scheduleSummary(schedule)}</Text>
          <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>
            Ahora la app está en modo {resolved === 'dark' ? 'oscuro' : 'claro'}.
          </Text>
          <Text style={[s.label, { color: t.muted }]}>Empieza a las</Text>
          <View style={s.chips}>
            {FROM_OPTIONS.map((hour) => hourChip(hour, hour === schedule.from, () => { void setSchedule({ ...schedule, from: hour }); }))}
          </View>
          <Text style={[s.label, { color: t.muted }]}>Termina a las</Text>
          <View style={s.chips}>
            {UNTIL_OPTIONS.map((hour) => hourChip(hour, hour === schedule.until, () => { void setSchedule({ ...schedule, until: hour }); }))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 60 },
  text: { flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  schedule: { borderTopWidth: StyleSheet.hairlineWidth, padding: space.lg },
  label: { fontSize: 12, fontWeight: '700', marginTop: space.md, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
});
