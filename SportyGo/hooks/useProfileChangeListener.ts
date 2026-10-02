import { useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/index";

/**
 * Calls `onChange` whenever any of the given users' profile docs change (name, photo, ...).
 *
 * Keeps one listener per user across re-renders: a new `userIds` array with the same IDs
 * (e.g. after match history refreshes) doesn't resubscribe, only IDs that drop out of the
 * list are unsubscribed, and everything is unsubscribed on unmount.
 */
export function useProfileChangeListener(userIds: string[], onChange: () => void) {
  const listenersRef = useRef<Map<string, () => void>>(new Map());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const listeners = listenersRef.current;
    const wanted = new Set(userIds);

    listeners.forEach((unsub, id) => {
      if (!wanted.has(id)) {
        unsub();
        listeners.delete(id);
      }
    });

    wanted.forEach((id) => {
      if (listeners.has(id)) return;
      let isFirstSnapshot = true;
      listeners.set(id, onSnapshot(doc(db, "users", id), () => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return; // The initial snapshot is the current state, not a change
        }
        onChangeRef.current();
      }));
    });
  }, [userIds]);

  useEffect(() => {
    const listeners = listenersRef.current;
    return () => {
      listeners.forEach((unsub) => unsub());
      listeners.clear();
    };
  }, []);
}
