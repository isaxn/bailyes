"use strict";

const assert = require("assert");
const bailyes = require("../src/index.js");

async function main() {
  assert.ok(bailyes.Bailyes, "Bailyes missing");
  assert.ok(bailyes.WAClient, "WAClient missing");
  assert.ok(bailyes.Button, "Button missing");
  assert.ok(bailyes.ButtonV2, "ButtonV2 missing");
  assert.ok(bailyes.Carousel, "Carousel missing");
  assert.ok(bailyes.AIRich, "AIRich missing");
  assert.ok(bailyes.Toolkit, "Toolkit missing");
  assert.ok(bailyes.Store, "Store missing");
  console.log("exports ok:", Object.keys(bailyes));

  const { Handler } = bailyes;
  const handler = new Handler(["!"]);
  let called = null;
  handler.command("ping", (ctx) => { called = ctx.command; });
  await handler.handle({ text: "!ping foo bar" });
  assert.strictEqual(called, "ping");
  console.log("handler ok");

  const { Store } = bailyes;
  const store = new Store();
  const fakeEv = { on: () => {} };
  store.bind(fakeEv);
  store.upsertContact({ id: "628123@s.whatsapp.net", name: "Isan" });
  assert.strictEqual(store.getName("628123@s.whatsapp.net"), "Isan");
  assert.strictEqual(store.getName("999@s.whatsapp.net"), "999");
  console.log("store ok");

  const { Toolkit } = bailyes;
  const ie = Toolkit.extractIE("check [this](https://example.com) out");
  assert.ok(ie.text.includes("NIXEL_HYPERLINK_0"));
  console.log("toolkit extractIE ok");

  const dur = Toolkit.getMp4Duration(Buffer.alloc(4), { silent: true });
  assert.strictEqual(dur, 0);
  console.log("toolkit getMp4Duration ok");

  const fakeClient = {
    waUploadToServer: async () => ({ url: "https://fake" }),
    relayMessage: async () => {}
  };

  const { ButtonV2 } = bailyes;
  const btn = new ButtonV2(fakeClient);
  btn.setBody("hello").setFooter("footer").addButton("Click me", "id1");
  const built = await btn.build("123@s.whatsapp.net");
  assert.ok(built.message.buttonsMessage);
  console.log("ButtonV2 build ok");

  try {
    const empty = new ButtonV2(fakeClient);
    await empty.send("123@s.whatsapp.net");
    throw new Error("should have thrown");
  } catch (error) {
    assert.match(error.message, /at least one button/);
  }
  console.log("ButtonV2 empty-button guard ok");

  const { AIRich } = bailyes;
  const rich = new AIRich(fakeClient);
  rich.setTitle("Bot").addText("hello world").addTip("tip here");
  const richBuilt = await rich.build();
  assert.ok(richBuilt.botForwardedMessage);
  console.log("AIRich build ok");

  console.log("ALL TESTS PASSED");
}

main().catch((error) => {
  console.error("TEST FAILED:", error);
  process.exit(1);
});
