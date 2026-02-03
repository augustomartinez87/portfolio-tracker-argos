import React, { useState, useMemo } from 'react';
import Decimal from 'decimal.js';
import { Sliders, AlertTriangle, TrendingUp, TrendingDown, CheckCircle, RotateCcw } from 'lucide-react';
import { formatARS, formatPercent, formatNumber } from '@/utils/formatters';

/**
 * Simulador de Escenarios para Carry Trade
 * Permite ajustar TNA FCI y TNA Caución para ver el impacto en ganancias
 *
 * @param {Object} props
 * @param {number} props.tnaFCIActual - TNA actual del FCI (decimal, ej: 0.32)
 * @param {number} props.tnaCaucionActual - TNA actual ponderado de cauciones (decimal)
 * @param {number} props.saldoFCI - Saldo actual del FCI
 * @param {number} props.costoCaucionDia - Costo diario fijo de cauciones vigentes
 * @param {number} props.totalCaucion - Total capital en cauciones vigentes
 * @param {number} props.spreadNetoDiaActual - Spread neto diario actual
 * @param {number} props.spreadMensualActual - Spread mensual proyectado actual
 * @param {number} props.spreadAnualActual - Spread anual proyectado actual
 * @param {number} props.bufferTasaActual - Buffer de tasa actual (%)
 */
export function ScenarioSimulator({
  tnaFCIActual,
  tnaCaucionActual,
  saldoFCI,
  costoCaucionDia,
  totalCaucion,
  spreadNetoDiaActual,
  spreadMensualActual,
  spreadAnualActual,
  bufferTasaActual,
}) {
  // Estado para valores simulados (inicializados con valores actuales)
  const [tnaFCISimulado, setTnaFCISimulado] = useState(tnaFCIActual);
  const [tnaCaucionSimulado, setTnaCaucionSimulado] = useState(tnaCaucionActual);

  // Cálculos de la simulación usando Decimal.js para precisión financiera
  const {
    spreadSimulado,
    gananciaSimDia,
    gananciaSimMes,
    gananciaSimAnual,
    diffDia,
    diffMes,
    diffAnual,
    breakevenTnaFCI,
  } = useMemo(() => {
    const tnaFCI = new Decimal(tnaFCISimulado || 0);
    const tnaCaucion = new Decimal(tnaCaucionSimulado || 0);
    const saldo = new Decimal(saldoFCI || 0);
    const costoDia = new Decimal(costoCaucionDia || 0);
    const caucionActual = new Decimal(tnaCaucionActual || 0);
    const total = new Decimal(totalCaucion || 0);

    // Spread simulado (diferencial de tasas)
    const spreadSim = tnaFCI.minus(tnaCaucion);

    // Ganancia FCI simulada = saldoFCI * tnaFCISimulado / 365
    const gananciaFCISimDia = saldo.times(tnaFCI).dividedBy(365);

    // Para cauciones existentes: costo fijo
    // Para cauciones futuras: costo proporcional a nueva tasa
    // Usamos proporcionalidad: costoCaucionSimDia = costoCaucionDia * (tnaCaucionSimulado / tnaCaucionActual)
    // Esto simula "si renovara las cauciones a la nueva tasa"
    const costoCaucionSimDia = caucionActual.gt(0)
      ? costoDia.times(tnaCaucion.dividedBy(caucionActual))
      : total.times(tnaCaucion).dividedBy(365);

    // Spread neto simulado = ganancia FCI - costo caución
    const gananciaDia = gananciaFCISimDia.minus(costoCaucionSimDia);
    const gananciaMes = gananciaDia.times(30);
    const gananciaAnual = gananciaDia.times(365);

    // Diferencias vs actual
    const dDia = gananciaDia.minus(spreadNetoDiaActual || 0);
    const dMes = gananciaMes.minus(spreadMensualActual || 0);
    const dAnual = gananciaAnual.minus(spreadAnualActual || 0);

    // Breakeven: cuando gananciaFCI = costoCaucion
    // saldoFCI * tnaFCI / 365 = costoCaucionDia
    // tnaFCI = costoCaucionDia * 365 / saldoFCI
    const breakeven = saldo.gt(0)
      ? costoDia.times(365).dividedBy(saldo)
      : new Decimal(0);

    return {
      spreadSimulado: spreadSim.toNumber(),
      gananciaSimDia: gananciaDia.toNumber(),
      gananciaSimMes: gananciaMes.toNumber(),
      gananciaSimAnual: gananciaAnual.toNumber(),
      diffDia: dDia.toNumber(),
      diffMes: dMes.toNumber(),
      diffAnual: dAnual.toNumber(),
      breakevenTnaFCI: breakeven.toNumber(),
    };
  }, [tnaFCISimulado, tnaCaucionSimulado, saldoFCI, costoCaucionDia, totalCaucion, tnaCaucionActual,
      spreadNetoDiaActual, spreadMensualActual, spreadAnualActual]);

  // Handlers para sliders
  const handleFCIChange = (e) => {
    setTnaFCISimulado(parseFloat(e.target.value) / 100);
  };

  const handleCaucionChange = (e) => {
    setTnaCaucionSimulado(parseFloat(e.target.value) / 100);
  };

  // Reset a valores actuales
  const handleReset = () => {
    setTnaFCISimulado(tnaFCIActual);
    setTnaCaucionSimulado(tnaCaucionActual);
  };

  // Determinar estado visual
  const isSpreadPositive = spreadSimulado > 0;
  const isSpreadImproved = spreadSimulado > (bufferTasaActual / 100);
  const isSpreadWorse = spreadSimulado < (bufferTasaActual / 100) && spreadSimulado > 0;
  const isSpreadNegative = spreadSimulado <= 0;

  // Estilos condicionales para la caja de resultados
  const getResultBoxStyles = () => {
    if (isSpreadNegative) {
      return 'bg-danger/10 border-danger';
    }
    if (isSpreadImproved) {
      return 'border-success';
    }
    if (isSpreadWorse) {
      return 'border-warning';
    }
    return 'border-border-primary';
  };

  // Componente reutilizable para slider con accesibilidad mejorada
  const SliderControl = ({ label, value, onChange, min = 20, max = 50, step = 0.25 }) => {
    const sliderId = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const valuePercent = value * 100;

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label
            htmlFor={sliderId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
          <span
            id={`${sliderId}-value`}
            className="text-sm font-mono font-semibold text-primary"
            aria-live="polite"
          >
            {formatPercent(valuePercent)}
          </span>
        </div>
        <input
          id={sliderId}
          type="range"
          role="slider"
          min={min}
          max={max}
          step={step}
          value={valuePercent}
          onChange={onChange}
          aria-label={`${label}: ${formatPercent(valuePercent)}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valuePercent}
          aria-describedby={`${sliderId}-value`}
          className="w-full h-2 bg-background-tertiary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
          style={{
            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${((valuePercent - min) / (max - min)) * 100}%, var(--background-tertiary) ${((valuePercent - min) / (max - min)) * 100}%, var(--background-tertiary) 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-text-tertiary" aria-hidden="true">
          <span>{min}%</span>
          <span>{max}%</span>
        </div>
      </div>
    );
  };

  // Componente para card de comparación
  const ComparisonCard = ({ title, simulado, actual, diff }) => {
    const isPositive = diff >= 0;
    const diffColor = isPositive ? 'text-success' : 'text-danger';
    const diffSign = isPositive ? '+' : '';
    
    return (
      <div className="bg-background-secondary rounded-lg p-3 border border-border-secondary">
        <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">{title}</p>
        <p className={`text-xl font-bold font-mono ${simulado >= 0 ? 'text-success' : 'text-danger'}`}>
          {formatARS(simulado)}
        </p>
        <div className="mt-2 pt-2 border-t border-border-secondary space-y-1">
          <p className="text-xs text-text-secondary">
            Actual: <span className="font-mono">{formatARS(actual)}</span>
          </p>
          <p className={`text-xs font-medium ${diffColor}`}>
            Dif: <span className="font-mono">{diffSign}{formatARS(diff)}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sliders */}
      <div className="space-y-6">
        <SliderControl
          label="TNA FCI"
          value={tnaFCISimulado}
          onChange={handleFCIChange}
        />
        <SliderControl
          label="TNA Caución"
          value={tnaCaucionSimulado}
          onChange={handleCaucionChange}
        />
      </div>

      {/* Caja de Resultados */}
      <div className={`bg-background-secondary rounded-xl p-5 border-2 ${getResultBoxStyles()}`}>
        <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4 text-center">
          Resultado de la Simulación
        </h4>

        {/* Spread resultante */}
        <div className="text-center mb-6">
          <p className="text-sm text-text-secondary mb-1">Spread resultante</p>
          <p className={`text-3xl font-bold font-mono ${isSpreadPositive ? 'text-success' : 'text-danger'}`}>
            {formatPercent(spreadSimulado * 100)}
          </p>
        </div>

        {/* Cards de comparación */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <ComparisonCard
            title="Diario"
            simulado={gananciaSimDia}
            actual={spreadNetoDiaActual}
            diff={diffDia}
          />
          <ComparisonCard
            title="Mensual"
            simulado={gananciaSimMes}
            actual={spreadMensualActual}
            diff={diffMes}
          />
          <ComparisonCard
            title="Anual"
            simulado={gananciaSimAnual}
            actual={spreadAnualActual}
            diff={diffAnual}
          />
        </div>

        {/* Mensajes contextuales */}
        {isSpreadNegative && (
          <div className="flex items-center gap-2 p-3 bg-danger/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <p className="text-sm text-danger font-medium">
              🚨 Spread negativo - Perderías {formatARS(Math.abs(gananciaSimDia))}/día
            </p>
          </div>
        )}
        
        {isSpreadImproved && !isSpreadNegative && (
          <div className="flex items-center gap-2 p-3 bg-success/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-success" />
            <p className="text-sm text-success font-medium">
              📈 Este escenario mejora tu ganancia en {formatARS(diffDia)}/día
            </p>
          </div>
        )}
        
        {isSpreadWorse && (
          <div className="flex items-center gap-2 p-3 bg-warning/20 rounded-lg">
            <TrendingDown className="w-5 h-5 text-warning" />
            <p className="text-sm text-warning font-medium">
              📉 Este escenario reduce tu ganancia en {formatARS(Math.abs(diffDia))}/día
            </p>
          </div>
        )}

        {/* Breakeven */}
        <div className="mt-4 pt-4 border-t border-border-secondary">
          <p className="text-sm text-text-secondary text-center">
            ⚠️ <span className="font-medium">Breakeven:</span> Si TNA FCI baja a {formatPercent(breakevenTnaFCI * 100)}, spread = 0%
          </p>
        </div>
      </div>

      {/* Botón Reset */}
      <button
        onClick={handleReset}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-background-tertiary hover:bg-background-tertiary/80 border border-border-secondary rounded-lg text-text-secondary hover:text-text-primary transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        <span className="text-sm font-medium">Resetear a valores actuales</span>
      </button>
    </div>
  );
}

export default ScenarioSimulator;
