/**
 * Carry Trade Data Service
 * Integración con API data912.com para obtener precios en tiempo real
 */

import type { Bond } from './models';
import { BOND_CONFIG, getBondConfig, isSupportedBond } from './config';

/**
 * Endpoints de la API data912.com
 */
const API_ENDPOINTS = {
  /** Precios MEP (incluye bonos con cotización MEP) */
  MEP: 'https://data912.com/live/mep',
  /** Letras argentinas */
  ARG_NOTES: 'https://data912.com/live/arg_notes',
  /** Bonos argentinos */
  ARG_BONDS: 'https://data912.com/live/arg_bonds'
} as const;

/**
 * Interfaz para respuesta de precio desde data912
 */
interface Data912PriceResponse {
  ticker?: string;
  symbol?: string;
  last?: number;
  close?: number;
  price?: number;
  // Campos adicionales que pueden venir
  [key: string]: unknown;
}

/**
 * Error específico del servicio de datos
 */
export class DataServiceError extends Error {
  constructor(
    message: string,
    public code: 'MEP_FETCH_ERROR' | 'BONDS_FETCH_ERROR' | 'INVALID_DATA' | 'NETWORK_ERROR'
  ) {
    super(message);
    this.name = 'DataServiceError';
  }
}

/**
 * Servicio para obtener datos de data912.com
 */
export class Data912Service {
  private timeout: number;
  private retries: number;

  /**
   * Crea una nueva instancia del servicio
   * @param timeout Timeout en ms (default: 10000)
   * @param retries Número de reintentos (default: 3)
   */
  constructor(timeout: number = 10000, retries: number = 3) {
    this.timeout = timeout;
    this.retries = retries;
  }

  /**
   * Obtiene el tipo de cambio MEP actual desde data912
   * @returns Precio MEP actual
   */
  async getMepRate(): Promise<number> {
    try {
      const response = await this.fetchWithRetry(API_ENDPOINTS.MEP);

      if (!response.ok) {
        throw new DataServiceError(
          `Error HTTP ${response.status} al obtener MEP`,
          'MEP_FETCH_ERROR'
        );
      }

      const data: Data912PriceResponse[] = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new DataServiceError(
          'Respuesta vacía de API MEP',
          'INVALID_DATA'
        );
      }

      // Buscar ticker 'MEP' o calcular mediana de precios
      const mepTicker = data.find(item => 
        (item.ticker === 'MEP' || item.symbol === 'MEP') && 
        (item.last || item.close || item.price)
      );

      if (mepTicker) {
        return mepTicker.last || mepTicker.close || mepTicker.price || 0;
      }

      // Si no hay ticker MEP específico, calcular mediana de todos los precios
      const prices = data
        .map(item => item.last || item.close || item.price)
        .filter((price): price is number => price !== undefined && price > 0);

      if (prices.length === 0) {
        throw new DataServiceError(
          'No se encontraron precios MEP válidos',
          'INVALID_DATA'
        );
      }

      return this.calculateMedian(prices);

    } catch (error) {
      if (error instanceof DataServiceError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DataServiceError(
          'Timeout al obtener MEP',
          'NETWORK_ERROR'
        );
      }

      throw new DataServiceError(
        `Error obteniendo MEP: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MEP_FETCH_ERROR'
      );
    }
  }

  /**
   * Obtiene precios actuales de bonos y letras desde data912
   * @returns Mapa de ticker -> precio
   */
  async getBondPrices(): Promise<Record<string, number>> {
    try {
      // Fetch en paralelo para mejor performance
      const [notesResponse, bondsResponse] = await Promise.all([
        this.fetchWithRetry(API_ENDPOINTS.ARG_NOTES),
        this.fetchWithRetry(API_ENDPOINTS.ARG_BONDS)
      ]);

      const prices: Record<string, number> = {};

      // Procesar letras
      if (notesResponse.ok) {
        const notesData: Data912PriceResponse[] = await notesResponse.json();
        this.processPriceData(notesData, prices);
      }

      // Procesar bonos
      if (bondsResponse.ok) {
        const bondsData: Data912PriceResponse[] = await bondsResponse.json();
        this.processPriceData(bondsData, prices);
      }

      if (Object.keys(prices).length === 0) {
        throw new DataServiceError(
          'No se pudieron obtener precios de bonos',
          'BONDS_FETCH_ERROR'
        );
      }

      return prices;

    } catch (error) {
      if (error instanceof DataServiceError) {
        throw error;
      }

      throw new DataServiceError(
        `Error obteniendo precios: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BONDS_FETCH_ERROR'
      );
    }
  }

  /**
   * Construye objetos Bond con datos actualizados desde data912
   * @returns Lista de bonos listos para análisis
   */
  async getBonds(): Promise<Bond[]> {
    const prices = await this.getBondPrices();

    const bonds: Bond[] = [];

    for (const ticker of Object.keys(BOND_CONFIG)) {
      const config = getBondConfig(ticker);
      const price = prices[ticker];

      if (!config) {
        console.warn(`Configuración no encontrada para ${ticker}`);
        continue;
      }

      if (!price || price <= 0) {
        console.warn(`Precio no disponible para ${ticker}: ${price}`);
        continue;
      }

      bonds.push({
        ticker,
        maturityDate: new Date(config.maturity),
        payoff: config.payoff,
        currentPrice: price,
        bondType: config.type
      });
    }

    return bonds;
  }

  /**
   * Obtiene un bono específico con precio actual
   * @param ticker Código del bono
   * @returns Bono con datos actualizados o null si no disponible
   */
  async getBond(ticker: string): Promise<Bond | null> {
    if (!isSupportedBond(ticker)) {
      return null;
    }

    try {
      const prices = await this.getBondPrices();
      const config = getBondConfig(ticker);
      const price = prices[ticker];

      if (!config || !price || price <= 0) {
        return null;
      }

      return {
        ticker,
        maturityDate: new Date(config.maturity),
        payoff: config.payoff,
        currentPrice: price,
        bondType: config.type
      };

    } catch (error) {
      console.error(`Error obteniendo bono ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Helper: Fetch con timeout y retry
   */
  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            return response;
          }

          // Si la respuesta no es OK pero no es error de red, no reintentar
          if (response.status >= 400 && response.status < 500) {
            return response;
          }

          // Para errores 5xx, reintentar
          lastError = new Error(`HTTP ${response.status}`);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // No reintentar en el último intento
        if (attempt < this.retries - 1) {
          // Esperar antes de reintentar (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error(`Failed after ${this.retries} attempts`);
  }

  /**
   * Helper: Procesar datos de precios desde data912
   */
  private processPriceData(
    data: Data912PriceResponse[],
    prices: Record<string, number>
  ): void {
    for (const item of data) {
      const ticker = item.ticker || item.symbol;
      const price = item.last || item.close || item.price;

      if (ticker && price && price > 0) {
        prices[ticker] = price;
      }
    }
  }

  /**
   * Helper: Calcular mediana de un array
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }
}

/**
 * Función helper para crear instancia del servicio
 */
export function createData912Service(
  timeout?: number,
  retries?: number
): Data912Service {
  return new Data912Service(timeout, retries);
}

/**
 * Función helper para obtener MEP rate rápidamente
 */
export async function getMepRate(): Promise<number> {
  const service = new Data912Service();
  return service.getMepRate();
}

/**
 * Función helper para obtener todos los bonos con precios
 */
export async function getAllBonds(): Promise<Bond[]> {
  const service = new Data912Service();
  return service.getBonds();
}
