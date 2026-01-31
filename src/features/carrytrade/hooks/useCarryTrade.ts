/**
 * useCarryTrade Hook
 * Hook de React para integración del módulo carry trade
 * Proporciona datos en tiempo real con manejo de estado y errores
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { CarryTradeCalculator } from '../calculator';
import { Data912Service } from '../dataService';
import type { 
  Bond, 
  CarryTradeResult, 
  CarryTradeConfig, 
  CarryTradeSummary 
} from '../models';

/**
 * Estado del hook useCarryTrade
 */
interface UseCarryTradeState {
  /** Resultados del análisis */
  results: CarryTradeResult[];
  /** Resumen agregado */
  summary: CarryTradeSummary | null;
  /** Tipo de cambio MEP actual */
  mepRate: number | null;
  /** Indica si está cargando */
  loading: boolean;
  /** Error ocurrido */
  error: string | null;
  /** Fecha de última actualización */
  lastUpdated: Date | null;
}

/**
 * Opciones para el hook useCarryTrade
 */
interface UseCarryTradeOptions {
  /** Configuración del calculador */
  config?: Partial<CarryTradeConfig>;
  /** Campo para ordenar resultados */
  sortBy?: 'totalReturnUsd' | 'tirUsd' | 'maxVariation';
  /** Orden ascendente o descendente */
  ascending?: boolean;
  /** Auto-refrescar cada X ms (default: 30000 = 30s) */
  refreshInterval?: number;
  /** Habilitar auto-refresh */
  autoRefresh?: boolean;
}

/**
 * Retorno del hook useCarryTrade
 */
interface UseCarryTradeReturn {
  /** Estado actual */
  state: UseCarryTradeState;
  /** Función para refrescar datos manualmente */
  refresh: () => Promise<void>;
  /** Función para cambiar ordenamiento */
  setSorting: (sortBy: UseCarryTradeOptions['sortBy'], ascending?: boolean) => void;
  /** Función para obtener mejor bono por criterio */
  getBestBond: (by: 'return' | 'tir') => CarryTradeResult | null;
  /** Función para filtrar bonos por tipo */
  filterByType: (type: 'LECAP' | 'BONCAP' | 'DUAL') => CarryTradeResult[];
}

/**
 * Hook para análisis de carry trade en tiempo real
 * @param options Opciones de configuración
 * @returns Estado y funciones del hook
 */
export function useCarryTrade(options: UseCarryTradeOptions = {}): UseCarryTradeReturn {
  const {
    config = {},
    sortBy = 'totalReturnUsd',
    ascending = false,
    refreshInterval = 30000,
    autoRefresh = true
  } = options;

  // Estado
  const [state, setState] = useState<UseCarryTradeState>({
    results: [],
    summary: null,
    mepRate: null,
    loading: false,
    error: null,
    lastUpdated: null
  });

  // Configuración de ordenamiento
  const [sortConfig, setSortConfig] = useState({
    sortBy,
    ascending
  });

  // Referencias para servicios
  const calculatorRef = useRef(new CarryTradeCalculator(config));
  const dataServiceRef = useRef(new Data912Service());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Función principal para cargar datos y realizar análisis
   */
  const fetchAndAnalyze = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Obtener datos de data912
      const [mepRate, bonds] = await Promise.all([
        dataServiceRef.current.getMepRate(),
        dataServiceRef.current.getBonds()
      ]);

      if (bonds.length === 0) {
        throw new Error('No se pudieron obtener bonos con precios válidos');
      }

      // Realizar análisis
      const results = calculatorRef.current.analyzeBonds(
        bonds,
        mepRate,
        sortConfig.sortBy,
        sortConfig.ascending
      );

      // Calcular resumen
      const summary = calculatorRef.current.calculateSummary(results, mepRate);

      setState({
        results,
        summary,
        mepRate,
        loading: false,
        error: null,
        lastUpdated: new Date()
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }));
    }
  }, [sortConfig.sortBy, sortConfig.ascending]);

  /**
   * Función para refrescar manualmente
   */
  const refresh = useCallback(async () => {
    await fetchAndAnalyze();
  }, [fetchAndAnalyze]);

  /**
   * Cambiar configuración de ordenamiento
   */
  const setSorting = useCallback((
    newSortBy: UseCarryTradeOptions['sortBy'],
    newAscending?: boolean
  ) => {
    setSortConfig(prev => ({
      sortBy: newSortBy ?? prev.sortBy,
      ascending: newAscending ?? prev.ascending
    }));
  }, []);

  /**
   * Obtener mejor bono por criterio
   */
  const getBestBond = useCallback((by: 'return' | 'tir'): CarryTradeResult | null => {
    if (state.results.length === 0) return null;

    if (by === 'return') {
      return [...state.results].sort((a, b) => b.totalReturnUsd - a.totalReturnUsd)[0];
    } else {
      return [...state.results].sort((a, b) => b.tirUsd - a.tirUsd)[0];
    }
  }, [state.results]);

  /**
   * Filtrar bonos por tipo
   */
  const filterByType = useCallback((type: 'LECAP' | 'BONCAP' | 'DUAL'): CarryTradeResult[] => {
    return state.results.filter(r => r.bond.bondType === type);
  }, [state.results]);

  // Efecto para carga inicial
  useEffect(() => {
    fetchAndAnalyze();
  }, [fetchAndAnalyze]);

  // Efecto para auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(fetchAndAnalyze, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchAndAnalyze]);

  return {
    state,
    refresh,
    setSorting,
    getBestBond,
    filterByType
  };
}

/**
 * Hook simplificado para análisis de un solo bono
 */
export function useSingleBondCarry(
  bond: Bond | null,
  mepRate: number | null,
  config?: Partial<CarryTradeConfig>
) {
  const [result, setResult] = useState<CarryTradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bond || !mepRate) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const calculator = new CarryTradeCalculator(config);
      const analysis = calculator.analyzeBond(bond, mepRate);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en análisis');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [bond, mepRate, config]);

  return { result, loading, error };
}

/**
 * Hook para obtener solo el MEP rate
 */
export function useMepRate(refreshInterval: number = 30000) {
  const [mepRate, setMepRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMep = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const service = new Data912Service();
      const rate = await service.getMepRate();
      setMepRate(rate);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error obteniendo MEP');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMep();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchMep, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchMep, refreshInterval]);

  return { mepRate, loading, error, lastUpdated, refresh: fetchMep };
}
