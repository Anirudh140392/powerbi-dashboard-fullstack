import express from 'express';
import { 
    getReviews,
    searchReviews
} from '../../controllers/reviews/reviews.controller.js';

const router = express.Router();

router.get('/reviews', getReviews);
router.get('/reviews/search', searchReviews);

export default router;
