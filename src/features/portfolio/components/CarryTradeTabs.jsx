import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Calculator } from 'lucide-react';

export const CarryTradeTabs = ({ activeTab }) => {
    const navigate = useNavigate();

    const tabs = [
        { id: 'analisis', label: 'Análisis de Mercado', icon: BarChart2 },
        { id: 'simulador', label: 'Simulador (Próximamente)', icon: Calculator },
    ];

    return (
        <div className="border-b border-border-secondary">
            <div className="flex gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => navigate(`/carry-trade/${tab.id}`)}
                        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
