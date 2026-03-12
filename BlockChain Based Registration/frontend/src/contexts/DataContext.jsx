import React, { createContext, useContext, useState, useCallback } from 'react';

const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export const DataProvider = ({ children }) => {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isNewRegistration, setIsNewRegistration] = useState(false);

    // Function to trigger refresh across all components
    const triggerRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Function to notify about new registration
    const notifyNewRegistration = useCallback(() => {
        setIsNewRegistration(true);
        triggerRefresh();
        
        // Reset the flag after a short delay
        setTimeout(() => {
            setIsNewRegistration(false);
        }, 5000);
    }, [triggerRefresh]);

    const value = {
        refreshTrigger,
        isNewRegistration,
        triggerRefresh,
        notifyNewRegistration
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};