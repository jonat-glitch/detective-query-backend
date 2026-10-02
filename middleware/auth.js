const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: "Access token missing" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: "Token invalid or expired" });
        }

        req.user = user;
        next();
    });
}

function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role_id)) {
            return res.status(403).json({ error: "Access forbidden" });
        }
        next();
    };
}

// Convenience shorthand: only role_id === 3 (admin) passes
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role_id !== 3) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = {
    authenticateToken,
    authorizeRole,
    requireAdmin,
};