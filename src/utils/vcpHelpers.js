import { toDateString } from '@/utils/formatters';

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
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Calcula PnL de lotes FCI durante un período específico.
 * Reconstruye las cuotapartes históricas sumando las consumidas por rescates
 * ocurridos DESPUÉS de fechaInicio (ya que lot.cuotapartes tiene todos los rescates descontados).
 *
 * @param {Array} fciLots - Todos los lotes (activos e inactivos)
 * @param {Object} vcpHistoricos - Mapa {fciId: {fecha: vcp}}
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 * @param {Array} rescates - Registros de fci_rescates con mutations [{lot_id, cp_consumidas}]
 * @returns {number}
 */
export const calculatePnlForPeriod = (fciLots, vcpHistoricos, fechaInicio, fechaFin, rescates = []) => {
  let totalPnl = 0;

  for (const lot of fciLots) {
    const fciId = lot.fci_id || lot.fciId;
    const vcpMap = vcpHistoricos[fciId];

    if (!vcpMap) continue;

    // Reconstruir CP históricas: sumar las CP consumidas por rescates que ocurrieron
    // DESPUÉS de fechaInicio (esos rescates aún no habían sucedido en la fecha objetivo)
    const cpRestored = rescates
      .filter(r => {
        const fechaR = String(r.fecha_rescate).split('T')[0];
        return fechaR > fechaInicio;
      })
      .flatMap(r => r.mutations || [])
      .filter(m => m.lot_id === lot.id)
      .reduce((sum, m) => sum + Number(m.cp_consumidas || 0), 0);

    const cpAtDate = Number(lot.cuotapartes || 0) + cpRestored;
    if (cpAtDate <= 0) continue;

    const startDate = lot.fecha_suscripcion > fechaInicio ? lot.fecha_suscripcion : fechaInicio;

    const vcpInicio = lot.fecha_suscripcion > fechaInicio
      ? lot.vcp_entrada
      : findVcp(vcpMap, startDate);

    const vcpFin = findVcp(vcpMap, fechaFin);

    if (vcpInicio && vcpFin) {
      const pnl = cpAtDate * (vcpFin - vcpInicio);
      totalPnl += pnl;
    }
  }

  return totalPnl;
};
