# Carry Trade Module - Argos Capital

Módulo completo para análisis de carry trade en bonos argentinos. Motor de cálculo preciso con integración en tiempo real a data912.com.

## 📋 Características

- ✅ **Cálculos matemáticos verificados** - Fórmulas exactas según especificación
- ✅ **Integración data912.com** - Datos en tiempo real de MEP y bonos
- ✅ **TypeScript estricto** - Seguridad de tipos completa
- ✅ **Hooks React** - Integración fácil con componentes
- ✅ **Manejo de errores robusto** - Validación de datos y errores de API
- ✅ **Performance optimizada** - < 2 segundos para análisis completo
- ✅ **Documentación completa** - JSDoc y ejemplos de uso

## 🚀 Instalación Rápida

```typescript
import { useCarryTrade } from '@/features/carrytrade';

function CarryTradeDashboard() {
  const { state, refresh } = useCarryTrade({
    autoRefresh: true,
    refreshInterval: 30000 // 30 segundos
  });

  if (state.loading) return <div>Cargando...</div>;
  if (state.error) return <div>Error: {state.error}</div>;

  return (
    <div>
      <h1>Análisis Carry Trade</h1>
      <p>MEP Actual: ${state.mepRate?.toFixed(2)}</p>
      <p>Mejor Retorno: {state.summary?.bestBondByReturn?.bond.ticker}</p>
    </div>
  );
}
```

## 📦 Estructura del Módulo

```
src/features/carrytrade/
├── models.ts          # Tipos e interfaces
├── calculator.ts      # Motor de cálculo matemático
├── dataService.ts     # Integración con data912.com
├── config.ts          # Configuración hardcodeada de bonos
├── validators.ts      # Validación de datos
├── hooks/
│   └── useCarryTrade.ts  # Hooks de React
└── index.ts           # Exportaciones principales
```

## 🔧 API Reference

### Models

#### `Bond`
```typescript
interface Bond {
  ticker: string;           // Código del bono
  maturityDate: Date;       // Fecha de vencimiento
  payoff: number;           // Valor de rescate en ARS
  currentPrice: number;     // Precio actual en ARS
  bondType: BondType;       // 'LECAP' | 'BONCAP' | 'DUAL'
}
```

#### `CarryTradeResult`
```typescript
interface CarryTradeResult {
  bond: Bond;               // Bono analizado
  mepRate: number;          // TC MEP actual
  breakevenRate: number;    // TC breakeven
  totalReturnUsd: number;   // Retorno total en USD (%)
  maxVariation: number;     // Máx variación TC (%)
  spreadVsTc: number;       // Spread vs TC (puntos %)
  upperBand: number;        // Banda superior cambiaria
  lowerBand: number;        // Banda inferior cambiaria
  tirUsd: number;           // TIR anualizada en USD (%)
}
```

### Calculator

#### `CarryTradeCalculator`

```typescript
const calculator = new CarryTradeCalculator({
  monthlyInflation: 0.01,      // 1% mensual
  lowerBandTolerance: 0.95,    // 5% margen inferior
  upperBandMultiplier: 1.05    // 5% margen superior
});

// Análisis de un solo bono
const result = calculator.analyzeBond(bond, mepRate);

// Análisis de múltiples bonos
const results = calculator.analyzeBonds(bonds, mepRate, 'totalReturnUsd');

// Métricas agregadas
const summary = calculator.calculateSummary(results, mepRate);
```

#### Fórmulas Matemáticas

**Breakeven:**
```
TC_breakeven = (Payoff / Precio_compra) × TC_inicial
```

**Retorno USD:**
```
Retorno_USD = [(Payoff / TC_final) / (Precio / TC_inicial)] - 1
```

**Máxima Variación:**
```
Max_Var = [(TC_breakeven / TC_inicial) - 1] × 100
```

**TIR USD Anualizada:**
```
TIR_USD = ((1 + return)^(365/dias) - 1) × 100
```

### Data Service

#### `Data912Service`

```typescript
const service = new Data912Service(timeout, retries);

// Obtener MEP
const mepRate = await service.getMepRate();

// Obtener precios de bonos
const prices = await service.getBondPrices();

// Obtener bonos completos
const bonds = await service.getBonds();

// Obtener bono específico
const bond = await service.getBond('T30E6');
```

### React Hooks

#### `useCarryTrade`

```typescript
const { 
  state,      // Estado completo (results, summary, loading, error)
  refresh,    // Función para refrescar manualmente
  setSorting, // Cambiar ordenamiento
  getBestBond, // Obtener mejor bono
  filterByType // Filtrar por tipo de bono
} = useCarryTrade({
  config: { monthlyInflation: 0.01 },
  sortBy: 'totalReturnUsd',
  ascending: false,
  autoRefresh: true,
  refreshInterval: 30000
});
```

#### `useSingleBondCarry`

```typescript
const { result, loading, error } = useSingleBondCarry(bond, mepRate);
```

#### `useMepRate`

```typescript
const { mepRate, loading, error, refresh } = useMepRate(30000);
```

## ⚙️ Configuración

### Bonos Soportados (Hardcodeados)

```typescript
// LECAPs (Letras Capitalizables)
'T30E6', 'T13F6', 'S27F6', 'S17A6', 'S30A6', 'S29Y6'

// BONCAPs (Bonos Capitalizables)
'T30J6', 'S31G6', 'S30O6', 'S30N6', 'T15E7', 'T30A7', 'T31Y7', 'T30J7'

// DUALs (Bonos Duales)
'TTM26', 'TTJ26', 'TTS26', 'TTD26'
```

### Configuración Global

```typescript
const DEFAULT_CONFIG = {
  monthlyInflation: 0.01,      // 1% mensual esperado
  lowerBandTolerance: 0.95,    // 5% margen inferior
  upperBandMultiplier: 1.05    // 5% margen superior
};
```

## 🧪 Testing

### Tests Unitarios Básicos

```typescript
import { CarryTradeCalculator } from '@/features/carrytrade';

describe('CarryTradeCalculator', () => {
  const calculator = new CarryTradeCalculator();
  
  const mockBond = {
    ticker: 'T30E6',
    maturityDate: new Date('2026-01-30'),
    payoff: 142.22,
    currentPrice: 100.0,
    bondType: 'LECAP'
  };

  test('calculateBreakeven', () => {
    const mep = 1500;
    const breakeven = calculator.calculateBreakeven(mockBond, mep);
    expect(breakeven).toBe((142.22 / 100) * 1500); // 2133.30
  });

  test('calculateReturnUsd', () => {
    const mep = 1500;
    const returnUsd = calculator.calculateReturnUsd(mockBond, mep, mep);
    expect(returnUsd).toBe(((142.22 / 1500) / (100 / 1500) - 1) * 100); // 42.22%
  });
});
```

## 📊 Ejemplo Completo

```typescript
import { 
  useCarryTrade, 
  CarryTradeCalculator,
  Data912Service 
} from '@/features/carrytrade';

// Componente React
function CarryAnalysis() {
  const { state, refresh, filterByType } = useCarryTrade();

  // Filtrar solo LECAPs
  const lecaps = filterByType('LECAP');

  return (
    <div>
      <h1>Análisis Carry Trade</h1>
      
      {state.loading && <p>Cargando...</p>}
      {state.error && <p>Error: {state.error}</p>}
      
      {state.mepRate && (
        <div>
          <h2>MEP: ${state.mepRate.toFixed(2)}</h2>
          <p>Bonos analizados: {state.summary?.totalBonds}</p>
          <p>Bonos con retorno positivo: {state.summary?.positiveReturnBonds}</p>
        </div>
      )}

      <h3>LECAPs Disponibles</h3>
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Vencimiento</th>
            <th>Retorno USD %</th>
            <th>Breakeven</th>
            <th>TIR USD %</th>
          </tr>
        </thead>
        <tbody>
          {lecaps.map(result => (
            <tr key={result.bond.ticker}>
              <td>{result.bond.ticker}</td>
              <td>{result.bond.maturityDate.toLocaleDateString()}</td>
              <td>{result.totalReturnUsd.toFixed(2)}%</td>
              <td>${result.breakevenRate.toFixed(2)}</td>
              <td>{result.tirUsd.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={refresh}>Refrescar Datos</button>
    </div>
  );
}

// Uso programático sin React
async function analyzeCarry() {
  const service = new Data912Service();
  const calculator = new CarryTradeCalculator();

  const [mepRate, bonds] = await Promise.all([
    service.getMepRate(),
    service.getBonds()
  ]);

  const results = calculator.analyzeBonds(bonds, mepRate);
  
  console.log(`MEP: $${mepRate}`);
  console.log('Mejor bono por retorno:', 
    results.sort((a, b) => b.totalReturnUsd - a.totalReturnUsd)[0]
  );
}
```

## 🔗 Integración con Sistema Existente

El módulo puede integrarse con el `priceService` existente del proyecto:

```typescript
import { usePrices } from '@/features/portfolio/services/priceService';
import { CarryTradeCalculator } from '@/features/carrytrade';

function IntegratedAnalysis() {
  const { prices, mepRate } = usePrices();
  const calculator = new CarryTradeCalculator();

  // Usar precios del sistema existente
  // y combinar con lógica de carry trade
}
```

## ⚠️ Consideraciones

1. **Datos Hardcodeados**: Los bonos están configurados manualmente en `config.ts` y deben actualizarse según información oficial del Ministerio de Economía.

2. **Inflación**: El valor por defecto de 1% mensual es una estimación. Para mayor precisión, considerar integrar API del INDEC.

3. **Bonos DUALs**: Actualmente solo se usa la tasa fija. La proyección TAMAR requiere integración con API del BCRA.

4. **Rate Limiting**: data912.com tiene límite de 120 req/min. El hook `useCarryTrade` implementa intervalos razonables (30s).

## 📈 Roadmap

- [ ] Integración API INDEC para inflación real
- [ ] Soporte para proyección TAMAR en bonos DUALs
- [ ] Cache Redis para mejorar performance
- [ ] Simulador de escenarios con diferentes TC proyectados
- [ ] Alertas cuando un bono supera thresholds de retorno
- [ ] Optimizador de cartera según perfil de riesgo

## 📝 Changelog

### v1.0.0 (2026-01-31)
- ✅ Implementación inicial completa
- ✅ Motor de cálculo matemático preciso
- ✅ Integración data912.com
- ✅ Hooks React para integración
- ✅ Validación de datos robusta
- ✅ Documentación completa

## 👥 Autores

- Argos Capital Team

## 📄 Licencia

Propietario - Argos Capital
