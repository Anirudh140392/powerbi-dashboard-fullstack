import express from 'express';
import {
    getStakeholderDetail,
    getStakeholderMappings,
    createStakeholderMapping,
    deleteStakeholderMapping
} from '../../controllers/stakeholder/stakeholder.controller.js';

const router = express.Router();

router.get('/stakeholder-detail', getStakeholderDetail);
router.get('/stakeholder-mappings', getStakeholderMappings);
router.post('/stakeholder-mappings', createStakeholderMapping);
router.delete('/stakeholder-mappings/:id', deleteStakeholderMapping);

export default router;
