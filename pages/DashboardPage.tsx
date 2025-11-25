import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';
import { AppContextType, Patient, PatientStatus } from '../types';
import PatientCard from '../components/PatientCard';
import { PlusIcon, SearchIcon } from '../components/icons';

const StatCard: React.FC<{ label: string; value: number | string; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color = 'bg-brand-blue' }) => (
    <div className="bg-background-primary p-4 rounded-xl border border-border-color shadow-sm flex items-center justify-between">
        <div>
            <p className="text-sm font-medium text-text-tertiary">{label}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-full ${color} bg-opacity-10 flex items-center justify-center text-opacity-100`}>
            {icon}
        </div>
    </div>
);

const DashboardPage: React.FC = () => {
    const { patients, setPage, setSelectedPatientId, isLoading } = useContext(AppContext) as AppContextType;
    const [triageSearchTerm, setTriageSearchTerm] = useState('');

    const stats = useMemo(() => {
        const total = patients.length;
        const critical = patients.filter(p => p.triage.level === 'Red' && p.status !== 'Discharged').length;
        const waiting = patients.filter(p => p.status === 'Waiting for Triage' || p.status === 'Waiting for Doctor').length;
        return { total, critical, waiting };
    }, [patients]);

    const patientColumns = useMemo(() => {
        const waitingForTriage = patients
            .filter(p => p.status === 'Waiting for Triage')
            .filter(p => p.name.toLowerCase().includes(triageSearchTerm.toLowerCase()));

        const waitingForDoctor = patients.filter(p => p.status === 'Waiting for Doctor');
        const inTreatment = patients.filter(p => p.status === 'In Treatment');
        
        return [
            { title: 'Reception / Triage', status: 'Waiting for Triage', patients: waitingForTriage, color: 'border-t-4 border-gray-400' },
            { title: 'Provider Queue', status: 'Waiting for Doctor', patients: waitingForDoctor, color: 'border-t-4 border-yellow-400' },
            { title: 'Active Treatment', status: 'In Treatment', patients: inTreatment, color: 'border-t-4 border-brand-blue' },
        ];
    }, [patients, triageSearchTerm]);
    
    const handleTriageClick = (patientId: string) => {
        setSelectedPatientId(patientId);
        setPage('triage');
    };

    const handlePatientSelect = (patientId: string) => {
        setSelectedPatientId(patientId);
        setPage('patientDetail');
    };

    if (isLoading && patients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                <p className="text-text-tertiary animate-pulse">Syncing patient data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                    label="Total Patients" 
                    value={stats.total} 
                    icon={<span className="text-brand-blue text-xl">👥</span>} 
                    color="bg-brand-blue text-brand-blue"
                />
                <StatCard 
                    label="Critical Attention" 
                    value={stats.critical} 
                    icon={<span className="text-triage-red text-xl">⚡</span>} 
                    color="bg-triage-red text-triage-red"
                />
                <StatCard 
                    label="Waiting Room" 
                    value={stats.waiting} 
                    icon={<span className="text-yellow-600 text-xl">⏳</span>} 
                    color="bg-yellow-500 text-yellow-600"
                />
                 <button
                    onClick={() => setPage('reception')}
                    className="flex flex-col items-center justify-center p-4 bg-brand-blue text-white rounded-xl shadow-lg shadow-brand-blue/30 hover:bg-brand-blue-dark hover:scale-[1.02] transition-all"
                >
                    <PlusIcon />
                    <span className="font-semibold text-sm mt-1">Check-in Patient</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {patientColumns.map(col => (
                    <div key={col.title} className="flex flex-col h-full">
                        <div className={`bg-background-primary rounded-t-xl p-4 border-x border-t border-border-color ${col.color} shadow-sm z-10 relative`}>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-lg text-text-primary">{col.title}</h3>
                                <span className="bg-background-secondary text-text-secondary px-2 py-0.5 rounded-md text-xs font-bold border border-border-color">
                                    {col.patients.length}
                                </span>
                            </div>
                            
                            {col.status === 'Waiting for Triage' && (
                                <div className="relative mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-tertiary">
                                        <SearchIcon />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Filter by name..."
                                        value={triageSearchTerm}
                                        onChange={(e) => setTriageSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-border-color rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/50 bg-background-secondary text-input-text transition-all"
                                    />
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 bg-background-tertiary/50 dark:bg-background-secondary/20 p-4 rounded-b-xl border-x border-b border-border-color min-h-[400px]">
                            <div className="space-y-4">
                                {col.patients.length > 0 ? (
                                    col.patients.map(p => <PatientCard key={p.id} patient={p} onTriageClick={handleTriageClick} onClick={handlePatientSelect} />)
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-32 text-text-tertiary opacity-60">
                                        <div className="w-12 h-12 bg-border-color rounded-full mb-2"></div>
                                        <span className="text-sm">Queue Empty</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardPage;