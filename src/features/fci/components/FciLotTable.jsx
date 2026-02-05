import React, { useState } from 'react';
import { ChevronRight, Plus, Minus, Pencil, Trash2, Check, X } from 'lucide-react';
import { formatARS, formatUSD, formatPercent, formatNumber } from '@/utils/formatters';

const PnlCell = ({ value, pct, currency, usdValue }) => {
    const isPositive = value >= 0;
    const formatted = currency === 'ARS' ? formatARS(value) : formatUSD(usdValue ?? value);
    return (
        <div className="flex flex-col items-end">
            <span className={`text-sm font-mono font-bold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                {formatted}
            </span>
            {pct !== undefined && (
                <span className={`text-[10px] font-mono ${isPositive ? 'text-profit' : 'text-loss'}`}>
                    {formatPercent(pct)}
                </span>
            )}
        </div>
    );
};

// Inline editor para campos del lot
const LotInlineEditor = ({ lot, lugaresList, onSave, onCancel }) => {
    const [lugarId, setLugarId] = useState(lot.lugar_id || '');
    const [notes, setNotes] = useState(lot.notes || '');

    return (
        <tr className="bg-primary/5 border-t border-primary/20">
            <td className="px-4 py-2" colSpan={2}>
                <div className="flex items-center gap-2 ml-6">
                    <select
                        value={lugarId}
                        onChange={(e) => setLugarId(e.target.value)}
                        className="px-2 py-1 bg-background-tertiary border border-border-secondary rounded text-xs text-text-primary focus:outline-none focus:border-primary"
                    >
                        <option value="">Sin lugar</option>
                        {lugaresList.map(l => (
                            <option key={l.id} value={l.id}>{l.nombre}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notas..."
                        className="flex-1 px-2 py-1 bg-background-tertiary border border-border-secondary rounded text-xs text-text-primary focus:outline-none focus:border-primary"
                    />
                </div>
            </td>
            <td className="px-4 py-2" colSpan={7} />
            <td className="px-4 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                    <button
                        onClick={() => onSave({ lugar_id: lugarId || null, notes: notes || null })}
                        className="p-1 text-profit hover:bg-profit/10 rounded transition-colors"
                        title="Guardar"
                    >
                        <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onCancel}
                        className="p-1 text-text-tertiary hover:text-loss hover:bg-loss/10 rounded transition-colors"
                        title="Cancelar"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const FciLotTable = ({ positions, onSubscribe, onRedeem, onEditLot, onDeleteLot, lugaresList = [], currency = 'ARS', mepRate = 1 }) => {
    const [expanded, setExpanded] = useState({});
    const [editingLotId, setEditingLotId] = useState(null);

    if (!positions || positions.length === 0) {
        return (
            <div className="p-8 text-center text-text-tertiary">
                <p>No tienes tenencias en Fondos Comunes de Inversión.</p>
            </div>
        );
    }

    const toggleExpand = (fciId) => {
        setExpanded(prev => ({ ...prev, [fciId]: !prev[fciId] }));
    };

    const formatVal = (arsVal, usdVal) => currency === 'ARS' ? formatARS(arsVal) : formatUSD(usdVal ?? arsVal);

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
                <thead>
                    <tr className="bg-background-tertiary text-left text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                        <th className="px-4 py-2 w-8" />
                        <th className="px-4 py-2">Fondo</th>
                        <th className="px-4 py-2 text-right">Cuotapartes</th>
                        <th className="px-4 py-2 text-right">VCP Actual</th>
                        <th className="px-4 py-2 text-right">VCP PPC</th>
                        <th className="px-4 py-2 text-right">Valuación</th>
                        <th className="px-4 py-2 text-right">PnL Diario</th>
                        <th className="px-4 py-2 text-right">PnL Acum</th>
                        <th className="px-4 py-2 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                    {positions.map((pos) => {
                        const isExp = expanded[pos.fciId];
                        const pnlAcumPct = pos.capitalInvertido > 0
                            ? (pos.pnlAcumulado / pos.capitalInvertido) * 100
                            : 0;
                        const vcpDisplay = currency === 'ARS' ? pos.vcpActual : (pos.vcpActual / mepRate);
                        const vcpPpcDisplay = currency === 'ARS' ? pos.vcpPPC : (pos.vcpPPC / mepRate);

                        return (
                            <React.Fragment key={pos.fciId}>
                                {/* Fila agregada por fondo */}
                                <tr className="hover:bg-background-tertiary transition-all duration-200 group bg-background-secondary/50">
                                    <td className="px-2 py-3 text-center">
                                        <button
                                            onClick={() => toggleExpand(pos.fciId)}
                                            className="text-text-tertiary hover:text-text-primary transition-colors"
                                        >
                                            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExp ? 'rotate-90' : ''}`} />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-text-primary text-sm">{pos.name}</span>
                                            <span className="text-[10px] text-text-tertiary">
                                                {pos.priceDate
                                                    ? `VCP al ${new Date(pos.priceDate + 'T00:00:00').toLocaleDateString('es-AR')}`
                                                    : 'Sin precio'}
                                                {' · '}{pos.lots.length} {pos.lots.length === 1 ? 'lote' : 'lotes'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                                        {formatNumber(pos.quantity, 2)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                                        {currency === 'ARS' ? formatNumber(vcpDisplay, 6) : `u$s ${vcpDisplay.toFixed(6)}`}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-mono text-text-tertiary">
                                        {currency === 'ARS' ? formatNumber(vcpPpcDisplay, 6) : `u$s ${vcpPpcDisplay.toFixed(6)}`}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">
                                        {formatVal(pos.valuation, pos.valuationUSD)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PnlCell value={pos.pnlDiario} currency={currency} usdValue={pos.pnlDiarioUSD} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PnlCell value={pos.pnlAcumulado} pct={pnlAcumPct} currency={currency} usdValue={pos.pnlUSD} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onSubscribe(pos)}
                                                className="p-1.5 rounded-lg bg-background-tertiary text-profit hover:bg-profit/20 border border-profit/30 transition-colors"
                                                title="Suscribir"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onRedeem(pos)}
                                                className="p-1.5 rounded-lg bg-background-tertiary text-loss hover:bg-loss/20 border border-loss/30 transition-colors"
                                                title="Rescatar"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>

                                {/* Filas de lotes expandidas */}
                                {isExp && pos.lots.map((lot) => {
                                    const isEditing = editingLotId === lot.id;
                                    const lotPnlPct = lot.capital_invertido > 0
                                        ? (lot.pnlAcumulado / lot.capital_invertido) * 100
                                        : 0;
                                    const lotVcpDisplay = currency === 'ARS'
                                        ? lot.vcp_entrada
                                        : (lot.vcp_entrada / mepRate);

                                    return (
                                        <React.Fragment key={lot.id}>
                                            <tr className={`hover:bg-background-tertiary transition-all duration-200 group ${isEditing ? 'bg-primary/3' : ''}`}>
                                                {/* Indent + Fecha */}
                                                <td className="px-2 py-2" />
                                                <td className="px-4 py-2 pl-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-mono text-text-secondary">
                                                            {new Date(lot.fecha_suscripcion + 'T00:00:00').toLocaleDateString('es-AR')}
                                                        </span>
                                                        {lot.nombreLugar && (
                                                            <span className="text-[10px] text-text-tertiary">{lot.nombreLugar}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs font-mono text-text-secondary">
                                                    {formatNumber(lot.cuotapartes, 2)}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs font-mono text-text-tertiary">
                                                    {currency === 'ARS' ? formatNumber(lotVcpDisplay, 6) : `u$s ${lotVcpDisplay.toFixed(6)}`}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs font-mono text-text-tertiary">
                                                    —
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs font-mono text-text-secondary">
                                                    {formatVal(lot.valuation, currency === 'USD' ? lot.valuation / mepRate : lot.valuation)}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <PnlCell value={lot.pnlDiario} currency={currency} usdValue={mepRate > 0 ? lot.pnlDiario / mepRate : 0} />
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <PnlCell value={lot.pnlAcumulado} pct={lotPnlPct} currency={currency} usdValue={mepRate > 0 ? lot.pnlAcumulado / mepRate : 0} />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setEditingLotId(editingLotId === lot.id ? null : lot.id)}
                                                            className="p-1 text-text-tertiary hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteLot(lot.id)}
                                                            className="p-1 text-text-tertiary hover:text-loss hover:bg-loss/10 rounded transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isEditing && (
                                                <LotInlineEditor
                                                    lot={lot}
                                                    lugaresList={lugaresList}
                                                    onSave={(updates) => {
                                                        onEditLot(lot.id, updates);
                                                        setEditingLotId(null);
                                                    }}
                                                    onCancel={() => setEditingLotId(null)}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default FciLotTable;
