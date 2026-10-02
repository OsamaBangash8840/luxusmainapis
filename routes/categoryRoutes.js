const router = require('express').Router();
const { adminAuth } = require('../middlewares/adminAuth');
const { addCategory, getAllCategories, getCategoryById } = require('../controllers/category.controller');

router.post('/categories', adminAuth, addCategory);
router.get('/categories', getAllCategories);
router.get('/categories/:id', getCategoryById);

module.exports = router;