import { fmtDuration, longestChain, topDomain } from '../model.js';
import * as store from '../storage.js';

async function init(): Promise<void> {
  const curId = await store.currentSessionId();
  const session = curId ? await store.loadSession(curId) : null;

  const statsEl = document.getElementById('stats')!;
  const noneEl = document.getElementById('none')!;
  const wastedEl = document.getElementById('wasted')!;

  if (session && Object.keys(session.nodes).length > 0) {
    statsEl.hidden = false;
    document.getElementById('pages')!.textContent = String(Object.keys(session.nodes).length);
    document.getElementById('hops')!.textContent = String(session.edges.length);
    document.getElementById('chain')!.textContent = `${longestChain(session)} pages`;
    document.getElementById('domain')!.textContent = topDomain(session) ?? '—';
    wastedEl.hidden = false;
    wastedEl.textContent = `⏱ ${fmtDuration(session.end - session.start)} gloriously wasted`;
  } else {
    noneEl.hidden = false;
  }

  document.getElementById('open')!.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/map/map.html') });
    window.close();
  });
}

init();
