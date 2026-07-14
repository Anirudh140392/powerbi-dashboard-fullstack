import express from 'express';
import {
    getPlatformOptions,
    getPriceRanges,
    getSentimentCategories,
    getSpecTypeMappings,
    getCompanyConfig,
    getBrandConfig,
    getAlertScopeOptions
} from '../../controllers/config/config.controller.js';

const router = express.Router();

router.get('/platform-options', getPlatformOptions);
router.get('/price-ranges', getPriceRanges);
router.get('/sentiment-categories', getSentimentCategories);
router.get('/spec-type-mappings', getSpecTypeMappings);
router.get('/company-config', getCompanyConfig);
router.get('/brand-config', getBrandConfig);
router.get('/alert-scope-options', getAlertScopeOptions);

export default router;
