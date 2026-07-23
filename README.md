# @isaxn/bailyes

Framework WhatsApp bot berbasis [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys), dengan:

- Login QR **dan** pairing code
- Auto-reconnect yang tidak kehilangan event setelah socket diganti
- `Store` bawaan (kontak, chat, pesan, metadata grup) — pengganti `makeInMemoryStore` yang sudah dihapus dari Baileys
- Cara panggil simpel satu-fungsi lewat `bx` (`bx.button`, `bx.list`, `bx.card`, `bx.rich`, `bx.livePhoto`, `bx.liveThumbnail`, `bx.linkPreview`)
- Builder chain klasik untuk kontrol detail: `Button`, `ButtonV2`, `Carousel`, `AIRich`
- 100% bisa dipakai lewat `require(...)`, tidak perlu ESM

## Instalasi

```bash
npm install @isaxn/bailyes sharp
```

Paket ini memuat `@whiskeysockets/baileys` secara dinamis di dalam (Baileys versi terbaru murni ESM), jadi kamu tetap bisa `require("@isaxn/bailyes")` seperti biasa walaupun dependensinya ESM.

```js
const bailyes = require("@isaxn/bailyes");
const { Bailyes, bx, Store } = bailyes;
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

## Referensi semua fungsi

### `Bailyes` — class utama bot

```js
new Bailyes(options)
```

| Opsi | Default | Keterangan |
|---|---|---|
| `auth` | `"auth"` | folder penyimpanan sesi login |
| `prefix` | `["!"]` | array prefix command |
| `cooldown` | `0` | jeda antar pesan per-chat (ms), `0` = nonaktif |
| `pairingCode` | `false` | pakai kode pairing, bukan QR |
| `phoneNumber` | `null` | wajib diisi kalau `pairingCode: true` |
| `store` | `{}` | opsi `Store`, atau `false` untuk matikan |
| `reconnectDelay` | `3000` | delay dasar reconnect (ms) |
| `maxReconnectDelay` | `30000` | batas atas delay reconnect (ms) |
| `maxReconnectAttempts` | `0` | `0` = tidak dibatasi |

Method:

- `bot.on(event, fn)` — dengarkan event mentah dari Baileys (`messages.upsert`, `chats.update`, dst)
- `bot.onFramework(event, fn)` — dengarkan event framework: `ready`, `qr`, `pairing-code`, `close`, `logged-out`, `error`, `message`
- `bot.command(name | [names], fn)` — daftarkan command
- `bot.hear(stringOrRegex, fn)` — respons tanpa prefix
- `bot.start()` — mulai koneksi, return `sock`
- `bot.stop()` — putus koneksi & hentikan autosave `Store`
- `bot.store` — getter ke instance `Store` yang aktif
- `bot.sock` — instance socket Baileys aktif setelah `ready`

### `bx` — pemanggilan cepat satu fungsi

- `bx.button(sock, jid, { title, body, footer, thumbnail, buttons: [{ text, id }], contextInfo, options })`
- `bx.list(sock, jid, { title, body, footer, sections: [{ title, highlight, rows: [{ header, title, description, id }] }], contextInfo, options })`
- `bx.card(sock, jid, { body, footer, cards: [{ title, subtitle, body, footer, image, video, buttons: [{ type: "url"|"call"|"copy"|"reply", text, value }] }], contextInfo, options })`
- `bx.rich(sock, jid, { title, text, code: { language, content }, table, tip, options })`
- `bx.linkPreview(sock, jid, { text, link, title, description, thumbnail, options })`
- `bx.livePhoto(sock, jid, { image, video, options })` — kirim gambar yang otomatis "hidup" jadi video singkat saat ditekan, mirip Live Photo di iPhone
- `bx.liveThumbnail(sock, jid, { key, text, link, title, description, images: [...], size, interval, loops, quality })` — edit pesan berulang dengan thumbnail link-preview yang berganti-ganti

### `Button` — interactiveMessage / native flow list

```js
new Button(sock)
  .setTitle(title) .setSubtitle(subtitle) .setBody(body) .setFooter(footer) .setContextInfo(obj)
  .setImage(url|buffer, opts) .setVideo(url|buffer, opts) .setDocument(url|buffer, opts) .setMedia(obj)
  .addSelection(title, opts) .makeSection(title, highlightLabel) .makeRow(header, title, description, id)
  .addReply(text, id, opts) .addCall(text, id, opts) .addUrl(text, url, webview, opts) .addCopy(text, code, opts)
  .addReminder(text, id, opts) .addCancelReminder(text, id, opts) .addAddress(text, id, opts) .addLocation(opts)
  .addButton(name, params) .clearButtons() .setParams(obj)
  .toCard()
  .build(jid, opts)
  .send(jid, opts)
```

### `ButtonV2` — buttonsMessage

```js
new ButtonV2(sock)
  .setBody(body) .setFooter(footer) .setContextInfo(obj)
  .setThumbnail(url|buffer) .setMedia(obj)
  .addButton(displayText, buttonId?) .addRawButton(obj)
  .build(jid, opts)
  .send(jid, opts)
```

`send()` wajib minimal satu `.addButton()`, kalau tidak melempar `Error`.

### `Carousel`

```js
new Carousel(sock)
  .setBody(body) .setFooter(footer) .setContextInfo(obj)
  .addCard(cardOrArrayOfCards)
  .build(jid, opts)
  .send(jid, opts)
```

Tiap card didapat dari `Button().toCard()`.

### `AIRich` — rich response ala AI

```js
new AIRich(sock)
  .setTitle(title) .setBody(body) .setFooter(footer) .setContextInfo(obj)
  .addText(text, opts) .addCode(language, code) .addTable(rows2D, opts)
  .addSource([[icon, url, text], ...]) .addReels(item|items) .addImage(url|buffer|array, opts)
  .addVideo(url|buffer|object|array, opts) .addProduct(item|items) .addPost(item|items)
  .addTip(text) .addSuggest(text|array, opts)
  .addSubmessage(obj) .addSection(obj)
  .build(opts)
  .send(jid, opts)
```

### `Toolkit` — util media (static, tidak perlu instance)

- `Toolkit.extractIE(text, opts)` — parser `[teks](url)` untuk tautan/sitasi/latex
- `Toolkit.waitAllPromises(input)` — resolve semua Promise bersarang di dalam objek/array
- `Toolkit.resize(buffer, x, y, fit?)` — resize gambar pakai `sharp`
- `Toolkit.fetchBuffer(url, fetchOpts?, { silent })` — unduh jadi `Buffer`
- `Toolkit.toUrl(sock, buffer|url, mediaType)` — upload ke server WA, hasil URL
- `Toolkit.resolveMedia(sock, media, mediaType, opts)` — serba-bisa: url/buffer/base64 -> url/buffer/base64
- `Toolkit.getMp4Duration(buffer, { silent })` — durasi video dari buffer mp4
- `Toolkit.getMp4Preview(buffer, { time, result, resize, width, height, silent })` — screenshot frame video jadi gambar

### `Store` — memory kontak, chat, pesan

```js
new Store({ file, autosaveInterval, maxMessagesPerChat })
```

- `store.bind(ev)` — dipanggil otomatis oleh `WAClient`/`Bailyes`
- `store.getName(jid)` — nama kontak (fallback ke nomor)
- `store.getContact(jid)` / `store.getChat(jid)` / `store.getGroupMetadata(jid)`
- `store.loadMessage(jid, id)` — ambil pesan lama dari memory (berguna untuk quoted/anti-delete)
- `store.upsertContact(obj)` / `store.upsertChat(obj)` / `store.upsertMessage(msg)` / `store.upsertGroupMetadata(obj)`
- `store.toJSON()` / `store.fromJSON(data)`
- `store.writeToFile(path?)` / `store.readFromFile(path?)`
- `store.stop()` — hentikan autosave

### `Context` (`ctx`) — wrapper pesan masuk di dalam `bot.command()`/`bot.hear()`

Properti: `ctx.sock`, `ctx.msg`, `ctx.chat`, `ctx.sender`, `ctx.isGroup`, `ctx.isLid`, `ctx.fromMe`, `ctx.text`, `ctx.command`, `ctx.args`, `ctx.isImage`, `ctx.isVideo`, `ctx.isAudio`, `ctx.isSticker`, `ctx.isDocument`, `ctx.isVN`

Method:

- `ctx.getName(jid?)` — nama kontak lewat `Store`
- `ctx.getProfilePicture(jid?)` — url foto profil, `null` kalau gagal (termasuk `@lid`)
- `ctx.downloadMedia(folder?)` — unduh media pesan masuk ke disk
- `ctx.reply(text, opts?)` — balas teks
- `ctx.replyButtons(text, buttons, footer?, opts?)` — balas dengan buttonsMessage cepat
- `ctx.react(emoji)` — kirim reaksi ke pesan

### `WAClient` — koneksi tingkat rendah (dipakai `Bailyes` di dalam)

```js
new WAClient(options)
  .connect()
  .stop()
```

Event: `open`, `close`, `qr`, `pairing-code`, `logged-out`, `error`, plus semua event Baileys asli (`messages.upsert`, `chats.update`, dst) diteruskan langsung.

### `Handler` / `Events` — dipakai internal oleh `Bailyes`

- `new Handler(prefix)` — `.command(name, fn)`, `.hear(pattern, fn)`, `.handle(ctx)`
- `new Events()` — `.on(event, fn)`, `.off(event, fn)`, `.emit(event, data)`

### `bind(sock)` / `sendLinkPreview`

- `bind(sock)` — tempel `sock.sendLinkPreview(jid, text, link, title, description, thumbnail, opts)`, otomatis dipanggil `Bailyes.start()`
- `sendLinkPreview(sock, jid, { text, link, title, description, thumbnail, options })` — versi fungsi berdiri sendiri, dipakai juga oleh `bx.linkPreview`

## Perbaikan dari versi sebelumnya

- **`require()` sekarang benar-benar berfungsi** tanpa perlu build step terpisah (`dist/`), karena Baileys (ESM) di-load lewat `import()` dinamis yang di-cache, dipanggil dari dalam fungsi `async` — bukan `import` statis yang bikin `require()` gagal.
- **Pairing code** ditambahkan (`pairingCode: true` + `phoneNumber`), sebelumnya hanya QR.
- **Reconnect tidak lagi memutus listener command** — sebelumnya `sock.ev.on("messages.upsert", ...)` didaftarkan sekali di `start()`, jadi setelah reconnect (socket baru), listener lama menunjuk ke socket basi. Sekarang event diteruskan lewat `WAClient` (EventEmitter sendiri) yang stabil lintas reconnect.
- **`ButtonV2` tanpa `.addButton()` sekarang melempar error jelas**, bukan diam-diam fallback jadi pesan teks biasa.
- **`ButtonV2` tidak lagi maksa header jadi `locationMessage` palsu** (lat/long 0,0) kalau tidak diset thumbnail — default sekarang header teks biasa.
- **Store/memory kontak dibuat manual** (`Store`) karena Baileys tidak lagi menyediakan `makeInMemoryStore` bawaan.
- **`@lid` dan JID lain yang gagal diambil foto profilnya** tidak lagi melempar exception — `ctx.getProfilePicture()` mengembalikan `null` dengan aman lewat try/catch.
- **`@whiskeysockets/baileys` dinaikkan ke `^6.7.23`** (versi `6.7.9` yang dipakai sebelumnya kena advisory keamanan spoofing pesan).
- File tunggal 2600+ baris dipecah jadi modul-modul kecil per tanggung jawab supaya gampang di-maintain dan tidak saling tabrak saat diedit.
- Ditambahkan `bx` — cara panggil satu fungsi tanpa perlu chaining `.addButton()` dkk, plus fitur baru `bx.livePhoto` dan `bx.liveThumbnail`.

## Saran update selanjutnya

- **Plugin loader otomatis** — folder `plugins/` di-scan, tiap file otomatis jadi command.
- **Anti-delete berbasis `Store`** — dengarkan `messages.delete`, kirim ulang isi pesan lama pakai `store.loadMessage()`.
- **Rate limiter per-command** — `cooldown` sekarang masih per-chat global, bisa dibuat per-command per-user.
- **Poll message builder** — `bx.poll(sock, jid, { question, options })`.
- **Session multi-akun** — `SessionManager` untuk jalankan banyak `Bailyes` instance sekaligus (multi-nomor).
- **Backend `Store` opsional ke SQLite** — biar tidak makan RAM untuk bot dengan banyak chat/pesan.
- **Webhook/HTTP bridge** — endpoint HTTP kecil biar bot bisa dikontrol dari luar.

## Testing

```bash
npm test
```

## Lisensi

MIT — lihat `LICENSE`.
