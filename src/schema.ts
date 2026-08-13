// The storage schema: every key name and seeded-record shape in one pure
// module (no chrome.*). The store, its in-memory fake, and the test and
// marketing seeders all import these — nothing else may spell a key name.
import type { Session, SessionMeta } from './model.js';

export const INDEX_KEY = 'sessionIndex';
export const CURRENT_KEY = 'currentSessionId';
export const SETTINGS_KEY = 'settings';
export const SEQ_KEY = 'writeSeq'; // bumped on every saveSession — the drain signal
export const SESSION_PREFIX = 'session:';

// chrome.storage.session area (survives service-worker restarts).
export const TAB_URLS_KEY = 'tabUrls';
export const TAB_OPENERS_KEY = 'tabOpeners';

export function sessionKey(id: string): string {
  return SESSION_PREFIX + id;
}

export function sessionIdOfKey(key: string): string | null {
  return key.startsWith(SESSION_PREFIX) ? key.slice(SESSION_PREFIX.length) : null;
}

export function sessionMeta(session: Session): SessionMeta {
  return { id: session.id, start: session.start, end: session.end, pages: Object.keys(session.nodes).length };
}

// One session as a complete seeded storage state — the single door tests
// and marketing scripts use to plant a session.
export function seedRecords(session: Session): Record<string, unknown> {
  return {
    [sessionKey(session.id)]: session,
    [CURRENT_KEY]: session.id,
    [INDEX_KEY]: [sessionMeta(session)],
  };
}
