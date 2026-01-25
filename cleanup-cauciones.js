// ============================================================================
// CLEANUP SCRIPT - Emergency database cleanup for cauciones
// ============================================================================
// This script directly connects to Supabase and deletes all cauciones
// Use with: node cleanup-cauciones.js
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Supabase configuration from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔑 Variables cargadas:');
console.log('URL:', supabaseUrl);
console.log('Key presente:', supabaseKey ? 'SI' : 'NO');

console.log('🚨 INICIANDO LIMPIEZA DE BASE DE DATOS');
console.log('📍 URL:', supabaseUrl);
console.log('⏰ Hora:', new Date().toISOString());

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanAllCauciones() {
  try {
    console.log('🔍 Verificando datos existentes...');
    
    // Primero, contar cuántos registros hay
    const { data: existingData, error: countError } = await supabase
      .from('cauciones')
      .select('id', { count: 'exact', head: false });
    
    if (countError) {
      console.error('❌ Error contando registros:', countError);
      process.exit(1);
    }
    
    console.log(`📊 Se encontraron ${existingData.length} cauciones para eliminar`);
    
    if (existingData.length === 0) {
      console.log('✅ No hay cauciones para eliminar. Base de datos limpia.');
      process.exit(0);
    }
    
    console.log('🗑️  Eliminando todos los registros...');
    
    // Eliminar todos los registros (sin restricciones)
    const { error: deleteError, count } = await supabase
      .from('cauciones')
      .delete({ count: 'exact' })
      .neq('id', null); // Delete all
    
    if (deleteError) {
      console.error('❌ Error eliminando registros:', deleteError);
      process.exit(1);
    }
    
    console.log(`✅ LIMPIEZA COMPLETA: ${count} cauciones eliminadas`);
    
    // Verificar que no quedaron registros
    const { data: verifyData } = await supabase
      .from('cauciones')
      .select('id', { count: 'exact', head: false });
    
    if (verifyData.length === 0) {
      console.log('🎉 VERIFICACIÓN EXITOSA: Base de datos completamente limpia');
    } else {
      console.error(`❌ VERIFICACIÓN FALLIDA: Quedaron ${verifyData.length} registros`);
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

// Ejecutar limpieza
cleanAllCauciones().then(() => {
  console.log('🏁 Script finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en script:', error);
  process.exit(1);
});