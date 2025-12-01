import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

// -----------------------------------------------------------------------------
// HELPERS (no TS)
// -----------------------------------------------------------------------------

const formatSales = (sales) => {
  if (!Number.isFinite(sales)) return 'NaN'
  if (sales >= 10_000_000) return `${(sales / 10_000_000).toFixed(1)} Cr`
  if (sales >= 100_000) return `${(sales / 100_000).toFixed(1)} L`
  if (sales >= 10_000) return `${(sales / 1000).toFixed(1)}k`
  return sales.toLocaleString('en-IN')
}

// -----------------------------------------------------------------------------

const buildMatrix = (records, rangeOrder, brandOrder) => {
  const rangeTotals = {}

  records.forEach((r) => {
    rangeTotals[r.range] = (rangeTotals[r.range] || 0) + r.sales
  })

  const cellMap = {}
  records.forEach((r) => {
    const key = `${r.range}__${r.brand}`
    const total = rangeTotals[r.range] || 1
    const share = r.sales / total

    cellMap[key] = {
      sales: r.sales,
      share: Number.isFinite(share) ? share : 0,
    }
  })

  return { rangeOrder, brandOrder, rangeTotals, cellMap }
}

// -----------------------------------------------------------------------------
// DATA (unchanged – just removing TypeScript)
// -----------------------------------------------------------------------------

export const quantityRecords = [
  { range: '0-200', brand: 'Amul', sales: 1800 },
  { range: '0-200', brand: 'Baskin Robbins', sales: 31520 },
  { range: '0-200', brand: 'Cream Bell', sales: 0 },
  { range: '0-200', brand: 'Havmor', sales: 4890 },
  { range: '0-200', brand: 'Vadilal', sales: 80920 },
  { range: '101-150', brand: 'Go-Zero', sales: 4410 },
  { range: '151-200', brand: 'Hocco', sales: 80 },
  { range: '201-400', brand: 'Havmor', sales: 87360 },
  { range: '401-600', brand: 'Amul', sales: 900 },
  { range: '401-600', brand: 'Cream Bell', sales: 2132550 },
  { range: '401-600', brand: 'Havmor', sales: 1602020 },
  { range: '401-600', brand: 'Vadilal', sales: 2107470 },
  { range: '601-800', brand: 'Havmor', sales: 3423 },
  { range: '0-50', brand: 'Amul', sales: 2666720 },
  { range: '0-50', brand: 'Baskin Robbins', sales: 357469 },
  { range: '0-50', brand: 'Cream Bell', sales: 500480 },
  { range: '0-50', brand: 'Go-Zero', sales: 1136693 },
  { range: '0-50', brand: 'Grameen', sales: 548100 },
  { range: '0-50', brand: 'Havmor', sales: 204650 },
  { range: '0-50', brand: 'Hocco', sales: 163180 },
  { range: '0-50', brand: 'Kwality Walls', sales: 2341420 },
  { range: '0-50', brand: 'Others', sales: 1030189 },
  { range: '0-50', brand: 'Vadilal', sales: 111730 },
  { range: '0-100', brand: 'Others', sales: 5000113 },
  { range: '0-100', brand: 'Vadilal', sales: 25260 },
  { range: '0-250', brand: 'Amul', sales: 35198566 },
  { range: '0-250', brand: 'Baskin Robbins', sales: 42642 },
  { range: '0-250', brand: 'Cream Bell', sales: 53769 },
  { range: '0-250', brand: 'Go-Zero', sales: 2295 },
  { range: '0-250', brand: 'Havmor', sales: 120907 },
  { range: '0-250', brand: 'Hocco', sales: 917854 },
  { range: '0-250', brand: 'Kwality Walls', sales: 729044 },
  { range: '0-250', brand: 'Others', sales: 1020 },
  { range: '0-250', brand: 'Vadilal', sales: 3303960 },
  { range: '51-75', brand: 'Amul', sales: 2178890 },
  { range: '51-75', brand: 'Baskin Robbins', sales: 4480052 },
  { range: '51-75', brand: 'Cream Bell', sales: 518040 },
  { range: '51-75', brand: 'Go-Zero', sales: 6375139 },
  { range: '51-75', brand: 'Grameen', sales: 7080041 },
  { range: '51-75', brand: 'Havmor', sales: 0 },
  { range: '51-75', brand: 'Kwality Walls', sales: 16689431 },
  { range: '51-75', brand: 'Others', sales: 454250 },
  { range: '51-75', brand: 'Vadilal', sales: 101840 },
  { range: '76-100', brand: 'Amul', sales: 2224827 },
  { range: '76-100', brand: 'Baskin Robbins', sales: 4678404 },
  { range: '76-100', brand: 'Cream Bell', sales: 8006700 },
  { range: '76-100', brand: 'Go-Zero', sales: 5093688 },
  { range: '76-100', brand: 'Grameen', sales: 0 },
  { range: '76-100', brand: 'Havmor', sales: 4358795 },
  { range: '76-100', brand: 'Hocco', sales: 1607359 },
  { range: '76-100', brand: 'Kwality Walls', sales: 2693873 },
  { range: '76-100', brand: 'Vadilal', sales: 7327500 },
  { range: '101-125', brand: 'Amul', sales: 9809040 },
  { range: '101-125', brand: 'Baskin Robbins', sales: 4497250 },
  { range: '101-125', brand: 'Cream Bell', sales: 2120040 },
  { range: '101-125', brand: 'Go-Zero', sales: 1813062 },
  { range: '101-125', brand: 'Grameen', sales: 134280 },
  { range: '101-125', brand: 'Havmor', sales: 3010810 },
  { range: '101-125', brand: 'Hocco', sales: 6253150 },
  { range: '101-125', brand: 'Kwality Walls', sales: 23765362 },
  { range: '101-125', brand: 'Others', sales: 1356860 },
  { range: '101-125', brand: 'Vadilal', sales: 4909170 },
  { range: '101-200', brand: 'Others', sales: 36261 },
  { range: '101-200', brand: 'Vadilal', sales: 43500 },
  { range: '125+', brand: 'Amul', sales: 3127130 },
  { range: '125+', brand: 'Baskin Robbins', sales: 175571 },
  { range: '125+', brand: 'Cream Bell', sales: 2111250 },
  { range: '125+', brand: 'Go-Zero', sales: 154475 },
  { range: '125+', brand: 'Grameen', sales: 1249490 },
  { range: '125+', brand: 'Havmor', sales: 2270740 },
  { range: '125+', brand: 'Kwality Walls', sales: 1332560 },
  { range: '125+', brand: 'Vadilal', sales: 1354220 },
  { range: '126-150', brand: 'Baskin Robbins', sales: 75480 },
  { range: '126-150', brand: 'Cream Bell', sales: 133000 },
  { range: '126-150', brand: 'Havmor', sales: 174100 },
  { range: '126-150', brand: 'Hocco', sales: 6480000 },
  { range: '126-150', brand: 'Others', sales: 88390 },
  { range: '150+', brand: 'Amul', sales: 584695 },
  { range: '150+', brand: 'Baskin Robbins', sales: 1530280 },
  { range: '150+', brand: 'Cream Bell', sales: 894060 },
  { range: '150+', brand: 'Go-Zero', sales: 24028 },
  { range: '150+', brand: 'Grameen', sales: 375399 },
  { range: '150+', brand: 'Havmor', sales: 532110 },
  { range: '150+', brand: 'Hocco', sales: 0 },
  { range: '150+', brand: 'Kwality Walls', sales: 3286273 },
  { range: '150+', brand: 'Vadilal', sales: 51975 },
  { range: '251-500', brand: 'Amul', sales: 390940 },
  { range: '251-500', brand: 'Baskin Robbins', sales: 562150 },
  { range: '251-500', brand: 'Cream Bell', sales: 165410 },
  { range: '251-500', brand: 'Go-Zero', sales: 472605 },
  { range: '251-500', brand: 'Grameen', sales: 0 },
  { range: '251-500', brand: 'Havmor', sales: 234576 },
  { range: '251-500', brand: 'Kwality Walls', sales: 1699164 },
  { range: '501-750', brand: 'Amul', sales: 4350 },
  { range: '501-750', brand: 'Baskin Robbins', sales: 78691 },
  { range: '501-750', brand: 'Cream Bell', sales: 6056895 },
  { range: '501-750', brand: 'Havmor', sales: 440397 },
  { range: '501-750', brand: 'Hocco', sales: 2527153 },
  { range: '501-750', brand: 'Kwality Walls', sales: 23964375 },
  { range: '501-750', brand: 'Vadilal', sales: 0 },
  { range: '751-1000', brand: 'Amul', sales: 914464 },
  { range: '751-1000', brand: 'Vadilal', sales: 5250 },
]

export const quantityRanges = [
  '0-50',
  '51-75',
  '76-100',
  '101-125',
  '101-150',
  '126-150',
  '151-200',
  '201-400',
  '251-500',
  '401-600',
  '501-750',
  '601-800',
  '751-1000',
  '0-100',
  '0-200',
  '0-250',
  '101-200',
  '125+',
  '150+',
]

export const brandsQuantity = [
  'Amul',
  'Baskin Robbins',
  'Cream Bell',
  'Go-Zero',
  'Grameen',
  'Havmor',
  'Hocco',
  'Kwality Walls',
  'Others',
  'Vadilal',
]

// -----------------------------------------------------------------------------
// PRICE DATA
// -----------------------------------------------------------------------------

export const priceRecords = [
  { range: '0-25', brand: 'Amul', sales: 1286650 },
  { range: '0-50', brand: 'Amul', sales: 10674380 },
  { range: '0-50', brand: 'Cream Bell', sales: 8214930 },
  { range: '0-50', brand: "Giani's", sales: 429990 },
  { range: '0-50', brand: 'Havmor', sales: 3827725 },
  { range: '0-50', brand: 'Hocco', sales: 2258350 },
  { range: '0-50', brand: 'Kwality Walls', sales: 15178725 },
  { range: '0-50', brand: 'Vadilal', sales: 3939875 },
  { range: '0-100', brand: 'Baskin Robbins', sales: 31520 },
  { range: '0-100', brand: 'Cream Bell', sales: 0 },
  { range: '0-100', brand: "Giani's", sales: 1400 },
  { range: '0-100', brand: 'Havmor', sales: 0 },
  { range: '0-100', brand: 'Hocco', sales: 639230 },
  { range: '26-50', brand: 'Amul', sales: 1289595 },
  { range: '26-50', brand: 'Cream Bell', sales: 2402890 },
  { range: '26-50', brand: 'Havmor', sales: 1791550 },
  { range: '26-50', brand: 'Hocco', sales: 409105 },
  { range: '26-50', brand: 'Kwality Walls', sales: 1267235 },
  { range: '26-50', brand: 'Vadilal', sales: 4425520 },
  { range: '51-75', brand: 'Amul', sales: 215585 },
  { range: '51-75', brand: 'Baskin Robbins', sales: 1569660 },
  { range: '51-75', brand: "Giani's", sales: 929250 },
  { range: '51-75', brand: 'Grameen', sales: 6312245 },
  { range: '51-75', brand: 'Havmor', sales: 704760 },
  { range: '51-75', brand: 'Hocco', sales: 1059850 },
  { range: '51-75', brand: 'Kwality Walls', sales: 13838980 },
  { range: '51-75', brand: 'Vadilal', sales: 320420 },
  { range: '51-100', brand: 'Amul', sales: 4097660 },
  { range: '51-100', brand: 'Baskin Robbins', sales: 10299379 },
  { range: '51-100', brand: 'Cream Bell', sales: 3180610 },
  { range: '51-100', brand: "Giani's", sales: 5719885 },
  { range: '51-100', brand: 'Havmor', sales: 4121040 },
  { range: '51-100', brand: 'Hocco', sales: 6596474 },
  { range: '51-100', brand: 'Kwality Walls', sales: 15120572 },
  { range: '51-100', brand: 'Vadilal', sales: 4447740 },
  { range: '76-100', brand: 'Amul', sales: 2112970 },
  { range: '76-100', brand: 'Baskin Robbins', sales: 1993975 },
  { range: '76-100', brand: 'Cream Bell', sales: 91360 },
  { range: '76-100', brand: 'Grameen', sales: 1890236 },
  { range: '76-100', brand: 'Hocco', sales: 41040 },
  { range: '76-100', brand: 'Kwality Walls', sales: 3209574 },
  { range: '100+', brand: 'Amul', sales: 264482 },
  { range: '100+', brand: 'Baskin Robbins', sales: 30002 },
  { range: '100+', brand: 'Cream Bell', sales: 93400 },
  { range: '100+', brand: 'Go-Zero', sales: 6972259 },
  { range: '100+', brand: 'Grameen', sales: 809430 },
  { range: '100+', brand: 'Hocco', sales: 145870 },
  { range: '100+', brand: 'Kwality Walls', sales: 552300 },
  { range: '101-150', brand: 'Amul', sales: 255840 },
  { range: '101-150', brand: 'Baskin Robbins', sales: 1115475 },
  { range: '101-150', brand: 'Cream Bell', sales: 50150 },
  { range: '101-150', brand: 'Go-Zero', sales: 5706697 },
  { range: '101-150', brand: 'Havmor', sales: 97730 },
  { range: '101-150', brand: 'Hocco', sales: 3993000 },
  { range: '101-150', brand: 'Kwality Walls', sales: 303360 },
  { range: '101-150', brand: 'Vadilal', sales: 46620 },
  { range: '101-200', brand: 'Amul', sales: 9953825 },
  { range: '101-200', brand: 'Cream Bell', sales: 5794860 },
  { range: '101-200', brand: "Giani's", sales: 9310 },
  { range: '101-200', brand: 'Go-Zero', sales: 2295 },
  { range: '101-200', brand: 'Havmor', sales: 139860 },
  { range: '101-200', brand: 'Hocco', sales: 167050 },
  { range: '101-200', brand: 'Kwality Walls', sales: 20569772 },
  { range: '150+', brand: 'Amul', sales: 394140 },
  { range: '150+', brand: 'Baskin Robbins', sales: 786015 },
  { range: '150+', brand: 'Cream Bell', sales: 250230 },
  { range: '150+', brand: "Giani's", sales: 65800 },
  { range: '150+', brand: 'Go-Zero', sales: 1918129 },
  { range: '150+', brand: 'Grameen', sales: 375399 },
  { range: '150+', brand: 'Havmor', sales: 8400 },
  { range: '150+', brand: 'Hocco', sales: 0 },
  { range: '150+', brand: 'Kwality Walls', sales: 638173 },
  { range: '150+', brand: 'Vadilal', sales: 676260 },
  { range: '201-300', brand: 'Amul', sales: 25641455 },
  { range: '201-300', brand: 'Baskin Robbins', sales: 0 },
  { range: '201-300', brand: 'Cream Bell', sales: 322914 },
  { range: '201-300', brand: "Giani's", sales: 411340 },
  { range: '201-300', brand: 'Havmor', sales: 534900 },
  { range: '201-300', brand: 'Hocco', sales: 2006665 },
  { range: '201-300', brand: 'Kwality Walls', sales: 2714280 },
  { range: '201-300', brand: 'Vadilal', sales: 4506070 },
  { range: '301-400', brand: 'Amul', sales: 429440 },
  { range: '301-400', brand: 'Baskin Robbins', sales: 48136 },
  { range: '301-400', brand: 'Cream Bell', sales: 2290850 },
  { range: '301-400', brand: 'Go-Zero', sales: 4410 },
  { range: '301-400', brand: 'Havmor', sales: 1663140 },
  { range: '301-400', brand: 'Hocco', sales: 632142 },
  { range: '301-400', brand: 'Kwality Walls', sales: 3084581 },
  { range: '301-400', brand: 'Vadilal', sales: 991530 },
  { range: '400+', brand: 'Amul', sales: 486300 },
  { range: '400+', brand: 'Baskin Robbins', sales: 635347 },
  { range: '400+', brand: 'Cream Bell', sales: 0 },
  { range: '400+', brand: "Giani's", sales: 30600 },
  { range: '400+', brand: 'Go-Zero', sales: 472605 },
  { range: '400+', brand: 'Grameen', sales: 0 },
  { range: '400+', brand: 'Havmor', sales: 155673 },
  { range: '400+', brand: 'Kwality Walls', sales: 23950 },
]

export const priceRanges = [
  '0-25',
  '0-50',
  '0-100',
  '26-50',
  '51-75',
  '51-100',
  '76-100',
  '100+',
  '101-150',
  '101-200',
  '150+',
  '201-300',
  '301-400',
  '400+',
]

const brandsPrice = [
  'Amul',
  'Baskin Robbins',
  'Cream Bell',
  "Giani's",
  'Go-Zero',
  'Grameen',
  'Havmor',
  'Hocco',
  'Kwality Walls',
  'Vadilal',
]

// -----------------------------------------------------------------------------
// MAIN COMPONENT — JSX
// -----------------------------------------------------------------------------

export default function CohortHeatmapDemo() {
  const [view, setView] = useState('quantity') // removed TS types
  const [metric, setMetric] = useState('share')
  const [hoverKey, setHoverKey] = useState(null)

  const { rangeOrder, brandOrder, cellMap } = useMemo(() => {
    if (view === 'quantity') {
      return buildMatrix(quantityRecords, quantityRanges, brandsQuantity)
    }
    return buildMatrix(priceRecords, priceRanges, brandsPrice)
  }, [view])

  const maxShare = useMemo(() => {
    let max = 0
    Object.values(cellMap).forEach((c) => {
      if (c.share > max) max = c.share
    })
    return max || 1
  }, [cellMap])

  const maxSales = useMemo(() => {
    let max = 0
    Object.values(cellMap).forEach((c) => {
      if (c.sales > max) max = c.sales
    })
    return max || 1
  }, [cellMap])

  // hot cell (max value)
  const hotCell = useMemo(() => {
    let candidate = null
    brandOrder.forEach((brand) => {
      rangeOrder.forEach((range) => {
        const cell = cellMap[`${range}__${brand}`] || { sales: 0, share: 0 }
        const ratio = metric === 'share' ? cell.share : cell.sales
        if (!candidate || ratio > candidate.ratio) {
          candidate = {
            range,
            brand,
            sales: cell.sales,
            share: cell.share,
            ratio,
          }
        }
      })
    })
    return candidate
  }, [brandOrder, rangeOrder, cellMap, metric])

  const activeCell = useMemo(() => {
    if (hoverKey) {
      const [range, brand] = hoverKey.split('__')
      const cell = cellMap[hoverKey] || { sales: 0, share: 0 }
      return {
        range,
        brand,
        sales: cell.sales,
        share: cell.share,
        ratio: metric === 'share' ? cell.share : cell.sales,
      }
    }
    return hotCell
  }, [cellMap, hotCell, hoverKey, metric])

  const lensText = useMemo(() => {
    if (!activeCell) return 'Hover a cohort cell to see the narrative.'

    if (metric === 'share' && activeCell.share >= 0.55)
      return `${activeCell.brand} is concentrated in ${activeCell.range}. Anchor price-led promos here to defend share.`

    if (metric === 'share' && activeCell.share <= 0.15)
      return `${activeCell.range} is fragmented. Use bundled discovery or partner takeovers to lift ${activeCell.brand}.`

    if (metric === 'sales' && activeCell.sales > 5_000_000)
      return `${activeCell.range} drives outsized ₹ volume. Keep availability high; avoid discounting unless competitors spike.`

    return `${activeCell.brand} has room in ${activeCell.range}. Pair geo cohorts with this range to test elasticity.`
  }, [activeCell, metric])

  const isQuantity = view === 'quantity'

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  return (
    <div className="w-full h-full flex flex-col rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 bg-slate-50">
        <div>
          <div className="text-xs font-semibold text-slate-800">
            Cohort heatmap - {isQuantity ? 'quantity range × brand' : 'price band × brand'}
          </div>
          <div className="text-[11px] text-slate-500">
            Cell color and bar height show {metric === 'share' ? '% of sales within that range' : 'absolute sales index'}.
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <SegmentedControl
            options={[
              { id: 'quantity', label: 'Quantity cohorts' },
              { id: 'price', label: 'Price cohorts' },
            ]}
            value={view}
            onChange={(val) => setView(val)}
          />

          <SegmentedControl
            options={[
              { id: 'share', label: '% within range' },
              { id: 'sales', label: '₹ sales index' },
            ]}
            value={metric}
            onChange={(val) => setMetric(val)}
          />
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="inline-block">
          {/* Column headers */}
          <div className="ml-28 mb-1 flex">
            {rangeOrder.map((range) => (
              <div key={range} className="w-20 text-[10px] text-slate-500 text-center px-1">
                {range}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Row headers */}
            <div className="flex flex-col">
              <div className="h-8 flex items-center justify-end pr-2 text-[10px] text-slate-400">
                Brand
              </div>

              {brandOrder.map((brand) => (
                <div
                  key={brand}
                  className="h-14 flex items-center justify-end pr-2 text-[11px] text-slate-700"
                >
                  {brand}
                </div>
              ))}
            </div>

            {/* Heatmap Matrix */}
            <div className="flex flex-col rounded-2xl bg-slate-50 border border-slate-200 shadow-inner">
              <div className="h-8 flex items-center text-[10px] text-slate-400 pl-2">
                {isQuantity ? 'Quantity range' : 'Price band'}
              </div>

              {brandOrder.map((brand) => (
                <div key={brand} className="flex">
                  {rangeOrder.map((range) => {
                    const cell = cellMap[`${range}__${brand}`] || { sales: 0, share: 0 }

                    const base = metric === 'share' ? cell.share : cell.sales
                    const max = metric === 'share' ? maxShare : maxSales
                    const ratio = max === 0 ? 0 : base / max

                    const bgIntensity = 0.08 + ratio * 0.7
                    const barHeight = 6 + ratio * 30

                    return (
                      <HeatCell
                        key={range}
                        brand={brand}
                        range={range}
                        sales={cell.sales}
                        share={cell.share}
                        bgIntensity={bgIntensity}
                        barHeight={barHeight}
                        metric={metric}
                        isActive={activeCell?.brand === brand && activeCell?.range === range}
                        onHover={() => setHoverKey(`${range}__${brand}`)}
                        onLeave={() => setHoverKey(null)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot + Lens */}
      <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Hotspot card */}
        <div className="lg:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-600 mb-1">
            Hotspot cohort
          </div>

          {activeCell ? (
            <>
              <div className="text-sm font-semibold text-slate-900">
                {activeCell.brand} in {activeCell.range}
              </div>

              <div className="text-xs text-slate-600 mt-1">
                {metric === 'share'
                  ? `${(activeCell.share * 100).toFixed(1)}% of that range`
                  : `₹ ${formatSales(activeCell.sales)}`}
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-700">
                <span className="px-2 py-1 rounded-full bg-white border border-emerald-100">
                  Mode: {metric === 'share' ? '% within range' : '₹ sales index'}
                </span>
                <span className="px-2 py-1 rounded-full bg-white border border-emerald-100">
                  Dataset: {isQuantity ? 'Quantity cohorts' : 'Price cohorts'}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Hover a cell to see details.</div>
          )}
        </div>

        {/* Lens */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-1">
            Suggested lens
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{lensText}</p>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Heat Cell Component (JSX)
// -----------------------------------------------------------------------------

function HeatCell({
  brand,
  range,
  sales,
  share,
  bgIntensity,
  barHeight,
  metric,
  isActive,
  onHover,
  onLeave,
}) {
  const sharePct = (share * 100).toFixed(1)
  const salesDisplay = formatSales(sales)

  const title = `${brand} in ${range}
Sales: ₹ ${salesDisplay}
Share in this range: ${sharePct}%`

  return (
    <motion.div
      className={`w-20 h-14 px-1 py-1 relative group ${
        isActive ? 'drop-shadow-[0_10px_25px_rgba(14,165,233,0.25)]' : ''
      }`}
      title={title}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
    >
      <div
        className={`w-full h-full rounded-xl border ${
          isActive ? 'border-sky-300 bg-white' : 'border-slate-100 bg-slate-100/70'
        } shadow-[0_1px_0_rgba(148,163,184,0.5)] overflow-hidden flex flex-col justify-end`}
      >
        <div className="flex-1 flex items-center justify-center">
          <span className={`text-[9px] font-semibold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
            {metric === 'share' ? `${sharePct}%` : salesDisplay}
          </span>
        </div>

        <div className="h-8 flex items-end justify-center pb-1">
          <div
            className="w-8 rounded-b-md rounded-t-xl shadow-[0_10px_18px_rgba(16,185,129,0.35)] bg-gradient-to-t from-emerald-500 to-emerald-300 group-hover:from-cyan-500 group-hover:to-emerald-300 transition-all"
            style={{
              height: `${barHeight}px`,
              backgroundColor: `rgba(16,185,129,${bgIntensity})`,
              boxShadow: isActive ? '0 8px 20px rgba(14,165,233,0.4)' : undefined,
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// -----------------------------------------------------------------------------
// SegmentedControl (JSX)
// -----------------------------------------------------------------------------

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-slate-200/60 p-0.5">
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition ${
              active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
