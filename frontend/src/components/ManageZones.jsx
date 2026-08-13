import { useState, useEffect } from 'react';
import { 
    MapPin, Plus, Trash2, Edit3, Save, X, AlertTriangle, 
    CheckCircle2, RefreshCw, Layers, ShieldAlert, Sparkles 
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import './ManageZones.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function ManageZones() {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

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

    return (
        <div className="manage-zones-page">
            <header className="page-header">
                <div className="header-title-block">
                    <div className="header-icon-box">
                        <ShieldAlert size={26} className="header-icon" />
                    </div>
                    <div>
                        <h1 className="page-title">Geofenced Restricted Zones</h1>
                        <p className="page-subtitle">Admin Control Panel for Managing Database Geofence Lat/Long Boundaries</p>
                    </div>
                </div>

                <div className="header-actions">
                    <button onClick={fetchZones} className="btn-secondary" title="Refresh List" disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
                        <span>Refresh</span>
                    </button>
                    <button onClick={handleOpenCreateModal} className="btn-primary">
                        <Plus size={18} />
                        <span>Add New Geofence Zone</span>
                    </button>
                </div>
            </header>

            {error && (
                <div className="toast-banner toast-error">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="toast-close"><X size={14} /></button>
                </div>
            )}

            {successMsg && (
                <div className="toast-banner toast-success">
                    <CheckCircle2 size={18} />
                    <span>{successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} className="toast-close"><X size={14} /></button>
                </div>
            )}

            {loading ? (
                <div className="zones-loading-state">
                    <RefreshCw size={32} className="spin-icon text-accent" />
                    <p>Loading database geofence records...</p>
                </div>
            ) : zones.length === 0 ? (
                <div className="empty-zones-card">
                    <Layers size={48} className="empty-icon" />
                    <h3>No Geofenced Zones Found</h3>
                    <p>There are no restricted geofence zone records in the database. Click below to add your first zone.</p>
                    <button onClick={handleOpenCreateModal} className="btn-primary mt-4">
                        <Plus size={18} />
                        <span>Add Geofence Zone</span>
                    </button>
                </div>
            ) : (
                <div className="zones-grid">
                    {zones.map((zone) => (
                        <div key={zone.id} className="zone-card">
                            <div className="zone-card-header">
                                <div className="zone-name-container">
                                    <MapPin size={18} className="zone-pin-icon" />
                                    <h3 className="zone-name">{zone.name}</h3>
                                </div>
                                <span className={`risk-badge risk-${zone.risk_level || 'high'}`}>
                                    {zone.risk_level || 'high'} Risk
                                </span>
                            </div>

                            <p className="zone-description">{zone.description || 'No description provided.'}</p>

                            <div className="zone-coords-section">
                                <div className="coords-header">
                                    <span>Polygon Coordinates ({Array.isArray(zone.polygon) ? zone.polygon.length : 0} points)</span>
                                </div>
                                <div className="coords-table-wrapper">
                                    <table className="coords-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Latitude</th>
                                                <th>Longitude</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.isArray(zone.polygon) && zone.polygon.map((pt, idx) => (
                                                <tr key={idx}>
                                                    <td className="point-idx">{idx}</td>
                                                    <td className="coord-val">{pt.latitude}</td>
                                                    <td className="coord-val">{pt.longitude}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="zone-card-footer">
                                <button onClick={() => handleOpenEditModal(zone)} className="btn-card-action btn-edit">
                                    <Edit3 size={15} />
                                    <span>Edit</span>
                                </button>
                                <button onClick={() => handleDelete(zone.id, zone.name)} className="btn-card-action btn-delete">
                                    <Trash2 size={15} />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <div className="modal-title-box">
                                <MapPin size={20} className="modal-title-icon" />
                                <h2>{editingZoneId ? 'Edit Geofenced Zone' : 'Add New Geofenced Zone'}</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="btn-icon-close">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Zone Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. KSRCT IT park"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Sensitive Restricted Area"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group flex-1">
                                    <label>Risk Level</label>
                                    <select
                                        value={formData.risk_level}
                                        onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
                                        className="form-select"
                                    >
                                        <option value="high">High Risk</option>
                                        <option value="medium">Medium Risk</option>
                                        <option value="low">Low Risk</option>
                                    </select>
                                </div>
                            </div>

                            <div className="polygon-builder-section">
                                <div className="builder-header">
                                    <label className="builder-title">Geofence Polygon Points (Lat/Long)</label>
                                    <button 
                                        type="button" 
                                        onClick={handleFillPreset} 
                                        className="btn-preset" 
                                        title="Autofill sample KSRCT IT Park coordinates"
                                    >
                                        <Sparkles size={14} />
                                        <span>Sample Preset</span>
                                    </button>
                                </div>

                                <div className="points-list">
                                    {formData.polygon.map((pt, idx) => (
                                        <div key={idx} className="point-row">
                                            <span className="point-badge">Point {idx}</span>
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Latitude (e.g. 11.368774)"
                                                value={pt.latitude}
                                                onChange={(e) => handlePointChange(idx, 'latitude', e.target.value)}
                                                required
                                                className="form-input input-coord"
                                            />
                                            <input
                                                type="number"
                                                step="any"
                                                placeholder="Longitude (e.g. 77.818509)"
                                                value={pt.longitude}
                                                onChange={(e) => handlePointChange(idx, 'longitude', e.target.value)}
                                                required
                                                className="form-input input-coord"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePoint(idx)}
                                                className="btn-point-remove"
                                                title="Remove Point"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button type="button" onClick={handleAddPoint} className="btn-add-point">
                                    <Plus size={15} />
                                    <span>Add Polygon Point</span>
                                </button>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={actionLoading}>
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
