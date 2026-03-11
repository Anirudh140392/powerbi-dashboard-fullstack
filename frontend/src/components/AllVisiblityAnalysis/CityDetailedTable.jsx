import React, { useState, useEffect, useContext, useMemo } from "react";
import {
    X,
    ChevronLeft,
    ChevronRight,
    Loader2
} from "lucide-react";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { FilterContext } from "../../utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";

function getHeatmapClass(value) {
    // Basic heuristic: >100 or high % is good (green), low is bad (red)
    // Adjust logic based on the column type if needed
    if (typeof value === "string" && value.includes("%")) {
        const num = parseFloat(value);
        if (num >= 90) return "bg-emerald-50 text-emerald-700 font-semibold";
        if (num >= 80) return "bg-emerald-50/50 text-emerald-700";
        if (num >= 60) return "bg-amber-50 text-amber-700";
        return "bg-rose-50 text-rose-700 font-semibold";
    }
    // For Values (Offtake), just bold
    return "text-slate-700";
}

export default function CityDetailedTable({ sku, onClose }) {
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [allCities, setAllCities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const {
        platform,
        selectedCategory,
        selectedLocation,
        selectedBrand,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd
    } = useContext(FilterContext);

    // Normalize data fields
    const displaySkuName = sku.skuName || sku.keyword || "Unknown";
    const displaySkuCode = sku.skuCode || "Keyword";
    const displayPackSize = sku.packSize || "N/A";
    const displayPlatform = sku.platform || "N/A";

    useEffect(() => {
        let mounted = true;
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const webPidToUse = sku.Web_Pid || sku.webPid || sku.id;
                const params = {
                    webPid: webPidToUse,
                    signalType: sku.type || 'gainer',
                    startDate: timeStart?.format('YYYY-MM-DD'),
                    endDate: timeEnd?.format('YYYY-MM-DD'),
                    compareStartDate: compareStart?.format('YYYY-MM-DD'),
                    compareEndDate: compareEnd?.format('YYYY-MM-DD'),
                    platform: platform !== 'All' ? (Array.isArray(platform) ? platform.join(',') : platform) : undefined,
                    brand: selectedBrand !== 'All' ? (Array.isArray(selectedBrand) ? selectedBrand.join(',') : selectedBrand) : undefined,
                    category: selectedCategory !== 'All' ? (Array.isArray(selectedCategory) ? selectedCategory.join(',') : selectedCategory) : undefined,
                    location: selectedLocation !== 'All' ? (Array.isArray(selectedLocation) ? selectedLocation.join(',') : selectedLocation) : undefined,
                };

                const res = await axiosInstance.get('/availability-analysis/signal-lab/city-details', { params });
                if (mounted && res.data && res.data.cities) {
                    const formatted = res.data.cities.map((c, idx) => ({
                        id: idx,
                        city: c.city || "Unknown",
                        estOfftake: `₹ ${(c.estOfftake || 0).toFixed(1)} L`,
                        offtakeChange: `${(c.estOfftakeChange || 0) >= 0 ? '+' : ''}${(c.estOfftakeChange || 0).toFixed(1)}%`,
                        wtOsa: `${(c.wtOsa || 0).toFixed(1)}%`,
                        osaChange: `${(c.wtOsaChange || 0) >= 0 ? '+' : ''}${(c.wtOsaChange || 0).toFixed(1)}%`,
                        listingPct: `${((c.wtOsa || 0) * 0.9).toFixed(1)}%`,
                        overallSos: `${(c.overallSos || 0).toFixed(1)}%`,
                        adSos: `${(c.adSos || 0).toFixed(1)}%`,
                        wtDisc: `${(c.wtDisc || 0).toFixed(1)}%`,
                        discChange: `+0.0%`,
                    }));
                    setAllCities(formatted);
                }
            } catch (err) {
                console.error("City Details fetch error:", err);
                if (mounted) setError("Failed to load city details");
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchDetails();
        return () => { mounted = false; };
    }, [sku.Web_Pid, timeStart, timeEnd, platform, selectedBrand, selectedCategory, selectedLocation]);

    const totalPages = Math.ceil(allCities.length / rowsPerPage);
    const displayedData = allCities.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 items-start">
                {/* Header */}
                <div className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl  from-orange-50 to-amber-50 border border-orange-100 flex items-center justify-center text-2xl shadow-sm">
                            {displaySkuName.toLowerCase().includes("cone") ? "🍦" :
                                displaySkuName.toLowerCase().includes("cup") ? "🍨" : "🧊"}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-900 capitalize">{displaySkuName}</h2>
                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {displaySkuCode}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${sku.type === "gainer" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                                    {sku.type === "drainer" ? "Top Drainer" : "Top Gainer"}
                                </span>
                                <span>•</span>
                                <span className="font-medium bg-slate-50 px-2 py-0.5 rounded text-slate-600 border border-slate-100">{displayPackSize}</span>
                                <span>•</span>
                                <span className="font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{displayPlatform}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="w-full flex-1 overflow-auto bg-slate-50/50 p-6 relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                                <span className="text-sm font-medium text-slate-500">Loading city data...</span>
                            </div>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-center text-rose-600 font-medium mb-4">
                            {error}
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">City</th>
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">Listing %</th>
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">Est. Offtake</th>
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">Wt. OSA %</th>
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">Overall Sos</th>
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">Ad Sos</th>
                                    <th className="px-4 py-3 font-semibold text-center bg-slate-50">Wt. Disc %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {!isLoading && displayedData.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-slate-400 italic">No city data found for this SKU</td>
                                    </tr>
                                )}
                                {displayedData.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-4 py-3 font-bold text-slate-900 text-center">
                                            <div className="flex justify-center w-full">{row.city}</div>
                                        </td>

                                        {/* Listing % */}
                                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                                            <div className="flex justify-center w-full text-center">{row.listingPct}</div>
                                        </td>

                                        {/* Est Offtake */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                                <span className="font-semibold text-slate-700">{row.estOfftake}</span>
                                                <span className={`text-[10px] ${row.offtakeChange.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {row.offtakeChange}
                                                </span>
                                            </div>
                                        </td>


                                        {/* OSA - Heatmap */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                                <span className={`inline-block px-2 py-0.5 rounded ${getHeatmapClass(row.wtOsa)}`}>
                                                    {row.wtOsa}
                                                </span>
                                                <span className={`text-[10px] ${row.osaChange.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {row.osaChange}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Overall Sos */}
                                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                                            <div className="flex justify-center w-full text-center">{row.overallSos}</div>
                                        </td>

                                        {/* Ad Sos */}
                                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                                            <div className="flex justify-center w-full text-center">{row.adSos}</div>
                                        </td>

                                        {/* Disc % */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2 whitespace-nowrap text-center">
                                                <span className="font-semibold text-slate-700">{row.wtDisc}</span>
                                                <span className="text-[10px] text-emerald-600 font-medium">{row.discChange}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {/* Pagination */}
                    <div className="mt-4 border-t border-slate-100">
                        <PaginationFooter
                            isVisible={true}
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            pageSize={rowsPerPage}
                            onPageSizeChange={(newPageSize) => {
                                setRowsPerPage(newPageSize);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
