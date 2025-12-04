
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Firebase Admin and Google Generative AI
admin.initializeApp();
const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- HELPER FUNCTIONS ---

/**
 * Ensures the user is authenticated and returns their profile.
 * @param {object} context - The functions context.
 * @returns {object} The user's profile from Firestore.
 * @throws {functions.https.HttpsError} If the user is not authenticated.
 */
const getAuthenticatedUser = async (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    return { id: userDoc.id, ...userDoc.data() };
};

/**
 * Fetches a patient's document and subcollections.
 * @param {string} patientId - The ID of the patient to fetch.
 * @returns {object} The patient's data.
 * @throws {functions.https.HttpsError} If the patient is not found.
 */
const getPatient = async (patientId) => {
    const patientDoc = await db.collection('patients').doc(patientId).get();
    if (!patientDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Patient not found.');
    }
    
    // In a real app, you'd fetch subcollections like timeline, orders, etc.
    // For this example, we'll assume they are part of the main document or not needed for the specific function.
    return { id: patientDoc.id, ...patientDoc.data() };
};

// --- DATABASE OPERATIONS ---

exports.createPatient = functions.https.onCall(async (data, context) => {
    const user = await getAuthenticatedUser(context);
    
    const patientData = {
        ...data,
        createdBy: user.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const patientRef = await db.collection('patients').add(patientData);
    
    await exports.logAuditEvent({ 
        patientId: patientRef.id, 
        action: 'create', 
        entity: 'patient',
        entityId: patientRef.id
    }, context);

    return { id: patientRef.id, ...patientData };
});

exports.logAuditEvent = functions.https.onCall(async (data, context) => {
    const user = await getAuthenticatedUser(context);
    const { patientId, action, entity, entityId, payload } = data;

    if (!patientId || !action || !entity) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required audit log fields.');
    }

    const logEntry = {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        patientId,
        action,
        entity,
        entityId,
        payload: payload || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('auditEvents').add(logEntry);
    return { success: true };
});


// --- AI-POWERED ANALYSIS ---

exports.generateFollowUpQuestions = functions.https.onCall(async (data, context) => {
    await getAuthenticatedUser(context); // Authentication check
    const { seedText } = data;
    if (!seedText) {
        throw new functions.https.HttpsError('invalid-argument', 'seedText is required.');
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Based on the following triage information, generate 3-5 critical follow-up questions to ask the patient to clarify their condition. Present these as a JSON array of strings. Triage Info: "${seedText}"`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(text); // Assuming the model returns a valid JSON string array
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to generate follow-up questions from AI.');
    }
});

exports.summarizeVitals = functions.https.onCall(async (data, context) => {
    await getAuthenticatedUser(context);
    const { vitalsHistory } = data; // Expecting an array of vitals records

    if (!vitalsHistory || !Array.isArray(vitalsHistory) || vitalsHistory.length < 2) {
         throw new functions.https.HttpsError('invalid-argument', 'A valid array of at least two vitals records is required.');
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Summarize the key trends, abnormalities, and concerns from the following patient vital signs history. The history is ordered from most to least recent. History: ${JSON.stringify(vitalsHistory, null, 2)}`;
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { summary: response.text() };
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to generate vitals summary from AI.');
    }
});


exports.compileDischargeSummary = functions.https.onCall(async (data, context) => {
    await getAuthenticatedUser(context);
    const patient = await getPatient(data.patientId);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Generate a comprehensive medical discharge summary for the following patient. Structure it with sections for 'Condition on Admission', 'Hospital Course', 'Condition on Discharge', and 'Discharge Plan'. Patient Data: ${JSON.stringify(patient, null, 2)}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { summary: response.text() };
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to generate discharge summary from AI.');
    }
});

exports.crossCheckRound = functions.https.onCall(async (data, context) => {
    await getAuthenticatedUser(context);
    const { patientId, round } = data;
    if (!round) {
        throw new functions.https.HttpsError('invalid-argument', 'Round object is required.');
    }
    const patient = await getPatient(patientId);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Cross-check the following doctor's round notes for inconsistencies or contradictions against the patient's known data. List any identified issues as a JSON array of strings. If none, return an empty array. 
    
    Doctor's Round: ${JSON.stringify(round, null, 2)}
    
    Patient's Full Record: ${JSON.stringify(patient, null, 2)}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const contradictions = JSON.parse(response.text());
        return { contradictions };
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to perform AI cross-check.');
    }
});

exports.answerWithRAG = functions.https.onCall(async (data, context) => {
    await getAuthenticatedUser(context);
    const { message, context: queryContext } = data;

    if (!message) {
        throw new functions.https.HttpsError('invalid-argument', 'A user message is required.');
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `You are a helpful AI assistant in a clinical setting. Answer the user's question based *only* on the provided context. If the answer is not in the context, say "I cannot answer that based on the provided information."
    
    Context:
    ${queryContext || "No patient context provided."}
    
    Question:
    ${message}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { response: response.text() };
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to get AI response.');
    }
});
