import React, { useMemo, useState } from "react";
import { Box, Button, Checkbox, Chip, InputAdornment, Paper, TextField, Tooltip, Typography } from "@mui/material";
import {
    Search as SearchIcon,
    LockOutlined as LockIcon,
    WarningAmberRounded as WarningIcon,
} from "@mui/icons-material";
import { FIELD_GROUPS, FIELDS_BY_KEY, REPORT_FIELDS, SOURCES_BY_ID } from "./reportStudioConfig";
import { getFieldSources, getUnavailableReason, isFieldAvailable } from "./reportStudioUtils";

const UNIT_BADGE = { currency: "₹", percent: "%", ratio: "x", number: "#" };

const SectionHeader = ({ title }) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, pt: 1.5, pb: 0.5 }}>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", color: "rgba(30, 41, 59, 0.45)", textTransform: "uppercase" }}>
            {title}
        </Typography>
        <Box sx={{ flex: 1, height: "1px", bgcolor: "rgba(0, 0, 0, 0.05)" }} />
    </Box>
);

function FieldRow({ field, checked, sources, onToggle }) {
    const isKpi = field.group === FIELD_GROUPS.KPI;
    const available = isFieldAvailable(field, sources);
    const disabled = !available && !checked;
    const warning = !available && checked;

    const tooltip = warning || disabled ? getUnavailableReason(field, sources) : "";
    const row = (
        <Box
            component="label"
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 0.75,
                py: 0.35,
                borderRadius: "8px",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                bgcolor: warning ? "#fffbeb" : "transparent",
                "&:hover": { bgcolor: disabled ? "transparent" : warning ? "#fef3c7" : "#f8fafc" },
            }}
        >
            <Checkbox
                size="small"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(field.key)}
                inputProps={{ "aria-label": field.label }}
                sx={{ p: 0.4, color: "#cbd5e1", "&.Mui-checked": { color: warning ? "#d97706" : "#2563eb" } }}
            />
            <Typography sx={{ fontSize: "0.82rem", fontWeight: checked ? 700 : 500, color: "#1e293b", lineHeight: 1.3, flex: 1, minWidth: 0 }} noWrap>
                {field.label}
            </Typography>
            {warning && <WarningIcon sx={{ fontSize: "1rem", color: "#d97706" }} />}
            {isKpi && (
                <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", minWidth: 14, textAlign: "center" }}>
                    {UNIT_BADGE[field.unit]}
                </Box>
            )}
        </Box>
    );

    return tooltip ? (
        <Tooltip title={<span style={{ whiteSpace: "pre-line" }}>{tooltip}</span>} placement="right" arrow enterDelay={400}>
            {row}
        </Tooltip>
    ) : row;
}

export default function FieldPanel({ sources, columns, onToggle, onSelectAll, onClearOptional }) {
    const [search, setSearch] = useState("");

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = (f) => !q || f.label.toLowerCase().includes(q) || (f.description || "").toLowerCase().includes(q);
        // Show fields that at least one selected source can provide.
        const offered = (f) => getFieldSources(f).some((s) => sources.includes(s));
        const pick = (group) => REPORT_FIELDS.filter((f) => f.group === group && offered(f) && matches(f));
        return {
            dimensions: pick(FIELD_GROUPS.DIMENSION),
            other: pick(FIELD_GROUPS.OTHER),
            kpisBySource: sources.map((s) => ({ source: SOURCES_BY_ID[s], fields: pick(FIELD_GROUPS.KPI).filter((f) => f.source === s) })),
            dateMatches: matches(FIELDS_BY_KEY.date),
        };
    }, [search, sources]);

    const hasResults = visible.dateMatches || visible.dimensions.length || visible.other.length || visible.kpisBySource.some((g) => g.fields.length);

    return (
        <Paper
            elevation={0}
            sx={{
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                bgcolor: "#ffffff",
                display: "flex",
                flexDirection: "column",
                maxHeight: { md: "calc(100dvh - 190px)" },
                position: { md: "sticky" },
                top: { md: 0 },
                overflow: "hidden",
            }}
        >
            <Box sx={{ p: 2, pb: 1.5, borderBottom: "1px solid #f1f5f9" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Report columns</Typography>
                    <Chip
                        label={`${columns.length} ${columns.length === 1 ? "column" : "columns"} selected`}
                        size="small"
                        sx={{ bgcolor: "#eff6ff", color: "#2563eb", fontWeight: 700, fontSize: "0.72rem", height: 22 }}
                    />
                </Box>

                <TextField
                    size="small"
                    fullWidth
                    placeholder="Search fields…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: "#94a3b8", fontSize: "1.1rem" }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mt: 1.5,
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                            fontSize: "0.82rem",
                            bgcolor: "#f8fafc",
                            "& fieldset": { borderColor: "#e2e8f0" },
                            "&:hover fieldset": { borderColor: "#cbd5e1" },
                            "&.Mui-focused fieldset": { borderColor: "#2563eb" },
                        },
                    }}
                />

                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <Button size="small" onClick={onSelectAll} disabled={!sources.length} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem", color: "#2563eb", px: 1, minWidth: 0 }}>
                        Select all
                    </Button>
                    <Button size="small" onClick={onClearOptional} disabled={columns.length <= 1} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem", color: "#64748b", px: 1, minWidth: 0 }}>
                        Clear optional fields
                    </Button>
                </Box>
            </Box>

            <Box sx={{ overflowY: "auto", px: 1, pb: 1.5, "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: "3px" } }}>
                {visible.dateMatches && (
                    <>
                        <SectionHeader title="Required" />
                        <Tooltip title="Always included. Rows follow the Time Period selected in the header." placement="right" arrow enterDelay={400}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.75, py: 0.35 }}>
                                <Checkbox size="small" checked disabled inputProps={{ "aria-label": "Date (required)" }} sx={{ p: 0.4, "&.Mui-disabled.Mui-checked": { color: "#93c5fd" } }} />
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", flex: 1 }}>Date</Typography>
                                <Chip
                                    icon={<LockIcon sx={{ fontSize: "0.8rem !important" }} />}
                                    label="Required"
                                    size="small"
                                    sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700, bgcolor: "#f1f5f9", color: "#475569", "& .MuiChip-icon": { color: "#64748b" } }}
                                />
                            </Box>
                        </Tooltip>
                    </>
                )}

                {visible.dimensions.length > 0 && (
                    <>
                        <SectionHeader title="Dimensions" />
                        {visible.dimensions.map((f) => (
                            <FieldRow key={f.key} field={f} checked={columns.includes(f.key)} sources={sources} onToggle={onToggle} />
                        ))}
                    </>
                )}

                {visible.kpisBySource.some((g) => g.fields.length) && (
                    <>
                        <SectionHeader title="KPIs & metrics" />
                        {visible.kpisBySource.filter((g) => g.fields.length).map(({ source, fields }) => (
                            <Box key={source.id} sx={{ mb: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, pt: 0.75, pb: 0.25 }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: source.accent }} />
                                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>{source.label}</Typography>
                                </Box>
                                {fields.map((f) => (
                                    <FieldRow key={f.key} field={f} checked={columns.includes(f.key)} sources={sources} onToggle={onToggle} />
                                ))}
                            </Box>
                        ))}
                    </>
                )}

                {visible.other.length > 0 && (
                    <>
                        <SectionHeader title="Other available fields" />
                        {visible.other.map((f) => (
                            <FieldRow key={f.key} field={f} checked={columns.includes(f.key)} sources={sources} onToggle={onToggle} />
                        ))}
                    </>
                )}

                {!sources.length && (
                    <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center", py: 3, px: 2 }}>
                        Select a data source to see its dimensions and KPIs.
                    </Typography>
                )}
                {sources.length > 0 && !hasResults && (
                    <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center", py: 3, fontStyle: "italic" }}>
                        No fields match “{search}”.
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}
