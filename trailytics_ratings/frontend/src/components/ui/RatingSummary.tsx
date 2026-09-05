import React from 'react';
import { BarChart3, MessageSquare, Sparkles, Star } from 'lucide-react';
import type { RatingMetrics } from '../../types/ratingMetrics';
import { formatCompactCountValue, formatCountValue, formatRatingValue } from '../../utils/ratingMetrics';
import { getActiveBrandName } from '../../utils/tenant';

type RatingSummaryInlineProps = {
    metrics: RatingMetrics | null;
    className?: string;
    compact?: boolean;
    title?: string;
};

type RatingSummaryCompareProps = {
    ownMetrics: RatingMetrics;
    competitorMetrics: RatingMetrics | null;
    ownLabel?: string;
    competitorLabel?: string;
    comparisonTitle?: string;
    className?: string;
    compact?: boolean;
};

// Unified palette: flat slate surface for every metric.
// Color information moves to the icon glyph only — a small amber star for PDP,
// indigo star for User, emerald sparkle for ML — so the chip itself stops shouting.
const SURFACE_TONES = {
    pdp:     { card: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-200', icon: 'text-amber-500' },
    ml:      { card: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-200', icon: 'text-emerald-500' },
    user:    { card: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-200', icon: 'text-indigo-500' },
    neutral: { card: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-200', icon: 'text-slate-400 dark:text-slate-500' },
} as const;

function SummaryValue({
    label,
    value,
    icon: Icon,
    tone,
    large = false,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    tone: keyof typeof SURFACE_TONES;
    large?: boolean;
}) {
    return (
        <div className={`rounded-xl border px-2 py-1.5 ${SURFACE_TONES[tone].card}`}>
            <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider opacity-80">
                <Icon size={10} className={Icon === Star ? `fill-current ${SURFACE_TONES[tone].icon}` : SURFACE_TONES[tone].icon} />
                <span>{label.replace(' Rating', '')}</span>
            </div>
            <div className={`mt-0.5 font-bold leading-none ${large ? 'text-lg' : 'text-base'}`}>
                {value}
            </div>
        </div>
    );
}

function SummaryMini({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
}) {
    return (
        <div className={`rounded-lg border px-1.5 py-1 ${SURFACE_TONES.neutral.card}`}>
            <div className="flex items-center gap-1 text-[8px] font-medium text-slate-500 dark:text-slate-400">
                <Icon size={9} className={Icon === Star ? `fill-current ${SURFACE_TONES.neutral.icon}` : SURFACE_TONES.neutral.icon} />
                <span>{label.replace(' Rating', '')}</span>
            </div>
            <div className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                {value}
            </div>
        </div>
    );
}

function DenseRatingSummary({
    metrics,
    className = '',
}: {
    metrics: RatingMetrics | null;
    className?: string;
}) {
    const pdpValue = formatRatingValue(metrics?.pdp_rating ?? null);
    const mlValue = formatRatingValue(metrics?.ml_rating ?? null);
    const userValue = formatRatingValue(metrics?.user_rating ?? null);
    const reviewValue = formatCompactCountValue(metrics?.review_count ?? 0);
    const ratingValue = formatCompactCountValue(metrics?.rating_count ?? 0);

    return (
        <div className={`rounded-xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/65 ${className}`.trim()}>
            <div className="grid grid-cols-2 gap-1.5">
                <SummaryValue label="PDP" value={pdpValue} icon={Star} tone="pdp" large />
                <SummaryValue label="ML" value={mlValue} icon={Sparkles} tone="ml" large />
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <SummaryMini label="User" value={userValue} icon={Star} />
                <SummaryMini label="Reviews" value={reviewValue} icon={MessageSquare} />
                <SummaryMini label="Ratings" value={ratingValue} icon={BarChart3} />
            </div>
        </div>
    );
}

function Chip({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    tone: keyof typeof SURFACE_TONES;
}) {
    return (
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium ${SURFACE_TONES[tone].card}`}>
            <Icon size={11} className={Icon === Star ? `fill-current ${SURFACE_TONES[tone].icon}` : SURFACE_TONES[tone].icon} />
            <span className="opacity-80">{label}</span>
            <span className="font-semibold opacity-100">{value}</span>
        </div>
    );
}

export const RatingSummaryInline: React.FC<RatingSummaryInlineProps> = ({
    metrics,
    className = '',
    compact = true,
}) => {
    if (compact) {
        return <DenseRatingSummary metrics={metrics} className={className} />;
    }

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
            <Chip label="PDP Rating" value={formatRatingValue(metrics?.pdp_rating ?? null)} icon={Star} tone="pdp" />
            <Chip label="User Rating" value={formatRatingValue(metrics?.user_rating ?? null)} icon={Star} tone="user" />
            <Chip label="ML Rating" value={formatRatingValue(metrics?.ml_rating ?? null)} icon={Sparkles} tone="ml" />
            <Chip label="Review Count" value={formatCountValue(metrics?.review_count ?? 0)} icon={MessageSquare} tone="neutral" />
            <Chip label="Rating Count" value={formatCountValue(metrics?.rating_count ?? 0)} icon={BarChart3} tone="neutral" />
        </div>
    );
};

export const RatingSummaryCompare: React.FC<RatingSummaryCompareProps> = ({
    ownMetrics,
    competitorMetrics,
    ownLabel = getActiveBrandName(),
    competitorLabel = 'Competitor',
    comparisonTitle,
    className = '',
    compact = true,
}) => {
    return (
        <div className={`rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/65 ${className}`.trim()}>
            {comparisonTitle ? (
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {comparisonTitle}
                </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <div className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{ownLabel}</div>
                    <RatingSummaryInline metrics={ownMetrics} compact={compact} title={ownLabel} />
                </div>
                <div className="space-y-2">
                    <div className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{competitorLabel}</div>
                    {competitorMetrics ? (
                        <RatingSummaryInline metrics={competitorMetrics} compact={compact} title={competitorLabel} />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/70 px-4 py-6 text-sm text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-500">
                            No competitor data in this slice
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RatingSummaryInline;
