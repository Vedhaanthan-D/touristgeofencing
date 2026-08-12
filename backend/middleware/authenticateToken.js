const { admin } = require('../firebase-config');

/** Verifies Firebase Auth ID token from the Authorization header and attaches user to request. */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decodedUser = await admin.auth().verifyIdToken(token);
        req.user = decodedUser;
        next();
    } catch (error) {
        console.error('Authentication error:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

module.exports = authenticateToken;
