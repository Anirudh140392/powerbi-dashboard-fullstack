import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, Tag, SlidersHorizontal, X, Search, Check } from 'lucide-react';

const FILTER_TABS = [
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand",    label: "Brand",    icon: Tag },
];

function titleCase(s: string): string {
  return s ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
}

/** Normalize parent value (string | string[] | 'All' | '') into a plain string[] of selected items.
 *  Empty [] means "nothing committed yet" — modal will start with all checked. */
function normalizeToArray(v: string | string[]): string[] {
  if (!v) return [];
  if (v === 'All') return [];           // All → treat as "select all" (empty = all in parent)
  if (Array.isArray(v)) return v;
  return [v];
}

export default function ContentDashboardFilterModal({
  open,
  onClose,
  company,
  category, setCategory,
  brand,    setBrand,
}: any) {
  const [activeTab, setActiveTab] = useState("category");
  const [searchTerm, setSearchTerm] = useState("");

  // Available options (fetched once per modal open)
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands]         = useState<string[]>([]);
  const [isLoading, setIsLoading]             = useState(false);

  // Draft selections: null = "all selected", string[] = explicit list (may be empty = none)
  const [draftCategory, setDraftCategory]   = useState<string[] | null>(null);
  const [draftBrand, setDraftBrand]         = useState<string[] | null>(null);

  // Fetch options ONCE when modal opens — does NOT depend on draft selections
  const fetchOptions = useCallback(async () => {
    if (!company) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ company });
      const res = await fetch(`/api/content-dashboard/cascaded-filters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.categories) setLocalCategories(data.categories);
        if (data.brands)     setLocalBrands(data.brands);
      }
    } catch (err) {
      console.error("Failed to fetch filter options", err);
    } finally {
      setIsLoading(false);
    }
  }, [company]);

  // Sync drafts & fetch options when modal opens
  useEffect(() => {
    if (open) {
      setDraftCategory(normalizeToArray(category).length === 0 ? null : normalizeToArray(category));
      setDraftBrand(normalizeToArray(brand).length === 0 ? null : normalizeToArray(brand));
      setActiveTab("category");
      setSearchTerm("");
      fetchOptions();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSearchTerm(""); }, [activeTab]);

  // Per-tab helpers
  const tabConfig: Record<string, {
    options: string[];
    draft: string[] | null;
    setDraft: (v: string[] | null) => void;
  }> = {
    category: { options: localCategories, draft: draftCategory,  setDraft: setDraftCategory  },
    brand:    { options: localBrands,     draft: draftBrand,     setDraft: setDraftBrand      },
  };

  const { options, draft, setDraft } = tabConfig[activeTab];

  // null draft = all selected; empty array = none selected; array = explicit list
  const isAllSelected = draft === null || draft.length === options.length;
  const isNoneSelected = Array.isArray(draft) && draft.length === 0;

  const isChecked = (opt: string): boolean => {
    if (draft === null) return true;                            // all selected
    return draft.some(s => s.toLowerCase() === opt.toLowerCase());
  };

  const toggle = (opt: string) => {
    if (draft === null) {
      // Currently all selected → uncheck this one → keep everything EXCEPT this one
      setDraft(options.filter(o => o.toLowerCase() !== opt.toLowerCase()));
    } else {
      const already = draft.some(s => s.toLowerCase() === opt.toLowerCase());
      if (already) {
        const next = draft.filter(s => s.toLowerCase() !== opt.toLowerCase());
        setDraft(next);  // may become [] (none selected) — that is intentional
      } else {
        const next = [...draft, opt];
        // If all options are now checked, switch back to null (= all)
        setDraft(next.length === options.length ? null : next);
      }
    }
  };

  const selectAll = () => setDraft(null);    // null = all
  const clearAll  = () => setDraft([]);      // [] = none, but options stay visible

  // Selected count for display
  const selectedCount = draft === null ? options.length : draft.length;

  // Badge count for sidebar (0 means "all" / no constraint, so don't show)
  const countFor = (key: string) => {
    const d = tabConfig[key].draft;
    const opts = tabConfig[key].options;
    if (d === null || d.length === opts.length) return 0;  // all selected = no constraint
    return d.length;  // 0 means "none", still show
  };

  const handleApply = () => {
    // Convert internal draft to parent format
    const toParent = (d: string[] | null, opts: string[]): string | string[] => {
      if (d === null || d.length === opts.length) return 'All';  // all → 'All'
      if (d.length === 0) return [];                              // none → empty array (dashboard shows nothing)
      return d;
    };
    setCategory(toParent(draftCategory, localCategories));
    setBrand(toParent(draftBrand, localBrands));
    onClose();
  };

  const handleResetAll = () => {
    setDraftCategory(null);
    setDraftBrand(null);
  };

  if (!open) return null;

  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl h-[560px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left sidebar ── */}
          <div className="w-60 flex flex-col shrink-0" style={{ background: 'linear-gradient(160deg, #1e3a8a 0%, #2563eb 100%)' }}>
            <div className="p-5 flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <SlidersHorizontal size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-white leading-tight">Filters</h3>
                <p className="text-[11px] text-blue-200 mt-0.5">Refine your data</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
              {FILTER_TABS.map(tab => {
                const isActive = activeTab === tab.key;
                const cnt = countFor(tab.key);
                const isNone = tabConfig[tab.key].draft?.length === 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                      isActive ? 'bg-white text-blue-700 shadow-md' : 'text-blue-100 hover:bg-white/15'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-blue-600/10 text-blue-600' : 'bg-white/15 text-blue-200'}`}>
                        <tab.icon size={14} strokeWidth={2} />
                      </div>
                      <span>{tab.label}</span>
                    </div>
                    {isNone ? (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-rose-100 text-rose-600' : 'bg-white/25 text-white'}`}>0</span>
                    ) : cnt > 0 ? (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-white/25 text-white'}`}>{cnt}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="flex-1 flex flex-col bg-[#f8faff] overflow-hidden relative">

            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{FILTER_TABS.find(t => t.key === activeTab)?.label}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select {activeTab}s to filter your dashboard</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isNoneSelected ? 'bg-rose-100 text-rose-600' :
                  isAllSelected  ? 'bg-blue-600 text-white' :
                                   'bg-slate-100 text-slate-600'
                }`}>
                  {isNoneSelected ? '0 selected' : isAllSelected ? 'All selected' : `${selectedCount} selected`}
                </span>
                <button onClick={onClose} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Action bar */}
            <div className="px-6 py-3 flex items-center gap-2 bg-white border-b border-slate-100">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors bg-white"
              >
                Select all
              </button>
              <button
                onClick={clearAll}
                className={`px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
                  isNoneSelected
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                }`}
              >
                Clear
              </button>
              <div className="relative ml-auto w-52">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && filteredOptions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 pt-6">
                  <Search size={28} className="mb-2 opacity-40" />
                  <p className="text-sm font-medium">No results found</p>
                </div>
              )}

              {!isLoading && filteredOptions.map((opt: string) => {
                const checked = isChecked(opt);
                return (
                  <label
                    key={opt}
                    className={`flex items-center p-3 cursor-pointer rounded-xl border transition-all duration-150 ${
                      checked
                        ? 'bg-blue-50 border-blue-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <input type="checkbox" className="hidden" checked={checked} onChange={() => toggle(opt)} />
                    <div className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${
                      checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
                    }`}>
                      {checked && <Check size={10} strokeWidth={3.5} className="text-white" />}
                    </div>
                    <span className={`ml-3 text-[13px] font-medium ${checked ? 'text-blue-700 font-semibold' : 'text-slate-600'}`}>
                      {titleCase(opt)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white flex justify-between items-center shrink-0">
          <button onClick={handleResetAll} className="text-rose-500 text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors">
            <X size={13} strokeWidth={2.5} />
            Reset All
          </button>
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white">
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
