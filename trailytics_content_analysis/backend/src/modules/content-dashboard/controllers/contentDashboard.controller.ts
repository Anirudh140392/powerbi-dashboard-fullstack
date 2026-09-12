import type { Request, Response } from 'express';
import { contentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import { getContentDashboardData } from '../services/contentDashboard.service.js';

// ---------------------------------------------------------------------------
// Content Dashboard Controller
// Thin layer: validate → call service → respond.
// All business logic lives in the service layer.
// ---------------------------------------------------------------------------

export async function getContentDashboard(req: Request, res: Response): Promise<void> {
  // 1. Validate query params
  const parsed = contentDashboardQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid query parameters',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  // 2. Fetch data
  try {
    const data = await getContentDashboardData(parsed.data);
    res.status(200).json(data);
  } catch (err) {
    // Distinguish ClickHouse "unknown database" errors from generic failures
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.toLowerCase().includes('unknown database') || message.toLowerCase().includes('database')) {
      res.status(404).json({
        error: `Database '${parsed.data.company}' not found. Check the company parameter.`,
      });
      return;
    }

    console.error('[ContentDashboard] Query failed:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data. Please try again.' });
  }
}
