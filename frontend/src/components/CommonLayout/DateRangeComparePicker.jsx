import React, { useMemo, useState, useEffect } from "react";
import { Box, Typography, Button, Popover } from "@mui/material";
import dayjs from "dayjs";

// Date Range + Compare Picker (single-file JSX)
// Refactored to use MUI Popover for reliability

function pad2(n) {
    return String(n).padStart(2, "0");
}

function toKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromKey(key) {
    if (!key) return new Date();
    const [y, m, d] = key.split("-").map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d);
}

function fmtDDMMYYYY(d) {
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
}

function addMonths(d, months) {
    const x = new Date(d);
    const day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + months);
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return x;
}

function addYears(d, years) {
    const x = new Date(d);
    x.setFullYear(x.getFullYear() + years);
    return x;
}

function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfQuarter(d) {
    const q = Math.floor(d.getMonth() / 3);
    return new Date(d.getFullYear(), q * 3, 1);
}

function daysBetweenInclusive(a, b) {
    const aa = startOfDay(a);
    const bb = startOfDay(b);
    const ms = bb.getTime() - aa.getTime();
    return Math.floor(ms / 86400000) + 1;
}

function clampRange(start, end) {
    const s = startOfDay(start);
    const e = startOfDay(end);
    return s.getTime() <= e.getTime() ? [s, e] : [e, s];
}

function rangeLabel(start, end) {
    return `${fmtDDMMYYYY(start)} - ${fmtDDMMYYYY(end)}`;
}

function computeCompareRange(primaryStart, primaryEnd, mode) {
    const [s, e] = clampRange(primaryStart, primaryEnd);
    const len = daysBetweenInclusive(s, e);

    if (mode === "previous") {
        const compEnd = addDays(s, -1);
        const compStart = addDays(compEnd, -(len - 1));
        return clampRange(compStart, compEnd);
    }

    if (mode === "same_last_month") {
        return clampRange(addMonths(s, -1), addMonths(e, -1));
    }

    if (mode === "same_last_year") {
        return clampRange(addYears(s, -1), addYears(e, -1));
    }

    if (mode === "lysm") {
        const target = addYears(s, -1);
        return clampRange(startOfMonth(target), endOfMonth(target));
    }

    return clampRange(addDays(s, -len), addDays(e, -len));
}

const QUICK_RANGES = (today) => {
    const t = startOfDay(today);
    const thisMonthStart = startOfMonth(t);
    const thisMonthEnd = t;
    const qtdStart = startOfQuarter(t);
    const ytdStart = new Date(t.getFullYear(), 0, 1);

    return [
        { key: "today", label: "Today", range: () => [t, t] },
        { key: "yesterday", label: "Yesterday", range: () => [addDays(t, -1), addDays(t, -1)] },
        { key: "last7", label: "Last 7 Days", range: () => [addDays(t, -6), t] },
        { key: "last14", label: "Last 14 Days", range: () => [addDays(t, -13), t] },
        { key: "last30", label: "Last 30 Days", range: () => [addDays(t, -29), t] },
        { key: "thisMonth", label: "This Month", range: () => [startOfMonth(t), endOfMonth(t)] },
        { key: "mtd", label: "Month to Date", range: () => [thisMonthStart, thisMonthEnd] },
        { key: "qtd", label: "Quarter to Date", range: () => [qtdStart, t] },
        { key: "ytd", label: "Year to Date", range: () => [ytdStart, t] },
        {
            key: "l3m", label: "Last 3 Months", range: () => {
                const end = new Date(t.getFullYear(), t.getMonth(), 0);
                const start = startOfMonth(addMonths(end, -2));
                return [start, end];
            }
        },
        {
            key: "l6m", label: "Last 6 Months", range: () => {
                const end = new Date(t.getFullYear(), t.getMonth(), 0);
                const start = startOfMonth(addMonths(end, -5));
                return [start, end];
            }
        },
    ];
};

function CustomChip({ active, onClick, title }) {
    return (
        <button
            onClick={onClick}
            className={
                "group w-full rounded-xl border px-3 py-2.5 text-left transition " +
                (active
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")
            }
        >
            <div className="text-[14px] font-bold text-slate-900 leading-tight">{title}</div>
        </button>
    );
}

function CustomSegButton({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={
                "rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition " +
                (active
                    ? "bg-slate-900 text-white"
                    : "bg-transparent text-slate-700 hover:bg-slate-200")
            }
        >
            {children}
        </button>
    );
}

function CustomToggle({ enabled, onChange }) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            type="button"
            className={
                "relative h-6 w-10 rounded-full border transition " +
                (enabled ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-slate-200")
            }
            aria-label="Toggle compare"
        >
            <span
                className={
                    "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition " +
                    (enabled ? "left-5" : "left-0.5")
                }
            />
        </button>
    );
}

export default function DateRangeComparePicker({
    timeStart,
    timeEnd,
    compareStart: initialCompareStart,
    compareEnd: initialCompareEnd,
    onApply
}) {
    const today = useMemo(() => new Date(), []);
    const [anchorEl, setAnchorEl] = useState(null);

    const [start, setStart] = useState(timeStart ? timeStart.toDate() : addDays(today, -7));
    const [end, setEnd] = useState(timeEnd ? timeEnd.toDate() : today);

    const [activeQuick, setActiveQuick] = useState("last7");
    const [compareOn, setCompareOn] = useState(true);
    const [compareMode, setCompareMode] = useState("previous");

    const computedCompare = useMemo(() => computeCompareRange(start, end, compareMode), [start, end, compareMode]);
    const [customCompareStart, setCustomCompareStart] = useState(initialCompareStart ? initialCompareStart.toDate() : computedCompare[0]);
    const [customCompareEnd, setCustomCompareEnd] = useState(initialCompareEnd ? initialCompareEnd.toDate() : computedCompare[1]);

    const compareStartFinal = compareMode === "custom" ? customCompareStart : computedCompare[0];
    const compareEndFinal = compareMode === "custom" ? customCompareEnd : computedCompare[1];

    const primaryLabel = rangeLabel(...clampRange(start, end));
    const compareLabel = rangeLabel(...clampRange(compareStartFinal, compareEndFinal));

    const quickRanges = useMemo(() => QUICK_RANGES(today), [today]);

    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    const open = Boolean(anchorEl);

    function applyQuick(key) {
        const item = quickRanges.find((x) => x.key === key);
        if (!item) return;
        const [s, e] = item.range();
        const [cs, ce] = clampRange(s, e);
        setStart(cs);
        setEnd(ce);
        setActiveQuick(key);

        const [ns, ne] = computeCompareRange(cs, ce, compareMode);
        setCustomCompareStart(ns);
        setCustomCompareEnd(ne);
    }

    function onPrimaryStartChange(v) {
        const ns = fromKey(v);
        const [cs, ce] = clampRange(ns, end);
        setStart(cs);
        setEnd(ce);
        setActiveQuick("custom");

        const [ns2, ne2] = computeCompareRange(cs, ce, compareMode);
        setCustomCompareStart(ns2);
        setCustomCompareEnd(ne2);
    }

    function onPrimaryEndChange(v) {
        const ne = fromKey(v);
        const [cs, ce] = clampRange(start, ne);
        setStart(cs);
        setEnd(ce);
        setActiveQuick("custom");

        const [ns2, ne2] = computeCompareRange(cs, ce, compareMode);
        setCustomCompareStart(ns2);
        setCustomCompareEnd(ne2);
    }

    function setMode(mode) {
        setCompareMode(mode);
        if (mode !== "custom") {
            const [ns, ne] = computeCompareRange(start, end, mode);
            setCustomCompareStart(ns);
            setCustomCompareEnd(ne);
        }
    }

    function handleFinalApply() {
        if (onApply) {
            onApply(
                dayjs(start),
                dayjs(end),
                dayjs(compareStartFinal),
                dayjs(compareEndFinal),
                compareOn
            );
        }
        handleClose();
    }

    return (
        <Box>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-slate-50"
                style={{ cursor: 'pointer', textAlign: 'left', minHeight: '38px', minWidth: '190px' }}
                onClick={handleOpen}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                        {primaryLabel}
                    </Typography>
                    {compareOn && (
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.2, fontWeight: 500 }}>
                            vs {compareLabel}
                        </Typography>
                    )}
                </Box>
                <Typography sx={{ color: '#94a3b8', fontSize: '10px' }}>▼</Typography>
            </button>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                PaperProps={{
                    sx: {
                        mt: 1,
                        width: { xs: 360, sm: 480 },
                        borderRadius: 3,
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                        border: "1px solid #e2e8f0",
                        overflow: "hidden"
                    }
                }}
            >
                <Box sx={{ maxHeight: "85vh", overflowY: "auto", bgcolor: 'white' }}>
                    <Box sx={{ p: 2.5, borderBottom: "1px solid #f1f5f9" }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 2 }}>Select Date Range</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', mb: 0.5 }}>START DATE</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 2, px: 1.5, py: 1 }}>
                                    <input
                                        type="date"
                                        value={toKey(start)}
                                        onChange={(e) => onPrimaryStartChange(e.target.value)}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                                    />
                                </Box>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', mb: 0.5 }}>END DATE</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 2, px: 1.5, py: 1 }}>
                                    <input
                                        type="date"
                                        value={toKey(end)}
                                        onChange={(e) => onPrimaryEndChange(e.target.value)}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ mt: 3 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', mb: 1.5 }}>Quick Ranges</Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                                {quickRanges.map((q) => (
                                    <CustomChip
                                        key={q.key}
                                        active={activeQuick === q.key}
                                        onClick={() => applyQuick(q.key)}
                                        title={q.label}
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Compare with</Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Enable reference period</Typography>
                            </Box>
                            <CustomToggle enabled={compareOn} onChange={setCompareOn} />
                        </Box>

                        {compareOn && (
                            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2 }}>
                                <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f8fafc', p: 0.75, borderRadius: 2, mb: 2 }}>
                                    <CustomSegButton active={compareMode === "previous"} onClick={() => setMode("previous")}>Prev</CustomSegButton>
                                    <CustomSegButton active={compareMode === "same_last_month"} onClick={() => setMode("same_last_month")}>Month</CustomSegButton>
                                    <CustomSegButton active={compareMode === "same_last_year"} onClick={() => setMode("same_last_year")}>Year</CustomSegButton>
                                    <CustomSegButton active={compareMode === "lysm"} onClick={() => setMode("lysm")}>LYSM</CustomSegButton>
                                    <CustomSegButton active={compareMode === "custom"} onClick={() => setMode("custom")}>Custom</CustomSegButton>
                                </Box>

                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                    <Box>
                                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', mb: 0.5 }}>COMP START</Typography>
                                        <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, px: 1, py: 0.75 }}>
                                            <input
                                                type="date"
                                                value={toKey(compareStartFinal)}
                                                onChange={(e) => {
                                                    setCompareMode("custom");
                                                    setCustomCompareStart(fromKey(e.target.value));
                                                }}
                                                style={{
                                                    border: 'none', outline: 'none', width: '100%', fontSize: '11px',
                                                    color: compareMode === 'custom' ? '#0f172a' : '#94a3b8'
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', mb: 0.5 }}>COMP END</Typography>
                                        <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, px: 1, py: 0.75 }}>
                                            <input
                                                type="date"
                                                value={toKey(compareEndFinal)}
                                                onChange={(e) => {
                                                    setCompareMode("custom");
                                                    setCustomCompareEnd(fromKey(e.target.value));
                                                }}
                                                style={{
                                                    border: 'none', outline: 'none', width: '100%', fontSize: '11px',
                                                    color: compareMode === 'custom' ? '#0f172a' : '#94a3b8'
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button onClick={handleClose} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
                            <Button
                                variant="contained"
                                onClick={handleFinalApply}
                                sx={{
                                    bgcolor: '#2563eb',
                                    '&:hover': { bgcolor: '#1d4ed8' },
                                    textTransform: 'none',
                                    px: 4,
                                    borderRadius: 2,
                                    fontWeight: 600
                                }}
                            >
                                Apply
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Popover>
        </Box>
    );
}
