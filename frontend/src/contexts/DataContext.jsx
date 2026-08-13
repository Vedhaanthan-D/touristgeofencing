import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '../config/api';
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

    // Fetch all tourists and build a lookup map by DTID
    const fetchTourists = useCallback(async () => {
        try {
            setLoadingTourists(true);
            const response = await apiClient.get('/api/tourists');
            const list = Array.isArray(response.data) ? response.data : [];
            setTourists(list);

            // Create quick lookup map by DTID
            const map = {};
            list.forEach(t => {
                if (t.dtid) map[t.dtid] = t;
            });
            setTouristsMap(prev => ({ ...map, ...prev }));
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
            const response = await apiClient.get('/api/panic-alerts');
            const list = Array.isArray(response.data) ? response.data : [];
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
            const response = await apiClient.get('/api/safety-alerts');
            const list = Array.isArray(response.data) ? response.data : [];
            setSafetyAlerts(list);
        } catch (err) {
            console.error('Error fetching safety alerts:', err);
        } finally {
            setLoadingSafety(false);
        }
    }, []);

    // Fetch single tourist by DTID if missing from map
    const fetchTouristByDtid = useCallback(async (dtid) => {
        if (!dtid || touristsMap[dtid]) return touristsMap[dtid];
        try {
            const response = await apiClient.get(`/api/tourists/${dtid}`);
            if (response.data) {
                setTouristsMap(prev => ({ ...prev, [dtid]: response.data }));
                return response.data;
            }
        } catch (err) {
            console.error(`Error fetching tourist ${dtid}:`, err);
        }
        return null;
    }, [touristsMap]);

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

    // Load data when user is authenticated with a monitoring role
    useEffect(() => {
        if (!user || !['admin', 'police', 'forest'].includes(role)) return;

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
        triggerRefresh,
        notifyNewRegistration
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};