import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { PieChart, Plus, Download, Loader2, RefreshCw, Upload, FileUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { usePortfolio } from '@/features/portfolio/contexts/PortfolioContext';
import { DashboardSidebar } from '@/features/portfolio/components/DashboardSidebar';
import MobileNav from '@/components/common/MobileNav';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingFallback } from '@/components/common/LoadingSpinner';
// Importaciones diferidas
const FciLotTable = lazy(() => import('@/features/fci/components/FciLotTable'));
const FciLotsList = lazy(() => import('@/features/fci/components/FciLotsList'));
const FciLotModal = lazy(() => import('@/features/fci/components/FciLotModal'));
const AnalisisRealContent = lazy(() => import('@/features/fci/components/AnalisisRealContent'));
const FciPriceUploadModal = lazy(() => import('@/features/fci/components/FciPriceUploadModal'));
import { CurrencySelector } from '@/features/portfolio/components/CurrencySelector';
import { FciTabs } from '@/features/fci/components/FciTabs';
import SummaryCard from '@/components/common/SummaryCard';
import { PageHeader } from '@/components/common/PageHeader';
import { formatARS, formatUSD, formatPercent } from '@/utils/formatters';
import { PercentageDisplay } from '@/components/common/PercentageDisplay';
import { fciService } from '@/features/fci/services/fciService';
import { PortfolioEmptyState } from '@/components/common/PortfolioEmptyState';



export default function Fci() {
  const { user, signOut } = useAuth();
  const {
    currentPortfolio,
    loading: portfolioLoading,
    fciLotEngine,
    mepRate,
    mepHistory
  } = usePortfolio();

  const positions = fciLotEngine?.positions || [];
  const totals = fciLotEngine?.totals || { invested: 0, valuation: 0, pnl: 0, investedUSD: 0, valuationUSD: 0, pnlUSD: 0 };
  const allLots = fciLotEngine?.allLots || [];
  const refresh = fciLotEngine?.refresh || (() => {});
  const lugaresList = fciLotEngine?.lugaresList || [];
  const fciLoading = portfolioLoading || fciLotEngine?.loading || false;

  // useState declarations must come before useCallback that depends on them
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarPinned') === 'true';
  });
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebarPinned') === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarPinned', sidebarPinned ? 'true' : 'false');
    }
  }, [sidebarPinned]);

  const [displayCurrency, setDisplayCurrency] = useState('ARS');
  const [showHistory, setShowHistory] = useState(false);
  const [fciModalOpen, setFciModalOpen] = useState(false);
  const [fciModalType, setFciModalType] = useState('SUBSCRIPTION');
  const [selectedFci, setSelectedFci] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  // Estados para Carga VCP
  const [vcpFile, setVcpFile] = useState(null);
  const [vcpFciList, setVcpFciList] = useState([]);
  const [vcpSelectedFci, setVcpSelectedFci] = useState('');
  const [vcpUploading, setVcpUploading] = useState(false);
  const [vcpResult, setVcpResult] = useState(null);
  const [vcpLoadingFcis, setVcpLoadingFcis] = useState(false);

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

  const handleSaveLot = async (lotData) => {
    try {
      await fciLotEngine.addLot(lotData);
      setFciModalOpen(false);
    } catch (e) {
      console.error('Error saving FCI lot:', e);
      throw e;
    }
  };

  const handleRedeem = async (fciId, cuotapartes) => {
    try {
      await fciLotEngine.redeemFIFO(fciId, cuotapartes);
      setFciModalOpen(false);
    } catch (e) {
      console.error('Error applying redemption:', e);
      throw e;
    }
  };

  const handleDeleteLot = async (lotId) => {
    if (window.confirm('¿Estás seguro de eliminar este lote? Esto afectará tus saldos y carry trade.')) {
      await fciLotEngine.deleteLot(lotId);
    }
  };

  const handleEditLot = async (lotId, updates) => {
    await fciLotEngine.updateLot(lotId, updates);
  };

  // Cargar lista de FCIs para Carga VCP
  useEffect(() => {
    const loadFcis = async () => {
      setVcpLoadingFcis(true);
      try {
        const data = await fciService.getFcis();
        setVcpFciList(data || []);
        if (data.length > 0) setVcpSelectedFci(data[0].id);
      } catch (err) {
        console.error('Error loading FCIs:', err);
      } finally {
        setVcpLoadingFcis(false);
      }
    };
    loadFcis();
  }, []);

  // Funciones para Carga VCP
  const handleVcpFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setVcpFile(selectedFile);
      setVcpResult(null);
    }
  };

  const handleVcpUpload = async () => {
    if (!vcpFile || !vcpSelectedFci) return;

    setVcpUploading(true);
    setVcpResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const prices = [];
        let skipCount = 0;

        // Simple parser: fecha,vcp
        // Saltar primera línea si es header
        const startIdx = lines[0].toLowerCase().includes('fecha') ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Usar un separador dinámico si es posible, o probar los comunes
          let cols = [];
          if (line.includes(';')) {
            cols = line.split(';').map(s => s.trim());
          } else if (line.includes('\t')) {
            cols = line.split('\t').map(s => s.trim());
          } else {
            cols = line.split(',').map(s => s.trim());
          }

          let fechaRaw, vcpRaw;
          if (cols.length >= 3) {
            // Formato: fci, fecha, vcp (como genera process_bala.py)
            fechaRaw = cols[1];
            vcpRaw = cols[2];
          } else if (cols.length === 2) {
            // Formato: fecha, vcp
            fechaRaw = cols[0];
            vcpRaw = cols[1];
          } else {
            skipCount++;
            continue;
          }

          const vcp = parseFloat(vcpRaw.replace(/\./g, '').replace(',', '.'));

          if (fechaRaw && !isNaN(vcp)) {
            prices.push({ fecha: fechaRaw, vcp });
          } else {
            skipCount++;
          }
        }

        if (prices.length === 0) {
          setVcpResult({ type: 'error', message: 'No se encontraron datos válidos en el CSV.' });
          setVcpUploading(false);
          return;
        }

        await fciService.upsertPrices(vcpSelectedFci, prices);

        setVcpResult({
          type: 'success',
          message: `Carga exitosa: ${prices.length} registros procesados.${skipCount > 0 ? ` (${skipCount} omitidos por formato)` : ''}`
        });

        // Limpiar archivo después de carga exitosa
        setVcpFile(null);
        refresh();

      } catch (err) {
        console.error(err);
        setVcpResult({ type: 'error', message: 'Error procesando el archivo: ' + err.message });
      } finally {
        setVcpUploading(false);
      }
    };
    reader.readAsText(vcpFile);
  };

  const formatVal = useCallback((ars, usd) => {
    return displayCurrency === 'ARS' ? formatARS(ars || 0) : formatUSD(usd || 0);
  }, [displayCurrency]);

  const pnlPercent = useMemo(() => {
    if (displayCurrency === 'USD') {
      return (totals?.investedUSD && totals.investedUSD > 0) ? (totals.pnlUSD / totals.investedUSD) * 100 : 0;
    }
    return (totals?.invested && totals.invested > 0) ? (totals.pnl / totals.invested) * 100 : 0;
  }, [totals, displayCurrency]);

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
                  isPinned={sidebarPinned}
                  setIsPinned={setSidebarPinned}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <SummaryCard
                          title="Invertido"
                          value={formatVal(totals.invested, totals.investedUSD)}
                          subtitle="Total invertido"
                        />
                        <SummaryCard
                          title="Valuación"
                          value={formatVal(totals.valuation, totals.valuationUSD)}
                        />
                        <SummaryCard
                          title="P&L"
                          value={formatVal(totals.pnl, totals.pnlUSD)}
                          trend={totals.pnl}
                          showBadge
                          badgeValue={
                            <PercentageDisplay
                              value={pnlPercent}
                              className="!text-current"
                              iconSize="w-2.5 h-2.5"
                            />
                          }
                        />
                        <SummaryCard
                          title="Rendimiento"
                          value={formatPercent(pnlPercent)}
                          trend={pnlPercent}
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
                            <FciLotsList
                              allLots={allLots}
                              onDelete={handleDeleteLot}
                              currency={displayCurrency}
                              mepHistory={mepHistory}
                            />
                          </Suspense>
                        ) : (
                          <Suspense fallback={<LoadingFallback />}>
                            <FciLotTable
                              positions={positions}
                              onSubscribe={handleOpenSubscription}
                              onRedeem={handleOpenRedemption}
                              onEditLot={handleEditLot}
                              onDeleteLot={handleDeleteLot}
                              onAddLugar={(nombre) => fciLotEngine.addLugar(user?.id, nombre)}
                              lugaresList={lugaresList}
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
                  ) : activeTab === 'carga-vcp' ? (
                    <div className="space-y-6">
                      {/* Sección de Carga VCP - Funcional */}
                      <div className="bg-background-secondary rounded-xl border border-border-primary p-6">
                        <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                          <Upload className="w-5 h-5 text-primary" />
                          Cargar VCP (CSV/Excel)
                        </h3>
                        <p className="text-sm text-text-tertiary mb-6">
                          Sube el historial de Valor Cuotaparte (VCP) para calcular la TNA real del FCI.
                        </p>
                        
                        {/* Selector de FCI */}
                        <div className="mb-6">
                          <label className="block text-xs font-semibold text-text-tertiary uppercase mb-2">
                            Seleccionar Fondo
                          </label>
                          <select
                            value={vcpSelectedFci}
                            onChange={(e) => setVcpSelectedFci(e.target.value)}
                            disabled={vcpLoadingFcis || vcpUploading}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                          >
                            {vcpLoadingFcis ? (
                              <option>Cargando fondos...</option>
                            ) : vcpFciList.length === 0 ? (
                              <option>No hay fondos disponibles</option>
                            ) : (
                              vcpFciList.map(f => (
                                <option key={f.id} value={f.id}>{f.nombre}</option>
                              ))
                            )}
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Upload Area - Funcional */}
                          <div className="bg-background-tertiary rounded-xl border border-border-primary p-6">
                            <label className={`flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all ${vcpFile ? 'border-primary/50 bg-primary/5' : 'border-border-secondary hover:border-primary/30'}`}>
                              {vcpFile ? (
                                <>
                                  <FileUp className="w-12 h-12 text-primary" />
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-text-primary mb-1">
                                      {vcpFile.name}
                                    </p>
                                    <p className="text-xs text-text-tertiary">
                                      Click para cambiar archivo
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Download className="w-12 h-12 text-text-tertiary" />
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-text-primary mb-1">
                                      Arrastra tu archivo aquí o haz clic para seleccionar
                                    </p>
                                    <p className="text-xs text-text-tertiary">
                                      Formatos soportados: .csv, .xlsx
                                    </p>
                                  </div>
                                </>
                              )}
                              <input 
                                type="file" 
                                accept=".csv,.xlsx" 
                                className="hidden" 
                                onChange={handleVcpFileChange}
                                disabled={vcpUploading}
                              />
                            </label>
                            
                            {/* Botón de Carga */}
                            <button
                              onClick={handleVcpUpload}
                              disabled={!vcpFile || !vcpSelectedFci || vcpUploading || vcpFciList.length === 0}
                              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {vcpUploading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Procesando...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  {vcpFile ? 'Subir VCP' : 'Selecciona un archivo'}
                                </>
                              )}
                            </button>
                            
                            {/* Feedback */}
                            {vcpResult && (
                              <div className={`mt-4 p-3 rounded-lg flex items-start gap-3 text-sm ${vcpResult.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {vcpResult.type === 'success' ? (
                                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                )}
                                <p>{vcpResult.message}</p>
                              </div>
                            )}
                            
                            {/* Botón alternativo: Abrir Modal */}
                            <div className="mt-4 pt-4 border-t border-border-primary">
                              <button
                                onClick={() => setUploadModalOpen(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background-secondary border border-border-primary text-text-secondary rounded-lg hover:bg-background-primary hover:text-text-primary transition-all text-xs font-medium"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Abrir Modal de Carga Avanzada
                              </button>
                            </div>
                          </div>
                          
                          {/* Template Info */}
                          <div className="bg-background-tertiary rounded-xl border border-border-primary p-6">
                            <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                              <PieChart className="w-4 h-4 text-warning" />
                              Formato del CSV
                            </h4>
                            
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs text-text-tertiary mb-2">Columnas requeridas:</p>
                                <div className="bg-background-secondary rounded-lg p-3 font-mono text-xs text-text-secondary space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-primary">Fecha</span>
                                    <span className="text-text-tertiary">YYYY-MM-DD</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-primary">ValorCuotaparte</span>
                                    <span className="text-text-tertiary">0.0000</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-xs text-text-tertiary mb-2">Ejemplo:</p>
                                <div className="bg-background-secondary rounded-lg p-3 font-mono text-[10px] text-text-secondary">
                                  <div className="text-text-tertiary border-b border-border-primary pb-2 mb-2">
                                    Fecha,ValorCuotaparte
                                  </div>
                                  <div>2024-01-15,1.0234</div>
                                  <div>2024-01-16,1.0241</div>
                                  <div>2024-01-17,1.0248</div>
                                  <div>2024-01-18,1.0255</div>
                                  <div className="text-text-tertiary mt-2">...</div>
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const csvContent = `Fecha,ValorCuotaparte\n2024-01-01,1.0000\n2024-01-02,1.0005\n2024-01-03,1.0010`;
                                    const blob = new Blob([csvContent], { type: 'text/csv' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'template-vcp.csv';
                                    a.click();
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-background-secondary border border-border-primary rounded-lg hover:bg-background-primary transition-all text-xs font-medium"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Descargar Template
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Info Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-background-secondary rounded-xl border border-border-primary p-4">
                          <h4 className="text-sm font-bold text-text-primary mb-2">¿Para qué sirve?</h4>
                          <p className="text-xs text-text-tertiary">
                            El historial de VCP permite calcular la TNA real del FCI para compararla con la caución y optimizar tu estrategia de carry trade.
                          </p>
                        </div>
                        <div className="bg-background-secondary rounded-xl border border-border-primary p-4">
                          <h4 className="text-sm font-bold text-text-primary mb-2">Frecuencia</h4>
                          <p className="text-xs text-text-tertiary">
                            Recomendamos cargar los VCP diarios. Puedes subir archivos con múltiples días de una sola vez.
                          </p>
                        </div>
                        <div className="bg-background-secondary rounded-xl border border-border-primary p-4">
                          <h4 className="text-sm font-bold text-text-primary mb-2">Fuentes</h4>
                          <p className="text-xs text-text-tertiary">
                            Descarga el VCP desde la web de tu fondo (Adcap, Balanz, etc.) o usa el estado de cuenta mensual.
                          </p>
                        </div>
                      </div>
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
          <FciLotModal
            isOpen={fciModalOpen}
            onClose={() => setFciModalOpen(false)}
            onSaveLot={handleSaveLot}
            onRedeem={handleRedeem}
            portfolioId={currentPortfolio?.id}
            userId={user?.id}
            lugaresList={lugaresList}
            initialFci={selectedFci}
            initialType={fciModalType}
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
