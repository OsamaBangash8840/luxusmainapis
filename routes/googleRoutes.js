const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Only mount Google Strategy if clientID and clientSecret are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/auth/google/callback',
            },
            async (req, accessToken, refreshToken, profile, done) => {
                try {
                    let user = await User.findOne({
                        email: profile.emails[0].value
                    });

                    if (!user) {
                        return done(null, {
                            profile: {
                                email: profile.emails[0].value,
                                displayName: profile.displayName,
                                id: profile.id
                            },
                            isNewUser: true
                        });
                    }

                    if (user.isBanned) {
                        return done(new Error('Your account has been banned.'), false);
                    }

                    const token = jwt.sign(
                        {
                            email: user.email,
                            id: user._id,
                            role: user.role
                        },
                        process.env.TOKEN_SECRET,
                        { expiresIn: "1h" }
                    );

                    return done(null, { user, token });
                } catch (error) {
                    return done(error, false);
                }
            }
        )
    );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, false);
    }
});

module.exports = passport;
