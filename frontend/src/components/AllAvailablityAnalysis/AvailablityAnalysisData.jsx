import React, { useMemo, useState, useContext, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CityKpiTrendShowcase from "@/components/CityKpiTrendShowcase.jsx";
import {
  DRILL_COLUMNS,
  FORMAT_MATRIX,
  FORMAT_ROWS,
  OLA_Detailed,
  ONE_VIEW_DRILL_DATA,
  PRODUCT_MATRIX,
  getLogicalKpiValue,
  getLogicalKpiTrend
} from "./availablityDataCenter";
import SimpleTableWithTabs from "../CommonLayout/SimpleTableWithTabs";
import DrillHeatTable from "../CommonLayout/DrillHeatTable";
import KpiTrendShowcase from "./KpiTrendShowcase";
import OsaHeatmapTable from "./OsaDetailView";
import { SignalLabVisibility } from "../AllVisiblityAnalysis/SignalLabVisibility";
import SnapshotOverview from "../CommonLayout/SnapshotOverview";
import {
  Layers,
  Package,
  Zap,
  MapPin,
  LayoutGrid
} from "lucide-react";
import { FilterContext } from "../../utils/FilterContext";
import {
  AvailabilityOverviewSkeleton,
  PlatformKpiMatrixSkeleton,
  OsaDetailViewSkeleton
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
            className={`rounded-full px-3 py-1 font-medium shadow-sm 
              ${olaMode === "absolute"
                ? "bg-slate-900 text-slate-50"
                : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
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

const TabbedHeatmapTable = ({ olaMode = "absolute", loading = false, apiData, onFiltersChange }) => {
  const [activeTab, setActiveTab] = useState("platform");
  const {
    selectedChannel,
    platform: globalPlatform,
    platforms: channelPlatforms,
    selectedBrand,
    selectedLocation,
    timeStart,
    timeEnd
  } = useContext(FilterContext);

  // 🔥 Utility to compute unified trend + series for ANY item
  const buildRows = (dataArray, columnList, context = {}) => {
    return dataArray.map((item) => {
      const trendObj = {};
      const seriesObj = {};

      // Create a shallow copy of the item and a deep copy of values to avoid mutating the shared constant
      const newItem = { ...item, values: { ...item.values } };

      columnList.forEach((col) => {
        const seed = { ...context, kpi: item.kpi, col };
        const randomVal = getLogicalKpiValue(item.kpi, seed);
        const randomTrendSeries = getLogicalKpiTrend(item.kpi, seed);
        const validTrend = randomTrendSeries.length >= 2;

        const lastTrendVal = validTrend ? randomTrendSeries[randomTrendSeries.length - 1] : 0;

        // Use logical delta and direction for consistent 5-7% reporting
        const logicalDelta = getLogicalKpiValue(item.kpi + 'delta', seed);
        const logicalDir = getLogicalKpiValue(item.kpi + 'dir', seed);
        let trendDelta = parseFloat((logicalDir > 50 ? logicalDelta : -logicalDelta).toFixed(1));

        // User request: "Assortment" and "PSL" should have 0 trend
        if (["Assortment"].includes(item.kpi)) {
          trendDelta = 0;
        }

        trendObj[col] = trendDelta;
        seriesObj[col] = randomTrendSeries;

        // Store the randomized value in the new item's values object
        newItem.values[col] = randomVal;
      });

      return {
        kpi: newItem.kpi,
        ...newItem.values,
        trend: trendObj,
        series: seriesObj,
      };
    });
  };

  // ---------------- TABS ----------------
  const tabs = useMemo(() => {
    const context = { selectedChannel, globalPlatform, selectedBrand, selectedLocation, timeStart, timeEnd };

    // If API provides platform matrix, format it.
    let platformData = null;
    if (apiData?.platformKpi) {
      // Convert { columns: ["KPI", ...cols], rows: { osa: { kpi: "OSA", Blinkit: 90, ...}, doi: {...} } }
      // To { columns: ["kpi", ...cols], rows: [{kpi: "OSA", Blinkit: 90, ...}, ...] }

      const { columns: origColumns, rows: origRowsArray } = apiData.platformKpi;

      // Guard against malformed API responses (e.g. error objects without columns/rows)
      if (!Array.isArray(origColumns) || !Array.isArray(origRowsArray)) {
        // Fall through to mock data below
      } else {
      // Standardize the first column to "kpi" (lowercase) which Showcase expects
      const normalizedColumns = origColumns.map((col, idx) => idx === 0 ? "kpi" : col);

      // Convert array elements
      const mappedRows = [];
      if (Array.isArray(origRowsArray)) {
        origRowsArray.forEach((rowData) => {
          if (!rowData || !rowData.kpi) return;
          const newRow = { ...rowData };

          // Also add trend and series objects if missing, to prevent Showcase from crashing
          if (!newRow.trend) newRow.trend = {};
          if (!newRow.series) newRow.series = {};

          mappedRows.push(newRow);
        });
      }

      // Filter columns to only show platforms belonging to the selected channel
      let filteredColumns = normalizedColumns;
      let filteredRows = mappedRows;
      if (channelPlatforms && channelPlatforms.length > 0) {
        const allowedPlatformsLower = channelPlatforms.map(p => p.toLowerCase().replace(/\s+/g, '_'));
        filteredColumns = normalizedColumns.filter((col, idx) => {
          if (idx === 0) return true; // Always keep the 'kpi' column
          return allowedPlatformsLower.includes(col.toLowerCase().replace(/\s+/g, '_'));
        });
        // Also strip disallowed platform keys from each row's data and trend
        const allowedColSet = new Set(filteredColumns.slice(1)); // exclude 'kpi'
        filteredRows = mappedRows.map(row => {
          const newRow = { kpi: row.kpi };
          const newTrend = {};
          const newSeries = {};
          for (const col of allowedColSet) {
            if (col in row) newRow[col] = row[col];
            if (row.trend && col in row.trend) newTrend[col] = row.trend[col];
            if (row.series && col in row.series) newSeries[col] = row.series[col];
          }
          newRow.trend = newTrend;
          newRow.series = newSeries;
          // Preserve breakdown if present
          if (row.breakdown) newRow.breakdown = row.breakdown;
          return newRow;
        });
      }

      platformData = {
        columns: filteredColumns,
        rows: filteredRows
      };
      } // end of valid columns/rows guard
    }
    if (!platformData) {
      // Fallback to mock data
      platformData = {
        columns: ["kpi", ...FORMAT_MATRIX[olaMode].PlatformColumns],
        rows: buildRows(FORMAT_MATRIX[olaMode].PlatformData.filter(d => d.kpi !== 'Assortment'), FORMAT_MATRIX[olaMode].PlatformColumns, context),
      };
    }

    // ---- Format tab ----
    let formatData = null;
    if (apiData?.formatKpi && Array.isArray(apiData.formatKpi?.columns) && Array.isArray(apiData.formatKpi?.rows)) {
      const { columns: fOrigColumns, rows: fOrigRowsArray } = apiData.formatKpi;
      const fNormalizedColumns = fOrigColumns.map((col, idx) => idx === 0 ? "kpi" : col);
      const fMappedRows = [];
      if (Array.isArray(fOrigRowsArray)) {
        fOrigRowsArray.forEach((rowData) => {
          if (!rowData || !rowData.kpi) return;
          const newRow = { ...rowData };
          if (!newRow.trend) newRow.trend = {};
          if (!newRow.series) newRow.series = {};
          fMappedRows.push(newRow);
        });
      }
      formatData = { columns: fNormalizedColumns, rows: fMappedRows };
    } else {
      formatData = {
        columns: ["kpi", ...FORMAT_MATRIX[olaMode].formatColumns],
        rows: buildRows(FORMAT_MATRIX[olaMode].FormatData.filter(d => d.kpi !== 'Assortment'), FORMAT_MATRIX[olaMode].formatColumns, context),
      };
    }

    // ---- City tab ----
    let cityData = null;
    if (apiData?.cityKpi && Array.isArray(apiData.cityKpi?.columns) && Array.isArray(apiData.cityKpi?.rows)) {
      const { columns: cOrigColumns, rows: cOrigRowsArray } = apiData.cityKpi;
      const cNormalizedColumns = cOrigColumns.map((col, idx) => idx === 0 ? "kpi" : col);
      const cMappedRows = [];
      if (Array.isArray(cOrigRowsArray)) {
        cOrigRowsArray.forEach((rowData) => {
          if (!rowData || !rowData.kpi) return;
          const newRow = { ...rowData };
          if (!newRow.trend) newRow.trend = {};
          if (!newRow.series) newRow.series = {};
          cMappedRows.push(newRow);
        });
      }
      cityData = { columns: cNormalizedColumns, rows: cMappedRows };
    } else {
      cityData = {
        columns: ["kpi", ...FORMAT_MATRIX[olaMode].CityColumns],
        rows: buildRows(FORMAT_MATRIX[olaMode].CityData.filter(d => d.kpi !== 'Assortment'), FORMAT_MATRIX[olaMode].CityColumns, context),
      };
    }

    // Debug log to trace what data we are passing into CityKpiTrendShowcase
    console.log("TabbedHeatmapTable platformData:", platformData);

    return [
      { key: "platform", label: "Platform", data: platformData },
      { key: "format", label: "Category", data: formatData },
      { key: "city", label: "City", data: cityData },
    ];
  }, [olaMode, selectedChannel, globalPlatform, channelPlatforms, selectedBrand, selectedLocation, timeStart, timeEnd, apiData]);

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
      <CityKpiTrendShowcase
        dynamicKey='availability'
        data={active.data}
        title={active.label}
        loading={loading}
        onFilterChange={onFiltersChange}
        selectedLevel={activeTab}
      />
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
            Platform-Level Category Heatmap
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
            Category → Product → Sales Loss drill-down.
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
    change: "▲3.1% (from 82.1%)",
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
    title: "Metro City Stock Availability",
    value: "78.5%",
    sub: "MTD availability across metro cities",
    change: "▼2.0% (from 80.5%)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Top 10 stores: 84.2%",
    extraChange: "▲0.6%",
    extraChangeColor: "green",
  }
];

const cardsWeighted = [
  {
    title: "Stock Availability",
    value: "79.8%",
    sub: "MTD on-shelf coverage",
    change: "▲2.7% (from 77.1%)",
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
    title: "Metro City Stock Availability",
    value: "73.1%",
    sub: "MTD availability across metro cities",
    change: "▼2.8% (from 75.9%)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Top 10 stores: 79.6%",
    extraChange: "▲0.4%",
    extraChangeColor: "green",
  }
];

const cards = {
  absolute: cardsAbsolute,
  weighted: cardsWeighted
};

const getAvailabilityKpis = (type, context = {}) => {
  const source = cards[type];
  const icons = [Layers, Package, Zap, MapPin];
  const gradients = [
    ['#6366f1', '#8b5cf6'],
    ['#14b8a6', '#06b6d4'],
    ['#f43f5e', '#ec4899'],
    ['#8b5cf6', '#a855f7']
  ];

  // Map readable titles to data center keys
  const titleToKey = {
    "Stock Availability": "osa",
    "Days of Inventory (DOI)": "doi",
    "Metro City Stock Availability": "availability"
  };

  return source.map((card, idx) => {
    // RESOLVE KEY: Use the map, or fallback to simple lowercase
    const kpiKey = titleToKey[card.title] || card.title.toLowerCase().replace(/\s+/g, '');

    const val = getLogicalKpiValue(kpiKey, context);
    const isUp = getLogicalKpiValue(kpiKey + 'dir', context) > 50;
    const delta = (getLogicalKpiValue(kpiKey + 'delta', context) / 20).toFixed(1);

    return {
      id: `avail-${type}-${idx}`,
      title: card.title,
      value: card.title.includes('DOI') ? val.toFixed(1) : `${val}%`,
      subtitle: card.sub,
      delta: parseFloat(delta),
      deltaLabel: `${isUp ? '▲' : '▼'} ${delta}%`,
      icon: icons[idx] || Layers,
      gradient: gradients[idx % gradients.length],
      trend: getLogicalKpiTrend(kpiKey, context)
    };
  });
};

// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------
export const AvailablityAnalysisData = ({ apiData, loading: parentLoading, apiErrors, onRetry, ...props }) => {
  const [olaMode, setOlaMode] = useState("absolute");
  const [availability, setAvailability] = useState("absolute");
  const [localLoading, setLocalLoading] = useState(false);

  const isBoatUser = useMemo(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user'));
      return u?.dbName?.toLowerCase() === 'boat';
    } catch {
      return false;
    }
  }, []);

  const {
    selectedBrand,
    timeStart,
    timeEnd,
    platform: globalPlatform,
    selectedLocation,
    selectedChannel,
    selectedCategory
  } = useContext(FilterContext);

  // Simulated loading delay on filter change
  useEffect(() => {
    setLocalLoading(true);
    const timer = setTimeout(() => {
      setLocalLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [globalPlatform, selectedBrand, selectedLocation, selectedChannel, selectedCategory, timeStart, timeEnd, availability]);

  const isLoading = parentLoading || localLoading;

  // User request: restrict Availability Overview cards to ONLY change on Platform
  const platformContext = { platform: globalPlatform };

  // Build real trend sparkline series from kpiTrends API data
  const trendSeriesMap = useMemo(() => {
    if (!apiData?.kpiTrends?.timeSeries?.length) return {};
    const osaSeries = apiData.kpiTrends.timeSeries.map(p => p.Osa || 0);
    return { osa: osaSeries };
  }, [apiData?.kpiTrends]);

  const isQuickCom = typeof selectedChannel === 'string' 
    ? selectedChannel.toLowerCase().includes('quick') 
    : (Array.isArray(selectedChannel) && selectedChannel.some(c => c.toLowerCase().includes('quick')));

  const availabilityKpis = useMemo(() => {
    // Icons and gradients for the cards
    const icons = [Layers, Package, MapPin];
    const gradients = [
      ['#6366f1', '#8b5cf6'],
      ['#14b8a6', '#06b6d4'],
      ['#8b5cf6', '#a855f7']
    ];

    // Determine the source for each card individually
    const osaCardData = apiData?.overview ? {
      value: `${Number(apiData.overview.stockAvailability || 0).toFixed(2)}%`,
      delta: Number(apiData.overview.stockAvailability || 0) - Number(apiData.overview.prevStockAvailability || 0),
      trend: apiData?.kpiTrends?.timeSeries?.map(p => p.Osa || 0) || []
    } : null;

    const doiCardData = apiData?.doi ? {
      value: Number(apiData.doi.doi || 0).toFixed(1),
      delta: Number(apiData.doi.doi || 0) - Number(apiData.doi.prevDoi || 0),
      trend: apiData?.kpiTrends?.timeSeries?.map(p => p.Osa || 0) || [] // Use OSA trend as proxy if DOI trend missing
    } : null;

    const metroCardData = apiData?.metroCity ? {
      value: apiData.metroCity.isMetroCity === false ? "N/A" : `${Number(apiData.metroCity.stockAvailability || 0).toFixed(2)}%`,
      delta: apiData.metroCity.isMetroCity === false ? 0 : Number(apiData.metroCity.stockAvailability || 0) - Number(apiData.metroCity.prevStockAvailability || 0),
      isNotMetro: apiData.metroCity.isMetroCity === false,
      trend: apiData?.kpiTrends?.timeSeries?.map(p => p.Osa || 0) || []
    } : null;

    const buyBoxCardData = apiData?.overview ? {
      value: `${Number(apiData.overview.fillRate || 0).toFixed(2)}%`,
      delta: Number(apiData.overview.fillRate || 0) - Number(apiData.overview.prevFillRate || 0),
      trend: apiData?.kpiTrends?.timeSeries?.map(p => p.Fillrate || 0) || []
    } : null;

    const deliveryCardData = apiData?.overview ? {
      value: apiData.overview.deliveryTime !== undefined ? apiData.overview.deliveryTime : "Coming soon",
      delta: 0,
      trend: []
    } : null;

    const skuCountData = apiData?.overview ? {
      value: formatNumber(apiData.overview.skuCount || 0),
      delta: 0,
      trend: []
    } : null;

    const pslCardData = apiData?.overview ? {
      value: `₹${formatNumber(apiData.overview.psl || 0)}`,
      delta: Number(apiData.overview.psl || 0) - Number(apiData.overview.prevPsl || 0),
      trend: apiData?.kpiTrends?.timeSeries?.map(p => p.Osa || 0) || []
    } : null;

    // Fallback mock logic for single KPI if API missing
    const getMock = (kpi) => {
      const val = getLogicalKpiValue(kpi, platformContext);
      const isUp = getLogicalKpiValue(kpi + 'dir', platformContext) > 50;
      const delta = (getLogicalKpiValue(kpi + 'delta', platformContext) / 20).toFixed(1);
      return {
        value: kpi === 'doi' || kpi === 'skucount' ? val.toFixed(1) : (kpi === 'delivery' ? 'Coming soon' : `${val.toFixed(2)}%`),
        delta: parseFloat(delta) * (isUp ? 1 : -1),
        trend: getLogicalKpiTrend(kpi, platformContext)
      };
    };

    let cards_config = [];
    if (isQuickCom) {
      cards_config = [
        { key: 'osa', title: "Stock Availability", sub: "MTD on-shelf coverage", api: osaCardData, icon: Layers, gradient: ['#6366f1', '#8b5cf6'] },
        { key: 'doi', title: "Days of Inventory (DOI)", sub: "Network average days of cover", api: doiCardData, icon: Package, gradient: ['#14b8a6', '#06b6d4'] },
        { key: 'availability', title: "Metro City Stock Availability", sub: "MTD availability across metro cities", api: metroCardData, icon: MapPin, gradient: ['#8b5cf6', '#a855f7'] }
      ];
    } else {
      cards_config = [
        { key: 'osa', title: "Stock Availability", sub: "MTD on-shelf coverage", api: osaCardData, icon: Layers, gradient: ['#6366f1', '#8b5cf6'] },
        { key: 'buybox', title: "Buy Box %", sub: "MTD Buy Box percentage", api: buyBoxCardData, icon: Zap, gradient: ['#f59e0b', '#d97706'] },
        { key: 'doi', title: "Days of Inventory (DOI)", sub: "Network average days of cover", api: doiCardData, icon: Package, gradient: ['#14b8a6', '#06b6d4'] },
        { key: 'delivery', title: "Delivery time", sub: "Average delivery time", api: deliveryCardData, icon: Zap, gradient: ['#ec4899', '#be185d'] },
        { key: 'skucount', title: "SKU count", sub: "Total SKUs tracked", api: skuCountData, icon: MapPin, gradient: ['#8b5cf6', '#a855f7'] }
      ];
    }

    return cards_config.map((cfg, idx) => {
      const data = cfg.api || getMock(cfg.key);
      const delta = Number(data.delta || 0);
      const deltaText = cfg.key === 'delivery' || cfg.key === 'skucount' ? "" : (data.isNotMetro ? "" : `${delta >= 0 ? '▲' : '▼'} ${cfg.key === 'psl' ? '₹' + formatNumber(Math.abs(delta)) : Math.abs(delta).toFixed(1)}${cfg.key === 'doi' ? ' days' : (cfg.key === 'psl' ? '' : '%')}`);
      const prevText = cfg.key === 'delivery' || cfg.key === 'skucount' ? "" : (data.isNotMetro ? "" : "vs Previous Period");

      return {
        id: `avail-card-${cfg.key}`,
        title: cfg.title,
        value: data.value,
        subtitle: data.isNotMetro ? `Selected location is not a metro city` : cfg.sub,
        delta: parseFloat(delta.toFixed(1)),
        deltaLabel: deltaText,
        icon: cfg.icon,
        gradient: cfg.gradient,
        trend: data.trend || [],
        trendSeries: data.trend || [],
        prevText: prevText,
        isNotMetro: data.isNotMetro
      };
    });
  }, [availability, globalPlatform, apiData, trendSeriesMap, selectedChannel]);

  return (

    <div className="max-w-7xl mx-auto space-y-5">
      <div className="space-y-4">
        {/* <OlaLightThemeDashboard setOlaMode={setOlaMode} olaMode={olaMode} /> */}

        {/* MARKET SHARE TOGGLE BLOCK */}
        {/* AVAILABILITY TOGGLE BLOCK */}

        {/* <MetricCardContainer title="Availability Overview" cards={cards[availability]} /> */}

        {isLoading ? (
          <AvailabilityOverviewSkeleton />
        ) : (
          <SnapshotOverview
            title="Availability Overview"
            icon={LayoutGrid}
            chip="Absolute Basis"
            loading={isLoading}
            helpMenu="Availability Analysis"
            headerRight={
              <span className="px-4 py-1.5 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 uppercase tracking-tight">
                vs Previous Period
              </span>
            }
            kpis={availabilityKpis}
          />
        )}

        {/* Signal Lab Availability Segment */}
        {!isBoatUser && (
          <div className="w-full bg-white border rounded-3xl px-6 py-5 shadow">
            <SignalLabVisibility type="availability" loading={isLoading} />
          </div>
        )}

        {isLoading ? (
          <PlatformKpiMatrixSkeleton />
        ) : (
          <TabbedHeatmapTable
            olaMode={availability}
            loading={isLoading}
            apiData={{
              ...apiData,
              platformKpi: {
                ...apiData?.platformKpi,
                rows: apiData?.platformKpi?.rows?.filter(row => {
                  if (isQuickCom) return ['OSA', 'DOI', 'PSL'].includes(row.kpi);
                  return ['OSA', 'DOI', 'PSL', 'BUY BOX %', 'DELIVERY TIME', 'SKU COUNT'].includes(row.kpi);
                }) || []
              },
              formatKpi: {
                ...apiData?.formatKpi,
                rows: apiData?.formatKpi?.rows?.filter(row => {
                  if (isQuickCom) return ['OSA', 'DOI', 'PSL'].includes(row.kpi);
                  return ['OSA', 'DOI', 'PSL', 'BUY BOX %', 'DELIVERY TIME', 'SKU COUNT'].includes(row.kpi);
                }) || []
              },
              cityKpi: {
                ...apiData?.cityKpi,
                rows: apiData?.cityKpi?.rows?.filter(row => {
                  if (isQuickCom) return ['OSA', 'DOI', 'PSL'].includes(row.kpi);
                  return ['OSA', 'DOI', 'PSL', 'BUY BOX %', 'DELIVERY TIME', 'SKU COUNT'].includes(row.kpi);
                }) || []
              }
            }}
            onFiltersChange={(matrixFilters) => {
              if (!props.onFiltersChange) return;
              // Map Matrix filter keys to Global filter keys
              const mappedFilters = {};
              if (matrixFilters.platforms) mappedFilters.platform = matrixFilters.platforms;
              if (matrixFilters.brands) mappedFilters.brand = matrixFilters.brands;
              if (matrixFilters.categories) mappedFilters.category = matrixFilters.categories;
              if (matrixFilters.locations) mappedFilters.location = matrixFilters.locations;
              if (matrixFilters.months) mappedFilters.months = matrixFilters.months;
              if (matrixFilters.kpis) mappedFilters.kpis = matrixFilters.kpis;
              if (matrixFilters.metroFlags) mappedFilters.metroFlags = matrixFilters.metroFlags;
              if (matrixFilters.cities) mappedFilters.cities = matrixFilters.cities;
              if (matrixFilters.formats) mappedFilters.formats = matrixFilters.formats;
              props.onFiltersChange(mappedFilters);
            }}
          />
        )}
        {isLoading ? (
          <OsaDetailViewSkeleton />
        ) : (
          <OsaHeatmapTable
            olaMode={availability}
            loading={isLoading}
            apiData={apiData}
            onFiltersChange={(matrixFilters) => {
              if (!props.onFiltersChange) return;
              const mappedFilters = {};
              if (matrixFilters.platforms) mappedFilters.platform = matrixFilters.platforms;
              if (matrixFilters.brands) mappedFilters.brand = matrixFilters.brands;
              if (matrixFilters.categories) mappedFilters.category = matrixFilters.categories;
              if (matrixFilters.locations) mappedFilters.location = matrixFilters.locations;
              if (matrixFilters.months) mappedFilters.months = matrixFilters.months;
              if (matrixFilters.kpis) mappedFilters.kpis = matrixFilters.kpis;
              if (matrixFilters.metroFlags) mappedFilters.metroFlags = matrixFilters.metroFlags;
              if (matrixFilters.cities) mappedFilters.cities = matrixFilters.cities;
              if (matrixFilters.formats) mappedFilters.formats = matrixFilters.formats;
              props.onFiltersChange(mappedFilters);
            }}
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
