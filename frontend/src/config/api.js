import axios from 'axios';
import { auth } from './firebase';

/** Resolves the backend API base URL based on environment configuration or window location. */
export const getApiBaseUrl = () => {
    const configuredUrl = import.meta.env.VITE_API_URL;
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (isProduction) {
        if (configuredUrl && configuredUrl.trim() && !configuredUrl.includes('localhost') && !configuredUrl.includes('127.0.0.1')) {
            return configuredUrl.trim().replace(/\/+$/, '');
        }
        // Fall back to live Render hosted backend in production
        return 'https://touristgeofencing-s787.onrender.com';
    }

    if (configuredUrl && configuredUrl.trim()) {
        return configuredUrl.trim().replace(/\/+$/, '');
    }
    return 'http://localhost:5000';
};

/** Central API base URL string for cross-environment communication. */
export const API_BASE_URL = getApiBaseUrl();

/** Centralized Axios client instance configured with base URL and default headers. */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(async (config) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        try {
            const token = await currentUser.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error('Failed to attach ID token to request:', error);
        }
    }
    return config;
}, (error) => Promise.reject(error));

export default apiClient;
