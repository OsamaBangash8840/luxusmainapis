const User = require("../models/User")
const jwt = require('jsonwebtoken');

module.exports.adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) res.status(403).send("Access Denied")
        // console.log(token)

        const verifiedAdmin = jwt.verify(token, process.env.TOKEN_SECRET)
        const user = await User.findById(verifiedAdmin.id);
        if (!user || user.role !== 'admin') {
            throw new Error();
        }
        req.user = user;
        next()
    } catch (error) {
        res.status(440).json({ message: 'Not authorized as admin' });
    }
}