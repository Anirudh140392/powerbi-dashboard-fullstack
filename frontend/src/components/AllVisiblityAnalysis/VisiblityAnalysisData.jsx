import React, { useMemo, useState, useEffect } from 'react'
import CityKpiTrendShowcase from "@/components/CityKpiTrendShowcase.jsx";
import axiosInstance from "@/api/axiosInstance";
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
import {
  DRILL_COLUMNS,
  FORMAT_MATRIX,
  FORMAT_MATRIX_Visibility,
  FORMAT_ROWS,
  OLA_Detailed,
  ONE_VIEW_DRILL_DATA,
  PRODUCT_MATRIX
} from "../AllAvailablityAnalysis/availablityDataCenter";
import CloseIcon from '@mui/icons-material/Close'
import DrillHeatTable from '../CommonLayout/DrillHeatTable'
import MetricCardContainer from '../CommonLayout/MetricCardContainer'

import SimpleTableWithTabs from '../CommonLayout/SimpleTableWithTabs'
import VisibilityDrilldownTable from './VisibilityDrilldownTable';
import TopSearchTerms from './TopSearchTerms';
import { SignalLabVisibility } from './SignalLabVisibility';
import VisibilityLayoutOne from './VisibilityLayoutOne';
import {
  TabbedHeatmapTableSkeleton,
  VisibilityDrilldownSkeleton,
  TopSearchTermsSkeleton,
} from './VisibilitySkeletons';

// API imports for parallel fetching
import {
  fetchVisibilityOverview,
  fetchVisibilityPlatformKpiMatrix,
  fetchVisibilityKeywordsAtGlance,
  fetchVisibilityTopSearchTerms
} from '../../api/visibilityService';
// ------------------------------
// NO TYPES — JSX ONLY
// ------------------------------

const statusChip = {
  'on-track': { label: 'On track', className: 'bg-emerald-100 text-emerald-700' },
  'at-risk': { label: 'At risk', className: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', className: 'bg-rose-100 text-rose-700' },
}

// ---------------------------------------------------------------------------
// Error State Component - Shows when API fails with refresh button
// ---------------------------------------------------------------------------
const ErrorWithRefresh = ({ segmentName, errorMessage, onRetry, isRetrying = false }) => {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load {segmentName}</h3>
        <p className="text-sm text-slate-500 mb-4">{errorMessage || "An error occurred while fetching data"}</p>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
          ${isRetrying
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-600 text-white hover:bg-slate-700 shadow-md hover:shadow-lg'
          }`}
      >
        {isRetrying ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-500"></div>
            <span>Retrying...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </>
        )}
      </button>
    </div>
  );
};

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
              className={`text-xs font-semibold px-2 py-1 rounded-full border ${sortKey === key ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500'
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
const cards = [
  {
    title: "Mother Dairy",
    value: "96 on 30 Nov'25",
    sub: "Active SKUs in store",
    change: "▲4.3% (+4 SKUs)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "New launches this month: 7",
    extraChange: "▲12.5%",
    extraChangeColor: "green",
  },
  {
    title: "Amul",
    value: "52.4%",
    sub: "MTD on-shelf coverage",
    change: "▼8.6 pts (from 61.0%)",
    changeColor: "red",
    prevText: "vs Comparison Period",
    extra: "High risk stores: 18",
    extraChange: "▲5 stores",
    extraChangeColor: "red",
  },
  {
    title: "Godrej",
    value: "68.3",
    sub: "Network average days of cover",
    change: "▲19.5% (from 57.1)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Target band: 55–65 days",
    extraChange: "Slightly above target",
    extraChangeColor: "orange",
  },
  {
    title: "ITC",
    value: "76.9%",
    sub: "Weighted on-shelf availability (MTD)",
    change: "▲1.2 pts (from 75.7%)",
    changeColor: "green",
    prevText: "vs Comparison Period",
    extra: "Top 50 SKUs: 82.3%",
    extraChange: "▲0.9 pts",
    extraChangeColor: "green",
  },
];
// ---------------- TabbedHeatmapTable Component (Unnested) ----------------
const TabbedHeatmapTable = React.memo(({ matrixData, loading, filters }) => {
  const [activeTab, setActiveTab] = useState("platform");

  // If loading prop is true, show skeleton
  if (loading) {
    return <TabbedHeatmapTableSkeleton />;
  }


  // Use API data from matrixData prop - it already contains platformData, formatData, cityData
  // Fallback to static data if API data is not available
  const platformData = matrixData?.platformData || {
    columns: ["kpi", ...FORMAT_MATRIX_Visibility.PlatformColumns],
    rows: []
  };

  const formatData = matrixData?.formatData || {
    columns: ["kpi", ...FORMAT_MATRIX_Visibility.formatColumns],
    rows: []
  };

  const cityData = matrixData?.cityData || {
    columns: ["kpi", ...FORMAT_MATRIX_Visibility.CityColumns],
    rows: []
  };

  // Get column counts for tab display
  const platformCols = (platformData.columns || []).filter(c => c !== "kpi");
  const formatCols = (formatData.columns || []).filter(c => c !== "kpi");
  const cityCols = (cityData.columns || []).filter(c => c !== "kpi");

  const active = activeTab === "platform" ? platformData : activeTab === "format" ? formatData : cityData;

  return (
    <div className="rounded-3xl bg-white border shadow p-3 md:p-5 flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-max">
          {["platform", "format", "city"].map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 text-sm rounded-full transition-all ${activeTab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <span className="capitalize">{key}</span>
              {` (${key === 'platform' ? platformCols.length : key === 'format' ? formatCols.length : cityCols.length})`}
            </button>
          ))}
        </div>
      </div>
      <CityKpiTrendShowcase dynamicKey="visibility" data={active} title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} showPagination={true} filters={filters} />
    </div>
  );
});


const VisiblityAnalysisData = ({
  apiData = {},
  apiErrors = {},
  onRetry,
  filters = {},
  topSearchFilter = "All",
  setTopSearchFilter
}) => {
  const [metric, setMetric] = useState('visibility')
  const [activeCategory, setActiveCategory] = useState(categoryCards[0])
  const [activeCity, setActiveCity] = useState(pulseData[0])
  const [modal, setModal] = useState(null)
  const [selectedCompetitors, setSelectedCompetitors] = useState(competitorSeries.map((c) => c.name))

  // ==================== API DATA STATES ====================
  // Use data from parent props (apiData) when available
  // Visibility Overview (KPI cards)
  const overviewData = apiData.overview || null;
  const overviewLoading = !apiData.overview;

  // Platform KPI Matrix
  const matrixData = apiData.matrix || null;
  const matrixLoading = !apiData.matrix;

  // Keywords at a Glance
  const keywordsData = apiData.keywords || null;
  const keywordsLoading = !apiData.keywords;

  // Top Search Terms
  const topSearchData = apiData.searchTerms || null;
  const topSearchLoading = !apiData.searchTerms;

  // Log when filters or apiData change (for debugging)
  useEffect(() => {
    console.log('[VisiblityAnalysisData] Props received - filters:', filters, 'apiData keys:', Object.keys(apiData));
  }, [filters, apiData]);

  // Use API data if available, otherwise fallback to static data

  // const sampleData = [
  //   { Country: 'France', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 320, InStock: 540, SoldAmount: 210 },
  //   { Country: 'France', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Web', UnitsSold: 410, InStock: 620, SoldAmount: 260 },
  //   { Country: 'France', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 280, InStock: 480, SoldAmount: 190 },
  //   { Country: 'France', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Distributor', UnitsSold: 360, InStock: 510, SoldAmount: 240 },
  //   { Country: 'Germany', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 390, InStock: 580, SoldAmount: 240 },
  //   { Country: 'Germany', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Distributor', UnitsSold: 430, InStock: 640, SoldAmount: 270 },
  //   { Country: 'Germany', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 300, InStock: 520, SoldAmount: 210 },
  //   { Country: 'Germany', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Web', UnitsSold: 360, InStock: 550, SoldAmount: 230 },
  //   { Country: 'United Kingdom', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 350, InStock: 600, SoldAmount: 230 },
  //   { Country: 'United Kingdom', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Distributor', UnitsSold: 400, InStock: 630, SoldAmount: 260 },
  //   { Country: 'United Kingdom', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 310, InStock: 540, SoldAmount: 220 },
  //   { Country: 'United Kingdom', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Web', UnitsSold: 360, InStock: 560, SoldAmount: 240 },
  //   { Country: 'United States', Products: 'Shampoo', Year: 'FY 2022', OrderSource: 'Store', UnitsSold: 420, InStock: 650, SoldAmount: 280 },
  //   { Country: 'United States', Products: 'Shampoo', Year: 'FY 2023', OrderSource: 'Distributor', UnitsSold: 460, InStock: 700, SoldAmount: 310 },
  //   { Country: 'United States', Products: 'Lotion', Year: 'FY 2024', OrderSource: 'Store', UnitsSold: 340, InStock: 580, SoldAmount: 240 },
  //   { Country: 'United States', Products: 'Lotion', Year: 'FY 2025', OrderSource: 'Web', UnitsSold: 390, InStock: 600, SoldAmount: 260 },
  // ]
  // const sampleData = [
  //   {
  //     label: "Format A",
  //     values: [1200, 1100, 1300, "2.5%", "2.8%", "3.1%"],
  //     children: [
  //       {
  //         label: "Region North",
  //         values: [400, 350, 500, "2.8%", "3.1%", "3.4%"],
  //         children: [
  //           {
  //             label: "City Delhi",
  //             values: [200, 180, 260, "3.0%", "3.4%", "3.8%"],
  //             children: [],
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // ];
  const sampleData = [
    {
      label: "Grocery",
      values: {
        spend: 120000,
        m1: 105000,
        m2: 98000,
        conv: 0.082,
        m1c: 0.075,
        m2c: 0.071,
      },
      children: [
        {
          label: "North",
          values: {
            spend: 48000,
            m1: 43000,
            m2: 41000,
            conv: 0.091,
            m1c: 0.085,
            m2c: 0.079,
          },
          children: [
            {
              label: "Delhi",
              values: {
                spend: 22000,
                m1: 20000,
                m2: 19000,
                conv: 0.094,
                m1c: 0.088,
                m2c: 0.083,
              },
              children: []
            },
            {
              label: "Chandigarh",
              values: {
                spend: 18000,
                m1: 16000,
                m2: 15000,
                conv: 0.087,
                m1c: 0.081,
                m2c: 0.076,
              },
              children: []
            }
          ]
        }
      ]
    }
  ];



  const cards = [
    {
      title: "Overall SOS",
      value: "19.6%",
      sub: "Share of shelf across all active SKUs",
      change: "▲4.3 pts (from 15.3%)",
      changeColor: "green",
      prevText: "vs Previous Period",
      extra: "New launches contributing: 7 SKUs",
      extraChange: "▲12.5%",
      extraChangeColor: "green",
    },
    {
      title: "Sponsored SOS",
      value: "17.6%",
      sub: "Share of shelf for sponsored placements",
      change: "▼8.6 pts (from 26.2%)",
      changeColor: "red",
      prevText: "vs Previous Period",
      extra: "High risk keywords: 5",
      extraChange: "",
      extraChangeColor: "red",
    },
    {
      title: "Organic SOS",
      value: "20.7%",
      sub: "Natural shelf share without sponsorship",
      change: "▲19.5% (from 17.3%)",
      changeColor: "green",
      prevText: "vs Previous Period",
      extra: "Benchmark range: 18–22%",
      extraChange: "Slightly above benchmark",
      extraChangeColor: "orange",
    },
    {
      title: "Display SOS",
      value: "Coming Soon...",
      sub: "Share of shelf from display-led visibility",
      change: "",
      changeColor: "gray",
      prevText: "",
      extra: "",
      extraChange: "",
      extraChangeColor: "gray",
      isComingSoon: true,
    },
  ];
  const cellHeat = (value) => {
    if (value >= 95) return "bg-emerald-100 text-emerald-900";
    if (value >= 85) return "bg-emerald-50 text-emerald-800";
    if (value >= 75) return "bg-amber-50 text-amber-800";
    return "bg-rose-50 text-rose-800";
  };
  // const TabbedHeatmapTable = () => {
  //   const [activeTab, setActiveTab] = useState("platform");

  //   // 🔥 Utility to compute unified trend + series for ANY item
  //   const buildRows = (dataArray = [], columnList = []) => {
  //     return dataArray.map((item) => {
  //       const primaryTrendSeries = item?.trend?.["Spend"] || [];
  //       const valid = primaryTrendSeries.length >= 2;

  //       const lastVal = valid ? primaryTrendSeries[primaryTrendSeries.length - 1] : 0;
  //       const prevVal = valid ? primaryTrendSeries[primaryTrendSeries.length - 2] : 0;

  //       const globalDelta = Number((lastVal - prevVal).toFixed(1));

  //       const trendObj = {};
  //       const seriesObj = {};

  //       columnList.forEach((col) => {
  //         trendObj[col] = globalDelta;           // same delta for every column
  //         seriesObj[col] = primaryTrendSeries;   // same sparkline for every column
  //       });

  //       return {
  //         kpi: item.kpi,
  //         ...item.values,
  //         trend: trendObj,
  //         series: seriesObj,
  //       };
  //     });
  //   };

  //   // ---------------- PLATFORM ----------------
  //   const platformData = {
  //     columns: ["kpi", ...FORMAT_MATRIX.PlatformColumns],
  //     rows: buildRows(FORMAT_MATRIX.PlatformData, FORMAT_MATRIX.PlatformColumns),
  //   };

  //   // ---------------- FORMAT ----------------
  //   const formatData = {
  //     columns: ["kpi", ...FORMAT_MATRIX.formatColumns],
  //     rows: buildRows(FORMAT_MATRIX.FormatData, FORMAT_MATRIX.formatColumns),
  //   };

  //   // ---------------- CITY ----------------
  //   const cityData = {
  //     columns: ["kpi", ...FORMAT_MATRIX.CityColumns],
  //     rows: buildRows(FORMAT_MATRIX.CityData, FORMAT_MATRIX.CityColumns),
  //   };

  //   // ---------------- TABS ----------------
  //   const tabs = [
  //     { key: "platform", label: "Platform", data: platformData },
  //     { key: "format", label: "Format", data: formatData },
  //     { key: "city", label: "City", data: cityData },
  //   ];

  //   const active = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  //   return (
  //     <div className="rounded-3xl bg-white border shadow p-5 flex flex-col gap-4">

  //       {/* -------- TABS -------- */}
  //       <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-max">
  //         {tabs.map((t) => (
  //           <button
  //             key={t.key}
  //             onClick={() => setActiveTab(t.key)}
  //             className={`px-4 py-1.5 text-sm rounded-full transition-all 
  //               ${activeTab === t.key
  //                 ? "bg-white text-slate-900 shadow-sm"
  //                 : "text-slate-500 hover:text-slate-700"
  //               }`}
  //           >
  //             {t.label}
  //           </button>
  //         ))}
  //       </div>

  //       {/* -------- MATRIX TABLE -------- */}
  //       <CityKpiTrendShowcase 
  //         data={active.data} 
  //         title={active.label} 
  //       />
  //     </div>
  //   );
  // };

  // ---------------- FILTER OPTIONS ----------------
  // ---------------- FILTER OPTIONS ----------------
  const VISIBILITY_FILTER_OPTIONS = [
    { id: "date", label: "Date", options: [] }, // Date range picker would be custom
    { id: "month", label: "Month", options: [{ id: "all", label: "All" }] },
    { id: "platform", label: "Platform", options: [{ id: "all", label: "All" }] },
    { id: "productName", label: "Product Name", options: [{ id: "all", label: "All" }] },
    { id: "format", label: "Format", options: [{ id: "all", label: "All" }] }, // Mapped to keyword_search_product
    { id: "city", label: "City", options: [{ id: "all", label: "All" }] },
    { id: "pincode", label: "Pincode", options: [{ id: "all", label: "All" }] },
  ];


  return (

    <div className="mx-auto max-w-7xl space-y-4">

      {/* HEADER */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {/* <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-600">Visibility KPI Studio</p>
            <h1 className="text-2xl font-bold">Visibility Workspace</h1>
            <p className="text-sm text-slate-500">Premium analytics studio for Visibility Share</p>
          </div> */}
        {/* <div className="flex flex-wrap gap-2">
            {['Insights', 'Actionable', 'Live filters'].map((c) => (
              <span key={c} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {c}
              </span>
            ))}
          </div> */}
      </div>

      {/* MODAL SECTION */}
      {/* Visibility Overview - show error if failed, skeleton when loading */}
      {apiErrors.overview ? (
        <ErrorWithRefresh
          segmentName="Visibility Overview"
          errorMessage={apiErrors.overview}
          onRetry={() => onRetry?.('overview')}
        />
      ) : (
        <MetricCardContainer
          title="Visibility Overview"
          cards={overviewLoading ? [] : (overviewData?.cards || cards)}
          loading={overviewLoading}
        />
      )}

      {/* Platform KPI Matrix - show error if failed, skeleton during loading */}
      {apiErrors.matrix ? (
        <ErrorWithRefresh
          segmentName="Platform KPI Matrix"
          errorMessage={apiErrors.matrix}
          onRetry={() => onRetry?.('matrix')}
        />
      ) : matrixLoading ? (
        <TabbedHeatmapTableSkeleton />
      ) : (
        <TabbedHeatmapTable matrixData={matrixData} loading={matrixLoading} filters={filters} />
      )}

      {/* PULSEBOARD */}
      {/* <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <DrillHeatTable
            data={sampleData}
            title="Keyword level Sos"
            levels={["Format", "Region", "City"]}
            columns={[
              { key: "spend", label: "Spend", isPercent: false },
              { key: "m1", label: "M-1", isPercent: false },
              { key: "m2", label: "M-2", isPercent: false },
              { key: "conv", label: "Conv", isPercent: true },
              { key: "m1c", label: "M-1 Conv", isPercent: true },
              { key: "m2c", label: "M-2 Conv", isPercent: true },
            ]}
            computeQuarterValues={(values, q) => values} // your custom logic
            computeRowAvg={(vals) => "3.1%"}             // your custom logic
            getHeatStyle={(v) => ({ bg: "#d1fae5", color: "#065f46" })}
          />

        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <DrillHeatTable
            data={sampleData}
            title="Sos Across Category"
            levels={["Format", "Region", "City"]}
            columns={[
              { key: "spend", label: "Spend", isPercent: false },
              { key: "m1", label: "M-1", isPercent: false },
              { key: "m2", label: "M-2", isPercent: false },
              { key: "conv", label: "Conv", isPercent: true },
              { key: "m1c", label: "M-1 Conv", isPercent: true },
              { key: "m2c", label: "M-2 Conv", isPercent: true },
            ]}
            computeQuarterValues={(values, q) => values} // your custom logic
            computeRowAvg={(vals) => "3.1%"}             // your custom logic
            getHeatStyle={(v) => ({ bg: "#d1fae5", color: "#065f46" })}
          />

        // </div> */}

      {/* // <MetricCardContainer title="Visibility Overview" cards={cards} /> */}

      {/* Keywords at a Glance - show error if failed, skeleton during loading */}
      {apiErrors.keywords ? (
        <ErrorWithRefresh
          segmentName="Keywords at a Glance"
          errorMessage={apiErrors.keywords}
          onRetry={() => onRetry?.('keywords')}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {keywordsLoading ? (
            <VisibilityDrilldownSkeleton />
          ) : (
            <VisibilityDrilldownTable data={keywordsData?.hierarchy} loading={keywordsLoading} />
          )}
        </div>
      )}

      {/* Top Search Terms - show error if failed */}
      {apiErrors.searchTerms ? (
        <ErrorWithRefresh
          segmentName="Top Search Terms"
          errorMessage={apiErrors.searchTerms}
          onRetry={() => onRetry?.('searchTerms')}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-max">
              {["All", "Branded", "Competition", "Generic"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTopSearchFilter(tab)}
                  className={`px-4 py-1.5 text-sm rounded-full transition-all ${topSearchFilter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          {topSearchLoading && !topSearchData ? (
            <TopSearchTermsSkeleton />
          ) : (
            <TopSearchTerms
              filter={topSearchFilter}
              data={topSearchData?.terms}
              loading={topSearchLoading}
              filters={filters}
            />
          )}
        </div>
      )}
      {/* <SignalLabVisibility type="visibility" /> */}
      {/* <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <VisibilityLayoutOne />
        </div> */}
      {
        modal && (
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
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-slate-900 bg-slate-100' : 'border-slate-200 text-slate-600'
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
        )
      }

    </div >
  )
}

export default VisiblityAnalysisData
export { KpiTile, YearTrendChart, CountryBarChart, ChannelStackedChart, ProductHeatTable, VisibilityPulseCard }
