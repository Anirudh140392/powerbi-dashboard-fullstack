import React from "react";
import { Paper, Box, Typography, Button, Divider, Stack } from "@mui/material";
import InsightsIcon from "@mui/icons-material/TipsAndUpdates";
import RcaIcon from "@mui/icons-material/Share";

const LocationCard = ({
  title,
  sales,
  salesGrowth,
  salesGrowthValue,
  units,
  unitsGrowth,
  unitsGrowthValue,
  impressions,
  impressionsGrowth,
  conversion,
  conversionGrowth,
  onViewTrends,     // <-- ADDED
}) => {
  return (
    <Paper
      elevation={2}
      sx={{
        width: 310,
        p: 2,
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: "18px", fontWeight: 600 }}>
          {title}
        </Typography>
        <Button variant="outlined" size="small" sx={{ fontSize: "10px" }}>
          View SKUs &gt;
        </Button>
      </Box>

      {/* Sales */}
      <Box>
        <Typography sx={{ fontSize: "22px", fontWeight: 600 }}>
          {sales}
        </Typography>
        <Typography sx={{ color: "green", fontSize: "12px" }}>
          ▲ {salesGrowth}% ({salesGrowthValue}) vs Comparison Period
        </Typography>
      </Box>

      {/* Units */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "14px" }}>
          # Units: <span style={{ marginLeft: "10px" }}>{units}</span>
        </Typography>
        <Typography sx={{ color: "green", fontSize: "12px" }}>
          ▲ {unitsGrowth}% ({unitsGrowthValue}) vs Comparison Period
        </Typography>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Impressions */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "18px" }}>
          {impressions}
        </Typography>
        <Typography sx={{ fontSize: "12px" }}>vs Comparison Period</Typography>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Conversion */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "18px" }}>
          {conversion}
        </Typography>
        <Typography sx={{ color: "green", fontSize: "12px" }}>
          ▲ {conversionGrowth}% (0.00%) vs Comparison Period
        </Typography>
      </Box>

      {/* Buttons */}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" sx={{ flex: 1 }}>
          <RcaIcon sx={{ fontSize: 18, mr: 1 }} /> RCA
        </Button>
        <Button variant="outlined" sx={{ flex: 1 }}>
          <InsightsIcon sx={{ fontSize: 18, mr: 1 }} /> Insights
        </Button>
      </Stack>

      {/* Trends button */}
      <Button
        variant="text"
        sx={{ mt: 1, fontSize: "12px", color: "#1976d2" }}
        onClick={onViewTrends}       // <-- FIX HERE
      >
        View Trends &gt;
      </Button>
    </Paper>
  );
};

export default LocationCard;
