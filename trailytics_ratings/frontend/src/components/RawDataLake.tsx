import React, { useState, useEffect } from 'react';
import { Database, Search, Download, Edit2, Sparkles, CheckSquare, Trash2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { resolveCompanyId } from '../utils/tenant';
import { authenticatedFetch, buildAuthHeaders } from '../utils/auth';

interface RawRow {
    id: string;
    product_name: string;
    web_pid: string;
    brand: string;
    platform: string;
    rating: number;
    pdp_rating: number;
    review_date: string;
    review_text: string | null;
    sentiment: string | null;
    specific_issue: string | null;
    category: string | null;
    material: string | null;
    wattage: string | null;
    is_competitor?: boolean;
    quality_score?: number | null;
    ml_inferred_rating?: number | null;
    review_title?: string | null;
}

interface RawDataLakeProps {
    filters?: {
        price_mode?: 'rp' | 'sp';
        price_min?: number;
        price_max?: number;
        platform?: string;
        category?: string;
        date_from?: string;
        date_to?: string;
    };
}

const RawDataLake: React.FC<RawDataLakeProps> = ({ filters }) => {
    const [data, setData] = useState<RawRow[]>([]);
    const [total, setTotal] = useState(0);
    const [metrics, setMetrics] = useState({ avgRating: 0, uniqueCategories: 0, blankCategories: 0, blankSentiments: 0 });
    const [loading, setLoading] = useState(false);
    
    // Pagination & Filters
    const [page, setPage] = useState(0);
    const [limit] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBlankCat, setFilterBlankCat] = useState(false);
    const [filterBlankSent, setFilterBlankSent] = useState(false);
    const [filterCompetitor, setFilterCompetitor] = useState(false);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isActioning, setIsActioning] = useState(false);

    // Edit Modal
    const [editingRow, setEditingRow] = useState<RawRow | null>(null);

    const backendUrl = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || '';
    const companyId = resolveCompanyId();

    const fetchLakeData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                company_id: companyId,
                limit: String(limit),
                offset: String(page * limit),
                filterBlankCategory: String(filterBlankCat),
                filterBlankSentiment: String(filterBlankSent),
                filterCompetitor: String(filterCompetitor)
            });
            if (searchQuery) query.set('searchQuery', searchQuery);
            if (filters?.price_mode) query.set('price_mode', filters.price_mode);
            if (filters?.price_min !== undefined) query.set('price_min', String(filters.price_min));
            if (filters?.price_max !== undefined) query.set('price_max', String(filters.price_max));
            if (filters?.platform) query.set('platform', filters.platform);
            if (filters?.category) query.set('category', filters.category);
            if (filters?.date_from) query.set('date_from', filters.date_from);
            if (filters?.date_to) query.set('date_to', filters.date_to);

            const res = await authenticatedFetch(`${backendUrl}/api/data-lake/reviews?${query.toString()}`, {}, companyId);
            if (res.ok) {
                const json = await res.json();
                setData(json.data || []);
                setTotal(json.total || 0);
                if (json.metrics) setMetrics(json.metrics);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLakeData();
        // Clear selections on page change/filter change
        setSelectedIds(new Set());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filterBlankCat, filterBlankSent, filterCompetitor, searchQuery, filters?.price_mode, filters?.price_min, filters?.price_max, filters?.platform, filters?.category]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const newSet = new Set(selectedIds);
            data.forEach(d => newSet.add(d.id));
            setSelectedIds(newSet);
        } else {
            const newSet = new Set(selectedIds);
            data.forEach(d => newSet.delete(d.id));
            setSelectedIds(newSet);
        }
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkLocalAi = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Fire Fast DeBERTa Local Taxonomy on ${selectedIds.size} rows?`)) return;
        
        setIsActioning(true);
        try {
            const res = await authenticatedFetch(`${backendUrl}/api/ml/jobs/spawn`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ 
                    jobName: 'DeBERTa Taxonomy',
                    ids: Array.from(selectedIds) 
                })
            }, companyId);
            const data = await res.json();
            if (data.success) {
                alert(`ML Process spawned locally! Check the /ml-control hidden dashboard to view the streaming matrix.`);
            } else {
                alert(`Error: ${data.error}`);
            }
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
        } finally {
            setIsActioning(false);
        }
    };

    const handleSingleRowAi = async (id: string) => {
        if (!window.confirm(`Fire Slow API (Gemini) strictly for this row?`)) return;
        
        setIsActioning(true);
        try {
            const res = await authenticatedFetch(`${backendUrl}/api/ml-audit/bulk-trigger`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ ids: [id] })
            }, companyId);
            const data = await res.json();
            if (data.success) {
                alert(`Gemini AI returned taxonomy mapped payload to Master QC Dashboard.`);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsActioning(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Permanently delete ${selectedIds.size} rows?!`)) return;
        
        setIsActioning(true);
        try {
            await authenticatedFetch(`${backendUrl}/api/data-lake/reviews/bulk-delete?company_id=${companyId}`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            }, companyId);
            fetchLakeData();
        } catch (e) {
            console.error(e);
        } finally {
            setIsActioning(false);
        }
    };

    const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingRow) return;
        setIsActioning(true);
        try {
            await authenticatedFetch(`${backendUrl}/api/data-lake/reviews/edit?company_id=${companyId}`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify(editingRow)
            }, companyId);
            setEditingRow(null);
            fetchLakeData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsActioning(false);
        }
    };

    const exportToCSV = async () => {
        const query = new URLSearchParams({
            company_id: companyId,
            filterBlankCategory: String(filterBlankCat),
            filterBlankSentiment: String(filterBlankSent),
            filterCompetitor: String(filterCompetitor)
        });
        if (searchQuery) query.set('searchQuery', searchQuery);
        if (filters?.price_mode) query.set('price_mode', filters.price_mode);
        if (filters?.price_min !== undefined) query.set('price_min', String(filters.price_min));
        if (filters?.price_max !== undefined) query.set('price_max', String(filters.price_max));
        if (filters?.platform) query.set('platform', filters.platform);
        if (filters?.category) query.set('category', filters.category);
        try {
            const res = await authenticatedFetch(`${backendUrl}/api/data-lake/export?${query.toString()}`, {}, companyId);
            if (!res.ok) {
                throw new Error(`Export failed: ${res.status}`);
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'ratings-data-lake.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 rounded-bl-2xl rounded-br-2xl md:rounded-bl-none overflow-hidden relative">
            
            {/* Control Bar */}
            <div className="p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0 z-10 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Database className="text-indigo-500" size={20} />
                        Raw Data Editor
                    </h2>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search PID, Brand, Title, Review text..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchLakeData()}
                            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64 md:w-80"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <input type="checkbox" checked={filterBlankCat} onChange={e => { setFilterBlankCat(e.target.checked); setPage(0); }} className="rounded border-slate-300 text-indigo-500" />
                        Blank Category
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <input type="checkbox" checked={filterBlankSent} onChange={e => { setFilterBlankSent(e.target.checked); setPage(0); }} className="rounded border-slate-300 text-indigo-500" />
                        Unclassified only
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <input type="checkbox" checked={filterCompetitor} onChange={e => { setFilterCompetitor(e.target.checked); setPage(0); }} className="rounded border-slate-300 text-amber-500" />
                        Is Competitor
                    </label>
                    
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                    
                    <button onClick={exportToCSV} className="text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 p-1.5 transition-colors">
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* KPI Metrics Dashboard */}
            <div className="px-6 py-3 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm z-10 flex-shrink-0">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Rows Filtered</span>
                    <span className="text-lg font-bold text-indigo-600">{total.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Score</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{metrics.avgRating.toFixed(2)}⭐</span>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unique Categories</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{metrics.uniqueCategories.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Missing Categories</span>
                    <span className="text-lg font-bold text-orange-600">{metrics.blankCategories.toLocaleString()} <span className="text-xs font-normal text-slate-500">({total > 0 ? ((metrics.blankCategories/total)*100).toFixed(1) : 0}%)</span></span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider" title="Reviews not yet aspect-classified (no sub-category) — usually text too short to classify. Not the same as Neutral sentiment.">Unclassified (no aspect)</span>
                    <span className="text-lg font-bold text-rose-600">{metrics.blankSentiments.toLocaleString()} <span className="text-xs font-normal text-slate-500">({total > 0 ? ((metrics.blankSentiments/total)*100).toFixed(1) : 0}%)</span></span>
                </div>
            </div>

            {/* Bulk Actions Contextual Header */}
            {selectedIds.size > 0 && (
                <div className="absolute top-16 left-0 right-0 z-20 bg-indigo-600 text-white px-6 py-2 flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                        <CheckSquare size={16} /> {selectedIds.size} rows selected
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleBulkLocalAi} disabled={isActioning} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors">
                            <Sparkles size={14} /> Run Local ML (DeBERTa Fast)
                        </button>
                        <button onClick={handleBulkDelete} disabled={isActioning} className="bg-red-500/80 hover:bg-red-500 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors">
                            <Trash2 size={14} /> Delete Selected
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="ml-2 opacity-60 hover:opacity-100">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <div className="flex-1 overflow-auto min-h-0 p-4">
                {loading ? (
                    <div className="flex justify-center items-center h-full text-slate-400">
                        <Loader2 className="animate-spin mr-2" /> Loading data lake...
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto shadow-sm">
                        <table className="w-full text-left border-collapse text-sm min-w-max">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                                    <th className="p-3 w-10">
                                        <input 
                                            type="checkbox" 
                                            onChange={handleSelectAll} 
                                            checked={data.length > 0 && data.every(d => selectedIds.has(d.id))}
                                            className="rounded border-slate-300 text-indigo-500" 
                                        />
                                    </th>
                                    <th className="p-3">Product / ID</th>
                                    <th className="p-3">Brand</th>
                                    <th className="p-3">Platform</th>
                                    <th className="p-3 text-center">Actual Rating</th>
                                    <th className="p-3 text-center">ML Rating</th>
                                    <th className="p-3 max-w-sm">Review (Title & Text)</th>
                                    <th className="p-3">Category (ML)</th>
                                    <th className="p-3">Sentiment (ML)</th>
                                    <th className="p-3">Material/Wattage</th>
                                    <th className="p-3 w-16 text-center">Act</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map(row => (
                                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-2 px-3 py-1.5">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.has(row.id)}
                                                onChange={() => handleSelectOne(row.id)}
                                                className="rounded border-slate-300 text-indigo-500" 
                                            />
                                        </td>
                                        <td className="p-2 px-3 py-1.5">
                                            <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1 max-w-[200px] text-xs" title={row.product_name}>{row.product_name}</div>
                                            <div className="flex gap-2 items-center mt-0.5">
                                                <span className="text-[9px] text-slate-400 font-mono">{row.web_pid}</span>
                                                {row.is_competitor && <span className="text-[8px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 font-bold px-1 rounded-sm uppercase tracking-wider">Competitor</span>}
                                            </div>
                                        </td>
                                        <td className="p-2 px-3 py-1.5">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-[10px]">{row.brand || '-'}</span>
                                        </td>
                                        <td className="p-2 px-3 py-1.5">
                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                {row.platform}
                                            </span>
                                        </td>
                                        <td className="p-2 px-3 py-1.5 text-center font-bold text-base dark:text-white">
                                            {row.rating}<span className="text-xs text-yellow-500 ml-0.5">⭐</span>
                                        </td>
                                        <td className="p-2 px-3 py-1.5 text-center">
                                            {row.ml_inferred_rating ? (
                                                <div className={`font-bold text-base ${Number(row.ml_inferred_rating) >= 4 ? 'text-emerald-600 dark:text-emerald-400' : Number(row.ml_inferred_rating) >= 2.5 ? 'text-amber-600 dark:text-amber-500' : 'text-rose-500'}`}>
                                                    {Number(row.ml_inferred_rating).toFixed(1)}<span className="text-xs ml-0.5" style={{ color: "inherit" }}>⭐</span>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-slate-400" title={`Confidence: ${row.quality_score || 0}`}>-</span>
                                            )}
                                        </td>
                                        <td className="p-2 px-3 py-1.5 text-[10px] text-slate-600 dark:text-slate-400 max-w-sm">
                                            {row.review_title && <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5 truncate">{row.review_title}</div>}
                                            <div className="line-clamp-2 leading-relaxed" title={row.review_text || ''}>{row.review_text || '<No Text>'}</div>
                                        </td>
                                        <td className="p-2 px-3 py-1.5">
                                            {row.category ? (
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.category}</span>
                                            ) : (
                                                <span className="text-[8px] uppercase font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded dark:bg-rose-900/20">Empty</span>
                                            )}
                                        </td>
                                        <td className="p-2 px-3 py-1.5">
                                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-sm
                                                ${row.sentiment === 'Positive' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-900/20' : ''}
                                                ${row.sentiment === 'Negative' ? 'text-rose-700 bg-rose-50 border border-rose-200 dark:border-rose-800/50 dark:bg-rose-900/20' : ''}
                                                ${row.sentiment === 'Neutral' ? 'text-slate-600 bg-slate-100 border border-slate-200 dark:border-slate-700 dark:bg-slate-800' : ''}
                                                ${!row.sentiment ? 'text-rose-500 bg-rose-50 border border-rose-200 dark:border-rose-900/20' : ''}
                                            `}>
                                                {row.sentiment || 'Empty'}
                                            </span>
                                            <div className="text-[9px] font-medium text-slate-500 mt-1 truncate max-w-[120px]">{row.specific_issue}</div>
                                        </td>
                                        <td className="p-2 px-3 py-1.5">
                                            <div className="flex flex-col gap-0.5 text-[9px] font-mono">
                                                {row.material && <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">M: {row.material}</span>}
                                                {row.wattage && <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">W: {row.wattage}</span>}
                                                {!row.material && !row.wattage && <span className="text-slate-400 italic">-</span>}
                                            </div>
                                        </td>
                                        <td className="p-2 px-3 py-1.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setEditingRow(row)} className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Edit row">
                                                    <Edit2 size={12} />
                                                </button>
                                                <button onClick={() => handleSingleRowAi(row.id)} className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors" title="Audit this row using Gemini API">
                                                    <Sparkles size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400">No data found in current view.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center z-10 flex-shrink-0">
                <span className="text-sm font-medium text-slate-500">
                    Total: {total.toLocaleString()} records
                </span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-50 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">Page {page + 1}</span>
                    <button 
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * limit >= total}
                        className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-50 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Edit Modal Overlay */}
            {editingRow && (
                <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <form onSubmit={handleEditSave} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg dark:text-white">Edit Raw Data</h3>
                            <button type="button" onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                                <input 
                                    type="text" 
                                    value={editingRow.category || ''} 
                                    onChange={e => setEditingRow({...editingRow, category: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Sentiment (Positive, Negative, Neutral)</label>
                                <select 
                                    value={editingRow.sentiment || ''} 
                                    onChange={e => setEditingRow({...editingRow, sentiment: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- None --</option>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Neutral">Neutral</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Specific Issue</label>
                                <input 
                                    type="text" 
                                    value={editingRow.specific_issue || ''} 
                                    onChange={e => setEditingRow({...editingRow, specific_issue: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Material</label>
                                    <input 
                                        type="text" 
                                        value={editingRow.material || ''} 
                                        onChange={e => setEditingRow({...editingRow, material: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Wattage</label>
                                    <input 
                                        type="text" 
                                        value={editingRow.wattage || ''} 
                                        onChange={e => setEditingRow({...editingRow, wattage: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-2xl">
                            <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
                                Cancel
                            </button>
                            <button type="submit" disabled={isActioning} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                                {isActioning ? <Loader2 size={16} className="animate-spin" /> : 'Save Matrix'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default RawDataLake;
