import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, ShieldAlert, LogIn } from 'lucide-react';
import './Login.css';

/** Renders the admin/officer login interface using Firebase Auth. */
export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/dashboard';

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Login failure:', err);
            setError(err.message || 'Invalid email or password.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon-badge">
                        <Lock size={28} />
                    </div>
                    <h2>Official Portal Access</h2>
                    <p>Enter administrative credentials to log in</p>
                </div>

                {error && (
                    <div className="login-error-banner">
                        <ShieldAlert size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email-input">Email Address</label>
                        <div className="input-with-icon">
                            <Mail size={18} className="field-icon" />
                            <input
                                id="email-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="officer@safety.gov"
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
                        <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
                    </button>
                </form>

                <div className="login-admin-notice">
                    <p><strong>Note:</strong> Officer/Admin accounts must be created manually via Firebase Console.</p>
                </div>
            </div>
        </div>
    );
}
