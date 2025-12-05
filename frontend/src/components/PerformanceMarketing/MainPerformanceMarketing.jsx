import React, { useState, useEffect, useRef } from "react";
import { Box, Grid, Card, Typography, Chip } from "@mui/material";
import * as Icons from "lucide-react";
import axiosInstance from "../../api/axiosInstance";

import performanceData from "../../utils/PerformanceMarketingData";
import HeatMapDrillTable from "./HeatMapDrillTable";
import InsightHorizontalKpis from "./InsightHorizontalKpis";
import KeywordAnalysisTable from "./KeywordAnalysisTable";
import CardMetric from "../../components/ControlTower/WatchTower/CardMetric";
import MetricCardContainer from "../CommonLayout/MetricCardContainer";

const kpi_cards = [
  {
    title: "Impressions",
    value: "1.2M",
    sub: "Total ad impressions",
    change: "▲3.5%",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Campaign reach improving",
    extraChange: "▲3.5%",
    extraChangeColor: "green",
    icon: "BarChart3",
  },
  {
    title: "Direct Conv.",
    value: "3.5%",
    sub: "Conversion rate (direct)",
    change: "▲0.8%",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Steady improvement in funnel",
    extraChange: "▲0.8%",
    extraChangeColor: "green",
    icon: "TrendingUp",
  },
  {
    title: "Spend",
    value: "₹9.4M",
    sub: "Advertising spend (MTD)",
    change: "▼1.2%",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Cost efficiency improving",
    extraChange: "▼1.2%",
    extraChangeColor: "red",
    icon: "ShoppingCart",
  },
  {
    title: "New Users",
    value: "22.9k",
    sub: "New customers acquired",
    change: "▲4.1%",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Strong user acquisition",
    extraChange: "▲4.1%",
    extraChangeColor: "green",
    icon: "Users",
  },
];

export default function MainPerformanceMarketings() {
  const calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;

    const fetchPerformanceData = async () => {
      try {
        const response = await axiosInstance.get('/performance-marketing', {
          params: { platform: 'Blinkit' } // Default filter
        });
        console.log("Performance Marketing Data:", response.data);
      } catch (error) {
        console.error("Error fetching Performance Marketing data:", error);
      }
    };

    fetchPerformanceData();
  }, []);

  return (
    <Box>


          {/* 👉 Replace KPI Grid with the new CardMetric */}
          <MetricCardContainer title="Performance Overview" cards={kpi_cards} />

      <Box sx={{ mt: 4 }}>
        <InsightHorizontalKpis />
      </Box>
      {/* NEW HEATMAP (Tailwind + Framer Motion) */}
      <Box sx={{ mt: 4 }}>
        <HeatMapDrillTable />
      </Box>
      <Box sx={{ mt: 4 }}>
        <KeywordAnalysisTable />
      </Box>
    </Box>
  );
}
