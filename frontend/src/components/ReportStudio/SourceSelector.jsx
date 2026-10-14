import React from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { CheckBox as CheckBoxIcon, CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon } from "@mui/icons-material";
import { REPORT_SOURCES } from "./reportStudioConfig";

export default function SourceSelector({ sources, onToggle }) {
    return (
        <Box
            role="group"
            aria-label="Data sources"
            sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}
        >
            {REPORT_SOURCES.map((source) => {
                const selected = sources.includes(source.id);
                const Icon = selected ? CheckBoxIcon : CheckBoxOutlineBlankIcon;
                return (
                    <ButtonBase
                        key={source.id}
                        role="checkbox"
                        aria-checked={selected}
                        title={source.description}
                        onClick={() => onToggle(source.id)}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 1,
                            px: 1.5,
                            py: 1.1,
                            textAlign: "left",
                            borderRadius: "12px",
                            border: "1px solid",
                            borderColor: selected ? source.accent : "#e2e8f0",
                            bgcolor: selected ? source.tint : "#ffffff",
                            boxShadow: selected ? `0 0 0 1px ${source.accent}` : "0 1px 2px rgba(15, 23, 42, 0.04)",
                            transition: "all 0.15s ease",
                            "&:hover": { borderColor: selected ? source.accent : "#94a3b8" },
                            "&.Mui-focusVisible": { outline: `2px solid ${source.accent}`, outlineOffset: 2 },
                        }}
                    >
                        <Icon sx={{ fontSize: "1.2rem", color: selected ? source.accent : "#cbd5e1" }} />
                        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#1e293b", minWidth: 0 }} noWrap>
                            {source.label}
                        </Typography>
                    </ButtonBase>
                );
            })}
        </Box>
    );
}
