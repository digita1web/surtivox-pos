export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('57') && digits.length === 12) return digits;
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  if (/^3\d{9}$/.test(local)) return `57${local}`;
  return null;
}

export function buildFiadoReminderUrl(name: string, balance: string, phone: string): string {
  const text = encodeURIComponent(`Hola ${name}, te recuerdo que tienes un fiado pendiente de ${balance}. Cuando puedas, pasa a pagar. ¡Gracias!`);
  return `https://wa.me/${phone}?text=${text}`;
}
