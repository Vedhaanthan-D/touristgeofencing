import { useState, useEffect } from 'react';
import { apiClient } from '../config/api';
import './Registration.css';

function Registration() {
    const [step, setStep] = useState(1);
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
    const [copiedDtid, setCopiedDtid] = useState(false);

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
        if (error) setError(null);
    };

    const handleContactChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            emergencyContacts: prev.emergencyContacts.map((contact, i) => 
                i === index ? { ...contact, [field]: value } : contact
            )
        }));
        if (error) setError(null);
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
        if (error) setError(null);
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

    const validateStep1 = () => {
        const aadhaarRegex = /^\d{12}$/;
        const passportRegex = /^[A-Z0-9]{6,9}$/i;
        if (!formData.aadhaar) return 'Please enter your Aadhaar or Passport number';
        if (!aadhaarRegex.test(formData.aadhaar) && !passportRegex.test(formData.aadhaar)) {
            return 'Enter a valid Aadhaar (12 digits) or Passport number (6–9 alphanumeric characters)';
        }
        if (!formData.fullName || formData.fullName.trim().length < 2) return 'Please enter your full name (at least 2 characters)';
        if (!/^[a-zA-Z\s]+$/.test(formData.fullName.trim())) return 'Full name should contain only letters';
        if (!formData.age || isNaN(formData.age) || formData.age < 1 || formData.age > 120) return 'Please enter a valid age (1–120)';
        if (!formData.gender) return 'Please select your gender';
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Please enter a valid email address';
        if (!formData.mobileNumber || !/^\d{10}$/.test(formData.mobileNumber)) return 'Please enter a valid 10-digit mobile number';
        return null;
    };

    const validateStep2 = () => {
        for (let i = 0; i < formData.familyMembers.length; i++) {
            const m = formData.familyMembers[i];
            if (m.fullName || m.age || m.gender) {
                if (!m.fullName || m.fullName.trim().length < 2) return `Family member #${i + 1} needs a valid full name`;
                if (!m.age || isNaN(m.age) || m.age < 1 || m.age > 120) return `Family member #${i + 1} needs a valid age`;
                if (!m.gender) return `Family member #${i + 1} needs a gender selection`;
            }
        }
        return null;
    };

    const validateStep3 = () => {
        if (!formData.tripDetails.destination || formData.tripDetails.destination.trim().length < 2) {
            return 'Please enter a valid destination';
        }
        if (!formData.tripDetails.returnDate) {
            return 'Please select your return date';
        }
        if (new Date(formData.tripDetails.returnDate) <= new Date()) {
            return 'Return date must be in the future';
        }
        return null;
    };

    const validateStep4 = () => {
        const validContacts = formData.emergencyContacts.filter(c => c.name && c.phone);
        if (validContacts.length === 0) {
            return 'Please add at least one emergency contact with both Name and Phone number';
        }
        for (const contact of validContacts) {
            if (!/^\+?\d{7,15}$/.test(contact.phone.replace(/\s/g, ''))) {
                return `Emergency contact "${contact.name}" has an invalid phone number`;
            }
        }
        return null;
    };

    const handleNextStep = () => {
        let err = null;
        if (step === 1) err = validateStep1();
        else if (step === 2) err = validateStep2();
        else if (step === 3) err = validateStep3();

        if (err) {
            setError(err);
            return;
        }
        setError(null);
        setStep(prev => Math.min(prev + 1, 4));
    };

    const handlePrevStep = () => {
        setError(null);
        setStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        const err = validateStep4();
        if (err) {
            setError(err);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const validContacts = formData.emergencyContacts.filter(c => c.name && c.phone);

            const response = await apiClient.post('/api/register', {
                aadhaar: formData.aadhaar,
                fullName: formData.fullName,
                age: parseInt(formData.age),
                gender: formData.gender,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
                familyMembers: formData.familyMembers.filter(m => m.fullName),
                tripDetails: formData.tripDetails,
                emergencyContacts: validContacts
            });

            setSuccess({
                dtid: response.data.dtid,
                aadhaarLast4: response.data.aadhaarLast4 || formData.aadhaar.slice(-4),
                fullName: formData.fullName,
                age: formData.age,
                gender: formData.gender,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
                destination: formData.tripDetails.destination,
                returnDate: formData.tripDetails.returnDate,
                familyMembers: formData.familyMembers.filter(m => m.fullName),
                emergencyContacts: validContacts,
                issuedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                message: 'Tourist registration successful!'
            });

        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.error || 'Registration failed. Please check your network connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSuccess(null);
        setError(null);
        setStep(1);
        setFormData({
            aadhaar: '',
            fullName: '',
            age: '',
            gender: '',
            email: '',
            mobileNumber: '',
            familyMembers: [],
            tripDetails: { destination: '', returnDate: '' },
            emergencyContacts: [
                { name: '', phone: '' },
                { name: '', phone: '' }
            ]
        });
    };

    const handleCopyDtid = (dtid) => {
        navigator.clipboard.writeText(dtid);
        setCopiedDtid(true);
        setTimeout(() => setCopiedDtid(false), 2500);
    };

    const handlePrintPass = () => {
        const originalTitle = document.title;
        document.title = '';
        window.print();
        document.title = originalTitle;
    };

    return (
        <div className="reg-page-wrapper">
            {/* Header / Hero Section */}
            <div className="reg-hero-banner no-print">
                <div className="reg-hero-content">
                    <div className="reg-badge-pill">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        Official Tourist Safety Portal
                    </div>
                    <h1 className="reg-hero-title">Digital Tourist Registration</h1>
                    <p className="reg-hero-subtitle">
                        Issue verified Digital Tourist IDs (DTID) for real-time safety monitoring, geofencing, and panic emergency support.
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="reg-main-container">

                {/* If Registration Completed Successfully */}
                {success ? (
                    <div className="reg-success-card">
                        <div className="reg-success-header no-print">
                            <div className="reg-success-badge-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                            <h2>Digital Tourist ID Issued!</h2>
                            <p>Your official DTID has been created & synced with the Safety Monitoring Backend.</p>
                        </div>

                        {/* On-screen Digital Tourist Pass View */}
                        <div className="dtid-pass-card no-print">
                            <div className="dtid-pass-top">
                                <div className="dtid-logo-mark">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                                    DTID PASSPORT
                                </div>
                                <div className="dtid-status-chip">
                                    <span className="dot-pulse"></span> VERIFIED
                                </div>
                            </div>
                            
                            <div className="dtid-pass-body">
                                <div className="dtid-info-grid">
                                    <div className="dtid-field-block col-span-2">
                                        <label>DIGITAL TOURIST ID (DTID)</label>
                                        <div className="dtid-value-copy">
                                            <code>{success.dtid}</code>
                                            <button 
                                                type="button" 
                                                onClick={() => handleCopyDtid(success.dtid)}
                                                className="dtid-copy-btn"
                                            >
                                                {copiedDtid ? (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                                        Copy ID
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="dtid-field-block">
                                        <label>TOURIST NAME</label>
                                        <div className="dtid-value">{success.fullName}</div>
                                    </div>
                                    <div className="dtid-field-block">
                                        <label>MOBILE NUMBER</label>
                                        <div className="dtid-value">{success.mobileNumber}</div>
                                    </div>
                                    <div className="dtid-field-block">
                                        <label>DESTINATION</label>
                                        <div className="dtid-value">{success.destination}</div>
                                    </div>
                                    <div className="dtid-field-block">
                                        <label>RETURN DATE</label>
                                        <div className="dtid-value">{success.returnDate}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions for On-screen */}
                        <div className="reg-success-actions no-print">
                            <button onClick={handlePrintPass} className="btn-print-pass">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                Print / Save PDF Pass
                            </button>
                            <button onClick={handleReset} className="btn-register-new">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Register Another Tourist
                            </button>
                        </div>

                        {/* DEDICATED PRINTABLE OFFICIAL PASS DOCUMENT (SHOWN ONLY DURING PRINT) */}
                        <div className="print-pass-document print-only">
                            <div className="print-header">
                                <div className="print-header-brand">
                                    <div className="print-emblem">🛡️</div>
                                    <div>
                                        <h1>DIGITAL TOURIST SAFETY REGISTRY</h1>
                                        <p>GOVERNMENT OF INDIA • OFFICIAL TRAVEL SAFETY PASS</p>
                                    </div>
                                </div>
                                <div className="print-header-badge">
                                    <span>STATUS</span>
                                    <strong>VERIFIED ACTIVE</strong>
                                </div>
                            </div>

                            <div className="print-divider-line"></div>

                            <div className="print-body-layout">
                                <div className="print-details-section">
                                    <div className="print-dtid-box">
                                        <span className="print-field-label">DIGITAL TOURIST ID (DTID)</span>
                                        <div className="print-dtid-value">{success.dtid}</div>
                                    </div>

                                    <table className="print-data-table">
                                        <tbody>
                                            <tr>
                                                <td className="tbl-label">Tourist Full Name:</td>
                                                <td className="tbl-val bold">{success.fullName}</td>
                                                <td className="tbl-label">Age / Gender:</td>
                                                <td className="tbl-val">{success.age} yrs / {success.gender}</td>
                                            </tr>
                                            <tr>
                                                <td className="tbl-label">Mobile Number:</td>
                                                <td className="tbl-val">{success.mobileNumber}</td>
                                                <td className="tbl-label">Email Address:</td>
                                                <td className="tbl-val">{success.email}</td>
                                            </tr>
                                            <tr>
                                                <td className="tbl-label">ID / Aadhaar No:</td>
                                                <td className="tbl-val">•••• •••• {success.aadhaarLast4}</td>
                                                <td className="tbl-label">Issue Date:</td>
                                                <td className="tbl-val">{success.issuedAt}</td>
                                            </tr>
                                            <tr>
                                                <td className="tbl-label">Travel Destination:</td>
                                                <td className="tbl-val highlight">{success.destination}</td>
                                                <td className="tbl-label">Valid Until Return:</td>
                                                <td className="tbl-val highlight">{success.returnDate}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {success.familyMembers && success.familyMembers.length > 0 && (
                                <div className="print-section-block">
                                    <h3>REGISTERED TRAVEL COMPANIONS ({success.familyMembers.length})</h3>
                                    <div className="print-companions-grid">
                                        {success.familyMembers.map((mem, i) => (
                                            <div key={i} className="print-companion-chip">
                                                <strong>#{i + 1} {mem.fullName}</strong>
                                                <span>{mem.age} yrs • {mem.gender}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {success.emergencyContacts && success.emergencyContacts.length > 0 && (
                                <div className="print-section-block">
                                    <h3>EMERGENCY CONTACT NUMBERS</h3>
                                    <div className="print-contacts-grid">
                                        {success.emergencyContacts.map((contact, i) => (
                                            <div key={i} className="print-contact-chip">
                                                <strong>{contact.name}</strong>
                                                <span>📞 {contact.phone}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="print-footer">
                                <div className="print-footer-info">
                                    <span>Security Code: DTID-SEC-2026-ENCRYPTED</span>
                                    <span>System: Geo-fence Safety & Panic Emergency Support</span>
                                </div>
                                <p className="print-disclaimer">
                                    This Digital Tourist Pass is officially registered with the Tourist Safety Management System. 
                                    Keep this document accessible during travel. Real-time safety services are active until the return date.
                                </p>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* Step Form Wizard */
                    <div className="reg-wizard-card">
                        
                        {/* Stepper Navigation Header */}
                        <div className="reg-stepper">
                            <div className={`step-node ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                                <div className="step-circle">
                                    {step > 1 ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : '1'}
                                </div>
                                <div className="step-label">
                                    <span>STEP 1</span>
                                    <strong>Personal Info</strong>
                                </div>
                            </div>

                            <div className={`step-line ${step > 1 ? 'filled' : ''}`}></div>

                            <div className={`step-node ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                                <div className="step-circle">
                                    {step > 2 ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : '2'}
                                </div>
                                <div className="step-label">
                                    <span>STEP 2</span>
                                    <strong>Companions</strong>
                                </div>
                            </div>

                            <div className={`step-line ${step > 2 ? 'filled' : ''}`}></div>

                            <div className={`step-node ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                                <div className="step-circle">
                                    {step > 3 ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : '3'}
                                </div>
                                <div className="step-label">
                                    <span>STEP 3</span>
                                    <strong>Trip Details</strong>
                                </div>
                            </div>

                            <div className={`step-line ${step > 3 ? 'filled' : ''}`}></div>

                            <div className={`step-node ${step >= 4 ? 'active' : ''}`}>
                                <div className="step-circle">4</div>
                                <div className="step-label">
                                    <span>STEP 4</span>
                                    <strong>Emergency & Finish</strong>
                                </div>
                            </div>
                        </div>

                        {/* Error Alert Box */}
                        {error && (
                            <div className="reg-error-alert">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={(e) => e.preventDefault()} className="reg-form-body">

                            {/* STEP 1: Personal Information */}
                            {step === 1 && (
                                <div className="step-pane fade-in">
                                    <div className="step-pane-header">
                                        <div className="icon-badge">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="16" x2="9" y2="16"/></svg>
                                        </div>
                                        <div>
                                            <h3>Identity & Basic Details</h3>
                                            <p>Enter official government ID details and personal contact info.</p>
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="aadhaar">Aadhaar / Passport Number *</label>
                                        <div className="input-icon-wrapper">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            <input
                                                type="text"
                                                id="aadhaar"
                                                name="aadhaar"
                                                value={formData.aadhaar}
                                                onChange={handleInputChange}
                                                placeholder="e.g. 12-digit Aadhaar (987456333212) or Passport ID"
                                                className="modern-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="fullName">Full Legal Name *</label>
                                        <div className="input-icon-wrapper">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            <input
                                                type="text"
                                                id="fullName"
                                                name="fullName"
                                                value={formData.fullName}
                                                onChange={handleInputChange}
                                                placeholder="Full name as printed on ID"
                                                className="modern-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-grid-2">
                                        <div className="input-group">
                                            <label htmlFor="age">Age *</label>
                                            <input
                                                type="number"
                                                id="age"
                                                name="age"
                                                value={formData.age}
                                                onChange={handleInputChange}
                                                placeholder="e.g. 28"
                                                className="modern-input"
                                                min="1"
                                                max="120"
                                            />
                                        </div>

                                        <div className="input-group">
                                            <label htmlFor="gender">Gender *</label>
                                            <select
                                                id="gender"
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleInputChange}
                                                className="modern-select"
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="input-grid-2">
                                        <div className="input-group">
                                            <label htmlFor="email">Email Address *</label>
                                            <div className="input-icon-wrapper">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                                <input
                                                    type="email"
                                                    id="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    placeholder="tourist@example.com"
                                                    className="modern-input"
                                                />
                                            </div>
                                        </div>

                                        <div className="input-group">
                                            <label htmlFor="mobileNumber">Mobile Number *</label>
                                            <div className="input-icon-wrapper">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                                <input
                                                    type="tel"
                                                    id="mobileNumber"
                                                    name="mobileNumber"
                                                    value={formData.mobileNumber}
                                                    onChange={handleInputChange}
                                                    placeholder="10-digit mobile number"
                                                    maxLength="10"
                                                    className="modern-input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Family / Companions */}
                            {step === 2 && (
                                <div className="step-pane fade-in">
                                    <div className="step-pane-header">
                                        <div className="icon-badge alt">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        </div>
                                        <div>
                                            <h3>Family Members & Group Companions</h3>
                                            <p>Register all members traveling together under a single DTID group cluster.</p>
                                        </div>
                                    </div>

                                    {formData.familyMembers.length === 0 ? (
                                        <div className="empty-state-box">
                                            <div className="empty-icon">👥</div>
                                            <h4>Traveling Solo?</h4>
                                            <p>If you are traveling alone, click "Continue to Step 3". Otherwise, add your companions below.</p>
                                        </div>
                                    ) : (
                                        <div className="cards-list">
                                            {formData.familyMembers.map((member, index) => (
                                                <div key={index} className="sub-card">
                                                    <div className="sub-card-header">
                                                        <span className="card-tag">Companion #{index + 1}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFamilyMember(index)}
                                                            className="btn-trash"
                                                            title="Remove companion"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                            Remove
                                                        </button>
                                                    </div>

                                                    <div className="input-group mb-2">
                                                        <label>Companion Full Name</label>
                                                        <input
                                                            type="text"
                                                            value={member.fullName}
                                                            onChange={(e) => handleFamilyMemberChange(index, 'fullName', e.target.value)}
                                                            placeholder="Enter name"
                                                            className="modern-input"
                                                        />
                                                    </div>

                                                    <div className="input-grid-2">
                                                        <div className="input-group">
                                                            <label>Age</label>
                                                            <input
                                                                type="number"
                                                                value={member.age}
                                                                onChange={(e) => handleFamilyMemberChange(index, 'age', e.target.value)}
                                                                placeholder="Age"
                                                                className="modern-input"
                                                                min="1"
                                                                max="120"
                                                            />
                                                        </div>
                                                        <div className="input-group">
                                                            <label>Gender</label>
                                                            <select
                                                                value={member.gender}
                                                                onChange={(e) => handleFamilyMemberChange(index, 'gender', e.target.value)}
                                                                className="modern-select"
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
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={addFamilyMember}
                                        className="btn-add-dashed"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        Add Family Member / Companion
                                    </button>
                                </div>
                            )}

                            {/* STEP 3: Trip Details */}
                            {step === 3 && (
                                <div className="step-pane fade-in">
                                    <div className="step-pane-header">
                                        <div className="icon-badge">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        </div>
                                        <div>
                                            <h3>Trip Plan & Itinerary</h3>
                                            <p>Specify travel destination and planned return date for geo-fence active tracking.</p>
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="destination">Primary Destination *</label>
                                        <div className="input-icon-wrapper">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                            <input
                                                type="text"
                                                id="destination"
                                                name="trip.destination"
                                                value={formData.tripDetails.destination}
                                                onChange={handleInputChange}
                                                placeholder="e.g. Ooty, Goa, Yercaud, Manali"
                                                className="modern-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="returnDate">Return Date *</label>
                                        <div className="input-icon-wrapper">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                            <input
                                                type="date"
                                                id="returnDate"
                                                name="trip.returnDate"
                                                value={formData.tripDetails.returnDate}
                                                onChange={handleInputChange}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="modern-input"
                                            />
                                        </div>
                                        <span className="input-hint-badge">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                            Trip start date is auto-set to today upon registration.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: Emergency Contacts & Final Confirmation */}
                            {step === 4 && (
                                <div className="step-pane fade-in">
                                    <div className="step-pane-header">
                                        <div className="icon-badge danger-badge">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                        </div>
                                        <div>
                                            <h3>Emergency Contacts & Final Review</h3>
                                            <p>Provide emergency contact numbers to receive automated SOS alerts if needed.</p>
                                        </div>
                                    </div>

                                    <div className="cards-list mb-4">
                                        {formData.emergencyContacts.map((contact, index) => (
                                            <div key={index} className="sub-card emergency-card">
                                                <div className="sub-card-header">
                                                    <span className="card-tag alert-tag">Emergency Contact #{index + 1}</span>
                                                    {formData.emergencyContacts.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeContact(index)}
                                                            className="btn-trash"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="input-grid-2">
                                                    <div className="input-group">
                                                        <label>Contact Name</label>
                                                        <input
                                                            type="text"
                                                            value={contact.name}
                                                            onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                                                            placeholder="e.g. Relative / Friend"
                                                            className="modern-input"
                                                        />
                                                    </div>

                                                    <div className="input-group">
                                                        <label>Phone Number</label>
                                                        <input
                                                            type="tel"
                                                            value={contact.phone}
                                                            onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                                                            placeholder="+91-XXXXXXXXXX"
                                                            className="modern-input"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addContact}
                                        className="btn-add-dashed mb-4"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        Add Another Emergency Contact
                                    </button>

                                    {/* Summary Card */}
                                    <div className="review-summary-box">
                                        <h4>Registration Summary</h4>
                                        <div className="summary-grid">
                                            <div>
                                                <span>Primary Tourist:</span>
                                                <strong>{formData.fullName || 'Not provided'}</strong>
                                            </div>
                                            <div>
                                                <span>Aadhaar / Passport:</span>
                                                <strong>{formData.aadhaar ? `•••• •••• ${formData.aadhaar.slice(-4)}` : 'Not provided'}</strong>
                                            </div>
                                            <div>
                                                <span>Destination:</span>
                                                <strong>{formData.tripDetails.destination || 'Not provided'}</strong>
                                            </div>
                                            <div>
                                                <span>Companions:</span>
                                                <strong>{formData.familyMembers.length} member(s)</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Sticky Controls Bar */}
                            <div className="reg-actions-bar">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={handlePrevStep}
                                        className="btn-wizard-secondary"
                                        disabled={loading}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                                        Back
                                    </button>
                                )}

                                {step < 4 ? (
                                    <button
                                        type="button"
                                        onClick={handleNextStep}
                                        className="btn-wizard-primary ml-auto"
                                    >
                                        Continue
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="btn-wizard-submit ml-auto"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="spin-loader"></div>
                                                Generating DTID...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                Generate Digital Tourist ID
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                        </form>
                    </div>
                )}
            </div>

        </div>
    );
}

export default Registration;
