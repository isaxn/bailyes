/*
@author : isank dev
@linkch : https://whatsapp.com/channel/0029Vb8Fj4S1iUxiJPyKFh1U
@note : informasi update nya lewat ch
@tanggal : now
*/

"use strict";

const { Bailyes, bx } = require("@isaxn/bailyes");

const bot = new Bailyes({
  auth: "auth",
  prefix: ["!", "."],
  pairingCode: true,
  phoneNumber: "6281234567890",
  store: { file: "store.json", autosaveInterval: 15000 }
});

bot.onFramework("pairing-code", (code) => {
  console.log("Pairing code:", code);
});

bot.onFramework("ready", () => {
  console.log("Bot connected");
});

bot.command("ping", async (ctx) => {
  await ctx.reply("pong");
});

bot.command("menu", async (ctx) => {
  await bx.button(ctx.sock, ctx.chat, {
    body: "Pilih menu di bawah ini",
    footer: "Bailyes Bot",
    buttons: [
      { text: "Ping", id: "menu_ping" },
      { text: "Info", id: "menu_info" }
    ],
    options: { quoted: ctx.msg }
  });
});

bot.command("live", async (ctx) => {
  await bx.livePhoto(ctx.sock, ctx.chat, {
    image: "https://example.com/foto.jpg",
    video: "https://example.com/klip.mp4"
  });
});

bot.command("promo", async (ctx) => {
  const { key } = await ctx.sock.sendMessage(ctx.chat, { text: "Menyiapkan promo..." });

  await bx.liveThumbnail(ctx.sock, ctx.chat, {
    key,
    text: "Cek promo terbaru kami",
    link: "https://example.com/promo",
    title: "Promo Spesial",
    description: "Berlaku hari ini saja",
    images: [
      "https://example.com/promo1.jpg",
      "https://example.com/promo2.jpg",
      "https://example.com/promo3.jpg"
    ],
    interval: 1500,
    loops: 2
  });
});

bot.hear(/^halo$/i, async (ctx) => {
  await ctx.reply("Halo juga!");
});

bot.start();
