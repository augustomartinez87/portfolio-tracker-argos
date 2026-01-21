// src/hooks/useLocalStorage.js
import { useState } from 'react';

export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      if (typeof window === 'undefined') {
        return initialValue;
      }
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed : initialValue;
    } catch (error) {
      console.warn('localStorage error:', error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      if (typeof window === 'undefined') return;
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn('localStorage write error:', error);
    }
  };

  return [storedValue, setValue];
};