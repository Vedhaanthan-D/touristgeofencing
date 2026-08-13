/** Middleware factory to restrict route access by user role custom claims. */
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Your role does not have access to this resource.' });
    }
    next();
};

module.exports = requireRole;
