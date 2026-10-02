const router = require('express').Router();
const { check } = require('express-validator');
const { submitContactForm, subscribeNewsletter } = require('../controllers/contact.controller');

router.post(
    '/submit',
    [
        check('name', 'Full name is required').not().isEmpty(),
        check('email', 'Invalid email address').isEmail(),
        check('mobile', 'Invalid mobile number').matches(/^\+?[0-9 ]{10,15}$/),
        check('message', 'Message is required').not().isEmpty(),
    ],
    submitContactForm
);

router.post('/newsletter', subscribeNewsletter);

module.exports = router;
