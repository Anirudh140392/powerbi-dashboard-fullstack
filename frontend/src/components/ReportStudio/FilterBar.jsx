import React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { FilterAltOutlined as FilterIcon } from "@mui/icons-material";
import MultiSelectSearchDropdown from "../CommonLayout/MultiSelectSearchDropdown";
import { FIELDS_BY_KEY, FILTER_FIELD_KEYS } from "./reportStudioConfig";
import { getFilterCoverage, isFilterActive } from "./reportStudioUtils";

const FloatingLabel = ({ children }) => (
    <Typography
        component="span"
        sx={{
            position: "absolute",
            top: "-8px",
            left: "10px",
            bgcolor: "#ffffff",
            px: "4px",
            fontSize: "11px",
            fontWeight: 600,
            color: "#64748b",
            lineHeight: 1,
            zIndex: 1,
        }}
    >
        {children}
    </Typography>
);

const staticTileSx = {
    height: "38px",
    px: 1.5,
    display: "flex",
    alignItems: "center",
    gap: 1,
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    bgcolor: "#f8fafc",
};

export default function FilterBar({ sources, filters, options, onChange, onClear }) {
    const visibleKeys = FILTER_FIELD_KEYS.filter((key) => getFilterCoverage(FIELDS_BY_KEY[key], sources).applied.length > 0);
    const activeCount = visibleKeys.filter((key) => isFilterActive(filters[key])).length;

    return (
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "16px", bgcolor: "#ffffff", p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <FilterIcon sx={{ fontSize: "1.1rem", color: "#2563eb" }} />
                        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>Filters</Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.75rem", color: "#64748b", mt: 0.25 }}>
                        Filters limit which records are included. Filtering by a field doesn't add it as a column.
                    </Typography>
                </Box>
                <Button
                    size="small"
                    onClick={onClear}
                    disabled={activeCount === 0}
                    sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem", color: "#64748b" }}
                >
                    Clear filters{activeCount > 0 ? ` (${activeCount})` : ""}
                </Button>
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1.5, rowGap: 2.5, mt: 2.5 }}>
                {visibleKeys.map((key) => {
                    const field = FIELDS_BY_KEY[key];
                    const { skipped } = getFilterCoverage(field, sources);
                    const values = options[key] || [];
                    return (
                        <Box key={key} sx={{ width: 170 }}>
                            {values.length > 0 ? (
                                <MultiSelectSearchDropdown
                                    label={field.label}
                                    options={values}
                                    value={filters[key] ?? "All"}
                                    onChange={(value) => onChange(key, value)}
                                    minWidth={170}
                                />
                            ) : (
                                <Box sx={{ position: "relative" }}>
                                    <FloatingLabel>{field.label}</FloatingLabel>
                                    <Box sx={staticTileSx}>
                                        <Typography sx={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>No values available</Typography>
                                    </Box>
                                </Box>
                            )}
                            {skipped.length > 0 && (
                                <Typography sx={{ fontSize: "0.66rem", color: "#94a3b8", mt: 0.4, pl: 0.5 }}>
                                    Not applied to {skipped.map((s) => s.toUpperCase()).join(", ")}
                                </Typography>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Paper>
    );
}
