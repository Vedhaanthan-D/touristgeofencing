import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Siren, UserSearch } from 'lucide-react';
import './Navigation.css';

function Navigation() {
    const location = useLocation();

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/', label: 'Tourist List', icon: Users },
        { path: '/register', label: 'Register', icon: UserPlus },
        { path: '/panic-alerts', label: 'Panic Alerts', icon: Siren },
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
                    {navItems.map(({ path, label, icon: Icon }) => (
                        <Link
                            key={path}
                            to={path}
                            className={`nav-link ${location.pathname === path ? 'active' : ''}`}
                        >
                            <Icon size={18} className="link-icon" />
                            <span>{label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}

export default Navigation;