import { create } from 'zustand';

interface HandoffState {
  quickSaleCode: string | null;
  message: string | null;
  requestQuickSale: (code: string) => void;
  announce: (message: string) => void;
  takeQuickSale: () => string | null;
  takeMessage: () => string | null;
}

export const useWizardHandoff = create<HandoffState>((set, get) => ({
  quickSaleCode: null,
  message: null,
  requestQuickSale: (code) => set({ quickSaleCode: code }),
  announce: (message) => set({ message }),
  takeQuickSale: () => {
    const code = get().quickSaleCode;
    if (code !== null) set({ quickSaleCode: null });
    return code;
  },
  takeMessage: () => {
    const message = get().message;
    if (message !== null) set({ message: null });
    return message;
  },
}));

export function closingMessage(result: { status: 'created' | 'existing'; queued: boolean }): string {
  if (result.status === 'existing') return 'Ese producto ya estaba registrado. Lo agregué a la venta.';
  return result.queued ? 'Producto creado. Gracias por ayudar al catálogo' : 'Producto creado';
}
