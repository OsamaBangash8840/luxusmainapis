const router = require("express").Router();
const verifyToken = require('../middlewares/verifyToken');
const passport = require('passport');
const { login, register, verifyEmail, resendVerification, LogOut, ForgetPass, ResetPass, getUserProfile, updateUserProfile, googleCallback, completeGoogleSignup, refreshToken } = require("../controllers/auth.controller");

router.post('/login', login);
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/refresh', refreshToken);

// Rename for clarity (keep old route paths working)
router.post('/resend-verification', resendVerification);
router.post('/resend-verfication', resendVerification);

router.delete('/logout', LogOut);
router.post('/forget-password', ForgetPass);
router.post('/reset-password/:token', ResetPass);

router.get("/profile", verifyToken, getUserProfile);
router.put("/profile", verifyToken, updateUserProfile);

router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login", session: false }),
    googleCallback
);

// Complete Google Signup Route
router.post('/complete-google-signup', completeGoogleSignup);

module.exports = router;
