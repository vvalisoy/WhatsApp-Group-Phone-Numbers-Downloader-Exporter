// Content script entry: handles popup commands, runs page/full mode and
// persists the session to chrome.storage.local so the popup can close freely.
(function () {
  'use strict';
  if (window.__waxContentLoaded) return;
  window.__waxContentLoaded = true;

  const { selectors, parser, scraper: scraperLib, phone } = globalThis.WAX;
  const KEY = 'wax_session';
  const CHANNEL = 'WAX';

  const found = new Map(); // recordKey -> record
  let session = emptySession();
  let scraper = null;

  function emptySession() {
    return { group: '', mode: 'page', status: 'idle', message: '', records: [], startedAt: null, updatedAt: null };
  }

  function save() {
    session.records = [...found.values()];
    session.updatedAt = Date.now();
    return chrome.storage.local.set({ [KEY]: session });
  }

  function add(record) {
    const key = parser.recordKey(record);
    const prev = found.get(key);
    found.set(key, prev ? parser.mergeRecord(prev, record) : record);
  }

  function beginSession(mode, group) {
    found.clear();
    session = Object.assign(emptySession(), { mode, group, status: 'running', startedAt: Date.now() });
  }

  function finish(status, message) {
    session.status = status;
    session.message = message;
    scraper = null;
    return save();
  }

  // ---- page mode ----

  let cachedContainer = null;

  function currentContainer() {
    const dialog = selectors.findMembersDialog();
    if (!dialog) return null;
    if (cachedContainer && cachedContainer.isConnected && dialog.el.contains(cachedContainer)) {
      return cachedContainer;
    }
    const c = selectors.findScrollContainer(dialog.el);
    cachedContainer = c ? c.el : null;
    return cachedContainer;
  }

  // Search inside the scrolling list so the dialog's own header isn't a "member".
  function visibleRecords() {
    const dialog = selectors.findMembersDialog();
    if (!dialog) return [];
    const scope = currentContainer() || dialog.el;
    return selectors.findRows(scope).rows.map(parser.parseRow).filter(Boolean);
  }

  async function runPage() {
    cachedContainer = null;
    scraper = scraperLib.createScraper({
      getContainer: currentContainer,
      isAlive: () => !!selectors.findMembersDialog(),
      readRows: visibleRecords,
      onBatch: (records) => {
        records.forEach(add);
        session.message = `Scrolling… ${found.size} found`;
        save();
      },
    });
    try {
      const result = await scraper.run();
      if (result === 'lost') {
        await finish('error', `Members list was closed. Kept ${found.size} collected so far.`);
      } else {
        await finish(result, `${result === 'done' ? 'Done' : 'Stopped'}: ${found.size} members`);
      }
    } catch (err) {
      await finish('error', 'Error: ' + err.message);
    }
  }

  // ---- full mode ----

  function askPage(type, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('WA Web did not respond. Reload web.whatsapp.com and try again.'));
      }, timeoutMs);
      function onMessage(e) {
        const d = e.data;
        if (e.source !== window || !d || d.channel !== CHANNEL || d.id !== id || d.type !== type + ':response') return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        if (d.ok) resolve(d); else reject(new Error(d.error));
      }
      window.addEventListener('message', onMessage);
      window.postMessage({ channel: CHANNEL, type: type + ':request', id }, location.origin);
    });
  }

  async function runFull() {
    scraper = { stop() {} }; // marks a run in progress; full mode finishes in ~1s
    try {
      const res = await askPage('full', 20000);
      if (res.group) session.group = String(res.group);
      for (const r of res.records || []) {
        const p = phone.normalizePhone(String(r.phone || ''));
        add({ phone: p, name: String(r.name || ''), isAdmin: !!r.isAdmin, hidden: !p });
      }
      await finish('done', `Done: ${found.size} members`);
    } catch (err) {
      await finish('error', err.message);
    }
  }

  // ---- commands ----

  async function start(mode) {
    if (scraper) return { ok: false, error: 'Already running.' };
    if (mode === 'full') {
      beginSession('full', selectors.getGroupName());
      session.message = 'Reading group members…';
      await save();
      runFull();
      return { ok: true };
    }
    if (!selectors.findMembersDialog()) {
      return { ok: false, error: 'Open the group\'s "View all" members list first, or turn on Full mode.' };
    }
    beginSession('page', selectors.getGroupName());
    session.message = 'Starting…';
    await save();
    runPage();
    return { ok: true };
  }

  async function clear() {
    if (scraper) scraper.stop();
    scraper = null;
    found.clear();
    session = emptySession();
    await chrome.storage.local.remove(KEY);
    return { ok: true };
  }

  // Structure-only description: tags, roles, attribute names, text lengths.
  // Never includes names or numbers.
  function describe(el, depth = 0, out = []) {
    if (out.length >= 60 || depth > 8) return out;
    const attrs = [...el.attributes].map((a) => {
      if (a.name === 'role' || a.name === 'data-testid' || a.name === 'dir') return `${a.name}=${a.value}`;
      if (a.name === 'title') return `title(len=${a.value.length})`;
      return a.name;
    });
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join('').trim();
    out.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${attrs.length ? ' ' + attrs.join(' ') : ''}>` +
      (ownText ? ` text(len=${ownText.length})` : ''));
    for (const child of el.children) describe(child, depth + 1, out);
    return out;
  }

  async function diagnose() {
    const lines = [
      `WAX v${chrome.runtime.getManifest().version}`,
      `time: ${new Date().toISOString()}`,
      `browser: ${(navigator.userAgent.match(/Chrome\/[\d.]+/) || ['?'])[0]}`,
      `#main header: ${!!document.querySelector('#main header')}`,
    ];
    for (const sel of selectors.DIALOG_STRATEGIES) {
      lines.push(`count ${sel}: ${document.querySelectorAll(sel).length}`);
    }
    const dialog = selectors.findMembersDialog();
    lines.push(`members dialog: ${dialog ? 'found via ' + dialog.strategy : 'NOT FOUND'}`);
    if (dialog) {
      const c = selectors.findScrollContainer(dialog.el);
      lines.push(c
        ? `scroll container: found (scrollHeight=${c.el.scrollHeight}, clientHeight=${c.el.clientHeight}, scrollTop=${Math.round(c.el.scrollTop)})`
        : 'scroll container: NOT FOUND');
      const { strategy, rows } = selectors.findRows(c ? c.el : dialog.el);
      const parsed = rows.map(parser.parseRow);
      lines.push(`rows: ${rows.length} via ${strategy}`);
      lines.push(`parsed: ${parsed.filter((r) => r && r.phone).length} with phone, ` +
        `${parsed.filter((r) => r && !r.phone).length} name-only, ${parsed.filter((r) => !r).length} skipped, ` +
        `${parsed.filter((r) => r && r.isAdmin).length} admin`);
      if (rows[0]) lines.push('first row structure:', ...describe(rows[1] || rows[0]));
    }
    try {
      const res = await askPage('probe', 3000);
      lines.push(`full mode: require=${res.probe.require} ` +
        Object.entries(res.probe.modules).map(([k, v]) => `${k}=${v}`).join(' '));
    } catch (err) {
      lines.push('full mode: page script not responding');
    }
    lines.push(`session: status=${session.status} mode=${session.mode} records=${found.size}`);
    return { ok: true, report: lines.join('\n') };
  }

  async function handle(msg) {
    switch (msg && msg.type) {
      case 'ping': return { ok: true };
      case 'start': return start(msg.mode === 'full' ? 'full' : 'page');
      case 'stop': if (scraper) scraper.stop(); return { ok: true };
      case 'clear': return clear();
      case 'diagnose': return diagnose();
      default: return { ok: false, error: 'Unknown command' };
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handle(msg).then(sendResponse, (err) => sendResponse({ ok: false, error: err.message }));
    return true; // async response
  });

  // A run interrupted by a page reload can't resume; mark it stopped.
  chrome.storage.local.get(KEY).then((data) => {
    const s = data[KEY];
    if (s && s.status === 'running' && !scraper) {
      s.status = 'stopped';
      s.message = `Interrupted by page reload: ${s.records.length} members`;
      chrome.storage.local.set({ [KEY]: s });
    }
  });
})();
