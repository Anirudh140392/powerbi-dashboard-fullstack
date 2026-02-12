import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../../api/axiosInstance";
import { Container, Box, useTheme } from "@mui/material";
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

export default function WatchTower() {
  const [showTrends, setShowTrends] = useState(false);
  const [selectedTrendName, setSelectedTrendName] = useState("All");
  const [selectedTrendLevel, setSelectedTrendLevel] = useState("MRP");
  const [rcaModalOpen, setRcaModalOpen] = useState(false);
  const [rcaModalTitle, setRcaModalTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = React.useState(0);

  const [filters, setFilters] = useState({
    platform: "Blinkit",
    months: 6,
    timeStep: "Monthly",
  });

  const [activeTab, setActiveTab] = useState("Split by Category");
  const [activeKpisTab, setActiveKpisTab] = useState("Platform Overview");

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "Blinkit",
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
      platform: card.name ?? "Blinkit",
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
    },

    topMetrics: [],
    skuTable: [],
  });

  const {
    selectedBrand,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    platform,
    selectedKeyword,
    selectedLocation,
    selectedChannel,
  } = React.useContext(FilterContext);

  const context = { selectedChannel, platform, selectedBrand, selectedLocation, timeStart, timeEnd };

  const COMPARISON_KPIS = useMemo(() => [
    {
      id: 'offtake',
      title: 'Offtake',
      value: `₹${getLogicalKpiValue('offtake', context)}Cr`,
      delta: getLogicalKpiValue('offtakedelta', context),
      deltaLabel: `+₹${(getLogicalKpiValue('offtakedelta', context) * 5.8).toFixed(1)}L`,
      icon: ShoppingCart,
      gradient: ['#6366f1', '#8b5cf6'],
      trend: getLogicalKpiTrend('offtake', context)
    },
    {
      id: 'availability',
      title: 'Availability',
      value: `${getLogicalKpiValue('osa', context)}%`,
      delta: getLogicalKpiValue('osadelta', context),
      deltaLabel: `+${(getLogicalKpiValue('osadelta', context) / 4).toFixed(1)} pts`,
      icon: Layers,
      gradient: ['#14b8a6', '#06b6d4'],
      trend: getLogicalKpiTrend('availability', context)
    },
    {
      id: 'promo',
      title: 'Promo Spends',
      value: `${getLogicalKpiValue('promo', context)}%`,
      delta: -getLogicalKpiValue('promodelta', context) / 5,
      deltaLabel: `-${(getLogicalKpiValue('promodelta', context) / 100).toFixed(2)} pts`,
      icon: Percent,
      gradient: ['#f43f5e', '#ec4899'],
      trend: getLogicalKpiTrend('promo', context)
    },
    {
      id: 'market',
      title: 'Market Share',
      value: `${getLogicalKpiValue('market', context)}%`,
      delta: getLogicalKpiValue('marketdelta', context),
      deltaLabel: `+${(getLogicalKpiValue('marketdelta', context) / 8).toFixed(2)} pts`,
      icon: PieChart,
      gradient: ['#8b5cf6', '#a855f7'],
      trend: getLogicalKpiTrend('market', context)
    },
    {
      id: 'sos',
      title: 'Share of Search',
      value: `${getLogicalKpiValue('sos', context)}%`,
      delta: -getLogicalKpiValue('sosdelta', context) / 6,
      deltaLabel: `-${(getLogicalKpiValue('sosdelta', context) / 10).toFixed(1)} pts`,
      icon: Eye,
      gradient: ['#f97316', '#fb923c'],
      trend: getLogicalKpiTrend('sos', context)
    },
    {
      id: 'inorg',
      title: 'Inorganic Sales',
      value: `${getLogicalKpiValue('inorg', context)}%`,
      delta: getLogicalKpiValue('inorgdelta', context),
      deltaLabel: `+${(getLogicalKpiValue('inorgdelta', context) / 5).toFixed(1)}%`,
      icon: TrendingUp,
      gradient: ['#22c55e', '#4ade80'],
      trend: getLogicalKpiTrend('inorg', context)
    },
    {
      id: 'conversion',
      title: 'Conversion',
      value: `${getLogicalKpiValue('conversion', context)}%`,
      delta: getLogicalKpiValue('convdelta', context) * 2,
      deltaLabel: `+${(getLogicalKpiValue('convdelta', context) / 30).toFixed(1)}%`,
      icon: Target,
      gradient: ['#06b6d4', '#22d3ee'],
      trend: getLogicalKpiTrend('conversion', context)
    },
    {
      id: 'roas',
      title: 'ROAS',
      value: `${getLogicalKpiValue('roas', context)}x`,
      delta: getLogicalKpiValue('roasdelta', context) * 1.5,
      deltaLabel: `+${(getLogicalKpiValue('roasdelta', context) / 20).toFixed(1)}x`,
      icon: DollarSign,
      gradient: ['#eab308', '#facc15'],
      trend: getLogicalKpiTrend('roas', context)
    },
  ], [selectedChannel, platform, selectedBrand, selectedLocation, timeStart, timeEnd]);

  const FORMAT_ROWS = useMemo(() => {
    const row = (name, key) => {
      const ctx = { ...context, entityKey: key };
      return { name, offtakes: getLogicalKpiValue('offtakes', ctx), spend: getLogicalKpiValue('spend', ctx), roas: getLogicalKpiValue('roas', ctx), inorgSalesPct: getLogicalKpiValue('inorg', ctx), conversionPct: getLogicalKpiValue('conversion', ctx), marketSharePct: getLogicalKpiValue('market', ctx), promoMyBrandPct: getLogicalKpiValue('promo', ctx), promoCompetePct: getLogicalKpiValue('promoCompete', ctx), cpm: getLogicalKpiValue('cpm', ctx), cpc: getLogicalKpiValue('cpc', ctx) };
    };
    return [
      row("Cassata", "cassata"),
      row("Core Tub", "core tub"),
      row("Cornetto", "cornetto"),
      row("Cup", "cup"),
      row("KW Sticks", "kw sticks"),
      row("Magnum", "magnum"),
      row("Sandwich", "sandwich"),
      row("Family Pack", "family pack"),
      row("Chocobar", "chocobar"),
      row("Kulfi", "kulfi"),
      row("Jelly Cups", "jelly cups"),
      row("Brownie Tub", "brownie tub"),
      row("Exotics", "exotics"),
      row("Others", "others"),
    ];
  }, [selectedChannel, platform, selectedBrand, selectedLocation, timeStart, timeEnd]);


  // Update filters when context changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      platform: platform,
      brand: selectedBrand,
      keyword: selectedKeyword,
      location: selectedLocation,
      startDate: timeStart ? timeStart.format("YYYY-MM-DD") : null,
      endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : null,
      compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : null,
      compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : null,
    }));
  }, [
    selectedBrand,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    platform,
    selectedKeyword,
    selectedLocation,
  ]);

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
        {/* {loading ? (
          <Loader message="Fetching Watch Tower Insights..." />
        ) : (
          <CardMetric
            data={dashboardData.topMetrics}
            onViewTrends={handleViewTrends}
          />
        )} */}

        {loading ? (
          <Loader message="Fetching Watch Tower Insights..." />
        ) : (
          <SnapshotOverview
            title="Watchtower Overview"
            icon={LayoutGrid}
            chip="All Platforms"
            headerRight={
              <span className="px-4 py-1.5 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 uppercase tracking-tight">
                vs Previous Month
              </span>
            }
            kpis={COMPARISON_KPIS}
            variant="watchtower"
            seed={platform}
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
              setRcaModalTitle(`${label} x ${filters.platform}`);
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
                setRcaModalTitle(`${label} x ${filters.platform}`);
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

          <FormatPerformanceStudio rows={FORMAT_ROWS} />

          {/* {activeTab === "sku" && (
            <Box sx={{ p: 3 }}>
              <SKUTable data={dashboardData.skuTable} />
            </Box>
          )} */}
        </Box>
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
        dynamicKey="platform_overview_tower"
        brandOptions={defaultBrands.map(b => b.label)}
      />

      <RCAModal
        open={rcaModalOpen}
        onClose={() => setRcaModalOpen(false)}
        title={rcaModalTitle}
      />
    </>
  );
}

const FormatPerformanceStudio = ({ rows }) => {
  const [activeName, setActiveName] = useState(rows[0]?.name);
  const [compareName, setCompareName] = useState(null);

  const active = useMemo(
    () => rows.find((f) => f.name === activeName) ?? rows[0],
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
    Number.isFinite(value) ? value.toLocaleString("en-IN") : "NaN";
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const pct = (value) =>
    Number.isFinite(value) ? `${value.toFixed(1)}%` : "NaN";
  const [visibleCount, setVisibleCount] = useState(7);
  const visibleItems = rows.slice(0, visibleCount);
  const total = rows.length;

  const kpiBands = [
    {
      key: "offtakes",
      label: "Offtakes",
      activeValue: active.offtakes,
      compareValue: compare?.offtakes ?? null,
      max: 100,
      format: (v) => `${v}`,
    },
    {
      key: "spend",
      label: "Spend",
      activeValue: active.spend,
      compareValue: compare?.spend ?? null,
      max: 20,
      format: (v) => `₹${v}`,
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
      activeValue: active.cpm,
      compareValue: compare?.cpm ?? null,
      max: 800,
      format: (v) => `${v}`,
    },
    {
      key: "cpc",
      label: "CPC",
      activeValue: active.cpc,
      compareValue: compare?.cpc ?? null,
      max: 5000,
      format: (v) =>
        Number.isFinite(v) ? v.toLocaleString("en-IN") : "Infinity",
    },
  ];
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
        </div>

        <div className="space-y-2 max-h-150 overflow-y-auto pr-1 ">
          {rows.map((f, index) => {
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
                  {formatNumber(active.offtakes)}
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
    </motion.div>
  );
};
