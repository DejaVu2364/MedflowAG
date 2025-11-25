import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PatientCard from './PatientCard';
import { Patient } from '../types';

// Mock Firebase
vi.mock('../services/firebase', () => ({
    auth: {},
    db: {},
}));

// Mock Gemini Service
vi.mock('../services/geminiService', () => ({
    classifyComplaint: vi.fn(),
}));

import { AppContext } from '../App';

const mockPatient: Patient = {
    id: '123',
    name: 'John Doe',
    age: 30,
    gender: 'Male',
    phone: '1234567890',
    complaint: 'Headache',
    status: 'Waiting for Triage',
    registrationTime: new Date().toISOString(),
    triage: { level: 'Green', reasons: [] },
    timeline: [],
    orders: [],
    results: [],
    rounds: [],
    vitalsHistory: [],
    clinicalFile: {
        id: 'cf-1',
        patientId: '123',
        status: 'draft',
        sections: { history: {}, gpe: {}, systemic: {} }
    }
};

const mockContextValue: any = {
    currentUser: { id: 'u1', name: 'Doc', role: 'Doctor' },
    logAuditEvent: vi.fn(),
};

describe('PatientCard', () => {
    it('renders patient name and complaint', () => {
        render(
            <AppContext.Provider value={mockContextValue}>
                <PatientCard patient={mockPatient} />
            </AppContext.Provider>
        );

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Headache')).toBeInTheDocument();
    });

    it('calls onTriageClick when triage button is clicked', () => {
        const handleTriageClick = vi.fn();
        render(
            <AppContext.Provider value={mockContextValue}>
                <PatientCard patient={mockPatient} onTriageClick={handleTriageClick} />
            </AppContext.Provider>
        );

        const button = screen.getByText('Start Triage');
        fireEvent.click(button);
        expect(handleTriageClick).toHaveBeenCalledWith('123');
    });
});
