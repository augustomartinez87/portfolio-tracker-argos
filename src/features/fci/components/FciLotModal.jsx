import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, RefreshCw, Loader2, Plus } from 'lucide-react';
import { fciService } from '../services/fciService';
import { formatNumber } from '@/utils/formatters';

const FciLotModal = ({ isOpen, onClose, onSaveLot, onRedeem, portfolioId, userId, lugaresList = [], initialFci = null, initialType = 'SUBSCRIPTION' }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Mode toggle — seeded from initialType
    const [modo, setModo] = useState(initialType);

    // Shared
    const [fciList, setFciList] = useState([]);
    const [selectedFciId, setSelectedFciId] = useState(initialFci?.fciId || '');

    // Suscripción
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [lugarId, setLugarId] = useState('');
    const [monto, setMonto] = useState('');
    const [cuotapartes, setCuotapartes] = useState('');
    const [vcp, setVcp] = useState(null);
    const [vcpLoading, setVcpLoading] = useState(false);
    const [vcpError, setVcpError] = useState(null);

    // Lugar inline creation
    const [creatingLugar, setCreatingLugar] = useState(false);
    const [newLugarNombre, setNewLugarNombre] = useState('');
    const [lugares, setLugares] = useState(lugaresList);

    // Rescate
    const [redeemCuotapartes, setRedeemCuotapartes] = useState('');

    // Sync modo cuando cambia initialType (modal re-abre con tipo diferente)
    useEffect(() => {
        if (isOpen) setModo(initialType);
    }, [isOpen, initialType]);

    // Sync lugaresList prop changes
    useEffect(() => {
        setLugares(lugaresList);
    }, [lugaresList]);

    // 1. Cargar lista de fondos al abrir
    useEffect(() => {
        if (!isOpen) return;

        const loadFcis = async () => {
            setLoading(true);
            try {
                const data = await fciService.getFcis();
                setFciList(data || []);
                if (!selectedFciId && data.length > 0) {
                    setSelectedFciId(data[0].id);
                }
            } catch (err) {
                console.error('[FciLotModal] Error loading FCIs:', err);
            } finally {
                setLoading(false);
            }
        };
        loadFcis();
    }, [isOpen]);

    // 2. Buscar VCP cuando cambia fecha o FCI (solo modo suscripción)
    useEffect(() => {
        if (!isOpen || modo !== 'SUBSCRIPTION' || !selectedFciId || !fecha) return;

        const findVcp = async () => {
            setVcpLoading(true);
            setVcp(null);
            setVcpError(null);
            try {
                const prices = await fciService.getPrices(selectedFciId);
                const match = prices.find(p => p.fecha === fecha);

                if (match) {
                    setVcp(match.vcp);
                } else {
                    const prevPrices = prices.filter(p => p.fecha < fecha);
                    if (prevPrices.length > 0) {
                        const last = prevPrices[prevPrices.length - 1];
                        setVcp(last.vcp);
                        setVcpError(`Usando VCP del ${last.fecha} (Cierre anterior)`);
                    } else {
                        setVcpError('No hay VCP disponible para esta fecha o anterior.');
                    }
                }
            } catch (err) {
                console.error(err);
                setVcpError('Error buscando precio.');
            } finally {
                setVcpLoading(false);
            }
        };

        const timeout = setTimeout(findVcp, 300);
        return () => clearTimeout(timeout);
    }, [isOpen, modo, selectedFciId, fecha]);

    // 3. Calcular cuotapartes automáticamente cuando cambia monto o vcp
    useEffect(() => {
        if (modo !== 'SUBSCRIPTION') return;
        if (monto && vcp && !isNaN(monto) && !isNaN(vcp) && Number(vcp) > 0) {
            const calculated = Number(monto) / Number(vcp);
            setCuotapartes(calculated.toFixed(2));
        }
    }, [monto, vcp, modo]);

    if (!isOpen) return null;

    // Máximo de cuotapartes disponibles para rescate del fondo seleccionado
    // Se pasa desde el padre si está disponible, sino se calcula desde initialFci
    const maxCuotapartes = initialFci?.quantity || 0;

    // Crear lugar inline
    const handleCreateLugar = async () => {
        if (!newLugarNombre.trim()) return;
        try {
            const lugar = await fciService.createLugar({ user_id: userId, nombre: newLugarNombre.trim() });
            setLugares(prev => [...prev, lugar].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setLugarId(lugar.id);
            setCreatingLugar(false);
            setNewLugarNombre('');
        } catch (err) {
            console.error('[FciLotModal] Error creating lugar:', err);
            alert('Error creando lugar: ' + err.message);
        }
    };

    const handleSubmitSuscripcion = async (e) => {
        e.preventDefault();
        if (!vcp || !cuotapartes || !monto) return;

        setSaving(true);
        try {
            await onSaveLot({
                user_id: userId,
                portfolio_id: portfolioId,
                fci_id: selectedFciId,
                lugar_id: lugarId || null,
                fecha_suscripcion: fecha,
                vcp_entrada: Number(vcp),
                cuotapartes: Number(cuotapartes),
                capital_invertido: Number(monto)
            });
            onClose();
        } catch (err) {
            alert('Error guardando lote: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitRescate = async (e) => {
        e.preventDefault();
        if (!redeemCuotapartes || !selectedFciId) return;

        setSaving(true);
        try {
            await onRedeem(selectedFciId, Number(redeemCuotapartes));
            onClose();
        } catch (err) {
            alert('Error aplicando rescate: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
                {/* Header */}
                <div className="p-5 border-b border-border-primary flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-primary">
                        {modo === 'SUBSCRIPTION' ? 'Suscribir Lote' : 'Rescatar Fondo'}
                    </h2>
                    <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex bg-background-tertiary p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setModo('SUBSCRIPTION')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${modo === 'SUBSCRIPTION' ? 'bg-profit text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            Suscripción
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo('REDEMPTION')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${modo === 'REDEMPTION' ? 'bg-loss text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            Rescate
                        </button>
                    </div>

                    {modo === 'SUBSCRIPTION' ? (
                        <form onSubmit={handleSubmitSuscripcion} className="space-y-4">
                            {/* Fecha */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fecha</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                                    <input
                                        type="date"
                                        required
                                        value={fecha}
                                        onChange={(e) => setFecha(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Fondo */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fondo</label>
                                <select
                                    value={selectedFciId}
                                    onChange={(e) => setSelectedFciId(e.target.value)}
                                    className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                                    disabled={!!initialFci}
                                >
                                    {loading ? <option>Cargando fondos...</option> :
                                        fciList.map(f => (
                                            <option key={f.id} value={f.id}>{f.nombre} ({f.currency})</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Lugar */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Lugar</label>
                                {creatingLugar ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newLugarNombre}
                                            onChange={(e) => setNewLugarNombre(e.target.value)}
                                            placeholder="Nombre del lugar..."
                                            className="flex-1 px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateLugar(); } }}
                                        />
                                        <button type="button" onClick={handleCreateLugar} className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={() => { setCreatingLugar(false); setNewLugarNombre(''); }} className="px-2 py-2 text-text-tertiary hover:text-text-primary rounded-lg transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <select
                                            value={lugarId}
                                            onChange={(e) => setLugarId(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                                        >
                                            <option value="">Sin lugar</option>
                                            {lugares.map(l => (
                                                <option key={l.id} value={l.id}>{l.nombre}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setCreatingLugar(true)}
                                            className="px-3 py-2 bg-background-tertiary border border-border-secondary text-text-tertiary hover:text-primary hover:border-primary/50 rounded-lg text-sm transition-colors"
                                            title="Crear nuevo lugar"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* VCP Info Box */}
                            <div className={`p-3 rounded-lg border text-sm ${vcpError ? 'bg-warning-muted border-warning/30 text-warning' : 'bg-primary/10 border-primary/20 text-text-secondary'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-xs uppercase">Valor Cuotaparte</span>
                                    {vcpLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="bg-transparent border-b border-dashed border-text-secondary/50 text-lg font-mono font-bold text-text-primary focus:outline-none focus:border-primary w-full"
                                        value={vcp || ''}
                                        onChange={(e) => setVcp(e.target.value)}
                                        placeholder="0.000000"
                                    />
                                </div>
                                {vcpError && <p className="text-[10px] opacity-75 mt-1">{vcpError}</p>}
                                <p className="text-[10px] opacity-70 mt-1">
                                    * Puedes editar manualmente si es necesario (ej: cargas históricas).
                                </p>
                            </div>

                            {/* Monto */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Monto a Invertir</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                        value={monto}
                                        onChange={(e) => setMonto(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono"
                                    />
                                </div>
                            </div>

                            {/* Cuotapartes */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5 flex justify-between">
                                    <span>Cuotapartes</span>
                                    <span className="text-[10px] normal-case font-normal opacity-70 italic text-primary">Pre-calculado (Monto/VCP)</span>
                                </label>
                                <div className="relative">
                                    <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="0.00"
                                        value={cuotapartes}
                                        onChange={(e) => setCuotapartes(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving || !vcp || !monto || !cuotapartes}
                                className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {saving ? 'Guardando...' : 'Confirmar Suscripción'}
                            </button>
                        </form>
                    ) : (
                        /* MODO RESCATE */
                        <form onSubmit={handleSubmitRescate} className="space-y-4">
                            {/* Fondo */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fondo</label>
                                <select
                                    value={selectedFciId}
                                    onChange={(e) => setSelectedFciId(e.target.value)}
                                    className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                                    disabled={!!initialFci}
                                >
                                    {loading ? <option>Cargando fondos...</option> :
                                        fciList.map(f => (
                                            <option key={f.id} value={f.id}>{f.nombre} ({f.currency})</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Cuotapartes a Rescatar */}
                            <div>
                                <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5 flex justify-between">
                                    <span>Cuotapartes a Rescatar</span>
                                    {maxCuotapartes > 0 && (
                                        <span className="text-[10px] normal-case font-normal opacity-70 text-primary">
                                            Máx: {formatNumber(maxCuotapartes, 2)}
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    min="0.01"
                                    max={maxCuotapartes || undefined}
                                    value={redeemCuotapartes}
                                    onChange={(e) => setRedeemCuotapartes(e.target.value)}
                                    className="w-full px-4 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors font-mono font-bold"
                                />
                                {maxCuotapartes > 0 && Number(redeemCuotapartes) > maxCuotapartes && (
                                    <p className="text-xs text-loss mt-1">
                                        Excede las cuotapartes disponibles ({formatNumber(maxCuotapartes, 2)}).
                                    </p>
                                )}
                            </div>

                            {/* Info: FIFO */}
                            <div className="p-3 rounded-lg bg-background-tertiary border border-border-primary">
                                <p className="text-[11px] text-text-tertiary">
                                    El rescate se aplica en orden FIFO: se consume primero el lote más antiguo.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={saving || !redeemCuotapartes || !selectedFciId || (maxCuotapartes > 0 && Number(redeemCuotapartes) > maxCuotapartes)}
                                className="w-full py-2.5 bg-loss text-white font-semibold rounded-lg hover:bg-loss/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-loss/20 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {saving ? 'Aplicando...' : 'Confirmar Rescate'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FciLotModal;
