import React, { useMemo, useState, useEffect, useContext } from "react";
import { Typography, Skeleton } from "@mui/material"; // Added Skeleton
import { SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";
import axiosInstance from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";

const formatNumber = (v) => {
    if (v === undefined || v === null) return "—"; // Handle null/undefined explicitly
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 100) return v.toFixed(0);
    return v.toFixed(2);
};

// ---------------------------------------------------------------------------
// Error State Component - Shows when API fails with refresh button
// ---------------------------------------------------------------------------
const ErrorWithRefresh = ({ segmentName, errorMessage, onRetry, isRetrying = false }) => {
    return (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load {segmentName}</h3>
                <p className="text-sm text-slate-500 mb-4">{errorMessage || "An error occurred while fetching data"}</p>
            </div>
            <button
                onClick={onRetry}
                disabled={isRetrying}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
          ${isRetrying
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-600 text-white hover:bg-slate-700 shadow-md hover:shadow-lg'
                    }`}
            >
                {isRetrying ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-500"></div>
                        <span>Retrying...</span>
                    </>
                ) : (
                    <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default function InventoryDrill() {
    const [filters, setFilters] = useState({
        format: [], // Changed to array
        brand: [],  // Changed to array
        sku: "",
        citySearch: "",
        citySelection: [],
        platform: [] // Added platform local filter
    });
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(0);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [viewMode, setViewMode] = useState("Platform");


    const [matrixData, setMatrixData] = useState([]);
    const [metadata, setMetadata] = useState({ platforms: [], brands: [], categories: [], skus: [], cities: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    // Access global filters from context
    const {
        timeStart,
        timeEnd,
        platform: globalPlatform,
        selectedBrand: globalBrand,
        selectedLocation: globalLocation,
        refreshFilters
    } = useContext(FilterContext);

    // Fetch function (extracted for reuse)
    const fetchMatrixData = async () => {
        try {
            setIsLoading(true);
            setApiError(null);

            const startDate = timeStart?.format?.('YYYY-MM-DD') || timeStart;
            const endDate = timeEnd?.format?.('YYYY-MM-DD') || timeEnd;

            // Robust filter construction
            const getFilterValue = (local, global) => {
                if (local && local.length > 0) return local.join(',');
                if (global) {
                    return Array.isArray(global) ? global.join(',') : global;
                }
                return 'All';
            };

            const params = {
                startDate,
                endDate,
                platform: getFilterValue(filters.platform, globalPlatform),
                brand: getFilterValue(filters.brand, globalBrand),
                location: getFilterValue(filters.citySelection, globalLocation),
                category: getFilterValue(filters.format, null) // formats/categories are local here
            };

            const response = await axiosInstance.get(`/inventory-analysis/matrix`, { params });
            setMatrixData(response.data.data);
            setMetadata(response.data.metadata);
        } catch (error) {
            console.error("❌ [InventoryMatrix] Failed to fetch matrix data:", error);
            setApiError(error.message || 'Failed to load inventory data');
        } finally {
            setIsLoading(false);
        }
    };

    // Retry function
    const retryFetch = () => {
        if (refreshFilters) {
            refreshFilters();
        }
        fetchMatrixData();
    };

    // Initial load & Filter change effect
    useEffect(() => {
        fetchMatrixData();
    }, [filters, timeStart, timeEnd, globalPlatform, globalBrand, globalLocation]);

    // Process backend data
    const allPlatforms = useMemo(() => {
        const platforms = [...new Set(matrixData.map((r) => r.platform))].filter(Boolean).sort();
        return platforms;
    }, [matrixData]);

    const allCities = useMemo(() => {
        const cities = [...new Set(matrixData.map((r) => r.city))].filter(Boolean).sort();
        return cities;
    }, [matrixData]);

    const allBrands = useMemo(() => {
        const brands = [...new Set(matrixData.map((r) => r.brand))].filter(Boolean).sort();
        return brands;
    }, [matrixData]);

    const allSkus = useMemo(() => {
        const skus = [...new Set(matrixData.map((r) => r.sku))].filter(Boolean).sort();
        return skus;
    }, [matrixData]);

    const allCategories = useMemo(() => {
        const cats = [...new Set(matrixData.map((r) => r.category || r.format))].filter(Boolean).sort();
        return cats;
    }, [matrixData]);

    const filteredRecords = useMemo(() => {
        return matrixData.filter((r) => {
            if (filters.sku && r.sku !== filters.sku) return false;
            // Additional client-side filtering if needed
            return true;
        });
    }, [matrixData, filters]);

    const cityColumns = useMemo(() => {
        if (filters.citySelection.length) return filters.citySelection;
        if (filters.citySearch.trim()) {
            return allCities.filter((c) =>
                c.toLowerCase().includes(filters.citySearch.toLowerCase())
            );
        }
        return allCities;
    }, [allCities, filters.citySearch, filters.citySelection]);

    const rows = useMemo(() => {
        const bySku = new Map();
        filteredRecords.forEach((r) => {
            if (!bySku.has(r.sku)) {
                bySku.set(r.sku, {
                    sku: r.sku,
                    // format: r.format, // Backend might need to return this if used
                    brand: r.brand,
                    inventoryByCity: {},
                });
            }
            bySku.get(r.sku).inventoryByCity[r.city] = r.inventory;
        });
        return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    }, [filteredRecords]);

    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

    /* Filter panel wiring */
    /* Filter panel wiring */
    const platformOptions = (metadata.platforms || []).map((p) => ({ id: p, label: p }));
    const formatOptions = (metadata.categories || []).map((f) => ({ id: f, label: f }));
    const skuOptions = (metadata.skus || []).map((s) => ({ id: s, label: s }));
    const cityOptions = (metadata.cities || []).map((c) => ({ id: c, label: c }));
    const brandOptions = (metadata.brands || []).map((b) => ({ id: b, label: b }));
    const kpiFields = [{ id: "inventory", label: "Inventory Quantity", type: "number" }];

    const handleFormatChange = (ids) => setFilters((prev) => ({ ...prev, format: ids }));
    const handleSkuChange = (ids) => setFilters((prev) => ({ ...prev, sku: ids[0] || "" }));
    const handleCityChange = (ids) => setFilters((prev) => ({ ...prev, citySelection: ids }));
    const handleBrandChange = (ids) => setFilters((prev) => ({ ...prev, brand: ids }));
    const handlePlatformChange = (ids) => setFilters((prev) => ({ ...prev, platform: ids }));

    const sectionConfig = [
        { id: "platforms", label: "Platforms" },
        { id: "brands", label: "Brands" },
        { id: "categories", label: "Categories" },
        { id: "skus", label: "SKUs" },
        { id: "cities", label: "Cities" },
    ];

    const sectionValues = useMemo(() => ({
        platforms: filters.platform,
        brands: filters.brand,
        categories: filters.format,
        skus: filters.sku ? [filters.sku] : [],
        cities: filters.citySelection
    }), [filters]);

    const filterOptions = useMemo(() => ({
        platforms: platformOptions,
        brands: brandOptions,
        categories: formatOptions,
        skus: skuOptions,
        cities: cityOptions,
        kpiFields: kpiFields
    }), [platformOptions, brandOptions, formatOptions, skuOptions, cityOptions]);

    return (
        <div className="flex h-full w-full flex-col px-4 py-4 text-slate-900 relative">
            {/* ------------------ KPI FILTER MODAL ------------------ */}
            {filterPanelOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-52 pl-40 transition-all backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Advanced Filters</Typography>
                                <Typography variant="caption" color="text.secondary">Configure data visibility and rules</Typography>
                            </div>
                            <button
                                onClick={() => setFilterPanelOpen(false)}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-6 pb-6">
                            <KpiFilterPanel
                                platforms={filterOptions.platforms}
                                brands={filterOptions.brands}
                                categories={filterOptions.categories}
                                skus={filterOptions.skus}
                                cities={filterOptions.cities}
                                kpiFields={filterOptions.kpiFields}
                                sectionConfig={sectionConfig}
                                sectionValues={sectionValues}
                                onPlatformChange={handlePlatformChange}
                                onBrandChange={handleBrandChange}
                                onCategoryChange={handleFormatChange}
                                onSkuChange={handleSkuChange}
                                onCityChange={handleCityChange}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                            <button
                                onClick={() => setFilterPanelOpen(false)}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setFilterPanelOpen(false)}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">

                {/* HEADER */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex flex-col items-start gap-1">
                        <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Inventory Matrix</Typography>
                        <Typography variant="h5" fontWeight={600}>Inventory Overview</Typography>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Filters Button */}
                        <button
                            onClick={() => setFilterPanelOpen(true)}
                            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                        >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Filters</span>
                        </button>

                        {/* <div className="flex rounded-lg bg-slate-100 p-1">
                            {["Platform", "Format", "City"].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${viewMode === mode
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div> */}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="sticky left-0 z-30 bg-slate-50 px-2 py-2 text-left w-[300px] uppercase text-[10px] font-bold tracking-wider text-slate-500 border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    SKU
                                </th>
                                {cityColumns.map((city, i) => (
                                    <th key={city} className="px-2 py-2 text-center font-bold uppercase text-[10px] tracking-wider text-slate-500 border-b border-slate-200 min-w-[80px]">
                                        {city}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                // Skeleton Loading
                                Array.from({ length: 15 }).map((_, idx) => ( // Increased skeleton count for density
                                    <tr key={`skel-${idx}`} className="border-b border-slate-50">
                                        <td className="sticky left-0 bg-white px-2 py-1.5"> {/* Compact padding */}
                                            <Skeleton variant="text" width={180} height={20} />
                                        </td>
                                        {cityColumns.map((city) => (
                                            <td key={city} className="px-2 py-1.5 text-center">
                                                <Skeleton variant="text" width={30} height={20} className="mx-auto" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : apiError ? (
                                <tr>
                                    <td colSpan={cityColumns.length + 1} className="px-6 py-6">
                                        <ErrorWithRefresh
                                            segmentName="Inventory Matrix"
                                            errorMessage={apiError}
                                            onRetry={retryFetch}
                                        />
                                    </td>
                                </tr>
                            ) : pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={cityColumns.length + 1} className="px-6 py-10 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>No data found for the selected filters.</Typography>
                                            <Typography variant="caption">Try adjusting your date range or filter selections.</Typography>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((row) => (
                                    <tr key={row.sku} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                        <td
                                            className="sticky left-0 z-20 bg-white px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap max-w-[300px] truncate border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                                            title={row.sku} // Tooltip for full name
                                        >
                                            {row.sku}
                                        </td>
                                        {cityColumns.map((city) => (
                                            <td key={city} className="px-2 py-1.5 text-center whitespace-nowrap text-slate-600">
                                                {formatNumber(row.inventoryByCity[city] || 0)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span className="text-xs font-medium text-slate-600">
                            Page {page + 1} / {totalPages}
                        </span>
                        <button
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Rows/page</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(0);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 focus:border-blue-500 focus:outline-none"
                        >
                            {[10, 20, 50, 100].map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

            </div>
        </div>
    );
}
