
import { useState, useCallback, useMemo } from 'react';

// Simple hook to manage search term and debouncing if needed later
export const useSearch = (initialValue = '') => {
    const [searchTerm, setSearchTerm] = useState(initialValue);

    // Future: Add logic to parse "ticker:MELI" or "type:bond" tags

    const clearSearch = useCallback(() => setSearchTerm(''), []);

    return {
        searchTerm,
        setSearchTerm,
        clearSearch,
        isSearching: !!searchTerm
    };
};
