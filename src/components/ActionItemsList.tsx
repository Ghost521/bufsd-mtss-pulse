
import React, { useState, useEffect, useMemo } from 'react';
import type { ActionItem } from '../types';
import { Sparkles, ArrowRight, X, CheckCircle2, AlertTriangle, Loader2, BrainCircuit, Edit, Eye, Undo2 } from 'lucide-react';
import { generateActionItemPlan, getAiFailureInfo } from '../services/geminiService';
import { RichTextRenderer } from './RichTextRenderer';
import { DraggableModal } from './DraggableModal';

interface ActionItemsListProps {
  items: ActionItem[];
  onStudentClick: (studentName: string) => void;
  onViewAll: () => void;
  totalCount?: number;
}

type PlanErrorState = {
  message: string;
  isRetryable: boolean;
  retryAvailableAtMs?: number;
};

export const ActionItemsList: React.FC<ActionItemsListProps> = ({ items, onStudentClick, onViewAll, totalCount }) => {
  const [localItems, setLocalItems] = useState<ActionItem[]>(items);
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lastDismissed, setLastDismissed] = useState<{ item: ActionItem; index: number } | null>(null);
  
  // Plan Edit State
  const [planTitle, setPlanTitle] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [planError, setPlanError] = useState<PlanErrorState | null>(null);
  const [timerTick, setTimerTick] = useState(() => Date.now());

  // Sync props to state when role/data changes
  useEffect(() => {
    setLocalItems(items);
    setLastDismissed(null);
  }, [items]);

  useEffect(() => {
    if (!lastDismissed) return;
    const timer = window.setTimeout(() => {
      setLastDismissed(null);
    }, 6000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [lastDismissed]);

  useEffect(() => {
    if (!planError?.retryAvailableAtMs) return;
    const interval = window.setInterval(() => setTimerTick(Date.now()), 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [planError?.retryAvailableAtMs]);

  const retrySecondsRemaining = useMemo(() => {
    if (!planError?.retryAvailableAtMs) return 0;
    const remaining = Math.ceil((planError.retryAvailableAtMs - timerTick) / 1000);
    return Math.max(0, remaining);
  }, [planError?.retryAvailableAtMs, timerTick]);

  const getBadgeColor = (category: string) => {
    switch (category) {
      case 'Academic': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Attendance': return 'bg-amber-50 text-amber-700 border-amber-200'; // Changed to Amber for warning
      case 'Behavior': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      setLastDismissed({ item: prev[index], index });
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUndoDismiss = () => {
    if (!lastDismissed) return;
    setLocalItems((prev) => {
      if (prev.some((item) => item.id === lastDismissed.item.id)) return prev;
      const restored = [...prev];
      const insertIndex = Math.min(lastDismissed.index, restored.length);
      restored.splice(insertIndex, 0, lastDismissed.item);
      return restored;
    });
    setLastDismissed(null);
  };

  const handleReviewClick = async (item: ActionItem, options?: { preserveDraft?: boolean }) => {
    const preserveDraft = options?.preserveDraft ?? false;
    const previousTitle = planTitle;
    const previousNotes = planNotes;

    setSelectedItem(item);
    setReviewMode(true);
    setIsGeneratingPlan(true);
    setPlanError(null);
    setIsEditingNotes(false); // Default to preview mode for better readability
    
    // Reset fields while loading
    if (!preserveDraft) {
      setPlanTitle("");
      setPlanNotes("");
    }

    try {
        const result = await generateActionItemPlan(item.studentName, item.grade, item.category, item.insight);
        setPlanTitle(result.title);
        setPlanNotes(result.notes);
        setPlanError(null);
    } catch (error) {
        const failure = getAiFailureInfo(error);
        const retryAvailableAtMs = failure.retryAfterSeconds ? Date.now() + failure.retryAfterSeconds * 1000 : undefined;
        setPlanError({
          message: failure.message,
          isRetryable: failure.isRetryable,
          retryAvailableAtMs,
        });

        if (preserveDraft && (previousTitle.trim().length > 0 || previousNotes.trim().length > 0)) {
          setPlanTitle(previousTitle);
          setPlanNotes(previousNotes);
        } else {
          setPlanTitle("Draft Intervention Plan");
          setPlanNotes("Unable to generate a recommended plan. Please enter details manually.");
        }
        setIsEditingNotes(true); // Switch to edit mode if error
    } finally {
        setIsGeneratingPlan(false);
    }
  };

  const handleRetryPlanGeneration = () => {
    if (!selectedItem || retrySecondsRemaining > 0) return;
    void handleReviewClick(selectedItem, { preserveDraft: true });
  };

  const handleContinueManually = () => {
    setPlanError(null);
    setIsEditingNotes(true);
    if (!planTitle.trim()) {
      setPlanTitle("Draft Intervention Plan");
    }
    if (!planNotes.trim()) {
      setPlanNotes("Add intervention rationale, implementation steps, progress-monitoring plan, and owner.");
    }
  };

  const handleApprovePlan = () => {
    if (!selectedItem) return;
    
    setProcessingId(selectedItem.id);
    setReviewMode(false);
    
    // Simulate API call
    setTimeout(() => {
      setLocalItems(prev => prev.filter(item => item.id !== selectedItem.id));
      setProcessingId(null);
      setSelectedItem(null);
    }, 1500);
  };

  const visibleTotal = typeof totalCount === 'number' ? Math.max(totalCount, localItems.length) : localItems.length;
  const caseCountLabel = `${localItems.length} ${localItems.length === 1 ? 'case' : 'cases'} ready for review.`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full relative overflow-hidden">
      
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Priority Support Actions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
             {caseCountLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
           <BrainCircuit size={14} />
           Decision Support
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-slate-50/30">
        {localItems.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <CheckCircle2 size={48} className="text-emerald-200 mb-4" />
              <p className="font-medium text-slate-600">All caught up!</p>
              <p className="text-sm">No cases currently flagged for follow-up.</p>
           </div>
        ) : (
          localItems.map((item) => (
            <div key={item.id} className="p-6 border-b border-slate-100 last:border-0 hover:bg-white transition-colors group relative">
              
              {/* Processing Overlay */}
              {processingId === item.id && (
                 <div className="absolute inset-0 bg-white/90 z-20 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-2 text-emerald-600 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 size={32} />
                        <span className="font-bold text-sm">Support Plan Added</span>
                    </div>
                 </div>
              )}

              <div className="flex justify-between items-start mb-2">
                <div className="flex items-baseline gap-3">
                  <h3 
                    onClick={() => onStudentClick(item.studentName)}
                    className="text-base font-bold text-slate-800 cursor-pointer hover:text-indigo-600 hover:underline decoration-indigo-200 decoration-2 underline-offset-2 transition-all"
                  >
                    {item.studentName}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">{item.grade} Grade</span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${getBadgeColor(item.category)}`}>
                    {item.category}
                  </span>
                </div>
                <button 
                    onClick={(e) => handleDismiss(item.id, e)}
                    type="button"
                    aria-label={`Dismiss case for ${item.studentName}`}
                    className="text-xs font-medium text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                  <X size={14} /> Dismiss
                </button>
              </div>
              
              <div className="flex gap-3 mb-4">
                  <div className="mt-1 shrink-0">
                      <div className="p-1.5 bg-amber-50 rounded-full border border-amber-100 text-amber-600">
                          <AlertTriangle size={14} />
                      </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed py-1">
                    <span className="font-semibold text-slate-700">Signal: </span>
                    {item.insight}
                  </p>
              </div>

              <div className="flex justify-end">
                 <button 
                    onClick={() => {
                      void handleReviewClick(item);
                    }}
                    type="button"
                    className="bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 group/btn"
                 >
                   <Sparkles size={16} className="text-indigo-500 group-hover/btn:animate-pulse" />
                   Review Recommended Plan
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {localItems.length > 0 && (
        <div className="p-3 border-t border-slate-100 bg-white text-center">
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
            View all cases in reports ({visibleTotal})
            </button>
        </div>
      )}

      {lastDismissed ? (
        <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
          <span className="text-slate-600">Case dismissed.</span>
          <button
            type="button"
            onClick={handleUndoDismiss}
            className="inline-flex items-center gap-1 rounded px-2 py-1 font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            <Undo2 size={14} />
            Undo
          </button>
        </div>
      ) : null}

      {/* --- Review Modal Overlay --- */}
      <DraggableModal
        isOpen={reviewMode}
        onClose={() => setReviewMode(false)}
        title={
            <div className="flex gap-3 items-center">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                    <BrainCircuit size={20} className="text-indigo-600" />
                </div>
                <div>
                    <span className="font-bold text-sm uppercase tracking-wider text-indigo-900 block opacity-70">Recommended Support Plan</span>
                    <span className="font-bold text-lg text-slate-800 leading-none">For {selectedItem?.studentName}</span>
                </div>
            </div>
        }
        initialWidth={700}
        initialHeight={600}
        footer={
            <div className="flex gap-3 w-full">
                <button 
                    onClick={() => setReviewMode(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-white transition-colors text-sm"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleApprovePlan}
                    disabled={isGeneratingPlan}
                    className="flex-1 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Approve and Add Plan <ArrowRight size={16} />
                </button>
            </div>
        }
      >
        <div className="p-6 h-full flex flex-col">
            {isGeneratingPlan ? (
                <div className="flex flex-col items-center justify-center gap-4 text-indigo-600 flex-1 h-full">
                    <Loader2 size={48} className="animate-spin" />
                    <div className="text-center">
                        <p className="font-bold text-xl">Preparing Support Plan...</p>
                        <p className="text-sm text-indigo-400 mt-1">Reviewing recent progress and intervention history</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-5 flex-1">
                    {planError ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-semibold">AI recommendation unavailable right now.</p>
                            <p className="mt-1">{planError.message}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleRetryPlanGeneration}
                                    disabled={!planError.isRetryable || retrySecondsRemaining > 0 || isGeneratingPlan}
                                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {retrySecondsRemaining > 0 ? `Retry in ${retrySecondsRemaining}s` : "Retry"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleContinueManually}
                                    className="rounded-md border border-transparent bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                                >
                                    Continue Manually
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Recommended Intervention Plan</label>
                        <input 
                            type="text" 
                            value={planTitle}
                            onChange={(e) => setPlanTitle(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    
                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <div className="flex justify-between items-end mb-1.5">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Reasoning & Notes</label>
                            <button 
                                onClick={() => setIsEditingNotes(!isEditingNotes)}
                                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                            >
                                {isEditingNotes ? <><Eye size={14} /> Preview</> : <><Edit size={14} /> Edit Content</>}
                            </button>
                        </div>
                        
                        {isEditingNotes ? (
                            <textarea 
                                value={planNotes}
                                onChange={(e) => setPlanNotes(e.target.value)}
                                className="w-full min-h-[300px] p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        ) : (
                            <div className="w-full min-h-[300px] p-4 bg-slate-50 border border-slate-200 rounded-lg overflow-y-auto prose prose-sm max-w-none">
                                <RichTextRenderer content={planNotes} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </DraggableModal>

    </div>
  );
};
