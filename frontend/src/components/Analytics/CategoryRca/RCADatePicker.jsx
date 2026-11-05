import React, { useMemo, useState, useEffect } from "react";
import { Box, Typography, Button, Popover } from "@mui/material";
import dayjs from "dayjs";
import { Calendar, ChevronDown, Check } from "lucide-react";

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

function clampRange(start, end) {
    const s = startOfDay(start);
    const e = startOfDay(end);
    return s.getTime() <= e.getTime() ? [s, e] : [e, s];
}

function rangeLabel(start, end) {
    return `${fmtDDMMYYYY(start)} - ${fmtDDMMYYYY(end)}`;
}

export default function RCADatePicker({
    timeStart: initialStart,
    timeEnd: initialEnd,
    compareStart: initialCompareStart,
    compareEnd: initialCompareEnd,
    onApply,
    maxDate
}) {
    const today = useMemo(() => startOfDay(new Date()), []);

    const [start, setStart] = useState(initialStart ? initialStart.toDate() : today);
    const [end, setEnd] = useState(initialEnd ? initialEnd.toDate() : today);
    const [compareStart, setCompareStart] = useState(initialCompareStart ? initialCompareStart.toDate() : today);
    const [compareEnd, setCompareEnd] = useState(initialCompareEnd ? initialCompareEnd.toDate() : today);
    const [anchorEl, setAnchorEl] = useState(null);

    useEffect(() => {
        if (initialStart) setStart(initialStart.toDate());
    }, [initialStart]);

    useEffect(() => {
        if (initialEnd) setEnd(initialEnd.toDate());
    }, [initialEnd]);

    useEffect(() => {
        if (initialCompareStart) setCompareStart(initialCompareStart.toDate());
    }, [initialCompareStart]);

    useEffect(() => {
        if (initialCompareEnd) setCompareEnd(initialCompareEnd.toDate());
    }, [initialCompareEnd]);

    const primaryLabel = rangeLabel(...clampRange(start, end));
    const compareLabel = rangeLabel(...clampRange(compareStart, compareEnd));

    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    const open = Boolean(anchorEl);
    const maxDateStr = useMemo(() => maxDate ? toKey(maxDate.toDate()) : toKey(today), [maxDate, today]);

    function enforceMaxDate(date) {
        if (maxDate && date.getTime() > maxDate.toDate().getTime()) return maxDate.toDate();
        return date;
    }

    function onPrimaryStartChange(v) {
        let ns = fromKey(v);
        ns = enforceMaxDate(ns);
        const [cs, ce] = clampRange(ns, end);
        setStart(cs);
        setEnd(ce);
    }

    function onPrimaryEndChange(v) {
        let ne = fromKey(v);
        ne = enforceMaxDate(ne);
        const [cs, ce] = clampRange(start, ne);
        setStart(cs);
        setEnd(ce);
    }

    function onCompareStartChange(v) {
        let ns = fromKey(v);
        ns = enforceMaxDate(ns);
        const [cs, ce] = clampRange(ns, compareEnd);
        setCompareStart(cs);
        setCompareEnd(ce);
    }

    function onCompareEndChange(v) {
        let ne = fromKey(v);
        ne = enforceMaxDate(ne);
        const [cs, ce] = clampRange(compareStart, ne);
        setCompareStart(cs);
        setCompareEnd(ce);
    }

    function handleFinalApply() {
        if (onApply) {
            onApply(
                dayjs(start),
                dayjs(end),
                dayjs(compareStart),
                dayjs(compareEnd)
            );
        }
        handleClose();
    }

    return (
        <Box>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-blue-500 transition-all"
                style={{ cursor: 'pointer', textAlign: 'left', minHeight: '44px' }}
                onClick={handleOpen}
            >
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    justifyContent: 'center',
                    minWidth: { xs: 'auto', sm: '200px' }
                }}>
                    <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', mb: 0.2 }}>
                        {primaryLabel}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        vs {compareLabel}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                    <Calendar size={16} className="text-slate-400 flex-shrink-0" />
                    <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                </Box>
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
                        borderRadius: "16px",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)",
                        width: 320,
                        overflow: 'hidden'
                    }
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Current Period */}
                    <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', mb: 2 }}>Current Period</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>START DATE</Typography>
                                <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, bgcolor: '#ffffff' }}>
                                    <input
                                        type="date"
                                        value={toKey(start)}
                                        onChange={(e) => onPrimaryStartChange(e.target.value)}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                    />
                                </Box>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>END DATE</Typography>
                                <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, bgcolor: '#ffffff' }}>
                                    <input
                                        type="date"
                                        value={toKey(end)}
                                        onChange={(e) => onPrimaryEndChange(e.target.value)}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    {/* Comparison Period */}
                    <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', mb: 2 }}>Compare Period</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>COMP START</Typography>
                                <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, bgcolor: '#f8fafc' }}>
                                    <input
                                        type="date"
                                        value={toKey(compareStart)}
                                        onChange={(e) => onCompareStartChange(e.target.value)}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                    />
                                </Box>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', mb: 0.8, letterSpacing: '0.5px' }}>COMP END</Typography>
                                <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2, px: 1.5, py: 1, bgcolor: '#f8fafc' }}>
                                    <input
                                        type="date"
                                        value={toKey(compareEnd)}
                                        onChange={(e) => onCompareEndChange(e.target.value)}
                                        max={maxDateStr}
                                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155', background: 'transparent' }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    {/* Footer Actions */}
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1.5, alignItems: 'center', bgcolor: '#f8fafc' }}>
                        <Button onClick={handleClose} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 700, fontSize: '0.9rem', minWidth: 'auto', p: '6px 16px' }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleFinalApply}
                            sx={{
                                bgcolor: '#0f172a',
                                '&:hover': { bgcolor: '#1e293b' },
                                textTransform: 'none',
                                px: 3,
                                py: 0.8,
                                borderRadius: 1.5,
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
                            }}
                        >
                            Apply Dates
                        </Button>
                    </Box>
                </Box>
            </Popover>
        </Box>
    );
}
