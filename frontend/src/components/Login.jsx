import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, ShieldAlert, LogIn, Shield, CheckCircle2 } from 'lucide-react';
import './Login.css';

const ROLE_LABEL_MAP = {
    admin: 'Govt Official',
    police: 'Police Officer',
    forest: 'Forest Officer',
    immigration: 'Immigration Officer'
};

/** Renders the official portal login interface with role authentication and ocean glassmorphism design. */
export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successRole, setSuccessRole] = useState(null);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/dashboard';

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessRole(null);
        setIsSubmitting(true);
        try {
            const res = await login(email, password);
            const userRole = res?.role || null;
            setSuccessRole(userRole);

            const defaultTarget = userRole === 'immigration' ? '/register' : '/dashboard';
            const targetPath = (from && from !== '/login') ? from : defaultTarget;

            // Give a short delay to display the role confirmation chip before navigating
            setTimeout(() => {
                navigate(targetPath, { replace: true });
            }, 750);
        } catch (err) {
            console.error('Login failure:', err);
            setError(err.message || 'Invalid email or password.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container fade-in">
            {/* Animated Ocean Backdrop Blobs */}
            <div className="login-backdrop">
                <div className="login-blob blob-1" />
                <div className="login-blob blob-2" />
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon-badge">
                        <Shield size={28} className="shield-icon" />
                    </div>
                    <h2>Official Portal Access</h2>
                    <p>Enter your department credentials to access the safety portal</p>
                </div>

                {error && (
                    <div className="login-error-banner">
                        <ShieldAlert size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {successRole !== null && (
                    <div className="login-success-chip">
                        <CheckCircle2 size={16} />
                        <span>Authenticated as <strong>{ROLE_LABEL_MAP[successRole] || 'Official'}</strong></span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email-input">Official Email Address</label>
                        <div className="input-with-icon">
                            <Mail size={18} className="field-icon" />
                            <input
                                id="email-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="officer@geofence.gov"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password-input">Password</label>
                        <div className="input-with-icon">
                            <Lock size={18} className="field-icon" />
                            <input
                                id="password-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
                        <LogIn size={18} />
                        <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In'}</span>
                    </button>
                </form>

                <div className="login-admin-notice">
                    <p>Officer accounts and role access (Police, Forest, Immigration, Govt Officials) are provisioned by your system administrator.</p>
                </div>
            </div>
        </div>
    );
}
