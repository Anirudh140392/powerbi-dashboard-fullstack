import React, { useMemo, useState, useEffect } from "react";
import { Box, Typography, Button, Popover } from "@mui/material";
import dayjs from "dayjs";

// Date Range + Compare Picker (single-file JSX)
// Refactored for RCA focused view (Small Manual Window)

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
    return clampRange(addDays(s, -len), addDays(e, -len));
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
    maxDate,
    onApply
}) {
    const today = useMemo(() => maxDate ? maxDate.toDate() : new Date(), [maxDate]);
    const [anchorEl, setAnchorEl] = useState(null);

    const [start, setStart] = useState(timeStart ? timeStart.toDate() : addDays(today, -7));
    const [end, setEnd] = useState(timeEnd ? timeEnd.toDate() : today);

    useEffect(() => {
        if (timeStart) setStart(timeStart.toDate());
    }, [timeStart]);

    useEffect(() => {
        if (timeEnd) setEnd(timeEnd.toDate());
    }, [timeEnd]);

    const [compareOn, setCompareOn] = useState(true);
    const [compareMode, setCompareMode] = useState("custom");

    const computedCompare = useMemo(() => computeCompareRange(start, end, "previous"), [start, end]);
    const [customCompareStart, setCustomCompareStart] = useState(initialCompareStart ? initialCompareStart.toDate() : computedCompare[0]);
    const [customCompareEnd, setCustomCompareEnd] = useState(initialCompareEnd ? initialCompareEnd.toDate() : computedCompare[1]);

    useEffect(() => {
        if (initialCompareStart) setCustomCompareStart(initialCompareStart.toDate());
    }, [initialCompareStart]);

    useEffect(() => {
        if (initialCompareEnd) setCustomCompareEnd(initialCompareEnd.toDate());
    }, [initialCompareEnd]);

    const compareStartFinal = customCompareStart;
    const compareEndFinal = customCompareEnd;

    const primaryLabel = rangeLabel(...clampRange(start, end));
    const compareLabel = rangeLabel(...clampRange(compareStartFinal, compareEndFinal));

    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    const open = Boolean(anchorEl);
    const maxDateStr = useMemo(() => maxDate ? toKey(maxDate.toDate()) : toKey(today), [maxDate, today]);

    function onPrimaryStartChange(v) {
        let ns = fromKey(v);
        if (maxDate && ns.getTime() > maxDate.toDate().getTime()) ns = maxDate.toDate();
        const [cs, ce] = clampRange(ns, end);
        setStart(cs);
        setEnd(ce);
    }

    function onPrimaryEndChange(v) {
        let ne = fromKey(v);
        if (maxDate && ne.getTime() > maxDate.toDate().getTime()) ne = maxDate.toDate();
        const [cs, ce] = clampRange(start, ne);
        setStart(cs);
        setEnd(ce);
    }

    function handleFinalApply() {
        if (onApply) {
            onApply(
                dayjs(start),
                dayjs(end),
                dayjs(compareStartFinal),
                dayjs(compareEndFinal),
                compareOn,
                "Custom Range"
            );
        }
        handleClose();
    }

    return (
        <Box>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm shadow-sm hover:border-blue-500 transition-all"
                style={{ cursor: 'pointer', textAlign: 'left', height: '34px' }}
                onClick={handleOpen}
            >
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    justifyContent: 'center',
                    minWidth: { xs: 'auto', sm: '160px' }
                }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, color: '#000000', lineHeight: 1.1, fontFamily: 'Inter, sans-serif' }}>
                        {primaryLabel}
                    </Typography>
                    {compareOn && (
                        <Typography sx={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1.1, fontWeight: 400, fontFamily: 'Inter, sans-serif' }}>
                            vs {compareLabel}
                        </Typography>
                    )}
                </Box>
                <Typography sx={{ color: '#94a3b8', fontSize: '9px' }}>▼</Typography>
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
                        width: 320,
                        maxWidth: 320,
                        borderRadius: 3,
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                        border: "1px solid #e2e8f0",
                        overflow: "hidden"
                    }
                }}
            >
                <Box sx={{ bgcolor: 'white' }}>
                    <Box sx={{ p: 2, borderBottom: "1px solid #f1f5f9" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', mb: 1.5 }}>Select Date Range</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b', mb: 0.5 }}>START</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 1.5, px: 1, py: 0.5 }}>
                                    <input
                                        type="date"
                                        value={toKey(start)}
                                        onChange={(e) => onPrimaryStartChange(e.target.value)}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '11px' }}
                                    />
                                </Box>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b', mb: 0.5 }}>END</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 1.5, px: 1, py: 0.5 }}>
                                    <input
                                        type="date"
                                        value={toKey(end)}
                                        onChange={(e) => onPrimaryEndChange(e.target.value)}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '11px' }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>Compare with</Typography>
                            <CustomToggle enabled={compareOn} onChange={setCompareOn} />
                        </Box>

                        {compareOn && (
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                                <Box>
                                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b', mb: 0.5 }}>COMP START</Typography>
                                    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, px: 1, py: 0.5 }}>
                                        <input
                                            type="date"
                                            value={toKey(customCompareStart)}
                                            onChange={(e) => setCustomCompareStart(fromKey(e.target.value))}
                                            max={maxDateStr}
                                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '11px' }}
                                        />
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b', mb: 0.5 }}>COMP END</Typography>
                                    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, px: 1, py: 0.5 }}>
                                        <input
                                            type="date"
                                            value={toKey(customCompareEnd)}
                                            onChange={(e) => setCustomCompareEnd(fromKey(e.target.value))}
                                            max={maxDateStr}
                                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '11px' }}
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Button onClick={handleClose} size="small" sx={{ color: '#64748b', textTransform: 'none', fontWeight: 900, fontSize: '11px' }}>Cancel</Button>
                            <Button
                                variant="contained"
                                onClick={handleFinalApply}
                                size="small"
                                sx={{
                                    bgcolor: '#000',
                                    '&:hover': { bgcolor: '#333' },
                                    textTransform: 'none',
                                    px: 2,
                                    borderRadius: 1.5,
                                    fontWeight: 900,
                                    fontSize: '11px'
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
