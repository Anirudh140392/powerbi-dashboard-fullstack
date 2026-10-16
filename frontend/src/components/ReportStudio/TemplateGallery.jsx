import React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import {
    AutoAwesomeOutlined as SpecialIcon,
    CalendarMonthOutlined as PeriodIcon,
    CalendarViewMonthOutlined as MonthIcon,
    CampaignOutlined as AdsIcon,
    CategoryOutlined as CategoryIcon,
    CheckCircle as AppliedIcon,
    DateRangeOutlined as WeekIcon,
    GridViewOutlined as GeneralIcon,
    Inventory2Outlined as SkuIcon,
    LocationCityOutlined as CityIcon,
    ManageSearchOutlined as SearchIcon,
    MapOutlined as RegionIcon,
    PinDropOutlined as PincodeIcon,
    SellOutlined as BrandIcon,
    WorkspacePremiumOutlined as TierIcon,
    DashboardCustomizeOutlined as DefaultIcon,
} from "@mui/icons-material";

const TEMPLATE_ICONS = {
    week: WeekIcon,
    period: PeriodIcon,
    region: RegionIcon,
    sku: SkuIcon,
    pincode: PincodeIcon,
    tier: TierIcon,
    month: MonthIcon,
    brand: BrandIcon,
    category: CategoryIcon,
    city: CityIcon,
    search: SearchIcon,
    ads: AdsIcon,
};

const CATEGORY_ICONS = { special: SpecialIcon, general: GeneralIcon };

function CategoryBadge({ category }) {
    const Icon = CATEGORY_ICONS[category.id];
    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.4,
                px: 0.9,
                py: 0.3,
                borderRadius: "6px",
                border: "1px solid",
                borderColor: category.border,
                bgcolor: category.tint,
                color: category.accent,
                fontSize: "0.66rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            <Icon sx={{ fontSize: "0.8rem" }} />
            {category.label}
        </Box>
    );
}

/** The templates of the account's category (Special or General), one click to apply. */
export default function TemplateGallery({ category, templates, appliedId, onApply }) {
    return (
        <Box
            component="section"
            aria-label={`${category.label} templates`}
            sx={{ border: "1px solid #e2e8f0", borderRadius: "12px", bgcolor: "#ffffff", p: 1.5 }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25, flexWrap: "wrap" }}>
                <Typography component="h2" sx={{ fontSize: "0.82rem", fontWeight: 750, color: "#1e293b", whiteSpace: "nowrap" }}>
                    {category.label} templates
                </Typography>
                <CategoryBadge category={category} />
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {templates.length} {templates.length === 1 ? "template" : "templates"}
                </Typography>
            </Box>

            <Box
                role="list"
                sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(6, minmax(0, 1fr))" } }}
            >
                {templates.map((template) => {
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
                                    bgcolor: applied ? "#dbeafe" : category.tint,
                                    color: applied ? "#1d4ed8" : category.accent,
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
