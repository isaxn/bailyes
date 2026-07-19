"use strict";

const { getBaileys } = require("../core/baileys-loader.js");

function bind(client) {
  if (!client) throw new Error("Socket is required");

  Object.defineProperty(client, "sendLinkPreview", {
    configurable: true,
    writable: true,
    value: async function sendLinkPreview(jid, text, link, title, description, thumbnail, options = {}) {
      if (typeof jid !== "string") throw new TypeError("jid is not string");
      if (typeof text !== "string") throw new TypeError("text is not string");
      if (typeof link !== "string") throw new TypeError("link is not string");
      if (typeof title !== "string") throw new TypeError("title is not string");
      if (description && typeof description !== "string") throw new TypeError("description is not string");
      if (thumbnail && !Buffer.isBuffer(thumbnail) && typeof thumbnail.url !== "string") {
        throw new TypeError("thumbnail must be Buffer or object with url key");
      }

      const { prepareWAMessageMedia } = await getBaileys();

      const image = thumbnail
        ? await prepareWAMessageMedia(
            { image: thumbnail },
            { upload: client.waUploadToServer, mediaTypeOverride: "thumbnail-link" }
          ).then((v) => v.imageMessage)
        : undefined;

      const finalText = text.includes(link) ? text : `${link}\n${text}`;

      return client.sendMessage(
        jid,
        {
          text: finalText,
          linkPreview: {
            "matched-text": link,
            title,
            description,
            jpegThumbnail: image?.jpegThumbnail,
            highQualityThumbnail: image
          }
        },
        options
      );
    }
  });

  return client;
}

module.exports = { bind };
