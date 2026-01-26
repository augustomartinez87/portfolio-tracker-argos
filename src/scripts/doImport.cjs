const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Function to read .env.local manually
function getEnv() {
    const envPath = path.join(__dirname, '../../.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
    return env;
}

async function run() {
    const env = getEnv();
    const supabaseUrl = env['VITE_SUPABASE_URL'];
    const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials in .env.local');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const csvPath = 'C:\\Users\\Augusto\\Downloads\\MEP\\mep.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');

    const fechaIdx = headers.indexOf('fecha');
    const cierreIdx = headers.indexOf('cierre');

    console.log(`Headers found: fecha at ${fechaIdx}, cierre at ${cierreIdx}`);

    const dataToInsert = lines.slice(1)
        .map(line => {
            const cols = line.split(',');
            if (cols.length < headers.length) return null;

            const date = cols[fechaIdx].trim();
            const price = parseFloat(cols[cierreIdx]);

            if (!date || isNaN(price)) return null;

            return { date, price };
        })
        .filter(Boolean);

    console.log(`Total records to insert: ${dataToInsert.length}`);

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < dataToInsert.length; i += batchSize) {
        const batch = dataToInsert.slice(i, i + batchSize);
        const { error } = await supabase
            .from('mep_history')
            .upsert(batch, { onConflict: 'date' });

        if (error) {
            console.error(`Error in batch starting at ${i}:`, error);
        } else {
            process.stdout.write('.');
        }
    }

    console.log('\nImport completed!');
}

run().catch(console.error);
