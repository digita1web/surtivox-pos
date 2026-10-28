import * as FileSystem from 'expo-file-system/legacy';

const FILE_URI = FileSystem.documentDirectory + 'first-run-guide.json';

export async function hasSeenFirstRunGuide(): Promise<boolean> {
  try {
    const raw = await FileSystem.readAsStringAsync(FILE_URI, { encoding: FileSystem.EncodingType.UTF8 });
    return JSON.parse(raw).seen === true;
  } catch {
    return false;
  }
}

export async function markFirstRunGuideSeen(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FILE_URI, JSON.stringify({ seen: true }), { encoding: FileSystem.EncodingType.UTF8 });
  } catch {}
}

export async function resetFirstRunGuide(): Promise<void> {
  try {
    await FileSystem.deleteAsync(FILE_URI, { idempotent: true });
  } catch {}
}
