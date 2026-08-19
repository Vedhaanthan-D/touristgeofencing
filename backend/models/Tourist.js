const { db } = require('../firebase-config');

/** Tourist data model for Firestore interaction storing hashed identity and last 4 digits. */
class Tourist {
    constructor(data) {
        this.dtid = data.dtid || data.id || null;
        this.uid = data.uid || null;
        this.aadhaarHash = data.aadhaarHash;
        this.aadhaarLast4 = data.aadhaarLast4;
        this.fullName = data.fullName;
        this.age = data.age;
        this.gender = data.gender;
        this.email = data.email;
        this.mobileNumber = data.mobileNumber;
        this.familyMembers = data.familyMembers || [];
        this.numberOfTravellers = data.numberOfTravellers;
        this.tripDetails = data.tripDetails;
        this.emergencyContacts = data.emergencyContacts;
        this.issuedAt = data.issuedAt;
        this.returnDate = data.returnDate;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.gpsStatus = data.gpsStatus !== undefined ? data.gpsStatus : null;
        this.lastKnownLocation = data.lastKnownLocation || null;
        this.lastLocationStatusUpdate = data.lastLocationStatusUpdate || null;
        this.createdAt = data.createdAt || null;
        this.updatedAt = data.updatedAt || null;
    }

    // Save tourist to Firestore
    async save() {
        try {
            await db.collection('tourists').doc(this.dtid).set({
                dtid: this.dtid,
                uid: this.uid,
                aadhaarHash: this.aadhaarHash,
                aadhaarLast4: this.aadhaarLast4,
                fullName: this.fullName,
                age: this.age,
                gender: this.gender,
                email: this.email,
                mobileNumber: this.mobileNumber,
                familyMembers: this.familyMembers,
                numberOfTravellers: this.numberOfTravellers,
                tripDetails: this.tripDetails,
                emergencyContacts: this.emergencyContacts,
                issuedAt: this.issuedAt,
                returnDate: this.returnDate,
                isActive: this.isActive,
                gpsStatus: this.gpsStatus,
                lastKnownLocation: this.lastKnownLocation,
                lastLocationStatusUpdate: this.lastLocationStatusUpdate,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return this;
        } catch (error) {
            throw new Error(`Error saving tourist: ${error.message}`);
        }
    }

    // Static method to find all tourists with query limit and cursor pagination
    static async find({ limit = 50, startAfter } = {}) {
        try {
            let query = db.collection('tourists').orderBy('createdAt', 'desc').limit(Number(limit) || 50);
            
            if (startAfter) {
                const startDoc = await db.collection('tourists').doc(startAfter).get();
                if (startDoc.exists) {
                    query = query.startAfter(startDoc);
                }
            }

            const snapshot = await query.get();
            const tourists = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                tourists.push(new Tourist({ ...data, dtid: data.dtid || doc.id }));
            });

            // Fallback: If orderBy('createdAt') yields 0 results (e.g. documents missing createdAt field), fetch all documents without ordering
            if (tourists.length === 0) {
                console.log('[Tourist.find] orderBy returned 0 docs. Executing un-ordered fallback query.');
                const fallbackSnap = await db.collection('tourists').limit(Number(limit) || 50).get();
                fallbackSnap.forEach(doc => {
                    const data = doc.data();
                    tourists.push(new Tourist({ ...data, dtid: data.dtid || doc.id }));
                });
            }
            
            return tourists;
        } catch (error) {
            console.warn('[Tourist.find] Error ordering by createdAt, trying fallback query:', error.message);
            try {
                const snapshot = await db.collection('tourists').limit(Number(limit) || 50).get();
                const tourists = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    tourists.push(new Tourist({ ...data, dtid: data.dtid || doc.id }));
                });
                return tourists;
            } catch (innerError) {
                throw new Error(`Error fetching tourists: ${error.message}`);
            }
        }
    }

    // Static method to find tourist by DTID
    static async findByDtid(dtid) {
        try {
            const doc = await db.collection('tourists').doc(dtid).get();
            
            if (!doc.exists) {
                return null;
            }
            
            const data = doc.data();
            return new Tourist({ ...data, dtid: data.dtid || doc.id });
        } catch (error) {
            throw new Error(`Error finding tourist: ${error.message}`);
        }
    }

    // Update tourist in Firestore
    async update(updates) {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };
            
            await db.collection('tourists').doc(this.dtid).update(updateData);
            
            // Update local instance
            Object.assign(this, updates);
            
            return this;
        } catch (error) {
            throw new Error(`Error updating tourist: ${error.message}`);
        }
    }
}

module.exports = Tourist;
