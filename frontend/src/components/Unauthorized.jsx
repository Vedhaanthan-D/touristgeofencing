import React from 'react';
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AuthScreens.css';

/** Displays access denied screen for users attempting to access routes outside their role permissions. */
export default function Unauthorized() {
    const { roleLabel, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="auth-screen-wrapper fade-in">
            <div className="auth-screen-backdrop">
                <div className="gradient-orb orb-1" />
                <div className="gradient-orb orb-2" />
            </div>

            <div className="auth-glass-card">
                <div className="auth-card-badge status-danger">
                    <ShieldX size={20} />
                    <span>403 Access Denied</span>
                </div>

                <div className="auth-card-header">
                    <ShieldX size={48} className="auth-hero-icon danger-glow" />
                    <h2>Insufficient Permissions</h2>
                    <p>
                        Your current active role (<strong>{roleLabel || 'Official'}</strong>) does not have authorization to view this page or section.
                    </p>
                </div>

                <div className="auth-info-box">
                    <p>
                        If you believe you should have access to this resource, please check with your department administrator.
                    </p>
                </div>

                <div className="auth-card-actions">
                    <button onClick={() => navigate(-1)} className="auth-btn-primary">
                        <ArrowLeft size={16} />
                        <span>Go Back</span>
                    </button>
                    <button onClick={logout} className="auth-btn-secondary">
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
