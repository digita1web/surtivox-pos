export function cloudCardSubtitle(active: boolean, syncedAt: number | null): string {
  if (!active) return 'Respalda y sincroniza tu negocio entre dispositivos';
  return syncedAt ? 'Tu negocio está respaldado y sincronizado' : 'Activado, pero aún no se ha sincronizado';
}
