// Phone number helpers shared by the content script, popup and tests.
(function (root) {
  'use strict';

  // WhatsApp wraps numbers in LTR/RTL marks and isolates.
  const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;
  const PHONE_CHARS = /^\+?[\d\s\-().]+$/;

  function cleanText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(BIDI_MARKS, '').trim();
  }

  function isPhoneLike(text) {
    const t = cleanText(text);
    if (!t || !PHONE_CHARS.test(t)) return false;
    const digits = t.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  function normalizePhone(text) {
    if (!isPhoneLike(text)) return '';
    return '+' + cleanText(text).replace(/\D/g, '');
  }

  const api = { cleanText, isPhoneLike, normalizePhone };
  root.WAX = root.WAX || {};
  root.WAX.phone = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
