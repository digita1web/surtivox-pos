import { View, Text } from 'react-native';
import { useTheme, space } from '../theme';
import type { LegalSection } from '../legalText';

export function LegalDoc({ sections }: { sections: readonly LegalSection[] }) {
  const t = useTheme();
  return (
    <View>
      {sections.map((section) => (
        <View key={section.title} style={{ marginBottom: space.lg }}>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 15, marginBottom: 4 }}>{section.title}</Text>
          <Text selectable style={{ color: t.fg, fontSize: 14, lineHeight: 21 }}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}
