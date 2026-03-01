const jwt = require('jsonwebtoken');
const { systemDB } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Invalid token format.' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);

        // 🔥 IMPORTANT: make sure JWT payload contains user_id
        req.user = verified;

        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

function authorizeRole(allowedRoles) {
    return async (req, res, next) => {
        try {
            const [rows] = await systemDB.query(
                "SELECT role_id FROM users WHERE user_id = ?",
                [req.user.user_id]
            );

            if (!rows.length) {
                return res.status(401).json({ error: "User not found." });
            }

            const currentRole = rows[0].role_id;

            if (!allowedRoles.includes(currentRole)) {
                return res.status(403).json({
                    error: "Access forbidden: insufficient permissions."
                });
            }

            next();
        } catch (err) {
            console.error("Role check error:", err);
            return res.status(500).json({ error: "Authorization failed." });
        }
    };
}

module.exports = {
    authenticateToken,
    authorizeRole
};
