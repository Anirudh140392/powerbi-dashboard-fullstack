import express from 'express';
import { useOlapTable } from '../../utils/olapResolver.js';

import {
    getStakeholderDetail as getStakeholderDetailLegacy,
    getStakeholderMappings,
    createStakeholderMapping,
    deleteStakeholderMapping,
} from '../../controllers/stakeholder/stakeholder.controller.js';

import {
    getStakeholderDetail as getStakeholderDetailOlap,
    getStakeholderMappings as getStakeholderMappingsOlap,
} from '../../controllers/stakeholder/stakeholder.olap.controller.js';

const dispatch = (legacyFn, olapFn) => (req, res, next) => {
    const dbName =
        req.query.db_name || req.headers['x-db-name'] || req.headers['x-database-name'] ||
        (req.authUser && req.authUser.dbName) ||
        process.env.CLICKHOUSE_DATABASE || process.env.CLICKHOUSE_DB || '';
    return useOlapTable(dbName) ? olapFn(req, res, next) : legacyFn(req, res, next);
};

const router = express.Router();

router.get('/stakeholder-detail',      dispatch(getStakeholderDetailLegacy, getStakeholderDetailOlap));
router.get('/stakeholder-mappings',    dispatch(getStakeholderMappings, getStakeholderMappingsOlap));
router.post('/stakeholder-mappings',   createStakeholderMapping);
router.delete('/stakeholder-mappings/:id', deleteStakeholderMapping);

export default router;
