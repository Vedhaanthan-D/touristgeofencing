import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

const AuthContext = createContext(null);

const ROLE_LABELS = {
    admin: 'Administrator',
    police: 'Police Officer',
    forest: 'Forest Officer',
    immigration: 'Immigration Officer'
};

/** Provides authentication state, role custom claims, and login/logout methods. */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const idTokenResult = await currentUser.getIdTokenResult();
                    setRole(idTokenResult.claims.role || null);
                } catch (err) {
                    console.error('Error fetching role claims:', err);
                    setRole(null);
                }
            } else {
                setRole(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
            const idTokenResult = await userCredential.user.getIdTokenResult(true);
            const userRole = idTokenResult.claims.role || null;
            setRole(userRole);
            return { user: userCredential.user, role: userRole };
        }
        return userCredential;
    };

    const logout = () => signOut(auth);

    const roleLabel = ROLE_LABELS[role] || null;

    return (
        <AuthContext.Provider value={{ user, role, roleLabel, loading, login, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

/** Custom hook for accessing authentication context. */
export function useAuth() {
    return useContext(AuthContext);
}

