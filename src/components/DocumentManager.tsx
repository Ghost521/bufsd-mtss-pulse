
import React, { useState, useEffect, useRef } from 'react';
import type { RAGDocument} from '../types';
import { DocumentScope, ApprovalStatus, UserRole } from '../types';
import { Upload, FileText, CheckCircle2, AlertCircle, Download, Trash2, Globe, Youtube, Link as LinkIcon, Sparkles, Loader2, ChevronDown, AlertTriangle, FileType, Eye, ExternalLink, MonitorPlay, Image as ImageIcon, Undo2 } from 'lucide-react';
import { generateResourceSummary, generateFileSummary } from '../services/geminiService';
import { DraggableModal } from './DraggableModal';
import { SidebarToggleButton } from './SidebarToggleButton';

interface DocumentManagerProps {
  currentUserRole: UserRole;
  currentSchoolName: string;
  currentUserName: string;
  documents: RAGDocument[];
  onUpload: (doc: RAGDocument) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ApprovalStatus) => void;
  onScopeChange: (id: string, scope: DocumentScope) => void;
  onMenuClick: () => void;
}

type MenuScope = 'scope' | 'status';

type PendingChange = {
  type: 'scope' | 'status';
  docId: string;
  docName: string;
  from: DocumentScope | ApprovalStatus;
  to: DocumentScope | ApprovalStatus;
};

type UndoToast = {
  message: string;
  onUndo: () => void;
};

const SCOPE_PRIORITY: Record<DocumentScope, number> = {
  [DocumentScope.INTERNAL]: 0,
  [DocumentScope.STUDENT]: 1,
  [DocumentScope.CLASS]: 2,
  [DocumentScope.SCHOOL]: 3,
  [DocumentScope.DISTRICT]: 4,
};

const SCOPE_LABELS: Record<DocumentScope, string> = {
  [DocumentScope.INTERNAL]: 'Internal (Private)',
  [DocumentScope.STUDENT]: 'Student',
  [DocumentScope.CLASS]: 'Class',
  [DocumentScope.SCHOOL]: 'School',
  [DocumentScope.DISTRICT]: 'District',
};

const getRoleScopeOptions = (role: UserRole): DocumentScope[] => {
  switch (role) {
    case UserRole.PARENT:
      return [DocumentScope.INTERNAL, DocumentScope.STUDENT];
    case UserRole.TEACHER:
      return [DocumentScope.INTERNAL, DocumentScope.CLASS, DocumentScope.STUDENT, DocumentScope.SCHOOL, DocumentScope.DISTRICT];
    case UserRole.PRINCIPAL:
      return [DocumentScope.INTERNAL, DocumentScope.SCHOOL, DocumentScope.CLASS, DocumentScope.STUDENT, DocumentScope.DISTRICT];
    case UserRole.DISTRICT:
      return [DocumentScope.INTERNAL, DocumentScope.DISTRICT, DocumentScope.SCHOOL, DocumentScope.CLASS, DocumentScope.STUDENT];
    default:
      return [DocumentScope.INTERNAL];
  }
};

// Helper Component for Safe PDF Rendering
const PdfViewer = ({ base64Data }: { base64Data: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base64Data) return;
    
    let objectUrl: string | null = null;

    try {
      // Remove any whitespace that might have crept in
      const cleanData = base64Data.replace(/\s/g, '');
      const byteCharacters = atob(cleanData);
      const byteNumbers = Array.from(byteCharacters, (character) => character.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setError(null);
    } catch (err) {
      console.error("PDF Generation Error", err);
      setError("Could not render PDF. The file data may be invalid or corrupted.");
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [base64Data]);

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500 p-8 text-center">
              <AlertTriangle size={48} className="text-amber-500 mb-4" />
              <h3 className="font-bold text-lg text-slate-800">Preview Failed</h3>
              <p className="text-sm mb-4">{error}</p>
          </div>
      );
  }

  if (!url) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-indigo-600 gap-3">
              <Loader2 size={32} className="animate-spin" />
              <span className="font-medium">Preparing PDF...</span>
          </div>
      );
  }

  return (
    <div className="w-full h-full bg-slate-200 flex flex-col relative group">
        <object
            data={url}
            type="application/pdf"
            className="w-full h-full"
        >
            {/* Fallback content if PDF plugin fails */}
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white">
                <p className="text-slate-600 font-medium mb-4">This browser does not support inline PDFs.</p>
                <a 
                    href={url} 
                    download="document.pdf" 
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
                >
                    <Download size={18} /> Download PDF
                </a>
            </div>
        </object>
        
        {/* Floating Download Button (Always visible on hover for convenience) */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
             <a 
                href={url} 
                download="download.pdf" 
                className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-black backdrop-blur-sm"
            >
                <Download size={14} /> Save Copy
            </a>
        </div>
    </div>
  );
};

export const DocumentManager: React.FC<DocumentManagerProps> = ({ 
  currentUserRole,
  currentSchoolName,
  currentUserName,
  documents,
  onUpload,
  onApprove,
  onReject,
  onDelete,
  onStatusChange,
  onScopeChange,
  onMenuClick
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'upload' | 'link' | 'approvals'>('browse');
  const [scope, setScope] = useState<DocumentScope>(DocumentScope.INTERNAL);
  const [targetId, setTargetId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // Viewer State
  const [viewingDoc, setViewingDoc] = useState<RAGDocument | null>(null);

  // Upload & Ingestion State
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ingestionStage, setIngestionStage] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Link State
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState<'WEBSITE' | 'YOUTUBE'>('WEBSITE');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<RAGDocument | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [openMenu, setOpenMenu] = useState<{ docId: string; type: MenuScope } | null>(null);

  // Filter logic for Approvals Tab
  const pendingApprovals = documents.filter(doc => doc.status === ApprovalStatus.PENDING);
  
  const canApprove = (doc: RAGDocument) => {
    if (currentUserRole === UserRole.DISTRICT) return true;
    if (currentUserRole === UserRole.PRINCIPAL && (doc.uploaderRole === UserRole.TEACHER || doc.uploaderRole === UserRole.PARENT)) return true;
    return false;
  };

  const canManageStatus = (doc: RAGDocument) => {
    if (currentUserRole === UserRole.DISTRICT) return true;
    if (currentUserRole === UserRole.PRINCIPAL && doc.scope !== DocumentScope.DISTRICT) return true;
    return false;
  };

  const canDelete = (doc: RAGDocument) => {
    // Admins can delete anything (District or Principal for their school)
    if (currentUserRole === UserRole.DISTRICT) return true;
    if (currentUserRole === UserRole.PRINCIPAL && doc.scope !== DocumentScope.DISTRICT) return true;
    // Users can delete their own uploads
    return doc.uploaderName === currentUserName;
  };

  const canEditScope = (doc: RAGDocument) => {
    // Uploader can change scope
    if (doc.uploaderName === currentUserName) return true;
    // Admins can change scope of files under their purview
    if (currentUserRole === UserRole.DISTRICT) return true;
    if (currentUserRole === UserRole.PRINCIPAL && doc.scope !== DocumentScope.DISTRICT) return true;
    return false;
  };

  const myApprovals = pendingApprovals.filter(doc => canApprove(doc));

  const getDisplayScopeLabel = (value: DocumentScope) => SCOPE_LABELS[value] ?? value;

  const isHighImpactScopeChange = (from: DocumentScope, to: DocumentScope) => SCOPE_PRIORITY[to] > SCOPE_PRIORITY[from];

  const isHighImpactStatusChange = (from: ApprovalStatus, to: ApprovalStatus) => {
    if (from === to) return false;
    return [from, to].includes(ApprovalStatus.APPROVED) || [from, to].includes(ApprovalStatus.REJECTED);
  };

  const queueUndoToast = (message: string, onUndo: () => void) => {
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
    }
    setUndoToast({ message, onUndo });
    undoTimeoutRef.current = window.setTimeout(() => {
      setUndoToast(null);
      undoTimeoutRef.current = null;
    }, 7000);
  };

  const handleUndoToast = () => {
    if (!undoToast) return;
    undoToast.onUndo();
    setUndoToast(null);
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  };

  const requestScopeChange = (doc: RAGDocument, nextScope: DocumentScope) => {
    setOpenMenu(null);
    if (doc.scope === nextScope) return;
    if (isHighImpactScopeChange(doc.scope, nextScope)) {
      setPendingChange({
        type: 'scope',
        docId: doc.id,
        docName: doc.name,
        from: doc.scope,
        to: nextScope,
      });
      return;
    }
    onScopeChange(doc.id, nextScope);
    queueUndoToast(
      `Scope updated for "${doc.name}".`,
      () => onScopeChange(doc.id, doc.scope)
    );
  };

  const requestStatusChange = (doc: RAGDocument, nextStatus: ApprovalStatus) => {
    setOpenMenu(null);
    if (doc.status === nextStatus) return;
    if (isHighImpactStatusChange(doc.status, nextStatus)) {
      setPendingChange({
        type: 'status',
        docId: doc.id,
        docName: doc.name,
        from: doc.status,
        to: nextStatus,
      });
      return;
    }
    onStatusChange(doc.id, nextStatus);
    queueUndoToast(
      `Status updated for "${doc.name}".`,
      () => onStatusChange(doc.id, doc.status)
    );
  };

  const handleConfirmPendingChange = () => {
    if (!pendingChange) return;
    const { type, docId, docName, from, to } = pendingChange;
    if (type === 'scope') {
      onScopeChange(docId, to as DocumentScope);
      queueUndoToast(
        `Scope updated for "${docName}".`,
        () => onScopeChange(docId, from as DocumentScope)
      );
    } else {
      onStatusChange(docId, to as ApprovalStatus);
      queueUndoToast(
        `Status updated for "${docName}".`,
        () => onStatusChange(docId, from as ApprovalStatus)
      );
    }
    setPendingChange(null);
  };

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        window.clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [activeTab]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-doc-menu-root="true"]')) {
        setOpenMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setPendingChange(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Determine status based on role and scope hierarchy
  const getInitialStatus = (selectedScope: DocumentScope) => {
    // District Admins authorize everything they upload
    if (currentUserRole === UserRole.DISTRICT) return ApprovalStatus.APPROVED;

    // Principals authorize School/Class/Student/Internal, but need approval for District
    if (currentUserRole === UserRole.PRINCIPAL) {
        return selectedScope === DocumentScope.DISTRICT ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;
    }

    // Teachers authorize Class/Student/Internal, but need approval for School/District
    if (currentUserRole === UserRole.TEACHER) {
        if (selectedScope === DocumentScope.SCHOOL || selectedScope === DocumentScope.DISTRICT) {
            return ApprovalStatus.PENDING;
        }
        return ApprovalStatus.APPROVED;
    }

    // Parents always need approval/review for uploads to official records
    if (currentUserRole === UserRole.PARENT) {
        return ApprovalStatus.PENDING;
    }

    return ApprovalStatus.PENDING;
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    // 1. Duplicate Check
    if (documents.some(doc => doc.name === uploadFile.name)) {
        setUploadError(`File "${uploadFile.name}" already exists in the knowledge base.`);
        return;
    }
    setUploadError(null);

    setIsProcessingFile(true);
    setUploadProgress(0);
    setIngestionStage('Initializing secure upload...');

    // Simulate network upload progress
    const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
            if (prev >= 90) {
                return 90; // Wait for reader
            }
            return prev + Math.floor(Math.random() * 10);
        });
    }, 200);

    const reader = new FileReader();
    reader.readAsDataURL(uploadFile);
    
    reader.onload = () => {
        setUploadProgress(100);
        setIngestionStage('Processing file content...');
        
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];

        // Determine MIME type robustly
        let mimeType = uploadFile.type;
        if (!mimeType || mimeType === '') {
            const ext = uploadFile.name.split('.').pop()?.toLowerCase();
            if (ext === 'pdf') mimeType = 'application/pdf';
            else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (ext === 'doc') mimeType = 'application/msword';
            else if (ext === 'rtf') mimeType = 'application/rtf';
            else if (ext === 'txt') mimeType = 'text/plain';
            else mimeType = 'application/octet-stream';
        }

        // Define async pipeline
        const processUpload = async () => {
             // Simulate processing delay
             await new Promise(r => setTimeout(r, 800));
             setIngestionStage('Extracting text and metadata...');
             
             await new Promise(r => setTimeout(r, 800));
             setIngestionStage('Analyzing content with AI...');
             
             let aiSummary = 'Newly uploaded document.';
             try {
                 aiSummary = await generateFileSummary(base64Data, mimeType);
             } catch (e) {
                 console.error("Summary generation failed", e);
                 aiSummary = "AI Summary unavailable for this file type.";
             }

             setIngestionStage('Indexing knowledge base...');
             await new Promise(r => setTimeout(r, 800));

             clearInterval(uploadInterval);
             
             const newDoc: RAGDocument = {
                id: `new-${Date.now()}`,
                name: uploadFile.name,
                type: uploadFile.name.split('.').pop()?.toUpperCase() || 'FILE',
                uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                uploaderName: currentUserName,
                uploaderRole: currentUserRole,
                scope: scope,
                targetId: targetId || (scope === DocumentScope.SCHOOL ? currentSchoolName : undefined),
                status: getInitialStatus(scope),
                size: `${(uploadFile.size / 1024).toFixed(1)} KB`,
                summary: aiSummary,
                base64Data: base64Data,
                mimeType: mimeType
             };

             onUpload(newDoc);
             setUploadFile(null);
             setTargetId('');
             setIsProcessingFile(false);
             setUploadProgress(0);
             setIngestionStage('');
             setActiveTab('browse');
        };

        // Start pipeline
        processUpload();
    };

    reader.onerror = () => {
        setUploadError("Error reading file.");
        setIsProcessingFile(false);
        clearInterval(uploadInterval);
    };
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUrl = linkUrl.trim();
    if (!normalizedUrl) return;
    setLinkError(null);

    // Duplicate Check for Links
    if (documents.some(doc => doc.sourceUrl?.trim() === normalizedUrl)) {
        setLinkError('This resource URL already exists in the library.');
        return;
    }

    if (linkType === 'YOUTUBE' && !getYoutubeId(normalizedUrl)) {
        setLinkError('Enter a valid YouTube URL to add this video.');
        return;
    }

    setIsSummarizing(true);
    
    if (linkType === 'YOUTUBE') {
        setIngestionStage('Transcribing video content...');
    } else {
        setIngestionStage('Connecting to external resource...');
    }
    
    // Simulate connection delay
    setTimeout(async () => {
        if (linkType === 'YOUTUBE') {
             setIngestionStage('Analyzing spoken audio...');
        } else {
             setIngestionStage('Analyzing content structure...');
        }
        
        try {
            // Call AI to generate summary before adding
            const aiData = await generateResourceSummary(linkUrl, linkType);
            
            setIngestionStage('Generating AI summary...');

            setTimeout(() => {
                const newDoc: RAGDocument = {
                    id: `link-${Date.now()}`,
                    name: aiData.title,
                    type: linkType,
                    sourceUrl: normalizedUrl,
                    uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    uploaderName: currentUserName,
                    uploaderRole: currentUserRole,
                    scope: scope,
                    targetId: targetId || (scope === DocumentScope.SCHOOL ? currentSchoolName : undefined),
                    status: getInitialStatus(scope),
                    size: linkType === 'YOUTUBE' ? 'Video' : 'Link',
                    summary: aiData.summary // AI Generated Summary
                };

                onUpload(newDoc);
                setLinkUrl('');
                setLinkType('WEBSITE');
                setTargetId('');
                setIsSummarizing(false);
                setLinkError(null);
                setIngestionStage('');
                setActiveTab('browse');
            }, 800);

        } catch (error) {
            console.error("Failed to analyze link", error);
            setIsSummarizing(false);
            setIngestionStage('');
            setLinkError('We could not analyze this resource. Check the URL and try again.');
        }
    }, 1000);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
        onDelete(deleteTarget.id);
        setDeleteTarget(null);
    }
  };

  const getScopeBadge = (scope: DocumentScope) => {
    switch(scope) {
      case DocumentScope.DISTRICT: return 'bg-purple-100 text-purple-700 border-purple-200';
      case DocumentScope.SCHOOL: return 'bg-blue-100 text-blue-700 border-blue-200';
      case DocumentScope.CLASS: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case DocumentScope.STUDENT: return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadgeColor = (status: ApprovalStatus) => {
      switch(status) {
          case ApprovalStatus.APPROVED: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
          case ApprovalStatus.PENDING: return 'text-amber-600 bg-amber-50 border-amber-100';
          case ApprovalStatus.REJECTED: return 'text-rose-600 bg-rose-50 border-rose-100';
          default: return 'text-slate-600 bg-slate-50 border-slate-100';
      }
  };

  const getIconForType = (type: string) => {
      if (type === 'YOUTUBE') return <Youtube size={20} />;
      if (type === 'WEBSITE') return <Globe size={20} />;
      // Basic file types
      if (type === 'PDF' || type === 'DOCX' || type === 'TXT') return <FileText size={20} />;
      return <FileType size={20} />;
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  const renderScopeOptions = () => {
    const availableScopes = getRoleScopeOptions(currentUserRole);
    return (
        <>
            {availableScopes.map((scopeOption) => (
                <option key={scopeOption} value={scopeOption}>
                    {scopeOption === DocumentScope.STUDENT && currentUserRole === UserRole.PARENT
                      ? 'My Child (Student Record)'
                      : getDisplayScopeLabel(scopeOption)}
                    {scopeOption === DocumentScope.SCHOOL && currentUserRole === UserRole.TEACHER ? ' (Requires Approval)' : ''}
                    {scopeOption === DocumentScope.DISTRICT &&
                      (currentUserRole === UserRole.TEACHER || currentUserRole === UserRole.PRINCIPAL)
                        ? ' (Requires Approval)'
                        : ''}
                </option>
            ))}
        </>
    );
  };

  const renderDocumentContent = (doc: RAGDocument) => {
    if (doc.type === 'YOUTUBE' && doc.sourceUrl) {
        const videoId = getYoutubeId(doc.sourceUrl);
        if (!videoId) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8 text-center">
                    <AlertTriangle size={40} className="text-amber-500 mb-3" />
                    <h3 className="font-bold text-slate-800 mb-1">Video Preview Unavailable</h3>
                    <p className="text-sm text-slate-500 mb-4">This YouTube URL could not be parsed for preview.</p>
                    <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-2"
                    >
                        <ExternalLink size={14} /> Open Original Link
                    </a>
                </div>
            );
        }
        return (
            <div className="w-full h-full flex items-center justify-center bg-black">
                <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    className="max-w-4xl max-h-[80vh] aspect-video"
                ></iframe>
            </div>
        );
    }

    // Handle Base64 Data
    if (doc.base64Data) {
        // Image Handling
        if (doc.mimeType?.startsWith('image/')) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <img src={`data:${doc.mimeType};base64,${doc.base64Data}`} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg" />
                </div>
            );
        }
        
        // PDF Handling
        if (doc.mimeType === 'application/pdf' || doc.type === 'PDF') {
             return <PdfViewer base64Data={doc.base64Data} />;
        }

        // DOCX/RTF Fallback for real files (download only)
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-100 p-8 text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                    <FileText size={40} className="text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Preview Not Available</h3>
                <p className="text-slate-500 mb-6 max-w-xs">
                    This file type ({doc.type}) cannot be previewed in the browser. Please download to view.
                </p>
                <a 
                    href={`data:${doc.mimeType || 'application/octet-stream'};base64,${doc.base64Data}`}
                    download={doc.name}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all"
                >
                    <Download size={18} /> Download File
                </a>
            </div>
        );
    }

    // Simulated Previews for Mock Data (No Base64)
    if (!doc.base64Data && !doc.sourceUrl) {
        // Mock PDF / Doc Viewer
        if (doc.type === 'PDF' || doc.type === 'DOCX' || doc.type === 'TXT') {
            return (
                <div className="w-full h-full bg-slate-200 flex flex-col items-center p-8 overflow-y-auto">
                    <div className="bg-white shadow-lg p-12 w-full max-w-3xl min-h-[800px] relative">
                        <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-bl-lg">
                            SIMULATED PREVIEW
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-6">{doc.name}</h1>
                        <div className="space-y-4 text-slate-600 leading-relaxed text-justify">
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg mb-6">
                                <p className="font-semibold text-slate-800 mb-1">Summary:</p>
                                <p className="text-sm">{doc.summary}</p>
                            </div>
                            
                            {/* Simulated Content */}
                            <div className="space-y-6 opacity-80">
                                <p className="text-lg font-semibold text-slate-800">1. Introduction</p>
                                <p>
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                                </p>
                                <p>
                                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                                </p>
                                <div className="h-64 w-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-dashed border-slate-300">
                                    [Chart/Graphic Placeholder]
                                </div>
                                <p className="text-lg font-semibold text-slate-800">2. Analysis</p>
                                <p>
                                    Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.
                                </p>
                            </div>
                            
                            <div className="mt-12 pt-6 border-t border-slate-100 text-center text-slate-400 text-xs italic">
                                This is a placeholder preview for demo purposes. The actual file content is not available in this mock environment.
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Mock Image Viewer
        if (doc.type === 'IMG' || doc.type === 'PNG' || doc.type === 'JPG') {
             return (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 p-8">
                    <div className="max-w-2xl w-full bg-white rounded-lg p-2 shadow-2xl relative">
                         <div className="absolute top-4 right-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">SIMULATION</div>
                         <div className="aspect-video bg-slate-100 flex items-center justify-center text-slate-400 flex-col gap-2 rounded border border-slate-200">
                            <ImageIcon size={48} />
                            <p className="font-bold text-slate-600">{doc.name}</p>
                            <p className="text-xs opacity-70">Image Content Simulation</p>
                         </div>
                    </div>
                </div>
             );
        }
    }

    // Fallback / Website / Other formats
    return (
        <div className="flex flex-col items-center justify-center text-center max-w-lg p-8">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                {getIconForType(doc.type)} 
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{doc.name}</h2>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left w-full mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Summary / Extracted Text</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{doc.summary || "Summary unavailable."}</p>
            </div>
            
            {doc.sourceUrl ? (
                <a 
                    href={doc.sourceUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-md transition-all hover:-translate-y-0.5"
                >
                    <ExternalLink size={18} /> Open External Resource
                </a>
            ) : doc.base64Data ? (
                <a 
                    href={`data:${doc.mimeType || 'application/octet-stream'};base64,${doc.base64Data}`}
                    download={doc.name}
                    className="px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 flex items-center gap-2"
                >
                    <Download size={18} /> Download File
                </a>
            ) : (
                <div className="px-4 py-3 bg-slate-100 text-slate-500 rounded-lg text-sm font-medium flex items-center gap-2">
                    <MonitorPlay size={16} /> No preview available for this resource.
                </div>
            )}
        </div>
    );
  };

  return (
    <div ref={rootRef} className="app-responsive-pane relative flex min-h-[600px] min-w-0 flex-col rounded-2xl border border-slate-200/50 bg-white/80 shadow-sm backdrop-blur-md overflow-hidden">
      
      {/* View Document Modal (Draggable) */}
      <DraggableModal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        title={viewingDoc ? (
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${viewingDoc.type === 'YOUTUBE' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {getIconForType(viewingDoc.type)}
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 leading-tight text-lg truncate max-w-[300px]">{viewingDoc.name}</h3>
                    <p className="text-xs text-slate-500">{viewingDoc.type} &bull; {viewingDoc.size || 'Unknown Size'}</p>
                </div>
            </div>
        ) : "View Document"}
        initialWidth={1000}
        initialHeight={800}
        className="max-w-[95vw] max-h-[95vh]"
      >
        <div className="flex-1 bg-slate-100 h-full flex flex-col">
            {viewingDoc && (
                <div className="bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center text-xs text-slate-500 shrink-0">
                    <span>Uploaded by {viewingDoc.uploaderName} on {viewingDoc.uploadDate}</span>
                    {viewingDoc.sourceUrl && (
                        <a 
                            href={viewingDoc.sourceUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            Open Original <ExternalLink size={12} />
                        </a>
                    )}
                </div>
            )}
            <div className="flex-1 overflow-hidden relative flex items-center justify-center">
                {viewingDoc && renderDocumentContent(viewingDoc)}
            </div>
        </div>
      </DraggableModal>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rounded-xl animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border-2 border-slate-100 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
                        <Trash2 size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Confirm Deletion</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Are you sure you want to delete <span className="font-semibold text-slate-700">"{deleteTarget.name}"</span>? 
                            <br/>This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setDeleteTarget(null)}
                            className="flex-1 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmDelete}
                            className="flex-1 py-2.5 text-white font-semibold bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors text-sm shadow-sm"
                        >
                            Delete File
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Scope / Status Confirmation */}
      {pendingChange && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rounded-xl animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border-2 border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-50 text-amber-600 mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Confirm {pendingChange.type === 'scope' ? 'scope' : 'status'} update
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  You are updating <span className="font-semibold">"{pendingChange.docName}"</span> from{' '}
                  <span className="font-semibold">{pendingChange.from}</span> to{' '}
                  <span className="font-semibold">{pendingChange.to}</span>.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingChange}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              >
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}

      {undoToast && (
        <div className="absolute bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] md:w-auto">
          <div className="rounded-xl border border-indigo-100 bg-white shadow-xl p-3 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1">{undoToast.message}</p>
            <button
              type="button"
              onClick={handleUndoToast}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-md hover:bg-indigo-100"
            >
              <Undo2 size={12} /> Undo
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-5 border-b border-slate-200/50 p-6 md:flex-row md:items-center bg-white/50 backdrop-blur-md z-10 sticky top-0 rounded-t-2xl">
        <div className="flex min-w-0 items-center gap-4">
          <SidebarToggleButton
            onClick={onMenuClick}
            className="lg:hidden p-2.5 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-xl"
          />
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Resource Library</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Upload, organize, and share school resources securely.</p>
          </div>
        </div>
        <div className="app-responsive-actions w-full md:w-auto md:justify-end bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50 shadow-inner overflow-x-auto">
          <div className="flex items-center min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'browse' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'upload' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'link' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
            >
              Add Resource
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'approvals' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600 hover:bg-indigo-50/50'}`}
            >
              Approvals
              {myApprovals.length > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md shadow-sm ${activeTab === 'approvals' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>{myApprovals.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="app-responsive-content flex-1 bg-slate-50/30 p-4 sm:p-6">
        
        {/* BROWSE TAB */}
        {activeTab === 'browse' && (
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200/60 bg-white/50 backdrop-blur-sm p-12 text-center shadow-sm max-w-2xl mx-auto mt-8">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50">
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">No resources yet</h3>
                <p className="mt-3 text-sm font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Start your library by uploading a document or adding a website resource your team can use.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2"
                  >
                    <Upload size={16} /> Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('link')}
                    className="px-6 py-2.5 rounded-xl border border-slate-200/80 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-700 shadow-sm transition-all flex justify-center items-center gap-2"
                  >
                    <LinkIcon size={16} /> Add Resource
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {documents.map((doc) => {
                  const ytId = doc.type === 'YOUTUBE' && doc.sourceUrl ? getYoutubeId(doc.sourceUrl) : null;
                  const domain = doc.type === 'WEBSITE' && doc.sourceUrl ? getDomain(doc.sourceUrl) : null;
                  const scopeMenuOpen = openMenu?.docId === doc.id && openMenu.type === 'scope';
                  const statusMenuOpen = openMenu?.docId === doc.id && openMenu.type === 'status';

                  return (
                    <div key={doc.id} className="p-5 rounded-2xl border border-slate-200/60 hover:border-indigo-300/60 hover:shadow-lg transition-all duration-300 group bg-white/90 backdrop-blur-sm flex flex-col relative overflow-hidden hover:-translate-y-1">
                      <div className="flex justify-between items-start mb-3">
                        <div className={`p-2.5 rounded-xl flex items-center justify-center w-11 h-11 shrink-0 shadow-sm ${
                          doc.type === 'YOUTUBE' ? 'text-red-600 bg-gradient-to-br from-red-50 to-red-100/50' :
                          doc.type === 'WEBSITE' ? 'text-blue-600 bg-gradient-to-br from-blue-50 to-blue-100/50' :
                          'text-indigo-600 bg-gradient-to-br from-indigo-50 to-indigo-100/50'
                        }`}>
                          {getIconForType(doc.type)}
                        </div>
                        <div className="flex gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => setViewingDoc(doc)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50 transition-colors"
                            aria-label={`Preview ${doc.name}`}
                          >
                            <Eye size={16} />
                          </button>

                          <div className="relative z-20" data-doc-menu-root="true">
                            {canEditScope(doc) ? (
                              <>
                                <button
                                  type="button"
                                  aria-haspopup="menu"
                                  aria-expanded={scopeMenuOpen}
                                  onClick={() => setOpenMenu(scopeMenuOpen ? null : { docId: doc.id, type: 'scope' })}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 hover:brightness-95 transition-all ${getScopeBadge(doc.scope)}`}
                                >
                                  {getDisplayScopeLabel(doc.scope)} <ChevronDown size={10} />
                                </button>
                                {scopeMenuOpen && (
                                  <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-100 p-1">
                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                                      Change Scope
                                    </div>
                                    {getRoleScopeOptions(currentUserRole).map((s) => (
                                      <button
                                        type="button"
                                        key={s}
                                        onClick={() => requestScopeChange(doc, s)}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-50 flex items-center justify-between ${doc.scope === s ? 'font-bold text-indigo-600' : 'text-slate-600'}`}
                                      >
                                        {getDisplayScopeLabel(s)}
                                        {doc.scope === s && <CheckCircle2 size={10} />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScopeBadge(doc.scope)}`}>
                                {getDisplayScopeLabel(doc.scope)}
                              </div>
                            )}
                          </div>

                          {canDelete(doc) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(doc)}
                              className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors"
                              aria-label={`Delete ${doc.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {ytId && (
                        <button
                          type="button"
                          className="w-full h-32 bg-slate-100 rounded-lg mb-3 overflow-hidden border border-slate-100 relative group/video cursor-pointer"
                          onClick={() => setViewingDoc(doc)}
                          aria-label={`Preview video ${doc.name}`}
                        >
                          <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-90 group-hover/video:opacity-100 transition-opacity" alt={`${doc.name} thumbnail`} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-sm transition-transform group-hover/video:scale-110">
                              <Youtube size={16} className="text-red-600 fill-current" />
                            </div>
                          </div>
                        </button>
                      )}

                      <button
                        type="button"
                        className="font-extrabold text-slate-800 text-base mb-1.5 truncate leading-tight text-left hover:text-indigo-600 hover:underline decoration-indigo-300 decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-all"
                        title={doc.name}
                        onClick={() => setViewingDoc(doc)}
                        aria-label={`Open ${doc.name}`}
                      >
                        {doc.name}
                      </button>

                      {domain && (
                        <p className="text-[11px] font-semibold text-slate-400 mb-3 truncate uppercase tracking-widest">{domain}</p>
                      )}

                      <div className="bg-slate-50/80 p-3 rounded-xl mb-4 flex-1 border border-slate-100/50 group-hover:bg-indigo-50/30 transition-colors">
                        {doc.summary ? (
                          <p className="text-sm font-medium text-slate-600 leading-snug line-clamp-3">{doc.summary}</p>
                        ) : (
                          <p className="text-sm font-medium text-slate-400 italic">Summary unavailable.</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100/50 mt-auto">
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                          {doc.uploadDate} <span className="text-slate-300">&bull;</span> {doc.size}
                        </div>

                        {canManageStatus(doc) ? (
                          <div className="relative z-10" data-doc-menu-root="true">
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={statusMenuOpen}
                              onClick={() => setOpenMenu(statusMenuOpen ? null : { docId: doc.id, type: 'status' })}
                              className={`flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm transition-all hover:-translate-y-0.5 ${getStatusBadgeColor(doc.status)} hover:brightness-95`}
                            >
                              {doc.status} <ChevronDown size={12} strokeWidth={3} />
                            </button>
                            {statusMenuOpen && (
                              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/50 p-1.5 z-50">
                                {Object.values(ApprovalStatus).filter((s) => s !== ApprovalStatus.NONE).map((s) => (
                                  <button
                                    type="button"
                                    key={s}
                                    onClick={() => requestStatusChange(doc, s)}
                                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between ${doc.status === s ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    {s}
                                    {doc.status === s && <CheckCircle2 size={14} className="text-indigo-600" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm ${getStatusBadgeColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
           <div className="max-w-2xl mx-auto py-6">
              <form onSubmit={handleUploadSubmit} className="space-y-8 bg-white/80 backdrop-blur-md p-10 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                 <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3 tracking-tight">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm border border-indigo-100/50">
                        <Upload size={20} strokeWidth={2.5} /> 
                    </div>
                    Upload File to Resource Library
                 </h3>
                 
                 {isProcessingFile ? (
                    <div className="py-12 space-y-8 animate-in fade-in duration-300">
                        <div className="space-y-4 text-center">
                            <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto drop-shadow-sm" />
                            <h4 className="text-xl font-extrabold text-slate-800 tracking-tight">{ingestionStage}</h4>
                            <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">Preparing this resource for secure search and retrieval...</p>
                        </div>
                        
                        <div className="max-w-md mx-auto space-y-3">
                             <div className="flex justify-between text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                                <span>Progress</span>
                                <span className="text-indigo-600">{uploadProgress}%</span>
                             </div>
                             <div className="w-full bg-slate-100/80 rounded-full h-4 overflow-hidden shadow-inner relative border border-slate-200/50">
                                <div 
                                    className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                                    style={{ width: `${uploadProgress}%` }} 
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]" />
                                </div>
                             </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 pt-6 border-t border-slate-100 max-w-lg mx-auto">
                             <div className={`flex flex-col items-center gap-2 text-xs font-bold transition-colors duration-300 ${uploadProgress > 20 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                <CheckCircle2 size={20} /> Reading
                             </div>
                             <div className={`flex flex-col items-center gap-2 text-xs font-bold transition-colors duration-300 ${uploadProgress > 50 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                <CheckCircle2 size={20} /> Chunking
                             </div>
                             <div className={`flex flex-col items-center gap-2 text-xs font-bold transition-colors duration-300 ${uploadProgress > 80 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                <CheckCircle2 size={20} /> Indexing
                             </div>
                             <div className={`flex flex-col items-center gap-2 text-xs font-bold transition-colors duration-300 ${uploadProgress === 100 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                <CheckCircle2 size={20} /> Ready
                             </div>
                        </div>
                    </div>
                 ) : (
                    <>
                        {uploadError && (
                            <div className="p-4 bg-rose-50/80 backdrop-blur-sm text-rose-800 border border-rose-200/50 rounded-xl text-sm font-semibold flex items-center gap-3 shadow-sm">
                                <AlertCircle size={20} className="text-rose-600 shrink-0" />
                                {uploadError}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-extrabold text-slate-700 mb-2.5">Access Scope</label>
                                <select 
                                value={scope} 
                                onChange={(e) => setScope(e.target.value as DocumentScope)}
                                className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                >
                                    {renderScopeOptions()}
                                </select>
                            </div>

                            {scope === DocumentScope.STUDENT && (
                                <div className="animate-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-extrabold text-slate-700 mb-2.5">Student Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Leo Martinez"
                                    value={targetId}
                                    onChange={(e) => setTargetId(e.target.value)}
                                    className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
                                    required
                                />
                                </div>
                            )}

                            <div className="border-2 border-dashed border-slate-300/80 rounded-2xl p-10 text-center hover:bg-slate-50/50 hover:border-indigo-300 transition-all group">
                                <input 
                                type="file" 
                                onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setUploadError(null); }}
                                className="hidden" 
                                id="file-upload"
                                accept=".pdf,.doc,.docx,.rtf,.txt,.png,.jpg,.jpeg"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                                <div className="w-16 h-16 bg-slate-100 group-hover:bg-indigo-50 rounded-full flex items-center justify-center transition-colors">
                                    <Upload size={28} className="text-slate-400 group-hover:text-indigo-500 transition-colors" strokeWidth={2.5} />
                                </div>
                                <span className="text-base font-extrabold text-slate-700 group-hover:text-indigo-700 transition-colors mt-2">
                                    {uploadFile ? uploadFile.name : "Click to select a document"}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">PDF, DOC, DOCX, RTF, TXT, PNG, JPG, JPEG supported</span>
                                </label>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={!uploadFile}
                            className="w-full py-4 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all flex justify-center items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                            Upload & Process
                        </button>
                    </>
                 )}
              </form>
           </div>
        )}

        {/* ADD LINK TAB */}
        {activeTab === 'link' && (
           <div className="max-w-2xl mx-auto py-6">
              <form onSubmit={handleLinkSubmit} className="space-y-6 bg-white/80 backdrop-blur-md p-10 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                 
                 {isSummarizing && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 flex flex-col items-center justify-center text-indigo-600 gap-5 p-8 rounded-3xl">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-indigo-100/50 rounded-full animate-pulse shadow-inner"></div>
                            <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                            <Sparkles size={28} className="absolute inset-0 m-auto text-indigo-500 animate-pulse drop-shadow-md" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="font-extrabold text-xl text-indigo-900 tracking-tight">{ingestionStage}</p>
                            <p className="text-sm font-medium text-indigo-500">AI is analyzing content and generating metadata...</p>
                        </div>
                        <div className="w-64 h-2 bg-indigo-100/50 rounded-full overflow-hidden mt-6 shadow-inner border border-indigo-100">
                             <div className="h-full bg-indigo-500 animate-[translateX_1s_ease-in-out_infinite] w-1/3 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        </div>
                    </div>
                 )}

                 <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-3 tracking-tight">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm border border-indigo-100/50">
                        <LinkIcon size={20} strokeWidth={2.5} /> 
                    </div>
                    Add External Resource
                 </h3>

                 <div className="flex gap-4 mb-6 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                     <button
                        type="button"
                        onClick={() => { setLinkType('WEBSITE'); setLinkError(null); }}
                        className={`flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${linkType === 'WEBSITE' ? 'bg-white shadow-sm border border-slate-200/50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                     >
                         <Globe size={18} strokeWidth={2.5} /> Website
                     </button>
                     <button
                        type="button"
                        onClick={() => { setLinkType('YOUTUBE'); setLinkError(null); }}
                        className={`flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${linkType === 'YOUTUBE' ? 'bg-white shadow-sm border border-slate-200/50 text-red-600' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                     >
                         <Youtube size={18} strokeWidth={2.5} /> YouTube Video
                     </button>
                 </div>

                 <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-2.5">Resource URL</label>
                    <input 
                        type="url"
                        placeholder={linkType === 'YOUTUBE' ? "https://youtube.com/watch?v=..." : "https://example.org/article"}
                        value={linkUrl}
                        onChange={(e) => { setLinkUrl(e.target.value); if (linkError) setLinkError(null); }}
                        className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
                        required
                    />
                 </div>

                 {linkError && (
                    <div className="p-4 bg-rose-50/80 backdrop-blur-sm text-rose-800 border border-rose-200/50 rounded-xl text-sm font-semibold flex items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={20} className="text-rose-600 shrink-0" />
                        <span>{linkError}</span>
                      </div>
                      <button
                        type="submit"
                        disabled={isSummarizing || !linkUrl.trim()}
                        className="px-4 py-2 rounded-lg border border-rose-200 bg-white text-rose-700 font-semibold text-xs hover:bg-rose-50 hover:shadow-sm disabled:opacity-50 transition-all"
                      >
                        Retry
                      </button>
                    </div>
                 )}

                 <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-2.5">Access Scope</label>
                    <select 
                      value={scope} 
                      onChange={(e) => setScope(e.target.value as DocumentScope)}
                      className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    >
                      {renderScopeOptions()}
                    </select>
                 </div>

                 {scope === DocumentScope.STUDENT && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-extrabold text-slate-700 mb-2.5">Student Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Leo Martinez"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
                        required
                      />
                    </div>
                 )}

                 <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 p-5 rounded-2xl flex items-start gap-4 border border-indigo-100/50 shadow-sm mt-8">
                     <div className="bg-white p-2 rounded-xl shadow-sm border border-indigo-100">
                         <Sparkles size={20} className="text-indigo-600 shrink-0" />
                     </div>
                     <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                         <strong className="font-extrabold tracking-tight">AI Auto-Summary:</strong> When you add this link, Gemini will automatically generate a summary to help the chatbot answer questions about it effectively.
                     </p>
                 </div>

                 <button 
                    type="submit" 
                    disabled={!linkUrl || isSummarizing}
                    className="w-full py-4 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all flex justify-center items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 mt-8"
                 >
                    Add Resource
                 </button>
              </form>
           </div>
        )}

        {/* APPROVALS TAB */}
        {activeTab === 'approvals' && (
           <div className="space-y-4 max-w-4xl mx-auto">
              {myApprovals.length === 0 ? (
                 <div className="text-center py-16 text-slate-500 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm">
                   <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50">
                       <CheckCircle2 size={24} strokeWidth={2.5} />
                   </div>
                   <p className="text-xl font-extrabold text-slate-800 tracking-tight">All caught up.</p>
                   <p className="text-sm font-medium mt-2 max-w-sm mx-auto">No resources are waiting for your approval right now.</p>
                 </div>
              ) : (
                myApprovals.map(doc => (
                  <div key={doc.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white/90 backdrop-blur-sm border border-slate-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow gap-5">
                     <div className="flex items-start gap-4">
                        <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 shadow-sm border border-amber-100/50">
                           <AlertCircle size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                           <h3 className="text-lg font-extrabold text-slate-800">{doc.name}</h3>
                           <p className="text-sm font-medium text-slate-500 mb-2">
                              Uploaded by <span className="font-bold text-slate-700">{doc.uploaderName}</span> ({doc.uploaderRole})
                           </p>
                           <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 inline-flex items-center px-2.5 py-1 rounded-md border border-indigo-100 uppercase tracking-widest">
                              Requesting Scope: <span className="ml-1 font-extrabold">{doc.scope}</span>
                           </p>
                        </div>
                     </div>
                     <div className="flex gap-3 shrink-0 mt-2 md:mt-0">
                        <button
                           type="button"
                           onClick={() => onReject(doc.id)}
                           className="px-5 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-sm transition-all flex-1 md:flex-none"
                        >
                           Reject
                        </button>
                        <button
                           type="button"
                           onClick={() => onApprove(doc.id)}
                           className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-sm hover:shadow-md text-sm transition-all flex justify-center items-center gap-2 flex-1 md:flex-none hover:-translate-y-0.5"
                        >
                           <CheckCircle2 size={16} strokeWidth={2.5} /> Approve
                        </button>
                     </div>
                  </div>
                ))
              )}
           </div>
        )}

      </div>
    </div>
  );
};
