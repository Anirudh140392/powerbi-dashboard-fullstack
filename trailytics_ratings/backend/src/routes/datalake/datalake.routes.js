import express from 'express';
import { 
    exportDataLake,
    getDataLakeReviews,
    bulkDeleteDataLakeReviews
} from '../../controllers/datalake/datalake.controller.js';

const router = express.Router();

router.get('/export', exportDataLake);
router.get('/reviews', getDataLakeReviews);
router.post('/reviews/bulk-delete', bulkDeleteDataLakeReviews);

export default router;
