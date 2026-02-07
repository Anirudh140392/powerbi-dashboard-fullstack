
import React, { useState } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    LineChart as LineChartIcon,
} from "lucide-react";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
} from "recharts";

// --- Helpers ---------------------------------------------------------------

function getCellClasses(value, colName) {
    // Only color code the "Current DRR" column as per screenshot example
    if (colName === "Current DRR") {
        if (value >= 30) return "bg-emerald-600 text-white border-transparent hover:bg-emerald-700"; // Deep Green
        if (value >= 10 && value < 30) return "bg-emerald-600 text-white border-transparent hover:bg-emerald-700"; // Deep Green (grouping similar for this example)
        if (value < 10) return "bg-rose-500 text-white border-transparent hover:bg-rose-600"; // Red
    }
    return "bg-transparent text-slate-700 border-none hover:bg-slate-50";
}


function getTrendMeta(trend) {
    const num = Number(trend || 0);

    if (num > 0) {
        return {
            pill: "border-green-200 bg-green-50 text-green-700",
            icon: TrendingUp,
            iconColor: "text-green-700",
            display: `+${num.toFixed(1)}%`,
        };
    }

    if (num < 0) {
        return {
            pill: "border-red-200 bg-red-50 text-red-700",
            icon: TrendingDown,
            iconColor: "text-red-700",
            display: `${num.toFixed(1)}%`,
        };
    }

    return {
        pill: "border-slate-200 bg-slate-50 text-slate-600",
        icon: Minus,
        iconColor: "text-slate-600",
        display: "0.0%",
    };
}


function TrendSparkline({ series }) {
    // Mock series generation if real data isn't available for sparklines
    const data = (series && series.length > 0 ? series : [10, 15, 8, 12, 20, 18, 25]).map((v, idx) => ({ idx, value: v }));
    if (!data.length) return null;

    return (
        <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0f766e"
                    fill="#ccfbf1"
                    strokeWidth={2}
                    dot={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}


export default function SalesMatrixTable({ data, title }) {
    if (!data || !data.columns || !data.rows) return null;

    const { columns, rows } = data;

    return (
        <CardContent className="pt-4 px-0">
            <div className="flex items-center justify-between px-4 mb-4">
                <CardTitle className="text-xl font-bold text-slate-900">{title}</CardTitle>
            </div>

            <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                    <table className="w-full border-separate border-spacing-0 text-sm"> {/* Increased text size */}

                        {/* ---------------- HEADER ---------------- */}
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="sticky left-0 z-20 bg-white py-3 pl-6 pr-4 text-left font-bold text-slate-900 border-b-2 border-slate-100">
                                    {columns[0]}
                                </th>

                                {columns.slice(1).map((col) => (
                                    <th
                                        key={col}
                                        className="bg-white py-3 px-4 text-right font-bold text-slate-900 border-b-2 border-slate-100" // Right align numbers, bold headers
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {/* ---------------- BODY ---------------- */}
                        <tbody>
                            {rows.map((row, rowIndex) => {
                                const isTotalRow = row.kpi === "Total";
                                return (
                                    <tr key={row.kpi} className={`group ${isTotalRow ? "font-bold bg-slate-50" : "hover:bg-slate-50/50"}`}>
                                        <td className={`sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 py-3 pl-6 pr-4 font-semibold text-slate-900 border-b border-slate-100 ${isTotalRow ? "bg-slate-50" : ""}`}>
                                            {row.kpi}
                                        </td>

                                        {columns.slice(1).map((col) => {
                                            const value = row[col];
                                            const trend = row.trend?.[col];
                                            const cellClasses = getCellClasses(value, col);

                                            // For "Current DRR", apply background color style
                                            const isColoredCell = col === "Current DRR" && !isTotalRow;

                                            return (
                                                <td key={col} className={`py-2 px-2 border-b border-slate-100 ${isTotalRow ? "bg-slate-50" : ""}`}>
                                                    <div className={`flex justify-end`}>
                                                        {isColoredCell ? (
                                                            <div className={`w-full text-center py-1.5 rounded ${cellClasses}`}>
                                                                {value?.toLocaleString()}
                                                            </div>
                                                        ) : (
                                                            <div className="py-1.5 px-2 text-slate-700 text-right w-full">
                                                                {value?.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </ScrollArea>
        </CardContent>
    );
}
