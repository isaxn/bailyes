/*
@author : isank dev
@linkch : https://whatsapp.com/channel/0029Vb8Fj4S1iUxiJPyKFh1U
@note : informasi update nya lewat ch
@tanggal : now
*/

"use strict";

const { getBaileys } = require("../core/baileys-loader.js");

async function sendLivePhoto(client, jid, { image, video, options = {} } = {}) {
  if (!client) throw new Error("Socket is required");
  if (!image) throw new Error("image is required");
  if (!video) throw new Error("video is required");

  const { prepareWAMessageMedia, generateWAMessageFromContent } = await getBaileys();

  const preparedImage = await prepareWAMessageMedia(
    { image: Buffer.isBuffer(image) ? image : { url: image } },
    { upload: client.waUploadToServer }
  );

  const preparedVideo = await prepareWAMessageMedia(
    { video: Buffer.isBuffer(video) ? video : { url: video } },
    { upload: client.waUploadToServer }
  );

  const msg = generateWAMessageFromContent(
    jid,
    {
      imageMessage: {
        ...preparedImage.imageMessage,
        contextInfo: { pairedMediaType: 5, statusSourceType: 0, ...options.contextInfo }
      }
    },
    {}
  );

  await client.relayMessage(jid, msg.message, { messageId: msg.key.id });

  await client.relayMessage(
    jid,
    {
      videoMessage: {
        ...preparedVideo.videoMessage,
        contextInfo: { pairedMediaType: 6, statusSourceType: 0 }
      },
      messageContextInfo: {
        messageAssociation: { associationType: 12, parentMessageKey: msg.key }
      }
    },
    {}
  );

  return msg;
}

module.exports = { sendLivePhoto };
