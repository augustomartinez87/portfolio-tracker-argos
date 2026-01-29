import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
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
  const { user, loading: authLoading } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [currentPortfolio, setCurrentPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastUserIdRef = useRef(null)
  const loadAttemptRef = useRef(0)

  const loadPortfolios = useCallback(async (forceReload = false) => {
    // Don't load if auth is still loading
    if (authLoading) {
      console.log('[PortfolioContext] Auth still loading, waiting...');
      return;
    }

    if (!user) {
      console.log('[PortfolioContext] No user, clearing portfolios');
      setPortfolios([])
      setCurrentPortfolio(null)
      setLoading(false)
      setError(null)
      return
    }

    // Track load attempt for debugging
    const attemptId = ++loadAttemptRef.current;
    console.log(`[PortfolioContext] Loading portfolios (attempt ${attemptId}) for user:`, user.id);

    setLoading(true)
    setError(null)

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[PortfolioContext] Attempt ${attemptId} timed out after 8s`);
      controller.abort();
    }, 8000);

    try {
      console.log(`[PortfolioContext] Starting query...`);

      const { data, error: queryError } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal)

      clearTimeout(timeoutId);

      if (queryError) {
        console.error('[PortfolioContext] Query error:', queryError);
        throw queryError;
      }

      console.log(`[PortfolioContext] Query returned ${data?.length || 0} portfolios`);

      setPortfolios(data || [])

      const defaultPortfolio = data?.find(p => p.is_default) || data?.[0] || null
      setCurrentPortfolio(defaultPortfolio)

      if (!defaultPortfolio && data?.length === 0) {
        console.log('[PortfolioContext] No portfolios found for user');
      }
      setError(null)
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[PortfolioContext] Error loading portfolios:', err)

      // Handle abort/timeout specifically
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        setError('La conexión con el servidor está lenta. Verifica tu conexión a internet e intenta de nuevo.');
      } else {
        setError(err.message || 'Error desconocido al cargar portfolios')
      }
      setPortfolios([])
      setCurrentPortfolio(null)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('[PortfolioContext] Waiting for auth to complete...');
      return;
    }

    // Check if user changed
    const currentUserId = user?.id ?? null
    if (currentUserId === lastUserIdRef.current) {
      // User hasn't changed, but if we're still in initial loading state, force a load
      if (loading && currentUserId !== null) {
        console.log('[PortfolioContext] Same user but still loading, forcing load');
        loadPortfolios();
      }
      return
    }

    console.log(`[PortfolioContext] User changed: ${lastUserIdRef.current} -> ${currentUserId}`);
    lastUserIdRef.current = currentUserId
    loadPortfolios()
  }, [user, authLoading, loadPortfolios, loading])

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
