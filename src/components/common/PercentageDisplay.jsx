import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';

export const PercentageDisplay = ({ value, className = '', showArrow = true, iconSize = "w-3 h-3", neutral = false }) => {
    const isPositive = value >= 0;
    const isZero = value === 0;

    // Default colors if not overridden by className
    // However, usually we want profit/loss logic
    // We'll apply text-profit/text-loss unless specific classes are passed that might conflict, 
    // but simpler to just apply them.

    // If neutral is true, don't apply profit/loss colors
    const textColor = neutral ? '' : (isPositive ? 'text-profit' : 'text-loss');

    return (
        <span className={`flex items-center font-mono ${textColor} ${className}`}>
            {showArrow && !isZero && !neutral && (
                isPositive
                    ? <ChevronUp className={`${iconSize} mr-0.5`} />
                    : <ChevronDown className={`${iconSize} mr-0.5`} />
            )}
            {formatPercent(value)}
        </span>
    );
};
