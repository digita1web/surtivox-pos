export type RecoverEntry =
  | { visible: false }
  | { visible: true; placement: 'primary' | 'secondary'; warnsReplace: boolean };

export function recoverEntryOnCloudScreen(input: { hosted: boolean; connected: boolean }): RecoverEntry {
  if (!input.hosted) return { visible: false };
  return input.connected
    ? { visible: true, placement: 'secondary', warnsReplace: true }
    : { visible: true, placement: 'primary', warnsReplace: false };
}

export function showRecoverOnOnboarding(hosted: boolean): boolean {
  return hosted;
}

export function showRecoverCardOnHome(input: {
  hosted: boolean;
  canSync: boolean;
  cloudConnected: boolean;
  productCount: number;
  orderCount: number;
}): boolean {
  return input.hosted && input.canSync && !input.cloudConnected && input.productCount === 0 && input.orderCount === 0;
}

export const RECOVER_CARD_TITLE = '¿Ya usabas Surtivox?';
export const RECOVER_CARD_ACTION = 'Ya tengo mi tienda';
export const RECOVER_REPLACE_WARNING = 'Reemplaza todos los datos de este teléfono con los de otra tienda.';
