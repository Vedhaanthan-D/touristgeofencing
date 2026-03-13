import { useState } from 'react';
import axios from 'axios';
import './Registration.css';

function Registration() {
    const [formData, setFormData] = useState({
        aadhaar: '',
        fullName: '',
        age: '',
        gender: '',
        email: '',
        mobileNumber: '',
        familyMembers: [],
        tripDetails: {
            destination: '',
            returnDate: ''
        },
        emergencyContacts: [
            { name: '', phone: '' },
            { name: '', phone: '' }
        ]
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('trip.')) {
            const tripField = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                tripDetails: {
                    ...prev.tripDetails,
                    [tripField]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleContactChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            emergencyContacts: prev.emergencyContacts.map((contact, i) => 
                i === index ? { ...contact, [field]: value } : contact
            )
        }));
    };

    const addContact = () => {
        setFormData(prev => ({
            ...prev,
            emergencyContacts: [...prev.emergencyContacts, { name: '', phone: '' }]
        }));
    };

    const removeContact = (index) => {
        if (formData.emergencyContacts.length > 1) {
            setFormData(prev => ({
                ...prev,
                emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index)
            }));
        }
    };

    const handleFamilyMemberChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            familyMembers: prev.familyMembers.map((member, i) => 
                i === index ? { ...member, [field]: value } : member
            )
        }));
    };

    const addFamilyMember = () => {
        setFormData(prev => ({
            ...prev,
            familyMembers: [...prev.familyMembers, { fullName: '', age: '', gender: '' }]
        }));
    };

    const removeFamilyMember = (index) => {
        setFormData(prev => ({
            ...prev,
            familyMembers: prev.familyMembers.filter((_, i) => i !== index)
        }));
    };

    const validateForm = () => {
        // Aadhaar: exactly 12 digits / Passport: 6-9 alphanumeric chars
        const aadhaarRegex = /^\d{12}$/;
        const passportRegex = /^[A-Z0-9]{6,9}$/i;
        if (!formData.aadhaar) {
            return 'Please enter your Aadhar or Passport number';
        }
        if (!aadhaarRegex.test(formData.aadhaar) && !passportRegex.test(formData.aadhaar)) {
            return 'Enter a valid Aadhaar (12 digits) or Passport number (6–9 alphanumeric characters)';
        }
        if (!formData.fullName || formData.fullName.trim().length < 2) {
            return 'Please enter your full name (at least 2 characters)';
        }
        if (!/^[a-zA-Z\s]+$/.test(formData.fullName.trim())) {
            return 'Full name should contain only letters';
        }
        if (!formData.age || isNaN(formData.age) || formData.age < 1 || formData.age > 120) {
            return 'Please enter a valid age (1–120)';
        }
        if (!formData.gender) {
            return 'Please select your gender';
        }
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            return 'Please enter a valid email address';
        }
        if (!formData.mobileNumber || !/^\d{10}$/.test(formData.mobileNumber)) {
            return 'Please enter a valid 10-digit mobile number (digits only)';
        }
        if (!formData.tripDetails.destination || formData.tripDetails.destination.trim().length < 2) {
            return 'Please enter a valid destination';
        }
        if (!formData.tripDetails.returnDate) {
            return 'Please enter a return date';
        }
        if (new Date(formData.tripDetails.returnDate) <= new Date()) {
            return 'Return date must be in the future';
        }
        const validContacts = formData.emergencyContacts.filter(contact =>
            contact.name && contact.phone
        );
        if (validContacts.length === 0) {
            return 'Please add at least one emergency contact with name and phone';
        }
        for (const contact of validContacts) {
            if (!/^\+?\d{7,15}$/.test(contact.phone.replace(/\s/g, ''))) {
                return `Emergency contact "${contact.name}" has an invalid phone number`;
            }
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Filter out empty contacts
            const validContacts = formData.emergencyContacts.filter(contact => 
                contact.name && contact.phone
            );

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/register`, {
        aadhaar: formData.aadhaar,
                fullName: formData.fullName,
                age: parseInt(formData.age),
                gender: formData.gender,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
                familyMembers: formData.familyMembers,
                tripDetails: formData.tripDetails,
                emergencyContacts: validContacts
            });

            setSuccess({
                dtid: response.data.dtid,
                message: 'Tourist registration successful!'
            });

            // Reset form
            setFormData({
                aadhaar: '',
                fullName: '',
                age: '',
                gender: '',
                email: '',
                mobileNumber: '',
                familyMembers: [],
                tripDetails: {
                    destination: '',
                    returnDate: ''
                },
                emergencyContacts: [
                    { name: '', phone: '' },
                    { name: '', phone: '' }
                ]
            });

        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reg-registration-container">
            <div className="reg-registration-header">
                <div className="header-content">
                    <h1 className="reg-registration-title">
                        <span className="reg-title-icon">📝</span>
                        Tourist Registration
                    </h1>
                    <p className="reg-registration-subtitle">Register for your Digital Tourist ID (DTID)</p>
                </div>
            </div>

            <div className="reg-registration-main">
                {success && (
                    <div className="reg-success-message">
                        <div className="reg-success-icon">✅</div>
                        <h3>Registration Successful!</h3>
                        <p>Your Digital Tourist ID has been generated:</p>
                        <div className="reg-dtid-display">{success.dtid}</div>
                        <p>Please save this ID for your records.</p>
                    </div>
                )}

                {error && (
                    <div className="reg-error-message">
                        <div className="reg-error-icon">⚠️</div>
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="reg-registration-form">
                    <div className="reg-form-section">
                        <h3 className="reg-section-title">
                            <span className="reg-section-icon">🪪</span>
                            Personal Information
                        </h3>
                        
                        <div className="reg-form-group">
                            <label htmlFor="aadhaar" className="reg-form-label">
                                Aadhar Number/Passport Number *
                            </label>
                            <input
                                type="text"
                                id="aadhaar"
                                name="aadhaar"
                                value={formData.aadhaar}
                                onChange={handleInputChange}
                                placeholder="Enter Aadhar or Passport Number"
                                className="reg-form-input"
                                required
                            />
                            <a href="#" className="reg-scan-link" onClick={(e) => e.preventDefault()}>
                                Click here to scan the document
                            </a>
                        </div>

                        <div className="reg-form-group">
                            <label htmlFor="fullName" className="reg-form-label">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                placeholder="Enter your full name"
                                className="reg-form-input"
                                required
                            />
                        </div>

                        <div className="reg-form-row">
                            <div className="reg-form-group">
                                <label htmlFor="age" className="reg-form-label">
                                    Age *
                                </label>
                                <input
                                    type="number"
                                    id="age"
                                    name="age"
                                    value={formData.age}
                                    onChange={handleInputChange}
                                    placeholder="Enter age"
                                    className="reg-form-input"
                                    min="1"
                                    max="120"
                                    required
                                />
                            </div>

                            <div className="reg-form-group">
                                <label htmlFor="gender" className="reg-form-label">
                                    Gender *
                                </label>
                                <select
                                    id="gender"
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleInputChange}
                                    className="reg-form-input"
                                    required
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="reg-form-row">
                            <div className="reg-form-group">
                                <label htmlFor="email" className="reg-form-label">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Enter email address"
                                    className="reg-form-input"
                                    required
                                />
                            </div>

                            <div className="reg-form-group">
                                <label htmlFor="mobileNumber" className="reg-form-label">
                                    Mobile Number *
                                </label>
                                <input
                                    type="tel"
                                    id="mobileNumber"
                                    name="mobileNumber"
                                    value={formData.mobileNumber}
                                    onChange={handleInputChange}
                                    placeholder="Enter 10-digit mobile number"
                                    className="reg-form-input"
                                    maxLength="10"
                                    pattern="[0-9]{10}"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="reg-form-section">
                        <h3 className="reg-section-title">
                            <span className="reg-section-icon">👥</span>
                            Family Members / Travel Companions
                        </h3>
                        
                        <p className="reg-section-description">
                            Add family members or travel companions (if any). Leave empty if traveling alone.
                        </p>

                        {formData.familyMembers.map((member, index) => (
                            <div key={index} className="family-member-group">
                                <div className="contact-header">
                                    <h4>Family Member {index + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeFamilyMember(index)}
                                        className="reg-remove-contact-btn"
                                    >
                                        Remove
                                    </button>
                                </div>
                                
                                <div className="reg-form-group">
                                    <label className="reg-form-label">Full Name</label>
                                    <input
                                        type="text"
                                        value={member.fullName}
                                        onChange={(e) => handleFamilyMemberChange(index, 'fullName', e.target.value)}
                                        placeholder="Enter full name"
                                        className="reg-form-input"
                                    />
                                </div>

                                <div className="reg-form-row">
                                    <div className="reg-form-group">
                                        <label className="reg-form-label">Age</label>
                                        <input
                                            type="number"
                                            value={member.age}
                                            onChange={(e) => handleFamilyMemberChange(index, 'age', e.target.value)}
                                            placeholder="Age"
                                            className="reg-form-input"
                                            min="1"
                                            max="120"
                                        />
                                    </div>

                                    <div className="reg-form-group">
                                        <label className="reg-form-label">Gender</label>
                                        <select
                                            value={member.gender}
                                            onChange={(e) => handleFamilyMemberChange(index, 'gender', e.target.value)}
                                            className="reg-form-input"
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addFamilyMember}
                            className="reg-add-contact-btn"
                        >
                            <span className="btn-icon">+</span>
                            Add Family Member
                        </button>
                    </div>

                    <div className="reg-form-section">
                        <h3 className="reg-section-title">
                            <span className="reg-section-icon">✈️</span>
                            Trip Details
                        </h3>
                        
                        <div className="reg-form-group">
                            <label htmlFor="destination" className="reg-form-label">
                                Destination *
                            </label>
                            <input
                                type="text"
                                id="destination"
                                name="trip.destination"
                                value={formData.tripDetails.destination}
                                onChange={handleInputChange}
                                placeholder="Enter destination"
                                className="reg-form-input"
                                required
                            />
                        </div>

                        <div className="reg-form-group">
                            <label htmlFor="returnDate" className="reg-form-label">
                                Return Date *
                            </label>
                            <input
                                type="date"
                                id="returnDate"
                                name="trip.returnDate"
                                value={formData.tripDetails.returnDate}
                                onChange={handleInputChange}
                                className="reg-form-input"
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                            <small className="form-help">
                                Start date will be set as today's date automatically
                            </small>
                        </div>
                    </div>

                    <div className="reg-form-section">
                        <h3 className="reg-section-title">
                            <span className="reg-section-icon">📞</span>
                            Emergency Contacts
                        </h3>
                        
                        {formData.emergencyContacts.map((contact, index) => (
                            <div key={index} className="reg-contact-group">
                                <div className="contact-header">
                                    <h4>Contact {index + 1}</h4>
                                    {formData.emergencyContacts.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeContact(index)}
                                            className="reg-remove-contact-btn"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                
                                <div className="reg-form-row">
                                    <div className="reg-form-group">
                                        <label className="reg-form-label">Name</label>
                                        <input
                                            type="text"
                                            value={contact.name}
                                            onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                                            placeholder="Contact name"
                                            className="reg-form-input"
                                        />
                                    </div>

                                    <div className="reg-form-group">
                                        <label className="reg-form-label">Phone</label>
                                        <input
                                            type="tel"
                                            value={contact.phone}
                                            onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                                            placeholder="+91-XXXXXXXXXX"
                                            className="reg-form-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addContact}
                            className="reg-add-contact-btn"
                        >
                            <span className="btn-icon">+</span>
                            Add Another Contact
                        </button>
                    </div>

                    <div className="reg-form-actions">
                        <button
                            type="submit"
                            disabled={loading}
                            className="reg-submit-btn"
                        >
                            {loading ? (
                                <>
                                    <div className="btn-spinner"></div>
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <span className="btn-icon">🆔</span>
                                    Generate Digital Tourist ID
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Registration;