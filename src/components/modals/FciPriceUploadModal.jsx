import React, { useState, useEffect } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fciService } from '../../services/fciService';
import { parseARSNumber } from '../../utils/parsers';

const FciPriceUploadModal = ({ isOpen, onClose, onRefresh }) => {
    if (!isOpen) return null;

    const [loadingFcis, setLoadingFcis] = useState(false);
    const [fcis, setFcis] = useState([]);
    const [selectedFciId, setSelectedFciId] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null); // { success, message, type }
    const [preview, setPreview] = useState([]);

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

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleUpload = async () => {
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

                // Simple parser: fecha,vcp
                // Saltar primera línea si es header
                const startIdx = lines[0].toLowerCase().includes('fecha') ? 1 : 0;

                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const [fechaRaw, vcpRaw] = line.split(',').map(s => s.trim());

                    // Validar fecha (YYYY-MM-DD o similar que acepte PG)
                    // El usuario mandó: 2025-01-02,123.4567
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
                    message: `Carga exitosa: ${prices.push} registros procesados.${skipCount > 0 ? ` (${skipCount} omitidos por formato)` : ''}`
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-secondary border border-border-primary rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-border-primary flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" />
                        Cargar Histórico VCP
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

                    {/* Instrucciones */}
                    <div className="bg-background-tertiary/50 p-3 rounded-lg border border-border-primary">
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                            Formato esperado: <code className="text-primary">fecha,vcp</code><br />
                            Ejemplo: <code className="text-text-tertiary">2025-01-20,1542.88</code><br />
                            * La carga es <strong>idempotente</strong>: solo actualiza si el valor es distinto.
                        </p>
                    </div>

                    {/* File Input */}
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-text-tertiary uppercase">Archivo CSV</label>
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${file ? 'border-primary/50 bg-primary/5' : 'border-border-secondary hover:border-primary/30 bg-background-tertiary/30'
                            }`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className={`w-8 h-8 mb-2 ${file ? 'text-primary' : 'text-text-tertiary'}`} />
                                <p className="text-sm text-text-secondary">
                                    {file ? file.name : <span className="font-semibold">Click para subir</span>}
                                </p>
                                <p className="text-xs text-text-tertiary mt-1">.csv (separado por coma)</p>
                            </div>
                            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" disabled={uploading} />
                        </label>
                    </div>

                    {/* Feedback */}
                    {result && (
                        <div className={`p-3 rounded-lg flex items-start gap-3 text-sm animate-in slide-in-from-top-1 ${result.type === 'success' ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20'
                            }`}>
                            {result.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                            <p>{result.message}</p>
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={!file || !selectedFciId || uploading}
                        className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        {uploading ? 'Procesando...' : 'Iniciar Carga'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FciPriceUploadModal;
