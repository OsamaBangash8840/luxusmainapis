const router = require('express').Router();
const { createPaymentIntent } = require('../controllers/payment.controller');
const verifyToken = require('../middlewares/verifyToken');

router.post('/create-payment-intent', verifyToken, createPaymentIntent);

module.exports = router;
