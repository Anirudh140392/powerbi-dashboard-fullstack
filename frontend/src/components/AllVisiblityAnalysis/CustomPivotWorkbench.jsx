import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RefreshCw, Save, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-md"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">Success</p>
        <p className="text-xs text-slate-500">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="ml-2 text-slate-400 hover:text-slate-600"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

const defaultFields = [
  {
    key: "country",
    label: "Country",
    type: "dimension",
    description: "Geography to slice by",
  },
  {
    key: "product",
    label: "Product",
    type: "dimension",
    description: "Product family",
  },
  {
    key: "orderSource",
    label: "Order Source",
    type: "dimension",
    description: "Channel like Distributor, Store or Web",
  },
  {
    key: "year",
    label: "Fiscal Year",
    type: "dimension",
    description: "Time buckets",
  },
  {
    key: "unitsSold",
    label: "Units Sold",
    type: "measure",
    description: "Volume shipped",
  },
  {
    key: "inStock",
    label: "In Stock",
    type: "measure",
    description: "Current inventory",
  },
  {
    key: "soldAmount",
    label: "Sold Amount",
    type: "measure",
    description: "Net revenue",
  },
];

const pivotSample = [
  {
    country: "France",
    product: "Shampoo",
    year: "FY 2022",
    orderSource: "Distributor",
    unitsSold: 360,
    inStock: 540,
    soldAmount: 210,
  },
  {
    country: "France",
    product: "Shampoo",
    year: "FY 2023",
    orderSource: "Store",
    unitsSold: 410,
    inStock: 620,
    soldAmount: 260,
  },
  {
    country: "France",
    product: "Lotion",
    year: "FY 2024",
    orderSource: "Web",
    unitsSold: 280,
    inStock: 480,
    soldAmount: 190,
  },
  {
    country: "France",
    product: "Lotion",
    year: "FY 2025",
    orderSource: "Store",
    unitsSold: 360,
    inStock: 510,
    soldAmount: 240,
  },
  {
    country: "France",
    product: "Ice Cream",
    year: "FY 2024",
    orderSource: "Web",
    unitsSold: 240,
    inStock: 420,
    soldAmount: 200,
  },

  {
    country: "Germany",
    product: "Shampoo",
    year: "FY 2022",
    orderSource: "Distributor",
    unitsSold: 430,
    inStock: 640,
    soldAmount: 270,
  },
  {
    country: "Germany",
    product: "Shampoo",
    year: "FY 2023",
    orderSource: "Store",
    unitsSold: 300,
    inStock: 520,
    soldAmount: 210,
  },
  {
    country: "Germany",
    product: "Lotion",
    year: "FY 2024",
    orderSource: "Web",
    unitsSold: 300,
    inStock: 520,
    soldAmount: 210,
  },
  {
    country: "Germany",
    product: "Lotion",
    year: "FY 2025",
    orderSource: "Store",
    unitsSold: 360,
    inStock: 550,
    soldAmount: 230,
  },
  {
    country: "Germany",
    product: "Ice Cream",
    year: "FY 2023",
    orderSource: "Distributor",
    unitsSold: 290,
    inStock: 460,
    soldAmount: 210,
  },

  {
    country: "United Kingdom",
    product: "Shampoo",
    year: "FY 2022",
    orderSource: "Store",
    unitsSold: 350,
    inStock: 600,
    soldAmount: 230,
  },
  {
    country: "United Kingdom",
    product: "Shampoo",
    year: "FY 2023",
    orderSource: "Distributor",
    unitsSold: 400,
    inStock: 630,
    soldAmount: 260,
  },
  {
    country: "United Kingdom",
    product: "Lotion",
    year: "FY 2024",
    orderSource: "Web",
    unitsSold: 310,
    inStock: 540,
    soldAmount: 220,
  },
  {
    country: "United Kingdom",
    product: "Lotion",
    year: "FY 2025",
    orderSource: "Store",
    unitsSold: 360,
    inStock: 560,
    soldAmount: 240,
  },

  {
    country: "United States",
    product: "Shampoo",
    year: "FY 2022",
    orderSource: "Store",
    unitsSold: 420,
    inStock: 650,
    soldAmount: 280,
  },
  {
    country: "United States",
    product: "Shampoo",
    year: "FY 2023",
    orderSource: "Distributor",
    unitsSold: 460,
    inStock: 700,
    soldAmount: 310,
  },
  {
    country: "United States",
    product: "Lotion",
    year: "FY 2024",
    orderSource: "Web",
    unitsSold: 340,
    inStock: 580,
    soldAmount: 240,
  },
  {
    country: "United States",
    product: "Lotion",
    year: "FY 2025",
    orderSource: "Store",
    unitsSold: 390,
    inStock: 600,
    soldAmount: 260,
  },
];

const colors = [
  "#4f46e5",
  "#f97316",
  "#10b981",
  "#0ea5e9",
  "#9333ea",
  "#ef4444",
  "#22c55e",
];
const aggLabel = {
  sum: "Sum",
  avg: "Avg",
  count: "Count",
  distinctCount: "Dst Count",
  min: "Min",
  max: "Max",
};

const initState = () => ({
  sum: 0,
  count: 0,
  min: Infinity,
  max: -Infinity,
  uniqueVals: new Set(),
});

const pushAgg = (state, value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    state.sum += value;
    state.min = Math.min(state.min, value);
    state.max = Math.max(state.max, value);
  } else {
    // For non-numeric, we can't sum/min/max in a standard way,
    // but we still count and track unique vals.
  }
  state.count += 1;
  state.uniqueVals.add(value);
};

const finalizeAgg = (state, agg) => {
  if (!state) return 0;
  if (agg === "sum") return state.sum;
  if (agg === "avg") return state.count ? state.sum / state.count : 0;
  if (agg === "count") return state.count;
  if (agg === "distinctCount") return state.uniqueVals.size;
  if (agg === "min") return state.count ? state.min : 0;
  return state.count ? state.max : 0;
};

const cloneAndPush = (map, key, value) => {
  const current = map[key] || initState();
  pushAgg(current, value);
  map[key] = current;
};

const evaluateValue = (map, value) => {
  if (!map) return 0;

  if (value.calc === "ratio" && value.denominatorKey) {
    const numerator = finalizeAgg(map[value.key], value.agg);
    const denominator = finalizeAgg(map[value.denominatorKey], value.agg);
    return denominator ? numerator / denominator : 0;
  }
  return finalizeAgg(map[value.key], value.agg);
};

const formatCell = (val, value) => {
  if (!Number.isFinite(val)) return "-";
  if (value.format === "percent")
    return val.toLocaleString("en-IN", {
      style: "percent",
      minimumFractionDigits: 1,
    });
  if (value.format === "currency")
    return val.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });
  if (value.format === "decimal")
    return val.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  if (value.format === "compact")
    return Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(val);
  if (value.calc === "ratio" && value.denominatorKey)
    return `${(val * 100).toFixed(1)}%`;

  const digits = value.agg === "avg" ? 1 : 0;
  return val.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

const sanitizeKey = (value) => (value.length ? value.join(" / ") : "All");
const buildPivot = (data, config, measureKeys) => {
  const rowKeyToTuple = new Map();
  const colKeyToTuple = new Map();
  const cellMap = new Map();
  const rowTotals = new Map();
  const colTotals = new Map();
  const grandTotals = {};

  const passesFilters = (row) =>
    Object.entries(config.filters).every(([field, allowed]) => {
      if (!allowed || allowed.length === 0) return true;
      return allowed.includes(String(row[field]));
    });

  data.filter(passesFilters).forEach((row) => {
    const rowTuple = config.rows.map((r) => String(row[r] ?? "-"));
    const colTuple = config.columns.map((c) => String(row[c] ?? "-"));

    const rowKey = sanitizeKey(rowTuple.length ? rowTuple : ["All"]);
    const colKey = sanitizeKey(colTuple.length ? colTuple : ["All"]);

    rowKeyToTuple.set(rowKey, rowTuple.length ? rowTuple : ["All"]);
    colKeyToTuple.set(colKey, colTuple.length ? colTuple : ["All"]);

    const cellId = `${rowKey}__${colKey}`;
    const cellStates = cellMap.get(cellId) || {};

    measureKeys.forEach((mKey) => {
      const raw = row[mKey];
      // We pass everything to pushAgg; it handles type checks
      // if (raw === undefined || raw === null) return; // Optional: skip nulls?
      // actually let's treat null as a value or skip. Let's skip undefined.
      if (raw === undefined) return;

      const valToPush = (typeof raw === 'string' && !isNaN(Number(raw)) && raw.trim() !== '')
        ? Number(raw)
        : raw;

      cloneAndPush(cellStates, mKey, valToPush);

      const rowState = rowTotals.get(rowKey) || {};
      cloneAndPush(rowState, mKey, valToPush);
      rowTotals.set(rowKey, rowState);

      const colState = colTotals.get(colKey) || {};
      cloneAndPush(colState, mKey, valToPush);
      colTotals.set(colKey, colState);

      cloneAndPush(grandTotals, mKey, valToPush);
    });

    cellMap.set(cellId, cellStates);
  });

  const rows = rowKeyToTuple.size
    ? Array.from(rowKeyToTuple.entries())
    : [["All", ["All"]]];

  const cols = colKeyToTuple.size
    ? Array.from(colKeyToTuple.entries())
    : [["All", ["All"]]];

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  cols.sort((a, b) => a[0].localeCompare(b[0]));

  return { rows, cols, cellMap, rowTotals, colTotals, grandTotals };
};

const valueLabel = (v) =>
  `${v.label} - ${aggLabel[v.agg]}${v.calc === "ratio" ? " (ratio)" : ""}`;

export const CustomPivotWorkbench = ({
  data = pivotSample,
  fields = defaultFields,
  initialConfig = null,
}) => {
  const dimensionFields = fields.filter((f) => f.type === "dimension");
  const measureFields = fields.filter((f) => f.type === "measure");

  const fieldLookup = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.key, f])),
    [fields]
  );

  const defaultConfig = {
    rows: ["country"],
    columns: ["orderSource"],
    filters: {},
    values: [
      {
        id: "unitsSold-sum",
        key: "unitsSold",
        label: "Units Sold",
        agg: "sum",
      },
      {
        id: "soldAmount-sum",
        key: "soldAmount",
        label: "Sold Amount",
        agg: "sum",
      },
    ],
  };

  const [config, setConfig] = useState(initialConfig || defaultConfig);

  // Effect to update config when initialConfig prop changes (e.g. switching datasets)
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  const [chartMode, setChartMode] = useState("both");
  const [chartValueId, setChartValueId] = useState("unitsSold-sum");
  const [fieldSearch, setFieldSearch] = useState("");
  const [editingFilter, setEditingFilter] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [draggingKey, setDraggingKey] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const [calcForm, setCalcForm] = useState({
    numerator: "unitsSold",
    denominator: "soldAmount",
    label: "Units / Amount",
  });

  const measureKeys = useMemo(
    () => {
      const keys = new Set(config.values.map(v => v.key));
      // Ensure any keys needed for ratios (denominator) are also included if they aren't explicit?
      // For now, simpler: we blindly aggregate any key present in `values`.
      return Array.from(keys);
    },
    [config.values]
  );

  const filterOptions = useMemo(() => {
    const out = {};
    dimensionFields.forEach((f) => {
      const unique = new Set();
      data.forEach((row) => unique.add(String(row[f.key])));
      out[f.key] = Array.from(unique).sort();
    });
    return out;
  }, [data, dimensionFields]);

  const pivot = useMemo(
    () => buildPivot(data, config, measureKeys),
    [config, data, measureKeys]
  );

  useEffect(() => {
    if (
      config.values.length &&
      !config.values.find((v) => v.id === chartValueId)
    ) {
      setChartValueId(config.values[0].id);
    }
  }, [chartValueId, config.values]);
  const assignField = (fieldKey, axis) => {
    const field = fieldLookup[fieldKey];
    if (!field) return;
    // Removed restriction: if (axis === "values" && field.type !== "measure") return;

    setConfig((prev) => {
      const rows = prev.rows.filter((r) => r !== fieldKey);
      const columns = prev.columns.filter((c) => c !== fieldKey);
      const filters = { ...prev.filters };
      const values = prev.values.filter(
        (v) => v.key !== fieldKey || axis === "values"
      );

      if (axis === "rows") rows.push(fieldKey);
      if (axis === "columns") columns.push(fieldKey);
      if (axis === "filters") filters[fieldKey] = filters[fieldKey] || [];
      if (axis === "values") {
        const id = `${fieldKey}-${Date.now()}`;
        // Default to 'count' or 'distinctCount' for dimensions, 'sum' for measures
        const defaultAgg = field.type === "dimension" ? "distinctCount" : "sum";

        values.push({
          id,
          key: fieldKey,
          label: field.label,
          agg: defaultAgg,
        });
        if (!chartValueId) setChartValueId(id);
      }

      return { rows, columns, filters, values };
    });
  };

  const handleDrop = (axis) => (e) => {
    e.preventDefault();
    const key = e.dataTransfer.getData("fieldKey");
    const type = e.dataTransfer.getData("fieldType");
    if (!key) return;
    // Removed restriction: if (axis === "values" && type !== "measure") return;

    assignField(key, axis);
  };

  const toggleFilterValue = (fieldKey, option) => {
    setConfig((prev) => {
      const next = { ...prev.filters };
      const current = new Set(next[fieldKey] || []);
      if (current.has(option)) current.delete(option);
      else current.add(option);

      next[fieldKey] = Array.from(current);
      return { ...prev, filters: next };
    });
  };

  const removeValue = (id) => {
    setConfig((prev) => ({
      ...prev,
      values: prev.values.filter((v) => v.id !== id),
    }));
  };

  const updateAgg = (id, agg) => {
    setConfig((prev) => ({
      ...prev,
      values: prev.values.map((v) => (v.id === id ? { ...v, agg } : v)),
    }));
  };

  const updateFormat = (id, format) => {
    setConfig((prev) => ({
      ...prev,
      values: prev.values.map((v) => (v.id === id ? { ...v, format } : v)),
    }));
  };

  const chartValue =
    config.values.find((v) => v.id === chartValueId) || config.values[0];

  const colEntries = pivot.cols.length ? pivot.cols : [["All", ["All"]]];
  const rowEntries = pivot.rows.length ? pivot.rows : [["All", ["All"]]];
  const hasColumns = config.columns.length > 0;

  const chartSeries = (hasColumns ? colEntries : [["All", ["All"]]]).map(
    ([key, tuple]) => ({
      key,
      label: hasColumns
        ? sanitizeKey(tuple)
        : chartValue
          ? valueLabel(chartValue)
          : "Total",
    })
  );

  const chartData = rowEntries.map(([rowKey, tuple]) => {
    const label = sanitizeKey(tuple);
    const row = { label };

    if (hasColumns) {
      colEntries.forEach(([colKey, colTuple]) => {
        const cell = pivot.cellMap.get(`${rowKey}__${colKey}`);
        const seriesKey = sanitizeKey(colTuple);
        row[seriesKey] = chartValue ? evaluateValue(cell, chartValue) : 0;
      });
    } else {
      const state = pivot.rowTotals.get(rowKey);
      const seriesKey = chartSeries[0]?.label || "Total";
      row[seriesKey] = chartValue ? evaluateValue(state, chartValue) : 0;
    }

    return row;
  });

  const addCalculatedRatio = () => {
    if (!calcForm.numerator || !calcForm.denominator) return;

    const id = `calc-${calcForm.numerator}-${calcForm.denominator
      }-${Date.now()}`;

    setConfig((prev) => ({
      ...prev,
      values: [
        ...prev.values,
        {
          id,
          key: calcForm.numerator,
          denominatorKey: calcForm.denominator,
          label: calcForm.label || "Calculated",
          agg: "sum",
          calc: "ratio",
        },
      ],
    }));

    setChartValueId(id);
  };



  const handleSave = () => {
    // Placeholder for save logic
    setToastMsg("Layout configuration saved successfully.");
  };

  const handleExport = () => {
    const q = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
    const rowHeaders = config.rows.length
      ? config.rows.map((r) => fieldLookup[r]?.label || r)
      : ["Rows"];

    let csvContent = "";

    // 1. Header Row
    const headerRow = [...rowHeaders];
    if (hasColumns) {
      colEntries.forEach(([, colTuple]) => {
        const colLabel = sanitizeKey(colTuple);
        config.values.forEach((v) => {
          headerRow.push(`${colLabel} - ${valueLabel(v)}`);
        });
      });
      // Row Total headers
      config.values.forEach((v) => {
        headerRow.push(`Total - ${valueLabel(v)}`);
      });
    } else {
      config.values.forEach((v) => {
        headerRow.push(valueLabel(v));
      });
    }
    csvContent += headerRow.map(q).join(",") + "\n";

    // 2. Data Rows
    rowEntries.forEach(([rowKey, rowTuple]) => {
      const rowData = [...(config.rows.length ? rowTuple : ["All"])];

      if (hasColumns) {
        colEntries.forEach(([colKey]) => {
          config.values.forEach((v) => {
            const cell = pivot.cellMap.get(`${rowKey}__${colKey}`);
            const val = evaluateValue(cell, v);
            rowData.push(val);
          });
        });
        // Row Totals
        config.values.forEach((v) => {
          const state = pivot.rowTotals.get(rowKey);
          const val = evaluateValue(state, v);
          rowData.push(val);
        });
      } else {
        config.values.forEach((v) => {
          const state = pivot.rowTotals.get(rowKey);
          const val = evaluateValue(state, v);
          rowData.push(val);
        });
      }
      csvContent += rowData.map(q).join(",") + "\n";
    });

    // 3. Footer (Grand Totals)
    const footerRow = new Array(rowHeaders.length).fill("");
    footerRow[0] = "Grand Total";

    if (hasColumns) {
      colEntries.forEach(([colKey]) => {
        config.values.forEach((v) => {
          const state = pivot.colTotals.get(colKey);
          const val = evaluateValue(state, v);
          footerRow.push(val);
        });
      });
      // Grand Total of Totals
      config.values.forEach((v) => {
        const val = evaluateValue(pivot.grandTotals, v);
        footerRow.push(val);
      });
    } else {
      config.values.forEach((v) => {
        const val = evaluateValue(pivot.grandTotals, v);
        footerRow.push(val);
      });
    }
    csvContent += footerRow.map(q).join(",") + "\n";

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pivot_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-lg shadow-sky-900/5 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-sky-500">
            Pivot studio
          </p>
        </div>

        {/* Chart mode buttons + Tools */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-slate-100 px-1 py-1">
            {["chart", "table", "both"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChartMode(mode)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${chartMode === mode
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                {mode === "both"
                  ? "Both"
                  : mode === "chart"
                    ? "Chart"
                    : "Table"}
              </button>
            ))}
          </div>

          <div className="ml-2 flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Reset configuration"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-rose-600"
              onClick={() =>
                setConfig({
                  rows: ["country"],
                  columns: ["orderSource"],
                  filters: {},
                  values: [
                    {
                      id: "unitsSold-sum",
                      key: "unitsSold",
                      label: "Units Sold",
                      agg: "sum",
                    },
                    {
                      id: "soldAmount-sum",
                      key: "soldAmount",
                      label: "Sold Amount",
                      agg: "sum",
                    },
                  ],
                })
              }
            >
              <RefreshCw className="h-4 w-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Export CSV"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-sky-600"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Save layout"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-sky-500 text-white shadow-sm hover:bg-sky-600"
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* LAYOUT GRID */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        {/* LEFT PANEL */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          {/* FIELDS PANEL */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">Fields</p>
                <p className="text-[11px] text-slate-500">
                  Drag to drop zones or tap to assign.
                </p>
              </div>

              <input
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search"
                className="h-8 w-36 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div className="mt-3 space-y-2">
              {[
                { label: "Dimensions", items: dimensionFields },
                { label: "Measures", items: measureFields },
              ].map((bucket) => (
                <div key={bucket.label}>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    {bucket.label}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-2">
                    {bucket.items
                      .filter((f) =>
                        f.label
                          .toLowerCase()
                          .includes(fieldSearch.toLowerCase())
                      )
                      .map((f) => (
                        <motion.button
                          key={f.key}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("fieldKey", f.key);
                            e.dataTransfer.setData("fieldType", f.type);
                            setDraggingKey(f.key);
                          }}
                          onDragEnd={() => setDraggingKey(null)}
                          onClick={() =>
                            assignField(
                              f.key,
                              f.type === "measure" ? "values" : "rows"
                            )
                          }
                          whileHover={{ y: -1 }}
                          className={`group flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${f.type === "measure"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-sky-200 bg-sky-50 text-sky-800"
                            } ${draggingKey === f.key ? "opacity-70" : ""}`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                          {f.label}
                        </motion.button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FILTERS */}
          <AxisDropZone
            title="Filters"
            description="Limit records by dimension values."
            axis="filters"
            items={config.filters}
            onDrop={handleDrop("filters")}
            render={() => (
              <div className="space-y-1">
                {Object.keys(config.filters).length === 0 && (
                  <p className="text-xs text-slate-500">
                    Drag dimensions here to add filters.
                  </p>
                )}

                {Object.entries(config.filters).map(([key, values]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                      <span>{fieldLookup[key]?.label || key}</span>

                      <div className="flex items-center gap-1">
                        <button
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50"
                          onClick={() =>
                            setEditingFilter((prev) =>
                              prev === key ? null : key
                            )
                          }
                        >
                          {values?.length ? `${values.length} selected` : "Add"}
                        </button>

                        <button
                          className="rounded-full px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100"
                          onClick={() =>
                            setConfig((prev) => {
                              const next = { ...prev.filters };
                              delete next[key];
                              return { ...prev, filters: next };
                            })
                          }
                        >
                          x
                        </button>
                      </div>
                    </div>

                    {editingFilter === key && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        <input
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          placeholder="Search values"
                          className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />

                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {(filterOptions[key] || [])
                            .filter((opt) =>
                              opt
                                .toLowerCase()
                                .includes(filterSearch.toLowerCase())
                            )
                            .map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 text-xs text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={config.filters[key]?.includes(opt)}
                                  onChange={() => toggleFilterValue(key, opt)}
                                />
                                {opt}
                              </label>
                            ))}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <button
                            className="text-[11px] text-rose-500 hover:underline"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                filters: { ...prev.filters, [key]: [] },
                              }))
                            }
                          >
                            Clear
                          </button>

                          <button
                            className="rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white"
                            onClick={() => {
                              setEditingFilter(null);
                              setFilterSearch("");
                            }}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div >
                ))}
              </div >
            )}
          />

          {/* ROWS */}
          <AxisDropZone
            title="Rows"
            description="Hierarchical row labels."
            axis="rows"
            items={config.rows}
            onDrop={handleDrop("rows")}
            render={() => (
              <RowPills
                keys={config.rows}
                fieldLookup={fieldLookup}
                onRemove={(key) =>
                  setConfig((prev) => ({
                    ...prev,
                    rows: prev.rows.filter((r) => r !== key),
                  }))
                }
              />
            )}
          />

          {/* COLUMNS */}
          <AxisDropZone
            title="Columns"
            description="Create headers across the top."
            axis="columns"
            items={config.columns}
            onDrop={handleDrop("columns")}
            render={() => (
              <RowPills
                keys={config.columns}
                fieldLookup={fieldLookup}
                onRemove={(key) =>
                  setConfig((prev) => ({
                    ...prev,
                    columns: prev.columns.filter((r) => r !== key),
                  }))
                }
              />
            )}
          />

          {/* VALUES */}
          <AxisDropZone
            title="Values"
            description="Measures with aggregation."
            axis="values"
            items={config.values}
            onDrop={handleDrop("values")}
            render={() => (
              <div className="space-y-2">
                {config.values.length === 0 && (
                  <p className="text-xs text-slate-500">Drop measures here.</p>
                )}

                {config.values.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-amber-800">
                        {valueLabel(v)}
                      </div>

                      {v.calc === "ratio" && v.denominatorKey && (
                        <div className="text-[11px] text-amber-700">
                          {fieldLookup[v.key]?.label || v.key} /{" "}
                          {fieldLookup[v.denominatorKey]?.label ||
                            v.denominatorKey}
                        </div>
                      )}
                    </div>

                    <select
                      value={v.agg}
                      onChange={(e) => updateAgg(v.id, e.target.value)}
                      className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      {[
                        "sum",
                        "avg",
                        "count",
                        "distinctCount",
                        "min",
                        "max",
                      ].map((agg) => (
                        <option key={agg} value={agg}>
                          {aggLabel[agg]}
                        </option>
                      ))}
                    </select>

                    <select
                      value={v.format || "number"}
                      onChange={(e) => updateFormat(v.id, e.target.value)}
                      className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      <option value="number">1,234</option>
                      <option value="currency">₹</option>
                      <option value="percent">%</option>
                      <option value="decimal">1.00</option>
                      <option value="compact">1K</option>
                    </select>

                    <button
                      className="text-sm text-amber-700 hover:text-rose-500"
                      onClick={() => removeValue(v.id)}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          />

          {/* CALCULATED RATIO */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">
                Calculated ratio
              </p>

              <button
                className="text-[11px] font-semibold text-sky-700 hover:underline"
                onClick={addCalculatedRatio}
              >
                Add
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={calcForm.numerator}
                onChange={(e) =>
                  setCalcForm((prev) => ({
                    ...prev,
                    numerator: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                {measureFields.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                value={calcForm.denominator}
                onChange={(e) =>
                  setCalcForm((prev) => ({
                    ...prev,
                    denominator: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                {measureFields.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              value={calcForm.label}
              onChange={(e) =>
                setCalcForm((prev) => ({
                  ...prev,
                  label: e.target.value,
                }))
              }
              placeholder="Name"
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            />

            <p className="mt-2 text-[11px] text-slate-500">
              Creates numerator / denominator with the selected aggregation.
            </p>
          </div>
        </div >

        {/* ========================== RIGHT SIDE (CHART + TABLE) ========================== */}
        < div className="col-span-12 lg:col-span-8 space-y-3" >
          {/* BAR CHART */}
          {
            chartMode !== "table" && chartValue && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Chart
                    </p>

                    <p className="text-sm font-semibold text-slate-800">
                      {valueLabel(chartValue)} by{" "}
                      {config.rows.length
                        ? config.rows
                          .map((r) => fieldLookup[r]?.label || r)
                          .join(" / ")
                        : "All rows"}
                    </p>
                  </div>

                  <select
                    value={chartValueId}
                    onChange={(e) => setChartValueId(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    {config.values.map((v) => (
                      <option key={v.id} value={v.id}>
                        {valueLabel(v)}
                      </option>
                    ))}
                  </select>
                </div >

                <div className="mt-3 h-72">
                  <ResponsiveContainer>
                    <BarChart
                      data={chartData}
                      margin={{ left: 0, right: 10, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />

                      {chartSeries.map((s, idx) => (
                        <Bar
                          key={s.key}
                          dataKey={s.label}
                          fill={colors[idx % colors.length]}
                          radius={[6, 6, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div >
            )
          }

          {/* ================================= PIVOT TABLE ================================= */}
          {
            chartMode !== "chart" && config.values.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Pivot table
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {config.rows.length || config.columns.length
                        ? "Interactive cross-tab"
                        : "Grand totals"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{data.length} rows</span>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border border-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {(config.rows.length ? config.rows : ["All"]).map((r) => (
                          <th
                            key={r}
                            className="px-2 py-2 text-left font-semibold text-slate-700 border border-slate-200"
                            rowSpan={hasColumns ? 2 : 1}
                          >
                            {r === "All" ? "Rows" : fieldLookup[r]?.label || r}
                          </th>
                        ))}

                        {hasColumns ? (
                          <>
                            {colEntries.map(([colKey, tuple]) => (
                              <th
                                key={colKey}
                                colSpan={config.values.length}
                                className="px-2 py-2 text-center font-semibold text-slate-700 border border-slate-200"
                              >
                                {sanitizeKey(tuple)}
                              </th>
                            ))}

                            <th
                              colSpan={config.values.length}
                              className="px-2 py-2 text-center font-semibold text-slate-700 border border-slate-200"
                            >
                              Totals
                            </th>
                          </>
                        ) : (
                          config.values.map((v) => (
                            <th
                              key={v.id}
                              className="px-2 py-2 text-center font-semibold text-slate-700 border border-slate-200"
                            >
                              {valueLabel(v)}
                            </th>
                          ))
                        )}
                      </tr>

                      {hasColumns && (
                        <tr>
                          {colEntries.flatMap(([colKey]) =>
                            config.values.map((v) => (
                              <th
                                key={`${colKey}-${v.id}`}
                                className="px-2 py-1 text-center font-semibold text-slate-600 border border-slate-200"
                              >
                                {valueLabel(v)}
                              </th>
                            ))
                          )}

                          {config.values.map((v) => (
                            <th
                              key={`total-${v.id}`}
                              className="px-2 py-1 text-center font-semibold text-slate-600 border border-slate-200"
                            >
                              {valueLabel(v)}
                            </th>
                          ))}
                        </tr>
                      )}
                    </thead>

                    <tbody>
                      {rowEntries.map(([rowKey, tuple], idx) => (
                        <tr
                          key={rowKey}
                          className={
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                          }
                        >
                          {(config.rows.length ? tuple : ["All"]).map(
                            (val, i) => (
                              <td
                                key={`${rowKey}-${i}`}
                                className="px-2 py-1 text-left text-slate-700 border border-slate-200"
                              >
                                {val}
                              </td>
                            )
                          )}

                          {hasColumns
                            ? colEntries.flatMap(([colKey]) =>
                              config.values.map((v) => {
                                const cell = pivot.cellMap.get(
                                  `${rowKey}__${colKey}`
                                );
                                const val = evaluateValue(cell, v);
                                return (
                                  <td
                                    key={`${rowKey}-${colKey}-${v.id}`}
                                    className="px-2 py-1 text-right text-slate-800 border border-slate-200"
                                  >
                                    {formatCell(val, v)}
                                  </td>
                                );
                              })
                            )
                            : config.values.map((v) => {
                              const state = pivot.rowTotals.get(rowKey);
                              const val = evaluateValue(state, v);
                              return (
                                <td
                                  key={`${rowKey}-value-${v.id}`}
                                  className="px-2 py-1 text-right text-slate-800 border border-slate-200"
                                >
                                  {formatCell(val, v)}
                                </td>
                              );
                            })}

                          {hasColumns &&
                            config.values.map((v) => {
                              const state = pivot.rowTotals.get(rowKey);
                              const val = evaluateValue(state, v);
                              return (
                                <td
                                  key={`${rowKey}-total-${v.id}`}
                                  className="px-2 py-1 text-right font-semibold text-slate-900 border border-slate-200 bg-slate-50"
                                >
                                  {formatCell(val, v)}
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      {hasColumns ? (
                        <tr className="bg-slate-100">
                          <td
                            colSpan={config.rows.length || 1}
                            className="px-2 py-2 text-left font-semibold text-slate-800 border border-slate-200"
                          >
                            Column totals
                          </td>

                          {colEntries.flatMap(([colKey]) =>
                            config.values.map((v) => {
                              const state = pivot.colTotals.get(colKey);
                              const val = evaluateValue(state, v);
                              return (
                                <td
                                  key={`coltotal-${colKey}-${v.id}`}
                                  className="px-2 py-1 text-right font-semibold text-slate-900 border border-slate-200"
                                >
                                  {formatCell(val, v)}
                                </td>
                              );
                            })
                          )}

                          {config.values.map((v) => {
                            const val = evaluateValue(pivot.grandTotals, v);
                            return (
                              <td
                                key={`grand-${v.id}`}
                                className="px-2 py-1 text-right font-bold text-slate-900 border border-slate-200 bg-slate-50"
                              >
                                {formatCell(val, v)}
                              </td>
                            );
                          })}
                        </tr>
                      ) : (
                        <tr className="bg-slate-100">
                          <td
                            colSpan={config.rows.length || 1}
                            className="px-2 py-2 text-left font-semibold text-slate-800 border border-slate-200"
                          >
                            Grand total
                          </td>

                          {config.values.map((v) => {
                            const val = evaluateValue(pivot.grandTotals, v);
                            return (
                              <td
                                key={`grand-${v.id}`}
                                className="px-2 py-1 text-right font-bold text-slate-900 border border-slate-200"
                              >
                                {formatCell(val, v)}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </motion.div>
            )
          }

          {
            config.values.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Add at least one measure to the Values shelf to generate a pivot
                table and chart.
              </div>
            )
          }
        </div >
      </div >

      <AnimatePresence>
        {toastMsg && (
          <Toast
            message={toastMsg}
            onClose={() => setToastMsg(null)}
          />
        )}
      </AnimatePresence>
    </div >
  );
};

/* -------------------------- AXIS WRAPPER COMPONENT -------------------------- */
const AxisDropZone = ({ title, description, onDrop, render }) => {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-3 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-2">{render()}</div>
    </div>
  );
};

/* ------------------------------- ROW PILLS -------------------------------- */
const RowPills = ({ keys, fieldLookup, onRemove }) => {
  if (!keys.length)
    return <p className="text-xs text-slate-500">Drop fields here.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800"
        >
          {fieldLookup[key]?.label || key}

          <button
            className="text-sm text-sky-700 hover:text-rose-500"
            onClick={() => onRemove(key)}
          >
            x
          </button>
        </span>
      ))}
    </div>
  );
};

export default CustomPivotWorkbench;
