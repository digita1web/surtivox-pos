import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { asMinor } from '@openpocket/pos-core';
import { useCart } from '../cart';
import { useTheme, radius, space } from '../theme';
import { useMoney } from './ui';
import { Thumb } from './Thumb';
import { isLowStock, type Product } from '../repos';
import { tracksInventory } from './stockPolicy';
import { useRole } from '../session';
import { can } from '../roles';

const UNIT_SHORT: Record<string, string> = {
  pcs: 'pza',
  pack: 'paq',
  box: 'caja',
  dozen: 'doc',
  lb: 'lb',
  bulto: 'bulto',
  bottle: 'botella',
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
};

/**
 * Compact grid card: photo, name, price + stock, add button (or a - qty + stepper
 * once it is in the cart). No shadows on purpose: many cards with shadows are what
 * make long grids stutter while scrolling.
 */
function ProductCardBase({ product }: { product: Product }) {
  const t = useTheme();
  const cart = useCart();
  const money = useMoney();
  const router = useRouter();
  const canEdit = can(useRole(), 'products') && !product.isQuick;
  const qty = cart.items[product.id]?.quantity ?? 0;
  const tracked = tracksInventory(product);
  const out = tracked && product.stock <= 0;
  const low = tracked && !out && isLowStock(product);
  const unit = product.unit && product.unit !== 'unit' ? (UNIT_SHORT[product.unit] ?? product.unit) : 'en stock';

  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: qty > 0 ? t.accent : t.line }]}>
      <Pressable onPress={() => cart.add(product)} accessibilityLabel={`Agregar ${product.name}`}>
        <View style={[s.imageWrap, { backgroundColor: '#ffffff', borderColor: t.line }]}>
          <Thumb uri={product.image_uri} name={product.name} category={product.category_name} style={s.image} textSize={26} />
          {(out || low) && (
            <View style={[s.badge, { backgroundColor: out ? t.danger : t.warn }]}>
              <Text style={s.badgeText}>{out ? 'AGOTADO' : 'STOCK BAJO'}</Text>
            </View>
          )}
        </View>
        <Text style={[s.name, { color: t.fg }]} numberOfLines={1}>{product.name}</Text>
        <View style={s.priceRow}>
          <Text style={[s.price, { color: t.fg }]} numberOfLines={1}>{money(asMinor(product.selling_price))}</Text>
          <Text style={[s.stock, { color: t.muted }]} numberOfLines={1}>{tracked ? `${product.stock} ${unit}` : 'Sin control de stock'}</Text>
        </View>
      </Pressable>

      {qty > 0 ? (
        <View style={[s.stepper, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
          <Pressable onPress={() => cart.setQty(product.id, qty - 1)} style={s.stepBtn} hitSlop={6} accessibilityLabel="Quitar uno">
            <Ionicons name="remove" size={20} color={t.fg} />
          </Pressable>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 15 }}>{qty}</Text>
          <Pressable onPress={() => cart.add(product)} style={s.stepBtn} hitSlop={6} accessibilityLabel="Agregar uno">
            <Ionicons name="add" size={20} color={t.fg} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => cart.add(product)}
          style={({ pressed }) => [s.addBtn, { backgroundColor: t.accentSoft, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="add" size={16} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: '800', marginLeft: 4, fontSize: 13.5 }}>Agregar</Text>
        </Pressable>
      )}

      {canEdit && (
        <Pressable onPress={() => router.push({ pathname: '/add-product', params: { id: product.id } })} hitSlop={12}
          accessibilityLabel={`Editar ${product.name}`} style={[s.edit, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Ionicons name="create-outline" size={18} color={t.accent} />
        </Pressable>
      )}
    </View>
  );
}

export const ProductCard = memo(ProductCardBase);

const s = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: 10 },
  imageWrap: { borderRadius: radius.md - 2, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', height: 108 },
  badge: { position: 'absolute', top: 6, right: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  name: { fontSize: 14, fontWeight: '700', marginTop: space.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 3 },
  price: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  stock: { fontSize: 11.5, flexShrink: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.sm, borderRadius: radius.sm + 2, height: 38 },
  stepper: { marginTop: space.sm, borderWidth: 1, borderRadius: radius.sm + 2, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  stepBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  // A prominent, opaque edit button that sits above the image (elevation) so a
  // tap on it opens the editor instead of falling through to add-to-cart.
  edit: { position: 'absolute', top: 15, left: 15, width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4, zIndex: 2 },
});
