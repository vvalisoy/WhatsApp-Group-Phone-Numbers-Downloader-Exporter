"""Regenerates tests/harness/popup-preview.html from src/popup/popup.html with a
stub of the chrome.* APIs, so the popup can be viewed in a normal browser tab.
Usage: python3 tools/make_popup_preview.py   then open ?state=done|running|error|empty|offsite"""
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')
STUB = """  <script>
    // Dev-only stub of the chrome.* APIs so the popup renders outside Chrome.
    const state = new URLSearchParams(location.search).get('state') || 'done';
    const recs = Array.from({ length: 142 }, (_, i) => ({ phone: i % 6 ? '+1555' + (1000000 + i) : '', name: 'M' + i, isAdmin: i < 3, hidden: !(i % 6) }));
    const sessions = {
      done: { group: 'Book Club Lisbon 📚', status: 'done', message: 'Done: 142 members', records: recs },
      running: { group: 'Book Club Lisbon 📚', status: 'running', message: 'Scrolling… 87 found', records: recs.slice(0, 87) },
      error: { group: 'Book Club Lisbon 📚', status: 'error', message: 'Members list was closed. Kept 40 collected so far.', records: recs.slice(0, 40) },
    };
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: state === 'offsite' ? 'https://example.com/' : 'https://web.whatsapp.com/' }],
        sendMessage: async () => ({ ok: true }),
        create: (o) => console.log('open', o.url),
      },
      storage: { local: { get: async () => ({ wax_session: sessions[state] }), set: async () => {}, remove: async () => {} }, onChanged: { addListener() {} } },
      scripting: { executeScript: async () => {} },
      downloads: { download: (o, cb) => { console.log('download', o.filename); cb && cb(); } },
      runtime: { getURL: (p) => '../../' + p },
    };
  </script>
"""

src = open(os.path.join(ROOT, 'src/popup/popup.html')).read()
out = (src.replace('href="popup.css"', 'href="../../src/popup/popup.css"')
          .replace('src="../', 'src="../../src/')
          .replace('src="popup.js"', 'src="../../src/popup/popup.js"'))
first_script = out.index('  <script src="../../src/lib/')
out = out[:first_script] + STUB + out[first_script:]
open(os.path.join(ROOT, 'tests/harness/popup-preview.html'), 'w').write(out)
print('ok')
