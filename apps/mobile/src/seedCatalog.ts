import type { SQLiteDatabase } from 'expo-sqlite';

export interface SeedProduct {
  code: string;
  name: string;
  category: string;
  price: number;
  unit: 'unit' | 'lb' | 'bulto' | 'dozen' | 'pack' | 'bottle' | 'kg';
  stock: number;
}

export interface SeedResult {
  inserted: number;
  skipped: number;
}

export interface SeedIds {
  newId: () => string;
  deviceId: string;
}

export type SeedDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;

export const SEED_PRODUCTS: SeedProduct[] = [
  { code: 'INT-001', name: 'Arroz Diana 500 g', category: 'Abarrotes', price: 2500, unit: 'unit', stock: 10 },
  { code: 'INT-002', name: 'Arroz Diana 1 kg', category: 'Abarrotes', price: 4800, unit: 'unit', stock: 10 },
  { code: 'INT-003', name: 'Arroz Diana por Libra', category: 'Granos', price: 2300, unit: 'lb', stock: 10 },
  { code: 'INT-004', name: 'Arroz Diana Bulto 50 kg', category: 'Granos', price: 185000, unit: 'bulto', stock: 0 },
  { code: 'INT-005', name: 'Panela 500 g', category: 'Abarrotes', price: 2500, unit: 'unit', stock: 10 },
  { code: 'INT-006', name: 'Panela pulverizada 1 kg', category: 'Abarrotes', price: 5000, unit: 'unit', stock: 10 },
  { code: 'INT-007', name: 'Aceite Premier 1 L', category: 'Abarrotes', price: 9500, unit: 'unit', stock: 10 },
  { code: 'INT-008', name: 'Azúcar Manuelita 1 kg', category: 'Abarrotes', price: 5000, unit: 'unit', stock: 10 },
  { code: 'INT-009', name: 'Pasta Doria 500 g', category: 'Abarrotes', price: 3500, unit: 'unit', stock: 10 },
  { code: 'INT-010', name: 'Café Sello Rojo 500 g', category: 'Abarrotes', price: 12000, unit: 'unit', stock: 10 },
  { code: 'INT-011', name: 'Chocolate Corona 500 g', category: 'Abarrotes', price: 9000, unit: 'unit', stock: 10 },
  { code: 'INT-012', name: 'Atún Van Camps 170 g', category: 'Abarrotes', price: 5500, unit: 'unit', stock: 10 },
  { code: 'INT-013', name: 'Lentejas 500 g', category: 'Granos', price: 4000, unit: 'unit', stock: 10 },
  { code: 'INT-014', name: 'Lentejas por Libra', category: 'Granos', price: 4200, unit: 'lb', stock: 10 },
  { code: 'INT-015', name: 'Fríjol cargamanto por Libra', category: 'Granos', price: 5000, unit: 'lb', stock: 10 },
  { code: 'INT-016', name: 'Garbanzo 500 g', category: 'Granos', price: 4500, unit: 'unit', stock: 10 },
  { code: 'INT-017', name: 'Maíz pira 500 g', category: 'Granos', price: 3500, unit: 'unit', stock: 10 },
  { code: 'INT-018', name: 'Sal Refisal 500 g', category: 'Condimentos', price: 1500, unit: 'unit', stock: 10 },
  { code: 'INT-019', name: 'Harina PAN 1 kg', category: 'Abarrotes', price: 4500, unit: 'unit', stock: 10 },
  { code: 'INT-020', name: 'Harina de trigo 1 kg', category: 'Abarrotes', price: 4000, unit: 'unit', stock: 10 },
  { code: 'INT-021', name: 'Leche Alquería 1 L', category: 'Lácteos', price: 3200, unit: 'unit', stock: 10 },
  { code: 'INT-022', name: 'Leche en polvo 380 g', category: 'Lácteos', price: 12000, unit: 'unit', stock: 10 },
  { code: 'INT-023', name: 'Queso campesino por Libra', category: 'Lácteos', price: 6000, unit: 'lb', stock: 10 },
  { code: 'INT-024', name: 'Queso costeño por Libra', category: 'Lácteos', price: 7000, unit: 'lb', stock: 10 },
  { code: 'INT-025', name: 'Mantequilla 250 g', category: 'Lácteos', price: 5500, unit: 'unit', stock: 10 },
  { code: 'INT-026', name: 'Yogurt Alpina 900 ml', category: 'Lácteos', price: 6500, unit: 'unit', stock: 10 },
  { code: 'INT-027', name: 'Huevo AA', category: 'Huevos', price: 500, unit: 'unit', stock: 10 },
  { code: 'INT-028', name: 'Huevos AA Docena', category: 'Huevos', price: 6000, unit: 'dozen', stock: 10 },
  { code: 'INT-029', name: 'Pan tajado Bimbo 500 g', category: 'Panadería', price: 6500, unit: 'unit', stock: 10 },
  { code: 'INT-030', name: 'Arepas 5 unidades', category: 'Panadería', price: 5000, unit: 'pack', stock: 10 },
  { code: 'INT-031', name: 'Pandebono 6 unidades', category: 'Panadería', price: 6000, unit: 'pack', stock: 10 },
  { code: 'INT-032', name: 'Salchichas Ranchera 500 g', category: 'Carnes frías', price: 7500, unit: 'unit', stock: 10 },
  { code: 'INT-033', name: 'Mortadela 250 g', category: 'Carnes frías', price: 4500, unit: 'unit', stock: 10 },
  { code: 'INT-034', name: 'Galletas Saltín 6 pack', category: 'Snacks', price: 3000, unit: 'pack', stock: 10 },
  { code: 'INT-035', name: 'Chocoramo', category: 'Snacks', price: 2800, unit: 'unit', stock: 10 },
  { code: 'INT-036', name: 'Chocolatina Jet', category: 'Snacks', price: 2000, unit: 'unit', stock: 10 },
  { code: 'INT-037', name: 'Bon Bon Bum', category: 'Snacks', price: 500, unit: 'unit', stock: 10 },
  { code: 'INT-038', name: 'Papas Margarita 30 g', category: 'Snacks', price: 3200, unit: 'unit', stock: 10 },
  { code: 'INT-061', name: 'Papas Margarita Pollo 105 g', category: 'Snacks', price: 3500, unit: 'unit', stock: 10 },
  { code: 'INT-039', name: 'Choclitos', category: 'Snacks', price: 1500, unit: 'unit', stock: 10 },
  { code: 'INT-040', name: 'De Todito', category: 'Snacks', price: 2500, unit: 'unit', stock: 10 },
  { code: 'INT-041', name: 'Gaseosa Coca-Cola 400 ml', category: 'Bebidas', price: 3000, unit: 'bottle', stock: 10 },
  { code: 'INT-042', name: 'Gaseosa Coca-Cola 1.5 L', category: 'Bebidas', price: 6500, unit: 'bottle', stock: 10 },
  { code: 'INT-043', name: 'Gaseosa Postobón 1.5 L', category: 'Bebidas', price: 5500, unit: 'bottle', stock: 10 },
  { code: 'INT-044', name: 'Agua Cristal 600 ml', category: 'Bebidas', price: 1500, unit: 'bottle', stock: 10 },
  { code: 'INT-045', name: 'Jugo Hit 500 ml', category: 'Bebidas', price: 2500, unit: 'bottle', stock: 10 },
  { code: 'INT-046', name: 'Cerveza Águila 330 ml', category: 'Bebidas', price: 3500, unit: 'bottle', stock: 10 },
  { code: 'INT-047', name: 'Cerveza Poker 330 ml', category: 'Bebidas', price: 3000, unit: 'bottle', stock: 10 },
  { code: 'INT-048', name: 'Detergente Fab 1 kg', category: 'Aseo', price: 9500, unit: 'unit', stock: 10 },
  { code: 'INT-049', name: 'Jabón Rey 300 g', category: 'Aseo', price: 3000, unit: 'unit', stock: 10 },
  { code: 'INT-050', name: 'Suavizante 1 L', category: 'Aseo', price: 7500, unit: 'unit', stock: 10 },
  { code: 'INT-051', name: 'Blanqueador Clorox 1 L', category: 'Aseo', price: 4500, unit: 'unit', stock: 10 },
  { code: 'INT-052', name: 'Papel higiénico Familia 4 rollos', category: 'Aseo', price: 7000, unit: 'pack', stock: 10 },
  { code: 'INT-053', name: 'Crema dental Colgate 75 ml', category: 'Cuidado personal', price: 5500, unit: 'unit', stock: 10 },
  { code: 'INT-054', name: 'Jabón Dove 100 g', category: 'Cuidado personal', price: 4500, unit: 'unit', stock: 10 },
  { code: 'INT-055', name: 'Shampoo 400 ml', category: 'Cuidado personal', price: 12000, unit: 'unit', stock: 10 },
  { code: 'INT-056', name: 'Toallas higiénicas 10 unidades', category: 'Cuidado personal', price: 5500, unit: 'pack', stock: 10 },
  { code: 'INT-057', name: 'Pilas AA 2 unidades', category: 'Hogar', price: 4000, unit: 'pack', stock: 10 },
  { code: 'INT-058', name: 'Bombillo LED 9 W', category: 'Hogar', price: 6000, unit: 'unit', stock: 10 },
  { code: 'INT-059', name: 'Concentrado para perro 1 kg', category: 'Mascotas', price: 8000, unit: 'kg', stock: 10 },
  { code: 'INT-060', name: 'Atún para gato 85 g', category: 'Mascotas', price: 2500, unit: 'unit', stock: 10 },
  { code: 'INT-062', name: 'Cigarrillos Marlboro Rojo', category: 'Cigarrillos', price: 12000, unit: 'unit', stock: 10 },
];

export async function seedColombianCatalog(db: SeedDatabase, storeId: string, ids: SeedIds): Promise<SeedResult> {
  let inserted = 0;
  let skipped = 0;
  await db.withTransactionAsync(async () => {
    const now = Date.now();
    const categoryIds = new Map<string, string>();
    const categories = [...new Set(SEED_PRODUCTS.map((p) => p.category))];
    for (const [index, category] of categories.entries()) {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM categories WHERE store_id=? AND lower(name)=lower(?)',
        [storeId, category],
      );
      if (existing) {
        categoryIds.set(category, existing.id);
        continue;
      }
      const id = ids.newId();
      await db.runAsync(
        'INSERT INTO categories (id,store_id,name,sort_order,created_at,updated_at,device_id,version) VALUES (?,?,?,?,?,?,?,1)',
        [id, storeId, category, index, now, now, ids.deviceId],
      );
      categoryIds.set(category, id);
    }
    for (const product of SEED_PRODUCTS) {
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM products WHERE store_id=? AND deleted_at IS NULL AND (barcode=? OR lower(name)=lower(?)) LIMIT 1',
        [storeId, product.code, product.name],
      );
      if (existing) {
        skipped += 1;
        continue;
      }
      const categoryId = categoryIds.get(product.category);
      if (!categoryId) throw new Error(`Categoría no encontrada: ${product.category}`);
      const productId = ids.newId();
      await db.runAsync(
        `INSERT INTO products (id,store_id,category_id,name,sku,barcode,cost_price,selling_price,unit,track_inventory,low_stock_threshold,tax_bps,active,created_at,updated_at,device_id,version)
         VALUES (?,?,?,?,?,?,?,?,?,1,NULL,0,1,?,?,?,1)`,
        [productId, storeId, categoryId, product.name, product.code, product.code, Math.round(product.price * 0.75), product.price, product.unit, now, now, ids.deviceId],
      );
      if (product.stock > 0) {
        await db.runAsync(
          `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,note,created_at,device_id)
           VALUES (?,?,?,'opening_stock',?,'opening','initial stock',?,?)`,
          [ids.newId(), storeId, productId, product.stock, now, ids.deviceId],
        );
      }
      inserted += 1;
    }
  });
  return { inserted, skipped };
}
