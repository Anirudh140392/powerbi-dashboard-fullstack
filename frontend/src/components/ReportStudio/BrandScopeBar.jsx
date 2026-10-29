import React from "react";
import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { GroupsOutlined as BrandsIcon } from "@mui/icons-material";
import { BRAND_SCOPES } from "./reportStudioConfig";

const segmentedSx = {
    bgcolor: "#f1f5f9",
    borderRadius: "8px",
    p: "2px",
    "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        borderRadius: "6px",
        py: 0.35,
        px: 1.25,
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "#64748b",
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#ffffff", color: "#1e293b", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)" },
    },
};

/**
 * Whether the report covers own brands only or competitors too. Competitor rows
 * have availability, pricing and share data but no sales.
 */
export default function BrandScopeBar({ value, onChange, sources }) {
    const withCompetitors = value === "all";
    const notes = withCompetitors
        ? [
              "Add Brand or Brand Type to see competitors separately.",
              sources.includes("pdp") && "Offtake and Quantity Sold aren't tracked for competitors.",
              sources.includes("pm") && "Performance Marketing covers your own campaigns only.",
          ].filter(Boolean)
        : [];

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                columnGap: 1.5,
                rowGap: 1,
                flexWrap: "wrap",
                px: 1.5,
                py: 1,
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                bgcolor: "#ffffff",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <BrandsIcon sx={{ fontSize: "1.1rem", color: "#64748b" }} />
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 750, color: "#1e293b", whiteSpace: "nowrap" }}>Brands</Typography>
            </Box>

            <ToggleButtonGroup
                exclusive
                size="small"
                value={value}
                onChange={(_, scope) => scope && onChange(scope)}
                aria-label="Brands in the report"
                sx={segmentedSx}
            >
                {Object.entries(BRAND_SCOPES).map(([id, label]) => (
                    <ToggleButton key={id} value={id}>{label}</ToggleButton>
                ))}
            </ToggleButtonGroup>

            {notes.length > 0 && <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>{notes.join(" ")}</Typography>}
        </Box>
    );
}
