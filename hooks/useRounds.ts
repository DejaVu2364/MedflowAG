import { useCallback } from 'react';
import { usePatientContext } from '../contexts/PatientContext';
import { useAuth } from '../contexts/AuthContext';
import { Round } from '../types';
import { crossCheckRound } from '../services/geminiService';

export const useRounds = () => {
    const { updateStateAndDb, patients } = usePatientContext();
    const { currentUser } = useAuth();

    const createDraftRound = useCallback(async (patientId: string): Promise<Round> => {
        if (!currentUser) throw new Error("User not authenticated");
        const patient = patients.find(p => p.id === patientId);
        if (!patient) throw new Error("Patient not found");

        const existingDraft = patient.rounds.find(r => r.status === 'draft');
        if (existingDraft) return existingDraft;

        const newDraft: Round = {
            roundId: `RND-${patientId}-${Date.now()}`,
            patientId,
            doctorId: currentUser.id,
            createdAt: new Date().toISOString(),
            status: 'draft',
            subjective: '',
            objective: '',
            assessment: '',
            plan: { text: '', linkedOrders: [] },
            linkedResults: [],
            signedBy: null,
            signedAt: null,
        };
        updateStateAndDb(patientId, p => ({ ...p, rounds: [newDraft, ...p.rounds] }));
        return newDraft;
    }, [patients, currentUser, updateStateAndDb]);

    const updateDraftRound = useCallback((patientId: string, roundId: string, updates: Partial<Round>) => {
        updateStateAndDb(patientId, p => {
            const newRounds = p.rounds.map(r => r.roundId === roundId ? { ...r, ...updates } : r);
            return { ...p, rounds: newRounds };
        });
    }, [updateStateAndDb]);

    const getRoundContradictions = useCallback(async (patientId: string, roundId: string): Promise<string[]> => {
        const patient = patients.find(p => p.id === patientId);
        const round = patient?.rounds.find(r => r.roundId === roundId);
        if (!patient || !round) return ["Patient or round not found."];
        try {
            const { contradictions } = await crossCheckRound(patient, round);
            return contradictions;
        } catch (e) { return ["AI cross-check failed."]; }
    }, [patients]);

    const signOffRound = useCallback(async (patientId: string, roundId: string, acknowledgedContradictions: string[]) => {
        if (!currentUser) return;
        updateStateAndDb(patientId, p => {
            const newRounds = p.rounds.map(r => r.roundId === roundId ? { ...r, status: 'signed' as const, signedAt: new Date().toISOString(), signedBy: currentUser.id } : r);
            return { ...p, rounds: newRounds };
        });
    }, [currentUser, updateStateAndDb]);

    return {
        createDraftRound,
        updateDraftRound,
        getRoundContradictions,
        signOffRound
    };
};
