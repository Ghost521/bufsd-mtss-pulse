
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  MessageSquare, 
  Minimize2, 
  Maximize2, 
  RefreshCw, 
  StopCircle, 
  Sparkles,
  User,
  Loader2
} from 'lucide-react';
import type { RAGDocument, ChatMessage} from '../types';
import { UserRole, ApprovalStatus } from '../types';
import { queryRAGChatStream } from '../services/geminiService';
import { RichTextRenderer } from './RichTextRenderer';

interface ChatbotProps {
  currentUserRole: UserRole;
  currentUserName: string;
  documents: RAGDocument[];
  currentSchoolName: string;
  currentClassName?: string;
}

export const Chatbot: React.FC<ChatbotProps> = ({ 
  currentUserRole,
  currentUserName,
  documents,
  currentSchoolName,
  currentClassName: _currentClassName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
        id: 'welcome',
        role: 'model',
        text: `**Hello, ${currentUserName.split(' ')[0]}!**\nI'm your MTSS Assistant. I can analyze ${currentSchoolName} data and search through ${documents.length} knowledge base documents.\n\n*Try asking about:*`,
        timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Auto-scroll logic
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  // Role-based Suggested Prompts
  const getSuggestions = () => {
    switch (currentUserRole) {
      case UserRole.PRINCIPAL:
        return [
          "Summarize Tier 3 trends",
          "Show fidelity stats for 4th grade",
          "Who has high absenteeism?"
        ];
      case UserRole.TEACHER:
        return [
          "Who is missing assignments?",
          "Show Tier 2 reading groups",
          "Draft an email to Leo's parents"
        ];
      case UserRole.PARENT:
        return [
          "How is Leo doing in Math?",
          "Any upcoming homework?",
          "Show recent behavior reports"
        ];
      default:
        return ["Analyze district attendance", "Show at-risk schools"];
    }
  };

  const accessibleDocs = documents.filter(doc => doc.status === ApprovalStatus.APPROVED || doc.uploaderName === currentUserName);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    // Create new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    // Prepare history (excluding welcome message)
    const historyForApi = messages.filter(m => m.id !== 'welcome' && m.id !== 'temp-ai');

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsTyping(true);

    // Placeholder for stream
    let responseText = "";
    const tempId = 'temp-ai-' + Date.now();
    
    setMessages(prev => [...prev, {
        id: tempId,
        role: 'model',
        text: '',
        timestamp: new Date()
    }]);

    try {
      await queryRAGChatStream(
        userMsg.text, 
        historyForApi, 
        accessibleDocs, 
        currentUserRole, 
        currentUserName, 
        (chunk) => {
          if (controller.signal.aborted) return;
          responseText += chunk;
          setMessages(prev => prev.map(m => 
              m.id === tempId ? { ...m, text: responseText } : m
          ));
        },
        controller.signal
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unable to complete response.";
        setMessages(prev => prev.map(m => 
            m.id === tempId ? { ...m, text: responseText + `\n\n_Error: ${message}_` } : m
        ));
      }
    } finally {
      setIsTyping(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsTyping(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last.role === 'model') {
           return [...prev.slice(0, -1), { ...last, text: last.text + " _(Stopped)_" }];
        }
        return prev;
      });
    }
  };

  const handleClearChat = () => {
    if (abortController) abortController.abort();
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: `**Context cleared.**\nHow can I help you with ${currentSchoolName} data today?`,
      timestamp: new Date()
    }]);
    setIsTyping(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full shadow-xl flex items-center justify-center text-white hover:bg-indigo-700 transition-all hover:scale-110 z-[100] group"
      >
        <MessageSquare size={28} className="group-hover:scale-110 transition-transform" />
        {/* Pulse Ring */}
        <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-20 animate-ping -z-10"></span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-4 sm:right-6 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-[100] transition-all duration-300 ${isMinimized ? 'w-72 h-16' : 'w-[420px] h-[650px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-100px)]'}`}>
      
      {/* Header */}
      <div 
        className="bg-indigo-600 p-4 flex justify-between items-center cursor-pointer select-none relative overflow-hidden" 
        onClick={() => setIsMinimized(!isMinimized)}
      >
         {/* Decor */}
         <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Bot size={80} />
         </div>

         <div className="flex items-center gap-3 text-white relative z-10">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm shadow-sm">
              <Bot size={20} />
            </div>
            <div>
                <h3 className="font-bold text-sm leading-tight">MTSS Assistant</h3>
                {!isMinimized && <p className="text-[10px] text-indigo-200 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live Data Access</p>}
            </div>
         </div>
         <div className="flex items-center gap-1 text-white/80 relative z-10">
            {!isMinimized && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleClearChat(); }} 
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors mr-1 text-white"
                title="Clear Chat"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
              className="p-1.5 hover:bg-rose-500 rounded-lg transition-colors text-white ml-1"
            >
                <X size={18} />
            </button>
         </div>
      </div>

      {!isMinimized && (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-6 relative">
                
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  // Check if message is a tool status update (starts/ends with italics or specific keywords)
                  const isSystem = msg.text.startsWith('_') && msg.text.endsWith('_') && msg.text.length < 100;

                  if (isSystem) {
                    return (
                      <div key={idx} className="flex justify-center animate-in fade-in slide-in-from-bottom-1 my-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full uppercase tracking-wide border border-slate-200 shadow-sm">
                          <Loader2 size={10} className="animate-spin text-indigo-500" />
                          {msg.text.replace(/_/g, '')}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 group`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                            isUser 
                                ? 'bg-indigo-100 border-indigo-200 text-indigo-600' 
                                : 'bg-white border-slate-200 text-slate-600'
                        }`}>
                           {isUser ? (
                             <User size={14} />
                           ) : (
                             <Bot size={16} />
                           )}
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative ${
                            isUser 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                        }`}>
                            <RichTextRenderer 
                                content={msg.text} 
                                variant={isUser ? 'light' : 'dark'} 
                                isTyping={msg.id.startsWith('temp-ai') && isTyping}
                            />
                            
                            {/* Typing Indicator inside empty model message */}
                            {msg.role === 'model' && msg.text === '' && (
                                <div className="flex gap-1 h-5 items-center pl-1">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100" />
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200" />
                                </div>
                            )}
                        </div>
                    </div>
                  );
                })}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Suggestions (Only if chat is short/empty) */}
            {messages.length < 4 && !isTyping && (
              <div className="px-4 pb-2 bg-slate-50 overflow-x-auto flex gap-2 no-scrollbar pt-2 border-t border-slate-100">
                {getSuggestions().map((s, i) => (
                  <button 
                    key={i}
                    onClick={() => handleSend(s)}
                    className="whitespace-nowrap px-3 py-1.5 bg-white border border-indigo-100 text-indigo-600 rounded-full text-xs font-medium hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm"
                  >
                    <Sparkles size={10} className="inline mr-1.5" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-200 relative">
                {isTyping && (
                  <div className="absolute bottom-full left-0 right-0 p-2 bg-gradient-to-t from-white via-white/90 to-transparent flex justify-center pointer-events-none pb-6">
                     <button 
                      onClick={handleStop}
                      className="pointer-events-auto flex items-center gap-2 px-4 py-1.5 bg-white border border-rose-200 shadow-md rounded-full text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                     >
                        <StopCircle size={14} /> Stop Generating
                     </button>
                  </div>
                )}

                <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-inner">
                    <textarea 
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Ask a question or query data..."
                        className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[24px] text-sm text-slate-800 placeholder:text-slate-400 p-1.5 leading-relaxed"
                        rows={1}
                        disabled={isTyping}
                    />
                    <button 
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isTyping}
                        className={`p-2 rounded-xl mb-0.5 transition-all ${
                          input.trim() && !isTyping
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="mt-2 text-[10px] text-center text-slate-400 font-medium flex justify-center items-center gap-1">
                    <Sparkles size={10} className="text-indigo-400" /> AI can make mistakes. Review critical data.
                </div>
            </div>
          </>
      )}
    </div>
  );
};
