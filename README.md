# SMAN 2 Mengwi - Portal Analisis Tes Kompetensi Akademik (TKA) Nasional

Portal dasbor interaktif premium untuk visualisasi dan analisis hasil **Tes Kompetensi Akademik (TKA) Nasional** dari SMA Negeri 2 Mengwi. Aplikasi ini dirancang untuk membantu tenaga pendidik dan sekolah memetakan daya serap kompetensi siswa, membandingkannya dengan rerata wilayah, membedah indikator butir soal, serta mengekspor dokumen soal ujian secara instan.

---

## 🚀 Fitur Utama

### 1. Kunci Fokus SMAN 2 Mengwi
Dasbor dikunci secara permanen pada parameter sekolah target (**NPSN: 50101684 / Kode Sekolah: U22090017**) untuk memastikan efisiensi pemantauan internal tanpa adanya dropdown wilayah yang membingungkan.

### 2. Grid Statistik Perbandingan 4 Tingkat
Menyajikan statistik rerata daya serap sekolah secara real-time yang disandingkan langsung dengan tiga level pembanding:
* **SMAN 2 Mengwi (Sekolah)**
* **Kabupaten Badung**
* **Provinsi Bali**
* **Rerata Nasional**

Masing-masing statistik dilengkapi dengan **kode warna dinamis** (Hijau $\ge 60\%$, Jingga $40\% - 59\%$, Merah $< 40\%$) untuk mempermudah identifikasi posisi performa sekolah.

### 3. Analisis Hierarki Subelemen & Indikator Soal
Sistem akordeon interaktif yang membedah hasil ujian ke dalam 3 hierarki:
* **Level 1 (Elemen)**: Dilengkapi rata-rata nilai elemen dan grafik komparasi batang.
* **Level 2 (Subelemen)**: Memetakan rata-rata subelemen kompetensi.
* **Level 3 (Indikator Soal)**: Menampilkan daya serap siswa, tingkat kesalahan, tombol contoh soal, serta grafik perbandingan wilayah per butir soal.
* **Penyaring Cerdas**: Memungkinkan guru menyaring indikator secara instan berdasarkan kategori daya serap rendah (<40%) atau tinggi (>=60%).

### 4. Integrasi Gemini AI Solver (Pemecah Soal Otomatis)
Bagi butir-butir soal ujian nasional yang kunci jawaban dan pembahasannya dirahasiakan oleh kementerian:
* Guru dapat menghubungkan **Gemini API Key** gratis mereka (disimpan aman secara lokal di `localStorage` browser).
* Menggunakan model **`gemini-2.5-flash`** untuk membedah soal, menentukan kunci jawaban yang benar, menulis pembahasan langkah-demi-langkah, dan langsung menyorot jawaban yang tepat di daftar pilihan secara dinamis.

### 5. Ekspor Dokumen Bank Soal & Pembahasan
Memungkinkan sekolah mengunduh seluruh contoh soal dari 22 mata pelajaran sekaligus:
* **Format TXT**: Dokumen teks polos (*plain text*) yang bersih dan ringkas.
* **Format DOC**: Dokumen Word yang didesain menggunakan HTML MSWord khusus agar rapi saat dibuka di Microsoft Word atau Google Docs.
* **Format PDF**: Reruntutan cetak beresolusi tinggi dengan logo sekolah resmi dan tata letak print-friendly (*auto-print print dialog*).
* **Scraper Latar Belakang & Caching**: Server lokal akan men-download dan membuat cache data soal secara mandiri di disk (`questions_cache.json`) pada unduhan pertama dengan visualisasi *progress bar* interaktif di frontend. Unduhan selanjutnya berjalan instan (<10ms).

---

## 🛠️ Arsitektur & Teknologi Stack

### Backend (Node.js & Express)
* **Express.js**: Menangani API router dan server statis.
* **Crypto-JS**: Digunakan untuk mengenkripsi payload POST request menggunakan algoritma AES dengan kunci rahasia resmi kementerian agar lolos validasi API.
* **Header User-Agent Bypass**: Menggunakan header HTTP browser asli untuk menghindari proteksi Cloudflare (HTTP 403) dari API Kemendikdasmen.
* **Headers Anti-Cache**: Middleware server disiapkan untuk menolak caching static asset browser agar file JS/HTML selalu terupdate otomatis setelah pembaruan kode.

### Frontend (Vanilla JS & Tailwind)
* **HTML5 & Vanilla Javascript (ES6)**: Logika dan manipulasi DOM murni.
* **Tailwind CSS Play CDN (v3)**: Desain sistem bertema Terang (Light Mode) dengan aksen warna Biru (Royal Blue).
* **Chart.js v4 (Lokal)**: Digunakan untuk merender grafik perbandingan regional lintas elemen dan per butir soal secara responsif.

---

## 📂 Struktur Direktori Proyek

```text
tka-dashboard/
├── public/                     # Folder Aset Frontend
│   ├── app.js                  # Logika Dasbor, AJAX, Modal, & Gemini AI
│   ├── chart.js                # Library Chart.js v4 Lokal
│   ├── index.html              # Antarmuka (HTML5, Tailwind, & Custom CSS)
│   └── questions_cache.json    # Berkas Cache Hasil Scraper Bank Soal (Auto-generated)
├── server.js                   # Server Express.js, Scraper, & API Router
├── package.json                # Dependensi Project (Express, Crypto-JS)
├── README.md                   # Dokumentasi Utama Panduan Proyek
└── log.md                      # Log Pembaruan & Riwayat Pengembangan
```

---

## 💻 Cara Instalasi & Menjalankan Aplikasi

### Persyaratan Sistem
* **Node.js** (v18 atau yang lebih baru)
* **NPM** (terbawa saat menginstal Node.js)

### Langkah-langkah
1. **Ekstrak atau Clone Repositori**:
   Tempatkan folder proyek pada direktori lokal komputer Anda.

2. **Instal Dependensi**:
   Buka terminal di dalam folder proyek tersebut, lalu jalankan perintah:
   ```bash
   npm install
   ```

3. **Jalankan Server Lokal**:
   Untuk mode pengembangan (dengan fitur restart otomatis jika ada perubahan file), jalankan:
   ```bash
   npm run dev
   ```
   Atau untuk mode produksi:
   ```bash
   npm start
   ```

4. **Buka Dasbor**:
   Buka browser favorit Anda, lalu kunjungi tautan:
   **[http://localhost:3000](http://localhost:3000)**

---

## 🔒 Privasi dan Kunci API
Gemini API Key Anda disimpan di memori penyimpanan lokal (`localStorage`) peramban browser Anda sendiri. Kunci tersebut **tidak pernah dikirimkan atau disimpan di server backend** Anda maupun server eksternal mana pun selain dikirim langsung ke endpoint resmi Google Gemini API (`https://generativelanguage.googleapis.com`) secara aman melalui HTTPS.

---

## 🏛️ Kredensial Sekolah
* **Sekolah**: SMA Negeri 2 Mengwi (NPSN: `50101684`)
* **Kode Provinsi**: `22` (BALI)
* **Kode Rayon**: `2209` (KABUPATEN BADUNG)
* **Kode Sekolah TKA**: `U22090017`
