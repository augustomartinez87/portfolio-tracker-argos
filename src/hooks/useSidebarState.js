import { useState, useEffect } from 'react';

const STORAGE_KEY = 'sidebarExpanded';

export function useSidebarState() {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, sidebarExpanded ? 'true' : 'false');
    }
  }, [sidebarExpanded]);

  return [sidebarExpanded, setSidebarExpanded];
}
