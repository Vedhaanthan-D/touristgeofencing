import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Protects routes requiring authentication and optional role authorization. */
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, role, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="session-loading-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#94a3b8' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem auto', width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#06B6D4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Verifying officer permissions...</span>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!role) {
        return <Navigate to="/pending-role" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
        if (role === 'immigration') {
            return <Navigate to="/register" replace />;
        }
        if (role === 'police' || role === 'forest') {
            return <Navigate to="/dashboard" replace />;
        }
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
}

