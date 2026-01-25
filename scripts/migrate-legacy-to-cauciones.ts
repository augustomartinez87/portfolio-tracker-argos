// Migration script: Migrate legacy cauciones data into canonical cauciones table
// NOTE: This script is a best-effort utility. It assumes a legacy table named
// `legacy_cauciones` or similar exists with compatible columns. If not found, it
// will gracefully skip.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  // Attempt to read legacy table
  const legacyCandidates = [
    'legacy_cauciones',
    'cauciones_legacy',
  ];

  for (const table of legacyCandidates) {
    // Check if table exists by attempting a small query
    let hasTable = true;
    try {
      const { data } = await supabase.from(table).select('id').limit(1);
      if (!data) hasTable = false;
    } catch {
      hasTable = false;
    }

    if (!hasTable) continue;

    console.log(`Migrating from legacy table: ${table}...`);
    const { data: legacyRows, error: legacyError } = await supabase.from(table).select('*');
    if (legacyError) {
      console.error('Error reading legacy table:', legacyError.message);
      continue;
    }
    if (!legacyRows || legacyRows.length === 0) {
      console.log('No rows to migrate from', table);
      continue;
    }

    // Transform legacy rows into cauciones schema
    const transformed = legacyRows.map((r: any) => ({
      user_id: r.user_id ?? r.userId ?? 'system',
      portfolio_id: r.portfolio_id ?? r.portfolioId ?? 'default',
      fecha_inicio: r.fecha_inicio ?? r.dateFrom ?? r.startDate ?? null,
      fecha_fin: r.fecha_fin ?? r.dateTo ?? r.endDate ?? null,
      capital: r.capital ?? 0,
      monto_devolver: r.monto_devolver ?? r.amountToReturn ?? 0,
      interes: (r.interes ?? 0),
      dias: r.dias ?? 0,
      tna_real: r.tna_real ?? r.tna ?? 0,
      archivo: r.archivo ?? r.file ?? '',
      // created_at preserved if exists
      created_at: r.created_at ?? undefined,
    }));

    // Insert transformed rows into cauciones
    const { data: inserted, error: insertError } = await supabase.from('cauciones').insert(transformed).select();
    if (insertError) {
      console.error('Error inserting transformed rows into cauciones:', insertError.message);
      continue;
    }
    console.log(`Migrated ${inserted?.length ?? 0} rows from ${table} to cauciones.`);
  }
}

migrate().then(() => {
  console.log('Migration finished.');
  process.exit(0);
}).catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
