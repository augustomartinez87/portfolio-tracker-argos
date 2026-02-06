import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { TrendingUp, Coins } from 'lucide-react';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import { SidebarToggleButton } from '@/components/common/SidebarToggleButton';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingFallback } from '@/components/common/LoadingSpinner';
import FinancingDashboard from '@/features/financing/components/FinancingDashboard';
import { financingService } from '@/features/financing/services/financingService';
import MobileNav from '@/components/common/MobileNav';
import { PageHeader } from '@/components/common/PageHeader';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';

const Financiacion = () => {
  const { user, signOut } = useAuth();
  const { currentPortfolio, loading: portfolioLoading } = usePortfolio();
  const queryClient = useQueryClient();
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarExpanded') === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpanded', sidebarExpanded ? 'true' : 'false');
    }
  }, [sidebarExpanded]);



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

  if (loading && !currentPortfolio) {
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
        <DashboardSidebar
          user={user}
          signOut={signOut}
          isExpanded={sidebarExpanded}
          setIsExpanded={setSidebarExpanded}
        />

        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
          <div className="p-3 lg:p-4 space-y-3">
            <PageHeader
              title="Financiación"
              subtitle="Cauciones y Tasas"
              icon={Coins}
              loading={loading}
              onRefresh={handleRefresh}
              sidebarToggle={<SidebarToggleButton isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />}
            />

            {!currentPortfolio ? (
              <PortfolioEmptyState title="Sin Portfolio" message="Crea un portfolio para gestionar tus operaciones de financiación y cauciones." />
            ) : (
              <FinancingDashboard
                operations={operations}
                metrics={metrics}
                loading={loading}
                onRefresh={handleRefresh}
                queryClient={queryClient}
                userId={user?.id}
                portfolioId={currentPortfolio?.id}
              />
            )}
          </div>
        </main>
        <MobileNav />
      </div>
    </ErrorBoundary>
  );
};

export default Financiacion;
