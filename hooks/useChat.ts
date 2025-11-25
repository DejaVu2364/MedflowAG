import { useState, useCallback } from 'react';
import { ChatMessage } from '../types';
import { usePatientContext } from '../contexts/PatientContext';
import { answerWithRAG } from '../services/geminiService';

export const useChat = () => {
    const { patients } = usePatientContext();
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    const sendChatMessage = useCallback(async (message: string, patientContextId?: string | null) => {
        const userMessage: ChatMessage = { role: 'user', content: message };
        setChatHistory(prev => [...prev, userMessage, { role: 'model', content: '', isLoading: true }]);

        try {
            let context = '';
            let sources: string[] = [];
            if (patientContextId) {
                const patient = patients.find(p => p.id === patientContextId);
                if (patient) {
                    context = patient.timeline
                        .map(event => {
                            if (event.type === 'SOAP') return `[${event.timestamp}] SOAP Note by ${event.role} ${event.author}: S:${event.s}, O:${event.o}, A:${event.a}, P:${event.p}`;
                            if (event.type === 'TeamNote') return `[${event.timestamp}] Team Note by ${event.role} ${event.author}: ${event.content}`;
                            return '';
                        }).join('\n\n');
                    sources.push(`Patient ID: ${patient.id}`);
                }
            }

            const aiResponse = await answerWithRAG(message, context);
            const modelMessage: ChatMessage = { role: 'model', content: aiResponse, sources };
            setChatHistory(prev => [...prev.slice(0, -1), modelMessage]);

        } catch (e) {
            console.error(e);
            const errorMessage: ChatMessage = { role: 'model', content: "Sorry, I encountered an error." };
            setChatHistory(prev => [...prev.slice(0, -1), errorMessage]);
        }
    }, [patients]);

    return { chatHistory, sendChatMessage };
};
