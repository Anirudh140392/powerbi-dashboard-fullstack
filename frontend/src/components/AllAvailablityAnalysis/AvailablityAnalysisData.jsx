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
import OsaHeatmapTable from "./OsaDetailView";
import { SignalLabVisibility } from "../AllVisiblityAnalysis/SignalLabVisibility";
import {
  AvailabilityOverviewSkeleton,
  PlatformKpiMatrixSkeleton,
  OsaDetailViewSkeleton,
} from "./AvailabilitySkeletons";

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

// ---------------------------------------------------------------------------
// Floating Loader Component - Shows overlay while data is refreshing
// ---------------------------------------------------------------------------
const FloatingLoader = ({ loading = false, label = "Loading..." }) => {
  if (!loading) return null;

  return (
    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-3xl transition-opacity duration-200">
      <div className="flex items-center gap-3 bg-white/90 px-5 py-3 rounded-full shadow-lg border border-slate-200">
        <div className="relative">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-slate-700"></div>
        </div>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Error State Component - Shows when API fails with refresh button
// ---------------------------------------------------------------------------
const ErrorWithRefresh = ({ segmentName, errorMessage, onRetry, isRetrying = false }) => {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load {segmentName}</h3>
        <p className="text-sm text-slate-500 mb-4">{errorMessage || "An error occurred while fetching data"}</p>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
          ${isRetrying
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-600 text-white hover:bg-slate-700 shadow-md hover:shadow-lg'
          }`}
      >
        {isRetrying ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-500"></div>
            <span>Retrying...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </>
        )}
      </button>
    </div>
  );
};

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
              Absolute OSA · Light Theme · Motion-first UI
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setOlaMode("absolute")}
            className="rounded-full px-3 py-1 font-medium shadow-sm bg-slate-900 text-slate-50"
          >
            Absolute
          </button>
          <button
            onClick={() => setOlaMode("weighted")}
            className={`rounded-full px-3 py-1 font-medium 
              ${olaMode === "weighted"
                ? "bg-slate-900 text-slate-50 shadow-sm"
                : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
          >
            Weighted
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

const TabbedHeatmapTable = ({
  olaMode = "absolute",
  apiData,
  filters = {},
  onFiltersChange,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState("platform");

  // Check loading state - data is loading if apiData doesn't have the required property yet OR parent is loading
  const isPlatformLoading = loading || !apiData?.platformKpi;
  const isFormatLoading = loading || !apiData?.formatKpi;
  const isCityLoading = loading || !apiData?.cityKpi;

  // Transform API platformKpi data to component's expected format
  const transformApiData = (kpiData) => {
    if (!kpiData || !kpiData.columns || !kpiData.rows) return null;

    const columns = kpiData.columns.filter(c => c !== 'KPI');

    // Helper: generate sparkline series from current value and trend
    const generateSeries = (value, trend, pointCount = 4) => {
      if (value === undefined || value === null || value === 'Coming Soon') {
        return [];
      }
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      const numTrend = typeof trend === 'number' ? trend : 0;

      if (isNaN(numValue)) return [];

      // Work backwards from current value to show trend
      const points = [];
      const prevValue = numValue - numTrend;
      for (let i = 0; i < pointCount; i++) {
        const progress = i / (pointCount - 1);
        points.push(Math.round(prevValue + (numValue - prevValue) * progress));
      }
      return points;
    };

    const rows = kpiData.rows.map(row => {
      // Build series for each column
      const series = {};
      columns.forEach(col => {
        series[col] = generateSeries(row[col], row.trend?.[col]);
      });

      return {
        kpi: row.kpi,
        ...Object.fromEntries(columns.map(col => [col, row[col]])),
        trend: row.trend || {},
        series: series,
      };
    });

    return { columns: ['kpi', ...columns], rows };
  };

  // ---------------- PLATFORM (uses apiData.platformKpi) ----------------
  const platformData = transformApiData(apiData?.platformKpi);

  // ---------------- FORMAT (uses apiData.formatKpi) ----------------
  const formatData = transformApiData(apiData?.formatKpi);

  // ---------------- CITY (uses apiData.cityKpi) ----------------
  const cityData = transformApiData(apiData?.cityKpi);

  // ---------------- TABS ----------------
  const tabs = [
    { key: "platform", label: "Platform", data: platformData, loading: isPlatformLoading },
    { key: "format", label: "Format", data: formatData, loading: isFormatLoading },
    { key: "city", label: "City", data: cityData, loading: isCityLoading },
  ];

  const active = tabs.find((t) => t.key === activeTab);

  // If loading, show skeleton
  if (loading || (active.loading && !active.data)) {
    return <PlatformKpiMatrixSkeleton />;
  }

  return (
    <div className="relative rounded-3xl bg-white border shadow p-5 flex flex-col gap-4">
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
      <CityKpiTrendShowcase dynamicKey='availability' data={active.data} title={active.label} filters={filters} onFiltersChange={onFiltersChange} />
    </div>
  );
};


const PowerHierarchyHeat = ({ olaMode = "absolute" }) => {
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

              {FORMAT_MATRIX[olaMode].formatColumns.map((f) => (
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
            {FORMAT_MATRIX[olaMode].cityFormatData?.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800">{row.platform}</td>
                <td className="px-3 py-2 text-slate-700">{row.region}</td>
                <td className="px-3 py-2 text-slate-800 font-medium">
                  {row.city}
                </td>

                {FORMAT_MATRIX[olaMode].formatColumns.map((f) => {
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



const ProductLevelHeat = ({ olaMode = "absolute" }) => {
  const [expandedFormats, setExpandedFormats] = useState({});
  const [expandedProducts, setExpandedProducts] = useState({});

  const formats = useMemo(
    () => PRODUCT_MATRIX[olaMode].data.map((row) => row.format),
    []
  );

  // -------------------------------------------
  // Expand All / Collapse All
  // -------------------------------------------
  const expandAll = () => {
    const f = {};
    const p = {};

    PRODUCT_MATRIX[olaMode].data.forEach((row) => {
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
            Platform-Level OSA Drill
          </p>
          <p className="text-sm text-slate-600">
            Format → Product → Sales Loss drill-down.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 border rounded-full text-xs"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 border rounded-full text-xs"
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

              {PRODUCT_MATRIX[olaMode].formatColumns.map((f) => (
                <th key={f} className="px-3 py-2 text-center">
                  {f}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PRODUCT_MATRIX[olaMode].data.map((row) => {
              const formatOpen = expandedFormats[row.format];

              // calculate format level avg
              const formatAvg = {};
              PRODUCT_MATRIX[olaMode].formatColumns.forEach((f) => {
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

                    {PRODUCT_MATRIX[olaMode].formatColumns.map((f) => (
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

                            {PRODUCT_MATRIX[olaMode].formatColumns.map((f) => (
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

                              {PRODUCT_MATRIX[olaMode].formatColumns.map((f) => (
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

const OLADrillTable = ({ olaMode = "absolute" }) => {
  const [expandedPlatforms, setExpandedPlatforms] = useState({});
  const [expandedZones, setExpandedZones] = useState({});

  const platforms = useMemo(() => OLA_Detailed[olaMode].map((p) => p.platform), [olaMode]);

  const expandAll = () => {
    const p = {};
    const z = {};
    OLA_Detailed[olaMode].forEach((row) => {
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
            className="px-3 py-1 border rounded-full text-xs"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 border rounded-full text-xs"
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
            {OLA_Detailed[olaMode].map((p) => {
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

const FormatPerformanceStudio = ({ olaMode = "absolute" }) => {
  const [activeName, setActiveName] = useState(FORMAT_ROWS[olaMode][0]?.name);
  const [compareName, setCompareName] = useState(null);

  const active = useMemo(
    () => FORMAT_ROWS[olaMode].find((f) => f.name === activeName) ?? FORMAT_ROWS[olaMode][0],
    [activeName, olaMode]
  );
  const compare = useMemo(
    () =>
      compareName
        ? FORMAT_ROWS[olaMode].find((f) => f.name === compareName) ?? null
        : null,
    [compareName, olaMode]
  );
  const maxOfftakes = useMemo(
    () => Math.max(...FORMAT_ROWS[olaMode].map((f) => f.offtakes || 1)),
    [olaMode]
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
          {FORMAT_ROWS[olaMode].map((f) => {
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

const cardsAbsolute = [
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
    value: "Coming soon",
    sub: "Supplier fulfillment rate",
    change: "",
    changeColor: "gray",
    prevText: "",
    extra: "",
    extraChange: "",
    extraChangeColor: "gray",
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

const cardsWeighted = [
  {
    title: "Stock Availability",
    value: "79.8%",
    sub: "MTD on-shelf coverage",
    change: "▲2.7 pts (from 77.1%)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "High risk stores: 16",
    extraChange: "▼2 stores",
    extraChangeColor: "green",
  },
  {
    title: "Days of Inventory (DOI)",
    value: "58.1",
    sub: "Network average days of cover",
    change: "▼6.8% (from 62.3)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Target band: 55–65 days",
    extraChange: "Within target range",
    extraChangeColor: "green",
  },
  {
    title: "Fill Rate",
    value: "Coming soon",
    sub: "Supplier fulfillment rate",
    change: "",
    changeColor: "gray",
    prevText: "",
    extra: "",
    extraChange: "",
    extraChangeColor: "gray",
  },
  {
    title: "Metro City Stock Availability",
    value: "73.1%",
    sub: "MTD availability across metro cities",
    change: "▼2.8 pts (from 75.9%)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Top 10 stores: 79.6%",
    extraChange: "▲0.4 pts",
    extraChangeColor: "green",
  }
];

const cards = {
  absolute: cardsAbsolute,
  weighted: cardsWeighted
};


// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------
export const AvailablityAnalysisData = ({
  apiData,
  apiErrors = {},
  onRetry,
  filters = {},
  onFiltersChange,
  loading = false,
}) => {
  const [olaMode, setOlaMode] = useState("absolute");
  const [availability, setAvailability] = useState("absolute");

  // Build dynamic cards from API data with proper time period
  const getDynamicCards = (mode) => {
    const baseCards = mode === "absolute" ? cardsAbsolute : cardsWeighted;

    // Generate sparkline data based on a value and previous value
    const generateSparklineFromValue = (currentValue, prevValue, pointCount = 7) => {
      const variance = currentValue * 0.05; // 5% variance for realistic look
      const points = [];

      for (let i = 0; i < pointCount; i++) {
        const progress = i / (pointCount - 1);
        const trendValue = prevValue + (currentValue - prevValue) * progress;
        const noise = (Math.random() - 0.5) * variance;
        points.push(Math.max(0, trendValue + noise));
      }

      // Ensure last point is the actual value
      points[points.length - 1] = currentValue;

      return points.map(v => Math.round(v * 10) / 10);
    };

    // Get API values
    const stockAvail = apiData?.overview?.stockAvailability;
    const prevStockAvail = apiData?.overview?.prevStockAvailability || (stockAvail ? stockAvail - 3.1 : null);

    const doi = apiData?.doi?.doi;
    const prevDoi = apiData?.doi?.prevDoi;
    const doiChangePercent = apiData?.doi?.changePercent;

    // Get Metro City Stock Availability values
    const metroCity = apiData?.metroCity;
    const metroStockAvail = metroCity?.stockAvailability;
    const prevMetroStockAvail = metroCity?.prevStockAvailability;
    const metroChange = metroCity?.change;
    const isMetroCity = metroCity?.isMetroCity;

    return baseCards.map(card => {
      // Stock Availability card
      if (card.title === "Stock Availability" && stockAvail !== undefined && stockAvail !== null) {
        const safePrevStockAvail = prevStockAvail ?? stockAvail; // fallback to current if prev is null
        const change = stockAvail - safePrevStockAvail;
        const changeArrow = change >= 0 ? "▲" : "▼";
        const changeColor = change >= 0 ? "green" : "red";
        const changeText = `${changeArrow}${Math.abs(change).toFixed(1)} pts (from ${safePrevStockAvail.toFixed(1)}%)`;

        return {
          ...card,
          value: `${stockAvail}%`,
          sub: `MTD on-shelf coverage (${apiData.overview.filters?.platform || 'All'})`,
          change: changeText,
          changeColor: changeColor,
          sparklineData: generateSparklineFromValue(stockAvail, safePrevStockAvail),
          startDate: filters.startDate,
          endDate: filters.endDate,
        };
      }

      // DOI (Days of Inventory) card
      if (card.title === "Days of Inventory (DOI)" && doi !== undefined) {
        const change = doiChangePercent || 0;
        const changeArrow = change < 0 ? "▼" : "▲"; // For DOI, lower is often better
        // For DOI, decrease (▼) is green (good), increase (▲) is red (bad)
        const changeColor = change < 0 ? "green" : "red";
        const changeText = `${changeArrow}${Math.abs(change).toFixed(1)}% (from ${prevDoi?.toFixed(1) || 'N/A'})`;

        return {
          ...card,
          value: doi.toFixed(1),
          sub: `Network average days of cover`,
          change: changeText,
          changeColor: changeColor,
          sparklineData: generateSparklineFromValue(doi, prevDoi || doi * 1.1),
          startDate: filters.startDate,
          endDate: filters.endDate,
        };
      }

      // Metro City Stock Availability card
      if (card.title === "Metro City Stock Availability") {
        // If metroCity data is available and the location is a metro city (or All)
        if (metroCity && isMetroCity !== false && metroStockAvail !== null && metroStockAvail !== undefined) {
          const safeMetroChange = metroChange ?? 0;
          const safePrevMetroStockAvail = prevMetroStockAvail ?? metroStockAvail;
          const changeArrow = safeMetroChange >= 0 ? "▲" : "▼";
          const changeColor = safeMetroChange >= 0 ? "green" : "red";
          const changeText = `${changeArrow}${Math.abs(safeMetroChange).toFixed(1)} pts (from ${safePrevMetroStockAvail.toFixed(1)}%)`;

          return {
            ...card,
            value: `${metroStockAvail}%`,
            sub: `MTD availability across metro cities`,
            change: changeText,
            changeColor: changeColor,
            prevText: "vs Comparison Period",
            extra: metroCity.metroCitiesCount ? `Tier 1 cities tracked: ${metroCity.metroCitiesCount}` : card.extra,
            extraChange: "",
            extraChangeColor: "green",
            sparklineData: generateSparklineFromValue(metroStockAvail, safePrevMetroStockAvail),
            startDate: filters.startDate,
            endDate: filters.endDate,
          };
        } else if (metroCity && isMetroCity === false) {
          // User selected a non-metro city location - show Not A Metro City
          return {
            ...card,
            value: "Not A Metro City",
            sub: "Selected location is not a Tier 1 city",
            change: "",
            changeColor: "gray",
            prevText: "",
            extra: "Only available for Tier 1 (metro) cities",
            extraChange: "",
            extraChangeColor: "gray",
            startDate: filters.startDate,
            endDate: filters.endDate,
          };
        }

        // Keep default card when no API data yet
        return {
          ...card,
          startDate: filters.startDate,
          endDate: filters.endDate,
        };
      }

      // Pass date range to all other cards for consistent chart months
      return {
        ...card,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    });
  };



  // Filters for segments that ignore platform/brand/location header selections
  const pblUnfilteredFilters = {
    ...filters,
    platform: 'All',
    brand: 'All',
    location: 'All',
  };

  // KPI Matrix strictly ignores EVERYTHING (including Time as per initial request)
  const matrixUnfilteredFilters = {
    ...pblUnfilteredFilters,
    startDate: null,
    endDate: null
  };

  return (

    <div className="max-w-7xl mx-auto space-y-5">
      <div className="space-y-4">
        {/* <OlaLightThemeDashboard setOlaMode={setOlaMode} olaMode={olaMode} /> */}

        {/* AVAILABILITY MODE - Only Absolute (Weighted option removed) */}

        {/* Availability Overview - show skeleton if loading, error if failed */}
        {loading ? (
          <AvailabilityOverviewSkeleton />
        ) : apiErrors.overview ? (
          <ErrorWithRefresh
            segmentName="Availability Overview"
            errorMessage={apiErrors.overview}
            onRetry={() => onRetry?.('overview')}
          />
        ) : (
          <MetricCardContainer title="Availability Overview" cards={getDynamicCards(availability)} loading={loading} />
        )}

        {/* <SignalLabVisibility type="availability" /> */}

        {/* Platform KPI Matrix - show error if any matrix API failed */}
        {apiErrors.platformKpi || apiErrors.formatKpi || apiErrors.cityKpi ? (
          <ErrorWithRefresh
            segmentName="Platform KPI Matrix"
            errorMessage={apiErrors.platformKpi || apiErrors.formatKpi || apiErrors.cityKpi}
            onRetry={() => {
              if (apiErrors.platformKpi) onRetry?.('platformKpi');
              if (apiErrors.formatKpi) onRetry?.('formatKpi');
              if (apiErrors.cityKpi) onRetry?.('cityKpi');
            }}
          />
        ) : (
          <TabbedHeatmapTable
            olaMode={availability}
            apiData={apiData}
            filters={matrixUnfilteredFilters}
            onFiltersChange={onFiltersChange}
            loading={loading}
          />
        )}

        {/* OSA Detail View - show skeleton if loading, error if failed */}
        {loading ? (
          <OsaDetailViewSkeleton />
        ) : apiErrors.osaDetail ? (
          <ErrorWithRefresh
            segmentName="OSA % Detail View"
            errorMessage={apiErrors.osaDetail}
            onRetry={() => onRetry?.('osaDetail')}
          />
        ) : (
          <OsaHeatmapTable
            olaMode={availability}
            filters={pblUnfilteredFilters}
            initialLoading={loading}
          />
        )}

      </div>
    </div>
  );
};

// Dual-axis drill matrix exported for reuse
const DualAxisDrillMatrix = () => {
  return <MatrixPlatformFormat />;
};

export default AvailablityAnalysisData;
