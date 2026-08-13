import React from 'react';
import { ShieldAlert, LogOut, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './AuthScreens.css';

/** Displays message for logged in users awaiting role assignment by an admin. */
export default function PendingRole() {
    const { user, logout } = useAuth();

    return (
        <div className="auth-screen-wrapper fade-in">
            <div className="auth-screen-backdrop">
                <div className="gradient-orb orb-1" />
                <div className="gradient-orb orb-2" />
            </div>

            <div className="auth-glass-card">
                <div className="auth-card-badge status-warning">
                    <Clock size={20} />
                    <span>Role Assignment Pending</span>
                </div>

                <div className="auth-card-header">
                    <ShieldAlert size={48} className="auth-hero-icon warning-glow" />
                    <h2>Awaiting Authorization</h2>
                    <p>
                        Your account <strong>{user?.email}</strong> is registered, but no officer role (Police, Forest, Immigration, or Admin) has been assigned to your account yet.
                    </p>
                </div>

                <div className="auth-info-box">
                    <p>
                        Please contact your System Administrator to assign your official role via the admin portal or CLI script.
                    </p>
                </div>

                <div className="auth-card-actions">
                    <button onClick={logout} className="auth-btn-secondary">
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
