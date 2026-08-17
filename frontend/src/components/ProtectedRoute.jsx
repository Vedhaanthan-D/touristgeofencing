import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Protects routes requiring authentication and optional role authorization. */
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, role, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="session-loading-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, background: '#0F172A', zIndex: 9999, color: '#94a3b8' }}>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem auto', width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#06B6D4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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

