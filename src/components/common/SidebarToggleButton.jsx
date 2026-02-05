import React from 'react';

export const SidebarToggleButton = ({ isExpanded, setIsExpanded }) => {
  return (
    <button
      type="button"
      onClick={() => setIsExpanded(!isExpanded)}
      aria-pressed={isExpanded}
      title={isExpanded ? 'Colapsar sidebar' : 'Expandir sidebar'}
      className="inline-flex items-center justify-center h-7 w-7 text-xs font-bold text-text-tertiary hover:text-text-primary transition-colors"
    >
      <span className="font-mono">{isExpanded ? '<<' : '>>'}</span>
    </button>
  );
};

export default SidebarToggleButton;
