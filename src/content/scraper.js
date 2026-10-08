// Scroll loop for a virtualized list: read visible rows, scroll, wait, repeat
// until the scroll position stops moving.
(function (root) {
  'use strict';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * @param {object} opts
   * @param {() => Element|null} opts.getContainer  scrollable list element (null = no scrolling needed)
   * @param {() => any[]} opts.readRows              records currently rendered
   * @param {(rows: any[]) => void} opts.onBatch
   * @param {() => boolean} [opts.isAlive]           false when the list was closed
   * @returns {{ run(): Promise<'done'|'stopped'|'lost'>, stop(): void }}
   */
  function createScraper({
    getContainer,
    readRows,
    onBatch,
    isAlive = () => true,
    stepRatio = 0.8,
    delayMs = 400,
    stableLimit = 3,
  }) {
    let stopped = false;

    async function run() {
      let container = getContainer();
      if (!container) {
        onBatch(readRows());
        return 'done';
      }

      container.scrollTop = 0;
      await sleep(delayMs);

      let stable = 0;
      while (!stopped) {
        if (!isAlive()) return 'lost';
        onBatch(readRows());
        if (stopped) break;

        container = getContainer();
        if (!container) return isAlive() ? 'done' : 'lost';

        const before = container.scrollTop;
        container.scrollTop = before + Math.max(40, container.clientHeight * stepRatio);
        await sleep(delayMs);

        if (Math.abs(container.scrollTop - before) < 1) {
          if (++stable >= stableLimit) {
            onBatch(readRows());
            return 'done';
          }
        } else {
          stable = 0;
        }
      }
      return 'stopped';
    }

    return { run, stop: () => { stopped = true; } };
  }

  const api = { createScraper };
  root.WAX = root.WAX || {};
  root.WAX.scraper = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
