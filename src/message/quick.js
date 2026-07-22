/*
@author : isank dev
@linkch : https://whatsapp.com/channel/0029Vb8Fj4S1iUxiJPyKFh1U
@note : informasi update nya lewat ch
@tanggal : now
*/

"use strict";

const { Button } = require("./button.js");
const { ButtonV2 } = require("./button-v2.js");
const { Carousel } = require("./carousel.js");
const { AIRich } = require("./ai-rich.js");
const { sendLinkPreview } = require("./link-preview.js");
const { sendLivePhoto } = require("./live-photo.js");
const { sendLiveThumbnail } = require("./live-thumbnail.js");

async function button(client, jid, { title, body = "", footer = "", thumbnail, buttons = [], contextInfo = {}, options = {} } = {}) {
  if (!Array.isArray(buttons) || !buttons.length) {
    throw new Error("buttons must be a non-empty array of { text, id }");
  }

  const builder = new ButtonV2(client).setBody(body).setFooter(footer).setContextInfo(contextInfo);

  if (title) builder.setTitle(title);
  if (thumbnail) builder.setThumbnail(thumbnail);

  for (const item of buttons) {
    builder.addButton(item.text ?? item.displayText ?? "", item.id ?? item.buttonId);
  }

  return builder.send(jid, options);
}

async function list(client, jid, { title = "", body = "", footer = "", sections = [], contextInfo = {}, options = {} } = {}) {
  if (!Array.isArray(sections) || !sections.length) {
    throw new Error("sections must be a non-empty array");
  }

  const builder = new Button(client)
    .setTitle(title)
    .setBody(body)
    .setFooter(footer)
    .setContextInfo(contextInfo)
    .addSelection(title || "Menu");

  for (const section of sections) {
    builder.makeSection(section.title ?? "", section.highlight ?? "");

    for (const row of section.rows || []) {
      builder.makeRow(row.header ?? "", row.title ?? "", row.description ?? "", row.id ?? "");
    }
  }

  return builder.send(jid, options);
}

async function card(client, jid, { body = "", footer = "", cards = [], contextInfo = {}, options = {} } = {}) {
  if (!Array.isArray(cards) || cards.length < 2) {
    throw new Error("cards must have at least 2 items, use bx.button for a single card");
  }

  const buttonKinds = {
    url: (b, item) => b.addUrl(item.text, item.value, item.webview ?? false),
    call: (b, item) => b.addCall(item.text, item.value),
    copy: (b, item) => b.addCopy(item.text, item.value),
    reply: (b, item) => b.addReply(item.text, item.value ?? item.id ?? "")
  };

  const built = await Promise.all(
    cards.map(async (item) => {
      const single = new Button(client)
        .setTitle(item.title ?? "")
        .setSubtitle(item.subtitle ?? "")
        .setBody(item.body ?? "")
        .setFooter(item.footer ?? footer);

      if (item.image) single.setImage(item.image);
      if (item.video) single.setVideo(item.video);

      for (const btn of item.buttons || []) {
        (buttonKinds[btn.type] ?? buttonKinds.reply)(single, btn);
      }

      return single.toCard();
    })
  );

  return new Carousel(client).setBody(body).setFooter(footer).setContextInfo(contextInfo).addCard(built).send(jid, options);
}

async function rich(client, jid, { title = "", text, code, table, tip, options = {} } = {}) {
  const builder = new AIRich(client).setTitle(title);

  if (text) builder.addText(text);
  if (code) builder.addCode(code.language ?? "javascript", code.content ?? "");
  if (table) builder.addTable(table);
  if (tip) builder.addTip(tip);

  return builder.send(jid, options);
}

async function linkPreview(client, jid, options = {}) {
  return sendLinkPreview(client, jid, options);
}

const bx = {
  button,
  list,
  card,
  rich,
  linkPreview,
  livePhoto: sendLivePhoto,
  liveThumbnail: sendLiveThumbnail
};

module.exports = { bx };
