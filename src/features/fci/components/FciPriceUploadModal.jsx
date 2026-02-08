import React, { useState, useEffect } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2, Plus, Trash2, FileSpreadsheet, PenLine } from 'lucide-react';
import { fciService } from '../services/fciService';
import { parseARSNumber } from '@/utils/parsers';

const FciPriceUploadModal = ({ isOpen, onClose, onRefresh }) => {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('manual'); // 'csv' | 'manual'
    const [loadingFcis, setLoadingFcis] = useState(false);
    const [fcis, setFcis] = useState([]);
    const [selectedFciId, setSelectedFciId] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null); // { success, message, type }

    // Manual entry state
    const [manualFecha, setManualFecha] = useState(() => new Date().toISOString().split('T')[0]);
    const [manualVcp, setManualVcp] = useState('');
    const [manualQueue, setManualQueue] = useState([]); // [{ fecha, vcp }]

    // 1. Cargar FCIs
    useEffect(() => {
        const load = async () => {
            setLoadingFcis(true);
            try {
                const data = await fciService.getFcis();
                setFcis(data || []);
                if (data.length > 0) setSelectedFciId(data[0].id);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingFcis(false);
            }
        };
        load();
    }, [isOpen]);

    // Reset state when tab changes
    useEffect(() => {
        setResult(null);
    }, [activeTab]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleUploadCsv = async () => {
        if (!file || !selectedFciId) return;

        setUploading(true);
        setResult(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n');
                const prices = [];
                let skipCount = 0;

                const startIdx = lines[0].toLowerCase().includes('fecha') ? 1 : 0;

                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    let cols = [];
                    if (line.includes(';')) {
                        cols = line.split(';').map(s => s.trim());
                    } else if (line.includes('\t')) {
                        cols = line.split('\t').map(s => s.trim());
                    } else {
                        cols = line.split(',').map(s => s.trim());
                    }

                    let fechaRaw, vcpRaw;
                    if (cols.length >= 3) {
                        fechaRaw = cols[1];
                        vcpRaw = cols[2];
                    } else if (cols.length === 2) {
                        fechaRaw = cols[0];
                        vcpRaw = cols[1];
                    } else {
                        skipCount++;
                        continue;
                    }

                    const vcp = parseARSNumber(vcpRaw);

                    if (fechaRaw && !isNaN(vcp)) {
                        prices.push({ fecha: fechaRaw, vcp });
                    } else {
                        skipCount++;
                    }
                }

                if (prices.length === 0) {
                    setResult({ type: 'error', message: 'No se encontraron datos válidos en el CSV.' });
                    setUploading(false);
                    return;
                }

                await fciService.upsertPrices(selectedFciId, prices);

                setResult({
                    type: 'success',
                    message: `Carga exitosa: ${prices.length} registros procesados.${skipCount > 0 ? ` (${skipCount} omitidos)` : ''}`
                });

                if (onRefresh) onRefresh();

            } catch (err) {
                console.error(err);
                setResult({ type: 'error', message: 'Error procesando el archivo: ' + err.message });
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file);
    };

    // Manual entry handlers
    const handleAddToQueue = () => {
        if (!manualFecha || !manualVcp) return;

        const vcpNum = parseARSNumber(manualVcp);
        if (isNaN(vcpNum) || vcpNum <= 0) {
            setResult({ type: 'error', message: 'El VCP debe ser un número válido mayor a 0' });
            return;
        }

        // Check for duplicate date
        if (manualQueue.some(item => item.fecha === manualFecha)) {
            setResult({ type: 'error', message: `Ya existe un VCP para la fecha ${manualFecha}` });
            return;
        }

        setManualQueue(prev => [...prev, { fecha: manualFecha, vcp: vcpNum }].sort((a, b) => b.fecha.localeCompare(a.fecha)));
        setManualVcp('');
        setResult(null);
    };

    const handleRemoveFromQueue = (fecha) => {
        setManualQueue(prev => prev.filter(item => item.fecha !== fecha));
    };

    const handleSaveManual = async () => {
        if (manualQueue.length === 0 || !selectedFciId) return;

        setUploading(true);
        setResult(null);

        try {
            await fciService.upsertPrices(selectedFciId, manualQueue);

            setResult({
                type: 'success',
                message: `✓ ${manualQueue.length} VCP${manualQueue.length > 1 ? 's' : ''} guardado${manualQueue.length > 1 ? 's' : ''} correctamente`
            });

            setManualQueue([]);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error(err);
            setResult({ type: 'error', message: 'Error guardando: ' + err.message });
        } finally {
            setUploading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddToQueue();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-border-primary flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" />
                        Cargar VCP
                    </h2>
                    <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Selector de FCI */}
                    <div>
                        <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Seleccionar FCI</label>
                        <select
                            value={selectedFciId}
                            onChange={(e) => setSelectedFciId(e.target.value)}
                            disabled={loadingFcis || uploading}
                            className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                        >
                            {loadingFcis ? <option>Cargando fondos...</option> :
                                fcis.map(f => (
                                    <option key={f.id} value={f.id}>{f.nombre}</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-background-tertiary rounded-lg">
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === 'manual'
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                                }`}
                        >
                            <PenLine className="w-4 h-4" />
                            Manual
                        </button>
                        <button
                            onClick={() => setActiveTab('csv')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === 'csv'
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
                                }`}
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            CSV
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'manual' ? (
                        <div className="space-y-4">
                            {/* Manual Entry Form */}
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">Fecha</label>
                                    <input
                                        type="date"
                                        value={manualFecha}
                                        onChange={(e) => setManualFecha(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                                        disabled={uploading}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-text-tertiary uppercase mb-1.5">VCP</label>
                                    <input
                                        type="text"
                                        value={manualVcp}
                                        onChange={(e) => setManualVcp(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="1548.52"
                                        className="w-full px-3 py-2 bg-background-tertiary border border-border-secondary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors placeholder:text-text-tertiary"
                                        disabled={uploading}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleAddToQueue}
                                        disabled={!manualFecha || !manualVcp || uploading}
                                        className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Agregar"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Queue List */}
                            {manualQueue.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-text-tertiary uppercase">
                                        Pendientes ({manualQueue.length})
                                    </div>
                                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                                        {manualQueue.map((item) => (
                                            <div
                                                key={item.fecha}
                                                className="flex items-center justify-between p-2.5 bg-background-tertiary rounded-lg border border-border-secondary"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-text-primary font-mono">{item.fecha}</span>
                                                    <span className="text-sm text-primary font-semibold">${item.vcp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFromQueue(item.fecha)}
                                                    className="p-1 text-text-tertiary hover:text-loss transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={handleSaveManual}
                                disabled={manualQueue.length === 0 || !selectedFciId || uploading}
                                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                {uploading ? 'Guardando...' : `Guardar${manualQueue.length > 0 ? ` (${manualQueue.length})` : ''}`}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* CSV Instructions */}
                            <div className="bg-background-tertiary/50 p-3 rounded-lg border border-border-primary">
                                <p className="text-[11px] text-text-secondary leading-relaxed">
                                    Formato: <code className="text-primary">fecha,vcp</code><br />
                                    Ejemplo: <code className="text-text-tertiary">2025-01-20,1542.88</code><br />
                                    * Carga idempotente: solo actualiza valores distintos.
                                </p>
                            </div>

                            {/* File Input */}
                            <div className="space-y-2">
                                <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${file ? 'border-primary/50 bg-primary/5' : 'border-border-secondary hover:border-primary/30 bg-background-tertiary/30'
                                    }`}>
                                    <div className="flex flex-col items-center justify-center py-4">
                                        <FileSpreadsheet className={`w-7 h-7 mb-2 ${file ? 'text-primary' : 'text-text-tertiary'}`} />
                                        <p className="text-sm text-text-secondary">
                                            {file ? file.name : <span className="font-semibold">Click para subir CSV</span>}
                                        </p>
                                    </div>
                                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" disabled={uploading} />
                                </label>
                            </div>

                            <button
                                onClick={handleUploadCsv}
                                disabled={!file || !selectedFciId || uploading}
                                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                {uploading ? 'Procesando...' : 'Cargar CSV'}
                            </button>
                        </div>
                    )}

                    {/* Feedback */}
                    {result && (
                        <div className={`p-3 rounded-lg flex items-start gap-3 text-sm animate-in slide-in-from-top-1 ${result.type === 'success' ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20'
                            }`}>
                            {result.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                            <p>{result.message}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FciPriceUploadModal;
