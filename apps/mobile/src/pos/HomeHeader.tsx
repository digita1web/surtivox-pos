import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandTagline, splitBrandName } from '../brandName';
import { useTheme, space, brandType, circle } from '../theme';
import { IconButton } from './Screen';
import { homeMetrics } from './homeLayout';

const WAVE = 34;

export function HomeHeader({ name, tagline, logoUri, dark, onToggleTheme, onSearch, onScan }: {
  name: string;
  tagline?: string | null;
  logoUri?: string | null;
  dark: boolean;
  onToggleTheme: () => void;
  onSearch: () => void;
  onScan: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const m = homeMetrics(width, fontScale);
  const brand = splitBrandName(name);
  const slogan = brandTagline(tagline);

  return (
    <View style={[s.root, { backgroundColor: t.hero, paddingTop: insets.top + space.sm, paddingBottom: WAVE + space.sm }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[s.blob, { width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, left: -width * 0.45, top: -width * 0.62, backgroundColor: t.heroGlow, opacity: 0.6 }]} />
        <View style={[s.blob, { width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, right: -width * 0.3, top: -width * 0.35, backgroundColor: t.heroShade, opacity: 0.55 }]} />
        <View style={[s.blob, { width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, left: width * 0.3, bottom: -width * 0.5, backgroundColor: t.heroGlow, opacity: 0.35 }]} />
        <View style={[s.swoosh, { backgroundColor: t.mango, width: width * 1.3, left: -width * 0.32 }]} />
        <View style={[s.wave, { backgroundColor: t.bg, width: width * 1.3, left: -width * 0.15 }]} />
      </View>

      <View style={[s.row, { paddingHorizontal: m.pad }]}>
        {logoUri ? (
          <View style={[circle(m.headerLogo), s.logo, { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.7)' }]}>
            <Image source={{ uri: logoUri }} style={s.logoImage} contentFit="cover" accessibilityLabel={`Logotipo de ${name}`} />
          </View>
        ) : (
          <Ionicons name="storefront" size={Math.round(m.headerLogo * 0.95)} color="#FFFFFF" accessibilityLabel={`Logotipo de ${name}`} />
        )}

        <View style={s.nameCol}>
          <Text
            style={[brandType.brand, { fontSize: m.brandSize, lineHeight: Math.round(m.brandSize * 1.1), color: '#FFFFFF' }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={1.15}
            accessibilityRole="header"
          >
            {brand.lead}
            {brand.accent ? <Text style={{ color: t.sun }}>{`\n${brand.accent}`}</Text> : null}
          </Text>
        </View>

        <View style={[s.rightCol, { width: m.headerRight }]}>
          <View style={s.buttons}>
            <IconButton icon={dark ? 'sunny' : 'moon'} label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} variant="onBrand" size={m.headerButton} onPress={onToggleTheme} />
            <IconButton icon="search" label="Buscar productos" variant="onBrand" size={m.headerButton} onPress={onSearch} />
            <IconButton icon="scan-outline" label="Escanear código de barras" variant="onBrand" size={m.headerButton} onPress={onScan} />
          </View>
          <Text style={[brandType.slogan, s.slogan]} numberOfLines={2} maxFontSizeMultiplier={1.15}>{slogan}</Text>
          <View style={[s.sloganLine, { backgroundColor: t.mango }]} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { overflow: 'hidden' },
  blob: { position: 'absolute' },
  swoosh: { position: 'absolute', bottom: -WAVE * 0.9, height: WAVE * 2.4, borderRadius: '50%', transform: [{ rotate: '-4.5deg' }] },
  wave: { position: 'absolute', bottom: -WAVE * 1.4, height: WAVE * 2.4, borderRadius: '50%', transform: [{ rotate: '-2.5deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { borderWidth: 2, overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  nameCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  rightCol: { alignItems: 'flex-end', flexShrink: 0 },
  buttons: { flexDirection: 'row', gap: space.sm },
  slogan: { color: '#FFFFFF', textAlign: 'right', marginTop: space.sm, maxWidth: 112 },
  sloganLine: { height: 3, width: 72, borderRadius: 2, marginTop: 4 },
});
