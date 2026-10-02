const { getDashboardStats, updatePropertyStatus, getPendingStatus, getApprovedStatus, getRejectedStatus, getUsers, banUser } = require('../controllers/admin.controller');
const { adminAuth } = require('../middlewares/adminAuth');

const router = require('express').Router();

router.use(adminAuth);

router.get('/stats', getDashboardStats);

router.put('/properties/:id/status', updatePropertyStatus)

router.get('/pending', getPendingStatus)
router.get('/approved', getApprovedStatus)
router.get('/rejected', getRejectedStatus)

router.get('/users', getUsers);
router.patch('/users/:id/ban', banUser);

module.exports = router;