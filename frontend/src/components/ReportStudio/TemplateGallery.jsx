import React, { useState } from "react";
import { Alert, Box, Button, ButtonBase, Chip, CircularProgress, IconButton, ListItemIcon, Menu, MenuItem, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import {
    AutoAwesomeOutlined as SpecialIcon,
    BookmarkBorderOutlined as SavedIcon,
    DeleteOutline as DeleteIcon,
    EditOutlined as EditIcon,
    GroupsOutlined as SharedIcon,
    MoreVert as MoreIcon,
    SyncOutlined as UpdateIcon,
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


const SAVED_ACCENT = { accent: "#0f766e", tint: "#f0fdfa" };

const tabsSx = {
    bgcolor: "#f1f5f9",
    borderRadius: "8px",
    p: "2px",
    "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        borderRadius: "6px",
        py: 0.3,
        px: 1.25,
        fontSize: "0.76rem",
        fontWeight: 700,
        color: "#64748b",
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#ffffff", color: "#1e293b", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)" },
    },
};

const gridSx = { display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(6, minmax(0, 1fr))" } };

function TemplateCard({ template, applied, icon, palette, onApply, footer, menu }) {
    const Icon = icon;
    return (
        <Box role="listitem" sx={{ position: "relative", display: "flex" }}>
            <ButtonBase
                aria-pressed={applied}
                onClick={() => onApply(template)}
                sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    gap: 1.1,
                    p: 1.25,
                    pr: menu ? 4 : 1.25,
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
                        bgcolor: applied ? "#dbeafe" : palette.tint,
                        color: applied ? "#1d4ed8" : palette.accent,
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
                    {template.description && (
                        <Typography sx={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.35, mt: 0.25 }}>{template.description}</Typography>
                    )}
                    {footer}
                </Box>
            </ButtonBase>
            {menu}
        </Box>
    );
}

/** Owner actions on a saved template: edit details, overwrite with the current setup, delete. */
function SavedTemplateMenu({ template, onEdit, onUpdate, onDelete }) {
    const [anchor, setAnchor] = useState(null);
    const run = (action) => {
        setAnchor(null);
        action(template.saved);
    };
    return (
        <>
            <IconButton
                size="small"
                aria-label={`Options for ${template.label}`}
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{ position: "absolute", top: 6, right: 4, color: "#94a3b8", "&:hover": { color: "#1e293b" } }}
            >
                <MoreIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} PaperProps={{ sx: { borderRadius: "10px", minWidth: 220 } }}>
                <MenuItem onClick={() => run(onEdit)} sx={{ fontSize: "0.82rem" }}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    Rename or share
                </MenuItem>
                <MenuItem onClick={() => run(onUpdate)} sx={{ fontSize: "0.82rem" }}>
                    <ListItemIcon><UpdateIcon fontSize="small" /></ListItemIcon>
                    Update to current setup
                </MenuItem>
                <MenuItem onClick={() => run(onDelete)} sx={{ fontSize: "0.82rem", color: "#dc2626" }}>
                    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: "#dc2626" }} /></ListItemIcon>
                    Delete
                </MenuItem>
            </Menu>
        </>
    );
}

function SavedFooter({ template, showOwner }) {
    const { saved } = template;
    const shared = saved.visibility === "workspace";
    if (!shared && !showOwner) return null;
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
            {shared && !showOwner && (
                <Chip icon={<SharedIcon />} label="Shared" size="small"
                    sx={{ height: 18, fontSize: "0.64rem", fontWeight: 700, bgcolor: "#f0fdfa", color: "#0f766e", "& .MuiChip-icon": { fontSize: "0.8rem", color: "#0f766e" } }} />
            )}
            {showOwner && <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>By {saved.createdByName || saved.createdBy}</Typography>}
        </Box>
    );
}

const EMPTY_TEXT = {
    mine: "Set up a report, then click Save as template to reuse it here.",
    shared: "Templates your colleagues share with this workspace appear here.",
};

/**
 * Built-in templates for the account's category (Special or General), plus the
 * templates users saved: their own, and the ones shared in the workspace.
 * `tab` is "builtin" | "mine" | "shared".
 */
export default function TemplateGallery({
    category, templates, savedTemplates, savedState, appliedId, onApply, tab, onTabChange, user, headerAction, onEdit, onUpdate, onDelete,
}) {
    const email = String(user?.email || "").toLowerCase();
    const isAdmin = /admin|super/.test(String(user?.role || "").toLowerCase());
    const mine = savedTemplates.filter((t) => t.saved.createdBy === email);
    const shared = savedTemplates.filter((t) => t.saved.createdBy !== email);
    const list = { builtin: templates, mine, shared }[tab];

    return (
        <Box
            component="section"
            aria-label="Report templates"
            sx={{ border: "1px solid #e2e8f0", borderRadius: "12px", bgcolor: "#ffffff", p: 1.5 }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25, flexWrap: "wrap" }}>
                <Typography component="h2" sx={{ fontSize: "0.82rem", fontWeight: 750, color: "#1e293b", whiteSpace: "nowrap" }}>
                    Templates
                </Typography>
                <ToggleButtonGroup exclusive size="small" value={tab} onChange={(_, next) => next && onTabChange(next)} aria-label="Template list" sx={tabsSx}>
                    <ToggleButton value="builtin">{category.label}</ToggleButton>
                    <ToggleButton value="mine">My templates{mine.length ? ` · ${mine.length}` : ""}</ToggleButton>
                    <ToggleButton value="shared">Shared{shared.length ? ` · ${shared.length}` : ""}</ToggleButton>
                </ToggleButtonGroup>
                {tab === "builtin" && <CategoryBadge category={category} />}
                <Box sx={{ flex: 1 }} />
                {headerAction}
            </Box>

            {tab !== "builtin" && savedState.status === "loading" && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={22} /></Box>
            )}
            {tab !== "builtin" && savedState.status === "error" && (
                <Alert severity="error" sx={{ borderRadius: "10px" }} action={<Button size="small" onClick={savedState.onRetry}>Retry</Button>}>
                    Saved templates couldn't be loaded.
                </Alert>
            )}
            {tab !== "builtin" && savedState.status === "ready" && !list.length && (
                <Typography sx={{ fontSize: "0.78rem", color: "#64748b", py: 1.5, textAlign: "center" }}>{EMPTY_TEXT[tab]}</Typography>
            )}

            {(tab === "builtin" || savedState.status === "ready") && list.length > 0 && (
                <Box role="list" sx={gridSx}>
                    {list.map((template) => {
                        const isSaved = Boolean(template.saved);
                        const canManage = isSaved && (template.saved.createdBy === email || isAdmin);
                        return (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                applied={template.id === appliedId}
                                icon={isSaved ? (template.saved.visibility === "workspace" ? SharedIcon : SavedIcon) : TEMPLATE_ICONS[template.icon] || DefaultIcon}
                                palette={isSaved ? SAVED_ACCENT : category}
                                onApply={onApply}
                                footer={isSaved && <SavedFooter template={template} showOwner={tab === "shared"} />}
                                menu={canManage && <SavedTemplateMenu template={template} onEdit={onEdit} onUpdate={onUpdate} onDelete={onDelete} />}
                            />
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
