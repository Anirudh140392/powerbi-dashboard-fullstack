import React, { useState, useMemo, useEffect, useContext } from 'react';
import { Skeleton } from '@mui/material';
import {
    ChevronRight,
    ChevronDown,
    Search,
    Download,
    Layers,
    Monitor,
    Grid3X3,
    Tag,
    Package,
    Maximize2,
    Minimize2,
    Sparkles,
    HelpCircle,
    ArrowUpDown,
    Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { FilterContext } from '../../utils/FilterContext';
import axiosInstance from '../../api/axiosInstance';

// Currency & Percentage Formatting Helpers
const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} Lac`;
    if (val >= 1000) return `₹ ${(val / 1000).toFixed(2)} K`;
    return `₹ ${val.toFixed(2)}`;
};

const formatPercent = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toFixed(2)}%`;
};

export default function MarketShareProductDrilldown() {
    // Global filter context from dashboard (consume selectedChannel from sidebar)
    const {
        selectedChannel,
        selectedCategory,
        selectedBrand,
        selectedLocation,
        timeStart,
        timeEnd,
        selectedSubCategory,
        selectedSubBrand,
    } = useContext(FilterContext);

    // Dynamic data state from rb_ms_olap backend API
    const [treeData, setTreeData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Interactive UI controls (platform filter is handled locally within segment across all channel platforms)
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('All');
    const [levelFilter, setLevelFilter] = useState('all'); // 'all', 'platform', 'category', 'brand', 'product'
    const [sortBy, setSortBy] = useState('sales_desc');

    // Track which nodes are expanded (Set of node IDs)
    const [expandedNodes, setExpandedNodes] = useState(() => new Set());

    // Reset local platform filter whenever sidebar channel changes
    useEffect(() => {
        setSelectedPlatform('All');
    }, [selectedChannel]);

    // Fetch live hierarchical drilldown data from backend rb_ms_olap API based on sidebar channel
    useEffect(() => {
        let isMounted = true;
        const fetchDrilldownData = async () => {
            setLoading(true);
            try {
                const params = {
                    channel: selectedChannel === 'All' ? undefined : selectedChannel,
                    // Do not restrict to single sidebar platform; return all platforms for the selected channel
                    category: selectedCategory === 'All' ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
                    brand: selectedBrand === 'All' ? undefined : (Array.isArray(selectedBrand) ? selectedBrand.join(",") : selectedBrand),
                    subCategory: selectedSubCategory === 'All' ? undefined : (Array.isArray(selectedSubCategory) ? selectedSubCategory.join(",") : selectedSubCategory),
                    subBrand: selectedSubBrand === 'All' ? undefined : (Array.isArray(selectedSubBrand) ? selectedSubBrand.join(",") : selectedSubBrand),
                    location: selectedLocation === 'All' ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(",") : selectedLocation),
                    startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
                    endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
                };

                const res = await axiosInstance.get('/market-share/product-drilldown', { params });
                if (isMounted && res.data && Array.isArray(res.data.data)) {
                    const data = res.data.data;
                    setTreeData(data);

                    // Automatically expand the first platform and its top category on initial load
                    if (data.length > 0) {
                        const initialExpanded = new Set();
                        const firstPlat = data[0];
                        initialExpanded.add(firstPlat.id);
                        if (firstPlat.children && firstPlat.children.length > 0) {
                            initialExpanded.add(firstPlat.children[0].id);
                        }
                        setExpandedNodes(initialExpanded);
                    }
                }
            } catch (err) {
                console.error('[MarketShareProductDrilldown] Error fetching live data:', err);
                if (isMounted) setTreeData([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDrilldownData();

        return () => {
            isMounted = false;
        };
    }, [selectedChannel, selectedCategory, selectedBrand, selectedLocation, timeStart, timeEnd, selectedSubCategory, selectedSubBrand]);

    // Available platforms derived dynamically from the loaded dataset
    const availablePlatforms = useMemo(() => {
        const pSet = new Set();
        treeData.forEach((p) => {
            if (p.platform) pSet.add(p.platform);
        });
        return Array.from(pSet);
    }, [treeData]);

    const toggleNode = (nodeId) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const expandAll = () => {
        const allIds = new Set();
        const collect = (nodes) => {
            nodes.forEach((n) => {
                if (n.children && n.children.length > 0) {
                    allIds.add(n.id);
                    collect(n.children);
                }
            });
        };
        collect(treeData);
        setExpandedNodes(allIds);
    };

    const collapseAll = () => {
        setExpandedNodes(new Set());
    };

    // Flatten tree based on expanded state and active search / filters
    const flattenedRows = useMemo(() => {
        const rows = [];

        const walk = (node, depth = 0, parentMatches = false) => {
            const searchLower = searchTerm.trim().toLowerCase();
            const matchesSearch =
                !searchLower ||
                node.name?.toLowerCase().includes(searchLower) ||
                node.platform?.toLowerCase().includes(searchLower) ||
                node.category?.toLowerCase().includes(searchLower) ||
                node.brand?.toLowerCase().includes(searchLower) ||
                node.product?.toLowerCase().includes(searchLower);

            // Platform Filter check (for root level platforms)
            if (depth === 0 && selectedPlatform !== 'All' && node.platform !== selectedPlatform) {
                return;
            }

            // Level filter check
            const matchesLevel = levelFilter === 'all' || node.level === levelFilter;

            const isExpanded = expandedNodes.has(node.id) || !!searchLower;
            const hasChildren = Boolean(node.children && node.children.length > 0);

            // If searching, include node if it matches OR any child matches
            const shouldInclude = matchesSearch || parentMatches;

            if (shouldInclude && matchesLevel) {
                rows.push({
                    ...node,
                    depth,
                    isExpanded,
                    hasChildren
                });
            }

            if (hasChildren && (isExpanded || searchLower)) {
                let childrenToWalk = [...node.children];
                if (sortBy === 'sales_desc') {
                    childrenToWalk.sort((a, b) => (b.ownBrandSales || 0) - (a.ownBrandSales || 0));
                } else if (sortBy === 'share_desc') {
                    childrenToWalk.sort((a, b) => (b.marketShare || 0) - (a.marketShare || 0));
                } else if (sortBy === 'size_desc') {
                    childrenToWalk.sort((a, b) => (b.categorySize || 0) - (a.categorySize || 0));
                }
                childrenToWalk.forEach((child) => walk(child, depth + 1, shouldInclude));
            }
        };

        let rootNodes = [...treeData];
        if (sortBy === 'sales_desc') {
            rootNodes.sort((a, b) => (b.ownBrandSales || 0) - (a.ownBrandSales || 0));
        } else if (sortBy === 'share_desc') {
            rootNodes.sort((a, b) => (b.marketShare || 0) - (a.marketShare || 0));
        } else if (sortBy === 'size_desc') {
            rootNodes.sort((a, b) => (b.categorySize || 0) - (a.categorySize || 0));
        }
        rootNodes.forEach((platNode) => walk(platNode, 0));

        return rows;
    }, [expandedNodes, searchTerm, selectedPlatform, levelFilter, sortBy, treeData]);

    // Export to Excel
    const handleExport = () => {
        const flatList = [];
        const extractLeaves = (nodes) => {
            nodes.forEach((n) => {
                flatList.push({
                    'Level': n.level.toUpperCase(),
                    'Platform': n.platform || '—',
                    'Category': n.category || '—',
                    'Brand': n.brand || '—',
                    'Product': n.product || '—',
                    'Own Brand Sales (₹)': n.ownBrandSales || 0,
                    'Category Size (₹)': n.categorySize || 0,
                    'Market Share (%)': n.marketShare ? Number(n.marketShare.toFixed(2)) : 0
                });
                if (n.children && n.children.length > 0) {
                    extractLeaves(n.children);
                }
            });
        };
        extractLeaves(treeData);

        const ws = XLSX.utils.json_to_sheet(flatList);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Market_Share_Hierarchy');
        XLSX.writeFile(wb, `Market_Share_Platform_Category_Brand_Product.xlsx`);
    };

    // Level Badge Renderer
    const renderLevelBadge = (level, isOurBrand) => {
        switch (level) {
            case 'platform':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wider">
                        <Monitor size={10} className="text-indigo-600" />
                        Platform
                    </span>
                );
            case 'category':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60 uppercase tracking-wider">
                        <Grid3X3 size={10} className="text-sky-600" />
                        Category
                    </span>
                );
            case 'brand':
                return (
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                            isOurBrand
                                ? "bg-amber-50 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                        )}
                    >
                        <Tag size={10} className={isOurBrand ? "text-amber-600" : "text-slate-500"} />
                        {isOurBrand ? "Our Brand" : "Competitor"}
                    </span>
                );
            case 'product':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase tracking-wider">
                        <Package size={10} className="text-emerald-600" />
                        Product SKU
                    </span>
                );
            default:
                return null;
        }
    };

    // Market Share Color Bar
    const getShareColor = (share) => {
        if (share >= 15) return 'bg-emerald-500 text-emerald-700';
        if (share >= 10) return 'bg-teal-500 text-teal-700';
        if (share >= 5) return 'bg-indigo-500 text-indigo-700';
        return 'bg-amber-500 text-amber-700';
    };

    return (
        <div className="rounded-3xl bg-white shadow-sm border border-slate-200/80 p-5 md:p-6 mb-8 mt-6">
            {/* 1. Header & Title Banner */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-start gap-3.5">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
                        <Layers size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">
                                Platform & Product Market Share Drilldown
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                                4-Level Drilldown
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                                Platform → Category → Brand → Product
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50/70 text-indigo-700 border border-indigo-200/50">
                                Channel: {selectedChannel && selectedChannel !== "All" ? selectedChannel : "All Channels"}
                            </span>
                            {loading && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Loader2 size={11} className="animate-spin text-amber-600" />
                                    Querying rb_ms_olap...
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Interactive hierarchical matrix exploring Own Brand Sales, Category Size, and Market Share from platform down to individual product SKUs.
                        </p>
                    </div>
                </div>

                {/* Actions: Expand/Collapse & Export */}
                <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
                    <button
                        onClick={expandAll}
                        disabled={loading || treeData.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold transition-all shadow-2xs"
                        title="Expand all levels"
                    >
                        <Maximize2 size={13} />
                        Expand All
                    </button>
                    <button
                        onClick={collapseAll}
                        disabled={loading || treeData.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold transition-all shadow-2xs"
                        title="Collapse all levels"
                    >
                        <Minimize2 size={13} />
                        Collapse All
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading || treeData.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm shadow-slate-200"
                    >
                        <Download size={13} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Interactive Filtering Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 rounded-2xl p-3 border border-slate-100 my-4">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search platform, category, brand, or SKU..."
                        className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Platform Filter Select */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden lg:inline">
                        Platform:
                    </span>
                    <select
                        value={selectedPlatform}
                        onChange={(e) => setSelectedPlatform(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="All">All Platforms ({availablePlatforms.length})</option>
                        {availablePlatforms.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* Sort By Select */}
                <div className="flex items-center gap-1.5">
                    <ArrowUpDown size={13} className="text-slate-400 hidden lg:inline" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="sales_desc">Sort: Sales (High → Low)</option>
                        <option value="share_desc">Sort: Market Share (%)</option>
                        <option value="size_desc">Sort: Category Size</option>
                    </select>
                </div>

                {/* Level Quick-Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
                        View Level:
                    </span>
                    {[
                        { key: 'all', label: 'All Levels' },
                        { key: 'platform', label: 'Platforms' },
                        { key: 'category', label: 'Categories' },
                        { key: 'brand', label: 'Brands' },
                        { key: 'product', label: 'Products' }
                    ].map((lvl) => (
                        <button
                            key={lvl.key}
                            onClick={() => setLevelFilter(lvl.key)}
                            className={cn(
                                "px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                levelFilter === lvl.key
                                    ? "bg-indigo-600 text-white shadow-2xs shadow-indigo-200"
                                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                            )}
                        >
                            {lvl.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4-Level Drilldown Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                    {/* Table Header */}
                    <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider">
                            <th className="py-3 px-4 min-w-[320px]">
                                Entity Hierarchy (Platform → Category → Brand → Product)
                            </th>
                            <th className="py-3 px-3.5 min-w-[110px]">Platform</th>
                            <th className="py-3 px-3.5 min-w-[150px]">Category</th>
                            <th className="py-3 px-3.5 min-w-[130px]">Brand</th>
                            <th className="py-3 px-3.5 min-w-[200px]">Product / SKU</th>
                            <th className="py-3 px-4 text-right min-w-[140px]">
                                Own Brand Sales
                            </th>
                            <th className="py-3 px-4 text-right min-w-[140px]">
                                Category Size
                            </th>
                            <th className="py-3 px-4 text-right min-w-[160px]">
                                Market Share (%)
                            </th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? (
                            // Skeleton Loader during API response time
                            [...Array(6)].map((_, i) => (
                                <tr key={"drilldown-skeleton-" + i} className="border-b border-slate-100">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 24}px` }}>
                                            <Skeleton variant="circular" width={16} height={16} />
                                            <Skeleton variant="rounded" width={65} height={18} />
                                            <Skeleton variant="text" width={130 + (i * 30) % 90} height={18} />
                                        </div>
                                    </td>
                                    <td className="py-3 px-3.5"><Skeleton variant="rounded" width={70} height={20} /></td>
                                    <td className="py-3 px-3.5"><Skeleton variant="text" width={110} height={18} /></td>
                                    <td className="py-3 px-3.5"><Skeleton variant="text" width={80} height={18} /></td>
                                    <td className="py-3 px-3.5"><Skeleton variant="text" width={150} height={18} /></td>
                                    <td className="py-3 px-4 text-right"><Skeleton variant="rounded" width={85} height={22} className="ml-auto" /></td>
                                    <td className="py-3 px-4 text-right"><Skeleton variant="text" width={85} height={18} className="ml-auto" /></td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Skeleton variant="rounded" width={60} height={6} className="hidden sm:block" />
                                            <Skeleton variant="rounded" width={55} height={20} />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : flattenedRows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-slate-400">
                                    <Layers className="mx-auto text-slate-300 mb-2" size={32} />
                                    <div className="font-bold text-sm text-slate-600">No records found</div>
                                    <p className="text-xs text-slate-400 mt-1">Try resetting search or level filters.</p>
                                </td>
                            </tr>
                        ) : (
                            flattenedRows.map((row) => {
                                const indentPadding = row.depth * 24; // Indent 24px per level
                                const isPlatformRow = row.level === 'platform';
                                const isCategoryRow = row.level === 'category';
                                const isBrandRow = row.level === 'brand';
                                const isProductRow = row.level === 'product';

                                return (
                                    <tr
                                        key={row.id}
                                        onClick={() => row.hasChildren && toggleNode(row.id)}
                                        className={cn(
                                            "transition-colors duration-150 group",
                                            row.hasChildren ? "cursor-pointer hover:bg-slate-50/80" : "hover:bg-slate-50/40",
                                            isPlatformRow && "bg-slate-50/60 font-semibold",
                                            isCategoryRow && "bg-sky-50/20",
                                            isBrandRow && (row.isOurBrand ? "bg-amber-50/15" : "bg-white"),
                                            isProductRow && "bg-white"
                                        )}
                                    >
                                        {/* Column 1: Drilldown Tree Name + Level Badge */}
                                        <td className="py-2.5 px-4">
                                            <div
                                                className="flex items-center gap-2"
                                                style={{ paddingLeft: `${indentPadding}px` }}
                                            >
                                                {/* Expand / Collapse Chevron */}
                                                {row.hasChildren ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleNode(row.id);
                                                        }}
                                                        className="h-5 w-5 rounded-md hover:bg-slate-200/80 flex items-center justify-center text-slate-500 transition-colors flex-shrink-0"
                                                    >
                                                        {row.isExpanded ? (
                                                            <ChevronDown size={14} className="text-slate-700" />
                                                        ) : (
                                                            <ChevronRight size={14} className="text-slate-500" />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="w-5 flex-shrink-0 text-center text-slate-300 text-xs font-mono">•</span>
                                                )}

                                                {/* Level Pill */}
                                                {renderLevelBadge(row.level, row.isOurBrand)}

                                                {/* Node Name */}
                                                <span
                                                    className={cn(
                                                        "truncate max-w-[280px]",
                                                        isPlatformRow && "font-black text-slate-900 text-[13px]",
                                                        isCategoryRow && "font-bold text-slate-800 text-[12px]",
                                                        isBrandRow && "font-bold text-slate-700",
                                                        isProductRow && "font-medium text-slate-600 text-[11px]"
                                                    )}
                                                    title={row.name}
                                                >
                                                    {row.name}
                                                </span>

                                                {/* Child Count Chip */}
                                                {row.children && row.children.length > 0 && (
                                                    <span className="ml-1 text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.2 border border-slate-200/50">
                                                        {row.children.length}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Column 2: Platform */}
                                        <td className="py-2.5 px-3.5 text-slate-700 font-bold whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-700 font-bold text-[11px] border border-slate-200/60">
                                                {row.platform}
                                            </span>
                                        </td>

                                        {/* Column 3: Category */}
                                        <td className="py-2.5 px-3.5 text-slate-600 truncate max-w-[150px]" title={row.category}>
                                            <span className="text-[11px] text-slate-700 font-medium">
                                                {row.category}
                                            </span>
                                        </td>

                                        {/* Column 4: Brand */}
                                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-1 font-bold text-[11px]",
                                                    row.isOurBrand ? "text-indigo-900 font-black" : "text-slate-600"
                                                )}
                                            >
                                                {row.brand}
                                                {row.isOurBrand && (
                                                    <Sparkles size={11} className="text-amber-500 fill-amber-500" />
                                                )}
                                            </span>
                                        </td>

                                        {/* Column 5: Product */}
                                        <td className="py-2.5 px-3.5 text-slate-600 max-w-[200px] truncate" title={row.product}>
                                            <span className={cn("text-[11px]", isProductRow ? "text-slate-800 font-medium" : "text-slate-400 italic")}>
                                                {row.product}
                                            </span>
                                        </td>

                                        {/* Column 6: Own Brand Sales */}
                                        <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono font-bold">
                                            {row.ownBrandSales > 0 ? (
                                                <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50/70 text-indigo-700 border border-indigo-100 text-[12px] font-extrabold">
                                                    {formatCurrency(row.ownBrandSales)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>

                                        {/* Column 7: Category Size */}
                                        <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono font-semibold text-slate-700">
                                            {formatCurrency(row.categorySize)}
                                        </td>

                                        {/* Column 8: Market Share (%) + Progress Bar */}
                                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {/* Mini Bar */}
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className={cn("h-full rounded-full transition-all", getShareColor(row.marketShare))}
                                                        style={{ width: `${Math.min(100, (row.marketShare || 0) * 3)}%` }}
                                                    />
                                                </div>
                                                <span
                                                    className={cn(
                                                        "font-mono font-black text-xs px-2 py-0.5 rounded-md",
                                                        row.marketShare >= 15
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : row.marketShare >= 10
                                                                ? "bg-teal-50 text-teal-700 border border-teal-200"
                                                                : row.marketShare >= 5
                                                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                                    )}
                                                >
                                                    {formatPercent(row.marketShare)}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Info & Notes */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 mt-4 px-1 gap-2">
                <div className="flex items-center gap-1.5">
                    <HelpCircle size={13} className="text-slate-400" />
                    <span>Click any row with chevrons to drill down deeper into <strong>Platform → Category → Brand → Product</strong></span>
                </div>
                <div className="font-semibold text-slate-500">
                    Showing {flattenedRows.length} visible rows across {treeData.length} platforms
                </div>
            </div>
        </div>
    );
}
