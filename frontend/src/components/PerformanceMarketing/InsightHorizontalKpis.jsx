import React, { useState, useEffect, useContext } from "react";
import { Box, Grid, Card, Typography, Skeleton } from "@mui/material";
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
  const [loading, setLoading] = useState(true);

  // Convert arrays to strings for proper dependency tracking
  const platformStr = JSON.stringify(pmSelectedPlatform);
  const brandStr = JSON.stringify(pmSelectedBrand);
  const zoneStr = JSON.stringify(selectedZone);

  // Fetch quadrant data when filters change
  useEffect(() => {
    console.log("🔄 [InsightHorizontalKpis] Filters changed, fetching data...", {
      platform: pmSelectedPlatform,
      brand: pmSelectedBrand,
      zone: selectedZone,
      timeStart: timeStart?.format("YYYY-MM-DD"),
      timeEnd: timeEnd?.format("YYYY-MM-DD")
    });

    const fetchQuadrants = async () => {
      setLoading(true);
      const startTime = Date.now();
      try {
        const response = await axiosInstance.get("/performance-marketing/quadrants", {
          params: {
            platform: Array.isArray(pmSelectedPlatform) ? pmSelectedPlatform.join(',') : pmSelectedPlatform,
            brand: Array.isArray(pmSelectedBrand) ? pmSelectedBrand.join(',') : pmSelectedBrand,
            zone: Array.isArray(selectedZone) ? selectedZone.join(',') : selectedZone,
            startDate: timeStart?.format("YYYY-MM-DD"),
            endDate: timeEnd?.format("YYYY-MM-DD")
          }
        });
        console.log("✅ [InsightHorizontalKpis] Quadrants:", response.data);
        setQuadrantData(response.data);
      } catch (error) {
        console.error("❌ [InsightHorizontalKpis] Error fetching quadrants:", error);
      } finally {
        // Ensure minimum 500ms loading time so skeleton is visible
        const elapsed = Date.now() - startTime;
        const minDelay = 500;
        if (elapsed < minDelay) {
          setTimeout(() => setLoading(false), minDelay - elapsed);
        } else {
          setLoading(false);
        }
      }
    };

    if (timeStart && timeEnd) {
      fetchQuadrants();
    }
  }, [timeStart, timeEnd, platformStr, brandStr, zoneStr]);

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

      {/* Mobile: Stack | Tablet: 2 cols | Desktop: 5 cols */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(5, 1fr)",
          },
        }}
      >
        {loading ? (
          // Skeleton cards when loading
          Array.from({ length: 5 }).map((_, idx) => (
            <Card
              key={`skeleton-${idx}`}
              sx={{
                p: { xs: 2, sm: 2.5 },
                minHeight: 140,
                borderRadius: 3,
                border: "1px solid #f1f5f9",
                bgcolor: "#fcfdfe",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Top row - title and icon */}
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="circular" width={22} height={22} />
              </Box>

              {/* Middle rows - lines */}
              <Box>
                <Skeleton variant="text" width="50%" height={18} />
                <Skeleton variant="text" width="30%" height={18} />
              </Box>

              {/* Bottom area - large block */}
              <Skeleton variant="rounded" width="100%" height={40} sx={{ borderRadius: 2 }} />
            </Card>
          ))
        ) : (
          // Actual cards when data is loaded
          insightKPIs.map((item) => {
            const Icon = Icons[item.icon];
            const active = selectedInsight === item.label;

            return (
              <Card
                key={item.key}
                onClick={() => setSelectedInsight(item.label)}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  minHeight: 140,
                  borderRadius: 3,
                  border: "1.5px solid",
                  borderColor: active ? "indigo.500" : "#f1f5f9",
                  bgcolor: active ? "indigo.50/30" : "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 24px -8px rgba(79, 70, 229, 0.15)",
                    borderColor: active ? "indigo.500" : "indigo.200",
                  },
                  ...(active && {
                    boxShadow: "0 8px 20px -6px rgba(79, 70, 229, 0.2)",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "4px",
                      height: "100%",
                      bgcolor: "indigo.500",
                    }
                  })
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography
                    sx={{
                      fontSize: { xs: 12, sm: 13 },
                      fontWeight: 700,
                      color: active ? "indigo.900" : "slate.700",
                      lineHeight: 1.2
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      bgcolor: active ? "indigo.100/50" : "slate.50",
                      display: "flex",
                    }}
                  >
                    <Icon size={18} color={active ? "#4F46E5" : item.color} />
                  </Box>
                </Box>

                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{
                    color: active ? "indigo.600" : "slate.900",
                    fontSize: { xs: "1.5rem", sm: "1.75rem" },
                    my: 1
                  }}
                >
                  {item.value}
                </Typography>

                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: active ? "indigo.500" : "slate.500",
                    textTransform: "uppercase",
                    letterSpacing: "0.025em"
                  }}
                >
                  {item.description}
                </Typography>
              </Card>
            );
          })
        )}
      </Box>
    </Card>
  );
}
