// JS version: Count total cauciones across all users
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.LOCAL_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing localhost Supabase credentials.');
  process.exit(1);
}

// Guard localhost
if (!/localhost|127.0.0.1/.test(SUPABASE_URL)) {
  console.warn('Refusing to run: Supabase URL may not be localhost. Aborting.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const { data, error, count } = await supabase.from('cauciones').select('*', { count: 'exact' });
  if (error) {
    console.error('Error counting cauciones:', error);
    process.exit(1);
  }
  console.log('Total cauciones in table:', count || data?.length || 0);
}

run().catch(e => {
  console.error('Failed to run count-all-cauciones.js:', e);
  process.exit(1);
});
