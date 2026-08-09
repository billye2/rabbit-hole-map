import {
  applyNavEvent,
  createSession,
  needsNewSession,
  normalizeUrl,
  shouldTrack,
  updateTitle,
  type NavEvent,
} from './model.js';
import * as store from './storage.js';

// Serialize all mutations: MV3 SW event handlers can interleave, and each one
// does read-modify-write on the same storage keys.
let queue: Promise<unknown> = Promise.resolve();
function enqueue(fn: () => Promise<void>): void {
  queue = queue.then(fn, fn).catch((err) => console.error('rabbit-hole-map:', err));
}

interface TabState {
  urls: Record<string, string>; // tabId -> last committed url
  openers: Record<string, string>; // tabId -> url of the page that opened it
}

// Kept in storage.session so it survives service-worker restarts.
async function getTabState(): Promise<TabState> {
  const st = await chrome.storage.session.get(['tabUrls', 'tabOpeners']);
  return {
    urls: (st.tabUrls as Record<string, string>) ?? {},
    openers: (st.tabOpeners as Record<string, string>) ?? {},
  };
}

async function setTabState(s: TabState): Promise<void> {
  await chrome.storage.session.set({ tabUrls: s.urls, tabOpeners: s.openers });
}

const EDGE_TRANSITIONS = new Set(['link', 'form_submit', 'client_redirect']);

async function recordNavigation(
  tabId: number,
  rawUrl: string,
  transitionType: string,
  time: number
): Promise<void> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.incognito) return;

  const settings = await store.loadSettings();
  if (!shouldTrack(rawUrl, settings.blocklist)) return;

  const url = normalizeUrl(rawUrl);
  const state = await getTabState();
  const key = String(tabId);
  const prev = state.urls[key];
  const opener = state.openers[key];

  if (prev === url && transitionType === 'reload') return;

  let sourceUrl: string | null = null;
  if (prev && prev !== url && EDGE_TRANSITIONS.has(transitionType)) sourceUrl = prev;
  else if (!prev && opener) sourceUrl = opener;

  state.urls[key] = url;
  delete state.openers[key];
  await setTabState(state);

  let session = null;
  const curId = await store.currentSessionId();
  if (curId) session = await store.loadSession(curId);
  if (needsNewSession(session, time)) {
    session = createSession(time);
    await store.setCurrentSessionId(session.id);
  }

  const ev: NavEvent = {
    url,
    sourceUrl,
    time,
    transition: transitionType,
    title: tab.title && tab.url && normalizeUrl(tab.url) === url ? tab.title : undefined,
  };
  applyNavEvent(session!, ev);
  await store.saveSession(session!);
}

chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId !== 0) return;
  enqueue(() => recordNavigation(d.tabId, d.url, d.transitionType, d.timeStamp));
});

// SPA navigations (pushState) — Wikipedia-style sites and most web apps.
chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId !== 0) return;
  enqueue(() => recordNavigation(d.tabId, d.url, d.transitionType || 'link', d.timeStamp));
});

// Cross-tab rabbit holes: remember which page spawned a new tab.
chrome.tabs.onCreated.addListener((tab) => {
  const tabId = tab.id;
  const openerId = tab.openerTabId;
  if (tabId == null || openerId == null) return;
  enqueue(async () => {
    const state = await getTabState();
    const openerUrl = state.urls[String(openerId)];
    if (openerUrl) {
      state.openers[String(tabId)] = openerUrl;
      await setTabState(state);
    }
  });
});

// Titles arrive after commit; patch them into the current session.
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (!info.title || !tab.url || tab.incognito) return;
  const url = tab.url;
  const title = info.title;
  enqueue(async () => {
    const curId = await store.currentSessionId();
    if (!curId) return;
    const session = await store.loadSession(curId);
    if (session && updateTitle(session, url, title)) await store.saveSession(session);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(async () => {
    const state = await getTabState();
    delete state.urls[String(tabId)];
    delete state.openers[String(tabId)];
    await setTabState(state);
  });
});
