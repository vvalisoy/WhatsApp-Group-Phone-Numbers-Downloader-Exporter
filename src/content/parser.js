// Turns one row of the "View all" members list into a record.
// DOM reading (parseRow) is kept thin; the rules live in buildRecord so they
// can be unit-tested without a browser.
(function (root) {
  'use strict';

  const phoneLib = (root.WAX && root.WAX.phone) ||
    (typeof require === 'function' ? require('../lib/phone.js') : null);
  const { cleanText, isPhoneLike, normalizePhone } = phoneLib;

  // How WhatsApp labels your own row, in common UI languages.
  const YOU_WORDS = new Set([
    'you', 'siz', 'sen', 'sən', 'вы', 'ты', 'ви', 'ти', 'tú', 'tu', 'vous', 'du', 'sie',
    'você', 'voce', 'voi', 'jij', 'ty', 'anda', 'kamu', 'bạn', 'คุณ', 'आप', 'أنت', 'شما',
    'אתה', '你', '您', 'あなた', '당신',
  ]);

  // Admin badge ("Group admin", "Qrup admini", "Админ группы", ...). Badges are
  // short; the length cap keeps "About" texts that mention admin from matching.
  const ADMIN_RE = /admin|админ|yönetici|administra|管理|관리자|एडमिन|مشرف|مدیر|מנהל/i;
  const ADMIN_MAX_LEN = 25;

  // "~" marks a WhatsApp push name; in RTL names it can end up last.
  function stripTilde(s) {
    return cleanText(s).replace(/^~\s*|\s*~$/g, '');
  }

  function buildRecord({ title, texts = [] }) {
    const t = cleanText(title);
    if (!t || YOU_WORDS.has(t.toLowerCase())) return null;
    if ([...t].length === 1) return null; // alphabet section header: "#", "A", ...

    const lines = texts.map(cleanText).filter(Boolean);
    const isAdmin = lines.some((s) => s.length <= ADMIN_MAX_LEN && ADMIN_RE.test(s));

    if (isPhoneLike(t)) {
      const push = lines.find((s) => s.startsWith('~'));
      return { phone: normalizePhone(t), name: push ? stripTilde(push) : '', isAdmin, hidden: false };
    }

    // Title is a name: a saved contact, or a layout that shows the number
    // on the secondary line.
    const phoneLine = lines.find((s) => s !== t && isPhoneLike(s));
    const phone = phoneLine ? normalizePhone(phoneLine) : '';
    return { phone, name: stripTilde(t), isAdmin, hidden: !phone };
  }

  function recordKey(r) {
    return r.phone || 'name:' + (r.name || '').toLowerCase();
  }

  function mergeRecord(a, b) {
    const phone = a.phone || b.phone;
    return { phone, name: a.name || b.name, isAdmin: !!(a.isAdmin || b.isAdmin), hidden: !phone };
  }

  // Text including emoji, which WhatsApp renders as <img alt="😀">.
  function readText(el) {
    let out = '';
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out += child.data;
        else if (child.nodeName === 'IMG') out += child.getAttribute('alt') || '';
        else if (child.nodeType === 1) walk(child);
      }
    };
    walk(el);
    return out;
  }

  function parseRow(row) {
    const titleEl = row.querySelector('span[title]');
    if (!titleEl) return null;
    const title = titleEl.getAttribute('title') || readText(titleEl);
    // Innermost spans/divs only, so each text piece is read once.
    const texts = [...row.querySelectorAll('span, div')]
      .filter((el) => !el.querySelector('span, div'))
      .map(readText);
    return buildRecord({ title, texts });
  }

  const api = { buildRecord, recordKey, mergeRecord, parseRow, readText };
  root.WAX = root.WAX || {};
  root.WAX.parser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
