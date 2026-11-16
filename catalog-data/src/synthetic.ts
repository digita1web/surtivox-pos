import { gtinCheckDigit } from './gtin.ts';
import type { Product, Taxonomy } from './types.ts';

export const SYNTHETIC_SOURCE = {
  id: 'sintetico',
  name: 'Datos sintéticos de medición',
  url: 'https://example.org/sintetico',
  license: 'CC0-1.0',
  attribution: '',
  status: 'approved',
} as const;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOUNS: Record<string, string[]> = {
  abarrotes: ['Aceite', 'Azúcar', 'Sal', 'Harina', 'Pasta', 'Atún', 'Sardinas', 'Café', 'Chocolate', 'Avena', 'Panela', 'Gelatina'],
  granos: ['Arroz', 'Fríjol', 'Lenteja', 'Garbanzo', 'Arveja', 'Maíz pira', 'Maíz peto'],
  condimentos: ['Comino', 'Pimienta', 'Color', 'Ajo en polvo', 'Caldo de gallina', 'Salsa de tomate', 'Mayonesa', 'Mostaza'],
  lacteos: ['Leche', 'Yogur', 'Kumis', 'Queso campesino', 'Mantequilla', 'Crema de leche', 'Arequipe'],
  huevos: ['Huevos AA', 'Huevos A', 'Huevos de codorniz'],
  panaderia: ['Pan tajado', 'Pan blandito', 'Tostadas', 'Ponqué', 'Mantecada', 'Galletas de soda'],
  'carnes-frias': ['Salchichas', 'Jamón', 'Mortadela', 'Chorizo', 'Salchichón'],
  snacks: ['Papas fritas', 'Platanitos', 'Chicharrones', 'Rosquitas', 'Maní salado', 'Tostacos'],
  bebidas: ['Gaseosa', 'Agua', 'Jugo', 'Té frío', 'Bebida energizante', 'Malta', 'Refresco'],
  aseo: ['Jabón en barra', 'Detergente', 'Lavaloza', 'Blanqueador', 'Suavizante', 'Desinfectante', 'Esponja'],
  'cuidado-personal': ['Champú', 'Crema dental', 'Desodorante', 'Jabón de tocador', 'Toallas higiénicas', 'Papel higiénico', 'Crema corporal'],
  hogar: ['Bombillo', 'Velas', 'Fósforos', 'Bolsas de basura', 'Escoba', 'Trapero', 'Pilas'],
  mascotas: ['Concentrado para perro', 'Concentrado para gato', 'Arena para gato', 'Snack para perro'],
  cigarrillos: ['Cigarrillos', 'Encendedor'],
  dulces: ['Chicles', 'Bombones', 'Chupetas', 'Gomitas', 'Barra de chocolate', 'Caramelos'],
  bebes: ['Pañales', 'Pañitos húmedos', 'Compota', 'Fórmula infantil', 'Tetero'],
  'frutas-verduras': ['Tomate', 'Cebolla cabezona', 'Papa pastusa', 'Plátano', 'Banano', 'Zanahoria', 'Limón'],
  congelados: ['Papas a la francesa', 'Nuggets de pollo', 'Helado', 'Pulpa de fruta'],
  desechables: ['Vasos', 'Platos', 'Cubiertos', 'Servilletas', 'Papel aluminio', 'Pitillos'],
  licores: ['Aguardiente', 'Ron', 'Cerveza', 'Vino tinto', 'Whisky', 'Tequila'],
  medicamentos: ['Acetaminofén', 'Ibuprofeno', 'Antiácido', 'Sales de rehidratación', 'Jarabe para la tos', 'Antigripal'],
  'primeros-auxilios': ['Curitas', 'Gasa', 'Alcohol antiséptico', 'Agua oxigenada', 'Esparadrapo', 'Termómetro'],
  herramientas: ['Martillo', 'Destornillador', 'Alicate', 'Llave inglesa', 'Metro', 'Segueta', 'Pala'],
  tornilleria: ['Tornillo', 'Puntilla', 'Chazo', 'Tuerca', 'Arandela', 'Perno'],
  electricos: ['Cable', 'Tomacorriente', 'Interruptor', 'Cinta aislante', 'Extensión', 'Plafón'],
  plomeria: ['Tubo PVC', 'Codo PVC', 'Llave de paso', 'Teflón', 'Sifón', 'Pegante PVC'],
  pinturas: ['Pintura vinilo', 'Esmalte', 'Brocha', 'Rodillo', 'Lija', 'Thinner'],
  'utiles-escolares': ['Lápiz', 'Borrador', 'Sacapuntas', 'Colores', 'Marcador', 'Regla', 'Pegante en barra', 'Tijeras'],
  'papel-cuadernos': ['Cuaderno cuadriculado', 'Cuaderno rayado', 'Resma de papel', 'Cartulina', 'Papel silueta', 'Block'],
  oficina: ['Grapadora', 'Ganchos', 'Clips', 'Carpeta', 'Sobre de manila', 'Cinta transparente'],
};

const DESCRIPTORS = ['clásico', 'light', 'familiar', 'económico', 'premium', 'tradicional', 'natural', 'extra', 'original', 'sin azúcar', 'integral', 'grande', 'mini', 'doble', 'surtido', 'rojo', 'azul', 'verde', 'limón', 'fresa', 'vainilla', 'mora'];
const SYLLABLES = ['ma', 'ri', 'to', 'la', 'sa', 'ne', 'co', 'pe', 'du', 'ra', 'vi', 'lo', 'ta', 'mi', 'ca', 'bo', 'fe', 'gu', 'ni', 'so', 'al', 'pi', 'ro', 'ze'];
const PRESENTATIONS: readonly (readonly [number, string])[] = [[125, 'g'], [250, 'g'], [500, 'g'], [1, 'kg'], [2.5, 'kg'], [200, 'ml'], [350, 'ml'], [400, 'ml'], [1, 'L'], [1.5, 'L'], [3, 'L'], [1, 'lb'], [12, 'unit'], [30, 'unit'], [2, 'm'], [500, 'mg']];

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function brand(r: () => number): string {
  const n = 2 + Math.floor(r() * 2);
  let s = '';
  for (let i = 0; i < n; i++) s += pick(r, SYLLABLES);
  return cap(s);
}

function presentationText(q: number, unit: string): string {
  return unit === 'unit' ? `x ${q}` : `${q} ${unit}`;
}

export function syntheticProducts(count: number, tax: Taxonomy, seed = 20261116): Product[] {
  const r = rng(seed);
  const categories = [...tax.categories.values()].filter((c) => NOUNS[c.id]);
  const brands = Array.from({ length: Math.max(50, Math.floor(count / 40)) }, () => brand(r));
  const out: Product[] = [];
  const usedCodes = new Set<string>();
  for (let i = 0; i < count; i++) {
    const category = pick(r, categories);
    const noun = pick(r, NOUNS[category.id]!);
    const b = pick(r, brands);
    const descriptor = r() < 0.6 ? ` ${pick(r, DESCRIPTORS)}` : '';
    const [q, unit] = pick(r, PRESENTATIONS);
    const name = `${noun} ${b}${descriptor} ${presentationText(q, unit)}`;
    const types = category.business_types.filter(() => r() < 0.7);
    const p: Product = {
      id: `sintetico:${i}`,
      name,
      brand: b,
      category: category.id,
      unit: unit === 'unit' ? 'pack' : 'unit',
      presentation: unit === 'unit' ? { quantity: q, unit: 'unit', count: q } : { quantity: q, unit },
      business_types: types.length ? types : [category.business_types[0]!],
      source: { id: SYNTHETIC_SOURCE.id },
      license: SYNTHETIC_SOURCE.license,
    };
    if (r() < 0.3) p.synonyms = [`${noun} ${pick(r, DESCRIPTORS)} ${b}`];
    if (r() < 0.6) {
      let code = '';
      do {
        const body = `770${String(Math.floor(r() * 1e9)).padStart(9, '0')}`;
        code = body + gtinCheckDigit(body);
      } while (usedCodes.has(code));
      usedCodes.add(code);
      p.barcodes = [code];
    }
    out.push(p);
  }
  return out;
}
