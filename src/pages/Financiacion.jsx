import React, { useState, useCallback, useMemo } from 'react';
import { TrendingUp, RefreshCw, Upload, Filter, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingFallback } from '../components/common/LoadingSpinner';
import FinancingDashboard from '../features/financing/components/FinancingDashboard';
import financingService from '../features/financing/services/financingService';
import MobileNav from '../components/common/MobileNav';

const Financiacion = () => {
  const { user, signOut } = useAuth();
  const { currentPortfolio, loading: portfolioLoading } = usePortfolio();
  const queryClient = useQueryClient();

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('financiacion'); // Estado para navegación del sidebar

  // React Query para obtener operaciones (persistencia real)
  const { data: operations = [], isLoading: loadingOps, error: opsError, refetch: refetchOps } = useQuery({
    queryKey: ['financing-operations', user?.id, currentPortfolio?.id],
    queryFn: () => financingService.getCauciones(user.id, currentPortfolio.id),
    select: (result) => result.success ? result.data : [],
    enabled: !!user && !!currentPortfolio,
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: []  // Ensure it's always an array initially
  });

  // React Query para obtener métricas (calculadas desde DB)
  const { data: metrics, isLoading: loadingMetrics, error: metricsError, refetch: refetchMetrics } = useQuery({
    queryKey: ['financing-metrics', user?.id, currentPortfolio?.id],
    queryFn: () => financingService.getMetrics(user.id, currentPortfolio.id),
    select: (result) => result.success ? result.data : null,
    enabled: !!user && !!currentPortfolio,
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
    refetchOnWindowFocus: false
  });

  // Combinar estados de loading
  const loading = loadingOps || loadingMetrics || portfolioLoading;

  // Función para refrescar ambas queries
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Refrescando datos de financiación...');
    try {
      await Promise.all([refetchOps(), refetchMetrics()]);
      console.log('✅ Datos refrescados exitosamente');
    } catch (error) {
      console.error('❌ Error refrescando datos:', error);
    }
  }, [refetchOps, refetchMetrics]);

  // Manejo de errores
  const hasError = opsError || metricsError;
  const errorMessage = opsError?.message || metricsError?.message;

  // Exponer función para actualización desde componentes hijos
  React.useEffect(() => {
    // Hacer disponible la función de refresh globalmente para este componente
    if (typeof window !== 'undefined') {
      window.refreshFinancingData = handleRefresh;
    }
  }, [handleRefresh]);

  if (loading) {
    return <LoadingFallback />;
  }

  if (hasError) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">Error cargando datos</h2>
              <p className="text-text-tertiary text-sm mb-4">{errorMessage}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background-primary flex">
        {/* Sidebar - Desktop only */}
        <DashboardSidebar
          user={user}
          signOut={signOut}
          activeTab={activeTab}
          setActiveTab={setActiveTab} // Ahora el sidebar funciona correctamente
          isExpanded={sidebarExpanded}
          setIsExpanded={setSidebarExpanded}
        />

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">Financiación</h1>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors border border-border-primary disabled:opacity-50"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'
          }`}>
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-semibold text-text-primary">Financiación</h1>
                <p className="text-text-tertiary text-sm mt-1">
                  Gestión y análisis de operaciones de caución
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors border border-border-primary disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>

                {process.env.NODE_ENV === 'development' && (
                  <>
                    <button
                      onClick={() => {
                        if (window.confirm('⚠️ LIMPIEZA TOTAL\n\n¿Estás seguro que deseas eliminar TODAS las cauciones de TODOS tus portfolios?\n\nEsta acción es irreversible y limpiará todos tus datos para empezar desde 0.')) {
                          // Importar y llamar al método de limpieza
                          import('../features/financing/services/financingService').then(({ financingService }) => {
                            financingService.clearAllUserCauciones(user.id).then(result => {
                              if (result.success) {
                                // Refrescar queries
                                queryClient.invalidateQueries(['financing-operations']);
                                queryClient.invalidateQueries(['financing-metrics']);
                                alert(`✅ Limpieza completa: ${result.data?.deletedCount} cauciones eliminadas. Puedes empezar desde 0.`);
                              } else {
                                alert('Error en limpieza total. Por favor intenta nuevamente.');
                              }
                            });
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors border border-danger/30 text-sm font-medium"
                      title="Limpiar todos los datos (solo desarrollo)"
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpiar Datos
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('🚨 EMERGENCIA\n\n¿Estás seguro que deseas eliminar TODAS las cauciones de TODOS los usuarios?\n\n⚠️ ESTA ACCIÓN AFECTA A TODOS LOS USUARIOS DEL SISTEMA.')) {
                          // Importar y llamar al método de emergencia
                          import('../features/financing/services/financingService').then(({ financingService }) => {
                            financingService.emergencyDeleteAllCauciones().then(result => {
                              if (result.success) {
                                // Refrescar queries
                                queryClient.invalidateQueries(['financing-operations']);
                                queryClient.invalidateQueries(['financing-metrics']);
                                alert(`🚨 EMERGENCIA COMPLETA: ${result.data?.deletedCount} cauciones eliminadas de toda la base de datos.`);
                              } else {
                                alert('Error en emergencia total. Por favor intenta nuevamente.');
                              }
                            });
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-bold animate-pulse"
                      title="EMERGENCIA: Borrar TODAS las cauciones (solo desarrollo)"
                    >
                      <Trash2 className="w-4 h-4" />
                      🚨 BORRAR TODO
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Financing Dashboard Content */}
            <FinancingDashboard
              operations={operations}
              metrics={metrics}
              loading={loading}
              onRefresh={handleRefresh}
              queryClient={queryClient}
              userId={user?.id}
              portfolioId={currentPortfolio?.id}
            />
          </div>
        </main>
        <MobileNav />
      </div>
    </ErrorBoundary>
  );
};

export default Financiacion;
