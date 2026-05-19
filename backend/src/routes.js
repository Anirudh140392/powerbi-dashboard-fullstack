import controlTower from './routes/controlTower.js';
import availabilityAnalysis from './routes/availabilityAnalysis.js';
import visibilityAnalysis from './routes/visibilityAnalysis.js';
import pricingAnalysis from './routes/pricingAnalysis.js';
import marketShare from './routes/marketShare.js';
import portfoliosAnalysis from './routes/portfoliosAnalysis.js';
import performanceMarketing from './routes/performanceMarketing.js';
import contentAnalysis from './routes/contentAnalysis.js';
import categoryRca from './routes/categoryRca.js';
import ecomRca from './routes/ecomRca.js';
import sales from './routes/sales.js';
import inventoryAnalysis from './routes/inventoryAnalysis.js';
import reports from './routes/reports.js';
import mapIntellect from './routes/mapIntellect.js';
import insights from './routes/insights.js';
import admin from './routes/admin.js';
import walkthrough from './routes/walkthrough.js';

export default (app) => {
    // Admin routes
    admin(app);

    // Walkthrough routes
    walkthrough(app);

    // Control Tower routes
    controlTower(app);

    // Availability Analysis routes
    availabilityAnalysis(app);


    // Visibility Analysis routes
    visibilityAnalysis(app);

    // Pricing Analysis routes
    pricingAnalysis(app);

    // Market Share routes
    marketShare(app);

    // Portfolios Analysis routes
    portfoliosAnalysis(app);

    // Performance Marketing routes
    performanceMarketing(app);

    // Content Analysis routes
    contentAnalysis(app);

    // Category RCA routes
    categoryRca(app);

    // E-com RCA routes
    ecomRca(app);

    // Sales routes
    sales(app);

    // Inventory Analysis routes
    inventoryAnalysis(app);

    // Reports routes
    reports(app);

    // Map Intellect routes
    mapIntellect(app);

    // Insights routes
    insights(app);
};
