
import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Upload, CheckCircle2, Loader2, FileText, ShieldAlert, Trash2 } from 'lucide-react';
import { CLASS_ROSTER_DATA } from '../constants';
import { DraggableModal } from './DraggableModal';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentId?: string;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ 
  isOpen, 
  onClose, 
  defaultStudentId = ''
}) => {
  const [formData, setFormData] = useState({
    studentId: defaultStudentId,
    type: 'Behavior',
    urgency: 'Medium',
    notes: ''
  });
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...prev, studentId: defaultStudentId }));
      setErrors({});
    }
  }, [isOpen, defaultStudentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.studentId) newErrors.studentId = 'Please select a student.';
    if (!formData.notes) newErrors.notes = 'Please provide a description.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setFormData({ studentId: '', type: 'Behavior', urgency: 'Medium', notes: '' });
        setFiles([]);
        setErrors({});
      }, 2000);
    }, 1500);
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <AlertCircle size={20} />
            </div>
            <span className="text-xl font-bold text-slate-900">New Referral</span>
        </div>
      }
      initialWidth={600}
      initialHeight={700}
      footer={
        isSuccess ? undefined : (
            <div className="flex gap-3 justify-end w-full">
                <button 
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                >
                    {isSubmitting ? (
                    <>
                        <Loader2 size={18} className="animate-spin" /> Submitting...
                    </>
                    ) : (
                    <>
                        <ShieldAlert size={18} /> Submit Referral
                    </>
                    )}
                </button>
            </div>
        )
      }
    >
        {isSuccess ? (
          <div className="p-12 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300 h-full">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Referral Submitted</h3>
            <p className="text-slate-500 text-sm mb-4">
              This case has been routed to the Principal for approval.
            </p>
            <div className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 text-xs font-bold">
              Status: Pending Review
            </div>
          </div>
        ) : (
          <form className="p-6 space-y-5">
            {/* Warning Banner */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 text-xs text-blue-700">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p>Please ensure all documentation is attached. Referrals without evidence (e.g., observation logs, work samples) may be returned.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Student <span className="text-rose-500">*</span></label>
              <div className="relative">
                <select 
                  value={formData.studentId}
                  onChange={(e) => {
                    setFormData({...formData, studentId: e.target.value});
                    if (errors.studentId) setErrors(prev => ({ ...prev, studentId: '' }));
                  }}
                  className={`w-full p-3 border rounded-xl text-sm font-medium focus:ring-2 outline-none transition-all appearance-none cursor-pointer ${
                    errors.studentId 
                      ? 'bg-rose-50 border-rose-300 focus:ring-rose-200 text-rose-900' 
                      : 'bg-slate-50 border-slate-200 focus:ring-indigo-500 focus:bg-white'
                  }`}
                >
                  <option value="" disabled>Select a student...</option>
                  {CLASS_ROSTER_DATA.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>
                  ))}
                </select>
              </div>
              {errors.studentId && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.studentId}</p>}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Category</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="Behavior">Behavioral Issue</option>
                  <option value="Academic">Academic Concern</option>
                  <option value="Attendance">Attendance</option>
                  <option value="Social-Emotional">Social/Emotional</option>
                  <option value="Health">Health/Medical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Urgency</label>
                <select 
                  value={formData.urgency}
                  onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="Low">Low (Monitor)</option>
                  <option value="Medium">Medium (Review)</option>
                  <option value="High">High (Urgent)</option>
                  <option value="Critical">Critical (Immediate)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Description & Notes <span className="text-rose-500">*</span></label>
              <textarea 
                rows={4}
                placeholder="Describe the incident, prior interventions, and current concern..."
                value={formData.notes}
                onChange={(e) => {
                    setFormData({...formData, notes: e.target.value});
                    if (errors.notes) setErrors(prev => ({ ...prev, notes: '' }));
                }}
                className={`w-full p-3 border rounded-xl text-sm focus:ring-2 outline-none resize-none transition-all ${
                    errors.notes
                      ? 'bg-rose-50 border-rose-300 focus:ring-rose-200 placeholder:text-rose-300'
                      : 'bg-slate-50 border-slate-200 focus:ring-indigo-500 focus:bg-white'
                }`}
              />
              {errors.notes && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.notes}</p>}
            </div>

            <div>
                <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Supporting Documentation</label>
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                        <Upload size={12} /> Upload File
                    </button>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    onChange={handleFileChange} 
                />
                
                {files.length === 0 ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                        <p className="text-xs text-slate-400">Click to attach logs, work samples, or images.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={16} className="text-slate-400 shrink-0" />
                                    <span className="text-xs text-slate-700 truncate">{file.name}</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => removeFile(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </form>
        )}
    </DraggableModal>
  );
};
