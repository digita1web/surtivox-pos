const CATEGORY_IMAGES: Record<string, number> = {
  Abarrotes: require('../../assets/categories/abarrotes.webp'),
  Granos: require('../../assets/categories/granos.webp'),
  Condimentos: require('../../assets/categories/condimentos.webp'),
  Lácteos: require('../../assets/categories/lacteos.webp'),
  Huevos: require('../../assets/categories/huevos.webp'),
  Panadería: require('../../assets/categories/panaderia.webp'),
  'Carnes frías': require('../../assets/categories/carnes-frias.webp'),
  Snacks: require('../../assets/categories/snacks.webp'),
  Bebidas: require('../../assets/categories/bebidas.webp'),
  Aseo: require('../../assets/categories/aseo.webp'),
  'Cuidado personal': require('../../assets/categories/cuidado-personal.webp'),
  Hogar: require('../../assets/categories/hogar.webp'),
  Mascotas: require('../../assets/categories/mascotas.webp'),
  Cigarrillos: require('../../assets/categories/cigarrillos.webp'),
  Dulces: require('../../assets/categories/dulces.webp'),
  Bebés: require('../../assets/categories/bebes.webp'),
};

export function categoryImageFor(category: string | null | undefined): number | undefined {
  return category ? CATEGORY_IMAGES[category] : undefined;
}
