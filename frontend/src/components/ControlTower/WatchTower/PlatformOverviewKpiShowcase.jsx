import React, { useMemo, useState, useEffect, useContext, useCallback, createContext } from "react";
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
import axiosInstance from "../../../api/axiosInstance";
import ErrorRetryOverlay from "../../CommonLayout/ErrorRetryOverlay";
import { useAuth } from "../../../utils/AuthContext";


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

// Map metric IDs to their data source group for N/A detection
export const KPI_SOURCE_MAP = {
  // PDP table KPIs
  Offtakes: 'pdp', offtakes: 'pdp', Offtake: 'pdp',
  Availability: 'pdp', Osa: 'pdp', osa: 'pdp',
  Discount: 'pdp', 'Promo-My': 'pdp', 'promo-my': 'pdp', PromoMyBrand: 'pdp', discount: 'pdp',
  Assortment: 'pdp', Listing: 'pdp',
  PricePerUnit: 'pdp', ASP: 'pdp', RPI: 'pdp',
  // PM table KPIs
  InorganicSales: 'pm', InorgSales: 'pm',
  Conversion: 'pm', conversion: 'pm', Roas: 'pm', ROAS: 'pm', roas: 'pm',
  BmiSalesRatio: 'pm', Spend: 'pm', spend: 'pm',
  CPM: 'pm', cpm: 'pm', CPC: 'pm', cpc: 'pm',
  dspSales: 'pm',
  // KW table KPIs
  ShareOfSearch: 'kw', SOS: 'kw', Sos: 'kw', sos: 'kw',
  // MS table KPIs
  MarketShare: 'ms', CategoryShare: 'ms',
  marketShare: 'ms', categoryShare: 'ms',
};

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
        label: "Promo-My %",
        color: "#F59E0B",
        axis: "right",
      },
      {
        id: "PromoCompete",
        label: "Promo-Compete %",
        color: "#D97706",
        axis: "right",
      },

      { id: "CPM", label: "CPM", color: "#64748B", axis: "right" },
      { id: "CPC", label: "CPC", color: "#475569", axis: "right" },
      { id: "ASP", label: "ASP", color: "#E11D48", axis: "right" },
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
        ASP: 185,
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
        ASP: 210,
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
        ASP: 195,
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
        ASP: 240,
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
        ASP: 175,
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
      { id: "SOS", label: "SOS", type: "metric" },
      { id: "MarketShare", label: "Market Share", type: "metric" },
    ],

    brands: [
      {
        brand: "Colgate",
        SOS: { value: 44, delta: 1.2 },
        MarketShare: { value: 18.8, delta: 0.4 },
      },
      {
        brand: "Sensodyne",
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
const DAYS = Array.from({ length: 20 }).map((_, i) => `${(i + 6).toString().padStart(2, '0')} Nov'25`);

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
    { id: "cornetto", name: "Cornetto", category: "Cone" },
    { id: "magnum", name: "Magnum", category: "Stick" },
    { id: "feast", name: "Feast", category: "Stick" },
    { id: "twister", name: "Twister", category: "Ice Lolly" },
    { id: "arun", name: "Arun", category: "Cup" },
    { id: "grameen", name: "Grameen", category: "Stick" },
    { id: "go-zero", name: "Go-Zero", category: "Tub" },
    { id: "hocco", name: "Hocco", category: "Cone" },
    { id: "dairy-day", name: "Dairy Day", category: "Cup" },
    { id: "nic", name: "Nic", category: "Tub" },
    { id: "minus-30", name: "Minus 30", category: "Tub" },
    { id: "infino", name: "Infino", category: "Bar" },
    { id: "noto", name: "Noto", category: "Tub" },
    { id: "get-a-way", name: "Get-A-Way", category: "Tub" },
    { id: "hangyo", name: "Hangyo", category: "Cone" },
  ],
  skus: [
    { id: "amul-tricone", name: "Amul Tricone 120ml", brandId: "amul", category: "Cone" },
    { id: "md-cup", name: "Mother Dairy Vanilla Cup", brandId: "mother-dairy", category: "Cup" },
    { id: "vadilal-bombay", name: "Vadilal Bombay Kulfi", brandId: "vadilal", category: "Stick" },
    { id: "havmor-block", name: "Havmor Choco Block", brandId: "havmor", category: "Block" },
    { id: "br-scoop", name: "BR Gold Medal Ribbon", brandId: "baskin-robbins", category: "Scoop" },
    { id: "london-tub", name: "London Dairy Tiramisu", brandId: "london-dairy", category: "Tub" },
    // Added Kwality Walls SKUs shown in the competition modal
    { id: "kw-cornetto-disc-110ml", name: "KW Cornetto Disc 110ml", brandId: "kwality-walls", category: "Cone" },
    { id: "kw-magnum-almond-90ml", name: "KW Magnum Almond 90ml", brandId: "kwality-walls", category: "Stick" },
    { id: "kw-feast-jaljeera-65ml", name: "KW Feast Jaljeera 65ml", brandId: "kwality-walls", category: "Stick" },
    { id: "kw-cup-vanilla-100ml", name: "KW Cup Vanilla 100ml", brandId: "kwality-walls", category: "Cup" },
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

const BRAND_MARKET_SHARES = {
  "Amul": 20,
  "Kwality Walls": 19,
  "Baskin Robbins": 13,
  "Havmor": 7,
  "Cream Bell": 6,
  "Arun": 5,
  "Grameen": 4,
  "Go-Zero": 4,
  "Hocco": 4,
  "Dairy Day": 3,
  "Vadilal": 1,
  "Nic": 1,
  "Minus 30": 1,
  "Infino": 1,
  "Noto": 1,
  "Mother Dairy": 1,
  "Get-A-Way": 1,
  "Hangyo": 1,
  "London Dairy": 1
};

const getBrandShare = (name) => BRAND_MARKET_SHARES[name] || 0.5;

// SOS Logic: High variance, total < 90%
const getBrandSOS = (name) => {
  if (name === "Amul") return 30 + Math.random() * 5; // ~30-35%
  if (name === "Kwality Walls") return 25 + Math.random() * 5; // ~25-30%
  if (name === "Baskin Robbins") return 10 + Math.random() * 4; // ~10-14%
  if (name === "Havmor" || name === "Cream Bell") return 5 + Math.random() * 2; // ~5-7%
  return 0.5 + Math.random() * 2; // ~0.5-2.5%
};

const CATEGORY_PRICES_MAP = {
  "Cone": [0, 50, 100, 150],
  "Stick": [0, 25, 50, 75, 100],
  "Sticks": [0, 25, 50, 75, 100],
  "Tub": [0, 100, 200, 300, 400],
  "Tubs": [0, 100, 200, 300, 400],
  "Core Tubs": [0, 100, 200, 300, 400],
  "Cup": [0, 50, 100, 150],
  "Sandwich": [0, 50, 100, 150],
  "Cassata": [0, 50, 100, 150],
  "Cakes": [0, 100, 200, 300, 400],
  "Bon Bon/ Mini Bites": [0, 100, 200, 300, 400],
  "Cheesecakes & Pastries": [0, 100, 200, 300, 400],
  "Ice Lolly": [0, 25, 50, 75, 100],
  "Bar": [0, 25, 50, 75, 100],
  "Others": [0, 100, 200, 300, 400],
  "All": [0, 50, 100, 150],
  "Premium": [0, 100, 200, 300, 400],
};

const getPriceFromBucket = (cat, base) => {
  const buckets = CATEGORY_PRICES_MAP[cat] || [0, 50, 100, 150];
  const b = Math.floor(base); // ensure integer
  const bucketIdx = (b % (buckets.length - 1)) + 1;
  const target = buckets[bucketIdx];
  const prev = buckets[bucketIdx - 1];

  if (target === undefined || prev === undefined) return 60; // requested fallback

  // variance within bucket
  return prev + (target - prev) * 0.7 + (b % 5);
};

/** Build mock metrics and trends – all UI reads from this single data model */
const buildDataModel = () => {
  const days = DAYS;

  const brandSummaryByCity = {};
  const skuSummaryByCity = {};
  const brandTrendsByCity = {};
  const skuTrendsByCity = {};

  // helper → generate KPI object
  const buildKpis = (base, idxFactor = 1, cityIdx = 0) => ({
    offtakes: (base * 0.5 + idxFactor * 0.2 + (cityIdx % 3) * 0.5), // Cr
    spend: (base * 0.1 + idxFactor * 0.05 + cityIdx * 0.1), // L
    roas: 5 + (idxFactor % 3) * 0.5 + (cityIdx % 2) * 0.3, // Category Size
    ppu: 45 + (idxFactor % 5) * 2 + (cityIdx % 3), // PPU
    wtDisc: 12 + (idxFactor % 4) * 1.5 + (cityIdx % 2), // Wt Disc %
    dsListing: 88 + (idxFactor % 3) * 2 + (cityIdx % 4), // Ds Listing %
    inorgSales: base * 0.9 + idxFactor * 0.2 + cityIdx * 1.2,
    dspSales: base * 0.7 + idxFactor * 0.15 + cityIdx * 0.8,
    conversion: 15 + (idxFactor % 4) * 0.8 + cityIdx * 0.5,
    availability: 85 + idxFactor * 0.4 + (cityIdx % 3) * 1.2,
    osa: 75 + (idxFactor % 5) * 0.8 + (cityIdx % 4) * 0.5,
    sos: 20 + (idxFactor % 10) * 1.5 + (cityIdx % 3) * 2,
    price: 85 + (idxFactor % 3) * 40 + (cityIdx % 4) * 10,
    marketShare: 10, // will be overridden for brands
    promoMyBrand: 6 + idxFactor * 0.3 + cityIdx * 0.4,
    promoCompete: 5 + idxFactor * 0.25 + cityIdx * 0.3,
    cpm: 140 + idxFactor * 4 + cityIdx * 8,
    cpc: 9 + idxFactor * 0.4 + cityIdx * 0.5,
    asp: 100 + (idxFactor * 10 + cityIdx * 5) % 220,
    // Deltas
    offtakesDelta: (Math.sin(base * 1.5) * 10),
    ppuDelta: (Math.cos(base * 1.2) * 4),
    wtDiscDelta: (Math.sin(base * 1.4) * 2),
    dsListingDelta: (Math.cos(base * 1.6) * 3),
    osaDelta: (Math.cos(base * 1.8) * 5),
    sosDelta: (Math.sin(base * 2.2) * 3),
    priceDelta: (Math.cos(base * 2.5) * 15),
    marketShareDelta: (Math.sin(base * 2.8) * 2),
    aspDelta: 5 + (Math.abs(Math.sin(base * 2.0)) * 5),
  });

  RAW_DATA.cities.forEach((city, cityIdx) => {
    /* ------------------------------------------------------------------ */
    /* BRAND SUMMARY                                                       */
    /* ------------------------------------------------------------------ */
    brandSummaryByCity[city] = RAW_DATA.brands.map((brand, brandIdx) => {
      const base = 10 + cityIdx + brandIdx;

      const kpis = buildKpis(base, brandIdx, cityIdx);

      // Override based on image data
      if (brand.name === "Amul") {
        kpis.offtakes = 4.25;
        kpis.marketShare = 20.0;
        kpis.osa = 75.0;
        kpis.sos = 33.3;
        kpis.price = 85.0;
      } else if (brand.name === "Mother Dairy") {
        kpis.offtakes = 0.52;
        kpis.marketShare = 1.0;
        kpis.osa = 75.8;
        kpis.sos = 1.8;
        kpis.price = 371.0;
      } else if (brand.name === "Vadilal") {
        kpis.offtakes = 0.48;
        kpis.marketShare = 1.0;
        kpis.osa = 76.6;
        kpis.sos = 1.8;
        kpis.price = 37.0;
      } else if (brand.name === "Havmor") {
        kpis.offtakes = 1.42;
        kpis.marketShare = 7.0;
        kpis.osa = 77.4;
        kpis.sos = 5.2;
        kpis.price = 88.0;
      } else if (brand.name === "Baskin Robbins") {
        kpis.offtakes = 2.85;
        kpis.marketShare = 13.0;
        kpis.osa = 78.2;
        kpis.sos = 10.3;
        kpis.price = 274.0;
      } else {
        kpis.marketShare = getBrandShare(brand.name);
        kpis.sos = getBrandSOS(brand.name);
        kpis.price = getPriceFromBucket(brand.category, base);
      }

      // Location based variation for deltas
      kpis.osaDelta = Math.cos(base * 0.8) * 6;
      kpis.sosDelta = Math.sin(base * 1.1) * 4;
      kpis.priceDelta = Math.cos(base * 1.4) * 10;
      kpis.marketShareDelta = Math.sin(base * 1.7) * 2;
      kpis.offtakesDelta = Math.sin(base * 1.3) * 5;

      return {
        id: brand.id,
        name: brand.name,
        category: brand.category,
        ...kpis,
      };
    });

    /* ------------------------------------------------------------------ */
    /* SKU SUMMARY                                                         */
    /* ------------------------------------------------------------------ */
    skuSummaryByCity[city] = RAW_DATA.skus.map((sku, skuIdx) => {
      const brandIdx = RAW_DATA.brands.findIndex((b) => b.id === sku.brandId);
      const base = 8 + cityIdx + skuIdx + brandIdx * 0.5;

      const kpis = buildKpis(base, skuIdx, cityIdx);

      // Override for SKU logic: Market Share 0.2-1.5%, SOS 0-20%
      kpis.marketShare = 0.2 + ((base * 1.3) % 1.3);
      kpis.sos = (base * 5.7) % 20;
      // Price based on category buckets from image
      kpis.price = getPriceFromBucket(sku.category, base);

      // Ensure deltas also vary
      kpis.osaDelta = Math.cos(base * 1.2) * 4;
      kpis.sosDelta = Math.sin(base * 1.5) * 2;
      kpis.priceDelta = Math.cos(base * 2.2) * 3;
      kpis.marketShareDelta = Math.sin(base * 2.5) * 0.5;

      return {
        id: sku.id,
        name: sku.name,
        brandId: sku.brandId,
        brandName: BRAND_ID_TO_NAME[sku.brandId],
        category: sku.category,
        ...kpis,
      };
    });

    /* ------------------------------------------------------------------ */
    /* BRAND TRENDS                                                        */
    /* ------------------------------------------------------------------ */
    brandTrendsByCity[city] = {};
    RAW_DATA.brands.forEach((brand, brandIdx) => {
      const base = 10 + brandIdx + cityIdx;
      const buckets = CATEGORY_PRICES_MAP[brand.category] || [0, 50, 100, 150];

      brandTrendsByCity[city][brand.id] = days.map((date, idx) => {
        const phase = (brandIdx * 1.5) + (cityIdx * 2.1);
        const freq = 3.5 + (brandIdx % 2);

        return {
          date,
          offtakes: base * 10 + Math.sin(idx / freq + phase) * 8,
          spend: base * 1.7 + Math.cos(idx / (freq + 0.5) + phase) * 1.2,
          roas: 4 + Math.sin(idx / (freq + 1) + phase) * 0.6,
          inorgSales: base * 0.9 + Math.cos(idx / (freq + 1.5) + phase) * 0.5,
          dspSales: base * 0.7 + Math.sin(idx / (freq + 2) + phase) * 0.4,
          conversion: 1.9 + Math.cos(idx / (freq + 1.2) + phase) * 0.25,
          availability: 78 + Math.sin(idx / (freq + 0.8) + phase) * 4,
          osa: 78 + Math.sin(idx / (freq + 0.8) + phase) * 4,
          sos: 23 + Math.cos(idx / freq + phase) * 3,
          price: (buckets[((Math.floor(base) + cityIdx) % (buckets.length - 1)) + 1] || 100) + Math.sin(idx / 4 + phase) * 10,
          categoryShare: 18 + Math.cos(idx / 5 + phase) * 4,
          marketShare: 11 + Math.sin(idx / 6 + phase) * 2,
          promoMyBrand: 6 + Math.sin(idx / 5 + phase) * 1.5,
          promoCompete: 5 + Math.cos(idx / 6 + phase) * 1.2,
          cpm: 145 + Math.sin(idx / 4 + phase) * 12,
          cpc: 9.2 + Math.cos(idx / 5 + phase) * 0.8,
          asp: 180 + Math.sin(idx / 4 + phase) * 40,
        };
      });
    });

    /* ------------------------------------------------------------------ */
    /* SKU TRENDS                                                          */
    /* ------------------------------------------------------------------ */
    skuTrendsByCity[city] = {};
    RAW_DATA.skus.forEach((sku, skuIdx) => {
      const brandIdx = RAW_DATA.brands.findIndex((b) => b.id === sku.brandId);
      const base = 8 + cityIdx + skuIdx + (brandIdx * 1.2);
      const buckets = CATEGORY_PRICES_MAP[sku.category] || [0, 50, 100, 150];

      skuTrendsByCity[city][sku.id] = days.map((date, idx) => {
        const phase = (skuIdx * 2.2) + (cityIdx * 3.3);
        const freq = 2.8 + (skuIdx % 3);

        return {
          date,
          offtakes: base * 9 + Math.sin(idx / freq + phase) * 6,
          spend: base * 1.6 + Math.cos(idx / (freq + 0.5) + phase) * 1,
          roas: 3.8 + Math.sin(idx / (freq + 1) + phase) * 0.5,
          inorgSales: base * 0.8 + Math.cos(idx / (freq + 1.5) + phase) * 0.4,
          dspSales: base * 0.65 + Math.sin(idx / (freq + 2) + phase) * 0.35,
          conversion: 1.7 + Math.cos(idx / (freq + 1.2) + phase) * 0.2,
          availability: 76 + Math.sin(idx / (freq + 0.8) + phase) * 3.5,
          osa: 76 + Math.sin(idx / (freq + 0.8) + phase) * 3.5,
          sos: 21 + Math.cos(idx / freq + phase) * 2.5,
          price: (buckets[((Math.floor(base) + cityIdx) % (buckets.length - 1)) + 1] || 60) + Math.sin(idx / 4 + phase) * 5,
          categoryShare: 16 + Math.cos(idx / 5 + phase) * 2.5,
          marketShare: 9.5 + Math.sin(idx / 6 + phase) * 1.8,
          promoMyBrand: 5.5 + Math.sin(idx / 5 + phase) * 1.2,
          promoCompete: 4.8 + Math.cos(idx / 6 + phase) * 1,
          cpm: 142 + Math.sin(idx / 4 + phase) * 10,
          cpc: 8.8 + Math.cos(idx / 5 + phase) * 0.7,
          asp: 160 + Math.sin(idx / 4 + phase) * 30,
        };
      });
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
  const [activeTab, setActiveTab] = useState(
    mode === "brand" ? "category" : "sku"
  );
  const [search, setSearch] = useState("");

  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    brands: [],
    skus: [],
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!open) return;

    const fetchFilterOptions = async () => {
      setFilterOptions(prev => ({ ...prev, loading: true, error: null }));

      try {
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
        }
      } catch (error) {
        console.error('[FilterDialog] Error:', error);
        setFilterOptions(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load filter options'
        }));
      }
    };

    fetchFilterOptions();
  }, [open, value.categories, value.brands, platform, location]);

  const getListForTab = () => {
    if (activeTab === "category") return filterOptions.categories;
    if (activeTab === "brand") return filterOptions.brands;
    return filterOptions.skus;
  };

  const list = useMemo(() => {
    const base = getListForTab() || [];
    return base.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeTab, search, filterOptions]);

  const currentKey =
    activeTab === "category"
      ? "categories"
      : activeTab === "brand"
        ? "brands"
        : "skus";

  const handleToggle = (type, item) => {
    const current = new Set(value[type]);
    if (current.has(item)) current.delete(item);
    else current.add(item);

    const next = { ...value, [type]: Array.from(current) };

    if (type === "categories") {
      next.brands = [];
      next.skus = [];
    } else if (type === "brands") {
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
                {["category", "brand", "sku"].map((t) => (
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
          <div className="flex-1 min-w-0 px-6 py-4">
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
              <div className="space-y-1 p-3">
                {list.map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-3 w-full rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <Checkbox
                      checked={value[currentKey].includes(item)}
                      onCheckedChange={() => handleToggle(currentKey, item)}
                    />
                    <span className="truncate flex-1 min-w-0" title={item}>{item}</span>
                  </label>
                ))}

                {list.length === 0 && (
                  <div className="px-3 py-8 text-center text-xs text-slate-400">
                    {filterOptions.loading ? "Loading..." : filterOptions.error ? filterOptions.error : "No options found."}
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

const MetricChip = ({ label, color, active, onClick, isNA }) => {
  return (
    <Box
      onClick={isNA ? undefined : onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.8,
        px: 1.5,
        py: 0.6,
        borderRadius: "999px",
        cursor: isNA ? "not-allowed" : "pointer",
        border: `1px solid ${isNA ? "#E5E7EB" : active ? color : "#E5E7EB"}`,
        backgroundColor: isNA ? "#F8FAFC" : active ? `${color}20` : "white",
        color: isNA ? "#94A3B8" : active ? color : "#0f172a",
        fontSize: "12px",
        fontWeight: 600,
        userSelect: "none",
        transition: "all 0.15s ease",
        opacity: isNA ? 0.7 : 1,
      }}
    >
      {/* CHECKBOX ICON */}
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `2px solid ${isNA ? "#CBD5E1" : active ? color : "#CBD5E1"}`,
          backgroundColor: isNA ? "#E2E8F0" : active ? color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {!isNA && active && "✓"}
        {isNA && "−"}
      </Box>

      {label}
      {isNA && (
        <Box
          component="span"
          sx={{
            ml: 0.5,
            px: 0.8,
            py: 0.1,
            borderRadius: "4px",
            backgroundColor: "#FEF3C7",
            color: "#92400E",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.05em",
          }}
        >
          N/A
        </Box>
      )}
    </Box>
  );
};
/* -------------------------------------------------------------------------- */
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */

const CHART_COLORS = [
  "#2563EB", // blue
  "#DC2626", // red
  "#16A34A", // green
  "#F59E0B", // amber
  "#7C3AED", // violet
  "#0891B2", // cyan
  "#EC4899", // pink
];

const TrendView = ({ mode, filters, city, platform, brandRows, skuRows, onBackToTable, onSwitchToKpi, period, timeStep, selectedLevel }) => {
  const { user } = useAuth();
  const hideMarketShare = user?.dbName === 'mars' || user?.dbName === 'mars_petcare' || user?.dbName === 'boat';
  const getInitialMetric = () => {
    if (!selectedLevel) return "osa";
    const mapping = {
      "Discounting": "promo-my",
      "Availability": "osa",
      "Offtake": "offtakes",
      "Price": "price",
      "Organic": "sos",
      "Ad": "sos",
      "Conversion": "osa", // Fallback
      "Impressions": "osa", // Fallback
    };
    return mapping[selectedLevel] || "osa";
  };

  const [activeMetric, setActiveMetric] = useState(getInitialMetric());
  const isBrandMode = mode === "brand";
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Derive all possible names from the filtered rows passed by the parent Table component
  const allPossibleIds = useMemo(() => {
    if (isBrandMode) {
      const rows = brandRows || [];
      return rows.map((r) => r.label || r.name || r.brand_name || r.brandName || r.brand);
    }
    const rows = skuRows || [];
    return rows.map((r) => r.label || r.name || r.sku_name || r.Product);
  }, [isBrandMode, brandRows, skuRows]);

  const [visibleIds, setVisibleIds] = useState([]);

  useEffect(() => {
    setVisibleIds(allPossibleIds.slice(0, 5));
  }, [allPossibleIds]);

  const metricMeta = KPI_KEYS.find((m) => m.key === activeMetric) || KPI_KEYS[0];

  const [apiTrendData, setApiTrendData] = useState(null);
  const [primaryBrand, setPrimaryBrand] = useState(null);
  const [kpiAvailability, setKpiAvailability] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(null);

  const fetchTrendData = useCallback(async () => {
    if (visibleIds.length === 0) {
      setApiTrendData({ dates: [] });
      return;
    }
    setTrendLoading(true);
    setTrendError(null);
    try {
      const params = {
        platform: platform || "All",
        location: city === "All India" ? "All" : city,
        brands: isBrandMode ? visibleIds.join(",") : "All",
        skus: isBrandMode ? "All" : visibleIds.join(","),
        category: filters.categories.length > 0 ? filters.categories.join(",") : "All",
        period: period || "1M",
        timeStep: timeStep || "Weekly",
      };

      const response = await axiosInstance.get("/watchtower/competition-brand-trends", { params });
      setApiTrendData(response.data);
      if (response.data?.kpiAvailability) {
        setKpiAvailability(response.data.kpiAvailability);
      } else {
        setKpiAvailability(null);
      }
      if (response.data?.metadata?.primaryBrand) {
        setPrimaryBrand(response.data.metadata.primaryBrand);
      }
    } catch (err) {
      console.error("Error fetching watchtower competition trends", err);
      setTrendError(err.message || "Failed to load trend data");
    } finally {
      setTrendLoading(false);
    }
  }, [visibleIds, city, platform, isBrandMode, filters.categories, period, timeStep]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  const chartData = useMemo(() => {
    if (!apiTrendData || !apiTrendData.brands) return [];

    const dataObj = {}; // { "01 Feb'26": { date: "...", "Brand A": 95 }, "02 Feb'26": { ... } }
    const allDates = new Set();

    // Always include primaryBrand if available in brand mode
    const idsToPlot = [...visibleIds];
    if (isBrandMode && primaryBrand && !idsToPlot.includes(primaryBrand)) {
      idsToPlot.unshift(primaryBrand);
    }

    idsToPlot.forEach((id) => {
      const series = apiTrendData.brands[id];
      if (series && Array.isArray(series)) {
        series.forEach(point => {
          const d = point.date;
          allDates.add(d);
          if (!dataObj[d]) dataObj[d] = { date: d };
          dataObj[d][id] = point[activeMetric] !== undefined ? point[activeMetric] : null;
        });
      }
    });

    // We want to return an array sorted correctly. Since the backend returns sorted arrays,
    // we can just extract the dates in the order they were inserted.
    return Array.from(allDates).map(d => dataObj[d]);
  }, [apiTrendData, visibleIds, activeMetric, isBrandMode, primaryBrand]);

  const formatValue = (v) => {
    if (metricMeta.unit) return `${v.toFixed(1)}${metricMeta.unit}`;
    if (metricMeta.prefix) return `${metricMeta.prefix}${v.toFixed(1)}`;
    return v.toFixed(1);
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-col gap-4 border-b pb-4">
        <div className="flex items-center justify-between w-full">
          <Box display="flex" gap={1} flexWrap="wrap">
            {(isBrandMode ? KPI_KEYS : KPI_KEYS.filter(m => m.key !== 'sos'))
              .filter(m => !hideMarketShare || m.key !== 'marketShare')
              .map((m) => {
                const sourceGroup = KPI_SOURCE_MAP[m.key];
                const isMetricNA = kpiAvailability && sourceGroup ? !kpiAvailability[sourceGroup] : false;
                return (
                  <MetricChip
                    key={m.key}
                    label={m.label}
                    color={m.color}
                    active={activeMetric === m.key && !isMetricNA}
                    isNA={isMetricNA}
                    onClick={() => {
                        if (!isMetricNA) setActiveMetric(m.key)
                    }}
                  />
                );
              })}
          </Box>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSwitchToKpi}>
              <BarChart3 className="mr-1 h-4 w-4" />
              Compare by KPIs
            </Button>
            <Button variant="ghost" size="sm" onClick={onBackToTable}>
              Back to list
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Select Brands to Plot ({city})
          </div>
          <Box display="flex" gap={1} flexWrap="wrap">
            {(() => {
              const maxInline = 5;
              const inlineIds = allPossibleIds.slice(0, maxInline);
              const overflowIds = allPossibleIds.slice(maxInline);

              return (
                <>
                  {inlineIds.map((id, idx) => {
                    const name = id;
                    const active = visibleIds.includes(id);
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <Box
                        key={id}
                        onClick={() => setVisibleIds(prev =>
                          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                        )}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 500,
                          border: "1px solid",
                          borderColor: active ? color : "#E2E8F0",
                          backgroundColor: active ? `${color}10` : "transparent",
                          color: active ? color : "#64748B",
                          transition: "all 0.2s",
                          maxWidth: "200px"
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                        {active && <span style={{ fontSize: "10px" }}>✓</span>}
                      </Box>
                    )
                  })}

                  {overflowIds.length > 0 && (
                    <>
                      <Box
                        onClick={() => setOverflowOpen(true)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          px: 2,
                          py: 0.5,
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: "1px dashed #E2E8F0",
                          backgroundColor: "#F8FAFC",
                          color: "#475569",
                        }}
                      >
                        +{overflowIds.length} more
                      </Box>

                      <Dialog open={overflowOpen} onOpenChange={(v) => !v && setOverflowOpen(false)}>
                        <DialogContent className="max-w-md p-4">
                          <DialogHeader className="mb-2">
                            <DialogTitle>Select more {isBrandMode ? 'Brands' : 'SKUs'}</DialogTitle>
                          </DialogHeader>
                          <div style={{ maxHeight: 320, overflow: 'auto' }}>
                            {overflowIds.map((id, idx) => {
                              const name = id;
                              const active = visibleIds.includes(id);
                              const color = CHART_COLORS[(idx + maxInline) % CHART_COLORS.length];
                              return (
                                <div
                                  key={id}
                                  onClick={() => {
                                    setVisibleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                                  }}
                                  className="p-2 rounded-md mb-2 cursor-pointer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E6EEF8', background: active ? `${color}10` : 'white' }}
                                >
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
                                  <div style={{ flex: 1 }}>{name}</div>
                                  {active && <div style={{ fontSize: 12 }}>✓</div>}
                                </div>
                              )
                            })}
                          </div>

                          <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setOverflowOpen(false)}>Close</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </>
              )
            })()}
          </Box>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="h-[320px] w-full">
          {trendLoading ? (
            <div className="w-full h-full bg-slate-100/50 animate-pulse rounded-lg border border-slate-100 flex items-center justify-center">
              <div className="h-full flex items-end gap-4 px-8 pb-8 w-full">
                <div className="w-1/6 bg-slate-200/50 h-[40%] rounded-t-sm" />
                <div className="w-1/6 bg-slate-200/50 h-[70%] rounded-t-sm" />
                <div className="w-1/6 bg-slate-200/50 h-[50%] rounded-t-sm" />
                <div className="w-1/6 bg-slate-200/50 h-[80%] rounded-t-sm" />
                <div className="w-1/6 bg-slate-200/50 h-[60%] rounded-t-sm" />
                <div className="w-1/6 bg-slate-200/50 h-[90%] rounded-t-sm" />
              </div>
            </div>
          ) : trendError ? (
            <ErrorRetryOverlay onRetry={fetchTrendData} message={trendError} compact />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  tick={{ fill: '#94A3B8' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={formatValue}
                  tick={{ fill: '#94A3B8' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const validParams = payload.filter(p => p.value !== null && p.value !== undefined);
                      if (!validParams.length) return null;
                      return (
                        <div className="bg-white p-3 border border-slate-100 rounded-lg shadow-lg text-sm min-w-[140px]">
                          <p className="font-semibold mb-2 text-slate-700 text-xs">{label}</p>
                          {validParams.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between gap-4 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: entry.color }}></span>
                                <span className="text-slate-600 font-medium whitespace-nowrap text-[12px]">{entry.name}</span>
                              </div>
                              <span className="font-bold text-slate-900 text-[13px]">{formatValue(entry.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ strokeWidth: 1, strokeDasharray: '4 4', stroke: '#94A3B8' }}
                />
                <Legend verticalAlign="top" height={36} content={() => (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {(() => {
                      const idsToPlot = [...visibleIds];
                      if (isBrandMode && primaryBrand && !idsToPlot.includes(primaryBrand)) {
                        idsToPlot.unshift(primaryBrand);
                      }
                      return idsToPlot.map((id, idx) => (
                        <Box key={id} display="flex" title={id} alignItems="center" gap={0.5}>
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                            }}
                          />
                          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[80px]">
                            {id === primaryBrand ? `${id} (Ours)` : id}
                          </span>
                        </Box>
                      ));
                    })()}
                  </div>
                )} />

                {visibleIds.map((id, idx) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={id}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    animationDuration={1000}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
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
    key: "offtakes",
    label: "Offtakes",
    color: "#7C3AED", // violet
    unit: "",
  },
  {
    key: "promo-my",
    label: "Promo-My %",
    color: "#06B6D4", // cyan
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

const KpiCompareView = ({ mode, filters, city, platform, brandRows, skuRows, onBackToTrend, period, timeStep }) => {
  const { user } = useAuth();
  const hideMarketShare = user?.dbName === 'mars' || user?.dbName === 'mars_petcare' || user?.dbName === 'boat';
  const isBrandMode = mode === "brand";

  const selectedIds = useMemo(() => {
    if (isBrandMode) {
      const rows = brandRows || [];
      return rows.map((r) => r.label || r.name || r.brand_name || r.brand).slice(0, 4);
    }
    const rows = skuRows || [];
    return rows.map((r) => r.label || r.name || r.sku_name || r.Product).slice(0, 4);
  }, [isBrandMode, brandRows, skuRows]);

  const selectedLabels = selectedIds; // IDs are names directly mapped from real API.

  const [apiTrendData, setApiTrendData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  const fetchCompareTrendData = useCallback(async () => {
    if (selectedIds.length === 0) {
      setApiTrendData({ brands: {} });
      return;
    }
    setLoading(true);
    setCompareError(null);
    try {
      const params = {
        platform: platform || "All",
        location: city === "All India" ? "All" : city,
        brands: isBrandMode ? selectedIds.join(",") : "All",
        skus: isBrandMode ? "All" : selectedIds.join(","),
        category: filters?.categories?.length > 0 ? filters.categories.join(",") : "All",
        period: period || "1M",
        timeStep: timeStep || "Weekly",
      };

      const response = await axiosInstance.get("/watchtower/competition-brand-trends", { params });
      setApiTrendData(response.data);
    } catch (err) {
      console.error("Error fetching kpi compare trends", err);
      setCompareError(err.message || "Failed to load comparison trends");
    } finally {
      setLoading(false);
    }
  }, [selectedIds, city, platform, isBrandMode, filters, period, timeStep]);

  useEffect(() => {
    fetchCompareTrendData();
  }, [fetchCompareTrendData]);

  const formatValue = (v, metricKey) => {
    const meta = KPI_KEYS.find(k => k.key === metricKey);
    if (!meta) return v.toFixed(1);
    if (meta.unit) return `${v.toFixed(1)}${meta.unit}`;
    if (meta.prefix) return `${meta.prefix}${v.toFixed(1)}`;
    return v.toFixed(1);
  };

  const chartDataFor = (metricKey) => {
    if (!apiTrendData || !apiTrendData.brands) return [];

    const dataObj = {};
    const allDates = new Set();

    selectedIds.forEach((id) => {
      const series = apiTrendData.brands[id];
      if (series && Array.isArray(series)) {
        series.forEach(point => {
          const d = point.date;
          allDates.add(d);
          if (!dataObj[d]) dataObj[d] = { date: d };
          dataObj[d][id] = point[metricKey] !== undefined ? point[metricKey] : null;
        });
      }
    });

    return Array.from(allDates).map(d => dataObj[d]);
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
        {(isBrandMode ? KPI_KEYS : KPI_KEYS.filter(k => k.key !== 'sos'))
          .filter(k => !hideMarketShare || k.key !== 'marketShare')
          .map((kpi) => (
          <Card
            key={kpi.key}
            className="border-slate-200 bg-slate-50/80 shadow-none hover:bg-slate-50"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent className="h-48 pt-0">
              {loading ? (
                <div className="w-full h-full bg-slate-100/50 animate-pulse rounded-md flex items-end justify-between px-4 pb-4">
                  <div className="w-[10%] bg-slate-200/60 h-[30%] rounded" />
                  <div className="w-[10%] bg-slate-200/60 h-[70%] rounded" />
                  <div className="w-[10%] bg-slate-200/60 h-[50%] rounded" />
                  <div className="w-[10%] bg-slate-200/60 h-[80%] rounded" />
                  <div className="w-[10%] bg-slate-200/60 h-[40%] rounded" />
                  <div className="w-[10%] bg-slate-200/60 h-[90%] rounded" />
                </div>
              ) : compareError ? (
                <ErrorRetryOverlay onRetry={fetchCompareTrendData} message={compareError} compact />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartDataFor(kpi.key)}
                    margin={{ top: 8, left: -16, right: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <YAxis tickLine={false} fontSize={10} width={32} />
                    <Tooltip formatter={(val) => formatValue(val, kpi.key)} />
                    {selectedIds.map((id, idx) => (
                      <Line
                        key={id}
                        type="monotone"
                        dataKey={id}
                        name={id}
                        dot={false}
                        strokeWidth={2}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
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

const formatLargeNumber = (value) => {
  if (value === undefined || value === null || isNaN(value)) return "0.00";
  const absVal = Math.abs(value);
  if (absVal >= 1000000000) return (value / 1000000000).toFixed(2) + " B";
  if (absVal >= 10000000) return (value / 10000000).toFixed(2) + " Cr";
  if (absVal >= 1000000) return (value / 1000000).toFixed(2) + " M";
  if (absVal >= 100000) return (value / 100000).toFixed(2) + " L";
  if (absVal >= 1000) return (value / 1000).toFixed(2) + " K";
  return value.toFixed(2);
};

const BrandTable = ({ rows, loading, onTrendClick }) => {
  const { user } = useAuth();
  const hideMarketShare = user?.dbName === 'mars' || user?.dbName === 'mars_petcare' || user?.dbName === 'boat';
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
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[24%]" : "w-[20%]")}>Brand</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[19%]" : "w-[16%]")}>OSA</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[19%]" : "w-[16%]")}>SOS</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[19%]" : "w-[16%]")}>Price</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[19%]" : "w-[16%]")}>Promo-My %</th>
                {!hideMarketShare && <th className="px-3 py-2 text-center w-[16%]">Mkt Share</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-brand-${idx}`} className="animate-pulse">
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
                  <td className="px-3 py-3 text-center border-r border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  {!hideMarketShare && <td className="px-3 py-3 text-center border-x border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>}
                </tr>
              ))}
              {!loading && paginatedRows.map((row, idx) => (
                <tr
                  key={row.id || `brand-${idx}`}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">
                    {row.name || row.brand_name || row.brand}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium border-r border-slate-100">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>{(Number(row.OSA?.value) || 0).toFixed(1)}%</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.OSA?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row.OSA?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.OSA?.delta) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>{(Number(row.SOS?.value) || 0).toFixed(3)}%</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.SOS?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row.SOS?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.SOS?.delta) || 0).toFixed(3)}%
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-2 text-right text-slate-900 font-medium border-x border-slate-100">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>₹{(Number(row.Price?.value) || 0).toFixed(0)}</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.Price?.delta) || 0) <= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row.Price?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.Price?.delta) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium border-r border-slate-100">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>{(Number(row['Promo-My']?.value) || Number(row.PromoMy?.value) || 0).toFixed(1)}%</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row['Promo-My']?.delta) || Number(row.PromoMy?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row['Promo-My']?.delta) || Number(row.PromoMy?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row['Promo-My']?.delta) || Number(row.PromoMy?.delta) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  {!hideMarketShare && (
                    <td className="px-3 py-2 text-right text-slate-900">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <span>{(Number(row.MarketShare?.value) || 0).toFixed(1)}%</span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.MarketShare?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                          {(Number(row.MarketShare?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.MarketShare?.delta) || 0).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={hideMarketShare ? 5 : 6}
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


const SkuTable = ({ rows, loading, onTrendClick }) => {
  const { user } = useAuth();
  const hideMarketShare = user?.dbName === 'mars' || user?.dbName === 'mars_petcare' || user?.dbName === 'boat';
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
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[20%]" : "w-[16%]")}>SKU</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[20%]" : "w-[16%]")}>Brand</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[20%]" : "w-[17%]")}>OSA</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[20%]" : "w-[17%]")}>Price</th>
                <th className={cn("px-3 py-2 text-center", hideMarketShare ? "w-[20%]" : "w-[17%]")}>Promo-My %</th>
                {!hideMarketShare && <th className="px-3 py-2 text-center w-[17%]">Mkt Share</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-sku-${idx}`} className="animate-pulse">
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                  <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                  <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  <td className="px-3 py-3 text-center border-x border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                  {!hideMarketShare && <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>}
                </tr>
              ))}
              {!loading && paginatedRows.map((row, idx) => (
                <tr
                  key={row.id || `sku-${idx}`}
                  className={cn(
                    "hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/60"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">
                    {row.name || row.sku_name || row.Product}
                  </td>
                  <td className="px-3 py-2 text-slate-900 border-r border-slate-100">
                    {row.brandName || row.brand_name || row.brand}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>{(Number(row.OSA?.value) || 0).toFixed(1)}%</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.OSA?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row.OSA?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.OSA?.delta) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-2 text-right text-slate-900 font-medium border-x border-slate-100">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>₹{(Number(row.Price?.value) || 0).toFixed(0)}</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.Price?.delta) || 0) <= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row.Price?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.Price?.delta) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium border-r border-slate-100">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <span>{(Number(row['Promo-My']?.value) || Number(row.PromoMy?.value) || 0).toFixed(1)}%</span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row['Promo-My']?.delta) || Number(row.PromoMy?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                        {(Number(row['Promo-My']?.delta) || Number(row.PromoMy?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row['Promo-My']?.delta) || Number(row.PromoMy?.delta) || 0).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  {!hideMarketShare && (
                    <td className="px-3 py-2 text-center text-slate-900 font-medium">
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center rounded-md bg-green-50 px-2 py-1 font-semibold text-green-700 text-[12px]">
                          {(Number(row.MarketShare?.value) || 0).toFixed(1)}%
                        </span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", (Number(row.MarketShare?.delta) || 0) >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-rose-700 bg-rose-50 border-rose-100")}>
                          {(Number(row.MarketShare?.delta) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(row.MarketShare?.delta) || 0).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={hideMarketShare ? 5 : 6}
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

const PlatformOverviewKpiShowcase = ({ selectedItem, selectedLevel, filterOptions, period, timeStep, onTrendClick }) => {
  // Use filterOptions if provided, otherwise fallback to static constants
  const dynamicCities = filterOptions?.cities?.length > 0 ? filterOptions.cities : CITIES;

  const [tab, setTab] = useState("brand"); // "brand" | "sku"
  const [city, setCity] = useState(dynamicCities[0] || CITIES[0]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    skus: [],
  });
  const [viewMode, setViewMode] = useState("table"); // "table" | "trend" | "kpi"
  const [apiBrandData, setApiBrandData] = useState([]);
  const [apiSkuData, setApiSkuData] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);

  // Fetch local Competition Data on filter changes
  useEffect(() => {
    const fetchCompetitionData = async () => {
      setApiLoading(true);
      try {
        const params = {
          platform: selectedItem || 'All',
          location: city !== 'All India' ? city : 'All',
          category: filters.categories.length > 0 ? filters.categories.join(',') : 'All',
          brand: filters.brands.length > 0 ? filters.brands.join(',') : 'All',
          sku: filters.skus.length > 0 ? filters.skus.join(',') : 'All',
          period: period || '1M'
        };

        const res = await axiosInstance.get('/watchtower/competition', { params });
        if (res.data) {
          setApiBrandData(res.data.brands || []);
          setApiSkuData(res.data.skus || []);
        }
      } catch (err) {
        console.error('[PlatformOverviewKpiShowcase] Failed to fetch competition data:', err);
      } finally {
        setApiLoading(false);
      }
    };
    fetchCompetitionData();
  }, [selectedItem, city, filters.categories, filters.brands, filters.skus, period]);

  // Update city if dynamicCities changes
  useEffect(() => {
    if (dynamicCities.length > 0 && !dynamicCities.includes(city)) {
      setCity(dynamicCities[0]);
    }
  }, [dynamicCities]);

  const selectionCount =
    filters.categories.length + filters.brands.length + filters.skus.length;

  const brandRows = useMemo(() => {
    return apiBrandData;
  }, [apiBrandData]);

  const skuRows = useMemo(() => {
    return apiSkuData;
  }, [apiSkuData]);

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
              {dynamicCities.map((c) => (
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
              Brand
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
          {viewMode === "table" && <BrandTable rows={brandRows} loading={apiLoading} onTrendClick={onTrendClick} />}
          {viewMode === "trend" && (
            <TrendView
              mode="brand"
              filters={filters}
              city={city}
              platform={selectedItem}
              brandRows={brandRows}
              skuRows={skuRows}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
              period={period}
              timeStep={timeStep}
              selectedLevel={selectedLevel}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="brand"
              filters={filters}
              city={city}
              platform={selectedItem}
              brandRows={brandRows}
              skuRows={skuRows}
              onBackToTrend={() => setViewMode("trend")}
              period={period}
              timeStep={timeStep}
            />
          )}
        </TabsContent>

        {/* SKU TAB */}
        <TabsContent value="sku" className="mt-3">
          {viewMode === "table" && <SkuTable rows={skuRows} loading={apiLoading} onTrendClick={onTrendClick} />}
          {viewMode === "trend" && (
            <TrendView
              mode="sku"
              filters={filters}
              city={city}
              platform={selectedItem}
              brandRows={brandRows}
              skuRows={skuRows}
              onBackToTable={() => setViewMode("table")}
              onSwitchToKpi={() => setViewMode("kpi")}
              period={period}
              timeStep={timeStep}
              selectedLevel={selectedLevel}
            />
          )}
          {viewMode === "kpi" && (
            <KpiCompareView
              mode="sku"
              filters={filters}
              city={city}
              platform={selectedItem}
              brandRows={brandRows}
              skuRows={skuRows}
              onBackToTrend={() => setViewMode("trend")}
              period={period}
              timeStep={timeStep}
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
        platform={selectedItem}
        location={city}
      />
    </div>
  );
};

export default PlatformOverviewKpiShowcase;
