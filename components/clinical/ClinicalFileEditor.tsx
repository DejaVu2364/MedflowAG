import React, { useState, useEffect } from 'react';
import { Patient, ClinicalFile, HOPIStructured, GPEData, SystemicExamData, ChiefComplaint } from '../../types';
import { usePatient } from '../../contexts/PatientContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Mic, Save, AlertTriangle, Check, Loader2, ShieldCheck, Sparkles as SparklesIcon, FileText } from 'lucide-react';
import { generateClinicalFileFromTranscript, crossCheckClinicalFile } from '../../services/geminiService';

// New Components
import ChiefComplaints from './ChiefComplaints';
import HOPIBuilder from './HOPIBuilder';
import GPEPanel from './GPEPanel';
import SystemicExam from './SystemicExam';

interface ClinicalFileEditorProps {
    patient: Patient;
}

const ClinicalFileEditor: React.FC<ClinicalFileEditorProps> = ({ patient }) => {
    const { updateClinicalFileSection, updatePatientComplaint, getSuggestedOrders, addOrderToPatient } = usePatient();
    const { addToast } = useToast();

    // Helper to ensure structured data exists
    const initializeData = (file: ClinicalFile): ClinicalFile => {
        return {
            ...file,
            hopiStructured: file.hopiStructured || {
                onset: '', course: '', character: '', associatedSymptoms: '',
                aggravatingFactors: '', relievingFactors: '', similarEpisodes: '', treatmentTaken: ''
            },
            gpeStructured: file.gpeStructured || {
                generalAppearance: '',
                vitals: { temp: '', pulse: '', bp: '', rr: '', spo2: '' },
                piccle: {
                    pallor: { present: false },
                    icterus: { present: false },
                    cyanosis: { present: false },
                    clubbing: { present: false },
                    lymphadenopathy: { present: false },
                    edema: { present: false }
                }
            },
            systemic: {
                ...file.systemic,
                cardiovascularStructured: file.systemic.cardiovascularStructured || { inspection: '', palpation: '', percussion: '', auscultation: '', summary: '' },
                respiratoryStructured: file.systemic.respiratoryStructured || { inspection: '', palpation: '', percussion: '', auscultation: '', summary: '' },
                cnsStructured: file.systemic.cnsStructured || { inspection: '', palpation: '', percussion: '', auscultation: '', summary: '' },
                gastrointestinalStructured: file.systemic.gastrointestinalStructured || { inspection: '', palpation: '', percussion: '', auscultation: '', summary: '' },
                renalStructured: file.systemic.renalStructured || { inspection: '', palpation: '', percussion: '', auscultation: '', summary: '' },
            }
        };
    };

    // Local State for Clinical File
    const [localData, setLocalData] = useState<ClinicalFile>(initializeData(patient.clinicalFile));

    // Scribe State
    const [isScribeOpen, setIsScribeOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [scribeProcessing, setScribeProcessing] = useState(false);
    const [scribeResult, setScribeResult] = useState<Partial<ClinicalFile> | null>(null);

    // Consistency Check State
    const [checkingConsistency, setCheckingConsistency] = useState(false);

    // Order Suggestions State
    const [isSuggestingOrders, setIsSuggestingOrders] = useState(false);
    const [suggestedOrders, setSuggestedOrders] = useState<any[]>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

    // Sync local state when patient changes
    useEffect(() => {
        setLocalData(initializeData(patient.clinicalFile));
    }, [patient.clinicalFile]);

    // --- Handlers for New Components ---

    const handleComplaintsChange = (newComplaints: ChiefComplaint[]) => {
        updatePatientComplaint(patient.id, newComplaints);
    };

    const handleHOPIChange = (structured: HOPIStructured) => {
        const updated = { ...localData, hopiStructured: structured };
        setLocalData(updated);
        // Auto-save structured data
        updateClinicalFileSection(patient.id, { hopiStructured: structured });
    };

    const handleHOPINarrativeChange = (text: string) => {
        const updated = { ...localData, hopi: text };
        setLocalData(updated);
        // Debounce save or save on blur could be better, but direct update for now
        updateClinicalFileSection(patient.id, { hopi: text });
    };

    const handleGPEChange = (data: GPEData) => {
        const updated = { ...localData, gpeStructured: data };
        setLocalData(updated);
        updateClinicalFileSection(patient.id, { gpeStructured: data });
    };

    const handleSystemicChange = (system: string, data: SystemicExamData) => {
        const updated = {
            ...localData,
            systemic: {
                ...localData.systemic,
                [`${system}Structured`]: data
            }
        };
        setLocalData(updated);
        updateClinicalFileSection(patient.id, {
            systemic: {
                ...patient.clinicalFile.systemic,
                [`${system}Structured`]: data
            }
        });
    };

    const handleTextChange = (field: keyof ClinicalFile, value: string) => {
        setLocalData(prev => ({ ...prev, [field]: value }));
    };

    const saveTextField = (field: keyof ClinicalFile) => {
        // @ts-ignore
        updateClinicalFileSection(patient.id, { [field]: localData[field] });
        addToast(`${field} saved`, 'success');
    };

    // --- Existing Features (Consistency, Scribe, Suggestions) ---

    const runConsistencyCheck = async (silent = false) => {
        setCheckingConsistency(true);
        try {
            const inconsistencies = await crossCheckClinicalFile(localData);
            if (inconsistencies.length > 0) {
                updateClinicalFileSection(patient.id, { inconsistencies });
                if (!silent) addToast(`Found ${inconsistencies.length} inconsistencies`, 'info');
            } else {
                updateClinicalFileSection(patient.id, { inconsistencies: [] });
                if (!silent) addToast('No inconsistencies found', 'success');
            }
        } catch (e) {
            console.error(e);
            if (!silent) addToast('Consistency check failed', 'error');
        } finally {
            setCheckingConsistency(false);
        }
    };

    const toggleRecording = () => isRecording ? stopRecording() : startRecording();

    const startRecording = () => {
        setIsRecording(true);
        const mockTranscript = "Patient presents with severe headache for 3 days, throbbing in nature, mainly frontal. No vomiting but has nausea. History of migraine. BP is 130/80. Chest clear. Plan to start Paracetamol and rest.";
        let i = 0;
        setTranscript("");
        const interval = setInterval(() => {
            setTranscript(prev => prev + mockTranscript[i]);
            i++;
            if (i >= mockTranscript.length) {
                clearInterval(interval);
                setIsRecording(false);
            }
        }, 50);
    };

    const stopRecording = () => setIsRecording(false);

    const processScribe = async () => {
        setScribeProcessing(true);
        try {
            const result = await generateClinicalFileFromTranscript(transcript);
            setScribeResult(result);
        } catch (e) {
            addToast("Failed to process transcript", 'error');
        } finally {
            setScribeProcessing(false);
        }
    };

    const applyScribeChanges = () => {
        if (!scribeResult) return;
        const merged: ClinicalFile = { ...localData };
        Object.entries(scribeResult).forEach(([key, value]) => {
            if (key === 'systemic' && typeof value === 'object') {
                merged.systemic = { ...merged.systemic, ...value };
            } else if (value && typeof value === 'string') {
                // @ts-ignore
                const current = merged[key];
                // @ts-ignore
                merged[key] = current ? `${current}\n\n[Scribe]: ${value}` : value;
            }
        });
        setLocalData(merged);
        updateClinicalFileSection(patient.id, merged);
        setIsScribeOpen(false);
        setScribeResult(null);
        setTranscript('');
        addToast("Scribe notes applied successfully", 'success');
    };

    const handleSuggestOrders = async () => {
        setIsSuggestingOrders(true);
        try {
            const suggestions = await getSuggestedOrders(patient.id);
            setSuggestedOrders(suggestions);
            setSelectedSuggestions(new Set(suggestions.map((_, i) => i)));
            setIsSuggestionsOpen(true);
        } catch (e) {
            addToast("Failed to generate suggestions", 'error');
        } finally {
            setIsSuggestingOrders(false);
        }
    };

    const toggleSuggestion = (index: number) => {
        const newSelected = new Set(selectedSuggestions);
        if (newSelected.has(index)) newSelected.delete(index);
        else newSelected.add(index);
        setSelectedSuggestions(newSelected);
    };

    const acceptSelectedOrders = async () => {
        let count = 0;
        for (const index of selectedSuggestions) {
            const suggestion = suggestedOrders[index];
            await addOrderToPatient(patient.id, {
                category: suggestion.type as any,
                name: suggestion.name,
                priority: suggestion.priority || 'routine',
                notes: suggestion.reason,
                status: 'draft'
            });
            count++;
        }
        addToast(`Added ${count} orders to drafts`, 'success');
        setIsSuggestionsOpen(false);
        setSuggestedOrders([]);
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto p-4 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Clinical File</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Version {patient.clinicalFile.version} • Last updated {new Date().toLocaleDateString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsScribeOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Mic className="mr-2 h-4 w-4" /> Ambient Scribe
                    </Button>
                    <Button onClick={handleSuggestOrders} variant="outline" disabled={isSuggestingOrders}>
                        {isSuggestingOrders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SparklesIcon className="mr-2 h-4 w-4 text-purple-500" />}
                        Suggest Orders
                    </Button>
                    <Button onClick={() => runConsistencyCheck()} variant="outline" disabled={checkingConsistency}>
                        {checkingConsistency ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Check Consistency
                    </Button>
                </div>
            </div>

            {/* Inconsistencies Alert */}
            {patient.clinicalFile.inconsistencies && patient.clinicalFile.inconsistencies.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-amber-800 dark:text-amber-400 flex items-center text-lg">
                            <AlertTriangle className="mr-2 h-5 w-5" />
                            Clinical Inconsistencies Detected
                        </CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-500">
                            The AI has detected potential contradictions in the clinical record.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {patient.clinicalFile.inconsistencies.map((inc, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-amber-100 dark:border-amber-800/50">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-1 shrink-0" />
                                    <div>
                                        <p className="font-medium text-amber-900 dark:text-amber-300 text-sm">{inc.problem}</p>
                                        <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">Found in: {inc.section} • Suggestion: {inc.suggested_fix}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 1. Chief Complaints */}
            <ChiefComplaints
                complaints={patient.chiefComplaints || []}
                onChange={handleComplaintsChange}
            />

            {/* 2. HOPI */}
            <HOPIBuilder
                structured={localData.hopiStructured!}
                narrative={localData.hopi}
                onStructuredChange={handleHOPIChange}
                onNarrativeChange={handleHOPINarrativeChange}
            />

            {/* 3. General Physical Exam */}
            <GPEPanel
                data={localData.gpeStructured!}
                onChange={handleGPEChange}
            />

            {/* 4. Systemic Examination */}
            <SystemicExam
                data={{
                    cardiovascular: localData.systemic.cardiovascularStructured,
                    respiratory: localData.systemic.respiratoryStructured,
                    cns: localData.systemic.cnsStructured,
                    gastrointestinal: localData.systemic.gastrointestinalStructured,
                    renal: localData.systemic.renalStructured
                }}
                onChange={handleSystemicChange}
            />

            {/* 5. Diagnosis & Plan (Simple Text Areas for now) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Provisional Diagnosis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={localData.provisionalDiagnosis}
                            onChange={e => handleTextChange('provisionalDiagnosis', e.target.value)}
                            onBlur={() => saveTextField('provisionalDiagnosis')}
                            className="min-h-[120px] bg-zinc-50 dark:bg-zinc-950 resize-none"
                            placeholder="Enter provisional diagnosis..."
                        />
                    </CardContent>
                </Card>

                <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Management Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={localData.plan}
                            onChange={e => handleTextChange('plan', e.target.value)}
                            onBlur={() => saveTextField('plan')}
                            className="min-h-[120px] bg-zinc-50 dark:bg-zinc-950 resize-none"
                            placeholder="Enter management plan..."
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Ambient Scribe Modal */}
            <Dialog open={isScribeOpen} onOpenChange={setIsScribeOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mic className="h-5 w-5 text-indigo-600" /> Ambient Scribe
                        </DialogTitle>
                        <DialogDescription>
                            Record your consultation or dictation. AI will structure it into the clinical file.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Recording Area */}
                        <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                            {isRecording ? (
                                <div className="animate-pulse flex flex-col items-center">
                                    <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                        <Mic className="h-8 w-8 text-red-600" />
                                    </div>
                                    <p className="text-red-600 font-medium">Recording...</p>
                                    <p className="text-xs text-zinc-500 mt-2">Click to stop</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center cursor-pointer" onClick={startRecording}>
                                    <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4 hover:bg-indigo-200 transition-colors">
                                        <Mic className="h-8 w-8 text-indigo-600" />
                                    </div>
                                    <p className="text-zinc-900 dark:text-zinc-100 font-medium">Click to Start Recording</p>
                                </div>
                            )}
                        </div>

                        {/* Transcript Preview */}
                        {transcript && (
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-500 uppercase">Live Transcript</label>
                                <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 max-h-40 overflow-y-auto">
                                    {transcript}
                                </div>
                            </div>
                        )}

                        {/* AI Processing State */}
                        {scribeProcessing && (
                            <div className="flex items-center justify-center gap-3 py-4 text-indigo-600">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Processing with Gemini AI...</span>
                            </div>
                        )}

                        {/* Result Preview */}
                        {scribeResult && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-zinc-500 uppercase">AI Extracted Data</label>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ready to Merge</Badge>
                                </div>
                                <div className="p-4 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-lg text-sm space-y-2 max-h-60 overflow-y-auto">
                                    {Object.entries(scribeResult).map(([key, value]) => (
                                        <div key={key}>
                                            <span className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">{key}:</span>
                                            <span className="text-zinc-600 dark:text-zinc-400 ml-2">
                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsScribeOpen(false)}>Cancel</Button>
                        {isRecording && <Button variant="destructive" onClick={stopRecording}>Stop Recording</Button>}
                        {!isRecording && transcript && !scribeResult && (
                            <Button onClick={processScribe} disabled={scribeProcessing}>
                                <Wand2 className="mr-2 h-4 w-4" /> Process Transcript
                            </Button>
                        )}
                        {scribeResult && (
                            <Button onClick={applyScribeChanges} className="bg-green-600 hover:bg-green-700 text-white">
                                <Check className="mr-2 h-4 w-4" /> Merge to File
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Order Suggestions Modal */}
            <Dialog open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <SparklesIcon className="h-5 w-5 text-purple-600" /> Suggested Orders
                        </DialogTitle>
                        <DialogDescription>
                            AI has analyzed the clinical file and suggested the following orders.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 max-h-[60vh] overflow-y-auto space-y-3">
                        {suggestedOrders.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No specific orders suggested based on current data.</p>
                        ) : (
                            suggestedOrders.map((suggestion, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => toggleSuggestion(idx)}>
                                    <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${selectedSuggestions.has(idx) ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300'}`}>
                                        {selectedSuggestions.has(idx) && <Check className="w-3 h-3" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <h4 className="font-semibold">{suggestion.name}</h4>
                                            <Badge variant="outline" className="capitalize">{suggestion.type}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{suggestion.reason}</p>
                                        {suggestion.priority === 'urgent' && (
                                            <Badge variant="destructive" className="mt-2 text-[10px] h-5">Urgent</Badge>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsSuggestionsOpen(false)}>Cancel</Button>
                        <Button onClick={acceptSelectedOrders} disabled={selectedSuggestions.size === 0} className="bg-purple-600 hover:bg-purple-700 text-white">
                            Accept {selectedSuggestions.size} Orders
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ClinicalFileEditor;
