import React from "react";
import dayjs from "dayjs";
import { Box, Chip, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { EventOutlined as CalendarIcon } from "@mui/icons-material";
import { currentListedPeriod, FISCAL_PERIODS, lastPeriods, periodLabel, periodRangeLabel, yearToDate } from "./fiscalCalendar";

const PERIOD_MODES = { dashboard: "Dashboard dates", fiscal: "Periods" };

const QUICK_RANGES = [
    { id: "current", label: "This period", range: () => lastPeriods(1) },
    { id: "last2", label: "Last 2", range: () => lastPeriods(2) },
    { id: "last4", label: "Last 4", range: () => lastPeriods(4) },
    { id: "ytd", label: "Year to date", range: () => yearToDate() },
];

const periodIndex = (id) => FISCAL_PERIODS.findIndex((p) => p.id === id);

const segmentedSx = {
    bgcolor: "#f1f5f9",
    borderRadius: "8px",
    p: "2px",
    "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        borderRadius: "6px",
        py: 0.35,
        px: 1.25,
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "#64748b",
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#ffffff", color: "#1e293b", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)" },
    },
};

const selectSx = {
    minWidth: 128,
    "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700, bgcolor: "#ffffff", "& fieldset": { borderColor: "#e2e8f0" } },
    "& .MuiSelect-select": { py: 0.6 },
};

function PeriodSelect({ label, value, onChange, today }) {
    const current = currentListedPeriod(today);
    return (
        <TextField
            select
            size="small"
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            sx={selectSx}
            InputLabelProps={{ sx: { fontSize: "0.78rem" } }}
            SelectProps={{
                renderValue: (id) => {
                    const period = FISCAL_PERIODS.find((p) => p.id === id);
                    return period ? periodLabel(period) : id;
                },
                MenuProps: { PaperProps: { sx: { maxHeight: 360, borderRadius: "10px" } } },
            }}
        >
            {FISCAL_PERIODS.map((period) => {
                const upcoming = dayjs(period.start).isAfter(today, "day");
                return (
                    <MenuItem key={period.id} value={period.id} disabled={upcoming} sx={{ gap: 1.5, py: 0.6 }}>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b", minWidth: 64 }}>{periodLabel(period)}</Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b", flex: 1 }}>{periodRangeLabel(period)}</Typography>
                        {period.id === current.id && (
                            <Chip label="Current" size="small" sx={{ height: 18, fontSize: "0.64rem", fontWeight: 700, bgcolor: "#eff6ff", color: "#2563eb" }} />
                        )}
                        {upcoming && <Typography sx={{ fontSize: "0.66rem", color: "#94a3b8" }}>Upcoming</Typography>}
                    </MenuItem>
                );
            })}
        </TextField>
    );
}

/**
 * Where the report's dates come from: the dashboard's date picker, or a range of
 * fiscal periods. A period range ends today at the latest.
 */
export default function ReportingPeriodBar({ value, onChange, range, today = dayjs() }) {
    const fiscal = value.mode === "fiscal";
    const days = range ? range.end.diff(range.start, "day") + 1 : 0;
    const activeQuick = fiscal && QUICK_RANGES.find((q) => {
        const r = q.range();
        return r.from === value.from && r.to === value.to;
    });

    const setFrom = (from) => onChange({ ...value, from, to: periodIndex(from) > periodIndex(value.to) ? from : value.to });
    const setTo = (to) => onChange({ ...value, to, from: periodIndex(to) < periodIndex(value.from) ? to : value.from });

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                columnGap: 1.5,
                rowGap: 1,
                flexWrap: "wrap",
                px: 1.5,
                py: 1,
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                bgcolor: "#ffffff",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <CalendarIcon sx={{ fontSize: "1.1rem", color: "#64748b" }} />
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 750, color: "#1e293b", whiteSpace: "nowrap" }}>Reporting period</Typography>
            </Box>

            <ToggleButtonGroup
                exclusive
                size="small"
                value={value.mode}
                onChange={(_, mode) => mode && onChange({ ...value, mode })}
                aria-label="Reporting period source"
                sx={segmentedSx}
            >
                {Object.entries(PERIOD_MODES).map(([id, label]) => (
                    <ToggleButton key={id} value={id}>{label}</ToggleButton>
                ))}
            </ToggleButtonGroup>

            {fiscal && (
                <>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <PeriodSelect label="From" value={value.from} onChange={setFrom} today={today} />
                        <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>to</Typography>
                        <PeriodSelect label="To" value={value.to} onChange={setTo} today={today} />
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                        {QUICK_RANGES.map((q) => {
                            const active = activeQuick?.id === q.id;
                            return (
                                <Chip
                                    key={q.id}
                                    label={q.label}
                                    size="small"
                                    clickable
                                    onClick={() => onChange({ ...value, ...q.range() })}
                                    sx={{
                                        height: 24,
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        borderRadius: "7px",
                                        border: "1px solid",
                                        borderColor: active ? "#93c5fd" : "#e2e8f0",
                                        bgcolor: active ? "#eff6ff" : "#ffffff",
                                        color: active ? "#1d4ed8" : "#475569",
                                    }}
                                />
                            );
                        })}
                    </Box>
                </>
            )}

            <Box sx={{ flex: 1 }} />
            {range ? (
                <Typography sx={{ fontSize: "0.78rem", color: "#475569", whiteSpace: "nowrap" }}>
                    <Box component="span" sx={{ fontWeight: 700, color: "#1e293b" }}>
                        {range.start.format("DD MMM YYYY")} – {range.end.format("DD MMM YYYY")}
                    </Box>
                    {` · ${days} ${days === 1 ? "day" : "days"}`}
                </Typography>
            ) : (
                <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8" }}>Loading dates…</Typography>
            )}
        </Box>
    );
}
