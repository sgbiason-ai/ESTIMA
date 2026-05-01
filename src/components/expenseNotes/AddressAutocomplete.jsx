// src/components/expenseNotes/AddressAutocomplete.jsx
// Champ d'adresse avec autocomplete Nominatim + favoris en haut.
// Retourne au parent un objet { label, lat, lon } via onChange.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Star, X, Home, Loader2 } from 'lucide-react';
import { searchAddresses } from '../../utils/expenseGeo';

const AddressAutocomplete = ({
  value,                  // { label, lat, lon } | null
  onChange,               // (val) => void
  favorites = [],         // [{ id, label, address, lat, lon, isHome }]
  placeholder = 'Adresse, ville, lieu...',
  iconColor = 'text-slate-500',
  onSaveAsFavorite,       // (data) => Promise — bouton "ajouter aux favoris"
  inputId,
}) => {
  const [query, setQuery] = useState(value?.label || '');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // Sync external value -> local query
  useEffect(() => {
    setQuery(value?.label || '');
  }, [value?.label]);

  // Close dropdown on click outside
  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Debounced search
  const triggerSearch = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const results = await searchAddresses(q, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setSuggestions(results);
        setLoading(false);
      }
    }, 350);
  }, []);

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    triggerSearch(v);
    // Si le user efface ou modifie : invalide les coords
    if (value?.label && v !== value.label) {
      onChange(null);
    }
  };

  const handleFocus = () => {
    setOpen(true);
    if (query.trim().length >= 3 && suggestions.length === 0) {
      triggerSearch(query);
    }
  };

  const handleSelect = (item) => {
    onChange({ label: item.label, lat: item.lat, lon: item.lon });
    setQuery(item.label);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setSuggestions([]);
  };

  const handleManualAccept = () => {
    // Accept comme texte libre (sans coords) — fallback si Nominatim ne trouve rien
    onChange({ label: query.trim(), lat: null, lon: null });
    setOpen(false);
  };

  // Filtre des favoris selon la saisie
  const filteredFavorites = favorites.filter((f) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return f.label.toLowerCase().includes(q) || (f.address || '').toLowerCase().includes(q);
  });

  const hasCoords = value?.lat != null && value?.lon != null;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${iconColor}`}>
          {hasCoords ? <MapPin size={12} /> : <Search size={12} />}
        </span>
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-8 pr-9 py-2 bg-gray-100 border rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-colors ${
            hasCoords ? 'border-emerald-300 focus:border-emerald-400' : 'border-gray-200/60 focus:border-blue-400'
          }`}
        />
        {loading && (
          <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            title="Effacer"
            tabIndex={-1}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (filteredFavorites.length > 0 || suggestions.length > 0 || query.trim().length >= 3 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-modal-stack max-h-72 overflow-y-auto">
          {filteredFavorites.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">
                Favoris
              </div>
              {filteredFavorites.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect({ label: f.label, lat: f.lat, lon: f.lon }); }}
                  className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center gap-2 group transition-colors"
                >
                  {f.isHome ? (
                    <Home size={12} className="text-amber-600 shrink-0" />
                  ) : (
                    <Star size={12} className="text-amber-500 shrink-0" fill="currentColor" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">{f.label}</div>
                    {f.address && f.address !== f.label && (
                      <div className="text-[10px] text-gray-400 truncate">{f.address}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              {filteredFavorites.length > 0 && (
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-t border-gray-100">
                  Suggestions
                </div>
              )}
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start gap-2 group transition-colors"
                >
                  <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">{s.label}</div>
                    <div className="text-[10px] text-gray-400 truncate">{s.displayName}</div>
                  </div>
                  {onSaveAsFavorite && (
                    <span
                      onMouseDown={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await onSaveAsFavorite({ label: s.label, address: s.displayName, lat: s.lat, lon: s.lon });
                        handleSelect(s);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-100 text-gray-300 hover:text-amber-600 transition-all"
                      title="Ajouter aux favoris"
                    >
                      <Star size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && suggestions.length === 0 && query.trim().length >= 3 && filteredFavorites.length === 0 && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleManualAccept(); }}
              className="w-full text-left px-3 py-3 hover:bg-gray-50 text-xs text-gray-600 transition-colors"
            >
              Aucune adresse trouvee. <span className="text-blue-600 font-medium">Utiliser "{query.trim()}" comme texte libre</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
