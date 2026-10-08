// Every assumption about WhatsApp Web's DOM lives here. WhatsApp's class names
// are obfuscated and change often, so we rely on roles/attributes/structure and
// try several strategies in order. When WhatsApp changes, fix this file.
(function (root) {
  'use strict';

  const TITLE = 'span[title]';

  const DIALOG_STRATEGIES = [
    '[role="dialog"]',
    '[data-animate-modal-popup="true"]',
    '[data-animate-modal-body="true"]',
  ];

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /** The open "View all" members dialog. @returns {{el: Element, strategy: string}|null} */
  function findMembersDialog() {
    for (const sel of DIALOG_STRATEGIES) {
      const matches = [...document.querySelectorAll(sel)]
        .filter((el) => isVisible(el) && el.querySelectorAll(TITLE).length >= 2);
      if (matches.length) return { el: matches[matches.length - 1], strategy: sel };
    }
    return null;
  }

  /** Largest scrollable element inside the dialog. @returns {{el: Element}|null} */
  function findScrollContainer(dialog) {
    let best = null;
    for (const el of [dialog, ...dialog.querySelectorAll('div')]) {
      if (el.scrollHeight <= el.clientHeight + 10) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
      if (!best || el.scrollHeight > best.scrollHeight) best = el;
    }
    return best ? { el: best } : null;
  }

  // Rows are siblings in the list; inside one row at most two children carry
  // a title (name line + about line). So a row is the ancestor of a title
  // whose parent has 3+ children with titles.
  function titleAncestorRows(scope) {
    const rows = new Set();
    for (const span of scope.querySelectorAll(TITLE)) {
      let node = span;
      while (node.parentElement && node.parentElement !== scope) {
        const parent = node.parentElement;
        const withTitles = [...parent.children].filter((c) => c.querySelector(TITLE)).length;
        if (withTitles >= 3) break;
        node = parent;
      }
      rows.add(node);
    }
    return [...rows];
  }

  function outermost(elements) {
    return elements.filter((el) => !elements.some((o) => o !== el && o.contains(el)));
  }

  const ROW_STRATEGIES = [
    ['role=listitem', (s) => [...s.querySelectorAll('[role="listitem"]')]],
    ['role=row', (s) => [...s.querySelectorAll('[role="row"]')]],
    ['translateY', (s) => outermost([...s.querySelectorAll('div[style*="translateY"]')])],
    ['title-ancestor', titleAncestorRows],
  ];

  /** Rendered member rows. @returns {{strategy: string, rows: Element[]}} */
  function findRows(scope) {
    for (const [strategy, find] of ROW_STRATEGIES) {
      const rows = find(scope).filter((r) => r.querySelector(TITLE));
      if (rows.length) return { strategy, rows };
    }
    return { strategy: 'none', rows: [] };
  }

  /** Name of the open chat, from the conversation header. */
  function getGroupName() {
    const el = document.querySelector('#main header span[title]') ||
      document.querySelector('#main header span[dir="auto"]');
    const name = el ? (el.getAttribute('title') || el.textContent || '').trim() : '';
    return name || 'WA group';
  }

  const api = { findMembersDialog, findScrollContainer, findRows, getGroupName, DIALOG_STRATEGIES };
  root.WAX = root.WAX || {};
  root.WAX.selectors = api;
})(globalThis);
