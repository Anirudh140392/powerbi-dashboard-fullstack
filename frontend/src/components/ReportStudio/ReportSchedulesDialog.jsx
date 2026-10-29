import React, { useCallback, useEffect, useState } from "react";
import {
    Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip, Typography,
} from "@mui/material";
import {
    Close as CloseIcon,
    DeleteOutline as DeleteIcon,
    EditOutlined as EditIcon,
    PauseCircleOutline as PauseIcon,
    PlayCircleOutline as ResumeIcon,
    SendOutlined as SendIcon,
} from "@mui/icons-material";
import {
    deleteReportSchedule, fetchReportSchedules, sendReportScheduleNow, setReportScheduleStatus,
} from "../../api/reportsService";
import { SOURCES_BY_ID } from "./reportStudioConfig";
import { DATE_WINDOWS, describeSchedule, formatSendTime } from "./scheduleOptions";

const LAST_STATUS = {
    sent: { label: "Sent", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
    partial: { label: "Partly sent", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    failed: { label: "Failed", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
    sending: { label: "Sending", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
};

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

function StatusChip({ status }) {
    const s = LAST_STATUS[status];
    if (!s) return <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>Not sent yet</Typography>;
    return <Chip label={s.label} size="small" sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, color: s.color, bgcolor: s.bg, border: `1px solid ${s.border}` }} />;
}

function ScheduleRow({ schedule, canManage, busy, onAction }) {
    const paused = schedule.status === "paused";
    const sources = schedule.reportConfig.sources.map((id) => SOURCES_BY_ID[id]?.label || id).join(", ");
    const recipients = schedule.recipients;
    const actionSx = { color: "#64748b", "&:hover": { color: "#2563eb", bgcolor: "#eff6ff" } };
    const manageTip = (label) => (canManage ? label : "Only the person who created this schedule or an admin can change it");

    return (
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", p: 1.5, border: "1px solid #e2e8f0", borderRadius: "12px", bgcolor: paused ? "#f8fafc" : "#ffffff", flexWrap: { xs: "wrap", sm: "nowrap" } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: paused ? "#64748b" : "#1e293b" }}>{schedule.name}</Typography>
                    {paused && <Chip label="Paused" size="small" sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: "#f1f5f9", color: "#64748b" }} />}
                </Box>
                <Typography sx={{ fontSize: "0.76rem", color: "#475569", mt: 0.25 }}>
                    {describeSchedule(schedule)} · {DATE_WINDOWS[schedule.dateWindow]} · {sources}
                </Typography>
                <Tooltip title={recipients.join(", ")} arrow placement="bottom-start">
                    <Typography noWrap sx={{ fontSize: "0.76rem", color: "#64748b", mt: 0.25 }}>
                        To {recipients.slice(0, 2).join(", ")}{recipients.length > 2 ? ` +${recipients.length - 2} more` : ""}
                        {!recipients.length && "no one (everyone unsubscribed)"}
                    </Typography>
                </Tooltip>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
                    <StatusChip status={schedule.lastStatus} />
                    {schedule.lastSentAt && <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>Last sent {schedule.lastSentAt.slice(0, 16)}</Typography>}
                    <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>
                        · Next: {paused ? "paused" : formatSendTime(schedule.nextSendAt)}
                    </Typography>
                </Box>
                {schedule.lastError && ["failed", "partial"].includes(schedule.lastStatus) && (
                    <Typography sx={{ fontSize: "0.72rem", color: "#b91c1c", mt: 0.5, wordBreak: "break-word" }}>{schedule.lastError}</Typography>
                )}
                <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8", mt: 0.5 }}>Created by {schedule.createdByName || schedule.createdBy}</Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                {busy ? (
                    <CircularProgress size={20} sx={{ m: 1 }} />
                ) : (
                    <>
                        <Tooltip title={manageTip("Send now")} arrow>
                            <span><IconButton size="small" disabled={!canManage || !recipients.length} onClick={() => onAction("send", schedule)} sx={actionSx}><SendIcon fontSize="small" /></IconButton></span>
                        </Tooltip>
                        <Tooltip title={manageTip(paused ? "Resume" : "Pause")} arrow>
                            <span>
                                <IconButton size="small" disabled={!canManage || (paused && !recipients.length)} onClick={() => onAction(paused ? "resume" : "pause", schedule)} sx={actionSx}>
                                    {paused ? <ResumeIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={manageTip("Edit")} arrow>
                            <span><IconButton size="small" disabled={!canManage} onClick={() => onAction("edit", schedule)} sx={actionSx}><EditIcon fontSize="small" /></IconButton></span>
                        </Tooltip>
                        <Tooltip title={manageTip("Delete")} arrow>
                            <span><IconButton size="small" disabled={!canManage} onClick={() => onAction("delete", schedule)} sx={{ ...actionSx, "&:hover": { color: "#dc2626", bgcolor: "#fef2f2" } }}><DeleteIcon fontSize="small" /></IconButton></span>
                        </Tooltip>
                    </>
                )}
            </Box>
        </Box>
    );
}

/**
 * The workspace's scheduled report emails. `refreshKey` reloads the list after
 * a schedule is saved elsewhere; `onEdit` opens the schedule form.
 */
export default function ReportSchedulesDialog({ open, onClose, user, refreshKey, onEdit, notify }) {
    const [schedules, setSchedules] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const load = useCallback(() => {
        setLoadError("");
        fetchReportSchedules()
            .then(setSchedules)
            .catch((err) => setLoadError(errorMessage(err, "Schedules couldn't be loaded.")));
    }, []);

    useEffect(() => {
        if (open) load();
    }, [open, refreshKey, load]);

    const email = String(user?.email || "").toLowerCase();
    const isAdmin = /admin|super/.test(String(user?.role || "").toLowerCase());
    const replace = (updated) => setSchedules((list) => list.map((s) => (s.id === updated.id ? updated : s)));

    const run = async (schedule, task) => {
        setBusyId(schedule.id);
        try {
            await task();
        } finally {
            setBusyId(null);
        }
    };

    const handleAction = (action, schedule) => {
        if (action === "edit") return onEdit(schedule);
        if (action === "delete") return setConfirmDelete(schedule);
        if (action === "send") {
            return run(schedule, async () => {
                try {
                    const result = await sendReportScheduleNow(schedule.id);
                    const rows = result.rows.toLocaleString("en-IN");
                    notify(result.status === "sent" ? "success" : "warning",
                        result.status === "sent"
                            ? `Sent "${schedule.name}" to ${schedule.recipients.length} ${schedule.recipients.length === 1 ? "recipient" : "recipients"} (${rows} rows)`
                            : `"${schedule.name}" reached only some recipients: ${result.error}`);
                } catch (err) {
                    notify("error", errorMessage(err, `"${schedule.name}" couldn't be sent.`));
                }
            });
        }
        return run(schedule, async () => {
            try {
                replace(await setReportScheduleStatus(schedule.id, action === "pause" ? "paused" : "active"));
            } catch (err) {
                notify("error", errorMessage(err, "The schedule couldn't be updated."));
            }
        });
    };

    const handleDelete = async () => {
        const schedule = confirmDelete;
        setConfirmDelete(null);
        await run(schedule, async () => {
            try {
                await deleteReportSchedule(schedule.id);
                setSchedules((list) => list.filter((s) => s.id !== schedule.id));
                notify("success", `Deleted "${schedule.name}"`);
            } catch (err) {
                notify("error", errorMessage(err, "The schedule couldn't be deleted."));
            }
        });
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: "16px" } }}>
                <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", pb: 0.5 }}>
                    Scheduled reports
                    <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon fontSize="small" /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.25, minHeight: 200 }}>
                    <Typography sx={{ fontSize: "0.8rem", color: "#64748b", mb: 0.5 }}>
                        Reports emailed on a schedule from this workspace. To add one, set up a report and click Schedule.
                    </Typography>
                    {loadError && (
                        <Alert severity="error" sx={{ borderRadius: "10px" }} action={<Button size="small" onClick={load}>Retry</Button>}>{loadError}</Alert>
                    )}
                    {!schedules && !loadError && (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress size={28} /></Box>
                    )}
                    {schedules?.length === 0 && (
                        <Box sx={{ textAlign: "center", py: 5, color: "#64748b" }}>
                            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155" }}>No scheduled reports yet</Typography>
                            <Typography sx={{ fontSize: "0.8rem", mt: 0.5 }}>Set up a report in Report Studio, then use Schedule to email it daily, weekly or monthly.</Typography>
                        </Box>
                    )}
                    {schedules?.map((schedule) => (
                        <ScheduleRow
                            key={schedule.id}
                            schedule={schedule}
                            canManage={isAdmin || schedule.createdBy === email}
                            busy={busyId === schedule.id}
                            onAction={handleAction}
                        />
                    ))}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} PaperProps={{ sx: { borderRadius: "14px" } }}>
                <DialogTitle sx={{ fontSize: "1rem", fontWeight: 800 }}>Delete “{confirmDelete?.name}”?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: "0.85rem", color: "#475569" }}>Its recipients will stop receiving this report. This can't be undone.</Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setConfirmDelete(null)} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
                    <Button onClick={handleDelete} variant="contained" color="error" sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}>Delete</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
