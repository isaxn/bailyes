"use strict";

const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const { PassThrough, Readable } = require("stream");
const { getBaileys } = require("../core/baileys-loader.js");
const { extractIE, waitAllPromises } = require("./inline-entities.js");

class Toolkit {
  static extractIE(text, options = {}) {
    return extractIE(text, options);
  }

  static async waitAllPromises(input) {
    return waitAllPromises(input);
  }

  static async resize(buffer, x, y, fit = "cover") {
    return sharp(buffer)
      .resize(x, y, {
        fit,
        position: "center",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
  }

  static async fetchBuffer(url, options = {}, { silent = true } = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (silent) return Buffer.alloc(0);
      throw error;
    }
  }

  static async toUrl(client, mediaPath, mediaType = "document") {
    if (!mediaPath) throw new Error("Url or buffer needed");

    const { prepareWAMessageMedia } = await getBaileys();

    const media = await prepareWAMessageMedia(
      { [mediaType]: Buffer.isBuffer(mediaPath) ? mediaPath : { url: mediaPath } },
      { upload: client.waUploadToServer, jid: "@newsletter" }
    );

    return Object.values(media)[0]?.url;
  }

  static async resolveMedia(
    client,
    media,
    mediaType = "image",
    { resolveUrl = false, resolveWAUrl = false, result = "url", resize = false, width = 300, height = 300 } = {}
  ) {
    const isUrl = (str) => /^https?:\/\/.+/i.test(str);
    const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);

    if (Array.isArray(media)) {
      return Promise.all(
        media.map((item) =>
          Toolkit.resolveMedia(client, item, mediaType, { resolveUrl, resolveWAUrl, result, resize, width, height })
        )
      );
    }

    const originalIsBuffer = Buffer.isBuffer(media);

    if (typeof media === "string" && isUrl(media)) {
      const shouldFetch = (isWAUrl(media) && resolveWAUrl) || (!isWAUrl(media) && resolveUrl) || result !== "url";

      if (shouldFetch) {
        media = await Toolkit.fetchBuffer(media, {}, { silent: true });
      } else {
        return media;
      }
    }

    if (typeof media === "string" && !isUrl(media)) {
      media = Buffer.from(media, "base64");
    }

    if (!Buffer.isBuffer(media) || !media.length) {
      return undefined;
    }

    if (resize && Buffer.isBuffer(media)) {
      media = await Toolkit.resize(media, width, height);
    }

    if (result === "buffer") return media;
    if (result === "base64") return media.toString("base64");

    return Toolkit.toUrl(client, media, mediaType);
  }

  static getMp4Duration(buffer, { silent = true } = {}) {
    try {
      if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
        if (silent) return 0;
        throw new Error("Invalid buffer");
      }

      let offset = 0;

      while (offset < buffer.length - 8) {
        const size = buffer.readUInt32BE(offset);

        if (size < 8 || offset + size > buffer.length) {
          if (silent) return 0;
          throw new Error("Invalid atom size");
        }

        const type = buffer.toString("ascii", offset + 4, offset + 8);

        if (type === "moov") {
          let moovOffset = offset + 8;
          const moovEnd = offset + size;

          while (moovOffset < moovEnd - 8) {
            const childSize = buffer.readUInt32BE(moovOffset);

            if (childSize < 8 || moovOffset + childSize > moovEnd) {
              if (silent) return 0;
              throw new Error("Invalid child atom size");
            }

            const childType = buffer.toString("ascii", moovOffset + 4, moovOffset + 8);

            if (childType === "mvhd") {
              const version = buffer.readUInt8(moovOffset + 8);

              if (version === 0) {
                const timescale = buffer.readUInt32BE(moovOffset + 20);
                const duration = buffer.readUInt32BE(moovOffset + 24);

                if (!timescale) {
                  if (silent) return 0;
                  throw new Error("Invalid timescale");
                }

                return duration / timescale;
              }

              if (version === 1) {
                const timescale = buffer.readUInt32BE(moovOffset + 32);
                const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));

                if (!timescale) {
                  if (silent) return 0;
                  throw new Error("Invalid timescale");
                }

                return duration / timescale;
              }
            }

            moovOffset += childSize;
          }
        }

        offset += size;
      }

      if (silent) return 0;
      throw new Error("No mvhd found");
    } catch (error) {
      if (silent) return 0;
      throw error;
    }
  }

  static getMp4Preview(
    videoBuffer,
    { time, result = "buffer", resize = true, width = 300, height = 300, silent = true } = {}
  ) {
    return new Promise((resolve, reject) => {
      const fail = (error) => {
        if (silent) return resolve(result === "base64" ? "" : Buffer.alloc(0));
        return reject(error);
      };

      try {
        if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
          return fail(new Error("videoBuffer is invalid or empty"));
        }

        const inputStream = new Readable({ read() {} });
        inputStream.push(videoBuffer);
        inputStream.push(null);

        const outputStream = new PassThrough();
        const chunks = [];

        outputStream.on("data", (chunk) => chunks.push(chunk));

        outputStream.on("end", async () => {
          try {
            let output = Buffer.concat(chunks);

            if (!output.length) {
              return fail(new Error("Empty output, check the video format or timestamp"));
            }

            if (resize) {
              output = await Toolkit.resize(output, width, height);
            }

            return resolve(result === "base64" ? output.toString("base64") : output);
          } catch (error) {
            return fail(error);
          }
        });

        outputStream.on("error", fail);

        const seekTime = time ?? Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10);

        ffmpeg(inputStream)
          .outputOptions([`-ss ${seekTime}`, "-vframes 1", "-vcodec png", "-f image2pipe"])
          .on("error", (error) => fail(new Error(`ffmpeg error: ${error.message}`)))
          .pipe(outputStream, { end: true });
      } catch (error) {
        return fail(error);
      }
    });
  }
}

module.exports = { Toolkit };
