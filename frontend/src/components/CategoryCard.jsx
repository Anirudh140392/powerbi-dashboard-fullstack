import React from "react";
import {
  Paper,
  Box,
  Typography,
  Button,
  Divider,
  Stack,
} from "@mui/material";
import InsightsIcon from "@mui/icons-material/TipsAndUpdates";
import RcaIcon from "@mui/icons-material/Share";

export default function CategoryCard({ data, onViewSKUs }) {
  // Using the exact structure and styling of LocationCard, but supplying category `data` fields.
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
        <Typography sx={{ fontSize: "18px", fontWeight: 600 }}>{data.title}</Typography>
        <Button
          variant="outlined"
          size="small"
          sx={{ fontSize: "10px", textTransform: "none", height: 26 }}
          onClick={() => onViewSKUs?.(data)}
        >
          View SKUs &gt;
        </Button>
      </Box>

      {/* Offtake (mapped to Sales block style) */}
      <Box>
        <Typography sx={{ fontSize: "22px", fontWeight: 600 }}>{data.offtake}</Typography>
        <Typography sx={{ color: "green", fontSize: "12px" }}>▲ {data.trends} vs Comparison Period</Typography>
      </Box>

      {/* Units */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "14px" }}>
          # Units:
          <span style={{ marginLeft: "10px" }}>{data.units}</span>
        </Typography>
        {/* original category data didn't include growth values; keep styling but show nothing if absent */}
        {data.unitsGrowth || data.unitsGrowthValue ? (
          <Typography sx={{ color: "green", fontSize: "12px" }}>
            ▲ {data.unitsGrowth ?? ""}% ({data.unitsGrowthValue ?? ""}) vs Comparison Period
          </Typography>
        ) : null}
      </Box>

      <Divider sx={{ my: 1 }} />
       {/* Market share (mapped to Conversion block style) */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "18px" }}>{data.marketShare}</Typography>
        {data.marketShareGrowth ? (
          <Typography sx={{ color: "green", fontSize: "12px" }}>
            ▲ {data.marketShareGrowth}% ({data.marketShareValue ?? "0.00%"}) vs Comparison Period
          </Typography>
        ) : null}
      </Box>

       <Divider sx={{ my: 1 }} />

      {/* Impressions (kept similar) */}
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: "18px" }}>{data.impressions}</Typography>
        <Typography sx={{ fontSize: "12px" }}>{/* static comparison label */}vs Comparison Period</Typography>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Conversions (kept similar) */}

      <Box>
              <Typography sx={{ fontWeight: 600, fontSize: "18px" }}>
                {data.conversions}
              </Typography>
              <Typography sx={{ color: "green", fontSize: "12px" }}>
                ▲ {data.conversionGrowth}% (0.00%) vs Comparison Period
              </Typography>
            </Box>

     

      {/* Buttons */}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" sx={{ flex: 1, textTransform: "none" }}>
          <RcaIcon sx={{ fontSize: 18, mr: 1 }} />
          RCA
        </Button>
        <Button variant="outlined" sx={{ flex: 1, textTransform: "none" }}>
          <InsightsIcon sx={{ fontSize: 18, mr: 1 }} />
          Insights
        </Button>
      </Stack>

      <Button
        variant="text"
        sx={{ mt: 1, fontSize: "12px", textTransform: "none", color: "#1976d2" }}
      >
        View Trends &gt;
      </Button>
      <Button
        variant="text"
        sx={{ mt: 1, fontSize: "12px", textTransform: "none", color: "#1976d2" }}
      >
        Competition &gt;
      </Button>
      <Button
        variant="text"
        sx={{ mt: 1, fontSize: "12px", textTransform: "none", color: "#1976d2" }}
      >
        Cross Platform &gt;
      </Button>
    </Paper>
  );
}
