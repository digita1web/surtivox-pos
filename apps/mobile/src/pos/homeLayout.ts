export interface HomeMetrics {
  pad: number;
  gap: number;
  compact: boolean;
  actionsStacked: boolean;
  actionIcon: number;
  actionChevron: number;
  headerLogo: number;
  headerButton: number;
  brandSize: number;
  cardW: number;
  photoH: number;
  cardH: number;
  promoW: number;
  promoH: number;
  plusSize: number;
}

export const PROMO_RATIO = 514 / 552;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function homeMetrics(width: number, fontScale = 1): HomeMetrics {
  const w = Math.max(280, Math.round(width));
  const scale = clamp(fontScale, 1, 1.4);
  const pad = w >= 600 ? 24 : 16;
  const gap = 12;
  const compact = w < 350;
  const room = w - 2 * pad - gap;
  const cardW = clamp(Math.round(room * 0.42), 140, 210);
  const photoH = Math.round(cardW * 0.8);
  const cardH = photoH + Math.round(80 * scale);
  const promoW = clamp(room - cardW, 150, 260);
  return {
    pad,
    gap,
    compact,
    actionsStacked: w < 330,
    actionIcon: clamp(Math.round(w * 0.125), 44, 60),
    actionChevron: 26,
    headerLogo: compact ? 48 : 64,
    headerButton: compact ? 40 : 46,
    brandSize: compact ? 28 : 36,
    cardW,
    photoH,
    cardH,
    promoW,
    promoH: Math.round(promoW * PROMO_RATIO),
    plusSize: clamp(Math.round(cardW * 0.26), 36, 48),
  };
}
