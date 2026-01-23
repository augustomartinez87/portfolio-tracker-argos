import * as pdfParseLib from 'pdf-parse';

const pdfParse = pdfParseLib.default || pdfParseLib;
const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2,4})/;
const BOLETO_REGEX = /BOL\s+(\d{10})/;
const LIQUIDACION_REGEX = /Liquidaci[óo]n del d[íi]a\s+(\d{2}\/\d{2}\/\d{4})/;
const CAPITAL_FROM_CIERRE_REGEX = /Cantidad\s+([\d.]+,\d{2})\s*@/;
const MONTO_DEVOLVER_REGEX = /Importe\s+ARS\s+([\d.]+,\d{2})\s*D/;
const TNA_REGEX = /TNA:\s*([\d,]+)%/;
const TIPO_OPERACION_REGEX = /Operaci[óo]n de\s+(apertura|cierre)\s+de\s+cauci[óo]n/i;
const PLASO_REGEX = /\[(\w+)\]\s+(\d+)\s*d[íi]as?\)/i;

function parseARSAmount(str) {
  if (!str) return 0;
  const clean = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const match = DATE_REGEX.exec(dateStr);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) {
    year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
  }
  return `${year}-${month}-${day}`;
}

export async function parseCaucionPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const data = await pdfParse(arrayBuffer);
  const text = data.text;

  const operaciones = [];
  const lines = text.split('\n');

  let currentOperacion = null;
  let state = 'idle';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    const tipoMatch = TIPO_OPERACION_REGEX.exec(line);
    if (tipoMatch) {
      if (currentOperacion && currentOperacion.tipo === 'cierre') {
        operaciones.push(currentOperacion);
      }
      currentOperacion = {
        tipo: tipoMatch[1].toLowerCase(),
        fecha_liquidacion: null,
        capital: 0,
        monto_devolver: 0,
        tasa_tna: 0,
        boleto: null,
        raw_text: line
      };
      state = currentOperacion.tipo;
      continue;
    }

    if (state !== 'idle' && currentOperacion) {
      const liquidacionMatch = LIQUIDACION_REGEX.exec(line);
      if (liquidacionMatch && !currentOperacion.fecha_liquidacion) {
        currentOperacion.fecha_liquidacion = liquidacionMatch[1];
        continue;
      }

      const boletoMatch = BOLETO_REGEX.exec(line);
      if (boletoMatch && !currentOperacion.boleto) {
        currentOperacion.boleto = boletoMatch[1];
        continue;
      }

      if (state === 'cierre') {
        const capitalMatch = CAPITAL_FROM_CIERRE_REGEX.exec(line);
        if (capitalMatch && currentOperacion.capital === 0) {
          currentOperacion.capital = parseARSAmount(capitalMatch[1]);
          continue;
        }

        const montoMatch = MONTO_DEVOLVER_REGEX.exec(line);
        if (montoMatch && currentOperacion.monto_devolver === 0) {
          currentOperacion.monto_devolver = parseARSAmount(montoMatch[1]);
          continue;
        }

        const tnaMatch = TNA_REGEX.exec(line);
        if (tnaMatch && currentOperacion.tasa_tna === 0) {
          currentOperacion.tasa_tna = parseFloat(tnaMatch[1].replace(',', '.'));
          continue;
        }
      }
    }
  }

  if (currentOperacion && currentOperacion.tipo === 'cierre') {
    operaciones.push(currentOperacion);
  }

  const cierresValidos = operaciones
    .filter(op => op.tipo === 'cierre' && op.capital > 0 && op.monto_devolver > 0)
    .map(op => ({
      tipo: 'cierre',
      boleto: op.boleto,
      fecha_liquidacion: parseDate(op.fecha_liquidacion),
      capital: op.capital,
      monto_devolver: op.monto_devolver,
      tasa_tna: op.tasa_tna,
      raw_text: text.substring(0, 500)
    }));

  return {
    filename: file.name,
    total_operaciones: cierresValidos.length,
    cierres: cierresValidos,
    raw_text: text
  };
}

export function matchAperturasConCierres(aperturas, cierres) {
  const matched = [];
  const unmatchedCierres = [...cierres];

  for (const apertura of aperturas) {
    const matchIndex = unmatchedCierres.findIndex(
      cierre =>
        cierre.capital === apertura.capital &&
        Math.abs(cierre.tasa_tna - apertura.tasa_tna) < 0.5
    );

    if (matchIndex !== -1) {
      const cierre = unmatchedCierres[matchIndex];
      matched.push({
        tipo: 'completa',
        boleto_cierre: cierre.boleto,
        boleto_apertura: apertura.boleto,
        fecha_inicio: apertura.fecha_liquidacion,
        fecha_fin: cierre.fecha_liquidacion,
        capital: cierre.capital,
        monto_devolver: cierre.monto_devolver,
        tasa_tna: cierre.tasa_tna,
        raw_text: `${apertura.raw_text}\n${cierre.raw_text}`
      });
      unmatchedCierres.splice(matchIndex, 1);
    }
  }

  return {
    matched,
    unmatched: {
      aperturas: aperturas.filter(a =>
        !matched.some(m => m.boleto_apertura === a.boleto)
      ),
      cierres: unmatchedCierres
    }
  };
}

export function calcularMetricas(cauciones) {
  if (!cauciones || cauciones.length === 0) {
    return {
      capitalTotal: 0,
      interesTotal: 0,
      tnaPromedioPonderada: 0,
      totalOperaciones: 0,
      totalDias: 0
    };
  }

  const capitalTotal = cauciones.reduce((sum, c) => sum + c.capital, 0);
  const interesTotal = cauciones.reduce((sum, c) => sum + (c.monto_devolver - c.capital), 0);
  const totalDias = cauciones.reduce((sum, c) => {
    const dias = Math.ceil((new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / (1000 * 60 * 60 * 24));
    return sum + (dias > 0 ? dias : 0);
  }, 0);

  const tnaPonderada = capitalTotal > 0
    ? cauciones.reduce((sum, c) => sum + (c.capital * c.tasa_tna), 0) / capitalTotal
    : 0;

  return {
    capitalTotal,
    interesTotal,
    tnaPromedioPonderada: tnaPonderada,
    totalOperaciones: cauciones.length,
    totalDias
  };
}

export function parsePDFBatch(files) {
  return Promise.all(files.map(file => parseCaucionPDF(file)));
}
