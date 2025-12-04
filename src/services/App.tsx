
import React, { useCallback } from 'react';
import { AppContextType, Checklist, Order, Round, ClinicalFileSections, AISuggestionHistory, HistorySectionData, OrderCategory, VitalsRecord } from './types';
import DashboardPage from '../pages/DashboardPage';
import ReceptionPage from '../pages/ReceptionPage';
import TriagePage from '../pages/TriagePage';
import PatientDetailPage from '../pages/PatientDetailPage';
import Header from '../components/Header';
import ChatPanel from '../components/ChatPanel';
import LoginPage from '../pages/LoginPage';
import { usePatientData } from '../hooks/usePatientData'; // Still used for type, but actual data comes from context

// Import the new Firebase service
import * as firebaseService from './firebaseService';

// Contexts & Hooks
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { UIProvider, useUI } from '../contexts/UIContext';
import { PatientProvider, usePatientContext } from '../contexts/PatientContext';
import { useOrders } from '../hooks/useOrders';
import { useRounds } from '../hooks/useRounds';
import { useChat } from '../hooks/useChat';

export const AppContext = React.createContext<AppContextType | null>(null);

const AppContent: React.FC = () => {
    const { currentUser, setUser } = useAuth();
    const { page, setPage, theme, toggleTheme, isChatOpen, toggleChat, error, setError, isLoading: uiLoading } = useUI();

    const patientData = usePatientContext();
    const {
        patients, auditLog, isLoading: dataLoading, setPatients,
        addPatient, updatePatientVitals, updatePatientStatus, addNoteToPatient, addSOAPNoteToPatient,
        updateClinicalFileSection, composeHistoryWithAI, signOffClinicalFile, logAuditEvent, updateStateAndDb
    } = patientData;

    const { addOrderToPatient, updateOrder, acceptAIOrders, sendAllDrafts } = useOrders();
    const { createDraftRound, updateDraftRound, getRoundContradictions, signOffRound } = useRounds();
    const { chatHistory, sendChatMessage } = useChat();

    const [selectedPatientId, setSelectedPatientId] = React.useState<string | null>(null);

    const addChecklistToPatient = useCallback(async (patientId: string, title: string, items: string[]) => {
        if (!currentUser) return;
        const newChecklist: Checklist = {
            title, author: currentUser.name, authorId: currentUser.id, role: currentUser.role,
            id: `CHK-${Date.now()}`, type: 'Checklist', patientId, timestamp: new Date().toISOString(),
            items: items.map(itemText => ({ text: itemText, checked: false })),
        };
        updateStateAndDb(patientId, p => ({ ...p, timeline: [newChecklist, ...p.timeline] }));
    }, [currentUser, updateStateAndDb]);

    const toggleChecklistItem = useCallback((patientId: string, checklistId: string, itemIndex: number) => {
        updateStateAndDb(patientId, p => {
            const newTimeline = p.timeline.map(event => {
                if (event.type === 'Checklist' && event.id === checklistId) {
                    const newItems = [...event.items];
                    newItems[itemIndex].checked = !newItems[itemIndex].checked;
                    return { ...event, items: newItems };
                }
                return event;
            });
            return { ...p, timeline: newTimeline };
        });
    }, [updateStateAndDb]);

    // --- REFACTORED AI FUNCTIONS ---

    const generateDischargeSummary = useCallback(async (patientId: string) => {
        if (!patients.some(p => p.id === patientId)) return;
        try {
            const { summary } = await firebaseService.compileDischargeSummary(patientId);
            updateStateAndDb(patientId, p => ({ ...p, dischargeSummary: { draft: summary } }));
        } catch (e) {
            console.error(e);
            setError("AI summary generation failed. Please check the backend logs.");
        }
    }, [patients, updateStateAndDb, setError]);

    const generatePatientOverview = useCallback(async (patientId: string) => {
        const patient = patients.find(p => p.id === patientId);
        if (!patient) return;
        try {
            // Using answerWithRAG to generate an overview based on the patient data
            const patientContext = JSON.stringify(patient, null, 2);
            const { response } = await firebaseService.answerWithRAG('Generate a brief, one-paragraph clinical overview of this patient.', patientContext);
            updateStateAndDb(patientId, p => ({ ...p, overview: response }));
        } catch (e) {
             console.error(e);
             setError("AI overview generation failed.");
        }
    }, [patients, updateStateAndDb, setError]);

    const summarizePatientClinicalFile = useCallback(async (patientId: string) => {
        const patient = patients.find(p => p.id === patientId);
        if (!patient) return;
        try {
            // Using answerWithRAG to summarize a specific part of the clinical file.
            const clinicalFileContext = JSON.stringify(patient.clinicalFile.sections, null, 2);
            const { response } = await firebaseService.answerWithRAG('Summarize the key points from the following clinical file sections.', clinicalFileContext);
            updateStateAndDb(patientId, p => ({ ...p, clinicalFile: { ...p.clinicalFile, aiSummary: response } }));
        } catch (e) {
            console.error(e);
            setError("AI clinical file summarization failed.");
        }
    }, [patients, updateStateAndDb, setError]);

    const summarizeVitals = useCallback(async (patientId: string): Promise<string | null> => {
        const patient = patients.find(p => p.id === patientId);
        if (!patient || patient.vitalsHistory.length < 2) return "Not enough data to summarize.";
        try {
            const { summary } = await firebaseService.summarizeVitals(patient.vitalsHistory);
            return summary;
        } catch (e) {
            console.error(e);
            setError("AI vitals summarization failed.");
            return "AI summarization failed.";
        }
    }, [patients, setError]);

    const getFollowUpQuestions = useCallback(async (patientId: string, sectionKey: 'history', fieldKey: keyof HistorySectionData, seedText: string) => {
        if (!seedText) return;
        try {
            const questions = await firebaseService.generateFollowUpQuestions(seedText);
            updateStateAndDb(patientId, p => {
                const historySuggestions = p.clinicalFile.aiSuggestions?.history || {};
                return { ...p, clinicalFile: { ...p.clinicalFile, aiSuggestions: { ...p.clinicalFile.aiSuggestions, history: { ...historySuggestions, followUpQuestions: { ...historySuggestions.followUpQuestions, [fieldKey]: questions } } } } };
            });
        } catch (e) {
            console.error(e);
            setError(`Failed to get follow-up questions from the backend.`);
        }
    }, [updateStateAndDb, setError]);


    // --- Other Functions (unchanged unless necessary) ---

    const addVitalsRecord = useCallback((patientId: string, entryData: Pick<VitalsRecord, 'measurements' | 'observations' | 'source'>) => {
        if (!currentUser) return;
        const newRecord: VitalsRecord = {
            ...entryData, vitalId: `VIT-${Date.now()}`, patientId: patientId, recordedAt: new Date().toISOString(), recordedBy: currentUser.id,
        };
        updateStateAndDb(patientId, p => ({ ...p, vitals: entryData.measurements, vitalsHistory: [newRecord, ...p.vitalsHistory] }));
    }, [currentUser, updateStateAndDb]);

    const formatHpi = useCallback(async (patientId: string) => {
        const patient = patients.find(p => p.id === patientId);
        if (!patient) return;
        const hpiText = patient.clinicalFile.sections.history?.hpi?.toLowerCase() || '';
        const suggestions: Partial<AISuggestionHistory> = {};
        if (hpiText.includes("fever")) suggestions.chief_complaint = "Fever";
        if (Object.keys(suggestions).length > 0) {
            updateStateAndDb(patientId, p => ({ ...p, clinicalFile: { ...p.clinicalFile, aiSuggestions: { ...p.clinicalFile.aiSuggestions, history: suggestions } } }));
        }
    }, [patients, updateStateAndDb]);

    const acceptAISuggestion = useCallback((patientId: string, field: keyof AISuggestionHistory) => {
        updateStateAndDb(patientId, p => {
            const suggestionValue = p.clinicalFile.aiSuggestions?.history?.[field];
            if (suggestionValue === undefined) return p;
            const fieldToUpdate = field === 'structured_hpi' ? 'hpi' : field;
            let updatedData: Partial<HistorySectionData>;
            if (field === 'allergy_history') {
                const existingAllergies = p.clinicalFile.sections.history?.allergy_history || [];
                updatedData = { allergy_history: [...existingAllergies, ...(suggestionValue as any)] };
            } else { updatedData = { [fieldToUpdate as keyof HistorySectionData]: suggestionValue }; }

            const newSuggestions = { ...p.clinicalFile.aiSuggestions?.history };
            delete newSuggestions[field];

            return {
                ...p,
                clinicalFile: { ...p.clinicalFile, sections: { ...p.clinicalFile.sections, history: { ...p.clinicalFile.sections.history, ...updatedData } }, aiSuggestions: { ...p.clinicalFile.aiSuggestions, history: newSuggestions } }
            };
        });
    }, [updateStateAndDb]);

    const clearAISuggestions = useCallback((patientId: string, section: 'history') => {
        updateStateAndDb(patientId, p => ({ ...p, clinicalFile: { ...p.clinicalFile, aiSuggestions: { ...p.clinicalFile.aiSuggestions, [section]: undefined } } }));
    }, [updateStateAndDb]);

    const checkMissingInfo = useCallback((patientId: string, sectionKey: keyof ClinicalFileSections) => {
        updateStateAndDb(patientId, p => {
            let missing: string[] = [];
            if (sectionKey === 'history' && !p.clinicalFile.sections.history?.past_medical_history) missing.push("Past Medical History is empty.");
            return { ...p, clinicalFile: { ...p.clinicalFile, missingInfo: missing } };
        });
    }, [updateStateAndDb]);

    const summarizeSection = useCallback(async (patientId: string, sectionKey: keyof ClinicalFileSections) => {
        await summarizePatientClinicalFile(patientId);
    }, [summarizePatientClinicalFile]);

    const crossCheckFile = useCallback(async (patientId: string) => {
        const patient = patients.find(p => p.id === patientId);
        if (!patient) return;
        let inconsistencies: string[] = [];
        if (patient.clinicalFile.sections.history?.chief_complaint?.includes('fever') && (patient.vitals?.temp_c || 0) < 37.5) inconsistencies.push("History mentions fever but vitals are normal.");
        updateStateAndDb(patientId, p => ({ ...p, clinicalFile: { ...p.clinicalFile, crossCheckInconsistencies: inconsistencies } }));
    }, [patients, updateStateAndDb]);

    const updateFollowUpAnswer = useCallback((patientId: string, fieldKey: keyof HistorySectionData, questionId: string, answer: string) => {
        updateStateAndDb(patientId, p => {
            const historySuggestions = p.clinicalFile.aiSuggestions?.history || {};
            const fieldAnswers = historySuggestions.followUpAnswers?.[fieldKey] || {};
            return { ...p, clinicalFile: { ...p.clinicalFile, aiSuggestions: { ...p.clinicalFile.aiSuggestions, history: { ...historySuggestions, followUpAnswers: { ...historySuggestions.followUpAnswers, [fieldKey]: { ...fieldAnswers, [questionId]: answer } } } } } };
        });
    }, [updateStateAndDb]);

    const renderPage = () => {
        switch (page) {
            case 'dashboard': return <DashboardPage />;
            case 'reception': return <ReceptionPage />;
            case 'triage': return <TriagePage />;
            case 'patientDetail': return <PatientDetailPage />;
            default: return <DashboardPage />;
        }
    };

    const appContextValue: AppContextType = {
        page, setPage, currentUser, setUser: () => { },
        patients, auditLog, addPatient, updatePatientVitals, updatePatientStatus,
        addNoteToPatient, addSOAPNoteToPatient, addChecklistToPatient, updatePatientComplaint: (pid, c) => { },
        toggleChecklistItem, selectedPatientId, setSelectedPatientId, isLoading: dataLoading || uiLoading, error, chatHistory, sendChatMessage,
        logAuditEvent, signOffClinicalFile, updateOrder, acceptAIOrders, sendAllDrafts, addVitalsRecord,
        generateDischargeSummary, addOrderToPatient, generatePatientOverview, summarizePatientClinicalFile, summarizeVitals,
        createDraftRound, updateDraftRound, signOffRound, getRoundContradictions,
        updateClinicalFileSection, formatHpi, checkMissingInfo, summarizeSection, crossCheckFile, acceptAISuggestion,
        clearAISuggestions, getFollowUpQuestions, updateFollowUpAnswer, composeHistoryWithAI, theme, toggleTheme,
    };

    return (
        <AppContext.Provider value={appContextValue}>
            {!currentUser ? <LoginPage /> : (
                <div className="min-h-screen bg-background-secondary font-sans transition-colors duration-200">
                    <Header onToggleChat={toggleChat} />
                    <main className="p-4 sm:p-6 lg:p-8">{renderPage()}</main>
                    <ChatPanel isOpen={isChatOpen} onClose={() => toggleChat()} />
                </div>
            )}
        </AppContext.Provider>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <UIProvider>
                <PatientProvider>
                    <AppContent />
                </PatientProvider>
            </UIProvider>
        </AuthProvider>
    );
};

export default App;
