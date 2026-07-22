"use strict";

function createInlineEntity(type, ie) {
  if (type === "hyperlink") {
    return {
      key: ie.key,
      metadata: {
        display_name: ie.text,
        is_trusted: ie.is_trusted,
        url: ie.url,
        __typename: "GenAIInlineLinkItem"
      }
    };
  }

  if (type === "citation") {
    return {
      key: ie.key,
      metadata: {
        reference_id: ie.reference_id,
        reference_url: ie.url,
        reference_title: ie.url,
        reference_display_name: ie.url,
        sources: [],
        __typename: "GenAISearchCitationItem"
      }
    };
  }

  if (type === "latex") {
    return {
      key: ie.key,
      metadata: {
        latex_expression: ie.text,
        latex_image: {
          url: ie.url,
          width: Number(ie.width) || 100,
          height: Number(ie.height) || 100
        },
        font_height: Number(ie.font_height) || 83.333333333333,
        padding: Number(ie.padding) || 15,
        __typename: "GenAILatexItem"
      }
    };
  }

  return null;
}

function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
  if (!extract) {
    return { text, ie: [], inline_entities: [] };
  }

  const ie = [];
  const inline_entities = [];

  let result = "";
  let last = 0;
  let citationIndex = 1;
  let hyperlinkIndex = 0;
  let latexIndex = 0;
  const stack = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[" && text[i - 1] !== "\\") {
      stack.push(i);
      continue;
    }

    if (text[i] === "]" && (text[i + 1] === "(" || text[i + 1] === "<")) {
      const start = stack.pop();
      if (start == null) continue;

      const open = text[i + 1];
      const close = open === "(" ? ")" : ">";
      const type = open === "(" ? "link" : "latex";

      let end = i + 2;
      let depth = 1;

      while (end < text.length && depth) {
        if (text[end] === open && text[end - 1] !== "\\") depth++;
        else if (text[end] === close && text[end - 1] !== "\\") depth--;
        end++;
      }

      if (depth) continue;

      const raw = text.slice(start + 1, i).trim();
      const url = text.slice(i + 2, end - 1).trim();

      let key;
      let tag;
      let data;

      if (type === "latex") {
        if (!latex) continue;

        const [txt = "", width = null, height = null, fontHeight = null, padding = null] = raw.split("|");

        key = `NIXEL_LATEX_${latexIndex++}`;
        tag = `{{${key}}}${txt || "image"}{{/${key}}}`;

        data = {
          type: "latex",
          ie: { key, text: txt, url, width, height, font_height: fontHeight, padding }
        };
      } else if (raw) {
        if (!hyperlink) continue;

        const trusted = !url.startsWith("!");
        const cleanUrl = trusted ? url : url.slice(1);

        key = `NIXEL_HYPERLINK_${hyperlinkIndex++}`;
        tag = `{{${key}}}${cleanUrl}{{/${key}}}`;

        data = {
          type: "hyperlink",
          ie: { key, text: raw, url: cleanUrl, is_trusted: trusted }
        };
      } else {
        if (!citation) continue;

        key = `NIXEL_CITATION_${citationIndex - 1}`;
        tag = `{{${key}}}${url}{{/${key}}}`;

        data = {
          type: "citation",
          ie: { reference_id: citationIndex++, key, text: "", url }
        };
      }

      result += text.slice(last, start) + tag;
      last = end;

      ie.push(data);

      const entity = createInlineEntity(data.type, data.ie);
      if (entity) inline_entities.push(entity);

      i = end - 1;
    }
  }

  result += text.slice(last);

  return { text: result, ie, inline_entities };
}

async function waitAllPromises(input) {
  const isPromise = (v) => v && typeof v.then === "function";
  const isObject = (v) => v && typeof v === "object";

  const deep = async (v) => {
    if (isPromise(v)) return deep(await v);
    if (Array.isArray(v)) return Promise.all(v.map(deep));
    if (isObject(v)) {
      const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
      return Object.fromEntries(entries);
    }
    return v;
  };

  return deep(await input);
}

module.exports = { extractIE, waitAllPromises };
