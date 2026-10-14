import React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { CheckBox as CheckBoxIcon, CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon } from "@mui/icons-material";
import { FIELD_GROUPS, REPORT_FIELDS, REPORT_SOURCES } from "./reportStudioConfig";

const KPI_COUNTS = Object.fromEntries(
    REPORT_SOURCES.map((s) => [s.id, REPORT_FIELDS.filter((f) => f.group === FIELD_GROUPS.KPI && f.source === s.id).length])
);

export default function SourceSelector({ sources, onToggle }) {
    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1.25, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Data sources</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Pick one or more. Combined sources are joined on Date and the dimensions they share.
                </Typography>
            </Box>

            <Box
                role="group"
                aria-label="Data sources"
                sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}
            >
                {REPORT_SOURCES.map((source) => {
                    const selected = sources.includes(source.id);
                    const Icon = selected ? CheckBoxIcon : CheckBoxOutlineBlankIcon;
                    return (
                        <ButtonBase
                            key={source.id}
                            role="checkbox"
                            aria-checked={selected}
                            onClick={() => onToggle(source.id)}
                            sx={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 1.25,
                                p: 1.5,
                                textAlign: "left",
                                borderRadius: "12px",
                                border: "1px solid",
                                borderColor: selected ? source.accent : "#e2e8f0",
                                bgcolor: selected ? source.tint : "#ffffff",
                                boxShadow: selected ? `0 0 0 1px ${source.accent}` : "0 1px 2px rgba(15, 23, 42, 0.04)",
                                transition: "all 0.15s ease",
                                "&:hover": { borderColor: selected ? source.accent : "#94a3b8" },
                                "&.Mui-focusVisible": { outline: `2px solid ${source.accent}`, outlineOffset: 2 },
                            }}
                        >
                            <Icon sx={{ fontSize: "1.2rem", mt: "1px", color: selected ? source.accent : "#cbd5e1" }} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
                                    {source.label}
                                </Typography>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", mt: 0.25, lineHeight: 1.35 }}>
                                    {source.description}
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                                    <Box
                                        component="span"
                                        sx={{
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            color: "#475569",
                                            bgcolor: selected ? "#ffffff" : "#f1f5f9",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "6px",
                                            px: 0.75,
                                            py: 0.1,
                                        }}
                                    >
                                        {source.table}
                                    </Box>
                                    <Typography component="span" sx={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 }}>
                                        {KPI_COUNTS[source.id]} KPIs
                                    </Typography>
                                </Box>
                            </Box>
                        </ButtonBase>
                    );
                })}
            </Box>
        </Box>
    );
}
