const express = require('express');
const { scheduleTour, availableSlots, cancelTour } = require('../controllers/tour.controller');
const verifyToken = require('../middlewares/verifyToken');

const router = express.Router();


router.post('/schedule-tour', scheduleTour);


// Available Slots Endpoint
router.get('/available-slots', availableSlots);

router.delete('/cancel/:id', verifyToken, cancelTour);

module.exports = router;
