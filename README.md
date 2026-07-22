# @isaxn/bailyes

Framework WhatsApp bot berbasis [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys), dengan:

- Login QR **dan** pairing code
- Auto-reconnect yang tidak kehilangan event setelah socket diganti
- `Store` bawaan (kontak, chat, pesan, metadata grup) — pengganti `makeInMemoryStore` yang sudah dihapus dari Baileys
- Message builder modular: `Button`, `ButtonV2`, `Carousel`, `AIRich`
- 100% bisa dipakai lewat `require(...)`, tidak perlu ESM

## Instalasi

```bash
npm install @isaxn/bailyes
```

Paket ini memuat `@whiskeysockets/baileys` secara dinamis di dalam (Baileys versi terbaru murni ESM), jadi kamu tetap bisa `require("@isaxn/bailyes")` seperti biasa walaupun dependensinya ESM.

```js
const button = require("@isaxn/bailyes");
const { Bailyes, ButtonV2, Store } = button;
```


## Quick start — bot sederhana

```js
const { Bailyes } = require("@isaxn/bailyes");

const bot = new Bailyes({
  auth: "auth",
  prefix: ["!", "."]
});

bot.command("ping", async (ctx) => {
  await ctx.reply("pong");
});

bot.onFramework("ready", () => console.log("Bot connected"));

bot.start();
```

Menjalankan `node bot.js` akan menampilkan QR code di terminal secara default.

## Login dengan pairing code

```js
const bot = new Bailyes({
  auth: "auth",
  pairingCode: true,
  phoneNumber: "6281234567890"
});

bot.onFramework("pairing-code", (code) => {
  console.log("Masukkan kode ini di WhatsApp:", code);
});

bot.start();
```

`phoneNumber` wajib diisi format internasional tanpa `+` atau spasi (`62...`). Kalau `pairingCode: true` tapi sesi sudah pernah login sebelumnya (`creds.registered`), kode tidak akan diminta lagi.

## Reconnect

`WAClient` menyimpan status koneksi lewat `EventEmitter` sendiri (`open`, `close`, `qr`, `pairing-code`, `logged-out`, `error`), bukan langsung dari `sock.ev`. Jadi walaupun socket internal diganti saat reconnect, listener command/hear kamu **tidak hilang** — beda dari versi sebelumnya yang mendaftarkan `messages.upsert` langsung ke `sock.ev` sekali saja di awal.

Reconnect otomatis dengan backoff (`reconnectDelay * attempt`, dibatasi `maxReconnectDelay`), berhenti otomatis kalau `DisconnectReason` adalah `loggedOut`.

```js
const bot = new Bailyes({
  reconnectDelay: 3000,
  maxReconnectDelay: 30000,
  maxReconnectAttempts: 0 // 0 = tidak dibatasi
});
```

## Store — memory kontak, chat, dan pesan

Baileys versi baru tidak lagi menyediakan `makeInMemoryStore` bawaan, jadi harus dibuat manual. `Store` di paket ini otomatis mendengarkan event `contacts.*`, `chats.*`, `messages.*`, `groups.*`, `group-participants.update`.

```js
const { Store } = require("@isaxn/bailyes");

const store = new Store({
  file: "store.json",       // opsional: simpan/baca otomatis dari file
  autosaveInterval: 15000,  // interval autosave (ms)
  maxMessagesPerChat: 200   // batas pesan yang disimpan per chat
});
```

Dipakai lewat opsi `store` saat membuat `Bailyes`/`WAClient` (otomatis dibind ke `sock.ev`):

```js
const bot = new Bailyes({
  store: { file: "store.json", autosaveInterval: 15000 }
});
```

Atau matikan store sama sekali dengan `store: false`.

API `Store`:

- `store.getName(jid)` — nama kontak (fallback ke nomor)
- `store.getContact(jid)`, `store.getChat(jid)`, `store.getGroupMetadata(jid)`
- `store.loadMessage(jid, id)` — ambil pesan lama dari memory (berguna untuk quoted/anti-delete)
- `store.writeToFile(path)` / `store.readFromFile(path)` — simpan/baca manual
- `store.toJSON()` / `store.fromJSON(data)`

Di dalam `ctx` (Context pesan masuk), tinggal panggil `ctx.getName()` — otomatis pakai store yang sama.

## Message builder

### ButtonV2 (buttonsMessage)

```js
const { ButtonV2 } = require("@isaxn/bailyes");

const msg = new ButtonV2(sock)
  .setBody("Pilih salah satu")
  .setFooter("Bailyes Bot")
  .addButton("Menu 1", "menu1")
  .addButton("Menu 2", "menu2");

await msg.send(jid, { quoted: ctx.msg });
```

`ButtonV2` **wajib** minimal satu `.addButton()` sebelum `.send()` — kalau tidak, akan langsung melempar `Error`, bukan diam-diam fallback jadi teks biasa seperti sebelumnya.

### Button (interactiveMessage / native flow list)

```js
const { Button } = require("@isaxn/bailyes");

const msg = new Button(sock)
  .setTitle("Judul")
  .setBody("Isi pesan")
  .addSelection("Pilih menu")
  .makeSection("Kategori A")
  .makeRow("", "Item 1", "Deskripsi item 1", "item1")
  .makeRow("", "Item 2", "Deskripsi item 2", "item2");

await msg.send(jid);
```

### Carousel

```js
const { Carousel, Button } = require("@isaxn/bailyes");

const card1 = await new Button(sock).setImage("https://...").setTitle("Kartu 1").toCard();
const card2 = await new Button(sock).setImage("https://...").setTitle("Kartu 2").toCard();

const carousel = new Carousel(sock).setBody("Lihat pilihan berikut").addCard([card1, card2]);

await carousel.send(jid);
```

### AIRich (rich response ala AI)

```js
const { AIRich } = require("@isaxn/bailyes");

const rich = new AIRich(sock)
  .setTitle("Asisten")
  .addText("Ini contoh **teks** dengan [tautan](https://example.com)")
  .addCode("javascript", "console.log('halo')")
  .addTip("Ketik !menu untuk melihat semua perintah");

await rich.send(jid);
```

### Toolkit

Kumpulan util murni tanpa perlu instance socket kecuali fungsi yang upload media (`toUrl`, `resolveMedia`):

```js
const { Toolkit } = require("@isaxn/bailyes");

const buffer = await Toolkit.fetchBuffer("https://example.com/gambar.jpg");
const resized = await Toolkit.resize(buffer, 300, 300);
```

## v2.1.0 — cara panggil baru: `bx`

Selain builder chain (`new ButtonV2(sock).setBody(...).addButton(...)`), sekarang ada `bx` — satu fungsi sekali panggil, tanpa chaining, untuk kasus-kasus umum:

```js
const { bx } = require("@isaxn/bailyes");

await bx.button(sock, jid, {
  body: "Pilih menu",
  footer: "Bailyes Bot",
  buttons: [
    { text: "Menu 1", id: "menu1" },
    { text: "Menu 2", id: "menu2" }
  ]
});

await bx.list(sock, jid, {
  title: "Daftar Produk",
  sections: [
    { title: "Kategori A", rows: [{ title: "Item 1", description: "Deskripsi", id: "item1" }] }
  ]
});

await bx.card(sock, jid, {
  body: "Lihat produk kami",
  cards: [
    { title: "Produk 1", image: "https://...", buttons: [{ type: "url", text: "Beli", value: "https://..." }] },
    { title: "Produk 2", image: "https://...", buttons: [{ type: "reply", text: "Tanya", value: "tanya1" }] }
  ]
});

await bx.rich(sock, jid, { title: "Asisten", text: "Halo!", tip: "Ketik !menu" });

await bx.linkPreview(sock, jid, { text: "Cek ini", link: "https://example.com", title: "Judul", description: "Deskripsi" });
```

### `bx.livePhoto` — kirim foto + video terpasang jadi satu (Live Photo)

Fitur baru: kirim gambar yang otomatis "hidup" jadi video singkat saat ditekan, mirip Live Photo di iPhone. Ini memakai `messageAssociation` bawaan WhatsApp (video di-relay terpisah tapi terikat ke `parentMessageKey` pesan gambar).

```js
await bx.livePhoto(sock, jid, {
  image: "https://example.com/foto.jpg",   // url, path lokal, atau Buffer
  video: "https://example.com/klip.mp4"    // url, path lokal, atau Buffer
});
```

### `bx.liveThumbnail` — animasi thumbnail link preview

Edit pesan berulang kali dengan thumbnail link-preview yang berganti-ganti, jadi efek "gambar bergerak" di dalam satu bubble teks/link.

```js
const { key } = await sock.sendMessage(jid, { text: "Menyiapkan..." });

await bx.liveThumbnail(sock, jid, {
  key,
  text: "Cek promo ini",
  link: "https://example.com/promo",
  title: "Promo",
  description: "Terbatas hari ini",
  images: ["https://.../1.jpg", "https://.../2.jpg", "https://.../3.jpg"],
  interval: 1500,
  loops: 2
});
```

## Perbaikan dari versi sebelumnya

- **`require()` sekarang benar-benar berfungsi** tanpa perlu build step terpisah (`dist/`), karena Baileys (ESM) di-load lewat `import()` dinamis yang di-cache, dipanggil dari dalam fungsi `async` — bukan `import` statis yang bikin `require()` gagal.
- **Pairing code** ditambahkan (`pairingCode: true` + `phoneNumber`), sebelumnya hanya QR.
- **Reconnect tidak lagi memutus listener command** — sebelumnya `sock.ev.on("messages.upsert", ...)` didaftarkan sekali di `start()`, jadi setelah reconnect (socket baru), listener lama menunjuk ke socket basi. Sekarang event diteruskan lewat `WAClient` (EventEmitter sendiri) yang stabil lintas reconnect.
- **`ButtonV2` tanpa `.addButton()` sekarang melempar error jelas**, bukan diam-diam fallback jadi pesan teks biasa.
- **Store/memory kontak dibuat manual** (`src/core/store.js`) karena Baileys tidak lagi menyediakan `makeInMemoryStore` bawaan.
- **`@lid` dan JID lain yang gagal diambil foto profilnya** tidak lagi melempar exception — `ctx.getProfilePicture()` mengembalikan `null` dengan aman lewat try/catch.
- **`@whiskeysockets/baileys` dinaikkan ke `^6.7.23`** (versi `6.7.9` yang dipakai sebelumnya kena advisory keamanan spoofing pesan).
- File tunggal 2600+ baris (`build-message.js`) dipecah jadi modul-modul kecil per tanggung jawab (`toolkit`, `base-builder`, `button`, `button-v2`, `carousel`, `ai-rich`, `tokenizer`, `table`, `inline-entities`, `native-flow`, `link-preview`) supaya gampang di-maintain dan tidak saling tabrak saat diedit.

## Saran update selanjutnya

- **Plugin loader otomatis** — folder `plugins/` di-scan, tiap file otomatis jadi command (mirip pola yang sudah kamu pakai di bot lamamu), supaya `bot.command()` tidak ditulis manual satu-satu.
- **Anti-delete berbasis `Store`** — karena `store.loadMessage(jid, id)` sudah ada, tinggal dengarkan event `messages.delete` dan kirim ulang isi pesan lama sebelum dihapus.
- **Rate limiter per-command** — `cooldown` sekarang masih per-chat global; bisa dibuat per-command per-user biar lebih presisi (misal command berat dibatasi lebih ketat dari command ringan).
- **Poll message builder** — builder khusus untuk `pollCreationMessage`, senada gaya `bx` (`bx.poll(sock, jid, { question, options })`).
- **Session multi-akun** — satu proses Node bisa jalankan banyak `Bailyes` instance sekaligus (multi-nomor), tinggal kasih `auth` folder beda-beda; bisa dibungkus jadi `SessionManager` biar gampang.
- **Backend `Store` opsional ke SQLite** — saat ini `Store` murni in-memory + file JSON; untuk bot dengan banyak chat/pesan, opsi simpan ke SQLite (`better-sqlite3`) bakal lebih tahan crash dan tidak makan RAM.
- **Webhook/HTTP bridge** — endpoint HTTP kecil biar bot bisa dikontrol dari luar (kirim pesan lewat API, cek status koneksi, dsb), cocok buat kamu yang juga suka bikin REST API (NexRay API).

## Testing

```bash
npm test
```

`test/basic.test.js` menguji Handler, Store, Toolkit, dan proses `build()` dari `ButtonV2`/`AIRich` tanpa perlu koneksi WhatsApp asli.

## Lisensi

MIT — lihat `LICENSE`.
