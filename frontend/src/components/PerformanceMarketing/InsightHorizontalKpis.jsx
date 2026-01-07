import React, { useState, useEffect, useContext } from "react";
import { Box, Grid, Card, Typography } from "@mui/material";
import * as Icons from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";

// KPI metadata (labels, descriptions, icons, colors)
const quadrantMeta = {
  total: {
    label: "All Campaign Summary",
    description: "All Product Summary",
    icon: "BarChart3",
    color: "#111",
  },
  Q1: {
    label: "Q1 - Performing Well",
    description: "Continue",
    icon: "TrendingUp",
    color: "#E91E63",
  },
  Q2: {
    label: "Q2 - Need Attention",
    description: "Optimize",
    icon: "AlertTriangle",
    color: "#F4C430",
  },
  Q3: {
    label: "Q3 - Experiment",
    description: "Optimize then Scale",
    icon: "FlaskConical",
    color: "#E57342",
  },
  Q4: {
    label: "Q4 - Opportunity",
    description: "Scale Up Spends",
    icon: "TrendingUp",
    color: "#1E88E5",
  },
};

export default function InsightHorizontalKpis({
  selectedInsight = "All Campaign Summary",
  setSelectedInsight = () => { },
}) {
  const {
    timeStart, timeEnd,
    pmSelectedPlatform, pmSelectedBrand, selectedZone
  } = useContext(FilterContext);

  const [quadrantData, setQuadrantData] = useState({
    total: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0
  });

  // Fetch quadrant data when filters change
  useEffect(() => {
    const fetchQuadrants = async () => {
      try {
        const response = await axiosInstance.get("/performance-marketing/quadrants", {
          params: {
            platform: pmSelectedPlatform,
            brand: pmSelectedBrand,
            zone: selectedZone,
            startDate: timeStart?.format("YYYY-MM-DD"),
            endDate: timeEnd?.format("YYYY-MM-DD")
          }
        });
        console.log("✅ [InsightHorizontalKpis] Quadrants:", response.data);
        setQuadrantData(response.data);
      } catch (error) {
        console.error("❌ [InsightHorizontalKpis] Error fetching quadrants:", error);
      }
    };

    if (timeStart && timeEnd) {
      fetchQuadrants();
    }
  }, [timeStart, timeEnd, pmSelectedPlatform, pmSelectedBrand, selectedZone]);

  // Build KPI cards from data
  const insightKPIs = [
    { key: "total", value: quadrantData.total, ...quadrantMeta.total },
    { key: "Q1", value: quadrantData.Q1, ...quadrantMeta.Q1 },
    { key: "Q2", value: quadrantData.Q2, ...quadrantMeta.Q2 },
    { key: "Q3", value: quadrantData.Q3, ...quadrantMeta.Q3 },
    { key: "Q4", value: quadrantData.Q4, ...quadrantMeta.Q4 },
  ];

  return (
    <Card sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
      <Typography variant="h6" fontWeight={700}>
        Actionable & Insights
      </Typography>

      <Box sx={{ height: 1, borderBottom: "1px solid #e5e7eb", my: 2 }} />

      <Typography
        variant="subtitle1"
        fontWeight={700}
        sx={{ bgcolor: "#f8fafc", p: 1.2, borderRadius: 2, mb: 2 }}
      >
        {selectedInsight}
      </Typography>

      <Grid container spacing={2}>
        {insightKPIs.map((item) => {
          const Icon = Icons[item.icon];
          const active = selectedInsight === item.label;

          return (
            <Grid item xs={12} sm={6} md={2.4} key={item.key}>
              <Card
                onClick={() => setSelectedInsight(item.label)}
                sx={{
                  p: 2,
                  height: 140,
                  borderRadius: 3,
                  border: active ? "1px solid #6366F2" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transform: active && "scale(1.03)",
                  boxShadow: active && "0 10px 35px rgba(0,0,0,0.12)",
                  transition: "0.25s",
                  "&:hover": {
                    transform: active ? "scale(1.03)" : "translateY(-6px)",
                    boxShadow: "0 10px 35px rgba(0,0,0,0.12)",
                  },
                }}
              >
                <Box display="flex" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                  <Icon size={22} color={item.color} />
                </Box>

                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{ color: item.color }}
                >
                  {item.value}
                </Typography>

                <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>
                  {item.description}
                </Typography>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Card>
  );
}
