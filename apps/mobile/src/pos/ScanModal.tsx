import { useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type BarcodeScanningResult } from 'expo-camera';
import { space, radius } from '../theme';
import { ScannerCamera } from './ScannerCamera';

const ignoreTorch = () => {};

/**
 * Full-screen camera that reads one barcode and hands it back. Shared by any
 * screen that needs a quick scan (e.g. Add product), separate from the Scan tab
 * which runs a continuous sell/restock loop.
 */
export function ScanModal({ visible, onClose, onScan }: {
  visible: boolean; onClose: () => void; onScan: (code: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const last = useRef(0);

  const handle = (r: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - last.current < 1200) return; // ignore the rapid repeat scans the camera emits
    last.current = now;
    const code = r.data.trim();
    if (code) { onScan(code); onClose(); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.root}>
        <ScannerCamera paused={false} torch={false} onTorchChange={ignoreTorch} onScan={handle} />
        <View style={[st.label, { top: insets.top + 70 }]} pointerEvents="none">
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Escanea un código de barras</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>Apunta la cámara al código del producto</Text>
        </View>
        <View style={st.reticle} pointerEvents="none" />
        <Pressable onPress={onClose} hitSlop={12} style={[st.close, { top: insets.top + 10 }]}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  label: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  reticle: { position: 'absolute', alignSelf: 'center', top: '34%', width: '70%', aspectRatio: 1.4, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: radius.lg },
  close: { position: 'absolute', right: space.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
