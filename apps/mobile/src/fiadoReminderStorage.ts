import * as FileSystem from 'expo-file-system/legacy';
import { parseReminderCount, serializeReminderCount } from './fiadoReminderCounter';

const FILE_URI = FileSystem.documentDirectory + 'fiado-reminders.json';

export async function getReminderCount(): Promise<number> {
  try {
    return parseReminderCount(await FileSystem.readAsStringAsync(FILE_URI, { encoding: FileSystem.EncodingType.UTF8 }));
  } catch {
    return 0;
  }
}

export async function incrementReminderCount(): Promise<number> {
  const current = await getReminderCount();
  const next = current + 1;
  try {
    await FileSystem.writeAsStringAsync(FILE_URI, serializeReminderCount(next), { encoding: FileSystem.EncodingType.UTF8 });
    return next;
  } catch {
    return current;
  }
}
