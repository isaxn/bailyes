"use strict";

const { extractIE } = require("./inline-entities.js");

function toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
  if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))) {
    throw new TypeError("Table must be a nested array of strings");
  }

  const [header, ...rows] = arr;
  const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
  const normalize = (r) => [...r, ...Array(maxLen - r.length).fill("")];

  const unified_rows = [{ is_header: true, cells: normalize(header) }, ...rows.map((r) => ({ is_header: false, cells: normalize(r) }))].map(
    (row) => {
      const markdown_cells = row.cells.map((cell) => {
        const extracted = extractIE(cell, { hyperlink, citation, latex });
        return {
          text: extracted.text,
          ...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {})
        };
      });

      return {
        ...row,
        ...(markdown_cells.some((c) => c.inline_entities?.length) ? { markdown_cells } : {})
      };
    }
  );

  const rowsMeta = unified_rows.map((r) => ({
    items: r.cells,
    ...(r.is_header ? { isHeading: true } : {})
  }));

  return { title: "", rows: rowsMeta, unified_rows };
}

module.exports = { toTableMetadata };
