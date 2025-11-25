import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { auth } from '../services/firebase'; // Ensure this path is correct
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';

// Mock users for fallback or mapping
const MOCK_DOCTOR: User = { id: 'user-doc-1', name: 'Dr. Harikrishnan S', email: 'doctor@medflow.ai', role: 'Doctor' };
const MOCK_INTERN: User = { id: 'user-int-1', name: 'Dr. Rohan Joshi', email: 'intern@medflow.ai', role: 'Intern' };

interface AuthContextType {
    currentUser: User | null;
    login: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
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

    useEffect(() => {
        // For this prototype, we might just use the mock users if Firebase Auth isn't fully set up with users
        // But let's try to listen to Firebase Auth
        const unsubscribe = onAuthStateChanged(auth, (user) => {
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
                setCurrentUser(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email: string) => {
        // For the prototype, we simulate login by checking our mock list if Firebase fails or just setting state
        // Ideally we use signInWithEmailAndPassword
        try {
            // Hardcoded password for demo
            await signInWithEmailAndPassword(auth, email, 'password123');
        } catch (e) {
            console.warn("Firebase login failed (likely user not created), falling back to mock login for demo.");
            if (email === MOCK_DOCTOR.email) setCurrentUser(MOCK_DOCTOR);
            else if (email === MOCK_INTERN.email) setCurrentUser(MOCK_INTERN);
            else throw new Error("User not found");
        }
    };

    const logout = async () => {
        await firebaseSignOut(auth);
        setCurrentUser(null);
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
