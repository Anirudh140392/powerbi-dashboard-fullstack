import React from "react";
import { Box, Card, Chip, Typography, useTheme } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { TrendingUpIcon } from "lucide-react";

export default function PerformanceMatric() {
  const theme = useTheme();

  const metrics = [
    {
      title: "Share of Search",
      value: "25%",
      mom: "-1.3%",
      momUp: false,
      yoy: "0.0%",
      yoyUp: true,
      data: [5, 8, 6, 10, 7, 9, 6],
    },
    {
      title: "Inorganic Sales",
      value: "11%",
      mom: "5.4%",
      momUp: true,
      yoy: "0.0%",
      yoyUp: true,
      data: [2, 4, 5, 6, 8, 7, 9],
    },
    {
      title: "Conversion",
      value: "0.6%",
      mom: "28.0%",
      momUp: true,
      yoy: "0.0%",
      yoyUp: true,
      data: [1, 2, 1, 3, 2, 4, 3],
    },
    {
      title: "ROAS",
      value: "2.1",
      mom: "10.5%",
      momUp: true,
      yoy: "0.0%",
      yoyUp: true,
      data: [4, 6, 5, 7, 8, 7, 9],
    },
    {
      title: "BMI / Sales Ratio",
      value: "5%",
      mom: "-4.6%",
      momUp: false,
      yoy: "-81.3%",
      yoyUp: false,
      data: [10, 8, 7, 6, 5, 4, 3],
    },
  ];

  return (
    <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TrendingUpIcon fontSize="small" />
        </Box>

        <Typography variant="h6" fontWeight={600}>
          Performance Marketing
        </Typography>

        <Chip label="All" size="small" variant="outlined" />
      </Box>

      {/* Metrics Cards */}
      <Box
        display="flex"
        gap={2}
        sx={{
          width: "100%",
          overflowX: "auto",
          paddingTop: "20px",
        }}
      >
        {metrics.map((m, index) => (
          <Card
            key={index}
            sx={{
              minWidth: 260,
              borderRadius: 4,
              padding: 2,
              boxShadow: "0px 2px 5px rgba(0,0,0,0.12)",
            }}
          >
            {/* Title & Value */}
            <Typography variant="body2" color="text.secondary">
              {m.title}
            </Typography>

            <Typography fontSize={26} fontWeight={700} mt={0.5}>
              {m.value}
            </Typography>

            {/* Sparkline Chart */}
            <Box sx={{ width: "100%", height: 70, mt: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={m.data.map((v) => ({ value: v }))}
                  margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                >
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#4CAF50"
                    fill="rgba(76, 175, 80, 0.25)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>

            {/* MOM */}
            <Box display="flex" alignItems="center" gap={0.5} mt={1}>
              <Typography fontSize={14}>MoM Change:</Typography>
              <Typography
                fontSize={14}
                fontWeight={600}
                color={m.momUp ? "green" : "red"}
              >
                {m.mom}
              </Typography>

              {m.momUp ? (
                <ArrowUpwardIcon sx={{ fontSize: 16, color: "green" }} />
              ) : (
                <ArrowDownwardIcon sx={{ fontSize: 16, color: "red" }} />
              )}
            </Box>

            {/* YOY */}
            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
              <Typography fontSize={14}>YoY Change:</Typography>
              <Typography
                fontSize={14}
                fontWeight={600}
                color={m.yoyUp ? "green" : "red"}
              >
                {m.yoy}
              </Typography>

              {m.yoyUp ? (
                <ArrowUpwardIcon sx={{ fontSize: 16, color: "green" }} />
              ) : (
                <ArrowDownwardIcon sx={{ fontSize: 16, color: "red" }} />
              )}
            </Box>
          </Card>
        ))}
      </Box>
    </Card>
  );
}
