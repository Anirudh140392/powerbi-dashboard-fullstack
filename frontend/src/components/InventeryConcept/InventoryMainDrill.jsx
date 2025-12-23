import React, { useMemo, useState } from "react";
import { Typography } from "@mui/material";
import { SlidersHorizontal, X } from "lucide-react";
import { KpiFilterPanel } from "../KpiFilterPanel";

/* ---------------- SAMPLE DATA ---------------- */

const SAMPLE = [
    { format: "Cornetto", brand: "Kwality Walls", product: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", city: "agra", doh: 0 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", city: "ahmedabad", doh: 0 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", city: "akola", doh: 25 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", city: "ambala", doh: 12 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", city: "amritsar", doh: 7 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", city: "aurangabad", doh: 8 },

    { format: "Cornetto", brand: "Kwality Walls", product: "85047 : KW CORNETTO - BUTTERSCOTCH", city: "agra", doh: 0 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85047 : KW CORNETTO - BUTTERSCOTCH", city: "ahmedabad", doh: 0 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85047 : KW CORNETTO - BUTTERSCOTCH", city: "akola", doh: 28 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85047 : KW CORNETTO - BUTTERSCOTCH", city: "ambala", doh: 18 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85047 : KW CORNETTO - BUTTERSCOTCH", city: "amritsar", doh: 8 },
    { format: "Cornetto", brand: "Kwality Walls", product: "85047 : KW CORNETTO - BUTTERSCOTCH", city: "aurangabad", doh: 9 },

    { format: "Core Tub", brand: "Kwality Walls", product: "85123 : KW Cassatta", city: "agra", doh: 0 },
    { format: "Core Tub", brand: "Kwality Walls", product: "85123 : KW Cassatta", city: "ahmedabad", doh: 0 },
    { format: "Core Tub", brand: "Kwality Walls", product: "85123 : KW Cassatta", city: "akola", doh: 11 },
    { format: "Core Tub", brand: "Kwality Walls", product: "85123 : KW Cassatta", city: "ambala", doh: 13 },
    { format: "Core Tub", brand: "Kwality Walls", product: "85123 : KW Cassatta", city: "amritsar", doh: 24 },
    { format: "Core Tub", brand: "Kwality Walls", product: "85123 : KW Cassatta", city: "aurangabad", doh: 38 },

    { format: "Magnum", brand: "Kwality Walls", product: "85339 : KW Magnum Almond 90 ml", city: "agra", doh: 0 },
    { format: "Magnum", brand: "Kwality Walls", product: "85339 : KW Magnum Almond 90 ml", city: "ahmedabad", doh: 0 },
    { format: "Magnum", brand: "Kwality Walls", product: "85339 : KW Magnum Almond 90 ml", city: "akola", doh: 50 },
    { format: "Magnum", brand: "Kwality Walls", product: "85339 : KW Magnum Almond 90 ml", city: "ambala", doh: 6 },
    { format: "Magnum", brand: "Kwality Walls", product: "85339 : KW Magnum Almond 90 ml", city: "amritsar", doh: 6 },
    { format: "Magnum", brand: "Kwality Walls", product: "85339 : KW Magnum Almond 90 ml", city: "aurangabad", doh: 14 },

    { format: "Sandwich", brand: "Kwality Walls", product: "85438 : KW Sandwich Chocolate n Vanilla 90ml", city: "agra", doh: 0 },
    { format: "Sandwich", brand: "Kwality Walls", product: "85438 : KW Sandwich Chocolate n Vanilla 90ml", city: "ahmedabad", doh: 0 },
    { format: "Sandwich", brand: "Kwality Walls", product: "85438 : KW Sandwich Chocolate n Vanilla 90ml", city: "akola", doh: 14 },
    { format: "Sandwich", brand: "Kwality Walls", product: "85438 : KW Sandwich Chocolate n Vanilla 90ml", city: "ambala", doh: 1 },
    { format: "Sandwich", brand: "Kwality Walls", product: "85438 : KW Sandwich Chocolate n Vanilla 90ml", city: "amritsar", doh: 9 },
    { format: "Sandwich", brand: "Kwality Walls", product: "85438 : KW Sandwich Chocolate n Vanilla 90ml", city: "aurangabad", doh: 5 },
];

const formatNumber = (v) => {
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 100) return v.toFixed(0);
    return v.toFixed(2);
};

export default function InventoryDrill() {
    const [filters, setFilters] = useState({
        format: "All",
        brand: "All",
        sku: "",
        citySearch: "",
        citySelection: [],
    });
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(0);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [viewMode, setViewMode] = useState("Platform");


    const formats = ["All", ...new Set(SAMPLE.map((r) => r.format))];
    const brands = ["All", ...new Set(SAMPLE.map((r) => r.brand))];
    const allCities = useMemo(() => [...new Set(SAMPLE.map((r) => r.city))], []);
    const allSkus = useMemo(() => [...new Set(SAMPLE.map((r) => r.product))], []);

    const filteredRecords = useMemo(() => {
        return SAMPLE.filter((r) => {
            if (filters.format !== "All" && r.format !== filters.format) return false;
            if (filters.brand !== "All" && r.brand !== filters.brand) return false;
            if (filters.sku && r.product !== filters.sku) return false;
            return true;
        });
    }, [filters]);

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
            if (!bySku.has(r.product)) {
                bySku.set(r.product, {
                    sku: r.product,
                    format: r.format,
                    brand: r.brand,
                    dohByCity: {},
                });
            }
            bySku.get(r.product).dohByCity[r.city] = r.doh;
        });
        return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    }, [filteredRecords]);

    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

    /* Filter panel wiring */
    const formatOptions = formats.slice(1).map((f) => ({ id: f, label: f }));
    const skuOptions = allSkus.map((s) => ({ id: s, label: s }));
    const cityOptions = allCities.map((c) => ({ id: c, label: c }));
    const brandOptions = brands.slice(1).map((b) => ({ id: b, label: b }));
    const kpiFields = [{ id: "doh", label: "Days on hand", type: "number" }];

    const handleFormatChange = (ids) => setFilters((prev) => ({ ...prev, format: ids[0] || "All" }));
    const handleSkuChange = (ids) => setFilters((prev) => ({ ...prev, sku: ids[0] || "" }));
    const handleCityChange = (ids) => setFilters((prev) => ({ ...prev, citySelection: ids }));
    const handleBrandChange = (ids) => setFilters((prev) => ({ ...prev, brand: ids[0] || "All" }));

    const filterOptions = useMemo(() => ({
        keywords: [],
        brands: brandOptions,
        categories: formatOptions, // Mapping Format to Categories
        skus: skuOptions,
        cities: cityOptions,
        platforms: [],
        kpiFields: kpiFields
    }), [brandOptions, formatOptions, skuOptions, cityOptions]);

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
                                keywords={filterOptions.keywords}
                                brands={filterOptions.brands}
                                categories={filterOptions.categories}
                                skus={filterOptions.skus}
                                cities={filterOptions.cities}
                                platforms={filterOptions.platforms}
                                kpiFields={filterOptions.kpiFields}
                                // onRulesChange={setFilterRules}
                                // Mock handlers
                                onKeywordChange={(ids) => console.log("Keywords:", ids)}
                                onBrandChange={(ids) => handleBrandChange(ids)}
                                onCategoryChange={(ids) => handleFormatChange(ids)}
                                onSkuChange={(ids) => handleSkuChange(ids)}
                                onCityChange={(ids) => handleCityChange(ids)}
                                onPlatformChange={(ids) => console.log("Platforms:", ids)}
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
                                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left w-[260px] uppercase">
                                    SKU
                                </th>
                                {cityColumns.map((city, i) => (
                                    <th key={city} className="px-3 py-2 text-center font-semibold uppercase capitalize">
                                        {city}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((row) => (
                                <tr key={row.sku} className="border-b">
                                    <td className="sticky left-0 bg-white px-3 py-2 font-medium">
                                        {row.sku}
                                    </td>
                                    {cityColumns.map((city) => (
                                        <td key={city} className="px-3 py-2 text-center">
                                            {formatNumber(row.dohByCity[city])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
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

                {filterPanelOpen && (
                    <div className="absolute right-4 top-12 z-20 w-[680px]">
                        <KpiFilterPanel
                            keywords={formatOptions}
                            skus={skuOptions}
                            cities={cityOptions}
                            platforms={brandOptions}
                            kpiFields={kpiFields}
                            onKeywordChange={handleFormatChange}
                            onSkuChange={handleSkuChange}
                            onCityChange={handleCityChange}
                            onPlatformChange={handleBrandChange}
                            pageSize={12}
                            keywordsLabel="Format"
                            keywordsTitle="Format filter"
                            keywordsDescription="Select formats to filter the table."
                            platformsLabel="Brand"
                            platformsTitle="Brand filter"
                            platformsDescription="Select brands to filter the table."
                            skusLabel="SKU"
                            skusTitle="SKU filter"
                            skusDescription="Select SKUs to filter the table."
                            citiesLabel="City"
                            citiesTitle="City filter"
                            citiesDescription="Select cities to show as columns."
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
