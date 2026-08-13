import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import TouristList from './components/TouristList';
import Registration from './components/Registration';
import Dashboard from './components/Dashboard';
import PanicAlerts from './components/PanicAlerts';
import MissingComplaints from './components/MissingComplaints';
import Login from './components/Login';
import PendingRole from './components/PendingRole';
import Unauthorized from './components/Unauthorized';
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
                            <Route path="/pending-role" element={<PendingRole />} />
                            <Route path="/unauthorized" element={<Unauthorized />} />
                            <Route path="/register" element={<ProtectedRoute allowedRoles={['admin', 'immigration']}><Registration /></ProtectedRoute>} />
                            <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'police', 'forest']}><TouristList /></ProtectedRoute>} />
                            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'police', 'forest']}><Dashboard /></ProtectedRoute>} />
                            <Route path="/panic-alerts" element={<ProtectedRoute allowedRoles={['admin', 'police', 'forest']}><PanicAlerts /></ProtectedRoute>} />
                            <Route path="/missing-complaints" element={<ProtectedRoute allowedRoles={['admin', 'police', 'forest']}><MissingComplaints /></ProtectedRoute>} />
                        </Routes>
                    </div>
                </Router>
            </DataProvider>
        </AuthProvider>
    );
}

export default App;
