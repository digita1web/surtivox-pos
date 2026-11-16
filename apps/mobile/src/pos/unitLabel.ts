const COUNTED: Record<string, readonly [string, string]> = {
  unit: ['disponible', 'disponibles'],
  pcs: ['pieza', 'piezas'],
  pack: ['paquete', 'paquetes'],
  box: ['caja', 'cajas'],
  dozen: ['docena', 'docenas'],
  bulto: ['bulto', 'bultos'],
  bottle: ['botella', 'botellas'],
};

const MEASURED = new Set(['kg', 'g', 'L', 'ml', 'lb']);

export function stockLabel(quantity: number, unit: string | null | undefined): string {
  const key = unit || 'unit';
  if (MEASURED.has(key)) return `${quantity} ${key}`;
  const forms = COUNTED[key];
  if (!forms) return `${quantity} ${key}`;
  return `${quantity} ${Math.abs(quantity) === 1 ? forms[0] : forms[1]}`;
}
