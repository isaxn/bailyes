"use strict";

const { EventEmitter } = require("events");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const { getBaileys } = require("./baileys-loader.js");
const { Store } = require("./store.js");

const PASSTHROUGH_EVENTS = [
  "messages.upsert",
  "messages.update",
  "messages.delete",
  "messages.reaction",
  "message-receipt.update",
  "chats.upsert",
  "chats.update",
  "chats.delete",
  "contacts.upsert",
  "contacts.update",
  "groups.upsert",
  "groups.update",
  "group-participants.update",
  "presence.update",
  "call",
  "blocklist.set",
  "blocklist.update"
];

class WAClient extends EventEmitter {
  constructor(options = {}) {
    super();

    this.authFolder = options.auth || "auth";
    this.usePairingCode = !!options.pairingCode;
    this.phoneNumber = options.phoneNumber || null;
    this.browser = options.browser || ["Bailyes", "Chrome", "2.0.0"];
    this.logger = options.logger || pino({ level: "silent" });
    this.reconnectDelay = options.reconnectDelay ?? 3000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 0;
    this.socketOptions = options.socketOptions || {};

    this.store =
      options.store === false
        ? null
        : options.store instanceof Store
          ? options.store
          : new Store(typeof options.store === "object" ? options.store : {});

    this.sock = null;
    this._reconnectAttempts = 0;
    this._stopped = false;
    this._pairingRequested = false;
  }

  async connect() {
    this._stopped = false;

    const baileys = await getBaileys();
    const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: this.logger,
      browser: this.usePairingCode ? ["Ubuntu", "Chrome", "22.04.4"] : this.browser,
      syncFullHistory: false,
      ...this.socketOptions
    });

    this.sock = sock;
    this._pairingRequested = false;

    if (this.store) {
      this.store.bind(sock.ev);
    }

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => this._handleConnectionUpdate(update, baileys));

    this._bindPassthroughEvents(sock);

    if (this.usePairingCode && !sock.authState.creds.registered) {
      await this._requestPairingCode(sock);
    }

    return sock;
  }

  async _requestPairingCode(sock) {
    if (this._pairingRequested) return;
    this._pairingRequested = true;

    if (!this.phoneNumber) {
      throw new Error("phoneNumber is required when pairingCode is enabled");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const cleanNumber = String(this.phoneNumber).replace(/[^0-9]/g, "");
    const code = await sock.requestPairingCode(cleanNumber);

    this.emit("pairing-code", code);
  }

  _handleConnectionUpdate(update, baileys) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !this.usePairingCode) {
      qrcode.generate(qr, { small: true });
      this.emit("qr", qr);
    }

    if (connection === "connecting") {
      this.emit("connecting");
    }

    if (connection === "open") {
      this._reconnectAttempts = 0;
      this.emit("open", this.sock);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = this._resolveDisconnectReason(statusCode, baileys);

      this.emit("close", { statusCode, reason, error: lastDisconnect?.error });

      if (reason === "loggedOut") {
        this._stopped = true;
        this.emit("logged-out");
        return;
      }

      if (this._stopped) return;

      if (this.maxReconnectAttempts && this._reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit("reconnect-failed");
        return;
      }

      this._reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * this._reconnectAttempts, this.maxReconnectDelay);

      setTimeout(() => {
        this.connect().catch((error) => this.emit("error", error));
      }, delay);
    }
  }

  _resolveDisconnectReason(statusCode, baileys) {
    const { DisconnectReason } = baileys;
    const entries = Object.entries(DisconnectReason || {});
    const found = entries.find(([, value]) => value === statusCode);
    return found ? found[0] : "unknown";
  }

  _bindPassthroughEvents(sock) {
    for (const event of PASSTHROUGH_EVENTS) {
      sock.ev.on(event, (data) => this.emit(event, data));
    }
  }

  stop() {
    this._stopped = true;
    if (this.store) this.store.stop();
    this.sock?.end?.(undefined);
  }
}

module.exports = { WAClient };
