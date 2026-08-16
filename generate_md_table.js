const fs = require('fs');

const log = fs.readFileSync('./test_results.log', 'utf-16le');
const lines = log.split('\n');

let isTable = false;
let tableData = [];

for (const line of lines) {
    if (line.includes('┌─────────┬──────┬')) {
        isTable = true;
        continue;
    }
    if (line.includes('└─────────┴────┴')) {
        isTable = false;
        continue;
    }
    if (isTable && line.startsWith('│')) {
        const parts = line.split('│').map(p => p.trim()).slice(1, -1);
        if (parts[0] === '(index)') continue; // header
        if (parts.length > 0 && !parts[0].includes('─')) {
            tableData.push(parts);
        }
    }
}

let md = `| ID | Input | Expected | Actual Status | Triggered Gate | Message |\n|---|---|---|---|---|---|\n`;
for (const row of tableData) {
    // row: index, id, input, expected, actual_status, actual_gate, actual_message
    const id = row[1].replace(/'/g, '');
    const input = row[2].replace(/^'|^"|'$|"$/g, '');
    let expected = row[3].replace(/'/g, '');
    if (expected === 'flag') expected = 'needs_clarification';
    const actual_status = row[4].replace(/'/g, '');
    const actual_gate = row[5].replace(/'/g, '');
    const actual_message = row[6].replace(/^'|^"|'$|"$/g, '');
    
    md += `| ${id} | ${input} | ${expected} | **${actual_status}** | **${actual_gate}** | ${actual_message} |\n`;
}

fs.writeFileSync('md_table.md', md, 'utf-8');
console.log("Markdown table generated successfully.");
