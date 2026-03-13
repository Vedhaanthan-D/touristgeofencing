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
                    <RefreshCw size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="tl-main-content">
            {/* Page Header + Search */}
            <div className="tl-header">
                <div>
                    <h1 className="tl-page-title">
                        <Users size={26} color="#2563EB" />
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
                <div className="tl-cards-grid">
                    {filteredTourists.map((tourist, index) => {
                        const active = isValidTouristId(tourist);
                        return (
                            <div key={tourist.dtid || index} className="tl-card">
                                {/* Card Top */}
                                <div className="tl-card-top">
                                    <div className="tl-card-avatar">
                                        {(tourist.fullName || 'T').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="tl-card-top-info">
                                        <div className="tl-card-name">{tourist.fullName || 'N/A'}</div>
                                        <div className="tl-card-meta">
                                            {tourist.age ? `${tourist.age} yrs` : ''}
                                            {tourist.gender ? ` • ${tourist.gender}` : ''}
                                            {tourist.numberOfTravellers ? ` • ${tourist.numberOfTravellers} traveller${tourist.numberOfTravellers > 1 ? 's' : ''}` : ''}
                                        </div>
                                    </div>
                                    <span className={`tl-status-pill ${active ? 'active' : 'inactive'}`}>
                                        {active ? '🟢 Active' : '🔴 Inactive'}
                                    </span>
                                </div>

                                {/* DTID */}
                                <div className="tl-card-dtid">
                                    <span className="tl-dtid-label">DTID</span>
                                    <span className="tl-dtid-val">{tourist.dtid}</span>
                                </div>

                                {/* Details */}
                                <div className="tl-card-details">
                                    <div className="tl-card-row">
                                        <span className="tl-card-row-icon">📍</span>
                                        <span className="tl-card-row-label">Destination</span>
                                        <span className="tl-card-row-val">{tourist.tripDetails?.destination || 'N/A'}</span>
                                    </div>
                                    <div className="tl-card-row">
                                        <span className="tl-card-row-icon">📅</span>
                                        <span className="tl-card-row-label">Check-in</span>
                                        <span className="tl-card-row-val">{tourist.tripDetails?.startDate || formatDate(tourist.issuedAt)}</span>
                                    </div>
                                    <div className="tl-card-row">
                                        <span className="tl-card-row-icon">🔚</span>
                                        <span className="tl-card-row-label">Check-out</span>
                                        <span className="tl-card-row-val">{formatDate(tourist.returnDate || tourist.validTill)}</span>
                                    </div>
                                    <div className="tl-card-row">
                                        <span className="tl-card-row-icon">📞</span>
                                        <span className="tl-card-row-label">Mobile</span>
                                        <span className="tl-card-row-val">{tourist.mobileNumber || 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Card Number badge */}
                                <div className="tl-card-number">#{index + 1}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default TouristList;