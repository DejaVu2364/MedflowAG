import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { auth, getIsFirebaseInitialized } from '../services/firebase'; // Ensure this path is correct
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';

// Mock users for fallback or mapping
const MOCK_DOCTOR: User = { id: 'user-doc-1', name: 'Dr. Harikrishnan S', email: 'doctor@medflow.ai', role: 'Doctor' };
const MOCK_INTERN: User = { id: 'user-int-1', name: 'Dr. Rohan Joshi', email: 'intern@medflow.ai', role: 'Intern' };

interface AuthContextType {
    currentUser: User | null;
    login: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
    setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const isFirebaseReady = getIsFirebaseInitialized();

    useEffect(() => {
        // For this prototype, we might just use the mock users if Firebase Auth isn't fully set up with users
        // But let's try to listen to Firebase Auth
        let unsubscribe = () => {};

        if (isFirebaseReady) {
             unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    // Map Firebase user to our User type.
                    // In a real app, we'd fetch the user role from Firestore 'users' collection.
                    // Here we'll just mock it based on email for simplicity or default to Doctor.
                    const role = user.email?.includes('intern') ? 'Intern' : 'Doctor';
                    setCurrentUser({
                        id: user.uid,
                        name: user.displayName || user.email || 'User',
                        email: user.email || '',
                        role: role as any
                    });
                } else {
                    // In real mode, if no user, we are logged out.
                    setCurrentUser(null);
                }
                setLoading(false);
            });
        } else {
            console.warn("Firebase Auth not initialized (Mock Mode), skipping listener.");
            setLoading(false);
        }
        return unsubscribe;
    }, [isFirebaseReady]);

    const login = async (email: string) => {
        // For the prototype, we simulate login by checking our mock list if Firebase fails or just setting state
        // Ideally we use signInWithEmailAndPassword

        if (isFirebaseReady) {
            try {
                // Hardcoded password for demo
                await signInWithEmailAndPassword(auth, email, 'password123');
                return;
            } catch (e) {
                console.warn("Firebase login failed:", e);
                // Fallthrough to mock logic below is dangerous if real auth failed.
                // But specifically for this demo app where users might expect "doctor@medflow.ai" to work
                // regardless of whether that user exists in the configured Firebase project,
                // we might want fallback?
                // NO, if Firebase is configured, we should rely on it.
                throw e;
            }
        }

        // Mock Mode Login Logic
        console.warn("Using Mock Login Logic.");
        if (email === MOCK_DOCTOR.email) setCurrentUser(MOCK_DOCTOR);
        else if (email === MOCK_INTERN.email) setCurrentUser(MOCK_INTERN);
        else throw new Error("User not found (Mock Mode)");
    };

    const logout = async () => {
        if (isFirebaseReady) {
            await firebaseSignOut(auth);
        }
        setCurrentUser(null);
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout, loading, setUser: setCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
};
