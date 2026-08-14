// The Session Store: the one module that talks to chrome.storage. It owns
// the key schema (via schema.ts), the index bookkeeping, the tab state, the
// write-sequence drain signal, and the change stream — including the fact
// that the background writes currentSessionId BEFORE the session data.
//
// The store is written against a StorageBackend seam with two adapters:
// the chrome-backed one used by every extension page, and an in-memory
// fake (memoryBackend) that puts the store's own logic on the unit-test
// seam (emitted as dist/storage.mjs).
import type { Session, SessionMeta } from './model.js';
import {
  CURRENT_KEY,
  INDEX_KEY,
  SEQ_KEY,
  SETTINGS_KEY,
  TAB_OPENERS_KEY,
  TAB_URLS_KEY,
  sessionIdOfKey,
  sessionKey,
  sessionMeta,
} from './schema.js';

export interface Settings {
  blocklist: string[];
}

export interface TabState {
  urls: Record<string, string>; // tabId -> last committed url
  openers: Record<string, string>; // tabId -> url of the page that opened it
}

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export interface KeyValueArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  clear(): Promise<void>;
}

export interface StorageBackend {
  local: KeyValueArea;
  session: KeyValueArea; // survives service-worker restarts
  onChanged(cb: (changes: Record<string, StorageChange>) => void): void; // local-area changes
}

export interface SessionStreamHandlers {
  // The current session was adopted (currentSessionId changed) and its data
  // is loadable — delivery waits out the current-before-data write order.
  onCurrentSession?(session: Session): void;
  // A session record was written. liveNodeIds names the nodes this very
  // write visited — newly added OR re-visited, i.e. their visit count grew
  // (oldValue → newValue diff): the "a site was visited live" signal —
  // re-renders and replay can never fabricate it. Content-only writes
  // (title patches) name nothing.
  onSession?(session: Session, liveNodeIds: string[]): void;
  onIndex?(index: SessionMeta[]): void;
}

export function createSessionStore(backend: StorageBackend) {
  async function loadIndex(): Promise<SessionMeta[]> {
    const st = await backend.local.get(INDEX_KEY);
    return (st[INDEX_KEY] as SessionMeta[] | undefined) ?? [];
  }

  async function loadSession(id: string): Promise<Session | null> {
    const st = await backend.local.get(sessionKey(id));
    return (st[sessionKey(id)] as Session | undefined) ?? null;
  }

  async function saveSession(session: Session): Promise<void> {
    const st = await backend.local.get([INDEX_KEY, SEQ_KEY]);
    const index = (st[INDEX_KEY] as SessionMeta[] | undefined) ?? [];
    const meta = sessionMeta(session);
    const i = index.findIndex((m) => m.id === session.id);
    if (i >= 0) index[i] = meta;
    else index.push(meta);
    const seq = ((st[SEQ_KEY] as number | undefined) ?? 0) + 1;
    await backend.local.set({ [sessionKey(session.id)]: session, [INDEX_KEY]: index, [SEQ_KEY]: seq });
  }

  async function currentSessionId(): Promise<string | null> {
    const st = await backend.local.get(CURRENT_KEY);
    return (st[CURRENT_KEY] as string | undefined) ?? null;
  }

  async function setCurrentSessionId(id: string): Promise<void> {
    await backend.local.set({ [CURRENT_KEY]: id });
  }

  async function loadSettings(): Promise<Settings> {
    const st = await backend.local.get(SETTINGS_KEY);
    return { blocklist: [], ...((st[SETTINGS_KEY] as Partial<Settings> | undefined) ?? {}) };
  }

  async function saveSettings(s: Settings): Promise<void> {
    await backend.local.set({ [SETTINGS_KEY]: s });
  }

  async function loadTabState(): Promise<TabState> {
    const st = await backend.session.get([TAB_URLS_KEY, TAB_OPENERS_KEY]);
    return {
      urls: (st[TAB_URLS_KEY] as Record<string, string>) ?? {},
      openers: (st[TAB_OPENERS_KEY] as Record<string, string>) ?? {},
    };
  }

  async function saveTabState(s: TabState): Promise<void> {
    await backend.session.set({ [TAB_URLS_KEY]: s.urls, [TAB_OPENERS_KEY]: s.openers });
  }

  async function clearAllData(): Promise<void> {
    await backend.local.clear();
    await backend.session.clear().catch(() => {});
  }

  function onSessionsChanged(h: SessionStreamHandlers): void {
    // A currentSessionId whose data hasn't landed yet: hold the adoption
    // until the matching session record is written.
    let pendingCurrentId: string | null = null;
    backend.onChanged((changes) => {
      const cur = changes[CURRENT_KEY];
      if (cur && typeof cur.newValue === 'string') {
        const id = cur.newValue;
        const inBatch = changes[sessionKey(id)]?.newValue as Session | undefined;
        if (inBatch) {
          h.onCurrentSession?.(inBatch);
        } else {
          pendingCurrentId = id;
          void loadSession(id).then((s) => {
            if (s && pendingCurrentId === id) {
              pendingCurrentId = null;
              h.onCurrentSession?.(s);
            }
          });
        }
      }
      for (const [key, ch] of Object.entries(changes)) {
        const id = sessionIdOfKey(key);
        if (id == null || ch.newValue == null) continue;
        const s = ch.newValue as Session;
        if (pendingCurrentId === id) {
          pendingCurrentId = null;
          h.onCurrentSession?.(s);
        }
        const oldNodes = (ch.oldValue as Session | undefined)?.nodes ?? {};
        h.onSession?.(
          s,
          Object.keys(s.nodes).filter((nodeId) => {
            const before = oldNodes[nodeId];
            return !before || s.nodes[nodeId].visits > before.visits;
          }),
        );
      }
      const idx = changes[INDEX_KEY];
      if (idx?.newValue) h.onIndex?.(idx.newValue as SessionMeta[]);
    });
  }

  return {
    loadIndex,
    loadSession,
    saveSession,
    currentSessionId,
    setCurrentSessionId,
    loadSettings,
    saveSettings,
    loadTabState,
    saveTabState,
    clearAllData,
    onSessionsChanged,
  };
}

// Adapter 1: chrome.storage. chrome.* is only touched inside the closures,
// so this module stays importable under plain Node.
function chromeBackend(): StorageBackend {
  const area = (name: 'local' | 'session'): KeyValueArea => ({
    get: (keys) => chrome.storage[name].get(keys),
    set: (items) => chrome.storage[name].set(items),
    clear: () => chrome.storage[name].clear(),
  });
  return {
    local: area('local'),
    session: area('session'),
    onChanged: (cb) =>
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') cb(changes);
      }),
  };
}

// Adapter 2: in-memory fake with chrome's change-event semantics (one event
// per set/clear, oldValue/newValue per key) — the unit tests' adapter.
export function memoryBackend(): StorageBackend {
  const listeners: ((changes: Record<string, StorageChange>) => void)[] = [];
  const makeArea = (emits: boolean): KeyValueArea => {
    const data = new Map<string, unknown>();
    const emit = (changes: Record<string, StorageChange>) => {
      if (emits && Object.keys(changes).length) for (const l of listeners) l(changes);
    };
    return {
      get: (keys) => {
        const wanted = keys == null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
        const out: Record<string, unknown> = {};
        for (const k of wanted) if (data.has(k)) out[k] = structuredClone(data.get(k));
        return Promise.resolve(out);
      },
      set: (items) => {
        const changes: Record<string, StorageChange> = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: data.has(k) ? structuredClone(data.get(k)) : undefined, newValue: structuredClone(v) };
          data.set(k, structuredClone(v));
        }
        emit(changes);
        return Promise.resolve();
      },
      clear: () => {
        const changes: Record<string, StorageChange> = {};
        for (const [k, v] of data) changes[k] = { oldValue: structuredClone(v) };
        data.clear();
        emit(changes);
        return Promise.resolve();
      },
    };
  };
  return { local: makeArea(true), session: makeArea(false), onChanged: (cb) => listeners.push(cb) };
}

const def = createSessionStore(chromeBackend());

export const loadIndex = def.loadIndex;
export const loadSession = def.loadSession;
export const saveSession = def.saveSession;
export const currentSessionId = def.currentSessionId;
export const setCurrentSessionId = def.setCurrentSessionId;
export const loadSettings = def.loadSettings;
export const saveSettings = def.saveSettings;
export const loadTabState = def.loadTabState;
export const saveTabState = def.saveTabState;
export const clearAllData = def.clearAllData;
export const onSessionsChanged = def.onSessionsChanged;
