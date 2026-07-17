import express from 'express';
import { 
    getProductCategories,
    getProducts,
    getCategories,
    createCategoryRule,
    updateCategoryRule,
    deleteCategoryRule
} from '../../controllers/category/category.controller.js';

const router = express.Router();

router.get('/product-categories', getProductCategories);
router.get('/products', getProducts);
router.get('/categories', getCategories);
router.post('/category-rules', createCategoryRule);
router.put('/category-rules/:id', updateCategoryRule);
router.delete('/category-rules/:id', deleteCategoryRule);

export default router;
