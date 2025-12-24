import React, { useState, useMemo } from "react";
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

    // Normalize data fields for display if they vary between visibility types
    const displaySkuName = sku.skuName || sku.keyword || "Unknown";
    const displaySkuCode = sku.skuCode || "Keyword";
    const displayPackSize = sku.packSize || "N/A";
    const displayPlatform = sku.platform || "N/A";

    // Mock large dataset for this SKU
    const allCities = useMemo(() => {
        const cities = [
            "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat",
            "Pune", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal",
            "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Agra",
            "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli", "Vasai-Virar", "Varanasi"
        ];
        return cities.map((city, idx) => ({
            id: idx,
            city,
            estOfftake: `₹ ${(Math.random() * 5 + 0.5).toFixed(1)} K`,
            offtakeChange: Math.random() > 0.5 ? `+${(Math.random() * 10).toFixed(1)}%` : `-${(Math.random() * 10).toFixed(1)}%`,
            catShare: `${(Math.random() * 5).toFixed(1)}%`,
            shareChange: Math.random() > 0.5 ? `+${(Math.random() * 0.5).toFixed(1)}%` : `-${(Math.random() * 0.5).toFixed(1)}%`,
            wtOsa: `${(70 + Math.random() * 30).toFixed(1)}%`,
            osaChange: Math.random() > 0.5 ? `+${(Math.random() * 2).toFixed(1)}%` : `-${(Math.random() * 2).toFixed(1)}%`,
            overallSos: `${(Math.random() * 5).toFixed(1)}%`,
            adSos: `${(Math.random() * 15).toFixed(1)}%`,
            wtDisc: `${(30 + Math.random() * 20).toFixed(1)}%`,
            discChange: `+${(Math.random() * 2).toFixed(1)}%`,
        }));
    }, [sku]);

    const totalPages = Math.ceil(allCities.length / rowsPerPage);
    const displayedData = allCities.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 items-start">
                {/* Header */}
                <div className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 flex items-center justify-center text-2xl shadow-sm">
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
                <div className="w-full flex-1 overflow-auto bg-slate-50/50 p-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                    <th className="px-4 py-3 font-semibold bg-slate-50">City</th>
                                    <th className="px-4 py-3 font-semibold text-right bg-slate-50">Est. Offtake</th>
                                    <th className="px-4 py-3 font-semibold text-right bg-slate-50">Est. Cat Share</th>
                                    <th className="px-4 py-3 font-semibold text-right bg-slate-50">Wt. OSA %</th>
                                    <th className="px-4 py-3 font-semibold text-right bg-slate-50">Overall Sos</th>
                                    <th className="px-4 py-3 font-semibold text-right bg-slate-50">Ad Sos</th>
                                    <th className="px-4 py-3 font-semibold text-right bg-slate-50">Wt. Disc %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {displayedData.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-4 py-3 font-medium text-slate-900">{row.city}</td>

                                        {/* Est Offtake */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-semibold text-slate-700">{row.estOfftake}</div>
                                            <div className={`text-[10px] ${row.offtakeChange.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {row.offtakeChange}
                                            </div>
                                        </td>

                                        {/* Cat Share */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-semibold">{row.catShare}</div>
                                            <div className={`text-[10px] ${row.shareChange.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {row.shareChange}
                                            </div>
                                        </td>

                                        {/* OSA - Heatmap */}
                                        <td className="px-4 py-3 text-right">
                                            <span className={`inline-block px-2 py-0.5 rounded ${getHeatmapClass(row.wtOsa)}`}>
                                                {row.wtOsa}
                                            </span>
                                            <div className={`text-[10px] mt-0.5 ${row.osaChange.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {row.osaChange}
                                            </div>
                                        </td>

                                        {/* Overall Sos */}
                                        <td className="px-4 py-3 text-right font-medium text-slate-600">
                                            {row.overallSos}
                                        </td>

                                        {/* Ad Sos */}
                                        <td className="px-4 py-3 text-right font-medium text-slate-600">
                                            {row.adSos}
                                        </td>

                                        {/* Disc % */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-semibold text-slate-700">{row.wtDisc}</div>
                                            <div className="text-[10px] text-emerald-600">{row.discChange}</div>
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
