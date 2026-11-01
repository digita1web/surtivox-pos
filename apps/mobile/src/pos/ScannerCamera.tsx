import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { getLocalSetting, setLocalSetting } from '../repos';
import { useTheme } from '../theme';
import {
  initialCameraState,
  reduceCamera,
  type CameraEvent,
} from './cameraMachine';

interface ScannerCameraProps {
  paused: boolean;
  torch: boolean;
  onTorchChange: (value: boolean) => void;
  onScan: (result: BarcodeScanningResult) => void;
}

export function ScannerCamera({ paused, torch, onTorchChange, onScan }: ScannerCameraProps) {
  const t = useTheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [state, setState] = useState(() => initialCameraState(AppState.currentState === 'active'));
  const requested = useRef(false);
  const countedAttempt = useRef(0);

  const dispatch = useCallback((event: CameraEvent) => {
    setState((current) => reduceCamera(current, event));
  }, []);

  useFocusEffect(useCallback(() => {
    dispatch({ type: 'focus' });
    void getPermission();
    return () => dispatch({ type: 'blur' });
  }, [dispatch, getPermission]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      dispatch({ type: next === 'active' ? 'appActive' : 'appBackground' });
      if (next === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [dispatch, getPermission]);

  useEffect(() => {
    if (!permission) return;
    const value = permission.granted
      ? 'granted'
      : permission.status === 'undetermined'
        ? 'unknown'
        : permission.canAskAgain
          ? 'denied'
          : 'blocked';
    dispatch({ type: 'permission', value });
    if (permission.status === 'undetermined' && !requested.current) {
      requested.current = true;
      void requestPermission();
    }
  }, [dispatch, permission, requestPermission]);

  useEffect(() => {
    onTorchChange(false);
  }, [state.attempt, onTorchChange]);

  useEffect(() => {
    if (state.phase !== 'starting' && state.phase !== 'retrying') return;
    const timer = setTimeout(() => dispatch({ type: 'timeout' }), 3000);
    return () => clearTimeout(timer);
  }, [dispatch, state.attempt, state.phase]);

  useEffect(() => {
    if (state.phase !== 'retrying' || state.attempt === countedAttempt.current) return;
    countedAttempt.current = state.attempt;
    void getLocalSetting('camera_restarts')
      .then((value) => {
        const count = Number(value);
        return setLocalSetting('camera_restarts', String((Number.isFinite(count) ? count : 0) + 1));
      })
      .catch(() => {});
  }, [state.attempt, state.phase]);

  const mounted = state.permission === 'granted'
    && (state.phase === 'starting' || state.phase === 'retrying' || state.phase === 'ready');
  const starting = state.phase === 'starting' || state.phase === 'retrying' || (!permission && state.phase === 'idle');
  const failed = state.phase === 'failed';
  const denied = state.phase === 'denied';
  const blocked = state.phase === 'blocked';

  const action = failed
    ? { label: 'Reintentar', run: () => dispatch({ type: 'retry' }) }
    : denied
      ? { label: 'Permitir', run: () => { void requestPermission(); } }
      : blocked
        ? { label: 'Abrir ajustes', run: () => { void Linking.openSettings().catch(() => {}); } }
        : null;

  const message = failed
    ? 'No se pudo iniciar la cámara'
    : denied
      ? 'Necesitamos permiso para usar la cámara'
      : blocked
        ? 'La cámara está bloqueada en los ajustes del teléfono'
        : starting
          ? 'Iniciando cámara…'
          : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {mounted ? (
        <CameraView
          key={state.attempt}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          onCameraReady={() => dispatch({ type: 'ready' })}
          onMountError={() => dispatch({ type: 'error' })}
          onBarcodeScanned={paused ? undefined : onScan}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'] }}
        />
      ) : null}
      {message ? (
        <View style={[s.status, { backgroundColor: 'rgba(0,0,0,0.78)' }]}>
          <Text style={s.message} numberOfLines={1}>{message}</Text>
          {action ? (
            <Pressable onPress={action.run} style={[s.action, { backgroundColor: t.accent }]} accessibilityLabel={action.label}>
              <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 12 }}>{action.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  status: { position: 'absolute', left: 12, right: 12, bottom: 58, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { color: '#fff', flex: 1, fontSize: 12, fontWeight: '700' },
  action: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
});
