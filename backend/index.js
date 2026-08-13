require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Tourist = require('./models/Tourist');
const { admin, db } = require('./firebase-config');
const authenticateToken = require('./middleware/authenticateToken');
const requireRole = require('./middleware/requireRole');
const registerRateLimiter = require('./middleware/registerRateLimiter');
const validateRegistration = require('./middleware/validateRegistration');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.json());

// CORS Configuration with strict origin checking
let corsOptions;
if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    corsOptions = { origin: allowedOrigins, credentials: true };
} else {
    console.warn('⚠️  ALLOWED_ORIGINS environment variable is not configured. Cross-origin requests will be rejected.');
    corsOptions = { origin: false, credentials: true };
}
app.use(cors(corsOptions));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Route to verify current authenticated user email & custom role claims
app.get('/api/whoami', authenticateToken, (req, res) => {
    res.status(200).json({
        email: req.user.email || null,
        uid: req.user.uid || null,
        role: req.user.role || null
    });
});

if (!process.env.AADHAAR_HMAC_SECRET) {
    throw new Error('FATAL: AADHAAR_HMAC_SECRET environment variable is missing.');
}

// Firebase connection verification
console.log('Firebase Admin SDK initialized successfully');
console.log('Project ID:', admin.app().options.projectId);

app.post('/api/register', authenticateToken, requireRole('admin', 'immigration'), registerRateLimiter, validateRegistration, async (req, res) => {
    const { 
        aadhaar, 
        fullName, 
        age, 
        gender, 
        email, 
        mobileNumber, 
        familyMembers, 
        tripDetails, 
        emergencyContacts 
    } = req.body;

    const dtid = uuidv4();
    const aadhaarString = String(aadhaar || '').trim();
    const aadhaarHash = crypto.createHmac('sha256', process.env.AADHAAR_HMAC_SECRET).update(aadhaarString).digest('hex');
    const aadhaarLast4 = aadhaarString.slice(-4);
    
    // Set start date as current date and use provided return date
    const currentDate = new Date().toISOString().split('T')[0];
    const updatedTripDetails = {
        ...tripDetails,
        startDate: currentDate,
        returnDate: tripDetails.returnDate
    };
    
    const issuedAt = Math.floor(Date.now() / 1000);
    const returnDate = Math.floor(new Date(tripDetails.returnDate).getTime() / 1000);
    
    // Calculate number of travellers (main person + family members)
    const numberOfTravellers = 1 + (familyMembers ? familyMembers.length : 0);

    try {
        // Check if an active tourist pass already exists for this Aadhaar hash
        const existingSnapshot = await db.collection('tourists')
            .where('aadhaarHash', '==', aadhaarHash)
            .where('isActive', '==', true)
            .get();

        if (!existingSnapshot.empty) {
            return res.status(400).json({ error: 'An active tourist pass already exists for this Aadhaar/Passport.' });
        }

        // Register tourist
        console.log('📝 Registering tourist:', fullName);

        // Save to Firebase Firestore
        const tourist = new Tourist({ 
            dtid, 
            aadhaarHash,
            aadhaarLast4,
            fullName,
            age,
            gender,
            email,
            mobileNumber,
            familyMembers: familyMembers || [],
            numberOfTravellers,
            tripDetails: updatedTripDetails, 
            emergencyContacts, 
            issuedAt, 
            returnDate,
            isActive: true
        });
        await tourist.save();
        console.log('💾 Saved to Firestore');

        // Create or update Firebase Auth user with a random secret
        try {
            const randomAuthPassword = crypto.randomBytes(16).toString('hex');
            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(email);
            } catch (innerErr) {
                if (innerErr && innerErr.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email,
                        password: randomAuthPassword,
                        displayName: fullName,
                        emailVerified: true,
                    });
                    console.log('👤 Created Firebase Auth user');
                } else {
                    throw innerErr;
                }
            }

            if (userRecord) {
                await admin.auth().updateUser(userRecord.uid, {
                    password: randomAuthPassword,
                    displayName: fullName,
                });
                console.log('🔄 Updated Firebase Auth user');
            }
        } catch (authErr) {
            console.error('⚠️  Firebase Auth sync error:', authErr);
        }

        // Return success response
        res.json({ 
            dtid, 
            aadhaarLast4,
            status: 'success',
            message: 'Tourist registered successfully'
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Something went wrong, please try again.' });
    }
});

const computeTouristActiveStatus = (tourist) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const isActive = tourist.isActive && currentTime <= tourist.returnDate;
    return { ...tourist, isActive };
};

app.get('/api/tourists', authenticateToken, requireRole('admin', 'police', 'forest'), async (req, res) => {
    try {
        const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const startAfter = req.query.startAfter ? String(req.query.startAfter) : null;
        const data = await Tourist.find({ limit: limitParam, startAfter });

        // Calculate status on the fly without writing to Firestore during GET reads
        const updatedData = data.map(tourist => computeTouristActiveStatus(tourist));

        res.json(updatedData);
    } catch (err) {
        console.error('Error fetching tourists:', err);
        res.status(500).json({ error: 'Something went wrong, please try again.' });
    }
});

// Fetch single tourist by DTID
app.get('/api/tourists/:dtid', authenticateToken, requireRole('admin', 'police', 'forest'), async (req, res) => {
    const { dtid } = req.params;
    if (!dtid) return res.status(400).json({ error: 'dtid is required' });

    try {
        const tourist = await Tourist.findByDtid(dtid);
        if (!tourist) return res.status(404).json({ error: 'Tourist not found' });
        const updated = computeTouristActiveStatus(tourist);
        return res.json(updated);
    } catch (err) {
        console.error('Error fetching tourist by dtid:', err);
        return res.status(500).json({ error: 'Something went wrong, please try again.' });
    }
});

// Fetch panic alert emergencies
app.get('/api/panic-alerts', authenticateToken, requireRole('admin', 'police', 'forest'), async (req, res) => {
    try {
        const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        let queryRef = db.collection('panic_alert_emergencies').orderBy('createdAt', 'desc').limit(limitParam);

        if (req.query.startAfter) {
            const startDoc = await db.collection('panic_alert_emergencies').doc(String(req.query.startAfter)).get();
            if (startDoc.exists) {
                queryRef = queryRef.startAfter(startDoc);
            }
        }

        const snapshot = await queryRef.get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(data);
    } catch (err) {
        console.error('Error fetching panic alerts:', err);
        res.status(500).json({ error: 'Something went wrong, please try again.' });
    }
});

// Fetch safety alerts (for missing complaints screen)
app.get('/api/safety-alerts', authenticateToken, requireRole('admin', 'police', 'forest'), async (req, res) => {
    try {
        const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        let queryRef = db.collection('safety_alerts').orderBy('createdAt', 'desc').limit(limitParam);

        if (req.query.startAfter) {
            const startDoc = await db.collection('safety_alerts').doc(String(req.query.startAfter)).get();
            if (startDoc.exists) {
                queryRef = queryRef.startAfter(startDoc);
            }
        }

        const snapshot = await queryRef.get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(data);
    } catch (err) {
        console.error('Error fetching safety alerts:', err);
        res.status(500).json({ error: 'Something went wrong, please try again.' });
    }
});

// Set user role (Admin only endpoint)
app.post('/api/admin/set-role', authenticateToken, requireRole('admin'), async (req, res) => {
    const { email, role } = req.body || {};
    const VALID_ROLES = ['admin', 'police', 'forest', 'immigration'];
    if (!email || !VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Valid email and role (admin, police, forest, immigration) are required' });
    }
    try {
        const targetUser = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(targetUser.uid, { role });
        return res.json({ status: 'success', message: `Assigned role ${role} to ${email}` });
    } catch (err) {
        console.error('Error setting role:', err);
        return res.status(500).json({ error: err.message || 'Failed to assign role' });
    }
});

// Check if a tourist account is active by DTID and email
app.post('/api/is-active', async (req, res) => {
    const { dtid, email } = req.body || {};
    if (!dtid || !email) {
        return res.status(400).json({ error: 'dtid and email are required' });
    }

    try {
        const tourist = await Tourist.findByDtid(dtid);
        if (!tourist) {
            return res.status(404).json({ error: 'Tourist not found' });
        }

        // Ensure status is calculated dynamically
        const updated = computeTouristActiveStatus(tourist);

        // Basic email match validation
        if (String(updated.email).toLowerCase() !== String(email).toLowerCase()) {
            return res.status(400).json({ error: 'Email does not match DTID' });
        }

        return res.json({ dtid: updated.dtid, isActive: !!updated.isActive });
    } catch (err) {
        console.error('Error checking active status:', err);
        return res.status(500).json({ error: 'Something went wrong, please try again.' });
    }
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
