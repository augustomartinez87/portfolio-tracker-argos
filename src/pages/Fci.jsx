import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { PieChart, Plus, Download, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import MobileNav from '@/components/common/MobileNav';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingFallback } from '@/components/common/LoadingSpinner';
import { tradeService } from '@/features/portfolio/services/tradeService';
// useFciEngine y usePrices eliminados por redundancia con el contexto
// Importaciones diferidas para evitar TDZ
const FciTable = lazy(() => import('@/features/fci/components/FciTable'));
const FciTransactionsList = lazy(() => import('@/features/fci/components/FciTransactionsList'));
// Importaciones diferidas para mayor resiliencia
const AnalisisRealContent = lazy(() => import('@/features/fci/components/AnalisisRealContent'));
const FciPriceUploadModal = lazy(() => import('@/features/fci/components/FciPriceUploadModal'));
const FciTransactionModal = lazy(() => import('../features/fci/components/FciTransactionModal'));
import { CurrencySelector } from '@/features/portfolio/components/CurrencySelector';
import { FciTabs } from '@/features/fci/components/FciTabs';
import SummaryCard from '@/components/common/SummaryCard';
import { PageHeader } from '@/components/common/PageHeader';
import { formatARS, formatUSD, formatPercent } from '@/utils/formatters';
import { fciService } from '@/features/fci/services/fciService';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';



export default function Fci() {
  const { user, signOut } = useAuth();
  const {
    currentPortfolio,
    loading: portfolioLoading,
    fciPositions: positions,
    fciTotals: totals,
    fciTransactions: transactions,
    refreshFci: refresh,
    mepRate,
    mepHistory
  } = usePortfolio();

  const fciLoading = portfolioLoading; // Ahora se maneja centralizado

  const deleteTransaction = async (id) => {
    await fciService.deleteTransaction(id);
    refresh();
  };

  const addTransaction = async (tx) => {
    await fciService.createTransaction(tx);
    refresh();
  };

  const handleOpenSubscription = useCallback((fci = null) => {
    setFciModalType('SUBSCRIPTION');
    setSelectedFci(fci);
    setFciModalOpen(true);
  }, []);

  const handleOpenRedemption = useCallback((fci = null) => {
    setFciModalType('REDEMPTION');
    setSelectedFci(fci);
    setFciModalOpen(true);
  }, []);

  const handleSaveTransaction = async (tx) => {
    try {
      await addTransaction({ ...tx, user_id: user.id });
      setFciModalOpen(false);
    } catch (e) {
      console.error('Error saving FCI transaction:', e);
      throw e;
    }
  };

  // useState declarations must come before useCallback that depends on them
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState('ARS');
  const [showHistory, setShowHistory] = useState(false);
  const [fciModalOpen, setFciModalOpen] = useState(false);
  const [fciModalType, setFciModalType] = useState('SUBSCRIPTION');
  const [selectedFci, setSelectedFci] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  const formatVal = useCallback((ars, usd) => {
    return displayCurrency === 'ARS' ? formatARS(ars || 0) : formatUSD(usd || 0);
  }, [displayCurrency]);

  const pnlPercent = (totals?.invested && totals.invested > 0) ? (totals.pnl / totals.invested) * 100 : 0;

  if (portfolioLoading && !currentPortfolio) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
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

        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 pb-20 lg:pb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'}`}>
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
            <PageHeader
              title="Fondos"
              subtitle="Operaciones e Historial"
              icon={PieChart}
              loading={fciLoading}
              onRefresh={refresh}
              displayCurrency={displayCurrency}
              onCurrencyChange={setDisplayCurrency}
              onHelpClick={() => setActiveTab('resumen')}
            />

            {!currentPortfolio ? (
              <PortfolioEmptyState title="Sin Portfolio" message="Crea un portfolio para empezar a operar con Fondos Comunes de Inversión." />
            ) : (
              <>
                {/* Sub-navigation (Tabs) like Dashboard */}
                <div className="bg-background-secondary/50 border border-border-primary rounded-lg p-1">
                  <FciTabs activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>


                <div className="flex-1 overflow-auto min-h-0 pr-1">
                  {activeTab === 'resumen' ? (
                    <div className="space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <SummaryCard
                          label="Valuación Total"
                          value={formatVal(totals.valuation, totals.valuationUSD)}
                          variant="primary"
                        />
                        <SummaryCard
                          label="Invertido"
                          value={formatVal(totals.invested, totals.investedUSD)}
                        />
                        <SummaryCard
                          label="Resultado"
                          value={formatVal(totals.pnl, totals.pnlUSD)}
                          variant={totals.pnl >= 0 ? 'success' : 'danger'}
                        />
                        <SummaryCard
                          label="Rendimiento"
                          value={formatPercent(pnlPercent)}
                          variant={totals.pnl >= 0 ? 'success' : 'danger'}
                        />
                      </div>

                      {/* Main Content */}
                      <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
                        <div className="p-3 lg:p-4 border-b border-border-primary flex flex-wrap gap-2 items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowHistory(!showHistory)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${showHistory
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-background-tertiary text-text-secondary border-border-primary hover:text-text-primary'
                                }`}
                            >
                              {showHistory ? 'Ver Posiciones' : 'Ver Historial'}
                            </button>
                            <button
                              onClick={() => setUploadModalOpen(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-background-tertiary text-text-secondary border border-border-primary rounded-lg hover:text-text-primary transition-all text-xs font-medium"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Subir VCP
                            </button>
                          </div>
                          <button
                            onClick={() => handleOpenSubscription()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-profit text-white rounded-lg hover:bg-profit/90 transition-all text-xs font-medium shadow-lg shadow-profit/20"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Nueva Operación
                          </button>
                        </div>

                        {fciLoading ? (
                          <div className="p-8 flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : showHistory ? (
                          <Suspense fallback={<LoadingFallback />}>
                            <FciTransactionsList
                              transactions={transactions}
                              onDelete={deleteTransaction}
                              currency={displayCurrency}
                              mepHistory={mepHistory}
                            />
                          </Suspense>
                        ) : (
                          <Suspense fallback={<LoadingFallback />}>
                            <FciTable
                              positions={positions}
                              onSubscribe={handleOpenSubscription}
                              onRedeem={handleOpenRedemption}
                              currency={displayCurrency}
                              mepRate={mepRate}
                            />
                          </Suspense>
                        )}
                      </div>

                      {/* Info Card */}
                      {positions.length === 0 && !fciLoading && (
                        <div className="bg-background-secondary border border-border-primary rounded-xl p-6 text-center">
                          <PieChart className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
                          <h3 className="text-lg font-semibold text-text-primary mb-2">
                            Sin posiciones en FCIs
                          </h3>
                          <p className="text-text-tertiary text-sm mb-4">
                            Registra tu primera suscripción para comenzar a trackear tus fondos comunes de inversión.
                          </p>
                          <button
                            onClick={() => handleOpenSubscription()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Agregar Primera Suscripción
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Suspense fallback={<LoadingFallback />}>
                      <AnalisisRealContent />
                    </Suspense>
                  )}
                </div>
              </>
            )}
          </div>
        </main>

        <Suspense fallback={<LoadingFallback />}>
          <FciTransactionModal
            isOpen={fciModalOpen}
            onClose={() => setFciModalOpen(false)}
            onSave={handleSaveTransaction}
            portfolioId={currentPortfolio?.id}
            initialType={fciModalType}
            initialFci={selectedFci}
          />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <FciPriceUploadModal
            isOpen={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            onRefresh={refresh}
          />
        </Suspense>

        <MobileNav />
      </div>
    </ErrorBoundary>
  );
}
