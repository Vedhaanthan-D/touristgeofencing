const { db } = require('../firebase-config');

class Tourist {
    constructor(data) {
        this.dtid = data.dtid;
        this['aadhaar/passport'] = data.aadhaar || data['aadhaar/passport'];
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
                'aadhaar/passport': this['aadhaar/passport'],
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

    // Static method to find all tourists
    static async find() {
        try {
            const snapshot = await db.collection('tourists').get();
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
