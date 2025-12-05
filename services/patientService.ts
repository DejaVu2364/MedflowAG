import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db, getIsFirebaseInitialized as getIsFirebaseInitializedFromCore } from './firebase';
import { Patient, AuditEvent } from '../types';

export const subscribeToPatients = (callback: (patients: Patient[]) => void) => {
    // Check if initialized properly
    if (!getIsFirebaseInitializedFromCore()) return () => { };

    // Double check db object
    if (!db || !db.type) return () => {};

    const q = query(collection(db, 'patients'), orderBy('registrationTime', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const patients = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Patient));
        callback(patients);
    }, (error) => {
        console.error("Error fetching patients:", error);
    });
};

export const savePatient = async (patient: Patient) => {
    if (!getIsFirebaseInitializedFromCore()) return;
    try {
        await setDoc(doc(db, 'patients', patient.id), patient);
    } catch (e) {
        console.error("Error saving patient:", e);
    }
};

export const updatePatientInDb = async (patientId: string, updates: Partial<Patient>) => {
    if (!getIsFirebaseInitializedFromCore()) return;
    try {
        const docRef = doc(db, 'patients', patientId);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating patient:", e);
    }
};

export const logAuditToDb = async (event: AuditEvent) => {
    if (!getIsFirebaseInitializedFromCore()) return;
    try {
        await addDoc(collection(db, 'audit_logs'), event);
    } catch (e) {
        // Silent fail
    }
};

export const getIsFirebaseInitialized = () => getIsFirebaseInitializedFromCore();
