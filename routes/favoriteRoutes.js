const express = require('express');
const router = express.Router();
const { addFavorite, removeFavorite, getFavorites } = require('../controllers/favorite.controller');
const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

router.route('/')
    .get(getFavorites);

router.route('/:propertyId')
    .post(addFavorite)
    .delete(removeFavorite);

module.exports = router;
