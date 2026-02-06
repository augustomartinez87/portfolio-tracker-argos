import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper para hacer queries directas con fetch (bypasea el cliente bloqueado)
export async function supabaseFetch(table, options = {}) {
  const { select = '*', eq, single, limit } = options

  // Obtener token de localStorage
  const storageKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`
  const tokenData = JSON.parse(localStorage.getItem(storageKey) || '{}')
  const accessToken = tokenData?.access_token

  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`

  if (eq) {
    Object.entries(eq).forEach(([key, value]) => {
      url += `&${key}=eq.${encodeURIComponent(value)}`
    })
  }

  if (limit) {
    url += `&limit=${limit}`
  }

  const headers = {
    'apikey': supabaseAnonKey,
    'Content-Type': 'application/json'
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json'
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw { code: response.status.toString(), message: error.message || error.error || 'Error', ...error }
  }

  const data = await response.json()
  return { data, error: null }
}

const originalSetItem = localStorage.setItem.bind(localStorage)
localStorage.setItem = function (key, value) {
  try {
    originalSetItem(key, value)
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Priorizar: NO eliminar claves de autenticación
      const keysToRemove = Object.keys(localStorage).filter(k =>
        !k.includes('supabase') &&
        !k.includes('auth') &&
        !k.includes('sb-') &&
        (k.includes('data912') || k.includes('price_') || k.includes('hist_') || k.includes('portfolio-'))
      )

      keysToRemove.forEach(k => localStorage.removeItem(k))

      try {
        originalSetItem(key, value)
      } catch (e2) {
        // Storage still full after cleanup
      }
    }
  }
}

// Singleton pattern - prevenir múltiples instancias
let supabaseInstance = null

function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Limpiar cualquier lock huérfano de sesiones anteriores (solo en dev)
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    // Registrar para debug
    window.__SUPABASE_DEBUG__ = {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey,
      keyStart: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) : 'none'
    }
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // IMPORTANTE: Deshabilitar navigator.locks porque una extensión del navegador
      // (probablemente MetaMask u otra que usa SES/Lockdown) está bloqueando la API
      // Esto se ve en el log: "SES Removing unpermitted intrinsics"
      lock: false,
      // Debug solo en desarrollo
      debug: import.meta.env.DEV
    },
    global: {
      headers: {
        'x-client-info': 'portfolio-tracker'
      }
    }
  })

  return supabaseInstance
}

export const supabase = getSupabaseClient()
