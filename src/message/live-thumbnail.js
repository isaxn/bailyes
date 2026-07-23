/*
@author : isank dev
@linkch : https://whatsapp.com/channel/0029Vb8Fj4S1iUxiJPyKFh1U
@note : informasi update nya lewat ch
@tanggal : now
*/

"use strict";

const { getBaileys } = require("../core/baileys-loader.js");
const { Toolkit } = require("./toolkit.js");

async function sendLiveThumbnail(
  client,
  jid,
  {
    key,
    text = "",
    link = "",
    title = "",
    description = "",
    images = [],
    size = 300,
    interval = 1500,
    loops = 1,
    quality = "highQualityThumbnail"
  } = {}
) {
  if (!client) throw new Error("Socket is required");
  if (!key) throw new Error("key is required, get it from client.sendMessage() result");
  if (!Array.isArray(images) || !images.length) throw new Error("images must be a non-empty array");

  const { delay } = await getBaileys();

  const finalText = link && !text.includes(link) ? `${link}\n${text}` : text;

  const thumbs = await Promise.all(
    images.map(async (image) => Toolkit.resize(await Toolkit.fetchBuffer(image), size, size))
  );

  for (let loop = 0; loop < loops; loop++) {
    for (const jpegThumbnail of thumbs) {
      const linkPreview =
        quality === "highQualityThumbnail"
          ? { "matched-text": link, title, description, jpegThumbnail, highQualityThumbnail: { jpegThumbnail } }
          : { "matched-text": link, title, description, jpegThumbnail };

      await client.sendMessage(jid, { edit: key, text: finalText, linkPreview });
      await delay(interval);
    }
  }

  return key;
}

module.exports = { sendLiveThumbnail };
