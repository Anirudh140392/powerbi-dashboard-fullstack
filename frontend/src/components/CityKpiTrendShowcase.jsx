import React from "react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import TrendsCompetitionDrawer from "@/components/AllAvailablityAnalysis/TrendsCompetitionDrawer";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon, SlidersHorizontal, Check, ChevronDown, ChevronRight, X } from "lucide-react";
// import {SimpleTableWithTabs} from "../components/CommonLayout/SimpleTableWithTabs";
import SimpleTableWithTabs from "@/components/CommonLayout/SimpleTableWithTabs.jsx";
import PaginationFooter from "@/components/CommonLayout/PaginationFooter";
import { KpiFilterPanel } from "./KpiFilterPanel";
import axiosInstance from "@/api/axiosInstance";

// import TrendsCompetitionDrawer from "../AllAvailablityAnalysis/TrendsCompetitionDrawer";
// import VisibilityCompetitionDrawer from "../AllVisiblityAnalysis/VisibilityCompetitionDrawer";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import KpiTrendShowcase from "./AllAvailablityAnalysis/KpiTrendShowcase";
import { Visibility } from "@mui/icons-material";
import VisibilityTrendsCompetitionDrawer from "./AllVisiblityAnalysis/VisibilityTrendsCompetitionDrawer";
import SalesTrendsDrawer from "./Sales/SalesTrendsDrawer";

// --- Mock data -------------------------------------------------------------

const KPI_CONFIG = [
  { key: "osa", label: "OSA" },
  { key: "doi", label: "DOI" },
  { key: "fillrate", label: "Fillrate" },
  { key: "fillrate", label: "Fillrate" },
  { key: "assortment", label: "Assortment" },
  { key: "psl", label: "PSL" },
];

const CITY_DATA = [
  {
    name: "Ajmer",
    zone: "North",
    kpis: {
      osa: { value: 72, trend: -3.1, series: [80, 78, 75, 72] },
      doi: { value: 42, trend: 2.3, series: [36, 38, 40, 42] },
      fillrate: { value: 91, trend: 1.2, series: [88, 89, 90, 91] },
      assortment: { value: 73, trend: 0.8, series: [68, 70, 71, 73] },
    },
  },
  {
    name: "Amritsar",
    zone: "North",
    kpis: {
      osa: { value: 85, trend: 4.5, series: [78, 80, 83, 85] },
      doi: { value: 55, trend: -1.2, series: [58, 57, 56, 55] },
      fillrate: { value: 88, trend: 0.6, series: [86, 87, 88, 88] },
      assortment: { value: 69, trend: -0.5, series: [72, 71, 70, 69] },
    },
  },
  {
    name: "Bathinda",
    zone: "North",
    kpis: {
      osa: { value: 79, trend: 1.8, series: [74, 76, 78, 79] },
      doi: { value: 49, trend: -0.4, series: [50, 50, 49, 49] },
      fillrate: { value: 84, trend: 1.1, series: [81, 82, 83, 84] },
      assortment: { value: 71, trend: 0.9, series: [68, 69, 70, 71] },
    },
  },
  {
    name: "Bhopal",
    zone: "Central",
    kpis: {
      osa: { value: 88, trend: 2.6, series: [82, 84, 86, 88] },
      doi: { value: 60, trend: 0.7, series: [57, 58, 59, 60] },
      fillrate: { value: 94, trend: 1.9, series: [90, 91, 93, 94] },
      assortment: { value: 82, trend: 1.1, series: [78, 79, 81, 82] },
    },
  },
  {
    name: "Chandigarh",
    zone: "North",
    kpis: {
      osa: { value: 81, trend: -0.6, series: [83, 82, 81, 81] },
      doi: { value: 53, trend: 1.4, series: [49, 50, 52, 53] },
      fillrate: { value: 92, trend: 0.9, series: [89, 90, 91, 92] },
      assortment: { value: 80, trend: -0.3, series: [81, 81, 80, 80] },
    },
  },
  {
    name: "Gwalior",
    zone: "Central",
    kpis: {
      osa: { value: 75, trend: -1.9, series: [80, 78, 77, 75] },
      doi: { value: 44, trend: 0.3, series: [43, 43, 44, 44] },
      fillrate: { value: 76, trend: -0.7, series: [79, 78, 77, 76] },
      assortment: { value: 63, trend: -1.1, series: [66, 65, 64, 63] },
    },
  },
  {
    name: "Indore",
    zone: "Central",
    kpis: {
      osa: { value: 92, trend: 3.4, series: [86, 88, 90, 92] },
      doi: { value: 67, trend: -2.5, series: [72, 70, 69, 67] },
      fillrate: { value: 90, trend: 0.5, series: [88, 89, 90, 90] },
      assortment: { value: 87, trend: 1.6, series: [82, 84, 85, 87] },
    },
  },
  {
    name: "Jaipur",
    zone: "West",
    kpis: {
      osa: { value: 69, trend: -3.6, series: [78, 75, 72, 69] },
      doi: { value: 51, trend: 0.9, series: [48, 49, 50, 51] },
      fillrate: { value: 82, trend: 1.2, series: [78, 80, 81, 82] },
      assortment: { value: 78, trend: 0.4, series: [76, 77, 77, 78] },
    },
  },
];

const mockKeywords = [
  { id: "kw_generic", label: "generic ice cream" },
  { id: "kw_delivery", label: "ice cream delivery" },
  { id: "kw_cone", label: "cone ice cream" },
  { id: "kw_cornetto", label: "cornetto" },
  { id: "kw_competitor", label: "amul ice cream" },
  { id: "kw_family", label: "family pack ice cream" },
  { id: "kw_kulfi", label: "kulfi" },
  { id: "kw_cup", label: "cup ice cream" },
  { id: "kw_sundae", label: "sundae" },
  { id: "kw_choco", label: "chocolate ice cream" },
];

// --- Helpers ---------------------------------------------------------------

function getCellClasses(value) {
  if (value >= 90) return "bg-emerald-50 text-emerald-800 border-emerald-100";
  if (value >= 80) return "bg-green-50 text-green-800 border-green-100";
  if (value >= 70) return "bg-amber-50 text-amber-800 border-amber-100";
  if (value >= 60) return "bg-orange-50 text-orange-800 border-orange-100";
  return "bg-rose-50 text-rose-800 border-rose-100";
}

function getTrendMeta(trend) {
  const num = Number(trend || 0);

  if (num > 0) {
    return {
      pill: "border-green-200 bg-green-50 text-green-700",
      icon: TrendingUp,
      iconColor: "text-green-700",
      display: `+${num.toFixed(1)}`,
    };
  }

  if (num < 0) {
    return {
      pill: "border-red-200 bg-red-50 text-red-700",
      icon: TrendingDown,
      iconColor: "text-red-700",
      display: num.toFixed(1),
    };
  }

  return {
    pill: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Minus,
    iconColor: "text-slate-600",
    display: "0.0",
  };
}


function TrendSparkline({ series }) {
  const data = (series || []).map((v, idx) => ({ idx, value: v }));
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

function TrendIcon({ trend }) {
  const meta = getTrendMeta(trend);
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.iconColor}`}>
      {Icon && <Icon className="h-3 w-3" />}
      <span>{meta.display}</span>
    </span>
  );
}




// --- Variant 1: Scrollable matrix with per-cell trend popover ----------------

// function MatrixVariant() {
//   return (
//     <Card className="border-slate-200 bg-white shadow-sm">
//       <CardHeader className="pb-2">
//         <div className="flex items-center justify-between">
//           <div>
//             <CardTitle className="text-base text-slate-900">City KPI matrix</CardTitle>
//             <CardDescription className="text-xs text-slate-500">
//               Hover on any value to see trend sparkline for that city & KPI.
//             </CardDescription>
//           </div>
//           <div className="flex items-center gap-2 text-xs">
//             <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1">
//               <span className="h-2 w-2 rounded-full bg-emerald-500" />
//               <span className="ml-2 text-slate-700">90%+ healthy</span>
//             </Badge>
//             <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1">
//               <span className="h-2 w-2 rounded-full bg-amber-400" />
//               <span className="ml-2 text-slate-700">70–90% watch</span>
//             </Badge>
//             <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1">
//               <span className="h-2 w-2 rounded-full bg-rose-400" />
//               <span className="ml-2 text-slate-700">&lt;70% action</span>
//             </Badge>
//           </div>
//         </div>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <ScrollArea className="w-full rounded-xl border border-slate-100 bg-slate-50/60">
//           <div className="min-w-[1000px]">
//             <table className="w-full border-separate border-spacing-0 text-xs">
//               <thead>
//                 <tr>
//                   <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                     KPI
//                   </th>
//                   {CITY_DATA.map((city) => (
//                     <th
//                       key={city.name}
//                       className="border-b border-slate-100 bg-slate-50 py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
//                     >
//                       <div className="flex flex-col gap-1">
//                         <div className="text-xs font-semibold text-slate-900">{city.name}</div>
//                         <div className="flex items-center gap-1 text-[10px] text-slate-500">
//                           <LineChartIcon className="h-3 w-3" />
//                           <span>City trends</span>
//                         </div>
//                       </div>
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {KPI_CONFIG.map((kpi) => (
//                   <tr key={kpi.key} className="group">
//                     <td className="sticky left-0 z-10 bg-slate-50 py-2 pl-4 pr-4 text-xs font-medium text-slate-700">
//                       {kpi.label}
//                     </td>
//                     {CITY_DATA.map((city) => {
//                       const metric = city.kpis[kpi.key];
//                       if (!metric)
//                         return (
//                           <td key={city.name} className="py-2 px-3 text-center text-[11px] text-slate-400">
//                             –
//                           </td>
//                         );
//                       const cellClasses = getCellClasses(metric.value);
//                       const trendMeta = getTrendMeta(metric.trend);
//                       return (
//                         <td key={city.name} className="py-2 px-3">
//                           <Popover>
//                             <PopoverTrigger asChild>
//                               <button
//                                 className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-[0_0_0_1px_rgba(15,23,42,0.02)] transition hover:shadow-sm ${cellClasses}`}
//                               >
//                                 <span>{metric.value}%</span>
//                                 <span
//                                   className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendMeta.pill}`}
//                                 >
//                                   {trendMeta.icon === TrendingUp && <TrendingUp className="h-3 w-3" />}
//                                   {trendMeta.icon === TrendingDown && <TrendingDown className="h-3 w-3" />}
//                                   {trendMeta.icon === Minus && <Minus className="h-3 w-3" />}
//                                   <span>{metric.trend > 0 ? `+${metric.trend.toFixed(1)}` : metric.trend.toFixed(1)}</span>
//                                 </span>
//                               </button>
//                             </PopoverTrigger>
//                             <PopoverContent className="w-64 border-slate-100 bg-white shadow-md">
//                               <div className="mb-2 flex items-center justify-between text-xs">
//                                 <span className="font-semibold text-slate-900">
//                                   {kpi.label} – {city.name}
//                                 </span>
//                                 <TrendIcon trend={metric.trend} />
//                               </div>
//                               <div className="mb-1 text-[11px] text-slate-500">Last 4 periods</div>
//                               <TrendSparkline series={metric.series} />
//                             </PopoverContent>
//                           </Popover>
//                         </td>
//                       );
//                     })}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </ScrollArea>
//       </CardContent>
//     </Card>
//   );
// }
// function MatrixVariant({ data, title }) {
//   const [openTrend, setOpenTrend] = useState(false);
//   const [selectedColumn, setSelectedColumn] = useState(null);
//   const [compMetaForDrawer, setCompMetaForDrawer] = useState(null);

//   const { columns, rows } = data;

//   // ---------------- BUILD COMP META ----------------
//   const buildCompMeta = (columnName) => ({
//     context: { level: "Table", region: "All" },
//     periodToggle: { primary: "MTD", compare: "Previous" },

//     columns: columns.slice(1).map((col) => ({
//       id: col,
//       label: col,
//       type: "metric",
//     })),

//     brands: rows.map((row) => {
//       const obj = { brand: row.kpi };

//       columns.slice(1).forEach((col) => {
//         const value = row[col];
//         const trend = row.trend?.[col];

//         if (typeof value === "number") {
//           obj[col] = { value, delta: trend || 0 };
//         }
//       });

//       return obj;
//     }),
//   });

//   return (
//     <Card className="border-slate-200 bg-white shadow-sm">
//       <CardHeader className="pb-2">
//         <CardTitle className="text-base text-slate-900">{title} KPI Matrix</CardTitle>
//         <CardDescription className="text-xs text-slate-500">Hover on any value to see trend sparkline.</CardDescription>
//       </CardHeader>

//       <CardContent className="pt-0">
//         <ScrollArea className="w-full rounded-xl border border-slate-100 bg-slate-50/60">
//           <div className="min-w-[1000px]">
//             <table className="w-full border-separate border-spacing-0 text-xs">

//               {/* ---------------- HEADER ---------------- */}
//               <thead>
//                 <tr>
//                   <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                     KPI
//                   </th>

//                   {columns.slice(1).map((col) => (
//                     <th key={col} className="border-b border-slate-100 bg-slate-50 py-3 px-3 text-left">
//                       <div className="flex flex-col gap-1">
//                         <div className="text-xs font-semibold text-slate-900">{col}</div>

//                         {/* View trends button */}
//                         <div
//                           className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer hover:text-slate-700"
//                           onClick={() => {
//                             setSelectedColumn(col);
//                             setCompMetaForDrawer(buildCompMeta(col));
//                             setOpenTrend(true);
//                           }}
//                         >
//                           <LineChartIcon className="h-3 w-3" />
//                           <span>View trends</span>
//                         </div>
//                       </div>
//                     </th>
//                   ))}
//                 </tr>
//               </thead>

//               {/* ---------------- BODY ---------------- */}
//               <tbody>
//                 {rows.map((row) => (
//                   <tr key={row.kpi}>
//                     <td className="sticky left-0 z-10 bg-slate-50 py-2 pl-4 pr-4 text-xs font-medium text-slate-700">
//                       {row.kpi}
//                     </td>

//                     {columns.slice(1).map((col) => {
//                       const value = row[col];
//                       const trend = row.trend?.[col];
//                       const cellClasses = getCellClasses(value);
//                       const trendMeta = getTrendMeta(trend);

//                       const Icon = trendMeta.icon;

//                       return (
//                         <td key={col} className="py-2 px-3">
//                           <Popover>
//                             <PopoverTrigger asChild>
//                               <button
//                                 className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 shadow-sm text-[11px] font-semibold ${cellClasses}`}
//                               >
//                                 <span>{value}%</span>

//                                 <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendMeta.pill}`}>
//                                   {Icon && <Icon className="h-3 w-3" />}
//                                   <span>{trend > 0 ? `+${trend}` : trend}</span>
//                                 </span>
//                               </button>
//                             </PopoverTrigger>

//                             <PopoverContent className="w-64 border-slate-100 bg-white shadow-md">
//                               <div className="mb-2 flex items-center justify-between text-xs">
//                                 <span className="font-semibold text-slate-900">{row.kpi} – {col}</span>
//                                 {Icon && <Icon className="h-3 w-3" />}
//                               </div>

//                               <TrendSparkline series={row.series?.[col] || []} />
//                             </PopoverContent>
//                           </Popover>
//                         </td>
//                       );
//                     })}
//                   </tr>
//                 ))}
//               </tbody>

//             </table>
//           </div>
//         </ScrollArea>
//       </CardContent>

//       <TrendsCompetitionDrawer
//         open={openTrend}
//         onClose={() => setOpenTrend(false)}
//         compMeta={compMetaForDrawer}
//         selectedColumn={selectedColumn}
//       />
//     </Card>
//   );
// }
// function MatrixVariant({ data, title }) {
//   if (!data || !data.columns || !data.rows) return null;

//   const [openTrend, setOpenTrend] = useState(false);
//   const [selectedColumn, setSelectedColumn] = useState(null);
//   const [compMetaForDrawer, setCompMetaForDrawer] = useState(null);

//   const { columns, rows } = data;

//   // ---------- BUILD COMP META (unchanged) ----------
//   const buildCompMeta = (columnName) => ({
//     context: { level: "Table", region: "All" },
//     periodToggle: { primary: "MTD", compare: "Previous" },

//     columns: columns.slice(1).map((col) => ({
//       id: col,
//       label: col,
//       type: "metric",
//     })),

//     brands: rows.map((row) => {
//       const obj = { brand: row.kpi };

//       columns.slice(1).forEach((col) => {
//         const value = row[col];
//         const trend = row.trend?.[col];

//         if (typeof value === "number") {
//           obj[col] = { value, delta: trend || 0 };
//         }
//       });

//       return obj;
//     }),
//   });

//   return (
//     <Card className="border-slate-200 bg-white shadow-sm">
//       {/* ----------- HEADER WITH BADGES (CITY STYLE) ----------- */}
//       <CardHeader className="pb-2">
//         <div className="flex items-center justify-between">
//           <div>
//             <CardTitle className="text-base text-slate-900">
//               {title} KPI Matrix
//             </CardTitle>
//             <CardDescription className="text-xs text-slate-500">
//               Hover on any value to see trend sparkline.
//             </CardDescription>
//           </div>

//           {/* Heatmap legend */}
//           <div className="flex items-center gap-2 text-xs">
//             <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1">
//               <span className="h-2 w-2 rounded-full bg-emerald-500" />
//               <span className="ml-2 text-slate-700">Healthy</span>
//             </Badge>

//             <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1">
//               <span className="h-2 w-2 rounded-full bg-amber-400" />
//               <span className="ml-2 text-slate-700">Watch</span>
//             </Badge>

//             <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1">
//               <span className="h-2 w-2 rounded-full bg-rose-400" />
//               <span className="ml-2 text-slate-700">Action</span>
//             </Badge>
//           </div>
//         </div>
//       </CardHeader>

//       {/* ----------- TABLE BODY WITH CITY-STYLE CSS ----------- */}
//       <CardContent className="pt-0">
//         <ScrollArea className="w-full rounded-xl border border-slate-100 bg-slate-50/60">
//           <div className="min-w-[1000px]">
//             <table className="w-full border-separate border-spacing-0 text-xs">

//               {/* ---------------- HEADER ---------------- */}
//               <thead>
//                 <tr>
//                   <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                     KPI
//                   </th>

//                   {columns.slice(1).map((col) => (
//                     <th
//                       key={col}
//                       className="border-b border-slate-100 bg-slate-50 py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
//                     >
//                       <div className="flex flex-col gap-1">
//                         <div className="text-xs font-semibold text-slate-900">{col}</div>

//                         <div
//                           className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer hover:text-slate-700"
//                           onClick={() => {
//                             setSelectedColumn(col);
//                             setCompMetaForDrawer(buildCompMeta(col));
//                             setOpenTrend(true);
//                           }}
//                         >
//                           <LineChartIcon className="h-3 w-3" />
//                           <span>View trends</span>
//                         </div>
//                       </div>
//                     </th>
//                   ))}
//                 </tr>
//               </thead>

//               {/* ---------------- BODY ---------------- */}
//               <tbody>
//                 {rows.map((row) => (
//                   <tr key={row.kpi} className="group">
//                     <td className="sticky left-0 z-10 bg-slate-50 py-2 pl-4 pr-4 text-xs font-medium text-slate-700">
//                       {row.kpi}
//                     </td>

//                     {columns.slice(1).map((col) => {
//                       const value = row[col];
//                       const trend = row.trend?.[col];

//                       const cellClasses = getCellClasses(value);
//                       const trendMeta = getTrendMeta(trend);
//                       const Icon = trendMeta.icon;

//                       return (
//                         <td key={col} className="py-2 px-3">
//                           <Popover>
//                             <PopoverTrigger asChild>

//                               {/* CITY STYLE BUTTON */}
//                               <button
//                                 className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-[0_0_0_1px_rgba(15,23,42,0.05)] transition hover:shadow-sm ${cellClasses}`}
//                               >
//                                 <span>{value}%</span>

//                                 <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendMeta.pill}`}>
//                                   {Icon && <Icon className="h-3 w-3" />}
//                                   <span>{trend > 0 ? `+${trend}` : trend}</span>
//                                 </span>
//                               </button>
//                             </PopoverTrigger>

//                             <PopoverContent className="w-64 border-slate-100 bg-white shadow-md">
//                               <div className="mb-2 flex items-center justify-between text-xs">
//                                 <span className="font-semibold text-slate-900">{row.kpi} – {col}</span>
//                                 {Icon && <Icon className="h-3 w-3" />}
//                               </div>

//                               <div className="mb-1 text-[11px] text-slate-500">Last 4 periods</div>
//                               <TrendSparkline series={row.series?.[col] || []} />
//                             </PopoverContent>
//                           </Popover>
//                         </td>
//                       );
//                     })}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </ScrollArea>
//       </CardContent>

//       <TrendsCompetitionDrawer
//         open={openTrend}
//         onClose={() => setOpenTrend(false)}
//         compMeta={compMetaForDrawer}
//         selectedColumn={selectedColumn}
//       />
//     </Card>
//   );
// }
function MatrixVariant({ dynamicKey, data, title, showPagination = true, kpiFilterOptions, firstColLabel = "KPI" }) {
  console.log("dynamicKey", dynamicKey);
  if (!data?.columns || !data?.rows) return null;
  const isPercentageBased = dynamicKey === "availability" || dynamicKey === "visibility";

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);

  const [openTrend, setOpenTrend] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [compMetaForDrawer, setCompMetaForDrawer] = useState(null);
  const { columns, rows } = data;

  // Filter states
  const [showValue, setShowValue] = useState(true);
  const [selectedKPIs, setSelectedKPIs] = useState([]);
  const [isKPIOptionsOpen, setKPIOptionsOpen] = useState(false);

  // New KpiFilterPanel State
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterRules, setFilterRules] = useState(null);

  // Selected filters state for cascading logic
  const [selectedFilters, setSelectedFilters] = useState({
    platform: 'All',
    format: 'All',
    city: 'All',
    metroFlag: 'All'
  });

  // Dynamic filter options state
  const [dynamicFilterData, setDynamicFilterData] = useState({
    platforms: [],
    formats: [],      // Categories/keyword_category
    cities: [],
    months: [],
    dates: [],
    pincodes: [],
    zones: [],
    metroFlags: [],
    kpis: [],
    loading: true
  });

  // Helper to fetch a single filter type with cascade params
  const fetchFilterType = async (filterType, cascadeParams = {}) => {
    try {
      const params = new URLSearchParams({
        filterType,
        platform: cascadeParams.platform || 'All',
        format: cascadeParams.format || 'All',
        city: cascadeParams.city || 'All',
        metroFlag: cascadeParams.metroFlag || 'All'
      }).toString();

      // Use visibility-analysis API for visibility page
      const apiBase = dynamicKey === 'visibility'
        ? '/visibility-analysis/filter-options'
        : '/availability-analysis/filter-options';

      const res = await axiosInstance.get(`${apiBase}?${params}`);
      return res.data?.options || [];
    } catch (error) {
      console.error(`Error fetching ${filterType}:`, error);
      return [];
    }
  };

  // Initial fetch of all filter options
  React.useEffect(() => {
    const fetchAllFilterOptions = async () => {
      setDynamicFilterData(prev => ({ ...prev, loading: true }));

      try {
        // Fetch all filter types in parallel (from rb_kw and rb_location_darkstore)
        const [platforms, formats, cities, months, dates, pincodes, zones, metroFlags, kpis] = await Promise.all([
          fetchFilterType('platforms'),
          fetchFilterType('formats', selectedFilters),
          fetchFilterType('cities', selectedFilters),
          fetchFilterType('months', selectedFilters),
          fetchFilterType('dates', selectedFilters),
          fetchFilterType('pincodes', selectedFilters),
          fetchFilterType('zones'),
          fetchFilterType('metroFlags'),
          fetchFilterType('kpis')
        ]);

        setDynamicFilterData({
          platforms,
          formats,
          cities,
          months,
          dates,
          pincodes,
          zones,
          metroFlags,
          kpis,
          loading: false
        });

        console.log('[CityKpiTrendShowcase] Filter options loaded:', {
          platforms: platforms.length,
          formats: formats.length,
          cities: cities.length,
          metroFlags: metroFlags.length
        });
      } catch (error) {
        console.error('Error fetching filter options:', error);
        setDynamicFilterData(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAllFilterOptions();
  }, []); // Initial load only

  // Re-fetch dependent filters when platform changes
  React.useEffect(() => {
    if (selectedFilters.platform === 'All') return; // Skip on initial render

    const refetchDependentFilters = async () => {
      console.log('[Cascading] Platform changed to:', selectedFilters.platform, '- refetching dependent filters');
      const [formats, cities, months, pincodes] = await Promise.all([
        fetchFilterType('formats', selectedFilters),
        fetchFilterType('cities', selectedFilters),
        fetchFilterType('months', selectedFilters),
        fetchFilterType('pincodes', selectedFilters)
      ]);
      setDynamicFilterData(prev => ({ ...prev, formats, cities, months, pincodes }));
    };

    refetchDependentFilters();
  }, [selectedFilters.platform]);

  // Re-fetch cities when metroFlag changes
  React.useEffect(() => {
    if (selectedFilters.metroFlag === 'All') return;

    const refetchCities = async () => {
      console.log('[Cascading] MetroFlag changed to:', selectedFilters.metroFlag, '- refetching cities');
      const cities = await fetchFilterType('cities', selectedFilters);
      setDynamicFilterData(prev => ({ ...prev, cities }));
    };

    refetchCities();
  }, [selectedFilters.metroFlag]);

  // Re-fetch pincodes when city changes
  React.useEffect(() => {
    if (selectedFilters.city === 'All') return;

    const refetchPincodes = async () => {
      console.log('[Cascading] City changed to:', selectedFilters.city, '- refetching pincodes');
      const pincodes = await fetchFilterType('pincodes', selectedFilters);
      setDynamicFilterData(prev => ({ ...prev, pincodes }));
    };

    refetchPincodes();
  }, [selectedFilters.city]);

  // Build filter options from dynamic data (per user requirements)
  const filterOptions = React.useMemo(() => {
    if (kpiFilterOptions) return kpiFilterOptions;

    // Helper to convert array of strings to filter options format
    const toOptions = (arr) => arr.map(item => ({ id: item, label: item }));

    // Format months nicely (2025-12 -> December 2025)
    const formatMonth = (monthStr) => {
      if (!monthStr) return monthStr;
      const [year, month] = monthStr.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
    };

    const monthOptions = dynamicFilterData.months.map(m => ({
      id: m,
      label: formatMonth(m)
    }));

    // Visibility page filter config (per user requirements)
    if (dynamicKey === 'visibility') {
      return [
        { id: "date", label: "Date", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.dates)] },
        { id: "month", label: "Month", options: [{ id: "all", label: "All" }, ...monthOptions] },
        { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.platforms)] },
        { id: "kpi", label: "KPI", options: toOptions(dynamicFilterData.kpis.length ? dynamicFilterData.kpis : ['Overall SOS', 'Sponsored SOS', 'Organic SOS', 'Display SOS']) },
        { id: "format", label: "Format", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.formats)] },
        { id: "zone", label: "Zone", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.zones)] },
        { id: "city", label: "City", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.cities)] },
        { id: "pincode", label: "Pincode", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.pincodes)] },
        { id: "metroFlag", label: "Metro Flag", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.metroFlags)] },
      ];
    }

    // Availability page filter config (original)
    return [
      { id: "date", label: "Date", options: [] },
      { id: "month", label: "Month", options: [{ id: "all", label: "All" }, ...monthOptions] },
      { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.platforms)] },
      { id: "kpi", label: "KPI", options: [{ id: "osa", label: "OSA" }, { id: "fillrate", label: "Fill Rate" }, { id: "doi", label: "DOI" }, { id: "assortment", label: "Assortment" }, { id: "psl", label: "PSL" }] },
      { id: "format", label: "Format", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.formats)] },
      { id: "zone", label: "Zone", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.zones)] },
      { id: "city", label: "City", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.cities)] },
      { id: "metroFlag", label: "Metro Flag", options: [{ id: "all", label: "All" }, ...toOptions(dynamicFilterData.metroFlags)] },
    ];
  }, [dynamicFilterData, kpiFilterOptions, dynamicKey]);

  // Value Logic Filter (Legacy - kept for reference or removal)
  const [filterOperator, setFilterOperator] = useState("none"); // none, gt, lt, eq, gte, lte
  const [filterValue, setFilterValue] = useState("");

  const checkValueCondition = (val) => {
    if (!filterValue || filterOperator === "none" || val === undefined || val === null) return true;
    const num = Number(filterValue);
    if (isNaN(num)) return true;

    switch (filterOperator) {
      case "gt": return val > num;
      case "lt": return val < num;
      case "eq": return val === num;
      case "gte": return val >= num;
      case "lte": return val <= num;
      default: return true;
    }
  };

  // Initialize/Sync selectedKPIs with rows
  React.useEffect(() => {
    if (rows) {
      setSelectedKPIs(rows.map(r => r.kpi));
    }
  }, [rows]);

  const allKPIs = React.useMemo(() => rows.map(r => r.kpi), [rows]);
  const isAllSelected = selectedKPIs.length === allKPIs.length;

  const toggleAllKPIs = () => {
    if (isAllSelected) {
      setSelectedKPIs([]);
    } else {
      setSelectedKPIs(allKPIs);
    }
  };

  const toggleKPI = (kpi) => {
    if (selectedKPIs.includes(kpi)) {
      setSelectedKPIs(selectedKPIs.filter(k => k !== kpi));
    } else {
      setSelectedKPIs([...selectedKPIs, kpi]);
    }
  };

  // Calculate Pagination
  const filteredRows = React.useMemo(() => {
    return rows.filter(row => selectedKPIs.includes(row.kpi));
  }, [rows, selectedKPIs]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);

  const paginatedRows = React.useMemo(() => {
    if (!showPagination) return filteredRows;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize, showPagination]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedKPIs, pageSize]);

  // ---------------- BUILD COMP META (same logic) ----------------
  const buildCompMeta = (columnName) => ({
    context: { level: "Table", region: "All" },
    periodToggle: { primary: "MTD", compare: "Previous" },

    columns: columns.slice(1).map((col) => ({
      id: col,
      label: col,
      type: "metric",
    })),

    brands: rows.map((row) => {
      const obj = { brand: row.kpi };
      columns.slice(1).forEach((col) => {
        const value = row[col];
        const trend = row.trend?.[col];
        if (typeof value === "number") obj[col] = { value, delta: trend || 0 };
      });
      return obj;
    }),
  });

  return (
    <Card className={`border-slate-200 bg-white shadow-sm ${showPagination ? 'pb-0' : ''}`}>

      {/* ------------------ HEADER (City Style) ------------------ */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-slate-900">
              {title} KPI Matrix
            </CardTitle>

            <CardDescription className="text-xs text-slate-500">
              Hover on any value to see trend sparkline.
            </CardDescription>
          </div>

          {/* City-style Heatmap Legend */}
          <div className="flex items-center gap-3 text-xs">
            {/* KpiFilterPanel Integration */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1"></div>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="ml-2 text-slate-700">Healthy</span>
            </Badge>
            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="ml-2 text-slate-700">Watch</span>
            </Badge>
            <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="ml-2 text-slate-700">Action</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* ------------------ KPI FILTER MODAL ------------------ */}
      {showFilterPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-52 pl-40 transition-all backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                <p className="text-sm text-slate-500">Configure data visibility and rules</p>
              </div>
              <button
                onClick={() => setShowFilterPanel(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            {/* Panel Content */}
            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-0 pb-6">
              <KpiFilterPanel
                sectionConfig={filterOptions}
                keywords={mockKeywords}
                onSectionChange={(sectionId, values) => {
                  // Update selectedFilters for cascading logic
                  if (sectionId === 'platform' && values?.length > 0) {
                    setSelectedFilters(prev => ({ ...prev, platform: values[0] || 'All' }));
                  } else if (sectionId === 'format' && values?.length > 0) {
                    setSelectedFilters(prev => ({ ...prev, format: values[0] || 'All' }));
                  } else if (sectionId === 'city' && values?.length > 0) {
                    setSelectedFilters(prev => ({ ...prev, city: values[0] || 'All' }));
                  } else if (sectionId === 'metroFlag' && values?.length > 0) {
                    setSelectedFilters(prev => ({ ...prev, metroFlag: values[0] || 'All' }));
                  }
                  console.log(`[Filter Selection] ${sectionId}:`, values);
                }}
              />

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={() => setShowFilterPanel(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowFilterPanel(false)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ BODY ------------------ */}
      <CardContent className="pt-0">
        <ScrollArea className="w-full rounded-xl border border-slate-100 bg-slate-50/60 transition-all hover:bg-slate-50/80">
          <div className="w-max min-w-full">

            <table className="w-full border-separate border-spacing-0 text-xs text-slate-600">

              {/* ---------------- HEADER ROW ---------------- */}
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 
                                   text-left text-[11px] font-bold uppercase 
                                   tracking-widest text-slate-900 border-b border-slate-200 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)] min-w-[140px]">
                    {firstColLabel}
                  </th>

                  {columns.slice(1).map((col) => (
                    <th
                      key={col}
                      className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 
                                   text-center text-[11px] font-bold uppercase 
                                   tracking-widest text-slate-900 min-w-[110px]"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>{col}</span>
                        <span
                          className="cursor-pointer text-slate-600 hover:text-indigo-600 transition-colors trend-icon"
                          onClick={() => {
                            setSelectedColumn(col);
                            setCompMetaForDrawer(buildCompMeta(col));
                            setOpenTrend(true);
                          }}
                        >
                          <LineChartIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ---------------- TABLE BODY ---------------- */}
              <tbody className="bg-white">
                {paginatedRows.map((row) => (
                  <tr key={row.kpi} className="group hover:bg-slate-50/50 transition-colors">

                    {/* Sticky KPI Column */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 py-3 pl-4 pr-4 
                                     text-xs font-bold text-slate-900 border-b border-slate-100 
                                     shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]">
                      {row.kpi.toUpperCase()}
                    </td>

                    {columns.slice(1).map((col) => {
                      const value = row[col];
                      const trend = row.trend?.[col];

                      const cellClasses = getCellClasses(value);
                      const trendMeta = getTrendMeta(trend);
                      const Icon = trendMeta.icon;

                      return (
                        <td key={col} className="py-2 px-3 border-b border-r border-slate-50 last:border-r-0">
                          <Popover>
                            <PopoverTrigger asChild>

                              {/* CITY-STYLE CELL BUTTON */}
                              <button
                                className={`flex w-max mx-auto items-center justify-center gap-2 
                                           rounded-md border border-transparent px-2 py-1.5 
                                           text-xs font-semibold 
                                           transition-all duration-200
                                           hover:border-slate-200 hover:shadow-xs hover:scale-[1.02]
                                           ${cellClasses}`}
                              >
                                <span className="font-mono tabular-nums tracking-tight">
                                  {(showValue && value !== undefined && value !== null && checkValueCondition(value))
                                    ? ((isPercentageBased && row.kpi !== 'DOI' && row.kpi !== 'ASSORTMENT' && row.kpi !== 'FILLRATE')
                                      ? `${value}%`
                                      : `${value}`)
                                    : "–"}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-[1px] rounded-full border 
                                                px-0.5 py-0 text-[10px] ${trendMeta.pill} h-[13px] leading-none`}
                                >
                                  {Icon && <Icon className="h-2 w-2" />}
                                  <span className="font-medium text-[9px]">{trend > 0 ? `+${trend}` : `${trend}`}</span>
                                </span>
                              </button>
                            </PopoverTrigger>

                            {/* POPUP CONTENT */}
                            <PopoverContent className="w-72 p-0 border-slate-100 bg-white shadow-xl rounded-xl overflow-hidden">
                              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <span className="font-semibold text-xs text-slate-900">
                                  {row.kpi} · {col}
                                </span>
                                {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
                              </div>

                              <div className="p-4 space-y-3">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-2xl font-bold tracking-tight text-slate-900">{(isPercentageBased && row.kpi !== 'DOI' && row.kpi !== 'ASSORTMENT' && row.kpi !== 'FILLRATE') ? `${value}%` : value}</span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendMeta.pill}`}>
                                    {trend > 0 ? `+${trend}` : `${trend}`}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                                    <span>Last 4 periods</span>
                                    <span>Trend</span>
                                  </div>
                                  <div className="h-12 w-full pt-1">
                                    <TrendSparkline series={row.series?.[col] || []} />
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </ScrollArea>

        {/* ------------------ PAGINATION FOOTER ------------------ */}
        <PaginationFooter
          isVisible={showPagination && filteredRows.length > 3}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[3, 6, 9, 12]}
        />
      </CardContent>

      {/* TRENDS DRAWER */}
      {dynamicKey === 'availability' ? (
        <TrendsCompetitionDrawer
          open={openTrend}
          onClose={() => setOpenTrend(false)}
          compMeta={compMetaForDrawer}
          selectedColumn={selectedColumn}
          dynamicKey={dynamicKey}
        />
      ) : dynamicKey === 'sales_category_table' ? (
        <SalesTrendsDrawer
          open={openTrend}
          onClose={() => setOpenTrend(false)}
          selectedColumn='Blinkit'
          dynamicKey={dynamicKey}
        />
      ) : (
        <VisibilityTrendsCompetitionDrawer
          open={openTrend}
          onClose={() => setOpenTrend(false)}
          compMeta={compMetaForDrawer}
          selectedColumn={selectedColumn}
          dynamicKey={dynamicKey}
        />
      )
      }

    </Card >
  );
}


// --- Variant 2: Horizontal city cards with KPI bars ------------------------

// function CityCardVariant() {
//   return (
//     <Card className="border-slate-200 bg-white shadow-sm">
//       <CardHeader className="pb-2">
//         <CardTitle className="text-base text-slate-900">City health strip</CardTitle>
//         <CardDescription className="text-xs text-slate-500">
//           Swipe across cities. Each card shows KPI health with mini bars and trend icons.
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <ScrollArea className="w-full whitespace-nowrap rounded-xl border border-slate-100 bg-slate-50/60 pb-3">
//           <div className="flex w-max gap-4 p-3">
//             {CITY_DATA.map((city) => {
//               const overallTrend =
//                 KPI_CONFIG.reduce((acc, k) => acc + (city.kpis[k.key]?.trend || 0), 0) / KPI_CONFIG.length;
//               const trendMeta = getTrendMeta(overallTrend);
//               return (
//                 <Card
//                   key={city.name}
//                   className="flex h-full w-72 flex-col justify-between rounded-2xl border-slate-100 bg-white/95 px-3 py-3 shadow-sm"
//                 >
//                   <div className="mb-2 flex items-center justify-between">
//                     <div>
//                       <div className="text-sm font-semibold text-slate-900">{city.name}</div>
//                       <div className="text-[11px] text-slate-500">{city.zone} zone</div>
//                     </div>
//                     <div
//                       className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendMeta.pill}`}
//                     >
//                       {trendMeta.icon === TrendingUp && <TrendingUp className="h-3 w-3" />}
//                       {trendMeta.icon === TrendingDown && <TrendingDown className="h-3 w-3" />}
//                       {trendMeta.icon === Minus && <Minus className="h-3 w-3" />}
//                       <span className="font-medium">{overallTrend > 0 ? `+${overallTrend.toFixed(1)}` : overallTrend.toFixed(1)}</span>
//                     </div>
//                   </div>

//                   <div className="space-y-2">
//                     {KPI_CONFIG.map((kpi) => {
//                       const metric = city.kpis[kpi.key];
//                       if (!metric) return null;
//                       const cellClasses = getCellClasses(metric.value);
//                       const barWidth = `${Math.min(Math.max(metric.value, 10), 100)}%`;
//                       return (
//                         <div key={kpi.key} className="space-y-1">
//                           <div className="flex items-center justify-between text-[11px]">
//                             <span className="font-medium text-slate-700">{kpi.label}</span>
//                             <span className="flex items-center gap-1 font-semibold text-slate-900">
//                               <span className="text-[11px]">{metric.value}%</span>
//                               <TrendIcon trend={metric.trend} />
//                             </span>
//                           </div>
//                           <div className="h-2 rounded-full bg-slate-100">
//                             <div
//                               className={`h-2 rounded-full border ${cellClasses}`}
//                               style={{ width: barWidth }}
//                             />
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </Card>
//               );
//             })}
//           </div>
//         </ScrollArea>
//       </CardContent>
//     </Card>
//   );
// }

// // --- Variant 3: KPI-wise tabs (best for 50+ cities) ------------------------

// function KpiTabsVariant() {
//   return (
//     <Card className="border-slate-200 bg-white shadow-sm">
//       <CardHeader className="pb-0">
//         <div className="flex items-center justify-between gap-4">
//           <div>
//             <CardTitle className="text-base text-slate-900">KPI focus view</CardTitle>
//             <CardDescription className="text-xs text-slate-500">
//               Switch KPI tabs and scroll through all cities. Ideal when you have 50+ cities.
//             </CardDescription>
//           </div>
//         </div>
//       </CardHeader>
//       <CardContent className="pt-4">
//         <Tabs defaultValue={KPI_CONFIG[0].key} className="space-y-3">
//           <TabsList className="grid w-full grid-cols-4 bg-slate-50">
//             {KPI_CONFIG.map((kpi) => (
//               <TabsTrigger key={kpi.key} value={kpi.key} className="text-xs">
//                 {kpi.label}
//               </TabsTrigger>
//             ))}
//           </TabsList>
//           {KPI_CONFIG.map((kpi) => (
//             <TabsContent key={kpi.key} value={kpi.key} className="mt-0">
//               <ScrollArea className="h-72 rounded-xl border border-slate-100 bg-slate-50/60">
//                 <table className="w-full border-separate border-spacing-0 text-xs">
//                   <thead>
//                     <tr className="bg-slate-50">
//                       <th className="sticky top-0 z-10 border-b border-slate-100 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                         City
//                       </th>
//                       <th className="sticky top-0 z-10 border-b border-slate-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                         Value
//                       </th>
//                       <th className="sticky top-0 z-10 border-b border-slate-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                         Trend
//                       </th>
//                       <th className="sticky top-0 z-10 border-b border-slate-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
//                         Last 4 periods
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {CITY_DATA.map((city, idx) => {
//                       const metric = city.kpis[kpi.key];
//                       if (!metric) return null;
//                       const cellClasses = getCellClasses(metric.value);
//                       const trendMeta = getTrendMeta(metric.trend);
//                       return (
//                         <tr key={city.name} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}>
//                           <td className="px-4 py-2 text-xs font-medium text-slate-800">
//                             <div className="flex flex-col">
//                               <span>{city.name}</span>
//                               <span className="text-[10px] text-slate-500">{city.zone} zone</span>
//                             </div>
//                           </td>
//                           <td className="px-3 py-2">
//                             <span
//                               className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${cellClasses}`}
//                             >
//                               {metric.value}%
//                             </span>
//                           </td>
//                           <td className="px-3 py-2">
//                             <span
//                               className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendMeta.pill}`}
//                             >
//                               {trendMeta.icon === TrendingUp && <TrendingUp className="h-3 w-3" />}
//                               {trendMeta.icon === TrendingDown && <TrendingDown className="h-3 w-3" />}
//                               {trendMeta.icon === Minus && <Minus className="h-3 w-3" />}
//                               <span>{metric.trend > 0 ? `+${metric.trend.toFixed(1)}` : metric.trend.toFixed(1)}</span>
//                             </span>
//                           </td>
//                           <td className="px-3 py-2">
//                             <div className="h-12 w-full">
//                               <ResponsiveContainer width="100%" height="100%">
//                                 <LineChart
//                                   data={metric.series.map((v, i) => ({ idx: i + 1, value: v }))}
//                                   margin={{ top: 4, right: 4, bottom: 0, left: -10 }}
//                                 >
//                                   <XAxis dataKey="idx" hide />
//                                   <YAxis domain={[0, 100]} hide />
//                                   <RechartsTooltip
//                                     formatter={(val) => `${val}%`}
//                                     labelFormatter={(lab) => `Period ${lab}`}
//                                   />
//                                   <Line
//                                     type="monotone"
//                                     dataKey="value"
//                                     stroke="#0f766e"
//                                     strokeWidth={2}
//                                     dot={false}
//                                   />
//                                 </LineChart>
//                               </ResponsiveContainer>
//                             </div>
//                           </td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//               </ScrollArea>
//             </TabsContent>
//           ))}
//         </Tabs>
//       </CardContent>
//     </Card>
//   );
// }

// // --- Variant 4: Compact accordion list for city drill ----------------------

// function AccordionVariant() {
//   return (
//     <Card className="border-slate-200 bg-white shadow-sm">
//       <CardHeader className="pb-2">
//         <CardTitle className="text-base text-slate-900">City drill-down list</CardTitle>
//         <CardDescription className="text-xs text-slate-500">
//           Compact list with expandable rows – use when you want a mobile-friendly view for many cities.
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="pt-0">
//         <ScrollArea className="h-80 rounded-xl border border-slate-100 bg-slate-50/60">
//           <Accordion type="single" collapsible className="w-full">
//             {CITY_DATA.map((city) => {
//               const overallTrend =
//                 KPI_CONFIG.reduce((acc, k) => acc + (city.kpis[k.key]?.trend || 0), 0) / KPI_CONFIG.length;
//               const trendMeta = getTrendMeta(overallTrend);
//               const avgOsa = city.kpis.osa?.value ?? 0;
//               return (
//                 <AccordionItem key={city.name} value={city.name} className="border-b border-slate-100">
//                   <AccordionTrigger className="px-4 py-3 text-xs">
//                     <div className="flex flex-1 items-center justify-between">
//                       <div className="flex flex-col text-left">
//                         <span className="text-sm font-semibold text-slate-900">{city.name}</span>
//                         <span className="text-[10px] text-slate-500">{city.zone} zone · OSA {avgOsa}%</span>
//                       </div>
//                       <div className="flex items-center gap-2">
//                         <span
//                           className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${trendMeta.pill}`}
//                         >
//                           {trendMeta.icon === TrendingUp && <TrendingUp className="h-3 w-3" />}
//                           {trendMeta.icon === TrendingDown && <TrendingDown className="h-3 w-3" />}
//                           {trendMeta.icon === Minus && <Minus className="h-3 w-3" />}
//                           <span>{overallTrend > 0 ? `+${overallTrend.toFixed(1)}` : overallTrend.toFixed(1)}</span>
//                         </span>
//                       </div>
//                     </div>
//                   </AccordionTrigger>
//                   <AccordionContent className="px-4 pb-4">
//                     <div className="grid grid-cols-2 gap-3 text-[11px]">
//                       {KPI_CONFIG.map((kpi) => {
//                         const metric = city.kpis[kpi.key];
//                         if (!metric) return null;
//                         const cellClasses = getCellClasses(metric.value);
//                         return (
//                           <Card
//                             key={kpi.key}
//                             className={`flex flex-col gap-1 rounded-xl border px-3 py-2 shadow-sm ${cellClasses}`}
//                           >
//                             <div className="flex items-center justify-between">
//                               <span className="font-semibold">{kpi.label}</span>
//                               <TrendIcon trend={metric.trend} />
//                             </div>
//                             <div className="text-[24px] font-semibold leading-tight">{metric.value}%</div>
//                             <div className="h-8">
//                               <TrendSparkline series={metric.series} />
//                             </div>
//                           </Card>
//                         );
//                       })}
//                     </div>
//                   </AccordionContent>
//                 </AccordionItem>
//               );
//             })}
//           </Accordion>
//         </ScrollArea>
//       </CardContent>
//     </Card>
//   );
// }

// // --- Main showcase ----------------------------------------------------------

export default function CityKpiTrendShowcase({ dynamicKey, data, title, showPagination = true, kpiFilterOptions, firstColLabel }) {
  console.log("eee")
  if (!data || !data.columns || !data.rows) {
    console.warn("MatrixVariant blocked render because data invalid:", data);
    return null; // Prevents crash
  }
  return <MatrixVariant dynamicKey={dynamicKey} data={data} title={title} showPagination={showPagination} kpiFilterOptions={kpiFilterOptions} firstColLabel={firstColLabel} />;
}

