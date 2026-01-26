
import React from 'react';

const RANGES = [
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1A', value: '1y' },
    { label: 'Max', value: 'all' },
];

export const getDateRange = (rangeValue) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today

    let startDate = null;

    switch (rangeValue) {
        case '1m':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 1);
            break;
        case '3m':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 3);
            break;
        case '6m':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 6);
            break;
        case 'ytd':
            startDate = new Date(today.getFullYear(), 0, 1);
            break;
        case '1y':
            startDate = new Date(today);
            startDate.setFullYear(today.getFullYear() - 1);
            break;
        case 'all':
        default:
            startDate = null; // No lower bound
    }

    return { startDate, endDate: now }; // endDate is always now for filters
};

export const DateRangeSelector = ({ selectedRange, onChange, className = '' }) => {
    return (
        <div className={`inline-flex bg-background-tertiary p-1 rounded-lg border border-border-secondary ${className}`}>
            {RANGES.map((range) => (
                <button
                    key={range.value}
                    onClick={() => onChange(range.value)}
                    className={`
            px-3 py-1 text-xs font-medium rounded-md transition-all
            ${selectedRange === range.value
                            ? 'bg-background-primary text-text-primary shadow-sm border border-border-primary/50'
                            : 'text-text-tertiary hover:text-text-primary hover:bg-background-secondary/50'}
          `}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
};
