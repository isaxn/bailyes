"use strict";

const { getBaileys } = require("../core/baileys-loader.js");
const { BaseBuilder } = require("./base-builder.js");
const { relayInteractive } = require("./native-flow.js");

class Button extends BaseBuilder {
  #client;

  constructor(client) {
    super();
    if (!client) throw new Error("Socket is required");

    this.#client = client;
    this._buttons = [];
    this._data = undefined;
    this._currentSelectionIndex = -1;
    this._currentSectionIndex = -1;
    this._params = {};
  }

  setVideo(mediaPath, options = {}) {
    if (!mediaPath) throw new Error("Url or buffer needed");
    this._data = Buffer.isBuffer(mediaPath)
      ? { video: mediaPath, ...options }
      : { video: { url: mediaPath }, ...options };
    return this;
  }

  setImage(mediaPath, options = {}) {
    if (!mediaPath) throw new Error("Url or buffer needed");
    this._data = Buffer.isBuffer(mediaPath)
      ? { image: mediaPath, ...options }
      : { image: { url: mediaPath }, ...options };
    return this;
  }

  setDocument(mediaPath, options = {}) {
    if (!mediaPath) throw new Error("Url or buffer needed");
    this._data = Buffer.isBuffer(mediaPath)
      ? { document: mediaPath, ...options }
      : { document: { url: mediaPath }, ...options };
    return this;
  }

  setMedia(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new TypeError("Media must be a plain object");
    }
    this._data = obj;
    return this;
  }

  clearButtons() {
    this._buttons = [];
    return this;
  }

  setParams(obj) {
    this._params = obj;
    return this;
  }

  addButton(name, params) {
    this._buttons.push({
      name,
      buttonParamsJson: typeof params === "string" ? params : JSON.stringify(params)
    });
    return this;
  }

  makeRow(header = "", title = "", description = "", id = "") {
    if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
      throw new Error("You need to create a selection and a section first");
    }

    const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
    buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
    this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
    return this;
  }

  makeSection(title = "", highlight_label = "") {
    if (this._currentSelectionIndex === -1) {
      throw new Error("You need to create a selection first");
    }

    const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
    buttonParams.sections.push({ title, highlight_label, rows: [] });
    this._currentSectionIndex = buttonParams.sections.length - 1;
    this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
    return this;
  }

  addSelection(title, options = {}) {
    this._buttons.push({
      ...options,
      name: "single_select",
      buttonParamsJson: JSON.stringify({ title, sections: [] })
    });
    this._currentSelectionIndex = this._buttons.length - 1;
    this._currentSectionIndex = -1;
    return this;
  }

  addReply(display_text = "", id = "", options = {}) {
    this._buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text, id, ...options })
    });
    return this;
  }

  addCall(display_text = "", id = "", options = {}) {
    this._buttons.push({
      name: "cta_call",
      buttonParamsJson: JSON.stringify({ display_text, id, ...options })
    });
    return this;
  }

  addReminder(display_text = "", id = "", options = {}) {
    this._buttons.push({
      name: "cta_reminder",
      buttonParamsJson: JSON.stringify({ display_text, id, ...options })
    });
    return this;
  }

  addCancelReminder(display_text = "", id = "", options = {}) {
    this._buttons.push({
      name: "cta_cancel_reminder",
      buttonParamsJson: JSON.stringify({ display_text, id, ...options })
    });
    return this;
  }

  addAddress(display_text = "", id = "", options = {}) {
    this._buttons.push({
      name: "address_message",
      buttonParamsJson: JSON.stringify({ display_text, id, ...options })
    });
    return this;
  }

  addLocation(options = {}) {
    this._buttons.push({
      name: "send_location",
      buttonParamsJson: JSON.stringify(options)
    });
    return this;
  }

  addUrl(display_text = "", url = "", webview_interaction = false, options = {}) {
    this._buttons.push({
      ...options,
      name: "cta_url",
      buttonParamsJson: JSON.stringify({ display_text, url, webview_interaction, ...options })
    });
    return this;
  }

  addCopy(display_text = "", copy_code = "", options = {}) {
    this._buttons.push({
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({ display_text, copy_code, ...options })
    });
    return this;
  }

  async toCard() {
    const { prepareWAMessageMedia } = await getBaileys();

    let header = {
      title: this._title,
      subtitle: this._subtitle,
      hasMediaAttachment: Boolean(this._data)
    };

    if (this._data) {
      try {
        const media = await prepareWAMessageMedia(this._data, { upload: this.#client.waUploadToServer });
        header = { ...header, ...media };
      } catch (error) {
        if (!String(error).includes("Invalid media type")) throw error;
        header = { ...header, ...this._data };
      }
    }

    return {
      body: { text: this._body },
      footer: { text: this._footer },
      header,
      nativeFlowMessage: {
        messageParamsJson: JSON.stringify(this._params),
        buttons: this._buttons
      }
    };
  }

  async build(jid, options = {}) {
    const { generateWAMessageFromContent } = await getBaileys();
    const message = await this.toCard();

    return generateWAMessageFromContent(
      jid,
      {
        ...this._extraPayload,
        interactiveMessage: { ...message, contextInfo: this._contextInfo }
      },
      { ...options }
    );
  }

  async send(jid, options = {}) {
    const msg = await this.build(jid, options);
    return relayInteractive(this.#client, msg, options);
  }
}

module.exports = { Button };
