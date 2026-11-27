import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, LayoutGrid, LineChart, Table2 } from 'lucide-react'
import { cn } from '../../../lib/utils'

const layouts = [
    { key: 'table', label: 'Table', icon: <Table2 size={14} /> },
    { key: 'cards', label: 'Scorecards', icon: <LayoutGrid size={14} /> },
]

function BrandHeading({ brand, onTrend }) {
    const [failedLogo, setFailedLogo] = useState(null)
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 text-xs font-bold text-slate-600">
                {brand.logoSrc && failedLogo !== brand.logoSrc ? (
                    <img src={brand.logoSrc} alt="" className="max-h-full max-w-full object-contain" onError={() => setFailedLogo(brand.logoSrc)} />
                ) : brand.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-slate-900" title={brand.name}>{brand.name}</span>
            {onTrend && <button type="button" onClick={() => onTrend(brand.name)} aria-label={`View ${brand.name} trend`} title={`View ${brand.name} trend`}
                className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700">
                <LineChart size={15} />
            </button>}
        </div>
    )
}

function BrandMetric({ brand, kpi, getFullValue, onCopy }) {
    const cell = brand.data[kpi.key]
    const fullValue = getFullValue(kpi.metricKey || kpi.key, cell)
    if (fullValue === 'N/A') return <span className="text-sm text-slate-400">N/A</span>

    const change = cell.delta
    return (
        <button type="button" onClick={() => onCopy(`${brand.name} ${kpi.label}`, fullValue)}
            title={`Copy ${brand.name} ${kpi.label} · ${fullValue}`}
            className="inline-flex flex-col items-end gap-0.5 rounded px-1 text-right tabular-nums hover:bg-blue-50 focus-visible:outline-blue-600">
            <span className="whitespace-nowrap text-sm font-semibold text-slate-900">{cell.value}</span>
            <span className={cn('whitespace-nowrap text-[11px] font-medium text-slate-500',
                change?.dir === 'up' && 'text-emerald-700', change?.dir === 'down' && 'text-rose-700')}>
                {change?.dir === 'up' && '↑ '}{change?.dir === 'down' && '↓ '}{change?.value ?? '—'}
            </span>
        </button>
    )
}

export default function BrandKpiViews({ entityLabel = 'Brand', brands, count, kpis, columns, platforms, collapsedPlatforms, onTogglePlatform, layout, onLayoutChange, sortConfig, onSort, onTrend, onCopy, getFullValue, comparison }) {
    const plural = entityLabel.toLowerCase().replace(/y$/, 'ie') + 's'
    const divider = 'border-l border-l-slate-300 shadow-[inset_5px_0_0_0_#f1f5f9]'
    const columnDivider = index => index > 0 && columns[index].platform !== columns[index - 1].platform && divider
    const isPlatformCollapsed = platform => collapsedPlatforms[platform] !== false
    return (
        <section aria-label={`${entityLabel} KPI comparison`} className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="m-0 text-sm font-semibold text-slate-900">{count} {count === 1 ? entityLabel.toLowerCase() : plural}</h3>
                    {platforms && <p className="m-0 mt-0.5 text-xs font-medium text-slate-700">{platforms.join(' · ')}</p>}
                    {comparison && <p className="m-0 mt-0.5 text-xs text-slate-500">Change vs {comparison}</p>}
                </div>
                <div role="group" aria-label={`${entityLabel} layout`} className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                    {layouts.map(({ key, label, icon }) => (
                        <button type="button" key={key} aria-pressed={layout === key} onClick={() => onLayoutChange(key)}
                            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                                layout === key ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white')}>
                            {icon}{label}
                        </button>
                    ))}
                </div>
            </div>
            {kpis.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-600">Select KPIs in Filters to compare {plural}.</p>
            ) : layout === 'table' ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-separate border-spacing-0" aria-label={`Selected KPIs by ${entityLabel.toLowerCase()}`}>
                        <thead className="bg-slate-50">
                            {platforms && (
                                <tr>
                                    <th rowSpan={2} scope="col" className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-600 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.25)]">{entityLabel}</th>
                                    {platforms.map((platform, index) => (
                                        <th key={platform} colSpan={columns.filter(column => column.platform === platform).length} scope="colgroup" className={cn("border-b border-b-slate-200 bg-blue-50/60 px-3 py-2 text-center text-xs font-semibold text-slate-800 capitalize", index > 0 && divider)}>
                                            <button type="button" aria-expanded={!isPlatformCollapsed(platform)}
                                                aria-label={`${isPlatformCollapsed(platform) ? 'Expand' : 'Collapse'} ${platform} KPIs`}
                                                onClick={() => onTogglePlatform(platform)}
                                                className="inline-flex items-center gap-1.5 rounded px-2 py-1 capitalize hover:bg-blue-100 focus-visible:outline-blue-600">
                                                {platform}<ChevronDown size={13} aria-hidden="true" className={cn('transition-transform', isPlatformCollapsed(platform) && '-rotate-90')} />
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            )}
                            <tr>
                                {!platforms && <th scope="col" className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold text-slate-600 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.25)]">{entityLabel}</th>}
                                {columns.map((kpi, index) => {
                                    const active = sortConfig.key === kpi.key
                                    const ascending = sortConfig.direction === 'asc'
                                    const SortIcon = active ? (ascending ? ArrowUp : ArrowDown) : ArrowUpDown
                                    return (
                                        <th key={kpi.key} scope="col" aria-sort={active ? (ascending ? 'ascending' : 'descending') : undefined}
                                            className={cn("px-3 py-2 text-right", columnDivider(index))}>
                                            <button type="button" onClick={() => onSort(kpi.key)} aria-label={`Sort by ${kpi.label}`}
                                                className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded py-1 text-xs font-semibold hover:text-blue-700', active ? 'text-blue-700' : 'text-slate-600')}>
                                                {kpi.metricLabel || kpi.label}<SortIcon size={12} />
                                            </button>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {brands.map(brand => (
                                <tr key={brand.key} className="group hover:bg-blue-50/30">
                                    <th scope="row" className="sticky left-0 z-10 w-44 min-w-36 max-w-48 border-t border-r border-slate-200 bg-white px-3 py-2 text-left sm:min-w-48 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.25)]">
                                        <BrandHeading brand={brand} onTrend={platforms ? undefined : onTrend} />
                                    </th>
                                    {columns.map((kpi, index) => (
                                        <td key={kpi.key} className={cn("min-w-28 border-t border-t-slate-100 px-3 py-2 text-right", columnDivider(index))}>
                                            <BrandMetric brand={brand} kpi={kpi} onCopy={onCopy} getFullValue={getFullValue} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 21rem), 1fr))' }}>
                    {brands.map(brand => (
                        <article key={brand.key} aria-label={brand.name} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                                <BrandHeading brand={brand} onTrend={platforms ? undefined : onTrend} />
                            </header>
                            {platforms ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-separate border-spacing-0" aria-label={`${brand.name} platform comparison`}>
                                        <thead>
                                            <tr className="text-xs text-slate-500">
                                                <th scope="col" className="sticky left-0 z-10 bg-white px-3 py-2 text-left">KPI</th>
                                                {platforms.map(platform => <th key={platform} scope="col" className="px-3 py-2 text-right">{platform}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {kpis.map(kpi => (
                                                <tr key={kpi.key}>
                                                    <th scope="row" className="sticky left-0 z-10 border-t border-slate-100 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600">{kpi.label}</th>
                                                    {columns.filter(column => column.metricKey === kpi.key).map(column => (
                                                        <td key={column.key} className="border-t border-slate-100 px-3 py-2 text-right">
                                                            <BrandMetric brand={brand} kpi={column} onCopy={onCopy} getFullValue={getFullValue} />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <dl className="m-0 grid grid-cols-2 gap-px bg-slate-100">
                                {kpis.map(kpi => (
                                    <div key={kpi.key} className="flex flex-col items-end gap-1 bg-white px-4 py-2.5">
                                        <dt className="self-start text-xs font-medium text-slate-500">{kpi.label}</dt>
                                        <dd className="m-0"><BrandMetric brand={brand} kpi={kpi} onCopy={onCopy} getFullValue={getFullValue} /></dd>
                                    </div>
                                ))}
                            </dl>}
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}
