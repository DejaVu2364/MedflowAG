
import { getFunctions, httpsCallable } from "firebase/functions";
import { VitalsRecord, Round, Patient } from "../types";

const functions = getFunctions();

// A generic wrapper for calling a Firebase Function
const callFunction = async <T, R>(functionName: string, data: T): Promise<R> => {
    try {
        const func = httpsCallable(functions, functionName);
        const result = await func(data);
        return result.data as R;
    } catch (error) {
        console.error(`Error calling function '${functionName}':`, error);
        // It's often better to let the caller handle the error UI
        throw new Error(`Failed to execute ${functionName}.`);
    }
};

// --- Database Operations ---
export const createPatient = (patientData: Partial<Patient>) => {
    return callFunction<Partial<Patient>, { id: string }>('createPatient', patientData);
};

export const logAuditEvent = (logData: { patientId: string, action: string, entity: string, entityId?: string, payload?: object }) => {
    return callFunction<object, { success: boolean }>('logAuditEvent', logData);
};


// --- AI-Powered Analysis ---
export const generateFollowUpQuestions = (seedText: string): Promise<string[]> => {
    return callFunction<{ seedText: string }, string[]>('generateFollowUpQuestions', { seedText });
};

export const summarizeVitals = (vitalsHistory: VitalsRecord[]): Promise<{ summary: string }> => {
    return callFunction<{ vitalsHistory: VitalsRecord[] }, { summary: string }>('summarizeVitals', { vitalsHistory });
};

export const compileDischargeSummary = (patientId: string): Promise<{ summary: string }> => {
    return callFunction<{ patientId: string }, { summary: string }>('compileDischargeSummary', { patientId });
};

export const crossCheckRound = (patientId: string, round: Round): Promise<{ contradictions: string[] }> => {
    return callFunction<{ patientId: string, round: Round }, { contradictions: string[] }>('crossCheckRound', { patientId, round });
};

export const answerWithRAG = (message: string, context: string): Promise<{ response: string }> => {
    return callFunction<{ message: string, context: string }, { response: string }>('answerWithRAG', { message, context });
};
