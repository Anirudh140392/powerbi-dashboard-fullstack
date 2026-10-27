import { clickhouse } from '../utils/db.js';
import { buildProductsQuery } from '../queries/products.query.js';
import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import type { ProductRow, ContentOlapProductRow } from '../types/contentDashboard.types.js';
import { toFloat } from '../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Products Service
// Executes the products query and maps raw ClickHouse rows to the API shape.
// ---------------------------------------------------------------------------

export async function fetchProducts(
  params: ContentDashboardQuerySchema
): Promise<ProductRow[]> {
  const query = buildProductsQuery(params);

  const result = await clickhouse.query({ query, format: 'JSONEachRow' });
  const rows = await result.json<ContentOlapProductRow>();

  return rows.map(mapRowToProduct);
}

function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.endsWith('f=auto') || trimmed.length < 15) return null;
  
  if (trimmed.includes('media-amazon.com/images/I/')) {
    if (trimmed.includes('._')) {
      return trimmed.replace(/\._.*$/, '.jpg');
    }
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Internal mapper — converts a raw ClickHouse row to the API ProductRow shape.
// Null / undefined scores are coerced to 0 so the frontend always receives
// a number.
// ---------------------------------------------------------------------------
function mapRowToProduct(row: ContentOlapProductRow): ProductRow {
  const imageUrl = cleanImageUrl(row.image_url) || cleanImageUrl(row.image_url_s3) || null;

  return {
    productId: row.product_id ?? '',
    title: row.title ?? row.product_id ?? 'Unknown Product',
    imageUrl,
    totalScore: toFloat(row.score),
    titleScore: toFloat(row.title_score),
    bulletPointScore: toFloat(row.bullet_point_score),
    descriptionScore: toFloat(row.description_score),
    aplusScore: toFloat(row.aplus_score),
    thumbnailScore: toFloat(row.thumbnail_score),
    thumbnailVideoScore: toFloat(row.video_score),
  };
}
