import React from 'react';
import { LayoutDashboard, BarChart2, Upload } from 'lucide-react';

export const FciTabs = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'resumen', label: 'Resumen de Fondos', icon: LayoutDashboard },
        { id: 'analisis', label: 'Análisis Real', icon: BarChart2 },
        { id: 'carga-vcp', label: 'Carga VCP', icon: Upload },
    ];

    return (
        <div className="border-b border-border-secondary">
            <div className="flex gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
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
