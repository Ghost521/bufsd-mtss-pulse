
import React, { useState } from 'react';
import { DISTRICT_SCHOOLS } from '../constants';
import type { SchoolNode } from '../types';
import { 
  Search, 
  MapPin, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight, 
  School, 
  Activity,
  Zap
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SidebarToggleButton } from './SidebarToggleButton';

interface SchoolsMapViewProps {
  onMenuClick: () => void;
}

export const SchoolsMapView: React.FC<SchoolsMapViewProps> = ({ onMenuClick }) => {
  const [selectedSchool, setSelectedSchool] = useState<SchoolNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSchools = DISTRICT_SCHOOLS.filter(school => 
    school.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'On Track': return 'bg-emerald-500 border-emerald-200 shadow-emerald-200/50';
        case 'Watch': return 'bg-amber-500 border-amber-200 shadow-amber-200/50';
        case 'Critical': return 'bg-rose-500 border-rose-200 shadow-rose-200/50';
        default: return 'bg-slate-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
        case 'On Track': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Watch': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Critical': return 'bg-rose-100 text-rose-700 border-rose-200';
        default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
            <SidebarToggleButton
                onClick={onMenuClick}
                className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
            />
            <div>
                <h2 className="text-2xl font-bold text-slate-900">District Map</h2>
                <p className="text-slate-500 mt-1">Real-time status of {DISTRICT_SCHOOLS.length} schools.</p>
            </div>
        </div>
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
                type="text" 
                placeholder="Find school..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Map Canvas Area */}
        <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 relative overflow-hidden shadow-inner group">
            {/* Grid Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
            />
            
            {/* Mock River/Roads for visual flair */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10 text-slate-400" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,300 Q200,250 400,350 T800,300 T1200,400" fill="none" stroke="currentColor" strokeWidth="20" />
                <path d="M200,0 Q250,200 150,400" fill="none" stroke="currentColor" strokeWidth="12" />
            </svg>

            {/* School Nodes */}
            {filteredSchools.map(school => (
                <div 
                    key={school.id}
                    onClick={() => setSelectedSchool(school)}
                    className="absolute cursor-pointer transition-all duration-300 hover:scale-110 hover:z-10"
                    style={{ left: `${school.coordinates.x}%`, top: `${school.coordinates.y}%` }}
                >
                    <div className="relative flex flex-col items-center group/pin">
                        {/* Ping Animation for Critical/Watch */}
                        {school.status !== 'On Track' && (
                            <div className={`absolute w-full h-full rounded-full animate-ping opacity-75 ${getStatusColor(school.status).split(' ')[0]}`} />
                        )}
                        
                        {/* Pin Head */}
                        <div className={`w-12 h-12 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white relative z-10 ${getStatusColor(school.status)}`}>
                            <School size={20} />
                            {school.alerts > 0 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                    {school.alerts}
                                </div>
                            )}
                        </div>
                        
                        {/* Label (Visible on Hover or Selected) */}
                        <div className={`mt-2 px-3 py-1.5 bg-white rounded-lg shadow-md text-xs font-bold text-slate-700 whitespace-nowrap border border-slate-100 transition-opacity ${selectedSchool?.id === school.id ? 'opacity-100 scale-105' : 'opacity-80 group-hover/pin:opacity-100'}`}>
                            {school.name}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Details Sidebar */}
        <div className={`lg:w-96 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all duration-300 ${selectedSchool ? 'translate-x-0 opacity-100' : 'lg:translate-x-0 lg:opacity-100'}`}>
            {selectedSchool ? (
                <>
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(selectedSchool.status)}`}>
                                {selectedSchool.status}
                            </span>
                            <button onClick={() => setSelectedSchool(null)} className="text-slate-400 hover:text-slate-600 lg:hidden">
                                Close
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{selectedSchool.name}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                            <Users size={14} /> Principal {selectedSchool.principal}
                        </p>
                    </div>

                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        
                        {/* Tier Distribution Pie Chart (New) */}
                        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">MTSS Tier Distribution</h4>
                            <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={selectedSchool.tierDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {selectedSchool.tierDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-500">
                                {selectedSchool.tierDistribution.map(tier => (
                                    <div key={tier.name} className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                                        {tier.name} ({tier.value})
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Attendance</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold text-indigo-900">{selectedSchool.attendanceRate}%</span>
                                    {selectedSchool.attendanceRate < 90 && <TrendingUp size={16} className="text-rose-500 rotate-180 mb-1" />}
                                </div>
                            </div>
                            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                                <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">Tier 3 Cases</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold text-rose-900">{selectedSchool.tier3Count}</span>
                                    <AlertCircle size={16} className="text-rose-500 mb-1" />
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h4>
                            <button className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                        <Activity size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">View School Dashboard</span>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400" />
                            </button>
                            
                            <button className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                        <Zap size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-amber-700">Intervention Audit</span>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-amber-400" />
                            </button>
                        </div>

                        {/* Alerts Section */}
                        {selectedSchool.alerts > 0 && (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2 text-rose-700 font-bold text-sm">
                                    <AlertCircle size={16} />
                                    Active Alerts ({selectedSchool.alerts})
                                </div>
                                <ul className="text-xs text-rose-600 space-y-1.5 list-disc pl-4">
                                    <li>Chronic absenteeism spike in 4th Grade.</li>
                                    {selectedSchool.alerts > 1 && <li>Tier 2 fidelity dropped below 80%.</li>}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <MapPin size={48} className="mb-4 opacity-20" />
                    <p className="font-medium text-slate-600">Select a School</p>
                    <p className="text-sm">Click on a map pin to view detailed metrics and actions.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
