import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, AlertCircle, SearchX, Shield } from 'lucide-react';
import './Navigation.css';

function Navigation() {
    const location = useLocation();

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/', label: 'Tourist List', icon: Users },
        { path: '/register', label: 'Register', icon: UserPlus },
        { path: '/panic-alerts', label: 'Panic Alerts', icon: AlertCircle },
        { path: '/missing-complaints', label: 'Missing', icon: SearchX },
    ];

    return (
        <nav className="navigation">
            <div className="nav-container">
                <Link to="/" className="nav-brand">
                    <div className="brand-icon-wrapper">
                        <Shield className="brand-icon" size={28} />
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
                            <Icon size={20} className="link-icon" />
                            <span>{label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}

export default Navigation;