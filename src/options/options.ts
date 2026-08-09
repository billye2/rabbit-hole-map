import * as store from '../storage.js';

const blocklistEl = document.getElementById('blocklist') as HTMLTextAreaElement;
const savedEl = document.getElementById('saved')!;

async function init(): Promise<void> {
  const settings = await store.loadSettings();
  blocklistEl.value = settings.blocklist.join('\n');
}

document.getElementById('save')!.addEventListener('click', async () => {
  const blocklist = blocklistEl.value
    .split('\n')
    .map((l) =>
      l
        .trim()
        .toLowerCase()
        .replace(/^www\./, ''),
    )
    .filter(Boolean);
  await store.saveSettings({ blocklist });
  blocklistEl.value = blocklist.join('\n');
  savedEl.classList.add('show');
  setTimeout(() => savedEl.classList.remove('show'), 1500);
});

document.getElementById('clear')!.addEventListener('click', async () => {
  if (!confirm('Delete every recorded session? This cannot be undone.')) return;
  await store.clearAllData();
  alert('All data cleared.');
});

void init();
