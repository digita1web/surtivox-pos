import * as Updates from 'expo-updates';

export type UpdateCheckResult =
  | 'disabled'
  | 'up_to_date'
  | 'available'
  | 'downloaded'
  | 'error';

export async function checkForUpdatesInBackground(): Promise<UpdateCheckResult> {
  if (__DEV__ || !Updates.isEnabled) return 'disabled';

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'up_to_date';

    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew ? 'downloaded' : 'available';
  } catch {
    return 'error';
  }
}
