const express = require('express');
const router = express.Router();
const { createSavedSearch, getSavedSearches, deleteSavedSearch } = require('../controllers/savedSearch.controller');
const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

router.route('/')
    .post(createSavedSearch)
    .get(getSavedSearches);

router.route('/:id')
    .delete(deleteSavedSearch);

module.exports = router;
