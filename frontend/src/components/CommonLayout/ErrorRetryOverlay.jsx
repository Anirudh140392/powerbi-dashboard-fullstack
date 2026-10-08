import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

/**
 * ErrorRetryOverlay — a reusable component that shows a refresh button
 * when an API call fails. Can be used as a full-area overlay or inline.
 *
 * Props:
 *  - onRetry: () => void  — callback to re-fetch
 *  - message?: string     — optional custom error message
 *  - compact?: boolean    — if true, renders a smaller inline version
 *  - minHeight?: string   — minimum height of the overlay (default "200px")
 */
export default function ErrorRetryOverlay({
    onRetry,
    message = "Something went wrong while loading data.",
    compact = false,
    minHeight = "200px",
}) {
    if (compact) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    py: 3,
                    px: 2,
                }}
            >
                <AlertTriangle size={16} color="#f59e0b" />
                <Typography sx={{ fontSize: "13px", color: "#64748b" }}>
                    {message}
                </Typography>
                <Button
                    size="small"
                    onClick={onRetry}
                    startIcon={<RefreshCw size={14} />}
                    sx={{
                        textTransform: "none",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6366f1",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        px: 1.5,
                        py: 0.5,
                        minWidth: "auto",
                        "&:hover": {
                            bgcolor: "#f1f5f9",
                            borderColor: "#6366f1",
                        },
                    }}
                >
                    Retry
                </Button>
            </Box>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight,
                padding: "32px 16px",
                textAlign: "center",
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "#fef3c7",
                    mb: 2,
                }}
            >
                <AlertTriangle size={28} color="#f59e0b" />
            </Box>

            <Typography
                sx={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                    mb: 0.5,
                }}
            >
                Failed to load
            </Typography>

            <Typography
                sx={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    mb: 2.5,
                    maxWidth: 300,
                }}
            >
                {message}
            </Typography>

            <Button
                variant="outlined"
                onClick={onRetry}
                startIcon={
                    <RefreshCw size={16} style={{ transition: "transform 0.3s" }} />
                }
                sx={{
                    textTransform: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#6366f1",
                    borderColor: "#c7d2fe",
                    borderRadius: "12px",
                    px: 3,
                    py: 1,
                    "&:hover": {
                        bgcolor: "#eef2ff",
                        borderColor: "#6366f1",
                        "& svg": { transform: "rotate(180deg)" },
                    },
                }}
            >
                Refresh
            </Button>
        </motion.div>
    );
}
