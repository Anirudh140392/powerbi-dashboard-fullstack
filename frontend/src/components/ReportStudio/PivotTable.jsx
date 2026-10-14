import React, { useMemo, useState } from "react";
import { Box, Button, FormControlLabel, IconButton, LinearProgress, Switch, Typography } from "@mui/material";
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
import { formatPivotValue, GRAND_TOTAL, PIVOT_SOURCE_ROW_LIMIT } from "./pivotUtils";

const HEAD_ROW_HEIGHT = 32;
const INDENT = 18;
const TOGGLE_SIZE = 24;
const PAGE_SIZES = [25, 50, 100];
const NO_KEYS = new Set();

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
    "& thead th.pv-dim-name": { textAlign: "right", fontSize: "0.66rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(30, 41, 59, 0.45)" },
    "& thead th.pv-sortable": { cursor: "pointer", userSelect: "none", "&:hover": { bgcolor: "#eef2ff" } },
    "& .pv-head": { display: "inline-flex", alignItems: "center", gap: "4px", "& svg": { fontSize: "0.9rem", color: "#2563eb" } },
    "& tbody td, & tfoot td": { bgcolor: "#ffffff", fontSize: "0.8rem", color: "#334155", py: 0.75 },
    "& td.pv-num": { textAlign: "right", fontVariantNumeric: "tabular-nums" },
    "& td.pv-col-total": { bgcolor: "#fafbfc", fontWeight: 600 },
    "& td.pv-label": { position: "sticky", left: 0, zIndex: 1, py: 0.5, boxShadow: "inset -1px 0 0 #e2e8f0" },
    "& .pv-label-inner": { display: "flex", alignItems: "center", gap: "4px", minWidth: { xs: 140, sm: 200 }, maxWidth: { xs: 200, sm: 360 } },
    "& .pv-label-text": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
    "& .pv-toggle-space": { width: TOGGLE_SIZE, flexShrink: 0 },
    "& .pv-crumb": { color: "#94a3b8", fontWeight: 500 },
    "& tbody tr.pv-group td": { bgcolor: "#f8fafc", fontWeight: 700, color: "#1e293b" },
    "& tbody tr:hover td": { bgcolor: "#f0f4ff" },
    "& tfoot td": { position: "sticky", bottom: 0, zIndex: 2, bgcolor: "#eef2ff", fontWeight: 800, color: "#1e293b", borderTop: "2px solid #c7d2fe" },
    "& tfoot td.pv-label": { zIndex: 3 },
};

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

    const { layout, columns, headerRows, valueAt, sort } = pivot;
    const { values } = layout;
    const hasGroups = groups.length > 0;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    const valueRowTop = headerRows.length * HEAD_ROW_HEIGHT;

    const toggleGroup = (key) => {
        const next = new Set(collapsed);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setCollapsed(next);
    };

    const valueCells = (rowPath, show = true) =>
        columns.flatMap((col) =>
            values.map((v, vi) => (
                <td key={`${vi}:${col.key}`} className={col.type === "data" ? "pv-num" : "pv-num pv-col-total"}>
                    {show ? formatPivotValue(v, valueAt(rowPath, col.path, vi)) : ""}
                </td>
            ))
        );

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", columnGap: 2, rowGap: 0.5, flexWrap: "wrap" }}>
                <Box sx={{ display: "flex", alignItems: "center", columnGap: 1, flexWrap: "wrap" }}>
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
                    {hasGroups && (
                        <>
                            <Button size="small" onClick={() => setCollapsed(NO_KEYS)} disabled={!collapsed.size} sx={linkButtonSx}>
                                Expand all
                            </Button>
                            <Button size="small" onClick={() => setCollapsed(new Set(groups))} disabled={collapsed.size >= groups.length} sx={linkButtonSx}>
                                Collapse all
                            </Button>
                        </>
                    )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
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
                            maxHeight: 520,
                            opacity: isUpdating ? 0.6 : 1,
                            transition: "opacity 0.15s ease",
                            "&::-webkit-scrollbar": { width: 8, height: 8 },
                            "&::-webkit-scrollbar-thumb": { bgcolor: "#cbd5e1", borderRadius: 4 },
                        }}
                    >
                        <Box component="table" sx={tableSx}>
                            <thead>
                                {headerRows.map((cells, level) => (
                                    <tr key={level}>
                                        <th className="pv-corner pv-dim-name" style={{ top: level * HEAD_ROW_HEIGHT }}>
                                            {layout.columns[level].label}
                                        </th>
                                        {cells.map((cell) => (
                                            <th
                                                key={cell.key}
                                                colSpan={cell.span * values.length}
                                                rowSpan={cell.rowSpan}
                                                className={cell.total ? "pv-total" : "pv-group-head"}
                                                style={{ top: level * HEAD_ROW_HEIGHT }}
                                            >
                                                {cell.label}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                                <tr>
                                    <th
                                        className={`pv-corner${layout.rows.length ? " pv-sortable" : ""}`}
                                        style={{ top: valueRowTop }}
                                        aria-sort={sort.by === "label" && layout.rows.length ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                                        onClick={layout.rows.length ? () => actions.setSort({ by: "label", dir: sort.by === "label" && sort.dir === "asc" ? "desc" : "asc" }) : undefined}
                                    >
                                        <span className="pv-head">
                                            {layout.rows.map((f) => f.label).join(" › ")}
                                            {sort.by === "label" && layout.rows.length > 0 && <SortIcon dir={sort.dir} />}
                                        </span>
                                    </th>
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
                            </thead>
                            <tbody>
                                {pageRows.map((node, i) => {
                                    const isGroup = node.children.length > 0;
                                    const isCollapsed = collapsed.has(node.key);
                                    const ancestors = ancestorLabels(node);
                                    return (
                                        <tr key={node.key} className={isGroup ? "pv-group" : undefined}>
                                            <td className="pv-label">
                                                <div className="pv-label-inner" style={{ paddingLeft: node.level * INDENT }}>
                                                    {isGroup ? (
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
                                                            aria-expanded={!isCollapsed}
                                                            onClick={() => toggleGroup(node.key)}
                                                            sx={{ p: 0, width: TOGGLE_SIZE, height: TOGGLE_SIZE, color: "#64748b" }}
                                                        >
                                                            {isCollapsed ? <CollapsedIcon fontSize="small" /> : <ExpandedIcon fontSize="small" />}
                                                        </IconButton>
                                                    ) : (
                                                        hasGroups && <span className="pv-toggle-space" />
                                                    )}
                                                    <span className="pv-label-text" title={[...ancestors, node.label].join(" › ")}>
                                                        {/* A page that starts mid-group names the group it continues. */}
                                                        {i === 0 && ancestors.length > 0 && <span className="pv-crumb">{ancestors.join(" › ")} › </span>}
                                                        {node.label}
                                                    </span>
                                                </div>
                                            </td>
                                            {valueCells(node.path, !isGroup || pivot.subtotals)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {pivot.showGrandRow && (
                                <tfoot>
                                    <tr>
                                        <td className="pv-label">
                                            <div className="pv-label-inner">
                                                {hasGroups && <span className="pv-toggle-space" />}
                                                <span className="pv-label-text">{GRAND_TOTAL}</span>
                                            </div>
                                        </td>
                                        {valueCells([])}
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
