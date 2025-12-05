import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: "medflowai-19269",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let db: Firestore;
let auth: Auth;

// Check if config is valid (at least apiKey is present)
const isConfigValid = !!firebaseConfig.apiKey;

if (isConfigValid) {
    // Initialize Firebase
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    // console.warn("Firebase config missing or invalid. Initializing in MOCK MODE.");
    // Mock or create a dummy app object if strictly needed by types,
    // but usually if we check initialization before using, we are fine.
    // However, top-level exports might be used.
    // Let's proxy them or use a dummy object that doesn't crash immediately.

    // We can't easily mock the entire SDK, but we can ensure the exports exist.
    // For now, let's just NOT initialize and let consumers check `getIsFirebaseInitialized()`
    // OR, better, creating a dummy auth/db object is risky without heavy mocking.

    // Simplest fix: If valid, init. If not, export null/undefined and let the UI handle it?
    // BUT the current exports are consts.
    // Let's fake it for the purpose of the UI *mounting*.
    // The `getAuth()` call throws if apiKey is missing.

    // We will create a "dummy" app config that is syntactically valid but won't work for real calls.
    // This stops the crash.
    const dummyConfig = {
        apiKey: "dummy-api-key",
        authDomain: "dummy.firebaseapp.com",
        projectId: "dummy-project"
    };
    app = !getApps().length ? initializeApp(dummyConfig) : getApp();

    // We still shouldn't call getAuth if we don't want it to try connecting?
    // Actually getAuth just initializes the service. It might throw if keys are bad.
    // Let's try wrapping in try/catch or mocking the exports.

    // Best approach for this codebase: use the same app instance but know it will fail network calls.
    // The previous error was `auth/invalid-api-key`.

    // We will export "mock" objects if we can using `as any`.
    db = {} as Firestore;
    auth = {
        currentUser: null,
        onAuthStateChanged: (cb: any) => { cb(null); return () => {}; },
        signOut: async () => {}
    } as unknown as Auth;
}

export { db, auth };

export const getIsFirebaseInitialized = () => {
    return isConfigValid;
};
