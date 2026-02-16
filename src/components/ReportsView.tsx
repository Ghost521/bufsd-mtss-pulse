
import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  School, 
  BrainCircuit,
  Share2,
  X,
  Sparkles,
  FileText
} from 'lucide-react';
import { UserRole } from '../types';
import { DISTRICT_SCHOOLS } from '../constants';
import { RichTextRenderer } from './RichTextRenderer';

interface ReportsViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
}

type ReportTab = 'Executive' | 'Academics' | 'Behavior' | 'Interventions';

// --- Mock Data for Reports ---

const MONTHLY_TRENDS = [
  { name: 'Aug', attendance: 96, chronic: 4, behavior: 12 },
  { name: 'Sep', attendance: 95, chronic: 5, behavior: 18 },
  { name: 'Oct', attendance: 94, chronic: 6, behavior: 25 },
  { name: 'Nov', attendance: 91, chronic: 9, behavior: 32 },
  { name: 'Dec', attendance: 92, chronic: 8, behavior: 20 },
  { name: 'Jan', attendance: 93, chronic: 7, behavior: 28 },
];

const ACADEMIC_DATA = [
  { grade: '3rd', math: 78, reading: 82, science: 85 },
  { grade: '4th', math: 72, reading: 75, science: 80 },
  { grade: '5th', math: 85, reading: 88, science: 86 },
  { grade: '6th', math: 68, reading: 70, science: 75 },
];

const TIER_DISTRIBUTION = [
  { name: 'Tier 1 (Core)', value: 780, color: '#10b981' },
  { name: 'Tier 2 (Targeted)', value: 150, color: '#f59e0b' },
  { name: 'Tier 3 (Intensive)', value: 70, color: '#f43f5e' },
];

const INTERVENTION_EFFICACY = [
  { name: 'LLI', success: 65, active: 40 },
  { name: 'Check-In/Out', success: 82, active: 25 },
  { name: 'Math 180', success: 55, active: 30 },
  { name: 'Social Skills', success: 70, active: 20 },
];

const SCHOOL_PERFORMANCE = DISTRICT_SCHOOLS.map(s => ({
    name: s.name,
    attendance: s.attendanceRate,
    tier3: s.tier3Count,
    fidelity: Math.floor(Math.random() * (100 - 80) + 80) // Random fidelity 80-100
}));

const MOCK_FULL_ANALYSIS = `
### Executive Summary
The district is currently stabilizing after a seasonal dip in November. Overall **attendance has recovered to 93.5%**, showing a positive trend (+0.5%) month-over-month. However, significant disparities remain between elementary and middle school engagement levels.

### Key Anomalies Detected
1. **West Middle School Attendance**: Grade 8 attendance dropped by 3% last week, correlating with a spike in disciplinary referrals.
2. **Tier 3 Capacity**: Northeast Elementary has exceeded its Tier 3 intervention capacity by 15%, potentially impacting fidelity scores.
3. **Math Proficiency**: 4th Grade math scores across the district have stagnated at 72%, despite increased intervention hours.

### Strategic Recommendations
*   **Targeted Resource Allocation**: Deploy additional behavioral support staff to West Middle School for the next 4 weeks.
*   **Professional Development**: Schedule a district-wide training on "Tier 2 Math Interventions" to address the 4th-grade stagnation.
*   **Attendance Campaign**: Launch a "Winter Attendance Challenge" specifically targeting grades 6-8 to combat chronic absenteeism trends.

### Predicted Outlook
Based on current trends, without intervention, chronic absenteeism in middle schools may rise to **14% by February**. Immediate action on the recommendations above is projected to flatten this curve.
`;

const REPORT_TABS: ReportTab[] = ['Executive', 'Academics', 'Behavior', 'Interventions'];

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUserRole, currentUserName: _currentUserName }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('Executive');
  const [dateRange, setDateRange] = useState('This School Year');
  const [selectedSchool, setSelectedSchool] = useState<string>('All Schools');
  const [isExporting, setIsExporting] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  // Handle Export Simulation
  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert("Report generated and downloaded successfully.");
    }, 1500);
  };

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Attendance</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">93.5%</h3>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Users size={18} />
          </div>
        </div>
        <div className="mt-3 text-xs font-medium text-emerald-600 flex items-center gap-1">
          <TrendingUp size={12} /> +0.5% vs last month
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chronic Absenteeism</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">12.2%</h3>
          </div>
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <AlertCircle size={18} />
          </div>
        </div>
        <div className="mt-3 text-xs font-medium text-rose-600 flex items-center gap-1">
          <TrendingUp size={12} /> +1.2% vs last month
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Math Proficiency</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">76%</h3>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <TrendingUp size={18} />
          </div>
        </div>
        <div className="mt-3 text-xs font-medium text-slate-400">
          Benchmark 2 Results
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Intervention Success</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">68%</h3>
          </div>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="mt-3 text-xs font-medium text-indigo-600 flex items-center gap-1">
          On track to meet annual goal
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-indigo-600" /> 
              {currentUserRole === UserRole.DISTRICT ? 'District Intelligence Report' : 'School Performance Report'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Comprehensive data analysis for strategic decision making.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                  <option>This School Year</option>
                  <option>Last Quarter (Q1)</option>
                  <option>Last Month</option>
                  <option>Last Year (Historical)</option>
              </select>
              <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {currentUserRole === UserRole.DISTRICT && (
              <div className="relative">
                <select 
                    value={selectedSchool}
                    onChange={(e) => setSelectedSchool(e.target.value)}
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                    <option>All Schools</option>
                    {DISTRICT_SCHOOLS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <School size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}

            <div className="h-10 w-px bg-slate-200 mx-1 hidden md:block"></div>

            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download size={16} /> Export PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-6 overflow-x-auto">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-bold transition-colors relative whitespace-nowrap ${
                  activeTab === tab 
                    ? 'text-indigo-600 border-b-2 border-indigo-600' 
                    : 'text-slate-500 hover:text-slate-800 hover:border-b-2 hover:border-slate-200'
                }`}
              >
                {tab} Summary
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {renderSummaryCards()}

          {/* EXECUTIVE DASHBOARD */}
          {activeTab === 'Executive' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Trend Chart */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800">Attendance vs. Behavior Trends</h3>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Attendance %</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /> Incidents</span>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MONTHLY_TRENDS}>
                      <defs>
                        <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorBeh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
                      <YAxis yAxisId="left" domain={[80, 100]} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="attendance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAtt)" />
                      <Area yAxisId="right" type="monotone" dataKey="behavior" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorBeh)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tier Distribution */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2">MTSS Tier Distribution</h3>
                <p className="text-xs text-slate-500 mb-6">Current student population breakdown</p>
                
                <div className="h-48 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={TIER_DISTRIBUTION}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {TIER_DISTRIBUTION.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-800">1000</span>
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Students</span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {TIER_DISTRIBUTION.map((item) => (
                    <div key={item.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-slate-600 font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div className="lg:col-span-3 bg-gradient-to-r from-indigo-50 to-violet-50 p-6 rounded-xl border border-indigo-100 flex flex-col md:flex-row gap-6 items-start">
                  <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600">
                      <BrainCircuit size={24} />
                  </div>
                  <div className="flex-1">
                      <h3 className="font-bold text-indigo-900 text-lg mb-2">AI Strategic Insights</h3>
                      <ul className="space-y-2">
                          <li className="flex items-start gap-2 text-sm text-slate-700">
                              <TrendingUp size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                              <span><strong>Attendance Alert:</strong> While overall attendance is up (+0.5%), Grade 4 shows a 3% dip in the last week. Consider a targeted campaign.</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-slate-700">
                              <TrendingUp size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                              <span><strong>Intervention Efficacy:</strong> "Check-In/Check-Out" has an 82% success rate this quarter, outperforming other behavioral interventions.</span>
                          </li>
                      </ul>
                  </div>
                  <button 
                      onClick={() => setShowFullAnalysis(true)}
                      className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded-lg shadow-sm hover:bg-indigo-50 transition-colors"
                  >
                      View Full Analysis
                  </button>
              </div>

              {/* School Performance Table (District Only) */}
              {currentUserRole === UserRole.DISTRICT && (
                  <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="font-bold text-slate-800">School Performance Matrix</h3>
                          <button className="text-sm text-indigo-600 font-bold hover:underline">View All Schools</button>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                  <tr>
                                      <th className="px-6 py-4">School Name</th>
                                      <th className="px-6 py-4 text-center">Attendance Rate</th>
                                      <th className="px-6 py-4 text-center">Tier 3 Cases</th>
                                      <th className="px-6 py-4 text-center">MTSS Fidelity</th>
                                      <th className="px-6 py-4 text-right">Status</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {SCHOOL_PERFORMANCE.map((school, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                          <td className="px-6 py-4 font-bold text-slate-700">{school.name}</td>
                                          <td className="px-6 py-4 text-center">
                                              <span className={`font-bold ${school.attendance < 90 ? 'text-rose-600' : 'text-emerald-600'}`}>{school.attendance}%</span>
                                          </td>
                                          <td className="px-6 py-4 text-center">{school.tier3}</td>
                                          <td className="px-6 py-4 text-center">
                                              <div className="w-24 h-2 bg-slate-200 rounded-full mx-auto overflow-hidden">
                                                  <div className="h-full bg-indigo-500" style={{ width: `${school.fidelity}%` }} />
                                              </div>
                                              <span className="text-xs text-slate-400 mt-1 block">{school.fidelity}%</span>
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${school.attendance < 90 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                  {school.attendance < 90 ? 'Critical' : 'On Track'}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
            </div>
          )}

          {/* ACADEMICS DASHBOARD */}
          {activeTab === 'Academics' && (
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-6">Proficiency by Grade Level</h3>
                      <div className="h-80 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={ACADEMIC_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} domain={[0, 100]} />
                                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                  <Bar dataKey="math" name="Math" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                  <Bar dataKey="reading" name="Reading" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                  <Bar dataKey="science" name="Science" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          )}

          {/* INTERVENTIONS DASHBOARD */}
          {activeTab === 'Interventions' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-2">Intervention Efficacy</h3>
                      <p className="text-sm text-slate-500 mb-6">Success rate of active programs vs. volume.</p>
                      
                      <div className="space-y-6">
                          {INTERVENTION_EFFICACY.map(item => (
                              <div key={item.name}>
                                  <div className="flex justify-between mb-2">
                                      <span className="font-bold text-slate-700 text-sm">{item.name}</span>
                                      <div className="text-xs font-medium text-slate-500">
                                          <span className={item.success > 70 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{item.success}% Success</span> • {item.active} Active
                                      </div>
                                  </div>
                                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                      <div className="h-full bg-indigo-500" style={{ width: `${item.success}%` }} />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-2">Referral Trends</h3>
                      <p className="text-sm text-slate-500 mb-6">New Tier 2/3 referrals over time.</p>
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={MONTHLY_TRENDS}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                  <Line type="monotone" dataKey="chronic" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, fill: '#f43f5e'}} />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          )}

        </div>
      </div>

      {/* Full Analysis Modal - Moved outside the animated container */}
      {showFullAnalysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={24} /> Strategic District Analysis
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">AI-Generated Executive Intelligence</p>
                    </div>
                    <button 
                        onClick={() => setShowFullAnalysis(false)} 
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-8 overflow-y-auto bg-slate-50/30 flex-1">
                    <div className="prose prose-indigo max-w-none">
                        <RichTextRenderer content={MOCK_FULL_ANALYSIS} />
                    </div>
                </div>
                <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <button onClick={() => setShowFullAnalysis(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                        Close
                    </button>
                    <button 
                        onClick={() => {
                            alert("Analysis report sent to all stakeholders.");
                            setShowFullAnalysis(false);
                        }}
                        className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                    >
                        <Share2 size={16} /> Share Report
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
