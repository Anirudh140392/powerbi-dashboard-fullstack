import express from 'express';
import { 
    getCompetitorMentions,
    getCompetitorMatrix,
    getCompetitorMappings,
    createCompetitorMapping,
    updateCompetitorMapping,
    deleteCompetitorMapping,
    getCompetitorMappingTypes,
    getCompetitorMappingOptions,
    getCompetitorMappingPairs,
    createCompetitorMappingPair,
    updateCompetitorMappingPair,
    deleteCompetitorMappingPair,
    exportCompetitorMappingPairs,
    getCompetitorBrands
} from '../../controllers/competition/competition.controller.js';

const router = express.Router();

router.get('/competitor-mentions', getCompetitorMentions);
router.get('/competitor-matrix', getCompetitorMatrix);
router.get('/competitor-mappings', getCompetitorMappings);
router.post('/competitor-mappings', createCompetitorMapping);
router.put('/competitor-mappings/:id', updateCompetitorMapping);
router.delete('/competitor-mappings/:id', deleteCompetitorMapping);
router.get('/competitor-mapping-types', getCompetitorMappingTypes);
router.get('/competitor-mapping-options', getCompetitorMappingOptions);
router.get('/competitor-mapping-pairs', getCompetitorMappingPairs);
router.post('/competitor-mapping-pairs', createCompetitorMappingPair);
router.put('/competitor-mapping-pairs/:id', updateCompetitorMappingPair);
router.delete('/competitor-mapping-pairs/:id', deleteCompetitorMappingPair);
router.get('/competitor-mapping-pairs/export', exportCompetitorMappingPairs);
router.get('/competitor-brands', getCompetitorBrands);

export default router;
