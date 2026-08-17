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

// CORS Configuration allowing both Render hosted backend & localhost origins
const defaultAllowedOrigins = [
    'https://touristgeofencing-s787.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://10.0.2.2:3000'
];

let allowedOrigins = [...defaultAllowedOrigins];
if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.trim()) {
    const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    allowedOrigins = Array.from(new Set([...allowedOrigins, ...customOrigins]));
}

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman) or matched allowed origins
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(null, true); // Permissive fallback to allow mobile client requests
        }
    },
    credentials: true
};
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

        // Create or update Firebase Auth user with DTID as the password
        try {
            let userRecord;
            const cleanEmail = String(email || '').trim().toLowerCase();
            try {
                userRecord = await admin.auth().getUserByEmail(cleanEmail);
                userRecord = await admin.auth().updateUser(userRecord.uid, {
                    password: dtid,
                    displayName: fullName
                });
            } catch (innerErr) {
                if (innerErr && innerErr.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email: cleanEmail,
                        password: dtid,
                        displayName: fullName,
                        emailVerified: true
                    });
                    console.log('👤 Created Firebase Auth user with DTID password');
                } else {
                    throw innerErr;
                }
            }

            if (userRecord) {
                const existingClaims = userRecord.customClaims || {};
                await admin.auth().setCustomUserClaims(userRecord.uid, {
                    ...existingClaims,
                    role: 'tourist',
                    dtid
                });
                console.log('🔄 Updated Firebase Auth user with DTID password and tourist claims');

                // Store Firebase Auth UID on tourist document for Firestore security rule validation
                await db.collection('tourists').doc(dtid).update({
                    uid: userRecord.uid
                });
                console.log('🆔 Linked Firebase Auth UID to Firestore tourist record:', userRecord.uid);
            }
        } catch (authErr) {
            console.error('⚠️  Firebase Auth registration sync error:', {
                email: String(email || '').trim().toLowerCase(),
                dtidSuffix: String(dtid || '').slice(-4),
                errorCode: authErr?.code,
                errorMessage: authErr?.message
            });
            // Rollback Firestore creation if Auth sync failed
            try {
                await db.collection('tourists').doc(dtid).delete();
            } catch (deleteErr) {
                console.error('Failed to rollback Firestore tourist record:', deleteErr);
            }
            return res.status(500).json({ error: 'Failed to create authentication credentials for tourist.' });
        }

        // Return success response ONLY after Firestore + Firebase Auth sync succeeds
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
        const updatedData = data.map(tourist => {
            const updated = computeTouristActiveStatus(tourist);
            if (updated.gpsStatus || updated.lastKnownLocation) {
                console.log(`[TOURIST API] DTID: ${updated.dtid} | gpsStatus: ${updated.gpsStatus} | lastKnownLocation:`, updated.lastKnownLocation);
            }
            return updated;
        });

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
        console.log('[GPS API DEBUG]');
        console.log('  DTID:', updated.dtid);
        console.log('  gpsStatus:', updated.gpsStatus);
        console.log('  lastKnownLocation:', updated.lastKnownLocation);
        console.log('  lastLocationStatusUpdate:', updated.lastLocationStatusUpdate);
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

// Check if a tourist account is active by DTID and email & self-heal Firebase Auth password sync
app.post('/api/is-active', async (req, res) => {
    const { dtid, email } = req.body || {};
    const cleanDtid = String(dtid || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanDtid || !cleanEmail) {
        return res.status(400).json({ error: 'dtid and email are required', isActive: false });
    }

    try {
        const tourist = await Tourist.findByDtid(cleanDtid);
        if (!tourist) {
            return res.status(404).json({ error: 'Tourist not found', isActive: false });
        }

        // Ensure status is calculated dynamically
        const updated = computeTouristActiveStatus(tourist);

        // Normalized Email ↔ DTID ownership validation
        if (String(updated.email || '').trim().toLowerCase() !== cleanEmail) {
            return res.status(400).json({ error: 'Email address does not match the registered DTID', isActive: false });
        }

        // Active status and return date validation
        if (!updated.isActive) {
            return res.status(403).json({ error: 'Tourist pass has expired or is inactive', isActive: false });
        }

        // Synchronize Firebase Auth user password to DTID and set custom claims
        try {
            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(cleanEmail);
                userRecord = await admin.auth().updateUser(userRecord.uid, {
                    password: cleanDtid,
                    displayName: updated.fullName
                });
            } catch (authFetchErr) {
                if (authFetchErr && authFetchErr.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email: cleanEmail,
                        password: cleanDtid,
                        displayName: updated.fullName,
                        emailVerified: true
                    });
                } else {
                    throw authFetchErr;
                }
            }

            if (userRecord) {
                const existingClaims = userRecord.customClaims || {};
                await admin.auth().setCustomUserClaims(userRecord.uid, {
                    ...existingClaims,
                    role: 'tourist',
                    dtid: updated.dtid
                });

                // Self-heal: Backfill Firebase Auth UID to existing tourist record if missing
                if (!updated.uid || updated.uid !== userRecord.uid) {
                    await db.collection('tourists').doc(updated.dtid).update({
                        uid: userRecord.uid
                    });
                    console.log('🩹 Backfilled missing Auth UID to existing tourist record:', userRecord.uid);
                }
            }
        } catch (authError) {
            console.error('Firebase Auth synchronization failed:', {
                email: cleanEmail,
                dtidSuffix: cleanDtid.slice(-4),
                errorCode: authError?.code,
                errorMessage: authError?.message
            });

            return res.status(500).json({
                error: 'Unable to prepare tourist authentication.',
                isActive: false
            });
        }

        // Return success ONLY after Firebase Auth synchronization succeeds
        return res.status(200).json({
            dtid: updated.dtid,
            isActive: true
        });

    } catch (err) {
        console.error('Error checking active status:', err);
        return res.status(500).json({ error: 'Something went wrong, please try again.', isActive: false });
    }
});

// Restricted Geofenced Zones APIs (Admin manage, Admin/Police/Forest read)
app.get('/api/restricted-zones', authenticateToken, requireRole('admin', 'police', 'forest'), async (req, res) => {
    try {
        const snapshot = await db.collection('restricted_zones').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(data);
    } catch (err) {
        console.error('Error fetching restricted zones:', err);
        res.status(500).json({ error: 'Failed to fetch restricted zones' });
    }
});

app.post('/api/restricted-zones', authenticateToken, requireRole('admin'), async (req, res) => {
    const { name, description, risk_level, polygon } = req.body || {};
    if (!name || !Array.isArray(polygon) || polygon.length === 0) {
        return res.status(400).json({ error: 'Name and at least one coordinate point are required' });
    }

    try {
        const formattedPolygon = polygon.map(pt => ({
            latitude: parseFloat(pt.latitude),
            longitude: parseFloat(pt.longitude)
        }));

        const docRef = await db.collection('restricted_zones').add({
            name: String(name).trim(),
            description: String(description || '').trim(),
            risk_level: risk_level || 'high',
            polygon: formattedPolygon,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ id: docRef.id, status: 'success', message: 'Restricted zone added successfully' });
    } catch (err) {
        console.error('Error adding restricted zone:', err);
        res.status(500).json({ error: 'Failed to add restricted zone' });
    }
});

app.put('/api/restricted-zones/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { name, description, risk_level, polygon } = req.body || {};
    if (!id || !name || !Array.isArray(polygon) || polygon.length === 0) {
        return res.status(400).json({ error: 'ID, name, and polygon coordinates are required' });
    }

    try {
        const docRef = db.collection('restricted_zones').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Restricted zone not found' });
        }

        const formattedPolygon = polygon.map(pt => ({
            latitude: parseFloat(pt.latitude),
            longitude: parseFloat(pt.longitude)
        }));

        await docRef.update({
            name: String(name).trim(),
            description: String(description || '').trim(),
            risk_level: risk_level || 'high',
            polygon: formattedPolygon,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ status: 'success', message: 'Restricted zone updated successfully' });
    } catch (err) {
        console.error('Error updating restricted zone:', err);
        res.status(500).json({ error: 'Failed to update restricted zone' });
    }
});

app.delete('/api/restricted-zones/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Zone ID is required' });

    try {
        await db.collection('restricted_zones').doc(id).delete();
        res.json({ status: 'success', message: 'Restricted zone deleted successfully' });
    } catch (err) {
        console.error('Error deleting restricted zone:', err);
        res.status(500).json({ error: 'Failed to delete restricted zone' });
    }
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
