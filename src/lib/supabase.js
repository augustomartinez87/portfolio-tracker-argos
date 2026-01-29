import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const originalSetItem = localStorage.setItem.bind(localStorage)
localStorage.setItem = function (key, value) {
  try {
    originalSetItem(key, value)
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('[LocalStorage] Quota exceeded, clearing non-essential caches...')
      
      // Priorizar: NO eliminar claves de autenticación
      const keysToRemove = Object.keys(localStorage).filter(key => 
        !key.includes('supabase') && 
        !key.includes('auth') && 
        !key.includes('sb-') &&
        (key.includes('data912') || key.includes('price_') || key.includes('hist_') || key.includes('portfolio-'))
      )
      
      console.log(`[LocalStorage] Removing ${keysToRemove.length} non-essential keys`)
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      try {
        originalSetItem(key, value)
        console.log('[LocalStorage] Successfully saved after cleanup')
      } catch (e2) {
        console.warn('[LocalStorage] Still full after cleanup, critical data may be lost')
      }
    }
  }
}

// Debug: Expose connection info (masked) to window
if (typeof window !== 'undefined') {
  window.__SUPABASE_DEBUG__ = {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyStart: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) : 'none'
  };

  // REMOVIDO: No eliminar locks de auth automáticamente
  // Esto causaba problemas de sincronización multi-pestaña
  // Los locks son necesarios para prevenir race conditions
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

if (typeof window !== 'undefined') {
  console.log('[Supabase] Cliente inicializado.');
}
