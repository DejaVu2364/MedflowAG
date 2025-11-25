
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const MOCK_DOCTOR = { id: 'user-doc-1', name: 'Dr. Harikrishnan S', email: 'doctor@medflow.ai', role: 'Doctor' };
const MOCK_INTERN = { id: 'user-int-1', name: 'Dr. Rohan Joshi', email: 'intern@medflow.ai', role: 'Intern' };

const INITIAL_PATIENTS = [
    { name: 'Aarav Sharma', age: 45, gender: 'Male', phone: '555-0101', complaint: 'Severe chest pain and shortness of breath' },
    { name: 'Diya Patel', age: 32, gender: 'Female', phone: '555-0102', complaint: 'Fever, cough, and body aches for 3 days' },
    { name: 'Vihaan Singh', age: 28, gender: 'Male', phone: '555-0103', complaint: 'Fell off a ladder, arm is deformed and painful' },
    { name: 'Ananya Gupta', age: 68, gender: 'Female', phone: '555-0104', complaint: 'Sudden sharp pain in the lower abdomen' },
    { name: 'Ishaan Kumar', age: 29, gender: 'Female', phone: '555-0105', complaint: 'Routine pregnancy check-up, feeling well' },
    { name: 'Saanvi Reddy', age: 55, gender: 'Male', phone: '555-0106', complaint: 'Headache and dizziness after a fall' },
    { name: 'Advait Joshi', age: 72, gender: 'Female', phone: '555-0107', complaint: 'Worsening confusion and memory loss noted by family' },
];

const PRECOMPUTED_AI_TRIAGE = [
    { department: 'Cardiology', suggested_triage: 'Red', confidence: 0.9, fromCache: true },
    { department: 'General Medicine', suggested_triage: 'Yellow', confidence: 0.85, fromCache: true },
    { department: 'Orthopedics', suggested_triage: 'Red', confidence: 0.95, fromCache: true },
    { department: 'Emergency', suggested_triage: 'Yellow', confidence: 0.8, fromCache: true },
    { department: 'Obstetrics', suggested_triage: 'Green', confidence: 0.98, fromCache: true },
    { department: 'Neurology', suggested_triage: 'Yellow', confidence: 0.8, fromCache: true },
    { department: 'Neurology', suggested_triage: 'Yellow', confidence: 0.75, fromCache: true },
];

const MOCK_NOTES = [
    { author: MOCK_INTERN, content: 'Patient reports feeling slightly better. Vitals stable overnight. Continuing current medication.' },
    { author: MOCK_INTERN, content: 'New rash observed on the patient\'s back. Ordering a dermatology consult. Patient is anxious.', isEscalation: true },
    { author: MOCK_DOCTOR, content: 'Consulted with dermatology. Likely a non-serious allergic reaction. Will monitor.' },
];

const MOCK_SOAP = {
    s: 'Patient states chest pain is at a 3/10, improved from 8/10 on admission.',
    o: 'Vitals: HR 78, BP 122/80, RR 16, SpO2 98%. EKG shows normal sinus rhythm.',
    a: 'Acute coronary syndrome, likely unstable angina. Responding well to initial treatment.',
    p: 'Continue nitrates and beta-blockers. Serial troponins. Plan for cardiac catheterization in the morning.'
};

function sanitize(obj) {
    return JSON.parse(JSON.stringify(obj));
}

async function seed() {
    console.log('Starting seed...');
    const batch = db.batch();

    for (let index = 0; index < INITIAL_PATIENTS.length; index++) {
        const p = INITIAL_PATIENTS[index];
        const id = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const aiTriageWithCache = PRECOMPUTED_AI_TRIAGE[index];
        const mockNoteData = MOCK_NOTES[Math.floor(Math.random() * MOCK_NOTES.length)];

        const timeline = [
            {
                type: 'SOAP',
                id: `SOAP-${id}-1`,
                patientId: id,
                ...MOCK_SOAP,
                author: MOCK_DOCTOR.name,
                authorId: MOCK_DOCTOR.id,
                role: MOCK_DOCTOR.role,
                timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            },
            {
                type: 'TeamNote',
                id: `NOTE-${id}-1`,
                patientId: id,
                content: mockNoteData.content,
                isEscalation: mockNoteData.isEscalation || false,
                author: mockNoteData.author.name,
                authorId: mockNoteData.author.id,
                role: mockNoteData.author.role,
                timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            },
        ];

        let patient = {
            ...p,
            id,
            status: 'Waiting for Triage',
            registrationTime: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
            triage: { level: 'None', reasons: [] },
            aiTriage: aiTriageWithCache,
            timeline,
            clinicalFile: {
                id: `CF-${id}`,
                patientId: id,
                status: 'draft',
                aiSuggestions: {},
                sections: {
                    history: {
                        chief_complaint: p.complaint,
                        duration: '3 days',
                        hpi: 'Patient presents with a 3-day history of symptoms.',
                        associated_symptoms: [],
                        allergy_history: [],
                        review_of_systems: {}
                    },
                    gpe: {
                        flags: { pallor: false, icterus: false, cyanosis: false, clubbing: false, lymphadenopathy: false, edema: false }
                    },
                    systemic: {}
                }
            },
            orders: [],
            results: [],
            rounds: [],
            vitalsHistory: [],
        };

        if (index === 1) {
            const vitals = { pulse: 110, bp_sys: 130, bp_dia: 85, rr: 20, spo2: 97, temp_c: 38.5 };
            patient.status = 'Waiting for Doctor';
            patient.triage = { level: 'Yellow', reasons: ['High Heart Rate (110 bpm)'] };
            patient.vitals = vitals;
            patient.vitalsHistory = [{
                vitalId: `VIT-${patient.id}-1`,
                patientId: patient.id,
                recordedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                recordedBy: MOCK_INTERN.id,
                source: 'manual',
                measurements: vitals,
            }];
        }

        if (index === 3) {
            const vitals = { pulse: 120, bp_sys: 100, bp_dia: 60, rr: 26, spo2: 88, temp_c: 37.0 };
            patient.status = 'In Treatment';
            patient.triage = { level: 'Red', reasons: ['Low SpO2 (88%)'] };
            patient.vitals = vitals;
            patient.vitalsHistory = [{
                vitalId: `VIT-${patient.id}-1`,
                patientId: patient.id,
                recordedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                recordedBy: MOCK_DOCTOR.id,
                source: 'manual',
                measurements: vitals
            }];
            patient.clinicalFile.sections.gpe = { ...patient.clinicalFile.sections.gpe, vitals, flags: { pallor: true, icterus: false, cyanosis: true, clubbing: false, lymphadenopathy: false, edema: false } };
        }

        patient = sanitize(patient);
        const ref = db.collection('patients').doc(id);
        batch.set(ref, patient);
    }

    await batch.commit();
    console.log('Seed completed successfully.');
}

seed().catch(console.error);
