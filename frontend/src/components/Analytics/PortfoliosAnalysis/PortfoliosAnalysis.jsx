import React, { useMemo, useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  ReferenceLine,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import axiosInstance from "../../../api/axiosInstance";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const kpiStrip = [
  {
    id: "asp",
    label: "ASP",
    value: 58.9,
    unit: "Rs/unit",
    delta: +4.2,
    series: [52, 54, 55, 57, 56, 58.9],
  },
  {
    id: "discount",
    label: "Discount %",
    value: 7,
    unit: "%",
    delta: -1.1,
    series: [9, 8.4, 8.1, 7.8, 7.5, 7],
  },
  {
    id: "volume",
    label: "Volume",
    value: 346.7,
    unit: "Mn units",
    delta: +11.3,
    series: [280, 295, 310, 322, 330, 346.7],
  },
  {
    id: "promoShare",
    label: "Promo Volume",
    value: 62,
    unit: "%",
    delta: +3.4,
    series: [55, 56, 58, 60, 61, 62],
  },
];

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];

const quantitySplitData = [
  {
    range: "0-25",
    "Kwality Walls": 68,
    Amul: 26,
    "Cream Bell": 6,
    Vadilal: 0,
    Others: 0,
  },
  {
    range: "26-50",
    "Kwality Walls": 55,
    Amul: 22,
    "Cream Bell": 13,
    Vadilal: 6,
    Others: 4,
  },
  {
    range: "51-75",
    "Kwality Walls": 49,
    Amul: 25,
    "Cream Bell": 11,
    Vadilal: 8,
    Others: 7,
  },
  {
    range: "76-100",
    "Kwality Walls": 41,
    Amul: 27,
    "Cream Bell": 13,
    Vadilal: 10,
    Others: 9,
  },
  {
    range: "100+",
    "Kwality Walls": 35,
    Amul: 30,
    "Cream Bell": 14,
    Vadilal: 11,
    Others: 10,
  },
];

const priceSplitData = [
  { range: "0-25", "Kwality Walls": 100 },
  {
    range: "26-50",
    "Kwality Walls": 55,
    Amul: 9,
    "Cream Bell": 18,
    Vadilal: 9,
    Others: 9,
  },
  {
    range: "51-75",
    "Kwality Walls": 38,
    Amul: 15,
    "Cream Bell": 21,
    Vadilal: 11,
    Others: 15,
  },
  {
    range: "76-100",
    "Kwality Walls": 28,
    Amul: 12,
    "Cream Bell": 20,
    Vadilal: 20,
    Others: 20,
  },
  {
    range: "100-150",
    "Kwality Walls": 34,
    Amul: 16,
    "Cream Bell": 18,
    Vadilal: 20,
    Others: 12,
  },
  {
    range: "150+",
    "Kwality Walls": 27,
    Amul: 13,
    "Cream Bell": 17,
    Vadilal: 27,
    Others: 16,
  },
];

const priceSkuCounts = [
  {
    range: "0-25",
    "Kwality Walls": 46,
    Amul: 30,
    "Cream Bell": 8,
    Vadilal: 6,
    Others: 4,
  },
  {
    range: "26-50",
    "Kwality Walls": 23,
    Amul: 16,
    "Cream Bell": 12,
    Vadilal: 7,
    Others: 6,
  },
  {
    range: "51-75",
    "Kwality Walls": 18,
    Amul: 15,
    "Cream Bell": 14,
    Vadilal: 11,
    Others: 6,
  },
  {
    range: "76-100",
    "Kwality Walls": 12,
    Amul: 9,
    "Cream Bell": 12,
    Vadilal: 9,
    Others: 9,
  },
  {
    range: "100-150",
    "Kwality Walls": 11,
    Amul: 10,
    "Cream Bell": 9,
    Vadilal: 10,
    Others: 5,
  },
  {
    range: "150+",
    "Kwality Walls": 8,
    Amul: 7,
    "Cream Bell": 7,
    Vadilal: 9,
    Others: 4,
  },
];

const brandStackKeys = [
  "Kwality Walls",
  "Amul",
  "Cream Bell",
  "Vadilal",
  "Others",
];

const brandColors = {
  "Kwality Walls": "#4b6b9b",
  Amul: "#c27a3a",
  "Cream Bell": "#3f9ca8",
  Vadilal: "#6ca06b",
  Others: "#9b84b3",
};

const brandPalette = (brand, dim) => {
  const hex = brandColors[brand];
  const bigint = parseInt(hex.replace("#", ""), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const alpha = dim ? 0.18 : 0.65;
  return `rgba(${r},${g},${b},${alpha})`;
};

const packLadderPoints = [
  { pack: 0, brand: "Impulse Cone", asp: 50 },
  { pack: 2, brand: "Twin Cone", asp: 95 },
  { pack: 4, brand: "Family Tub", asp: 220 },
  { pack: 6, brand: "Party Tub", asp: 330 },
  { pack: 8, brand: "Mega Pack", asp: 410 },
  { pack: 10, brand: "Value Brick", asp: 470 },
];

const packSaliency = [
  {
    pack: 0,
    shares: {
      "Kwality Walls": 50,
      Amul: 24,
      "Cream Bell": 9,
      Vadilal: 7,
      Others: 10,
    },
  },
  {
    pack: 1,
    shares: {
      "Kwality Walls": 32,
      Amul: 23,
      "Cream Bell": 15,
      Vadilal: 18,
      Others: 12,
    },
  },
  {
    pack: 2,
    shares: {
      "Kwality Walls": 45,
      Amul: 25,
      "Cream Bell": 8,
      Vadilal: 7,
      Others: 15,
    },
  },
  {
    pack: 3,
    shares: {
      "Kwality Walls": 43,
      Amul: 14,
      "Cream Bell": 16,
      Vadilal: 10,
      Others: 17,
    },
  },
  {
    pack: 4,
    shares: {
      "Kwality Walls": 41,
      Amul: 10,
      "Cream Bell": 20,
      Vadilal: 9,
      Others: 20,
    },
  },
  {
    pack: 5,
    shares: {
      "Kwality Walls": 28,
      Amul: 19,
      "Cream Bell": 22,
      Vadilal: 9,
      Others: 22,
    },
  },
  {
    pack: 6,
    shares: {
      "Kwality Walls": 27,
      Amul: 0,
      "Cream Bell": 73,
      Vadilal: 0,
      Others: 0,
    },
  },
  {
    pack: 7,
    shares: {
      "Kwality Walls": 84,
      Amul: 0,
      "Cream Bell": 0,
      Vadilal: 8,
      Others: 8,
    },
  },
];

const discountScatter = [
  { brand: "Kwality Walls", discount: 9, share: 25, asp: 72 },
  { brand: "Amul", discount: 3, share: 21, asp: 64 },
  { brand: "Cream Bell", discount: 5, share: 7, asp: 59 },
  { brand: "Vadilal", discount: 1, share: 6, asp: 68 },
  { brand: "Hocco", discount: 4, share: 4, asp: 78 },
  { brand: "Baskin Robbins", discount: 1, share: 3, asp: 110 },
];

const discountWaterfall = [
  { name: "MRP", value: 100 },
  { name: "Trade Margin", value: -18 },
  { name: "Scheme", value: -9 },
  { name: "Delivery/Fees", value: -4 },
  { name: "Realised ASP", value: 69 },
];

const flavorTreemap = [
  { name: "Classic", size: 40 },
  { name: "Premium Indulgent", size: 22 },
  { name: "Fruity & Exotic", size: 14 },
  { name: "Indian/Nostalgic", size: 9 },
  { name: "Health & Functional", size: 8 },
  { name: "Fusion", size: 3 },
  { name: "Uncategorized", size: 3 },
];

const flavorMom = [
  { flavour: "Classic", sales: 139.8, mom: 12.3 },
  { flavour: "Fruity & Exotic", sales: 48.1, mom: 12.9 },
  { flavour: "Premium Indulgent", sales: 77.7, mom: 14.8 },
  { flavour: "Indian/Nostalgic", sales: 31.1, mom: 17.3 },
  { flavour: "Health & Functional", sales: 29.3, mom: 10.6 },
  { flavour: "Uncategorized", sales: 9.1, mom: 18 },
];

// Brand price/volume quadrant data
const brandPositions = [
  {
    brand: "Amul",
    qtyIndex: 135.15,
    priceIndex: 223.51,
    qtySales: 18189231,
    priceSales: 31717835,
    totalSales: 49907066,
  },
  {
    brand: "Baskin Robbins",
    qtyIndex: 100.6,
    priceIndex: 133.73,
    qtySales: 14729496,
    priceSales: 5362593,
    totalSales: 20092089,
  },
  {
    brand: "Cream Bell",
    qtyIndex: 277.61,
    priceIndex: 191.83,
    qtySales: 17500565,
    priceSales: 5158164,
    totalSales: 22658729,
  },
  {
    brand: "Go-Zero",
    qtyIndex: 84.66,
    priceIndex: 150.46,
    qtySales: 14891187,
    priceSales: 6183712,
    totalSales: 21074899,
  },
  {
    brand: "Grameen",
    qtyIndex: 61.18,
    priceIndex: 68.76,
    qtySales: 7762421,
    priceSales: 8202481,
    totalSales: 15964902,
  },
  {
    brand: "Havmor",
    qtyIndex: 132.55,
    priceIndex: 184.27,
    qtySales: 8423328,
    priceSales: 4947753,
    totalSales: 13371081,
  },
  {
    brand: "Hocco",
    qtyIndex: 195.36,
    priceIndex: 161.06,
    qtySales: 17030842,
    priceSales: 8141802,
    totalSales: 25172644,
  },
  {
    brand: "Kwality Walls",
    qtyIndex: 276.31,
    priceIndex: 123.25,
    qtySales: 71153625,
    priceSales: 24441960,
    totalSales: 95595585,
  },
  {
    brand: "Vadilal",
    qtyIndex: 97.42,
    priceIndex: 162.34,
    qtySales: 12455490,
    priceSales: 10290160,
    totalSales: 22745650,
  },
];

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const stageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// Quadrant helpers ----------------------------------------------------------

const formatSalesShort = (value) => {
  if (value == null) return "-";
  const cr = value / 1e7;
  if (cr >= 1) return `${cr.toFixed(1)} Cr`;
  const lakh = value / 1e5;
  if (lakh >= 1) return `${lakh.toFixed(1)} L`;
  return value.toLocaleString("en-IN");
};

const useAxisMeta = (points) =>
  useMemo(() => {
    const xs = points.map((p) => p.qtyIndex);
    const ys = points.map((p) => p.priceIndex);

    const xMin = Math.min(...xs) - 10;
    const xMax = Math.max(...xs) + 10;
    const yMin = Math.min(...ys) - 10;
    const yMax = Math.max(...ys) + 10;

    const xMid = (xMin + xMax) / 2;
    const yMid = (yMin + yMax) / 2;

    const sales = points.map((p) => p.totalSales);
    const sMin = Math.min(...sales);
    const sMax = Math.max(...sales);

    return { xMin, xMax, yMin, yMax, xMid, yMid, sMin, sMax };
  }, [points]);

const getBubbleRadius = (totalSales, sMin, sMax) => {
  const minR = 10;
  const maxR = 32;
  const minLog = Math.log10(sMin);
  const maxLog = Math.log10(sMax);
  const current = Math.log10(totalSales);
  const t = (current - minLog) / (maxLog - minLog || 1);
  return minR + t * (maxR - minR);
};

// Heatmap helpers -----------------------------------------------------------

const buildHeatmap = (data, mode = "share") => {
  const ranges = data.map((row) => row.range);
  const rows = brandStackKeys.map((brand) => {
    const cells = data.map((row) => {
      const val = row[brand] || 0;

      let value = val;

      if (mode === "share") {
        const total =
          brandStackKeys.reduce((sum, key) => sum + (row[key] || 0), 0) || 1;
        value = (val / total) * 100;
      }

      return { range: row.range, value };
    });

    const avg = cells.reduce((a, c) => a + c.value, 0) / cells.length;

    return { brand, cells, avg };
  });

  const max = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.value)), 1);

  return { rows, max, ranges };
};

const heatColor = (value, max) => {
  const t = Math.min(1, Math.max(0, value / max));
  const start = [226, 241, 249];
  const end = [30, 91, 150];
  const mix = start.map((s, i) => Math.round(s + (end[i] - s) * t));
  return `rgb(${mix.join(",")})`;
};

// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------

const steps = [
  {
    id: "overview",
    label: "Pricing / Volume Cohort",
    caption: "Sales split by quantity",
  },
  { id: "packs", label: "Price per Pack", caption: "Pack ladder & discount" },
  {
    id: "discount",
    label: "Pricing Analysis",
    caption: "Leakage & promo dependency",
  },
  {
    id: "flavour",
    label: "Flavour Wise Pricing",
    caption: "Flavour & brand saliency",
  },
];

export function PortfolioAnalysis() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeMetric, setActiveMetric] = useState("asp");
  const [showFilters, setShowFilters] = useState(false);
  const calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;

    const fetchPortfoliosData = async () => {
      try {
        const response = await axiosInstance.get('/portfolios-analysis', {
          params: { platform: 'Blinkit' } // Default filter
        });
        console.log("Portfolios Analysis Data:", response.data);
      } catch (error) {
        console.error("Error fetching Portfolios Analysis data:", error);
      }
    };

    fetchPortfoliosData();
  }, []);

  const cardSurface = "bg-white border-slate-200 shadow-sm";

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* <div className="sticky top-0 z-40 bg-slate-100/95 backdrop-blur border-b border-slate-200/80 px-6 py-2">
        <StepNav activeStep={activeStep} onChange={setActiveStep} />
      </div> */}

      <main className="flex-1 flex flex-col gap-4 px-6 py-4 overflow-hidden">
        <HeroStrip
          kpis={kpiStrip}
          activeMetric={activeMetric}
          onSelect={setActiveMetric}
          surface={cardSurface}
        />

        <section className="relative flex-1 mt-2 rounded-3xl border border-slate-200 bg-slate-50 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeStep === 0 && (
              <OverviewStage
                key="overview"
                activeMetric={activeMetric}
                cardSurface={cardSurface}
              />
            )}
            {activeStep === 1 && (
              <PackStage key="packs" cardSurface={cardSurface} />
            )}
            {activeStep === 2 && (
              <DiscountStage key="discount" cardSurface={cardSurface} />
            )}
            {activeStep === 3 && (
              <FlavourStage key="flavour" cardSurface={cardSurface} />
            )}
          </AnimatePresence>

          <button
            onClick={() => setShowFilters(true)}
            className="absolute right-6 bottom-6 h-12 w-12 rounded-full bg-emerald-500 text-white shadow-[0_18px_40px_rgba(16,185,129,0.5)] flex items-center justify-center text-xl font-bold"
          >
            ≡
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                variants={filterPanelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="absolute inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-[0_0_40px_rgba(15,23,42,0.15)] flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Filters
                    </div>
                    <div className="text-sm text-slate-700">
                      Narrow the pricing story
                    </div>
                  </div>
                  <button
                    className="text-slate-400 text-lg hover:text-slate-700"
                    onClick={() => setShowFilters(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">
                  <FilterSection title="Platform">
                    <PillRow
                      options={["Blinkit", "Zepto", "Instamart"]}
                      value="Blinkit"
                      onChange={() => { }}
                    />
                  </FilterSection>
                  <FilterSection title="Zone">
                    <PillRow
                      options={["All Zones", "North", "East", "West", "South"]}
                      value="North"
                      onChange={() => { }}
                    />
                  </FilterSection>
                  <FilterSection title="Scenario">
                    <PillRow
                      options={["Base", "Promo heavy", "No promo"]}
                      value="Base"
                      onChange={() => { }}
                    />
                  </FilterSection>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero KPI strip
// ---------------------------------------------------------------------------

function HeroStrip({ kpis, activeMetric, onSelect, surface }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <motion.button
          key={kpi.id}
          variants={cardVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.25, delay: 0.05 }}
          onClick={() => onSelect(kpi.id)}
          className={`group relative overflow-hidden rounded-2xl border ${surface} px-4 py-3 text-left hover:-translate-y-0.5 transition`}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.12),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.12),transparent_55%)]" />

          <div className="relative flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{kpi.label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-semibold text-slate-900">{kpi.value.toFixed(1)}</span>
                <span className="text-[11px] text-slate-500">{kpi.unit}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <Sparkline series={kpi.series} />
              <span
                className={`text-[11px] font-medium ${kpi.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
              >
                {kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta).toFixed(1)}%
              </span>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  )
}

function Sparkline({ series }) {
  const data = useMemo(
    () => series.map((v, idx) => ({ month: months[idx] ?? String(idx + 1), value: v })),
    [series]
  )

  return (
    <div className="h-10 w-24">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="value"
            stroke="#059669"
            fill="url(#spark)"
            strokeWidth={2}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step navigation
// ---------------------------------------------------------------------------

function StepNav({ activeStep, onChange }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {steps.map((step, idx) => {
        const isActive = activeStep === idx

        return (
          <button
            key={step.id}
            onClick={() => onChange(idx)}
            className={`group rounded-full border px-3 py-2 text-left transition shadow-sm ${isActive
              ? 'border-emerald-500 bg-white text-slate-900 shadow-[0_10px_30px_rgba(16,185,129,0.15)]'
              : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${isActive
                  ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]'
                  : 'bg-slate-300'
                  }`}
              />
              <div className="flex flex-col items-start">
                <span
                  className={`text-[11px] font-medium tracking-wide ${isActive ? 'text-slate-900' : 'text-slate-600'
                    }`}
                >
                  {step.label}
                </span>
                <span className="text-[10px] text-slate-400 max-w-[180px] truncate">
                  {step.caption}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const filterPanelVariants = {
  hidden: { x: 400, opacity: 0 },
  visible: { x: 0, opacity: 1 },
  exit: { x: 400, opacity: 0 },
}

function FilterSection({ title, children }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  )
}

function PillRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const isActive = opt === value

        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2 py-1 rounded-full border text-[11px] transition ${isActive
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
              }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage 1: Overview – quantity cohorts
// ---------------------------------------------------------------------------

function OverviewStage({ activeMetric, cardSurface }) {
  const surface = `${cardSurface} rounded-2xl`
  const quantityHeatmap = useMemo(() => buildHeatmap(quantitySplitData), [])
  const priceHeatmap = useMemo(() => buildHeatmap(priceSplitData), [])

  return (
    <motion.div
      variants={stageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute inset-0 grid grid-cols-1 gap-4 p-5 overflow-y-auto"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${surface} p-4`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Quantity cohort heatmap</h2>
              <p className="text-[11px] text-slate-500">
                Rows = brands, columns = quantity ranges, numbers = share %
              </p>
            </div>

            <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
              Focus metric: {activeMetric.toUpperCase()}
            </span>
          </div>

          <CohortHeatmapTable heatmap={quantityHeatmap} />
        </div>

        <div className={`${surface} p-4`}>
          <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Price cohort heatmap</h2>
              <p className="text-[11px] text-slate-500">
                Rows = brands, columns = price ranges, numbers = share %
              </p>
            </div>
          </div>

          <CohortHeatmapTable heatmap={priceHeatmap} />
        </div>
      </div>

      <div className={`${surface} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Price vs volume cohort position
          </h2>
          <span className="text-[10px] text-slate-500">
            Bubble size = sales within cohort
          </span>
        </div>

        <BrandQuadrantSection />
      </div>
    </motion.div>
  )
}

function CohortHeatmapTable({ heatmap, mode = 'share' }) {
  const { rows, max, ranges } = heatmap

  return (
    <div className="w-full overflow-auto rounded-2xl border border-slate-200 bg-white/70">
      <table className="min-w-full text-[11px] text-left border-collapse">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 font-medium text-slate-500 border-b border-slate-200 w-36">Brand</th>

            {ranges.map((range) => (
              <th
                key={range}
                className="px-1 py-2 font-medium text-slate-500 border-b border-slate-200 text-center min-w-[56px]"
              >
                {range}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const leadValue = Math.max(...row.cells.map((c) => c.value))

            return (
              <tr key={row.brand} className="odd:bg-slate-50/60">
                <td className="px-3 py-2 border-b border-slate-200 text-slate-800 font-medium">
                  {row.brand}
                </td>

                {row.cells.map((cell) => {
                  const bg = heatColor(cell.value, max)
                  const isLead = cell.value === leadValue

                  return (
                    <td key={cell.range} className="px-1 py-2 border-b border-slate-200 text-center">
                      <div
                        className={`mx-auto flex h-7 items-center justify-center rounded-md border ${isLead ? 'border-slate-300 shadow-sm' : 'border-transparent'
                          }`}
                        style={{
                          backgroundColor: bg,
                          color: cell.value > max * 0.6 ? '#f8fafc' : '#0f172a',
                        }}
                      >
                        {mode === 'share'
                          ? `${cell.value.toFixed(0)}%`
                          : cell.value.toFixed(0)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="px-3 py-2 text-[10px] text-slate-500 flex items-center gap-3 border-t border-slate-200 bg-slate-50">
        <span className="inline-flex h-3 w-10 rounded-full" style={{ background: heatColor(max * 0.25, max) }} />
        Low share
        <span className="inline-flex h-3 w-10 rounded-full" style={{ background: heatColor(max * 0.65, max) }} />
        Medium
        <span className="inline-flex h-3 w-10 rounded-full" style={{ background: heatColor(max, max) }} />
        High

        <span className="ml-auto">Hover cells for exact %</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Brand bubble map – Price vs Volume scatter
// ---------------------------------------------------------------------------

const BrandBubble = ({ cx = 0, cy = 0, payload, activeBrand, axisMeta }) => {
  if (!payload) return null

  const { sMin, sMax } = axisMeta
  const radius = getBubbleRadius(payload.totalSales, sMin, sMax)
  const isActive = activeBrand === payload.brand
  const hue = 160 + (payload.qtyIndex % 40)
  const gradientId = `quadrant-grad-${payload.brand.replace(/\s+/g, '-')}`

  return (
    <g>
      <defs>
        <radialGradient id={gradientId} cx="30%" cy="20%" r="80%">
          <stop offset="0%" stopColor={`hsl(${hue}, 85%, 80%)`} />
          <stop offset="60%" stopColor={`hsl(${hue}, 80%, 55%)`} />
          <stop offset="100%" stopColor={`hsl(${hue}, 90%, 45%)`} />
        </radialGradient>

        <filter id="quadrantShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="6"
            floodColor="rgba(15,23,42,0.18)"
          />
        </filter>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={`url(#${gradientId})`}
        filter="url(#quadrantShadow)"
        stroke={isActive ? '#0f172a' : 'rgba(15,23,42,0.12)'}
        strokeWidth={isActive ? 3 : 1}
        style={{ cursor: 'pointer', transition: 'transform 160ms ease-out' }}
      />

      <text
        x={cx}
        y={cy}
        dy={4}
        textAnchor="middle"
        fontSize={isActive ? 11 : 10}
        fontWeight={600}
        fill="#0f172a"
        pointerEvents="none"
      >
        {payload.brand}
      </text>
    </g>
  )
}

const BrandTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null

  const p = payload[0].payload

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="text-xs font-semibold text-slate-900 mb-1">{p.brand}</div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <span>Qty cohort index</span>
        <span className="text-right font-medium text-slate-900">{p.qtyIndex.toFixed(0)}</span>

        <span>Price cohort index</span>
        <span className="text-right font-medium text-slate-900">{p.priceIndex.toFixed(0)}</span>

        <span>Total sales</span>
        <span className="text-right font-semibold text-emerald-700">
          {formatSalesShort(p.totalSales)}
        </span>
      </div>
    </div>
  )
}

const BrandStoryPanel = ({ brand, meta }) => {
  const node = brandPositions.find((b) => b.brand === brand)
  if (!node) return null

  const volumeLevel = node.qtyIndex > meta.xMid ? 'High volume' : 'Focused'
  const priceLevel = node.priceIndex > meta.yMid ? 'Premium / high price' : 'Value / mid price'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={brand}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="h-full rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 shadow-xl backdrop-blur flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Selected brand
            </div>
            <div className="text-lg font-semibold text-slate-900">{brand}</div>
          </div>

          <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-100">
            {volumeLevel} · {priceLevel}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div className="rounded-2xl bg-slate-50 px-3 py-2 border border-slate-100">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Weighted quantity index
            </div>
            <div className="text-base font-semibold text-slate-900">
              {node.qtyIndex.toFixed(0)}
            </div>
            <p className="mt-1 leading-snug">
              Higher index means the bulk of volume sits in larger pack-cohorts.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 px-3 py-2 border border-slate-100">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Weighted price index
            </div>
            <div className="text-base font-semibold text-slate-900">
              {node.priceIndex.toFixed(0)}
            </div>
            <p className="mt-1 leading-snug">
              Higher index means the brand leans towards higher price ladders.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50/80 px-3 py-2 border border-emerald-100 col-span-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 mb-1">
                Total sales in selected cohorts
              </div>
              <div className="text-base font-semibold text-emerald-900">
                {formatSalesShort(node.totalSales)}
              </div>
            </div>

            <div className="text-[11px] text-emerald-700/80 max-w-[180px]">
              Use this as anchor to compare share shifts when you change filters.
            </div>
          </div>
        </div>

        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
          Reading tip: top-right = <span className="font-semibold text-slate-700">premium + heavy volume</span>, bottom-right = <span className="font-semibold text-slate-700">premium but niche</span>, top-left = <span className="font-semibold text-slate-700">value mass</span>.
        </p>
      </motion.div>
    </AnimatePresence>
  )
}

const BrandQuadrantSection = () => {
  const [activeBrand, setActiveBrand] = useState('Kwality Walls')
  const axisMeta = useAxisMeta(brandPositions)

  const dataForChart = useMemo(
    () => brandPositions.map((p) => ({ ...p, x: p.qtyIndex, y: p.priceIndex })),
    []
  )

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-3">
      <motion.div
        layout
        className="relative h-[360px] rounded-3xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 text-[10px] font-medium text-slate-400">
          <div className="absolute left-3 top-3">Premium & heavy volume</div>
          <div className="absolute right-3 top-3 text-right">Premium & niche</div>
          <div className="absolute left-3 bottom-3">Value mass</div>
          <div className="absolute right-3 bottom-3 text-right">Value niche</div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 32, right: 24, bottom: 36, left: 40 }} style={{ fontSize: 11 }}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />

            <ReferenceLine x={axisMeta.xMid} stroke="#e2e8f0" strokeWidth={1} />
            <ReferenceLine y={axisMeta.yMid} stroke="#e2e8f0" strokeWidth={1} />

            <XAxis
              type="number"
              dataKey="x"
              domain={[axisMeta.xMin, axisMeta.xMax]}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: 'Quantity cohort index →',
                position: 'insideBottom',
                dy: 20,
                style: { fill: '#64748b', fontSize: 11 },
              }}
            />

            <YAxis
              type="number"
              dataKey="y"
              domain={[axisMeta.yMin, axisMeta.yMax]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(0)}
              label={{
                value: '↑ Price cohort index',
                angle: -90,
                position: 'insideLeft',
                dx: -12,
                style: { fill: '#64748b', fontSize: 11 },
              }}
            />

            <Tooltip content={<BrandTooltip />} />

            <Scatter
              data={dataForChart}
              onClick={(d) => setActiveBrand(d.payload.brand)}
              shape={(props) => (
                <BrandBubble {...props} activeBrand={activeBrand} axisMeta={axisMeta} />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </motion.div>

      <BrandStoryPanel brand={activeBrand} meta={axisMeta} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage 2: Pack ladder
// ---------------------------------------------------------------------------

function PackStage({ cardSurface }) {
  const categories = ['Bon Bon', 'Cakes', 'Cassata', 'Pastries', 'Cone', 'Cup', 'Others', 'Sandwich']
  const [category, setCategory] = useState('Cone')
  const [activeBrand, setActiveBrand] = useState(null)
  const [priceMode, setPriceMode] = useState('share')
  const [brandSearch, setBrandSearch] = useState('')
  const [topN, setTopN] = useState(10)

  const priceHeatmapShare = useMemo(() => buildHeatmap(priceSplitData, 'share'), [])
  const priceHeatmapCount = useMemo(() => buildHeatmap(priceSkuCounts, 'count'), [])

  const filteredHeatmap = useMemo(() => {
    const base = priceMode === 'share' ? priceHeatmapShare : priceHeatmapCount
    const term = brandSearch.trim().toLowerCase()

    const rows = base.rows
      .filter((r) => (!term ? true : r.brand.toLowerCase().includes(term)))
      .map((r) => ({ ...r, total: r.cells.reduce((s, c) => s + c.value, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN >= 999 ? base.rows.length : topN)
      .map(({ total, ...rest }) => rest)

    const max = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.value)), 1)

    return { ...base, rows, max }
  }, [priceMode, priceHeatmapShare, priceHeatmapCount, brandSearch, topN])

  const barData = useMemo(
    () =>
      packSaliency.map((row) => ({
        pack: row.pack,
        ...row.shares,
      })),
    []
  )

  const topLabels = useMemo(() => {
    const map = {}

    barData.forEach((row) => {
      const entries = brandStackKeys
        .map((key) => ({ key, val: row[key] || 0 }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 2)

      map[row.pack] = new Set(entries.map((e) => e.key))
    })

    return map
  }, [barData])

  return (
    <motion.div
      variants={stageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute inset-0 grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 p-5 overflow-y-auto"
    >
      {/* Left Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pack saliency by size</h2>
            <p className="text-[11px] text-slate-500">Top brand & split within each pack size</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition ${c === category
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="hidden xl:flex flex-wrap gap-1 text-[11px] text-slate-600 ml-2">
              {brandStackKeys.map((brand) => (
                <button
                  key={brand}
                  onMouseEnter={() => setActiveBrand(brand)}
                  onMouseLeave={() => setActiveBrand(null)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${activeBrand === brand
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 bg-white'
                    }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: brandColors[brand] }}
                  />
                  <span>{brand}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:hidden flex flex-wrap gap-2 text-[11px] text-slate-600">
          {brandStackKeys.map((brand) => (
            <button
              key={brand}
              onMouseEnter={() => setActiveBrand(brand)}
              onMouseLeave={() => setActiveBrand(null)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${activeBrand === brand
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-200 bg-white'
                }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: brandColors[brand] }}
              />
              <span>{brand}</span>
            </button>
          ))}
        </div>

        <div className={`${cardSurface} rounded-2xl p-4 h-[440px] flex items-center justify-center`}>
          <div className="w-full h-full max-w-5xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                stackOffset="expand"
                layout="vertical"
                margin={{ top: 10, right: 10, bottom: 10, left: 50 }}
                barCategoryGap="28%"
                barGap={4}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />

                <XAxis type="number" domain={[0, 1]} hide />

                <YAxis
                  dataKey="pack"
                  type="category"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5f5' }}
                />

                <Tooltip
                  formatter={(val, name) => [`${Math.round(val * 100)}%`, name]}
                  labelFormatter={(label) => `Pack size: ${label}`}
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    fontSize: 11,
                  }}
                />

                {brandStackKeys.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="stack"
                    fill={brandPalette(key, activeBrand !== null && activeBrand !== key)}
                    radius={[6, 6, 6, 6]}
                    stroke="#ffffff"
                    strokeWidth={0.6}
                    onMouseEnter={() => setActiveBrand(key)}
                    onMouseLeave={() => setActiveBrand(null)}
                  >
                    <LabelList
                      content={(props) => {
                        const { value, x, y, width, index, dataKey } = props
                        if (!value || value < 0.12) return null

                        const row = barData[index]
                        const show = topLabels[row.pack]?.has(dataKey)
                        if (!show) return null

                        return (
                          <text
                            x={x + width + 6}
                            y={y + 10}
                            textAnchor="start"
                            fill="#0f172a"
                            fontSize={10}
                            fontWeight={700}
                          >
                            {Math.round(value * 100)}%
                          </text>
                        )
                      }}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Price range heatmap</h2>
            <p className="text-[11px] text-slate-500">
              {priceMode === 'share'
                ? 'Share % by brand vs price bands'
                : 'SKU count by brand vs price bands'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-slate-200 bg-white p-1 text-[11px]">
              {['share', 'count'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPriceMode(mode)}
                  className={`px-2 py-1 rounded-full transition ${priceMode === mode ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                >
                  {mode === 'share' ? 'View % share' : 'View SKU count'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search brand"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="h-8 rounded-full border border-slate-200 px-3 text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />

            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="h-8 rounded-full border border-slate-200 px-2 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
              <option value={999}>All</option>
            </select>
          </div>
        </div>

        <div className={`${cardSurface} rounded-2xl p-3 h-[440px] flex flex-col`}>
          <div className="flex-1 min-h-0 w-full max-w-5xl overflow-auto">
            <CohortHeatmapTable heatmap={filteredHeatmap} mode={priceMode} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Stage 3: Discount
// ---------------------------------------------------------------------------

function DiscountStage({ cardSurface }) {
  return (
    <motion.div
      variants={stageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 p-5"
    >
      {/* Waterfall */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Discount waterfall – value leakage</h2>

        <div className={`${cardSurface} rounded-2xl p-3`}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={discountWaterfall} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />

              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 11 }} />

              <Bar dataKey="value" barSize={26} radius={[10, 10, 10, 10]} fill="#0ea5e9">
                <LabelList dataKey="value" position="top" style={{ fill: '#374151', fontSize: 10 }} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Promo dependency */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Promo dependency – brand map</h2>

        <div className={`${cardSurface} rounded-2xl p-3`}>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis type="number" dataKey="discount" name="Discount %" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="number" dataKey="share" name="Share" unit="%" tick={{ fill: '#64748b', fontSize: 10 }} />

              <ZAxis dataKey="asp" range={[80, 180]} />

              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 11 }} />

              <Scatter data={discountScatter} fill="#f97316" shape="circle">
                <LabelList dataKey="brand" position="top" style={{ fill: '#374151', fontSize: 10 }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Stage 4: Flavour
// ---------------------------------------------------------------------------

function FlavourStage({ cardSurface }) {
  return (
    <motion.div
      variants={stageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 p-5"
    >
      {/* Left */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Saliency by flavour segment</h2>

        <div className={`${cardSurface} rounded-2xl p-3`}>
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={flavorTreemap}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#ffffff"
              fill="#0ea5e9"
            >
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 11 }} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">MoM comparison – flavour heat table</h2>

        <div className={`${cardSurface} rounded-2xl p-3 flex flex-col`}>
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white/70">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 font-medium text-slate-500 border-b border-slate-200">
                    Flavour
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-500 border-b border-slate-200">
                    Sales (Rs Cr)
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-500 border-b border-slate-200">
                    M-1 vs M
                  </th>
                </tr>
              </thead>

              <tbody>
                {flavorMom.map((row) => {
                  const intensity = Math.min(1, Math.abs(row.mom) / 20)
                  const bg = `rgba(34,197,94,${0.15 + intensity * 0.4})`

                  return (
                    <tr key={row.flavour} className="odd:bg-slate-50/60">
                      <td className="px-3 py-2 border-b border-slate-200">{row.flavour}</td>

                      <td className="px-3 py-2 border-b border-slate-200">
                        {row.sales.toFixed(1)}
                      </td>

                      <td className="px-3 py-2 border-b border-slate-200">
                        <div
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-emerald-900 font-medium"
                          style={{ backgroundColor: bg }}
                        >
                          ▲ {row.mom.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Use this to spot flavour territories growing faster than the category.
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default PortfolioAnalysis
