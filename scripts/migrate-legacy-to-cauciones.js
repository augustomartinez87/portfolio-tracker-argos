// Migration script: migrate legacy cauciones data into canonical cauciones table
// NOTE: This script targets a localhost Supabase instance. It detects local env vars and
// uses LOCAL_SUPABASE_URL / LOCAL_SUPABASE_ANON_KEY if provided; otherwise falls back to
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

// Prefer localhost-specific env vars if present
const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || process.env.LOCAL_SUPABASE_HOST || '';
const LOCAL_ANON = process.env.LOCAL_SUPABASE_ANON_KEY || process.env.LOCAL_SUPABASE_ANON || '';

const REMOTE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const REMOTE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const SUPABASE_URL = (LOCAL_URL && LOCAL_URL.length > 0) ? LOCAL_URL : REMOTE_URL;
const SUPABASE_ANON = (LOCAL_ANON && LOCAL_ANON.length > 0) ? LOCAL_ANON : REMOTE_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('WARNING: Supabase credentials not fully specified. Set LOCAL_SUPABASE_URL/ANON or VITE_SUPABASE_URL/ANON in .env.local to run locally. Aborting migration.');
  process.exit(0);
}

// Guard: avoid accidental production write. Only run if URL contains localhost
if (!/localhost|127\.0\.0\.1|localhost/.test(SUPABASE_URL)) {
  console.warn('Migration targeted URL does not appear to be localhost. Aborting to prevent accidental production data changes.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const DRY_RUN = (process.env.DRY_RUN === 'true');

async function migrateTable(tableName) {
  // Check if legacy table exists by attempting a small query
  let hasTable = true;
  try {
    const { data } = await supabase.from(tableName).select('id').limit(1);
    if (!data) hasTable = false;
  } catch {
    hasTable = false;
  }
  if (!hasTable) {
    console.log(`Legacy table not found: ${tableName} (skipping)`);
    return { migrated: 0, skipped: true };
  }

  console.log(`Reading legacy table: ${tableName}...`);
  const { data: rows, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`Error reading ${tableName}:`, error.message);
    return { migrated: 0, skipped: false };
  }
  if (!rows || rows.length === 0) {
    console.log(`No rows found in ${tableName}`);
    return { migrated: 0, skipped: false };
  }

  // Map legacy columns to cauciones schema
  const mapped = rows.map(r => ({
    user_id: r.user_id ?? r.userId ?? 'unknown',
    portfolio_id: r.portfolio_id ?? r.portfolioId ?? 'default',
    fecha_inicio: r.fecha_inicio ?? r.dateFrom ?? r.startDate ?? null,
    fecha_fin: r.fecha_fin ?? r.dateTo ?? r.endDate ?? null,
    capital: r.capital ?? 0,
    monto_devolver: r.monto_devolver ?? r.montoDevolver ?? 0,
    interes: r.interes ?? 0,
    dias: r.dias ?? 0,
    tna_real: r.tna_real ?? r.tna ?? 0,
    archivo: r.archivo ?? r.file ?? '',
  }));

  // Insert into cauciones (or dry-run)
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would insert ${mapped.length} rows into cauciones from ${tableName}`);
    return { migrated: mapped.length, skipped: false };
  }
  const { data: inserted, error: insertError } = await supabase.from('cauciones').insert(mapped).select();
  if (insertError) {
    console.error('Error inserting migrated rows into cauciones:', insertError.message);
    return { migrated: 0, skipped: false };
  }

  console.log(`Migrated ${inserted?.length ?? 0} rows from ${tableName} into cauciones.`);
  return { migrated: inserted?.length ?? 0, skipped: false };
}

async function main() {
  let totalMigrated = 0;
  const tables = ['legacy_cauciones', 'cauciones_legacy'];
  for (const t of tables) {
    const res = await migrateTable(t);
    if (res && res.migrated) totalMigrated += res.migrated;
  }

  console.log('\nMigration summary:');
  console.log(`Total migrated rows into cauciones: ${totalMigrated}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
