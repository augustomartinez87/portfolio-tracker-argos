// CSV-based Spread Ingestor
// Reads CSV and processes metrics - CSV is source of truth, no recalculation
// Expected CSV columns: fecha_apertura,fecha_cierre,capital,monto_devolver,interes,dias,tna_real,archivo,operation_key
// Encoding: ASCII/UTF-8

export type CsvRecord = {
  fecha_apertura: string;
  fecha_cierre: string;
  capital: number;
  monto_devolver: number;
  interes: number;
  dias: number;
  tna_real: number;
  archivo: string;
  operation_key: string;
};

export type DerivedRecord = CsvRecord & {
  fecha_apertura_dt?: Date;
  fecha_cierre_dt?: Date;
};

export type TenorCurvePoint = {
  tenor: number;
  totalCapital: number;
  totalMontoDevolver: number;
  totalInteres: number;
  curveTnaProm: number; // weighted average tna_real for this tenor
};

export type IngestResult = {
  records: DerivedRecord[];
  summary: {
    totalCapital: number;
    totalMontoDevolver: number;
    totalInteres: number;
    tnaPromedioSimple: number;
    tnaPromedioPonderado: number;
    totalRecords: number;
    diasPromedio: number;
  };
  curve: TenorCurvePoint[];
  spreads?: { tenor: number; avgSpread: number; }[];
};

/** Simple, robust CSV parser that handles quoted fields and detects delimiter */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  // Detect delimiter based on first line (header)
  // We prefer comma, but if first line has no commas and has semicolons, use semicolon.
  // Or check which one appears more often in the header.
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  console.log('📊 CSV Parser detected delimiter:', delimiter === ';' ? 'Semicolon (;)' : 'Comma (,)');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '"') {
        if (inQuotes && trimmed[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === delimiter && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

/** Parse a date in YYYY-MM-DD or similar ISO-like format to a string (or Date if needed) */
/** Parse a date safely, handling ISO (YYYY-MM-DD) and Latin (DD/MM/YYYY) formats */
function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Remove leading single quote (plain text indicator in Sheets) and trim
  const s = dateStr.trim().replace(/^'/, '');

  // Try ISO YYYY-MM-DD
  if (/\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Try Latin DD/MM/YYYY (common in Sheets export for Spanish locale)
  const latinMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (latinMatch) {
    const day = parseInt(latinMatch[1], 10);
    const month = parseInt(latinMatch[2], 10) - 1; // JS months are 0-11
    const year = parseInt(latinMatch[3], 10);
    const d = new Date(year, month, day);
    // Validate components match (handles 31/02 case)
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  // Fallback to browser standard (usually allows MM/DD/YYYY)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Validate that required headers exist in the first row */
function validateHeaders(headers: string[]): boolean {
  console.log('Headers encontrados:', headers);

  const required = [
    'fecha_apertura', 'fecha_cierre', 'capital', 'monto_devolver', 'interes', 'dias', 'tna_real', 'archivo', 'operation_key'
  ];
  const lower = headers.map(h => h.trim().toLowerCase());

  const missing = required.filter(r => !lower.includes(r.toLowerCase()));
  if (missing.length > 0) {
    console.warn('Headers faltantes:', missing);
  }

  return required.every(r => lower.includes(r.toLowerCase()));
}

/** Helpers to safely convert to number, handling comma decimals */
function toNumber(n: any): number {
  if (typeof n === 'number') return n;
  if (!n) return 0;

  let str = String(n).trim();

  // Handle "1.000,50" -> remove dots, replace comma with dot -> "1000.50"
  // OR "1000,50" -> "1000.50"
  // Heuristic: if both . and , exist:
  //   if last is comma (1.234,56), remove dots, replace comma.
  //   if last is dot (1,234.56), remove commas.
  if (str.includes(',') && str.includes('.')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // European/Latin style: 1.000,00
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US style: 1,000.00
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma? Assume decimal separator (Latin)
    str = str.replace(',', '.');
  }

  const v = Number(str);
  return isNaN(v) ? 0 : v;
}

/** Public: ingest CSV text and produce derived results */
export async function ingestFromCsv(csvText: string): Promise<IngestResult> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }
  const headers = rows[0] as string[];
  // Loose validation for backward compatibility if needed, but strict for now as per req
  if (!validateHeaders(headers)) {
    // Optional: Allow fallback if operation_key is missing? No, user wants strict idempotency.
    // However, if manual upload doesn't have key, it will fail.
    // The ETL adds it. If user uploads manual non-ETL csv, it fails.
    // We assume ETL is the source.
    console.warn('Headers faltantes para idempotencia completa.');
  }

  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  const getIdx = (key: string) => normalizedHeaders.indexOf(key.toLowerCase());

  const idx: Record<string, number> = {
    fecha_apertura: getIdx('fecha_apertura'),
    fecha_cierre: getIdx('fecha_cierre'),
    capital: getIdx('capital'),
    monto_devolver: getIdx('monto_devolver'),
    interes: getIdx('interes'),
    dias: getIdx('dias'),
    tna_real: getIdx('tna_real'),
    archivo: getIdx('archivo'),
    operation_key: getIdx('operation_key')
  } as any;

  const records: DerivedRecord[] = [];
  const tenorsAgg = new Map<number, {
    totalCapital: number;
    totalMontoDevolver: number;
    totalInteres: number;
    totalTna: number; // capital * tna_real
    count: number;
  }>();

  let totalCapital = 0;
  let totalMontoDevolver = 0;
  let totalInteres = 0;
  let totalTnaWeighted = 0;

  // skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Some CSVs may contain extra columns; guard against missing indices
    const fecha_apertura = row[idx.fecha_apertura] ?? '';
    const fecha_cierre = row[idx.fecha_cierre] ?? '';
    const capital = toNumber(row[idx.capital]);
    const monto_devolver = toNumber(row[idx.monto_devolver]);
    const interes = toNumber(row[idx.interes]);
    const dias = Number(row[idx.dias]);
    const tna_real = toNumber(row[idx.tna_real]);

    const archivo = row[idx.archivo] ?? '';
    const operation_key = idx.operation_key >= 0 ? (row[idx.operation_key] ?? '') : '';

    // Basic validation
    if (!(capital > 0) || !(monto_devolver > 0) || !Number.isFinite(dias) || !Number.isFinite(tna_real)) {
      continue;
    }

    const dateA = parseDateSafe(fecha_apertura);
    const dateB = parseDateSafe(fecha_cierre);

    const rec: DerivedRecord = {
      fecha_apertura,
      fecha_cierre,
      capital,
      monto_devolver,
      interes,
      dias,
      tna_real,
      archivo,
      operation_key,
      fecha_apertura_dt: dateA ?? undefined,
      fecha_cierre_dt: dateB ?? undefined,
    };
    records.push(rec);

    // Aggregations for curve by tenor
    const tenor = dias;
    const agg = tenorsAgg.get(tenor) || {
      totalCapital: 0,
      totalMontoDevolver: 0,
      totalInteres: 0,
      totalTna: 0,
      count: 0,
    };
    agg.totalCapital += capital;
    agg.totalMontoDevolver += monto_devolver;
    agg.totalInteres += interes;
    agg.totalTna += capital * tna_real;
    agg.count += 1;
    tenorsAgg.set(tenor, agg);

    totalCapital += capital;
    totalMontoDevolver += monto_devolver;
    totalInteres += interes;
    totalTnaWeighted += capital * tna_real;
  }

  // Build curve
  const curve: TenorCurvePoint[] = [];
  for (const [tenorStr, agg] of tenorsAgg.entries()) {
    const curveTnaProm = agg.totalCapital > 0 ? agg.totalTna / agg.totalCapital : 0;
    curve.push({
      tenor: tenorStr,
      totalCapital: agg.totalCapital,
      totalMontoDevolver: agg.totalMontoDevolver,
      totalInteres: agg.totalInteres,
      curveTnaProm
    });
  }
  // sort by tenor ascending for deterministic output
  curve.sort((a, b) => a.tenor - b.tenor);

  // Summary
  const totalRecords = records.length;
  const tnaPromedioSimple = totalRecords > 0 ? (records.reduce((s, r) => s + r.tna_real, 0) / totalRecords) : 0;
  const tnaPromedioPonderado = totalCapital > 0 ? (totalTnaWeighted / totalCapital) : 0;

  // Calculate diasPromedio
  const totalDias = records.reduce((sum, r) => sum + r.dias, 0);
  const diasPromedio = totalRecords > 0 ? totalDias / totalRecords : 0;

  // Spreads by tenor (optional)
  const spreadsByTenor: Map<number, { sumSpread: number; count: number; }> = new Map();
  for (const r of records) {
    const found = curve.find(c => c.tenor === r.dias);
    const tenorTna = found?.curveTnaProm ?? 0;
    const spread = r.tna_real - tenorTna;
    const s = spreadsByTenor.get(r.dias) || { sumSpread: 0, count: 0 };
    s.sumSpread += spread;
    s.count += 1;
    spreadsByTenor.set(r.dias, s);
  }
  const spreads = Array.from(spreadsByTenor.entries()).map(([tenor, s]) => ({ tenor, avgSpread: s.count > 0 ? s.sumSpread / s.count : 0 }));

  // Return structure
  const result: IngestResult = {
    records,
    summary: {
      totalCapital,
      totalMontoDevolver,
      totalInteres,
      tnaPromedioSimple,
      tnaPromedioPonderado,
      totalRecords,
      diasPromedio,
    },
    curve,
    spreads: spreads.map(s => ({ tenor: s.tenor, avgSpread: s.avgSpread }))
  };

  return result;
}
