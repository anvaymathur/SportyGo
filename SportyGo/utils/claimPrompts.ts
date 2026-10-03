import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForClaimableTemps } from '@/firebase/services_firestore2';
import { UserDoc } from '@/firebase/types_index';

// Skipped temp players are remembered on this device until sign-out (which clears storage),
// so "Skip for now" doesn't bring the claim screen back on every app launch.
const skippedKey = (userId: string) => `claimSkipped:${userId}`;

export async function getSkippedTempIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(skippedKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function skipTempIds(userId: string, tempIds: string[]): Promise<void> {
  if (tempIds.length === 0) return;
  const skipped = await getSkippedTempIds(userId);
  tempIds.forEach((id) => skipped.add(id));
  try {
    await AsyncStorage.setItem(skippedKey(userId), JSON.stringify(Array.from(skipped)));
  } catch (e) {
    console.error('Failed to remember skipped players', e);
  }
}

/** Temp players matching the user's email/phone that they haven't skipped on this device. */
export async function findTempsToOffer(userId: string, email: string, phone: string): Promise<UserDoc[]> {
  const [claimable, skipped] = await Promise.all([checkForClaimableTemps(email, phone), getSkippedTempIds(userId)]);
  return claimable.filter((temp) => !skipped.has(temp.id));
}
