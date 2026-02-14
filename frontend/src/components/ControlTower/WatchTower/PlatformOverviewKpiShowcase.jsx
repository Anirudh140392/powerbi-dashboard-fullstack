import React, { useMemo, useState, useContext, createContext, useEffect } from "react";
import axiosInstance from "../../../api/axiosInstance";
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
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Box, Tooltip } from "@mui/material";
import PaginationFooter from "../../CommonLayout/PaginationFooter";


/* -------------------------------------------------------------------------- */
/*                               Utility helper                               */
/* -------------------------------------------------------------------------- */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Color palette for brand differentiation in comparison charts
const BRAND_COLORS = [
  "#2563EB", // Blue
  "#DC2626", // Red
  "#16A34A", // Green
  "#F97316", // Orange
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#0891B2", // Cyan
  "#84CC16", // Lime
  "#F59E0B", // Amber
  "#6366F1", // Indigo
];

// Helper to get a consistent color for a brand based on its index
const getBrandColor = (index) => BRAND_COLORS[index % BRAND_COLORS.length];


/* -------------------------------------------------------------------------- */
/*                           Small UI components (local)                      */
/* -------------------------------------------------------------------------- */

/* Card */
const DASHBOARD_DATA = { trends: { metrics: [] }, compareSkus: { metrics: [] }, competition: { brands: [] } };

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
      "rounded-lg bg-white shadow-xl border border-slate-200 overflow-hidden",
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
const DAYS = [];

/** Raw config - simplified and empty to force API usage */
const RAW_DATA = { cities: [], categories: [], brands: [], skus: [] };
const CITIES = [];
const CATEGORY_OPTIONS = [];
const BRAND_OPTIONS = [];
const SKU_OPTIONS = [];
const BRAND_ID_TO_NAME = {};
const BRAND_NAME_TO_ID = {};
const SKU_ID_TO_NAME = {};
const SKU_NAME_TO_ID = {};
const SKUS_BY_BRAND_ID = {};

const buildDataModel = () => {
  return {
    days: [],
    brandSummaryByCity: {},
    skuSummaryByCity: {},
    brandTrendsByCity: {},
    skuTrendsByCity: {},
  };
};

const DATA_MODEL = buildDataModel();

/* -------------------------------------------------------------------------- */
/*                               Filter Dialog                                */
/* -------------------------------------------------------------------------- */

const FilterDialog = ({ open, onClose, mode, value, onChange }) => {
  // initial tab: brand view starts with category, sku view starts with sku
  const [activeTab, setActiveTab] = useState(
    mode === "brand" ? "category" : "sku"
  );
  const [search, setSearch] = useState("");

  // Dynamic filter options from API
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    brands: [],
    skus: [],
    loading: false,
    error: null
  });

  // Fetch filter options from backend API
  useEffect(() => {
    if (!open) return; // Only fetch when dialog is open

    const fetchFilterOptions = async () => {
      setFilterOptions(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Build query params for cascading filters
        const params = new URLSearchParams();
        if (value.categories.length > 0) {
          params.append('category', value.categories[0]); // Use first selected category for cascading
        }
        if (value.brands.length > 0) {
          params.append('brand', value.brands[0]); // Use first selected brand for cascading
        }

        const response = await axiosInstance.get(`/watchtower/competition-filter-options?${params.toString()}`);

        if (response.data) {
          setFilterOptions({
            categories: (response.data.categories || []).filter(c => c && c !== 'All'),
            brands: (response.data.brands || []).filter(b => b && b !== 'All'),
            skus: (response.data.skus || []).filter(s => s && s !== 'All'),
            loading: false,
            error: null
          });
          console.log('[FilterDialog Platform Overview] Loaded filter options:', {
            categories: response.data.categories?.length || 0,
            brands: response.data.brands?.length || 0,
            skus: response.data.skus?.length || 0
          });
        }
      } catch (error) {
        console.error('[FilterDialog Platform Overview] Error fetching filter options:', error);
        setFilterOptions(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load filter options'
        }));
      }
    };

    fetchFilterOptions();
  }, [open, value.categories, value.brands]); // Refetch when categories or brands change (cascading filters)

  // Use API-fetched options instead of hardcoded ones
  const getCategoryOptions = () => filterOptions.categories;

  const getBrandOptions = () => {
    // Brands are already filtered by category via the API cascading
    return filterOptions.brands;
  };

  const getSkuOptions = () => {
    // SKUs are already filtered by category and brand via the API cascading
    return filterOptions.skus;
  };

  const tabOptions = ["category", "brand", "sku"]; // always show all three

  const getListForTab = () => {
    if (activeTab === "category") return getCategoryOptions();
    if (activeTab === "brand") return getBrandOptions();
    return getSkuOptions();
  };

  const list = useMemo(() => {
    const base = getListForTab() || [];
    return base.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeTab, search, filterOptions]); // filterOptions drives dependencies

  const currentKey =
    activeTab === "category"
      ? "categories"
      : activeTab === "brand"
        ? "brands"
        : "skus";

  // strict dependency: parent change clears children
  const handleToggle = (type, item) => {
    const current = new Set(value[type]);
    if (current.has(item)) current.delete(item);
    else current.add(item);

    const next = { ...value, [type]: Array.from(current) };

    if (type === "categories") {
      // changing categories resets brands & skus
      next.brands = [];
      next.skus = [];
    } else if (type === "brands") {
      // changing brands resets skus
      next.skus = [];
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
    } else if (type === "brands") {
      next.skus = [];
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
                    {t === "sku" && "SKU"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Main pane */}
          <div className="flex-1 px-6 py-4 min-w-0 overflow-hidden">
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

            <ScrollArea className="mt-4 h-64 rounded-md border bg-slate-50/60 overflow-x-hidden">
              <div className="space-y-1 p-3 max-w-full">
                {filterOptions.loading && (
                  <div className="px-3 py-8 text-center text-xs text-slate-400">
                    <div className="animate-pulse">Loading filter options...</div>
                  </div>
                )}

                {filterOptions.error && (
                  <div className="px-3 py-8 text-center text-xs text-red-400">
                    {filterOptions.error}
                  </div>
                )}

                {!filterOptions.loading && !filterOptions.error && list.map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100 overflow-hidden"
                  >
                    <Checkbox
                      checked={value[currentKey].includes(item)}
                      onCheckedChange={() => handleToggle(currentKey, item)}
                    />
                    <span className="truncate flex-1 min-w-0" title={item}>{item}</span>
                  </label>
                ))}

                {!filterOptions.loading && !filterOptions.error && list.length === 0 && (
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

const TrendView = ({ mode, filters, city, onBackToTable, onSwitchToKpi, apiTrendData, trendLoading }) => {
  // ✅ single selected KPI
  const [activeMetric, setActiveMetric] = useState("osa");

  const metricMeta =
    KPI_KEYS.find((m) => m.key === activeMetric) || KPI_KEYS[0];

  const isBrandMode = mode === "brand";

  /* ---------------- SELECTED BRANDS/LABELS ---------------- */
  // Get brand names from filters or API data
  const selectedBrands = useMemo(() => {
    if (filters.brands.length > 0) {
      return filters.brands.slice(0, 4);
    }
    // If no brands selected in filter, use brands from API data
    if (apiTrendData && Object.keys(apiTrendData).length > 0) {
      return Object.keys(apiTrendData).slice(0, 4);
    }
    return [];
  }, [filters.brands, apiTrendData]);

  const selectedLabels = selectedBrands;

  /* ---------------- CHART DATA ---------------- */
  const chartData = useMemo(() => {
    // Use API trend data when available
    if (apiTrendData && Object.keys(apiTrendData).length > 0 && selectedBrands.length > 0) {
      // Get all unique dates from all brands
      const allDates = new Set();
      selectedBrands.forEach(brand => {
        const brandData = apiTrendData[brand] || [];
        brandData.forEach(point => allDates.add(point.date));
      });

      // Sort dates chronologically
      const sortedDates = Array.from(allDates).sort((a, b) => {
        // Parse dates like "01 Jan'26" format
        return new Date(a.replace("'", " 20")) - new Date(b.replace("'", " 20"));
      });

      return sortedDates.map(date => {
        const row = { date };
        selectedBrands.forEach(brand => {
          const brandData = apiTrendData[brand] || [];
          const point = brandData.find(p => p.date === date);
          if (point) {
            row[brand] = point[activeMetric] ?? null;
          }
        });
        return row;
      });
    }

    return [];
  }, [apiTrendData, selectedBrands, city, isBrandMode, activeMetric]);

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
        {trendLoading ? (
          <div className="h-[280px] w-full flex items-center justify-center">
            <div className="text-slate-400 animate-pulse">Loading trend data...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[280px] w-full flex items-center justify-center">
            <div className="text-slate-400">No trend data available. Select brands from the filter.</div>
          </div>
        ) : (
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
                <RechartsTooltip formatter={formatValue} />
                <Legend />

                {selectedBrands.map((brand, index) => (
                  <Line
                    key={brand}
                    type="monotone"
                    dataKey={brand}
                    name={brand}
                    dot={false}
                    stroke={getBrandColor(index)}
                    strokeWidth={2}
                  />
                ))}

              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


/* -------------------------------------------------------------------------- */
/*                             KPI Compare View                               */
/* -------------------------------------------------------------------------- */

// const KPI_KEYS = [
//   { key: "offtakes", label: "Offtakes" },
//   { key: "spend", label: "Spend" },
//   { key: "roas", label: "ROAS" },
//   { key: "inorgSales", label: "Inorg Sales" },
//   { key: "dspSales", label: "DSP Sales" },
//   { key: "conversion", label: "Conversion" },
//   { key: "availability", label: "Availability" },
//   { key: "sos", label: "SOS" },
//   { key: "marketShare", label: "Market Share" },
//   { key: "promoMyBrand", label: "Promo – My Brand" },
//   { key: "promoCompete", label: "Promo – Compete" },
//   { key: "cpm", label: "CPM" },
//   { key: "cpc", label: "CPC" },
// ];
const KPI_KEYS = [
  {
    key: "osa",
    label: "OSA",
    color: "#2563EB", // blue
    unit: "%",
  },
  {
    key: "sos",
    label: "SOS",
    color: "#F97316", // orange
    unit: "%",
  },
  {
    key: "price",
    label: "Price",
    color: "#0891B2", // cyan
    prefix: "₹",
  },
  {
    key: "categoryShare",
    label: "Category Share",
    color: "#BE185D", // dark pink
    unit: "%",
  },
  {
    key: "marketShare",
    label: "Market Share",
    color: "#22C55E", // emerald
    unit: "%",
  },
];

const KpiCompareView = ({ mode, filters, city, onBackToTrend, apiTrendData, trendLoading }) => {
  const isBrandMode = mode === "brand";

  // Get brand names from filters or API data
  const selectedBrands = useMemo(() => {
    if (filters.brands.length > 0) {
      return filters.brands.slice(0, 4);
    }
    // If no brands selected in filter, use brands from API data
    if (apiTrendData && Object.keys(apiTrendData).length > 0) {
      return Object.keys(apiTrendData).slice(0, 4);
    }
    return [];
  }, [filters.brands, apiTrendData]);

  const selectedLabels = selectedBrands;

  // Build chart data for a specific KPI metric
  const chartDataFor = (metricKey) => {
    // Use API trend data when available
    if (apiTrendData && Object.keys(apiTrendData).length > 0 && selectedBrands.length > 0) {
      // Get all unique dates from all brands
      const allDates = new Set();
      selectedBrands.forEach(brand => {
        const brandData = apiTrendData[brand] || [];
        brandData.forEach(point => allDates.add(point.date));
      });

      // Sort dates chronologically
      const sortedDates = Array.from(allDates).sort((a, b) => {
        return new Date(a.replace("'", " 20")) - new Date(b.replace("'", " 20"));
      });

      return sortedDates.map(date => {
        const row = { date };
        selectedBrands.forEach(brand => {
          const brandData = apiTrendData[brand] || [];
          const point = brandData.find(p => p.date === date);
          if (point) {
            row[brand] = point[metricKey] ?? null;
          }
        });
        return row;
      });
    }

    return [];
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            Compare by KPIs
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{isBrandMode ? "Brands:" : "SKUs:"}</span>
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

      <CardContent className="grid max-h-[420px] gap-4 overflow-y-auto pt-4 md:grid-cols-2">
        {trendLoading ? (
          <div className="col-span-2 flex h-48 items-center justify-center">
            <div className="text-slate-400 animate-pulse">Loading KPI data...</div>
          </div>
        ) : selectedBrands.length === 0 ? (
          <div className="col-span-2 flex h-48 items-center justify-center">
            <div className="text-slate-400">No brand data available. Select brands from the filter.</div>
          </div>
        ) : (
          KPI_KEYS.map((kpi) => (
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
                    <RechartsTooltip />
                    {selectedBrands.map((brand, index) => (
                      <Line
                        key={brand}
                        type="monotone"
                        dataKey={brand}
                        name={brand}
                        dot={false}
                        stroke={getBrandColor(index)}
                        strokeWidth={2}
                      />
                    ))}

                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 Tables                                     */
/* -------------------------------------------------------------------------- */

const BrandTable = ({ rows, loading }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * pageSize, page * pageSize);
  }, [rows, page, pageSize]);

  return (
    <Card className="mt-3">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          Brands (Top {rows.length || 0})
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border text-slate-900">
          <table className="min-w-full divide-y divide-slate-200 text-xs table-fixed">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left w-[20%]">Brand</th>
                <th className="px-3 py-2 text-right w-[16%]">OSA</th>
                <th className="px-3 py-2 text-right w-[16%]">SOS</th>
                <th className="px-3 py-2 text-right w-[16%]">Price</th>
                <th className="px-3 py-2 text-right w-[16%]">Category Share</th>
                <th className="px-3 py-2 text-right w-[16%]">Market Share</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && Array.from({ length: pageSize }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                </tr>
              ))}
              {!loading && paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100 truncate max-w-[120px]">
                    <Tooltip title={row.name} arrow placement="top">
                      <span>{row.name}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium">
                    {row.osa.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {row.sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium">
                    ₹{row.price.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {row.categoryShare.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {row.marketShare.toFixed(1)}%
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No brands matching current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PaginationFooter
        isVisible={rows.length > 0}
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </Card>
  );
};


const SkuTable = ({ rows, loading }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * pageSize, page * pageSize);
  }, [rows, page, pageSize]);

  return (
    <Card className="mt-3">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          SKUs (Top {rows.length || 0})
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border text-slate-900">
          <table className="min-w-full divide-y divide-slate-200 text-xs table-fixed">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left w-[20%]">SKU</th>
                <th className="px-3 py-2 text-left w-[20%]">Brand</th>
                <th className="px-3 py-2 text-right w-[12%]">OSA</th>
                <th className="px-3 py-2 text-right w-[12%]">SOS</th>
                <th className="px-3 py-2 text-right w-[12%]">Price</th>
                <th className="px-3 py-2 text-right w-[12%]">Cat Share</th>
                <th className="px-3 py-2 text-right w-[12%]">Mkt Share</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && Array.from({ length: pageSize }).map((_, idx) => (
                <tr key={`skeleton-sku-${idx}`} className="animate-pulse">
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                  <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                </tr>
              ))}
              {!loading && paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100 truncate max-w-[250px]">
                    <Tooltip title={row.name} arrow placement="top">
                      <span>{row.name}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-slate-900 border-r border-slate-100 truncate max-w-[180px]">
                    <Tooltip title={row.brandName} arrow placement="top">
                      <span>{row.brandName}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium">
                    {row.osa.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {row.sos.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium">
                    ₹{row.price.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {row.categoryShare.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    {row.marketShare.toFixed(1)}%
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No SKUs matching current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <PaginationFooter
        isVisible={rows.length > 0}
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </Card>
  );
};


/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

const PlatformOverviewKpiShowcase = ({ selectedItem, selectedLevel, selectedPlatform, period }) => {
  const [tab, setTab] = useState("brand"); // "brand" | "sku"
  const [city, setCity] = useState(CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    skus: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"

  // API state for dynamic filter options
  const [filterOptions, setFilterOptions] = useState({
    locations: ['All India'],
    categories: ['All'],
    brands: ['All'],
    skus: ['All']
  });
  const [apiBrandData, setApiBrandData] = useState([]);
  const [apiSkuData, setApiSkuData] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);

  // State for brand trend data (used in TrendView and KpiCompareView)
  const [apiTrendData, setApiTrendData] = useState({});
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch brand trends when switching to trend or kpi view
  useEffect(() => {
    if (viewMode !== 'trend' && viewMode !== 'kpi') return;

    const fetchBrandTrends = async () => {
      setTrendLoading(true);
      try {
        // Get brands from filter selection or from API brand data
        let brandList = filters.brands.length > 0
          ? filters.brands.slice(0, 4)
          : apiBrandData.slice(0, 4).map(b => b.name);

        if (brandList.length === 0) {
          console.log('[PlatformOverviewKpiShowcase] No brands to fetch trends for');
          setTrendLoading(false);
          return;
        }

        const params = {
          brands: brandList.join(','),
          location: city !== 'All India' ? city : 'All',
          category: filters.categories.length > 0 ? filters.categories[0] : 'All',
          period: period || '1M'
        };

        console.log('[PlatformOverviewKpiShowcase] Fetching brand trends with params:', params);
        const res = await axiosInstance.get('/watchtower/competition-brand-trends', { params });

        if (res.data && res.data.brands) {
          console.log('[PlatformOverviewKpiShowcase] Received trend data for', Object.keys(res.data.brands).length, 'brands');
          setApiTrendData(res.data.brands);
        }
      } catch (err) {
        console.error('[PlatformOverviewKpiShowcase] Failed to fetch brand trends:', err);
      } finally {
        setTrendLoading(false);
      }
    };

    fetchBrandTrends();
  }, [viewMode, city, filters.brands, filters.categories, period]);


  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const params = { location: city !== 'All India' ? city : undefined };
        const res = await axiosInstance.get('/watchtower/competition-filter-options', { params });
        if (res.data) {
          setFilterOptions(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchFilterOptions();
  }, [city]);

  // Fetch brand/sku data when filters change
  useEffect(() => {
    const fetchCompetitionData = async () => {
      setApiLoading(true);
      try {
        // Build params for competition API
        const selectedBrands = filters.brands.length > 0 ? filters.brands.join(',') : 'All';
        const selectedCategory = filters.categories.length > 0 ? filters.categories[0] : 'All';

        const params = {
          platform: selectedPlatform || selectedItem || 'All',
          location: city !== 'All India' ? city : 'All',
          category: selectedCategory,
          brand: selectedBrands,
          period: period || '1M'
        };

        console.log('[PlatformOverviewKpiShowcase] Fetching competition data with params:', params);
        const res = await axiosInstance.get('/watchtower/competition', { params });

        if (res.data) {
          console.log('[PlatformOverviewKpiShowcase] Received:', res.data.brands?.length || 0, 'brands,', res.data.skus?.length || 0, 'skus');

          // Transform API response to match expected format (top 8 sorted by OSA)
          const brandsArray = (res.data.brands || []).slice(0, 8).map((b, idx) => ({
            id: b.brand_name?.toLowerCase().replace(/\s+/g, '-') || `brand-${idx}`,
            name: b.brand_name || 'Unknown',
            category: selectedCategory !== 'All' ? selectedCategory : 'General',
            osa: b.osa || 0,
            sos: b.sos || 0,
            price: b.price || 0,
            categoryShare: b.categoryShare || 0,
            marketShare: b.marketShare || 0,
          }));

          const skusArray = (res.data.skus || []).slice(0, 8).map((s, idx) => ({
            id: s.sku_name?.toLowerCase().replace(/\s+/g, '-') || `sku-${idx}`,
            name: s.sku_name || 'Unknown',
            brandName: s.brand_name || 'Unknown',
            category: selectedCategory !== 'All' ? selectedCategory : 'General',
            osa: s.osa || 0,
            sos: s.sos || 0,
            price: s.price || 0,
            categoryShare: s.categoryShare || 0,
            marketShare: s.marketShare || 0,
          }));

          setApiBrandData(brandsArray);
          setApiSkuData(skusArray);
        }
      } catch (err) {
        console.error('[PlatformOverviewKpiShowcase] Failed to fetch competition data:', err);
      } finally {
        setApiLoading(false);
      }
    };
    fetchCompetitionData();
  }, [city, filters.brands, filters.categories, selectedPlatform, selectedItem, period]);

  const selectionCount =
    filters.categories.length + filters.brands.length + filters.skus.length;

  // Dynamic filtered rows for table for the active tab + city
  const brandRows = useMemo(() => {
    // Use API data if available, otherwise fallback to mock data (only when not loading)
    const allRows = apiBrandData;
    let rows = allRows;

    if (filters.categories.length) {
      rows = rows.filter((r) => filters.categories.includes(r.category));
    }
    if (filters.brands.length) {
      rows = rows.filter((r) => filters.brands.includes(r.name));
    }

    return rows;
  }, [city, filters, apiBrandData]);

  const skuRows = useMemo(() => {
    // Use API data if available, otherwise fallback to mock data (only when not loading)
    const allRows = apiSkuData;
    let rows = allRows;

    if (filters.categories.length) {
      rows = rows.filter((r) => filters.categories.includes(r.category));
    }
    if (filters.brands.length) {
      rows = rows.filter((r) => filters.brands.includes(r.brandName));
    }
    if (filters.skus.length) {
      rows = rows.filter((r) => filters.skus.includes(r.name));
    }

    return rows;
  }, [city, filters, apiSkuData]);

  return (
    <div className="flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Competition
            </span>
            <Badge className="border-blue-200 bg-blue-50 text-xs">
              {selectedItem || "All"}
            </Badge>
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
            <SelectContent className="max-h-60 overflow-y-auto">
              {(filterOptions.locations || CITIES).map((c) => (
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
            <TabsTrigger value="sku" className="px-4">
              SKUs
            </TabsTrigger>
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
          {viewMode === "table" && <BrandTable rows={brandRows} loading={apiLoading} />}
          {viewMode === "trend" && (
            <TrendView
              mode="brand"
              filters={filters}
              city={city}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
              apiTrendData={apiTrendData}
              trendLoading={trendLoading}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="brand"
              filters={filters}
              city={city}
              onBackToTrend={() => setViewMode("trend")}
              apiTrendData={apiTrendData}
              trendLoading={trendLoading}
            />
          )}
        </TabsContent>

        {/* SKU TAB */}
        <TabsContent value="sku" className="mt-3">
          {viewMode === "table" && <SkuTable rows={skuRows} loading={apiLoading} />}
          {viewMode === "trend" && (
            <TrendView
              mode="sku"
              filters={filters}
              city={city}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
              apiTrendData={apiTrendData}
              trendLoading={trendLoading}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="sku"
              filters={filters}
              city={city}
              onBackToTrend={() => setViewMode("trend")}
              apiTrendData={apiTrendData}
              trendLoading={trendLoading}
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

export default PlatformOverviewKpiShowcase;
