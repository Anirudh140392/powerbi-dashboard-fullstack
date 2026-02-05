import React, { useMemo, useState, useContext, createContext, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
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
import PaginationFooter from "../CommonLayout/PaginationFooter";


/* -------------------------------------------------------------------------- */
/*                               Utility helper                               */
/* -------------------------------------------------------------------------- */

function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}

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

const getBrandColor = (index) => BRAND_COLORS[index % BRAND_COLORS.length];

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
    {
        key: "display_sos",
        label: "Display SOS",
        color: "#8B5CF6", // purple
        unit: "%",
        comingSoon: true,
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

const FilterDialog = ({ open, onClose, mode, value, onChange }) => {
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
                params.append('filterType', activeTab === 'category' ? 'formats' : (activeTab === 'brand' ? 'brands' : 'skus'));

                if (value.categories.length > 0) {
                    params.append('format', value.categories[0]);
                }
                if (value.brands.length > 0) {
                    params.append('brand', value.brands[0]);
                }

                const response = await axiosInstance.get(`/visibility-analysis/filter-options?${params.toString()}`);

                if (response.data) {
                    const key = activeTab === 'category' ? 'categories' : (activeTab === 'brand' ? 'brands' : 'skus');
                    setFilterOptions(prev => ({
                        ...prev,
                        [key]: (response.data.options || []).filter(o => o && o !== 'All'),
                        loading: false,
                        error: null
                    }));
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
    }, [open, activeTab, value.categories, value.brands]);

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

    const currentKey = activeTab === "category" ? "categories" : (activeTab === "brand" ? "brands" : "skus");

    const handleToggle = (type, item) => {
        const current = new Set(value[type]);
        if (current.has(item)) current.delete(item);
        else current.add(item);

        const next = { ...value, [type]: Array.from(current) };
        if (type === 'categories') {
            next.brands = [];
            next.skus = [];
        } else if (type === 'brands') {
            next.skus = [];
        }
        onChange(next);
    };

    const handleSelectAll = (type, items) => {
        const allSelected =
            items.length > 0 && items.every((i) => value[type].includes(i));
        const next = { ...value, [type]: allSelected ? [] : items.slice() };
        if (type === 'categories') {
            next.brands = [];
            next.skus = [];
        } else if (type === 'brands') {
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
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex-1 px-6 py-4 min-w-0 overflow-hidden">
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
                                            checked={value[currentKey].includes(item)}
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
                    <Button onClick={onClose}>Apply</Button>
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
        </Box>
    );
};

/* -------------------------------------------------------------------------- */
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */

const TrendView = ({ mode, filters, city, onBackToTable, onSwitchToKpi, apiTrendData, trendLoading }) => {
    const [activeMetric, setActiveMetric] = useState("overall_sos");

    const metricMeta =
        KPI_KEYS.find((m) => m.key === activeMetric) || KPI_KEYS[0];

    const isBrandMode = mode === "brand";

    const selectedBrands = useMemo(() => {
        if (filters.brands.length > 0) {
            return filters.brands.slice(0, 4);
        }
        if (apiTrendData && Object.keys(apiTrendData).length > 0) {
            return Object.keys(apiTrendData).slice(0, 4);
        }
        return [];
    }, [filters.brands, apiTrendData]);

    const chartData = useMemo(() => {
        if (apiTrendData && Object.keys(apiTrendData).length > 0 && selectedBrands.length > 0) {
            const allDates = new Set();
            selectedBrands.forEach(brand => {
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
                selectedBrands.forEach(brand => {
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
    }, [apiTrendData, selectedBrands, activeMetric]);

    const formatValue = (v) => `${v}${metricMeta.unit || ""}`;

    return (
        <Card className="mt-4">
            <CardHeader className="flex items-start justify-between border-b pb-3">
                <div className="space-y-2">
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{isBrandMode ? "Brands:" : "SKUs:"}</span>
                        {selectedBrands.map((label) => <Badge key={label}>{label}</Badge>)}
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
                {trendLoading ? (
                    <div className="h-[280px] w-full flex items-center justify-center">
                        <div className="text-slate-400 animate-pulse">Loading trend data...</div>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-[280px] w-full flex items-center justify-center">
                        <div className="text-slate-400">No trend data available. Select brands from the filter.</div>
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
                                <Tooltip formatter={formatValue} />
                                <Legend />
                                {selectedBrands.map((brand, index) => (
                                    <Line
                                        key={brand}
                                        type="monotone"
                                        dataKey={brand}
                                        name={brand}
                                        dot={false}
                                        stroke={getBrandColor(index)}
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

const KpiCompareView = ({ mode, filters, city, onBackToTrend, apiTrendData, trendLoading }) => {
    const isBrandMode = mode === "brand";

    const selectedBrands = useMemo(() => {
        if (filters.brands.length > 0) return filters.brands.slice(0, 4);
        if (apiTrendData && Object.keys(apiTrendData).length > 0) return Object.keys(apiTrendData).slice(0, 4);
        return [];
    }, [filters.brands, apiTrendData]);

    const chartDataFor = (metricKey) => {
        if (apiTrendData && Object.keys(apiTrendData).length > 0 && selectedBrands.length > 0) {
            const allDates = new Set();
            selectedBrands.forEach(brand => {
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
                selectedBrands.forEach(brand => {
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
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">Compare by KPIs</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{isBrandMode ? "Brands:" : "SKUs:"}</span>
                        {selectedBrands.map((label) => (
                            <Badge key={label} className="border-slate-200 bg-slate-50">{label}</Badge>
                        ))}
                        <Separator orientation="vertical" className="mx-1 h-4" />
                        <span>{city}</span>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onBackToTrend}>Back to trend</Button>
            </CardHeader>

            <CardContent className="grid max-h-[420px] gap-4 overflow-y-auto pt-4 md:grid-cols-2">
                {trendLoading ? (
                    <div className="col-span-2 flex h-48 items-center justify-center">
                        <div className="text-slate-400 animate-pulse">Loading KPI data...</div>
                    </div>
                ) : selectedBrands.length === 0 ? (
                    <div className="col-span-2 flex h-48 items-center justify-center">
                        <div className="text-slate-400">No data available. Select brands from the filter.</div>
                    </div>
                ) : (
                    KPI_KEYS.map((kpi) => (
                        <Card key={kpi.key} className="border-slate-200 bg-slate-50/80 shadow-none hover:bg-slate-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                                    {kpi.label}
                                    {kpi.comingSoon && <ComingSoonBadge />}
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
                                            <Tooltip />
                                            {selectedBrands.map((brand, index) => (
                                                <Line
                                                    key={brand}
                                                    type="monotone"
                                                    dataKey={brand}
                                                    name={brand}
                                                    dot={false}
                                                    stroke={getBrandColor(index)}
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
                                <th className="px-3 py-2 text-left w-[20%]">Brand</th>
                                <th className="px-3 py-2 text-right w-[20%]">Overall SOS</th>
                                <th className="px-3 py-2 text-right w-[20%]">Sponsored SOS</th>
                                <th className="px-3 py-2 text-right w-[20%]">Organic SOS</th>
                                <th className="px-3 py-2 text-right w-[20%]">Display SOS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? Array.from({ length: pageSize }).map((_, idx) => (
                                <tr key={`skeleton-${idx}`} className="animate-pulse">
                                    <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                </tr>
                            )) : paginatedRows.map((row, idx) => (
                                <tr key={row.id} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/60")}>
                                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">{row.name}</td>
                                    <td className="px-3 py-2 text-right text-slate-900 font-medium">{(row.overall_sos || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{(row.sponsored_sos || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{(row.organic_sos || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right">
                                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-100">
                                            Coming Soon
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No brands found</td></tr>
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
                                <th className="px-3 py-2 text-left w-[20%]">SKU</th>
                                <th className="px-3 py-2 text-left w-[20%]">Brand</th>
                                <th className="px-3 py-2 text-right w-[15%]">Overall SOS</th>
                                <th className="px-3 py-2 text-right w-[15%]">Sponsored SOS</th>
                                <th className="px-3 py-2 text-right w-[15%]">Organic SOS</th>
                                <th className="px-3 py-2 text-right w-[15%]">Display SOS</th>
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
                                    <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-1/2 ml-auto"></div></td>
                                </tr>
                            )) : paginatedRows.map((row, idx) => (
                                <tr key={row.id} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/60")}>
                                    <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100">{row.name}</td>
                                    <td className="px-3 py-2 text-slate-900 border-r border-slate-100">{row.brandName}</td>
                                    <td className="px-3 py-2 text-right text-slate-900 font-medium">{(row.overall_sos || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{(row.sponsored_sos || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right text-slate-900">{(row.organic_sos || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right">
                                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-100">
                                            Coming Soon
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No SKUs found</td></tr>
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

const VisibilityPlatformOverviewKpiShowcase = ({ selectedItem, selectedLevel, selectedPlatform, period, timeStep }) => {
    const [tab, setTab] = useState("brand");
    const [city, setCity] = useState("All India");
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [filters, setFilters] = useState({
        categories: [],
        brands: [],
        skus: [],
    });
    const [viewMode, setViewMode] = useState("table");

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
        if (viewMode !== 'trend' && viewMode !== 'kpi') return;

        const fetchBrandTrends = async () => {
            setTrendLoading(true);
            try {
                // Use filter brands if selected, otherwise use top brands from competition data
                let brandList = filters.brands.length > 0
                    ? filters.brands.slice(0, 4)
                    : apiBrandData.slice(0, 4).map(b => b.name);

                console.log('[VisibilityPlatformOverviewKpiShowcase] Fetching trends for brands:', brandList);

                if (brandList.length === 0) {
                    console.log('[VisibilityPlatformOverviewKpiShowcase] No brands to fetch trends for');
                    setTrendLoading(false);
                    return;
                }

                const params = {
                    brands: brandList.join(','),
                    location: city !== 'All India' ? city : 'All',
                    format: filters.categories.length > 0 ? filters.categories[0] : 'All',
                    period: period || '1M',
                    timeStep: timeStep
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
    }, [viewMode, city, filters.brands, filters.categories, period, timeStep, apiBrandData]);

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const res = await axiosInstance.get('/visibility-analysis/filter-options?filterType=cities');
                if (res.data) {
                    setFilterOptions(prev => ({ ...prev, locations: ['All India', ...(res.data.options || [])] }));
                }
            } catch (err) {
                console.error('Failed to fetch city options:', err);
            }
        };
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        const fetchCompetitionData = async () => {
            setApiLoading(true);
            try {
                const params = {
                    platform: selectedPlatform || 'All',
                    location: city !== 'All India' ? city : 'All',
                    format: filters.categories.length > 0 ? filters.categories[0] : 'All',
                    brand: filters.brands.length > 0 ? filters.brands[0] : 'All',
                    period: period || '1M'
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
    }, [city, filters.brands, filters.categories, selectedPlatform, period]);

    const selectionCount = filters.categories.length + filters.brands.length + filters.skus.length;

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
                        <SelectContent className="max-h-60 overflow-y-auto">
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
                    {viewMode === "trend" && <TrendView mode="brand" filters={filters} city={city} onBackToTable={() => setViewMode("table")} onSwitchToKpi={() => setViewMode("kpi")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                    {viewMode === "kpi" && <KpiCompareView mode="brand" filters={filters} city={city} onBackToTrend={() => setViewMode("trend")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                </TabsContent>

                <TabsContent value="sku" className="mt-3">
                    {viewMode === "table" && <SkuTable rows={skuRows} loading={apiLoading} />}
                    {viewMode === "trend" && <TrendView mode="sku" filters={filters} city={city} onBackToTable={() => setViewMode("table")} onSwitchToKpi={() => setViewMode("kpi")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                    {viewMode === "kpi" && <KpiCompareView mode="sku" filters={filters} city={city} onBackToTrend={() => setViewMode("trend")} apiTrendData={apiTrendData} trendLoading={trendLoading} />}
                </TabsContent>
            </Tabs>

            <FilterDialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} mode={tab} value={filters} onChange={setFilters} />
        </div>
    );
};

export default VisibilityPlatformOverviewKpiShowcase;
