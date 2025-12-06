import React, { useState, useMemo } from "react";
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
  TableRow
} from "@mui/material";
import { ChevronDown, X, Search, Filter } from "lucide-react";
import ReactECharts from "echarts-for-react";
import AddSkuDrawer from "./AddSkuDrawer";

/**
 * ---------------------------------------------------------------------------
 * JSON DATA (mocked but realistic, drives the whole UI)
 * ---------------------------------------------------------------------------
 */

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

    // DAILY KPI TREND MOCK DATA
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
      { date: "20 Sep'25", Osa: 56, Doi: 50, Fillrate: 75, Assortment: 68 }, // spike
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

  // --------------------------------------------------
  // COMPETITION BLOCK (UNCHANGED)
  // --------------------------------------------------
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
      { id: "Doi", label: "Doi", type: "metric", group: "Impressions" },
      { id: "Fillrate", label: "Fillrate", type: "metric", group: "Impressions" },
      { id: "Assortment", label: "Assortment", type: "metric", group: "Impressions" },
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
      {
        brand: "Listerine",
        Osa: { value: 4.3, delta: 0.6 },
        Doi: { value: 91.8, delta: 6.5 },
        Fillrate: { value: 2.8, delta: 0.6 },
        Assortment: { value: 3.1, delta: 1.2 },
      },
      {
        brand: "Closeup",
        Osa: { value: 3.6, delta: 0.2 },
        Doi: { value: 90.9, delta: 8.9 },
        Fillrate: { value: 6.5, delta: 3.0 },
        Assortment: { value: 13.8, delta: 4.9 },
      },
      {
        brand: "Perfora",
        Osa: { value: 3.6, delta: -0.7 },
        Doi: { value: 89.8, delta: 2.5 },
        Fillrate: { value: 4.7, delta: 1.7 },
        Assortment: { value: 4.7, delta: -1.4 },
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
  Dec: 11
};

const RANGE_TO_DAYS = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365
};

const parseTrendDate = (label) => {
  // "06 Sep'25"
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
          boxShadow: "0 1px 3px rgba(15,23,42,0.15)"
        }
      }
    }}
  >
    {options.map((opt) => (
      <ToggleButton key={opt} value={opt}>
        <Typography variant="body2">{opt}</Typography>
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

const MetricChip = ({ active, label, color, onClick }) => (
  <Chip
    label={
      <Box display="flex" alignItems="center" gap={1}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "999px",
            backgroundColor: color
          }}
        />
        <Typography variant="body2">{label}</Typography>
      </Box>
    }
    onClick={onClick}
    variant={active ? "filled" : "outlined"}
    sx={{
      borderRadius: "999px",
      backgroundColor: active ? "#EFF6FF" : "white",
      borderColor: active ? "#3B82F6" : "#E5E7EB",
      "& .MuiChip-label": { px: 1.5, py: 0.25 }
    }}
  />
);

/**
 * ---------------------------------------------------------------------------
 * MAIN COMPONENT
 * ---------------------------------------------------------------------------
 */

export default function TrendsCompetitionDrawer({
  open = true,
  onClose = () => {},
  // compMeta,
  selectedColumn
}) {
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

  // competition filter states
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [metricFilter, setMetricFilter] = useState("estCategoryShare");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [deltaSign, setDeltaSign] = useState("all"); // all | positive | negative

  const trendMeta = DASHBOARD_DATA.trends;
  const compMeta = DASHBOARD_DATA.competition;

  const trendPoints = useMemo(() => {
    const enriched = trendMeta.points.map((p) => ({
      ...p,
      _dateObj: parseTrendDate(p.date)
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
    const leftMetrics = trendMeta.metrics.filter(
      (m) => activeMetrics.includes(m.id) && m.axis === "left"
    );
    const rightMetrics = trendMeta.metrics.filter(
      (m) => activeMetrics.includes(m.id) && m.axis === "right"
    );

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
        lineStyle: {
          width: 2
        },
        emphasis: { focus: "series" },
        data: trendPoints.map((p) => p[m.id] ?? null),
        itemStyle: {
          color: m.color
        }
      }));

    return {
      grid: { left: 60, right: 80, top: 32, bottom: 40 },
      tooltip: {
        trigger: "axis"
      },
      xAxis: {
        type: "category",
        data: xData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#E5E7EB" } },
        axisLabel: { fontSize: 11 }
      },
      yAxis: [
        {
          type: "value",
          position: "left",
          name:
            leftMetrics.length === 1
              ? leftMetrics[0].unit
              : leftMetrics.map((m) => m.unit).join(""),
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#F3F4F6" } }
        },
        {
          type: "value",
          position: "right",
          name: rightMetrics.length ? rightMetrics[0].unit : "",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          min: 0,
          max: 100
        }
      ],
      legend: { show: false },
      series
    };
  }, [trendMeta, activeMetrics, trendPoints]);

  const metricColumns = useMemo(
    () => compMeta.columns.filter((c) => c.type === "metric"),
    [compMeta]
  );

  const competitionRows = useMemo(() => {
    const baseRows =
      compTab === "Brands" ? compMeta.brands : compMeta.skus || compMeta.brands;

    return baseRows
      .filter((r) =>
        search.trim()
          ? r.brand.toLowerCase().includes(search.toLowerCase())
          : true
      )
      .filter((r) => {
        const metricKey = metricFilter;
        const metric = r[metricKey];

        if (!metric) return true;

        const value = metric.value;
        const delta = metric.delta;

        // value range filter
        if (valueMin !== "" && !isNaN(parseFloat(valueMin))) {
          if (value < parseFloat(valueMin)) return false;
        }
        if (valueMax !== "" && !isNaN(parseFloat(valueMax))) {
          if (value > parseFloat(valueMax)) return false;
        }

        // delta sign filter
        if (deltaSign === "positive" && delta <= 0) return false;
        if (deltaSign === "negative" && delta >= 0) return false;

        return true;
      });
  }, [
    compMeta,
    compTab,
    search,
    metricFilter,
    valueMin,
    valueMax,
    deltaSign
  ]);

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
        overflow: "auto"
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
          gap: 2
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
                  color: "#fff"
                }
              }
            }}
          >
            <ToggleButton value="Trends">Trends</ToggleButton>
            <ToggleButton value="Competition">Competition</ToggleButton>
          </ToggleButtonGroup>

          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </Box>

        {/* CONTENT */}
        {view === "Trends" && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="h6" fontWeight={600}>
                {selectedColumn}
              </Typography>
              <Typography variant="body2">at</Typography>
              <Chip
                size="small"
                label={trendMeta.context.level}
                sx={{
                  borderRadius: "999px",
                  backgroundColor: "#DCFCE7",
                  color: "#166534",
                  fontWeight: 500
                }}
              />
              <Typography variant="body2">for</Typography>
              <Chip
                size="small"
                label={trendMeta.context.audience}
                sx={{
                  borderRadius: "999px",
                  backgroundColor: "#E0F2FE",
                  color: "#075985",
                  fontWeight: 500
                }}
              />
            </Box>

            {/* Range + timestep */}
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

            {/* Chart card */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid #E5E7EB",
                mt: 1,
                p: 2.5
              }}
            >
              {/* Metric toggles row */}
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                flexWrap="wrap"
                mb={2}
              >
                <Box display="flex" gap={1} flexWrap="wrap">
                  {trendMeta.metrics.slice(0, 4).map((m) => (
                    <MetricChip
                      key={m.id}
                      label={m.label}
                      color={m.color}
                      active={activeMetrics.includes(m.id)}
                      onClick={() => {
                        setActiveMetrics((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((x) => x !== m.id)
                            : [...prev, m.id]
                        );
                      }}
                    />
                  ))}
                </Box>

                <Button
                  size="small"
                  endIcon={<ChevronDown size={14} />}
                  sx={{
                    textTransform: "none",
                    borderRadius: "999px",
                    borderColor: "#E5E7EB"
                  }}
                  variant="outlined"
                  onClick={() => {
                    const extraIds = trendMeta.metrics.slice(4).map((m) => m.id);
                    setActiveMetrics((prev) => {
                      const hasAnyExtra = prev.some((id) =>
                        extraIds.includes(id)
                      );
                      if (hasAnyExtra) {
                        return prev.filter((id) => !extraIds.includes(id));
                      }
                      return [...prev, ...extraIds];
                    });
                  }}
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

        {view === "Competition" && (
          <Box display="flex" flexDirection="column" gap={2}>
            {/* header line */}
            <Box display="flex" justifyContent="space-between" gap={2}>
              <Box display="flex" flexDirection="column" gap={1}>
                <Tabs
                  value={compTab}
                  onChange={(_, v) => setCompTab(v)}
                  sx={{
                    minHeight: 0,
                    "& .MuiTab-root": {
                      textTransform: "none",
                      minHeight: 0,
                      fontSize: 14
                    }
                  }}
                >
                  <Tab value="Brands" label="Brands" />
                  <Tab value="SKUs" label="SKUs" />
                </Tabs>
                <Box display="flex" alignItems="center" gap={1.25}>
                  <Typography variant="h6" fontWeight={600}>
                    Competition Benchmarking
                  </Typography>
                  <Typography variant="body2">at</Typography>
                  <Chip
                    size="small"
                    label={compMeta.context.level}
                    sx={{
                      borderRadius: "999px",
                      backgroundColor: "#DCFCE7",
                      color: "#166534",
                      fontWeight: 500
                    }}
                  />
                  <Typography variant="body2">for</Typography>
                  <Chip
                    size="small"
                    label={compMeta.context.region}
                    sx={{
                      borderRadius: "999px",
                      backgroundColor: "#E0F2FE",
                      color: "#075985",
                      fontWeight: 500
                    }}
                  />
                </Box>
              </Box>

              {/* right side controls */}
              <Box
                display="flex"
                flexDirection="column"
                alignItems="flex-end"
                gap={1}
              >
                <PillToggleGroup
                  value={periodMode}
                  onChange={setPeriodMode}
                  options={[
                    compMeta.periodToggle.primary,
                    `vs ${compMeta.periodToggle.compare}`
                  ]}
                />
              </Box>
            </Box>

            {/* Filters + search */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap={2}
              flexWrap="wrap"
            >
              <Box display="flex" gap={1.5} alignItems="center">
                {/* <Button
                  variant="outlined"
                  startIcon={<Filter size={14} />}
                  sx={{
                    textTransform: "none",
                    borderRadius: "999px",
                    borderColor: "#E5E7EB"
                  }}
                  onClick={() => setFiltersOpen((prev) => !prev)}
                >
                  Filters
                </Button> */}
                <Button
                  variant="outlined"
                  startIcon={<Filter size={14} />}
                  sx={{
                    textTransform: "none",
                    borderRadius: "999px",
                    borderColor: "#E5E7EB"
                  }}
                  onClick={() => setFiltersOpen((prev) => !prev)}
                >
                  Add sku
                </Button>
              </Box>
              <Box display="flex" gap={1.5} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} />
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </Box>

            {/* Filters panel */}
            {/* {filtersOpen && (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 2,
                  border: "1px solid #E5E7EB",
                  p: 2,
                  backgroundColor: "#F9FAFB"
                }}
              >
                <Box
                  display="flex"
                  flexWrap="wrap"
                  alignItems="center"
                  gap={2}
                >
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
                    >
                      Metric
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={metricFilter}
                      onChange={(_, val) => val && setMetricFilter(val)}
                      sx={{
                        "& .MuiToggleButton-root": {
                          textTransform: "none",
                          borderRadius: "999px",
                          px: 1.5,
                          py: 0.25,
                          border: "1px solid #E5E7EB",
                          "&.Mui-selected": {
                            backgroundColor: "#0F172A",
                            color: "#fff",
                            borderColor: "#0F172A"
                          }
                        }
                      }}
                    >
                      {metricColumns.map((col) => (
                        <ToggleButton key={col.id} value={col.id}>
                          <Typography variant="caption">
                            {col.label}
                          </Typography>
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>

                  <Box display="flex" gap={1.5} alignItems="center">
                    <TextField
                      label="Min %"
                      size="small"
                      type="number"
                      value={valueMin}
                      onChange={(e) => setValueMin(e.target.value)}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                    <TextField
                      label="Max %"
                      size="small"
                      type="number"
                      value={valueMax}
                      onChange={(e) => setValueMax(e.target.value)}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </Box>

                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
                    >
                      Change vs prev
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={deltaSign}
                      onChange={(_, val) => val && setDeltaSign(val)}
                      sx={{
                        "& .MuiToggleButton-root": {
                          textTransform: "none",
                          borderRadius: "999px",
                          px: 1.5,
                          py: 0.25,
                          border: "1px solid #E5E7EB",
                          "&.Mui-selected": {
                            backgroundColor: "#0F172A",
                            color: "#fff",
                            borderColor: "#0F172A"
                          }
                        }
                      }}
                    >
                      <ToggleButton value="all">
                        <Typography variant="caption">All</Typography>
                      </ToggleButton>
                      <ToggleButton value="positive">
                        <Typography variant="caption">Positive</Typography>
                      </ToggleButton>
                      <ToggleButton value="negative">
                        <Typography variant="caption">Negative</Typography>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <Box flexGrow={1} textAlign="right">
                    <Button
                      size="small"
                      sx={{ textTransform: "none" }}
                      onClick={() => {
                        setValueMin("");
                        setValueMax("");
                        setDeltaSign("all");
                        setMetricFilter("estCategoryShare");
                      }}
                    >
                      Clear
                    </Button>
                  </Box>
                </Box>
              </Paper>
            )} */}

<AddSkuDrawer 
  open={filtersOpen} 
  onClose={() => setFiltersOpen(false)} 
/>


            {/* Table */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid #E5E7EB",
                overflow: "hidden"
              }}
            >
              <TableContainer sx={{ maxHeight: 480 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {compMeta.columns.map((col) => (
                        <TableCell
                          key={col.id}
                          sx={{
                            backgroundColor: "#F9FAFB",
                            borderBottom: "1px solid #E5E7EB",
                            fontWeight: 600,
                            fontSize: 12
                          }}
                        >
                          {col.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {competitionRows.map((row) => (
                      <TableRow
                        key={row.brand}
                        hover
                        sx={{
                          "&:nth-of-type(odd)": {
                            backgroundColor: "#F9FAFB"
                          }
                        }}
                      >
                        {compMeta.columns.map((col) => {
                          if (col.type === "text") {
                            return (
                              <TableCell
                                key={col.id}
                                sx={{ fontSize: 13, fontWeight: 500 }}
                              >
                                {row[col.id]}
                              </TableCell>
                            );
                          }
                          const metric = row[col.id];
                          if (!metric) {
                            return (
                              <TableCell key={col.id} sx={{ fontSize: 13 }}>
                                –
                              </TableCell>
                            );
                          }
                          const value = metric.value;
                          const delta = metric.delta;
                          const isPositive = delta >= 0;
                          return (
                            <TableCell key={col.id} sx={{ fontSize: 13 }}>
                              <Box
                                display="flex"
                                flexDirection="column"
                                alignItems="flex-start"
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 500 }}
                                >
                                  {value.toFixed(1)}%
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: isPositive ? "#16A34A" : "#DC2626"
                                  }}
                                >
                                  {isPositive ? "+" : ""}
                                  {delta.toFixed(1)}%
                                </Typography>
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
}
