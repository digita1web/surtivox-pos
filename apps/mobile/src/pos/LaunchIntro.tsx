import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const LOGO = require('../../assets/icon.png');

interface LaunchIntroProps {
  isReady: boolean;
  onFinish: () => void;
}

export function LaunchIntro({ isReady, onFinish }: LaunchIntroProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const halo = useRef(new Animated.Value(0.2)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitTranslate = useRef(new Animated.Value(0)).current;
  const entranceRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const readyRef = useRef(isReady);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    readyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 15,
        stiffness: 120,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]);

    entranceRef.current = entrance;
    entrance.start(({ finished }) => {
      if (!finished || readyRef.current) return;
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(halo, {
            toValue: 0.7,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(halo, {
            toValue: 0.2,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current = pulse;
      pulse.start();
    });

    return () => {
      entrance.stop();
      pulseRef.current?.stop();
    };
  }, [halo, opacity, scale]);

  useEffect(() => {
    if (!isReady) return;
    entranceRef.current?.stop();
    pulseRef.current?.stop();
    Animated.parallel([
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitTranslate, {
        toValue: -12,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || finishedRef.current) return;
      finishedRef.current = true;
      onFinishRef.current();
    });
  }, [exitOpacity, exitTranslate, isReady]);

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: exitOpacity, transform: [{ translateY: exitTranslate }] },
      ]}
    >
      <Animated.View style={[styles.halo, { opacity: halo, transform: [{ scale: halo }] }]} />
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <Animated.Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[styles.copy, { opacity }]}>
        <View style={styles.wordmark}>
          <Text style={styles.name}>Surtivox</Text>
          <Text style={styles.pos}>POS</Text>
        </View>
        <Text style={styles.tagline}>Tu tienda, sin enredos.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0E12',
    paddingHorizontal: 24,
  },
  halo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(15, 166, 120, 0.22)',
  },
  logoWrap: {
    padding: 10,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 241, 232, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 232, 0.12)',
  },
  logo: {
    width: 104,
    height: 104,
    borderRadius: 22,
  },
  copy: {
    alignItems: 'center',
    marginTop: 22,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  name: {
    color: '#F5F1E8',
    fontFamily: 'Arial Narrow',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  pos: {
    color: '#0FA678',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 5,
    color: '#9EAFA8',
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
