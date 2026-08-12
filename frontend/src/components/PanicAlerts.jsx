import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import axios from 'axios';
import {
  Timer, CalendarDays, Clock4, User, RefreshCw,
  ShieldAlert, AlertOctagon, MapPin, Phone, Search, Copy, Check, ExternalLink, X
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import './PanicAlerts.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function formatDate(value) {
  if (!value) return '-';
  try {
    if (typeof value === 'object' && value) {
      if (typeof value.toDate === 'function') {
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(value.toDate());
      }
      if (typeof value.seconds === 'number') {
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value.seconds * 1000));
      }
      if (typeof value._seconds === 'number') {
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value._seconds * 1000));
      }
    }
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))) {
      const num = Number(value);
      const ms = num > 1e12 ? num : num * 1000;
      return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(ms));
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/^\s*createdAt\s*/i, '').trim();
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
      }
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
    }
    return '-';
  } catch {
    return '-';
  }
}

function formatUnixSecondsToLocale(seconds) {
  if (!seconds) return 'N/A';
  const date = new Date(seconds * 1000);
  return date.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function TouristCard({ tourist, index, alert }) {
  const [copied, setCopied] = useState(false);

  const displayTourist = tourist || {
    dtid: alert?.dtid || 'N/A',
    fullName: alert?.email ? alert.email.split('@')[0] : 'Registered Tourist',
    email: alert?.email || 'N/A',
    mobileNumber: 'N/A',
    isActive: true
  };

  const isActive = useMemo(() => {
    if (Object.prototype.hasOwnProperty.call(displayTourist, 'isActive')) return displayTourist.isActive;
    const returnDate = displayTourist.returnDate || displayTourist.validTill;
    if (!returnDate) return true;
    const currentTime = Math.floor(Date.now() / 1000);
    return returnDate > currentTime;
  }, [displayTourist]);

  const lat = alert?.latitude ?? alert?.location?.latitude;
  const lng = alert?.longitude ?? alert?.location?.longitude;
  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  const handleCopyDtid = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(displayTourist.dtid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`pa-emergency-card fade-in ${isActive ? 'is-active-sos' : 'is-resolved-sos'}`}>
      {/* Header Row 1: SOS Badge + Tourist Name */}
      <div className="pa-card-head">
        <div className="pa-head-left">
          <span className="pa-sos-badge">
            <AlertOctagon size={14} className="sos-pulse-icon" /> SOS Emergency #{index + 1}
          </span>
          <h3 className="pa-tourist-name">{displayTourist.fullName || 'Registered Tourist'}</h3>
        </div>
      </div>

      {/* Header Row 2: Dedicated DTID Strip */}
      <div className="pa-dtid-dedicated-strip" onClick={handleCopyDtid} title="Click to copy DTID">
        <span className="dtid-badge">DTID</span>
        <code className="dtid-code-text">{displayTourist.dtid}</code>
        <button className="btn-copy-dtid-action" aria-label="Copy DTID">
          {copied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Incident Box */}
      <div className="pa-incident-box">
        <div className="incident-title-row">
          <span className="inc-lbl"><Timer size={14} /> Panic Incident Signal</span>
          <span className="inc-time">{formatDate(alert?.createdAt)}</span>
        </div>

        <div className="incident-grid-details">
          <div className="inc-detail-item">
            <span className="inc-sub-label">GPS Coordinates</span>
            <span className="inc-sub-val mono">
              {lat ?? '—'}, {lng ?? '—'}
            </span>
          </div>

          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-open-map">
              <MapPin size={13} /> Open Map <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {/* Info Rows */}
      <div className="pa-card-info-rows">
        <div className="pa-row-item">
          <span className="lbl"><User size={13} /> Mobile</span>
          <span className="val">{displayTourist.mobileNumber || 'N/A'}</span>
        </div>
        <div className="pa-row-item">
          <span className="lbl"><CalendarDays size={13} /> Check-in</span>
          <span className="val">{displayTourist.tripDetails?.startDate || formatUnixSecondsToLocale(displayTourist.issuedAt)}</span>
        </div>
        <div className="pa-row-item">
          <span className="lbl"><Clock4 size={13} /> Check-out</span>
          <span className="val">{formatUnixSecondsToLocale(displayTourist.returnDate || displayTourist.validTill)}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pa-card-action-footer">
        <span className={`pa-status-indicator ${isActive ? 'active-sos' : 'resolved-sos'}`}>
          <span className="status-dot"></span>
          {isActive ? 'Active Emergency Track' : 'Signal Cleared'}
        </span>

        {displayTourist.mobileNumber && displayTourist.mobileNumber !== 'N/A' && (
          <a href={`tel:${displayTourist.mobileNumber}`} className="btn-call-emergency">
            <Phone size={13} /> Call Mobile
          </a>
        )}
      </div>
    </div>
  );
}

const MemoTouristCard = memo(TouristCard);

export default function PanicAlerts() {
  const { touristsMap: globalTouristsMap, panicAlerts: globalPanicAlerts } = useData();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [touristByDtid, setTouristByDtid] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/panic-alerts`);
      const list = Array.isArray(data) ? data : [];
      const sorted = list.slice().sort((a, b) => {
        const da = new Date(a.createdAt).getTime() || 0;
        const db = new Date(b.createdAt).getTime() || 0;
        return db - da;
      });
      setAlerts(sorted);
      setLastUpdated(Date.now());
    } catch (e) {
      console.error('Panic alerts fetch error:', e);
      if (globalPanicAlerts && globalPanicAlerts.length > 0) {
        setAlerts(globalPanicAlerts);
      } else {
        setError(e.message || 'Failed to load panic alerts');
      }
    } finally {
      setLoading(false);
    }
  }, [globalPanicAlerts]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 300000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    if (alerts.length === 0) return;
    const dtids = alerts.map(a => a.dtid).filter(Boolean);

    let needsUpdate = false;
    const missingDtids = [];

    dtids.forEach(dtid => {
      if (globalTouristsMap[dtid] && !touristByDtid[dtid]) {
        needsUpdate = true;
      } else if (!touristByDtid[dtid] && !globalTouristsMap[dtid]) {
        missingDtids.push(dtid);
      }
    });

    if (needsUpdate) {
      setTouristByDtid(prev => ({ ...globalTouristsMap, ...prev }));
    }

    if (missingDtids.length === 0) return;

    let cancelled = false;
    async function loadMissing() {
      for (const dtid of missingDtids) {
        if (cancelled) break;
        try {
          const { data } = await axios.get(`${API_BASE_URL}/api/tourists/${dtid}`);
          if (!cancelled && data) {
            setTouristByDtid(prev => ({ ...prev, [dtid]: data }));
          }
        } catch (err) {}
      }
    }

    loadMissing();
    return () => { cancelled = true; };
  }, [alerts, globalTouristsMap]);

  const stats = useMemo(() => {
    let active = 0;
    alerts.forEach(a => {
      const tourist = touristByDtid[a.dtid] || globalTouristsMap[a.dtid];
      if (!tourist || tourist.isActive !== false) active++;
    });
    return { total: alerts.length, active, resolved: alerts.length - active };
  }, [alerts, touristByDtid, globalTouristsMap]);

  const filteredAlerts = useMemo(() => {
    let list = alerts;

    if (filterMode === 'active') {
      list = list.filter(a => {
        const tourist = touristByDtid[a.dtid] || globalTouristsMap[a.dtid];
        return !tourist || tourist.isActive !== false;
      });
    } else if (filterMode === 'resolved') {
      list = list.filter(a => {
        const tourist = touristByDtid[a.dtid] || globalTouristsMap[a.dtid];
        return tourist && tourist.isActive === false;
      });
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(a => {
        const tourist = touristByDtid[a.dtid] || globalTouristsMap[a.dtid];
        const name = String(tourist?.fullName || '').toLowerCase();
        const dtid = String(a.dtid || '').toLowerCase();
        const email = String(a.email || '').toLowerCase();
        return dtid.includes(q) || name.includes(q) || email.includes(q);
      });
    }

    return list;
  }, [alerts, filterMode, query, touristByDtid, globalTouristsMap]);

  return (
    <div className="pa-dashboard-wrapper fade-in">
      {/* Hero Header */}
      <div className="pa-hero-header">
        <div className="pa-hero-container">
          <div className="pa-hero-title-group">
            <span className="pa-hazard-pill">
              <AlertOctagon size={14} className="sos-pulse" /> Emergency Response Center
            </span>
            <h1 className="pa-hero-title">Live Panic & SOS Alerts</h1>
            <p className="pa-hero-subtitle">
              Instant distress signals broadcast by registered tourists in real time via mobile apps.
            </p>
          </div>

          <div className="pa-hero-stats">
            <div className="pa-stat-box sos-box" onClick={() => setFilterMode('active')}>
              <span className="num">{stats.active}</span>
              <span className="lbl">Active SOS Alerts</span>
            </div>
            <div className="pa-stat-box total-box" onClick={() => setFilterMode('all')}>
              <span className="num">{stats.total}</span>
              <span className="lbl">Total Reported</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="pa-main-body">
        {/* Controls Bar */}
        <div className="pa-controls-bar">
          <div className="pa-search-field">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Panic Alerts by DTID, Name, or Email..."
              className="pa-input-element"
            />
            {query && (
              <button onClick={() => setQuery('')} className="btn-clear">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="pa-filter-buttons">
            <button
              className={`filter-tab ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Signals ({stats.total})
            </button>
            <button
              className={`filter-tab ${filterMode === 'active' ? 'active' : ''}`}
              onClick={() => setFilterMode('active')}
            >
              <span className="red-dot"></span> Active SOS ({stats.active})
            </button>
            <button
              className={`filter-tab ${filterMode === 'resolved' ? 'active' : ''}`}
              onClick={() => setFilterMode('resolved')}
            >
              <span className="grey-dot"></span> Cleared ({stats.resolved})
            </button>
          </div>

          <div className="pa-right-meta">
            <button className="pa-btn-refresh" onClick={fetchAlerts} disabled={loading}>
              <RefreshCw size={15} />
              <span>Refresh Alerts</span>
            </button>
            {lastUpdated && (
              <span className="pa-updated-time">
                Updated {new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(lastUpdated)}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && alerts.length === 0 && (
          <div className="pa-skeleton-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pa-skeleton-card">
                <div className="pa-skel-head" />
                <div className="pa-skel-line" />
                <div className="pa-skel-line short" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && alerts.length === 0 && (
          <div className="pa-error-banner">
            <AlertOctagon size={24} />
            <p>{error}</p>
          </div>
        )}

        {/* Empty State */}
        {filteredAlerts.length === 0 && !loading ? (
          <div className="pa-empty-card">
            <ShieldAlert size={56} className="empty-svg" />
            <h3>No Panic Signals Found</h3>
            <p>No active distress panic alerts recorded matching your query.</p>
          </div>
        ) : (
          <div className="pa-cards-grid">
            {filteredAlerts.map((a, index) => (
              <MemoTouristCard
                key={a.id ?? `${a.dtid}-${index}`}
                tourist={touristByDtid[a.dtid] || globalTouristsMap[a.dtid]}
                index={index}
                alert={a}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
