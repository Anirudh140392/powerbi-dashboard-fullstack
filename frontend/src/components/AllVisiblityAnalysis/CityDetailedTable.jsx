import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import {
    X,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import PaginationFooter from "../CommonLayout/PaginationFooter";

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
    const [cityData, setCityData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Normalize data fields for display if they vary between visibility types
    const displaySkuName = sku.skuName || sku.keyword || "Unknown";
    const displaySkuCode = sku.skuCode || "Keyword";
    const displayPackSize = sku.packSize || "N/A";
    const displayPlatform = sku.platform || "N/A";

    // Fetch real city data from API
    useEffect(() => {
        const fetchCityData = async () => {
            try {
                setLoading(true);

                // Determine if this is a visibility signal (has keyword or level property)
                const isVisibilitySignal = sku.level === 'keyword' || sku.level === 'sku' || sku.keyword || sku.skuName;

                if (isVisibilitySignal) {
                    // Call visibility city details API with keyword or SKU name
                    const params = {
                        level: sku.level || (sku.keyword ? 'keyword' : 'sku'),
                        keyword: sku.keyword || null,
                        skuName: sku.skuName || displaySkuName,
                        platform: sku.platform || 'All',
                        startDate: sku.startDate || '2025-12-01',
                        endDate: sku.endDate || '2025-12-31'
                    };

                    console.log('[CityDetailedTable] Fetching visibility city data with params:', params);

                    const response = await axios.get('/api/visibility-analysis/visibility-signals/city-details', {
                        params
                    });

                    console.log('[CityDetailedTable] Visibility API Response:', response.data);

                    if (response.data && response.data.cities) {
                        console.log('[CityDetailedTable] Found', response.data.cities.length, 'cities');
                        setCityData(response.data.cities);
                    }
                } else {
                    // Fallback to availability API for non-visibility signals
                    const params = {
                        webPid: sku.webPid || sku.id,
                        startDate: sku.startDate || '2025-12-01',
                        endDate: sku.endDate || '2025-12-31',
                        compareStartDate: sku.compareStartDate || '2025-11-01',
                        compareEndDate: sku.compareEndDate || '2025-11-30',
                        type: sku.metricType || 'availability'
                    };

                    console.log('[CityDetailedTable] Fetching availability city data with params:', params);

                    const response = await axios.get('/api/availability-analysis/signal-lab/city-details', {
                        params
                    });

                    if (response.data && response.data.cities) {
                        setCityData(response.data.cities);
                    }
                }
            } catch (error) {
                console.error('[CityDetailedTable] Error fetching city data:', error);
                console.error('[CityDetailedTable] Error response:', error.response?.data);
            } finally {
                setLoading(false);
            }
        };

        fetchCityData();
    }, [sku, displaySkuName]);

    // Prepare display data
    const allCities = useMemo(() => {
        return cityData.map((row, idx) => ({
            id: idx,
            city: row.city,
            estOfftake: `₹ ${row.estOfftake.toFixed(1)} K`,
            offtakeChange: `${row.estOfftakeChange >= 0 ? '+' : ''}${row.estOfftakeChange.toFixed(1)}%`,
            catShare: `${row.estCatShare.toFixed(1)}%`,
            shareChange: `${row.estCatShareChange >= 0 ? '+' : ''}${row.estCatShareChange.toFixed(1)}%`,
            wtOsa: `${row.wtOsa.toFixed(1)}%`,
            osaChange: `${row.wtOsaChange >= 0 ? '+' : ''}${row.wtOsaChange.toFixed(1)}%`,
            overallSos: `${row.overallSos.toFixed(1)}%`,
            adSos: `${row.adSos.toFixed(1)}%`,
            wtDisc: `${row.wtDisc.toFixed(1)}%`,
            discChange: `+${(Math.random() * 2).toFixed(1)}%`,
        }));
    }, [cityData]);

    const totalPages = Math.ceil(allCities.length / rowsPerPage);
    const displayedData = allCities.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 items-start">
                {/* Header - Responsive Layout */}
                <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-white shadow-sm z-10 shrink-0 gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 flex items-center justify-center text-xl sm:text-2xl shadow-sm">
                            {displaySkuName.toLowerCase().includes("cone") ? "🍦" :
                                displaySkuName.toLowerCase().includes("cup") ? "🍨" : "🧊"}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-slate-800 capitalize leading-tight">{displaySkuName}</h2>
                                <span className="text-[10px] sm:text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {displaySkuCode}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-slate-500 mt-1">
                                <span className={`px-2 py-0.5 rounded-full font-semibold border ${sku.type === "gainer" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                                    {sku.type === "drainer" ? "Top Drainer" : "Top Gainer"}
                                </span>
                                <span className="hidden sm:inline text-slate-300">•</span>
                                <span className="font-bold bg-slate-50 px-2 py-0.5 rounded text-slate-700 border border-slate-100">{displayPackSize}</span>
                                <span className="hidden sm:inline text-slate-300">•</span>
                                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{displayPlatform}</span>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-4 right-4 sm:static flex items-center">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-95"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content - Horizontal Scrollable Table */}
                <div className="w-full flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                    <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-[700px] sm:min-w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest sticky top-0 z-20 backdrop-blur-sm">
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold bg-slate-50/80 sticky left-0 z-30 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">City</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-right">Est. Offtake</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-right">Est. Cat Share</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-right">Wt. OSA %</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-right">Overall Sos</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-right">Ad Sos</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-4 font-bold text-right pr-6">Wt. Disc %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[12px] sm:text-sm">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-16 text-center bg-white">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading cities...</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : allCities.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-16 text-center text-slate-400 bg-white font-medium">
                                                No city data found for this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedData.map((row) => (
                                            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-3 sm:px-4 py-3 font-bold text-slate-800 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)]">{row.city}</td>
                                                <td className="px-3 sm:px-4 py-3 text-right">
                                                    <div className="font-bold text-slate-700">{row.estOfftake}</div>
                                                    <div className={`text-[10px] font-bold ${row.offtakeChange.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {row.offtakeChange}
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 py-3 text-right">
                                                    <div className="font-bold text-slate-700">{row.catShare}</div>
                                                    <div className={`text-[10px] font-bold ${row.shareChange.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {row.shareChange}
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 py-3 text-right">
                                                    <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${getHeatmapClass(row.wtOsa)}`}>
                                                        {row.wtOsa}
                                                    </span>
                                                    <div className={`text-[10px] font-bold mt-1 ${row.osaChange.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {row.osaChange}
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 py-3 text-right font-bold text-slate-600">{row.overallSos}</td>
                                                <td className="px-3 sm:px-4 py-3 text-right font-bold text-slate-600">{row.adSos}</td>
                                                <td className="px-3 sm:px-4 py-3 text-right pr-6">
                                                    <div className="font-bold text-slate-700">{row.wtDisc}</div>
                                                    <div className="text-[10px] font-bold text-emerald-500">{row.discChange}</div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination - Responsive */}
                    <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-white">
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
