const rateLimit = require('express-rate-limit');

/** Rate limiter for registration endpoint limiting to 10 requests per IP per hour. */
const registerRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many registration requests from this IP, please try again after an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = registerRateLimiter;
