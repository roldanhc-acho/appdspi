import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  isHeader?: boolean;
  indent?: boolean;
  className?: string;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  id?: string;
  name?: string;
  noOptionsMessage?: string;
  searchPlaceholder?: string;
}

// Helper to remove accents/diacritics and convert to lowercase for flexible searching
const normalizeText = (str: string) =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  className = '',
  required = false,
  id,
  name,
  noOptionsMessage = 'No se encontraron opciones',
  searchPlaceholder = 'Buscar...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Selected option label
  const selectedOption = options.find((opt) => !opt.isHeader && opt.value === value);

  // Filter options based on search query (tokenized multi-word + accent insensitive)
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;

    const tokens = normalizeText(searchQuery).split(/\s+/).filter(Boolean);
    const result: SelectOption[] = [];
    let currentHeader: SelectOption | null = null;
    let headerHasMatch = false;

    for (const opt of options) {
      if (opt.isHeader) {
        currentHeader = opt;
        headerHasMatch = false;
      } else {
        const optText = normalizeText(opt.label);
        // All words in search query must be present in option label
        const matches = tokens.every((token) => optText.includes(token));
        if (matches) {
          if (currentHeader && !headerHasMatch) {
            result.push(currentHeader);
            headerHasMatch = true;
          }
          result.push(opt);
        }
      }
    }

    return result;
  }, [options, searchQuery]);

  // Selectable options (excluding disabled and headers)
  const selectableOptions = React.useMemo(() => {
    return filteredOptions.filter((opt) => !opt.disabled && !opt.isHeader);
  }, [filteredOptions]);

  // Auto-highlight first matching option when search query changes
  useEffect(() => {
    if (searchQuery.trim() && selectableOptions.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [searchQuery, selectableOptions.length]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Handle keyboard navigation and direct typing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((prev) => {
        const nextIndex = prev + 1;
        return nextIndex < selectableOptions.length ? nextIndex : 0;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightedIndex((prev) => {
        const nextIndex = prev - 1;
        return nextIndex >= 0 ? nextIndex : selectableOptions.length - 1;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        if (highlightedIndex >= 0 && highlightedIndex < selectableOptions.length) {
          const selected = selectableOptions[highlightedIndex];
          handleSelect(selected.value);
        }
      } else {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      if (isOpen) {
        setIsOpen(false);
      }
    } else if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.target !== searchInputRef.current
    ) {
      // If user starts typing directly while focused on the dropdown button
      if (!isOpen) {
        setIsOpen(true);
      }
      setSearchQuery((prev) => prev + e.key);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsListRef.current) {
      const highlightedEl = optionsListRef.current.querySelector(
        `[data-selectable-index="${highlightedIndex}"]`
      );
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Main Select Button */}
      <button
        type="button"
        id={selectId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={
          className ||
          `w-full flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-white'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 text-slate-400">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Limpiar selección"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : ''}`}
          />
        </span>
      </button>

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="max-h-60 overflow-y-auto py-1 text-sm scrollbar-thin scrollbar-thumb-slate-700"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-center text-slate-400">
                {noOptionsMessage}
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                if (opt.isHeader) {
                  return (
                    <div
                      key={`header-${index}-${opt.label}`}
                      className="sticky top-0 bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider select-none border-y border-slate-700/50 my-1"
                    >
                      {opt.label}
                    </div>
                  );
                }

                const isSelected = opt.value === value;
                const selectableIndex = selectableOptions.findIndex((so) => so.value === opt.value);
                const isHighlighted = selectableIndex === highlightedIndex;

                return (
                  <div
                    key={`${opt.value}-${index}`}
                    data-selectable-index={selectableIndex >= 0 ? selectableIndex : undefined}
                    onClick={() => {
                      if (!opt.disabled) handleSelect(opt.value);
                    }}
                    onMouseEnter={() => {
                      if (!opt.disabled && selectableIndex >= 0) {
                        setHighlightedIndex(selectableIndex);
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                      opt.indent ? 'pl-7' : 'pl-3'
                    } ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : isSelected
                        ? 'bg-blue-600/25 text-blue-300 font-medium'
                        : isHighlighted
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    } ${opt.className || ''}`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-400 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
