const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
dom.window.eval(js);

// mock fetch
dom.window.fetch = async (url) => {
    if(url.includes('/api/mapel')) {
        return { json: async () => ({ status_code: 200, data: [{kd_mapel: 'ABINW', mapel: 'BIN'}] }) };
    }
    if(url.includes('/api/peringkat-sekolah')) {
        return { json: async () => ({ success: true, rankings: [{name: 'Sekolah A', avg: 50, rank: 1}], target_school: {rank: 1, avg: 50} }) };
    }
    return { json: async () => ({}) };
};

// set hash
dom.window.location.hash = '#peringkat';

// wait for initializeApp to finish
setTimeout(() => {
    const pView = dom.window.document.getElementById('peringkat-view');
    console.log("peringkat-view display:", pView.style.display);
    console.log("peringkat-view classes:", pView.className);
    const pTableBody = dom.window.document.getElementById('peringkat-table-body');
    console.log("table html:", pTableBody.innerHTML.trim());
}, 2000);
