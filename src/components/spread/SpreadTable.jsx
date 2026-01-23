import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { formatARS, formatPercent } from '../../utils/formatters';

const sortCauciones = (data, config) => {
  if (!config) return data;

  return [...data].sort((a, b) => {
    let aVal, bVal;

    switch (config.key) {
      case 'fecha_inicio':
      case 'fecha_fin':
        aVal = new Date(a[config.key]);
        bVal = new Date(b[config.key]);
        break;
      case 'capital':
      case 'monto_devolver':
      case 'interes':
        aVal = a[config.key] || (a.monto_devolver - a.capital);
        bVal = b[config.key] || (b.monto_devolver - b.capital);
        break;
      case 'tna_real':
        aVal = a.tasa_tna || 0;
        bVal = b.tasa_tna || 0;
        break;
      case 'dias':
        aVal = Math.ceil((new Date(a.fecha_fin) - new Date(a.fecha_inicio)) / (1000 * 60 * 60 * 24));
        bVal = Math.ceil((new Date(b.fecha_fin) - new Date(b.fecha_inicio)) / (1000 * 60 * 60 * 24));
        break;
      default:
        aVal = a[config.key];
        bVal = b[config.key];
    }

    if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
    return 0;
  });
};

const SortHeader = ({ label, sortKey, currentSort, onSort }) => {
  const isActive = currentSort?.key === sortKey;
  const isAsc = isActive && currentSort.direction === 'asc';

  return (
    <th
      className="text-left px-3 py-3 text-xs font-medium text-text-tertiary cursor-pointer select-none hover:text-text-primary transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <span className="opacity-25">↓</span>
        )}
      </div>
    </th>
  );
};

const SpreadTable = ({ cauciones, onDelete, loading }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'fecha_fin', direction: 'desc' });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const sortedData = useMemo(() => {
    return sortCauciones(cauciones, sortConfig);
  }, [cauciones, sortConfig]);

  const calculateDias = (c) => {
    const dias = Math.ceil((new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / (1000 * 60 * 60 * 24));
    return dias > 0 ? dias : 0;
  };

  const calculateInteres = (c) => {
    return (c.monto_devolver || 0) - (c.capital || 0);
  };

  if (loading) {
    return (
      <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
        <div className="animate-pulse p-8">
          <div className="h-4 bg-background-tertiary rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-background-tertiary rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (cauciones.length === 0) {
    return (
      <div className="bg-background-secondary rounded-xl border border-border-primary p-8 text-center">
        <p className="text-text-secondary mb-1">No hay operaciones cargadas</p>
        <p className="text-text-tertiary text-sm">
          Subí comprobantes de caución para ver el historial
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-background-tertiary/50 border-b border-border-primary">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary">
                Archivo
              </th>
              <SortHeader
                label="Fecha inicio"
                sortKey="fecha_inicio"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortHeader
                label="Fecha fin"
                sortKey="fecha_fin"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortHeader
                label="Capital"
                sortKey="capital"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortHeader
                label="Interés"
                sortKey="interes"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortHeader
                label="Días"
                sortKey="dias"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortHeader
                label="TNA real"
                sortKey="tna_real"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            {sortedData.map((c) => {
              const dias = calculateDias(c);
              const interes = calculateInteres(c);

              return (
                <tr
                  key={c.id}
                  className="hover:bg-background-tertiary transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-text-secondary text-xs font-mono truncate max-w-[150px] block">
                      {c.pdf_filename || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-text-primary text-sm font-mono tabular-nums">
                    {c.fecha_inicio}
                  </td>
                  <td className="px-3 py-3 text-text-primary text-sm font-mono tabular-nums">
                    {c.fecha_fin}
                  </td>
                  <td className="px-3 py-3 text-text-primary text-sm font-mono tabular-nums">
                    {formatARS(c.capital)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-success font-mono text-sm font-medium tabular-nums">
                      +{formatARS(interes)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-text-secondary text-sm font-mono tabular-nums text-center">
                    {dias}
                  </td>
                  <td className="px-3 py-3">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-mono font-medium">
                      {formatPercent(c.tasa_tna / 100, 2)}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => onDelete(c.id)}
                      className="p-1.5 hover:bg-danger/10 rounded transition-colors text-text-tertiary hover:text-danger"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpreadTable;
