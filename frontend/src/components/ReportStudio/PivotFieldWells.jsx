import React, { useState } from "react";
import { Box, Button, Checkbox, InputAdornment, Popover, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import {
    ArrowDropDown as ArrowDropDownIcon,
    DeleteOutline as DeleteIcon,
    DragIndicator as DragIcon,
    FilterAlt as FilterIcon,
    FilterAltOutlined as FiltersAreaIcon,
    FunctionsOutlined as ValuesAreaIcon,
    Search as SearchIcon,
    TableRowsOutlined as RowsAreaIcon,
    ViewColumnOutlined as ColumnsAreaIcon,
} from "@mui/icons-material";
import { FIELD_GROUPS, FIELDS_BY_KEY, SOURCES_BY_ID } from "./reportStudioConfig";
import { AGGREGATIONS, aggregationOptions, canPlace, DATE_GRAINS, getAggregation, PIVOT_AREAS, valueLabel } from "./pivotUtils";
import { FISCAL_CALENDAR } from "./fiscalCalendar";

const AREA_ICONS = { filters: FiltersAreaIcon, columns: ColumnsAreaIcon, rows: RowsAreaIcon, values: ValuesAreaIcon };
const DIMENSION_AREAS = PIVOT_AREAS.filter((a) => a.id !== "values");
// Long value lists (a year of dates) render this many items; search narrows the rest.
const FILTER_LIST_LIMIT = 200;

const sectionTitleSx = { fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(30, 41, 59, 0.45)", textTransform: "uppercase" };
const hintSx = { fontSize: "0.72rem", color: "#94a3b8", mt: 0.5 };

const segmentedSx = {
    display: "flex",
    mt: 0.75,
    bgcolor: "#f1f5f9",
    borderRadius: "8px",
    p: "2px",
    "& .MuiToggleButton-root": {
        flex: 1,
        textTransform: "none",
        border: "none",
        borderRadius: "6px",
        py: 0.4,
        px: 1,
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#64748b",
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#ffffff", color: "#1e293b", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)" },
    },
};

const optionRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    px: 0.25,
    borderRadius: "6px",
    cursor: "pointer",
    "&:hover": { bgcolor: "#f8fafc" },
    "& .MuiCheckbox-root": { p: 0.4, color: "#cbd5e1", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "#2563eb" } },
};

const isKpi = (field) => field.group === FIELD_GROUPS.KPI;

const chipLabel = (field, config) => {
    if (isKpi(field)) return valueLabel(field, getAggregation(field, config.aggregations));
    if (field.type === "date") return `${field.label} · ${DATE_GRAINS[config.dateGrain]}`;
    return field.label;
};

/** Hidden values that still occur in the data (a filter can outlive the values it named). */
const activeExclusions = (excluded, options) => {
    if (!options) return excluded;
    const present = new Set(options.map((o) => o.value));
    return excluded.filter((v) => present.has(v));
};

function FilterList({ options, excluded, onChange }) {
    const [search, setSearch] = useState("");
    if (!options) {
        return <Typography sx={hintSx}>Values appear once the pivot has data.</Typography>;
    }

    const hidden = new Set(excluded);
    const q = search.trim().toLowerCase();
    const matched = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    const shownCount = matched.filter((o) => !hidden.has(o.value)).length;
    const allShown = matched.length > 0 && shownCount === matched.length;

    const setShown = (values, show) => {
        const next = new Set(hidden);
        values.forEach((v) => (show ? next.delete(v) : next.add(v)));
        onChange([...next]);
    };

    return (
        <Box sx={{ mt: 0.75 }}>
            {options.length > 8 && (
                <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    placeholder="Search values…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: "#94a3b8", fontSize: "1rem" }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ mb: 0.5, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "0.78rem", bgcolor: "#f8fafc", "& fieldset": { borderColor: "#e2e8f0" } } }}
                />
            )}
            {matched.length > 0 && (
                <Box component="label" sx={{ ...optionRowSx, borderBottom: "1px solid #f1f5f9", borderRadius: 0, pb: 0.25, mb: 0.25 }}>
                    <Checkbox
                        size="small"
                        checked={allShown}
                        indeterminate={shownCount > 0 && !allShown}
                        onChange={() => setShown(matched.map((o) => o.value), !allShown)}
                    />
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>{q ? "Select all matches" : "Select all"}</Typography>
                </Box>
            )}
            <Box sx={{ maxHeight: 220, overflowY: "auto", "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: "3px" } }}>
                {matched.slice(0, FILTER_LIST_LIMIT).map((o) => (
                    <Box component="label" key={o.value} sx={optionRowSx}>
                        <Checkbox size="small" checked={!hidden.has(o.value)} onChange={() => setShown([o.value], hidden.has(o.value))} />
                        <Typography noWrap title={o.label} sx={{ fontSize: "0.78rem", color: "#334155", minWidth: 0 }}>
                            {o.label}
                        </Typography>
                    </Box>
                ))}
                {matched.length > FILTER_LIST_LIMIT && (
                    <Typography sx={hintSx}>
                        Showing {FILTER_LIST_LIMIT} of {matched.length}. Search to find the rest.
                    </Typography>
                )}
                {!matched.length && <Typography sx={hintSx}>No values match “{search}”.</Typography>}
            </Box>
        </Box>
    );
}

function FieldOptions({ field, area, config, options, actions, onMove, onRemove }) {
    const kpi = isKpi(field);
    const source = kpi ? SOURCES_BY_ID[field.source] : null;
    const excluded = config.excluded[field.key] || [];
    const filtered = activeExclusions(excluded, options).length > 0;

    return (
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.75 }}>
            <Box>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: "#1e293b" }}>{field.label}</Typography>
                {source && (
                    <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>
                        {[source.label, field.description].filter(Boolean).join(" · ")}
                    </Typography>
                )}
            </Box>

            {kpi ? (
                <Box>
                    <Typography sx={sectionTitleSx}>Summarise by</Typography>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={getAggregation(field, config.aggregations)}
                        onChange={(_, agg) => agg && actions.setAggregation(field.key, agg)}
                        sx={segmentedSx}
                    >
                        {aggregationOptions(field).map((agg) => (
                            <ToggleButton key={agg} value={agg}>{AGGREGATIONS[agg]}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    {!field.additive && <Typography sx={hintSx}>{field.label} is a rate or average, so it can't be summed across rows.</Typography>}
                </Box>
            ) : (
                <Box>
                    <Typography sx={sectionTitleSx}>Show in</Typography>
                    <ToggleButtonGroup exclusive size="small" value={area} onChange={(_, next) => next && onMove(next)} sx={segmentedSx}>
                        {DIMENSION_AREAS.map((a) => (
                            <ToggleButton key={a.id} value={a.id}>{a.label}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Box>
            )}

            {field.type === "date" && (
                <Box>
                    <Typography sx={sectionTitleSx}>Group dates by</Typography>
                    <ToggleButtonGroup exclusive size="small" value={config.dateGrain} onChange={(_, grain) => grain && actions.setDateGrain(grain)} sx={segmentedSx}>
                        {Object.entries(DATE_GRAINS).map(([id, label]) => (
                            <ToggleButton key={id} value={id}>{label}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    {(config.dateGrain === "week" || config.dateGrain === "period") && (
                        <Typography sx={hintSx}>Weeks and periods follow the {FISCAL_CALENDAR.name} fiscal calendar.</Typography>
                    )}
                </Box>
            )}

            {!kpi && (
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 24 }}>
                        <Typography sx={sectionTitleSx}>Filter</Typography>
                        {filtered && (
                            <Button size="small" onClick={() => actions.setExcluded(field.key, [])} sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", minWidth: 0, py: 0, px: 0.75 }}>
                                Clear
                            </Button>
                        )}
                    </Box>
                    <FilterList options={options} excluded={excluded} onChange={(values) => actions.setExcluded(field.key, values)} />
                </Box>
            )}

            {field.group !== FIELD_GROUPS.REQUIRED && (
                <Button
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={onRemove}
                    sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700, fontSize: "0.75rem", color: "#64748b", px: 1, "&:hover": { color: "#dc2626", bgcolor: "#fef2f2" } }}
                >
                    Remove from report
                </Button>
            )}
        </Box>
    );
}

/**
 * The pivot's field areas. Fields move by drag and drop (or Alt + ←/→ within an
 * area); clicking a field opens its options — area, aggregation, date grouping
 * and value filter.
 */
export default function PivotFieldWells({ layout, config, options, actions, onRemoveField }) {
    const [drag, setDrag] = useState(null);
    const [drop, setDrop] = useState(null);
    // Kept after closing so the menu keeps its content during the exit transition.
    const [menu, setMenu] = useState(null);
    const closeMenu = () => setMenu((m) => m && { ...m, open: false });

    const dragField = drag ? FIELDS_BY_KEY[drag] : null;
    const endDrag = () => {
        setDrag(null);
        setDrop(null);
    };
    const markDrop = (area, index) => setDrop((d) => (d?.area === area && d.index === index ? d : { area, index }));
    const move = (key, area, index) => actions.moveField(layout, key, area, index);

    // The open field's current area; the menu closes if the field leaves the report.
    const menuArea = menu && PIVOT_AREAS.find((a) => layout[a.id].includes(menu.key))?.id;
    const menuField = menuArea ? FIELDS_BY_KEY[menu.key] : null;

    return (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
            {PIVOT_AREAS.map((area) => {
                const keys = layout[area.id];
                const Icon = AREA_ICONS[area.id];
                const accepts = Boolean(dragField && canPlace(dragField, area.id));
                const isTarget = drop?.area === area.id;
                return (
                    <Box
                        key={area.id}
                        role="group"
                        aria-label={`${area.label} area`}
                        onDragOver={(e) => {
                            if (!accepts) return;
                            e.preventDefault();
                            markDrop(area.id, keys.length);
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget)) setDrop((d) => (d?.area === area.id ? null : d));
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (accepts) move(drag, area.id, isTarget ? drop.index : keys.length);
                            endDrag();
                        }}
                        sx={{
                            minWidth: 0,
                            p: 1,
                            borderRadius: "10px",
                            border: "1px dashed",
                            borderColor: isTarget ? "#2563eb" : accepts ? "#93c5fd" : "#e2e8f0",
                            bgcolor: accepts ? "#f8fbff" : "#fcfdfe",
                            opacity: dragField && !accepts ? 0.5 : 1,
                            transition: "border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
                            <Icon sx={{ fontSize: "0.95rem", color: "#94a3b8" }} />
                            <Typography sx={sectionTitleSx}>{area.label}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, minHeight: 28 }}>
                            {keys.map((key, index) => {
                                const field = FIELDS_BY_KEY[key];
                                const label = chipLabel(field, config);
                                const hidden = activeExclusions(config.excluded[key] || [], options?.[key]);
                                const total = options?.[key]?.length;
                                const filterTitle = hidden.length && total ? `Filtered: showing ${total - hidden.length} of ${total}` : undefined;
                                const removable = field.group !== FIELD_GROUPS.REQUIRED;
                                const openMenu = (e) => setMenu({ key, anchor: e.currentTarget, open: true });
                                return (
                                    <Box
                                        key={key}
                                        role="button"
                                        tabIndex={0}
                                        draggable
                                        aria-haspopup="dialog"
                                        aria-label={`${label}${filterTitle ? `, ${filterTitle}` : ""}. Enter for options, Alt plus arrow keys to reorder${removable ? ", Delete to remove" : ""}`}
                                        title={filterTitle}
                                        onClick={openMenu}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") openMenu(e);
                                            else if (e.altKey && e.key === "ArrowLeft" && index > 0) move(key, area.id, index - 1);
                                            else if (e.altKey && e.key === "ArrowRight" && index < keys.length - 1) move(key, area.id, index + 2);
                                            else if ((e.key === "Delete" || e.key === "Backspace") && removable) onRemoveField(key);
                                            else return;
                                            e.preventDefault();
                                        }}
                                        onDragStart={(e) => {
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("text/plain", key);
                                            setDrag(key);
                                        }}
                                        onDragEnd={endDrag}
                                        onDragOver={(e) => {
                                            if (!accepts) return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            markDrop(area.id, e.clientX > rect.left + rect.width / 2 ? index + 1 : index);
                                        }}
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 0.4,
                                            height: 28,
                                            maxWidth: "100%",
                                            pl: 0.25,
                                            pr: 0.1,
                                            borderRadius: "8px",
                                            border: "1px solid",
                                            borderColor: hidden.length ? "#bfdbfe" : "#e2e8f0",
                                            bgcolor: hidden.length ? "#eff6ff" : "#ffffff",
                                            boxShadow: isTarget && drop.index === index ? "inset 3px 0 0 #2563eb" : "0 1px 2px rgba(15, 23, 42, 0.04)",
                                            opacity: drag === key ? 0.4 : 1,
                                            cursor: "grab",
                                            userSelect: "none",
                                            outline: "none",
                                            "&:hover": { borderColor: "#94a3b8" },
                                            "&:focus-visible": { borderColor: "#2563eb", boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.2)" },
                                        }}
                                    >
                                        <DragIcon sx={{ fontSize: "1rem", color: "#cbd5e1", flexShrink: 0 }} />
                                        {isKpi(field) && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: SOURCES_BY_ID[field.source].accent, flexShrink: 0 }} />}
                                        <Typography component="span" noWrap sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155", minWidth: 0 }}>
                                            {label}
                                        </Typography>
                                        {hidden.length > 0 && <FilterIcon sx={{ fontSize: "0.85rem", color: "#2563eb", flexShrink: 0 }} />}
                                        <ArrowDropDownIcon sx={{ fontSize: "1.1rem", color: "#94a3b8", flexShrink: 0 }} />
                                    </Box>
                                );
                            })}
                            {isTarget && drop.index === keys.length && <Box sx={{ width: 3, height: 22, borderRadius: 2, bgcolor: "#2563eb" }} />}
                            {!keys.length && !isTarget && (
                                <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                                    {area.id === "values" ? "Drag KPIs here" : "Drag dimensions here"}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                );
            })}

            <Popover
                open={Boolean(menu?.open && menuField)}
                anchorEl={menu?.anchor}
                onClose={closeMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{ paper: { sx: { width: 300, mt: 0.5, borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)" } } }}
            >
                {menuField && (
                    <FieldOptions
                        key={menuField.key}
                        field={menuField}
                        area={menuArea}
                        config={config}
                        options={options?.[menuField.key]}
                        actions={actions}
                        // The chip remounts in its new area, so the menu would lose its anchor.
                        onMove={(area) => {
                            closeMenu();
                            move(menuField.key, area);
                        }}
                        onRemove={() => {
                            closeMenu();
                            onRemoveField(menuField.key);
                        }}
                    />
                )}
            </Popover>
        </Box>
    );
}
