/**
 * tooltipDefinitions.ts
 * Single source of truth for all component help-text shown via InfoTooltip.
 * Keyed by a stable ID so components reference a key, not inline text.
 * Add / edit definitions here without touching component files.
 */

export interface TooltipDef {
    title: string;
    body: string;
    /** Optional bullet-point list for multi-line explanations */
    bullets?: string[];
}

export const TOOLTIPS: Record<string, TooltipDef> = {

    // ── Executive Summary ─────────────────────────────────────────────────────
    executiveSummary: {
        title: 'Executive Summary',
        body: 'High-level health overview of your entire product portfolio. Segmented by classification (Pareto / Non-Pareto / NPD) and further broken down by platform rating quality.',
    },

    // ── Product Category Cards Strip ──────────────────────────────────────────
    productCategories: {
        title: 'Product Categories',
        body: 'Your SKU range organised by product type (e.g. Pressure Cooker, Induction Cooktop). Click any card to scope the entire dashboard to that category.',
        bullets: [
            'SKU count = unique products with reviews in this category',
            '⭐ = weighted average platform (PDP) rating',
            '↑/↓ % = review volume growth (selected period split in half)',
            'P / NP / NPD pills = Pareto classification breakdown',
        ],
    },

    // ── Pareto Bucket Card ────────────────────────────────────────────────────
    paretoCard: {
        title: 'Pareto SKUs',
        body: 'High-value products that drive the majority of your revenue and rating volume (the "vital few"). Any quality issue here has direct, outsized impact on brand perception and revenue.',
        bullets: [
            'Defined by the master SKU classification sheet',
            'Platform rating ≥ 4.2 = No Problem (NP)',
            'Platform rating 4.0–4.2 = No Issue (NI)',
            'Platform rating < 4.0 = Issue — requires immediate attention',
        ],
    },

    // ── Non-Pareto Bucket Card ────────────────────────────────────────────────
    nonParetoCard: {
        title: 'Non-Pareto SKUs',
        body: 'Standard catalogue products. Each SKU has moderate individual revenue contribution, but issues accumulate at scale across the broad SKU base.',
    },

    // ── NPD Bucket Card ───────────────────────────────────────────────────────
    npdCard: {
        title: 'NPD — New Product Development',
        body: 'Recently launched products being monitored for early market reception, rating momentum, and quality signals. Low review volume is expected; trend direction is the key indicator.',
    },

    // ── Rating Bifurcation ────────────────────────────────────────────────────
    ratingBifurcation: {
        title: 'Rating Bifurcation',
        body: 'Breaks the selected classification down into three health buckets based on the product\'s live platform (PDP) rating — not the average review score.',
        bullets: [
            'NP (No Problem) — PDP rating ≥ 4.2⭐ — product is performing well',
            'NI (No Issue)   — PDP rating 4.0–4.2⭐ — within acceptable range, monitor',
            'Issue           — PDP rating < 4.0⭐ — needs investigation and action',
        ],
    },

    // ── Metrics ───────────────────────────────────────────────────────────────
    reviewGrowth: {
        title: 'Review Volume Growth',
        body: 'Calculates the percentage change in the TOTAL COUNT of reviews between the selected and previous period.',
        bullets: [
            'Example (3M): (Reviews in Last 3 Months - Reviews in Prior 3 Months) / Reviews in Prior 3 Months',
        ]
    },
    ratingGrowth: {
        title: 'Average Rating Growth',
        body: 'Calculates the absolute difference in the AVERAGE STAR RATING between the selected and previous period.',
        bullets: [
            'Example (3M): Avg Rating in Last 3 Months - Avg Rating in Prior 3 Months',
        ]
    },

    // ── Stakeholder Ownership ─────────────────────────────────────────────────
    stakeholderOwnership: {
        title: 'Stakeholder Ownership (NLP)',
        body: 'AI-powered Natural Language Processing maps customer complaints in review text to the internal team most responsible for resolving the root cause.',
        bullets: [
            'Production — manufacturing defects, build quality, materials',
            'QC — quality control failures, consistency issues, faulty units',
            'Customer Service — delivery, packaging, responsiveness, returns',
        ],
    },

    // ── Trend Chart ───────────────────────────────────────────────────────────
    trendChart: {
        title: 'Review Trend',
        body: 'Monthly review volume and average rating over time for the selected filters. Helps identify seasonal patterns, campaign impact, or quality deterioration.',
    },

    // ── Word Sphere ───────────────────────────────────────────────────────────
    wordSphere: {
        title: 'Topic Cloud',
        body: 'Visual map of the most frequently mentioned themes in customer reviews. Larger = more mentions. Click a topic to filter the review explorer.',
    },

    // ── Timeline ──────────────────────────────────────────────────────────────
    timeline: {
        title: 'Review Timeline',
        body: 'Month-by-month review count stacked by sentiment (Positive / Neutral / Negative). Use this to correlate dips or spikes with external events.',
    },

    // ── Insights Panel ────────────────────────────────────────────────────────
    insightsPanel: {
        title: 'Sentiment Insights',
        body: 'AI-generated narrative summary of the most significant quality signals, emerging issues, and positive themes detected across the filtered review set.',
    },

    // ── Competitive Benchmark ─────────────────────────────────────────────────
    competitiveBenchmark: {
        title: 'Competitive Benchmark',
        body: 'Side-by-side comparison of your brand\'s sentiment scores vs competitor brands across key quality dimensions (Quality, Performance, Value, etc.).',
    },

    // ── Product Health Table ──────────────────────────────────────────────────
    productHealthTable: {
        title: 'Product Health',
        body: 'Per-SKU health scores derived from review sentiment. Products are ranked by a composite health score (positive vs negative ratio). Trend = direction of change over the selected period.',
        bullets: [
            'Scale: 0 to 100 (50 is neutral)',
            'Formula: ((Positive - Negative) / Total) * 50 + 50',
            'Amber/Red (<50): Higher ratio of negative reviews',
            'Green (>70): Healthy product with strong positive feedback',
        ],
    },

    // ── Category Health View ──────────────────────────────────────────────────
    categoryHealthView: {
        title: 'Category Health',
        body: 'Deep-dive into a specific product category: quality themes, SKU-level performance, and Pareto classification distribution. Use the drill-down to move from category → classification → individual SKUs.',
    },

    // ── Segment Matrix ────────────────────────────────────────────────────────
    segmentMatrix: {
        title: 'Segment Matrix',
        body: 'Maps your SKUs on a grid of product spec (wattage / capacity / burners) vs price range. Each cell shows the products competing in that segment and their relative ratings.',
    },

    // ── Review Explorer ───────────────────────────────────────────────────────
    reviewExplorer: {
        title: 'Review Explorer',
        body: 'Full-text review browser with search, sentiment filter, and date range. Useful for reading verbatim customer feedback behind any metric you see on the dashboard.',
    },
};
