const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

let stack = [];
let lines = html.split('\n');
for (let i = 733; i < 876; i++) { // from sman2mengwi-view to line 876
    const line = lines[i];
    
    let pos = 0;
    while (pos < line.length) {
        let openIdx = line.indexOf('<div', pos);
        let closeIdx = line.indexOf('</div', pos);
        
        if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
            let endBracket = line.indexOf('>', openIdx);
            let tag = endBracket !== -1 ? line.substring(openIdx, endBracket + 1) : '<div...>';
            let idMatch = tag.match(/id="([^"]+)"/);
            let classMatch = tag.match(/class="([^"]+)"/);
            let name = (idMatch ? `#${idMatch[1]}` : '') + (classMatch ? ` .${classMatch[1].split(' ')[0]}` : '');
            stack.push({ line: i+1, name: name || 'div' });
            pos = (endBracket !== -1) ? endBracket + 1 : openIdx + 4;
        } else if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
            let popped = stack.pop();
            // console.log(`Line ${i+1}: closed ${popped.name} from line ${popped.line}`);
            pos = closeIdx + 6;
        } else {
            break;
        }
    }
}
console.log("Remaining unclosed divs inside sman2mengwi-view:");
stack.forEach(s => console.log(`- Line ${s.line}: ${s.name}`));
