import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Download, Package, Bot, ChevronLeft, ChevronRight, TrendingUp, MessageSquare } from 'lucide-react';
import { resolveCompanyId } from '../../utils/tenant';
import { authenticatedFetch, buildAuthHeaders } from '../../utils/auth';
import { RatingSummaryInline } from '../ui/RatingSummary';
import { createRatingMetrics } from '../../utils/ratingMetrics';
import { RatingTrendModal } from './RatingTrendModal';
import { ReviewTimelineModal } from './ReviewTimelineModal';
import { RATINGS_API_BASE } from '../../config/apiBase';

interface ProductRow extends Record<string, unknown> {
    id: string;
    product_name: string;
    description?: string;
    asin: string;
    sku_code: string;
    category: string;
    master_category: string;
    material: string;
    wattage: string;
    capacity?: string;
    litre: string;
    product_external_id: string;
    platform: string;
    brand_name: string;
    pareto_status: string;
    rating: number;
    rating_count?: number;
    review_count: number;
    user_rating?: number | null;
    ml_rating?: number | null;
    price_rp: number;
    price_sp: number;
}

interface SkuMasterTableProps {
    filters?: {
        platform?: string;
        pareto_status?: string;
        category?: string;
        material?: string;
        price_mode?: 'rp' | 'sp';
        price_min?: number;
        price_max?: number;
    };
    /** Initial search box value — used for ?web_pid=… deep links from alert emails. */
    initialSearch?: string;
}

const SkuMasterTable: React.FC<SkuMasterTableProps> = ({ filters, initialSearch }) => {
    const [searchTerm, setSearchTerm] = useState(initialSearch || '');
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const limit = 50;

    const [isAiLoading, setIsAiLoading] = useState<string | null>(null);
    const [trendFor, setTrendFor] = useState<ProductRow | null>(null);
    const [timelineFor, setTimelineFor] = useState<ProductRow | null>(null);
    const [savingParetoId, setSavingParetoId] = useState<string | null>(null);

    const backendUrl = RATINGS_API_BASE;
    const companyId = resolveCompanyId();

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                company_id: companyId,
                limit: String(limit),
                offset: String(page * limit),
            });
            if (searchTerm) query.set('searchQuery', searchTerm);
            if (filters?.platform) query.set('platform', filters.platform);
            if (filters?.pareto_status) query.set('pareto_status', filters.pareto_status);
            if (filters?.category) query.set('category', filters.category);
            if (filters?.material) query.set('material', filters.material);
            if (filters?.price_mode) query.set('price_mode', filters.price_mode);
            if (filters?.price_min !== undefined) query.set('price_min', String(filters.price_min));
            if (filters?.price_max !== undefined) query.set('price_max', String(filters.price_max));

            const res = await authenticatedFetch(`${backendUrl}/api/ratings/products?${query.toString()}`, {}, companyId);
            if (res.ok) {
                const json = await res.json();
                setProducts(json.data || []);
                setTotal(json.total || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [companyId, limit, page, searchTerm, backendUrl, filters?.platform, filters?.pareto_status, filters?.category, filters?.material, filters?.price_mode, filters?.price_min, filters?.price_max]);

    // Reset to first page when filters change
    useEffect(() => {
        setPage(0);
    }, [searchTerm, filters?.platform, filters?.category, filters?.material, filters?.pareto_status, filters?.price_min, filters?.price_max, filters?.price_mode]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleAiInspect = async (product: ProductRow) => {
        if (!window.confirm(`Preview master classification for "${product.product_name}" using Google AI? This will not write to production master data.`)) return;
        setIsAiLoading(product.id);
        try {
            const res = await authenticatedFetch(`${backendUrl}/api/ml-audit/product-inspect`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({
                    id: product.id,
                    product_name: product.product_name,
                    brand_name: product.brand_name,
                    description: product.description,
                    asin: product.asin || product.product_external_id,
                    sku: product.sku_code
                })
            }, companyId);
            const data = await res.json();
            if (res.ok && data.success) {
                // Update local state smoothly
                setProducts(prev => prev.map(p => {
                    if (p.id === product.id) {
                        return { 
                            ...p, 
                            category: data.ai_extraction.category || p.category,
                            material: data.ai_extraction.material || p.material,
                            wattage: data.ai_extraction.wattage || p.wattage,
                            capacity: data.ai_extraction.capacity || p.capacity
                        };
                    }
                    return p;
                }));
            } else {
                alert('AI extraction failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAiLoading(null);
        }
    };

    const handleParetoChange = async (product: ProductRow, next: 'Pareto' | 'Non-Pareto' | 'NPD') => {
        const prev = product.pareto_status;
        setProducts(p => p.map(r => r.id === product.id ? { ...r, pareto_status: next } : r));
        setSavingParetoId(product.id);
        try {
            const res = await authenticatedFetch(`${backendUrl}/api/ratings/products/${product.id}/pareto-status`, {
                method: 'PATCH',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ pareto_status: next }),
            }, companyId);
            if (!res.ok) {
                setProducts(p => p.map(r => r.id === product.id ? { ...r, pareto_status: prev } : r));
                const data = await res.json().catch(() => ({}));
                alert('Failed to update: ' + (data.error || res.statusText));
            }
        } catch (e) {
            setProducts(p => p.map(r => r.id === product.id ? { ...r, pareto_status: prev } : r));
            console.error(e);
        } finally {
            setSavingParetoId(null);
        }
    };

    const handleExport = () => {
        if (products.length === 0) return;
        const headers = ['Platform ID', 'Product', 'Platform', 'Category', 'Spec', 'MRP', 'Selling Price', 'Classification', 'PDP Rating', 'User Rating', 'ML Rating', 'Review Count', 'Rating Count'];
        const rows = [headers.join(',')];
        
        products.forEach(p => {
            const row = [
                p.asin || p.product_external_id || '',
                `"${(p.product_name || '').replace(/"/g, '""')}"`,
                p.platform || '',
                p.category || '',
                p.material || p.wattage || '',
                p.price_rp || '',
                p.price_sp || '',
                p.pareto_status || '',
                p.rating || '',
                p.user_rating || '',
                p.ml_rating || '',
                p.review_count || '',
                p.rating_count || '',
            ];
            rows.push(row.join(','));
        });

        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `sku_master_export.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4 flex-shrink-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="flex-1 max-w-md relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search server..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white"
                    />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleExport} className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                        <Download size={16} /> Export View
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                {loading && products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
                        <p>Loading Paginated Products...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Package size={48} className="mb-4 opacity-50" />
                        <p>No products found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[1000px] text-sm table-auto">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 whitespace-nowrap">
                            <tr>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Platform ID</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 max-w-[250px]">Product Name</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Platform</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Category</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Spec</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">MRP</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Selling Price</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Classification</th>
                                <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Ratings</th>
                                <th className="px-4 py-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-700 text-center">AI Preview</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {products.map((p: ProductRow) => (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-1.5 text-xs font-medium text-slate-900 dark:text-white">
                                        {String(p.asin || p.product_external_id || '-')}
                                    </td>
                                    <td className="px-4 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 max-w-[250px]">
                                        <div className="line-clamp-2 font-medium" title={String(p.product_name)}>
                                            {String(p.product_name || '-')}
                                        </div>
                                        {Boolean(p.description) && p.description !== p.product_name ? (
                                            <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider font-semibold" title="Internal SKU Code (MySQL)">
                                                SKU: {String(p.description)}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-1.5 text-xs whitespace-nowrap">
                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 font-semibold">
                                            {String(p.platform || '-')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{String(p.category || '-')}</div>
                                    </td>
                                    <td className="px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        {p.material || p.wattage ? (
                                            <div className="flex gap-1 items-center flex-wrap">
                                                {p.material ? <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{String(p.material)}</span> : null}
                                                {p.wattage ? <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded">{String(p.wattage)}</span> : null}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        {p.price_rp ? `₹${Number(p.price_rp).toLocaleString('en-IN')}` : '-'}
                                    </td>
                                    <td className="px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        {p.price_sp ? `₹${Number(p.price_sp).toLocaleString('en-IN')}` : '-'}
                                    </td>
                                    <td className="px-4 py-1.5 text-xs">
                                        <select
                                            value={p.pareto_status || 'Non-Pareto'}
                                            onChange={e => handleParetoChange(p, e.target.value as 'Pareto' | 'Non-Pareto' | 'NPD')}
                                            disabled={savingParetoId === p.id}
                                            title="Set product classification"
                                            className={`px-2 py-0.5 rounded-md font-medium text-[9px] uppercase tracking-wider border cursor-pointer disabled:opacity-50
                                                ${p.pareto_status === 'Pareto' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-300' :
                                                  p.pareto_status === 'NPD' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border-purple-300' :
                                                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300'}`}
                                        >
                                            <option value="Pareto">Pareto</option>
                                            <option value="Non-Pareto">Non-Pareto</option>
                                            <option value="NPD">NPD</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-1.5 min-w-[180px]">
                                        <RatingSummaryInline
                                            metrics={createRatingMetrics({
                                                pdp_rating: p.rating ? Number(p.rating) : null,
                                                user_rating: p.user_rating ? Number(p.user_rating) : null,
                                                ml_rating: p.ml_rating ? Number(p.ml_rating) : null,
                                                review_count: p.review_count ? Number(p.review_count) : 0,
                                                rating_count: p.rating_count ? Number(p.rating_count) : 0,
                                            })}
                                            title={String(p.product_name || 'SKU metrics')}
                                            compact={true}
                                        />
                                    </td>
                                    <td className="px-4 py-1.5 text-center">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                onClick={() => setTrendFor(p)}
                                                className="p-1 text-emerald-500 hover:text-white hover:bg-emerald-500 rounded transition-colors"
                                                title="Rating trend over time"
                                            >
                                                <TrendingUp size={14} />
                                            </button>
                                            <button
                                                onClick={() => setTimelineFor(p)}
                                                className="p-1 text-sky-500 hover:text-white hover:bg-sky-500 rounded transition-colors"
                                                title="Review timeline"
                                            >
                                                <MessageSquare size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleAiInspect(p)}
                                                disabled={isAiLoading === p.id}
                                                className="p-1 text-indigo-500 hover:text-white hover:bg-indigo-500 rounded disabled:opacity-50 transition-colors"
                                                title="Extract Category & Specifics using AI"
                                            >
                                                {isAiLoading === p.id ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {trendFor && (
                <RatingTrendModal
                    webPid={trendFor.product_external_id || trendFor.asin}
                    productName={trendFor.product_name}
                    platform={trendFor.platform}
                    onClose={() => setTrendFor(null)}
                />
            )}
            {timelineFor && (
                <ReviewTimelineModal
                    webPid={timelineFor.product_external_id || timelineFor.asin}
                    productName={timelineFor.product_name}
                    platform={timelineFor.platform}
                    onClose={() => setTimelineFor(null)}
                />
            )}
            
            {/* Pagination Footer */}
            <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900 flex justify-between items-center text-xs flex-shrink-0 z-10">
                <span className="font-medium text-slate-500">Total Catalog: {total.toLocaleString()}</span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-800 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-700 dark:text-slate-300 text-sm">Page {page + 1}</span>
                    <button 
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * limit >= total}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-800 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SkuMasterTable;
