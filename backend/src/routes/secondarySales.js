// src/routes/secondarySales.js
// Route definitions for SECONDARY SUMMARY segment APIs

import {
    getSecondaryFiltersHandler,
    getSecondaryLatestDateHandler,
    getSecondarySellerWiseHandler,
    getSecondaryQuarterWiseHandler,
    getSecondaryTopBrandsHandler,
    getSecondarySalesTimelineHandler,
} from '../controllers/secondarySalesController.js';

export default (app) => {
    app.use('/api/secondary-sales', (req, res, next) => {
        console.log(`[Secondary Sales API] Called: ${req.method} ${req.originalUrl}`);
        next();
    });

    app.get('/api/secondary-sales/filters', getSecondaryFiltersHandler);
    app.get('/api/secondary-sales/latest-date', getSecondaryLatestDateHandler);
    app.get('/api/secondary-sales/seller-wise', getSecondarySellerWiseHandler);
    app.get('/api/secondary-sales/quarter-wise', getSecondaryQuarterWiseHandler);
    app.get('/api/secondary-sales/top-brands', getSecondaryTopBrandsHandler);
    app.get('/api/secondary-sales/sales-timeline', getSecondarySalesTimelineHandler);
};
