import React, { useState, useEffect, useRef, useContext } from "react";
import { Box, Grid, Card, Typography, Chip } from "@mui/material";
import * as Icons from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";

import performanceData from "../../utils/PerformanceMarketingData";
import HeatMapDrillTable from "./HeatMapDrillTable";
import InsightHorizontalKpis from "./InsightHorizontalKpis";
import DrilldownLatestTable from "./DrilldownLatestTable";
import KeywordAnalysisTable from "./KeywordAnalysisTable";

import MetricCardContainer from "../CommonLayout/MetricCardContainer";

export default function MainPerformanceMarketings() {
  const {
    timeStart, timeEnd, comparisonLabel,
    zones, selectedZone, setZones, setSelectedZone,
    pmPlatforms, pmSelectedPlatform, setPmPlatforms, setPmSelectedPlatform,
    pmBrands, pmSelectedBrand, setPmBrands, setPmSelectedBrand
  } = useContext(FilterContext);

  const [selectedInsight, setSelectedInsight] = useState("All Campaign Summary");
  const [loading, setLoading] = useState(false); // Loading state for cards

  // Fetch PM-specific Platforms on mount
  useEffect(() => {
    const fetchPmPlatforms = async () => {
      try {
        console.log("🚀 [MainPerformanceMarketing] Fetching PM platforms...");
        const response = await axiosInstance.get("/performance-marketing/platforms");
        console.log("✅ [MainPerformanceMarketing] PM Platforms:", response.data);

        if (response.data && response.data.length > 0) {
          const platformList = ["All", ...response.data];
          setPmPlatforms(platformList);
          if (!platformList.includes(pmSelectedPlatform)) {
            setPmSelectedPlatform("All");
          }
        } else {
          setPmPlatforms(["All"]);
        }
      } catch (error) {
        console.error("❌ [MainPerformanceMarketing] Error fetching PM platforms:", error);
        setPmPlatforms(["All"]);
      }
    };
    fetchPmPlatforms();
  }, [setPmPlatforms, setPmSelectedPlatform]);

  // Fetch PM-specific Brands when platform changes
  useEffect(() => {
    const fetchPmBrands = async () => {
      try {
        console.log("🚀 [MainPerformanceMarketing] Fetching PM brands for platform:", pmSelectedPlatform);
        const response = await axiosInstance.get("/performance-marketing/brands", {
          params: { platform: Array.isArray(pmSelectedPlatform) ? pmSelectedPlatform.join(',') : pmSelectedPlatform }
        });
        console.log("✅ [MainPerformanceMarketing] PM Brands:", response.data);

        if (response.data && response.data.length > 0) {
          const brandList = ["All", ...response.data];
          setPmBrands(brandList);
          if (!brandList.includes(pmSelectedBrand)) {
            setPmSelectedBrand("All");
          }
        } else {
          setPmBrands(["All"]);
          setPmSelectedBrand("All");
        }
      } catch (error) {
        console.error("❌ [MainPerformanceMarketing] Error fetching PM brands:", error);
        setPmBrands(["All"]);
      }
    };
    fetchPmBrands();
  }, [pmSelectedPlatform, setPmBrands, setPmSelectedBrand]);

  // Fetch Zones when brand changes (Performance Marketing page specific)
  useEffect(() => {
    const fetchZones = async () => {
      try {
        console.log("🚀 [MainPerformanceMarketing] Fetching zones for brand:", pmSelectedBrand);
        const response = await axiosInstance.get("/performance-marketing/zones", {
          params: { brand: Array.isArray(pmSelectedBrand) ? pmSelectedBrand.join(',') : pmSelectedBrand }
        });
        console.log("✅ [MainPerformanceMarketing] Zones API Response:", response.data);

        if (response.data && response.data.length > 0) {
          const zoneList = ["All", ...response.data];
          setZones(zoneList);

          // Reset selection if current zone is not in new list
          if (!zoneList.includes(selectedZone)) {
            setSelectedZone("All");
          }
        } else {
          console.warn("⚠️ [MainPerformanceMarketing] No zones found, setting ['All'].");
          setZones(["All"]);
          setSelectedZone("All");
        }
      } catch (error) {
        console.error("❌ [MainPerformanceMarketing] Error fetching zones:", error);
        setZones(["All"]);
      }
    };

    fetchZones();
  }, [pmSelectedBrand, setZones, setSelectedZone]);



  // Default to the mock data for initial render
  const [kpiCards, setKpiCards] = useState([
    {
      title: "Impressions", value: "91", change: "▲ 10.4%", changeColor: "#28a745", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
    {
      title: "Conversion", value: "1%", change: "▲ 0.1%", changeColor: "#28a745", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
    {
      title: "Spend", value: "65", change: "▼ 18.0%", changeColor: "#dc3545", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
    {
      title: "ROAS", value: "3", change: "▼ 0.0", changeColor: "#dc3545", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
  ]);

  // Comparison label now comes from FilterContext dynamically

  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(true); // Start loading
      try {
        const response = await axiosInstance.get("/performance-marketing", {
          params: {
            platform: Array.isArray(pmSelectedPlatform) ? pmSelectedPlatform.join(',') : pmSelectedPlatform,
            brand: Array.isArray(pmSelectedBrand) ? pmSelectedBrand.join(',') : pmSelectedBrand,
            zone: Array.isArray(selectedZone) ? selectedZone.join(',') : selectedZone,
            startDate: timeStart?.format("YYYY-MM-DD"),
            endDate: timeEnd?.format("YYYY-MM-DD")
          }
        });
        console.log("Performance Marketing Data:", response.data);

        if (response.data?.kpi_cards) {
          const trendChart = response.data.trend_chart || [];

          // Helper to extract numeric values for sparkline
          // We'll take all points to show the selected range accurately
          const getTrendSeries = (key) => {
            if (!trendChart.length) return { values: [], labels: [] };
            return {
              values: trendChart.map(item => Number(item[key]) || 0),
              labels: trendChart.map(item => dayjs(item.date).format("MMM DD"))
            };
          };

          const mappedCards = response.data.kpi_cards.map(card => {
            let sparkKey = "";
            // Map label to data key in trend_chart if possible
            if (card.label.toLowerCase().includes("impression")) sparkKey = "impressions";
            else if (card.label.toLowerCase().includes("spend")) sparkKey = "spend";
            else if (card.label.toLowerCase().includes("roas")) sparkKey = "roas_roas";
            else if (card.label.toLowerCase().includes("conversion")) sparkKey = "cr_percentage";

            const trendData = getTrendSeries(sparkKey);

            return {
              title: card.label,
              value: card.value,
              change: `${card.positive ? "▲" : "▼"} ${card.change}`, // Add arrow
              changeColor: card.positive ? "#28a745" : "#dc3545", // Green/Red
              sub: "", // Optional subtitle
              sparklineData: trendData.values,
              months: trendData.labels,
              prevTextStyle: {
                fontSize: 10,
                fontWeight: "bold",
                fontStyle: "italic",
                textTransform: "uppercase",
                color: "#94a3b8",
                ml: 1,
              }
            };
          });
          setKpiCards(mappedCards);
        }
      } catch (error) {
        console.error("Error fetching Performance Marketing data:", error);
      } finally {
        setLoading(false); // Stop loading
      }
    };

    if (timeStart && timeEnd) {
      fetchPerformanceData();
    }
  }, [timeStart, timeEnd, pmSelectedPlatform, pmSelectedBrand, selectedZone]); // Updated dependencies

  return (
    <Box>
      <Box sx={{ mt: 4 }}>
        <MetricCardContainer
          title="Performance Overview"
          cards={kpiCards.map(card => ({
            ...card,
            prevText: comparisonLabel
          }))}
          loading={loading} // Pass loading state
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
      <Box sx={{ mt: 4 }}>
        <DrilldownLatestTable />
      </Box>
    </Box>
  );
};
