import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CityKpiTrendShowcase from "@/components/CityKpiTrendShowcase.jsx";
import {
  DRILL_COLUMNS,
  FORMAT_MATRIX,
  FORMAT_ROWS,
  OLA_Detailed,
  ONE_VIEW_DRILL_DATA,
  PRODUCT_MATRIX,
} from "./availablityDataCenter";
import MetricCardContainer from "../CommonLayout/MetricCardContainer";
import SimpleTableWithTabs from "../CommonLayout/SimpleTableWithTabs";
import DrillHeatTable from "../CommonLayout/DrillHeatTable";
import KpiTrendShowcase from "./KpiTrendShowcase";
import { SignalLabVisibility } from "../AllVisiblityAnalysis/SignalLabVisibility";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const cellHeat = (value) => {
  if (value >= 95) return "bg-emerald-100 text-emerald-900";
  if (value >= 85) return "bg-emerald-50 text-emerald-800";
  if (value >= 75) return "bg-amber-50 text-amber-800";
  return "bg-rose-50 text-rose-800";
};

const average = (values) =>
  values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;

const avgForKeys = (rows) => (rows.length ? Math.round(average(rows)) : 0);

const formatNumber = (value) =>
  Number.isFinite(value) ? value.toLocaleString("en-IN") : "NaN";
const pct = (value) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "NaN";
const clamp01 = (value) => Math.max(0, Math.min(1, value));

const OlaLightThemeDashboard = ({ setOlaMode, olaMode }) => {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-slate-50 flex items-center justify-center text-xs font-semibold tracking-tight">
            OLA
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Availability Control Tower
            </h1>
            <p className="text-xs text-slate-500">
              Absolute OLA · Light Theme · Motion-first UI
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setOlaMode("absolute")}
            className={`rounded-full px-3 py-1 font-medium shadow-sm 
              ${olaMode === "absolute"
                ? "bg-slate-900 text-slate-50"
                : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
          >
            Absolute OLA
          </button>

          <button
            onClick={() => setOlaMode("weighted")}
            className={`rounded-full px-3 py-1 font-medium 
              ${olaMode === "weighted"
                ? "bg-slate-900 text-slate-50 shadow-sm"
                : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
          >
            Weighted OLA
          </button>

          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Last sync: 5 min ago</span>
          </div>
        </div>
      </header>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Platform Level OLA Across Platform (driven by OLA_MATRIX)
// ---------------------------------------------------------------------------

const TabbedHeatmapTable = () => {
  const [activeTab, setActiveTab] = useState("platform");

  // 🔥 Utility to compute unified trend + series for ANY item
  const buildRows = (dataArray, columnList) => {
    return dataArray.map((item) => {
      const primaryTrendSeries = item.trend?.["Spend"] || [];
      const valid = primaryTrendSeries.length >= 2;

      const lastVal = valid ? primaryTrendSeries[primaryTrendSeries.length - 1] : 0;
      const prevVal = valid ? primaryTrendSeries[primaryTrendSeries.length - 2] : 0;

      const globalDelta = Number((lastVal - prevVal).toFixed(1));

      const trendObj = {};
      const seriesObj = {};

      columnList.forEach((col) => {
        trendObj[col] = globalDelta;              // 🔥 apply SAME delta to every column
        seriesObj[col] = primaryTrendSeries;      // 🔥 sparkline same for each column
      });

      return {
        kpi: item.kpi,
        ...item.values,
        trend: trendObj,
        series: seriesObj,
      };
    });
  };

  // ---------------- PLATFORM ----------------
  const platformData = {
    columns: ["kpi", ...FORMAT_MATRIX.PlatformColumns],
    rows: buildRows(FORMAT_MATRIX.PlatformData, FORMAT_MATRIX.PlatformColumns),
  };

  // ---------------- FORMAT ----------------
  const formatData = {
    columns: ["kpi", ...FORMAT_MATRIX.formatColumns],
    rows: buildRows(FORMAT_MATRIX.FormatData, FORMAT_MATRIX.formatColumns),
  };

  // ---------------- CITY ----------------
  const cityData = {
    columns: ["kpi", ...FORMAT_MATRIX.CityColumns],
    rows: buildRows(FORMAT_MATRIX.CityData, FORMAT_MATRIX.CityColumns),
  };

  // ---------------- TABS ----------------
  const tabs = [
    { key: "platform", label: "Platform", data: platformData },
    { key: "format", label: "Format", data: formatData },
    { key: "city", label: "City", data: cityData },
  ];

  const active = tabs.find((t) => t.key === activeTab);

  return (
    <div className="rounded-3xl bg-white border shadow p-5 flex flex-col gap-4">

      {/* -------- TABS -------- */}
      <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-max">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-full transition-all 
              ${activeTab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* -------- MATRIX TABLE -------- */}
      <CityKpiTrendShowcase dynamicKey='availability' data={active.data} title={active.label} />
    </div>
  );
};


const PowerHierarchyHeat = () => {
  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(15,23,42,0.08)] p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Platform-Level Format Heatmap
          </p>
          <p className="text-sm text-slate-600">
            Flat table without hierarchy (Platform → Region → City).
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold text-slate-600">
                Platform
              </th>
              <th className="px-3 py-2 font-semibold text-slate-600">Region</th>
              <th className="px-3 py-2 font-semibold text-slate-600">City</th>

              {FORMAT_MATRIX.formatColumns.map((f) => (
                <th
                  key={f}
                  className="px-3 py-2 font-semibold text-center text-slate-600 whitespace-nowrap"
                >
                  {f}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {FORMAT_MATRIX.cityFormatData.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800">{row.platform}</td>
                <td className="px-3 py-2 text-slate-700">{row.region}</td>
                <td className="px-3 py-2 text-slate-800 font-medium">
                  {row.city}
                </td>

                {FORMAT_MATRIX.formatColumns.map((f) => {
                  const val = row.values[f] ?? 0;
                  return (
                    <td key={f} className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded ${cellHeat(val)}`}>
                        {val}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProductLevelHeat = () => {
  const [expandedFormats, setExpandedFormats] = useState({});
  const [expandedProducts, setExpandedProducts] = useState({});

  const formats = useMemo(
    () => PRODUCT_MATRIX.data.map((row) => row.format),
    []
  );

  // -------------------------------------------
  // Expand All / Collapse All
  // -------------------------------------------
  const expandAll = () => {
    const f = {};
    const p = {};

    PRODUCT_MATRIX.data.forEach((row) => {
      f[row.format] = true;
      row.products.forEach((prod) => {
        p[`${row.format}|${prod.sku}`] = true;
      });
    });

    setExpandedFormats(f);
    setExpandedProducts(p);
  };

  const collapseAll = () => {
    setExpandedFormats({});
    setExpandedProducts({});
  };

  // dynamic hierarchy width (Format → Product)
  const showProductColumn = Object.values(expandedFormats).some(Boolean);
  const showLossColumn = Object.values(expandedProducts).some(Boolean);
  const hierarchyColSpan = 1 + (showProductColumn ? 1 : 0);

  return (
    <div className="rounded-3xl bg-white border shadow p-5 flex flex-col gap-3">
      {/* ---------------- HEADER ---------------- */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Product Level OLA
          </p>
          <p className="text-sm text-slate-600">
            Format → Product → Sales Loss drill-down.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 border rounded-full text-sm"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 border rounded-full text-sm"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ---------------- TABLE ---------------- */}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 w-40">Format</th>

              {showProductColumn && <th className="px-3 py-2 w-52">Product</th>}

              {PRODUCT_MATRIX.formatColumns.map((f) => (
                <th key={f} className="px-3 py-2 text-center">
                  {f}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PRODUCT_MATRIX.data.map((row) => {
              const formatOpen = expandedFormats[row.format];

              // calculate format level avg
              const formatAvg = {};
              PRODUCT_MATRIX.formatColumns.forEach((f) => {
                const vals = row.products.map((p) => p.values[f] ?? 0);
                formatAvg[f] = vals.length
                  ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
                  : 0;
              });

              return (
                <React.Fragment key={row.format}>
                  {/* ---------------- FORMAT ROW ---------------- */}
                  <tr className="bg-slate-50/70 border-t">
                    <td
                      className="px-3 py-2 font-semibold"
                      colSpan={hierarchyColSpan}
                    >
                      <button
                        onClick={() =>
                          setExpandedFormats((prev) => ({
                            ...prev,
                            [row.format]: !formatOpen,
                          }))
                        }
                        className="mr-2 text-slate-600"
                      >
                        {formatOpen ? "-" : "+"}
                      </button>
                      {row.format}
                    </td>

                    {PRODUCT_MATRIX.formatColumns.map((f) => (
                      <td key={f} className="px-3 py-2 text-center">
                        <span
                          className={`px-2 py-1 rounded ${cellHeat(
                            formatAvg[f]
                          )}`}
                        >
                          {formatAvg[f]}%
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* ---------------- PRODUCT ROWS ---------------- */}
                  {formatOpen &&
                    row.products.map((p) => {
                      const key = `${row.format}|${p.sku}`;
                      const prodOpen = expandedProducts[key];

                      return (
                        <React.Fragment key={key}>
                          <tr className="border-t">
                            <td className="px-3 py-2 text-slate-400">
                              {row.format}
                            </td>

                            {showProductColumn && (
                              <td className="px-3 py-2 font-medium">
                                <button
                                  onClick={() =>
                                    setExpandedProducts((prev) => ({
                                      ...prev,
                                      [key]: !prodOpen,
                                    }))
                                  }
                                  className="mr-2 text-slate-500"
                                >
                                  {prodOpen ? "-" : "+"}
                                </button>
                                {p.name}
                              </td>
                            )}

                            {PRODUCT_MATRIX.formatColumns.map((f) => (
                              <td key={f} className="px-3 py-2 text-center">
                                <span
                                  className={`px-2 py-1 rounded ${cellHeat(
                                    p.values[f]
                                  )}`}
                                >
                                  {p.values[f]}%
                                </span>
                              </td>
                            ))}
                          </tr>

                          {/* ---------------- SALES LOSS ROW ---------------- */}
                          {prodOpen && (
                            <tr className="bg-slate-100 border-t">
                              <td></td>

                              {showProductColumn && (
                                <td className="px-3 py-2 text-slate-600 font-medium">
                                  Sales Loss
                                </td>
                              )}

                              {PRODUCT_MATRIX.formatColumns.map((f) => (
                                <td key={f} className="px-3 py-2 text-center">
                                  {p.losses[f]}
                                </td>
                              ))}
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OLADrillTable = () => {
  const [expandedPlatforms, setExpandedPlatforms] = useState({});
  const [expandedZones, setExpandedZones] = useState({});

  const platforms = useMemo(() => OLA_Detailed.map((p) => p.platform), []);

  const expandAll = () => {
    const p = {};
    const z = {};
    OLA_Detailed.forEach((row) => {
      p[row.platform] = true;
      row.zones.forEach((zone) => {
        z[`${row.platform}|${zone.zone}`] = true;
      });
    });
    setExpandedPlatforms(p);
    setExpandedZones(z);
  };

  const collapseAll = () => {
    setExpandedPlatforms({});
    setExpandedZones({});
  };

  // 🔥 Correct column visibility logic
  const anyPlatformOpen = Object.values(expandedPlatforms).some(Boolean);
  const anyZoneOpen = Object.values(expandedZones).some(Boolean);

  const showZoneColumn = anyPlatformOpen;
  const showCityColumn = anyZoneOpen;

  const hierarchyColSpan =
    1 + (showZoneColumn ? 1 : 0) + (showCityColumn ? 1 : 0);

  return (
    <div className="rounded-3xl bg-white border shadow p-5 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          OLA % — Detailed View
        </p>

        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1 border rounded-full text-sm"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 border rounded-full text-sm"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Platform</th>
              {showZoneColumn && <th className="px-3 py-2 text-left">Zone</th>}
              {showCityColumn && <th className="px-3 py-2 text-left">City</th>}
              <th className="px-3 py-2 text-center">2025</th>
            </tr>
          </thead>

          <tbody>
            {OLA_Detailed.map((p) => {
              const platformOpen = expandedPlatforms[p.platform];

              const platformAvg = Math.round(
                p.zones.reduce((a, z) => a + (z.ola ?? 0), 0) / p.zones.length
              );

              return (
                <React.Fragment key={p.platform}>
                  {/* ---------------- PLATFORM ROW ---------------- */}
                  <tr className="bg-slate-50 border-t">
                    <td
                      className="px-3 py-2 font-semibold"
                      colSpan={hierarchyColSpan}
                    >
                      <button
                        onClick={() =>
                          setExpandedPlatforms((prev) => ({
                            ...prev,
                            [p.platform]: !platformOpen,
                          }))
                        }
                        className="mr-2"
                      >
                        {platformOpen ? "-" : "+"}
                      </button>
                      {p.platform}
                    </td>

                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded ${cellHeat(platformAvg)}`}
                      >
                        {platformAvg}%
                      </span>
                    </td>
                  </tr>

                  {/* ---------------- ZONE ROWS ---------------- */}
                  {platformOpen &&
                    p.zones.map((z) => {
                      const zoneKey = `${p.platform}|${z.zone}`;
                      const zoneOpen = expandedZones[zoneKey];
                      const hasCities = z.cities?.length > 0;

                      return (
                        <React.Fragment key={zoneKey}>
                          <tr className="border-t">
                            <td className="px-3 py-2 text-slate-400">
                              {p.platform}
                            </td>

                            {showZoneColumn && (
                              <td className="px-3 py-2 font-semibold">
                                {hasCities && (
                                  <button
                                    onClick={() =>
                                      setExpandedZones((prev) => ({
                                        ...prev,
                                        [zoneKey]: !zoneOpen,
                                      }))
                                    }
                                    className="mr-2 text-slate-500"
                                  >
                                    {zoneOpen ? "-" : "+"}
                                  </button>
                                )}
                                {z.zone}
                              </td>
                            )}

                            {showCityColumn && <td className="px-3 py-2"></td>}

                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-1 rounded ${cellHeat(
                                  z.ola
                                )}`}
                              >
                                {z.ola}%
                              </span>
                            </td>
                          </tr>

                          {/* ---------------- CITY ROWS ---------------- */}
                          {zoneOpen &&
                            hasCities &&
                            z.cities.map((c) => (
                              <tr key={c.city} className="bg-slate-50 border-t">
                                <td className="px-3 py-2 text-slate-300">
                                  {p.platform}
                                </td>

                                {showZoneColumn && (
                                  <td className="px-3 py-2 text-slate-300">
                                    {z.zone}
                                  </td>
                                )}

                                {showCityColumn && (
                                  <td className="px-3 py-2 font-medium">
                                    {c.city}
                                  </td>
                                )}

                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`px-2 py-1 rounded ${cellHeat(
                                      c.ola
                                    )}`}
                                  >
                                    {c.ola}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Format VS studio (same as your version, left static for now)
// ---------------------------------------------------------------------------

const FormatPerformanceStudio = () => {
  const [activeName, setActiveName] = useState(FORMAT_ROWS[0]?.name);
  const [compareName, setCompareName] = useState(null);

  const active = useMemo(
    () => FORMAT_ROWS.find((f) => f.name === activeName) ?? FORMAT_ROWS[0],
    [activeName]
  );
  const compare = useMemo(
    () =>
      compareName
        ? FORMAT_ROWS.find((f) => f.name === compareName) ?? null
        : null,
    [compareName]
  );
  const maxOfftakes = useMemo(
    () => Math.max(...FORMAT_ROWS.map((f) => f.offtakes || 1)),
    []
  );

  const kpiBands = [
    {
      key: "roas",
      label: "ROAS",
      activeValue: active.roas,
      compareValue: compare?.roas ?? null,
      max: 15,
      format: (v) => `${v.toFixed(1)}x`,
    },
    {
      key: "inorg",
      label: "Inorg sales",
      activeValue: active.inorgSalesPct,
      compareValue: compare?.inorgSalesPct ?? null,
      max: 100,
      format: pct,
    },
    {
      key: "conv",
      label: "Conversion",
      activeValue: active.conversionPct,
      compareValue: compare?.conversionPct ?? null,
      max: 15,
      format: pct,
    },
    {
      key: "ms",
      label: "Market share",
      activeValue: active.marketSharePct,
      compareValue: compare?.marketSharePct ?? null,
      max: 30,
      format: pct,
    },
    {
      key: "cpm",
      label: "CPM",
      activeValue: active.cpm,
      compareValue: compare?.cpm ?? null,
      max: 800,
      format: (v) => v.toFixed(0),
    },
    {
      key: "cpc",
      label: "CPC",
      activeValue: active.cpc,
      compareValue: compare?.cpc ?? null,
      max: 5000,
      format: (v) => (Number.isFinite(v) ? v.toFixed(0) : "Infinity"),
    },
  ];

  return (
    <motion.div
      className="rounded-3xl bg-white/70 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-sky-900/5 p-4 lg:p-6 grid grid-cols-1 md:grid-cols-5 gap-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Category performance</h2>
            <p className="text-xs text-slate-500">
              Hover a format to see its DNA. Click a pill below to compare.
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {FORMAT_ROWS.map((f) => {
            const intensity = clamp01(f.offtakes / maxOfftakes);
            const isActive = f.name === activeName;
            return (
              <motion.button
                key={f.name}
                onMouseEnter={() => setActiveName(f.name)}
                onClick={() => setActiveName(f.name)}
                className={`w-full flex items-center justify-between rounded-2xl px-3 py-2 text-xs border ${isActive
                  ? "border-sky-400 bg-sky-50 shadow-sm"
                  : "border-slate-200 bg-white/70 hover:bg-slate-50"
                  }`}
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] flex items-center justify-center text-white shadow-md"
                    style={{ opacity: 0.3 + intensity * 0.7 }}
                  >
                    {f.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-[10px] text-slate-500">
                      Offtakes {f.offtakes} · ROAS {f.roas.toFixed(1)}x
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end text-[10px] text-slate-500">
                  <span>MS {f.marketSharePct}%</span>
                  <span>Conv {f.conversionPct}%</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="md:col-span-3 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.name + (compare?.name ?? "")}
            className="h-full rounded-3xl bg-gradient-to-br from-sky-100 via-white to-indigo-50 border border-slate-200/70 shadow-lg p-4 lg:p-6 flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-sky-500">
                  {compare ? "Focus format · VS mode" : "Focus format"}
                </div>
                <div className="text-xl font-semibold">
                  {active.name}
                  {compare && (
                    <span className="text-sm font-normal text-slate-500">
                      {" "}
                      vs {compare.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Offtakes, ROAS, conversion and share in one view.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <div className="text-[10px] text-slate-500">Offtakes</div>
                <div className="text-lg font-semibold">
                  {formatNumber(active.offtakes)}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Market share
                </div>
                <div className="text-sm font-medium">
                  {active.marketSharePct}%
                </div>
                {compare && (
                  <div className="mt-1 text-[10px] text-rose-500">
                    Delta ROAS{" "}
                    {Number.isFinite(compare.roas)
                      ? (active.roas - compare.roas).toFixed(1)
                      : "-"}
                    x vs {compare.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth="8"
                    fill="none"
                  />
                  {compare && Number.isFinite(compare.roas) && (
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#a855f7"
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: clamp01(compare.roas / 12) }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      style={{ transformOrigin: "50% 50%", rotate: "-90deg" }}
                      opacity={0.6}
                    />
                  )}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="url(#roasGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: clamp01(active.roas / 12) }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ transformOrigin: "50% 50%", rotate: "-90deg" }}
                  />
                  <defs>
                    <linearGradient
                      id="roasGradient"
                      x1="0"
                      x2="1"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
                  <div className="text-[10px] text-slate-500">ROAS</div>
                  <div className="text-lg font-semibold">
                    {active.roas.toFixed(1)}x
                  </div>
                  {compare && (
                    <div className="text-[9px] text-violet-600 mt-0.5">
                      vs {compare.roas.toFixed(1)}x
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {kpiBands.map((k) => {
                  const activeRatio = clamp01(k.activeValue / k.max);
                  const compareRatio =
                    k.compareValue != null
                      ? clamp01(k.compareValue / k.max)
                      : null;
                  return (
                    <div key={k.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{k.label}</span>
                        <div className="flex items-center gap-2">
                          {compareRatio != null &&
                            Number.isFinite(k.compareValue) && (
                              <span className="text-[10px] text-violet-600">
                                {k.format(k.compareValue)}
                              </span>
                            )}
                          <span className="font-medium">
                            {Number.isFinite(k.activeValue)
                              ? k.format(k.activeValue)
                              : "NaN"}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-white/80 overflow-hidden relative">
                        {compareRatio != null && (
                          <motion.div
                            className="absolute inset-y-[3px] left-0 rounded-full bg-violet-300/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${compareRatio * 100}%` }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                          />
                        )}
                        <motion.div
                          className="relative h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${activeRatio * 100}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 justify-center">
              {FORMAT_ROWS.map((f) => {
                const weight = clamp01(f.roas / 12);
                const isCompare = compareName === f.name;
                const isActive = activeName === f.name;
                return (
                  <motion.button
                    key={f.name}
                    onClick={() =>
                      setCompareName((prev) =>
                        prev === f.name ? null : f.name
                      )
                    }
                    className={`px-4 py-2 rounded-full text-[11px] border backdrop-blur-sm flex items-center gap-2 ${isCompare
                      ? "border-violet-500 bg-violet-50 shadow-sm"
                      : "border-slate-200 bg-white/80 hover:bg-slate-50"
                      }`}
                    whileHover={{ y: -2 }}
                  >
                    <div
                      className="h-2 w-10 rounded-full"
                      style={{
                        background: `linear-gradient(to right, rgba(14,165,233,${0.3 + weight * 0.4
                          }), rgba(99,102,241,${0.2 + weight * 0.5}))`,
                      }}
                    />
                    <span
                      className={`truncate ${isActive ? "font-semibold" : "font-normal"
                        }`}
                    >
                      {f.name}
                    </span>
                    {isCompare && (
                      <span className="text-[9px] text-violet-600">VS</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const cards = [
  {
    title: "Stock Availability",
    value: "85.2%",
    sub: "MTD on-shelf coverage",
    change: "▲3.1 pts (from 82.1%)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "High risk stores: 12",
    extraChange: "▼4 stores",
    extraChangeColor: "green",
  },
  {
    title: "Days of Inventory (DOI)",
    value: "62.4",
    sub: "Network average days of cover",
    change: "▼5.3% (from 65.9)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Target band: 55–65 days",
    extraChange: "Within target range",
    extraChangeColor: "green",
  },
  {
    title: "Fill Rate",
    value: "93.7%",
    sub: "Supplier fulfillment rate",
    change: "▲1.8 pts (from 91.9%)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Orders delayed: 6%",
    extraChange: "▼1.2 pts",
    extraChangeColor: "green",
  },
  {
    title: "Metro City Stock Availability",
    value: "78.5%",
    sub: "MTD availability across metro cities",
    change: "▼2.0 pts (from 80.5%)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Top 10 stores: 84.2%",
    extraChange: "▲0.6 pts",
    extraChangeColor: "green",
  }
];


// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------
export const AvailablityAnalysisData = () => {
  const [olaMode, setOlaMode] = useState("absolute");
  const [availability, setAvailability] = useState("absolute");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-white to-slate-50 text-slate-900 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="space-y-4">
          {/* <OlaLightThemeDashboard setOlaMode={setOlaMode} olaMode={olaMode} /> */}

          {/* MARKET SHARE TOGGLE BLOCK */}
          {/* AVAILABILITY TOGGLE BLOCK */}
          <div className="flex justify-center">
            <div className="relative w-full md:w-[420px]">
              <div className="relative flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                <motion.div
                  layout
                  className="absolute top-1 bottom-1 w-1/2 rounded-full bg-white shadow-sm"
                  initial={false}
                  animate={{ x: availability === "absolute" ? 0 : "100%" }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                />

                {[
                  { key: "absolute", label: "Absolute OLA" },
                  { key: "weighted", label: "Weighted OLA" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAvailability(option.key)}
                    className={`relative z-10 flex-1 rounded-full px-3 py-2 transition-colors ${availability === option.key
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>




          <MetricCardContainer title="Availability Overview" cards={cards} />
          <SignalLabVisibility type="availability" />
          <TabbedHeatmapTable />
          <DrillHeatTable
            title="One View Drilldown"
            data={ONE_VIEW_DRILL_DATA}
            columns={DRILL_COLUMNS}
            computeQuarterValues={(vals) => vals}
            computeRowAvg={() => 0}
            getHeatStyle={(v) => ({
              bg: v > 85 ? "#c6f6d5" : "#fed7d7",
              color: "#111",
            })}
            levels={["Platform", "Zone", "City", "Product", "ID"]}
          />
        </div>
      </div>
    </div>
  );
};

// Dual-axis drill matrix exported for reuse
const DualAxisDrillMatrix = () => {
  return <MatrixPlatformFormat />;
};

export default AvailablityAnalysisData;
