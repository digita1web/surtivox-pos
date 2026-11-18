const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

export function toFileUri(path: string): string {
  if (SCHEME.test(path)) return path;
  if (!path.startsWith('/')) throw new Error(`Se esperaba una ruta absoluta: ${path}`);
  return `file://${path}`;
}
