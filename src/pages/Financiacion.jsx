import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, RefreshCw, Upload, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingFallback } from '../components/common/LoadingSpinner';
import FinancingDashboard from '../components/financiacion/FinancingDashboard';
import { caucionService } from '../services/caucionService';

const Financiacion = () => {
  const { user, signOut } = useAuth();
  const { currentPortfolio, loading: portfolioLoading } = usePortfolio();

  const [cauciones, setCauciones] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('financiacion'); // Estado para navegación del sidebar

  const loadCauciones = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [data, resumen] = await Promise.all([
        caucionService.getCauciones(user.id),
        caucionService.getResumen(user.id)
      ]);
      setCauciones(data);
      setMetrics(resumen);
    } catch (err) {
      console.error('Error cargando cauciones:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCauciones();
  }, [loadCauciones]);

  if (loading || portfolioLoading) {
    return <LoadingFallback />;
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
              onClick={loadCauciones}
              className="p-2 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors border border-border-primary"
              title="Actualizar datos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 overflow-x-hidden ${
          sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'
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
                  onClick={loadCauciones}
                  className="flex items-center gap-2 px-4 py-2 bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors border border-border-primary"
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </button>
              </div>
            </div>

            {/* Financing Dashboard Content */}
            <FinancingDashboard
              cauciones={cauciones}
              metrics={metrics}
              loading={loading}
              onRefresh={loadCauciones}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default Financiacion;