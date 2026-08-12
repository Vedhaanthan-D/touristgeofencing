import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { 
    Search, AlertTriangle, RefreshCw, Users, SearchX, 
    ShieldCheck, Clock, MapPin, Phone, Mail, Calendar, 
    Eye, X, Copy, Check, Filter, UserCheck, LayoutGrid, Table as TableIcon 
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import './TouristList.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function TouristList() {
    const { tourists: globalTourists, fetchTourists: refreshGlobalTourists } = useData();
    const [tourists, setTourists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [selectedTourist, setSelectedTourist] = useState(null);
    const [copiedDtid, setCopiedDtid] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/tourists`);
            const data = Array.isArray(response.data) ? response.data : [];
            setTourists(data);
        } catch (err) {
            console.error('Error loading tourist list:', err);
            if (globalTourists && globalTourists.length > 0) {
                setTourists(globalTourists);
            } else {
                setError('Failed to load tourist data. Please check backend connection.');
            }
        } finally {
            setLoading(false);
        }
    }, [globalTourists]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => {
        refreshGlobalTourists();
        loadData();
    };

    const handleCopyDtid = (dtid, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(dtid);
        setCopiedDtid(dtid);
        setTimeout(() => setCopiedDtid(null), 2200);
    };

    const formatUnixSecondsToLocale = (timestamp) => {
        if (!timestamp && timestamp !== 0) return 'N/A';
        const num = Number(timestamp);
        const seconds = Number.isFinite(num) ? num : 0;
        const date = new Date(seconds * 1000);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric'
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

    // Calculate quick stats
    const stats = useMemo(() => {
        let active = 0;
        let inactive = 0;
        tourists.forEach(t => {
            if (isValidTouristId(t)) active++;
            else inactive++;
        });
        return { total: tourists.length, active, inactive };
    }, [tourists]);

    const filteredTourists = useMemo(() => {
        let result = tourists;

        // Status Filter
        if (statusFilter === 'active') {
            result = result.filter(t => isValidTouristId(t));
        } else if (statusFilter === 'inactive') {
            result = result.filter(t => !isValidTouristId(t));
        }

        // Search Query
        const q = query.trim().toLowerCase();
        if (q) {
            result = result.filter(t =>
                String(t.dtid || '').toLowerCase().includes(q) ||
                String(t.fullName || '').toLowerCase().includes(q) ||
                String(t.mobileNumber || '').toLowerCase().includes(q) ||
                String(t.tripDetails?.destination || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [tourists, query, statusFilter]);

    if (loading && tourists.length === 0) {
        return (
            <div className="tl-page-wrapper">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <h3>Loading Tourist Directory...</h3>
                    <p>Retrieving registered profiles from Firebase database...</p>
                </div>
            </div>
        );
    }

    if (error && tourists.length === 0) {
        return (
            <div className="tl-page-wrapper">
                <div className="error-container">
                    <AlertTriangle size={48} color="#EF4444" />
                    <h2>Database Connection Error</h2>
                    <p>{error}</p>
                    <button onClick={handleRefresh} className="retry-button">
                        <RefreshCw size={16} />
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="tl-page-wrapper fade-in">
            {/* Header Banner */}
            <div className="tl-hero-header">
                <div className="tl-hero-content">
                    <div className="tl-title-row">
                        <div>
                            <span className="tl-badge-pill">
                                <ShieldCheck size={14} /> Official Directory
                            </span>
                            <h1 className="tl-main-title">Registered Tourist Directory</h1>
                            <p className="tl-main-subtitle">
                                Monitor active traveler status, Digital Tourist IDs (DTID), destinations, and emergency contact profiles.
                            </p>
                        </div>

                        {/* Top Stats Cards */}
                        <div className="tl-stats-strip">
                            <div className="tl-stat-chip active-chip" onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}>
                                <span className="stat-num">{stats.active}</span>
                                <span className="stat-label">Active Travelers</span>
                            </div>
                            <div className="tl-stat-chip total-chip" onClick={() => setStatusFilter('all')}>
                                <span className="stat-num">{stats.total}</span>
                                <span className="stat-label">Total Registered</span>
                            </div>
                            <div className="tl-stat-chip inactive-chip" onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}>
                                <span className="stat-num">{stats.inactive}</span>
                                <span className="stat-label">Returned / Inactive</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="tl-main-container">
                <div className="tl-controls-card">
                    {/* Search Input */}
                    <div className="tl-search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by Tourist Name, DTID, Mobile, or Destination..."
                            className="tl-search-input-field"
                        />
                        {query && (
                            <button onClick={() => setQuery('')} className="btn-clear-search">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Pills */}
                    <div className="tl-filter-pills">
                        <button
                            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('all')}
                        >
                            All ({stats.total})
                        </button>
                        <button
                            className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('active')}
                        >
                            <span className="dot-green"></span> Active ({stats.active})
                        </button>
                        <button
                            className={`filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('inactive')}
                        >
                            <span className="dot-grey"></span> Returned ({stats.inactive})
                        </button>
                    </div>

                    {/* View Switcher & Refresh */}
                    <div className="tl-right-actions">
                        <div className="view-toggle">
                            <button
                                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                                onClick={() => setViewMode('table')}
                                title="Table View"
                            >
                                <TableIcon size={16} />
                            </button>
                        </div>

                        <button onClick={handleRefresh} className="btn-refresh-accent" title="Reload Fresh Data">
                            <RefreshCw size={16} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Empty State */}
                {filteredTourists.length === 0 ? (
                    <div className="tl-empty-card">
                        <SearchX size={56} className="empty-icon-svg" />
                        <h3>No matching tourist records found</h3>
                        <p>No profiles match your search criteria "{query}". Try clearing the search query or changing filters.</p>
                        <button onClick={() => { setQuery(''); setStatusFilter('all'); }} className="btn-reset-filters">
                            Reset Search Filters
                        </button>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* GRID VIEW MODE */
                    <div className="tl-grid-container">
                        {filteredTourists.map((tourist, index) => {
                            const active = isValidTouristId(tourist);
                            return (
                                <div 
                                    key={tourist.dtid || index} 
                                    className="tl-profile-card"
                                    onClick={() => setSelectedTourist(tourist)}
                                >
                                    {/* Card Header Gradient */}
                                    <div className="tl-profile-header">
                                        <div className="tl-avatar-circle">
                                            {(tourist.fullName || 'T').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="tl-profile-title">
                                            <h3>{tourist.fullName || 'Registered Tourist'}</h3>
                                            <span className="tl-profile-meta">
                                                {tourist.age ? `${tourist.age} yrs` : ''} 
                                                {tourist.gender ? ` • ${tourist.gender}` : ''}
                                            </span>
                                        </div>
                                        <span className={`tl-status-chip ${active ? 'chip-active' : 'chip-returned'}`}>
                                            <span className="dot"></span>
                                            {active ? 'Active' : 'Returned'}
                                        </span>
                                    </div>

                                    {/* DTID Bar */}
                                    <div className="tl-dtid-strip">
                                        <div className="dtid-text-group">
                                            <span className="dtid-lbl">DTID</span>
                                            <code>{tourist.dtid}</code>
                                        </div>
                                        <button 
                                            className="btn-copy-mini"
                                            onClick={(e) => handleCopyDtid(tourist.dtid, e)}
                                            title="Copy DTID"
                                        >
                                            {copiedDtid === tourist.dtid ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                                        </button>
                                    </div>

                                    {/* Details Body */}
                                    <div className="tl-profile-body">
                                        <div className="tl-info-row">
                                            <span className="row-lbl"><MapPin size={14} /> Destination</span>
                                            <span className="row-val font-highlight">{tourist.tripDetails?.destination || 'N/A'}</span>
                                        </div>
                                        <div className="tl-info-row">
                                            <span className="row-lbl"><Calendar size={14} /> Check-in</span>
                                            <span className="row-val">{tourist.tripDetails?.startDate || formatUnixSecondsToLocale(tourist.issuedAt)}</span>
                                        </div>
                                        <div className="tl-info-row">
                                            <span className="row-lbl"><Clock size={14} /> Check-out</span>
                                            <span className="row-val">{formatUnixSecondsToLocale(tourist.returnDate || tourist.validTill)}</span>
                                        </div>
                                        <div className="tl-info-row">
                                            <span className="row-lbl"><Phone size={14} /> Mobile</span>
                                            <span className="row-val">{tourist.mobileNumber || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Card Footer Action */}
                                    <div className="tl-profile-footer">
                                        <span className="companion-badge">
                                            <Users size={13} /> {tourist.numberOfTravellers || 1} Traveller(s)
                                        </span>
                                        <button className="btn-view-details">
                                            <Eye size={14} />
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* TABLE VIEW MODE */
                    <div className="tl-table-card">
                        <div className="table-responsive">
                            <table className="tl-data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Tourist</th>
                                        <th>Digital ID (DTID)</th>
                                        <th>Destination</th>
                                        <th>Check-in</th>
                                        <th>Check-out</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTourists.map((tourist, index) => {
                                        const active = isValidTouristId(tourist);
                                        return (
                                            <tr key={tourist.dtid || index} onClick={() => setSelectedTourist(tourist)}>
                                                <td className="col-idx">#{index + 1}</td>
                                                <td>
                                                    <div className="tbl-user-cell">
                                                        <div className="tbl-avatar">
                                                            {(tourist.fullName || 'T').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="tbl-user-name">{tourist.fullName || 'N/A'}</div>
                                                            <div className="tbl-user-sub">{tourist.mobileNumber || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="tbl-dtid-cell">
                                                        <code>{tourist.dtid}</code>
                                                        <button 
                                                            className="btn-copy-nano"
                                                            onClick={(e) => handleCopyDtid(tourist.dtid, e)}
                                                        >
                                                            {copiedDtid === tourist.dtid ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="tbl-dest-tag">
                                                        <MapPin size={13} /> {tourist.tripDetails?.destination || 'N/A'}
                                                    </span>
                                                </td>
                                                <td>{tourist.tripDetails?.startDate || formatUnixSecondsToLocale(tourist.issuedAt)}</td>
                                                <td>{formatUnixSecondsToLocale(tourist.returnDate || tourist.validTill)}</td>
                                                <td>
                                                    <span className={`tl-status-chip ${active ? 'chip-active' : 'chip-returned'}`}>
                                                        <span className="dot"></span>
                                                        {active ? 'Active' : 'Returned'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn-icon-view" title="View Full Profile">
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Tourist Detail Drawer Modal */}
            {selectedTourist && (
                <div className="tl-drawer-overlay" onClick={() => setSelectedTourist(null)}>
                    <div className="tl-drawer-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="tl-drawer-header">
                            <div className="drawer-avatar-lg">
                                {(selectedTourist.fullName || 'T').charAt(0).toUpperCase()}
                            </div>
                            <div className="drawer-title-group">
                                <h2>{selectedTourist.fullName || 'Tourist Record'}</h2>
                                <span className={`tl-status-chip ${isValidTouristId(selectedTourist) ? 'chip-active' : 'chip-returned'}`}>
                                    <span className="dot"></span>
                                    {isValidTouristId(selectedTourist) ? 'Active Safety Tracking' : 'Returned / Record Completed'}
                                </span>
                            </div>
                            <button className="btn-close-drawer" onClick={() => setSelectedTourist(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="tl-drawer-dtid-bar">
                            <label>DIGITAL TOURIST ID (DTID)</label>
                            <div className="dtid-val-row">
                                <code>{selectedTourist.dtid}</code>
                                <button className="dtid-copy-btn" onClick={(e) => handleCopyDtid(selectedTourist.dtid, e)}>
                                    {copiedDtid === selectedTourist.dtid ? 'Copied!' : 'Copy ID'}
                                </button>
                            </div>
                        </div>

                        <div className="tl-drawer-body">
                            {/* Personal Details */}
                            <div className="drawer-section-card">
                                <h4>Personal Information</h4>
                                <div className="drawer-grid-2">
                                    <div><span>Aadhaar / Passport:</span> <strong>{selectedTourist.aadhaar || selectedTourist['aadhaar/passport'] || 'N/A'}</strong></div>
                                    <div><span>Age / Gender:</span> <strong>{selectedTourist.age ? `${selectedTourist.age} yrs` : 'N/A'} • {selectedTourist.gender || 'N/A'}</strong></div>
                                    <div><span>Mobile Number:</span> <strong>{selectedTourist.mobileNumber || 'N/A'}</strong></div>
                                    <div><span>Email Address:</span> <strong>{selectedTourist.email || 'N/A'}</strong></div>
                                </div>
                            </div>

                            {/* Trip Plan */}
                            <div className="drawer-section-card">
                                <h4>Travel & Itinerary Details</h4>
                                <div className="drawer-grid-2">
                                    <div><span>Destination:</span> <strong className="text-primary">{selectedTourist.tripDetails?.destination || 'N/A'}</strong></div>
                                    <div><span>Check-in Date:</span> <strong>{selectedTourist.tripDetails?.startDate || formatUnixSecondsToLocale(selectedTourist.issuedAt)}</strong></div>
                                    <div><span>Check-out Date:</span> <strong>{formatUnixSecondsToLocale(selectedTourist.returnDate || selectedTourist.validTill)}</strong></div>
                                    <div><span>Total Group Size:</span> <strong>{selectedTourist.numberOfTravellers || 1} Member(s)</strong></div>
                                </div>
                            </div>

                            {/* Family Members */}
                            {selectedTourist.familyMembers && selectedTourist.familyMembers.length > 0 && (
                                <div className="drawer-section-card">
                                    <h4>Family Members & Group Companions ({selectedTourist.familyMembers.length})</h4>
                                    <div className="companions-chips">
                                        {selectedTourist.familyMembers.map((m, i) => (
                                            <div key={i} className="companion-chip">
                                                <strong>{m.fullName || m.name || `Companion #${i + 1}`}</strong>
                                                <span>{m.age ? `${m.age} yrs` : ''} {m.gender ? `• ${m.gender}` : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Emergency Contacts */}
                            {selectedTourist.emergencyContacts && selectedTourist.emergencyContacts.length > 0 && (
                                <div className="drawer-section-card alert-section">
                                    <h4>Emergency Contacts</h4>
                                    <div className="emergency-contacts-list">
                                        {selectedTourist.emergencyContacts.map((c, i) => (
                                            <div key={i} className="contact-card-row">
                                                <div>
                                                    <strong>{c.name || `Contact #${i + 1}`}</strong>
                                                    <span>{c.phone}</span>
                                                </div>
                                                <a href={`tel:${c.phone}`} className="btn-call-contact">
                                                    <Phone size={14} /> Call
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TouristList;
