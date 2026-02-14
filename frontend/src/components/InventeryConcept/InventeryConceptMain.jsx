import React, { useMemo, useState } from "react";
import { Typography } from "@mui/material";
import CitySkuInventoryDrill from "./CitySkuInventoryDrill";
import InventoryDrill from "./InventoryMainDrill";
import MetricCardContainer from "../CommonLayout/MetricCardContainer";

// Single-page Inventory & DOH dashboard
// Layout intentionally mirrors your Visibility page: overview cards, KPI matrix tabs,
// hierarchy table and signal cards, all wired to shared filters.

const PLATFORMS = ["Blinkit", "Zepto", "Instamart", "Amazon", "Swiggy"];

const SAMPLE_SKUS = [
  {
    id: 1,
    sku: "KW Cornetto Double Chocolate",
    format: "Cornetto",
    platform: "Blinkit",
    city: "Ahmedabad",
    feSoh: 80,
    beSoh: 320,
    avgDailySales: 20,
    unitsPerBox: 10,
    psl: "High",
  },
  {
    id: 2,
    sku: "KW Cornetto Butterscotch",
    format: "Cornetto",
    platform: "Blinkit",
    city: "Ahmedabad",
    feSoh: 60,
    beSoh: 210,
    avgDailySales: 18,
    unitsPerBox: 10,
    psl: "Medium",
  },
  {
    id: 3,
    sku: "KW Magnum Almond 90ml",
    format: "Magnum",
    platform: "Zepto",
    city: "Ahmedabad",
    feSoh: 50,
    beSoh: 260,
    avgDailySales: 15,
    unitsPerBox: 8,
    psl: "High",
  },
  {
    id: 4,
    sku: "KW Sandwich Chocolate Vanilla 90ml",
    format: "Sandwich",
    platform: "Instamart",
    city: "Surat",
    feSoh: 40,
    beSoh: 180,
    avgDailySales: 14,
    unitsPerBox: 12,
    psl: "Low",
  },
  {
    id: 5,
    sku: "KW Cornetto Double Chocolate",
    format: "Cornetto",
    platform: "Zepto",
    city: "Surat",
    feSoh: 35,
    beSoh: 190,
    avgDailySales: 13,
    unitsPerBox: 10,
    psl: "Medium",
  },
  {
    id: 6,
    sku: "KW Magnum Brownie 90ml",
    format: "Magnum",
    platform: "Blinkit",
    city: "Mumbai",
    feSoh: 55,
    beSoh: 260,
    avgDailySales: 22,
    unitsPerBox: 8,
    psl: "High",
  },
  {
    id: 7,
    sku: "KW Oreo Tub 2x700ml",
    format: "Core Tub",
    platform: "Instamart",
    city: "Mumbai",
    feSoh: 30,
    beSoh: 200,
    avgDailySales: 16,
    unitsPerBox: 6,
    psl: "Medium",
  },
  {
    id: 8,
    sku: "KW Feast Black Forest",
    format: "Sticks",
    platform: "Amazon",
    city: "Bengaluru",
    feSoh: 25,
    beSoh: 150,
    avgDailySales: 10,
    unitsPerBox: 12,
    psl: "High",
  },
  {
    id: 9,
    sku: "KW Choco Brownie Fudge",
    format: "Premium Tub",
    platform: "Swiggy",
    city: "Hyderabad",
    feSoh: 42,
    beSoh: 210,
    avgDailySales: 17,
    unitsPerBox: 8,
    psl: "Low",
  },
  {
    id: 10,
    sku: "KW Majestic Kesar Pista Tub",
    format: "Premium Tub",
    platform: "Blinkit",
    city: "Pune",
    feSoh: 28,
    beSoh: 140,
    avgDailySales: 11,
    unitsPerBox: 6,
    psl: "Medium",
  },
];

const PSL_COLOR = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const HEALTH_COLOR = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  watch: "bg-amber-50 text-amber-700 border-amber-200",
  action: "bg-red-50 text-red-700 border-red-200",
};

const THRESHOLD_DOH = 8;

/* ------------------------------------------------------------------
   TYPES REMOVED (TS → JSX)
------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------ */

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) || [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

function generateTrendSeries(base) {
  const deltas = [-2, 1, 0, 2, -1, 1, 0];
  return deltas.map((d) => Math.max(0, base + d));
}

/* ------------------------------------------------------------------
   UI COMPONENTS
------------------------------------------------------------------ */

function Sparkline({ values }) {
  if (!values.length) return null;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const span = max - min || 1;

  const normalised = values.map((v) => (v - min) / span);
  const points = normalised
    .map((v, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * 100;
      const y = 90 - v * 70;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-10 w-full text-emerald-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function KpiPill({ value, delta, health, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition hover:shadow-md ${HEALTH_COLOR[health]}`}
    >
      <span>{value}</span>
      {delta && <span className="text-[10px] opacity-80">{delta}</span>}
    </button>
  );
}

function SegmentToggle({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`min-w-[90px] rounded-full px-3 py-1 text-xs font-medium transition ${active ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function MultiChipFilter({ label, options, selected, onChange }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const allSelected = selected.length === options.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : [...options])}
          className="text-[11px] text-sky-600 hover:underline"
        >
          {allSelected ? "Clear" : "Select all"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-full border px-3 py-1 text-xs transition ${active
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrendModal({ context, onClose }) {
  if (!context) return null;
  const series = generateTrendSeries(context.baseValue);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
            {context.title}
          </Typography>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500"
          >
            Close
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Showing last seven points trend ({context.unit}).
        </p>
        <div className="rounded-xl bg-slate-50 p-3">
          <Sparkline values={series} />
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-[10px] text-slate-500">
          {series.map((v, idx) => (
            <div key={idx} className="rounded bg-slate-100 py-1 text-center">
              {v.toFixed(1)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   MAIN COMPONENT
------------------------------------------------------------------ */

function InventeryConceptMain() {
  const [dateFrom, setDateFrom] = useState("2025-12-01");
  const [dateTo, setDateTo] = useState("2025-12-12");
  const [drrUplift, setDrrUplift] = useState(20);

  const allFormats = useMemo(
    () => Array.from(new Set(SAMPLE_SKUS.map((s) => s.format))).sort(),
    []
  );

  const allCities = useMemo(
    () => Array.from(new Set(SAMPLE_SKUS.map((s) => s.city))).sort(),
    []
  );

  const [selectedPlatforms, setSelectedPlatforms] = useState([...PLATFORMS]);
  const [selectedFormats, setSelectedFormats] = useState(allFormats);
  const [selectedCities, setSelectedCities] = useState(allCities);

  const [matrixTab, setMatrixTab] = useState("platform");
  const [hierarchyMode, setHierarchyMode] = useState("Cities");
  const [selectedKpi, setSelectedKpi] = useState("totalDoh");

  const [trendContext, setTrendContext] = useState(null);
  const [expandedCities, setExpandedCities] = useState({});
  const [expandedFormats, setExpandedFormats] = useState({});

  const filteredSkus = useMemo(() => {
    return SAMPLE_SKUS.filter(
      (row) =>
        selectedPlatforms.includes(row.platform) &&
        selectedFormats.includes(row.format) &&
        selectedCities.includes(row.city)
    ).map((row) => {
      const totalInventory = row.feSoh + row.beSoh;
      const sales = row.avgDailySales || 1;

      const doiFeBe = totalInventory / sales;
      const doiBe = row.beSoh / sales;
      const feDoh = row.feSoh / sales;

      const upliftFactor = 1 + drrUplift / 100;
      const requiredQtyUnits = Math.max(
        0,
        Math.round(Math.max(0, THRESHOLD_DOH - feDoh) * sales * upliftFactor)
      );
      const reqBoxes = Math.ceil(requiredQtyUnits / row.unitsPerBox);

      return {
        ...row,
        doiFeBe,
        doiBe,
        feDoh,
        totalInventory,
        requiredQtyUnits,
        reqBoxes,
      };
    });
  }, [selectedPlatforms, selectedFormats, selectedCities, drrUplift]);

  const overview = useMemo(() => {
    if (!filteredSkus.length) {
      return {
        totalDoiFeBe: 0,
        totalDoiBe: 0,
        avgFeDoh: 0,
        totalPslHigh: 0,
      };
    }

    let sumDoiFeBe = 0;
    let sumDoiBe = 0;
    let sumFeDoh = 0;
    let high = 0;
    let sumDrr = 0;
    let sumBoxes = 0;

    filteredSkus.forEach((r) => {
      sumDoiFeBe += r.doiFeBe;
      sumDoiBe += r.doiBe;
      sumFeDoh += r.feDoh;
      sumDrr += r.avgDailySales || 0;
      sumBoxes += r.reqBoxes || 0;
      if (r.psl === "High") high += 1;
    });

    const n = filteredSkus.length;
    return {
      totalDoiFeBe: sumDoiFeBe / n,
      totalDoiBe: sumDoiBe / n,
      avgFeDoh: sumFeDoh / n,
      totalPslHigh: high,
      totalDrr: sumDrr,
      totalBoxesRequired: sumBoxes,
    };
  }, [filteredSkus]);

  const formatDays = (value) => `${value.toFixed(1)} d`;
  const formatLargeNumber = (num) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const cards = [
    {
      title: "DOH",
      value: overview.totalDoiFeBe.toFixed(1),
      sub: "Days",
      change: "▲3.1% (from 82.1%)",
      changeColor: "green",
      prevText: "vs Comparison Period",
      extra: "High risk stores: 12",
      extraChange: "▼4 stores",
      extraChangeColor: "green",
      sparklineData: [90, 40, 45, 75, 65, 50, 85],
    },
    {
      title: "DRR",
      value: Math.round(overview.totalDrr).toString(),
      sub: "Daily Rate",
      change: "▼5.3% (from 65.9)",
      changeColor: "red",
      prevText: "vs Comparison Period",
      extra: "Target band: 55-65 days",
      extraChange: "Within target range",
      extraChangeColor: "green",
      sparklineData: [55, 75, 45, 46, 45, 48, 60],
    },
    {
      title: "Total Boxes Required",
      value: formatLargeNumber(overview.totalBoxesRequired),
      sub: "Replenishment",
      change: "▼2.0% (from 80.5%)",
      changeColor: "red",
      prevText: "vs Comparison Period",
      extra: "Orders delayed: 6%",
      extraChange: "▼1.2%",
      extraChangeColor: "green",
      sparklineData: [50, 60, 35, 38, 40, 45, 55],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900" >
      {/* Top Inventory & DOH Overview */}
      < div className="mx-auto max-w-6xl space-y-6" >
        {/* REPLACED WITH METRIC CARD CONTAINER */}
        < MetricCardContainer title="Inventory & DOH Overview" cards={cards} />

        {/* MATRIX + FILTERS */}
        {/* <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                  Platform DOH Matrix
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Hover on any value for FE/BE split and click to see trend.
                </Typography>
              </div>

              <SegmentToggle
                options={["Platform", "Format", "City"]}
                value={
                  matrixTab === "platform"
                    ? "Platform"
                    : matrixTab === "format"
                      ? "Format"
                      : "City"
                }
                onChange={(label) => {
                  if (label === "Platform") setMatrixTab("platform");
                  if (label === "Format") setMatrixTab("format");
                  if (label === "City") setMatrixTab("city");
                }}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-left text-xs">
                <thead>
                  <tr className="text-[11px] text-slate-500 uppercase">
                    <th className="w-40 px-3 py-1 font-medium">KPI</th>

                    {matrixTab === "platform" &&
                      PLATFORMS.map((p) => (
                        <th key={p} className="px-3 py-1 font-medium">
                          {p}
                        </th>
                      ))}

                    {matrixTab === "format" &&
                      matrixFormat.map((f) => (
                        <th key={f.format} className="px-3 py-1 font-medium">
                          {f.format}
                        </th>
                      ))}

                    {matrixTab === "city" &&
                      matrixCity.map((c) => (
                        <th key={c.city} className="px-3 py-1 font-medium">
                          {c.city}
                        </th>
                      ))}
                  </tr>
                </thead>

                <tbody>
                  {[
                    { key: "totalDoh", label: "Frontend DOH" },
                    { key: "doiFeBe", label: "DOI (FE + BE)" },
                    { key: "doiBe", label: "DOI (BE only)" },
                  ].map((row) => (
                    <tr key={row.key}>
                      <td className="px-3 py-2 text-[11px] font-medium text-slate-600">
                        {row.label}
                      </td>

                      {matrixTab === "platform" &&
                        matrixPlatform.map((p) => {
                          const value =
                            row.key === "totalDoh"
                              ? p.totalDoh
                              : row.key === "doiFeBe"
                                ? p.doiFeBe
                                : p.doiBe;

                          return (
                            <td key={p.platform} className="px-3 py-1">
                              <KpiPill
                                value={formatDays(value)}
                                delta="vs LY"
                                health={p.health}
                                onClick={() =>
                                  openTrend(
                                    `${row.label} – ${p.platform}`,
                                    value,
                                    "days"
                                  )
                                }
                              />
                            </td>
                          );
                        })}

                      {matrixTab === "format" &&
                        matrixFormat.map((f) => {
                          const value =
                            row.key === "totalDoh"
                              ? f.totalDoh
                              : row.key === "doiFeBe"
                                ? f.doiFeBe
                                : f.doiBe;

                          return (
                            <td key={f.format} className="px-3 py-1">
                              <KpiPill
                                value={formatDays(value)}
                                delta="vs LY"
                                health={f.health}
                                onClick={() =>
                                  openTrend(
                                    `${row.label} – ${f.format}`,
                                    value,
                                    "days"
                                  )
                                }
                              />
                            </td>
                          );
                        })}

                      {matrixTab === "city" &&
                        matrixCity.map((c) => {
                          const value =
                            row.key === "totalDoh"
                              ? c.totalDoh
                              : row.key === "doiFeBe"
                                ? c.doiFeBe
                                : c.doiBe;

                          return (
                            <td key={c.city} className="px-3 py-1">
                              <KpiPill
                                value={formatDays(value)}
                                delta="vs LY"
                                health={c.health}
                                onClick={() =>
                                  openTrend(
                                    `${row.label} – ${c.city}`,
                                    value,
                                    "days"
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* FILTERS PANEL */}
        {/* <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm">
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>Filters</Typography>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <label className="mb-1 block text-slate-500">From date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-slate-500">To date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                DRR uplift %
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={drrUplift}
                  onChange={(e) => setDrrUplift(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
                <span className="w-10 text-right text-xs">{drrUplift}%</span>
              </div>
            </div>

            <MultiChipFilter
              label="Platform"
              options={PLATFORMS}
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
            />

            <MultiChipFilter
              label="Format"
              options={allFormats}
              selected={selectedFormats}
              onChange={setSelectedFormats}
            />

            <MultiChipFilter
              label="City"
              options={allCities}
              selected={selectedCities}
              onChange={setSelectedCities}
            />

            <div className="pt-1 text-[11px] text-slate-400">
              {filteredSkus.length === 0
                ? "No rows for current filters"
                : `${filteredSkus.length} SKU-city rows after filters`}
            </div>
          </div> */}
        {/* </div> */}

        {/* INVENTORY AT A GLANCE – HIERARCHY */}
        {/* <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
              Inventory at a glance
            </Typography>

            <SegmentToggle
              options={["Cities", "SKUs", "Formats"]}
              value={hierarchyMode}
              onChange={setHierarchyMode}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead>
                <tr className="text-[11px] text-slate-500 uppercase">
                  <th className="px-3 py-1">Hierarchy</th>
                  <th className="px-3 py-1">Platform</th>
                  <th className="px-3 py-1">City</th>
                  <th className="px-3 py-1">Format</th>
                  <th className="px-3 py-1">DOH</th>
                  <th className="px-3 py-1">PSL</th>
                </tr>
              </thead>

              <tbody>
                {filteredSkus.map((row) => (
                  <tr key={row.id} className="align-middle">
                    <td className="px-3 py-2 font-medium">{row.sku}</td>
                    <td className="px-3 py-2">{row.platform}</td>
                    <td className="px-3 py-2">{row.city}</td>
                    <td className="px-3 py-2">{row.format}</td>
                    <td className="px-3 py-2">
                      <KpiPill
                        value={formatDays(row.feDoh)}
                        health={
                          row.feDoh >= THRESHOLD_DOH
                            ? "healthy"
                            : row.feDoh >= THRESHOLD_DOH - 2
                              ? "watch"
                              : "action"
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] ${PSL_COLOR[row.psl]
                          }`}
                      >
                        {row.psl}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div> */}

        {/* INVENTORY SIGNALS */}
        {/* <div className="rounded-3xl bg-white p-4 shadow-sm">
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700, mb: 3 }}>
            Inventory Signals – City & SKU
          </Typography>

          <div className="grid gap-3 md:grid-cols-4">
            {filteredSkus
              .filter((r) => r.feDoh < THRESHOLD_DOH)
              .slice(0, 4)
              .map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col rounded-3xl border border-rose-100 bg-rose-50/40 p-3 text-xs"
                >
                  <div className="mb-1 font-semibold">{row.sku}</div>
                  <div className="text-[11px] text-slate-500">
                    {row.city} · {row.platform}
                  </div>

                  <div className="mt-2">
                    FE DOH:{" "}
                    <span className="font-semibold">
                      {formatDays(row.feDoh)}
                    </span>
                  </div>

                  <div className="mt-1 text-rose-600">
                    Gap to safety stock {(THRESHOLD_DOH - row.feDoh).toFixed(1)}{" "}
                    days
                  </div>

                  <button
                    onClick={() =>
                      openTrend(
                        `Inventory signal – ${row.sku}`,
                        row.feDoh,
                        "days"
                      )
                    }
                    className="mt-3 rounded-full bg-white px-3 py-1 text-[10px] shadow"
                  >
                    View DOH trend
                  </button>
                </div>
              ))}
          </div>
        </div> */}
      </div >

      <TrendModal
        context={trendContext}
        onClose={() => setTrendContext(null)}
      />

      <div className="mt-8 space-y-8">
        <InventoryDrill />
        <CitySkuInventoryDrill />
      </div>
    </div >
  );
}

export default InventeryConceptMain;
