import express from 'express';
import { 
    spawnMlJob,
    getMlJobs,
    masterEnrich
} from '../../controllers/ml/ml.controller.js';

const router = express.Router();

router.post('/jobs/spawn', spawnMlJob);
router.get('/jobs', getMlJobs);
router.post('/master-enrich', masterEnrich);

export default router;
