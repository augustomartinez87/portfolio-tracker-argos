import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase, supabaseFetch } from '@/lib/supabase'
import { useAuth } from '../features/auth/contexts/AuthContext'

const PortfolioContext = createContext({})

export const usePortfolio = () => {
  const context = useContext(PortfolioContext)
  if (!context) {
    throw new Error('usePortfolio must be used within PortfolioProvider')
  }
  return context
}

export const PortfolioProvider = ({ children }) => {
  // Solo esperamos authLoading, no profileLoading - los portfolios se pueden cargar en paralelo
  const { user, authLoading } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [currentPortfolio, setCurrentPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastUserIdRef = useRef(null)
  const loadAttemptRef = useRef(0)
  const isQueryingRef = useRef(false)

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

    // Prevent concurrent loads
    if (isQueryingRef.current) {
      console.log('[PortfolioContext] Query already in progress, skipping...');
      return;
    }

    // Track load attempt for debugging
    const attemptId = ++loadAttemptRef.current;
    console.log(`[PortfolioContext] Loading portfolios (attempt ${attemptId}) for user:`, user.id);

    setLoading(true)
    setError(null)
    isQueryingRef.current = true;

    try {
      console.log(`[PortfolioContext] Starting query (using direct fetch)...`);

      // Usar fetch directo para evitar el bloqueo del cliente de Supabase
      const { data, error: queryError } = await supabaseFetch('portfolios', {
        select: '*',
        eq: { user_id: user.id }
      });

      if (queryError) {
        console.error('[PortfolioContext] Query error:', queryError);
        throw queryError;
      }

      // Ordenar por created_at manualmente
      const sortedData = (data || []).sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );

      console.log(`[PortfolioContext] Query returned ${sortedData.length} portfolios`);

      setPortfolios(sortedData)

      const defaultPortfolio = sortedData.find(p => p.is_default) || sortedData[0] || null
      setCurrentPortfolio(defaultPortfolio)

      if (!defaultPortfolio && sortedData.length === 0) {
        console.log('[PortfolioContext] No portfolios found for user');
      }
      setError(null)
    } catch (err) {
      console.error('[PortfolioContext] Error loading portfolios:', err)
      setError(err.message || 'Error desconocido al cargar portfolios')
      setPortfolios([])
      setCurrentPortfolio(null)
    } finally {
      isQueryingRef.current = false;
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
    const hasUserChanged = currentUserId !== lastUserIdRef.current;

    if (hasUserChanged) {
      console.log(`[PortfolioContext] User changed: ${lastUserIdRef.current} -> ${currentUserId}`);
      lastUserIdRef.current = currentUserId;
      loadPortfolios();
      return;
    }

    // Only force load if we have a user and we are stuck in initial loading state
    if (loading && currentUserId !== null && !isQueryingRef.current) {
      console.log('[PortfolioContext] Initial load needed for user');
      loadPortfolios();
    }
  }, [user, authLoading, loadPortfolios])

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
