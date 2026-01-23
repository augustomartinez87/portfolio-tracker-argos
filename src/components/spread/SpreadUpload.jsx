import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, Check, AlertCircle } from 'lucide-react';
import { caucionService } from '../../services/caucionService';
import { formatARS } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const SpreadUpload = ({ onFilesParsed, onClear }) => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedFiles, setParsedFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file, userId) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return { filename: file.name, error: 'Solo se aceptan archivos PDF' };
    }

    try {
      // Verificar si ya existe
      const exists = await caucionService.existePDF(userId, file.name);
      if (exists) {
        return { filename: file.name, error: 'Este PDF ya fue procesado anteriormente' };
      }

      // Subir y parsear via API Vercel
      const result = await caucionService.uploadPDFAndTriggerParsing(userId, file);
      
      if (!result.success) {
        return { filename: file.name, error: result.error || 'Error procesando PDF' };
      }

      return result;
    } catch (err) {
      return { filename: file.name, error: err.message };
    }
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    await processFiles(files);
    e.target.value = '';
  };

  const processFiles = async (files) => {
    if (!user) {
      setErrors(['Usuario no autenticado']);
      return;
    }

    setParsing(true);
    setErrors([]);

    const results = [];
    for (const file of files) {
      const result = await processFile(file, user.id);
      results.push(result);
    }

    const validResults = results.filter(r => !r.error && r.operaciones?.length > 0);
    const fileErrors = results.filter(r => r.error);

    if (fileErrors.length > 0) {
      setErrors(fileErrors.map(e => `${e.filename}: ${e.error}`));
    }

    setParsedFiles(prev => [...prev, ...validResults]);
    onFilesParsed(validResults);
    setParsing(false);
  };

  const removeFile = (index) => {
    setParsedFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      onFilesParsed(updated);
      return updated;
    });
  };

  const totalOperaciones = parsedFiles.reduce((sum, f) => sum + (f.operaciones?.length || 0), 0);
  const totalCapital = parsedFiles.reduce((sum, f) =>
    sum + f.operaciones?.reduce((s, c) => s + c.capital, 0) || 0, 0);

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border-primary hover:border-border-secondary bg-background-tertiary/50'
          }
        `}
      >
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-text-secondary">Subiendo y procesando PDFs...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-background-secondary flex items-center justify-center">
              <Upload className="w-6 h-6 text-text-tertiary" />
            </div>
            <div>
              <p className="text-text-primary font-medium">
                Subí tus comprobantes de caución
              </p>
              <p className="text-text-tertiary text-sm mt-1">
                Arrastrá PDFs o hacé click para seleccionar
              </p>
            </div>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {parsedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-text-secondary text-sm font-medium">
              Archivos procesados ({parsedFiles.length})
            </h3>
            <button
              onClick={() => {
                setParsedFiles([]);
                onFilesParsed([]);
                setErrors([]);
              }}
              className="text-text-tertiary hover:text-danger text-sm transition-colors"
            >
              Limpiar todo
            </button>
          </div>

          <div className="grid gap-2">
            {parsedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-background-secondary rounded-lg px-4 py-3 border border-border-primary"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-background-tertiary flex items-center justify-center">
                    <FileText className="w-4 h-4 text-text-tertiary" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-medium">
                      {file.filename}
                    </p>
                    <p className="text-text-tertiary text-xs">
                      {file.operaciones?.length || 0} operaciones • {formatARS(file.operaciones?.reduce((s, c) => s + c.capital, 0) || 0)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 hover:bg-background-tertiary rounded transition-colors"
                >
                  <X className="w-4 h-4 text-text-tertiary" />
                </button>
              </div>
            ))}
          </div>

          {totalOperaciones > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-success" />
                <div>
                  <p className="text-text-primary font-medium">
                    {totalOperaciones} operaciones procesadas
                  </p>
                  <p className="text-text-tertiary text-sm">
                    Capital total: {formatARS(totalCapital)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setParsedFiles([]);
                  onFilesParsed([]);
                }}
                className="text-text-tertiary hover:text-text-primary text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpreadUpload;