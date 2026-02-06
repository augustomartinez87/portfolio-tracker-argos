/**
 * Helpers para operaciones con VCP (Valor Cuota Parte) de FCIs
 */

/**
 * Busca VCP en una fecha, o el más cercano anterior si no existe
 * @param {Object} vcpMap - Mapa {fecha: vcp}
 * @param {string} date - Fecha YYYY-MM-DD
 * @returns {number|null}
 */
export const findVcp = (vcpMap, date) => {
  if (!vcpMap || Object.keys(vcpMap).length === 0) return null;
  if (vcpMap[date]) return Number(vcpMap[date]);

  const dates = Object.keys(vcpMap).sort();
  let closest = null;
  for (const d of dates) {
    if (d <= date) closest = d;
    else break;
  }
  return closest ? Number(vcpMap[closest]) : null;
};

/**
 * Genera array de fechas YYYY-MM-DD entre start y end (inclusive)
 * @param {string} startStr - Fecha inicio YYYY-MM-DD
 * @param {string} endStr - Fecha fin YYYY-MM-DD
 * @returns {string[]}
 */
export const dateRange = (startStr, endStr) => {
  const dates = [];
  const current = new Date(startStr + 'T12:00:00');
  const end = new Date(endStr + 'T12:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Calcula PnL de lotes FCI durante un período específico
 * @param {Array} fciLots - Lotes activos
 * @param {Object} vcpHistoricos - Mapa {fciId: {fecha: vcp}}
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 * @returns {number}
 */
export const calculatePnlForPeriod = (fciLots, vcpHistoricos, fechaInicio, fechaFin) => {
  let totalPnl = 0;

  for (const lot of fciLots) {
    const fciId = lot.fci_id || lot.fciId;
    const vcpMap = vcpHistoricos[fciId];

    if (!vcpMap) continue;

    const startDate = lot.fecha_suscripcion > fechaInicio ? lot.fecha_suscripcion : fechaInicio;

    const vcpInicio = lot.fecha_suscripcion > fechaInicio
      ? lot.vcp_entrada
      : findVcp(vcpMap, startDate);

    const vcpFin = findVcp(vcpMap, fechaFin);

    if (vcpInicio && vcpFin && lot.cuotapartes) {
      const pnl = lot.cuotapartes * (vcpFin - vcpInicio);
      totalPnl += pnl;
    }
  }

  return totalPnl;
};
