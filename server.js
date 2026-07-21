const express = require('express');
const CryptoJS = require('crypto-js');
const path = require('path');
const fs = require('fs');

const {
    getApiCache,
    setApiCache,
    clearApiCache,
    getQuestion,
    saveQuestion,
    getAllQuestionsGrouped,
    seedQuestionsFromJson,
    getCacheStats
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Seed SQLite database with existing questions_cache.json if available
const jsonCachePath = path.join(__dirname, 'public', 'questions_cache.json');
seedQuestionsFromJson(jsonCachePath);

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

// In-memory cache fallback for fast response
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

// Helper fetch API Kemendikdasmen murni (Tanpa Cache, dengan Auto-Retry & Macintosh UA)
async function fetchFromTkaApi(endpoint, payload = {}, retries = 3) {
    const url = `${BASE_API_URL}${endpoint}`;
    const payloadStr = JSON.stringify(payload);
    const encryptedPayload = encryptData(payloadStr);
    
    const requestBody = {
        encrypted: true,
        data: encryptedPayload
    };

    const headersList = [
        {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Content-Type': 'application/json',
            'Origin': 'https://tka.kemendikdasmen.go.id',
            'Referer': 'https://tka.kemendikdasmen.go.id/hasiltka/'
        },
        {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Referer': 'https://tka.kemendikdasmen.go.id/hasiltka/'
        }
    ];

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const headers = headersList[(attempt - 1) % headersList.length];
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const resJson = await response.json();
                if (resJson.encrypted && resJson.data) {
                    return decryptData(resJson.data);
                }
                return resJson;
            }

            if (response.status === 403 && attempt < retries) {
                console.warn(`[TKA API 403 Warning] Attempt ${attempt}/${retries} for ${endpoint}. Retrying in ${attempt * 350}ms...`);
                await new Promise(r => setTimeout(r, attempt * 350));
                continue;
            }

            throw new Error(`API HTTP Error: ${response.status} ${response.statusText}`);

        } catch (err) {
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, attempt * 350));
        }
    }
}

// Helper fetch API Kemendikdasmen DENGAN SQLite3 Caching
async function fetchFromTkaApiWithCache(endpoint, payload = {}, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = getApiCache(endpoint, payload);
        if (cached) {
            return cached.data;
        }
    }

    try {
        console.log(`[TKA API Request] Background Fetch: ${endpoint}`);
        const resData = await fetchFromTkaApi(endpoint, payload);
        setApiCache(endpoint, payload, resData);
        return resData;
    } catch (err) {
        console.warn(`[TKA API Fetch Warning] Endpoint ${endpoint}:`, err.message);
        // Fallback to SQLite cache if remote API returned error (e.g., 403 or rate limit)
        const fallback = getApiCache(endpoint, payload);
        if (fallback) {
            console.log(`[SQLite Fallback HIT] Serving cached data for ${endpoint}`);
            return fallback.data;
        }
        return { success: false, message: err.message, data: null };
    }
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

// 1. Get List Mapel (With SQLite Cache)
app.get('/api/mapel', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const data = await fetchFromTkaApiWithCache('listmapel', { even_tka: "smasmk", jenjang: "SMA" }, forceRefresh);
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Static fallback data for regional metadata in case remote API is restricted (HTTP 403)
const INDONESIA_PROVINSI_FALLBACK = [
    { kd_prop: "22", prop: "BALI" },
    { kd_prop: "01", prop: "DKI JAKARTA" },
    { kd_prop: "02", prop: "JAWA BARAT" },
    { kd_prop: "03", prop: "JAWA TENGAH" },
    { kd_prop: "04", prop: "D.I. YOGYAKARTA" },
    { kd_prop: "05", prop: "JAWA TIMUR" },
    { kd_prop: "06", prop: "ACEH" },
    { kd_prop: "07", prop: "SUMATERA UTARA" },
    { kd_prop: "08", prop: "SUMATERA BARAT" },
    { kd_prop: "09", prop: "RIAU" },
    { kd_prop: "10", prop: "JAMBI" },
    { kd_prop: "11", prop: "SUMATERA SELATAN" },
    { kd_prop: "12", prop: "LAMPUNG" },
    { kd_prop: "13", prop: "KALIMANTAN BARAT" },
    { kd_prop: "14", prop: "KALIMANTAN TENGAH" },
    { kd_prop: "15", prop: "KALIMANTAN SELATAN" },
    { kd_prop: "16", prop: "KALIMANTAN TIMUR" },
    { kd_prop: "17", prop: "SULAWESI UTARA" },
    { kd_prop: "18", prop: "SULAWESI TENGAH" },
    { kd_prop: "19", prop: "SULAWESI SELATAN" },
    { kd_prop: "20", prop: "SULAWESI TENGGARA" },
    { kd_prop: "21", prop: "NUSA TENGGARA BARAT" },
    { kd_prop: "23", prop: "NUSA TENGGARA TIMUR" },
    { kd_prop: "24", prop: "MALUKU" },
    { kd_prop: "25", prop: "PAPUA" }
];

const BALI_RAYON_FALLBACK = [
    { kd_rayon: "2209", rayon: "KABUPATEN BADUNG" },
    { kd_rayon: "2201", rayon: "KABUPATEN BULELENG" },
    { kd_rayon: "2202", rayon: "KABUPATEN JEMBRANA" },
    { kd_rayon: "2203", rayon: "KABUPATEN TABANAN" },
    { kd_rayon: "2204", rayon: "KABUPATEN GIANYAR" },
    { kd_rayon: "2205", rayon: "KABUPATEN KLUNGKUNG" },
    { kd_rayon: "2206", rayon: "KABUPATEN BANGLI" },
    { kd_rayon: "2207", rayon: "KABUPATEN KARANGASEM" },
    { kd_rayon: "2208", rayon: "KOTA DENPASAR" }
];

const BADUNG_SEKOLAH_FALLBACK = [
    { kd_sek: "U22090017", nama_sek: "SMA NEGERI 2 MENGWI" },
    { kd_sek: "U22090001", nama_sek: "SMA NEGERI 1 MENGWI" },
    { kd_sek: "U22090002", nama_sek: "SMA NEGERI 1 KUTA" },
    { kd_sek: "U22090003", nama_sek: "SMA NEGERI 2 KUTA" },
    { kd_sek: "U22090004", nama_sek: "SMA NEGERI 1 KUTA UTARA" },
    { kd_sek: "U22090005", nama_sek: "SMA NEGERI 2 KUTA UTARA" },
    { kd_sek: "U22090006", nama_sek: "SMA NEGERI 1 KUTA SELATAN" },
    { kd_sek: "U22090007", nama_sek: "SMA NEGERI 2 KUTA SELATAN" },
    { kd_sek: "U22090008", nama_sek: "SMA NEGERI 1 ABIANSEMAL" },
    { kd_sek: "U22090009", nama_sek: "SMA NEGERI 2 ABIANSEMAL" },
    { kd_sek: "U22090010", nama_sek: "SMA NEGERI 1 PETANG" }
];

// 2. Get List Provinsi (With SQLite Cache & Fallback)
app.get('/api/provinsi', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        let data = await fetchFromTkaApiWithCache('listprovinsi', {}, forceRefresh);
        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            data = { success: true, data: INDONESIA_PROVINSI_FALLBACK };
        }
        res.json(data);
    } catch (error) {
        res.json({ success: true, data: INDONESIA_PROVINSI_FALLBACK });
    }
});

// 3. Get List Rayon/Kabupaten berdasarkan Kode Provinsi (With SQLite Cache & Fallback)
app.get('/api/rayon', async (req, res) => {
    const { kd_prop, refresh } = req.query;
    if (!kd_prop) return res.status(400).json({ success: false, message: "kd_prop is required" });
    try {
        const forceRefresh = refresh === 'true';
        let data = await fetchFromTkaApiWithCache('listrayon', { kd_prop }, forceRefresh);
        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            data = { success: true, data: (kd_prop === '22' ? BALI_RAYON_FALLBACK : [{ kd_rayon: '2209', rayon: 'KABUPATEN BADUNG' }]) };
        }
        res.json(data);
    } catch (error) {
        res.json({ success: true, data: (kd_prop === '22' ? BALI_RAYON_FALLBACK : [{ kd_rayon: '2209', rayon: 'KABUPATEN BADUNG' }]) });
    }
});

// 4. Get List Sekolah berdasarkan Kode Rayon (With SQLite Cache & Fallback)
app.get('/api/sekolah', async (req, res) => {
    const { kd_rayon, refresh } = req.query;
    if (!kd_rayon) return res.status(400).json({ success: false, message: "kd_rayon is required" });
    try {
        const forceRefresh = refresh === 'true';
        let data = await fetchFromTkaApiWithCache('listsekolah', {
            kd_rayon,
            jenjang: "SMA",
            jenis_sek: "",
            status_sek: ""
        }, forceRefresh);
        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            data = { success: true, data: (kd_rayon === '2209' ? BADUNG_SEKOLAH_FALLBACK : [{ kd_sek: 'U22090017', nama_sek: 'SMA NEGERI 2 MENGWI' }]) };
        }
        res.json(data);
    } catch (error) {
        res.json({ success: true, data: (kd_rayon === '2209' ? BADUNG_SEKOLAH_FALLBACK : [{ kd_sek: 'U22090017', nama_sek: 'SMA NEGERI 2 MENGWI' }]) });
    }
});

// 5. Get Contoh Soal berdasarkan Kode Mapel dan Urutan (With SQLite Cache)
app.get('/api/contoh-soal', async (req, res) => {
    const { kd_mapel, urutan, refresh } = req.query;
    if (!kd_mapel || !urutan) {
        return res.status(400).json({ success: false, message: "kd_mapel and urutan are required" });
    }
    try {
        const uNum = parseInt(urutan);
        // 1. Check questions table in SQLite first
        const qRow = getQuestion(kd_mapel, uNum);
        if (qRow && qRow.pertanyaan) {
            let pilihan = [];
            try { pilihan = JSON.parse(qRow.pilihan || '[]'); } catch(e) {}
            return res.json({
                success: true,
                message: "Success",
                data: {
                    contoh_soal: [{
                        urutan: uNum,
                        pertanyaan: qRow.pertanyaan,
                        pilihan: pilihan,
                        pembahasan: qRow.pembahasan || ""
                    }]
                }
            });
        }

        // 2. Fallback to api_cache with limit 3 / limit 1
        const forceRefresh = refresh === 'true';
        let data = await fetchFromTkaApiWithCache('daya-serap/contoh-soal/urutan', {
            kd_mapel,
            urutan: uNum,
            limit: 3
        }, forceRefresh);

        if (!data || !data.data || !data.data.contoh_soal) {
            data = await fetchFromTkaApiWithCache('daya-serap/contoh-soal/urutan', {
                kd_mapel,
                urutan: uNum,
                limit: 1
            }, forceRefresh);
        }

        res.json(data || { success: true, data: { contoh_soal: [] } });
    } catch (error) {
        console.error('contoh-soal error:', error.message);
        res.json({ success: true, message: "OK", data: { contoh_soal: [] } });
    }
});

// 5.5. Get All Questions directly from SQLite Database
app.get('/api/questions-all', (req, res) => {
    try {
        const groupedQuestions = getAllQuestionsGrouped();
        res.json(groupedQuestions);
    } catch (error) {
        console.error('questions-all error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// 6. Get Daya Serap + Perbandingan (Nasional vs Provinsi vs Kabupaten vs Sekolah) (With SQLite Cache)
app.get('/api/daya-serap', async (req, res) => {
    const { kd_mapel, kd_prop, kd_rayon, kd_sek, refresh } = req.query;
    if (!kd_mapel) {
        return res.status(400).json({ success: false, message: "kd_mapel is required" });
    }

    try {
        const forceRefresh = refresh === 'true';
        const comparison = {};

        // 1. Ambil data Nasional (selalu diperlukan)
        const nasRes = await fetchFromTkaApiWithCache('daya-serap/nasional', {
            kd_mapel,
            kd_jenjang: "T",
            jenis_sekolah: "T",
            status_sekolah: "T"
        }, forceRefresh);
        
        const nasData = nasRes.data || {};
        comparison.nasional = {
            avg: calculateAverage(nasData.elemen_summary),
            urutan: extractUrutanScores(nasData.raw_data)
        };

        let activeData = nasRes;

        // 2. Ambil data Provinsi (jika dipilih)
        if (kd_prop && kd_prop !== 'T') {
            const provRes = await fetchFromTkaApiWithCache('daya-serap/provinsi', {
                kd_mapel,
                kd_jenjang: "T",
                jenis_sekolah: "T",
                status_sekolah: "T",
                kd_prop
            }, forceRefresh);
            const provData = provRes.data || {};
            comparison.provinsi = {
                avg: calculateAverage(provData.elemen_summary),
                urutan: extractUrutanScores(provData.raw_data)
            };
            activeData = provRes;
        }

        // 3. Ambil data Kabupaten/Rayon (jika dipilih)
        if (kd_rayon && kd_rayon !== 'T') {
            const kabRes = await fetchFromTkaApiWithCache('daya-serap/kabupaten', {
                kd_mapel,
                kd_jenjang: "T",
                jenis_sekolah: "T",
                status_sekolah: "T",
                kd_prop,
                kd_rayon
            }, forceRefresh);
            const kabData = kabRes.data || {};
            comparison.kabupaten = {
                avg: calculateAverage(kabData.elemen_summary),
                urutan: extractUrutanScores(kabData.raw_data)
            };
            activeData = kabRes;
        }

        // 4. Ambil data Sekolah (jika dipilih)
        if (kd_sek && kd_sek !== 'T') {
            // Check cache for limit 10, limit 50, or no limit
            const keyBase = { kd_mapel, kd_jenjang: "T", jenis_sekolah: "T", status_sekolah: "T", kd_prop, kd_rayon, kd_sek };
            let sekRes = getApiCache('daya-serap/sekolah', { ...keyBase, limit: 10, offset: 0 })
                      || getApiCache('daya-serap/sekolah', { ...keyBase, limit: 50, offset: 0 })
                      || getApiCache('daya-serap/sekolah', keyBase);

            if (sekRes) {
                sekRes = sekRes.data;
            } else if (!forceRefresh) {
                sekRes = await fetchFromTkaApiWithCache('daya-serap/sekolah', { ...keyBase, limit: 10, offset: 0 }, forceRefresh);
            } else {
                sekRes = await fetchFromTkaApiWithCache('daya-serap/sekolah', { ...keyBase, limit: 50, offset: 0 }, forceRefresh);
            }

            const sekData = (sekRes && sekRes.data) ? sekRes.data : (sekRes || {});
            comparison.sekolah = {
                avg: calculateAverage(sekData.elemen_summary),
                urutan: extractUrutanScores(sekData.raw_data)
            };
            activeData = sekRes;
        }

        if (activeData && activeData.data) {
            // Cloned object so we don't mutate underlying cached object directly
            activeData = JSON.parse(JSON.stringify(activeData));
            activeData.data.comparison = comparison;
        }

        res.json(activeData);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6b. Get Peringkat Sekolah per Kabupaten/Rayon
app.get('/api/peringkat-sekolah', async (req, res) => {
    let { kd_mapel, kd_prop, kd_rayon, kd_sek, refresh } = req.query;
    if (!kd_mapel || kd_mapel === 'undefined' || kd_mapel === 'null' || kd_mapel.trim() === '') kd_mapel = 'ABINW';
    if (!kd_prop || kd_prop === 'undefined' || kd_prop === 'null' || kd_prop.trim() === '') kd_prop = '22';
    if (!kd_rayon || kd_rayon === 'undefined' || kd_rayon === 'null' || kd_rayon.trim() === '') kd_rayon = '2209';
    if (!kd_sek || kd_sek === 'undefined' || kd_sek === 'null' || kd_sek.trim() === '') kd_sek = 'U22090017';
    const forceRefresh = refresh === 'true';

    try {
        // Fetch page 1 (limit 50, offset 0) with multi-key cache fallback
        const keyPage1 = { kd_mapel, kd_jenjang: "T", jenis_sekolah: "T", status_sekolah: "T", kd_prop, kd_rayon, limit: 50, offset: 0 };
        let sekRes1 = getApiCache('daya-serap/sekolah', keyPage1)
                   || getApiCache('daya-serap/sekolah', { ...keyPage1, limit: "50", offset: "0" });

        if (sekRes1) {
            sekRes1 = sekRes1.data;
        } else {
            sekRes1 = await fetchFromTkaApiWithCache('daya-serap/sekolah', keyPage1, forceRefresh);
        }

        let rawList = (sekRes1 && sekRes1.data && sekRes1.data.raw_data) ? [...sekRes1.data.raw_data] : [];
        const total = (sekRes1 && sekRes1.data && sekRes1.data.total_sekolah) ? sekRes1.data.total_sekolah : rawList.length;

        // If total > 50 or page 1 reached limit, fetch page 2 (offset 50)
        if (total > 50 || rawList.length === 50) {
            try {
                const keyPage2 = { kd_mapel, kd_jenjang: "T", jenis_sekolah: "T", status_sekolah: "T", kd_prop, kd_rayon, limit: 50, offset: 50 };
                let sekRes2 = getApiCache('daya-serap/sekolah', keyPage2)
                           || getApiCache('daya-serap/sekolah', { ...keyPage2, limit: "50", offset: "50" });

                if (sekRes2) {
                    sekRes2 = sekRes2.data;
                } else {
                    sekRes2 = await fetchFromTkaApiWithCache('daya-serap/sekolah', keyPage2, forceRefresh);
                }

                if (sekRes2 && sekRes2.data && sekRes2.data.raw_data) {
                    rawList = rawList.concat(sekRes2.data.raw_data);
                }
            } catch (e2) {
                console.warn('Page 2 fetch warning:', e2.message);
            }
        }

        const namaRayon = (sekRes1.data && sekRes1.data.wilayah && sekRes1.data.wilayah.nama_rayon)
            ? sekRes1.data.wilayah.nama_rayon.trim()
            : 'Kabupaten Badung';

        const schoolRankings = rawList.map(item => {
            let sum = 0, count = 0;
            for (let i = 1; i <= 30; i++) {
                const val = item[`persen_urutan_${i}`];
                if (val !== null && val !== undefined) {
                    sum += parseFloat(val);
                    count++;
                }
            }
            const avg = count > 0 ? sum / count : 0;
            return {
                npsn: item.npsn || '',
                name: (item.nm_sek || '').trim(),
                kd_sek_full: item.kd_sek_full || '',
                sts_sek: item.sts_sek || '', // 'N' = Negeri, 'S' = Swasta
                jns_sek: item.jns_sek || '',
                jenjang: item.jenjang || 'SMA',
                avg: parseFloat(avg.toFixed(2)),
                questionsCount: count,
                isTarget: (item.kd_sek_full || '').endsWith(kd_sek)
            };
        });

        // Sort schools by average score descending
        schoolRankings.sort((a, b) => b.avg - a.avg);

        // Assign rank numbers
        let targetSchool = null;
        schoolRankings.forEach((s, idx) => {
            s.rank = idx + 1;
            if (s.isTarget) {
                targetSchool = s;
            }
        });

        res.json({
            success: true,
            kd_mapel,
            nama_rayon: namaRayon,
            total_sekolah: schoolRankings.length,
            target_school: targetSchool,
            rankings: schoolRankings
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. Get SMAN 2 Mengwi All Subjects Summary (dengan SQLite & In-Memory Caching)
app.get('/api/sman2mengwi/summary', async (req, res) => {
    const forceRefresh = req.query.refresh === 'true';
    const kd_prop = req.query.kd_prop || "22";
    const kd_rayon = req.query.kd_rayon || "2209";
    const kd_sek = req.query.kd_sek || "U22090017";

    const paramsKey = { kd_prop, kd_rayon, kd_sek };

    // 1. SQLite Cache hit
    if (!forceRefresh) {
        const sqliteCached = getApiCache('sman2mengwi/summary', paramsKey);
        if (sqliteCached) {
            console.log(`[SQLite Cache HIT] School Summary loaded for ${kd_sek}`);
            return res.json(sqliteCached.data);
        }
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

        console.log(`Pre-fetching school summary data for ${kd_sek}...`);

        const promises = activeSubjects.map(async (subj) => {
            try {
                // Fetch data sekolah
                const sekRes = await fetchFromTkaApiWithCache('daya-serap/sekolah', {
                    kd_mapel: subj.kd,
                    kd_jenjang: "T",
                    jenis_sekolah: "T",
                    status_sekolah: "T",
                    kd_prop,
                    kd_rayon,
                    kd_sek,
                    limit: 10,
                    offset: 0
                }, forceRefresh);

                // Fetch data kabupaten
                const kabRes = await fetchFromTkaApiWithCache('daya-serap/kabupaten', {
                    kd_mapel: subj.kd,
                    kd_jenjang: "T",
                    jenis_sekolah: "T",
                    status_sekolah: "T",
                    kd_prop,
                    kd_rayon
                }, forceRefresh);

                // Fetch data nasional
                const nasRes = await fetchFromTkaApiWithCache('daya-serap/nasional', {
                    kd_mapel: subj.kd,
                    kd_jenjang: "T",
                    jenis_sekolah: "T",
                    status_sekolah: "T"
                }, forceRefresh);

                const sekAvg = calculateAverage(sekRes.data?.elemen_summary);
                const kabAvg = calculateAverage(kabRes.data?.elemen_summary);
                const nasAvg = calculateAverage(nasRes.data?.elemen_summary);

                // Ambil jumlah peserta dari by_level
                const byLevel = sekRes.data?.by_level || {};
                const pesertaSekolah   = byLevel.sekolah?.total_peserta   || sekRes.data?.total_peserta || 0;
                const pesertaKabupaten = byLevel.kabupaten?.total_peserta || 0;
                const pesertaProvinsi  = byLevel.provinsi?.total_peserta  || 0;
                const pesertaNasional  = byLevel.nasional?.total_peserta  || 0;

                return {
                    kd_mapel: subj.kd,
                    code: subj.code,
                    name: subj.name,
                    sekolah: sekAvg,
                    kabupaten: kabAvg,
                    nasional: nasAvg,
                    peserta: {
                        sekolah: pesertaSekolah,
                        kabupaten: pesertaKabupaten,
                        provinsi: pesertaProvinsi,
                        nasional: pesertaNasional
                    }
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
        
        const responseObj = {
            success: true,
            kd_prop,
            kd_rayon,
            kd_sek,
            data: summary
        };

        // Cache in SQLite
        setApiCache('sman2mengwi/summary', paramsKey, responseObj);

        res.json(responseObj);
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
        console.log("Starting background question scraper with SQLite storage...");
        
        // 1. Get mapel list from Kemendikdasmen API (or SQLite cache)
        const mapelRes = await fetchFromTkaApiWithCache('listmapel', { even_tka: "smasmk", jenjang: "SMA" });
        const mapels = mapelRes.data || [];
        
        const totalTasks = mapels.length * 30; // Max 30 questions per subject
        let completedTasks = 0;

        for (const m of mapels) {
            const kd = m.kd_mapel;
            const subjectName = m.mapel;

            for (let urutan = 1; urutan <= 30; urutan++) {
                try {
                    // Check if already in SQLite DB
                    const alreadyCached = getQuestion(kd, urutan);
                    if (alreadyCached) {
                        completedTasks++;
                        scrapeProgress = Math.round((completedTasks / totalTasks) * 100);
                        continue;
                    }

                    const res = await fetchFromTkaApiWithCache('daya-serap/contoh-soal/urutan', {
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
                        saveQuestion(kd, subjectName, urutan, qObj);
                    }
                } catch (err) {
                    console.error(`Error scraping ${kd} Q${urutan}:`, err.message);
                }
                completedTasks++;
                scrapeProgress = Math.round((completedTasks / totalTasks) * 100);
                
                await new Promise(r => setTimeout(r, 20));
            }
        }

        // Sync SQLite questions to public/questions_cache.json for backward compatibility
        const allQuestionsGrouped = getAllQuestionsGrouped();
        fs.writeFileSync(jsonCachePath, JSON.stringify(allQuestionsGrouped, null, 2), 'utf8');

        console.log("Scraping completed! Questions saved to SQLite DB and JSON cache.");
        isScraping = false;
        scrapeProgress = 100;

    } catch (err) {
        console.error("Error in background scraper:", err);
        isScraping = false;
    }
}

// 8. Check download status / start scraping if not exist
app.get('/api/download/status', (req, res) => {
    const allQuestions = getAllQuestionsGrouped();
    const hasDataInSqlite = Object.keys(allQuestions).length > 0;
    const existsJson = fs.existsSync(jsonCachePath);
    
    if ((hasDataInSqlite || existsJson) && !isScraping) {
        return res.json({ cached: true, progress: 100 });
    }
    
    if (!isScraping) {
        startScraping();
    }
    
    res.json({ cached: false, progress: scrapeProgress });
});

// Helper to get grouped questions (SQLite first, JSON fallback)
function getQuestionsData() {
    let data = getAllQuestionsGrouped();
    if (Object.keys(data).length === 0 && fs.existsSync(jsonCachePath)) {
        try {
            data = JSON.parse(fs.readFileSync(jsonCachePath, 'utf8'));
        } catch (e) {
            data = {};
        }
    }
    return data;
}

// 9. Download TXT format
app.get('/api/download/txt', (req, res) => {
    const data = getQuestionsData();
    if (Object.keys(data).length === 0) {
        return res.status(400).send("Cache belum siap. Silakan tunggu hingga progress 100%.");
    }
    
    let output = "==================================================\n";
    output += "          BANK SOAL & PEMBAHASAN TKA TINGKAT NASIONAL\n";
    output += "                SMA NEGERI 2 MENGWI\n";
    output += "==================================================\n\n";
    
    for (const kd in data) {
        const subj = data[kd];
        output += `MATA PELAJARAN: ${subj.subject_name} (${kd})\n`;
        output += "--------------------------------------------------\n\n";
        
        (subj.questions || []).forEach(q => {
            output += `Soal No. ${q.urutan}\n`;
            const cleanQ = (q.pertanyaan || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            output += `${cleanQ}\n\n`;
            
            output += "Pilihan Jawaban:\n";
            (q.pilihan || []).forEach(ch => {
                const cleanOpt = (ch.text || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                output += `  [ ${ch.key} ] ${cleanOpt}\n`;
            });
            output += "\n";
            
            const cleanExp = (q.pembahasan || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
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
    const data = getQuestionsData();
    if (Object.keys(data).length === 0) {
        return res.status(400).send("Cache belum siap. Silakan tunggu hingga progress 100%.");
    }
    
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
        
        (subj.questions || []).forEach(q => {
            html += `<div class="question-box">`;
            html += `<div class="question-header">Soal No. ${q.urutan}</div>`;
            html += `<div>${q.pertanyaan}</div>`;
            
            html += `<div class="options-list">`;
            (q.pilihan || []).forEach(ch => {
                html += `<div class="option-item"><strong>[ ${ch.key} ]</strong> ${ch.text}</div>`;
            });
            html += `</div>`;
            
            const cleanExp = (q.pembahasan || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
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
    const data = getQuestionsData();
    if (Object.keys(data).length === 0) {
        return res.status(400).send("Cache belum siap. Silakan buka halaman Capaian Semua Mapel dan unduh kembali.");
    }
    
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
        
        (subj.questions || []).forEach(q => {
            html += `<div class="question-box">`;
            html += `<div class="question-header">Soal No. ${q.urutan}</div>`;
            html += `<div>${q.pertanyaan}</div>`;
            
            html += `<div class="options-list">`;
            (q.pilihan || []).forEach(ch => {
                html += `<div class="option-item"><strong>[ ${ch.key} ]</strong> ${ch.text}</div>`;
            });
            html += `</div>`;
            
            const cleanExp = (q.pembahasan || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
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

// 12. Cache Statistics API Endpoint
app.get('/api/cache/stats', (req, res) => {
    const stats = getCacheStats();
    if (!stats) return res.status(500).json({ success: false, message: "Gagal mengambil statistik database" });
    res.json({ success: true, stats });
});

// 13. Clear Cache API Endpoint
app.all('/api/cache/clear', (req, res) => {
    sman2MengwiCache = null;
    const cleared = clearApiCache();
    if (cleared) {
        res.json({ success: true, message: "Cache API SQLite3 berhasil dibersihkan!" });
    } else {
        res.status(500).json({ success: false, message: "Gagal membersihkan cache API SQLite3." });
    }
});

// 13.5. Trigger Database Seeding / Sync API Endpoint
app.all('/api/cache/seed', (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('node seed_all.js', (err, stdout, stderr) => {
            if (err) console.error('[Seed Error]:', err.message);
            else console.log('[Seed Complete]: Database updated');
        });
        res.json({ success: true, message: "Penyerapan data API ke database SQLite3 telah dijalankan di latar belakang!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 14. Periodic Background Sync Worker (Syncs DB quietly every 6 hours)
function startPeriodicSync() {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(async () => {
        console.log('[Background Sync] Starting 6-hour SQLite database refresh...');
        try {
            const mapelRes = await fetchFromTkaApiWithCache('listmapel', { even_tka: "smasmk", jenjang: "SMA" }, true);
            const mapels = mapelRes.data || [];
            for (const m of mapels) {
                const kd_mapel = m.kd_mapel;
                try {
                    await fetchFromTkaApiWithCache('daya-serap/nasional', { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T' }, true);
                    await fetchFromTkaApiWithCache('daya-serap/provinsi', { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop: '22' }, true);
                    await fetchFromTkaApiWithCache('daya-serap/kabupaten', { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop: '22', kd_rayon: '2209' }, true);
                    await fetchFromTkaApiWithCache('daya-serap/sekolah', { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop: '22', kd_rayon: '2209', limit: 50, offset: 0 }, true);
                    await fetchFromTkaApiWithCache('daya-serap/sekolah', { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop: '22', kd_rayon: '2209', limit: 50, offset: 50 }, true);
                } catch(e) {}
                await new Promise(r => setTimeout(r, 500));
            }
            console.log('[Background Sync] Complete!');
        } catch (e) {
            console.warn('[Background Sync] Warning:', e.message);
        }
    }, SIX_HOURS);
}

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`TKA Dashboard Server running on http://localhost:${PORT}`);
    console.log(`SQLite3 Database connected: ${path.join(__dirname, 'tka_cache.db')}`);
    console.log(`=================================================`);
    startPeriodicSync();
});
