
import React, { useState, useEffect, useRef, useCallback } from "react";
import axiosInstance from "../../api/axiosInstance";
import ErrorRetryOverlay from "../../components/CommonLayout/ErrorRetryOverlay";
import { Container, Box, useTheme, Skeleton, IconButton } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { motion, AnimatePresence } from "framer-motion";

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
import {
  allCategories,
  allProducts,
  defaultBrands,
  defaultCategory,
  defaultMonths,
  defaultPlatforms,
  defaultSkus,
} from "../../utils/DataCenter";
import { ChevronDown } from "lucide-react";
import {
  getLogicalKpiValue,
  getLogicalKpiTrend
} from "@/components/AllAvailablityAnalysis/availablityDataCenter.jsx";
import PerformanceMatric from "../../components/ControlTower/WatchTower/PeformanceMatric";
import { FilterContext } from "../../utils/FilterContext";
import Loader from "../../components/CommonLayout/Loader";
import { useMemo } from "react";
import TopActionsLayoutsShowcase from "@/components/ControlTower/WatchTower/TopActionsLayoutsShowcase";
import TrendsCompetitionDrawer from "@/components/AllAvailablityAnalysis/TrendsCompetitionDrawer";
import RCAModal from "@/components/Analytics/CategoryRca/RCAModal";
import SnapshotOverview from "../../components/CommonLayout/SnapshotOverview";
import {
  LayoutGrid,
  ShoppingCart,
  Layers,
  Percent,
  PieChart,
  Eye,
  TrendingUp,
  Target,
  DollarSign
} from "lucide-react";
import PerformanceMatrixNew from "@/components/ControlTower/WatchTower/PerformanceMatrixNew";
import PlatformOverviewNew from "@/components/ControlTower/WatchTower/PlatformOverviewNew";
import { AggregatedViewTable, PerformanceBreakdownProvider } from "@/components/ControlTower/WatchTower/PerformanceBreakdown";
import { useHelp } from "../../utils/HelpContext";
import { useAuth } from "../../utils/AuthContext";
import PrimarySummary from "../../components/ControlTower/WatchTower/PrimarySummary";

export default function WatchTower() {
  const { toggleHelp, openHelpWithMenu } = useHelp();
  const { user } = useAuth();
  const isDrl = user?.dbName?.toLowerCase() === "drl";
  const [showTrends, setShowTrends] = useState(false);
  const [selectedTrendName, setSelectedTrendName] = useState("All");
  const [selectedTrendLevel, setSelectedTrendLevel] = useState("MRP");
  const [rcaModalOpen, setRcaModalOpen] = useState(false);
  const [rcaModalTitle, setRcaModalTitle] = useState("");
  const [rcaModalData, setRcaModalData] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = React.useState(0);

  const [filters, setFilters] = useState({
    platform: "All",
    channel: "All",
    months: 6,
    timeStep: "Monthly",
  });

  const [activeTab, setActiveTab] = useState("Split by Category");
  const [activeKpisTab, setActiveKpisTab] = useState("Platform Overview");

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "All",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  const handleViewTrends = (card, level = "MRP") => {
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
      platform: card.name ?? filters.platform ?? "All",
    }));

    setShowTrends(true);
    setSelectedTrendName(typeof card === 'string' ? card : (card.name || card.title || "All"));
    setSelectedTrendLevel(level);
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
      promo: "0%",
      promoTrend: "+0.0%",
    },

    topMetrics: [],
    performanceMetricsKpis: [],
  });

  const [categoryDataLoading, setCategoryDataLoading] = useState(true);
  const [categoryOverview, setCategoryOverview] = useState([]);
  const [performanceLoading, setPerformanceLoading] = useState(true);

  const filterContext = React.useContext(FilterContext);
  const {
    selectedBrand,
    selectedCategory,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    platform: _sidebarPlatform,
    platforms,
    selectedKeyword,
    selectedLocation,
    selectedChannel: _sidebarChannel,
    maxDate,
    datesInitialized,
    datesFetched,
    platformsFetched,
    brands: contextBrands,
    channels,
    refreshFilters,
    refreshDates,
    selectedMsl
  } = filterContext;

  const hasRestrictedPlatforms = useMemo(() => {
    try {
      const storedUser = JSON.parse(sessionStorage.getItem('user') || sessionStorage.getItem('kiryana_user') || '{}');
      const tabPerms = storedUser?.tabPermissions || {};
      return Object.keys(tabPerms).some(
        key => key.startsWith('platform_') && tabPerms[key] === false
      );
    } catch (_) {
      return false;
    }
  }, []);

  // Commented out to prevent dashboard from shifting to single-select when restricted platforms are present
  // useEffect(() => {
  //   if (platformsFetched && hasRestrictedPlatforms) {
  //     const allowed = platforms || [];
  //     const allowedPlatforms = allowed.filter(p => p !== 'All');
  //     if (allowedPlatforms.length > 0 && (filters.platform === "All" || (Array.isArray(filters.platform) && filters.platform.includes("All")))) {
  //       setFilters(prev => ({ ...prev, platform: allowedPlatforms }));
  //       setTrendParams(prev => ({ ...prev, platform: allowedPlatforms }));
  //     }
  //   }
  // }, [platformsFetched, platforms, _sidebarPlatform, hasRestrictedPlatforms, filters.platform]);

  const [localPlatformsList, setLocalPlatformsList] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchLocalPlatforms = async () => {
      try {
        const res = await axiosInstance.get("/watchtower/platforms", {
          params: { channel: filters.channel === "All" ? undefined : filters.channel }
        });
        if (active && res.data && Array.isArray(res.data)) {
          setLocalPlatformsList(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch local platforms", err);
      }
    };
    fetchLocalPlatforms();
    return () => { active = false; };
  }, [filters.channel]);

  const overriddenContextRef = React.useRef(null);
  const prevFilterContextRef = React.useRef(null);

  // Derive full (unfiltered) platform list from platformMetadata
  // platformMetadata always fetches ALL platforms regardless of sidebar channel
  const allPlatformNames = React.useMemo(() => {
    const meta = filterContext.platformMetadata;
    if (meta && meta.length > 0) {
      return meta.map(p => p.pf_name).filter(Boolean);
    }
    return null; // null = no override, use context's list
  }, [filterContext.platformMetadata]);

  const overriddenContext = React.useMemo(() => {
    // Build override: force selectedChannel/platform to "All"
    // and use full platform list if available (prevents sidebar channel from filtering platforms)
    const buildOverride = () => {
      const overrides = {
        selectedChannel: filters.channel || "All",
        platform: filters.platform || "All",
        platforms: localPlatformsList.length > 0 ? localPlatformsList : (allPlatformNames || filterContext.platforms || [])
      };
      return { ...filterContext, ...overrides };
    };

    if (!prevFilterContextRef.current) {
      const newCtx = buildOverride();
      prevFilterContextRef.current = filterContext;
      overriddenContextRef.current = newCtx;
      return newCtx;
    }

    let hasMeaningfulChange = false;
    for (const key in filterContext) {
      if (key === 'selectedChannel' || key === 'platform' || key === 'platforms') continue;
      if (filterContext[key] !== prevFilterContextRef.current[key]) {
        hasMeaningfulChange = true;
        break;
      }
    }

    // Also detect changes in local filter overrides (channel/platform)
    // Without this, changing channel in the filter modal won't trigger a context rebuild
    if (!hasMeaningfulChange && overriddenContextRef.current) {
      const currentChannel = filters.channel || "All";
      const currentPlatform = filters.platform || "All";
      if (overriddenContextRef.current.selectedChannel !== currentChannel ||
        overriddenContextRef.current.platform !== currentPlatform) {
        hasMeaningfulChange = true;
      }
    }

    if (hasMeaningfulChange) {
      const newCtx = buildOverride();
      prevFilterContextRef.current = filterContext;
      overriddenContextRef.current = newCtx;
      return newCtx;
    }

    return overriddenContextRef.current;
  }, [filterContext, allPlatformNames, filters.channel, filters.platform, localPlatformsList]);

  // Business Overview now uses local filter state for channel/platform
  const selectedChannel = filters.channel || "All";
  const platform = filters.platform || "All";

  // Restore comprehensive platform list from rca_sku_dim on mount
  // (Prevents subsetting from other pages like Performance Marketing)
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

  // --- DETERMINISTIC JITTER FOR FRONTEND-ONLY VARIATION ---
  const getJitter = (baseVal, kpiKey) => {
    if (typeof baseVal !== "number") return baseVal;

    // Standardize category for seed consistency
    const catSeed = (!selectedCategory || selectedCategory === "All" || (Array.isArray(selectedCategory) && selectedCategory.length === 0))
      ? "all"
      : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory);

    const seedStr = `${catSeed}-${selectedBrand}-${platform}-${kpiKey}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const noise = (Math.abs(hash) % 20) - 10; // -10% to +10%
    const multiplier = 1 + noise / 100;
    const result = baseVal * multiplier;

    return parseFloat(result.toFixed(kpiKey === "roas" || kpiKey === "offtake" ? 2 : 1));
  };

  const context = { selectedChannel, platform, selectedBrand, selectedCategory, selectedLocation, timeStart, timeEnd };

  // Map backend topMetrics to SnapshotOverview format
  const KPI_ICON_MAP = {
    'Offtake': { icon: ShoppingCart, gradient: ['#6366f1', '#8b5cf6'], id: 'offtake' },
    'Availability': { icon: Layers, gradient: ['#14b8a6', '#06b6d4'], id: 'availability' },
    'Share of Search': { icon: Eye, gradient: ['#f97316', '#fb923c'], id: 'sos' },
    'Market Share': { icon: PieChart, gradient: ['#8b5cf6', '#a855f7'], id: 'market' },
    'Promo': { icon: Percent, gradient: ['#f59e0b', '#fbbf24'], id: 'promo' },
  };

  // Info tooltips for specific KPIs (shown as ℹ icon on hover)
  const KPI_INFO_TOOLTIPS = {
    'Offtakes': "The total sales value generated by a product or brand over a specified period.\n\nData Refresh: Sales data is typically updated daily and available by 2:00 PM.",
    'Availability': "The proportion of stores or locations where a product is available for purchase at a given time.",
    'Share of Search': "Share of Search is calculated based on Top 10 rank positions.\n\nData Refresh: Platform-scraped insights are refreshed daily by 10:00 AM.",
    'Market Share': "The percentage of total category sales contributed by a brand. Market Share data is currently available only for the 11 Tier-1 cities.",
    'Promo': "A price reduction or special offer applied to a product to encourage customer purchases.",
    'Inorganic Sales': "Sales generated through paid channels, including advertisements and sponsored placements.\n\nData Refresh: Ad sales data is typically updated daily and available by 2:00 PM.",
    'ROAS': "The revenue generated for every unit of advertising spend.",
    'Conversion': "The rate at which user interactions (such as clicks or views) result in a purchase.",
    'CPM': "The cost incurred to generate one thousand impressions.",
    'CPC': "Cost per Click (CPC) measures the cost efficiency of each click generated by an advertisement.",
  };

  const COMPARISON_KPIS = useMemo(() => {
    const topMetrics = dashboardData?.topMetrics;

    const tier1Cities = [
      'kolkata', 'mumbai', 'pune', 'chennai', 'delhi', 'lucknow', 
      'gurugram', 'chandigarh', 'hyderabad', 'faridabad', 'bengaluru'
    ];
    let hasTier23 = false;
    if (selectedLocation && selectedLocation !== "All") {
      const locs = Array.isArray(selectedLocation) 
        ? selectedLocation 
        : (typeof selectedLocation === 'string' ? selectedLocation.split(',').map(s => s.trim()) : []);
      hasTier23 = locs.some(loc => {
        const lowerLoc = String(loc).trim().toLowerCase();
        if (lowerLoc === 'all' || lowerLoc === '' || lowerLoc === 'all india') return false;
        return !tier1Cities.includes(lowerLoc);
      });
    }

    // If real data available from backend, use it
    if (topMetrics && Array.isArray(topMetrics) && topMetrics.length > 0) {
      return topMetrics.map((metric) => {
        const originalTitle = metric.title || metric.name || 'Unknown';
        let normalizedTitle = originalTitle;
        if (originalTitle === 'Inorg Sales') normalizedTitle = 'Inorganic Sales';
        if (originalTitle === 'SOS') normalizedTitle = 'Share of Search';
        if (originalTitle === 'Promo My Brand') normalizedTitle = 'Promo';
        if (originalTitle === 'Offtakes') normalizedTitle = 'Offtake';

        const meta = KPI_ICON_MAP[normalizedTitle] || KPI_ICON_MAP[originalTitle] || { icon: TrendingUp, gradient: ['#6366f1', '#8b5cf6'], id: normalizedTitle.toLowerCase().replace(/\s+/g, '_') };
        // Parse trend string properly: extract sign + numeric value
        const trendStr = (metric.change && metric.change.text) ? metric.change.text : (metric.trend || '0%');
        const trendMatch = trendStr.match(/([+-]?\d+\.?\d*)/);
        const trendValue = trendMatch ? parseFloat(trendMatch[1]) : 0;
        // Preserve sign from the original string
        const trendSign = trendStr.trim().startsWith('-') ? -1 : 1;
        const finalTrend = trendValue * (trendMatch && trendMatch[1].startsWith('-') ? 1 : trendSign);

        const currentChannel = (Array.isArray(selectedChannel) ? selectedChannel.join(',') : (selectedChannel || '')).toLowerCase();
        let finalValue = metric.value || metric.label || '0';
        let finalDelta = finalTrend;
        let finalDeltaLabel = trendStr;

        if (normalizedTitle.toLowerCase() === 'cpm' && currentChannel === 'ecommerce') {
          finalValue = 'N/A';
          finalDelta = 0;
          finalDeltaLabel = 'N/A';
        } else if (normalizedTitle.toLowerCase() === 'cpc' && currentChannel === 'quickcomm') {
          finalValue = 'N/A';
          finalDelta = 0;
          finalDeltaLabel = 'N/A';
        } else if (normalizedTitle.toLowerCase() === 'market share' && hasTier23) {
          finalValue = 'N/A';
          finalDelta = 0;
          finalDeltaLabel = 'N/A';
        }

        const rawTrend = metric.chart || getLogicalKpiTrend(meta.id, context);
        const finalTrendArray = (normalizedTitle.toLowerCase() === 'market share' && hasTier23)
          ? (Array.isArray(rawTrend) ? rawTrend.map(() => 0) : [])
          : rawTrend;
        return {
          id: meta.id,
          title: normalizedTitle,
          value: finalValue,
          delta: finalDelta,
          deltaLabel: finalDeltaLabel,
          icon: meta.icon,
          gradient: meta.gradient,
          trend: finalTrendArray,
          subtitle: metric.subtitle || undefined,
          infoTooltip: KPI_INFO_TOOLTIPS[normalizedTitle] || undefined,
        };
      });
    }

    // Fallback: mock data
    return [
      {
        id: 'offtake', title: 'Offtakes',
        value: `₹${getJitter(getLogicalKpiValue('offtake', context), 'offtake')}Cr`,
        delta: getJitter(getLogicalKpiValue('offtakedelta', context), 'offtakedelta'),
        deltaLabel: `+₹${(getJitter(getLogicalKpiValue('offtakedelta', context), 'offtakedelta') * 5.8).toFixed(1)} lac`,
        icon: ShoppingCart, gradient: ['#6366f1', '#8b5cf6'],
        trend: getLogicalKpiTrend('offtake', context)
      },
      {
        id: 'availability', title: 'Availability',
        value: `${getJitter(getLogicalKpiValue('osa', context), 'osa')}%`,
        delta: getJitter(getLogicalKpiValue('osadelta', context), 'osadelta'),
        deltaLabel: `+${(getJitter(getLogicalKpiValue('osadelta', context), 'osadelta') / 4).toFixed(1)}%`,
        icon: Layers, gradient: ['#14b8a6', '#06b6d4'],
        trend: getLogicalKpiTrend('availability', context)
      },
      {
        id: 'sos', title: 'Share of Search',
        value: `${getJitter(getLogicalKpiValue('sos', context), 'sos')}%`,
        delta: -getJitter(getLogicalKpiValue('sosdelta', context), 'sosdelta') / 6,
        deltaLabel: `-${(getJitter(getLogicalKpiValue('sosdelta', context), 'sosdelta') / 10).toFixed(1)}%`,
        icon: Eye, gradient: ['#f97316', '#fb923c'],
        trend: getLogicalKpiTrend('sos', context)
      },
      {
        id: 'market', title: 'Market Share',
        value: hasTier23 ? 'N/A' : `${getJitter(getLogicalKpiValue('market', context), 'market')}%`,
        delta: hasTier23 ? 0 : getJitter(getLogicalKpiValue('marketdelta', context), 'marketdelta'),
        deltaLabel: hasTier23 ? 'N/A' : `+${(getJitter(getLogicalKpiValue('marketdelta', context), 'marketdelta') / 8).toFixed(2)}%`,
        icon: PieChart, gradient: ['#8b5cf6', '#a855f7'],
        trend: hasTier23 
          ? (Array.isArray(getLogicalKpiTrend('market', context)) ? getLogicalKpiTrend('market', context).map(() => 0) : [])
          : getLogicalKpiTrend('market', context),
        infoTooltip: KPI_INFO_TOOLTIPS['Market Share'],
      },
      {
        id: 'promo', title: 'Promo',
        value: `${getJitter(8.5, 'promo')}%`,
        delta: getJitter(1.2, 'promodelta'),
        deltaLabel: `+${getJitter(1.2, 'promodelta').toFixed(1)}%`,
        icon: Percent, gradient: ['#f59e0b', '#fbbf24'],
        trend: getLogicalKpiTrend('osa', context) // Reuse OSA trend for mock variety
      }
    ];
  }, [dashboardData, selectedChannel, platform, selectedBrand, selectedCategory, selectedLocation, timeStart, timeEnd]);

  const FORMAT_ROWS = useMemo(() => {
    if (categoryOverview?.length > 0) {
      return categoryOverview.map(cat => {
        const getColVal = (title) => {
          const col = cat.columns?.find(c => c.title.toLowerCase().includes(title.toLowerCase()));
          if (!col || !col.value || col.value === "N/A") return null;
          const strVal = String(col.value).replace(/,/g, '').replace(/₹/g, '').trim();
          const numMatch = strVal.match(/-?[\d.]+/);
          let val = numMatch ? parseFloat(numMatch[0]) : null;

          if (val === null) return null;

          // Reverse-parse backend formatted strings back to raw numbers
          if (strVal.toLowerCase().includes('cr')) val *= 10000000;
          else if (strVal.toLowerCase().includes('lac') || strVal.toLowerCase().includes('lak')) val *= 100000;
          else if (strVal.toLowerCase().includes('k')) val *= 1000;

          return val;
        };

        return {
          name: cat.label || cat.key,
          offtakes: getColVal("Offtake"),
          spend: getColVal("Spend"),
          roas: getColVal("ROAS"),
          inorgSalesPct: getColVal("Inorg"),
          conversionPct: getColVal("Conversion"),
          marketSharePct: getColVal("Market Share"),
          promoMyBrandPct: getColVal("Promo My Brand"),
          promoCompetePct: getColVal("Promo Compete"),
          cpm: getColVal("CPM"),
          cpc: getColVal("CPC")
        };
      }).sort((a, b) => b.offtakes - a.offtakes);
    }

    if (categoryDataLoading) {
      return [{
        name: "Loading...",
        offtakes: 0, spend: 0, roas: 0, inorgSalesPct: 0, conversionPct: 0,
        marketSharePct: 0, promoMyBrandPct: 0, promoCompetePct: 0, cpm: 0, cpc: 0
      }];
    }

    // Default safe row to prevent undefined errors when dashboardData is empty
    return [{
      name: "Loading...",
      offtakes: 0, spend: 0, roas: 0, inorgSalesPct: 0, conversionPct: 0,
      marketSharePct: 0, promoMyBrandPct: 0, promoCompetePct: 0, cpm: 0, cpc: 0
    }];
  }, [categoryOverview, categoryDataLoading]);


  const [fetchError, setFetchError] = useState(null);
  const [categoryPlatform, setCategoryPlatform] = useState("All");
  const [pdpPlatforms, setPdpPlatforms] = useState([]);

  useEffect(() => {
    if (hasRestrictedPlatforms && pdpPlatforms?.length > 0) {
      const allowed = pdpPlatforms.filter(p => p !== 'All');
      if (allowed.length > 0 && categoryPlatform === "All") {
        setCategoryPlatform(allowed[0]);
      }
    }
  }, [pdpPlatforms, hasRestrictedPlatforms, categoryPlatform]);
  const overviewFetchIdRef = useRef(0);
  const categoryFetchIdRef = useRef(0);

  // Sync filters state from context (used only by child props, NOT for triggering fetches)
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      platform: platform,
      category: selectedCategory,
      keyword: selectedKeyword,
      location: selectedLocation,
      startDate: timeStart ? timeStart.format("YYYY-MM-DD") : null,
      endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : null,
      compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : null,
      compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : null,
    }));
  }, [selectedCategory, timeStart, timeEnd, compareStart, compareEnd, platform, selectedKeyword, selectedLocation]);

  const categoryFilterKey = `${platform}-${selectedBrand}-${selectedCategory}-${selectedLocation}-${selectedKeyword}-${timeStart?.valueOf()}-${timeEnd?.valueOf()}-${compareStart?.valueOf()}-${compareEnd?.valueOf()}-${categoryPlatform}-${selectedMsl}`;

  // Fetch platforms from rb_pdp_olap for Category Performance dropdown
  useEffect(() => {
    axiosInstance.get("/watchtower/pdp-platforms")
      .then(response => {
        if (response.data) {
          setPdpPlatforms(response.data);
        }
      })
      .catch(error => {
        console.error("Error fetching PDP platforms:", error);
      });
  }, []);

  // Sync loading state with filter changes to prevent one-frame flicker
  const currentFilterKey = `${platform}-${selectedBrand}-${selectedCategory}-${selectedLocation}-${selectedKeyword}-${timeStart?.valueOf()}-${timeEnd?.valueOf()}-${compareStart?.valueOf()}-${compareEnd?.valueOf()}-${selectedChannel}-${selectedMsl}`;
  const [prevFilterKey, setPrevFilterKey] = useState(currentFilterKey);
  const lastFetchedOverviewKey = useRef(null);

  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setLoading(true);
    // setCategoryDataLoading(true); // Handled by categoryFilterKey now
    setPerformanceLoading(true);
    setFetchError(null);
    // Force re-fetch even if the key matches a previously-fetched one (e.g. after reset)
    lastFetchedOverviewKey.current = null;
  }

  const [prevCategoryFilterKey, setPrevCategoryFilterKey] = useState(categoryFilterKey);
  if (prevCategoryFilterKey !== categoryFilterKey) {
    setPrevCategoryFilterKey(categoryFilterKey);
    setCategoryDataLoading(true);
  }

  // Single debounced data-fetch effect — reads context directly, no intermediate state
  useEffect(() => {
    if (!datesFetched || !platformsFetched) {
      console.log("[WatchTower] Waiting for context to initialize dates/platforms...");
      return;
    }

    if (lastFetchedOverviewKey.current === currentFilterKey && !loading) return;

    const currentFetchId = ++overviewFetchIdRef.current;

    const debounceTimer = setTimeout(async () => {
      if (currentFetchId !== overviewFetchIdRef.current) return;
      lastFetchedOverviewKey.current = currentFilterKey;

      const params = {
        platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
        brand: selectedBrand === "All" ? undefined : (Array.isArray(selectedBrand) ? selectedBrand.join(",") : selectedBrand),
        category: selectedCategory === "All" ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
        channel: selectedChannel === "All" ? undefined : selectedChannel,
        location: selectedLocation === "All" ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(",") : selectedLocation),
        keyword: selectedKeyword || undefined,
        startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
        endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
        compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : undefined,
        compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : undefined,
        msl: selectedMsl === "All" ? undefined : (Array.isArray(selectedMsl) ? selectedMsl.join(",") : selectedMsl),
      };

      // 1. Fetch fast overview data
      axiosInstance.get("/watchtower/overview", { params })
        .then(response => {
          if (currentFetchId === overviewFetchIdRef.current && response.data) {
            console.log("Fetched Watch Tower Overview:", response.data);
            setDashboardData(prev => ({
              ...prev,
              ...response.data
            }));
            setLoading(false);
          }
        })
        .catch(error => {
          if (currentFetchId === overviewFetchIdRef.current) {
            console.error("Error fetching Watch Tower Overview:", error);
            setFetchError(error.message || "Failed to load Overview data");
            setLoading(false);
          }
        });

      // 3. Fetch Performance Metrics KPIs independently
      axiosInstance.get("/watchtower/performance-metrics", { params })
        .then(response => {
          if (currentFetchId === overviewFetchIdRef.current && response.data) {
            console.log("Fetched Performance Metrics KPIs:", response.data);
            setDashboardData(prev => ({
              ...prev,
              performanceMetricsKpis: response.data.performanceMetricsKpis || []
            }));
            setPerformanceLoading(false);
          }
        })
        .catch(error => {
          console.error("Error fetching Performance Metrics:", error);
          setPerformanceLoading(false);
        });

    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [currentFilterKey, datesFetched, platformsFetched]);

  const lastFetchedCategoryKey = useRef(null);

  // Separate Effect for Category Performance (Isolated Channel Filter)
  useEffect(() => {
    if (!datesFetched || !platformsFetched) return;

    if (lastFetchedCategoryKey.current === categoryFilterKey) return;

    const currentFetchId = ++categoryFetchIdRef.current;

    const debounceTimer = setTimeout(async () => {
      if (currentFetchId !== categoryFetchIdRef.current) return;
      lastFetchedCategoryKey.current = categoryFilterKey;

      const params = {
        platform: categoryPlatform === "All" ? (platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform)) : categoryPlatform,
        brand: selectedBrand === "All" ? undefined : (Array.isArray(selectedBrand) ? selectedBrand.join(",") : selectedBrand),
        category: selectedCategory === "All" ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
        channel: undefined, // Channel dropdown removed for Category Performance
        location: selectedLocation === "All" ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(",") : selectedLocation),
        startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
        endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
        compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : undefined,
        compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : undefined,
        msl: selectedMsl === "All" ? undefined : (Array.isArray(selectedMsl) ? selectedMsl.join(",") : selectedMsl),
      };

      axiosInstance.get("/watchtower/category-overview", { params })
        .then(response => {
          if (currentFetchId === categoryFetchIdRef.current && response.data) {
            setCategoryOverview(response.data);
            setCategoryDataLoading(false);
          }
        })
        .catch(error => {
          if (currentFetchId === categoryFetchIdRef.current) {
            setCategoryDataLoading(false);
          }
        });
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [categoryFilterKey, datesFetched, platformsFetched]);

  // Memoize the PerformanceBreakdownProvider filters to prevent child re-renders
  const perfBreakdownFilters = useMemo(() => ({
    companyId: sessionStorage.getItem('selectedCompanyId') || '',
    platform: filters.platform ? [filters.platform].flat() : [],
    dateStart: filters.startDate || undefined,
    dateEnd: filters.endDate || undefined,
    channel: selectedChannel || undefined,
    category: filters.category ? [filters.category].flat() : [],
    brand: selectedBrand || undefined,
    location: filters.location ? [filters.location].flat() : [],
  }), [filters.platform, filters.startDate, filters.endDate, selectedChannel, filters.category, selectedBrand, filters.location]);

  // Retry handler for error overlay — bumps fetchIdRef to trigger the effect
  const retryFetch = useCallback(() => {
    overviewFetchIdRef.current++; // force a new cycle
    categoryFetchIdRef.current++;
    // Trigger re-render by toggling a dummy dependency — we simply re-call the effect
    setFetchError(null);
    setLoading(true);
    const params = {
      platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
      category: selectedCategory === "All" ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
      location: selectedLocation === "All" ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(",") : selectedLocation),
      keyword: selectedKeyword || undefined,
      startDate: timeStart ? timeStart.format("YYYY-MM-DD") : undefined,
      endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : undefined,
    };
    axiosInstance.get("/watchtower", { params }).then(response => {
      if (response.data) {
        setDashboardData(response.data);
      }
    }).catch(error => {
      setFetchError(error.message || "Failed to load Watch Tower data");
    }).finally(() => {
      setLoading(false);
    });
  }, [platform, selectedCategory, selectedLocation, selectedKeyword, timeStart, timeEnd]);

  const initialTrendAudience = useMemo(() => {
    // selectedTrendLevel can be "Platform Overview", "Month Overview", etc.
    const level = selectedTrendLevel?.split(" ")[0] || "Platform";
    const mapping = {
      Platform: "Platform",
      Brand: "Brand",
      Brands: "Brand",
      Category: "Format",
      Location: "City",
      SKU: "SKU",
      Skus: "SKU",
    };
    return mapping[level] || "Platform";

  }, [selectedTrendLevel]);

  return (
    <>
      <CommonContainer
        title="Business Overview"
        filters={filters}
        onFiltersChange={setFilters}
      >
        <FilterContext.Provider value={overriddenContext}>
          {/* Top Cards */}
          {/* {loading ? (
          <Loader message="Fetching Watch Tower Insights..." />
        ) : (
          <CardMetric
            data={dashboardData.topMetrics}
            onViewTrends={handleViewTrends}
          />
        )} */}

          {fetchError && !loading && !dashboardData?.performanceMetricsKpis?.length ? (
            <ErrorRetryOverlay onRetry={retryFetch} message={fetchError} />
          ) : (
            <SnapshotOverview
              title="Business Overview"
              icon={LayoutGrid}
              chip="All Platforms"
              headerRight={
                <span className="px-4 py-1.5 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 uppercase tracking-tight">
                  vs Previous Month
                </span>
              }
              kpis={COMPARISON_KPIS}
              variant="watchtower"
              seed={`${platform}-${selectedCategory}-${selectedBrand}`}
              loading={loading}
              helpMenu="Business Overview"
              performanceData={dashboardData?.performanceMetricsKpis || []}
              performanceLoading={performanceLoading}
            />
          )}

          {/* Top Cards */}
          {/* <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 6,
            boxShadow: 1,
            mb: 4,
          }}
        >
          <PerformanceMatric cardWidth={285} cardHeight={140} />
        </Box> */}

          {/* Top Cards */}

          {/* Top Cards */}
          <Box
            sx={{
              bgcolor: (theme) => theme.palette.background.paper,
              borderRadius: 6,
              boxShadow: 1,
              mb: 4,
              p: 4,
            }}
          >
            <PlatformOverviewNew
              onViewTrends={handleViewTrends}
              onViewRca={(label) => {
                setRcaModalTitle(`${label}`);
                setRcaModalData({ platform: label });
                setRcaModalOpen(true);
              }}
            />

          </Box>


          {/* Platform Overview */}
          {/* Tabs */}
          {/* <Box
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
                onClick={() => { setActiveKpisTab("Platform Overview"); setCurrentPage(0); }}
              />

              <TabButton
                label="By Month"
                active={activeKpisTab === "Month Overview"}
                onClick={() => { setActiveKpisTab("Month Overview"); setCurrentPage(0); }}
              />

              <TabButton
                label="By Category"
                active={activeKpisTab === "Category Overview"}
                onClick={() => { setActiveKpisTab("Category Overview"); setCurrentPage(0); }}
              />

              <TabButton
                label="By Brands"
                active={activeKpisTab === "Brands Overview"}
                onClick={() => { setActiveKpisTab("Brands Overview"); setCurrentPage(0); }}
              />

              <TabButton
                label="By Skus"
                active={activeKpisTab === "Skus Overview"}
                onClick={() => { setActiveKpisTab("Skus Overview"); setCurrentPage(0); }}
              />
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            <PlatformOverview
              onViewTrends={handleViewTrends}
              onViewRca={(label) => {
                setRcaModalTitle(`${label} x ${Array.isArray(filters.platform) ? filters.platform.join(', ') : filters.platform}`);
                setRcaModalOpen(true);
              }}
              data={
                activeKpisTab === "Platform Overview"
                  ? dashboardData?.platformOverview || defaultPlatforms
                  : activeKpisTab === "Category Overview"
                    ? defaultCategory
                    : activeKpisTab === "Month Overview"
                      ? defaultMonths
                      : activeKpisTab === "Brands Overview"
                        ? defaultBrands
                        : defaultSkus
              }
              activeKpisTab={activeKpisTab}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          </Box>
        </Box> */}
          {/* <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
            mb: 4,
          }}
        >
          <TopActionsLayoutsShowcase />
        </Box> */}

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
              rows={FORMAT_ROWS}
              loading={categoryDataLoading}
              openHelpWithMenu={openHelpWithMenu}
              pdpPlatforms={pdpPlatforms}
              categoryPlatform={categoryPlatform}
              setCategoryPlatform={setCategoryPlatform}
              hasRestrictedPlatforms={hasRestrictedPlatforms}
            />

            {/* {activeTab === "sku" && (
            <Box sx={{ p: 3 }}>
              <SKUTable data={dashboardData.skuTable} />
            </Box>
          )} */}
          </Box>

          {/* Performance Breakdown Section */}
          <Box sx={{ mb: 4 }}>
            <PerformanceBreakdownProvider
              darkMode={false}
              filters={perfBreakdownFilters}
            >
              <AggregatedViewTable />
            </PerformanceBreakdownProvider>
          </Box>

          {isDrl && <PrimarySummary />}
        </FilterContext.Provider>
      </CommonContainer>

      {/* Trend Drawer */}
      {/* <MyTrendsDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        trendData={trendData}
        trendParams={trendParams}
      /> */}
      <TrendsCompetitionDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        selectedColumn={selectedTrendName}
        selectedLevel={selectedTrendLevel}
        initialAudience={initialTrendAudience}
        dynamicKey="platform_overview_tower"
        brandOptions={contextBrands}
        initialPlatform={filters.platform}
        showResellerFilter={true}
      />

      <RCAModal
        open={rcaModalOpen}
        onClose={() => setRcaModalOpen(false)}
        title={rcaModalTitle}
        initialData={rcaModalData}
      />
    </>
  );
}

const FormatPerformanceStudio = ({ rows, loading, openHelpWithMenu, pdpPlatforms, categoryPlatform, setCategoryPlatform, hasRestrictedPlatforms }) => {
  const [activeName, setActiveName] = useState(rows[0]?.name);
  const [compareName, setCompareName] = useState(null);

  const active = useMemo(
    () => rows.find((f) => f.name === activeName) ?? rows[0] ?? {
      name: "Loading...", offtakes: 0, spend: 0, roas: 0, inorgSalesPct: 0,
      conversionPct: 0, marketSharePct: 0, promoMyBrandPct: 0,
      promoCompetePct: 0, cpm: 0, cpc: 0
    },
    [activeName, rows]
  );
  const compare = useMemo(
    () =>
      compareName
        ? rows.find((f) => f.name === compareName) ?? null
        : null,
    [compareName, rows]
  );
  const maxOfftakes = useMemo(
    () => Math.max(...rows.map((f) => f.offtakes || 1)),
    [rows]
  );
  const formatNumber = (value) =>
    Number.isFinite(value) ? value.toLocaleString("en-IN") : "N/A";
  const clamp01 = (value) => Math.max(0, Math.min(1, value || 0));
  const pct = (value) =>
    Number.isFinite(value) ? `${value.toFixed(1)}%` : "N/A";
  const [visibleCount, setVisibleCount] = useState(7);
  const visibleItems = rows.slice(0, visibleCount);
  const total = rows.length;

  const formatCurrencyShort = (val) => {
    if (val === null || !Number.isFinite(val)) return "N/A";
    if (val === 0) return "0";
    const absVal = Math.abs(val);
    if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${(val / 100000).toFixed(2)} Lac`;
    if (absVal >= 1000) return `${(val / 1000).toFixed(2)} K`;
    return val.toFixed(2);
  };


  const platName = (categoryPlatform || '').toLowerCase();

  // Define platform groupings
  const ECOM_PLATFORMS = ['amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart'];
  const QCOM_PLATFORMS = ['blinkit', 'zepto', 'swiggy', 'instamart', 'bbnow'];

  const isEcom = ECOM_PLATFORMS.some(p => platName.includes(p));
  const isQcom = QCOM_PLATFORMS.some(p => platName.includes(p));

  const kpiBands = [
    {
      key: "offtakes",
      label: "Offtakes",
      activeValue: active.offtakes,
      compareValue: compare?.offtakes ?? null,
      max: 100000000,
      format: (v) => `₹${formatCurrencyShort(v)}`,
    },
    {
      key: "spend",
      label: "Spend",
      activeValue: active.spend,
      compareValue: compare?.spend ?? null,
      max: 2000000,
      format: (v) => `₹${formatCurrencyShort(v)}`,
    },
    {
      key: "roas",
      label: "ROAS",
      activeValue: active.roas,
      compareValue: compare?.roas ?? null,
      max: 10,
      format: (v) => `${v}x`,
    },
    {
      key: "inorgSalesPct",
      label: "Inorg Sales",
      activeValue: active.inorgSalesPct,
      compareValue: compare?.inorgSalesPct ?? null,
      max: 50000000,
      format: (v) => `₹${formatCurrencyShort(v)}`,
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
      key: "cpm",
      label: "CPM",
      activeValue: isEcom ? null : active.cpm,
      compareValue: isEcom ? null : (compare?.cpm ?? null),
      max: 800000,
      format: (v) => `₹${formatCurrencyShort(v)}`,
    },
    {
      key: "cpc",
      label: "CPC",
      activeValue: isQcom ? null : active.cpc,
      compareValue: isQcom ? null : (compare?.cpc ?? null),
      max: 5000000,
      format: (v) => `₹${formatCurrencyShort(v)}`,
    },
  ];

  const filteredKpiBands = kpiBands.filter((k) => {
    if (k.key === 'cpm' && isEcom) return false;
    if (k.key === 'cpc' && isQcom) return false;
    return true;
  });

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

          {/* Local Platform Dropdown */}
          <div className="relative flex items-center">
            <select
              value={categoryPlatform || 'All'}
              onChange={(e) => setCategoryPlatform(e.target.value)}
              className="appearance-none bg-blue-50 border border-blue-100 text-blue-700 py-1.5 pl-3 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs shadow-sm cursor-pointer transition-all hover:bg-blue-100/50"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              {!hasRestrictedPlatforms && <option value="All">All Platforms</option>}
              {pdpPlatforms?.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={14} />
          </div>
        </div>

        <div className="space-y-2 max-h-150 overflow-y-auto pr-1 ">
          {loading ? (
            Array.from(new Array(5)).map((_, index) => (
              <Box key={`skeleton-row-${index}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, mb: 1, border: '1px solid', borderColor: 'grey.200', borderRadius: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="circular" width={32} height={24} sx={{ borderRadius: 4 }} />
                  <Box>
                    <Skeleton variant="text" width={120} height={20} />
                    <Skeleton variant="text" width={180} height={14} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Skeleton variant="text" width={60} height={14} />
                  <Skeleton variant="text" width={50} height={14} />
                </Box>
              </Box>
            ))
          ) : (
            rows.map((f, index) => {
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
                        className="font-medium capitalize"
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
                        Offtakes ₹{formatCurrencyShort(f.offtakes)} · ROAS {Number.isFinite(f.roas) ? `${f.roas.toFixed(1)}x` : "N/A"}
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
                    <span>MS {Number.isFinite(f.marketSharePct) ? `${f.marketSharePct}%` : "N/A"}</span>
                    <span>Conv {Number.isFinite(f.conversionPct) ? `${f.conversionPct}%` : "N/A"}</span>
                  </div>

                </motion.button>
              );
            })
          )}
        </div>
      </div>

      <div className="md:col-span-3 relative">
        {loading ? (
          <Box className="h-full rounded-3xl bg-gradient-to-br bg-white border border-slate-200/70 shadow-lg p-4 lg:p-6 flex flex-col gap-4 items-center justify-center">
            <Skeleton variant="circular" width={160} height={160} />
            <Skeleton variant="text" width={200} height={30} sx={{ mt: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={100} sx={{ mt: 2, borderRadius: 2 }} />
          </Box>
        ) : (
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
                  <div className="text-xl font-semibold capitalize">
                    {active.name}
                    {compare && (
                      <span className="text-sm font-normal text-slate-500 capitalize">
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
                  <div className="text-base font-semibold">
                    ₹{formatCurrencyShort(active.offtakes)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Market share
                  </div>
                  <div className="text-sm font-medium">
                    {Number.isFinite(active.marketSharePct) ? `${active.marketSharePct}%` : "N/A"}
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
                    <div className="text-base font-semibold">
                      {Number.isFinite(active.roas) ? `${active.roas.toFixed(1)}x` : "N/A"}
                    </div>

                    {compare && (
                      <div className="text-[9px] text-violet-600 mt-0.5">
                        vs {compare.roas.toFixed(1)}x
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {filteredKpiBands.map((k) => {
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
                            <button
                              onClick={() => openHelpWithMenu("India Overview")}
                              className="font-medium text-[11px] hover:text-sky-600 transition-colors"
                            >
                              {Number.isFinite(k.activeValue)
                                ? k.format(k.activeValue)
                                : "N/A"}
                            </button>
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
                        className={`truncate capitalize ${isActive ? "font-semibold" : "font-normal"
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
        )}
      </div>
    </motion.div>
  );
};
