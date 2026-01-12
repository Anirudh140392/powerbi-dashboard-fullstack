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
import KpiTrendShowcase from "../AllAvailablityAnalysis/KpiTrendShowcase";
import AddSkuDrawer from "../AllAvailablityAnalysis/AddSkuDrawer";
import VisibilityKpiTrendShowcase from "./VisibilityKpiTrendShowcase";
import axiosInstance from "../../api/axiosInstance";

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

const DASHBOARD_DATA = {
  trends: {
    context: {
      level: "MRP",
      audience: "All",
    },

    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",

    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Daily",

    // ⭐ Your New KPI Set
    metrics: [
      {
        id: "overall_sos",
        label: "Overall SOS",
        color: "#F97316",
        axis: "left",
        default: true,
      },
      {
        id: "sponsored_sos",
        label: "Sponsored SOS",
        color: "#7C3AED",
        axis: "right",
        default: true,
      },
      {
        id: "organic_sos",
        label: "Organic SOS",
        color: "#6366F1",
        axis: "left",
        default: false,
      },
      {
        id: "display_sos",
        label: "Display SOS",
        color: "#22C55E",
        axis: "left",
        default: false,
      },
    ],

    // ⭐ All trend points now contain SOS metrics instead of old KPIs
    points: [
      {
        date: "06 Sep'25",
        overall_sos: 57,
        sponsored_sos: 41,
        organic_sos: 72,
        display_sos: 65,
      },
      {
        date: "07 Sep'25",
        overall_sos: 54,
        sponsored_sos: 42,
        organic_sos: 70,
        display_sos: 66,
      },
      {
        date: "08 Sep'25",
        overall_sos: 53,
        sponsored_sos: 40,
        organic_sos: 69,
        display_sos: 64,
      },
      {
        date: "09 Sep'25",
        overall_sos: 53,
        sponsored_sos: 39,
        organic_sos: 68,
        display_sos: 63,
      },
      {
        date: "10 Sep'25",
        overall_sos: 52,
        sponsored_sos: 37,
        organic_sos: 66,
        display_sos: 62,
      },
      {
        date: "11 Sep'25",
        overall_sos: 52,
        sponsored_sos: 36,
        organic_sos: 67,
        display_sos: 62,
      },
      {
        date: "12 Sep'25",
        overall_sos: 52,
        sponsored_sos: 35,
        organic_sos: 68,
        display_sos: 61,
      },
      {
        date: "13 Sep'25",
        overall_sos: 52,
        sponsored_sos: 34,
        organic_sos: 69,
        display_sos: 60,
      },
      {
        date: "14 Sep'25",
        overall_sos: 52,
        sponsored_sos: 33,
        organic_sos: 70,
        display_sos: 60,
      },
      {
        date: "15 Sep'25",
        overall_sos: 52,
        sponsored_sos: 32,
        organic_sos: 70,
        display_sos: 59,
      },
      {
        date: "16 Sep'25",
        overall_sos: 52,
        sponsored_sos: 32,
        organic_sos: 69,
        display_sos: 59,
      },
      {
        date: "17 Sep'25",
        overall_sos: 51,
        sponsored_sos: 31,
        organic_sos: 68,
        display_sos: 58,
      },
      {
        date: "18 Sep'25",
        overall_sos: 51,
        sponsored_sos: 31,
        organic_sos: 67,
        display_sos: 58,
      },
      {
        date: "19 Sep'25",
        overall_sos: 51,
        sponsored_sos: 32,
        organic_sos: 66,
        display_sos: 57,
      },
      {
        date: "20 Sep'25",
        overall_sos: 56,
        sponsored_sos: 50,
        organic_sos: 75,
        display_sos: 68,
      },
      {
        date: "21 Sep'25",
        overall_sos: 50,
        sponsored_sos: 34,
        organic_sos: 67,
        display_sos: 55,
      },
      {
        date: "22 Sep'25",
        overall_sos: 49,
        sponsored_sos: 33,
        organic_sos: 66,
        display_sos: 54,
      },
      {
        date: "23 Sep'25",
        overall_sos: 48,
        sponsored_sos: 32,
        organic_sos: 65,
        display_sos: 54,
      },
      {
        date: "24 Sep'25",
        overall_sos: 47,
        sponsored_sos: 31,
        organic_sos: 64,
        display_sos: 53,
      },
      {
        date: "25 Sep'25",
        overall_sos: 46,
        sponsored_sos: 30,
        organic_sos: 63,
        display_sos: 52,
      },
      {
        date: "26 Sep'25",
        overall_sos: 45,
        sponsored_sos: 30,
        organic_sos: 62,
        display_sos: 52,
      },
      {
        date: "27 Sep'25",
        overall_sos: 44,
        sponsored_sos: 31,
        organic_sos: 63,
        display_sos: 51,
      },
      {
        date: "28 Sep'25",
        overall_sos: 44,
        sponsored_sos: 31,
        organic_sos: 62,
        display_sos: 51,
      },
      {
        date: "29 Sep'25",
        overall_sos: 43,
        sponsored_sos: 32,
        organic_sos: 61,
        display_sos: 50,
      },
      {
        date: "30 Sep'25",
        overall_sos: 43,
        sponsored_sos: 34,
        organic_sos: 60,
        display_sos: 49,
      },
      {
        date: "01 Oct'25",
        overall_sos: 44,
        sponsored_sos: 36,
        organic_sos: 61,
        display_sos: 50,
      },
      {
        date: "02 Oct'25",
        overall_sos: 45,
        sponsored_sos: 37,
        organic_sos: 62,
        display_sos: 51,
      },
      {
        date: "03 Oct'25",
        overall_sos: 46,
        sponsored_sos: 39,
        organic_sos: 63,
        display_sos: 52,
      },
      {
        date: "04 Oct'25",
        overall_sos: 46,
        sponsored_sos: 40,
        organic_sos: 65,
        display_sos: 53,
      },
    ],
  },

  // ⭐ UPDATED Compare SKUs using NEW KPIs
  compareSkus: {
    context: { level: "MRP" },
    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",
    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Daily",

    metrics: [
      {
        id: "overall_sos",
        label: "Overall SOS",
        color: "#F97316",
        default: true,
      },
      {
        id: "sponsored_sos",
        label: "Sponsored SOS",
        color: "#7C3AED",
        default: true,
      },
      {
        id: "organic_sos",
        label: "Organic SOS",
        color: "#6366F1",
        default: false,
      },
      {
        id: "display_sos",
        label: "Display SOS",
        color: "#22C55E",
        default: false,
      },
    ],

    x: COMPARE_X,

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

  // ⭐ COMPETITION VIEW UPDATED TO NEW KPIs
  competition: {
    context: { level: "MRP", region: "All × Chennai" },

    tabs: ["Brands", "SKUs"],

    periodToggle: {
      primary: "MTD",
      compare: "Previous Month",
    },

    columns: [
      { id: "brand", label: "Brand", type: "text" },
      { id: "overall_sos", label: "Overall SOS", type: "metric" },
      { id: "sponsored_sos", label: "Sponsored SOS", type: "metric" },
      { id: "organic_sos", label: "Organic SOS", type: "metric" },
      { id: "display_sos", label: "Display SOS", type: "metric" },
    ],

    brands: [
      {
        brand: "Colgate",
        overall_sos: { value: 32.9, delta: -4.5 },
        sponsored_sos: { value: 74.6, delta: -16.3 },
        organic_sos: { value: 20.0, delta: -8.5 },
        display_sos: { value: 18.8, delta: 0.4 },
      },
      {
        brand: "Sensodyne",
        overall_sos: { value: 19.6, delta: 2.2 },
        sponsored_sos: { value: 94.2, delta: 3.9 },
        organic_sos: { value: 19.3, delta: 2.7 },
        display_sos: { value: 18.5, delta: -3.1 },
      },
    ],

    skus: [
      {
        brand: "Colgate Strong Teeth 100g",
        overall_sos: { value: 8.2, delta: -1.0 },
        sponsored_sos: { value: 76.1, delta: -8.0 },
        organic_sos: { value: 4.5, delta: -0.9 },
        display_sos: { value: 3.2, delta: 0.2 },
      },
    ],
  },
};

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

export default function VisibilityTrendsCompetitionDrawer({
  dynamicKey,
  open = true,
  onClose = () => { },
  selectedColumn,
}) {
  const [view, setView] = useState("Trends");
  const [allTrendMeta, allSetTrendMeta] = useState({
    context: {
      audience: "Platform", // default value
    },
  });
  useLayoutEffect(() => {
    allSetTrendMeta((prev) => ({
      ...prev,
      context: { ...prev.context, audience: "Platform" },
    }));
    setShowPlatformPills(true);
  }, []);
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

  // close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (platformRef.current && !platformRef.current.contains(e.target)) {
        setShowPlatformPills(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      setActiveMetrics(["overall_sos"]);
      setCompareInitialized(true);
    }
  }, [view, compareInitialized]);

  // ===================== API STATE =====================
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [competitionData, setCompetitionData] = useState({ brands: [], skus: [] });
  const [competitionLoading, setCompetitionLoading] = useState(false);

  // ===================== DYNAMIC FILTER OPTIONS STATE =====================
  const [filterOptions, setFilterOptions] = useState({
    platforms: [],
    formats: [],
    cities: [],
    brands: [],
    loading: true
  });

  // ===================== FETCH FILTER OPTIONS =====================
  useEffect(() => {
    if (!open) return;

    const fetchFilterOptions = async () => {
      try {
        console.log("[VisibilityTrendsDrawer] Fetching filter options");
        const [platformsRes, formatsRes, citiesRes, brandsRes] = await Promise.all([
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'platforms' } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'formats' } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'cities' } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'brands' } })
        ]);

        const platforms = (platformsRes.data?.options || []).filter(p => p !== 'All');
        const formats = (formatsRes.data?.options || []).filter(f => f !== 'All');
        const cities = (citiesRes.data?.options || []).filter(c => c !== 'All');
        const brands = (brandsRes.data?.options || []).filter(b => b !== 'All');

        console.log("[VisibilityTrendsDrawer] Filter options fetched:", { platforms: platforms.length, formats: formats.length, cities: cities.length, brands: brands.length });

        setFilterOptions({
          platforms: platforms.length > 0 ? platforms : ["Blinkit", "Zepto", "Instamart", "BigBasket"],
          formats: formats.length > 0 ? formats : ["Cassata", "Core Tubs", "Premium"],
          cities: cities.length > 0 ? cities : ["Delhi", "Mumbai", "Bangalore", "Chennai"],
          brands: brands.length > 0 ? brands : ["Amul", "Mother Dairy", "Nestle", "Britannia"],
          loading: false
        });

        // Set default selected platform to first available
        if (platforms.length > 0) {
          setSelectedPlatform(platforms[0]);
        }
      } catch (error) {
        console.error("[VisibilityTrendsDrawer] Error fetching filter options:", error);
        setFilterOptions({
          platforms: ["Blinkit", "Zepto", "Instamart", "BigBasket"],
          formats: ["Cassata", "Core Tubs", "Premium"],
          cities: ["Delhi", "Mumbai", "Bangalore", "Chennai"],
          brands: ["Amul", "Mother Dairy", "Nestle", "Britannia"],
          loading: false
        });
      }
    };

    fetchFilterOptions();
  }, [open]);

  // ===================== FETCH TREND DATA =====================
  useEffect(() => {
    if (view !== "Trends" || !open) return;

    let cancelled = false;
    const fetchTrendData = async () => {
      setLoading(true);
      try {
        const params = {
          period: range,
          platform: selectedPlatform || 'All',
        };

        console.log("[VisibilityTrendsDrawer] Fetching trend data:", params);
        const response = await axiosInstance.get('/visibility-analysis/kpi-trends', { params });

        if (cancelled) return;

        if (response.data?.timeSeries?.length > 0) {
          console.log("[VisibilityTrendsDrawer] Received", response.data.timeSeries.length, "points");
          setChartData(response.data.timeSeries);
        } else {
          console.log("[VisibilityTrendsDrawer] No data, using hardcoded fallback");
          setChartData([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[VisibilityTrendsDrawer] Error fetching trends:", error);
          setChartData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Small delay to avoid blocking main UI
    const timeoutId = setTimeout(fetchTrendData, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [view, range, selectedPlatform, open]);

  // ===================== FETCH COMPETITION DATA =====================
  // Fetch competition data when drawer opens (not just when Competition view is selected)
  // This ensures data is ready when user clicks Competition tab
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const fetchCompetitionData = async () => {
      setCompetitionLoading(true);
      try {
        const params = {
          period: '1M',
          platform: selectedPlatform || 'All',
        };

        console.log("[VisibilityTrendsDrawer] Fetching competition data:", params);
        const response = await axiosInstance.get('/visibility-analysis/competition', { params });

        if (cancelled) return;

        if (response.data) {
          console.log("[VisibilityTrendsDrawer] Received", response.data.brands?.length, "brands");
          console.log("[VisibilityTrendsDrawer] First brand:", JSON.stringify(response.data.brands?.[0]));
          setCompetitionData({
            brands: response.data.brands || [],
            skus: response.data.skus || []
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[VisibilityTrendsDrawer] Error fetching competition:", error);
        }
      } finally {
        if (!cancelled) setCompetitionLoading(false);
      }
    };

    fetchCompetitionData();
    return () => { cancelled = true; };
  }, [selectedPlatform, open]);

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
  }, [trendMeta, range]);

  const trendOption = useMemo(() => {
    // Use fetched API data if available, otherwise fallback to hardcoded
    const dataSource = chartData.length > 0 ? chartData : trendPoints;
    const xData = dataSource.map((p) => p.date);

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
        data: dataSource.map((p) => p[m.id] ?? null),
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
  }, [trendMeta, activeMetrics, trendPoints, chartData]);

  const competitionRows = useMemo(() => {
    // Use fetched API data if available, otherwise fallback to hardcoded
    const hasApiData = competitionData.brands.length > 0 || competitionData.skus.length > 0;
    const baseRows = hasApiData
      ? (compTab === "Brands" ? competitionData.brands : competitionData.skus)
      : (compTab === "Brands" ? compMeta.brands : compMeta.skus || compMeta.brands);

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

  // Use dynamic filter options from API, with fallbacks
  const PLATFORM_OPTIONS = filterOptions.platforms.length > 0 ? filterOptions.platforms : ["Blinkit", "Zepto", "Instamart", "BigBasket"];
  const FORMAT_OPTIONS = filterOptions.formats.length > 0 ? filterOptions.formats : ["Cassata", "Core Tubs", "Premium"];
  const CITY_OPTIONS = filterOptions.cities.length > 0 ? filterOptions.cities : ["Delhi", "Mumbai", "Bangalore", "Chennai"];
  const BRAND_OPTIONS = filterOptions.brands.length > 0 ? filterOptions.brands : ["Amul", "Mother Dairy", "Nestle", "Britannia"];

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
            <ToggleButton value="Competition">Competition</ToggleButton>
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
              {/* PLATFORM FILTER WRAPPER */}
              <Box display="flex" alignItems="center" gap={1}>
                {/* CLICKABLE LABEL (now only toggles open/close) */}
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

                {/* DYNAMIC PILLS - with scroll for many options */}
                {showPlatformPills && (
                  <Box
                    display="flex"
                    gap={0.5}
                    sx={{
                      maxWidth: '500px',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      flexWrap: 'nowrap',
                      pb: 0.5,
                      '&::-webkit-scrollbar': {
                        height: '4px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#cbd5e1',
                        borderRadius: '4px',
                      },
                    }}
                  >
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
                          setSelectedPlatform(p);
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
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
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
        {view === "Competition" && <VisibilityKpiTrendShowcase competitionData={competitionData} loading={competitionLoading} />}

        {/* COMPARE SKUs VIEW */}
        {view === "compare skus" && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="h6" fontWeight={600}>
                Compare SKUs
              </Typography>
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
