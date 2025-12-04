import React, { useState } from 'react';
import { ChiefComplaint } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { X, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ChiefComplaintsProps {
    complaints: ChiefComplaint[];
    onChange: (complaints: ChiefComplaint[]) => void;
}

const ChiefComplaints: React.FC<ChiefComplaintsProps> = ({ complaints, onChange }) => {
    const [newComplaint, setNewComplaint] = useState('');
    const [duration, setDuration] = useState('');
    const [unit, setUnit] = useState<"hours" | "days" | "weeks" | "months">('days');

    const handleAdd = () => {
        if (!newComplaint.trim() || !duration) return;
        const newItem: ChiefComplaint = {
            complaint: newComplaint,
            durationValue: parseInt(duration),
            durationUnit: unit
        };
        onChange([...complaints, newItem]);
        setNewComplaint('');
        setDuration('');
        setUnit('days');
    };

    const handleRemove = (index: number) => {
        const updated = complaints.filter((_, i) => i !== index);
        onChange(updated);
    };

    return (
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chief Complaints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* List of Complaints */}
                <div className="flex flex-wrap gap-2">
                    {complaints.length === 0 && <p className="text-sm text-zinc-500 italic">No complaints recorded.</p>}
                    {complaints.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            <span className="font-medium">{c.complaint}</span>
                            <span className="text-zinc-500 dark:text-zinc-500">— {c.durationValue} {c.durationUnit}</span>
                            <button onClick={() => handleRemove(idx)} className="ml-1 text-zinc-400 hover:text-red-500 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add New Complaint Form */}
                <div className="flex flex-col sm:flex-row gap-2 items-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex-1 w-full">
                        <label className="text-xs text-zinc-500 mb-1 block">Complaint</label>
                        <Input
                            value={newComplaint}
                            onChange={e => setNewComplaint(e.target.value)}
                            placeholder="e.g. Fever"
                            className="h-9"
                        />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-zinc-500 mb-1 block">Duration</label>
                        <Input
                            type="number"
                            value={duration}
                            onChange={e => setDuration(e.target.value)}
                            placeholder="0"
                            className="h-9"
                        />
                    </div>
                    <div className="w-32">
                        <label className="text-xs text-zinc-500 mb-1 block">Unit</label>
                        <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="hours">Hours</SelectItem>
                                <SelectItem value="days">Days</SelectItem>
                                <SelectItem value="weeks">Weeks</SelectItem>
                                <SelectItem value="months">Months</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAdd} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                        <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChiefComplaints;
