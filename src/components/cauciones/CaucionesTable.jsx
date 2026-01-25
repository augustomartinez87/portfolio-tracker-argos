import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Trash2, AlertTriangle, Check } from 'lucide-react';
import { formatARS, formatPercent } from '../../utils/formatters';

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

const CaucionesTable = ({ cauciones, onDelete, onDeleteAll, loading }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'fecha_fin', direction: 'desc' });
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!cauciones || cauciones.length === 0) return [];
    
    return [...cauciones].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'fecha_inicio':
        case 'fecha_fin':
          aVal = new Date(a[sortConfig.key]);
          bVal = new Date(b[sortConfig.key]);
          break;
        case 'capital':
        case 'monto_devolver':
        case 'interes':
          aVal = a[sortConfig.key] || a.interes;
          bVal = b[sortConfig.key] || b.interes;
          break;
        case 'tna_real':
          aVal = a.tna_real || 0;
          bVal = b.tna_real || 0;
          break;
        case 'dias':
          aVal = a.dias || 0;
          bVal = b.dias || 0;
          break;
        default:
          aVal = a[sortConfig.key];
          bVal = b[sortConfig.key];
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [cauciones, sortConfig]);

  const handleSelectForDelete = (id) => {
    setSelectedForDelete(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedForDelete.length === cauciones.length) {
      setSelectedForDelete([]);
    } else {
      setSelectedForDelete(cauciones.map(c => c.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedForDelete.length === 0) return;
    
    if (window.confirm(`¿Estás seguro que deseas eliminar ${selectedForDelete.length} cauciones? Esta acción no se puede deshacer.`)) {
      try {
        await Promise.all(selectedForDelete.map(id => onDelete(id)));
        setSelectedForDelete([]);
        setShowDeleteConfirm(false);
      } catch (error) {
        console.error('Error eliminando cauciones:', error);
        alert('Error al eliminar cauciones. Por favor intenta nuevamente.');
      }
    }
  };

  const handleDeleteAll = async () => {
    if (cauciones.length === 0) return;
    
    if (window.confirm(`¿Estás seguro que deseas eliminar TODAS las cauciones (${cauciones.length})? Esta acción no se puede deshacer.`)) {
      try {
        await onDeleteAll();
        setSelectedForDelete([]);
      } catch (error) {
        console.error('Error eliminando todas las cauciones:', error);
        alert('Error al eliminar todas las cauciones. Por favor intenta nuevamente.');
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
        <div className="animate-pulse p-8">
          <div className="h-4 bg-background-tertiary rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-background-tertiary rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con controles */}
      <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border-primary flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-text-primary">Cauciones</h2>
            <span className="text-xs text-text-tertiary bg-background-tertiary px-2 py-0.5 rounded-full">
              {sortedData.length}{sortedData.length !== cauciones.length && `/${cauciones.length}`}
            </span>
          </div>
          
          <div className="flex gap-2">
            {selectedForDelete.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Eliminar ({selectedForDelete.length})</span>
              </button>
            )}
            
            {cauciones.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors text-xs font-medium border border-danger/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Borrar todas</span>
              </button>
            )}
          </div>
        </div>

        {/* Mensaje de confirmación */}
        {selectedForDelete.length > 0 && (
          <div className="px-4 py-2 bg-warning/10 text-warning border-b border-warning/30 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                {selectedForDelete.length} caucion{selectedForDelete.length !== 1 ? 'es' : ''} seleccionada{selectedForDelete.length !== 1 ? 's' : ''} para eliminar
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-background-tertiary/50 border-b border-border-primary">
              <tr>
                <th className="text-left px-3 py-3 text-xs font-medium text-text-tertiary w-10">
                  <input
                    type="checkbox"
                    checked={selectedForDelete.length === cauciones.length && cauciones.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-border-primary"
                    title="Seleccionar todas"
                  />
                </th>
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
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-text-tertiary text-sm">
                    {cauciones.length === 0 
                      ? 'No hay operaciones de caución registradas' 
                      : 'No hay cauciones que coincidan con los filtros'
                    }
                  </td>
                </tr>
              ) : (
                sortedData.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-background-tertiary transition-colors"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedForDelete.includes(c.id)}
                        onChange={() => handleSelectForDelete(c.id)}
                        className="rounded border-border-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-text-secondary text-xs font-mono truncate max-w-[150px] block">
                        {c.pdf_filename || c.archivo || '-'}
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
                        +{formatARS(c.interes)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-text-secondary text-sm font-mono tabular-nums text-center">
                      {c.dias}
                    </td>
                    <td className="px-3 py-3">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-mono font-medium">
                        {formatPercent(c.tna_real / 100, 2)}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta caución? Esta acción no se puede deshacer.')) {
                            onDelete(c.id);
                          }
                        }}
                        className="p-1.5 hover:bg-danger/10 rounded transition-colors text-text-tertiary hover:text-danger"
                        title="Eliminar caución"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CaucionesTable;