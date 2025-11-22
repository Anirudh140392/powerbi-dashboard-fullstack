

import React, { useState } from "react";
import { Container, Typography, Box } from "@mui/material";

import Navbar from "../components/Navbar";
import Header from "../components/Header";
import TopMetricCard from "../components/TopMetricCard";
import PlatformOverview from "../components/PlatformOverview";
import CategoryMetricsSection from "../components/CategoryMetricsSection";
import CategoryTable from "../components/CategoryTable";
import SKUTable from "../components/SKUTable";
import MyTrendsDrawer from "../components/MyTrendsDrawer";
import CardMetric from "../components/CardMetric";

//import dashboardData from "../../../backend/src/controllers/dashboardController";

export default function Dashboard() {
  const [showTrends, setShowTrends] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("category");
  const [dashboardData, setDashboardData] = useState({
    summaryMetrics: {
      offtakes: "₹5.1 Cr",
      offtakesTrend: "+1.5%",
      shareOfSearch: "39.4%",
      shareOfSearchTrend: "-2.0%",
      stockAvailability: "96.3%",
      stockAvailabilityTrend: "+4.2%",
      marketShare: "32.1%"
    },
    
    topMetrics: [
      {
        label: "₹5.1 Cr",
        subtitle: "for MTD",
        trend: "+1.5% (₹7.3 lac)",
        trendType: "up",
        comparison: "vs Previous Month",
        units: "2.9 lac",
        unitsTrend: "-2.1%",
        chart: [0.6, 1.2, 1.6, 2.0, 2.2, 2.0, 2.4, 2.5] // mini line points
      },
      {
        label: "39.4%",
        subtitle: "for MTD",
        trend: "-2.0% (-0.8%)",
        trendType: "down",
        comparison: "vs Previous Month",
        units: "",
        unitsTrend: "",
        chart: [20, 28, 34, 36, 38, 39, 39.5, 39.4]
      },
      {
        label: "26.5%",
        subtitle: "for MTD",
        trend: "+62.2% (10.2%)",
        trendType: "up",
        comparison: "vs Previous Month",
        units: "",
        unitsTrend: "",
        chart: [10, 12, 14, 16, 18, 20, 22, 26.5]
      }
    ],

    skuTable: [
      { sku: "Colgate Visible White 02 Whitening Toothpaste - 100g", all: { offtake: "₹8.8 lac", trend: "+3.0%" }, blinkit: { offtake: "₹5.3 lac", trend: "+7.6%" }, zepto: { offtake: "₹2.5 lac", trend: "-1.4%" }, instamart: { offtake: "₹3.4 lac", trend: "+5.2%" } },
      { sku: "Colgate Sensitive Toothbrush (Ultra Soft) - 4 units", all: { offtake: "₹8.4 lac", trend: "-1.4%" }, blinkit: { offtake: "₹4.0 lac", trend: "-18.9%" }, zepto: { offtake: "₹4.4 lac", trend: "+22.2%" }, instamart: { offtake: "NA", trend: "NA" } },
      { sku: "Colgate Gentle Sensitive Soft Bristles Toothbrush - 1 piece", all: { offtake: "₹7.9 lac", trend: "-2.0%" }, blinkit: { offtake: "₹3.5 lac", trend: "-12.8%" }, zepto: { offtake: "₹2.5 lac", trend: "+1.9%" }, instamart: { offtake: "₹1.9 lac", trend: "+5.1%" } },
      // more rows for scroll
      ...Array.from({ length: 12 }).map((_, i) => ({
        sku: `Colgate SKU Sample ${i + 1}`,
        all: { offtake: `₹${(7 - i) > 0 ? (7 - i) + '.0 lac' : (i + 1) + '.0 lac'}`, trend: `${i % 2 ? '+1.0%' : '-0.5%'}` },
        blinkit: { offtake: `₹${(i + 1) * 0.4} lac`, trend: `${i % 2 ? '+0.5%' : '-0.2%'}` },
        zepto: { offtake: `₹${(i + 1) * 0.25} lac`, trend: `${i % 3 ? '+0.3%' : '-0.7%'}` },
        instamart: { offtake: `₹${(i + 1) * 0.15} lac`, trend: `${i % 2 ? '+0.9%' : '-0.4%'}` }
      }))
    ]
  });

  const [filters, setFilters] = useState({
    platform: "Blinkit",
    months: 6,
    timeStep: "Monthly"
  });

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "Blinkit"
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {}
  });

  const handlePlatformChange = (platform) => {
    setFilters((prev) => ({
      ...prev,
      platform
    }));
  };

  const handleViewTrends = (card) => {
    console.log('card', card)
    // Use miniature chart array to make timeSeries
    const series = card.chart?.map((v, i) => {
      const now = new Date();

      let date;

      if (trendParams.timeStep === "Monthly") {
        const dt = new Date();
        dt.setMonth(dt.getMonth() - (card.chart.length - 1 - i));
        date = dt.toLocaleString("default", { month: "short", year: "2-digit" }); // Example: Jan 25
      }

      else if (trendParams.timeStep === "Weekly") {
        const dt = new Date();
        dt.setDate(dt.getDate() - (7 * (card.chart.length - 1 - i)));
        date = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); // Example: 12 Jan
      }

      else {
        // Daily
        const dt = new Date();
        dt.setDate(dt.getDate() - (card.chart.length - 1 - i));
        date = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      }

      return { date, offtake: v };
    }) || [];


    setTrendData({
      timeSeries: series,
      metrics: {} // Not needed for now
    });


    setTrendParams((prev) => ({
      ...prev,
      platform: card.name
    }));

    setShowTrends(true);
  };

  return (
    <>
      <Box sx={{ display: "flex", bgcolor: "#f5f5f5", minHeight: "100vh" }}>
        {/* Left Sidebar */}
        <Navbar
          platforms={["Blinkit", "Instamart", "Zepto"]}
          selectedPlatform={filters.platform}
          onPlatformChange={handlePlatformChange}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            marginLeft: { xs: 0, sm: "250px" },
            width: { xs: "100%", sm: "calc(100% - 250px)" },
            overflowX: "hidden"
          }}
        >
          {/* Header */}
          <Header
            title="Watch Tower"
            onMenuClick={() => setMobileMenuOpen(true)}
            filters={filters}
            onFiltersChange={setFilters}
          />

          <Container
            maxWidth={false}
            disableGutters
            sx={{
              py: 3,
              px: { xs: 2, sm: 3 },
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            {/* Top Metrics */}
            {/* Summary Metrics - EVENLY SPACED */}
            <CardMetric />

            {/* Platform Overview */}
            <PlatformOverview
              onViewTrends={handleViewTrends}
            />




            {/* Category/SKU Tabs */}
            <Box
              sx={{
                bgcolor: "white",
                borderRadius: 2,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                mb: 4
              }}
            >
              <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Box
                    onClick={() => setActiveTab("category")}
                    sx={{
                      py: 2,
                      cursor: "pointer",
                      borderBottom:
                        activeTab === "category"
                          ? "3px solid #2563eb"
                          : "3px solid transparent",
                      color:
                        activeTab === "category" ? "#2563eb" : "#6b7280",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      transition: "all 0.3s"
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>▦</span>
                      <span>Split by Category</span>
                    </Box>
                  </Box>

                  <Box
                    onClick={() => setActiveTab("sku")}
                    sx={{
                      py: 2,
                      cursor: "pointer",
                      borderBottom:
                        activeTab === "sku"
                          ? "3px solid #2563eb"
                          : "3px solid transparent",
                      color:
                        activeTab === "sku" ? "#2563eb" : "#6b7280",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      transition: "all 0.3s"
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>▦</span>
                      <span>Split by SKUs</span>
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* CATEGORY TAB */}
              {activeTab === "category" && (
                <Box sx={{ p: 3 }}>
                  <CategoryTable />
                </Box>
              )}

              {/* SKU TAB */}
              {activeTab === "sku" && (
                <Box sx={{ p: 3 }}>
                  <SKUTable data={dashboardData.skuTable} />
                </Box>
              )}
            </Box>
          </Container>
        </Box>
      </Box>



      {/* Trends Drawer */}
      <MyTrendsDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        trendData={trendData}
        trendParams={trendParams}
      />
    </>
  );
}
