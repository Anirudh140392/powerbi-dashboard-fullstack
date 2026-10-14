import React, { useContext, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Snackbar, Tooltip, Typography } from "@mui/material";
import {
    FileDownloadOutlined as DownloadIcon,
    RestartAlt as ResetIcon,
    ScienceOutlined as SampleIcon,
} from "@mui/icons-material";
import { useDebounce } from "use-debounce";
import { saveAs } from "file-saver";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { FilterContext } from "../../utils/FilterContext";
import SourceSelector from "../../components/ReportStudio/SourceSelector";
import FieldPanel from "../../components/ReportStudio/FieldPanel";
import ReportPreview from "../../components/ReportStudio/ReportPreview";
import useReportConfig from "../../components/ReportStudio/useReportConfig";
import usePivotConfig from "../../components/ReportStudio/usePivotConfig";
import { FIELD_GROUPS, FIELDS_BY_KEY } from "../../components/ReportStudio/reportStudioConfig";
import { buildCsv, buildFileName, isFieldAvailable } from "../../components/ReportStudio/reportStudioUtils";
import { buildPivot, buildPivotCsv, PIVOT_SOURCE_ROW_LIMIT, resolvePivotLayout } from "../../components/ReportStudio/pivotUtils";
// Sample data stands in for the report API until the backend is wired up.
import { buildSampleReport, SAMPLE_EXPORT_ROW_LIMIT } from "../../components/ReportStudio/reportStudioSampleData";

const PREVIEW_DEBOUNCE_MS = 300;

/** Selected columns the current sources can actually provide, in column order. */
const supportedFields = ({ columns, sources }) =>
    columns.map((k) => FIELDS_BY_KEY[k]).filter((f) => f.group === FIELD_GROUPS.REQUIRED || isFieldAvailable(f, sources));

export default function ReportStudio() {
    const { timeStart, timeEnd, datesFetched } = useContext(FilterContext);
    const { config, actions, validation } = useReportConfig();
    const { pivotConfig, pivotActions } = usePivotConfig();
    const [view, setView] = useState("raw");
    const [debouncedConfig] = useDebounce(config, PREVIEW_DEBOUNCE_MS);
    const [attempt, setAttempt] = useState(0);
    const [pageState, setPageState] = useState({ report: null, page: 1 });
    const [pageSize, setPageSize] = useState(25);
    const [isExporting, setIsExporting] = useState(false);
    const exportingRef = useRef(false);
    // Kept after closing so the toast keeps its content during the exit transition.
    const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
    const notify = (severity, message) => setToast({ open: true, severity, message });

    const datesReady = Boolean(datesFetched && timeStart && timeEnd);

    const preview = useMemo(() => {
        if (!datesReady) return { status: "loading", fields: [], attempt };
        if (!debouncedConfig.sources.length) return { status: "no-source", fields: [], attempt };
        const fields = supportedFields(debouncedConfig);
        try {
            const report = buildSampleReport({
                sources: debouncedConfig.sources,
                fields,
                startDate: timeStart,
                endDate: timeEnd,
            });
            return { status: "ready", fields, report, attempt };
        } catch (error) {
            console.error("[ReportStudio] Failed to build preview:", error);
            return { status: "error", fields, attempt };
        }
    }, [debouncedConfig, datesReady, timeStart, timeEnd, attempt]);

    // The pivot summarises the previewed report, so it follows the same debounce.
    const pivot = useMemo(() => {
        if (view !== "custom" || preview.status !== "ready") return null;
        try {
            return buildPivot(preview.report, preview.fields, pivotConfig);
        } catch (error) {
            console.error("[ReportStudio] Failed to build pivot:", error);
            return { status: "error" };
        }
    }, [view, preview, pivotConfig]);

    const isUpdating = datesReady && config !== debouncedConfig;

    // Paging restarts whenever the report changes.
    const page = pageState.report === preview.report ? pageState.page : 1;
    const setPage = (next) => setPageState({ report: preview.report, page: next });

    const hasPivotValues = resolvePivotLayout(supportedFields(config), pivotConfig.areas).values.length > 0;
    const downloadBlockedReason = !datesReady
        ? "Waiting for the time period to load"
        : validation.errors[0] || (view === "custom" && !hasPivotValues ? "Add a KPI to Values to download the pivot" : undefined);

    const handleDownload = () => {
        if (exportingRef.current || downloadBlockedReason) return;
        exportingRef.current = true;
        setIsExporting(true);

        // Yield once so the button's progress state paints before the CSV is built.
        setTimeout(() => {
            try {
                const fields = supportedFields(config);
                const report = buildSampleReport({
                    sources: config.sources,
                    fields,
                    startDate: timeStart,
                    endDate: timeEnd,
                });
                const rowCount = report.totalRows.toLocaleString("en-IN");
                if (report.totalRows === 0) {
                    notify("warning", "No records to download for this time period.");
                    return;
                }
                const fileName = buildFileName(config.sources, timeStart, timeEnd, { sample: true, pivot: view === "custom" });
                const save = (csv) => saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName);

                if (view === "custom") {
                    const result = buildPivot(report, fields, pivotConfig);
                    if (result.status === "too-large") {
                        notify(
                            "error",
                            `${rowCount} rows is more than the ${PIVOT_SOURCE_ROW_LIMIT.toLocaleString("en-IN")} rows the pivot can summarise. Shorten the time period or remove columns.`
                        );
                        return;
                    }
                    if (result.status === "filtered-out") {
                        notify("warning", "No rows match the pivot filters.");
                        return;
                    }
                    save(buildPivotCsv(result));
                    notify("success", `Downloaded ${fileName} (pivot of ${rowCount} rows)`);
                    return;
                }

                if (report.totalRows > SAMPLE_EXPORT_ROW_LIMIT) {
                    notify(
                        "error",
                        `${rowCount} rows exceeds the ${SAMPLE_EXPORT_ROW_LIMIT.toLocaleString("en-IN")}-row sample export limit. Shorten the time period or remove columns.`
                    );
                    return;
                }
                save(buildCsv(fields, report));
                notify("success", `Downloaded ${fileName} (${rowCount} rows)`);
            } catch (error) {
                console.error("[ReportStudio] CSV export failed:", error);
                notify("error", "The CSV couldn't be generated. Please try again.");
            } finally {
                exportingRef.current = false;
                setIsExporting(false);
            }
        }, 0);
    };

    const downloadButton = (
        <Tooltip title={downloadBlockedReason || ""} arrow>
            <span>
                <Button
                    variant="contained"
                    size="small"
                    onClick={handleDownload}
                    disabled={Boolean(downloadBlockedReason) || isExporting}
                    startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                    sx={{
                        textTransform: "none", borderRadius: "10px", fontWeight: 700, px: 2, py: 0.75, whiteSpace: "nowrap",
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                        "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)" },
                        "&.Mui-disabled": { background: "#e2e8f0", color: "#94a3b8", boxShadow: "none" },
                    }}
                >
                    {isExporting ? "Preparing CSV…" : "Download CSV"}
                </Button>
            </span>
        </Tooltip>
    );

    return (
        <CommonContainer title="Report Studio" disablePadding>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 3 }}>
                {/* ── Page header ── */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", columnGap: 1.25, rowGap: 0.5, flexWrap: "wrap", minWidth: 0 }}>
                        <Typography component="h1" sx={{ fontWeight: 700, color: "#1e293b", fontSize: "1.15rem" }}>
                            Report Studio
                        </Typography>
                        <Tooltip title="The preview and CSV use generated sample values until the live data connection is added." arrow>
                            <Chip
                                icon={<SampleIcon sx={{ fontSize: "0.95rem !important" }} />}
                                label="Sample data"
                                size="small"
                                sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", "& .MuiChip-icon": { color: "#d97706" } }}
                            />
                        </Tooltip>
                    </Box>

                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                            actions.reset();
                            pivotActions.reset();
                        }}
                        startIcon={<ResetIcon />}
                        sx={{
                            textTransform: "none", borderRadius: "10px", borderColor: "#cbd5e1", color: "#64748b", fontWeight: 650, px: 2, whiteSpace: "nowrap",
                            "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" },
                        }}
                    >
                        Reset configuration
                    </Button>
                </Box>

                <SourceSelector sources={config.sources} onToggle={actions.toggleSource} />

                <Box
                    sx={{
                        display: "grid",
                        gap: 2,
                        alignItems: "start",
                        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "300px minmax(0, 1fr)", xl: "320px minmax(0, 1fr)" },
                    }}
                >
                    <FieldPanel
                        sources={config.sources}
                        columns={config.columns}
                        onToggle={actions.toggleColumn}
                        onSelectAll={actions.selectAll}
                        onClearOptional={actions.clearOptional}
                    />

                    <ReportPreview
                        view={view}
                        onViewChange={setView}
                        columns={config.columns}
                        unsupported={validation.unsupported}
                        fields={preview.fields}
                        preview={preview}
                        pivot={pivot}
                        pivotConfig={pivotConfig}
                        pivotActions={pivotActions}
                        headerAction={downloadButton}
                        isUpdating={isUpdating}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            setPage(1);
                        }}
                        onMoveColumn={actions.moveColumn}
                        onRemoveColumn={(key) => actions.removeColumns([key])}
                        onRemoveUnsupported={() => actions.removeColumns(validation.unsupported)}
                        onRetry={() => setAttempt((n) => n + 1)}
                    />
                </Box>
            </Box>

            <Snackbar
                open={toast.open}
                autoHideDuration={5000}
                onClose={(_, reason) => reason !== "clickaway" && setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ borderRadius: "12px", maxWidth: 480 }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </CommonContainer>
    );
}
