const { sendVerificationEmail, generateAuthToken, transporter, isPasswordMatch, getHashValue, setAuthCookie, generateRefreshToken } = require("../helpers/auth.helper");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Property } = require("../models/Property");
const sendEmail = require("../utils/email");
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');
const passport = require('passport');
const mongoose = require('mongoose');





module.exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string') {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Email (string) and password are required');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    const isMatch = await isPasswordMatch(password, user.password);
    if (!isMatch) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    if (!user.isVerified) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, "Please verify your email");
    }

    if (user.isBanned) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, "Your account has been banned.");
    }

    const token = generateAuthToken(user);
    const refreshToken = generateRefreshToken(user);
    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(refreshToken, salt);
    
    await RefreshToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    logger.info('User logged in successfully', { userId: user._id, email: user.email });

    setAuthCookie(res, token, refreshToken);
    res.json(
        new ApiResponse(STATUS_CODES.OK, {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                token,
            }
        }, MESSAGES.AUTH.LOGIN_SUCCESS)
    );
});


module.exports.register = asyncHandler(async (req, res) => {
    const { username, email, password, role, phone } = req.body;

    if (!username || !email || !password || !role) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'All fields are required.');
    }
    
    if (typeof email !== 'string') {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid email format.');
    }

    const allowedRoles = ['buyer', 'seller'];
    if (!allowedRoles.includes(role)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid role');
    }

    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existingUser) {
        const message = existingUser.email === email
            ? MESSAGES.AUTH.EMAIL_ALREADY_EXISTS
            : 'Username already taken';
        throw new ApiError(STATUS_CODES.BAD_REQUEST, message);
    }

    const hashedPassword = await getHashValue(password);

    const user = new User({
        username,
        email,
        password: hashedPassword,
        role,
        authMethod: 'local',
        isVerified: false,
        phone
    });

    await user.save();

    const token = generateAuthToken(user);

    try {
        await sendVerificationEmail(user);
        logger.info('User registered successfully', { userId: user._id, email: user.email });

        setAuthCookie(res, token);
        res.status(STATUS_CODES.CREATED).json(
            new ApiResponse(STATUS_CODES.CREATED, { userId: user._id }, MESSAGES.AUTH.REGISTER_SUCCESS)
        );
    } catch (error) {
        logger.error('Verification email failed to send', { userId: user._id, error: error.message });
        res.status(STATUS_CODES.CREATED).json(
            new ApiResponse(STATUS_CODES.CREATED, { userId: user._id }, 'Account created but verification email failed to send. Please try resending verification email.')
        );
    }
});

module.exports.verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, "Verification token is required");
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        verificationToken: hashedToken
    }).select('+verificationToken +verificationTokenExpires');

    if (!user || user.verificationTokenExpires < Date.now()) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.AUTH.INVALID_TOKEN);
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logger.info('Email verified successfully', { userId: user._id });

    res.json(new ApiResponse(STATUS_CODES.OK, null, MESSAGES.AUTH.EMAIL_VERIFIED));
});


module.exports.resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Email is required');
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    if (user.isVerified) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Email is already verified');
    }

    const lastEmailSent = user.verificationTokenExpires || 0;
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes

    if (lastEmailSent && Date.now() - lastEmailSent < cooldownPeriod) {
        throw new ApiError(429, 'Please wait before requesting another verification email');
    }

    await sendVerificationEmail(user);
    logger.info('Verification email resent', { userId: user._id });

    res.json(new ApiResponse(STATUS_CODES.OK, null, 'Verification email sent successfully'));
});

module.exports.LogOut = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken && req.user) {
        const tokens = await RefreshToken.find({ userId: req.user.id });
        for (const t of tokens) {
            const isMatch = await bcrypt.compare(refreshToken, t.tokenHash);
            if (isMatch) {
                await RefreshToken.findByIdAndDelete(t._id);
                break;
            }
        }
    }
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax',
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax',
    });
    logger.info('User logged out', { userId: req.user?.id });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, MESSAGES.AUTH.LOGOUT_SUCCESS));
});


module.exports.ForgetPass = asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (typeof email !== 'string') {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid email format');
    }

    const user = await User.findOne({ email });
    if (!user) {
        // Prevent user enumeration by returning the same success message
        return res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, MESSAGES.AUTH.PASSWORD_RESET_SENT));
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetPassLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
    <h2 style="color: #333; text-align: center;">Reset Password Link</h2>
    <p style="color: #666;text-align: center">Please click the button below to reset your password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetPassLink}" 
         style="background-color: #4CAF50; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px;
                display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
    <p style="color: #999; font-size: 12px;">If the button doesn't work, you can copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 12px; word-break: break-all;">${resetPassLink}</p>
  </div>
`;

    await sendEmail({
        to: user.email,
        subject: MESSAGES.EMAIL.PASSWORD_RESET_SUBJECT,
        html,
    });

    logger.info('Password reset email sent', { userId: user._id });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, MESSAGES.AUTH.PASSWORD_RESET_SENT));
});

module.exports.ResetPass = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    
    // Validate password (min 8 chars, one uppercase, one number)
    const passRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passRegex.test(password)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Password must be at least 8 characters long and contain at least one uppercase letter and one number');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        resetPasswordToken: hashedToken
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user || user.resetPasswordExpires < Date.now()) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.AUTH.INVALID_TOKEN);
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.deleteMany({ userId: user._id });

    logger.info('Password reset successfully', { userId: user._id });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, MESSAGES.AUTH.PASSWORD_RESET_SUCCESS));
});

module.exports.refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
        throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Refresh token not found');
    }

    let userId;
    const { token } = req.cookies;
    if (token) {
        try {
            const decoded = jwt.decode(token);
            if (decoded) userId = decoded.id;
        } catch (e) {}
    }

    if (!userId) {
        throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Cannot identify user for refresh');
    }

    // Find all valid (unexpired) refresh tokens for this user
    const tokens = await RefreshToken.find({ userId }).where('expiresAt').gt(new Date());
    let matchedToken = null;

    for (const t of tokens) {
        const isMatch = await bcrypt.compare(refreshToken, t.tokenHash);
        if (isMatch) {
            matchedToken = t;
            break;
        }
    }

    if (!matchedToken) {
        throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    // REUSE DETECTION: If this token was already rotated/revoked, an attacker is replaying it!
    if (matchedToken.isRevoked) {
        logger.warn('SECURITY ALERT: Refresh token reuse detected! Revoking all sessions for user', { userId });
        await RefreshToken.deleteMany({ userId });
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        throw new ApiError(STATUS_CODES.UNAUTHORIZED, 'Security Alert: Refresh token reuse detected. All active sessions have been terminated.');
    }

    const user = await User.findById(userId);
    if (!user || user.isBanned) {
        throw new ApiError(STATUS_CODES.FORBIDDEN, 'User banned or deleted');
    }

    // Invalidate current token by marking it revoked
    matchedToken.isRevoked = true;
    await matchedToken.save();
    
    // Issue rotated token pair
    const newAccessToken = generateAuthToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(newRefreshToken, salt);
    await RefreshToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false
    });

    setAuthCookie(res, newAccessToken, newRefreshToken);
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, 'Token refreshed successfully'));
});

module.exports.getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    const propertyCount = await Property.countDocuments({ seller: req.user.id });

    res.json(new ApiResponse(STATUS_CODES.OK, {
        ...user.toObject(),
        propertyCount
    }, MESSAGES.USER.PROFILE_FETCH_SUCCESS));
});


module.exports.updateUserProfile = asyncHandler(async (req, res) => {
    const { phone, username } = req.body;
    const user = await User.findByIdAndUpdate(
        req.user.id,
        { phone, username },
        { new: true }
    ).select('-password');

    logger.info('User profile updated', { userId: user._id });
    res.json(new ApiResponse(STATUS_CODES.OK, user, MESSAGES.USER.PROFILE_UPDATED));
});

module.exports.googleCallback = (req, res) => {
    const { profile, isNewUser } = req.user;

    if (isNewUser) {
        const signupToken = jwt.sign(
            { email: profile.email, displayName: profile.displayName, googleId: profile.id },
            process.env.GOOGLE_SIGNUP_SECRET,
            { expiresIn: "10m" }
        );
        return res.redirect(`${process.env.FRONTEND_URL}/complete-signup?token=${signupToken}`);
    }

    const { user, token } = req.user;
    setAuthCookie(res, token);
    res.redirect(`${process.env.FRONTEND_URL}/properties`);
};

module.exports.completeGoogleSignup = asyncHandler(async (req, res) => {
    const { token, role, username } = req.body;

    if (!token) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Token is required');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.GOOGLE_SIGNUP_SECRET);
    } catch (err) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid or expired token');
    }

    const { email, googleId } = decoded;

    if (!['buyer', 'seller'].includes(role)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid role selected');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'User already exists');
    }

    const user = new User({
        username,
        email,
        authMethod: 'google',
        isVerified: true,
        role: role,
        googleId: googleId
    });

    await user.save();

    const authToken = generateAuthToken(user);
    setAuthCookie(res, authToken);

    logger.info('Google signup completed', { userId: user._id });
    res.json(new ApiResponse(STATUS_CODES.OK, {
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    }, 'Profile completed successfully'));
});

