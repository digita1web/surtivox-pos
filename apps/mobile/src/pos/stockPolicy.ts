export interface InventoryTracked {
  track_inventory?: number | null;
}

export function tracksInventory(product: InventoryTracked): boolean {
  return (product.track_inventory ?? 1) === 1;
}

export function defaultDraftName(barcode: string): string {
  return `Producto ${barcode.trim().slice(-4)}`;
}
