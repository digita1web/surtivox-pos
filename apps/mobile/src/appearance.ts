import { useEffect } from 'react';
import { AppState, Appearance as NativeAppearance } from 'react-native';
import { create } from 'zustand';
import { getLocalSetting, setLocalSetting } from './repos';
import {
  DEFAULT_APPEARANCE, DEFAULT_SCHEDULE, FROM_OPTIONS, UNTIL_OPTIONS, oppositeMode, parseAppearance, parseHour, resolveScheme,
  type Appearance, type NightSchedule, type Scheme,
} from './themeMode';

const KEYS = { mode: 'appearance', from: 'night_from', until: 'night_until' } as const;

let applied: string | null = null;

function applyNative(mode: Appearance, scheme: Scheme): void {
  const value = mode === 'system' ? 'unspecified' : scheme;
  if (applied === value) return;
  applied = value;
  NativeAppearance.setColorScheme(value);
}

function systemScheme(): Scheme {
  return NativeAppearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

interface AppearanceState {
  mode: Appearance;
  schedule: NightSchedule;
  resolved: Scheme;
  load: () => Promise<void>;
  refresh: () => void;
  setMode: (mode: Appearance) => Promise<void>;
  setSchedule: (schedule: NightSchedule) => Promise<void>;
  toggle: () => Promise<void>;
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  mode: DEFAULT_APPEARANCE,
  schedule: DEFAULT_SCHEDULE,
  resolved: 'light',
  refresh: () => {
    const { mode, schedule, resolved } = get();
    if (mode === 'system') applyNative('system', 'light');
    const next = resolveScheme(mode, mode === 'system' ? systemScheme() : null, new Date(), schedule);
    applyNative(mode, next);
    if (next !== resolved) set({ resolved: next });
  },
  load: async () => {
    const read = (key: string) => getLocalSetting(key).catch(() => null);
    const [mode, from, until] = await Promise.all([read(KEYS.mode), read(KEYS.from), read(KEYS.until)]);
    set({
      mode: parseAppearance(mode),
      schedule: {
        from: parseHour(from, FROM_OPTIONS, DEFAULT_SCHEDULE.from),
        until: parseHour(until, UNTIL_OPTIONS, DEFAULT_SCHEDULE.until),
      },
    });
    get().refresh();
  },
  setMode: async (mode) => {
    set({ mode });
    get().refresh();
    await setLocalSetting(KEYS.mode, mode).catch(() => {});
  },
  setSchedule: async (schedule) => {
    set({ schedule });
    get().refresh();
    await Promise.all([
      setLocalSetting(KEYS.from, String(schedule.from)),
      setLocalSetting(KEYS.until, String(schedule.until)),
    ]).catch(() => {});
  },
  toggle: async () => {
    await get().setMode(oppositeMode(get().resolved));
  },
}));

export function useAppearanceSync(): void {
  useEffect(() => {
    const refresh = () => useAppearance.getState().refresh();
    const listener = NativeAppearance.addChangeListener(refresh);
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    const timer = setInterval(refresh, 60_000);
    return () => {
      listener.remove();
      app.remove();
      clearInterval(timer);
    };
  }, []);
}
