
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, Conversation, Message, MessagesLaunchContext } from '../types';
import { UserRole } from '../types';
import { 
  Search, 
  Send, 
  MoreVertical, 
  Smartphone,
  Video, 
  Smile, 
  Check, 
  CheckCheck,
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
import { useTenantCollection } from '../hooks/useTenantCollection';
import { SidebarToggleButton } from './SidebarToggleButton';
import {
  conversationMatchesContextFilter,
  type ConversationContextFilter,
  filterConversationsByQuery,
  formatMessageTimeLabel,
  MAX_ATTACHMENTS_PER_MESSAGE,
  summarizeThreadContext,
  sortConversationsByLastActivity,
  toLaunchContextSignature,
  validateAttachment,
} from '../lib/messages-utils';

interface MessagesViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  onMenuClick: () => void;
  launchContext?: MessagesLaunchContext | null;
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

const STAFF_ROLES = new Set<UserRole>([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DISTRICT]);

// Expanded Emoji List
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '😊', '🙂', '😉', '😍',
  '😘', '😎', '🤩', '🥳', '😇', '🤔', '😮', '😢', '😭', '😡',
  '👋', '👌', '🙏', '👍', '👎', '👏', '🙌', '🤝', '✍️', '💪',
  '🧠', '👀', '🗣️', '🎒', '📚', '📝', '💡', '⏰', '✅', '❌',
  '🎉', '🎯', '🏆', '📎', '📅', '📈', '📣', '🤗', '❤️', '⭐'
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
  currentUserRole, 
  currentUserName, 
  onMenuClick,
  launchContext
}) => {
  const messagesCollection = useTenantCollection<Conversation>('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFilter, setContextFilter] = useState<ConversationContextFilter>('all');
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
  const [showDeleteConversationModal, setShowDeleteConversationModal] = useState(false);
  
  // New Message / Group Creation State
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [deletedMessageState, setDeletedMessageState] = useState<{
    conversationId: string;
    message: Message;
    index: number;
    timeoutId: number;
  } | null>(null);

  // --- Video Call State ---
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'Connecting' | 'Connected' | 'Ended'>('Connecting');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const newMessageButtonRef = useRef<HTMLButtonElement>(null);
  const emptyStateNewMessageButtonRef = useRef<HTMLButtonElement>(null);
  const convoDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const gifSearchRequestRef = useRef(0);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const hasHydratedRef = useRef(false);
  const lastPersistedRef = useRef("");
  const lastHandledLaunchRef = useRef("");
  const isStaffUser = STAFF_ROLES.has(currentUserRole);

  // Load conversations specific to the current user
  useEffect(() => {
    if (currentUserName) {
        const source = messagesCollection.query.data?.rows ?? [];
        if (!messagesCollection.query.data) return;
        hasHydratedRef.current = true;
        const userConvos = source.filter(c => 
            c.participants?.includes(currentUserName) || c.isGroup // Include groups for simplicity or filter deeper
        );
        const sortedConversations = sortConversationsByLastActivity(userConvos);
        lastPersistedRef.current = JSON.stringify(sortedConversations);
        setConversations(sortedConversations);
        setSelectedConversationId(null); // Reset selection on user switch
        setIsMobileChatOpen(false);
    }
  }, [currentUserName, messagesCollection.query.data]);

  const resolveLaunchRecipientRole = (recipientName: string, fallback?: UserRole): UserRole => {
    if (fallback) return fallback;
    return MOCK_CONTACTS.find((contact) => contact.name === recipientName)?.role ?? UserRole.PARENT;
  };

  // Initialize from structured launch context (interventions/referrals/dashboard handoff)
  useEffect(() => {
    if (!hasHydratedRef.current || !launchContext || !currentUserName) return;
    const signature = toLaunchContextSignature(launchContext);
    if (!signature || signature === lastHandledLaunchRef.current) return;
    lastHandledLaunchRef.current = signature;

    const recipient = launchContext.recipientName?.trim();
    if (!recipient) {
      if (launchContext.draft?.trim()) {
        setNewMessage(launchContext.draft.trim());
      }
      return;
    }

    const existing = conversations.find(
      (conversation) => !conversation.isGroup && conversation.participants?.includes(recipient),
    );

    if (existing) {
      if (launchContext.context) {
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === existing.id
              ? { ...conversation, threadContext: launchContext.context }
              : conversation,
          ),
        );
      }
      openConversation(existing.id);
    } else {
      const newId = `new-${Date.now()}`;
      const participantRole = resolveLaunchRecipientRole(recipient, launchContext.recipientRole);
      const newConversation: Conversation = {
        id: newId,
        participantId: `temp-${Date.now()}`,
        participantName: recipient,
        participantRole,
        participantAvatarSeed: recipient.replace(/\s/g, ''),
        lastMessage: '',
        lastMessageTime: 'New',
        unreadCount: 0,
        messages: [],
        isGroup: false,
        participants: [currentUserName, recipient],
        threadContext: launchContext.context,
      };
      setConversations((previous) => sortConversationsByLastActivity([newConversation, ...previous]));
      openConversation(newId);
    }

    if (launchContext.draft?.trim()) {
      setNewMessage(launchContext.draft.trim());
      setComposerError(null);
    }
  }, [conversations, currentUserName, launchContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, conversations, pendingAttachments]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    const serialized = JSON.stringify(conversations);
    if (serialized === lastPersistedRef.current) return;
    const timeout = window.setTimeout(() => {
      lastPersistedRef.current = serialized;
      messagesCollection.replaceMutation.mutate(conversations);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [conversations, messagesCollection.replaceMutation]);

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

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showDeleteConversationModal) {
        setShowDeleteConversationModal(false);
        convoDeleteButtonRef.current?.focus();
        return;
      }
      if (showGroupInfoModal) {
        setShowGroupInfoModal(false);
        return;
      }
      if (showNewMessageModal) {
        setShowNewMessageModal(false);
        setSelectedContacts([]);
        setGroupName('');
        setContactSearch('');
        modalTriggerRef.current?.focus?.();
        return;
      }
      if (showEmojiPicker) setShowEmojiPicker(false);
      if (showGifPicker) setShowGifPicker(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDeleteConversationModal, showGroupInfoModal, showNewMessageModal, showEmojiPicker, showGifPicker]);

  useEffect(() => {
    return () => {
      if (deletedMessageState) {
        window.clearTimeout(deletedMessageState.timeoutId);
      }
    };
  }, [deletedMessageState]);

  useEffect(() => {
    if (!showNewMessageModal) return;
    const timer = window.setTimeout(() => {
      const searchField = document.querySelector<HTMLInputElement>('input[placeholder="Search people..."]');
      searchField?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showNewMessageModal]);

  useEffect(() => {
    const modalRoot = document.querySelector<HTMLElement>('[data-modal="true"]');
    if (!modalRoot) return;

    const handleTabLock = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = modalRoot.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !modalRoot.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTabLock);
    return () => document.removeEventListener('keydown', handleTabLock);
  }, [showNewMessageModal, showGroupInfoModal, showDeleteConversationModal]);

  // --- Helper to get display name/avatar for a conversation relative to current user ---
  const getConversationMeta = useCallback((convo: Conversation) => {
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
  }, [currentUserName]);

  const activeConversation = conversations.find(c => c.id === selectedConversationId);
  const activeMeta = activeConversation ? getConversationMeta(activeConversation) : null;

  const sortedConversations = useMemo(
    () => sortConversationsByLastActivity(conversations),
    [conversations],
  );

  const contextFilteredConversations = useMemo(
    () =>
      sortedConversations.filter((conversation) =>
        conversationMatchesContextFilter(conversation, contextFilter),
      ),
    [contextFilter, sortedConversations],
  );

  const filteredConversations = useMemo(
    () =>
      filterConversationsByQuery(
        contextFilteredConversations,
        (conversation) => getConversationMeta(conversation).name,
        searchQuery,
      ),
    [contextFilteredConversations, getConversationMeta, searchQuery],
  );
  const hasActiveSearch = searchQuery.trim().length > 0;

  const availableContacts = MOCK_CONTACTS.filter(c => 
    c.name !== currentUserName && 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) &&
    (isStaffUser || STAFF_ROLES.has(c.role))
  );

  // --- Handlers ---

  const openConversation = (conversationId: string) => {
    setSelectedConversationId((previous) => (previous === conversationId ? previous : conversationId));
    setIsMobileChatOpen(true);
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((conversation) => {
        if (conversation.id !== conversationId || conversation.unreadCount === 0) {
          return conversation;
        }
        changed = true;
        return { ...conversation, unreadCount: 0 };
      });
      return changed ? next : prev;
    });
  };

  const openNewMessageModal = (trigger?: HTMLElement | null) => {
    modalTriggerRef.current = trigger ?? null;
    setShowNewMessageModal(true);
  };

  const closeNewMessageModal = () => {
    setShowNewMessageModal(false);
    setSelectedContacts([]);
    setGroupName('');
    setContactSearch('');
    modalTriggerRef.current?.focus?.();
  };

  const closeDeleteConversationModal = () => {
    setShowDeleteConversationModal(false);
    convoDeleteButtonRef.current?.focus();
  };

  const scheduleUndoToastReset = (timeoutId: number) => {
    setDeletedMessageState((prev) => {
      if (!prev || prev.timeoutId !== timeoutId) return prev;
      return null;
    });
  };

  const handleSendMessage = () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !selectedConversationId) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      senderName: currentUserName, // Use real name
      content: newMessage,
      timestamp: new Date().toISOString(),
      isRead: true,
      isMe: true,
      attachments: [...pendingAttachments],
      threadContext: activeConversation?.threadContext,
    };

    setConversations(prev =>
      prev.map(c => {
        if (c.id === selectedConversationId) {
          return {
            ...c,
            unreadCount: 0,
            messages: [...c.messages, msg],
            lastMessage: pendingAttachments.length > 0 && !newMessage ? 'Sent an attachment' : newMessage,
            lastMessageTime: msg.timestamp,
          };
        }
        return c;
      }),
    );

    setNewMessage('');
    setPendingAttachments([]);
    setComposerError(null);
    setShowEmojiPicker(false);
    setShowGifPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        setComposerError(null);
        let nextAttachmentCount = pendingAttachments.length;
        files.forEach((file: File) => {
            const validation = validateAttachment(file, nextAttachmentCount);
            if (!validation.ok) {
                setComposerError(validation.error);
                return;
            }
            nextAttachmentCount += 1;
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
      setComposerError(null);
      setNewMessage(prev => prev + emoji);
  };

  // GIF Search Simulation
  const handleSearchGifs = (query: string) => {
      setGifSearchQuery(query);
      setIsSearchingGifs(true);
      const requestId = gifSearchRequestRef.current + 1;
      gifSearchRequestRef.current = requestId;
      
      // Debounce simulation
      setTimeout(() => {
          if (requestId !== gifSearchRequestRef.current) {
              return;
          }
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
      if (pendingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
          setComposerError(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
          return;
      }
      const gifAttachment: Attachment = {
          id: `gif-${Date.now()}`,
          type: 'image',
          url: gifUrl,
          name: 'GIF',
          size: 'GIF'
      };
      setPendingAttachments(prev => [...prev, gifAttachment]);
      setComposerError(null);
      setShowGifPicker(false);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!selectedConversationId) return;
    let deletedPayload:
      | {
          conversationId: string;
          message: Message;
          index: number;
        }
      | null = null;

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== selectedConversationId) return c;

        const targetIndex = c.messages.findIndex((message) => message.id === messageId);
        if (targetIndex < 0) return c;
        const removed = c.messages[targetIndex];
        const remainingMessages = c.messages.filter((message) => message.id !== messageId);
        const latestRemaining = remainingMessages[remainingMessages.length - 1];
        const lastMessageLabel = latestRemaining
          ? latestRemaining.content || (latestRemaining.attachments?.length ? 'Sent an attachment' : '')
          : '';
        const lastMessageTime = latestRemaining?.timestamp ?? '';

        deletedPayload = {
          conversationId: c.id,
          message: removed,
          index: targetIndex,
        };

        return {
          ...c,
          messages: remainingMessages,
          lastMessage: lastMessageLabel,
          lastMessageTime,
        };
      }),
    );

    if (!deletedPayload) return;

    setDeletedMessageState((previous) => {
      if (previous) {
        window.clearTimeout(previous.timeoutId);
      }
      const timeoutId = window.setTimeout(() => scheduleUndoToastReset(timeoutId), 5000);
      return { ...deletedPayload, timeoutId };
    });
  };

  const handleUndoDelete = () => {
    if (!deletedMessageState) return;
    window.clearTimeout(deletedMessageState.timeoutId);
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== deletedMessageState.conversationId) return conversation;
        const nextMessages = [...conversation.messages];
        nextMessages.splice(deletedMessageState.index, 0, deletedMessageState.message);
        const latestMessage = nextMessages[nextMessages.length - 1];
        return {
          ...conversation,
          messages: nextMessages,
          lastMessage: latestMessage?.content || (latestMessage?.attachments?.length ? 'Sent an attachment' : ''),
          lastMessageTime: latestMessage?.timestamp ?? '',
        };
      }),
    );
    setDeletedMessageState(null);
  };

  const handleDeleteConversationRequest = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedConversationId) return;
    setShowDeleteConversationModal(true);
  };

  const handleDeleteConversationConfirm = () => {
    if (!selectedConversationId) return;
    if (deletedMessageState?.conversationId === selectedConversationId) {
      window.clearTimeout(deletedMessageState.timeoutId);
      setDeletedMessageState(null);
    }
    setConversations(prev => prev.filter(c => c.id !== selectedConversationId));
    setSelectedConversationId(null);
    setIsMobileChatOpen(false);
    setShowGroupInfoModal(false);
    setShowDeleteConversationModal(false);
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
        openConversation(existing.id);
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
        setConversations(sortConversationsByLastActivity([newConvo, ...conversations]));
        openConversation(newConvo.id);
    }

    closeNewMessageModal();
    setSelectedContacts([]);
    setGroupName('');
    setContactSearch('');
  };

  const handleToggleContact = (contactName: string) => {
    if (!isStaffUser) {
        setSelectedContacts((prev) => (prev.includes(contactName) ? [] : [contactName]));
        return;
    }
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
        accept="image/*,.pdf,.doc,.docx,.txt"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden" 
      />

      {/* New Message Modal */}
      {showNewMessageModal && (
          <div data-modal="true" className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-900">New Conversation</h3>
                      <button onClick={closeNewMessageModal} className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-100" aria-label="Close new conversation dialog"><X size={20} /></button>
                  </div>
                  
                  <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/50">
                      {selectedContacts.length > 1 && isStaffUser && (
                          <input 
                            type="text" 
                            placeholder="Group name (optional)" 
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
                          {selectedContacts.length > 1 && isStaffUser ? `Create Group (${selectedContacts.length})` : 'Start Conversation'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Info / Manage Modal */}
      {showGroupInfoModal && activeConversation && activeMeta && (
          <div data-modal="true" className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <h3 className="font-bold text-slate-800">Chat Details</h3>
                      <button onClick={() => setShowGroupInfoModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors" aria-label="Close chat details"><X size={20} /></button>
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
                                  {activeConversation.isGroup && isStaffUser && (
                                      <button onClick={() => handleRemoveParticipant(name)} className="text-slate-300 hover:text-rose-500 p-1 transition-colors" title="Remove">
                                          <UserMinus size={16} />
                                      </button>
                                  )}
                              </div>
                          ))}
                      </div>
                      
                      {activeConversation.isGroup && isStaffUser && (
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
                        ref={convoDeleteButtonRef}
                        onClick={handleDeleteConversationRequest}
                        className="w-full py-3 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold shadow-sm hover:bg-rose-50 hover:border-rose-300 transition-all flex items-center justify-center gap-2 text-sm"
                        aria-label="Delete conversation"
                      >
                          <Trash2 size={16} /> Delete Conversation
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showDeleteConversationModal && (
          <div data-modal="true" className="absolute inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-100 p-6">
                  <h3 className="text-lg font-bold text-slate-900">Delete conversation?</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    This removes the conversation and message history from your workspace view.
                  </p>
                  <div className="mt-5 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={closeDeleteConversationModal}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteConversationConfirm}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                    >
                      Delete
                    </button>
                  </div>
              </div>
          </div>
      )}

      {deletedMessageState && (
          <div className="absolute bottom-5 right-5 z-[56] bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <span className="text-sm">Message deleted.</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="text-sm font-bold text-indigo-200 hover:text-indigo-100"
            >
              Undo
            </button>
          </div>
      )}

      <div className="flex h-full">
        
        {/* Sidebar / Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50 ${isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-white shadow-sm z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
                />
                <h2 className="text-xl font-bold text-slate-900">Messages</h2>
              </div>
              <button 
                ref={newMessageButtonRef}
                onClick={(event) => openNewMessageModal(event.currentTarget)}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                title="New Message"
                aria-label="Start new conversation"
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
                aria-label="Search conversations"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-xl text-sm focus:bg-white focus:border-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {([
                { id: 'all', label: 'All' },
                { id: 'intervention', label: 'Interventions' },
                { id: 'referral', label: 'Referrals' },
              ] as const).map((filterOption) => (
                <button
                  key={filterOption.id}
                  type="button"
                  onClick={() => setContextFilter(filterOption.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    contextFilter === filterOption.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2" role="listbox" aria-label="Conversations">
            {filteredConversations.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <p className="text-sm font-medium">
                      {hasActiveSearch
                        ? 'No matches for this search.'
                        : contextFilter === 'intervention'
                          ? 'No intervention threads yet.'
                          : contextFilter === 'referral'
                            ? 'No referral threads yet.'
                            : 'No messages yet.'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {hasActiveSearch
                        ? 'Try a different keyword.'
                        : contextFilter === 'all'
                          ? 'Start a new conversation to begin collaborating.'
                          : 'Try switching to All, or launch a message from a referral or intervention.'}
                    </p>
                </div>
            ) : (
                filteredConversations.map(convo => {
                    const meta = getConversationMeta(convo);
                    return (
                        <button
                            key={convo.id}
                            type="button"
                            role="option"
                            aria-selected={selectedConversationId === convo.id}
                            aria-label={`Open conversation with ${meta.name}`}
                            onClick={() => openConversation(convo.id)}
                            className={`w-full text-left p-3 rounded-xl transition-all border border-transparent group relative ${
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
                                            {formatMessageTimeLabel(convo.lastMessageTime) || 'New'}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate leading-relaxed ${convo.unreadCount > 0 ? 'font-semibold text-slate-800' : 'text-slate-500 group-hover:text-slate-600'}`}>
                                        {convo.lastMessage || <span className="italic opacity-70">Start a conversation</span>}
                                    </p>
                                    {convo.threadContext ? (
                                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                                        {summarizeThreadContext(convo.threadContext)}
                                      </p>
                                    ) : null}
                                </div>
                            </div>
                        </button>
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
                <div
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => setShowGroupInfoModal(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setShowGroupInfoModal(true);
                    }
                  }}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMobileChatOpen(false); }}
                    className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    aria-label="Back to conversations"
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getRoleBadgeStyle(activeMeta.role)}`}>
                        {activeMeta.role}
                      </span>
                      {activeConversation.threadContext ? (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          {summarizeThreadContext(activeConversation.threadContext)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isStaffUser && (
                    <>
                      <button 
                        onClick={() => alert("Sending SMS notification...")}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden sm:block"
                        title="Send SMS"
                        aria-label="Send SMS"
                      >
                        <Smartphone size={18} />
                      </button>
                      <button 
                        onClick={handleStartCall}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden sm:block"
                        title="Start Video Call"
                        aria-label="Start video call"
                      >
                        <Video size={18} />
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                    </>
                  )}
                  <button 
                    onClick={() => setShowGroupInfoModal(true)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    aria-label="Open chat details"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white">
                {activeConversation.threadContext ? (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
                    <p className="font-semibold">
                      Linked context: {summarizeThreadContext(activeConversation.threadContext)}
                    </p>
                    <p className="mt-1 text-indigo-700">
                      Student: {activeConversation.threadContext.studentName}
                    </p>
                  </div>
                ) : null}
                {activeConversation.messages.map((msg) => {
                  // Calculate isMe dynamically based on currentUserName
                  const isMe = msg.senderName === currentUserName;
                  
                  return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    
                    {/* Hover Actions (Left side for Me) */}
                    {isMe && (
                        <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity mr-2">
                            <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                title="Delete"
                                aria-label="Delete message"
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
                            <span>{formatMessageTimeLabel(msg.timestamp)}</span>
                            {isMe && (
                                msg.isRead ? <CheckCheck size={14} className="opacity-90" /> : <Check size={14} className="opacity-90" />
                            )}
                        </div>
                        </div>
                    </div>

                    {/* Hover Actions (Right side for Others) */}
                    {!isMe && (
                        <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity ml-2">
                             <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                title="Delete"
                                aria-label="Delete message"
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
                 {composerError && (
                    <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {composerError}
                    </div>
                 )}
                 
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
                                    aria-label="Remove attachment"
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
                            aria-label="Attach file"
                        >
                            <Plus size={20} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                            className={`picker-trigger p-2 rounded-lg transition-colors ${showGifPicker ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Add GIF"
                            aria-label="Add GIF"
                        >
                            <Sticker size={20} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                            className={`picker-trigger p-2 rounded-lg transition-colors ${showEmojiPicker ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Add Emoji"
                            aria-label="Add emoji"
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
                        aria-label="Send message"
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
                    Select a conversation from the list or start a new conversation to collaborate with your MTSS team.
                </p>
                <button 
                    ref={emptyStateNewMessageButtonRef}
                    onClick={(event) => openNewMessageModal(event.currentTarget)}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <Plus size={18} /> New Conversation
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

