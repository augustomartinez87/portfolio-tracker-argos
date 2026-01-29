import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { ThemeProvider } from './contexts/ThemeContext'

// Debug utilities (disponibles en consola como window.debugAuth())
import './utils/debugAuth'

// StrictMode deshabilitado temporalmente para evitar conflictos con Supabase auth
// React.StrictMode ejecuta efectos dos veces lo cual causa "Multiple GoTrueClient instances"
// TODO: Re-habilitar cuando Supabase resuelva el issue con navigator.locks
ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)