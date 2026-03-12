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
    CheckCircle,
    AlertTriangle,
    XCircle,
    Home,
    Calendar,
    MapPin
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
        const interval = setInterval(fetchTourists, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchTourists();
        }
    }, [refreshTrigger]);

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <h3>Loading Dashboard...</h3>
                    <p>Fetching latest tourist data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div className="error-container">
                    <AlertTriangle size={48} className="error-icon" />
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
        <div className="dashboard-container fade-in">
            <div className="dashboard-header">
                <div className="header-content">
                    <h1 className="dashboard-title">Tourist Safety Dashboard</h1>
                    <p className="dashboard-subtitle">Monitor and manage registered tourist records in real-time</p>
                </div>
                <button onClick={fetchTourists} className="btn btn-outline refresh-btn">
                    <RefreshCw size={20} />
                    Refresh
                </button>
            </div>

            {isNewRegistration && (
                <div className="notification-banner">
                    <CheckCircle size={20} />
                    <span>New tourist registration completed! Dashboard updated with latest data.</span>
                </div>
            )}

            {/* Modern Statistics Cards */}
            <div className="stats-grid">
                <div className="stat-card total-card">
                    <div className="stat-icon-wrapper">
                        <Users size={32} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{stats.total}</div>
                        <div className="stat-label">Total Tourists</div>
                    </div>
                </div>

                <div className="stat-card active-card">
                    <div className="stat-icon-wrapper">
                        <UserCheck size={32} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{stats.active}</div>
                        <div className="stat-label">Active Tourists</div>
                    </div>
                </div>

                <div className="stat-card pending-card">
                    <div className="stat-icon-wrapper">
                        <Clock size={32} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{stats.pending}</div>
                        <div className="stat-label">Pending Verifications</div>
                    </div>
                </div>

                <div className="stat-card new-card">
                    <div className="stat-icon-wrapper">
                        <UserPlus size={32} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{stats.newRegistrations}</div>
                        <div className="stat-label">New Registrations</div>
                    </div>
                </div>
            </div>

            {/* Tourist Records Table */}
            <div className="table-container card">
                <div className="table-header">
                    <h2>Registered Tourist Records</h2>
                </div>

                {tourists.length === 0 ? (
                    <div className="empty-state">
                        <Users size={64} className="empty-icon" />
                        <h3>No Tourist Records Found</h3>
                        <p>No tourists have been registered yet. Register new tourists to see them here.</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
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
                                                <span className="dtid-badge">
                                                    {tourist.dtid.split('-')[0]}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="tourist-name-cell">
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
                                                    <Calendar size={16} className="text-muted" />
                                                    {formatDate(tourist.issuedAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-sm">
                                                    <Calendar size={16} className="text-muted" />
                                                    {formatDate(tourist.returnDate)}
                                                </div>
                                            </td>
                                            <td>
                                                {status === 'active' && (
                                                    <span className="badge badge-success">
                                                        <CheckCircle size={14} />
                                                        Active
                                                    </span>
                                                )}
                                                {status === 'returned' && (
                                                    <span className="badge badge-info">
                                                        <Home size={14} />
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
                                                    className="btn-icon"
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
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Tourist Details</h2>
                            <button className="btn-icon close-btn" onClick={closeModal}>
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-section">
                                <h3>Personal Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Full Name</label>
                                        <span>{selectedTourist.fullName}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Digital ID</label>
                                        <span className="dtid-badge">{selectedTourist.dtid}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Age</label>
                                        <span>{selectedTourist.age} years</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Gender</label>
                                        <span>{selectedTourist.gender}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Email</label>
                                        <span>{selectedTourist.email}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Mobile</label>
                                        <span>{selectedTourist.mobileNumber}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3>Trip Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Destination</label>
                                        <span>{selectedTourist.tripDetails?.destination || 'N/A'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Start Date</label>
                                        <span>{selectedTourist.tripDetails?.startDate || formatDate(selectedTourist.issuedAt)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Return Date</label>
                                        <span>{formatDate(selectedTourist.returnDate)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Number of Travellers</label>
                                        <span>{selectedTourist.numberOfTravellers}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedTourist.familyMembers && selectedTourist.familyMembers.length > 0 && (
                                <div className="detail-section">
                                    <h3>Family Members</h3>
                                    <div className="family-list">
                                        {selectedTourist.familyMembers.map((member, index) => (
                                            <div key={index} className="family-member-card">
                                                <p><strong>{member.name}</strong></p>
                                                <p>{member.age} years • {member.relation}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedTourist.emergencyContacts && selectedTourist.emergencyContacts.length > 0 && (
                                <div className="detail-section">
                                    <h3>Emergency Contacts</h3>
                                    <div className="family-list">
                                        {selectedTourist.emergencyContacts.map((contact, index) => (
                                            <div key={index} className="family-member-card">
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
