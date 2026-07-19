"use strict";

function nativeFlowNodes() {
  return [
    {
      tag: "biz",
      attrs: {},
      content: [
        {
          tag: "interactive",
          attrs: { type: "native_flow", v: "1" },
          content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }]
        }
      ]
    }
  ];
}

async function relayInteractive(client, msg, options = {}) {
  await client.relayMessage(msg.key.remoteJid, msg.message, {
    messageId: msg.key.id,
    additionalNodes: nativeFlowNodes(),
    ...options
  });
  return msg;
}

module.exports = { nativeFlowNodes, relayInteractive };
