require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { ethers } = require('ethers');
const Tourist = require('./models/Tourist');
const { admin, db } = require('./firebase-config');


const app = express();
app.use(bodyParser.json());
const cors = require('cors');

// Allow all origins (for development only)
app.use(cors());

// Firebase connection verification
console.log('Firebase Admin SDK initialized successfully');
console.log('Project ID:', admin.app().options.projectId);

// Configure Ethereum provider and signer
const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

let signer;
if (process.env.USE_PROVIDER_SIGNER === 'true' || /localhost|127\.0\.0\.1/.test(rpcUrl)) {
    // Use the first unlocked account from the local node (e.g., Ganache)
    signer = provider.getSigner(0);
    console.log('Using provider signer (account #0) for local development');
} else {
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is required when not using provider signer');
    }
    signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log('Using wallet from PRIVATE_KEY');
}

const abi = [
    'function registerTourist(string dtid, string aadhaarHash, string tripHash, uint256 returnDate) public',
    'function getTourist(string dtid) public view returns (tuple(string dtid, string aadhaarHash, string tripHash, uint256 issuedAt, uint256 returnDate, bool isActive))',
    'function checkAndUpdateStatus(string dtid) public',
    'function isActiveTourist(string dtid) public view returns (bool)',
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, signer);

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
        await contract.registerTourist(dtid, aadhaarHash, tripHash, returnDate);

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
            }
        } catch (authErr) {
            console.error('Firebase Auth sync error:', authErr);
            // Do not fail registration due to auth sync issues; client can retry sign-in
        }

        res.json({ dtid, status: 'success' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Function to update tourist active status
const updateTouristStatus = async (tourist) => {
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > tourist.returnDate && tourist.isActive) {
        await tourist.update({ isActive: false });
        
        // Also update on blockchain
        try {
            await contract.checkAndUpdateStatus(tourist.dtid);
        } catch (err) {
            console.error('Failed to update blockchain status:', err);
        }
    }
    return tourist;
};

app.get('/api/tourists', async (req, res) => {
    try {
        const data = await Tourist.find();
        
        // Update status for each tourist
        const updatedData = await Promise.all(
            data.map(tourist => updateTouristStatus(tourist))
        );
        
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

app.listen(3000, () => console.log('Backend running at http://localhost:3000'));
