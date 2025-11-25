import React, { createContext, useContext } from 'react';
import { usePatientData } from '../hooks/usePatientData';
import { useAuth } from './AuthContext';
import { Patient, AuditEvent, Vitals, PatientStatus, SOAPNote, ClinicalFileSections, HistorySectionData, AISuggestionHistory } from '../types';

// Define the shape of the context based on usePatientData return type
type PatientContextType = ReturnType<typeof usePatientData>;

const PatientContext = createContext<PatientContextType | null>(null);

export const usePatientContext = () => {
    const context = useContext(PatientContext);
    if (!context) throw new Error("usePatientContext must be used within a PatientProvider");
    return context;
};

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const patientData = usePatientData(currentUser);

    return (
        <PatientContext.Provider value={patientData}>
            {children}
        </PatientContext.Provider>
    );
};
