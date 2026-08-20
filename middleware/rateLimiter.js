const rateLimit = require('express-rate-limit');

// 🌍 Global API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' }
});

// 🔐 Login limiter (Per IP + Email combination, only penalizes failed attempts)
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 25,                  // 25 failed attempts allowance
    skipSuccessfulRequests: true, // Successful logins are NEVER counted
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
        return `${ip}_${email}`;
    },
    message: { error: 'Too many failed login attempts. Please wait a few minutes and try again.' }
});

module.exports = {
    apiLimiter,
    loginLimiter
};