import {clearLocalData} from './storage';

// Exact, app-owned localStorage keys only. No origin-wide clear(), no Supabase writes.
export const LOCAL_DATA_KEYS=[
  'money-tracker-iphone-review-token-v1',
  'money-tracker-iphone-seen-v1',
  'ngoentoday-line-session-v1',
  'ngoentoday-line-seen-v1',
  'ngoentoday-last-backup',
] as const;

/** Deletes Money Tracker data on this device; all remote transactions stay unchanged.
 * Clearing pairing tokens prevents an immediate background re-import of deleted data.
 */
export async function eraseLocalMoneyTrackerData():Promise<void>{
  await clearLocalData();
  for(const key of LOCAL_DATA_KEYS)localStorage.removeItem(key);
}
