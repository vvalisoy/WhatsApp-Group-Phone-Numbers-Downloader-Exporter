// Service worker: shows the welcome guide on first install and makes the
// extension work in WA Web tabs that were already open (no reload needed).

const WELCOME = 'src/onboarding/welcome.html';
const CONTENT_FILES = [
  'src/lib/phone.js',
  'src/content/selectors.js',
  'src/content/parser.js',
  'src/content/scraper.js',
  'src/content/content.js',
];

async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/page/store-reader.js'], world: 'MAIN' });
    } catch (err) {
      // Tab still loading or discarded; the manifest content scripts cover it on next load.
    }
  }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME) });
  }
  injectIntoOpenTabs();
});
