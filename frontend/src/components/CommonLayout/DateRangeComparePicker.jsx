import React, { useMemo, useState, useEffect } from "react";
import { Box, Typography, Button, Popover } from "@mui/material";
import dayjs from "dayjs";

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

function startOfYear(d) {
    return new Date(d.getFullYear(), 0, 1);
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

    if (mode === "Prev") {
        const compEnd = addDays(s, -1);
        const compStart = addDays(compEnd, -(len - 1));
        return clampRange(compStart, compEnd);
    } else if (mode === "Month") {
        return clampRange(addMonths(s, -1), addMonths(e, -1));
    } else if (mode === "Year") {
        return clampRange(addYears(s, -1), addYears(e, -1));
    } else if (mode === "LYSM") {
        return clampRange(addYears(startOfMonth(s), -1), addYears(endOfMonth(e), -1));
    }
    return [s, e];
}

export default function DateRangeComparePicker({
    timeStart,
    timeEnd,
    compareStart: initialCompareStart,
    compareEnd: initialCompareEnd,
    maxDate,
    minDate,
    onApply
}) {
    const today = useMemo(() => maxDate ? maxDate.toDate() : new Date(), [maxDate]);
    const [anchorEl, setAnchorEl] = useState(null);

    const [start, setStart] = useState(timeStart ? timeStart.toDate() : addDays(today, -7));
    const [end, setEnd] = useState(timeEnd ? timeEnd.toDate() : today);

    function enforceMinDate(date) {
        if (minDate && date.getTime() < minDate.toDate().getTime()) return minDate.toDate();
        return date;
    }



    const [compareOn, setCompareOn] = useState(true);
    const [compareMode, setCompareMode] = useState("Prev");

    const computedCompare = useMemo(() => {
        const range = computeCompareRange(start, end, compareMode);
        if (minDate) {
            const minTime = minDate.toDate().getTime();
            let cs = range[0];
            let ce = range[1];
            if (cs.getTime() < minTime) {
                cs = minDate.toDate();
            }
            if (ce.getTime() < minTime) {
                ce = minDate.toDate();
            }
            return clampRange(cs, ce);
        }
        return range;
    }, [start, end, compareMode, minDate]);

    const [customCompareStart, setCustomCompareStart] = useState(initialCompareStart ? initialCompareStart.toDate() : computedCompare[0]);
    const [customCompareEnd, setCustomCompareEnd] = useState(initialCompareEnd ? initialCompareEnd.toDate() : computedCompare[1]);

    useEffect(() => {
        if (compareMode !== "Custom") {
            setCustomCompareStart(computedCompare[0]);
            setCustomCompareEnd(computedCompare[1]);
        }
    }, [computedCompare, compareMode]);

    useEffect(() => {
        if (initialCompareStart) setCustomCompareStart(enforceMinDate(initialCompareStart.toDate()));
    }, [initialCompareStart, minDate]);

    useEffect(() => {
        if (initialCompareEnd) setCustomCompareEnd(enforceMinDate(initialCompareEnd.toDate()));
    }, [initialCompareEnd, minDate]);

    function isCompareModeAvailable(mode) {
        if (mode === "Custom") return true;
        if (!minDate) return true;
        const range = computeCompareRange(start, end, mode);
        return range[0].getTime() >= minDate.toDate().getTime();
    }

    useEffect(() => {
        if (compareMode !== "Custom" && !isCompareModeAvailable(compareMode)) {
            const availableModes = ["Prev", "Month", "Year", "LYSM"].filter(m => isCompareModeAvailable(m));
            if (availableModes.length > 0) {
                setCompareMode(availableModes[0]);
            } else {
                setCompareMode("Custom");
            }
        }
    }, [start, end, minDate, compareMode]);

    const compareStartFinal = customCompareStart;
    const compareEndFinal = customCompareEnd;

    const primaryLabel = rangeLabel(...clampRange(start, end));
    const compareLabel = rangeLabel(...clampRange(compareStartFinal, compareEndFinal));

    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    const open = Boolean(anchorEl);
    const maxDateStr = useMemo(() => maxDate ? toKey(maxDate.toDate()) : toKey(today), [maxDate, today]);
    const minDateStr = useMemo(() => minDate ? toKey(minDate.toDate()) : undefined, [minDate]);
    const [selectedRangeLabel, setSelectedRangeLabel] = useState("Custom");

    function enforceMaxDate(date) {
        if (maxDate && date.getTime() > maxDate.toDate().getTime()) return maxDate.toDate();
        return date;
    }

    function onPrimaryStartChange(v) {
        let ns = fromKey(v);
        ns = enforceMaxDate(ns);
        ns = enforceMinDate(ns);
        const [cs, ce] = clampRange(ns, end);
        setStart(cs);
        setEnd(ce);
        setSelectedRangeLabel("Custom");
    }

    function onPrimaryEndChange(v) {
        let ne = fromKey(v);
        ne = enforceMaxDate(ne);
        ne = enforceMinDate(ne);
        const [cs, ce] = clampRange(start, ne);
        setStart(cs);
        setEnd(ce);
        setSelectedRangeLabel("Custom");
    }

    function setQuickRange(s, e, label) {
        setStart(enforceMinDate(enforceMaxDate(s)));
        setEnd(enforceMinDate(enforceMaxDate(e)));
        setSelectedRangeLabel(label);
    }

    const QUICK_RANGES = [
        { label: "Today", fn: () => setQuickRange(today, today, "Today") },
        { label: "Yesterday", fn: () => setQuickRange(addDays(today, -1), addDays(today, -1), "Yesterday") },
        { label: "Last 7 Days", fn: () => setQuickRange(addDays(today, -6), today, "Last 7 Days") },
        { label: "Last 14 Days", fn: () => setQuickRange(addDays(today, -13), today, "Last 14 Days") },
        { label: "Last 30 Days", fn: () => setQuickRange(addDays(today, -29), today, "Last 30 Days") },
        { label: "This Month", fn: () => setQuickRange(startOfMonth(today), endOfMonth(today), "This Month") },
        { label: "Last Month", fn: () => setQuickRange(startOfMonth(addMonths(today, -1)), endOfMonth(addMonths(today, -1)), "Last Month") },
        { label: "Month to Date", fn: () => setQuickRange(startOfMonth(today), today, "Month to Date") },
        { label: "Quarter to Date", fn: () => setQuickRange(startOfQuarter(today), today, "Quarter to Date") },
        { label: "Year to Date", fn: () => setQuickRange(startOfYear(today), today, "Year to Date") },
        { label: "Last 3 Months", fn: () => setQuickRange(addDays(today, -89), today, "Last 3 Months") },
        { label: "Last 6 Months", fn: () => setQuickRange(addDays(today, -179), today, "Last 6 Months") },
    ];

    useEffect(() => {
        if (timeStart && timeEnd) {
            const s = enforceMinDate(timeStart.toDate());
            const e = enforceMinDate(timeEnd.toDate());
            setStart(s);
            setEnd(e);

            const sKey = toKey(s);
            const eKey = toKey(e);
            let matchedLabel = "Custom";

            const getRangeDates = (label) => {
                switch (label) {
                    case "Today": return [today, today];
                    case "Yesterday": return [addDays(today, -1), addDays(today, -1)];
                    case "Last 7 Days": return [addDays(today, -6), today];
                    case "Last 14 Days": return [addDays(today, -13), today];
                    case "Last 30 Days": return [addDays(today, -29), today];
                    case "This Month": return [startOfMonth(today), endOfMonth(today)];
                    case "Last Month": return [startOfMonth(addMonths(today, -1)), endOfMonth(addMonths(today, -1))];
                    case "Month to Date": return [startOfMonth(today), today];
                    case "Quarter to Date": return [startOfQuarter(today), today];
                    case "Year to Date": return [startOfYear(today), today];
                    case "Last 3 Months": return [addDays(today, -89), today];
                    case "Last 6 Months": return [addDays(today, -179), today];
                    default: return [null, null];
                }
            };

            for (const qr of QUICK_RANGES) {
                const [qs, qe] = getRangeDates(qr.label);
                if (qs && qe) {
                    const qsClamped = enforceMinDate(enforceMaxDate(qs));
                    const qeClamped = enforceMinDate(enforceMaxDate(qe));
                    if (toKey(qsClamped) === sKey && toKey(qeClamped) === eKey) {
                        matchedLabel = qr.label;
                        break;
                    }
                }
            }
            setSelectedRangeLabel(matchedLabel);
        }
    }, [timeStart, timeEnd, minDate, maxDate, today]);

    function handleFinalApply() {
        if (onApply) {
            onApply(
                dayjs(start),
                dayjs(end),
                dayjs(compareStartFinal),
                dayjs(compareEndFinal),
                compareOn,
                selectedRangeLabel
            );
        }
        handleClose();
    }

    return (
        <Box>
            <button
                type="button"
                className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm hover:border-blue-500 transition-all"
                style={{ cursor: 'pointer', textAlign: 'left', minHeight: '36px', minWidth: '210px' }}
                onClick={handleOpen}
            >
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    justifyContent: 'center',
                }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.3, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                        {primaryLabel}
                    </Typography>
                    {compareOn && (
                        <Typography sx={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1.3, fontWeight: 400, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                            vs {compareLabel}
                        </Typography>
                    )}
                </Box>
                <Typography sx={{ color: '#94a3b8', fontSize: '10px', flexShrink: 0 }}>▼</Typography>
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
                        width: 380,
                        maxWidth: 380,
                        borderRadius: 3,
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                        border: "1px solid #e2e8f0",
                        overflow: "hidden"
                    }
                }}
            >
                <Box sx={{ bgcolor: 'white', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 2.5, borderBottom: "1px solid #f1f5f9" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 2, color: '#0f172a' }}>Select Date Range</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>START DATE</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, '&:hover': { borderColor: '#94a3b8' } }}>
                                    <input
                                        type="date"
                                        value={toKey(start)}
                                        onChange={(e) => onPrimaryStartChange(e.target.value)}
                                        min={minDateStr}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                    />
                                </Box>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>END DATE</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, '&:hover': { borderColor: '#94a3b8' } }}>
                                    <input
                                        type="date"
                                        value={toKey(end)}
                                        onChange={(e) => onPrimaryEndChange(e.target.value)}
                                        min={minDateStr}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ p: 2.5, borderBottom: "1px solid #f1f5f9" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', mb: 2 }}>Compare with</Typography>

                        <Box sx={{
                            height: 'auto',
                            opacity: 1
                        }}>
                            {/* Compare Tabs */}
                            <Box sx={{ display: 'flex', bgcolor: '#f8fafc', borderRadius: 2, p: 0.5, mb: 2.5, border: '1px solid #f1f5f9' }}>
                                {["Prev", "Month", "Year", "LYSM", "Custom"].map(mode => {
                                    const available = isCompareModeAvailable(mode);
                                    return (
                                        <Box
                                            key={mode}
                                            onClick={() => {
                                                if (available) setCompareMode(mode);
                                            }}
                                            sx={{
                                                flex: 1,
                                                textAlign: 'center',
                                                py: 0.8,
                                                borderRadius: 1.5,
                                                cursor: available ? 'pointer' : 'not-allowed',
                                                fontSize: '0.75rem',
                                                fontWeight: compareMode === mode ? 700 : 600,
                                                bgcolor: compareMode === mode ? '#0f172a' : 'transparent',
                                                color: compareMode === mode ? '#ffffff' : (available ? '#475569' : '#cbd5e1'),
                                                opacity: available ? 1 : 0.5,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {mode}
                                        </Box>
                                    );
                                })}
                            </Box>

                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <Box sx={{ opacity: compareMode !== 'Custom' ? 0.6 : 1, pointerEvents: compareMode !== 'Custom' ? 'none' : 'auto' }}>
                                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>COMP START</Typography>
                                    <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, bgcolor: compareMode !== 'Custom' ? '#f8fafc' : 'transparent' }}>
                                        <input
                                            type="date"
                                            value={toKey(customCompareStart)}
                                            onChange={(e) => {
                                                let nd = fromKey(e.target.value);
                                                nd = enforceMaxDate(nd);
                                                nd = enforceMinDate(nd);
                                                setCustomCompareStart(nd);
                                            }}
                                            min={minDateStr}
                                            max={maxDateStr}
                                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                        />
                                    </Box>
                                </Box>
                                <Box sx={{ opacity: compareMode !== 'Custom' ? 0.6 : 1, pointerEvents: compareMode !== 'Custom' ? 'none' : 'auto' }}>
                                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>COMP END</Typography>
                                    <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, bgcolor: compareMode !== 'Custom' ? '#f8fafc' : 'transparent' }}>
                                        <input
                                            type="date"
                                            value={toKey(customCompareEnd)}
                                            onChange={(e) => {
                                                let nd = fromKey(e.target.value);
                                                nd = enforceMaxDate(nd);
                                                nd = enforceMinDate(nd);
                                                setCustomCompareEnd(nd);
                                            }}
                                            min={minDateStr}
                                            max={maxDateStr}
                                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ p: 2.5 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', mb: 1.5 }}>Quick Ranges</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {QUICK_RANGES.map((qr) => {
                                const isSelected = selectedRangeLabel === qr.label;
                                return (
                                    <Box
                                        key={qr.label}
                                        onClick={qr.fn}
                                        sx={{
                                            px: 1.5,
                                            py: 0.6,
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: isSelected ? '#0f172a' : '#e2e8f0',
                                            bgcolor: isSelected ? '#0f172a' : 'transparent',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: isSelected ? '#ffffff' : '#0f172a',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                borderColor: isSelected ? '#0f172a' : '#94a3b8',
                                                bgcolor: isSelected ? '#0f172a' : '#f8fafc'
                                            }
                                        }}
                                    >
                                        {qr.label}
                                    </Box>
                                );
                            })}
                        </Box>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-start', gap: 1.5, alignItems: 'center' }}>
                            <Button onClick={handleClose} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 700, fontSize: '0.9rem', minWidth: 'auto', p: '6px 16px' }}>
                                Cancel
                            </Button>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button
                                variant="contained"
                                onClick={handleFinalApply}
                                sx={{
                                    bgcolor: '#2563eb',
                                    '&:hover': { bgcolor: '#1d4ed8' },
                                    textTransform: 'none',
                                    px: 3,
                                    py: 0.8,
                                    borderRadius: 1.5,
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    boxShadow: 'none',
                                    flexShrink: 0
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
