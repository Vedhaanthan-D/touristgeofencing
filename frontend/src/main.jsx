import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// StrictMode removed to prevent double API calls in development
// This reduces Firebase reads by 50% during development
ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
);
