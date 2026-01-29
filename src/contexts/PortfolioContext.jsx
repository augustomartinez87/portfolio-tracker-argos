import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext({})

export const usePortfolio = () => {
  const context = useContext(PortfolioContext)
  if (!context) {
    throw new Error('usePortfolio must be used within PortfolioProvider')
  }
  return context
}

export const PortfolioProvider = ({ children }) => {
  const { user } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [currentPortfolio, setCurrentPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastUserIdRef = useRef(null)

  const loadPortfolios = async () => {
    if (!user) {
      setPortfolios([])
      setCurrentPortfolio(null)
      setLoading(false)
      return
    }

    // Safety timeout: si demora más de 7 segundos, forzar loading false
    const timeoutId = setTimeout(() => {
      if (setLoading) {
        console.warn('Portfolio loading timed out, forcing ready state');
        setLoading(false);
      }
    }, 7000);

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      setPortfolios(data || [])

      const defaultPortfolio = data?.find(p => p.is_default) || data?.[0] || null
      setCurrentPortfolio(defaultPortfolio)
    } catch (err) {
      console.error('Error loading portfolios:', err)
      setError(err.message)
      setPortfolios([])
      setCurrentPortfolio(null)
    } finally {
      clearTimeout(timeoutId);
      setLoading(false)
    }
  }

  useEffect(() => {
    // Solo recargar si el user.id realmente cambió (evita refetch en tab focus)
    const currentUserId = user?.id ?? null
    if (currentUserId === lastUserIdRef.current) {
      return
    }
    lastUserIdRef.current = currentUserId
    loadPortfolios()
  }, [user])

  const createPortfolio = async (name, description = '', currency = 'ARS') => {
    if (!user) throw new Error('Usuario no autenticado')

    const { data, error } = await supabase
      .from('portfolios')
      .insert([{
        user_id: user.id,
        name,
        description,
        currency,
        is_default: portfolios.length === 0
      }])
      .select()
      .single()

    if (error) throw error

    await loadPortfolios()
    return data
  }

  const updatePortfolio = async (portfolioId, updates) => {
    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', portfolioId)
      .select()
      .single()

    if (error) throw error

    await loadPortfolios()
    return data
  }

  const deletePortfolio = async (portfolioId) => {
    if (portfolios.length <= 1) {
      throw new Error('No puedes eliminar el único portfolio')
    }

    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId)

    if (error) throw error

    if (currentPortfolio?.id === portfolioId) {
      const newCurrent = portfolios.find(p => p.id !== portfolioId)
      setCurrentPortfolio(newCurrent)
    }

    await loadPortfolios()
  }

  const setDefaultPortfolio = async (portfolioId) => {
    const { error: updateError } = await supabase
      .from('portfolios')
      .update({ is_default: false })
      .eq('user_id', user.id)

    if (updateError) throw updateError

    const { data, error } = await supabase
      .from('portfolios')
      .update({ is_default: true })
      .eq('id', portfolioId)
      .select()
      .single()

    if (error) throw error

    await loadPortfolios()
    return data
  }

  return (
    <PortfolioContext.Provider value={{
      portfolios,
      currentPortfolio,
      setCurrentPortfolio,
      loading,
      error,
      createPortfolio,
      updatePortfolio,
      deletePortfolio,
      setDefaultPortfolio,
      refetch: loadPortfolios
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}
