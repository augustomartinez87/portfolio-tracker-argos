import React from 'react';
import { LayoutDashboard, BarChart2, Upload } from 'lucide-react';

export const FciTabs = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'resumen', label: 'Resumen de Fondos', icon: LayoutDashboard },
        { id: 'analisis', label: 'Análisis Real', icon: BarChart2 },
        { id: 'carga-vcp', label: 'Carga VCP', icon: Upload },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
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
