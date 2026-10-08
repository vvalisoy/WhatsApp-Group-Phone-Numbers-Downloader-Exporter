// Builds safe download filenames like "My Group_2026-09-27.csv".
(function (root) {
  'use strict';

  const MAX_NAME = 80;
  const FALLBACK = 'wa-group';

  function sanitize(name) {
    const clean = String(name || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, MAX_NAME)
      .trim();
    return clean || FALLBACK;
  }

  function isoDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function buildFilename(group, ext, date = new Date()) {
    return `${sanitize(group)}_${isoDate(date)}.${ext}`;
  }

  const api = { buildFilename, sanitize };
  root.WAX = root.WAX || {};
  root.WAX.filename = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
