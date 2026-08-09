import type { Session, SessionMeta } from './model.js';

const INDEX_KEY = 'sessionIndex';
const CURRENT_KEY = 'currentSessionId';
const SETTINGS_KEY = 'settings';

export interface Settings {
  blocklist: string[];
}

export function sessionKey(id: string): string {
  return 'session:' + id;
}

export async function loadIndex(): Promise<SessionMeta[]> {
  const st = await chrome.storage.local.get(INDEX_KEY);
  return (st[INDEX_KEY] as SessionMeta[] | undefined) ?? [];
}

export async function loadSession(id: string): Promise<Session | null> {
  const st = await chrome.storage.local.get(sessionKey(id));
  return (st[sessionKey(id)] as Session | undefined) ?? null;
}

export async function saveSession(session: Session): Promise<void> {
  const index = await loadIndex();
  const meta: SessionMeta = {
    id: session.id,
    start: session.start,
    end: session.end,
    pages: Object.keys(session.nodes).length,
  };
  const i = index.findIndex((m) => m.id === session.id);
  if (i >= 0) index[i] = meta;
  else index.push(meta);
  await chrome.storage.local.set({ [sessionKey(session.id)]: session, [INDEX_KEY]: index });
}

export async function currentSessionId(): Promise<string | null> {
  const st = await chrome.storage.local.get(CURRENT_KEY);
  return (st[CURRENT_KEY] as string | undefined) ?? null;
}

export async function setCurrentSessionId(id: string): Promise<void> {
  await chrome.storage.local.set({ [CURRENT_KEY]: id });
}

export async function loadSettings(): Promise<Settings> {
  const st = await chrome.storage.local.get(SETTINGS_KEY);
  return { blocklist: [], ...((st[SETTINGS_KEY] as Partial<Settings> | undefined) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: s });
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
  await chrome.storage.session.clear().catch(() => {});
}
