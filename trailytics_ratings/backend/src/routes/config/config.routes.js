import express from 'express';
import {
    getPlatformOptions,
    getPriceRanges,
    getSentimentCategories,
    getSpecTypeMappings,
    getCompanyConfig,
    getBrandConfig,
    getAlertScopeOptions,
    getClientBrands
} from '../../controllers/config/config.controller.js';
import { getSkuListLegacy, getSkuListOlap } from '../../controllers/misc_temp.js';
import { useOlapTable } from '../../utils/olapResolver.js';

const dispatch = (legacyFn, olapFn) => (req, res, next) => {
    const dbName =
        req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
        (req.authUser && req.authUser.dbName) ||
        process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || '';
    return useOlapTable(dbName) ? olapFn(req, res, next) : legacyFn(req, res, next);
};

const router = express.Router();

router.get('/platform-options', getPlatformOptions);
router.get('/price-ranges', getPriceRanges);
router.get('/sentiment-categories', getSentimentCategories);
router.get('/spec-type-mappings', getSpecTypeMappings);
router.get('/company-config', getCompanyConfig);
router.get('/brand-config', getBrandConfig);
router.get('/alert-scope-options', getAlertScopeOptions);
router.get('/sku-list', dispatch(getSkuListLegacy, getSkuListOlap));
router.get('/client-brands', getClientBrands);

export default router;
