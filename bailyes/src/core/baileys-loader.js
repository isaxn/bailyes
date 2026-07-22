"use strict";

let pending = null;

function getBaileys() {
  if (!pending) {
    pending = import("@whiskeysockets/baileys").then((mod) => {
      return mod && mod.default && !mod.makeWASocket
        ? Object.assign({ makeWASocket: mod.default }, mod)
        : mod;
    });
  }
  return pending;
}

module.exports = { getBaileys };
