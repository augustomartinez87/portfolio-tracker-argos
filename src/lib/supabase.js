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

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
