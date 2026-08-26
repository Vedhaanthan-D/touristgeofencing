import { useState, useEffect, useMemo } from 'react';
import { 
    MapPin, Plus, Trash2, Edit3, Save, X, AlertTriangle, 
    CheckCircle2, RefreshCw, Layers, ShieldAlert, Sparkles,
    Search, LayoutGrid, Table as TableIcon, ExternalLink, Filter
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';

const API_BASE = API_BASE_URL;

function ManageZones() {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Search, Filter & View Mode
    const [query, setQuery] = useState('');
    const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Modal / Form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        risk_level: 'high',
        polygon: [
            { latitude: '', longitude: '' },
            { latitude: '', longitude: '' },
            { latitude: '', longitude: '' }
        ]
    });

    const getAuthHeader = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Not authenticated');
        const token = await currentUser.getIdToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const fetchZones = async () => {
        setLoading(true);
        setError('');
        try {
            // Primary: Fetch directly from Firestore JS SDK
            const querySnapshot = await getDocs(collection(db, 'restricted_zones'));
            const data = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setZones(data);
        } catch (firestoreErr) {
            console.warn('Firestore direct fetch issue, trying backend API fallback...', firestoreErr);
            try {
                const headers = await getAuthHeader();
                const res = await fetch(`${API_BASE}/api/restricted-zones`, { headers });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to fetch geofenced zones');
                }
                const data = await res.json();
                setZones(data);
            } catch (err) {
                console.error('Error fetching zones:', err);
                setError(err.message || 'Failed to load restricted zones');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
    }, []);

    // Quick Statistics
    const stats = useMemo(() => {
        let high = 0;
        let medium = 0;
        let low = 0;
        zones.forEach(z => {
            const risk = (z.risk_level || 'high').toLowerCase();
            if (risk === 'high') high++;
            else if (risk === 'medium') medium++;
            else if (risk === 'low') low++;
            else high++;
        });
        return { total: zones.length, high, medium, low };
    }, [zones]);

    // Filtered Zones
    const filteredZones = useMemo(() => {
        let result = zones;

        if (riskFilter !== 'all') {
            result = result.filter(z => (z.risk_level || 'high').toLowerCase() === riskFilter.toLowerCase());
        }

        const q = query.trim().toLowerCase();
        if (q) {
            result = result.filter(z => {
                const nameMatch = String(z.name || '').toLowerCase().includes(q);
                const descMatch = String(z.description || '').toLowerCase().includes(q);
                const polyMatch = Array.isArray(z.polygon) && z.polygon.some(pt => 
                    String(pt.latitude).includes(q) || String(pt.longitude).includes(q)
                );
                return nameMatch || descMatch || polyMatch;
            });
        }

        return result;
    }, [zones, query, riskFilter]);

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            risk_level: 'high',
            polygon: [
                { latitude: '11.368774', longitude: '77.818509' },
                { latitude: '11.368774', longitude: '77.836909' },
                { latitude: '11.350774', longitude: '77.836909' }
            ]
        });
        setEditingZoneId(null);
        setError('');
    };

    const handleOpenCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (zone) => {
        setEditingZoneId(zone.id);
        const polygonPoints = Array.isArray(zone.polygon) && zone.polygon.length > 0
            ? zone.polygon.map(pt => ({ latitude: String(pt.latitude), longitude: String(pt.longitude) }))
            : [{ latitude: '', longitude: '' }];

        setFormData({
            name: zone.name || '',
            description: zone.description || '',
            risk_level: zone.risk_level || 'high',
            polygon: polygonPoints
        });
        setIsModalOpen(true);
    };

    const handleAddPoint = () => {
        setFormData(prev => ({
            ...prev,
            polygon: [...prev.polygon, { latitude: '', longitude: '' }]
        }));
    };

    const handleRemovePoint = (index) => {
        if (formData.polygon.length <= 1) {
            setError('At least 1 polygon point coordinate is required');
            return;
        }
        setFormData(prev => ({
            ...prev,
            polygon: prev.polygon.filter((_, i) => i !== index)
        }));
    };

    const handlePointChange = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.polygon];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, polygon: updated };
        });
    };

    const handleFillPreset = () => {
        setFormData({
            name: 'KSRCT IT Park Restricted Zone',
            description: 'Sensitive Geo-fenced Area requiring mandatory monitoring',
            risk_level: 'high',
            polygon: [
                { latitude: '11.368774', longitude: '77.818509' },
                { latitude: '11.368774', longitude: '77.836909' },
                { latitude: '11.350774', longitude: '77.836909' },
                { latitude: '11.350774', longitude: '77.818509' }
            ]
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!formData.name.trim()) {
            setError('Zone name is required');
            return;
        }

        const validPolygon = [];
        for (let i = 0; i < formData.polygon.length; i++) {
            const pt = formData.polygon[i];
            const lat = parseFloat(pt.latitude);
            const lng = parseFloat(pt.longitude);
            if (isNaN(lat) || isNaN(lng)) {
                setError(`Invalid coordinate numbers at Point #${i}`);
                return;
            }
            validPolygon.push({ latitude: lat, longitude: lng });
        }

        setActionLoading(true);
        try {
            const payload = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                risk_level: formData.risk_level,
                polygon: validPolygon
            };

            if (editingZoneId) {
                const zoneRef = doc(db, 'restricted_zones', editingZoneId);
                await updateDoc(zoneRef, {
                    ...payload,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'restricted_zones'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
            }

            setSuccessMsg(editingZoneId ? 'Geofenced zone updated successfully!' : 'Geofenced zone created successfully!');
            setIsModalOpen(false);
            fetchZones();
        } catch (firestoreErr) {
            console.warn('Firestore direct write failed, trying backend API fallback...', firestoreErr);
            try {
                const headers = await getAuthHeader();
                const payload = {
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    risk_level: formData.risk_level,
                    polygon: validPolygon
                };

                let response;
                if (editingZoneId) {
                    response = await fetch(`${API_BASE}/api/restricted-zones/${editingZoneId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(payload)
                    });
                } else {
                    response = await fetch(`${API_BASE}/api/restricted-zones`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(payload)
                    });
                }

                if (!response.ok) {
                    const resData = await response.json().catch(() => ({}));
                    throw new Error(resData.error || 'Failed to save geofenced zone');
                }

                setSuccessMsg(editingZoneId ? 'Geofenced zone updated successfully!' : 'Geofenced zone created successfully!');
                setIsModalOpen(false);
                fetchZones();
            } catch (err) {
                console.error('Submit error:', err);
                setError(err.message || 'Failed to save restricted zone');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (zoneId, zoneName) => {
        if (!window.confirm(`Are you sure you want to delete "${zoneName}"?`)) return;

        setActionLoading(true);
        setError('');
        setSuccessMsg('');
        try {
            await deleteDoc(doc(db, 'restricted_zones', zoneId));
            setSuccessMsg(`Zone "${zoneName}" deleted successfully.`);
            fetchZones();
        } catch (firestoreErr) {
            console.warn('Firestore direct delete failed, trying backend API fallback...', firestoreErr);
            try {
                const headers = await getAuthHeader();
                const res = await fetch(`${API_BASE}/api/restricted-zones/${zoneId}`, {
                    method: 'DELETE',
                    headers
                });

                if (!res.ok) {
                    const resData = await res.json().catch(() => ({}));
                    throw new Error(resData.error || 'Failed to delete restricted zone');
                }

                setSuccessMsg(`Zone "${zoneName}" deleted successfully.`);
                fetchZones();
            } catch (err) {
                console.error('Delete error:', err);
                setError(err.message || 'Failed to delete zone');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const getGoogleMapUrl = (polygon) => {
        if (Array.isArray(polygon) && polygon.length > 0) {
            const first = polygon[0];
            if (first?.latitude && first?.longitude) {
                return `https://www.google.com/maps?q=${first.latitude},${first.longitude}`;
            }
        }
        return null;
    };

    return (
        <div className="mz-page-wrapper fade-in">
            {/* Hero Header Section */}
            <div className="mz-hero-header">
                <div className="mz-hero-content">
                    <div className="mz-title-row">
                        <div>
                            <span className="mz-badge-pill">
                                <ShieldAlert size={14} /> Geofence Control Panel
                            </span>
                            <h1 className="mz-main-title">Geofenced Restricted Zones</h1>
                            <p className="mz-main-subtitle">
                                Govt Officials interface for establishing, monitoring, and updating geofence boundary coordinates and alert risk severity levels.
                            </p>
                        </div>

                        {/* Top Stats Strip */}
                        <div className="mz-stats-strip">
                            <div 
                                className={`mz-stat-chip ${riskFilter === 'all' ? 'active-chip' : ''}`}
                                onClick={() => setRiskFilter('all')}
                                title="Click to view all zones"
                            >
                                <span className="stat-num">{stats.total}</span>
                                <span className="stat-label">Total Zones</span>
                            </div>
                            <div 
                                className={`mz-stat-chip chip-high ${riskFilter === 'high' ? 'active-chip' : ''}`}
                                onClick={() => setRiskFilter(riskFilter === 'high' ? 'all' : 'high')}
                                title="Click to filter High Risk"
                            >
                                <span className="stat-num text-danger">{stats.high}</span>
                                <span className="stat-label">High Risk</span>
                            </div>
                            <div 
                                className={`mz-stat-chip chip-medium ${riskFilter === 'medium' ? 'active-chip' : ''}`}
                                onClick={() => setRiskFilter(riskFilter === 'medium' ? 'all' : 'medium')}
                                title="Click to filter Medium Risk"
                            >
                                <span className="stat-num text-warning">{stats.medium}</span>
                                <span className="stat-label">Medium Risk</span>
                            </div>
                            <div 
                                className={`mz-stat-chip chip-low ${riskFilter === 'low' ? 'active-chip' : ''}`}
                                onClick={() => setRiskFilter(riskFilter === 'low' ? 'all' : 'low')}
                                title="Click to filter Low Risk"
                            >
                                <span className="stat-num text-success">{stats.low}</span>
                                <span className="stat-label">Low Risk</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="mz-main-container">
                {/* Search & Filter Controls Bar */}
                <div className="mz-controls-card">
                    <div className="mz-controls-left">
                        <div className="mz-search-wrapper">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by zone name, description, or Lat/Lng..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="mz-search-input"
                            />
                            {query && (
                                <button className="clear-search-btn" onClick={() => setQuery('')}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="mz-filter-group">
                            <Filter size={15} className="filter-label-icon" />
                            <select
                                value={riskFilter}
                                onChange={(e) => setRiskFilter(e.target.value)}
                                className="mz-risk-select"
                            >
                                <option value="all">All Severity Levels</option>
                                <option value="high">High Risk Only</option>
                                <option value="medium">Medium Risk Only</option>
                                <option value="low">Low Risk Only</option>
                            </select>
                        </div>
                    </div>

                    <div className="mz-controls-right">
                        {/* View Mode Switcher */}
                        <div className="mz-view-mode-toggle">
                            <button
                                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                            >
                                <LayoutGrid size={16} />
                                <span>Grid</span>
                            </button>
                            <button
                                className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                                onClick={() => setViewMode('table')}
                                title="Table View"
                            >
                                <TableIcon size={16} />
                                <span>Table</span>
                            </button>
                        </div>

                        <button onClick={fetchZones} className="mz-btn-secondary" disabled={loading} title="Refresh Database Records">
                            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
                            <span>Refresh</span>
                        </button>

                        <button onClick={handleOpenCreateModal} className="mz-btn-primary">
                            <Plus size={18} />
                            <span>Add Geofence Zone</span>
                        </button>
                    </div>
                </div>

                {/* Toasts */}
                {error && (
                    <div className="mz-toast-banner mz-toast-error">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="toast-close"><X size={14} /></button>
                    </div>
                )}

                {successMsg && (
                    <div className="mz-toast-banner mz-toast-success">
                        <CheckCircle2 size={18} />
                        <span>{successMsg}</span>
                        <button onClick={() => setSuccessMsg('')} className="toast-close"><X size={14} /></button>
                    </div>
                )}

                {/* Main Content Body */}
                {loading ? (
                    <div className="mz-loading-state">
                        <div className="mz-spinner"></div>
                        <h3>Loading Geofence Records...</h3>
                        <p>Retrieving database Lat/Long boundary polygons...</p>
                    </div>
                ) : filteredZones.length === 0 ? (
                    <div className="mz-empty-state">
                        <Layers size={48} className="empty-icon" />
                        <h3>No Geofenced Zones Found</h3>
                        <p>
                            {query || riskFilter !== 'all'
                                ? 'No zones match your search query or severity filter.'
                                : 'There are no restricted geofence boundary zones saved. Add your first zone to begin monitoring.'}
                        </p>
                        {query || riskFilter !== 'all' ? (
                            <button onClick={() => { setQuery(''); setRiskFilter('all'); }} className="mz-btn-secondary mt-3">
                                Clear Filters
                            </button>
                        ) : (
                            <button onClick={handleOpenCreateModal} className="mz-btn-primary mt-3">
                                <Plus size={18} />
                                <span>Add Geofence Zone</span>
                            </button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    /* GRID VIEW */
                    <div className="mz-zones-grid">
                        {filteredZones.map((zone) => {
                            const risk = (zone.risk_level || 'high').toLowerCase();
                            const polygonCount = Array.isArray(zone.polygon) ? zone.polygon.length : 0;
                            const mapUrl = getGoogleMapUrl(zone.polygon);

                            return (
                                <div key={zone.id} className={`mz-zone-card risk-border-${risk}`}>
                                    <div className="mz-card-header">
                                        <div className="mz-card-title-group">
                                            <div className={`mz-pin-icon-box risk-bg-${risk}`}>
                                                <MapPin size={18} />
                                            </div>
                                            <div>
                                                <h3 className="mz-zone-title">{zone.name}</h3>
                                                <span className="mz-points-count-tag">
                                                    {polygonCount} Polygon {polygonCount === 1 ? 'Point' : 'Points'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`mz-risk-badge risk-${risk}`}>
                                            <span className="badge-dot"></span>
                                            {risk.toUpperCase()} RISK
                                        </span>
                                    </div>

                                    <p className="mz-zone-desc">
                                        {zone.description || 'No specific zone description provided.'}
                                    </p>

                                    {/* Coordinates Preview */}
                                    <div className="mz-coords-box">
                                        <div className="mz-coords-top-bar">
                                            <span>Boundary Coordinates</span>
                                            {mapUrl && (
                                                <a
                                                    href={mapUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mz-map-link"
                                                    title="Open location on Google Maps"
                                                >
                                                    <MapPin size={12} />
                                                    <span>Open Map</span>
                                                    <ExternalLink size={11} />
                                                </a>
                                            )}
                                        </div>
                                        <div className="mz-coords-scroll-area">
                                            <table className="mz-coords-table">
                                                <thead>
                                                    <tr>
                                                        <th>Pt</th>
                                                        <th>Latitude</th>
                                                        <th>Longitude</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Array.isArray(zone.polygon) && zone.polygon.map((pt, idx) => (
                                                        <tr key={idx}>
                                                            <td className="pt-idx">#{idx}</td>
                                                            <td className="pt-val">{pt.latitude}</td>
                                                            <td className="pt-val">{pt.longitude}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="mz-card-footer">
                                        <button onClick={() => handleOpenEditModal(zone)} className="mz-card-btn btn-edit">
                                            <Edit3 size={14} />
                                            <span>Edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(zone.id, zone.name)} className="mz-card-btn btn-delete">
                                            <Trash2 size={14} />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* TABLE VIEW */
                    <div className="mz-table-container">
                        <table className="mz-data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Zone Name</th>
                                    <th>Risk Level</th>
                                    <th>Description</th>
                                    <th>Polygon Points</th>
                                    <th>First Coordinate</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredZones.map((zone, index) => {
                                    const risk = (zone.risk_level || 'high').toLowerCase();
                                    const polygonCount = Array.isArray(zone.polygon) ? zone.polygon.length : 0;
                                    const firstPt = Array.isArray(zone.polygon) && zone.polygon[0];
                                    const mapUrl = getGoogleMapUrl(zone.polygon);

                                    return (
                                        <tr key={zone.id}>
                                            <td className="tbl-row-idx">{index + 1}</td>
                                            <td className="tbl-zone-name">
                                                <div className="tbl-name-cell">
                                                    <MapPin size={16} className={`text-risk-${risk}`} />
                                                    <span>{zone.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`mz-risk-badge risk-${risk}`}>
                                                    <span className="badge-dot"></span>
                                                    {risk.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="tbl-desc-cell">
                                                {zone.description || '—'}
                                            </td>
                                            <td>
                                                <span className="tbl-pt-badge">{polygonCount} Points</span>
                                            </td>
                                            <td>
                                                {firstPt ? (
                                                    <div className="tbl-coord-cell">
                                                        <code>{firstPt.latitude}, {firstPt.longitude}</code>
                                                        {mapUrl && (
                                                            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="tbl-map-link">
                                                                <ExternalLink size={12} />
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <div className="tbl-actions-cell">
                                                    <button onClick={() => handleOpenEditModal(zone)} className="tbl-btn btn-edit-sm" title="Edit Zone">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(zone.id, zone.name)} className="tbl-btn btn-delete-sm" title="Delete Zone">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal Overlay */}
            {isModalOpen && (
                <div className="mz-modal-overlay">
                    <div className="mz-modal-container">
                        <div className="mz-modal-header">
                            <div className="mz-modal-title-box">
                                <div className="modal-title-icon-wrapper">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <h2>{editingZoneId ? 'Edit Geofenced Zone' : 'Add New Geofenced Zone'}</h2>
                                    <p className="mz-modal-sub">Define boundary polygon coordinates & risk severity</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="mz-modal-close">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="mz-modal-form">
                            <div className="mz-form-group">
                                <label>Zone Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. KSRCT IT Park Restricted Zone"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="mz-form-input"
                                />
                            </div>

                            <div className="mz-form-row">
                                <div className="mz-form-group flex-2">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. High security monitored geofence zone"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="mz-form-input"
                                    />
                                </div>

                                <div className="mz-form-group flex-1">
                                    <label>Risk Level</label>
                                    <select
                                        value={formData.risk_level}
                                        onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
                                        className="mz-form-select"
                                    >
                                        <option value="high">High Risk</option>
                                        <option value="medium">Medium Risk</option>
                                        <option value="low">Low Risk</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mz-polygon-builder">
                                <div className="builder-header">
                                    <label className="builder-title">
                                        Polygon Coordinates (Lat/Long Boundary Points)
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={handleFillPreset} 
                                        className="btn-preset-autofill" 
                                        title="Autofill sample KSRCT IT Park coordinates"
                                    >
                                        <Sparkles size={14} />
                                        <span>Sample Preset</span>
                                    </button>
                                </div>

                                <div className="points-list-wrapper">
                                    {formData.polygon.map((pt, idx) => (
                                        <div key={idx} className="mz-point-row">
                                            <span className="point-tag">Point #{idx}</span>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Latitude (e.g. 11.368774)"
                                                value={pt.latitude}
                                                onChange={(e) => handlePointChange(idx, 'latitude', e.target.value)}
                                                required
                                                className="mz-form-input mz-coord-input"
                                            />
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Longitude (e.g. 77.818509)"
                                                value={pt.longitude}
                                                onChange={(e) => handlePointChange(idx, 'longitude', e.target.value)}
                                                required
                                                className="mz-form-input mz-coord-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePoint(idx)}
                                                className="btn-remove-pt"
                                                title="Remove Point"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button type="button" onClick={handleAddPoint} className="btn-add-polygon-pt">
                                    <Plus size={15} />
                                    <span>Add Polygon Point</span>
                                </button>
                            </div>

                            <div className="mz-modal-footer">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="mz-btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="mz-btn-primary" disabled={actionLoading}>
                                    {actionLoading ? <RefreshCw size={16} className="spin-icon" /> : <Save size={16} />}
                                    <span>{editingZoneId ? 'Save Changes' : 'Create Geofence Zone'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageZones;
