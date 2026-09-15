/**
 * Period Filter Utilities
 * Provides date range calculation and review filtering by period
 */

import type { PeriodKey, PeriodConfig } from '../types';
import { PERIOD_OPTIONS } from '../types';

/**
 * Get period configuration by key
 */
export const getPeriodConfig = (periodKey: PeriodKey): PeriodConfig => {
    return PERIOD_OPTIONS.find(p => p.key === periodKey) || PERIOD_OPTIONS[2]; // Default to 12M
};

/**
 * Calculate start and end dates for a given period
 */
export const getDateRangeForPeriod = (periodKey: PeriodKey): { start: Date; end: Date } => {
    const end = new Date();
    const start = new Date();

    const config = getPeriodConfig(periodKey);

    if (config.months === null) {
        // MAX: Return a very old date to include all data
        start.setFullYear(start.getFullYear() - 50);
    } else {
        start.setMonth(start.getMonth() - config.months);
    }

    return { start, end };
};

/**
 * Get comparison range for delta calculations
 * - For MAX: Compare (Max - 6 months) with (latest 6 months)
 * - For other periods: Compare current period with previous equivalent period
 */
export const getComparisonRange = (periodKey: PeriodKey): {
    currentRange: { start: Date; end: Date };
    previousRange: { start: Date; end: Date };
    comparisonMonths: number;
} => {
    const now = new Date();

    if (periodKey === 'MAX') {
        // For MAX: Current = latest 6 months, Previous = everything before that
        const currentStart = new Date();
        currentStart.setMonth(currentStart.getMonth() - 6);

        const previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);

        const previousStart = new Date();
        previousStart.setFullYear(previousStart.getFullYear() - 50);

        return {
            currentRange: { start: currentStart, end: now },
            previousRange: { start: previousStart, end: previousEnd },
            comparisonMonths: 6
        };
    }

    const config = getPeriodConfig(periodKey);
    const months = config.months || 12;

    // Current period
    const currentStart = new Date();
    currentStart.setMonth(currentStart.getMonth() - months);

    // Previous period (same duration, immediately before current)
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);

    const previousStart = new Date(previousEnd);
    previousStart.setMonth(previousStart.getMonth() - months);

    return {
        currentRange: { start: currentStart, end: now },
        previousRange: { start: previousStart, end: previousEnd },
        comparisonMonths: months
    };
};

/**
 * Parse date from review (handles various formats)
 */
const parseReviewDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    // Try parsing as ISO date or common formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // Try DD-MM-YYYY format
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        if (day && month && year) {
            return new Date(year, month - 1, day);
        }
    }

    return null;
};

/**
 * Filter reviews by period
 */
export const filterReviewsByPeriod = <T extends { date: string }>(
    reviews: T[],
    periodKey: PeriodKey
): T[] => {
    const { start, end } = getDateRangeForPeriod(periodKey);

    return reviews.filter(review => {
        const reviewDate = parseReviewDate(review.date);
        if (!reviewDate) return true; // Include reviews with invalid dates
        return reviewDate >= start && reviewDate <= end;
    });
};

/**
 * Calculate comparison metrics between current and previous periods
 */
export const calculatePeriodComparison = <T extends { date: string; sentiment?: string; rating?: number }>(
    reviews: T[],
    periodKey: PeriodKey
): {
    currentCount: number;
    previousCount: number;
    countDelta: number;
    currentPositiveRate: number;
    previousPositiveRate: number;
    positiveDelta: number;
    currentAvgRating: number;
    previousAvgRating: number;
    ratingDelta: number;
} => {
    const { currentRange, previousRange } = getComparisonRange(periodKey);

    const currentReviews = reviews.filter(r => {
        const date = parseReviewDate(r.date);
        return date && date >= currentRange.start && date <= currentRange.end;
    });

    const previousReviews = reviews.filter(r => {
        const date = parseReviewDate(r.date);
        return date && date >= previousRange.start && date <= previousRange.end;
    });

    const calcPositiveRate = (revs: T[]) => {
        if (revs.length === 0) return 0;
        const positive = revs.filter(r =>
            r.sentiment?.toUpperCase() === 'POSITIVE' ||
            r.sentiment === 'Positive'
        ).length;
        return Math.round((positive / revs.length) * 100);
    };

    const calcAvgRating = (revs: T[]) => {
        if (revs.length === 0) return 0;
        const sum = revs.reduce((acc, r) => acc + (r.rating || 0), 0);
        return Math.round((sum / revs.length) * 10) / 10;
    };

    const currentPositiveRate = calcPositiveRate(currentReviews);
    const previousPositiveRate = calcPositiveRate(previousReviews);
    const currentAvgRating = calcAvgRating(currentReviews);
    const previousAvgRating = calcAvgRating(previousReviews);

    return {
        currentCount: currentReviews.length,
        previousCount: previousReviews.length,
        countDelta: currentReviews.length - previousReviews.length,
        currentPositiveRate,
        previousPositiveRate,
        positiveDelta: currentPositiveRate - previousPositiveRate,
        currentAvgRating,
        previousAvgRating,
        ratingDelta: Math.round((currentAvgRating - previousAvgRating) * 10) / 10
    };
};

/**
 * Format date range for display
 */
export const formatDateRange = (periodKey: PeriodKey): string => {
    const { start, end } = getDateRangeForPeriod(periodKey);

    if (periodKey === 'MAX') {
        return 'All Time';
    }

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
    });

    return `${formatDate(start)} - ${formatDate(end)}`;
};
