const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const { addProperty, getUserProperties, searchProperty, getProperties, singleProperty, relatedProperties, updateProperty, deleteProperty, getPropertiesByCategory } = require('../controllers/property.controller');


router.post('/properties', verifyToken, addProperty);

router.get('/user/properties', verifyToken, getUserProperties)

router.get('/properties/search', searchProperty);

router.get('/properties', getProperties);


router.get('/properties/:id', singleProperty);

router.get('/properties/:id/related', relatedProperties);


router.put('/properties/:id', verifyToken, updateProperty);

router.delete('/properties/:id', verifyToken, deleteProperty);

router.get("/category/:category", getPropertiesByCategory)


module.exports = router;
