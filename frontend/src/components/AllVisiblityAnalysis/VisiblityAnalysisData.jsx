import React, { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import CustomPivotWorkbench from './CustomPivotWorkbench'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'

// ------------------------------
// NO TYPES — JSX ONLY
// ------------------------------

const statusChip = {
  'on-track': { label: 'On track', className: 'bg-emerald-100 text-emerald-700' },
  'at-risk': { label: 'At risk', className: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', className: 'bg-rose-100 text-rose-700' },
}

const KpiTile = ({ title, value, trend, deltaPeriod, target, status, filtersLabel }) => {
  const spark = trend.map((v, idx) => ({ idx, value: v }))
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between px-4 pt-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{value.toFixed(1)}%</span>
            <span className={`text-sm font-semibold ${deltaPeriod >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {deltaPeriod >= 0 ? '▲' : '▼'} {Math.abs(deltaPeriod).toFixed(1)}
            </span>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusChip[status].className}`}>{statusChip[status].label}</span>
      </div>
      <div className="px-4">
        <div className="text-xs text-slate-500">Filters: {filtersLabel}</div>
        <div className="mt-2 text-[11px] text-slate-500">
          Target <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{target.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-20 w-full px-2 pt-2">
        <ResponsiveContainer>
          <AreaChart data={spark} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <YAxis hide domain={['auto', 'auto']} />
            <XAxis dataKey="idx" hide />
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Visibility Share']} />
            <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill={`url(#spark-${title})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const YearTrendChart = ({ data }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
    <div className="mb-2 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-800">Visibility Share trend by Year</p>
        <p className="text-xs text-slate-500">Bars = actual, line = target</p>
      </div>
    </div>
    <div className="h-72">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v, name) => [`${v.toFixed(1)}%`, name]} />
          <Bar dataKey="actual">
            {data.map((d, idx) => (
              <Cell key={d.year} fill={idx > 0 && d.actual < data[idx - 1].actual ? '#f97316' : '#4f46e5'} />
            ))}
          </Bar>
          <Line dataKey="target" stroke="#94a3b8" strokeWidth={2} dot={false} />
          <Line dataKey="yoy" stroke="#f97316" strokeWidth={0} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
      {data.map((d, idx) => (
        <div key={d.year} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
          <span>{d.year}</span>
          <span className={idx > 0 && d.actual < data[idx - 1].actual ? 'text-rose-600' : 'text-emerald-600'}>
            {d.yoy >= 0 ? '▲' : '▼'} {Math.abs(d.yoy).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  </div>
)

const CountryBarChart = ({ data, avg, onCountrySelect }) => {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Visibility Share by Country</p>
        <span className="text-[11px] text-slate-500">Global avg {avg.toFixed(1)}%</span>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={sorted} layout="vertical" margin={{ left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={90} />
            <Tooltip formatter={(v, _n, entry) => [`${v.toFixed(1)}%`, `${entry.payload.name} visibility`]} />
            <Legend />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} onClick={(d) => onCountrySelect?.(d.code)}>
              {sorted.map((c) => (
                <Cell key={c.code} fill="#0ea5e9" className="cursor-pointer" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const ChannelStackedChart = ({ data, metric, onMetricChange }) => {
  const displayData =
    metric === 'visibility'
      ? data
      : data.map((d) => ({
          ...d,
          organic: metric === 'units' ? d.units * 0.65 : d.impressions * 0.6,
          sponsored: metric === 'units' ? d.units * 0.35 : d.impressions * 0.4,
        }))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Visibility Share by Channel</p>
          <p className="text-xs text-slate-500">Stacked split: Organic vs Sponsored</p>
        </div>
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          {['visibility', 'units', 'impressions'].map((m) => (
            <button
              key={m}
              onClick={() => onMetricChange(m)}
              className={`px-3 py-1 rounded-full ${metric === m ? 'bg-white shadow-sm text-slate-900' : 'hover:text-slate-800'}`}
            >
              {m === 'visibility' ? 'Visibility Share' : m === 'units' ? 'Units' : 'Impressions'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={displayData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, n, entry) => {
                const total = entry.payload.organic + entry.payload.sponsored
                return [`${v.toFixed(1)}%`, `${n === 'organic' ? 'Organic' : 'Sponsored'} (Total ${total.toFixed(1)}%)`]
              }}
            />
            <Legend />
            <Bar dataKey="organic" stackId="vs" fill="#22c55e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="sponsored" stackId="vs" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const heatColor = (value) => {
  const t = Math.min(Math.max(value / 25, 0), 1)
  const r = Math.round(255 - 120 * t)
  const g = Math.round(245 - 150 * t)
  const b = 255 - Math.round(120 * t)
  return `rgb(${r},${g},${b})`
}

const ProductHeatTable = ({ data }) => {
  const [sortKey, setSortKey] = useState('distributor')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => data.filter((d) => d.product.toLowerCase().includes(search.toLowerCase())), [data, search])
  const sorted = useMemo(() => [...filtered].sort((a, b) => b[sortKey] - a[sortKey]), [filtered, sortKey])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Visibility Share across Products</p>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product"
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs focus:border-slate-400 focus:outline-none"
          />
          <div className="text-[11px] text-slate-500">Sort by</div>
          {['distributor', 'store', 'web'].map((key) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                sortKey === key ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 text-right">Distributor</th>
              <th className="px-2 py-2 text-right">Store</th>
              <th className="px-2 py-2 text-right">Web</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={row.product} className={idx % 2 === 0 ? 'bg-slate-50/60' : ''}>
                <td className="px-2 py-2 font-semibold text-slate-800">{row.product}</td>

                {['distributor', 'store', 'web'].map((col) => {
                  const val = row[col]
                  const last = row.last[col]
                  const delta = val - last

                  return (
                    <td key={col} className="px-2 py-2 text-right">
                      <div
                        className="rounded-md px-2 py-1 text-right font-semibold"
                        style={{ background: heatColor(val), color: '#0f172a' }}
                        title={`Current: ${val.toFixed(1)}%\nLast: ${last.toFixed(1)}%\nΔ: ${delta.toFixed(
                          1
                        )} (${((delta / Math.max(last, 1)) * 100).toFixed(1)}%)`}
                      >
                        {val.toFixed(1)}%
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const severityGradient = {
  normal: 'from-sky-50 to-white',
  warning: 'from-amber-50 to-white',
  critical: 'from-rose-50 to-white',
}

const VisibilityPulseCard = ({
  city,
  region,
  value,
  delta,
  trend,
  rank,
  total,
  severity,
  onDrilldown,
  onInsights,
  onTrends,
}) => {
  const spark = trend.map((v, idx) => ({ idx, value: v }))

  return (
    <div
      className={`group flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-gradient-to-br ${severityGradient[severity]} p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{city}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{region}</span>
          </div>
          <p className="text-xs text-slate-500">
            Rank {rank} of {total}
          </p>
        </div>
        <span className={`text-sm font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{value.toFixed(1)}%</span>
      </div>

      <div className="h-16 w-full">
        <ResponsiveContainer>
          <AreaChart data={spark} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={`pulse-${city}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="idx" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Visibility']} />
            <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill={`url(#pulse-${city})`} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <button onClick={() => onDrilldown?.(city)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400">
          Drilldown
        </button>
        <button onClick={() => onInsights?.(city)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400">
          Key Insights
        </button>
        <button onClick={() => onTrends?.(city)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400">
          Trends
        </button>
      </div>
    </div>
  )
}

// ------------------------------
// DATA (unchanged)
// ------------------------------

const kpiData = {
  filters: 'Category Hair Care · Country India · FY 2025 Q1',
  tiles: [
    { title: 'Overall Visibility Share', value: 63.2, trend: [58.2, 59.8, 60.1, 61.0, 62.4, 63.2], delta: 1.4, target: 65, status: 'at-risk' },
    { title: 'Sponsored Visibility Share', value: 28.4, trend: [24.2, 25.4, 26.8, 27.1, 27.9, 28.4], delta: 0.9, target: 30, status: 'on-track' },
    { title: 'Organic Visibility Share', value: 34.8, trend: [32.0, 32.5, 32.9, 33.4, 34.0, 34.8], delta: 0.7, target: 35, status: 'on-track' },
  ],
}

const yearTrendData = [
  { year: 'FY 2020', actual: 51.2, target: 50, yoy: 1.2 },
  { year: 'FY 2021', actual: 54.6, target: 53, yoy: 3.4 },
  { year: 'FY 2022', actual: 57.1, target: 56, yoy: 2.5 },
  { year: 'FY 2023', actual: 60.3, target: 60, yoy: 3.2 },
  { year: 'FY 2024', actual: 62.0, target: 63, yoy: 1.7 },
  { year: 'FY 2025', actual: 63.2, target: 65, yoy: 1.2 },
]

const countryData = [
  { code: 'IN', name: 'India', value: 63.2, deltaLy: 1.2 },
  { code: 'GB', name: 'United Kingdom', value: 58.4, deltaLy: -0.6 },
  { code: 'DE', name: 'Germany', value: 55.8, deltaLy: 0.8 },
  { code: 'FR', name: 'France', value: 53.1, deltaLy: -1.1 },
  { code: 'US', name: 'United States', value: 50.2, deltaLy: 1.5 },
]

const channelData = [
  { channel: 'Distributor', organic: 20, sponsored: 18, units: 1800, impressions: 12000, lastOrganic: 19, lastSponsored: 17 },
  { channel: 'Store', organic: 22, sponsored: 14, units: 1650, impressions: 11000, lastOrganic: 21, lastSponsored: 14 },
  { channel: 'Web', organic: 18, sponsored: 12, units: 1400, impressions: 9000, lastOrganic: 17, lastSponsored: 11 },
]

const productData = [
  { product: 'Shampoo', distributor: 18.2, store: 21.4, web: 15.3, last: { distributor: 17.1, store: 20.2, web: 14.1 } },
  { product: 'Lotion', distributor: 16.4, store: 18.1, web: 13.7, last: { distributor: 15.6, store: 17.4, web: 13.2 } },
  { product: 'Hand Wash', distributor: 12.8, store: 14.5, web: 10.3, last: { distributor: 12.0, store: 13.9, web: 9.8 } },
  { product: 'Face Wash', distributor: 10.5, store: 12.7, web: 8.6, last: { distributor: 9.9, store: 12.1, web: 8.1 } },
  { product: 'Ice Cream', distributor: 11.7, store: 13.8, web: 9.2, last: { distributor: 10.9, store: 13.2, web: 8.9 } },
]

const pulseData = [
  { city: 'Pan India', region: 'National', value: 0.9, delta: -0.6, trend: [1.1, 1.0, 0.98, 0.96, 0.93, 0.9], rank: 5, total: 32, severity: 'warning' },
  { city: 'Delhi NCR', region: 'North', value: 1.0, delta: -0.3, trend: [1.1, 1.05, 1.03, 1.01, 1.0, 1.0], rank: 8, total: 32, severity: 'normal' },
  { city: 'Bangalore', region: 'South', value: 1.3, delta: -0.2, trend: [1.2, 1.22, 1.25, 1.28, 1.3, 1.3], rank: 3, total: 32, severity: 'normal' },
  { city: 'Kolkata', region: 'East', value: 0.4, delta: -0.7, trend: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4], rank: 21, total: 32, severity: 'critical' },
]

const categoryCards = [
  { name: 'All', overall: 0.9, ad: 0.5, display: 1.1, deltaOverall: -0.6, deltaAd: -2.3, deltaDisplay: -0.4, trend: [1.2, 1.1, 1.0, 0.98, 0.94, 0.9], status: 'down' },
  { name: 'Shower Gel', overall: 2.4, ad: 2.5, display: 1.9, deltaOverall: -1.3, deltaAd: -2.9, deltaDisplay: -1.0, trend: [2.8, 2.7, 2.6, 2.5, 2.45, 2.4], status: 'down' },
  { name: 'Hand Wash', overall: 2.7, ad: 2.5, display: 1.6, deltaOverall: -2.1, deltaAd: -13.2, deltaDisplay: -0.9, trend: [3.1, 3.0, 2.9, 2.8, 2.7, 2.7], status: 'down' },
  { name: 'Face Wash', overall: 0.3, ad: 0.0, display: 0.6, deltaOverall: 0.0, deltaAd: 0.0, deltaDisplay: -0.2, trend: [0.5, 0.45, 0.4, 0.35, 0.32, 0.3], status: 'down' },
]

const competitorSeries = [
  { name: 'Palmolive', color: '#ef4444', values: [{ date: '06 Sep', value: 1.2 }, { date: '10 Sep', value: 1.1 }, { date: '14 Sep', value: 1.3 }, { date: '18 Sep', value: 1.2 }, { date: '22 Sep', value: 1.25 }, { date: '26 Sep', value: 1.3 }, { date: '30 Sep', value: 1.4 }] },
  { name: 'Dettol', color: '#a855f7', values: [{ date: '06 Sep', value: 6.2 }, { date: '10 Sep', value: 6.1 }, { date: '14 Sep', value: 6.0 }, { date: '18 Sep', value: 6.4 }, { date: '22 Sep', value: 6.2 }, { date: '26 Sep', value: 6.1 }, { date: '30 Sep', value: 6.3 }] },
  { name: "L'Oreal Paris", color: '#22c55e', values: [{ date: '06 Sep', value: 9.1 }, { date: '10 Sep', value: 9.3 }, { date: '14 Sep', value: 9.4 }, { date: '18 Sep', value: 9.6 }, { date: '22 Sep', value: 9.5 }, { date: '26 Sep', value: 9.8 }, { date: '30 Sep', value: 9.7 }] },
  { name: 'Cetaphil', color: '#0ea5e9', values: [{ date: '06 Sep', value: 3.2 }, { date: '10 Sep', value: 3.1 }, { date: '14 Sep', value: 3.0 }, { date: '18 Sep', value: 3.2 }, { date: '22 Sep', value: 3.1 }, { date: '26 Sep', value: 3.3 }, { date: '30 Sep', value: 3.4 }] },
]

// ------------------------------
// MAIN COMPONENT — JSX ONLY
// ------------------------------

const VisiblityAnalysisData = () => {
  const [metric, setMetric] = useState('visibility')
  const [activeCategory, setActiveCategory] = useState(categoryCards[0])
  const [activeCity, setActiveCity] = useState(pulseData[0])
  const [modal, setModal] = useState(null)
  const [selectedCompetitors, setSelectedCompetitors] = useState(competitorSeries.map((c) => c.name))

  const sampleData = [
    { Country: 'France', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 320, InStock: 540, SoldAmount: 210 },
    { Country: 'France', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Web', UnitsSold: 410, InStock: 620, SoldAmount: 260 },
    { Country: 'France', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 280, InStock: 480, SoldAmount: 190 },
    { Country: 'France', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Distributor', UnitsSold: 360, InStock: 510, SoldAmount: 240 },
    { Country: 'Germany', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 390, InStock: 580, SoldAmount: 240 },
    { Country: 'Germany', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Distributor', UnitsSold: 430, InStock: 640, SoldAmount: 270 },
    { Country: 'Germany', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 300, InStock: 520, SoldAmount: 210 },
    { Country: 'Germany', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Web', UnitsSold: 360, InStock: 550, SoldAmount: 230 },
    { Country: 'United Kingdom', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 350, InStock: 600, SoldAmount: 230 },
    { Country: 'United Kingdom', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Distributor', UnitsSold: 400, InStock: 630, SoldAmount: 260 },
    { Country: 'United Kingdom', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 310, InStock: 540, SoldAmount: 220 },
    { Country: 'United Kingdom', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Web', UnitsSold: 360, InStock: 560, SoldAmount: 240 },
    { Country: 'United States', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 420, InStock: 650, SoldAmount: 280 },
    { Country: 'United States', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Distributor', UnitsSold: 460, InStock: 700, SoldAmount: 310 },
    { Country: 'United States', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 340, InStock: 580, SoldAmount: 240 },
    { Country: 'United States', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Web', UnitsSold: 390, InStock: 600, SoldAmount: 260 },
  ]

  const pivotRows = useMemo(
    () =>
      sampleData.map((d) => ({
        country: d.Country,
        product: d.Products,
        year: d.Year,
        orderSource: d.OrderSource,
        unitsSold: d.UnitsSold,
        inStock: d.InStock,
        soldAmount: d.SoldAmount,
      })),
    []
  )

  const pivotFields = useMemo(
    () => [
      { key: 'country', label: 'Country', type: 'dimension' },
      { key: 'product', label: 'Product', type: 'dimension' },
      { key: 'orderSource', label: 'Order Source', type: 'dimension' },
      { key: 'year', label: 'Year', type: 'dimension' },
      { key: 'unitsSold', label: 'Units Sold', type: 'measure' },
      { key: 'inStock', label: 'In Stock', type: 'measure' },
      { key: 'soldAmount', label: 'Sold Amount', type: 'measure' },
    ],
    []
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* HEADER */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-600">Visibility KPI Studio</p>
            <h1 className="text-2xl font-bold">Visibility Workspace</h1>
            <p className="text-sm text-slate-500">Premium analytics studio for Visibility Share</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Insights', 'Actionable', 'Live filters'].map((c) => (
              <span key={c} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="sticky top-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-400">
              <option>Category: All</option>
              <option>Hair Care</option>
              <option>Personal Care</option>
            </select>
            <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-400">
              <option>Country: India</option>
              <option>United Kingdom</option>
              <option>Germany</option>
            </select>
            <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-slate-400">
              <option>Channel: All</option>
              <option>Distributor</option>
              <option>Store</option>
              <option>Web</option>
            </select>

            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-600">
              {['Overall', 'Sponsored', 'Organic'].map((m) => (
                <button key={m} className="px-3 py-1 rounded-full bg-white shadow-sm text-slate-900">
                  {m}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <SearchIcon className="text-slate-400" fontSize="small" />
              <input className="w-48 bg-transparent focus:outline-none" placeholder="Search city" />
            </div>
          </div>
        </div>

        {/* KPI TILES */}
        <div className="grid gap-3 md:grid-cols-3">
          {kpiData.tiles.map((tile) => (
            <KpiTile key={tile.title} {...tile} filtersLabel={kpiData.filters} />
          ))}
        </div>

        {/* CATEGORY CARDS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">Category</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Overall / Ad / Display Visibility Share
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <SearchIcon className="text-slate-400" fontSize="small" />
              <input className="w-48 bg-transparent focus:outline-none" placeholder="Search category" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {categoryCards.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat)}
                className={`group flex h-full flex-col gap-2 rounded-2xl border ${
                  activeCategory.name === cat.name ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50/60'
                } p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">{cat.name}</div>
                  <span className={`text-xs font-semibold ${cat.status === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {cat.status === 'up' ? '▲' : '▼'} {Math.abs(cat.deltaOverall).toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div>
                    <div className="font-semibold text-slate-800">{cat.overall.toFixed(1)}%</div>
                    <div className="text-rose-600">{cat.deltaOverall.toFixed(1)}%</div>
                    <div className="text-slate-500">Overall</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{cat.ad.toFixed(1)}%</div>
                    <div className="text-rose-600">{cat.deltaAd.toFixed(1)}%</div>
                    <div className="text-slate-500">Sponsored</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{cat.display.toFixed(1)}%</div>
                    <div className="text-rose-600">{cat.deltaDisplay.toFixed(1)}%</div>
                    <div className="text-slate-500">Display</div>
                  </div>
                </div>

                {/* SMALL SPARKLINE */}
                <div className="h-12 w-full">
                  <ResponsiveContainer>
                    <AreaChart data={cat.trend.map((v, i) => ({ idx: i, value: v }))} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
                      <XAxis dataKey="idx" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Visibility']} />
                      <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} fill="rgba(14,165,233,0.15)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* CATEGORY ACTIONS */}
                {/* <div className="mt-auto flex flex-wrap gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'trends', context: cat.name }) }}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    My Trends
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'competition', context: cat.name }) }}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Competition Trends
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'insights', context: cat.name }) }}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Key Insights
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'cross', context: cat.name }) }}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Cross Platform
                  </button>
                </div> */}

                                <div className="mt-auto flex flex-wrap gap-1">
                  <button onClick={{}}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    My Trends
                  </button>

                  <button onClick={{}}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Competition Trends
                  </button>

                  <button onClick={{}}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Key Insights
                  </button>

                  <button onClick={{}}
                    className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    Cross Platform
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* TREND + COUNTRY */}
        <div className="grid gap-3 lg:grid-cols-2">
          <YearTrendChart data={yearTrendData} />
          <CountryBarChart data={countryData} avg={56.2} onCountrySelect={(code) => console.log('select country', code)} />
        </div>

        {/* CHANNEL STACK + PRODUCT TABLE */}
        <div className="grid gap-3 lg:grid-cols-[2fr_1.2fr]">
          <ChannelStackedChart data={channelData} metric={metric} onMetricChange={setMetric} />
          <ProductHeatTable data={productData} />
        </div>

        {/* PULSEBOARD */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <p className="text-sm font-semibold text-slate-800">Visibility Pulseboards</p>
            <p className="text-xs text-slate-500">City level momentum</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {pulseData.map((p) => (
              <VisibilityPulseCard
                key={p.city}
                {...p}
                onDrilldown={() => setActiveCity(p)}
                onInsights={() => setModal({ type: 'insights', context: p.city })}
                onTrends={() => setModal({ type: 'trends', context: p.city })}
              />
            ))}
          </div>
        </div>

        {/* PIVOT STUDIO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2">
            <p className="text-sm font-semibold text-slate-800">Pivot Studio</p>
            <p className="text-xs text-slate-500">Drag fields, build ratios, and switch view.</p>
          </div>
          <CustomPivotWorkbench data={pivotRows} fields={pivotFields} />
        </div>

        {/* MODAL SECTION */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 capitalize">{modal.type} for {modal.context}</p>
                  <p className="text-xs text-slate-500">Interactive view</p>
                </div>
                <button onClick={() => setModal(null)} className="rounded-full border border-slate-200 bg-slate-50 p-2">
                  <CloseIcon fontSize="small" />
                </button>
              </div>

              {/* COMPETITION MODAL */}
              {modal.type === 'competition' && (
                <div className="space-y-3">
                  {/* TAG SELECTOR */}
                  <div className="flex flex-wrap gap-2">
                    {competitorSeries.map((c) => {
                      const active = selectedCompetitors.includes(c.name)
                      return (
                        <button
                          key={c.name}
                          onClick={() => {
                            const set = new Set(selectedCompetitors)
                            if (set.has(c.name)) set.delete(c.name)
                            else set.add(c.name)
                            setSelectedCompetitors(Array.from(set))
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            active ? 'border-slate-900 bg-slate-100' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>

                  {/* COMPETITOR LINE CHART */}
                  <div className="h-80">
                    <ResponsiveContainer>
                      <LineChart
                        data={competitorSeries[0].values.map((_, idx) => {
                          const point = { date: competitorSeries[0].values[idx].date }
                          competitorSeries.forEach((c) => {
                            point[c.name] = c.values[idx]?.value ?? 0
                          })
                          return point
                        })}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, n) => [`${v.toFixed(1)}%`, n]} />
                        <Legend />
                        {competitorSeries
                          .filter((c) => selectedCompetitors.includes(c.name))
                          .map((c) => (
                            <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={false} />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* CATEGORY TREND MODAL */}
              {modal.type === 'trends' && (
                <div className="h-80">
                  <ResponsiveContainer>
                    <LineChart
                      data={activeCategory.trend.map((v, i) => ({ idx: i, Value: v }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="idx" />
                      <YAxis />
                      <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Visibility']} />
                      <Legend />
                      <Line type="monotone" dataKey="Value" stroke="#6366f1" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* INSIGHTS MODAL */}
              {modal.type === 'insights' && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Gainers</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {['Dettol', 'Loreal Paris', 'Palmolive', 'Cetaphil', 'Clinic Plus'].map((b) => (
                        <li key={b} className="flex items-center justify-between rounded-lg bg-white px-2 py-1">
                          <span>{b}</span>
                          <span className="font-semibold text-emerald-600">+0.8%</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Drainers</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {['Foxtale', 'Minimalist', 'Lacto Calamine', 'Simple', 'Dove'].map((b) => (
                        <li key={b} className="flex items-center justify_between rounded-lg bg-white px-2 py-1">
                          <span>{b}</span>
                          <span className="font-semibold text-rose-600">-0.6%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* CROSS PLATFORM MODAL */}
              {modal.type === 'cross' && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Date comparison</p>
                    <p className="text-xs text-slate-500">Custom vs Previous month</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Cross Platform</p>
                    <p className="text-xs text-slate-500">Distributor · Store · Web</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800">Customer selection</p>
                    <p className="text-xs text-slate-500">All customers · Custom segments</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default VisiblityAnalysisData
export { KpiTile, YearTrendChart, CountryBarChart, ChannelStackedChart, ProductHeatTable, VisibilityPulseCard }
