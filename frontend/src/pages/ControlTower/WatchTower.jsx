import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../../api/axiosInstance";
import { Container, Box, useTheme } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";

function TabButton({ label, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      onClick={onClick}
      sx={{
        py: 2,
        cursor: "pointer",
        borderBottom: active
          ? `3px solid ${theme.palette.primary.main}`
          : "3px solid transparent",
        color: active
          ? theme.palette.primary.main
          : theme.palette.text.secondary,
        fontWeight: 700,
        fontSize: "0.85rem",
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Box component="span" sx={{ fontSize: "1.1rem" }}>
        ▦
      </Box>
      <Box component="span">{label}</Box>
    </Box>
  );
}

import PlatformOverview from "../../components/ControlTower/WatchTower/PlatformOverview";
import CategoryTable from "../../components/ControlTower/WatchTower/CategoryTable";
import SKUTable from "../../components/ControlTower/WatchTower/SKUTable";
import MyTrendsDrawer from "../../components/ControlTower/WatchTower/MyTrendsDrawer";
import CardMetric from "../../components/ControlTower/WatchTower/CardMetric";
import {
  allCategories,
  allProducts,
  defaultBrands,
  defaultCategory,
  defaultMonths,
  defaultPlatforms,
  defaultSkus,
} from "../../utils/DataCenter";
import PerformanceMatric from "../../components/ControlTower/WatchTower/PeformanceMatric";
import { FilterContext } from "../../utils/FilterContext";
import Loader from "../../components/CommonLayout/Loader";

export default function WatchTower() {
  const [showTrends, setShowTrends] = useState(false);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    platform: "Zepto",
    months: 6,
    timeStep: "Monthly",
  });

  const [activeTab, setActiveTab] = useState("Split by Category");
  const [activeKpisTab, setActiveKpisTab] = useState("Platform Overview");

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "Zepto",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  const handleViewTrends = (card) => {
    console.log("card clicked", card);

    const series =
      card.chart?.map((v, i) => {
        let date;

        if (trendParams.timeStep === "Monthly") {
          const d = new Date();
          d.setMonth(d.getMonth() - (card.chart.length - 1 - i));
          date = d.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          });
        } else if (trendParams.timeStep === "Weekly") {
          const d = new Date();
          d.setDate(d.getDate() - 7 * (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        } else {
          const d = new Date();
          d.setDate(d.getDate() - (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        }

        return { date, offtake: v };
      }) ?? [];

    setTrendData({
      timeSeries: series,
      metrics: {},
    });

    setTrendParams((prev) => ({
      ...prev,
      platform: card.name ?? "Zepto",
    }));

    setShowTrends(true);
  };

  const [dashboardData, setDashboardData] = useState({
    summaryMetrics: {
      offtakes: "₹0 Cr",
      offtakesTrend: "+0.0%",
      shareOfSearch: "0%",
      shareOfSearchTrend: "0%",
      stockAvailability: "0%",
      stockAvailabilityTrend: "0%",
      marketShare: "0%",
    },

    topMetrics: [],
    skuTable: [],
  });

  const { selectedBrand, timeStart, timeEnd, compareStart, compareEnd, platform, selectedKeyword, selectedLocation } = React.useContext(FilterContext);

  // Update filters when context changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      platform: platform,
      brand: selectedBrand,
      keyword: selectedKeyword,
      location: selectedLocation,
      startDate: timeStart ? timeStart.format('YYYY-MM-DD') : null,
      endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : null,
      compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
      compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
    }));
  }, [selectedBrand, timeStart, timeEnd, compareStart, compareEnd, platform, selectedKeyword, selectedLocation]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get("/watchtower", {
          params: filters,
        });
        if (response.data) {
          console.log("Fetched Watch Tower data:", response.data);
          setDashboardData(response.data);
        }
      } catch (error) {
        console.error("Error fetching Watch Tower data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]); // Refetch when filters change

  return (
    <>
      <CommonContainer
        title="Watch Tower"
        filters={filters}
        onFiltersChange={setFilters}
      >
        {/* Top Cards */}
        {loading ? (
          <Loader message="Fetching Watch Tower Insights..." />
        ) : (
          <CardMetric
            data={dashboardData.topMetrics}
            onViewTrends={handleViewTrends}
          />
        )}

        {/* Top Cards */}
        <PerformanceMatric />

        {/* Platform Overview */}
        {/* Tabs */}
        <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
            mb: 4,
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
            <Box sx={{ display: "flex", gap: 4 }}>
              <TabButton
                label="By Platfrom"
                active={activeKpisTab === "Platform Overview"}
                onClick={() => setActiveKpisTab("Platform Overview")}
              />

              <TabButton
                label="By Month"
                active={activeKpisTab === "Month Overview"}
                onClick={() => setActiveKpisTab("Month Overview")}
              />

              <TabButton
                label="By Category"
                active={activeKpisTab === "Category Overview"}
                onClick={() => setActiveKpisTab("Category Overview")}
              />

              <TabButton
                label="By Brands"
                active={activeKpisTab === "Brands Overview"}
                onClick={() => setActiveKpisTab("Brands Overview")}
              />

              <TabButton
                label="By Skus"
                active={activeKpisTab === "Skus Overview"}
                onClick={() => setActiveKpisTab("Skus Overview")}
              />
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            <PlatformOverview
              onViewTrends={handleViewTrends}
              data={
                activeKpisTab === "Platform Overview"
                  ? defaultPlatforms
                  : activeKpisTab === "Category Overview"
                    ? defaultCategory
                    : activeKpisTab === "Month Overview"
                      ? defaultMonths
                      : activeKpisTab === "Brands Overview"
                        ? defaultBrands
                        : activeKpisTab === "Skus Overview"
                          ? defaultSkus
                          : []
              }
              activeKpisTab={activeKpisTab}
            />
            {/* defaultMonths
defaultCategory */}
          </Box>
        </Box>

        {/* Category / SKU Tabs */}
        <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
            mb: 4,
          }}
        >
          {/* Tabs */}
          {/* <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
            <Box sx={{ display: "flex", gap: 4 }}>
              <TabButton
                label="Split by Category"
                active={activeTab === "Split by Category"}
                onClick={() => setActiveTab("Split by Category")}
              />

              <TabButton
                label="Split by SKUs"
                active={activeTab === "Split by SKUs"}
                onClick={() => setActiveTab("Split by SKUs")}
              />
            </Box>
          </Box> */}

          {/* <Box sx={{ p: 3 }}>
            <CategoryTable
              categories={
                activeTab === "Split by Category" ? allCategories : allProducts
              }
              activeTab={activeTab}
            />
          </Box> */}

          {/* {activeTab === "sku" && (
            <Box sx={{ p: 3 }}>
              <SKUTable data={dashboardData.skuTable} />
            </Box>
          )} */}
        </Box>
      </CommonContainer>

      {/* Trend Drawer */}
      <MyTrendsDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        trendData={trendData}
        trendParams={trendParams}
      />
    </>
  );
}
