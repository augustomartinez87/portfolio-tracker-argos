import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/contexts/AuthContext';

/**
 * Componente de protección de rutas con soporte para roles y módulos
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenido a renderizar si tiene acceso
 * @param {string} props.requiredModule - Módulo requerido para acceder (opcional)
 * @param {boolean} props.adminOnly - Si la ruta es solo para administradores (opcional)
 */
export const ProtectedRoute = ({ children, requiredModule = null, adminOnly = false }) => {
  const { user, loading, authLoading, profileLoading, isAdmin, hasModuleAccess, userProfile } = useAuth()

  // Mostrar loading específico según el estado
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-tertiary">
            {authLoading ? 'Verificando sesión...' : 'Cargando perfil...'}
          </p>
          {profileLoading && (
            <p className="mt-2 text-text-quaternary text-sm">
              Esto puede tomar unos segundos
            </p>
          )}
        </div>
      </div>
    )
  }

  // Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Verificar si el usuario está activo
  if (userProfile && !userProfile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary p-4">
        <div className="text-center p-8 bg-background-secondary rounded-xl border border-border-primary max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Cuenta Desactivada</h2>
          <p className="text-text-tertiary mb-4">
            Tu cuenta ha sido desactivada. Por favor, contacta al administrador para más información.
          </p>
          <button
            onClick={() => window.location.replace('/login')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  // Verificar permisos de administrador
  if (adminOnly && !isAdmin) {
    return <Navigate to="/portfolio/dashboard" replace />
  }

  // Verificar acceso al módulo
  if (requiredModule && !hasModuleAccess(requiredModule)) {
    return <Navigate to="/portfolio/dashboard" replace />
  }

  return children
}
