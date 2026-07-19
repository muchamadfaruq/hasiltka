const db = require('./db');

// Import decryption & fetching helpers from db/server context
const crypto = require('crypto');
const TKA_API_URL = 'https://tka.kemendikdasmen.go.id/api';

const KEY_HEX = '1c7db174828ce25173160e1d51a66cb9e9d6d37fa19db56bb931a104f2f01eb0';
const IV_HEX  = '3e9ecff658a8db57a87e59b207a67f08';

function decryptData(encryptedBase64) {
    const key = Buffer.from(KEY_HEX, 'hex');
    const iv  = Buffer.from(IV_HEX, 'hex');
    const cipherText = Buffer.from(encryptedBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(cipherText, null, 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

async function fetchFromTkaApi(endpoint, requestBody = {}, retries = 3) {
    const url = `${TKA_API_URL}/${endpoint}`;
    const headersList = [
        {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://tka.kemendikdasmen.go.id',
            'Referer': 'https://tka.kemendikdasmen.go.id/hasiltka/'
        },
        {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://tka.kemendikdasmen.go.id',
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

async function seed() {
    console.log('Starting full SQLite database pre-cache seeding...');

    // 1. Mapel
    let mapelList = [];
    try {
        const cachedMapel = db.getApiCache('listmapel', { even_tka: 'smasmk', jenjang: 'SMA' });
        if (cachedMapel) {
            mapelList = cachedMapel.data.data || [];
            console.log(`[Cache HIT] listmapel (${mapelList.length} subjects)`);
        } else {
            console.log('[Fetching] listmapel...');
            const mapelRes = await fetchFromTkaApi('listmapel', { even_tka: 'smasmk', jenjang: 'SMA' });
            db.setApiCache('listmapel', { even_tka: 'smasmk', jenjang: 'SMA' }, mapelRes);
            mapelList = mapelRes.data || [];
        }
    } catch(e) {
        console.error('Error fetching mapel list:', e.message);
        return;
    }

    // 1.5. Seed listprovinsi, listrayon (Bali), and listsekolah (Badung)
    try {
        if (!db.getApiCache('listprovinsi', {})) {
            console.log('[Fetching] listprovinsi...');
            const provRes = await fetchFromTkaApi('listprovinsi', {});
            db.setApiCache('listprovinsi', {}, provRes);
            console.log('   ✓ Cached listprovinsi');
        } else {
            console.log('   ✓ Cached listprovinsi (Hit)');
        }

        const keyRayon = { kd_prop: '22' };
        if (!db.getApiCache('listrayon', keyRayon)) {
            console.log('[Fetching] listrayon (Bali)...');
            const rayonRes = await fetchFromTkaApi('listrayon', keyRayon);
            db.setApiCache('listrayon', keyRayon, rayonRes);
            console.log('   ✓ Cached listrayon (Bali)');
        } else {
            console.log('   ✓ Cached listrayon Bali (Hit)');
        }

        const keySek = { kd_rayon: '2209', jenjang: 'SMA', jenis_sek: '', status_sek: '' };
        if (!db.getApiCache('listsekolah', keySek)) {
            console.log('[Fetching] listsekolah (Badung)...');
            const sekRes = await fetchFromTkaApi('listsekolah', keySek);
            db.setApiCache('listsekolah', keySek, sekRes);
            console.log('   ✓ Cached listsekolah (Badung)');
        } else {
            console.log('   ✓ Cached listsekolah Badung (Hit)');
        }
    } catch(e) {
        console.error('Error pre-caching regional metadata:', e.message);
    }

    console.log(`Seeding ${mapelList.length} subjects into SQLite...`);

    const kd_prop = '22';
    const kd_rayon = '2209';
    const kd_sek = 'U22090017';

    for (let i = 0; i < mapelList.length; i++) {
        const m = mapelList[i];
        const kd_mapel = m.kd_mapel;
        console.log(`\n[${i + 1}/${mapelList.length}] Processing Subject: ${m.mapel} (${kd_mapel})`);

        // 1. Nasional
        const keyNas = { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T' };
        if (!db.getApiCache('daya-serap/nasional', keyNas)) {
            try {
                const res = await fetchFromTkaApi('daya-serap/nasional', keyNas);
                db.setApiCache('daya-serap/nasional', keyNas, res);
                console.log('   ✓ Cached nasional');
            } catch(e) { console.error('   ✗ Failed nasional:', e.message); }
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('   ✓ Cached nasional (Hit)');
        }

        // 2. Provinsi
        const keyProv = { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop };
        if (!db.getApiCache('daya-serap/provinsi', keyProv)) {
            try {
                const res = await fetchFromTkaApi('daya-serap/provinsi', keyProv);
                db.setApiCache('daya-serap/provinsi', keyProv, res);
                console.log('   ✓ Cached provinsi');
            } catch(e) { console.error('   ✗ Failed provinsi:', e.message); }
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('   ✓ Cached provinsi (Hit)');
        }

        // 3. Kabupaten
        const keyKab = { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop, kd_rayon };
        if (!db.getApiCache('daya-serap/kabupaten', keyKab)) {
            try {
                const res = await fetchFromTkaApi('daya-serap/kabupaten', keyKab);
                db.setApiCache('daya-serap/kabupaten', keyKab, res);
                console.log('   ✓ Cached kabupaten');
            } catch(e) { console.error('   ✗ Failed kabupaten:', e.message); }
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('   ✓ Cached kabupaten (Hit)');
        }

        // 4. Sekolah SMAN 2 Mengwi (Dashboard)
        const keySek = { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop, kd_rayon, kd_sek, limit: 10, offset: 0 };
        if (!db.getApiCache('daya-serap/sekolah', keySek)) {
            try {
                const res = await fetchFromTkaApi('daya-serap/sekolah', keySek);
                db.setApiCache('daya-serap/sekolah', keySek, res);
                console.log('   ✓ Cached SMAN 2 Mengwi');
            } catch(e) { console.error('   ✗ Failed SMAN 2 Mengwi:', e.message); }
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('   ✓ Cached SMAN 2 Mengwi (Hit)');
        }

        // 5. Sekolah Peringkat Page 1
        const keyRank1 = { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop, kd_rayon, limit: 50, offset: 0 };
        if (!db.getApiCache('daya-serap/sekolah', keyRank1)) {
            try {
                const res = await fetchFromTkaApi('daya-serap/sekolah', keyRank1);
                db.setApiCache('daya-serap/sekolah', keyRank1, res);
                console.log('   ✓ Cached Peringkat Page 1');
            } catch(e) { console.error('   ✗ Failed Peringkat Page 1:', e.message); }
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('   ✓ Cached Peringkat Page 1 (Hit)');
        }

        // 6. Sekolah Peringkat Page 2
        const keyRank2 = { kd_mapel, kd_jenjang: 'T', jenis_sekolah: 'T', status_sekolah: 'T', kd_prop, kd_rayon, limit: 50, offset: 50 };
        if (!db.getApiCache('daya-serap/sekolah', keyRank2)) {
            try {
                const res = await fetchFromTkaApi('daya-serap/sekolah', keyRank2);
                db.setApiCache('daya-serap/sekolah', keyRank2, res);
                console.log('   ✓ Cached Peringkat Page 2');
            } catch(e) { console.error('   ✗ Failed Peringkat Page 2:', e.message); }
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('   ✓ Cached Peringkat Page 2 (Hit)');
        }
    }

    console.log('\n✅ All database pre-cache seeding completed successfully!');
}

seed();
