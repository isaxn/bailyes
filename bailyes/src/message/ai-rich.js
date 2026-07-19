"use strict";

const crypto = require("crypto");
const { BaseBuilder } = require("./base-builder.js");
const { Toolkit } = require("./toolkit.js");
const { extractIE, waitAllPromises } = require("./inline-entities.js");
const { tokenize } = require("./tokenizer.js");
const { toTableMetadata } = require("./table.js");

function newLayout(name, data, extra = {}) {
  return {
    ...extra,
    view_model: {
      [Array.isArray(data) ? "primitives" : "primitive"]: data,
      __typename: `GenAI${name}LayoutViewModel`
    }
  };
}

class AIRich extends BaseBuilder {
  #client;

  constructor(client) {
    if (!client) throw new Error("Socket is required");

    super();
    this.#client = client;
    this._submessages = [];
    this._sections = [];
    this._richResponseSources = [];
  }

  addSubmessage(submessage) {
    const items = Array.isArray(submessage) ? submessage : [submessage];

    for (const item of items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        throw new TypeError("Submessage must be a plain object or array of plain objects");
      }
      this._submessages.push(item);
    }

    return this;
  }

  addSection(section) {
    const items = Array.isArray(section) ? section : [section];

    for (const item of items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        throw new TypeError("Section must be a plain object or array of plain objects");
      }
      this._sections.push(item);
    }

    return this;
  }

  addText(text, { hyperlink = true, citation = true, latex = true } = {}) {
    if (typeof text !== "string") throw new TypeError("Text must be a string");

    const { text: extractedText, inline_entities } = extractIE(text, { hyperlink, citation, latex });

    this._submessages.push({ messageType: 2, messageText: extractedText });

    this._sections.push(
      newLayout("Single", {
        text: extractedText,
        ...(inline_entities.length && { inline_entities }),
        __typename: "GenAIMarkdownTextUXPrimitive"
      })
    );

    return this;
  }

  addCode(language, code) {
    if (typeof language !== "string" || typeof code !== "string") {
      throw new TypeError("Language and code must be a string");
    }

    const meta = tokenize(code, language);

    this._submessages.push({
      messageType: 5,
      codeMetadata: { codeLanguage: language, codeBlocks: meta.codeBlock }
    });

    this._sections.push(
      newLayout("Single", {
        language,
        code_blocks: meta.unified_codeBlock,
        __typename: "GenAICodeUXPrimitive"
      })
    );

    return this;
  }

  addTable(table, { hyperlink = true, citation = true, latex = true } = {}) {
    if (!Array.isArray(table)) throw new TypeError("Table must be an array");

    const meta = toTableMetadata(table, { hyperlink, citation, latex });

    this._submessages.push({
      messageType: 4,
      tableMetadata: { title: meta.title, rows: meta.rows }
    });

    this._sections.push(
      newLayout("Single", { rows: meta.unified_rows, __typename: "GenATableUXPrimitive" })
    );

    return this;
  }

  addSource(sources = []) {
    const isStringArray = Array.isArray(sources) && sources.every((item) => typeof item === "string");
    const isNestedArray =
      Array.isArray(sources) && sources.every((item) => Array.isArray(item) && item.every((v) => typeof v === "string"));

    if (!(isStringArray || isNestedArray)) {
      throw new TypeError("Sources must be a string array or an array of string arrays");
    }

    const normalized = isStringArray ? [sources] : sources;

    const source = normalized.map(([icon, url, text]) => ({
      source_type: "THIRD_PARTY",
      source_display_name: text ?? "",
      source_subtitle: "AI",
      source_url: url ?? "",
      favicon: {
        url: Toolkit.resolveMedia(this.#client, icon ?? "", "image"),
        mime_type: "image/jpeg",
        width: 16,
        height: 16
      }
    }));

    this._sections.push(newLayout("Single", { sources: source, __typename: "GenAISearchResultPrimitive" }));

    return this;
  }

  addReels(reelsItems = []) {
    const isSingleObject = reelsItems && typeof reelsItems === "object" && !Array.isArray(reelsItems);
    const isObjectArray =
      Array.isArray(reelsItems) && reelsItems.every((item) => item && typeof item === "object" && !Array.isArray(item));

    if (!(isSingleObject || isObjectArray)) {
      throw new TypeError("Reels items must be an object or an array of objects");
    }

    const items = Array.isArray(reelsItems) ? reelsItems : [reelsItems];

    const reels = items.map((item) => ({
      ...item,
      _avatar: Toolkit.resolveMedia(this.#client, item.profileIconUrl ?? item.profile_url ?? item.profile ?? "", "image"),
      _thumbnail: Toolkit.resolveMedia(this.#client, item.thumbnailUrl ?? item.thumbnail ?? "", "image")
    }));

    this._submessages.push({
      messageType: 9,
      contentItemsMetadata: {
        contentType: 1,
        itemsMetadata: reels.map((item) => ({
          reelItem: {
            title: item.username ?? "",
            profileIconUrl: item._avatar,
            thumbnailUrl: item._thumbnail,
            videoUrl: item.videoUrl ?? item.url ?? ""
          }
        }))
      }
    });

    reels.forEach((item, idx) => {
      this._richResponseSources.push({
        provider: "NIXEL",
        thumbnailCDNURL: item._thumbnail,
        sourceProviderURL: item.videoUrl ?? item.url ?? "",
        sourceQuery: "",
        faviconCDNURL: item._avatar,
        citationNumber: idx + 1,
        sourceTitle: item.username ?? ""
      });
    });

    this._sections.push(
      newLayout(
        "HScroll",
        reels.map((item) => ({
          reels_url: item.videoUrl ?? item.url ?? "",
          thumbnail_url: item._thumbnail,
          creator: item.username ?? item.title ?? "",
          avatar_url: item._avatar,
          reels_title: item.reels_title ?? item.title ?? "",
          likes_count: item.likes_count ?? item.like ?? 0,
          shares_count: item.shares_count ?? item.share ?? 0,
          view_count: item.view_count ?? item.view ?? 0,
          reel_source: item.reel_source ?? item.source ?? "IG",
          is_verified: Boolean(item.is_verified || item.verified),
          __typename: "GenAIReelPrimitive"
        }))
      )
    );

    return this;
  }

  addImage(imageUrl, { resolveUrl = false } = {}) {
    const isValid =
      typeof imageUrl === "string" ||
      Buffer.isBuffer(imageUrl) ||
      (Array.isArray(imageUrl) && imageUrl.every((v) => typeof v === "string" || Buffer.isBuffer(v)));

    if (!isValid) {
      throw new TypeError("imageUrl must be string | buffer | array of string/buffer");
    }

    const items = Array.isArray(imageUrl) ? imageUrl : [imageUrl];

    const list = items.map((v) => {
      const url = Toolkit.resolveMedia(this.#client, v, "image", { resolveUrl });
      return { imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: url };
    });

    this._submessages.push({
      messageType: 1,
      gridImageMetadata: {
        gridImageUrl: { imagePreviewUrl: list[0]?.imagePreviewUrl },
        imageUrls: list
      }
    });

    list.forEach(({ imagePreviewUrl }) => {
      this._sections.push(
        newLayout("Single", {
          media: { url: imagePreviewUrl, mime_type: "image/png" },
          imagine_type: "IMAGE",
          status: { status: "READY" },
          __typename: "GenAIImaginePrimitive"
        })
      );
    });

    return this;
  }

  addVideo(videoUrl, { autoFill = true } = {}) {
    const isObjectVideo = (v) => v && typeof v === "object" && v.url;

    const isValid =
      typeof videoUrl === "string" ||
      Buffer.isBuffer(videoUrl) ||
      isObjectVideo(videoUrl) ||
      (Array.isArray(videoUrl) && videoUrl.every((v) => typeof v === "string" || Buffer.isBuffer(v) || isObjectVideo(v)));

    if (!isValid) {
      throw new TypeError("videoUrl must be string | buffer | object | array");
    }

    const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];

    this._submessages.push({ messageType: 2, messageText: "[ CANNOT_LOAD_VIDEO - NIXEL ]" });

    items.forEach((item) => {
      const isObject = isObjectVideo(item);
      const url = isObject ? Toolkit.resolveMedia(this.#client, item.url ?? "", "video") : Toolkit.resolveMedia(this.#client, item, "video");

      const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u)) : null;

      const file_length =
        isObject && item.file_length != null ? item.file_length : autoFill ? bufferPromise.then((b) => b?.length ?? 0) : 0;

      const duration =
        isObject && item.duration != null
          ? item.duration
          : autoFill
            ? bufferPromise.then((b) => Toolkit.getMp4Duration(b, { silent: true }))
            : 0;

      const thumbnail =
        isObject && item.thumbnail
          ? Toolkit.resolveMedia(this.#client, item.thumbnail, "image", { result: "base64", resize: true, width: 300, height: 300 })
          : autoFill && bufferPromise
            ? bufferPromise.then((b) => Toolkit.getMp4Preview(b, { time: 0, result: "base64" }))
            : null;

      this._sections.push(
        newLayout("Single", {
          media: { url, mime_type: isObject ? item.mime_type ?? "video/mp4" : "video/mp4", file_length, duration },
          imagine_type: "ANIMATE",
          status: { status: "READY" },
          thumbnail: { raw_media: thumbnail },
          __typename: "GenAIImaginePrimitive"
        })
      );
    });

    return this;
  }

  addProduct(data = {}) {
    const isSingleObject = data && typeof data === "object" && !Array.isArray(data);
    const isObjectArray = Array.isArray(data) && data.every((item) => item && typeof item === "object" && !Array.isArray(item));

    if (!(isSingleObject || isObjectArray)) {
      throw new TypeError("Product items must be an object or an array of objects");
    }

    this._submessages.push({ messageType: 2, messageText: "[ CANNOT_LOAD_PRODUCT - NIXEL ]" });

    const items = Array.isArray(data) ? data : [data];

    const product = items.map((item) => ({
      title: item.title,
      brand: item.brand,
      price: item.price,
      sale_price: item.sale_price,
      product_url: item.product_url ?? item.url,
      image: { url: Toolkit.resolveMedia(this.#client, item.image_url ?? item.image, "image") },
      additional_images: [{ url: Toolkit.resolveMedia(this.#client, item.icon_url ?? item.icon, "image") }],
      __typename: "GenAIProductItemCardPrimitive"
    }));

    this._sections.push(newLayout(Array.isArray(data) ? "HScroll" : "Single", Array.isArray(data) ? product : product[0]));

    return this;
  }

  addPost(data = {}) {
    const isSingleObject = data && typeof data === "object" && !Array.isArray(data);
    const isObjectArray = Array.isArray(data) && data.every((item) => item && typeof item === "object" && !Array.isArray(item));

    if (!(isSingleObject || isObjectArray)) {
      throw new TypeError("Post items must be an object or an array of objects");
    }

    const posts = Array.isArray(data) ? data : [data];

    this._submessages.push({ messageType: 2, messageText: "[ CANNOT_LOAD_POST - NIXEL ]" });

    const primitives = posts.map((p) => ({
      title: p.title ?? "",
      subtitle: p.subtitle ?? "",
      username: p.username ?? "",
      profile_picture_url: Toolkit.resolveMedia(this.#client, p.profile_picture_url ?? p.profile_url ?? p.profile ?? "", "image"),
      is_verified: Boolean(p.is_verified || p.verified),
      thumbnail_url: Toolkit.resolveMedia(this.#client, p.thumbnail_url ?? p.thumbnail ?? "", "image"),
      post_caption: p.post_caption ?? p.caption ?? "",
      likes_count: p.likes_count ?? p.like ?? 0,
      comments_count: p.comments_count ?? p.comment ?? 0,
      shares_count: p.shares_count ?? p.share ?? 0,
      post_url: p.post_url ?? p.url ?? "",
      post_deeplink: p.post_deeplink ?? p.deeplink ?? "",
      source_app: p.source_app || p.source || "INSTAGRAM",
      footer_label: p.footer_label ?? p.footer ?? "",
      footer_icon: Toolkit.resolveMedia(this.#client, p.footer_icon ?? p.icon ?? "", "image"),
      is_carousel: posts.length > 1,
      orientation: p.orientation ?? "LANDSCAPE",
      post_type: p.post_type ?? "VIDEO",
      __typename: "GenAIPostPrimitive"
    }));

    this._sections.push(newLayout("HScroll", primitives));

    return this;
  }

  addTip(text) {
    this._submessages.push({ messageType: 2, messageText: text });
    this._sections.push(newLayout("Single", { text, __typename: "GenAIMetadataTextPrimitive" }));
    return this;
  }

  addSuggest(suggestion, { scroll = true, layout } = {}) {
    const isValid =
      typeof suggestion === "string" || (Array.isArray(suggestion) && suggestion.every((v) => typeof v === "string"));

    if (!isValid) throw new TypeError("Suggestion must be a string or array of strings");

    const suggest = Array.isArray(suggestion)
      ? suggestion.map((text) => ({ prompt_text: text, prompt_type: "SUGGESTED_PROMPT", __typename: "GenAIFollowUpSuggestionPillPrimitive" }))
      : [{ prompt_text: suggestion, prompt_type: "SUGGESTED_PROMPT", __typename: "GenAIFollowUpSuggestionPillPrimitive" }];

    const type = layout ?? (suggest.length === 1 ? "Single" : scroll ? "HScroll" : "ActionRow");

    this._sections.push(newLayout(type, type === "Single" ? suggest[0] : suggest, { __typename: "GenAIUnifiedResponseSection" }));

    return this;
  }

  async build({ forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, quoted, quotedParticipant, ...options } = {}) {
    const forward = forwarded
      ? { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: "0@bot" }, forwardOrigin: 4 }
      : {};

    const notif = notification
      ? {
          sessionTransparencyMetadata: {
            disclaimerText: this._footer || "AI generated response",
            hcaId: `hca_${Date.now()}`,
            sessionTransparencyType: 1
          }
        }
      : {};

    const qObj = quoted
      ? {
          stanzaId: quoted?.key?.id || quoted?.id,
          participant: quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid,
          quotedType: 0,
          quotedMessage: typeof quoted === "object" && quoted !== null ? quoted.message ?? quoted : undefined
        }
      : {};

    const sections = this._footer
      ? [...(await waitAllPromises(this._sections)), newLayout("Single", { text: this._footer, __typename: "GenAIMetadataTextPrimitive" })]
      : [...(await waitAllPromises(this._sections))];

    return {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: this._title,
          richResponseSourcesMetadata: { sources: this._richResponseSources },
          ...notif
        }
      },
      ...this._extraPayload,
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
            unifiedResponse: {
              data: includesUnifiedResponse
                ? Buffer.from(JSON.stringify({ response_id: crypto.randomUUID(), sections })).toString("base64")
                : ""
            },
            contextInfo: { ...forward, ...qObj, ...this._contextInfo }
          }
        }
      }
    };
  }

  async send(jid, { forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options } = {}) {
    const msg = await this.build({ forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options });
    return this.#client.relayMessage(jid, msg, { ...options });
  }
}

module.exports = { AIRich };
