// State variables
let mapelList = [];
let currentChart = null;
let currentComparison = null; // Stores comparison data for SMAN 2 Mengwi vs region
let smanSummaryData = null; // Stores SMAN 2 Mengwi summary data
let smanOverallChart = null; // Stores SMAN 2 Mengwi overall comparison chart
const activeIndicatorCharts = {}; // Stores chart instances for indicators in accordion

// Accordion filter states
let activeDashboardFilter = 'all';
let activeSmanFilter = 'all';
let rawDashboardHierarchy = []; // Caches the raw hierarchy data for Dashboard
let rawDashboardElemenSummary = [];
let rawDashboardKdMapel = '';

let rawSmanHierarchy = []; // Caches the raw hierarchy data for SMAN 2 Mengwi Detail
let rawSmanElemenSummary = [];
let rawSmanKdMapel = '';

// Dynamic Region & School Codes (Defaults to SMAN 2 Mengwi, Kab. Badung, Bali)
let SMAN_PROP = "22";     // Bali
let SMAN_RAYON = "2209";   // Kab. Badung
let SMAN_SEK = "U22090017"; // SMA Negeri 2 Mengwi

// DOM Elements
const selectProvinsi = document.getElementById('select-provinsi');
const selectRayon = document.getElementById('select-rayon');
const selectSekolah = document.getElementById('select-sekolah');
const selectMapel = document.getElementById('select-mapel');

const stateLoading = document.getElementById('state-loading');
const stateError = document.getElementById('state-error');
const errorMessage = document.getElementById('error-message');
const mainDataLayout = document.getElementById('main-data-layout');

// Sidebar / View Elements
const navDashboard = document.getElementById('nav-dashboard');
const navSman2mengwi = document.getElementById('nav-sman2mengwi');
const navPeringkat = document.getElementById('nav-peringkat');
const navAnalisisSoal = document.getElementById('nav-analisis-soal');
const dashboardView = document.getElementById('dashboard-view');
const sman2mengwiView = document.getElementById('sman2mengwi-view');
const peringkatView = document.getElementById('peringkat-view');
const analisisSoalView = document.getElementById('analisis-soal-view');

// Analisis Soal View Elements
const analisisSoalSelectMapel = document.getElementById('analisis-soal-select-mapel');
const analisisSoalSearch = document.getElementById('analisis-soal-search');
const analisisSoalFilter = document.getElementById('analisis-soal-filter');
const analisisSoalSort = document.getElementById('analisis-soal-sort');
const analisisSoalCardsContainer = document.getElementById('analisis-soal-cards-container');

// Peringkat View Elements
const peringkatSelectMapel = document.getElementById('peringkat-select-mapel');
const peringkatSelectStatus = document.getElementById('peringkat-select-status');
const peringkatSearch = document.getElementById('peringkat-search');
const peringkatLoading = document.getElementById('peringkat-loading');
const peringkatTableContainer = document.getElementById('peringkat-table-container');
const peringkatTableBody = document.getElementById('peringkat-table-body');
const peringkatHeaderTitle = document.getElementById('peringkat-header-title');
const peringkatTargetBadge = document.getElementById('peringkat-target-badge');
const peringkatTargetScore = document.getElementById('peringkat-target-score');

let currentPeringkatData = null;

// SMAN 2 Mengwi View Elements
const smanLoading = document.getElementById('sman-loading');
const smanContentLayout = document.getElementById('sman-content-layout');
const smanSubjectsGrid = document.getElementById('sman-subjects-grid');

// SMAN 2 Mengwi Detail Level elements
const smanSubjectDetailSection = document.getElementById('sman-subject-detail-section');
const smanDetailTitle = document.getElementById('sman-detail-title');
const smanDetailAccordion = document.getElementById('sman-detail-accordion');
const btnCloseSmanDetail = document.getElementById('btn-close-sman-detail');

// Accordion Control Elements (Dashboard)
const btnDbExpand = document.getElementById('btn-db-expand');
const btnDbCollapse = document.getElementById('btn-db-collapse');
const dbFilterPillsContainer = document.getElementById('db-filter-pills');

// Accordion Control Elements (SMAN 2 Mengwi)
const btnSmanExpand = document.getElementById('btn-sman-expand');
const btnSmanCollapse = document.getElementById('btn-sman-collapse');
const smanFilterPillsContainer = document.getElementById('sman-filter-pills');

// Stats Elements (RESTRUCTURED FOR THE 4 COMPARISON LEVELS)
const statSekolahAvg = document.getElementById('stat-sekolah-avg');
const statKabupatenAvg = document.getElementById('stat-kabupaten-avg');
const statProvinsiAvg = document.getElementById('stat-provinsi-avg');
const statNasionalAvg = document.getElementById('stat-nasional-avg');

// Container Elements
const elemenSummaryList = document.getElementById('elemen-summary-list');
const hierarchyAccordion = document.getElementById('hierarchy-accordion');

// Modal Elements
const modalQuestion = document.getElementById('modal-question');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalQuestionHtml = document.getElementById('modal-question-html');
const modalOptionsList = document.getElementById('modal-options-list');
const modalExplanationSection = document.getElementById('modal-explanation-section');
const modalExplanationHtml = document.getElementById('modal-explanation-html');

// Helper to determine color classes based on value (0-100) - Vibrant Light Mode Colors
function getColorClass(value, type = 'text') {
    if (value >= 60) {
        return type === 'bg' ? 'bg-green' : 'val-green';
    } else if (value >= 40) {
        return type === 'bg' ? 'bg-orange' : 'val-orange';
    } else {
        return type === 'bg' ? 'bg-red' : 'val-red';
    }
}

// Format numbers with thousands separators
function formatNumber(num) {
    if (!num && num !== 0) return '-';
    return Number(num).toLocaleString('id-ID');
}

// Show/Hide View States for Dashboard
function setViewState(state) {
    stateLoading.classList.add('hidden');
    stateError.classList.add('hidden');
    mainDataLayout.classList.add('hidden');

    if (state === 'loading') {
        stateLoading.classList.remove('hidden');
    } else if (state === 'error') {
        stateError.classList.remove('hidden');
    } else if (state === 'data') {
        mainDataLayout.classList.remove('hidden');
    }
}

// Helper to verify if the explanation content string is empty or contains only whitespace/HTML placeholders
function isExplanationEmpty(text) {
    if (!text) return true;
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
    return cleanText === "";
}

// Robust Helper to extract indicators from a subelement, matching all types of nested structures
// (e.g. ABINW flat structure vs AMATW nested under kompetensi_list and subkompetensi_list)
function extractIndicators(sub) {
    let indicators = [];
    
    // 1. Check if directly available (e.g. Bahasa Indonesia)
    if (Array.isArray(sub.indikator_list)) {
        indicators.push(...sub.indikator_list);
    }
    
    // 2. Check if nested under kompetensi_list and subkompetensi_list (e.g. Matematika, Fisika, etc.)
    if (Array.isArray(sub.kompetensi_list)) {
        sub.kompetensi_list.forEach(komp => {
            if (Array.isArray(komp.subkompetensi_list)) {
                komp.subkompetensi_list.forEach(subkomp => {
                    if (Array.isArray(subkomp.indikator_list)) {
                        indicators.push(...subkomp.indikator_list);
                    }
                });
            }
            if (Array.isArray(komp.indikator_list)) {
                indicators.push(...komp.indikator_list);
            }
        });
    }
    
    // 3. Recursive fallback to guarantee recovery of any other deeply nested indicator list patterns
    if (indicators.length === 0) {
        function recursiveSearch(obj) {
            if (!obj || typeof obj !== "object") return;
            if (Array.isArray(obj)) {
                obj.forEach(recursiveSearch);
            } else {
                if (Array.isArray(obj.indikator_list)) {
                    indicators.push(...obj.indikator_list);
                } else {
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            recursiveSearch(obj[key]);
                        }
                    }
                }
            }
        }
        recursiveSearch(sub);
    }
    
    // Return unique indicators based on urutan to prevent duplicates
    const seen = new Set();
    return indicators.filter(ind => {
        if (!ind || ind.urutan === undefined) return false;
        const key = ind.urutan;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Fetch Initial Dropdown Data
async function initializeApp() {
    try {
        setViewState('loading');

        // 0. Populate Regional Selectors (Provinsi, Rayon, Sekolah)
        await loadProvinsiDropdown();
        await loadRayonDropdown(SMAN_PROP);
        await loadSekolahDropdown(SMAN_RAYON);

        // 1. Fetch Mapel
        const resMapel = await fetch('/api/mapel');
        const mapelJson = await resMapel.json();
        
        if ((mapelJson.status_code && mapelJson.status_code !== 200) || (!mapelJson.data && !mapelJson.success)) {
            throw new Error(mapelJson.message || "Gagal memuat mata pelajaran");
        }
        mapelList = mapelJson.data;

        // Populate Mapel Selector, Peringkat Mapel Selector & Analisis Soal Mapel Selector
        selectMapel.innerHTML = '';
        if (peringkatSelectMapel) peringkatSelectMapel.innerHTML = '';
        if (analisisSoalSelectMapel) analisisSoalSelectMapel.innerHTML = '';

        const savedKdMapel = localStorage.getItem('selected_kd_mapel');

        mapelList.forEach((m, idx) => {
            const option = document.createElement('option');
            option.value = m.kd_mapel;
            option.textContent = m.mapel;
            if (savedKdMapel && m.kd_mapel === savedKdMapel) {
                option.selected = true;
            }
            selectMapel.appendChild(option);

            if (peringkatSelectMapel) {
                const opt2 = document.createElement('option');
                opt2.value = m.kd_mapel;
                opt2.textContent = m.mapel;
                if (savedKdMapel && m.kd_mapel === savedKdMapel) {
                    opt2.selected = true;
                }
                peringkatSelectMapel.appendChild(opt2);
            }

            if (analisisSoalSelectMapel) {
                const opt3 = document.createElement('option');
                opt3.value = m.kd_mapel;
                opt3.textContent = m.mapel;
                if (savedKdMapel && m.kd_mapel === savedKdMapel) {
                    opt3.selected = true;
                }
                analisisSoalSelectMapel.appendChild(opt3);
            }
        });

        // Fallback to first option if no valid selection was made
        if (selectMapel.options.length > 0 && (!selectMapel.value || !selectMapel.querySelector('option[selected]'))) {
            if (!savedKdMapel || !mapelList.some(m => m.kd_mapel === savedKdMapel)) {
                selectMapel.options[0].selected = true;
                if (peringkatSelectMapel && peringkatSelectMapel.options.length > 0) {
                    peringkatSelectMapel.options[0].selected = true;
                }
            }
        }

        function reloadCurrentActiveTab() {
            const valMapel = selectMapel ? selectMapel.value : '';
            if (peringkatSelectMapel) peringkatSelectMapel.value = valMapel;
            if (analisisSoalSelectMapel) analisisSoalSelectMapel.value = valMapel;

            // Sync global header school title if selected
            if (selectSekolah && selectSekolah.options[selectSekolah.selectedIndex]) {
                const elTitle = document.getElementById('global-header-school-name');
                if (elTitle) elTitle.textContent = selectSekolah.options[selectSekolah.selectedIndex].text;
            }

            if (dashboardView && !dashboardView.classList.contains('hidden')) {
                loadDashboardData(valMapel);
            } else if (sman2mengwiView && !sman2mengwiView.classList.contains('hidden')) {
                loadSman2MengwiSummaryData();
            } else if (peringkatView && !peringkatView.classList.contains('hidden')) {
                loadPeringkatData(valMapel);
            } else if (analisisSoalView && !analisisSoalView.classList.contains('hidden')) {
                loadAnalisisSoalData(valMapel);
            }
        }

        // Add Event Listener for Mapel Filter
        selectMapel.addEventListener('change', () => {
            const val = selectMapel.value;
            if (val) {
                localStorage.setItem('selected_kd_mapel', val);
            }
            reloadCurrentActiveTab();
        });

        // Add Event Listeners for Regional Filters (Provinsi, Rayon, Sekolah)
        if (selectProvinsi) {
            selectProvinsi.addEventListener('change', async () => {
                SMAN_PROP = selectProvinsi.value;
                await loadRayonDropdown(SMAN_PROP);
                if (selectRayon && selectRayon.options.length > 0) {
                    SMAN_RAYON = selectRayon.value;
                    await loadSekolahDropdown(SMAN_RAYON);
                    if (selectSekolah && selectSekolah.options.length > 0) {
                        SMAN_SEK = selectSekolah.value;
                    }
                }
                reloadCurrentActiveTab();
            });
        }

        if (selectRayon) {
            selectRayon.addEventListener('change', async () => {
                SMAN_RAYON = selectRayon.value;
                await loadSekolahDropdown(SMAN_RAYON);
                if (selectSekolah && selectSekolah.options.length > 0) {
                    SMAN_SEK = selectSekolah.value;
                }
                reloadCurrentActiveTab();
            });
        }

        if (selectSekolah) {
            selectSekolah.addEventListener('change', () => {
                SMAN_SEK = selectSekolah.value;
                reloadCurrentActiveTab();
            });
        }

        // Hamburger Menu Logic for Mobile Screens
        const btnHamburger = document.getElementById('btn-hamburger');
        const mobileMenuWrapper = document.getElementById('mobile-menu-wrapper');
        const iconOpen = document.getElementById('hamburger-icon-open');
        const iconClose = document.getElementById('hamburger-icon-close');

        if (btnHamburger) {
            btnHamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!mobileMenuWrapper) return;
                const isHidden = mobileMenuWrapper.classList.contains('hidden');
                if (isHidden) {
                    mobileMenuWrapper.classList.remove('hidden');
                    if (iconOpen) iconOpen.classList.add('hidden');
                    if (iconClose) iconClose.classList.remove('hidden');
                } else {
                    mobileMenuWrapper.classList.add('hidden');
                    if (iconOpen) iconOpen.classList.remove('hidden');
                    if (iconClose) iconClose.classList.add('hidden');
                }
            });
        }

        // Database Cache Stats & Sync Handler
        const btnSyncDb = document.getElementById('btn-sync-db');
        if (btnSyncDb) {
            btnSyncDb.addEventListener('click', async () => {
                btnSyncDb.disabled = true;
                btnSyncDb.innerHTML = '⚡ Menyerap API ke DB...';
                try {
                    const res = await fetch('/api/cache/seed', { method: 'POST' });
                    const json = await res.json();
                    alert(json.message || "Penyerapan API ke database SQLite3 telah dimulai!");
                    setTimeout(loadDbCacheStats, 2500);
                } catch (err) {
                    alert("Gagal menyerap data: " + err.message);
                } finally {
                    btnSyncDb.disabled = false;
                    btnSyncDb.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Sinkronkan API ke Database';
                }
            });
        }
        loadDbCacheStats();

        async function loadDbCacheStats() {
            const elDetails = document.getElementById('db-status-details');
            if (!elDetails) return;
            try {
                const res = await fetch('/api/cache/stats');
                const json = await res.json();
                if (json.success && json.stats) {
                    const { questionsCount, apiCacheCount, dbSizeMB } = json.stats;
                    elDetails.innerHTML = `
                        <div>• Bank Soal: <strong class="text-slate-800">${questionsCount} Soal</strong></div>
                        <div>• Cache API: <strong class="text-slate-800">${apiCacheCount} Respon</strong> (${dbSizeMB} MB)</div>
                    `;
                }
            } catch (e) {
                console.warn('[Cache Widget] Cannot fetch stats:', e);
            }
        }

        async function loadProvinsiDropdown() {
            if (!selectProvinsi) return;
            try {
                const res = await fetch('/api/provinsi');
                const json = await res.json();
                const list = json.data || [];
                selectProvinsi.innerHTML = '';
                list.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.kd_prop;
                    opt.textContent = (p.prop || p.nm_prop || p.kd_prop).trim();
                    if (p.kd_prop === SMAN_PROP) opt.selected = true;
                    selectProvinsi.appendChild(opt);
                });
            } catch(e) { console.warn('Failed loading provinsi:', e); }
        }

        async function loadRayonDropdown(kdProp) {
            if (!selectRayon) return;
            try {
                const res = await fetch(`/api/rayon?kd_prop=${kdProp}`);
                const json = await res.json();
                const list = json.data || [];
                selectRayon.innerHTML = '';
                list.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.kd_rayon;
                    opt.textContent = (r.rayon || r.nm_rayon || r.kd_rayon).trim();
                    if (r.kd_rayon === SMAN_RAYON) opt.selected = true;
                    selectRayon.appendChild(opt);
                });
            } catch(e) { console.warn('Failed loading rayon:', e); }
        }

        async function loadSekolahDropdown(kdRayon) {
            if (!selectSekolah) return;
            try {
                const res = await fetch(`/api/sekolah?kd_rayon=${kdRayon}`);
                const json = await res.json();
                const list = json.data || [];
                selectSekolah.innerHTML = '';
                list.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.kd_sek;
                    opt.textContent = (s.nama_sek || s.nm_sek || s.kd_sek).trim();
                    if (s.kd_sek === SMAN_SEK) opt.selected = true;
                    selectSekolah.appendChild(opt);
                });
            } catch(e) { console.warn('Failed loading sekolah:', e); }
        }

        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('dashboard');
        });

        navSman2mengwi.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('sman2mengwi');
        });

        if (navPeringkat) {
            navPeringkat.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab('peringkat');
            });
        }

        if (navAnalisisSoal) {
            navAnalisisSoal.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab('analisis-soal');
            });
        }

        if (analisisSoalSelectMapel) {
            analisisSoalSelectMapel.addEventListener('change', () => {
                const val = analisisSoalSelectMapel.value;
                if (val) {
                    localStorage.setItem('selected_kd_mapel', val);
                    if (selectMapel) selectMapel.value = val;
                    if (peringkatSelectMapel) peringkatSelectMapel.value = val;
                }
                loadAnalisisSoalData(val);
            });
        }

        if (analisisSoalSearch) {
            analisisSoalSearch.addEventListener('input', () => {
                renderAnalisisSoalView();
            });
        }

        if (analisisSoalFilter) {
            analisisSoalFilter.addEventListener('change', () => {
                renderAnalisisSoalView();
            });
        }

        if (analisisSoalSort) {
            analisisSoalSort.addEventListener('change', () => {
                renderAnalisisSoalView();
            });
        }

        if (peringkatSelectMapel) {
            peringkatSelectMapel.addEventListener('change', () => {
                const val = peringkatSelectMapel.value;
                if (val) {
                    localStorage.setItem('selected_kd_mapel', val);
                    if (selectMapel) selectMapel.value = val;
                }
                loadPeringkatData(val);
            });
        }

        if (peringkatSelectStatus) {
            peringkatSelectStatus.addEventListener('change', renderPeringkatTable);
        }

        if (peringkatSearch) {
            peringkatSearch.addEventListener('input', renderPeringkatTable);
        }

        // Wire up Accordion expand/collapse & filter controls
        setupAccordionControls();

        // Close SMAN Subject Detail directly inside SMAN View
        if (btnCloseSmanDetail) {
            btnCloseSmanDetail.addEventListener('click', () => {
                smanSubjectDetailSection.classList.add('hidden');
                // Scroll back to school summary header
                document.getElementById('chart-sman-overall').scrollIntoView({ behavior: 'smooth' });
            });
        }

        // Modal Close Listeners
        modalClose.addEventListener('click', closeModal);
        window.addEventListener('click', (e) => {
            if (e.target === modalQuestion) closeModal();
        });

        // Wire up Export Bank Soal event listeners
        const btnDownloadTxt = document.getElementById('btn-download-txt');
        const btnDownloadDoc = document.getElementById('btn-download-doc');
        const btnDownloadPdf = document.getElementById('btn-download-pdf');
        
        if (btnDownloadTxt) btnDownloadTxt.addEventListener('click', () => triggerExport('txt'));
        if (btnDownloadDoc) btnDownloadDoc.addEventListener('click', () => triggerExport('doc'));
        if (btnDownloadPdf) btnDownloadPdf.addEventListener('click', () => triggerExport('pdf'));

        // Determine active tab from URL hash or fallback to dashboard
        const hashTab = location.hash.replace('#', '');
        const initialTab = (hashTab === 'sman2mengwi' || hashTab === 'peringkat' || hashTab === 'analisis-soal' || hashTab === 'dashboard')
            ? hashTab
            : (localStorage.getItem('active_tab') || 'dashboard');

        // Switch to saved tab and load corresponding data
        switchTab(initialTab);

        window.addEventListener('hashchange', () => {
            const hashTab = location.hash.replace('#', '');
            if (hashTab === 'sman2mengwi' || hashTab === 'peringkat' || hashTab === 'analisis-soal' || hashTab === 'dashboard') {
                switchTab(hashTab);
            }
        });

    } catch (err) {
        console.error("Initialization error:", err);
        errorMessage.textContent = err.message || "Koneksi ke server terputus.";
        setViewState('error');
    }
}

// Switch between Sidebar tabs with explicit DOM display control
function switchTab(tabName) {
    // Auto-close mobile hamburger menu on tab switch
    const mobileMenuWrapper = document.getElementById('mobile-menu-wrapper');
    const iconOpen = document.getElementById('hamburger-icon-open');
    const iconClose = document.getElementById('hamburger-icon-close');
    if (window.innerWidth < 768 && mobileMenuWrapper && !mobileMenuWrapper.classList.contains('hidden')) {
        mobileMenuWrapper.classList.add('hidden');
        if (iconOpen) iconOpen.classList.remove('hidden');
        if (iconClose) iconClose.classList.add('hidden');
    }

    const dView = document.getElementById('dashboard-view');
    const sView = document.getElementById('sman2mengwi-view');
    const pView = document.getElementById('peringkat-view');
    const aView = document.getElementById('analisis-soal-view');

    const nDash = document.getElementById('nav-dashboard');
    const nSman = document.getElementById('nav-sman2mengwi');
    const nRank = document.getElementById('nav-peringkat');
    const nAnalisis = document.getElementById('nav-analisis-soal');

    const baseStyle = "flex items-center gap-3 px-4 py-2.5 text-slate-500 no-underline rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap sidebar-link";

    if (nDash) nDash.className = baseStyle;
    if (nSman) nSman.className = baseStyle;
    if (nRank) nRank.className = baseStyle;
    if (nAnalisis) nAnalisis.className = baseStyle;

    // Hide all view containers cleanly
    if (dView) { dView.classList.add('hidden'); dView.style.display = 'none'; }
    if (sView) { sView.classList.add('hidden'); sView.style.display = 'none'; }
    if (pView) { pView.classList.add('hidden'); pView.style.display = 'none'; }
    if (aView) { aView.classList.add('hidden'); aView.style.display = 'none'; }

    const validTab = (tabName === 'sman2mengwi' || tabName === 'peringkat' || tabName === 'analisis-soal') ? tabName : 'dashboard';
    localStorage.setItem('active_tab', validTab);
    
    if (history.replaceState) {
        history.replaceState(null, null, '#' + validTab);
    }

    if (validTab === 'sman2mengwi') {
        if (nSman) { nSman.classList.add('active'); nSman.className += " active sidebar-link active"; }
        if (sView) { sView.classList.remove('hidden'); sView.style.display = 'block'; }
        if (smanSubjectDetailSection) smanSubjectDetailSection.classList.add('hidden');
        loadSmanSummary();
    } else if (validTab === 'peringkat') {
        if (nRank) { nRank.classList.add('active'); nRank.className += " active sidebar-link active"; }
        if (pView) { pView.classList.remove('hidden'); pView.style.display = 'block'; }
        loadPeringkatData();
    } else if (validTab === 'analisis-soal') {
        if (nAnalisis) { nAnalisis.classList.add('active'); nAnalisis.className += " active sidebar-link active"; }
        if (aView) { aView.classList.remove('hidden'); aView.style.display = 'block'; }
        loadAnalisisSoalData();
    } else {
        if (nDash) { nDash.classList.add('active'); nDash.className += " active sidebar-link active"; }
        if (dView) { dView.classList.remove('hidden'); dView.style.display = 'block'; }
        loadDashboardData();
    }
}

// Wire up expand/collapse and filter pills listeners
function setupAccordionControls() {
    // 1. Dashboard Controls
    if (btnDbExpand) {
        btnDbExpand.addEventListener('click', () => toggleAllAccordion(hierarchyAccordion, true));
    }
    if (btnDbCollapse) {
        btnDbCollapse.addEventListener('click', () => toggleAllAccordion(hierarchyAccordion, false));
    }
    if (dbFilterPillsContainer) {
        const pills = dbFilterPillsContainer.querySelectorAll('.filter-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => {
                    p.className = "px-3.5 py-1.5 rounded-full text-xs font-bold filter-pill bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-800";
                });
                pill.className = "px-3.5 py-1.5 rounded-full text-xs font-bold filter-pill active bg-blue-600 text-white shadow-md";
                activeDashboardFilter = pill.getAttribute('data-filter');
                
                // Re-render dashboard accordion with active filter
                renderHierarchyAccordion(hierarchyAccordion, rawDashboardHierarchy, rawDashboardElemenSummary, currentComparison, rawDashboardKdMapel, activeDashboardFilter);
            });
        });
    }

    // 2. SMAN 2 Mengwi Controls
    if (btnSmanExpand) {
        btnSmanExpand.addEventListener('click', () => toggleAllAccordion(smanDetailAccordion, true));
    }
    if (btnSmanCollapse) {
        btnSmanCollapse.addEventListener('click', () => toggleAllAccordion(smanDetailAccordion, false));
    }
    if (smanFilterPillsContainer) {
        const pills = smanFilterPillsContainer.querySelectorAll('.filter-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => {
                    p.className = "px-3.5 py-1.5 rounded-full text-xs font-bold filter-pill bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-800";
                });
                pill.className = "px-3.5 py-1.5 rounded-full text-xs font-bold filter-pill active bg-blue-600 text-white shadow-md";
                activeSmanFilter = pill.getAttribute('data-filter');
                
                // Re-render SMAN 2 Mengwi accordion with active filter
                renderHierarchyAccordion(smanDetailAccordion, rawSmanHierarchy, rawSmanElemenSummary, currentComparison, rawSmanKdMapel, activeSmanFilter);
            });
        });
    }
}

// Expand or collapse all sections inside a target accordion container
function toggleAllAccordion(containerElement, expand = true) {
    const sections = containerElement.querySelectorAll('.elemen-section');
    sections.forEach(sec => {
        if (expand) {
            sec.classList.add('expanded');
            const body = sec.querySelector('.elemen-section-body');
            if (body) body.classList.remove('hidden');
            
            // Render charts inside indicators for all elements when opened
            const indicators = sec.querySelectorAll('.indikator-item');
            indicators.forEach(indItem => {
                indItem.classList.add('expanded');
                const btn = indItem.querySelector('.btn-view-question');
                if (btn) {
                    const urutan = btn.getAttribute('data-urutan');
                    setTimeout(() => {
                        triggerChartRender(containerElement.id, urutan);
                    }, 50);
                }
            });
        } else {
            sec.classList.remove('expanded');
            const body = sec.querySelector('.elemen-section-body');
            if (body) body.classList.add('hidden');
            
            const indicators = sec.querySelectorAll('.indikator-item');
            indicators.forEach(indItem => indItem.classList.remove('expanded'));
        }
    });
}

// Trigger chart render helper during bulk expansion
function triggerChartRender(containerId, urutan) {
    if (!currentComparison) return;
    renderIndicatorChart(containerId, urutan, {
        sekolah: currentComparison.sekolah?.urutan[urutan],
        kabupaten: currentComparison.kabupaten?.urutan[urutan],
        provinsi: currentComparison.provinsi?.urutan[urutan],
        nasional: currentComparison.nasional?.urutan[urutan]
    });
}

// Fetch Dashboard and Comparison Data (PERMANENTLY LOCKED to SMAN 2 Mengwi codes)
async function loadDashboardData() {
    const kdMapel = selectMapel.value;
    if (!kdMapel) return;

    // Save selected mapel to localStorage so it persists on browser refresh
    localStorage.setItem('selected_kd_mapel', kdMapel);

    try {
        setViewState('loading');

        // Permanently bind query to SMAN 2 Mengwi codes (kd_prop=22, kd_rayon=2209, kd_sek=U22090017)
        let url = `/api/daya-serap?kd_mapel=${kdMapel}&kd_prop=${SMAN_PROP}&kd_rayon=${SMAN_RAYON}&kd_sek=${SMAN_SEK}`;

        const response = await fetch(url);
        const jsonResult = await response.json();

        if (jsonResult.error) {
            throw new Error(jsonResult.error);
        }

        if (!jsonResult.data) {
            throw new Error(jsonResult.message || "Data tidak ditemukan untuk pilihan ini.");
        }

        currentComparison = jsonResult.data.comparison || null;

        // Cache Dashboard raw values for filtering
        rawDashboardHierarchy = jsonResult.data.detail_hierarchy || [];
        rawDashboardElemenSummary = jsonResult.data.elemen_summary || [];
        rawDashboardKdMapel = kdMapel;

        // Reset filter pill active state
        if (dbFilterPillsContainer) {
            const firstPill = dbFilterPillsContainer.querySelector('.filter-pill');
            if (firstPill) firstPill.click(); // Reset dashboard filter to 'all'
        }

        // CRITICAL ROBUSTNESS FIX: Show the DOM layout FIRST before rendering charts.
        // This ensures the canvas parent container is visible and has computed dimensions > 0, 
        // preventing Chart.js from throwing zero-width layout exceptions in some browsers.
        setViewState('data');
        renderDashboard(jsonResult.data);

    } catch (err) {
        console.error("Error loading dashboard data:", err);
        errorMessage.textContent = err.message || "Gagal mengambil data analisis sekolah.";
        setViewState('error');
    }
}

// Load SMAN 2 Mengwi Summary (All active subjects comparison)
async function loadSmanSummary() {
    smanLoading.classList.remove('hidden');
    smanContentLayout.classList.add('hidden');

    try {
        const response = await fetch('/api/sman2mengwi/summary');
        const json = await response.json();

        if (!json.success || !json.data) {
            throw new Error(json.message || "Gagal mengambil ringkasan mata pelajaran.");
        }

        smanSummaryData = json.data;
        
        // Show layout first so the overall chart canvas has valid computed width/height
        smanLoading.classList.add('hidden');
        smanContentLayout.classList.remove('hidden');

        // Render SMAN 2 Mengwi Cards Grid
        renderSmanSummary(json);
        
        // Render SMAN 2 Mengwi Overall Comparison Chart
        try {
            renderSmanOverallChart(json.data);
        } catch (chartErr) {
            console.error("Error rendering SMAN overall chart:", chartErr);
        }
        
    } catch (err) {
        console.error("Error loading SMAN 2 Mengwi summary:", err);
        smanLoading.innerHTML = `<p style="color:var(--danger); text-align:center;">⚠️ Gagal memuat ringkasan sekolah: ${err.message}</p>`;
    }
}

// Render SMAN 2 Mengwi Overall Comparison Chart (Blue Accent Update)
function renderSmanOverallChart(list) {
    const canvas = document.getElementById('chart-sman-overall');
    if (!canvas) return;

    if (smanOverallChart) {
        smanOverallChart.destroy();
    }

    const labels = list.map(item => item.code || item.name); // e.g. BIN, MAT, BIG
    const sekData = list.map(item => item.sekolah || 0);
    const kabData = list.map(item => item.kabupaten || 0);
    const nasData = list.map(item => item.nasional || 0);

    const ctx = canvas.getContext('2d');
    smanOverallChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'SMAN 2 Mengwi',
                    data: sekData,
                    backgroundColor: 'rgba(37, 99, 235, 0.75)', // Royal Blue
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 5
                },
                {
                    label: 'Kab. Badung',
                    data: kabData,
                    backgroundColor: 'rgba(96, 165, 250, 0.75)', // Sky Blue
                    borderColor: '#60a5fa',
                    borderWidth: 1,
                    borderRadius: 5
                },
                {
                    label: 'Nasional',
                    data: nasData,
                    backgroundColor: 'rgba(148, 163, 184, 0.75)', // Slate Gray
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#475569',
                        font: { family: 'Inter', size: 11, weight: 'bold' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) { return ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 10, weight: 'bold' } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 10 },
                        callback: function(value) { return value + "%"; }
                    }
                }
            }
        }
    });
}

// Render SMAN 2 Mengwi Cards Grid
function renderSmanSummary(summaryPayload) {
    smanSubjectsGrid.innerHTML = '';
    const list = summaryPayload.data || [];

    // Define color codes for subjects based on codes to look premium
    const subjectColors = {
        BIN: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-600' },
        MAT: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-600' },
        MATL: { bg: 'bg-indigo-600/10', border: 'border-indigo-600/30', text: 'text-indigo-600' },
        BIG: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600' },
        PKN: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-600' },
        BIO: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600' },
        KIM: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-600' },
        FIS: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-600' },
        SOS: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600' },
        EKO: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600' },
        GEO: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-600' },
        JEP: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600' }
    };

    list.forEach(subj => {
        if (subj.error) return;

        const sekScore = subj.sekolah || 0;
        const kabScore = subj.kabupaten || 0;
        const nasScore = subj.nasional || 0;
        const pesertaSek = subj.peserta?.sekolah || 0;

        const colorClass = getColorClass(sekScore);
        
        // Calculate difference against Kabupaten
        const diffKab = sekScore - kabScore;
        const compareBadgeClass = diffKab >= 0 ? 'above' : 'below';
        const compareBadgeText = diffKab >= 0 ? `+${diffKab.toFixed(1)}% vs Badung` : `${diffKab.toFixed(1)}% vs Badung`;
        const compareIcon = diffKab >= 0 ? '▲' : '▼';

        const design = subjectColors[subj.code] || { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-600' };

        const card = document.createElement('div');
        card.className = 'subject-summary-card';
        card.innerHTML = `
            <div class="subject-card-header">
                <div class="subject-card-title flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${design.bg} ${design.border} ${design.text}">
                        ${subj.code}
                    </div>
                    <div>
                        <span class="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">MATA PELAJARAN</span>
                        <h3>${subj.name}</h3>
                    </div>
                </div>
                <div class="compare-badge ${compareBadgeClass}">
                    <span>${compareIcon} ${compareBadgeText}</span>
                </div>
            </div>
            
            <div class="subject-score-large">
                <span class="score-num ${colorClass}">${sekScore.toFixed(2)}%</span>
                <span class="score-label">Daya Serap Sekolah</span>
            </div>

            <!-- Jumlah peserta badge -->
            ${pesertaSek > 0 ? `
            <div style="display:flex;align-items:center;gap:6px;background:rgba(37,99,235,0.05);border:1px solid rgba(37,99,235,0.12);border-radius:0.625rem;padding:0.45rem 0.75rem;">
                <svg style="width:14px;height:14px;color:#2563eb;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                <span style="font-size:0.7rem;font-weight:700;color:#2563eb">${formatNumber(pesertaSek)} siswa</span>
                <span style="font-size:0.65rem;color:#94a3b8;font-weight:600">ikut TKA</span>
            </div>` : ''}

            <div class="card-comparison-list">
                <div class="card-comparison-row">
                    <span>Kabupaten Badung</span>
                    <span>${kabScore.toFixed(2)}%</span>
                </div>
                <div class="card-comparison-row">
                    <span>Rerata Nasional</span>
                    <span>${nasScore.toFixed(2)}%</span>
                </div>
            </div>

            <button class="btn-card-action" data-kd="${subj.kd_mapel}" data-name="${subj.name}">
                Lihat Soal & Detail
            </button>
        `;

        // Add action event listener
        const btnAction = card.querySelector('.btn-card-action');
        btnAction.addEventListener('click', () => {
            loadSmanSubjectDetail(subj.kd_mapel, subj.name);
        });

        smanSubjectsGrid.appendChild(card);
    });

    // Render tabel & chart peserta
    renderPesertaSection(list);
}

// Render section jumlah peserta TKA per mata pelajaran
let pesertaChart = null;
function renderPesertaSection(list) {
    const tableBody = document.getElementById('peserta-table-body');
    const badgesEl  = document.getElementById('peserta-total-badges');
    if (!tableBody) return;

    const valid = list.filter(s => !s.error && s.peserta);

    // Hitung total peserta sekolah
    const totalSek = valid.reduce((acc, s) => acc + (s.peserta?.sekolah || 0), 0);
    const totalKab = valid.reduce((acc, s) => acc + (s.peserta?.kabupaten || 0), 0);
    const totalNas = valid.reduce((acc, s) => acc + (s.peserta?.nasional || 0), 0);

    // Badges ringkasan
    if (badgesEl) {
        badgesEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:0.625rem;padding:0.4rem 0.85rem">
                <span style="font-size:0.65rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">SMAN 2 Mengwi</span>
                <span style="font-size:0.9rem;font-weight:800;color:#2563eb">${formatNumber(totalSek)}</span>
                <span style="font-size:0.65rem;color:#94a3b8;font-weight:600">siswa</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.625rem;padding:0.4rem 0.85rem">
                <span style="font-size:0.65rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Kab. Badung</span>
                <span style="font-size:0.9rem;font-weight:800;color:#475569">${formatNumber(totalKab)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.625rem;padding:0.4rem 0.85rem">
                <span style="font-size:0.65rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Nasional</span>
                <span style="font-size:0.9rem;font-weight:800;color:#475569">${formatNumber(totalNas)}</span>
            </div>
        `;
    }

    // Render tabel
    tableBody.innerHTML = valid.map(subj => {
        const sek = subj.peserta?.sekolah || 0;
        const kab = subj.peserta?.kabupaten || 0;
        const nas = subj.peserta?.nasional || 0;
        // Hitung share persen
        const sharePct = kab > 0 ? ((sek / kab) * 100).toFixed(1) : '-';
        const shareColor = sek / kab >= 0.12 ? '#059669' : sek / kab >= 0.07 ? '#d97706' : '#dc2626';
        return `<tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <td class="py-3 pr-4">
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:0.75rem;font-weight:700;color:#0f172a">${subj.name}</span>
                    <span style="font-size:0.65rem;background:rgba(37,99,235,0.07);color:#2563eb;border:1px solid rgba(37,99,235,0.12);padding:0.1rem 0.4rem;border-radius:0.375rem;font-weight:700">${subj.code}</span>
                </div>
            </td>
            <td class="py-3 pr-4 text-right">
                <span style="font-size:0.875rem;font-weight:800;color:#2563eb">${formatNumber(sek)}</span>
                ${kab > 0 ? `<span style="font-size:0.7rem;color:${shareColor};font-weight:700;margin-left:4px">(${sharePct}%)</span>` : ''}
            </td>
            <td class="py-3 pr-4 text-right">
                <span style="font-size:0.875rem;font-weight:700;color:#475569">${formatNumber(kab)}</span>
            </td>
            <td class="py-3 text-right">
                <span style="font-size:0.875rem;font-weight:700;color:#94a3b8">${formatNumber(nas)}</span>
            </td>
        </tr>`;
    }).join('');

    // Render chart peserta
    const canvas = document.getElementById('chart-peserta');
    if (!canvas) return;
    if (pesertaChart) { pesertaChart.destroy(); pesertaChart = null; }

    const labels  = valid.map(s => s.code);
    const dataSek = valid.map(s => s.peserta?.sekolah || 0);
    const dataKab = valid.map(s => s.peserta?.kabupaten || 0);

    const ctx = canvas.getContext('2d');
    pesertaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'SMAN 2 Mengwi',
                    data: dataSek,
                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 6,
                    order: 1
                },
                {
                    label: 'Kab. Badung',
                    data: dataKab,
                    backgroundColor: 'rgba(148, 163, 184, 0.3)',
                    borderColor: 'rgba(148,163,184,0.6)',
                    borderWidth: 1,
                    borderRadius: 6,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#475569', font: { family: 'Inter', size: 11, weight: 'bold' } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} siswa`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 10, weight: 'bold' } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 10 },
                        callback: v => formatNumber(v)
                    }
                }
            }
        }
    });
}

// Load SMAN 2 Mengwi detailed subject analysis and indicator accordion
async function loadSmanSubjectDetail(kdMapel, mapelName) {
    if (!smanSubjectDetailSection) return;

    // Synchronize selector and localStorage when detail card is clicked
    if (selectMapel && kdMapel) {
        selectMapel.value = kdMapel;
        localStorage.setItem('selected_kd_mapel', kdMapel);
    }

    smanDetailTitle.textContent = mapelName;
    smanSubjectDetailSection.classList.remove('hidden');
    smanDetailAccordion.innerHTML = '<div class="flex items-center justify-center py-10"><div class="spinner"></div></div>';
    
    // Smooth scroll down to detail panel
    smanSubjectDetailSection.scrollIntoView({ behavior: 'smooth' });

    try {
        // Fetch detailed data for SMAN 2 Mengwi (kd_prop=22, kd_rayon=2209, kd_sek=U22090017)
        const response = await fetch(`/api/daya-serap?kd_mapel=${kdMapel}&kd_prop=${SMAN_PROP}&kd_rayon=${SMAN_RAYON}&kd_sek=${SMAN_SEK}`);
        const jsonResult = await response.json();

        if (jsonResult.error || !jsonResult.data) {
            throw new Error(jsonResult.error || "Gagal mengambil data detail pelajaran.");
        }

        const data = jsonResult.data;
        
        // Cache SMAN Subject detail raw values for filtering
        rawSmanHierarchy = data.detail_hierarchy || [];
        rawSmanElemenSummary = data.elemen_summary || [];
        rawSmanKdMapel = kdMapel;

        // Reset filter pill active state
        if (smanFilterPillsContainer) {
            const firstPill = smanFilterPillsContainer.querySelector('.filter-pill');
            if (firstPill) firstPill.click(); // Reset sman filter to 'all'
        }

        const comparison = data.comparison || null;
        
        // Render the accordion using the generic helper
        renderHierarchyAccordion(smanDetailAccordion, rawSmanHierarchy, rawSmanElemenSummary, comparison, kdMapel, activeSmanFilter);
    } catch (err) {
        console.error("Error loading SMAN 2 Mengwi subject detail:", err);
        smanDetailAccordion.innerHTML = `<p style="color:var(--danger); text-align:center;">⚠️ Gagal memuat analisis detail: ${err.message}</p>`;
    }
}

// Reusable Accordion Render Helper with filtering support
function renderHierarchyAccordion(containerElement, hierarchy, elemenSummary, comparison, kdMapel, filter = 'all') {
    containerElement.innerHTML = '';
    
    // Apply filter criteria to the tree elements
    const filteredHierarchy = [];
    hierarchy.forEach(el => {
        const filteredSubs = [];
        const subList = el.subelemen_list || [];
        subList.forEach(sub => {
            // Robustly extract nested indicators from the subelement node
            const indList = extractIndicators(sub);
            
            const filteredInds = indList.filter(ind => {
                const indVal = ind.nilai || 0;
                if (filter === 'difficult') return indVal < 40;
                if (filter === 'easy') return indVal >= 60;
                return true;
            });
            
            if (filteredInds.length > 0) {
                filteredSubs.push({
                    ...sub,
                    indikator_list: filteredInds // Store flat indicators on this subelement node for rendering
                });
            }
        });
        if (filteredSubs.length > 0) {
            filteredHierarchy.push({
                ...el,
                subelemen_list: filteredSubs
            });
        }
    });

    if (filteredHierarchy.length === 0) {
        containerElement.innerHTML = '<p class="text-slate-500 text-center py-10 bg-slate-100/50 border border-dashed border-slate-200 rounded-xl font-medium">Tidak ada data indikator yang sesuai dengan filter ini.</p>';
        return;
    }

    const elemenScores = {};
    elemenSummary.forEach(e => {
        elemenScores[e.elemen] = e.rata_rata_persen;
    });

    filteredHierarchy.forEach((el, index) => {
        const elName = el.elemen;
        const elScore = elemenScores[elName] !== undefined ? elemenScores[elName] : el.rata_rata || 0;
        const elColorClass = getColorClass(elScore);

        const elSection = document.createElement('div');
        elSection.className = `elemen-section ${index === 0 ? 'expanded' : ''}`;

        const header = document.createElement('div');
        header.className = 'elemen-section-header';
        header.innerHTML = `
            <div class="elemen-meta flex items-center gap-3">
                <span class="elemen-badge">Elemen ${index + 1}</span>
                <h3 class="elemen-title font-bold text-sm text-slate-800">${elName}</h3>
            </div>
            <div class="elemen-meta flex items-center gap-3">
                <span class="elemen-value font-bold ${elColorClass}">${elScore.toFixed(2)}%</span>
                <svg class="elemen-chevron w-5 h-5 transition-transform duration-200 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"></path>
                </svg>
            </div>
        `;

        header.addEventListener('click', () => {
            elSection.classList.toggle('expanded');
            const body = elSection.querySelector('.elemen-section-body');
            if (body) body.classList.toggle('hidden');
        });

        const body = document.createElement('div');
        body.className = `elemen-section-body p-6 flex flex-col gap-6 ${index === 0 ? '' : 'hidden'}`;

        const subelemenList = el.subelemen_list || [];
        subelemenList.forEach(sub => {
            const subCard = document.createElement('div');
            subCard.className = 'subelemen-card';
            const subScore = sub.rata_rata || 0;

            subCard.innerHTML = `
                <div class="subelemen-title">
                    <span>${sub.subelemen}</span>
                    <span class="subelemen-score">${subScore.toFixed(2)}%</span>
                </div>
            `;

            const indListContainer = document.createElement('div');
            indListContainer.className = 'indikator-list';

            const indicators = sub.indikator_list || [];
            indicators.forEach(ind => {
                const indVal = ind.nilai || 0;
                const errorVal = 100 - indVal; // Hitung tingkat kesalahan soal
                
                const indColor = getColorClass(indVal);
                const indBg = getColorClass(indVal, 'bg');
                
                const errorColor = getColorClass(100 - errorVal);

                const indItem = document.createElement('div');
                indItem.className = 'indikator-item';
                
                const indHeader = document.createElement('div');
                indHeader.className = 'indikator-header';
                indHeader.innerHTML = `
                    <div class="indikator-name flex items-center gap-3 text-xs md:text-sm text-slate-700">
                        <span class="indikator-num w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center font-bold text-xs text-blue-600 border border-blue-100">${ind.urutan}</span>
                        <span>${ind.indikator.replace(/\s*\(\d+\)\s*$/, '')}</span>
                    </div>
                    <div class="indikator-perf flex items-center gap-4">
                        <span class="indikator-perf-value font-bold text-sm min-w-[48px] text-right ${indColor}">${indVal.toFixed(2)}%</span>
                        <div class="mini-progress-bg">
                            <div class="mini-progress-bar ${indBg}" style="width: ${indVal}%"></div>
                        </div>
                    </div>
                `;
                indItem.appendChild(indHeader);

                const indDetail = document.createElement('div');
                indDetail.className = 'indikator-detail';

                indDetail.innerHTML = `
                    <div class="detail-grid">
                        <div class="error-analysis-box">
                            <div class="analysis-row">
                                <span>Daya Serap (Benar)</span>
                                <span class="${indColor}">${indVal.toFixed(2)}%</span>
                            </div>
                            <div class="analysis-row">
                                <span>Tingkat Kesalahan</span>
                                <span class="${errorColor}">${errorVal.toFixed(2)}%</span>
                            </div>
                            <button class="btn-view-question" data-urutan="${ind.urutan}">
                                Lihat Contoh Soal & Pembahasan
                            </button>
                        </div>
                        
                        <!-- RENDER DYNAMIC CHART CANVAS COMPONENT -->
                        <div class="comparison-box md:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col">
                            <h4 class="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Grafik Perbandingan Wilayah (%)</h4>
                            <div class="relative h-[160px] w-full">
                                <canvas id="chart-ind-${containerElement.id}-${ind.urutan}"></canvas>
                            </div>
                        </div>
                    </div>
                `;

                const btnView = indDetail.querySelector('.btn-view-question');
                btnView.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openQuestionModal(kdMapel, ind.urutan);
                });

                indItem.appendChild(indDetail);

                // Open listener toggles and renders the bar chart
                indHeader.addEventListener('click', (e) => {
                    const isExpanded = indItem.classList.toggle('expanded');
                    if (isExpanded && comparison) {
                        setTimeout(() => {
                            try {
                                renderIndicatorChart(containerElement.id, ind.urutan, {
                                    sekolah: comparison.sekolah?.urutan[ind.urutan],
                                    kabupaten: comparison.kabupaten?.urutan[ind.urutan],
                                    provinsi: comparison.provinsi?.urutan[ind.urutan],
                                    nasional: comparison.nasional?.urutan[ind.urutan]
                                });
                            } catch (chartErr) {
                                console.error("Error rendering indicator chart:", chartErr);
                            }
                        }, 50);
                    }
                });

                indListContainer.appendChild(indItem);
            });

            subCard.appendChild(indListContainer);
            body.appendChild(subCard);
        });

        elSection.appendChild(header);
        elSection.appendChild(body);
        containerElement.appendChild(elSection);
    });
}

// Render dynamic Bar Chart inside expanded indicator (Blue Accent Update)
function renderIndicatorChart(containerId, urutan, scores) {
    const canvasId = `chart-ind-${containerId}-${urutan}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const chartKey = `${containerId}-${urutan}`;
    if (activeIndicatorCharts[chartKey]) {
        activeIndicatorCharts[chartKey].destroy();
    }

    const labels = [];
    const data = [];
    const bgColors = [];
    const borderColors = [];

    // Only draw levels that actually have values in API payload
    if (scores.sekolah !== undefined) {
        labels.push('SMAN 2 Mengwi');
        data.push(scores.sekolah);
        bgColors.push('rgba(37, 99, 235, 0.75)'); // Royal Blue
        borderColors.push('#2563eb');
    }
    if (scores.kabupaten !== undefined) {
        labels.push('Kab. Badung');
        data.push(scores.kabupaten);
        bgColors.push('rgba(96, 165, 250, 0.75)'); // Sky Blue
        borderColors.push('#60a5fa');
    }
    if (scores.provinsi !== undefined) {
        labels.push('Prov. Bali');
        data.push(scores.provinsi);
        bgColors.push('rgba(52, 211, 153, 0.75)'); // Emerald Green
        borderColors.push('#34d399');
    }
    if (scores.nasional !== undefined) {
        labels.push('Nasional');
        data.push(scores.nasional);
        bgColors.push('rgba(148, 163, 184, 0.75)'); // Slate Gray
        borderColors.push('#94a3b8');
    }

    const ctx = canvas.getContext('2d');
    activeIndicatorCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return ` ${context.parsed.y.toFixed(2)}%`; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 9 },
                        callback: function(value) { return value + "%"; }
                    }
                }
            }
        }
    });
}

// Render Dashboard UI (POPULATE THE 4 RERATA COMPARISON BADGES)
function renderDashboard(data) {
    const elemenSummary = data.elemen_summary || [];

    // Calculate overall average
    let avgScore = 0;
    if (elemenSummary.length > 0) {
        const sum = elemenSummary.reduce((acc, curr) => acc + (curr.rata_rata_persen || 0), 0);
        avgScore = sum / elemenSummary.length;
    }

    const comp = data.comparison || {};
    
    // Average scores with fallback calculations
    const sekVal = comp.sekolah?.avg !== undefined ? comp.sekolah.avg : avgScore; 
    const kabVal = comp.kabupaten?.avg !== undefined ? comp.kabupaten.avg : 0;
    const propVal = comp.provinsi?.avg !== undefined ? comp.provinsi.avg : 0;
    const nasVal = comp.nasional?.avg !== undefined ? comp.nasional.avg : 0;

    if (statSekolahAvg) {
        statSekolahAvg.textContent = `${sekVal.toFixed(2)}%`;
        statSekolahAvg.className = `text-xl md:text-2xl font-extrabold truncate ${getColorClass(sekVal)}`;
    }
    if (statKabupatenAvg) {
        statKabupatenAvg.textContent = `${kabVal.toFixed(2)}%`;
        statKabupatenAvg.className = `text-xl md:text-2xl font-extrabold truncate ${getColorClass(kabVal)}`;
    }
    if (statProvinsiAvg) {
        statProvinsiAvg.textContent = `${propVal.toFixed(2)}%`;
        statProvinsiAvg.className = `text-xl md:text-2xl font-extrabold truncate ${getColorClass(propVal)}`;
    }
    if (statNasionalAvg) {
        statNasionalAvg.textContent = `${nasVal.toFixed(2)}%`;
        statNasionalAvg.className = `text-xl md:text-2xl font-extrabold truncate ${getColorClass(nasVal)}`;
    }

    try {
        renderChart(elemenSummary);
    } catch (chartErr) {
        console.error("Error rendering elements chart:", chartErr);
    }

    try {
        renderElemenList(elemenSummary);
    } catch (listErr) {
        console.error("Error rendering elements list:", listErr);
    }
    
    try {
        // Render Dashboard hierarchy accordion
        renderHierarchyAccordion(hierarchyAccordion, rawDashboardHierarchy, rawDashboardElemenSummary, currentComparison, rawDashboardKdMapel, activeDashboardFilter);
    } catch (accordionErr) {
        console.error("Error rendering dashboard accordion:", accordionErr);
    }
}

// Render Chart.js Graph (Vibrant Light Theme Update)
function renderChart(elemenSummary) {
    const labels = elemenSummary.map(e => e.elemen);
    const scores = elemenSummary.map(e => e.rata_rata_persen);
    const bgColors = scores.map(s => {
        if (s >= 60) return 'rgba(16, 185, 129, 0.75)'; // Emerald Green
        if (s >= 40) return 'rgba(245, 158, 11, 0.75)'; // Amber Orange
        return 'rgba(239, 68, 68, 0.75)'; // Red
    });
    const borderColors = scores.map(s => {
        if (s >= 60) return '#10b981';
        if (s >= 40) return '#f59e0b';
        return '#ef4444';
    });

    if (currentChart) {
        currentChart.destroy();
    }

    const ctx = document.getElementById('chart-elemen').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Persentase Daya Serap (%)',
                data: scores,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 8,
                barPercentage: 0.55
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return ` ${context.parsed.y.toFixed(2)}%`; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 11, weight: 'bold' }
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter' },
                        callback: function(value) { return value + "%"; }
                    }
                }
            }
        }
    });
}

// Render list of Elemen Summary
function renderElemenList(elemenSummary) {
    elemenSummaryList.innerHTML = '';
    if (elemenSummary.length === 0) {
        elemenSummaryList.innerHTML = '<p class="text-secondary text-sm">Tidak ada data elemen.</p>';
        return;
    }

    elemenSummary.forEach(e => {
        const score = e.rata_rata_persen || 0;
        const colorClass = getColorClass(score);
        const bgClass = getColorClass(score, 'bg');

        const item = document.createElement('div');
        item.className = 'elemen-item';
        item.innerHTML = `
            <div class="elemen-item-header">
                <span class="elemen-title">${e.elemen}</span>
                <span class="elemen-value ${colorClass}">${score.toFixed(2)}%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar ${bgClass}" style="width: ${score}%"></div>
            </div>
        `;
        elemenSummaryList.appendChild(item);
    });
}

// Open Contoh Soal Modal
async function openQuestionModal(kdMapel, urutan) {
    modalTitle.textContent = "Memuat Soal...";
    modalSubtitle.textContent = `Soal No. ${urutan} - Mapel: ${kdMapel}`;
    modalQuestionHtml.innerHTML = '<div style="text-align:center; padding: 1rem;"><div class="spinner" style="width:30px; height:30px; border-width:3px; margin: 0 auto;"></div></div>';
    modalOptionsList.innerHTML = '';
    modalExplanationSection.classList.add('hidden');
    
    // Clear AI container first
    const aiContainer = document.getElementById('modal-ai-solver-container');
    if (aiContainer) aiContainer.innerHTML = '';

    modalQuestion.classList.remove('hidden');

    try {
        const response = await fetch(`/api/contoh-soal?kd_mapel=${kdMapel}&urutan=${urutan}`);
        const result = await response.json();

        if ((result.status_code && result.status_code !== 200) || (!result.data && !result.success) || !result.data || !result.data.contoh_soal || result.data.contoh_soal.length === 0) {
            throw new Error("Gagal mengambil data contoh soal dari API");
        }

        const questionData = result.data.contoh_soal[0];
        const codebook = result.data.codebook || {};

        modalTitle.textContent = `Contoh Soal #${questionData.nomor_soal || urutan}`;
        
        const emptyExplanation = isExplanationEmpty(questionData.pembahasan);
        
        // Custom subtitle indicator if correct answer is hidden by API
        if (emptyExplanation) {
            modalSubtitle.innerHTML = `${codebook.kompetensi || ''} / ${codebook.subkompetensi || ''} <span class="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-md ml-2 inline-block">🔒 Kunci & Pembahasan Dirahasiakan</span>`;
        } else {
            modalSubtitle.textContent = `${codebook.kompetensi || ''} / ${codebook.subkompetensi || ''}`;
        }

        modalQuestionHtml.innerHTML = questionData.pertanyaan;

        modalOptionsList.innerHTML = '';
        const choices = questionData.pilihan || [];
        choices.forEach(ch => {
            const item = document.createElement('div');
            item.className = 'option-item';
            
            const isCorrect = isOptionCorrect(ch.key, questionData.pembahasan);
            if (isCorrect) {
                item.classList.add('correct');
            }

            item.innerHTML = `
                <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-800 flex-shrink-0 option-badge">${ch.key}</div>
                <div class="text-sm text-slate-600 option-text">${ch.text}</div>
            `;
            modalOptionsList.appendChild(item);
        });

        // Set Pembahasan UI
        if (!emptyExplanation) {
            modalExplanationHtml.innerHTML = questionData.pembahasan;
            modalExplanationSection.classList.remove('hidden');
        } else {
            // Elegant placeholder card for hidden answer keys
            modalExplanationHtml.innerHTML = `
                <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                    <span class="text-lg flex-shrink-0">🔒</span>
                    <div>
                        <p class="font-bold text-amber-900 text-xs mb-0.5">Kunci Jawaban & Pembahasan Dirahasiakan</p>
                        <p class="text-[11px] text-amber-700 leading-normal mb-0">Pusat Asesmen Pendidikan Kementerian Pendidikan Dasar dan Menengah tidak merilis kunci jawaban dan pembahasan resmi untuk butir soal mata pelajaran ini guna menjaga kerahasiaan dan integritas bank soal ujian Nasional.</p>
                    </div>
                </div>
            `;
            modalExplanationSection.classList.remove('hidden');
            
            // Render the AI solver helper box beneath it
            renderAiSolverUi(kdMapel, questionData);
        }

    } catch (err) {
        modalQuestionHtml.innerHTML = `<p style="color:var(--danger); text-align:center;">${err.message || "Gagal memuat soal."}</p>`;
    }
}

// Render dynamic AI Solver GUI card
function renderAiSolverUi(kdMapel, questionData) {
    const container = document.getElementById('modal-ai-solver-container');
    if (!container) return;
    
    const key = localStorage.getItem('gemini_api_key');
    
    container.innerHTML = `
        <div class="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col gap-4 mt-4 shadow-sm" id="ai-card-wrapper">
            <div class="flex items-start gap-3">
                <span class="text-xl">✨</span>
                <div>
                    <h4 class="font-bold text-blue-900 text-xs mb-1">Gunakan Gemini AI untuk Memecahkan Soal</h4>
                    <p class="text-[11px] text-blue-700 leading-normal">Hubungkan kunci API Gemini Anda untuk menganalisis soal, memverifikasi opsi jawaban, dan menulis pembahasan mendalam secara otomatis.</p>
                </div>
            </div>
            
            <div id="ai-key-input-box" class="${key ? 'hidden' : 'flex flex-col gap-2'}">
                <div class="flex gap-2">
                    <input type="password" id="input-gemini-key" placeholder="Masukkan Gemini API Key..." class="flex-grow px-3 py-2 rounded-lg text-xs border border-slate-200 focus:outline-none focus:border-blue-500">
                    <button id="btn-save-key" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-sm">Simpan</button>
                </div>
                <p class="text-[10px] text-slate-400">Belum punya key? <a href="https://aistudio.google.com/" target="_blank" class="text-blue-500 hover:underline font-semibold">Dapatkan API Key gratis di Google AI Studio</a>. Key disimpan aman di browser Anda.</p>
            </div>

            <div id="ai-action-box" class="${key ? 'flex items-center justify-between gap-4' : 'hidden'}">
                <button id="btn-solve-ai" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-2">
                    <span>🚀</span> Jalankan Analisis AI
                </button>
                <button id="btn-reset-key" class="text-slate-400 hover:text-slate-600 text-[10px] underline font-medium">Ganti API Key</button>
            </div>

            <div id="ai-loading-box" class="hidden flex items-center gap-3 py-2">
                <div class="spinner" style="width:20px; height:20px; border-width:2.5px; margin: 0;"></div>
                <span class="text-xs text-blue-800 font-medium animate-pulse">Gemini sedang memecahkan soal dan menyusun pembahasan...</span>
            </div>
        </div>
    `;

    // Wire up event listeners
    const btnSaveKey = container.querySelector('#btn-save-key');
    const btnResetKey = container.querySelector('#btn-reset-key');
    const btnSolveAi = container.querySelector('#btn-solve-ai');
    const inputKey = container.querySelector('#input-gemini-key');
    const keyInputBox = container.querySelector('#ai-key-input-box');
    const actionBox = container.querySelector('#ai-action-box');
    const loadingBox = container.querySelector('#ai-loading-box');

    if (btnSaveKey) {
        btnSaveKey.addEventListener('click', () => {
            const val = inputKey.value.trim();
            if (!val) return alert("API Key tidak boleh kosong!");
            localStorage.setItem('gemini_api_key', val);
            keyInputBox.classList.add('hidden');
            actionBox.classList.remove('hidden');
            actionBox.className = 'flex items-center justify-between gap-4';
        });
    }

    if (btnResetKey) {
        btnResetKey.addEventListener('click', () => {
            localStorage.removeItem('gemini_api_key');
            inputKey.value = '';
            actionBox.classList.add('hidden');
            keyInputBox.classList.remove('hidden');
            keyInputBox.className = 'flex flex-col gap-2';
        });
    }

    if (btnSolveAi) {
        btnSolveAi.addEventListener('click', async () => {
            const activeKey = localStorage.getItem('gemini_api_key');
            if (!activeKey) return;

            actionBox.classList.add('hidden');
            loadingBox.classList.remove('hidden');

            try {
                const solution = await callGeminiSolver(activeKey, kdMapel, questionData);
                
                // 1. Update the explanation panel HTML with AI result
                const explanationHtml = document.getElementById('modal-explanation-html');
                explanationHtml.innerHTML = `
                    <div class="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mb-4">
                        <div class="flex items-center justify-between gap-3 border-b border-blue-100 pb-3 mb-4">
                            <span class="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm">
                                <span>✨</span> HASIL ANALISIS GEMINI AI
                            </span>
                            <span class="text-xs text-blue-700 font-bold">Kunci Jawaban: <span class="bg-blue-600 text-white rounded-md w-6 h-6 inline-flex items-center justify-center font-bold ml-1">${solution.kunci_jawaban}</span></span>
                        </div>
                        <div class="text-slate-700 text-sm leading-relaxed">${solution.pembahasan}</div>
                    </div>
                `;

                // 2. Highlight the correct choice in option list green!
                const optionsList = document.getElementById('modal-options-list');
                const optionItems = optionsList.querySelectorAll('.option-item');
                optionItems.forEach(item => {
                    item.classList.remove('correct'); // Reset first
                    const badge = item.querySelector('.option-badge');
                    if (badge && badge.textContent.trim() === solution.kunci_jawaban) {
                        item.classList.add('correct');
                        
                        // Scroll to the correct choice to highlight it
                        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });

                // 3. Update subtitle badge
                const subtitle = document.getElementById('modal-subtitle');
                subtitle.innerHTML = `${subtitle.textContent.split('🔒')[0]} <span class="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-bold px-2 py-0.5 rounded-md ml-2 inline-block">✨ Kunci Ditemukan oleh AI</span>`;

                // 4. Remove/hide the AI card as it succeeded
                container.innerHTML = `
                    <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3 mt-4">
                        <span class="text-lg">✅</span>
                        <div class="flex-grow flex items-center justify-between">
                            <span class="text-xs text-emerald-800 font-semibold">Analisis Soal Berhasil Digenerate menggunakan Gemini AI!</span>
                            <button id="btn-reset-solution" class="text-slate-400 hover:text-slate-600 text-[10px] underline font-medium">Reset Analisis</button>
                        </div>
                    </div>
                `;
                
                container.querySelector('#btn-reset-solution').addEventListener('click', () => {
                    // Re-render modal to initial state
                    openQuestionModal(kdMapel, questionData.nomor_soal);
                });

            } catch (err) {
                console.error("AI Solver Error:", err);
                loadingBox.classList.add('hidden');
                actionBox.classList.remove('hidden');
                alert("Gagal memanggil Gemini AI: " + err.message + "\n\nPastikan API Key Anda valid dan memiliki kuota.");
            }
        });
    }
}

// Call Google Gemini API using structured JSON output configurations
async function callGeminiSolver(apiKey, kdMapel, questionData) {
    const choices = questionData.pilihan || [];
    const promptText = `
Anda adalah asisten AI pendidik profesional yang ahli dalam memecahkan soal ujian Tes Kompetensi Akademik (TKA) Nasional Kemendikdasmen.
Tolong pecahkan soal pilihan ganda di bawah ini, tentukan kunci jawaban yang benar (A, B, C, D, atau E), dan susun penjelasan/pembahasan langkah demi langkah yang logis dan mudah dipahami dalam Bahasa Indonesia.

Mata Pelajaran: ${kdMapel}
Pertanyaan Soal:
${questionData.pertanyaan}

Pilihan Ganda:
${choices.map(c => `${c.key}. ${c.text}`).join('\n')}

Format output harus berupa JSON dengan struktur persis seperti berikut:
{
  "kunci_jawaban": "SATU KARAKTER HURUF KAPITAL SAJA (A/B/C/D/E)",
  "pembahasan": "Tulis penjelasan detail dalam format HTML bersih. Gunakan tag paragraph (<p>), cetak tebal (<strong>), daftar (<ul>, <li>), dan baris baru (<br>) agar rapi saat dirender di web."
}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{
                text: promptText
            }]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    kunci_jawaban: { 
                        type: "STRING", 
                        description: "Kunci jawaban yang benar, harus berupa satu karakter kapital (A, B, C, D, atau E)" 
                    },
                    pembahasan: { 
                        type: "STRING", 
                        description: "Penjelasan detail dan langkah-langkah pembahasan soal dalam bahasa Indonesia menggunakan format HTML sederhana" 
                    }
                },
                required: ["kunci_jawaban", "pembahasan"]
            }
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || `HTTP Error ${response.status} ${response.statusText}`);
    }

    const resJson = await response.json();
    const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
        throw new Error("Respon kosong dari model Gemini.");
    }

    const result = JSON.parse(responseText);
    
    // Normalize correct answer
    result.kunci_jawaban = (result.kunci_jawaban || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D', 'E'].includes(result.kunci_jawaban)) {
        throw new Error(`Kunci jawaban yang digenerate AI tidak valid: ${result.kunci_jawaban}`);
    }

    return result;
}

// Simple heuristic to check if option is correct from explanation text
function isOptionCorrect(key, explanationHtml) {
    if (!explanationHtml) return false;
    const text = explanationHtml.replace(/<[^>]*>/g, '').toUpperCase();
    const patterns = [
        new RegExp(`PILIHAN\\s+JAWABAN\\s+${key}\\s+TEPAT`),
        new RegExp(`JAWABAN\\s+${key}\\s+TEPAT`),
        new RegExp(`KUNCI\\s+JAWABAN\\s+${key}`),
        new RegExp(`JAWABAN\\s+YANG\\s+BENAR\\s+${key}`),
        new RegExp(`JAWABAN\\s+YANG\\s+BENAR\\s+ADALAH\\s+${key}`),
        new RegExp(`\\b${key}\\s+TEPAT\\b`),
        new RegExp(`\\bJAWABAN\\s*:\\s*${key}\\b`),
    ];
    return patterns.some(p => p.test(text));
}

// Close Modal
function closeModal() {
    modalQuestion.classList.add('hidden');
}

// Generic function to trigger bank soal export with a loading progress bar
async function triggerExport(format) {
    const overlay = document.getElementById('scrape-progress-overlay');
    const fill = document.getElementById('scrape-progress-fill');
    const text = document.getElementById('scrape-progress-text');
    
    try {
        // 1. Check status from server
        const res = await fetch('/api/download/status');
        const status = await res.json();
        
        if (status.cached) {
            // If already cached, start download directly
            startDownloadAction(format);
            return;
        }
        
        // If not cached, show progress overlay and start polling
        if (overlay) overlay.classList.remove('hidden');
        if (fill) fill.style.width = status.progress + '%';
        if (text) text.textContent = status.progress + '%';
        
        const pollInterval = setInterval(async () => {
            try {
                const pollRes = await fetch('/api/download/status');
                const pollStatus = await pollRes.json();
                
                if (fill) fill.style.width = pollStatus.progress + '%';
                if (text) text.textContent = pollStatus.progress + '%';
                
                if (pollStatus.cached || pollStatus.progress >= 100) {
                    clearInterval(pollInterval);
                    if (overlay) overlay.classList.add('hidden');
                    // Start download
                    startDownloadAction(format);
                }
            } catch (pollErr) {
                console.error("Polling error:", pollErr);
                clearInterval(pollInterval);
                if (overlay) overlay.classList.add('hidden');
                alert("Koneksi terputus saat mengunduh bank soal.");
            }
        }, 1000);
        
    } catch (err) {
        console.error("Export trigger error:", err);
        alert("Gagal memulai proses ekspor: " + err.message);
    }
}

// Redirects or opens a tab depending on the target format
function startDownloadAction(format) {
    if (format === 'txt') {
        window.location.href = '/api/download/txt';
    } else if (format === 'doc') {
        window.location.href = '/api/download/doc';
    } else if (format === 'pdf') {
        window.open('/print/bank-soal', '_blank');
    }
}

// Helper for score hex colors
function getScoreColorHex(value) {
    if (value >= 60) return '#059669'; // Green
    if (value >= 40) return '#d97706'; // Orange
    return '#dc2626'; // Red
}

// Fetch and render School Rankings for Kabupaten Badung
async function loadPeringkatData(kdMapelParam = null) {
    console.log('[Peringkat] loadPeringkatData called, kdMapelParam:', kdMapelParam);
    
    const pView = document.getElementById('peringkat-view');
    const pContainer = document.getElementById('peringkat-table-container');
    const pLoading = document.getElementById('peringkat-loading');
    const pTableBody = document.getElementById('peringkat-table-body');
    const pSelectMapel = document.getElementById('peringkat-select-mapel') || selectMapel;
    const pHeaderTitle = document.getElementById('peringkat-header-title');
    const pTargetBadge = document.getElementById('peringkat-target-badge');
    const pTargetScore = document.getElementById('peringkat-target-score');

    // Explicitly unhide peringkatView container immediately
    if (pView) {
        pView.classList.remove('hidden');
        pView.style.display = 'block';
        pView.style.visibility = 'visible';
    }
    if (pContainer) {
        pContainer.classList.remove('hidden');
        pContainer.style.display = 'block';
        pContainer.style.visibility = 'visible';
    }

    // Ensure mapelList options exist in pSelectMapel
    if (mapelList.length > 0 && pSelectMapel && (pSelectMapel.children.length === 0 || pSelectMapel.children.length < mapelList.length)) {
        const curVal = pSelectMapel.value || localStorage.getItem('selected_kd_mapel');
        pSelectMapel.innerHTML = '';
        mapelList.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.kd_mapel;
            opt.textContent = m.mapel;
            if (curVal && m.kd_mapel === curVal) opt.selected = true;
            pSelectMapel.appendChild(opt);
        });
    }

    let selectedKdMapel = kdMapelParam || (pSelectMapel ? pSelectMapel.value : null) || (selectMapel ? selectMapel.value : null) || (mapelList[0] ? mapelList[0].kd_mapel : 'ABINW');
    if (!selectedKdMapel || selectedKdMapel === 'undefined' || selectedKdMapel === 'null' || selectedKdMapel.trim() === '') {
        selectedKdMapel = (mapelList[0] ? mapelList[0].kd_mapel : 'ABINW');
    }
    if (pSelectMapel && selectedKdMapel) pSelectMapel.value = selectedKdMapel;
    if (selectMapel && selectedKdMapel) selectMapel.value = selectedKdMapel;
    console.log('[Peringkat] selectedKdMapel:', selectedKdMapel);

    try {
        const apiUrl = `/api/peringkat-sekolah?kd_mapel=${selectedKdMapel}&kd_prop=${SMAN_PROP}&kd_rayon=${SMAN_RAYON}`;
        console.log('[Peringkat] Fetching:', apiUrl);
        const response = await fetch(apiUrl);
        const result = await response.json();
        console.log('[Peringkat] API result: success=', result.success, 'rankings=', result.rankings?.length);

        if (!result.success) {
            throw new Error(result.message || 'Gagal memuat data peringkat sekolah');
        }

        currentPeringkatData = result;
        if (pHeaderTitle) pHeaderTitle.textContent = `Peringkat Sekolah - ${result.nama_rayon}`;

        // Target school badge update
        if (result.target_school) {
            if (pTargetBadge) pTargetBadge.innerHTML = `#${result.target_school.rank} <span class="text-xs text-white/80 font-normal">dari ${result.total_sekolah}</span>`;
            if (pTargetScore) pTargetScore.textContent = `Rerata: ${result.target_school.avg.toFixed(2)}%`;
        } else {
            if (pTargetBadge) pTargetBadge.innerHTML = `- <span class="text-xs text-white/80 font-normal">dari ${result.total_sekolah}</span>`;
            if (pTargetScore) pTargetScore.textContent = 'Rerata: -%';
        }

        console.log('[Peringkat] Calling renderPeringkatTable...');
        renderPeringkatTable();
        if (pLoading) {
            pLoading.classList.add('hidden');
            pLoading.style.display = 'none';
        }

    } catch (err) {
        console.error('[Peringkat] Error:', err);
        if (pTableBody) {
            pTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500 font-bold text-xs">Gagal memuat peringkat: ${err.message}</td></tr>`;
        }
        if (pLoading) {
            pLoading.classList.add('hidden');
            pLoading.style.display = 'none';
        }
    }
}

// Render the rankings table with filters (Status & Search)
function renderPeringkatTable() {
    const tbody = document.getElementById('peringkat-table-body');
    const pView = document.getElementById('peringkat-view');
    const pContainer = document.getElementById('peringkat-table-container');
    const pSelectStatus = document.getElementById('peringkat-select-status');
    const pSearch = document.getElementById('peringkat-search');

    if (pView) {
        pView.classList.remove('hidden');
        pView.style.display = 'block';
        pView.style.visibility = 'visible';
    }
    if (pContainer) {
        pContainer.classList.remove('hidden');
        pContainer.style.display = 'block';
        pContainer.style.visibility = 'visible';
    }

    console.log('[Peringkat] renderPeringkatTable called, currentPeringkatData:', !!currentPeringkatData, 'tbody:', !!tbody);
    if (!currentPeringkatData || !tbody) {
        console.error('[Peringkat] Cannot render: missing currentPeringkatData or tbody');
        return;
    } 

    const statusFilter = pSelectStatus ? pSelectStatus.value : 'all';
    const searchQuery = pSearch ? pSearch.value.trim().toLowerCase() : '';

    let list = currentPeringkatData.rankings || [];

    // Filter status (All, Negeri, Swasta)
    if (statusFilter === 'N' || statusFilter === 'S') {
        list = list.filter(s => s.sts_sek === statusFilter);
    }

    // Filter search query
    if (searchQuery) {
        list = list.filter(s => s.name.toLowerCase().includes(searchQuery) || s.npsn.includes(searchQuery));
    }

    const countBadge = document.getElementById('peringkat-count-badge');
    if (countBadge) countBadge.textContent = `${list.length} Sekolah`;

    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 font-semibold text-xs">Tidak ada sekolah yang cocok dengan penyaring.</td></tr>`;
        return;
    }

    list.forEach((school) => {
        const tr = document.createElement('tr');
        
        let rankBadgeHTML = '';
        if (school.rank === 1) {
            rankBadgeHTML = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-black text-sm shadow-sm border border-amber-300" style="background-color:#fef3c7;color:#b45309;border-color:#fcd34d">🥇 1</span>`;
        } else if (school.rank === 2) {
            rankBadgeHTML = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-black text-sm shadow-sm border border-slate-300" style="background-color:#e2e8f0;color:#334155;border-color:#cbd5e1">🥈 2</span>`;
        } else if (school.rank === 3) {
            rankBadgeHTML = `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-800 font-black text-sm shadow-sm border border-orange-300" style="background-color:#ffedd5;color:#9a3412;border-color:#fdba74">🥉 3</span>`;
        } else {
            rankBadgeHTML = `<span class="font-bold text-slate-500 text-xs" style="color:#64748b;font-weight:700">#${school.rank}</span>`;
        }

        const isTarget = school.isTarget;
        if (isTarget) {
            tr.className = "bg-blue-50/90 border-l-4 border-l-blue-600 hover:bg-blue-100/90 transition-all font-semibold";
            tr.style.backgroundColor = "rgba(239, 246, 255, 0.9)";
            tr.style.borderLeft = "4px solid #2563eb";
        } else {
            tr.className = "hover:bg-slate-50 transition-all";
        }

        const statusBadge = school.sts_sek === 'N' 
            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-700" style="background-color:#dbeafe;color:#1d4ed8;font-weight:800">NEGERI</span>`
            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600" style="background-color:#f1f5f9;color:#475569;font-weight:800">SWASTA</span>`;

        const colorHex = getScoreColorHex(school.avg);
        const scoreColorClass = getColorClass(school.avg);

        tr.innerHTML = `
            <td class="text-center py-3.5 px-4 whitespace-nowrap text-slate-700" style="color:#334155">${rankBadgeHTML}</td>
            <td class="py-3.5 px-4">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-xs ${isTarget ? 'text-blue-900 font-extrabold text-sm' : 'text-slate-800'}" style="color:${isTarget ? '#1e3a8a' : '#1e293b'};font-weight:${isTarget ? '800' : '700'}">${school.name}</span>
                    ${isTarget ? `<span class="bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm" style="background-color:#2563eb;color:#ffffff;font-weight:900">Sekolah Target</span>` : ''}
                </div>
            </td>
            <td class="text-center py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap" style="color:#64748b">${school.npsn || '-'}</td>
            <td class="text-center py-3.5 px-4 whitespace-nowrap">${statusBadge}</td>
            <td class="text-right py-3.5 px-4 font-black text-sm whitespace-nowrap ${scoreColorClass}" style="color:${colorHex};font-weight:900">${school.avg.toFixed(2)}%</td>
            <td class="py-3.5 px-4">
                <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200" style="background-color:#f1f5f9;border:1px solid #e2e8f0;height:10px;border-radius:9999px">
                    <div class="${getColorClass(school.avg, 'bg')} h-full rounded-full transition-all duration-500" style="background-color:${colorHex};width:${Math.min(100, Math.max(0, school.avg))}%;height:100%;border-radius:9999px"></div>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// ==========================================
// ANALISIS BUTIR SOAL LOGIC & RENDERING
// ==========================================

let questionsCacheData = null;

async function getOrFetchQuestionsCache() {
    if (questionsCacheData && Object.keys(questionsCacheData).length > 0) return questionsCacheData;
    // 1. Try fetching directly from SQLite database API endpoint
    try {
        const res = await fetch('/api/questions-all');
        if (res.ok) {
            const data = await res.json();
            if (data && Object.keys(data).length > 0) {
                questionsCacheData = data;
                return questionsCacheData;
            }
        }
    } catch (err) {
        console.warn('[Analisis Soal] Cannot fetch from /api/questions-all:', err.message);
    }
    // 2. Fallback to static questions_cache.json
    try {
        const res = await fetch('/questions_cache.json');
        if (res.ok) {
            questionsCacheData = await res.json();
            return questionsCacheData;
        }
    } catch (err) {
        console.warn('[Analisis Soal] Cannot fetch questions_cache.json:', err.message);
    }
    return {};
}

let rawAnalisisSoalData = null;
let activeAnalisisSoalKdMapel = '';

async function loadAnalisisSoalData(targetKdMapel = null) {
    const elSelect = document.getElementById('analisis-soal-select-mapel');
    const globalSelect = document.getElementById('select-mapel');
    const kdMapel = targetKdMapel || (elSelect ? elSelect.value : null) || (globalSelect ? globalSelect.value : null) || 'ABINW';
    
    activeAnalisisSoalKdMapel = kdMapel;
    if (elSelect && elSelect.value !== kdMapel) {
        elSelect.value = kdMapel;
    }

    const container = document.getElementById('analisis-soal-cards-container');
    if (container) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div class="spinner border-2 w-8 h-8 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-slate-500 font-semibold text-sm">Memuat data analisis butir soal...</p>
            </div>
        `;
    }

    try {
        const [dsRes, qCache] = await Promise.all([
            fetch(`/api/daya-serap?kd_mapel=${kdMapel}&kd_prop=${SMAN_PROP}&kd_rayon=${SMAN_RAYON}&kd_sek=${SMAN_SEK}`),
            getOrFetchQuestionsCache()
        ]);

        const dsJson = await dsRes.json();
        if ((dsJson.status_code && dsJson.status_code !== 200) || (!dsJson.data && !dsJson.success)) {
            throw new Error(dsJson.message || "Gagal mengambil data daya serap dari server");
        }

        const data = dsJson.data;
        const comparison = data.comparison || {};
        const hierarchy = data.detail_hierarchy || data.hierarchy || [];
        const elemenSummary = data.elemen_summary || [];

        // Build question lookup map from questionsCache
        const subjObj = qCache[kdMapel] || {};
        const questionsList = subjObj.questions || [];
        const questionsMap = {};
        questionsList.forEach(q => {
            if (q && q.urutan) questionsMap[q.urutan] = q;
        });

        // Flatten indicators from hierarchy to map urutan -> competency meta
        const indicatorMetaMap = {};
        hierarchy.forEach(el => {
            (el.subelemen_list || []).forEach(sub => {
                const indList = extractIndicators(sub);
                indList.forEach(ind => {
                    if (ind && ind.urutan) {
                        indicatorMetaMap[ind.urutan] = {
                            elemen: el.elemen || '',
                            subelemen: sub.subelemen || '',
                            indikator: ind.indikator ? ind.indikator.replace(/\s*\(\d+\)\s*$/, '') : '',
                            nilai: ind.nilai || 0
                        };
                    }
                });
            });
        });

        rawAnalisisSoalData = {
            kdMapel,
            comparison,
            hierarchy,
            elemenSummary,
            questionsMap,
            indicatorMetaMap
        };

        renderAnalisisSoalView();

    } catch (err) {
        console.error("Error loading analisis soal:", err);
        if (container) {
            container.innerHTML = `
                <div class="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center shadow-sm">
                    <p class="font-bold text-sm mb-1">⚠️ Gagal Memuat Analisis Soal</p>
                    <p class="text-xs text-rose-600 mb-4">${err.message || "Terjadi kesalahan saat menghubungi server."}</p>
                    <button class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all" onclick="loadAnalisisSoalData('${kdMapel}')">Coba Lagi</button>
                </div>
            `;
        }
    }
}

function renderAnalisisSoalView() {
    if (!rawAnalisisSoalData) return;

    const { kdMapel, comparison, questionsMap, indicatorMetaMap } = rawAnalisisSoalData;
    const container = document.getElementById('analisis-soal-cards-container');
    if (!container) return;

    const sekUrutan = comparison.sekolah?.urutan || {};
    const nasUrutan = comparison.nasional?.urutan || {};
    const kabUrutan = comparison.kabupaten?.urutan || {};
    const provUrutan = comparison.provinsi?.urutan || {};

    // Collect list of all questions (urutan 1..30)
    const allItems = [];
    for (let u = 1; u <= 30; u++) {
        const sekScore = sekUrutan[u] !== undefined ? sekUrutan[u] : 0;
        const nasScore = nasUrutan[u] !== undefined ? nasUrutan[u] : 0;
        const kabScore = kabUrutan[u] !== undefined ? kabUrutan[u] : 0;
        const provScore = provUrutan[u] !== undefined ? provUrutan[u] : 0;
        const gapNas = sekScore - nasScore;
        const qData = questionsMap[u] || null;
        const meta = indicatorMetaMap[u] || {};

        let category = 'medium';
        if (sekScore < 40) category = 'difficult';
        else if (sekScore >= 70) category = 'easy';

        const isSecretKey = !qData || !qData.pembahasan || qData.pembahasan.trim() === '' || qData.pembahasan === '<p>&nbsp;</p>';

        allItems.push({
            urutan: u,
            sekScore,
            nasScore,
            kabScore,
            provScore,
            gapNas,
            category,
            isSecretKey,
            qData,
            meta
        });
    }

    // 1. Calculate Summary Stats
    const totalCount = allItems.length;
    const hardCount = allItems.filter(i => i.category === 'difficult').length;
    const midCount = allItems.filter(i => i.category === 'medium').length;
    const easyCount = allItems.filter(i => i.category === 'easy').length;

    const avgSek = comparison.sekolah?.avg || (allItems.reduce((a, b) => a + b.sekScore, 0) / (totalCount || 1));
    const avgNas = comparison.nasional?.avg || (allItems.reduce((a, b) => a + b.nasScore, 0) / (totalCount || 1));
    const avgNasGap = avgSek - avgNas;

    // Update KPI UI
    const elAvg = document.getElementById('as-stat-avg');
    const elNasGap = document.getElementById('as-stat-nas-gap');
    const elTotal = document.getElementById('as-stat-total-soal');
    const elHardCount = document.getElementById('as-stat-hard-count');
    const elMidCount = document.getElementById('as-stat-mid-count');
    const elEasyCount = document.getElementById('as-stat-easy-count');

    if (elAvg) elAvg.textContent = `${avgSek.toFixed(2)}%`;
    if (elNasGap) {
        const sign = avgNasGap >= 0 ? '+' : '';
        elNasGap.textContent = `${sign}${avgNasGap.toFixed(2)}% vs Nas`;
        elNasGap.className = `text-xs font-bold ${avgNasGap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
    }
    if (elTotal) elTotal.textContent = `${totalCount} Butir Soal`;
    if (elHardCount) elHardCount.textContent = `${hardCount} Soal`;
    if (elMidCount) elMidCount.textContent = `${midCount} Soal`;
    if (elEasyCount) elEasyCount.textContent = `${easyCount} Soal`;

    // 2. Weak Points Alert Banner
    const weakBanner = document.getElementById('as-weak-banner');
    const weakChips = document.getElementById('as-weak-chips');
    const weakText = document.getElementById('as-weak-summary-text');

    const lowestItems = [...allItems].sort((a, b) => a.sekScore - b.sekScore).slice(0, 3);
    if (lowestItems.length > 0 && lowestItems[0].sekScore < 50) {
        if (weakBanner) weakBanner.classList.remove('hidden');
        if (weakChips) {
            weakChips.innerHTML = '';
            lowestItems.forEach(item => {
                const chip = document.createElement('button');
                chip.className = "bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer";
                chip.innerHTML = `<span>Soal #${item.urutan}</span> <span class="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-md">${item.sekScore.toFixed(1)}%</span>`;
                chip.onclick = () => openQuestionModal(kdMapel, item.urutan);
                weakChips.appendChild(chip);
            });
        }
        if (weakText) {
            weakText.textContent = `Ditemukan ${hardCount > 0 ? hardCount : lowestItems.length} butir soal dengan persentase daya serap terendah di SMAN 2 Mengwi. Disarankan memberikan sesi pengayaan khusus pada nomor soal berikut:`;
        }
    } else {
        if (weakBanner) weakBanner.classList.add('hidden');
    }

    // 3. Filter & Sort & Search Logic
    const searchTerm = (document.getElementById('analisis-soal-search')?.value || '').toLowerCase().trim();
    const filterCat = document.getElementById('analisis-soal-filter')?.value || 'all';
    const sortBy = document.getElementById('analisis-soal-sort')?.value || 'urutan_asc';

    let filtered = allItems.filter(item => {
        // Filter by category
        if (filterCat === 'difficult' && item.category !== 'difficult') return false;
        if (filterCat === 'medium' && item.category !== 'medium') return false;
        if (filterCat === 'easy' && item.category !== 'easy') return false;
        if (filterCat === 'hidden_key' && !item.isSecretKey) return false;

        // Search term
        if (searchTerm) {
            const numMatch = item.urutan.toString() === searchTerm || `soal ${item.urutan}`.includes(searchTerm) || `#${item.urutan}`.includes(searchTerm);
            const indMatch = (item.meta.indikator || '').toLowerCase().includes(searchTerm);
            const subMatch = (item.meta.subelemen || '').toLowerCase().includes(searchTerm);
            const elMatch = (item.meta.elemen || '').toLowerCase().includes(searchTerm);
            const textMatch = item.qData ? (item.qData.pertanyaan || '').toLowerCase().includes(searchTerm) : false;
            return numMatch || indMatch || subMatch || elMatch || textMatch;
        }

        return true;
    });

    // Sorting
    if (sortBy === 'score_asc') {
        filtered.sort((a, b) => a.sekScore - b.sekScore);
    } else if (sortBy === 'score_desc') {
        filtered.sort((a, b) => b.sekScore - a.sekScore);
    } else if (sortBy === 'gap_desc') {
        filtered.sort((a, b) => a.gapNas - b.gapNas); // Most negative gap first
    } else {
        filtered.sort((a, b) => a.urutan - b.urutan);
    }

    // 4. Render Cards
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <span class="text-4xl block mb-3">🔍</span>
                <p class="text-slate-700 font-bold text-base mb-1">Tidak Ada Soal Ditemukan</p>
                <p class="text-slate-400 text-xs">Coba sesuaikan kata kunci pencarian atau filter kategori yang dipilih.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4";

        let diffBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        let diffLabel = `🟢 Menguasai (${item.sekScore.toFixed(1)}%)`;
        if (item.category === 'difficult') {
            diffBadgeClass = "bg-rose-50 text-rose-700 border-rose-200";
            diffLabel = `🔴 Perlu Intervensi (${item.sekScore.toFixed(1)}%)`;
        } else if (item.category === 'medium') {
            diffBadgeClass = "bg-amber-50 text-amber-700 border-amber-200";
            diffLabel = `🟡 Kategori Sedang (${item.sekScore.toFixed(1)}%)`;
        }

        const gapSign = item.gapNas >= 0 ? '+' : '';
        const gapColor = item.gapNas >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100';

        // Question HTML & Answer Choices rendering
        let qBody = '<p class="text-slate-400 italic text-xs">Informasi butir soal belum tersedia di database.</p>';
        if (item.qData && item.qData.pertanyaan) {
            qBody = item.qData.pertanyaan;
        }

        const choices = item.qData ? (item.qData.pilihan || []) : [];
        let choicesHtml = '';
        if (choices.length > 0) {
            choicesHtml = `
                <div class="mt-4 pt-3 border-t border-slate-200/80 flex flex-col gap-2">
                    <p class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span>📝</span> Pilihan Jawaban:
                    </p>
                    <div class="grid grid-cols-1 gap-2">
                        ${choices.map(ch => {
                            const isCorrect = !item.isSecretKey && isOptionCorrect(ch.key, item.qData.pembahasan);
                            const choiceBadgeClass = isCorrect 
                                ? 'bg-emerald-600 text-white font-extrabold shadow-sm' 
                                : 'bg-slate-100 text-slate-700 font-bold border border-slate-200';
                            const choiceContainerClass = isCorrect
                                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-medium'
                                : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300';
                            return `
                                <div class="flex items-start gap-3 p-3 rounded-xl border text-xs md:text-sm leading-relaxed transition-all ${choiceContainerClass}">
                                    <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${choiceBadgeClass}">
                                        ${ch.key}
                                    </span>
                                    <div class="flex-grow pt-0.5">${ch.text}</div>
                                    ${isCorrect ? '<span class="text-[11px] text-emerald-700 font-extrabold flex-shrink-0 self-center bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md">✓ Kunci Jawaban</span>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        const elemenText = item.meta.elemen ? `Elemen: ${item.meta.elemen}` : '';
        const indText = item.meta.indikator || item.meta.subelemen || item.meta.elemen || 'Indikator tidak tersedia';

        card.innerHTML = `
            <!-- Card Header -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm flex-shrink-0">
                        ${item.urutan}
                    </span>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-800 text-sm">Soal #${item.urutan}</span>
                            ${elemenText ? `<span class="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-md hidden md:inline-block">${elemenText}</span>` : ''}
                        </div>
                        <p class="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">${indText}</p>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-extrabold px-3 py-1 rounded-xl border ${diffBadgeClass}">
                        ${diffLabel}
                    </span>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-xl border ${gapColor}">
                        ${gapSign}${item.gapNas.toFixed(1)}% vs Nas
                    </span>
                </div>
            </div>

            <!-- Daya Serap 4-Level Progress Bar Grid -->
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <span>🏫 SMAN 2 Mengwi</span>
                        <span class="text-slate-800 font-extrabold">${item.sekScore.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${item.sekScore < 40 ? 'bg-rose-500' : (item.sekScore < 70 ? 'bg-amber-500' : 'bg-emerald-500')}" style="width: ${Math.min(100, Math.max(0, item.sekScore))}%"></div>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <span>🏛️ Kab. Badung</span>
                        <span class="text-slate-700 font-bold">${item.kabScore.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500 rounded-full" style="width: ${Math.min(100, Math.max(0, item.kabScore))}%"></div>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <span>🌴 Prov. Bali</span>
                        <span class="text-slate-700 font-bold">${item.provScore.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 rounded-full" style="width: ${Math.min(100, Math.max(0, item.provScore))}%"></div>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <span>🇮🇩 Nasional</span>
                        <span class="text-slate-700 font-bold">${item.nasScore.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div class="h-full bg-slate-600 rounded-full" style="width: ${Math.min(100, Math.max(0, item.nasScore))}%"></div>
                    </div>
                </div>
            </div>

            <!-- Full Question & Answer Choices Box -->
            <div class="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 md:p-5 text-xs md:text-sm text-slate-800 leading-relaxed custom-question-card flex flex-col gap-2">
                <div class="font-medium text-slate-900 leading-normal">
                    ${qBody}
                </div>
                ${choicesHtml}
            </div>

            <!-- Card Footer & Actions -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div class="flex items-center gap-2">
                    ${item.isSecretKey ? 
                        `<span class="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            🔒 Kunci Dirahasiakan PAP • ✨ Gemini AI Ready
                        </span>` : 
                        `<span class="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            ✅ Pembahasan Resmi PAP Tersedia
                        </span>`
                    }
                </div>

                <div class="flex items-center gap-2 self-end sm:self-auto">
                    <button class="btn-open-soal bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm" data-urutan="${item.urutan}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        Buka & Analisis Soal
                    </button>
                </div>
            </div>
        `;

        const btnOpen = card.querySelector('.btn-open-soal');
        if (btnOpen) {
            btnOpen.addEventListener('click', () => {
                openQuestionModal(kdMapel, item.urutan);
            });
        }

        container.appendChild(card);
    });
}

// Start App
window.addEventListener('DOMContentLoaded', initializeApp);
