// TrendsCompetitionDrawer.jsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
  useContext,
} from "react";
import { FilterContext } from "../../utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
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
  Listing: [85, 86, 84, 85, 83, 84, 82, 83, 81, 82],
};

function makeSkuTrend(osaOffset, doiOffset, fillOffset, assOffset, listingOffset = 0) {
  return {
    Osa: BASE_COMPARE_TRENDS.Osa.map((v) => v + osaOffset),
    Doi: BASE_COMPARE_TRENDS.Doi.map((v) => v + doiOffset),
    Fillrate: BASE_COMPARE_TRENDS.Fillrate.map((v) => v + fillOffset),
    Assortment: BASE_COMPARE_TRENDS.Assortment.map((v) => v + assOffset),
    Listing: BASE_COMPARE_TRENDS.Listing.map((v) => v + listingOffset),
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
  selectedLevel,
}) {
  const [allTrendMeta, allSetTrendMeta] = useState({
    context: {
      audience: "Platform", // default value
    },
  });

  // Get dynamic values from FilterContext
  const { platforms, brands, locations, dateRange, timeStart, timeEnd, selectedBrand: globalBrand, selectedLocation: globalLocation, platform: globalPlatform } = useContext(FilterContext);

  // State for formats (from API)
  const [formatOptions, setFormatOptions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  // State for competition data (from API)
  const [competitionData, setCompetitionData] = useState({ brands: [], skus: [] });
  const [competitionLoading, setCompetitionLoading] = useState(false);

  // Fetch formats from API on mount
  useEffect(() => {
    const fetchFormats = async () => {
      try {
        const response = await axiosInstance.get("/watchtower/categories");
        if (response.data && response.data.length > 0) {
          setFormatOptions(response.data.filter(f => f !== "All"));
        }
      } catch (error) {
        console.warn("Failed to fetch formats, using fallback", error);
        setFormatOptions(["Cassata", "Core Tubs", "Premium"]);
      }
    };
    fetchFormats();
  }, []);

  let DASHBOARD_DATA = {};
  if (dynamicKey === "performance_dashboard_tower") {
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
            id: "ShareOfSearch",
            label: "Share of Search",
            color: "#2563EB",
            axis: "left",
            default: true,
          },
          {
            id: "InorganicSales",
            label: "Inorganic Sales",
            color: "#16A34A",
            axis: "right",
            default: true,
          },
          {
            id: "Conversion",
            label: "Conversion",
            color: "#F97316",
            axis: "left",
            default: false,
          },
          {
            id: "Roas",
            label: "ROAS",
            color: "#7C3AED",
            axis: "right",
            default: false,
          },
          {
            id: "BmiSalesRatio",
            label: "BMI / Sales Ratio",
            color: "#DC2626",
            axis: "right",
            default: false,
          },
        ],

        points: [
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
        ],
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
            id: "Listing",
            label: "Listing %",
            color: "#0EA5E9",
            axis: "left",
            default: true,
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
          { date: "06 Sep'25", Osa: 57, Doi: 41, Fillrate: 72, Assortment: 65, Listing: 88 },
          { date: "07 Sep'25", Osa: 54, Doi: 42, Fillrate: 70, Assortment: 66, Listing: 87 },
          { date: "08 Sep'25", Osa: 53, Doi: 40, Fillrate: 69, Assortment: 64, Listing: 86 },
          { date: "09 Sep'25", Osa: 53, Doi: 39, Fillrate: 68, Assortment: 63, Listing: 85 },
          { date: "10 Sep'25", Osa: 52, Doi: 37, Fillrate: 66, Assortment: 62, Listing: 84 },
          { date: "11 Sep'25", Osa: 52, Doi: 36, Fillrate: 67, Assortment: 62, Listing: 84 },
          { date: "12 Sep'25", Osa: 52, Doi: 35, Fillrate: 68, Assortment: 61, Listing: 83 },
          { date: "13 Sep'25", Osa: 52, Doi: 34, Fillrate: 69, Assortment: 60, Listing: 82 },
          { date: "14 Sep'25", Osa: 52, Doi: 33, Fillrate: 70, Assortment: 60, Listing: 81 },
          { date: "15 Sep'25", Osa: 52, Doi: 32, Fillrate: 70, Assortment: 59, Listing: 80 },
          { date: "16 Sep'25", Osa: 52, Doi: 32, Fillrate: 69, Assortment: 59, Listing: 79 },
          { date: "17 Sep'25", Osa: 51, Doi: 31, Fillrate: 68, Assortment: 58, Listing: 78 },
          { date: "18 Sep'25", Osa: 51, Doi: 31, Fillrate: 67, Assortment: 58, Listing: 77 },
          { date: "19 Sep'25", Osa: 51, Doi: 32, Fillrate: 66, Assortment: 57, Listing: 76 },
          { date: "20 Sep'25", Osa: 56, Doi: 50, Fillrate: 75, Assortment: 68, Listing: 85 },
          { date: "21 Sep'25", Osa: 50, Doi: 34, Fillrate: 67, Assortment: 55, Listing: 75 },
          { date: "22 Sep'25", Osa: 49, Doi: 33, Fillrate: 66, Assortment: 54, Listing: 74 },
          { date: "23 Sep'25", Osa: 48, Doi: 32, Fillrate: 65, Assortment: 54, Listing: 73 },
          { date: "24 Sep'25", Osa: 47, Doi: 31, Fillrate: 64, Assortment: 53, Listing: 72 },
          { date: "25 Sep'25", Osa: 46, Doi: 30, Fillrate: 63, Assortment: 52, Listing: 71 },
          { date: "26 Sep'25", Osa: 45, Doi: 30, Fillrate: 62, Assortment: 52, Listing: 70 },
          { date: "27 Sep'25", Osa: 44, Doi: 31, Fillrate: 63, Assortment: 51, Listing: 69 },
          { date: "28 Sep'25", Osa: 44, Doi: 31, Fillrate: 62, Assortment: 51, Listing: 68 },
          { date: "29 Sep'25", Osa: 43, Doi: 32, Fillrate: 61, Assortment: 50, Listing: 67 },
          { date: "30 Sep'25", Osa: 43, Doi: 34, Fillrate: 60, Assortment: 49, Listing: 66 },
          { date: "01 Oct'25", Osa: 44, Doi: 36, Fillrate: 61, Assortment: 50, Listing: 68 },
          { date: "02 Oct'25", Osa: 45, Doi: 37, Fillrate: 62, Assortment: 51, Listing: 69 },
          { date: "03 Oct'25", Osa: 46, Doi: 39, Fillrate: 63, Assortment: 52, Listing: 70 },
          { date: "04 Oct'25", Osa: 46, Doi: 40, Fillrate: 65, Assortment: 53, Listing: 71 },
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
          {
            id: "Listing",
            label: "Listing %",
            color: "#0EA5E9",
            default: true,
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
          1: makeSkuTrend(0, 0, 0, 0, 0),
          2: makeSkuTrend(-2, -1, -1, 0, 1),
          3: makeSkuTrend(-3, -2, -2, -1, 2),
          4: makeSkuTrend(-4, -3, -3, -1, 3),
          5: makeSkuTrend(+2, +3, +2, +2, 4),
          6: makeSkuTrend(+1, +2, +1, +1, 5),
          7: makeSkuTrend(-1, -2, -1, -1, 6),
          8: makeSkuTrend(+3, +1, +2, +1, 7),
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
          { id: "Listing", label: "Listing %", type: "metric" },
          { id: "Assortment", label: "Assortment", type: "metric" },
        ],

        brands: [
          {
            brand: "Colgate",
            Osa: { value: 32.9, delta: -4.5 },
            Doi: { value: 74.6, delta: -16.3 },
            Fillrate: { value: 20.0, delta: -8.5 },
            Listing: { value: 85.4, delta: 1.2 },
            Assortment: { value: 18.8, delta: 0.4 },
          },
          {
            brand: "Sensodyne",
            Osa: { value: 19.6, delta: 2.2 },
            Doi: { value: 94.2, delta: 3.9 },
            Fillrate: { value: 19.3, delta: 2.7 },
            Listing: { value: 91.2, delta: -0.5 },
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
            Listing: { value: 88.0, delta: 0.5 },
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
            id: "CategoryShare",
            label: "Category Share",
            color: "#EC4899",
            axis: "right",
          },
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
            CategoryShare: 24.3,
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
            CategoryShare: 22.8,
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
            CategoryShare: 23.5,
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
            CategoryShare: 21.7,
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
            CategoryShare: 24.8,
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
            CategoryShare: 23.1,
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
            CategoryShare: 25.6,
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
            CategoryShare: 21.2,
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
            CategoryShare: 24.1,
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
            CategoryShare: 26.2,
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
          { id: "CategoryShare", label: "Category Share", color: "#EC4899" },
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
              CategoryShare: 23.8,
              MarketShare: 17.6,
              Conversion: 3.2,
            },
            {
              x: "W2",
              Offtakes: 55,
              Spend: 4.5,
              ROAS: 7.0,
              CategoryShare: 24.2,
              MarketShare: 17.9,
              Conversion: 3.3,
            },
            {
              x: "W3",
              Offtakes: 56,
              Spend: 4.8,
              ROAS: 7.2,
              CategoryShare: 24.5,
              MarketShare: 18.1,
              Conversion: 3.4,
            },
            {
              x: "W4",
              Offtakes: 57,
              Spend: 5.0,
              ROAS: 7.4,
              CategoryShare: 24.9,
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
          { id: "CategoryShare", label: "Category Share", type: "metric" },
          { id: "MarketShare", label: "Market Share", type: "metric" },
        ],

        brands: [
          {
            brand: "Colgate",
            Offtakes: { value: 32.9, delta: -4.5 },
            Spend: { value: 6.8, delta: 0.4 },
            ROAS: { value: 7.3, delta: 0.2 },
            SOS: { value: 44, delta: 1.2 },
            CategoryShare: { value: 24.6, delta: 0.8 },
            MarketShare: { value: 18.8, delta: 0.4 },
          },
          {
            brand: "Sensodyne",
            Offtakes: { value: 19.6, delta: 2.2 },
            Spend: { value: 5.1, delta: -0.3 },
            ROAS: { value: 6.9, delta: -0.1 },
            SOS: { value: 39, delta: -0.8 },
            CategoryShare: { value: 22.3, delta: -0.5 },
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
  const [range, setRange] = useState(DASHBOARD_DATA.trends.defaultRange);
  const [timeStep, setTimeStep] = useState(
    DASHBOARD_DATA.trends.defaultTimeStep
  );
  const [activeMetrics, setActiveMetrics] = useState(
    DASHBOARD_DATA.trends.metrics.filter((m) => m.default).map((m) => m.id)
  );
  const [compTab, setCompTab] = useState("Brands");
  const [search, setSearch] = useState("");
  const [periodMode, setPeriodMode] = useState("primary");

  // shared Add SKU drawer + selected SKUs (used by Compare SKUs + Competition)
  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("Blinkit");
  const [showPlatformPills, setShowPlatformPills] = useState(false);

  const platformRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      // do nothing
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch competition data when viewing Competition tab
  useEffect(() => {
    if (view !== "Competition") return;

    const fetchCompetitionData = async () => {
      setCompetitionLoading(true);
      try {
        const params = {
          platform: globalPlatform || 'All',
          location: globalLocation || 'All',
          category: 'All',
          period: '1M'
        };

        console.log("Fetching competition data with params:", params);
        const response = await axiosInstance.get('/watchtower/competition', { params });

        if (response.data) {
          // Transform backend format to frontend format
          const transformedBrands = (response.data.brands || []).map(b => ({
            brand: b.brand_name,
            ShareOfSearch: { value: b.sos || 0, delta: 0 },
            InorganicSales: { value: b.marketShare || 0, delta: 0 },
            Conversion: { value: b.categoryShare || 0, delta: 0 },
            Roas: { value: b.price || 0, delta: 0 },
            BmiSalesRatio: { value: b.osa || 0, delta: 0 },
          }));

          const transformedSkus = (response.data.skus || []).map(s => ({
            brand: s.sku_name,
            brandName: s.brand_name,
            ShareOfSearch: { value: s.sos || 0, delta: 0 },
            InorganicSales: { value: s.marketShare || 0, delta: 0 },
            Conversion: { value: s.categoryShare || 0, delta: 0 },
            Roas: { value: s.price || 0, delta: 0 },
            BmiSalesRatio: { value: s.osa || 0, delta: 0 },
          }));

          console.log("Competition data received:", transformedBrands.length, "brands,", transformedSkus.length, "skus");
          setCompetitionData({ brands: transformedBrands, skus: transformedSkus });
        }
      } catch (error) {
        console.error("Error fetching competition data:", error);
      } finally {
        setCompetitionLoading(false);
      }
    };

    fetchCompetitionData();
  }, [view, globalPlatform, globalLocation]);

  // Dynamic options from FilterContext (filter out 'All' for pills)
  const PLATFORM_OPTIONS = platforms.filter(p => p !== "All");
  const FORMAT_OPTIONS = formatOptions.length > 0 ? formatOptions : ["Cassata", "Core Tubs", "Premium"];
  const CITY_OPTIONS = locations.filter(l => l !== "All");
  const BRAND_OPTIONS = brands.filter(b => b !== "All");

  // Fetch trend data when filters change
  useEffect(() => {
    if (view !== "Trends") return;

    let timeoutId;
    let cancelled = false;

    const fetchTrendData = async () => {
      setLoading(true);
      try {
        // Determine filters based on drawer selection overrides
        const audienceType = allTrendMeta.context.audience;

        // Base filters from global context
        const params = {
          period: range,
          timeStep: timeStep,
          platform: globalPlatform || 'All',
          brand: globalBrand || 'All',
          location: globalLocation || 'All',
          category: 'All'
        };

        if (range === 'Custom' && timeStart && timeEnd) {
          params.startDate = timeStart.toISOString();
          params.endDate = timeEnd.toISOString();
        }

        // Override based on specific drawer filter
        if (audienceType === 'Platform') params.platform = selectedPlatform;
        if (audienceType === 'Brand') params.brand = selectedPlatform;
        if (audienceType === 'City') params.location = selectedPlatform;
        if (audienceType === 'Format') params.category = selectedPlatform;

        console.log("Fetching trend data with params:", params);
        const response = await axiosInstance.get('/watchtower/kpi-trends', { params });

        if (cancelled) return;

        // Backend returns { timeSeries: [...] } - extract the array
        if (response.data && response.data.timeSeries && Array.isArray(response.data.timeSeries)) {
          console.log("Trend data received:", response.data.timeSeries.length, "points");
          setChartData(response.data.timeSeries);
        } else if (response.data && Array.isArray(response.data)) {
          // Fallback for direct array response
          setChartData(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching trend data:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Delay trend data fetch by 3 seconds to prioritize main dashboard segments loading first
    console.log("⏳ Trend data fetch scheduled in 3 seconds...");
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        fetchTrendData();
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [selectedPlatform, range, timeStep, allTrendMeta.context.audience, view, globalPlatform, globalBrand, globalLocation, timeStart, timeEnd]);



  const [selectedCompareSkus, setSelectedCompareSkus] = useState([]);
  const [compareInitialized, setCompareInitialized] = useState(false);

  const trendMeta = DASHBOARD_DATA.trends;
  const compMeta = DASHBOARD_DATA.competition;
  const compareMeta = DASHBOARD_DATA.compareSkus;

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
    if (chartData && chartData.length > 0) {
      // API data is already filtered
      return chartData.map(p => ({
        ...p,
        // Format date for display if needed, or keep as is. 
        // Backend usually returns YYYY-MM-DD. 
        // Let's formatting it to match the mock format "DD MMM'YY" for consistency
        date: new Date(p.date).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, " ").replace(/\/20/, "'")
      }));
    }

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
  }, [trendMeta, range, chartData]);

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
      grid: { left: 60, right: 80, top: 32, bottom: 40 },
      tooltip: { trigger: "axis" },
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
        },
        {
          type: "value",
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          min: 0,
          max: 100,
        },
      ],
      legend: { show: false },
      series,
    };
  }, [trendMeta, activeMetrics, trendPoints]);

  const competitionRows = useMemo(() => {
    // Use API data if available, otherwise fallback to mock data
    const apiBrands = competitionData.brands || [];
    const apiSkus = competitionData.skus || [];

    const baseRows = compTab === "Brands"
      ? (apiBrands.length > 0 ? apiBrands : compMeta.brands)
      : (apiSkus.length > 0 ? apiSkus : compMeta.skus || compMeta.brands);

    return baseRows.filter((r) =>
      search.trim()
        ? r.brand.toLowerCase().includes(search.toLowerCase())
        : true
    );
  }, [compMeta, compTab, search, competitionData]);

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
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: { type: "category", data: x },
      yAxis: {
        type: "value",
        min: 0,
        max: 120,
        axisLabel: { formatter: "{value}%" },
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
              {/* Title */}
              <Typography variant="h6" fontWeight={600}>
                {selectedColumn || "KPI Trends"}
              </Typography>

              {/* PLATFORM FILTER WRAPPER */}
              <Box display="flex" alignItems="center" gap={1}>
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
                  sx={{
                    width: 160,
                    height: 38,
                    backgroundColor: "#F8FAFC",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#E2E8F0",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#CBD5E1",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#3B82F6",
                    },
                  }}
                >
                  <MenuItem value="Platform">Platform</MenuItem>
                  <MenuItem value="Format">Format</MenuItem>
                  <MenuItem value="Brand">Brand</MenuItem>
                  <MenuItem value="City">City</MenuItem>
                </Select>


                {/* DYNAMIC PILLS */}
                {/* DYNAMIC PILLS */}
                {showPlatformPills && (
                  <Box display="flex" gap={0.5}>
                    {(allTrendMeta.context.audience === "Platform"
                      ? PLATFORM_OPTIONS
                      : allTrendMeta.context.audience === "Format"
                        ? FORMAT_OPTIONS
                        : allTrendMeta.context.audience === "City"
                          ? CITY_OPTIONS
                          : allTrendMeta.context.audience === "Brand"
                            ? BRAND_OPTIONS
                            : []
                    ).map((p) => (
                      <Box
                        key={p}
                        onClick={() => {
                          setSelectedPlatform(p); // only select the pill
                          // ❌ DO NOT toggle or force open here
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
                            selectedPlatform === p ? "#0ea5e9" : "white",
                          color: selectedPlatform === p ? "white" : "#0f172a",
                        }}
                      >
                        {p}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

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
          <>
            {dynamicKey === "platform_overview_tower" ? (
              <PlatformOverviewKpiShowcase
                dynamicKey={dynamicKey}
                selectedItem={selectedColumn}
                selectedLevel={selectedLevel}
              />
            ) : (
              <KpiTrendShowcase dynamicKey={dynamicKey} />
            )}
          </>
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
    </Box >
  );
}
