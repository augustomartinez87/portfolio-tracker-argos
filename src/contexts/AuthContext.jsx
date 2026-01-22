import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
  const [loading, setLoading] = useState(true)
  const isLogoutInProgress = useRef(false)
  const currentUserIdRef = useRef(null)

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const newUser = session?.user ?? null
        currentUserIdRef.current = newUser?.id ?? null
        setUser(newUser)
      } catch (err) {
        console.error('Error getting session:', err)
        currentUserIdRef.current = null
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
    return data
  }

  const signOut = async () => {
    isLogoutInProgress.current = true
    await supabase.auth.signOut()
    setUser(null)
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

  return (
    <AuthContext.Provider value={{
      user,
      loading,
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
