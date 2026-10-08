// Popup: renders the session from storage, sends commands to the tab and
// exports the collected members.
(function () {
  'use strict';

  const KEY = 'wax_session';
  const PREFS = 'wax_prefs';
  const WA_URL = 'https://web.whatsapp.com/';
  const CONTENT_FILES = [
    'src/lib/phone.js',
    'src/content/selectors.js',
    'src/content/parser.js',
    'src/content/scraper.js',
    'src/content/content.js',
  ];
  const MIME = {
    csv: 'text/csv;charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    vcf: 'text/vcard;charset=utf-8',
  };

  const $ = (id) => document.getElementById(id);
  const ui = {
    notice: $('notice'), group: $('group'), dot: $('dot'), statusText: $('statusText'),
    total: $('total'), withPhone: $('withPhone'), noPhone: $('noPhone'),
    fullMode: $('fullMode'), hint: $('hint'),
    start: $('start'), stop: $('stop'), csv: $('csv'), xlsx: $('xlsx'), vcf: $('vcf'),
    clear: $('clear'), diagnose: $('diagnose'), report: $('report'),
    help: $('help'), openWa: $('openWa'),
  };

  let tab = null;
  let onWhatsApp = false;
  let session = null;

  function notice(text) {
    ui.notice.textContent = text || '';
    ui.notice.hidden = !text;
  }

  function updateHint() {
    ui.hint.textContent = ui.fullMode.checked
      ? 'Open the group chat, then press Start. "View all" is not needed.'
      : 'Open the group → Group info → "View all", then press Start.';
  }

  function render(s) {
    session = s || null;
    const records = (s && s.records) || [];
    const withPhone = records.filter((r) => r.phone).length;
    const running = !!s && s.status === 'running';

    ui.group.textContent = (s && s.group) || 'No group yet';
    ui.total.textContent = records.length;
    ui.withPhone.textContent = withPhone;
    ui.noPhone.textContent = records.length - withPhone;
    ui.statusText.textContent = (s && s.message) || 'Ready';
    ui.dot.className = 'dot ' + (s ? { running: 'running', done: 'done', error: 'error' }[s.status] || '' : '');

    ui.start.disabled = !onWhatsApp || running;
    ui.stop.disabled = !onWhatsApp || !running;
    ui.fullMode.disabled = running;
    ui.csv.disabled = running || records.length === 0;
    ui.xlsx.disabled = running || records.length === 0;
    ui.vcf.disabled = running || withPhone === 0;
    ui.clear.disabled = running || !s;
    ui.diagnose.disabled = !onWhatsApp;
  }

  // ---- tab messaging ----

  async function injectContentScripts() {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/page/store-reader.js'], world: 'MAIN' });
  }

  // Tabs opened before the extension was installed have no content script yet.
  async function send(msg) {
    try {
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch (err) {
      await injectContentScripts();
      return chrome.tabs.sendMessage(tab.id, msg);
    }
  }

  async function command(msg) {
    notice('');
    try {
      const res = await send(msg);
      if (res && !res.ok) notice(res.error);
      return res;
    } catch (err) {
      notice('Could not reach the WA Web tab. Reload web.whatsapp.com and try again.');
      return null;
    }
  }

  // ---- export ----

  function download(content, mime, ext) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const filename = WAX.filename.buildFilename(session.group, ext);
    chrome.downloads.download({ url, filename, saveAs: false }, () => {
      if (chrome.runtime.lastError) notice('Download failed: ' + chrome.runtime.lastError.message);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }

  function buildFile(format, records, group) {
    if (format === 'csv') return WAX.csv.toCsv(records, group);
    if (format === 'xlsx') return WAX.xlsx.toXlsx(records, group);
    return WAX.vcf.toVcf(records, group);
  }

  function exportAs(format) {
    notice('');
    download(buildFile(format, session.records, session.group), MIME[format], format);
  }

  // ---- events ----

  ui.start.addEventListener('click', () => {
    ui.report.hidden = true;
    command({ type: 'start', mode: ui.fullMode.checked ? 'full' : 'page' });
  });
  ui.stop.addEventListener('click', () => command({ type: 'stop' }));

  ui.clear.addEventListener('click', async () => {
    ui.report.hidden = true;
    if (onWhatsApp) await command({ type: 'clear' });
    else await chrome.storage.local.remove(KEY);
  });

  ui.csv.addEventListener('click', () => exportAs('csv'));
  ui.xlsx.addEventListener('click', () => exportAs('xlsx'));
  ui.vcf.addEventListener('click', () => exportAs('vcf'));

  ui.diagnose.addEventListener('click', async () => {
    const res = await command({ type: 'diagnose' });
    if (!res || !res.ok) return;
    ui.report.value = res.report;
    ui.report.hidden = false;
    try {
      await navigator.clipboard.writeText(res.report);
      notice('Diagnose report copied to clipboard (no names or numbers).');
    } catch (err) {
      ui.report.select();
      notice('Copy the report below.');
    }
  });

  ui.help.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/welcome.html') });
  });
  ui.openWa.addEventListener('click', () => chrome.tabs.create({ url: WA_URL }));

  ui.fullMode.addEventListener('change', () => {
    updateHint();
    chrome.storage.local.set({ [PREFS]: { fullMode: ui.fullMode.checked } });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) render(changes[KEY].newValue);
  });

  async function init() {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    onWhatsApp = !!(tab && tab.url && tab.url.startsWith(WA_URL));
    if (!onWhatsApp) {
      notice('Open WA Web (web.whatsapp.com) in this tab to collect numbers.');
      ui.openWa.hidden = false;
    }

    const data = await chrome.storage.local.get([KEY, PREFS]);
    ui.fullMode.checked = !!(data[PREFS] && data[PREFS].fullMode);
    updateHint();
    render(data[KEY]);
  }

  init();
})();
