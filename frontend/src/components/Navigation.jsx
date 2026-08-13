import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Siren, UserSearch, LogOut, LogIn, User, ChevronDown, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

/** Renders top navigation bar with routing links and user authentication status. */
function Navigation() {
    const location = useLocation();
    const { user, role, logout } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setDropdownOpen(false);
    }, [location.pathname]);

    const ALL_NAV_ITEMS = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'police', 'forest'] },
        { path: '/', label: 'Tourist List', icon: Users, roles: ['admin', 'police', 'forest'] },
        { path: '/register', label: 'Register', icon: UserPlus, roles: ['admin', 'immigration'] },
        { path: '/manage-zones', label: 'Manage Zones', icon: MapPin, roles: ['admin'] },
        { path: '/panic-alerts', label: 'Panic Alerts', icon: Siren, isAlert: true, roles: ['admin', 'police', 'forest'] },
        { path: '/missing-complaints', label: 'Missing', icon: UserSearch, roles: ['admin', 'police', 'forest'] },
    ];

    const navItems = ALL_NAV_ITEMS.filter(item => !role || item.roles.includes(role));
    const brandHomePath = role === 'immigration' ? '/register' : '/dashboard';

    const getShortRole = (roleKey) => {
        if (!roleKey) return 'Guest';
        const roleMap = {
            admin: 'Admin',
            police: 'Police',
            forest: 'Forest',
            immigration: 'Immigration'
        };
        return roleMap[roleKey.toLowerCase()] || roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
    };

    return (
        <nav className="navigation">
            <div className="nav-container">
                {/* Brand Section on Far Left */}
                <Link to={brandHomePath} className="nav-brand">
                    <span className="brand-text">Praesidia</span>
                </Link>

                {/* Nav Links centered in middle */}
                <div className="nav-center-links nav-links">
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
                                    <Icon size={16} className="link-icon" />
                                    {item.isAlert && <span className="alert-ping-dot"></span>}
                                </div>
                                <span className="nav-label-text">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Profile section on Far Right */}
                <div className="nav-right-section">
                    {user ? (
                        <div className="nav-profile-wrapper" ref={dropdownRef}>
                            <button
                                className="nav-profile-trigger"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                title={`Logged in as ${user.email}`}
                            >
                                <div className="nav-profile-icon-wrapper">
                                    <User size={16} className="nav-profile-icon" />
                                </div>
                                <span className={`nav-profile-role role-${role || 'default'}`}>
                                    {getShortRole(role)}
                                </span>
                                <ChevronDown size={14} className={`dropdown-chevron ${dropdownOpen ? 'open' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="nav-profile-dropdown">
                                    <div className="dropdown-header">
                                        <span className="dropdown-email">{user.email}</span>
                                        <span className="dropdown-role-label">{getShortRole(role)}</span>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <button onClick={logout} className="dropdown-item logout-item">
                                        <LogOut size={14} className="dropdown-icon" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link to="/login" className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}>
                            <div className="nav-icon-box">
                                <LogIn size={16} className="link-icon" />
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