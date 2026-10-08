const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRecord, recordKey, mergeRecord } = require('../src/content/parser.js');

test('unsaved contact: phone title plus ~push name', () => {
  const r = buildRecord({ title: '‪+1 555-123-4567‬', texts: ['+1 555-123-4567', 'Hey there!', '~ Alice'] });
  assert.deepEqual(r, { phone: '+15551234567', name: 'Alice', isAdmin: false, hidden: false });
});

test('push name in title and number in secondary line', () => {
  const r = buildRecord({ title: '~Bob', texts: ['~Bob', '+44 7911 123456'] });
  assert.deepEqual(r, { phone: '+447911123456', name: 'Bob', isAdmin: false, hidden: false });
});

// Layout seen on web.whatsapp.com (Sep 2026): "~Name" title, number on the right.
test('real layout: ~push name title with number on secondary line', () => {
  const r = buildRecord({ title: '~umahema48', texts: ['~umahema48', '+60 12-610 8144'] });
  assert.deepEqual(r, { phone: '+60126108144', name: 'umahema48', isAdmin: false, hidden: false });
});

test('real layout: RTL push name keeps the name without the tilde', () => {
  const title = '‫~אליהו ברזילי (Rabbi)‬';
  const r = buildRecord({ title, texts: [title, '+972 58-771-2751'] });
  assert.deepEqual(r, { phone: '+972587712751', name: 'אליהו ברזילי (Rabbi)', isAdmin: false, hidden: false });
  const trailing = buildRecord({ title: 'אליהו ברזילי (Rabbi)~', texts: ['+972 58-771-2751'] });
  assert.equal(trailing.name, 'אליהו ברזילי (Rabbi)');
});

test('real layout: member without a WhatsApp name has only the number', () => {
  const r = buildRecord({ title: '+44 7716 512955', texts: ['+44 7716 512955'] });
  assert.deepEqual(r, { phone: '+447716512955', name: '', isAdmin: false, hidden: false });
});

test('section headers like "#" or "A" are not members', () => {
  for (const t of ['#', 'A', 'Ж']) assert.equal(buildRecord({ title: t, texts: [t] }), null, t);
});

test('saved contact becomes a hidden name-only record', () => {
  const r = buildRecord({ title: 'Mom', texts: ['Mom', 'Available'] });
  assert.deepEqual(r, { phone: '', name: 'Mom', isAdmin: false, hidden: true });
});

test('admin badge is detected in several languages', () => {
  for (const badge of ['Group admin', 'Admin', 'Qrup admini', 'Админ группы', 'Grup yöneticisi']) {
    const r = buildRecord({ title: '+15551234567', texts: [badge] });
    assert.equal(r.isAdmin, true, badge);
  }
});

test('long about text mentioning admin is not a badge', () => {
  const r = buildRecord({ title: '+15551234567', texts: ['System admin at a very large company'] });
  assert.equal(r.isAdmin, false);
});

test('"You" row and empty titles are skipped', () => {
  for (const t of ['You', 'you', 'Siz', 'Вы', '']) {
    assert.equal(buildRecord({ title: t, texts: [] }), null, t);
  }
});

test('recordKey prefers phone, falls back to lower-cased name', () => {
  assert.equal(recordKey({ phone: '+15551234567', name: 'A' }), '+15551234567');
  assert.equal(recordKey({ phone: '', name: 'Mom' }), 'name:mom');
});

test('mergeRecord keeps the most complete data', () => {
  const merged = mergeRecord(
    { phone: '+15551234567', name: '', isAdmin: false, hidden: false },
    { phone: '+15551234567', name: 'Alice', isAdmin: true, hidden: false }
  );
  assert.deepEqual(merged, { phone: '+15551234567', name: 'Alice', isAdmin: true, hidden: false });
});
