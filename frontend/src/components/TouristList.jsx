import { useEffect, useMemo, useState, useCallback } from 'react';
import { 
    Search, AlertTriangle, RefreshCw, Users, SearchX, 
    ShieldCheck, Clock, MapPin, Phone, Mail, Calendar, 
    Eye, X, Copy, Check, Filter, UserCheck, LayoutGrid, Table as TableIcon,
    CalendarDays, User, PhoneCall
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import './Dashboard.css';
import './TouristList.css';

function TouristList() {
    const { 
        tourists, 
        loadingTourists: loading, 
        fetchTourists: refreshGlobalTourists 
    } = useData();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [selectedTourist, setSelectedTourist] = useState(null);
    const [copiedDtid, setCopiedDtid] = useState(null);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshGlobalTourists();
        setIsRefreshing(false);
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

    const formatDate = (timestamp) => {
        if (!timestamp && timestamp !== 0) return 'N/A';
        const num = Number(timestamp);
        const seconds = Number.isFinite(num) ? num : 0;
        const date = new Date(seconds * 1000);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const getTouristStatus = (tourist) => {
        if (!tourist) return 'returned';
        const currentTime = Math.floor(Date.now() / 1000);
        const returnDate = tourist.returnDate || tourist.validTill;
        const isActive = tourist.isActive !== undefined ? tourist.isActive : (returnDate ? returnDate > currentTime : true);
        
        if (!isActive) return 'returned';
        if (!returnDate) return 'active';
        
        const diffHours = (returnDate - currentTime) / 3600;
        if (diffHours < 0) return 'overdue';
        if (diffHours <= 24) return 'returning-soon';
        return 'active';
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
                    <p>Retrieving registered traveler profiles...</p>
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

            {/* BRAND NEW TOURIST DOSSIER VIEW MODAL (MATCHING DASHBOARD) */}
            {selectedTourist && (
                <div className="dossier-modal-overlay" onClick={() => setSelectedTourist(null)}>
                    <div className="dossier-modal-container" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Header Banner */}
                        <div className="dossier-modal-header">
                            <div className="dossier-header-left">
                                <div className={`dossier-avatar-ring ring-${getTouristStatus(selectedTourist)}`}>
                                    <div className="dossier-avatar-circle">
                                        {(selectedTourist.fullName || 'T').charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="dossier-header-titles">
                                    <div className="dossier-name-row">
                                        <h2>{selectedTourist.fullName || 'Tourist Profile'}</h2>
                                        <span className={`dossier-status-pill pill-${getTouristStatus(selectedTourist)}`}>
                                            {getTouristStatus(selectedTourist) === 'active' ? '🟢 Active Traveler' :
                                             getTouristStatus(selectedTourist) === 'returned' ? '🔵 Returned / Inactive' :
                                             getTouristStatus(selectedTourist) === 'overdue' ? '🔴 Overdue Return' : '🟡 Returning Soon'}
                                        </span>
                                    </div>
                                    <div className="dossier-subtitle-tags">
                                        <span>{selectedTourist.age ? `${selectedTourist.age} yrs` : 'Age N/A'}</span>
                                        <span className="bullet-dot">•</span>
                                        <span>{selectedTourist.gender || 'Gender N/A'}</span>
                                        <span className="bullet-dot">•</span>
                                        <span>{selectedTourist.numberOfTravellers || 1} Traveller(s)</span>
                                    </div>
                                </div>
                            </div>
                            <button className="dossier-modal-close" onClick={() => setSelectedTourist(null)} title="Close Profile" aria-label="Close">
                                <X size={20} color="#FFFFFF" strokeWidth={2.5} className="dossier-x-icon" />
                            </button>
                        </div>

                        {/* Monospace DTID Strip */}
                        <div className="dossier-dtid-strip" onClick={(e) => handleCopyDtid(selectedTourist.dtid, e)}>
                            <div className="dossier-dtid-badge">
                                <span>DIGITAL TOURIST ID (DTID)</span>
                            </div>
                            <div className="dossier-dtid-code">
                                {selectedTourist.dtid}
                            </div>
                            <button className="dossier-copy-btn">
                                {copiedDtid === selectedTourist.dtid ? (
                                    <span className="copied-text"><Check size={14} /> Copied!</span>
                                ) : (
                                    <span><Copy size={14} /> Copy</span>
                                )}
                            </button>
                        </div>

                        {/* Top Quick Stats Tiles Bar */}
                        <div className="dossier-quick-tiles">
                            <div className="dossier-tile tile-blue">
                                <span className="tile-icon"><MapPin size={16} /></span>
                                <div>
                                    <span className="tile-label">Destination</span>
                                    <strong className="tile-val-highlight">
                                        {selectedTourist.tripDetails?.destination || 'N/A'}
                                    </strong>
                                </div>
                            </div>

                            <div className="dossier-tile">
                                <span className="tile-icon"><CalendarDays size={16} /></span>
                                <div>
                                    <span className="tile-label">Check-in Date</span>
                                    <strong className="tile-val">
                                        {selectedTourist.tripDetails?.startDate || formatDate(selectedTourist.issuedAt)}
                                    </strong>
                                </div>
                            </div>

                            <div className="dossier-tile">
                                <span className="tile-icon"><Clock size={16} /></span>
                                <div>
                                    <span className="tile-label">Expected Return</span>
                                    <strong className="tile-val">{formatDate(selectedTourist.returnDate || selectedTourist.validTill)}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="dossier-modal-body">
                            
                            {/* Personal Profile Section Card */}
                            <div className="dossier-card">
                                <div className="dossier-card-title">
                                    <User size={16} className="text-primary" />
                                    <h3>Personal Profile Information</h3>
                                </div>
                                <div className="dossier-grid-rows">
                                    <div className="dossier-field-box">
                                        <span className="field-name">Age</span>
                                        <span className="field-value">{selectedTourist.age ? `${selectedTourist.age} yrs` : 'N/A'}</span>
                                    </div>
                                    <div className="dossier-field-box">
                                        <span className="field-name">Gender</span>
                                        <span className="field-value">{selectedTourist.gender || 'N/A'}</span>
                                    </div>
                                    <div className="dossier-field-box">
                                        <span className="field-name">Mobile Phone</span>
                                        <div className="field-val-action">
                                            <span className="field-value">{selectedTourist.mobileNumber || 'N/A'}</span>
                                            {selectedTourist.mobileNumber && (
                                                <a href={`tel:${selectedTourist.mobileNumber}`} className="dossier-mini-call-btn" title="Call">
                                                    <PhoneCall size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="dossier-field-box span-2">
                                        <span className="field-name">Email Address</span>
                                        <span className="field-value word-break">{selectedTourist.email || 'N/A'}</span>
                                    </div>
                                    {(selectedTourist.aadhaarLast4 || selectedTourist.aadhaar) && (
                                        <div className="dossier-field-box span-2">
                                            <span className="field-name">Aadhaar / Identity Document</span>
                                            <span className="field-value">
                                                {selectedTourist.aadhaarLast4 ? `•••• •••• ${selectedTourist.aadhaarLast4}` : `•••• •••• ${String(selectedTourist.aadhaar).slice(-4)}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Family & Group Members */}
                            {selectedTourist.familyMembers && selectedTourist.familyMembers.length > 0 && (
                                <div className="dossier-card">
                                    <div className="dossier-card-title">
                                        <Users size={16} className="text-primary" />
                                        <h3>Family & Co-Travellers ({selectedTourist.familyMembers.length})</h3>
                                    </div>
                                    <div className="dossier-people-grid">
                                        {selectedTourist.familyMembers.map((member, idx) => (
                                            <div key={idx} className="dossier-person-chip">
                                                <div className="person-avatar">
                                                    {(member.fullName || member.name || 'M').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="person-details">
                                                    <strong className="person-name">{member.fullName || member.name || 'Group Member'}</strong>
                                                    <span className="person-meta">
                                                        {member.age ? `${member.age} yrs` : ''}
                                                        {member.gender ? ` • ${member.gender}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Emergency Contacts */}
                            {selectedTourist.emergencyContacts && selectedTourist.emergencyContacts.length > 0 && (
                                <div className="dossier-card card-emergency">
                                    <div className="dossier-card-title title-red">
                                        <Phone size={16} className="text-danger" />
                                        <h3>Emergency Contacts ({selectedTourist.emergencyContacts.length})</h3>
                                    </div>
                                    <div className="dossier-emergency-list">
                                        {selectedTourist.emergencyContacts.map((contact, idx) => (
                                            <div key={idx} className="dossier-emergency-item">
                                                <div className="emergency-avatar">
                                                    {(contact.name || 'C').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="emergency-info">
                                                    <strong className="contact-name">{contact.name || 'Emergency Contact'}</strong>
                                                    <span className="contact-meta">
                                                        {contact.phone} {contact.relation ? `• ${contact.relation}` : ''}
                                                    </span>
                                                </div>
                                                {contact.phone && (
                                                    <a href={`tel:${contact.phone}`} className="emergency-dial-btn">
                                                        <PhoneCall size={14} /> Call Now
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="dossier-modal-footer">
                            <button className="btn btn-outline btn-close-dossier" onClick={() => setSelectedTourist(null)}>
                                Close Profile
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

export default TouristList;
