import { renderHook } from '@testing-library/react-native';
import { mockFirestore } from './setup';
import { useProfileChangeListener } from '../hooks/useProfileChangeListener';

// Track each listener's snapshot callback and whether it has been unsubscribed
type Listener = { path: string; fire: () => void; unsubscribed: boolean };
let listeners: Listener[];

beforeEach(() => {
  listeners = [];
  mockFirestore.onSnapshot.mockImplementation(((ref: { path: string }, onNext: () => void) => {
    const listener: Listener = { path: ref.path, fire: onNext, unsubscribed: false };
    listeners.push(listener);
    return () => { listener.unsubscribed = true; };
  }) as any);
});

const active = () => listeners.filter((l) => !l.unsubscribed).map((l) => l.path).sort();

describe('useProfileChangeListener', () => {
  it('ignores the initial snapshot and reports later changes', () => {
    const onChange = jest.fn();
    renderHook(() => useProfileChangeListener(['u1'], onChange));
    listeners[0].fire();
    expect(onChange).not.toHaveBeenCalled();
    listeners[0].fire();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps existing listeners when the ID list is refreshed with a new array', () => {
    const onChange = jest.fn();
    const { rerender } = renderHook(({ ids }: { ids: string[] }) => useProfileChangeListener(ids, onChange), {
      initialProps: { ids: ['u1', 'u2'] },
    });
    listeners.forEach((l) => l.fire()); // initial snapshots

    // Same players, new array (what a match history refresh produces), plus one new player
    rerender({ ids: ['u1', 'u2', 'u3'] });
    expect(active()).toEqual(['users/u1', 'users/u2', 'users/u3']);
    expect(listeners).toHaveLength(3);

    // u1 changes after the refresh: still reported
    listeners[0].fire();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes players that drop out of the list, and everything on unmount', () => {
    const { rerender, unmount } = renderHook(({ ids }: { ids: string[] }) => useProfileChangeListener(ids, jest.fn()), {
      initialProps: { ids: ['u1', 'u2'] },
    });
    rerender({ ids: ['u2'] });
    expect(active()).toEqual(['users/u2']);
    unmount();
    expect(active()).toEqual([]);
  });

  it('calls the latest onChange without resubscribing', () => {
    const first = jest.fn();
    const second = jest.fn();
    const ids = ['u1'];
    const { rerender } = renderHook(({ cb }: { cb: () => void }) => useProfileChangeListener(ids, cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    expect(listeners).toHaveLength(1);
    listeners[0].fire();
    listeners[0].fire();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
