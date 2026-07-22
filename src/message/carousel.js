"use strict";

const { getBaileys } = require("../core/baileys-loader.js");
const { BaseBuilder } = require("./base-builder.js");
const { relayInteractive } = require("./native-flow.js");

class Carousel extends BaseBuilder {
  #client;

  constructor(client) {
    super();
    if (!client) throw new Error("Socket is required");

    this.#client = client;
    this._cards = [];
  }

  addCard(card) {
    const cards = Array.isArray(card) ? card : [card];
    const baseIndex = this._cards.length;

    for (const [index, c] of cards.entries()) {
      if (!c?.header?.hasMediaAttachment) {
        throw new Error(`Card [${baseIndex + index}] must include an image or video in header`);
      }
    }

    this._cards.push(...cards);
    return this;
  }

  async build(jid, options = {}) {
    const { generateWAMessageFromContent } = await getBaileys();

    return generateWAMessageFromContent(
      jid,
      {
        ...this._extraPayload,
        interactiveMessage: {
          header: { hasMediaAttachment: false },
          body: { text: this._body },
          footer: { text: this._footer },
          contextInfo: this._contextInfo,
          carouselMessage: { cards: this._cards }
        }
      },
      { ...options }
    );
  }

  async send(jid, options = {}) {
    const msg = await this.build(jid, options);
    return relayInteractive(this.#client, msg, options);
  }
}

module.exports = { Carousel };
