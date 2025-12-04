import React, { useState } from 'react';
import { SystemicExamData } from '../../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Activity, Heart, Brain, Stethoscope, Droplets } from 'lucide-react';

interface SystemicExamProps {
    data: {
        cardiovascular?: SystemicExamData;
        respiratory?: SystemicExamData;
        cns?: SystemicExamData;
        gastrointestinal?: SystemicExamData;
        renal?: SystemicExamData;
    };
    onChange: (system: string, data: SystemicExamData) => void;
}

const SystemPanel: React.FC<{
    label: string;
    data?: SystemicExamData;
    onChange: (d: SystemicExamData) => void
}> = ({ label, data, onChange }) => {
    const safeData = data || { inspection: '', palpation: '', percussion: '', auscultation: '', summary: '' };

    const handleChange = (field: keyof SystemicExamData, value: string) => {
        onChange({ ...safeData, [field]: value });
    };

    return (
        <div className="space-y-4 pt-4">
            <Accordion type="multiple" defaultValue={['inspection', 'palpation', 'percussion', 'auscultation']} className="space-y-2">
                {[
                    { id: 'inspection', l: 'Inspection' },
                    { id: 'palpation', l: 'Palpation' },
                    { id: 'percussion', l: 'Percussion' },
                    { id: 'auscultation', l: 'Auscultation' }
                ].map(({ id, l }) => (
                    <AccordionItem key={id} value={id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 px-4">
                        <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">{l}</AccordionTrigger>
                        <AccordionContent className="pb-4">
                            <Textarea
                                value={safeData[id as keyof SystemicExamData]}
                                onChange={e => handleChange(id as keyof SystemicExamData, e.target.value)}
                                className="min-h-[80px] bg-zinc-50 dark:bg-zinc-950 resize-none"
                                placeholder={`Enter ${l.toLowerCase()} findings...`}
                            />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-6">
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 block">System Summary</label>
                <Textarea
                    value={safeData.summary}
                    onChange={e => handleChange('summary', e.target.value)}
                    className="min-h-[100px] bg-white dark:bg-zinc-950 font-serif"
                    placeholder={`Summary for ${label}...`}
                />
            </div>
        </div>
    );
};

const SystemicExam: React.FC<SystemicExamProps> = ({ data, onChange }) => {
    const [activeTab, setActiveTab] = useState('respiratory');

    return (
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-0 border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Systemic Examination</CardTitle>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full justify-start h-auto p-1 bg-zinc-100 dark:bg-zinc-900 overflow-x-auto flex-nowrap">
                        <TabsTrigger value="respiratory" className="gap-2"><Activity className="w-4 h-4" /> Respiratory</TabsTrigger>
                        <TabsTrigger value="cardiovascular" className="gap-2"><Heart className="w-4 h-4" /> CVS</TabsTrigger>
                        <TabsTrigger value="cns" className="gap-2"><Brain className="w-4 h-4" /> CNS</TabsTrigger>
                        <TabsTrigger value="gastrointestinal" className="gap-2"><Stethoscope className="w-4 h-4" /> Abdomen</TabsTrigger>
                        <TabsTrigger value="renal" className="gap-2"><Droplets className="w-4 h-4" /> Renal/GU</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} className="w-full">
                    <TabsContent value="respiratory">
                        <SystemPanel label="Respiratory System" data={data.respiratory} onChange={d => onChange('respiratory', d)} />
                    </TabsContent>
                    <TabsContent value="cardiovascular">
                        <SystemPanel label="Cardiovascular System" data={data.cardiovascular} onChange={d => onChange('cardiovascular', d)} />
                    </TabsContent>
                    <TabsContent value="cns">
                        <SystemPanel label="Central Nervous System" data={data.cns} onChange={d => onChange('cns', d)} />
                    </TabsContent>
                    <TabsContent value="gastrointestinal">
                        <SystemPanel label="Gastrointestinal System" data={data.gastrointestinal} onChange={d => onChange('gastrointestinal', d)} />
                    </TabsContent>
                    <TabsContent value="renal">
                        <SystemPanel label="Renal System" data={data.renal} onChange={d => onChange('renal', d)} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default SystemicExam;
