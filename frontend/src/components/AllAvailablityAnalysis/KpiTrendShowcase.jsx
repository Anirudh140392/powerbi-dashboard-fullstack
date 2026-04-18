import React, { useMemo, useState, useContext, createContext, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
import { formatNumber } from "../../utils/formatters";
import { FilterContext } from "../../utils/FilterContext";
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
const DAYS = Array.from({ length: 20 }).map((_, i) => `${(i + 6).toString().padStart(2, '0')} Nov'25`);

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

        // PRICING KPI FIELDS
        Discount: 8 + brandIdx * 1.5 + cityIdx * 0.4,
        PricePerUnit: 175 + brandIdx * 6 + cityIdx * 2,
        RPI: 3.6 + brandIdx * 0.18 + cityIdx * 0.06,
        ASP: 188 + brandIdx * 9 + cityIdx * 3,
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

        // PRICING KPI FIELDS
        Discount: 7 + skuIdx * 1.2 + cityIdx * 0.3,
        PricePerUnit: 165 + skuIdx * 8 + cityIdx * 2,
        RPI: 3.4 + skuIdx * 0.15 + cityIdx * 0.05,
        ASP: 180 + skuIdx * 10 + cityIdx * 3,
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

        // PRICING KPI TREND LINES
        Discount: 8 + brandIdx * 1.5 + Math.sin(idx / 4) * 1.2,
        PricePerUnit: 175 + brandIdx * 6 + Math.cos(idx / 5) * 4,
        RPI: 3.6 + brandIdx * 0.18 + Math.sin(idx / 3) * 0.15,
        ASP: 188 + brandIdx * 9 + Math.cos(idx / 6) * 5,
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

        // PRICING KPI TREND LINES
        Discount: 7 + skuIdx * 1.2 + Math.sin(idx / 4) * 1.0,
        PricePerUnit: 165 + skuIdx * 8 + Math.cos(idx / 5) * 3,
        RPI: 3.4 + skuIdx * 0.15 + Math.sin(idx / 3) * 0.12,
        ASP: 180 + skuIdx * 10 + Math.cos(idx / 6) * 4,
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

const FilterDialog = ({ open, onClose, mode, value, onChange, platform, location, dynamicKey }) => {
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
        let endpoint = '/watchtower/competition-filter-options';
        if (dynamicKey === 'marketshare') {
          endpoint = '/market-share/competition-filter-options';
        }

        const response = await axiosInstance.get(`${endpoint}?${params.toString()}`);

        if (response.data) {
          setFilterOptions({
            categories: (response.data.categories || []).filter(c => c && c !== 'All'),
            brands: (response.data.brands || []).filter(b => b && b !== 'All'),
            skus: (response.data.skuNames || response.data.skus || response.data.skuCodes || []).filter(s => s && s !== 'All'),
            loading: false,
            error: null
          });
          console.log('[FilterDialog] Loaded filter options:', {
            categories: response.data.categories?.length || 0,
            brands: response.data.brands?.length || 0,
            skus: response.data.skuCodes?.length || response.data.skus?.length || 0
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
  }, [open, value.categories, value.brands, platform, location, dynamicKey]); // Refetch when categories, brands, platform or location change (cascading filters)

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

const TrendView = ({
  mode, filters, city, onBackToTable, onSwitchToKpi, kpiKeys = KPI_KEYS,
  platform, timeStart, timeEnd, dynamicKey, dimensionValue, dimensionType, listData,
  trendData, loading
}) => {
  // ✅ single selected KPI
  const [activeMetric, setActiveMetric] = useState(kpiKeys[0]?.key || "Osa");

  useEffect(() => {
    if (!kpiKeys.some(k => k.key === activeMetric)) {
      setActiveMetric(kpiKeys[0]?.key || "Osa");
    }
  }, [kpiKeys, activeMetric]);

  const metricMeta =
    kpiKeys.find((m) => m.key === activeMetric) || kpiKeys[0];

  const isBrandMode = mode === "brand";

  /* ---------------- SELECTED IDS ---------------- */
  // Take top 4 or 5 IDs from the table listData
  const selectedIds = useMemo(() => {
    if (!listData || listData.length === 0) return [];
    const limit = isBrandMode ? 4 : 5;
    return listData.slice(0, limit).map(r => r.id);
  }, [listData, isBrandMode]);

  const selectedLabels = useMemo(() => selectedIds, [selectedIds]);

  // Track which lines are visible (user can toggle individual brands/skus)
  const [visibleIds, setVisibleIds] = useState(new Set());

  // When selectedIds change, reset visibleIds to show all
  useEffect(() => {
    setVisibleIds(new Set(selectedIds));
  }, [selectedIds.join(',')]);  // use join to avoid infinite loop

  const LINE_COLORS = ['#6366F1', '#F43F5E', '#14B8A6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#06B6D4'];

  const toggleVisibility = (id) => {
    setVisibleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Don't allow hiding all
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /* ---------------- CHART DATA ---------------- */
  const chartData = useMemo(() => {
    if (trendData.dates.length === 0) return [];
    return trendData.dates.map(date => {
      const row = { date };
      selectedIds.forEach((id) => {
        const series = trendData.timeSeries[id];
        if (series && series[date] && series[date][activeMetric] !== undefined) {
          row[id] = series[date][activeMetric];
        } else {
          row[id] = null;
        }
      });
      return row;
    });
  }, [trendData, selectedIds, activeMetric]);

  const formatValue = (v) => {
    if (v === null || v === undefined) return "–";
    if (metricMeta.isCurrency) return formatNumber(v);
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
            {kpiKeys.map((m) => (
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
            {selectedLabels.map((label, idx) => {
              const isVisible = visibleIds.has(label);
              const color = LINE_COLORS[idx % LINE_COLORS.length];
              return (
                <Badge
                  key={label}
                  variant={isVisible ? "default" : "outline"}
                  onClick={() => toggleVisibility(label)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isVisible ? color + '18' : 'transparent',
                    borderColor: color,
                    color: isVisible ? '#1e293b' : '#94a3b8',
                    textDecoration: isVisible ? 'none' : 'line-through',
                    transition: 'all 0.2s'
                  }}
                  className="font-normal gap-1.5 select-none"
                >
                  <span style={{
                    display: 'inline-block',
                    width: 8, height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    opacity: isVisible ? 1 : 0.3
                  }} />
                  {label}
                </Badge>
              );
            })}
            <span className="text-[10px] text-slate-400 ml-1">(click to toggle)</span>
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

              {selectedIds.map((id, idx) => {
                if (!visibleIds.has(id)) return null;
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={id}
                    dot={false}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2}
                  />
                );
              })}
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
    color: "#F97316",
    unit: "%",
  },
  {
    key: "Sos",
    label: "SOS",
    color: "#6366F1",
    unit: "%",
  },
  {
    key: "Listing",
    label: "Listing %",
    color: "#8B5CF6",
    unit: "%",
  },
  {
    key: "Assortment",
    label: "Assortment",
    color: "#22C55E",
    unit: "%",
  },
  {
    key: "Discount",
    label: "Discount %",
    color: "#6366F1",
    unit: "%",
  },
  {
    key: "Psl",
    label: "PSL",
    color: "#8B5CF6",
    prefix: "₹",
    isCurrency: true
  },
];

const PRICING_KPI_KEYS = [
  {
    key: "Discount",
    label: "Discount %",
    color: "#6366F1",
    unit: "%",
    fmt: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "PricePerUnit",
    label: "Price/Unit 1g / 1 piece",
    color: "#14B8A6",
    prefix: "₹",
    fmt: (v) => `₹${v < 10 ? v.toFixed(2) : v.toFixed(0)}`,
  },
  {
    key: "ASP",
    label: "Average Selling Price",
    color: "#8B5CF6",
    prefix: "₹",
    fmt: (v) => `₹${v.toFixed(0)}`,
  },
];

const MARKET_SHARE_KPI_KEYS = [
  {
    key: "MarketShare",
    label: "MARKET SHARE%",
    color: "#14B8A6",
    unit: "%",
  },
  {
    key: "Sales",
    label: "SALES (Cr)",
    color: "#F43F5E",
    unit: " Cr",
  }
];


const KpiCompareView = ({ mode, filters, city, onBackToTrend, kpiKeys = KPI_KEYS, trendData, loading, listData }) => {
  const isBrandMode = mode === "brand";

  const selectedIds = useMemo(() => {
    if (!listData || listData.length === 0) return [];
    const limit = isBrandMode ? 4 : 5;
    return listData.slice(0, limit).map(r => r.id);
  }, [listData, isBrandMode]);

  const selectedLabels = useMemo(() => selectedIds, [selectedIds]);

  const chartDataFor = (metricKey) => {
    if (!trendData.dates || trendData.dates.length === 0) return [];

    return trendData.dates.map(date => {
      const row = { date };
      selectedIds.forEach((id) => {
        const series = trendData.timeSeries[id];
        if (series && series[date] && series[date][metricKey] !== undefined) {
          row[id] = series[date][metricKey];
        } else {
          row[id] = null;
        }
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
        {kpiKeys.map((kpi) => (
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
                  <YAxis
                    tickLine={false}
                    fontSize={10}
                    width={45}
                    tickFormatter={(v) => {
                      if (kpi.isCurrency) return formatNumber(v);
                      if (kpi.unit) return `${v}${kpi.unit}`;
                      if (kpi.prefix) return `${kpi.prefix}${v}`;
                      return v;
                    }}
                  />
                  <Tooltip formatter={(v) => {
                    if (kpi.isCurrency) return formatNumber(v);
                    if (kpi.unit) return `${v}${kpi.unit}`;
                    if (kpi.prefix) return `${kpi.prefix}${v}`;
                    return v;
                  }} />
                  {selectedIds.map((id, idx) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={id}
                      dot={false}
                      stroke={['#6366F1', '#F43F5E', '#14B8A6', '#F59E0B', '#8B5CF6'][idx % 5]}
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

const BrandTable = ({ rows, kpiKeys = KPI_KEYS, loading, selectedIds = [], onSelectionChange }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const toggleRow = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length >= 10) return;
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <Card className="mt-3">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800 flex justify-between">
          <span>Brands (Top {rows.length || 0})</span>
          {selectedIds.length > 0 && <span className="text-xs text-blue-600 font-normal">{selectedIds.length} selected for Trend</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[40%] px-3 py-2 text-left whitespace-nowrap">Brand</th>
                {kpiKeys.map((k) => (
                  <th key={k.key} className="px-3 py-2 text-center whitespace-nowrap" style={{ width: `${60 / kpiKeys.length}%` }}>{k.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
                  {kpiKeys.map((_, kIdx) => (
                    <td key={`skel-col-${kIdx}`} className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  ))}
                </tr>
              ))}
              {!loading && paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => toggleRow(row.id)}
                  style={{ cursor: 'pointer' }}
                  className={cn(
                    "hover:bg-blue-50/60 transition-colors",
                    selectedIds.includes(row.id) ? "bg-blue-50 border-l-2 border-l-blue-500" : (idx % 2 === 1 && "bg-slate-50/60")
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                    {row.name}
                  </td>
                  {kpiKeys.map((k) => {
                    const raw = row[k.key];
                    const display = raw == null ? 'N/A' : (k.fmt ? k.fmt(raw) : typeof raw === 'number' ? `${raw.toFixed(1)}${k.unit || ''}` : raw);
                    return (
                      <td key={k.key} className="px-3 py-2 text-center text-[12px]">
                        <span className="font-semibold text-slate-700">{display}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={kpiKeys.length + 1}
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

const SkuTable = ({ rows, kpiKeys = KPI_KEYS, loading, selectedIds = [], onSelectionChange }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const toggleRow = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length >= 10) return;
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <Card className="mt-3 border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium text-slate-800 flex justify-between">
          <span>SKUs (Top {rows.length || 0})</span>
          {selectedIds.length > 0 && <span className="text-xs text-blue-600 font-normal">{selectedIds.length} selected for Trend</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="max-h-[380px] overflow-auto rounded-md border">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[30%] px-3 py-2 text-left whitespace-nowrap">SKU</th>
                <th className="w-[25%] px-3 py-2 text-left whitespace-nowrap">Brand</th>
                {kpiKeys.map((k) => (
                  <th key={k.key} className="px-3 py-2 text-center whitespace-nowrap">{k.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-sku-${idx}`} className="animate-pulse">
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                  {kpiKeys.map((_, kIdx) => (
                    <td key={`skel-sku-col-${kIdx}`} className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  ))}
                </tr>
              ))}
              {!loading && paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => toggleRow(row.id)}
                  style={{ cursor: 'pointer' }}
                  className={cn(
                    "hover:bg-blue-50/60 transition-colors",
                    selectedIds.includes(row.id) ? "bg-blue-50 border-l-2 border-l-blue-500" : (idx % 2 === 1 && "bg-slate-50/60")
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                    {row.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-left text-[12px] text-slate-700">
                    {row.brandName}
                  </td>
                  {kpiKeys.map((k) => {
                    const raw = row[k.key];
                    const display = raw == null ? 'N/A' : (k.fmt ? k.fmt(raw) : typeof raw === 'number' ? `${raw.toFixed(1)}${k.unit || ''}` : raw);
                    return (
                      <td key={k.key} className="px-3 py-2 text-center text-[12px]">
                        <span className="font-semibold text-slate-700">{display}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={kpiKeys.length + 2}
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

export const KpiTrendShowcase = ({ dynamicKey, dimensionValue, dimensionType } = {}) => {
  const {
    platform,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    selectedChannel
  } = useContext(FilterContext);

  const kpiKeys = useMemo(() => {
    let keys;
    if (dynamicKey === 'pricing') keys = PRICING_KPI_KEYS;
    else if (dynamicKey === 'marketshare') keys = MARKET_SHARE_KPI_KEYS;
    else keys = KPI_KEYS;
    
    // Hide 'Listing' KPI button if channel is NOT 'QuickComm' and platform does not fall into QuickComm
    const isQuickComm = selectedChannel?.toLowerCase() === 'quickcomm' || 
                        ['blinkit', 'zepto', 'instamart', 'swiggy instamart', 'swiggy'].includes(platform?.toLowerCase());
    
    if (!isQuickComm) {
      keys = keys.filter(k => k.key !== 'Listing');
    }

    return keys;
  }, [dynamicKey, selectedChannel, platform]);
  const [tab, setTab] = useState("brand"); // "brand" | "sku"
  const [city, setCity] = useState(CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    skus: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"

  const [selectedBrandIds, setSelectedBrandIds] = useState([]);
  const [selectedSkuIds, setSelectedSkuIds] = useState([]);

  // State for API competition data
  const [competitionData, setCompetitionData] = useState({ brands: [], skus: [] });
  const [loading, setLoading] = useState(true);

  // Fetch competition data from API

  // Fetch competition data from API
  useEffect(() => {
    const fetchCompetitionData = async () => {
      setLoading(true);
      try {
        const isCategoryFilterActive = filters.categories.length > 0;
        const isCityFilterActive = city && city !== 'All India' && city !== 'All';
        const isBrandFilterActive = filters.brands.length > 0;

        // Prevent conflicting WHERE conditions (e.g. Category="Dental Floss" AND Category="Bodywash")
        let effectiveDimValue = dimensionValue;
        const lowerDimType = dimensionType?.toLowerCase();
        if (lowerDimType === 'category' && isCategoryFilterActive) effectiveDimValue = undefined;
        if (lowerDimType === 'brand' && isBrandFilterActive) effectiveDimValue = undefined;
        if (lowerDimType === 'city' && isCityFilterActive) effectiveDimValue = undefined;
        if (lowerDimType === 'platform' && platform && platform !== 'All') effectiveDimValue = undefined; // Platform is global from context
        if (lowerDimType === 'sku' && filters.skus.length > 0) effectiveDimValue = undefined;

        if (dynamicKey === 'pricing') {
          // For pricing: call the dedicated pricing competition endpoint
          const params = {
            platform: platform || 'All',
            period: '1M',
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD'),
            compareStartDate: compareStart?.format('YYYY-MM-DD'),
            compareEndDate: compareEnd?.format('YYYY-MM-DD'),
            dimension: dimensionType || 'category',
            dimensionValue: effectiveDimValue || undefined,
            location: isCityFilterActive ? city : undefined,
            category: isCategoryFilterActive ? filters.categories.join(',') : undefined,
            brand: isBrandFilterActive ? filters.brands.join(',') : undefined,
          };
          console.log('[KpiTrendShowcase] Fetching PRICING competition data:', params);
          const response = await axiosInstance.get('/pricing-analysis/competition', { params });
          if (response.data) {
            console.log('[KpiTrendShowcase] Pricing competition received:', response.data.brands?.length || 0, 'brands,', response.data.skus?.length || 0, 'skus');
            setCompetitionData({ brands: response.data.brands || [], skus: response.data.skus || [] });
          }
        } else if (dynamicKey === 'marketshare') {
          // For market share: call the dedicated market share competition endpoint
          const params = {
            platform: platform || 'All',
            period: '1M',
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD'),
            compareStartDate: compareStart?.format('YYYY-MM-DD'),
            compareEndDate: compareEnd?.format('YYYY-MM-DD'),
            location: isCityFilterActive ? city : undefined,
            category: isCategoryFilterActive ? filters.categories.join(',') : undefined,
            brand: isBrandFilterActive ? filters.brands.join(',') : undefined,
          };
          console.log('[KpiTrendShowcase] Fetching market share competition data:', params);
          const response = await axiosInstance.get('/market-share/competition', { params });
          if (response.data) {
            console.log('[KpiTrendShowcase] Market Share competition received:', response.data.brands?.length || 0, 'brands,', response.data.skus?.length || 0, 'skus');
            setCompetitionData({ brands: response.data.brands || [], skus: response.data.skus || [] });
          }
        } else {
          // For availability/other: call the watchtower competition endpoint
          const params = {
            platform: platform || 'All',
            location: city === 'All India' ? 'All' : city,
            category: isCategoryFilterActive ? filters.categories.join(',') : 'All',
            brand: isBrandFilterActive ? filters.brands.join(',') : 'All',
            sku: filters.skus.length > 0 ? filters.skus.join(',') : 'All',
            period: '1M',
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD'),
            compareStartDate: compareStart?.format('YYYY-MM-DD'),
            compareEndDate: compareEnd?.format('YYYY-MM-DD'),
          };
          console.log('[KpiTrendShowcase] Fetching watchtower competition data with params:', params);
          const response = await axiosInstance.get('/watchtower/competition', { params });
          if (response.data) {
            console.log('[KpiTrendShowcase] Received:', response.data.brands?.length || 0, 'brands,', response.data.skus?.length || 0, 'skus');
            setCompetitionData({ brands: response.data.brands || [], skus: response.data.skus || [] });
          }
        }
      } catch (error) {
        console.error('[KpiTrendShowcase] Error fetching competition data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompetitionData();
  }, [city, filters, platform, timeStart, timeEnd, compareStart, compareEnd, dynamicKey, dimensionValue, dimensionType]);




  const selectionCount =
    filters.categories.length + filters.brands.length + filters.skus.length;

  // Brand rows from API data (top 8 sorted by OSA)
  const brandRows = useMemo(() => {
    let apiBrands = competitionData.brands || [];

    // Apply local filters if the backend didn't handle them
    if (filters.brands.length > 0) {
      apiBrands = apiBrands.filter(b => filters.brands.includes(b.brand_name || b.name));
    }

    return apiBrands.slice(0, 8).map((b, idx) => {
      const getVal = (v1, v2, v3, v4) => {
        if (v1 !== undefined) return v1;
        if (v2 !== undefined) return v2;
        if (v3 !== undefined) return v3;
        if (v4 !== undefined) return v4;
        return 0;
      };
      const osaVal = getVal(b.OSA?.value, b.osa?.value, b.OSA, b.osa);
      const sosVal = getVal(b.SOS?.value, b.sos?.value, b.SOS, b.sos);
      const priceVal = getVal(b.Price?.value, b.price?.value, b.Price, b.price);
      const listingVal = getVal(b.Listing?.value, b.listing?.value, b.ListingPercent?.value, b.Listing) ?? getVal(b.listing, undefined, undefined, undefined);
      const assortmentVal = getVal(b.Assortment?.value, b.assortment?.value, b.Assortment, b.assortment);
      const catShareVal = getVal(b.CategoryShare?.value, b.categoryShare?.value, b.CategoryShare, b.categoryShare);
      const mktShareVal = getVal(b.MarketShare?.value, b.marketShare?.value, b.MarketShare, b.marketShare);
      return {
        id: b.brand_name || `brand-${idx}`,
        name: b.brand_name || 'Unknown',
        // lowercase keys (legacy)
        osa: osaVal, osaDelta: b.OSA?.delta ?? b.osa?.delta ?? 0,
        sos: sosVal, sosDelta: b.SOS?.delta ?? b.sos?.delta ?? 0,
        price: priceVal, priceDelta: b.Price?.delta ?? b.price?.delta ?? 0,
        listing: listingVal, listingDelta: b.Listing?.delta ?? b.listing?.delta ?? b.ListingPercent?.delta ?? 0,
        assortment: assortmentVal,
        categoryShare: catShareVal, categoryShareDelta: b.CategoryShare?.delta ?? b.categoryShare?.delta ?? 0,
        marketShare: mktShareVal, marketShareDelta: b.MarketShare?.delta ?? b.marketShare?.delta ?? 0,
        // TitleCase keys — these MUST match KPI_KEYS[].key for table rendering
        Osa: osaVal,
        Listing: listingVal,
        Assortment: assortmentVal,
        MarketShare: mktShareVal,
        CategoryShare: catShareVal,
        // Formatting fields for display components
        CategorySize: b.CategorySize?.value ?? b.CategorySize ?? 0,
        Sales: b.Sales?.value ?? b.Sales ?? 0,
        Discount: typeof b.Discount === 'number' ? b.Discount : (b.Discount?.value ?? parseFloat(b.discount ?? b.Discount) ?? 0),
        PricePerUnit: typeof b.PricePerUnit === 'number' ? b.PricePerUnit : (b.PricePerUnit?.value ?? parseFloat(b.pricePerUnit ?? b.PricePerUnit) ?? 0),
        RPI: typeof b.RPI === 'number' ? b.RPI : (b.RPI?.value ?? parseFloat(b.rpi ?? b.RPI) ?? 0),
        ASP: typeof b.ASP === 'number' ? b.ASP : (b.ASP?.value ?? parseFloat(b.asp ?? b.ASP) ?? 0),
        Offtake: typeof b.Offtake === 'number' ? b.Offtake : (b.Offtake?.value ?? parseFloat(b.offtake ?? b.Offtake) ?? 0),
      };
    });
  }, [competitionData.brands, filters.brands]);

  // Derived Trend List For Brands (either selected by user or top 4 default fallback)
  const brandTrendList = useMemo(() => {
    if (selectedBrandIds.length > 0) {
      return brandRows.filter(r => selectedBrandIds.includes(r.id));
    }
    return brandRows;
  }, [selectedBrandIds, brandRows]);

  // SKU rows from API data (top 8 sorted by OSA)
  const skuRows = useMemo(() => {
    let apiSkus = competitionData.skus || [];

    // Apply local filters since the backend API does not natively filter skus
    if (filters.brands.length > 0) {
      apiSkus = apiSkus.filter(s => filters.brands.includes(s.brand_name || s.brandName));
    }
    if (filters.skus.length > 0) {
      apiSkus = apiSkus.filter(s => filters.skus.includes(s.sku_name || s.name));
    }

    return apiSkus.slice(0, 8).map((s, idx) => {
      const getVal = (v1, v2, v3, v4) => {
        if (v1 !== undefined) return v1;
        if (v2 !== undefined) return v2;
        if (v3 !== undefined) return v3;
        if (v4 !== undefined) return v4;
        return 0;
      };
      const osaVal = getVal(s.OSA?.value, s.osa?.value, s.OSA, s.osa);
      const sosVal = getVal(s.SOS?.value, s.sos?.value, s.SOS, s.sos);
      const priceVal = getVal(s.Price?.value, s.price?.value, s.Price, s.price);
      const listingVal = getVal(s.Listing?.value, s.listing?.value, s.ListingPercent?.value, s.Listing) ?? getVal(s.listing, undefined, undefined, undefined);
      const assortmentVal = getVal(s.Assortment?.value, s.assortment?.value, s.Assortment, s.assortment);
      const catShareVal = getVal(s.CategoryShare?.value, s.categoryShare?.value, s.CategoryShare, s.categoryShare);
      const mktShareVal = getVal(s.MarketShare?.value, s.marketShare?.value, s.MarketShare, s.marketShare);
      return {
        id: s.sku_name || `sku-${idx}`,
        name: s.sku_name || 'Unknown',
        brandName: s.brand_name || 'Unknown',
        // lowercase keys (legacy)
        osa: osaVal, osaDelta: s.OSA?.delta ?? s.osa?.delta ?? 0,
        sos: sosVal, sosDelta: s.SOS?.delta ?? s.sos?.delta ?? 0,
        price: priceVal, priceDelta: s.Price?.delta ?? s.price?.delta ?? 0,
        listing: listingVal, listingDelta: s.Listing?.delta ?? s.listing?.delta ?? s.ListingPercent?.delta ?? 0,
        assortment: assortmentVal,
        categoryShare: catShareVal, categoryShareDelta: s.CategoryShare?.delta ?? s.categoryShare?.delta ?? 0,
        marketShare: mktShareVal, marketShareDelta: s.MarketShare?.delta ?? s.marketShare?.delta ?? 0,
        // TitleCase keys — these MUST match KPI_KEYS[].key for table rendering
        Osa: osaVal,
        Listing: listingVal,
        Assortment: assortmentVal,
        MarketShare: mktShareVal,
        CategoryShare: catShareVal,
        // Formatting fields for display components
        CategorySize: s.CategorySize?.value ?? s.CategorySize ?? 0,
        Sales: s.Sales?.value ?? s.Sales ?? 0,
        Discount: typeof s.Discount === 'number' ? s.Discount : (s.Discount?.value ?? parseFloat(s.discount ?? s.Discount) ?? 0),
        PricePerUnit: typeof s.PricePerUnit === 'number' ? s.PricePerUnit : (s.PricePerUnit?.value ?? parseFloat(s.pricePerUnit ?? s.PricePerUnit) ?? 0),
        RPI: typeof s.RPI === 'number' ? s.RPI : (s.RPI?.value ?? parseFloat(s.rpi ?? s.RPI) ?? 0),
        ASP: typeof s.ASP === 'number' ? s.ASP : (s.ASP?.value ?? parseFloat(s.asp ?? s.ASP) ?? 0),
        Offtake: typeof s.Offtake === 'number' ? s.Offtake : (s.Offtake?.value ?? parseFloat(s.offtake ?? s.Offtake) ?? 0),
      };
    });
  }, [competitionData.skus, filters.brands, filters.skus]);

  // Derived Trend List For SKUs (either selected by user or top 5 default fallback)
  const skuTrendList = useMemo(() => {
    if (selectedSkuIds.length > 0) {
      return skuRows.filter(r => selectedSkuIds.includes(r.id));
    }
    return skuRows;
  }, [selectedSkuIds, skuRows]);

  // --- START TREND LOGIC ---
  // Shared trend data for TrendView and KpiCompareView
  const [trendData, setTrendData] = useState({ dates: [], timeSeries: {} });
  const [trendLoading, setTrendLoading] = useState(false);

  const trendTargets = useMemo(() => {
    const list = tab === 'brand' ? brandTrendList : skuTrendList;
    const limit = tab === 'brand' ? 4 : 5;
    return (list || []).slice(0, limit).map(r => r.id);
  }, [tab, brandTrendList, skuTrendList]);

  // Fetch trend data
  useEffect(() => {
    if (viewMode === 'table' || (trendTargets || []).length === 0) return;

    const fetchTrendData = async () => {
      setTrendLoading(true);
      try {
        const isCategoryFilterActive = filters.categories.length > 0;
        const isBrandFilterActive = filters.brands.length > 0;
        const isCityFilterActive = city && city !== 'All India' && city !== 'All';

        let effectiveDimValue = dimensionValue;
        const lowerDimType = dimensionType?.toLowerCase();
        if (lowerDimType === 'category' && isCategoryFilterActive) effectiveDimValue = undefined;
        if (lowerDimType === 'brand' && isBrandFilterActive) effectiveDimValue = undefined;
        if (lowerDimType === 'city' && isCityFilterActive) effectiveDimValue = undefined;
        if (lowerDimType === 'platform' && platform && platform !== 'All') effectiveDimValue = undefined;
        if (lowerDimType === 'sku' && filters.skus.length > 0) effectiveDimValue = undefined;

        let res;
        if (dynamicKey === 'pricing') {
          const params = {
            mode: tab,
            targets: trendTargets.join(','),
            platform: platform || 'All',
            location: isCityFilterActive ? city : 'All',
            category: isCategoryFilterActive ? filters.categories.join(',') : 'All',
            brand: isBrandFilterActive ? filters.brands.join(',') : 'All',
            sku: filters.skus.length > 0 ? filters.skus.join(',') : 'All',
            period: '1M',
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD'),
            dimension: dimensionType || 'category',
            dimensionValue: effectiveDimValue || undefined
          };
          res = await axiosInstance.get('/pricing-analysis/competition-trends', { params });
          if (res.data) {
            setTrendData({
              dates: res.data.dates || [],
              timeSeries: res.data.timeSeriesByTarget || {}
            });
          }
        } else if (dynamicKey === 'marketshare') {
          const params = {
            mode: tab,
            targets: trendTargets.join(','),
            platform: platform || 'All',
            location: isCityFilterActive ? city : 'All',
            category: isCategoryFilterActive ? filters.categories.join(',') : 'All',
            brand: isBrandFilterActive ? filters.brands.join(',') : 'All',
            period: '1M',
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD')
          };
          res = await axiosInstance.get('/market-share/competition-trends', { params });
          if (res.data) {
            setTrendData({
              dates: res.data.dates || [],
              timeSeries: res.data.timeSeriesByTarget || {}
            });
          }
        } else {
          // Watchtower fallback
          const params = {
            brands: tab === 'brand' ? trendTargets.join(',') : 'All',
            skus: tab === 'sku' ? trendTargets.join(',') : 'All',
            location: isCityFilterActive ? city : 'All',
            category: isCategoryFilterActive ? filters.categories.join(',') : (dimensionType === 'category' ? dimensionValue : 'All'),
            period: '1M',
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD'),
          };
          res = await axiosInstance.get('/watchtower/competition-brand-trends', { params });
          if (res.data && res.data.brands) {
            const ts = {};
            const datesSet = new Set();
            Object.entries(res.data.brands || {}).forEach(([target, series]) => {
              ts[target] = {};
              series.forEach(pt => {
                const d = pt.date_key || pt.date;
                datesSet.add(d);
                ts[target][d] = {
                  Osa: pt.osa?.value ?? pt.osa ?? 0,
                  Sos: pt.sos?.value ?? pt.sos ?? 0,
                  Listing: pt.listing?.value ?? pt.listing ?? 0,
                  Assortment: pt.assortment?.value ?? pt.assortment ?? 0,
                  Psl: pt.psl?.value ?? pt.psl ?? pt.Psl ?? 0
                };
              });
            });
            setTrendData({
              dates: Array.from(datesSet).sort(),
              timeSeries: ts
            });
          }
        }
      } catch (error) {
        console.error('[KpiTrendShowcase] Error fetching trend data:', error);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchTrendData();
  }, [viewMode, trendTargets, platform, timeStart, timeEnd, city, filters, dynamicKey, dimensionValue, dimensionType, tab]);
  // --- END TREND LOGIC ---

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
          {viewMode === "table" && <BrandTable rows={brandRows} kpiKeys={kpiKeys} loading={loading} selectedIds={selectedBrandIds} onSelectionChange={setSelectedBrandIds} />}
          {viewMode === "trend" && (
            <TrendView
              mode="brand"
              filters={filters}
              city={city}
              kpiKeys={kpiKeys}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
              platform={platform}
              timeStart={timeStart}
              timeEnd={timeEnd}
              dynamicKey={dynamicKey}
              dimensionValue={dimensionValue}
              dimensionType={dimensionType}
              listData={brandTrendList}
              trendData={trendData}
              loading={trendLoading}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="brand"
              filters={filters}
              city={city}
              kpiKeys={kpiKeys}
              onBackToTrend={() => setViewMode("trend")}
              trendData={trendData}
              loading={trendLoading}
              listData={brandTrendList}
            />
          )}
        </TabsContent>

        {/* SKU TAB */}
        <TabsContent value="sku" className="mt-3">
          {viewMode === "table" && <SkuTable rows={skuRows} kpiKeys={kpiKeys} loading={loading} selectedIds={selectedSkuIds} onSelectionChange={setSelectedSkuIds} />}
          {viewMode === "trend" && (
            <TrendView
              mode="sku"
              filters={filters}
              city={city}
              kpiKeys={kpiKeys}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
              platform={platform}
              timeStart={timeStart}
              timeEnd={timeEnd}
              dynamicKey={dynamicKey}
              dimensionValue={dimensionValue}
              dimensionType={dimensionType}
              listData={skuTrendList}
              trendData={trendData}
              loading={trendLoading}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="sku"
              filters={filters}
              city={city}
              kpiKeys={kpiKeys}
              onBackToTrend={() => setViewMode("trend")}
              trendData={trendData}
              loading={trendLoading}
              listData={skuTrendList}
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
        dynamicKey={dynamicKey}
      />
    </div>
  );
};

export default KpiTrendShowcase;
