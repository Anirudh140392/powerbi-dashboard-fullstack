import React, { useState } from "react";
import { Box, Grid, Card, Typography, Chip } from "@mui/material";
import * as Icons from "lucide-react";

import performanceData from "../../utils/PerformanceMarketingData";
import HeatMapDrillTable from "./HeatMapDrillTable";

export default function MainPerformanceMarketings() {
  return (
    <Box sx={{ p: 3 }}>
      {/* HEADER */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        Performance Marketing Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Updated: {performanceData.last_updated}
      </Typography>

      {/* KPI CARDS */}
      <Grid container spacing={3}>
        {performanceData.kpi_cards.map((kpi, i) => {
          const Icon = Icons[kpi.icon];
          return (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card
                sx={{
                  p: 3,
                  height: 135,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "0.3s",
                  "&:hover": {
                    transform: "translateY(-6px)",
                    boxShadow: "0 12px 35px rgba(0,0,0,0.12)",
                  },
                }}
              >
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="subtitle2" color="text.secondary">
                    {kpi.label}
                  </Typography>
                  <Icon size={22} color="#6366F1" />
                </Box>

                <Typography variant="h4" fontWeight={700}>
                  {kpi.value}
                </Typography>

                <Chip
                  label={`${kpi.change} vs last month`}
                  color={kpi.positive ? "success" : "error"}
                  size="small"
                  sx={{ alignSelf: "flex-start" }}
                />
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* NEW HEATMAP (Tailwind + Framer Motion) */}
      <Box sx={{ mt: 4 }}>
        <HeatMapDrillTable />
      </Box>
    </Box>
  );
}
