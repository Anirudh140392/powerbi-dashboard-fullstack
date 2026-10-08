import { clickhouse } from '../utils/db.js';
import { buildSummaryQuery } from '../queries/summary.query.js';
import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import type { ContentDashboardSummary, ContentOlapSummaryRow } from '../types/contentDashboard.types.js';
import { toFloat, toInt } from '../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Summary Service
// Executes the aggregate query and maps raw ClickHouse rows to the API shape.
// ---------------------------------------------------------------------------

export async function fetchSummary(
  params: ContentDashboardQuerySchema
): Promise<ContentDashboardSummary> {
  const query = buildSummaryQuery(params);

  const result = await clickhouse.query({ query, format: 'JSONEachRow' });
  const rows = await result.json<ContentOlapSummaryRow>();

  // The aggregate query always returns exactly one row
  const row = rows[0];

  if (!row || toInt(row.total) === 0) {
    return {
      totalProducts: 0,
      averageScore: null,
      avgTitleScore: null,
      avgBulletScore: null,
      avgDescriptionScore: null,
      avgAplusScore: null,
      avgThumbnailScore: null,
      avgThumbnailVideoScore: null,
    };
  }

  return {
    totalProducts: toInt(row.total) ?? 0,
    averageScore: toFloat(row.avg_score),
    avgTitleScore: toFloat(row.avg_title_score),
    avgBulletScore: toFloat(row.avg_bullet_score),
    avgDescriptionScore: toFloat(row.avg_description_score),
    avgAplusScore: toFloat(row.avg_aplus_score),
    avgThumbnailScore: toFloat(row.avg_thumbnail_score),
    avgThumbnailVideoScore: toFloat(row.avg_video_score),
  };
}
