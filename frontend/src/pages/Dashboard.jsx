import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Typography, Box, Tabs, Tab } from "@mui/material";

import Filters from "../components/Filters";
import CardMetric from "../components/CardMetric";
import CategoryCard from "../components/CategoryCard";
import LocationCard from "../components/LocationCard";
import DataTableMUI from "../components/DataTableMUI";
import SkuLevelSummary from "../components/SkuLevelSummary";
import DashboardHeadersFilters from "../components/Filters";
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState({
    platform: "Zepto",
    brand: "All",
    category: "All",
    location: "All",
    msl: "All",
    premium: "All",
    timePeriod: "7/1/2025 - 10/8/2025",
    compareWith: "9/1/2025 - 9/7/2025"
  });

  // const locations = [
  //   {
  //     title: "All",
  //     sales: "211.78M",
  //     salesGrowth: "3.2%",
  //     salesGrowthValue: "(₹6.8M)",
  //     units: "1.24M",
  //     unitsGrowth: "2.5%",
  //     unitsGrowthValue: "(45K)",
  //     impressions: "4.36M",
  //     conversion: "26.93%",
  //     conversionGrowth: "1.8%",
  //   },
  //   {
  //     title: "Bangalore",
  //     sales: "60.90M",
  //     salesGrowth: "5.24M",
  //     salesGrowthValue: "(+9.4%)",
  //     units: "354.87K",
  //     unitsGrowth: "33.08K",
  //     unitsGrowthValue: "(+10.3%)",
  //     impressions: "1.19M",
  //     conversion: "29.89%",
  //     conversionGrowth: "+1.2%",
  //   },
  //   {
  //     title: "Mumbai",
  //     sales: "52.10M",
  //     salesGrowth: "4.10M",
  //     salesGrowthValue: "(+8.5%)",
  //     units: "310.42K",
  //     unitsGrowth: "28.70K",
  //     unitsGrowthValue: "(+10.1%)",
  //     impressions: "0.98M",
  //     conversion: "27.34%",
  //     conversionGrowth: "+1.4%",
  //   },
  //   {
  //     title: "Delhi-NCR",
  //     sales: "48.76M",
  //     salesGrowth: "3.89M",
  //     salesGrowthValue: "(+8.7%)",
  //     units: "298.56K",
  //     unitsGrowth: "27.22K",
  //     unitsGrowthValue: "(+10.0%)",
  //     impressions: "0.96M",
  //     conversion: "28.40%",
  //     conversionGrowth: "+1.1%",
  //   },
  // ];

  const fetchData = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL}/api/dashboard` || "http://localhost:5000/api/dashboard";
      const res = await axios.get(url);
      setData(res?.data?.data);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };
  useEffect(() => {

    fetchData();
  }, []);

    // 🔹 Derive dropdown values dynamically from data
  const platforms = data?.map((d) => d?.Platform);
  const categories = [
    ...new Set(
      data
        ?.filter(
          (d) => filters?.platform === "All" || d.Platform === filters?.platform
        )
        .map((d) => d.Category)
    ),
  ];
  const brands = [
    ...new Set(
      data
        ?.filter(
          (d) =>
            (filters.platform === "All" || d.Platform === filters.platform) &&
            (filters.category === "All" || d.Category === filters.category)
        )
        .map((d) => d.Brand)
    ),
  ];
  const locations = [...new Set(data?.map((d) => d.Location))];
  const msls = [
    ...new Set(
      data
        ?.filter(
          (d) =>
            (filters.platform === "All" || d.Platform === filters.platform) &&
            (filters.category === "All" || d.Category === filters.category) &&
            (filters.brand === "All" || d.Brand === filters.brand)
        )
        .map((d) => d.MSL)
    ),
  ];
  const premiums = [
    ...new Set(
      data
        ?.filter(
          (d) =>
            (filters.platform === "All" || d.Platform === filters.platform) &&
            (filters.category === "All" || d.Category === filters.category) &&
            (filters.brand === "All" || d.Brand === filters.brand)
        )
        .map((d) => d.Premium)
    ),
  ];

  

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
        {/* Filters - EVENLY SPACED */}
        <Box sx={{
          mb: 3,
          bgcolor: 'white',
          p: 3,
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
        <DashboardHeadersFilters
          filters={filters}
          setFilters={setFilters}
          platforms={platforms}
          categories={categories}
          brands={brands}
          locations={locations}
          msls={msls}
          premiums={premiums}
        />
        </Box>
 
        {/* Tabs - EVENLY SPACED */}
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
        </Box>

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

        {/* Summary Metrics - PERFECTLY EVENLY SPACED */}
        {/*
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
              value={data.summaryMetrics.offtakes} 
              trend={data.summaryMetrics.offtakesTrend} 
              chartKey="offtake" 
            />
            <CardMetric 
              title="SHARE OF SEARCH" 
              value={data.summaryMetrics.shareOfSearch} 
              trend={data.summaryMetrics.shareOfSearchTrend} 
              chartKey="share" 
            />
            <CardMetric 
              title="STOCK AVAILABILITY" 
              value={data.summaryMetrics.stockAvailability} 
              trend={data.summaryMetrics.stockAvailabilityTrend} 
              chartKey="stock" 
            />
            <CardMetric 
              title="MARKET SHARE" 
              value={data.summaryMetrics.marketShare} 
              chartKey="market" 
            />
          </Box>
        </Box>
        */}

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
            {/*
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
              {data.categories.map(cat => (
                <CategoryCard 
                  key={cat.title} 
                  data={cat} 
                  onViewSKUs={() => setFilters(prev => ({ ...prev, category: cat.title }))} 
                />
              ))}
            </Box>
            */}
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
                 {/*
              {locations.map((loc) => (
                <LocationCard
                  key={loc.title}
                  title={loc.title}
                  sales={loc.sales}
                  salesGrowth={loc.salesGrowth}
                  salesGrowthValue={loc.salesGrowthValue}
                  units={loc.units}
                  unitsGrowth={loc.unitsGrowth}
                  unitsGrowthValue={loc.unitsGrowthValue}
                  impressions={loc.impressions}
                  conversion={loc.conversion}
                  conversionGrowth={loc.conversionGrowth}
                />
              ))}
                */}
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
            {/*
            <Box>
              <DataTableMUI rows={data.skuTable} />
            </Box>
            */}
          </Box>

        </Box>
        <Box sx={{ mb: 4, bgcolor: 'white', p: 3, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <SkuLevelSummary />
        </Box>
      </Container>
    </Box>
  );
}