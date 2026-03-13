import { useState, useEffect } from 'react';
import axios from 'axios';
import { useData } from '../contexts/DataContext';
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
    Globe2,
    CalendarDays,
    MapPin,
    Activity,
    BadgeCheck,
    Phone,
    Fingerprint,
    HeartHandshake
} from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
    const [tourists, setTourists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTourist, setSelectedTourist] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        active: 0,
        newRegistrations: 0
    });

    const { refreshTrigger, isNewRegistration } = useData();

    const fetchTourists = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tourists`);
            const touristsData = response.data;
            setTourists(touristsData);
            calculateStats(touristsData);
            setError(null);
        } catch (err) {
            console.error('Error fetching tourists:', err);
            setError('Failed to load tourist data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (touristsData) => {
        const currentTime = Math.floor(Date.now() / 1000);
        const oneDayAgo = currentTime - (24 * 60 * 60);

        let activeCount = 0;
        let pendingCount = 0;
        let newRegistrationsCount = 0;

        touristsData.forEach(tourist => {
            if (tourist.isActive && currentTime <= tourist.returnDate) {
                activeCount++;
            }
            if (tourist.isActive && currentTime > tourist.returnDate) {
                pendingCount++;
            }
            if (tourist.issuedAt >= oneDayAgo) {
                newRegistrationsCount++;
            }
        });

        setStats({
            total: touristsData.length,
            pending: pendingCount,
            active: activeCount,
            newRegistrations: newRegistrationsCount
        });
    };

    const getTouristStatus = (tourist) => {
        const currentTime = Math.floor(Date.now() / 1000);

        if (!tourist.isActive) return 'returned';
        if (currentTime > tourist.returnDate) return 'overdue';

        const oneDayFromNow = currentTime + (24 * 60 * 60);
        if (tourist.returnDate <= oneDayFromNow) return 'returning-soon';

        return 'active';
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleViewTourist = (tourist) => {
        setSelectedTourist(tourist);
    };

    const closeModal = () => {
        setSelectedTourist(null);
    };

    useEffect(() => {
        fetchTourists();
        const interval = setInterval(fetchTourists, 300000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchTourists();
        }
    }, [refreshTrigger]);

    if (loading) {
        return (
            <div className="dash-container">
                <div className="dash-loading-container">
                    <div className="spinner"></div>
                    <h3>Loading Dashboard...</h3>
                    <p>Fetching latest tourist data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dash-container">
                <div className="dash-error-container">
                    <AlertTriangle size={48} className="dash-error-icon" />
                    <h3>Error Loading Dashboard</h3>
                    <p>{error}</p>
                    <button onClick={fetchTourists} className="btn btn-primary">
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dash-container fade-in">
            <div className="dash-header">
                <div className="dash-header-content">
                    <h1 className="dash-title">Tourist Safety Dashboard</h1>
                    <p className="dash-subtitle">Monitor and manage registered tourist records in real-time</p>
                </div>
                <button onClick={fetchTourists} className="btn btn-outline dash-refresh-btn">
                    <RefreshCw size={20} />
                    Refresh
                </button>
            </div>

            {isNewRegistration && (
                <div className="dash-notification-banner">
                    <ShieldCheck size={20} />
                    <span>New tourist registration completed! Dashboard updated with latest data.</span>
                </div>
            )}

            {/* Modern Statistics Cards */}
            <div className="dash-stats-grid">
                <div className="dash-stat-card dash-total-card">
                    <div className="dash-stat-icon-wrapper">
                        <Users size={32} />
                    </div>
                    <div className="dash-stat-content">
                        <div className="dash-stat-number">{stats.total}</div>
                        <div className="dash-stat-label">Total Tourists</div>
                    </div>
                </div>

                <div className="dash-stat-card dash-active-card">
                    <div className="dash-stat-icon-wrapper">
                        <UserCheck size={32} />
                    </div>
                    <div className="dash-stat-content">
                        <div className="dash-stat-number">{stats.active}</div>
                        <div className="dash-stat-label">Active Tourists</div>
                    </div>
                </div>

                <div className="dash-stat-card dash-pending-card">
                    <div className="dash-stat-icon-wrapper">
                        <Clock size={32} />
                    </div>
                    <div className="dash-stat-content">
                        <div className="dash-stat-number">{stats.pending}</div>
                        <div className="dash-stat-label">Pending Verifications</div>
                    </div>
                </div>

                <div className="dash-stat-card dash-new-card">
                    <div className="dash-stat-icon-wrapper">
                        <UserPlus size={32} />
                    </div>
                    <div className="dash-stat-content">
                        <div className="dash-stat-number">{stats.newRegistrations}</div>
                        <div className="dash-stat-label">New Registrations</div>
                    </div>
                </div>
            </div>

            {/* Tourist Records Table */}
            <div className="dash-table-container card">
                <div className="dash-table-header">
                    <h2>Registered Tourist Records</h2>
                </div>

                {tourists.length === 0 ? (
                    <div className="dash-empty-state">
                        <Users size={64} className="dash-empty-icon" />
                        <h3>No Tourist Records Found</h3>
                        <p>No tourists have been registered yet. Register new tourists to see them here.</p>
                    </div>
                ) : (
                    <div className="dash-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Digital ID</th>
                                    <th>Name</th>
                                    <th>Destination</th>
                                    <th>Check-in Date</th>
                                    <th>Check-out Date</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tourists.map((tourist) => {
                                    const status = getTouristStatus(tourist);
                                    return (
                                        <tr key={tourist.dtid}>
                                            <td>
                                                <span className="dash-dtid-badge">
                                                    {tourist.dtid}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="dash-tourist-name-cell">
                                                    <div className="name">{tourist.fullName}</div>
                                                    <div className="travellers-count">
                                                        {tourist.numberOfTravellers} traveller{tourist.numberOfTravellers > 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-sm">
                                                    <MapPin size={16} className="text-muted" />
                                                    {tourist.tripDetails?.destination || 'N/A'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-sm">
                                                    <CalendarDays size={16} className="text-muted" />
                                                    {formatDate(tourist.issuedAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-sm">
                                                    <CalendarDays size={16} className="text-muted" />
                                                    {formatDate(tourist.returnDate)}
                                                </div>
                                            </td>
                                            <td>
                                                {status === 'active' && (
                                                    <span className="badge badge-success">
                                                        <ShieldCheck size={14} />
                                                        Active
                                                    </span>
                                                )}
                                                {status === 'returned' && (
                                                    <span className="badge badge-info">
                                                        <BadgeCheck size={14} />
                                                        Returned
                                                    </span>
                                                )}
                                                {status === 'overdue' && (
                                                    <span className="badge badge-danger">
                                                        <AlertTriangle size={14} />
                                                        Overdue
                                                    </span>
                                                )}
                                                {status === 'returning-soon' && (
                                                    <span className="badge badge-warning">
                                                        <Clock size={14} />
                                                        Returning Soon
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    className="dash-btn-icon"
                                                    onClick={() => handleViewTourist(tourist)}
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tourist Detail Modal */}
            {selectedTourist && (
                <div className="dash-modal-overlay" onClick={closeModal}>
                    <div className="dash-modal-content card" onClick={(e) => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h2>Tourist Details</h2>
                            <button className="dash-btn-icon dash-close-btn" onClick={closeModal}>
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="dash-modal-body">
                            <div className="dash-detail-section">
                                <h3>Personal Information</h3>
                                <div className="dash-detail-grid">
                                    <div className="dash-detail-item">
                                        <label>Full Name</label>
                                        <span>{selectedTourist.fullName}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Digital ID</label>
                                        <span className="dash-dtid-badge">{selectedTourist.dtid}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Age</label>
                                        <span>{selectedTourist.age} years</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Gender</label>
                                        <span>{selectedTourist.gender}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Email</label>
                                        <span>{selectedTourist.email}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Mobile</label>
                                        <span>{selectedTourist.mobileNumber}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="dash-detail-section">
                                <h3>Trip Information</h3>
                                <div className="dash-detail-grid">
                                    <div className="dash-detail-item">
                                        <label>Destination</label>
                                        <span>{selectedTourist.tripDetails?.destination || 'N/A'}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Start Date</label>
                                        <span>{selectedTourist.tripDetails?.startDate || formatDate(selectedTourist.issuedAt)}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Return Date</label>
                                        <span>{formatDate(selectedTourist.returnDate)}</span>
                                    </div>
                                    <div className="dash-detail-item">
                                        <label>Number of Travellers</label>
                                        <span>{selectedTourist.numberOfTravellers}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedTourist.familyMembers && selectedTourist.familyMembers.length > 0 && (
                                <div className="dash-detail-section">
                                    <h3>Family Members</h3>
                                    <div className="dash-family-list">
                                        {selectedTourist.familyMembers.map((member, index) => (
                                            <div key={index} className="dash-family-member-card">
                                                <p><strong>{member.name}</strong></p>
                                                <p>{member.age} years • {member.relation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedTourist.emergencyContacts && selectedTourist.emergencyContacts.length > 0 && (
                                <div className="dash-detail-section">
                                    <h3>Emergency Contacts</h3>
                                    <div className="dash-family-list">
                                        {selectedTourist.emergencyContacts.map((contact, index) => (
                                            <div key={index} className="dash-family-member-card">
                                                <p><strong>{contact.name}</strong></p>
                                                <p>{contact.phone} • {contact.relation}</p>
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

export default Dashboard;
