import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import axios from 'axios';
import './PanicAlerts.css';

function formatDate(value) {
  if (!value) return '-';
  try {
    // Handle Firestore Timestamp-like objects
    if (typeof value === 'object' && value) {
      if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
      }
      if (typeof value.seconds === 'number') {
        const d = new Date(value.seconds * 1000);
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
      }
      if (typeof value._seconds === 'number') {
        const d = new Date(value._seconds * 1000);
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
      }
    }

    // Numeric (seconds or milliseconds)
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))) {
      const num = Number(value);
      const ms = num > 1e12 ? num : num * 1000; // seconds vs ms
      const d = new Date(ms);
      return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
    }

    // String that may be prefixed with 'createdAt'
    if (typeof value === 'string') {
      const cleaned = value.replace(/^\s*createdAt\s*/i, '').trim();
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
      }
    }

    // Fallback attempt
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

function formatTripDetails(tripDetails) {
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
}

function formatEmergencyContacts(contacts) {
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
}

function TouristCard({ tourist, index, alert }) {
  const isActive = useMemo(() => {
    if (!tourist) return false;
    if (Object.prototype.hasOwnProperty.call(tourist, 'isActive')) return tourist.isActive;
    const returnDate = tourist.returnDate || tourist.validTill;
    if (!returnDate) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return returnDate > currentTime;
  }, [tourist]);

  if (!tourist) return null;

  return (
    <div className="tourist-card compact">
      <div className="card-header">
        <div className="card-number">{typeof index === 'number' ? `#${index + 1}` : ''}</div>
        <div className="card-id">
          <span className="id-label">DTID</span>
          <span className="id-value">{tourist.dtid}</span>
        </div>
      </div>
      <div className="card-body">
        <div className="info-section">
          {alert && (
            <div className="info-item full-width alert-block">
              <div className="info-label"><span className="info-icon">⏱️</span>Alert</div>
              <div className="info-value">
                <div><strong>Time:</strong> {formatDate(alert.createdAt)}</div>
                <div><strong>Location:</strong> {alert.latitude ?? alert?.location?.latitude ?? '-'}, {alert.longitude ?? alert?.location?.longitude ?? '-'}</div>
              </div>
            </div>
          )}
          <div className="info-item full-width">
            <div className="info-label"><span className="info-icon">👤</span>Tourist</div>
            <div className="info-value">
              <div><strong>Name:</strong> {tourist.fullName || 'N/A'}</div>
            </div>
          </div>
          <div className="info-row">
            <div className="info-item">
              <div className="info-label"><span className="info-icon">📅</span>Issued</div>
              <div className="info-value">{formatUnixSecondsToLocale(tourist.issuedAt)}</div>
            </div>
            <div className="info-item">
              <div className="info-label"><span className="info-icon">⏰</span>Return</div>
              <div className="info-value">{formatUnixSecondsToLocale(tourist.returnDate || tourist.validTill)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card-footer">
        <div className={`status-badge ${isActive ? 'verified' : 'expired'}`}>
          <span className="status-icon">{isActive ? '✓' : '⚠️'}</span>
          {isActive ? 'Active' : 'Inactive'}
        </div>
        <div className="validity-info">
          {isActive ? `Valid until ${formatUnixSecondsToLocale(tourist.returnDate || tourist.validTill)}` : 'Tourist ID is inactive'}
        </div>
      </div>
    </div>
  );
}

const MemoTouristCard = memo(TouristCard);

export default function PanicAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [touristByDtid, setTouristByDtid] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAlerts() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/panic-alerts`);
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          const sorted = list.slice().sort((a, b) => {
            const da = new Date(a.createdAt).getTime() || 0;
            const db = new Date(b.createdAt).getTime() || 0;
            return db - da;
          });
          setAlerts(sorted);
          setLastUpdated(Date.now());
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load panic alerts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAlerts();
    const id = setInterval(fetchAlerts, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Fetch tourist details for any DTIDs we don't yet have
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/panic-alerts`);
      const list = Array.isArray(data) ? data : [];
      const sorted = list.slice().sort((a, b) => {
        const da = new Date(a.createdAt).getTime() || 0;
        const db = new Date(b.createdAt).getTime() || 0;
        return db - da;
      });
      setAlerts(sorted);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e.message || 'Failed to load panic alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const dtids = alerts.map(a => a.dtid).filter(Boolean);
    const missing = dtids.filter(d => !touristByDtid[d]);
    if (missing.length === 0) return;
    let cancelled = false;

    const concurrency = 4;
    let i = 0;

    async function worker() {
      while (i < missing.length && !cancelled) {
        const dtid = missing[i++];
        try {
          const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/tourists/${dtid}`);
          if (!cancelled) {
            setTouristByDtid(prev => (prev[dtid] ? prev : { ...prev, [dtid]: data }));
          }
        } catch {
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, missing.length) }, () => worker());
    Promise.all(workers);
    return () => { cancelled = true; };
  }, [alerts, touristByDtid]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-content">
          <h2 className="section-title">
            <span className="section-icon">🚨</span>
            Panic Alerts
          </h2>
          <p className="section-subtitle">Live emergencies reported by tourists</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={refresh} disabled={loading}>Refresh</button>
          {lastUpdated && <div className="last-updated">Updated {new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastUpdated)}</div>}
        </div>
      </div>

      {loading && (
        <div className="skeleton-grid">
          {Array.from({ length: Math.max(3, Math.min(8, alerts.length || 6)) }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton header" />
              <div className="skeleton line" />
              <div className="skeleton line" />
              <div className="skeleton line short" />
              <div className="skeleton footer" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
        </div>
      )}

      {alerts.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-icon">🚨</div>
          <h3>No panic alerts</h3>
          <p>No active panic alerts found.</p>
        </div>
      ) : (
        <div className="tourists-grid">
          {alerts.map((a, index) => (
            <div key={a.id ?? `${a.dtid}-${index}`} className="tourist-card-wrapper">
              <MemoTouristCard tourist={touristByDtid[a.dtid]} index={index} alert={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
