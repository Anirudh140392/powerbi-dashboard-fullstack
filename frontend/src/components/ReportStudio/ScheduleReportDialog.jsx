import React, { useEffect, useState } from "react";
import {
    Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { ScheduleSendOutlined as ScheduleIcon } from "@mui/icons-material";
import { createReportSchedule, updateReportSchedule } from "../../api/reportsService";
import { BRAND_SCOPES, FIELDS_BY_KEY, SOURCES_BY_ID } from "./reportStudioConfig";
import {
    DATE_WINDOWS, DEFAULT_DATE_WINDOW, describeSchedule, EMAIL_PATTERN, FREQUENCIES, MAX_RECIPIENTS, SEND_TIMES, WEEKDAYS,
} from "./scheduleOptions";

const sectionTitleSx = { fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(30, 41, 59, 0.5)", textTransform: "uppercase", mb: 0.75 };
const hintSx = { fontSize: "0.74rem", color: "#64748b", mt: 0.5 };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.85rem" } };

const segmentedSx = {
    display: "flex",
    flexWrap: "wrap",
    bgcolor: "#f1f5f9",
    borderRadius: "8px",
    p: "2px",
    "& .MuiToggleButton-root": {
        flex: 1,
        textTransform: "none",
        border: "none",
        borderRadius: "6px",
        py: 0.45,
        px: 1,
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "#64748b",
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#ffffff", color: "#1e293b", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)" },
    },
};

const emptyForm = (reportName) => ({
    name: reportName,
    recipients: [],
    frequency: "weekly",
    dayOfWeek: 1,
    dayOfMonth: 1,
    sendTime: "09:00",
    dateWindow: DEFAULT_DATE_WINDOW.weekly,
    subject: "",
    message: "",
});

const formFromSchedule = (s) => ({
    name: s.name,
    recipients: s.recipients,
    frequency: s.frequency,
    dayOfWeek: s.dayOfWeek || 1,
    dayOfMonth: s.dayOfMonth || 1,
    sendTime: s.sendTime,
    dateWindow: s.dateWindow,
    subject: s.subject || "",
    message: s.message || "",
});

/** Splits typed or pasted text ("a@x.com, b@y.com; c@z.com") into addresses. */
const splitEmails = (text) => text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);

function ReportSummary({ config }) {
    const sources = config.sources.map((id) => SOURCES_BY_ID[id]?.label || id).join(", ");
    const columns = config.columns.map((key) => FIELDS_BY_KEY[key]?.label || key);
    return (
        <Box sx={{ p: 1.25, border: "1px solid #e2e8f0", borderRadius: "10px", bgcolor: "#f8fafc" }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>{sources}</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#475569", mt: 0.25 }}>
                {columns.length} columns: {columns.join(", ")}
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#475569", mt: 0.25 }}>{BRAND_SCOPES[config.brandScope] || BRAND_SCOPES.own}</Typography>
        </Box>
    );
}

/**
 * Create or edit a scheduled report email. A new schedule emails the report
 * currently set up in Report Studio (`reportConfig`); editing keeps the
 * schedule's own report unless the user swaps in the current one.
 */
export default function ScheduleReportDialog({ open, onClose, schedule, reportConfig, reportName, onSaved }) {
    const editing = Boolean(schedule);
    const [form, setForm] = useState(() => emptyForm(reportName));
    const [windowTouched, setWindowTouched] = useState(false);
    const [recipientInput, setRecipientInput] = useState("");
    const [useCurrentReport, setUseCurrentReport] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Fresh form each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setForm(editing ? formFromSchedule(schedule) : emptyForm(reportName));
        setWindowTouched(editing);
        setRecipientInput("");
        setUseCurrentReport(false);
        setError("");
    }, [open, editing, schedule, reportName]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const config = editing && !useCurrentReport ? schedule.reportConfig : reportConfig;

    const setFrequency = (frequency) => set(windowTouched ? { frequency } : { frequency, dateWindow: DEFAULT_DATE_WINDOW[frequency] });

    const addRecipients = (text) => {
        const emails = splitEmails(text);
        if (!emails.length) return true;
        const invalid = emails.find((e) => !EMAIL_PATTERN.test(e));
        if (invalid) {
            setError(`"${invalid}" isn't a valid email address.`);
            return false;
        }
        setError("");
        set({ recipients: [...new Set([...form.recipients, ...emails])] });
        return true;
    };

    const handleSave = async () => {
        // An address still in the box counts, so it isn't silently dropped.
        let { recipients } = form;
        if (recipientInput.trim()) {
            const emails = splitEmails(recipientInput);
            const invalid = emails.find((e) => !EMAIL_PATTERN.test(e));
            if (invalid) {
                setError(`"${invalid}" isn't a valid email address.`);
                return;
            }
            recipients = [...new Set([...recipients, ...emails])];
        }
        if (!form.name.trim()) return setError("Give the schedule a name.");
        if (!recipients.length) return setError("Add at least one recipient.");
        if (recipients.length > MAX_RECIPIENTS) return setError(`Add at most ${MAX_RECIPIENTS} recipients.`);

        setSaving(true);
        setError("");
        try {
            const body = { ...form, recipients, reportConfig: config };
            const saved = editing ? await updateReportSchedule(schedule.id, body) : await createReportSchedule(body);
            onSaved(saved, { created: !editing });
        } catch (err) {
            setError(err.response?.data?.error || "The schedule couldn't be saved. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const recipientCount = form.recipients.length + splitEmails(recipientInput).length;

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "16px" } }}>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", pb: 1 }}>
                <ScheduleIcon sx={{ color: "#2563eb" }} />
                {editing ? "Edit scheduled report" : "Schedule this report"}
            </DialogTitle>

            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: "4px !important" }}>
                <Box>
                    <Typography sx={sectionTitleSx}>Report</Typography>
                    <ReportSummary config={config} />
                    {editing && (
                        <FormControlLabel
                            control={<Checkbox size="small" checked={useCurrentReport} onChange={(e) => setUseCurrentReport(e.target.checked)} />}
                            label={<Typography sx={{ fontSize: "0.8rem", color: "#334155" }}>Replace with the report currently set up in Report Studio</Typography>}
                            sx={{ mt: 0.5 }}
                        />
                    )}
                    <Typography sx={hintSx}>Emailed as a CSV of the report table. Pivot layouts aren't included.</Typography>
                </Box>

                <TextField label="Name" size="small" value={form.name} onChange={(e) => set({ name: e.target.value })} inputProps={{ maxLength: 120 }} sx={fieldSx} />

                <Box>
                    <Typography sx={sectionTitleSx}>Recipients</Typography>
                    <Autocomplete
                        multiple
                        freeSolo
                        options={[]}
                        value={form.recipients}
                        inputValue={recipientInput}
                        onInputChange={(_, value, reason) => {
                            // Typing a separator or pasting a list turns the text into chips.
                            if (reason === "input" && /[\s,;]$/.test(value)) {
                                if (addRecipients(value)) setRecipientInput("");
                                else setRecipientInput(value.trim());
                                return;
                            }
                            setRecipientInput(value);
                        }}
                        onChange={(_, value, reason) => {
                            if (reason === "createOption") {
                                if (addRecipients(value[value.length - 1])) setRecipientInput("");
                                return;
                            }
                            set({ recipients: value });
                        }}
                        onBlur={() => recipientInput.trim() && addRecipients(recipientInput) && setRecipientInput("")}
                        renderTags={(value, getTagProps) =>
                            value.map((email, index) => {
                                const { key, ...tagProps } = getTagProps({ index });
                                return <Chip key={key} {...tagProps} label={email} size="small" sx={{ fontSize: "0.76rem", bgcolor: "#eff6ff", color: "#1e40af" }} />;
                            })
                        }
                        renderInput={(params) => (
                            <TextField {...params} size="small" placeholder={form.recipients.length ? "" : "name@client.com, name@company.com"} sx={fieldSx} />
                        )}
                    />
                    <Typography sx={hintSx}>
                        Press Enter or comma after each address. Each person gets their own copy with an unsubscribe link.
                    </Typography>
                </Box>

                <Box>
                    <Typography sx={sectionTitleSx}>Frequency</Typography>
                    <ToggleButtonGroup exclusive size="small" value={form.frequency} onChange={(_, f) => f && setFrequency(f)} sx={segmentedSx}>
                        {Object.entries(FREQUENCIES).map(([id, label]) => (
                            <ToggleButton key={id} value={id}>{label}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    {form.frequency === "weekly" && (
                        <ToggleButtonGroup exclusive size="small" value={form.dayOfWeek} onChange={(_, d) => d && set({ dayOfWeek: d })} sx={{ ...segmentedSx, mt: 1 }}>
                            {WEEKDAYS.map((d) => (
                                <ToggleButton key={d.value} value={d.value} aria-label={d.label}>{d.short}</ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    )}

                    <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap" }}>
                        {form.frequency === "monthly" && (
                            <TextField select size="small" label="Day of month" value={form.dayOfMonth} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} sx={{ ...fieldSx, minWidth: 140 }}
                                SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 300 } } } }}>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                    <MenuItem key={d} value={d} sx={{ fontSize: "0.85rem" }}>{d}</MenuItem>
                                ))}
                            </TextField>
                        )}
                        <TextField select size="small" label="Send at (IST)" value={form.sendTime} onChange={(e) => set({ sendTime: e.target.value })} sx={{ ...fieldSx, minWidth: 140 }}
                            SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 300 } } } }}>
                            {SEND_TIMES.map((t) => (
                                <MenuItem key={t} value={t} sx={{ fontSize: "0.85rem" }}>{t}</MenuItem>
                            ))}
                        </TextField>
                        <TextField select size="small" label="Data covered" value={form.dateWindow}
                            onChange={(e) => {
                                setWindowTouched(true);
                                set({ dateWindow: e.target.value });
                            }}
                            sx={{ ...fieldSx, minWidth: 200, flex: 1 }}>
                            {Object.entries(DATE_WINDOWS).map(([id, label]) => (
                                <MenuItem key={id} value={id} sx={{ fontSize: "0.85rem" }}>{label}</MenuItem>
                            ))}
                        </TextField>
                    </Box>
                    {form.frequency === "monthly" && form.dayOfMonth > 28 && (
                        <Typography sx={hintSx}>In shorter months it sends on the last day.</Typography>
                    )}
                    <Typography sx={{ ...hintSx, color: "#334155", fontWeight: 600 }}>
                        {describeSchedule(form)}, covering {DATE_WINDOWS[form.dateWindow].toLowerCase()}
                        {recipientCount ? `, to ${recipientCount} ${recipientCount === 1 ? "recipient" : "recipients"}` : ""}.
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Email</Typography>
                    <TextField label="Subject (optional)" size="small" value={form.subject} onChange={(e) => set({ subject: e.target.value })}
                        placeholder={`${form.name || "Report"} · <dates covered>`} inputProps={{ maxLength: 200 }} sx={fieldSx} InputLabelProps={{ shrink: true }} />
                    <TextField label="Message (optional)" size="small" multiline minRows={2} maxRows={6} value={form.message}
                        onChange={(e) => set({ message: e.target.value })} inputProps={{ maxLength: 1000 }} sx={fieldSx} />
                </Box>

                {error && <Alert severity="error" sx={{ borderRadius: "10px", py: 0 }}>{error}</Alert>}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", fontWeight: 650, color: "#64748b" }}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, px: 2.5, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
                >
                    {editing ? "Save changes" : "Schedule report"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
