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
import AddSkuDrawer from "../AllAvailablityAnalysis/AddSkuDrawer";
import KpiTrendShowcase from "../AllAvailablityAnalysis/KpiTrendShowcase";

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
  /* ============================================================
     TRENDS
  ============================================================ */
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
        id: "Impressions",
        label: "Impressions",
        color: "#2563EB",
        axis: "left",
        default: true,
      },
      {
        id: "DirectConv",
        label: "Direct Conv",
        color: "#16A34A",
        axis: "right",
        default: true,
      },
      {
        id: "Spend",
        label: "Spend",
        color: "#F97316",
        axis: "left",
        default: false,
      },
      {
        id: "NewUsers",
        label: "New Users",
        color: "#7C3AED",
        axis: "left",
        default: false,
      },
    ],

    points: [
      {
        date: "06 Sep'25",
        Impressions: 5,
        DirectConv: 3.2,
        Spend: 1.8,
        NewUsers: 21,
      },
      {
        date: "07 Sep'25",
        Impressions: 9,
        DirectConv: 3.1,
        Spend: 1.7,
        NewUsers: 16,
      },
      {
        date: "08 Sep'25",
        Impressions: 3,
        DirectConv: 3.0,
        Spend: 1.6,
        NewUsers: 8,
      },
      {
        date: "09 Sep'25",
        Impressions: 5,
        DirectConv: 2.9,
        Spend: 1.6,
        NewUsers: 11,
      },
      {
        date: "10 Sep'25",
        Impressions: 13,
        DirectConv: 2.8,
        Spend: 1.5,
        NewUsers: 12,
      },
      {
        date: "11 Sep'25",
        Impressions: 16,
        DirectConv: 2.8,
        Spend: 1.5,
        NewUsers: 15,
      },
      {
        date: "12 Sep'25",
        Impressions: 18,
        DirectConv: 2.7,
        Spend: 1.4,
        NewUsers: 17,
      },
      {
        date: "13 Sep'25",
        Impressions: 11,
        DirectConv: 2.6,
        Spend: 1.4,
        NewUsers: 19,
      },
      {
        date: "14 Sep'25",
        Impressions: 6,
        DirectConv: 2.6,
        Spend: 1.4,
        NewUsers: 18,
      },
      {
        date: "15 Sep'25",
        Impressions: 9,
        DirectConv: 2.5,
        Spend: 1.3,
        NewUsers: 12,
      },
      {
        date: "16 Sep'25",
        Impressions: 13,
        DirectConv: 2.5,
        Spend: 1.3,
        NewUsers: 13,
      },
      {
        date: "17 Sep'25",
        Impressions: 8,
        DirectConv: 2.4,
        Spend: 1.2,
        NewUsers: 5,
      },
      {
        date: "18 Sep'25",
        Impressions: 7,
        DirectConv: 2.4,
        Spend: 1.2,
        NewUsers: 8,
      },
      {
        date: "19 Sep'25",
        Impressions: 10,
        DirectConv: 2.3,
        Spend: 1.2,
        NewUsers: 5,
      },
      {
        date: "20 Sep'25",
        Impressions: 18,
        DirectConv: 3.6,
        Spend: 2.1,
        NewUsers: 9,
      },
      {
        date: "21 Sep'25",
        Impressions: 10,
        DirectConv: 2.5,
        Spend: 1.3,
        NewUsers: 19,
      },
      {
        date: "22 Sep'25",
        Impressions: 21,
        DirectConv: 2.4,
        Spend: 1.3,
        NewUsers: 11,
      },
      {
        date: "23 Sep'25",
        Impressions: 4,
        DirectConv: 2.3,
        Spend: 1.2,
        NewUsers: 19,
      },
      {
        date: "24 Sep'25",
        Impressions: 3,
        DirectConv: 2.2,
        Spend: 1.2,
        NewUsers: 16,
      },
      {
        date: "25 Sep'25",
        Impressions: 2,
        DirectConv: 2.2,
        Spend: 1.1,
        NewUsers: 12,
      },
      {
        date: "26 Sep'25",
        Impressions: 11,
        DirectConv: 2.1,
        Spend: 1.1,
        NewUsers: 23,
      },
      {
        date: "27 Sep'25",
        Impressions: 15,
        DirectConv: 2.1,
        Spend: 5,
        NewUsers: 12,
      },
      {
        date: "28 Sep'25",
        Impressions: 16,
        DirectConv: 2.0,
        Spend: 7,
        NewUsers: 3,
      },
      {
        date: "29 Sep'25",
        Impressions: 19,
        DirectConv: 2.0,
        Spend: 4,
        NewUsers: 4,
      },
      {
        date: "30 Sep'25",
        Impressions: 20,
        DirectConv: 2.1,
        Spend: 9,
        NewUsers: 5,
      },
      {
        date: "01 Oct'25",
        Impressions: 21,
        DirectConv: 2.2,
        Spend: 1.2,
        NewUsers: 12,
      },
      {
        date: "02 Oct'25",
        Impressions: 14,
        DirectConv: 2.3,
        Spend: 1.3,
        NewUsers: 17,
      },
      {
        date: "03 Oct'25",
        Impressions: 7,
        DirectConv: 2.5,
        Spend: 1.4,
        NewUsers: 8,
      },
      {
        date: "04 Oct'25",
        Impressions: 9,
        DirectConv: 2.6,
        Spend: 1.5,
        NewUsers: 10,
      },
    ],
  },

  /* ============================================================
     COMPARE SKUs
  ============================================================ */
  compareSkus: {
    context: { level: "MRP" },

    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",

    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Daily",

    metrics: [
      {
        id: "Impressions",
        label: "Impressions",
        color: "#2563EB",
        default: true,
      },
      {
        id: "DirectConv",
        label: "Direct Conv",
        color: "#16A34A",
        default: true,
      },
      { id: "Spend", label: "Spend", color: "#F97316", default: false },
      { id: "NewUsers", label: "New Users", color: "#7C3AED", default: false },
    ],

    x: COMPARE_X,

    trendsBySku: {
      1: makeSkuTrend(0, 0, 0, 0),
      2: makeSkuTrend(-2000, -0.2, -0.1, -20),
      3: makeSkuTrend(-4000, -0.3, -0.2, -35),
      4: makeSkuTrend(-6000, -0.4, -0.3, -50),
      5: makeSkuTrend(+3000, +0.3, +0.2, +40),
      6: makeSkuTrend(+2000, +0.2, +0.1, +25),
      7: makeSkuTrend(-1500, -0.2, -0.1, -18),
      8: makeSkuTrend(+4500, +0.4, +0.3, +55),
    },
  },

  /* ============================================================
     COMPETITION
  ============================================================ */
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
      { id: "Impressions", label: "Impressions", type: "metric" },
      { id: "DirectConv", label: "Direct Conv", type: "metric" },
      { id: "Spend", label: "Spend", type: "metric" },
      { id: "NewUsers", label: "New Users", type: "metric" },
    ],

    brands: [
      {
        brand: "Colgate",
        Impressions: { value: 65200, delta: -4200 },
        DirectConv: { value: 3.1, delta: -0.4 },
        Spend: { value: 18.4, delta: -2.1 },
        NewUsers: { value: 420, delta: 22 },
      },
      {
        brand: "Sensodyne",
        Impressions: { value: 49600, delta: 3100 },
        DirectConv: { value: 3.6, delta: 0.5 },
        Spend: { value: 16.8, delta: 1.9 },
        NewUsers: { value: 390, delta: -18 },
      },
      {
        brand: "Oral-B",
        Impressions: { value: 38200, delta: -2900 },
        DirectConv: { value: 2.8, delta: -0.3 },
        Spend: { value: 12.6, delta: -1.4 },
        NewUsers: { value: 310, delta: -26 },
      },
      {
        brand: "Dabur",
        Impressions: { value: 26800, delta: 1200 },
        DirectConv: { value: 3.0, delta: 0.2 },
        Spend: { value: 9.4, delta: 0.8 },
        NewUsers: { value: 260, delta: 34 },
      },
    ],

    skus: [
      {
        brand: "Colgate Strong Teeth 100g",
        Impressions: { value: 18200, delta: -1200 },
        DirectConv: { value: 3.0, delta: -0.2 },
        Spend: { value: 5.8, delta: -0.7 },
        NewUsers: { value: 120, delta: 6 },
      },
      {
        brand: "Sensodyne Rapid Relief 40g",
        Impressions: { value: 14600, delta: 900 },
        DirectConv: { value: 3.8, delta: 0.4 },
        Spend: { value: 6.1, delta: 0.9 },
        NewUsers: { value: 135, delta: -4 },
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

export default function PerformanceTrendDatas({
  dynamicKey,
  open = true,
  onClose = () => { },
  selectedColumn,
}) {
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
    const baseRows =
      compTab === "Brands" ? compMeta.brands : compMeta.skus || compMeta.brands;

    return baseRows.filter((r) =>
      search.trim()
        ? r.brand.toLowerCase().includes(search.toLowerCase())
        : true
    );
  }, [compMeta, compTab, search]);

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

  const PLATFORM_OPTIONS = [
    "Blinkit",
    "Zepto",
    "Instamart",
    "Swiggy",
    "Amazon",
  ];
  const FORMAT_OPTIONS = ["Cassata", "Core Tubs", "Premium"];
  const CITY_OPTIONS = ["Delhi", "Mumbai", "Bangalore", "Chennai"];

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
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
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
                fontSize: 11,
                "&.Mui-selected": {
                  backgroundColor: "#0F172A",
                  color: "#fff",
                },
              },
            }}
          >
            <ToggleButton value="Trends">Trends</ToggleButton>
            {dynamicKey !== "Performance_marketing" && (
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
              {/* PLATFORM FILTER WRAPPER */}
              <Box display="flex" alignItems="center" gap={1}>
                {/* CLICKABLE LABEL (now only toggles open/close) */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ cursor: "pointer", userSelect: "none" }}
                >
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
                  >
                    <MenuItem value="Platform">Platform</MenuItem>
                    <MenuItem value="Format">Format</MenuItem>
                    <MenuItem value="City">City</MenuItem>
                  </Select>
                </Typography>

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
                          fontSize: "11px",
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
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Time Step:</Typography>
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
        {view === "Competition" && <KpiTrendShowcase />}

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
