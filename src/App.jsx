import React, { lazy, Suspense } from 'react'
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
import CryptoPortfolio from './pages/CryptoPortfolio'
import NexoLoans from './pages/NexoLoans'
import FundingCrypto from './pages/FundingCrypto'
const Fci = lazy(() => import('./pages/Fci'));
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

            {/* FCI - MUST be before /portfolio/:tab to avoid conflict */}
            <Route
              path="/portfolio/fci"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <Suspense fallback={<div className="min-h-screen bg-background-primary flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                      <Fci />
                    </Suspense>
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Financing - MUST be before /portfolio/:tab to avoid conflict */}
            <Route
              path="/portfolio/financing"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <Financiacion />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Funding Engine - MUST be before /portfolio/:tab to avoid conflict */}
            <Route
              path="/portfolio/funding"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <FundingEngine />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Portfolio Bursatil - Dashboard (catch-all for /portfolio/:tab) */}
            <Route
              path="/portfolio/:tab?"
              element={
                <ProtectedRoute requiredModule="portfolio">
                  <PortfolioProvider>
                    <Dashboard />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Crypto Portfolio */}
            <Route
              path="/crypto/portfolio"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <CryptoPortfolio />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Nexo Loans - Crypto only */}
            <Route
              path="/crypto/nexo-loans"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <NexoLoans />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Funding Crypto - Crypto only */}
            <Route
              path="/crypto/funding"
              element={
                <ProtectedRoute adminOnly>
                  <PortfolioProvider>
                    <FundingCrypto />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            {/* Panel de Administración - Shared */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <Admin />
                </ProtectedRoute>
              }
            />

            {/* Legacy redirects for backwards compatibility */}
            <Route path="/dashboard/:tab?" element={<Navigate to="/portfolio/dashboard" replace />} />
            <Route path="/dashboard" element={<Navigate to="/portfolio/dashboard" replace />} />
            <Route path="/fci" element={<Navigate to="/portfolio/fci" replace />} />
            <Route path="/financiacion" element={<Navigate to="/portfolio/financing" replace />} />
            <Route path="/funding-engine" element={<Navigate to="/portfolio/funding" replace />} />
            <Route path="/crypto-portfolio" element={<Navigate to="/crypto/portfolio" replace />} />
            <Route path="/nexo-loans" element={<Navigate to="/crypto/nexo-loans" replace />} />
            <Route path="/funding-crypto" element={<Navigate to="/crypto/funding" replace />} />
            <Route path="/spread" element={<Navigate to="/portfolio/financing" replace />} />

            <Route path="/" element={<Navigate to="/portfolio/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
