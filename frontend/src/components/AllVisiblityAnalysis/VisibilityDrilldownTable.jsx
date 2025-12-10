import React, { useMemo, useState } from 'react'

const PLATFORMS = ['Blinkit', 'Zepto', 'Instamart', 'BigBasket']

function levelIcon(type) {
    if (type === 'keywordType') return { char: '●', className: 'text-slate-500', label: 'Type' }
    if (type === 'keyword') return { char: '▲', className: 'text-sky-600', label: 'Keyword' }
    if (type === 'sku') return { char: '◆', className: 'text-emerald-600', label: 'SKU' }
    return { char: '■', className: 'text-amber-600', label: 'City' }
}

function formatPct(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '–'
    return `${value.toFixed(1)}%`
}

function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '–'
    return value
}

function classNames(...parts) {
    return parts.filter(Boolean).join(' ')
}

function seededRandom(seed) {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
    const x = Math.sin(h) * 10000
    return x - Math.floor(x)
}

function buildPlatformCells(row, kpiKey) {
    const result = {}
    if (!kpiKey) return result
    const base = row.metrics[kpiKey] ?? 0
    PLATFORMS.forEach((platform, idx) => {
        const seed = `${row.id}-${kpiKey}-${platform}-${idx}`
        const jitter = 0.7 + seededRandom(seed) * 0.6
        result[platform] = base * jitter
    })
    return result
}

// ------------------------------
// SAMPLE DATA (JSX version)
// ------------------------------
const sampleHierarchy = {
    keywordTypes: [
        {
            id: 'kt-generic',
            type: 'keywordType',
            label: 'Generic',
            volumeShare: 48.3,
            metrics: {
                catImpShare: 52.1,
                overallSov: 1.2,
                adSov: 0.6,
                orgSov: 0.8,
                skuIndex: 96,
                keywordIndex: 82
            },
            children: [
                {
                    id: 'kw-generic-icecream',
                    type: 'keyword',
                    label: 'ice cream delivery',
                    volumeShare: 3.8,
                    metrics: {
                        catImpShare: 6.2,
                        overallSov: 0.3,
                        adSov: 0.15,
                        orgSov: 0.2,
                        skuIndex: 93,
                        keywordIndex: 85
                    },
                    children: [
                        {
                            id: 'sku-cornetto-double-choc',
                            type: 'sku',
                            label: 'Cornetto Double Chocolate',
                            pack: '105 ml',
                            metrics: {
                                adSov: 0.18,
                                orgSov: 0.05,
                                overallSov: 0.22,
                                adPos: 4,
                                orgPos: 12,
                                osa: 95,
                                skuIndex: 101,
                                keywordIndex: 88
                            },
                            cities: [
                                {
                                    id: 'city-delhi',
                                    type: 'city',
                                    label: 'Delhi NCR',
                                    metrics: {
                                        adSov: 0.22,
                                        orgSov: 0.06,
                                        overallSov: 0.25,
                                        osa: 97,
                                        skuIndex: 104,
                                        keywordIndex: 90
                                    }
                                },
                                {
                                    id: 'city-mumbai',
                                    type: 'city',
                                    label: 'Mumbai',
                                    metrics: {
                                        adSov: 0.16,
                                        orgSov: 0.04,
                                        overallSov: 0.2,
                                        osa: 94,
                                        skuIndex: 98,
                                        keywordIndex: 86
                                    }
                                },
                                {
                                    id: 'city-bangalore',
                                    type: 'city',
                                    label: 'Bangalore',
                                    metrics: {
                                        adSov: 0.14,
                                        orgSov: 0.03,
                                        overallSov: 0.18,
                                        osa: 92,
                                        skuIndex: 97,
                                        keywordIndex: 84
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'kw-generic-cone',
                    type: 'keyword',
                    label: 'cone ice cream',
                    volumeShare: 2.9,
                    metrics: {
                        catImpShare: 5.1,
                        overallSov: 0.25,
                        adSov: 0.12,
                        orgSov: 0.18,
                        skuIndex: 92,
                        keywordIndex: 80
                    },
                    children: [
                        {
                            id: 'sku-kw-crunchy-cone',
                            type: 'sku',
                            label: 'Kwality Walls Crunchy Cone',
                            pack: '100 ml',
                            metrics: {
                                adSov: 0.12,
                                orgSov: 0.06,
                                overallSov: 0.18,
                                adPos: 7,
                                orgPos: 16,
                                osa: 93,
                                skuIndex: 95,
                                keywordIndex: 81
                            },
                            cities: [
                                {
                                    id: 'city-delhi-cone',
                                    type: 'city',
                                    label: 'Delhi NCR',
                                    metrics: {
                                        adSov: 0.15,
                                        orgSov: 0.07,
                                        overallSov: 0.2,
                                        osa: 95,
                                        skuIndex: 98,
                                        keywordIndex: 83
                                    }
                                },
                                {
                                    id: 'city-mumbai-cone',
                                    type: 'city',
                                    label: 'Mumbai',
                                    metrics: {
                                        adSov: 0.11,
                                        orgSov: 0.05,
                                        overallSov: 0.16,
                                        osa: 92,
                                        skuIndex: 93,
                                        keywordIndex: 80
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        },

        // ---------------- BRAND SECTION ----------------
        {
            id: 'kt-brand',
            type: 'keywordType',
            label: 'Branded',
            volumeShare: 31.4,
            metrics: {
                catImpShare: 28.6,
                overallSov: 62.5,
                adSov: 58.4,
                orgSov: 64.2,
                skuIndex: 108,
                keywordIndex: 112
            },
            children: [
                {
                    id: 'kw-kwality-walls',
                    type: 'keyword',
                    label: 'kwality walls ice cream',
                    volumeShare: 12.1,
                    metrics: {
                        catImpShare: 14.2,
                        overallSov: 38.4,
                        adSov: 41.2,
                        orgSov: 36.7,
                        skuIndex: 110,
                        keywordIndex: 115
                    },
                    children: [
                        {
                            id: 'sku-magnum-almond',
                            type: 'sku',
                            label: 'Magnum Almond',
                            pack: '80 ml',
                            metrics: {
                                adSov: 0.44,
                                orgSov: 0.22,
                                overallSov: 0.6,
                                adPos: 2,
                                orgPos: 8,
                                osa: 96,
                                skuIndex: 118,
                                keywordIndex: 120
                            },
                            cities: [
                                {
                                    id: 'city-delhi-magnum',
                                    type: 'city',
                                    label: 'Delhi NCR',
                                    metrics: {
                                        adSov: 0.5,
                                        orgSov: 0.25,
                                        overallSov: 0.7,
                                        osa: 97,
                                        skuIndex: 122,
                                        keywordIndex: 124
                                    }
                                },
                                {
                                    id: 'city-mumbai-magnum',
                                    type: 'city',
                                    label: 'Mumbai',
                                    metrics: {
                                        adSov: 0.38,
                                        orgSov: 0.18,
                                        overallSov: 0.5,
                                        osa: 95,
                                        skuIndex: 116,
                                        keywordIndex: 118
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        },

        // --------------- COMPETITION SECTION ----------------
        {
            id: 'kt-competition',
            type: 'keywordType',
            label: 'Competitors',
            volumeShare: 20.3,
            metrics: {
                catImpShare: 19.3,
                overallSov: 1.5,
                adSov: 0.9,
                orgSov: 0.7,
                skuIndex: 88,
                keywordIndex: 76
            },
            children: [
                {
                    id: 'kw-amul-icecream',
                    type: 'keyword',
                    label: 'amul ice cream',
                    volumeShare: 5.4,
                    metrics: {
                        catImpShare: 6.5,
                        overallSov: 0.6,
                        adSov: 0.4,
                        orgSov: 0.3,
                        skuIndex: 90,
                        keywordIndex: 80
                    }
                },
                {
                    id: 'kw-havmor-icecream',
                    type: 'keyword',
                    label: 'havmor ice cream',
                    volumeShare: 3.1,
                    metrics: {
                        catImpShare: 4.2,
                        overallSov: 0.4,
                        adSov: 0.3,
                        orgSov: 0.2,
                        skuIndex: 88,
                        keywordIndex: 78
                    }
                }
            ]
        }
    ]
}

// ------------------------------
// FLATTEN HIERARCHY → ROWS
// ------------------------------
function flattenKeywordHierarchy(expandedIds) {
    const rows = []

    sampleHierarchy.keywordTypes.forEach((kt) => {
        rows.push({
            id: kt.id,
            depth: 0,
            type: 'keywordType',
            label: kt.label,
            helper: `${kt.volumeShare.toFixed(1)}% keyword vol`,
            metrics: kt.metrics,
            hasChildren: kt.children && kt.children.length > 0
        })

        if (expandedIds.has(kt.id) && kt.children) {
            kt.children.forEach((kw) => {
                rows.push({
                    id: kw.id,
                    depth: 1,
                    type: 'keyword',
                    label: kw.label,
                    helper: `${kw.volumeShare.toFixed(1)}% share`,
                    metrics: kw.metrics,
                    hasChildren: kw.children && kw.children.length > 0
                })

                if (expandedIds.has(kw.id) && kw.children) {
                    kw.children.forEach((sku) => {
                        rows.push({
                            id: sku.id,
                            depth: 2,
                            type: 'sku',
                            label: sku.label,
                            helper: sku.pack,
                            metrics: sku.metrics,
                            hasChildren: sku.cities && sku.cities.length > 0
                        })

                        if (expandedIds.has(sku.id) && sku.cities) {
                            sku.cities.forEach((city) => {
                                rows.push({
                                    id: city.id,
                                    depth: 3,
                                    type: 'city',
                                    label: city.label,
                                    helper: 'City',
                                    metrics: city.metrics,
                                    hasChildren: false
                                })
                            })
                        }
                    })
                }
            })
        }
    })

    return rows
}

// ------------------------------
// MAIN COMPONENT
// ------------------------------
export default function VisibilityDrilldownTable() {
    const [activeTab, setActiveTab] = useState('platforms')
    const [expandedIds, setExpandedIds] = useState(new Set(['kt-generic']))
    const [selectedKeywordId, setSelectedKeywordId] = useState(null)
    const [selectedSkuId, setSelectedSkuId] = useState(null)
    const [expandedKpi, setExpandedKpi] = useState('overallSov')

    const keywordRows = useMemo(() => flattenKeywordHierarchy(expandedIds), [expandedIds])
    const showPositionColumns = Boolean(selectedKeywordId && selectedSkuId)

    const toggleRow = (id, type) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

        if (type === 'keyword') {
            setSelectedKeywordId((prev) => (prev === id ? null : id))
            setSelectedSkuId(null)
        }

        if (type === 'sku') {
            setSelectedSkuId((prev) => (prev === id ? null : id))
        }
    }

    return (
        <div className="w-full flex-col items-center bg-slate-50 py-8 text-slate-900">
            <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                {/* HEADER */}
                <header className="mb-4 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900">Keyword at a glance</h1>
                        <p className="text-sm text-slate-500">Hierarchical drilldown with KPI-aware columns and platform split.</p>
                    </div>

                    <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
                        {['keywords', 'skus', 'platforms'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={classNames(
                                    'rounded-full px-4 py-1 capitalize transition',
                                    activeTab === tab
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                )}
                            >
                                {tab === 'skus' ? 'SKUs' : tab}
                            </button>
                        ))}
                    </div>
                </header>

                {/* TAB CONTENT */}
                {activeTab === 'keywords' && (
                    <KeywordHierarchyTable
                        rows={keywordRows}
                        expandedIds={expandedIds}
                        onToggleRow={toggleRow}
                        showPositionColumns={showPositionColumns}
                    />
                )}

                {activeTab === 'skus' && (
                    <SkuFirstTable
                        expandedIds={expandedIds}
                        setExpandedIds={setExpandedIds}
                        selectedKeywordId={selectedKeywordId}
                        setSelectedKeywordId={setSelectedKeywordId}
                    />
                )}

                {activeTab === 'platforms' && (
                    <PlatformSplitTable
                        rows={keywordRows}
                        expandedIds={expandedIds}
                        setExpandedIds={setExpandedIds}
                        expandedKpi={expandedKpi}
                        setExpandedKpi={setExpandedKpi}
                    />
                )}
            </div>
        </div>
    )
}

// ------------------------------
// KEYWORD → SKU → CITY TABLE
// ------------------------------
function KeywordHierarchyTable({ rows, expandedIds, onToggleRow, showPositionColumns }) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-800">Category drilldown → Keywords</span>
                    <span className="text-slate-400">Generic / Brand / Competition → Keyword → SKU → City</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <tr>
                            <th className="w-[40%] px-4 py-2 text-left">Hierarchy</th>
                            <th className="w-[10%] px-2 py-2 text-right">Cat Imp Share</th>
                            <th className="w-[10%] px-2 py-2 text-right">Ad SOV</th>
                            <th className="w-[10%] px-2 py-2 text-right">Organic SOV</th>
                            <th className="w-[10%] px-2 py-2 text-right">Overall SOV</th>
                            {showPositionColumns && (
                                <>
                                    <th className="w-[10%] px-2 py-2 text-right">Ad Pos</th>
                                    <th className="w-[10%] px-2 py-2 text-right">Org Pos</th>
                                </>
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row) => {
                            const isExpanded = expandedIds.has(row.id)
                            const padding = 12 + row.depth * 18
                            const icon = levelIcon(row.type)

                            return (
                                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                                    <td className="px-4 py-2">
                                        <div className="flex items-start gap-2">
                                            <button
                                                className={classNames(
                                                    'mt-1 h-5 w-5 flex items-center justify-center rounded-full border text-xs',
                                                    row.hasChildren
                                                        ? 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
                                                        : 'border-transparent text-transparent'
                                                )}
                                                onClick={() => row.hasChildren && onToggleRow(row.id, row.type)}
                                            >
                                                {row.hasChildren ? (isExpanded ? '▾' : '▸') : ''}
                                            </button>

                                            <div style={{ paddingLeft: padding - 24 }} className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={classNames('text-xs', icon.className)}>{icon.char}</span>
                                                    <span className="font-medium">{row.label}</span>
                                                </div>

                                                {row.helper && (
                                                    <div className="mt-0.5 text-[11px] text-slate-400">
                                                        {row.helper}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.catImpShare)}</td>
                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.adSov)}</td>
                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.orgSov)}</td>
                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.overallSov)}</td>

                                    {showPositionColumns && (
                                        <>
                                            <td className="px-2 py-2 text-right">{row.metrics.adPos ?? '–'}</td>
                                            <td className="px-2 py-2 text-right">{row.metrics.orgPos ?? '–'}</td>
                                        </>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ------------------------------
// SKU-FIRST TABLE
// ------------------------------
function SkuFirstTable({ expandedIds, setExpandedIds }) {
    const rows = []

    sampleHierarchy.keywordTypes.forEach((kt) => {
        kt.children?.forEach((kw) => {
            kw.children?.forEach((sku) => {
                const skuRowId = `sku-tab-${sku.id}`

                rows.push({
                    id: skuRowId,
                    depth: 0,
                    type: 'sku',
                    label: sku.label,
                    helper: sku.pack,
                    metrics: sku.metrics,
                    hasChildren: true
                })

                if (expandedIds.has(skuRowId)) {
                    rows.push({
                        id: `${skuRowId}-kw`,
                        depth: 1,
                        type: 'keyword',
                        label: kw.label,
                        helper: 'Keyword view',
                        metrics: kw.metrics,
                        hasChildren: true
                    })

                    if (expandedIds.has(`${skuRowId}-kw`)) {
                        sku.cities?.forEach((city) => {
                            rows.push({
                                id: `${skuRowId}-city-${city.id}`,
                                depth: 2,
                                type: 'city',
                                label: city.label,
                                helper: 'City',
                                metrics: city.metrics,
                                hasChildren: false
                            })
                        })
                    }
                }
            })
        })
    })

    const toggle = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2">
                <span className="text-sm font-medium text-slate-800">SKU drilldown → Keywords</span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <tr>
                            <th className="w-[40%] px-4 py-2 text-left">Hierarchy</th>
                            <th className="px-2 py-2 text-right">Ad SOV</th>
                            <th className="px-2 py-2 text-right">Org SOV</th>
                            <th className="px-2 py-2 text-right">Overall SOV</th>
                            <th className="px-2 py-2 text-right">Ad Pos</th>
                            <th className="px-2 py-2 text-right">Org Pos</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row) => {
                            const isExpanded = expandedIds.has(row.id)
                            const padding = 12 + row.depth * 18
                            const icon = levelIcon(row.type)

                            return (
                                <tr key={row.id} className="border-b hover:bg-slate-50/60">
                                    <td className="px-4 py-2">
                                        <div className="flex items-start gap-2">
                                            <button
                                                className={classNames(
                                                    'mt-1 h-5 w-5 flex items-center justify-center rounded-full border text-xs',
                                                    row.hasChildren
                                                        ? 'border-slate-300 bg-white text-slate-500'
                                                        : 'border-transparent text-transparent'
                                                )}
                                                onClick={() => row.hasChildren && toggle(row.id)}
                                            >
                                                {row.hasChildren ? (isExpanded ? '▾' : '▸') : ''}
                                            </button>

                                            <div style={{ paddingLeft: padding - 24 }}>
                                                <div className="flex items-center gap-2">
                                                    <span className={classNames('text-xs', icon.className)}>{icon.char}</span>
                                                    <span className="font-medium">{row.label}</span>
                                                </div>

                                                {row.helper && (
                                                    <div className="text-[11px] text-slate-400">
                                                        {row.helper}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.adSov)}</td>
                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.orgSov)}</td>
                                    <td className="px-2 py-2 text-right">{formatPct(row.metrics.overallSov)}</td>
                                    <td className="px-2 py-2 text-right">{row.metrics.adPos ?? '–'}</td>
                                    <td className="px-2 py-2 text-right">{row.metrics.orgPos ?? '–'}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ------------------------------
// PLATFORM KPI SPLIT TABLE
// ------------------------------
function PlatformSplitTable({
    rows,
    expandedIds,
    setExpandedIds,
    expandedKpi,
    setExpandedKpi
}) {
    const kpis = [
        { key: 'overallSov', label: 'Overall SOV' },
        { key: 'adSov', label: 'Ad SOV' },
        { key: 'orgSov', label: 'Organic SOV' },
        { key: 'skuIndex', label: 'SKU Index' },
        { key: 'keywordIndex', label: 'Keyword Index' }
    ]

    const toggleKpi = (key) => {
        setExpandedKpi((prev) => (prev === key ? null : key))
    }

    const toggleRow = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2">
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-800">
                        Platform split (KPI-first dual axis)
                    </span>
                    <span className="text-xs text-slate-400">
                        Click a KPI to see it broken down by platform side-by-side.
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">

                    {/* TABLE HEAD */}
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <tr>
                            <th className="w-[30%] px-4 py-2 text-left">Hierarchy</th>

                            {kpis.map((kpi) => (
                                <th key={kpi.key} className="px-2 py-2 text-right">
                                    <button
                                        onClick={() => toggleKpi(kpi.key)}
                                        className={classNames(
                                            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition",
                                            expandedKpi === kpi.key
                                                ? "bg-white text-slate-900 shadow-sm border-slate-400"
                                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                        )}
                                    >
                                        <span>{kpi.label}</span>
                                        <span>{expandedKpi === kpi.key ? "▾" : "▸"}</span>
                                    </button>
                                </th>
                            ))}

                            {expandedKpi && (
                                <th className="px-2 py-2 text-right" colSpan={PLATFORMS.length}></th>
                            )}
                        </tr>

                        {expandedKpi && (
                            <tr className="border-t border-slate-200 bg-slate-50/80 text-[11px] text-slate-500">
                                <th className="px-4 py-1 text-left">
                                    Platform view for {kpis.find((k) => k.key === expandedKpi)?.label}
                                </th>

                                {PLATFORMS.map((platform) => (
                                    <th key={platform} className="px-2 py-1 text-right">
                                        {platform}
                                    </th>
                                ))}
                            </tr>
                        )}
                    </thead>

                    {/* TABLE BODY */}
                    <tbody>
                        {rows.map((row) => {
                            const isExpanded = expandedIds.has(row.id)
                            const padding = 12 + row.depth * 18
                            const icon = levelIcon(row.type)
                            const platformCells = buildPlatformCells(row, expandedKpi)

                            return (
                                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                                    <td className="px-4 py-2">
                                        <div className="flex items-start gap-2">

                                            <button
                                                className={classNames(
                                                    "mt-1 h-5 w-5 flex items-center justify-center rounded-full border text-xs",
                                                    row.hasChildren
                                                        ? "border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                                                        : "border-transparent text-transparent"
                                                )}
                                                onClick={() => row.hasChildren && toggleRow(row.id)}
                                            >
                                                {row.hasChildren ? (isExpanded ? "▾" : "▸") : ""}
                                            </button>

                                            <div style={{ paddingLeft: padding - 24 }} className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={classNames("text-xs", icon.className)}>{icon.char}</span>
                                                    <span className="font-medium">{row.label}</span>
                                                </div>
                                                {row.helper && (
                                                    <div className="mt-0.5 text-[11px] text-slate-400">{row.helper}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {kpis.map((kpi) => (
                                        <td key={kpi.key} className="px-2 py-2 text-right">
                                            {formatPct(row.metrics[kpi.key])}
                                        </td>
                                    ))}

                                    {expandedKpi &&
                                        PLATFORMS.map((platform) => (
                                            <td
                                                key={platform}
                                                className="px-2 py-2 text-right text-xs text-slate-700"
                                            >
                                                {formatPct(platformCells[platform])}
                                            </td>
                                        ))}
                                </tr>
                            )
                        })}
                    </tbody>

                </table>
            </div>
        </div>
    )
}
