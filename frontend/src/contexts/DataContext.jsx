import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { apiClient } from '../config/api';
import { db as firestoreDb } from '../config/firebase';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider = ({ children }) => {
    const { user, role } = useAuth();
    const [tourists, setTourists] = useState([]);
    const [panicAlerts, setPanicAlerts] = useState([]);
    const [safetyAlerts, setSafetyAlerts] = useState([]);
    const [touristsMap, setTouristsMap] = useState({});
    
    const [loadingTourists, setLoadingTourists] = useState(false);
    const [loadingPanic, setLoadingPanic] = useState(false);
    const [loadingSafety, setLoadingSafety] = useState(false);
    
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isNewRegistration, setIsNewRegistration] = useState(false);

    // Fetch all tourists and build a lookup map by DTID (with Firestore direct fallback)
    const fetchTourists = useCallback(async () => {
        try {
            setLoadingTourists(true);
            let list = [];
            try {
                const response = await apiClient.get('/api/tourists');
                list = Array.isArray(response.data) ? response.data : [];
            } catch (apiErr) {
                console.warn('[DataContext] Backend API unavailable, querying Firestore directly:', apiErr?.message);
                const querySnapshot = await getDocs(collection(firestoreDb, 'tourists'));
                const currentTime = Math.floor(Date.now() / 1000);
                list = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    const isActive = data.isActive !== false && (!data.returnDate || currentTime <= data.returnDate);
                    return { dtid: doc.id, ...data, isActive };
                });
            }
            setTourists(list);

            // Create quick lookup map by DTID
            const map = {};
            list.forEach(t => {
                if (t.dtid) map[t.dtid] = t;
            });
            setTouristsMap(prev => ({ ...prev, ...map }));
        } catch (err) {
            console.error('Error fetching global tourists:', err);
        } finally {
            setLoadingTourists(false);
        }
    }, []);

    // Fetch panic alerts
    const fetchPanicAlerts = useCallback(async () => {
        try {
            setLoadingPanic(true);
            let list = [];
            try {
                const response = await apiClient.get('/api/panic-alerts');
                list = Array.isArray(response.data) ? response.data : [];
            } catch (apiErr) {
                console.warn('[DataContext] Backend panic-alerts API unavailable, querying Firestore directly:', apiErr?.message);
                const querySnapshot = await getDocs(collection(firestoreDb, 'panic_alert_emergencies'));
                list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            setPanicAlerts(list);
        } catch (err) {
            console.error('Error fetching panic alerts:', err);
        } finally {
            setLoadingPanic(false);
        }
    }, []);

    // Fetch safety alerts
    const fetchSafetyAlerts = useCallback(async () => {
        try {
            setLoadingSafety(true);
            let list = [];
            try {
                const response = await apiClient.get('/api/safety-alerts');
                list = Array.isArray(response.data) ? response.data : [];
            } catch (apiErr) {
                console.warn('[DataContext] Backend safety-alerts API unavailable, querying Firestore directly:', apiErr?.message);
                const querySnapshot = await getDocs(collection(firestoreDb, 'safety_alerts'));
                list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            setSafetyAlerts(list);
        } catch (err) {
            console.error('Error fetching safety alerts:', err);
        } finally {
            setLoadingSafety(false);
        }
    }, []);

    // Fetch single tourist by DTID (with optional forceRefresh to bypass cache)
    const fetchTouristByDtid = useCallback(async (dtid, forceRefresh = false) => {
        if (!dtid) return null;
        if (!forceRefresh && touristsMap[dtid] && (touristsMap[dtid].gpsStatus || touristsMap[dtid].lastKnownLocation)) {
            return touristsMap[dtid];
        }
        try {
            const response = await apiClient.get(`/api/tourists/${dtid}`);
            if (response.data) {
                const normDtid = String(dtid).trim();
                setTouristsMap(prev => ({ ...prev, [dtid]: response.data, [normDtid]: response.data }));
                setTourists(prev => prev.map(t => (t.dtid && String(t.dtid).toLowerCase().trim() === normDtid.toLowerCase()) ? { ...t, ...response.data } : t));
                return response.data;
            }
        } catch (err) {
            console.error(`Error fetching tourist ${dtid}:`, err);
        }
        return touristsMap[dtid] || null;
    }, [touristsMap]);

    // Confirm an idle safety alert as a MISSING case and auto-file a persistent E-FIR record.
    // Officer-initiated manual review action; updates the alert in place with status/firNo on success.
    const reportMissingAndFileEfir = useCallback(async (alertId) => {
        if (!alertId) return null;
        const response = await apiClient.post(`/api/safety-alerts/${alertId}/report-missing`);
        const data = response?.data;
        if (data?.alert) {
            setSafetyAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, ...data.alert } : a)));
        }
        return data;
    }, []);

    // Trigger refresh across all components
    const triggerRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
        fetchTourists();
        fetchPanicAlerts();
        fetchSafetyAlerts();
    }, [fetchTourists, fetchPanicAlerts, fetchSafetyAlerts]);

    const notifyNewRegistration = useCallback(() => {
        setIsNewRegistration(true);
        triggerRefresh();
        setTimeout(() => {
            setIsNewRegistration(false);
        }, 5000);
    }, [triggerRefresh]);

    // Load data when user is authenticated
    useEffect(() => {
        if (!user) return;

        fetchTourists();
        fetchPanicAlerts();
        fetchSafetyAlerts();
    }, [user, role, fetchTourists, fetchPanicAlerts, fetchSafetyAlerts]);

    const value = {
        tourists,
        panicAlerts,
        safetyAlerts,
        touristsMap,
        loadingTourists,
        loadingPanic,
        loadingSafety,
        refreshTrigger,
        isNewRegistration,
        fetchTourists,
        fetchPanicAlerts,
        fetchSafetyAlerts,
        fetchTouristByDtid,
        reportMissingAndFileEfir,
        triggerRefresh,
        notifyNewRegistration
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};