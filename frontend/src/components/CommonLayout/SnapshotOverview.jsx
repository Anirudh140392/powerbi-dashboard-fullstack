import { motion } from 'framer-motion'
import {
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    LayoutGrid,
    Eye,
    TrendingUp,
    Target,
    DollarSign,
    ShoppingCart,
    Layers,
    Percent,
    PieChart,
    Wallet,
    MousePointer2,
    MapPin
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '../../lib/utils'
import { Skeleton, Box, Card, Typography, IconButton } from '@mui/material'
import { HelpOutline as HelpIcon } from "@mui/icons-material";
import { useHelp } from "../../utils/HelpContext";
import React, { useRef, useState, useEffect, useMemo } from 'react'

// ---------- Helpers ----------

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

function makeSeries(seedBase, n = 30, volatility = 0.12, platformSeed = "default") {
    // Normalization to handle arrays or null/undefined
    const seedStr = Array.isArray(platformSeed)
        ? (platformSeed.length > 0 ? String(platformSeed[0]) : "default")
        : String(platformSeed || "default");

    // Generate a numeric seed from the platform string
    let pSeed = 0;
    for (let i = 0; i < seedStr.length; i++) {
        pSeed = (pSeed << 5) - pSeed + seedStr.charCodeAt(i);
        pSeed |= 0;
    }
    const combinedSeed = Math.abs(seedBase + pSeed);

    let x = seedBase;
    const out = [];
    for (let i = 0; i < n; i++) {
        const drift = 1 + (Math.sin((i + combinedSeed) * 0.35) * volatility) / 2;
        const noise = 1 + (Math.cos((i + combinedSeed) * 0.63) * volatility) / 3;
        x = x * drift * noise;
        out.push(x);
    }
    const min = Math.min(...out);
    const max = Math.max(...out);
    const den = max - min || 1;
    return out.map((v) => (v - min) / den);
}

function pctChange(last, prev) {
    if (prev === 0) return 0;
    return ((last - prev) / prev) * 100;
}

// ---------- SVG Sparkline ----------

function Sparkline({ values, width = 240, height = 80, color = "#6366f1" }) {
    const pad = 6;
    const w = width;
    const h = height;

    const pts = useMemo(() => {
        const n = values.length;
        if (!n) return [];
        return values.map((v, i) => {
            const x = pad + (i * (w - pad * 2)) / (n - 1 || 1);
            const y = pad + (1 - clamp(v, 0, 1)) * (h - pad * 2);
            return { x, y };
        });
    }, [values, w, h]);

    const d = useMemo(() => {
        if (pts.length < 2) return "";
        return pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(" ");
    }, [pts]);

    const areaD = useMemo(() => {
        if (pts.length < 2) return "";
        const first = pts[0];
        const last = pts[pts.length - 1];
        return `${d} L${last.x.toFixed(2)},${(h - pad).toFixed(2)} L${first.x.toFixed(
            2
        )},${(h - pad).toFixed(2)} Z`;
    }, [d, pts, h]);

    const lastPt = pts[pts.length - 1];

    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
            <defs>
                <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />}
        </svg>
    );
}

// ---------- Hover Popover ----------

function HoverPopover({ open, anchorRect, children, onMouseEnter, onMouseLeave }) {
    if (!open || !anchorRect) return null;

    const left = anchorRect.left + anchorRect.width / 2;
    const top = anchorRect.top + anchorRect.height;

    return (
        <div
            className="fixed z-[9999]"
            style={{ left, top, transform: "translate(-50%, 12px)" }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="w-[300px] rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

/**
 * ActionableMetricCard: Premium styled card for the bottom row (Performance Metrics).
 * NOW WITH HOVER TRENDS!
 */
const ActionableMetricCard = ({ kpi, loading = false, color = "#6366f1" }) => {
    // Hover State Logic (Copied from ComparisonCard)
    const [open, setOpen] = useState(false);
    const [period, setPeriod] = useState(14);
    const [anchorRect, setAnchorRect] = useState(null);

    const hoverOpenTimerRef = useRef(null);
    const hoverCloseTimerRef = useRef(null);
    const isPopoverHoverRef = useRef(false);

    if (loading) {
        return (
            <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm h-full flex flex-col">
                <Skeleton variant="text" width="40%" height={15} />
                <Skeleton variant="text" width="80%" height={30} sx={{ my: 1 }} />
                <Skeleton variant="text" width="60%" height={12} />
            </div>
        );
    }

    if (kpi.isEmpty) {
        return (
            <Card
                sx={{
                    p: 2,
                    height: "100%",
                    border: "1.5px dashed",
                    borderColor: "#e2e8f0",
                    bgcolor: "white/50",
                    borderRadius: "1rem",
                    boxShadow: "none",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Typography sx={{ fontSize: '9px', color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase' }}>
                    Available Insights
                </Typography>
            </Card>
        )
    }

    const Icon = kpi.icon || Zap;
    const themeColor = kpi.gradient?.[0] || color;
    const isPositive = (kpi.delta || 0) >= 0;
    const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;
    const deltaColor = isPositive ? "text-emerald-500" : "text-rose-500";

    // Trend Logic
    // If the backend provided 'weekly' data (e.g. 5 points) we fall back to the explicitly 
    // generated 30-point daily mock data (kpi.trendSeries) so UI 7D/14D/30D slicing works correctly.
    const trendSeries = (kpi.trend && kpi.trend.length >= 7) ? kpi.trend : (kpi.trendSeries || kpi.trend || []);
    const sliceSeries = useMemo(() => {
        const n = trendSeries.length;
        return trendSeries.slice(Math.max(0, n - period));
    }, [trendSeries, period]);

    const deltaVal = useMemo(() => {
        if (sliceSeries.length < 2) return 0;
        const last = sliceSeries[sliceSeries.length - 1];
        const prev = sliceSeries[0];
        return last - prev;
    }, [sliceSeries]);

    // Use kpi.delta for valid delta or fallback to calculated from trend
    const displayDelta = kpi.delta !== undefined ? kpi.delta : deltaVal;
    const deltaLabel = kpi.deltaLabel || (displayDelta >= 0 ? `+${displayDelta.toFixed(1)} pp` : `${displayDelta.toFixed(1)} pp`);

    // Calculate dynamic hover deltas based on kpi.delta and period
    // Use kpi.delta as the base (30D value) and scale proportionally for shorter periods
    const baseDelta = kpi.delta || 0;
    const periodScale = { 7: 0.3, 14: 0.55, 30: 1.0 };
    const scaledDelta = (baseDelta * (periodScale[period] || 1.0));
    const hoverDeltaPct = scaledDelta.toFixed(1);

    // Extract suffix from original deltaLabel (e.g '%', 'pp', 'Cr') to keep formatting consistent
    const suffixMatch = (deltaLabel || '').match(/[^0-9.\-+]+$/);
    const suffix = suffixMatch ? suffixMatch[0] : '%';

    const hoverDeltaStr = `${scaledDelta >= 0 ? '+' : ''}${hoverDeltaPct}${suffix}`;


    const onCardEnter = (e) => {
        if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        hoverOpenTimerRef.current = setTimeout(() => {
            setAnchorRect(rect);
            setOpen(true);
        }, 200);
    };

    const onCardLeave = () => {
        if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
        hoverCloseTimerRef.current = setTimeout(() => {
            if (!isPopoverHoverRef.current) setOpen(false);
        }, 200);
    };

    return (
        <>
            <Card
                sx={{
                    p: 2.25,
                    height: "100%",
                    border: "1px solid",
                    borderColor: "#f1f5f9",
                    bgcolor: "white",
                    borderRadius: "1rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    transition: "all 300ms ease",
                    cursor: 'pointer',
                    "&:hover": {
                        borderColor: themeColor,
                        transform: "translateY(-2px)",
                        boxShadow: "0 10px 20px -10px rgba(0,0,0,0.05)"
                    }
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <div className="flex items-center gap-1.5">
                        <Icon size={16} color={themeColor} strokeWidth={2.5} />
                        <Typography sx={{ fontSize: "10px", fontWeight: 600, color: "text.secondary", tracking: '0.01em' }}>
                            {kpi.title}
                        </Typography>
                    </div>
                </Box>

                <div className="flex items-end justify-between w-full mb-0.5">
                    <Typography sx={{ fontSize: "22px", fontWeight: 700, color: themeColor, lineHeight: 1, letterSpacing: "-0.01em" }}>
                        {kpi.value}
                    </Typography>

                    <div className={`flex items-center gap-0.5 ${deltaColor} bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100`}>
                        <DeltaIcon size={10} strokeWidth={3} />
                        <span className="text-[14px] font-bold">{deltaLabel}</span>
                    </div>
                </div>

                <Typography sx={{ fontSize: "9px", color: "text.disabled", fontWeight: 500, mt: 0.5 }}>
                    {kpi.subtitle || "Performance Metric"}
                </Typography>
            </Card>
        </>
    );
};

/**
 * ComparisonCard: Squarish design as per user image.
 */
const ComparisonCard = ({ kpi, loading = false }) => {
    const [open, setOpen] = useState(false);
    const [period, setPeriod] = useState(14);
    const [anchorRect, setAnchorRect] = useState(null);

    const hoverOpenTimerRef = useRef(null);
    const hoverCloseTimerRef = useRef(null);
    const isPopoverHoverRef = useRef(false);

    if (loading) {
        return (
            <Card sx={{ p: 2.5, borderRadius: "1.25rem", border: "1px solid #f1f5f9", boxShadow: "none", height: "100%" }}>
                <Skeleton variant="rectangular" width={40} height={40} sx={{ borderRadius: "12px", mb: 2 }} />
                <Skeleton variant="text" width="70%" height={36} sx={{ mb: 1 }} />
                <Skeleton variant="text" width="50%" height={16} />
            </Card>
        )
    }

    const Icon = kpi.icon || LayoutGrid
    const color = kpi.gradient?.[0] || "#6366f1"
    const isPositive = (kpi.delta || 0) >= 0;
    const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;
    const deltaColor = isPositive ? "text-emerald-500" : "text-rose-500";

    // Trend Logic
    // If the backend provided 'weekly' data (e.g. 5 points) we fall back to the explicitly 
    // generated 30-point daily mock data (kpi.trendSeries) so UI 7D/14D/30D slicing works correctly.
    const trendSeries = (kpi.trend && kpi.trend.length >= 7) ? kpi.trend : (kpi.trendSeries || kpi.trend || []);
    const sliceSeries = useMemo(() => {
        const n = trendSeries.length;
        return trendSeries.slice(Math.max(0, n - period));
    }, [trendSeries, period]);

    const deltaVal = useMemo(() => {
        if (sliceSeries.length < 2) return 0;
        const last = sliceSeries[sliceSeries.length - 1];
        const prev = sliceSeries[0];
        return last - prev;
    }, [sliceSeries]);

    // Use kpi.delta for valid delta or fallback to calculated from trend
    const displayDelta = kpi.delta !== undefined ? kpi.delta : deltaVal;
    const deltaLabel = kpi.deltaLabel || (displayDelta >= 0 ? `+${displayDelta.toFixed(1)} pp` : `${displayDelta.toFixed(1)} pp`);

    // Calculate dynamic hover deltas based on kpi.delta and period
    // Use kpi.delta as the base (30D value) and scale proportionally for shorter periods
    const baseDelta = kpi.delta || 0;
    const periodScale = { 7: 0.3, 14: 0.55, 30: 1.0 };
    const scaledDelta = (baseDelta * (periodScale[period] || 1.0));
    const hoverDeltaPct = scaledDelta.toFixed(1);

    // Extract suffix from original deltaLabel (e.g '%', 'pp', 'Cr') to keep formatting consistent
    const suffixMatch = (deltaLabel || '').match(/[^0-9.\-+]+$/);
    const suffix = suffixMatch ? suffixMatch[0] : '%';

    const hoverDeltaStr = `${scaledDelta >= 0 ? '+' : ''}${hoverDeltaPct}${suffix}`;

    const onCardEnter = (e) => {
        if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        hoverOpenTimerRef.current = setTimeout(() => {
            setAnchorRect(rect);
            setOpen(true);
        }, 200);
    };

    const onCardLeave = () => {
        if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
        hoverCloseTimerRef.current = setTimeout(() => {
            if (!isPopoverHoverRef.current) setOpen(false);
        }, 200);
    };

    return (
        <>
            <Card
                sx={{
                    p: 2.5,
                    borderRadius: "1.25rem",
                    border: "1px solid #fcfdfe",
                    bgcolor: "white",
                    boxShadow: "0 0 20px rgba(0, 0, 0, 0.06), 0 4px 6px -1px rgba(0, 0, 0, 0.04)",
                    height: "100%",
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: 'pointer',
                    "&:hover": {
                        boxShadow: "0 0 35px rgba(0, 0, 0, 0.12), 0 10px 15px -5px rgba(0, 0, 0, 0.06)",
                        transform: "translateY(-4px)"
                    }
                }}
            >
                <div className="w-full flex justify-between items-start">
                    <Box sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        bgcolor: color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 2.5,
                        boxShadow: `0 4px 10px ${color}40`
                    }}>
                        <Icon size={22} color="white" strokeWidth={2.5} />
                    </Box>
                    <div className={`flex items-center gap-0.5 ${deltaColor} bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100`}>
                        <DeltaIcon size={12} strokeWidth={2.5} />
                        <span className="text-[14px] font-bold">{deltaLabel}</span>
                    </div>
                </div>

                <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827", lineHeight: 1, mb: 1, tracking: '-0.02em' }}>
                    {kpi.value}
                </Typography>

                <Typography sx={{ fontSize: "11.5px", fontWeight: 500, color: "#64748b", tracking: '0.01em' }}>
                    {kpi.title}
                </Typography>
            </Card>
        </>
    )
}

/**
 * DetailedSparklineCard: Clean, detailed card for Visibility/Availability pages.
 */
const DetailedSparklineCard = ({ kpi, loading = false }) => {
    if (loading) {
        return (
            <Card sx={{ p: 3, height: "100%", borderRadius: "1rem", boxShadow: "sm", border: "1px solid", borderColor: "slate.200" }}>
                <Skeleton variant="text" width="60%" height={20} sx={{ mb: 2 }} />
                <Skeleton variant="text" width="80%" height={40} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" width="100%" height={60} />
            </Card>
        )
    }

    // Not a Metro City — show premium styled block
    if (kpi.isNotMetro) {
        const locationName = kpi.notMetroLocation && kpi.notMetroLocation !== 'All'
            ? kpi.notMetroLocation
            : null;

        return (
            <div className="group relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg flex flex-col h-full font-roboto">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-100/40 to-transparent rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-slate-100/40 to-transparent rounded-full translate-y-6 -translate-x-6" />

                <div className="px-5 pt-5 pb-3 flex-1 relative z-10">
                    <h3 className="text-sm font-semibold text-slate-500 mb-3">{kpi.title}</h3>

                    <div className="flex flex-col items-center justify-center py-4 gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-200/50">
                            <MapPin size={24} color="white" strokeWidth={2.5} />
                        </div>

                        <div className="text-center space-y-1.5">
                            <div className="text-base font-bold text-slate-700">
                                Not a Metro City
                            </div>
                            {locationName && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100/60 border border-violet-200/40">
                                    <span className="text-[11px] font-semibold text-violet-700">
                                        {Array.isArray(locationName) ? locationName.join(', ') : locationName}
                                    </span>
                                </div>
                            )}
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-[180px] mx-auto">
                                This KPI is available for Tier 1 metro cities only
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom gradient bar instead of sparkline */}
                <div className="h-16 w-full mt-auto relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-100/40 via-purple-50/20 to-violet-100/40" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex gap-1.5">
                            {[...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 rounded-full bg-violet-200/50"
                                    style={{ height: `${12 + Math.sin(i * 1.2) * 8}px` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isPositive = (kpi.delta || 0) >= 0;
    const deltaColor = isPositive ? "text-emerald-600" : "text-rose-600";
    const deltaIcon = isPositive ? "▲" : "▼";

    const extraIsPositive = (kpi.extraDelta || 0) >= 0; // Assuming extraDelta is numeric for color logic, or passed string color
    // If kpi.extraChangeColor is explicit, use it.
    const extraColorClass = kpi.extraChangeColor === 'green' ? "text-emerald-600" : kpi.extraChangeColor === 'red' ? "text-rose-600" : "text-orange-500";

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg flex flex-col h-full font-roboto">
            <div className="px-5 pt-5 pb-3 flex-1">
                <h3 className="text-sm font-semibold text-slate-500 mb-1">{kpi.title}</h3>

                <div className="mb-4">
                    <div className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">
                        {kpi.value}
                    </div>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 min-h-[2.5em]">
                        {kpi.subtitle}
                    </p>
                </div>

                <div className="space-y-3 border-t border-slate-50 pt-3">
                    {kpi.brand && (() => {
                        // Dynamic own-brand detection: use isOwnBrand flag from backend if available,
                        // otherwise check dbName from user context against brand name
                        let isMyBrand = false;
                        if (kpi.isOwnBrand !== undefined) {
                            isMyBrand = kpi.isOwnBrand;
                        } else {
                            try {
                                const u = JSON.parse(sessionStorage.getItem('user'));
                                const dbName = u?.dbName?.toLowerCase() || '';
                                isMyBrand = dbName && kpi.brand.toLowerCase().includes(dbName);
                            } catch { /* ignore */ }
                        }
                        return (
                            <div className={`flex items-baseline gap-1.5 mb-0.5 px-2 py-1 rounded-lg ${isMyBrand ? 'bg-amber-50 border border-amber-200' : ''}`}
                                style={isMyBrand ? { animation: 'mwBrandPulse 2s ease-in-out infinite' } : {}}
                            >
                                <style>{`
                                    @keyframes mwBrandPulse {
                                        0%, 100% { box-shadow: 0 0 0px rgba(245, 158, 11, 0); background-color: rgb(255 251 235); }
                                        50% { box-shadow: 0 0 12px rgba(245, 158, 11, 0.35); background-color: rgb(254 243 199); }
                                    }
                                `}</style>
                                <span className="text-[12px] text-slate-400 font-semibold uppercase tracking-wider leading-none">Market Leader brand -</span>
                                <span className={`text-[12px] font-bold leading-none ${isMyBrand ? 'text-amber-700' : 'text-slate-600'}`}>
                                    {kpi.brand}
                                    {isMyBrand && <span className="ml-1.5 text-[9px] font-bold text-amber-500 uppercase tracking-wider">⭐ My Brand</span>}
                                </span>
                            </div>
                        );
                    })()}
                    <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                        <span className={`text-xs font-bold ${deltaColor} bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100`}>
                            {kpi.deltaLabel ? (
                                <span>{kpi.deltaLabel}</span>
                            ) : (
                                <span>{deltaIcon} {Math.abs(kpi.delta || 0).toFixed(1)}%</span>
                            )}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                            {kpi.prevText || "vs Previous Period"}
                        </span>
                    </div>

                    {(kpi.extra || kpi.extraChange) && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] text-slate-500 font-medium">
                                {kpi.extra}
                            </span>
                            {kpi.extraChange && (
                                <span className={`text-[11px] font-bold ${extraColorClass}`}>
                                    {kpi.extraChange}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sparkline Area */}
            <div className="h-16 w-full px-0 mt-auto opacity-80 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpi.trendSeries?.map((v, i) => ({ i, v })) || []} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={kpi.gradient?.[0] || "#6366f1"} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={kpi.gradient?.[0] || "#6366f1"} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip 
                            contentStyle={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', minWidth: 'auto', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                            itemStyle={{ fontSize: '10px', padding: 0, color: kpi.gradient?.[0] || "#6366f1" }}
                            labelStyle={{ display: 'none' }}
                            cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1 }}
                            formatter={(value) => {
                                if (typeof value !== 'number') return [value, ''];
                                let isCurrency = kpi.title?.toLowerCase().includes('sales') || kpi.title?.toLowerCase().includes('size') || kpi.title?.toLowerCase().includes('(cr)');
                                let prefix = isCurrency ? '₹ ' : '';
                                let formatted = value.toFixed(1);
                                if (Math.abs(value) >= 10000000) formatted = `${(value / 10000000).toFixed(2)} Cr`;
                                else if (Math.abs(value) >= 100000) formatted = `${(value / 100000).toFixed(2)} L`;
                                else if (Math.abs(value) >= 1000) formatted = `${(value / 1000).toFixed(2)} K`;
                                return [`${prefix}${formatted}`, ''];
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="v"
                            stroke={kpi.gradient?.[0] || "#6366f1"}
                            strokeWidth={2}
                            fill={`url(#grad-${kpi.id})`}
                            fillOpacity={1}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div >
    )
}

const SnapshotOverview = ({
    title,
    icon: Icon,
    chip,
    headerRight,
    kpis = [],
    className = '',
    performanceData = [],
    performanceLoading = false,
    loading = false,
    variant = "detailed", // 'watchtower' | 'detailed'
    seed = "default",
    helpMenu = null
}) => {
    const { toggleHelp, openHelpWithMenu } = useHelp();
    // 🔹 Map and Reorganize Data for 5+4 layout
    const { topKpis, bottomKpis } = useMemo(() => {
        if (variant !== 'watchtower') return { topKpis: [], bottomKpis: [] };
        if (!kpis.length) return { topKpis: [], bottomKpis: [] };

        // Helper to normalize IDs
        const normalize = (str) => str?.toLowerCase().replace(/\s+/g, '_');

        // IDs to move to bottom (Actionable Intelligence)
        const bottomIds = ['inorganic_sales', 'conversion', 'roas'];

        // Identify specific KPIs from performanceData first (for values) or kpis (for structure)
        const ordersItem = kpis.find(k => normalize(k.title) === 'orders' || k.id === 'orders') ||
            performanceData.find(k => k.id === 'orders');

        // --- Top Row Logic ---
        // We want all KPI cards passed in `kpis`, EXCEPT 'Orders', ones moving to bottom, AND 'Share of Search' (since we inject a custom one).
        const baseTop = kpis.filter(k => {
            const id = normalize(k.title) || k.id;
            return id !== 'orders' && !bottomIds.includes(id) && id !== 'share_of_search' && id !== 'sos';
        });

        // Add Share of Search (sos_new) from performanceData to Top Row
        // Refinement: Also check kpis (from overview API) so it shows up immediately without jumping
        const sosItem = performanceData.find(item => item.id === 'sos_new') ||
            kpis.find(k => normalize(k.title) === 'share_of_search' || k.id === 'sos');
        const isSosWait = performanceLoading && !sosItem;

        let topRowItems = baseTop.map((kpi, idx) => ({
            ...kpi,
            trendSeries: makeSeries(40 + idx * 10, 30, 0.15 + idx * 0.02, seed)
        }));

        if (sosItem || isSosWait) {
            const sosKpi = sosItem ? {
                id: 'sos_top',
                title: 'Share of Search',
                value: sosItem.value,
                delta: parseFloat(sosItem.tag) || 0,
                deltaLabel: sosItem.tag,
                icon: Eye,
                gradient: ['#6366f1', '#8b5cf6'],
                trendSeries: makeSeries(35, 30, 0.12, seed)
            } : {
                id: 'sos_top_loading',
                title: 'Share of Search',
                loading: true,
                icon: Eye,
                gradient: ['#6366f1', '#8b5cf6'],
            };

            // Find Market Share to swap ensuring SOS comes BEFORE it
            const marketShareIndex = topRowItems.findIndex(k => normalize(k.title) === 'market_share');

            if (marketShareIndex !== -1) {
                // Insert SOS at Market Share index, shifting Market Share to the right
                topRowItems.splice(marketShareIndex, 0, sosKpi);
            } else {
                // Default: Append to end if Market Share not found
                topRowItems.push(sosKpi);
            }
        }

        // Ensuring strictly 5 items if possible.

        // --- Bottom Row Logic ---

        // 1. Inorganic Sales
        const inorganicItem = kpis.find(k => normalize(k.title) === 'inorganic_sales');
        const inorganicPerf = performanceData.find(p => p.id === 'inorganic') || {};

        // 2. Conversion
        const conversionItem = kpis.find(k => normalize(k.title) === 'conversion') || { title: 'Conversion', id: 'conversion' };
        const conversionPerf = performanceData.find(p => p.id === 'conversion') || { id: 'conversion' };

        // 3. ROAS
        const roasItem = kpis.find(k => normalize(k.title) === 'roas');
        const roasPerf = performanceData.find(p => p.id === 'roas_new') || {};

        // Helper to check for zero/empty
        const isZero = (v) => !v || v === '0' || v === '0.0' || v === 0;

        const buildBottomItem = (baseItem, perfItem, defaultId, defaultTitle, icon, gradient, idx) => {
            // Always use API data — no hardcoded fallback values
            const val = baseItem?.value ?? perfItem?.value ?? '0';
            const rawDelta = baseItem?.delta ?? (perfItem?.tag != null ? parseFloat(perfItem.tag) : 0);
            const delta = isNaN(rawDelta) ? 0 : rawDelta;
            const footer = baseItem?.subtitle || baseItem?.footer || perfItem?.footer || "Performance Metric";

            return {
                id: baseItem?.id || defaultId,
                title: baseItem?.title || defaultTitle,
                value: val,
                delta: delta,
                deltaLabel: perfItem?.tag || `${delta > 0 ? '+' : ''}${delta}%`,
                icon: icon,
                gradient: gradient,
                subtitle: footer,
                trendSeries: makeSeries(50 + idx * 5, 30, 0.1, seed)
            };
        };

        const bottomItems = [];

        // Inorganic Sales
        bottomItems.push(buildBottomItem(
            inorganicItem, inorganicPerf, 'inorganic', 'Inorganic Sales', TrendingUp, ['#22c55e', '#4ade80'], 0
        ));

        // Conversion
        bottomItems.push(buildBottomItem(
            conversionItem, conversionPerf, 'conversion', 'Conversion', Target, ['#06b6d4', '#22d3ee'], 1
        ));

        // ROAS
        bottomItems.push(buildBottomItem(
            roasItem, roasPerf, 'roas', 'ROAS', DollarSign, ['#eab308', '#facc15'], 2
        ));

        // 4. Orders (Always last in this specific list)
        // Check performanceData for orders KPI as well
        const ordersPerf = performanceData.find(p => p.id === 'orders') || {};
        const ordersVal = (ordersItem && ordersItem.value != null) ? (ordersItem.value || ordersItem.label)
            : (ordersPerf.value != null ? ordersPerf.value : '0');
        const ordersDeltaRaw = (ordersItem?.tag != null) ? parseFloat(ordersItem.tag)
            : (ordersPerf?.tag != null ? parseFloat(ordersPerf.tag) : 0);
        const ordersDelta = isNaN(ordersDeltaRaw) ? 0 : ordersDeltaRaw;

        const finalOrders = {
            id: ordersItem?.id || 'orders',
            title: 'Orders',
            value: ordersVal,
            delta: ordersDelta,
            deltaLabel: ordersItem?.tag || ordersPerf?.tag || `${ordersDelta > 0 ? '+' : ''}${ordersDelta}%`,
            icon: ShoppingCart,
            gradient: ['#3b82f6', '#60a5fa'],
            subtitle: ordersItem?.footer || ordersPerf?.footer || "Ad Quantity Sold",
            trendSeries: makeSeries(45, 30, 0.14, seed)
        };

        bottomItems.push(finalOrders);

        return { topKpis: topRowItems, bottomKpis: bottomItems };
    }, [kpis, performanceData, variant, seed]);

    // PREPARE DATA FOR DETAILED VIEW
    const detailedKpis = useMemo(() => {
        if (variant === 'watchtower') return [];
        return kpis.map((k, i) => ({
            ...k,
            trendSeries: k.trendSeries || k.trend || makeSeries(50 + i, 20, 0.2, seed)
        }))
    }, [kpis, variant, seed]);

    if (variant === 'watchtower') {
        return (
            <div style={{ marginBottom: '1rem', fontFamily: 'Roboto, sans-serif' }}>
                <motion.div
                    className={cn("bg-white rounded-[1.5rem] shadow-sm border border-slate-100/60 overflow-hidden", className)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {/* Header Logic - Only for the overall box */}
                    <div className="px-6 py-2 flex items-center justify-between border-b border-slate-50">
                        <div className="flex items-center gap-4">
                            {Icon && (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50 shadow-sm shrink-0">
                                    <Icon size={20} className="text-blue-600" />
                                </div>
                            )}
                            <h2 className="text-[1.1rem] font-bold text-slate-900 tracking-tight leading-tight">{title}</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            {headerRight}
                            <IconButton
                                onClick={() => helpMenu ? openHelpWithMenu(helpMenu) : toggleHelp()}
                                size="small"
                                sx={{
                                    bgcolor: "rgba(37, 99, 235, 0.05)",
                                    color: "#2563eb",
                                    "&:hover": { bgcolor: "rgba(37, 99, 235, 0.1)" },
                                    border: "1px solid rgba(37, 99, 235, 0.1)",
                                    width: 32,
                                    height: 32,
                                    animation: "pulseGlow 2s infinite",
                                    "@keyframes pulseGlow": {
                                        "0%": {
                                            boxShadow: "0 0 0 0 rgba(37, 99, 235, 0.4)",
                                            borderColor: "rgba(37, 99, 235, 0.2)"
                                        },
                                        "70%": {
                                            boxShadow: "0 0 0 6px rgba(37, 99, 235, 0)",
                                            borderColor: "rgba(37, 99, 235, 0.5)"
                                        },
                                        "100%": {
                                            boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)",
                                            borderColor: "rgba(37, 99, 235, 0.2)"
                                        }
                                    }
                                }}
                            >
                                <HelpIcon sx={{ fontSize: "1.2rem" }} />
                            </IconButton>
                        </div>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Top Row: Squarish Grid (5 columns) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                            {loading ? (
                                [1, 2, 3, 4, 5].map((i) => <ComparisonCard key={i} loading={true} />)
                            ) : (
                                topKpis.map((kpi, idx) => (
                                    <motion.div
                                        key={kpi.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.02, duration: 0.15 }}
                                    >
                                        <ComparisonCard kpi={kpi} loading={kpi.loading} />
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Bottom Row: Performance Section (4 columns) */}
                        <div className="pt-2 px-1 pb-1">
                            <div className="bg-[#f0f9f9]/60 rounded-2xl p-4 border border-cyan-100/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: 'white', display: 'flex', alignItems: 'center', justifyItems: 'center', pl: 0.6, border: '1px solid #cffafe' }}>
                                        <Zap size={16} className="text-orange-500 fill-orange-500/20" />
                                    </Box>
                                    <h3 className="text-[0.85rem] font-bold text-slate-800 tracking-tight">Performance Intelligence</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {performanceLoading ? (
                                        [1, 2, 3, 4].map((i) => <ActionableMetricCard key={i} loading={true} />)
                                    ) : (
                                        bottomKpis.map((kpi, idx) => (
                                            <motion.div
                                                key={kpi.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: (idx + 5) * 0.02, duration: 0.15 }}
                                            >
                                                <ActionableMetricCard kpi={kpi} />
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        )
    }

    // Default: Detailed View (Visibility/Availability style)
    return (
        <div style={{ marginBottom: '1.5rem', fontFamily: 'Roboto, sans-serif' }}>
            <motion.div
                className={cn("bg-white rounded-[2rem] shadow-sm border border-slate-100/60 overflow-hidden", className)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <div className="px-8 py-5 flex items-center justify-between border-b border-slate-50">
                    <div className="flex items-center gap-5">
                        {Icon && (
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                                <Icon size={24} className="text-slate-600" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">{title}</h2>
                            {chip && (
                                <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                                    {chip}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        {headerRight}
                        <IconButton
                            onClick={() => helpMenu ? openHelpWithMenu(helpMenu) : toggleHelp()}
                            size="small"
                            sx={{
                                bgcolor: "rgba(37, 99, 235, 0.05)",
                                color: "#2563eb",
                                "&:hover": { bgcolor: "rgba(37, 99, 235, 0.1)" },
                                border: "1px solid rgba(37, 99, 235, 0.1)",
                                width: 32,
                                height: 32,
                                animation: "pulseGlow 2s infinite",
                                "@keyframes pulseGlow": {
                                    "0%": {
                                        boxShadow: "0 0 0 0 rgba(37, 99, 235, 0.4)",
                                        borderColor: "rgba(37, 99, 235, 0.2)",
                                        color: "#2563eb"
                                    },
                                    "50%": {
                                        boxShadow: "0 0 0 10px rgba(37, 99, 235, 0)",
                                        borderColor: "rgba(37, 99, 235, 0.6)",
                                        color: "#1d4ed8"
                                    },
                                    "100%": {
                                        boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)",
                                        borderColor: "rgba(37, 99, 235, 0.2)",
                                        color: "#2563eb"
                                    }
                                }
                            }}
                        >
                            <HelpIcon sx={{ fontSize: "1.2rem" }} />
                        </IconButton>
                    </div>
                </div>

                <div className="p-4 sm:p-6 lg:p-8">
                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${detailedKpis.length === 5 ? 'lg:grid-cols-5' : detailedKpis.length === 6 ? 'lg:grid-cols-6' : detailedKpis.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 sm:gap-5 lg:gap-6`}>
                        {loading ? (
                            Array.from({ length: detailedKpis.length || 3 }).map((_, i) => (
                                <DetailedSparklineCard key={i} loading={true} />
                            ))
                        ) : (
                            detailedKpis.map((kpi, idx) => (
                                <motion.div
                                    key={kpi.id || idx}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.02, duration: 0.15 }}
                                    className="h-full"
                                >
                                    <DetailedSparklineCard kpi={kpi} />
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default SnapshotOverview
