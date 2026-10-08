// VCF export: vCard 3.0, one card per record that has a phone number.
(function (root) {
  'use strict';

  function esc(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function toVcf(records, group) {
    const lines = [];
    for (const r of records) {
      if (!r.phone) continue;
      const fn = esc(r.name || r.phone);
      lines.push(
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${fn}`,
        `N:;${fn};;;`,
        `TEL;TYPE=CELL:${r.phone}`,
        `NOTE:${esc('WA group: ' + (group || ''))}`,
        'END:VCARD'
      );
    }
    return lines.length ? lines.join('\r\n') + '\r\n' : '';
  }

  const api = { toVcf };
  root.WAX = root.WAX || {};
  root.WAX.vcf = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
