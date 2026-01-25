// CSV-based Spread Ingestor
// Reads CSV and processes metrics - CSV is source of truth, no recalculation
// Expected CSV columns: fecha_apertura,fecha_cierre,capital,monto_devolver,interes,dias,tna_real,archivo
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

/** Simple, robust CSV parser that handles quoted fields */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '"') {
        // toggle quotes, but allow escaping by doubling
        if (inQuotes && trimmed[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    // skip comments or empty trailing lines
    rows.push(cells);
  }
  return rows;
}

/** Parse a date in YYYY-MM-DD or similar ISO-like format to a string (or Date if needed) */
function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** Validate that required headers exist in the first row */
function validateHeaders(headers: string[]): boolean {
  console.log('Headers encontrados:', headers);

  const required = [
    'fecha_apertura', 'fecha_cierre', 'capital', 'monto_devolver', 'interes', 'dias', 'tna_real', 'archivo'
  ];
  const lower = headers.map(h => h.trim().toLowerCase());
  console.log('Headers en minúsculas:', lower);
  console.log('Headers requeridos:', required);

  const missing = required.filter(r => !lower.includes(r.toLowerCase()));
  console.log('Headers faltantes:', missing);

  return required.every(r => lower.includes(r.toLowerCase()));
}

/** Helpers to safely convert to number */
function toNumber(n: any): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

/** Public: ingest CSV text and produce derived results */
export async function ingestFromCsv(csvText: string): Promise<IngestResult> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }
  const headers = rows[0] as string[];
  if (!validateHeaders(headers)) {
    throw new Error(`CSV headers inválidos. Se esperaban: fecha_apertura, fecha_cierre, capital, monto_devolver, interes, dias, tna_real, archivo. Encontrados: [${headers.join(', ')}]`);
  }

  const idx: Record<string, number> = {
    fecha_apertura: headers.indexOf('fecha_apertura'),
    fecha_cierre: headers.indexOf('fecha_cierre'),
    capital: headers.indexOf('capital'),
    monto_devolver: headers.indexOf('monto_devolver'),
    interes: headers.indexOf('interes'),
    dias: headers.indexOf('dias'),
    tna_real: headers.indexOf('tna_real'),
    archivo: headers.indexOf('archivo')
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

  // Calculate diasPromedio (weighted by capital usually makes sense, but simple average is often enough for duration)
  // Let's do simple average for duration as it's common for "average term"
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
      diasPromedio, // Added calculation
    },
    curve,
    spreads: spreads.map(s => ({ tenor: s.tenor, avgSpread: s.avgSpread }))
  };

  return result;
}

// End of module exports
