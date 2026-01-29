import React from 'react';
import { Plus, FolderPlus, HelpCircle } from 'lucide-react';
import { PortfolioSelector } from '../../features/portfolio/components/PortfolioSelector';

export const PortfolioEmptyState = ({ title = "No tienes portfolios", message = "Crea tu primer portfolio para empezar a trackear tus inversiones." }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-background-tertiary rounded-full flex items-center justify-center mb-6 border border-border-primary shadow-inner">
                <FolderPlus className="w-10 h-10 text-text-tertiary" />
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-2">{title}</h2>
            <p className="text-text-tertiary max-w-md mb-8 leading-relaxed">
                {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="bg-success/10 p-1 rounded-xl border border-success/20">
                    <PortfolioSelector showCreateOnly={true} />
                </div>

                <button
                    onClick={() => window.open('https://github.com/augustomartinez87/portfolio-tracker-argos', '_blank')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-background-secondary text-text-secondary hover:text-text-primary border border-border-primary rounded-xl transition-all font-medium"
                >
                    <HelpCircle className="w-4 h-4" />
                    Ver Guía
                </button>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
                <div className="p-4 bg-background-secondary/50 border border-border-primary rounded-xl text-left">
                    <div className="text-success font-bold mb-1">1. Crear</div>
                    <p className="text-xs text-text-tertiary">Define un nombre para tu portfolio personal o de empresa.</p>
                </div>
                <div className="p-4 bg-background-secondary/50 border border-border-primary rounded-xl text-left">
                    <div className="text-primary font-bold mb-1">2. Cargar</div>
                    <p className="text-xs text-text-tertiary">Agrega tus trades manualmente o importa un archivo CSV.</p>
                </div>
                <div className="p-4 bg-background-secondary/50 border border-border-primary rounded-xl text-left">
                    <div className="text-amber-500 font-bold mb-1">3. Analizar</div>
                    <p className="text-xs text-text-tertiary">Visualiza tu distribución, PnL y métricas en tiempo real.</p>
                </div>
            </div>
        </div>
    );
};
