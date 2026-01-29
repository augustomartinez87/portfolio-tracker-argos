import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase, supabaseFetch } from '@/lib/supabase'
import { useAuth } from '@/features/auth/contexts/AuthContext'
import { fciService } from '@/features/fci/services/fciService'
import Decimal from 'decimal.js'
import { mepService } from '../services/mepService'

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
  // Consumimos el estado completo de auth para asegurar sincronización
  const { user, userProfile, loading: authLoadingCombined } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [currentPortfolio, setCurrentPortfolio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastUserIdRef = useRef(null)
  const lastPortfolioIdRef = useRef(null)
  const loadAttemptRef = useRef(0)
  const isQueryingRef = useRef(false)

  // FCI State within PortfolioContext
  const [fciTransactions, setFciTransactions] = useState([])
  const [fciLatestPrices, setFciLatestPrices] = useState({})
  const [fciLoading, setFciLoading] = useState(false)
  const [mepRate, setMepRate] = useState(0)
  const [mepHistory, setMepHistory] = useState([])

  const loadPortfolios = useCallback(async (forceReload = false) => {
    // No cargar si el sistema de auth/profile sigue cargando
    if (authLoadingCombined) {
      console.log('[PortfolioContext] Auth/Profile still loading, waiting...');
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

    // Bloqueo crítico: Si hay usuario pero no hay perfil, el sistema no está "READY"
    if (!userProfile) {
      console.log('[PortfolioContext] User profile not ready yet, skipping load');
      setLoading(false);
      return;
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
  }, [user, userProfile, authLoadingCombined])

  // Lógica de carga de FCI integrada
  const loadFciData = useCallback(async (portfolioId) => {
    if (!portfolioId) return
    setFciLoading(true)
    try {
      const txs = await fciService.getTransactions(portfolioId)
      setFciTransactions(txs || [])

      const fciIds = [...new Set(txs.map(t => t.fci_id))]
      const pricesMap = {}
      await Promise.all(fciIds.map(async (id) => {
        const latest = await fciService.getLatestPrice(id)
        if (latest) pricesMap[id] = latest
      }))
      setFciLatestPrices(pricesMap)
    } catch (err) {
      console.error('[PortfolioContext] Error loading FCI data:', err)
    } finally {
      setFciLoading(false)
    }
  }, [])

  // Cargar Precios MEP y MEP History una sola vez en el contexto
  useEffect(() => {
    if (!user) return
    const loadMep = async () => {
      const [rate, history] = await Promise.all([
        mepService.getCurrentRate(),
        mepService.getHistory()
      ])
      setMepRate(rate)
      setMepHistory(history)
    }
    loadMep()
  }, [user])

  // Re-cargar FCI cuando cambia el portfolio
  useEffect(() => {
    if (currentPortfolio?.id && currentPortfolio.id !== lastPortfolioIdRef.current) {
      lastPortfolioIdRef.current = currentPortfolio.id
      loadFciData(currentPortfolio.id)
    }
  }, [currentPortfolio, loadFciData])

  // Calcular Posiciones FCI (Copia optimizada de useFciEngine)
  const fciPositions = useMemo(() => {
    const posMap = {}
    const mepMap = new Map()
    if (Array.isArray(mepHistory)) {
      mepHistory.forEach(h => mepMap.set(h.date, h.price))
    }

    fciTransactions.forEach(tx => {
      const { fci_id, fci_master, tipo, monto, cuotapartes } = tx
      if (!posMap[fci_id]) {
        posMap[fci_id] = {
          fciId: fci_id,
          name: fci_master?.nombre || 'Desconocido',
          quantity: new Decimal(0),
          invested: new Decimal(0),
          investedUSD: new Decimal(0)
        }
      }

      const montoDec = new Decimal(monto || 0)
      const cuotasDec = new Decimal(cuotapartes || 0)

      if (tipo === 'SUBSCRIPTION') {
        posMap[fci_id].quantity = posMap[fci_id].quantity.plus(cuotasDec)
        posMap[fci_id].invested = posMap[fci_id].invested.plus(montoDec)
        const dateStr = tx.fecha
        const historicalMep = new Decimal(mepService.findClosestRate(dateStr, mepMap) || mepRate || 1)
        posMap[fci_id].investedUSD = posMap[fci_id].investedUSD.plus(montoDec.dividedBy(historicalMep))
      } else if (tipo === 'REDEMPTION') {
        const pos = posMap[fci_id]
        const avgCostARS = pos.quantity.gt(0) ? pos.invested.dividedBy(pos.quantity) : new Decimal(0)
        const avgCostUSD = pos.quantity.gt(0) ? pos.investedUSD.dividedBy(pos.quantity) : new Decimal(0)
        pos.quantity = pos.quantity.minus(cuotasDec)
        pos.invested = pos.invested.minus(cuotasDec.times(avgCostARS))
        pos.investedUSD = pos.investedUSD.minus(cuotasDec.times(avgCostUSD))
        if (pos.quantity.abs().lt(new Decimal(0.0001))) {
          pos.quantity = new Decimal(0); pos.invested = new Decimal(0); pos.investedUSD = new Decimal(0)
        }
      }
    })

    return Object.values(posMap)
      .filter(p => p.quantity.abs().gt(0.0001))
      .map(p => {
        const lastPrice = fciLatestPrices[p.fciId]
        const vcpActual = new Decimal(lastPrice ? (lastPrice.vcp || 0) : 0)
        const valuation = p.quantity.times(vcpActual)
        const pnl = valuation.minus(p.invested)
        const currentMepDec = new Decimal(mepRate || 1)
        const valuationUSD = currentMepDec.gt(0) ? valuation.dividedBy(currentMepDec) : new Decimal(0)
        const pnlUSD = valuationUSD.minus(p.investedUSD)

        return {
          ...p,
          quantity: p.quantity.toNumber(),
          invested: p.invested.toNumber(),
          investedUSD: p.investedUSD.toNumber(),
          lastVcp: vcpActual.toNumber(),
          priceDate: lastPrice ? lastPrice.fecha : null,
          valuation: valuation.toNumber(),
          pnl: pnl.toNumber(),
          pnlPct: p.invested.isZero() ? 0 : pnl.dividedBy(p.invested.abs()).times(100).toNumber(),
          valuationUSD: valuationUSD.toNumber(),
          pnlUSD: pnlUSD.toNumber(),
          pnlPctUSD: p.investedUSD.isZero() ? 0 : pnlUSD.dividedBy(p.investedUSD.abs()).times(100).toNumber()
        }
      })
  }, [fciTransactions, fciLatestPrices, mepRate, mepHistory])

  const fciTotals = useMemo(() => {
    let invested = new Decimal(0); let valuation = new Decimal(0); let investedUSD = new Decimal(0); let valuationUSD = new Decimal(0)
    fciPositions.forEach(pos => {
      invested = invested.plus(pos.invested); valuation = valuation.plus(pos.valuation)
      investedUSD = investedUSD.plus(pos.investedUSD); valuationUSD = valuationUSD.plus(pos.valuationUSD)
    })
    return {
      invested: invested.toNumber(),
      valuation: valuation.toNumber(),
      pnl: valuation.minus(invested).toNumber(),
      investedUSD: investedUSD.toNumber(),
      valuationUSD: valuationUSD.toNumber(),
      pnlUSD: valuationUSD.minus(investedUSD).toNumber()
    }
  }, [fciPositions])

  useEffect(() => {
    // Esperar a que el sistema esté totalmente READY (Auth + Profile)
    if (authLoadingCombined) {
      console.log('[PortfolioContext] Waiting for complete readiness...');
      return;
    }

    // Si hay usuario pero no hay perfil, aún no es seguro operar
    if (user && !userProfile) {
      console.log('[PortfolioContext] Auth ready but profile missing, waiting for sync...');
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
  }, [user, userProfile, authLoadingCombined, loadPortfolios])

  const createPortfolio = async (name, description = '', currency = 'ARS') => {
    if (!user || !userProfile) throw new Error('Usuario no autenticado o perfil no listo')

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
      loading: loading || fciLoading,
      error,
      createPortfolio,
      updatePortfolio,
      deletePortfolio,
      setDefaultPortfolio,
      refetch: async () => {
        await loadPortfolios();
        if (currentPortfolio?.id) await loadFciData(currentPortfolio.id);
      },
      // FCI Shared State
      fciPositions,
      fciTotals,
      fciTransactions,
      mepRate,
      mepHistory,
      refreshFci: () => loadFciData(currentPortfolio?.id)
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}
