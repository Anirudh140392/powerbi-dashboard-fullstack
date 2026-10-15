import React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import {
    CalendarMonthOutlined as PeriodIcon,
    CheckCircle as AppliedIcon,
    DateRangeOutlined as WeekIcon,
    Inventory2Outlined as SkuIcon,
    MapOutlined as RegionIcon,
    PinDropOutlined as PincodeIcon,
    WorkspacePremiumOutlined as TierIcon,
    DashboardCustomizeOutlined as DefaultIcon,
} from "@mui/icons-material";
import { REPORT_TEMPLATES } from "./reportStudioConfig";

const TEMPLATE_ICONS = { week: WeekIcon, period: PeriodIcon, region: RegionIcon, sku: SkuIcon, pincode: PincodeIcon, tier: TierIcon };

export default function TemplateGallery({ appliedId, onApply }) {
    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(30, 41, 59, 0.45)", textTransform: "uppercase" }}>
                    Start from a template
                </Typography>
                <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8" }}>Sets the sources, columns and pivot — adjust anything afterwards.</Typography>
            </Box>
            <Box
                role="list"
                sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(6, minmax(0, 1fr))" } }}
            >
                {REPORT_TEMPLATES.map((template) => {
                    const Icon = TEMPLATE_ICONS[template.icon] || DefaultIcon;
                    const applied = template.id === appliedId;
                    return (
                        <ButtonBase
                            key={template.id}
                            role="listitem"
                            aria-pressed={applied}
                            onClick={() => onApply(template)}
                            sx={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "flex-start",
                                gap: 1.1,
                                p: 1.25,
                                textAlign: "left",
                                borderRadius: "12px",
                                border: "1px solid",
                                borderColor: applied ? "#2563eb" : "#e2e8f0",
                                bgcolor: applied ? "#eff6ff" : "#ffffff",
                                boxShadow: applied ? "0 0 0 1px #2563eb" : "0 1px 2px rgba(15, 23, 42, 0.04)",
                                transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
                                "&:hover": { borderColor: applied ? "#2563eb" : "#94a3b8", boxShadow: applied ? "0 0 0 1px #2563eb" : "0 4px 12px rgba(15, 23, 42, 0.06)" },
                                "&.Mui-focusVisible": { outline: "2px solid #2563eb", outlineOffset: 2 },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "grid",
                                    placeItems: "center",
                                    width: 30,
                                    height: 30,
                                    flexShrink: 0,
                                    borderRadius: "8px",
                                    bgcolor: applied ? "#dbeafe" : "#f1f5f9",
                                    color: applied ? "#1d4ed8" : "#475569",
                                }}
                            >
                                <Icon sx={{ fontSize: "1.1rem" }} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 750, color: "#1e293b" }}>
                                        {template.label}
                                    </Typography>
                                    {applied && <AppliedIcon sx={{ fontSize: "0.95rem", color: "#2563eb" }} />}
                                </Box>
                                <Typography sx={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.35, mt: 0.25 }}>{template.description}</Typography>
                            </Box>
                        </ButtonBase>
                    );
                })}
            </Box>
        </Box>
    );
}
