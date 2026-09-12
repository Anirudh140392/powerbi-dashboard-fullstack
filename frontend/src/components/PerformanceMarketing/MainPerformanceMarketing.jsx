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
    channels, selectedChannel,
    locations, selectedLocation, setLocations, setSelectedLocation,
    platforms, platform, setPlatforms, setPlatform,
    categories, selectedCategory, setCategories, setSelectedCategory,
    brands, selectedBrand,
    selectedProductCategory
  } = useContext(FilterContext);

  const [selectedInsight, setSelectedInsight] = useState("All Campaign Summary");
  const [loading, setLoading] = useState(false); // Loading state for cards

  // Fetch PM-specific Platforms on mount
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        console.log("🚀 [MainPerformanceMarketing] Fetching PM platforms...");
        const response = await axiosInstance.get("/performance-marketing/platforms");
        console.log("✅ [MainPerformanceMarketing] PM Platforms:", response.data);

        if (response.data && response.data.length > 0) {
          const platformList = response.data.filter(p => p !== 'All');
          setPlatforms(platformList);
          if (!platformList.includes(platform) && platform !== 'All') {
            setPlatform("All");
          }
        } else {
          setPlatforms([]);
        }
      } catch (error) {
        console.error("❌ [MainPerformanceMarketing] Error fetching PM platforms:", error);
        setPlatforms([]);
      }
    };
    fetchPlatforms();
  }, [setPlatforms, setPlatform]);

  // Fetch PM-specific Categories when platform changes
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log("🚀 [MainPerformanceMarketing] Fetching PM categories for platform:", platform);
        const response = await axiosInstance.get("/performance-marketing/categories", {
          params: { platform: Array.isArray(platform) ? platform.join(',') : platform }
        });
        console.log("✅ [MainPerformanceMarketing] PM Categories:", response.data);

        if (response.data && response.data.length > 0) {
          const catList = [...response.data];
          setCategories(catList);

          // Keep current selection if valid, otherwise default to "All" (which is the SELECT ALL state)
          if (selectedCategory !== "All" && !catList.includes(selectedCategory)) {
            setSelectedCategory("All");
          }
        } else {
          setCategories([]); // No categories found
          setSelectedCategory("All");
        }
      } catch (error) {
        console.error("❌ [MainPerformanceMarketing] Error fetching PM categories:", error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, [platform, setCategories, setSelectedCategory]);

  // Fetch Zones when category changes (Performance Marketing page specific)
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const catParam = Array.isArray(selectedCategory) ? selectedCategory.join(',') : selectedCategory;
        console.log("🚀 [MainPerformanceMarketing] Fetching zones for category:", catParam);
        const response = await axiosInstance.get("/performance-marketing/zones", {
          params: { brand: catParam } // Zones API still expects 'brand' param naming in current implementation, but we'll send it category values
        });
        console.log("✅ [MainPerformanceMarketing] Zones API Response:", response.data);

        if (response.data && response.data.length > 0) {
          const zoneList = response.data.filter(z => z !== 'All');
          setLocations(zoneList);

          // Reset selection if current zone is not in new list
          if (selectedLocation !== 'All' && !zoneList.includes(selectedLocation)) {
            setSelectedLocation("All");
          }
        } else {
          console.warn("⚠️ [MainPerformanceMarketing] No zones found, keeping existing locations.");
          // Don't overwrite - let FilterContext's own locations stay
        }
      } catch (error) {
        console.error("❌ [MainPerformanceMarketing] Error fetching zones:", error);
        // Don't overwrite global locations on error
      }
    };

    fetchLocations();
  }, [selectedCategory, setLocations, setSelectedLocation]);



  // Default to the mock data for initial render
  const [kpiCards, setKpiCards] = useState([
    {
      title: "Impressions", value: "9.1k", change: "▲ 12.4%", changeColor: "#28a745", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
    {
      title: "Conversion", value: "1.8%", change: "▲ 0.4%", changeColor: "#28a745", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
    {
      title: "Spend", value: "6500", change: "▼ 5.0%", changeColor: "#dc3545", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
    {
      title: "ROAS", value: "3.12", change: "▲ 2.1%", changeColor: "#28a745", sparklineData: null,
      prevTextStyle: { fontSize: 10, fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", color: "#94a3b8", ml: 1 }
    },
  ]);

  // Comparison label now comes from FilterContext dynamically

  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(true); // Start loading
      try {
        const params = {
          channel: Array.isArray(selectedChannel) ? selectedChannel.join(',') : (selectedChannel || 'All'),
          platform: Array.isArray(platform) ? platform.join(',') : (platform || 'All'),
          category: Array.isArray(selectedCategory) ? selectedCategory.join(',') : selectedCategory,
          brand: Array.isArray(selectedBrand) ? selectedBrand.join(',') : selectedBrand,
          zone: Array.isArray(selectedLocation) ? selectedLocation.join(',') : selectedLocation,
          location: Array.isArray(selectedLocation) ? selectedLocation.join(',') : selectedLocation,
          productCategory: Array.isArray(selectedProductCategory) ? selectedProductCategory.join(',') : selectedProductCategory,
          startDate: timeStart?.format("YYYY-MM-DD"),
          endDate: timeEnd?.format("YYYY-MM-DD")
        }
        const response = await axiosInstance.get("/performance-marketing", {
          params
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
              labels: trendChart.map(item => {
                const datePart = dayjs(item.date).format("MMM DD");
                return item.label ? `${datePart} (${item.label})` : datePart;
              })
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
  }, [timeStart, timeEnd, selectedChannel, platform, selectedCategory, selectedBrand, selectedLocation, selectedProductCategory]); // Updated dependencies

  return (
    <Box>
      <Box sx={{ mt: 4 }}>
        <MetricCardContainer
          title="Performance Overview"
          helpMenu="Performance Marketing"
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
  )
}
