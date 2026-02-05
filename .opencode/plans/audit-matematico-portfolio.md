# AUDITORÍA MATEMÁTICA - Portfolio Performance Metrics

**Fecha:** 2026-02-04  
**Auditor:** Quant Engineer / Portfolio Analytics Auditor  
**Archivos auditados:**
- `src/features/portfolio/services/performanceService.ts`
- `src/features/portfolio/hooks/usePerformanceMetrics.ts`
- `src/features/portfolio/__tests__/performanceService.test.ts`

---

## 🎯 RESUMEN EJECUTIVO

| Métrica | Estado | Observaciones |
|---------|--------|---------------|
| **XIRR** | ⚠️ **PARCIALMENTE CORRECTO** | Implementación matemática correcta pero con limitaciones en la convergencia |
| **TWR** | ❌ **INCORRECTO** | El hook usa aproximación simplificada que NO es TWR real |
| **YTD** | ⚠️ **PARCIALMENTE CORRECTO** | Fórmula OK pero estimación del valor inicial es problemática |

**Conclusión:** La implementación tiene errores graves en TWR y limitaciones importantes en YTD que afectan la confiabilidad de las métricas.

---

## 📊 1. AUDITORÍA XIRR (Extended Internal Rate of Return)

### 1.1 Verificación Matemática Formal

**Fórmula implementada:**
```
NPV(r) = Σ (CFᵢ / (1 + r)^((tᵢ - t₀) / MS_PER_YEAR)) = 0
```

**Implementación:**
- ✅ Usa Newton-Raphson con bisection fallback
- ✅ Ordena cash flows por fecha
- ✅ Valida que haya al menos un flujo positivo y uno negativo
- ✅ Aplica bounds razonables (-99% a 1000%)

### 1.2 Tests Sintéticos

| Caso | Descripción | Esperado | Estado |
|------|-------------|----------|--------|
| 1 | Buy & Hold: $100 → $110 en 365 días | XIRR ≈ 10% | ✅ **OK** |
| 2 | Timing favorable (flujo intermedio) | XIRR > TWR | ✅ **OK** |
| 3 | Timing desfavorable (flujo al final) | XIRR << TWR | ✅ **OK** |
| 4 | Flujos mismo día | Converge correctamente | ✅ **OK** |
| 5 | Solo flujos positivos | null | ✅ **OK** |
| 6 | Solo flujos negativos | null | ✅ **OK** |

### 1.3 Issues Encontrados

#### 🔴 Issue CRÍTICO: División por cero en NPV
**Ubicación:** `performanceService.ts:52`

```typescript
const denominator = Math.pow(1 + rate, years);
if (denominator === 0 || !isFinite(denominator)) return acc;
```

**Problema:**
- `Math.pow(1 + rate, years)` con rate = -1 retornaría 0
- Pero el código tiene bounds en -0.99, así que rate nunca llega a -1
- Sin embargo, para valores extremos (rate → -0.99, years grande), puede haber underflow

**Recomendación:** Agregar validación adicional para rate muy cercano a -1.

#### 🟡 Issue MEDIO: Tolerancia muy estricta
**Ubicación:** `performanceService.ts:70`

```typescript
const tolerance = 1e-7;
```

**Problema:**
- Tolerancia de 0.00001% puede causar no-convergencia en escenarios con muchos flujos
- Especialmente problemático con flujos de magnitudes muy diferentes

**Recomendación:** Relajar a 1e-6 o hacerlo configurable.

#### 🟢 Issue BAJO: Sin manejo de fechas duplicadas
**Ubicación:** `performanceService.ts:37`

```typescript
const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
```

**Problema:**
- Fechas exactamente iguales pueden causar years = 0
- El derivative evita división por cero pero podría consolidar flujos del mismo día

**Recomendación:** Consolidar flujos del mismo día antes del cálculo.

### 1.4 Validación Cruzada

Para validación cruzada recomendado:
```python
# Python con numpy_financial
import numpy_financial as npf

# Mismos flujos del Caso 2
flows = [-100, -100, 230]
dates = [0, 180, 365]  # días desde inicio
xirr_python = npf.xirr(flows, dates)
# Resultado esperado: ~40-45%
```

**Error tolerable:** < 0.01% (la implementación actual debería cumplir esto)

---

## 📊 2. AUDITORÍA TWR (Time Weighted Return)

### 2.1 Verificación Matemática Formal

**Fórmula correcta TWR:**
```
TWR = [∏(1 + rᵢ)] - 1

donde rᵢ = (V_final,i - V_inicial,i - CFᵢ) / V_inicial,i
```

**Problema GRAVE:** El hook `usePerformanceMetrics.ts` NO implementa TWR real.

### 2.2 Implementación Actual (INCORRECTA)

**Ubicación:** `usePerformanceMetrics.ts:121-159`

```typescript
// Simple TWR approximation: assume all investments at start
const totalReturn = (currentValuation - currentInvested) / currentInvested;

// For short periods, don't annualize
if (daysHeld < 365) {
  return {
    value: totalReturn * 100,
    warning: `Retorno de ${daysHeld} días (no anualizado)`
  };
}

// Annualize for periods >= 1 year
const annualizedReturn = (Math.pow(1 + totalReturn, 365 / daysHeld) - 1) * 100;
```

### 2.3 🔴🔴🔴 ERROR CRÍTICO: Esto NO es TWR

**Problemas:**

1. **Está calculando un retorno simple money-weighted**, no TWR
2. **No segmenta por cash flows** - ignora completamente el timing
3. **Asume que todo el capital estuvo invertido desde el inicio**
4. **No elimina el efecto de los cash flows** que es la definición de TWR

**Ejemplo del error:**
```
Escenario:
- Día 0: Invierto $100
- Día 180: Invierto $900 (mercado cayó 50%)
- Día 365: Valor = $500

TWR REAL:
- Período 1 (0-180): $100 → $50 (-50%)
- Período 2 (180-365): $950 → $500 (-47.4%)
- TWR = (0.5 × 0.526) - 1 = -73.7%

Lo que calcula el código:
- (500 - 1000) / 1000 = -50%
- ¡COMPLETAMENTE DIFERENTE!
```

### 2.4 Implementación Correcta de TWR

```typescript
// TWR requiere valuaciones intermedias en cada cash flow
export function calculateTWRFull(
  valuations: { date: Date; value: number }[],
  cashFlows: CashFlow[]
): number | null {
  if (valuations.length < 2) return null;
  
  const periodReturns: number[] = [];
  
  for (let i = 1; i < valuations.length; i++) {
    const prevValue = valuations[i-1].value;
    const nextValue = valuations[i].value;
    const cfInBetween = getCashFlowsBetween(valuations[i-1].date, valuations[i].date);
    
    // rᵢ = (Vᵢ - Vᵢ₋₁ - CF) / Vᵢ₋₁
    const periodReturn = (nextValue - prevValue - cfInBetween) / prevValue;
    periodReturns.push(periodReturn);
  }
  
  return calculateTWR(periodReturns); // La función del service está OK
}
```

### 2.5 Recomendación URGENTE

**OPCIONES:**

**A) Remover TWR temporalmente** (recomendado)
```typescript
// usePerformanceMetrics.ts
twr: { 
  value: null, 
  warning: 'TWR requiere datos históricos - implementación pendiente' 
}
```

**B) Implementar TWR correcto**
- Requiere almacenar valuaciones diarias o en fechas de cash flow
- Modificar base de datos para guardar snapshots de valor
- Implementar servicio de historial

---

## 📊 3. AUDITORÍA YTD (Year-to-Date)

### 3.1 Verificación Matemática Formal

**Fórmula implementada (Modified Dietz):**
```
YTD = (EndValue - StartValue - NetFlows) / StartValue
```

**Implementación:** ✅ Correcta matemáticamente

### 3.2 Tests Sintéticos

| Caso | StartValue | EndValue | NetFlows | Esperado | Resultado |
|------|------------|----------|----------|----------|-----------|
| Sin flujos | 1000 | 1200 | 0 | 20% | ✅ 20% |
| Con aporte | 1000 | 1400 | 200 | 20% | ✅ 20% |
| Con retiro | 1000 | 800 | -200 | 0% | ✅ 0% |

### 3.3 🔴 Issue CRÍTICO: Estimación incorrecta del StartValue

**Ubicación:** `usePerformanceMetrics.ts:108-110`

```typescript
// Estimate start value as: current invested - net flows this year
// This is an approximation; accurate calculation requires historical prices
const estimatedStartValue = currentInvested - ytdNetFlows;
```

**Problema:**
- `currentInvested` es el capital total histórico aportado
- `ytdNetFlows` son los flujos de este año
- PERO: no considera valorización del portafolio existente

**Ejemplo del error:**
```
Escenario:
- Año pasado: Invertí $10,000, ahora vale $20,000 (100% ganancia)
- Este año: No hice aportes ni retiros
- StartValue real: $20,000 (valor al 1/1)
- Lo que calcula el código: $20,000 - $0 = $20,000 ✅

PERO si:
- Este año: Agregué $5,000, ahora vale $28,000
- StartValue real: $20,000 (valor al 1/1)
- Lo que calcula el código: $25,000 - $5,000 = $20,000 ✅ (casualmente OK)

Y si:
- Año pasado: Invertí $10,000 en acciones que bajaron a $8,000
- Este año: Vendí todo ($8,000) y compré otras cosas que ahora valen $9,000
- StartValue real: $8,000
- Lo que calcula el código: Depende del invested acumulado...
```

### 3.4 Recomendación

**OPCIÓN A: Remover YTD hasta tener datos históricos**
```typescript
// Usar warning claro
warning: 'YTD requiere valuación del 1° de enero - estimación aproximada'
```

**OPCIÓN B: Implementar con datos históricos**
- Guardar snapshot de valor del portafolio cada día
- O al menos en el primer día de cada mes
- Usar interpolación si no hay dato exacto del 1/1

---

## 📊 4. EDGE CASES NO PROBADOS

### 4.1 Casos que requieren atención

| Caso | Descripción | Riesgo |
|------|-------------|--------|
| 1 | Portafolio con 100+ transacciones | Convergencia XIRR |
| 2 | Flujos de magnitudes muy diferentes ($100 vs $1M) | Precisión numérica |
| 3 | Tasas de retorno > 1000% (Argentina) | Bounds del algoritmo |
| 4 | Divisas mixtas (ARS + USD) | Consistencia de cálculos |
| 5 | Fees/comisiones como cash flows negativos | Definición de flujos |
| 6 | Dividendos reinvertidos | Flujos positivos adicionales |
| 7 | Corporate actions (splits, mergers) | Valuación correcta |
| 8 | Horarios de trading (misma fecha, diferente hora) | Ordenamiento |

---

## 📊 5. DIAGNÓSTICO FINAL

### 5.1 Tabla de Resultados

| Métrica | Fórmula | Implementación | Tests | Documentación | Estado |
|---------|---------|----------------|-------|---------------|--------|
| XIRR | ✅ Correcta | ⚠️ Aceptable | ✅ Sí | ✅ Buena | ⚠️ **USABLE CON PRECAUCIÓN** |
| TWR | ❌ NO implementada | ❌ Incorrecta | ✅ Tests pasan pero son inútiles | ⚠️ Engañosa | ❌ **NO USAR** |
| YTD | ✅ Correcta | ⚠️ Limitada | ✅ Sí | ⚠️ Parcial | ⚠️ **APROXIMACIÓN** |

### 5.2 Fallos Lógicos Encontrados

1. **TWR no es TWR:** El hook implementa un retorno money-weighted simple
2. **YTD usa estimación:** El valor inicial se calcula, no se mide
3. **Sin datos históricos:** TWR requiere valuaciones intermedias que no existen
4. **Consolidación de flujos:** Múltiples flujos el mismo día deberían consolidarse
5. **Manejo de errores:** XIRR puede no converger y solo retorna null sin contexto

### 5.3 Diagrama de Flujo de Cálculo

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADES (DB)                                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │ Ticker   │ Date     │ Type     │ Qty      │ Price    │      │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              TRADES TO CASH FLOWS                               │
│  Buy → negative amount                                          │
│  Sell → positive amount                                         │
│  Current Valuation → final positive                             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌──────────┐ ┌─────────────────┐
    │     XIRR        │ │   YTD    │ │   TWR (BROKEN)  │
    │  (Correcto)     │ │(Aproxim.)│ │  (NO USAR)      │
    │                 │ │          │ │                 │
    │ Newton-Raphson  │ │ Modified │ │ Simple Return   │
    │ + Bisection     │ │ Dietz    │ │ (Not Real TWR)  │
    └─────────────────┘ └──────────┘ └─────────────────┘
```

### 5.4 Recomendaciones de Corrección

#### Prioridad CRÍTICA (Hacer HOY):

1. **Deshabilitar TWR o cambiar label**
```typescript
// Option A: Deshabilitar
const twrResult = useMemo<MetricResult<number>>(() => ({
  value: null,
  warning: 'TWR requiere datos históricos - no disponible'
}), []);

// Option B: Cambiar label
<label>Retorno Total (no es TWR)</label>
```

2. **Agregar warning a YTD**
```typescript
// En usePerformanceMetrics.ts
if (isFirstYearPortfolio) {
  return {
    ...result,
    warning: 'Primer año - calculado desde primer aporte'
  };
}
// Else
return {
  ...result,
  warning: 'YTD estimado - requiere valuación histórica del 1° ene'
};
```

#### Prioridad ALTA (Esta semana):

3. **Mejorar XIRR**
```typescript
// Consolidar flujos del mismo día
const consolidateFlows = (flows: CashFlow[]): CashFlow[] => {
  const grouped = new Map<string, number>();
  flows.forEach(cf => {
    const key = cf.date.toISOString().split('T')[0];
    grouped.set(key, (grouped.get(key) || 0) + cf.amount);
  });
  return Array.from(grouped.entries()).map(([date, amount]) => ({
    date: new Date(date),
    amount
  }));
};
```

4. **Agregar tests de regresión**
```typescript
// Tests que validen contra Excel/lib externa
it('should match Excel XIRR within 0.01%', () => {
  const flows = [...]; // Caso del ticket
  const expected = 45.67; // De Excel
  expect(calculateXIRR(flows)).toBeCloseTo(expected, 2);
});
```

#### Prioridad MEDIA (Este mes):

5. **Implementar TWR correcto**
   - Agregar tabla `portfolio_snapshots` con valor diario
   - Calcular TWR usando valuaciones en fechas de cash flow
   - Servicio para guardar snapshots automáticamente

6. **Implementar YTD correcto**
   - Usar valuación del 1° de enero desde snapshots
   - Interpolación lineal si no hay dato exacto

#### Prioridad BAJA (Futuro):

7. Métricas adicionales: Sharpe, Sortino, Beta
8. Benchmark comparison
9. Gráficos de drawdown

---

## 📊 6. TESTS ADICIONALES RECOMENDADOS

### 6.1 Validación Cruzada

Crear script Python para validación:
```python
# validate_xirr.py
import numpy_financial as npf
import pandas as pd

# Exportar casos de test de TypeScript
# Calcular con numpy_financial
# Comparar resultados
# Tolerancia: 0.01%
```

### 6.2 Tests de Regresión

```typescript
// performanceService.test.ts

describe('Cross-validation with external tools', () => {
  it('should match Excel XIRR for standard cases', () => {
    // Casos calculados manualmente en Excel
    const testCases = [
      { flows: [...], expected: 45.67, name: 'Microsoft example' },
      { flows: [...], expected: 12.34, name: 'Portfolio case A' },
    ];
    
    testCases.forEach(({ flows, expected, name }) => {
      const result = calculateXIRR(flows);
      expect(result).toBeCloseTo(expected, 2);
    });
  });
});
```

---

## ✅ CHECKLIST DE ACCIÓN

- [ ] Deshabilitar TWR o cambiar label (HOY)
- [ ] Agregar warnings a YTD (HOY)
- [ ] Consolidar flujos del mismo día en XIRR (Esta semana)
- [ ] Crear script de validación cruzada Python (Esta semana)
- [ ] Agregar tests de regresión vs Excel (Esta semana)
- [ ] Diseñar esquema de snapshots para TWR real (Este mes)
- [ ] Implementar TWR correcto (Este mes)
- [ ] Implementar YTD con datos históricos (Este mes)
- [ ] Documentar limitaciones actuales en UI (HOY)

---

**Firma:** Quant Engineer  
**Fecha:** 2026-02-04  
**Próxima revisión:** 2026-02-11
