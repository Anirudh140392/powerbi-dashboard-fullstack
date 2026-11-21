import { z } from 'zod';

// ---------------------------------------------------------------------------
// Whitelist of columns the API allows sorting on.
// Keep in sync with SortableColumn in types/contentDashboard.types.ts
// ---------------------------------------------------------------------------
const ALLOWED_SORT_COLUMNS = [
  'score',
  'title_score',
  'bullet_point_score',
  'description_score',
  'aplus_score',
  'thumbnail_score',
  'video_score',
  'title',
] as const;

export const contentDashboardQuerySchema = z.object({
  /** Database / company name — must be alphanumeric + underscore/dash only */
  company: z
    .string()
    .min(1, 'company is required')
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'company must be alphanumeric'),

  /** Platform (e.g. "Amazon", "Flipkart") — matched via LIKE on store_url */
  platform: z.string().max(64).optional(),

  /** 1-based page number */
  page: z.coerce.number().int().min(1).default(1),

  /** Rows per page (max 100 to protect the database) */
  limit: z.coerce.number().int().min(1).max(100).default(10),

  /** Full-text search across product_id and title */
  search: z.string().max(200).optional(),

  /** Comma-separated list of brands */
  brand: z.string().max(2000).optional(),

  /** Comma-separated list of categories */
  category: z.string().max(2000).optional(),

  /** Comma-separated list of SKUs */
  skus: z.string().max(10000).optional(),

  /** Column to sort by */
  sortBy: z.enum(ALLOWED_SORT_COLUMNS).default('score'),

  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ContentDashboardQuerySchema = z.infer<typeof contentDashboardQuerySchema>;
