import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { countProductsToReview, listProducts, listProductsToReview, isLowStock, type Product } from '../../src/repos';
import { useSession } from '../../src/session';
import { useRole } from '../../src/session';
import { can } from '../../src/roles';
import { ProductCard } from '../../src/pos/ProductCard';
import { tracksInventory } from '../../src/pos/stockPolicy';
import { ScanModal } from '../../src/pos/ScanModal';
import { TabHeader, IconButton, listProps, useTabListInset } from '../../src/pos/Screen';
import { SearchField, Chip, ChipRow, ChipDivider, EmptyState } from '../../src/pos/kit';
import { useTheme, space } from '../../src/theme';

type StockFilter = 'low' | 'out' | null;

export default function Products() {
  const t = useTheme();
  const router = useRouter();
  const listInset = useTabListInset();
  const store = useSession((s) => s.store)!;
  const canEdit = can(useRole(), 'products');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>(null);
  const [category, setCategory] = useState<string | null>(null); // category id
  const [scanning, setScanning] = useState(false);
  const [reviewProducts, setReviewProducts] = useState<Product[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewOnly, setReviewOnly] = useState(false);
  const params = useLocalSearchParams<{ filter?: string; review?: string }>();

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([
      listProducts(store.id),
      listProductsToReview(store.id),
      countProductsToReview(store.id),
    ]).then(([all, review, count]) => {
      if (!active) return;
      setProducts(all);
      setReviewProducts(review);
      setReviewCount(count);
    }).catch(() => {});
    return () => { active = false; };
  }, [store.id]));

  // Open straight into a stock filter when arriving from the Home "Needs
  // attention" card, then consume the param so a later tab tap doesn't re-apply it.
  useFocusEffect(useCallback(() => {
    if (params.filter === 'low' || params.filter === 'out') {
      setStockFilter(params.filter);
      setReviewOnly(false);
      router.setParams({ filter: undefined });
    }
  }, [params.filter]));

  useFocusEffect(useCallback(() => {
    setReviewOnly(params.review === '1');
    if (params.review === '1') {
      setStockFilter(null);
      setCategory(null);
    }
  }, [params.review]));

  const baseProducts = reviewOnly ? reviewProducts : products;

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of baseProducts) if (p.category_id && p.category_name) seen.set(p.category_id, p.category_name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [baseProducts]);

  const counts = useMemo(() => ({
    low: products.filter((p) => tracksInventory(p) && isLowStock(p)).length,
    out: products.filter((p) => tracksInventory(p) && p.stock <= 0).length,
  }), [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseProducts.filter((p) => {
      if (stockFilter === 'low' && (!tracksInventory(p) || !isLowStock(p))) return false;
      if (stockFilter === 'out' && (!tracksInventory(p) || p.stock > 0)) return false;
      if (category && p.category_id !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q) || (p.sku ?? '').toLowerCase().includes(q)
        || (p.category_name ?? '').toLowerCase().includes(q);
    });
  }, [baseProducts, query, stockFilter, category]);

  const allOn = stockFilter === null && category === null && !reviewOnly;
  const reset = () => {
    setStockFilter(null);
    setCategory(null);
    setReviewOnly(false);
    router.setParams({ review: undefined });
  };

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <TabHeader
        title="Productos"
        subtitle={reviewOnly
          ? `${reviewProducts.length} por completar`
          : products.length
            ? `${products.length} artículo${products.length === 1 ? '' : 's'}`
            : undefined}
        right={canEdit ? <IconButton icon="add" label="Agregar producto" filled onPress={() => router.push('/add-product')} /> : undefined}
      >
        <View style={s.controls}>
          <SearchField
            value={query} onChangeText={setQuery} placeholder="Buscar por nombre, código de barras o SKU"
            right={<Pressable onPress={() => setScanning(true)} hitSlop={10} accessibilityLabel="Buscar producto por código de barras"><Ionicons name="barcode-outline" size={20} color={t.accent} /></Pressable>}
          />
          <ChipRow>
            <Chip label="Todos" on={allOn} onPress={reset} />
            <Chip label="Stock bajo" count={counts.low || undefined} on={stockFilter === 'low'} onPress={() => setStockFilter(stockFilter === 'low' ? null : 'low')} />
            <Chip label="Sin stock" count={counts.out || undefined} on={stockFilter === 'out'} onPress={() => setStockFilter(stockFilter === 'out' ? null : 'out')} />
            {categories.length > 0 && <ChipDivider />}
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} on={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
            ))}
          </ChipRow>
        </View>
        {reviewCount > 0 ? (
          <Pressable
            onPress={() => router.setParams({ review: reviewOnly ? undefined : '1' })}
            style={[s.reviewBanner, { backgroundColor: t.accentSoft, borderColor: t.accent }]}
          >
            <View style={[s.reviewIcon, { backgroundColor: t.panel }]}>
              <Ionicons name="sparkles-outline" size={17} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontWeight: '800' }}>
                {reviewCount} producto{reviewCount === 1 ? '' : 's'} por completar
              </Text>
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>
                {reviewOnly ? 'Ver todos los productos' : 'Revisa nombre, precio y categoría'}
              </Text>
            </View>
            <Ionicons name={reviewOnly ? 'close' : 'chevron-forward'} size={18} color={t.accent} />
          </Pressable>
        ) : null}
      </TabHeader>

      {baseProducts.length === 0 ? (
        <EmptyState
          icon={reviewOnly ? 'checkmark-circle-outline' : 'cube-outline'}
          title={reviewOnly ? 'Todo al día' : 'Aún no hay productos'}
          hint={reviewOnly ? 'No hay productos pendientes por completar.' : 'Agrega uno o escanea un código de barras para empezar.'}
          action={!reviewOnly && canEdit ? { label: 'Agregar producto', onPress: () => router.push('/add-product') } : undefined}
        />
      ) : (
        <FlatList
          {...listProps}
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: space.lg, paddingBottom: listInset }}
          columnWrapperStyle={{ gap: space.md }}
          ItemSeparatorComponent={Gap}
          ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 48 }}>{reviewOnly ? 'No hay productos por completar que coincidan.' : 'No hay productos que coincidan.'}</Text>}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}

      {/* Barcode here FINDS the product (fills the search) so you can view, edit
          or delete it — selling by scan lives on the Scan tab. */}
      <ScanModal visible={scanning} onClose={() => setScanning(false)} onScan={(code) => { setStockFilter(null); setCategory(null); setQuery(code); }} />
    </View>
  );
}

const Gap = () => <View style={{ height: space.md }} />;

const s = StyleSheet.create({
  root: { flex: 1 },
  controls: { gap: space.md, marginTop: space.xs },
  reviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: space.md },
  reviewIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
