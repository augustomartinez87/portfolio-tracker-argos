// Count cauciones for a given user across all portfolios
// Usage: node scripts/count-cauciones.js <userId>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const userId = process.argv[2] || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countCauciones(user) {
  try {
    const { count, error } = await supabase
      .from('cauciones')
      .select('*', { count: 'exact' })
      .eq('user_id', user);
    if (error) throw error;
    console.log('Records in cauciones for user', user, ':', count);
  } catch (err) {
    console.error('Error counting cauciones:', err);
  }
}

countCauciones(userId);
