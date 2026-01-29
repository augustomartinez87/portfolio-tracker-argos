/**
 * Script de diagnóstico para problemas de autenticación
 * Ejecutar desde la consola del navegador:
 *
 * import('/src/utils/debugAuth.js').then(m => m.debugAuth())
 *
 * O copiar y pegar el contenido de debugAuth() en la consola
 */

import { supabase } from '@/lib/supabase';

export async function debugAuth() {
  console.log('=== DEBUG AUTH ===\n');

  // 1. Verificar sesión actual
  console.log('1. Verificando sesión...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('❌ Error obteniendo sesión:', sessionError);
    return;
  }

  if (!session) {
    console.log('❌ No hay sesión activa. Necesitás loguearte primero.');
    return;
  }

  const user = session.user;
  console.log('✅ Usuario autenticado:');
  console.log('   - ID:', user.id);
  console.log('   - Email:', user.email);
  console.log('   - Created:', user.created_at);
  console.log('   - Last sign in:', user.last_sign_in_at);

  // 2. Verificar perfil en user_profiles
  console.log('\n2. Buscando perfil en user_profiles...');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError) {
    if (profileError.code === 'PGRST116') {
      console.log('❌ NO existe perfil para este usuario!');
      console.log('   Esto explica el timeout - el query retorna vacío.');
      console.log('\n   Solución: Crear perfil manualmente o ejecutar:');
      console.log('   debugCreateProfile()');
    } else {
      console.error('❌ Error buscando perfil:', profileError);
      console.log('   Código:', profileError.code);
      console.log('   Mensaje:', profileError.message);
      console.log('   Hint:', profileError.hint);
    }
  } else {
    console.log('✅ Perfil encontrado:');
    console.log('   - Profile ID:', profile.id);
    console.log('   - Role:', profile.role);
    console.log('   - Modules:', profile.modules);
    console.log('   - Is Active:', profile.is_active);
    console.log('   - Display Name:', profile.display_name);
    console.log('   - Created:', profile.created_at);
  }

  // 3. Verificar portfolios
  console.log('\n3. Buscando portfolios...');
  const { data: portfolios, error: portfoliosError } = await supabase
    .from('portfolios')
    .select('id, name, is_default, created_at')
    .eq('user_id', user.id);

  if (portfoliosError) {
    console.error('❌ Error buscando portfolios:', portfoliosError);
  } else if (!portfolios || portfolios.length === 0) {
    console.log('⚠️ No hay portfolios para este usuario');
  } else {
    console.log(`✅ Encontrados ${portfolios.length} portfolio(s):`);
    portfolios.forEach(p => {
      console.log(`   - ${p.name} (${p.id}) ${p.is_default ? '[DEFAULT]' : ''}`);
    });
  }

  // 4. Test de RLS timing
  console.log('\n4. Test de timing de queries...');

  const startProfile = performance.now();
  await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
  const timeProfile = performance.now() - startProfile;
  console.log(`   - Query user_profiles: ${timeProfile.toFixed(0)}ms`);

  const startPortfolios = performance.now();
  await supabase.from('portfolios').select('*').eq('user_id', user.id);
  const timePortfolios = performance.now() - startPortfolios;
  console.log(`   - Query portfolios: ${timePortfolios.toFixed(0)}ms`);

  if (timeProfile > 5000 || timePortfolios > 5000) {
    console.log('\n⚠️ Queries muy lentas! Posibles causas:');
    console.log('   - Problema de red/conexión a Supabase');
    console.log('   - RLS policies muy complejas');
    console.log('   - Supabase con alta carga');
  }

  console.log('\n=== FIN DEBUG ===');

  return { user, profile, portfolios };
}

export async function debugCreateProfile() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.log('❌ No hay sesión activa');
    return;
  }

  const user = session.user;
  console.log('Creando perfil para:', user.email);

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: user.id,
      role: 'user',
      display_name: user.email.split('@')[0],
      modules: ['portfolio', 'carryTrade'],
      is_active: true
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('⚠️ El perfil ya existe');
    } else {
      console.error('❌ Error creando perfil:', error);
    }
  } else {
    console.log('✅ Perfil creado:', data);
  }

  return data;
}

// Exponer funciones globalmente para uso en consola
if (typeof window !== 'undefined') {
  window.debugAuth = debugAuth;
  window.debugCreateProfile = debugCreateProfile;
}
