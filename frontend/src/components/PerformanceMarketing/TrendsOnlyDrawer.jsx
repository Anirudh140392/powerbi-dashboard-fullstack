import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  Button,
} from "@mui/material";
import { X } from "lucide-react";
import ReactECharts from "echarts-for-react";

/* -------------------------------------------------------------------------- */
/*                                KPI CONFIG                                  */
/* -------------------------------------------------------------------------- */

const KPIS = [
  {
    id: "spend_q1",
    label: "Spend (Q1)",
    color: "#2563EB",
    axis: "left",
  },
  {
    id: "m1_spend_q1",
    label: "M-1 Spend (Q1)",
    color: "#60A5FA",
    axis: "left",
  },
  {
    id: "m2_spend_q1",
    label: "M-2 Spend (Q1)",
    color: "#93C5FD",
    axis: "left",
  },
  {
    id: "conv_q1",
    label: "Conversion (Q1)",
    color: "#16A34A",
    axis: "right",
    isPercent: true,
  },
  {
    id: "m1_conv_q1",
    label: "M-1 Conv (Q1)",
    color: "#4ADE80",
    axis: "right",
    isPercent: true,
  },
  {
    id: "m2_conv_q1",
    label: "M-2 Conv (Q1)",
    color: "#86EFAC",
    axis: "right",
    isPercent: true,
  },
];

/* -------------------------------------------------------------------------- */
/*                               MOCK DATA                                    */
/* -------------------------------------------------------------------------- */

const TREND_DATA = [
  {
    date: "06 Sep",
    spend_q1: 164,
    m1_spend_q1: 203,
    m2_spend_q1: 256,
    conv_q1: 3.0,
    m1_conv_q1: 3.3,
    m2_conv_q1: 3.2,
  },
  {
    date: "10 Sep",
    spend_q1: 158,
    m1_spend_q1: 198,
    m2_spend_q1: 245,
    conv_q1: 2.8,
    m1_conv_q1: 3.1,
    m2_conv_q1: 3.0,
  },
  {
    date: "14 Sep",
    spend_q1: 151,
    m1_spend_q1: 190,
    m2_spend_q1: 235,
    conv_q1: 2.6,
    m1_conv_q1: 2.9,
    m2_conv_q1: 2.8,
  },
  {
    date: "18 Sep",
    spend_q1: 149,
    m1_spend_q1: 187,
    m2_spend_q1: 228,
    conv_q1: 2.7,
    m1_conv_q1: 2.8,
    m2_conv_q1: 2.7,
  },
  {
    date: "21 Sep",
    spend_q1: 162,
    m1_spend_q1: 195,
    m2_spend_q1: 240,
    conv_q1: 3.2,
    m1_conv_q1: 3.5,
    m2_conv_q1: 3.3,
  },
  {
    date: "25 Sep",
    spend_q1: 147,
    m1_spend_q1: 182,
    m2_spend_q1: 220,
    conv_q1: 2.5,
    m1_conv_q1: 2.7,
    m2_conv_q1: 2.6,
  },
  {
    date: "30 Sep",
    spend_q1: 140,
    m1_spend_q1: 176,
    m2_spend_q1: 215,
    conv_q1: 2.4,
    m1_conv_q1: 2.6,
    m2_conv_q1: 2.5,
  },
];

/* -------------------------------------------------------------------------- */
/*                           TRENDS ONLY DRAWER                                */
/* -------------------------------------------------------------------------- */

export default function TrendsOnlyDrawer({
  open,
  onClose,
  selectedKpi,
}) {
  const [activeKpis, setActiveKpis] = useState(
    selectedKpi ? [selectedKpi] : KPIS.map((k) => k.id)
  );

  const chartOption = useMemo(() => {
    const xData = TREND_DATA.map((d) => d.date);

    const series = KPIS.filter((k) => activeKpis.includes(k.id)).map(
      (k) => ({
        name: k.label,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        yAxisIndex: k.axis === "right" ? 1 : 0,
        lineStyle: { width: 2 },
        itemStyle: { color: k.color },
        data: TREND_DATA.map((d) => d[k.id]),
      })
    );

    return {
      grid: { left: 60, right: 80, top: 30, bottom: 40 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: xData,
        boundaryGap: false,
      },
      yAxis: [
        {
          type: "value",
          splitLine: { lineStyle: { color: "#F3F4F6" } },
        },
        {
          type: "value",
          min: 0,
          max: 5,
          axisLabel: { formatter: "{value}%" },
          splitLine: { show: false },
        },
      ],
      legend: { show: false },
      series,
    };
  }, [activeKpis]);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(15,23,42,0.35)",
        zIndex: 1500,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: 2,
      }}
    >
      <Box
        sx={{
          mt: 4,
          width: "min(1100px, 100%)",
          bgcolor: "white",
          borderRadius: 3,
          boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
          p: 3,
        }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            {selectedKpi
              ? KPIS.find((k) => k.id === selectedKpi)?.label
              : "KPI Trends"}
          </Typography>

          <IconButton size="small" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </Box>

        {/* KPI Chips */}
        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
          {KPIS.map((k) => (
            <Chip
              key={k.id}
              label={k.label}
              onClick={() =>
                setActiveKpis((prev) =>
                  prev.includes(k.id)
                    ? prev.filter((x) => x !== k.id)
                    : [...prev, k.id]
                )
              }
              sx={{
                borderRadius: "999px",
                backgroundColor: activeKpis.includes(k.id)
                  ? `${k.color}22`
                  : "#F3F4F6",
                color: k.color,
                fontWeight: 500,
              }}
            />
          ))}
        </Box>

        {/* Chart */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid #E5E7EB",
            p: 2,
          }}
        >
          <Box sx={{ height: 360 }}>
            <ReactECharts option={chartOption} style={{ height: "100%" }} />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
