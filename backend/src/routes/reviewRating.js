import { getReviewRatingLatestDate } from '../controllers/reviewRatingController.js';

export default (app) => {
    app.get('/api/review-rating/latest-date', getReviewRatingLatestDate);
};
