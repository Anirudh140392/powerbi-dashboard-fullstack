import ecomRcaService from '../services/ecomRcaService.js';

export const EcomRcaTree = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || 'All',
            category: req.query.category || 'All',
            brand: req.query.brand || 'All',
            sku: req.query.sku || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            month: req.query.month,
            drilldownLevel: req.query.drilldownLevel,
            drilldownId: req.query.drilldownId,
            kpiCategory: req.query.kpiCategory,
            activeTab: req.query.activeTab,
            brandScope: req.query.brandScope,
            categoryVal: req.query.categoryVal
        };

        const result = await ecomRcaService.getEcomRcaData(filters);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error in EcomRcaTree controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch E-com RCA Tree data',
            error: error.message
        });
    }
};

export default {
    EcomRcaTree
};
