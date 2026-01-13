import React, { useMemo, useState, useEffect, useContext, createContext } from "react";
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
import { Box, Skeleton } from "@mui/material";

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
  keywords: [
    {
      id: "kw-1",
      keyword: "body lotion for dry skin",
      brandId: "vaseline",
      category: "Body Lotion",
    },
    {
      id: "kw-2",
      keyword: "moisturizer for sensitive skin",
      brandId: "nivea",
      category: "Face Cream",
    },
    {
      id: "kw-3",
      keyword: "aloe vera antiseptic cream",
      brandId: "boroplus",
      category: "Body Lotion",
    },
    {
      id: "kw-4",
      keyword: "best face cream for oily skin",
      brandId: "cetaphil",
      category: "Face Cream",
    },
    {
      id: "kw-5",
      keyword: "parachute hair and body lotion",
      brandId: "parachute-adv",
      category: "Body Lotion",
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

const FilterDialog = ({ open, onClose, mode, value, onChange, onApply }) => {
  // initial tab: platform for visibility mode (Platform KPI Matrix)
  const [activeTab, setActiveTab] = useState("platform");
  const [search, setSearch] = useState("");

  // Dynamic filter options from API (rb_kw table)
  const [filterOptions, setFilterOptions] = useState({
    platforms: [],    // from platform_name
    formats: [],      // from keyword_search_product (category)
    cities: [],       // from location_name
    productNames: [], // from keyword
    brands: [],       // from brand_crawl where is_competitor_product=1
    loading: false,
    error: null
  });

  // Fetch filter options from backend API when dialog opens or dependent filters change
  useEffect(() => {
    if (!open) return; // Only fetch when dialog is open

    const fetchFilterOptions = async () => {
      setFilterOptions(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Fetch all filter types in parallel (including platforms from rb_kw)
        const [platformsRes, formatsRes, citiesRes, productNamesRes, brandsRes] = await Promise.all([
          axiosInstance.get('/visibility-analysis/filter-options?filterType=platforms'),
          axiosInstance.get('/visibility-analysis/filter-options?filterType=formats'),
          axiosInstance.get(`/visibility-analysis/filter-options?filterType=cities${value.formats.length ? `&format=${value.formats[0]}` : ''}`),
          axiosInstance.get('/visibility-analysis/filter-options?filterType=productName'),
          axiosInstance.get('/visibility-analysis/filter-options?filterType=brands')
        ]);

        setFilterOptions({
          platforms: (platformsRes.data?.options || []).filter(p => p && p !== 'All'),
          formats: (formatsRes.data?.options || []).filter(f => f && f !== 'All'),
          cities: (citiesRes.data?.options || []).filter(c => c && c !== 'All'),
          productNames: (productNamesRes.data?.options || []).filter(p => p && p !== 'All'),
          brands: (brandsRes.data?.options || []).filter(b => b && b !== 'All'),
          loading: false,
          error: null
        });
        console.log('[FilterDialog Visibility] Loaded filter options:', {
          platforms: platformsRes.data?.options?.length || 0,
          formats: formatsRes.data?.options?.length || 0,
          cities: citiesRes.data?.options?.length || 0,
          productNames: productNamesRes.data?.options?.length || 0,
          brands: brandsRes.data?.options?.length || 0
        });
      } catch (error) {
        console.error('[FilterDialog Visibility] Error fetching filter options:', error);
        setFilterOptions(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load filter options'
        }));
      }
    };

    fetchFilterOptions();
  }, [open, value.formats]); // Refetch when formats change (cascading for cities)

  // Filter tabs - mapped to rb_kw columns (platform first for Platform KPI Matrix)
  const tabOptions = ["platform", "format", "city", "productName", "brand"];

  const getListForTab = () => {
    if (activeTab === "platform") return filterOptions.platforms;
    if (activeTab === "format") return filterOptions.formats;
    if (activeTab === "city") return filterOptions.cities;
    if (activeTab === "brand") return filterOptions.brands;
    return filterOptions.productNames;
  };

  const list = useMemo(() => {
    const base = getListForTab() || [];
    return base.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeTab, search, filterOptions]);

  const currentKey =
    activeTab === "platform"
      ? "platforms"
      : activeTab === "format"
        ? "formats"
        : activeTab === "city"
          ? "cities"
          : activeTab === "brand"
            ? "brands"
            : "productNames";

  // Handle toggle with cascading filter reset
  const handleToggle = (type, item) => {
    const current = new Set(value[type]);
    if (current.has(item)) current.delete(item);
    else current.add(item);

    const next = { ...value, [type]: Array.from(current) };

    // Cascading: changing format resets cities
    if (type === "formats") {
      next.cities = [];
      next.productNames = [];
    } else if (type === "cities") {
      next.productNames = [];
    }

    onChange(next);
  };

  const handleSelectAll = (type, items) => {
    const allSelected =
      items.length > 0 && items.every((i) => value[type].includes(i));

    const next = { ...value, [type]: allSelected ? [] : items.slice() };

    if (type === "formats") {
      next.cities = [];
      next.productNames = [];
    } else if (type === "cities") {
      next.productNames = [];
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
                    {t === "platform" && "Platform"}
                    {t === "format" && "Format"}
                    {t === "city" && "City"}
                    {t === "productName" && "Product Name"}
                    {t === "brand" && "Brand"}
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
          <Button onClick={() => {
            if (onApply) onApply();
            onClose();
          }}>Apply</Button>
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

const KpiCompareView = ({ mode, filters, city, onBackToTrend, competitionBrands = [] }) => {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState({ brands: {}, days: [] });

  // Determine which brands to compare
  const selectedBrands = useMemo(() => {
    // Priority: 1) Selected in filters, 2) Competition table brands, 3) Empty
    if (filters.brands && filters.brands.length > 0) {
      return filters.brands;
    }
    // Use top brands from competition data if available
    if (competitionBrands.length > 0) {
      return competitionBrands.slice(0, 5).map(b => b.name || b.brand || b);
    }
    return [];
  }, [filters.brands, competitionBrands]);

  // Fetch brand comparison trends from API
  useEffect(() => {
    if (mode !== "brand" || selectedBrands.length === 0) {
      setLoading(false);
      return;
    }

    const fetchTrendData = async () => {
      setLoading(true);
      try {
        const params = {
          brands: selectedBrands.join(','),
          platform: filters.platforms?.length > 0 ? filters.platforms.join(',') : undefined,
          location: filters.cities?.length > 0 ? filters.cities.join(',') : undefined,
          period: '1M'
        };

        // Remove undefined values
        Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

        console.log('[KpiCompareView] Fetching brand trends with params:', params);
        const response = await axiosInstance.get('/visibility-analysis/brand-comparison-trends', { params });

        if (response.data) {
          console.log('[KpiCompareView] Received trend data for', Object.keys(response.data.brands || {}).length, 'brands');
          setTrendData(response.data);
        }
      } catch (error) {
        console.error('[KpiCompareView] Error fetching brand trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendData();
  }, [mode, selectedBrands, filters.platforms, filters.cities]);

  // Build chart data for a specific KPI
  const chartDataFor = (kpiKey) => {
    const { brands, days } = trendData;
    if (!days || days.length === 0) return [];

    return days.map((date) => {
      const row = { date };
      Object.keys(brands).forEach((brandName) => {
        const brandData = brands[brandName];
        const dayData = brandData.timeSeries?.find(d => d.date === date);
        if (dayData) {
          row[brandName] = dayData[kpiKey] || 0;
        }
      });
      return row;
    });
  };

  // Get brand names and colors for rendering
  const brandEntries = Object.entries(trendData.brands || {});

  if (loading) {
    return (
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <div className="space-y-2">
            <Skeleton variant="text" width={180} height={24} animation="wave" sx={{ borderRadius: 1 }} />
            <div className="flex gap-2">
              <Skeleton variant="rounded" width={60} height={22} animation="wave" sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" width={70} height={22} animation="wave" sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" width={65} height={22} animation="wave" sx={{ borderRadius: 2 }} />
            </div>
          </div>
          <Skeleton variant="rounded" width={100} height={32} animation="wave" sx={{ borderRadius: 2 }} />
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
          {/* 4 Chart skeletons for Overall SOS, Sponsored SOS, Organic SOS, Display SOS */}
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-slate-200 bg-slate-50/80 shadow-none">
              <CardHeader className="pb-2">
                <Skeleton variant="text" width={100} height={20} animation="wave" sx={{ borderRadius: 1 }} />
              </CardHeader>
              <CardContent className="h-48 pt-0">
                <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" sx={{ borderRadius: 2 }} />
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (selectedBrands.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-slate-500">
            No brands selected. Please select brands from the Filters to compare.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (brandEntries.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-slate-500">
            No trend data available for the selected brands.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            Compare by SOS KPIs
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Brands:</span>
            {brandEntries.map(([brandName, brandData]) => (
              <Badge
                key={brandName}
                style={{
                  backgroundColor: brandData.color + '20',
                  borderColor: brandData.color,
                  color: brandData.color
                }}
                className="border"
              >
                {brandName}
              </Badge>
            ))}
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
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  {brandEntries.map(([brandName, brandData]) => (
                    <Line
                      key={brandName}
                      type="monotone"
                      dataKey={brandName}
                      name={brandName}
                      stroke={brandData.color}
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
  // Show only top 8 brands
  const top8Rows = rows.slice(0, 8);

  return (
    <Card className="mt-3">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          Brands (Top {Math.min(rows.length, 8)})
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
              {top8Rows.map((row, idx) => (
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

/* Table Skeleton - Used when filters are being applied */
const TableSkeleton = () => (
  <Card className="mt-3 border-slate-200 bg-white shadow-sm">
    <CardHeader className="border-b pb-2">
      <Skeleton variant="text" width={120} height={20} animation="wave" sx={{ borderRadius: 1 }} />
    </CardHeader>
    <CardContent className="pt-3">
      <div className="rounded-md border">
        {/* Table header skeleton */}
        <div className="flex gap-4 px-3 py-2 bg-slate-50 border-b">
          <Skeleton variant="text" width="25%" height={16} animation="wave" />
          <Skeleton variant="text" width="15%" height={16} animation="wave" />
          <Skeleton variant="text" width="15%" height={16} animation="wave" />
          <Skeleton variant="text" width="15%" height={16} animation="wave" />
          <Skeleton variant="text" width="15%" height={16} animation="wave" />
        </div>
        {/* Table rows skeleton */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 px-3 py-3 border-b border-slate-100">
            <Skeleton variant="text" width="25%" height={18} animation="wave" />
            <Skeleton variant="text" width="15%" height={18} animation="wave" />
            <Skeleton variant="text" width="15%" height={18} animation="wave" />
            <Skeleton variant="text" width="15%" height={18} animation="wave" />
            <Skeleton variant="text" width="15%" height={18} animation="wave" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

export const VisibilityKpiTrendShowcase = ({ competitionData = { brands: [], skus: [] }, loading = false }) => {
  const [tab, setTab] = useState("brand"); // "brand" | "sku" | "keyword"
  const [city, setCity] = useState(CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    // API-based filter keys
    platforms: [],    // from platform_name in rb_kw table
    formats: [],      // from keyword_search_product (category)
    cities: [],       // from location_name
    productNames: [], // from keyword
    // Legacy filter keys (used by useMemo hooks)
    categories: [],
    brands: [],
    skus: [],
    keywords: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"

  // State for filtered competition data (when user applies filters)
  const [filteredCompetitionData, setFilteredCompetitionData] = useState(null);
  const [isFilteredLoading, setIsFilteredLoading] = useState(false);

  // Function to fetch competition data with selected filters
  const fetchFilteredCompetitionData = async () => {
    console.log('[Competition] Fetching filtered competition data with filters:', filters);
    setIsFilteredLoading(true);
    try {
      const params = {
        period: '1M',
        platform: filters.platforms.length > 0 ? filters.platforms.join(',') : undefined,
        format: filters.formats.length > 0 ? filters.formats.join(',') : undefined,
        city: filters.cities.length > 0 ? filters.cities.join(',') : undefined,
        productName: filters.productNames.length > 0 ? filters.productNames.join(',') : undefined,
        brand: filters.brands.length > 0 ? filters.brands.join(',') : undefined,
      };

      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      console.log('[Competition] API params:', params);
      const response = await axiosInstance.get('/visibility-analysis/competition', { params });

      if (response.data) {
        console.log('[Competition] Received filtered data:', response.data.brands?.length, 'brands');
        setFilteredCompetitionData({
          brands: response.data.brands || [],
          skus: response.data.skus || []
        });
      }
    } catch (error) {
      console.error('[Competition] Error fetching filtered data:', error);
    } finally {
      setIsFilteredLoading(false);
    }
  };

  const selectionCount =
    filters.platforms.length +
    filters.formats.length +
    filters.cities.length +
    filters.productNames.length +
    filters.brands.length;

  // Dynamic filtered rows for table for the active tab + city
  // Use filtered API data if user has applied filters, otherwise use parent-provided data
  const brandRows = useMemo(() => {
    // Use filtered data if available (user applied filters), otherwise use parent-provided data
    const dataToUse = filteredCompetitionData || competitionData;
    console.log('[Competition] competitionData received:', JSON.stringify(dataToUse));
    console.log('[Competition] Using filtered data:', !!filteredCompetitionData);

    // If we have API competition data, use it instead of hardcoded DATA_MODEL
    if (dataToUse.brands && dataToUse.brands.length > 0) {
      console.log('[Competition] ✅ Using API data:', dataToUse.brands.length, 'brands');
      // Sort by overall_sos descending and map to expected format
      // Backend returns { overall_sos: { value: 25.0, delta: 1.5 } } format
      return dataToUse.brands
        .map(b => {
          // Handle both nested {value, delta} format and flat number format
          const getVal = (field) => {
            if (field === null || field === undefined) return 0;
            if (typeof field === 'object' && field.value !== undefined) return Number(field.value) || 0;
            return Number(field) || 0;
          };
          return {
            id: b.brand || b.id,
            name: b.brand || b.name,
            overall_sos: getVal(b.overall_sos),
            sponsored_sos: getVal(b.sponsored_sos),
            organic_sos: getVal(b.organic_sos),
            display_sos: getVal(b.display_sos),
          };
        })
        .sort((a, b) => b.overall_sos - a.overall_sos);
    }

    console.log('[Competition] ❌ FALLBACK to hardcoded mock data');
    // Fallback to hardcoded mock data
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

    return rows.sort((a, b) => b.overall_sos - a.overall_sos);
  }, [city, filters, competitionData, filteredCompetitionData]);

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

  // Skeleton loader for initial load and filter changes
  if (loading) {
    return (
      <div className="flex-col bg-slate-50 text-slate-900 p-4">
        {/* Header skeleton */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton variant="text" width={120} height={24} animation="wave" sx={{ borderRadius: 1 }} />
            <Skeleton variant="text" width={200} height={32} animation="wave" sx={{ borderRadius: 1 }} />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="rounded" width={90} height={36} animation="wave" sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" width={80} height={36} animation="wave" sx={{ borderRadius: 2 }} />
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="mb-4 flex gap-2">
          <Skeleton variant="rounded" width={80} height={32} animation="wave" sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" width={60} height={32} animation="wave" sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" width={80} height={32} animation="wave" sx={{ borderRadius: 2 }} />
        </div>

        {/* Table skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {/* Table header */}
          <div className="flex gap-4 mb-4 pb-3 border-b border-slate-100">
            <Skeleton variant="text" width="20%" height={20} animation="wave" />
            <Skeleton variant="text" width="15%" height={20} animation="wave" />
            <Skeleton variant="text" width="15%" height={20} animation="wave" />
            <Skeleton variant="text" width="15%" height={20} animation="wave" />
            <Skeleton variant="text" width="15%" height={20} animation="wave" />
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 py-3 border-b border-slate-50">
              <Skeleton variant="text" width="20%" height={18} animation="wave" />
              <Skeleton variant="text" width="15%" height={18} animation="wave" />
              <Skeleton variant="text" width="15%" height={18} animation="wave" />
              <Skeleton variant="text" width="15%" height={18} animation="wave" />
              <Skeleton variant="text" width="15%" height={18} animation="wave" />
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          {viewMode === "table" && (isFilteredLoading ? <TableSkeleton /> : <BrandTable rows={brandRows} />)}
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
              competitionBrands={brandRows}
            />
          )}
        </TabsContent>

        {/* SKU TAB */}
        <TabsContent value="sku" className="mt-3">
          {viewMode === "table" && (isFilteredLoading ? <TableSkeleton /> : <SkuTable rows={skuRows} />)}
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
          {viewMode === "table" && (isFilteredLoading ? <TableSkeleton /> : <KeywordTable rows={keywordRows} />)}
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
        onApply={fetchFilteredCompetitionData}
      />
    </div>
  );
};

export default VisibilityKpiTrendShowcase;
