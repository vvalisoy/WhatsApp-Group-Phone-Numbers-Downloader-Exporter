const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { toXlsx } = require('../src/lib/export-xlsx.js');
const { zip } = require('../src/lib/zip.js');

// Minimal ZIP reader (stored entries only) driven by the central directory.
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, 'end of central directory');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(p, true), 0x02014b50, 'central header');
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    assert.equal(view.getUint32(offset, true), 0x04034b50, 'local header');
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    const start = offset + 30 + localName + localExtra;
    const data = bytes.subarray(start, start + size);
    assert.equal(method, 0);
    assert.equal(zlib.crc32(data), crc, `crc of ${name}`);
    files[name] = new TextDecoder().decode(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const records = [
  { phone: '+15551234567', name: 'Alice & Bob <3', isAdmin: true, hidden: false },
  { phone: '', name: 'Saved\u0007Contact', isAdmin: false, hidden: true },
  { phone: '+447911123456', name: '=SUM(A1)', isAdmin: false, hidden: false },
  { phone: '+972587712751', name: 'אליהו ברזילי 😀', isAdmin: false, hidden: false },
];

test('zip round-trips stored files with correct CRCs', () => {
  const out = zip([
    { name: 'a.txt', data: new TextEncoder().encode('hello') },
    { name: 'dir/ü.txt', data: new TextEncoder().encode('wörld') },
  ]);
  assert.deepEqual(unzip(out), { 'a.txt': 'hello', 'dir/ü.txt': 'wörld' });
});

test('xlsx contains the required workbook parts', () => {
  const files = unzip(toXlsx(records, 'G'));
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) {
    assert.ok(files[part], part);
    assert.ok(files[part].startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), part);
  }
});

test('xlsx sheet has header plus one row per record, phones as text', () => {
  const sheet = unzip(toXlsx(records, 'Book Club'))['xl/worksheets/sheet1.xml'];
  assert.equal((sheet.match(/<row /g) || []).length, records.length + 1);
  for (const h of ['Phone', 'Name', 'IsAdmin', 'Group']) assert.ok(sheet.includes(`<t xml:space="preserve">${h}</t>`), h);
  assert.ok(sheet.includes('<c r="A2" t="inlineStr" s="2"><is><t xml:space="preserve">+15551234567</t></is></c>'));
  assert.ok(sheet.includes('<t xml:space="preserve">Book Club</t>'));
  assert.ok(sheet.includes('<autoFilter ref="A1:D5"/>'));
  assert.ok(sheet.includes('state="frozen"'));
});

test('xlsx escapes XML, drops control characters, keeps unicode', () => {
  const sheet = unzip(toXlsx(records, 'G'))['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('Alice &amp; Bob &lt;3'));
  assert.ok(sheet.includes('>SavedContact<'));
  assert.ok(sheet.includes('אליהו ברזילי 😀'));
  // Text cells are never formulas.
  assert.ok(!sheet.includes('<f>'));
  assert.ok(sheet.includes('>=SUM(A1)<'));
});

test('xlsx admin column says yes/no', () => {
  const sheet = unzip(toXlsx(records, 'G'))['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('<c r="C2" t="inlineStr"><is><t xml:space="preserve">yes</t></is></c>'));
  assert.ok(sheet.includes('<c r="C3" t="inlineStr"><is><t xml:space="preserve">no</t></is></c>'));
});

test('xlsx with no records still has a header row', () => {
  const sheet = unzip(toXlsx([], 'G'))['xl/worksheets/sheet1.xml'];
  assert.equal((sheet.match(/<row /g) || []).length, 1);
  assert.ok(sheet.includes('<autoFilter ref="A1:D1"/>'));
});
