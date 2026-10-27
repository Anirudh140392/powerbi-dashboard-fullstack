import React, { useState, useMemo, useEffect } from 'react';
import { 
    PieChart, 
    Pie, 
    Cell, 
    Sector,
    ResponsiveContainer 
} from 'recharts';
import { 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Search, 
    Activity, 
    Layers,
    ArrowUpRight,
    Info,
    Inbox
} from 'lucide-react';
import { Skeleton, Tooltip as MuiTooltip } from '@mui/material';

const STATUS_CONFIG = {
    Success: {
        label: 'Success',
        color: '#10b981', // Green
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        activeRing: 'ring-emerald-500 border-emerald-500',
        dotBg: 'bg-emerald-500',
        icon: CheckCircle2,
        description: '2xx responses within SLA latency (< 5000ms)',
    },
    Empty: {
        label: 'Empty (200 OK)',
        color: '#8b5cf6', // Violet / Purple
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
        activeRing: 'ring-purple-500 border-purple-500',
        dotBg: 'bg-purple-500',
        icon: Inbox,
        description: 'Status 200 OK with empty body/payload (0 records)',
    },
    Slow: {
        label: 'Slow API',
        color: '#f59e0b', // Yellow / Amber
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        activeRing: 'ring-amber-500 border-amber-500',
        dotBg: 'bg-amber-500',
        icon: Clock,
        description: '2xx responses exceeding 5000ms SLA limit',
    },
    Failed: {
        label: 'Failed API',
        color: '#ef4444', // Red
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        activeRing: 'ring-rose-500 border-rose-500',
        dotBg: 'bg-rose-500',
        icon: XCircle,
        description: 'Non-2xx status codes, timeouts, or network errors',
    },
};

/**
 * Custom active shape for hovered pie slice (outer ring or standard).
 * Expands outerRadius outward (+6px) while keeping innerRadius fixed at 68px
 * so the center hole and text remain 100% visible and untouched.
 */
const renderActiveSector = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={3}
                cornerRadius={5}
            />
        </g>
    );
};

/**
 * Custom active shape for inner ring (Yesterday's run).
 */
const renderActiveSectorInner = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 4}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={2.5}
                cornerRadius={4}
            />
        </g>
    );
};

const DEFAULT_BREAKDOWN = [
    { name: 'Success', status: 'Success', value: 0, percentage: 0, color: '#10b981', apis: [] },
    { name: 'Empty (200 OK)', status: 'Empty', value: 0, percentage: 0, color: '#8b5cf6', apis: [] },
    { name: 'Slow', status: 'Slow', value: 0, percentage: 0, color: '#f59e0b', apis: [] },
    { name: 'Failed', status: 'Failed', value: 0, percentage: 0, color: '#ef4444', apis: [] },
];

export default function ApiHealthPieChart({
    distribution,
    loading = false,
    selectedStatus = 'All',
    selectedEmptyResponse = 'All',
    onSelectStatus,
}) {
    // Default to '2days' combined view so both days are shown together
    const [scope, setScope] = useState('2days');
    // For 2-day view: 'concentric' (Dual Concentric Rings: Outer Today + Inner Yesterday) vs 'segmented' (Single Ring with Day Slices)
    const [chartViewMode, setChartViewMode] = useState('concentric');

    // Extract scoped breakdown
    const currentScopeData = useMemo(() => {
        if (!distribution?.scopes) {
            return {
                label: 'Last 2 Days Combined',
                total: distribution?.total ?? 0,
                breakdown: distribution?.breakdown || DEFAULT_BREAKDOWN,
            };
        }
        return distribution.scopes[scope] || distribution.scopes['2days'] || distribution.scopes['today'];
    }, [distribution, scope]);

    const breakdown = useMemo(() => {
        return currentScopeData?.breakdown || DEFAULT_BREAKDOWN;
    }, [currentScopeData?.breakdown]);

    const total = currentScopeData?.total ?? breakdown.reduce((sum, b) => sum + (b.value || 0), 0);

    // Today & Yesterday scopes for 2-day multi-ring differentiation
    const todayScope = useMemo(() => {
        return distribution?.scopes?.['today'] || distribution?.scopes?.['2days']?.today || distribution?.daysData?.today;
    }, [distribution]);

    const yesterdayScope = useMemo(() => {
        return distribution?.scopes?.['2days']?.yesterday || distribution?.daysData?.yesterday;
    }, [distribution]);

    const todayChartData = useMemo(() => {
        const raw = todayScope?.breakdown || breakdown;
        return raw.filter(b => b.value > 0).map(b => ({
            ...b,
            day: 'Today',
            ring: 'outer',
            dayLabel: todayScope?.label || 'Today',
        }));
    }, [todayScope, breakdown]);

    const yesterdayChartData = useMemo(() => {
        const raw = yesterdayScope?.breakdown || [];
        return raw.filter(b => b.value > 0).map(b => ({
            ...b,
            day: 'Yesterday',
            ring: 'inner',
            dayLabel: yesterdayScope?.label || 'Yesterday',
            color: b.status === 'Success' 
                ? '#06b6d4' 
                : b.status === 'Empty' 
                ? '#a78bfa' 
                : b.color, // Cyan for Success, Lavender for Empty so each day is clearly distinct!
        }));
    }, [yesterdayScope]);

    // Active status being viewed in the list (clicked or selected)
    // Prioritize showing issues (Failed, Slow, Empty) if present, otherwise Success
    const defaultActiveStatus = useMemo(() => {
        const failedItem = breakdown.find(b => b.status === 'Failed');
        if (failedItem && failedItem.value > 0) return 'Failed';
        const slowItem = breakdown.find(b => b.status === 'Slow');
        if (slowItem && slowItem.value > 0) return 'Slow';
        const emptyItem = breakdown.find(b => b.status === 'Empty');
        if (emptyItem && emptyItem.value > 0) return 'Empty';
        return 'Success';
    }, [breakdown]);

    const [activeStatus, setActiveStatus] = useState(defaultActiveStatus);
    const [hoveredSlice, setHoveredSlice] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pageFilter, setPageFilter] = useState('All');

    // Keep active status updated if breakdown loads or external filter changes
    useEffect(() => {
        if (selectedEmptyResponse === '1') {
            setActiveStatus('Empty');
        } else if (selectedStatus && selectedStatus !== 'All' && STATUS_CONFIG[selectedStatus]) {
            setActiveStatus(selectedStatus);
        } else {
            setActiveStatus(defaultActiveStatus);
        }
    }, [selectedStatus, selectedEmptyResponse, defaultActiveStatus]);

    // Active slice data for the inspection panel
    const activeSlice = useMemo(() => {
        return breakdown.find(b => b.status === activeStatus) || breakdown[0];
    }, [breakdown, activeStatus]);

    // Distinct pages in active slice for mini-filter chips
    const availablePagesInActive = useMemo(() => {
        if (!activeSlice?.apis) return [];
        const pages = new Set(activeSlice.apis.map(a => a.page).filter(Boolean));
        return ['All', ...Array.from(pages)];
    }, [activeSlice]);

    // Filtered APIs in the active slice based on search & page filter
    const displayedApis = useMemo(() => {
        if (!activeSlice?.apis) return [];
        return activeSlice.apis.filter(api => {
            const matchesSearch = !searchTerm 
                || (api.api && api.api.toLowerCase().includes(searchTerm.toLowerCase()))
                || (api.page && api.page.toLowerCase().includes(searchTerm.toLowerCase()))
                || (api.segment && api.segment.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesPage = pageFilter === 'All' || api.page === pageFilter;

            return matchesSearch && matchesPage;
        });
    }, [activeSlice, searchTerm, pageFilter]);

    // Calculate overall healthy rate
    const successSlice = breakdown.find(b => b.status === 'Success');
    const healthRate = total > 0 && successSlice 
        ? Math.round((successSlice.value / total) * 1000) / 10 
        : 100;

    // Filter Recharts data to slices with value > 0 so pie renders clean wedges
    const chartData = useMemo(() => {
        const valid = breakdown.filter(b => b.value > 0);
        if (valid.length === 0) {
            return [{ name: 'No Data', status: 'Success', value: 1, color: '#e2e8f0', apis: [] }];
        }
        return valid;
    }, [breakdown]);

    const segmentedChartData = useMemo(() => {
        const raw = currentScopeData?.segmentedBreakdown || [];
        if (raw.length > 0) {
            return raw.filter(s => s.value > 0);
        }
        return chartData;
    }, [currentScopeData, chartData]);

    // Selected slice indices for active sector shape in Recharts (tracks clicked/selected status)
    const selectedOuterIndex = useMemo(() => {
        return todayChartData.findIndex(item => item.status === activeStatus);
    }, [todayChartData, activeStatus]);

    const selectedInnerIndex = useMemo(() => {
        return yesterdayChartData.findIndex(item => item.status === activeStatus);
    }, [yesterdayChartData, activeStatus]);

    const selectedSegmentedIndex = useMemo(() => {
        return segmentedChartData.findIndex(item => item.status === activeStatus);
    }, [segmentedChartData, activeStatus]);

    const selectedStandardIndex = useMemo(() => {
        return chartData.findIndex(item => item.status === activeStatus);
    }, [chartData, activeStatus]);

    // Hover handler: only displays hover preview card, does NOT select slice or switch inspector panel
    const handleSliceMouseEnter = (entry, ring = 'outer') => {
        const status = entry?.status || entry?.payload?.status;
        if (status && STATUS_CONFIG[status]) {
            const slicePayload = entry?.payload || entry;
            const fullItem = {
                ...slicePayload,
                ring: entry?.ring || ring,
                day: entry?.day || (ring === 'inner' ? 'Yesterday' : 'Today'),
                dayLabel: entry?.dayLabel || (ring === 'inner' ? (yesterdayScope?.label || 'Yesterday') : (todayScope?.label || 'Today')),
            };
            setHoveredSlice(fullItem);
        }
    };

    const handleSliceMouseLeave = () => {
        setHoveredSlice(null);
    };

    // Click handler: strictly selects the slice and category for inspection
    const handleSliceClick = (entry) => {
        const status = entry?.status || entry?.payload?.status || activeStatus;
        if (status && STATUS_CONFIG[status]) {
            setActiveStatus(status);
            if (onSelectStatus) {
                onSelectStatus(status);
            }
        }
    };

    return (
        <section 
            aria-label="API Health Distribution"
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-5 transition-all mb-6"
        >
            {/* ─── Top Header: Title, Scope Tabs & Context ─── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 shrink-0 mt-0.5 sm:mt-0">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                API Health & Latency Distribution
                            </h2>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {distribution?.latestDate ? `Latest: ${distribution.latestDate}` : '48-Hour Scope'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Status breakdown across monitored backend endpoints. Click any slice or button to inspect APIs.
                        </p>
                    </div>
                </div>

                {/* Scope Selection Tabs & Reset Button */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Scope Selector: Today (171) vs 2-Day (323) vs Unique (154) */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-medium">
                        <button
                            type="button"
                            onClick={() => setScope('today')}
                            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                scope === 'today'
                                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Latest single test run (matches 171 APIs in top summary cards)"
                        >
                            Today ({distribution?.scopes?.today?.total ?? 171})
                        </button>
                        <button
                            type="button"
                            onClick={() => setScope('2days')}
                            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                scope === '2days'
                                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Total test executions combined across last 2 days (171 Today + 152 Yesterday)"
                        >
                            Last 2 Days ({distribution?.scopes?.['2days']?.total ?? 323})
                        </button>
                        <button
                            type="button"
                            onClick={() => setScope('unique')}
                            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                scope === 'unique'
                                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Deduplicated distinct endpoints evaluated across 48h"
                        >
                            Unique ({distribution?.scopes?.unique?.total ?? 154})
                        </button>
                    </div>

                    {/* Explanatory Info Popover Tooltip */}
                    <MuiTooltip 
                        title="Today tested 171 APIs (145 Success, 21 Empty, 5 Slow). The 2-Day total is 426 because APIs run daily."
                        arrow
                    >
                        <div className="cursor-help text-slate-400 hover:text-slate-600 p-1">
                            <Info className="w-4 h-4" />
                        </div>
                    </MuiTooltip>

                    {(selectedStatus !== 'All' || selectedEmptyResponse === '1') && (
                        <button
                            onClick={() => onSelectStatus && onSelectStatus('Reset')}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                            Reset Filter
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Main Body: Donut Chart (Left) + Interactive API Inspector (Right) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 items-start">
                
                {/* ─── Left Column: Donut Chart & Status Toggles (5 cols) ─── */}
                <div className="lg:col-span-5 flex flex-col items-center justify-between h-full space-y-3">
                    
                    {/* Day Ring Indicators & View Mode Toggle for 2-Day Scope */}
                    {scope === '2days' && (
                        <div className="w-full flex items-center justify-between px-1 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                    {chartViewMode === 'concentric' ? 'Outer:' : ''} Today ({todayScope?.total ?? 171})
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold text-[11px]">
                                    <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                                    {chartViewMode === 'concentric' ? 'Inner:' : ''} Yesterday ({yesterdayScope?.total ?? 152})
                                </span>
                            </div>

                            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => setChartViewMode('concentric')}
                                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                        chartViewMode === 'concentric'
                                            ? 'bg-white text-slate-900 font-bold shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                    title="Concentric Dual Rings: Today (Outer) & Yesterday (Inner)"
                                >
                                    Dual Ring
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartViewMode('segmented')}
                                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                        chartViewMode === 'segmented'
                                            ? 'bg-white text-slate-900 font-bold shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                    title="Single Ring with Day-Segmented Slices"
                                >
                                    Segmented
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Donut Chart with Dynamic Non-Overlapping Center Display */}
                    <div 
                        className="relative w-full h-[230px] flex items-center justify-center"
                        onMouseLeave={handleSliceMouseLeave}
                    >
                        {loading ? (
                            <Skeleton variant="circular" width={180} height={180} />
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        {scope === '2days' && chartViewMode === 'concentric' ? (
                                            <>
                                                {/* Outer Ring: Today (171 tests) */}
                                                <Pie
                                                    data={todayChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={96}
                                                    activeIndex={selectedOuterIndex}
                                                    activeShape={renderActiveSector}
                                                    minAngle={28}
                                                    paddingAngle={3}
                                                    cornerRadius={4}
                                                    dataKey="value"
                                                    stroke="#ffffff"
                                                    strokeWidth={2}
                                                    onMouseEnter={(entry) => handleSliceMouseEnter(entry, 'outer')}
                                                    onMouseLeave={handleSliceMouseLeave}
                                                    onClick={handleSliceClick}
                                                    cursor="pointer"
                                                    animationDuration={500}
                                                >
                                                    {todayChartData.map((entry, index) => {
                                                        const isHighlighted = activeStatus === entry.status;
                                                        const isHovered = hoveredSlice?.status === entry.status && hoveredSlice?.ring === 'outer';
                                                        return (
                                                            <Cell 
                                                                key={`today-cell-${index}`} 
                                                                fill={entry.color}
                                                                opacity={isHighlighted ? 1 : isHovered ? 0.9 : 0.72}
                                                                className="transition-all duration-200 outline-none cursor-pointer"
                                                                onMouseEnter={() => handleSliceMouseEnter(entry, 'outer')}
                                                                onMouseLeave={handleSliceMouseLeave}
                                                                onClick={() => handleSliceClick(entry)}
                                                            />
                                                        );
                                                    })}
                                                </Pie>

                                                {/* Inner Ring: Yesterday (152 tests) */}
                                                <Pie
                                                    data={yesterdayChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={46}
                                                    outerRadius={65}
                                                    activeIndex={selectedInnerIndex}
                                                    activeShape={renderActiveSectorInner}
                                                    minAngle={24}
                                                    paddingAngle={2}
                                                    cornerRadius={3}
                                                    dataKey="value"
                                                    stroke="#ffffff"
                                                    strokeWidth={2}
                                                    onMouseEnter={(entry) => handleSliceMouseEnter(entry, 'inner')}
                                                    onMouseLeave={handleSliceMouseLeave}
                                                    onClick={handleSliceClick}
                                                    cursor="pointer"
                                                    animationDuration={500}
                                                >
                                                    {yesterdayChartData.map((entry, index) => {
                                                        const isHighlighted = activeStatus === entry.status;
                                                        const isHovered = hoveredSlice?.status === entry.status && hoveredSlice?.ring === 'inner';
                                                        return (
                                                            <Cell 
                                                                key={`yesterday-cell-${index}`} 
                                                                fill={entry.color}
                                                                opacity={isHighlighted ? 1 : isHovered ? 0.9 : 0.72}
                                                                className="transition-all duration-200 outline-none cursor-pointer"
                                                                onMouseEnter={() => handleSliceMouseEnter(entry, 'inner')}
                                                                onMouseLeave={handleSliceMouseLeave}
                                                                onClick={() => handleSliceClick(entry)}
                                                            />
                                                        );
                                                    })}
                                                </Pie>
                                            </>
                                        ) : scope === '2days' && chartViewMode === 'segmented' ? (
                                            /* Segmented Slices for 2 Days on Single Ring */
                                            <Pie
                                                data={segmentedChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={68}
                                                outerRadius={96}
                                                activeIndex={selectedSegmentedIndex}
                                                activeShape={renderActiveSector}
                                                minAngle={26}
                                                paddingAngle={3}
                                                cornerRadius={4}
                                                dataKey="value"
                                                stroke="#ffffff"
                                                strokeWidth={2.5}
                                                onMouseEnter={(entry) => handleSliceMouseEnter(entry)}
                                                onMouseLeave={handleSliceMouseLeave}
                                                onClick={handleSliceClick}
                                                cursor="pointer"
                                                animationDuration={500}
                                            >
                                                {segmentedChartData.map((entry, index) => {
                                                    const isHighlighted = activeStatus === entry.status;
                                                    const isHovered = hoveredSlice?.status === entry.status;
                                                    return (
                                                        <Cell 
                                                            key={`seg-cell-${index}`} 
                                                            fill={entry.color}
                                                            opacity={isHighlighted ? 1 : isHovered ? 0.9 : 0.72}
                                                            className="transition-all duration-200 outline-none cursor-pointer"
                                                            onMouseEnter={() => handleSliceMouseEnter(entry)}
                                                            onMouseLeave={handleSliceMouseLeave}
                                                            onClick={() => handleSliceClick(entry)}
                                                        />
                                                    );
                                                })}
                                            </Pie>
                                        ) : (
                                            /* Standard Single Ring (e.g. Today only or Unique) */
                                            <Pie
                                                data={chartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={68}
                                                outerRadius={96}
                                                activeIndex={selectedStandardIndex}
                                                activeShape={renderActiveSector}
                                                minAngle={28}
                                                paddingAngle={chartData.length > 1 ? 4 : 0}
                                                cornerRadius={4}
                                                dataKey="value"
                                                stroke="#ffffff"
                                                strokeWidth={2.5}
                                                onMouseEnter={(entry) => handleSliceMouseEnter(entry)}
                                                onMouseLeave={handleSliceMouseLeave}
                                                onClick={handleSliceClick}
                                                cursor="pointer"
                                                animationDuration={600}
                                            >
                                                {chartData.map((entry, index) => {
                                                    const isHighlighted = activeStatus === entry.status;
                                                    const isHovered = hoveredSlice?.status === entry.status;
                                                    return (
                                                        <Cell 
                                                            key={`cell-${index}`} 
                                                            fill={entry.color}
                                                            opacity={isHighlighted ? 1 : isHovered ? 0.9 : 0.72}
                                                            className="transition-all duration-200 outline-none cursor-pointer"
                                                            onMouseEnter={() => handleSliceMouseEnter(entry)}
                                                            onMouseLeave={handleSliceMouseLeave}
                                                            onClick={() => handleSliceClick(entry)}
                                                        />
                                                    );
                                                })}
                                            </Pie>
                                        )}
                                    </PieChart>
                                </ResponsiveContainer>

                                {/* Center Donut Label: Always visible and never overlapped */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-200">
                                    <span className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none">
                                        {healthRate}%
                                    </span>
                                    <span className="text-[9px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                                        Healthy Rate
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium">
                                        {total} {scope === 'unique' ? 'Unique APIs' : scope === '2days' ? 'Tests (2 Days)' : 'Tests'}
                                    </span>
                                </div>

                                {/* Floating Hover Card: Positioned strictly outside donut outer radius (104px) - NEVER overlaps center text */}
                                {hoveredSlice && hoveredSlice.value > 0 && (
                                    <div 
                                        className={`absolute z-40 pointer-events-none transition-all duration-200 ease-out animate-in fade-in zoom-in-95 ${
                                            hoveredSlice.status === 'Slow' || hoveredSlice.status === 'Failed'
                                                ? 'left-[calc(50%+104px)] top-1/2 -translate-y-1/2'
                                                : 'right-[calc(50%+104px)] top-1/2 -translate-y-1/2'
                                        }`}
                                    >
                                        <div 
                                            className="bg-slate-900/95 backdrop-blur-md text-white border rounded-xl shadow-2xl p-3 w-[240px] text-xs pointer-events-none"
                                            style={{ 
                                                borderColor: `${hoveredSlice.color}80`,
                                                boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px ${hoveredSlice.color}25` 
                                            }}
                                        >
                                            {/* Day Demarcation Badge */}
                                            {hoveredSlice.day && (
                                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        {hoveredSlice.ring === 'outer' ? 'Outer Ring' : hoveredSlice.ring === 'inner' ? 'Inner Ring' : 'Day Slice'}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                        hoveredSlice.day === 'Today' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                                                    }`}>
                                                        {hoveredSlice.dayLabel || hoveredSlice.day}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Header */}
                                            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
                                                <div className="flex items-center gap-1.5 font-semibold">
                                                    <span 
                                                        className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20 shrink-0" 
                                                        style={{ backgroundColor: hoveredSlice.color }} 
                                                    />
                                                    <span className="text-white text-xs font-bold tracking-tight">
                                                        {hoveredSlice.name}
                                                    </span>
                                                </div>
                                                <span 
                                                    className="px-2 py-0.5 rounded-md font-bold text-[11px]"
                                                    style={{ 
                                                        backgroundColor: `${hoveredSlice.color}25`, 
                                                        color: hoveredSlice.color,
                                                        border: `1px solid ${hoveredSlice.color}50` 
                                                    }}
                                                >
                                                    {hoveredSlice.percentage}%
                                                </span>
                                            </div>

                                            {/* Metrics */}
                                            <div className="space-y-1 text-slate-300 text-[11px]">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">Total APIs:</span>
                                                    <strong className="text-white font-semibold font-mono">
                                                        {hoveredSlice.value}
                                                    </strong>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">SLA Status:</span>
                                                    <span className="text-slate-200 font-medium">
                                                        {hoveredSlice.status === 'Empty' 
                                                            ? '200 OK (0 records / empty payload)'
                                                            : hoveredSlice.status === 'Slow' 
                                                            ? '> 5000ms latency' 
                                                            : hoveredSlice.status === 'Failed' 
                                                            ? 'Errors / Timeouts' 
                                                            : '< 5000ms (Healthy)'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* If small number of APIs (e.g. 3 Slow APIs), show them directly in the hover card */}
                                            {hoveredSlice.apis && hoveredSlice.apis.length > 0 && hoveredSlice.apis.length <= 4 && (
                                                <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                                        <span>Endpoints ({hoveredSlice.apis.length}):</span>
                                                        <span className="text-slate-400 font-normal">
                                                            {hoveredSlice.status === 'Empty' ? 'Status' : 'Latency'}
                                                        </span>
                                                    </div>
                                                    {hoveredSlice.apis.map((a, i) => (
                                                        <div key={i} className="font-mono text-[10px] text-slate-300 flex items-center justify-between gap-1 bg-slate-800/70 px-1.5 py-0.5 rounded border border-slate-700/60">
                                                            <span className="truncate max-w-[145px]" title={a.api}>{a.api}</span>
                                                            <span 
                                                                className="font-bold shrink-0 text-[10px]"
                                                                style={{ color: hoveredSlice.color }}
                                                            >
                                                                {hoveredSlice.status === 'Empty' ? 'Empty: 1' : a.responseTimeMs ? `${Number(a.responseTimeMs).toLocaleString()}ms` : '0ms'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* If many APIs (e.g. 168 or 152 Success), show helper text */}
                                            {hoveredSlice.apis && hoveredSlice.apis.length > 4 && (
                                                <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
                                                    <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                                                    <span>Listing all {hoveredSlice.apis.length} in panel &rarr;</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Interactive Legend Badges: Green (Success), Violet (Empty), Yellow (Slow), Red (Failed) */}
                    <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {breakdown.map((item) => {
                            const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.Success;
                            const IconComponent = config.icon;
                            const isActive = activeStatus === item.status;
                            const isTableFilter = (item.status === 'Empty' && selectedEmptyResponse === '1') 
                                || (selectedStatus === item.status && selectedEmptyResponse !== '1');

                            return (
                                <button
                                    key={item.status}
                                    type="button"
                                    onClick={() => {
                                        setActiveStatus(item.status);
                                        if (onSelectStatus) onSelectStatus(item.status);
                                    }}
                                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                        isActive 
                                            ? `bg-white shadow-sm ring-2 ${config.activeRing} scale-[1.02]` 
                                            : 'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-slate-300'
                                    }`}
                                    aria-label={`${item.name} APIs: ${item.value} (${item.percentage}%)`}
                                >
                                    <div className="flex items-center justify-between w-full mb-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span 
                                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                                style={{ backgroundColor: item.color }} 
                                            />
                                            <span className="text-xs font-bold text-slate-700 truncate" title={item.name}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <IconComponent 
                                            className="w-3.5 h-3.5 shrink-0" 
                                            style={{ color: item.color }} 
                                        />
                                    </div>

                                    <div className="flex items-baseline gap-1 mt-0.5">
                                        <span className="text-lg font-extrabold text-slate-900 leading-none">
                                            {item.value}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                            ({item.percentage}%)
                                        </span>
                                    </div>

                                    {isTableFilter && (
                                        <span className="mt-1 text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                            Filter Active
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1 pt-0.5">
                        <span>Click any slice or button to filter table below</span>
                    </div>
                </div>

                {/* ─── Right Column: Interactive API Inspector (7 cols) ─── */}
                <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col h-[350px]">
                    
                    {/* Inspector Header with Active Status & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/80 shrink-0">
                        <div className="flex items-center gap-2">
                            <span 
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: activeSlice.color }}
                            />
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    {activeSlice.name} APIs ({activeSlice.value})
                                    <span 
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ backgroundColor: `${activeSlice.color}20`, color: activeSlice.color }}
                                    >
                                        {activeSlice.percentage}% of total
                                    </span>
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    {STATUS_CONFIG[activeSlice.status]?.description}
                                </p>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative min-w-[180px] sm:w-48">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={`Search ${activeSlice.value} APIs...`}
                                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Page Filter Chips if multiple pages present */}
                    {availablePagesInActive.length > 2 && (
                        <div className="flex items-center gap-1.5 py-2 overflow-x-auto shrink-0 border-b border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                                Page:
                            </span>
                            {availablePagesInActive.map(pageName => (
                                <button
                                    key={pageName}
                                    onClick={() => setPageFilter(pageName)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                        pageFilter === pageName
                                            ? 'bg-blue-600 text-white font-semibold'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {pageName}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Scrollable API List */}
                    <div className="flex-1 overflow-y-auto mt-2.5 pr-1 space-y-2">
                        {loading ? (
                            <div className="space-y-2 py-2">
                                <Skeleton variant="rounded" height={42} />
                                <Skeleton variant="rounded" height={42} />
                                <Skeleton variant="rounded" height={42} />
                            </div>
                        ) : displayedApis.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                {activeSlice.value === 0 ? (
                                    <>
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                                        <p className="text-xs font-semibold text-slate-700">
                                            No {activeSlice.name} APIs
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            No endpoints logged in {activeSlice.name} status for this scope.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-6 h-6 text-slate-300 mb-1" />
                                        <p className="text-xs text-slate-500">
                                            No APIs match &quot;{searchTerm}&quot; in {activeSlice.name}
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            displayedApis.map((item, idx) => (
                                <div
                                    key={item.id || `${item.api}-${idx}`}
                                    className="bg-white border border-slate-200/80 rounded-xl p-2.5 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-xs font-semibold text-slate-800 break-all select-all">
                                                {item.api}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                                            <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                                <Layers className="w-3 h-3 text-slate-400" />
                                                {item.page}
                                            </span>

                                            {item.clientDb && (
                                                <span className="inline-flex items-center text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200/70 px-1.5 py-0.2 rounded">
                                                    {item.clientDb}
                                                </span>
                                            )}

                                            {item.segment && (
                                                <span className="text-slate-400">
                                                    • {item.segment}
                                                </span>
                                            )}

                                            <span className="text-slate-400 text-[10px]">
                                                • Run: {item.date}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right Status & Latency Badges */}
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <span 
                                            title={item.emptyResponse === 1 ? "Empty response payload: 1" : "Non-empty response: 0"}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                                item.emptyResponse === 1 
                                                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}
                                        >
                                            Empty: {item.emptyResponse === 1 ? '1' : '0'}
                                        </span>

                                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${
                                            item.responseStatus === 'Slow' 
                                                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                                : item.responseStatus === 'Failed'
                                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                : item.emptyResponse === 1
                                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        }`}>
                                            {item.responseTimeMs ? `${Number(item.responseTimeMs).toLocaleString()} ms` : '0 ms'}
                                        </span>

                                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                            {item.statusCode || 200}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Info & Table Filter CTA */}
                    <div className="pt-2.5 mt-auto border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                        <span>
                            Showing {displayedApis.length} of {activeSlice.value} endpoints
                        </span>
                        {onSelectStatus && (
                            <button
                                onClick={() => onSelectStatus(activeSlice.status)}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold transition-colors cursor-pointer"
                            >
                                <span>Filter table by {activeSlice.name}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                </div>

            </div>
        </section>
    );
}
