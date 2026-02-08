import React, { useState, useMemo } from 'react';
import { X, Calendar, DollarSign, Calculator, AlertCircle, Check } from 'lucide-react';

/**
 * Modal for manually adding a caucion entry
 * Calculates dias, interes, and TNA automatically from user inputs
 */
const CaucionModal = ({ isOpen, onClose, onSubmit, loading }) => {
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [capital, setCapital] = useState('');
    const [montoDevolver, setMontoDevolver] = useState('');
    const [error, setError] = useState('');

    // Calculate derived fields
    const calculations = useMemo(() => {
        if (!fechaInicio || !fechaFin || !capital || !montoDevolver) {
            return null;
        }

        // Normalize: remove everything except digits, dots, and commas, then convert comma to dot
        const normalizeNumber = (str) => str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
        const capitalNum = parseFloat(normalizeNumber(capital));
        const montoNum = parseFloat(normalizeNumber(montoDevolver));

        if (isNaN(capitalNum) || isNaN(montoNum) || capitalNum <= 0) {
            return null;
        }

        const startDate = new Date(fechaInicio);
        const endDate = new Date(fechaFin);
        const diffMs = endDate.getTime() - startDate.getTime();
        const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (dias <= 0) {
            return { error: 'La fecha de fin debe ser posterior a la de inicio' };
        }

        const interes = montoNum - capitalNum;
        const tnaReal = (interes / capitalNum) * (365 / dias);

        return {
            dias,
            interes,
            tnaReal,
            valid: true
        };
    }, [fechaInicio, fechaFin, capital, montoDevolver]);

    const formatCurrency = (value) => {
        if (!value && value !== 0) return '-';
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatPercent = (value) => {
        if (!value && value !== 0) return '-';
        return `${(value * 100).toFixed(2)}%`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!calculations?.valid) {
            setError('Por favor completá todos los campos correctamente');
            return;
        }

        const normalizeNumber = (str) => str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
        const capitalNum = parseFloat(normalizeNumber(capital));
        const montoNum = parseFloat(normalizeNumber(montoDevolver));

        try {
            await onSubmit({
                fechaInicio,
                fechaFin,
                capital: capitalNum,
                montoDevolver: montoNum
            });
            // Reset form
            setFechaInicio('');
            setFechaFin('');
            setCapital('');
            setMontoDevolver('');
            onClose();
        } catch (err) {
            setError(err.message || 'Error al guardar la caución');
        }
    };

    const handleCapitalChange = (e) => {
        // Allow digits, dots, and commas for decimal input
        const value = e.target.value.replace(/[^\d.,]/g, '');
        setCapital(value);
    };

    const handleMontoChange = (e) => {
        // Allow digits, dots, and commas for decimal input
        const value = e.target.value.replace(/[^\d.,]/g, '');
        setMontoDevolver(value);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-primary">
                    <h2 className="text-lg font-semibold text-text-primary">Cargar Caución Manual</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background-tertiary rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                <Calendar className="w-4 h-4 inline mr-1.5" />
                                Fecha Inicio
                            </label>
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="w-full px-3 py-2 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                <Calendar className="w-4 h-4 inline mr-1.5" />
                                Fecha Fin
                            </label>
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="w-full px-3 py-2 bg-background-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
                                required
                            />
                        </div>
                    </div>

                    {/* Amounts Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                <DollarSign className="w-4 h-4 inline mr-1.5" />
                                Capital Tomado
                            </label>
                            <input
                                type="text"
                                value={capital}
                                onChange={handleCapitalChange}
                                placeholder="1000000"
                                className="w-full px-3 py-2 bg-background-tertiary border border-border-primary rounded-lg text-text-primary font-mono focus:outline-none focus:border-primary transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                <DollarSign className="w-4 h-4 inline mr-1.5" />
                                Monto a Devolver
                            </label>
                            <input
                                type="text"
                                value={montoDevolver}
                                onChange={handleMontoChange}
                                placeholder="1030000"
                                className="w-full px-3 py-2 bg-background-tertiary border border-border-primary rounded-lg text-text-primary font-mono focus:outline-none focus:border-primary transition-colors"
                                required
                            />
                        </div>
                    </div>

                    {/* Calculated Preview */}
                    {calculations?.valid && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-primary text-sm font-medium">
                                <Calculator className="w-4 h-4" />
                                Valores Calculados
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-text-tertiary text-xs mb-1">Días</p>
                                    <p className="font-mono font-semibold text-text-primary">{calculations.dias}</p>
                                </div>
                                <div>
                                    <p className="text-text-tertiary text-xs mb-1">Interés</p>
                                    <p className="font-mono font-semibold text-warning">{formatCurrency(calculations.interes)}</p>
                                </div>
                                <div>
                                    <p className="text-text-tertiary text-xs mb-1">TNA Real</p>
                                    <p className="font-mono font-semibold text-primary">{formatPercent(calculations.tnaReal)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {calculations?.error && (
                        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
                            {calculations.error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-background-tertiary text-text-secondary rounded-lg hover:bg-background-tertiary/80 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !calculations?.valid}
                            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Guardar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CaucionModal;
