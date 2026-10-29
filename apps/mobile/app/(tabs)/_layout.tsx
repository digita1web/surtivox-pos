import { useRef } from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useTourTargets, type TourTarget } from '../../src/components/tourTargets';
import { CartBar } from '../../src/pos/CartBar';
import { CheckoutSheet } from '../../src/pos/CheckoutSheet';
import { ReceiptModal } from '../../src/pos/ReceiptModal';
import { QuickSaleModal } from '../../src/pos/QuickSaleModal';

const NAV_ICONS = {
  home: require('../../assets/nav/home.png'),
  products: require('../../assets/nav/products.png'),
  scan: require('../../assets/nav/scan-sell.png'),
  sales: require('../../assets/nav/sales.png'),
  more: require('../../assets/nav/more.png'),
};

function TourTabIcon({ id, source, tintColor }: { id: TourTarget; source: number; tintColor: string }) {
  const ref = useRef<View>(null);
  const setTarget = useTourTargets((state) => state.setTarget);
  const measure = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setTarget(id, { x, y, width, height });
    });
  };
  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={{ width: 23, height: 23 }}>
      <Image source={source} style={{ width: 23, height: 23 }} tintColor={tintColor} contentFit="contain" />
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabBarHeight = 60 + insets.bottom;

  const tab = (icon: number, id: TourTarget) =>
    ({ color }: { focused: boolean; color: ColorValue }) => (
      <TourTabIcon id={id} source={icon} tintColor={color as string} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: true,
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.faint,
          tabBarStyle: {
            backgroundColor: t.panel,
            borderTopColor: t.line,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: insets.bottom + 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: tab(NAV_ICONS.home, 'home') }} />
        <Tabs.Screen name="products" options={{ title: 'Productos', tabBarIcon: tab(NAV_ICONS.products, 'products') }} />
        <Tabs.Screen
          name="newsale"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: -22, borderWidth: 4, borderColor: t.panel, boxShadow: t.shadowStrong }}>
                <Image source={NAV_ICONS.scan} style={{ width: 28, height: 28 }} tintColor={t.accentFg} contentFit="contain" />
              </View>
            ),
          }}
          listeners={{ tabPress: (e) => { e.preventDefault(); router.push('/scan'); } }}
        />
        <Tabs.Screen name="sales" options={{ title: 'Ventas', tabBarIcon: tab(NAV_ICONS.sales, 'sales') }} />
        <Tabs.Screen name="more" options={{ title: 'Más', tabBarIcon: tab(NAV_ICONS.more, 'more') }} />
      </Tabs>

      <CartBar bottom={tabBarHeight + 10} />
      <CheckoutSheet />
      <ReceiptModal />
      <QuickSaleModal />
    </View>
  );
}
