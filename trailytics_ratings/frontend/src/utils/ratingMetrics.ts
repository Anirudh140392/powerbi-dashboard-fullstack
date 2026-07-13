import type { RatingMetrics } from '../types/ratingMetrics';

type ReviewLike = {
    rating?: number | null;
    mlInferredRating?: number | null;
    ml_inferred_rating?: number | null;
    actualProductRating?: number | null;
    pdpRating?: number | null;
    pdpPlatformRating?: number | null;
    pdp_rating?: number | null;
    totalRatingCount?: number | null;
    pdpRatingCount?: number | null;
    pdpTotalRatingCount?: number | null;
    pdp_rating_count?: number | null;
    rating_count?: number | null;
    review_count?: number | null;
    asin?: string | null;
    web_pid?: string | null;
    product?: string | null;
    productName?: string | null;
    platform?: string | null;
};

export function createRatingMetrics(input: Partial<RatingMetrics>): RatingMetrics {
    return {
        pdp_rating: normalizeDecimal(input.pdp_rating),
        user_rating: normalizeDecimal(input.user_rating),
        ml_rating: normalizeDecimal(input.ml_rating),
        review_count: normalizeCount(input.review_count),
        rating_count: normalizeCount(input.rating_count),
    };
}

export function buildRatingMetricsFromReviews<T extends ReviewLike>(reviews: T[]): RatingMetrics {
    if (!reviews.length) {
        return createRatingMetrics({
            pdp_rating: null,
            user_rating: null,
            ml_rating: null,
            review_count: 0,
            rating_count: 0,
        });
    }

    const skuMetrics = new Map<string, { pdpRating: number | null; ratingCount: number }>();
    let userSum = 0;
    let userCount = 0;
    let mlSum = 0;
    let mlCount = 0;

    for (const review of reviews) {
        const rating = normalizeNumberish(review.rating);
        if (rating !== null) {
            userSum += rating;
            userCount += 1;
        }

        const mlRating = normalizeNumberish(review.mlInferredRating ?? review.ml_inferred_rating);
        if (mlRating !== null) {
            mlSum += mlRating;
            mlCount += 1;
        }

        const skuKey = [
            review.platform || 'unknown-platform',
            review.web_pid || review.asin || review.productName || review.product || 'unknown-product',
        ].join('::');

        const pdpRating = normalizeNumberish(
            review.pdpPlatformRating
            ?? review.pdpRating
            ?? review.actualProductRating
            ?? review.pdp_rating,
        );
        const ratingCount = normalizeCount(
            review.pdpTotalRatingCount
            ?? review.pdpRatingCount
            ?? review.totalRatingCount
            ?? review.pdp_rating_count
            ?? review.rating_count,
        );

        if (!skuMetrics.has(skuKey)) {
            skuMetrics.set(skuKey, { pdpRating, ratingCount });
            continue;
        }

        const current = skuMetrics.get(skuKey)!;
        if (ratingCount > current.ratingCount) {
            skuMetrics.set(skuKey, { pdpRating, ratingCount });
        } else if (current.pdpRating === null && pdpRating !== null) {
            skuMetrics.set(skuKey, { pdpRating, ratingCount: current.ratingCount });
        }
    }

    let weightedPdp = 0;
    let weightedRatings = 0;
    let pdpFallbackSum = 0;
    let pdpFallbackCount = 0;
    let totalRatingCount = 0;

    skuMetrics.forEach(metric => {
        totalRatingCount += metric.ratingCount;
        if (metric.pdpRating === null) return;
        if (metric.ratingCount > 0) {
            weightedPdp += metric.pdpRating * metric.ratingCount;
            weightedRatings += metric.ratingCount;
            return;
        }

        pdpFallbackSum += metric.pdpRating;
        pdpFallbackCount += 1;
    });

    const pdpRating = weightedRatings > 0
        ? weightedPdp / weightedRatings
        : (pdpFallbackCount > 0 ? pdpFallbackSum / pdpFallbackCount : null);

    return createRatingMetrics({
        pdp_rating: pdpRating,
        user_rating: userCount > 0 ? userSum / userCount : null,
        ml_rating: mlCount > 0 ? mlSum / mlCount : null,
        review_count: reviews.length,
        rating_count: totalRatingCount,
    });
}

export function formatRatingValue(value: number | null, decimals = 1): string {
    if (value === null || Number.isNaN(value)) return '-';
    return value.toFixed(decimals);
}

export function formatCountValue(value: number): string {
    return value.toLocaleString('en-IN');
}

export function formatCompactCountValue(value: number): string {
    return new Intl.NumberFormat('en-IN', {
        notation: 'compact',
        maximumFractionDigits: value >= 100000 ? 1 : 0,
    }).format(value);
}

function normalizeNumberish(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDecimal(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
}

function normalizeCount(value: number | null | undefined): number {
    if (value === null || value === undefined || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
}
