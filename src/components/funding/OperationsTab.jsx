import React, { useMemo } from 'react';
import { Receipt, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, Calculator } from 'lucide-react';
import { formatARS, formatPercent } from '@/utils/formatters';
import { Section } from '@/components/common/Section';
import { MetricCard } from '@/components/common/MetricCard';
import {
  calcularSpreadsTodasCauciones,
  calcularTotalesOperaciones,
} from '@/lib/finance/carryCalculations';

/**
 * Pestaña de Operaciones - Muestra el resultado real en dinero ($) de cada trade de caución + FCI
 * Permite auditar contra el broker de la ALyC
 * 
 * @param {Object} props
 * @param {Array} props.cauciones - Array de cauciones desde Supabase
 * @param {Array} props.vcpPrices - Array de precios VCP históricos
 * @param {number} props.tnaMA7 - TNA FCI MA-7 como decimal (ej: 0.2848)
 * @param {Date} props.hoy - Fecha de hoy (default: new Date())
 */
export function OperationsTab({ cauciones, vcpPrices, tnaMA7, saldoFCI, hoy = new Date() }) {
  // Calcular spreads para todas las cauciones
  const spreadsData = useMemo(() => {
    if (!cauciones?.length || !vcpPrices?.length) {
      return { spreads: [], totales: null };
    }
    
    // Usar el saldo FCI real (no el capital de caución) para calcular ganancia FCI
    const spreads = calcularSpreadsTodasCauciones(cauciones, vcpPrices, tnaMA7, hoy, saldoFCI);
    const totales = calcularTotalesOperaciones(spreads);
    
    return { spreads, totales };
  }, [cauciones, vcpPrices, tnaMA7, hoy, saldoFCI]);

  const { spreads, totales } = spreadsData;

  // Estados de carga
  if (!cauciones?.length) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <Receipt className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">Sin operaciones</h3>
        <p className="text-text-secondary text-sm">
          No hay cauciones cargadas. Cargá operaciones desde la sección de Financiación.
        </p>
      </div>
    );
  }

  if (!vcpPrices?.length) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">Sin datos VCP</h3>
        <p className="text-text-secondary text-sm">
          No hay precios históricos del FCI disponibles. Cargá precios en la sección FCI.
        </p>
      </div>
    );
  }

  if (spreads.length === 0) {
    return (
      <div className="bg-background-secondary rounded-xl p-8 border border-border-primary text-center">
        <Calculator className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">No se pueden calcular spreads</h3>
        <p className="text-text-secondary text-sm">
          No hay suficientes datos de VCP para las fechas de las cauciones cargadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de Totales - Sticky arriba */}
      {totales && (
        <div className="sticky top-0 bg-background-secondary rounded-xl border border-border-primary shadow-lg z-10">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text-primary">Totales</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Spread Total */}
              <div className={`p-3 rounded-lg border ${
                totales.spreadTotal >= 0 
                  ? 'bg-success/5 border-success/20' 
                  : 'bg-danger/5 border-danger/20'
              }`}>
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
                  Spread Total
                </p>
                <p className={`text-xl font-mono font-bold ${
                  totales.spreadTotal >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {totales.spreadTotal >= 0 ? '+' : ''}{formatARS(totales.spreadTotal)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {totales.spreadTotal >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-success" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-danger" />
                  )}
                  <span className={`text-xs ${
                    totales.spreadTotal >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    {totales.spreadTotal >= 0 ? 'Ganancia' : 'Pérdida'} neta
                  </span>
                </div>
              </div>

              {/* Spread Promedio Ponderado */}
              <div className="p-3 rounded-lg border border-border-secondary bg-background-tertiary">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
                  Spread Promedio
                </p>
                <p className={`text-xl font-mono font-bold ${
                  totales.spreadPromedioPonderado >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {formatPercent(totales.spreadPromedioPonderado * 100)}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  Ponderado por capital
                </p>
              </div>

              {/* Cantidad de cauciones */}
              <div className="p-3 rounded-lg border border-border-secondary bg-background-tertiary">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
                  Total Cauciones
                </p>
                <p className="text-xl font-mono font-bold text-text-primary">
                  {totales.totalCauciones}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {totales.caucionesVencidas} vencidas · {totales.caucionesActivas} activas
                </p>
              </div>

              {/* Capital Total */}
              <div className="p-3 rounded-lg border border-border-secondary bg-background-tertiary">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
                  Capital Total
                </p>
                <p className="text-xl font-mono font-bold text-text-primary">
                  {formatARS(totales.capitalTotal)}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {formatARS(totales.gananciaFCITotal)} FCI · {formatARS(totales.costoCaucionTotal)} costo
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de operaciones */}
      <Section title="Detalle por Caución" icon={Receipt}>
        <div className="bg-background-secondary rounded-xl border border-border-primary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background-tertiary border-b border-border-secondary">
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Caución
                  </th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Inicio
                  </th>
                  <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Fin
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Capital
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Interés pagado
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Ganancia FCI
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Spread ($)
                  </th>
                  <th className="text-right text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Spread (%)
                  </th>
                  <th className="text-center text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {spreads.map((spread, index) => (
                  <tr 
                    key={spread.caucionId} 
                    className={index % 2 === 0 ? 'bg-background-secondary' : 'bg-background-primary'}
                  >
                    {/* Identificador humano */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono text-text-primary">
                        {spread.identificadorHumano}
                      </div>
                    </td>
                    
                    {/* Fecha inicio */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">
                        {spread.fechaInicio}
                      </span>
                    </td>
                    
                    {/* Fecha fin */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-text-secondary">
                        {spread.fechaFin}
                      </span>
                    </td>
                    
                    {/* Capital */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-text-primary">
                        {formatARS(spread.capital)}
                      </span>
                    </td>
                    
                    {/* Interés pagado */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono text-danger">
                        {formatARS(spread.interesPagado)}
                      </span>
                    </td>
                    
                    {/* Ganancia FCI */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-mono text-success">
                          {formatARS(spread.gananciaFCITotal)}
                        </span>
                        {spread.esProyectado && (
                          <span className="text-[10px] text-text-tertiary">
                            {formatARS(spread.gananciaFCIReal)} real + {formatARS(spread.gananciaFCIProyectada)} proy.
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Spread ($) */}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono font-semibold ${
                        spread.spreadPesos >= 0 ? 'text-success' : 'text-danger'
                      }`}>
                        {spread.spreadPesos >= 0 ? '+' : ''}{formatARS(spread.spreadPesos)}
                      </span>
                    </td>
                    
                    {/* Spread (%) */}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-mono ${
                        spread.spreadPorcentaje >= 0 ? 'text-success' : 'text-danger'
                      }`}>
                        {formatPercent(spread.spreadPorcentaje * 100)}
                      </span>
                    </td>
                    
                    {/* Estado */}
                    <td className="px-4 py-3 text-center">
                      {spread.estado === 'vencida' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-text-tertiary/10 text-text-tertiary">
                          <CheckCircle className="w-3 h-3" />
                          Vencida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Clock className="w-3 h-3" />
                          Activa
                          {spread.diasRestantes > 0 && (
                            <span className="text-text-tertiary">({spread.diasRestantes}d)</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Header explicativo - Sticky abajo */}
      <div className="sticky bottom-0 bg-background-secondary rounded-xl p-4 border border-border-primary shadow-lg z-10">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-text-primary">Resultado real por operación</h3>
            <p className="text-sm text-text-secondary mt-1">
              Esta tabla muestra el resultado en pesos de cada trade de caución + FCI. 
              Las cauciones activas muestran ganancia real hasta hoy + proyección con TNA MA-7.
            </p>
          </div>
        </div>
      </div>

      {/* Nota metodológica */}
      <div className="bg-background-tertiary rounded-xl p-4 border border-border-secondary">
        <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Metodología de cálculo
        </h4>
        <ul className="text-xs text-text-tertiary space-y-1 list-disc list-inside">
          <li><strong>Cauciones vencidas:</strong> Ganancia FCI = Capital × (VCP_fin/VCP_inicio - 1)</li>
          <li><strong>Cauciones activas:</strong> Ganancia real (inicio→hoy) + Proyección con TNA MA-7 (hoy→fin)</li>
          <li><strong>Spread ($):</strong> Ganancia FCI - Interés pagado por caución</li>
          <li><strong>Spread (%):</strong> Rendimiento FCI - Costo caución (ambos sobre capital)</li>
        </ul>
      </div>
    </div>
  );
}

export default OperationsTab;
