import React, { useMemo, useState } from "react";
import { Typography } from "@mui/material";
import { SlidersHorizontal, X } from "lucide-react";

import { KpiFilterPanel } from "../KpiFilterPanel";

/* ---------------- SAMPLE DATA ---------------- */

const SAMPLE = [

    { city: "ahmedabad", category: "Cone", brand: "Kwality Walls", sku: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", drrQty: 894, currentDoh: 10, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "ahmedabad", category: "Cone", brand: "Kwality Walls", sku: "85047 : KW CORNETTO - BUTTERSCOTCH", drrQty: 269, currentDoh: 11, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "ahmedabad", category: "Tub", brand: "Kwality Walls", sku: "85123 : KW Cassatta", drrQty: 71, currentDoh: 12, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "ahmedabad", category: "Bar", brand: "Kwality Walls", sku: "85339 : KW Magnum Almond 90 ml", drrQty: 140, currentDoh: 14, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "ahmedabad", category: "Bar", brand: "Kwality Walls", sku: "85350 : KW CDO- FRUIT & NUT", drrQty: 65, currentDoh: 18, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "ahmedabad", category: "Bar", brand: "Kwality Walls", sku: "85437 : COR DISC OREO 120ML", drrQty: 329, currentDoh: 13, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "pune", category: "Cone", brand: "Kwality Walls", sku: "85045 : KW CORNETTO - DOUBLE CHOCOLATE", drrQty: 120, currentDoh: 9, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "pune", category: "Bar", brand: "Kwality Walls", sku: "85339 : KW Magnum Almond 90 ml", drrQty: 80, currentDoh: 11, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

    { city: "pune", category: "Tub", brand: "Kwality Walls", sku: "85123 : KW Cassatta", drrQty: 55, currentDoh: 15, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 8 },

];

const kpiFields = [

    { id: "drrQty", label: "DRR Qty", type: "number" },

    { id: "currentDoh", label: "Current DOH", type: "number" },

    { id: "reqPoQty", label: "Req PO Qty", type: "number" },

    { id: "reqBoxes", label: "Req Boxes", type: "number" },

    { id: "thresholdDoh", label: "Threshold DOH", type: "number" },

];

const formatNumber = (v) => {

    if (!Number.isFinite(v)) return "—";

    if (Math.abs(v) >= 100) return v.toFixed(0);

    return v.toFixed(2);

};

export default function CitySkuInventoryDrill() {

    const [filterPanelOpen, setFilterPanelOpen] = useState(false);

    const [pageSize, setPageSize] = useState(20);

    const [page, setPage] = useState(0);

    const [viewMode, setViewMode] = useState("Platform");

    const [expanded, setExpanded] = useState(new Set());

    const [filters, setFilters] = useState({

        category: "All",

        brand: "All",

        city: "",

        sku: "",

    });

    const cityOptions = useMemo(

        () => [...new Set(SAMPLE.map((r) => r.city))].map((c) => ({ id: c, label: c })),

        []

    );

    const skuOptions = useMemo(

        () => [...new Set(SAMPLE.map((r) => r.sku))].map((s) => ({ id: s, label: s })),

        []

    );

    const brandOptions = useMemo(

        () => [...new Set(SAMPLE.map((r) => r.brand))].map((b) => ({ id: b, label: b })),

        []

    );

    const categoryOptions = useMemo(

        () => [...new Set(SAMPLE.map((r) => r.category))].map((c) => ({ id: c, label: c })),

        []

    );

    const filtered = useMemo(() => {

        return SAMPLE.filter((r) => {

            if (filters.category !== "All" && r.category !== filters.category) return false;

            if (filters.brand !== "All" && r.brand !== filters.brand) return false;

            if (filters.city && !r.city.toLowerCase().includes(filters.city.toLowerCase())) return false;

            if (filters.sku && r.sku !== filters.sku) return false;

            return true;

        });

    }, [filters]);

    const tree = useMemo(() => {

        const out = [];

        const byCity = new Map();

        filtered.forEach((r) => {

            if (!byCity.has(r.city)) byCity.set(r.city, []);

            byCity.get(r.city).push(r);

        });

        [...byCity.entries()].forEach(([city, rows]) => {

            const cityAgg = rows.reduce(

                (a, r) => ({

                    drrQty: a.drrQty + r.drrQty,

                    currentDoh: a.currentDoh + r.currentDoh,

                    reqPoQty: a.reqPoQty + r.reqPoQty,

                    reqBoxes: a.reqBoxes + r.reqBoxes,

                    thresholdDoh: a.thresholdDoh + r.thresholdDoh,

                }),

                { drrQty: 0, currentDoh: 0, reqPoQty: 0, reqBoxes: 0, thresholdDoh: 0 }

            );

            const cityId = `city-${city}`;

            out.push({ id: cityId, level: "city", city, metrics: cityAgg, hasChildren: true });

            if (expanded.has(cityId)) {

                rows.forEach((r, i) =>

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
        keywords: [],
        brands: brandOptions,
        categories: categoryOptions,
        skus: skuOptions,
        cities: cityOptions,
        platforms: [],
        kpiFields: kpiFields
    }), [brandOptions, categoryOptions, skuOptions, cityOptions]);

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
                                onBrandChange={(ids) => setFilters(prev => ({ ...prev, brand: ids[0] || "All" }))}
                                onCategoryChange={(ids) => setFilters(prev => ({ ...prev, category: ids[0] || "All" }))}
                                onSkuChange={(ids) => setFilters(prev => ({ ...prev, sku: ids[0] || "" }))}
                                onCityChange={(ids) => setFilters(prev => ({ ...prev, city: ids[0] || "" }))}
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
            <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">

                {/* HEADER */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex flex-col items-start gap-1">
                        <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Drill Table</Typography>
                        <Typography variant="h5" fontWeight={600}>City Level Inventory</Typography>
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

                {/* TABLE */}
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
                            {pageRows.map((row) => (
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
                                        <td className="sticky left-[220px] bg-white px-3 py-3 text-slate-600">
                                            {row.level === "sku" ? row.sku : ""}
                                        </td>
                                    )}
                                    <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.drrQty)}</td>
                                    <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.currentDoh)}</td>
                                    <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.reqPoQty)}</td>
                                    <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.reqBoxes)}</td>
                                    <td className="px-3 py-3 text-right font-medium">{formatNumber(row.metrics.thresholdDoh)}</td>
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
            </div>
        </div >
    );

}

