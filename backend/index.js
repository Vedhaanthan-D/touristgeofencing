require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Tourist = require('./models/Tourist');
const { admin, db } = require('./firebase-config');

const app = express();
app.use(bodyParser.json());
const cors = require('cors');

// Allow all origins (for development only)
app.use(cors());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Firebase connection verification
console.log('Firebase Admin SDK initialized successfully');
console.log('Project ID:', admin.app().options.projectId);
console.log('✅ Backend running WITHOUT blockchain (deployment mode)');

app.post('/api/register', async (req, res) => {
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
    const aadhaarHash = crypto.createHash('sha256').update(aadhaar).digest('hex');
    
    // Set start date as current date and use provided return date
    const currentDate = new Date().toISOString().split('T')[0];
    const updatedTripDetails = {
        ...tripDetails,
        startDate: currentDate,
        returnDate: tripDetails.returnDate
    };
    
    const tripHash = crypto.createHash('sha256').update(JSON.stringify(updatedTripDetails)).digest('hex');
    const issuedAt = Math.floor(Date.now() / 1000);
    const returnDate = Math.floor(new Date(tripDetails.returnDate).getTime() / 1000);
    
    // Calculate number of travellers (main person + family members)
    const numberOfTravellers = 1 + (familyMembers ? familyMembers.length : 0);

    try {
        // Register tourist (without blockchain for easy deployment)
        console.log('📝 Registering tourist:', fullName);

        // Save to Firebase Firestore
        const tourist = new Tourist({ 
            dtid, 
            aadhaar,
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

        // Create or update Firebase Auth user with DTID as password
        try {
            let userRecord;
            try {
                userRecord = await admin.auth().getUserByEmail(email);
            } catch (innerErr) {
                // If not found, create user
                if (innerErr && innerErr.code === 'auth/user-not-found') {
                    userRecord = await admin.auth().createUser({
                        email,
                        password: dtid,
                        displayName: fullName,
                        emailVerified: true,
                    });
                    console.log('👤 Created Firebase Auth user');
                } else {
                    throw innerErr;
                }
            }

            // If user exists, update password to current DTID to keep in sync
            if (userRecord) {
                await admin.auth().updateUser(userRecord.uid, {
                    password: dtid,
                    displayName: fullName,
                });
                console.log('🔄 Updated Firebase Auth user');
            }
        } catch (authErr) {
            console.error('⚠️  Firebase Auth sync error:', authErr);
            // Do not fail registration due to auth sync issues; client can retry sign-in
        }

        // Return success response (without blockchain)
        res.json({ 
            dtid, 
            status: 'success',
            message: 'Tourist registered successfully without blockchain'
        });

    } catch (err) {
        console.error('Registration error:', err);
        const errorMessage = err.message || 'Registration failed. Please try again.';
        res.status(500).json({ 
            error: errorMessage
        });
    }
});

const updateTouristStatus = async (tourist) => {
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > tourist.returnDate && tourist.isActive) {
        await tourist.update({ isActive: false });
    }
    return tourist;
};

app.get('/api/tourists', async (req, res) => {
    try {
        const data = await Tourist.find();

        // Calculate status on the fly without writing to Firestore
        // This prevents unnecessary writes on every read
        const currentTime = Math.floor(Date.now() / 1000);
        const updatedData = data.map(tourist => {
            // Calculate isActive based on returnDate without writing to DB
            const isActive = tourist.isActive && currentTime <= tourist.returnDate;
            return { ...tourist, isActive };
        });

        res.json(updatedData);
    } catch (err) {
        console.error('Error fetching tourists:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fetch single tourist by DTID
app.get('/api/tourists/:dtid', async (req, res) => {
    const { dtid } = req.params;
    if (!dtid) return res.status(400).json({ error: 'dtid is required' });

    try {
        const tourist = await Tourist.findByDtid(dtid);
        if (!tourist) return res.status(404).json({ error: 'Tourist not found' });
        const updated = await updateTouristStatus(tourist);
        return res.json(updated);
    } catch (err) {
        console.error('Error fetching tourist by dtid:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Fetch panic alert emergencies
app.get('/api/panic-alerts', async (req, res) => {
    try {
        const snapshot = await db
            .collection('panic_alert_emergencies')
            .orderBy('createdAt', 'desc')
            .get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(data);
    } catch (err) {
        console.error('Error fetching panic alerts:', err);
        res.status(500).json({ error: err.message });
    }
});

// Fetch safety alerts (for missing complaints screen)
app.get('/api/safety-alerts', async (req, res) => {
    try {
        const snapshot = await db
            .collection('safety_alerts')
            .orderBy('createdAt', 'desc')
            .get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(data);
    } catch (err) {
        console.error('Error fetching safety alerts:', err);
        res.status(500).json({ error: err.message });
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

        // Ensure status is up-to-date based on returnDate
        const updated = await updateTouristStatus(tourist);

        // Basic email match validation
        if (String(updated.email).toLowerCase() !== String(email).toLowerCase()) {
            return res.status(400).json({ error: 'Email does not match DTID' });
        }

        return res.json({ dtid: updated.dtid, isActive: !!updated.isActive });
    } catch (err) {
        console.error('Error checking active status:', err);
        return res.status(500).json({ error: err.message });
    }
});

// BLOCKCHAIN ENDPOINTS DISABLED FOR DEPLOYMENT
// Uncomment these if you want to use blockchain features

// app.get('/api/verify-blockchain/:dtid', async (req, res) => {
//     const { dtid } = req.params;
//     res.status(503).json({ 
//         verified: false,
//         error: 'Blockchain verification disabled for deployment' 
//     });
// });

// app.get('/api/blockchain-info', async (req, res) => {
//     res.status(503).json({ 
//         error: 'Blockchain info disabled for deployment' 
//     });
// });

app.listen(3000, () => console.log('Backend running at http://localhost:3000'));
