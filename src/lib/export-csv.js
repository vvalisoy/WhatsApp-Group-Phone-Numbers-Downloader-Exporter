// CSV export: UTF-8 BOM (so Excel shows non-Latin names), RFC 4180 quoting.
(function (root) {
  'use strict';

  const HEADER = ['Phone', 'Name', 'IsAdmin', 'Group'];

  // Guard against spreadsheet formula injection from member names.
  function cell(value, guard = true) {
    let s = value == null ? '' : String(value);
    if (guard && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(records, group) {
    const lines = [HEADER.join(',')];
    for (const r of records) {
      lines.push([
        cell(r.phone, false), // always "+digits" or empty
        cell(r.name),
        r.isAdmin ? 'yes' : 'no',
        cell(group),
      ].join(','));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  const api = { toCsv };
  root.WAX = root.WAX || {};
  root.WAX.csv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
