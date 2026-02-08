import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { Lock, Mail, ArrowRight, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import loginBg from '@/assets/login-bg.jpg'

export const Login = () => {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const params = new URLSearchParams(location.search)
  const [error, setError] = useState(params.get('error') === 'session_timeout' ? 'La sesión expiró o tardó demasiado en cargar. Por favor, intenta de nuevo.' : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/portfolio/dashboard')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background-primary">
      {/* Imagen de fondo */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loginBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      {/* Overlay oscuro para mejor legibilidad */}
      <div className="absolute inset-0 z-0 bg-black/50" />

      <div className="w-full max-w-md px-4 relative z-10 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Argos Capital</h1>
          <p className="text-text-tertiary">Inicia sesión para continuar</p>
        </div>

        <div className="bg-background-secondary/80 backdrop-blur-md border border-border-primary rounded-xl p-8 shadow-xl">
          {error && (
            <div className={`border px-4 py-3 rounded-lg mb-6 flex items-start gap-3 ${error.includes('expiró') ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-danger/10 border-danger/30 text-danger'}`}>
              {error.includes('expiró') ? <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : null}
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background-tertiary border border-border-primary text-text-primary placeholder-text-tertiary rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary transition-all duration-200"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background-tertiary border border-border-primary text-text-primary placeholder-text-tertiary rounded-lg pl-10 pr-12 py-3 focus:outline-none focus:border-primary transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link
                to="/forgot-password"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-primary/80 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                'Cargando...'
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-tertiary">
              ¿No tienes cuenta?{' '}
              <Link to="/signup" className="text-white hover:text-white/80 transition-colors font-medium">
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
