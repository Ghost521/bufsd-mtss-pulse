
import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Activity, Clock, FileText, Calendar, Sparkles, Plus, Mail, Smartphone, Loader2, BrainCircuit, Upload, FileUp, CheckCircle2, Eye, Ear, ShieldAlert, FileBadge, Pencil, Save } from 'lucide-react';
import type { StudentDetails, ActivityLog } from '../types';
import { Tier } from '../types';
import type { AnalyzedDocumentResult } from '../services/geminiService';
import { analyzeUploadedDocument } from '../services/geminiService';
import { getStudentDetails } from '../constants';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string | null;
  onViewFullProfile?: (studentName: string) => void;
  onMessageParents?: () => void;
}

const READING_LEVELS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  studentName, 
  onViewFullProfile,
  onMessageParents
}) => {
  
  // Initialize with null, will load in effect
  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // State for Timeline
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // State for File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Load details when studentName changes
  useEffect(() => {
    if (studentName) {
        const data = getStudentDetails(studentName);
        setDetails(data);
        setActivityLog(data.recentActivity);
        setHasMoreHistory(true);
        setIsLoadingHistory(false);
        setUploadSuccess(null);
        setIsEditing(false);
    }
  }, [studentName]);

  if (!isOpen || !studentName || !details) return null;

  const getTierColor = (tier: Tier) => {
    switch (tier) {
      case Tier.TIER_1: return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-200';
      case Tier.TIER_2: return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-200';
      case Tier.TIER_3: return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-200';
      default: return 'bg-slate-50 text-slate-700 ring-slate-200';
    }
  };

  const handleMessageParentsClick = () => {
    if (onMessageParents) {
      onMessageParents();
    } else {
      alert(`Opening messaging interface for ${studentName}'s guardians...`);
    }
  };

  const handleSmsParent = () => {
    alert(`Opening SMS composer for ${studentName}'s guardians...`);
  };

  const handleViewFullProfile = () => {
    if (onViewFullProfile && studentName) {
      onViewFullProfile(studentName);
    }
  };

  const handleSaveDetails = () => {
      setIsEditing(false);
      // In a real app, save to backend here
  };

  const loadOlderHistory = () => {
    setIsLoadingHistory(true);
    // Simulate API delay
    setTimeout(() => {
      const olderItems = [
        { date: 'Oct 28', type: 'Academic', note: 'Completed Reading Benchmark.' },
        { date: 'Oct 12', type: 'Intervention', note: 'Started LLI Group B.' },
        { date: 'Sep 30', type: 'Behavior', note: 'Positive referral: Helping peer.' },
      ];
      setActivityLog(prev => [...prev, ...olderItems]);
      setHasMoreHistory(false); // Simulating end of history
      setIsLoadingHistory(false);
    }, 800);
  };

  // --- File Upload Handlers ---
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setUploadSuccess(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        const result: AnalyzedDocumentResult = await analyzeUploadedDocument(
          base64Data, 
          file.type, 
          studentName
        );

        const newEntry = {
          date: result.date,
          type: result.type,
          note: `${result.summary} ${result.suggestedAction ? `(Action: ${result.suggestedAction})` : ''}`,
          isNew: true,
          source: 'document'
        };

        setActivityLog(prev => [newEntry, ...prev]);
        setUploadSuccess("Document analyzed and added to history.");
      };

    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to analyze document.");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadSuccess(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300 border border-slate-100 rounded-t-2xl">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start p-6 md:p-8 pb-6 border-b border-slate-100 bg-white relative z-10 gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
            
            {/* Avatar Section */}
            <div className="relative group cursor-pointer self-center sm:self-auto">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden ring-1 ring-slate-100">
                <img 
                  src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${studentName}&backgroundColor=e0e7ff`} 
                  alt={studentName}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-[3px] border-white flex items-center justify-center text-xs font-bold text-white shadow-md transition-transform group-hover:scale-110 ${
                  details.tier === Tier.TIER_1 ? 'bg-emerald-500' : 
                  details.tier === Tier.TIER_2 ? 'bg-amber-500' : 'bg-rose-500'
                }`} title={`Current Status: ${details.tier}`}>
                {details.tier.split(' ')[1]}
              </div>
            </div>

            <div className="text-center sm:text-left w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 mb-1">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{studentName}</h2>
                <span 
                  title="Student ID Number"
                  className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 cursor-help hover:bg-slate-200 transition-colors"
                >
                  {details.id}
                </span>
              </div>
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-y-2 gap-x-3 mt-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-sm font-medium border border-slate-200">
                  {details.grade}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {details.teacher}
                </span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                
                {/* Editable Tier Badge */}
                {isEditing ? (
                    <select 
                        value={details.tier}
                        onChange={(e) => setDetails({...details, tier: e.target.value as Tier})}
                        className="text-xs font-bold px-2 py-0.5 rounded-md border border-indigo-200 bg-white text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
                        <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
                        <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
                    </select>
                ) : (
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ring-1 ring-inset ${getTierColor(details.tier)}`}>
                        {details.tier}
                    </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto">
             {isEditing ? (
                 <button 
                    onClick={handleSaveDetails}
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-sm"
                    title="Save Changes"
                 >
                    <Save size={18} />
                 </button>
             ) : (
                 <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                    title="Edit Details"
                 >
                    <Pencil size={18} />
                 </button>
             )}
             <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all duration-200"
             >
                <X size={24} />
             </button>
          </div>
        </div>

        {/* Critical Info Banner */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center text-xs">
            {details.support.planType !== 'None' && (
                <span className="flex items-center gap-1.5 font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded border border-indigo-200">
                    <FileBadge size={14} /> {details.support.planType} Active
                </span>
            )}
            {details.medical.allergies.length > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded border border-rose-200">
                    <ShieldAlert size={14} /> Allergy: {details.medical.allergies.join(', ')}
                </span>
            )}
            {details.medical.conditions.length > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded border border-amber-200">
                    <Activity size={14} /> {details.medical.conditions.join(', ')}
                </span>
            )}
            <span className="flex items-center gap-1 text-slate-500 ml-auto">
                {details.medical.visionScreening.status === 'Corrected' ? <Eye size={14} className="text-indigo-500" /> : <Eye size={14} />} Vision: {details.medical.visionScreening.status}
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 text-slate-500">
                <Ear size={14} /> Hearing: {details.medical.hearingScreening.status}
            </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30">
          
          {/* Key Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 mb-8">
            <div className="p-4 md:p-5 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex sm:block justify-between items-center">
              <div className="flex items-center gap-2 text-slate-500 sm:mb-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                  <Clock size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Attendance</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl md:text-3xl font-bold tracking-tight ${details.attendance < 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {details.attendance}%
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase">YTD</span>
              </div>
            </div>

            <div className="p-4 md:p-5 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex sm:block justify-between items-center">
              <div className="flex items-center gap-2 text-slate-500 sm:mb-2">
                 <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                  <BookOpen size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Reading Lvl</span>
              </div>
              <div className="flex items-baseline gap-2">
                {isEditing ? (
                    <select 
                        value={details.readingLevel}
                        onChange={(e) => setDetails({...details, readingLevel: e.target.value})}
                        className="text-2xl font-bold text-slate-800 border-b-2 border-indigo-200 bg-transparent focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                        {READING_LEVELS.map(level => (
                            <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                ) : (
                    <span className="text-2xl md:text-3xl font-bold text-slate-800">{details.readingLevel}</span>
                )}
                <span className="text-xs text-slate-400 font-medium uppercase">F&P Scale</span>
              </div>
            </div>

            <div className="p-4 md:p-5 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex sm:block justify-between items-center">
              <div className="flex items-center gap-2 text-slate-500 sm:mb-2">
                 <div className="p-1.5 bg-violet-50 text-violet-600 rounded-md">
                  <Activity size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">GPA</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-bold text-slate-800">{details.gpa}</span>
                <span className="text-xs text-slate-400 font-medium uppercase">Scale 4.0</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
            
            {/* Left Column: Interventions & AI */}
            <div className="space-y-6 md:space-y-8">
              
              {/* Intervention History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <FileText size={18} className="text-slate-400"/>
                    Intervention Plans
                  </h3>
                  <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                    View All History
                  </button>
                </div>
                <div className="space-y-4">
                  {details.interventions.map((plan) => (
                    <div key={plan.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="font-bold text-slate-800 text-sm block mb-1">{plan.name}</span>
                          <span className="text-xs text-slate-400">Started {plan.date}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          plan.status === 'Active' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${plan.status === 'Active' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                          style={{ width: `${plan.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-end mt-1.5">
                        <span className="text-xs font-medium text-slate-500">{plan.progress}% Goal Met</span>
                      </div>
                    </div>
                  ))}
                  <button className="w-full py-3 text-sm text-slate-600 font-medium border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all flex items-center justify-center gap-2 group">
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center group-hover:bg-slate-300 group-hover:text-slate-700 transition-colors">
                      <Plus size={12} strokeWidth={3} />
                    </div>
                    Create New Intervention
                  </button>
                </div>
              </div>

              {/* AI Intervention Recommendations */}
              <div className="bg-gradient-to-br from-indigo-50/80 to-white rounded-xl border border-indigo-100/80 p-6 relative overflow-hidden shadow-sm ring-1 ring-indigo-50">
                 <div className="absolute -top-6 -right-6 p-4 opacity-[0.03] pointer-events-none">
                    <Sparkles size={180} />
                 </div>
                 <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-5 flex items-center gap-2 relative z-10">
                    <div className="p-1 bg-indigo-100 rounded-md">
                      <BrainCircuit size={14} className="text-indigo-600" />
                    </div>
                    AI Recommendations
                 </h3>
                 <div className="space-y-3 relative z-10">
                    {details.aiRecommendations.map((rec) => (
                      <div key={rec.id} className="bg-white/80 backdrop-blur-sm border border-indigo-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 group/card">
                         
                         <div className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                               <div>
                                  <h4 className="text-sm font-bold text-slate-800 mb-1">{rec.name}</h4>
                                  <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                                        rec.confidenceLevel === 'High' 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                          : 'bg-amber-50 text-amber-700 border-amber-100'
                                    }`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${
                                        rec.confidenceLevel === 'High' ? 'bg-emerald-500' : 'bg-amber-500'
                                      }`} />
                                      {rec.confidenceScore}% Confidence
                                    </div>
                                  </div>
                               </div>
                               <button className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all group-hover/card:bg-indigo-700">
                                 <Plus size={14} className="text-indigo-200 group-hover/card:text-white transition-colors" />
                                 Add
                               </button>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100/80">
                              <div className="flex gap-2 items-start">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-14 shrink-0 pt-0.5">Why</span>
                                <p className="text-xs text-slate-600 leading-relaxed">{rec.reason}</p>
                              </div>
                              <div className="flex gap-2 items-start">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider w-14 shrink-0 pt-0.5">Action</span>
                                <p className="text-xs font-medium text-indigo-900 leading-relaxed bg-indigo-50/50 px-2 py-1 rounded -ml-2 w-full">
                                  {rec.action}
                                </p>
                              </div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* Right Column: Timeline */}
            <div className="space-y-6 md:space-y-8">
              
              {/* File Upload Section */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                 <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                       <FileUp size={18} className="text-indigo-600" />
                       Analyze Document
                    </h3>
                    <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">New</span>
                 </div>
                 <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                   Upload report cards, behavior logs, or notes. AI will analyze and add them to the history.
                 </p>
                 
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                 />
                 
                 {uploadSuccess ? (
                   <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center gap-3 text-sm text-emerald-700 animate-in fade-in">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      {uploadSuccess}
                   </div>
                 ) : (
                   <button 
                      onClick={handleUploadClick}
                      disabled={isAnalyzing}
                      className="w-full py-2.5 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-300 transition-all group flex flex-col items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-wait"
                   >
                      {isAnalyzing ? (
                        <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                          <Loader2 size={16} className="animate-spin" />
                          Analyzing Document...
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 group-hover:text-indigo-800">
                            <Upload size={16} />
                            Click to Upload
                          </div>
                          <span className="text-[10px] text-indigo-400">PDF, PNG, or JPG</span>
                        </>
                      )}
                   </button>
                 )}
              </div>

              {/* Activity Timeline */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Calendar size={18} className="text-slate-400"/>
                    Recent Activity
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Last 30 Days</span>
                </div>
                
                <div className="relative pl-4 space-y-8 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200/60">
                  {activityLog.map((activity, idx) => {
                    const isAiGenerated = activity.source === 'document';
                    return (
                    <div key={idx} className={`relative pl-8 group animate-in fade-in slide-in-from-bottom-2 duration-500`} style={{ animationDelay: `${idx * 100}ms` }}>
                      
                      {/* Node Dot */}
                      <div className={`absolute left-[11px] top-1.5 w-[13px] h-[13px] -translate-x-1/2 rounded-full border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-125 ${
                        isAiGenerated ? 'bg-indigo-500 ring-2 ring-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.5)]' :
                        activity.type === 'Behavior' ? 'bg-rose-400 ring-2 ring-rose-100' :
                        activity.type === 'Attendance' ? 'bg-amber-400 ring-2 ring-amber-100' : 'bg-emerald-400 ring-2 ring-emerald-100'
                      }`} />

                      {/* Card Content */}
                      <div className={`flex flex-col p-4 rounded-xl border shadow-sm hover:shadow-md transition-all duration-300 -mt-2 ${
                        activity.isNew 
                          ? 'bg-gradient-to-r from-indigo-50/50 to-white border-indigo-200 shadow-indigo-50 ring-1 ring-indigo-100 transform scale-[1.02]' 
                          : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                             <span className={`text-sm font-bold ${activity.isNew ? 'text-indigo-900' : 'text-slate-800'}`}>
                                {activity.type} Update
                             </span>
                             
                             {isAiGenerated && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 animate-in fade-in zoom-in">
                                   <Sparkles size={10} className="animate-pulse text-indigo-500" />
                                   AI Insight
                                </span>
                             )}
                             
                             {activity.isNew && !isAiGenerated && (
                               <span className="text-[10px] font-bold text-white bg-indigo-600 px-1.5 py-0.5 rounded shadow-sm animate-pulse">NEW</span>
                             )}
                          </div>
                          <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded">{activity.date}</span>
                        </div>
                        <p className={`text-sm leading-relaxed ${activity.isNew ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                          {activity.note}
                        </p>
                      </div>
                    </div>
                  )})}
                  
                  {/* Load More / Empty State */}
                  <div className="relative pl-8 pt-2">
                    <div className="absolute left-[11px] top-3 w-2 h-2 -translate-x-1/2 rounded-full bg-slate-300 ring-4 ring-white z-10" />
                    {hasMoreHistory ? (
                      <button 
                        onClick={loadOlderHistory}
                        disabled={isLoadingHistory}
                        className="text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 -ml-3 rounded-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isLoadingHistory ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Loading history...
                            </>
                          ) : (
                            'View older history...'
                          )}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic px-1 py-1 block mt-1">
                        No older history available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] gap-4 sm:gap-0">
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={handleMessageParentsClick}
              className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-white hover:border-slate-300 hover:text-slate-900 rounded-lg transition-all shadow-sm"
            >
              <Mail size={16} className="text-slate-500" />
              <span className="sm:hidden">Message</span>
              <span className="hidden sm:inline">Message Parents</span>
            </button>
            <button 
              onClick={handleSmsParent}
              className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-white hover:border-slate-300 hover:text-slate-900 rounded-lg transition-all shadow-sm"
            >
              <Smartphone size={16} className="text-slate-500" />
              <span className="sm:hidden">SMS</span>
              <span className="hidden sm:inline">Send SMS</span>
            </button>
          </div>
          <button 
            onClick={handleViewFullProfile}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-slate-800 hover:shadow-lg transform active:scale-95 transition-all duration-150"
          >
            View Full Profile
          </button>
        </div>
      </div>
    </div>
  );
};
