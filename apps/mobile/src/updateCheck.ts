import Constants from 'expo-constants';
import { getDb } from './db';
import { getLocalSetting, setLocalSetting } from './repos';
import {
  RELEASES_LATEST_URL, dismissUpdate, loadUpdateNotice, type UpdateDeps, type UpdateNotice, type UpdateSettings,
} from './appUpdate';

const REQUEST_TIMEOUT_MS = 6000;

const settings: UpdateSettings = {
  get: (key) => getLocalSetting(key),
  set: (key, value) => setLocalSetting(key, value),
  remove: async (key) => { await getDb().runAsync('DELETE FROM local_settings WHERE key=?', [key]); },
};

async function fetchLatest(): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASES_LATEST_URL, {
      headers: { accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    let body: unknown = null;
    try { body = await response.json(); } catch {}
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function deps(): UpdateDeps {
  return {
    settings,
    now: () => Date.now(),
    installedVersion: Constants.expoConfig?.version ?? null,
    fetchLatest,
  };
}

export function checkForUpdate(): Promise<UpdateNotice | null> {
  return loadUpdateNotice(deps());
}

export function dismissUpdateNotice(notice: UpdateNotice): Promise<void> {
  return dismissUpdate(settings, notice);
}
