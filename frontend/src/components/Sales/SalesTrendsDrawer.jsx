// TrendsCompetitionDrawer.jsx
import React, {
    useState,
    useMemo,
    useEffect,
    useRef,
} from "react";
import { fetchSalesTrends, fetchSalesFilterOptions } from "../../api/salesService";
import dayjs from "dayjs";
import {
    Box,
    Typography,
    IconButton,
    Button,
    Chip,
    ToggleButtonGroup,
    ToggleButton,
    Paper,
    Select,
    MenuItem,
    CircularProgress
} from "@mui/material";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import ReactECharts from "echarts-for-react";
import AddSkuDrawer from "../AllAvailablityAnalysis/AddSkuDrawer";

/**
 * ---------------------------------------------------------------------------
 * JSON DATA
 * ---------------------------------------------------------------------------
 */

const BRAND_COLORS = {
    Colgate: "#EF4444",
    Sensodyne: "#8B5CF6",
    Dabur: "#22C55E",
    Pepsodent: "#0EA5E9",
    Closeup: "#F97316",
};

const COMPARE_X = [
    "01 Sep", "02 Sep", "03 Sep", "04 Sep", "05 Sep", "06 Sep", "07 Sep", "08 Sep", "09 Sep", "10 Sep",
];

const DASHBOARD_DATA = {
    trends: {
        rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
        defaultRange: "1M",
        timeSteps: ["Daily", "Weekly", "Monthly"],
        defaultTimeStep: "Daily",
        metrics: [
            { id: "overall_sales", label: "Overall Sales", color: "#2563EB", axis: "left", default: true },
            { id: "mtd_sales", label: "MTD Sales", color: "#16A34A", axis: "left", default: true },
            { id: "current_drr", label: "Current DRR", color: "#F97316", axis: "right", default: false },
            { id: "projected_sales", label: "Projected Sales", color: "#7C3AED", axis: "left", default: false },
        ],
        points: [], // Fallback
    },
    compareSkus: {
        rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
        metrics: [
            { id: "overall_sales", label: "Overall Sales", color: "#2563EB", default: true },
            { id: "mtd_sales", label: "MTD Sales", color: "#16A34A", default: true },
            { id: "current_drr", label: "Current DRR", color: "#F97316", default: false },
            { id: "projected_sales", label: "Projected Sales", color: "#7C3AED", default: false },
        ],
        x: COMPARE_X,
        trendsBySku: {},
    }
};

/**
 * ---------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------------
 */

const MONTH_MAP = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const RANGE_TO_DAYS = {
    "1M": 30, "3M": 90, "6M": 180, "1Y": 365,
};

const parseTrendDate = (label) => {
    if (!label) return new Date();
    try {
        if (label.includes('-')) return new Date(label);
        const parts = label.split(" ");
        if (parts.length < 2) return new Date(label);
        const day = parseInt(parts[0], 10);
        const [monthStr, yearStr] = parts[1].split("'");
        const month = MONTH_MAP[monthStr] ?? 0;
        const year = 2000 + (parseInt(yearStr, 10) || 0);
        return new Date(year, month, day);
    } catch (e) {
        return new Date();
    }
};

const PillToggleGroup = ({ value, onChange, options }) => (
    <ToggleButtonGroup
        exclusive
        value={value}
        onChange={(_, val) => val && onChange(val)}
        sx={{
            backgroundColor: "#F3F4F6", borderRadius: "999px", p: "2px",
            "& .MuiToggleButton-root": {
                textTransform: "none", border: "none", px: 2.5, py: 0.5, borderRadius: "999px",
                "&.Mui-selected": { backgroundColor: "#ffffff", boxShadow: "0 1px 3px rgba(15,23,42,0.15)" },
            },
        }}
    >
        {options.map((opt) => (<ToggleButton key={opt} value={opt}><Typography variant="body2">{opt}</Typography></ToggleButton>))}
    </ToggleButtonGroup>
);

const MetricChip = ({ label, color, active, onClick }) => (
    <Box
        onClick={onClick}
        sx={{
            display: "flex", alignItems: "center", gap: 0.8, px: 1.5, py: 0.6, borderRadius: "999px",
            cursor: "pointer", border: `1px solid ${active ? color : "#E5E7EB"}`,
            backgroundColor: active ? `${color}20` : "white", color: active ? color : "#0f172a",
            fontSize: "12px", fontWeight: 600, userSelect: "none", transition: "all 0.15s ease",
        }}
    >
        <Box sx={{
            width: 14, height: 14, borderRadius: 3, border: `2px solid ${active ? color : "#CBD5E1"}`,
            backgroundColor: active ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10,
        }}>
            {active && "✓"}
        </Box>
        {label}
    </Box>
);

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
        return () => { clearTimeout(timer); window.removeEventListener("resize", checkScroll); };
    }, [children]);
    return (
        <Box sx={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
            {showLeft && (
                <IconButton size="small" onClick={() => scrollRef.current.scrollBy({ left: -300, behavior: "smooth" })} sx={{ position: "absolute", left: 0, zIndex: 2, bgcolor: "white" }}>
                    <ChevronLeft size={16} />
                </IconButton>
            )}
            <Box ref={scrollRef} onScroll={checkScroll} sx={{ display: "flex", flexWrap: "nowrap", gap: 1.5, overflowX: "auto", width: "100%", pb: 1, pt: 0.5, px: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
                {children}
            </Box>
            {showRight && (
                <IconButton size="small" onClick={() => scrollRef.current.scrollBy({ left: 300, behavior: "smooth" })} sx={{ position: "absolute", right: 0, zIndex: 2, bgcolor: "white" }}>
                    <ChevronRight size={16} />
                </IconButton>
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
    open = true,
    onClose = () => { },
    selectedColumn,
    startDate,
    endDate,
    platform,
    brand,
    location,
    category,
}) {
    // 1. All Hooks at the top
    const [trendData, setTrendData] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [options, setOptions] = useState({ platforms: [], brands: [], categories: [], locations: [] });

    const [selectedPlatform, setSelectedPlatformState] = useState(platform || "All");
    const [selectedCategory, setSelectedCategory] = useState(category || "All");
    const [selectedBrandState, setSelectedBrandState] = useState(brand || "All");
    const [selectedLocationState, setSelectedLocationState] = useState(location || "All");
    const [filterType, setFilterType] = useState("Platform");

    const [view, setView] = useState("Trends");
    const [range, setRange] = useState(startDate && endDate ? "Custom" : DASHBOARD_DATA.trends.defaultRange);
    const [timeStep, setTimeStep] = useState(DASHBOARD_DATA.trends.defaultTimeStep);
    const [activeMetrics, setActiveMetrics] = useState(
        DASHBOARD_DATA.trends.metrics.filter((m) => m.default).map((m) => m.id)
    );

    // Custom Date states
    const [customStartDate, setCustomStartDate] = useState(startDate || dayjs().subtract(30, 'day').format("YYYY-MM-DD"));
    const [customEndDate, setCustomEndDate] = useState(endDate || dayjs().format("YYYY-MM-DD"));

    const [showPlatformPills, setShowPlatformPills] = useState(true);
    const [selectedCompareSkus, setSelectedCompareSkus] = useState([]);
    const [addSkuOpen, setAddSkuOpen] = useState(false);

    // 2. Effects
    useEffect(() => { if (platform) setSelectedPlatformState(platform); }, [platform]);
    useEffect(() => { if (brand) setSelectedBrandState(brand); }, [brand]);
    useEffect(() => { if (location) setSelectedLocationState(location); }, [location]);
    useEffect(() => { if (category) setSelectedCategory(category); }, [category]);

    useEffect(() => {
        const loadOptions = async () => {
            try {
                const data = await fetchSalesFilterOptions({
                    platform: selectedPlatform,
                    brand: selectedBrandState,
                    location: selectedLocationState
                });
                setOptions(data);
            } catch (e) { console.error(e); }
        };
        loadOptions();
    }, [selectedPlatform, selectedBrandState, selectedLocationState]);

    useEffect(() => {
        if (open) {
            const loadTrends = async () => {
                setFetching(true);
                try {
                    let effStartDate = startDate;
                    let effEndDate = endDate;

                    if (range !== "Custom" && RANGE_TO_DAYS[range]) {
                        const days = RANGE_TO_DAYS[range];
                        // Anchor to the dashboard's end date if available, otherwise use today
                        const anchorDate = endDate ? dayjs(endDate) : dayjs();
                        effEndDate = anchorDate.format("YYYY-MM-DD");
                        effStartDate = anchorDate.subtract(days, 'day').format("YYYY-MM-DD");
                    } else if (range === "Custom") {
                        effStartDate = customStartDate;
                        effEndDate = customEndDate;
                    }

                    const data = await fetchSalesTrends({
                        startDate: effStartDate,
                        endDate: effEndDate,
                        platform: selectedPlatform === "All" ? "" : selectedPlatform,
                        brand: selectedBrandState === "All" ? "" : selectedBrandState,
                        location: selectedLocationState === "All" ? "" : selectedLocationState,
                        category: selectedCategory === "All" ? "" : selectedCategory
                    });
                    setTrendData(data);
                } catch (e) { console.error(e); } finally { setFetching(false); }
            };
            loadTrends();
        }
    }, [open, startDate, endDate, selectedPlatform, selectedBrandState, selectedLocationState, selectedCategory, range, customStartDate, customEndDate]);

    useEffect(() => {
        if (selectedColumn) {
            const mapping = {
                "MTD SALES": "mtd_sales", "PREV MONTH MTD": "mtd_sales", "CURRENT DRR": "current_drr",
                "YTD SALES": "overall_sales", "LAST YEAR SALES": "overall_sales", "PROJECTED SALES": "projected_sales"
            };
            const metricId = mapping[selectedColumn.toUpperCase()];
            setActiveMetrics([metricId || "overall_sales"]);
        }
    }, [selectedColumn]);

    // 3. Memos
    const trendMeta = DASHBOARD_DATA.trends;
    const compareMeta = DASHBOARD_DATA.compareSkus;

    const trendPoints = useMemo(() => {
        const sorted = [...trendData].map(p => ({ ...p, _dateObj: parseTrendDate(p.date) }))
            .sort((a, b) => a._dateObj.getTime() - b._dateObj.getTime());

        let baseData = sorted;

        if (timeStep === "Daily") return baseData.map(({ _dateObj, ...rest }) => rest);

        const aggregated = {};
        baseData.forEach(p => {
            const d = dayjs(p._dateObj);
            const key = timeStep === "Weekly" ? d.startOf("week").format("YYYY-MM-DD") : d.startOf("month").format("YYYY-MM-DD");
            if (!aggregated[key]) {
                aggregated[key] = {
                    date: timeStep === "Weekly" ? d.startOf("week").format("DD MMM'YY") : d.startOf("month").format("MMM'YY"),
                    overall_sales: 0, lastPoint: p
                };
            }
            aggregated[key].overall_sales += p.overall_sales || 0;
            aggregated[key].lastPoint = p;
        });

        return Object.values(aggregated).map(group => ({
            date: group.date,
            overall_sales: parseFloat(group.overall_sales.toFixed(2)),
            mtd_sales: group.lastPoint.mtd_sales,
            current_drr: group.lastPoint.current_drr,
            projected_sales: group.lastPoint.projected_sales
        }));
    }, [trendData, timeStep]);

    const trendOption = useMemo(() => {
        return {
            grid: { left: 60, right: 80, top: 32, bottom: 40 },
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: trendPoints.map(p => p.date), boundaryGap: false },
            yAxis: [
                {
                    type: "value",
                    position: "left",
                    splitLine: { lineStyle: { color: "#F3F4F6" } },
                    axisLabel: {
                        formatter: (val) => {
                            if (val >= 10000000) return (val / 10000000).toFixed(1) + "Cr";
                            if (val >= 100000) return (val / 100000).toFixed(1) + "L";
                            if (val >= 1000) return (val / 1000).toFixed(1) + "K";
                            return val;
                        }
                    }
                },
                {
                    type: "value",
                    position: "right",
                    splitLine: { show: false },
                    axisLabel: {
                        formatter: (val) => {
                            if (val >= 10000000) return (val / 10000000).toFixed(1) + "Cr";
                            if (val >= 100000) return (val / 100000).toFixed(1) + "L";
                            if (val >= 1000) return (val / 1000).toFixed(1) + "K";
                            return val;
                        }
                    }
                },
            ],
            series: trendMeta.metrics.filter(m => activeMetrics.includes(m.id)).map(m => ({
                name: m.label, type: "line", smooth: true, symbol: "circle", symbolSize: 6,
                yAxisIndex: m.axis === "right" ? 1 : 0, data: trendPoints.map(p => p[m.id] ?? null),
                itemStyle: { color: m.color },
            })),
        };
    }, [trendPoints, activeMetrics, trendMeta]);

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
                    mt: { xs: 2, md: 4 },
                    width: "min(1200px, 100%)",
                    bgcolor: "white",
                    borderRadius: 3,
                    boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
                    p: { xs: 2, md: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                {/* Header row */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <ToggleButtonGroup exclusive value={view} onChange={(_, v) => v && setView(v)} sx={{ backgroundColor: "#F3F4F6", borderRadius: "999px", p: "3px", "& .MuiToggleButton-root": { textTransform: "none", border: "none", borderRadius: "999px", px: 2.5, py: 0.75, "&.Mui-selected": { backgroundColor: "#0F172A", color: "#fff" } } }}>
                        <ToggleButton value="Trends">Trends</ToggleButton>
                    </ToggleButtonGroup>
                    <IconButton onClick={onClose} size="small"><X size={18} /></IconButton>
                </Box>
                {view === "Trends" && (
                    <Box display="flex" flexDirection="column" gap={2}>
                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                            <Typography variant="h6" fontWeight={600}>{selectedColumn || "KPI Trends"}</Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Select size="small" value={filterType} onChange={(e) => setFilterType(e.target.value)} sx={{ minWidth: 120, borderRadius: 2 }}>
                                    <MenuItem value="Platform">Platform</MenuItem>
                                    <MenuItem value="Format">Format</MenuItem>
                                    <MenuItem value="Brand">Brand</MenuItem>
                                    <MenuItem value="City">City</MenuItem>
                                </Select>
                                <Box sx={{ flex: 1, minWidth: 0, maxWidth: '600px' }}>
                                    <ScrollRow>
                                        {(filterType === "Platform" ? PLATFORM_OPTIONS : filterType === "Format" ? FORMAT_OPTIONS : filterType === "City" ? CITY_OPTIONS : BRAND_OPTIONS).map(p => {
                                            const isSelected = filterType === "Platform" ? selectedPlatform === p : filterType === "Format" ? selectedCategory === p : filterType === "City" ? selectedLocationState === p : selectedBrandState === p;
                                            return (
                                                <Box key={p} onClick={() => { if (filterType === "Platform") setSelectedPlatformState(p); else if (filterType === "Format") setSelectedCategory(p); else if (filterType === "City") setSelectedLocationState(p); else setSelectedBrandState(p); }} sx={{ px: 2, py: 0.8, borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: 'nowrap', border: isSelected ? "1px solid #0ea5e9" : "1px solid #E5E7EB", backgroundColor: isSelected ? "#0ea5e9" : "white", color: isSelected ? "white" : "#0f172a" }}>
                                                    {p}
                                                </Box>
                                            );
                                        })}
                                    </ScrollRow>
                                </Box>
                            </Box>
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                <PillToggleGroup value={range} onChange={setRange} options={trendMeta.rangeOptions} />

                                {range === "Custom" && (
                                    <Box display="flex" alignItems="center" gap={1} sx={{ ml: 1 }}>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            style={{
                                                padding: '4px 8px',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                outline: 'none'
                                            }}
                                        />
                                        <Typography variant="caption" color="text.secondary">to</Typography>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            style={{
                                                padding: '4px 8px',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                outline: 'none'
                                            }}
                                        />
                                    </Box>
                                )}
                            </Box>

                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="body2">Time Step:</Typography>
                                <PillToggleGroup value={timeStep} onChange={setTimeStep} options={trendMeta.timeSteps} />
                            </Box>
                        </Box>
                        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid #E5E7EB", p: 2.5 }}>
                            <Box display="flex" gap={1} overflow="auto" mb={2}>
                                {trendMeta.metrics.map(m => (
                                    <MetricChip key={m.id} label={m.label} color={m.color} active={activeMetrics.includes(m.id)} onClick={() => setActiveMetrics(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} />
                                ))}
                            </Box>
                            <Box sx={{ height: 340 }}>
                                {fetching ? (<Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress size={40} /></Box>) : (<ReactECharts style={{ height: "100%", width: "100%" }} option={trendOption} notMerge />)}
                            </Box>
                        </Paper>
                    </Box>
                )}
            </Box>
            <AddSkuDrawer open={addSkuOpen} onClose={() => setAddSkuOpen(false)} onApply={(ids) => { setSelectedCompareSkus(ids.map(id => ({ id, name: `SKU ${id}` }))); setAddSkuOpen(false); }} />
        </Box>
    );
}
