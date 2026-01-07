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
    timeStart, timeEnd, comparisonLabel, platform, selectedBrand,
    zones, selectedZone, setZones, setSelectedZone
  } = useContext(FilterContext);

  const [selectedInsight, setSelectedInsight] = useState("All Campaign Summary");

  // Fetch Zones when brand changes (Performance Marketing page specific)
  useEffect(() => {
    const fetchZones = async () => {
      try {
        console.log("🚀 [MainPerformanceMarketing] Fetching zones for brand:", selectedBrand);
        const response = await axiosInstance.get("/performance-marketing/zones", {
          params: { brand: selectedBrand }
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
  }, [selectedBrand, setZones, setSelectedZone]);



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
      try {
        const response = await axiosInstance.get("/performance-marketing", {
          params: {
            platform: platform,
            brand: selectedBrand,
            zone: selectedZone, // Use zone instead of location for Performance Marketing
            startDate: timeStart?.format("YYYY-MM-DD"),
            endDate: timeEnd?.format("YYYY-MM-DD")
          }
        });
        console.log("Performance Marketing Data:", response.data);

        if (response.data?.kpi_cards) {
          const trendChart = response.data.trend_chart || [];

          // Helper to extract numeric values for sparkline
          // We'll take the last 12 points or all if less
          const getSparklineData = (key) => {
            if (!trendChart.length) return null;
            return trendChart.slice(-12).map(item => Number(item[key]) || 0);
          };

          const mappedCards = response.data.kpi_cards.map(card => {
            let sparkKey = "";
            // Map label to data key in trend_chart if possible
            // Assuming trend_chart has keys like: impressions, spend, cpm, ctr, etc.
            if (card.label.toLowerCase().includes("impression")) sparkKey = "impressions";
            else if (card.label.toLowerCase().includes("spend")) sparkKey = "spend";
            else if (card.label.toLowerCase().includes("roas")) sparkKey = "roas_roas";
            else if (card.label.toLowerCase().includes("conversion")) sparkKey = "cr_percentage";

            return {
              title: card.label,
              value: card.value,
              change: `${card.positive ? "▲" : "▼"} ${card.change}`, // Add arrow
              changeColor: card.positive ? "#28a745" : "#dc3545", // Green/Red
              sub: "", // Optional subtitle
              sparklineData: getSparklineData(sparkKey),
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
      }
    };

    if (timeStart && timeEnd) {
      fetchPerformanceData();
    }
  }, [timeStart, timeEnd, platform, selectedBrand, selectedZone]); // Added selectedZone to dependencies

  return (
    <Box>
      <Box sx={{ mt: 4 }}>
        <MetricCardContainer
          title="Performance Overview"
          cards={kpiCards.map(card => ({
            ...card,
            prevText: comparisonLabel
          }))}
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
