// src/utils/retry.js
import { CONSTANTS } from './constants';

/**
 * Execute a function with exponential backoff retry
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} - Result of the function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS,
    baseDelay = CONSTANTS.RETRY_BASE_DELAY,
    maxDelay = 10000,
    onRetry = () => {}
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        onRetry(attempt, maxAttempts, delay, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Create a delayed promise
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if cache is still valid
 * @param {number} timestamp - Cache timestamp
 * @param {number} ttl - Time to live in milliseconds
 * @returns {boolean}
 */
export const isCacheValid = (timestamp, ttl) => {
  return Date.now() - timestamp < ttl;
};

/**
 * Get cache with validation
 * @param {string} key - Cache key
 * @param {number} ttl - Time to live
 * @returns {any|null}
 */
export const getFromCache = (key, ttl) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (isCacheValid(timestamp, ttl)) {
      return data;
    }
    
    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
};

/**
 * Set cache with timestamp
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
export const setCache = (key, data) => {
  try {
    const cacheItem = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
  } catch (error) {
    console.warn('Cache set failed:', error);
  }
};
