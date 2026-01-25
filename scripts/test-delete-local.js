// Local sanity test: delete cauciones for a safe test user
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

const testUserId = 'LOCAL_TEST_USER';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  console.log('Attempting to delete cauciones for test user:', testUserId);
  const { data, count, error } = await supabase
    .from('cauciones')
    .delete({ count: 'exact' })
    .eq('user_id', testUserId);
  if (error) {
    console.error('Delete error:', error);
  } else {
    console.log('Deleted rows:', count);
  }
  console.log('Current cauciones count (after delete):');
  const { count: totalCount } = await supabase.from('cauciones').select('*', { count: 'exact' });
  console.log('Total cauciones:', totalCount);
}

run().catch(e => {
  console.error('test-delete-local.js failed:', e);
  process.exit(1);
});
