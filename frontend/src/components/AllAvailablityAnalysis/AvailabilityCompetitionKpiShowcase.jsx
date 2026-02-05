import React, { useMemo, useState, useContext, createContext, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
// import PaginationFooter from "../CommonLayout/PaginationFooter"; // Removed pagination
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
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */
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

const TrendView = ({ mode, filters, city, onBackToTable, onSwitchToKpi, apiTrendData }) => {
    const [activeMetric, setActiveMetric] = useState("Osa");

    const metricMeta =
        KPI_KEYS.find((m) => m.key === activeMetric) || KPI_KEYS[0];

    const isBrandMode = mode === "brand";

    const chartData = useMemo(() => {
        if (!apiTrendData) return [];

        // apiTrendData is expected to be { dates: [], [metric]: { [brand/sku]: [] } }
        const dates = apiTrendData.dates || [];
        const metricData = apiTrendData[activeMetric.toLowerCase()] || {};

        return dates.map((date, idx) => {
            const row = { date };
            Object.keys(metricData).forEach(id => {
                row[id] = metricData[id][idx] || null;
            });
            return row;
        });
    }, [apiTrendData, activeMetric]);

    const selectedIds = useMemo(() => {
        if (!apiTrendData || !apiTrendData[activeMetric.toLowerCase()]) return [];
        return Object.keys(apiTrendData[activeMetric.toLowerCase()]);
    }, [apiTrendData, activeMetric]);

    const formatValue = (v) => {
        if (metricMeta.unit) return `${v}${metricMeta.unit}`;
        if (metricMeta.prefix) return `${metricMeta.prefix}${v}`;
        if (metricMeta.suffix) return `${v}${metricMeta.suffix}`;
        return v;
    };

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
                            />
                        ))}
                    </Box>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>Trend for selected platform/category</span>
                        <Separator orientation="vertical" className="mx-1 h-4" />
                        <span>{city}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onBackToTable}>
                        Back to list
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" fontSize={11} tickLine={false} dy={6} />
                            <YAxis
                                tickLine={false}
                                fontSize={11}
                                tickFormatter={formatValue}
                            />
                            <Tooltip formatter={formatValue} />
                            <Legend />

                            {selectedIds.map((id, idx) => (
                                <Line
                                    key={id}
                                    type="monotone"
                                    dataKey={id}
                                    name={id}
                                    dot={false}
                                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                    strokeWidth={2}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

const CHART_COLORS = ["#F97316", "#8B5CF6", "#22C55E", "#3B82F6", "#EC4899", "#EAB308"];

const KPI_KEYS = [
    {
        key: "Osa",
        label: "OSA",
        color: "#F97316",
        unit: "%",
    },
    {
        key: "Doi",
        label: "DOI",
        color: "#8B5CF6",
        unit: "",
    },
    {
        key: "Fillrate",
        label: "Fillrate",
        color: "#22C55E",
        unit: "%",
    },
    {
        key: "Assortment",
        label: "Assortment",
        color: "#3B82F6",
        unit: "",
    },
    {
        key: "Psl",
        label: "PSL",
        color: "#EC4899",
        unit: "%",
    }
];

/* -------------------------------------------------------------------------- */
/*                                 Tables                                     */
/* -------------------------------------------------------------------------- */

const BrandTable = ({ rows, loading }) => {
    return (
        <Card className="mt-3">
            <CardHeader className="border-b pb-2">
                <CardTitle className="text-sm font-medium text-slate-800">
                    Brands ({rows.length || 0})
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
                <div className="max-h-[500px] overflow-auto rounded-md border">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 text-left">Brand</th>
                                <th className="px-3 py-2 text-center">OSA</th>
                                <th className="px-3 py-2 text-center">DOI</th>
                                <th className="px-3 py-2 text-center">Fillrate</th>
                                <th className="px-3 py-2 text-center">Assortment</th>
                                <th className="px-3 py-2 text-center">PSL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading && Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={`skeleton-${idx}`} className="animate-pulse">
                                    <td className="px-3 py-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-2/3"></div></td>
                                    <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                                    <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                                    <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                                    <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                                    <td className="px-3 py-3 text-center"><div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div></td>
                                </tr>
                            ))}
                            {!loading && rows.map((row, idx) => (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        "hover:bg-slate-50",
                                        idx % 2 === 1 && "bg-slate-50/60"
                                    )}
                                >
                                    <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                                        {row.name}
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="font-semibold text-slate-700">
                                            {(row.osa || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="font-semibold text-slate-700">
                                            {(row.doi || 0).toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="font-medium text-slate-400 italic">
                                            Coming Soon
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                                            {(row.assortment || 0)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="inline-flex items-center justify-center rounded-md bg-green-50 px-2 py-1 font-semibold text-green-700">
                                            {(row.psl || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-6 text-center text-[12px] text-slate-400"
                                    >
                                        No brands matching current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

const SkuTable = ({ rows, loading }) => {
    return (
        <Card className="mt-3 border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b pb-2">
                <CardTitle className="text-sm font-medium text-slate-800">
                    SKUs ({rows.length || 0})
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
                <div className="max-h-[500px] overflow-auto rounded-md border">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 text-left">SKU</th>
                                <th className="px-3 py-2 text-left">Brand</th>
                                <th className="px-3 py-2 text-center">OSA</th>
                                <th className="px-3 py-2 text-center">DOI</th>
                                <th className="px-3 py-2 text-center">Fillrate</th>
                                <th className="px-3 py-2 text-center">Assortment</th>
                                <th className="px-3 py-2 text-center">PSL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-[12px] text-slate-400">
                                        <div className="animate-pulse">Loading competition data...</div>
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.slice(0, 8).map((row, idx) => (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        "hover:bg-slate-50",
                                        idx % 2 === 1 && "bg-slate-50/60"
                                    )}
                                >
                                    <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                                        {row.name}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-left text-[12px] text-slate-700">
                                        {row.brandName}
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="font-semibold text-slate-700">
                                            {(row.osa || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="font-semibold text-slate-700">
                                            {(row.doi || 0).toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="font-medium text-slate-400 italic">
                                            Coming Soon
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                                            {(row.assortment || 0)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[12px]">
                                        <span className="inline-flex items-center justify-center rounded-md bg-green-50 px-2 py-1 font-semibold text-green-700">
                                            {(row.psl || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-3 py-6 text-center text-[12px] text-slate-400"
                                    >
                                        No SKUs matching current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

/* -------------------------------------------------------------------------- */
/*                             Filter Dialog                                  */
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

                const response = await axiosInstance.get(`/availability-analysis/competition-filter-options?${params.toString()}`);

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

                    <div className="flex-1 px-6 py-4">
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

                        <ScrollArea className="mt-4 h-64 rounded-md border bg-slate-50/60">
                            <div className="space-y-1 p-3">
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
                                        className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100"
                                    >
                                        <Checkbox
                                            checked={value[currentKey].includes(item)}
                                            onCheckedChange={() => handleToggle(currentKey, item)}
                                        />
                                        <span className="truncate">{item}</span>
                                    </label>
                                ))}
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

/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

export const AvailabilityCompetitionKpiShowcase = ({ platform, globalFilters, period }) => {
    const [tab, setTab] = useState("brand");
    const [city, setCity] = useState("All India");
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [filters, setFilters] = useState({
        categories: [],
        brands: [],
        skus: [],
    });
    const [viewMode, setViewMode] = useState("table");

    const [competitionData, setCompetitionData] = useState({ brands: [], skus: [] });
    const [trendData, setTrendData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [availableCities, setAvailableCities] = useState(["All India"]);

    // Fetch dynamic city options
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await axiosInstance.get('/availability-analysis/competition-filter-options', {
                    params: { platform: platform || 'All' }
                });
                if (response.data && response.data.locations) {
                    setAvailableCities(response.data.locations);
                }
            } catch (error) {
                console.error('[AvailabilityCompetitionKpiShowcase] Error fetching cities:', error);
            }
        };
        fetchCities();
    }, [platform]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = {
                    platform: platform || 'All',
                    location: city === 'All India' ? 'All' : city,
                    category: filters.categories.length > 0 ? filters.categories.join(',') : 'All',
                    brand: filters.brands.length > 0 ? filters.brands.join(',') : 'All',
                    sku: filters.skus.length > 0 ? filters.skus.join(',') : 'All',
                    period: period || '1M',
                    startDate: globalFilters?.startDate,
                    endDate: globalFilters?.endDate
                };

                const response = await axiosInstance.get('/availability-analysis/competition', { params });
                if (response.data) {
                    setCompetitionData(response.data);
                }

                // Also fetch trend data if viewMode is trend
                if (viewMode === 'trend') {
                    const trendResponse = await axiosInstance.get('/availability-analysis/competition-brand-trends', {
                        params: { ...params, brands: params.brand }
                    });
                    if (trendResponse.data) {
                        setTrendData(trendResponse.data);
                    }
                }
            } catch (error) {
                console.error('[AvailabilityCompetitionKpiShowcase] Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [city, filters, platform, viewMode, globalFilters?.startDate, globalFilters?.endDate, period]);

    const selectionCount =
        filters.categories.length + filters.brands.length + filters.skus.length;

    const brandRows = useMemo(() => {
        return (competitionData.brands || []).map((b, idx) => ({
            id: b.brand || `brand-${idx}`,
            name: b.brand || 'Unknown',
            osa: b.osa || 0,
            doi: b.doi || 0,
            fillrate: b.fillrate || 0,
            assortment: b.assortment || 0,
            psl: b.psl || 0
        }));
    }, [competitionData.brands]);

    const skuRows = useMemo(() => {
        return (competitionData.skus || []).map((s, idx) => ({
            id: s.sku_name || `sku-${idx}`,
            name: s.sku_name || 'Unknown',
            brandName: s.brand_name || 'Unknown',
            osa: s.osa || 0,
            doi: s.doi || 0,
            fillrate: s.fillrate || 0,
            assortment: s.assortment || 0,
            psl: s.psl || 0
        }));
    }, [competitionData.skus]);

    return (
        <div className="flex-col bg-slate-50 text-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        {filters.categories.length > 0 ? (
                            filters.categories.map((c) => (
                                <Badge key={c} className="bg-blue-50 text-blue-700 border-blue-100">{c}</Badge>
                            ))
                        ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">All Categories</Badge>
                        )}
                        {filters.brands.map((b) => (
                            <Badge key={b} className="bg-indigo-50 text-indigo-700 border-indigo-100">{b}</Badge>
                        ))}
                    </div>
                    <h1 className="text-lg font-semibold text-slate-900">Competition List</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={city} onValueChange={setCity}>
                        <SelectTrigger className="h-9 w-40 bg-white">
                            <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableCities.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
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
                        onClick={() => setViewMode(viewMode === 'table' ? 'trend' : 'table')}
                    >
                        {viewMode === 'table' ? (
                            <><LineChartIcon className="mr-1.5 h-4 w-4" /> Trend</>
                        ) : (
                            <>Back to Table</>
                        )}
                    </Button>
                </div>
            </div>

            <Tabs
                value={tab}
                onValueChange={(v) => {
                    setTab(v);
                }}
                className="w-full"
            >
                <div className="flex items-center justify-between gap-3">
                    <TabsList className="bg-slate-100">
                        <TabsTrigger value="brand" className="px-4">Brands</TabsTrigger>
                        <TabsTrigger value="sku" className="px-4">SKUs</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="brand" className="mt-3">
                    {viewMode === "table" ? (
                        <BrandTable rows={brandRows} loading={loading} />
                    ) : (
                        <TrendView
                            mode="brand"
                            filters={filters}
                            city={city}
                            onBackToTable={() => setViewMode("table")}
                            apiTrendData={trendData}
                        />
                    )}
                </TabsContent>

                <TabsContent value="sku" className="mt-3">
                    {viewMode === "table" ? (
                        <SkuTable rows={skuRows} loading={loading} />
                    ) : (
                        <TrendView
                            mode="sku"
                            filters={filters}
                            city={city}
                            onBackToTable={() => setViewMode("table")}
                            apiTrendData={trendData}
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
                platform={platform}
                location={city}
            />
        </div>
    );
};

export default AvailabilityCompetitionKpiShowcase;
