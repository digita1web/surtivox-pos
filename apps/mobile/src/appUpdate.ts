export const UPDATE_REPO = 'digita1web/surtivox-pos';
export const RELEASES_LATEST_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
export const PREFERRED_APK_NAME = 'Surtivox.apk';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const UPDATE_KEYS = {
  lastCheckAt: 'update_last_check_at',
  release: 'update_release',
  dismissed: 'update_dismissed_version',
} as const;

export type Triple = readonly [number, number, number];

export interface ReleaseInfo {
  version: string;
  htmlUrl: string;
  apkUrl: string | null;
}

export interface UpdateNotice extends ReleaseInfo {}

export interface UpdateSettings {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

export interface UpdateDeps {
  settings: UpdateSettings;
  now: () => number;
  installedVersion: string | null;
  fetchLatest: () => Promise<{ status: number; body: unknown }>;
}

const SEMVER = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;
const REPO_PAGE = `https://github.com/${UPDATE_REPO}/`;

export function parseVersion(text: unknown): Triple | null {
  if (typeof text !== 'string') return null;
  const match = SEMVER.exec(text.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a: Triple, b: Triple): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]! ? 1 : -1;
  }
  return 0;
}

export function formatVersion(version: Triple): string {
  return `v${version[0]}.${version[1]}.${version[2]}`;
}

function isRepoUrl(value: unknown, prefix: string): value is string {
  return typeof value === 'string' && value.startsWith(prefix) && value.length < 500 && !/\s/.test(value);
}

export function parseRelease(body: unknown): ReleaseInfo | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  if (data.draft === true || data.prerelease === true) return null;
  const version = parseVersion(data.tag_name);
  if (!version) return null;
  if (!isRepoUrl(data.html_url, REPO_PAGE)) return null;
  let apkUrl: string | null = null;
  if (Array.isArray(data.assets)) {
    let fallback: string | null = null;
    for (const asset of data.assets) {
      if (typeof asset !== 'object' || asset === null) continue;
      const { name, browser_download_url: url } = asset as Record<string, unknown>;
      if (typeof name !== 'string' || !name.toLowerCase().endsWith('.apk')) continue;
      if (!isRepoUrl(url, `${REPO_PAGE}releases/download/`)) continue;
      if (name === PREFERRED_APK_NAME) { apkUrl = url; break; }
      if (fallback === null) fallback = url;
    }
    if (apkUrl === null) apkUrl = fallback;
  }
  return { version: formatVersion(version), htmlUrl: data.html_url, apkUrl };
}

export function isCheckDue(lastCheckAt: number | null, now: number): boolean {
  if (lastCheckAt === null || !Number.isFinite(lastCheckAt) || lastCheckAt <= 0) return true;
  if (lastCheckAt > now) return true;
  return now - lastCheckAt >= UPDATE_CHECK_INTERVAL_MS;
}

export function decideNotice(input: {
  installedVersion: string | null;
  release: ReleaseInfo | null;
  dismissedVersion: string | null;
}): UpdateNotice | null {
  const installed = parseVersion(input.installedVersion);
  const latest = input.release ? parseVersion(input.release.version) : null;
  if (!installed || !latest || !input.release) return null;
  if (compareVersions(latest, installed) <= 0) return null;
  const dismissed = parseVersion(input.dismissedVersion);
  if (dismissed && compareVersions(dismissed, latest) >= 0) return null;
  return input.release;
}

function readStoredRelease(raw: string | null): ReleaseInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseRelease({
      tag_name: parsed.version,
      html_url: parsed.htmlUrl,
      assets: typeof parsed.apkUrl === 'string' ? [{ name: 'app.apk', browser_download_url: parsed.apkUrl }] : [],
    });
  } catch {
    return null;
  }
}

async function refreshRelease(deps: UpdateDeps): Promise<void> {
  const raw = await deps.settings.get(UPDATE_KEYS.lastCheckAt);
  const last = raw === null ? null : Number(raw);
  if (!isCheckDue(last !== null && Number.isFinite(last) ? last : null, deps.now())) return;
  let response: { status: number; body: unknown };
  try {
    response = await deps.fetchLatest();
  } catch {
    return;
  }
  await deps.settings.set(UPDATE_KEYS.lastCheckAt, String(deps.now()));
  if (response.status !== 200 && response.status !== 404) return;
  const release = response.status === 200 ? parseRelease(response.body) : null;
  if (release) await deps.settings.set(UPDATE_KEYS.release, JSON.stringify(release));
  else await deps.settings.remove(UPDATE_KEYS.release);
}

export async function loadUpdateNotice(deps: UpdateDeps): Promise<UpdateNotice | null> {
  try {
    await refreshRelease(deps);
    const release = readStoredRelease(await deps.settings.get(UPDATE_KEYS.release));
    const dismissedVersion = await deps.settings.get(UPDATE_KEYS.dismissed);
    return decideNotice({ installedVersion: deps.installedVersion, release, dismissedVersion });
  } catch {
    return null;
  }
}

export async function dismissUpdate(settings: UpdateSettings, notice: UpdateNotice): Promise<void> {
  await settings.set(UPDATE_KEYS.dismissed, notice.version);
}
