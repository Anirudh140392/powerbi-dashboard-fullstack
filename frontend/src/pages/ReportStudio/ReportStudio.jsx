import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Snackbar, Tooltip, Typography } from "@mui/material";
import {
    BookmarkAddOutlined as SaveTemplateIcon,
    EventRepeatOutlined as SchedulesIcon,
    FileDownloadOutlined as DownloadIcon,
    RestartAlt as ResetIcon,
    ScheduleSendOutlined as ScheduleIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useDebounce } from "use-debounce";
import { useSearchParams } from "react-router-dom";
import { saveAs } from "file-saver";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { FilterContext } from "../../utils/FilterContext";
import { useAuth } from "../../utils/AuthContext";
import SourceSelector from "../../components/ReportStudio/SourceSelector";
import BrandScopeBar from "../../components/ReportStudio/BrandScopeBar";
import ScheduleReportDialog from "../../components/ReportStudio/ScheduleReportDialog";
import ReportSchedulesDialog from "../../components/ReportStudio/ReportSchedulesDialog";
import { formatSendTime } from "../../components/ReportStudio/scheduleOptions";
import TemplateGallery from "../../components/ReportStudio/TemplateGallery";
import SaveTemplateDialog from "../../components/ReportStudio/SaveTemplateDialog";
import ConfirmDialog from "../../components/ReportStudio/ConfirmDialog";
import { currentPeriod, isModifiedFrom, toGalleryTemplate } from "../../components/ReportStudio/savedTemplates";
import ReportingPeriodBar from "../../components/ReportStudio/ReportingPeriodBar";
import FieldPanel from "../../components/ReportStudio/FieldPanel";
import ReportPreview from "../../components/ReportStudio/ReportPreview";
import useReportConfig from "../../components/ReportStudio/useReportConfig";
import usePivotConfig from "../../components/ReportStudio/usePivotConfig";
import { FIELD_GROUPS, FIELDS_BY_KEY, getTemplateCatalog, isMarsAccount, SOURCES_BY_ID } from "../../components/ReportStudio/reportStudioConfig";
import { FISCAL_PERIODS, lastPeriods, resolvePeriodRange } from "../../components/ReportStudio/fiscalCalendar";
import { buildFileName, isFieldAvailable } from "../../components/ReportStudio/reportStudioUtils";
import { buildPivot, buildPivotCsv, PIVOT_SOURCE_ROW_LIMIT, resolvePivotLayout } from "../../components/ReportStudio/pivotUtils";
import {
    deleteReportTemplate, downloadStudioCsv, fetchReportTemplates, fetchStudioPreview, fetchStudioRows, markReportTemplateUsed, updateReportTemplate,
} from "../../api/reportsService";

const PREVIEW_DEBOUNCE_MS = 300;

/** Selected columns the current sources can actually provide, in column order. */
const supportedFields = ({ columns, sources }) =>
    columns.map((k) => FIELDS_BY_KEY[k]).filter((f) => f.group === FIELD_GROUPS.REQUIRED || isFieldAvailable(f, sources));

const sameList = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The template whose sources, columns and pivot areas the current configuration still matches. */
const findAppliedTemplate = (templates, config, pivotConfig) =>
    templates.find(
        (t) =>
            sameList(config.sources, t.sources) &&
            sameList(config.columns, t.columns) &&
            Object.entries(t.pivot.areas).every(([area, keys]) => sameList(pivotConfig.areas[area], keys))
    );

const defaultPeriod = () => ({ mode: "dashboard", ...lastPeriods(1) });

/** A date range ending no later than `lastDay`, as the report API enforces. */
const capRange = ({ start, end }, lastDay) => {
    const cappedEnd = end.isAfter(lastDay, "day") ? lastDay : end;
    return { start: start.isAfter(cappedEnd, "day") ? cappedEnd : start, end: cappedEnd };
};

/** Fields the tenant's data can't supply are flagged, so their cells read NA. */
const markUnavailable = (fields, unavailable = []) =>
    fields.map((f) => (unavailable.includes(f.key) ? { ...f, unavailable: true } : f));

/**
 * The report API's rows as the report object the preview and pivot read:
 * { totalRows, getRow(index), startDate, endDate }. A page holds rows from
 * `offset` on; a pivot request too large to send holds none.
 */
const toReport = ({ totalRows, rows = [] }, { offset = 0, startDate, endDate, periods }) => ({
    totalRows,
    getRow: (index) => rows[index - offset] || {},
    startDate,
    endDate,
    periods,
});

export default function ReportStudio() {
    const { timeStart, timeEnd, setTimeStart, setTimeEnd, datesFetched, compareStart, compareEnd } = useContext(FilterContext);
    const { user } = useAuth();
    // Mars gets the Special templates and its fiscal reporting periods; everyone else the General templates.
    const hasFiscalPeriods = isMarsAccount(user?.dbName);
    const catalog = useMemo(() => getTemplateCatalog(user?.dbName), [user?.dbName]);
    const { config, actions, validation } = useReportConfig();
    const { pivotConfig, pivotActions } = usePivotConfig();
    const [view, setView] = useState("raw");
    const [period, setPeriod] = useState(defaultPeriod);
    const [debouncedConfig] = useDebounce(config, PREVIEW_DEBOUNCE_MS);
    const [attempt, setAttempt] = useState(0);
    const [pageState, setPageState] = useState({ key: null, page: 1 });
    const [pageSize, setPageSize] = useState(25);
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const exportingRef = useRef(false);
    // Kept after closing so the toast keeps its content during the exit transition.
    const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
    const notify = (severity, message) => setToast({ open: true, severity, message });
    // Scheduled emails: the form (new, or editing `schedule`) and the list, which the email's "Manage schedule" link opens.
    const [searchParams, setSearchParams] = useSearchParams();
    const [scheduleForm, setScheduleForm] = useState({ open: false, schedule: null });
    const [schedulesOpen, setSchedulesOpen] = useState(() => searchParams.get("schedules") === "1");
    const [schedulesVersion, setSchedulesVersion] = useState(0);
    // Saved templates: the list, which gallery tab is open, the one last applied, and the open dialogs.
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [savedStatus, setSavedStatus] = useState("loading");
    const [savedAttempt, setSavedAttempt] = useState(0);
    const [templateTab, setTemplateTab] = useState("builtin");
    const [activeSavedId, setActiveSavedId] = useState(null);
    const [templateDialog, setTemplateDialog] = useState({ open: false, template: null });
    const [templateConfirm, setTemplateConfirm] = useState(null);
    const [templateBusy, setTemplateBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setSavedStatus("loading");
        fetchReportTemplates()
            .then((list) => {
                if (cancelled) return;
                setSavedTemplates(list);
                setSavedStatus("ready");
            })
            .catch((error) => {
                if (cancelled) return;
                console.error("[ReportStudio] Failed to load saved templates:", error);
                setSavedStatus("error");
            });
        return () => {
            cancelled = true;
        };
    }, [user?.dbName, savedAttempt]);

    // QC users can report on today; everyone else up to yesterday.
    const isQcUser = Number(user?.qcUser) === 1;
    const lastDataDay = useMemo(() => (isQcUser ? dayjs() : dayjs().subtract(1, "day")).startOf("day"), [isQcUser]);

    // The report covers either the dashboard's dates or a range of fiscal periods.
    const range = useMemo(() => {
        if (hasFiscalPeriods && period.mode === "fiscal") return capRange(resolvePeriodRange(period), lastDataDay);
        return datesFetched && timeStart && timeEnd ? capRange({ start: timeStart, end: timeEnd }, lastDataDay) : null;
    }, [hasFiscalPeriods, period, datesFetched, timeStart, timeEnd, lastDataDay]);
    const datesReady = Boolean(range);

    // What the report API is asked for; null until there are dates and a source.
    const request = useMemo(() => {
        if (!datesReady || !debouncedConfig.sources.length) return null;
        const fields = supportedFields(debouncedConfig);
        const currStartStr = range.start.format("YYYY-MM-DD");
        const currEndStr = range.end.format("YYYY-MM-DD");

        // Calculate previous period dates
        let prevStartStr = null;
        let prevEndStr = null;

        if (hasFiscalPeriods && period.mode === "fiscal") {
            const fromIdx = FISCAL_PERIODS.findIndex((p) => p.id === period.from);
            const toIdx = FISCAL_PERIODS.findIndex((p) => p.id === period.to);
            if (fromIdx >= 0 && toIdx >= fromIdx) {
                const count = toIdx - fromIdx + 1;
                if (fromIdx >= count && FISCAL_PERIODS[fromIdx - count]) {
                    prevStartStr = FISCAL_PERIODS[fromIdx - count].start;
                    prevEndStr = FISCAL_PERIODS[toIdx - count].end;
                }
            }
        } else if (compareStart && compareEnd) {
            prevStartStr = dayjs(compareStart).format("YYYY-MM-DD");
            prevEndStr = dayjs(compareEnd).format("YYYY-MM-DD");
        }

        if (!prevStartStr || !prevEndStr) {
            const durationDays = dayjs(currEndStr).diff(dayjs(currStartStr), "day") + 1;
            const isFullMonth = dayjs(currStartStr).date() === 1 && dayjs(currEndStr).isSame(dayjs(currEndStr).endOf("month"), "day");
            if (isFullMonth) {
                prevStartStr = dayjs(currStartStr).subtract(1, "month").startOf("month").format("YYYY-MM-DD");
                prevEndStr = dayjs(currStartStr).subtract(1, "month").endOf("month").format("YYYY-MM-DD");
            } else {
                prevEndStr = dayjs(currStartStr).subtract(1, "day").format("YYYY-MM-DD");
                prevStartStr = dayjs(prevEndStr).subtract(durationDays - 1, "day").format("YYYY-MM-DD");
            }
        }

        const fetchStartDate = view === "custom" && prevStartStr && prevStartStr < currStartStr
            ? prevStartStr
            : currStartStr;

        const params = {
            sources: debouncedConfig.sources,
            columns: fields.map((f) => f.key),
            startDate: fetchStartDate,
            endDate: currEndStr,
            brandScope: debouncedConfig.brandScope,
        };
        return {
            fields,
            params,
            key: JSON.stringify(params),
            periods: {
                currStart: currStartStr,
                currEnd: currEndStr,
                prevStart: prevStartStr,
                prevEnd: prevEndStr,
            },
        };
    }, [debouncedConfig, datesReady, range, hasFiscalPeriods, period, compareStart, compareEnd, view]);

    // Paging restarts whenever the report changes.
    const page = pageState.key === request?.key ? pageState.page : 1;
    const setPage = (next) => setPageState({ key: request?.key, page: next });

    // The raw view loads one page at a time; the pivot loads every row it summarises.
    useEffect(() => {
        if (!request) return undefined;
        const controller = new AbortController();
        const { params, fields } = request;
        const load = view === "custom"
            ? fetchStudioRows(params, { signal: controller.signal })
            : fetchStudioPreview({ ...params, page, pageSize }, { signal: controller.signal });
        setIsLoading(true);
        load
            .then((data) => {
                const offset = view === "custom" ? 0 : (page - 1) * pageSize;
                setResult({
                    view,
                    status: "ready",
                    fields: markUnavailable(fields, data.unavailable),
                    report: toReport(data, {
                        offset,
                        startDate: request.periods?.currStart || params.startDate,
                        endDate: request.periods?.currEnd || params.endDate,
                        periods: request.periods,
                    }),
                });
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                console.error("[ReportStudio] Failed to load the report:", error);
                setResult({ view, status: "error", fields });
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [request, view, page, pageSize, attempt]);

    // While a new page or configuration loads, the previous result stays on
    // screen; switching view waits for that view's own data.
    let preview;
    if (!datesReady) preview = { status: "loading", fields: [] };
    else if (!debouncedConfig.sources.length) preview = { status: "no-source", fields: [] };
    else if (!result || result.view !== view) preview = { status: "loading", fields: [] };
    else preview = result;

    // The pivot summarises the loaded rows, so it follows the same debounce.
    const pivot = useMemo(() => {
        if (view !== "custom" || preview.status !== "ready") return null;
        try {
            return buildPivot(preview.report, preview.fields, pivotConfig);
        } catch (error) {
            console.error("[ReportStudio] Failed to build pivot:", error);
            return { status: "error" };
        }
    }, [view, preview, pivotConfig]);

    const isUpdating = datesReady && (config !== debouncedConfig || isLoading);

    const hasPivotValues = resolvePivotLayout(supportedFields(config), pivotConfig.areas).values.length > 0;
    const activePivotKeys = [
        ...(pivotConfig.areas.filters || []),
        ...(pivotConfig.areas.columns || []),
        ...(pivotConfig.areas.rows || []),
        ...(pivotConfig.areas.values || []),
    ];
    const unsupportedInPivot = validation.unsupported.filter((k) => activePivotKeys.includes(k));
    const configError = view === "custom"
        ? (unsupportedInPivot.length ? `${unsupportedInPivot.length === 1 ? "1 column in the pivot isn't" : `${unsupportedInPivot.length} columns in the pivot aren't`} supported by the selected sources.` : undefined)
        : validation.errors[0];

    const downloadBlockedReason = !datesReady
        ? "Waiting for the time period to load"
        : configError ||
          (view === "custom" && !hasPivotValues ? "Add a KPI to Values to download the pivot" : undefined) ||
          (isUpdating || preview.status !== "ready" ? "Waiting for the report to load" : undefined);

    const handleDownload = async () => {
        if (exportingRef.current || downloadBlockedReason) return;
        const { report } = preview;
        const rowCount = report.totalRows.toLocaleString("en-IN");
        if (report.totalRows === 0) {
            notify("warning", "No records to download for this time period.");
            return;
        }
        const { sources, startDate, endDate } = request.params;
        const fileName = buildFileName(sources, startDate, endDate, { pivot: view === "custom" });

        if (view === "custom") {
            if (pivot.status === "error") {
                notify("error", "The pivot couldn't be built. Please try again.");
                return;
            }
            if (pivot.status === "too-large") {
                notify(
                    "error",
                    `${rowCount} rows is more than the ${PIVOT_SOURCE_ROW_LIMIT.toLocaleString("en-IN")} rows the pivot can summarise. Shorten the time period or remove columns.`
                );
                return;
            }
            if (pivot.status === "filtered-out") {
                notify("warning", "No rows match the pivot filters.");
                return;
            }
            saveAs(new Blob([buildPivotCsv(pivot)], { type: "text/csv;charset=utf-8" }), fileName);
            notify("success", `Downloaded ${fileName} (pivot of ${rowCount} rows)`);
            return;
        }

        exportingRef.current = true;
        setIsExporting(true);
        try {
            saveAs(await downloadStudioCsv(request.params), fileName);
            notify("success", `Downloaded ${fileName} (${rowCount} rows)`);
        } catch (error) {
            console.error("[ReportStudio] CSV export failed:", error);
            notify("error", "The CSV couldn't be generated. Please try again.");
        } finally {
            exportingRef.current = false;
            setIsExporting(false);
        }
    };

    const appliedTemplate = view === "custom" ? findAppliedTemplate(catalog.templates, config, pivotConfig) : undefined;

    // A saved template's relative date range, moved up to the latest data.
    const applySavedPeriod = (saved) => {
        if (saved.type === "fiscal_periods") {
            if (hasFiscalPeriods) setPeriod({ mode: "fiscal", ...lastPeriods(saved.count) });
            return;
        }
        if (hasFiscalPeriods) setPeriod((p) => ({ ...p, mode: "dashboard" }));
        setTimeStart(lastDataDay.subtract(saved.count - 1, "day"));
        setTimeEnd(lastDataDay);
    };

    const applyTemplate = (template) => {
        actions.applyTemplate(template);
        pivotActions.applyTemplate(template.pivot || {});
        if (template.periods && hasFiscalPeriods) setPeriod({ mode: "fiscal", ...lastPeriods(template.periods) });
        if (template.period) applySavedPeriod(template.period);
        setView(template.view || "custom");
        setActiveSavedId(template.saved ? template.id : null);
        if (template.saved) markReportTemplateUsed(template.id).catch(() => {});
    };

    // The report on screen, as a template records it.
    const currentSetup = { view, sources: config.sources, columns: config.columns, brandScope: config.brandScope, pivot: pivotConfig };
    const periodNow = currentPeriod({ fiscal: hasFiscalPeriods && period.mode === "fiscal", period, range });
    const hasPivotFilters = view === "custom" && Object.values(pivotConfig.excluded).some((values) => values.length > 0);
    const galleryTemplates = savedTemplates.map(toGalleryTemplate);
    const activeSaved = galleryTemplates.find((t) => t.id === activeSavedId);
    const activeModified = Boolean(activeSaved) && isModifiedFrom(activeSaved, currentSetup);
    const userEmail = String(user?.email || "").toLowerCase();
    const canManageActive = Boolean(activeSaved) && (activeSaved.saved.createdBy === userEmail || /admin|super/.test(String(user?.role || "").toLowerCase()));

    /** Overwrites a saved template with the report on screen, keeping its choice of filters and date range. */
    const overwriteTemplate = async (saved) => {
        setTemplateBusy(true);
        try {
            const updated = await updateReportTemplate(saved.id, {
                config: {
                    ...currentSetup,
                    includeFilters: Boolean(saved.config.pivot?.excluded),
                    period: saved.config.period ? periodNow || saved.config.period : null,
                },
            });
            setSavedTemplates((list) => list.map((t) => (t.id === updated.id ? updated : t)));
            setActiveSavedId(updated.id);
            notify("success", `Updated "${updated.name}"`);
        } catch (error) {
            notify("error", error.response?.data?.error || "The template couldn't be updated.");
        } finally {
            setTemplateBusy(false);
            setTemplateConfirm(null);
        }
    };

    const removeTemplate = async (saved) => {
        setTemplateBusy(true);
        try {
            await deleteReportTemplate(saved.id);
            setSavedTemplates((list) => list.filter((t) => t.id !== saved.id));
            if (activeSavedId === saved.id) setActiveSavedId(null);
            notify("success", `Deleted "${saved.name}"`);
        } catch (error) {
            notify("error", error.response?.data?.error || "The template couldn't be deleted.");
        } finally {
            setTemplateBusy(false);
            setTemplateConfirm(null);
        }
    };

    const handleTemplateSaved = (saved, { created }) => {
        setTemplateDialog({ open: false, template: null });
        setSavedTemplates((list) => (created ? [saved, ...list] : list.map((t) => (t.id === saved.id ? saved : t))));
        if (created) {
            setActiveSavedId(saved.id);
            setTemplateTab("mine");
        }
        notify("success", created ? `Saved template "${saved.name}"` : `Saved "${saved.name}"`);
    };

    const templateActions = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {activeModified && (
                <Typography sx={{ fontSize: "0.74rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    Changed since applying “{activeSaved.label}”
                </Typography>
            )}
            {activeModified && canManageActive && (
                <Button
                    size="small"
                    onClick={() => overwriteTemplate(activeSaved.saved)}
                    disabled={templateBusy}
                    sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.78rem", color: "#2563eb", px: 1.25 }}
                >
                    Save changes
                </Button>
            )}
            <Tooltip title={config.sources.length ? "" : "Select a data source first"} arrow>
                <span>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SaveTemplateIcon />}
                        onClick={() => setTemplateDialog({ open: true, template: null })}
                        disabled={!config.sources.length}
                        sx={{
                            textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.78rem", px: 1.5, py: 0.4, whiteSpace: "nowrap",
                            borderColor: "#bfdbfe", color: "#2563eb", "&:hover": { borderColor: "#2563eb", bgcolor: "#eff6ff" },
                        }}
                    >
                        {activeModified ? "Save as new" : "Save as template"}
                    </Button>
                </span>
            </Tooltip>
        </Box>
    );

    const scheduleBlockedReason = !config.sources.length ? "Select a data source first" : validation.errors[0];
    const scheduledReport = {
        sources: config.sources,
        columns: supportedFields(config).map((f) => f.key),
        brandScope: config.brandScope,
    };
    const scheduledReportName = appliedTemplate?.label || `${config.sources.map((id) => SOURCES_BY_ID[id].label).join(" + ")} report`;

    const closeSchedules = () => {
        setSchedulesOpen(false);
        if (searchParams.has("schedules")) {
            searchParams.delete("schedules");
            setSearchParams(searchParams, { replace: true });
        }
    };

    const handleScheduleSaved = (schedule, { created }) => {
        setScheduleForm({ open: false, schedule: null });
        setSchedulesVersion((n) => n + 1);
        const next = schedule.nextSendAt ? ` First email ${formatSendTime(schedule.nextSendAt)} IST.` : "";
        notify("success", created ? `Scheduled "${schedule.name}".${next}` : `Saved "${schedule.name}".`);
    };

    const scheduleButton = (
        <Tooltip title={scheduleBlockedReason || "Email this report on a schedule"} arrow>
            <span>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setScheduleForm({ open: true, schedule: null })}
                    disabled={Boolean(scheduleBlockedReason)}
                    startIcon={<ScheduleIcon />}
                    sx={{
                        textTransform: "none", borderRadius: "10px", fontWeight: 700, px: 2, py: 0.7, whiteSpace: "nowrap",
                        borderColor: "#bfdbfe", color: "#2563eb",
                        "&:hover": { borderColor: "#2563eb", bgcolor: "#eff6ff" },
                    }}
                >
                    Schedule
                </Button>
            </span>
        </Tooltip>
    );

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
                        <Chip
                            label="BETA"
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                bgcolor: "#eff6ff",
                                color: "#2563eb",
                                border: "1px solid #bfdbfe",
                                letterSpacing: "0.05em",
                            }}
                        />
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setSchedulesOpen(true)}
                            startIcon={<SchedulesIcon />}
                            sx={{
                                textTransform: "none", borderRadius: "10px", borderColor: "#cbd5e1", color: "#64748b", fontWeight: 650, px: 2, whiteSpace: "nowrap",
                                "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" },
                            }}
                        >
                            Scheduled reports
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                                actions.reset();
                                pivotActions.reset();
                                setActiveSavedId(null);
                                setPeriod(defaultPeriod());
                                setView("raw");
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
                </Box>

                <TemplateGallery
                    category={catalog.category}
                    templates={catalog.templates}
                    savedTemplates={galleryTemplates}
                    savedState={{ status: savedStatus, onRetry: () => setSavedAttempt((n) => n + 1) }}
                    appliedId={activeSaved ? (activeModified ? undefined : activeSaved.id) : appliedTemplate?.id}
                    onApply={applyTemplate}
                    tab={templateTab}
                    onTabChange={setTemplateTab}
                    user={user}
                    headerAction={templateActions}
                    onEdit={(saved) => setTemplateDialog({ open: true, template: saved })}
                    onUpdate={(saved) => setTemplateConfirm({ kind: "update", template: saved })}
                    onDelete={(saved) => setTemplateConfirm({ kind: "delete", template: saved })}
                />

                <SourceSelector sources={config.sources} onToggle={actions.toggleSource} />

                <BrandScopeBar value={config.brandScope} onChange={actions.setBrandScope} sources={config.sources} />

                {hasFiscalPeriods && <ReportingPeriodBar value={period} onChange={setPeriod} range={range} />}

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
                        headerAction={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {scheduleButton}
                                {downloadButton}
                            </Box>
                        }
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

            <SaveTemplateDialog
                open={templateDialog.open}
                template={templateDialog.template}
                setup={currentSetup}
                period={periodNow}
                hasFilters={hasPivotFilters}
                onClose={() => setTemplateDialog({ open: false, template: null })}
                onSaved={handleTemplateSaved}
            />

            <ConfirmDialog
                open={Boolean(templateConfirm)}
                busy={templateBusy}
                title={templateConfirm?.kind === "delete" ? `Delete “${templateConfirm?.template.name}”?` : `Update “${templateConfirm?.template.name}”?`}
                message={templateConfirm?.kind === "delete"
                    ? `${templateConfirm?.template.visibility === "workspace" ? "It disappears for everyone in this workspace. " : ""}This can't be undone.`
                    : "Its columns and layout are replaced with the report currently on screen."}
                confirmLabel={templateConfirm?.kind === "delete" ? "Delete" : "Update template"}
                danger={templateConfirm?.kind === "delete"}
                onConfirm={() => (templateConfirm.kind === "delete" ? removeTemplate : overwriteTemplate)(templateConfirm.template)}
                onClose={() => setTemplateConfirm(null)}
            />

            <ScheduleReportDialog
                open={scheduleForm.open}
                schedule={scheduleForm.schedule}
                reportConfig={scheduledReport}
                reportName={scheduledReportName}
                onClose={() => setScheduleForm({ open: false, schedule: null })}
                onSaved={handleScheduleSaved}
            />

            <ReportSchedulesDialog
                open={schedulesOpen}
                onClose={closeSchedules}
                user={user}
                refreshKey={schedulesVersion}
                onEdit={(schedule) => setScheduleForm({ open: true, schedule })}
                notify={notify}
            />

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
