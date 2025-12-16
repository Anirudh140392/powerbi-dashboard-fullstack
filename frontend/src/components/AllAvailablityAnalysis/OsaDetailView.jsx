import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Sample heatmap-style OLA% data (days 1..31) for the SKUs shown
export const DAYS_1_TO_31 = Array.from({ length: 31 }, (_, i) => i + 1);

export const OLA_DETAILED_SAMPLE = [
    {
        sku: "85045",
        productName: "KW CORNETTO - DOUBLE CHOCOLATE",
        olaByDay: [80, 80, 79, 80, 80, 79, 79, 78, 79, 80, 80, 80, 81, 81, 80, 80, 81, 82, 82, 82, 81, 81, 79, 79, 79, 78, 78, 79, 80, 80, 81],
    },
    {
        sku: "85047",
        productName: "KW CORNETTO - BUTTERSCOTCH",
        olaByDay: [83, 83, 82, 83, 84, 83, 84, 83, 83, 84, 84, 84, 84, 84, 83, 83, 84, 84, 84, 84, 84, 84, 82, 82, 82, 81, 81, 82, 83, 83, 84],
    },
    {
        sku: "85123",
        productName: "KW Cassatta",
        olaByDay: [69, 71, 66, 68, 72, 70, 68, 70, 72, 77, 75, 75, 78, 79, 76, 75, 76, 78, 76, 74, 70, 68, 68, 68, 67, 66, 66, 67, 68, 69, 70],
    },
    {
        sku: "85336",
        productName: "KW PP Strawberry",
        olaByDay: [71, 71, 71, 71, 71, 71, 70, 70, 70, 70, 71, 71, 71, 71, 70, 70, 71, 72, 72, 72, 72, 72, 71, 71, 70, 70, 70, 70, 71, 71, 72],
    },
    {
        sku: "85338",
        productName: "KW Magnum Chocolate Truffle",
        olaByDay: [74, 74, 74, 74, 74, 74, 74, 73, 74, 74, 74, 74, 74, 74, 73, 73, 74, 74, 74, 74, 74, 74, 73, 73, 72, 72, 72, 73, 74, 74, 74],
    },
    {
        sku: "85339",
        productName: "KW Magnum Almond 90 ml",
        olaByDay: [80, 80, 80, 80, 80, 80, 81, 80, 80, 81, 81, 80, 81, 81, 80, 80, 81, 82, 81, 82, 81, 80, 80, 79, 79, 78, 78, 79, 80, 80, 81],
    },
    {
        sku: "85350",
        productName: "KW CDO - FRUIT & NUT",
        olaByDay: [72, 72, 71, 72, 72, 72, 71, 71, 72, 73, 72, 72, 73, 73, 72, 72, 72, 72, 73, 73, 73, 73, 72, 72, 71, 71, 71, 72, 72, 72, 73],
    },
    {
        sku: "85411",
        productName: "KW Magnum Brownie 90ml",
        olaByDay: [77, 78, 77, 77, 78, 78, 78, 78, 78, 79, 79, 78, 79, 79, 79, 79, 79, 80, 80, 80, 79, 78, 78, 78, 78, 77, 77, 78, 78, 79, 79],
    },
    {
        sku: "85437",
        productName: "COR DISC OREO 120ML",
        olaByDay: [83, 83, 83, 83, 84, 84, 84, 83, 83, 83, 83, 83, 84, 83, 82, 82, 83, 84, 83, 84, 83, 83, 82, 82, 82, 81, 81, 82, 83, 83, 84],
    },
    {
        sku: "85438",
        productName: "KW Sandwich Chocolate n Vanilla 90ml",
        olaByDay: [76, 77, 76, 76, 75, 77, 75, 76, 74, 77, 76, 77, 78, 79, 77, 79, 82, 82, 82, 82, 78, 78, 79, 79, 79, 78, 78, 79, 80, 80, 81],
    },
    {
        sku: "85555",
        productName: "KW Oreo Tub 2x700ml",
        olaByDay: [87, 89, 87, 88, 90, 90, 90, 86, 86, 87, 87, 88, 90, 90, 86, 89, 90, 90, 89, 90, 90, 90, 89, 90, 90, 89, 89, 90, 90, 90, 91],
    },
    {
        sku: "85570",
        productName: "KW AAMRAS 70ml",
        olaByDay: [79, 78, 76, 80, 85, 84, 86, 85, 82, 84, 86, 88, 90, 89, 87, 87, 87, 91, 88, 87, 85, 80, 80, 81, 80, 79, 79, 80, 80, 81, 82],
    },
    {
        sku: "85572",
        productName: "KW Magnum Chocolate Truffle 12x80ml",
        olaByDay: [86, 88, 87, 86, 87, 88, 89, 90, 89, 91, 90, 91, 92, 88, 88, 91, 94, 91, 92, 89, 87, 84, 86, 86, 85, 84, 84, 85, 86, 87, 88],
    },
    {
        sku: "85577",
        productName: "Cornetto choco vanilla",
        olaByDay: [75, 75, 75, 76, 75, 75, 75, 74, 74, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 74, 74, 74, 74, 74, 74, 74, 74, 75, 75, 75],
    },
];

// Helper to colorize heat cells
function getHeatStyle(value) {
    if (value >= 85) return "bg-emerald-50 text-emerald-800 border-emerald-100";
    if (value >= 70) return "bg-amber-50 text-amber-800 border-amber-100";
    return "bg-rose-50 text-rose-800 border-rose-100";
}

export default function OsaHeatmapTable() {
    return (
        <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base text-slate-900">
                            OSA % Detail View (Last 31 Days)
                        </CardTitle>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="ml-2 text-slate-700">Healthy (&ge; 85%)</span>
                        </Badge>

                        <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            <span className="ml-2 text-slate-700">Watch (70-84%)</span>
                        </Badge>

                        <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1">
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                            <span className="ml-2 text-slate-700">Action (&lt; 70%)</span>
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                <ScrollArea className="w-full rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="min-w-[1200px]">
                        <table className="w-full border-separate border-spacing-0 text-xs">
                            <thead>
                                <tr>
                                    {/* Sticky First Column */}
                                    <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-200 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        Product / SKU
                                    </th>

                                    {DAYS_1_TO_31.map((day) => (
                                        <th
                                            key={day}
                                            className="border-b border-r border-slate-100 bg-slate-50 py-3 px-2 text-center text-[10px] font-semibold uppercase text-slate-500 min-w-[40px]"
                                        >
                                            Day {day}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {OLA_DETAILED_SAMPLE.map((row, idx) => (
                                    <tr key={row.sku} className="group hover:bg-slate-50/50">
                                        <td className="sticky left-0 z-10 bg-white py-2 pl-4 pr-4 text-xs font-medium text-slate-700 border-b border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                                            <div className="flex flex-col">
                                                <span className="truncate w-48" title={row.productName}>{row.productName}</span>
                                                <span className="text-[10px] text-slate-400">{row.sku}</span>
                                            </div>
                                        </td>

                                        {row.olaByDay.map((val, dIdx) => {
                                            const style = getHeatStyle(val);
                                            return (
                                                <td key={dIdx} className="p-1 border-b border-r border-slate-50 text-center">
                                                    <div className={`rounded md:rounded-lg py-1 text-[10px] font-semibold ${style}`}>
                                                        {val}%
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

