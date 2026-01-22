import React, { useState } from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';

const ColumnToggle = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-background-tertiary rounded cursor-pointer transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-border-secondary bg-background-tertiary text-success focus:ring-success focus:ring-offset-background-primary"
    />
    <span className="text-sm text-text-secondary">{label}</span>
  </label>
);

const ColumnSelector = ({ settings, onSettingsChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 bg-background-secondary border border-border-primary rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-colors text-sm"
        title="Personalizar columnas"
      >
        <span className="text-base leading-none font-light">≡</span>
        <span>Columnas</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-background-secondary border border-border-primary rounded-lg shadow-xl p-3 min-w-[200px]">
            <p className="text-xs text-text-tertiary px-2 pb-2 mb-2 border-b border-border-primary">Mostrar/Ocultar columnas</p>
            <ColumnToggle
              label="PPC"
              checked={settings.showPPC}
              onChange={(v) => onSettingsChange({ ...settings, showPPC: v })}
            />
            <ColumnToggle
              label="Invertido"
              checked={settings.showInvertido}
              onChange={(v) => onSettingsChange({ ...settings, showInvertido: v })}
            />
            <ColumnToggle
              label="P&L Diario $"
              checked={settings.showDiario}
              onChange={(v) => onSettingsChange({ ...settings, showDiario: v })}
            />
            <ColumnToggle
              label="P&L Diario %"
              checked={settings.showDiarioPct}
              onChange={(v) => onSettingsChange({ ...settings, showDiarioPct: v })}
            />
            <div className="border-t border-border-primary mt-2 pt-2">
              <p className="text-xs text-text-tertiary px-2 pb-2">Densidad</p>
              <div className="flex gap-1 px-2">
                <button
                  onClick={() => onSettingsChange({ ...settings, density: 'compact' })}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    settings.density === 'compact'
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                  }`}
                  title="Vista compacta"
                >
                  <Minimize2 className="w-3 h-3" />
                  Compacta
                </button>
                <button
                  onClick={() => onSettingsChange({ ...settings, density: 'comfortable' })}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                    settings.density === 'comfortable'
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-tertiary'
                  }`}
                  title="Vista cómoda"
                >
                  <Maximize2 className="w-3 h-3" />
                  Cómoda
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ColumnSelector;
