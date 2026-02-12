import React, { useMemo, useState, useContext, createContext } from "react";
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
import PaginationFooter from "../../CommonLayout/PaginationFooter";


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
const DASHBOARD_DATA = {
  /* =====================================================================
     TRENDS (MAIN LINE CHART)
  ===================================================================== */
  trends: {
    context: {
      level: "MRP",
      audience: "Platform",
    },

    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",

    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Daily",

    metrics: [
      {
        id: "Offtakes",
        label: "Offtakes",
        color: "#2563EB",
        axis: "left",
        default: true,
      },
      {
        id: "Spend",
        label: "Spend",
        color: "#DC2626",
        axis: "left",
        default: true,
      },
      {
        id: "ROAS",
        label: "ROAS",
        color: "#16A34A",
        axis: "right",
        default: true,
      },
      {
        id: "InorgSales",
        label: "Inorg Sales",
        color: "#7C3AED",
        axis: "right",
      },
      {
        id: "DspSales",
        label: "DSP Sales",
        color: "#0EA5E9",
        axis: "right",
      },
      {
        id: "Conversion",
        label: "Conversion",
        color: "#F97316",
        axis: "left",
      },
      {
        id: "Availability",
        label: "Availability",
        color: "#22C55E",
        axis: "left",
      },
      { id: "SOS", label: "SOS", color: "#A855F7", axis: "left" },
      {
        id: "MarketShare",
        label: "Market Share",
        color: "#9333EA",
        axis: "right",
      },
      {
        id: "PromoMyBrand",
        label: "Promo – My Brand",
        color: "#F59E0B",
        axis: "left",
      },
      {
        id: "PromoCompete",
        label: "Promo – Compete",
        color: "#FB7185",
        axis: "left",
      },
      { id: "CPM", label: "CPM", color: "#64748B", axis: "right" },
      { id: "CPC", label: "CPC", color: "#475569", axis: "right" },
    ],

    points: [
      {
        date: "06 Sep'25",
        Offtakes: 57,
        Spend: 18.4,
        ROAS: 7.1,
        InorgSales: 21,
        DspSales: 14,
        Conversion: 3.4,
        Availability: 84,
        SOS: 42,
        MarketShare: 18.1,
        PromoMyBrand: 12.4,
        PromoCompete: 9.8,
        CPM: 146,
        CPC: 9.6,
      },
      {
        date: "08 Sep'25",
        Offtakes: 49,
        Spend: 20.1,
        ROAS: 6.2,
        InorgSales: 17,
        DspSales: 11,
        Conversion: 2.9,
        Availability: 79,
        SOS: 38,
        MarketShare: 16.9,
        PromoMyBrand: 14.8,
        PromoCompete: 11.2,
        CPM: 162,
        CPC: 10.8,
      },
      {
        date: "10 Sep'25",
        Offtakes: 52,
        Spend: 17.8,
        ROAS: 6.9,
        InorgSales: 19,
        DspSales: 13,
        Conversion: 3.2,
        Availability: 78,
        SOS: 40,
        MarketShare: 17.2,
        PromoMyBrand: 11.9,
        PromoCompete: 9.3,
        CPM: 142,
        CPC: 9.2,
      },
      {
        date: "13 Sep'25",
        Offtakes: 44,
        Spend: 21.4,
        ROAS: 5.8,
        InorgSales: 15,
        DspSales: 10,
        Conversion: 2.6,
        Availability: 72,
        SOS: 35,
        MarketShare: 16.1,
        PromoMyBrand: 15.6,
        PromoCompete: 12.9,
        CPM: 171,
        CPC: 11.6,
      },
      {
        date: "16 Sep'25",
        Offtakes: 51,
        Spend: 16.9,
        ROAS: 7.3,
        InorgSales: 22,
        DspSales: 15,
        Conversion: 3.5,
        Availability: 82,
        SOS: 43,
        MarketShare: 18.0,
        PromoMyBrand: 10.8,
        PromoCompete: 8.6,
        CPM: 138,
        CPC: 8.9,
      },
      {
        date: "18 Sep'25",
        Offtakes: 47,
        Spend: 19.7,
        ROAS: 6.4,
        InorgSales: 18,
        DspSales: 12,
        Conversion: 3.0,
        Availability: 76,
        SOS: 39,
        MarketShare: 16.8,
        PromoMyBrand: 13.9,
        PromoCompete: 10.7,
        CPM: 155,
        CPC: 10.3,
      },
      {
        date: "20 Sep'25",
        Offtakes: 56,
        Spend: 19.6,
        ROAS: 7.4,
        InorgSales: 24,
        DspSales: 16,
        Conversion: 3.6,
        Availability: 85,
        SOS: 45,
        MarketShare: 18.9,
        PromoMyBrand: 14.6,
        PromoCompete: 10.5,
        CPM: 151,
        CPC: 10.1,
      },
      {
        date: "23 Sep'25",
        Offtakes: 42,
        Spend: 22.8,
        ROAS: 5.5,
        InorgSales: 14,
        DspSales: 9,
        Conversion: 2.4,
        Availability: 70,
        SOS: 33,
        MarketShare: 15.6,
        PromoMyBrand: 16.8,
        PromoCompete: 13.5,
        CPM: 178,
        CPC: 12.2,
      },
      {
        date: "26 Sep'25",
        Offtakes: 50,
        Spend: 17.2,
        ROAS: 7.0,
        InorgSales: 20,
        DspSales: 14,
        Conversion: 3.3,
        Availability: 81,
        SOS: 41,
        MarketShare: 17.7,
        PromoMyBrand: 11.6,
        PromoCompete: 9.1,
        CPM: 144,
        CPC: 9.4,
      },
      {
        date: "30 Sep'25",
        Offtakes: 58,
        Spend: 18.9,
        ROAS: 7.8,
        InorgSales: 26,
        DspSales: 18,
        Conversion: 3.9,
        Availability: 87,
        SOS: 47,
        MarketShare: 19.4,
        PromoMyBrand: 13.2,
        PromoCompete: 9.7,
        CPM: 148,
        CPC: 9.0,
      },
    ],
  },

  /* =====================================================================
     COMPARE SKUs
  ===================================================================== */
  compareSkus: {
    context: { level: "MRP" },

    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",

    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Weekly",

    metrics: [
      {
        id: "Offtakes",
        label: "Offtakes",
        color: "#2563EB",
        default: true,
      },
      { id: "Spend", label: "Spend", color: "#DC2626", default: true },
      { id: "ROAS", label: "ROAS", color: "#16A34A", default: true },
      { id: "MarketShare", label: "Market Share", color: "#9333EA" },
      { id: "Conversion", label: "Conversion", color: "#F97316" },
    ],

    x: ["W1", "W2", "W3", "W4"],

    trendsBySku: {
      1: [
        {
          x: "W1",
          Offtakes: 54,
          Spend: 4.2,
          ROAS: 6.8,
          MarketShare: 17.6,
          Conversion: 3.2,
        },
        {
          x: "W2",
          Offtakes: 55,
          Spend: 4.5,
          ROAS: 7.0,
          MarketShare: 17.9,
          Conversion: 3.3,
        },
        {
          x: "W3",
          Offtakes: 56,
          Spend: 4.8,
          ROAS: 7.2,
          MarketShare: 18.1,
          Conversion: 3.4,
        },
        {
          x: "W4",
          Offtakes: 57,
          Spend: 5.0,
          ROAS: 7.4,
          MarketShare: 18.4,
          Conversion: 3.5,
        },
      ],
    },
  },

  /* =====================================================================
     COMPETITION TABLE
  ===================================================================== */
  competition: {
    context: {
      level: "MRP",
      region: "All × Chennai",
    },

    tabs: ["Brands", "SKUs"],

    periodToggle: {
      primary: "MTD",
      compare: "Previous Month",
    },

    columns: [
      { id: "brand", label: "Brand / SKU", type: "text" },
      { id: "Offtakes", label: "Offtakes", type: "metric" },
      { id: "Spend", label: "Spend", type: "metric" },
      { id: "ROAS", label: "ROAS", type: "metric" },
      { id: "SOS", label: "SOS", type: "metric" },
      { id: "MarketShare", label: "Market Share", type: "metric" },
    ],

    brands: [
      {
        brand: "Colgate",
        Offtakes: { value: 32.9, delta: -4.5 },
        Spend: { value: 6.8, delta: 0.4 },
        ROAS: { value: 7.3, delta: 0.2 },
        SOS: { value: 44, delta: 1.2 },
        MarketShare: { value: 18.8, delta: 0.4 },
      },
      {
        brand: "Sensodyne",
        Offtakes: { value: 19.6, delta: 2.2 },
        Spend: { value: 5.1, delta: -0.3 },
        ROAS: { value: 6.9, delta: -0.1 },
        SOS: { value: 39, delta: -0.8 },
        MarketShare: { value: 18.5, delta: -0.3 },
      },
    ],
  },
};

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
    { id: "amul", name: "Amul", category: "Cassata" },
    { id: "mother-dairy", name: "Mother Dairy", category: "Core Tubs" },
    { id: "vadilal", name: "Vadilal", category: "Cup" },
    { id: "havmor", name: "Havmor", category: "Sandwich" },
    { id: "baskin-robbins", name: "Baskin Robbins", category: "Core Tubs" },
    { id: "london-dairy", name: "London Dairy", category: "Premium" },
    { id: "cream-bell", name: "Cream Bell", category: "Cup" },
    { id: "kwality-walls", name: "Kwality Walls", category: "All" },
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

  // helper → generate KPI object
  const buildKpis = (base, idxFactor = 1, cityIdx = 0) => ({
    offtakes: base * 10 + idxFactor * 2 + cityIdx * 15,
    spend: base * 1.8 + idxFactor * 0.4 + cityIdx * 2.5,
    roas: 4 + (idxFactor % 3) * 0.3 + cityIdx * 0.2,
    inorgSales: base * 0.9 + idxFactor * 0.2 + cityIdx * 1.2,
    dspSales: base * 0.7 + idxFactor * 0.15 + cityIdx * 0.8,
    conversion: 1.8 + (idxFactor % 4) * 0.2 + cityIdx * 0.1,
    availability: 75 + idxFactor * 0.8 + cityIdx * 1.5,
    osa: 75 + idxFactor * 0.8 + cityIdx * 1.5,
    sos: 22 + idxFactor * 0.6 + cityIdx * 2,
    price: 250 + idxFactor * 20 + cityIdx * 45,
    marketShare: 10 + idxFactor * 0.7 + cityIdx * 0.9,
    promoMyBrand: 6 + idxFactor * 0.3 + cityIdx * 0.4,
    promoCompete: 5 + idxFactor * 0.25 + cityIdx * 0.3,
    cpm: 140 + idxFactor * 4 + cityIdx * 8,
    cpc: 9 + idxFactor * 0.4 + cityIdx * 0.5,
  });

  RAW_DATA.cities.forEach((city, cityIdx) => {
    /* ------------------------------------------------------------------ */
    /* BRAND SUMMARY                                                       */
    /* ------------------------------------------------------------------ */
    brandSummaryByCity[city] = RAW_DATA.brands.map((brand, brandIdx) => {
      const base = 10 + cityIdx + brandIdx;

      return {
        id: brand.id,
        name: brand.name,
        category: brand.category,
        ...buildKpis(base, brandIdx, cityIdx),
      };
    });

    /* ------------------------------------------------------------------ */
    /* SKU SUMMARY                                                         */
    /* ------------------------------------------------------------------ */
    skuSummaryByCity[city] = RAW_DATA.skus.map((sku, skuIdx) => {
      const brandIdx = RAW_DATA.brands.findIndex((b) => b.id === sku.brandId);
      const base = 8 + cityIdx + skuIdx + brandIdx * 0.5;

      return {
        id: sku.id,
        name: sku.name,
        brandId: sku.brandId,
        brandName: BRAND_ID_TO_NAME[sku.brandId],
        category: sku.category,
        ...buildKpis(base, skuIdx, cityIdx),
      };
    });

    /* ------------------------------------------------------------------ */
    /* BRAND TRENDS                                                        */
    /* ------------------------------------------------------------------ */
    brandTrendsByCity[city] = {};
    RAW_DATA.brands.forEach((brand, brandIdx) => {
      const base = 10 + brandIdx + cityIdx;

      brandTrendsByCity[city][brand.id] = days.map((date, idx) => ({
        date,
        offtakes: base * 10 + Math.sin(idx / 3) * 5,
        spend: base * 1.7 + Math.cos(idx / 4) * 0.6,
        roas: 4 + Math.sin(idx / 5) * 0.4,
        inorgSales: base * 0.9 + Math.cos(idx / 6) * 0.3,
        dspSales: base * 0.7 + Math.sin(idx / 7) * 0.2,
        conversion: 1.9 + Math.cos(idx / 6) * 0.15,
        availability: 78 + Math.sin(idx / 5) * 2,
        osa: 78 + Math.sin(idx / 5) * 2,
        sos: 23 + Math.cos(idx / 4) * 1.5,
        price: 320 + Math.sin(idx / 3) * 30,
        categoryShare: 18 + Math.cos(idx / 6) * 2.5,
        marketShare: 11 + Math.sin(idx / 6) * 1.2,
        promoMyBrand: 6 + Math.sin(idx / 5) * 0.8,
        promoCompete: 5 + Math.cos(idx / 6) * 0.7,
        cpm: 145 + Math.sin(idx / 4) * 6,
        cpc: 9.2 + Math.cos(idx / 5) * 0.5,
      }));
    });

    /* ------------------------------------------------------------------ */
    /* SKU TRENDS                                                          */
    /* ------------------------------------------------------------------ */
    skuTrendsByCity[city] = {};
    RAW_DATA.skus.forEach((sku, skuIdx) => {
      const base = 8 + skuIdx + cityIdx;

      skuTrendsByCity[city][sku.id] = days.map((date, idx) => ({
        date,
        offtakes: base * 9 + Math.sin(idx / 3) * 4,
        spend: base * 1.6 + Math.cos(idx / 4) * 0.5,
        roas: 3.8 + Math.sin(idx / 5) * 0.3,
        inorgSales: base * 0.8 + Math.cos(idx / 6) * 0.25,
        dspSales: base * 0.65 + Math.sin(idx / 7) * 0.2,
        conversion: 1.7 + Math.cos(idx / 6) * 0.12,
        availability: 76 + Math.sin(idx / 5) * 2,
        osa: 76 + Math.sin(idx / 5) * 2,
        sos: 21 + Math.cos(idx / 4) * 1.3,
        price: 280 + Math.sin(idx / 3) * 25,
        categoryShare: 16 + Math.cos(idx / 6) * 1.5,
        marketShare: 9.5 + Math.sin(idx / 6) * 1,
        promoMyBrand: 5.5 + Math.sin(idx / 5) * 0.6,
        promoCompete: 4.8 + Math.cos(idx / 6) * 0.6,
        cpm: 142 + Math.sin(idx / 4) * 5,
        cpc: 8.8 + Math.cos(idx / 5) * 0.45,
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

const FilterDialog = ({ open, onClose, mode, value, onChange }) => {
  // initial tab: brand view starts with category, sku view starts with sku
  const [activeTab, setActiveTab] = useState(
    mode === "brand" ? "category" : "sku"
  );
  const [search, setSearch] = useState("");

  // strict dependency: Category -> Brand -> SKU
  // helpers to build dependent option lists

  const getBrandOptions = () => {
    let brands = RAW_DATA.brands;

    // if categories selected, only brands from those categories
    if (value.categories.length) {
      brands = brands.filter((b) => value.categories.includes(b.category));
    }

    return brands.map((b) => b.name);
  };

  const getSkuOptions = () => {
    let skus = RAW_DATA.skus;

    // filter by categories (if selected)
    if (value.categories.length) {
      skus = skus.filter((s) => value.categories.includes(s.category));
    }

    // filter by brands (if selected)
    if (value.brands.length) {
      const allowedBrandIds = new Set(
        value.brands.map((name) => BRAND_NAME_TO_ID[name]).filter(Boolean)
      );
      skus = skus.filter((s) => allowedBrandIds.has(s.brandId));
    }

    return skus.map((s) => s.name);
  };

  const tabOptions = ["category", "brand", "sku"]; // always show all three

  const getListForTab = () => {
    if (activeTab === "category") return CATEGORY_OPTIONS;
    if (activeTab === "brand") return getBrandOptions();
    return getSkuOptions();
  };

  const list = useMemo(() => {
    const base = getListForTab() || [];
    return base.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeTab, search, value]); // value drives dependencies

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
  const [activeMetric, setActiveMetric] = useState("osa");

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

      return rows.length
        ? rows.slice(0, 4).map((r) => r.id)
        : [];
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
                  name={
                    isBrandMode ? BRAND_ID_TO_NAME[id] : SKU_ID_TO_NAME[id]
                  }
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
    key: "marketShare",
    label: "Market Share",
    color: "#22C55E", // emerald
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

      <CardContent className="grid max-h-[420px] gap-4 overflow-y-auto pt-4 md:grid-cols-2">
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

const BrandTable = ({ rows }) => {
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
                <th className="px-3 py-2 text-right w-[16%]">Market Share</th>
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
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">
                    {row.name}
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
                    {row.marketShare.toFixed(1)}%
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
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


const SkuTable = ({ rows }) => {
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
                <th className="px-3 py-2 text-right w-[12%]">Mkt Share</th>
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
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-slate-900 border-r border-slate-100">
                    {row.brandName}
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
                    {row.marketShare.toFixed(1)}%
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
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

const PlatformOverviewKpiShowcase = ({ selectedItem, selectedLevel }) => {
  const [tab, setTab] = useState("brand"); // "brand" | "sku"
  const [city, setCity] = useState(CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    skus: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"

  const selectionCount =
    filters.categories.length + filters.brands.length + filters.skus.length;

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
    // if SKUs selected, show only brands that have any selected SKU
    if (filters.skus.length) {
      const brandIdsWithSelectedSkus = new Set(
        RAW_DATA.skus
          .filter((s) => filters.skus.includes(s.name))
          .map((s) => s.brandId)
      );
      rows = rows.filter((r) => brandIdsWithSelectedSkus.has(r.id));
    }

    return rows;
  }, [city, filters]);

  const skuRows = useMemo(() => {
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

    return rows;
  }, [city, filters]);

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
              Competition Brands
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
