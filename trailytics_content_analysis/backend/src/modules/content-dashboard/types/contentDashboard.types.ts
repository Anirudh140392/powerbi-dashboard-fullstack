// ---------------------------------------------------------------------------
// Content Dashboard — TypeScript Types & Interfaces
// ---------------------------------------------------------------------------

/** Validated, coerced query params (post-Zod parse) */
export interface ContentDashboardQueryParams {
  company: string;
  platform?: string;
  page: number;
  limit: number;
  search?: string;
  sortBy: SortableColumn;
  sortOrder: 'asc' | 'desc';
}

/** Columns the API allows sorting on (must mirror the Zod enum in the validator) */
export type SortableColumn =
  | 'score'
  | 'title_score'
  | 'bullet_point_score'
  | 'description_score'
  | 'aplus_score'
  | 'thumbnail_score'
  | 'video_score'
  | 'title';

// ---------------------------------------------------------------------------
// Raw ClickHouse row shapes (internal — never sent to the client)
// ---------------------------------------------------------------------------

/** One row returned by the products query */
export interface ContentOlapProductRow {
  product_id: string;
  title?: string;
  image_url?: string;
  image_url_s3?: string;
  score?: number;
  title_score?: number;
  bullet_point_score?: number;
  description_score?: number;
  aplus_score?: number;
  thumbnail_score?: number;
  video_score?: number;
}

/** One row returned by the summary/aggregate query */
export interface ContentOlapSummaryRow {
  total: string;           // ClickHouse returns COUNT as string
  avg_score: string;
  avg_title_score: string;
  avg_bullet_score: string;
  avg_description_score: string;
  avg_aplus_score: string;
  avg_thumbnail_score: string;
  avg_video_score: string;
}

// ---------------------------------------------------------------------------
// API response shapes (sent to the client)
// ---------------------------------------------------------------------------

/** A single product as returned by the API */
export interface ProductRow {
  productId: string;
  title: string;
  imageUrl?: string | null;
  totalScore: number | null;
  titleScore: number | null;
  bulletPointScore: number | null;
  descriptionScore: number | null;
  aplusScore: number | null;
  thumbnailScore: number | null;
  thumbnailVideoScore: number | null;
}

/** Aggregate summary metrics */
export interface ContentDashboardSummary {
  totalProducts: number;
  averageScore: number | null;
  avgTitleScore: number | null;
  avgBulletScore: number | null;
  avgDescriptionScore: number | null;
  avgAplusScore: number | null;
  avgThumbnailScore: number | null;
  avgThumbnailVideoScore: number | null;
}

/** Pagination metadata included in the response */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Full API response */
export interface ContentDashboardResponse {
  summary: ContentDashboardSummary;
  products: ProductRow[];
  pagination: PaginationMeta;
}
