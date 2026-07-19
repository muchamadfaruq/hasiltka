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

### 5. Analisis Butir Soal Utuh & Opsi Jawaban (A–E)
Pada tab **Analisis Soal**:
* Menampilkan **teks soal secara utuh** beserta **seluruh pilihan jawaban (A, B, C, D, E)** di setiap kartu soal.
* Kunci jawaban yang benar di-highlight warna hijau secara otomatis dengan penanda `✓ Kunci Jawaban`.
* Dilengkapi grafik 4-level progress bar daya serap (Sekolah vs Kabupaten vs Provinsi vs Nasional) dan fitur ekspor bank soal.

### 6. Navigasi Hamburger Menu Responsif
* Tampilan ponsel (`< md`) menggunakan **Hamburger Menu interaktif** (`☰` / `✕`) untuk kerapian tata letak.
* Menu otomatis menutup (*auto-collapse*) begitu pengguna berpindah tab.

### 7. Ekspor Dokumen Bank Soal & Pembahasan
Memungkinkan sekolah mengunduh seluruh contoh soal dari 22 mata pelajaran sekaligus:
* **Format TXT**: Dokumen teks polos (*plain text*) yang bersih dan ringkas.
* **Format DOC**: Dokumen Word yang didesain menggunakan HTML MSWord khusus agar rapi saat dibuka di Microsoft Word atau Google Docs.
* **Format PDF**: Reruntutan cetak beresolusi tinggi dengan logo sekolah resmi dan tata letak print-friendly (*auto-print print dialog*).

---

## 🛠️ Arsitektur & Teknologi Stack

### Database & Caching (SQLite3)
* **SQLite3 & Better-SQLite3**: Menyimpan data bank soal (tabel `questions`, 630 butir soal) dan caching respon API Kemendikdasmen (tabel `api_cache`).
* **Mode WAL (Write-Ahead Logging)**: Menjamin performa baca/tulis tinggi dan latency rendah (<10ms).
* **Endpoint `/api/questions-all`**: Mengalirkan data bank soal langsung dari database SQLite3 ke frontend.

### Backend (Node.js & Express)
* **Express.js**: Menangani API router dan server statis.
* **Crypto-JS**: Digunakan untuk mengenkripsi payload POST request menggunakan algoritma AES dengan kunci rahasia resmi kementerian agar lolos validasi API.
* **Header User-Agent Bypass**: Menggunakan header HTTP browser asli untuk menghindari proteksi Cloudflare (HTTP 403) dari API Kemendikdasmen.
* **Headers Anti-Cache**: Middleware server disiapkan untuk menolak caching static asset browser agar file JS/HTML selalu terupdate otomatis setelah pembaruan kode.

### Frontend (Vanilla JS & Tailwind)
* **HTML5 & Vanilla Javascript (ES6)**: Logika dan manipulasi DOM murni.
* **Tailwind CSS (v3)**: Desain sistem bertema Terang (Light Mode) dengan aksen warna Biru (Royal Blue).
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
├── db.js                       # Konfigurasi & Prepared Statements SQLite3
├── server.js                   # Server Express.js, Scraper, & API Router
├── seed_all.js                 # Skrip Seeding Massal Cache SQLite3
├── tka_cache.db                # Database SQLite3 (Tabel api_cache & questions)
├── Dockerfile                  # Konfigurasi Build Container Node 20-slim
├── docker-compose.yml          # Konfigurasi Container Orchestration
├── package.json                # Dependensi Project (Express, Better-SQLite3, Crypto-JS)
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
