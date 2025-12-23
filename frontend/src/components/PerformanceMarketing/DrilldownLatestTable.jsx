import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal, X, Plus, Minus } from 'lucide-react'
import { Box, Button, Typography, Select, MenuItem } from '@mui/material'
import { KpiFilterPanel } from '../KpiFilterPanel'
import PaginationFooter from '../CommonLayout/PaginationFooter'

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
  day: 80,
}

const LEFT_DAY = FROZEN_WIDTHS.format

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
  const [page, setPage] = useState(1)

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

      // Direct drilldown: expand format -> individual day rows (skip tdp/weekend levels)
      if (!expandedRows.has(formatId)) return

      formatRows.forEach((r, idx) => {
        const dayId = `${formatId}-d-${idx}`

        rows.push({
          id: dayId,
          depth: 1,
          label: '',
          level: 'day',
          format,
          day: r.day,
          quarters: r.quarters || {},
          months: aggregateMonthKpis([r]),
          hasChildren: false,
        })
      })
    })

    return rows
  }, [filteredRows, expandedRows])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filters, pageSize, hierarchy])

  const totalPages = Math.max(1, Math.ceil(hierarchy.length / pageSize))
  const pageRows = hierarchy.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

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



  return (
    <div className="rounded-3xl flex-col bg-slate-50 relative">
      {/* ------------------ KPI FILTER MODAL ------------------ */}
      {filterPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-24 transition-all backdrop-blur-sm">
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
                kpiFields={Object.keys(KPI_LABELS).map(key => ({
                  id: key,
                  label: KPI_LABELS[key],
                  type: 'number'
                }))}
                onKeywordChange={() => { }}
                onBrandChange={() => { }}
                onCategoryChange={() => { }}
                onSkuChange={() => { }}
                onWeekendChange={(vals) => {
                  const sel = (vals || []);
                  let wf = 'All';
                  if (sel.length === 1) wf = sel[0] === 'Weekend' ? 'Weekend' : sel[0] === 'Weekday' ? 'Weekday' : 'All';
                  if (sel.length >= 2) wf = 'All';
                  setFilters((prev) => ({ ...prev, weekendFlag: wf }));
                }}
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

            {/* HEADLINE */}
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                  Format Performance (Heatmap)
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
                  Format → Day
                </Typography>
              </Box>
            </Box>

            {/* KPI TOGGLES AND FILTERS */}
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2 text-[11px]">
                {Object.keys(KPI_LABELS).map((k) => {
                  const isActive = visibleKpis[k];

                  return (
                    <button
                      key={k}
                      onClick={() => toggleKpiVisibility(k)}
                      className={`
                        flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-all
                        ${isActive
                          ? "bg-slate-200 text-slate-900 border-slate-300"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }
                      `}
                    >
                      {isActive ? (
                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900">
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

              {/* FILTER BUTTON MOVED HERE */}
              <button
                onClick={() => setFilterPanelOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-white hover:shadow transition-all"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
              </button>
            </div>



            {/* PATH LEGEND */}
            <div className="mb-4 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-1 rounded-full bg-slate-50 border">Path</span>
              Format → Day
            </div>

            {/* TABLE WRAPPER WITH FULL BORDER */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-30">
                    {/* TOP HEADER ROW */}
                    <tr className="bg-white">
                      <th
                        rowSpan={expandedQuarters.size ? 3 : 2}
                        className="px-3 py-2 text-left font-bold align-bottom border-b border-r border-slate-200 text-slate-800"
                        style={{
                          left: 0,
                          top: 0,
                          background: 'white',
                          width: FROZEN_WIDTHS.format,
                          zIndex: 40
                        }}
                      >
                        Format
                      </th>

                      {expandedRows.size > 0 && (
                        <th
                          rowSpan={expandedQuarters.size ? 3 : 2}
                          className="px-2 py-2 text-left font-bold align-bottom border-b border-r border-slate-200 text-slate-800"
                          style={{
                            left: LEFT_DAY,
                            top: 0,
                            background: 'white',
                            width: FROZEN_WIDTHS.day,
                            zIndex: 40
                          }}
                        >
                          Day
                        </th>
                      )}

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
                            className="px-3 py-3 text-center border-b border-r border-slate-200 last:border-r-0"
                          >
                            <button
                              onClick={() =>
                                setExpandedQuarters((prev) => {
                                  const next = new Set(prev)
                                  next.has(q) ? next.delete(q) : next.add(q)
                                  return next
                                })
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm active:scale-95`}
                            >
                              <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[8px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                              {q}
                            </button>
                          </th>
                        )
                      })}
                    </tr>

                    {/* MONTH HEADER ROW */}
                    <tr className="bg-white">
                      {quarters.flatMap((q, qi) => {
                        const isExpanded = expandedQuarters.has(q)

                        if (isExpanded) {
                          return quarterMonths[q].map((m, mi) => (
                            <th
                              key={`${q}-${m}`}
                              colSpan={visibleKpiKeys.length}
                              className={`px-2 py-1.5 text-center text-slate-600 font-semibold border-b border-r border-slate-200 ${mi % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                                }`}
                            >
                              {m}
                            </th>
                          ))
                        }

                        return visibleKpiKeys.map((k, ki) => (
                          <th key={`${q}-${k}`}
                            className={`px-2 py-1.5 text-center text-slate-600 font-semibold border-b border-r border-slate-200 ${qi % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}`}
                          >
                            {KPI_LABELS[k]}
                          </th>
                        ))
                      })}
                    </tr>

                    {/* KPI SUB-HEADER ROW */}
                    {expandedQuarters.size > 0 && (
                      <tr className="bg-white">
                        {quarters.flatMap((q) => {
                          const isExpanded = expandedQuarters.has(q)
                          if (!isExpanded) return null

                          return quarterMonths[q].flatMap((m) =>
                            visibleKpiKeys.map((k) => (
                              <th
                                key={`${q}-${m}-${k}`}
                                className="px-2 py-1 text-center text-[9px] text-slate-500 font-medium border-b border-r border-slate-200"
                              >
                                {KPI_LABELS[k]}
                              </th>
                            ))
                          )
                        })}
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/30 transition-colors">
                        {/* FORMAT CELL */}
                        <td
                          className="px-3 py-2 border-r border-slate-100"
                          style={{
                            position: 'sticky',
                            left: 0,
                            background: row.depth % 2 ? '#f8fafc' : '#fff',
                            width: FROZEN_WIDTHS.format,
                            zIndex: 10
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
                              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${row.hasChildren
                                ? 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                                : 'border-transparent text-transparent'
                                }`}
                              disabled={!row.hasChildren}
                            >
                              {row.hasChildren && (expandedRows.has(row.id) ? <Minus size={12} /> : <Plus size={12} />)}
                            </button>

                            <span className={`${row.hasChildren ? 'font-bold text-slate-800' : 'font-normal text-slate-500'} whitespace-nowrap`}>
                              {row.label}
                            </span>
                          </div>
                        </td>

                        {/* DAY CELL */}
                        {expandedRows.size > 0 && (
                          <td
                            className="px-2 py-2 text-center border-r border-slate-100"
                            style={{
                              position: 'sticky',
                              left: LEFT_DAY,
                              background: row.depth % 2 ? '#f8fafc' : '#fff',
                              zIndex: 10
                            }}
                          >
                            {(() => {
                              if (row.level === 'format') return ''
                              return row.day ?? 'All days'
                            })()}
                          </td>
                        )}

                        {/* DATA CELLS */}
                        {quarters.flatMap((q) => {
                          const isExpanded = expandedQuarters.has(q)
                          if (isExpanded) {
                            return quarterMonths[q].flatMap((m, mi) =>
                              visibleKpiKeys.map((k) => {
                                const v = row.months[m]?.[k] ?? NaN
                                const meta = kpiModes[k]
                                const heatClass = activeKpi === k ? activeMeta.heat(v) : 'bg-slate-50 text-slate-700'
                                const display = Number.isFinite(v) ? meta.formatter(v) : '—'
                                return (
                                  <td
                                    key={`${row.id}-${m}-${k}`}
                                    className={`px-1.5 py-1 text-center border-r border-slate-100 last:border-r-0 ${mi % 2 ? 'bg-white' : 'bg-slate-50/30'}`}
                                  >
                                    <span className={`block rounded-md px-2 py-1 text-center ${heatClass}`}>
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
                            const heatClass = activeKpi === k ? activeMeta.heat(v) : 'bg-slate-50 text-slate-700'
                            const display = Number.isFinite(v) ? meta.formatter(v) : '—'
                            return (
                              <td
                                key={`${row.id}-${q}-${k}`}
                                className="px-1.5 py-1 text-center bg-slate-50 border-r border-slate-100 last:border-r-0"
                              >
                                <span className={`block rounded-md px-2 py-1 text-center ${heatClass}`}>
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
                        <td colSpan={50} className="px-3 py-10 text-center text-slate-400">
                          No data available for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINATION */}
            <div className="mt-2 border-t border-slate-100">
              <PaginationFooter
                isVisible={true}
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setPage(1);
                }}
              />
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
                <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
                <button onClick={resetFilters} className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-100">Reset</button>
              </div>
              <div className="flex flex-col gap-4">
                <FilterSelect label="Weekend" value={filters.weekendFlag} options={weekendOptions} onChange={(v) => setFilters(p => ({ ...p, weekendFlag: v }))} />
                <FilterSelect label="TDP" value={filters.tdp} options={tdpOptions} onChange={(v) => setFilters(p => ({ ...p, tdp: v }))} />
                <FilterSelect label="Month" value={filters.month} options={monthOptions} onChange={(v) => setFilters(p => ({ ...p, month: v }))} />
                <FilterSelect label="Year" value={filters.year} options={yearOptions} onChange={(v) => setFilters(p => ({ ...p, year: v }))} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
