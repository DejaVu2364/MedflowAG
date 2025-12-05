
import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from '../App';
import { AppContextType, Patient, User, TriageLevel, Order, Vitals, OrderStatus, OrderCategory, ClinicalFileSections, Allergy, HistorySectionData, GPESectionData, SystemicExamSectionData, SystemicExamSystemData, AISuggestionHistory, OrderPriority, Round, Result, VitalsRecord, VitalsMeasurements, PatientStatus } from '../types';
import { SparklesIcon, CheckBadgeIcon, InformationCircleIcon, DocumentDuplicateIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon, EllipsisVerticalIcon, PaperAirplaneIcon, PencilIcon, BeakerIcon, FilmIcon, PillIcon, ClipboardDocumentListIcon, UserCircleIcon, SearchIcon, PlusIcon } from '../components/icons';
import TextareaAutosize from 'react-textarea-autosize';
import { generateSOAPForRound, summarizeChangesSinceLastRound, compileDischargeSummary } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import VoiceInput from '../components/VoiceInput';
import { ClinicalFileView } from '../components/ClinicalFile';

// --- STYLED COMPONENTS & HELPERS ---

const TriageBadge: React.FC<{ level: TriageLevel }> = React.memo(({ level }) => {
    const levelStyles: Record<TriageLevel, string> = {
        Red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        Yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        Green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        None: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-full ${levelStyles[level]}`}>{level}</span>;
});

const PatientWorkspaceHeader: React.FC<{ patient: Patient }> = React.memo(({ patient }) => {
    const { updatePatientStatus, currentUser } = useContext(AppContext) as AppContextType;
    const vitals = patient.vitals;

    const VitalsChip: React.FC<{ label: string, value?: number | string | null, unit: string, isAbnormal?: boolean }> = React.memo(({ label, value, unit, isAbnormal }) => (
        <div className={`flex flex-col items-center justify-center p-2 rounded-lg border ${isAbnormal ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-background-primary border-border-color'}`}>
            <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider">{label}</span>
            <span className={`text-lg font-bold ${isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-text-primary'}`}>
                {value || '--'}<span className="text-xs font-normal text-text-tertiary ml-0.5">{unit}</span>
            </span>
        </div>
    ));

    return (
        <div className="bg-background-primary border-b border-border-color sticky top-16 z-30 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-blue/30">
                            {patient.name.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-text-primary">{patient.name}</h2>
                                <TriageBadge level={patient.triage.level} />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                                <span>{patient.age}y</span>
                                <span>&bull;</span>
                                <span>{patient.gender}</span>
                                <span>&bull;</span>
                                <span className="font-mono text-text-tertiary">ID: {patient.id}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                         {/* Vitals Ribbon */}
                        <div className="flex gap-2">
                             <VitalsChip label="HR" value={vitals?.pulse} unit="bpm" isAbnormal={(vitals?.pulse || 0) > 100} />
                             <VitalsChip label="BP" value={vitals?.bp_sys ? `${vitals.bp_sys}/${vitals?.bp_dia}` : null} unit="" isAbnormal={(vitals?.bp_sys || 0) < 90} />
                             <VitalsChip label="SpO2" value={vitals?.spo2} unit="%" isAbnormal={(vitals?.spo2 || 100) < 95} />
                        </div>
                        
                        <div className="h-8 w-px bg-border-color mx-2 hidden lg:block"></div>

                        <select 
                            value={patient.status} 
                            onChange={(e) => updatePatientStatus(patient.id, e.target.value as PatientStatus)}
                            className="px-3 py-2 bg-background-secondary border border-border-color rounded-lg text-sm font-medium text-text-primary focus:ring-2 focus:ring-brand-blue outline-none transition-shadow"
                            disabled={currentUser?.role !== 'Doctor' && currentUser?.role !== 'Admin'}
                        >
                            <option value="Waiting for Triage">Waiting for Triage</option>
                            <option value="Waiting for Doctor">Waiting for Doctor</option>
                            <option value="In Treatment">In Treatment</option>
                            <option value="Discharged">Discharged</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
});

const Accordion: React.FC<{ title: string, children: React.ReactNode, isOpenDefault?: boolean, status?: 'green' | 'yellow' | 'red' }> = React.memo(({ title, children, isOpenDefault = false, status }) => {
    const [isOpen, setIsOpen] = useState(isOpenDefault);
    return (
        <div className="border border-border-color rounded-xl overflow-hidden bg-background-primary shadow-sm mb-4 transition-all duration-200 hover:shadow-md">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 bg-background-primary hover:bg-background-secondary/50 focus:outline-none transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-1 h-6 rounded-full ${status === 'green' ? 'bg-green-500' : status === 'red' ? 'bg-red-500' : status === 'yellow' ? 'bg-yellow-500' : 'bg-brand-blue'}`}></div>
                    <h4 className="text-base font-bold text-text-primary">{title}</h4>
                </div>
                <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} text-text-tertiary`}>
                    <ChevronDownIcon />
                </div>
            </button>
            {isOpen && <div className="p-5 border-t border-border-color bg-background-secondary/10 animate-fade-in">{children}</div>}
        </div>
    );
});

const AIActionButton: React.FC<{ onClick: () => void, text: string, isLoading?: boolean }> = React.memo(({ onClick, text, isLoading }) => (
    <button onClick={onClick} disabled={isLoading} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800">
        {isLoading ? <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div> : <SparklesIcon />} {text}
    </button>
));

const TagsInput: React.FC<{ tags: string[]; onTagsChange: (tags: string[]) => void; disabled: boolean }> = React.memo(({ tags, onTagsChange, disabled }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newTag = inputValue.trim();
            if (newTag && !tags.includes(newTag)) {
                onTagsChange([...tags, newTag]);
            }
            setInputValue('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        onTagsChange(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className={`w-full flex flex-wrap items-center gap-2 p-2 border border-border-color rounded-lg bg-background-primary transition-shadow focus-within:ring-2 focus-within:ring-brand-blue/20 focus-within:border-brand-blue ${disabled ? 'opacity-70' : ''}`}>
            {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-brand-blue-light text-brand-blue-dark text-xs font-semibold px-2 py-1 rounded-md">
                    {tag}
                    {!disabled && <button onClick={() => removeTag(tag)} className="hover:text-red-500 ml-1">&times;</button>}
                </span>
            ))}
            <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="flex-grow bg-transparent focus:outline-none text-sm text-input-text min-w-[120px]"
                placeholder={tags.length === 0 ? "Type symptoms and press Enter..." : ""}
            />
        </div>
    );
});

// --- CLINICAL FILE SUB-SECTIONS ---

const AIAssistedTextarea: React.FC<{
    patient: Patient;
    fieldKey: keyof HistorySectionData;
    label: string;
    isSignedOff: boolean;
    minRows?: number;
}> = React.memo(({ patient, fieldKey, label, isSignedOff, minRows = 2 }) => {
    const { updateClinicalFileSection, getFollowUpQuestions, updateFollowUpAnswer, composeHistoryWithAI } = useContext(AppContext) as AppContextType;
    const [isLoading, setIsLoading] = useState(false);
    
    const history = patient.clinicalFile.sections.history || {};
    const currentValue = (history[fieldKey] as string) || '';

    const suggestions = patient.clinicalFile.aiSuggestions?.history;
    const questions = suggestions?.followUpQuestions?.[fieldKey];
    const answers = suggestions?.followUpAnswers?.[fieldKey] || {};

    const handleChange = (value: string) => {
        updateClinicalFileSection(patient.id, 'history', { [fieldKey]: value });
    };

    const handleVoiceTranscript = (text: string) => {
        handleChange(currentValue ? `${currentValue} ${text}` : text);
    };

    const handleSuggest = async () => {
        setIsLoading(true);
        await getFollowUpQuestions(patient.id, 'history', fieldKey, currentValue);
        setIsLoading(false);
    };

    const handleCompose = async () => {
        setIsLoading(true);
        await composeHistoryWithAI(patient.id, 'history', fieldKey);
        setIsLoading(false);
    };

    return (
        <div className="group">
            <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wide group-focus-within:text-brand-blue transition-colors">{label}</label>
                {!isSignedOff && <VoiceInput onTranscript={handleVoiceTranscript} className="w-5 h-5 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <div className={`relative border rounded-lg overflow-hidden transition-all duration-200 ${questions ? 'border-brand-blue ring-1 ring-brand-blue/20' : 'border-border-color focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/10'}`}>
                <TextareaAutosize
                    minRows={minRows}
                    value={currentValue}
                    onChange={e => handleChange(e.target.value)}
                    disabled={isSignedOff}
                    placeholder="Click to type or dictate..."
                    className={`w-full p-3 text-sm bg-background-primary text-input-text resize-none outline-none ${patient.clinicalFile.aiSuggestions?.history ? 'bg-indigo-50/30' : ''}`}
                />
                 {!isSignedOff && currentValue.trim().length > 5 && !questions && (
                     <div className="absolute bottom-2 right-2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                         <AIActionButton onClick={handleSuggest} text="AI Follow-up" isLoading={isLoading} />
                     </div>
                 )}
            </div>
             {!isSignedOff && questions && (
                <div className="mt-2 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-slide-down">
                    <div className="flex justify-between items-center mb-3">
                         <h5 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase flex items-center gap-1"><SparklesIcon /> AI Interview Mode</h5>
                         <AIActionButton onClick={handleCompose} text="Finish & Compose" isLoading={isLoading} />
                    </div>
                    <div className="space-y-3">
                        {questions.map(q => (
                            <div key={q.id} className="text-sm">
                                <p className="font-medium text-text-primary mb-1">{q.text}</p>
                                {q.answer_type === 'options' && q.quick_options ? (
                                    <div className="flex flex-wrap gap-2">
                                        {q.quick_options.map(opt => (
                                            <button key={opt} onClick={() => updateFollowUpAnswer(patient.id, fieldKey, q.id, opt)} className={`px-3 py-1 text-xs rounded-full border transition-all ${answers[q.id] === opt ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-text-secondary border-gray-200 hover:border-brand-blue'}`}>{opt}</button>
                                        ))}
                                    </div>
                                ) : (
                                     <div className="flex gap-2">
                                        <input type="text" onBlur={(e) => updateFollowUpAnswer(patient.id, fieldKey, q.id, e.target.value)} defaultValue={answers[q.id] || ''} placeholder="Patient's answer..." className="flex-1 px-3 py-1.5 text-sm border border-border-color rounded-md bg-background-primary focus:ring-1 focus:ring-brand-blue outline-none"/>
                                     </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
             )}
        </div>
    );
});


const HistorySection: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection, formatHpi, checkMissingInfo, summarizeSection } = useContext(AppContext) as AppContextType;
    const history = patient.clinicalFile.sections.history || {};

    const handleFieldChange = (field: keyof HistorySectionData, value: any) => {
        updateClinicalFileSection(patient.id, 'history', { [field]: value });
    };

    const handleHpiVoice = (text: string) => {
        handleFieldChange('hpi', (history.hpi || '') + ' ' + text);
    }
    
    const handleAllergyChange = (index: number, field: keyof Allergy, value: string) => {
        const newAllergies = [...(history.allergy_history || [])];
        newAllergies[index] = { ...newAllergies[index], [field]: value };
        handleFieldChange('allergy_history', newAllergies);
    };
    
    const addAllergy = () => {
        const newAllergies = [...(history.allergy_history || []), { substance: '', reaction: '', severity: '' }];
        handleFieldChange('allergy_history', newAllergies);
    };
    
    const removeAllergy = (index: number) => {
        const newAllergies = (history.allergy_history || []).filter((_, i) => i !== index);
        handleFieldChange('allergy_history', newAllergies);
    };
    const reviewOfSystemsFields = ['Cardiovascular', 'Respiratory', 'Gastrointestinal', 'Genitourinary', 'Neurological', 'Musculoskeletal', 'Dermatological', 'Endocrine', 'Hematological', 'Psychiatric'];

    return (
        <div className="space-y-6">
             <div className="flex justify-end gap-3 pb-2 border-b border-border-color">
                <AIActionButton onClick={() => checkMissingInfo(patient.id, 'history')} text="Scan for Missing Info" />
                <AIActionButton onClick={() => summarizeSection(patient.id, 'history')} text="Generate Summary" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wide">Chief Complaint</label>
                    <input type="text" value={history.chief_complaint || ''} onChange={e => handleFieldChange('chief_complaint', e.target.value)} disabled={isSignedOff} className="w-full mt-1.5 p-3 border border-border-color rounded-lg bg-background-primary text-input-text font-medium shadow-sm focus:ring-2 focus:ring-brand-blue/20 outline-none"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wide">Duration</label>
                    <input type="text" value={history.duration || ''} onChange={e => handleFieldChange('duration', e.target.value)} disabled={isSignedOff} className="w-full mt-1.5 p-3 border border-border-color rounded-lg bg-background-primary text-input-text shadow-sm focus:ring-2 focus:ring-brand-blue/20 outline-none"/>
                </div>
                <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wide">History of Present Illness</label>
                         <div className="flex gap-2">
                             <AIActionButton onClick={() => formatHpi(patient.id)} text="Auto-Format" />
                             {!isSignedOff && <VoiceInput onTranscript={handleHpiVoice} />}
                         </div>
                    </div>
                    <TextareaAutosize minRows={4} value={history.hpi || ''} onChange={e => handleFieldChange('hpi', e.target.value)} disabled={isSignedOff} className="w-full p-4 border border-border-color rounded-lg bg-background-primary text-input-text shadow-sm leading-relaxed focus:ring-2 focus:ring-brand-blue/20 outline-none"/>
                </div>
                
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-1.5 block">Associated Symptoms</label>
                    <TagsInput tags={history.associated_symptoms || []} onTagsChange={tags => handleFieldChange('associated_symptoms', tags)} disabled={isSignedOff} />
                </div>
                
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t border-border-color">
                    <AIAssistedTextarea patient={patient} fieldKey="past_medical_history" label="Past Medical History" isSignedOff={isSignedOff} />
                    <AIAssistedTextarea patient={patient} fieldKey="past_surgical_history" label="Past Surgical History" isSignedOff={isSignedOff} />
                    <AIAssistedTextarea patient={patient} fieldKey="drug_history" label="Drug / Medication History" isSignedOff={isSignedOff} />
                    <AIAssistedTextarea patient={patient} fieldKey="family_history" label="Family History" isSignedOff={isSignedOff} />
                    <AIAssistedTextarea patient={patient} fieldKey="personal_social_history" label="Personal & Social History" isSignedOff={isSignedOff} />
                    {patient.gender === 'Female' && (
                       <AIAssistedTextarea patient={patient} fieldKey="menstrual_obstetric_history" label="Menstrual / Obstetric History" isSignedOff={isSignedOff} />
                    )}
                     <AIAssistedTextarea patient={patient} fieldKey="socioeconomic_lifestyle" label="Socioeconomic & Lifestyle" isSignedOff={isSignedOff} />
                </div>

                 <div className="md:col-span-2 bg-red-50/50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                    <label className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 block">Allergies</label>
                    <div className="space-y-3">
                        {(history.allergy_history || []).map((allergy, index) => (
                            <div key={index} className="flex gap-3 items-center">
                                <input placeholder="Substance" value={allergy.substance} onChange={e => handleAllergyChange(index, 'substance', e.target.value)} disabled={isSignedOff} className="p-2 border border-red-200 rounded-md flex-1 bg-white dark:bg-black text-sm"/>
                                <input placeholder="Reaction" value={allergy.reaction} onChange={e => handleAllergyChange(index, 'reaction', e.target.value)} disabled={isSignedOff} className="p-2 border border-red-200 rounded-md flex-1 bg-white dark:bg-black text-sm"/>
                                <select value={allergy.severity} onChange={e => handleAllergyChange(index, 'severity', e.target.value)} disabled={isSignedOff} className="p-2 border border-red-200 rounded-md bg-white dark:bg-black text-sm w-32">
                                    <option value="">Severity...</option>
                                    <option>Mild</option><option>Moderate</option><option>Severe</option>
                                </select>
                                <button onClick={() => removeAllergy(index)} disabled={isSignedOff} className="text-red-500 hover:bg-red-100 p-1 rounded transition-colors">&times;</button>
                            </div>
                        ))}
                         {!isSignedOff && <button onClick={addAllergy} className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1"><PlusIcon /> Add Allergy</button>}
                    </div>
                </div>

                 <div className="md:col-span-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3 block">Review of Systems</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {reviewOfSystemsFields.map(field => (
                             <label key={field} className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${history.review_of_systems?.[field.toLowerCase()] ? 'bg-brand-blue-light border-brand-blue text-brand-blue-dark' : 'bg-background-primary border-border-color text-text-secondary hover:border-gray-300'}`}>
                                <input type="checkbox" checked={!!history.review_of_systems?.[field.toLowerCase()]} onChange={() => handleFieldChange('review_of_systems', {...history.review_of_systems, [field.toLowerCase()]: !history.review_of_systems?.[field.toLowerCase()]})} disabled={isSignedOff} className="h-4 w-4 rounded text-brand-blue focus:ring-brand-blue" />
                                <span className="text-xs font-medium">{field}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});

// ... (SystemicExamSection, SummarySignoffSection - minor styling updates but logic kept same, condensing for brevity) ...

const SystemicExamSection: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection, summarizeSection } = useContext(AppContext) as AppContextType;
    const systems: { key: keyof SystemicExamSectionData; label: string }[] = [
        { key: 'cvs', label: 'Cardiovascular (CVS)' }, { key: 'rs', label: 'Respiratory (RS)' },
        { key: 'abdomen', label: 'Abdomen' }, { key: 'cns', label: 'Central Nervous System (CNS)' }, 
        { key: 'msk', label: 'Musculoskeletal (MSK)' }, { key: 'skin', label: 'Skin & Integument' },
    ];
    
    const SystemPanel: React.FC<{ systemKey: keyof SystemicExamSectionData; systemLabel: string; }> = React.memo(({ systemKey, systemLabel }) => {
        const systemData = patient.clinicalFile.sections.systemic?.[systemKey] || {};
        const handleFieldChange = (field: keyof SystemicExamSystemData, value: string) => {
            updateClinicalFileSection(patient.id, 'systemic', { [systemKey]: { ...systemData, [field]: value } });
        };
        // Exclude 'autofill' from fields to prevent passing boolean to TextareaAutosize value prop
        const fields: (Exclude<keyof SystemicExamSystemData, 'autofill'>)[] = ['inspection', 'palpation', 'percussion', 'auscultation', 'summary'];
        return (
            <Accordion title={systemLabel}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields.map(field => (
                        <div key={field} className={field === 'summary' ? 'md:col-span-2' : ''}>
                            <div className="flex justify-between">
                                <label className="text-xs font-bold text-text-tertiary uppercase mb-1">{field}</label>
                                {!isSignedOff && <VoiceInput onTranscript={(t) => handleFieldChange(field, (systemData[field] || '') + ' ' + t)} className="w-4 h-4" />}
                            </div>
                            <TextareaAutosize
                                minRows={field === 'summary' ? 2 : 1}
                                value={systemData[field] || ''}
                                onChange={e => handleFieldChange(field, e.target.value)}
                                disabled={isSignedOff}
                                className="w-full p-2 border border-border-color rounded-md bg-background-primary text-sm focus:ring-1 focus:ring-brand-blue outline-none"
                            />
                        </div>
                    ))}
                </div>
            </Accordion>
        );
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-end"><AIActionButton onClick={() => summarizeSection(patient.id, 'systemic')} text="Summarize All" /></div>
            {systems.map(({ key, label }) => <SystemPanel key={key} systemKey={key} systemLabel={label} />)}
        </div>
    );
});

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
            <h4 className="font-bold text-lg text-text-primary mb-3">Assessment & Plan Summary</h4>
            <div className="p-4 bg-background-primary rounded-lg border border-border-color shadow-sm mb-4 italic text-text-secondary leading-relaxed">
                {patient.clinicalFile.aiSummary || <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"></div> Generating summary...</span>}
            </div>
            <div className="flex justify-end">
                <button onClick={handleSignOff} disabled={isLoading || user.role !== 'Doctor'} className="px-8 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 shadow-lg shadow-green-600/20 transition-all">
                    {isLoading ? 'Verifying...' : 'Sign Off Case'}
                </button>
            </div>
        </div>
    );
});

// ... (GPESection same logic, updated inputs) ...
const GPESection: React.FC<{ patient: Patient; isSignedOff: boolean }> = React.memo(({ patient, isSignedOff }) => {
    const { updateClinicalFileSection, summarizeSection } = useContext(AppContext) as AppContextType;
    const gpe = patient.clinicalFile.sections.gpe || {};
    const handleFieldChange = (field: keyof GPESectionData, value: any) => updateClinicalFileSection(patient.id, 'gpe', { [field]: value });
    const handleFlagsChange = (flag: keyof GPESectionData['flags']) => updateClinicalFileSection(patient.id, 'gpe', { flags: { ...gpe.flags, [flag]: !gpe.flags?.[flag] } });

    useEffect(() => {
        if (gpe.height_cm && gpe.weight_kg) {
            const bmi = gpe.weight_kg / ((gpe.height_cm/100) ** 2);
            if (gpe.bmi?.toFixed(1) !== bmi.toFixed(1)) handleFieldChange('bmi', parseFloat(bmi.toFixed(1)));
        }
    }, [gpe.height_cm, gpe.weight_kg]);

    return (
        <div className="space-y-4">
             <div className="flex justify-end"><AIActionButton onClick={() => summarizeSection(patient.id, 'gpe')} text="Auto-Describe" /></div>
            {gpe.aiGeneratedSummary && <div className="p-3 bg-blue-50/50 text-blue-900 text-sm rounded-lg border border-blue-100">{gpe.aiGeneratedSummary}</div>}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="col-span-2">
                     <label className="text-xs font-bold text-text-tertiary uppercase">Appearance</label>
                     <select value={gpe.general_appearance || ''} onChange={e => handleFieldChange('general_appearance', e.target.value)} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm">
                        <option value="">Select...</option><option value="well">Well</option><option value="ill">Ill-looking</option><option value="toxic">Toxic</option><option value="cachectic">Cachectic</option>
                    </select>
                </div>
                 <div><label className="text-xs font-bold text-text-tertiary uppercase">Height (cm)</label><input type="number" value={gpe.height_cm || ''} onChange={e => handleFieldChange('height_cm', parseFloat(e.target.value))} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm"/></div>
                 <div><label className="text-xs font-bold text-text-tertiary uppercase">Weight (kg)</label><input type="number" value={gpe.weight_kg || ''} onChange={e => handleFieldChange('weight_kg', parseFloat(e.target.value))} disabled={isSignedOff} className="w-full mt-1 p-2 border border-border-color rounded-md bg-background-primary text-sm"/></div>
            </div>
             <div className="flex flex-wrap gap-4 p-4 bg-background-secondary/30 rounded-lg border border-border-color">
                {[{ key: 'pallor', label: 'Pallor' }, { key: 'icterus', label: 'Icterus' }, { key: 'cyanosis', label: 'Cyanosis' }, { key: 'clubbing', label: 'Clubbing' }, { key: 'lymphadenopathy', label: 'LAD' }, { key: 'edema', label: 'Edema' }].map(({ key, label }) => (
                     <label key={key} className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={!!gpe.flags?.[key as any]} onChange={() => handleFlagsChange(key as any)} disabled={isSignedOff} className="h-4 w-4 rounded text-brand-blue" />
                        <span className="text-sm font-medium text-text-secondary">{label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
});


const ClinicalFileTab: React.FC<{ patient: Patient; user: User }> = React.memo(({ patient, user }) => {
    const isSignedOff = patient.clinicalFile.status === 'signed';
    return (
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
            <Accordion title="History" isOpenDefault={true} status="yellow"><HistorySection patient={patient} isSignedOff={isSignedOff} /></Accordion>
            <Accordion title="General Physical Examination"><GPESection patient={patient} isSignedOff={isSignedOff} /></Accordion>
            <Accordion title="Systemic Examination"><SystemicExamSection patient={patient} isSignedOff={isSignedOff} /></Accordion>
            <SummarySignoffSection patient={patient} user={user} />
        </div>
    );
});

// ... (Rest of Tabs - Orders, Rounds, Vitals - wrapping them in consistent layout) ...

const OrdersTab: React.FC<{ patient: Patient }> = React.memo(({ patient }) => {
    const { updateOrder, addOrderToPatient, sendAllDrafts, currentUser } = useContext(AppContext) as AppContextType;
    const [activeCategory, setActiveCategory] = useState<OrderCategory>('investigation');
    const [quickOrderText, setQuickOrderText] = useState('');
    
    const categories: { key: OrderCategory; label: string; icon: any }[] = [
        { key: 'investigation', label: 'Labs', icon: BeakerIcon }, { key: 'radiology', label: 'Imaging', icon: FilmIcon },
        { key: 'medication', label: 'Meds', icon: PillIcon }, { key: 'procedure', label: 'Procedures', icon: ClipboardDocumentListIcon },
    ];
    const filteredOrders = useMemo(() => patient.orders.filter(o => o.category === activeCategory), [patient.orders, activeCategory]);

    return (
        <div className="flex h-full min-h-[600px]">
            <div className="w-64 border-r border-border-color bg-background-secondary/30 p-4 space-y-1">
                {categories.map(cat => (
                    <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat.key ? 'bg-brand-blue/10 text-brand-blue-dark' : 'text-text-secondary hover:bg-background-tertiary'}`}>
                        <cat.icon className="w-4 h-4 mr-3" /> {cat.label}
                    </button>
                ))}
            </div>
            <div className="flex-1 p-6">
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-3 top-3 text-text-tertiary w-5 h-5"/>
                        <input type="text" value={quickOrderText} onChange={e => setQuickOrderText(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && quickOrderText) { addOrderToPatient(patient.id, {category: activeCategory, label: quickOrderText.trim(), priority: 'routine'}); setQuickOrderText(''); }}} placeholder={`Order ${activeCategory}...`} className="w-full pl-10 pr-4 py-2.5 border border-border-color rounded-lg bg-background-primary shadow-sm focus:ring-2 focus:ring-brand-blue/20 outline-none"/>
                    </div>
                    <button onClick={() => sendAllDrafts(patient.id, activeCategory)} className="px-4 bg-brand-blue text-white rounded-lg font-medium text-sm hover:bg-brand-blue-dark shadow-sm">Send Drafts</button>
                </div>
                <div className="space-y-3">
                    {filteredOrders.map(order => (
                        <div key={order.orderId} className="flex items-center justify-between p-4 bg-background-primary border border-border-color rounded-xl shadow-sm hover:border-brand-blue/30 transition-colors">
                            <div>
                                <h4 className="font-semibold text-text-primary">{order.label}</h4>
                                <div className="flex gap-2 mt-1 text-xs text-text-secondary uppercase font-medium">
                                    <span className={order.priority === 'STAT' ? 'text-red-600' : ''}>{order.priority}</span>
                                    <span className="text-text-tertiary">&bull;</span>
                                    <span>{order.status.replace('_', ' ')}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {order.status === 'draft' && <select value={order.priority} onChange={e => updateOrder(patient.id, order.orderId, {priority: e.target.value as OrderPriority})} className="text-xs border p-1 rounded"><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="STAT">STAT</option></select>}
                                <button onClick={() => updateOrder(patient.id, order.orderId, { status: order.status === 'draft' ? 'sent' : order.status === 'sent' ? 'in_progress' : 'completed' })} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded uppercase tracking-wide">{order.status === 'draft' ? 'Send' : order.status === 'sent' ? 'Begin' : 'Complete'}</button>
                            </div>
                        </div>
                    ))}
                    {filteredOrders.length === 0 && <div className="text-center py-10 text-text-tertiary">No orders yet.</div>}
                </div>
            </div>
        </div>
    );
});

// ... (RoundsTab & VitalsTab with consistent styling) ...
const RoundsTab: React.FC<{ patient: Patient }> = React.memo(({ patient }) => {
    const { createDraftRound, updateDraftRound, signOffRound, getRoundContradictions } = useContext(AppContext) as AppContextType;
    const [draft, setDraft] = useState<Round | null>(null);
    useEffect(() => { setDraft(patient.rounds.find(r => r.status === 'draft') || null); }, [patient.rounds]);
    const handleSignOff = async () => { if (draft) { const i = await getRoundContradictions(patient.id, draft.roundId); if(i.length === 0 || window.confirm(i.join('\n'))) { signOffRound(patient.id, draft.roundId, i); setDraft(null); } } };
    
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            {!draft ? (
                <button onClick={async () => setDraft(await createDraftRound(patient.id))} className="w-full py-4 border-2 border-dashed border-border-color rounded-xl text-text-tertiary hover:border-brand-blue hover:text-brand-blue hover:bg-brand-blue-light/10 transition-all font-medium flex items-center justify-center gap-2">
                    <PlusIcon /> Start Clinical Round
                </button>
            ) : (
                <div className="bg-background-primary rounded-xl border border-border-color shadow-sm overflow-hidden">
                    <div className="p-4 bg-brand-blue-light/30 border-b border-border-color flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <h3 className="font-bold text-brand-blue-dark">Current Round Note</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-semibold text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded">AI Assisted</span>
                                <span className="text-[10px] text-text-tertiary">Verify before signing</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <AIActionButton onClick={async () => updateDraftRound(patient.id, draft.roundId, await generateSOAPForRound(patient))} text="Auto-Generate" />
                            <button onClick={handleSignOff} className="px-4 py-1.5 bg-brand-green text-white text-xs font-bold rounded-md hover:bg-green-600">Sign Off</button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {['subjective', 'objective', 'assessment'].map(key => (
                            <div key={key}>
                                <div className="flex justify-between mb-1"><label className="text-xs font-bold text-text-tertiary uppercase">{key}</label><VoiceInput onTranscript={t => updateDraftRound(patient.id, draft.roundId, {[key]: (draft[key as keyof Round] as string + ' ' + t)})} className="w-4 h-4"/></div>
                                <TextareaAutosize minRows={2} value={draft[key as keyof Round] as string} onChange={e => updateDraftRound(patient.id, draft.roundId, {[key]: e.target.value})} className="w-full p-3 border border-border-color rounded-lg bg-background-primary text-sm focus:ring-1 focus:ring-brand-blue outline-none"/>
                            </div>
                        ))}
                         <div>
                            <div className="flex justify-between mb-1"><label className="text-xs font-bold text-text-tertiary uppercase">Plan</label><VoiceInput onTranscript={t => updateDraftRound(patient.id, draft.roundId, {plan: {text: draft.plan.text + ' ' + t, linkedOrders: []}})} className="w-4 h-4"/></div>
                            <TextareaAutosize minRows={2} value={draft.plan.text} onChange={e => updateDraftRound(patient.id, draft.roundId, {plan: {text: e.target.value, linkedOrders: []}})} className="w-full p-3 border border-border-color rounded-lg bg-background-primary text-sm focus:ring-1 focus:ring-brand-blue outline-none"/>
                        </div>
                    </div>
                </div>
            )}
            <div className="space-y-4">
                <h4 className="font-bold text-text-secondary border-b pb-2">History</h4>
                {patient.rounds.filter(r => r.status === 'signed').map(r => (
                    <div key={r.roundId} className="bg-background-secondary/30 p-4 rounded-lg border border-border-color text-sm">
                        <div className="flex justify-between text-xs text-text-tertiary mb-2 font-mono"><span>{new Date(r.signedAt!).toLocaleString()}</span><span>Signed</span></div>
                        <div className="grid gap-2 text-text-secondary">
                            <p><strong className="text-text-primary">S:</strong> {r.subjective}</p><p><strong className="text-text-primary">O:</strong> {r.objective}</p>
                            <p><strong className="text-text-primary">A:</strong> {r.assessment}</p><p><strong className="text-text-primary">P:</strong> {r.plan.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

const VitalsTab: React.FC<{ patient: Patient }> = React.memo(({ patient }) => {
    const { updatePatientVitals } = useContext(AppContext) as AppContextType;
    const [newVitals, setNewVitals] = useState<Vitals>({ hr: 0, bpSys: 0, bpDia: 0, rr: 0, spo2: 0, temp: 0 });
    const data = useMemo(() => patient.vitalsHistory.map(v => ({ time: new Date(v.recordedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), hr: v.measurements.pulse, bpSys: v.measurements.bp_sys, spo2: v.measurements.spo2, temp: v.measurements.temp_c })).reverse(), [patient.vitalsHistory]);

    return (
        <div className="p-6 space-y-6">
            <div className="h-80 w-full bg-background-primary p-4 rounded-xl border border-border-color shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-color)" />
                        <XAxis dataKey="time" stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Legend wrapperStyle={{paddingTop: '20px'}}/>
                        <Line type="monotone" dataKey="hr" stroke="#EF4444" strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="Heart Rate" />
                        <Line type="monotone" dataKey="bpSys" stroke="#3B82F6" strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="Systolic BP" />
                        <ReferenceLine y={90} stroke="#EF4444" strokeDasharray="3 3" label={{position: 'insideBottomRight', value: 'Critical', fill: 'red', fontSize: 10}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-background-secondary/30 p-6 rounded-xl border border-border-color">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                     {[{key: 'hr', label: 'HR'}, {key: 'bpSys', label: 'Sys'}, {key: 'bpDia', label: 'Dia'}, {key: 'rr', label: 'RR'}, {key: 'spo2', label: 'SpO2'}, {key: 'temp', label: 'Temp'}].map(f => (
                         <div key={f.key}>
                             <label className="text-xs font-bold text-text-tertiary uppercase block mb-1">{f.label}</label>
                             <input type="number" value={newVitals[f.key as keyof Vitals] || ''} onChange={e => setNewVitals({...newVitals, [f.key]: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-border-color bg-background-primary text-center font-mono focus:ring-2 focus:ring-brand-blue/30 outline-none transition-shadow"/>
                         </div>
                     ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={() => { updatePatientVitals(patient.id, newVitals); setNewVitals({hr:0,bpSys:0,bpDia:0,rr:0,spo2:0,temp:0}); }} className="px-6 py-2 bg-brand-blue text-white rounded-lg font-bold shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark transition-all">Record Vitals</button>
                </div>
            </div>
        </div>
    );
});

const DischargeTab: React.FC<{ patient: Patient }> = React.memo(({ patient }) => {
    const { generateDischargeSummary, updateStateAndDb } = useContext(AppContext) as AppContextType;
    const [isEditing, setIsEditing] = useState(false);
    const summary = patient.dischargeSummary?.draft || '';

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center p-4 bg-background-secondary/30 rounded-xl border border-border-color">
                <div>
                    <h3 className="font-bold text-lg text-text-primary">Discharge Summary</h3>
                    <p className="text-xs text-text-tertiary mt-1 flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3 text-brand-blue" />
                        AI-generated — verify clinically before printing.
                    </p>
                </div>
                <div className="flex gap-2">
                    <AIActionButton onClick={() => generateDischargeSummary(patient.id)} text="Regenerate Draft" />
                    <button onClick={() => window.print()} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-bold shadow-sm hover:bg-brand-blue-dark">Print / PDF</button>
                </div>
            </div>

            <div className="relative border border-border-color rounded-xl bg-background-primary shadow-sm overflow-hidden min-h-[500px]">
                <TextareaAutosize
                    value={summary}
                    onChange={(e) => updateStateAndDb(patient.id, p => ({ ...p, dischargeSummary: { ...p.dischargeSummary, draft: e.target.value } }))}
                    className="w-full h-full p-8 text-base leading-relaxed outline-none resize-none font-serif text-text-primary"
                    placeholder="No discharge summary generated yet..."
                    minRows={20}
                />
            </div>
        </div>
    );
});

const PatientDetailPage: React.FC = () => {
    const { selectedPatientId, patients, setPage, currentUser } = useContext(AppContext) as AppContextType;
    const [activeTab, setActiveTab] = useState<'overview' | 'clinical' | 'orders' | 'rounds' | 'vitals' | 'discharge'>('clinical');
    const patient = patients.find(p => p.id === selectedPatientId);

    if (!patient || !currentUser) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-background-tertiary/20 pb-10">
            <PatientWorkspaceHeader patient={patient} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Main Workspace */}
                    <div className="flex-1 bg-background-primary rounded-2xl border border-border-color shadow-sm min-h-[80vh] flex flex-col overflow-hidden">
                        {/* Tab Navigation */}
                        <div className="flex border-b border-border-color px-6 pt-4 space-x-6 overflow-x-auto">
                            {['clinical', 'orders', 'rounds', 'vitals', 'discharge'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`pb-4 px-2 text-sm font-bold capitalize transition-all border-b-2 whitespace-nowrap ${
                                        activeTab === tab
                                            ? 'border-brand-blue text-brand-blue'
                                            : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-gray-300'
                                    }`}
                                >
                                    {tab} Workspace
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 bg-background-primary overflow-y-auto max-h-[calc(100vh-250px)]">
                            {activeTab === 'clinical' && <ClinicalFileView patient={patient} user={currentUser} />}
                            {activeTab === 'orders' && <OrdersTab patient={patient} />}
                            {activeTab === 'rounds' && <RoundsTab patient={patient} />}
                            {activeTab === 'vitals' && <VitalsTab patient={patient} />}
                            {activeTab === 'discharge' && <DischargeTab patient={patient} />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientDetailPage;
