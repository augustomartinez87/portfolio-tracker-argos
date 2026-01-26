
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const MarketStatus = ({ market = 'MERVAL', sentiment = 'bullish', compact = false }) => {
    // Logic to determine color and icon based on sentiment
    // In a real app, this data would come from a Context or API

    const getConfig = (s) => {
        switch (s) {
            case 'bullish': return { color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', icon: TrendingUp, label: 'Alcista' };
            case 'bearish': return { color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20', icon: TrendingDown, label: 'Bajista' };
            default: return { color: 'text-text-tertiary', bg: 'bg-background-tertiary', border: 'border-border-secondary', icon: Minus, label: 'Neutral' };
        }
    };

    const config = getConfig(sentiment);
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border} transition-all`}>
            <div className="flex flex-col leading-none">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">{market}</span>
                {!compact && <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>}
            </div>
            <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
    );
};
