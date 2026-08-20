import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value?: string | number | null;
  onChange: (value: any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  error?: string;
  clearable?: boolean;
  id?: string;
}

// Funcao auxiliar para remover acentos para busca flexivel
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options = [],
  value,
  onChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Pesquisar...',
  disabled = false,
  loading = false,
  className = '',
  error,
  clearable = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Encontra a opcao selecionada atualmente
  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value)
  );

  // Filtra as opcoes com base no termo de busca
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = normalizeText(searchTerm);
    const labelMatch = normalizeText(opt.label).includes(term);
    const sublabelMatch = opt.sublabel
      ? normalizeText(opt.sublabel).includes(term)
      : false;
    return labelMatch || sublabelMatch;
  });

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focar no campo de busca ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setHighlightedIndex(
        filteredOptions.findIndex(
          (opt) => String(opt.value) === String(value)
        )
      );
    } else {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Rolar para a opcao destacada
  useEffect(() => {
    if (
      isOpen &&
      highlightedIndex >= 0 &&
      listRef.current &&
      listRef.current.children[highlightedIndex]
    ) {
      const element = listRef.current.children[highlightedIndex] as HTMLElement;
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredOptions.length
        ) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Botao Trigger */}
      <button
        id={selectId}
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border ${
          error
            ? 'border-red-500 ring-1 ring-red-500/20'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white'
            : 'border-slate-200 hover:border-slate-300'
        } rounded-xl text-xs font-medium text-slate-900 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate">
          {loading ? (
            <span className="text-slate-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-600" />
              Carregando...
            </span>
          ) : selectedOption ? (
            <span className="font-semibold text-slate-800">
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="text-slate-400 font-normal ml-1.5 text-[11px]">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {clearable && selectedOption && !disabled && !loading && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Menu Suspenso */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200/90 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Input de Busca */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Opcoes */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1 divide-y-0 text-xs"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-xs font-medium">
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = highlightedIndex === index;

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      opt.disabled ? 'opacity-40 cursor-not-allowed' : ''
                    } ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100/80 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div>{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check size={14} className="text-blue-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
};
