import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Typography, Box, Tabs, Tab } from "@mui/material";


import Navbar from "../components/Navbar";
import Header from "../components/Header";
import Filters from "../components/Filters";
import CardMetric from "../components/CardMetric";
import CategoryCard from "../components/CategoryCard";
import LocationCard from "../components/LocationCard";
import DataTableMUI from "../components/DataTableMUI";
import SkuLevelSummary from "../components/SkuLevelSummary";
import DashboardHeadersFilters from "../components/Filters";

import TrendController from "../utils/TrendController";
import MyTrendsDrawer from "../components/MyTrendsDrawer";



export default function Dashboard() {
  const trendCtrl = new TrendController();

  // Drawer State
  const [showTrends, setShowTrends] = useState(false);
const [selectedLocation, setSelectedLocation] = useState({ title: "Blinkit" });

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "Blinkit"
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {}
  });
  // Hardcoded dashboard data

  const dashboardData = {
    summaryMetrics: {
      offtakes: "211.78M",
      offtakesTrend: "+1060.81%",
      shareOfSearch: "58.32%",
      shareOfSearchTrend: "+12.11%",
      stockAvailability: "96.32%",
      stockAvailabilityTrend: "+4.2%",
      marketShare: "32.12%"
    },
    locations: [
      {
        title: "All",
        sales: "211.78M",
        salesGrowth: "1060.81",
        salesGrowthValue: "18.24M",
        units: "1.17M",
        unitsGrowth: "985.49",
        unitsGrowthValue: "108.16K",
        impressions: "4.36M",
        conversion: "26.93%",
        conversionGrowth: "26.93"
      },
      {
        title: "Bangalore",
        sales: "60.90M",
        salesGrowth: "1062.71",
        salesGrowthValue: "5.24M",
        units: "354.87K",
        unitsGrowth: "972.64",
        unitsGrowthValue: "33.08K",
        impressions: "1.19M",
        conversion: "29.89%",
        conversionGrowth: "29.89"
      },
      {
        title: "Mumbai",
        sales: "32.21M",
        salesGrowth: "1053.87",
        salesGrowthValue: "2.79M",
        units: "165.20K",
        unitsGrowth: "975.64",
        unitsGrowthValue: "15.36K",
        impressions: "481.89K",
        conversion: "34.28%",
        conversionGrowth: "34.28"
      },
      {
        title: "Delhi - NCR",
        sales: "49.30M",
        salesGrowth: "1067.45",
        salesGrowthValue: "4.22M",
        units: "264.99K",
        unitsGrowth: "1009.24",
        unitsGrowthValue: "23.89K",
        impressions: "997.38K",
        conversion: "26.57%",
        conversionGrowth: "26.57"
      }
    ],
    skuTable: [
      {
        productName: "Product A",
        productId: "A123",
        itemId: "ITM001",
        osa: "58.06%",
        asp: "₹189.38",
        discount: "12%"
      },
      {
        productName: "Product B",
        productId: "B456",
        itemId: "ITM002",
        osa: "62.12%",
        asp: "₹210.00",
        discount: "10%"
      }
    ]
  };

  const [tabValue, setTabValue] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

 const [filters, setFilters] = useState({
    platform: "Blinkit"
  });

  const handlePlatformChange = (platform) => {
  setFilters((prev) => ({
    ...prev,
    platform,
  }));
};

   const handleViewTrends = () => {
    const series = trendCtrl.generateData(trendParams.months, trendParams.timeStep);
    const metrics = trendCtrl.getMetrics(series);

    setTrendData({
      timeSeries: series,
      metrics: metrics
    });

    setTrendParams(prev => ({ ...prev, platform: filters.platform }));
    setShowTrends(true);
  };


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
        />

        <Container maxWidth={false} disableGutters sx={{ py: 3, px: { xs: 2, sm: 3 }, width: '100%', boxSizing: 'border-box' }}>
          {/* Summary Metrics - EVENLY SPACED */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: 2.5,
              '@media (max-width: 1024px)': {
                gridTemplateColumns: 'repeat(2, 1fr)'
              },
              '@media (max-width: 600px)': {
                gridTemplateColumns: '1fr'
              }
            }}>
              <CardMetric 
                title="OFFTAKES at MRP" 
                value={dashboardData.summaryMetrics.offtakes} 
                trend={dashboardData.summaryMetrics.offtakesTrend} 
                chartKey="offtake" 
              />
              <CardMetric 
                title="SHARE OF SEARCH" 
                value={dashboardData.summaryMetrics.shareOfSearch} 
                trend={dashboardData.summaryMetrics.shareOfSearchTrend} 
                chartKey="share" 
              />
              <CardMetric 
                title="STOCK AVAILABILITY" 
                value={dashboardData.summaryMetrics.stockAvailability} 
                trend={dashboardData.summaryMetrics.stockAvailabilityTrend} 
                chartKey="stock" 
              />
              <CardMetric 
                title="MARKET SHARE" 
                value={dashboardData.summaryMetrics.marketShare} 
                chartKey="market" 
              />
            </Box>
          </Box>

          {/* Tabs - EVENLY SPACED 
          <Box sx={{ mb: 3, bgcolor: 'white', borderRadius: 2, overflow: 'hidden' }}>
            <Tabs
              value={tabValue}
              onChange={(e, v) => setTabValue(v)}
              variant="fullWidth"
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  py: 2,
                  color: '#6b7280',
                  transition: 'all 0.3s',
                  '&.Mui-selected': {
                    color: '#2563eb'
                  }
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                  backgroundColor: '#2563eb'
                }
              }}
            >
              <Tab label="SUMMARY" />
              <Tab label="AVAILABILITY ANALYSIS" />
              <Tab label="SOV ANALYSIS" />
              <Tab label="PRICING ANALYSIS" />
            </Tabs>
          </Box>*/}

          {/* Overview Badge */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827' }}>
              OVERVIEW for
            </Typography>
            <Box sx={{
              bgcolor: '#dbeafe',
              px: 2.5,
              py: 0.75,
              borderRadius: 2,
              display: 'inline-block'
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2563eb' }}>
                ALL
              </Typography>
            </Box>
            <Box sx={{ ml: 'auto' }}>
              <Typography variant="body2" sx={{ fontSize: '1.5rem' }}>📋</Typography>
            </Box>
          </Box>

          {/* Category Overview */}
          <Box sx={{ mb: 4, bgcolor: 'white', p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 900, color: '#111827' }}>
              OVERVIEW for Category at <span style={{ color: "#16a34a" }}>MRP</span>
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Left sidebar */}
              <Box sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                minWidth: 90,
                flexShrink: 0
              }}>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 1.5,
                  borderRadius: 2,
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: '1.3rem',
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  ☰
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 110
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Offtake
                  </Typography>
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 70
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Market Share
                  </Typography>
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 70
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Impressions
                  </Typography>
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 70
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Conversion
                  </Typography>
                </Box>
              </Box>

              {/* Category cards */}
              <Box sx={{ 
                flex: 1,
                overflowX: "auto", 
                display: 'flex',
                gap: 2.5, 
                pb: 2,
                '&::-webkit-scrollbar': {
                  height: 8
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f3f4f6',
                  borderRadius: 4
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#cbd5e1',
                  borderRadius: 4,
                  '&:hover': {
                    backgroundColor: '#94a3b8'
                  }
                }
              }}>
                {/* Add category cards here */}
              </Box>
            </Box>
          </Box>

          {/* Location Overview */}
          <Box sx={{ mb: 4, bgcolor: 'white', p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 900, color: '#111827' }}>
              OVERVIEW for Location at <span style={{ color: "#16a34a" }}>MRP</span>
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Left sidebar */}
              <Box sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                minWidth: 90,
                flexShrink: 0
              }}>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 1.5,
                  borderRadius: 2,
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: '1.3rem',
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  ☰
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 110
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Offtake
                  </Typography>
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 70
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Impressions
                  </Typography>
                </Box>
                <Box sx={{
                  bgcolor: "#f3f4f6",
                  p: 2,
                  borderRadius: 2,
                  textAlign: "center",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 70
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#4b5563' }}>
                    Conversion
                  </Typography>
                </Box>
              </Box>

              {/* Location cards */}
              <Box sx={{
                flex: 1,
                overflowX: "auto",
                display: 'flex',
                gap: 2.5,
                pb: 2,
                '&::-webkit-scrollbar': {
                  height: 8
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f3f4f6',
                  borderRadius: 4
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#cbd5e1',
                  borderRadius: 4,
                  '&:hover': {
                    backgroundColor: '#94a3b8'
                  }
                }
              }}>
            {dashboardData.locations.map((loc, idx) => (
              <LocationCard
                key={idx}
                {...loc}
                onViewTrends={() => {
                  // prepare trend params + data then open drawer
                  setSelectedLocation(loc);
                  const params = { months: 6, timeStep: 'Monthly', platform: filters.platform || loc.title };
                  setTrendParams(params);
                  const ts = trendCtrl.generateData(params.months, params.timeStep);
                  const metrics = trendCtrl.getMetrics(ts);
                  setTrendData({ timeSeries: ts, metrics });
                  setShowTrends(true);
                }}
              />
            ))}

               
              </Box>
            </Box>
          </Box>

          {/* SKU Level Breakdown */}
          <Box sx={{ bgcolor: 'white', p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, color: '#111827' }}>
              SKU Level Breakdown
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, gap: 3 }}>
              {/* Left summary card */}
              <Box sx={{
                p: 3,
                borderRadius: 2,
                bgcolor: "#eff6ff",
                border: "1px solid #bfdbfe",
                height: 'fit-content'
              }}>
                <Typography variant="subtitle2" sx={{ color: '#6b7280', mb: 1, fontWeight: 600 }}>
                  Selected Category X Brand
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 2, color: '#111827' }}>
                  All
                </Typography>

                <Box sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 800,
                  mb: 1,
                  color: '#374151'
                }}>
                  <div>Offtake:</div>
                  <div>211.78M</div>
                </Box>
                <Box sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 800,
                  mb: 2,
                  color: '#374151'
                }}>
                  <div>OSA%:</div>
                  <div>58.06%</div>
                </Box>

                <Box sx={{
                  borderTop: 2,
                  borderColor: '#cbd5e1',
                  pt: 2,
                  mt: 2
                }} />

                <Box sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                  color: '#4b5563',
                  fontWeight: 600
                }}>
                  <div>Impressions:</div>
                  <div>4.36M</div>
                </Box>
                <Box sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                  color: '#4b5563',
                  fontWeight: 600
                }}>
                  <div>Conversions:</div>
                  <div>26.93%</div>
                </Box>
                <Box sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: '#4b5563',
                  fontWeight: 600
                }}>
                  <div>ASP:</div>
                  <div>₹ 189.38</div>
                </Box>
              </Box>

              {/* Right table */}
              <Box>
                <DataTableMUI rows={dashboardData.skuTable} />
              </Box>
            </Box>
          </Box>

          <Box sx={{ mb: 4, bgcolor: 'white', p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <SkuLevelSummary />
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