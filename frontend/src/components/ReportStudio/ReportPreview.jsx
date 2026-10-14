import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, IconButton, LinearProgress, Paper, Skeleton, Typography } from "@mui/material";
import {
    Close as CloseIcon,
    DragIndicator as DragIcon,
    ErrorOutline as ErrorIcon,
    FunctionsOutlined as FunctionsIcon,
    LockOutlined as LockIcon,
    SearchOff as SearchOffIcon,
    TableChartOutlined as TableIcon,
    WarningAmberRounded as WarningIcon,
    LayersOutlined as LayersIcon,
} from "@mui/icons-material";
import PaginationFooter from "../CommonLayout/PaginationFooter";
import { FIELD_GROUPS, FIELDS_BY_KEY, SOURCES_BY_ID } from "./reportStudioConfig";
import { columnLetter, formatCellValue } from "./reportStudioUtils";

const GUTTER_WIDTH = 52;
const DATE_WIDTH = 124;
const LETTER_ROW_HEIGHT = 24;
// Fixed (not just preferred) widths: the frozen Date column is offset by the gutter's width.
const gutterSx = { width: GUTTER_WIDTH, minWidth: GUTTER_WIDTH, maxWidth: GUTTER_WIDTH, boxSizing: "border-box" };

// ── Column order (drag, or Alt + ←/→ on a focused chip) ──
function ColumnOrderStrip({ columns, unsupported, onMove, onRemove }) {
    const [dragKey, setDragKey] = useState(null);
    const [overKey, setOverKey] = useState(null);

    const endDrag = () => {
        setDragKey(null);
        setOverKey(null);
    };

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(30, 41, 59, 0.45)", textTransform: "uppercase", mr: 0.5 }}>
                Column order
            </Typography>
            {columns.map((key, index) => {
                const field = FIELDS_BY_KEY[key];
                const locked = field.group === FIELD_GROUPS.REQUIRED;
                const invalid = unsupported.includes(key);
                const isOver = overKey === key && dragKey && dragKey !== key;
                return (
                    <Box
                        key={key}
                        tabIndex={0}
                        draggable={!locked}
                        title={locked ? "Always included" : "Drag to reorder"}
                        aria-label={`${field.label}, column ${index + 1} of ${columns.length}${locked ? ", pinned" : ". Alt plus arrow keys to move, Delete to remove"}`}
                        onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", key);
                            setDragKey(key);
                        }}
                        onDragOver={(e) => {
                            if (!dragKey || locked) return;
                            e.preventDefault();
                            setOverKey(key);
                        }}
                        onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (dragKey && !locked) onMove(dragKey, index);
                            endDrag();
                        }}
                        onDragEnd={endDrag}
                        onKeyDown={(e) => {
                            if (locked) return;
                            if (e.altKey && e.key === "ArrowLeft") onMove(key, index - 1);
                            else if (e.altKey && e.key === "ArrowRight") onMove(key, index + 1);
                            else if (e.key === "Delete" || e.key === "Backspace") onRemove(key);
                            else return;
                            e.preventDefault();
                        }}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            height: 28,
                            pl: locked ? 1 : 0.5,
                            pr: locked ? 1 : 0.25,
                            borderRadius: "8px",
                            border: "1px solid",
                            borderColor: invalid ? "#fcd34d" : "#e2e8f0",
                            bgcolor: locked ? "#f1f5f9" : invalid ? "#fffbeb" : "#ffffff",
                            boxShadow: isOver ? "inset 3px 0 0 #2563eb" : "0 1px 2px rgba(15, 23, 42, 0.04)",
                            opacity: dragKey === key ? 0.4 : 1,
                            cursor: locked ? "default" : "grab",
                            userSelect: "none",
                            outline: "none",
                            "&:focus-visible": { borderColor: "#2563eb", boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.2)" },
                        }}
                    >
                        {locked ? (
                            <LockIcon sx={{ fontSize: "0.85rem", color: "#64748b" }} />
                        ) : (
                            <DragIcon sx={{ fontSize: "1rem", color: "#cbd5e1" }} />
                        )}
                        <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 600, color: invalid ? "#92400e" : "#334155" }}>
                            {field.label}
                        </Typography>
                        {invalid && <WarningIcon sx={{ fontSize: "0.9rem", color: "#d97706" }} />}
                        {!locked && (
                            <IconButton size="small" aria-label={`Remove ${field.label}`} onClick={() => onRemove(key)} sx={{ p: 0.25, color: "#94a3b8", "&:hover": { color: "#475569" } }}>
                                <CloseIcon sx={{ fontSize: "0.85rem" }} />
                            </IconButton>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}

// ── Name box + formula bar ──
function FormulaBar({ selection, fields, letters }) {
    let reference = "";
    let primary = null;
    let secondary = null;

    if (selection) {
        const field = fields[selection.col];
        const letter = letters[field.key];
        const definition = field.group === FIELD_GROUPS.KPI
            ? `${field.label} = ${field.formula}`
            : `${field.label} · ${Object.entries(field.columns).map(([s, c]) => `${SOURCES_BY_ID[s].table}.${c}`).join(", ")}`;
        if (selection.header) {
            reference = `${letter}:${letter}`;
            primary = definition;
        } else {
            reference = `${letter}${selection.row + 1}`;
            primary = selection.value ?? "—";
            secondary = definition;
        }
    }

    return (
        <Box sx={{ display: "flex", alignItems: "center", height: 32, border: "1px solid #e2e8f0", borderRadius: "8px", bgcolor: "#ffffff", overflow: "hidden" }}>
            <Box sx={{ width: 76, flexShrink: 0, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155" }}>{reference}</Typography>
            </Box>
            <FunctionsIcon sx={{ fontSize: "1rem", color: "#94a3b8", mx: 1, flexShrink: 0 }} />
            {selection && (
                <Typography sx={{ fontSize: "0.8rem", color: "#1e293b", fontWeight: 600, minWidth: 0 }} noWrap>
                    {String(primary)}
                    {secondary && (
                        <Box component="span" sx={{ color: "#94a3b8", fontWeight: 500, ml: 1.5 }}>
                            {secondary}
                        </Box>
                    )}
                </Typography>
            )}
        </Box>
    );
}

function StatePanel({ icon, tone = "#94a3b8", title, message, action }) {
    const Icon = icon;
    return (
        <Box sx={{ minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", px: 3, py: 5, border: "1px dashed #e2e8f0", borderRadius: "10px", bgcolor: "#fcfdfe" }}>
            <Icon sx={{ fontSize: 36, color: tone, mb: 1 }} />
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>{title}</Typography>
            {message && <Typography sx={{ fontSize: "0.8rem", color: "#64748b", mt: 0.5, maxWidth: 420 }}>{message}</Typography>}
            {action && <Box sx={{ mt: 2 }}>{action}</Box>}
        </Box>
    );
}

const headCellSx = {
    position: "sticky",
    zIndex: 2,
    bgcolor: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
};

function ReportGrid({ fields, rows, startIndex, letters, selection, onSelect }) {
    const stickyLeft = (ci) => (ci === 0 ? { position: "sticky", left: GUTTER_WIDTH, zIndex: 1, minWidth: DATE_WIDTH, boxShadow: "inset -1px 0 0 #e2e8f0" } : {});
    const isNumeric = (f) => f.group === FIELD_GROUPS.KPI;

    return (
        <Box
            component="table"
            sx={{
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: "100%",
                "& th, & td": { whiteSpace: "nowrap", borderRight: "1px solid #eef2f6", borderBottom: "1px solid #eef2f6" },
                "& tbody td": { bgcolor: "#ffffff", fontSize: "0.8rem", color: "#334155", px: 1.5, py: 0.75, cursor: "cell" },
                "& tbody tr:nth-of-type(even) td": { bgcolor: "#fafbfc" },
                "& tbody tr:hover td": { bgcolor: "#f0f4ff" },
            }}
        >
            <thead>
                <tr>
                    <Box component="th" sx={{ ...headCellSx, ...gutterSx, top: 0, left: 0, zIndex: 4, height: LETTER_ROW_HEIGHT, bgcolor: "#f1f5f9" }} />
                    {fields.map((f, ci) => {
                        const active = selection?.col === ci;
                        return (
                            <Box
                                component="th"
                                key={f.key}
                                onClick={() => onSelect({ col: ci, header: true })}
                                sx={{
                                    ...headCellSx,
                                    ...stickyLeft(ci),
                                    top: 0,
                                    zIndex: ci === 0 ? 4 : 2,
                                    height: LETTER_ROW_HEIGHT,
                                    textAlign: "center",
                                    fontSize: "0.66rem",
                                    fontWeight: 700,
                                    color: active ? "#2563eb" : "#94a3b8",
                                    bgcolor: active ? "#dbeafe" : "#f1f5f9",
                                }}
                            >
                                {letters[f.key]}
                            </Box>
                        );
                    })}
                </tr>
                <tr>
                    <Box component="th" sx={{ ...headCellSx, ...gutterSx, top: LETTER_ROW_HEIGHT, left: 0, zIndex: 4, borderBottom: "2px solid #e2e8f0 !important", fontSize: "0.7rem", color: "#94a3b8", textAlign: "center", cursor: "default" }}>
                        #
                    </Box>
                    {fields.map((f, ci) => {
                        const source = f.group === FIELD_GROUPS.KPI ? SOURCES_BY_ID[f.source] : null;
                        return (
                            <Box
                                component="th"
                                key={f.key}
                                title={source?.table}
                                onClick={() => onSelect({ col: ci, header: true })}
                                sx={{
                                    ...headCellSx,
                                    ...stickyLeft(ci),
                                    top: LETTER_ROW_HEIGHT,
                                    zIndex: ci === 0 ? 4 : 2,
                                    px: 1.5,
                                    py: 0.9,
                                    minWidth: isNumeric(f) ? 112 : 120,
                                    textAlign: isNumeric(f) ? "right" : "left",
                                    borderBottom: "2px solid #e2e8f0 !important",
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: isNumeric(f) ? "flex-end" : "flex-start", gap: 0.6 }}>
                                    {source && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: source.accent, flexShrink: 0 }} />}
                                    <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#1e293b", lineHeight: 1.2 }}>
                                        {f.label}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, ri) => {
                    const rowIndex = startIndex + ri;
                    const rowActive = selection && !selection.header && selection.row === rowIndex;
                    return (
                        <tr key={rowIndex}>
                            <Box
                                component="td"
                                sx={{
                                    ...gutterSx,
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 1,
                                    textAlign: "center",
                                    fontSize: "0.7rem !important",
                                    fontWeight: 600,
                                    color: rowActive ? "#2563eb !important" : "#94a3b8 !important",
                                    bgcolor: rowActive ? "#dbeafe !important" : "#f8fafc !important",
                                    cursor: "default !important",
                                }}
                            >
                                {rowIndex + 1}
                            </Box>
                            {fields.map((f, ci) => {
                                const active = rowActive && selection.col === ci;
                                return (
                                    <Box
                                        component="td"
                                        key={f.key}
                                        onClick={() => onSelect({ row: rowIndex, col: ci, value: row[f.key] })}
                                        sx={{
                                            ...stickyLeft(ci),
                                            textAlign: isNumeric(f) ? "right" : "left",
                                            fontVariantNumeric: "tabular-nums",
                                            fontWeight: ci === 0 ? 600 : 400,
                                            ...(active && { outline: "2px solid #2563eb", outlineOffset: "-2px", bgcolor: "#eff6ff !important" }),
                                        }}
                                    >
                                        {formatCellValue(f, row[f.key])}
                                    </Box>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </Box>
    );
}

export default function ReportPreview({
    columns,
    unsupported,
    fields,
    preview,
    headerAction,
    isUpdating,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    onMoveColumn,
    onRemoveColumn,
    onRemoveUnsupported,
    onRetry,
}) {
    const [selectionState, setSelectionState] = useState(null);
    const report = preview.status === "ready" ? preview.report : null;
    const totalRows = report?.totalRows ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const startIndex = (page - 1) * pageSize;

    // Letters follow the columns that actually render in the grid.
    const letters = useMemo(() => Object.fromEntries(fields.map((f, i) => [f.key, columnLetter(i)])), [fields]);

    const rows = useMemo(() => {
        if (!report) return [];
        const count = Math.max(0, Math.min(pageSize, report.totalRows - startIndex));
        return Array.from({ length: count }, (_, i) => report.getRow(startIndex + i));
    }, [report, startIndex, pageSize]);

    // A selection belongs to the report it was made on; a new report clears it.
    const selection = selectionState?.report === report ? selectionState : null;
    const select = (next) => setSelectionState({ ...next, report });

    const unsupportedLabels = unsupported.map((k) => FIELDS_BY_KEY[k].label);

    let body;
    if (preview.status === "loading") {
        body = (
            <Box sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", p: 2 }}>
                {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} variant="rounded" height={22} sx={{ mb: 1, borderRadius: "6px", bgcolor: "rgba(0,0,0,0.05)" }} />
                ))}
            </Box>
        );
    } else if (preview.status === "error") {
        body = (
            <StatePanel
                icon={ErrorIcon}
                tone="#ef4444"
                title="We couldn't build the preview"
                action={<Button variant="outlined" onClick={onRetry} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}>Try again</Button>}
            />
        );
    } else if (preview.status === "no-source") {
        body = (
            <StatePanel
                icon={LayersIcon}
                title="Choose a data source to start"
            />
        );
    } else if (totalRows === 0) {
        body = (
            <StatePanel
                icon={SearchOffIcon}
                title="No records for this time period"
            />
        );
    } else {
        body = (
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
                        <ReportGrid fields={fields} rows={rows} startIndex={startIndex} letters={letters} selection={selection} onSelect={select} />
                    </Box>
                </Box>
                <PaginationFooter
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    pageSize={pageSize}
                    onPageSizeChange={onPageSizeChange}
                    pageSizeOptions={[25, 50, 100]}
                />
            </Box>
        );
    }

    return (
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "16px", bgcolor: "#ffffff", p: 2, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TableIcon sx={{ fontSize: "1.2rem", color: "#2563eb" }} />
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Live preview</Typography>
                    {report && (
                        <Chip
                            label={`${totalRows.toLocaleString("en-IN")} ${totalRows === 1 ? "row" : "rows"}`}
                            size="small"
                            sx={{ bgcolor: "#eff6ff", color: "#2563eb", fontWeight: 700, fontSize: "0.72rem", height: 22 }}
                        />
                    )}
                </Box>
                {headerAction}
            </Box>

            <ColumnOrderStrip columns={columns} unsupported={unsupported} onMove={onMoveColumn} onRemove={onRemoveColumn} />

            {unsupported.length > 0 && (
                <Alert
                    severity="warning"
                    sx={{ borderRadius: "10px", alignItems: "center", "& .MuiAlert-message": { fontSize: "0.8rem" } }}
                    action={<Button color="inherit" size="small" onClick={onRemoveUnsupported} sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}>Remove</Button>}
                >
                    <strong>{unsupportedLabels.join(", ")}</strong> {unsupported.length === 1 ? "isn't" : "aren't"} available for the selected sources.
                </Alert>
            )}

            {preview.status === "ready" && fields.length === 1 && totalRows > 0 && (
                <Alert severity="info" sx={{ borderRadius: "10px", "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
                    Add dimensions or KPIs to build the report.
                </Alert>
            )}

            {preview.status === "ready" && totalRows > 0 && <FormulaBar selection={selection} fields={fields} letters={letters} />}

            {body}
        </Paper>
    );
}
