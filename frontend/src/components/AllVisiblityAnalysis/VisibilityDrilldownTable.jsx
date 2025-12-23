import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { KpiFilterPanel } from '../KpiFilterPanel'
import { SlidersHorizontal, X } from 'lucide-react'
import PaginationFooter from '../CommonLayout/PaginationFooter'

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
                id: 'generic-brand-kwality',
                label: 'Kwality Walls',
                level: 'brand',
                metrics: { catImpShare: 65.6, adSov: 0.6, orgSov: 1.0, overallSov: 0.8 },
                platforms: {
                    Blinkit: { overallSov: 0.8, adSov: 0.6, orgSov: 1.0, catImpShare: 65.6 },
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
                                        }
                                    },
                                    {
                                        id: 'generic-delivery-cornetto-mumbai',
                                        label: 'Mumbai',
                                        level: 'city',
                                        metrics: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.1, overallSov: 0.3, adPos: 3, orgPos: 10 },
                                        platforms: {
                                            Blinkit: { catImpShare: 0.1, adSov: 0.2, orgSov: 0.1, overallSov: 0.3, adPos: 2, orgPos: 9 },
                                        }
                                    }
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
                                id: 'generic-cone-cornetto',
                                label: 'Cornetto Disc',
                                level: 'sku',
                                metrics: { catImpShare: 2.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 5, orgPos: 11 },
                                platforms: {
                                    Blinkit: { catImpShare: 2.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 4, orgPos: 10 },
                                    Zepto: { catImpShare: 2.1, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 6, orgPos: 12 },
                                },
                                children: [
                                    {
                                        id: 'generic-cone-cornetto-delhi',
                                        label: 'Delhi NCR',
                                        level: 'city',
                                        metrics: { catImpShare: 1.0, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 4, orgPos: 10 },
                                        platforms: {
                                            Blinkit: { catImpShare: 1.0, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 3, orgPos: 9 },
                                        }
                                    }
                                ]
                            }
                        ],
                    }
                ]
            }
        ],
    },
    {
        id: 'brand',
        label: 'Brand',
        level: 'keyword-type',
        metrics: { catImpShare: 0.5, adSov: 88.4, orgSov: 83.0, overallSov: 85.1 },
        platforms: {
            Blinkit: { catImpShare: 0.5, adSov: 88.4, orgSov: 83.0, overallSov: 85.1 },
        },
        children: [
            {
                id: 'brand-kwality-walls',
                label: 'kwality walls ice cream',
                level: 'brand',
                metrics: { catImpShare: 14.2, adSov: 41.2, orgSov: 36.7, overallSov: 38.4 },
                platforms: {
                    Blinkit: { overallSov: 38.4, adSov: 41.2, orgSov: 36.7, catImpShare: 14.2 },
                },
                children: [
                    {
                        id: 'brand-kwality-keyword-1',
                        label: 'ice cream',
                        level: 'keyword',
                        metrics: { catImpShare: 14.2, adSov: 41.2, orgSov: 36.7, overallSov: 38.4 },
                        platforms: {
                            Blinkit: { overallSov: 38.4, adSov: 41.2, orgSov: 36.7, catImpShare: 14.2 },
                        },
                        children: [
                            {
                                id: 'brand-kwality-magnum',
                                label: 'Magnum Almond',
                                level: 'sku',
                                metrics: { catImpShare: 0.2, adSov: 0.4, orgSov: 0.2, overallSov: 0.6, adPos: 2, orgPos: 8 },
                                platforms: {
                                    Blinkit: { catImpShare: 0.2, adSov: 0.4, orgSov: 0.2, overallSov: 0.6, adPos: 1, orgPos: 7 },
                                },
                                children: [],
                            },
                        ],
                    }
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
        },
        children: [
            {
                id: 'competition-amul',
                label: 'Amul',
                level: 'brand',
                metrics: { catImpShare: 33.9, adSov: 0.8, orgSov: 0.2, overallSov: 0.4 },
                platforms: {
                    Blinkit: { catImpShare: 33.9, adSov: 0.8, orgSov: 0.2, overallSov: 0.4 },
                },
                children: [
                    {
                        id: 'competition-amul-cone',
                        label: 'Amul Cone',
                        level: 'keyword',
                        metrics: { catImpShare: 0.3, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 9, orgPos: 18 },
                        platforms: {
                            Blinkit: { catImpShare: 0.3, adSov: 0.1, orgSov: 0.1, overallSov: 0.2, adPos: 8, orgPos: 17 },
                        },
                        children: [],
                    }
                ]
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
    if (PERCENT_KPIS.includes(kpi)) return `${value.toFixed(1)}`
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
                    // Keyword Type -> Brand
                    hasAppropriateChildren = node.children.some(c => c.level === 'brand')
                } else if (depth === 1 && node.level === 'brand') {
                    // Brand -> Keyword
                    hasAppropriateChildren = node.children.some(c => c.level === 'keyword')
                } else if (node.level === 'keyword') {
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
            brand: node.level === 'brand' ? node.label : parentPaths.brand,
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
                    childrenToShow = node.children.filter(c => c.level === 'brand')
                } else if (depth === 1 && node.level === 'brand') {
                    childrenToShow = node.children.filter(c => c.level === 'keyword')
                } else if (node.level === 'keyword') {
                    childrenToShow = node.children.filter(c => c.level === 'sku')
                } else if (node.level === 'sku') {
                    childrenToShow = node.children.filter(c => c.level === 'city')
                }
            }

            childrenToShow.forEach((child) => walk(child, depth + 1, {
                keywordType: keywordTypePath,
                brand: node.level === 'brand' ? node.label : parentPaths.brand,
                keyword: keywordPath,
                sku: skuPath
            }))
        }
    }

    nodes.forEach((node) => walk(node, 0, {}))
    return rows
}

const FROZEN_WIDTHS = {
    keywordType: 140,
    brand: 120,
    keyword: 160,
    sku: 160,
    city: 120,
    spacer: 40,
}



const filterOptions = [
    { id: "date", label: "Date", options: [] }, // Date range picker would be custom
    {
        id: "kpi",
        label: "KPI",
        options: [
            { id: "overallWeightedSos", label: "OVERALL WEIGHTED SOS" },
            { id: "sponsoredWeightedSos", label: "SPONSORED WEIGHTED SOS" },
            { id: "organicWeightedSos", label: "ORGANIC WEIGHTED SOS" }
        ]
    },
    { id: "keywords", label: "Keyword" },
    { id: "month", label: "Month", options: [{ id: "all", label: "All" }, { id: "jan", label: "January" }, { id: "feb", label: "February" }] },
    { id: "platform", label: "Platform", options: [{ id: "blinkit", label: "Blinkit" }, { id: "zepto", label: "Zepto" }] },
    { id: "productName", label: "Product Name", options: [{ id: "p1", label: "Cornetto Double Chocolate" }, { id: "p2", label: "Magnum Truffle" }] },
    { id: "format", label: "Format", options: [{ id: "cone", label: "Cone" }, { id: "cup", label: "Cup" }, { id: "stick", label: "Stick" }] },
    { id: "zone", label: "Zone", options: [{ id: "north", label: "North" }, { id: "south", label: "South" }] },
    { id: "city", label: "City", options: [{ id: "delhi", label: "Delhi" }, { id: "mumbai", label: "Mumbai" }] },
    { id: "pincode", label: "Pincode", options: [{ id: "110001", label: "110001" }, { id: "400001", label: "400001" }] },
    { id: "metroFlag", label: "Metro Flag", options: [{ id: "metro", label: "Metro" }, { id: "non-metro", label: "Non-Metro" }] },
    { id: "classification", label: "Classification", options: [{ id: "gnow", label: "GNOW" }] },
]

export default function VisibilityDrilldownTable() {
    const [popupFilters, setPopupFilters] = useState({
        keyword: null,
        sku: null,
        city: null,
        platform: 'All',

    })

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [activeView, setActiveView] = useState('keywords')
    const [expandedRows, setExpandedRows] = useState(new Set())
    const [expandedKpis, setExpandedKpis] = useState(new Set())
    const [filters, setFilters] = useState({ keyword: null, sku: null, city: null, platform: 'All' })
    const [page, setPage] = useState(1) // 1-indexed for PaginationFooter
    const [pageSize, setPageSize] = useState(5)
    const [filterPanelOpen, setFilterPanelOpen] = useState(false)



    // Restructure hierarchy for SKUs view: SKU → Keyword → City
    const restructureForSkus = (data) => {
        const skuMap = new Map()

        // Traverse all data and collect SKUs with their keywords and cities
        data.forEach(keywordType => {
            keywordType.children?.forEach(brand => {
                brand.children?.forEach(keyword => {
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

    // Pagination slicing
    const pageRows = useMemo(() => {
        const startIndex = (page - 1) * pageSize
        return flatRows.slice(startIndex, startIndex + pageSize)
    }, [flatRows, page, pageSize])

    // Check if any keyword type (level 0) is expanded to show Brand column
    const showBrandColumn = useMemo(() => {
        if (activeView !== 'keywords') return false
        // Check if any expanded row corresponds to a keyword type (depth 0 / level 'keyword-type')
        // effectively, if expandedRows contains any ID that is a keyword type.
        // Since we don't have easy O(1) access to row object by ID here, 
        // we can iterate pageRows (visible rows) and check if any visible row is a 'brand' (level 1).
        // If a brand row is visible, it means a keyword type was expanded.
        return pageRows.some(r => r.level === 'brand')
    }, [activeView, pageRows])
    const brandWidth = showBrandColumn ? FROZEN_WIDTHS.brand : 0

    const LEFT_BRAND = FROZEN_WIDTHS.keywordType
    const LEFT_KEYWORD = FROZEN_WIDTHS.keywordType + brandWidth
    const LEFT_SKU = LEFT_KEYWORD + FROZEN_WIDTHS.keyword
    const LEFT_CITY = LEFT_SKU + FROZEN_WIDTHS.sku
    const LEFT_SPACER = LEFT_CITY + FROZEN_WIDTHS.city

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

    const keywordOptions = useMemo(() =>
        sampleHierarchy
            .flatMap((n) => n.children ?? []) // brands
            .flatMap((b) => b.children ?? []) // keywords
            .map((k) => ({ id: k.label, label: k.label })),
        []
    )
    const skuOptions = useMemo(
        () =>
            sampleHierarchy
                .flatMap((n) => n.children ?? []) // brands
                .flatMap((b) => b.children ?? []) // keywords
                .flatMap((k) => k.children ?? []) // skus
                .filter((c) => c.level === 'sku')
                .map((c) => ({ id: c.label, label: c.label })),
        []
    )
    const cityOptions = useMemo(
        () =>
            sampleHierarchy
                .flatMap((n) => n.children ?? []) // brands
                .flatMap((b) => b.children ?? []) // keywords
                .flatMap((k) => k.children ?? []) // skus
                .flatMap((s) => s.children ?? []) // cities
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
        if (value === undefined || value === null) return {}

        // For position metrics, lower is better
        if (kpi === 'adPos' || kpi === 'orgPos') {
            if (value <= 3) return { backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#166534' } // green
            if (value <= 10) return { backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#854d0e' } // yellow
            return { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#991b1b' } // red
        }

        // For SOV and catImpShare metrics, higher is better
        if (value >= 50) return { backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#166534' } // green
        if (value >= 10) return { backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#854d0e' } // yellow
        if (value >= 1) return { backgroundColor: 'rgba(249, 115, 22, 0.12)', color: '#9a3412' } // orange
        return { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#991b1b' } // red
    }

    const renderValueCell = (metrics, kpi) => {
        const style = activeView !== 'platforms' ? getHeatmapColor(kpi, metrics[kpi]) : { backgroundColor: 'rgb(243, 244, 246)', color: '#111827' }
        return (
            <span
                className="inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded text-[11px] font-medium"
                style={style}
            >
                {formatMetric(kpi, metrics[kpi])}
            </span>
        )
    }

    return (
        <div className="flex w-full flex-col">
            <div className="px-6 pt-4">
                <div className="flex items-center gap-2 text-xs">
                    <div className="flex rounded-full bg-[#f3f4f6] p-[3px]">
                        <button
                            onClick={() => setActiveView('keywords')}
                            className={`rounded-full px-4 py-1 text-sm font-medium transition-all ${activeView === 'keywords' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            Keywords
                        </button>
                        <button
                            onClick={() => setActiveView('skus')}
                            className={`rounded-full px-4 py-1 text-sm font-medium transition-all ${activeView === 'skus' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            SKUs
                        </button>
                        <button
                            onClick={() => setActiveView('platforms')}
                            className={`rounded-full px-4 py-1 text-sm font-medium transition-all ${activeView === 'platforms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            Platforms
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden p-6 pt-3">
                <div className="flex flex-col h-full w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between px-6 pt-4 pb-2">
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
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowFilterPanel(true)}
                                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                <span>Filters</span>
                            </button>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                    Healthy
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50/50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                    Watch
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50/50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                    Action
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        <div className="mb-2 text-xs text-slate-500">
                            {activeView === 'keywords' && 'Keyword Type → Brand → Keyword → SKU → City'}
                            {activeView === 'skus' && 'SKU → Keyword → City'}
                            {activeView === 'platforms' && 'Category drilldown → Keywords with expandable KPI columns'}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-[12px] text-slate-800">
                                <thead>
                                    <tr className="bg-slate-50 text-center text-[12px] font-bold text-black-600">
                                        <th
                                            className="px-3 py-2"
                                            style={{ position: 'sticky', left: 0, top: 0, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.keywordType, minWidth: FROZEN_WIDTHS.keywordType }}
                                        >
                                            {activeView === 'skus' ? 'SKU' : 'Keyword Type'}
                                        </th>
                                        {showBrandColumn && (
                                            <th
                                                className="px-2 py-2"
                                                style={{ position: 'sticky', left: LEFT_BRAND, top: 0, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.brand, minWidth: FROZEN_WIDTHS.brand }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>Brand</span>
                                                </div>
                                            </th>
                                        )}
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
                                        {showBrandColumn && (
                                            <th
                                                className="px-2 py-2"
                                                style={{ position: 'sticky', left: LEFT_BRAND, top: 40, zIndex: 5, background: '#f8fafc', width: FROZEN_WIDTHS.brand, minWidth: FROZEN_WIDTHS.brand }}
                                            />
                                        )}
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
                                                    {row.hasChildren && row.depth === 0 && (
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

                                            {showBrandColumn && (
                                                <td
                                                    className="px-2 py-2 text-left"
                                                    style={{ position: 'sticky', left: LEFT_BRAND, background: '#ffffff', minWidth: FROZEN_WIDTHS.brand }}
                                                >
                                                    <div className="flex flex-row items-center justify-start text-left gap-2 text-slate-600">
                                                        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                                                            {row.level === 'brand' && (
                                                                <button
                                                                    onClick={() => toggleExpand(row.id)}
                                                                    className="flex h-4 w-4 items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 text-[10px]"
                                                                >
                                                                    {expandedRows.has(row.id) ? '−' : '+'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span>{row.level === 'brand' ? row.label : ''}</span>
                                                    </div>
                                                </td>
                                            )}

                                            {showKeywordColumn && (
                                                <td
                                                    className="px-2 py-2 text-left"
                                                    style={{ position: 'sticky', left: LEFT_KEYWORD, background: '#ffffff', minWidth: FROZEN_WIDTHS.keyword }}
                                                >
                                                    <div className="flex flex-row items-center justify-start text-left gap-2 text-slate-600">
                                                        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                                                            {row.level === 'keyword' && (
                                                                <button
                                                                    onClick={() => toggleExpand(row.id)}
                                                                    className="flex h-4 w-4 items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 text-[10px]"
                                                                >
                                                                    {expandedRows.has(row.id) ? '−' : '+'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span>{row.level === 'keyword' ? row.label : ''}</span>
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
                                                        <td key={`${row.id}-${kpi}-${p}`} className="px-2 py-1 text-center align-middle border-l border-slate-100">
                                                            {renderValueCell(row.platforms[p] ?? {}, kpi)}
                                                        </td>
                                                    ))
                                                    : (
                                                        <td key={`${row.id}-${kpi}`} className="px-2 py-1 text-center align-middle border-l border-slate-100">
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

            <div className="border-t border-slate-100">
                <PaginationFooter
                    isVisible={flatRows.length > 3}
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </div>


            {
                showFilterPanel && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-52 pl-40 transition-all backdrop-blur-sm">
                        <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                                    <p className="text-sm text-slate-500">Configure data visibility and rules</p>
                                </div>
                                <button
                                    onClick={() => setShowFilterPanel(false)}
                                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Panel Content */}
                            {/* Panel Content */}
                            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-0 pb-6">
                                <KpiFilterPanel
                                    sectionConfig={filterOptions}
                                    keywords={keywordOptions}
                                    onKeywordChange={(vals) => setPopupFilters(prev => ({ ...prev, keyword: vals[0] ?? null }))}
                                    onChange={(values) => {
                                        setPopupFilters(prev => ({
                                            ...prev,
                                            ...values,
                                        }))
                                    }}
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                                <button
                                    onClick={() => setShowFilterPanel(false)}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setFilters(prev => ({
                                            ...prev,
                                            keyword: popupFilters.keyword || null,
                                            sku: popupFilters.sku || null,
                                            city: popupFilters.city || null,
                                            platform: popupFilters.platform || 'All',
                                        }))

                                        setPage(1)
                                        setExpandedRows(new Set())
                                        setShowFilterPanel(false)
                                    }}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
