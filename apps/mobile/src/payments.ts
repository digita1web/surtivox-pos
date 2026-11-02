import { Linking } from 'react-native';
import { showAlert } from './pos/alert';

const CHECKOUT_ENDPOINT = '';

interface CheckoutResponse {
  url?: unknown;
}

export async function startSubscriptionPayment(): Promise<void> {
  if (!CHECKOUT_ENDPOINT) {
    showAlert('Pago seguro', 'Redirigiendo a pasarela de pago... (En configuración)');
    return;
  }
  try {
    const response = await fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'cloud_sync_monthly' }),
    });
    if (!response.ok) throw new Error('No se pudo crear la sesión de pago.');
    const data = await response.json() as CheckoutResponse;
    if (typeof data.url !== 'string' || !/^https?:\/\//i.test(data.url)) {
      throw new Error('La pasarela no devolvió una URL válida.');
    }
    await Linking.openURL(data.url);
  } catch {
    showAlert('No se pudo iniciar el pago', 'No se pudo abrir la pasarela de pago. Intenta de nuevo.');
  }
}
