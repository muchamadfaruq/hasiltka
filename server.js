const express = require('express');
const CryptoJS = require('crypto-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Disable caching to prevent browser from loading stale app.js/index.html
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi API Kemendikdasmen
const BASE_API_URL = 'https://tka.kemendikdasmen.go.id/hasiltka/hasil-api-2026/api/services/apps/';
const SECRET_KEY = 'KJ2HJ3LK45JH23K4JH5234H5234K5JH232K3J5KL';

// Cache untuk SMAN 2 Mengwi summary
let sman2MengwiCache = null;

// Helper Enkripsi
function encryptData(dataStr) {
    try {
        return CryptoJS.AES.encrypt(dataStr, SECRET_KEY).toString();
    } catch (error) {
        console.error("Encryption error:", error);
        throw error;
    }
}

// Helper Dekripsi
function decryptData(ciphertext) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) throw new Error("Decryption failed - empty result");
        return JSON.parse(decrypted);
    } catch (error) {
        console.error("Decryption error:", error);
        throw error;
    }
}

// Helper fetch API Kemendikdasmen
async function fetchFromTkaApi(endpoint, payload = {}) {
    const url = `${BASE_API_URL}${endpoint}`;
    const payloadStr = JSON.stringify(payload);
    const encryptedPayload = encryptData(payloadStr);
    
    const requestBody = {
        encrypted: true,
        data: encryptedPayload
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`API HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson = await response.json();
    if (resJson.encrypted && resJson.data) {
        return decryptData(resJson.data);
    }
    return resJson;
}

// Helper untuk mengekstrak persentase daya serap per nomor/urutan soal
function extractUrutanScores(rawData) {
    const scores = {};
    if (!rawData) return scores;

    const dataObj = Array.isArray(rawData) ? (rawData[0] || {}) : rawData;
    for (let i = 1; i <= 30; i++) {
        const val = dataObj[`persen_urutan_${i}`];
        if (val !== undefined && val !== null) {
            scores[i] = parseFloat(val);
        }
    }
    return scores;
}

// Helper untuk menghitung rata-rata dari elemen_summary
function calculateAverage(elemenSummary) {
    if (!elemenSummary || elemenSummary.length === 0) return 0;
    const sum = elemenSummary.reduce((acc, curr) => acc + (curr.rata_rata_persen || 0), 0);
    return sum / elemenSummary.length;
}

// --- API Router / Endpoints ---

// 1. Get List Mapel
app.get('/api/mapel', async (req, res) => {
    try {
        const data = await fetchFromTkaApi('listmapel', { even_tka: "smasmk", jenjang: "SMA" });
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Get List Provinsi
app.get('/api/provinsi', async (req, res) => {
    try {
        const data = await fetchFromTkaApi('listprovinsi', {});
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. Get List Rayon/Kabupaten berdasarkan Kode Provinsi
app.get('/api/rayon', async (req, res) => {
    const { kd_prop } = req.query;
    if (!kd_prop) return res.status(400).json({ success: false, message: "kd_prop is required" });
    try {
        const data = await fetchFromTkaApi('listrayon', { kd_prop });
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. Get List Sekolah berdasarkan Kode Rayon
app.get('/api/sekolah', async (req, res) => {
    const { kd_rayon } = req.query;
    if (!kd_rayon) return res.status(400).json({ success: false, message: "kd_rayon is required" });
    try {
        const data = await fetchFromTkaApi('listsekolah', {
            kd_rayon,
            jenjang: "SMA",
            jenis_sek: "",
            status_sek: ""
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. Get Contoh Soal berdasarkan Kode Mapel dan Urutan
app.get('/api/contoh-soal', async (req, res) => {
    const { kd_mapel, urutan } = req.query;
    if (!kd_mapel || !urutan) {
        return res.status(400).json({ success: false, message: "kd_mapel and urutan are required" });
    }
    try {
        const data = await fetchFromTkaApi('daya-serap/contoh-soal/urutan', {
            kd_mapel,
            urutan: parseInt(urutan),
            limit: 3
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. Get Daya Serap + Perbandingan (Nasional vs Provinsi vs Kabupaten vs Sekolah)
app.get('/api/daya-serap', async (req, res) => {
    const { kd_mapel, kd_prop, kd_rayon, kd_sek } = req.query;
    if (!kd_mapel) {
        return res.status(400).json({ success: false, message: "kd_mapel is required" });
    }

    try {
        const comparison = {};

        // 1. Ambil data Nasional (selalu diperlukan)
        const nasRes = await fetchFromTkaApi('daya-serap/nasional', {
            kd_mapel,
            kd_jenjang: "T",
            jenis_sekolah: "T",
            status_sekolah: "T"
        });
        
        const nasData = nasRes.data || {};
        comparison.nasional = {
            avg: calculateAverage(nasData.elemen_summary),
            urutan: extractUrutanScores(nasData.raw_data)
        };

        let activeData = nasRes;

        // 2. Ambil data Provinsi (jika dipilih)
        if (kd_prop && kd_prop !== 'T') {
            const provRes = await fetchFromTkaApi('daya-serap/provinsi', {
                kd_mapel,
                kd_jenjang: "T",
                jenis_sekolah: "T",
                status_sekolah: "T",
                kd_prop
            });
            const provData = provRes.data || {};
            comparison.provinsi = {
                avg: calculateAverage(provData.elemen_summary),
                urutan: extractUrutanScores(provData.raw_data)
            };
            activeData = provRes;
        }

        // 3. Ambil data Kabupaten/Rayon (jika dipilih)
        if (kd_rayon && kd_rayon !== 'T') {
            const kabRes = await fetchFromTkaApi('daya-serap/kabupaten', {
                kd_mapel,
                kd_jenjang: "T",
                jenis_sekolah: "T",
                status_sekolah: "T",
                kd_prop,
                kd_rayon
            });
            const kabData = kabRes.data || {};
            comparison.kabupaten = {
                avg: calculateAverage(kabData.elemen_summary),
                urutan: extractUrutanScores(kabData.raw_data)
            };
            activeData = kabRes;
        }

        // 4. Ambil data Sekolah (jika dipilih)
        if (kd_sek && kd_sek !== 'T') {
            const sekRes = await fetchFromTkaApi('daya-serap/sekolah', {
                kd_mapel,
                kd_jenjang: "T",
                jenis_sekolah: "T",
                status_sekolah: "T",
                kd_prop,
                kd_rayon,
                kd_sek,
                limit: 50,
                offset: 0
            });
            const sekData = sekRes.data || {};
            comparison.sekolah = {
                avg: calculateAverage(sekData.elemen_summary),
                urutan: extractUrutanScores(sekData.raw_data)
            };
            activeData = sekRes;
        }

        if (activeData && activeData.data) {
            activeData.data.comparison = comparison;
        }

        res.json(activeData);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. Get SMAN 2 Mengwi All Subjects Summary (dengan Caching)
app.get('/api/sman2mengwi/summary', async (req, res) => {
    if (sman2MengwiCache) {
        return res.json(sman2MengwiCache);
    }

    try {
        const activeSubjects = [
            { kd: "ABINW", name: "Bahasa Indonesia", code: "BIN" },
            { kd: "AMATW", name: "Matematika", code: "MAT" },
            { kd: "ABIGW", name: "Bahasa Inggris", code: "BIG" },
            { kd: "APKNP", name: "PPKn", code: "PKN" },
            { kd: "AMATP", name: "Matematika Lanjut", code: "MATL" },
            { kd: "ABIOP", name: "Biologi", code: "BIO" },
            { kd: "ASOSP", name: "Sosiologi", code: "SOS" },
            { kd: "AEKOP", name: "Ekonomi", code: "EKO" },
            { kd: "AKIMP", name: "Kimia", code: "KIM" },
            { kd: "AFISP", name: "Fisika", code: "FIS" },
            { kd: "AGEOP", name: "Geografi", code: "GEO" },
            { kd: "AJEPP", name: "Bahasa Jepang", code: "JEP" }
        ];

        const kd_prop = "22";
        const kd_rayon = "2209";
        const kd_sek = "U22090017"; // SMAN 2 Mengwi

        console.log("Pre-fetching SMAN 2 Mengwi data for caching...");

        const promises = activeSubjects.map(async (subj) => {
            try {
                // Fetch data sekolah
                const sekRes = await fetchFromTkaApi('daya-serap/sekolah', {
                    kd_mapel: subj.kd,
                    kd_jenjang: "T",
                    jenis_sekolah: "T",
                    status_sekolah: "T",
                    kd_prop,
                    kd_rayon,
                    kd_sek,
                    limit: 10,
                    offset: 0
                });

                // Fetch data kabupaten
                const kabRes = await fetchFromTkaApi('daya-serap/kabupaten', {
                    kd_mapel: subj.kd,
                    kd_jenjang: "T",
                    jenis_sekolah: "T",
                    status_sekolah: "T",
                    kd_prop,
                    kd_rayon
                });

                // Fetch data nasional
                const nasRes = await fetchFromTkaApi('daya-serap/nasional', {
                    kd_mapel: subj.kd,
                    kd_jenjang: "T",
                    jenis_sekolah: "T",
                    status_sekolah: "T"
                });

                const sekAvg = calculateAverage(sekRes.data?.elemen_summary);
                const kabAvg = calculateAverage(kabRes.data?.elemen_summary);
                const nasAvg = calculateAverage(nasRes.data?.elemen_summary);

                return {
                    kd_mapel: subj.kd,
                    code: subj.code,
                    name: subj.name,
                    sekolah: sekAvg,
                    kabupaten: kabAvg,
                    nasional: nasAvg
                };
            } catch (err) {
                console.error(`Error fetching summary for ${subj.name}:`, err);
                return {
                    kd_mapel: subj.kd,
                    code: subj.code,
                    name: subj.name,
                    error: true
                };
            }
        });

        const summary = await Promise.all(promises);
        
        sman2MengwiCache = {
            success: true,
            schoolName: "SMA Negeri 2 Mengwi",
            npsn: "50101684",
            data: summary
        };

        res.json(sman2MengwiCache);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- BACKGROUND SCRAPER & EXPORT BANK SOAL ---
let isScraping = false;
let scrapeProgress = 0;

async function startScraping() {
    if (isScraping) return;
    isScraping = true;
    scrapeProgress = 0;
    
    try {
        console.log("Starting background question scraper...");
        const fs = require('fs');
        const cachePath = path.join(__dirname, 'public', 'questions_cache.json');
        
        // 1. Get mapel list from Kemendikdasmen API
        const mapelRes = await fetchFromTkaApi('listmapel', { even_tka: "smasmk", jenjang: "SMA" });
        const mapels = mapelRes.data || [];
        
        let cachedData = {};
        if (fs.existsSync(cachePath)) {
            try {
                cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            } catch (e) {
                cachedData = {};
            }
        }

        const totalTasks = mapels.length * 30; // Max 30 questions per subject
        let completedTasks = 0;

        for (const m of mapels) {
            const kd = m.kd_mapel;
            if (!cachedData[kd]) {
                cachedData[kd] = {
                    subject_name: m.mapel,
                    questions: []
                };
            }

            const subjectQuestions = [];
            for (let urutan = 1; urutan <= 30; urutan++) {
                try {
                    // Check if already in cache
                    const alreadyCached = cachedData[kd].questions.find(q => q.urutan === urutan);
                    if (alreadyCached) {
                        subjectQuestions.push(alreadyCached);
                        completedTasks++;
                        scrapeProgress = Math.round((completedTasks / totalTasks) * 100);
                        continue;
                    }

                    const res = await fetchFromTkaApi('daya-serap/contoh-soal/urutan', {
                        kd_mapel: kd,
                        urutan: urutan,
                        limit: 1
                    });

                    if (res && res.data && res.data.contoh_soal && res.data.contoh_soal.length > 0) {
                        const q = res.data.contoh_soal[0];
                        const qObj = {
                            urutan: urutan,
                            pertanyaan: q.pertanyaan,
                            pilihan: q.pilihan || [],
                            pembahasan: q.pembahasan || ""
                        };
                        subjectQuestions.push(qObj);
                    }
                } catch (err) {
                    console.error(`Error scraping ${kd} Q${urutan}:`, err.message);
                }
                completedTasks++;
                scrapeProgress = Math.round((completedTasks / totalTasks) * 100);
                
                // Be gentle with the TKA API
                await new Promise(r => setTimeout(r, 20));
            }

            cachedData[kd].questions = subjectQuestions;
            fs.writeFileSync(cachePath, JSON.stringify(cachedData, null, 2), 'utf8');
        }

        console.log("Scraping completed! Cache saved successfully.");
        isScraping = false;
        scrapeProgress = 100;

    } catch (err) {
        console.error("Error in background scraper:", err);
        isScraping = false;
    }
}

// 8. Check download status / start scraping if not exist
app.get('/api/download/status', (req, res) => {
    const fs = require('fs');
    const cachePath = path.join(__dirname, 'public', 'questions_cache.json');
    const exists = fs.existsSync(cachePath);
    
    if (exists && !isScraping) {
        return res.json({ cached: true, progress: 100 });
    }
    
    if (!isScraping) {
        startScraping();
    }
    
    res.json({ cached: false, progress: scrapeProgress });
});

// 9. Download TXT format
app.get('/api/download/txt', (req, res) => {
    const fs = require('fs');
    const cachePath = path.join(__dirname, 'public', 'questions_cache.json');
    if (!fs.existsSync(cachePath)) {
        return res.status(400).send("Cache belum siap. Silakan tunggu hingga progress 100%.");
    }
    
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    let output = "==================================================\n";
    output += "          BANK SOAL & PEMBAHASAN TKA TINGKAT NASIONAL\n";
    output += "                SMA NEGERI 2 MENGWI\n";
    output += "==================================================\n\n";
    
    for (const kd in data) {
        const subj = data[kd];
        output += `MATA PELAJARAN: ${subj.subject_name} (${kd})\n`;
        output += "--------------------------------------------------\n\n";
        
        subj.questions.forEach(q => {
            output += `Soal No. ${q.urutan}\n`;
            const cleanQ = q.pertanyaan.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            output += `${cleanQ}\n\n`;
            
            output += "Pilihan Jawaban:\n";
            q.pilihan.forEach(ch => {
                const cleanOpt = ch.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                output += `  [ ${ch.key} ] ${cleanOpt}\n`;
            });
            output += "\n";
            
            const cleanExp = q.pembahasan.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            output += `Pembahasan:\n${cleanExp || "Kunci & Pembahasan Dirahasiakan"}\n`;
            output += "--------------------------------------------------\n\n";
        });
        output += "\n";
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Bank_Soal_TKA_SMAN2Mengwi.txt"');
    res.send(output);
});

// 10. Download DOC format (HTML format rendered as MSWord)
app.get('/api/download/doc', (req, res) => {
    const fs = require('fs');
    const cachePath = path.join(__dirname, 'public', 'questions_cache.json');
    if (!fs.existsSync(cachePath)) {
        return res.status(400).send("Cache belum siap. Silakan tunggu hingga progress 100%.");
    }
    
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Bank Soal TKA SMAN 2 Mengwi</title>
<style>
body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; }
h1 { text-align: center; color: #1e3a8a; }
h2 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-top: 40px; }
.question-box { margin-bottom: 30px; page-break-inside: avoid; }
.question-header { font-weight: bold; color: #475569; margin-bottom: 10px; }
.options-list { margin-left: 20px; margin-bottom: 15px; }
.option-item { margin-bottom: 5px; }
.explanation-box { background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 10px 15px; font-size: 13px; color: #334155; }
.hidden-key { background-color: #fef3c7; border-left: 4px solid #d97706; padding: 10px 15px; font-size: 13px; color: #92400e; }
</style>
</head>
<body>
<h1>BANK SOAL & PEMBAHASAN TKA NASIONAL</h1>
<h3 style="text-align: center;">SMA NEGERI 2 MENGWI</h3>
<hr>
`;

    for (const kd in data) {
        const subj = data[kd];
        html += `<h2>MATA PELAJARAN: ${subj.subject_name} (${kd})</h2>`;
        
        subj.questions.forEach(q => {
            html += `<div class="question-box">`;
            html += `<div class="question-header">Soal No. ${q.urutan}</div>`;
            html += `<div>${q.pertanyaan}</div>`;
            
            html += `<div class="options-list">`;
            q.pilihan.forEach(ch => {
                html += `<div class="option-item"><strong>[ ${ch.key} ]</strong> ${ch.text}</div>`;
            });
            html += `</div>`;
            
            const cleanExp = q.pembahasan.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
            if (cleanExp !== "") {
                html += `<div class="explanation-box"><strong>Pembahasan:</strong><br>${q.pembahasan}</div>`;
            } else {
                html += `<div class="hidden-key"><strong>Kunci & Pembahasan Dirahasiakan:</strong><br>Pusat Asesmen Pendidikan Kementerian Pendidikan Dasar dan Menengah merahasiakan kunci jawaban guna menjaga kerahasiaan bank soal TKA Nasional.</div>`;
            }
            html += `</div>`;
        });
    }
    
    html += `</body></html>`;
    
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', 'attachment; filename="Bank_Soal_TKA_SMAN2Mengwi.doc"');
    res.send(html);
});

// 11. Print View for PDF export
app.get('/print/bank-soal', (req, res) => {
    const fs = require('fs');
    const cachePath = path.join(__dirname, 'public', 'questions_cache.json');
    if (!fs.existsSync(cachePath)) {
        return res.status(400).send("Cache belum siap. Silakan buka halaman Capaian Semua Mapel dan unduh kembali.");
    }
    
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Bank Soal TKA SMAN 2 Mengwi</title>
<style>
@media print {
  body { font-size: 11pt; }
  .page-break { page-break-before: always; }
}
body { font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b; padding: 20px; max-width: 900px; margin: 0 auto; }
.header-box { text-align: center; margin-bottom: 30px; border-bottom: 3px double #334155; padding-bottom: 20px; }
.school-logo { width: 80px; height: 80px; margin-bottom: 10px; }
h1 { font-size: 22px; color: #0f172a; margin: 0; }
h2 { font-size: 14px; color: #475569; margin: 5px 0 0 0; }
.subj-title { font-size: 16px; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 5px; margin-top: 40px; page-break-after: avoid; }
.question-box { margin-bottom: 30px; page-break-inside: avoid; }
.question-header { font-weight: bold; color: #0f172a; margin-bottom: 10px; font-size: 13px; }
.options-list { margin-left: 20px; margin-bottom: 15px; }
.option-item { margin-bottom: 5px; font-size: 12px; }
.explanation-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 12px 15px; font-size: 12px; color: #334155; border-radius: 0 8px 8px 0; }
.hidden-key { background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 12px 15px; font-size: 12px; color: #92400e; border-radius: 0 8px 8px 0; }
</style>
</head>
<body>
<div class="header-box">
  <img src="https://portal.sman2mengwi.sch.id/img/Logo%20Dwisma.png" class="school-logo">
  <h1>KUMPULAN SOAL & PEMBAHASAN TKA NASIONAL</h1>
  <h2>SMA NEGERI 2 MENGWI</h2>
  <p style="font-size: 11px; color: #64748b; margin: 5px 0 0 0;">Dokumen ini digenerate secara otomatis oleh Portal Analisis TKA SMAN 2 Mengwi</p>
</div>
`;

    let first = true;
    for (const kd in data) {
        const subj = data[kd];
        if (!first) {
            html += `<div class="page-break"></div>`;
        }
        first = false;
        
        html += `<h2 class="subj-title">MATA PELAJARAN: ${subj.subject_name} (${kd})</h2>`;
        
        subj.questions.forEach(q => {
            html += `<div class="question-box">`;
            html += `<div class="question-header">Soal No. ${q.urutan}</div>`;
            html += `<div>${q.pertanyaan}</div>`;
            
            html += `<div class="options-list">`;
            q.pilihan.forEach(ch => {
                html += `<div class="option-item"><strong>[ ${ch.key} ]</strong> ${ch.text}</div>`;
            });
            html += `</div>`;
            
            const cleanExp = q.pembahasan.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
            if (cleanExp !== "") {
                html += `<div class="explanation-box"><strong>Pembahasan:</strong><br>${q.pembahasan}</div>`;
            } else {
                html += `<div class="hidden-key"><strong>Kunci & Pembahasan Dirahasiakan:</strong><br>Pusat Asesmen Pendidikan Kementerian Pendidikan Dasar dan Menengah merahasiakan kunci jawaban guna menjaga kerahasiaan bank soal ujian TKA Nasional.</div>`;
            }
            html += `</div>`;
        });
    }
    
    html += `
<script>
window.onload = function() {
    setTimeout(function() {
        window.print();
    }, 500);
};
</script>
</body>
</html>`;
    
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`TKA Dashboard Server running on http://localhost:${PORT}`);
    console.log(`=================================================`);
});
