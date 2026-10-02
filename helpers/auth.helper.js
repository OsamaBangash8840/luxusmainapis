const transporter = require('../config/emailTransporter');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');


const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateAuthToken = (user) => {
    if (!process.env.TOKEN_SECRET) {
        throw new Error('TOKEN_SECRET not configured');
    }
    return jwt.sign(
        { email: user.email, id: user._id, role: user.role },
        process.env.TOKEN_SECRET,
        { expiresIn: "15m" }
    );
};

const generateRefreshToken = (user) => {
    return crypto.randomBytes(40).toString('hex');
};

const sendVerificationEmail = async (user) => {
    try {
        const verificationToken = generateVerificationToken();
        const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        // Update user with verification token
        user.verificationToken = hashedToken;
        user.verificationTokenExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        const mailOptions = {
            from: process.env.EMAIL,
            to: user.email,
            subject: 'Verify Your Email',
            html: `
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
                    <h2 style="color: #333; text-align: center;">Email Verification</h2>
                    <p style="color: #666;text-align: center">Please click the button below to verify your email address:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}" 
                           style="background-color: #4CAF50; 
                                  color: white; 
                                  padding: 12px 30px; 
                                  text-decoration: none; 
                                  border-radius: 5px;
                                  display: inline-block;">
                            Verify Email
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
                    <p style="color: #999; font-size: 12px;">If the button doesn't work, you can copy and paste this link into your browser:</p>
                    <p style="color: #666; font-size: 12px; word-break: break-all;">${verificationLink}</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send verification email');
    }
};

const getHashValue = async (value) => {
    const salt = await bcrypt.genSalt(10);
    const hashedValue = await bcrypt.hash(value, salt);
    return hashedValue
}

const isPasswordMatch = async (password, userpassword) => {
    const isMatch = await bcrypt.compare(password, userpassword);
    return isMatch
}

const setAuthCookie = (res, token, refreshToken = null) => {
    // 15m token lifetime
    const maxAge = 15 * 60 * 1000; 
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax', // or 'none' if needed
        maxAge: maxAge,
    });
    
    if (refreshToken) {
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
    }
};

module.exports = { sendVerificationEmail, transporter, isPasswordMatch, generateAuthToken, generateVerificationToken, getHashValue, setAuthCookie, generateRefreshToken };