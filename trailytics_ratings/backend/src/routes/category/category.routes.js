import express from 'express';
import { useOlapTable } from '../../utils/olapResolver.js';

import {
    getProductCategories as getProductCategoriesLegacy,
    getProducts as getProductsLegacy,
    getCategories as getCategoriesLegacy,
    createCategoryRule,
    updateCategoryRule,
    deleteCategoryRule,
} from '../../controllers/category/category.controller.js';

import {
    getProductCategories as getProductCategoriesOlap,
    getProducts as getProductsOlap,
    getCategories as getCategoriesOlap,
} from '../../controllers/category/category.olap.controller.js';

const dispatch = (legacyFn, olapFn) => (req, res, next) => {
    const dbName =
        req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
        (req.authUser && req.authUser.dbName) ||
        process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || '';
    return useOlapTable(dbName) ? olapFn(req, res, next) : legacyFn(req, res, next);
};

const router = express.Router();

router.get('/product-categories',   dispatch(getProductCategoriesLegacy,  getProductCategoriesOlap));
router.get('/products',             dispatch(getProductsLegacy,            getProductsOlap));
router.get('/categories',           dispatch(getCategoriesLegacy,          getCategoriesOlap));
// CRUD rules are Postgres-only — no dispatch needed
router.post('/category-rules',      createCategoryRule);
router.put('/category-rules/:id',   updateCategoryRule);
router.delete('/category-rules/:id', deleteCategoryRule);

export default router;
