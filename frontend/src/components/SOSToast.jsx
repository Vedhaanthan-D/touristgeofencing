import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AlertTriangle, MapPin, X, Clock } from 'lucide-react';
import './SOSToast.css';

const POLL_INTERVAL = 5000; // 5 seconds
const TOAST_DURATION = 10000; // 10 seconds

function playEmergencySound(audioCtx, isIdle = false) {
    // SOS: fast two-tone square alarm; Idle: slower descending triangle chime
    const frequencies = isIdle ? [523, 392] : [880, 660]; // C5→G4 for idle; alarm tones for SOS
    const beepDuration = isIdle ? 0.6 : 0.25;
    const volume = isIdle ? 0.1 : 0.15; // SOS reduced ~40% from original; idle softer & distinct
    let time = audioCtx.currentTime;
    const totalBeeps = Math.floor(TOAST_DURATION / 1000 / beepDuration);

    for (let i = 0; i < totalBeeps; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = isIdle ? 'triangle' : 'square';
        osc.frequency.value = frequencies[i % frequencies.length];
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + beepDuration - 0.05);
        osc.start(time);
        osc.stop(time + beepDuration);
        time += beepDuration;
    }
}

function SOSToastItem({ alert, tourist, kind, onDismiss }) {
    const isIdle = kind === 'idle';
    const name = tourist?.fullName || alert?.fullName || alert?.name || `Tourist (${alert.dtid?.slice(0, 8) ?? 'Unknown'})`;
    const lat = alert.latitude ?? alert?.location?.latitude ?? null;
    const lng = alert.longitude ?? alert?.location?.longitude ?? null;

    const openMap = (e) => {
        // Don't navigate if user clicked the close button
        if (e.target.closest('.sos-toast-close')) return;
        if (lat != null && lng != null) {
            window.open(`https://www.google.com/maps?q=${lat},${lng}&z=16`, '_blank', 'noopener');
        }
    };

    useEffect(() => {
        const timer = setTimeout(onDismiss, TOAST_DURATION);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div
            className={`sos-toast ${isIdle ? 'sos-toast--idle' : ''} ${lat != null ? 'sos-toast--clickable' : ''}`}
            role="alert"
            aria-live="assertive"
            onClick={openMap}
            title={lat != null ? 'Click to view on Google Maps' : ''}
        >
            <div className="sos-toast-header">
                <span className="sos-toast-icon">{isIdle ? '⚠️' : '🚨'}</span>
                <span className="sos-toast-title">
                    {isIdle ? 'Idle / Inactivity Alert!' : 'SOS / Panic Alert!'}
                </span>
                <button className="sos-toast-close" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="Dismiss">
                    <X size={16} />
                </button>
            </div>
            <div className="sos-toast-body">
                <div className="sos-toast-name">
                    {isIdle
                        ? <Clock size={14} className="sos-inline-icon" />
                        : <AlertTriangle size={14} className="sos-inline-icon" />}
                    <strong>{name}</strong>&nbsp;
                    {isIdle ? 'has been idle / unresponsive' : 'triggered an emergency'}
                </div>
                <div className="sos-toast-location">
                    <MapPin size={14} className="sos-inline-icon" />
                    <span>Lat: {lat != null ? (typeof lat === 'number' ? lat.toFixed(6) : lat) : 'N/A'},&nbsp;
                    Lng: {lng != null ? (typeof lng === 'number' ? lng.toFixed(6) : lng) : 'N/A'}</span>
                </div>
                {lat != null && (
                    <div className="sos-toast-map-hint">
                        <MapPin size={12} className="sos-inline-icon" /> Click to view on Google Maps
                    </div>
                )}
            </div>
            <div className="sos-toast-progress" />
        </div>
    );
}

export default function SOSToast() {
    const [toasts, setToasts] = useState([]);
    const seenSosRef = useRef(null);
    const seenIdleRef = useRef(null);
    const touristCacheRef = useRef({});
    const audioCtxRef = useRef(null);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const fetchTourist = useCallback(async (dtid) => {
        if (!dtid || touristCacheRef.current[dtid]) return;
        try {
            const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/tourists/${dtid}`);
            touristCacheRef.current[dtid] = data;
            setToasts(prev => prev.map(t => t.alert.dtid === dtid ? { ...t, tourist: data } : t));
        } catch { /* fall back to DTID display */ }
    }, []);

    const playSound = useCallback(async (isIdle = false) => {
        try {
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                await audioCtxRef.current.resume();
            }
            playEmergencySound(audioCtxRef.current, isIdle);
        } catch { /* AudioContext may be blocked */ }
    }, []);

    // Poll panic alerts (SOS)
    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            try {
                const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/panic-alerts`);
                const list = Array.isArray(data) ? data : [];
                if (seenSosRef.current === null) {
                    seenSosRef.current = new Set(list.map(a => a.id));
                    return;
                }
                const newAlerts = list.filter(a => !seenSosRef.current.has(a.id));
                if (!newAlerts.length) return;
                newAlerts.forEach(a => seenSosRef.current.add(a.id));
                if (!cancelled) {
                    await playSound(false);
                    setToasts(prev => [
                        ...prev,
                        ...newAlerts.map(a => ({ id: `sos-${a.id}`, alert: a, kind: 'sos', tourist: touristCacheRef.current[a.dtid] || null }))
                    ]);
                    newAlerts.forEach(a => a.dtid && fetchTourist(a.dtid));
                }
            } catch { /* silently ignore */ }
        };
        poll();
        const interval = setInterval(poll, POLL_INTERVAL);
        return () => { cancelled = true; clearInterval(interval); };
    }, [playSound, fetchTourist]);

    // Poll safety alerts (Idle)
    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            try {
                const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/safety-alerts`);
                const list = Array.isArray(data) ? data : [];
                if (seenIdleRef.current === null) {
                    seenIdleRef.current = new Set(list.map(a => a.id));
                    return;
                }
                const newAlerts = list.filter(a => !seenIdleRef.current.has(a.id));
                if (!newAlerts.length) return;
                newAlerts.forEach(a => seenIdleRef.current.add(a.id));
                if (!cancelled) {
                    await playSound(true);
                    setToasts(prev => [
                        ...prev,
                        ...newAlerts.map(a => ({ id: `idle-${a.id}`, alert: a, kind: 'idle', tourist: touristCacheRef.current[a.dtid] || null }))
                    ]);
                    newAlerts.forEach(a => a.dtid && fetchTourist(a.dtid));
                }
            } catch { /* silently ignore */ }
        };
        poll();
        const interval = setInterval(poll, POLL_INTERVAL);
        return () => { cancelled = true; clearInterval(interval); };
    }, [playSound, fetchTourist]);

    if (toasts.length === 0) return null;

    return createPortal(
        <div className="sos-toast-container">
            {toasts.map(t => (
                <SOSToastItem
                    key={t.id}
                    alert={t.alert}
                    tourist={t.tourist}
                    kind={t.kind}
                    onDismiss={() => dismiss(t.id)}
                />
            ))}
        </div>,
        document.body
    );
}
