// Full mode. Runs in the page's MAIN world so it can reach WhatsApp Web's
// internal module registry (window.require). This is not a public API: when
// WhatsApp changes it, requests fail with a readable error and page mode
// remains available. Talks to the content script via window.postMessage.
(function () {
  'use strict';
  if (window.__waxStoreReader) return;
  window.__waxStoreReader = true;

  const CHANNEL = 'WAX';

  function load(name) {
    try { return window.require(name); } catch (e) { return null; }
  }

  function modelsOf(coll) {
    if (!coll) return [];
    if (typeof coll.getModelsArray === 'function') return coll.getModelsArray();
    if (Array.isArray(coll.models)) return coll.models;
    if (Array.isArray(coll._models)) return coll._models;
    if (Array.isArray(coll)) return coll;
    return [];
  }

  function headerTitle() {
    const el = document.querySelector('#main header span[title]') ||
      document.querySelector('#main header span[dir="auto"]');
    return el ? (el.getAttribute('title') || el.textContent || '').trim() : '';
  }

  function isGroup(chat) {
    return !!chat && (chat.isGroup || (chat.id && chat.id.server === 'g.us'));
  }

  function findActiveChat(Chat) {
    try {
      const c = typeof Chat.getActive === 'function' && Chat.getActive();
      if (c) return c;
    } catch (e) { /* try the next way */ }
    const chats = modelsOf(Chat);
    const active = chats.find((c) => c.active);
    if (active) return active;
    const title = headerTitle();
    return title ? chats.find((c) => isGroup(c) && (c.formattedTitle === title || c.name === title)) : null;
  }

  async function loadMetadata(chat, GroupMetadata) {
    let meta = chat.groupMetadata;
    if ((!meta || !modelsOf(meta.participants).length) && GroupMetadata) {
      try { meta = (await GroupMetadata.find(chat.id)) || meta; } catch (e) { /* keep what we have */ }
    }
    return meta;
  }

  function userOf(wid) {
    if (!wid) return '';
    if (typeof wid === 'string') return wid.split('@')[0];
    return wid.user || '';
  }

  function toPhone(user) {
    return /^\d{7,15}$/.test(user) ? '+' + user : '';
  }

  function phoneOf(p, contact, ApiContact) {
    if (p.id && p.id.server === 'c.us') {
      const phone = toPhone(userOf(p.id));
      if (phone) return phone;
    }
    // @lid (privacy id): try every known way to map it back to a number.
    const candidates = [p.phoneNumber, contact && contact.phoneNumber];
    if (ApiContact && typeof ApiContact.getPhoneNumber === 'function') {
      try { candidates.push(ApiContact.getPhoneNumber(p.id)); } catch (e) { /* not mapped */ }
    }
    for (const c of candidates) {
      const phone = toPhone(userOf(c));
      if (phone) return phone;
    }
    return '';
  }

  function nameOf(contact) {
    if (!contact) return '';
    return contact.name || contact.pushname || contact.verifiedName || contact.notifyName || '';
  }

  function meUsers() {
    const Me = load('WAWebUserPrefsMeUser');
    const users = new Set();
    for (const fn of ['getMaybeMePnUser', 'getMaybeMeLidUser', 'getMeUser']) {
      try { if (Me && typeof Me[fn] === 'function') users.add(userOf(Me[fn]())); } catch (e) { /* ignore */ }
    }
    users.delete('');
    return users;
  }

  async function readGroup() {
    if (typeof window.require !== 'function') {
      throw new Error('Full mode unavailable: WA Web internals not found. Turn off Full mode and use the View all list.');
    }
    const C = load('WAWebCollections');
    if (!C || !C.Chat) throw new Error('Full mode unavailable: WA Web internals changed. Turn off Full mode and use the View all list.');

    const chat = findActiveChat(C.Chat);
    if (!chat) throw new Error('No open chat found. Open the group first.');
    if (!isGroup(chat)) throw new Error('The open chat is not a group.');

    const meta = await loadMetadata(chat, C.GroupMetadata);
    const participants = modelsOf(meta && meta.participants);
    if (!participants.length) throw new Error('Could not load group members. Turn off Full mode and use the View all list.');

    const ApiContact = load('WAWebApiContact');
    const me = meUsers();
    const records = [];
    for (const p of participants) {
      let contact = null;
      try { contact = (C.Contact && C.Contact.get(p.id)) || p.contact || null; } catch (e) { /* no contact */ }
      if ((contact && contact.isMe) || me.has(userOf(p.id))) continue;
      const phone = phoneOf(p, contact, ApiContact);
      records.push({ phone, name: nameOf(contact), isAdmin: !!(p.isAdmin || p.isSuperAdmin), hidden: !phone });
    }
    const group = chat.formattedTitle || chat.name || (meta && meta.subject) || headerTitle();
    return { group, records };
  }

  function probe() {
    const hasRequire = typeof window.require === 'function';
    const mods = ['WAWebCollections', 'WAWebApiContact', 'WAWebUserPrefsMeUser'];
    return {
      require: hasRequire,
      modules: Object.fromEntries(mods.map((m) => [m, hasRequire && !!load(m)])),
    };
  }

  function reply(msg) {
    window.postMessage(Object.assign({ channel: CHANNEL }, msg), location.origin);
  }

  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.channel !== CHANNEL) return;
    if (d.type === 'full:request') {
      try {
        reply(Object.assign({ type: 'full:response', id: d.id, ok: true }, await readGroup()));
      } catch (err) {
        reply({ type: 'full:response', id: d.id, ok: false, error: String((err && err.message) || err) });
      }
    } else if (d.type === 'probe:request') {
      reply({ type: 'probe:response', id: d.id, ok: true, probe: probe() });
    }
  });
})();
