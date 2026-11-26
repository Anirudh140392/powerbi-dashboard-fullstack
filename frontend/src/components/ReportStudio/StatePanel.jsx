import React from "react";
import { Box, Typography } from "@mui/material";

export default function StatePanel({ icon, tone = "#94a3b8", title, message, action }) {
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
