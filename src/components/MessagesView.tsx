
import React, { useState, useEffect, useRef } from 'react';
import type { Conversation, Message, Attachment } from '../types';
import { UserRole } from '../types';
import { MOCK_CONVERSATIONS } from '../constants';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Smartphone,
  Video, 
  Smile, 
  Check, 
  CheckCheck,
  Menu,
  Trash2,
  Users,
  UserPlus,
  X,
  UserMinus,
  Plus,
  ArrowLeft,
  FileText,
  Sticker,
  Download,
  Loader2,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
} from 'lucide-react';

interface MessagesViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  onMenuClick: () => void;
  targetRecipient?: string;
}

// Mock contacts for selection - Updated to match master list
const MOCK_CONTACTS = [
  { id: 'c1', name: 'Mrs. Martinez', role: UserRole.PARENT },
  { id: 'c2', name: 'Rosa Cortese', role: UserRole.PRINCIPAL },
  { id: 'c3', name: 'Mr. Davis', role: UserRole.TEACHER },
  { id: 'c4', name: 'Mrs. Johnson', role: UserRole.TEACHER },
  { id: 'c5', name: 'Dr. Evans', role: UserRole.PRINCIPAL }, // Consultant/Principal role
  { id: 'c6', name: 'Dr. Aris Thorne', role: UserRole.DISTRICT },
  { id: 'c7', name: 'Mr. Thompson', role: UserRole.TEACHER },
];

// Expanded Emoji List
const EMOJIS = [
  // Faces
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '😊', 
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', 
  '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', 
  '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', 'worried', '😕', '🙁', 
  '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', 
  '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', 'mwuhaha', '😨', '😰',
  // Hands/Gestures
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', 
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '👍', '👎', 
  '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
  // Objects/Symbols
  '✍️', '💅', '🤳', '💪', '🧠', '🫀', '👀', '👁️', '🗣️', '👤',
  '👥', '🫂', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔',
  '🎒', '📚', '📝', '✏️', '📏', '💻', '🖥️', '🖨️', '💡', '⏰',
  '✅', '❌', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '🎉',
  '🎊', '🎈', '🎂', '🎁', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉'
];

// Mock GIF Database for Search Simulation
const MOCK_GIF_DB = [
    { id: 'g1', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/3o7abKhOpu0NwenH3O/giphy.gif', tags: ['excited', 'happy', 'minions', 'yay', 'party'] },
    { id: 'g2', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/l0HlHJGHe3yAMjfFK/giphy.gif', tags: ['thumbs up', 'yes', 'good', 'agree', 'success'] },
    { id: 'g3', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/xT5LMHxhOfscxPfIfm/giphy.gif', tags: ['thinking', 'confused', 'math', 'calculate', 'wonder'] },
    { id: 'g4', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/26u4lOMA8JKSnL9Uk/giphy.gif', tags: ['high five', 'team', 'celebrate', 'good job'] },
    { id: 'g5', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3J5Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/3o6Zt6KHxJTbXCnSlu/giphy.gif', tags: ['working', 'typing', 'busy', 'cat', 'computer'] },
    { id: 'g6', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHJ5Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/l0Ex3lGNEk4k8wIdy/giphy.gif', tags: ['reading', 'book', 'study', 'learn'] },
    { id: 'g7', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXJ5Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/xT4uQ8S78qlfWbnTuU/giphy.gif', tags: ['hello', 'hi', 'wave', 'welcome'] },
    { id: 'g8', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYXJ5Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/d31vTpVi1kQFF97y/giphy.gif', tags: ['no', 'stop', 'wait', 'smh'] },
    { id: 'g9', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJ5Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/l2JJO0D0JpgoU/giphy.gif', tags: ['sad', 'cry', 'upset', 'tears'] },
    { id: 'g10', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3J5Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4Z2Z4/3o7qDEq2kMkkbmScDU/giphy.gif', tags: ['laugh', 'lol', 'funny', 'haha'] },
];

export const MessagesView: React.FC<MessagesViewProps> = ({ 
  currentUserRole: _currentUserRole, 
  currentUserName, 
  onMenuClick,
  targetRecipient 
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  
  // Attachment State
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  // GIF Search State
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [availableGifs, setAvailableGifs] = useState(MOCK_GIF_DB.slice(0, 4)); // Initial Trending
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);

  // Mobile state
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  
  // Modal States
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  
  // New Message / Group Creation State
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  // --- Video Call State ---
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'Connecting' | 'Connected' | 'Ended'>('Connecting');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations specific to the current user
  useEffect(() => {
    if (currentUserName) {
        const userConvos = MOCK_CONVERSATIONS.filter(c => 
            c.participants?.includes(currentUserName) || c.isGroup // Include groups for simplicity or filter deeper
        );
        setConversations(userConvos);
        setSelectedConversationId(null); // Reset selection on user switch
        setIsMobileChatOpen(false);
    }
  }, [currentUserName]);

  // Initialize with target if provided
  useEffect(() => {
    if (targetRecipient && currentUserName) {
      const existing = conversations.find(c => 
        !c.isGroup && c.participants?.includes(targetRecipient)
      );
      
      if (existing) {
        setSelectedConversationId(existing.id);
        setIsMobileChatOpen(true);
      } else {
        // Create temp conversation locally if not exists
        const newId = `new-${Date.now()}`;
        const newConvo: Conversation = {
          id: newId,
          participantId: `temp-${Date.now()}`,
          participantName: targetRecipient, // Will be resolved dynamically later
          participantRole: UserRole.PARENT, // Default, logic handles real role
          participantAvatarSeed: targetRecipient.replace(/\s/g, ''),
          lastMessage: '',
          lastMessageTime: 'New',
          unreadCount: 0,
          messages: [],
          isGroup: false,
          participants: [currentUserName, targetRecipient]
        };
        setConversations(prev => [newConvo, ...prev]);
        setSelectedConversationId(newId);
        setIsMobileChatOpen(true);
      }
    }
  }, [targetRecipient, currentUserName, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, conversations, pendingAttachments]);

  // Call Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isVideoCallActive && callStatus === 'Connected') {
        interval = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVideoCallActive, callStatus]);

  // Reset GIF search when picker closes
  useEffect(() => {
    if (!showGifPicker) {
        setGifSearchQuery('');
        setAvailableGifs(MOCK_GIF_DB.slice(0, 4));
    }
  }, [showGifPicker]);

  // Close pickers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.picker-container') && !target.closest('.picker-trigger')) {
            setShowEmojiPicker(false);
            setShowGifPicker(false);
        }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // --- Helper to get display name/avatar for a conversation relative to current user ---
  const getConversationMeta = (convo: Conversation) => {
      if (convo.isGroup) {
          return {
              name: convo.participantName || 'Group Chat', // Use defined name or fallback
              avatarSeed: convo.participantAvatarSeed || 'group',
              role: 'Group'
          };
      }
      
      // For 1:1, find the participant that is NOT me
      const otherParticipant = convo.participants?.find(p => p !== currentUserName) || convo.participantName;
      return {
          name: otherParticipant,
          avatarSeed: otherParticipant.replace(/\s/g, ''),
          role: convo.participantRole // This might be inaccurate if roles differ, but sufficient for demo
      };
  };

  const activeConversation = conversations.find(c => c.id === selectedConversationId);
  const activeMeta = activeConversation ? getConversationMeta(activeConversation) : null;

  const filteredConversations = conversations.filter(c => {
      const meta = getConversationMeta(c);
      return meta.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const availableContacts = MOCK_CONTACTS.filter(c => 
    c.name !== currentUserName && 
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  // --- Handlers ---

  const handleSendMessage = () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !selectedConversationId) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      senderName: currentUserName, // Use real name
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
      isMe: true,
      attachments: [...pendingAttachments]
    };

    setConversations(prev => prev.map(c => {
      if (c.id === selectedConversationId) {
        return {
          ...c,
          messages: [...c.messages, msg],
          lastMessage: pendingAttachments.length > 0 && !newMessage ? 'Sent an attachment' : newMessage,
          lastMessageTime: 'Just now'
        };
      }
      return c;
    }));

    setNewMessage('');
    setPendingAttachments([]);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        files.forEach((file: File) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const isImage = file.type.startsWith('image/');
                const newAttachment: Attachment = {
                    id: `att-${Date.now()}-${Math.random()}`,
                    type: isImage ? 'image' : 'file',
                    url: reader.result as string,
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    mimeType: file.type
                };
                setPendingAttachments(prev => [...prev, newAttachment]);
            };
            reader.readAsDataURL(file);
        });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
      setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleEmojiClick = (emoji: string) => {
      setNewMessage(prev => prev + emoji);
  };

  // GIF Search Simulation
  const handleSearchGifs = (query: string) => {
      setGifSearchQuery(query);
      setIsSearchingGifs(true);
      
      // Debounce simulation
      setTimeout(() => {
          if (!query.trim()) {
              setAvailableGifs(MOCK_GIF_DB.slice(0, 4)); // Trending
          } else {
              const results = MOCK_GIF_DB.filter(gif => 
                  gif.tags.some(tag => tag.includes(query.toLowerCase()))
              );
              setAvailableGifs(results);
          }
          setIsSearchingGifs(false);
      }, 500); // 500ms delay
  };

  const handleGifSelect = (gifUrl: string) => {
      const gifAttachment: Attachment = {
          id: `gif-${Date.now()}`,
          type: 'image',
          url: gifUrl,
          name: 'GIF',
          size: 'GIF'
      };
      setPendingAttachments(prev => [...prev, gifAttachment]);
      setShowGifPicker(false);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!selectedConversationId) return;
    setConversations(prev => prev.map(c => {
      if (c.id === selectedConversationId) {
        return {
          ...c,
          messages: c.messages.filter(m => m.id !== messageId)
        };
      }
      return c;
    }));
  };

  const handleDeleteConversation = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedConversationId) return;
    // Simple custom modal or native confirm for now
    if (window.confirm("Are you sure you want to delete this conversation?")) {
        setConversations(prev => prev.filter(c => c.id !== selectedConversationId));
        setSelectedConversationId(null);
        setIsMobileChatOpen(false);
        setShowGroupInfoModal(false);
    }
  };

  const handleCreateConversation = () => {
    if (selectedContacts.length === 0) return;

    const isGroup = selectedContacts.length > 1;
    const participants = [currentUserName, ...selectedContacts]; // Include current user
    
    let name = "";
    let role: UserRole | 'Group' = 'Group';
    
    if (isGroup) {
        name = groupName.trim() || selectedContacts.join(', ');
        role = 'Group';
    } else {
        name = selectedContacts[0];
        const contact = MOCK_CONTACTS.find(c => c.name === name);
        role = contact?.role as UserRole || UserRole.PARENT;
    }

    const existing = conversations.find(c => {
        if (isGroup) return false; // Always create new group for simplicity in demo
        return !c.isGroup && c.participants?.includes(selectedContacts[0]);
    });

    if (existing) {
        setSelectedConversationId(existing.id);
    } else {
        const newConvo: Conversation = {
            id: `new-${Date.now()}`,
            participantId: `p-${Date.now()}`,
            participantName: name, // For group, this is group name
            participantRole: role,
            participantAvatarSeed: name.replace(/\s/g, ''),
            lastMessage: '',
            lastMessageTime: 'New',
            unreadCount: 0,
            messages: [],
            isGroup: isGroup,
            participants: participants
        };
        setConversations([newConvo, ...conversations]);
        setSelectedConversationId(newConvo.id);
    }

    setShowNewMessageModal(false);
    setSelectedContacts([]);
    setGroupName('');
    setIsMobileChatOpen(true);
  };

  const handleToggleContact = (contactName: string) => {
    if (selectedContacts.includes(contactName)) {
        setSelectedContacts(prev => prev.filter(c => c !== contactName));
    } else {
        setSelectedContacts(prev => [...prev, contactName]);
    }
  };

  // Group Management
  const handleAddParticipant = (contactName: string) => {
      if (!activeConversation) return;
      setConversations(prev => prev.map(c => {
          if (c.id === activeConversation.id) {
              const currentParticipants = c.participants || [c.participantName]; 
              if (currentParticipants.includes(contactName)) return c;
              
              const newParticipants = [...currentParticipants, contactName];
              const isNowGroup = newParticipants.length > 2; // >2 because array includes "Me" implicitly in logic usually, but here explicit
              
              // If renaming needed
              const newName = isNowGroup && !c.isGroup ? `${activeMeta?.name}, ${contactName}` : c.participantName;

              return {
                  ...c,
                  isGroup: isNowGroup,
                  participantName: newName,
                  participantRole: isNowGroup ? 'Group' : c.participantRole,
                  participants: newParticipants
              };
          }
          return c;
      }));
  };

  const handleRemoveParticipant = (contactName: string) => {
      if (!activeConversation) return;
      setConversations(prev => prev.map(c => {
          if (c.id === activeConversation.id) {
              const newParticipants = (c.participants || []).filter(p => p !== contactName);
              if (newParticipants.length === 0) return c; 
              return { ...c, participants: newParticipants };
          }
          return c;
      }));
  };

  const getRoleBadgeStyle = (role: string) => {
    switch(role) {
      case UserRole.PRINCIPAL: return 'bg-violet-100 text-violet-700 border border-violet-200';
      case UserRole.TEACHER: return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
      case UserRole.DISTRICT: return 'bg-purple-100 text-purple-700 border border-purple-200';
      case UserRole.PARENT: return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'Group': return 'bg-slate-100 text-slate-700 border border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  // --- Video Call Handlers ---
  const handleStartCall = async () => {
    setIsVideoCallActive(true);
    setCallStatus('Connecting');
    setCallDuration(0);
    
    // Start user camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
    } catch (e) {
        console.error("Error accessing media devices.", e);
        // Continue without camera if failed (mock fallback)
    }

    // Simulate connection
    setTimeout(() => {
        setCallStatus('Connected');
    }, 1500);
  };

  const handleEndCall = () => {
      setCallStatus('Ended');
      if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
      }
      setTimeout(() => {
          setIsVideoCallActive(false);
      }, 500);
  };

  const handleToggleMute = () => {
      if (localStream) {
          localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      }
      setIsMuted(!isMuted);
  };

  const handleToggleCamera = () => {
      if (localStream) {
          localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      }
      setIsCameraOff(!isCameraOff);
  };

  const formatDuration = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* --- Video Call Overlay --- */}
      {isVideoCallActive && activeMeta && (
          <div className="absolute inset-0 z-[60] bg-slate-900 flex flex-col animate-in fade-in duration-500">
              {/* Call Header */}
              <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                  <div>
                      <h2 className="text-white text-2xl font-bold shadow-black drop-shadow-md">{activeMeta.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${callStatus === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                          <p className="text-white/80 text-sm font-medium tracking-wide">
                              {callStatus === 'Connected' ? formatDuration(callDuration) : callStatus}
                          </p>
                      </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                      <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Encrypted</span>
                  </div>
              </div>

              {/* Main Video Area (Remote Participant) */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                  {/* Placeholder for Remote Video - In real app, this would be a WebRTC stream */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-40 h-40 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center overflow-hidden mb-6 shadow-2xl relative">
                          <img 
                              src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${activeMeta.avatarSeed}&backgroundColor=e0e7ff`} 
                              alt={activeMeta.name}
                              className="w-full h-full object-cover opacity-80"
                          />
                          {/* Pulse Rings for "Calling" state */}
                          {callStatus === 'Connecting' && (
                              <>
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/50 animate-ping"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping delay-150"></div>
                              </>
                          )}
                      </div>
                      <p className="text-slate-400 font-medium text-lg animate-pulse">
                          {callStatus === 'Connecting' ? 'Calling...' : 'Video paused by user'}
                      </p>
                  </div>
              </div>

              {/* Self View (PiP) */}
              <div className="absolute top-24 right-6 w-48 aspect-video bg-black rounded-xl border-2 border-slate-700 shadow-2xl overflow-hidden z-20 group">
                  {isCameraOff ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                          <VideoOff size={24} />
                      </div>
                  ) : (
                      <video 
                          ref={localVideoRef} 
                          autoPlay 
                          muted 
                          playsInline 
                          className="w-full h-full object-cover transform scale-x-[-1]" 
                      />
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm">You</div>
              </div>

              {/* Controls Bar */}
              <div className="pb-8 pt-4 flex justify-center items-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
                  <button 
                      onClick={handleToggleMute}
                      className={`p-4 rounded-full backdrop-blur-md border transition-all duration-200 ${isMuted ? 'bg-white text-slate-900 border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                  >
                      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  
                  <button 
                      onClick={handleEndCall}
                      className="p-5 rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/50 hover:bg-rose-700 hover:scale-105 transition-all duration-200 mx-4"
                  >
                      <PhoneOff size={32} />
                  </button>

                  <button 
                      onClick={handleToggleCamera}
                      className={`p-4 rounded-full backdrop-blur-md border transition-all duration-200 ${isCameraOff ? 'bg-white text-slate-900 border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                  >
                      {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                  </button>
              </div>
          </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden" 
      />

      {/* New Message Modal */}
      {showNewMessageModal && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-900">New Conversation</h3>
                      <button onClick={() => setShowNewMessageModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-100"><X size={20} /></button>
                  </div>
                  
                  <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/50">
                      {selectedContacts.length > 1 && (
                          <input 
                            type="text" 
                            placeholder="Group Name (Optional)" 
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                          />
                      )}
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        />
                      </div>
                      {selectedContacts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedContacts.map(c => (
                                <span key={c} className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in zoom-in">
                                    {c} <button onClick={() => handleToggleContact(c)} className="hover:text-indigo-900"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                      )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                      {availableContacts.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">No contacts found.</div>
                      ) : (
                        availableContacts.map(contact => (
                            <div 
                                key={contact.id} 
                                onClick={() => handleToggleContact(contact.name)}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                            >
                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selectedContacts.includes(contact.name) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white group-hover:border-indigo-300'}`}>
                                    {selectedContacts.includes(contact.name) && <Check size={16} className="text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{contact.name}</p>
                                    <p className="text-xs text-slate-500">{contact.role}</p>
                                </div>
                            </div>
                        ))
                      )}
                  </div>

                  <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                      <button 
                        onClick={handleCreateConversation}
                        disabled={selectedContacts.length === 0}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                      >
                          {selectedContacts.length > 1 ? `Create Group (${selectedContacts.length})` : 'Start Chat'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Info / Manage Modal */}
      {showGroupInfoModal && activeConversation && activeMeta && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <h3 className="font-bold text-slate-800">Chat Details</h3>
                      <button onClick={() => setShowGroupInfoModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                  </div>
                  
                  <div className="p-8 text-center border-b border-slate-100">
                        <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full border-4 border-white shadow-lg overflow-hidden mb-4 ring-1 ring-slate-100">
                            {activeConversation.isGroup ? (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600">
                                    <Users size={40} />
                                </div>
                            ) : (
                                <img 
                                    src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${activeMeta.avatarSeed}&backgroundColor=e0e7ff`} 
                                    alt="avatar"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-1">{activeMeta.name}</h2>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${getRoleBadgeStyle(activeConversation.isGroup ? 'Group' : activeMeta.role)}`}>
                            {activeConversation.isGroup ? 'Group Chat' : activeMeta.role}
                        </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 bg-slate-50/30">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Participants ({activeConversation.participants?.length || 1})</h4>
                      <div className="space-y-1">
                          {(activeConversation.participants || [activeMeta.name]).map((name, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                                         <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${name}&backgroundColor=e0e7ff`} className="w-full h-full object-cover"/>
                                      </div>
                                      {name} {name === currentUserName && '(You)'}
                                  </span>
                                  {activeConversation.isGroup && (
                                      <button onClick={() => handleRemoveParticipant(name)} className="text-slate-300 hover:text-rose-500 p-1 transition-colors" title="Remove">
                                          <UserMinus size={16} />
                                      </button>
                                  )}
                              </div>
                          ))}
                      </div>
                      
                      {activeConversation.isGroup && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Add Participant</p>
                              <div className="relative">
                                <select 
                                    onChange={(e) => { if(e.target.value) { handleAddParticipant(e.target.value); e.target.value = ''; } }}
                                    className="w-full p-2.5 pl-3 text-sm bg-white border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                >
                                    <option value="">Select contact...</option>
                                    {MOCK_CONTACTS.filter(c => !(activeConversation.participants || []).includes(c.name)).map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <UserPlus size={16} />
                                </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                      <button 
                        onClick={handleDeleteConversation}
                        className="w-full py-3 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold shadow-sm hover:bg-rose-50 hover:border-rose-300 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                          <Trash2 size={16} /> Delete Conversation
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex h-full">
        
        {/* Sidebar / Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50 ${isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-white shadow-sm z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button 
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    <Menu size={24} />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Messages</h2>
              </div>
              <button 
                onClick={() => setShowNewMessageModal(true)}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                title="New Message"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search messages..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-xl text-sm focus:bg-white focus:border-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredConversations.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <p className="text-sm font-medium">No conversations found.</p>
                </div>
            ) : (
                filteredConversations.map(convo => {
                    const meta = getConversationMeta(convo);
                    return (
                        <div 
                            key={convo.id}
                            onClick={() => { setSelectedConversationId(convo.id); setIsMobileChatOpen(true); }}
                            className={`p-3 rounded-xl cursor-pointer transition-all border border-transparent group relative ${
                                selectedConversationId === convo.id 
                                ? 'bg-white border-indigo-100 shadow-sm' 
                                : 'hover:bg-white hover:border-slate-200 hover:shadow-sm'
                            }`}
                        >
                            {selectedConversationId === convo.id && <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-600 rounded-r-full" />}
                            
                            <div className="flex items-start gap-3">
                                <div className="relative shrink-0">
                                    <div className={`w-12 h-12 rounded-full border-2 overflow-hidden flex items-center justify-center text-slate-500 ${selectedConversationId === convo.id ? 'border-indigo-100' : 'border-white shadow-sm'}`}>
                                        {convo.isGroup ? (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                                <Users size={20} className="text-indigo-500" />
                                            </div>
                                        ) : (
                                            <img 
                                                src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${meta.avatarSeed}&backgroundColor=e0e7ff`} 
                                                alt={meta.name}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    {convo.unreadCount > 0 && (
                                        <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm px-1">
                                        {convo.unreadCount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 py-0.5">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className={`text-sm truncate ${convo.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                        {meta.name}
                                        </h3>
                                        <span className={`text-[10px] whitespace-nowrap ${convo.unreadCount > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                                            {convo.lastMessageTime}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate leading-relaxed ${convo.unreadCount > 0 ? 'font-semibold text-slate-800' : 'text-slate-500 group-hover:text-slate-600'}`}>
                                        {convo.lastMessage || <span className="italic opacity-70">Start a conversation</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className={`flex-1 flex flex-col bg-white relative ${!isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation && activeMeta ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setShowGroupInfoModal(true)}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMobileChatOpen(false); }}
                    className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative">
                    {activeConversation.isGroup ? (
                        <Users size={18} className="text-indigo-600" />
                    ) : (
                        <img 
                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${activeMeta.avatarSeed}&backgroundColor=e0e7ff`} 
                        alt={activeMeta.name}
                        className="w-full h-full object-cover"
                        />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                        {activeMeta.name}
                        {activeConversation.isGroup && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">{activeConversation.participants?.length}</span>}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getRoleBadgeStyle(activeMeta.role)}`}>
                      {activeMeta.role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => alert("Sending SMS notification...")}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden sm:block"
                    title="Send SMS"
                  >
                    <Smartphone size={18} />
                  </button>
                  <button 
                    onClick={handleStartCall}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden sm:block"
                    title="Start Video Call"
                  >
                    <Video size={18} />
                  </button>
                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                  <button 
                    onClick={() => setShowGroupInfoModal(true)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white">
                {activeConversation.messages.map((msg) => {
                  // Calculate isMe dynamically based on currentUserName
                  const isMe = msg.senderName === currentUserName;
                  
                  return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    
                    {/* Hover Actions (Left side for Me) */}
                    {isMe && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                            <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}

                    <div className={`max-w-[85%] md:max-w-[70%] flex flex-col gap-1`}>
                        {!isMe && activeConversation.isGroup && (
                            <p className="text-[10px] font-bold text-indigo-600 ml-1">{msg.senderName}</p>
                        )}

                        <div className={`rounded-2xl p-4 text-sm shadow-sm relative group-hover:shadow-md transition-shadow ${
                        isMe 
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm' 
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                        }`}>
                        
                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {msg.attachments.map(att => (
                                    <div key={att.id} className={`rounded-lg overflow-hidden border ${isMe ? 'border-white/20' : 'border-slate-200'}`}>
                                        {att.type === 'image' ? (
                                            <img src={att.url} alt="attachment" className="w-full max-w-[240px] h-auto object-cover" />
                                        ) : (
                                            <div className={`flex items-center gap-3 p-3 ${isMe ? 'bg-white/10' : 'bg-slate-50'}`}>
                                                <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold truncate max-w-[120px]">{att.name}</p>
                                                    <p className={`text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{att.size}</p>
                                                </div>
                                                <button className={`p-1.5 rounded-full transition-colors ${isMe ? 'hover:bg-white/20' : 'hover:bg-slate-200'}`}>
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        
                        <div className={`flex items-center gap-1.5 justify-end mt-1.5 text-[10px] font-medium ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                            <span>{msg.timestamp}</span>
                            {isMe && (
                                msg.isRead ? <CheckCheck size={14} className="opacity-90" /> : <Check size={14} className="opacity-90" />
                            )}
                        </div>
                        </div>
                    </div>

                    {/* Hover Actions (Right side for Others) */}
                    {!isMe && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                             <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}

                  </div>
                )})}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-6 bg-white relative z-20">
                 
                 {/* Pending Attachments Preview */}
                 {pendingAttachments.length > 0 && (
                     <div className="flex gap-3 mb-3 overflow-x-auto pb-2 animate-in fade-in slide-in-from-bottom-2">
                         {pendingAttachments.map(att => (
                             <div key={att.id} className="relative w-20 h-20 rounded-xl border border-slate-200 overflow-hidden shrink-0 group shadow-sm">
                                 {att.type === 'image' ? (
                                     <img src={att.url} className="w-full h-full object-cover" alt="preview" />
                                 ) : (
                                     <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-1">
                                         <FileText size={24} />
                                         <span className="text-[8px] font-bold uppercase px-1 truncate w-full text-center">{att.name.split('.').pop()}</span>
                                     </div>
                                 )}
                                 <button 
                                    onClick={() => handleRemoveAttachment(att.id)}
                                    className="absolute top-1 right-1 bg-black/50 hover:bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                                 >
                                     <X size={10} />
                                 </button>
                             </div>
                         ))}
                     </div>
                 )}

                 {/* Picker Popovers */}
                 <div className="absolute bottom-20 left-6 z-30 flex gap-2">
                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                        <div className="picker-container bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 w-72 animate-in zoom-in-95 slide-in-from-bottom-2 origin-bottom-left">
                            <p className="text-xs font-bold text-slate-400 mb-2 px-1 uppercase tracking-wider">Emojis</p>
                            <div className="grid grid-cols-6 gap-1 max-h-60 overflow-y-auto custom-scrollbar">
                                {EMOJIS.map((emoji, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleEmojiClick(emoji)}
                                        className="text-2xl hover:bg-slate-100 p-2 rounded-lg transition-colors flex items-center justify-center"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* GIF Picker */}
                    {showGifPicker && (
                        <div className="picker-container bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 w-80 animate-in zoom-in-95 slide-in-from-bottom-2 origin-bottom-left flex flex-col gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Search GIPHY..."
                                    value={gifSearchQuery}
                                    onChange={(e) => handleSearchGifs(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                    autoFocus
                                />
                            </div>
                            
                            <p className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider flex justify-between">
                                {gifSearchQuery ? 'Search Results' : 'Trending GIFs'}
                                {isSearchingGifs && <Loader2 size={12} className="animate-spin text-indigo-500" />}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar min-h-[100px]">
                                {availableGifs.length === 0 && !isSearchingGifs ? (
                                    <div className="col-span-2 text-center py-4 text-xs text-slate-400">No GIFs found.</div>
                                ) : (
                                    availableGifs.map(gif => (
                                        <div 
                                            key={gif.id} 
                                            onClick={() => handleGifSelect(gif.url)}
                                            className="cursor-pointer hover:opacity-80 transition-opacity rounded-lg overflow-hidden h-24 bg-slate-100 relative group"
                                        >
                                            <img src={gif.url} alt="GIF" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white font-bold text-xs bg-black/50 px-2 py-1 rounded-full">Send</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                 </div>

                 {/* Main Input Bar */}
                 <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 focus-within:bg-white transition-all shadow-sm">
                    <div className="flex items-center gap-1 pb-1 pl-1">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Attach File"
                        >
                            <Plus size={20} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                            className={`picker-trigger p-2 rounded-lg transition-colors ${showGifPicker ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Add GIF"
                        >
                            <Sticker size={20} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                            className={`picker-trigger p-2 rounded-lg transition-colors ${showEmojiPicker ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Add Emoji"
                        >
                            <Smile size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 py-2">
                        <textarea 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Type a message..."
                        className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[24px] text-sm text-slate-800 placeholder:text-slate-400 p-0 leading-relaxed"
                        rows={1}
                        style={{ height: 'auto', minHeight: '24px' }} 
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                        />
                    </div>
                    
                    <button 
                        onClick={handleSendMessage}
                        disabled={(!newMessage.trim() && pendingAttachments.length === 0)}
                        className="p-2.5 mb-0.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center"
                    >
                        <Send size={18} className={newMessage.trim() || pendingAttachments.length > 0 ? "ml-0.5" : ""} />
                    </button>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-indigo-50">
                    <Send size={40} className="text-indigo-300 ml-1 mt-1" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">Your Messages</h3>
                <p className="text-sm text-slate-500 max-w-xs text-center leading-relaxed mb-8">
                    Select a conversation from the list or start a new chat to collaborate with staff and parents.
                </p>
                <button 
                    onClick={() => setShowNewMessageModal(true)}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <Plus size={18} /> Start New Chat
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
