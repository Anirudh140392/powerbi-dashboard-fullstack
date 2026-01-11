// TrendsCompetitionDrawer.jsx
import React, {
    useState,
    useMemo,
    useEffect,
    useRef,
    useLayoutEffect,
    useContext,
} from "react";
import { fetchSalesTrends, fetchSalesFilterOptions } from "../../api/salesService";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";
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
import { ChevronDown, ChevronLeft, ChevronRight, X, Search, Plus } from "lucide-react";
import ReactECharts from "echarts-for-react";
import KpiTrendShowcase from "../AllAvailablityAnalysis/KpiTrendShowcase";
import AddSkuDrawer from "../AllAvailablityAnalysis/AddSkuDrawer";
// import VisibilityKpiTrendShowcase from "./VisibilityKpiTrendShowcase";

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

        // ⭐ SALES KPIs (as per screenshot)
        metrics: [
            {
                id: "overall_sales",
                label: "Overall Sales",
                color: "#2563EB",
                axis: "left",
                default: true,
            },
            {
                id: "mtd_sales",
                label: "MTD Sales",
                color: "#16A34A",
                axis: "left",
                default: true,
            },
            {
                id: "current_drr",
                label: "Current DRR",
                color: "#F97316",
                axis: "right",
                default: false,
            },
            {
                id: "projected_sales",
                label: "Projected Sales",
                color: "#7C3AED",
                axis: "left",
                default: false,
            },
        ],

        // ⭐ Trend points converted to Sales
        points: [
            {
                date: "06 Sep'25",
                overall_sales: 18.2,
                mtd_sales: 6.4,
                current_drr: 0.62,
                projected_sales: 18.6,
            },
            {
                date: "07 Sep'25",
                overall_sales: 18.0,
                mtd_sales: 6.7,
                current_drr: 0.64,
                projected_sales: 18.9,
            },
            {
                date: "08 Sep'25",
                overall_sales: 17.8,
                mtd_sales: 7.1,
                current_drr: 0.66,
                projected_sales: 19.3,
            },
            {
                date: "09 Sep'25",
                overall_sales: 17.6,
                mtd_sales: 7.5,
                current_drr: 0.68,
                projected_sales: 19.8,
            },
            {
                date: "10 Sep'25",
                overall_sales: 17.4,
                mtd_sales: 7.9,
                current_drr: 0.70,
                projected_sales: 20.2,
            },
            {
                date: "11 Sep'25",
                overall_sales: 17.3,
                mtd_sales: 8.2,
                current_drr: 0.72,
                projected_sales: 20.6,
            },
            {
                date: "12 Sep'25",
                overall_sales: 17.2,
                mtd_sales: 8.6,
                current_drr: 0.74,
                projected_sales: 21.1,
            },
        ],
    },

    // ⭐ Compare SKUs – Sales KPIs
    compareSkus: {
        context: { level: "MRP" },
        rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
        defaultRange: "1M",
        timeSteps: ["Daily", "Weekly", "Monthly"],
        defaultTimeStep: "Daily",

        metrics: [
            {
                id: "overall_sales",
                label: "Overall Sales",
                color: "#2563EB",
                default: true,
            },
            {
                id: "mtd_sales",
                label: "MTD Sales",
                color: "#16A34A",
                default: true,
            },
            {
                id: "current_drr",
                label: "Current DRR",
                color: "#F97316",
                default: false,
            },
            {
                id: "projected_sales",
                label: "Projected Sales",
                color: "#7C3AED",
                default: false,
            },
        ],

        x: COMPARE_X,

        trendsBySku: {
            1: makeSkuTrend(0.2, 0.1, 0.02, 0.3),
            2: makeSkuTrend(-0.1, 0.2, 0.01, 0.4),
            3: makeSkuTrend(-0.3, -0.1, -0.01, 0.2),
            4: makeSkuTrend(0.4, 0.3, 0.04, 0.6),
        },
    },

    // ⭐ Competition View – Sales
    competition: {
        context: { level: "MRP", region: "All × Chennai" },

        tabs: ["Brands", "SKUs"],

        periodToggle: {
            primary: "MTD",
            compare: "Previous Month",
        },

        columns: [
            { id: "brand", label: "Brand", type: "text" },
            { id: "overall_sales", label: "Overall Sales (₹ Cr)", type: "metric" },
            { id: "mtd_sales", label: "MTD Sales (₹ Cr)", type: "metric" },
            { id: "current_drr", label: "Current DRR (₹ Cr)", type: "metric" },
            { id: "projected_sales", label: "Projected Sales (₹ Cr)", type: "metric" },
        ],

        brands: [
            {
                brand: "Colgate",
                overall_sales: { value: 18.4, delta: -1.2 },
                mtd_sales: { value: 8.9, delta: 0.6 },
                current_drr: { value: 0.74, delta: 0.03 },
                projected_sales: { value: 21.2, delta: 1.1 },
            },
            {
                brand: "Sensodyne",
                overall_sales: { value: 15.6, delta: 0.8 },
                mtd_sales: { value: 7.4, delta: 0.5 },
                current_drr: { value: 0.69, delta: 0.02 },
                projected_sales: { value: 19.8, delta: 0.9 },
            },
        ],

        skus: [
            {
                brand: "Colgate Strong Teeth 100g",
                overall_sales: { value: 4.2, delta: -0.3 },
                mtd_sales: { value: 2.1, delta: 0.2 },
                current_drr: { value: 0.18, delta: 0.01 },
                projected_sales: { value: 5.0, delta: 0.4 },
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
 * SCROLL ROW COMPONENT
 * ---------------------------------------------------------------------------
 */
const ScrollRow = ({ children }) => {
    const scrollRef = useRef(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(false);

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setShowLeft(scrollLeft > 10);
            setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        const timer = setTimeout(checkScroll, 100);
        window.addEventListener("resize", checkScroll);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", checkScroll);
        };
    }, [children]);

    const handleScroll = (dir) => {
        if (scrollRef.current) {
            const amount = dir === "left" ? -300 : 300;
            scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
        }
    };

    return (
        <Box sx={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
            {/* Left Fade + Arrow */}
            {showLeft && (
                <Box
                    sx={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 50,
                        zIndex: 2,
                        background: "linear-gradient(to right, white 20%, transparent)",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <IconButton
                        size="small"
                        onClick={() => handleScroll("left")}
                        sx={{
                            pointerEvents: "auto",
                            bgcolor: "white",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                            border: "1px solid #e2e8f0",
                            "&:hover": { bgcolor: "#f1f5f9" },
                            ml: 0.5
                        }}
                    >
                        <ChevronLeft size={16} />
                    </IconButton>
                </Box>
            )}

            {/* Scroll Area */}
            <Box
                ref={scrollRef}
                onScroll={checkScroll}
                sx={{
                    display: "flex",
                    flexWrap: "nowrap",
                    gap: 1.5,
                    overflowX: "auto",
                    overflowY: "hidden",
                    width: "100%",
                    pb: 1,
                    pt: 0.5,
                    px: 0.5,
                    "&::-webkit-scrollbar": { display: "none" },
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                }}
            >
                {children}
            </Box>

            {/* Right Fade + Arrow */}
            {showRight && (
                <Box
                    sx={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 50,
                        zIndex: 2,
                        background: "linear-gradient(to left, white 20%, transparent)",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                    }}
                >
                    <IconButton
                        size="small"
                        onClick={() => handleScroll("right")}
                        sx={{
                            pointerEvents: "auto",
                            bgcolor: "white",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                            border: "1px solid #e2e8f0",
                            "&:hover": { bgcolor: "#f1f5f9" },
                            mr: 0.5
                        }}
                    >
                        <ChevronRight size={16} />
                    </IconButton>
                </Box>
            )}
        </Box>
    );
};

/**
 * ---------------------------------------------------------------------------
 * MAIN COMPONENT
 * ---------------------------------------------------------------------------
 */

export default function SalesTrendsDrawer({
    dynamicKey = "sales",
    open = true,
    onClose = () => { },
    selectedColumn,
    startDate,
    endDate,
    platform,
    brand,
    location,
}) {
    const [trendData, setTrendData] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [options, setOptions] = useState({ platforms: [], brands: [], categories: [], locations: [] });
    const [selectedPlatform, setSelectedPlatformState] = useState(platform || "All");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedBrandState, setSelectedBrandState] = useState(brand || "All");
    const [selectedLocationState, setSelectedLocationState] = useState(location || "All");
    const [filterType, setFilterType] = useState("Platform");
    const [showAllPills, setShowAllPills] = useState(false);

    useEffect(() => {
        const loadOptions = async () => {
            try {
                const data = await fetchSalesFilterOptions();
                setOptions(data);
            } catch (e) {
                console.error("Failed to fetch filter options:", e);
            }
        };
        loadOptions();
    }, []);

    useEffect(() => {
        if (open) {
            const loadTrends = async () => {
                setFetching(true);
                try {
                    const data = await fetchSalesTrends({
                        startDate,
                        endDate,
                        platform: selectedPlatform === "All" ? "" : selectedPlatform,
                        brand: selectedBrandState === "All" ? "" : selectedBrandState,
                        location: selectedLocationState === "All" ? "" : selectedLocationState,
                        category: selectedCategory === "All" ? "" : selectedCategory
                    });
                    setTrendData(data);
                } catch (e) {
                    console.error("Trends fetch failed:", e);
                } finally {
                    setFetching(false);
                }
            };
            loadTrends();
        }
    }, [open, startDate, endDate, selectedPlatform, selectedBrandState, selectedLocationState, selectedCategory]);
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
    // const [selectedPlatform, setSelectedPlatform] = useState("Blinkit");
    const [showPlatformPills, setShowPlatformPills] = useState(true);

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

    useEffect(() => {
        if (selectedColumn) {
            const mapping = {
                "MTD SALES": "mtd_sales",
                "PREV MONTH MTD": "mtd_sales",
                "CURRENT DRR": "current_drr",
                "YTD SALES": "overall_sales",
                "LAST YEAR SALES": "overall_sales",
                "PROJECTED SALES": "projected_sales"
            };
            const metricId = mapping[selectedColumn.toUpperCase()];
            if (metricId) {
                setActiveMetrics([metricId]);
            } else {
                // Fallback to overall sales if no specific mapping found
                setActiveMetrics(["overall_sales"]);
            }
        }
    }, [selectedColumn]);

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
        const sourceData = trendData.length > 0 ? trendData : trendMeta.points;
        const enriched = sourceData.map((p) => ({
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

    const PLATFORM_OPTIONS = ["All", ...(options.platforms || [])];
    const FORMAT_OPTIONS = ["All", ...(options.categories || [])];
    const CITY_OPTIONS = ["All", ...(options.locations || [])];
    const BRAND_OPTIONS = ["All", ...(options.brands || [])];

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
                                        value={filterType}
                                        onChange={(e) => {
                                            setFilterType(e.target.value);
                                            setShowPlatformPills(true);
                                        }}
                                        sx={{ minWidth: 120, borderRadius: 2, bgcolor: 'white' }}
                                    >
                                        <MenuItem value="Platform">Platform</MenuItem>
                                        <MenuItem value="Format">Format</MenuItem>
                                        <MenuItem value="Brand">Brand</MenuItem>
                                        <MenuItem value="City">City</MenuItem>
                                    </Select>
                                </Typography>

                                {/* DYNAMIC PILLS */}
                                {/* DYNAMIC PILLS */}
                                {showPlatformPills && (
                                    <Box sx={{ flex: 1, minWidth: 0, maxWidth: '600px' }}>
                                        <ScrollRow>
                                            {(filterType === "Platform"
                                                ? PLATFORM_OPTIONS
                                                : filterType === "Format"
                                                    ? FORMAT_OPTIONS
                                                    : filterType === "City"
                                                        ? CITY_OPTIONS
                                                        : filterType === "Brand"
                                                            ? BRAND_OPTIONS
                                                            : []
                                            ).map((p) => {
                                                const isSelected =
                                                    filterType === "Platform" ? selectedPlatform === p :
                                                        filterType === "Format" ? selectedCategory === p :
                                                            filterType === "City" ? selectedLocationState === p :
                                                                filterType === "Brand" ? selectedBrandState === p : false;

                                                return (
                                                    <Box
                                                        key={p}
                                                        onClick={() => {
                                                            if (filterType === "Platform") setSelectedPlatformState(p);
                                                            else if (filterType === "Format") setSelectedCategory(p);
                                                            else if (filterType === "City") setSelectedLocationState(p);
                                                            else if (filterType === "Brand") setSelectedBrandState(p);
                                                        }}
                                                        sx={{
                                                            px: 2,
                                                            py: 0.8,
                                                            borderRadius: "999px",
                                                            fontSize: "12px",
                                                            fontWeight: 600,
                                                            cursor: "pointer",
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0,
                                                            border: isSelected ? "1px solid #0ea5e9" : "1px solid #E5E7EB",
                                                            backgroundColor: isSelected ? "#0ea5e9" : "white",
                                                            color: isSelected ? "white" : "#0f172a",
                                                            transition: 'all 0.2s ease',
                                                            '&:hover': {
                                                                borderColor: '#0ea5e9',
                                                            }
                                                        }}
                                                    >
                                                        {p}
                                                    </Box>
                                                );
                                            })}
                                        </ScrollRow>
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
                                <ScrollRow>
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
                                </ScrollRow>
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
                {/* {view === "Competition" && <VisibilityKpiTrendShowcase />} */}

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
