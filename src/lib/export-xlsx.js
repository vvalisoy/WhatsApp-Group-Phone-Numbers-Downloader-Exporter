// Excel (.xlsx) export: one "Members" sheet, bold frozen header with filters,
// every cell stored as text so phone numbers keep their leading "+".
(function (root) {
  'use strict';

  const zipLib = (root.WAX && root.WAX.zip) ||
    (typeof require === 'function' ? require('./zip.js') : null);

  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const SHEET = 'Members';
  const HEADER = ['Phone', 'Name', 'IsAdmin', 'Group'];
  const WIDTHS = [20, 32, 10, 32];
  const COLS = ['A', 'B', 'C', 'D'];

  // Style ids in styles.xml: 0 default, 1 bold header, 2 text-format (phone).
  const STYLE_HEADER = 1;
  const STYLE_PHONE = 2;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cell(ref, text, style) {
    const s = style ? ` s="${style}"` : '';
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
  }

  function sheetXml(records, group) {
    const rows = [
      `<row r="1">${HEADER.map((h, i) => cell(COLS[i] + 1, h, STYLE_HEADER)).join('')}</row>`,
    ];
    records.forEach((r, i) => {
      const n = i + 2;
      rows.push(`<row r="${n}">` +
        cell('A' + n, r.phone, STYLE_PHONE) +
        cell('B' + n, r.name) +
        cell('C' + n, r.isAdmin ? 'yes' : 'no') +
        cell('D' + n, group) +
        '</row>');
    });
    const last = records.length + 1;
    const cols = WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    return XML_HEAD +
      `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      `<dimension ref="A1:D${last}"/>` +
      '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      `<cols>${cols}</cols>` +
      `<sheetData>${rows.join('')}</sheetData>` +
      `<autoFilter ref="A1:D${last}"/>` +
      '</worksheet>';
  }

  function workbookXml(rowCount) {
    return XML_HEAD +
      `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      `<sheets><sheet name="${SHEET}" sheetId="1" r:id="rId1"/></sheets>` +
      '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' +
      `'${SHEET}'!$A$1:$D$${rowCount}</definedName></definedNames>` +
      '</workbook>';
  }

  const STYLES = XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const CONTENT_TYPES = XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const ROOT_RELS = XML_HEAD +
    `<Relationships xmlns="${NS_PKG}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const WORKBOOK_RELS = XML_HEAD +
    `<Relationships xmlns="${NS_PKG}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  /** @returns {Uint8Array} the .xlsx file */
  function toXlsx(records, group, date = new Date()) {
    const enc = new TextEncoder();
    const file = (name, text) => ({ name, data: enc.encode(text) });
    return zipLib.zip([
      file('[Content_Types].xml', CONTENT_TYPES),
      file('_rels/.rels', ROOT_RELS),
      file('xl/workbook.xml', workbookXml(records.length + 1)),
      file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS),
      file('xl/worksheets/sheet1.xml', sheetXml(records, group)),
      file('xl/styles.xml', STYLES),
    ], date);
  }

  const api = { toXlsx };
  root.WAX = root.WAX || {};
  root.WAX.xlsx = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
