import React, { useState, useEffect, useRef } from "react";
import { Box, Grid, Card, Typography, Chip } from "@mui/material";
import * as Icons from "lucide-react";
import axiosInstance from "../../api/axiosInstance";

import performanceData from "../../utils/PerformanceMarketingData";
import HeatMapDrillTable from "./HeatMapDrillTable";
import InsightHorizontalKpis from "./InsightHorizontalKpis";
import KeywordAnalysisTable from "./KeywordAnalysisTable";
import MetricCardContainer from "../CommonLayout/MetricCardContainer";

const cards = [
  {
    title: "Impressions",
    value: "65.2%",
    sub: "MTD on-shelf coverage",
    change: "▲3.1 pts (from 82.1%)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "High risk stores: 12",
    extraChange: "▼4 stores",
    extraChangeColor: "green",
  },
  {
    title: "Direct Conv",
    value: "52.4",
    sub: "Network average days of cover",
    change: "▼5.3% (from 65.9)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Target band: 55–65 days",
    extraChange: "Within target range",
    extraChangeColor: "green",
  },
  {
    title: "Spend",
    value: "43.7%",
    sub: "Supplier fulfillment rate",
    change: "▲1.8 pts (from 91.9%)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Orders delayed: 6%",
    extraChange: "▼1.2 pts",
    extraChangeColor: "green",
  },
  {
    title: "New Users",
    value: "60.5%",
    sub: "MTD availability across metro cities",
    change: "▼2.0 pts (from 80.5%)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "Top 10 stores: 84.2%",
    extraChange: "▲0.6 pts",
    extraChangeColor: "green",
  },
];

export default function MainPerformanceMarketings() {
  const calledOnce = useRef(false);
  const [selectedInsight, setSelectedInsight] = useState("All Campaign Summary");

  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;

    const fetchPerformanceData = async () => {
      try {
        const response = await axiosInstance.get("/performance-marketing", {
          params: { platform: "Blinkit" }, // Default filter
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
      {/* <Box>
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid #e2e8f0",
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            kpis overview
          </Typography>
          <Box sx={{ height: 1, borderBottom: "1px solid #e5e7eb", my: 2 }} />
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
        </Card>
      </Box> */}
      <Box sx={{ mt: 4 }}>
        <MetricCardContainer
          title="Performance Marketing Overview"
          cards={cards}
        />
      </Box>
      <Box sx={{ mt: 4 }}>
        <InsightHorizontalKpis
          selectedInsight={selectedInsight}
          setSelectedInsight={setSelectedInsight}
        />
      </Box>
      {/* NEW HEATMAP (Tailwind + Framer Motion) */}
      <Box sx={{ mt: 4 }}>
        <HeatMapDrillTable selectedInsight={selectedInsight} />
      </Box>
      <Box sx={{ mt: 4 }}>
        <KeywordAnalysisTable />
      </Box>
    </Box>
  );
}
