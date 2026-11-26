/**
 * CompetitorMappingTable — Industry-standard flat data grid
 * One row per mapping pair (Our SKU ↔ Competitor SKU)
 * Full CRUD + CSV export + match type dropdown + search + pagination
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, Trash2, Edit2, Save, X, Download, Filter,
    Loader2, ChevronLeft, ChevronRight, AlertCircle, Check
} from 'lucide-react';
import { fetchAPI } from '../../hooks/useRatingsAPI';

// ============================================================================
// TYPES
// ============================================================================
interface MappingPair {
    id: string;
    our_sku: string;
    our_product_name: string;
    our_category: string;
    our_material: string;
    our_wattage: string;
    our_platform: string;
    comp_brand: string;
    comp_sku: string;
    comp_product_name: string;
    comp_category: string;
    comp_material: string;
    comp_wattage: string;
    comp_platform: string;
    match_type: string;
    is_active: boolean;
    notes: string;
}

interface MatchType {
    code: string;
    label: string;
    color: string;
    sort_order: number;
}

type EditablePair = Partial<MappingPair> & { _isNew?: boolean };

// ============================================================================
// MATCH TYPE BADGE
// ============================================================================
const MatchTypeBadge: React.FC<{ code: string; types: MatchType[] }> = ({ code, types }) => {
    const mt = types.find(t => t.code === code);
    return (
        <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{
                backgroundColor: `${mt?.color || '#6366f1'}20`,
                color: mt?.color || '#6366f1',
                border: `1px solid ${mt?.color || '#6366f1'}40`
            }}
        >
            {mt?.label || code}
        </span>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const CompetitorMappingTable: React.FC = () => {
    // Data state
    const [pairs, setPairs] = useState<MappingPair[]>([]);
    const [matchTypes, setMatchTypes] = useState<MatchType[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterBrand, setFilterBrand] = useState('');
    const [filterType, setFilterType] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<EditablePair>({});
    const [saving, setSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Filter options from database
    const [categories, setCategories] = useState<string[]>([]);
    const [brands, setBrands] = useState<string[]>([]);

    // ============================================================================
    // DATA LOADING
    // ============================================================================
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string> = { page: String(page), limit: String(pageSize) };
            if (searchTerm) params.search = searchTerm;
            if (filterCategory) params.category = filterCategory;
            if (filterBrand) params.brand = filterBrand;
            if (filterType) params.match_type = filterType;

            const data = await fetchAPI<{ pairs: MappingPair[]; total: number }>('/competitor-mapping-pairs', params);
            setPairs(data.pairs || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, filterCategory, filterBrand, filterType]);

    const loadMatchTypes = useCallback(async () => {
        try {
            const data = await fetchAPI<{ types: MatchType[] }>('/competitor-mapping-types');
            setMatchTypes(data.types || []);
        } catch { /* ignore — use defaults */ }
    }, []);

    const loadGlobalFilters = useCallback(async () => {
        try {
            const data = await fetchAPI<{ categories: string[], brands: string[] }>('/competitor-mapping-options');
            if (data.categories) setCategories(data.categories);
            if (data.brands) setBrands(data.brands);
        } catch (err) {
            console.error('Failed to load global filters:', err);
        }
    }, []);

    useEffect(() => { loadMatchTypes(); }, [loadMatchTypes]);
    useEffect(() => { loadGlobalFilters(); }, [loadGlobalFilters]);
    useEffect(() => { loadData(); }, [loadData]);

    // Debounced search
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // ============================================================================
    // CRUD HANDLERS
    // ============================================================================
    const handleAddNew = () => {
        setEditingId('__new__');
        setEditData({
            _isNew: true,
            our_sku: '', our_product_name: '', our_category: '', our_material: '', our_wattage: '', our_platform: 'amazon',
            comp_brand: '', comp_sku: '', comp_product_name: '', comp_category: '', comp_material: '', comp_wattage: '', comp_platform: 'amazon',
            match_type: 'PEER', notes: ''
        });
    };

    const handleEdit = (pair: MappingPair) => {
        setEditingId(pair.id);
        setEditData({ ...pair });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData({});
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editData._isNew) {
                const { _isNew, ...payload } = editData;
                void _isNew;
                await fetchAPI<{ pair: MappingPair }>('/competitor-mapping-pairs', undefined, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                const { _isNew, id, ...payload } = editData;
                void _isNew;
                await fetchAPI<{ pair: MappingPair }>(`/competitor-mapping-pairs/${id}`, undefined, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            setEditingId(null);
            setEditData({});
            loadData();
        } catch (err) {
            alert(`Save failed: ${(err as Error).message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetchAPI(`/competitor-mapping-pairs/${id}`, undefined, { method: 'DELETE' });
            setDeleteConfirmId(null);
            loadData();
        } catch (err) {
            alert(`Delete failed: ${(err as Error).message}`);
        }
    };

    const handleExport = () => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/ratings';
        window.open(`${baseUrl}/competitor-mapping-pairs/export`, '_blank');
    };

    // ============================================================================
    // INLINE EDIT CELL
    // ============================================================================
    const EditCell: React.FC<{ field: keyof EditablePair; placeholder?: string; className?: string }> = ({ field, placeholder, className = '' }) => (
        <input
            type="text"
            value={(editData[field] as string) || ''}
            onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
            placeholder={placeholder}
            className={`w-full text-xs px-2 py-1.5 rounded border border-indigo-300 dark:border-indigo-600 
                        bg-white dark:bg-slate-800 text-slate-900 dark:text-white 
                        focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${className}`}
        />
    );

    // ============================================================================
    // RENDER
    // ============================================================================
    const totalPages = Math.ceil(total / pageSize);

    const COLUMNS = [
        { key: 'our_sku', label: 'OUR SKU', width: 'w-20' },
        { key: 'our_product', label: 'OUR PRODUCT', width: 'w-40' },
        { key: 'category', label: 'CATEGORY', width: 'w-24' },
        { key: 'our_material', label: 'OUR MATERIAL', width: 'w-20' },
        { key: 'our_wattage', label: 'OUR W/CAP', width: 'w-16' },
        { key: 'comp_brand', label: 'COMP BRAND', width: 'w-24' },
        { key: 'comp_sku', label: 'COMP SKU', width: 'w-24' },
        { key: 'comp_product', label: 'COMP PRODUCT', width: 'w-40' },
        { key: 'comp_material', label: 'COMP MATERIAL', width: 'w-20' },
        { key: 'comp_wattage', label: 'COMP W/CAP', width: 'w-16' },
        { key: 'platform', label: 'PLATFORM', width: 'w-20' },
        { key: 'match_type', label: 'MATCH TYPE', width: 'w-28' },
    ];

    return (
        <div className="flex flex-col h-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {/* ── TOOLBAR ── */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Competitor Mapping</h3>
                        <p className="text-sm text-slate-500">
                            {total.toLocaleString()} mapping pairs • One row per SKU-to-SKU match
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg
                                       border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300
                                       hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                        <button
                            onClick={handleAddNew}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg
                                       bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus size={14} /> Add Mapping
                        </button>
                    </div>
                </div>

                {/* Filters row */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            placeholder="Search SKU, product, brand..."
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600
                                       bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <Filter size={14} />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                        className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        value={filterBrand}
                        onChange={e => { setFilterBrand(e.target.value); setPage(1); }}
                        className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                        <option value="">All Brands</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select
                        value={filterType}
                        onChange={e => { setFilterType(e.target.value); setPage(1); }}
                        className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                                   bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                        <option value="">All Types</option>
                        {matchTypes.map(mt => <option key={mt.code} value={mt.code}>{mt.label}</option>)}
                    </select>
                </div>
            </div>

            {/* ── TABLE ── */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4 text-indigo-500" size={32} />
                        <p>Loading competitor mappings...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-red-400">
                        <AlertCircle size={32} className="mb-2" />
                        <p className="text-sm">Failed to load: {error}</p>
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        {/* Sticky header */}
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {COLUMNS.map(col => (
                                    <th key={col.key}
                                        className={`text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 
                                                    uppercase tracking-wider px-2 py-2 ${col.width}`}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th className="w-20 text-center text-[10px] font-semibold text-slate-500 uppercase px-2 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* New row (if adding) */}
                            {editingId === '__new__' && (
                                <tr className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
                                    <td className="px-3 py-2"><EditCell field="our_sku" placeholder="SKU" /></td>
                                    <td className="px-3 py-2"><EditCell field="our_product_name" placeholder="Product name" /></td>
                                    <td className="px-3 py-2"><EditCell field="our_category" placeholder="Category" /></td>
                                    <td className="px-3 py-2"><EditCell field="our_material" placeholder="Material" /></td>
                                    <td className="px-3 py-2"><EditCell field="our_wattage" placeholder="W/Cap" /></td>
                                    <td className="px-3 py-2"><EditCell field="comp_brand" placeholder="Brand" /></td>
                                    <td className="px-3 py-2"><EditCell field="comp_sku" placeholder="SKU/ASIN" /></td>
                                    <td className="px-3 py-2"><EditCell field="comp_product_name" placeholder="Product name" /></td>
                                    <td className="px-3 py-2"><EditCell field="comp_material" placeholder="Material" /></td>
                                    <td className="px-3 py-2"><EditCell field="comp_wattage" placeholder="W/Cap" /></td>
                                    <td className="px-3 py-2">
                                        <select value={editData.comp_platform || 'amazon'}
                                            onChange={e => setEditData(p => ({ ...p, comp_platform: e.target.value }))}
                                            className="w-full text-xs px-2 py-1.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                            <option value="amazon">Amazon</option>
                                            <option value="flipkart">Flipkart</option>
                                        </select>
                                    </td>
                                    <td className="px-3 py-2">
                                        <select value={editData.match_type || 'PEER'}
                                            onChange={e => setEditData(p => ({ ...p, match_type: e.target.value }))}
                                            className="w-full text-xs px-2 py-1.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                            {matchTypes.map(mt => <option key={mt.code} value={mt.code}>{mt.label}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={handleSave} disabled={saving}
                                                className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors">
                                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                            </button>
                                            <button onClick={handleCancel}
                                                className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* Data rows */}
                            {pairs.map(pair => {
                                const isEditing = editingId === pair.id;
                                const isDeleting = deleteConfirmId === pair.id;

                                return (
                                    <tr key={pair.id}
                                        className={`border-b border-slate-100 dark:border-slate-800 transition-colors
                                                    ${isEditing ? 'bg-amber-50 dark:bg-amber-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                                    ${isDeleting ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                    >
                                        {isEditing ? (
                                            <>
                                                <td className="px-3 py-2"><EditCell field="our_sku" /></td>
                                                <td className="px-3 py-2"><EditCell field="our_product_name" /></td>
                                                <td className="px-3 py-2"><EditCell field="our_category" /></td>
                                                <td className="px-3 py-2"><EditCell field="our_material" /></td>
                                                <td className="px-3 py-2"><EditCell field="our_wattage" /></td>
                                                <td className="px-3 py-2"><EditCell field="comp_brand" /></td>
                                                <td className="px-3 py-2"><EditCell field="comp_sku" /></td>
                                                <td className="px-3 py-2"><EditCell field="comp_product_name" /></td>
                                                <td className="px-3 py-2"><EditCell field="comp_material" /></td>
                                                <td className="px-3 py-2"><EditCell field="comp_wattage" /></td>
                                                <td className="px-3 py-2">
                                                    <select value={editData.comp_platform || ''}
                                                        onChange={e => setEditData(p => ({ ...p, comp_platform: e.target.value }))}
                                                        className="w-full text-xs px-2 py-1.5 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800">
                                                        <option value="amazon">Amazon</option>
                                                        <option value="flipkart">Flipkart</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select value={editData.match_type || ''}
                                                        onChange={e => setEditData(p => ({ ...p, match_type: e.target.value }))}
                                                        className="w-full text-xs px-2 py-1.5 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800">
                                                        {matchTypes.map(mt => <option key={mt.code} value={mt.code}>{mt.label}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={handleSave} disabled={saving}
                                                            className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded">
                                                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        </button>
                                                        <button onClick={handleCancel}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-2 py-1 font-mono text-[9px] text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                    {pair.our_sku}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] text-slate-700 dark:text-slate-300 max-w-[150px] truncate" title={pair.our_product_name}>
                                                    {pair.our_product_name}
                                                </td>
                                                <td className="px-2 py-1">
                                                    <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                        {pair.our_category}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1 text-[9px] text-slate-500">{pair.our_material || '—'}</td>
                                                <td className="px-2 py-1 text-[9px] text-slate-500">{pair.our_wattage || '—'}</td>
                                                <td className="px-2 py-1 font-medium text-[10px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                    {pair.comp_brand}
                                                </td>
                                                <td className="px-2 py-1 font-mono text-[9px] text-orange-600 dark:text-orange-400 whitespace-nowrap">
                                                    {pair.comp_sku}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] text-slate-600 dark:text-slate-400 max-w-[150px] truncate" title={pair.comp_product_name}>
                                                    {pair.comp_product_name}
                                                </td>
                                                <td className="px-2 py-1 text-[9px] text-slate-500">{pair.comp_material || '—'}</td>
                                                <td className="px-2 py-1 text-[9px] text-slate-500">{pair.comp_wattage || '—'}</td>
                                                <td className="px-2 py-1 text-[9px] text-slate-500 capitalize">{pair.comp_platform}</td>
                                                <td className="px-2 py-1">
                                                    <MatchTypeBadge code={pair.match_type} types={matchTypes} />
                                                </td>
                                                <td className="px-2 py-1 text-center">
                                                    {isDeleting ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => handleDelete(pair.id)}
                                                                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                                                                Confirm
                                                            </button>
                                                            <button onClick={() => setDeleteConfirmId(null)}
                                                                className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 transition-colors">
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                             style={{ opacity: 1 }}>
                                                            <button onClick={() => handleEdit(pair)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors">
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button onClick={() => setDeleteConfirmId(pair.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}

                            {/* Empty state */}
                            {pairs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={COLUMNS.length + 1} className="py-16 text-center text-slate-400">
                                        <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No competitor mappings found</p>
                                        <p className="text-xs mt-1">Try adjusting your filters or add a new mapping</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── PAGINATION FOOTER ── */}
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                    Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} mappings
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                        className="p-1.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 
                                   hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Page {page} of {totalPages || 1}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                        className="p-1.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30
                                   hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompetitorMappingTable;
