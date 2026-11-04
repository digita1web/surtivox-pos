import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { radius } from '../theme';

export const PROMO_LABEL = 'Más ventas para tu negocio';

export function PromoCard({ width, height }: { width: number; height: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={PROMO_LABEL} style={[s.card, { width, height }]}>
      <Image source={require('../../assets/promo/mas-ventas.webp')} style={s.image} contentFit="cover" cachePolicy="memory-disk" />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.xxl, overflow: 'hidden', backgroundColor: '#FAFBF6' },
  image: { width: '100%', height: '100%' },
});
