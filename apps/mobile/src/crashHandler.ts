import { setLocalSetting } from './repos';
import { truncateErrorMessage } from './diagnostics';

interface ErrorUtilsLike {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

let installed = false;

export function installGlobalErrorHandler(): void {
  if (installed) return;
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!utils) return;
  installed = true;
  let previous: (error: unknown, isFatal?: boolean) => void = () => {};
  try { previous = utils.getGlobalHandler(); } catch {}
  utils.setGlobalHandler((error, isFatal) => {
    try {
      const message = truncateErrorMessage(error);
      void setLocalSetting('last_error', JSON.stringify({ at: Date.now(), message })).catch(() => {});
    } catch {}
    previous(error, isFatal);
  });
}
