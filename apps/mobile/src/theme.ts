import { useColorScheme } from 'react-native';

import { light, dark } from './themeColors';

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

// Deterministic tile color for a product "image" placeholder (used only when
// a product has no photo).
const TILE = ['#0ca678', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4', '#14b8a6'];
export function tileColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TILE[Math.abs(h) % TILE.length]!;
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// ---- Layout tokens: one scale for spacing, corner radius and type, so every screen lines up.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, pill: 999 } as const;
export const iconSize = { sm: 16, md: 20, lg: 26, xl: 32 } as const;
export const circle = (size: number) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }) as const;
export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  h1: { fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.2 },
  h2: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11.5, lineHeight: 15, fontWeight: '700', letterSpacing: 0.5 },
} as const;

export const brandType = {
  brand: { fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.8 },
  slogan: { fontSize: 13, lineHeight: 17, fontWeight: '700', fontStyle: 'italic' },
  cardTitle: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
  cardHint: { fontSize: 12, lineHeight: 16 },
  productName: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  price: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  section: { fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.3 },
} as const;

/** Height of the fixed screen header, below the status bar. */
export const HEADER_HEIGHT = 56;
/** Tab bar content height, above the bottom inset. */
export const TAB_BAR_HEIGHT = 60;
