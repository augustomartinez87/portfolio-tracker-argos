import { supabase } from '../src/lib/supabase';

async function checkMepData() {
    const { count, error } = await supabase
        .from('mep_history')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error checking MEP data:', error);
    } else {
        console.log('Total rows in mep_history:', count);
    }
}

checkMepData();
