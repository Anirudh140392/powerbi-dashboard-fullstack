import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, ArrowUpRight, ArrowDownRight, LineChart as LineChartIcon } from 'lucide-react'
import TrendsCompetitionDrawer from './TrendsCompetitionDrawer'

function cn(...classes) { return classes.filter(Boolean).join(' ') }

// ========================================
// CONFIG - Replace with DB/API data
// ========================================
const reportTypes = [
    { key: 'platform', label: 'Platform', entities: ['BLINKIT', 'BLINKIT (SUB)', 'BLINKIT (2)', 'BLINKIT (AMZ)', 'BLINKIT (SWG)'] },
    { key: 'format', label: 'Format', entities: ['CASSATA', 'CORE TUB', 'CORNETTO', 'MAGNUM', 'PREMIUM TUB'] },
    { key: 'city', label: 'City', entities: ['AJMER', 'AMRITSAR', 'BATHINDA', 'BHOPAL', 'CHANDIGARH'] },
]

const drillDownOptions = [
    { key: 'region', label: 'Region', items: ['North Zone', 'South Zone', 'East Zone', 'West Zone'] },
    { key: 'competitors', label: 'Competitors', items: ['Amul', 'Mother Dairy', 'Havmor', 'Vadilal'] },
    { key: 'period', label: 'Period', items: ['Yesterday', 'Last Week', 'MTD', 'L3M'] },
]

const kpis = [
    { key: 'osa', label: 'OSA' },
    { key: 'doi', label: 'DOI' },
    { key: 'fillRate', label: 'FILLRATE' },
    { key: 'assortment', label: 'ASSORTMENT' },
    { key: 'psl', label: 'PSL' },
]

// ========================================
// SHARED COMPONENTS
// ========================================

// Toggle Tabs for Report Type
const ToggleTabs = ({ tabs, activeTab, onChange }) => (
    <div className="inline-flex bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => (
            <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                    activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
            >
                {tab.label}
            </button>
        ))}
    </div>
)

// Drill-down Dimension Dropdown
const DrillDownDropdown = ({ options, value, onChange }) => {
    const [open, setOpen] = useState(false)
    const current = options.find(o => o.key === value)

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
                Drill-down: {current?.label || 'Select'}
                <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]"
                    >
                        {options.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => { onChange(opt.key); setOpen(false); }}
                                className={cn(
                                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
                                    value === opt.key ? 'text-blue-600 font-medium' : 'text-slate-700'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ========================================
// MAIN TABLE COMPONENT
// ========================================
export default function KPIMatrixTable({ data }) {
    const [reportType, setReportType] = useState('platform')
    const [drillDimension, setDrillDimension] = useState('region')
    const [expandedRows, setExpandedRows] = useState([])

    // Drawer State
    const [openTrend, setOpenTrend] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState(null);
    const [compMetaForDrawer, setCompMetaForDrawer] = useState(null);

    const entities = reportTypes.find(r => r.key === reportType)?.entities || []

    // Filter drill-down options: Hide "Region" when "City" tab is active
    const availableDrillOptions = drillDownOptions.filter(opt => {
        if (reportType === 'city' && opt.key === 'region') return false
        return true
    })

    const drillItems = availableDrillOptions.find(d => d.key === drillDimension)?.items || []

    const handleReportTypeChange = (newType) => {
        setReportType(newType)
        setExpandedRows([])

        // If switching to city and current drill is region, switch to first available (e.g., Competitors)
        if (newType === 'city' && drillDimension === 'region') {
            const nextBest = drillDownOptions.find(o => o.key !== 'region')?.key
            setDrillDimension(nextBest || '')
        }
    }

    // Toggle row expansion
    const toggleRow = (kpiKey) => {
        setExpandedRows(prev =>
            prev.includes(kpiKey)
                ? prev.filter(k => k !== kpiKey)
                : [...prev, kpiKey]
        )
    }

    // Close all expanded rows
    const closeAll = () => setExpandedRows([])

    // Generate cell data - REPLACE with actual data from props/API
    const getCellData = (entityIdx, kpiIdx) => {
        const base = 60 + entityIdx * 5 + kpiIdx * 3
        const value = Math.min(99, Math.max(10, base + (Math.random() - 0.5) * 30))
        const delta = Math.round((Math.random() - 0.4) * 8)
        return { value: Math.round(value), delta }
    }

    // Get drill-down data - REPLACE with actual data from props/API
    const getDrillData = (entity, kpi, drillItem) => {
        return { value: Math.round(60 + Math.random() * 30), delta: Math.round((Math.random() - 0.4) * 5) }
    }

    // Build competition metadata for trends drawer
    const buildCompMeta = (columnName) => {
        // Find entities for current report type
        const reportTitle = reportTypes.find(r => r.key === reportType)?.label || 'Platform';

        return {
            context: { level: "Table", audience: reportTitle },
            periodToggle: { primary: "MTD", compare: "Previous" },
            columns: entities.map(e => ({ id: e, label: e, type: "metric" })),
            brands: kpis.map((kpi, kIdx) => {
                const row = { brand: kpi.label };
                entities.forEach((entity, eIdx) => {
                    const cell = getCellData(eIdx, kIdx);
                    row[entity] = { value: cell.value, delta: cell.delta };
                });
                return row;
            })
        };
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-1 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <ToggleTabs
                        tabs={reportTypes}
                        activeTab={reportType}
                        onChange={handleReportTypeChange}
                    />
                    <DrillDownDropdown
                        options={availableDrillOptions}
                        value={drillDimension}
                        onChange={setDrillDimension}
                    />
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">
                            {reportTypes.find(r => r.key === reportType)?.label} KPI Matrix
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Click any cell to expand entire row
                        </p>
                    </div>
                    {expandedRows.length > 0 && (
                        <button
                            onClick={closeAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                            <X size={12} /> Close All ({expandedRows.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="p-4">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-32">KPI</th>
                            {entities.map(e => (
                                <th key={e} className="text-center py-3 px-2 min-w-[120px]">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{e}</span>
                                        <span
                                            // className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors trend-icon"
                                            className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors"
                                            onClick={() => {
                                                setSelectedColumn(e);
                                                setCompMetaForDrawer(buildCompMeta(e));
                                                setOpenTrend(true);
                                            }}
                                        >
                                            {/* <LineChartIcon size={14} strokeWidth={2.5} /> */}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {kpis.map((kpi, kIdx) => {
                            const isRowExpanded = expandedRows.includes(kpi.key)
                            return (
                                <>
                                    {/* Data Row */}
                                    <tr
                                        key={kpi.key}
                                        className={cn(
                                            'border-b border-slate-50 cursor-pointer transition-colors',
                                            isRowExpanded && 'bg-blue-50/30'
                                        )}
                                    >
                                        <td
                                            className="py-3 px-4 text-sm font-medium text-slate-700"
                                            onClick={() => toggleRow(kpi.key)}
                                        >
                                            {kpi.label}
                                        </td>
                                        {entities.map((entity, eIdx) => {
                                            const cell = getCellData(eIdx, kIdx)
                                            return (
                                                <td
                                                    key={entity}
                                                    className="text-center py-3 px-2"
                                                    onClick={() => toggleRow(kpi.key)}
                                                >
                                                    <motion.div
                                                        className={cn(
                                                            'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50',
                                                            isRowExpanded && 'border-blue-300 bg-blue-50'
                                                        )}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                    >
                                                        <span className="text-sm font-semibold text-slate-800">{cell.value}%</span>
                                                        <span className={cn(
                                                            'text-xs font-medium flex items-center gap-0.5',
                                                            cell.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'
                                                        )}>
                                                            {cell.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                            {Math.abs(cell.delta)}%
                                                        </span>
                                                    </motion.div>
                                                </td>
                                            )
                                        })}
                                    </tr>

                                    {/* Drill-Down Row (Expanded) */}
                                    <AnimatePresence>
                                        {isRowExpanded && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                            >
                                                <td colSpan={entities.length + 1} className="bg-slate-50/80 p-4">
                                                    {/* Drill-down Header */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            {kpi.label} → {drillDownOptions.find(d => d.key === drillDimension)?.label} Breakdown
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleRow(kpi.key); }}
                                                            className="p-1 hover:bg-slate-200 rounded"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Drill-down Cards (All entities) */}
                                                    <div className="grid grid-cols-5 gap-3">
                                                        {entities.map((entity) => (
                                                            <div key={entity} className="bg-white rounded-lg p-3 border border-slate-100">
                                                                <div className="text-xs font-medium text-slate-700 mb-2">{entity}</div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {drillItems.map(item => {
                                                                        const drillData = getDrillData(entity, kpi.key, item)
                                                                        return (
                                                                            <div key={item} className="text-xs">
                                                                                <span className="text-slate-400">{item.split(' ')[0]}</span>
                                                                                <span className="ml-1 font-medium text-slate-700">{drillData.value}%</span>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <TrendsCompetitionDrawer
                open={openTrend}
                onClose={() => setOpenTrend(false)}
                compMeta={compMetaForDrawer}
                selectedColumn={selectedColumn}
                dynamicKey="availability"
            />
        </div>
    )
}