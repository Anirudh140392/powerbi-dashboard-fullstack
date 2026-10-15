import React, { useMemo, useState } from "react";
import { Box, Button, FormControlLabel, IconButton, LinearProgress, Switch, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import {
    ArrowDownward as SortDescIcon,
    ArrowUpward as SortAscIcon,
    ChevronRight as CollapsedIcon,
    ErrorOutline as ErrorIcon,
    ExpandMore as ExpandedIcon,
    FilterAltOff as FilterOffIcon,
    FunctionsOutlined as ValuesIcon,
    StorageOutlined as TooLargeIcon,
} from "@mui/icons-material";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import StatePanel from "./StatePanel";
import { DIMENSION_VALUE_COLORS } from "./reportStudioConfig";
import { changeDirection, formatChange, formatPivotValue, GRAND_TOTAL, heatmapStyle, PIVOT_SOURCE_ROW_LIMIT, VALUES_AXES } from "./pivotUtils";

const HEAD_ROW_HEIGHT = 32;
const INDENT = 18;
const TOGGLE_SIZE = 24;
const PAGE_SIZES = [25, 50, 100];
const NO_KEYS = new Set();
const DIRECTION_ARROWS = { up: "▲", down: "▼", flat: "•" };

const formatCount = (n) => n.toLocaleString("en-IN");

/** Rows in display order, skipping the descendants of collapsed groups. */
const visibleRows = (node, collapsed, out = []) => {
    node.children.forEach((child) => {
        out.push(child);
        if (child.children.length && !collapsed.has(child.key)) visibleRows(child, collapsed, out);
    });
    return out;
};

const groupKeys = (node, out = []) => {
    node.children.forEach((child) => {
        if (!child.children.length) return;
        out.push(child.key);
        groupKeys(child, out);
    });
    return out;
};

const ancestorLabels = (node) => {
    const labels = [];
    for (let p = node.parent; p && p.level >= 0; p = p.parent) labels.unshift(p.label);
    return labels;
};

/** Value headers cycle: descending → ascending → back to label order. */
const nextValueSort = (sort, column, value) => {
    const current = sort.by === "value" && sort.column === column && sort.value === value ? sort.dir : null;
    if (current === "asc") return null;
    return { by: "value", column, value, dir: current === "desc" ? "asc" : "desc" };
};

const SortIcon = ({ dir }) => (dir === "asc" ? <SortAscIcon /> : <SortDescIcon />);

const switchLabelSx = { mr: 0.5, ml: 0, "& .MuiFormControlLabel-label": { fontSize: "0.78rem", fontWeight: 600, color: "#475569" } };
const linkButtonSx = { textTransform: "none", fontWeight: 700, fontSize: "0.75rem", px: 1, minWidth: 0 };
const toolbarLabelSx = { fontSize: "0.72rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" };

const segmentedSx = {
    bgcolor: "#f1f5f9",
    borderRadius: "8px",
    p: "2px",
    "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        borderRadius: "6px",
        py: 0.25,
        px: 1.1,
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#64748b",
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#ffffff", color: "#1e293b", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)" },
    },
};

const tableSx = {
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: "100%",
    "& th, & td": { whiteSpace: "nowrap", borderRight: "1px solid #eef2f6", borderBottom: "1px solid #eef2f6", px: 1.5 },
    "& thead th": {
        position: "sticky",
        zIndex: 2,
        height: HEAD_ROW_HEIGHT,
        boxSizing: "border-box",
        py: 0,
        bgcolor: "#f8fafc",
        fontSize: "0.76rem",
        fontWeight: 800,
        color: "#1e293b",
        textAlign: "center",
    },
    "& thead tr:last-of-type th": { borderBottom: "2px solid #e2e8f0" },
    "& thead th.pv-total": { bgcolor: "#f1f5f9" },
    // Group labels start at their group, so a wide group's label isn't centred off-screen.
    "& thead th.pv-group-head": { textAlign: "left" },
    "& thead th.pv-value": { textAlign: "right", minWidth: 110, fontSize: "0.72rem", fontWeight: 700, color: "#475569" },
    "& thead th.pv-corner": { left: 0, zIndex: 4, textAlign: "left", boxShadow: "inset -1px 0 0 #e2e8f0" },
    "& thead th.pv-dim-name, & .pv-dim-tag": { fontSize: "0.66rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(30, 41, 59, 0.45)" },
    "& thead th.pv-dim-name": { textAlign: "right" },
    "& thead th.pv-sortable": { cursor: "pointer", userSelect: "none", "&:hover": { bgcolor: "#eef2ff" } },
    "& .pv-corner-inner": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" },
    "& .pv-head": { display: "inline-flex", alignItems: "center", gap: "4px", "& svg": { fontSize: "0.9rem", color: "#2563eb" } },
    "& tbody td, & tfoot td": { bgcolor: "#ffffff", fontSize: "0.8rem", color: "#334155", py: 0.75 },
    "& td.pv-num": { textAlign: "right", fontVariantNumeric: "tabular-nums" },
    "& td.pv-col-total": { bgcolor: "#fafbfc", fontWeight: 600 },
    "& td.pv-label": { position: "sticky", left: 0, zIndex: 1, py: 0.5, boxShadow: "inset -1px 0 0 #e2e8f0" },
    "& .pv-label-inner": { display: "flex", alignItems: "center", gap: "4px", minWidth: { xs: 140, sm: 200 }, maxWidth: { xs: 200, sm: 360 } },
    "& .pv-label-text": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
    "& .pv-toggle-space": { width: TOGGLE_SIZE, flexShrink: 0 },
    "& .pv-crumb": { color: "#94a3b8", fontWeight: 500 },
    "& .pv-dot": { display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: "6px", verticalAlign: "1px", boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.12)" },
    "& .pv-metric": { fontWeight: 600, color: "#475569" },
    "& .pv-delta": { display: "inline-block", minWidth: 64, marginLeft: "8px", fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textAlign: "right" },
    "& .pv-delta.is-good": { color: "#15803d" },
    "& .pv-delta.is-bad": { color: "#b91c1c" },
    "& tbody tr.pv-group td": { bgcolor: "#f8fafc", fontWeight: 700, color: "#1e293b" },
    "& tbody tr.pv-section td": { bgcolor: "#f8fafc", fontWeight: 700, color: "#1e293b", borderTop: "1px solid #e2e8f0" },
    "& tbody tr.pv-grand td": { bgcolor: "#eef2ff", fontWeight: 800, borderTop: "2px solid #c7d2fe" },
    "& tbody tr:hover td": { bgcolor: "#f0f4ff" },
    "& tfoot td": { position: "sticky", bottom: 0, zIndex: 2, bgcolor: "#eef2ff", fontWeight: 800, color: "#1e293b", borderTop: "2px solid #c7d2fe" },
    "& tfoot td.pv-label": { zIndex: 3 },
};

function HeatmapLegend() {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }} aria-label="Heatmap colours run from worse (red) to better (green)">
            <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>Worse</Typography>
            <Box sx={{ width: 56, height: 8, borderRadius: 4, background: "linear-gradient(90deg, hsl(0, 75%, 86%), hsl(45, 85%, 80%), hsl(130, 60%, 80%))" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>Better</Typography>
        </Box>
    );
}

export default function PivotTable({ pivot, config, actions, isUpdating }) {
    const [collapseState, setCollapseState] = useState({ hierarchy: null, keys: NO_KEYS });
    const [pageState, setPageState] = useState({ pivot: null, page: 1 });
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

    // Collapsed groups belong to the row hierarchy they were made in.
    const hierarchy = pivot.layout ? `${pivot.layout.rows.map((f) => f.key).join("|")}|${pivot.grain}` : null;
    const collapsed = collapseState.hierarchy === hierarchy ? collapseState.keys : NO_KEYS;
    const setCollapsed = (keys) => setCollapseState({ hierarchy, keys });

    const rows = useMemo(() => (pivot.rowTree ? visibleRows(pivot.rowTree, collapsed) : []), [pivot.rowTree, collapsed]);
    const groups = useMemo(() => (pivot.rowTree ? groupKeys(pivot.rowTree) : []), [pivot.rowTree]);

    // Paging restarts whenever the pivot changes; collapsing keeps the page if it still exists.
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(pageState.pivot === pivot ? pageState.page : 1, totalPages);
    const setPage = (next) => setPageState({ pivot, page: next });

    if (pivot.status === "error") {
        return <StatePanel icon={ErrorIcon} tone="#ef4444" title="We couldn't build the pivot" />;
    }
    if (pivot.status === "too-large") {
        return (
            <StatePanel
                icon={TooLargeIcon}
                tone="#f59e0b"
                title="Too many rows to summarise"
                message={`This report has ${formatCount(pivot.sourceRows)} rows; the pivot can summarise up to ${formatCount(PIVOT_SOURCE_ROW_LIMIT)}. Shorten the time period or remove columns.`}
            />
        );
    }
    if (pivot.status === "no-values") {
        return <StatePanel icon={ValuesIcon} title="Add a KPI to Values" message="Tick a KPI under Report columns to summarise it here." />;
    }
    if (pivot.status === "filtered-out") {
        return (
            <StatePanel
                icon={FilterOffIcon}
                title="No rows match the filters"
                action={<Button variant="outlined" onClick={actions.clearFilters} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}>Clear filters</Button>}
            />
        );
    }

    const { layout, columns, headerRows, valueAt, changeAt, valueRanges, sort } = pivot;
    const { values } = layout;
    const onRows = pivot.valuesAxis === "rows";
    const hasGroups = groups.length > 0;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    const valueRowTop = headerRows.length * HEAD_ROW_HEIGHT;
    const labelsSortable = layout.rows.length > 0;
    const rowHeading = [...layout.rows.map((f) => f.label), ...(onRows ? ["KPI"] : [])].join(" › ");

    const toggleGroup = (key) => {
        const next = new Set(collapsed);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setCollapsed(next);
    };

    const corner = (top, dimName) => (
        <th
            className={`pv-corner${labelsSortable ? " pv-sortable" : ""}`}
            style={{ top }}
            aria-sort={sort.by === "label" && labelsSortable ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
            onClick={labelsSortable ? () => actions.setSort({ by: "label", dir: sort.by === "label" && sort.dir === "asc" ? "desc" : "asc" }) : undefined}
        >
            <span className="pv-corner-inner">
                <span className="pv-head">
                    {rowHeading}
                    {sort.by === "label" && labelsSortable && <SortIcon dir={sort.dir} />}
                </span>
                {dimName && <span className="pv-dim-tag">{dimName}</span>}
            </span>
        </th>
    );

    const toggleOrSpace = (node) => {
        if (node && node.children.length) {
            const isCollapsed = collapsed.has(node.key);
            return (
                <IconButton
                    size="small"
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleGroup(node.key)}
                    sx={{ p: 0, width: TOGGLE_SIZE, height: TOGGLE_SIZE, color: "#64748b" }}
                >
                    {isCollapsed ? <CollapsedIcon fontSize="small" /> : <ExpandedIcon fontSize="small" />}
                </IconButton>
            );
        }
        return hasGroups && <span className="pv-toggle-space" />;
    };

    const rowLabelCell = (node, indexOnPage) => {
        const ancestors = ancestorLabels(node);
        const color = DIMENSION_VALUE_COLORS[layout.rows[node.level]?.key]?.[node.value];
        return (
            <td className="pv-label">
                <div className="pv-label-inner" style={{ paddingLeft: node.level * INDENT }}>
                    {toggleOrSpace(node)}
                    <span className="pv-label-text" title={[...ancestors, node.label].join(" › ")}>
                        {/* A page that starts mid-group names the group it continues. */}
                        {indexOnPage === 0 && ancestors.length > 0 && <span className="pv-crumb">{ancestors.join(" › ")} › </span>}
                        {color && <span className="pv-dot" style={{ backgroundColor: color }} />}
                        {node.label}
                    </span>
                </div>
            </td>
        );
    };

    const plainLabelCell = (label, level = 0, className = "pv-label-text", title = undefined) => (
        <td className="pv-label">
            <div className="pv-label-inner" style={{ paddingLeft: level * INDENT }}>
                {toggleOrSpace(null)}
                <span className={className} title={title}>{label}</span>
            </div>
        </td>
    );

    /** One value cell; `leafRow` lets the heatmap compare it with the other leaf cells. */
    const valueCell = (rowPath, leafRow, col, vi, show = true) => {
        const key = `${vi}:${col.key}`;
        const className = col.type === "data" ? "pv-num" : "pv-num pv-col-total";
        if (!show) return <td key={key} className={className} />;
        const v = values[vi];
        const value = valueAt(rowPath, col.path, vi);
        const style = pivot.heatmap ? heatmapStyle(v, value, leafRow && col.type === "data" ? valueRanges[vi] : null) : undefined;
        const change = pivot.compare && col.prevPath ? changeAt(rowPath, col, vi) : null;
        const direction = change && changeDirection(v, change);
        return (
            <td key={key} className={className} style={style}>
                {formatPivotValue(v, value)}
                {/* Comparable columns keep the slot even when empty, so values stay aligned. */}
                {pivot.compare && col.prevPath && (
                    <span className={`pv-delta${direction?.good === true ? " is-good" : direction?.good === false ? " is-bad" : ""}`} title="Change on the previous column">
                        {change ? `${DIRECTION_ARROWS[direction.dir]} ${formatChange(change)}` : ""}
                    </span>
                )}
            </td>
        );
    };

    const columnsBody = pageRows.map((node, i) => {
        const isGroup = node.children.length > 0;
        return (
            <tr key={node.key} className={isGroup ? "pv-group" : undefined}>
                {rowLabelCell(node, i)}
                {columns.flatMap((col) => values.map((_, vi) => valueCell(node.path, !isGroup, col, vi, !isGroup || pivot.subtotals)))}
            </tr>
        );
    });

    // KPIs on rows: each row label heads a section with one line per KPI.
    const kpiLines = (keyPrefix, rowPath, leafRow, level, className) =>
        values.map((v, vi) => (
            <tr key={`${keyPrefix}:${vi}`} className={className}>
                {plainLabelCell(v.field.label, level, "pv-label-text pv-metric", v.label)}
                {columns.map((col) => valueCell(rowPath, leafRow, col, vi))}
            </tr>
        ));

    const rowsBody = pageRows.flatMap((node, i) => {
        const isGroup = node.children.length > 0;
        const section = (
            <tr key={`row:${node.key}`} className="pv-section">
                {rowLabelCell(node, i)}
                <td colSpan={columns.length} />
            </tr>
        );
        return isGroup && !pivot.subtotals ? [section] : [section, ...kpiLines(`row:${node.key}`, node.path, !isGroup, node.level + 1)];
    });
    if (onRows && pivot.showGrandRow && page === totalPages) {
        rowsBody.push(
            <tr key="grand" className="pv-section pv-grand">
                {plainLabelCell(GRAND_TOTAL)}
                <td colSpan={columns.length} />
            </tr>,
            ...kpiLines("grand", [], !layout.rows.length, 1)
        );
    }

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", columnGap: 2, rowGap: 1, flexWrap: "wrap" }}>
                <Box sx={{ display: "flex", alignItems: "center", columnGap: 1.5, rowGap: 0.75, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Typography sx={toolbarLabelSx}>KPIs as</Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={pivot.valuesAxis}
                            onChange={(_, next) => next && actions.setOption("valuesAxis", next)}
                            aria-label="Show KPIs as"
                            sx={segmentedSx}
                        >
                            {Object.entries(VALUES_AXES).map(([id, label]) => (
                                <ToggleButton key={id} value={id}>{label}</ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>
                    <Box sx={{ width: "1px", height: 20, bgcolor: "#e2e8f0", display: { xs: "none", sm: "block" } }} />
                    <Box sx={{ display: "flex", alignItems: "center", columnGap: 0.5, flexWrap: "wrap" }}>
                        <FormControlLabel
                            control={<Switch size="small" checked={pivot.heatmap} onChange={() => actions.toggleOption("heatmap")} />}
                            label="Heatmap"
                            title="Colour each value from worse to better"
                            sx={switchLabelSx}
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={pivot.compare && pivot.canCompare} onChange={() => actions.toggleOption("compare")} />}
                            label="Change vs previous"
                            disabled={!pivot.canCompare}
                            title={pivot.canCompare ? "Show each value's change on the column before it" : "Put Date (or another dimension) in Columns to compare"}
                            sx={switchLabelSx}
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={config.subtotals} onChange={() => actions.toggleOption("subtotals")} />}
                            label="Subtotals"
                            disabled={layout.rows.length < 2 && layout.columns.length < 2}
                            sx={switchLabelSx}
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={config.grandTotals} onChange={() => actions.toggleOption("grandTotals")} />}
                            label="Grand totals"
                            disabled={!layout.rows.length && !layout.columns.length}
                            sx={switchLabelSx}
                        />
                    </Box>
                    {hasGroups && (
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Button size="small" onClick={() => setCollapsed(NO_KEYS)} disabled={!collapsed.size} sx={linkButtonSx}>
                                Expand all
                            </Button>
                            <Button size="small" onClick={() => setCollapsed(new Set(groups))} disabled={collapsed.size >= groups.length} sx={linkButtonSx}>
                                Collapse all
                            </Button>
                        </Box>
                    )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", columnGap: 1.5, rowGap: 0.5, flexWrap: "wrap" }}>
                    {pivot.heatmap && <HeatmapLegend />}
                    <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {pivot.matchedRows < pivot.sourceRows
                            ? `${formatCount(pivot.matchedRows)} of ${formatCount(pivot.sourceRows)} rows match the filters`
                            : `Summarising ${formatCount(pivot.sourceRows)} rows`}
                    </Typography>
                    {pivot.activeFilters > 0 && (
                        <Button size="small" onClick={actions.clearFilters} sx={linkButtonSx}>
                            Clear filters
                        </Button>
                    )}
                </Box>
            </Box>

            <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                <Box sx={{ position: "relative" }}>
                    {isUpdating && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 5 }} />}
                    <Box
                        sx={{
                            overflow: "auto",
                            maxHeight: 560,
                            opacity: isUpdating ? 0.6 : 1,
                            transition: "opacity 0.15s ease",
                            "&::-webkit-scrollbar": { width: 8, height: 8 },
                            "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 4 },
                        }}
                    >
                        <Box component="table" sx={tableSx}>
                            <thead>
                                {headerRows.map((cells, level) => {
                                    const top = level * HEAD_ROW_HEIGHT;
                                    // With KPIs on rows there is no value row, so the last column level carries the row heading.
                                    const leafLevel = onRows && level === headerRows.length - 1;
                                    return (
                                        <tr key={level}>
                                            {leafLevel ? (
                                                corner(top, layout.columns[level].label)
                                            ) : (
                                                <th className="pv-corner pv-dim-name" style={{ top }}>
                                                    {layout.columns[level].label}
                                                </th>
                                            )}
                                            {cells.map((cell) => (
                                                <th
                                                    key={cell.key}
                                                    colSpan={onRows ? cell.span : cell.span * values.length}
                                                    rowSpan={cell.rowSpan}
                                                    className={leafLevel || (onRows && cell.total) ? `pv-value${cell.total ? " pv-total" : ""}` : cell.total ? "pv-total" : "pv-group-head"}
                                                    style={{ top }}
                                                >
                                                    {cell.label}
                                                </th>
                                            ))}
                                        </tr>
                                    );
                                })}
                                {onRows ? (
                                    !headerRows.length && (
                                        <tr>
                                            {corner(0)}
                                            <th className="pv-value pv-total" style={{ top: 0 }}>Value</th>
                                        </tr>
                                    )
                                ) : (
                                    <tr>
                                        {corner(valueRowTop)}
                                        {columns.flatMap((col) =>
                                            values.map((v, vi) => {
                                                const active = sort.by === "value" && sort.column === col.key && sort.value === v.field.key;
                                                return (
                                                    <th
                                                        key={`${vi}:${col.key}`}
                                                        className={`pv-value pv-sortable${col.type === "data" ? "" : " pv-total"}`}
                                                        style={{ top: valueRowTop }}
                                                        title={`Sort rows by ${v.label}`}
                                                        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                                                        onClick={() => actions.setSort(nextValueSort(sort, col.key, v.field.key))}
                                                    >
                                                        <span className="pv-head">
                                                            {active && <SortIcon dir={sort.dir} />}
                                                            {v.label}
                                                        </span>
                                                    </th>
                                                );
                                            })
                                        )}
                                    </tr>
                                )}
                            </thead>
                            <tbody>{onRows ? rowsBody : columnsBody}</tbody>
                            {!onRows && pivot.showGrandRow && (
                                <tfoot>
                                    <tr>
                                        {plainLabelCell(GRAND_TOTAL)}
                                        {columns.flatMap((col) => values.map((_, vi) => valueCell([], !layout.rows.length, col, vi)))}
                                    </tr>
                                </tfoot>
                            )}
                        </Box>
                    </Box>
                </Box>
                <PaginationFooter
                    isVisible={rows.length > PAGE_SIZES[0]}
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                    pageSizeOptions={PAGE_SIZES}
                />
            </Box>
        </>
    );
}
