import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../../api/axiosInstance";
import { Container, Box, useTheme, Skeleton } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";

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
import { useMemo } from "react";
import TopActionsLayoutsShowcase from "@/components/ControlTower/WatchTower/TopActionsLayoutsShowcase";
import TrendsCompetitionDrawer from "@/components/AllAvailablityAnalysis/TrendsCompetitionDrawer";
import RCAModal from "@/components/Analytics/CategoryRca/RCAModal";

function WatchTower() {
  const [showTrends, setShowTrends] = useState(false);
  const [selectedTrendName, setSelectedTrendName] = useState("All");
  const [selectedTrendLevel, setSelectedTrendLevel] = useState("MRP");
  const [rcaModalOpen, setRcaModalOpen] = useState(false);
  const [rcaModalTitle, setRcaModalTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = React.useState(0);

  const { selectedBrand, timeStart, timeEnd, compareStart, compareEnd, platform, selectedKeyword, selectedLocation, datesInitialized } = React.useContext(FilterContext);

  const [filters, setFilters] = useState({
    platform: platform || "Zepto",
    months: 6,
    timeStep: "Monthly",
    brand: selectedBrand,
    location: selectedLocation,
    keyword: selectedKeyword,
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : null,
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : null,
    compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
    compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
  });

  const [activeTab, setActiveTab] = useState("Split by Category");
  const [activeKpisTab, setActiveKpisTab] = useState("Platform Overview");

  const [trendParams, setTrendParams] = useState({
    months: "3M",
    timeStep: "Weekly",
    platform: "Zepto",
    category: "All", // ADDED
    brand: "All", // ADDED
    city: "All", // ADDED
    startDate: null,
    endDate: null
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });


  // Fetch Trend Data when params change
  useEffect(() => {
    const fetchTrendData = async () => {
      if (!showTrends) return;

      try {
        const params = {
          brand: selectedBrand || "Aer",
          location: selectedLocation || "Agra",
          platform: trendParams.platform,
          period: trendParams.months,
          timeStep: trendParams.timeStep,
          category: trendParams.category, // Pass category
          startDate: trendParams.startDate ? trendParams.startDate.format('YYYY-MM-DD') : null,
          endDate: trendParams.endDate ? trendParams.endDate.format('YYYY-MM-DD') : null
        };

        console.log("Fetching trend data with params:", params);
        const response = await axiosInstance.get("/watchtower/trend", { params });

        if (response.data) {
          setTrendData(response.data);
        }
      } catch (error) {
        console.error("Error fetching trend data:", error);
      }
    };

    fetchTrendData();
  }, [showTrends, trendParams, selectedBrand, selectedLocation]);

  const handleViewTrends = (label) => {
    console.log("View trends for:", label);
    console.log("Current activeKpisTab:", activeKpisTab);
    console.log("Current monthOverviewData:", monthOverviewData);

    if (activeKpisTab === "Month Overview") {
      // Find the month data to get the date
      const monthItem = monthOverviewData.find(m => m.label === label);
      console.log("Found monthItem:", monthItem);
      if (monthItem && monthItem.date) {
        const mDate = dayjs(monthItem.date);
        setTrendParams(prev => ({
          ...prev,
          platform: monthOverviewPlatform, // Use the selected platform for Month Overview
          category: "All", // ADDED: Reset category
          brand: "All", // ADDED: Reset brand
          city: "All", // ADDED: Reset city
          months: "Custom",
          timeStep: "Daily",
          startDate: mDate.startOf('month'),
          endDate: mDate.endOf('month')
        }));
      }
    } else if (activeKpisTab === "Category Overview") {
      // Category Overview behavior
      setTrendParams(prev => ({
        ...prev,
        platform: categoryOverviewPlatform, // Use the selected platform for Category Overview
        category: label, // The label is the Category Name
        brand: "All", // ADDED: Reset brand
        city: "All", // ADDED: Reset city
        months: "3M",
        startDate: null,
        endDate: null
      }));
    } else if (activeKpisTab === "Brands Overview") {
      // ADDED: Brands Overview behavior
      setTrendParams(prev => ({
        ...prev,
        platform: brandsOverviewPlatform,
        category: brandsOverviewCategory,
        brand: label, // The label is the Brand Name
        city: "All",
        months: "3M",
        startDate: null,
        endDate: null
      }));
    } else {
      // Default Platform Overview behavior
      setTrendParams(prev => ({
        ...prev,
        platform: label,
        category: "All", // UPDATED: Reset to All instead of null
        brand: "All", // ADDED: Reset brand
        city: "All", // ADDED: Reset city
        months: "3M", // Reset to default or keep previous? Let's reset to 3M for platform view
        startDate: null,
        endDate: null
      }));
    }
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
    performanceMetricsKpis: [], // Initialize for skeleton loading
    platformOverview: [],       // Initialize for skeleton loading
  });


  // Individual loading states for each section
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [platformOverviewLoading, setPlatformOverviewLoading] = useState(true);

  const [monthOverviewPlatform, setMonthOverviewPlatform] = useState(platform || "Blinkit");
  const [monthOverviewData, setMonthOverviewData] = useState([]);
  const [monthOverviewLoading, setMonthOverviewLoading] = useState(false);

  const [categoryOverviewPlatform, setCategoryOverviewPlatform] = useState(platform || "Zepto");
  const [categoryOverviewData, setCategoryOverviewData] = useState([]);
  const [categoryOverviewLoading, setCategoryOverviewLoading] = useState(false);

  const [brandsOverviewPlatform, setBrandsOverviewPlatform] = useState(platform || "Zepto");
  const [brandsOverviewCategory, setBrandsOverviewCategory] = useState("All");
  const [brandsOverviewData, setBrandsOverviewData] = useState(null);
  const [brandsOverviewLoading, setBrandsOverviewLoading] = useState(false);

  // Reset category when platform changes to avoid invalid filters
  useEffect(() => {
    setBrandsOverviewCategory("All");
  }, [brandsOverviewPlatform]);

  // Update filters when context changes
  useEffect(() => {
    if (!datesInitialized) return;

    setFilters(prev => {
      const newFilters = {
        ...prev,
        platform: platform || prev.platform,
        brand: selectedBrand || prev.brand,
        keyword: selectedKeyword || prev.keyword,
        location: selectedLocation || prev.location,
        startDate: timeStart ? timeStart.format('YYYY-MM-DD') : null,
        endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : null,
        compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
        compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
      };

      // Simple shallow comparison to avoid unnecessary updates
      const isSame = Object.keys(newFilters).every(key => newFilters[key] === prev[key]);
      return isSame ? prev : newFilters;
    });
  }, [selectedBrand, timeStart, timeEnd, compareStart, compareEnd, platform, selectedKeyword, selectedLocation, datesInitialized]);

  // ==================== PARALLEL DATA LOADING ====================
  // All 6 API calls run in parallel, whichever completes first displays first

  // Ref to track last fetched filters to prevent duplicate API calls
  const lastFetchedFiltersRef = useRef(null);

  useEffect(() => {
    if (!datesInitialized) {
      console.log("⏭️ Skipping fetch: Dates not initialized yet");
      return;
    }

    let ignore = false;

    const fetchAllInParallel = async () => {
      // Prevent fetching if critical filters are missing
      if (!filters.brand || !filters.location) {
        console.log("⏭️ Skipping fetch: Brand or Location missing");
        return;
      }

      // Create a stable key for current filters to compare
      const filterKey = JSON.stringify({
        platform: filters.platform,
        brand: filters.brand,
        location: filters.location,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      // Skip if we already fetched with these same filters
      if (lastFetchedFiltersRef.current === filterKey) {
        console.log("⏭️ Skipping duplicate fetch: Filters unchanged");
        return;
      }

      // Mark these filters as being fetched
      lastFetchedFiltersRef.current = filterKey;

      console.log("🚀 Starting parallel data loading for ALL 6 segments...");
      const totalStartTime = performance.now();

      // Set all loading states
      setLoading(true);
      setPerformanceLoading(true);
      setPlatformOverviewLoading(true);
      setCategoryOverviewLoading(true);
      setMonthOverviewLoading(true);
      setBrandsOverviewLoading(true);

      // Reset data to trigger skeleton loaders
      setDashboardData(prev => ({
        ...prev,
        topMetrics: [],
        performanceMetricsKpis: [],
        platformOverview: []
      }));
      setMonthOverviewData([]);
      setCategoryOverviewData([]);
      setBrandsOverviewData(null);

      // ============ ALL 6 SECTIONS FIRE IN PARALLEL ============

      // STEP 1: WATCH OVERVIEW (PARALLEL)
      const step1Start = performance.now();
      console.log("📊 [1/6] Loading Watch Overview...");
      axiosInstance.get("/watchtower/overview", { params: filters })
        .then(overviewRes => {
          // Removed ignore check - lastFetchedFiltersRef handles duplicate prevention
          setDashboardData(prev => ({
            ...prev,
            topMetrics: overviewRes.data.topMetrics || [],
            summaryMetrics: overviewRes.data.summaryMetrics || prev.summaryMetrics
          }));
          setLoading(false);
          console.log(`✅ [1/6] Watch Overview loaded in ${((performance.now() - step1Start) / 1000).toFixed(2)}s`);
        })
        .catch(err => {
          console.error("Error loading Watch Overview:", err);
          setLoading(false);
        });

      // STEP 2: PERFORMANCE METRICS (PARALLEL)
      const step2Start = performance.now();
      console.log("📊 [2/6] Loading Performance Metrics...");
      axiosInstance.get("/watchtower/performance-metrics", { params: filters })
        .then(performanceRes => {
          // Removed ignore check - lastFetchedFiltersRef handles duplicate prevention
          setDashboardData(prev => ({
            ...prev,
            performanceMetricsKpis: performanceRes.data.performanceMetricsKpis || []
          }));
          setPerformanceLoading(false);
          console.log(`✅ [2/6] Performance Metrics loaded in ${((performance.now() - step2Start) / 1000).toFixed(2)}s`);
        })
        .catch(err => {
          console.error("Error loading Performance Metrics:", err);
          setPerformanceLoading(false);
        });

      // STEP 3: PLATFORM OVERVIEW (PARALLEL)
      const step3Start = performance.now();
      console.log("📊 [3/6] Loading Platform Overview...");
      axiosInstance.get("/watchtower/platform-overview", { params: filters })
        .then(platformRes => {
          setDashboardData(prev => ({
            ...prev,
            platformOverview: platformRes.data || []
          }));
          setPlatformOverviewLoading(false);
          console.log(`✅ [3/6] Platform Overview loaded in ${((performance.now() - step3Start) / 1000).toFixed(2)}s`);
        })
        .catch(err => {
          console.error("Error loading Platform Overview:", err);
          setPlatformOverviewLoading(false);
        });

      // STEP 4: CATEGORY OVERVIEW (PARALLEL)
      const step4Start = performance.now();
      console.log("📊 [4/6] Loading Category Overview...");
      axiosInstance.get("/watchtower/category-overview", { params: { ...filters, categoryOverviewPlatform } })
        .then(categoryRes => {
          setCategoryOverviewData(categoryRes.data);
          setDashboardData(prev => ({ ...prev, categoryOverview: categoryRes.data }));
          setCategoryOverviewLoading(false);
          console.log(`✅ [4/6] Category Overview loaded in ${((performance.now() - step4Start) / 1000).toFixed(2)}s`);
        })
        .catch(err => {
          console.error("Error loading Category Overview:", err);
          setCategoryOverviewLoading(false);
        });

      // STEP 5: MONTH OVERVIEW (PARALLEL)
      const step5Start = performance.now();
      console.log("📊 [5/6] Loading Month Overview...");
      axiosInstance.get("/watchtower/month-overview", { params: { ...filters, monthOverviewPlatform } })
        .then(monthRes => {
          setMonthOverviewData(monthRes.data);
          setDashboardData(prev => ({ ...prev, monthOverview: monthRes.data }));
          setMonthOverviewLoading(false);
          console.log(`✅ [5/6] Month Overview loaded in ${((performance.now() - step5Start) / 1000).toFixed(2)}s`);
        })
        .catch(err => {
          console.error("Error loading Month Overview:", err);
          setMonthOverviewLoading(false);
        });

      // STEP 6: BRAND OVERVIEW (PARALLEL)
      const step6Start = performance.now();
      console.log("📊 [6/6] Loading Brand Overview...");
      axiosInstance.get("/watchtower/brands-overview", { params: { ...filters, brandsOverviewPlatform, brandsOverviewCategory } })
        .then(brandsRes => {
          setBrandsOverviewData(brandsRes.data);
          setDashboardData(prev => ({ ...prev, brandsOverview: brandsRes.data }));
          setBrandsOverviewLoading(false);
          console.log(`✅ [6/6] Brand Overview loaded in ${((performance.now() - step6Start) / 1000).toFixed(2)}s`);
        })
        .catch(err => {
          console.error("Error loading Brand Overview:", err);
          setBrandsOverviewLoading(false);
        });

      console.log(`🚀 All 6 section requests fired in parallel! Each will display as soon as ready.`);
    };

    fetchAllInParallel();
    return () => { ignore = true; };
  }, [filters, datesInitialized]); // Only re-fetch ALL sections when filters change (brand, location, dates)
  // Platform-specific changes (monthOverviewPlatform, categoryOverviewPlatform, etc.) are handled by their own useEffects below

  // Separate effect for Month Overview platform changes (after initial load)
  useEffect(() => {
    let ignore = false;

    const fetchMonthOverview = async () => {
      // Skip if initial load hasn't completed
      if (loading || !filters.brand || !filters.location) return;

      console.log("🔄 Fetching Month Overview for platform:", monthOverviewPlatform);
      setMonthOverviewLoading(true);

      try {
        const response = await axiosInstance.get("/watchtower/month-overview", {
          params: { ...filters, monthOverviewPlatform }
        });

        if (!ignore) {
          setMonthOverviewData(response.data);
          setDashboardData(prev => ({
            ...prev,
            monthOverview: response.data
          }));
          setMonthOverviewLoading(false);
          console.log("✅ Month overview updated");
        }
      } catch (error) {
        if (!ignore) {
          console.error("❌ Error updating Month Overview:", error);
          setMonthOverviewLoading(false);
        }
      }
    };

    // Only run if monthOverviewPlatform changes AFTER initial load
    if (!loading) {
      fetchMonthOverview();
    }

    return () => { ignore = true; };
  }, [monthOverviewPlatform]); // Intentionally minimal deps

  // Separate effect for Category Overview platform changes (after initial load)
  useEffect(() => {
    let ignore = false;

    const fetchCategoryOverview = async () => {
      // Skip if initial load hasn't completed
      if (loading || !filters.brand || !filters.location) return;

      console.log("🔄 Fetching Category Overview for platform:", categoryOverviewPlatform);
      setCategoryOverviewLoading(true);

      try {
        const response = await axiosInstance.get("/watchtower/category-overview", {
          params: { ...filters, categoryOverviewPlatform }
        });

        if (!ignore) {
          setCategoryOverviewData(response.data);
          setDashboardData(prev => ({
            ...prev,
            categoryOverview: response.data
          }));
          setCategoryOverviewLoading(false);
          console.log("✅ Category overview updated");
        }
      } catch (error) {
        if (!ignore) {
          console.error("❌ Error updating Category Overview:", error);
          setCategoryOverviewLoading(false);
        }
      }
    };

    // Only run if categoryOverviewPlatform changes AFTER initial load
    if (!loading) {
      fetchCategoryOverview();
    }

    return () => { ignore = true; };
  }, [categoryOverviewPlatform]); // Intentionally minimal deps

  // Separate effect for Brands Overview changes (after initial load)
  useEffect(() => {
    let ignore = false;

    const fetchBrandsOverview = async () => {
      // Skip if initial load hasn't completed
      if (loading || !filters.brand || !filters.location) return;

      console.log("🔄 Fetching Brands Overview for:", brandsOverviewPlatform, brandsOverviewCategory);
      setBrandsOverviewLoading(true);

      try {
        const response = await axiosInstance.get("/watchtower/brands-overview", {
          params: { ...filters, brandsOverviewPlatform, brandsOverviewCategory }
        });

        if (!ignore) {
          setBrandsOverviewData(response.data);
          setDashboardData(prev => ({
            ...prev,
            brandsOverview: response.data
          }));
          setBrandsOverviewLoading(false);
          console.log("✅ Brands overview updated");
        }
      } catch (error) {
        if (!ignore) {
          console.error("❌ Error updating Brands Overview:", error);
          setBrandsOverviewLoading(false);
        }
      }
    };

    // Only run if platform/category changes AFTER initial load
    if (!loading) {
      fetchBrandsOverview();
    }

    return () => { ignore = true; };
  }, [brandsOverviewPlatform, brandsOverviewCategory]); // Intentionally minimal deps


  return (
    <>
      <CommonContainer
        title="Watch Tower"
        filters={filters}
        onFiltersChange={setFilters}
      >
        {/* Top Cards */}
        <CardMetric
          data={dashboardData.topMetrics}
          onViewTrends={handleViewTrends}
        />

        {/* Performance Marketing */}
        <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 6,
            boxShadow: 1,
            mb: 4,
          }}
        >
          <PerformanceMatric
            cardWidth={285}
            cardHeight={140}
            data={dashboardData.performanceMetricsKpis}
            filters={filters}
          />
        </Box >

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
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: { xs: 2, sm: 3 } }}>
            <Box sx={{
              display: "flex",
              gap: { xs: 2, sm: 4 },
              overflowX: "auto",
              pb: 0.5,
              "&::-webkit-scrollbar": { display: "none" },
              msOverflowStyle: "none",
              scrollbarWidth: "none",
            }}>
              <Box sx={{ flexShrink: 0 }}>
                <TabButton
                  label="By Platform"
                  active={activeKpisTab === "Platform Overview"}
                  onClick={() => { setActiveKpisTab("Platform Overview"); setCurrentPage(0); }}
                />
              </Box>

              <Box sx={{ flexShrink: 0 }}>
                <TabButton
                  label="By Month"
                  active={activeKpisTab === "Month Overview"}
                  onClick={() => { setActiveKpisTab("Month Overview"); setCurrentPage(0); }}
                />
              </Box>

              <Box sx={{ flexShrink: 0 }}>
                <TabButton
                  label="By Category"
                  active={activeKpisTab === "Category Overview"}
                  onClick={() => { setActiveKpisTab("Category Overview"); setCurrentPage(0); }}
                />
              </Box>

              <Box sx={{ flexShrink: 0 }}>
                <TabButton
                  label="By Brands"
                  active={activeKpisTab === "Brands Overview"}
                  onClick={() => { setActiveKpisTab("Brands Overview"); setCurrentPage(0); }}
                />
              </Box>

            </Box>
          </Box>
          <Box sx={{ p: 3, opacity: monthOverviewLoading && activeKpisTab === "Month Overview" ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <PlatformOverview
              onViewTrends={handleViewTrends}
              onViewRca={(label) => {
                setRcaModalTitle(`${label} x ${filters.platform}`);
                setRcaModalOpen(true);
              }}
              data={
                activeKpisTab === "Platform Overview"
                  ? (() => {
                    const platforms = dashboardData?.platformOverview || [];
                    // Safely get platform as string - handle string, array, or undefined
                    const platformValue = Array.isArray(filters.platform)
                      ? (filters.platform.length > 0 ? filters.platform[0] : 'All')
                      : (filters.platform || 'All');
                    const selectedPlatform = typeof platformValue === 'string' ? platformValue.toLowerCase() : 'all';

                    // Sort platforms: All first, then selected platform, then others
                    return platforms.sort((a, b) => {
                      const aLabel = a.label?.toLowerCase();
                      const bLabel = b.label?.toLowerCase();

                      // "All" always comes first
                      if (aLabel === 'all') return -1;
                      if (bLabel === 'all') return 1;

                      // Selected platform comes second (after "All")
                      if (selectedPlatform && selectedPlatform !== 'all') {
                        if (aLabel === selectedPlatform) return -1;
                        if (bLabel === selectedPlatform) return 1;
                      }

                      // Rest maintain their order (alphabetical)
                      return aLabel.localeCompare(bLabel);
                    });
                  })()
                  : activeKpisTab === "Category Overview"
                    ? (categoryOverviewData || [])
                    : activeKpisTab === "Month Overview"
                      ? (monthOverviewData || [])
                      : activeKpisTab === "Brands Overview"
                        ? (brandsOverviewData || [])
                        : []
              }
              monthOverviewPlatform={monthOverviewPlatform}
              onMonthPlatformChange={setMonthOverviewPlatform}
              categoryOverviewPlatform={categoryOverviewPlatform}
              onCategoryPlatformChange={setCategoryOverviewPlatform}
              brandsOverviewPlatform={brandsOverviewPlatform}
              onBrandsPlatformChange={setBrandsOverviewPlatform}
              brandsOverviewCategory={brandsOverviewCategory}
              onBrandsCategoryChange={setBrandsOverviewCategory}
              activeKpisTab={activeKpisTab}
              filters={filters}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
            {/* defaultMonths
defaultCategory */}
          </Box>
        </Box>
        <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
            mb: 4,
          }}
        >
          <TopActionsLayoutsShowcase />
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
          <FormatPerformanceStudio
            categoryOverviewData={categoryOverviewData}
            categoryOverviewPlatform={categoryOverviewPlatform}
            setCategoryOverviewPlatform={setCategoryOverviewPlatform}
          />

          {/* {activeTab === "sku" && (
            <Box sx={{ p: 3 }}>
              <SKUTable data={dashboardData.skuTable} />
            </Box>
          )} */}
        </Box>
      </CommonContainer >

      {/* Trend Drawer */}
      < TrendsCompetitionDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)
        }
        selectedColumn={selectedTrendName}
        selectedLevel={selectedTrendLevel}
        dynamicKey="platform_overview_tower"
      />

      <RCAModal
        open={rcaModalOpen}
        onClose={() => setRcaModalOpen(false)}
        title={rcaModalTitle}
      />
    </>
  );
}
const FORMAT_ROWS = [
  {
    name: "Cassata",
    offtakes: 4,
    spend: 0,
    roas: 3.2,
    inorgSalesPct: 19,
    conversionPct: 2.3,
    marketSharePct: 23,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 384,
    cpc: 4736,
  },
  {
    name: "Core Tub",
    offtakes: 61,
    spend: 2,
    roas: 5.5,
    inorgSalesPct: 18,
    conversionPct: 2.6,
    marketSharePct: 16,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 404,
    cpc: 51,
  },
  {
    name: "Cornetto",
    offtakes: 48,
    spend: 1,
    roas: 7.4,
    inorgSalesPct: 12,
    conversionPct: 10.7,
    marketSharePct: 8,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 456,
    cpc: 71,
  },
  {
    name: "Cup",
    offtakes: 4,
    spend: 0,
    roas: 5.2,
    inorgSalesPct: 2,
    conversionPct: 1.9,
    marketSharePct: 3,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 210,
    cpc: 15,
  },
  {
    name: "KW Sticks",
    offtakes: 9,
    spend: 0,
    roas: 5.7,
    inorgSalesPct: 13,
    conversionPct: 4.1,
    marketSharePct: 22,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 402,
    cpc: 96,
  },
  {
    name: "Magnum",
    offtakes: 14,
    spend: 0,
    roas: 9.9,
    inorgSalesPct: 35,
    conversionPct: 5.6,
    marketSharePct: 22,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 428,
    cpc: 169,
  },
  {
    name: "Others",
    offtakes: 0,
    spend: 0,
    roas: 14.2,
    inorgSalesPct: 100,
    conversionPct: 1.4,
    marketSharePct: 0,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 337,
    cpc: 16,
  },

  /* ---------------------- NEW 7 ROWS ---------------------- */

  {
    name: "Sandwich",
    offtakes: 18,
    spend: 1,
    roas: 6.8,
    inorgSalesPct: 22,
    conversionPct: 3.5,
    marketSharePct: 14,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 390,
    cpc: 62,
  },
  {
    name: "Family Pack",
    offtakes: 33,
    spend: 1,
    roas: 4.9,
    inorgSalesPct: 27,
    conversionPct: 4.4,
    marketSharePct: 18,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 362,
    cpc: 85,
  },
  {
    name: "Chocobar",
    offtakes: 21,
    spend: 0,
    roas: 8.3,
    inorgSalesPct: 31,
    conversionPct: 6.1,
    marketSharePct: 11,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 412,
    cpc: 102,
  },
  {
    name: "Kulfi",
    offtakes: 12,
    spend: 0,
    roas: 6.1,
    inorgSalesPct: 7,
    conversionPct: 2.8,
    marketSharePct: 6,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 298,
    cpc: 48,
  },
  {
    name: "Jelly Cups",
    offtakes: 7,
    spend: 0,
    roas: 4.4,
    inorgSalesPct: 5,
    conversionPct: 1.7,
    marketSharePct: 4,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 276,
    cpc: 39,
  },
  {
    name: "Brownie Tub",
    offtakes: 26,
    spend: 1,
    roas: 7.9,
    inorgSalesPct: 18,
    conversionPct: 4.8,
    marketSharePct: 12,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 430,
    cpc: 121,
  },
  {
    name: "Exotics",
    offtakes: 5,
    spend: 0,
    roas: 12.3,
    inorgSalesPct: 43,
    conversionPct: 5.3,
    marketSharePct: 2,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 389,
    cpc: 155,
  },
];


const FormatPerformanceStudio = ({ categoryOverviewData, categoryOverviewPlatform, setCategoryOverviewPlatform }) => {
  // Check if data is loading - MOVED AFTER HOOKS
  const isLoading = !categoryOverviewData || categoryOverviewData.length === 0;

  // Transform categoryOverviewData from API into FORMAT_ROWS structure
  const FORMAT_ROWS = useMemo(() => {
    if (!categoryOverviewData || categoryOverviewData.length === 0) {
      // Fallback to empty array if no data
      return [];
    }

    return categoryOverviewData.map(category => {
      // Helper function to parse currency strings like "₹1.2 L" or "₹45.3 K" or "₹5.91M"
      const parseCurrency = (str) => {
        if (!str) return 0;
        const cleaned = str.replace(/[₹,]/g, '').trim();
        if (cleaned.includes('B')) return parseFloat(cleaned) * 1000000000;
        if (cleaned.includes('Cr')) return parseFloat(cleaned) * 10000000;
        if (cleaned.includes('M')) return parseFloat(cleaned) * 1000000;
        if (cleaned.includes('Lac')) return parseFloat(cleaned) * 100000;
        if (cleaned.includes('L')) return parseFloat(cleaned) * 100000;
        if (cleaned.includes('K')) return parseFloat(cleaned) * 1000;
        return parseFloat(cleaned) || 0;
      };

      // Helper to parse percentage strings like "5.2%"
      const parsePercent = (str) => {
        if (!str) return 0;
        return parseFloat(str.replace('%', '')) || 0;
      };

      // Helper to parse multiplier strings like "7.4x"
      const parseMultiplier = (str) => {
        if (!str) return 0;
        return parseFloat(str.replace('x', '')) || 0;
      };

      // Find column values by title
      const getColumnValue = (title) => {
        const column = category.columns?.find(col => col.title === title);
        return column?.value || '';
      };

      return {
        name: category.label || category.key,
        // Use formatted strings directly from backend (K, Lac, M, Cr, B)
        offtakes: getColumnValue('Offtakes'), // Formatted string like "₹5.91M"
        offtakesNumeric: parseCurrency(getColumnValue('Offtakes')), // For calculations
        spend: getColumnValue('Spend'),
        spendNumeric: parseCurrency(getColumnValue('Spend')),
        roas: parseMultiplier(getColumnValue('ROAS')),
        inorgSalesPct: parsePercent(getColumnValue('Inorg Sales')),
        conversionPct: parsePercent(getColumnValue('Conversion')),
        marketSharePct: parsePercent(getColumnValue('Market Share')),
        promoMyBrandPct: parsePercent(getColumnValue('Promo My Brand')),
        promoCompetePct: parsePercent(getColumnValue('Promo Compete')),
        cpm: getColumnValue('CPM'),
        cpmNumeric: parseCurrency(getColumnValue('CPM')),
        cpc: getColumnValue('CPC'),
        cpcNumeric: parseCurrency(getColumnValue('CPC')),
      };
    });
  }, [categoryOverviewData]);

  const [activeName, setActiveName] = useState(FORMAT_ROWS[0]?.name || '');

  // Update activeName when FORMAT_ROWS changes (e.g., after API call)
  useEffect(() => {
    if (FORMAT_ROWS.length > 0 && !FORMAT_ROWS.find(f => f.name === activeName)) {
      setActiveName(FORMAT_ROWS[0].name);
    }
  }, [FORMAT_ROWS, activeName]);
  const [compareName, setCompareName] = useState(null);

  const active = useMemo(
    () => FORMAT_ROWS.find((f) => f.name === activeName) ?? FORMAT_ROWS[0] ?? {
      name: '',
      offtakes: '0',
      offtakesNumeric: 0,
      spend: '0',
      spendNumeric: 0,
      roas: 0,
      inorgSalesPct: 0,
      conversionPct: 0,
      marketSharePct: 0,
      promoMyBrandPct: 0,
      promoCompetePct: 0,
      cpm: '0',
      cpmNumeric: 0,
      cpc: '0',
      cpcNumeric: 0,
    },
    [activeName, FORMAT_ROWS]
  );
  const compare = useMemo(
    () =>
      compareName
        ? FORMAT_ROWS.find((f) => f.name === compareName) ?? null
        : null,
    [compareName, FORMAT_ROWS]
  );
  const maxOfftakes = useMemo(
    () => FORMAT_ROWS.length > 0 ? Math.max(...FORMAT_ROWS.map((f) => f.offtakesNumeric || 1)) : 1,
    [FORMAT_ROWS]
  );
  const formatNumber = (value) =>
    Number.isFinite(value) ? value.toLocaleString("en-IN") : "NaN";
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const pct = (value) =>
    Number.isFinite(value) ? `${value.toFixed(1)}%` : "NaN";
  const [visibleCount, setVisibleCount] = useState(7);
  const visibleItems = FORMAT_ROWS.slice(0, visibleCount);
  const total = FORMAT_ROWS.length;

  const kpiBands = [
    {
      key: "offtakes",
      label: "Offtakes",
      activeValue: active.offtakesNumeric,
      compareValue: compare?.offtakesNumeric ?? null,
      max: maxOfftakes,
      format: (v) => active.offtakes, // Use formatted string from backend
    },
    {
      key: "spend",
      label: "Spend",
      activeValue: active.spendNumeric,
      compareValue: compare?.spendNumeric ?? null,
      max: Math.max(active.spendNumeric, compare?.spendNumeric || 0, 1),
      format: (v) => active.spend, // Use formatted string from backend
    },
    {
      key: "roas",
      label: "ROAS",
      activeValue: active.roas,
      compareValue: compare?.roas ?? null,
      max: 15,
      format: (v) => `${v.toFixed(1)}x`,
    },
    {
      key: "inorgSalesPct",
      label: "Inorg Sales",
      activeValue: active.inorgSalesPct,
      compareValue: compare?.inorgSalesPct ?? null,
      max: 100,
      format: (v) => `${v}%`,
    },
    {
      key: "conversionPct",
      label: "Conversion",
      activeValue: active.conversionPct,
      compareValue: compare?.conversionPct ?? null,
      max: 15,
      format: (v) => `${v}%`,
    },
    {
      key: "marketSharePct",
      label: "Market Share",
      activeValue: active.marketSharePct,
      compareValue: compare?.marketSharePct ?? null,
      max: 100,
      format: (v) => `${v}%`,
    },
    {
      key: "promoMyBrandPct",
      label: "Promo My Brand",
      activeValue: active.promoMyBrandPct,
      compareValue: compare?.promoMyBrandPct ?? null,
      max: 100,
      format: (v) => `${v}%`,
    },
    {
      key: "promoCompetePct",
      label: "Promo Compete",
      activeValue: active.promoCompetePct,
      compareValue: compare?.promoCompetePct ?? null,
      max: 100,
      format: (v) => `${v}%`,
    },
    {
      key: "cpm",
      label: "CPM",
      activeValue: active.cpmNumeric,
      compareValue: compare?.cpmNumeric ?? null,
      max: Math.max(active.cpmNumeric, compare?.cpmNumeric || 0, 1),
      format: (v) => active.cpm, // Use formatted string from backend
    },
    {
      key: "cpc",
      label: "CPC",
      activeValue: active.cpcNumeric,
      compareValue: compare?.cpcNumeric ?? null,
      max: Math.max(active.cpcNumeric, compare?.cpcNumeric || 0, 1),
      format: (v) => active.cpc, // Use formatted string from backend
    },
  ];

  // Skeleton loading state - AFTER all hooks have been called
  if (isLoading) {
    return (
      <motion.div
        className="rounded-3xl bg-white/70 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-sky-900/5 p-4 lg:p-6 grid grid-cols-1 md:grid-cols-5 gap-4"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        {/* Left side - Category list skeletons */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton variant="text" width={180} height={28} animation="wave" sx={{ borderRadius: 1 }} />
              <Skeleton variant="text" width={280} height={16} animation="wave" sx={{ borderRadius: 1 }} />
            </div>
            <Skeleton variant="rounded" width={100} height={36} animation="wave" sx={{ borderRadius: 2 }} />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full flex items-center justify-between rounded-2xl px-3 py-2 border border-slate-200 bg-white/70">
                <Box display="flex" alignItems="center" gap={1}>
                  <Skeleton variant="circular" width={24} height={24} animation="wave" />
                  <Box>
                    <Skeleton variant="text" width={100} height={20} animation="wave" sx={{ borderRadius: 1 }} />
                    <Skeleton variant="text" width={140} height={14} animation="wave" sx={{ borderRadius: 1 }} />
                  </Box>
                </Box>
                <Box display="flex" flexDirection="column" alignItems="flex-end">
                  <Skeleton variant="text" width={50} height={14} animation="wave" sx={{ borderRadius: 1 }} />
                  <Skeleton variant="text" width={50} height={14} animation="wave" sx={{ borderRadius: 1 }} />
                </Box>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - KPI detail skeletons */}
        <div className="md:col-span-3">
          <div className="h-full rounded-3xl bg-white border border-slate-200/70 shadow-lg p-4 lg:p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <Box>
                <Skeleton variant="text" width={120} height={16} animation="wave" sx={{ borderRadius: 1 }} />
                <Skeleton variant="text" width={180} height={28} animation="wave" sx={{ borderRadius: 1 }} />
                <Skeleton variant="text" width={220} height={14} animation="wave" sx={{ borderRadius: 1, mt: 0.5 }} />
              </Box>
              <Box display="flex" flexDirection="column" alignItems="flex-end">
                <Skeleton variant="text" width={60} height={14} animation="wave" sx={{ borderRadius: 1 }} />
                <Skeleton variant="text" width={80} height={24} animation="wave" sx={{ borderRadius: 1 }} />
                <Skeleton variant="text" width={80} height={14} animation="wave" sx={{ borderRadius: 1, mt: 1 }} />
                <Skeleton variant="text" width={50} height={20} animation="wave" sx={{ borderRadius: 1 }} />
              </Box>
            </div>
            <div className="flex gap-4">
              {/* ROAS circle skeleton */}
              <Skeleton variant="circular" width={96} height={96} animation="wave" />
              {/* KPI bands skeletons */}
              <div className="flex-1 space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Box key={i}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Skeleton variant="text" width={80} height={14} animation="wave" sx={{ borderRadius: 1 }} />
                      <Skeleton variant="text" width={50} height={14} animation="wave" sx={{ borderRadius: 1 }} />
                    </Box>
                    <Skeleton variant="rounded" width="100%" height={12} animation="wave" sx={{ borderRadius: 2 }} />
                  </Box>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="rounded-3xl bg-white/70 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-sky-900/5 p-4 lg:p-6 grid grid-cols-1 md:grid-cols-5 gap-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-lg font-semibold bg"
              style={{
                fontFamily: "Roboto, sans-serif",
                fontWeight: 700,
                fontSize: "1.2rem",
              }}
            >
              Category performance
            </h2>
            <p
              className="text-xs text-slate-500"
              style={{
                fontFamily: "Roboto, sans-serif",
                fontWeight: 400,
                fontSize: "0.75rem",
              }}
            >
              Hover a format to see its DNA. Click a pill below to compare.
            </p>
          </div>
          {/* Platform dropdown removed per user request */}
        </div>

        <div className="space-y-2 max-h-150 overflow-y-auto pr-1 ">
          {FORMAT_ROWS.map((f, index) => {
            const isActive = f.name === activeName;

            return (
              <motion.button
                key={f.name}
                onMouseEnter={() => setActiveName(f.name)}
                onClick={() => setActiveName(f.name)}
                className={`group w-full flex items-center justify-between rounded-2xl px-3 py-2 text-xs border ${isActive
                  ? "border-sky-400 bg-sky-50 shadow-sm"
                  : "border-slate-200 bg-white/70 hover:bg-slate-50"
                  }`}
                whileHover={{ boxShadow: "0 0 12px rgba(0,0,0,0.08)" }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                {/* LEFT SIDE */}
                <div className="flex items-center gap-2">
                  {/* NUMBER BADGE */}
                  <div
                    className="px-3 h-6 rounded-full bg-slate-100 text-gray-500
             text-[11px] font-semibold flex items-center justify-center
             transition-colors duration-100
             group-hover:bg-sky-500 group-hover:text-white"
                  >
                    #{index + 1}
                  </div>

                  {/* TEXT */}
                  <div className="text-left">
                    <div
                      className="font-medium"
                      style={{
                        fontFamily: "Roboto, sans-serif",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                      }}
                    >
                      {f.name}
                    </div>
                    <div
                      className="text-[10px] text-slate-500"
                      style={{
                        fontFamily: "Roboto, sans-serif",
                        fontWeight: 400,
                        fontSize: "0.75rem",
                      }}
                    >
                      Offtakes {f.offtakes} · ROAS {f.roas.toFixed(1)}x
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div
                  className="flex flex-col items-end text-[10px] text-slate-500"
                  style={{
                    fontFamily: "Roboto, sans-serif",
                    fontWeight: 500,
                    fontSize: "0.75rem",
                  }}
                >
                  <span>MS {f.marketSharePct}%</span>
                  <span>Conv {f.conversionPct}%</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="md:col-span-3 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.name + (compare?.name ?? "")}
            className="h-full rounded-3xl bg-gradient-to-br bg-white border border-slate-200/70 shadow-lg p-4 lg:p-6 flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">
                  {compare ? "Focus format · VS mode" : "Focus format"}
                </div>
                <div className="text-xl font-semibold">
                  {active.name}
                  {compare && (
                    <span className="text-sm font-normal text-slate-500">
                      {" "}
                      vs {compare.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Offtakes, ROAS, conversion and share in one view.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <div className="text-[10px] text-slate-500">Offtakes</div>
                <div className="text-lg font-semibold">
                  {active.offtakes}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Market share
                </div>
                <div className="text-sm font-medium">
                  {active.marketSharePct}%
                </div>
                {compare && (
                  <div className="mt-1 text-[10px] text-rose-500">
                    Delta ROAS{" "}
                    {Number.isFinite(compare.roas)
                      ? (active.roas - compare.roas).toFixed(1)
                      : "-"}
                    x vs {compare.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth="8"
                    fill="none"
                  />
                  {compare && Number.isFinite(compare.roas) && (
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#a855f7"
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: clamp01(compare.roas / 12) }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      style={{ transformOrigin: "50% 50%", rotate: "-90deg" }}
                      opacity={0.6}
                    />
                  )}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="url(#roasGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: clamp01(active.roas / 12) }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ transformOrigin: "50% 50%", rotate: "-90deg" }}
                  />
                  <defs>
                    <linearGradient
                      id="roasGradient"
                      x1="0"
                      x2="1"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
                  <div className="text-[10px] text-slate-500">ROAS</div>
                  <div className="text-lg font-semibold">
                    {active.roas.toFixed(1)}x
                  </div>
                  {compare && (
                    <div className="text-[9px] text-violet-600 mt-0.5">
                      vs {compare.roas.toFixed(1)}x
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {kpiBands.map((k) => {
                  const activeRatio = clamp01(k.activeValue / k.max);
                  const compareRatio =
                    k.compareValue != null
                      ? clamp01(k.compareValue / k.max)
                      : null;
                  return (
                    <div key={k.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{k.label}</span>
                        <div className="flex items-center gap-2">
                          {compareRatio != null &&
                            Number.isFinite(k.compareValue) && (
                              <span className="text-[10px] text-violet-600">
                                {k.format(k.compareValue)}
                              </span>
                            )}
                          <span className="font-medium">
                            {Number.isFinite(k.activeValue)
                              ? k.format(k.activeValue)
                              : "NaN"}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-white/80 overflow-hidden relative">
                        {compareRatio != null && (
                          <motion.div
                            className="absolute inset-y-[3px] left-0 rounded-full bg-violet-300/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${compareRatio * 100}%` }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                          />
                        )}
                        <motion.div
                          className="relative h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${activeRatio * 100}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* <div className="mt-2 flex flex-wrap gap-2 justify-center">
              {FORMAT_ROWS.map((f) => {
                const weight = clamp01(f.roas / 12);
                const isCompare = compareName === f.name;
                const isActive = activeName === f.name;
                return (
                  <motion.button
                    key={f.name}
                    onClick={() =>
                      setCompareName((prev) =>
                        prev === f.name ? null : f.name
                      )
                    }
                    className={`px-4 py-2 rounded-full text-[11px] border backdrop-blur-sm flex items-center gap-2 ${isCompare
                      ? "border-violet-500 bg-violet-50 shadow-sm"
                      : "border-slate-200 bg-white/80 hover:bg-slate-50"
                      }`}
                    whileHover={{ y: -2 }}
                  >
                    <div
                      className="h-2 w-10 rounded-full"
                      style={{
                        background: `linear-gradient(to right, rgba(14,165,233,${0.3 + weight * 0.4
                          }), rgba(99,102,241,${0.2 + weight * 0.5}))`,
                      }}
                    />
                    <span
                      className={`truncate ${isActive ? "font-semibold" : "font-normal"
                        }`}
                    >
                      {f.name}
                    </span>
                    {isCompare && (
                      <span className="text-[9px] text-violet-600">VS</span>
                    )}
                  </motion.button>
                );
              })}
            </div> */}
            <div className="mt-2 flex flex-wrap gap-2 justify-center">
              {/* PILLS */}
              {visibleItems.map((f) => {
                const weight = clamp01(f.roas / 12);
                const isCompare = compareName === f.name;
                const isActive = activeName === f.name;

                return (
                  <motion.button
                    key={f.name}
                    onClick={() =>
                      setCompareName((prev) =>
                        prev === f.name ? null : f.name
                      )
                    }
                    className={`px-4 py-2 rounded-full text-[11px] border backdrop-blur-sm flex items-center gap-2 ${isCompare
                      ? "border-violet-500 bg-violet-50 shadow-sm"
                      : "border-slate-200 bg-white/80 hover:bg-slate-50"
                      }`}
                    whileHover={{ y: -2 }}
                  >
                    <div
                      className="h-2 w-10 rounded-full"
                      style={{
                        background: `linear-gradient(to right,
                rgba(14,165,233,${0.3 + weight * 0.4}),
                rgba(99,102,241,${0.2 + weight * 0.5})
              )`,
                      }}
                    />

                    <span
                      className={`truncate ${isActive ? "font-semibold" : "font-normal"
                        }`}
                    >
                      {f.name}
                    </span>

                    {isCompare && (
                      <span className="text-[9px] text-violet-600">VS</span>
                    )}
                  </motion.button>
                );
              })}

              {/* ------------------------------- */}
              {/*        ADD MORE & SHOW LESS     */}
              {/* ------------------------------- */}

              {/* ADD MORE (only if not all shown) */}
              {visibleCount < total && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 7)}
                  className="px-4 py-2 rounded-full text-[11px] border border-slate-300 bg-white hover:bg-slate-100"
                >
                  + Add more
                </button>
              )}

              {/* SHOW LESS (only when all are visible) */}
              {visibleCount >= total && total > 7 && (
                <button
                  onClick={() => setVisibleCount(7)}
                  className="px-4 py-2 rounded-full text-[11px] border border-slate-300 bg-white hover:bg-slate-100"
                >
                  Show less
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div >
  );
};

export default WatchTower;
