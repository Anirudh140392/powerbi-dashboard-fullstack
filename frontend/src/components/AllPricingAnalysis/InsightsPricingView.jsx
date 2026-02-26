// InsightsPricingView.jsx  — real data from rb_pdp_olap
import { useState, useEffect, useCallback, useContext } from 'react';
import { FilterContext } from '../../utils/FilterContext';
import axiosInstance from '../../api/axiosInstance';
import { RefreshCw } from 'lucide-react';

function cn(...c) {
    return c.filter(Boolean).join(' ');
}

/* ─── Tab config ────────────────────────────────────────────────────────── */
const TABS = [
    { key: 'pd_my', label: 'Price Drop (my SKUs)', icon: '↓' },
    { key: 'pi_my', label: 'Price Increase (my SKUs)', icon: '↑' },
    { key: 'pd_comp', label: 'Price Drop (comp. SKUs)', icon: '↓' },
    { key: 'pi_comp', label: 'Price Increase (comp. SKUs)', icon: '↑' },
];

/* ─── Mini components ────────────────────────────────────────────────────── */
function Pill({ children, tone = 'neutral' }) {
    const toneMap = {
        neutral: 'bg-slate-100 text-slate-700 border-slate-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        red: 'bg-rose-50 text-rose-700 border-rose-200',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return (
        <span className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-semibold',
            toneMap[tone]
        )}>
            {children}
        </span>
    );
}

function Delta({ value }) {
    const down = value < 0;
    return (
        <span className={cn(
            'inline-flex items-center gap-1 text-[12px] font-semibold',
            down ? 'text-rose-600' : 'text-emerald-600'
        )}>
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', down ? 'bg-rose-600' : 'bg-emerald-600')} />
            {Math.abs(value).toFixed(1)}%
            <span className="font-medium text-slate-500">{down ? 'down' : 'up'}</span>
        </span>
    );
}

function MiniSkuMark({ brand }) {
    return (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50">
            <div className="text-center">
                <div className="mx-auto h-2 w-7 rounded-full bg-slate-900" />
                <div className="mt-2 text-[10px] font-bold text-slate-700">
                    {String(brand || 'SKU').slice(0, 3).toUpperCase()}
                </div>
            </div>
        </div>
    );
}

function CardSkeleton() {
    return (
        <div className="w-[360px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <div className="h-5 w-24 rounded-full bg-slate-200" />
                        <div className="h-5 w-20 rounded-full bg-slate-100" />
                    </div>
                    <div className="h-3 w-16 rounded bg-slate-100" />
                    <div className="h-4 w-40 rounded bg-slate-200" />
                    <div className="flex gap-2">
                        <div className="h-5 w-14 rounded-full bg-slate-100" />
                        <div className="h-5 w-20 rounded bg-slate-100" />
                    </div>
                </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-4/5 rounded bg-slate-100" />
            </div>
            <div className="mt-3 h-9 w-full rounded-xl bg-slate-100" />
        </div>
    );
}

function InsightCard({ item, tabKey }) {
    const isPriceDrop = tabKey.startsWith('pd_');
    const badgeTone = isPriceDrop ? 'red' : 'green';
    const changeTone = isPriceDrop ? 'emerald' : 'rose';

    return (
        <div className="w-[360px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
                <MiniSkuMark brand={item.brand} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Pill tone={badgeTone}>{item.badge}</Pill>
                        <Pill tone="neutral">Cat: {item.cat}</Pill>
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-slate-500">{item.brand}</div>
                    <div className="mt-1 line-clamp-2 text-[15px] font-semibold text-slate-900 leading-tight">
                        {item.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.size && <Pill tone="blue">{item.size}</Pill>}
                        <Delta value={item.delta} />
                        <span className="text-[11px] text-slate-400">
                            ₹{item.prevSp?.toFixed(0)} → ₹{item.currSp?.toFixed(0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Cities table */}
            {item.cities && item.cities.length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-500">
                        <span>Top impacted cities</span>
                        <span>Discount %</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {item.cities.slice(0, 2).map((c) => (
                            <div key={c.name} className="flex items-center justify-between px-3 py-2">
                                <span className="text-sm font-medium text-slate-800">{c.name}</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {c.discount.toFixed(1)}
                                    {c.change !== 0 && (
                                        <span className={cn(
                                            'ml-2 text-[12px] font-semibold',
                                            changeTone === 'rose' ? 'text-rose-600' : 'text-emerald-600'
                                        )}>
                                            {c.change > 0 ? '+' : ''}{c.change.toFixed(1)}%
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 py-3 text-center text-[12px] text-slate-400">
                    No city breakdown available
                </div>
            )}

            <button className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                Know more →
            </button>
        </div>
    );
}

function TabsHeader({ tabs, counts, active, onChange, loading }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => {
                const a = t.key === active;
                return (
                    <button
                        key={t.key}
                        onClick={() => onChange(t.key)}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                            a
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        )}
                    >
                        <span className="font-semibold">{t.label}</span>
                        <span className={cn(
                            'rounded-full px-2 py-0.5 text-[12px]',
                            a ? 'bg-white/15' : 'bg-slate-100'
                        )}>
                            {loading && a ? '...' : (counts[t.key] ?? 0)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function InsightsPricingView() {
    const {
        platform: globalPlatform,
        selectedCategory,
        selectedLocation,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        datesInitialized,
    } = useContext(FilterContext);

    const [activeTab, setActiveTab] = useState('pd_my');
    const [dataByTab, setDataByTab] = useState({ pd_my: [], pi_my: [], pd_comp: [], pi_comp: [] });
    const [loadingTabs, setLoadingTabs] = useState({ pd_my: true, pi_my: true, pd_comp: true, pi_comp: true });
    const [errors, setErrors] = useState({});

    const buildParams = useCallback(() => {
        const params = {
            _t: Date.now(),
            startDate: timeStart?.format('YYYY-MM-DD'),
            endDate: timeEnd?.format('YYYY-MM-DD'),
            compareStartDate: compareStart?.format('YYYY-MM-DD'),
            compareEndDate: compareEnd?.format('YYYY-MM-DD'),
            limit: 10,
        };
        if (globalPlatform && globalPlatform !== 'All') {
            params.platform = Array.isArray(globalPlatform) ? globalPlatform.join(',') : globalPlatform;
        }
        if (selectedLocation && selectedLocation !== 'All') params.location = selectedLocation;
        if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
        return params;
    }, [globalPlatform, selectedLocation, selectedCategory, timeStart, timeEnd, compareStart, compareEnd]);

    const fetchTab = useCallback(async (tabKey) => {
        if (!datesInitialized) return;
        setLoadingTabs(prev => ({ ...prev, [tabKey]: true }));
        setErrors(prev => ({ ...prev, [tabKey]: null }));
        try {
            const params = { ...buildParams(), type: tabKey };
            console.log(`[InsightsPricingView] fetching tab=${tabKey}`, params);
            const res = await axiosInstance.get('/pricing-analysis/insights', { params });
            if (res.data?.success) {
                setDataByTab(prev => ({ ...prev, [tabKey]: res.data.items || [] }));
            } else {
                setDataByTab(prev => ({ ...prev, [tabKey]: [] }));
            }
        } catch (err) {
            console.error(`[InsightsPricingView] Error tab=${tabKey}:`, err);
            setErrors(prev => ({ ...prev, [tabKey]: err.message }));
            setDataByTab(prev => ({ ...prev, [tabKey]: [] }));
        } finally {
            setLoadingTabs(prev => ({ ...prev, [tabKey]: false }));
        }
    }, [datesInitialized, buildParams]);

    // Fetch all 4 tabs on filter change
    useEffect(() => {
        if (!datesInitialized) return;
        TABS.forEach(t => fetchTab(t.key));
    }, [datesInitialized, buildParams]);

    const counts = Object.fromEntries(TABS.map(t => [t.key, dataByTab[t.key]?.length || 0]));
    const currentData = dataByTab[activeTab] || [];
    const isLoading = loadingTabs[activeTab];
    const currentError = errors[activeTab];

    return (
        <div className="w-full bg-slate-50 p-6">
            <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-xl font-bold text-slate-900">Insights</div>
                        <div className="mt-1 text-sm text-slate-600">Pricing signals across your SKUs &amp; competitors</div>
                    </div>
                    <button
                        onClick={() => TABS.forEach(t => fetchTab(t.key))}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={12} className={Object.values(loadingTabs).some(Boolean) ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Tabs */}
                <TabsHeader
                    tabs={TABS}
                    counts={counts}
                    active={activeTab}
                    onChange={(key) => {
                        setActiveTab(key);
                        // Lazy-fetch if no data yet
                        if (!dataByTab[key]?.length && !loadingTabs[key]) {
                            fetchTab(key);
                        }
                    }}
                    loading={isLoading}
                />

                {/* Error */}
                {currentError && (
                    <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                        Failed to load: {currentError}
                        <button onClick={() => fetchTab(activeTab)} className="ml-3 font-semibold underline">Retry</button>
                    </div>
                )}

                {/* Content rail */}
                <div className="mt-2 overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-3">
                        {isLoading
                            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
                            : currentData.length > 0
                                ? currentData.map((item) => (
                                    <InsightCard key={item.id} item={item} tabKey={activeTab} />
                                ))
                                : (
                                    <div className="flex items-center justify-center w-full min-w-[600px] py-12 text-slate-400 text-sm">
                                        <div className="text-center">
                                            <div className="text-4xl mb-3">📊</div>
                                            <div className="font-semibold text-slate-600">No price changes detected</div>
                                            <div className="mt-1 text-xs">No SKUs with significant price movement in the selected period</div>
                                        </div>
                                    </div>
                                )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}