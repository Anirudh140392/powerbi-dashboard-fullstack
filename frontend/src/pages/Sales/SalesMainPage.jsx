import React from "react";
import { Box, Typography, Divider } from "@mui/material";

export default function SalesMainPage() {
  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        padding: "24px",
        backgroundColor: "#0f172a", // match dark theme
      }}
    >
      {/* ---------------- Page Header ---------------- */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, color: "#e5e7eb" }}
        >
          Sales
        </Typography>

        <Typography
          variant="body2"
          sx={{ color: "#94a3b8", mt: 0.5 }}
        >
          Sales performance, trends and contribution analysis
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "#1e293b", mb: 3 }} />

      {/* ---------------- Filters Section (Empty) ---------------- */}
      <Box
        sx={{
          mb: 3,
          minHeight: "60px",
          borderRadius: "8px",
          border: "1px dashed #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        Filters will come here
      </Box>

      {/* ---------------- KPI Cards Section (Empty) ---------------- */}
      <Box
        sx={{
          mb: 3,
          minHeight: "120px",
          borderRadius: "8px",
          border: "1px dashed #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        KPI cards will come here
      </Box>

      {/* ---------------- Charts Section (Empty) ---------------- */}
      <Box
        sx={{
          mb: 3,
          minHeight: "220px",
          borderRadius: "8px",
          border: "1px dashed #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        Charts & trends will come here
      </Box>

      {/* ---------------- Table Section (Empty) ---------------- */}
      <Box
        sx={{
          minHeight: "260px",
          borderRadius: "8px",
          border: "1px dashed #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        Sales table / drill-down will come here
      </Box>
    </Box>
  );
}
