import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import { AppContextType, Patient, HistorySectionData, ClinicalFileSections, Allergy, GPESectionData, SystemicExamSystemData, SystemicExamSectionData, User } from '../types';
import { ChevronDownIcon, SparklesIcon, PlusIcon, XMarkIcon, CheckBadgeIcon, InformationCircleIcon } from './icons';
import TextareaAutosize from 'react-textarea-autosize';
import VoiceInput from './VoiceInput';

// --- Shared Components ---

const Card: React.FC<{ title: string; children: React.ReactNode; isOpenDefault?: boolean; className?: string }> = ({ title, children, isOpenDefault = true, className }) => {
    const [isOpen, setIsOpen] = useState(isOpenDefault);
    return (
        <div className={`border border-border-color rounded-xl bg-background-primary shadow-sm overflow-hidden ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 bg-background-secondary/30 hover:bg-background-secondary/50 transition-colors"
            >
                <h4 className="font-bold text-text-primary">{title}</h4>
                <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''} text-text-tertiary`}><ChevronDownIcon /></div>
            </button>
            {isOpen && <div className="p-4 border-t border-border-color">{children}</div>}
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; onAutoFormat?: () => void }> = ({ title, onAutoFormat }) => (
    <div className="flex justify-between items-center mb-3">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wide">{title}</label>
        {onAutoFormat && (
            <button onClick={onAutoFormat} className="text-xs flex items-center gap-1 text-brand-blue hover:text-brand-blue-dark">
                <SparklesIcon className="w-3 h-3" /> Auto-Format
            </button>
        )}
    </div>
);

// --- Sub-Sections ---

interface Complaint {
    symptom: string;
    duration: string;
    unit: string;
}

const ChiefComplaintSection: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection } = useContext(AppContext) as AppContextType;
    const history = patient.clinicalFile.sections.history || {};

    // Parse existing string into structured if possible, or start fresh
    // Storing as JSON string in the backend field for compatibility
    const [complaints, setComplaints] = useState<Complaint[]>(() => {
        try {
            return JSON.parse(history.chief_complaint || '[]');
        } catch {
            return history.chief_complaint ? [{ symptom: history.chief_complaint, duration: '', unit: '' }] : [];
        }
    });

    const [newComplaint, setNewComplaint] = useState<Complaint>({ symptom: '', duration: '', unit: 'days' });

    useEffect(() => {
        // Sync back to context as string
        if (!isSignedOff) {
             updateClinicalFileSection(patient.id, 'history', { chief_complaint: JSON.stringify(complaints) });
        }
    }, [complaints, patient.id, isSignedOff]); // Removed updateClinicalFileSection from deps to avoid loop if context unstable

    const addComplaint = () => {
        if (newComplaint.symptom) {
            setComplaints([...complaints, newComplaint]);
            setNewComplaint({ symptom: '', duration: '', unit: 'days' });
        }
    };

    const removeComplaint = (index: number) => {
        setComplaints(complaints.filter((_, i) => i !== index));
    };

    return (
        <Card title="Chief Complaints">
            <div className="space-y-4">
                {!isSignedOff && (
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-xs text-text-tertiary block mb-1">Symptom</label>
                            <input
                                type="text"
                                value={newComplaint.symptom}
                                onChange={e => setNewComplaint({...newComplaint, symptom: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && addComplaint()}
                                className="w-full p-2 border border-border-color rounded-md text-sm bg-background-primary text-input-text focus:ring-1 focus:ring-brand-blue outline-none"
                                placeholder="e.g. Chest Pain"
                            />
                        </div>
                        <div className="w-20">
                            <label className="text-xs text-text-tertiary block mb-1">Duration</label>
                            <input
                                type="number"
                                value={newComplaint.duration}
                                onChange={e => setNewComplaint({...newComplaint, duration: e.target.value})}
                                className="w-full p-2 border border-border-color rounded-md text-sm bg-background-primary text-input-text focus:ring-1 focus:ring-brand-blue outline-none"
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-xs text-text-tertiary block mb-1">Unit</label>
                            <select
                                value={newComplaint.unit}
                                onChange={e => setNewComplaint({...newComplaint, unit: e.target.value})}
                                className="w-full p-2 border border-border-color rounded-md text-sm bg-background-primary text-input-text focus:ring-1 focus:ring-brand-blue outline-none"
                            >
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="weeks">Weeks</option>
                                <option value="months">Months</option>
                            </select>
                        </div>
                        <button onClick={addComplaint} disabled={!newComplaint.symptom} className="p-2 bg-brand-blue text-white rounded-md hover:bg-brand-blue-dark disabled:opacity-50">
                            <PlusIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {complaints.length === 0 && <span className="text-sm text-text-tertiary italic">No complaints recorded.</span>}
                    {complaints.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue-light/20 border border-brand-blue-light rounded-full text-brand-blue-dark text-sm font-medium">
                            <span>{c.symptom}</span>
                            {c.duration && <span className="text-xs opacity-70">({c.duration} {c.unit})</span>}
                            {!isSignedOff && <button onClick={() => removeComplaint(i)} className="hover:text-red-500"><XMarkIcon className="w-4 h-4" /></button>}
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
});

const HOPISection: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection, formatHpi } = useContext(AppContext) as AppContextType;
    const history = patient.clinicalFile.sections.history || {};

    // We'll manage structured fields in local state effectively or append to text
    // For simplicity in this demo, let's just have text areas that update the main HPI but conceptually represent parts
    // Or we store them in a local object and serialize to HPI string.

    // Better: Only one HPI field in backend.
    // UI Split: Left (Structured Prompts - e.g. "Onset", "Duration") - these are just helpers to construct the narrative?
    // Or we assume the user types in the Right (Narrative).

    // Requirement: "Left: Structured prompts... Right: Free-text full narrative."
    // "Generated HOPI should fill both"

    // I'll make the left side inputs that *generate* text into the right side if used,
    // OR just separate fields if I can allow it.
    // Since I can't change schema easily, I'll use the left side as "Drafting Tools" that append to the right side.

    const [structured, setStructured] = useState({ onset: '', aggravating: '', relieving: '' });

    const appendToNarrative = (field: string, value: string) => {
        if (!value) return;
        const text = `\n${field.charAt(0).toUpperCase() + field.slice(1)}: ${value}.`;
        updateClinicalFileSection(patient.id, 'history', { hpi: (history.hpi || '') + text });
        setStructured(prev => ({ ...prev, [field]: '' }));
    };

    return (
        <Card title="History of Present Illness">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4 md:border-r border-border-color md:pr-6">
                    <h5 className="text-xs font-bold text-text-tertiary uppercase mb-2">Structured Prompts</h5>
                    <div>
                        <label className="text-xs text-text-secondary block mb-1">Onset / Duration</label>
                        <div className="flex gap-1">
                            <input
                                className="flex-1 p-2 border border-border-color rounded-md text-xs bg-background-primary"
                                placeholder="e.g. Sudden, 2 days ago"
                                value={structured.onset}
                                onChange={e => setStructured({...structured, onset: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && appendToNarrative('Onset', structured.onset)}
                            />
                            <button onClick={() => appendToNarrative('Onset', structured.onset)} className="text-brand-blue"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-text-secondary block mb-1">Aggravating Factors</label>
                        <div className="flex gap-1">
                            <input
                                className="flex-1 p-2 border border-border-color rounded-md text-xs bg-background-primary"
                                placeholder="e.g. Movement, Food"
                                value={structured.aggravating}
                                onChange={e => setStructured({...structured, aggravating: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && appendToNarrative('Aggravating', structured.aggravating)}
                            />
                            <button onClick={() => appendToNarrative('Aggravating Factors', structured.aggravating)} className="text-brand-blue"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-text-secondary block mb-1">Relieving Factors</label>
                        <div className="flex gap-1">
                            <input
                                className="flex-1 p-2 border border-border-color rounded-md text-xs bg-background-primary"
                                placeholder="e.g. Rest, Meds"
                                value={structured.relieving}
                                onChange={e => setStructured({...structured, relieving: e.target.value})}
                                onKeyDown={e => e.key === 'Enter' && appendToNarrative('Relieving', structured.relieving)}
                            />
                            <button onClick={() => appendToNarrative('Relieving Factors', structured.relieving)} className="text-brand-blue"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <SectionHeader title="Narrative" onAutoFormat={() => formatHpi(patient.id)} />
                    <div className="relative">
                        <TextareaAutosize
                            minRows={8}
                            value={history.hpi || ''}
                            onChange={e => updateClinicalFileSection(patient.id, 'history', { hpi: e.target.value })}
                            disabled={isSignedOff}
                            className="w-full p-4 border border-border-color rounded-lg bg-background-primary text-input-text text-sm leading-relaxed focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
                            placeholder="Full history narrative..."
                        />
                        {!isSignedOff && <div className="absolute bottom-2 right-2"><VoiceInput onTranscript={t => updateClinicalFileSection(patient.id, 'history', { hpi: (history.hpi || '') + ' ' + t })} /></div>}
                    </div>
                </div>
            </div>
        </Card>
    );
});

const GPESectionNew: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection } = useContext(AppContext) as AppContextType;
    const gpe = patient.clinicalFile.sections.gpe || {};

    // Explicit Fields for GPE: Pulse, BP, RR, Temp + General Appearance
    // We sync these with the patient.vitals if possible, or store in GPE object if they are exam findings vs monitor findings.
    // The requirement says "Built-in fields for Pulse, BP, etc." inside GPE.
    // We'll map them to `gpe.vitals` which I see in `types.ts`.

    const handleVitalChange = (key: string, val: string) => {
        updateClinicalFileSection(patient.id, 'gpe', { vitals: { ...gpe.vitals, [key]: val ? Number(val) : undefined } });
    };

    const handleFlagChange = (flag: keyof GPESectionData['flags']) => {
        updateClinicalFileSection(patient.id, 'gpe', { flags: { ...gpe.flags, [flag]: !gpe.flags?.[flag] } });
    };

    return (
        <Card title="General Physical Examination">
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-bold text-text-tertiary uppercase">Pulse (bpm)</label>
                        <input type="number" value={gpe.vitals?.pulse || ''} onChange={e => handleVitalChange('pulse', e.target.value)} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-tertiary uppercase">BP (Sys)</label>
                        <input type="number" value={gpe.vitals?.bp_sys || ''} onChange={e => handleVitalChange('bp_sys', e.target.value)} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-tertiary uppercase">BP (Dia)</label>
                        <input type="number" value={gpe.vitals?.bp_dia || ''} onChange={e => handleVitalChange('bp_dia', e.target.value)} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-tertiary uppercase">Temp (C)</label>
                        <input type="number" value={gpe.vitals?.temp_c || ''} onChange={e => handleVitalChange('temp_c', e.target.value)} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm"/>
                    </div>
                </div>

                <div className="p-4 bg-background-secondary/30 rounded-lg border border-border-color">
                    <label className="text-xs font-bold text-text-secondary uppercase mb-3 block">Signs</label>
                    <div className="flex flex-wrap gap-4">
                        {['pallor', 'icterus', 'cyanosis', 'clubbing', 'lymphadenopathy', 'edema'].map(flag => (
                            <label key={flag} className="flex items-center space-x-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={!!gpe.flags?.[flag as keyof typeof gpe.flags]}
                                    onChange={() => handleFlagChange(flag as any)}
                                    disabled={isSignedOff}
                                    className="h-4 w-4 rounded text-brand-blue border-gray-300 focus:ring-brand-blue"
                                />
                                <span className="text-sm font-medium text-text-primary capitalize">{flag.replace('_', ' ')}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-text-tertiary uppercase">Remarks / Other Findings</label>
                    <TextareaAutosize
                        minRows={2}
                        value={gpe.remarks || ''}
                        onChange={e => updateClinicalFileSection(patient.id, 'gpe', { remarks: e.target.value })}
                        className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                </div>
            </div>
        </Card>
    );
});

const SystemicExamNew: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection } = useContext(AppContext) as AppContextType;
    const systemic = patient.clinicalFile.sections.systemic || {};

    const systems: { key: keyof SystemicExamSectionData; label: string }[] = [
        { key: 'cvs', label: 'CVS' },
        { key: 'rs', label: 'RS' },
        { key: 'cns', label: 'CNS' },
        { key: 'abdomen', label: 'Abdomen' }
    ];

    return (
        <Card title="Systemic Examination">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systems.map(({ key, label }) => (
                    <div key={key} className="p-3 border border-border-color rounded-lg bg-background-primary/50">
                        <div className="flex justify-between mb-2">
                            <span className="font-bold text-sm text-text-primary">{label}</span>
                            {!isSignedOff && <VoiceInput onTranscript={t => updateClinicalFileSection(patient.id, 'systemic', { [key]: { ...systemic[key], summary: (systemic[key]?.summary || '') + ' ' + t } })} className="w-4 h-4" />}
                        </div>
                        <TextareaAutosize
                            minRows={3}
                            placeholder={`Findings for ${label}...`}
                            value={systemic[key]?.summary || ''}
                            onChange={e => updateClinicalFileSection(patient.id, 'systemic', { [key]: { ...systemic[key], summary: e.target.value } })}
                            disabled={isSignedOff}
                            className="w-full text-sm bg-transparent outline-none resize-none placeholder-text-tertiary"
                        />
                    </div>
                ))}
            </div>
        </Card>
    );
});

export const ClinicalFileView: React.FC<{ patient: Patient; user: any }> = ({ patient, user }) => {
    const isSignedOff = patient.clinicalFile.status === 'signed';

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-border-color">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Clinical File</h2>
                    <p className="text-xs text-text-tertiary mt-1">Last updated at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
            </div>

            <ChiefComplaintSection patient={patient} isSignedOff={isSignedOff} />
            <HOPISection patient={patient} isSignedOff={isSignedOff} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GPESectionNew patient={patient} isSignedOff={isSignedOff} />
                <SystemicExamNew patient={patient} isSignedOff={isSignedOff} />
            </div>

            <SummarySignoffSection patient={patient} user={user} />
        </div>
    );
};

const SummarySignoffSection: React.FC<{ patient: Patient; user: User }> = React.memo(({ patient, user }) => {
    const { signOffClinicalFile, summarizePatientClinicalFile, crossCheckFile, isLoading } = useContext(AppContext) as AppContextType;
    useEffect(() => { if (!patient.clinicalFile.aiSummary) summarizePatientClinicalFile(patient.id); }, [patient.id, patient.clinicalFile.aiSummary, summarizePatientClinicalFile]);

    const handleSignOff = async () => {
        await crossCheckFile(patient.id);
    };
     useEffect(() => {
        const inconsistencies = patient.clinicalFile.crossCheckInconsistencies;
        if (Array.isArray(inconsistencies) && (inconsistencies as string[]).length > 0) {
            if (window.confirm(`AI Cross-Check Issues:\n- ${(inconsistencies as string[]).join('\n- ')}\nProceed?`)) signOffClinicalFile(patient.id);
        } else if (Array.isArray(inconsistencies)) {
            signOffClinicalFile(patient.id);
        }
    }, [patient.clinicalFile.crossCheckInconsistencies, signOffClinicalFile]);

    if (patient.clinicalFile.status === 'signed') {
         return (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 px-4 py-6 rounded-xl mt-6 justify-center shadow-sm">
                <CheckBadgeIcon /> <span className="font-semibold">Signed Off by {patient.clinicalFile.signedBy === user.id ? 'you' : 'Doctor'} on {new Date(patient.clinicalFile.signedAt || '').toLocaleDateString()}</span>
            </div>
        );
    }
    return (
        <div className="mt-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-border-color">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-lg text-text-primary">Assessment & Plan Summary</h4>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    <SparklesIcon className="w-3 h-3" />
                    AI-generated — verify before finalizing
                </div>
            </div>

            <div className="p-4 bg-background-primary rounded-lg border border-border-color shadow-sm mb-4 italic text-text-secondary leading-relaxed">
                {patient.clinicalFile.aiSummary || <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"></div> Generating summary...</span>}
            </div>

            {/* Structured Inconsistency Display */}
            {patient.clinicalFile.crossCheckInconsistencies && patient.clinicalFile.crossCheckInconsistencies.length > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h5 className="flex items-center gap-2 text-yellow-800 font-bold text-sm mb-2">
                        <InformationCircleIcon className="w-4 h-4" /> AI Consistency Check
                    </h5>
                    <ul className="list-disc pl-5 space-y-1">
                        {patient.clinicalFile.crossCheckInconsistencies.map((inc, i) => (
                            <li key={i} className="text-xs text-yellow-900">{inc}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex justify-end">
                <button onClick={handleSignOff} disabled={isLoading || user.role !== 'Doctor'} className="px-8 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 shadow-lg shadow-green-600/20 transition-all">
                    {isLoading ? 'Verifying...' : 'Sign Off Case'}
                </button>
            </div>
        </div>
    );
});
