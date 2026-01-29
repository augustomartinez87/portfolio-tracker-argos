import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TrendingUp, RefreshCw, Upload, Filter, Trash2, List, BarChart3 } from 'lucide-react';
import FinancingKPIs from '@/features/financing/components/FinancingKPIs';
import CSVUploadView from '@/features/financing/components/CSVUploadView';
import FinancingCharts from '@/features/financing/components/FinancingCharts';
import CaucionesTable from '@/features/financing/components/cauciones/CaucionesTable';
import SummaryCard from '@/components/common/SummaryCard';
import { financingService } from '@/features/financing/services/financingService';

const FinancingDashboard = ({ operations, metrics, loading, onRefresh, queryClient, userId, portfolioId }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [kpisData, setKpisData] = useState(null);
  const csvDataRef = useRef(null); // Ref persistente para datos CSV
  const [cauciones, setCauciones] = useState([]);
  const [caucionesLoading, setCaucionesLoading] = useState(false);

  const handleCSVProcessed = useCallback((processedData) => {
    console.log('✅ CSV procesado - registros:', processedData?.records?.length);
    console.log('✅ CSV procesado - summary:', processedData?.summary);

    // Guardar en ref persistente Y en estado
    if (processedData && processedData.summary) {
      csvDataRef.current = processedData;
      setKpisData(processedData);
      console.log('✅ kpisData actualizado con datos del CSV');
      console.log('✅ csvDataRef.current guardado:', csvDataRef.current?.records?.length);
    } else {
      console.error('❌ Estructura de datos inválida:', processedData);
    }
  }, []); // Sin dependencias para evitar re-creaciones

  // useEffect simple para monitorear cambios
  useEffect(() => {
    console.log('🔄 kpisData changed:', kpisData ? 'CON DATOS' : 'NULL');
    console.log('🔄 csvDataRef.current:', csvDataRef.current?.records?.length || 'NULL');
  }, [kpisData]);

  // useEffect para restaurar datos desde ref si kpisData se pierde
  useEffect(() => {
    if (!kpisData && csvDataRef.current && csvDataRef.current.summary) {
      console.log('🔧 Restaurando kpisData desde ref persistente');
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
        console.log('✅ Cargadas cauciones:', result.data?.length);
      } else {
        console.error('Error cargando cauciones:', result.error);
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
          queryClient.invalidateQueries(['financing-operations']);
          queryClient.invalidateQueries(['financing-metrics']);
        }
        console.log('✅ Caución eliminada:', caucionId);
      } else {
        console.error('Error eliminando caución:', result.error);
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
          queryClient.invalidateQueries(['financing-operations']);
          queryClient.invalidateQueries(['financing-metrics']);
        }
        console.log('✅ Todas las cauciones eliminadas:', result.data?.deletedCount);
      } else {
        console.error('Error eliminando todas las cauciones:', result.error);
        alert('Error al eliminar todas las cauciones. Por favor intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error eliminando todas las cauciones:', error);
      alert('Error al eliminar todas las cauciones. Por favor intenta nuevamente.');
    }
  }, [userId, portfolioId, loadCauciones, queryClient]);

  // Función para LIMPIAR TODOS los datos del usuario (solo desarrollo)
  const handleClearAllData = useCallback(async () => {
    if (!userId) return;

    if (window.confirm('⚠️ LIMPIEZA TOTAL\n\n¿Estás seguro que deseas eliminar TODAS las cauciones de TODOS tus portfolios?\n\nEsta acción es irreversible y limpiará todos tus datos para empezar desde 0.')) {
      try {
        const result = await financingService.clearAllUserCauciones(userId);
        if (result.success) {
          // Recargar cauciones
          await loadCauciones();
          // Invalidar todo
          if (queryClient) {
            queryClient.invalidateQueries(['financing-operations']);
            queryClient.invalidateQueries(['financing-metrics']);
          }
          alert(`✅ Limpieza completa: ${result.data?.deletedCount} cauciones eliminadas.Puedes empezar desde 0.`);
          console.log('✅ LIMPIEZA TOTAL - Eliminadas:', result.data?.deletedCount);
        } else {
          console.error('Error en limpieza total:', result.error);
          alert('Error en limpieza total. Por favor intenta nuevamente.');
        }
      } catch (error) {
        console.error('Error en limpieza total:', error);
        alert('Error en limpieza total. Por favor intenta nuevamente.');
      }
    }
  }, [userId, loadCauciones, queryClient]);

  // Función para sincronizar desde Google Sheets
  const handleSyncFromSheets = useCallback(async () => {
    if (!userId || !portfolioId) return;

    const url = prompt("Ingresa la URL del CSV publicado de Google Sheets:\n(Archivo > Compartir > Publicar en la web > CSV)");
    if (!url) return;

    if (!url.includes('docs.google.com') && !url.includes('output=csv')) {
      if (!window.confirm("La URL no parece ser de un Google Sheet CSV estándar. ¿Deseas continuar igual?")) {
        return;
      }
    }

    // Usamos el loading de kpis para bloquear UI globalmente o uno local
    // Como el dashboard usa 'loading' prop para bloquear todo, vamos a usar un toast o alert al final
    // Idealmente tendríamos un estado 'isSyncing'
    const loadingToast = document.createElement('div');
    loadingToast.className = 'fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce';
    loadingToast.textContent = '⏳ Sincronizando con Google Sheets...';
    document.body.appendChild(loadingToast);

    try {
      const result = await financingService.ingestFromUrl(userId, portfolioId, url);
      document.body.removeChild(loadingToast);

      if (result.success) {
        const count = result.data?.totalInserted || 0;
        alert(`✅ Sincronización exitosa!\n\nSe procesaron ${count} registros.`);
        await onRefresh();
      } else {
        console.error('Error sync:', result.error);
        alert(`❌ Error al sincronizar: ${result.error?.message || 'Error desconocido'} `);
      }
    } catch (error) {
      if (document.body.contains(loadingToast)) document.body.removeChild(loadingToast);
      console.error('Error sync:', error);
      alert(`❌ Error inesperado: ${error.message} `);
    }
  }, [userId, portfolioId, onRefresh]);

  const viewOptions = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'charts', label: 'Análisis', icon: TrendingUp },
    { id: 'cauciones', label: 'Cauciones', icon: List },
    { id: 'upload', label: 'Cargar CSV', icon: Upload },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="bg-background-secondary border border-border-primary rounded-xl p-2">
        <div className="flex flex-wrap gap-2">
          {viewOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setActiveView(option.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm ${activeView === option.id
                ? 'bg-primary text-white'
                : 'text-text-tertiary hover:text-text-primary hover:bg-background-tertiary'
                }`}
            >
              <option.icon className="w-4 h-4" />
              {option.label}
            </button>
          ))}
          <button
            onClick={handleSyncFromSheets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F9D58]/10 text-[#0F9D58] rounded-lg hover:bg-[#0F9D58]/20 transition-colors border border-[#0F9D58]/30 disabled:opacity-50 font-medium text-sm"
          >
            <List className="w-4 h-4" />
            Sincronizar Sheets
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors border border-blue-500/30 disabled:opacity-50 font-medium text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
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
