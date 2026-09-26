export type RatingMetrics = {
    pdp_rating: number | null;
    user_rating: number | null;
    ml_rating: number | null;
    review_count: number;
    rating_count: number;
};

export type ComparisonBasis =
    | 'category'
    | 'spec_bucket'
    | 'sku_mapping'
    | 'brand'
    | 'segment';

export type ComparisonMetrics = {
    own_metrics: RatingMetrics;
    competitor_metrics: RatingMetrics | null;
    comparison_basis: ComparisonBasis;
};
