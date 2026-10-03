import { findTempsToOffer, getSkippedTempIds, skipTempIds } from '../utils/claimPrompts';
import { checkForClaimableTemps } from '../firebase/services_firestore2';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../firebase/services_firestore2', () => ({ checkForClaimableTemps: jest.fn() }));

const temp = (id: string) => ({ id, Name: id, Email: '', Phone: '', Groups: [], Address: '', isTemp: true });

describe('claim prompts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (checkForClaimableTemps as jest.Mock).mockResolvedValue([temp('t1'), temp('t2')]);
  });

  it('offers every matching temp player at first', async () => {
    await expect(findTempsToOffer('me', 'me@example.com', '')).resolves.toHaveLength(2);
  });

  it("doesn't offer players the user skipped", async () => {
    await skipTempIds('me', ['t1']);
    const offered = await findTempsToOffer('me', 'me@example.com', '');
    expect(offered.map((t) => t.id)).toEqual(['t2']);
  });

  it('keeps skips per user', async () => {
    await skipTempIds('someone-else', ['t1']);
    await expect(findTempsToOffer('me', 'me@example.com', '')).resolves.toHaveLength(2);
  });

  it('skips accumulate and are cleared by sign-out (AsyncStorage.clear)', async () => {
    await skipTempIds('me', ['t1']);
    await skipTempIds('me', ['t2']);
    expect(Array.from(await getSkippedTempIds('me')).sort()).toEqual(['t1', 't2']);
    await AsyncStorage.clear();
    expect((await getSkippedTempIds('me')).size).toBe(0);
  });
});
