// The shared demo session used by every marketing asset (screenshots and
// promo video), so they all tell the same story: an innocent carbonara
// search that ends, ~1h45m later, deep in trebuchet memes.
import { seedRecords } from '../dist/schema.mjs';

export function makeSession() {
  const nodes = {};
  const edges = [];
  let time = Date.now() - 105 * 60e3; // ~1h45m of glorious wasting
  const visit = (url, title, from, extraVisits = 0) => {
    time += 5 * 60e3 + Math.floor(Math.random() * 4 * 60e3);
    if (!nodes[url]) {
      nodes[url] = {
        id: url,
        url,
        title,
        domain: new URL(url).hostname.replace(/^www\./, ''),
        firstVisit: time,
        lastVisit: time,
        visits: 1 + extraVisits,
      };
    } else {
      nodes[url].visits++;
    }
    nodes[url].lastVisit = time;
    if (from) edges.push({ from, to: url, time, transition: 'link' });
    return url;
  };

  const g = visit('https://www.google.com/search?q=easy+carbonara', 'easy carbonara — Search', null);
  const se = visit('https://www.seriouseats.com/pasta-carbonara', 'The Best Carbonara — Serious Eats', g);
  visit('https://www.youtube.com/watch?v=carbonara', 'Carbonara in 4 Minutes — YouTube', se);
  const wCarb = visit('https://en.wikipedia.org/wiki/Carbonara', 'Carbonara — Wikipedia', se);
  const wGua = visit('https://en.wikipedia.org/wiki/Guanciale', 'Guanciale — Wikipedia', wCarb);
  const wRome = visit('https://en.wikipedia.org/wiki/Rome', 'Rome — Wikipedia', wGua, 2);
  visit('https://en.wikipedia.org/wiki/Colosseum', 'Colosseum — Wikipedia', wRome);
  const wEmp = visit('https://en.wikipedia.org/wiki/Roman_Empire', 'Roman Empire — Wikipedia', wRome);
  const wByz = visit('https://en.wikipedia.org/wiki/Byzantine_Empire', 'Byzantine Empire — Wikipedia', wEmp);
  const wSiege = visit('https://en.wikipedia.org/wiki/Siege_engine', 'Siege engine — Wikipedia', wByz);
  const wTreb = visit('https://en.wikipedia.org/wiki/Trebuchet', 'Trebuchet — Wikipedia', wSiege, 1);
  const rd = visit('https://www.reddit.com/r/trebuchetmemes/', 'r/trebuchetmemes — Reddit', wTreb);
  visit('https://www.youtube.com/watch?v=trebuchet', 'We Built a TREBUCHET — YouTube', rd);

  const start = Object.values(nodes).reduce((m, n) => Math.min(m, n.firstVisit), Infinity);
  return { id: String(start), start, end: time, nodes, edges };
}

// Seeds the session into the extension's storage from any extension page,
// through the same schema module the store itself uses.
export function seedSession(page, session) {
  return page.evaluate((records) => chrome.storage.local.set(records), seedRecords(session));
}
