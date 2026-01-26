import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { PortfolioProvider } from './contexts/PortfolioContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { SignUp } from './pages/SignUp'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Financiacion from './pages/Financiacion'
import FundingEngine from './pages/FundingEngine'
import CarryTrade from './pages/CarryTrade'

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

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <PortfolioProvider>
                    <Dashboard />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/financiacion"
              element={
                <ProtectedRoute>
                  <PortfolioProvider>
                    <Financiacion />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/funding-engine"
              element={
                <ProtectedRoute>
                  <PortfolioProvider>
                    <FundingEngine />
                  </PortfolioProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/carry-trade"
              element={
                <ProtectedRoute>
                  <PortfolioProvider>
                    <CarryTrade />
                  </PortfolioProvider>
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
