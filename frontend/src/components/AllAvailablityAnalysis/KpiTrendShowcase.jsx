import React, {
    useMemo,
    useState,
    useContext,
    createContext,
} from "react";
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
    const base =
        orientation === "vertical"
            ? "h-full w-px"
            : "h-px w-full";
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
        <SelectContext.Provider
            value={{ value, onValueChange, open, setOpen }}
        >
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
        <span
            className={cn(
                "truncate",
                !value && "text-slate-400"
            )}
        >
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
/*                               Domain constants                             */
/* -------------------------------------------------------------------------- */

const CITIES = ["All India", "Delhi NCR", "Mumbai", "Bengaluru", "Kolkata"];
const CATEGORIES = ["Body Lotion", "Face Cream", "Soap"];
const BRANDS = [
    "My Brand",
    "Vaseline",
    "Nivea",
    "Parachute Advanced",
    "Boroplus",
    "Cetaphil",
    "Joy",
    "Biotique",
];
const SKUS = [
    "Vaseline 100ml",
    "Vaseline 200ml",
    "Nivea Soft 100ml",
    "Parachute Dry Skin 150ml",
    "Boroplus Aloe 100ml",
];

const DAYS = Array.from({ length: 20 }).map((_, i) => `0${i + 6} Nov'25`);

const buildSeries = (name, base) =>
    DAYS.map((d, idx) => ({
        date: d,
        brand: name,
        wtOsa: base + Math.sin(idx / 3) * 3,
        estCatShare: base / 3 + Math.cos(idx / 4) * 2,
        overallSov: base / 2 + Math.sin(idx / 5) * 4,
        adSov: base / 2 + Math.cos(idx / 6) * 5,
    }));

const BRAND_SERIES = [
    buildSeries("My Brand", 10),
    buildSeries("Vaseline", 95),
    buildSeries("Nivea", 90),
    buildSeries("Parachute Advanced", 92),
];

/* -------------------------------------------------------------------------- */
/*                               Filter Dialog                                */
/* -------------------------------------------------------------------------- */

const FilterDialog = ({ open, onClose, mode, value, onChange }) => {
    const [activeTab, setActiveTab] = useState(
        mode === "brand" ? "category" : "sku"
    );
    const [search, setSearch] = useState("");

    const handleToggle = (type, item) => {
        const current = new Set(value[type]);
        if (current.has(item)) current.delete(item);
        else current.add(item);
        onChange({ ...value, [type]: Array.from(current) });
    };

    const handleSelectAll = (type, items) => {
        const allSelected = items.every((i) => value[type].includes(i));
        onChange({ ...value, [type]: allSelected ? [] : items });
    };

    const tabOptions = useMemo(
        () => (mode === "sku" ? ["sku"] : ["category", "brand", "sku"]),
        [mode]
    );

    const getListForTab = () => {
        if (activeTab === "category") return CATEGORIES;
        if (activeTab === "brand") return BRANDS;
        return SKUS;
    };

    const list = useMemo(
        () =>
            getListForTab().filter((item) =>
                item.toLowerCase().includes(search.toLowerCase())
            ),
        [activeTab, search]
    );

    const currentKey =
        activeTab === "category"
            ? "categories"
            : activeTab === "brand"
                ? "brands"
                : "skus";

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-4xl gap-0 p-0">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle className="text-lg font-semibold">
                        Filters
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-[360px]">
                    {/* Left rail */}
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
                                {tabOptions.map((t) => (
                                    <TabsTrigger
                                        key={t}
                                        value={t}
                                        className={cn(
                                            "justify-start rounded-lg px-3 py-2 text-sm font-medium",
                                            "data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                        )}
                                    >
                                        {t === "category" && "Category"}
                                        {t === "brand" && "Brand"}
                                        {t === "sku" && "SKU"}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Main pane */}
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
                                onClick={() => handleSelectAll(currentKey, getListForTab())}
                            >
                                {getListForTab().every((i) =>
                                    value[currentKey].includes(i)
                                )
                                    ? "Clear all"
                                    : "Select all"}
                            </button>
                        </div>

                        <ScrollArea className="mt-4 h-64 rounded-md border bg-slate-50/60">
                            <div className="space-y-1 p-3">
                                {list.map((item) => (
                                    <label
                                        key={item}
                                        className="flex cursor-pointer items-center gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-slate-100"
                                    >
                                        <Checkbox
                                            checked={value[currentKey].includes(item)}
                                            onCheckedChange={() =>
                                                handleToggle(currentKey, item)
                                            }
                                        />
                                        <span className="truncate">{item}</span>
                                    </label>
                                ))}

                                {list.length === 0 && (
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

/* -------------------------------------------------------------------------- */
/*                                Trend View                                  */
/* -------------------------------------------------------------------------- */

const TrendView = ({ filters, city, onBackToTable, onSwitchToKpi }) => {
    const selectedBrands = filters.brands.length
        ? filters.brands
        : ["My Brand", "Vaseline", "Nivea"];

    const data = useMemo(
        () =>
            DAYS.map((date, idx) => {
                const row = { date };
                BRAND_SERIES.forEach((series) => {
                    const point = series[idx];
                    if (selectedBrands.includes(point.brand)) {
                        row[`${point.brand}_wtOsa`] = point.wtOsa;
                    }
                });
                return row;
            }),
        [selectedBrands]
    );

    return (
        <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                        Wt. OSA % trend
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>Brands:</span>
                        {selectedBrands.map((b) => (
                            <Badge
                                key={b}
                                className="border-slate-200 bg-slate-50"
                            >
                                {b}
                            </Badge>
                        ))}
                        <Separator orientation="vertical" className="mx-1 h-4" />
                        <span>{city}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onSwitchToKpi}>
                        <BarChart3 className="mr-1 h-4 w-4" /> Compare by KPIs
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onBackToTable}>
                        Back to list
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={data}
                            margin={{ top: 12, left: -16, right: 12 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="date"
                                fontSize={11}
                                tickLine={false}
                                dy={6}
                            />
                            <YAxis
                                domain={[80, 110]}
                                tickFormatter={(v) => `${v}%`}
                                fontSize={11}
                                tickLine={false}
                            />
                            <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {selectedBrands.map((brand) => (
                                <Line
                                    key={brand}
                                    type="monotone"
                                    dataKey={`${brand}_wtOsa`}
                                    name={brand}
                                    dot={false}
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

/* -------------------------------------------------------------------------- */
/*                             KPI Compare View                               */
/* -------------------------------------------------------------------------- */

const KPI_KEYS = [
    { key: "estCatShare", label: "Est. Category Share" },
    { key: "wtOsa", label: "Wt. OSA %" },
    { key: "overallSov", label: "Overall SOV" },
    { key: "adSov", label: "Ad SOV" },
];

const KpiCompareView = ({ filters, city, onBackToTrend }) => {
    const selectedBrands = filters.brands.length
        ? filters.brands
        : ["My Brand", "Vaseline", "Nivea"];

    const baseData = useMemo(() => {
        const byBrand = {};
        BRAND_SERIES.forEach((series) => {
            byBrand[series[0].brand] = series;
        });
        return { byBrand };
    }, []);

    const chartDataFor = (key) =>
        DAYS.map((date, idx) => {
            const row = { date };
            selectedBrands.forEach((brand) => {
                const series = baseData.byBrand[brand];
                if (series) {
                    row[brand] = series[idx][key];
                }
            });
            return row;
        });

    return (
        <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                        Compare by KPIs
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>Brands:</span>
                        {selectedBrands.map((b) => (
                            <Badge
                                key={b}
                                className="border-slate-200 bg-slate-50"
                            >
                                {b}
                            </Badge>
                        ))}
                        <Separator orientation="vertical" className="mx-1 h-4" />
                        <span>{city}</span>
                    </div>
                </div>

                <Button variant="ghost" size="sm" onClick={onBackToTrend}>
                    Back to trend
                </Button>
            </CardHeader>

            <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
                {KPI_KEYS.map((kpi) => (
                    <Card
                        key={kpi.key}
                        className="border-slate-200 bg-slate-50/80 shadow-none hover:bg-slate-50"
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">
                                {kpi.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-48 pt-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartDataFor(kpi.key)}
                                    margin={{ top: 8, left: -16, right: 8 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <XAxis dataKey="date" hide />
                                    <YAxis
                                        tickLine={false}
                                        fontSize={10}
                                        width={32}
                                    />
                                    <Tooltip />
                                    {selectedBrands.map((brand) => (
                                        <Line
                                            key={brand}
                                            type="monotone"
                                            dataKey={brand}
                                            name={brand}
                                            dot={false}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                ))}
            </CardContent>
        </Card>
    );
};

/* -------------------------------------------------------------------------- */
/*                                 Tables                                     */
/* -------------------------------------------------------------------------- */

const BrandTable = () => (
    <Card className="mt-3">
        <CardHeader className="border-b pb-2">
            <CardTitle className="text-sm font-medium text-slate-800">
                Brands (Top 50)
            </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
            <div className="max-h-[380px] overflow-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Brand</th>
                            <th className="px-3 py-2 text-right">
                                Est. Cat. Share
                            </th>
                            <th className="px-3 py-2 text-right">Wt. OSA %</th>
                            <th className="px-3 py-2 text-right">Overall SOV</th>
                            <th className="px-3 py-2 text-right">Ad SOV</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {BRANDS.map((b, idx) => (
                            <tr
                                key={b}
                                className={cn(
                                    "hover:bg-slate-50",
                                    idx % 2 === 1 && "bg-slate-50/60"
                                )}
                            >
                                <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                                    {b}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(20 + idx * 1.3).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(90 + idx * 0.5).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(25 + idx * 0.8).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(18 + idx * 0.6).toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
);

const SkuTable = () => (
    <Card className="mt-3 border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b pb-2">
            <CardTitle className="text-sm font-medium text-slate-800">
                SKUs
            </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
            <div className="max-h-[380px] overflow-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-right">Wt. OSA %</th>
                            <th className="px-3 py-2 text-right">Overall SOV</th>
                            <th className="px-3 py-2 text-right">Ad SOV</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {SKUS.map((s, idx) => (
                            <tr
                                key={s}
                                className={cn(
                                    "hover:bg-slate-50",
                                    idx % 2 === 1 && "bg-slate-50/60"
                                )}
                            >
                                <td className="whitespace-nowrap px-3 py-2 text-left text-[13px] font-medium text-slate-800">
                                    {s}
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(88 + idx * 0.7).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(30 + idx * 0.9).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right text-[12px]">
                                    {(22 + idx * 0.4).toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
);

/* -------------------------------------------------------------------------- */
/*                             Main Component                                 */
/* -------------------------------------------------------------------------- */

export const KpiTrendShowcase = () => {
    const [tab, setTab] = useState("brand");
    const [city, setCity] = useState(CITIES[0]);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [filters, setFilters] = useState({
        categories: [],
        brands: [],
        skus: [],
    });
    const [viewMode, setViewMode] = useState("table");

    const selectionCount =
        filters.categories.length +
        filters.brands.length +
        filters.skus.length;

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 px-6 py-4 text-slate-900">
            {/* Header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            Competition
                        </span>
                        <span className="text-xs">at MRP for</span>
                        <Badge className="border-blue-200 bg-blue-50 text-xs">
                            Body Lotion
                        </Badge>
                    </div>
                    <h1 className="text-lg font-semibold text-slate-900">
                        Competition List
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={city} onValueChange={setCity}>
                        <SelectTrigger className="h-9 w-40 bg-white">
                            <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                            {CITIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                    {c}
                                </SelectItem>
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
                        onClick={() => setViewMode("trend")}
                    >
                        <LineChartIcon className="mr-1.5 h-4 w-4" />
                        Trend
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs
                value={tab}
                onValueChange={setTab}
                className="w-full"
            >
                <div className="flex items-center justify-between gap-3">
                    <TabsList className="bg-slate-100">
                        <TabsTrigger value="brand" className="px-4">
                            Brands
                        </TabsTrigger>
                        <TabsTrigger value="sku" className="px-4">
                            SKUs
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {selectionCount > 0 ? (
                            <span>{selectionCount} filter(s) applied</span>
                        ) : (
                            <span>No filters applied</span>
                        )}
                    </div>
                </div>

                {/* Brand Tab */}
                <TabsContent value="brand" className="mt-3">
                    {viewMode === "table" && <BrandTable />}
                    {viewMode === "trend" && (
                        <TrendView
                            filters={filters}
                            city={city}
                            onBackToTable={() => setViewMode("table")}
                            onSwitchToKpi={() => setViewMode("kpi")}
                        />
                    )}
                    {viewMode === "kpi" && (
                        <KpiCompareView
                            filters={filters}
                            city={city}
                            onBackToTrend={() => setViewMode("trend")}
                        />
                    )}
                </TabsContent>

                {/* SKU tab */}
                <TabsContent value="sku" className="mt-3">
                    {viewMode === "table" && <SkuTable />}
                    {viewMode === "trend" && (
                        <TrendView
                            filters={filters}
                            city={city}
                            onBackToTable={() => setViewMode("table")}
                            onSwitchToKpi={() => setViewMode("kpi")}
                        />
                    )}
                    {viewMode === "kpi" && (
                        <KpiCompareView
                            filters={filters}
                            city={city}
                            onBackToTrend={() => setViewMode("trend")}
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
            />
        </div>
    );
};

export default KpiTrendShowcase;
