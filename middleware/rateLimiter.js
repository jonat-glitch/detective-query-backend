const rateLimit = require('express-rate-limit');

// 🌍 Global API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Too many requests. Please try again later.' }
});

// 🔐 Login limiter
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Try again later.' }
});

module.exports = {
    apiLimiter,
    loginLimiter
};
