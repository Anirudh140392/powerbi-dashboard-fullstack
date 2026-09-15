import React, { useState, useMemo, useEffect } from "react";
import { ChevronRight, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";
import { fetchSalesDrilldown } from "../../api/salesService";

/* -------------------------------------------------------------------------- */
/*                                UTILITIES                                   */
/* -------------------------------------------------------------------------- */

const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return "";
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

/* -------------------------------------------------------------------------- */
/*                             ROW COMPONENT                                  */
/* -------------------------------------------------------------------------- */

const RegionRow = ({ item, level, expandedIds, onToggle, loadingId }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isLeaf = item.type === "city"; // Cities are leaves (no further drilldown)
    const isExpanded = expandedIds.includes(item.id);

    const paddingLeft = level * 20 + 16;

    const rowBackground =
        level === 0 ? "bg-white hover:bg-slate-50 font-semibold text-slate-900" :
            level === 1 ? "bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium" :
                "bg-slate-100/50 hover:bg-slate-100 text-slate-600";

    return (
        <>
            <tr className={`border-b border-slate-100 last:border-0 transition-colors ${rowBackground}`}>
                <td className="py-2.5 pr-4 relative">
                    <div className="flex items-center gap-2" style={{ paddingLeft }}>
                        {!isLeaf && (
                            <button
                                onClick={() => onToggle(item.id, item)}
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                disabled={loadingId === item.id}
                            >
                                {loadingId === item.id ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-300 border-t-slate-500"></div>
                                ) : isExpanded ? (
                                    <ChevronDown size={14} />
                                ) : (
                                    <ChevronRight size={14} />
                                )}
                            </button>
                        )}
                        {isLeaf && <span className="w-3.5 inline-block" />}
                        <span>{item.name}</span>
                    </div>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-400 capitalize">{item.type}</td>
                <td className="py-2.5 px-4 text-right">{formatNumber(item.mtdSales)}</td>
                <td className="py-2.5 px-4 text-right">{formatNumber(item.prevMtd)}</td>

                <td className="py-2.5 px-4 text-right">
                    <div className={`
                        inline-block px-2 py-0.5 rounded 
                        ${item.drr > 50 ? 'bg-teal-600 text-white' : ''}
                        ${item.drr > 20 && item.drr <= 50 ? 'bg-teal-500 text-white' : ''}
                        ${item.drr <= 20 ? '' : ''}
                    `}>
                        {formatNumber(item.drr)}
                    </div>
                </td>

                <td className="py-2.5 px-4 text-right">{formatNumber(item.ytdSales, 0)}</td>
                <td className="py-2.5 px-4 text-right">{formatNumber(item.lastYear, 0)}</td>
                <td className="py-2.5 px-4 text-right">{formatNumber(item.projected)}</td>
            </tr>

            {/* Recursive Children */}
            {isExpanded && hasChildren && item.children.map(child => (
                <RegionRow
                    key={child.id}
                    item={child}
                    level={level + 1}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                    loadingId={loadingId}
                />
            ))}
        </>
    );
};

/* -------------------------------------------------------------------------- */
/*                           MAIN COMPONENT                                   */
/* -------------------------------------------------------------------------- */

export default function RegionSalesTable({ startDate, endDate, brand }) {
    const [hierarchyData, setHierarchyData] = useState([]);
    const [expandedIds, setExpandedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingId, setLoadingId] = useState(null);
    const [error, setError] = useState(null);

    // Load top-level platforms
    useEffect(() => {
        const loadPlatforms = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchSalesDrilldown({ level: 'platform', startDate, endDate, brand });
                const formatted = data.map(item => ({
                    id: item.name.toLowerCase(),
                    name: item.name,
                    type: "platform",
                    mtdSales: item.mtdSales,
                    prevMtd: item.prevMonthMtd,
                    drr: item.currentDrr,
                    ytdSales: item.ytdSales,
                    lastYear: item.lastYearSales,
                    projected: item.projectedSales,
                    children: []
                }));
                setHierarchyData(formatted);
                // Auto-expand first platform if present
                if (formatted.length > 0) {
                    setExpandedIds([formatted[0].id]);
                    // Also load its regions
                    loadChildren(formatted[0], formatted);
                }
            } catch (err) {
                console.error("Failed to load platforms:", err);
                setError(err.message || "Failed to load sales data");
            } finally {
                setLoading(false);
            }
        };

        loadPlatforms();
    }, [startDate, endDate, brand]);

    const loadChildren = async (node, currentData) => {
        if (node.type === "city") return; // Cities are leaf nodes

        setLoadingId(node.id);
        try {
            let params = {};
            if (node.type === "platform") {
                params = { level: 'region', platform: node.name, startDate, endDate, brand };
            } else if (node.type === "region") {
                params = { level: 'city', platform: node.platformName, region: node.name, startDate, endDate, brand };
            }

            const data = await fetchSalesDrilldown(params);
            const children = data.map(item => ({
                id: `${node.id}-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: item.name,
                type: node.type === "platform" ? "region" : "city",
                mtdSales: item.mtdSales,
                prevMtd: item.prevMonthMtd,
                drr: item.currentDrr,
                ytdSales: item.ytdSales,
                lastYear: item.lastYearSales,
                projected: item.projectedSales,
                children: [],
                platformName: node.type === "platform" ? node.name : node.platformName
            }));

            // Deep update the hierarchy
            const sourceData = currentData || hierarchyData;
            const newData = JSON.parse(JSON.stringify(sourceData));
            const updateNode = (nodes) => {
                for (let n of nodes) {
                    if (n.id === node.id) {
                        n.children = children;
                        return true;
                    }
                    if (n.children && updateNode(n.children)) return true;
                }
                return false;
            };
            updateNode(newData);
            setHierarchyData(newData);
        } catch (err) {
            console.error("Failed to load children:", err);
        } finally {
            setLoadingId(null);
        }
    };

    const toggleExpand = async (id, item) => {
        const isCurrentlyExpanded = expandedIds.includes(id);
        if (isCurrentlyExpanded) {
            setExpandedIds(prev => prev.filter(x => x !== id));
        } else {
            setExpandedIds(prev => [...prev, id]);
            // Load children if not yet loaded
            if (item.children && item.children.length === 0 && item.type !== "city") {
                await loadChildren(item);
            }
        }
    };

    // Calculate grand total from top-level platforms
    const grandTotal = useMemo(() => {
        return hierarchyData.reduce(
            (acc, node) => ({
                mtdSales: acc.mtdSales + (node.mtdSales || 0),
                prevMtd: acc.prevMtd + (node.prevMtd || 0),
                drr: acc.drr + (node.drr || 0),
                ytdSales: acc.ytdSales + (node.ytdSales || 0),
                lastYear: acc.lastYear + (node.lastYear || 0),
                projected: acc.projected + (node.projected || 0),
            }),
            { mtdSales: 0, prevMtd: 0, drr: 0, ytdSales: 0, lastYear: 0, projected: 0 }
        );
    }, [hierarchyData]);

    if (error) {
        return (
            <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 text-sm overflow-hidden flex flex-col items-center justify-center py-12 px-6">
                <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <AlertCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load Region Sales</h3>
                <p className="text-sm text-slate-500 mb-4 text-center max-w-sm">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                    <RefreshCw size={16} />
                    Try Refreshing
                </button>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 text-sm overflow-hidden flex flex-col">
            {/* Loading bar */}
            {(loading || loadingId) && (
                <div className="h-0.5 bg-teal-100 overflow-hidden">
                    <div className="h-full bg-teal-500 animate-pulse" style={{ width: '60%' }}></div>
                </div>
            )}

            {/* Table Container */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px] table-fixed">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="py-3 px-4 w-[24%]">Platform / Region / City</th>
                            <th className="py-3 px-4 w-[10%]">Level</th>
                            <th className="py-3 px-4 text-right w-[11%]">MTD Sales</th>
                            <th className="py-3 px-4 text-right w-[11%]">Prev Month MTD</th>
                            <th className="py-3 px-4 text-right w-[11%]">Current DRR</th>
                            <th className="py-3 px-4 text-right w-[11%]">YTD Sales</th>
                            <th className="py-3 px-4 text-right w-[11%]">Last Year Sales</th>
                            <th className="py-3 px-4 text-right w-[11%]">Projected Sales</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && hierarchyData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-teal-500"></div>
                                        <span className="text-sm text-slate-500 font-medium">Loading sales data...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : hierarchyData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-16 text-center text-sm text-slate-500 font-medium">
                                    No data found for the selected filters.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {hierarchyData.map((item) => (
                                    <RegionRow
                                        key={item.id}
                                        item={item}
                                        level={0}
                                        expandedIds={expandedIds}
                                        onToggle={toggleExpand}
                                        loadingId={loadingId}
                                    />
                                ))}

                                {/* Grand Total Row */}
                                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 border-b-0">
                                    <td className="py-3 px-4 text-center" colSpan={2}>GRAND TOTAL</td>
                                    <td className="py-3 px-4 text-right">{formatNumber(grandTotal.mtdSales)}</td>
                                    <td className="py-3 px-4 text-right">{formatNumber(grandTotal.prevMtd)}</td>
                                    <td className="py-3 px-4 text-right">{formatNumber(grandTotal.drr)}</td>
                                    <td className="py-3 px-4 text-right">{formatNumber(grandTotal.ytdSales, 0)}</td>
                                    <td className="py-3 px-4 text-right">{formatNumber(grandTotal.lastYear, 0)}</td>
                                    <td className="py-3 px-4 text-right">{formatNumber(grandTotal.projected)}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
