import React from 'react';
import { GPEData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Copy } from 'lucide-react';

interface GPEPanelProps {
    data: GPEData;
    onChange: (data: GPEData) => void;
}

const GPEPanel: React.FC<GPEPanelProps> = ({ data, onChange }) => {
    // Ensure data structure exists
    const safeData = data || {
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
    };

    const handleVitalChange = (key: keyof GPEData['vitals'], value: string) => {
        onChange({
            ...safeData,
            vitals: { ...safeData.vitals, [key]: value }
        });
    };

    const handlePiccleChange = (key: keyof GPEData['piccle'], present: boolean) => {
        onChange({
            ...safeData,
            piccle: {
                ...safeData.piccle,
                [key]: { ...safeData.piccle[key], present }
            }
        });
    };

    const handlePiccleNoteChange = (key: keyof GPEData['piccle'], notes: string) => {
        onChange({
            ...safeData,
            piccle: {
                ...safeData.piccle,
                [key]: { ...safeData.piccle[key], notes }
            }
        });
    };

    const generateSummary = () => {
        const v = safeData.vitals;
        const p = safeData.piccle;
        const negatives = [];
        const positives = [];

        if (p.pallor.present) positives.push(`Pallor present (${p.pallor.notes || ''})`); else negatives.push('Pallor');
        if (p.icterus.present) positives.push(`Icterus present (${p.icterus.notes || ''})`); else negatives.push('Icterus');
        if (p.cyanosis.present) positives.push(`Cyanosis present (${p.cyanosis.notes || ''})`); else negatives.push('Cyanosis');
        if (p.clubbing.present) positives.push(`Clubbing present (${p.clubbing.notes || ''})`); else negatives.push('Clubbing');
        if (p.lymphadenopathy.present) positives.push(`Lymphadenopathy present (${p.lymphadenopathy.notes || ''})`); else negatives.push('Lymphadenopathy');
        if (p.edema.present) positives.push(`Edema present (${p.edema.notes || ''})`); else negatives.push('Edema');

        let text = `Patient is ${safeData.generalAppearance || '...'}. `;
        text += `Vitals: Temp ${v.temp || '-'}, Pulse ${v.pulse || '-'}, BP ${v.bp || '-'}, RR ${v.rr || '-'}, SpO2 ${v.spo2 || '-'}. `;

        if (positives.length > 0) text += positives.join(', ') + '. ';
        if (negatives.length > 0) text += `No ${negatives.join(', ')}.`;

        return text;
    };

    return (
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">General Physical Examination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                {/* Vitals Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { k: 'temp', l: 'Temp (°F)' },
                        { k: 'pulse', l: 'Pulse (/min)' },
                        { k: 'bp', l: 'BP (mmHg)' },
                        { k: 'rr', l: 'RR (/min)' },
                        { k: 'spo2', l: 'SpO2 (%)' }
                    ].map(({ k, l }) => (
                        <div key={k}>
                            <Label className="text-xs text-zinc-500 mb-1.5 block">{l}</Label>
                            <Input
                                value={safeData.vitals[k as keyof typeof safeData.vitals]}
                                onChange={e => handleVitalChange(k as keyof typeof safeData.vitals, e.target.value)}
                                className="h-9 font-mono text-center"
                            />
                        </div>
                    ))}
                </div>

                {/* General Appearance */}
                <div>
                    <Label className="text-xs text-zinc-500 mb-1.5 block">General Appearance</Label>
                    <Select value={safeData.generalAppearance} onValueChange={v => onChange({ ...safeData, generalAppearance: v })}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select appearance..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="conscious and oriented">Conscious & Oriented</SelectItem>
                            <SelectItem value="acutely ill looking">Acutely Ill Looking</SelectItem>
                            <SelectItem value="pale and distressed">Pale & Distressed</SelectItem>
                            <SelectItem value="drowsy but arousable">Drowsy but Arousable</SelectItem>
                            <SelectItem value="unconscious">Unconscious</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* PICCLE Grid */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                        {['pallor', 'icterus', 'cyanosis', 'clubbing', 'lymphadenopathy', 'edema'].map((key) => {
                            const k = key as keyof GPEData['piccle'];
                            const item = safeData.piccle[k];
                            return (
                                <div key={k} className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="capitalize font-medium text-sm text-zinc-700 dark:text-zinc-300">{key}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs ${item.present ? 'text-red-500 font-bold' : 'text-zinc-400'}`}>
                                                {item.present ? 'Present' : 'Absent'}
                                            </span>
                                            <Switch
                                                checked={item.present}
                                                onCheckedChange={c => handlePiccleChange(k, c)}
                                            />
                                        </div>
                                    </div>
                                    {item.present && (
                                        <Input
                                            value={item.notes || ''}
                                            onChange={e => handlePiccleNoteChange(k, e.target.value)}
                                            placeholder={`Describe ${key}...`}
                                            className="h-7 text-xs"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Auto Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                    <div className="flex-1 text-sm text-blue-900 dark:text-blue-100 font-serif leading-relaxed">
                        {generateSummary()}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:text-blue-700" onClick={() => navigator.clipboard.writeText(generateSummary())}>
                        <Copy className="w-3 h-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default GPEPanel;
