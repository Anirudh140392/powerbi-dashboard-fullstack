// TrendsCompetitionDrawer.jsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
} from "@mui/material";
import { ChevronDown, X, Search, Plus } from "lucide-react";
import ReactECharts from "echarts-for-react";
import AddSkuDrawer, { SKU_DATA } from "./AddSkuDrawer";
import KpiTrendShowcase from "./KpiTrendShowcase";
import PlatformOverviewKpiShowcase from "../ControlTower/WatchTower/PlatformOverviewKpiShowcase";
import axiosInstance from "../../api/axiosInstance"; // NEW: Import axios

/**
 * ---------------------------------------------------------------------------
 * JSON DATA (mocked but realistic, drives the whole UI)
 * ---------------------------------------------------------------------------
 */

// brand colors for SKU pills
const BRAND_COLORS = {
  Colgate: "#EF4444",
  Sensodyne: "#8B5CF6",
  Dabur: "#22C55E",
  Pepsodent: "#0EA5E9",
  Closeup: "#F97316",
};

// base compare-SKU X axis + base trend (we'll offset per SKU)
const COMPARE_X = [
  "01 Sep",
  "02 Sep",
  "03 Sep",
  "04 Sep",
  "05 Sep",
  "06 Sep",
  "07 Sep",
  "08 Sep",
  "09 Sep",
  "10 Sep",
];

const BASE_COMPARE_TRENDS = {
  Osa: [100, 100, 100, 99, 99, 98, 98, 97, 97, 96],
  Doi: [80, 81, 79, 80, 79, 78, 78, 77, 76, 77],
  Fillrate: [92, 92, 91, 91, 90, 90, 89, 89, 88, 88],
  Assortment: [55, 55, 54, 54, 53, 53, 52, 52, 51, 51],
};

function makeSkuTrend(osaOffset, doiOffset, fillOffset, assOffset) {
  return {
    Osa: BASE_COMPARE_TRENDS.Osa.map((v) => v + osaOffset),
    Doi: BASE_COMPARE_TRENDS.Doi.map((v) => v + doiOffset),
    Fillrate: BASE_COMPARE_TRENDS.Fillrate.map((v) => v + fillOffset),
    Assortment: BASE_COMPARE_TRENDS.Assortment.map((v) => v + assOffset),
  };
}

// const DASHBOARD_DATA = {
//   trends: {
//     context: {
//       level: "MRP",
//       audience: "Platform",
//     },

//     rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
//     defaultRange: "1M",

//     timeSteps: ["Daily", "Weekly", "Monthly"],
//     defaultTimeStep: "Daily",

//     metrics: [
//       {
//         id: "Osa",
//         label: "Osa",
//         color: "#F97316",
//         axis: "left",
//         default: true,
//       },
//       {
//         id: "Doi",
//         label: "Doi",
//         color: "#7C3AED",
//         axis: "right",
//         default: true,
//       },
//       {
//         id: "Fillrate",
//         label: "Fillrate",
//         color: "#6366F1",
//         axis: "left",
//         default: false,
//       },
//       {
//         id: "Assortment",
//         label: "Assortment",
//         color: "#22C55E",
//         axis: "left",
//         default: false,
//       },
//     ],

//     points: [
//       { date: "06 Sep'25", Osa: 57, Doi: 41, Fillrate: 72, Assortment: 65 },
//       { date: "07 Sep'25", Osa: 54, Doi: 42, Fillrate: 70, Assortment: 66 },
//       { date: "08 Sep'25", Osa: 53, Doi: 40, Fillrate: 69, Assortment: 64 },
//       { date: "09 Sep'25", Osa: 53, Doi: 39, Fillrate: 68, Assortment: 63 },
//       { date: "10 Sep'25", Osa: 52, Doi: 37, Fillrate: 66, Assortment: 62 },
//       { date: "11 Sep'25", Osa: 52, Doi: 36, Fillrate: 67, Assortment: 62 },
//       { date: "12 Sep'25", Osa: 52, Doi: 35, Fillrate: 68, Assortment: 61 },
//       { date: "13 Sep'25", Osa: 52, Doi: 34, Fillrate: 69, Assortment: 60 },
//       { date: "14 Sep'25", Osa: 52, Doi: 33, Fillrate: 70, Assortment: 60 },
//       { date: "15 Sep'25", Osa: 52, Doi: 32, Fillrate: 70, Assortment: 59 },
//       { date: "16 Sep'25", Osa: 52, Doi: 32, Fillrate: 69, Assortment: 59 },
//       { date: "17 Sep'25", Osa: 51, Doi: 31, Fillrate: 68, Assortment: 58 },
//       { date: "18 Sep'25", Osa: 51, Doi: 31, Fillrate: 67, Assortment: 58 },
//       { date: "19 Sep'25", Osa: 51, Doi: 32, Fillrate: 66, Assortment: 57 },
//       { date: "20 Sep'25", Osa: 56, Doi: 50, Fillrate: 75, Assortment: 68 },
//       { date: "21 Sep'25", Osa: 50, Doi: 34, Fillrate: 67, Assortment: 55 },
//       { date: "22 Sep'25", Osa: 49, Doi: 33, Fillrate: 66, Assortment: 54 },
//       { date: "23 Sep'25", Osa: 48, Doi: 32, Fillrate: 65, Assortment: 54 },
//       { date: "24 Sep'25", Osa: 47, Doi: 31, Fillrate: 64, Assortment: 53 },
//       { date: "25 Sep'25", Osa: 46, Doi: 30, Fillrate: 63, Assortment: 52 },
//       { date: "26 Sep'25", Osa: 45, Doi: 30, Fillrate: 62, Assortment: 52 },
//       { date: "27 Sep'25", Osa: 44, Doi: 31, Fillrate: 63, Assortment: 51 },
//       { date: "28 Sep'25", Osa: 44, Doi: 31, Fillrate: 62, Assortment: 51 },
//       { date: "29 Sep'25", Osa: 43, Doi: 32, Fillrate: 61, Assortment: 50 },
//       { date: "30 Sep'25", Osa: 43, Doi: 34, Fillrate: 60, Assortment: 49 },
//       { date: "01 Oct'25", Osa: 44, Doi: 36, Fillrate: 61, Assortment: 50 },
//       { date: "02 Oct'25", Osa: 45, Doi: 37, Fillrate: 62, Assortment: 51 },
//       { date: "03 Oct'25", Osa: 46, Doi: 39, Fillrate: 63, Assortment: 52 },
//       { date: "04 Oct'25", Osa: 46, Doi: 40, Fillrate: 65, Assortment: 53 },
//     ],
//   },

//   // compare SKUs with per-SKU trend
//   compareSkus: {
//     context: {
//       level: "MRP",
//     },
//     rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
//     defaultRange: "1M",
//     timeSteps: ["Daily", "Weekly", "Monthly"],
//     defaultTimeStep: "Daily",

//     metrics: [
//       { id: "Osa", label: "Osa", color: "#F97316", default: true },
//       { id: "Doi", label: "Doi", color: "#7C3AED", default: true },
//       { id: "Fillrate", label: "Fillrate", color: "#6366F1", default: false },
//       {
//         id: "Assortment",
//         label: "Assortment",
//         color: "#22C55E",
//         default: false,
//       },
//     ],

//     x: COMPARE_X,

//     // keyed by SKU_DATA IDs (1..8)
//     trendsBySku: {
//       1: makeSkuTrend(0, 0, 0, 0),
//       2: makeSkuTrend(-2, -1, -1, 0),
//       3: makeSkuTrend(-3, -2, -2, -1),
//       4: makeSkuTrend(-4, -3, -3, -1),
//       5: makeSkuTrend(+2, +3, +2, +2),
//       6: makeSkuTrend(+1, +2, +1, +1),
//       7: makeSkuTrend(-1, -2, -1, -1),
//       8: makeSkuTrend(+3, +1, +2, +1),
//     },
//   },

//   competition: {
//     context: {
//       level: "MRP",
//       region: "All × Chennai",
//     },

//     tabs: ["Brands", "SKUs"],

//     periodToggle: {
//       primary: "MTD",
//       compare: "Previous Month",
//     },

//     columns: [
//       { id: "brand", label: "Brand", type: "text" },
//       { id: "Osa", label: "Osa", type: "metric" },
//       { id: "Doi", label: "Doi", type: "metric" },
//       { id: "Fillrate", label: "Fillrate", type: "metric" },
//       { id: "Assortment", label: "Assortment", type: "metric" },
//     ],

//     brands: [
//       {
//         brand: "Colgate",
//         Osa: { value: 32.9, delta: -4.5 },
//         Doi: { value: 74.6, delta: -16.3 },
//         Fillrate: { value: 20.0, delta: -8.5 },
//         Assortment: { value: 18.8, delta: 0.4 },
//       },
//       {
//         brand: "Sensodyne",
//         Osa: { value: 19.6, delta: 2.2 },
//         Doi: { value: 94.2, delta: 3.9 },
//         Fillrate: { value: 19.3, delta: 2.7 },
//         Assortment: { value: 18.5, delta: -3.1 },
//       },
//       {
//         brand: "Oral-B",
//         Osa: { value: 11.7, delta: -0.9 },
//         Doi: { value: 86.7, delta: -4.2 },
//         Fillrate: { value: 16.2, delta: -2.9 },
//         Assortment: { value: 20.8, delta: -5.6 },
//       },
//       {
//         brand: "Dabur",
//         Osa: { value: 8.6, delta: 0.2 },
//         Doi: { value: 90.6, delta: -1.2 },
//         Fillrate: { value: 7.2, delta: 0.3 },
//         Assortment: { value: 7.4, delta: 2.9 },
//       },
//     ],

//     skus: [
//       {
//         brand: "Colgate Strong Teeth 100g",
//         Osa: { value: 8.2, delta: -1.0 },
//         Doi: { value: 76.1, delta: -8.0 },
//         Fillrate: { value: 4.5, delta: -0.9 },
//         Assortment: { value: 3.2, delta: 0.2 },
//       },
//       {
//         brand: "Sensodyne Rapid Relief 40g",
//         Osa: { value: 4.4, delta: 0.7 },
//         Doi: { value: 95.0, delta: 2.0 },
//         Fillrate: { value: 5.1, delta: 1.3 },
//         Assortment: { value: 4.9, delta: -0.5 },
//       },
//     ],
//   },
// };

/**
 * ---------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------------
 */

const MONTH_MAP = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const RANGE_TO_DAYS = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

/**
 * Format numbers based on KPI type
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} kpiId - KPI identifier for type-specific formatting
 * @returns {string} Formatted number string
 */
const formatNumber = (num, decimals = 2, kpiId = '') => {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const key = kpiId.toLowerCase();

  // Percentage KPIs
  if (key.includes('conversion') || key.includes('availability') || key.includes('share') ||
    key.includes('inorganicsales') || key.includes('bmisalesratio')) {
    return num.toFixed(decimals) + '%';
  }

  // Ratio KPIs
  if (key.includes('roas')) {
    return num.toFixed(decimals) + 'x';
  }

  // Currency KPIs - Offtakes and Spend with Indian scale
  if (key.includes('offtakes') || key.includes('spend')) {
    if (absNum >= 1e9) {
      return sign + '₹' + (absNum / 1e9).toFixed(decimals) + ' B';
    } else if (absNum >= 1e7) {
      return sign + '₹' + (absNum / 1e7).toFixed(decimals) + ' Cr';
    } else if (absNum >= 1e5) {
      return sign + '₹' + (absNum / 1e5).toFixed(decimals) + ' Lac';
    } else if (absNum >= 1e3) {
      return sign + '₹' + (absNum / 1e3).toFixed(decimals) + ' K';
    } else {
      return sign + '₹' + absNum.toFixed(decimals);
    }
  }

  // Currency KPIs with small values (CPC, CPM)
  if ((key.includes('cpc') || key.includes('cpm')) && absNum < 1000) {
    return '₹' + num.toFixed(decimals);
  }

  // Default: Large numbers with Indian scale (no currency symbol)
  if (absNum >= 1e9) {
    return sign + (absNum / 1e9).toFixed(decimals) + ' B';
  } else if (absNum >= 1e7) {
    return sign + (absNum / 1e7).toFixed(decimals) + ' Cr';
  } else if (absNum >= 1e5) {
    return sign + (absNum / 1e5).toFixed(decimals) + ' Lac';
  } else if (absNum >= 1e3) {
    return sign + (absNum / 1e3).toFixed(decimals) + ' K';
  } else {
    return sign + absNum.toFixed(decimals);
  }
};

const parseTrendDate = (label) => {
  try {
    const [dayStr, monthYear] = label.split(" ");
    const day = parseInt(dayStr, 10);
    const [monthStr, yearStr] = monthYear.split("'");
    const month = MONTH_MAP[monthStr];
    const year = 2000 + parseInt(yearStr, 10);
    return new Date(year, month, day);
  } catch {
    return new Date();
  }
};

const PillToggleGroup = ({ value, onChange, options }) => (
  <ToggleButtonGroup
    exclusive
    value={value}
    onChange={(_, val) => val && onChange(val)}
    sx={{
      backgroundColor: "#F3F4F6",
      borderRadius: "999px",
      p: "2px",
      "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        px: 2.5,
        py: 0.5,
        borderRadius: "999px",
        "&.Mui-selected": {
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(15,23,42,0.15)",
        },
      },
    }}
  >
    {options.map((opt) => (
      <ToggleButton key={opt} value={opt}>
        <Typography variant="body2">{opt}</Typography>
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

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


/**
 * ---------------------------------------------------------------------------
 * MAIN COMPONENT
 * ---------------------------------------------------------------------------
 */

export default function TrendsCompetitionDrawer({
  dynamicKey,
  open = true,
  onClose = () => { },
  selectedColumn,
  kpiId = null, // NEW: KPI identifier
  filters = {}, // NEW: Filters from Watch Tower
}) {
  // NEW: State for API-fetched data
  const [apiTrendData, setApiTrendData] = useState(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const [allTrendMeta, allSetTrendMeta] = useState({
    context: {
      audience: "Platform", // default value
    },
  });

  let DASHBOARD_DATA = {};
  // UPDATED: Use API data for both performance_dashboard_tower and platform_overview_tower
  if (dynamicKey === "performance_dashboard_tower" || dynamicKey === "platform_overview_tower") {
    // Use API data if available, otherwise fall back to hardcoded data
    const trendPoints = apiTrendData?.timeSeries || [
      {
        date: "06 Sep'25",
        ShareOfSearch: 42,
        InorganicSales: 18,
        Conversion: 2.8,
        Roas: 3.4,
        BmiSalesRatio: 0.62,
      },
      {
        date: "10 Sep'25",
        ShareOfSearch: 40,
        InorganicSales: 17,
        Conversion: 2.6,
        Roas: 3.2,
        BmiSalesRatio: 0.6,
      },
      {
        date: "15 Sep'25",
        ShareOfSearch: 39,
        InorganicSales: 16,
        Conversion: 2.5,
        Roas: 3.1,
        BmiSalesRatio: 0.58,
      },
      {
        date: "20 Sep'25",
        ShareOfSearch: 45,
        InorganicSales: 22,
        Conversion: 3.1,
        Roas: 3.8,
        BmiSalesRatio: 0.67,
      },
      {
        date: "25 Sep'25",
        ShareOfSearch: 41,
        InorganicSales: 19,
        Conversion: 2.7,
        Roas: 3.3,
        BmiSalesRatio: 0.61,
      },
      {
        date: "30 Sep'25",
        ShareOfSearch: 38,
        InorganicSales: 15,
        Conversion: 2.4,
        Roas: 3.0,
        BmiSalesRatio: 0.56,
      },
      {
        date: "04 Oct'25",
        ShareOfSearch: 43,
        InorganicSales: 20,
        Conversion: 2.9,
        Roas: 3.6,
        BmiSalesRatio: 0.65,
      },
    ];

    DASHBOARD_DATA = {
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
            color: "#0066FF", // Vivid Royal Blue - high contrast
            axis: "left",
            default: false,
          },
          {
            id: "Spend",
            label: "Spend",
            color: "#9333EA", // Deep Purple - highly visible
            axis: "left", // FIXED: Use left axis like Offtakes
            default: false,
          },
          {
            id: "ShareOfSearch",
            label: "Share of Search",
            color: "#059669", // Rich Emerald - high contrast green
            axis: "right", // FIXED: Use right axis for percentage metric
            default: true,
          },
          {
            id: "InorganicSales",
            label: "Inorganic Sales",
            color: "#D97706", // Bold Amber - highly visible
            axis: "right",
            default: true,
          },
          {
            id: "Conversion",
            label: "Conversion",
            color: "#EA580C", // Bright Orange - high visibility
            axis: "left",
            default: false,
          },
          {
            id: "Roas",
            label: "ROAS",
            color: "#DC2626", // Bold Red - maximum contrast
            axis: "right",
            default: false,
          },
          {
            id: "Availability",
            label: "Availability",
            color: "#65A30D", // Vibrant Lime - stands out
            axis: "left",
            default: false,
          },
          {
            id: "MarketShare",
            label: "Market Share",
            color: "#4F46E5", // Deep Indigo - high contrast
            axis: "left",
            default: false,
          },
          {
            id: "PromoMyBrand",
            label: "Promo My Brand",
            color: "#DB2777", // Hot Pink - very visible
            axis: "left",
            default: false,
          },
          {
            id: "PromoCompete",
            label: "Promo Compete",
            color: "#0891B2", // Strong Cyan - high contrast
            axis: "left",
            default: false,
          },
          {
            id: "CPM",
            label: "CPM",
            color: "#0E7490", // Deep Teal - highly visible
            axis: "right",
            default: false,
          },
          {
            id: "CPC",
            label: "CPC",
            color: "#7C3AED", // Rich Purple - maximum visibility
            axis: "right",
            default: false,
          },
          {
            id: "BmiSalesRatio",
            label: "BMI / Sales Ratio",
            color: "#B91C1C", // Dark Red - high contrast
            axis: "right",
            default: false,
          },
        ],

        points: trendPoints, // Use API data or fallback
      },

      compareSkus: {
        context: {
          level: "MRP",
        },

        rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
        defaultRange: "1M",

        timeSteps: ["Daily", "Weekly", "Monthly"],
        defaultTimeStep: "Daily",

        metrics: [
          {
            id: "ShareOfSearch",
            label: "Share of Search",
            color: "#2563EB",
            default: true,
          },
          {
            id: "InorganicSales",
            label: "Inorganic Sales",
            color: "#16A34A",
            default: true,
          },
          {
            id: "Conversion",
            label: "Conversion",
            color: "#F97316",
            default: false,
          },
          { id: "Roas", label: "ROAS", color: "#7C3AED", default: false },
          {
            id: "BmiSalesRatio",
            label: "BMI / Sales Ratio",
            color: "#DC2626",
            default: false,
          },
        ],

        x: ["P1", "P2", "P3", "P4"],

        trendsBySku: {
          1: [
            {
              x: "P1",
              ShareOfSearch: 40,
              InorganicSales: 18,
              Conversion: 2.6,
              Roas: 3.2,
              BmiSalesRatio: 0.6,
            },
            {
              x: "P2",
              ShareOfSearch: 42,
              InorganicSales: 19,
              Conversion: 2.7,
              Roas: 3.3,
              BmiSalesRatio: 0.61,
            },
            {
              x: "P3",
              ShareOfSearch: 44,
              InorganicSales: 21,
              Conversion: 2.9,
              Roas: 3.5,
              BmiSalesRatio: 0.64,
            },
            {
              x: "P4",
              ShareOfSearch: 45,
              InorganicSales: 22,
              Conversion: 3.0,
              Roas: 3.7,
              BmiSalesRatio: 0.66,
            },
          ],
        },
      },

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
          { id: "brand", label: "Brand", type: "text" },
          { id: "ShareOfSearch", label: "Share of Search", type: "metric" },
          { id: "InorganicSales", label: "Inorganic Sales", type: "metric" },
          { id: "Conversion", label: "Conversion", type: "metric" },
          { id: "Roas", label: "ROAS", type: "metric" },
          { id: "BmiSalesRatio", label: "BMI / Sales Ratio", type: "metric" },
        ],

        brands: [
          {
            brand: "Colgate",
            ShareOfSearch: { value: 32.4, delta: -2.1 },
            InorganicSales: { value: 18.7, delta: 1.2 },
            Conversion: { value: 2.6, delta: -0.2 },
            Roas: { value: 3.1, delta: -0.3 },
            BmiSalesRatio: { value: 0.59, delta: -0.04 },
          },
          {
            brand: "Sensodyne",
            ShareOfSearch: { value: 28.9, delta: 1.6 },
            InorganicSales: { value: 21.4, delta: 2.8 },
            Conversion: { value: 3.0, delta: 0.4 },
            Roas: { value: 3.8, delta: 0.5 },
            BmiSalesRatio: { value: 0.68, delta: 0.06 },
          },
        ],
      },
    };
  } else if (dynamicKey === "availability") {
    DASHBOARD_DATA = {
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
            id: "Osa",
            label: "Osa",
            color: "#F97316",
            axis: "left",
            default: true,
          },
          {
            id: "Doi",
            label: "Doi",
            color: "#7C3AED",
            axis: "right",
            default: true,
          },
          {
            id: "Fillrate",
            label: "Fillrate",
            color: "#6366F1",
            axis: "left",
            default: false,
          },
          {
            id: "Assortment",
            label: "Assortment",
            color: "#22C55E",
            axis: "left",
            default: false,
          },
        ],

        points: [
          { date: "06 Sep'25", Osa: 57, Doi: 41, Fillrate: 72, Assortment: 65 },
          { date: "07 Sep'25", Osa: 54, Doi: 42, Fillrate: 70, Assortment: 66 },
          { date: "08 Sep'25", Osa: 53, Doi: 40, Fillrate: 69, Assortment: 64 },
          { date: "09 Sep'25", Osa: 53, Doi: 39, Fillrate: 68, Assortment: 63 },
          { date: "10 Sep'25", Osa: 52, Doi: 37, Fillrate: 66, Assortment: 62 },
          { date: "11 Sep'25", Osa: 52, Doi: 36, Fillrate: 67, Assortment: 62 },
          { date: "12 Sep'25", Osa: 52, Doi: 35, Fillrate: 68, Assortment: 61 },
          { date: "13 Sep'25", Osa: 52, Doi: 34, Fillrate: 69, Assortment: 60 },
          { date: "14 Sep'25", Osa: 52, Doi: 33, Fillrate: 70, Assortment: 60 },
          { date: "15 Sep'25", Osa: 52, Doi: 32, Fillrate: 70, Assortment: 59 },
          { date: "16 Sep'25", Osa: 52, Doi: 32, Fillrate: 69, Assortment: 59 },
          { date: "17 Sep'25", Osa: 51, Doi: 31, Fillrate: 68, Assortment: 58 },
          { date: "18 Sep'25", Osa: 51, Doi: 31, Fillrate: 67, Assortment: 58 },
          { date: "19 Sep'25", Osa: 51, Doi: 32, Fillrate: 66, Assortment: 57 },
          { date: "20 Sep'25", Osa: 56, Doi: 50, Fillrate: 75, Assortment: 68 },
          { date: "21 Sep'25", Osa: 50, Doi: 34, Fillrate: 67, Assortment: 55 },
          { date: "22 Sep'25", Osa: 49, Doi: 33, Fillrate: 66, Assortment: 54 },
          { date: "23 Sep'25", Osa: 48, Doi: 32, Fillrate: 65, Assortment: 54 },
          { date: "24 Sep'25", Osa: 47, Doi: 31, Fillrate: 64, Assortment: 53 },
          { date: "25 Sep'25", Osa: 46, Doi: 30, Fillrate: 63, Assortment: 52 },
          { date: "26 Sep'25", Osa: 45, Doi: 30, Fillrate: 62, Assortment: 52 },
          { date: "27 Sep'25", Osa: 44, Doi: 31, Fillrate: 63, Assortment: 51 },
          { date: "28 Sep'25", Osa: 44, Doi: 31, Fillrate: 62, Assortment: 51 },
          { date: "29 Sep'25", Osa: 43, Doi: 32, Fillrate: 61, Assortment: 50 },
          { date: "30 Sep'25", Osa: 43, Doi: 34, Fillrate: 60, Assortment: 49 },
          { date: "01 Oct'25", Osa: 44, Doi: 36, Fillrate: 61, Assortment: 50 },
          { date: "02 Oct'25", Osa: 45, Doi: 37, Fillrate: 62, Assortment: 51 },
          { date: "03 Oct'25", Osa: 46, Doi: 39, Fillrate: 63, Assortment: 52 },
          { date: "04 Oct'25", Osa: 46, Doi: 40, Fillrate: 65, Assortment: 53 },
        ],
      },

      // compare SKUs with per-SKU trend
      compareSkus: {
        context: {
          level: "MRP",
        },
        rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
        defaultRange: "1M",
        timeSteps: ["Daily", "Weekly", "Monthly"],
        defaultTimeStep: "Daily",

        metrics: [
          { id: "Osa", label: "Osa", color: "#F97316", default: true },
          { id: "Doi", label: "Doi", color: "#7C3AED", default: true },
          {
            id: "Fillrate",
            label: "Fillrate",
            color: "#6366F1",
            default: false,
          },
          {
            id: "Assortment",
            label: "Assortment",
            color: "#22C55E",
            default: false,
          },
        ],

        x: COMPARE_X,

        // keyed by SKU_DATA IDs (1..8)
        trendsBySku: {
          1: makeSkuTrend(0, 0, 0, 0),
          2: makeSkuTrend(-2, -1, -1, 0),
          3: makeSkuTrend(-3, -2, -2, -1),
          4: makeSkuTrend(-4, -3, -3, -1),
          5: makeSkuTrend(+2, +3, +2, +2),
          6: makeSkuTrend(+1, +2, +1, +1),
          7: makeSkuTrend(-1, -2, -1, -1),
          8: makeSkuTrend(+3, +1, +2, +1),
        },
      },

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
          { id: "brand", label: "Brand", type: "text" },
          { id: "Osa", label: "Osa", type: "metric" },
          { id: "Doi", label: "Doi", type: "metric" },
          { id: "Fillrate", label: "Fillrate", type: "metric" },
          { id: "Assortment", label: "Assortment", type: "metric" },
        ],

        brands: [
          {
            brand: "Colgate",
            Osa: { value: 32.9, delta: -4.5 },
            Doi: { value: 74.6, delta: -16.3 },
            Fillrate: { value: 20.0, delta: -8.5 },
            Assortment: { value: 18.8, delta: 0.4 },
          },
          {
            brand: "Sensodyne",
            Osa: { value: 19.6, delta: 2.2 },
            Doi: { value: 94.2, delta: 3.9 },
            Fillrate: { value: 19.3, delta: 2.7 },
            Assortment: { value: 18.5, delta: -3.1 },
          },
          {
            brand: "Oral-B",
            Osa: { value: 11.7, delta: -0.9 },
            Doi: { value: 86.7, delta: -4.2 },
            Fillrate: { value: 16.2, delta: -2.9 },
            Assortment: { value: 20.8, delta: -5.6 },
          },
          {
            brand: "Dabur",
            Osa: { value: 8.6, delta: 0.2 },
            Doi: { value: 90.6, delta: -1.2 },
            Fillrate: { value: 7.2, delta: 0.3 },
            Assortment: { value: 7.4, delta: 2.9 },
          },
        ],

        skus: [
          {
            brand: "Colgate Strong Teeth 100g",
            Osa: { value: 8.2, delta: -1.0 },
            Doi: { value: 76.1, delta: -8.0 },
            Fillrate: { value: 4.5, delta: -0.9 },
            Assortment: { value: 3.2, delta: 0.2 },
          },
          {
            brand: "Sensodyne Rapid Relief 40g",
            Osa: { value: 4.4, delta: 0.7 },
            Doi: { value: 95.0, delta: 2.0 },
            Fillrate: { value: 5.1, delta: 1.3 },
            Assortment: { value: 4.9, delta: -0.5 },
          },
        ],
      },
    };
  } else {
    DASHBOARD_DATA = {
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
  }

  useLayoutEffect(() => {
    allSetTrendMeta((prev) => ({
      ...prev,
      context: { ...prev.context, audience: "Platform" },
    }));
    setShowPlatformPills(true);
  }, []);
  const [view, setView] = useState("Trends");
  // Initialize with simple defaults instead of DASHBOARD_DATA to avoid stale state issues
  const [range, setRange] = useState("1M");
  const [timeStep, setTimeStep] = useState("Daily");
  const [activeMetrics, setActiveMetrics] = useState(
    ["ShareOfSearch", "InorganicSales"] // Default enabled metrics for KPI trends
  );
  const [compTab, setCompTab] = useState("Brands");
  const [search, setSearch] = useState("");
  const [periodMode, setPeriodMode] = useState("primary");

  // shared Add SKU drawer + selected SKUs (used by Compare SKUs + Competition)
  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [tab, setTab] = useState("Trends");
  const [selectedPeriod, setSelectedPeriod] = useState("Last 7 Days");
  const [selectedPlatform, setSelectedPlatform] = useState("All");
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedSku, setSelectedSku] = useState("All");
  const [showPlatformPills, setShowPlatformPills] = useState(false);

  // NEW: Dynamic filter options
  const [categoryOptions, setCategoryOptions] = useState(["All"]);
  const [brandOptions, setBrandOptions] = useState(["All"]);
  const [cityOptions, setCityOptions] = useState(["All"]);

  // NEW: Competition data state
  const [competitionData, setCompetitionData] = useState(null);
  const [isLoadingCompetition, setIsLoadingCompetition] = useState(false);

  // NEW: Competition filter options state
  const [competitionFilterOptions, setCompetitionFilterOptions] = useState({
    locations: ['All India'],
    categories: ['All'],
    brands: ['All'],
    skus: ['All']
  });

  // NEW: Fetch competition data when Competition tab is active
  useEffect(() => {
    console.log('[Competition] useEffect triggered:', {
      open,
      view,
      dynamicKey,
      selectedPlatform,
      selectedCity,
      selectedCategory,
      selectedBrand,
      selectedSku,
      range
    });

    // Only fetch when drawer is open, view is "Competition", and we have a valid dynamicKey
    if (!open) {
      console.log('[Competition] Skipping - drawer not open');
      return;
    }

    if (view !== "Competition") {
      console.log('[Competition] Skipping - view is not Competition, it is:', view);
      return;
    }

    if (dynamicKey !== "performance_dashboard_tower" && dynamicKey !== "platform_overview_tower") {
      console.log('[Competition] Skipping - invalid dynamicKey:', dynamicKey);
      return;
    }

    const fetchCompetition = async () => {
      setIsLoadingCompetition(true);
      try {
        console.log('[Competition] Fetching with filters:', {
          platform: selectedPlatform,
          location: selectedCity,
          category: selectedCategory,
          brand: selectedBrand,
          sku: selectedSku,
          period: range
        });

        console.log('[Competition] 🔍 About to fetch with current state:', {
          selectedPlatform,
          selectedCity,
          selectedCategory,
          selectedBrand,
          selectedSku,
          range
        });

        const response = await axiosInstance.get('/watchtower/competition', {
          params: {
            platform: selectedPlatform || 'All',
            location: selectedCity || 'All',
            category: selectedCategory || 'All',
            brand: selectedBrand || 'All',
            sku: selectedSku || 'All',
            period: range || '1M'
          }
        });

        console.log('[Competition] Received data:', response.data);
        // FIXED: Store entire response (has both brands and skus)
        setCompetitionData(response.data);
      } catch (error) {
        console.error('[Competition] Error fetching data:', error);
        setCompetitionData(null);
      } finally {
        setIsLoadingCompetition(false);
      }
    };

    fetchCompetition();
  }, [open, view, selectedPlatform, selectedCity, selectedCategory, selectedBrand, selectedSku, range, dynamicKey]);


  const platformRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      // do nothing
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // NEW: Fetch categories when audience is Format
  useEffect(() => {
    if (allTrendMeta.context.audience === "Format" && open) {
      axiosInstance
        .get("/watchtower/trends-filter-options", {
          params: { filterType: "categories", platform: selectedPlatform },
        })
        .then((res) => setCategoryOptions(res.data.options || ["All"]))
        .catch(() => setCategoryOptions(["All"]));
    }
  }, [allTrendMeta.context.audience, selectedPlatform, open]);

  // NEW: Fetch brands when audience is Brand
  useEffect(() => {
    if (allTrendMeta.context.audience === "Brand" && open) {
      axiosInstance
        .get("/watchtower/trends-filter-options", {
          params: { filterType: "brands", platform: selectedPlatform },
        })
        .then((res) => setBrandOptions(res.data.options || ["All"]))
        .catch(() => setBrandOptions(["All"]));
    }
  }, [allTrendMeta.context.audience, selectedPlatform, open]);

  // NEW: Fetch cities when audience is City
  useEffect(() => {
    if (allTrendMeta.context.audience === "City" && open) {
      axiosInstance
        .get("/watchtower/trends-filter-options", {
          params: {
            filterType: "cities",
            platform: selectedPlatform,
            brand: selectedBrand,
          },
        })
        .then((res) => setCityOptions(res.data.options || ["All"]))
        .catch(() => setCityOptions(["All"]));
    }
  }, [allTrendMeta.context.audience, selectedPlatform, selectedBrand, open]);

  // NEW: Fetch competition filter options on mount
  useEffect(() => {
    const fetchCompetitionFilterOptions = async () => {
      try {
        console.log('[Competition Filters] Fetching filter options');
        const response = await axiosInstance.get('/watchtower/competition-filter-options', {
          params: {
            location: selectedCity === 'All India' ? null : selectedCity,
            category: selectedCategory === 'All' ? null : selectedCategory,
            brand: selectedBrand === 'All' ? null : selectedBrand
          }
        });
        console.log('[Competition Filters] Received options:', response.data);
        setCompetitionFilterOptions(response.data);
      } catch (error) {
        console.error('[Competition Filters] Error fetching filter options:', error);
        // Keep default values on error
      }
    };

    if (open) {
      fetchCompetitionFilterOptions();
    }
  }, [open, view, selectedCity, selectedCategory, selectedBrand]);


  const [selectedCompareSkus, setSelectedCompareSkus] = useState([]);
  const [compareInitialized, setCompareInitialized] = useState(false);

  // NEW: Fetch KPI trends from backend API
  useEffect(() => {
    console.log("[TrendsDrawer] useEffect triggered with:", { open, dynamicKey, kpiId, filters, selectedPlatform, selectedCity, selectedCategory, selectedBrand, range, timeStep });

    if (!open) {
      console.log("[TrendsDrawer] Drawer is not open, skipping fetch");
      return;
    }

    // UPDATED: Accept both platform_overview_tower and performance_dashboard_tower
    if (dynamicKey !== "performance_dashboard_tower" && dynamicKey !== "platform_overview_tower") {
      console.log("[TrendsDrawer] dynamicKey mismatch:", dynamicKey, "- not a valid key for KPI trends");
      return;
    }

    // For platform_overview_tower, we don't require kpiId since we're showing all KPIs
    if (dynamicKey === "performance_dashboard_tower" && !kpiId) {
      console.log("[TrendsDrawer] No kpiId provided for performance dashboard, skipping fetch");
      return;
    }

    const fetchKpiTrends = async () => {
      setIsLoadingApi(true);
      try {
        const params = {
          // UPDATED: Always include all 4 filter keys
          brand: selectedBrand !== "All" ? selectedBrand : (filters?.brand || "All"),
          location: selectedCity !== "All" ? selectedCity : (filters?.location || "All"),
          platform: selectedPlatform !== "All" ? selectedPlatform : "All",
          category: selectedCategory !== "All" ? selectedCategory : "All",
          period: range || "1M", // Use actual range state
          timeStep: timeStep || "Daily", // Use actual timeStep state
          ...(filters?.startDate && { startDate: filters.startDate }),
          ...(filters?.endDate && { endDate: filters.endDate }),
        };

        console.log("[TrendsDrawer] Fetching KPI trends with params:", params);
        const response = await axiosInstance.get("/watchtower/kpi-trends", { params });

        if (response.data) {
          console.log("[TrendsDrawer] Received API data:", response.data);
          setApiTrendData(response.data);
        }
      } catch (error) {
        console.error("[TrendsDrawer] Error fetching KPI trends:", error);
      } finally {
        setIsLoadingApi(false);
      }
    };

    fetchKpiTrends();
  }, [open, dynamicKey, kpiId, selectedPlatform, selectedCity, selectedCategory, selectedBrand, range, timeStep]); // FIXED: Removed filters object to prevent infinite loop

  // Make these reactive to apiTrendData changes
  const trendMeta = useMemo(() => DASHBOARD_DATA.trends, [DASHBOARD_DATA, apiTrendData]);
  const compMeta = useMemo(() => ({
    ...DASHBOARD_DATA.competition,
    // UPDATED: Use dynamic context based on current filters
    context: {
      level: "MRP",
      region: selectedCity && selectedCity !== 'All' ? selectedCity : 'All India',
      category: selectedCategory && selectedCategory !== 'All' ? selectedCategory : 'All Categories',
      platform: selectedPlatform && selectedPlatform !== 'All' ? selectedPlatform : 'All Platforms'
    },
    // UPDATED: Use API data if available, otherwise fall back to hardcoded data
    brands: competitionData || DASHBOARD_DATA.competition.brands
  }), [DASHBOARD_DATA, apiTrendData, competitionData, selectedCity, selectedCategory, selectedPlatform]);
  const compareMeta = useMemo(() => DASHBOARD_DATA.compareSkus, [DASHBOARD_DATA, apiTrendData]);

  // ⭐ Auto-select first SKU + only Osa when opening Compare SKUs first time
  useEffect(() => {
    if (view === "compare skus" && !compareInitialized) {
      const firstSku = SKU_DATA && SKU_DATA.length > 0 ? SKU_DATA[0] : null;
      if (firstSku) {
        setSelectedCompareSkus([firstSku]);
      }
      setActiveMetrics(["Osa"]);
      setCompareInitialized(true);
    }
  }, [view, compareInitialized]);

  const trendPoints = useMemo(() => {
    const enriched = trendMeta.points.map((p) => ({
      ...p,
      _dateObj: parseTrendDate(p.date),
    }));
    const sorted = [...enriched].sort(
      (a, b) => a._dateObj.getTime() - b._dateObj.getTime()
    );

    if (range === "Custom" || !RANGE_TO_DAYS[range]) {
      return sorted.map(({ _dateObj, ...rest }) => rest);
    }

    const maxDate = sorted[sorted.length - 1]?._dateObj;
    if (!maxDate) return sorted.map(({ _dateObj, ...rest }) => rest);

    const days = RANGE_TO_DAYS[range];
    const filtered = sorted.filter((p) => {
      const diffMs = maxDate.getTime() - p._dateObj.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= days;
    });

    return filtered.map(({ _dateObj, ...rest }) => rest);
  }, [trendMeta, range, apiTrendData]); // Added apiTrendData

  const trendOption = useMemo(() => {
    const xData = trendPoints.map((p) => p.date);

    const series = trendMeta.metrics
      .filter((m) => activeMetrics.includes(m.id))
      .map((m) => ({
        name: m.label,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: true,
        yAxisIndex: m.axis === "right" ? 1 : 0,
        lineStyle: { width: 2 },
        emphasis: { focus: "series" },
        data: trendPoints.map((p) => p[m.id] ?? null),
        itemStyle: { color: m.color },
      }));

    return {
      grid: { left: 60, right: 80, top: 32, bottom: 32 },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          if (!params || params.length === 0) return '';

          // Get the date/period from the first series
          const period = params[0].axisValue;

          // Build tooltip content
          let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${period}</div>`;

          params.forEach(param => {
            const value = parseFloat(param.value);
            const formattedValue = isNaN(value) ? '0' : formatNumber(value, 2);

            tooltip += `
              <div style="display: flex; align-items: center; margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color}; margin-right: 8px;"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <span style="font-weight: 600; margin-left: 12px;">${formattedValue}</span>
              </div>
            `;
          });

          return tooltip;
        }
      },
      xAxis: {
        type: "category",
        data: xData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#E5E7EB" } },
        axisLabel: { fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#F3F4F6" } },
          axisLabel: {
            formatter: (value) => {
              // Determine KPI type from active metrics
              const activeMetricIds = trendMeta.metrics
                .filter(m => activeMetrics.includes(m.id))
                .map(m => m.id);

              // Get the first active metric to determine formatting
              const firstMetricId = activeMetricIds[0] || '';

              // Use formatNumber with KPI type for Y-axis
              return formatNumber(value, 1, firstMetricId);
            }
          }
        },
        {
          type: "value",
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          min: 0,
          max: 100,
          axisLabel: {
            formatter: (value) => value + '%'
          }
        },
      ],
      legend: { show: false },
      series,
    };
  }, [trendMeta, activeMetrics, trendPoints]);

  // Filtered brand rows based on current selections
  const brandRows = useMemo(() => {
    // FIXED: Access brands array from response object
    const baseRows = competitionData?.brands || [];

    if (!selectedCategory || selectedCategory === 'All') {
      return baseRows;
    }

    return baseRows.filter(row =>
      row.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [competitionData, selectedCategory]);

  const competitionRows = useMemo(() => {
    // FIXED: Access brands or skus array from response object
    const baseRows =
      compTab === "Brands"
        ? (competitionData?.brands || compMeta.brands || [])
        : (competitionData?.skus || compMeta.skus || compMeta.brands || []);

    return baseRows.filter((r) =>
      search.trim()
        ? (r.brand || r.brand_name || '').toLowerCase().includes(search.toLowerCase())
        : true
    );
  }, [competitionData, compMeta, compTab, search]);

  // Compare SKUs chart option (multi-KPI, multi-SKU)
  const compareOption = useMemo(() => {
    const x = compareMeta.x;
    const series = [];

    selectedCompareSkus.forEach((sku) => {
      const trend = compareMeta.trendsBySku[sku.id];
      if (!trend) return;

      compareMeta.metrics
        .filter((m) => activeMetrics.includes(m.id))
        .forEach((m) => {
          series.push({
            name: `${sku.name} · ${m.label}`,
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { width: 1 },
            itemStyle: { color: m.color },
            data: trend[m.id] || [],
          });
        });
    });

    return {
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          if (!params || params.length === 0) return '';

          const period = params[0].axisValue;
          let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${period}</div>`;

          params.forEach(param => {
            const value = parseFloat(param.value);
            // Extract metric ID from series name
            const metric = trendMeta.metrics.find(m => m.label === param.seriesName);
            const metricId = metric ? metric.id : '';
            const formattedValue = isNaN(value) ? '0' : formatNumber(value, 2, metricId);

            tooltip += `
              <div style="display: flex; align-items: center; margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color}; margin-right: 8px;"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <span style="font-weight: 600; margin-left: 12px;">${formattedValue}</span>
              </div>
            `;
          });

          return tooltip;
        }
      },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: { type: "category", data: x },
      yAxis: {
        type: "value",
        min: 0,
        max: 120,
        axisLabel: {
          formatter: (value) => {
            // Determine KPI type from active metrics in compare view
            const activeMetricIds = compareMeta.metrics
              .filter(m => activeMetrics.includes(m.id))
              .map(m => m.id);

            const firstMetricId = activeMetricIds[0] || '';
            return formatNumber(value, 1, firstMetricId);
          }
        }
      },
      series,
    };
  }, [compareMeta, activeMetrics, selectedCompareSkus]);

  // keep selection fully in sync with drawer & deletion
  const handleSkuApply = (ids, skus) => {
    const mapById = Object.fromEntries(SKU_DATA.map((s) => [s.id, s]));
    const finalList = ids.map((id) => mapById[id]).filter(Boolean);
    setSelectedCompareSkus(finalList);
    setAddSkuOpen(false);
  };

  const PLATFORM_OPTIONS = [
    "Blinkit",
    "Zepto",
    "Instamart",
    "Swiggy",
    "Amazon",
  ];
  const FORMAT_OPTIONS = ["Cassata", "Core Tubs", "Premium"];
  const CITY_OPTIONS = ["Delhi", "Mumbai", "Bangalore", "Chennai"];
  const BRAND_OPTIONS = ["Amul", "Mother Dairy", "Nestle", "Hatsun"];

  // NEW: Handle filter changes from child components
  const handleFilterChange = (filters) => {
    console.log('[TrendsCompetitionDrawer] Filter changed from child:', filters);

    if (filters.category && filters.category !== selectedCategory) {
      setSelectedCategory(filters.category);
    }
    if (filters.brand && filters.brand !== selectedBrand) {
      setSelectedBrand(filters.brand);
    }
    if (filters.sku && filters.sku !== selectedSku) {
      setSelectedSku(filters.sku);
    }
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(15,23,42,0.32)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: 2,
        zIndex: 1300,
        overflow: "auto",
      }}
    >
      <Box
        sx={{
          mt: 4,
          width: "min(1200px, 100%)",
          bgcolor: "white",
          borderRadius: 3,
          boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* Header row */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <ToggleButtonGroup
            exclusive
            value={view}
            onChange={(_, v) => v && setView(v)}
            sx={{
              backgroundColor: "#F3F4F6",
              borderRadius: "999px",
              p: "3px",
              "& .MuiToggleButton-root": {
                textTransform: "none",
                border: "none",
                borderRadius: "999px",
                px: 2.5,
                py: 0.75,
                fontSize: 14,
                "&.Mui-selected": {
                  backgroundColor: "#0F172A",
                  color: "#fff",
                },
              },
            }}
          >
            <ToggleButton value="Trends">Trends</ToggleButton>
            {dynamicKey !== "Performance_marketing" &&
              dynamicKey !== "performance_dashboard_tower" && (
                <ToggleButton value="Competition">Competition</ToggleButton>
              )}
            {/* <ToggleButton value="compare skus">Compare SKUs</ToggleButton> */}
          </ToggleButtonGroup>

          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </Box>

        {/* TRENDS VIEW */}
        {view === "Trends" && (
          <Box display="flex" flexDirection="column" gap={2}>
            {/* HEADER + PLATFORM FILTER */}
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              {/* Title - Show selected platform dynamically */}
              <Typography variant="h6" fontWeight={600}>
                {selectedPlatform || "KPI Trends"}
              </Typography>

              {/* PLATFORM FILTER WRAPPER */}
              {/* PLATFORM FILTER WRAPPER */}
              <Box display="flex" alignItems="center" gap={1}>
                {/* SELECT without Typography wrapper to avoid DOM nesting warnings */}
                <Select
                  size="small"
                  value={allTrendMeta.context.audience}
                  onChange={(e) => {
                    allSetTrendMeta((prev) => ({
                      ...prev,
                      context: { ...prev.context, audience: e.target.value },
                    }));
                    setShowPlatformPills(true); // always show pills after changing mode
                  }}
                  sx={{ fontSize: '0.875rem' }} // body2 font size
                >
                  <MenuItem value="Platform">Platform</MenuItem>
                  <MenuItem value="Format">Format</MenuItem>
                  <MenuItem value="Brand">Brand</MenuItem>
                  <MenuItem value="City">City</MenuItem>
                </Select>

                {/* DYNAMIC PILLS */}
                {/* DYNAMIC PILLS */}
                {showPlatformPills && (
                  <Box
                    display="flex"
                    gap={0.5}
                    sx={{
                      flexWrap: "wrap", // ADDED: Allow pills to wrap
                      maxHeight: "120px", // ADDED: Limit height
                      overflowY: "auto", // ADDED: Add vertical scrolling
                      overflowX: "hidden", // ADDED: Hide horizontal overflow
                      pr: 1, // ADDED: Padding for scrollbar
                      "&::-webkit-scrollbar": { width: 6 },
                      "&::-webkit-scrollbar-thumb": {
                        background: "#cbd5e1",
                        borderRadius: 10,
                      },
                    }}
                  >
                    {(allTrendMeta.context.audience === "Platform"
                      ? PLATFORM_OPTIONS
                      : allTrendMeta.context.audience === "Format"
                        ? categoryOptions
                        : allTrendMeta.context.audience === "Brand"
                          ? brandOptions
                          : allTrendMeta.context.audience === "City"
                            ? cityOptions
                            : []
                    ).map((p) => (
                      <Box
                        key={p}
                        onClick={() => {
                          // UPDATED: Set the correct filter based on audience type
                          if (allTrendMeta.context.audience === "Platform") {
                            setSelectedPlatform(p);
                          } else if (allTrendMeta.context.audience === "Format") {
                            setSelectedCategory(p);
                          } else if (allTrendMeta.context.audience === "Brand") {
                            setSelectedBrand(p);
                          } else if (allTrendMeta.context.audience === "City") {
                            setSelectedCity(p);
                          }
                        }}
                        sx={{
                          px: 1.5,
                          py: 0.7,
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: "1px solid #E5E7EB",
                          backgroundColor:
                            // UPDATED: Check active state based on audience
                            (allTrendMeta.context.audience === "Platform" && selectedPlatform === p) ||
                              (allTrendMeta.context.audience === "Format" && selectedCategory === p) ||
                              (allTrendMeta.context.audience === "Brand" && selectedBrand === p) ||
                              (allTrendMeta.context.audience === "City" && selectedCity === p)
                              ? "#0ea5e9"
                              : "white",
                          color:
                            (allTrendMeta.context.audience === "Platform" && selectedPlatform === p) ||
                              (allTrendMeta.context.audience === "Format" && selectedCategory === p) ||
                              (allTrendMeta.context.audience === "Brand" && selectedBrand === p) ||
                              (allTrendMeta.context.audience === "City" && selectedCity === p)
                              ? "white"
                              : "#0f172a",
                          flexShrink: 0, // ADDED: Prevent pills from shrinking
                        }}
                      >
                        {p}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* LEVEL CHIP */}
              <Chip
                size="small"
                label={trendMeta.context.level}
                sx={{
                  borderRadius: "999px",
                  backgroundColor: "#DCFCE7",
                  color: "#166534",
                  fontWeight: 500,
                }}
              />

              {/* AUDIENCE CHIP */}
            </Box>

            {/* RANGE + TIMESTEP */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap={2}
              flexWrap="wrap"
            >
              <PillToggleGroup
                value={range}
                onChange={setRange}
                options={trendMeta.rangeOptions}
              />

              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2">Time Step:</Typography>
                <PillToggleGroup
                  value={timeStep}
                  onChange={setTimeStep}
                  options={trendMeta.timeSteps}
                />
              </Box>
            </Box>

            {/* CHART */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid #E5E7EB",
                mt: 1,
                p: 2.5,
              }}
            >
              {/* Metric Row */}
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                flexWrap="wrap"
                mb={2}
              >
                <Box display="flex" gap={1} flexWrap="wrap">
                  {trendMeta.metrics.map((m) => (
                    <MetricChip
                      key={m.id}
                      label={m.label}
                      color={m.color}
                      active={activeMetrics.includes(m.id)}
                      onClick={() =>
                        setActiveMetrics((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((x) => x !== m.id)
                            : [...prev, m.id]
                        )
                      }
                    />
                  ))}
                </Box>

                <Button
                  size="small"
                  endIcon={<ChevronDown size={14} />}
                  sx={{
                    textTransform: "none",
                    borderRadius: "999px",
                    borderColor: "#E5E7EB",
                  }}
                  variant="outlined"
                >
                  +{Math.max(trendMeta.metrics.length - 4, 0)} more
                </Button>
              </Box>

              {/* Chart */}
              <Box sx={{ height: 340 }}>
                <ReactECharts
                  style={{ height: "100%", width: "100%" }}
                  option={trendOption}
                  notMerge
                />
              </Box>
            </Paper>
          </Box>
        )}

        {/* COMPETITION VIEW */}
        {view === "Competition" && (
          <Box display="flex" flexDirection="column" gap={2}>
            {/* FILTER PILLS */}
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              {/* DYNAMIC PILLS FOR FILTER OPTIONS */}
              {showPlatformPills && (
                <Box
                  display="flex"
                  gap={0.5}
                  sx={{
                    flexWrap: "wrap",
                    maxHeight: "120px",
                    overflowY: "auto",
                    overflowX: "hidden",
                    pr: 1,
                    "&::-webkit-scrollbar": { width: 6 },
                    "&::-webkit-scrollbar-thumb": {
                      background: "#cbd5e1",
                      borderRadius: 10,
                    },
                  }}
                >
                  {(allTrendMeta.context.audience === "Format"
                    ? competitionFilterOptions.categories
                    : allTrendMeta.context.audience === "Brand"
                      ? brandOptions
                      : allTrendMeta.context.audience === "City"
                        ? competitionFilterOptions.locations
                        : []
                  ).map((option) => (
                    <Box
                      key={option}
                      onClick={() => {
                        if (allTrendMeta.context.audience === "Format") {
                          setSelectedCategory(option);
                        } else if (allTrendMeta.context.audience === "Brand") {
                          setSelectedBrand(option);
                        } else if (allTrendMeta.context.audience === "City") {
                          setSelectedCity(option);
                        }
                      }}
                      sx={{
                        px: 1.5,
                        py: 0.7,
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid #E5E7EB",
                        backgroundColor:
                          (allTrendMeta.context.audience === "Format" && selectedCategory === option) ||
                            (allTrendMeta.context.audience === "Brand" && selectedBrand === option) ||
                            (allTrendMeta.context.audience === "City" && selectedCity === option)
                            ? "#0ea5e9"
                            : "white",
                        color:
                          (allTrendMeta.context.audience === "Format" && selectedCategory === option) ||
                            (allTrendMeta.context.audience === "Brand" && selectedBrand === option) ||
                            (allTrendMeta.context.audience === "City" && selectedCity === option)
                            ? "white"
                            : "#0f172a",
                        flexShrink: 0,
                      }}
                    >
                      {option}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Competition Data Display */}
            {dynamicKey === "platform_overview_tower" ? (
              <PlatformOverviewKpiShowcase
                dynamicKey={dynamicKey}
                filterOptions={competitionFilterOptions}
                brandOptions={competitionFilterOptions.brands || []}
                skuOptions={competitionFilterOptions.skus || []}
                competitionData={competitionData}
                isLoading={isLoadingCompetition}
                selectedCity={selectedCity}
                selectedCategory={selectedCategory}
                selectedBrand={selectedBrand}
                selectedSku={selectedSku}
                onFilterChange={(filters) => {
                  if (filters.city) setSelectedCity(filters.city);
                  if (filters.category) setSelectedCategory(filters.category);
                  if (filters.brand) setSelectedBrand(filters.brand);
                  if (filters.sku) setSelectedSku(filters.sku);
                }}
              />
            ) : (
              <KpiTrendShowcase
                dynamicKey={dynamicKey}
                filterOptions={competitionFilterOptions}
                brandOptions={competitionFilterOptions.brands || []}
                skuOptions={competitionFilterOptions.skus || []}
                competitionData={competitionData}
                isLoading={isLoadingCompetition}
                selectedCity={selectedCity}
                selectedCategory={selectedCategory}
                selectedBrand={selectedBrand}
                selectedSku={selectedSku}
                onFilterChange={(filters) => {
                  if (filters.city) setSelectedCity(filters.city);
                  if (filters.category) setSelectedCategory(filters.category);
                  if (filters.brand) setSelectedBrand(filters.brand);
                  if (filters.sku) setSelectedSku(filters.sku);
                }}
              />
            )}
          </Box>
        )}

        {/* COMPARE SKUs VIEW */}
        {view === "compare skus" && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="h6" fontWeight={600}>
                Compare SKUs
              </Typography>
              <Chip
                size="small"
                label={compareMeta.context.level}
                sx={{
                  borderRadius: "999px",
                  backgroundColor: "#DCFCE7",
                  color: "#166534",
                  fontWeight: 500,
                }}
              />
            </Box>

            {/* Range + Timestep */}
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <PillToggleGroup
                value={range}
                onChange={setRange}
                options={compareMeta.rangeOptions}
              />
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">Time Step:</Typography>
                <PillToggleGroup
                  value={timeStep}
                  onChange={setTimeStep}
                  options={compareMeta.timeSteps}
                />
              </Box>
            </Box>

            {/* SKU pills + Add SKUs button row */}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap={2}
              flexWrap="wrap"
            >
              <Box display="flex" gap={1} flexWrap="wrap" flex={1}>
                {selectedCompareSkus.map((sku) => {
                  const color =
                    BRAND_COLORS[sku.brand] || "rgba(37,99,235,0.3)";
                  return (
                    <Chip
                      key={sku.id}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "999px",
                              backgroundColor: color,
                            }}
                          />
                          <Typography variant="body2" noWrap>
                            {sku.name}
                          </Typography>
                        </Box>
                      }
                      onDelete={() =>
                        setSelectedCompareSkus((prev) =>
                          prev.filter((s) => s.id !== sku.id)
                        )
                      }
                      sx={{
                        borderRadius: "999px",
                        backgroundColor: "#F9FAFB",
                        borderColor: "transparent",
                        maxWidth: 260,
                      }}
                    />
                  );
                })}
              </Box>

              <Button
                variant="contained"
                startIcon={<Plus size={14} />}
                sx={{
                  backgroundColor: "#2563EB",
                  textTransform: "none",
                  borderRadius: "999px",
                  minWidth: 140,
                }}
                onClick={() => setAddSkuOpen(true)}
              >
                Add SKUs
              </Button>
            </Box>

            {/* Metric Chips */}
            <Box display="flex" gap={1.5} flexWrap="wrap">
              {compareMeta.metrics.map((m) => (
                <MetricChip
                  key={m.id}
                  label={m.label}
                  color={m.color}
                  active={activeMetrics.includes(m.id)}
                  onClick={() =>
                    setActiveMetrics((prev) =>
                      prev.includes(m.id)
                        ? prev.filter((x) => x !== m.id)
                        : [...prev, m.id]
                    )
                  }
                />
              ))}
            </Box>

            {/* Chart */}
            <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #E5E7EB" }}>
              <Box sx={{ height: 350 }}>
                <ReactECharts
                  key={selectedCompareSkus.map((s) => s.id).join("-")}
                  option={compareOption}
                  notMerge={true}
                  style={{ height: "100%", width: "100%" }}
                />
              </Box>
            </Paper>
          </Box>
        )}

        {/* Shared Add SKU drawer for both Competition + Compare SKUs */}
        <AddSkuDrawer
          open={addSkuOpen}
          onClose={() => setAddSkuOpen(false)}
          onApply={handleSkuApply}
          selectedIds={selectedCompareSkus.map((s) => s.id)}
        />
      </Box>
    </Box>
  );
}
