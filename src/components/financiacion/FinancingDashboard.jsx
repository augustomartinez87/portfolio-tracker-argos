import React, { useState, useCallback, useEffect } from 'react';
import { TrendingUp, Upload, BarChart3, Filter } from 'lucide-react';
import FinancingKPIs from './FinancingKPIs';
import CSVUploadView from './CSVUploadView';
import FinancingCharts from './FinancingCharts';
import SummaryCard from '../common/SummaryCard';

const FinancingDashboard = ({ cauciones, metrics, loading, onRefresh }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [kpisData, setKpisData] = useState(null);

  const handleCSVProcessed = useCallback((processedData) => {
    console.log('FinancingDashboard - handleCSVProcessed llamado con:', processedData);
    console.log('FinancingDashboard - kpisData ANTES de actualizar:', kpisData);
    setKpisData(processedData);
    setTimeout(() => {
      console.log('FinancingDashboard - kpisData DESPUÉS de actualizar (setTimeout):', kpisData);
    }, 100);
    console.log('FinancingDashboard - Llamando a onRefresh...');
    // Refrescar datos principales después del procesamiento
    onRefresh();
  }, [onRefresh, kpisData]); // Agregar kpisData a dependencias

  // Agregar useEffect para monitorear cambios en kpisData
  useEffect(() => {
    console.log('FinancingDashboard - kpisData cambió a:', kpisData);
  }, [kpisData]);

  const viewOptions = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'upload', label: 'Cargar CSV', icon: Upload },
    { id: 'charts', label: 'Análisis', icon: TrendingUp },
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                activeView === option.id
                  ? 'bg-primary text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-background-tertiary'
              }`}
            >
              <option.icon className="w-4 h-4" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs Cards - Always visible */}
      <FinancingKPIs 
        key={`kpis-${kpisData?.summary?.totalRecords || 0}-${metrics?.capitalTotal || 0}`}
        metrics={metrics} 
        csvData={kpisData} 
        cauciones={cauciones}
        loading={loading} 
      />

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
            ) : cauciones.length > 0 ? (
              <div className="space-y-4">
                <SummaryCard
                  title="Total de Operaciones"
                  value={cauciones.length}
                  subValue="Último período"
                  icon={BarChart3}
                />
                <div className="text-text-tertiary">
                  <p>• Capital promedio por operación: ${metrics?.capitalPromedio?.toLocaleString?.('es-AR') || '—'}</p>
                  <p>• Tasa promedio: {metrics?.tnaPromedioPonderada?.toFixed?.(2) || '—'}%</p>
                  <p>• Duración promedio: {metrics?.diasPromedio || '—'} días</p>
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
          <CSVUploadView onProcessed={handleCSVProcessed} />
        )}

        {activeView === 'charts' && (
          <FinancingCharts 
            cauciones={cauciones} 
            csvData={kpisData}
            loading={loading} 
          />
        )}
      </div>
    </div>
  );
};

export default FinancingDashboard;