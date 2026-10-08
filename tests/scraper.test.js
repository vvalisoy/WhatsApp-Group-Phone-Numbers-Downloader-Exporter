const test = require('node:test');
const assert = require('node:assert/strict');
const { createScraper } = require('../src/content/scraper.js');

// Simulates a virtualized list: only rows inside the viewport are "rendered".
function fakeList(total, rowHeight = 50, viewport = 200) {
  const max = total * rowHeight - viewport;
  let top = 0;
  const container = {
    clientHeight: viewport,
    get scrollTop() { return top; },
    set scrollTop(v) { top = Math.max(0, Math.min(max, v)); },
  };
  const visible = () => {
    const first = Math.floor(top / rowHeight);
    const last = Math.min(total - 1, Math.floor((top + viewport) / rowHeight));
    const rows = [];
    for (let i = first; i <= last; i++) rows.push(i);
    return rows;
  };
  return { container, visible };
}

test('collects every row of a virtualized list and finishes', async () => {
  const list = fakeList(137);
  list.container.scrollTop = 900; // starts mid-list; scraper must rewind
  const seen = new Set();
  const s = createScraper({
    getContainer: () => list.container,
    readRows: list.visible,
    onBatch: (rows) => rows.forEach((r) => seen.add(r)),
    delayMs: 0,
  });
  assert.equal(await s.run(), 'done');
  assert.equal(seen.size, 137);
});

test('short list without scroll container is read once', async () => {
  let batches = 0;
  const s = createScraper({
    getContainer: () => null,
    readRows: () => [1, 2],
    onBatch: () => batches++,
    delayMs: 0,
  });
  assert.equal(await s.run(), 'done');
  assert.equal(batches, 1);
});

test('stop() ends the run with "stopped"', async () => {
  const list = fakeList(10000);
  let batches = 0;
  const s = createScraper({
    getContainer: () => list.container,
    readRows: list.visible,
    onBatch: () => { if (++batches === 3) s.stop(); },
    delayMs: 0,
  });
  assert.equal(await s.run(), 'stopped');
  assert.equal(batches, 3);
});

test('returns "lost" when the list disappears mid-run', async () => {
  const list = fakeList(10000);
  let alive = true;
  let batches = 0;
  const s = createScraper({
    getContainer: () => (alive ? list.container : null),
    isAlive: () => alive,
    readRows: list.visible,
    onBatch: () => { if (++batches === 2) alive = false; },
    delayMs: 0,
  });
  assert.equal(await s.run(), 'lost');
});
