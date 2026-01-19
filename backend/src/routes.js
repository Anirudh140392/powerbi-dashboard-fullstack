import controlTower from './routes/controlTower.js';
import availabilityAnalysis from './routes/availabilityAnalysis.js';
import visibilityAnalysis from './routes/visibilityAnalysis.js';
import pricingAnalysis from './routes/pricingAnalysis.js';
import marketShare from './routes/marketShare.js';
import portfoliosAnalysis from './routes/portfoliosAnalysis.js';
import performanceMarketing from './routes/performanceMarketing.js';
import contentAnalysis from './routes/contentAnalysis.js';
import categoryRca from './routes/categoryRca.js';

export default (app) => {
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
};