"use strict";

const fs = require("fs");

class Store {
  constructor(options = {}) {
    this.contacts = new Map();
    this.chats = new Map();
    this.groupMetadata = new Map();
    this.messages = new Map();
    this.maxMessagesPerChat = options.maxMessagesPerChat || 100;
    this.file = options.file || null;
    this.autosaveInterval = options.autosaveInterval ?? 30000;
    this._timer = null;
  }

  bind(ev) {
    if (this.file) this.readFromFile(this.file);

    ev.on("contacts.upsert", (contacts) => {
      for (const contact of contacts || []) this.upsertContact(contact);
    });

    ev.on("contacts.update", (updates) => {
      for (const update of updates || []) this.upsertContact(update);
    });

    ev.on("chats.upsert", (chats) => {
      for (const chat of chats || []) this.upsertChat(chat);
    });

    ev.on("chats.update", (updates) => {
      for (const update of updates || []) this.upsertChat(update);
    });

    ev.on("chats.delete", (ids) => {
      for (const id of ids || []) this.chats.delete(id);
    });

    ev.on("messages.upsert", (payload) => {
      for (const msg of payload?.messages || []) this.upsertMessage(msg);
    });

    ev.on("messages.update", (updates) => {
      for (const update of updates || []) this.patchMessage(update);
    });

    ev.on("messages.delete", (item) => {
      if (Array.isArray(item?.keys)) {
        for (const key of item.keys) {
          this.messages.get(key.remoteJid)?.delete(key.id);
        }
        return;
      }
      if (item?.jid) this.messages.delete(item.jid);
    });

    ev.on("groups.update", (updates) => {
      for (const update of updates || []) this.upsertGroupMetadata(update);
    });

    ev.on("group-participants.update", (data) => this.applyParticipantsUpdate(data));

    if (this.file && this.autosaveInterval > 0) {
      this._timer = setInterval(() => this.writeToFile(this.file), this.autosaveInterval);
      if (this._timer.unref) this._timer.unref();
    }

    return this;
  }

  upsertContact(contact) {
    if (!contact?.id) return;
    const existing = this.contacts.get(contact.id) || { id: contact.id };
    this.contacts.set(contact.id, { ...existing, ...contact });
  }

  upsertChat(chat) {
    if (!chat?.id) return;
    const existing = this.chats.get(chat.id) || { id: chat.id };
    this.chats.set(chat.id, { ...existing, ...chat });
  }

  upsertGroupMetadata(meta) {
    if (!meta?.id) return;
    const existing = this.groupMetadata.get(meta.id) || { id: meta.id };
    this.groupMetadata.set(meta.id, { ...existing, ...meta });
  }

  applyParticipantsUpdate({ id, participants, action } = {}) {
    const meta = this.groupMetadata.get(id);
    if (!meta || !Array.isArray(meta.participants) || !Array.isArray(participants)) return;

    if (action === "add" || action === "promote" || action === "demote") {
      for (const jid of participants) {
        if (!meta.participants.some((p) => p.id === jid)) {
          meta.participants.push({ id: jid });
        }
      }
    }

    if (action === "remove") {
      meta.participants = meta.participants.filter((p) => !participants.includes(p.id));
    }
  }

  upsertMessage(msg) {
    const jid = msg?.key?.remoteJid;
    const id = msg?.key?.id;
    if (!jid || !id) return;

    let bucket = this.messages.get(jid);
    if (!bucket) {
      bucket = new Map();
      this.messages.set(jid, bucket);
    }

    bucket.set(id, msg);

    while (bucket.size > this.maxMessagesPerChat) {
      bucket.delete(bucket.keys().next().value);
    }
  }

  patchMessage(update) {
    const jid = update?.key?.remoteJid;
    const id = update?.key?.id;
    if (!jid || !id) return;

    const bucket = this.messages.get(jid);
    const existing = bucket?.get(id);
    if (existing) bucket.set(id, { ...existing, ...update.update });
  }

  loadMessage(jid, id) {
    return this.messages.get(jid)?.get(id) || null;
  }

  getContact(jid) {
    return this.contacts.get(jid) || null;
  }

  getChat(jid) {
    return this.chats.get(jid) || null;
  }

  getGroupMetadata(jid) {
    return this.groupMetadata.get(jid) || null;
  }

  getName(jid) {
    if (!jid) return "";
    const contact = this.contacts.get(jid);
    const fallback = String(jid).split("@")[0];
    return contact?.name || contact?.notify || contact?.verifiedName || fallback;
  }

  toJSON() {
    return {
      contacts: Array.from(this.contacts.values()),
      chats: Array.from(this.chats.values()),
      groupMetadata: Array.from(this.groupMetadata.values()),
      messages: Array.from(this.messages.entries()).map(([jid, bucket]) => [
        jid,
        Array.from(bucket.values())
      ])
    };
  }

  fromJSON(data) {
    if (!data) return;

    this.contacts = new Map((data.contacts || []).map((c) => [c.id, c]));
    this.chats = new Map((data.chats || []).map((c) => [c.id, c]));
    this.groupMetadata = new Map((data.groupMetadata || []).map((g) => [g.id, g]));
    this.messages = new Map(
      (data.messages || []).map(([jid, msgs]) => [
        jid,
        new Map(msgs.map((m) => [m.key.id, m]))
      ])
    );
  }

  writeToFile(file = this.file) {
    if (!file) return;
    try {
      fs.writeFileSync(file, JSON.stringify(this.toJSON()));
    } catch {
      return;
    }
  }

  readFromFile(file = this.file) {
    if (!file || !fs.existsSync(file)) return;
    try {
      const raw = fs.readFileSync(file, "utf-8");
      this.fromJSON(JSON.parse(raw));
    } catch {
      return;
    }
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    if (this.file) this.writeToFile(this.file);
  }
}

module.exports = { Store };
