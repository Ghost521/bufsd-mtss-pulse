
import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Database, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  BrainCircuit, 
  ChevronRight,
  LayoutList,
  Menu,
  FileText,
  Image as ImageIcon,
  ClipboardPaste,
  Users
} from 'lucide-react';
import type { ImportAnalysisResult} from '../services/geminiService';
import { analyzeImportedBatch, extractDataFromDocument } from '../services/geminiService';
import { UserRole } from '../types';

interface DataImporterProps {
  onMenuClick: () => void;
  onImportComplete?: () => void;
  currentUserRole: UserRole;
}

type ImportStep = 'source' | 'upload' | 'mapping' | 'preview' | 'complete';
type SourceType = 'FILE' | 'PASTE' | 'IREADY' | 'BRANCHING_MINDS' | 'POWERSCHOOL';
type PreviewRow = Record<string, unknown>;

interface MappedColumn {
  sourceHeader: string;
  targetField: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Mock Target Fields for Student Roster
const STUDENT_TARGET_FIELDS = [
  { id: 'name', label: 'Student Name', required: true },
  { id: 'id', label: 'Student ID', required: true },
  { id: 'grade', label: 'Grade Level', required: true },
  { id: 'attendance', label: 'Attendance %', required: false },
  { id: 'readingLevel', label: 'Reading Level', required: false },
  { id: 'gpa', label: 'GPA / Score', required: false },
  { id: 'comments', label: 'Comments / Notes', required: false },
];

const STAFF_TARGET_FIELDS = [
  { id: 'name', label: 'Staff Name', required: true },
  { id: 'id', label: 'Staff ID', required: true },
  { id: 'role', label: 'Role (Teacher/Admin)', required: true },
  { id: 'email', label: 'Email Address', required: true },
  { id: 'grade', label: 'Assigned Grade', required: false },
  { id: 'department', label: 'Department', required: false },
];

const SOURCE_OPTIONS: Array<{ id: SourceType; label: string; desc: string }> = [
  { id: 'FILE', label: 'File Upload', desc: 'CSV, Excel, PDF, Image, Word' },
  { id: 'PASTE', label: 'Paste Data', desc: 'Copy directly from Excel or Google Sheets.' },
  { id: 'IREADY', label: 'i-Ready API', desc: 'Sync assessment scores and growth data.' },
  { id: 'BRANCHING_MINDS', label: 'Branching Minds', desc: 'Import intervention plans and tier status.' },
  { id: 'POWERSCHOOL', label: 'PowerSchool', desc: 'Sync student demographics and attendance.' }
];

export const DataImporter: React.FC<DataImporterProps> = ({ onMenuClick, onImportComplete, currentUserRole }) => {
  const [step, setStep] = useState<ImportStep>('source');
  const [sourceType, setSourceType] = useState<SourceType>('FILE');
  const [dataType, setDataType] = useState<'STUDENTS' | 'STAFF'>('STUDENTS');
  
  // File / Data State
  const [pastedText, setPastedText] = useState('');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [mappings, setMappings] = useState<MappedColumn[]>([]);
  
  // API/Extraction Simulation State
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImportAnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImportStaff = currentUserRole === UserRole.PRINCIPAL || currentUserRole === UserRole.DISTRICT;

  const getTargetFields = () => dataType === 'STUDENTS' ? STUDENT_TARGET_FIELDS : STAFF_TARGET_FIELDS;

  // --- Step 1: Select Source ---
  const handleSourceSelect = (type: typeof sourceType) => {
    setSourceType(type);
    setStep('upload');
  };

  // --- Step 2: Upload / Connect ---
  const parseRawData = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length > 0) {
      // Basic CSV/TSV detection
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
      
      const targetFields = getTargetFields();
      
      // Auto-map
      const initialMappings = headers.map(h => {
        const lowerH = h.toLowerCase();
        const match = targetFields.find(f => f.id.includes(lowerH) || f.label.toLowerCase().includes(lowerH));
        return { sourceHeader: h, targetField: match ? match.id : '' };
      });
      setMappings(initialMappings);
      
      // Preview first 5 rows
      const preview = lines.slice(1, 6).map(line => {
         const values = line.split(delimiter);
         const obj: PreviewRow = {};
         headers.forEach((h, i) => obj[h] = values[i]?.replace(/"/g, ''));
         return obj;
      });
      setPreviewData(preview);
      setStep('mapping');
    }
  };

  const handlePasteSubmit = () => {
      if (pastedText.trim()) {
          parseRawData(pastedText);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      // Check File Type
      const isCsv = uploadedFile.type === 'text/csv' || uploadedFile.type === 'application/vnd.ms-excel';
      
      if (isCsv) {
          // Parse CSV headers immediately for next step
          const reader = new FileReader();
          reader.onload = (evt) => {
            const text = evt.target?.result as string;
            parseRawData(text);
          };
          reader.readAsText(uploadedFile);
      } else {
          // Handle PDF / Image / Docx via Gemini Extraction
          setIsExtracting(true);
          const reader = new FileReader();
          reader.readAsDataURL(uploadedFile);
          reader.onloadend = async () => {
              const base64String = reader.result as string;
              const base64Data = base64String.split(',')[1];
              
              // Call AI Service
              const extractedData = await extractDataFromDocument(base64Data, uploadedFile.type);
              
              setIsExtracting(false);
              if (extractedData && extractedData.length > 0 && isRecord(extractedData[0])) {
                  const headers = Object.keys(extractedData[0]);
                  
                  const targetFields = getTargetFields();

                  // Auto-map
                  const initialMappings = headers.map(h => {
                    const lowerH = h.toLowerCase();
                    const match = targetFields.find(f => f.id.includes(lowerH) || f.label.toLowerCase().includes(lowerH));
                    return { sourceHeader: h, targetField: match ? match.id : '' };
                  });
                  setMappings(initialMappings);
                  setPreviewData(extractedData.filter(isRecord));
                  setStep('mapping');
              } else {
                  alert("Could not extract data from file. Please try again.");
              }
          };
      }
    }
  };

  const handleApiConnect = () => {
    setIsConnecting(true);
    // Simulate API Fetch
    setTimeout(() => {
        setIsConnecting(false);
        // Generate Fake Data based on Source
        const mockData = Array.from({ length: 25 }).map((_, i) => ({
            "Student ID": `STU-${10000+i}`,
            "Name": `Student ${i+1}`,
            "Grade": "4",
            "Score": Math.floor(Math.random() * 100),
            "Risk Level": Math.random() > 0.8 ? "High" : "Low"
        }));
        
        setMappings(Object.keys(mockData[0]).map(h => ({ 
            sourceHeader: h, 
            targetField: h === "Name" ? "name" : h === "Student ID" ? "id" : h === "Grade" ? "grade" : "" 
        })));
        setPreviewData(mockData);
        setStep('mapping');
    }, 2000);
  };

  // --- Step 3: Mapping ---
  const updateMapping = (sourceHeader: string, targetField: string) => {
    setMappings(prev => prev.map(m => m.sourceHeader === sourceHeader ? { ...m, targetField } : m));
  };

  // --- Step 4: Preview & Analysis ---
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    // Use the preview data as sample for analysis (in real app, use full dataset)
    const result = await analyzeImportedBatch(previewData, sourceType);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const handleFinishImport = () => {
      setStep('complete');
      if (onImportComplete) onImportComplete();
  };

  // --- Render Helpers ---
  const getSourceIcon = (type: SourceType) => {
      switch(type) {
          case 'FILE': return <div className="flex gap-1 justify-center"><FileText size={24} className="text-indigo-600"/><ImageIcon size={24} className="text-emerald-600"/><FileSpreadsheet size={24} className="text-blue-600"/></div>;
          case 'PASTE': return <div className="text-2xl font-bold text-slate-600"><ClipboardPaste size={32} /></div>;
          case 'IREADY': return <div className="text-2xl font-bold text-blue-600">i-Ready</div>;
          case 'BRANCHING_MINDS': return <div className="text-xl font-bold text-indigo-600">Branching<br/>Minds</div>;
          case 'POWERSCHOOL': return <div className="text-xl font-bold text-slate-700">PowerSchool</div>;
          default: return <Database size={32} />;
      }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
            <button onClick={onMenuClick} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                <Menu size={24} />
            </button>
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Data Import</h2>
                <p className="text-slate-500 text-sm">Sync roster data from files or external systems.</p>
            </div>
        </div>
        
        {/* Progress Steps */}
        <div className="hidden md:flex items-center gap-2">
            {['Select Source', 'Connect', 'Map Columns', 'Review'].map((label, idx) => {
                const stepIdx = ['source', 'upload', 'mapping', 'preview'].indexOf(step);
                const isActive = stepIdx === idx;
                const isCompleted = stepIdx > idx;
                
                return (
                    <React.Fragment key={label}>
                        <div className={`flex items-center gap-2 ${isActive ? 'text-indigo-600 font-bold' : isCompleted ? 'text-emerald-600' : 'text-slate-300'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${isActive ? 'border-indigo-600 bg-indigo-50' : isCompleted ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'}`}>
                                {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                            </div>
                            <span className="text-sm">{label}</span>
                        </div>
                        {idx < 3 && <div className="w-8 h-px bg-slate-200" />}
                    </React.Fragment>
                );
            })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        <div className="max-w-4xl mx-auto">
            
            {/* STEP 1: SOURCE SELECTION */}
            {step === 'source' && (
                <div className="space-y-6">
                    {/* Target Toggle */}
                    <div className="flex justify-center mb-4">
                        <div className="bg-slate-200 p-1 rounded-xl flex">
                            <button 
                                onClick={() => setDataType('STUDENTS')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${dataType === 'STUDENTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                <LayoutList size={16} /> Student Roster
                            </button>
                            {canImportStaff && (
                              <button 
                                  onClick={() => setDataType('STAFF')}
                                  className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${dataType === 'STAFF' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                              >
                                  <Users size={16} /> Staff Roster
                              </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SOURCE_OPTIONS.map((opt) => (
                            <button 
                                key={opt.id} 
                                onClick={() => handleSourceSelect(opt.id)}
                                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all group text-center h-48"
                            >
                                <div className="mb-4 opacity-80 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">
                                    {getSourceIcon(opt.id)}
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700">{opt.label}</h3>
                                <p className="text-sm text-slate-500 mt-2">{opt.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 2: UPLOAD / CONNECT / PASTE */}
            {step === 'upload' && (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                    {sourceType === 'FILE' ? (
                        <>
                            {isExtracting ? (
                                <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in">
                                    <div className="relative">
                                        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse"></div>
                                        <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                                        <BrainCircuit size={24} className="absolute inset-0 m-auto text-indigo-500 animate-pulse" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-indigo-900">Extracting Data with AI</h3>
                                        <p className="text-sm text-indigo-600">Scanning document for {dataType === 'STUDENTS' ? 'student' : 'staff'} records...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-6">
                                        <Upload size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">Upload {dataType === 'STUDENTS' ? 'Student' : 'Staff'} Data File</h3>
                                    <p className="text-slate-500 mb-8 text-center max-w-sm">
                                        Drag and drop or click to browse.<br/>
                                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-2 inline-block">
                                            Supports: CSV, PDF, Image, Docx
                                        </span>
                                    </p>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept=".csv,.xlsx,.pdf,image/*,.docx,.doc" 
                                        className="hidden" 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all"
                                    >
                                        Select File
                                    </button>
                                </>
                            )}
                        </>
                    ) : sourceType === 'PASTE' ? (
                        <div className="w-full max-w-2xl px-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <ClipboardPaste size={24} className="text-indigo-600" /> 
                                Paste Data
                            </h3>
                            <p className="text-slate-500 mb-4 text-sm">Copy cells from Excel/Sheets and paste below. The first row should contain headers.</p>
                            <textarea 
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                className="w-full h-64 p-4 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-4"
                                placeholder={`Name\tID\tGrade\nJohn Doe\t123\t4th\nJane Smith\t124\t4th`}
                            />
                            <div className="flex justify-end">
                                <button 
                                    onClick={handlePasteSubmit}
                                    disabled={!pastedText.trim()}
                                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                                >
                                    Process Data
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6 animate-pulse">
                                <Database size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Connecting to {sourceType.replace('_', ' ')}...</h3>
                            <p className="text-slate-500 mb-8 text-center max-w-sm">
                                Establishing secure handshake with external API endpoints.
                            </p>
                            {isConnecting ? (
                                <div className="flex items-center gap-2 text-indigo-600 font-bold">
                                    <Loader2 size={20} className="animate-spin" /> Authenticating...
                                </div>
                            ) : (
                                <button 
                                    onClick={handleApiConnect}
                                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all"
                                >
                                    Authorize Connection
                                </button>
                            )}
                        </>
                    )}
                    {!isExtracting && (
                        <button onClick={() => setStep('source')} className="mt-8 text-slate-400 hover:text-slate-600 text-sm">Back to Source Selection</button>
                    )}
                </div>
            )}

            {/* STEP 3: MAPPING */}
            {step === 'mapping' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900">Map Columns</h3>
                        <p className="text-sm text-slate-500">Match fields from the source to BUFSD {dataType === 'STUDENTS' ? 'Student' : 'Staff'} fields.</p>
                    </div>
                    <div className="p-6 space-y-4">
                        {mappings.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Source Header</label>
                                    <div className="font-mono text-sm text-slate-700 font-medium">{m.sourceHeader}</div>
                                </div>
                                <ArrowRight size={16} className="text-slate-300" />
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-indigo-500 uppercase block mb-1">Target Field</label>
                                    <select 
                                        value={m.targetField}
                                        onChange={(e) => updateMapping(m.sourceHeader, e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">-- Ignore --</option>
                                        {getTargetFields().map(f => (
                                            <option key={f.id} value={f.id}>{f.label} {f.required ? '*' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={() => setStep('source')} className="px-4 py-2 text-slate-600 font-bold">Cancel</button>
                        <button onClick={() => setStep('preview')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700">Review Data</button>
                    </div>
                </div>
            )}

            {/* STEP 4: PREVIEW & ANALYSIS */}
            {step === 'preview' && (
                <div className="space-y-6">
                    {/* Data Table Preview */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <LayoutList size={18} className="text-indigo-500" /> Data Preview
                            </h3>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{previewData.length} Rows Ready</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        {mappings.filter(m => m.targetField).map(m => (
                                            <th key={m.sourceHeader} className="px-4 py-3 border-b border-slate-200">{m.targetField}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {previewData.slice(0, 5).map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            {mappings.filter(m => m.targetField).map(m => (
                                                <td key={m.sourceHeader} className="px-4 py-3 text-slate-700">{String(row[m.sourceHeader] ?? '')}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="px-4 py-2 text-xs text-center text-slate-400 italic bg-slate-50 border-t border-slate-100">
                                Showing first 5 rows only
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><BrainCircuit size={120}/></div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-indigo-900">Pre-Import AI Analysis</h3>
                                    <p className="text-sm text-indigo-700/80">Gemini will scan this batch for anomalies before you commit.</p>
                                </div>
                                {!analysisResult && (
                                    <button 
                                        onClick={runAnalysis}
                                        disabled={isAnalyzing}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
                                    >
                                        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                                        Run Analysis
                                    </button>
                                )}
                            </div>

                            {isAnalyzing && (
                                <div className="py-8 flex flex-col items-center justify-center text-indigo-600 gap-3">
                                    <Loader2 size={32} className="animate-spin" />
                                    <p className="text-sm font-medium">Detecting trends and anomalies...</p>
                                </div>
                            )}

                            {analysisResult && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                                    <div className="p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-indigo-100">
                                        <p className="text-sm text-slate-800 leading-relaxed font-medium">{analysisResult.summary}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-rose-50 rounded-lg border border-rose-100">
                                            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <AlertCircle size={14} /> Anomalies Detected
                                            </h4>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {analysisResult.anomalies.map((a, i) => (
                                                    <li key={i} className="text-xs text-rose-800">{a}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                            <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <CheckCircle2 size={14} /> Recommendations
                                            </h4>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {analysisResult.recommendations.map((r, i) => (
                                                    <li key={i} className="text-xs text-emerald-800">{r}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                        <button onClick={() => setStep('mapping')} className="px-6 py-2.5 text-slate-600 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Back</button>
                        <button onClick={handleFinishImport} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex items-center gap-2">
                            Confirm Import <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 5: COMPLETE */}
            {step === 'complete' && (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                        <CheckCircle2 size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Import Successful!</h3>
                    <p className="text-slate-500 mb-8">
                        {previewData.length} records have been added to the system.<br/>
                        Background indexing is now running for the search system.
                    </p>
                    <button 
                        onClick={() => {
                            setStep('source');
                            setPastedText('');
                            setPreviewData([]);
                            setAnalysisResult(null);
                        }} 
                        className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold shadow-md hover:bg-slate-800"
                    >
                        Import Another Batch
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
