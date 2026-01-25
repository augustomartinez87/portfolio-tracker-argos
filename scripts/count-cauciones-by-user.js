// JS version: Count cauciones per user on localhost
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.LOCAL_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing localhost Supabase credentials.');
  process.exit(1);
}

if (!/localhost|127\.0\.0\.1/.test(SUPABASE_URL)) {
  console.warn('Refusing to run: Supabase URL may not be localhost. Aborting.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const { data, error } = await supabase.from('cauciones').select('id, user_id');
  if (error) {
    console.error('Error reading cauciones:', error);
    process.exit(1);
  }
  if (!data) {
    console.log('No cauciones found.');
    process.exit(0);
  }

  const counts = {};
  data.forEach(r => {
    const u = r.user_id || 'unknown';
    counts[u] = (counts[u] || 0) + 1;
  });

  console.log('Cauciones per user:');
  Object.entries(counts).forEach(([user, c]) => {
    console.log(` - ${user}: ${c}`);
  });
}

run().catch(e => {
  console.error('Failed to run count-cauciones-by-user.js:', e);
  process.exit(1);
});
