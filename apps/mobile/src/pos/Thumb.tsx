import { useState } from 'react';
import { View, Text, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { categoryImageFor } from './categoryImages';
import { tileColor, initials } from '../theme';

export function Thumb({ uri, name, category, style, textSize = 22 }: {
  uri: string | null | undefined;
  name: string;
  category?: string | null;
  style: StyleProp<ViewStyle>;
  textSize?: number;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri && uri !== failedUri) {
    return (
      <Image
        source={uri}
        style={[style as ImageStyle, { backgroundColor: '#ffffff' }]}
        contentFit="contain"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onError={() => setFailedUri(uri)}
      />
    );
  }
  const categoryImage = categoryImageFor(category);
  if (categoryImage) {
    return (
      <Image
        source={categoryImage}
        style={style as ImageStyle}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={category}
      />
    );
  }
  return (
    <View style={[style, { backgroundColor: tileColor(name), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: textSize }}>{initials(name)}</Text>
    </View>
  );
}
