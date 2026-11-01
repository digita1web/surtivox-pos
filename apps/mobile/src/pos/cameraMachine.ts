export type CameraPhase = 'idle' | 'starting' | 'ready' | 'retrying' | 'failed' | 'denied' | 'blocked';
export type CameraPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

export interface CameraMachineState {
  phase: CameraPhase;
  focused: boolean;
  appActive: boolean;
  permission: CameraPermission;
  attempt: number;
  retries: number;
}

export type CameraEvent =
  | { type: 'mount' }
  | { type: 'ready' }
  | { type: 'timeout' }
  | { type: 'error' }
  | { type: 'retry' }
  | { type: 'blur' }
  | { type: 'focus' }
  | { type: 'appBackground' }
  | { type: 'appActive' }
  | { type: 'permission'; value: CameraPermission };

export function initialCameraState(appActive = true): CameraMachineState {
  return {
    phase: 'idle',
    focused: false,
    appActive,
    permission: 'unknown',
    attempt: 0,
    retries: 0,
  };
}

function canStart(state: CameraMachineState): boolean {
  return state.focused && state.appActive && state.permission === 'granted';
}

function start(state: CameraMachineState, resetRetries: boolean): CameraMachineState {
  return {
    ...state,
    phase: 'starting',
    attempt: state.attempt + 1,
    retries: resetRetries ? 0 : state.retries,
  };
}

function permissionPhase(permission: CameraPermission): CameraPhase | null {
  if (permission === 'denied') return 'denied';
  if (permission === 'blocked') return 'blocked';
  return null;
}

export function reduceCamera(state: CameraMachineState, event: CameraEvent): CameraMachineState {
  switch (event.type) {
    case 'mount':
      return state;

    case 'permission': {
      const permission = event.value;
      const denied = permissionPhase(permission);
      if (denied) return { ...state, permission, phase: denied };
      if (permission === 'unknown') {
        return { ...state, permission, phase: 'idle', retries: 0 };
      }
      if (canStart({ ...state, permission })) {
        if (state.phase === 'starting' || state.phase === 'retrying' || state.phase === 'ready') {
          return { ...state, permission };
        }
        return start({ ...state, permission }, true);
      }
      return { ...state, permission };
    }

    case 'focus': {
      const next = { ...state, focused: true };
      const denied = permissionPhase(next.permission);
      if (denied) return { ...next, phase: denied };
      if (canStart(next)) {
        if (next.phase === 'starting' || next.phase === 'retrying' || next.phase === 'ready') return next;
        return start(next, true);
      }
      return { ...next, phase: 'idle' };
    }

    case 'blur':
      return { ...state, focused: false, phase: 'idle', retries: 0 };

    case 'appBackground':
      return { ...state, appActive: false, phase: 'idle', retries: 0 };

    case 'appActive': {
      const next = { ...state, appActive: true };
      const denied = permissionPhase(next.permission);
      if (denied) return { ...next, phase: denied };
      if (canStart(next) && (next.phase === 'idle' || next.phase === 'failed')) {
        return start(next, true);
      }
      return next;
    }

    case 'retry': {
      const denied = permissionPhase(state.permission);
      if (denied) return { ...state, phase: denied };
      if (canStart(state)) return start(state, true);
      return { ...state, phase: 'idle', retries: 0 };
    }

    case 'ready':
      if (state.phase === 'starting' || state.phase === 'retrying') {
        return { ...state, phase: 'ready', retries: 0 };
      }
      return state;

    case 'timeout':
    case 'error':
      if (state.phase !== 'starting' && state.phase !== 'retrying' && state.phase !== 'ready') return state;
      if (state.retries < 2) {
        return {
          ...state,
          phase: 'retrying',
          retries: state.retries + 1,
          attempt: state.attempt + 1,
        };
      }
      return { ...state, phase: 'failed' };

    default:
      return state;
  }
}
