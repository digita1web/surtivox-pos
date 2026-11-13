export const DEVELOPER_MODE_KEY = 'developer_mode';

export type SettingWriter = (key: string, value: string) => Promise<void>;

export function isDeveloperMode(value: string | null): boolean {
  return value === '1';
}

export async function writeDeveloperMode(write: SettingWriter, enabled: boolean): Promise<void> {
  await write(DEVELOPER_MODE_KEY, enabled ? '1' : '0');
}
