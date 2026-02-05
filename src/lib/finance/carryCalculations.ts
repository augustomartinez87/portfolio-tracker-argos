import Decimal from 'decimal.js';

/**
 * Tipo para precios VCP
 */
export interface VcpPrice {
  fecha: string;
  vcp: number;
}

/**
 * Tipo para cauciones (formato desde Supabase)
 */
export interface CaucionData {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  capital: number;
  interes: number;
  dias?: number;
  tna_real?: number;
}

/**
 * Resultado del cálculo de spread por caución
 */
export interface SpreadCaucionResult {
  // Identificación
  caucionId: string;
  identificadorHumano: string;
  
  // Fechas
  fechaInicio: string;        // DD/MM/AAAA
  fechaFin: string;           // DD/MM/AAAA
  fechaInicioRaw: string;     // YYYY-MM-DD
  fechaFinRaw: string;        // YYYY-MM-DD
  
  // Montos
  capital: number;
  interesPagado: number;
  
  // VCPs
  vcpInicio: number;
  vcpFin: number | null;
  vcpHoy: number | null;
  
  // Ganancias FCI
  gananciaFCITotal: number;   // Real + proyectado (si aplica)
  gananciaFCIReal: number;    // Solo tramo real
  gananciaFCIProyectada: number; // Solo proyección (si aplica)
  
  // Costos y spreads
  costoCaucion: number;
  spreadPesos: number;
  spreadPorcentaje: number;
  
  // Metadata
  estado: 'vencida' | 'activa';
  esProyectado: boolean;
  diasRestantes: number;
  diasTotales: number;
}

/**
 * Totales agregados de operaciones
 */
export interface TotalesOperaciones {
  spreadTotal: number;
  spreadPromedioPonderado: number;
  totalCauciones: number;
  caucionesVencidas: number;
  caucionesActivas: number;
  capitalTotal: number;
  gananciaFCITotal: number;
  costoCaucionTotal: number;
}

/**
 * Formatea fecha de YYYY-MM-DD a DD/MM/AAAA
 */
export function formatDateAR(fechaISO: string): string {
  const [year, month, day] = fechaISO.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Genera identificador humano para una caución
 * Formato: YYYY-MM-DD | $CAPITAL | TNA%
 */
export function generarIdentificadorCaucion(
  fechaInicio: string, 
  capital: number, 
  tna: number | undefined
): string {
  const fecha = fechaInicio.split('T')[0];
  const capitalFormateado = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(capital);
  // tna viene como porcentaje (ej: 28.74) o decimal (ej: 0.2874)
  // Si es > 1, ya es porcentaje. Si es < 1, es decimal y hay que convertir
  const tnaFormateado = tna 
    ? (tna > 1 ? tna.toFixed(2) : (tna * 100).toFixed(2)) 
    : '0.00';
  return `${fecha} | $${capitalFormateado} | ${tnaFormateado}%`;
}

/**
 * Busca el último VCP en un array ordenado ascendente.
 * 
 * @param vcpPrices - Array de precios VCP ordenados por fecha
 * @param fechaObjetivo - Fecha objetivo (YYYY-MM-DD)
 * @param inclusive - Si true, busca fecha <= fechaObjetivo. Si false, busca fecha < fechaObjetivo.
 *                    Por defecto true.
 * 
 * El parámetro inclusive es clave para el timing del VCP:
 * - Para VCP_inicio: usar false (el VCP disponible al momento de abrir la caución es del día anterior)
 * - Para VCP_fin: usar true (el VCP disponible al momento de cerrar incluye el día actual)
 * 
 * @returns {VcpPrice | null} El último VCP que cumple la condición, o null si no existe.
 */
export function buscarVcpAnteriorOIgual(
  vcpPrices: VcpPrice[], 
  fechaObjetivo: string,
  inclusive: boolean = true
): VcpPrice | null {
  let resultado: VcpPrice | null = null;
  for (const p of vcpPrices) {
    if (inclusive) {
      if (p.fecha <= fechaObjetivo) {
        resultado = p;
      } else {
        break;
      }
    } else {
      if (p.fecha < fechaObjetivo) {
        resultado = p;
      } else {
        break;
      }
    }
  }
  return resultado;
}

/**
 * Calcula los días entre dos fechas
 */
export function calcularDiasEntre(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffTime = fin.getTime() - inicio.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcula la ganancia FCI real entre dos VCPs
 */
export function calcularGananciaFCIReal(
  capital: InstanceType<typeof Decimal>,
  vcpInicio: InstanceType<typeof Decimal>,
  vcpFin: InstanceType<typeof Decimal>
): InstanceType<typeof Decimal> {
  const ratio = vcpFin.dividedBy(vcpInicio);
  return capital.times(ratio.minus(1));
}

/**
 * Calcula la ganancia FCI proyectada usando TNA MA-7
 */
export function calcularGananciaFCIProyectada(
  capital: InstanceType<typeof Decimal>,
  tnaMA7: number,
  diasRestantes: number
): InstanceType<typeof Decimal> {
  if (diasRestantes <= 0 || tnaMA7 <= 0) {
    return new Decimal(0);
  }

  const tasaDiaria = new Decimal(1 + tnaMA7).pow(new Decimal(1).dividedBy(365)).minus(1);
  const ratioProy = new Decimal(1).plus(tasaDiaria).pow(diasRestantes);
  return capital.times(ratioProy.minus(1));
}

/**
 * Calcula el spread de una caución individual contra el rendimiento real del FCI.
 *
 * - Cauciones vencidas: usa VCP real en fecha_inicio y fecha_fin.
 * - Cauciones activas: tramo real (inicio→hoy) + tramo proyectado (hoy→fin) con tnaMA7.
 *
 * @returns {SpreadCaucionResult | null} Resultado del cálculo o null si no hay datos suficientes
 */
export function calcularSpreadPorCaucion(
  caucion: CaucionData,
  vcpPrices: VcpPrice[],
  tnaMA7: number,
  hoy: Date
): SpreadCaucionResult | null {
  if (!vcpPrices || vcpPrices.length === 0) return null;

  const capital = new Decimal(caucion.capital || 0);
  const interes = new Decimal(caucion.interes || 0);
  
  if (capital.isZero()) return null;

  const fechaInicio = String(caucion.fecha_inicio).split('T')[0];
  const fechaFin = String(caucion.fecha_fin).split('T')[0];
  const fechaHoy = hoy.toISOString().split('T')[0];

  // DEBUG: Log para diagnóstico
  console.log(`[DEBUG] Caución ${caucion.id}: ${fechaInicio} -> ${fechaFin}, hoy=${fechaHoy}`);
  console.log(`[DEBUG] Primeros 5 VCPs disponibles:`, vcpPrices.slice(0, 5).map(v => ({ fecha: v.fecha, vcp: v.vcp })));

  // Para VCP_inicio usamos inclusive=false porque el VCP disponible al momento de
  // abrir la caución (por la mañana) es el del día anterior (publicado la noche anterior)
  // Ej: caución del 04/02, VCP disponible = VCP(03/02)
  const vcpInicio = buscarVcpAnteriorOIgual(vcpPrices, fechaInicio, false);
  console.log(`[DEBUG] VCP_inicio buscado para ${fechaInicio} (inclusive=false):`, vcpInicio);
  if (!vcpInicio || new Decimal(vcpInicio.vcp || 0).isZero()) return null;

  const vcpInicioDec = new Decimal(vcpInicio.vcp);
  const esVencida = fechaFin < fechaHoy;
  
  const diasTotales = calcularDiasEntre(fechaInicio, fechaFin);

  if (esVencida) {
    // CAUCIÓN VENCIDA: solo datos reales
    const vcpFin = buscarVcpAnteriorOIgual(vcpPrices, fechaFin);
    if (!vcpFin || new Decimal(vcpFin.vcp || 0).isZero()) return null;

    const vcpFinDec = new Decimal(vcpFin.vcp);
    const gananciaDolares = calcularGananciaFCIReal(capital, vcpInicioDec, vcpFinDec);
    const rendimientoPct = gananciaDolares.dividedBy(capital);
    const costoPct = interes.dividedBy(capital);

    return {
      caucionId: caucion.id,
      identificadorHumano: generarIdentificadorCaucion(fechaInicio, caucion.capital, caucion.tna_real),
      fechaInicio: formatDateAR(fechaInicio),
      fechaFin: formatDateAR(fechaFin),
      fechaInicioRaw: fechaInicio,
      fechaFinRaw: fechaFin,
      capital: capital.toNumber(),
      interesPagado: interes.toNumber(),
      vcpInicio: vcpInicio.vcp,
      vcpFin: vcpFin.vcp,
      vcpHoy: null,
      gananciaFCITotal: gananciaDolares.toNumber(),
      gananciaFCIReal: gananciaDolares.toNumber(),
      gananciaFCIProyectada: 0,
      costoCaucion: interes.toNumber(),
      spreadPesos: gananciaDolares.minus(interes).toNumber(),
      spreadPorcentaje: rendimientoPct.minus(costoPct).toNumber(),
      estado: 'vencida',
      esProyectado: false,
      diasRestantes: 0,
      diasTotales,
    };
  } else {
    // CAUCIÓN ACTIVA: tramo real + tramo proyectado
    // Para VCP "hoy" usamos inclusive=false porque el VCP disponible hoy es el del día anterior
    // (publicado anoche). Ej: hoy 04/02 a la mañana, el último VCP disponible es el del 03/02.
    const vcpHoy = buscarVcpAnteriorOIgual(vcpPrices, fechaHoy, false);
    console.log(`[DEBUG] VCP_hoy buscado para ${fechaHoy} (inclusive=false):`, vcpHoy);
    if (!vcpHoy || new Decimal(vcpHoy.vcp || 0).isZero()) return null;

    const vcpHoyDec = new Decimal(vcpHoy.vcp);
    
    // a) Tramo real: fecha_inicio → hoy
    // La ganancia real solo existe si el VCP disponible "hoy" es de una fecha posterior
    // a la fecha de inicio de la caución. Si es del mismo día o anterior, la ganancia es 0.
    // Ej: caución del 04→05, hoy=05. Si VCP_hoy=04 (mismo día que inicio), ganancia=0.
    const gananciaReal = vcpHoy.fecha > fechaInicio
      ? calcularGananciaFCIReal(capital, vcpInicioDec, vcpHoyDec)
      : new Decimal(0);
    
    console.log(`[DEBUG] Ganancia real calculada: ${gananciaReal.toNumber()}, vcpHoy.fecha=${vcpHoy.fecha} > fechaInicio=${fechaInicio} = ${vcpHoy.fecha > fechaInicio}`);

    // b) Tramo proyectado: hoy → fecha_fin
    const diasRestantes = Math.max(0, Math.round(
      (new Date(fechaFin).getTime() - new Date(fechaHoy).getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    const gananciaProyectada = calcularGananciaFCIProyectada(capital, tnaMA7, diasRestantes);

    // c) Total
    const gananciaTotal = gananciaReal.plus(gananciaProyectada);
    const rendimientoPct = gananciaTotal.dividedBy(capital);
    const costoPct = interes.dividedBy(capital);

    return {
      caucionId: caucion.id,
      identificadorHumano: generarIdentificadorCaucion(fechaInicio, caucion.capital, caucion.tna_real),
      fechaInicio: formatDateAR(fechaInicio),
      fechaFin: formatDateAR(fechaFin),
      fechaInicioRaw: fechaInicio,
      fechaFinRaw: fechaFin,
      capital: capital.toNumber(),
      interesPagado: interes.toNumber(),
      vcpInicio: vcpInicio.vcp,
      vcpFin: null,
      vcpHoy: vcpHoy.vcp,
      gananciaFCITotal: gananciaTotal.toNumber(),
      gananciaFCIReal: gananciaReal.toNumber(),
      gananciaFCIProyectada: gananciaProyectada.toNumber(),
      costoCaucion: interes.toNumber(),
      spreadPesos: gananciaTotal.minus(interes).toNumber(),
      spreadPorcentaje: rendimientoPct.minus(costoPct).toNumber(),
      estado: 'activa',
      esProyectado: diasRestantes > 0 && tnaMA7 > 0,
      diasRestantes,
      diasTotales,
    };
  }
}

/**
 * Calcula los totales agregados de un array de spreads por caución
 */
export function calcularTotalesOperaciones(
  spreads: SpreadCaucionResult[]
): TotalesOperaciones {
  const totalCauciones = spreads.length;
  const caucionesVencidas = spreads.filter(s => s.estado === 'vencida').length;
  const caucionesActivas = spreads.filter(s => s.estado === 'activa').length;
  
  let spreadTotal = new Decimal(0);
  let spreadPonderadoSum = new Decimal(0);
  let capitalTotal = new Decimal(0);
  let gananciaFCITotal = new Decimal(0);
  let costoCaucionTotal = new Decimal(0);

  for (const s of spreads) {
    const cap = new Decimal(s.capital);
    spreadTotal = spreadTotal.plus(s.spreadPesos);
    spreadPonderadoSum = spreadPonderadoSum.plus(cap.times(s.spreadPorcentaje));
    capitalTotal = capitalTotal.plus(cap);
    gananciaFCITotal = gananciaFCITotal.plus(s.gananciaFCITotal);
    costoCaucionTotal = costoCaucionTotal.plus(s.costoCaucion);
  }

  const spreadPromedioPonderado = capitalTotal.gt(0) 
    ? spreadPonderadoSum.dividedBy(capitalTotal).toNumber()
    : 0;

  return {
    spreadTotal: spreadTotal.toNumber(),
    spreadPromedioPonderado,
    totalCauciones,
    caucionesVencidas,
    caucionesActivas,
    capitalTotal: capitalTotal.toNumber(),
    gananciaFCITotal: gananciaFCITotal.toNumber(),
    costoCaucionTotal: costoCaucionTotal.toNumber(),
  };
}

/**
 * Calcula los spreads para todas las cauciones
 */
export function calcularSpreadsTodasCauciones(
  cauciones: CaucionData[],
  vcpPrices: VcpPrice[],
  tnaMA7: number,
  hoy: Date
): SpreadCaucionResult[] {
  const resultados: SpreadCaucionResult[] = [];
  
  for (const caucion of cauciones) {
    const resultado = calcularSpreadPorCaucion(caucion, vcpPrices, tnaMA7, hoy);
    if (resultado) {
      resultados.push(resultado);
    }
  }
  
  // Ordenar por fecha de inicio descendente (más reciente primero)
  return resultados.sort((a, b) => 
    new Date(b.fechaInicioRaw).getTime() - new Date(a.fechaInicioRaw).getTime()
  );
}
