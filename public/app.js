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

// Locked SMAN 2 Mengwi Region Codes
const SMAN_PROP = "22";     // Bali
const SMAN_RAYON = "2209";   // Kab. Badung
const SMAN_SEK = "U22090017"; // SMA Negeri 2 Mengwi

// DOM Elements
const selectMapel = document.getElementById('select-mapel');

const stateLoading = document.getElementById('state-loading');
const stateError = document.getElementById('state-error');
const errorMessage = document.getElementById('error-message');
const mainDataLayout = document.getElementById('main-data-layout');

// Sidebar / View Elements
const navDashboard = document.getElementById('nav-dashboard');
const navSman2mengwi = document.getElementById('nav-sman2mengwi');
const dashboardView = document.getElementById('dashboard-view');
const sman2mengwiView = document.getElementById('sman2mengwi-view');

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

        // 1. Fetch Mapel
        const resMapel = await fetch('/api/mapel');
        const mapelJson = await resMapel.json();
        
        if (mapelJson.status_code !== 200 || !mapelJson.data) {
            throw new Error(mapelJson.message || "Gagal memuat mata pelajaran");
        }
        mapelList = mapelJson.data;

        // Populate Mapel Selector
        selectMapel.innerHTML = '';
        mapelList.forEach((m, idx) => {
            const option = document.createElement('option');
            option.value = m.kd_mapel;
            option.textContent = m.mapel;
            if (idx === 0) option.selected = true;
            selectMapel.appendChild(option);
        });

        // Add Event Listener for Mapel Filter
        selectMapel.addEventListener('change', loadDashboardData);

        // Sidebar Navigation Event Listeners
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('dashboard');
        });

        navSman2mengwi.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('sman2mengwi');
        });

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

        // Load First Data
        await loadDashboardData();

    } catch (err) {
        console.error("Initialization error:", err);
        errorMessage.textContent = err.message || "Koneksi ke server terputus.";
        setViewState('error');
    }
}

// Switch between Sidebar tabs
function switchTab(tabName) {
    navDashboard.classList.remove('active');
    navSman2mengwi.classList.remove('active');
    
    // Reset active background in sidebar
    navDashboard.className = "flex items-center gap-3 px-4 py-2.5 text-slate-500 no-underline rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap sidebar-link";
    navSman2mengwi.className = "flex items-center gap-3 px-4 py-2.5 text-slate-500 no-underline rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap sidebar-link";

    dashboardView.classList.add('hidden');
    sman2mengwiView.classList.add('hidden');

    if (tabName === 'dashboard') {
        navDashboard.classList.add('active');
        navDashboard.className += " active sidebar-link active";
        dashboardView.classList.remove('hidden');
    } else if (tabName === 'sman2mengwi') {
        navSman2mengwi.classList.add('active');
        navSman2mengwi.className += " active sidebar-link active";
        sman2mengwiView.classList.remove('hidden');
        if (smanSubjectDetailSection) smanSubjectDetailSection.classList.add('hidden'); // Hide detail by default
        loadSmanSummary();
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
}

// Load SMAN 2 Mengwi detailed subject analysis and indicator accordion
async function loadSmanSubjectDetail(kdMapel, mapelName) {
    if (!smanSubjectDetailSection) return;

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

        if (result.status_code !== 200 || !result.data || !result.data.contoh_soal || result.data.contoh_soal.length === 0) {
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

// Start App
window.addEventListener('DOMContentLoaded', initializeApp);
