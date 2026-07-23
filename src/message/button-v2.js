"use strict";

const crypto = require("crypto");
const { getBaileys } = require("../core/baileys-loader.js");
const { BaseBuilder } = require("./base-builder.js");
const { Toolkit } = require("./toolkit.js");
const { relayInteractive } = require("./native-flow.js");

class ButtonV2 extends BaseBuilder {
  #client;

  constructor(client) {
    super();
    if (!client) throw new Error("Socket is required");

    this.#client = client;
    this._image = undefined;
    this._data = undefined;
    this._buttons = [];
  }

  addButton(displayText = "", buttonId) {
    this._buttons.push({
      buttonId: buttonId ?? crypto.randomUUID(),
      buttonText: { displayText },
      type: 1
    });
    return this;
  }

  addRawButton(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new TypeError("Buttons must be a plain object");
    }
    this._buttons.push(obj);
    return this;
  }

  setThumbnail(mediaPath) {
    if (!mediaPath) throw new Error("Url or buffer needed");
    this._image = mediaPath;
    return this;
  }

  setMedia(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new TypeError("Media must be a plain object");
    }
    this._data = obj;
    return this;
  }

  async build(jid, options = {}) {
    const { generateWAMessageFromContent } = await getBaileys();

    let header;

    if (this._data) {
      header = this._data;
    } else if (this._image) {
      const thumbnail = await Toolkit.resize(
        Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image, {}, { silent: true }),
        300,
        300
      );

      header = {
        headerType: 6,
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: this._title,
          address: this._subtitle,
          jpegThumbnail: thumbnail
        }
      };
    } else {
      header = { headerType: 1 };
    }

    return generateWAMessageFromContent(
      jid,
      {
        ...this._extraPayload,
        buttonsMessage: {
          contentText: this._body,
          footerText: this._footer,
          ...header,
          viewOnce: true,
          contextInfo: this._contextInfo,
          buttons: [...this._buttons]
        }
      },
      { ...options }
    );
  }

  async send(jid, options = {}) {
    if (this._buttons.length < 1) {
      throw new Error("ButtonV2 requires at least one button");
    }

    const msg = await this.build(jid, options);
    return relayInteractive(this.#client, msg, options);
  }
}

module.exports = { ButtonV2 };
