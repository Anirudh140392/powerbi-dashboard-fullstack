import type { Request, Response } from 'express';
import { getCascadedFilters, searchSkus } from '../queries/filters.query.js';

export async function getFilters(req: Request, res: Response): Promise<void> {
  try {
    const { company, platform, category, brand } = req.query;
    
    if (!company || typeof company !== 'string') {
      res.status(400).json({ error: 'company is required' });
      return;
    }

    const filters = await getCascadedFilters(
      company,
      typeof platform === 'string' ? platform : undefined,
      typeof category === 'string' ? category : undefined,
      typeof brand === 'string' ? brand : undefined
    );
    
    res.status(200).json(filters);
  } catch (err) {
    console.error('[ContentDashboard] Fetch filters failed:', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
}

export async function getSkus(req: Request, res: Response): Promise<void> {
  try {
    const { company, search, platform, category, brand } = req.query;
    
    if (!company || typeof company !== 'string') {
      res.status(400).json({ error: 'company is required' });
      return;
    }

    const skus = await searchSkus(
      company,
      typeof search === 'string' ? search : '',
      typeof platform === 'string' ? platform : undefined,
      typeof category === 'string' ? category : undefined,
      typeof brand === 'string' ? brand : undefined
    );
    
    res.status(200).json({ skus });
  } catch (err) {
    console.error('[ContentDashboard] Search SKUs failed:', err);
    res.status(500).json({ error: 'Failed to search SKUs' });
  }
}
