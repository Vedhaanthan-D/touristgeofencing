import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import TouristList from './components/TouristList';
import Registration from './components/Registration';
import Dashboard from './components/Dashboard';
import PanicAlerts from './components/PanicAlerts';
import MissingComplaints from './components/MissingComplaints';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import SOSToast from './components/SOSToast';
import './App.css';

/** Main application component defining provider hierarchy and protected route structure. */
function App() {
    return (
        <AuthProvider>
            <DataProvider>
                <Router>
                    <div className="app-container">
                        <Navigation />
                        <SOSToast />

                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Registration />} />
                            <Route path="/" element={<ProtectedRoute><TouristList /></ProtectedRoute>} />
                            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                            <Route path="/panic-alerts" element={<ProtectedRoute><PanicAlerts /></ProtectedRoute>} />
                            <Route path="/missing-complaints" element={<ProtectedRoute><MissingComplaints /></ProtectedRoute>} />
                        </Routes>
                    </div>
                </Router>
            </DataProvider>
        </AuthProvider>
    );
}

export default App;
