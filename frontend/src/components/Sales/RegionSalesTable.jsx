import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                MOCK DATA                                   */
/* -------------------------------------------------------------------------- */

const generateMetrics = (baseMtd) => ({
    mtdSales: baseMtd,
    prevMtd: baseMtd * (0.8 + Math.random() * 0.4),
    drr: baseMtd / 30, // rough daily rate
    ytdSales: baseMtd * (10 + Math.random() * 3),
    lastYear: baseMtd * (0.9 + Math.random() * 0.3) * 12,
    projected: baseMtd * (1.0 + Math.random() * 0.1),
});

const DATA_HIERARCHY = [
    {
        id: "flipkart",
        name: "Flipkart",
        type: "platform",
        children: [
            {
                id: "fl-north1",
                name: "North 1",
                type: "region",
                children: [
                    { id: "fl-n1-delhi", name: "Delhi", type: "city", ...generateMetrics(3500) },
                    { id: "fl-n1-gurgaon", name: "Gurgaon", type: "city", ...generateMetrics(1800) },
                    { id: "fl-n1-noida", name: "Noida", type: "city", ...generateMetrics(1277.6) },
                ],
            },
            {
                id: "fl-south",
                name: "South",
                type: "region",
                children: [
                    { id: "fl-s-bangalore", name: "Bangalore", type: "city", ...generateMetrics(800) },
                    { id: "fl-s-hyderabad", name: "Hyderabad", type: "city", ...generateMetrics(402.4) },
                ],
            },
            {
                id: "fl-east",
                name: "East",
                type: "region",
                children: [
                    { id: "fl-e-kolkata", name: "Kolkata", type: "city", ...generateMetrics(909.3) },
                ],
            },
            {
                id: "fl-west",
                name: "West",
                type: "region",
                children: [
                    { id: "fl-w-mumbai", name: "Mumbai", type: "city", ...generateMetrics(150.3) },
                    { id: "fl-w-pune", name: "Pune", type: "city", ...generateMetrics(54.0) },
                ],
            },
            {
                id: "fl-north2",
                name: "North 2",
                type: "region",
                children: [
                    { id: "fl-n2-lucknow", name: "Lucknow", type: "city", ...generateMetrics(88.3) },
                ],
            },
        ],
    },
    {
        id: "zepto",
        name: "Zepto",
        type: "platform",
        children: [
            {
                id: "zp-mumbai",
                name: "Mumbai Region",
                type: "region",
                children: [
                    { id: "zp-mum-all", name: "Mumbai", type: "city", ...generateMetrics(300.5) },
                    { id: "zp-thane", name: "Thane", type: "city", ...generateMetrics(105.1) },
                ],
            },
            {
                id: "zp-bangalore",
                name: "Bangalore Region",
                type: "region",
                children: [
                    { id: "zp-blr", name: "Bangalore", type: "city", ...generateMetrics(141.0) },
                ]
            }
        ],
    },
    {
        id: "blinkit",
        name: "Blinkit",
        type: "platform",
        children: [
            {
                id: "bk-ncr",
                name: "NCR",
                type: "region",
                children: [
                    { id: "bk-delhi", name: "Delhi", type: "city", ...generateMetrics(200.0) },
                    { id: "bk-gurgaon", name: "Gurgaon", type: "city", ...generateMetrics(160.3) },
                ],
            },
        ],
    },
    {
        id: "instamart",
        name: "Instamart",
        type: "platform",
        children: [
            {
                id: "im-south",
                name: "South",
                type: "region",
                children: [
                    { id: "im-blr", name: "Bangalore", type: "city", ...generateMetrics(150.1) },
                    { id: "im-hyd", name: "Hyderabad", type: "city", ...generateMetrics(94.0) },
                ]
            }
        ],
    },
    {
        id: "bigbasket",
        name: "Bigbasket",
        type: "platform",
        children: [
            {
                id: "bb-metro",
                name: "Metros",
                type: "region",
                children: [
                    { id: "bb-mum", name: "Mumbai", type: "city", ...generateMetrics(30.0) },
                    { id: "bb-blr", name: "Bangalore", type: "city", ...generateMetrics(28.9) },
                    { id: "bb-del", name: "Delhi", type: "city", ...generateMetrics(25.0) },
                ]
            }
        ],
    },
    {
        id: "virtual",
        name: "Virtual Store",
        type: "platform",
        children: [
            {
                id: "vs-direct",
                name: "Direct",
                type: "region",
                children: [
                    { id: "vs-app", name: "App", type: "city", ...generateMetrics(36.8) },
                ]
            }
        ],
    },
];

/* -------------------------------------------------------------------------- */
/*                                UTILITIES                                   */
/* -------------------------------------------------------------------------- */

const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return "";
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// Recursively calculate totals for nodes that don't have explicit metrics but have children
const withCalculatedTotals = (node) => {
    if (node.children && node.children.length > 0) {
        const childrenWithTotals = node.children.map(withCalculatedTotals);
        const totals = childrenWithTotals.reduce(
            (acc, child) => ({
                mtdSales: acc.mtdSales + (child.mtdSales || 0),
                prevMtd: acc.prevMtd + (child.prevMtd || 0),
                drr: acc.drr + (child.drr || 0),
                ytdSales: acc.ytdSales + (child.ytdSales || 0),
                lastYear: acc.lastYear + (child.lastYear || 0),
                projected: acc.projected + (child.projected || 0),
            }),
            { mtdSales: 0, prevMtd: 0, drr: 0, ytdSales: 0, lastYear: 0, projected: 0 }
        );
        return { ...node, children: childrenWithTotals, ...totals };
    }
    return node;
};

/* -------------------------------------------------------------------------- */
/*                             ROW COMPONENT                                  */
/* -------------------------------------------------------------------------- */

const RegionRow = ({ item, level, expandedIds, onToggle }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedIds.includes(item.id);

    // Indentation for tree structure
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
                        {hasChildren && (
                            <button
                                onClick={() => onToggle(item.id)}
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        )}
                        {!hasChildren && <span className="w-3.5 inline-block" />} {/* spacer for alignment */}
                        <span>{item.name}</span>
                    </div>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-400 capitalize">{item.type}</td>
                <td className="py-2.5 px-4 text-right">{formatNumber(item.mtdSales)}</td>
                <td className="py-2.5 px-4 text-right">{formatNumber(item.prevMtd)}</td>

                {/* Conditional Formatting for DRR */}
                <td className="py-2.5 px-4 text-right" >
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
                />
            ))}

            {/* Optional: Add a subtotal row if needed for debugging, but typically tree subtotals are the parent itself. */}
        </>
    );
};

/* -------------------------------------------------------------------------- */
/*                           MAIN COMPONENT                                   */
/* -------------------------------------------------------------------------- */

export default function RegionSalesTable() {
    const [expandedIds, setExpandedIds] = useState(["flipkart"]); // Default expanded

    const toggleExpand = (id) => {
        setExpandedIds((prev) =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Pre-calculate all hierarchy totals
    const processedData = useMemo(() => {
        return DATA_HIERARCHY.map(withCalculatedTotals);
    }, []);

    // Calculate Grand Total from the processed root items
    const grandTotal = useMemo(() => {
        return processedData.reduce(
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
    }, [processedData]);

    return (
        <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 text-sm overflow-hidden flex flex-col">
            {/* Table Container */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="py-3 px-4 w-[250px]">Platform / Region / City</th>
                            <th className="py-3 px-4 w-[100px]">Level</th>
                            <th className="py-3 px-4 text-right">MTD Sales</th>
                            <th className="py-3 px-4 text-right">Prev Month MTD</th>
                            <th className="py-3 px-4 text-right">Current DRR</th>
                            <th className="py-3 px-4 text-right">YTD Sales</th>
                            <th className="py-3 px-4 text-right">Last Year Sales</th>
                            <th className="py-3 px-4 text-right">Projected Sales</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedData.map((item) => (
                            <RegionRow
                                key={item.id}
                                item={item}
                                level={0}
                                expandedIds={expandedIds}
                                onToggle={toggleExpand}
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

                    </tbody>
                </table>
            </div>
        </div>
    );
}
