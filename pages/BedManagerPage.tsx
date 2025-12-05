import React, { useState, useMemo, useContext } from 'react';
import { AppContext } from '../App';
import { AppContextType, Patient, TriageLevel } from '../types';
import { logDebug } from '../utils/logger';
import { SearchIcon, UserCircleIcon, XMarkIcon } from '../components/icons';

// Types for Bed Manager
type BedStatus = 'Available' | 'Occupied' | 'Cleaning';
type WardType = 'General Medicine' | 'ICU' | 'Surgery' | 'Emergency' | 'Pediatrics';

interface Bed {
    id: string;
    label: string;
    ward: WardType;
    status: BedStatus;
    patientId?: string;
    patientName?: string;
    admissionDate?: string;
    predictedDischarge?: string;
}

// Generate 500 Mock Beds
const WARD_CONFIG: { type: WardType; count: number; prefix: string }[] = [
    { type: 'ICU', count: 20, prefix: 'ICU' },
    { type: 'Emergency', count: 30, prefix: 'ER' },
    { type: 'Surgery', count: 50, prefix: 'SUR' },
    { type: 'General Medicine', count: 100, prefix: 'GEN' },
    { type: 'Pediatrics', count: 50, prefix: 'PED' },
    // Fill simpler wards for the rest
    { type: 'General Medicine', count: 250, prefix: 'W' },
];

const generateBeds = (patients: Patient[]): Bed[] => {
    let beds: Bed[] = [];
    let patientIndex = 0;

    // Create a pool of "occupied" patients from the context
    const admittedPatients = patients.filter(p => p.status === 'In Treatment');

    WARD_CONFIG.forEach(config => {
        for (let i = 1; i <= config.count; i++) {
            const isOccupied = Math.random() > 0.4 && patientIndex < admittedPatients.length; // 60% occupancy cap or patient count
            const isCleaning = !isOccupied && Math.random() > 0.8;

            const bed: Bed = {
                id: `bed-${config.prefix}-${i}`,
                label: `${config.prefix}-${i.toString().padStart(3, '0')}`,
                ward: config.type,
                status: isOccupied ? 'Occupied' : isCleaning ? 'Cleaning' : 'Available',
            };

            if (isOccupied && admittedPatients[patientIndex]) {
                const p = admittedPatients[patientIndex];
                bed.patientId = p.id;
                bed.patientName = p.name;
                bed.admissionDate = p.registrationTime;
                // Mock prediction
                bed.predictedDischarge = Math.random() > 0.5 ? "1-2 days" : "Today";
                patientIndex++;
            }
            beds.push(bed);
        }
    });
    return beds;
};

// UI Components

const BedCard: React.FC<{ bed: Bed; onClick: (bed: Bed) => void }> = React.memo(({ bed, onClick }) => {
    const statusColors = {
        Available: 'bg-green-50 border-green-200 hover:border-green-400',
        Occupied: 'bg-white border-red-200 hover:border-red-400 shadow-sm',
        Cleaning: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
    };

    const statusBadge = {
        Available: 'bg-green-100 text-green-700',
        Occupied: 'bg-red-100 text-red-700',
        Cleaning: 'bg-yellow-100 text-yellow-700',
    };

    return (
        <div
            onClick={() => onClick(bed)}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-28 ${statusColors[bed.status]}`}
        >
            <div className="flex justify-between items-start">
                <span className="font-mono font-bold text-lg text-text-primary">{bed.label}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusBadge[bed.status]}`}>
                    {bed.status}
                </span>
            </div>

            {bed.status === 'Occupied' ? (
                <div>
                    <p className="font-semibold text-sm text-text-primary truncate">{bed.patientName}</p>
                    <div className="flex justify-between items-end mt-1">
                        <span className="text-xs text-text-tertiary">Day {Math.floor(Math.random() * 5) + 1}</span>
                    </div>
                </div>
            ) : (
                <div className="flex items-end h-full">
                    <span className="text-xs text-text-tertiary italic">{bed.status === 'Cleaning' ? 'Housekeeping...' : 'Ready'}</span>
                </div>
            )}
        </div>
    );
});

const BedDetailDrawer: React.FC<{ bed: Bed | null; onClose: () => void; onGoToPatient: (id: string) => void }> = ({ bed, onClose, onGoToPatient }) => {
    if (!bed) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-background-primary shadow-2xl border-l border-border-color transform transition-transform duration-300 z-50 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-text-primary">{bed.label}</h3>
                <button onClick={onClose} className="p-2 hover:bg-background-secondary rounded-full"><XMarkIcon /></button>
            </div>

            <div className="flex-1 space-y-6">
                <div className={`p-4 rounded-xl border ${bed.status === 'Occupied' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                    <span className="block text-xs font-bold uppercase text-text-secondary mb-1">Current Status</span>
                    <span className={`text-lg font-bold ${bed.status === 'Occupied' ? 'text-red-700' : 'text-green-700'}`}>{bed.status}</span>
                </div>

                {bed.status === 'Occupied' && (
                    <>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-text-tertiary uppercase">Patient</label>
                                <p className="text-xl font-semibold text-text-primary flex items-center gap-2">
                                    <UserCircleIcon className="w-6 h-6 text-brand-blue" />
                                    {bed.patientName}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-tertiary uppercase">Admission</label>
                                <p className="text-sm text-text-secondary">{new Date(bed.admissionDate!).toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-tertiary uppercase">AI Discharge Prediction</label>
                                <p className="text-sm text-brand-blue font-medium bg-brand-blue/10 p-2 rounded-lg inline-block mt-1">
                                    {bed.predictedDischarge}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => onGoToPatient(bed.patientId!)}
                            className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark transition-all mt-8"
                        >
                            Open Patient File
                        </button>
                    </>
                )}

                {bed.status === 'Available' && (
                    <div className="text-center py-10 text-text-tertiary">
                        <p>This bed is currently available.</p>
                        <p className="text-xs mt-2">Assign a patient from the Reception or Triage view.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const BedManagerPage: React.FC = () => {
    const { patients, setSelectedPatientId, setPage } = useContext(AppContext) as AppContextType;
    const [selectedWard, setSelectedWard] = useState<WardType | 'All'>('All');
    const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Memoize the bed generation to prevent regeneration on every render
    // In a real app, this would come from a `useBeds` hook or backend
    const allBeds = useMemo(() => generateBeds(patients), [patients]);

    const filteredBeds = useMemo(() => {
        return allBeds.filter(bed => {
            const matchesWard = selectedWard === 'All' || bed.ward === selectedWard;
            const matchesSearch = bed.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  bed.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesWard && matchesSearch;
        });
    }, [allBeds, selectedWard, searchTerm]);

    const handleBedClick = (bed: Bed) => {
        setSelectedBed(bed);
    };

    const handleGoToPatient = (id: string) => {
        setSelectedPatientId(id);
        setPage('patientDetail');
    };

    const wards: WardType[] = ['General Medicine', 'ICU', 'Surgery', 'Emergency', 'Pediatrics'];

    // Calculate Stats
    const stats = useMemo(() => {
        const total = allBeds.length;
        const occupied = allBeds.filter(b => b.status === 'Occupied').length;
        const available = allBeds.filter(b => b.status === 'Available').length;
        return { total, occupied, available, occupancyRate: Math.round((occupied/total)*100) };
    }, [allBeds]);

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 h-[calc(100vh-100px)] flex flex-col">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background-primary p-4 rounded-xl border border-border-color shadow-sm">
                    <span className="text-xs text-text-tertiary font-bold uppercase">Total Capacity</span>
                    <p className="text-2xl font-bold text-text-primary">{stats.total} <span className="text-sm font-normal text-text-tertiary">Beds</span></p>
                </div>
                <div className="bg-background-primary p-4 rounded-xl border border-border-color shadow-sm">
                    <span className="text-xs text-text-tertiary font-bold uppercase">Occupancy</span>
                    <p className="text-2xl font-bold text-brand-blue">{stats.occupancyRate}%</p>
                </div>
                <div className="bg-background-primary p-4 rounded-xl border border-border-color shadow-sm">
                    <span className="text-xs text-text-tertiary font-bold uppercase">Available</span>
                    <p className="text-2xl font-bold text-green-600">{stats.available}</p>
                </div>
                <div className="bg-background-primary p-4 rounded-xl border border-border-color shadow-sm">
                    <span className="text-xs text-text-tertiary font-bold uppercase">Critical (ICU)</span>
                    <p className="text-2xl font-bold text-red-600">{allBeds.filter(b => b.ward === 'ICU' && b.status === 'Occupied').length} <span className="text-sm font-normal text-text-tertiary">/ {WARD_CONFIG.find(w=>w.type==='ICU')?.count}</span></p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-background-primary p-4 rounded-xl border border-border-color shadow-sm">
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                    <button
                        onClick={() => setSelectedWard('All')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedWard === 'All' ? 'bg-brand-blue text-white' : 'bg-background-secondary text-text-secondary hover:bg-background-tertiary'}`}
                    >
                        All Wards
                    </button>
                    {wards.map(ward => (
                        <button
                            key={ward}
                            onClick={() => setSelectedWard(ward)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedWard === ward ? 'bg-brand-blue text-white' : 'bg-background-secondary text-text-secondary hover:bg-background-tertiary'}`}
                        >
                            {ward}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <SearchIcon className="absolute left-3 top-2.5 text-text-tertiary w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search bed or patient..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-border-color rounded-lg bg-background-secondary focus:ring-2 focus:ring-brand-blue/20 outline-none"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pr-2 pb-10">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {filteredBeds.map(bed => (
                        <BedCard key={bed.id} bed={bed} onClick={handleBedClick} />
                    ))}
                </div>
                {filteredBeds.length === 0 && (
                    <div className="text-center py-20 text-text-tertiary">
                        No beds found matching your filters.
                    </div>
                )}
            </div>

            {/* Detail Drawer */}
            {selectedBed && (
                <>
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setSelectedBed(null)}></div>
                    <BedDetailDrawer bed={selectedBed} onClose={() => setSelectedBed(null)} onGoToPatient={handleGoToPatient} />
                </>
            )}
        </div>
    );
};

export default BedManagerPage;
