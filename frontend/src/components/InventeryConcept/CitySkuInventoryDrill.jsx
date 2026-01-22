import React, { useMemo, useState, useEffect, useContext } from "react";
import { Typography, Skeleton } from "@mui/material";
import { SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";
import axiosInstance from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";

const formatNumber = (v, decimals = null) => {
    if (v === undefined || v === null || isNaN(v)) return "—";
    const num = parseFloat(v);
    if (!Number.isFinite(num)) return "—";

    if (decimals !== null) return num.toFixed(decimals);
    if (Math.abs(num) >= 100) return Math.round(num).toString();
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export default function CitySkuInventoryDrill() {
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(0);
    const [expanded, setExpanded] = useState(new Set());
    const [matrixData, setMatrixData] = useState([]);
    const [metadata, setMetadata] = useState({ platforms: [], brands: [], categories: [], skus: [], cities: [] });
    const [isLoading, setIsLoading] = useState(false);

    const [filters, setFilters] = useState({
        category: [],
        brand: [],
        city: [],
        sku: [],
        platform: [],
        weekend: []
    });

    // Access global filters from context
    const {
        timeStart,
        timeEnd,
        platform: globalPlatform,
        selectedBrand: globalBrand,
        selectedLocation: globalLocation,
        datesInitialized
    } = useContext(FilterContext);

    // Fetch data from backend
    useEffect(() => {
        if (!datesInitialized) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);

                const startDate = timeStart?.format?.('YYYY-MM-DD') || timeStart;
                const endDate = timeEnd?.format?.('YYYY-MM-DD') || timeEnd;

                // Helper to get filter value (local override or global default)
                const getFilter = (local, global) => {
                    if (local && local.length > 0) return local.join(',');
                    if (global && global !== 'All') return Array.isArray(global) ? global.join(',') : global;
                    return 'All';
                };

                const params = {
                    startDate,
                    endDate,
                    platform: getFilter(filters.platform, globalPlatform),
                    brand: getFilter(filters.brand, globalBrand),
                    location: getFilter(filters.city, globalLocation),
                    category: filters.category.length > 0 ? filters.category.join(',') : 'All',
                    weekend: filters.weekend.length > 0 ? filters.weekend.join(',') : 'All'
                };

                const response = await axiosInstance.get(`/inventory-analysis/city-sku-matrix`, { params });
                setMatrixData(response.data.data);
                setMetadata(response.data.metadata);
            } catch (error) {
                console.error("Failed to fetch city-sku matrix:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [filters, timeStart, timeEnd, globalPlatform, globalBrand, globalLocation, datesInitialized]);

    const platformOptions = useMemo(() => {
        return (metadata.platforms || []).map(p => ({ id: p, label: p }));
    }, [metadata.platforms]);

    const brandOptions = useMemo(() => {
        return (metadata.brands || []).map(b => ({ id: b, label: b }));
    }, [metadata.brands]);

    const categoryOptions = useMemo(() => {
        return (metadata.categories || []).map(c => ({ id: c, label: c }));
    }, [metadata.categories]);

    const cityOptions = useMemo(() => {
        return (metadata.cities || []).map(c => ({ id: c, label: c }));
    }, [metadata.cities]);

    const skuOptions = useMemo(() => {
        return (metadata.skus || []).map(s => ({ id: s, label: s }));
    }, [metadata.skus]);

    const filtered = useMemo(() => {
        return matrixData.filter((r) => {
            if (filters.sku.length > 0 && !filters.sku.includes(r.sku)) return false;
            // Additional client-side filtering can be added here if needed,
            // but backend handles most per the getFilter logic.
            return true;
        });
    }, [matrixData, filters.sku]);

    const sectionValues = useMemo(() => ({
        brands: filters.brand,
        categories: filters.category,
        skus: filters.sku,
        cities: filters.city,
        platforms: filters.platform,
        weekendFlag: filters.weekend
    }), [filters]);

    const tree = useMemo(() => {
        const out = [];
        const byCity = new Map();

        filtered.forEach((r) => {
            if (!byCity.has(r.city)) byCity.set(r.city, []);
            byCity.get(r.city).push(r);
        });

        [...byCity.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([city, rows]) => {
            const cityAgg = rows.reduce(
                (a, r) => ({
                    drr_qty: a.drr_qty + (parseFloat(r.drr_qty) || 0),
                    current_inventory: a.current_inventory + (parseFloat(r.current_inventory) || 0),
                    req_po_qty: a.req_po_qty + (parseFloat(r.req_po_qty) || 0),
                    req_boxes: a.req_boxes + (parseFloat(r.req_boxes) || 0),
                    threshold_doh: r.threshold_doh || 8,
                }),
                { drr_qty: 0, current_inventory: 0, req_po_qty: 0, req_boxes: 0, threshold_doh: 8 }
            );

            // Calculate weighted average DOH for city
            cityAgg.current_doh = cityAgg.drr_qty > 0 ? cityAgg.current_inventory / cityAgg.drr_qty : 0;

            const cityId = `city-${city}`;
            out.push({ id: cityId, level: "city", city, metrics: cityAgg, hasChildren: true });

            if (expanded.has(cityId)) {
                rows.sort((a, b) => a.sku.localeCompare(b.sku)).forEach((r, i) =>
                    out.push({
                        id: `${cityId}-sku-${i}`,
                        level: "sku",
                        city,
                        sku: r.sku,
                        metrics: r,
                        hasChildren: false,
                    })
                );
            }
        });

        return out;
    }, [filtered, expanded]);


    const totalPages = Math.max(1, Math.ceil(tree.length / pageSize));
    const pageRows = tree.slice(page * pageSize, page * pageSize + pageSize);

    const toggle = (id) => {
        setExpanded((p) => {
            const n = new Set(p);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const filterOptions = useMemo(() => ({
        brands: brandOptions,
        categories: categoryOptions,
        skus: skuOptions,
        cities: cityOptions,
        platforms: platformOptions
    }), [brandOptions, categoryOptions, skuOptions, cityOptions, platformOptions]);

    return (
        <div className="flex h-full w-full flex-col px-4 py-4 text-slate-900 relative">
            {/* KPI FILTER MODAL */}
            {filterPanelOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-52 pl-40 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Advanced Filters</Typography>
                                <Typography variant="caption" color="text.secondary">Configure data visibility and rules</Typography>
                            </div>
                            <button onClick={() => setFilterPanelOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-6 pb-6">
                            <KpiFilterPanel
                                sectionConfig={[
                                    { id: "brands", label: "Brands" },
                                    { id: "categories", label: "Categories" },
                                    { id: "skus", label: "SKUs" },
                                    { id: "weekendFlag", label: "Weekend Flag" },
                                    { id: "cities", label: "Cities" },
                                    { id: "platforms", label: "Platforms" }
                                ]}
                                brands={filterOptions.brands}
                                categories={filterOptions.categories}
                                skus={filterOptions.skus}
                                cities={filterOptions.cities}
                                platforms={filterOptions.platforms}
                                sectionValues={sectionValues}
                                onBrandChange={(ids) => setFilters(prev => ({ ...prev, brand: ids }))}
                                onCategoryChange={(ids) => setFilters(prev => ({ ...prev, category: ids }))}
                                onSkuChange={(ids) => setFilters(prev => ({ ...prev, sku: ids }))}
                                onCityChange={(ids) => setFilters(prev => ({ ...prev, city: ids }))}
                                onPlatformChange={(ids) => setFilters(prev => ({ ...prev, platform: ids }))}
                                onWeekendChange={(ids) => setFilters(prev => ({ ...prev, weekend: ids }))}
                            />
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                            <button onClick={() => setFilterPanelOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                            <button onClick={() => setFilterPanelOpen(false)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200">Apply Filters</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex flex-col items-start gap-1">
                        <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Drill Table</Typography>
                        <Typography variant="h5" fontWeight={600}>City Level Inventory</Typography>
                    </div>
                    <div className="flex items-center gap-6">
                        <button onClick={() => setFilterPanelOpen(true)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Filters</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="sticky left-0 z-10 bg-slate-50 px-6 py-3 text-left w-[220px] uppercase">City / SKU</th>
                                {expanded.size > 0 && (
                                    <th className="sticky left-[220px] z-10 bg-slate-50 px-3 py-3 text-left w-[220px] uppercase">SKU</th>
                                )}
                                <th className="px-3 py-3 text-right uppercase">DRR Qty</th>
                                <th className="px-3 py-3 text-right uppercase">Current DOH</th>
                                <th className="px-3 py-3 text-right uppercase">Req PO Qty</th>
                                <th className="px-3 py-3 text-right uppercase">Req Boxes</th>
                                <th className="px-3 py-3 text-right uppercase">Threshold DOH</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, idx) => (
                                    <tr key={idx} className="border-b border-slate-50">
                                        <td className="px-6 py-3"><Skeleton variant="text" width={120} /></td>
                                        {expanded.size > 0 && <td><Skeleton variant="text" width={180} /></td>}
                                        <td className="px-3 py-3"><Skeleton variant="text" width={40} className="ml-auto" /></td>
                                        <td className="px-3 py-3"><Skeleton variant="text" width={40} className="ml-auto" /></td>
                                        <td className="px-3 py-3"><Skeleton variant="text" width={40} className="ml-auto" /></td>
                                        <td className="px-3 py-3"><Skeleton variant="text" width={40} className="ml-auto" /></td>
                                        <td className="px-3 py-3"><Skeleton variant="text" width={40} className="ml-auto" /></td>
                                    </tr>
                                ))
                            ) : pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={expanded.size > 0 ? 7 : 6} className="px-6 py-10 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>No data found for the selected filters.</Typography>
                                            <Typography variant="caption">Try adjusting your date range or filter selections.</Typography>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((row) => (
                                    <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                                        <td className="sticky left-0 bg-white px-6 py-3">
                                            {row.hasChildren && (
                                                <button onClick={() => toggle(row.id)} className="mr-2 text-slate-400 hover:text-slate-600">
                                                    {expanded.has(row.id) ? "−" : "+"}
                                                </button>
                                            )}
                                            <span className={row.level === "city" ? "font-semibold text-slate-900 capitalize" : "text-slate-600 capitalize"}>
                                                {row.level === "city" ? row.city : ""}
                                            </span>
                                        </td>
                                        {expanded.size > 0 && (
                                            <td className="sticky left-[220px] bg-white px-3 py-3 text-slate-600 truncate max-w-[220px]" title={row.sku}>
                                                {row.level === "sku" ? row.sku : ""}
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.drr_qty, 0)}</td>
                                        <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.current_doh, 2)}</td>
                                        <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.req_po_qty, 0)}</td>
                                        <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.req_boxes, 0)}</td>
                                        <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.threshold_doh, 2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Prev</button>
                        <span className="text-xs font-medium text-slate-600">Page {page + 1} / {totalPages}</span>
                        <button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}


