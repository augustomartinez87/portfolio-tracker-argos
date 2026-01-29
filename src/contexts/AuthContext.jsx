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

    try {
      setProfileLoading(true)
      const profile = await userService.getProfile(userId)
      setUserProfile(profile)

      // Registrar login (sin bloquear el arranque)
      if (profile) {
        userService.logActivity('login', null, { method: 'session' })
      }
    } catch (err) {
      console.error('Error loading user profile:', err)
      setUserProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const newUser = session?.user ?? null
        currentUserIdRef.current = newUser?.id ?? null
        setUser(newUser)

        // Cargar perfil si hay usuario
        if (newUser) {
          await loadUserProfile(newUser.id)
        } else {
          setProfileLoading(false)
        }
      } catch (err) {
        console.error('Error getting session:', err)
        currentUserIdRef.current = null
        setUser(null)
        setProfileLoading(false)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isLogoutInProgress.current) {
        return
      }
      const newUserId = session?.user?.id ?? null
      // Solo actualizar si el usuario realmente cambió (evita re-render en tab focus)
      if (newUserId === currentUserIdRef.current) {
        return
      }
      currentUserIdRef.current = newUserId
      setUser(session?.user ?? null)

      // Recargar perfil si cambió el usuario
      if (newUserId) {
        await loadUserProfile(newUserId)
      } else {
        setUserProfile(null)
        setProfileLoading(false)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
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
