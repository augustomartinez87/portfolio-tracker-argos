import { useState, useEffect, useCallback } from 'react';
import { financingService } from '../services/financingService';

/**
 * Hook para cargar y gestionar datos de cauciones
 *
 * @param {string} userId - ID del usuario
 * @param {string} portfolioId - ID del portfolio
 * @returns {Object} Estado de cauciones y funciones de control
 */
export function useCauciones(userId, portfolioId) {
  const [cauciones, setCauciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCauciones = useCallback(async () => {
    if (!userId || !portfolioId) {
      setCauciones([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await financingService.getCauciones(userId, portfolioId);

      if (result.success) {
        setCauciones(result.data || []);
      } else {
        setError(result.error?.message || 'Error cargando cauciones');
        setCauciones([]);
      }
    } catch (err) {
      console.error('[useCauciones] Error:', err);
      setError(err.message || 'Error desconocido');
      setCauciones([]);
    } finally {
      setLoading(false);
    }
  }, [userId, portfolioId]);

  // Cargar al montar o cuando cambian los IDs
  useEffect(() => {
    loadCauciones();
  }, [loadCauciones]);

  return {
    cauciones,
    loading,
    error,
    refresh: loadCauciones,
    isEmpty: cauciones.length === 0 && !loading,
  };
}

export default useCauciones;
