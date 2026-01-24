import React, { useState } from 'react';
import { processCsvClient } from '../ingest/csvSpreadClient';

const SpreadLocalUploader = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      setError(null);
      setResult(null);
      setLoading(true);
      try {
        const res = await processCsvClient(text);
        setResult(res);
      } catch (err) {
        setError(err?.message || 'Error procesando CSV');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="spread-local-uploader" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input type="file" accept=".csv" onChange={onFile} />
      {loading && <div>Procesando CSV local…</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {result && (
        <pre style={{ maxHeight: '320px', overflow: 'auto' }}>
{JSON.stringify(result, null, 2)}
</pre>
      )}
    </div>
  );
};

export default SpreadLocalUploader;
