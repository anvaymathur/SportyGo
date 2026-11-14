import { mockAuth, mockFirebaseAuth } from './setup';
import { ensureFirebaseSession, readFirebaseToken, isPermissionDenied, FIREBASE_TOKEN_CLAIM } from '../utils/firebaseSession';

/** An unsigned JWT with the given payload (only the payload is read on the device). */
const idToken = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const withToken = (customToken: string) => ({ idToken: idToken({ sub: 'u1', [FIREBASE_TOKEN_CLAIM]: customToken }) });

const signsInAs = (uid: string) =>
  mockFirebaseAuth.signInWithCustomToken.mockImplementation(async () => {
    mockAuth.currentUser = { uid };
    return { user: { uid } };
  });

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockFirebaseAuth.signInWithCustomToken.mockReset();
});

describe('readFirebaseToken', () => {
  it('reads the claim from an ID token', () => {
    expect(readFirebaseToken(withToken('custom-abc').idToken)).toBe('custom-abc');
  });

  it('returns null when the claim is missing or the token is unreadable', () => {
    expect(readFirebaseToken(idToken({ sub: 'u1' }))).toBeNull();
    expect(readFirebaseToken('not-a-jwt')).toBeNull();
    expect(readFirebaseToken(undefined)).toBeNull();
  });
});

describe('ensureFirebaseSession', () => {
  it('does nothing when Firebase is already signed in as the user', async () => {
    mockAuth.currentUser = { uid: 'u1' };
    const getCredentials = jest.fn();
    expect(await ensureFirebaseSession('u1', getCredentials)).toBe(true);
    expect(getCredentials).not.toHaveBeenCalled();
  });

  it('signs in with the token from the stored ID token', async () => {
    signsInAs('u1');
    const getCredentials = jest.fn(async () => withToken('custom-abc'));
    expect(await ensureFirebaseSession('u1', getCredentials)).toBe(true);
    expect(mockFirebaseAuth.signInWithCustomToken).toHaveBeenCalledWith(mockAuth, 'custom-abc');
    expect(getCredentials).toHaveBeenCalledTimes(1);
  });

  it('refreshes the ID token when the stored one has no usable token', async () => {
    mockFirebaseAuth.signInWithCustomToken
      .mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'auth/invalid-custom-token' }))
      .mockImplementationOnce(async () => ({ user: { uid: 'u1' } }));
    const getCredentials = jest.fn(async (_s?: string, _t?: number, _p?: object, forceRefresh?: boolean) =>
      withToken(forceRefresh ? 'fresh' : 'stale'));
    expect(await ensureFirebaseSession('u1', getCredentials)).toBe(true);
    expect(mockFirebaseAuth.signInWithCustomToken).toHaveBeenLastCalledWith(mockAuth, 'fresh');
  });

  it('signs out a different leftover session first', async () => {
    mockAuth.currentUser = { uid: 'someone-else' };
    signsInAs('u1');
    expect(await ensureFirebaseSession('u1', jest.fn(async () => withToken('custom-abc')))).toBe(true);
    expect(mockFirebaseAuth.signOut).toHaveBeenCalled();
  });

  it('returns false, without throwing, when no token is available', async () => {
    const getCredentials = jest.fn()
      .mockResolvedValueOnce({ idToken: idToken({ sub: 'u1' }) })
      .mockRejectedValueOnce(new Error('no refresh token'));
    expect(await ensureFirebaseSession('u1', getCredentials)).toBe(false);
    expect(mockFirebaseAuth.signInWithCustomToken).not.toHaveBeenCalled();
  });

  it('refuses a token that belongs to a different user', async () => {
    signsInAs('someone-else');
    expect(await ensureFirebaseSession('u1', jest.fn(async () => withToken('custom-abc')))).toBe(false);
    expect(mockAuth.currentUser).toBeNull();
  });
});

describe('isPermissionDenied', () => {
  it('recognises Firestore rule refusals only', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
    expect(isPermissionDenied({ code: 'unavailable' })).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
  });
});
