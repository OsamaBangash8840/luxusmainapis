const express = require('express');
const router = express.Router();
const { addReview, getPropertyReviews } = require('../controllers/review.controller');
const verifyToken = require('../middlewares/verifyToken');

router.post('/properties/:id/reviews', verifyToken, addReview);
router.get('/properties/:id/reviews', getPropertyReviews);

module.exports = router;
