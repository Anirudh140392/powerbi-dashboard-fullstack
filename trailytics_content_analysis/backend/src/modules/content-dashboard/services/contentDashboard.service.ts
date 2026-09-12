import { fetchSummary } from './summary.service.js';
import { fetchProducts } from './products.service.js';
import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import type { ContentDashboardResponse } from '../types/contentDashboard.types.js';

// ---------------------------------------------------------------------------
// Main Orchestrator Service
// Runs the summary and products queries in parallel (Promise.all) to minimise
// round-trip time. Assembles and returns the full API response.
// ---------------------------------------------------------------------------

export async function getContentDashboardData(
  params: ContentDashboardQuerySchema
): Promise<ContentDashboardResponse> {
  // Fire both queries concurrently — they are independent
  const [summary, products] = await Promise.all([
    fetchSummary(params),
    fetchProducts(params),
  ]);

  const totalPages = params.limit > 0
    ? Math.ceil(summary.totalProducts / params.limit)
    : 0;

  return {
    summary,
    products,
    pagination: {
      page: params.page,
      limit: params.limit,
      total: summary.totalProducts,
      totalPages: Math.max(totalPages, 1),
    },
  };
}
