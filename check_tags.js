const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

let stack = [];
let lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Simplistic tag extractor for div
    let pos = 0;
    while (pos < line.length) {
        let openIdx = line.indexOf('<div', pos);
        let closeIdx = line.indexOf('</div', pos);
        
        if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
            let endBracket = line.indexOf('>', openIdx);
            if (endBracket !== -1) {
                let tag = line.substring(openIdx, endBracket + 1);
                let idMatch = tag.match(/id="([^"]+)"/);
                stack.push(idMatch ? idMatch[1] : 'div');
                pos = endBracket + 1;
            } else {
                pos = openIdx + 4;
            }
        } else if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
            let popped = stack.pop();
            if (popped === 'dashboard-view' || popped === 'sman2mengwi-view' || popped === 'peringkat-view') {
                console.log(`Closed ${popped} at line ${i+1}`);
            }
            pos = closeIdx + 6;
        } else {
            break;
        }
    }
}
console.log("Remaining stack:", stack);
