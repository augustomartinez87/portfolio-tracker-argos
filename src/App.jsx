import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/contexts/AuthContext'
import { PortfolioProvider } from '@/features/portfolio/contexts/PortfolioContext'
import { ProtectedRoute } from './features/auth/components/ProtectedRoute'
import { Login } from './features/auth/components/Login'
import { SignUp } from './features/auth/components/SignUp'
import { ForgotPassword } from './features/auth/components/ForgotPassword'
import { ResetPassword } from './features/auth/components/ResetPassword'
import Dashboard from './pages/Dashboard'
import Financiacion from './pages/Financiacion'
import FundingEngine from './pages/FundingEngine'
import CarryTrade from './pages/CarryTrade'
import Fci from './pages/Fci'
import Admin from './pages/Admin'


// Configuración de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 segundos
      gcTime: 5 * 60 * 1000, // 5 minutos
      retry: 3,
      refetchOnWindowFocus: false, // No refetch automático al cambiar tabs
      refetchIntervalInBackground: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Dashboard - Acceso para todos los usuarios autenticados */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredModule="portfolio">
                  <PortfolioProvider>
                    <Dashboard />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* FCI - Solo admin */}
            <Route
              path="/fci"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <Fci />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Financiación - Solo admin */}
            <Route
              path="/financiacion"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <Financiacion />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Funding Engine - Solo admin */}
            <Route
              path="/funding-engine"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <FundingEngine />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Carry Trade - Acceso para todos */}
            <Route
              path="/carry-trade"
              element={
                <ProtectedRoute requiredModule="carryTrade">
                  <PortfolioProvider>
                    <CarryTrade />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Análisis Real - Redirigir a FCI (ahora es una tab) */}
            <Route
              path="/analisis-real"
              element={<Navigate to="/fci" replace />}
            />

            {/* Panel de Administración - Solo admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <Admin />
                </ProtectedRoute>
              }
            />

            {/* Redirect old spread route to new financing route */}
            <Route
              path="/spread"
              element={<Navigate to="/financiacion" replace />}
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
