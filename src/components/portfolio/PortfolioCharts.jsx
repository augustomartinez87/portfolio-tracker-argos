import React, { useMemo } from 'react';
import DistributionChart from '../DistributionChart';
import TopPerformersChart from './charts/TopPerformersChart';
import CurrencyExposureChart from './charts/CurrencyExposureChart';
import RiskConcentrationChart from './charts/RiskConcentrationChart';

export const PortfolioCharts = ({ positions, currency = 'ARS' }) => {
    // Filter out FCIs as requested: "deja los FCI por afuera"
    const filteredPositions = useMemo(() => {
        return positions.filter(p => {
            const assetClass = (p.assetClass || '').toUpperCase();
            const ticker = (p.ticker || '').toUpperCase();
            return assetClass !== 'FCI' && !ticker.startsWith('FCI');
        });
    }, [positions]);

    if (filteredPositions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-background-secondary border border-border-primary rounded-xl">
                <p className="text-text-secondary mb-1">No hay datos suficientes para generar gráficos</p>
                <p className="text-text-tertiary text-xs">Agregá posiciones de Cedears, Acciones o Bonos para ver el análisis.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-background-secondary border border-border-primary rounded-xl p-6 shadow-sm">
                    <DistributionChart positions={filteredPositions} currency={currency} />
                </div>

                <div className="bg-background-secondary border border-border-primary rounded-xl p-6 shadow-sm">
                    <TopPerformersChart positions={filteredPositions} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-background-secondary border border-border-primary rounded-xl p-6 shadow-sm">
                    <CurrencyExposureChart positions={filteredPositions} currency={currency} />
                </div>

                <div className="bg-background-secondary border border-border-primary rounded-xl p-6 shadow-sm">
                    <RiskConcentrationChart positions={filteredPositions} currency={currency} />
                </div>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1 text-center">Analyst Insight</p>
                <p className="text-xs text-text-secondary text-center italic">
                    "Che, mirá bien la concentración en el Treemap. Si un solo activo ocupa mucho espacio, un estornudo del mercado te puede arruinar el P&L diario. La diversificación es tu mejor amiga."
                </p>
            </div>
        </div>
    );
};

export default PortfolioCharts;
