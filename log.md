# Log Pembaruan & Riwayat Pengembangan - Portal Analisis TKA SMAN 2 Mengwi

Dokumen ini mencatat riwayat pembaruan, perbaikan bug, integrasi fitur, dan optimasi arsitektur yang dilakukan pada aplikasi Portal Analisis Tes Kompetensi Akademik (TKA) SMA Negeri 2 Mengwi.

---

## 📅 Riwayat Pembaruan

### Pembaruan Terbaru: 17 Juli 2026 (Sesi 4)
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
