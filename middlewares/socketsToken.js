const jwt = require('jsonwebtoken');


const verifySocketToken = (socket, next) => {
    try {
        let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        
        // Also check token cookie
        if (!token && socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie.split(';');
            const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
            if (tokenCookie) {
                token = tokenCookie.split('=')[1];
            }
        }

        if (!token) {
            return next(new Error('Authentication error: No token provided.'));
        }

        jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return next(new Error('Authentication error: Invalid token.'));
            }

            socket.user = decoded; // Attach user info to socket

            // Schedule a disconnect when the JWT expires
            if (decoded.exp) {
                const expiresInMs = (decoded.exp * 1000) - Date.now();
                if (expiresInMs > 0) {
                    setTimeout(() => {
                        socket.disconnect(true);
                    }, expiresInMs);
                } else {
                    return next(new Error('Authentication error: Token expired.'));
                }
            }

            next(); // Move to next middleware
        });
    } catch (error) {
        next(new Error('Authentication error: Something went wrong.'));
    }
};

module.exports = verifySocketToken;