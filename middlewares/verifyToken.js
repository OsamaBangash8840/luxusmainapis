const jwt = require('jsonwebtoken');

// Middleware to verify the token from cookies
const verifyToken = (req, res, next) => {
  try {
    // Access the token from cookies
    const token = req.cookies.token;

    if (!token) return res.status(403).send('Access denied Please Log In.');

    // Verify the token
    const verified = jwt.verify(token, process.env.TOKEN_SECRET);
    req.user = verified; // Attach the verified user data to the request object
    next();
  } catch (error) {
    res.status(400).send('Invalid token.', error);
  }
};

module.exports = verifyToken;
