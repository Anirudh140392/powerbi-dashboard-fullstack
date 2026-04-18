import React, { useMemo, useState, useEffect, useRef, useContext } from "react";
import { Skeleton } from "@mui/material";
import { FilterContext } from "../../utils/FilterContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LayoutGrid, Layers, TrendingUp, PieChart, ChevronDown, Check } from "lucide-react";
import { DualAxisDrillMatrix } from "./PowerBiDashboard";
import axiosInstance from "../../api/axiosInstance";
import SnapshotOverview from "../CommonLayout/SnapshotOverview";
import MarketCatOverview from "./MarketCatOverview";
import TrendsCompetitionDrawer from "../AllAvailablityAnalysis/TrendsCompetitionDrawer";
import MarketShareDrilldown from "./MarketShareDrilldown";
import SubCategoryMarket from "./SubCategoryMarket";

const marketShareKpis = [
  {
    id: "ms-category-size",
    title: "Category Size (Cr)",
    value: "₹ 220.22 Cr",
    subtitle: "Total category size across all platforms",
    delta: 73.8,
    deltaLabel: "▲ 73.8% (₹126.72 Cr)",
    icon: Layers,
    gradient: ["#6366f1", "#8b5cf6"],
    extraChangeColor: "green",
    prevText: "vs Comparison Period",
  },
  {
    id: "ms-leader-sales",
    title: "Market Leader Sales (Cr)",
    value: "₹ 77.46 Cr",
    subtitle: "Sales of the market leading brand",
    brand: "Amul",
    delta: 91.1,
    deltaLabel: "▲ 91.1% (₹40.53 Cr)",
    icon: TrendingUp,
    gradient: ["#14b8a6", "#06b6d4"],
    extraChangeColor: "green",
    prevText: "vs Comparison Period",
  },
  {
    id: "ms-mars-wrigley",
    title: "Our Estimated Sales (Cr)",
    value: "₹ 6.90 Cr",
    subtitle: "Our brand estimated sales performance",
    delta: 38.1,
    deltaLabel: "▲ 38.1% (₹4.88 Cr)",
    icon: PieChart,
    gradient: ["#f43f5e", "#ec4899"],
    extraChangeColor: "green",
    prevText: "vs Comparison Period",
  },
];

const stats = [
  { label: "Darkstore Count", value: "1829" },
  { label: "My brand Listings", value: "180" },
  { label: "Top 5 Compete #Listing", value: "113" },
  { label: "Leader Brand", value: "Amul" },
  { label: "KW Market Share (Blinkit)", value: "19.6%" },
  { label: "KW Market Share (Instamart)", value: "18.7%" },
  { label: "KW Market Share (Zepto)", value: "24.9%" },
];

const platformShare = [
  { platform: "Blinkit", q1: 11, q2: 18, q3: 21, q4: 21 },
  { platform: "Instamart", q1: 18, q2: 19, q3: 19, q4: 19 },
  { platform: "Zepto", q1: 26, q2: 25, q3: 25, q4: 25 },
];

const brandShareHeat = [
  { brand: "Amul", values: [23, 23, 23, 21, 23, 20, 22, 21, 20] },
  { brand: "Kwality Walls", values: [11, 15, 19, 21, 21, 22, 21, 21, 18] },
  { brand: "Baskin Robbins", values: [7, 7, 6, 7, 7, 7, 7, 11, 13] },
  { brand: "Cream Bell", values: [3, 8, 9, 8, 6, 7, 7, 6, 7] },
  { brand: "Havmor", values: [9, 5, 5, 5, 5, 5, 5, 6, 7] },
];

/* Sub-category → brand sets for TwoUp charts */
const subCategoryBrandHeat = {
  Candies: [
    { brand: "Cadbury", values: [35, 34, 33, 35, 36, 35, 34, 33, 35] },
    { brand: "Ferrero", values: [24, 25, 24, 23, 24, 25, 24, 25, 24] },
    { brand: "Lindt", values: [7, 6, 7, 6, 7, 6, 7, 7, 6] },
    { brand: "Nestle", values: [5, 6, 5, 5, 5, 6, 5, 5, 5] },
    { brand: "Mars", values: [3, 3, 4, 3, 3, 3, 4, 3, 3] },
  ],
  'Filled Bars': [
    { brand: "Snickers", values: [28, 27, 29, 28, 29, 28, 28, 27, 28] },
    { brand: "KitKat", values: [22, 23, 22, 21, 22, 23, 22, 22, 21] },
    { brand: "Twix", values: [13, 12, 13, 13, 12, 13, 12, 13, 12] },
    { brand: "Bounty", values: [9, 8, 9, 8, 9, 8, 9, 8, 9] },
    { brand: "Milky Way", values: [5, 6, 5, 5, 6, 5, 5, 6, 5] },
  ],
  Gums: [
    { brand: "Orbit", values: [33, 32, 33, 32, 33, 32, 33, 32, 33] },
    { brand: "Mentos", values: [19, 18, 19, 19, 18, 19, 18, 19, 18] },
    { brand: "Center Fresh", values: [14, 15, 14, 14, 15, 14, 15, 14, 14] },
    { brand: "Happydent", values: [10, 11, 10, 10, 11, 10, 11, 10, 10] },
    { brand: "Boomer", values: [7, 8, 7, 7, 8, 7, 7, 8, 7] },
  ],
  'Gift Packs': [
    { brand: "Cadbury Celebrations", values: [42, 41, 43, 42, 42, 41, 43, 42, 42] },
    { brand: "Ferrero Rocher", values: [23, 22, 23, 22, 23, 23, 22, 23, 22] },
    { brand: "Toblerone", values: [11, 12, 11, 12, 11, 11, 12, 11, 12] },
    { brand: "Lindt Box", values: [9, 9, 8, 9, 9, 9, 8, 9, 9] },
    { brand: "Mars Assorted", values: [6, 5, 6, 5, 6, 5, 6, 5, 6] },
  ],
  Others: [
    { brand: "Amul", values: [19, 18, 19, 18, 19, 18, 19, 18, 19] },
    { brand: "Parle", values: [14, 15, 14, 14, 15, 14, 15, 14, 14] },
    { brand: "ITC", values: [11, 10, 11, 11, 10, 11, 10, 11, 10] },
    { brand: "Britannia", values: [8, 9, 8, 8, 9, 8, 9, 8, 8] },
    { brand: "Haldirams", values: [7, 6, 7, 6, 7, 6, 7, 6, 7] },
  ],
};
const subCatOptions = Object.keys(subCategoryBrandHeat);

const zones = ["North", "East", "South", "West"];
const months = [
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
];

const ourBrandZone = [
  [13, 18, 22, 22, 25, 25, 22, 17, 0],
  [26, 23, 22, 20, 22, 20, 22, 20, 17],
  [11, 16, 19, 20, 21, 21, 20, 21, 19],
  [19, 21, 19, 20, 20, 20, 20, 20, 18],
];

const competeBrandZone = [
  [74, 77, 78, 80, 78, 80, 83],
  [86, 82, 77, 77, 74, 75, 78, 83],
  [88, 83, 81, 80, 79, 79, 80, 81],
  [81, 79, 81, 80, 80, 80, 80, 82],
];

const categoryShare = [
  { category: "Cassata", values: [8, 21, 22, 12, 8, 10, 10, 0, 0] },
  { category: "Cone", values: [10, 24, 33, 34, 32, 33, 33, 30, 0] },
  { category: "Cup", values: [3, 2, 2, 4, 4, 5, 4, 4, 0] },
  { category: "Sandwich", values: [21, 4, 6, 10, 13, 12, 12, 0, 0] },
  { category: "Sticks", values: [19, 23, 29, 28, 29, 29, 28, 27, 0] },
  { category: "Tubs", values: [10, 15, 14, 17, 20, 19, 18, 18, 0] },
];

const categoryShareSelected = [
  {
    category: "Bon Bon/ Mini Bites",
    values: [100, 100, 100, 100, 100, 100, 100, 100, 0],
  },
  { category: "Cakes", values: [100, 100, 100, 100, 100, 100, 100, 100, 0] },
  { category: "Cassata", values: [92, 79, 78, 89, 91, 88, 90, 0, 0] },
  {
    category: "Cheesecakes & Pastries",
    values: [100, 100, 100, 100, 100, 100, 100, 100, 0],
  },
  { category: "Cone", values: [100, 97, 96, 96, 96, 96, 95, 96, 0] },
  { category: "Cup", values: [97, 98, 99, 96, 95, 96, 95, 97, 0] },
  { category: "Others", values: [88, 84, 81, 79, 78, 77, 78, 0, 0] },
];

const skuCountsOwn = [
  { category: "Cassata", value: 9 },
  { category: "Cone", value: 70 },
  { category: "Cup", value: 43 },
  { category: "Others", value: 4 },
  { category: "Sandwich", value: 9 },
  { category: "Sticks", value: 59 },
  { category: "Tubs", value: 113 },
];

const skuCountsComp = [
  { category: "Bon Bon/ Mini Bites", value: 32 },
  { category: "Cakes", value: 88 },
  { category: "Cassata", value: 60 },
  { category: "Cheesecakes & Pastries", value: 35 },
  { category: "Cone", value: 410 },
  { category: "Cup", value: 666 },
  { category: "Others", value: 2637 },
  { category: "Sandwich", value: 102 },
  { category: "Sticks", value: 636 },
  { category: "Tubs", value: 528 },
];

const marketShareTrendKW = months.map((m, idx) => ({
  month: m,
  share: [11, 15, 19, 21, 21, 22, 21, 21, 18][idx],
}));

const marketShareTrendMulti = months.map((m, idx) => ({
  month: m,
  "14th Century": [20, 23, 23, 23, 21, 23, 20, 22, 20][idx] || 0,
  Amul: [7, 6, 7, 7, 7, 9, 7, 8, 7][idx] || 0,
  Apsara: [4, 5, 5, 5, 6, 5, 6, 5, 5][idx] || 0,
}));

const stackedLocations = [
  { zone: "East", Kwality: 28, Havmor: 25, Cream: 7, Amul: 7, Others: 33 },
  { zone: "North", Kwality: 28, Havmor: 28, Cream: 7, Amul: 7, Others: 30 },
  { zone: "South", Kwality: 24, Havmor: 25, Cream: 6, Amul: 5, Others: 40 },
  { zone: "West", Kwality: 28, Havmor: 23, Cream: 8, Amul: 5, Others: 36 },
];

const listingRows = [
  {
    product: "Magnum Butterscotch Frozen Dessert Cone",
    listed: 213,
    saliency: 6,
    coverage: 33,
    osa: 23,
    remaining: 423,
  },
  {
    product: "Magnum Chocolate Truffle Ice Cream Stick",
    listed: 402,
    saliency: 5,
    coverage: 63,
    osa: 40,
    remaining: 234,
  },
  {
    product: "Feast Cadbury Crackle Frozen Dessert Bar",
    listed: 206,
    saliency: 4,
    coverage: 32,
    osa: 22,
    remaining: 430,
  },
  {
    product: "Magnum Brownie Ice Cream Stick",
    listed: 428,
    saliency: 4,
    coverage: 67,
    osa: 35,
    remaining: 208,
  },
  {
    product: "Cornetto Oreo Frozen Dessert Cone",
    listed: 206,
    saliency: 3,
    coverage: 32,
    osa: 22,
    remaining: 430,
  },
  {
    product: "Magnum Pistachio Ice Cream Stick",
    listed: 561,
    saliency: 3,
    coverage: 88,
    osa: 50,
    remaining: 75,
  },
  {
    product: "Dairy Factory Vanilla Ice Cream Tub",
    listed: 376,
    saliency: 3,
    coverage: 59,
    osa: 14,
    remaining: 260,
  },
  {
    product: "Cornetto Double Chocolate Frozen Dessert Cone",
    listed: 419,
    saliency: 3,
    coverage: 66,
    osa: 51,
    remaining: 217,
  },
];

const activePincodes = [
  { pincode: "101301", state: "Haryana", city: "Gurugram" },
  { pincode: "110001", state: "Delhi NCR", city: "Delhi" },
  { pincode: "110002", state: "Delhi NCR", city: "Delhi" },
  { pincode: "110003", state: "Delhi NCR", city: "Delhi" },
];

const inactivePincodes = [
  { pincode: "101301", state: "Haryana", city: "Gurugram" },
  { pincode: "110001", state: "Delhi NCR", city: "Delhi" },
  { pincode: "110002", state: "Delhi NCR", city: "Delhi" },
];

const palette = [
  "#4b6b9b",
  "#c27a3a",
  "#3f9ca8",
  "#6ca06b",
  "#9b84b3",
  "#efbf6b",
  "#d67c7c",
];

const heatCell = (v, max = 100) => {
  const t = Math.min(1, Math.max(0, v / max));
  const start = [255, 255, 255];
  const end = [27, 115, 80];
  const mix = start.map((s, i) => Math.round(s + (end[i] - s) * t));
  return `rgb(${mix.join(",")})`;
};

export default function MarketShareAnalysis() {
  const [showFilters, setShowFilters] = useState(false);
  const [marketMode, setMarketMode] = useState("geographical");
  const [loading, setLoading] = useState(true);

  // Derive display name from the logged-in user's dbName
  const dbDisplayName = useMemo(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user'));
      if (u?.dbName) {
        if (u.dbName.toLowerCase() === 'mamaearth') {
          return 'The Derma Co.';
        }
        return u.dbName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      }
    } catch { /* ignore */ }
    return 'Our';
  }, []);

  // Use state for KPIs to allow dynamic updates from backend
  const [kpis, setKpis] = useState(() =>
    marketShareKpis.map(k =>
      k.id === 'ms-mars-wrigley'
        ? { ...k, title: `${dbDisplayName} Estimated Sales (Cr)`, subtitle: `${dbDisplayName} brand estimated sales performance` }
        : k
    )
  );

  const {
    platform,
    selectedCategory,
    selectedLocation,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
  } = useContext(FilterContext);

  // ── Drawer state for MarketCatOverview trends ──────────────────────────────
  const [trendsDrawer, setTrendsDrawer] = useState({ open: false, entity: '', dimension: '' });

  const handleViewTrends = (entityName, dimensionLabel) => {
    setTrendsDrawer({ open: true, entity: entityName, dimension: dimensionLabel });
  };

  const handleViewRca = (entityName, dimensionLabel) => {
    // RCA drawer placeholder — can be wired later
  };

  useEffect(() => {
    const fetchMarketShareData = async () => {
      setLoading(true);
      try {
        const params = {
          platform: platform === 'All' ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
          category: selectedCategory === 'All' ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
          location: undefined, // Enforced isolation from global location filter
          startDate: timeStart ? timeStart.format("YYYY-MM-DD") : null,
          endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : null,
          compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : null,
          compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : null,
        };

        const response = await axiosInstance.get('/market-share', { params });
        console.log("Market Share Data:", response.data);

        if (response.data) {
          setKpis(prev => prev.map(k => {
            // Category Size KPI
            if (k.id === "ms-category-size" && response.data.categorySize !== undefined) {
              const catData = response.data.categorySize;
              const val = catData.size || 0;
              const formattedValue = val > 10000000
                ? `₹ ${(val / 10000000).toFixed(2)} Cr`
                : val > 100000
                  ? `₹ ${(val / 100000).toFixed(2)} L`
                  : `₹ ${val.toFixed(2)}`;

              const prevValueCr = catData.prevSize > 10000000
                ? `₹${(catData.prevSize / 10000000).toFixed(2)} Cr`
                : catData.prevSize > 100000
                  ? `₹${(catData.prevSize / 100000).toFixed(2)} L`
                  : `₹${catData.prevSize.toFixed(2)}`;

              const arrow = catData.delta >= 0 ? '▲' : '▼';

              return {
                ...k,
                value: formattedValue,
                delta: catData.delta,
                deltaLabel: `${arrow} ${Math.abs(catData.delta)}% (${prevValueCr})`,
                extraChangeColor: catData.delta >= 0 ? "green" : "red",
                trend: catData.trend,
              };
            }

            // Market Leader Sales KPI
            if (k.id === "ms-leader-sales" && response.data.marketLeader) {
              const leader = response.data.marketLeader;
              const val = leader.sales;
              const formattedValue = val > 10000000
                ? `₹ ${(val / 10000000).toFixed(2)} Cr`
                : val > 100000
                  ? `₹ ${(val / 100000).toFixed(2)} L`
                  : `₹ ${val.toFixed(2)}`;

              const prevValueCr = leader.prevSales > 10000000
                ? `₹${(leader.prevSales / 10000000).toFixed(2)} Cr`
                : leader.prevSales > 100000
                  ? `₹${(leader.prevSales / 100000).toFixed(2)} L`
                  : `₹${leader.prevSales.toFixed(2)}`;

              const arrow = leader.delta >= 0 ? '▲' : '▼';
              return {
                ...k,
                value: formattedValue,
                brand: leader.brand,
                delta: leader.delta,
                deltaLabel: `${arrow} ${Math.abs(leader.delta)}% (${prevValueCr})`,
                extraChangeColor: leader.delta >= 0 ? "green" : "red",
                trend: leader.trend,
              };
            }

            // Mars Wrigley Sales KPI
            if (k.id === "ms-mars-wrigley" && response.data.marsWrigley) {
              const mars = response.data.marsWrigley;
              const val = mars.sales;
              const formattedValue = val > 10000000
                ? `₹ ${(val / 10000000).toFixed(2)} Cr`
                : val > 100000
                  ? `₹ ${(val / 100000).toFixed(2)} L`
                  : `₹ ${val.toFixed(2)}`;

              const prevValueCr = mars.prevSales > 10000000
                ? `₹${(mars.prevSales / 10000000).toFixed(2)} Cr`
                : mars.prevSales > 100000
                  ? `₹${(mars.prevSales / 100000).toFixed(2)} L`
                  : `₹${mars.prevSales.toFixed(2)}`;

              const arrow = mars.delta >= 0 ? '▲' : '▼';
              return {
                ...k,
                value: formattedValue,
                delta: mars.delta,
                deltaLabel: `${arrow} ${Math.abs(mars.delta)}% (${prevValueCr})`,
                extraChangeColor: mars.delta >= 0 ? "green" : "red",
                trend: mars.trend,
              };
            }

            return k;
          }));
        }
      } catch (error) {
        console.error("Error fetching Market Share data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketShareData();
  }, [platform, selectedCategory, selectedLocation, timeStart, timeEnd, compareStart, compareEnd]);


  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 px-3 md:px-6 py-3 md:py-5 flex flex-col gap-1 md:gap-0">
      {/* <HeaderStats /> */}
      <SnapshotOverview
        loading={loading}
        title="Market Share Overview"
        icon={LayoutGrid}
        chip="All Platforms"
        headerRight={
          <span className="px-4 py-1.5 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 uppercase tracking-tight">
            vs Comparison Period
          </span>
        }
        kpis={kpis}
        variant="detailed"
      />

      <MarketCatOverview
        loading={loading}
        onViewTrends={handleViewTrends}
        onViewRca={handleViewRca}
      />

      {/* <MarketShareDrilldown loading={loading} /> */}
      <SubCategoryMarket loading={loading} />

      {/* <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
        <div className="text-sm font-semibold">
          Dual-axis drill (platform × months)
        </div>
        <div className="text-[11px] text-slate-500">
          Collapse/expand quarters, drill rows down to city.
        </div>
        <DualAxisDrillMatrix />
      </div> */}

      {/* <div className="space-y-4 mt-6">
        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 p-4 space-y-4">
          <div className="flex justify-center">
            <div className="relative w-full md:w-[420px]">
              <div className="relative flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                <motion.div
                  layout
                  className="absolute top-1 bottom-1 w-1/2 rounded-full bg-white shadow-sm"
                  initial={false}
                  animate={{ x: marketMode === "geographical" ? 0 : "100%" }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                />

                {[
                  { key: "geographical", label: "Geographical market share" },
                  { key: "coverage", label: "Listing coverage" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMarketMode(option.key)}
                    className={\`relative z-10 flex-1 rounded-full px-3 py-2 transition-colors \${marketMode === option.key
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                      }\`}
                    aria-pressed={marketMode === option.key}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {marketMode === "geographical" ? (
            <>

              {loading ? <Skeleton variant="rectangular" height={400} /> : <TwoUp />}
            </>
          ) : (
            <>
              {loading ? <Skeleton variant="rectangular" height={300} /> : <ListingTable />}
              {loading ? <Skeleton variant="rectangular" height={300} /> : <PincodeLists />}
            </>
          )}
        </div>
      </div> */}

      {/* <button
        onClick={() => setShowFilters(true)}
        className="fixed bottom-4 right-4 md:bottom-8 md:right-8 h-12 w-12 md:h-14 md:w-14 rounded-full bg-emerald-500 text-white shadow-[0_18px_40px_rgba(16,185,129,0.45)] flex items-center justify-center text-xl font-bold z-40"
      >
        ⋮
      </button> */}

      {showFilters && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-[85vw] md:w-96 h-full bg-white shadow-2xl border-l border-slate-200 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Filters
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  Tune the market view
                </div>
              </div>

              <button
                className="text-slate-400 hover:text-slate-700 text-lg"
                onClick={() => setShowFilters(false)}
              >
                ×
              </button>
            </div>

            <FilterPane />
          </div>
        </div>
      )}

      {/* Market Share Trends Drawer */}
      <TrendsCompetitionDrawer
        dynamicKey="marketshare"
        open={trendsDrawer.open}
        onClose={() => setTrendsDrawer({ open: false, entity: '', dimension: '' })}
        selectedColumn={trendsDrawer.entity}
        selectedLevel={trendsDrawer.dimension}
      />
    </div>
  );
}

function HeaderStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 flex flex-col gap-1"
        >
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {stat.label}
          </div>
          <div className="text-2xl font-semibold">{stat.value}</div>
          {stat.sub && <div className="text-xs text-slate-500">{stat.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function LeftColumn() {
  return (
    <div className="space-y-4">
      <TwoUp />
      <ZoneTables />
      <CategoryTables />

      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
        <div className="text-sm font-semibold">
          Dual-axis drill (platform × months)
        </div>
        <div className="text-[11px] text-slate-500">
          Collapse/expand quarters, drill rows down to city.
        </div>
        <DualAxisDrillMatrix />
      </div>

      <SkuTables />
      <TrendCharts />
      <LocationStack />
      <ListingTable />
      <PincodeLists />
    </div>
  );
}

function TwoUp() {
  const [view, setView] = useState("chart");
  const [timeRange, setTimeRange] = useState("Month");
  const [selectedSubCat, setSelectedSubCat] = useState("Candies");
  const [isSubCatOpen, setIsSubCatOpen] = useState(false);
  const subCatRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (subCatRef.current && !subCatRef.current.contains(e.target))
        setIsSubCatOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeBrandHeat = subCategoryBrandHeat[selectedSubCat] || brandShareHeat;

  // --- Dynamic Data Generation based on Time Range ---
  const currentPlatformChartData = useMemo(() => {
    if (timeRange === "Day") {
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => ({
        label: day,
        Blinkit: [15, 17, 18, 16, 19, 21, 20][idx],
        Instamart: [18, 18, 19, 19, 18, 17, 18][idx],
        Zepto: [24, 25, 24, 25, 26, 25, 25][idx],
      }));
    }
    if (timeRange === "Week") {
      return ["W1", "W2", "W3", "W4"].map((week, idx) => ({
        label: week,
        Blinkit: [16, 18, 20, 21][idx],
        Instamart: [19, 19, 18, 18][idx],
        Zepto: [25, 24, 25, 25][idx],
      }));
    }
    if (timeRange === "Quarterly") {
      return ["Q1", "Q2", "Q3", "Q4"].map((quarter, idx) => {
        const row = { label: quarter };
        platformShare.forEach((p) => {
          const vals = [p.q1, p.q2, p.q3, p.q4];
          row[p.platform] = vals[idx];
        });
        return row;
      });
    }
    // Default: Month (using existing data pattern)
    return months.slice(0, 7).map((m, idx) => ({
      label: m,
      Blinkit: [11, 15, 19, 21, 21, 22, 21][idx],
      Instamart: [18, 19, 19, 19, 18, 18, 19][idx],
      Zepto: [26, 25, 25, 25, 26, 24, 25][idx],
    }));
  }, [timeRange]);

  const currentBrandChartData = useMemo(() => {
    const brands = activeBrandHeat.map(b => b.brand);
    let labels = [];

    if (timeRange === "Day") {
      labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    } else if (timeRange === "Week") {
      labels = ["W1", "W2", "W3", "W4"];
    } else if (timeRange === "Quarterly") {
      labels = ["Q1", "Q2", "Q3", "Q4"];
    } else {
      labels = months.slice(2);
    }

    return labels.map((label, idx) => {
      const row = { label };
      activeBrandHeat.forEach((b) => {
        // Derive values from the heat data, cycling if index exceeds length
        row[b.brand] = b.values[idx % b.values.length] || 0;
      });
      return row;
    });
  }, [timeRange, selectedSubCat]);

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Trends
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Platforms + Brands
          </div>
        </div>

        {/* FILTERS ROW - Sub-Category + Time Range */}
        <div className="flex-1 flex justify-center items-center gap-3">
          {/* Sub-Category dropdown */}
          <div className="relative" ref={subCatRef}>
            <button
              onClick={() => setIsSubCatOpen(!isSubCatOpen)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 border shadow-sm ${isSubCatOpen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider opacity-60">Sub-Cat:</span>
              <span>{selectedSubCat}</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${isSubCatOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isSubCatOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-1.5">
                    {subCatOptions.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedSubCat(cat); setIsSubCatOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-semibold transition-all duration-150 ${selectedSubCat === cat
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                      >
                        <span>{cat}</span>
                        {selectedSubCat === cat && <Check size={12} className="text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Time range tabs */}
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px] font-semibold text-slate-600">
            {["Day", "Week", "Month", "Quarterly"].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1 rounded-full transition-all duration-200 ${timeRange === range
                  ? "bg-white shadow-sm border border-slate-200 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>

          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* PLATFORM SHARE CHART */}
          <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-700">
                Platform share by {timeRange.toLowerCase()}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-[#4b6b9b]" /> Blinkit
                <span className="h-2 w-2 rounded-full bg-[#c27a3a]" /> Instamart
                <span className="h-2 w-2 rounded-full bg-[#3f9ca8]" /> Zepto
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={currentPlatformChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip formatter={(val) => [`${val}%`, "Market share"]} />

                <Area
                  type="monotone"
                  dataKey="Blinkit"
                  stroke="#4b6b9b"
                  fill="rgba(75,107,155,0.2)"
                  strokeWidth={2.2}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="Instamart"
                  stroke="#c27a3a"
                  fill="rgba(194,122,58,0.2)"
                  strokeWidth={2.2}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="Zepto"
                  stroke="#3f9ca8"
                  fill="rgba(63,156,168,0.2)"
                  strokeWidth={2.2}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* BRAND SHARE STACKED BAR */}
          <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-700">
                Brand share heat ({timeRange.toLowerCase()})
              </div>
              <div className="text-[10px] text-slate-500">Hover to inspect</div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={currentBrandChartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip formatter={(val, name) => [`${val}%`, name]} />

                {activeBrandHeat.map((b, idx) => (
                  <Bar
                    key={b.brand}
                    dataKey={b.brand}
                    stackId="stack"
                    fill={palette[idx % palette.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* TABLE MODE */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Platform table */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="text-sm font-semibold">
              Market Share Across Platforms ({timeRange})
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] min-w-[300px]">
                <thead>
                  <tr>
                    <th className="text-left text-slate-500 pb-1">Platform</th>
                    {currentPlatformChartData.map((d) => (
                      <th key={d.label} className="text-right text-slate-500 pb-1">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {["Blinkit", "Instamart", "Zepto"].map((plat) => (
                    <tr key={plat} className="odd:bg-slate-50/70">
                      <td className="py-1 text-slate-800">{plat}</td>
                      {currentPlatformChartData.map((d, i) => (
                        <td key={i} className="text-right py-1 text-slate-700">
                          {d[plat]}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Brand heat table */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="text-sm font-semibold">
              Market Share Across Brands ({timeRange})
            </div>
            <DynamicHeatTable rows={activeBrandHeat} data={currentBrandChartData} brands={activeBrandHeat.map(b => b.brand)} max={30} />
          </div>
        </div>
      )}
    </div>
  );
}

function DynamicHeatTable({ rows, data, brands, max }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-max text-[11px] text-left">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2 text-slate-600">Brand</th>
            {data.map((d) => (
              <th key={d.label} className="px-2 py-2 text-slate-600 text-center">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {brands.map((brand) => (
            <tr key={brand} className="odd:bg-slate-50/70">
              <td className="px-2 py-2 font-medium text-slate-800">
                {brand}
              </td>

              {data.map((d, idx) => {
                const v = d[brand];
                return (
                  <td key={idx} className="px-1 py-1 text-center">
                    <div
                      className="rounded-md border border-white/60 text-[10px] font-semibold"
                      style={{
                        background: heatCell(v, max),
                        color: v > max * 0.55 ? "#fff" : "#0f172a",
                      }}
                    >
                      {v}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatTable({ rows, cols, max }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-max text-[11px] text-left">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2 text-slate-600">Brand</th>
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 text-slate-600 text-center">
                {c}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.brand} className="odd:bg-slate-50/70">
              <td className="px-2 py-2 font-medium text-slate-800">
                {row.brand}
              </td>

              {row.values.map((v, idx) => (
                <td key={idx} className="px-1 py-1 text-center">
                  <div
                    className="rounded-md border border-white/60 text-[10px] font-semibold"
                    style={{
                      background: heatCell(v, max),
                      color: v > max * 0.55 ? "#fff" : "#0f172a",
                    }}
                  >
                    {v}%
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ZoneTables() {
  const [view, setView] = useState("chart");

  const ourBrandChartData = months.map((m, idx) => {
    const row = { month: m };
    zones.forEach((z, zoneIdx) => {
      row[z] = ourBrandZone[zoneIdx]?.[idx] ?? 0;
    });
    return row;
  });

  const compBrandChartData = months.map((m, idx) => {
    const row = { month: m };
    zones.forEach((z, zoneIdx) => {
      row[z] = competeBrandZone[zoneIdx]?.[idx] ?? 0;
    });
    return row;
  });

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Zone story
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Our Brand & Compete
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-3">
            <div className="text-xs font-semibold text-slate-700 mb-1">
              Our Brand by zone
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={ourBrandChartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip formatter={(val, name) => [`${val}%`, name]} />
                {zones.map((z, idx) => (
                  <Area
                    key={z}
                    type="monotone"
                    dataKey={z}
                    stroke={palette[idx % palette.length]}
                    fill={palette[idx % palette.length] + "33"}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-700 mb-1">
              Compete Brand by zone
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={compBrandChartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip formatter={(val, name) => [`${val}%`, name]} />
                {zones.map((z, idx) => (
                  <Area
                    key={z}
                    type="monotone"
                    dataKey={z}
                    stroke={palette[(idx + 3) % palette.length]}
                    fill={palette[(idx + 3) % palette.length] + "33"}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ZoneTable title="Our Brand" data={ourBrandZone} />
          <ZoneTable title="Compete Brand" data={competeBrandZone} />
        </div>
      )}
    </div>
  );
}

function ZoneTable({ title, data }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[300px] text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-2 py-2 text-slate-600">Zone</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-slate-600 text-right">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => (
              <tr key={z} className="odd:bg-slate-50/60">
                <td className="px-2 py-1 font-medium text-slate-800">{z}</td>
                {data[i].map((v, idx) => (
                  <td key={idx} className="px-2 py-1 text-right text-slate-700">
                    {v}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryTables() {
  const [view, setView] = useState("chart");

  const chartData = (rows) =>
    rows.map((r) => ({
      category: r.category,
      avg: Math.round(
        r.values.reduce((a, b) => a + b, 0) / (r.values.length || 1)
      ),
    }));

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Category view
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Market share across category
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[
            { title: "Across Category", data: categoryShare },
            { title: "Selection Basics", data: categoryShareSelected },
          ].map((block, idx) => (
            <div
              key={block.title}
              className="rounded-xl border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-3"
            >
              <div className="text-xs font-semibold text-slate-700 mb-2">
                {block.title}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData(block.data)}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    width={100}
                  />
                  <Tooltip formatter={(val) => [`${val}%`, "Avg share"]} />
                  <Bar
                    dataKey="avg"
                    fill={idx === 0 ? "#3f9ca8" : "#9b84b3"}
                    radius={[4, 4, 4, 4]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <CategoryTable
            title="Market Share Across Category"
            rows={categoryShare}
          />
          <CategoryTable
            title="Market Share Across Category (Selection Basics)"
            rows={categoryShareSelected}
          />
        </div>
      )}
    </div>
  );
}

function CategoryTable({ title, rows }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-max text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left text-slate-600">Category</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-right text-slate-600">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="odd:bg-slate-50/70">
                <td className="px-2 py-2 font-medium text-slate-800">
                  {row.category}
                </td>
                {row.values.map((v, i) => (
                  <td key={i} className="px-2 py-1 text-right text-slate-700">
                    {v}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkuTables() {
  const [view, setView] = useState("chart");

  const chartData = (rows) =>
    rows.map((r) => ({
      category: r.category,
      value: r.value,
    }));

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            SKU depth
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Count of SKUs across categories
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[
            { title: "Own Brand", data: skuCountsOwn },
            { title: "Competes", data: skuCountsComp },
          ].map((block, idx) => (
            <div
              key={block.title}
              className="rounded-xl border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-amber-50 p-3"
            >
              <div className="text-xs font-semibold text-slate-700 mb-2">
                {block.title}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData(block.data)}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill={idx === 0 ? "#4b6b9b" : "#c27a3a"}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SkuTable
            title="Count of SKUs across Categories - Own Brand"
            rows={skuCountsOwn}
            totalLabel="307"
          />
          <SkuTable
            title="Count of SKUs across Categories - Competes"
            rows={skuCountsComp}
            totalLabel="5294"
          />
        </div>
      )}
    </div>
  );
}

function SkuTable({ title, rows, totalLabel }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left text-slate-600">Category</th>
              <th className="px-2 py-2 text-right text-slate-600">SKU Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="odd:bg-slate-50/70">
                <td className="px-2 py-2 font-medium text-slate-800">
                  {row.category}
                </td>
                <td className="px-2 py-2 text-right text-slate-700">
                  {row.value}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-semibold text-slate-900">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 text-right">{totalLabel}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendCharts() {
  const [view, setView] = useState("chart");

  const multiKeys = Object.keys(marketShareTrendMulti[0] || {}).filter(
    (k) => k !== "month"
  );

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Trends
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Market share by month
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              Market Share by Month - Kwality Walls
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={marketShareTrendKW}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip formatter={(val) => [`${val}%`, "Market share"]} />
                <Line
                  type="monotone"
                  dataKey="share"
                  stroke="#3f9ca8"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-white via-emerald-50 to-slate-50 p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              Selection Basics - 14th Century
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={marketShareTrendMulti}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip formatter={(val) => [`${val}%`, "Market share"]} />
                {multiKeys.map((key, idx) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={palette[idx % palette.length]}
                    strokeWidth={1.8}
                    dot={false}
                  />
                ))}
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-[11px]">
          <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
            <table className="min-w-max">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left text-slate-600">Month</th>
                  <th className="px-2 py-2 text-right text-slate-600">
                    Kwality Walls
                  </th>
                </tr>
              </thead>
              <tbody>
                {marketShareTrendKW.map((row) => (
                  <tr key={row.month} className="odd:bg-slate-50/70">
                    <td className="px-2 py-2 font-medium text-slate-800">
                      {row.month}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {row.share}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
            <table className="min-w-max">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left text-slate-600">Month</th>
                  {multiKeys.map((k) => (
                    <th key={k} className="px-2 py-2 text-right text-slate-600">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marketShareTrendMulti.map((row) => (
                  <tr key={row.month} className="odd:bg-slate-50/70">
                    <td className="px-2 py-2 font-medium text-slate-800">
                      {row.month}
                    </td>
                    {multiKeys.map((k) => (
                      <td
                        key={k}
                        className="px-2 py-2 text-right text-slate-700"
                      >
                        {row[k]}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationStack() {
  const [view, setView] = useState("chart");

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Locations
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Market Share Across Locations
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={stackedLocations}
                stackOffset="expand"
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="zone"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(val, name) => [`${Math.round(val * 100)}%`, name]}
                />
                {["Kwality", "Havmor", "Cream", "Amul", "Others"].map(
                  (key, idx) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="stack"
                      fill={palette[idx % palette.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  )
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="text-sm font-semibold mb-2">
              Saliency Within Brand
            </div>
            <div className="text-[11px] text-slate-500">
              Placeholder drilldown list; connect to live data as needed.
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              List brand → format → SKU with saliency% in a collapsible tree (to
              wire up with real data).
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 text-[11px]">
          <table className="min-w-max">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left text-slate-600">Zone</th>
                {["Kwality", "Havmor", "Cream", "Amul", "Others"].map(
                  (brand) => (
                    <th
                      key={brand}
                      className="px-2 py-2 text-right text-slate-600"
                    >
                      {brand}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {stackedLocations.map((row) => (
                <tr key={row.zone} className="odd:bg-slate-50/70">
                  <td className="px-2 py-2 font-medium text-slate-800">
                    {row.zone}
                  </td>
                  {["Kwality", "Havmor", "Cream", "Amul", "Others"].map(
                    (brand) => (
                      <td
                        key={brand}
                        className="px-2 py-2 text-right text-slate-700"
                      >
                        {Math.round((row[brand] || 0) * 100)}%
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Modern graph view for quick story before drilling
function MarketShareGraphView() {
  const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];
  const chartData = quarterLabels.map((quarter, idx) => {
    const row = { quarter };
    platformShare.forEach((p) => {
      const vals = [p.q1, p.q2, p.q3, p.q4];
      row[p.platform] = vals[idx];
    });
    return row;
  });

  const zoneCards = zones.map((z, idx) => {
    const series = ourBrandZone[idx] || [];
    const latest = series[series.length - 1] || 0;
    const avg = Math.round(
      series.reduce((a, b) => a + b, 0) / (series.length || 1)
    );
    return { zone: z, latest, avg };
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-inner p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Platform stack
            </div>
            <div className="text-sm font-semibold text-slate-800">
              Market Share Across Platforms
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-[#4b6b9b]" /> Blinkit
            <span className="h-2 w-2 rounded-full bg-[#c27a3a]" /> Instamart
            <span className="h-2 w-2 rounded-full bg-[#3f9ca8]" /> Zepto
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="msBlinkit" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4b6b9b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4b6b9b" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="msInstamart" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#c27a3a" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#c27a3a" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="msZepto" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3f9ca8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3f9ca8" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />
            <Tooltip formatter={(val) => [`${val}%`, "Market share"]} />

            <Area
              type="monotone"
              dataKey="Blinkit"
              stroke="#4b6b9b"
              fill="url(#msBlinkit)"
              strokeWidth={2.5}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="Instamart"
              stroke="#c27a3a"
              fill="url(#msInstamart)"
              strokeWidth={2.5}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="Zepto"
              stroke="#3f9ca8"
              fill="url(#msZepto)"
              strokeWidth={2.5}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Brand heat
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Market Share Across Brands
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `100px repeat(${months.length - 2
                }, minmax(40px,1fr))`,
            }}
          >
            <div className="bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-600">
              Brand
            </div>
            {months.slice(2).map((m) => (
              <div
                key={m}
                className="bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-600 text-center"
              >
                {m}
              </div>
            ))}

            {brandShareHeat.map((row) => (
              <React.Fragment key={row.brand}>
                <div className="px-2 py-2 text-[11px] font-semibold text-slate-700 bg-white">
                  {row.brand}
                </div>
                {row.values.map((v, idx) => (
                  <div
                    key={idx}
                    className="px-1 py-1 text-center text-[11px] font-semibold"
                    style={{
                      background: heatCell(v, 30),
                      color: "#0f172a",
                    }}
                  >
                    {v}%
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          {zoneCards.map((z) => (
            <div
              key={z.zone}
              className="rounded-xl border border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-3 py-2 shadow-[0_6px_18px_rgba(16,185,129,0.08)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{z.zone}</span>
                <span className="text-[10px] text-slate-500">Avg {z.avg}%</span>
              </div>
              <div className="mt-1 text-xs text-emerald-700 font-semibold">
                Latest {z.latest}%
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.min(100, z.latest)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListingCoverageGraphView() {
  const coverageBars = listingRows.slice(0, 6).map((row) => ({
    name: row.product.split(" ").slice(0, 2).join(" "),
    coverage: row.coverage,
    osa: row.osa,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-inner p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Coverage depth
            </div>
            <div className="text-sm font-semibold text-slate-800">
              Top SKUs by coverage %
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-[#3f9ca8]" /> Coverage%
            <span className="h-2 w-2 rounded-full bg-[#9b84b3]" /> OSA%
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={coverageBars}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />
            <Tooltip
              formatter={(val, name) => [
                `${val}%`,
                name === "coverage" ? "Coverage" : "OSA",
              ]}
            />
            <Bar dataKey="coverage" fill="#3f9ca8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="osa" fill="#9b84b3" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Pincode status
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Active vs inactive
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm text-slate-700">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-800">
                Active Pincodes
              </span>
              <span className="text-[11px] text-emerald-700">
                {activePincodes.length} listed
              </span>
            </div>
            <div className="mt-1 text-xs text-emerald-700">
              {activePincodes
                .slice(0, 3)
                .map((p) => p.city)
                .join(", ")}
            </div>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-800">
                Inactive Pincodes
              </span>
              <span className="text-[11px] text-rose-700">
                {inactivePincodes.length} listed
              </span>
            </div>
            <div className="mt-1 text-xs text-rose-700">
              {inactivePincodes
                .slice(0, 3)
                .map((p) => p.city)
                .join(", ")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingTable() {
  const [view, setView] = useState("chart");

  const chartData = listingRows.slice(0, 8).map((row) => ({
    name: row.product.split(" ").slice(0, 3).join(" "),
    coverage: row.coverage,
    osa: row.osa,
  }));

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Listing Count %</div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#64748b" }}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#64748b" }}
            />
            <Tooltip
              formatter={(val, name) => [
                `${val}%`,
                name === "coverage" ? "Coverage" : "OSA",
              ]}
            />
            <Legend />
            <Bar dataKey="coverage" fill="#3f9ca8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="osa" fill="#9b84b3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-max text-[11px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left text-slate-600">
                  Product Name
                </th>
                <th className="px-2 py-2 text-right text-slate-600">
                  Listed at #Pincodes
                </th>
                <th className="px-2 py-2 text-right text-slate-600">
                  Saliency Within Brand
                </th>
                <th className="px-2 py-2 text-right text-slate-600">
                  Coverage % across Pincodes
                </th>
                <th className="px-2 py-2 text-right text-slate-600">OSA %</th>
                <th className="px-2 py-2 text-right text-slate-600">
                  Remaining Pincode Count
                </th>
              </tr>
            </thead>
            <tbody>
              {listingRows.map((row) => (
                <tr key={row.product} className="odd:bg-slate-50/70">
                  <td className="px-2 py-2 text-slate-800">{row.product}</td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {row.listed}
                  </td>
                  <HeatCell value={row.saliency} />
                  <HeatCell value={row.coverage} positive />
                  <HeatCell value={row.osa} positive />
                  <td className="px-2 py-2 text-right text-slate-700">
                    {row.remaining}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-semibold text-slate-900">
                <td className="px-2 py-2">Total</td>
                <td className="px-2 py-2 text-right">636</td>
                <td className="px-2 py-2 text-right">100%</td>
                <td className="px-2 py-2 text-right">100%</td>
                <td className="px-2 py-2 text-right">100%</td>
                <td className="px-2 py-2 text-right">0</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HeatCell({ value, positive = false }) {
  const bg = positive ? heatCell(value, 100) : `rgba(234,88,12,${value / 100})`;
  const text = value > 50 ? "#fff" : "#0f172a";
  return (
    <td className="px-2 py-2 text-right">
      <div
        className="rounded-md border border-white/40 px-2 py-1 font-semibold"
        style={{ background: bg, color: text }}
      >
        {value}%
      </div>
    </td>
  );
}

function PincodeLists() {
  const [view, setView] = useState("chart");

  const chartData = [
    { name: "Active", count: activePincodes.length },
    { name: "Inactive", count: inactivePincodes.length },
  ];

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Pincodes</div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 rounded-full ${view === "chart" ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-full ${view === "table"
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-500"
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip />
            <Bar dataKey="count" fill="#4b6b9b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PincodeTable title="Active Pincodes" rows={activePincodes} />
          <PincodeTable title="Inactive Pincodes" rows={inactivePincodes} />
        </div>
      )}
    </div>
  );
}

function PincodeTable({ title, rows }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-[400px] text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left text-slate-600">Pincode</th>
              <th className="px-2 py-2 text-left text-slate-600">State</th>
              <th className="px-2 py-2 text-left text-slate-600">City</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pincode} className="odd:bg-slate-50/70">
                <td className="px-2 py-2 text-slate-800">{row.pincode}</td>
                <td className="px-2 py-2 text-slate-700">{row.state}</td>
                <td className="px-2 py-2 text-slate-700">{row.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPane() {
  return (
    <div className="rounded-2xl bg-white shadow-md border border-slate-200 p-4 space-y-4 h-full">
      <div className="text-sm font-semibold">Filter Pane</div>

      <div className="space-y-3 text-[11px] text-slate-700">
        <div className="space-y-1">
          <div className="text-slate-500">Date</div>
          <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center px-3">
            Date range picker (wire up)
          </div>
        </div>

        <FilterPillGroup
          title="Platform"
          options={["Blinkit", "Zepto", "Instamart"]}
        />
        <FilterDropdown title="Brand" />
        <FilterDropdown title="Flavour" />
        <FilterDropdown title="Format" />
        <FilterDropdown title="Zone, State, City" />
      </div>
    </div>
  );
}

function FilterPillGroup({ title, options }) {
  return (
    <div className="space-y-1">
      <div className="text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            className="px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:border-slate-400 text-[11px]"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterDropdown({ title }) {
  return (
    <div className="space-y-1">
      <div className="text-slate-500">{title}</div>
      <div className="h-8 rounded-full border border-slate-200 bg-slate-50 flex items-center px-3 text-[11px] text-slate-600">
        All
      </div>
    </div>
  );
}
