import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import CohortHeatmapDemo, { priceRecords, quantityRecords } from './CohortHeatmap'
import { cleanPriceBands, cleanQuantityBands } from './CohortBands'

// ---------------------------------------------------------------------------
// Drill-down helpers
// ---------------------------------------------------------------------------

const hierarchyTree = {
  Blinkit: {
    East: {
      Kolkata: { ola: 83 },
      Patna: { ola: 88 },
      Ranchi: { ola: 93 },
    },
    'North 1': {
      Delhi: { ola: 91 },
      Gurgaon: { ola: 95 },
      Lucknow: { ola: 89 },
    },
  },
  Zepto: {
    West: {
      Mumbai: { ola: 92 },
      Pune: { ola: 90 },
      Ahmedabad: { ola: 88 },
    },
    South: {
      Bengaluru: { ola: 94 },
      Hyderabad: { ola: 91 },
      Chennai: { ola: 89 },
    },
  },
  Instamart: {
    West: {
      Mumbai: { ola: 86 },
      Surat: { ola: 88 },
    },
    South: {
      Bengaluru: { ola: 90 },
      Hyderabad: { ola: 87 },
    },
  },
}

const platformPulse = [
  { name: 'Amazon', value: 77, color: '#4f46e5' },
  { name: 'Flipkart', value: 75, color: '#0f766e' },
  { name: 'Big Basket', value: 88, color: '#f97316' },
  { name: 'Blinkit', value: 92, color: '#22c55e' },
  { name: 'Zepto', value: 90, color: '#db2777' },
  { name: 'Instamart', value: 84, color: '#2563eb' },
  { name: 'Virtual Store', value: 74, color: '#eab308' },
]

const heatmapRows = [
  { format: 'Cassata', Amazon: 0, BigBasket: 61, Blinkit: 90, Flipkart: 0, Instamart: 87, VirtualStore: 72, Zepto: 87 },
  { format: 'Core Tub', Amazon: 0, BigBasket: 96, Blinkit: 92, Flipkart: 0, Instamart: 87, VirtualStore: 92, Zepto: 92 },
  { format: 'Cornetto', Amazon: 0, BigBasket: 89, Blinkit: 93, Flipkart: 0, Instamart: 76, VirtualStore: 93, Zepto: 93 },
  { format: 'Magnum', Amazon: 0, BigBasket: 94, Blinkit: 91, Flipkart: 0, Instamart: 82, VirtualStore: 77, Zepto: 93 },
  { format: 'Premium Tub', Amazon: 0, BigBasket: 90, Blinkit: 93, Flipkart: 0, Instamart: 89, VirtualStore: 70, Zepto: 93 },
  { format: 'Sandwich', Amazon: 0, BigBasket: 80, Blinkit: 92, Flipkart: 0, Instamart: 79, VirtualStore: 73, Zepto: 73 },
]

const trendData = [
  { day: 1, value: 77 },
  { day: 2, value: 76 },
  { day: 3, value: 76 },
  { day: 4, value: 76 },
  { day: 5, value: 75 },
  { day: 6, value: 75 },
  { day: 7, value: 76 },
  { day: 8, value: 76 },
  { day: 9, value: 76 },
  { day: 10, value: 76 },
  { day: 11, value: 76 },
  { day: 12, value: 77 },
  { day: 13, value: 77 },
  { day: 14, value: 77 },
  { day: 15, value: 77 },
  { day: 16, value: 77 },
  { day: 17, value: 77 },
  { day: 18, value: 78 },
  { day: 19, value: 78 },
  { day: 20, value: 78 },
  { day: 21, value: 78 },
  { day: 22, value: 78 },
  { day: 23, value: 78 },
  { day: 24, value: 77 },
]

// Drilldown matrix data (format vs time)
const drillRows = [
  {
    name: 'Cassata',
    spend: 2,
    m1Spend: 2.0,
    m2Spend: 0.8,
    conversion: 3,
    m1Conversion: 3.3,
    m2Conversion: 3.3,
    children: [
      { name: 'Blinkit', spend: 1.1, m1Spend: 0.9, m2Spend: 0.4, conversion: 3.4, m1Conversion: 3.5, m2Conversion: 3.2 },
      { name: 'Zepto', spend: 0.9, m1Spend: 1.1, m2Spend: 0.4, conversion: 2.8, m1Conversion: 3.1, m2Conversion: 3.4 },
    ],
  },
  { name: 'Core Tub', spend: 38, m1Spend: 44.0, m2Spend: 28.2, conversion: 1, m1Conversion: 0.9, m2Conversion: 1.1 },
  { name: 'Cornetto', spend: 23, m1Spend: 30.5, m2Spend: 26.0, conversion: 3, m1Conversion: 2.6, m2Conversion: 2.3 },
  { name: 'Magnum', spend: 45, m1Spend: 45.0, m2Spend: 46.6, conversion: 1, m1Conversion: 0.9, m2Conversion: 0.8 },
  { name: 'Premium Tub', spend: 22, m1Spend: 32.3, m2Spend: 26.2, conversion: 0, m1Conversion: 0.3, m2Conversion: 0.4 },
]

const drillTabs = ['Cassata', 'Core Tub', 'Cornetto', 'Magnum', 'Premium Tub', 'Slow Churn']

const pctCellColor = (value) => {
  if (value >= 3) return 'bg-emerald-200 text-emerald-900'
  if (value >= 1) return 'bg-amber-200 text-amber-900'
  return 'bg-rose-200 text-rose-900'
}

const spendCellColor = (value) => {
  if (value >= 40) return 'bg-emerald-200 text-emerald-900'
  if (value >= 20) return 'bg-amber-200 text-amber-900'
  return 'bg-rose-200 text-rose-900'
}

// Additional hierarchy data for showcase components
const formatColumns = ['Cassata', 'Core Tub', 'Cornetto', 'Magnum', 'Premium Tub', 'KW Sticks', 'Sandwich']

const cityFormatData = [
  { platform: 'Blinkit', region: 'East', city: 'Kolkata', values: { Cassata: 7, 'Core Tub': 81, Cornetto: 90, 'KW Sticks': 97, Magnum: 91, 'Premium Tub': 85, Sandwich: 82 } },
  { platform: 'Blinkit', region: 'East', city: 'Patna', values: { Cassata: 13, 'Core Tub': 87, Cornetto: 98, 'KW Sticks': 100, Magnum: 100, 'Premium Tub': 78, Sandwich: 95 } },
  { platform: 'Blinkit', region: 'East', city: 'Ranchi', values: { Cassata: 17, 'Core Tub': 99, Cornetto: 99, 'KW Sticks': 100, Magnum: 100, 'Premium Tub': 99, Sandwich: 100 } },
  { platform: 'Blinkit', region: 'West', city: 'Mumbai', values: { Cassata: 72, 'Core Tub': 96, Cornetto: 82, 'KW Sticks': 94, Magnum: 91, 'Premium Tub': 88, Sandwich: 55 } },
  { platform: 'Zepto', region: 'South', city: 'Bengaluru', values: { Cassata: 91, 'Core Tub': 93, Cornetto: 88, 'KW Sticks': 90, Magnum: 92, 'Premium Tub': 86, Sandwich: 73 } },
  { platform: 'Instamart', region: 'South', city: 'Hyderabad', values: { Cassata: 84, 'Core Tub': 89, Cornetto: 90, 'KW Sticks': 87, Magnum: 90, 'Premium Tub': 82, Sandwich: 70 } },
]

// Brand price-pack positioning helpers --------------------------------------
const buildBandMidpoints = (bands) => {
  const mid = {}
  bands.forEach((b) => {
    if (b.includes('-')) {
      const [lo, hi] = b.split('-').map(Number)
      mid[b] = (lo + hi) / 2
    } else if (b.endsWith('+')) {
      const base = Number(b.replace('+', ''))
      mid[b] = base + 50
    } else {
      mid[b] = Number(b)
    }
  })
  return mid
}

const aggregateIndex = (records, allowed, mid) => {
  const sums = {}
  records.forEach((r) => {
    if (!allowed.includes(r.range)) return
    const m = mid[r.range] ?? 0
    if (!sums[r.brand]) sums[r.brand] = { total: 0, weighted: 0 }
    sums[r.brand].total += r.sales
    sums[r.brand].weighted += r.sales * m
  })
  const out = {}
  Object.entries(sums).forEach(([brand, val]) => {
    out[brand] = { total: val.total, index: val.total ? val.weighted / val.total : 0 }
  })
  return out
}

const priceMid = buildBandMidpoints(cleanPriceBands)
const qtyMid = buildBandMidpoints(cleanQuantityBands)

const computeBrandPositions = () => {
  const priceAgg = aggregateIndex(priceRecords, cleanPriceBands, priceMid)
  const qtyAgg = aggregateIndex(quantityRecords, cleanQuantityBands, qtyMid)
  const brands = Array.from(new Set([...Object.keys(priceAgg), ...Object.keys(qtyAgg)]))
  return brands.map((brand) => {
    const price = priceAgg[brand]?.index ?? 0
    const qty = qtyAgg[brand]?.index ?? 0
    const sales = priceAgg[brand]?.total ?? qtyAgg[brand]?.total ?? 0
    return { brand, priceIndex: Number(price.toFixed(1)), qtyIndex: Number(qty.toFixed(1)), sales }
  })
}

const brandColors = {
  Amul: '#f97316',
  'Baskin Robbins': '#ec4899',
  'Cream Bell': '#0ea5e9',
  "Giani's": '#a855f7',
  'Go-Zero': '#22c55e',
  Grameen: '#facc15',
  Havmor: '#ef4444',
  Hocco: '#06b6d4',
  'Kwality Walls': '#4f46e5',
  Others: '#94a3b8',
  Vadilal: '#10b981',
}

const BrandPositioningMap = () => {
  const data = useMemo(() => computeBrandPositions(), [])
  const [focus, setFocus] = useState(data[0]?.brand ?? null)

  const focused = data.find((d) => d.brand === focus) ?? data[0]
  const maxSales = useMemo(() => Math.max(...data.map((d) => d.sales || 1)), [data])

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(15,23,42,0.06)] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Price-pack map</p>
          <p className="text-sm text-slate-600">
            Bubble = brand · X: price index · Y: quantity index · size: sales. Click a bubble to focus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 justify-end">
          {data.slice(0, 8).map((d) => (
            <span key={d.brand} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColors[d.brand] || '#0ea5e9' }} />
              {d.brand}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-3 h-80 w-full">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 12, bottom: 20, left: -10 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="priceIndex"
                name="Price index"
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{ value: 'Price index', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#475569' } }}
              />
              <YAxis
                type="number"
                dataKey="qtyIndex"
                name="Quantity index"
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{ value: 'Quantity index', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#475569' } }}
              />
              <ZAxis dataKey="sales" range={[80, 350]} />
              <Tooltip
                cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
                formatter={(val, name) => {
                  if (name === 'sales') return [`₹ ${Number(val).toLocaleString('en-IN')}`, 'Sales']
                  return [val, name === 'priceIndex' ? 'Price index' : 'Quantity index']
                }}
              />
              <Scatter
                data={data}
                shape="circle"
                onClick={(d) => setFocus(d.brand)}
              >
                {data.map((entry) => (
                  <Cell key={entry.brand} fill={brandColors[entry.brand] || '#0ea5e9'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {focused && (
          <motion.div
            layout
            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm flex flex-col gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Focus brand</p>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: brandColors[focused.brand] || '#0ea5e9' }}
              />
              <span className="text-sm font-semibold text-slate-900">{focused.brand}</span>
            </div>
            <div className="text-xs text-slate-600">Price index: {focused.priceIndex.toFixed(1)}</div>
            <div className="text-xs text-slate-600">Quantity index: {focused.qtyIndex.toFixed(1)}</div>
            <div className="text-xs text-slate-600">Sales: ₹ {focused.sales.toLocaleString('en-IN')}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Size is relative to max sales ({maxSales.toLocaleString('en-IN')}). Use this map as a front-door story, then drill to cohort heatmap below.
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// Row + column drill test data (platform → region → city; quarter → month)
const quarterColumns = [
  { id: 'Q1', label: 'Q1', months: ['Jan', 'Feb'] },
  { id: 'Q2', label: 'Q2', months: ['Mar', 'Apr'] },
]

const cityMonthData = [
  { platform: 'Blinkit', region: 'East', city: 'Kolkata', values: { 'Q1|Jan': 92, 'Q1|Feb': 91, 'Q2|Mar': 89, 'Q2|Apr': 90 } },
  { platform: 'Blinkit', region: 'West', city: 'Mumbai', values: { 'Q1|Jan': 90, 'Q1|Feb': 89, 'Q2|Mar': 91, 'Q2|Apr': 92 } },
  { platform: 'Instamart', region: 'South', city: 'Hyderabad', values: { 'Q1|Jan': 84, 'Q1|Feb': 83, 'Q2|Mar': 82, 'Q2|Apr': 85 } },
  { platform: 'Instamart', region: 'South', city: 'Bengaluru', values: { 'Q1|Jan': 86, 'Q1|Feb': 85, 'Q2|Mar': 84, 'Q2|Apr': 86 } },
  { platform: 'Zepto', region: 'West', city: 'Mumbai', values: { 'Q1|Jan': 93, 'Q1|Feb': 92, 'Q2|Mar': 90, 'Q2|Apr': 91 } },
  { platform: 'Zepto', region: 'South', city: 'Chennai', values: { 'Q1|Jan': 90, 'Q1|Feb': 89, 'Q2|Mar': 88, 'Q2|Apr': 90 } },
]

// Time-drill dataset for quarter → month → day heatmap with multi-KPI tabs
const timelinePlatforms = ['Blinkit', 'Instamart', 'Virtual Store', 'Zepto']

const quarterTimeSeries = [
  {
    quarter: 'Q1',
    months: [
      {
        name: 'Jan',
        days: [
          { day: 1, values: { Blinkit: { ola: 92, loss: 0, roas: 5.3 }, Instamart: { ola: 86, loss: 0.1, roas: 4.7 }, 'Virtual Store': { ola: 74, loss: 0.4, roas: 3.9 }, Zepto: { ola: 93, loss: 0, roas: 5.6 } } },
          { day: 2, values: { Blinkit: { ola: 91, loss: 0, roas: 5.1 }, Instamart: { ola: 83, loss: 0.2, roas: 4.3 }, 'Virtual Store': { ola: 73, loss: 0.5, roas: 3.7 }, Zepto: { ola: 92, loss: 0, roas: 5.3 } } },
          { day: 3, values: { Blinkit: { ola: 90, loss: 0, roas: 5.0 }, Instamart: { ola: 84, loss: 0.1, roas: 4.5 }, 'Virtual Store': { ola: 73, loss: 0.4, roas: 3.8 }, Zepto: { ola: 92, loss: 0, roas: 5.5 } } },
          { day: 4, values: { Blinkit: { ola: 89, loss: 0.1, roas: 4.8 }, Instamart: { ola: 79, loss: 0.3, roas: 3.9 }, 'Virtual Store': { ola: 72, loss: 0.5, roas: 3.6 }, Zepto: { ola: 89, loss: 0.1, roas: 5.1 } } },
          { day: 5, values: { Blinkit: { ola: 90, loss: 0, roas: 5.2 }, Instamart: { ola: 80, loss: 0.2, roas: 4.2 }, 'Virtual Store': { ola: 73, loss: 0.4, roas: 3.7 }, Zepto: { ola: 91, loss: 0, roas: 5.4 } } },
          { day: 6, values: { Blinkit: { ola: 91, loss: 0, roas: 5.4 }, Instamart: { ola: 81, loss: 0.2, roas: 4.4 }, 'Virtual Store': { ola: 73, loss: 0.4, roas: 3.7 }, Zepto: { ola: 90, loss: 0.1, roas: 5.0 } } },
        ],
      },
      {
        name: 'Feb',
        days: [
          { day: 7, values: { Blinkit: { ola: 91, loss: 0, roas: 5.5 }, Instamart: { ola: 81, loss: 0.2, roas: 4.4 }, 'Virtual Store': { ola: 73, loss: 0.4, roas: 3.7 }, Zepto: { ola: 91, loss: 0, roas: 5.2 } } },
          { day: 8, values: { Blinkit: { ola: 91, loss: 0, roas: 5.3 }, Instamart: { ola: 82, loss: 0.2, roas: 4.5 }, 'Virtual Store': { ola: 73, loss: 0.4, roas: 3.8 }, Zepto: { ola: 92, loss: 0, roas: 5.3 } } },
          { day: 9, values: { Blinkit: { ola: 90, loss: 0, roas: 5.1 }, Instamart: { ola: 82, loss: 0.2, roas: 4.6 }, 'Virtual Store': { ola: 72, loss: 0.5, roas: 3.6 }, Zepto: { ola: 91, loss: 0, roas: 5.4 } } },
          { day: 10, values: { Blinkit: { ola: 90, loss: 0, roas: 5.0 }, Instamart: { ola: 81, loss: 0.3, roas: 4.4 }, 'Virtual Store': { ola: 73, loss: 0.5, roas: 3.7 }, Zepto: { ola: 91, loss: 0, roas: 5.3 } } },
        ],
      },
      {
        name: 'Mar',
        days: [
          { day: 11, values: { Blinkit: { ola: 89, loss: 0.1, roas: 4.9 }, Instamart: { ola: 82, loss: 0.2, roas: 4.6 }, 'Virtual Store': { ola: 73, loss: 0.5, roas: 3.8 }, Zepto: { ola: 90, loss: 0.1, roas: 5.1 } } },
          { day: 12, values: { Blinkit: { ola: 90, loss: 0, roas: 5.1 }, Instamart: { ola: 82, loss: 0.2, roas: 4.7 }, 'Virtual Store': { ola: 73, loss: 0.4, roas: 3.8 }, Zepto: { ola: 91, loss: 0, roas: 5.4 } } },
          { day: 13, values: { Blinkit: { ola: 89, loss: 0.1, roas: 4.8 }, Instamart: { ola: 82, loss: 0.2, roas: 4.6 }, 'Virtual Store': { ola: 73, loss: 0.5, roas: 3.7 }, Zepto: { ola: 89, loss: 0.1, roas: 5.2 } } },
          { day: 14, values: { Blinkit: { ola: 89, loss: 0.1, roas: 4.9 }, Instamart: { ola: 81, loss: 0.3, roas: 4.3 }, 'Virtual Store': { ola: 74, loss: 0.4, roas: 3.9 }, Zepto: { ola: 90, loss: 0.1, roas: 5.1 } } },
        ],
      },
    ],
  },
  {
    quarter: 'Q2',
    months: [
      {
        name: 'Apr',
        days: [
          { day: 1, values: { Blinkit: { ola: 90, loss: 0, roas: 5.1 }, Instamart: { ola: 84, loss: 0.1, roas: 4.6 }, 'Virtual Store': { ola: 75, loss: 0.3, roas: 4.0 }, Zepto: { ola: 92, loss: 0, roas: 5.5 } } },
          { day: 2, values: { Blinkit: { ola: 91, loss: 0, roas: 5.2 }, Instamart: { ola: 84, loss: 0.1, roas: 4.5 }, 'Virtual Store': { ola: 75, loss: 0.3, roas: 4.0 }, Zepto: { ola: 92, loss: 0, roas: 5.6 } } },
          { day: 3, values: { Blinkit: { ola: 92, loss: 0, roas: 5.4 }, Instamart: { ola: 85, loss: 0.1, roas: 4.8 }, 'Virtual Store': { ola: 75, loss: 0.3, roas: 4.1 }, Zepto: { ola: 93, loss: 0, roas: 5.7 } } },
          { day: 4, values: { Blinkit: { ola: 90, loss: 0, roas: 5.2 }, Instamart: { ola: 83, loss: 0.2, roas: 4.4 }, 'Virtual Store': { ola: 75, loss: 0.3, roas: 4.0 }, Zepto: { ola: 92, loss: 0, roas: 5.4 } } },
        ],
      },
      {
        name: 'May',
        days: [
          { day: 5, values: { Blinkit: { ola: 90, loss: 0, roas: 5.1 }, Instamart: { ola: 82, loss: 0.2, roas: 4.3 }, 'Virtual Store': { ola: 76, loss: 0.3, roas: 4.1 }, Zepto: { ola: 91, loss: 0, roas: 5.3 } } },
          { day: 6, values: { Blinkit: { ola: 91, loss: 0, roas: 5.2 }, Instamart: { ola: 83, loss: 0.2, roas: 4.5 }, 'Virtual Store': { ola: 76, loss: 0.3, roas: 4.2 }, Zepto: { ola: 93, loss: 0, roas: 5.6 } } },
          { day: 7, values: { Blinkit: { ola: 91, loss: 0, roas: 5.3 }, Instamart: { ola: 84, loss: 0.2, roas: 4.6 }, 'Virtual Store': { ola: 77, loss: 0.3, roas: 4.3 }, Zepto: { ola: 92, loss: 0, roas: 5.5 } } },
          { day: 8, values: { Blinkit: { ola: 92, loss: 0, roas: 5.4 }, Instamart: { ola: 84, loss: 0.2, roas: 4.7 }, 'Virtual Store': { ola: 77, loss: 0.3, roas: 4.3 }, Zepto: { ola: 93, loss: 0, roas: 5.7 } } },
        ],
      },
      {
        name: 'Jun',
        days: [
          { day: 9, values: { Blinkit: { ola: 92, loss: 0, roas: 5.5 }, Instamart: { ola: 85, loss: 0.1, roas: 4.8 }, 'Virtual Store': { ola: 78, loss: 0.3, roas: 4.5 }, Zepto: { ola: 94, loss: 0, roas: 5.9 } } },
          { day: 10, values: { Blinkit: { ola: 91, loss: 0, roas: 5.4 }, Instamart: { ola: 84, loss: 0.2, roas: 4.6 }, 'Virtual Store': { ola: 78, loss: 0.3, roas: 4.4 }, Zepto: { ola: 93, loss: 0, roas: 5.7 } } },
          { day: 11, values: { Blinkit: { ola: 92, loss: 0, roas: 5.6 }, Instamart: { ola: 85, loss: 0.1, roas: 4.8 }, 'Virtual Store': { ola: 78, loss: 0.3, roas: 4.5 }, Zepto: { ola: 94, loss: 0, roas: 6.0 } } },
          { day: 12, values: { Blinkit: { ola: 92, loss: 0, roas: 5.5 }, Instamart: { ola: 85, loss: 0.1, roas: 4.9 }, 'Virtual Store': { ola: 78, loss: 0.3, roas: 4.5 }, Zepto: { ola: 94, loss: 0, roas: 6.0 } } },
        ],
      },
    ],
  },
]

const cellHeat = (value) => {
  if (value >= 95) return 'bg-emerald-100 text-emerald-900'
  if (value >= 85) return 'bg-emerald-50 text-emerald-800'
  if (value >= 75) return 'bg-amber-50 text-amber-800'
  return 'bg-rose-50 text-rose-800'
}

const kpiModes = {
  ola: {
    label: 'OLA %',
    description: 'Availability strength across the network.',
    formatter: (v) => `${v.toFixed(0)}%`,
    heat: (v) => {
      if (v >= 92) return 'bg-emerald-100 text-emerald-900'
      if (v >= 85) return 'bg-emerald-50 text-emerald-800'
      if (v >= 78) return 'bg-amber-50 text-amber-800'
      return 'bg-rose-100 text-rose-900'
    },
  },
  loss: {
    label: 'Sales loss',
    description: 'Estimated revenue at risk (₹ lakh). Lower is better.',
    formatter: (v) => `₹${v.toFixed(1)}L`,
    heat: (v) => {
      if (v <= 0.1) return 'bg-emerald-100 text-emerald-900'
      if (v <= 0.25) return 'bg-amber-50 text-amber-800'
      return 'bg-rose-100 text-rose-900'
    },
  },
  roas: {
    label: 'ROAS',
    description: 'Return on ad spend at the edge.',
    formatter: (v) => `${v.toFixed(1)}x`,
    heat: (v) => {
      if (v >= 5.5) return 'bg-emerald-100 text-emerald-900'
      if (v >= 4.5) return 'bg-emerald-50 text-emerald-800'
      if (v >= 4) return 'bg-amber-50 text-amber-800'
      return 'bg-rose-100 text-rose-900'
    },
  },
}

const average = (values) =>
  values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0

const getPlatformNames = () => Object.keys(hierarchyTree)
const getRegionNames = (platform) => Object.keys(hierarchyTree[platform] || {})
const getCityNames = (platform, region) =>
  Object.keys(((hierarchyTree[platform] || {})[region] || {}))

const getCityOla = (platform, region, city) => {
  const node = (((hierarchyTree[platform] || {})[region] || {})[city] || {})
  return typeof node.ola === 'number' ? node.ola : 0
}

const getRegionOla = (platform, region) => {
  const cities = ((hierarchyTree[platform] || {})[region] || {})
  const values = Object.values(cities)
    .map((c) => c.ola ?? null)
    .filter((v) => typeof v === 'number')
  return Math.round(average(values))
}

const getPlatformOla = (platform) => {
  const regions = hierarchyTree[platform] || {}
  const values = []
  Object.values(regions).forEach((cities) => {
    Object.values(cities).forEach((c) => {
      if (typeof c.ola === 'number') values.push(c.ola)
    })
  })
  return Math.round(average(values))
}

const getOlaForLevelItem = (level, item, path) => {
  if (level === 'Platform') return getPlatformOla(item)
  if (level === 'Region') return getRegionOla(path.platform, item)
  if (level === 'City') return getCityOla(path.platform, path.region, item)
  return 0
}

const getHeatColor = (value) => {
  if (value === 0 || value == null) return 'rgba(226, 232, 240, 1)'
  if (value < 80) return 'rgba(254, 202, 202, 1)'
  if (value < 90) return 'rgba(254, 243, 199, 1)'
  if (value < 96) return 'rgba(187, 247, 208, 1)'
  return 'rgba(22, 163, 74, 0.95)'
}

const getFirstRegion = (platform) => getRegionNames(platform)[0] || ''
const getFirstCity = (platform, region) => getCityNames(platform, region)[0] || ''

const avgForKeys = (rows) => (rows.length ? Math.round(average(rows)) : 0)

const OlaLightThemeDashboard = () => {
  const [level, setLevel] = useState('Platform')
  const [activeItem, setActiveItem] = useState('Blinkit')
  const [path, setPath] = useState({
    platform: 'Blinkit',
    region: 'East',
    city: 'Kolkata',
  })

  const breadcrumbOrder = ['Platform', 'Region', 'City']
  const currentIndex = breadcrumbOrder.indexOf(level)
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < breadcrumbOrder.length - 1

  const currentItems = useMemo(() => {
    if (level === 'Platform') return getPlatformNames()
    if (level === 'Region') return getRegionNames(path.platform)
    if (level === 'City') return getCityNames(path.platform, path.region)
    return []
  }, [level, path.platform, path.region])

  const selectItem = (item) => {
    if (level === 'Platform') {
      const nextRegion = getFirstRegion(item)
      const nextCity = nextRegion ? getFirstCity(item, nextRegion) : ''
      setPath({ platform: item, region: nextRegion, city: nextCity })
      setActiveItem(item)
    } else if (level === 'Region') {
      const nextCity = getFirstCity(path.platform, item)
      setPath((prev) => ({ ...prev, region: item, city: nextCity }))
      setActiveItem(item)
    } else {
      setPath((prev) => ({ ...prev, city: item }))
      setActiveItem(item)
    }
  }

  const goBack = () => {
    if (canGoBack) setLevel(breadcrumbOrder[currentIndex - 1])
  }
  const goForward = () => {
    if (canGoForward) setLevel(breadcrumbOrder[currentIndex + 1])
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-slate-50 flex items-center justify-center text-xs font-semibold tracking-tight">
            OLA
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Availability Control Tower</h1>
            <p className="text-xs text-slate-500">Absolute OLA · Light Theme · Motion-first UI</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button className="rounded-full bg-slate-900 text-slate-50 px-3 py-1 font-medium shadow-sm">Absolute OLA</button>
          <button className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-medium border border-slate-200">Weighted OLA</button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Last sync: 5 min ago</span>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-12 gap-4">
        <motion.div
          layout
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="col-span-12 lg:col-span-3 rounded-2xl bg-white shadow-sm border border-slate-100 p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Network OLA</p>
              <p className="text-3xl font-semibold tracking-tight">77%</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              +2.1 pts vs TDP-1
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>Sales loss (₹)</span>
            <span className="font-semibold text-slate-800">0</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100 flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">In-stock</span>
              <span className="text-lg font-semibold">77%</span>
              <span className="text-[11px] text-emerald-600">▲ metro +3 pts</span>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100 flex flex-col gap-1">
              <span className="text-[11px] text-slate-500">Metro OLA</span>
              <span className="text-lg font-semibold">77%</span>
              <span className="text-[11px] text-sky-600">▲ non-metro +1 pt</span>
            </div>
          </div>
        </motion.div>

        {/* Platform pulse */}
        <motion.div
          layout
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="col-span-12 lg:col-span-9 rounded-2xl bg-white shadow-sm border border-slate-100 px-4 py-3"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-[0.16em]">
              Platform Pulse · last 5 days
            </p>
            <p className="text-[11px] text-slate-400">Tap a ring to focus drill-down</p>
          </div>
          <div className="grid grid-flow-col auto-cols-[120px] md:auto-cols-[140px] gap-3 overflow-x-auto pb-2">
            {platformPulse.map((p) => (
              <motion.button
                key={p.name}
                whileHover={{ y: -4, boxShadow: '0 18px 45px rgba(15, 23, 42, 0.15)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setLevel('Platform')
                  selectItem(p.name)
                }}
                className={`relative h-36 rounded-2xl border bg-white flex flex-col items-center justify-center gap-1 px-2 transition-colors ${
                  activeItem === p.name ? 'border-slate-900/80' : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                <ResponsiveContainer width="100%" height="70%">
                  <RadialBarChart
                    innerRadius="60%"
                    outerRadius="100%"
                    data={[{ ...p, fill: p.color }]}
                    startAngle={220}
                    endAngle={-40}
                  >
                    <RadialBar minAngle={15} background clockWise dataKey="value" cornerRadius={50} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{p.name}</span>
                  <span className="text-lg font-semibold text-slate-900">{p.value}%</span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Middle strip */}
      <section className="grid grid-cols-12 gap-4">
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="col-span-12 xl:col-span-4 rounded-2xl bg-white shadow-sm border border-slate-100 p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Hierarchy drill</p>
              <p className="text-xs text-slate-500">Move from platform to zone and city in one place.</p>
            </div>
            <div className="flex gap-1 text-[11px]">
              <button
                disabled={!canGoBack}
                onClick={goBack}
                className={`rounded-full border px-2 py-1 ${
                  canGoBack ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                ← Back
              </button>
              <button
                disabled={!canGoForward}
                onClick={goForward}
                className={`rounded-full border px-2 py-1 ${
                  canGoForward ? 'border-slate-900 text-slate-900 bg-slate-900/5 hover:bg-slate-900/10' : 'border-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                Forward →
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] mt-1">
            {breadcrumbOrder.map((b, idx) => (
              <button
                key={b}
                onClick={() => setLevel(b)}
                className={`rounded-full px-3 py-1 border transition-all flex items-center gap-1 ${
                  b === level
                    ? 'border-slate-900 bg-slate-900 text-slate-50'
                    : idx < currentIndex
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span>{b}</span>
              </button>
            ))}
          </div>

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={level}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-2 max-h-64 overflow-auto"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-slate-500">
                  {level} items for <span className="font-semibold text-slate-700">{activeItem}</span>
                </p>
                <p className="text-[11px] text-slate-400">Metric: absolute OLA%</p>
              </div>
              <ul className="divide-y divide-slate-200/80 text-xs">
                {currentItems.map((item) => {
                  const value = getOlaForLevelItem(level, item, path) || 0
                  return (
                    <motion.li
                      key={item}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800 group-hover:text-slate-900">{item}</span>
                        <span className="text-[10px] text-slate-400">
                          {level === 'City' ? 'City · Blinkit + Zepto' : level}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 min-w-[90px]">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-slate-900/80" style={{ width: `${value}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-900">{value}%</span>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Matrix table */}
        <MatrixPlatformFormat />
      </section>

      {/* Bottom trend strip */}
      <section className="grid grid-cols-12 gap-4 pb-2">
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="col-span-12 rounded-2xl bg-white shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Overall trend</p>
              <p className="text-xs text-slate-500">
                TDP window · touch points to see exact value
              </p>
            </div>
            <div className="flex gap-2 text-[11px] text-slate-500 items-center">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-4 rounded-full bg-slate-900/80" /> Network OLA
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-4 rounded-full bg-slate-300" /> 75% baseline
              </span>
            </div>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 18, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="olaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.22} />
                    <stop offset="90%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[75, 79]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 11 }}
                  labelFormatter={(v) => `Day ${v}`}
                  formatter={(val) => [`${val}%`, 'OLA']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f172a"
                  strokeWidth={2}
                  fill="url(#olaFill)"
                  dot={{ r: 2.2 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </section>
    </div>
  )
}

// Separate component for the Platform x Format matrix (extracted from middle section to keep file readable)
const MatrixPlatformFormat = () => {
  const [hoverRowKey, setHoverRowKey] = useState(null)
  const [selection, setSelection] = useState(null)
  const [expandedPlatforms, setExpandedPlatforms] = useState({
    Blinkit: true,
    Instamart: true,
    Zepto: true,
  })
  const [expandedRegions, setExpandedRegions] = useState({})
  const [expandedQuarters, setExpandedQuarters] = useState({ Q1: true, Q2: true })

  const platforms = useMemo(
    () => Array.from(new Set(cityMonthData.map((r) => r.platform))),
    [],
  )
  const regionsFor = (p) =>
    Array.from(new Set(cityMonthData.filter((r) => r.platform === p).map((r) => r.region)))
  const citiesFor = (p, r) =>
    cityMonthData.filter((row) => row.platform === p && row.region === r)

  const rowKey = (platform, region, city) =>
    [platform, region || '-', city || '-'].join('|')

  const activeColumns = useMemo(() => {
    const cols = []
    quarterColumns.forEach((q) => {
      if (expandedQuarters[q.id]) {
        q.months.forEach((m) => cols.push({ id: `${q.id}|${m}`, label: m }))
      } else {
        cols.push({ id: q.id, label: q.label })
      }
    })
    return cols
  }, [expandedQuarters])

  const anyPlatformExpanded = Object.values(expandedPlatforms).some(Boolean)
  const anyRegionExpanded = Object.entries(expandedRegions).some(([key, isOpen]) => {
    if (!isOpen) return false
    const [p] = key.split('|')
    return expandedPlatforms[p]
  })
  const showRegionColumn = anyPlatformExpanded
  const showCityColumn = anyRegionExpanded
  const hierarchyColSpan = 1 + (showRegionColumn ? 1 : 0) + (showCityColumn ? 1 : 0)

  const cellValue = (rows, colId) => {
    if (!rows.length) return 0

    if (colId.includes('|')) {
      return avgForKeys(rows.map((r) => r.values[colId] ?? 0))
    }

    const targetQuarter = colId
    const keys = Object.keys(rows[0].values || {}).filter((k) => k.startsWith(`${targetQuarter}|`))

    return avgForKeys(
      rows.flatMap((r) => keys.map((k) => r.values[k] ?? 0)),
    )
  }

  const rowsForSelection = (sel) =>
    cityMonthData.filter(
      (r) =>
        r.platform === sel.platform &&
        (!sel.region || r.region === sel.region) &&
        (!sel.city || r.city === sel.city),
    )

  const selectionMeta = useMemo(() => {
    if (!selection) return null
    const rows = rowsForSelection(selection)
    const value = cellValue(rows, selection.colId)

    const [qId, mLabelRaw] = selection.colId.includes('|')
      ? selection.colId.split('|')
      : [selection.colId, '']
    const quarterDef = quarterColumns.find((q) => q.id === qId)
    const quarterLabel = quarterDef?.label || qId
    const monthLabel = mLabelRaw || 'Quarter avg'

    const quarterRows = cityMonthData.filter((r) => r.platform === selection.platform)
    const quarterAvg = cellValue(quarterRows, qId)
    const networkRows = cityMonthData
    const networkAvg = cellValue(networkRows, selection.colId)

    return {
      value,
      label: `${selection.platform}${
        selection.region ? ' · ' + selection.region : ''
      }${selection.city ? ' · ' + selection.city : ''}`,
      bucket: `${quarterLabel} · ${monthLabel}`,
      quarterAvg,
      networkAvg,
    }
  }, [selection])

  const expandAllRows = () => {
    const pState = {}
    const rState = {}
    platforms.forEach((p) => {
      pState[p] = true
      regionsFor(p).forEach((r) => {
        rState[`${p}|${r}`] = true
      })
    })
    setExpandedPlatforms(pState)
    setExpandedRegions(rState)
  }

  const collapseAllRows = () => {
    setExpandedPlatforms({})
    setExpandedRegions({})
  }

  const renderRow = (platform, region, city) => {
    const rowRows =
      cityMonthData.filter(
        (r) =>
          r.platform === platform &&
          (!region || r.region === region) &&
          (!city || r.city === city),
      ) || []

    const isPlatform = !region && !city
    const isRegion = !!region && !city
    const isCity = !!city

    const rk = rowKey(platform, region, city)
    const platformCellColSpan = showRegionColumn || showCityColumn ? 1 : hierarchyColSpan

    const avgAcrossActiveCols =
      activeColumns.length > 0 ? avgForKeys(activeColumns.map((c) => cellValue(rowRows, c.id))) : 0

    return (
      <motion.tr
        key={`${platform}-${region || ''}-${city || ''}`}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        onMouseEnter={() => setHoverRowKey(rk)}
        onMouseLeave={() => setHoverRowKey(null)}
        className={[
          'border-t border-slate-100 group',
          isPlatform ? 'bg-slate-50/60' : '',
          isCity ? 'bg-white' : '',
          hoverRowKey === rk ? 'bg-sky-50/60' : '',
          selection && rowKey(selection.platform, selection.region, selection.city) === rk
            ? 'bg-sky-100/70'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* main hierarchy cell */}
        <td
          className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-slate-100"
          colSpan={isPlatform ? platformCellColSpan : 1}
        >
          <div className="flex items-center gap-2">
            {isPlatform && (
              <button
                className="h-6 w-6 rounded-md border border-slate-200 bg-white text-xs text-slate-600 flex items-center justify-center shadow-sm"
                onClick={() =>
                  setExpandedPlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }))
                }
              >
                {expandedPlatforms[platform] ? '-' : '+'}
              </button>
            )}
            {isRegion && (
              <button
                className="h-5 w-5 rounded-md border border-slate-200 bg-white text-[10px] text-slate-500 flex items-center justify-center"
                onClick={() =>
                  setExpandedRegions((prev) => ({
                    ...prev,
                    [`${platform}|${region}`]: !prev[`${platform}|${region}`],
                  }))
                }
              >
                {expandedRegions[`${platform}|${region}`] ? '-' : '+'}
              </button>
            )}
            {isCity && <span className="text-slate-400 text-xs">•</span>}
            <div className="flex flex-col">
              <span
                className={[
                  'truncate',
                  isPlatform ? 'font-semibold text-slate-900' : '',
                  isRegion ? 'font-semibold text-slate-700' : '',
                  isCity ? 'font-medium text-slate-700' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {platform}
              </span>
              {(isRegion || isCity) && (
                <span className="text-[10px] text-slate-400">
                  {isRegion && 'Region'}
                  {isCity && `${region ? region + ' · ' : ''}City`}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* region & city sticky columns */}
        {showRegionColumn && (
          <td className="px-3 py-2 whitespace-nowrap sticky left-[10.5rem] bg-inherit z-10 border-r border-slate-100 text-xs text-slate-700">
            {region || (isPlatform ? '—' : platform)}
          </td>
        )}
        {showCityColumn && (
          <td className="px-3 py-2 whitespace-nowrap sticky left-[16rem] bg-inherit z-10 border-r border-slate-100 text-xs text-slate-700">
            {city || '—'}
          </td>
        )}

        {/* data cells */}
        {activeColumns.map((c) => {
          const val = cellValue(rowRows, c.id)
          const isSelectedCell =
            selection &&
            selection.colId === c.id &&
            selection.platform === platform &&
            selection.region === region &&
            selection.city === city

          return (
            <td key={c.id} className="px-2 py-1 text-center align-middle">
              <button
                type="button"
                onClick={() =>
                  setSelection({
                    platform,
                    region,
                    city,
                    colId: c.id,
                  })
                }
                className={[
                  'w-full px-2 py-1 rounded-md text-[11px] font-semibold border transition-all',
                  cellHeat(val),
                  isSelectedCell
                    ? 'border-sky-500 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]'
                    : 'border-transparent hover:border-sky-300 hover:shadow-sm',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {val ? `${val}%` : '—'}
              </button>
            </td>
          )
        })}

        {/* small row avg pill at the end */}
        <td className="px-3 py-1 text-right text-[10px] text-slate-500 whitespace-nowrap">
          {avgAcrossActiveCols ? `avg ${avgAcrossActiveCols}%` : ''}
        </td>
      </motion.tr>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.45 }}
      className="col-span-12 xl:col-span-8 rounded-2xl bg-white shadow-sm border border-slate-100 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Platform x format matrix</p>
          <p className="text-xs text-slate-500">Compact matrix with subtle band for OLA strength.</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-0.5 rounded-full bg-emerald-600" /> ≥ 96%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-0.5 rounded-full bg-lime-500" /> 90–95%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-0.5 rounded-full bg-amber-500" /> 80–89%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-0.5 rounded-full bg-rose-500" /> &lt; 80%</span>
        </div>
      </div>

      {/* selection summary bar */}
      {selectionMeta && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-2 flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.16em] text-sky-500">
              Focus cell
            </span>
            <span className="font-semibold text-slate-900">{selectionMeta.label}</span>
            <span className="text-[11px] text-slate-500">{selectionMeta.bucket}</span>
          </div>
          <div className="flex items-baseline gap-1 text-slate-900">
            <span className="text-[11px] text-slate-500 mr-1">OLA</span>
            <span className="text-xl font-semibold">{selectionMeta.value}%</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
              Platform quarter avg: {selectionMeta.quarterAvg}%
            </span>
            <span className="px-2 py-1 rounded-full bg-white border border-slate-200">
              Network avg: {selectionMeta.networkAvg}%
            </span>
          </div>
          <button
            className="ml-auto px-3 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-600 hover:border-slate-300"
            onClick={() => setSelection(null)}
          >
            Clear selection
          </button>
        </motion.div>
      )}

      {/* main table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 mt-3">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold text-slate-600 w-40 sticky left-0 z-20 bg-slate-50 border-r border-slate-100"
                colSpan={hierarchyColSpan}
              >
                Platform / Region / City
              </th>
              {quarterColumns.map((q) => (
                <th
                  key={q.id}
                  className="px-3 py-2 text-center font-semibold text-slate-600 border-l border-slate-100"
                  colSpan={expandedQuarters[q.id] ? q.months.length : 1}
                >
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="h-6 w-6 rounded-md border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
                      onClick={() =>
                        setExpandedQuarters((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                      }
                    >
                      {expandedQuarters[q.id] ? '-' : '+'}
                    </button>
                    <span>{q.label}</span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Row avg</th>
            </tr>
            <tr className="bg-slate-50 border-t border-slate-100">
              <th className="px-3 py-1 text-left text-slate-500 font-medium sticky left-0 z-20 bg-slate-50 border-r border-slate-100">
                Day bucket
              </th>
              {showRegionColumn && (
                <th className="px-3 py-1 text-left text-slate-500 font-medium sticky left-[10.5rem] z-20 bg-slate-50 border-r border-slate-100">
                  Region
                </th>
              )}
              {showCityColumn && (
                <th className="px-3 py-1 text-left text-slate-500 font-medium sticky left-[16rem] z-20 bg-slate-50 border-r border-slate-100">
                  City
                </th>
              )}
              {activeColumns.map((c) => (
                <th key={c.id} className="px-2 py-1 text-center text-slate-500 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-1 text-right text-slate-500 font-medium">Avg</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {platforms.map((p) => {
                const pExpanded = expandedPlatforms[p]
                return (
                  <React.Fragment key={p}>
                    {renderRow(p)}
                    {pExpanded &&
                      regionsFor(p).map((r) => {
                        const rKey = `${p}|${r}`
                        const rExpanded = expandedRegions[rKey]
                        return (
                          <React.Fragment key={rKey}>
                            {renderRow(p, r)}
                            {rExpanded &&
                              citiesFor(p, r).map((c) => renderRow(p, r, c.city))}
                          </React.Fragment>
                        )
                      })}
                  </React.Fragment>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
        <button
          onClick={expandAllRows}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Expand rows
        </button>
        <button
          onClick={collapseAllRows}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Collapse rows
        </button>
        <button
          onClick={() => setExpandedQuarters({ Q1: true, Q2: true })}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Expand columns
        </button>
        <button
          onClick={() => setExpandedQuarters({})}
          className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300"
        >
          Collapse columns
        </button>
      </div>
    </motion.div>
  )
}

// Modern PowerBI-style hierarchical heatmap with inline expanders
const PowerHierarchyHeat = () => {
  const [expandedPlatforms, setExpandedPlatforms] = useState({})
  const [expandedRegions, setExpandedRegions] = useState({})

  const platforms = useMemo(() => Array.from(new Set(cityFormatData.map((r) => r.platform))), [])
  const regionsForPlatform = (p) =>
    Array.from(new Set(cityFormatData.filter((r) => r.platform === p).map((r) => r.region)))
  const citiesFor = (p, r) => cityFormatData.filter((row) => row.platform === p && row.region === r)

  const expandAll = () => {
    const pState = {}
    const rState = {}
    platforms.forEach((p) => {
      pState[p] = true
      regionsForPlatform(p).forEach((r) => {
        rState[`${p}|${r}`] = true
      })
    })
    setExpandedPlatforms(pState)
    setExpandedRegions(rState)
  }

  const collapseAll = () => {
    setExpandedPlatforms({})
    setExpandedRegions({})
  }

  const anyPlatformExpanded = Object.values(expandedPlatforms).some(Boolean)
  const anyRegionExpanded = Object.entries(expandedRegions).some(([key, isOpen]) => {
    if (!isOpen) return false
    const [platformFromKey] = key.split('|')
    return expandedPlatforms[platformFromKey]
  })
  const showRegionColumn = anyPlatformExpanded
  const showCityColumn = anyRegionExpanded
  const hierarchyColSpan = 1 + (showRegionColumn ? 1 : 0) + (showCityColumn ? 1 : 0)

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(15,23,42,0.08)] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Power hierarchy</p>
          <p className="text-sm text-slate-600">Platform → Region → City across formats with inline heat.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded-full text-sm border border-slate-200 bg-white hover:border-slate-300"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded-full text-sm border border-slate-200 bg-white hover:border-slate-300"
          >
            Collapse all
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold text-slate-600 w-32">Platform</th>
              {showRegionColumn && <th className="px-3 py-2 font-semibold text-slate-600 w-28">Region</th>}
              {showCityColumn && <th className="px-3 py-2 font-semibold text-slate-600 w-28">City</th>}
              {formatColumns.map((f) => (
                <th key={f} className="px-3 py-2 font-semibold text-slate-600 text-center whitespace-nowrap">
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((platform) => {
              const platformExpanded = expandedPlatforms[platform]
              const platformRows = cityFormatData.filter((r) => r.platform === platform)
              const platformAvg = {}
              formatColumns.forEach((f) => {
                const vals = platformRows.map((r) => r.values[f] ?? 0)
                platformAvg[f] = vals.length ? Math.round(average(vals)) : 0
              })
              return (
                <React.Fragment key={platform}>
                  <tr className="border-t border-slate-100 bg-slate-50/70">
                    <td className="px-3 py-2 font-semibold text-slate-800" colSpan={hierarchyColSpan}>
                      <button
                        onClick={() =>
                          setExpandedPlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }))
                        }
                        className="mr-2 text-slate-600"
                      >
                        {platformExpanded ? '-' : '+'}
                      </button>
                      {platform}
                    </td>
                    {formatColumns.map((f) => (
                      <td key={f} className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded ${cellHeat(platformAvg[f])}`}>{platformAvg[f]}%</span>
                      </td>
                    ))}
                  </tr>
                  {platformExpanded &&
                    regionsForPlatform(platform).map((region) => {
                      const regionKey = `${platform}|${region}`
                      const regionRows = citiesFor(platform, region)
                      const avg = {}
                      formatColumns.forEach((f) => {
                        const vals = regionRows.map((c) => c.values[f] ?? 0)
                        avg[f] = vals.length ? Math.round(average(vals)) : 0
                      })
                      const isOpen = expandedRegions[regionKey]
                      return (
                        <React.Fragment key={regionKey}>
                          <tr className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500">{platform}</td>
                            {showRegionColumn && (
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                <button
                                  onClick={() =>
                                    setExpandedRegions((prev) => ({ ...prev, [regionKey]: !prev[regionKey] }))
                                  }
                                  className="mr-2 text-slate-500"
                                >
                                  {isOpen ? '-' : '+'}
                                </button>
                                {region}
                              </td>
                            )}
                            {showCityColumn && <td className="px-3 py-2 text-slate-300">-</td>}
                            {formatColumns.map((f) => (
                              <td key={f} className="px-3 py-2 text-center">
                                <span className={`px-2 py-1 rounded ${cellHeat(avg[f])}`}>{avg[f]}%</span>
                              </td>
                            ))}
                          </tr>
                          {isOpen &&
                            regionRows.map((row) => (
                              <tr key={`${regionKey}-${row.city}`} className="border-t border-slate-100 bg-slate-50/60">
                                <td className="px-3 py-2 text-slate-500 pl-8">{platform}</td>
                                {showRegionColumn && <td className="px-3 py-2 text-slate-600 pl-4">{region}</td>}
                                {showCityColumn && (
                                  <td className="px-3 py-2 text-slate-800 pl-4 font-medium">{row.city}</td>
                                )}
                                {formatColumns.map((f) => {
                                  const val = row.values[f] ?? 0
                                  return (
                                    <td key={f} className="px-3 py-2 text-center">
                                      <span className={`px-2 py-1 rounded ${cellHeat(val)}`}>{val}%</span>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                        </React.Fragment>
                      )
                    })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Quarter → month drill-down with animated headers and KPI tabs
const QuarterlyDrilldownGrid = () => {
  const [activeKpi, setActiveKpi] = useState('ola')
  const [expandedQuarters, setExpandedQuarters] = useState({ Q1: true, Q2: true })

  const toggleQuarter = (q) => setExpandedQuarters((prev) => ({ ...prev, [q]: !prev[q] }))

  const formatMetric = (value) => kpiModes[activeKpi].formatter(value)
  const heat = (value) => kpiModes[activeKpi].heat(value)

  const averageForQuarter = (quarter, platform) => {
    const vals = []
    quarter.months.forEach((m) =>
      m.days.forEach((d) => {
        const entry = d.values[platform]
        if (entry) vals.push(entry[activeKpi])
      }),
    )
    return vals.length ? average(vals) : 0
  }

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_10px_36px_rgba(15,23,42,0.06)] p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quarter drill</p>
          <p className="text-sm text-slate-600">Drill from quarter to month days with KPI-aware heat.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50/80 rounded-full p-1 border border-slate-100 shadow-inner">
          {Object.entries(kpiModes).map(([key, meta]) => {
            const isActive = key === activeKpi
            return (
              <motion.button
                key={key}
                onClick={() => setActiveKpi(key)}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  isActive ? 'text-slate-900' : 'text-slate-500'
                }`}
                whileHover={{ y: -1 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="kpi-pill"
                    className="absolute inset-0 rounded-full bg-white shadow-sm border border-slate-200"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
                  />
                )}
                <span className="relative">{meta.label}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500">{kpiModes[activeKpi].description}</p>

      <div className="space-y-3">
        {quarterTimeSeries.map((quarter) => {
          const open = expandedQuarters[quarter.quarter]
          return (
            <div
              key={quarter.quarter}
              className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-sm overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleQuarter(quarter.quarter)}
                    className="h-8 w-8 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center shadow-sm"
                  >
                    {open ? '-' : '+'}
                  </button>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Quarter</p>
                    <p className="text-sm font-semibold text-slate-800">{quarter.quarter} · 2025</p>
                    <p className="text-[11px] text-slate-500">Tap plus to reveal months & days.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  {timelinePlatforms.map((platform) => {
                    const avg = averageForQuarter(quarter, platform)
                    return (
                      <span
                        key={platform}
                        className={`px-2 py-1 rounded-full border border-slate-200 bg-white flex items-center gap-2 shadow-sm ${heat(avg)}`}
                      >
                        <span className="font-semibold text-slate-800">{platform}</span>
                        <span>{formatMetric(avg)}</span>
                      </span>
                    )
                  })}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="border-t border-slate-100"
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-50/70">
                            <th className="px-3 py-2 text-left font-semibold text-slate-600 w-32">Platform</th>
                            {quarter.months.map((m) => (
                              <th key={m.name} className="px-3 py-2 text-center font-semibold text-slate-600" colSpan={m.days.length}>
                                {m.name}
                              </th>
                            ))}
                          </tr>
                          <tr className="bg-slate-50/70 border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Day</th>
                            {quarter.months.flatMap((m) =>
                              m.days.map((d) => (
                                <th key={`${m.name}-${d.day}`} className="px-2 py-1 text-center text-slate-500">
                                  {d.day}
                                </th>
                              )),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {timelinePlatforms.map((platform) => (
                            <tr key={platform} className="border-b border-slate-50">
                              <td className="px-3 py-2 text-slate-700 font-semibold whitespace-nowrap">
                                {platform}
                                <span className="ml-2 text-[10px] text-slate-400">
                                  avg {formatMetric(averageForQuarter(quarter, platform))}
                                </span>
                              </td>
                              {quarter.months.flatMap((m) =>
                                m.days.map((d) => {
                                  const metrics = d.values[platform]
                                  const value = metrics ? metrics[activeKpi] : 0
                                  return (
                                    <td key={`${platform}-${m.name}-${d.day}`} className="px-1.5 py-1 text-center">
                                      <span className={`block rounded-md px-2 py-1 font-semibold ${heat(value)}`}>
                                        {formatMetric(value)}
                                      </span>
                                    </td>
                                  )
                                }),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Format VS studio
// ---------------------------------------------------------------------------

const FORMAT_ROWS = [
  { name: 'Cassata', offtakes: 4, spend: 0, roas: 3.2, inorgSalesPct: 19, conversionPct: 2.3, marketSharePct: 23, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 384, cpc: 4736 },
  { name: 'Core Tub', offtakes: 61, spend: 2, roas: 5.5, inorgSalesPct: 18, conversionPct: 2.6, marketSharePct: 16, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 404, cpc: 51 },
  { name: 'Cornetto', offtakes: 48, spend: 1, roas: 7.4, inorgSalesPct: 12, conversionPct: 10.7, marketSharePct: 8, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 456, cpc: 71 },
  { name: 'Cup', offtakes: 4, spend: 0, roas: 5.2, inorgSalesPct: 2, conversionPct: 1.9, marketSharePct: 3, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 210, cpc: 15 },
  { name: 'KW Sticks', offtakes: 9, spend: 0, roas: 5.7, inorgSalesPct: 13, conversionPct: 4.1, marketSharePct: 22, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 402, cpc: 96 },
  { name: 'Magnum', offtakes: 14, spend: 0, roas: 9.9, inorgSalesPct: 35, conversionPct: 5.6, marketSharePct: 22, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 428, cpc: 169 },
  { name: 'Others', offtakes: 0, spend: 0, roas: 14.2, inorgSalesPct: 100, conversionPct: 1.4, marketSharePct: 0, promoMyBrandPct: 100, promoCompetePct: 100, cpm: 337, cpc: 16 },
]

const formatNumber = (value) => (Number.isFinite(value) ? value.toLocaleString('en-IN') : 'NaN')
const pct = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : 'NaN')
const clamp01 = (value) => Math.max(0, Math.min(1, value))

const FormatPerformanceStudio = () => {
  const [activeName, setActiveName] = useState(FORMAT_ROWS[0]?.name)
  const [compareName, setCompareName] = useState(null)

  const active = useMemo(() => FORMAT_ROWS.find((f) => f.name === activeName) ?? FORMAT_ROWS[0], [activeName])
  const compare = useMemo(() => (compareName ? FORMAT_ROWS.find((f) => f.name === compareName) ?? null : null), [compareName])
  const maxOfftakes = useMemo(() => Math.max(...FORMAT_ROWS.map((f) => f.offtakes || 1)), [])

  const kpiBands = [
    { key: 'roas', label: 'ROAS', activeValue: active.roas, compareValue: compare?.roas ?? null, max: 15, format: (v) => `${v.toFixed(1)}x` },
    { key: 'inorg', label: 'Inorg sales', activeValue: active.inorgSalesPct, compareValue: compare?.inorgSalesPct ?? null, max: 100, format: pct },
    { key: 'conv', label: 'Conversion', activeValue: active.conversionPct, compareValue: compare?.conversionPct ?? null, max: 15, format: pct },
    { key: 'ms', label: 'Market share', activeValue: active.marketSharePct, compareValue: compare?.marketSharePct ?? null, max: 30, format: pct },
    { key: 'cpm', label: 'CPM', activeValue: active.cpm, compareValue: compare?.cpm ?? null, max: 800, format: (v) => v.toFixed(0) },
    { key: 'cpc', label: 'CPC', activeValue: active.cpc, compareValue: compare?.cpc ?? null, max: 5000, format: (v) => (Number.isFinite(v) ? v.toFixed(0) : 'Infinity') },
  ]

  return (
    <motion.div
      className="rounded-3xl bg-white/70 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-sky-900/5 p-4 lg:p-6 grid grid-cols-1 md:grid-cols-5 gap-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Format performance</h2>
            <p className="text-xs text-slate-500">Hover a format to see its DNA. Click a pill below to compare.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {FORMAT_ROWS.map((f) => {
            const intensity = clamp01(f.offtakes / maxOfftakes)
            const isActive = f.name === activeName
            return (
              <motion.button
                key={f.name}
                onMouseEnter={() => setActiveName(f.name)}
                onClick={() => setActiveName(f.name)}
                className={`w-full flex items-center justify-between rounded-2xl px-3 py-2 text-xs border ${
                  isActive ? 'border-sky-400 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white/70 hover:bg-slate-50'
                }`}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] flex items-center justify-center text-white shadow-md"
                    style={{ opacity: 0.3 + intensity * 0.7 }}
                  >
                    {f.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-[10px] text-slate-500">
                      Offtakes {f.offtakes} · ROAS {f.roas.toFixed(1)}x
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end text-[10px] text-slate-500">
                  <span>MS {f.marketSharePct}%</span>
                  <span>Conv {f.conversionPct}%</span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      <div className="md:col-span-3 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.name + (compare?.name ?? '')}
            className="h-full rounded-3xl bg-gradient-to-br from-sky-100 via-white to-indigo-50 border border-slate-200/70 shadow-lg p-4 lg:p-6 flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-sky-500">
                  {compare ? 'Focus format · VS mode' : 'Focus format'}
                </div>
                <div className="text-xl font-semibold">
                  {active.name}
                  {compare && <span className="text-sm font-normal text-slate-500"> vs {compare.name}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">Offtakes, ROAS, conversion and share in one view.</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <div className="text-[10px] text-slate-500">Offtakes</div>
                <div className="text-lg font-semibold">{formatNumber(active.offtakes)}</div>
                <div className="mt-1 text-[10px] text-slate-500">Market share</div>
                <div className="text-sm font-medium">{active.marketSharePct}%</div>
                {compare && (
                  <div className="mt-1 text-[10px] text-rose-500">
                    Delta ROAS {Number.isFinite(compare.roas) ? (active.roas - compare.roas).toFixed(1) : '-'}x vs {compare.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle cx="50" cy="50" r="38" stroke="rgba(148,163,184,0.25)" strokeWidth="8" fill="none" />
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
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ transformOrigin: '50% 50%', rotate: '-90deg' }}
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
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ transformOrigin: '50% 50%', rotate: '-90deg' }}
                  />
                  <defs>
                    <linearGradient id="roasGradient" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
                  <div className="text-[10px] text-slate-500">ROAS</div>
                  <div className="text-lg font-semibold">{active.roas.toFixed(1)}x</div>
                  {compare && <div className="text-[9px] text-violet-600 mt-0.5">vs {compare.roas.toFixed(1)}x</div>}
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {kpiBands.map((k) => {
                  const activeRatio = clamp01(k.activeValue / k.max)
                  const compareRatio = k.compareValue != null ? clamp01(k.compareValue / k.max) : null
                  return (
                    <div key={k.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{k.label}</span>
                        <div className="flex items-center gap-2">
                          {compareRatio != null && Number.isFinite(k.compareValue) && (
                            <span className="text-[10px] text-violet-600">{k.format(k.compareValue)}</span>
                          )}
                          <span className="font-medium">
                            {Number.isFinite(k.activeValue) ? k.format(k.activeValue) : 'NaN'}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-white/80 overflow-hidden relative">
                        {compareRatio != null && (
                          <motion.div
                            className="absolute inset-y-[3px] left-0 rounded-full bg-violet-300/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${compareRatio * 100}%` }}
                            transition={{ duration: 0.45, ease: 'easeOut' }}
                          />
                        )}
                        <motion.div
                          className="relative h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${activeRatio * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 justify-center">
              {FORMAT_ROWS.map((f) => {
                const weight = clamp01(f.roas / 12)
                const isCompare = compareName === f.name
                const isActive = activeName === f.name
                return (
                  <motion.button
                    key={f.name}
                    onClick={() => setCompareName((prev) => (prev === f.name ? null : f.name))}
                    className={`px-4 py-2 rounded-full text-[11px] border backdrop-blur-sm flex items-center gap-2 ${
                      isCompare ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 bg-white/80 hover:bg-slate-50'
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    <div
                      className="h-2 w-10 rounded-full"
                      style={{
                        background: `linear-gradient(to right, rgba(14,165,233,${0.3 + weight * 0.4}), rgba(99,102,241,${0.2 + weight * 0.5}))`,
                      }}
                    />
                    <span className={`truncate ${isActive ? 'font-semibold' : 'font-normal'}`}>{f.name}</span>
                    {isCompare && <span className="text-[9px] text-violet-600">VS</span>}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Format drill table
const FormatDrillDownTable = () => {
  const [activeTab, setActiveTab] = useState('Cassata')
  const [expanded, setExpanded] = useState({})
  const [platform, setPlatform] = useState('Blinkit')
  const [region, setRegion] = useState(getFirstRegion('Blinkit'))
  const [city, setCity] = useState(getFirstCity('Blinkit', getFirstRegion('Blinkit')))

  const regions = useMemo(() => getRegionNames(platform), [platform])
  const cities = useMemo(() => getCityNames(platform, region), [platform, region])

  useMemo(() => {
    if (!regions.includes(region)) {
      const nextRegion = regions[0] || ''
      setRegion(nextRegion)
      setCity(getFirstCity(platform, nextRegion))
    } else if (!cities.includes(city)) {
      setCity(cities[0] || '')
    }
  }, [platform, regions, region, cities, city])

  const toggleRow = (name) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))

  const visibleRows = useMemo(() => {
    const match = drillRows.find((r) => r.name === activeTab)
    return match ? [match] : drillRows
  }, [activeTab])

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (acc, row) => ({
          spend: acc.spend + row.spend,
          m1Spend: acc.m1Spend + row.m1Spend,
          m2Spend: acc.m2Spend + row.m2Spend,
        }),
        { spend: 0, m1Spend: 0, m2Spend: 0 },
      ),
    [visibleRows],
  )

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-[0_12px_50px_rgba(15,23,42,0.08)] border border-slate-100 p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {drillTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm rounded-xl border transition-all ${
                activeTab === tab
                  ? 'border-slate-900 text-slate-900 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)]'
                  : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-3 py-2 rounded-full bg-white border border-slate-200 shadow-sm">Expanded path:</span>
          <select
            className="rounded-full border border-slate-200 px-3 py-2 text-slate-700 bg-white shadow-sm text-sm"
            value={platform}
            onChange={(e) => {
              const next = e.target.value
              const nextRegion = getFirstRegion(next)
              setPlatform(next)
              setRegion(nextRegion)
              setCity(getFirstCity(next, nextRegion))
            }}
          >
            {platformPulse.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-slate-200 px-3 py-2 text-slate-700 bg-white shadow-sm text-sm"
            value={region}
            onChange={(e) => {
              const nextRegion = e.target.value
              setRegion(nextRegion)
              setCity(getFirstCity(platform, nextRegion))
            }}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-slate-200 px-3 py-2 text-slate-700 bg-white shadow-sm text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">Platform: {platform}</span>
        <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">Region: {region || '-'}</span>
        <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">City: {city || '-'}</span>
        <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">Format tab: {activeTab}</span>
        <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">Tap a row to expand platforms.</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold text-slate-600 w-40">Format</th>
              <th className="px-3 py-2 font-semibold text-slate-600 text-center">Spend</th>
              <th className="px-3 py-2 font-semibold text-slate-600 text-center">M-1 Spend</th>
              <th className="px-3 py-2 font-semibold text-slate-600 text-center">M-2 Spend</th>
              <th className="px-3 py-2 font-semibold text-slate-600 text-center">Conversion</th>
              <th className="px-3 py-2 font-semibold text-slate-600 text-center">M-1 Conversion</th>
              <th className="px-3 py-2 font-semibold text-slate-600 text-center">M-2 Conversion</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <React.Fragment key={row.name}>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                    {row.children ? (
                      <button onClick={() => toggleRow(row.name)} className="mr-2 text-slate-600">
                        {expanded[row.name] ? '-' : '+'}
                      </button>
                    ) : (
                      <span className="mr-4" />
                    )}
                    {row.name}
                  </td>
                  {[row.spend, row.m1Spend, row.m2Spend].map((v, idx) => (
                    <td key={idx} className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded ${spendCellColor(v)}`}>{v.toFixed(1)}</span>
                    </td>
                  ))}
                  {[row.conversion, row.m1Conversion, row.m2Conversion].map((v, idx) => (
                    <td key={idx} className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded ${pctCellColor(v)}`}>{v.toFixed(1)}%</span>
                    </td>
                  ))}
                </tr>
                {row.children &&
                  expanded[row.name] &&
                  row.children.map((child) => (
                    <tr key={child.name} className="border-t border-slate-100 bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-700 pl-8">• {child.name}</td>
                      {[child.spend, child.m1Spend, child.m2Spend].map((v, idx) => (
                        <td key={idx} className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded ${spendCellColor(v)}`}>{v.toFixed(1)}</span>
                        </td>
                      ))}
                      {[child.conversion, child.m1Conversion, child.m2Conversion].map((v, idx) => (
                        <td key={idx} className="px-3 py-2 text-center">
                          <span className={`px-2 py-1 rounded ${pctCellColor(v)}`}>{v.toFixed(1)}%</span>
                        </td>
                      ))}
                    </tr>
                  ))}
              </React.Fragment>
            ))}
            <tr className="border-t border-slate-200 bg-slate-100 font-semibold text-slate-800">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-center">{totals.spend.toFixed(1)}</td>
              <td className="px-3 py-2 text-center">{totals.m1Spend.toFixed(1)}</td>
              <td className="px-3 py-2 text-center">{totals.m2Spend.toFixed(1)}</td>
              <td className="px-3 py-2 text-center">1%</td>
              <td className="px-3 py-2 text-center">1.1%</td>
              <td className="px-3 py-2 text-center">1.1%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------

export const PowerBiDashboard = () => {
  const [marketShareMode, setMarketShareMode] = useState('geographical')

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-amber-50 via-white to-sky-50 text-slate-900 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-500">Q-Comm Deep Dive</div>
            <h1 className="text-2xl font-semibold">PowerBI-style panels</h1>
            <p className="text-sm text-slate-500">Drilldown OLA control tower + format VS studio.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Market share</p>
              <p className="text-sm text-slate-600">
                {marketShareMode === 'geographical'
                  ? 'Geographical market share view highlights region and platform splits.'
                  : 'Listing coverage view tracks assortment depth and missing SKUs by platform.'}
              </p>
            </div>
            <div className="relative w-full sm:w-[420px]">
              <div className="relative flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                <motion.div
                  layout
                  className="absolute top-1 bottom-1 w-1/2 rounded-full bg-white shadow-sm"
                  initial={false}
                  animate={{ x: marketShareMode === 'geographical' ? 0 : '100%' }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                />
                {[
                  { key: 'geographical', label: 'Geographical market share' },
                  { key: 'coverage', label: 'Listing coverage' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMarketShareMode(option.key)}
                    className={`relative z-10 flex-1 rounded-full px-3 py-2 transition-colors ${
                      marketShareMode === option.key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    aria-pressed={marketShareMode === option.key}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {marketShareMode === 'geographical' ? 'Regional share and city cuts' : 'SKU depth and gaps by banner'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              {marketShareMode === 'geographical' ? 'Platform stacking ready for map view' : 'Compare brand availability vs competitors'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <OlaLightThemeDashboard />
          <FormatDrillDownTable />
          <BrandPositioningMap />
          <CohortHeatmapDemo />
          <QuarterlyDrilldownGrid />
          <DualAxisDrillMatrix />
          <PowerHierarchyHeat />
          <FormatPerformanceStudio />
        </div>
      </div>
    </div>
  )
}

// Dual-axis drill matrix exported for reuse
const DualAxisDrillMatrix = () => {
  // Reuse the MatrixPlatformFormat core but with different framing (for your existing usage)
  return <MatrixPlatformFormat />
}

export default PowerBiDashboard
export { DualAxisDrillMatrix }
