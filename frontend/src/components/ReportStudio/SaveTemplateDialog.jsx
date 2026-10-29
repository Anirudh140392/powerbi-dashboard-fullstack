import React, { useEffect, useState } from "react";
import {
    Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
    Switch, TextField, Typography,
} from "@mui/material";
import { BookmarkAddOutlined as SaveIcon } from "@mui/icons-material";
import { createReportTemplate, updateReportTemplate } from "../../api/reportsService";
import { ReportSummary } from "./ScheduleReportDialog";
import { describePeriod } from "./savedTemplates";

const hintSx = { fontSize: "0.74rem", color: "#64748b", mt: 0.25 };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.85rem" } };
const optionLabel = (title, hint) => (
    <Box>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: "#1e293b" }}>{title}</Typography>
        <Typography sx={hintSx}>{hint}</Typography>
    </Box>
);

/**
 * Save the report on screen as a new template, or (with `template`) edit a
 * saved template's name, description and sharing. `setup` is the current
 * report: { view, sources, columns, brandScope, pivot }; `period` the current
 * relative date range, or null.
 */
export default function SaveTemplateDialog({ open, onClose, template, setup, period, hasFilters, onSaved }) {
    const editing = Boolean(template);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [shared, setShared] = useState(false);
    const [includeFilters, setIncludeFilters] = useState(false);
    const [includePeriod, setIncludePeriod] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setName(editing ? template.name : "");
        setDescription(editing ? template.description || "" : "");
        setShared(editing ? template.visibility === "workspace" : false);
        setIncludeFilters(false);
        setIncludePeriod(false);
        setError("");
    }, [open, editing, template]);

    const handleSave = async () => {
        if (!name.trim()) return setError("Give the template a name.");
        setSaving(true);
        setError("");
        try {
            const details = { name, description, visibility: shared ? "workspace" : "private" };
            const saved = editing
                ? await updateReportTemplate(template.id, details)
                : await createReportTemplate({ ...details, config: { ...setup, includeFilters, period: includePeriod ? period : null } });
            onSaved(saved, { created: !editing });
        } catch (err) {
            setError(err.response?.data?.error || "The template couldn't be saved. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "16px" } }}>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", pb: 1 }}>
                <SaveIcon sx={{ color: "#2563eb" }} />
                {editing ? "Edit template" : "Save as template"}
            </DialogTitle>

            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "4px !important" }}>
                {!editing && (
                    <Box>
                        <ReportSummary config={setup} />
                        <Typography sx={hintSx}>
                            {setup.view === "custom" ? "Saves the columns and the pivot layout." : "Saves the columns. Opens in the table view."}
                        </Typography>
                    </Box>
                )}

                <TextField label="Name" size="small" autoFocus value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 80 }} sx={fieldSx} />
                <TextField label="Description (optional)" size="small" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this report shows" inputProps={{ maxLength: 200 }} sx={fieldSx} InputLabelProps={{ shrink: true }} />

                <FormControlLabel
                    control={<Switch checked={shared} onChange={(e) => setShared(e.target.checked)} />}
                    label={optionLabel("Share with workspace", shared ? "Everyone in this workspace can apply it. Only you or an admin can change it." : "Only you can see it.")}
                    sx={{ alignItems: "flex-start", ml: 0, gap: 1, "& .MuiSwitch-root": { mt: -0.5 } }}
                />

                {!editing && (hasFilters || period) && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {hasFilters && (
                            <FormControlLabel
                                control={<Checkbox size="small" checked={includeFilters} onChange={(e) => setIncludeFilters(e.target.checked)} />}
                                label={optionLabel("Include pivot filters", "Keeps the values you've hidden in the pivot.")}
                                sx={{ alignItems: "flex-start", ml: 0, gap: 0.5, "& .MuiCheckbox-root": { p: 0.25 } }}
                            />
                        )}
                        {period && (
                            <FormControlLabel
                                control={<Checkbox size="small" checked={includePeriod} onChange={(e) => setIncludePeriod(e.target.checked)} />}
                                label={optionLabel(`Include date range: ${describePeriod(period).toLowerCase()}`, "Applying the template moves the report dates to the latest data.")}
                                sx={{ alignItems: "flex-start", ml: 0, gap: 0.5, "& .MuiCheckbox-root": { p: 0.25 } }}
                            />
                        )}
                    </Box>
                )}

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
                    {editing ? "Save changes" : "Save template"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
