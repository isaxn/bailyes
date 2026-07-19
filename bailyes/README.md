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

## Struktur paket

```
src/
  index.js                 entry point, export semua class
  core/
    baileys-loader.js      lazy-loader ESM Baileys (dipakai semua modul lain)
    client.js               WAClient: koneksi, reconnect, QR/pairing code
    store.js                 Store: memory kontak/chat/pesan
    events.js                 event emitter kecil untuk Handler
    handler.js                 router command & hear
    context.js                  wrapper pesan masuk (ctx)
  message/
    index.js                 barrel export Button, ButtonV2, Carousel, AIRich, Toolkit, bind
    base-builder.js           class dasar (title, body, footer, dst)
    inline-entities.js         parser [text](url) untuk AIRich
    tokenizer.js                syntax highlighter untuk AIRich.addCode
    table.js                     helper tabel untuk AIRich.addTable
    toolkit.js                    resize gambar, resolve media, preview video
    native-flow.js                relay node "biz/interactive" (dipakai Button/ButtonV2/Carousel)
    button.js, button-v2.js, carousel.js, ai-rich.js, link-preview.js
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

## Perbaikan dari versi sebelumnya

- **`require()` sekarang benar-benar berfungsi** tanpa perlu build step terpisah (`dist/`), karena Baileys (ESM) di-load lewat `import()` dinamis yang di-cache, dipanggil dari dalam fungsi `async` — bukan `import` statis yang bikin `require()` gagal.
- **Pairing code** ditambahkan (`pairingCode: true` + `phoneNumber`), sebelumnya hanya QR.
- **Reconnect tidak lagi memutus listener command** — sebelumnya `sock.ev.on("messages.upsert", ...)` didaftarkan sekali di `start()`, jadi setelah reconnect (socket baru), listener lama menunjuk ke socket basi. Sekarang event diteruskan lewat `WAClient` (EventEmitter sendiri) yang stabil lintas reconnect.
- **`ButtonV2` tanpa `.addButton()` sekarang melempar error jelas**, bukan diam-diam fallback jadi pesan teks biasa.
- **Store/memory kontak dibuat manual** (`src/core/store.js`) karena Baileys tidak lagi menyediakan `makeInMemoryStore` bawaan.
- **`@lid` dan JID lain yang gagal diambil foto profilnya** tidak lagi melempar exception — `ctx.getProfilePicture()` mengembalikan `null` dengan aman lewat try/catch.
- **`@whiskeysockets/baileys` dinaikkan ke `^6.7.23`** (versi `6.7.9` yang dipakai sebelumnya kena advisory keamanan spoofing pesan).
- File tunggal 2600+ baris (`build-message.js`) dipecah jadi modul-modul kecil per tanggung jawab (`toolkit`, `base-builder`, `button`, `button-v2`, `carousel`, `ai-rich`, `tokenizer`, `table`, `inline-entities`, `native-flow`, `link-preview`) supaya gampang di-maintain dan tidak saling tabrak saat diedit.

## Testing

```bash
npm test
```

`test/basic.test.js` menguji Handler, Store, Toolkit, dan proses `build()` dari `ButtonV2`/`AIRich` tanpa perlu koneksi WhatsApp asli.

## Lisensi

MIT — lihat `LICENSE`.
