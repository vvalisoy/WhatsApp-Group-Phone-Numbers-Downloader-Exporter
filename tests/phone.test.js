const test = require('node:test');
const assert = require('node:assert/strict');
const { isPhoneLike, normalizePhone, cleanText } = require('../src/lib/phone.js');

test('normalizes formatted international numbers', () => {
  assert.equal(normalizePhone('+1 (555) 123-4567'), '+15551234567');
  assert.equal(normalizePhone('+44 7911 123456'), '+447911123456');
});

test('strips bidi control marks WhatsApp wraps numbers in', () => {
  assert.equal(normalizePhone('‪+994 50 123 45 67‬'), '+994501234567');
  assert.equal(isPhoneLike('‎+7 912 345-67-89'), true);
});

test('handles non-breaking spaces', () => {
  assert.equal(normalizePhone('+49 151 12345678'), '+4915112345678');
});

test('rejects names, masked numbers and short or long digit runs', () => {
  for (const t of ['Alice', '~ Bob', '+1 ••• ••• 4567', '123', '+1234567890123456', '', null, undefined]) {
    assert.equal(isPhoneLike(t), false, String(t));
    assert.equal(normalizePhone(t), '', String(t));
  }
});

test('cleanText trims and removes bidi marks', () => {
  assert.equal(cleanText('  ‪Hello‬ '), 'Hello');
  assert.equal(cleanText(null), '');
});
