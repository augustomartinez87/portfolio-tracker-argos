import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { userService } from '../services/userService'
import { DEFAULT_MODULES } from '../config/navigation'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const isLogoutInProgress = useRef(false)
  const currentUserIdRef = useRef(null)

  // Cargar perfil del usuario
  const loadUserProfile = useCallback(async (userId) => {
    if (!userId) {
      setUserProfile(null)
      setProfileLoading(false)
      return
    }

    // Safety timeout para la carga del perfil (15s)
    const profileTimeout = setTimeout(() => {
      if (profileLoading) {
        console.warn('[Auth] Profile loading timed out (15s), proceeding without profile');
        setProfileLoading(false);
      }
    }, 15000);

    try {
      console.log('[Auth] Fetching profile for user:', userId);
      setProfileLoading(true)
      const profile = await userService.getProfile(userId)
      setUserProfile(profile)

      if (profile) {
        console.log('[Auth] Profile loaded successfully');
        userService.logActivity('login', null, { method: 'session' })
      } else {
        console.warn('[Auth] No profile found for user:', userId);
      }
    } catch (err) {
      console.error('[Auth] Error loading user profile:', err)
      setUserProfile(null)
    } finally {
      clearTimeout(profileTimeout);
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    // Safety timeout global para el arranque (30s)
    // Aumentado para evitar cierres de sesión por cold starts de Supabase o conexiones lentas
    const globalTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Initialization timed out (30s). Potential server lag or corrupt session.');

        // Solo marcamos como cargado para permitir que la app intente renderizar
        // En lugar de forzar logout inmediato, dejamos que el usuario vea el estado
        setLoading(false);
        setProfileLoading(false);

        // Si realmente no hay usuario después de 30s, redirigimos
        if (!currentUserIdRef.current && !window.location.pathname.includes('/login')) {
          console.warn('[Auth] No user detected after timeout, redirecting to login');
          window.location.href = '/login?error=session_timeout';
        }
      }
    }, 30000);

    const getSession = async () => {
      try {
        console.log('[Auth] Getting initial session...');
        const { data: { session } } = await supabase.auth.getSession()
        const newUser = session?.user ?? null
        console.log('[Auth] Session result:', newUser ? 'User found' : 'No user');
        currentUserIdRef.current = newUser?.id ?? null
        setUser(newUser)

        if (newUser) {
          await loadUserProfile(newUser.id)
        } else {
          setProfileLoading(false)
        }
      } catch (err) {
        console.error('[Auth] Error getting initial session:', err)
        currentUserIdRef.current = null
        setUser(null)
        setProfileLoading(false)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Auth state changed: ${event}`);
      if (isLogoutInProgress.current) return

      const newUserId = session?.user?.id ?? null
      if (newUserId === currentUserIdRef.current) {
        // Si el ID es el mismo pero el evento es SIGNED_IN, refrescamos el perfil por si acaso
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Refreshing profile due to state change event');
          await loadUserProfile(newUserId);
        }
        return
      }

      console.log(`[Auth] User switching: ${currentUserIdRef.current} -> ${newUserId}`);
      currentUserIdRef.current = newUserId
      setUser(session?.user ?? null)

      if (newUserId) {
        await loadUserProfile(newUserId)
      } else {
        setUserProfile(null)
        setProfileLoading(false)
      }

      setLoading(false)
    })

    return () => {
      clearTimeout(globalTimeout);
      subscription.unsubscribe();
    }
  }, [loadUserProfile])

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error

    // Cargar perfil después del login
    if (data.user) {
      await loadUserProfile(data.user.id)
    }

    return data
  }

  const signOut = async () => {
    isLogoutInProgress.current = true

    // Registrar logout antes de cerrar sesión
    if (userProfile) {
      await userService.logActivity('logout', null, {})
    }

    await supabase.auth.signOut()
    setUser(null)
    setUserProfile(null)

    // Solo borrar datos de autenticación, preservar caché de precios
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.includes('supabase') ||
      key.includes('auth') ||
      key.includes('session') ||
      key.includes('sb-')
    )
    keysToRemove.forEach(key => localStorage.removeItem(key))
    window.location.replace('/login')
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
  }

  // Helpers de roles y permisos
  const isAdmin = userProfile?.role === 'admin'
  const allowedModules = userProfile?.modules || DEFAULT_MODULES.user

  const hasModuleAccess = useCallback((moduleId) => {
    if (isAdmin) return true
    return allowedModules.includes(moduleId)
  }, [isAdmin, allowedModules])

  // Refrescar perfil manualmente
  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserProfile(user.id)
    }
  }, [user, loadUserProfile])

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading: loading || profileLoading,
      isAdmin,
      allowedModules,
      hasModuleAccess,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword
    }}>
      {children}
    </AuthContext.Provider>
  )
}
