import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { checkForUpdate, dismissUpdateNotice } from '../updateCheck';
import type { UpdateNotice } from '../appUpdate';
import { useTheme, space, radius } from '../theme';

export function useUpdateNotice() {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    checkForUpdate().then((value) => { if (active) setNotice(value); }).catch(() => {});
    return () => { active = false; };
  }, []));

  const dismiss = useCallback(() => {
    if (!notice) return;
    const current = notice;
    setNotice(null);
    void dismissUpdateNotice(current).catch(() => {});
  }, [notice]);

  return { notice, dismiss };
}

export function UpdateNoticeCard({ notice, onDismiss }: { notice: UpdateNotice; onDismiss: () => void }) {
  const t = useTheme();
  const open = () => { void Linking.openURL(notice.apkUrl ?? notice.htmlUrl).catch(() => {}); };
  return (
    <View style={[s.card, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
      <View style={s.row}>
        <Ionicons name="arrow-down-circle-outline" size={22} color={t.accent} />
        <View style={s.text}>
          <Text style={{ color: t.fg, fontWeight: '800' }}>{`Hay una versión nueva (${notice.version})`}</Text>
          <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 1 }}>Puedes seguir usando la app mientras tanto.</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
          <Ionicons name="close" size={18} color={t.faint} />
        </Pressable>
      </View>
      <Pressable onPress={open} accessibilityRole="button" style={[s.button, { backgroundColor: t.accent }]}>
        <Text style={{ color: t.accentFg, fontWeight: '800' }}>Descargar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, marginHorizontal: space.sm },
  button: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 9, marginTop: space.sm },
});
