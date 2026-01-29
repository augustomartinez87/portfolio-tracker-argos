import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const originalSetItem = localStorage.setItem.bind(localStorage)
localStorage.setItem = function (key, value) {
  try {
    originalSetItem(key, value)
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing price caches...')
      Object.keys(localStorage).forEach(key => {
        if (key.includes('data912') || key.includes('price_') || key.includes('hist_')) {
          localStorage.removeItem(key)
        }
      })
      try {
        originalSetItem(key, value)
      } catch (e2) {
        console.warn('localStorage still full, skipping save')
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

  // Limpieza preventiva de locks de pestañas que suelen causar cuelgues
  Object.keys(localStorage).forEach(key => {
    if (key.includes('-auth-token-lock')) {
      console.warn('[Supabase] Corregido: Detectado lock fantasma, eliminando...', key);
      localStorage.removeItem(key);
    }
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-portfolio-tracker-auth', // Llave única para evitar colisiones
    flowType: 'pkce'
  }
})

if (typeof window !== 'undefined') {
  console.log('[Supabase] Cliente inicializado.');
}
