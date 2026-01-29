import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { userService } from '../services/userService'
import { DEFAULT_MODULES } from '@/config/navigation'

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
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const isLogoutInProgress = useRef(false)
  const currentUserIdRef = useRef(null)

  // Estado combinado para backward compatibility
  const loading = authLoading || profileLoading

  // Cargar perfil del usuario con retry exponencial
  const loadUserProfile = useCallback(async (userId) => {
    if (!userId) {
      setUserProfile(null)
      setProfileLoading(false)
      return
    }

    // Safety timeout para la carga del perfil (20s)
    const profileTimeout = setTimeout(() => {
      if (profileLoading) {
        console.warn('[Auth] Profile loading timed out (20s), proceeding with minimal profile');
        // Perfil mínimo para permitir funcionamiento básico
        setUserProfile({ role: 'user', is_active: true, modules: ['portfolio'] });
        setProfileLoading(false);
      }
    }, 20000);

    try {
      console.log('[Auth] Fetching profile for user:', userId);
      setProfileLoading(true)

      // Implementar retry con backoff exponencial
      let profile = null;
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          profile = await userService.getProfile(userId);
          if (profile) break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            console.log(`[Auth] Profile retry attempt ${attempt + 1}`);
          }
        }
      }

      setUserProfile(profile)

      if (profile) {
        console.log('[Auth] Profile loaded successfully');
        userService.logActivity('login', null, { method: 'session' })
      } else {
        console.warn('[Auth] No profile found after retries for user:', userId, lastError);
        // Perfil mínimo como fallback
        setUserProfile({ role: 'user', is_active: true, modules: ['portfolio'] });
      }
    } catch (err) {
      console.error('[Auth] Error loading user profile:', err)
      setUserProfile({ role: 'user', is_active: true, modules: ['portfolio'] });
    } finally {
      clearTimeout(profileTimeout);
      setProfileLoading(false)
    }
  }, [])

  const getSession = useCallback(async () => {
    try {
      console.log('[Auth] Getting session...');
      const { data: { session } } = await supabase.auth.getSession()
      const newUser = session?.user ?? null
      console.log('[Auth] Session result:', newUser ? 'User found' : 'No user');
      currentUserIdRef.current = newUser?.id ?? null
      setUser(newUser)
      setAuthLoading(false)

      if (newUser) {
        await loadUserProfile(newUser.id)
      } else {
        setProfileLoading(false)
      }
    } catch (err) {
      console.error('[Auth] Error getting session:', err)
      currentUserIdRef.current = null
      setUser(null)
      setAuthLoading(false)
      setProfileLoading(false)
    }
  }, [loadUserProfile])

  // Refrescar perfil manualmente
  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserProfile(user.id)
    }
  }, [user, loadUserProfile])

  useEffect(() => {
    // Timeout diferenciado para auth vs profile
    const authTimeout = setTimeout(() => {
      if (authLoading) {
        console.warn('[Auth] Auth initialization taking too long (15s), checking network status...');
        if (!navigator.onLine) {
          console.warn('[Auth] Offline detected, proceeding with cached session');
          setAuthLoading(false);
        } else {
          console.warn('[Auth] Online but auth slow, proceeding anyway');
          setAuthLoading(false);
        }
      }
    }, 15000);

    const profileTimeout = setTimeout(() => {
      if (profileLoading && user) {
        console.warn('[Auth] Profile loading timeout (20s), proceeding with minimal profile');
        setUserProfile({ role: 'user', is_active: true, modules: ['portfolio'] });
        setProfileLoading(false);
      }
    }, 20000);

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Auth state changed: ${event}`);
      if (isLogoutInProgress.current) return

      const newUserId = session?.user?.id ?? null

      // Mejorar lógica de concurrencia para multi-pestaña
      if (newUserId === currentUserIdRef.current) {
        // Si el ID es el mismo pero el evento es importante, refrescamos
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Refreshing profile due to state change event');
          await loadUserProfile(newUserId);
        }
        return
      }

      console.log(`[Auth] User switching: ${currentUserIdRef.current} -> ${newUserId}`);
      currentUserIdRef.current = newUserId
      setUser(session?.user ?? null)
      setAuthLoading(false)

      if (newUserId) {
        await loadUserProfile(newUserId)
      } else {
        setUserProfile(null)
        setProfileLoading(false)
      }
    })

    return () => {
      clearTimeout(authTimeout);
      clearTimeout(profileTimeout);
      subscription.unsubscribe();
    }
  }, [getSession, loadUserProfile, user])

  // Sincronización multi-pestaña
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key?.includes('supabase.auth.token') || e.key?.includes('sb-')) {
        console.log('[Auth] Storage changed in another tab, refreshing session...');
        getSession();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('[Auth] Tab became visible, refreshing profile...');
        refreshProfile();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshProfile, getSession]);

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

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      authLoading,
      profileLoading,
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
