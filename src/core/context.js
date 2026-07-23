"use strict";

const fs = require("fs");
const path = require("path");
const { getBaileys } = require("./baileys-loader.js");

class Context {
  constructor(sock, msg, { store = null } = {}) {
    this.sock = sock;
    this.msg = msg;
    this.store = store;

    this.chat = msg.key.remoteJid;
    this.sender = msg.key.participant || msg.participant || msg.key.remoteJid;
    this.isGroup = Boolean(this.chat && this.chat.endsWith("@g.us"));
    this.isLid = Boolean(this.sender && this.sender.endsWith("@lid"));
    this.fromMe = Boolean(msg.key.fromMe);

    this.message = msg.message;

    this.text =
      this.message?.conversation ||
      this.message?.extendedTextMessage?.text ||
      this.message?.imageMessage?.caption ||
      this.message?.videoMessage?.caption ||
      "";

    this.command = null;
    this.args = [];
  }

  get isImage() {
    return Boolean(this.message?.imageMessage);
  }

  get isVideo() {
    return Boolean(this.message?.videoMessage);
  }

  get isAudio() {
    return Boolean(this.message?.audioMessage);
  }

  get isSticker() {
    return Boolean(this.message?.stickerMessage);
  }

  get isDocument() {
    return Boolean(this.message?.documentMessage);
  }

  get isVN() {
    return this.isAudio && Boolean(this.message.audioMessage?.ptt);
  }

  getName(jid = this.sender) {
    if (this.store) return this.store.getName(jid);
    return String(jid || "").split("@")[0];
  }

  async getProfilePicture(jid = this.sender) {
    if (!jid) return null;
    try {
      return await this.sock.profilePictureUrl(jid, "image");
    } catch {
      return null;
    }
  }

  async downloadMedia(folder = "media") {
    const { downloadContentFromMessage } = await getBaileys();

    let type;
    let target;

    if (this.isImage) {
      type = "image";
      target = this.message.imageMessage;
    } else if (this.isVideo) {
      type = "video";
      target = this.message.videoMessage;
    } else if (this.isAudio) {
      type = "audio";
      target = this.message.audioMessage;
    } else if (this.isSticker) {
      type = "sticker";
      target = this.message.stickerMessage;
    } else if (this.isDocument) {
      type = "document";
      target = this.message.documentMessage;
    } else {
      return null;
    }

    const stream = await downloadContentFromMessage(target, type);
    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    const extensions = { image: "jpg", video: "mp4", audio: "mp3", sticker: "webp", document: "bin" };
    const ext = extensions[type] || "bin";
    const filePath = path.join(folder, `${Date.now()}.${ext}`);

    fs.writeFileSync(filePath, Buffer.concat(chunks));
    return filePath;
  }

  reply(text, options = {}) {
    return this.sock.sendMessage(this.chat, { text }, { quoted: this.msg, ...options });
  }

  replyButtons(text, buttons = [], footer = "", options = {}) {
    return this.sock.sendMessage(
      this.chat,
      {
        text,
        footer,
        buttons: buttons.map((b, i) => ({
          buttonId: b.id || String(i + 1),
          buttonText: { displayText: b.text },
          type: 1
        })),
        headerType: 1
      },
      { quoted: this.msg, ...options }
    );
  }

  react(emoji) {
    return this.sock.sendMessage(this.chat, {
      react: { text: emoji, key: this.msg.key }
    });
  }
}

module.exports = { Context };
