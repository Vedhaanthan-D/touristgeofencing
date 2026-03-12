import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, AlertTriangle, RefreshCw, Users, SearchX } from 'lucide-react';
import './TouristList.css';

function TouristList() {
    const [tourists, setTourists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        const fetchTourists = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tourists`);
                setTourists(response.data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError('Failed to load tourist data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchTourists();
    }, []);

    // Helpers
    const formatTripDetails = (tripDetails) => {
        if (!tripDetails) return 'N/A';
        if (typeof tripDetails === 'string') {
            try { tripDetails = JSON.parse(tripDetails); } catch { return tripDetails; }
        }
        return (
            <div className="trip-details">
                {tripDetails.destination && <div><strong>Destination:</strong> {tripDetails.destination}</div>}
                {tripDetails.startDate && <div><strong>Start Date:</strong> {new Date(tripDetails.startDate).toLocaleDateString('en-IN')}</div>}
                {tripDetails.returnDate && <div><strong>Return Date:</strong> {new Date(tripDetails.returnDate).toLocaleDateString('en-IN')}</div>}
                {tripDetails.endDate && <div><strong>End Date:</strong> {new Date(tripDetails.endDate).toLocaleDateString('en-IN')}</div>}
                {tripDetails.dates && <div><strong>Dates:</strong> {tripDetails.dates}</div>}
                {tripDetails.purpose && <div><strong>Purpose:</strong> {tripDetails.purpose}</div>}
            </div>
        );
    };

    const formatEmergencyContacts = (contacts) => {
        if (!contacts) return 'N/A';
        if (typeof contacts === 'string') {
            try { contacts = JSON.parse(contacts); } catch { return contacts; }
        }
        if (Array.isArray(contacts)) {
            return (
                <div className="emergency-contacts">
                    {contacts.map((contact, index) => (
                        <div key={index} className="contact-item">
                            <div><strong>{contact.name}</strong></div>
                            <div>{contact.phone}</div>
                        </div>
                    ))}
                </div>
            );
        }
        return contacts.name ? `${contacts.name}: ${contacts.phone}` : JSON.stringify(contacts);
    };

    const formatDate = (timestamp) => {
        if (!timestamp && timestamp !== 0) return 'N/A';
        const num = Number(timestamp);
        const seconds = Number.isFinite(num) ? num : 0;
        const date = new Date(seconds * 1000);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const isValidTouristId = (tourist) => {
        if (!tourist) return false;
        if (Object.prototype.hasOwnProperty.call(tourist, 'isActive')) return tourist.isActive;
        const returnDate = tourist.returnDate || tourist.validTill;
        if (!returnDate) return false;
        const currentTime = Math.floor(Date.now() / 1000);
        return returnDate > currentTime;
    };

    const filteredTourists = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return tourists;
        return tourists.filter(t => String(t.dtid || '').toLowerCase().includes(q));
    }, [tourists, query]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading tourist records...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-icon"><AlertTriangle size={48} color="#E53935" /></div>
                <h2>Something went wrong</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="retry-button">
                    <RefreshCw size={16} style={{marginRight: '6px', verticalAlign: 'middle'}} />
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="main-content">
            {/* Page Header + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="tl-page-title">
                        <Users size={28} color="#FF8C42" />
                        Tourist Records
                    </h1>
                    <p className="tl-page-subtitle">Browse and search all registered tourist profiles</p>
                </div>
                <div className="search-bar-wrapper">
                    <Search size={16} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by DTID..."
                        aria-label="Search by DTID"
                        className="tl-search-input"
                    />
                </div>
            </div>

            {filteredTourists.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon"><SearchX size={52} color="#ABABAB" /></div>
                    <h3>No matching DTID</h3>
                    <p>Try another DTID or clear the search.</p>
                </div>
            ) : (
                <div className="tl-tourists-grid">
                    {filteredTourists.map((tourist, index) => (
                        <div key={tourist._id} className="tl-tourist-card">
                            <div className="tl-card-header">
                                <div className="card-number">#{index + 1}</div>
                                <div className="card-id">
                                    <span className="id-label">DTID</span>
                                    <span className="id-value">{tourist.dtid}</span>
                                </div>
                            </div>

                            <div className="tl-card-body">
                                <div className="tl-info-section">
                                    <div className="tl-info-item full-width">
                                        <div className="tl-info-label">
                                            <span className="tl-info-icon">👤</span>
                                            Personal Information
                                        </div>
                                        <div className="tl-info-value">
                                            <div><strong>Name:</strong> {tourist.fullName || 'N/A'}</div>
                                            <div><strong>Age:</strong> {tourist.age || 'N/A'}</div>
                                            <div><strong>Gender:</strong> {tourist.gender || 'N/A'}</div>
                                            <div><strong>Email:</strong> {tourist.email || 'N/A'}</div>
                                            <div><strong>Mobile:</strong> {tourist.mobileNumber || 'N/A'}</div>
                                            <div><strong>Aadhaar:</strong> {tourist.aadhaar}</div>
                                        </div>
                                    </div>

                                    <div className="tl-info-item">
                                        <div className="tl-info-label">
                                            <span className="tl-info-icon">🆔</span>
                                            Tourist ID (DTID)
                                        </div>
                                        <div className="tl-info-value document-id">{tourist.dtid}</div>
                                    </div>

                                    {tourist.familyMembers && tourist.familyMembers.length > 0 && (
                                        <div className="tl-info-item full-width">
                                            <div className="tl-info-label">
                                                <span className="tl-info-icon">👥</span>
                                                Family Members ({tourist.numberOfTravellers || tourist.familyMembers.length + 1} total travelers)
                                            </div>
                                            <div className="tl-info-value">
                                                {tourist.familyMembers.map((member, index) => (
                                                    <div key={index} className="family-member-item">
                                                        <strong>{member.fullName}</strong> - Age: {member.age}, Gender: {member.gender}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="tl-info-item full-width">
                                        <div className="tl-info-label">
                                            <span className="tl-info-icon">✈️</span>
                                            Trip Details
                                        </div>
                                        <div className="tl-info-value">
                                            {formatTripDetails(tourist.tripDetails)}
                                        </div>
                                    </div>

                                    <div className="tl-info-item full-width">
                                        <div className="tl-info-label">
                                            <span className="tl-info-icon">📞</span>
                                            Emergency Contacts
                                        </div>
                                        <div className="tl-info-value">
                                            {formatEmergencyContacts(tourist.emergencyContacts)}
                                        </div>
                                    </div>

                                    <div className="tl-info-row">
                                        <div className="tl-info-item">
                                            <div className="tl-info-label">
                                                <span className="tl-info-icon">📅</span>
                                                Issued At
                                            </div>
                                            <div className="tl-info-value">{formatDate(tourist.issuedAt)}</div>
                                        </div>

                                        <div className="tl-info-item">
                                            <div className="tl-info-label">
                                                <span className="tl-info-icon">⏰</span>
                                                Return Date
                                            </div>
                                            <div className="tl-info-value">{formatDate(tourist.returnDate || tourist.validTill)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <div className={`status-badge ${isValidTouristId(tourist) ? 'verified' : 'expired'}`}>
                                    <span className="status-icon">{isValidTouristId(tourist) ? '✓' : '⚠️'}</span>
                                    {isValidTouristId(tourist) ? 'Active' : 'Inactive'}
                                </div>
                                <div className="validity-info">
                                    {isValidTouristId(tourist) ? 
                                        `Valid until ${formatDate(tourist.returnDate || tourist.validTill)}` :
                                        'Tourist ID is inactive'
                                    }
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TouristList;