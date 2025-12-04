import React, { useState, useEffect } from 'react';
import { HOPIStructured } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Wand2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';

interface HOPIBuilderProps {
    structured: HOPIStructured;
    narrative: string;
    onStructuredChange: (data: HOPIStructured) => void;
    onNarrativeChange: (text: string) => void;
}

const HOPIBuilder: React.FC<HOPIBuilderProps> = ({ structured, narrative, onStructuredChange, onNarrativeChange }) => {
    const [isEditingNarrative, setIsEditingNarrative] = useState(false);
    const [activeAccordion, setActiveAccordion] = useState<string | undefined>('structured-fields');

    // Initialize structured if empty (handled by parent usually, but safe guard)
    const data = structured || {
        onset: '', course: '', character: '', associatedSymptoms: '',
        aggravatingFactors: '', relievingFactors: '', similarEpisodes: '', treatmentTaken: ''
    };

    const handleChange = (field: keyof HOPIStructured, value: string) => {
        onStructuredChange({ ...data, [field]: value });
    };

    const generateNarrative = () => {
        // Simple template-based generation for now
        const parts = [];
        if (data.onset) parts.push(`Onset was ${data.onset}.`);
        if (data.course) parts.push(`The course has been ${data.course}.`);
        if (data.character) parts.push(`Described as ${data.character}.`);
        if (data.associatedSymptoms) parts.push(`Associated with ${data.associatedSymptoms}.`);
        if (data.aggravatingFactors) parts.push(`Aggravated by ${data.aggravatingFactors}.`);
        if (data.relievingFactors) parts.push(`Relieved by ${data.relievingFactors}.`);
        if (data.similarEpisodes) parts.push(`History of similar episodes: ${data.similarEpisodes}.`);
        if (data.treatmentTaken) parts.push(`Treatment taken: ${data.treatmentTaken}.`);

        const generated = parts.join(' ');
        onNarrativeChange(generated);
    };

    return (
        <div className="space-y-6">
            {/* Structured Builder */}
            <Accordion type="single" collapsible value={activeAccordion} onValueChange={setActiveAccordion} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                <AccordionItem value="structured-fields" className="border-none">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            <Edit2 className="w-5 h-5 text-indigo-500" />
                            Structured HOPI Builder
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { k: 'onset', l: 'Onset', p: 'When did it start? Sudden/Gradual?' },
                                { k: 'course', l: 'Course/Progression', p: 'Worsening, improving, static?' },
                                { k: 'character', l: 'Character', p: 'Throbbing, burning, colicky?' },
                                { k: 'associatedSymptoms', l: 'Associated Symptoms', p: 'Nausea, vomiting, fever?' },
                                { k: 'aggravatingFactors', l: 'Aggravating Factors', p: 'Food, movement, position?' },
                                { k: 'relievingFactors', l: 'Relieving Factors', p: 'Rest, medication?' },
                                { k: 'similarEpisodes', l: 'Prior Episodes', p: 'Any similar complaints in past?' },
                                { k: 'treatmentTaken', l: 'Treatment Taken', p: 'Meds taken before arrival?' }
                            ].map(({ k, l, p }) => (
                                <div key={k}>
                                    <label className="text-xs font-medium text-zinc-500 mb-1 block">{l}</label>
                                    <Textarea
                                        value={data[k as keyof HOPIStructured]}
                                        onChange={e => handleChange(k as keyof HOPIStructured, e.target.value)}
                                        placeholder={p}
                                        className="min-h-[80px] bg-zinc-50 dark:bg-zinc-950 resize-none text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={generateNarrative} variant="outline" size="sm" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                <Wand2 className="w-4 h-4 mr-2" /> Generate Narrative
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Narrative View */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">HOPI Narrative</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingNarrative(!isEditingNarrative)}
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        {isEditingNarrative ? 'Done' : 'Edit Manually'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {isEditingNarrative ? (
                        <Textarea
                            value={narrative}
                            onChange={e => onNarrativeChange(e.target.value)}
                            className="min-h-[150px] font-serif text-lg leading-relaxed bg-white dark:bg-zinc-950"
                        />
                    ) : (
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 min-h-[100px]">
                            <p className="text-zinc-700 dark:text-zinc-300 font-serif text-lg leading-relaxed whitespace-pre-wrap">
                                {narrative || <span className="text-zinc-400 italic">Narrative will appear here...</span>}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default HOPIBuilder;
