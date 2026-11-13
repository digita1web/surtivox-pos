const STRICT_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

export type ReleaseTagCheck = { ok: true } | { ok: false; reason: string };

export function checkReleaseTag(tag: string, version: unknown, versionCode: unknown): ReleaseTagCheck {
  if (!STRICT_TAG.test(tag)) {
    return { ok: false, reason: `La etiqueta "${tag}" no tiene el formato vX.Y.Z.` };
  }
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    return { ok: false, reason: 'app.json no tiene una versión X.Y.Z válida.' };
  }
  if (tag !== `v${version}`) {
    return { ok: false, reason: `La etiqueta ${tag} no coincide con la versión ${version} de app.json. Súbela en app.json o corrige la etiqueta.` };
  }
  if (!Number.isInteger(versionCode) || (versionCode as number) < 1) {
    return { ok: false, reason: 'app.json no tiene un versionCode de Android entero y positivo.' };
  }
  return { ok: true };
}
