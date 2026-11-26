import React, { useContext, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, ChartNoAxesColumn, ChevronDown, Columns3, LoaderCircle, X } from 'lucide-react';
import dayjs from 'dayjs';
import axiosInstance from '../../api/axiosInstance';
import { FilterContext } from '../../utils/FilterContext';

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const periodLabel = (start, end) =>
  `${dayjs(start).format('D MMM YY')} – ${dayjs(end).format('D MMM YY')}`;

function comparisonQuery(filters, dimension, selection) {
  const params = new URLSearchParams({ viewMode: `${dimension}CrossPlatform`, platform: 'All' });
  const scopedFilters = { ...filters, [dimension === 'City' ? 'location' : 'category']: selection };
  for (const key of ['brand', 'category', 'location', 'zone', 'metroFlag', 'pincode', 'keyword', 'keywordType',
    'rank', 'channel', 'startDate', 'endDate', 'compareStartDate', 'compareEndDate']) {
    const value = scopedFilters[key];
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item != null && item !== '') params.append(key, item);
    }
  }
  return params.toString();
}

function PlatformCard({ platform, rows, logo }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
          <span aria-hidden="true">{platform.slice(0, 2).toUpperCase()}</span>
          {logo && <img src={logo} alt="" className="absolute inset-0 size-full bg-white object-contain" onError={e => { e.currentTarget.hidden = true; }} />}
        </span>
        <h3 className="m-0 break-words text-sm font-bold text-slate-900">{platform}</h3>
      </div>
      <dl className="m-0 divide-y divide-slate-100 px-4">
        {rows.map(row => {
          const value = row[platform];
          const delta = row.trend?.[platform];
          const tone = delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-500';
          return (
            <div key={row.kpi} className="py-3">
              <dt className="text-xs font-semibold text-slate-600">{row.kpi}</dt>
              <dd className="mt-1 mb-0 flex flex-wrap items-baseline justify-between gap-x-2 tabular-nums">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  {value == null ? '—' : `${number.format(value)}%`}
                </span>
                <span className={`text-xs font-semibold ${tone}`} title={delta == null ? 'Comparison unavailable' : 'Change in percentage points'}>
                  {delta == null ? '—' : `${delta > 0 ? '+' : ''}${number.format(delta)} pp`}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function ComparisonResults({ query }) {
  const { platformMetadata = [] } = useContext(FilterContext);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    axiosInstance.get(`/visibility-analysis/platform-kpi-matrix?${query}`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setData(response.data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [query, attempt]);

  if (failed) return (
    <div role="alert" className="py-10 text-center text-sm text-slate-600">
      Couldn’t load the platform comparison.
      <button type="button" className="ml-2 font-semibold text-indigo-700 underline" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Try again</button>
    </div>
  );
  if (!data) return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
      <LoaderCircle size={17} className="animate-spin" /> Loading comparison…
    </div>
  );

  const platforms = data.platformData.columns.slice(1);
  const { period } = data;
  if (!platforms.length) return <p role="status" className="py-10 text-center text-sm text-slate-600">No platform data for this selection and period.</p>;
  return (
    <>
      {period && (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
          <CalendarDays size={15} aria-hidden="true" />
          <strong>{periodLabel(period.startDate, period.endDate)}</strong>
          <span>vs. {periodLabel(period.compareStartDate, period.compareEndDate)}</span>
        </div>
      )}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,185px),1fr))]">
        {platforms.map(platform => (
          <PlatformCard key={platform} platform={platform} rows={data.platformData.rows}
            logo={platformMetadata.find(meta => meta.pf_name?.toLowerCase() === platform.toLowerCase())?.platform_description} />
        ))}
      </div>
    </>
  );
}

export default function VisibilityPlatformComparison({ dimension, options, filters }) {
  const [selected, setSelected] = useState('');
  const selection = options.includes(selected) ? selected : options[0];
  const query = comparisonQuery(filters, dimension, selection);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="inline-flex min-h-6 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-2 py-1 text-xs font-bold text-white shadow-sm shadow-indigo-900/20 transition-colors hover:bg-indigo-700 active:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <Columns3 size={13} strokeWidth={2} aria-hidden="true" /> Cross Platform
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[10000] bg-slate-950/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[10001] flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white bg-white text-slate-900 shadow-2xl">
          <header className="flex items-start gap-3 px-5 pt-5 sm:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><ChartNoAxesColumn size={21} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="m-0 text-lg font-bold tracking-tight">Cross-platform visibility</Dialog.Title>
              <Dialog.Description className="mt-1 mb-0 text-xs text-slate-600">Share of search and change in percentage points by platform.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close comparison" className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-indigo-600"><X size={18} /></Dialog.Close>
          </header>
          {selection && <label className="mx-5 my-4 flex min-w-0 items-center gap-3 text-sm font-semibold sm:mx-6">
            <span className="shrink-0">{dimension === 'City' ? 'Tier 1 city' : dimension}</span>
            <span className="relative inline-flex min-w-0">
              <select value={selection} onChange={e => setSelected(e.target.value)} className="h-10 min-w-0 max-w-full appearance-none truncate rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-sm text-slate-900 focus-visible:outline-indigo-600">
                {options.map(option => <option key={option}>{option}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" />
            </span>
          </label>}
          <div className="min-h-0 overflow-y-auto overscroll-contain border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
            {selection ? <ComparisonResults key={query} query={query} /> : (
              <p role="status" className="m-0 py-6 text-center text-sm text-slate-600">No Tier 1 cities match the current filters and period.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
