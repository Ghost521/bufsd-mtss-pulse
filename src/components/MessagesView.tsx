
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

  const resolveLaunchRecipientRole = (
    recipientName: string,
    fallback?: UserRole,
    roleMap?: Record<string, UserRole>,
  ): UserRole => {
    const recipientKey = recipientName.trim().toLowerCase();
    if (roleMap) {
      const mapped = Object.entries(roleMap).find(([name]) => name.trim().toLowerCase() === recipientKey)?.[1];
      if (mapped) return mapped;
    }
    if (fallback) return fallback;
    return MOCK_CONTACTS.find((contact) => contact.name === recipientName)?.role ?? UserRole.PARENT;
  };

  // Initialize from structured launch context (interventions/referrals/dashboard handoff)
  useEffect(() => {
    if (!hasHydratedRef.current || !launchContext || !currentUserName) return;
    const signature = toLaunchContextSignature(launchContext);
    if (!signature || signature === lastHandledLaunchRef.current) return;
    lastHandledLaunchRef.current = signature;

    const recipientNames = Array.from(
      new Set(
        [
          ...(launchContext.recipientNames ?? []),
          launchContext.recipientName ?? "",
        ]
          .map((name) => name.trim())
          .filter((name) => name.length > 0 && name.toLowerCase() !== currentUserName.trim().toLowerCase()),
      ),
    );

    if (recipientNames.length === 0) {
      if (launchContext.draft?.trim()) {
        setNewMessage(launchContext.draft.trim());
      }
      return;
    }

    if (recipientNames.length === 1) {
      const [recipient] = recipientNames;
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
        const participantRole = resolveLaunchRecipientRole(
          recipient,
          launchContext.recipientRole,
          launchContext.recipientRolesByName,
        );
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
    } else {
      const normalizedLaunchMembers = new Set(
        [currentUserName, ...recipientNames].map((name) => name.trim().toLowerCase()),
      );
      const existingGroup = conversations.find((conversation) => {
        if (!conversation.isGroup || !conversation.participants) return false;
        const memberSet = new Set(conversation.participants.map((name) => name.trim().toLowerCase()));
        if (memberSet.size !== normalizedLaunchMembers.size) return false;
        return Array.from(normalizedLaunchMembers).every((member) => memberSet.has(member));
      });

      if (existingGroup) {
        if (launchContext.context) {
          setConversations((previous) =>
            previous.map((conversation) =>
              conversation.id === existingGroup.id
                ? { ...conversation, threadContext: launchContext.context }
                : conversation,
            ),
          );
        }
        openConversation(existingGroup.id);
      } else {
        const newId = `new-${Date.now()}`;
        const groupParticipants = [currentUserName, ...recipientNames];
        const groupLabel = launchContext.context?.studentName
          ? `${launchContext.context.studentName} Intervention Team`
          : "Intervention Team";
        const newConversation: Conversation = {
          id: newId,
          participantId: `group-${Date.now()}`,
          participantName: groupLabel,
          participantRole: "Group",
          participantAvatarSeed: groupLabel.replace(/\s/g, ''),
          lastMessage: '',
          lastMessageTime: 'New',
          unreadCount: 0,
          messages: [],
          isGroup: true,
          participants: groupParticipants,
          threadContext: launchContext.context,
        };
        setConversations((previous) => sortConversationsByLastActivity([newConversation, ...previous]));
        openConversation(newId);
      }
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
    const payload: { conversationId: string; message: Message; index: number } = deletedPayload;

    setDeletedMessageState((previous) => {
      if (previous) {
        window.clearTimeout(previous.timeoutId);
      }
      const timeoutId = window.setTimeout(() => scheduleUndoToastReset(timeoutId), 5000);
      return { ...payload, timeoutId };
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
    <div className="app-responsive-pane relative flex h-[calc(100vh-100px)] min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 mb-6">
      
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
          <div data-modal="true" className="absolute inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-200/80">
                  <div className="p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/50 rounded-t-3xl">
                      <h3 className="font-extrabold tracking-tight text-xl text-slate-900">New Conversation</h3>
                      <button onClick={closeNewMessageModal} className="text-slate-400 hover:text-slate-600 transition-colors rounded-xl p-2 hover:bg-slate-100/80" aria-label="Close new conversation dialog"><X size={20} strokeWidth={2.5} /></button>
                  </div>
                  
                  <div className="p-6 border-b border-slate-200/60 space-y-4 bg-slate-50/50">
                      {selectedContacts.length > 1 && isStaffUser && (
                          <input 
                            type="text" 
                            placeholder="Group name (optional)" 
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm transition-all"
                          />
                      )}
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.5} />
                        <input 
                            type="text" 
                            placeholder="Search people..." 
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm transition-all"
                        />
                      </div>
                      {selectedContacts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedContacts.map(c => (
                                <span key={c} className="text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100/50 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 animate-in fade-in zoom-in uppercase tracking-wide">
                                    {c} <button onClick={() => handleToggleContact(c)} className="hover:text-indigo-900"><X size={14} strokeWidth={3} /></button>
                                </span>
                            ))}
                        </div>
                      )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      {availableContacts.length === 0 ? (
                          <div className="p-10 text-center font-semibold text-slate-400 text-sm">No contacts found.</div>
                      ) : (
                        availableContacts.map(contact => (
                            <div 
                                key={contact.id} 
                                onClick={() => handleToggleContact(contact.name)}
                                className="flex items-center gap-4 p-3.5 hover:bg-slate-50/80 rounded-2xl cursor-pointer transition-colors group border border-transparent hover:border-slate-200/50"
                            >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedContacts.includes(contact.name) ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300 bg-white group-hover:border-indigo-300'}`}>
                                    {selectedContacts.includes(contact.name) && <Check size={16} strokeWidth={3} className="text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm font-extrabold text-slate-800">{contact.name}</p>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{contact.role}</p>
                                </div>
                            </div>
                        ))
                      )}
                  </div>

                  <div className="p-6 border-t border-slate-200/60 bg-white/50 rounded-b-3xl">
                      <button 
                        onClick={handleCreateConversation}
                        disabled={selectedContacts.length === 0}
                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-extrabold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                      >
                          {selectedContacts.length > 1 && isStaffUser ? `Create Group (${selectedContacts.length})` : 'Start Conversation'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Info / Manage Modal */}
      {showGroupInfoModal && activeConversation && activeMeta && (
          <div data-modal="true" className="absolute inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-200/80 overflow-hidden">
                  <div className="p-5 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
                      <h3 className="font-extrabold tracking-tight text-lg text-slate-900">Chat Details</h3>
                      <button onClick={() => setShowGroupInfoModal(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100/80 transition-colors" aria-label="Close chat details"><X size={20} strokeWidth={2.5} /></button>
                  </div>
                  
                  <div className="p-8 text-center border-b border-slate-200/60 bg-slate-50/30">
                        <div className="w-28 h-28 mx-auto bg-slate-100/80 rounded-3xl border-4 border-white shadow-lg overflow-hidden mb-5 ring-1 ring-slate-200/50">
                            {activeConversation.isGroup ? (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600">
                                    <Users size={48} strokeWidth={2.5} />
                                </div>
                            ) : (
                                <img 
                                    src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${activeMeta.avatarSeed}&backgroundColor=e0e7ff`} 
                                    alt="avatar"
                                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                />
                            )}
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">{activeMeta.name}</h2>
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-md shadow-sm ${getRoleBadgeStyle(activeConversation.isGroup ? 'Group' : activeMeta.role)}`}>
                            {activeConversation.isGroup ? 'Group Chat' : activeMeta.role}
                        </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                      <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-4 px-2">Participants ({activeConversation.participants?.length || 1})</h4>
                      <div className="space-y-1.5">
                          {(activeConversation.participants || [activeMeta.name]).map((name, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 rounded-2xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200/60 transition-all group">
                                  <span className="text-sm font-bold text-slate-800 flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-slate-200 overflow-hidden shadow-sm">
                                         <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${name}&backgroundColor=e0e7ff`} className="w-full h-full object-cover"/>
                                      </div>
                                      {name} {name === currentUserName && <span className="text-slate-400 font-semibold text-xs">(You)</span>}
                                  </span>
                                  {activeConversation.isGroup && isStaffUser && (
                                      <button onClick={() => handleRemoveParticipant(name)} className="text-slate-300 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100" title="Remove">
                                          <UserMinus size={18} strokeWidth={2.5} />
                                      </button>
                                  )}
                              </div>
                          ))}
                      </div>
                      
                      {activeConversation.isGroup && isStaffUser && (
                          <div className="mt-6 pt-5 border-t border-slate-200/60">
                              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 px-2">Add Participant</p>
                              <div className="relative">
                                <select 
                                    onChange={(e) => { if(e.target.value) { handleAddParticipant(e.target.value); e.target.value = ''; } }}
                                    className="w-full p-3.5 pl-4 text-sm font-semibold bg-white border border-slate-200/80 rounded-xl appearance-none focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer shadow-sm transition-all text-slate-700"
                                >
                                    <option value="">Select contact...</option>
                                    {MOCK_CONTACTS.filter(c => !(activeConversation.participants || []).includes(c.name)).map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <UserPlus size={18} strokeWidth={2.5} />
                                </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-6 border-t border-slate-200/60 bg-white/50">
                      <button 
                        ref={convoDeleteButtonRef}
                        onClick={handleDeleteConversationRequest}
                        className="w-full py-3.5 bg-white border border-rose-200 text-rose-600 rounded-xl font-extrabold shadow-sm hover:bg-rose-50 hover:border-rose-300 hover:shadow transition-all flex items-center justify-center gap-2.5 text-sm"
                        aria-label="Delete conversation"
                      >
                          <Trash2 size={18} strokeWidth={2.5} /> Delete Conversation
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showDeleteConversationModal && (
          <div data-modal="true" className="absolute inset-0 z-[65] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 p-8 text-center animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 mx-auto bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-rose-200">
                    <Trash2 size={32} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Delete conversation?</h3>
                  <p className="mt-3 text-sm font-medium text-slate-600 leading-relaxed">
                    This removes the conversation and message history from your workspace view.
                  </p>
                  <div className="mt-8 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteConversationConfirm}
                      className="w-full px-5 py-3.5 text-sm font-extrabold rounded-xl bg-rose-600 text-white shadow-md shadow-rose-500/20 hover:bg-rose-700 hover:shadow-lg transition-all"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={closeDeleteConversationModal}
                      className="w-full px-5 py-3.5 text-sm font-extrabold rounded-xl border border-slate-200/80 text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                  </div>
              </div>
          </div>
      )}

      {deletedMessageState && (
          <div className="absolute bottom-4 left-4 right-4 z-[56] flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-white shadow-xl md:bottom-5 md:left-auto md:right-5">
            <span className="text-sm">Message deleted.</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="text-sm font-semibold text-indigo-200 hover:text-indigo-100"
            >
              Undo
            </button>
          </div>
      )}

      <div className="flex h-full min-w-0">
        
        {/* Sidebar / Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200/60 flex flex-col bg-slate-50/50 backdrop-blur-md ${isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-md p-5 shadow-sm z-10 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
              <div className="flex items-center gap-3">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2.5 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-xl"
                />
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Messages</h2>
              </div>
              <button 
                ref={newMessageButtonRef}
                onClick={(event) => openNewMessageModal(event.currentTarget)}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all active:scale-95 hover:-translate-y-0.5"
                title="New Message"
                aria-label="Start new conversation"
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="relative group mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search messages..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search conversations"
                className="w-full pl-11 pr-4 py-3 bg-slate-100/80 border border-slate-200/50 rounded-xl text-sm font-semibold focus:bg-white focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-inner transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                { id: 'all', label: 'All' },
                { id: 'intervention', label: 'Interventions' },
                { id: 'referral', label: 'Referrals' },
              ] as const).map((filterOption) => (
                <button
                  key={filterOption.id}
                  type="button"
                  onClick={() => setContextFilter(filterOption.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition-all shadow-sm ${
                    contextFilter === filterOption.id
                      ? 'bg-indigo-600 text-white border-transparent shadow-md'
                      : 'bg-white border border-slate-200/80 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar" role="listbox" aria-label="Conversations">
            {filteredConversations.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <p className="text-sm font-extrabold tracking-tight text-slate-700">
                      {hasActiveSearch
                        ? 'No matches for this search.'
                        : contextFilter === 'intervention'
                          ? 'No intervention threads yet.'
                          : contextFilter === 'referral'
                            ? 'No referral threads yet.'
                            : 'No messages yet.'}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-500 max-w-[200px] mx-auto leading-relaxed">
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
                            className={`w-full text-left p-3.5 rounded-2xl transition-all border group relative ${
                                selectedConversationId === convo.id 
                                ? 'bg-white border-indigo-200/80 shadow-md ring-1 ring-indigo-500/10' 
                                : 'bg-transparent border-transparent hover:bg-white/80 hover:border-slate-200/60 hover:shadow-sm'
                            }`}
                        >
                            {selectedConversationId === convo.id && <div className="absolute left-0 top-4 bottom-4 w-1 bg-indigo-600 rounded-r-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" />}
                            
                            <div className="flex items-start gap-3.5">
                                <div className="relative shrink-0">
                                    <div className={`w-14 h-14 rounded-2xl border-2 overflow-hidden flex items-center justify-center text-slate-500 transition-all ${selectedConversationId === convo.id ? 'border-indigo-200 shadow-sm' : 'border-white shadow-sm group-hover:border-indigo-100'}`}>
                                        {convo.isGroup ? (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-100/80">
                                                <Users size={22} strokeWidth={2.5} className="text-indigo-500" />
                                            </div>
                                        ) : (
                                            <img 
                                                src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${meta.avatarSeed}&backgroundColor=e0e7ff`} 
                                                alt={meta.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        )}
                                    </div>
                                    {convo.unreadCount > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-6 bg-rose-500 text-white rounded-xl flex items-center justify-center text-[11px] font-extrabold border-2 border-white shadow-sm px-1.5 animate-pulse">
                                        {convo.unreadCount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 py-0.5">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className={`text-base tracking-tight truncate ${convo.unreadCount > 0 ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800'}`}>
                                        {meta.name}
                                        </h3>
                                        <span className={`text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap ${convo.unreadCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                            {formatMessageTimeLabel(convo.lastMessageTime) || 'New'}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate leading-relaxed ${convo.unreadCount > 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-500 group-hover:text-slate-700 transition-colors'}`}>
                                        {convo.lastMessage || <span className="italic opacity-70">Start a conversation</span>}
                                    </p>
                                    {convo.threadContext ? (
                                      <p className="mt-1.5 text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50/80 inline-block px-2 py-0.5 rounded-md border border-indigo-100/50 shadow-sm">
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
        <div className={`relative flex min-w-0 flex-1 flex-col bg-white/50 backdrop-blur-sm rounded-r-3xl ${!isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation && activeMeta ? (
            <>
              {/* Chat Header */}
              <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200/60 bg-white/80 px-5 py-4 backdrop-blur-md sm:px-8 shadow-sm">
                <div
                  className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 sm:gap-5"
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
                    className="md:hidden p-2.5 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-white overflow-hidden flex items-center justify-center relative shadow-sm group-hover:shadow-md transition-all group-hover:border-indigo-100">
                    {activeConversation.isGroup ? (
                        <Users size={20} strokeWidth={2.5} className="text-indigo-600" />
                    ) : (
                        <img 
                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${activeMeta.avatarSeed}&backgroundColor=e0e7ff`} 
                        alt={activeMeta.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2.5 truncate text-lg font-extrabold tracking-tight text-slate-800 transition-colors group-hover:text-indigo-700">
                        {activeMeta.name}
                        {activeConversation.isGroup && <span className="text-[11px] bg-slate-100/80 px-2 py-0.5 rounded-md text-slate-500 font-bold shadow-sm">{activeConversation.participants?.length}</span>}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-md shadow-sm ${getRoleBadgeStyle(activeMeta.role)}`}>
                        {activeMeta.role}
                      </span>
                      {activeConversation.threadContext ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md shadow-sm">
                          {summarizeThreadContext(activeConversation.threadContext)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isStaffUser && (
                    <>
                      <button 
                        onClick={() => alert("Sending SMS notification...")}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all hidden sm:block hover:shadow-sm"
                        title="Send SMS"
                        aria-label="Send SMS"
                      >
                        <Smartphone size={20} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={handleStartCall}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all hidden sm:block hover:shadow-sm"
                        title="Start Video Call"
                        aria-label="Start video call"
                      >
                        <Video size={20} strokeWidth={2.5} />
                      </button>
                      <div className="w-px h-8 bg-slate-200/80 mx-1 hidden sm:block" />
                    </>
                  )}
                  <button 
                    onClick={() => setShowGroupInfoModal(true)}
                    className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-xl transition-all hover:shadow-sm"
                    aria-label="Open chat details"
                  >
                    <MoreVertical size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/30 relative">
                {activeConversation.threadContext ? (
                  <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/80 backdrop-blur-sm px-5 py-4 text-xs font-semibold text-indigo-800 shadow-sm text-center mx-auto max-w-lg mb-6">
                    <p className="font-extrabold text-sm mb-1 text-indigo-900 tracking-tight">
                      Linked context: {summarizeThreadContext(activeConversation.threadContext)}
                    </p>
                    <p className="text-indigo-700/80 font-medium">
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
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-3">
                            <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-200/50"
                                title="Delete"
                                aria-label="Delete message"
                            >
                                <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}

                    <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1.5`}>
                        {!isMe && activeConversation.isGroup && (
                            <p className="text-[11px] font-extrabold text-indigo-600 ml-1.5 uppercase tracking-wide">{msg.senderName}</p>
                        )}

                        <div className={`rounded-2xl p-4 text-sm shadow-sm relative group-hover:shadow-md transition-all duration-300 ${
                        isMe 
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm shadow-indigo-500/20' 
                            : 'bg-white border border-slate-200/60 text-slate-700 rounded-bl-sm shadow-slate-200/50'
                        }`}>
                        
                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2.5 mb-3.5">
                                {msg.attachments.map(att => (
                                    <div key={att.id} className={`rounded-xl overflow-hidden border ${isMe ? 'border-white/20 shadow-sm' : 'border-slate-200/80 shadow-sm'}`}>
                                        {att.type === 'image' ? (
                                            <img src={att.url} alt="attachment" className="w-full max-w-[260px] h-auto object-cover" />
                                        ) : (
                                            <div className={`flex items-center gap-3.5 p-3.5 ${isMe ? 'bg-white/10 backdrop-blur-sm' : 'bg-slate-50/80 backdrop-blur-sm'}`}>
                                                <div className={`p-2.5 rounded-xl shadow-sm ${isMe ? 'bg-white/20 text-white border border-white/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100/50'}`}>
                                                    <FileText size={20} strokeWidth={2.5} />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="text-xs font-bold truncate max-w-[130px] tracking-tight">{att.name}</p>
                                                    <p className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{att.size}</p>
                                                </div>
                                                <button className={`p-2 rounded-xl transition-all shadow-sm ${isMe ? 'hover:bg-white/20 bg-white/10 text-white' : 'hover:bg-slate-200/80 bg-white border border-slate-200/60 text-slate-500'}`}>
                                                    <Download size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className={`whitespace-pre-wrap leading-relaxed ${isMe ? 'font-medium' : 'font-medium text-slate-700'}`}>{msg.content}</p>
                        
                        <div className={`flex items-center gap-1.5 justify-end mt-2 text-[10px] font-extrabold uppercase tracking-widest ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                            <span>{formatMessageTimeLabel(msg.timestamp)}</span>
                            {isMe && (
                                msg.isRead ? <CheckCheck size={14} strokeWidth={3} className="opacity-90" /> : <Check size={14} strokeWidth={3} className="opacity-90" />
                            )}
                        </div>
                        </div>
                    </div>

                    {/* Hover Actions (Right side for Others) */}
                    {!isMe && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                             <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-200/50"
                                title="Delete"
                                aria-label="Delete message"
                            >
                                <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}

                  </div>
                )})}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="relative z-20 bg-white/80 backdrop-blur-md p-4 sm:p-6 border-t border-slate-200/50 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)]">
                 {composerError && (
                    <div className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm animate-in slide-in-from-top-2">
                      {composerError}
                    </div>
                 )}
                 
                 {/* Pending Attachments Preview */}
                 {pendingAttachments.length > 0 && (
                     <div className="flex gap-3 mb-4 overflow-x-auto pb-2 animate-in fade-in slide-in-from-bottom-2 custom-scrollbar">
                         {pendingAttachments.map(att => (
                             <div key={att.id} className="relative w-24 h-24 rounded-2xl border border-slate-200/80 overflow-hidden shrink-0 group shadow-sm bg-white">
                                 {att.type === 'image' ? (
                                     <img src={att.url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="preview" />
                                 ) : (
                                     <div className="w-full h-full bg-slate-50/80 flex flex-col items-center justify-center text-slate-500 gap-1.5 transition-colors group-hover:bg-slate-100/80">
                                         <FileText size={28} strokeWidth={2} />
                                         <span className="text-[9px] font-extrabold uppercase px-2 truncate w-full text-center tracking-widest">{att.name.split('.').pop()}</span>
                                     </div>
                                 )}
                                 <button 
                                    onClick={() => handleRemoveAttachment(att.id)}
                                    className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm hover:bg-rose-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:shadow"
                                    aria-label="Remove attachment"
                                 >
                                     <X size={12} strokeWidth={3} />
                                 </button>
                             </div>
                         ))}
                     </div>
                 )}

                 {/* Picker Popovers */}
                 <div className="absolute bottom-24 left-4 right-4 z-30 flex max-w-[calc(100%-2rem)] gap-3 sm:left-6 sm:right-auto sm:max-w-none">
                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                        <div className="picker-container w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 origin-bottom-left">
                            <p className="text-[11px] font-extrabold text-slate-400 mb-3 px-1 uppercase tracking-widest">Emojis</p>
                            <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                {EMOJIS.map((emoji, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleEmojiClick(emoji)}
                                        className="text-2xl hover:bg-slate-100 p-2.5 rounded-xl transition-colors flex items-center justify-center hover:scale-110 active:scale-95"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* GIF Picker */}
                    {showGifPicker && (
                        <div className="picker-container flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 origin-bottom-left">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} strokeWidth={2.5} />
                                <input 
                                    type="text" 
                                    placeholder="Search GIPHY..."
                                    value={gifSearchQuery}
                                    onChange={(e) => handleSearchGifs(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/80 rounded-xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-400 transition-all shadow-inner border border-transparent"
                                    autoFocus
                                />
                            </div>
                            
                            <p className="text-[11px] font-extrabold text-slate-400 px-1 uppercase tracking-widest flex justify-between mt-1">
                                {gifSearchQuery ? 'Search Results' : 'Trending GIFs'}
                                {isSearchingGifs && <Loader2 size={14} className="animate-spin text-indigo-500" strokeWidth={3} />}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar min-h-[120px]">
                                {availableGifs.length === 0 && !isSearchingGifs ? (
                                    <div className="col-span-2 text-center py-6 text-sm font-semibold text-slate-500 italic">No GIFs found.</div>
                                ) : (
                                    availableGifs.map(gif => (
                                        <div 
                                            key={gif.id} 
                                            onClick={() => handleGifSelect(gif.url)}
                                            className="cursor-pointer hover:shadow-md transition-all rounded-xl overflow-hidden h-28 bg-slate-100 relative group border border-slate-200/50"
                                        >
                                            <img src={gif.url} alt="GIF" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                                <span className="text-white font-extrabold text-xs bg-black/60 px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wide border border-white/20">Send</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                 </div>

                 {/* Main Input Bar */}
                 <div className="flex items-end gap-2 bg-slate-50/80 border border-slate-200/80 rounded-[24px] p-2.5 focus-within:ring-4 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-sm">
                    <div className="flex items-center gap-1.5 pb-1 pl-1.5">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors hover:shadow-sm"
                            title="Attach File"
                            aria-label="Attach file"
                        >
                            <Plus size={22} strokeWidth={2.5} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                            className={`picker-trigger p-2.5 rounded-xl transition-colors hover:shadow-sm ${showGifPicker ? 'text-indigo-600 bg-indigo-50/80 shadow-sm border border-indigo-100/50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent'}`}
                            title="Add GIF"
                            aria-label="Add GIF"
                        >
                            <Sticker size={22} strokeWidth={2.5} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                            className={`picker-trigger p-2.5 rounded-xl transition-colors hover:shadow-sm ${showEmojiPicker ? 'text-indigo-600 bg-indigo-50/80 shadow-sm border border-indigo-100/50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent'}`}
                            title="Add Emoji"
                            aria-label="Add emoji"
                        >
                            <Smile size={22} strokeWidth={2.5} />
                        </button>
                    </div>
                    
                    <div className="flex-1 py-3 px-2">
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
                        className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-40 min-h-[24px] text-[15px] font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-semibold p-0 leading-relaxed custom-scrollbar"
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
                        className="p-3.5 mb-1 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center disabled:hover:shadow-md disabled:hover:bg-indigo-600"
                        aria-label="Send message"
                    >
                        <Send size={20} strokeWidth={2.5} className={newMessage.trim() || pendingAttachments.length > 0 ? "ml-0.5" : ""} />
                    </button>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white/50 backdrop-blur-md relative overflow-hidden rounded-r-3xl">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px]"></div>
                <div className="absolute -right-24 -top-24 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="w-28 h-28 bg-gradient-to-br from-indigo-50 to-white rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-indigo-100/50 rotate-3 hover:rotate-6 transition-transform duration-500 relative z-10">
                    <Send size={48} strokeWidth={2.5} className="text-indigo-400 ml-2 mt-2" />
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-800 mb-3 relative z-10">Your Messages</h3>
                <p className="text-sm font-medium text-slate-500 max-w-sm text-center leading-relaxed mb-10 relative z-10">
                    Select a conversation from the list or start a new conversation to collaborate with your MTSS team.
                </p>
                <button 
                    ref={emptyStateNewMessageButtonRef}
                    onClick={(event) => openNewMessageModal(event.currentTarget)}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-extrabold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-xl transition-all hover:-translate-y-1 flex items-center gap-3 relative z-10"
                >
                    <Plus size={20} strokeWidth={2.5} /> Start New Conversation
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

