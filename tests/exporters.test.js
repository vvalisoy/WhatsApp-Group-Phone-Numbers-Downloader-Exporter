const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFilename } = require('../src/lib/filename.js');
const { toCsv } = require('../src/lib/export-csv.js');
const { toVcf } = require('../src/lib/export-vcf.js');

const DATE = new Date(2026, 8, 27); // 27 Sep 2026, local time

const records = [
  { phone: '+15551234567', name: 'Alice', isAdmin: true, hidden: false },
  { phone: '+447911123456', name: 'Smith, John; "JJ"', isAdmin: false, hidden: false },
  { phone: '', name: 'Saved Contact', isAdmin: false, hidden: true },
  { phone: '+994501234567', name: '', isAdmin: false, hidden: false },
];

// ---- filename ----

test('buildFilename uses group and ISO date', () => {
  assert.equal(buildFilename('My Group', 'csv', DATE), 'My Group_2026-09-27.csv');
});

test('buildFilename strips illegal characters and dots at the edges', () => {
  assert.equal(buildFilename('a/b\\c:d*e?f"g<h>i|j', 'vcf', DATE), 'abcdefghij_2026-09-27.vcf');
  assert.equal(buildFilename('..hidden..', 'csv', DATE), 'hidden_2026-09-27.csv');
});

test('buildFilename falls back when group is empty and truncates long names', () => {
  assert.equal(buildFilename('', 'csv', DATE), 'wa-group_2026-09-27.csv');
  assert.equal(buildFilename('   ', 'csv', DATE), 'wa-group_2026-09-27.csv');
  const long = buildFilename('x'.repeat(200), 'csv', DATE);
  assert.equal(long, 'x'.repeat(80) + '_2026-09-27.csv');
});

// ---- CSV ----

test('toCsv starts with BOM and header, uses CRLF', () => {
  const csv = toCsv(records, 'G');
  assert.ok(csv.startsWith('﻿Phone,Name,IsAdmin,Group\r\n'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.split('\r\n').length, records.length + 2); // header + rows + trailing ''
});

test('toCsv quotes commas, quotes and newlines', () => {
  const csv = toCsv(records, 'Team, "Core"');
  assert.ok(csv.includes('+447911123456,"Smith, John; ""JJ""",no,"Team, ""Core"""'));
  const multi = toCsv([{ phone: '+15551234567', name: 'a\nb', isAdmin: false }], 'G');
  assert.ok(multi.includes('"a\nb"'));
});

test('toCsv writes admin flag and keeps hidden rows with empty phone', () => {
  const lines = toCsv(records, 'G').split('\r\n');
  assert.equal(lines[1], '+15551234567,Alice,yes,G');
  assert.equal(lines[3], ',Saved Contact,no,G');
});

test('toCsv guards formula-like cells except the phone column', () => {
  const csv = toCsv([{ phone: '+15551234567', name: '=HYPERLINK("x")', isAdmin: false }], '@group');
  const row = csv.split('\r\n')[1];
  assert.ok(row.startsWith('+15551234567,'));
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.endsWith(",'@group"));
});

// ---- VCF ----

test('toVcf writes one vCard 3.0 per record with a phone', () => {
  const vcf = toVcf(records, 'G');
  assert.equal((vcf.match(/BEGIN:VCARD/g) || []).length, 3);
  assert.equal((vcf.match(/VERSION:3.0/g) || []).length, 3);
  assert.ok(!vcf.includes('Saved Contact'));
  assert.ok(vcf.includes('TEL;TYPE=CELL:+15551234567\r\n'));
  assert.ok(vcf.endsWith('END:VCARD\r\n'));
  assert.ok(!/[^\r]\n/.test(vcf), 'all line breaks are CRLF');
});

test('toVcf escapes special characters', () => {
  const vcf = toVcf(records, 'G');
  assert.ok(vcf.includes('FN:Smith\\, John\\; "JJ"\r\n'));
  assert.ok(vcf.includes('N:;Smith\\, John\\; "JJ";;;\r\n'));
  const nl = toVcf([{ phone: '+15551234567', name: 'a\\b\nc' }], 'G');
  assert.ok(nl.includes('FN:a\\\\b\\nc\r\n'));
});

test('toVcf falls back to phone for FN and adds group note', () => {
  const vcf = toVcf(records, 'Team; A');
  assert.ok(vcf.includes('FN:+994501234567\r\n'));
  assert.ok(vcf.includes('NOTE:WA group: Team\\; A\r\n'));
});

test('toVcf returns empty string when nothing is exportable', () => {
  assert.equal(toVcf([{ phone: '', name: 'x', hidden: true }], 'G'), '');
  assert.equal(toVcf([], 'G'), '');
});
