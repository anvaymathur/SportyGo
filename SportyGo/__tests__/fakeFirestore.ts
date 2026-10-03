/**
 * A small in-memory stand-in for the `firebase/firestore` functions the services use, so
 * service tests can check the data that's actually left behind (not just which calls were made).
 *
 * Supports: doc/collection refs (including subcollections), get/set(merge)/update/delete,
 * addDoc, write batches, transactions, query + where ('==', 'array-contains',
 * 'array-contains-any', 'in', documentId()), or(), onSnapshot, and the arrayUnion /
 * arrayRemove / increment field values. updateDoc on a missing doc throws, like Firestore.
 *
 * Usage in a test file:
 *   jest.mock('firebase/firestore', () => require('./fakeFirestore').firestoreModule);
 *   import { fakeDb } from './fakeFirestore';
 */

type Data = Record<string, any>;
type FieldValue = { __fieldValue: 'arrayUnion' | 'arrayRemove' | 'increment'; values: any[] };
type Ref = { type: 'doc' | 'collection'; path: string; id: string; parent?: Ref };
type Filter =
  | { kind: 'where'; field: string | typeof DOCUMENT_ID; op: string; value: any }
  | { kind: 'or'; filters: Filter[] };
type QueryRef = { type: 'query'; collectionPath: string; filters: Filter[] };

const DOCUMENT_ID = Symbol('documentId');

let store = new Map<string, Data>();
let autoId = 0;
type Listener = { target: Ref | QueryRef; next: (snap: any) => void };
let listeners: Listener[] = [];

// Deep copy that keeps Dates as Dates (JSON.stringify calls Date#toJSON before a replacer sees
// the value, so the replacer checks the original via `this[key]`)
function clone<T>(value: T): T {
  if (value === undefined) return value;
  const json = JSON.stringify(value, function (this: any, key: string, v: any) {
    return this[key] instanceof Date ? { __date: this[key].toISOString() } : v;
  });
  return JSON.parse(json, (_k, v) => (v && typeof v === 'object' && '__date' in v ? new Date(v.__date) : v));
}

const join = (segments: string[]) => segments.filter(Boolean).join('/');
const lastSegment = (path: string) => path.split('/').pop() as string;
const parentPath = (path: string) => path.split('/').slice(0, -1).join('/');

function makeDocRef(path: string): Ref {
  return { type: 'doc', path, id: lastSegment(path), parent: { type: 'collection', path: parentPath(path), id: lastSegment(parentPath(path)) } };
}

function docSnapshot(path: string) {
  const data = store.get(path);
  return {
    id: lastSegment(path),
    ref: makeDocRef(path),
    exists: () => data !== undefined,
    data: () => clone(data),
  };
}

function querySnapshot(paths: string[]) {
  const docs = paths.map(docSnapshot);
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: (d: any) => void) => docs.forEach(fn) };
}

function isFieldValue(v: any): v is FieldValue {
  return v && typeof v === 'object' && '__fieldValue' in v;
}

function applyFieldValue(current: any, fv: FieldValue) {
  const key = (x: any) => JSON.stringify(x);
  if (fv.__fieldValue === 'increment') return (typeof current === 'number' ? current : 0) + fv.values[0];
  const arr: any[] = Array.isArray(current) ? [...current] : [];
  if (fv.__fieldValue === 'arrayUnion') {
    fv.values.forEach((v) => { if (!arr.some((x) => key(x) === key(v))) arr.push(v); });
    return arr;
  }
  return arr.filter((x) => !fv.values.some((v) => key(v) === key(x)));
}

function applyUpdates(existing: Data, updates: Data): Data {
  const result = { ...existing };
  Object.entries(updates).forEach(([field, value]) => {
    result[field] = isFieldValue(value) ? applyFieldValue(existing[field], value) : clone(value);
  });
  return result;
}

function notify() {
  listeners.forEach((l) => l.next(snapshotFor(l.target)));
}

function snapshotFor(target: Ref | QueryRef) {
  if (target.type === 'doc') return docSnapshot(target.path);
  return querySnapshot(runQuery(target.type === 'query' ? target : { type: 'query', collectionPath: target.path, filters: [] }));
}

function matches(path: string, data: Data, filter: Filter): boolean {
  if (filter.kind === 'or') return filter.filters.some((f) => matches(path, data, f));
  const value = filter.field === DOCUMENT_ID ? lastSegment(path) : data[filter.field as string];
  switch (filter.op) {
    case '==': return JSON.stringify(value ?? null) === JSON.stringify(filter.value ?? null);
    case 'array-contains': return Array.isArray(value) && value.includes(filter.value);
    case 'array-contains-any': return Array.isArray(value) && value.some((v) => filter.value.includes(v));
    case 'in': return filter.value.includes(value);
    default: throw new Error(`fakeFirestore: unsupported operator ${filter.op}`);
  }
}

function runQuery(q: QueryRef): string[] {
  return Array.from(store.keys())
    .filter((path) => parentPath(path) === q.collectionPath)
    .filter((path) => q.filters.every((f) => matches(path, store.get(path)!, f)))
    .sort();
}

function setDocImpl(ref: Ref, data: Data, options?: { merge?: boolean }) {
  const existing = store.get(ref.path);
  if (options?.merge) {
    store.set(ref.path, applyUpdates(existing ?? {}, data));
  } else {
    store.set(ref.path, applyUpdates({}, data));
  }
}

function updateDocImpl(ref: Ref, data: Data) {
  const existing = store.get(ref.path);
  if (!existing) {
    const error: any = new Error(`No document to update: ${ref.path}`);
    error.code = 'not-found';
    throw error;
  }
  store.set(ref.path, applyUpdates(existing, data));
}

export const firestoreModule = {
  getFirestore: () => ({}),
  collection: (parent: any, ...segments: string[]) => {
    const base = parent && parent.type === 'doc' ? parent.path : '';
    const path = join([base, ...segments]);
    return { type: 'collection', path, id: lastSegment(path) } as Ref;
  },
  doc: (parent: any, ...segments: string[]) => {
    if (parent && parent.type === 'collection' && segments.length === 0) {
      return makeDocRef(`${parent.path}/auto${++autoId}`);
    }
    const base = parent && (parent.type === 'collection' || parent.type === 'doc') ? parent.path : '';
    return makeDocRef(join([base, ...segments]));
  },
  documentId: () => DOCUMENT_ID,
  where: (field: any, op: string, value: any): Filter => ({ kind: 'where', field, op, value }),
  or: (...filters: Filter[]): Filter => ({ kind: 'or', filters }),
  query: (col: Ref | QueryRef, ...filters: Filter[]): QueryRef => ({
    type: 'query',
    collectionPath: col.type === 'query' ? col.collectionPath : col.path,
    filters: [...(col.type === 'query' ? col.filters : []), ...filters],
  }),
  getDoc: async (ref: Ref) => docSnapshot(ref.path),
  getDocs: async (target: Ref | QueryRef) => snapshotFor(target),
  setDoc: async (ref: Ref, data: Data, options?: { merge?: boolean }) => { setDocImpl(ref, data, options); notify(); },
  updateDoc: async (ref: Ref, data: Data) => { updateDocImpl(ref, data); notify(); },
  deleteDoc: async (ref: Ref) => { store.delete(ref.path); notify(); },
  addDoc: async (col: Ref, data: Data) => {
    const ref = makeDocRef(`${col.path}/auto${++autoId}`);
    setDocImpl(ref, data);
    notify();
    return ref;
  },
  writeBatch: () => {
    const ops: (() => void)[] = [];
    const batch = {
      set: (ref: Ref, data: Data, options?: { merge?: boolean }) => { ops.push(() => setDocImpl(ref, data, options)); return batch; },
      update: (ref: Ref, data: Data) => { ops.push(() => updateDocImpl(ref, data)); return batch; },
      delete: (ref: Ref) => { ops.push(() => store.delete(ref.path)); return batch; },
      commit: async () => {
        // All-or-nothing, like a real batch
        const before = new Map(store);
        try { ops.forEach((op) => op()); } catch (e) { store = before; throw e; }
        notify();
      },
    };
    return batch;
  },
  runTransaction: async (_db: unknown, fn: (tx: any) => Promise<any>) => {
    const ops: (() => void)[] = [];
    const tx = {
      get: async (ref: Ref) => docSnapshot(ref.path),
      set: (ref: Ref, data: Data, options?: { merge?: boolean }) => { ops.push(() => setDocImpl(ref, data, options)); return tx; },
      update: (ref: Ref, data: Data) => { ops.push(() => updateDocImpl(ref, data)); return tx; },
      delete: (ref: Ref) => { ops.push(() => store.delete(ref.path)); return tx; },
    };
    const result = await fn(tx);
    const before = new Map(store);
    try { ops.forEach((op) => op()); } catch (e) { store = before; throw e; }
    notify();
    return result;
  },
  onSnapshot: (target: Ref | QueryRef, next: (snap: any) => void, _error?: (e: Error) => void) => {
    const listener = { target, next };
    listeners.push(listener);
    next(snapshotFor(target));
    return () => { listeners = listeners.filter((l) => l !== listener); };
  },
  arrayUnion: (...values: any[]): FieldValue => ({ __fieldValue: 'arrayUnion', values }),
  arrayRemove: (...values: any[]): FieldValue => ({ __fieldValue: 'arrayRemove', values }),
  increment: (n: number): FieldValue => ({ __fieldValue: 'increment', values: [n] }),
  Timestamp: { fromDate: (d: Date) => d, now: () => new Date() },
};

/** Test helpers for seeding and inspecting the in-memory database. */
export const fakeDb = {
  reset() {
    store = new Map();
    listeners = [];
    autoId = 0;
  },
  set(path: string, data: Data) {
    store.set(path, clone(data));
  },
  get(path: string): Data | undefined {
    return clone(store.get(path));
  },
  has(path: string): boolean {
    return store.has(path);
  },
  /** Doc IDs directly inside a collection path, e.g. "events/e1/userVotes". */
  ids(collectionPath: string): string[] {
    return Array.from(store.keys()).filter((p) => parentPath(p) === collectionPath).map(lastSegment).sort();
  },
  listenerCount: () => listeners.length,
};
