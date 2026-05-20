import React, { useMemo, useState, useContext, createContext, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";
import {
    Filter,
    LineChart as LineChartIcon,
    BarChart3,
    SlidersHorizontal,
    Info,
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { Box, Tooltip, Typography } from "@mui/material";
import PaginationFooter from "../CommonLayout/PaginationFooter";


/* -------------------------------------------------------------------------- */
/*                               Utility helper                               */
/* -------------------------------------------------------------------------- */

function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}

const formatKpiValue = (value, unit = "%") => {
    if (value === null || value === undefined || value === 0 || value === "0") {
        return "N/A";
    }
    const num = parseFloat(value);
    if (isNaN(num)) return "N/A";
    return `${num.toFixed(1)}${unit}`;
};

const BRAND_COLORS = [
    "#2563EB", // Blue
    "#DC2626", // Red
    "#16A34A", // Green
    "#F97316", // Orange
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#0891B2", // Cyan
    "#84CC16", // Lime
    "#F59E0B", // Amber
    "#6366F1", // Indigo
];

const RANK_OPTIONS = ["Top 10", "Top 20", "Top 30", "Top 40"];

const getBrandColor = (index) => BRAND_COLORS[index % BRAND_COLORS.length];
const KPI_TOOLTIPS = {
    'Organic SOS': "The proportion of a brand’s product visibility within organic (non-paid) search results.\n\nData Refresh: Platform-scraped insights are refreshed daily by 10:00 AM.",
    'Overall SOS': "Share of Search indicates the proportion of attention a product receives relative to others within the same category or type.\n\nData Refresh: Platform-scraped insights are refreshed daily by 10:00 AM.",
    'Sponsored SOS': "The proportion of a brand’s product visibility within sponsored or paid placements in search results.\n\nData Refresh: Platform-scraped insights are refreshed daily by 10:00 AM.",
};


/* -------------------------------------------------------------------------- */
/*                           Small UI components (local)                      */
/* -------------------------------------------------------------------------- */

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

const Separator = ({ orientation = "horizontal", className }) => {
    const base = orientation === "vertical" ? "h-full w-px" : "h-px w-full";
    return <div className={cn("bg-slate-200", base, className)} />;
};

const Input = ({ className, ...props }) => (
    <input
        className={cn(
            "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            className
        )}
        {...props}
    />
);

const Checkbox = ({ checked, onCheckedChange, className }) => (
    <input
        type="checkbox"
        className={cn(
            "h-4 w-4 shrink-0 rounded border border-slate-300 text-blue-600 focus:ring-blue-500",
            className
        )}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
);

const ScrollArea = ({ className, children }) => (
    <div className={cn("overflow-auto", className)}>{children}</div>
);

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
            "rounded-lg bg-white shadow-xl border border-slate-200 overflow-hidden",
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
                "absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden",
                className
            )}
        >
            <div className="max-h-60 overflow-y-auto py-1">{children}</div>
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
/*                             KPI Config                                     */
/* -------------------------------------------------------------------------- */

const KPI_KEYS = [
    {
        key: "overall_sos",
        label: "Overall SOS",
        color: "#2563EB", // blue
        unit: "%",
    },
    {
        key: "sponsored_sos",
        label: "Sponsored SOS",
        color: "#F97316", // orange
        unit: "%",
    },
    {
        key: "organic_sos",
        label: "Organic SOS",
        color: "#16A34A", // green
        unit: "%",
    },
];

/* -------------------------------------------------------------------------- */
/*                               Filter Dialog                                */
/* -------------------------------------------------------------------------- */

const ComingSoonBadge = () => (
    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 shadow-sm">
        Soon
    </span>
);

const FilterDialog = ({ open, onClose, mode, value, onChange, selectedPlatform, city }) => {
    const { selectedChannel } = useContext(FilterContext);
    const [activeTab, setActiveTab] = useState(
        mode === "brand" ? "category" : "sku"
    );
    const [search, setSearch] = useState("");
    const [localValue, setLocalValue] = useState(value);

    // Sync local state when dialog opens
    useEffect(() => {
        if (open) setLocalValue(value);
    }, [open, value]);

    const [filterOptions, setFilterOptions] = useState({
        categories: [],
        brands: [],
        skus: [],
        keywordTypes: [],
        keywords: [],
        loading: false,
        error: null
    });

    useEffect(() => {
        if (!open) return;

        const fetchFilterOptions = async () => {
            setFilterOptions(prev => ({ ...prev, loading: true, error: null }));

            try {
                const params = new URLSearchParams();
                if (selectedChannel && selectedChannel !== 'All') params.append('channel', selectedChannel);
                if (selectedPlatform && selectedPlatform !== 'All') params.append('platform', selectedPlatform);

                // Fetch basic competition filters (Category, Brand, SKU) from watchtower (rb_pdp_olap)
                const watchtowerPromise = axiosInstance.get(`/watchtower/competition-filter-options?${params.toString()}`);
                
                // Fetch Keyword Types and Keywords from rb_kw_olap table
                const keywordTypePromise = axiosInstance.get(`/visibility-analysis/keyword-types?platform=${selectedPlatform || 'All'}`);
                
                const kwParams = new URLSearchParams();
                kwParams.append('platform', selectedPlatform || 'All');
                if (localValue.categories.length) kwParams.append('category', localValue.categories.join(','));
                if (localValue.brands.length) kwParams.append('brand', localValue.brands.join(','));
                const keywordPromise = axiosInstance.get(`/visibility-analysis/keywords?${kwParams.toString()}`);

                const [watchtowerRes, keywordTypeRes, keywordRes] = await Promise.all([
                    watchtowerPromise,
                    keywordTypePromise,
                    keywordPromise
                ]);

                if (watchtowerRes.data) {
                    setFilterOptions({
                        categories: (watchtowerRes.data.categories || []).filter(o => o && o !== 'All'),
                        brands: (watchtowerRes.data.brands || []).filter(o => o && o !== 'All'),
                        skus: (watchtowerRes.data.skuNames || watchtowerRes.data.skus || []).filter(o => o && o !== 'All'),
                        keywordTypes: (keywordTypeRes.data || []).filter(o => o && o !== 'All'),
                        keywords: (keywordRes.data || []).filter(o => o && o !== 'All'),
                        loading: false,
                        error: null
                    });
                }
            } catch (error) {
                console.error('[FilterDialog Visibility] Error fetching filter options:', error);
                setFilterOptions(prev => ({
                    ...prev,
                    loading: false,
                    error: 'Failed to load filter options'
                }));
            }
        };

        fetchFilterOptions();
    }, [open, activeTab, localValue.categories, localValue.brands, selectedPlatform, selectedChannel]);

    const getListForTab = () => {
        if (activeTab === "category") return filterOptions.categories;
        if (activeTab === "brand") return filterOptions.brands;
        if (activeTab === "sku") return filterOptions.skus;
        if (activeTab === "keywordType") return filterOptions.keywordTypes;
        if (activeTab === "keyword") return filterOptions.keywords;
        if (activeTab === "rank") return RANK_OPTIONS;
        return [];
    };

    const list = useMemo(() => {
        const base = getListForTab() || [];
        return base.filter((item) =>
            item.toLowerCase().includes(search.toLowerCase())
        );
    }, [activeTab, search, filterOptions]);

    const currentKey = activeTab === "category" ? "categories" : (activeTab === "brand" ? "brands" : (activeTab === "sku" ? "skus" : (activeTab === "keywordType" ? "keywordType" : (activeTab === "rank" ? "rank" : "keywords"))));

    const handleToggle = (type, item) => {
        if (type === 'rank') {
            const next = { ...localValue, rank: localValue.rank === item ? 'All' : item };
            setLocalValue(next);
            return;
        }
        const current = new Set(localValue[type]);
        if (current.has(item)) current.delete(item);
        else current.add(item);

        const next = { ...localValue, [type]: Array.from(current) };
        if (type === 'categories') {
            next.brands = [];
            next.skus = [];
        } else if (type === 'brands') {
            next.skus = [];
        }
        setLocalValue(next);
    };

    const handleSelectAll = (type, items) => {
        const allSelected =
            items.length > 0 && items.every((i) => localValue[type].includes(i));
        const next = { ...localValue, [type]: allSelected ? [] : items.slice() };
        if (type === 'categories') {
            next.brands = [];
            next.skus = [];
        } else if (type === 'brands') {
            next.skus = [];
        }
        setLocalValue(next);
    };

    const allItemsForCurrentTab = getListForTab();
    const allSelectedForCurrentTab =
        allItemsForCurrentTab.length > 0 &&
        allItemsForCurrentTab.every((i) => localValue[currentKey].includes(i));

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-4xl gap-0 p-0">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle className="text-lg font-semibold">Filters</DialogTitle>
                </DialogHeader>

                <div className="flex min-h-[360px]">
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
                                <TabsTrigger
                                    value="category"
                                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                                >
                                    Category
                                </TabsTrigger>
                                <TabsTrigger
                                    value="brand"
                                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                                >
                                    Brand
                                </TabsTrigger>
                                <TabsTrigger
                                    value="sku"
                                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                                >
                                    SKU
                                </TabsTrigger>
                                <TabsTrigger
                                    value="keywordType"
                                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                                >
                                    Keyword Type
                                </TabsTrigger>
                                <TabsTrigger
                                    value="keyword"
                                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                                >
                                    Keyword
                                </TabsTrigger>
                                <TabsTrigger
                                    value="rank"
                                    className="justify-start rounded-lg px-3 py-2 text-sm font-medium"
                                >
                                    Rank
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex-1 px-6 py-4 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-4">
                            {activeTab !== 'rank' && (
                                <Input
                                    placeholder="Search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="max-w-sm bg-slate-50"
                                />
                            )}
                            {activeTab === 'rank' && <div className="text-sm font-semibold text-slate-700">Select Search Position</div>}
                            {activeTab !== 'rank' && (
                                <button
                                    className="text-sm font-medium text-blue-600 hover:underline"
                                    onClick={() =>
                                        handleSelectAll(currentKey, allItemsForCurrentTab)
                                    }
                                >
                                    {allSelectedForCurrentTab ? "Clear all" : "Select all"}
                                </button>
                            )}
                        </div>

                        <ScrollArea className="mt-4 h-64 rounded-md border bg-slate-50/60 overflow-x-hidden">
                            <div className="space-y-1 p-3 max-w-full">
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
                                        className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100 overflow-hidden min-w-0 w-full"
                                    >
                                        <Checkbox
                                            checked={activeTab === 'rank' ? localValue.rank === item : (Array.isArray(localValue[currentKey]) && localValue[currentKey].includes(item))}
                                            onCheckedChange={() => handleToggle(currentKey, item)}
                                        />
                                        <span className="truncate flex-1 min-w-0 text-slate-700" title={item}>{item}</span>
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
                    <Button onClick={() => {
                        onChange(localValue);
                        onClose();
                    }}>Apply</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const MetricChip = ({ label, color, active, onClick, comingSoon }) => {
    return (
        <Box
            onClick={comingSoon ? null : onClick}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                px: 1.5,
                py: 0.6,
                borderRadius: "999px",
                cursor: comingSoon ? "default" : "pointer",
                border: `1px solid ${active ? color : "#E5E7EB"}`,
                backgroundColor: active ? `${color}20` : "white",
                color: active ? color : (comingSoon ? "#94A3B8" : "#0f172a"),
                opacity: comingSoon && !active ? 0.7 : 1,
                fontSize: "12px",
                fontWeight: 600,
                userSelect: "none",
                transition: "all 0.15s ease",
            }}
        >
            <Box
                sx={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: `2px solid ${active ? color : (comingSoon ? "#CBD5E1" : "#CBD5E1")}`,
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
            {comingSoon && <ComingSoonBadge />}
            {KPI_TOOLTIPS[label] && (
                <Tooltip
                    title={
                        <Box sx={{ p: 0.5 }}>
                            <Typography sx={{ fontSize: '11px', lineHeight: 1.4 }}>
                                {KPI_TOOLTIPS[label]}
                            </Typography>
                        </Box>
                    }
                    arrow
                    placement="top"
                >
                    <Box sx={{ display: 'flex', ml: 0.5, color: active ? color : '#94A3B8', '&:hover': { color: active ? color : '#64748B' } }}>
                        <Info size={13} />
                    </Box>
                </Tooltip>
            )}
        </Box>
    );
};

/* -------------------------------------------------------------------------- */
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */

const truncateName = (str, n = 35) => {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + "..." : str;
};

const TrendView = ({ mode, visibleIds, setVisibleIds, allPossibleIds, city, onBackToTable, onSwitchToKpi, apiTrendData, trendLoading }) => {
    const [activeMetric, setActiveMetric] = useState("overall_sos");
    const [overflowOpen, setOverflowOpen] = useState(false);

    const metricMeta =
        KPI_KEYS.find((m) => m.key === activeMetric) || KPI_KEYS[0];

    const isBrandMode = mode === "brand";

    const chartData = useMemo(() => {
        if (apiTrendData && Object.keys(apiTrendData).length > 0 && visibleIds.length > 0) {
            const allDates = new Set();
            visibleIds.forEach(brand => {
                const brandData = apiTrendData[brand]?.timeSeries || [];
                brandData.forEach(point => allDates.add(point.date));
            });

            const parseDate = (d) => {
                if (!d) return 0;
                const parts = d.split(' ');
                if (parts.length < 2) return 0;

                try {
                    let day, month, year;
                    if (parts[0].match(/^\d+$/)) {
                        // DD MMM'YY
                        day = parts[0];
                        const my = parts[1].split("'");
                        month = my[0];
                        year = "20" + my[1];
                    } else {
                        // MMM 'YY
                        day = "01";
                        month = parts[0];
                        year = "20" + parts[1].replace("'", "");
                    }
                    const dt = new Date(`${month} ${day} ${year}`);
                    return dt.getTime() || 0;
                } catch (e) {
                    return 0;
                }
            };

            const sortedDates = Array.from(allDates).sort((a, b) => parseDate(a) - parseDate(b));

            return sortedDates.map(date => {
                const row = { date };
                visibleIds.forEach(brand => {
                    const brandData = apiTrendData[brand]?.timeSeries || [];
                    const point = brandData.find(p => p.date === date);
                    if (point) {
                        row[brand] = point[activeMetric] ?? null;
                    }
                });
                return row;
            });
        }
        return [];
    }, [apiTrendData, visibleIds, activeMetric]);

    const formatValue = (v) => `${v}${metricMeta.unit || ""}`;

    return (
        <Card className="mt-4">
            <CardHeader className="flex flex-col gap-4 border-b pb-4">
                <div className="flex items-start justify-between">
                    <Box display="flex" gap={1} flexWrap="wrap">
                        {KPI_KEYS.map((m) => (
                            <MetricChip
                                key={m.key}
                                label={m.label}
                                color={m.color}
                                active={activeMetric === m.key}
                                onClick={() => setActiveMetric(m.key)}
                                comingSoon={m.comingSoon}
                            />
                        ))}
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
                        Select {isBrandMode ? 'Brands' : 'SKUs'} to Plot ({city})
                    </div>
                    <Box display="flex" gap={1} flexWrap="wrap">
                        {(() => {
                            const maxInline = 5;
                            const inlineIds = allPossibleIds.slice(0, maxInline);
                            const overflowIds = allPossibleIds.slice(maxInline);

                            return (
                                <>
                                    {inlineIds.map((id, idx) => {
                                        const name = truncateName(id, 35);
                                        const active = visibleIds.includes(id);
                                        const color = BRAND_COLORS[idx % BRAND_COLORS.length];
                                        return (
                                            <Box
                                                key={id}
                                                onClick={() => setVisibleIds(prev => {
                                                    if (prev.includes(id)) return prev.filter(x => x !== id);
                                                    if (prev.length >= 10) return prev; // Max 10 limit
                                                    return [...prev, id];
                                                })}
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
                                                <div style={{ minWidth: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
                                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={id}>{name}</span>
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
                                                <DialogContent className="max-w-md p-4 bg-white z-[60]">
                                                    <DialogHeader className="mb-2">
                                                        <DialogTitle>Select more {isBrandMode ? 'Brands' : 'SKUs'}</DialogTitle>
                                                    </DialogHeader>
                                                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                                                        {overflowIds.map((id, idx) => {
                                                            const name = id;
                                                            const active = visibleIds.includes(id);
                                                            const color = BRAND_COLORS[(idx + maxInline) % BRAND_COLORS.length];
                                                            return (
                                                                <div
                                                                    key={id}
                                                                    onClick={() => {
                                                                        setVisibleIds(prev => {
                                                                            if (prev.includes(id)) return prev.filter(x => x !== id);
                                                                            if (prev.length >= 10) return prev; // Max 10 limit
                                                                            return [...prev, id];
                                                                        });
                                                                    }}
                                                                    className="p-2 rounded-md mb-2 cursor-pointer"
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E6EEF8', background: active ? `${color}10` : 'white' }}
                                                                >
                                                                    <div style={{ minWidth: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
                                                                    <div style={{ flex: 1, fontSize: '13px' }}>{name}</div>
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
            <CardContent className="pt-4">
                {trendLoading ? (
                    <div className="h-[280px] w-full flex items-center justify-center">
                        <div className="text-slate-400 animate-pulse">Loading trend data...</div>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-[280px] w-full flex items-center justify-center">
                        <div className="text-slate-400">No data is available. Try adjusting your filters.</div>
                    </div>
                ) : metricMeta.comingSoon ? (
                    <div className="h-[280px] w-full flex items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <div className="flex flex-col items-center gap-2">
                            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: '50%', border: '1px solid #E2E8F0', color: '#6366F1' }}>
                                <LineChartIcon size={24} />
                            </Box>
                            <div className="text-center">
                                <p className="text-slate-900 font-semibold">{metricMeta.label} Trends</p>
                                <p className="text-slate-400 text-xs">This data is currently being synthesized. Coming soon!</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" fontSize={11} tickLine={false} dy={6} />
                                <YAxis tickLine={false} fontSize={11} tickFormatter={formatValue} />
                                <RechartsTooltip formatter={formatValue} />
                                <Legend />
                                {visibleIds.map((brand, index) => (
                                    <Line
                                        key={brand}
                                        type="monotone"
                                        dataKey={brand}
                                        name={brand}
                                        dot={false}
                                        stroke={BRAND_COLORS[index % BRAND_COLORS.length]}
                                        strokeWidth={2}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

/* -------------------------------------------------------------------------- */
/*                             KPI Compare View                               */
/* -------------------------------------------------------------------------- */

const KpiCompareView = ({ mode, visibleIds, setVisibleIds, allPossibleIds, city, onBackToTrend, apiTrendData, trendLoading }) => {
    const [overflowOpen, setOverflowOpen] = useState(false);
    const isBrandMode = mode === "brand";

    const chartDataFor = (metricKey) => {
        if (apiTrendData && Object.keys(apiTrendData).length > 0 && visibleIds.length > 0) {
            const allDates = new Set();
            visibleIds.forEach(brand => {
                const brandData = apiTrendData[brand]?.timeSeries || [];
                brandData.forEach(point => {
                    if (point.date) allDates.add(point.date)
                });
            });

            const parseDate = (d) => {
                if (!d) return 0;
                const parts = d.split(' ');
                if (parts.length < 2) return 0;

                try {
                    let day, month, year;
                    if (parts[0].match(/^\d+$/)) {
                        // DD MMM'YY
                        day = parts[0];
                        const my = parts[1].split("'");
                        month = my[0];
                        year = "20" + my[1];
                    } else {
                        // MMM 'YY
                        day = "01";
                        month = parts[0];
                        year = "20" + parts[1].replace("'", "");
                    }
                    const dt = new Date(`${month} ${day} ${year}`);
                    return dt.getTime() || 0;
                } catch (e) {
                    return 0;
                }
            };

            const sortedDates = Array.from(allDates).sort((a, b) => parseDate(a) - parseDate(b));

            return sortedDates.map(date => {
                const row = { date };
                visibleIds.forEach(brand => {
                    const brandData = apiTrendData[brand]?.timeSeries || [];
                    const point = brandData.find(p => p.date === date);
                    if (point) row[brand] = point[metricKey] ?? null;
                });
                return row;
            });
        }
        return [];
    };

    return (
        <Card className="mt-4">
            <CardHeader className="flex flex-col gap-4 border-b pb-4">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">Compare by KPIs</CardTitle>
                    <Button variant="ghost" size="sm" onClick={onBackToTrend}>Back to trend</Button>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Select {isBrandMode ? 'Brands' : 'SKUs'} to Plot ({city})
                    </div>
                    <Box display="flex" gap={1} flexWrap="wrap">
                        {(() => {
                            const maxInline = 5;
                            const inlineIds = allPossibleIds.slice(0, maxInline);
                            const overflowIds = allPossibleIds.slice(maxInline);

                            return (
                                <>
                                    {inlineIds.map((id, idx) => {
                                        const name = truncateName(id, 35);
                                        const active = visibleIds.includes(id);
                                        const color = BRAND_COLORS[idx % BRAND_COLORS.length];
                                        return (
                                            <Box
                                                key={id}
                                                onClick={() => setVisibleIds(prev => {
                                                    if (prev.includes(id)) return prev.filter(x => x !== id);
                                                    if (prev.length >= 10) return prev; // Max 10 limit
                                                    return [...prev, id];
                                                })}
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
                                                <div style={{ minWidth: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
                                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={id}>{name}</span>
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
                                                <DialogContent className="max-w-md p-4 bg-white z-[60]">
                                                    <DialogHeader className="mb-2">
                                                        <DialogTitle>Select more {isBrandMode ? 'Brands' : 'SKUs'}</DialogTitle>
                                                    </DialogHeader>
                                                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                                                        {overflowIds.map((id, idx) => {
                                                            const name = id;
                                                            const active = visibleIds.includes(id);
                                                            const color = BRAND_COLORS[(idx + maxInline) % BRAND_COLORS.length];
                                                            return (
                                                                <div
                                                                    key={id}
                                                                    onClick={() => {
                                                                        setVisibleIds(prev => {
                                                                            if (prev.includes(id)) return prev.filter(x => x !== id);
                                                                            if (prev.length >= 10) return prev; // Max 10 limit
                                                                            return [...prev, id];
                                                                        });
                                                                    }}
                                                                    className="p-2 rounded-md mb-2 cursor-pointer"
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E6EEF8', background: active ? `${color}10` : 'white' }}
                                                                >
                                                                    <div style={{ minWidth: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
                                                                    <div style={{ flex: 1, fontSize: '13px' }}>{name}</div>
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

            <CardContent className="grid max-h-[420px] gap-4 overflow-y-auto pt-4 md:grid-cols-2">
                {trendLoading ? (
                    <div className="col-span-2 flex h-48 items-center justify-center">
                        <div className="text-slate-400 animate-pulse">Loading KPI data...</div>
                    </div>
                ) : visibleIds.length === 0 ? (
                    <div className="col-span-2 flex h-48 items-center justify-center">
                        <div className="text-slate-400">No data is available. Try adjusting your filters.</div>
                    </div>
                ) : (
                    KPI_KEYS.map((kpi) => (
                        <Card key={kpi.key} className="border-slate-200 bg-slate-50/80 shadow-none hover:bg-slate-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                                    {kpi.label}
                                    {kpi.comingSoon && <ComingSoonBadge />}
                                    {KPI_TOOLTIPS[kpi.label] && (
                                        <Tooltip
                                            title={
                                                <Box sx={{ p: 0.5 }}>
                                                    <Typography sx={{ fontSize: '11px', lineHeight: 1.4 }}>
                                                        {KPI_TOOLTIPS[kpi.label]}
                                                    </Typography>
                                                </Box>
                                            }
                                            arrow
                                            placement="top"
                                        >
                                            <Box sx={{ display: 'flex', color: '#94A3B8', cursor: 'help', '&:hover': { color: '#64748B' } }}>
                                                <Info size={14} />
                                            </Box>
                                        </Tooltip>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-48 pt-0">
                                {kpi.comingSoon ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-1 opacity-50">
                                        <LineChartIcon size={20} className="text-slate-400" />
                                        <p className="text-[10px] text-slate-400 font-medium">Coming Soon</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartDataFor(kpi.key)} margin={{ top: 8, left: -16, right: 8 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" hide />
                                            <YAxis tickLine={false} fontSize={10} width={32} />
                                            <RechartsTooltip />
                                            {visibleIds.map((brand, index) => (
                                                <Line
                                                    key={brand}
                                                    type="monotone"
                                                    dataKey={brand}
                                                    name={brand}
                                                    dot={false}
                                                    stroke={BRAND_COLORS[index % BRAND_COLORS.length]}
                                                    strokeWidth={2}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </CardContent>
        </Card>
    );
};

/* -------------------------------------------------------------------------- */
/*                                 Tables                                     */
/* -------------------------------------------------------------------------- */

const BrandTable = ({ rows, loading }) => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const totalPages = Math.ceil(rows.length / pageSize);
    const paginatedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

    return (
        <Card className="mt-3">
            <CardHeader className="border-b pb-2">
                <CardTitle className="text-sm font-medium text-slate-800">Brands (Top {rows.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
                <div className="max-h-[380px] overflow-auto rounded-md border text-slate-900">
                    <table className="min-w-full divide-y divide-slate-200 text-xs table-fixed">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left w-[25%]">Brand</th>
                                <th className="px-3 py-2 text-right w-[25%]">Overall SOS</th>
                                <th className="px-3 py-2 text-right w-[25%]">Sponsored SOS</th>
                                <th className="px-3 py-2 text-right w-[25%]">Organic SOS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? Array.from({ length: pageSize }).map((_, idx) => (
                                <tr key={`skeleton-${idx}`} className="animate-pulse">
                                    <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                </tr>
                            )) : paginatedRows.map((row, idx) => (
                                <tr key={row.id} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/60")}>
                                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">{row.name}</td>
                                    <td className="px-3 py-2 text-right text-slate-900 font-medium">{formatKpiValue(row.overall_sos)}</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{formatKpiValue(row.sponsored_sos)}</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{formatKpiValue(row.organic_sos)}</td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No data is available</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
            <PaginationFooter isVisible={rows.length > 0} currentPage={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
    );
};

const SkuTable = ({ rows, loading }) => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const totalPages = Math.ceil(rows.length / pageSize);
    const paginatedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

    return (
        <Card className="mt-3">
            <CardHeader className="border-b pb-2">
                <CardTitle className="text-sm font-medium text-slate-800">SKUs (Top {rows.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
                <div className="max-h-[380px] overflow-auto rounded-md border text-slate-900">
                    <table className="min-w-full divide-y divide-slate-200 text-xs table-fixed">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left w-[25%]">SKU</th>
                                <th className="px-3 py-2 text-left w-[20%]">Brand</th>
                                <th className="px-3 py-2 text-right w-[18%]">Overall SOS</th>
                                <th className="px-3 py-2 text-right w-[18%]">Sponsored SOS</th>
                                <th className="px-3 py-2 text-right w-[19%]">Organic SOS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? Array.from({ length: pageSize }).map((_, idx) => (
                                <tr key={`skeleton-sku-${idx}`} className="animate-pulse">
                                    <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                                    <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                </tr>
                            )) : paginatedRows.map((row, idx) => (
                                <tr key={row.id} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/60")}>
                                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">{row.name}</td>
                                    <td className="px-3 py-2 text-slate-900 border-r border-slate-100">{row.brandName}</td>
                                    <td className="px-3 py-2 text-right text-slate-900 font-medium">{formatKpiValue(row.overall_sos)}</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{formatKpiValue(row.sponsored_sos)}</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{formatKpiValue(row.organic_sos)}</td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No data is available</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
            <PaginationFooter isVisible={rows.length > 0} currentPage={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
    );
};

/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

const VisibilityPlatformOverviewKpiShowcase = ({ selectedPlatform, period, timeStep, externalFilters, externalCity }) => {
    const { selectedChannel, compareStart, compareEnd } = useContext(FilterContext);
    const [tab, setTab] = useState("brand");
    const [city, setCity] = useState(externalCity || "All India");
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [filters, setFilters] = useState(externalFilters || {
        categories: [],
        brands: [],
        skus: [],
        keywords: [],
        keywordType: [],
        rank: 'All'
    });
    const [viewMode, setViewMode] = useState("table");

    // Sync external filters if provided
    useEffect(() => {
        if (externalFilters) {
            setFilters(prev => {
                const mapped = {
                    categories: (externalFilters.Format && externalFilters.Format !== 'All') ? [externalFilters.Format] : [],
                    brands: (externalFilters.Brand && externalFilters.Brand !== 'All') ? [externalFilters.Brand] : [],
                    skus: (externalFilters.SKU && externalFilters.SKU !== 'All') ? [externalFilters.SKU] : [],
                    keywords: (externalFilters.Keyword && externalFilters.Keyword !== 'All') ? [externalFilters.Keyword] : [],
                    keywordType: (externalFilters.Keyword_Type && externalFilters.Keyword_Type !== 'All') ? [externalFilters.Keyword_Type] : [],
                    rank: externalFilters.rank || 'All'
                };

                if (JSON.stringify(prev) !== JSON.stringify(mapped)) {
                    return mapped;
                }
                return prev;
            });
        }
    }, [JSON.stringify(externalFilters)]);

    useEffect(() => {
        if (externalCity) {
            setCity(externalCity);
        }
    }, [externalCity]);

    const [filterOptions, setFilterOptions] = useState({
        locations: ['All India'],
        brands: ['All'],
        skus: ['All']
    });
    const [apiBrandData, setApiBrandData] = useState([]);
    const [apiSkuData, setApiSkuData] = useState([]);
    const [apiLoading, setApiLoading] = useState(true);
    const [apiTrendData, setApiTrendData] = useState({});
    const [trendLoading, setTrendLoading] = useState(false);

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const res = await axiosInstance.get(`/visibility-analysis/filter-options?filterType=cities&channel=${selectedChannel || 'All'}&platform=${selectedPlatform || 'All'}`);
                if (res.data) {
                    setFilterOptions(prev => ({ ...prev, locations: ['All India', ...(res.data.options || [])] }));
                }
            } catch (err) {
                console.error('Failed to fetch city options:', err);
            }
        };
        fetchFilterOptions();
    }, [selectedChannel, selectedPlatform]);

    useEffect(() => {
        const fetchCompetitionData = async () => {
            setApiLoading(true);
            try {
                const params = {
                    platform: selectedPlatform || 'All',
                    location: city !== 'All India' 
                        ? (Array.isArray(city) ? city.join(',').toLowerCase() : String(city).toLowerCase()) 
                        : 'all',
                    format: filters.categories.length > 0 ? filters.categories.join(',') : 'All',
                    brand: filters.brands.length > 0 ? filters.brands.join(',') : 'All',
                    skus: filters.skus.length > 0 ? filters.skus.join(',') : 'All',
                    period: period || '1M',
                    channel: selectedChannel || 'All',
                    keyword: filters.keywords.length > 0 ? filters.keywords.join(',') : 'All',
                    keywordType: filters.keywordType.length > 0 ? filters.keywordType.join(',') : 'All',
                    rank: filters.rank || 'All',
                    compareStartDate: compareStart ? dayjs(compareStart).format('YYYY-MM-DD') : undefined,
                    compareEndDate: compareEnd ? dayjs(compareEnd).format('YYYY-MM-DD') : undefined
                };

                const res = await axiosInstance.get('/visibility-analysis/competition', { params });
                if (res.data) {
                    console.log('[VisibilityPlatformOverviewKpiShowcase] Received competition data:', res.data.brands?.length, 'brands,', res.data.skus?.length, 'skus');

                    setApiBrandData((res.data.brands || []).map((b, idx) => ({
                        id: b.brand?.toLowerCase().replace(/\s+/g, '-') || `brand-${idx}`,
                        name: b.brand || 'Unknown',
                        overall_sos: b.overall_sos?.value ?? b.overall_sos ?? 0,
                        overall_sos_delta: b.overall_sos?.delta ?? 0,
                        sponsored_sos: b.sponsored_sos?.value ?? b.sponsored_sos ?? 0,
                        sponsored_sos_delta: b.sponsored_sos?.delta ?? 0,
                        organic_sos: b.organic_sos?.value ?? b.organic_sos ?? 0,
                        organic_sos_delta: b.organic_sos?.delta ?? 0,
                        display_sos: b.display_sos?.value ?? b.display_sos ?? 0,
                        display_sos_delta: b.display_sos?.delta ?? 0,
                    })));

                    setApiSkuData((res.data.skus || []).map((s, idx) => ({
                        id: s.sku?.toLowerCase().replace(/\s+/g, '-') || `sku-${idx}`,
                        name: s.sku || 'Unknown',
                        brandName: s.brand || 'Unknown',
                        overall_sos: s.overall_sos?.value ?? s.overall_sos ?? 0,
                        overall_sos_delta: s.overall_sos?.delta ?? 0,
                        sponsored_sos: s.sponsored_sos?.value ?? s.sponsored_sos ?? 0,
                        sponsored_sos_delta: s.sponsored_sos?.delta ?? 0,
                        organic_sos: s.organic_sos?.value ?? s.organic_sos ?? 0,
                        organic_sos_delta: s.organic_sos?.delta ?? 0,
                        display_sos: s.display_sos?.value ?? s.display_sos ?? 0,
                        display_sos_delta: s.display_sos?.delta ?? 0,
                    })));
                }
            } catch (err) {
                console.error('[VisibilityPlatformOverviewKpiShowcase] Failed to fetch competition data:', err);
            } finally {
                setApiLoading(false);
            }
        };
        fetchCompetitionData();
    }, [city, filters.brands, filters.categories, filters.keywords, filters.keywordType, filters.rank, selectedPlatform, period, selectedChannel, compareStart, compareEnd]);

    const selectionCount = filters.categories.length + filters.brands.length + filters.skus.length + filters.keywords.length + filters.keywordType.length + (filters.rank !== 'All' ? 1 : 0);

    const brandRows = useMemo(() => {
        let rows = apiBrandData;
        if (filters.brands.length) rows = rows.filter((r) => filters.brands.includes(r.name));
        return rows;
    }, [apiBrandData, filters.brands]);

    const skuRows = useMemo(() => {
        let rows = apiSkuData;
        if (filters.brands.length) rows = rows.filter((r) => filters.brands.includes(r.brandName));
        if (filters.skus.length) rows = rows.filter((r) => filters.skus.includes(r.name));
        return rows;
    }, [apiSkuData, filters.brands, filters.skus]);

    const allPossibleIds = useMemo(() => {
        if (tab === "brand") {
            const rows = brandRows || [];
            const ids = rows.map((r) => r.name);
            if (filters.brands && filters.brands.length > 0) {
                filters.brands.forEach(b => { if (!ids.includes(b)) ids.push(b); });
            }
            return ids;
        } else {
            const rows = skuRows || [];
            const ids = rows.map((r) => r.name);
            if (filters.skus && filters.skus.length > 0) {
                filters.skus.forEach(s => { if (!ids.includes(s)) ids.push(s); });
            }
            return ids;
        }
    }, [tab, brandRows, skuRows, filters.brands, filters.skus]);

    const [visibleIds, setVisibleIds] = useState([]);

    useEffect(() => {
        setVisibleIds(allPossibleIds.slice(0, 5));
    }, [tab, allPossibleIds]);

    useEffect(() => {
        if (viewMode !== 'trend' && viewMode !== 'kpi') return;

        const fetchBrandTrends = async () => {
            setTrendLoading(true);
            try {
                let idList = visibleIds;

                console.log('[VisibilityPlatformOverviewKpiShowcase] Fetching trends for ids:', idList);

                if (idList.length === 0) {
                    setTrendLoading(false);
                    return;
                }

                const params = {
                    platform: selectedPlatform || 'All',
                    brands: tab === 'brand' ? idList.join(',') : (filters.brands.length > 0 ? filters.brands.join(',') : 'All'),
                    skus: tab === 'sku' ? idList.join(',') : (filters.skus.length > 0 ? filters.skus.join(',') : 'All'),
                    location: city !== 'All India' ? (Array.isArray(city) ? city.join(',') : String(city)) : 'All',
                    format: filters.categories.length > 0 ? filters.categories.join(',') : 'All',
                    dimension: tab,
                    period: period || '1M',
                    timeStep: timeStep,
                    channel: selectedChannel || 'All',
                    keyword: filters.keywords.length > 0 ? filters.keywords.join(',') : 'All',
                    keywordType: filters.keywordType.length > 0 ? filters.keywordType.join(',') : 'All',
                    rank: filters.rank || 'All',
                    compareStartDate: compareStart ? dayjs(compareStart).format('YYYY-MM-DD') : undefined,
                    compareEndDate: compareEnd ? dayjs(compareEnd).format('YYYY-MM-DD') : undefined
                };

                const res = await axiosInstance.get('/visibility-analysis/brand-comparison-trends', { params });
                if (res.data && res.data.brands) {
                    console.log('[VisibilityPlatformOverviewKpiShowcase] Received trend data for', Object.keys(res.data.brands).length, 'brands');
                    setApiTrendData(res.data.brands);
                }
            } catch (err) {
                console.error('[VisibilityPlatformOverviewKpiShowcase] Failed to fetch brand trends:', err);
            } finally {
                setTrendLoading(false);
            }
        };
        fetchBrandTrends();
    }, [viewMode, city, visibleIds, filters.categories, filters.keywords, filters.keywordType, filters.rank, period, timeStep, selectedChannel, tab, compareStart, compareEnd]);



    return (
        <div className="flex-col bg-slate-50 text-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Competition</span>
                        <Badge className="border-blue-200 bg-blue-50 text-xs">{selectedPlatform || "All Platforms"}</Badge>
                    </div>
                    <h1 className="text-lg font-semibold text-slate-900">Competition List</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={city} onValueChange={setCity}>
                        <SelectTrigger className="h-9 w-40 bg-white"><SelectValue placeholder="Select city" /></SelectTrigger>
                        <SelectContent>
                            {filterOptions.locations.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" className="relative bg-white" onClick={() => setFilterDialogOpen(true)}>
                        <Filter className="mr-1.5 h-4 w-4" /> Filters
                        {selectionCount > 0 && <Badge className="ml-2 h-5 min-w-[20px] justify-center rounded-full bg-blue-600 text-[11px] text-white">{selectionCount}</Badge>}
                    </Button>

                    <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setViewMode("trend")}>
                        <LineChartIcon className="mr-1.5 h-4 w-4" /> Trend
                    </Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => { setTab(v); setViewMode("table"); }} className="w-full">
                <div className="flex items-center justify-between gap-3">
                    <TabsList className="bg-slate-100">
                        <TabsTrigger value="brand" className="px-4">Brands</TabsTrigger>
                        <TabsTrigger value="sku" className="px-4">SKUs</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {selectionCount > 0 ? <span>{selectionCount} filter(s) applied</span> : <span>No filters applied</span>}
                    </div>
                </div>

                <TabsContent value="brand" className="mt-3">
                    {viewMode === "table" && <BrandTable rows={brandRows} loading={apiLoading} />}
                    {viewMode === "trend" && <TrendView mode="brand" visibleIds={visibleIds} setVisibleIds={setVisibleIds} allPossibleIds={allPossibleIds} city={city} onBackToTable={() => setViewMode("table")} onSwitchToKpi={() => setViewMode("kpi")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                    {viewMode === "kpi" && <KpiCompareView mode="brand" visibleIds={visibleIds} setVisibleIds={setVisibleIds} allPossibleIds={allPossibleIds} city={city} onBackToTrend={() => setViewMode("trend")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                </TabsContent>

                <TabsContent value="sku" className="mt-3">
                    {viewMode === "table" && <SkuTable rows={skuRows} loading={apiLoading} />}
                    {viewMode === "trend" && <TrendView mode="sku" visibleIds={visibleIds} setVisibleIds={setVisibleIds} allPossibleIds={allPossibleIds} city={city} onBackToTable={() => setViewMode("table")} onSwitchToKpi={() => setViewMode("kpi")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                    {viewMode === "kpi" && <KpiCompareView mode="sku" visibleIds={visibleIds} setVisibleIds={setVisibleIds} allPossibleIds={allPossibleIds} city={city} onBackToTrend={() => setViewMode("trend")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                </TabsContent>
            </Tabs>

            <FilterDialog
                open={filterDialogOpen}
                onClose={() => setFilterDialogOpen(false)}
                mode={tab}
                value={filters}
                onChange={setFilters}
                selectedPlatform={selectedPlatform}
                city={city}
            />
        </div>
    );
};

export default VisibilityPlatformOverviewKpiShowcase;
