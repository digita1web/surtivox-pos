import { create } from 'zustand';

export type TourTarget = 'home' | 'products' | 'sales' | 'more';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourTargetsState {
  targets: Partial<Record<TourTarget, TourRect>>;
  setTarget: (id: TourTarget, rect: TourRect) => void;
}

export const useTourTargets = create<TourTargetsState>((set) => ({
  targets: {},
  setTarget: (id, rect) => set((state) => {
    const previous = state.targets[id];
    if (previous && previous.x === rect.x && previous.y === rect.y && previous.width === rect.width && previous.height === rect.height) return state;
    return { targets: { ...state.targets, [id]: rect } };
  }),
}));
