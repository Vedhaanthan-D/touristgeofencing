import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Siren, UserSearch, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

/** Renders top navigation bar with routing links and user authentication status. */
function Navigation() {
    const location = useLocation();
    const { user, logout } = useAuth();

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/', label: 'Tourist List', icon: Users },
        { path: '/register', label: 'Register', icon: UserPlus },
        { path: '/panic-alerts', label: 'Panic Alerts', icon: Siren, isAlert: true },
        { path: '/missing-complaints', label: 'Missing', icon: UserSearch },
    ];

    return (
        <nav className="navigation">
            <div className="nav-container">
                <Link to="/" className="nav-brand">
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
                        <button onClick={logout} className="nav-link nav-logout-btn" title={`Logged in as ${user.email}`}>
                            <div className="nav-icon-box">
                                <LogOut size={20} className="link-icon" />
                            </div>
                            <span className="nav-label-text">Logout</span>
                        </button>
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