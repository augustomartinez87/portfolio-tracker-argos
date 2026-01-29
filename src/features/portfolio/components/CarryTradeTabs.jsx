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
        <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => navigate(`/carry-trade/${tab.id}`)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm ${activeTab === tab.id
                        ? 'bg-text-primary text-background-primary'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-background-tertiary'
                        }`}
                >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                </button>
            ))}
        </div>
    );
};
