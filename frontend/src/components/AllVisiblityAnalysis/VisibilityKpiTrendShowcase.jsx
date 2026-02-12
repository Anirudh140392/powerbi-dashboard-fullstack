import React, { useMemo, useState, useContext, createContext } from "react";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import {
  Filter,
  LineChart as LineChartIcon,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Box } from "@mui/material";

/* -------------------------------------------------------------------------- */
/*                               Utility helper                               */
/* -------------------------------------------------------------------------- */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/*                           Small UI components (local)                      */
/* -------------------------------------------------------------------------- */

/* Card */

const Card = ({ className, children }) => (
  <div
    className={cn(
      "rounded-lg border border-slate-200 bg-white shadow-sm",
      className
    )}
  >
    {children}
  </div>
);

const CardHeader = ({ className, children }) => (
  <div className={cn("px-4 py-3", className)}>{children}</div>
);

const CardTitle = ({ className, children }) => (
  <h2 className={cn("font-semibold text-slate-900", className)}>{children}</h2>
);

const CardContent = ({ className, children }) => (
  <div className={cn("px-4 py-3", className)}>{children}</div>
);

/* Button */

const Button = ({
  className,
  variant = "solid",
  size = "md",
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    solid: "bg-blue-600 text-white hover:bg-blue-700",
    outline:
      "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4",
    lg: "h-10 px-5 text-base",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

/* Badge */

const Badge = ({ className, children }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700",
      className
    )}
  >
    {children}
  </span>
);

/* Separator */

const Separator = ({ orientation = "horizontal", className }) => {
  const base = orientation === "vertical" ? "h-full w-px" : "h-px w-full";
  return <div className={cn("bg-slate-200", base, className)} />;
};

/* Input */

const Input = ({ className, ...props }) => (
  <input
    className={cn(
      "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
      className
    )}
    {...props}
  />
);

/* Checkbox */

const Checkbox = ({ checked, onCheckedChange, className }) => (
  <input
    type="checkbox"
    className={cn(
      "h-4 w-4 rounded border border-slate-300 text-blue-600 focus:ring-blue-500",
      className
    )}
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
  />
);

/* ScrollArea */

const ScrollArea = ({ className, children }) => (
  <div className={cn("overflow-auto", className)}>{children}</div>
);

/* Dialog */

const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={() => onOpenChange?.(false)}
    >
      <div
        className="relative w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ className, children }) => (
  <div
    className={cn(
      "rounded-lg bg-white shadow-xl border border-slate-200",
      className
    )}
  >
    {children}
  </div>
);
const DialogHeader = ({ className, children }) => (
  <div className={cn(className)}>{children}</div>
);
const DialogFooter = ({ className, children }) => (
  <div className={cn("flex justify-end gap-2", className)}>{children}</div>
);
const DialogTitle = ({ className, children }) => (
  <h3 className={cn("text-base font-semibold text-slate-900", className)}>
    {children}
  </h3>
);

/* Tabs */

const TabsContext = createContext(null);

const Tabs = ({ value, onValueChange, className, children }) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={className}>{children}</div>
  </TabsContext.Provider>
);

const TabsList = ({ className, children }) => (
  <div className={cn("inline-flex rounded-md bg-slate-100 p-1", className)}>
    {children}
  </div>
);

const TabsTrigger = ({ value, className, children }) => {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;

  return (
    <button
      type="button"
      onClick={() => ctx?.onValueChange?.(value)}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md font-medium transition",
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-600 hover:bg-slate-200",
        className
      )}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, className, children }) => {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
};

/* Select */

const SelectContext = createContext(null);

const Select = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = ({ className, children }) => {
  const ctx = useContext(SelectContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(!ctx.open)}
      className={cn(
        "flex h-9 w-40 items-center justify-between rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm hover:bg-slate-50",
        className
      )}
    >
      {children}
      <span className="ml-2 text-xs text-slate-500">▾</span>
    </button>
  );
};

const SelectValue = ({ placeholder }) => {
  const ctx = useContext(SelectContext);
  const { value } = ctx || {};
  return (
    <span className={cn("truncate", !value && "text-slate-400")}>
      {value || placeholder}
    </span>
  );
};

const SelectContent = ({ className, children }) => {
  const ctx = useContext(SelectContext);
  if (!ctx?.open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg",
        className
      )}
    >
      <div className="max-h-60 overflow-auto py-1">{children}</div>
    </div>
  );
};

const SelectItem = ({ value, children }) => {
  const ctx = useContext(SelectContext);
  const selected = ctx?.value === value;

  return (
    <div
      role="button"
      className={cn(
        "cursor-pointer px-3 py-1.5 text-sm hover:bg-slate-100",
        selected && "bg-slate-100 font-medium"
      )}
      onClick={() => {
        ctx?.onValueChange?.(value);
        ctx?.setOpen(false);
      }}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                             Data & dynamic config                          */
/* -------------------------------------------------------------------------- */

/** Base days for trend charts */
const DAYS = Array.from({ length: 20 }).map((_, i) => `0${i + 6} Nov'25`);

/** Raw config – you can change this and UI will adapt */
const RAW_DATA = {
  cities: ["All India", "Delhi NCR", "Mumbai", "Bengaluru", "Kolkata"],
  categories: ["Cassata", "Core Tubs", "Cup", "Sandwich"],
  brands: [
    { id: "kwality-walls", name: "Kwality Walls", category: "All" },
    { id: "amul", name: "Amul", category: "Cassata" },
    { id: "mother-dairy", name: "Mother Dairy", category: "Core Tubs" },
    { id: "vadilal", name: "Vadilal", category: "Cup" },
    { id: "havmor", name: "Havmor", category: "Sandwich" },
    { id: "baskin-robbins", name: "Baskin Robbins", category: "Core Tubs" },
    { id: "london-dairy", name: "London Dairy", category: "Premium" },
    { id: "cream-bell", name: "Cream Bell", category: "Cup" },
  ],
  skus: [
    { id: "amul-tricone", name: "Amul Tricone 120ml", brandId: "amul", category: "Cone" },
    { id: "md-cup", name: "Mother Dairy Vanilla Cup", brandId: "mother-dairy", category: "Cup" },
    { id: "vadilal-bombay", name: "Vadilal Bombay Kulfi", brandId: "vadilal", category: "Stick" },
    { id: "havmor-block", name: "Havmor Choco Block", brandId: "havmor", category: "Block" },
    { id: "br-scoop", name: "BR Gold Medal Ribbon", brandId: "baskin-robbins", category: "Scoop" },
    { id: "london-tub", name: "London Dairy Tiramisu", brandId: "london-dairy", category: "Tub" },
  ],
  keywords: [
    {
      id: "kw-1",
      keyword: "best chocolate ice cream",
      brandId: "kwality-walls",
      category: "Core Tubs",
    },
    {
      id: "kw-2",
      keyword: "sugar free ice cream",
      brandId: "amul",
      category: "Eqic",
    },
    {
      id: "kw-3",
      keyword: "vanilla ice cream cup",
      brandId: "mother-dairy",
      category: "Cup",
    },
    {
      id: "kw-4",
      keyword: "family pack ice cream",
      brandId: "vadilal",
      category: "Core Tubs",
    },
    {
      id: "kw-5",
      keyword: "premium ice cream brands",
      brandId: "london-dairy",
      category: "Premium",
    },
  ],
};

/** Derived option lists for filters */
const CITIES = RAW_DATA.cities;
const CATEGORY_OPTIONS = RAW_DATA.categories;
const BRAND_OPTIONS = RAW_DATA.brands.map((b) => b.name);
const SKU_OPTIONS = RAW_DATA.skus.map((s) => s.name);
const KEYWORD_OPTIONS = RAW_DATA.keywords.map((k) => k.keyword);

/** ID <-> Name maps */
const BRAND_ID_TO_NAME = {};
const BRAND_NAME_TO_ID = {};
RAW_DATA.brands.forEach((b) => {
  BRAND_ID_TO_NAME[b.id] = b.name;
  BRAND_NAME_TO_ID[b.name] = b.id;
});

const SKU_ID_TO_NAME = {};
const SKU_NAME_TO_ID = {};
RAW_DATA.skus.forEach((s) => {
  SKU_ID_TO_NAME[s.id] = s.name;
  SKU_NAME_TO_ID[s.name] = s.id;
});

/** Keyword maps */
const KEYWORD_ID_TO_NAME = {};
const KEYWORD_NAME_TO_ID = {};
RAW_DATA.keywords.forEach((k) => {
  KEYWORD_ID_TO_NAME[k.id] = k.keyword;
  KEYWORD_NAME_TO_ID[k.keyword] = k.id;
});

/** Build mock metrics and trends limited to the 4 SOS KPIs */
const buildDataModel = () => {
  const days = DAYS;
  const brandSummaryByCity = {};
  const skuSummaryByCity = {};
  const keywordSummaryByCity = {};
  const brandTrendsByCity = {};
  const skuTrendsByCity = {};
  const keywordTrendsByCity = {};

  RAW_DATA.cities.forEach((city, cityIdx) => {
    // BRAND SUMMARY (only 4 metrics)
    brandSummaryByCity[city] = RAW_DATA.brands.map((brand, brandIdx) => {
      return {
        id: brand.id,
        name: brand.name,
        category: brand.category,

        overall_sos: 25 + brandIdx * 1.2 + cityIdx * 0.6,
        sponsored_sos: 12 + brandIdx * 0.8 + cityIdx * 0.4,
        organic_sos: 18 + brandIdx * 1.0 + cityIdx * 0.5,
        display_sos: 10 + brandIdx * 0.5 + cityIdx * 0.3,
      };
    });

    // SKU SUMMARY (only 4 metrics)
    skuSummaryByCity[city] = RAW_DATA.skus.map((sku, skuIdx) => {
      return {
        id: sku.id,
        name: sku.name,
        brandId: sku.brandId,
        brandName: BRAND_ID_TO_NAME[sku.brandId],
        category: sku.category,

        overall_sos: 22 + skuIdx * 0.9 + cityIdx * 0.5,
        sponsored_sos: 10 + skuIdx * 0.6 + cityIdx * 0.3,
        organic_sos: 13 + skuIdx * 0.7 + cityIdx * 0.4,
        display_sos: 8 + skuIdx * 0.5 + cityIdx * 0.25,
      };
    });

    // KEYWORD SUMMARY (only 4 metrics)
    keywordSummaryByCity[city] = RAW_DATA.keywords.map((kw, kwIdx) => {
      return {
        id: kw.id,
        keyword: kw.keyword,
        brandId: kw.brandId,
        brandName: BRAND_ID_TO_NAME[kw.brandId],
        category: kw.category,

        overall_sos: 15 + kwIdx * 0.8 + cityIdx * 0.4,
        sponsored_sos: 7 + kwIdx * 0.4 + cityIdx * 0.2,
        organic_sos: 10 + kwIdx * 0.6 + cityIdx * 0.3,
        display_sos: 4 + kwIdx * 0.3 + cityIdx * 0.15,
      };
    });

    // BRAND TRENDS (only 4 metrics)
    brandTrendsByCity[city] = {};
    RAW_DATA.brands.forEach((brand, brandIdx) => {
      brandTrendsByCity[city][brand.id] = days.map((date, idx) => ({
        date,
        overall_sos: 25 + Math.sin(idx / 4 + brandIdx) * 3,
        sponsored_sos: 12 + Math.cos(idx / 5 + brandIdx) * 2,
        organic_sos: 18 + Math.sin(idx / 6 + brandIdx) * 2.5,
        display_sos: 10 + Math.cos(idx / 7 + brandIdx) * 1.8,
      }));
    });

    // SKU TRENDS (only 4 metrics)
    skuTrendsByCity[city] = {};
    RAW_DATA.skus.forEach((sku, skuIdx) => {
      skuTrendsByCity[city][sku.id] = days.map((date, idx) => ({
        date,
        overall_sos: 22 + Math.sin(idx / 4 + skuIdx) * 2.5,
        sponsored_sos: 10 + Math.cos(idx / 5 + skuIdx) * 1.5,
        organic_sos: 13 + Math.sin(idx / 6 + skuIdx) * 1.8,
        display_sos: 8 + Math.cos(idx / 7 + skuIdx) * 1.2,
      }));
    });

    // KEYWORD TRENDS (only 4 metrics)
    keywordTrendsByCity[city] = {};
    RAW_DATA.keywords.forEach((kw, kwIdx) => {
      keywordTrendsByCity[city][kw.id] = days.map((date, idx) => ({
        date,
        overall_sos: 15 + Math.sin(idx / 4 + kwIdx) * 2,
        sponsored_sos: 7 + Math.cos(idx / 5 + kwIdx) * 1.2,
        organic_sos: 10 + Math.sin(idx / 6 + kwIdx) * 1.6,
        display_sos: 4 + Math.cos(idx / 7 + kwIdx) * 0.9,
      }));
    });
  });

  return {
    days,
    brandSummaryByCity,
    skuSummaryByCity,
    keywordSummaryByCity,
    brandTrendsByCity,
    skuTrendsByCity,
    keywordTrendsByCity,
  };
};

const DATA_MODEL = buildDataModel();

/* -------------------------------------------------------------------------- */
/*                               Filter Dialog                                */
/* -------------------------------------------------------------------------- */

const FilterDialog = ({ open, onClose, mode, value, onChange }) => {
  const [activeTab, setActiveTab] = useState(
    mode === "brand" ? "category" : "keyword"
  );
  const [search, setSearch] = useState("");

  const getBrandOptions = () => {
    let brands = RAW_DATA.brands;
    if (value.categories.length) {
      brands = brands.filter((b) => value.categories.includes(b.category));
    }
    return brands.map((b) => b.name);
  };

  const getSkuOptions = () => {
    let skus = RAW_DATA.skus;
    if (value.categories.length) {
      skus = skus.filter((s) => value.categories.includes(s.category));
    }
    if (value.brands.length) {
      const allowedBrandIds = new Set(
        value.brands.map((name) => BRAND_NAME_TO_ID[name]).filter(Boolean)
      );
      skus = skus.filter((s) => allowedBrandIds.has(s.brandId));
    }
    return skus.map((s) => s.name);
  };

  const getKeywordOptions = () => {
    let kws = RAW_DATA.keywords;
    if (value.categories.length) {
      kws = kws.filter((k) => value.categories.includes(k.category));
    }
    if (value.brands.length) {
      const allowedBrandIds = new Set(
        value.brands.map((name) => BRAND_NAME_TO_ID[name]).filter(Boolean)
      );
      kws = kws.filter((k) => allowedBrandIds.has(k.brandId));
    }
    return kws.map((k) => k.keyword);
  };

  const tabOptions = ["category", "brand", "keyword"];

  const getListForTab = () => {
    if (activeTab === "category") return CATEGORY_OPTIONS;
    if (activeTab === "brand") return getBrandOptions();
    return getKeywordOptions();
  };

  const list = useMemo(() => {
    const base = getListForTab() || [];
    return base.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeTab, search, value]);

  const currentKey =
    activeTab === "category"
      ? "categories"
      : activeTab === "brand"
        ? "brands"
        : "keywords";

  const handleToggle = (type, item) => {
    const current = new Set(value[type]);
    if (current.has(item)) current.delete(item);
    else current.add(item);

    const next = { ...value, [type]: Array.from(current) };

    if (type === "categories") {
      next.brands = [];
      next.skus = [];
      next.keywords = [];
    } else if (type === "brands") {
      next.skus = [];
      next.keywords = [];
    }

    onChange(next);
  };

  const handleSelectAll = (type, items) => {
    const allSelected =
      items.length > 0 && items.every((i) => value[type].includes(i));
    const next = { ...value, [type]: allSelected ? [] : items.slice() };

    if (type === "categories") {
      next.brands = [];
      next.skus = [];
      next.keywords = [];
    } else if (type === "brands") {
      next.skus = [];
      next.keywords = [];
    }

    onChange(next);
  };

  const allItemsForCurrentTab = getListForTab();
  const allSelectedForCurrentTab =
    allItemsForCurrentTab.length > 0 &&
    allItemsForCurrentTab.every((i) => value[currentKey].includes(i));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg font-semibold">Filters</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[360px]">
          {/* Left rail */}
          <div className="flex w-56 flex-col border-r bg-slate-50/80 px-4 py-4">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filters
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1"
            >
              <TabsList className="flex flex-col items-stretch gap-1 bg-transparent p-0">
                {tabOptions.map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    {t === "category" && "Category"}
                    {t === "brand" && "Brand"}
                    {t === "keyword" && "Keyword"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Main pane */}
          <div className="flex-1 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm bg-slate-50"
              />
              <button
                className="text-sm font-medium text-blue-600 hover:underline"
                onClick={() =>
                  handleSelectAll(currentKey, allItemsForCurrentTab)
                }
              >
                {allSelectedForCurrentTab ? "Clear all" : "Select all"}
              </button>
            </div>

            <ScrollArea className="mt-4 h-64 rounded-md border bg-slate-50/60">
              <div className="space-y-1 p-3">
                {list.map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <Checkbox
                      checked={value[currentKey].includes(item)}
                      onCheckedChange={() => handleToggle(currentKey, item)}
                    />
                    <span className="truncate">{item}</span>
                  </label>
                ))}

                {list.length === 0 && (
                  <div className="px-3 py-8 text-center text-xs text-slate-400">
                    No options found.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MetricChip = ({ label, color, active, onClick }) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.8,
        px: 1.5,
        py: 0.6,
        borderRadius: "999px",
        cursor: "pointer",
        border: `1px solid ${active ? color : "#E5E7EB"}`,
        backgroundColor: active ? `${color}20` : "white",
        color: active ? color : "#0f172a",
        fontSize: "12px",
        fontWeight: 600,
        userSelect: "none",
        transition: "all 0.15s ease",
      }}
    >
      {/* CHECKBOX ICON */}
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `2px solid ${active ? color : "#CBD5E1"}`,
          backgroundColor: active ? color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {active && "✓"}
      </Box>

      {label}
    </Box>
  );
};

/* -------------------------------------------------------------------------- */
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */

const TrendView = ({ mode, filters, city, onBackToTable, onSwitchToKpi }) => {
  // ✅ single selected KPI
  const [activeMetric, setActiveMetric] = useState("overall_sos");

  const metricMeta =
    KPI_KEYS.find((m) => m.key === activeMetric) || KPI_KEYS[0];

  const isBrandMode = mode === "brand";

  /* ---------------- SELECTED IDS ---------------- */
  const selectedIds = useMemo(() => {
    if (isBrandMode) {
      let rows = DATA_MODEL.brandSummaryByCity[city] || [];

      if (filters.categories.length)
        rows = rows.filter((r) => filters.categories.includes(r.category));
      if (filters.brands.length)
        rows = rows.filter((r) => filters.brands.includes(r.name));

      return rows.length ? rows.slice(0, 4).map((r) => r.id) : [];
    }

    let rows = DATA_MODEL.skuSummaryByCity[city] || [];

    if (filters.categories.length)
      rows = rows.filter((r) => filters.categories.includes(r.category));
    if (filters.brands.length)
      rows = rows.filter((r) => filters.brands.includes(r.brandName));
    if (filters.skus.length)
      rows = rows.filter((r) => filters.skus.includes(r.name));

    return rows.length ? rows.slice(0, 5).map((r) => r.id) : [];
  }, [isBrandMode, filters, city]);

  const selectedLabels = useMemo(
    () =>
      selectedIds.map((id) =>
        isBrandMode ? BRAND_ID_TO_NAME[id] : SKU_ID_TO_NAME[id]
      ),
    [selectedIds, isBrandMode]
  );

  /* ---------------- CHART DATA ---------------- */
  const chartData = useMemo(() => {
    const days = DATA_MODEL.days;

    return days.map((date, idx) => {
      const row = { date };

      selectedIds.forEach((id) => {
        const series = isBrandMode
          ? DATA_MODEL.brandTrendsByCity?.[city]?.[id]
          : DATA_MODEL.skuTrendsByCity?.[city]?.[id];

        if (series) row[id] = series[idx]?.[activeMetric] ?? null;
      });

      return row;
    });
  }, [selectedIds, city, isBrandMode, activeMetric]);

  const formatValue = (v) => {
    if (metricMeta.unit) return `${v}${metricMeta.unit}`;
    if (metricMeta.prefix) return `${metricMeta.prefix}${v}`;
    if (metricMeta.suffix) return `${v}${metricMeta.suffix}`;
    return v;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex items-start justify-between border-b pb-3">
        <div className="space-y-2">
          {/* KPI CHIP SELECTOR */}
          <Box display="flex" gap={1} flexWrap="wrap">
            {KPI_KEYS.map((m) => (
              <MetricChip
                key={m.key}
                label={m.label}
                color={m.color}
                active={activeMetric === m.key}
                onClick={() => setActiveMetric(m.key)}
              />
            ))}
          </Box>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{isBrandMode ? "Brands:" : "SKUs:"}</span>
            {selectedLabels.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
            <Separator orientation="vertical" className="mx-1 h-4" />
            <span>{city}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSwitchToKpi}>
            <BarChart3 className="mr-1 h-4 w-4" />
            Compare by KPIs
          </Button>
          <Button variant="ghost" size="sm" onClick={onBackToTable}>
            Back to list
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={11} tickLine={false} dy={6} />
              <YAxis
                tickLine={false}
                fontSize={11}
                tickFormatter={formatValue}
              />
              <Tooltip formatter={formatValue} />
              <Legend />

              {selectedIds.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={isBrandMode ? BRAND_ID_TO_NAME[id] : SKU_ID_TO_NAME[id]}
                  dot={false}
                  stroke={metricMeta.color}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                             KPI Compare View (4 tiles)                     */
/* -------------------------------------------------------------------------- */

const KPI_KEYS = [
  {
    key: "overall_sos",
    label: "Overall SOS",
    color: "#2563EB", // blue
    unit: "%",
  },
  {
    key: "sponsored_sos",
    label: "Sponsored SOS",
    color: "#DC2626", // red
    unit: "%",
  },
  {
    key: "organic_sos",
    label: "Organic SOS",
    color: "#16A34A", // green
    unit: "%",
  },
  {
    key: "display_sos",
    label: "Display SOS",
    color: "#7C3AED", // purple
    unit: "%",
  },
];

const KpiCompareView = ({ mode, filters, city, onBackToTrend }) => {
  const isBrandMode = mode === "brand";

  const selectedIds = useMemo(() => {
    if (isBrandMode) {
      const allRows = DATA_MODEL.brandSummaryByCity[city] || [];
      let rows = allRows;
      if (filters.categories.length)
        rows = rows.filter((r) => filters.categories.includes(r.category));
      if (filters.brands.length)
        rows = rows.filter((r) => filters.brands.includes(r.name));
      const ids = rows.map((r) => r.id);
      if (ids.length) return ids.slice(0, 4);
      return allRows.slice(0, 3).map((r) => r.id);
    } else if (mode === "sku") {
      const allRows = DATA_MODEL.skuSummaryByCity[city] || [];
      let rows = allRows;
      if (filters.categories.length)
        rows = rows.filter((r) => filters.categories.includes(r.category));
      if (filters.brands.length)
        rows = rows.filter((r) => filters.brands.includes(r.brandName));
      if (filters.skus.length)
        rows = rows.filter((r) => filters.skus.includes(r.name));
      const ids = rows.map((r) => r.id);
      if (ids.length) return ids.slice(0, 5);
      return allRows.slice(0, 5).map((r) => r.id);
    } else {
      const allRows = DATA_MODEL.keywordSummaryByCity[city] || [];
      let rows = allRows;
      if (filters.categories.length)
        rows = rows.filter((r) => filters.categories.includes(r.category));
      if (filters.brands.length)
        rows = rows.filter((r) => filters.brands.includes(r.brandName));
      if (filters.keywords.length)
        rows = rows.filter((r) => filters.keywords.includes(r.keyword));
      const ids = rows.map((r) => r.id);
      if (ids.length) return ids.slice(0, 6);
      return allRows.slice(0, 6).map((r) => r.id);
    }
  }, [isBrandMode, mode, filters, city]);

  const selectedLabels = useMemo(
    () =>
      selectedIds.map((id) =>
        mode === "brand"
          ? BRAND_ID_TO_NAME[id]
          : mode === "sku"
            ? SKU_ID_TO_NAME[id]
            : KEYWORD_ID_TO_NAME[id]
      ),
    [selectedIds, mode]
  );

  const chartDataFor = (metricKey) => {
    const days = DATA_MODEL.days;
    if (mode === "brand") {
      return days.map((date, idx) => {
        const row = { date };
        selectedIds.forEach((id) => {
          const series =
            DATA_MODEL.brandTrendsByCity[city] &&
            DATA_MODEL.brandTrendsByCity[city][id];
          if (!series) return;
          row[id] = series[idx][metricKey];
        });
        return row;
      });
    }
    if (mode === "sku") {
      return days.map((date, idx) => {
        const row = { date };
        selectedIds.forEach((id) => {
          const series =
            DATA_MODEL.skuTrendsByCity[city] &&
            DATA_MODEL.skuTrendsByCity[city][id];
          if (!series) return;
          row[id] = series[idx][metricKey];
        });
        return row;
      });
    }
    // keywords
    return days.map((date, idx) => {
      const row = { date };
      selectedIds.forEach((id) => {
        const series =
          DATA_MODEL.keywordTrendsByCity[city] &&
          DATA_MODEL.keywordTrendsByCity[city][id];
        if (!series) return;
        row[id] = series[idx][metricKey];
      });
      return row;
    });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            Compare by SOS KPIs
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              {mode === "brand"
                ? "Brands:"
                : mode === "sku"
                  ? "SKUs:"
                  : "Keywords:"}
            </span>
            {selectedLabels.map((label) => (
              <Badge key={label} className="border-slate-200 bg-slate-50">
                {label}
              </Badge>
            ))}
            <Separator orientation="vertical" className="mx-1 h-4" />
            <span>{city}</span>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={onBackToTrend}>
          Back to trend
        </Button>
      </CardHeader>

      <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
        {KPI_KEYS.map((kpi) => (
          <Card
            key={kpi.key}
            className="border-slate-200 bg-slate-50/80 shadow-none hover:bg-slate-50"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent className="h-48 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartDataFor(kpi.key)}
                  margin={{ top: 8, left: -16, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis tickLine={false} fontSize={10} width={32} />
                  <Tooltip />
                  {selectedIds.map((id) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={
                        mode === "brand"
                          ? BRAND_ID_TO_NAME[id]
                          : mode === "sku"
                            ? SKU_ID_TO_NAME[id]
                            : KEYWORD_ID_TO_NAME[id]
                      }
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 Tables                                     */
/* -------------------------------------------------------------------------- */

const BrandTable = ({ rows }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="mt-3">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          Brands (Top {rows.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Brand</th>

                {/* ONLY SOS KPIs */}
                <th className="px-3 py-2 text-right">Overall SOS</th>
                <th className="px-3 py-2 text-right">Sponsored</th>
                <th className="px-3 py-2 text-right">Organic</th>
                <th className="px-3 py-2 text-right">Display</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                    {row.name}
                  </td>

                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.overall_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.sponsored_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.organic_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.display_sos.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[12px] text-slate-400"
                  >
                    No brands matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PaginationFooter
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        isVisible={rows.length > 0}
      />
    </Card>
  );
};

const SkuTable = ({ rows }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="mt-3 border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          SKUs (Top {rows.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Brand</th>

                {/* ONLY SOS KPIs */}
                <th className="px-3 py-2 text-right">Overall SOS</th>
                <th className="px-3 py-2 text-right">Sponsored</th>
                <th className="px-3 py-2 text-right">Organic</th>
                <th className="px-3 py-2 text-right">Display</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                    {row.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[12px] text-slate-700">
                    {row.brandName}
                  </td>

                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.overall_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.sponsored_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.organic_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.display_sos.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-[12px] text-slate-400"
                  >
                    No SKUs matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PaginationFooter
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        isVisible={rows.length > 0}
      />
    </Card>
  );
};

/* Keyword Table (replaces SKU table in second tab) */
const KeywordTable = ({ rows }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="mt-3 border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          Keywords (Top {rows.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Keyword</th>
                <th className="px-3 py-2 text-left">Brand</th>

                {/* ONLY SOS KPIs */}
                <th className="px-3 py-2 text-right">Overall SOS</th>
                <th className="px-3 py-2 text-right">Sponsored</th>
                <th className="px-3 py-2 text-right">Organic</th>
                <th className="px-3 py-2 text-right">Display</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                    {row.keyword}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[12px] text-slate-700">
                    {row.brandName}
                  </td>

                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.overall_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.sponsored_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.organic_sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[12px]">
                    {row.display_sos.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-[12px] text-slate-400"
                  >
                    No Keywords matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PaginationFooter
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        isVisible={rows.length > 0}
      />
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

export const VisibilityKpiTrendShowcase = () => {
  const [tab, setTab] = useState("brand"); // "brand" | "sku" | "keyword"
  const [city, setCity] = useState(CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    skus: [],
    keywords: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"

  const selectionCount =
    filters.categories.length +
    filters.brands.length +
    filters.skus.length +
    filters.keywords.length;

  // Dynamic filtered rows for table for the active tab + city
  const brandRows = useMemo(() => {
    const allRows = DATA_MODEL.brandSummaryByCity[city] || [];
    let rows = allRows;

    if (filters.categories.length) {
      rows = rows.filter((r) => filters.categories.includes(r.category));
    }
    if (filters.brands.length) {
      rows = rows.filter((r) => filters.brands.includes(r.name));
    }
    if (filters.skus.length) {
      const brandIdsWithSelectedSkus = new Set(
        RAW_DATA.skus
          .filter((s) => filters.skus.includes(s.name))
          .map((s) => s.brandId)
      );
      rows = rows.filter((r) => brandIdsWithSelectedSkus.has(r.id));
    }
    if (filters.keywords.length) {
      const brandIdsWithSelectedKws = new Set(
        RAW_DATA.keywords
          .filter((k) => filters.keywords.includes(k.keyword))
          .map((k) => k.brandId)
      );
      rows = rows.filter((r) => brandIdsWithSelectedKws.has(r.id));
    }

    return rows;
  }, [city, filters]);

  const skuRows = useMemo(() => {
    const allRows = DATA_MODEL.skuSummaryByCity[city] || [];
    let rows = allRows;

    if (filters.categories.length)
      rows = rows.filter((r) => filters.categories.includes(r.category));
    if (filters.brands.length)
      rows = rows.filter((r) => filters.brands.includes(r.brandName));
    if (filters.skus.length)
      rows = rows.filter((r) => filters.skus.includes(r.name));

    return rows;
  }, [city, filters]);

  const keywordRows = useMemo(() => {
    const allRows = DATA_MODEL.keywordSummaryByCity[city] || [];
    let rows = allRows;

    if (filters.categories.length)
      rows = rows.filter((r) => filters.categories.includes(r.category));
    if (filters.brands.length)
      rows = rows.filter((r) => filters.brands.includes(r.brandName));
    if (filters.keywords.length)
      rows = rows.filter((r) => filters.keywords.includes(r.keyword));

    return rows;
  }, [city, filters]);

  return (
    <div className="flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {/* DYNAMIC PILLS */}
            {filters.categories.length > 0 ? (
              filters.categories.map((cat) => (
                <Badge
                  key={cat}
                  className="bg-blue-50 text-blue-700 border-blue-100"
                >
                  {cat}
                </Badge>
              ))
            ) : (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                All Categories
              </Badge>
            )}

            {filters.brands.map((brand) => (
              <Badge
                key={brand}
                className="bg-purple-50 text-purple-700 border-purple-100"
              >
                {brand}
              </Badge>
            ))}

            {tab === "sku" &&
              filters.skus.map((sku) => (
                <Badge
                  key={sku}
                  className="bg-green-50 text-green-700 border-green-100"
                >
                  {sku}
                </Badge>
              ))}

            {tab === "keyword" &&
              filters.keywords.map((kw) => (
                <Badge
                  key={kw}
                  className="bg-orange-50 text-orange-700 border-orange-100"
                >
                  {kw}
                </Badge>
              ))}
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Competition List
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="h-9 w-40 bg-white">
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="relative bg-white"
            onClick={() => setFilterDialogOpen(true)}
          >
            <Filter className="mr-1.5 h-4 w-4" />
            Filters
            {selectionCount > 0 && (
              <Badge className="ml-2 h-5 min-w-[20px] justify-center rounded-full bg-blue-600 text-[11px] text-white">
                {selectionCount}
              </Badge>
            )}
          </Button>

          <Button
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setViewMode("trend")}
          >
            <LineChartIcon className="mr-1.5 h-4 w-4" />
            Trend
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setViewMode("table"); // reset view when switching tab
        }}
        className="w-full"
      >
        <div className="flex items-center justify-between gap-3">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="brand" className="px-4">
              Brands
            </TabsTrigger>
            {/* <TabsTrigger value="sku" className="px-4">
              SKUs
            </TabsTrigger>
            <TabsTrigger value="keyword" className="px-4">
              Keywords
            </TabsTrigger> */}
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {selectionCount > 0 ? (
              <span>{selectionCount} filter(s) applied</span>
            ) : (
              <span>No filters applied</span>
            )}
          </div>
        </div>

        {/* BRAND TAB */}
        <TabsContent value="brand" className="mt-3">
          {viewMode === "table" && <BrandTable rows={brandRows} />}
          {viewMode === "trend" && (
            <TrendView
              mode="brand"
              filters={filters}
              city={city}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="brand"
              filters={filters}
              city={city}
              onBackToTrend={() => setViewMode("trend")}
            />
          )}
        </TabsContent>

        {/* SKU TAB */}
        <TabsContent value="sku" className="mt-3">
          {viewMode === "table" && <SkuTable rows={skuRows} />}
          {viewMode === "trend" && (
            <TrendView
              mode="sku"
              filters={filters}
              city={city}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="sku"
              filters={filters}
              city={city}
              onBackToTrend={() => setViewMode("trend")}
            />
          )}
        </TabsContent>

        {/* KEYWORD TAB */}
        <TabsContent value="keyword" className="mt-3">
          {viewMode === "table" && <KeywordTable rows={keywordRows} />}
          {viewMode === "trend" && (
            <TrendView
              mode="keyword"
              filters={filters}
              city={city}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="keyword"
              filters={filters}
              city={city}
              onBackToTrend={() => setViewMode("trend")}
            />
          )}
        </TabsContent>
      </Tabs>

      <FilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        mode={tab}
        value={filters}
        onChange={setFilters}
      />
    </div>
  );
};

export default VisibilityKpiTrendShowcase;
