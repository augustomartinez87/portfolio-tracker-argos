import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TrendingUp, Upload, BarChart3 } from 'lucide-react';
import FinancingKPIs from '@/features/financing/components/FinancingKPIs';
import CSVUploadView from '@/features/financing/components/CSVUploadView';
import FinancingCharts from '@/features/financing/components/FinancingCharts';
import CaucionesTable from '@/features/financing/components/cauciones/CaucionesTable';
import SummaryCard from '@/components/common/SummaryCard';
import { financingService } from '@/features/financing/services/financingService';

const FinancingDashboard = ({ operations, metrics, loading, queryClient, userId, portfolioId }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [kpisData, setKpisData] = useState(null);
  const csvDataRef = useRef(null); // Ref persistente para datos CSV
  const [cauciones, setCauciones] = useState([]);
  const [caucionesLoading, setCaucionesLoading] = useState(false);

  const handleCSVProcessed = useCallback((processedData) => {
    // Guardar en ref persistente Y en estado
    if (processedData && processedData.summary) {
      csvDataRef.current = processedData;
      setKpisData(processedData);
    }
  }, []); // Sin dependencias para evitar re-creaciones

  // useEffect para restaurar datos desde ref si kpisData se pierde
  useEffect(() => {
    if (!kpisData && csvDataRef.current && csvDataRef.current.summary) {
      setKpisData(csvDataRef.current);
    }
  }, [kpisData]);

  // Función para cargar cauciones desde el servicio
  const loadCauciones = useCallback(async () => {
    if (!userId || !portfolioId) return;

    setCaucionesLoading(true);
    try {
      const result = await financingService.getCauciones(userId, portfolioId);
      if (result.success) {
        setCauciones(result.data || []);
      } else {
        setCauciones([]);
      }
    } catch (error) {
      console.error('Error cargando cauciones:', error);
      setCauciones([]);
    } finally {
      setCaucionesLoading(false);
    }
  }, [userId, portfolioId]);

  // Cargar cauciones cuando se cambia a esa vista
  useEffect(() => {
    if (activeView === 'cauciones') {
      loadCauciones();
    }
  }, [activeView, loadCauciones]);

  // Función para eliminar caución individual
  const handleDeleteCaucion = useCallback(async (caucionId) => {
    if (!userId || !caucionId) return;

    try {
      const result = await financingService.deleteOperation(userId, caucionId);
      if (result.success) {
        // Recargar lista de cauciones
        await loadCauciones();
        // Invalidar queries para actualizar otros componentes
        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: ['financing-operations'] });
          queryClient.invalidateQueries({ queryKey: ['financing-metrics'] });
        }
      } else {
        alert('Error al eliminar caución. Por favor intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error eliminando caución:', error);
      alert('Error al eliminar caución. Por favor intenta nuevamente.');
    }
  }, [userId, loadCauciones, queryClient]);

  // Función para eliminar todas las cauciones
  const handleDeleteAllCauciones = useCallback(async () => {
    if (!userId || !portfolioId) return;

    try {
      const result = await financingService.deleteAllOperations(userId, portfolioId);
      if (result.success) {
        // Recargar lista de cauciones
        await loadCauciones();
        // Invalidar queries para actualizar otros componentes
        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: ['financing-operations'] });
          queryClient.invalidateQueries({ queryKey: ['financing-metrics'] });
        }
      } else {
        alert('Error al eliminar todas las cauciones. Por favor intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error eliminando todas las cauciones:', error);
      alert('Error al eliminar todas las cauciones. Por favor intenta nuevamente.');
    }
  }, [userId, portfolioId, loadCauciones, queryClient]);

  const viewOptions = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'charts', label: 'Análisis', icon: TrendingUp },
    { id: 'cauciones', label: 'Cauciones', icon: Upload },
    { id: 'upload', label: 'Cargar CSV', icon: Upload },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="border-b border-border-secondary">
        <div className="flex gap-1">
          {viewOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setActiveView(option.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeView === option.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
              }`}
            >
              <span className="flex items-center gap-2">
                <option.icon className="w-4 h-4" />
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* KPIs Cards - Visible only in Dashboard */}
      {activeView === 'dashboard' && (
        <FinancingKPIs
          metrics={metrics}
          csvData={kpisData}
          operations={operations}
          loading={loading}
        />
      )}

      {/* Dynamic Content Area */}
      <div className="min-h-[400px]">
        {activeView === 'dashboard' && (
          <div className="bg-background-secondary border border-border-primary rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Resumen de Operaciones</h2>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-background-tertiary rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-background-tertiary rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : operations.length > 0 ? (
              <div className="space-y-4">
                <SummaryCard
                  title="Total de Operaciones"
                  value={operations.length}
                  subValue="Último período"
                  icon={BarChart3}
                />
                <div className="text-text-tertiary">
                  <p>• Capital promedio por operación: ${metrics?.capitalTotal ? (metrics.capitalTotal / operations.length).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '—'}</p>
                  <p>• Tasa promedio: {metrics?.tnaPromedioPonderada?.toFixed?.(2) || '—'}%</p>
                  <p>• Duración promedio: {metrics?.diasPromedio?.toFixed?.(0) || '—'} días</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Upload className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-tertiary">No hay operaciones registradas</p>
                <p className="text-text-tertiary text-sm mt-2">
                  Sube un archivo CSV para comenzar a analizar tus operaciones de caución
                </p>
              </div>
            )}
          </div>
        )}

        {activeView === 'upload' && (
          <CSVUploadView
            onProcessed={handleCSVProcessed}
            userId={userId}
            portfolioId={portfolioId}
            queryClient={queryClient}
          />
        )}

        {activeView === 'cauciones' && (
          <CaucionesTable
            cauciones={cauciones}
            onDelete={handleDeleteCaucion}
            onDeleteAll={handleDeleteAllCauciones}
            loading={caucionesLoading || loading}
          />
        )}

        {activeView === 'charts' && (
          <FinancingCharts
            operations={operations}
            csvData={kpisData}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default FinancingDashboard;
