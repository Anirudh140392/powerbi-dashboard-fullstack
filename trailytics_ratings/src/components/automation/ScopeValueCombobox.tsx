/**
 * Searchable dropdown for the alert-rule scope value.
 *
 * Replaces the previous free-text web_pid/brand/category input with a typeahead
 * combobox bound to /api/ratings/alert-scope-options?type=…&q=…. Fetches on
 * focus + on every keystroke (debounced 200ms), shows up to 200 options.
 *
 * Empty value is legal — it means "all" within the scope type.
 */
import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, ChevronDown } from 'lucide-react';
import { resolveCompanyId } from '../../utils/tenant';
import { buildAuthHeaders } from '../../utils/auth';

interface Option { value: string; label: string; brand?: string; platform?: string; is_competitor?: boolean }

interface Props {
  scopeType: 'product' | 'brand' | 'category';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ScopeValueCombobox({ scopeType, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync if external value changes
  useEffect(() => { setQuery(value); }, [value]);

  // Fetch options when open + on query change (debounced 200ms)
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const companyId = resolveCompanyId();
        const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_RAILWAY_URL || '';
        const params = new URLSearchParams({ company_id: companyId, type: scopeType });
        if (query.trim()) params.set('q', query.trim());
        const res = await fetch(`${backendUrl}/api/ratings/alert-scope-options?${params.toString()}`, {
          headers: buildAuthHeaders({}, companyId),
        });
        const data = await res.json();
        setOptions(data.options || []);
        setHighlight(0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [open, query, scopeType]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (opt: Option) => {
    onChange(opt.value);
    setQuery(opt.value);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm"
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter' && options[highlight]) { e.preventDefault(); pick(options[highlight]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {value && (
          <button type="button" onClick={() => { onChange(''); setQuery(''); }} className="text-slate-400 hover:text-rose-500">
            <X size={12} />
          </button>
        )}
        <button type="button" onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-slate-600">
          <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          )}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 italic">No matches. Leave blank for "all".</div>
          )}
          {!loading && options.map((opt, i) => (
            <button
              key={opt.value + (opt.platform || '')}
              type="button"
              onClick={() => pick(opt)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-1.5 text-xs ${
                i === highlight ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{opt.label}</div>
              {(opt.brand || opt.platform || opt.is_competitor) && (
                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  {opt.brand && <span>{opt.brand}</span>}
                  {opt.platform && <><span>·</span><span className="capitalize">{opt.platform}</span></>}
                  {opt.is_competitor && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 rounded">COMP</span>}
                  {scopeType === 'product' && <span className="text-slate-400 font-mono ml-auto">{opt.value}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
