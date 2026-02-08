import React from 'react';
import logo from '@/assets/logo.png';
import { PortfolioSelector } from '@/features/portfolio/components/PortfolioSelector';

export const MobileHeader = () => {
    return (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <img src={logo} alt="Argos Capital" className="w-8 h-8" />
                    <h1 className="text-lg font-bold text-text-primary">Argos</h1>
                </div>
                <PortfolioSelector />
            </div>
        </div>
    );
};

export default MobileHeader;
