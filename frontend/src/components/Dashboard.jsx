import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '../config/api';
import { useData } from '../contexts/DataContext';
import { getTouristTelemetry } from '../utils/telemetryHelper';
import {
    Users,
    UserCheck,
    UserPlus,
    Clock,
    RefreshCw,
    Eye,
    ShieldCheck,
    AlertTriangle,
    X,
    MapPin,
    CalendarDays,
    BadgeCheck,
    Phone,
    Search,
    Copy,
    Check,
    LayoutGrid,
    Table as TableIcon,
    Compass,
    User,
    ChevronRight,
    ShieldAlert,
    LayoutDashboard,
    Activity,
    Mail,
    PhoneCall
} from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
    const { 
        tourists, 
        panicAlerts, 
        isNewRegistration,
        loadingTourists: loading,
        fetchTourists: refreshGlobalTourists,
        fetchTouristByDtid
    } = useData();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedTourist, setSelectedTourist] = useState(null);
    const [query, setQuery] = useState('');

    // Periodic UI tick to re-evaluate telemetry freshness age every 30 seconds
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(timer);
    }, []);

    // Auto-fetch fresh single-tourist telemetry from server on modal opening
    useEffect(() => {
        if (!selectedTourist?.dtid) return;
        let isMounted = true;
        fetchTouristByDtid(selectedTourist.dtid, true).then(fresh => {
            if (isMounted && fresh) {
                setSelectedTourist(prev => {
                    if (!prev) return fresh;
                    const prevD = String(prev.dtid || '').toLowerCase().trim();
                    const freshD = String(fresh.dtid || '').toLowerCase().trim();
                    if (!prevD || !freshD || prevD === freshD) {
                        return { ...prev, ...fresh };
                    }
                    return prev;
                });
            }
        });
        return () => { isMounted = false; };
    }, [selectedTourist?.dtid, fetchTouristByDtid]);

    const activeSelectedTourist = useMemo(() => {
        if (!selectedTourist) return null;
        const sDtid = String(selectedTourist.dtid || '').toLowerCase().trim();
        const fromList = tourists.find(t => t.dtid && String(t.dtid).toLowerCase().trim() === sDtid);
        if (!fromList) return selectedTourist;
        return { ...fromList, ...selectedTourist };
    }, [selectedTourist, tourists]);

    const extractCoordinates = (tourist) => {
        if (!tourist) return null;
        let lat = null, lng = null, accuracy = null, timestamp = null;
        if (tourist.lastKnownLocation && typeof tourist.lastKnownLocation === 'object') {
            lat = tourist.lastKnownLocation.latitude ?? tourist.lastKnownLocation.lat;
            lng = tourist.lastKnownLocation.longitude ?? tourist.lastKnownLocation.lng;
            accuracy = tourist.lastKnownLocation.accuracy;
            timestamp = tourist.lastKnownLocation.timestamp;
        }
        if (lat == null || lng == null) {
            lat = tourist.latitude ?? tourist.lat ?? tourist.lastKnownLatitude;
            lng = tourist.longitude ?? tourist.lng ?? tourist.lastKnownLongitude;
        }
        if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
            return {
                latitude: Number(lat),
                longitude: Number(lng),
                accuracy: accuracy != null && !isNaN(Number(accuracy)) ? Number(accuracy) : null,
                timestamp: timestamp || tourist.lastLocationStatusUpdate || tourist.updatedAt
            };
        }
        return null;
    };

    const extractGpsStatus = (tourist) => {
        if (!tourist) return null;
        const raw = tourist.gpsStatus || tourist.status || tourist.locationStatus;
        if (typeof raw === 'string') {
            const s = raw.trim().toLowerCase();
            if (s === 'disabled' || s === 'unavailable' || s === 'offline') return 'disabled';
            if (s === 'active' || s === 'online' || s === 'tracking') return 'active';
            return s;
        }
        return raw || null;
    };

    const formatTelemetryTimestamp = (timestamp, fallbackUpdate) => {
        const raw = timestamp || fallbackUpdate;
        if (!raw) return null;
        try {
            let dateObj;
            if (typeof raw === 'string') dateObj = new Date(raw);
            else if (typeof raw === 'number') dateObj = new Date(raw);
            else if (raw._seconds) dateObj = new Date(raw._seconds * 1000);
            else if (raw.seconds) dateObj = new Date(raw.seconds * 1000);
            else if (raw.toDate && typeof raw.toDate === 'function') dateObj = raw.toDate();
            else dateObj = new Date(raw);
            if (isNaN(dateObj.getTime())) return null;
            return dateObj.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch (e) {
            return null;
        }
    };
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'returning-soon' | 'overdue' | 'returned'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [copiedDtid, setCopiedDtid] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refreshGlobalTourists();
        setLastRefreshed(new Date());
        setIsRefreshing(false);
    };

    // Calculate status of a tourist
    const getTouristStatus = (tourist) => {
        const currentTime = Math.floor(Date.now() / 1000);

        if (!tourist.isActive) return 'returned';
        if (currentTime > tourist.returnDate) return 'overdue';

        const oneDayFromNow = currentTime + (24 * 60 * 60);
        if (tourist.returnDate <= oneDayFromNow) return 'returning-soon';

        return 'active';
    };

    // Calculate aggregated stats
    const stats = useMemo(() => {
        const currentTime = Math.floor(Date.now() / 1000);
        const oneDayAgo = currentTime - (24 * 60 * 60);

        let activeCount = 0;
        let pendingOverdueCount = 0;
        let returningSoonCount = 0;
        let returnedCount = 0;
        let newRegistrationsCount = 0;

        tourists.forEach(tourist => {
            const status = getTouristStatus(tourist);
            if (status === 'active') activeCount++;
            if (status === 'overdue') pendingOverdueCount++;
            if (status === 'returning-soon') returningSoonCount++;
            if (status === 'returned') returnedCount++;

            if (tourist.issuedAt && tourist.issuedAt >= oneDayAgo) {
                newRegistrationsCount++;
            }
        });

        return {
            total: tourists.length,
            active: activeCount + returningSoonCount,
            overdue: pendingOverdueCount,
            returningSoon: returningSoonCount,
            returned: returnedCount,
            newRegistrations: newRegistrationsCount,
            activePanicCount: panicAlerts?.filter(a => a.status !== 'resolved')?.length || 0
        };
    }, [tourists, panicAlerts]);

    // Filter tourists based on search query & status filter
    const filteredTourists = useMemo(() => {
        return tourists.filter(tourist => {
            const status = getTouristStatus(tourist);

            // Filter by status tab
            if (statusFilter === 'active' && status !== 'active' && status !== 'returning-soon') return false;
            if (statusFilter === 'returning-soon' && status !== 'returning-soon') return false;
            if (statusFilter === 'overdue' && status !== 'overdue') return false;
            if (statusFilter === 'returned' && status !== 'returned') return false;

            // Search query filter
            if (query.trim()) {
                const q = query.toLowerCase().trim();
                const dtid = (tourist.dtid || '').toLowerCase();
                const name = (tourist.fullName || '').toLowerCase();
                const dest = (tourist.tripDetails?.destination || '').toLowerCase();
                const mobile = (tourist.mobileNumber || '').toLowerCase();
                return dtid.includes(q) || name.includes(q) || dest.includes(q) || mobile.includes(q);
            }

            return true;
        });
    }, [tourists, statusFilter, query]);

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleCopyDtid = (dtid, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(dtid);
        setCopiedDtid(dtid);
        setTimeout(() => setCopiedDtid(null), 2000);
    };

    const handleViewTourist = (tourist) => {
        setSelectedTourist(tourist);
    };

    const closeModal = () => {
        setSelectedTourist(null);
    };

    if (loading && tourists.length === 0) {
        return (
            <div className="db-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 85px)', width: '100%' }}>
                <div className="db-loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto', textAlign: 'center' }}>
                    <div className="loading-spinner"></div>
                    <h3>Loading Dashboard...</h3>
                    <p>Preparing safety telemetry & regional records...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="db-page-wrapper fade-in">
            {/* Hero Header Section - Matching App Theme Header */}
            <header className="db-hero-header">
                <div className="db-hero-content">
                    <div className="db-title-row">
                        <div className="db-title-meta">
                            <span className="db-badge-pill">
                                <LayoutDashboard size={14} /> Official Safety Hub
                            </span>
                            <h1 className="db-main-title">Tourist Safety Dashboard</h1>
                            <p className="db-main-subtitle">
                                Real-time monitoring of registered traveler status, Digital IDs (DTID), geofence alerts, and emergency response centers.
                            </p>
                        </div>

                        {/* Top Stats Strip Inside Hero Banner */}
                        <div className="db-stats-strip">
                            <div 
                                className={`db-stat-chip ${statusFilter === 'active' ? 'active-chip' : ''}`}
                                onClick={() => setStatusFilter('active')}
                                title="Filter Active Travelers"
                            >
                                <span className="stat-num">{stats.active}</span>
                                <span className="stat-label">Active Travelers</span>
                            </div>

                            <div 
                                className={`db-stat-chip ${statusFilter === 'all' ? 'active-chip' : ''}`}
                                onClick={() => setStatusFilter('all')}
                                title="View All Travelers"
                            >
                                <span className="stat-num">{stats.total}</span>
                                <span className="stat-label">Total Registered</span>
                            </div>

                            <div 
                                className={`db-stat-chip ${statusFilter === 'overdue' ? 'active-chip' : ''}`}
                                onClick={() => setStatusFilter('overdue')}
                                title="Filter Overdue Travelers"
                            >
                                <span className="stat-num">{stats.overdue}</span>
                                <span className="stat-label">Overdue / Attention</span>
                            </div>

                            <div 
                                className="db-stat-chip"
                                onClick={() => { setStatusFilter('all'); setQuery(''); }}
                                title="New Registrations in 24h"
                            >
                                <span className="stat-num">{stats.newRegistrations}</span>
                                <span className="stat-label">New (24h)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Container Resting Below Hero Curve */}
            <main className="db-main-container">
                {/* 1. Floating Controls Toolbar Card */}
                <div className="db-controls-card">
                    <div className="db-search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by Tourist Name, DTID, Mobile, or Destination..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="db-search-input-field"
                        />
                        {query && (
                            <button className="btn-clear-search" onClick={() => setQuery('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Pills */}
                    <div className="db-filter-pills">
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
                            className={`filter-btn ${statusFilter === 'returning-soon' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('returning-soon')}
                        >
                            <span className="dot-warning"></span> Returning Soon ({stats.returningSoon})
                        </button>
                        <button
                            className={`filter-btn ${statusFilter === 'overdue' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('overdue')}
                        >
                            <span className="dot-red"></span> Overdue ({stats.overdue})
                        </button>
                        <button
                            className={`filter-btn ${statusFilter === 'returned' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('returned')}
                        >
                            <span className="dot-grey"></span> Returned ({stats.returned})
                        </button>
                    </div>

                    {/* Right Actions: View Toggle & Refresh */}
                    <div className="db-right-actions">
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

                        <button 
                            className={`btn-refresh-accent ${isRefreshing ? 'is-spinning' : ''}`}
                            onClick={handleManualRefresh}
                        >
                            <RefreshCw size={15} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* 2. Emergency SOS Alert Banner */}
                {stats.activePanicCount > 0 && (
                    <div className="db-alert-banner">
                        <div className="db-alert-banner-left">
                            <ShieldAlert size={24} className="db-sos-icon-pulse" />
                            <div>
                                <div className="db-alert-title-row">
                                    <span className="db-sos-pill-badge">Emergency</span>
                                    <strong>Active SOS Emergency Alerts ({stats.activePanicCount})</strong>
                                </div>
                                <p>Distress signals detected in real-time. Immediate response required.</p>
                            </div>
                        </div>
                        <a href="/panic-alerts" className="db-alert-link">
                            View Live Panic Alerts <ChevronRight size={16} />
                        </a>
                    </div>
                )}

                {isNewRegistration && (
                    <div className="db-notification-banner">
                        <ShieldCheck size={20} />
                        <span>New tourist registration verified! Dashboard updated automatically.</span>
                    </div>
                )}

                {/* 3. Live Regional Geofence Map Card Section */}
                <div className="db-map-card">
                    <div className="db-map-card-header">
                        <div className="db-map-header-left">
                            <MapPin size={18} className="map-icon" />
                            <h3>Live Geofencing & Location Monitoring</h3>
                        </div>
                        <div className="db-map-header-right">
                            <span className="db-map-chip">
                                <Activity size={13} /> GPS Geofence Grid Active
                            </span>
                            <span className="db-map-chip chip-cyan">
                                Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                    <div className="db-map-container">
                        <iframe
                            title="Google Map Live Geofence"
                            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15000000!2d80!3d20!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                            width="100%"
                            height="340"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        ></iframe>
                    </div>
                </div>

                {/* Empty State */}
                {filteredTourists.length === 0 ? (
                    <div className="db-empty-state-card">
                        <Users size={54} className="empty-icon" />
                        <h3>No Tourist Records Found</h3>
                        <p>
                            {query 
                                ? `No tourist profiles match your query "${query}".`
                                : 'No tourists match the selected filter category.'}
                        </p>
                        <button 
                            className="btn btn-outline mt-sm"
                            onClick={() => { setQuery(''); setStatusFilter('all'); }}
                        >
                            Clear Search & Filters
                        </button>
                    </div>
                ) : (
                    /* Content Grid or Table */
                    viewMode === 'grid' ? (
                        <div className="db-grid-container">
                            {filteredTourists.map((tourist) => {
                                const status = getTouristStatus(tourist);
                                const initial = (tourist.fullName || 'T').charAt(0).toUpperCase();

                                return (
                                    <div 
                                        key={tourist.dtid} 
                                        className="db-profile-card"
                                        onClick={() => handleViewTourist(tourist)}
                                    >
                                        {/* Profile Card Header Block */}
                                        <div className="db-profile-header">
                                            <div className="db-avatar-circle">{initial}</div>
                                            <div className="db-profile-title">
                                                <h3>{tourist.fullName || 'Registered Tourist'}</h3>
                                                <div className="db-profile-meta">
                                                    {tourist.age ? `${tourist.age} yrs` : 'Age N/A'}
                                                    {tourist.gender ? ` • ${tourist.gender}` : ''}
                                                </div>
                                            </div>
                                            <div className="db-status-chip-wrapper">
                                                {status === 'active' && (
                                                    <span className="db-status-chip chip-active">
                                                        <span className="dot"></span> Active
                                                    </span>
                                                )}
                                                {status === 'returned' && (
                                                    <span className="db-status-chip chip-returned">
                                                        <span className="dot"></span> Returned
                                                    </span>
                                                )}
                                                {status === 'overdue' && (
                                                    <span className="db-status-chip chip-overdue">
                                                        <span className="dot"></span> Overdue
                                                    </span>
                                                )}
                                                {status === 'returning-soon' && (
                                                    <span className="db-status-chip chip-warning">
                                                        <span className="dot"></span> Returning Soon
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Dedicated DTID Strip */}
                                        <div 
                                            className="db-dtid-strip"
                                            onClick={(e) => handleCopyDtid(tourist.dtid, e)}
                                            title="Click to copy DTID"
                                        >
                                            <span className="dtid-badge">DTID</span>
                                            <span className="dtid-val">{tourist.dtid}</span>
                                            <button className="btn-copy-dtid">
                                                {copiedDtid === tourist.dtid ? (
                                                    <Check size={14} className="text-success" />
                                                ) : (
                                                    <Copy size={14} />
                                                )}
                                            </button>
                                        </div>

                                        {/* Profile Card Body */}
                                        <div className="db-profile-body">
                                            <div className="db-info-row">
                                                <span className="info-label">
                                                    <MapPin size={14} className="info-icon" /> Destination
                                                </span>
                                                <span className="info-val val-destination">
                                                    {tourist.tripDetails?.destination || 'N/A'}
                                                </span>
                                            </div>

                                            <div className="db-info-row">
                                                <span className="info-label">
                                                    <CalendarDays size={14} className="info-icon" /> Check-in
                                                </span>
                                                <span className="info-val">
                                                    {formatDate(tourist.issuedAt)}
                                                </span>
                                            </div>

                                            <div className="db-info-row">
                                                <span className="info-label">
                                                    <Clock size={14} className="info-icon" /> Check-out
                                                </span>
                                                <span className="info-val">
                                                    {formatDate(tourist.returnDate)}
                                                </span>
                                            </div>

                                            <div className="db-info-row">
                                                <span className="info-label">
                                                    <Phone size={14} className="info-icon" /> Mobile
                                                </span>
                                                <span className="info-val">
                                                    {tourist.mobileNumber || 'N/A'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Profile Card Footer */}
                                        <div className="db-profile-footer">
                                            <span className="traveller-count">
                                                <Users size={14} /> {tourist.numberOfTravellers || 1} Traveller(s)
                                            </span>
                                            <button 
                                                className="btn-view-details"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewTourist(tourist);
                                                }}
                                            >
                                                <Eye size={14} /> View Details
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Table View */
                        <div className="db-table-card">
                            <div className="db-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Digital ID (DTID)</th>
                                            <th>Tourist & Group</th>
                                            <th>Destination</th>
                                            <th>Check-in Date</th>
                                            <th>Expected Check-out</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTourists.map((tourist) => {
                                            const status = getTouristStatus(tourist);
                                            return (
                                                <tr key={tourist.dtid}>
                                                    <td>
                                                        <div 
                                                            className="db-table-dtid-chip"
                                                            onClick={(e) => handleCopyDtid(tourist.dtid, e)}
                                                            title="Click to copy DTID"
                                                        >
                                                            <span>{tourist.dtid}</span>
                                                            {copiedDtid === tourist.dtid ? (
                                                                <Check size={12} className="text-success" />
                                                            ) : (
                                                                <Copy size={12} />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="db-table-name-cell">
                                                            <span className="name">{tourist.fullName}</span>
                                                            <span className="meta">
                                                                {tourist.numberOfTravellers} traveller(s)
                                                                {tourist.age ? ` • ${tourist.age} yrs` : ''}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center gap-sm">
                                                            <MapPin size={15} className="text-primary" />
                                                            <span className="val-destination">{tourist.tripDetails?.destination || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span>{formatDate(tourist.issuedAt)}</span>
                                                    </td>
                                                    <td>
                                                        <span>{formatDate(tourist.returnDate)}</span>
                                                    </td>
                                                    <td>
                                                        {status === 'active' && (
                                                            <span className="db-status-chip chip-active">
                                                                <span className="dot"></span> Active
                                                            </span>
                                                        )}
                                                        {status === 'returned' && (
                                                            <span className="db-status-chip chip-returned">
                                                                <span className="dot"></span> Returned
                                                            </span>
                                                        )}
                                                        {status === 'overdue' && (
                                                            <span className="db-status-chip chip-overdue">
                                                                <span className="dot"></span> Overdue
                                                            </span>
                                                        )}
                                                        {status === 'returning-soon' && (
                                                            <span className="db-status-chip chip-warning">
                                                                <span className="dot"></span> Returning Soon
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="db-action-btn"
                                                            onClick={() => handleViewTourist(tourist)}
                                                            title="View Full Profile"
                                                        >
                                                            <Eye size={15} />
                                                            <span className="btn-action-text">View</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                )}
            </main>

            {/* BRAND NEW TOURIST DOSSIER VIEW MODAL */}
            {selectedTourist && (
                <div className="dossier-modal-overlay" onClick={closeModal}>
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
                            <button className="dossier-modal-close" onClick={closeModal} title="Close Profile" aria-label="Close">
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
                                    <strong className="tile-val">{formatDate(selectedTourist.issuedAt)}</strong>
                                </div>
                            </div>

                            <div className="dossier-tile">
                                <span className="tile-icon"><Clock size={16} /></span>
                                <div>
                                    <span className="tile-label">Expected Return</span>
                                    <strong className="tile-val">{formatDate(selectedTourist.returnDate)}</strong>
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
                                </div>
                            </div>

                            {/* GPS Telemetry & Last Known Location Card */}
                            {(() => {
                                const telemetry = getTouristTelemetry(activeSelectedTourist);
                                return (
                                    <div className="dossier-card">
                                        <div className="dossier-card-title">
                                            <Compass size={16} className="text-primary" />
                                            <h3>GPS Telemetry & Last Known Location</h3>
                                        </div>
                                        <div className="dossier-grid-rows">
                                            <div className="dossier-field-box">
                                                <span className="field-name">GPS Status</span>
                                                <span className={`field-value ${telemetry.statusBadgeClass}`} style={{ fontWeight: 600 }}>
                                                    {telemetry.statusIcon} {telemetry.statusLabel}
                                                </span>
                                            </div>
                                            <div className="dossier-field-box span-2">
                                                <span className="field-name">Last Known Coordinates (Lat, Lng)</span>
                                                <span className="field-value font-highlight">
                                                    {telemetry.coordinates
                                                        ? `${telemetry.coordinates.latitude.toFixed(6)}, ${telemetry.coordinates.longitude.toFixed(6)}`
                                                        : 'No Last Known Location recorded'}
                                                </span>
                                            </div>
                                            {telemetry.accuracy != null && (
                                                <div className="dossier-field-box">
                                                    <span className="field-name">GPS Accuracy</span>
                                                    <span className="field-value">
                                                        ±{telemetry.accuracy.toFixed(1)} m
                                                    </span>
                                                </div>
                                            )}
                                            {telemetry.formattedTimestamp && (
                                                <div className="dossier-field-box span-2">
                                                    <span className="field-name">Last Updated</span>
                                                    <span className="field-value">
                                                        {telemetry.formattedTimestamp} {telemetry.isStale ? '(Stale > 5 mins)' : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {telemetry.coordinates && (
                                            <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                <AlertTriangle size={14} />
                                                <span>⚠️ Last Known Location — not a live tracking trail</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

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
                            <button className="btn btn-outline btn-close-dossier" onClick={closeModal}>
                                Close Profile
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
