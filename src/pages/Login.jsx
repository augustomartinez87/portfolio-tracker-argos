import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react'
import logo from '../assets/logo.png'
import LorenzButterfly from '../components/LorenzButterfly'
import BackgroundButterflies from '../components/BackgroundButterflies'

/**
 * Login Page - Argos Capital
 *
 * Diseño premium con:
 * - Mariposa central: Atractor de Lorenz (matemático, SVG)
 * - Mariposas de fondo: Decorativas con curvas de Bézier
 * - Card con glassmorphism
 * - Fondo negro puro
 */

export const Login = () => {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* ============================================================
          FONDO: Mariposas decorativas distribuidas en los bordes
          ============================================================ */}
      <BackgroundButterflies
        count={10}
        strokeColor="#ffffff"
        strokeWidth={0.5}
        animated={true}
        className="z-0"
      />

      {/* ============================================================
          CONTENIDO PRINCIPAL
          ============================================================ */}
      <div className="w-full max-w-md px-4 relative z-10">

        {/* ============================================================
            HEADER: Logo + Mariposa Lorenz + Título
            ============================================================ */}
        <div className="text-center mb-8">
          {/* Logo */}
          <img
            src={logo}
            alt="Argos Capital"
            className="w-14 h-14 mx-auto mb-4 opacity-90"
          />

          {/* Mariposa de Lorenz - Atractor matemático */}
          <div className="flex justify-center mb-4">
            <LorenzButterfly
              width={320}
              height={180}
              numPoints={10000}
              dt={0.006}
              strokeColor="#ffffff"
              strokeWidth={0.6}
              className="w-64 h-36 opacity-80"
            />
          </div>

          {/* Título */}
          <h1 className="text-3xl font-light tracking-wide text-white mb-2">
            Argos Capital
          </h1>
          <p className="text-gray-500 text-sm font-light">
            Inicia sesión para continuar
          </p>
        </div>

        {/* ============================================================
            CARD: Formulario con glassmorphism
            ============================================================ */}
        <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-8 shadow-2xl">
          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/60 border border-gray-800 text-white placeholder-gray-600 rounded-lg pl-11 pr-4 py-3.5 focus:outline-none focus:border-gray-600 focus:bg-black/80 transition-all duration-300"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/60 border border-gray-800 text-white placeholder-gray-600 rounded-lg pl-11 pr-12 py-3.5 focus:outline-none focus:border-gray-600 focus:bg-black/80 transition-all duration-300"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-800 disabled:text-gray-500 text-black font-medium py-3.5 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="text-gray-500">Cargando...</span>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-8 pt-6 border-t border-gray-800/50 text-center">
            <p className="text-gray-500 text-sm">
              ¿No tienes cuenta?{' '}
              <Link
                to="/signup"
                className="text-white hover:text-gray-300 transition-colors font-medium"
              >
                Regístrate
              </Link>
            </p>
          </div>
        </div>

        {/* Footer subtle */}
        <p className="text-center text-gray-700 text-xs mt-6">
          © 2024 Argos Capital. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}

export default Login
