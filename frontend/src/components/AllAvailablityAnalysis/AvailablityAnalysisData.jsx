import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FORMAT_MATRIX,
  FORMAT_ROWS,
  OLA_Detailed,
  PRODUCT_MATRIX,
} from "./availablityDataCenter";

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
              ${
                olaMode === "absolute"
                  ? "bg-slate-900 text-slate-50"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
          >
            Absolute OLA
          </button>

          <button
            onClick={() => setOlaMode("weighted")}
            className={`rounded-full px-3 py-1 font-medium 
              ${
                olaMode === "weighted"
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

const MatrixPlatformFormat = () => {
  const [hoverRowKey, setHoverRowKey] = useState(null);
  const [selection, setSelection] = useState(null);

  const quarterDefs = useMemo(() => OLA_MATRIX.quarterColumns, []);

  const [expandedPlatforms, setExpandedPlatforms] = useState(() => {
    const initial = {};
    OLA_MATRIX.cityMonthData.forEach((r) => {
      initial[r.platform] = true;
    });
    return initial;
  });

  const [expandedRegions, setExpandedRegions] = useState({});
  const [expandedQuarters, setExpandedQuarters] = useState(() => {
    const init = {};
    OLA_MATRIX.quarterColumns.forEach((q) => {
      init[q.id] = true;
    });
    return init;
  });

  const platforms = useMemo(
    () => Array.from(new Set(OLA_MATRIX.cityMonthData.map((r) => r.platform))),
    []
  );

  const regionsFor = (p) =>
    Array.from(
      new Set(
        OLA_MATRIX.cityMonthData
          .filter((r) => r.platform === p)
          .map((r) => r.region)
      )
    );

  const citiesFor = (p, r) =>
    OLA_MATRIX.cityMonthData.filter(
      (row) => row.platform === p && row.region === r
    );

  const rowKey = (platform, region, city) =>
    [platform, region || "-", city || "-"].join("|");

  const activeColumns = useMemo(() => {
    const cols = [];
    quarterDefs.forEach((q) => {
      if (expandedQuarters[q.id]) {
        q.months.forEach((m) => cols.push({ id: `${q.id}|${m}`, label: m }));
      } else {
        cols.push({ id: q.id, label: q.label });
      }
    });
    return cols;
  }, [expandedQuarters, quarterDefs]);

  const anyPlatformExpanded = Object.values(expandedPlatforms).some(Boolean);
  const anyRegionExpanded = Object.entries(expandedRegions).some(
    ([key, isOpen]) => {
      if (!isOpen) return false;
      const [p] = key.split("|");
      return expandedPlatforms[p];
    }
  );
  const showRegionColumn = anyPlatformExpanded;
  const showCityColumn = anyRegionExpanded;
  const hierarchyColSpan =
    1 + (showRegionColumn ? 1 : 0) + (showCityColumn ? 1 : 0);

  const cellValue = (rows, colId) => {
    if (!rows.length) return 0;

    if (colId.includes("|")) {
      return avgForKeys(rows.map((r) => r.values[colId] ?? 0));
    }

    const targetQuarter = colId;
    const keys = Object.keys(rows[0].values || {}).filter((k) =>
      k.startsWith(`${targetQuarter}|`)
    );

    return avgForKeys(rows.flatMap((r) => keys.map((k) => r.values[k] ?? 0)));
  };

  const rowsForSelection = (sel) =>
    OLA_MATRIX.cityMonthData.filter(
      (r) =>
        r.platform === sel.platform &&
        (!sel.region || r.region === sel.region) &&
        (!sel.city || r.city === sel.city)
    );

  const selectionMeta = useMemo(() => {
    if (!selection) return null;
    const rows = rowsForSelection(selection);
    const value = cellValue(rows, selection.colId);

    const [qId, mLabelRaw] = selection.colId.includes("|")
      ? selection.colId.split("|")
      : [selection.colId, ""];
    const quarterDef = quarterDefs.find((q) => q.id === qId);
    const quarterLabel = quarterDef?.label || qId;
    const monthLabel = mLabelRaw || "Quarter avg";

    const quarterRows = OLA_MATRIX.cityMonthData.filter(
      (r) => r.platform === selection.platform
    );
    const quarterAvg = cellValue(quarterRows, qId);
    const networkRows = OLA_MATRIX.cityMonthData;
    const networkAvg = cellValue(networkRows, selection.colId);

    return {
      value,
      label: `${selection.platform}${
        selection.region ? " · " + selection.region : ""
      }${selection.city ? " · " + selection.city : ""}`,
      bucket: `${quarterLabel} · ${monthLabel}`,
      quarterAvg,
      networkAvg,
    };
  }, [selection, quarterDefs]);

  const expandAllRows = () => {
    const pState = {};
    const rState = {};
    platforms.forEach((p) => {
      pState[p] = true;
      regionsFor(p).forEach((r) => {
        rState[`${p}|${r}`] = true;
      });
    });
    setExpandedPlatforms(pState);
    setExpandedRegions(rState);
  };

  const collapseAllRows = () => {
    setExpandedPlatforms({});
    setExpandedRegions({});
  };

  const expandAllColumns = () => {
    const next = {};
    OLA_MATRIX.quarterColumns.forEach((q) => {
      next[q.id] = true;
    });
    setExpandedQuarters(next);
  };

  const collapseAllColumns = () => {
    setExpandedQuarters({});
  };

  const renderRow = (platform, region, city) => {
    const rowRows =
      OLA_MATRIX.cityMonthData.filter(
        (r) =>
          r.platform === platform &&
          (!region || r.region === region) &&
          (!city || r.city === city)
      ) || [];

    const isPlatform = !region && !city;
    const isRegion = !!region && !city;
    const isCity = !!city;

    const rk = rowKey(platform, region, city);
    const platformCellColSpan =
      showRegionColumn || showCityColumn ? 1 : hierarchyColSpan;

    const avgAcrossActiveCols =
      activeColumns.length > 0
        ? avgForKeys(activeColumns.map((c) => cellValue(rowRows, c.id)))
        : 0;

    return (
      <motion.tr
        key={`${platform}-${region || ""}-${city || ""}`}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        onMouseEnter={() => setHoverRowKey(rk)}
        onMouseLeave={() => setHoverRowKey(null)}
        className={[
          "border-t border-slate-100 group",
          isPlatform ? "bg-slate-50/60" : "",
          isCity ? "bg-white" : "",
          hoverRowKey === rk ? "bg-sky-50/60" : "",
          selection &&
          rowKey(selection.platform, selection.region, selection.city) === rk
            ? "bg-sky-100/70"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* main hierarchy cell */}
        <td
          className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-slate-100"
          colSpan={isPlatform ? platformCellColSpan : 1}
        >
          <div className="flex items-center gap-2">
            {isPlatform && (
              <button
                className="h-6 w-6 rounded-md border border-slate-200 bg-white text-xs text-slate-600 flex items-center justify-center shadow-sm"
                onClick={() =>
                  setExpandedPlatforms((prev) => ({
                    ...prev,
                    [platform]: !prev[platform],
                  }))
                }
              >
                {expandedPlatforms[platform] ? "-" : "+"}
              </button>
            )}
            {isRegion && (
              <button
                className="h-5 w-5 rounded-md border border-slate-200 bg-white text-[10px] text-slate-500 flex items-center justify-center"
                onClick={() =>
                  setExpandedRegions((prev) => ({
                    ...prev,
                    [`${platform}|${region}`]: !prev[`${platform}|${region}`],
                  }))
                }
              >
                {expandedRegions[`${platform}|${region}`] ? "-" : "+"}
              </button>
            )}
            {isCity && <span className="text-slate-400 text-xs">•</span>}
            <div className="flex flex-col">
              <span
                className={[
                  "truncate",
                  isPlatform ? "font-semibold text-slate-900" : "",
                  isRegion ? "font-semibold text-slate-700" : "",
                  isCity ? "font-medium text-slate-700" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {platform}
              </span>
              {(isRegion || isCity) && (
                <span className="text-[10px] text-slate-400">
                  {isRegion && "Region"}
                  {isCity && `${region ? region + " · " : ""}City`}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* region & city sticky columns */}
        {showRegionColumn && (
          <td className="px-3 py-2 whitespace-nowrap sticky left-[10.5rem] bg-inherit z-10 border-r border-slate-100 text-xs text-slate-700">
            {region || (isPlatform ? "—" : platform)}
          </td>
        )}
        {showCityColumn && (
          <td className="px-3 py-2 whitespace-nowrap sticky left-[16rem] bg-inherit z-10 border-r border-slate-100 text-xs text-slate-700">
            {city || "—"}
          </td>
        )}

        {/* data cells */}
        {activeColumns.map((c) => {
          const val = cellValue(rowRows, c.id);
          const isSelectedCell =
            selection &&
            selection.colId === c.id &&
            selection.platform === platform &&
            selection.region === region &&
            selection.city === city;

          return (
            <td key={c.id} className="px-2 py-1 text-center align-middle">
              <button
                type="button"
                onClick={() =>
                  setSelection({
                    platform,
                    region,
                    city,
                    colId: c.id,
                  })
                }
                className={[
                  "w-full px-2 py-1 rounded-md text-[11px] font-semibold border transition-all",
                  cellHeat(val),
                  isSelectedCell
                    ? "border-sky-500 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]"
                    : "border-transparent hover:border-sky-300 hover:shadow-sm",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {val ? `${val}%` : "—"}
              </button>
            </td>
          );
        })}

        {/* small row avg pill at the end */}
        <td className="px-3 py-1 text-right text-[10px] text-slate-500 whitespace-nowrap">
          {avgAcrossActiveCols ? `avg ${avgAcrossActiveCols}%` : ""}
        </td>
      </motion.tr>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.45 }}
      className="col-span-12 xl:col-span-12 rounded-2xl bg-white shadow-sm border border-slate-100 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Platform Level OLA Across Platform
          </p>
          <p className="text-xs text-slate-500">
            Compact matrix with subtle band for OLA strength.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-0.5 rounded-full bg-emerald-600" /> ≥ 96%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-0.5 rounded-full bg-lime-500" /> 90–95%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-0.5 rounded-full bg-amber-500" /> 80–89%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-0.5 rounded-full bg-rose-500" /> &lt; 80%
          </span>
        </div>
      </div>

      {/* selection summary bar */}
      {selectionMeta && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-2 flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.16em] text-sky-500">
              Focus cell
            </span>
            <span className="font-semibold text-slate-900">
              {selectionMeta.label}
            </span>
            <span className="text-[11px] text-slate-500">
              {selectionMeta.bucket}
            </span>
          </div>
          <div className="flex items-baseline gap-1 text-slate-900">
            <span className="text-[11px] text-slate-500 mr-1">OLA</span>
            <span className="text-xl font-semibold">
              {selectionMeta.value}%
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
              Platform quarter avg: {selectionMeta.quarterAvg}%
            </span>
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
              Network avg: {selectionMeta.networkAvg}%
            </span>
          </div>
          <button
            className="ml-auto px-3 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-600 hover:border-slate-300"
            onClick={() => setSelection(null)}
          >
            Clear selection
          </button>
        </motion.div>
      )}

      {/* main table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 mt-3">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold text-slate-600 w-40 sticky left-0 z-20 bg-slate-50 border-r border-slate-100"
                colSpan={hierarchyColSpan}
              >
                Platform / Region / City
              </th>
              {quarterDefs.map((q) => (
                <th
                  key={q.id}
                  className="px-3 py-2 text-center font-semibold text-slate-600 border-l border-slate-100"
                  colSpan={expandedQuarters[q.id] ? q.months.length : 1}
                >
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="h-6 w-6 rounded-md border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
                      onClick={() =>
                        setExpandedQuarters((prev) => ({
                          ...prev,
                          [q.id]: !prev[q.id],
                        }))
                      }
                    >
                      {expandedQuarters[q.id] ? "-" : "+"}
                    </button>
                    <span>{q.label}</span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-slate-600">
                Row avg
              </th>
            </tr>
            <tr className="bg-slate-50 border-t border-slate-100">
              <th className="px-3 py-1 text-left text-slate-500 font-medium sticky left-0 z-20 bg-slate-50 border-r border-slate-100">
                Day bucket
              </th>
              {showRegionColumn && (
                <th className="px-3 py-1 text-left text-slate-500 font-medium sticky left-[10.5rem] z-20 bg-slate-50 border-r border-slate-100">
                  Region
                </th>
              )}
              {showCityColumn && (
                <th className="px-3 py-1 text-left text-slate-500 font-medium sticky left-[16rem] z-20 bg-slate-50 border-r border-slate-100">
                  City
                </th>
              )}
              {activeColumns.map((c) => (
                <th
                  key={c.id}
                  className="px-2 py-1 text-center text-slate-500 font-medium"
                >
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-1 text-right text-slate-500 font-medium">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {platforms.map((p) => {
                const pExpanded = expandedPlatforms[p];
                return (
                  <React.Fragment key={p}>
                    {renderRow(p)}
                    {pExpanded &&
                      regionsFor(p).map((r) => {
                        const rKey = `${p}|${r}`;
                        const rExpanded = expandedRegions[rKey];
                        return (
                          <React.Fragment key={rKey}>
                            {renderRow(p, r)}
                            {rExpanded &&
                              citiesFor(p, r).map((c) =>
                                renderRow(p, r, c.city)
                              )}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
        <button
          onClick={expandAllRows}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Expand rows
        </button>
        <button
          onClick={collapseAllRows}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Collapse rows
        </button>
        <button
          onClick={expandAllColumns}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Expand columns
        </button>
        <button
          onClick={collapseAllColumns}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Collapse columns
        </button>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Power hierarchy – dynamic via FORMAT_MATRIX
// ---------------------------------------------------------------------------

const PowerHierarchyHeat = () => {
  const [expandedPlatforms, setExpandedPlatforms] = useState({});
  const [expandedRegions, setExpandedRegions] = useState({});

  const platforms = useMemo(
    () =>
      Array.from(new Set(FORMAT_MATRIX.cityFormatData.map((r) => r.platform))),
    []
  );

  const regionsForPlatform = (p) =>
    Array.from(
      new Set(
        FORMAT_MATRIX.cityFormatData
          .filter((r) => r.platform === p)
          .map((r) => r.region)
      )
    );

  const citiesFor = (p, r) =>
    FORMAT_MATRIX.cityFormatData.filter(
      (row) => row.platform === p && row.region === r
    );

  const expandAll = () => {
    const pState = {};
    const rState = {};
    platforms.forEach((p) => {
      pState[p] = true;
      regionsForPlatform(p).forEach((r) => {
        rState[`${p}|${r}`] = true;
      });
    });
    setExpandedPlatforms(pState);
    setExpandedRegions(rState);
  };

  const collapseAll = () => {
    setExpandedPlatforms({});
    setExpandedRegions({});
  };

  const anyPlatformExpanded = Object.values(expandedPlatforms).some(Boolean);
  const anyRegionExpanded = Object.entries(expandedRegions).some(
    ([key, isOpen]) => {
      if (!isOpen) return false;
      const [platformFromKey] = key.split("|");
      return expandedPlatforms[platformFromKey];
    }
  );
  const showRegionColumn = anyPlatformExpanded;
  const showCityColumn = anyRegionExpanded;
  const hierarchyColSpan =
    1 + (showRegionColumn ? 1 : 0) + (showCityColumn ? 1 : 0);

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(15,23,42,0.08)] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Platform Level Across Category
          </p>
          <p className="text-sm text-slate-600">
            Platform → Region → City across formats with inline heat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded-full text-sm border border-slate-200 bg-white hover:border-slate-300"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded-full text-sm border border-slate-200 bg-white hover:border-slate-300"
          >
            Collapse all
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold text-slate-600 w-32">
                Platform
              </th>
              {showRegionColumn && (
                <th className="px-3 py-2 font-semibold text-slate-600 w-28">
                  Region
                </th>
              )}
              {showCityColumn && (
                <th className="px-3 py-2 font-semibold text-slate-600 w-28">
                  City
                </th>
              )}
              {FORMAT_MATRIX.formatColumns.map((f) => (
                <th
                  key={f}
                  className="px-3 py-2 font-semibold text-slate-600 text-center whitespace-nowrap"
                >
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((platform) => {
              const platformExpanded = expandedPlatforms[platform];
              const platformRows = FORMAT_MATRIX.cityFormatData.filter(
                (r) => r.platform === platform
              );
              const platformAvg = {};
              FORMAT_MATRIX.formatColumns.forEach((f) => {
                const vals = platformRows.map((r) => r.values[f] ?? 0);
                platformAvg[f] = vals.length ? Math.round(average(vals)) : 0;
              });
              return (
                <React.Fragment key={platform}>
                  <tr className="border-t border-slate-100 bg-slate-50/70">
                    <td
                      className="px-3 py-2 font-semibold text-slate-800"
                      colSpan={hierarchyColSpan}
                    >
                      <button
                        onClick={() =>
                          setExpandedPlatforms((prev) => ({
                            ...prev,
                            [platform]: !prev[platform],
                          }))
                        }
                        className="mr-2 text-slate-600"
                      >
                        {platformExpanded ? "-" : "+"}
                      </button>
                      {platform}
                    </td>
                    {FORMAT_MATRIX.formatColumns.map((f) => (
                      <td key={f} className="px-3 py-2 text-center">
                        <span
                          className={`px-2 py-1 rounded ${cellHeat(
                            platformAvg[f]
                          )}`}
                        >
                          {platformAvg[f]}%
                        </span>
                      </td>
                    ))}
                  </tr>
                  {platformExpanded &&
                    regionsForPlatform(platform).map((region) => {
                      const regionKey = `${platform}|${region}`;
                      const regionRows = citiesFor(platform, region);
                      const avg = {};
                      FORMAT_MATRIX.formatColumns.forEach((f) => {
                        const vals = regionRows.map((c) => c.values[f] ?? 0);
                        avg[f] = vals.length ? Math.round(average(vals)) : 0;
                      });
                      const isOpen = expandedRegions[regionKey];
                      return (
                        <React.Fragment key={regionKey}>
                          <tr className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500">
                              {platform}
                            </td>
                            {showRegionColumn && (
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                <button
                                  onClick={() =>
                                    setExpandedRegions((prev) => ({
                                      ...prev,
                                      [regionKey]: !prev[regionKey],
                                    }))
                                  }
                                  className="mr-2 text-slate-500"
                                >
                                  {isOpen ? "-" : "+"}
                                </button>
                                {region}
                              </td>
                            )}
                            {showCityColumn && (
                              <td className="px-3 py-2 text-slate-300">-</td>
                            )}
                            {FORMAT_MATRIX.formatColumns.map((f) => (
                              <td key={f} className="px-3 py-2 text-center">
                                <span
                                  className={`px-2 py-1 rounded ${cellHeat(
                                    avg[f]
                                  )}`}
                                >
                                  {avg[f]}%
                                </span>
                              </td>
                            ))}
                          </tr>
                          {isOpen &&
                            regionRows.map((row) => (
                              <tr
                                key={`${regionKey}-${row.city}`}
                                className="border-t border-slate-100 bg-slate-50/60"
                              >
                                <td className="px-3 py-2 text-slate-500 pl-8">
                                  {platform}
                                </td>
                                {showRegionColumn && (
                                  <td className="px-3 py-2 text-slate-600 pl-4">
                                    {region}
                                  </td>
                                )}
                                {showCityColumn && (
                                  <td className="px-3 py-2 text-slate-800 pl-4 font-medium">
                                    {row.city}
                                  </td>
                                )}
                                {FORMAT_MATRIX.formatColumns.map((f) => {
                                  const val = row.values[f] ?? 0;
                                  return (
                                    <td
                                      key={f}
                                      className="px-3 py-2 text-center"
                                    >
                                      <span
                                        className={`px-2 py-1 rounded ${cellHeat(
                                          val
                                        )}`}
                                      >
                                        {val}%
                                      </span>
                                    </td>
                                  );
                                })}
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
                className={`w-full flex items-center justify-between rounded-2xl px-3 py-2 text-xs border ${
                  isActive
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
                    className={`px-4 py-2 rounded-full text-[11px] border backdrop-blur-sm flex items-center gap-2 ${
                      isCompare
                        ? "border-violet-500 bg-violet-50 shadow-sm"
                        : "border-slate-200 bg-white/80 hover:bg-slate-50"
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    <div
                      className="h-2 w-10 rounded-full"
                      style={{
                        background: `linear-gradient(to right, rgba(14,165,233,${
                          0.3 + weight * 0.4
                        }), rgba(99,102,241,${0.2 + weight * 0.5}))`,
                      }}
                    />
                    <span
                      className={`truncate ${
                        isActive ? "font-semibold" : "font-normal"
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

// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------
export const AvailablityAnalysisData = () => {
  const [olaMode, setOlaMode] = useState("absolute");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-amber-50 via-white to-sky-50 text-slate-900 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="space-y-4">
          <OlaLightThemeDashboard setOlaMode={setOlaMode} olaMode={olaMode} />
          {/* <DualAxisDrillMatrix /> */}
          <PowerHierarchyHeat />
          <ProductLevelHeat />
          <OLADrillTable />
          {/* <FormatPerformanceStudio /> */}
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
