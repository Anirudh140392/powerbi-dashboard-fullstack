import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Typography, Box } from "@mui/material";

import Navbar from "../components/Navbar";
import Header from "../components/Header";
import TopMetricCard from "../components/TopMetricCard";
import PlatformOverview from "../components/PlatformOverview";
import CategoryMetricsSection from "../components/CategoryMetricsSection";
import CategoryTable from "../components/CategoryTable";
import SKUTable from "../components/SKUTable";
import MyTrendsDrawer from "../components/MyTrendsDrawer";

export default function Dashboard() {
  const [showTrends, setShowTrends] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('category');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

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

  // Fetch dashboard data from backend
  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  // src/controllers/dashboardController.js
// Single source of truth for hardcoded dashboard data (export named)

 dashboardData = {
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

  platformOverview: [
    {
      name: "All",
      value: "₹5.1 Cr",
      trend: "+1.5%",
      trendType: "up",
      items: "2.9 lac",
      itemsTrend: "-2.1%",
      active: true,
      chart: [0.6, 1.2, 1.6, 2.0, 2.2, 2.0, 2.4, 2.5]
    },
    {
      name: "Blinkit",
      value: "₹2.3 Cr",
      trend: "-1.8%",
      trendType: "down",
      items: "1.4 lac",
      itemsTrend: "-6.6%",
      active: false,
      chart: [0.4, 0.8, 1.1, 1.3, 1.6, 1.9, 2.0]
    },
    {
      name: "Zepto",
      value: "₹1.5 Cr",
      trend: "+1.4%",
      trendType: "up",
      items: "82.0 K",
      itemsTrend: "-0.7%",
      active: false,
      chart: [0.2, 0.5, 0.7, 0.8, 1.0, 1.2]
    },
    {
      name: "Instamart",
      value: "₹1.3 Cr",
      trend: "+7.9%",
      trendType: "up",
      items: "68.9 K",
      itemsTrend: "+6.4%",
      active: false,
      chart: [0.15, 0.3, 0.35, 0.5, 0.7, 1.3]
    }
  ],

  categoryMetrics: [
    // each card corresponds to a platform column in the screenshots;
    // we'll provide a small set of metric-cards the CategoryMetricsSection expects
    {
      name: "All",
      assortment: { count: 101, change: "0.0%" },
      wtOsa: { value: "78.6%", change: "-9.4%" },
      wtDisc: { value: "26.5%", change: "+62.2%" },
      overallSov: { value: "37.4%", change: "-7.2%" },
      doi: null
    },
    {
      name: "Blinkit",
      assortment: { count: 76, change: "0.0%" },
      wtOsa: { value: "75.4%", change: "-15.5%" },
      wtDisc: { value: "24.0%", change: "+73.9%" },
      overallSov: { value: "36.5%", change: "-7.3%" },
      doi: null
    },
    {
      name: "Zepto",
      assortment: { count: 99, change: "0.0%" },
      wtOsa: { value: "79.7%", change: "-4.7%" },
      wtDisc: { value: "29.9%", change: "+63.0%" },
      overallSov: { value: "36.6%", change: "-3.6%" },
      doi: null
    },
    {
      name: "Instamart",
      assortment: { count: 87, change: "+1.2%" },
      wtOsa: { value: "83.3%", change: "-2.8%" },
      wtDisc: { value: "27.3%", change: "+43.6%" },
      overallSov: { value: "39.7%", change: "-11.3%" },
      doi: null
    }
  ],

  categoryTable: [
    {
      category: "Toothpaste",
      all: { offtake: "₹3.4 Cr", catShare: "45.8%", shareChange: "-1.2%" },
      blinkit: { offtake: "₹1.6 Cr", catShare: "42.9%", shareChange: "-4.3%" },
      zepto: { offtake: "₹0.8 lac", catShare: "24.4%", shareChange: "-2.8%" },
      instamart: { offtake: "₹0.85 lac", catShare: "??", shareChange: "0.2%" }
    },
    {
      category: "Toothbrush",
      all: { offtake: "₹1.0 Cr", catShare: "32.4%", shareChange: "+10.8%" },
      blinkit: { offtake: "₹46.5 lac", catShare: "29.1%", shareChange: "+8.4%" },
      zepto: { offtake: "₹12.7 lac", catShare: "23.0%", shareChange: "-1.4%" },
      instamart: { offtake: "₹30.6 lac", catShare: "22.7%", shareChange: "+2.2%" }
    },
    {
      category: "Mouthwash",
      all: { offtake: "₹25.8 lac", catShare: "24.4%", shareChange: "-2.8%" },
      blinkit: { offtake: "₹12.7 lac", catShare: "23.0%", shareChange: "-1.4%" },
      zepto: { offtake: "₹? lac", catShare: "23.0%", shareChange: "0.0%" },
      instamart: { offtake: "₹7.5 lac", catShare: "23.0%", shareChange: "+2.4%" }
    },
    {
      category: "Baby Toothpaste",
      all: { offtake: "₹21.9 lac", catShare: "50.0%", shareChange: "-2.1%" },
      blinkit: { offtake: "₹12.0 lac", catShare: "49.8%", shareChange: "-3.5%" },
      zepto: { offtake: "₹6.8 lac", catShare: "48.2%", shareChange: "-2.4%" },
      instamart: { offtake: "₹2.1 lac", catShare: "49.8%", shareChange: "+2.4%" }
    },
    {
      category: "Baby Toothbrush",
      all: { offtake: "₹12.2 lac", catShare: "47.6%", shareChange: "+2.0%" },
      blinkit: { offtake: "₹6.8 lac", catShare: "48.2%", shareChange: "-2.4%" },
      zepto: { offtake: "₹2.3 lac", catShare: "45.0%", shareChange: "+1.5%" },
      instamart: { offtake: "₹1.9 lac", catShare: "42.0%", shareChange: "-3.0%" }
    },
    {
      category: "Oral Care - Miscellaneous",
      all: { offtake: "₹4.2 lac", catShare: "8.0%", shareChange: "+82.9%" },
      blinkit: { offtake: "₹1.1 lac", catShare: "3.0%", shareChange: "-7.7%" },
      zepto: { offtake: "₹0.9 lac", catShare: "2.8%", shareChange: "+1.2%" },
      instamart: { offtake: "NA", catShare: "0.0%", shareChange: "NA" }
    },
    // add more rows for scroll (duplicating examples)
    ...Array.from({ length: 8 }).map((_, i) => ({
      category: `Extra Category ${i + 1}`,
      all: { offtake: `₹${(i + 1) * 0.5} lac`, catShare: `${(10 + i)}%`, shareChange: `${i % 2 ? '-1.2%' : '+0.8%'}` },
      blinkit: { offtake: `₹${(i + 1) * 0.3} lac`, catShare: `${(8 + i)}%`, shareChange: `${i % 2 ? '-0.6%' : '+0.4%'}` },
      zepto: { offtake: `₹${(i + 1) * 0.2} lac`, catShare: `${(6 + i)}%`, shareChange: `${i % 2 ? '-0.9%' : '+0.2%'}` },
      instamart: { offtake: `₹${(i + 1) * 0.1} lac`, catShare: `${(5 + i)}%`, shareChange: `${i % 2 ? '-0.3%' : '+0.1%'}` }
    }))
  ],

  skuTable: [
    { sku: "Colgate Visible White 02 Whitening Toothpaste - 100g", all: { offtake: "₹8.8 lac", trend: "+3.0%" }, blinkit: { offtake: "₹5.3 lac", trend: "+7.6%" }, zepto: { offtake: "₹2.5 lac", trend: "-1.4%" }, instamart: { offtake: "₹3.4 lac", trend: "+5.2%" } },
    { sku: "Colgate Sensitive Toothbrush (Ultra Soft) - 4 units", all: { offtake: "₹8.4 lac", trend: "-1.4%" }, blinkit: { offtake: "₹4.0 lac", trend: "-18.9%" }, zepto: { offtake: "₹4.4 lac", trend: "+22.2%" }, instamart: { offtake: "NA", trend: "NA" } },
    { sku: "Colgate Gentle Sensitive Soft Bristles Toothbrush - 1 piece", all: { offtake: "₹7.9 lac", trend: "-2.0%" }, blinkit: { offtake: "₹3.5 lac", trend: "-12.8%" }, zepto: { offtake: "₹2.5 lac", trend: "+1.9%" }, instamart: { offtake: "₹1.9 lac", trend: "+5.1%" } },
    // more rows for scroll
    ...Array.from({ length: 12 }).map((_, i) => ({
      sku: `Colgate SKU Sample ${i + 1}`,
      all: { offtake: `₹${(7 - i) > 0 ? (7 - i) + '.0 lac' : (i+1)+'.0 lac'}`, trend: `${i % 2 ? '+1.0%' : '-0.5%'}` },
      blinkit: { offtake: `₹${(i+1) * 0.4} lac`, trend: `${i % 2 ? '+0.5%' : '-0.2%'}` },
      zepto: { offtake: `₹${(i+1) * 0.25} lac`, trend: `${i % 3 ? '+0.3%' : '-0.7%'}` },
      instamart: { offtake: `₹${(i+1) * 0.15} lac`, trend: `${i % 2 ? '+0.9%' : '-0.4%'}` }
    }))
  ]
};




  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard', {
        params: {
          platform: filters.platform,
          months: filters.months,
          timeStep: filters.timeStep
        }
      });

      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformChange = (platform) => {
    setFilters((prev) => ({
      ...prev,
      platform
    }));
  };

  const handleViewTrends = (locationData) => {
    if (dashboardData) {
      setTrendData({
        timeSeries: dashboardData.timeSeries,
        metrics: dashboardData.generatedMetrics
      });
      setTrendParams(prev => ({ ...prev, platform: filters.platform }));
      setShowTrends(true);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

if (!dashboardData) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <Typography>No data available</Typography>
    </Box>
  );   // ✅ closes return
}       // ✅ closes if block

  return (
    <>
      <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', minHeight: '100vh' }}>
        {/* Left Sidebar Navbar */}
        <Navbar 
          platforms={["Blinkit", "Instamart", "Zepto"]} 
          selectedPlatform={filters.platform}
          onPlatformChange={handlePlatformChange}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <Box sx={{ 
          flex: 1, 
          marginLeft: { xs: 0, sm: '250px' },
          width: { xs: '100%', sm: 'calc(100% - 250px)' },
          overflowX: 'hidden'
        }}>
          {/* Header */}
          <Header 
            title="Watch Tower" 
            onMenuClick={() => setMobileMenuOpen(true)}
            filters={filters}
            onFiltersChange={setFilters}
          />

          <Container maxWidth={false} disableGutters sx={{ py: 3, px: { xs: 2, sm: 3 }, width: '100%', boxSizing: 'border-box' }}>
            
            {/* Top 3 Metrics */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: 3,
                '@media (max-width: 1024px)': {
                  gridTemplateColumns: 'repeat(2, 1fr)'
                },
                '@media (max-width: 600px)': {
                  gridTemplateColumns: '1fr'
                }
              }}>
                {dashboardData.topMetrics.map((metric, idx) => (
                  <TopMetricCard key={idx} {...metric} />
                ))}
              </Box>
            </Box>

            {/* Platform Overview */}
            <PlatformOverview 
              cards={dashboardData.platformCards}
              onViewTrends={handleViewTrends}
            />

            {/* Category/SKU Section with Tabs */}
            <Box sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 4 }}>
              {/* Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                <Box sx={{ display: 'flex', gap: 4 }}>
                  <Box
                    onClick={() => setActiveTab('category')}
                    sx={{
                      py: 2,
                      cursor: 'pointer',
                      borderBottom: activeTab === 'category' ? '3px solid #2563eb' : '3px solid transparent',
                      color: activeTab === 'category' ? '#2563eb' : '#6b7280',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      transition: 'all 0.3s'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: '1.2rem' }}>▦</span>
                      <span>Split by Category</span>
                    </Box>
                  </Box>
                  <Box
                    onClick={() => setActiveTab('sku')}
                    sx={{
                      py: 2,
                      cursor: 'pointer',
                      borderBottom: activeTab === 'sku' ? '3px solid #2563eb' : '3px solid transparent',
                      color: activeTab === 'sku' ? '#2563eb' : '#6b7280',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      transition: 'all 0.3s'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: '1.2rem' }}>▦</span>
                      <span>Split by SKUs</span>
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Tab Content */}
              {activeTab === 'category' && (
                <Box sx={{ p: 3 }}>
                  <CategoryMetricsSection metrics={dashboardData.categoryMetrics} />
                  <Box sx={{ mt: 4 }}>
                    <CategoryTable data={dashboardData.categoryTable} />
                  </Box>
                </Box>
              )}

              {activeTab === 'sku' && (
                <Box sx={{ p: 3 }}>
                  <SKUTable data={dashboardData.skuTable} />
                </Box>
              )}
            </Box>

          </Container>
        </Box>
      </Box>

      <MyTrendsDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        trendData={trendData}
        trendParams={trendParams}
      />
    </>
  );
}