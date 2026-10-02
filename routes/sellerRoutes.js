const express = require('express');
const router = express.Router();
const { getSellerStats } = require('../controllers/seller.controller');
const verifyToken = require('../middlewares/verifyToken');
const authorizeRoles = require('../middlewares/roleAuth');

router.use(verifyToken);
router.use(authorizeRoles('seller'));

router.route('/stats')
    .get(getSellerStats);

module.exports = router;
