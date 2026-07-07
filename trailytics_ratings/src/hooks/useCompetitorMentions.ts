import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/auth';
import { resolveCompanyId } from '../utils/tenant';
import { RATINGS_API_BASE } from '../config/apiBase';

export interface ServerCompetitorMention {
    id: number;
    reviewId: string;
    brand: string;
    context: string;
    sentiment: 'Positive' | 'Negative' | 'Neutral';
    isFavorable: boolean;
    reviewDate: string | null;
    reviewRating: number | null;
    webPid: string | null;
    platform: string | null;
}

export interface ServerBrandSummary {
    brand: string;
    total: number;
    favorable: number;
    unfavorable: number;
    neutral: number;
    favorableRate: number;
}

export interface CompetitorMentionsResponse {
    total: number;
    byBrand: ServerBrandSummary[];
    sample: ServerCompetitorMention[];
}

interface Options {
    brand?: string;
    platform?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
}

export function useCompetitorMentions(opts: Options = {}) {
    const [data, setData] = useState<CompetitorMentionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const companyId = resolveCompanyId();
        const backendUrl = RATINGS_API_BASE;
        const q = new URLSearchParams({ company_id: companyId });
        if (opts.brand)    q.set('brand', opts.brand);
        if (opts.platform) q.set('platform', opts.platform);
        if (opts.dateFrom) q.set('date_from', opts.dateFrom);
        if (opts.dateTo)   q.set('date_to', opts.dateTo);
        if (opts.limit)    q.set('limit', String(opts.limit));

        let cancelled = false;
        setLoading(true);
        authenticatedFetch(`${backendUrl}/api/ratings/competitor-mentions?${q.toString()}`, {}, companyId)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(j => { if (!cancelled) { setData(j); setError(null); } })
            .catch(e => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [opts.brand, opts.platform, opts.dateFrom, opts.dateTo, opts.limit]);

    return { data, loading, error };
}
