import React from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

/** A yes/no question before a change that can't be undone from the UI. */
export default function ConfirmDialog({ open, title, message, confirmLabel, danger = false, busy = false, onConfirm, onClose }) {
    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} PaperProps={{ sx: { borderRadius: "14px", maxWidth: 440 } }}>
            <DialogTitle sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b" }}>{title}</DialogTitle>
            <DialogContent>
                <Typography sx={{ fontSize: "0.85rem", color: "#475569" }}>{message}</Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: "#64748b" }}>Cancel</Button>
                <Button
                    onClick={onConfirm}
                    disabled={busy}
                    variant="contained"
                    color={danger ? "error" : "primary"}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                    sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
