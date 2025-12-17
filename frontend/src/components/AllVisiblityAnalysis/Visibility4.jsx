import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { KpiFilterPanel, KpiField } from '../components/KpiFilterPanel'

const KPI_LABELS = {
    catImpShare: 'Cat Imp Share',
    adSov: 'Ad SOV',
    orgSov: 'Organic SOV',
    overallSov: 'Overall SOV',
    adPos: 'Ad Pos',
    orgPos: 'Org Pos',
}

const PLATFORM_LABELS = {
    Blinkit: 'Blinkit',
    Zepto: 'Zepto',
    Instamart: 'Instamart',
    BigBasket: 'BigBasket',
}

const PERCENT_KPIS = ['catImpShare', 'adSov', 'orgSov', 'overallSov']

const sampleHierarchy = [
    {
        id: 'generic',
        label: 'Generic',

        level: 'keyword-type',
        metrics: { catImpShare: 65.6, adSov: 0.6, orgSov: 1.0, overallSov: 0.8 },
        platforms: {
            Blinkit: { overallSov: 0.8, adSov: 0.6, orgSov: 1.0, catImpShare: 65.6 },
            Zepto: { overallSov: 0.7, adSov: 0.5, orgSov: 0.9, catImpShare: 64.2 },
            Instamart: { overallSov: 0.9, adSov: 0.7, orgSov: 1.1, catImpShare: 66.3 },
            BigBasket: { overallSov: 0.8, adSov: 0.6, orgSov: 1.0, catImpShare: 65.1 },
        },
        children: [
            {
                id: 'generic-ice-cream-delivery',
                label: 'ice cream delivery',

                level: 'keyword',
                metrics: { catImpShare: 6.2, adSov: 0.1, orgSov: 0.2, overallSov: 0.3 },
                platforms: {
                    Blinkit: { overallSov: 0.3, adSov: 0.1, orgSov: 0.2, catImpShare: 6.2 },
                    Zepto: { overallSov: 0.2, adSov: 0.1, orgSov: 0.2, catImpShare: 5.8 },
                },
                children: [
                    {
                        id: 'generic-delivery-cornetto',
                        label: 'Cornetto Double Chocolate',

                        level: 'sku',
                        metrics: { catImpShare: 0.3, adSov: 0.2, orgSov: 0.1, overallSov: 0.2, adPos: 4, orgPos: 12 },
                        platforms: {
                            Blinkit: { catImpShare: 0.3, adSov: 0.2, orgSov: 0.1, overallSov: 0.2, adPos: 3, orgPos: 11 },
                            Zepto: { catImpShare: 0.3, adSov: 0.2, orgSov: 0.1, overallSov: 0.2, adPos: 5, orgPos: 13 },
                        },
                        children: [
                            {
                                id: 'generic-delivery-cornetto-delhi',
                                label: 'Delhi NCR',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.1, overallSov: 0.3, adPos: 3, orgPos: 10 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.1, overallSov: 0.3, adPos: 2, orgPos: 9 },
                                    Zepto: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.1, overallSov: 0.3, adPos: 4, orgPos: 11 },
                                }
                            },
                            {
                                id: 'generic-delivery-cornetto-mumbai',
                                label: 'Mumbai',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.0, overallSov: 0.2, adPos: 5, orgPos: 12 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.0, overallSov: 0.2, adPos: 4, orgPos: 11 },
                                }
                            },
                            {
                                id: 'generic-delivery-cornetto-bangalore',
                                label: 'Bangalore',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.0, overallSov: 0.2, adPos: 6, orgPos: 14 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.0, overallSov: 0.2, adPos: 5, orgPos: 13 },
                                }
                            },
                        ],
                    },
                ],
            },
            {
                id: 'generic-cone-ice-cream',
                label: 'cone ice cream',

                level: 'keyword',
                metrics: { catImpShare: 5.1, adSov: 0.1, orgSov: 0.2, overallSov: 0.3 },
                platforms: {
                    Blinkit: { overallSov: 0.3, adSov: 0.1, orgSov: 0.2, catImpShare: 5.1 },
                    Zepto: { overallSov: 0.2, adSov: 0.1, orgSov: 0.2, catImpShare: 4.8 },
                },
                children: [
                    {
                        id: 'generic-cone-kwality',
                        label: 'Kwality Walls Crunchy Cone',

                        level: 'sku',
                        metrics: { catImpShare: 0.2, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 7, orgPos: 16 },
                        platforms: {
                            Blinkit: { catImpShare: 0.2, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 6, orgPos: 14 },
                            Zepto: { catImpShare: 0.2, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 8, orgPos: 18 },
                        },
                        children: [
                            {
                                id: 'generic-cone-kwality-delhi',
                                label: 'Delhi NCR',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 5, orgPos: 12 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 4, orgPos: 10 },
                                    Zepto: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 6, orgPos: 14 },
                                }
                            },
                            {
                                id: 'generic-cone-kwality-mumbai',
                                label: 'Mumbai',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 7, orgPos: 15 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 6, orgPos: 13 },
                                }
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'brand',
        label: 'Brand',

        level: 'keyword-type',
        metrics: { catImpShare: 0.5, adSov: 88.4, orgSov: 83.0, overallSov: 85.1 },
        platforms: {
            Blinkit: { catImpShare: 0.5, adSov: 88.4, orgSov: 83.0, overallSov: 85.1 },
            Zepto: { catImpShare: 0.4, adSov: 87.2, orgSov: 81.5, overallSov: 84.0 },
            Instamart: { catImpShare: 0.6, adSov: 89.1, orgSov: 84.2, overallSov: 86.3 },
            BigBasket: { catImpShare: 0.5, adSov: 88.0, orgSov: 82.8, overallSov: 85.0 },
        },
        children: [
            {
                id: 'brand-kwality-walls',
                label: 'kwality walls ice cream',

                level: 'keyword',
                metrics: { catImpShare: 14.2, adSov: 41.2, orgSov: 36.7, overallSov: 38.4 },
                platforms: {
                    Blinkit: { overallSov: 38.4, adSov: 41.2, orgSov: 36.7, catImpShare: 14.2 },
                    Zepto: { overallSov: 37.3, adSov: 40.2, orgSov: 35.3, catImpShare: 13.8 },
                },
                children: [
                    {
                        id: 'brand-kwality-magnum',
                        label: 'Magnum Almond',

                        level: 'sku',
                        metrics: { catImpShare: 0.2, adSov: 0.4, orgSov: 0.2, overallSov: 0.6, adPos: 2, orgPos: 8 },
                        platforms: {
                            Blinkit: { catImpShare: 0.2, adSov: 0.4, orgSov: 0.2, overallSov: 0.6, adPos: 1, orgPos: 7 },
                            Zepto: { catImpShare: 0.2, adSov: 0.4, orgSov: 0.2, overallSov: 0.6, adPos: 3, orgPos: 9 },
                        },
                        children: [
                            {
                                id: 'brand-kwality-magnum-delhi',
                                label: 'Delhi NCR',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 2, orgPos: 7 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 1, orgPos: 6 },
                                }
                            },
                            {
                                id: 'brand-kwality-magnum-mumbai',
                                label: 'Mumbai',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 3, orgPos: 8 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 2, orgPos: 7 },
                                }
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'competition',
        label: 'Competition',

        level: 'keyword-type',
        metrics: { catImpShare: 33.9, adSov: 0.8, orgSov: 0.2, overallSov: 0.4 },
        platforms: {
            Blinkit: { catImpShare: 33.9, adSov: 0.8, orgSov: 0.2, overallSov: 0.4 },
            Zepto: { catImpShare: 32.8, adSov: 0.7, orgSov: 0.2, overallSov: 0.3 },
            Instamart: { catImpShare: 34.5, adSov: 0.9, orgSov: 0.3, overallSov: 0.5 },
            BigBasket: { catImpShare: 33.2, adSov: 0.8, orgSov: 0.2, overallSov: 0.4 },
        },
        children: [
            {
                id: 'competition-amul',
                label: 'amul ice cream',

                level: 'keyword',
                metrics: { catImpShare: 8.1, adSov: 0.2, orgSov: 0.1, overallSov: 0.3 },
                platforms: {
                    Blinkit: { overallSov: 0.3, adSov: 0.2, orgSov: 0.1, catImpShare: 8.1 },
                    Zepto: { overallSov: 0.2, adSov: 0.2, orgSov: 0.1, catImpShare: 7.8 },
                },
                children: [
                    {
                        id: 'competition-amul-cone',
                        label: 'Amul Cone',

                        level: 'sku',
                        metrics: { catImpShare: 0.3, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 9, orgPos: 18 },
                        platforms: {
                            Blinkit: { catImpShare: 0.3, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 8, orgPos: 17 },
                            Zepto: { catImpShare: 0.3, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 10, orgPos: 19 },
                        },
                        children: [
                            {
                                id: 'competition-amul-cone-delhi',
                                label: 'Delhi NCR',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 8, orgPos: 16 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 7, orgPos: 15 },
                                }
                            },
                            {
                                id: 'competition-amul-cone-mumbai',
                                label: 'Mumbai',
                                level: 'city',
                                metrics: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 9, orgPos: 17 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 8, orgPos: 16 },
                                }
                            },
                        ],
                    },
                ],
            },
        ],
    },
]

const kpiFields = [
    { id: 'catImpShare', label: 'Cat Imp Share', type: 'number' },
    { id: 'adSov', label: 'Ad SOV', type: 'number' },
    { id: 'orgSov', label: 'Organic SOV', type: 'number' },
    { id: 'overallSov', label: 'Overall SOV', type: 'number' },
    { id: 'adPos', label: 'Ad Pos', type: 'number' },
    { id: 'orgPos', label: 'Org Pos', type: 'number' },
]

const formatMetric = (kpi, value) => {
    if (value === undefined || Number.isNaN(value)) return '–'
    if (PERCENT_KPIS.includes(kpi)) return `${value.toFixed(1)}%`
    return value.toFixed(1)
}

const flattenHierarchy = (nodes, expanded, filters, view = 'platforms') => {
    const rows = []

    const walk = (node, depth, parentPaths) => {
        // Determine paths based on view and depth
        const keywordTypePath = depth === 0 && view !== 'skus' ? node.label : parentPaths.keywordType

        // In SKU view, depth 0 is SKU
        const skuPath = view === 'skus' ? (depth === 0 ? node.label : parentPaths.sku) : (node.level === 'sku' ? node.label : parentPaths.sku)

        const keywordPath = node.level === 'keyword' ? node.label : parentPaths.keyword
        const cityPath = node.level === 'city' ? node.label : parentPaths.city

        // Filter logic
        const passesFilter =
            (!filters.keyword || keywordPath === filters.keyword) &&
            (!filters.sku || skuPath === filters.sku) &&
            (!filters.city || cityPath === filters.city)

        if (!passesFilter) {
            if (node.children) {
                // Pass explicit paths for filtering logic during recursion if needed, 
                // though simplistic walking is usually fine if we don't prune parents based on children visibility here.
                // Current implementation just recurses.
                node.children.forEach((c) => walk(c, depth + 1, { keywordType: keywordTypePath, keyword: keywordPath, sku: skuPath }))
            }
            return
        }

        // Determine if this node has appropriate children to show
        let hasAppropriateChildren = false
        if (node.children && node.children.length > 0) {
            if (view === 'skus') {
                if (depth === 0) { // SKU -> Keyword
                    hasAppropriateChildren = node.children.some(c => c.level === 'keyword')
                } else if (depth === 1) { // Keyword -> City
                    hasAppropriateChildren = node.children.some(c => c.level === 'city')
                }
            } else {
                // Standard hierarchy
                if (depth === 0) {
                    // Keyword Type -> Keyword
                    hasAppropriateChildren = node.children.some(c => c.level === 'keyword')
                } else if (depth === 1 && node.level === 'keyword') {
                    // Keyword -> SKU
                    hasAppropriateChildren = node.children.some(c => c.level === 'sku')
                } else if (node.level === 'sku') {
                    // SKU -> City
                    hasAppropriateChildren = node.children.some(c => c.level === 'city')
                }
            }
        }

        rows.push({
            id: node.id,
            depth,
            keywordType: keywordTypePath,
            keyword: keywordPath,
            sku: skuPath,
            city: cityPath,
            label: node.label,
            subtitle: node.subtitle,
            level: node.level,
            metrics: node.metrics,
            platforms: node.platforms,
            hasChildren: hasAppropriateChildren,
        })

        if (node.children && expanded.has(node.id)) {
            // Filter children based on parent level to enforce proper hierarchy
            let childrenToShow = node.children

            if (view === 'skus') {
                if (depth === 0) childrenToShow = node.children.filter(c => c.level === 'keyword')
                else if (depth === 1) childrenToShow = node.children.filter(c => c.level === 'city')
            } else {
                if (depth === 0) {
                    childrenToShow = node.children.filter(c => c.level === 'keyword')
                } else if (depth === 1 && node.level === 'keyword') {
                    childrenToShow = node.children.filter(c => c.level === 'sku')
                } else if (node.level === 'sku') {
                    childrenToShow = node.children.filter(c => c.level === 'city')
                }
            }

            childrenToShow.forEach((child) => walk(child, depth + 1, { keywordType: keywordTypePath, keyword: keywordPath, sku: skuPath }))
        }
    }

    nodes.forEach((node) => walk(node, 0, {}))
    return rows
}

const FROZEN_WIDTHS = {
    keywordType: 140,
    keyword: 160,
    sku: 160,
    city: 120,
    spacer: 40,
}

const LEFT_KEYWORD = FROZEN_WIDTHS.keywordType
const LEFT_SKU = FROZEN_WIDTHS.keywordType + FROZEN_WIDTHS.keyword
const LEFT_CITY = FROZEN_WIDTHS.keywordType + FROZEN_WIDTHS.keyword + FROZEN_WIDTHS.sku
const LEFT_SPACER = FROZEN_WIDTHS.keywordType + FROZEN_WIDTHS.keyword + FROZEN_WIDTHS.sku + FROZEN_WIDTHS.city

export default function Visibility4() {
    const [activeView, setActiveView] = useState('platforms')
    const [expandedRows, setExpandedRows] = useState(new Set())
    const [expandedKpis, setExpandedKpis] = useState(new Set())
    const [filters, setFilters] = useState({ keyword: null, sku: null, city: null, platform: 'All' })
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(20)
    const [filterPanelOpen, setFilterPanelOpen] = useState(false)

    // Restructure hierarchy for SKUs view: SKU → Keyword → City
    const restructureForSkus = (data) => {
        const skuMap = new Map()

        // Traverse all data and collect SKUs with their keywords and cities
        data.forEach(keywordType => {
            keywordType.children?.forEach(keyword => {
                keyword.children?.forEach(sku => {
                    if (sku.level === 'sku') {
                        const skuId = sku.id

                        if (!skuMap.has(skuId)) {
                            // Create new SKU entry
                            skuMap.set(skuId, {
                                id: skuId,
                                label: sku.label,
                                subtitle: sku.subtitle,
                                level: 'sku',
                                metrics: sku.metrics,
                                platforms: sku.platforms,
                                children: []
                            })
                        }

                        const skuNode = skuMap.get(skuId)

                        // Add keyword under this SKU if not already present
                        let keywordNode = skuNode.children?.find(k => k.id === keyword.id)
                        if (!keywordNode) {
                            keywordNode = {
                                id: keyword.id,
                                label: keyword.label,
                                subtitle: keyword.subtitle,
                                level: 'keyword',
                                metrics: keyword.metrics,
                                platforms: keyword.platforms,
                                children: []
                            }
                            skuNode.children?.push(keywordNode)
                        }

                        // Add cities under the keyword
                        sku.children?.forEach(city => {
                            if (city.level === 'city') {
                                keywordNode.children?.push({
                                    id: `${skuId}-${keyword.id}-${city.id}`,
                                    label: city.label,
                                    level: 'city',
                                    metrics: city.metrics,
                                    platforms: city.platforms
                                })
                            }
                        })
                    }
                })
            })
        })

        return Array.from(skuMap.values())
    }

    const hierarchyData = useMemo(() => {
        if (activeView === 'skus') {
            return restructureForSkus(sampleHierarchy)
        }
        return sampleHierarchy
    }, [activeView])

    const flatRows = useMemo(() => flattenHierarchy(hierarchyData, expandedRows, filters, activeView), [hierarchyData, expandedRows, filters, activeView])

    const totalPages = Math.max(1, Math.ceil(flatRows.length / pageSize))
    const pageRows = flatRows.slice(page * pageSize, page * pageSize + pageSize)

    // Columns detection
    const showKeywordColumn = useMemo(() => {
        // Check if any visible row is a keyword (level='keyword')
        return pageRows.some(r => r.level === 'keyword')
    }, [pageRows])

    const showSkuColumn = useMemo(() => {
        // If we are in SKUs view, we don't use the separate SKU column (it's the first column)
        if (activeView === 'skus') return false
        // Check if any visible row is a SKU (level='sku')
        return pageRows.some(r => r.level === 'sku')
    }, [pageRows, activeView])

    const showCityColumn = useMemo(() => {
        // Check if any visible row is a city (level='city')
        return pageRows.some(r => r.level === 'city')
    }, [pageRows])

    const toggleExpand = (id) => {
        setExpandedRows((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleKpiExpand = (kpi) => {
        setExpandedKpis((prev) => {
            const next = new Set(prev)
            if (next.has(kpi)) next.delete(kpi)
            else next.add(kpi)
            return next
        })
    }

    const keywordOptions = useMemo(() => sampleHierarchy.map((n) => ({ id: n.label, label: n.label })), [])
    const skuOptions = useMemo(
        () =>
            sampleHierarchy
                .flatMap((n) => n.children ?? [])
                .filter((c) => c.level === 'sku')
                .map((c) => ({ id: c.label, label: c.label })),
        []
    )
    const cityOptions = useMemo(
        () =>
            sampleHierarchy
                .flatMap((n) => n.children ?? [])
                .flatMap((c) => c.children ?? [])
                .filter((c) => c.level === 'city')
                .map((c) => ({ id: c.label, label: c.label })),
        []
    )
    const platformOptions = useMemo(() => (['All', ...Object.keys(PLATFORM_LABELS)]).map((p) => ({ id: String(p), label: String(p) })), [])

    const handleKeywordChange = (ids) => setFilters((prev) => ({ ...prev, keyword: ids[0] ?? null }))
    const handleSkuChange = (ids) => setFilters((prev) => ({ ...prev, sku: ids[0] ?? null }))
    const handleCityChange = (ids) => setFilters((prev) => ({ ...prev, city: ids[0] ?? null }))
    const handlePlatformChange = (ids) => {
        const selected = ids[0]
        setFilters((prev) => ({ ...prev, platform: selected === 'All' || !selected ? 'All' : selected }))
    }

    const visiblePlatforms = filters.platform === 'All' ? Object.keys(PLATFORM_LABELS) : [filters.platform]

    // Check if any SKU or City rows are visible to determine if we should show position KPIs
    const hasSkuOrCityRows = pageRows.some(row => row.level === 'sku' || row.level === 'city')



    // Filter KPIs based on row levels - only show Ad Pos and Org Pos if SKU/City rows are present
    const allKpis = Object.keys(KPI_LABELS).filter(kpi => {
        if (kpi === 'adPos' || kpi === 'orgPos') {
            return hasSkuOrCityRows
        }
        return true
    })

    // Heatmap color function for Keywords/SKUs views
    const getHeatmapColor = (kpi, value) => {
        if (value === undefined || value === null) return 'transparent'

        // For position metrics, lower is better
        if (kpi === 'adPos' || kpi === 'orgPos') {
            if (value <= 3) return 'rgba(34, 197, 94, 0.2)' // green
            if (value <= 10) return 'rgba(234, 179, 8, 0.2)' // yellow
            return 'rgba(239, 68, 68, 0.2)' // red
        }

        // For SOV and catImpShare metrics, higher is better
        if (value >= 50) return 'rgba(34, 197, 94, 0.2)' // green
        if (value >= 10) return 'rgba(234, 179, 8, 0.2)' // yellow
        if (value >= 1) return 'rgba(251, 146, 60, 0.2)' // orange
        return 'rgba(239, 68, 68, 0.2)' // red
    }

    const renderValueCell = (metrics, kpi) => {
        const bgColor = activeView !== 'platforms' ? getHeatmapColor(kpi, metrics[kpi]) : 'rgb(248, 250, 252)'
        return (
            <span
                className="block rounded-md px-2 py-1 text-center font-semibold"
                style={{ backgroundColor: bgColor }}
            >
                {formatMetric(kpi, metrics[kpi])}
            </span>
        )
    }

    return (
        <div className="flex h-screen w-full flex-col bg-slate-50">
            <div className="flex items-center justify-between px-6 pt-4">
                <div>
                    <h1 className="text-lg font-semibold text-slate-900">
                        {activeView === 'keywords' ? 'Keywords at a glance' : activeView === 'skus' ? 'SKUs at a glance' : 'Platforms at a glance'}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {activeView === 'platforms'
                            ? 'Expandable KPI columns with platform drill-down.'
                            : 'Hierarchical drilldown with KPI heatmap visualization.'}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="flex rounded-full bg-slate-100 p-1">
                        <button
                            onClick={() => setActiveView('keywords')}
                            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all ${activeView === 'keywords' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            Keywords
                        </button>
                        <button
                            onClick={() => setActiveView('skus')}
                            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all ${activeView === 'skus' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            SKUs
                        </button>
                        <button
                            onClick={() => setActiveView('platforms')}
                            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all ${activeView === 'platforms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            Platforms
                        </button>
                    </div>
                    <button onClick={() => setFilterPanelOpen(true)} className="ml-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                        Filters
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden p-6 pt-3">
                <div className="flex-1 overflow-auto rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="mb-2 text-xs text-slate-500">
                        {activeView === 'keywords' && 'Keyword Type → Keyword → SKU → City'}
                        {activeView === 'skus' && 'SKU → Keyword → City'}
                        {activeView === 'platforms' && 'Category drilldown → Keywords with expandable KPI columns'}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-[12px] text-slate-800">
                            <thead>
                                <tr className="bg-slate-50 text-center text-[11px] font-semibold text-slate-600">
                                    <th
                                        className="px-3 py-2"
                                        style={{ position: 'sticky', left: 0, top: 0, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.keywordType, minWidth: FROZEN_WIDTHS.keywordType }}
                                    >
                                        {activeView === 'skus' ? 'SKU' : 'Keyword Type'}
                                    </th>
                                    {showKeywordColumn && (
                                        <th
                                            className="px-2 py-2"
                                            style={{ position: 'sticky', left: LEFT_KEYWORD, top: 0, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.keyword, minWidth: FROZEN_WIDTHS.keyword }}
                                        >
                                            Keyword
                                        </th>
                                    )}
                                    {showSkuColumn && (
                                        <th
                                            className="px-2 py-2"
                                            style={{ position: 'sticky', left: showKeywordColumn ? LEFT_SKU : LEFT_KEYWORD, top: 0, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.sku, minWidth: FROZEN_WIDTHS.sku }}
                                        >
                                            SKU
                                        </th>
                                    )}
                                    {showCityColumn && (
                                        <th
                                            className="px-2 py-2"
                                            style={{
                                                position: 'sticky',
                                                left: showSkuColumn ? (showKeywordColumn ? LEFT_CITY : LEFT_SKU) : (showKeywordColumn ? LEFT_SKU : LEFT_KEYWORD),
                                                top: 0,
                                                zIndex: 5,
                                                background: '#f8fafc',
                                                width: FROZEN_WIDTHS.city,
                                                minWidth: FROZEN_WIDTHS.city
                                            }}
                                        >
                                            City
                                        </th>
                                    )}
                                    <th
                                        className="px-2 py-2"
                                        style={{
                                            position: 'sticky',
                                            left: showCityColumn
                                                ? (showSkuColumn ? (showKeywordColumn ? LEFT_SPACER : LEFT_CITY) : (showKeywordColumn ? LEFT_CITY : LEFT_SKU))
                                                : showSkuColumn
                                                    ? (showKeywordColumn ? LEFT_CITY : LEFT_SKU)
                                                    : showKeywordColumn
                                                        ? LEFT_SKU
                                                        : LEFT_KEYWORD,
                                            top: 0,
                                            zIndex: 5,
                                            background: '#f8fafc',
                                            width: FROZEN_WIDTHS.spacer,
                                            minWidth: FROZEN_WIDTHS.spacer
                                        }}
                                    >
                                        {/* spacer */}
                                    </th>
                                    {allKpis.map((kpi) => (
                                        <th key={kpi} colSpan={activeView === 'platforms' && expandedKpis.has(kpi) ? visiblePlatforms.length : 1} className="px-2 py-2 text-center border-l border-slate-200">
                                            <div className="flex items-center justify-center gap-1">
                                                {activeView === 'platforms' && (
                                                    <button
                                                        onClick={() => toggleKpiExpand(kpi)}
                                                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[10px] hover:bg-slate-100"
                                                    >
                                                        {expandedKpis.has(kpi) ? '−' : '+'}
                                                    </button>
                                                )}
                                                <span>{KPI_LABELS[kpi]}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50 text-center text-[11px] font-medium text-slate-500">
                                    <th
                                        className="px-3 py-2"
                                        style={{ position: 'sticky', left: 0, top: 40, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.keywordType, minWidth: FROZEN_WIDTHS.keywordType }}
                                    />
                                    {showKeywordColumn && (
                                        <th
                                            className="px-2 py-2"
                                            style={{ position: 'sticky', left: LEFT_KEYWORD, top: 40, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.keyword, minWidth: FROZEN_WIDTHS.keyword }}
                                        />
                                    )}
                                    {showSkuColumn && (
                                        <th
                                            className="px-2 py-2"
                                            style={{ position: 'sticky', left: showKeywordColumn ? LEFT_SKU : LEFT_KEYWORD, top: 40, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.sku, minWidth: FROZEN_WIDTHS.sku }}
                                        />
                                    )}
                                    {showCityColumn && (
                                        <th
                                            className="px-2 py-2"
                                            style={{
                                                position: 'sticky',
                                                left: showSkuColumn ? (showKeywordColumn ? LEFT_CITY : LEFT_SKU) : (showKeywordColumn ? LEFT_SKU : LEFT_KEYWORD),
                                                top: 40,
                                                zIndex: 5,
                                                background: '#f8fafc',
                                                width: FROZEN_WIDTHS.city,
                                                minWidth: FROZEN_WIDTHS.city
                                            }}
                                        />
                                    )}
                                    <th
                                        className="px-2 py-2"
                                        style={{
                                            position: 'sticky',
                                            left: showCityColumn
                                                ? (showSkuColumn ? (showKeywordColumn ? LEFT_SPACER : LEFT_CITY) : (showKeywordColumn ? LEFT_CITY : LEFT_SKU))
                                                : showSkuColumn
                                                    ? (showKeywordColumn ? LEFT_CITY : LEFT_SKU)
                                                    : showKeywordColumn
                                                        ? LEFT_SKU
                                                        : LEFT_KEYWORD,
                                            top: 40,
                                            zIndex: 5,
                                            background: '#f8fafc',
                                            width: FROZEN_WIDTHS.spacer,
                                            minWidth: FROZEN_WIDTHS.spacer
                                        }}
                                    />
                                    {allKpis.flatMap((kpi) =>
                                        activeView === 'platforms' && expandedKpis.has(kpi)
                                            ? visiblePlatforms.map((p) => (
                                                <th key={`${kpi}-${p}`} className="px-2 py-2 text-center border-l border-slate-200">
                                                    {PLATFORM_LABELS[p]}
                                                </th>
                                            ))
                                            : <th key={kpi} className="px-2 py-2 text-center border-l border-slate-200">All</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((row) => (
                                    <tr key={row.id} className="border-b border-slate-100">
                                        <td
                                            className="px-3 py-2"
                                            style={{ position: 'sticky', left: 0, background: '#ffffff', minWidth: FROZEN_WIDTHS.keywordType }}
                                        >
                                            <div className="flex flex-row items-center justify-start text-left gap-2">
                                                {row.hasChildren && (
                                                    <button
                                                        onClick={() => toggleExpand(row.id)}
                                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                                    >
                                                        {expandedRows.has(row.id) ? '−' : '+'}
                                                    </button>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900">{row.depth === 0 && row.level !== 'sku' ? row.label : (row.level === 'sku' && activeView === 'skus' ? row.label : '')}</span>
                                                    {row.subtitle && <span className="text-[10px] text-slate-500">{row.subtitle}</span>}
                                                </div>
                                            </div>
                                        </td>

                                        {showKeywordColumn && (
                                            <td
                                                className="px-2 py-2 text-left"
                                                style={{ position: 'sticky', left: LEFT_KEYWORD, background: '#ffffff', minWidth: FROZEN_WIDTHS.keyword }}
                                            >
                                                <div className="flex items-start">
                                                    {row.hasChildren && row.depth > 0 && (
                                                        <button
                                                            onClick={() => toggleExpand(row.id)}
                                                            className="mr-2 flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                                        >
                                                            {expandedRows.has(row.id) ? '−' : '+'}
                                                        </button>
                                                    )}
                                                    <div>
                                                        {row.level === 'keyword' && <div className="font-medium text-slate-900">{row.label}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                        )}

                                        {showSkuColumn && (
                                            <td
                                                className="px-2 py-2 text-left"
                                                style={{ position: 'sticky', left: showKeywordColumn ? LEFT_SKU : LEFT_KEYWORD, background: '#ffffff', minWidth: FROZEN_WIDTHS.sku }}
                                            >
                                                <div className="flex items-start">
                                                    {row.hasChildren && (row.level === 'sku' || (row.depth > 0 && activeView === 'skus')) && (
                                                        <button
                                                            onClick={() => toggleExpand(row.id)}
                                                            className="mr-2 flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                                        >
                                                            {expandedRows.has(row.id) ? '−' : '+'}
                                                        </button>
                                                    )}
                                                    <div>
                                                        {row.level === 'sku' && <div className="text-slate-600">{row.label}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                        )}

                                        {showCityColumn && (
                                            <td
                                                className="px-2 py-2"
                                                style={{
                                                    position: 'sticky',
                                                    left: showSkuColumn ? (showKeywordColumn ? LEFT_CITY : LEFT_SKU) : (showKeywordColumn ? LEFT_SKU : LEFT_KEYWORD),
                                                    background: '#ffffff',
                                                    minWidth: FROZEN_WIDTHS.city,
                                                }}
                                            >
                                                {row.level === 'city' && <div className="font-semibold text-slate-900">{row.label}</div>}
                                            </td>
                                        )}
                                        <td
                                            className="px-2 py-2"
                                            style={{
                                                position: 'sticky',
                                                left: showCityColumn
                                                    ? (showSkuColumn ? (showKeywordColumn ? LEFT_SPACER : LEFT_CITY) : (showKeywordColumn ? LEFT_CITY : LEFT_SKU))
                                                    : showSkuColumn
                                                        ? (showKeywordColumn ? LEFT_CITY : LEFT_SKU)
                                                        : showKeywordColumn
                                                            ? LEFT_SKU
                                                            : LEFT_KEYWORD,
                                                background: '#ffffff',
                                                width: showKeywordColumn || showSkuColumn || showCityColumn ? FROZEN_WIDTHS.spacer : 0,
                                                minWidth: showKeywordColumn || showSkuColumn || showCityColumn ? FROZEN_WIDTHS.spacer : 0,
                                            }}
                                        />

                                        {allKpis.flatMap((kpi) =>
                                            activeView === 'platforms' && expandedKpis.has(kpi)
                                                ? visiblePlatforms.map((p) => (
                                                    <td key={`${row.id}-${kpi}-${p}`} className="px-2 py-1 text-right align-middle border-l border-slate-100">
                                                        {renderValueCell(row.platforms[p] ?? {}, kpi)}
                                                    </td>
                                                ))
                                                : (
                                                    <td key={`${row.id}-${kpi}`} className="px-2 py-1 text-right align-middle border-l border-slate-100">
                                                        {renderValueCell(row.metrics, kpi)}
                                                    </td>
                                                )
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-white">
                <div className="text-xs text-slate-500">
                    Page {page + 1} of {totalPages} ({flatRows.length} items)
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {filterPanelOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setFilterPanelOpen(false)}
                            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="fixed bottom-0 right-0 top-0 z-50 w-80 border-l border-slate-200 bg-white p-6 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-slate-900">Filters</h2>
                                <button onClick={() => setFilterPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    ✕
                                </button>
                            </div>

                            <KpiFilterPanel
                                fields={kpiFields}
                                onApply={(applied) => console.log('Applied filters:', applied)}
                            />

                            <div className="mt-8 space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">Filter by Keyword</label>
                                    <div className="flex flex-wrap gap-2">
                                        {/* Simplified for demo - robust multi-select usually needs a library or complex component */}
                                        <select
                                            className="w-full rounded border border-slate-300 p-2 text-sm"
                                            onChange={(e) => handleKeywordChange([e.target.value])}
                                            value={filters.keyword || ''}
                                        >
                                            <option value="">All Keywords</option>
                                            {keywordOptions.map((o) => (
                                                <option key={o.id} value={o.id}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">Filter by SKU</label>
                                    <select
                                        className="w-full rounded border border-slate-300 p-2 text-sm"
                                        onChange={(e) => handleSkuChange([e.target.value])}
                                        value={filters.sku || ''}
                                    >
                                        <option value="">All SKUs</option>
                                        {skuOptions.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">Filter by City</label>
                                    <select
                                        className="w-full rounded border border-slate-300 p-2 text-sm"
                                        onChange={(e) => handleCityChange([e.target.value])}
                                        value={filters.city || ''}
                                    >
                                        <option value="">All Cities</option>
                                        {cityOptions.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">Filter by Platform</label>
                                    <select
                                        className="w-full rounded border border-slate-300 p-2 text-sm"
                                        onChange={(e) => handlePlatformChange([e.target.value])}
                                        value={filters.platform}
                                    >
                                        {platformOptions.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
