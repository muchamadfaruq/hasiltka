const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'tka_cache.db');
const db = new Database(dbPath);

// Enable WAL mode for optimal read/write concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize Database Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS api_cache (
        endpoint TEXT NOT NULL,
        params_key TEXT NOT NULL,
        response_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (endpoint, params_key)
    );

    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kd_mapel TEXT NOT NULL,
        subject_name TEXT,
        urutan INTEGER NOT NULL,
        pertanyaan TEXT,
        pilihan TEXT,
        pembahasan TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(kd_mapel, urutan)
    );
`);

// Prepared Statements for high performance
const stmtGetApiCache = db.prepare('SELECT response_data, updated_at FROM api_cache WHERE endpoint = ? AND params_key = ?');
const stmtSetApiCache = db.prepare(`
    INSERT INTO api_cache (endpoint, params_key, response_data, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(endpoint, params_key) DO UPDATE SET
        response_data = excluded.response_data,
        updated_at = CURRENT_TIMESTAMP
`);
const stmtClearApiCache = db.prepare('DELETE FROM api_cache');
const stmtClearApiCacheEndpoint = db.prepare('DELETE FROM api_cache WHERE endpoint = ?');

const stmtGetQuestion = db.prepare('SELECT * FROM questions WHERE kd_mapel = ? AND urutan = ?');
const stmtSaveQuestion = db.prepare(`
    INSERT INTO questions (kd_mapel, subject_name, urutan, pertanyaan, pilihan, pembahasan, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(kd_mapel, urutan) DO UPDATE SET
        subject_name = excluded.subject_name,
        pertanyaan = excluded.pertanyaan,
        pilihan = excluded.pilihan,
        pembahasan = excluded.pembahasan,
        updated_at = CURRENT_TIMESTAMP
`);
const stmtGetAllQuestions = db.prepare('SELECT * FROM questions ORDER BY kd_mapel ASC, urutan ASC');
const stmtCountQuestions = db.prepare('SELECT COUNT(*) AS total FROM questions');

/**
 * Retrieve cached API response if available.
 */
function getApiCache(endpoint, payload = {}) {
    try {
        const paramsKey = JSON.stringify(payload);
        const row = stmtGetApiCache.get(endpoint, paramsKey);
        if (row && row.response_data) {
            return {
                data: JSON.parse(row.response_data),
                cachedAt: row.updated_at
            };
        }
    } catch (err) {
        console.error(`[SQLite Error] Error reading cache for ${endpoint}:`, err.message);
    }
    return null;
}

/**
 * Save API response to SQLite cache.
 */
function setApiCache(endpoint, payload = {}, responseData) {
    try {
        const paramsKey = JSON.stringify(payload);
        const jsonStr = JSON.stringify(responseData);
        stmtSetApiCache.run(endpoint, paramsKey, jsonStr);
    } catch (err) {
        console.error(`[SQLite Error] Error saving cache for ${endpoint}:`, err.message);
    }
}

/**
 * Clear API cache from SQLite.
 */
function clearApiCache(endpoint = null) {
    try {
        if (endpoint) {
            stmtClearApiCacheEndpoint.run(endpoint);
        } else {
            stmtClearApiCache.run();
        }
        return true;
    } catch (err) {
        console.error('[SQLite Error] Error clearing API cache:', err.message);
        return false;
    }
}

/**
 * Get a specific question from SQLite.
 */
function getQuestion(kd_mapel, urutan) {
    try {
        const row = stmtGetQuestion.get(kd_mapel, urutan);
        if (row) {
            return {
                urutan: row.urutan,
                pertanyaan: row.pertanyaan,
                pilihan: row.pilihan ? JSON.parse(row.pilihan) : [],
                pembahasan: row.pembahasan || ""
            };
        }
    } catch (err) {
        console.error(`[SQLite Error] Error reading question ${kd_mapel} Q${urutan}:`, err.message);
    }
    return null;
}

/**
 * Save question to SQLite database.
 */
function saveQuestion(kd_mapel, subject_name, urutan, qData) {
    try {
        const pilihanStr = JSON.stringify(qData.pilihan || []);
        stmtSaveQuestion.run(
            kd_mapel,
            subject_name,
            urutan,
            qData.pertanyaan || "",
            pilihanStr,
            qData.pembahasan || ""
        );
    } catch (err) {
        console.error(`[SQLite Error] Error saving question ${kd_mapel} Q${urutan}:`, err.message);
    }
}

/**
 * Get all questions structured by subject for Bank Soal export.
 */
function getAllQuestionsGrouped() {
    try {
        const rows = stmtGetAllQuestions.all();
        const grouped = {};
        for (const r of rows) {
            if (!grouped[r.kd_mapel]) {
                grouped[r.kd_mapel] = {
                    subject_name: r.subject_name,
                    questions: []
                };
            }
            grouped[r.kd_mapel].questions.push({
                urutan: r.urutan,
                pertanyaan: r.pertanyaan,
                pilihan: r.pilihan ? JSON.parse(r.pilihan) : [],
                pembahasan: r.pembahasan || ""
            });
        }
        return grouped;
    } catch (err) {
        console.error('[SQLite Error] Error reading grouped questions:', err.message);
        return {};
    }
}

/**
 * Import questions from questions_cache.json if SQLite table is empty or missing data.
 */
function seedQuestionsFromJson(jsonPath) {
    try {
        if (!fs.existsSync(jsonPath)) return;
        const total = stmtCountQuestions.get().total;
        
        const fileContent = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(fileContent);
        
        let importedCount = 0;
        const insertMany = db.transaction((subjectsData) => {
            for (const kd in subjectsData) {
                const subj = subjectsData[kd];
                for (const q of (subj.questions || [])) {
                    saveQuestion(kd, subj.subject_name, q.urutan, q);
                    importedCount++;
                }
            }
        });

        insertMany(data);
        if (importedCount > 0) {
            console.log(`[SQLite Seed] Successfully synchronized/seeded ${importedCount} questions into SQLite database.`);
        }
    } catch (err) {
        console.error('[SQLite Error] Failed to seed questions from JSON:', err.message);
    }
}

/**
 * Get Database Statistics
 */
function getCacheStats() {
    try {
        const apiCacheCount = db.prepare('SELECT COUNT(*) AS total FROM api_cache').get().total;
        const questionsCount = stmtCountQuestions.get().total;
        
        let dbSizeBytes = 0;
        if (fs.existsSync(dbPath)) {
            dbSizeBytes = fs.statSync(dbPath).size;
        }

        const endpointSummary = db.prepare(`
            SELECT endpoint, COUNT(*) as count, MAX(updated_at) as last_updated 
            FROM api_cache GROUP BY endpoint
        `).all();

        return {
            dbPath,
            dbSizeMB: (dbSizeBytes / (1024 * 1024)).toFixed(2),
            apiCacheCount,
            questionsCount,
            endpointSummary
        };
    } catch (err) {
        console.error('[SQLite Error] Failed to get cache stats:', err.message);
        return null;
    }
}

module.exports = {
    db,
    getApiCache,
    setApiCache,
    clearApiCache,
    getQuestion,
    saveQuestion,
    getAllQuestionsGrouped,
    seedQuestionsFromJson,
    getCacheStats
};
