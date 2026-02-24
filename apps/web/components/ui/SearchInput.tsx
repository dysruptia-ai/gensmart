'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  debounce?: number;
  className?: string;
}

export default function SearchInput({
  placeholder = 'Search...',
  value: externalValue,
  onChange,
  onSearch,
  debounce: debounceMs = 300,
  className,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue ?? '');
  const value = externalValue !== undefined ? externalValue : internalValue;

  useEffect(() => {
    if (externalValue !== undefined) setInternalValue(externalValue);
  }, [externalValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (externalValue === undefined) setInternalValue(val);
      if (onChange) onChange(val);
    },
    [externalValue, onChange]
  );

  useEffect(() => {
    if (!onSearch) return;
    const timer = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, onSearch, debounceMs]);

  const handleClear = () => {
    if (externalValue === undefined) setInternalValue('');
    if (onChange) onChange('');
    if (onSearch) onSearch('');
  };

  return (
    <div className={[styles.wrapper, className ?? ''].filter(Boolean).join(' ')}>
      <span className={styles.icon} aria-hidden="true">
        <Search size={16} />
      </span>
      <input
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
