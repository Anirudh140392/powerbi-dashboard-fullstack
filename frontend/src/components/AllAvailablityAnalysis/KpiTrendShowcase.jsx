import React, { useMemo, useState, useContext, createContext, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
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
  categories: ["Body Lotion", "Face Cream", "Soap"],
  brands: [
    { id: "my-brand", name: "My Brand", category: "Body Lotion" },
    { id: "vaseline", name: "Vaseline", category: "Body Lotion" },
    { id: "nivea", name: "Nivea", category: "Body Lotion" },
    {
      id: "parachute-adv",
      name: "Parachute Advanced",
      category: "Body Lotion",
    },
    { id: "boroplus", name: "Boroplus", category: "Body Lotion" },
    { id: "cetaphil", name: "Cetaphil", category: "Face Cream" },
    { id: "joy", name: "Joy", category: "Body Lotion" },
    { id: "biotique", name: "Biotique", category: "Face Cream" },
  ],
  skus: [
    {
      id: "vas-100",
      name: "Vaseline 100ml",
      brandId: "vaseline",
      category: "Body Lotion",
    },
    {
      id: "vas-200",
      name: "Vaseline 200ml",
      brandId: "vaseline",
      category: "Body Lotion",
    },
    {
      id: "niv-soft-100",
      name: "Nivea Soft 100ml",
      brandId: "nivea",
      category: "Body Lotion",
    },
    {
      id: "para-dry-150",
      name: "Parachute Dry Skin 150ml",
      brandId: "parachute-adv",
      category: "Body Lotion",
    },
    {
      id: "boro-aloe-100",
      name: "Boroplus Aloe 100ml",
      brandId: "boroplus",
      category: "Body Lotion",
    },
  ],
};

/** Derived option lists for filters */
const CITIES = RAW_DATA.cities;
const CATEGORY_OPTIONS = RAW_DATA.categories;
const BRAND_OPTIONS = RAW_DATA.brands.map((b) => b.name);
const SKU_OPTIONS = RAW_DATA.skus.map((s) => s.name);

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

/** SKU group by brand */
const SKUS_BY_BRAND_ID = {};
RAW_DATA.skus.forEach((s) => {
  if (!SKUS_BY_BRAND_ID[s.brandId]) SKUS_BY_BRAND_ID[s.brandId] = [];
  SKUS_BY_BRAND_ID[s.brandId].push(s);
});

/** Build mock metrics and trends – all UI reads from this single data model */
const buildDataModel = () => {
  const days = DAYS;
  const brandSummaryByCity = {};
  const skuSummaryByCity = {};
  const brandTrendsByCity = {};
  const skuTrendsByCity = {};

  RAW_DATA.cities.forEach((city, cityIdx) => {
    // BRAND SUMMARY
    brandSummaryByCity[city] = RAW_DATA.brands.map((brand, brandIdx) => {
      const base = 20 + brandIdx * 1.5 + cityIdx * 0.7;

      return {
        id: brand.id,
        name: brand.name,
        category: brand.category,

        // existing KPIs
        estCatShare: base,
        wtOsa: 88 + brandIdx * 0.7 + cityIdx * 0.8,
        overallSos: 30 + brandIdx * 1.1 + cityIdx * 0.9,
        adSos: 22 + brandIdx * 0.9 + cityIdx * 0.6,

        // NEW REQUIRED KPI FIELDS
        Osa: 80 + brandIdx * 1.2 + cityIdx * 0.5,
        Listing: 60 + Math.random() * 35,
        Doi: 40 + brandIdx * 1.3 + cityIdx * 0.6,
        Fillrate: 70 + brandIdx * 0.9 + cityIdx * 0.4,
        Assortment: 18 + brandIdx * 0.5 + cityIdx * 0.3,
        PSL: 15 + brandIdx * 0.4 + cityIdx * 0.2,
      };
    });

    // SKU SUMMARY
    skuSummaryByCity[city] = RAW_DATA.skus.map((sku, skuIdx) => {
      const brandIdx = RAW_DATA.brands.findIndex((b) => b.id === sku.brandId);

      return {
        id: sku.id,
        name: sku.name,
        brandId: sku.brandId,
        brandName: BRAND_ID_TO_NAME[sku.brandId],
        category: sku.category,

        // existing KPIs
        wtOsa: 86 + skuIdx * 0.8 + cityIdx * 0.6,
        overallSos: 28 + skuIdx * 1.0 + cityIdx * 0.7 + brandIdx * 0.3,
        adSos: 20 + skuIdx * 0.7 + cityIdx * 0.5,

        // NEW REQUIRED KPI FIELDS
        Osa: 78 + skuIdx * 1.1 + cityIdx * 0.5,
        Listing: 60 + Math.random() * 35,
        Doi: 42 + skuIdx * 1.0 + cityIdx * 0.4,
        Fillrate: 68 + skuIdx * 0.9 + cityIdx * 0.3,
        Assortment: 16 + skuIdx * 0.6 + cityIdx * 0.3,
        PSL: 12 + skuIdx * 0.5 + cityIdx * 0.2,
      };
    });

    // BRAND TRENDS
    brandTrendsByCity[city] = {};
    RAW_DATA.brands.forEach((brand, brandIdx) => {
      const base = 85 + brandIdx * 2.0 + cityIdx * 1.5;

      brandTrendsByCity[city][brand.id] = days.map((date, idx) => ({
        date,

        // existing KPIs
        wtOsa: base + Math.sin(idx / 3 + brandIdx) * 3,
        estCatShare: 20 + brandIdx * 1.3 + Math.cos(idx / 4 + cityIdx) * 2,
        overallSos: 30 + brandIdx * 1.0 + Math.sin(idx / 5 + cityIdx) * 4,
        adSos: 22 + brandIdx * 0.9 + Math.cos(idx / 6 + brandIdx) * 5,

        // NEW KPI TREND LINES
        Osa: 78 + brandIdx * 1.2 + Math.sin(idx / 3) * 2,
        Listing: 85 + brandIdx * 0.5 + Math.cos(idx / 4) * 1.5,
        Doi: 40 + brandIdx * 1.0 + Math.cos(idx / 5) * 1.5,
        Fillrate: 68 + brandIdx * 1.1 + Math.sin(idx / 6) * 1.8,
        Assortment: 20 + brandIdx * 0.8 + Math.cos(idx / 4) * 1.2,
        PSL: 14 + brandIdx * 0.6 + Math.sin(idx / 5) * 1.0,
      }));
    });

    // SKU TRENDS
    skuTrendsByCity[city] = {};
    RAW_DATA.skus.forEach((sku, skuIdx) => {
      const brandIdx = RAW_DATA.brands.findIndex((b) => b.id === sku.brandId);

      skuTrendsByCity[city][sku.id] = days.map((date, idx) => ({
        date,

        // existing KPI trend lines
        wtOsa: 84 + skuIdx * 1.8 + Math.sin(idx / 3 + brandIdx) * 3,
        estCatShare: 18 + skuIdx * 1.2 + Math.cos(idx / 4) * 2,
        overallSos: 28 + skuIdx * 0.9 + Math.sin(idx / 5) * 4,
        adSos: 19 + skuIdx * 0.8 + Math.cos(idx / 6) * 5,

        // NEW KPI trend lines
        Osa: 76 + skuIdx * 1.1 + Math.sin(idx / 3) * 2,
        Listing: 82 + skuIdx * 0.6 + Math.sin(idx / 4) * 1.5,
        Doi: 41 + skuIdx * 1.0 + Math.cos(idx / 5) * 1.5,
        Fillrate: 67 + skuIdx * 1.2 + Math.sin(idx / 6) * 1.7,
        Assortment: 18 + skuIdx * 0.7 + Math.cos(idx / 4) * 1.3,
        PSL: 11 + skuIdx * 0.5 + Math.cos(idx / 3) * 1.1,
      }));
    });
  });

  return {
    days,
    brandSummaryByCity,
    skuSummaryByCity,
    brandTrendsByCity,
    skuTrendsByCity,
  };
};

const DATA_MODEL = buildDataModel();

/* -------------------------------------------------------------------------- */
/*                               Filter Dialog                                */
/* -------------------------------------------------------------------------- */

const FilterDialog = ({ open, onClose, mode, value, onChange, platform, location }) => {
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
        if (platform) params.append('platform', platform);
        if (location) params.append('location', location === 'All India' ? 'All' : location);
        if (value.categories.length > 0) {
          params.append('category', value.categories.join(','));
        }
        if (value.brands.length > 0) {
          params.append('brand', value.brands.join(','));
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
          console.log('[FilterDialog] Loaded filter options:', {
            categories: response.data.categories?.length || 0,
            brands: response.data.brands?.length || 0,
            skus: response.data.skus?.length || 0
          });
        }
      } catch (error) {
        console.error('[FilterDialog] Error fetching filter options:', error);
        setFilterOptions(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load filter options'
        }));
      }
    };

    fetchFilterOptions();
  }, [open, value.categories, value.brands, platform, location]); // Refetch when categories, brands, platform or location change (cascading filters)

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
                    className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <Checkbox
                      checked={value[currentKey].includes(item)}
                      onCheckedChange={() => handleToggle(currentKey, item)}
                    />
                    <span className="truncate">{item}</span>
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

/* -------------------------------------------------------------------------- */
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */
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

const TrendView = ({ mode, filters, city, onBackToTable, onSwitchToKpi }) => {
  // ✅ single selected KPI
  const [activeMetric, setActiveMetric] = useState("Osa");

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
/*                             KPI Compare View                               */
/* -------------------------------------------------------------------------- */

const KPI_KEYS = [
  {
    key: "Osa",
    label: "OSA",
    color: "#F97316", // orange (matching other drawer)
    unit: "%",
  },
  {
    key: "Listing",
    label: "Listing %",
    color: "#8B5CF6", // violet
    unit: "%",
  },
  {
    key: "Assortment",
    label: "Assortment",
    color: "#22C55E", // green
    unit: "%",
  },
];


const KpiCompareView = ({ mode, filters, city, onBackToTrend }) => {
  const isBrandMode = mode === "brand";

  const selectedIds = useMemo(() => {
    if (isBrandMode) {
      const allRows = DATA_MODEL.brandSummaryByCity[city] || [];
      let rows = allRows;

      if (filters.categories.length) {
        rows = rows.filter((r) => filters.categories.includes(r.category));
      }
      if (filters.brands.length) {
        rows = rows.filter((r) => filters.brands.includes(r.name));
      }

      const ids = rows.map((r) => r.id);
      if (ids.length) return ids.slice(0, 4);
      return allRows.slice(0, 3).map((r) => r.id);
    } else {
      const allRows = DATA_MODEL.skuSummaryByCity[city] || [];
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

      const ids = rows.map((r) => r.id);
      if (ids.length) return ids.slice(0, 5);
      return allRows.slice(0, 5).map((r) => r.id);
    }
  }, [isBrandMode, filters, city]);

  const selectedLabels = useMemo(
    () =>
      selectedIds.map((id) =>
        isBrandMode ? BRAND_ID_TO_NAME[id] : SKU_ID_TO_NAME[id]
      ),
    [selectedIds, isBrandMode]
  );

  const chartDataFor = (metricKey) => {
    const days = DATA_MODEL.days;

    if (isBrandMode) {
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
                  <YAxis tickLine={false} fontSize={10} width={32} tickFormatter={(v) => `${v}%`} />
                  <Tooltip />
                  {selectedIds.map((id) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={
                        isBrandMode ? BRAND_ID_TO_NAME[id] : SKU_ID_TO_NAME[id]
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

const ProgressBar = ({ value, color }) => (
  <div className="h-1.5 w-24 rounded-full bg-slate-100">
    <div
      className="h-1.5 rounded-full transition-all duration-500"
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        backgroundColor:
          color || (value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444"),
      }}
    />
  </div>
);

const BrandTable = ({ rows, loading }) => {
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
                <th className="px-3 py-2 text-center">OSA</th>
                <th className="px-3 py-2 text-center">SOS</th>
                <th className="px-3 py-2 text-center">Price</th>
                <th className="px-3 py-2 text-center">Category Share</th>
                <th className="px-3 py-2 text-center">Market Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-slate-400">
                    <div className="animate-pulse">Loading competition data...</div>
                  </td>
                </tr>
              )}
              {!loading && paginatedRows.map((row, idx) => (
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
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="font-semibold text-slate-700">
                      {(row.osa || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="font-semibold text-slate-700">
                      {(row.sos || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="font-semibold text-slate-700">
                      ₹{(row.price || 0).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                      {(row.categoryShare || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="inline-flex items-center justify-center rounded-md bg-green-50 px-2 py-1 font-semibold text-green-700">
                      {(row.marketShare || 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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

const SkuTable = ({ rows, loading }) => {
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
                <th className="px-3 py-2 text-center">OSA</th>
                <th className="px-3 py-2 text-center">SOS</th>
                <th className="px-3 py-2 text-center">Price</th>
                <th className="px-3 py-2 text-center">Category Share</th>
                <th className="px-3 py-2 text-center">Market Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[12px] text-slate-400">
                    <div className="animate-pulse">Loading competition data...</div>
                  </td>
                </tr>
              )}
              {!loading && paginatedRows.map((row, idx) => (
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
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="font-semibold text-slate-700">
                      {(row.osa || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="font-semibold text-slate-700">
                      {(row.sos || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="font-semibold text-slate-700">
                      ₹{(row.price || 0).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                      {(row.categoryShare || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px]">
                    <span className="inline-flex items-center justify-center rounded-md bg-green-50 px-2 py-1 font-semibold text-green-700">
                      {(row.marketShare || 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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

/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

export const KpiTrendShowcase = ({ platform, globalFilters }) => {
  const [tab, setTab] = useState("brand"); // "brand" | "sku"
  const [city, setCity] = useState(CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    skus: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"

  // State for API competition data
  const [competitionData, setCompetitionData] = useState({ brands: [], skus: [] });
  const [loading, setLoading] = useState(false);

  // Fetch competition data from API
  useEffect(() => {
    const fetchCompetitionData = async () => {
      setLoading(true);
      try {
        const params = {
          platform: platform || 'All',
          location: city === 'All India' ? 'All' : city,
          category: filters.categories.length > 0 ? filters.categories.join(',') : 'All',
          brand: filters.brands.length > 0 ? filters.brands.join(',') : 'All',
          sku: filters.skus.length > 0 ? filters.skus.join(',') : 'All',
          period: '1M',
          startDate: globalFilters?.startDate,
          endDate: globalFilters?.endDate
        };
        console.log('[KpiTrendShowcase] Fetching competition data with params:', params);
        const response = await axiosInstance.get('/watchtower/competition', { params });
        if (response.data) {
          console.log('[KpiTrendShowcase] Received:', response.data.brands?.length || 0, 'brands,', response.data.skus?.length || 0, 'skus');
          setCompetitionData(response.data);
        }
      } catch (error) {
        console.error('[KpiTrendShowcase] Error fetching competition data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompetitionData();
  }, [city, filters, platform, globalFilters]);

  const selectionCount =
    filters.categories.length + filters.brands.length + filters.skus.length;

  // Brand rows from API data (top 8 sorted by OSA)
  const brandRows = useMemo(() => {
    const apiBrands = competitionData.brands || [];
    return apiBrands.slice(0, 8).map((b, idx) => ({
      id: b.brand_name || `brand-${idx}`,
      name: b.brand_name || 'Unknown',
      osa: b.osa || 0,
      sos: b.sos || 0,
      price: b.price || 0,
      categoryShare: b.categoryShare || 0,
      marketShare: b.marketShare || 0
    }));
  }, [competitionData.brands]);

  // SKU rows from API data (top 8 sorted by OSA)
  const skuRows = useMemo(() => {
    const apiSkus = competitionData.skus || [];
    return apiSkus.slice(0, 8).map((s, idx) => ({
      id: s.sku_name || `sku-${idx}`,
      name: s.sku_name || 'Unknown',
      brandName: s.brand_name || 'Unknown',
      osa: s.osa || 0,
      sos: s.sos || 0,
      price: s.price || 0,
      categoryShare: s.categoryShare || 0,
      marketShare: s.marketShare || 0
    }));
  }, [competitionData.skus]);

  return (
    <div className="flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {/* Categories: Always show selected or 'All Categories' */}
            {filters.categories.length > 0 ? (
              filters.categories.map((c) => (
                <Badge
                  key={c}
                  className="bg-blue-50 text-blue-700 border-blue-100"
                >
                  {c}
                </Badge>
              ))
            ) : (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                All Categories
              </Badge>
            )}

            {/* Brands: Always show selected */}
            {filters.brands.map((b) => (
              <Badge
                key={b}
                className="bg-indigo-50 text-indigo-700 border-indigo-100"
              >
                {b}
              </Badge>
            ))}

            {/* SKUs: Show only if tab is 'sku' */}
            {tab === "sku" &&
              filters.skus.map((s) => (
                <Badge
                  key={s}
                  className="bg-purple-50 text-purple-700 border-purple-100"
                >
                  {s}
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
          {viewMode === "table" && <BrandTable rows={brandRows} loading={loading} />}
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
          {viewMode === "table" && <SkuTable rows={skuRows} loading={loading} />}
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
      </Tabs>

      <FilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        mode={tab}
        value={filters}
        onChange={setFilters}
        platform={platform}
        location={city}
      />
    </div>
  );
};

export default KpiTrendShowcase;
