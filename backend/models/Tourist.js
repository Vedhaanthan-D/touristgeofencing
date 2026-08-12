const { db } = require('../firebase-config');

/** Tourist data model for Firestore interaction storing hashed identity and last 4 digits. */
class Tourist {
    constructor(data) {
        this.dtid = data.dtid;
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
    }

    // Save tourist to Firestore
    async save() {
        try {
            await db.collection('tourists').doc(this.dtid).set({
                dtid: this.dtid,
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
                tourists.push(new Tourist(data));
            });
            
            return tourists;
        } catch (error) {
            throw new Error(`Error fetching tourists: ${error.message}`);
        }
    }

    // Static method to find tourist by DTID
    static async findByDtid(dtid) {
        try {
            const doc = await db.collection('tourists').doc(dtid).get();
            
            if (!doc.exists) {
                return null;
            }
            
            return new Tourist(doc.data());
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
