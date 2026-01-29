import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { fciService } from '../services/fciService';
import { formatNumber } from '../../utils/formatters';

const FciTransactionModal = ({ isOpen, onClose, onSave, portfolioId, initialType = 'SUBSCRIPTION', initialFci = null }) => {
    if (!isOpen) return null;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [fciList, setFciList] = useState([]);
    const [selectedFciId, setSelectedFciId] = useState(initialFci?.fciId || '');
    const [tipo, setTipo] = useState(initialType);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [monto, setMonto] = useState('');
    const [cuotapartes, setCuotapartes] = useState('');

    // VCP State
    const [vcp, setVcp] = useState(null);
    const [vcpLoading, setVcpLoading] = useState(false); // Para mostrar carga al buscar VCP
    const [vcpError, setVcpError] = useState(null);

    // 1. Cargar lista de fondos al abrir
    useEffect(() => {
        const loadFcis = async () => {
            setLoading(true);
            try {
                const data = await fciService.getFcis();
                setFciList(data || []);
                if (!selectedFciId && data.length > 0) {
                    setSelectedFciId(data[0].id);
                }
            } catch (err) {
                console.error("Error loading FCIs:", err);
            } finally {
                setLoading(false);
            }
        };
        loadFcis();
    }, [isOpen]);

    // 2. Buscar VCP cuando cambia fecha o FCI
    useEffect(() => {
        if (!selectedFciId || !fecha) return;

        const findVcp = async () => {
            setVcpLoading(true);
            setVcp(null);
            setVcpError(null);
            try {
                // Buscar precio exacto o más reciente hasta esa fecha
                // Nota: El servicio getPrices ya soporta filtrar, pero aquí queremos algo específico
                // Usaremos getPrices(id, fecha) que retorna >= fecha.
                // Pero para "histórico puntual" necesitamos lógica... 
                // Por simplicidad en este MVP, buscamos TODO y filtramos en JS o el servicio nos da el array.

                // Optimización: Pedir al backend "el precio de tal fecha".
                // Como fciService.getPrices retorna >= fecha, no nos sirve directo para "el de esa fecha".
                // Usaremos una consulta ad-hoc o asumiremos que el usuario carga precios al día.

                // ESTRATEGIA: Traer todos y buscar. No es eficiente a largo plazo pero OK para MVP.
                const prices = await fciService.getPrices(selectedFciId);

                // Buscar coincidencia exacta
                const match = prices.find(p => p.fecha === fecha);

                if (match) {
                    setVcp(match.vcp);
                } else {
                    // Si no hay exacto, buscar el anterior más cercano (Previo Cierre)
                    // Asumimos prices ordenado ASC
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

        const timeout = setTimeout(findVcp, 300); // Debounce
        return () => clearTimeout(timeout);

    }, [selectedFciId, fecha]);

    // 3. Calcular cuotapartes automáticamente (editable)
    useEffect(() => {
        if (monto && vcp && !isNaN(monto) && !isNaN(vcp)) {
            const calculated = Number(monto) / Number(vcp);
            setCuotapartes(calculated.toFixed(2));
        }
    }, [monto, vcp]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!vcp || !cuotapartes) return;

        setSaving(true);
        try {
            const transaction = {
                portfolio_id: portfolioId,
                fci_id: selectedFciId,
                fecha,
                tipo: tipo, // 'SUBSCRIPTION' | 'REDEMPTION'
                monto: Number(monto),
                vcp_operado: Number(vcp),
                cuotapartes: Number(cuotapartes)
            };

            // Inyectamos user_id en el fciService o dejamos que supabase lo tome del contexto?
            // El schema require user_id. Lo ideal es pasarlo.
            // Pero fciService usa supabase cliente que tiene session. 
            // El insert fallaría si no mandamos user_id explícito si RLS no lo "auto-llena"? 
            // Supabase NO auto-llena user_id en inserts a menos que haya default auth.uid().
            // Mi schema NO tiene default auth.uid().
            // Debemos obtener el user. 
            // Solución: Pasarlo desde props o usar supabase.auth.getUser() aquí.

            // ERROR POTENCIAL: Necesito user_id. 
            // Mejor: el padre (Dashboard) me pasa user.id o lo saco de useAuth().
            // Voy a asumir que onSave se encarga o que fciService lo maneja.
            // Voy a ajustar Dashboard para que pase el user id a onSave.

            await onSave(transaction);
            onClose();
        } catch (err) {
            alert('Error guardando: ' + err.message);
        } finally {
            setSaving(false);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
                <div className="p-5 border-b border-border-primary flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-primary">
                        {tipo === 'SUBSCRIPTION' ? 'Suscribir Fondo' : 'Rescatar Fondo'}
                    </h2>
                    <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Tipo Selector */}
                    <div className="flex bg-background-tertiary p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setTipo('SUBSCRIPTION')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tipo === 'SUBSCRIPTION' ? 'bg-profit text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            Suscripción
                        </button>
                        <button
                            type="button"
                            onClick={() => setTipo('REDEMPTION')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tipo === 'REDEMPTION' ? 'bg-loss text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            Rescate
                        </button>
                    </div>

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
                        <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fondo Común de Inversión</label>
                        <select
                            value={selectedFciId}
                            onChange={(e) => setSelectedFciId(e.target.value)}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                            disabled={initialFci} // Si venimos pre-seleccionados
                        >
                            {loading ? <option>Cargando fondos...</option> :
                                fciList.map(f => (
                                    <option key={f.id} value={f.id}>{f.nombre} ({f.currency})</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* VCP Info Box */}
                    <div className={`p-3 rounded-lg border text-sm ${vcpError ? 'bg-warning-muted border-warning/30 text-warning' : 'bg-primary/10 border-primary/20 text-text-secondary'
                        }`}>
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
                            {vcpError && <span className="text-xs opacity-75 whitespace-nowrap">({vcpError})</span>}
                        </div>
                        <p className="text-[10px] opacity-70 mt-1">
                            * Puedes editar este valor manualmente si es necesario (ej: cargas históricas).
                        </p>
                    </div>

                    {/* Monto */}
                    <div>
                        <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Monto {tipo === 'SUBSCRIPTION' ? 'a Invertir' : 'a Rescatar'}</label>
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
                        {saving ? 'Guardando...' : 'Confirmar Operación'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FciTransactionModal;
