import React, { useMemo } from 'react';
import Decimal from 'decimal.js';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import { formatARS, formatNumber } from '@/utils/formatters';

/**
 * Panel de Alertas y Acciones para el Funding Engine
 * Muestra alertas contextuales y acciones sugeridas basadas en las métricas de carry trade
 * 
 * @param {Object} props
 * @param {Object} props.carryMetrics - Métricas de carry trade
 * @param {boolean} props.isFallback - Si la TNA es estimada (fallback)
 */
export function AlertsPanel({ carryMetrics, isFallback }) {
  const alerts = useMemo(() => {
    if (!carryMetrics) return [];

    const alertList = [];
    const {
      bufferTasaPct,
      ratioCobertura,
      capitalImproductivo,
      pctImproductivo,
      totalCaucion,
      saldoFCI,
    } = carryMetrics;

    const spread = bufferTasaPct;
    const cobertura = ratioCobertura;

    // =========================================================================
    // ALERTAS DE SPREAD (prioridad alta)
    // =========================================================================
    
    // Spread negativo (crítico)
    if (spread <= 0) {
      alertList.push({
        id: 'spread-negative',
        priority: 1,
        icon: AlertCircle,
        iconColor: 'text-danger',
        bgColor: 'bg-danger/5',
        borderColor: 'border-danger/30',
        title: `Spread negativo (${formatNumber(spread, 2)}%)`,
        message: 'Estás perdiendo dinero. Evaluar reducir caución.',
      });
    }
    // Spread crítico (0% - 0.5%)
    else if (spread > 0 && spread < 0.5) {
      alertList.push({
        id: 'spread-critical',
        priority: 2,
        icon: AlertTriangle,
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        title: `Spread crítico (${formatNumber(spread, 2)}%)`,
        message: 'Monitorear tasas de cerca.',
      });
    }
    // Spread ajustado (0.5% - 1%)
    else if (spread >= 0.5 && spread < 1) {
      alertList.push({
        id: 'spread-tight',
        priority: 3,
        icon: AlertTriangle,
        iconColor: 'text-warning',
        bgColor: 'bg-warning/5',
        borderColor: 'border-warning/30',
        title: `Spread ajustado (${formatNumber(spread, 2)}%)`,
        message: 'Poco margen de seguridad.',
      });
    }

    // =========================================================================
    // ALERTAS DE COBERTURA (prioridad media)
    // =========================================================================
    
    // Capital improductivo (cobertura < 100%)
    if (cobertura < 100 && capitalImproductivo > 0) {
      const accion = `Suscribir ${formatARS(capitalImproductivo)} al FCI para alcanzar cobertura 1:1`;
      alertList.push({
        id: 'capital-unproductive',
        priority: 4,
        icon: AlertTriangle,
        iconColor: 'text-warning',
        bgColor: 'bg-warning/5',
        borderColor: 'border-warning/30',
        title: `Capital improductivo: ${formatARS(capitalImproductivo)} (${formatNumber(pctImproductivo, 1)}%)`,
        message: accion,
        isAction: true,
      });
    }
    
    // Exceso de cobertura (cobertura >= 115%)
    if (cobertura >= 115) {
      const excesoCobertura = new Decimal(saldoFCI || 0)
        .minus(new Decimal(totalCaucion || 0).times('1.15'))
        .toNumber();
      const accion = `Retirar ${formatARS(excesoCobertura)} del FCI para comprar más activos`;
      alertList.push({
        id: 'excess-coverage',
        priority: 5,
        icon: Info,
        iconColor: 'text-primary',
        bgColor: 'bg-primary/5',
        borderColor: 'border-primary/30',
        title: `Exceso de cobertura (${formatNumber(cobertura, 1)}%)`,
        message: accion,
        isAction: true,
      });
    }

    // =========================================================================
    // ALERTAS DE TNA (prioridad baja)
    // =========================================================================
    
    // TNA estimada (fallback)
    if (isFallback) {
      alertList.push({
        id: 'tna-estimated',
        priority: 6,
        icon: AlertTriangle,
        iconColor: 'text-warning',
        bgColor: 'bg-warning/5',
        borderColor: 'border-warning/30',
        title: 'TNA FCI estimada',
        message: 'No hay datos suficientes de precios. Cargá precios históricos en la sección FCI.',
      });
    }

    // =========================================================================
    // TIPS CONTEXTUALES
    // =========================================================================
    
    // Tip: Si spread < 0.5%
    if (spread < 0.5 && spread > 0) {
      alertList.push({
        id: 'tip-spread',
        priority: 7,
        icon: Lightbulb,
        iconColor: 'text-text-secondary',
        bgColor: 'bg-background-tertiary',
        borderColor: 'border-border-secondary',
        title: 'Tip',
        message: 'Si el spread se vuelve negativo, considerar reducir caución tomada.',
        isTip: true,
      });
    }

    // Tip: Posición óptima
    if (cobertura >= 100 && spread >= 2) {
      alertList.push({
        id: 'tip-optimal',
        priority: 8,
        icon: CheckCircle,
        iconColor: 'text-success',
        bgColor: 'bg-success/5',
        borderColor: 'border-success/30',
        title: 'Posición óptima',
        message: 'Carry trade funcionando correctamente.',
        isSuccess: true,
      });
    }

    // Ordenar por prioridad
    return alertList.sort((a, b) => a.priority - b.priority);
  }, [carryMetrics, isFallback]);

  // Si no hay alertas, mostrar estado positivo
  if (alerts.length === 0) {
    return (
      <div className="bg-success/5 border border-success/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-success/10 rounded-lg">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-success">Todo en orden</h3>
            <p className="text-sm text-success/80 mt-1">
              Carry trade funcionando correctamente. No hay acciones pendientes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary rounded-xl border border-border-primary p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-warning" />
        <h2 className="text-lg font-semibold text-text-primary">Alertas y Acciones</h2>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${alert.bgColor} ${alert.borderColor}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`w-5 h-5 ${alert.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${alert.isAction ? 'text-text-primary' : alert.isTip ? 'text-text-secondary' : ''}`}>
                  {alert.title}
                </p>
                {alert.message && (
                  <p className={`text-sm mt-1 ${alert.isAction ? 'text-primary font-medium' : 'text-text-secondary'}`}>
                    {alert.isAction && '→ '}
                    {alert.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AlertsPanel;
