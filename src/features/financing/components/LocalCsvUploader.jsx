import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileCheck, AlertCircle, X, FileText } from 'lucide-react';
import { processCsvClient } from '../utils/csvSpreadClient';

const LocalCsvUploader = ({ onFilesParsed }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const processFile = async (file, text) => {
    setError(null);
    setResult(null);
    setLoading(true);
    setProgress(0);
    
    // Simular progreso
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      const res = await processCsvClient(text);
      clearInterval(progressInterval);
      setProgress(100);

      setResult(res);
      
      if (onFilesParsed) {
        const enrichedResult = {
          ...res,
          csvText: text
        };
        onFilesParsed(enrichedResult);
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Error procesando CSV:', err);
      setError(err?.message || 'Error procesando CSV');
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      await processFile(file, text);
    };
    reader.readAsText(file);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setFileName(file.name);
      setFileSize(formatFileSize(file.size));
      
      const reader = new FileReader();
      reader.onload = async () => {
        const text = String(reader.result || '');
        await processFile(file, text);
      };
      reader.readAsText(file);
    } else {
      setError('Por favor, arrastra un archivo CSV válido');
    }
  }, []);

  const clearFile = () => {
    setFileName(null);
    setFileSize(null);
    setResult(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const triggerFileInput = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
          ${dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-border-primary hover:border-text-tertiary hover:bg-background-tertiary/50'
          }
          ${loading ? 'pointer-events-none opacity-70' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onFile}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
            ${dragOver ? 'bg-primary/20' : 'bg-background-tertiary'}
          `}>
            <Upload className={`
              w-8 h-8 transition-colors
              ${dragOver ? 'text-primary' : 'text-text-tertiary'}
            `} />
          </div>
          
          <div>
            <p className="text-text-primary font-medium">
              Arrastra tu archivo CSV aquí
            </p>
            <p className="text-text-tertiary text-sm mt-1">
              o haz clic para seleccionar
            </p>
          </div>
          
          <span className="text-xs text-text-tertiary bg-background-tertiary px-3 py-1 rounded-full">
            Solo archivos CSV
          </span>
        </div>
      </div>

      {/* File Info */}
      {fileName && (
        <div className="flex items-center gap-3 p-4 bg-background-tertiary rounded-lg border border-border-primary">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-medium truncate">{fileName}</p>
            <p className="text-text-tertiary text-sm">{fileSize}</p>
          </div>
          {!loading && (
            <button
              onClick={clearFile}
              className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {loading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Procesando archivo...</span>
            <span className="text-text-tertiary">{progress}%</span>
          </div>
          <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 font-medium">Error al procesar</p>
            <p className="text-red-400/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="w-5 h-5 text-green-500" />
            <span className="text-green-400 font-medium">CSV Procesado Exitosamente</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background-secondary rounded-lg p-3">
              <p className="text-xs text-text-tertiary mb-1">Capital Caucionado</p>
              <p className="text-text-primary font-semibold">
                ${result.summary?.totalCapital?.toLocaleString?.() ?? '—'}
              </p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3">
              <p className="text-xs text-text-tertiary mb-1">Interés Total</p>
              <p className="text-text-primary font-semibold">
                ${result.summary?.totalInteres?.toLocaleString?.() ?? '—'}
              </p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3">
              <p className="text-xs text-text-tertiary mb-1">TNA Promedio</p>
              <p className="text-text-primary font-semibold">
                {result.summary?.tnaPromedioPonderado?.toFixed(2) ?? '—'}%
              </p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3">
              <p className="text-xs text-text-tertiary mb-1">Total Registros</p>
              <p className="text-text-primary font-semibold">
                {result.summary?.totalRecords ?? '—'}
              </p>
            </div>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary transition-colors">
              Ver detalle completo (JSON)
            </summary>
            <pre className="mt-3 text-xs bg-background-secondary rounded-lg p-3 overflow-x-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default LocalCsvUploader;
