const fs = require('fs');
const path = require('path');

async function run() {
    const csvPath = 'C:\\Users\\Augusto\\Downloads\\MEP\\mep.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');

    const fechaIdx = headers.indexOf('fecha');
    const cierreIdx = headers.indexOf('cierre');

    const data = lines.slice(1)
        .map(line => {
            const cols = line.split(',');
            if (cols.length < headers.length) return null;

            const date = cols[fechaIdx].trim();
            const price = parseFloat(cols[cierreIdx]);

            if (!date || isNaN(price)) return null;

            return { date, price };
        })
        .filter(Boolean);

    const outPath = path.join(__dirname, '../data/mepHistory.json');
    if (!fs.existsSync(path.dirname(outPath))) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`Converted ${data.length} records to JSON at ${outPath}`);
}

run().catch(console.error);
