import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { KpiFilterPanel } from '../KpiFilterPanel'

const KPI_LABELS = {
  impressions: 'Impressions',
  conversion: 'Conversion',
  spend: 'Spend',
  cpm: 'CPM',
  roas: 'ROAS',
  sales: 'Sales',
  inorganic: 'Inorganic Sales',
}



const kpiModes = {
  impressions: {
    label: 'Impressions',
    description: 'Total impressions. Higher is better vs benchmark.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(0) : ''),
    heat: (v) =>
      v >= 200
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 50
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  conversion: {
    label: 'Conversion',
    description: 'Conversion rate or count.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ''),
    heat: (v) =>
      v >= 0.05
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 0.02
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  spend: {
    label: 'Spend',
    description: 'Ad spend for the period.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ''),
    heat: () => 'bg-slate-50 text-slate-700',
  },
  cpm: {
    label: 'CPM',
    description: 'Cost per 1000 impressions.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(0) : ''),
    heat: (v) =>
      v <= 300
        ? 'bg-emerald-50 text-emerald-700'
        : v <= 400
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  roas: {
    label: 'ROAS',
    description: 'Return on ad spend.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ''),
    heat: (v) =>
      v >= 4
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 2
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  sales: {
    label: 'Sales',
    description: 'Sales units or value.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ''),
    heat: (v) =>
      v >= 8
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 4
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  inorganic: {
    label: 'Inorganic',
    description: 'Inorganic / promoted sales.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ''),
    heat: () => 'bg-slate-50 text-slate-700',
  },
}

// ---------------- SAMPLE DATA ----------------
const sampleData = [
  {
    format: 'Cassata',
    days: [
      {
        day: null,
        weekendFlag: 'Weekend',
        tdp: 'TDP1',
        month: 'Jul',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.23, conversion: 0.01, spend: 0.29, cpm: 474.84, roas: 2.48, sales: 5.93, inorganic: 0.21 },
          Q4: { impressions: 1.0, conversion: 0.01, spend: 0, cpm: 440.33, roas: 1.67, sales: 4.33, inorganic: 0.17 },
        },
      },
    ],
  },
  {
    format: 'Core Tub',
    days: [
      {
        day: null,
        weekendFlag: 'Weekend',
        tdp: 'TDP1',
        month: 'Jul',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.29, conversion: 0.02, spend: 0.58, cpm: 420.1, roas: 3.23, sales: 6.69, inorganic: 0.28 },
          Q4: { impressions: 1.0, conversion: 0.04, spend: 0, cpm: 417.0, roas: 5.0, sales: 7.67, inorganic: 0.23 },
        },
      },
    ],
  },
  {
    format: 'KW Sticks',
    days: [
      {
        day: 1,
        weekendFlag: 'Weekday',
        tdp: 'TDP2',
        month: 'Jul',
        year: 2025,
        quarters: {
          Q3: { impressions: 0, conversion: 0.03, spend: 0, cpm: 393.16, roas: 7.74, sales: 1.34, inorganic: 0.07 },
          Q4: {},
        },
      },
      {
        day: 2,
        weekendFlag: 'Weekday',
        tdp: 'TDP2',
        month: 'Jul',
        year: 2025,
        quarters: {
          Q3: { impressions: 2, conversion: 0.01, spend: 0.5, cpm: 329.5, roas: 3, sales: 10, inorganic: 0.24 },
          Q4: { impressions: 2, conversion: 0.01, spend: 1, cpm: 341, roas: 4, sales: 10, inorganic: 0.29 },
        },
      },
    ],
  },
  {
    format: 'Magnum',
    days: [
      {
        day: 1,
        weekendFlag: 'Weekday',
        tdp: 'TDP3',
        month: 'Jul',
        year: 2025,
        quarters: {
          Q3: { impressions: 1, conversion: 0.01, spend: 0.5, cpm: 292, roas: 3.5, sales: 9.5, inorganic: 0.22 },
          Q4: { impressions: 2, conversion: 0.01, spend: 1, cpm: 340, roas: 3, sales: 9, inorganic: 0.28 },
        },
      },
    ],
  },
]

// ---------------- FILTER OPTIONS ----------------
const weekendOptions = ['All', 'Weekend', 'Weekday']
const tdpOptions = ['All', 'TDP1', 'TDP2', 'TDP3']
const monthOptions = ['All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const yearOptions = ['All', '2024', '2025']

const monthToQuarter = {
  Jan: 'Q1',
  Feb: 'Q1',
  Mar: 'Q1',
  Apr: 'Q2',
  May: 'Q2',
  Jun: 'Q2',
  Jul: 'Q3',
  Aug: 'Q3',
  Sep: 'Q3',
  Oct: 'Q4',
  Nov: 'Q4',
  Dec: 'Q4',
}

const quarterMonths = {
  Q1: ['Jan', 'Feb', 'Mar'],
  Q2: ['Apr', 'May', 'Jun'],
  Q3: ['Jul', 'Aug', 'Sep'],
  Q4: ['Oct', 'Nov', 'Dec'],
}

const FROZEN_WIDTHS = {
  format: 110,
  tdp: 37,
  weekend: 62,
  day: 40,
}

const LEFT_TDP = FROZEN_WIDTHS.format
const LEFT_WEEKEND = FROZEN_WIDTHS.format + FROZEN_WIDTHS.tdp
const LEFT_DAY = FROZEN_WIDTHS.format + FROZEN_WIDTHS.tdp + FROZEN_WIDTHS.weekend

// ---------------- FILTER COMPONENT ----------------
const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[11px] text-slate-500">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
)

// ------------------- AGGREGATORS -------------------
function aggregateQuarterKpis(rows) {
  const totals = {}
  const counts = {}

  rows.forEach((row) => {
    Object.entries(row.quarters).forEach(([q, kpis]) => {
      if (!totals[q]) totals[q] = {}
      if (!counts[q]) counts[q] = {}

      Object.entries(kpis).forEach(([key, val]) => {
        if (!Number.isFinite(val)) return
        totals[q][key] = (totals[q][key] || 0) + val
        counts[q][key] = (counts[q][key] || 0) + 1
      })
    })
  })

  const result = {}
  Object.entries(totals).forEach(([q, kpis]) => {
    result[q] = {}
    Object.entries(kpis).forEach(([key, total]) => {
      result[q][key] = total / (counts[q][key] || 1)
    })
  })
  return result
}

function aggregateMonthKpis(rows) {
  const totals = {}
  const counts = {}

  rows.forEach((row) => {
    const q = monthToQuarter[row.month]
    const kpis = row.quarters[q]
    if (!kpis) return

    if (!totals[row.month]) totals[row.month] = {}
    if (!counts[row.month]) counts[row.month] = {}

    Object.entries(kpis).forEach(([key, val]) => {
      if (!Number.isFinite(val)) return
      totals[row.month][key] = (totals[row.month][key] || 0) + val
      counts[row.month][key] = (counts[row.month][key] || 0) + 1
    })
  })

  const result = {}
  Object.entries(totals).forEach(([m, kpis]) => {
    result[m] = {}
    Object.entries(kpis).forEach(([key, total]) => {
      result[m][key] = total / (counts[m][key] || 1)
    })
  })
  return result
}

// -------------------------------------------------------------
// ---------------------- MAIN COMPONENT ------------------------
// -------------------------------------------------------------
export default function DrilldownLatestTable() {
  const [activeKpi, setActiveKpi] = useState('roas')
  const [visibleKpis, setVisibleKpis] = useState({
    impressions: true,
    conversion: true,
    spend: true,
    cpm: true,
    roas: true,
    sales: true,
    inorganic: true,
  })
  const [expandedRows, setExpandedRows] = useState(new Set())
  const visibleKpiKeys = useMemo(
    () => Object.keys(KPI_LABELS).filter((k) => visibleKpis[k]),
    [visibleKpis]
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(0)

  const [filters, setFilters] = useState({
    weekendFlag: 'All',
    tdp: 'All',
    month: 'All',
    year: 'All',
    format: 'All',
    day: '',
  })

  const [sortField, setSortField] = useState('format')
  const [sortDir, setSortDir] = useState('asc')
  const quarters = useMemo(() => ['Q3', 'Q4'], [])
  const [expandedQuarters, setExpandedQuarters] = useState(new Set(['Q3', 'Q4']))
  const showHierarchyColumn = true

  // --------------- FLATTEN RAW DATA ---------------
  const allRows = useMemo(() => {
    const rows = []
    sampleData.forEach((f) => {
      f.days.forEach((d) => {
        rows.push({
          format: f.format,
          day: d.day,
          weekendFlag: d.weekendFlag,
          tdp: d.tdp,
          month: d.month,
          year: d.year,
          quarters: d.quarters,
        })
      })
    })
    return rows
  }, [])

  // -------------------- FILTERING --------------------
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filters.weekendFlag !== 'All' && row.weekendFlag !== filters.weekendFlag) return false
      if (filters.tdp !== 'All' && row.tdp !== filters.tdp) return false
      if (filters.month !== 'All' && row.month !== filters.month) return false
      if (filters.year !== 'All' && String(row.year) !== filters.year) return false
      if (filters.format !== 'All' && row.format !== filters.format) return false
      if (filters.day && String(row.day ?? '') !== filters.day) return false
      return true
    })
  }, [allRows, filters])

  // ------------------ HIERARCHY BUILD ------------------
  const hierarchy = useMemo(() => {
    const rows = []
    const byFormat = new Map()

    filteredRows.forEach((r) => {
      if (!byFormat.has(r.format)) byFormat.set(r.format, [])
      byFormat.get(r.format).push(r)
    })

    Array.from(byFormat.entries()).forEach(([format, formatRows]) => {
      const formatId = `fmt-${format}`

      rows.push({
        id: formatId,
        depth: 0,
        label: format,
        level: 'format',
        format,
        quarters: aggregateQuarterKpis(formatRows),
        months: aggregateMonthKpis(formatRows),
        hasChildren: true,
      })

      if (!expandedRows.has(formatId)) return

      const byTdp = new Map()
      formatRows.forEach((r) => {
        if (!byTdp.has(r.tdp)) byTdp.set(r.tdp, [])
        byTdp.get(r.tdp).push(r)
      })

      Array.from(byTdp.entries()).forEach(([tdp, tdpRows]) => {
        const tdpId = `${formatId}-tdp-${tdp}`

        rows.push({
          id: tdpId,
          depth: 1,
          label: tdp,
          level: 'tdp',
          format,
          tdp,
          quarters: aggregateQuarterKpis(tdpRows),
          months: aggregateMonthKpis(tdpRows),
          hasChildren: true,
        })

        if (!expandedRows.has(tdpId)) return

        const byWeekend = new Map()
        tdpRows.forEach((r) => {
          if (!byWeekend.has(r.weekendFlag)) byWeekend.set(r.weekendFlag, [])
          byWeekend.get(r.weekendFlag).push(r)
        })

        Array.from(byWeekend.entries()).forEach(([weekend, weekendRows]) => {
          const weekendId = `${tdpId}-w-${weekend}`

          rows.push({
            id: weekendId,
            depth: 2,
            label: weekend,
            level: 'weekend',
            format,
            tdp,
            weekendFlag: weekend,
            quarters: aggregateQuarterKpis(weekendRows),
            months: aggregateMonthKpis(weekendRows),
            hasChildren: true,
          })

          /* 🔥 FIX APPLIED HERE */
          if (expandedRows.has(weekendId)) {
            const dayId = `${weekendId}-d-all`

            rows.push({
              id: dayId,
              depth: 3,
              label: 'All days',
              level: 'day',
              format,
              tdp,
              weekendFlag: weekend,
              day: null,
              quarters: aggregateQuarterKpis(weekendRows),
              months: aggregateMonthKpis(weekendRows),
              hasChildren: false,
            })
          }
        })
      })
    })

    return rows
  }, [filteredRows, expandedRows])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [filters, pageSize, hierarchy])

  const totalPages = Math.max(1, Math.ceil(hierarchy.length / pageSize))
  const pageRows = hierarchy.slice(page * pageSize, page * pageSize + pageSize)

  const toggleSort = (field) => {
    if (sortField !== field) {
      setSortField(field)
      setSortDir('asc')
    } else {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    }
  }

  const toggleKpiVisibility = (k) =>
    setVisibleKpis((prev) => ({ ...prev, [k]: !prev[k] }))

  const resetFilters = () =>
    setFilters({
      weekendFlag: 'All',
      tdp: 'All',
      month: 'All',
      year: 'All',
      format: 'All',
      day: '',
    })

  const activeMeta = kpiModes[activeKpi]

  const renderExpander = (open) => (
    <span className="relative flex h-4 w-4 items-center justify-center">
      <span className="absolute h-[2px] w-3 rounded-full bg-slate-700" />
      {!open && <span className="absolute h-3 w-[2px] rounded-full bg-slate-700" />}
    </span>
  )

  return (
    <div className="rounded-3xl flex-col bg-slate-50 relative">
      {/* ------------------ KPI FILTER MODAL ------------------ */}
      {filterPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-24 transition-all backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                <p className="text-sm text-slate-500">Configure data visibility and rules</p>
              </div>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-6 pb-6">
              <KpiFilterPanel
                keywords={[]}
                brands={[]}
                categories={[]}
                skus={[]}
                cities={[]}
                platforms={[]}
                kpiFields={[]}
                onKeywordChange={() => { }}
                onBrandChange={() => { }}
                onCategoryChange={() => { }}
                onSkuChange={() => { }}
                onCityChange={() => { }}
                onPlatformChange={() => { }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-0 pr-0">
          <div className="rounded-3xl border bg-white p-4 shadow">

            {/* HEADLINE + FILTERS */}
            <div className="mb-4 flex items-center justify-between font-bold text-slate-900">
              <div className="text-lg">Format Performance (Heatmap)</div>
              <button
                onClick={() => setFilterPanelOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-white hover:shadow transition-all"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
              </button>
            </div>

            {/* KPI TOGGLE BUTTONS */}
            <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              {Object.keys(KPI_LABELS).map((k) => {
                const isActive = visibleKpis[k];
                const colorKeyMap = {
                  impressions: "blue",
                  conversion: "emerald",
                  spend: "purple",
                  cpm: "orange",
                  roas: "cyan",
                  sales: "indigo",
                  inorganic: "rose",
                };
                const colorTheme = colorKeyMap[k] || "slate";

                const styles = {
                  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "text-blue-600" },
                  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "text-emerald-600" },
                  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "text-purple-600" },
                  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "text-orange-600" },
                  cyan: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", icon: "text-cyan-600" },
                  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: "text-indigo-600" },
                  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", icon: "text-rose-600" },
                  slate: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: "text-slate-600" },
                };
                const style = styles[colorTheme];

                return (
                  <button
                    key={k}
                    onClick={() => toggleKpiVisibility(k)}
                    className={`
                      flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-all
                      ${isActive
                        ? `${style.bg} ${style.text} ${style.border}`
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }
                    `}
                  >
                    {isActive ? (
                      <div className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${style.icon} bg-current`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-2 w-2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-slate-300"></div>
                    )}
                    <span>{KPI_LABELS[k]}</span>
                  </button>
                );
              })}
            </div>

            {/* PATH LEGEND */}
            <div className="mb-4 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-1 rounded-full bg-slate-50 border">Path</span>
              Format → TDP → Weekend → Day
            </div>

            {/* TABLE WRAPPER */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px]">
                <thead>
                  {/* TOP HEADER ROW */}
                  <tr className="bg-slate-50">
                    <th
                      rowSpan={expandedQuarters.size ? 3 : 2}
                      className="px-3 py-2 text-left font-semibold"
                      style={{
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        background: '#f8fafc',
                        width: FROZEN_WIDTHS.format,
                      }}
                    >
                      Format
                    </th>

                    <th
                      rowSpan={expandedQuarters.size ? 3 : 2}
                      className="px-2 py-2 text-left font-semibold"
                      style={{
                        position: 'sticky',
                        left: LEFT_TDP,
                        top: 0,
                        background: '#f8fafc',
                        width: FROZEN_WIDTHS.tdp,
                      }}
                    >
                      TDP
                    </th>

                    <th
                      rowSpan={expandedQuarters.size ? 3 : 2}
                      className="px-2 py-2 text-left font-semibold"
                      style={{
                        position: 'sticky',
                        left: LEFT_WEEKEND,
                        top: 0,
                        background: '#f8fafc',
                        width: FROZEN_WIDTHS.weekend,
                      }}
                    >
                      Weekend
                    </th>

                    <th
                      rowSpan={expandedQuarters.size ? 3 : 2}
                      className="px-2 py-2 text-left font-semibold"
                      style={{
                        position: 'sticky',
                        left: LEFT_DAY,
                        top: 0,
                        background: '#f8fafc',
                        width: FROZEN_WIDTHS.day,
                      }}
                    >
                      Day
                    </th>

                    {quarters.map((q) => {
                      const colCount = visibleKpiKeys.length
                      const isExpanded = expandedQuarters.has(q)
                      const span = isExpanded
                        ? quarterMonths[q].length * colCount
                        : colCount

                      return (
                        <th
                          key={q}
                          colSpan={span}
                          className="px-3 py-2 text-center font-semibold"
                        >
                          <button
                            onClick={() =>
                              setExpandedQuarters((prev) => {
                                const next = new Set(prev)
                                next.has(q) ? next.delete(q) : next.add(q)
                                return next
                              })
                            }
                            className="rounded-full border px-2 py-1"
                          >
                            {isExpanded ? 'v' : '>'} {q}
                          </button>
                        </th>
                      )
                    })}
                  </tr>

                  {/* MONTH HEADER ROW */}
                  <tr className="border-b bg-slate-50">
                    {quarters.flatMap((q) => {
                      const isExpanded = expandedQuarters.has(q)

                      if (isExpanded) {
                        return quarterMonths[q].map((m, mi) => (
                          <th
                            key={`${q}-${m}`}
                            colSpan={visibleKpiKeys.length}
                            className={`px-2 py-1 text-center ${mi % 2 ? 'bg-white' : 'bg-slate-50'
                              }`}
                          >
                            {m}
                          </th>
                        ))
                      }

                      return visibleKpiKeys.map((k) => (
                        <th key={`${q}-${k}`} className="px-2 py-1 text-center">
                          {KPI_LABELS[k]}
                        </th>
                      ))
                    })}
                  </tr>

                  {/* KPI HEADER ROW (only when expanded) */}
                  {expandedQuarters.size > 0 && (
                    <tr className="border-b bg-slate-50">
                      {quarters.flatMap((q) =>
                        expandedQuarters.has(q)
                          ? quarterMonths[q].flatMap((m) =>
                            visibleKpiKeys.map((k) => (
                              <th
                                key={`${q}-${m}-${k}`}
                                className="px-2 py-1 text-center"
                              >
                                {KPI_LABELS[k]}
                              </th>
                            ))
                          )
                          : visibleKpiKeys.map((k) => (
                            <th
                              key={`${q}-hidden-${k}`}
                              className="opacity-0"
                            />
                          ))
                      )}
                    </tr>
                  )}
                </thead>

                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.id} className="border-b">
                      {/* FORMAT CELL */}
                      <td
                        className="px-3 py-2"
                        style={{
                          position: 'sticky',
                          left: 0,
                          background: row.depth % 2 ? '#f8fafc' : '#fff',
                          borderRight: '1px solid #e5e7eb',
                          width: FROZEN_WIDTHS.format,
                        }}
                      >
                        <div className="flex items-center gap-2" style={{ paddingLeft: row.depth * 18 }}>
                          <button
                            onClick={() =>
                              setExpandedRows((prev) => {
                                const next = new Set(prev)
                                next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                                return next
                              })
                            }
                            className={`flex h-8 w-8 items-center justify-center rounded-2xl border ${row.hasChildren
                              ? 'border-slate-200 bg-white text-slate-600'
                              : 'border-transparent text-transparent'
                              }`}
                            disabled={!row.hasChildren}
                          >
                            {row.hasChildren && renderExpander(expandedRows.has(row.id))}
                          </button>

                          <span className="font-semibold">{row.label}</span>
                        </div>
                      </td>

                      {/* TDP */}
                      <td
                        className="px-2 py-2"
                        style={{
                          position: 'sticky',
                          left: LEFT_TDP,
                          background: row.depth % 2 ? '#f8fafc' : '#fff',
                          borderRight: '1px solid #e5e7eb',
                        }}
                      >
                        {row.tdp || ''}
                      </td>

                      {/* WEEKEND */}
                      <td
                        className="px-2 py-2"
                        style={{
                          position: 'sticky',
                          left: LEFT_WEEKEND,
                          background: row.depth % 2 ? '#f8fafc' : '#fff',
                          borderRight: '1px solid #e5e7eb',
                        }}
                      >
                        {row.weekendFlag || ''}
                      </td>

                      {/* DAY */}
                      <td
                        className="px-2 py-2"
                        style={{
                          position: 'sticky',
                          left: LEFT_DAY,
                          background: row.depth % 2 ? '#f8fafc' : '#fff',
                          borderRight: '1px solid #e5e7eb',
                        }}
                      >
                        {row.day ?? ''}
                      </td>

                      {/* QUARTER → MONTH → KPI VALUES */}
                      {quarters.flatMap((q) => {
                        const isExpanded = expandedQuarters.has(q)

                        if (isExpanded) {
                          return quarterMonths[q].flatMap((m, mi) =>
                            visibleKpiKeys.map((k) => {
                              const v = row.months[m]?.[k] ?? NaN
                              const meta = kpiModes[k]
                              const heatClass =
                                activeKpi === k
                                  ? activeMeta.heat(v)
                                  : 'bg-slate-50 text-slate-700'
                              const display = Number.isFinite(v)
                                ? meta.formatter(v)
                                : '—'
                              return (
                                <td
                                  key={`${row.id}-${m}-${k}`}
                                  className={`px-1.5 py-1 text-center ${mi % 2 ? 'bg-white' : 'bg-slate-50'
                                    }`}
                                >
                                  <span className={`block rounded-md px-2 py-1 ${heatClass}`}>
                                    {display}
                                  </span>
                                </td>
                              )
                            })
                          )
                        }

                        return visibleKpiKeys.map((k) => {
                          const v = row.quarters[q]?.[k] ?? NaN
                          const meta = kpiModes[k]
                          const heatClass =
                            activeKpi === k
                              ? activeMeta.heat(v)
                              : 'bg-slate-50 text-slate-700'

                          const display = Number.isFinite(v)
                            ? meta.formatter(v)
                            : '—'

                          return (
                            <td
                              key={`${row.id}-${q}-${k}`}
                              className="px-1.5 py-1 text-center bg-slate-50"
                            >
                              <span className={`block rounded-md px-2 py-1 ${heatClass}`}>
                                {display}
                              </span>
                            </td>
                          )
                        })
                      })}
                    </tr>
                  ))}

                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={50}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        No rows match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-full border px-3 py-1 disabled:opacity-40"
                >
                  Prev
                </button>

                <span>
                  Page <b>{page + 1}</b> / {totalPages}
                </span>

                <button
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  Rows/page
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="ml-1 rounded-full border px-2 py-1"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <button
                  onClick={() => setFiltersOpen((x) => !x)}
                  className="rounded-full bg-slate-900 px-4 py-1.5 text-white"
                >
                  Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER SIDEBAR */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              className="flex h-full w-80 flex-col border-l bg-white p-4 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Filters</h3>

                <button
                  onClick={resetFilters}
                  className="rounded-full border bg-slate-50 px-3 py-1 text-[11px]"
                >
                  Reset
                </button>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <FilterSelect
                  label="Weekend flag"
                  value={filters.weekendFlag}
                  options={weekendOptions}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, weekendFlag: v }))
                  }
                />

                <FilterSelect
                  label="TDP"
                  value={filters.tdp}
                  options={tdpOptions}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, tdp: v }))
                  }
                />

                <FilterSelect
                  label="Month"
                  value={filters.month}
                  options={monthOptions}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, month: v }))
                  }
                />

                <FilterSelect
                  label="Year"
                  value={filters.year}
                  options={yearOptions}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, year: v }))
                  }
                />

                <FilterSelect
                  label="Format"
                  value={filters.format}
                  options={['All', ...sampleData.map((f) => f.format)]}
                  onChange={(v) =>
                    setFilters((prev) => ({ ...prev, format: v }))
                  }
                />

                <div className="flex flex-col gap-1">
                  <label className="text-[11px]">Day</label>
                  <input
                    type="number"
                    value={filters.day}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, day: e.target.value }))
                    }
                    className="rounded-lg border px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
