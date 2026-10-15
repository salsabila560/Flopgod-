# $FLOPGOD website

Landing page memecoin $FLOPGOD (pair NVDA stock token, Robinhood Chain).
Gaya meme hand-drawn, tanpa framework, tanpa build step.

## Isi folder

```
index.html          halaman utama
css/style.css       semua styling
js/config.js        <- ISI INI saat launch (contract, link buy, X, Telegram)
js/api.js           komunikasi ke backend
js/main.js          tombol pray, counter, leaderboard
js/game.js          mini game "feed him"
assets/             maskot + favicon (SVG)
api/                backend kecil (Vercel Functions)
  stats.js          GET  total doa, jumlah faithful, top 10
  pray.js           POST tambah doa
  score.js          POST simpan skor terbaik
  _redis.js         helper database (bukan endpoint)
```

## Saat token launch

Buka `js/config.js` lalu isi:

```js
contractAddress: "0x...",
buyUrl: "https://...",
xUrl: "https://x.com/...",
telegramUrl: "https://t.me/..."
```

Kalau kosong, tombol beli tampil "launching soon" dan CA tampil "soon™".

## Deploy ke Vercel

1. Upload folder ini ke GitHub, lalu Import di vercel.com (atau jalankan `npx vercel` di folder ini).
2. Di project Vercel: **Storage → Marketplace → Upstash (Redis) → Connect**. Ini otomatis mengisi env var database.
3. Redeploy. Selesai.

Tanpa database, situs tetap jalan: doa dan skor hanya tersimpan di browser masing-masing pengunjung,
dan tulisan di bawah counter berubah jadi "temple is offline".

## Coba di komputer sendiri

```
npm i -g vercel
vercel dev
```

Buka http://localhost:3000. Membuka `index.html` langsung juga bisa, tapi mode offline.

## Catatan keamanan

- Ada batas spam sederhana per IP (doa dan skor) dan skor maksimal 50.000.
- Leaderboard game browser **tidak bisa 100% anti-cheat**. Jangan jadikan hadiah token/uang
  berdasarkan leaderboard ini tanpa verifikasi tambahan.
- Jangan pakai logo/nama Nvidia di aset. Disclaimer di footer jangan dihapus.
