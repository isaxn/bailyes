/*
@author : isank dev
@linkch : https://whatsapp.com/channel/0029Vb8Fj4S1iUxiJPyKFh1U
@note : informasi update nya lewat ch
@tanggal : now
*/

"use strict";

const { WAClient } = require("./core/client.js");
const { Context } = require("./core/context.js");
const { Events } = require("./core/events.js");
const { Handler } = require("./core/handler.js");
const { Store } = require("./core/store.js");
const {
  VERSION,
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  Toolkit,
  bind,
  sendLinkPreview,
  sendLivePhoto,
  sendLiveThumbnail,
  bx
} = require("./message/index.js");

class Bailyes {
  constructor(options = {}) {
    this.auth = options.auth || "auth";
    this.prefix = options.prefix || ["!"];
    this.cooldown = options.cooldown ?? 0;

    this.client = new WAClient(options);
    this.events = new Events();
    this.handler = new Handler(this.prefix);

    this._cooldownMap = new Map();
    this.sock = null;
  }

  get store() {
    return this.client.store;
  }

  on(event, fn) {
    this.client.on(event, fn);
    return this;
  }

  onFramework(event, fn) {
    this.events.on(event, fn);
    return this;
  }

  command(name, fn) {
    this.handler.command(name, fn);
    return this;
  }

  hear(pattern, fn) {
    this.handler.hear(pattern, fn);
    return this;
  }

  _canReply(jid) {
    if (!this.cooldown) return true;

    const now = Date.now();
    const last = this._cooldownMap.get(jid);

    if (last && now - last < this.cooldown) return false;

    this._cooldownMap.set(jid, now);
    return true;
  }

  async start() {
    this.client.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;

      const msg = messages?.[0];
      if (!msg || !msg.message || msg.key.fromMe) return;

      const ctx = new Context(this.sock, msg, { store: this.store });

      if (!this._canReply(ctx.chat)) return;

      this.events.emit("message", ctx);
      this.handler.handle(ctx).catch((error) => this.events.emit("error", error));
    });

    this.client.on("open", (sock) => {
      this.sock = sock;
      bind(sock);
      this.events.emit("ready", sock);
    });

    this.client.on("qr", (qr) => this.events.emit("qr", qr));
    this.client.on("pairing-code", (code) => this.events.emit("pairing-code", code));
    this.client.on("close", (info) => this.events.emit("close", info));
    this.client.on("logged-out", () => this.events.emit("logged-out"));
    this.client.on("error", (error) => this.events.emit("error", error));

    this.sock = await this.client.connect();
    bind(this.sock);

    return this.sock;
  }

  stop() {
    this.client.stop();
  }
}

module.exports = {
  Bailyes,
  WAClient,
  Context,
  Events,
  Handler,
  Store,
  VERSION,
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  Toolkit,
  bind,
  sendLinkPreview,
  sendLivePhoto,
  sendLiveThumbnail,
  bx
};
