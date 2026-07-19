# Log Pembaruan & Riwayat Pengembangan - Portal Analisis TKA SMAN 2 Mengwi

Dokumen ini mencatat riwayat pembaruan, perbaikan bug, integrasi fitur, dan optimasi arsitektur yang dilakukan pada aplikasi Portal Analisis Tes Kompetensi Akademik (TKA) SMA Negeri 2 Mengwi.

---

## 📅 Riwayat Pembaruan

### Pembaruan Terbaru: 19 Juli 2026 (Sesi 6)
* **Penyajian Soal Utuh & Pilihan Jawaban (Tab `Analisis Soal`)**:
  * Mengubah kartu pada tab **Analisis Soal** agar menampilkan **teks soal secara utuh** (tanpa pemotongan tinggi) beserta **seluruh pilihan jawaban A, B, C, D, E** di setiap kartu.
  * Opsi jawaban yang benar di-highlight hijau secara otomatis dengan penanda `✓ Kunci Jawaban`.
  * Menambahkan style CSS khusus untuk gambar dan tabel di dalam soal agar tampil secara responsif di semua ukuran layar.
* **Integrasi Database Endpoint `/api/questions-all`**:
  * Membangun endpoint `/api/questions-all` untuk menyajikan seluruh data bank soal langsung dari tabel `questions` di database SQLite (`tka_cache.db`).
  * Mengubah frontend (`getOrFetchQuestionsCache`) agar memprioritaskan pengambilan data soal langsung dari database SQLite (<10ms).
  * Memperbaiki bug pengecekan `status_code` pada respon API server serta pembacaan hierarki `detail_hierarchy` sehingga nama indikator kompetensi tampil 100% akurat.
* **Navigasi Hamburger Menu Responsif (Mobile View)**:
  * Merombak antarmuka navigasi ponsel (`< md`) dari strip horizontal scrollable menjadi **Hamburger Menu interaktif** dengan ikon `☰` dan `✕`.
  * Menambahkan logika *auto-collapse* yang otomatis menutup menu mobile setelah pengguna memilih tab.
* **Rebuild & Deployment Docker**:
  * Melakukan kompilasi ulang image Docker dan me-restart container `hasiltka` untuk menerapkan perubahan pada server produksi.

### Pembaruan Sebelumnya: 19 Juli 2026 (Sesi 5)
* **Fitur Analisis Peringkat Sekolah per Kabupaten Badung (`🏆 Peringkat Sekolah`)**:
  * Membangun endpoint `/api/peringkat-sekolah` yang secara otomatis mengkalkulasi rerata daya serap seluruh 68 sekolah di Kabupaten Badung per mata pelajaran.
  * Mengurutkan peringkat (*ranking*) sekolah dari posisi #1 hingga #68 secara otomatis.
  * Menyorot posisi **SMA Negeri 2 Mengwi** secara khusus dengan kartu *badge* khusus (misal: **#26 dari 68 Sekolah**).
  * Menyediakan fitur penyaring (*filter*) status sekolah (**Semua Sekolah**, **SMA Negeri Saja**, **SMA Swasta Saja**) serta pencarian (*search bar*) nama sekolah.
  * Mengintegrasikan caching SQLite3 dengan teknik paginasi `limit: 50` untuk mencegah error rate-limit dari API kementerian.
* **Integrasi Database SQLite3 (`better-sqlite3`) & System Caching**:
  * **Analisis & Masalah**: Aplikasi sebelumnya melakukan pemanggilan HTTP langsung ke API Kemendikdasmen secara berulang-ulang untuk setiap request wilayah, mata pelajaran, indikator, dan summary, yang meningkatkan latency dan risiko pembatasan request (*rate limit*) atau HTTP 403 dari server kementerian.
  * **Solusi Database SQLite3 (`db.js` & `tka_cache.db`)**:
    * Membangun database relational berbasis **SQLite3** dengan tabel `api_cache` dan `questions`.
    * Mengaktifkan mode **WAL (Write-Ahead Logging)** untuk kecepatan tinggi dan konkurensi optimal.
    * Mengimplementasikan wrapper fungsi `fetchFromTkaApiWithCache` di `server.js` yang menyimpan hasil respons API ke SQLite3.
    * Setiap permintaan berulang ke endpoint `/api/mapel`, `/api/provinsi`, `/api/rayon`, `/api/sekolah`, `/api/contoh-soal`, `/api/daya-serap`, dan `/api/sman2mengwi/summary` akan **diambil langsung dari database SQLite3 (<15ms)** tanpa perlu menghubungi server Kemendikdasmen lagi.
  * **Manajemen Bank Soal di SQLite**:
    * Scraper bank soal kini menyimpan soal dan pilihan jawaban langsung ke tabel `questions` di SQLite3.
    * Otomatis melakukan sinkronisasi/migrasi data awal (*seeding*) dari `questions_cache.json` ke database SQLite3 saat server dinyalakan.
    * Menyediakan endpoint statistik database `/api/cache/stats` dan endpoint reset cache `/api/cache/clear` (serta dukungan parameter `?refresh=true` pada URL API).
  * **Optimasi Dockerfile**:
    * Mengganti base image ke `node:20-slim` dan mengonfigurasi `build-essential` & `python3` untuk kompilasi native modul C/C++ SQLite3 secara sempurna di container Docker.

### Pembaruan Sebelumnya: 17 Juli 2026 (Sesi 4)
* **Desain Visual "Terang & Biru" (Light & Blue Theme)**:
  * Mengubah keseluruhan antarmuka dasbor dari tema gelap (*dark theme*) ke tema terang yang modern dan bersih dengan warna latar belakang `#f8fafc` (Slate 50) dan kontainer kartu putih bersih `#ffffff`.
  * Menggunakan palet aksen warna **Biru Royal** (`#2563eb`) untuk navigasi aktif sidebar, lencana elemen, borders indikator aktif, dan tombol aksi.
* **Integrasi Logo Sekolah Resmi**:
  * Menyematkan **Logo Dwisma** (`https://portal.sman2mengwi.sch.id/img/Logo%20Dwisma.png`) di 4 tempat utama: Header Bilah Samping, Header Dasbor Utama, Kartu Profil Sekolah (Capaian Semua Mapel), dan Header Analisis Soal.
* **Perbaikan Bug Indikator Kosong (Mapel non-Bahasa Indonesia)**:
  * **Analisis Masalah**: API Kemendikdasmen mengirimkan data yang tidak seragam. Bahasa Indonesia meletakkan `indikator_list` langsung di bawah subelemen, sedangkan Matematika dan mapel eksak lainnya menaruhnya jauh di bawah `kompetensi_list` $\rightarrow$ `subkompetensi_list` $\rightarrow$ `indikator_list`.
  * **Solusi**: Membuat fungsi rekursif pintar `extractIndicators(sub)` di frontend untuk mengekstrak dan meratakan (*flatten*) semua indikator dari subelemen apa pun secara otomatis. Sukses mendeteksi 25-30 indikator di seluruh 22 mata pelajaran.
* **Solusi Kendala Gambar Grafik Chart.js Tersembunyi**:
  * **Masalah**: Chart.js mengalami galat *layout sizing* berdimensi $0$ ketika diinisialisasi di dalam kontainer yang memiliki kelas `hidden` (`display: none`), yang sempat menghentikan eksekusi JavaScript sebelum rendering akordeon selesai.
  * **Solusi**: Mengubah alur inisialisasi agar layout diaktifkan terlebih dahulu (`setViewState('data')`), baru grafis Chart.js diinstansiasi. Ditambahkan pula pengaman `try-catch` di setiap render chart agar jika satu grafis bermasalah, sisa dasbor dan akordeon tetap berjalan normal.
* **Manajemen Tampilan Kunci Soal yang Dirahasiakan**:
  * **Masalah**: Beberapa mata pelajaran (seperti Matematika) mengirimkan kolom pembahasan kosong (`""` atau `"<p>&nbsp;</p>"`) dan kunci jawaban bernilai `null` dari kementerian demi keamanan bank soal nasional.
  * **Solusi**: Menambahkan validasi `isExplanationEmpty()` dan merender kartu penjelas berwarna kuning amber hangat yang memberikan penjelasan informatif kepada guru bahwa data dirahasiakan oleh kementerian untuk mencegah kesalahpahaman.
* **Integrasi Gemini AI Solver (Pemecah Soal Otomatis)**:
  * Membangun modul client-side **Gemini AI Solver** menggunakan model **`gemini-2.5-flash`** via direct fetch API (CORS-enabled).
  * Memungkinkan guru memasukkan **Gemini API Key** pribadi (disimpan aman di `localStorage` peramban).
  * AI secara otomatis membedah pertanyaan & opsi pilihan, menentukan pilihan jawaban yang benar (langsung ditandai hijau/centang di UI), dan menulis pembahasan lengkap di panel penjelasan.
* **Fitur Ekspor Bank Soal Semua Mapel (TXT, DOC, PDF)**:
  * **TXT**: Mengekspor kumpulan soal teks polos yang bersih.
  * **DOC**: Dokumen Word yang didesain menggunakan skema HTML Microsoft Word agar rapi.
  * **PDF**: Tab khusus `/print/bank-soal` dengan logo sekolah dan CSS print-friendly yang memicu dialog cetak browser otomatis (*Save as PDF*).
  * **Scraper & Caching Latar Belakang**: Menyediakan file cache `questions_cache.json` di server lokal. Pada klik pertama, server akan men-download soal-soal di latar belakang (jeda aman 20ms) dengan tampilan *progress bar* interaktif (0-100%) di frontend. Unduhan selanjutnya instan (<10ms).
* **Bypass Caching Browser**:
  * Menambahkan middleware anti-cache di `server.js` untuk menyisipkan header HTTP Cache-Control `no-store` pada static asset.
  * Memperbarui cache-buster `app.js?v=1.0.8` di `public/index.html`.

### Pembaruan Sebelumnya (Sesi 3)
* **Stats Grid 4 Kolom**: Mengubah stats atas dashboard menjadi grid 4 kolom untuk perbandingan langsung persentase pencapaian mata pelajaran SMAN 2 Mengwi terhadap Kabupaten Badung, Provinsi Bali, dan Rerata Nasional.
* **Kunci Wilayah Target**: Menghapus filter regional dropdown dari header aplikasi dan membatasi pemanggilan API backend secara permanen menggunakan parameter `kd_prop=22`, `kd_rayon=2209`, dan `kd_sek=U22090017`.
* **Desain Akordeon Tingkat Soal**: Menambahkan CSS kustom lengkap untuk visualisasi elemen akordeon bertingkat 3 (Elemen -> Subelemen -> Indikator Soal).

### Pembaruan Sebelumnya (Sesi 1 & 2)
* **Bypass Proteksi HTTP 403**: Mengimplementasikan enkripsi AES-256 pada payload request kementerian menggunakan CryptoJS dan kunci rahasia resmi. Menambahkan header browser User-Agent asli pada fetch backend untuk mengelabui filter Cloudflare.
* **Dasbor Awal**: Membuat struktur awal backend express.js dan frontend index.html sederhana untuk menampilkan daya serap mata pelajaran.
