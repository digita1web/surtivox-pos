export function pendingMigrationIds(
  migrationIds: readonly string[],
  appliedIds: readonly string[],
): string[] {
  const applied = new Set(appliedIds);
  return migrationIds.filter((id) => !applied.has(id));
}
