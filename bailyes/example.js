"use strict";

const { Bailyes, ButtonV2 } = require("@isaxn/bailyes");

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

bot.onFramework("close", ({ reason }) => {
  console.log("Connection closed:", reason);
});

bot.command("ping", async (ctx) => {
  await ctx.reply("pong");
});

bot.command("whoami", async (ctx) => {
  const name = ctx.getName();
  await ctx.reply(`Nama kamu: ${name}\nJID: ${ctx.sender}`);
});

bot.command("menu", async (ctx) => {
  const menu = new ButtonV2(ctx.sock)
    .setBody("Pilih menu di bawah ini")
    .setFooter("Bailyes Bot")
    .addButton("Ping", "menu_ping")
    .addButton("Info", "menu_info");

  await menu.send(ctx.chat, { quoted: ctx.msg });
});

bot.hear(/^halo$/i, async (ctx) => {
  await ctx.reply("Halo juga!");
});

bot.start();
