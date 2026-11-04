import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, brandType, circle, radius, space } from '../theme';
import { Thumb } from './Thumb';

export function FrequentProductCard({ name, category, imageUri, price, qty, width, photoHeight, plusSize, onAdd }: {
  name: string;
  category?: string | null;
  imageUri: string | null | undefined;
  price: string;
  qty: number;
  width: number;
  photoHeight: number;
  plusSize: number;
  onAdd: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[s.card, { width, backgroundColor: t.panel, boxShadow: t.shadowCard, borderColor: qty > 0 ? t.accent : 'transparent' }]}>
      <View style={[s.photo, { height: photoHeight, backgroundColor: t.accentSoft }]}>
        <Thumb uri={imageUri} name={name} category={category} fit="cover" style={s.photoFill} textSize={22} />
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${name}`}
          hitSlop={6}
          style={[circle(plusSize), s.plus, { backgroundColor: t.accent, borderColor: t.panel, boxShadow: t.shadow }]}
        >
          {qty > 0
            ? <Text style={{ color: t.accentFg, fontWeight: '900', fontSize: 16 }}>{qty}</Text>
            : <Ionicons name="add" size={Math.round(plusSize * 0.62)} color={t.accentFg} />}
        </Pressable>
      </View>
      <Text style={[brandType.productName, { color: t.fg, marginTop: space.sm }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{name}</Text>
      <Text style={[brandType.price, { color: t.accent, marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>{price}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 10, borderWidth: 2 },
  photo: { borderRadius: radius.lg, overflow: 'hidden' },
  photoFill: { width: '100%', height: '100%' },
  plus: { position: 'absolute', right: 6, bottom: 6, borderWidth: 3 },
});
