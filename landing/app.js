const FALLBACK_VERSION = '1.0.1';
const RELEASE_API = 'https://api.github.com/repos/digita1web/surtivox-pos/releases/latest';
const RELEASE_CACHE_KEY = 'surtivox-release-v1';
const RELEASE_CACHE_TTL = 15 * 60 * 1000;

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 0.1) {
    const kilobytes = bytes / 1024;
    return `${kilobytes.toFixed(0)} KB`;
  }
  return `${megabytes.toFixed(1).replace('.', ',')} MB`;
}

function applyVersion(version) {
  const clean = String(version || '').replace(/^v/i, '').trim();
  setText('[data-release-version]', clean || FALLBACK_VERSION);
}

function applySize(asset) {
  const size = formatBytes(Number(asset?.size));
  if (size) setText('[data-release-size]', `APK · ${size}`);
}

function readCachedRelease() {
  try {
    const raw = sessionStorage.getItem(RELEASE_CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (!cached || Date.now() - Number(cached.stored_at) > RELEASE_CACHE_TTL) return false;
    if (cached.release) {
      applyVersion(cached.release.tag_name);
      const assets = Array.isArray(cached.release.assets) ? cached.release.assets : [];
      const apk = assets.find((asset) => asset?.name === 'app-release.apk');
      if (apk) applySize(apk);
    }
    return true;
  } catch {
    return false;
  }
}

async function loadRelease() {
  if (readCachedRelease()) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('release_unavailable');
    const release = await response.json();
    applyVersion(release?.tag_name);
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const apk = assets.find((asset) => asset?.name === 'app-release.apk');
    if (apk) applySize(apk);
    try {
      sessionStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({
        stored_at: Date.now(),
        release: { tag_name: release?.tag_name, assets },
      }));
    } catch {}
  } catch {
    applyVersion(FALLBACK_VERSION);
  } finally {
    clearTimeout(timer);
  }
}

applyVersion(FALLBACK_VERSION);
loadRelease();
