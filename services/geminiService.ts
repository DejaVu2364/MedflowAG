
import { GoogleGenerativeAI as GoogleGenAI, SchemaType } from "@google/generative-ai";
import { AITriageSuggestion, Department, TriageLevel, SOAPNote, TeamNote, FollowUpQuestion, ComposedHistory, Patient, Order, OrderCategory, PatientOverview, Vitals, OrderPriority, Round, VitalsRecord, DischargeSummary, ClinicalFile, Inconsistency } from '../types';
import { getFromCache, setInCache } from './caching';


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("VITE_GEMINI_API_KEY is not set. AI features will be disabled or mocked.");
}

const ai = new GoogleGenAI(API_KEY || "mock-key");

const flashModel = "gemini-2.0-flash-exp"; // Updated to latest flash
const proModel = "gemini-2.0-flash-exp"; // Using Flash for everything for speed/cost in this demo

const departmentValues: Department[] = ['Cardiology', 'Orthopedics', 'General Medicine', 'Obstetrics', 'Neurology', 'Emergency', 'Unknown'];
const triageLevelValues: TriageLevel[] = ['Red', 'Yellow', 'Green'];


export const classifyComplaint = async (complaint: string): Promise<{ data: AITriageSuggestion, fromCache: boolean }> => {
    const cacheKey = `classify:${complaint.toLowerCase().trim()}`;
    const cached = getFromCache<AITriageSuggestion>(cacheKey);
    if (cached) {
        return { data: cached, fromCache: true };
    }

    if (import.meta.env.VITE_TEST_MODE === 'true') {
        return {
            data: {
                department: 'General Medicine',
                suggested_triage: 'Green',
                confidence: 0.95
            },
            fromCache: false
        };
    }

    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        department: {
                            type: SchemaType.STRING,
                            description: 'The suggested medical department.',
                            enum: departmentValues
                        },
                        suggested_triage: {
                            type: SchemaType.STRING,
                            description: 'The suggested triage level (Red, Yellow, or Green).',
                            enum: triageLevelValues,
                        },
                        confidence: {
                            type: SchemaType.NUMBER,
                            description: 'A confidence score between 0 and 1.',
                        },
                    },
                    required: ['department', 'suggested_triage', 'confidence'],
                },
            }
        });

        const result = await model.generateContent(`You are a medical expert system. Based on the patient's chief complaint, classify it into the most likely medical department and suggest a triage level (Red, Yellow, or Green). Provide a confidence score from 0 to 1. Complaint: "${complaint}"`);
        const response = result.response;
        const jsonString = response.text();
        const data: AITriageSuggestion = JSON.parse(jsonString);

        setInCache(cacheKey, data);
        return { data, fromCache: false };

    } catch (error) {
        console.error("Error classifying complaint with Gemini:", error);
        throw error;
    }
};

type SOAPNoteData = Omit<SOAPNote, 'id' | 'patientId' | 'author' | 'authorId' | 'role' | 'timestamp' | 'type'>;

export const generateSOAPFromTranscript = async (transcript: string): Promise<{ data: SOAPNoteData, fromCache: boolean }> => {
    const cacheKey = `soap:${transcript.slice(0, 100)}`;
    const cached = getFromCache<SOAPNoteData>(cacheKey);
    if (cached) {
        return { data: cached, fromCache: true };
    }

    if (import.meta.env.VITE_TEST_MODE === 'true') {
        return {
            data: {
                transcript,
                s: 'Test Subjective',
                o: 'Test Objective',
                a: 'Test Assessment',
                p: 'Test Plan'
            },
            fromCache: false
        };
    }

    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        transcript: { type: SchemaType.STRING, description: "The original transcript provided." },
                        s: { type: SchemaType.STRING, description: "Subjective: The patient's reported symptoms and feelings." },
                        o: { type: SchemaType.STRING, description: "Objective: The doctor's objective findings, vitals, and exam results mentioned." },
                        a: { type: SchemaType.STRING, description: "Assessment: The primary diagnosis or differential diagnoses." },
                        p: { type: SchemaType.STRING, description: "Plan: The treatment plan, including tests, medications, and follow-up." },
                    },
                    required: ['s', 'o', 'a', 'p', 'transcript'],
                },
            }
        });

        const result = await model.generateContent(`You are a medical scribe AI. Convert the following doctor's round transcript into a structured SOAP note. Ensure each section is concise and clinically relevant. Transcript: "${transcript}"`);
        const response = result.response;
        const data = JSON.parse(response.text());
        setInCache(cacheKey, data);
        return { data, fromCache: false };
    } catch (error) {
        console.error("Error generating SOAP note:", error);
        const fallbackResult = {
            transcript,
            s: 'Could not generate from transcript.',
            o: 'Could not generate from transcript.',
            a: 'Could not generate from transcript.',
            p: 'Could not generate from transcript.',
        };
        return { data: fallbackResult, fromCache: false };
    }
};

type SummaryData = { summary: string, escalations: string[] };

export const summarizeInternNotes = async (notes: TeamNote[]): Promise<{ data: SummaryData, fromCache: boolean }> => {
    const noteTexts = notes.map(n => n.content).join('|');
    const cacheKey = `summary:${noteTexts.slice(0, 100)}`;
    const cached = getFromCache<SummaryData>(cacheKey);
    if (cached) {
        return { data: cached, fromCache: true };
    }

    if (import.meta.env.VITE_TEST_MODE === 'true') {
        return {
            data: {
                summary: 'Test Summary',
                escalations: ['Test Escalation']
            },
            fromCache: false
        };
    }

    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING, description: "A brief summary of the patient's overall status." },
                        escalations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "A list of critical points needing attention." },
                    },
                    required: ['summary', 'escalations']
                }
            }
        });

        const result = await model.generateContent(`As a senior attending physician, review the following progress notes from interns. Provide a brief summary of the patient's status and create a list of key points or concerns that may require escalation or your direct attention. Notes:\n${noteTexts}`);
        const data = JSON.parse(result.response.text());
        setInCache(cacheKey, data);
        return { data, fromCache: false };
    } catch (error) {
        console.error("Error summarizing notes:", error);
        const fallbackResult = { summary: 'Failed to generate summary.', escalations: ['API error.'] };
        return { data: fallbackResult, fromCache: false };
    }
};

export const generateChecklist = async (diagnosis: string): Promise<{ data: string[], fromCache: boolean }> => {
    const cacheKey = `checklist:${diagnosis.toLowerCase().trim()}`;
    const cached = getFromCache<string[]>(cacheKey);
    if (cached) {
        return { data: cached, fromCache: true };
    }
    if (import.meta.env.VITE_TEST_MODE === 'true') {
        return { data: ['Test Checklist Item 1', 'Test Checklist Item 2'], fromCache: false };
    }
    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        checklist: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "A list of checklist items." }
                    },
                    required: ['checklist']
                }
            }
        });

        const result = await model.generateContent(`Create a standard clinical care checklist for a patient with the following assessment: "${diagnosis}". The checklist should include 5-7 key actions or monitoring points.`);
        const data = JSON.parse(result.response.text());
        const checklistItems = data.checklist || [];
        setInCache(cacheKey, checklistItems);
        return { data: checklistItems, fromCache: false };
    } catch (error) {
        console.error("Error generating checklist:", error);
        const fallbackResult = ['Failed to generate checklist due to API error.'];
        return { data: fallbackResult, fromCache: false };
    }
};

export const chatWithGemini = async (history: { role: 'user' | 'ai'; content: string }[], context: string): Promise<string> => {
    try {
        const systemInstruction = `You are MedFlow AI, a helpful, warm, and intelligent clinical assistant. 
        You are chatting with a doctor about a specific patient.
        
        CONTEXT:
        ${context || "No specific patient context provided."}

        RULES:
        1. Be conversational but professional.
        2. Use the provided patient context to answer questions accurately.
        3. If you don't know something, ask clarifying questions.
        4. Always end your response with a newline and "AI-generated — verify clinically."
        5. Use Markdown for formatting (bolding key findings, bullet points).
        `;

        const model = ai.getGenerativeModel({
            model: proModel,
            systemInstruction
        });

        const chat = model.startChat({
            history: history.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }))
        });

        const result = await chat.sendMessage("Please respond to the latest message.");
        return result.response.text();
    } catch (error) {
        console.error("Error in chatWithGemini:", error);
        return "I'm having trouble connecting to the AI service right now. Please try again.";
    }
};

export const answerWithRAG = async (query: string, context: string): Promise<string> => {
    try {
        const systemInstruction = `You are MedFlow AI, a clinical assistant. 
        Answer the user's question based strictly on the provided patient context.
        
        CONTEXT:
        ${context}

        If the answer is not in the context, say "I don't have enough information in the patient record to answer that."
        `;

        const model = ai.getGenerativeModel({
            model: proModel,
            systemInstruction
        });

        const result = await model.generateContent(query);
        return result.response.text();
    } catch (error) {
        console.error("Error in answerWithRAG:", error);
        return "AI Service Error.";
    }
};


// --- PATIENT WORKSPACE AI HELPERS ---

export const generateOverviewSummary = async (patient: Patient): Promise<PatientOverview> => {
    const context = `
        Generate a concise overview for a clinician.
        Patient: ${patient.name}, ${patient.age}, ${patient.gender}.
        Chief Complaint: ${patient.chiefComplaints?.map(c => `${c.complaint} (${c.durationValue} ${c.durationUnit})`).join(', ') || 'None'}.
        Current Vitals: ${patient.vitals ? `Pulse: ${patient.vitals.pulse}, BP: ${patient.vitals.bp_sys}/${patient.vitals.bp_dia}, SpO2: ${patient.vitals.spo2}%` : 'Not recorded'}.
        Active Orders: ${patient.orders.filter(o => o.status === 'sent' || o.status === 'in_progress').map(o => o.label).join(', ') || 'None'}.
        Latest Round Summary: ${patient.rounds.find(r => r.status === 'signed')?.subjective || 'No rounds yet'}.
    `;
    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING, description: "A one-line summary of the patient's current situation." },
                        vitalsSnapshot: { type: SchemaType.STRING, description: "A brief summary of the current vitals (e.g., 'Stable', 'Febrile', 'Tachycardic')." },
                        activeOrders: { type: SchemaType.STRING, description: "A count or brief list of active orders." },
                        recentResults: { type: SchemaType.STRING, description: "Mention any significant recent results, or 'Pending'." },
                    },
                    required: ['summary', 'vitalsSnapshot', 'activeOrders', 'recentResults'],
                },
            }
        });

        const result = await model.generateContent(`You are a clinical AI assistant. Based on the following data, generate a structured summary for the patient's overview tab. Each field should be a very brief, single line. \n\n${context}`);
        return JSON.parse(result.response.text()) as PatientOverview;
    } catch (error) {
        console.error("Error generating overview summary:", error);
        throw error;
    }
};

export const summarizeClinicalFile = async (clinicalFile: ClinicalFile): Promise<string> => {
    const context = JSON.stringify(clinicalFile);
    try {
        const model = ai.getGenerativeModel({ model: proModel });
        const result = await model.generateContent(`Summarize the following clinical findings into a concise 3-4 line paragraph for a medical record.\n\n${context}`);
        return result.response.text();
    } catch (error) {
        console.error("Error summarizing clinical file:", error);
        throw error;
    }
};

type SuggestedOrder = Omit<Order, 'orderId' | 'patientId' | 'createdBy' | 'createdAt' | 'status'>;

export const suggestOrdersFromClinicalFile = async (clinicalFile: ClinicalFile): Promise<SuggestedOrder[]> => {
    const context = JSON.stringify(clinicalFile);

    const OrderCategoryEnum: OrderCategory[] = ["investigation", "radiology", "medication", "procedure", "nursing", "referral"];
    const OrderPriorityEnum: OrderPriority[] = ["routine", "urgent", "STAT"];

    // Mock for local/test mode
    if (localStorage.getItem('medflow_force_local') === 'true' || import.meta.env.VITE_TEST_MODE === 'true') {
        return [
            {
                category: 'investigation',
                subType: 'CBC',
                label: 'Complete Blood Count',
                priority: 'routine',
                rationale: 'To evaluate for infection given the history of fever.',
                payload: {}
            },
            {
                category: 'radiology',
                subType: 'USG Abdomen',
                label: 'Ultrasound Abdomen',
                priority: 'urgent',
                rationale: 'To rule out appendicitis given RLQ pain.',
                payload: {}
            }
        ] as SuggestedOrder[];
    }

    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        suggested_orders: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    category: { type: SchemaType.STRING, enum: OrderCategoryEnum },
                                    subType: { type: SchemaType.STRING, description: "e.g., CBC, Chest X-ray, Paracetamol" },
                                    label: { type: SchemaType.STRING, description: "Human-readable label for the order." },
                                    priority: { type: SchemaType.STRING, enum: OrderPriorityEnum },
                                    rationale: { type: SchemaType.STRING, description: "Clinical rationale for suggesting this order." },
                                    payload: {
                                        type: SchemaType.OBJECT,
                                        description: "Category-specific details for the order.",
                                        properties: {
                                            dose: { type: SchemaType.STRING },
                                            route: { type: SchemaType.STRING },
                                            frequency: { type: SchemaType.STRING },
                                            region: { type: SchemaType.STRING },
                                            modality: { type: SchemaType.STRING },
                                            sampleType: { type: SchemaType.STRING },
                                        }
                                    }
                                },
                                required: ['category', 'subType', 'label', 'priority', 'rationale']
                            }
                        }
                    },
                    required: ['suggested_orders']
                }
            }
        });

        const result = await model.generateContent(`You are a clinical decision support AI. Given the patient's history and examination findings, suggest relevant initial orders. Format the output as a JSON array of order objects. Include a clinical rationale for each suggestion.
            Data: "${context}"`);
        const data = JSON.parse(result.response.text());

        // Map rationale to ai_provenance
        return (data.suggested_orders || []).map((o: any) => ({
            ...o,
            ai_provenance: {
                prompt_id: null,
                rationale: o.rationale
            }
        })) as SuggestedOrder[];

    } catch (error) {
        console.error("Error suggesting orders:", error);
        throw error;
    }
};

export const generateStructuredDischargeSummary = async (patient: Patient): Promise<Omit<DischargeSummary, 'id' | 'patientId' | 'doctorId' | 'status' | 'generatedAt'>> => {
    const context = `
        Patient: ${patient.name}, ${patient.age}, ${patient.gender}
        Chief Complaint: ${patient.chiefComplaints?.map(c => `${c.complaint} (${c.durationValue} ${c.durationUnit})`).join(', ') || 'None'}
        
        History & Exam:
        ${JSON.stringify(patient.clinicalFile)}
        
        Hospital Course (Rounds):
        ${patient.rounds.map(r => `[${new Date(r.createdAt).toLocaleDateString()}] ${r.assessment} - ${r.plan.text}`).join('\n')}
        
        Results:
        ${patient.results.map(r => `${r.name}: ${r.value} ${r.unit}`).join(', ')}
        
        Treatments Given:
        ${patient.orders.filter(o => o.status === 'completed' && o.category === 'medication').map(o => o.label).join(', ')}

        Active Medications:
        ${patient.orders.filter(o => (o.status === 'in_progress' || o.status === 'sent') && o.category === 'medication').map(o => `${o.label} ${o.instructions || ''}`).join(', ')}
    `;

    // Mock for local/test mode
    if (localStorage.getItem('medflow_force_local') === 'true' || import.meta.env.VITE_TEST_MODE === 'true') {
        return {
            finalDiagnosis: 'Acute Appendicitis',
            briefHistory: 'Patient presented with RLQ pain, nausea, and vomiting for 2 days.',
            courseInHospital: 'Patient was admitted and started on IV fluids and antibiotics. Laparoscopic appendectomy was performed.',
            treatmentGiven: 'IV Fluids, Inj. Ceftriaxone, Inj. Metronidazole, Laparoscopic Appendectomy',
            investigationsSummary: 'USG Abdomen showed inflamed appendix. WBC count elevated.',
            conditionAtDischarge: 'Stable, afebrile, wounds clean.',
            dischargeMeds: [
                { name: 'Tab. Cefixime', dosage: '200mg', frequency: 'BD', duration: '5 days', instructions: 'After food' },
                { name: 'Tab. Paracetamol', dosage: '500mg', frequency: 'TID', duration: '3 days', instructions: 'For pain' }
            ],
            dietAdvice: 'Soft diet for 2 days, then normal diet.',
            activityAdvice: 'Avoid heavy lifting for 2 weeks.',
            followUpInstructions: 'Review in OPD after 1 week for suture removal.',
            emergencyWarnings: 'Return to ER if fever > 101F, severe pain, or vomiting persists.'
        };
    }

    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        finalDiagnosis: { type: SchemaType.STRING, description: "Primary diagnosis." },
                        briefHistory: { type: SchemaType.STRING, description: "Concise history of present illness." },
                        courseInHospital: { type: SchemaType.STRING, description: "Summary of hospital stay, treatments, and progress." },
                        treatmentGiven: { type: SchemaType.STRING, description: "Summary of key treatments administered." },
                        investigationsSummary: { type: SchemaType.STRING, description: "Key abnormal results and relevant negatives." },
                        conditionAtDischarge: { type: SchemaType.STRING, description: "e.g., Stable, Afebrile, Ambulant." },
                        dischargeMeds: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    name: { type: SchemaType.STRING },
                                    dosage: { type: SchemaType.STRING },
                                    frequency: { type: SchemaType.STRING },
                                    duration: { type: SchemaType.STRING },
                                    instructions: { type: SchemaType.STRING }
                                }
                            }
                        },
                        dietAdvice: { type: SchemaType.STRING },
                        activityAdvice: { type: SchemaType.STRING },
                        followUpInstructions: { type: SchemaType.STRING },
                        emergencyWarnings: { type: SchemaType.STRING, description: "Signs to return to ER immediately." }
                    },
                    required: ['finalDiagnosis', 'briefHistory', 'courseInHospital', 'treatmentGiven', 'investigationsSummary', 'conditionAtDischarge', 'dischargeMeds', 'dietAdvice', 'activityAdvice', 'followUpInstructions', 'emergencyWarnings']
                }
            }
        });

        const result = await model.generateContent(`You are generating a formal Discharge Summary for MedFlow Hospital in Bangalore, India.
            CRITICAL INSTRUCTIONS:
            1. Use strictly Indian English spellings (e.g., 'Haemoglobin', 'Oedema', 'Paracetamol').
            2. REMOVE all American references. Use 'Casualty' instead of 'ER', 'Paracetamol' instead of 'Tylenol/Acetaminophen'.
            3. Ensure all generated names or addresses (if any) are Indian.
            4. Sign off as 'Dr. Harikrishnan S' if a name is required in the text.
            5. IMPORTANT: RETURN VALID JSON ONLY. NO MARKDOWN.
            
            Based on the clinical data, populate the following structured fields. 
            For 'dischargeMeds', suggest a list of medications available in India.
            For 'finalDiagnosis', suggest the most specific ICD-10 compatible diagnosis string.
            
            \n\nPatient Clinical Data:\n${context}`);

        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error generating structured discharge summary:", error);
        throw error;
    }
};

export const compileDischargeSummary = async (patient: Patient): Promise<string> => {
    const structured = await generateStructuredDischargeSummary(patient);
    return JSON.stringify(structured);
};

export const getFollowUpQuestions = async (section: string, seedText: string): Promise<FollowUpQuestion[]> => {
    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        questions: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    id: { type: SchemaType.STRING, description: "A unique ID for the question, e.g., 'q1'." },
                                    text: { type: SchemaType.STRING, description: "The follow-up question." },
                                    answer_type: { type: SchemaType.STRING, enum: ['text', 'options'] },
                                    quick_options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Optional suggested single-word answers." },
                                    rationale: { type: SchemaType.STRING, description: "Rationale for why this question is important." }
                                },
                                required: ['id', 'text', 'answer_type', 'rationale']
                            }
                        }
                    },
                    required: ['questions']
                }
            }
        });

        const result = await model.generateContent(`You are a clinical history-taking AI. For the "${section}" section, a clinician has provided the following seed information: "${seedText}". Generate 2 to 4 targeted follow-up questions to gather more details. For each question, suggest an answer type ('text' for free-form, 'options' for multiple choice), provide quick option choices if applicable, and include a brief rationale for why the question is clinically relevant.`);
        const data = JSON.parse(result.response.text());
        return data.questions || [];
    } catch (error) {
        console.error(`Error getting follow-up questions for ${section}:`, error);
        throw error;
    }
};

export const composeHistoryParagraph = async (section: string, seedText: string, answers: Record<string, string>): Promise<ComposedHistory> => {
    const qaText = Object.entries(answers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n');
    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        paragraph: { type: SchemaType.STRING, description: "The composed paragraph for the history section." }
                    },
                    required: ['paragraph']
                }
            }
        });

        const result = await model.generateContent(`You are a clinical documentation assistant. A clinician is documenting the "${section}" section. Based on their initial seed phrase and the follow-up Q&A, compose a concise, professional paragraph for the medical record. \n\nSeed: "${seedText}"\n\nQ&A:\n${qaText}`);
        const data = JSON.parse(result.response.text());
        return data || { paragraph: "Could not generate summary." };
    } catch (error) {
        console.error(`Error composing history for ${section}:`, error);
        return { paragraph: `Based on the initial report of "${seedText}", the following was noted: ${Object.values(answers).join('. ')}.` };
    }
};

export const summarizeChangesSinceLastRound = async (lastRoundAt: string, patient: Patient): Promise<{ summary: string; highlights: string[] }> => {
    const context = `
        Summarize changes since the last round at ${new Date(lastRoundAt).toLocaleString()}.
        Current Vitals: ${JSON.stringify(patient.vitals)}
        New Orders: ${patient.orders.filter(o => new Date(o.createdAt) > new Date(lastRoundAt)).map(o => o.label).join(', ') || 'None'}
    `;
    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING },
                        highlights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    },
                    required: ['summary', 'highlights'],
                },
            }
        });

        const result = await model.generateContent(`Generate a 1-line summary and a short list of highlights (e.g., "New CXR report", "Hb ↑") based on the following patient data changes. \n\n${context}`);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error summarizing changes:", error);
        return { summary: "Failed to generate summary.", highlights: ["API error"] };
    }
};

export const generateSOAPForRound = async (patient: Patient): Promise<Partial<Round>> => {
    const context = `
        Patient Clinical File: ${JSON.stringify(patient.clinicalFile)}
        Latest Vitals: ${JSON.stringify(patient.vitals)}
        Active Orders: ${patient.orders.filter(o => o.status === 'sent' || o.status === 'in_progress').map(o => o.label).join(', ')}
        Previous Round: ${JSON.stringify(patient.rounds.find(r => r.status === 'signed'))}
    `;
    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        subjective: { type: SchemaType.STRING },
                        objective: { type: SchemaType.STRING },
                        assessment: { type: SchemaType.STRING },
                        plan: {
                            type: SchemaType.OBJECT,
                            properties: {
                                text: { type: SchemaType.STRING }
                            }
                        },
                    },
                    required: ['subjective', 'objective', 'assessment', 'plan'],
                },
            }
        });

        const result = await model.generateContent(`Generate a draft SOAP note for a new clinical round based on the provided patient context. \n\n${context}`);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error generating SOAP for round:", error);
        throw error;
    }
};

export const crossCheckRound = async (patient: Patient, roundDraft: Round): Promise<{ contradictions: string[]; missingFollowups: string[] }> => {
    const context = `
        Patient History: ${JSON.stringify(patient.clinicalFile)}
        Draft Round Note: ${JSON.stringify(roundDraft)}
    `;
    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        contradictions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                        missingFollowups: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    },
                    required: ['contradictions', 'missingFollowups'],
                },
            }
        });

        const result = await model.generateContent(`Cross-check the draft round note against the patient's history and GPE. Identify any direct contradictions or clear missing follow-ups. If none, return empty arrays. \n\n${context}`);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error cross-checking round:", error);
        return { contradictions: ["AI check failed. Please review manually."], missingFollowups: [] };
    }
};

export const summarizeVitals = async (vitalsHistory: VitalsRecord[]): Promise<{ summary: string }> => {
    const formattedHistory = vitalsHistory.slice(0, 10).map(v =>
        `At ${new Date(v.recordedAt).toLocaleTimeString()}: ` +
        Object.entries(v.measurements).map(([key, value]) => `${key.replace('_', ' ')}: ${value}`).join(', ')
    ).join('\n');

    const context = `Summarize the following recent vitals trend for a clinical handover note. Focus on stability, significant changes, and any abnormal readings. \n\n${formattedHistory}`;

    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING, description: "A concise summary of the vitals trend." },
                    },
                    required: ['summary'],
                },
            }
        });

        const result = await model.generateContent(context);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error summarizing vitals:", error);
        return { summary: "Failed to generate AI summary." };
    }
};

export const generateHandoverSummary = async (patient: Patient): Promise<string> => {
    const context = `
        Patient: ${patient.name}, ${patient.age}, ${patient.gender}, ID: ${patient.id}
        Diagnosis/Problem: ${patient.chiefComplaints?.map(c => c.complaint).join(', ')}
        
        Recent Rounds: ${patient.rounds.slice(0, 2).map(r => r.assessment + ' - ' + r.plan.text).join('; ')}
        Current Vitals: ${JSON.stringify(patient.vitals)}
        Active Treatments: ${patient.orders.filter(o => o.status === 'in_progress' || o.status === 'sent').map(o => o.label).join(', ')}
        Recent Investigations: ${patient.results.slice(0, 3).map(r => r.name + ' (' + r.value + ')').join(', ')}
    `;

    try {
        const model = ai.getGenerativeModel({ model: proModel });
        const result = await model.generateContent(`Generate a structured ISBAR handover summary for the incoming doctor.
            Structure:
            1. Identification (Patient details)
            2. Situation (Current problem/diagnosis)
            3. Background (Brief history & complications if any)
            4. Assessment (Current status, stable/unstable, key results)
            5. Recommendation (To-do list for next shift)

            Keep it professional, concise, and bulleted.
            \n\nData: ${context}`);
        return result.response.text();
    } catch (error) {
        console.error("Error generating handover:", error);
        return "Failed to generate handover summary.";
    }
};


export const scanForMissingInfo = async (section: string, currentData: any): Promise<string[]> => {
    const context = JSON.stringify(currentData);
    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        missing_items: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                    },
                    required: ['missing_items']
                }
            }
        });

        const result = await model.generateContent(`Analyze the following "${section}" section of a clinical file. Identify critical missing information that is standard for a complete medical record. Return a list of missing items. If nothing critical is missing, return an empty list. \n\nData: ${context}`);
        const data = JSON.parse(result.response.text());
        return data.missing_items || [];
    } catch (error) {
        console.error("Error scanning for missing info:", error);
        return [];
    }
};

export const summarizeSection = async (section: string, currentData: any): Promise<string> => {
    const context = JSON.stringify(currentData);
    try {
        const model = ai.getGenerativeModel({ model: proModel });
        const result = await model.generateContent(`Summarize the findings of the "${section}" section into a concise, professional clinical paragraph. \n\nData: ${context}`);
        return result.response.text();
    } catch (error) {
        console.error("Error summarizing section:", error);
        return "Failed to generate summary.";
    }
};

export const generateClinicalFileFromTranscript = async (transcript: string): Promise<Partial<ClinicalFile>> => {
    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        hopi: { type: SchemaType.STRING },
                        pmh: { type: SchemaType.STRING },
                        dh: { type: SchemaType.STRING },
                        sh: { type: SchemaType.STRING },
                        allergies: { type: SchemaType.STRING },
                        gpe: { type: SchemaType.STRING },
                        systemic: {
                            type: SchemaType.OBJECT,
                            properties: {
                                cardiovascular: { type: SchemaType.STRING },
                                respiratory: { type: SchemaType.STRING },
                                cns: { type: SchemaType.STRING },
                                gastrointestinal: { type: SchemaType.STRING },
                                renal: { type: SchemaType.STRING }
                            },
                            required: ['cardiovascular', 'respiratory', 'cns', 'gastrointestinal', 'renal']
                        },
                        provisionalDiagnosis: { type: SchemaType.STRING },
                        plan: { type: SchemaType.STRING }
                    },
                    required: ['hopi', 'pmh', 'dh', 'sh', 'allergies', 'gpe', 'systemic', 'provisionalDiagnosis', 'plan']
                }
            }
        });

        const result = await model.generateContent(`You are a medical scribe AI. Convert the following transcript into a structured clinical file.
            Transcript: "${transcript}"
            
            Extract the following sections:
            - HOPI (History of Present Illness)
            - PMH (Past Medical History)
            - DH (Drug History)
            - SH (Social History)
            - Allergies
            - GPE (General Physical Exam)
            - Systemic Exam (Cardiovascular, Respiratory, CNS, Gastrointestinal, Renal)
            - Provisional Diagnosis
            - Plan
            
            Return a JSON object matching the ClinicalFile structure.`);

        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error generating clinical file from transcript:", error);
        throw error;
    }
};

export const crossCheckClinicalFile = async (clinicalFile: ClinicalFile): Promise<Inconsistency[]> => {
    const context = JSON.stringify(clinicalFile);
    try {
        const model = ai.getGenerativeModel({
            model: proModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        inconsistencies: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    section: { type: SchemaType.STRING },
                                    problem: { type: SchemaType.STRING },
                                    severity: { type: SchemaType.STRING, enum: ['major', 'minor'] },
                                    suggested_fix: { type: SchemaType.STRING }
                                },
                                required: ['section', 'problem', 'severity', 'suggested_fix']
                            }
                        }
                    },
                    required: ['inconsistencies']
                }
            }
        });

        const result = await model.generateContent(`Review the entire clinical file for internal inconsistencies. Return a list of specific inconsistencies found.
            For each inconsistency, provide:
            - section: Where the error is located.
            - problem: Description of the contradiction.
            - severity: 'major' or 'minor'.
            - suggested_fix: How to resolve it.
            
            File: ${context}`);

        const data = JSON.parse(result.response.text());
        return data.inconsistencies || [];
    } catch (error) {
        console.error("Error cross-checking file:", error);
        return [];
    }
};

export const checkOrderSafety = async (newOrder: Order, patient: Patient): Promise<{ safe: boolean; warning?: string }> => {
    const context = `
        Patient: ${patient.name}, Age: ${patient.age}
        Allergies: ${patient.clinicalFile.allergies || 'None'}
        Active Meds: ${patient.orders.filter(o => o.category === 'medication' && (o.status === 'in_progress' || o.status === 'sent')).map(o => o.label).join(', ')}
        Conditions: ${patient.clinicalFile.pmh || 'None'}
        New Order: ${newOrder.label} (${newOrder.category})
    `;

    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        safe: { type: SchemaType.BOOLEAN },
                        warning: { type: SchemaType.STRING }
                    },
                    required: ['safe']
                }
            }
        });

        const result = await model.generateContent(`Analyze if the new order is safe for this patient. Check for drug-drug interactions, allergy contraindications, or condition contraindications.
            Return JSON: { "safe": boolean, "warning": string (if unsafe, explain why briefly) }
            
            Context: ${context}`);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error checking order safety:", error);
        return { safe: true };
    }
};

export const cleanAndStructureClinicalText = async (text: string, sectionName: string): Promise<{ clean_text: string, inconsistencies: string[] }> => {
    try {
        const model = ai.getGenerativeModel({
            model: flashModel,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        clean_text: { type: SchemaType.STRING },
                        inconsistencies: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                    },
                    required: ['clean_text', 'inconsistencies']
                }
            }
        });

        const result = await model.generateContent(`You are a clinical documentation assistant. Clean and structure the following text for the "${sectionName}" section of a medical record.
            Also identify any potential inconsistencies within the text or logical contradictions.
            
            Text: "${text}"
            
            Return JSON:
            {
                "clean_text": "string (formatted, professional medical text)",
                "inconsistencies": ["string (list of potential inconsistencies found, if any)"]
            }`);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error cleaning text:", error);
        return { clean_text: text, inconsistencies: [] };
    }
};
