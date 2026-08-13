import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Siren, UserSearch, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

/** Renders top navigation bar with routing links and user authentication status. */
function Navigation() {
    const location = useLocation();
    const { user, role, roleLabel, logout } = useAuth();

    const ALL_NAV_ITEMS = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'police', 'forest'] },
        { path: '/', label: 'Tourist List', icon: Users, roles: ['admin', 'police', 'forest'] },
        { path: '/register', label: 'Register', icon: UserPlus, roles: ['admin', 'immigration'] },
        { path: '/panic-alerts', label: 'Panic Alerts', icon: Siren, isAlert: true, roles: ['admin', 'police', 'forest'] },
        { path: '/missing-complaints', label: 'Missing', icon: UserSearch, roles: ['admin', 'police', 'forest'] },
    ];

    const navItems = ALL_NAV_ITEMS.filter(item => !role || item.roles.includes(role));
    const brandHomePath = role === 'immigration' ? '/register' : '/dashboard';

    return (
        <nav className="navigation">
            <div className="nav-container">
                <Link to={brandHomePath} className="nav-brand">
                    <div className="brand-icon-wrapper">
                        <img
                            src="Logo.png"
                            alt="Digital Tourist Registry Logo"
                            className="brand-logo-img"
                        />
                    </div>
                    <div className="brand-content">
                        <span className="brand-text">Digital Tourist Registry</span>
                        <span className="brand-tagline">Safe Travel Management</span>
                    </div>
                </Link>

                <div className="nav-links">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-link ${isActive ? 'active' : ''} ${item.isAlert ? 'nav-link-alert' : ''}`}
                            >
                                <div className="nav-icon-box">
                                    <Icon size={20} className="link-icon" />
                                    {item.isAlert && <span className="alert-ping-dot"></span>}
                                </div>
                                <span className="nav-label-text">{item.label}</span>
                            </Link>
                        );
                    })}

                    {user ? (
                        <div className="nav-user-badge-wrapper">
                            <div className="nav-user-info">
                                <span className="nav-user-email">{user.email}</span>
                                {roleLabel && (
                                    <span className={`nav-role-pill role-${role || 'default'}`}>
                                        {roleLabel}
                                    </span>
                                )}
                            </div>
                            <button onClick={logout} className="nav-link nav-logout-btn" title={`Signed in as ${user.email}`}>
                                <div className="nav-icon-box">
                                    <LogOut size={20} className="link-icon" />
                                </div>
                                <span className="nav-label-text">Logout</span>
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}>
                            <div className="nav-icon-box">
                                <LogIn size={20} className="link-icon" />
                            </div>
                            <span className="nav-label-text">Login</span>
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navigation;