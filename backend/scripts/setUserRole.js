/** CLI script to assign role custom claims to Firebase Auth users. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { admin } = require('../firebase-config');

const [,, email, role] = process.argv;
const VALID_ROLES = ['admin', 'police', 'forest', 'immigration'];

(async () => {
    if (!email || !VALID_ROLES.includes(role)) {
        console.error('Usage: node backend/scripts/setUserRole.js <email> <admin|police|forest|immigration>');
        process.exit(1);
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { role });
        console.log(`✅ Successfully assigned role "${role}" to ${email} (UID: ${user.uid})`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error setting user role:', err.message);
        process.exit(1);
    }
})();
