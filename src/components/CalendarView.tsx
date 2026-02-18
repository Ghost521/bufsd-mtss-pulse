
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  Check, 
  X, 
  AlertCircle, 
  Filter,
  MoreHorizontal,
  Paperclip,
  Camera,
  File as FileIcon,
  Trash2,
  Download,
  Repeat,
  Sparkles,
  Loader2,
  UserPlus,
  Briefcase,
  ChevronDown,
  AlignLeft,
  Edit,
  GripVertical
} from 'lucide-react';
import type { CalendarEvent, Attachment } from '../types';
import { EventType, AttendanceStatus, UserRole } from '../types';
import { STAFF_ROSTER_DATA } from '../constants';
import { CustomDatePicker } from './CustomDatePicker';
import { suggestMeetingTimes } from '../services/geminiService';
import { DraggableModal } from './DraggableModal';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { SidebarToggleButton } from './SidebarToggleButton';
import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  CALENDAR_SLOT_MINUTES,
  CALENDAR_TOTAL_MINUTES,
  addDays,
  clamp,
  combineDateAndMinutes,
  endOfDayLocal,
  eventDurationMinutes,
  eventOverlapsRange,
  formatDayHeader,
  formatEventTimeRange,
  formatMonthHeader,
  formatWeekHeader,
  getWeekDatesLocal,
  minutesInTimeZoneDay,
  snapMinutes,
  startOfDayLocal,
  toTimeInputValue,
  toLocalDateInputValue,
  toTimeZoneDayKey,
  type CalendarViewMode,
} from '../lib/calendar-view';

// Initial Mock Groups
const INITIAL_GROUPS = [
  { id: 'g1', name: 'MTSS Committee', members: ['Rosa Cortese', 'Dr. Evans', 'Mr. Davis'] },
  { id: 'g2', name: '4th Grade Team', members: ['Mr. Davis', 'Mrs. Johnson', 'Mr. Thompson'] },
  { id: 'g3', name: 'Leadership', members: ['Dr. Aris Thorne', 'Rosa Cortese'] }
];

interface CalendarViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  onMenuClick: () => void;
}

type RecurrencePattern = 'None' | 'Daily' | 'Weekly' | 'Monthly';
const ALL_EVENT_TYPES: EventType[] = Object.values(EventType) as EventType[];
const MAX_VISIBLE_DAY_EVENTS = 3;
const CALENDAR_VIEW_STORAGE_KEY = 'calendarViewMode';
const WEEK_START_DAY = 0; // Sunday
const HOUR_ROW_HEIGHT = 56;

type DragMode = 'move' | 'resize';

type DragInteractionState = {
  eventId: string;
  mode: DragMode;
  sourceDayIndex: number;
  originalStart: string;
  originalEnd: string;
  durationMinutes: number;
};

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  currentUserRole, 
  currentUserName,
  onMenuClick
}) => {
  const calendarCollection = useTenantCollection<CalendarEvent>('calendar');
  const settingsCollection = useTenantCollection<{ id: string; profile?: { timezone?: string } }>('settings');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    if (typeof window === 'undefined') return 'month';
    const persisted = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
    if (persisted === 'month' || persisted === 'week' || persisted === 'day') return persisted;
    return 'month';
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [dragState, setDragState] = useState<DragInteractionState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ eventId: string; start: string; end: string } | null>(null);
  const dragPreviewRef = useRef<{ eventId: string; start: string; end: string } | null>(null);
  
  // Group Management State
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{id: string, name: string, members: string[]} | null>(null);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');

  // Attachments State
  const [newEventAttachments, setNewEventAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // New Event Form State
  const [newEventForm, setNewEventForm] = useState({
    title: '',
    type: EventType.STAFF,
    date: toLocalDateInputValue(new Date()),
    startTime: '09:00',
     endTime: '10:00',
     allDay: false,
     description: '',
     location: '',
     recurrencePattern: 'None' as RecurrencePattern,
     recurrenceEnd: ''
   });

  // Invitees & Conflict State
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([currentUserName]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<{start: string, end: string, reason: string}[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionDuration, setSuggestionDuration] = useState(30);
  
  // Filter State
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(ALL_EVENT_TYPES);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isInviteSectionOpen, setIsInviteSectionOpen] = useState(true);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const timeGridColumnRefs = useRef<Array<HTMLDivElement | null>>([]);

  const hasHydratedEventsRef = useRef(false);
  const lastPersistedEventsRef = useRef("");

  useEffect(() => {
    const rows = calendarCollection.query.data?.rows;
    if (!rows) return;
    hasHydratedEventsRef.current = true;
    const serialized = JSON.stringify(rows);
    lastPersistedEventsRef.current = serialized;
    setEvents(rows);
  }, [calendarCollection.query.data?.requestId, calendarCollection.query.data?.rows]);

  useEffect(() => {
    if (!hasHydratedEventsRef.current) return;
    const serialized = JSON.stringify(events);
    if (serialized === lastPersistedEventsRef.current) return;
    const timeout = window.setTimeout(() => {
      lastPersistedEventsRef.current = serialized;
      calendarCollection.replaceMutation.mutate(events);
    }, 350);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [calendarCollection.replaceMutation, events]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsCompactViewport(media.matches);
    updateViewport();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateViewport);
      return () => media.removeEventListener('change', updateViewport);
    }

    media.addListener(updateViewport);
    return () => media.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (!isFilterDropdownOpen) return;
    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (filterPanelRef.current?.contains(target)) return;
      if (filterButtonRef.current?.contains(target)) return;
      setIsFilterDropdownOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('touchstart', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('touchstart', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFilterDropdownOpen]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    setIsInviteSectionOpen(!isCompactViewport);
  }, [isAddModalOpen, isCompactViewport]);

  useEffect(() => {
    if (!newEventForm.allDay) return;
    if (newEventForm.startTime === '00:00' && newEventForm.endTime === '23:59') return;
    setNewEventForm(prev => ({ ...prev, startTime: '00:00', endTime: '23:59' }));
  }, [newEventForm.allDay, newEventForm.endTime, newEventForm.startTime]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    dragPreviewRef.current = dragPreview;
  }, [dragPreview]);

  const browserTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', []);
  const userTimeZone = useMemo(() => {
    const settingsRow = settingsCollection.query.data?.rows?.[0];
    return settingsRow?.profile?.timezone || browserTimeZone;
  }, [browserTimeZone, settingsCollection.query.data?.rows]);

  // --- Calendar Logic ---
  const dayStartMinutes = CALENDAR_DAY_START_HOUR * 60;
  const dayEndMinutes = CALENDAR_DAY_END_HOUR * 60;
  const slotCount = CALENDAR_TOTAL_MINUTES / CALENDAR_SLOT_MINUTES;
  const totalGridHeight = slotCount * HOUR_ROW_HEIGHT;
  const hourTicks = useMemo(
    () => Array.from({ length: CALENDAR_DAY_END_HOUR - CALENDAR_DAY_START_HOUR + 1 }, (_, index) => CALENDAR_DAY_START_HOUR + index),
    []
  );
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
  const weekDays = useMemo(() => getWeekDatesLocal(currentDate, WEEK_START_DAY), [currentDate]);
  const visibleTimeGridDays = useMemo(() => (viewMode === 'day' ? [startOfDayLocal(currentDate)] : weekDays), [currentDate, viewMode, weekDays]);
  const gridRangeStart = useMemo(() => startOfDayLocal(visibleTimeGridDays[0]), [visibleTimeGridDays]);
  const gridRangeEnd = useMemo(
    () => endOfDayLocal(visibleTimeGridDays[visibleTimeGridDays.length - 1]),
    [visibleTimeGridDays]
  );
  
  const calendarDays = useMemo(() => {
    const days: Array<{ day: number; type: 'prev' | 'current' | 'next'; fullDate: Date }> = [];
    // Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        days.push({ day: prevMonthDays - i, type: 'prev', fullDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, type: 'current', fullDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), i) });
    }
    // Next month padding
    const remainingCells = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ day: i, type: 'next', fullDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i) });
    }
    return days;
  }, [currentDate, daysInMonth, firstDayOfMonth, prevMonthDays]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'month') return formatMonthHeader(currentDate, userTimeZone);
    if (viewMode === 'week') return formatWeekHeader(weekDays, userTimeZone);
    return formatDayHeader(currentDate, userTimeZone);
  }, [currentDate, userTimeZone, viewMode, weekDays]);

  const handlePreviousRange = () => {
    setCurrentDate(prev => {
      if (viewMode === 'month') return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      if (viewMode === 'week') return addDays(prev, -7);
      return addDays(prev, -1);
    });
  };

  const handleNextRange = () => {
    setCurrentDate(prev => {
      if (viewMode === 'month') return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      if (viewMode === 'week') return addDays(prev, 7);
      return addDays(prev, 1);
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const clearTypeFilters = () => {
    setSelectedTypes(ALL_EVENT_TYPES);
  };

  const toggleTypeFilter = (type: EventType) => {
    setSelectedTypes(prev => {
      const isSelected = prev.includes(type);
      if (isSelected) {
        if (prev.length <= 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  // --- Event Filtering (RBAC + Types) ---
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
        // 1. Filter by Type
        if (!selectedTypes.includes(evt.type)) return false;

        // 2. Filter by User Access (Is Attendee OR District Public Event)
        const isAttendee = evt.attendees.some(a => a.name === currentUserName);
        const isDistrictPublic = evt.type === EventType.DISTRICT; 
        const isOrganizer = evt.organizer === currentUserName;
        
        // Show if user is attendee or if it's a public district event
        return isAttendee || isDistrictPublic || isOrganizer;
    });
  }, [events, selectedTypes, currentUserName]);

  const getEventsForDay = (date: Date) => {
    const dayKey = toTimeZoneDayKey(date, userTimeZone);
    return filteredEvents
      .filter(evt => {
        const eventStart = new Date(evt.start);
        const eventEnd = new Date(evt.end);
        const evtStartDay = toTimeZoneDayKey(eventStart, userTimeZone);
        const evtEndDay = toTimeZoneDayKey(new Date(eventEnd.getTime() - 1), userTimeZone);
        return dayKey >= evtStartDay && dayKey <= evtEndDay;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  };

  const getEffectiveEvent = useCallback(
    (evt: CalendarEvent): CalendarEvent =>
      dragPreview && dragPreview.eventId === evt.id ? { ...evt, start: dragPreview.start, end: dragPreview.end } : evt,
    [dragPreview]
  );

  const isAllDayEvent = useCallback(
    (evt: CalendarEvent): boolean => {
      if (evt.allDay) return true;
      const start = new Date(evt.start);
      const end = new Date(evt.end);
      const duration = end.getTime() - start.getTime();
      const startMinutes = minutesInTimeZoneDay(start, userTimeZone);
      const endMinutes = minutesInTimeZoneDay(end, userTimeZone);
      return duration >= 23 * 60 * 60 * 1000 && startMinutes === 0 && (endMinutes === 0 || endMinutes === 23 * 60 + 59);
    },
    [userTimeZone]
  );

  const visibleGridEvents = useMemo(
    () => filteredEvents.filter(evt => eventOverlapsRange(evt.start, evt.end, gridRangeStart, gridRangeEnd)),
    [filteredEvents, gridRangeEnd, gridRangeStart]
  );

  const allDayEventsByDay = useMemo(() => {
    const byDay: Record<string, CalendarEvent[]> = {};
    visibleTimeGridDays.forEach(day => {
      const key = toTimeZoneDayKey(day, userTimeZone);
      byDay[key] = [];
    });

    visibleGridEvents.forEach(evt => {
      const effective = getEffectiveEvent(evt);
      const allDay = isAllDayEvent(effective);
      if (!allDay) return;
      visibleTimeGridDays.forEach(day => {
        const dayStart = startOfDayLocal(day);
        const dayEnd = endOfDayLocal(day);
        if (eventOverlapsRange(effective.start, effective.end, dayStart, dayEnd)) {
          const key = toTimeZoneDayKey(day, userTimeZone);
          byDay[key].push(effective);
        }
      });
    });
    return byDay;
  }, [getEffectiveEvent, isAllDayEvent, userTimeZone, visibleGridEvents, visibleTimeGridDays]);

  const timedEventsByDay = useMemo(() => {
    const byDay: Record<string, CalendarEvent[]> = {};
    visibleTimeGridDays.forEach(day => {
      const key = toTimeZoneDayKey(day, userTimeZone);
      byDay[key] = [];
    });

    visibleGridEvents.forEach(evt => {
      const effective = getEffectiveEvent(evt);
      const allDay = isAllDayEvent(effective);
      if (allDay) return;
      visibleTimeGridDays.forEach(day => {
        const dayStart = startOfDayLocal(day);
        const dayEnd = endOfDayLocal(day);
        if (eventOverlapsRange(effective.start, effective.end, dayStart, dayEnd)) {
          const key = toTimeZoneDayKey(day, userTimeZone);
          byDay[key].push(effective);
        }
      });
    });

    Object.keys(byDay).forEach((key) => {
      byDay[key].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    });
    return byDay;
  }, [getEffectiveEvent, isAllDayEvent, userTimeZone, visibleGridEvents, visibleTimeGridDays]);

  const calculateTimedEventLayout = (event: CalendarEvent, day: Date) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const dayStart = startOfDayLocal(day);
    const dayEnd = endOfDayLocal(day);
    const clippedStart = new Date(Math.max(dayStart.getTime(), eventStart.getTime()));
    const clippedEnd = new Date(Math.min(dayEnd.getTime(), eventEnd.getTime()));
    const startMinutes = minutesInTimeZoneDay(clippedStart, userTimeZone);
    const endMinutes = minutesInTimeZoneDay(clippedEnd, userTimeZone);
    const startOffset = clamp(startMinutes - dayStartMinutes, 0, CALENDAR_TOTAL_MINUTES);
    const endOffset = clamp(Math.max(startOffset + CALENDAR_SLOT_MINUTES, endMinutes - dayStartMinutes), CALENDAR_SLOT_MINUTES, CALENDAR_TOTAL_MINUTES);
    const top = (startOffset / CALENDAR_TOTAL_MINUTES) * totalGridHeight;
    const height = Math.max(36, ((endOffset - startOffset) / CALENDAR_TOTAL_MINUTES) * totalGridHeight);
    return { top, height, startOffset, endOffset };
  };

  const buildLaneLayout = (dayEvents: CalendarEvent[], day: Date) => {
    const positioned = dayEvents.map((event) => ({ event, ...calculateTimedEventLayout(event, day) }));
    const active: Array<{ endOffset: number; lane: number; resultIndex: number }> = [];
    const results: Array<{ event: CalendarEvent; top: number; height: number; lane: number; laneCount: number }> = [];
    let clusterIndexes: number[] = [];
    let clusterLaneCount = 1;

    const finalizeCluster = () => {
      clusterIndexes.forEach((index) => {
        results[index].laneCount = Math.max(1, clusterLaneCount);
      });
      clusterIndexes = [];
      clusterLaneCount = 1;
    };

    positioned.forEach((item) => {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (item.startOffset >= active[index].endOffset) {
          active.splice(index, 1);
        }
      }

      if (active.length === 0 && clusterIndexes.length > 0) {
        finalizeCluster();
      }

      const usedLanes = new Set(active.map((entry) => entry.lane));
      let lane = 0;
      while (usedLanes.has(lane)) lane += 1;

      const resultIndex = results.length;
      results.push({
        event: item.event,
        top: item.top,
        height: item.height,
        lane,
        laneCount: 1,
      });
      active.push({ endOffset: item.endOffset, lane, resultIndex });
      clusterIndexes.push(resultIndex);
      clusterLaneCount = Math.max(clusterLaneCount, usedLanes.size + 1);
    });

    if (clusterIndexes.length > 0) {
      finalizeCluster();
    }

    return results;
  };

  const updateEventTiming = useCallback(
    (eventId: string, nextStart: Date, nextEnd: Date) => {
      if (nextEnd.getTime() <= nextStart.getTime()) return;
      setEvents(prev =>
        prev.map(evt =>
          evt.id === eventId
            ? {
                ...evt,
                start: nextStart.toISOString(),
                end: nextEnd.toISOString(),
                allDay: false,
                timezone: userTimeZone,
              }
            : evt
        )
      );
    },
    [userTimeZone]
  );

  const startDragInteraction = (eventId: string, sourceDayIndex: number, mode: DragMode) => {
    const event = visibleGridEvents.find(item => item.id === eventId);
    if (!event || isAllDayEvent(event)) return;
    setDragState({
      eventId,
      sourceDayIndex,
      mode,
      originalStart: event.start,
      originalEnd: event.end,
      durationMinutes: eventDurationMinutes(event.start, event.end),
    });
    setDragPreview({
      eventId,
      start: event.start,
      end: event.end,
    });
  };

  useEffect(() => {
    if (!dragState) return;
    const onMouseMove = (event: MouseEvent) => {
      const originalStart = new Date(dragState.originalStart);
      const durationMinutes = dragState.durationMinutes;

      let targetDayIndex = dragState.sourceDayIndex;
      for (let index = 0; index < visibleTimeGridDays.length; index += 1) {
        const rect = timeGridColumnRefs.current[index]?.getBoundingClientRect();
        if (!rect) continue;
        if (event.clientX >= rect.left && event.clientX <= rect.right) {
          targetDayIndex = index;
          break;
        }
      }

      const targetColumn = timeGridColumnRefs.current[targetDayIndex];
      const targetDay = visibleTimeGridDays[targetDayIndex];
      if (!targetColumn || !targetDay) return;

      const rect = targetColumn.getBoundingClientRect();
      const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const minuteFromStart = snapMinutes(dayStartMinutes + ratio * CALENDAR_TOTAL_MINUTES);
      const boundedMinute = clamp(minuteFromStart, dayStartMinutes, dayEndMinutes);

      if (dragState.mode === 'move') {
        const nextStart = combineDateAndMinutes(targetDay, boundedMinute);
        const nextEnd = new Date(nextStart.getTime() + durationMinutes * 60_000);
        setDragPreview({
          eventId: dragState.eventId,
          start: nextStart.toISOString(),
          end: nextEnd.toISOString(),
        });
      } else {
        const activeDay = startOfDayLocal(originalStart);
        const fixedStartMinutes = minutesInTimeZoneDay(originalStart, userTimeZone);
        const nextEndMinutes = clamp(boundedMinute, fixedStartMinutes + CALENDAR_SLOT_MINUTES, dayEndMinutes);
        const nextStart = combineDateAndMinutes(activeDay, fixedStartMinutes);
        const nextEnd = combineDateAndMinutes(activeDay, nextEndMinutes);
        setDragPreview({
          eventId: dragState.eventId,
          start: nextStart.toISOString(),
          end: nextEnd.toISOString(),
        });
      }
    };

    const onMouseUp = () => {
      const preview = dragPreviewRef.current;
      if (preview && preview.eventId === dragState.eventId) {
        updateEventTiming(dragState.eventId, new Date(preview.start), new Date(preview.end));
      }
      setDragState(null);
      setDragPreview(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [
    dayEndMinutes,
    dayStartMinutes,
    dragState,
    updateEventTiming,
    userTimeZone,
    visibleTimeGridDays,
  ]);

  // --- Conflict Detection Logic ---
  const detectedConflicts = useMemo(() => {
    if (!isAddModalOpen) return [];

    const newStart = new Date(`${newEventForm.date}T${newEventForm.startTime}`).getTime();
    const newEnd = new Date(`${newEventForm.date}T${newEventForm.endTime}`).getTime();

    if (isNaN(newStart) || isNaN(newEnd)) return [];

    // Find overlapping events for ANY selected invitee
    const conflicts: { user: string, event: string }[] = [];

    // Check existing events in the system (mock DB)
    events.forEach(evt => {
        const evtStart = new Date(evt.start).getTime();
        const evtEnd = new Date(evt.end).getTime();

        // Check Overlap
        const isOverlapping = (newStart < evtEnd && newEnd > evtStart);
        
        if (isOverlapping) {
            // Check if any selected invitee is attending this overlapping event
            selectedInvitees.forEach(invitee => {
                const isAttending = evt.attendees.some(a => a.name === invitee);
                if (isAttending) {
                    conflicts.push({ user: invitee, event: evt.title });
                }
            });
        }
    });

    return conflicts;
  }, [newEventForm.date, newEventForm.startTime, newEventForm.endTime, selectedInvitees, events, isAddModalOpen]);

  // --- Interaction Handlers ---
  const handleEventClick = (evt: CalendarEvent) => {
    setSelectedEvent(evt);
  };

  const openEventComposer = (targetDay: Date, minuteOfDay = dayStartMinutes, allDay = false) => {
    const snappedMinutes = snapMinutes(minuteOfDay);
    const nextStart = toTimeInputValue(clamp(snappedMinutes, 0, 24 * 60 - CALENDAR_SLOT_MINUTES));
    const nextEnd = toTimeInputValue(clamp(snappedMinutes + 60, CALENDAR_SLOT_MINUTES, 24 * 60));
    setNewEventForm(prev => ({
      ...prev,
      date: toLocalDateInputValue(targetDay),
      startTime: allDay ? '00:00' : nextStart,
      endTime: allDay ? '23:59' : nextEnd,
      allDay,
    }));
    setIsAddModalOpen(true);
  };

  const handleInviteUser = (name: string) => {
      if (!selectedInvitees.includes(name)) {
          setSelectedInvitees([...selectedInvitees, name]);
      }
      setInviteSearch('');
  };

  const handleInviteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const newInvitees = [...selectedInvitees];
        group.members.forEach(m => {
            if (!newInvitees.includes(m)) newInvitees.push(m);
        });
        setSelectedInvitees(newInvitees);
    }
  };

  const handleInviteAllStaff = () => {
    const allNames = STAFF_ROSTER_DATA.map(s => s.name);
    const newInvitees = Array.from(new Set([...selectedInvitees, ...allNames]));
    setSelectedInvitees(newInvitees);
  };

  const handleRemoveInvitee = (name: string) => {
      if (name !== currentUserName) {
          setSelectedInvitees(selectedInvitees.filter(i => i !== name));
      }
  };

  // --- Group Management Handlers ---
  const handleSaveGroup = () => {
    if (!editingGroup || !editingGroup.name.trim()) return;
    
    if (editingGroup.id) {
        // Update existing
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? editingGroup : g));
    } else {
        // Create new
        const newGroup = { ...editingGroup, id: `g-${Date.now()}` };
        setGroups(prev => [...prev, newGroup]);
    }
    setEditingGroup(null);
  };

  const handleDeleteGroup = (groupId: string) => {
      setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const toggleGroupMember = (memberName: string) => {
      if (!editingGroup) return;
      
      const isMember = editingGroup.members.includes(memberName);
      let newMembers;
      if (isMember) {
          newMembers = editingGroup.members.filter(m => m !== memberName);
      } else {
          newMembers = [...editingGroup.members, memberName];
      }
      setEditingGroup({ ...editingGroup, members: newMembers });
  };

  const handleAiSuggest = async () => {
      if (selectedInvitees.length === 0) return;
      setIsSuggesting(true);
      setAiSuggestions([]);
      
      // Filter events relevant to invitees for context
      const relevantEvents = events.filter(evt => 
          evt.attendees.some(a => selectedInvitees.includes(a.name))
      );

      const suggestions = await suggestMeetingTimes(
          selectedInvitees, 
          suggestionDuration, 
          newEventForm.date, 
          relevantEvents
      );
      
      setAiSuggestions(suggestions);
      setIsSuggesting(false);
  };

  const handleApplySuggestion = (s: {start: string, end: string}) => {
      setNewEventForm(prev => ({ ...prev, startTime: s.start, endTime: s.end, allDay: false }));
      setAiSuggestions([]); // Clear suggestions after picking
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const baseStart = newEventForm.allDay
      ? new Date(`${newEventForm.date}T00:00:00`)
      : new Date(`${newEventForm.date}T${newEventForm.startTime}`);
    const baseEnd = newEventForm.allDay
      ? new Date(`${newEventForm.date}T23:59:00`)
      : new Date(`${newEventForm.date}T${newEventForm.endTime}`);
    const duration = baseEnd.getTime() - baseStart.getTime();
    
    const eventsToCreate: CalendarEvent[] = [];
    const parentId = `evt-${Date.now()}`;

    const attendeesList = selectedInvitees.map(name => ({
        name,
        role: STAFF_ROSTER_DATA.find(s => s.name === name)?.role as UserRole || UserRole.TEACHER, // Fallback role logic
        status: name === currentUserName ? AttendanceStatus.ORGANIZER : AttendanceStatus.PENDING,
        avatarSeed: name.replace(/\s/g, '')
    }));

    const recurrencePattern = newEventForm.recurrencePattern;
    if (recurrencePattern === 'None') {
        // Single event
        eventsToCreate.push({
            id: parentId,
            title: newEventForm.title || 'New Event',
            type: newEventForm.type,
            start: baseStart.toISOString(),
            end: baseEnd.toISOString(),
            organizer: currentUserName,
            location: newEventForm.location,
            description: newEventForm.description,
            allDay: newEventForm.allDay,
            timezone: userTimeZone,
            attendees: attendeesList,
            attachments: newEventAttachments
        });
    } else {
        // Recurrence generation
        const currentStart = new Date(baseStart);
        const endDate = new Date(newEventForm.recurrenceEnd || baseStart); 
        
        let count = 0;
        const limit = 50; // Safety break to prevent infinite loops

        while (currentStart <= endDate && count < limit) {
            const currentEnd = new Date(currentStart.getTime() + duration);
            
            eventsToCreate.push({
                id: `${parentId}-${count}`,
                parentId: parentId,
                title: newEventForm.title || 'New Event',
                type: newEventForm.type,
                start: currentStart.toISOString(),
                end: currentEnd.toISOString(),
                organizer: currentUserName,
                location: newEventForm.location,
                description: newEventForm.description,
                allDay: newEventForm.allDay,
                timezone: userTimeZone,
                attendees: attendeesList,
                attachments: [...newEventAttachments], // Clone array for each instance
                recurrence: {
                    pattern: recurrencePattern,
                    endDate: endDate.toISOString()
                }
            });

            // Increment date based on pattern
            if (recurrencePattern === 'Daily') {
                currentStart.setDate(currentStart.getDate() + 1);
            } else if (recurrencePattern === 'Weekly') {
                currentStart.setDate(currentStart.getDate() + 7);
            } else if (recurrencePattern === 'Monthly') {
                currentStart.setMonth(currentStart.getMonth() + 1);
            }
            count++;
        }
    }

    setEvents([...events, ...eventsToCreate]);
    setIsAddModalOpen(false);
    
    // Reset Form
    setNewEventForm({
        title: '',
        type: EventType.STAFF,
        date: toLocalDateInputValue(new Date()),
        startTime: '09:00',
        endTime: '10:00',
        allDay: false,
        description: '',
        location: '',
        recurrencePattern: 'None',
        recurrenceEnd: ''
    });
    setNewEventAttachments([]);
    setSelectedInvitees([currentUserName]);
    setAiSuggestions([]);
  };

  const handleRSVP = (status: AttendanceStatus) => {
    if (!selectedEvent) return;
    
    const updatedEvents = events.map(evt => {
        if (evt.id === selectedEvent.id) {
            const existingAttendee = evt.attendees.find(a => a.name === currentUserName);
            let updatedAttendees;

            if (existingAttendee) {
                updatedAttendees = evt.attendees.map(att => 
                    att.name === currentUserName ? { ...att, status } : att
                );
            } else {
                updatedAttendees = [...evt.attendees, {
                    name: currentUserName,
                    role: currentUserRole,
                    status,
                    avatarSeed: currentUserName.replace(/\s/g, '')
                }];
            }
            
            return { ...evt, attendees: updatedAttendees };
        }
        return evt;
    });

    setEvents(updatedEvents);
    // Update selected event view
    const newSelected = updatedEvents.find(e => e.id === selectedEvent.id) || null;
    setSelectedEvent(newSelected);
  };

  // --- Attachment Handlers ---
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
                
                if (selectedEvent) {
                    // Add to existing event immediately
                    const updatedEvents = events.map(evt => {
                        if (evt.id === selectedEvent.id) {
                            return { ...evt, attachments: [...(evt.attachments || []), newAttachment] };
                        }
                        return evt;
                    });
                    setEvents(updatedEvents);
                    setSelectedEvent(updatedEvents.find(e => e.id === selectedEvent.id) || null);
                } else {
                    // Add to staging for new event
                    setNewEventAttachments(prev => [...prev, newAttachment]);
                }
            };
            reader.readAsDataURL(file);
        });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (attId: string) => {
      if (selectedEvent) {
          const updatedEvents = events.map(evt => {
              if (evt.id === selectedEvent.id) {
                  return { ...evt, attachments: (evt.attachments || []).filter(a => a.id !== attId) };
              }
              return evt;
          });
          setEvents(updatedEvents);
          setSelectedEvent(updatedEvents.find(e => e.id === selectedEvent.id) || null);
      } else {
          setNewEventAttachments(prev => prev.filter(a => a.id !== attId));
      }
  };

  // --- Camera Logic ---
  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(stream);
          setIsCameraOpen(true);
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      } catch (err) {
          console.error("Camera access error:", err);
          alert("Camera access denied. Please allow camera access in your browser settings.");
      }
  };

  const stopCamera = () => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
      setIsCameraOpen(false);
  };

  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d')?.drawImage(video, 0, 0);
          
          const dataUrl = canvas.toDataURL('image/jpeg');
          const newAttachment: Attachment = {
              id: `photo-${Date.now()}`,
              type: 'image',
              url: dataUrl,
              name: `Photo ${new Date().toLocaleTimeString()}.jpg`,
              size: 'Photo',
              mimeType: 'image/jpeg'
          };

          if (selectedEvent) {
              const updatedEvents = events.map(evt => {
                  if (evt.id === selectedEvent.id) {
                      return { ...evt, attachments: [...(evt.attachments || []), newAttachment] };
                  }
                  return evt;
              });
              setEvents(updatedEvents);
              setSelectedEvent(updatedEvents.find(e => e.id === selectedEvent.id) || null);
          } else {
              setNewEventAttachments(prev => [...prev, newAttachment]);
          }
          
          stopCamera();
      }
  };

  // --- Styles ---
  const getEventTypeStyles = (type: EventType) => {
    switch (type) {
        case EventType.MTSS: return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', dot: 'bg-rose-500', hoverBorder: 'hover:border-rose-200' };
        case EventType.IEP: return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', dot: 'bg-orange-500', hoverBorder: 'hover:border-orange-200' };
        case EventType.STAFF: return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', dot: 'bg-blue-500', hoverBorder: 'hover:border-blue-200' };
        case EventType.PARENT: return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500', hoverBorder: 'hover:border-emerald-200' };
        case EventType.DISTRICT: return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', dot: 'bg-purple-500', hoverBorder: 'hover:border-purple-200' };
        case EventType.DEADLINE: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500', hoverBorder: 'hover:border-slate-300' };
        default: return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', dot: 'bg-indigo-500', hoverBorder: 'hover:border-indigo-200' };
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
      switch(status) {
          case AttendanceStatus.ACCEPTED: return <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 font-bold"><Check size={10} /> Going</span>;
          case AttendanceStatus.DECLINED: return <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100 flex items-center gap-1 font-bold"><X size={10} /> Declined</span>;
          case AttendanceStatus.PENDING: return <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1 font-bold"><AlertCircle size={10} /> Pending</span>;
          case AttendanceStatus.ORGANIZER: return <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 font-bold">Organizer</span>;
          default: return null;
      }
  };

  // Get current user's status for the selected event
  const myStatus = selectedEvent?.attendees.find(a => a.name === currentUserName)?.status || AttendanceStatus.PENDING;
  const calendarLoadError = calendarCollection.query.error as Error | null;
  const isCalendarLoading = calendarCollection.query.isLoading && !hasHydratedEventsRef.current;
  const hasActiveTypeFilters = selectedTypes.length < ALL_EVENT_TYPES.length;
  const isUnauthorizedCalendarError = calendarLoadError ? /401|unauthorized/i.test(calendarLoadError.message) : false;
  const todayDayKey = toTimeZoneDayKey(new Date(), userTimeZone);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden" 
        multiple
      />

      {/* Camera Modal Overlay */}
      {isCameraOpen && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <div className="absolute bottom-6 inset-x-0 flex justify-center gap-8 items-center">
                      <button onClick={stopCamera} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-all">
                          <X size={24} />
                      </button>
                      <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-indigo-600 hover:scale-105 transition-transform shadow-lg flex items-center justify-center">
                          <div className="w-12 h-12 bg-indigo-600 rounded-full" />
                      </button>
                  </div>
              </div>
              <p className="text-white/60 mt-4 text-sm font-medium">Make sure your camera is allowed.</p>
          </div>
      )}

      {/* Group Manager Modal */}
      {isGroupManagerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                      <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                          <Users size={20} className="text-indigo-600" /> 
                          {editingGroup ? (editingGroup.id ? 'Edit Group' : 'Create Group') : 'Manage Groups'}
                      </h3>
                      <button onClick={() => { setIsGroupManagerOpen(false); setEditingGroup(null); }} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                          <X size={18} />
                      </button>
                  </div>

                  {editingGroup ? (
                      // EDIT/CREATE MODE
                      <>
                        <div className="p-5 flex-1 overflow-y-auto">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Group Name</label>
                                <input 
                                    type="text" 
                                    value={editingGroup.name}
                                    onChange={(e) => setEditingGroup({...editingGroup, name: e.target.value})}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. 5th Grade Teachers"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Select Members</label>
                                <input 
                                    type="text" 
                                    placeholder="Search staff..." 
                                    value={groupMemberSearch}
                                    onChange={(e) => setGroupMemberSearch(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs mb-3 focus:outline-none focus:border-indigo-400"
                                />
                                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                    {STAFF_ROSTER_DATA.filter(s => s.name.toLowerCase().includes(groupMemberSearch.toLowerCase())).map(staff => {
                                        const isSelected = editingGroup.members.includes(staff.name);
                                        return (
                                            <div 
                                                key={staff.id} 
                                                onClick={() => toggleGroupMember(staff.name)}
                                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                                        {staff.name.charAt(0)}
                                                    </div>
                                                    <span className={`text-xs ${isSelected ? 'font-bold text-indigo-900' : 'text-slate-700'}`}>{staff.name}</span>
                                                </div>
                                                {isSelected && <Check size={14} className="text-indigo-600" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                            <button onClick={handleSaveGroup} disabled={!editingGroup.name.trim()} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm">Save Group</button>
                        </div>
                      </>
                  ) : (
                      // LIST MODE
                      <>
                        <div className="p-5 flex-1 overflow-y-auto space-y-3">
                            {groups.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs">No groups created yet.</div>
                            ) : (
                                groups.map(group => (
                                    <div key={group.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 hover:shadow-sm transition-all group">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{group.name}</h4>
                                            <p className="text-xs text-slate-500">{group.members.length} members</p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingGroup(group)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                            <button 
                                onClick={() => setEditingGroup({ id: '', name: '', members: [] })}
                                className="w-full py-2.5 bg-white border border-dashed border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                            >
                                <Plus size={16} /> Create New Group
                            </button>
                        </div>
                      </>
                  )}
              </div>
          </div>
      )}

      {/* --- Add Event Modal (Now Draggable) --- */}
      <DraggableModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Event"
        initialWidth={900}
        initialHeight={800}
        mobileMode="fullscreen"
        allowDrag={!isCompactViewport}
        allowResize={!isCompactViewport}
        footer={
            <div className="flex justify-end gap-4 w-full">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleCreateEvent} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-xl transition-all active:scale-95 transform">Create Event</button>
            </div>
        }
      >
                <form onSubmit={handleCreateEvent} className="flex-1 h-full">
                    <div className="flex flex-col md:flex-row h-full">
                        
                        {/* LEFT COLUMN: Event Details */}
                        <div className="flex-1 p-6 md:p-8 space-y-6 border-r border-slate-100 bg-white">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Event Title</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="e.g. Team Sync, MTSS Review..."
                                    value={newEventForm.title}
                                    onChange={e => setNewEventForm({...newEventForm, title: e.target.value})}
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Type</label>
                                    <select 
                                        value={newEventForm.type}
                                        onChange={e => setNewEventForm({...newEventForm, type: e.target.value as EventType})}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all cursor-pointer"
                                    >
                                        {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <CustomDatePicker 
                                        label="Date"
                                        value={newEventForm.date}
                                        onChange={(val) => setNewEventForm({...newEventForm, date: val})}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-700">All-day event</p>
                                    <p className="text-xs text-slate-500">Show this event in the all-day lane.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNewEventForm(prev => ({ ...prev, allDay: !prev.allDay }))}
                                    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${newEventForm.allDay ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    aria-label="Toggle all-day event"
                                    aria-pressed={newEventForm.allDay}
                                >
                                    <span
                                        className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${newEventForm.allDay ? 'translate-x-5' : 'translate-x-0.5'}`}
                                    />
                                </button>
                            </div>
                            
                            <div className={`grid grid-cols-2 gap-5 ${newEventForm.allDay ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Start Time</label>
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            required
                                            value={newEventForm.startTime}
                                            onChange={e => setNewEventForm({...newEventForm, startTime: e.target.value})}
                                            className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                        />
                                        <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">End Time</label>
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            required
                                            value={newEventForm.endTime}
                                            onChange={e => setNewEventForm({...newEventForm, endTime: e.target.value})}
                                            className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                        />
                                        <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Recurrence */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Repeat size={14} className="text-indigo-500" /> Recurrence Pattern
                                    </label>
                                    {newEventForm.recurrencePattern !== 'None' && (
                                         <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                            {newEventForm.recurrencePattern}
                                         </span>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {['None', 'Daily', 'Weekly', 'Monthly'].map((pattern) => (
                                        <button
                                            key={pattern}
                                            type="button"
                                            onClick={() => setNewEventForm({ ...newEventForm, recurrencePattern: pattern })}
                                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                                                newEventForm.recurrencePattern === pattern
                                                    ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm ring-1 ring-indigo-600'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {pattern === 'None' ? 'No Repeat' : pattern}
                                        </button>
                                    ))}
                                </div>

                                {newEventForm.recurrencePattern !== 'None' && (
                                    <div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-200">
                                         <CustomDatePicker 
                                            label="End Date"
                                            value={newEventForm.recurrenceEnd}
                                            onChange={(val) => setNewEventForm({...newEventForm, recurrenceEnd: val})}
                                            className="w-full"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2 italic">
                                            Event will repeat {newEventForm.recurrencePattern.toLowerCase()} starting from {new Date(newEventForm.date).toLocaleDateString()}.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Location</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Room 101 or Zoom Link"
                                        value={newEventForm.location}
                                        onChange={e => setNewEventForm({...newEventForm, location: e.target.value})}
                                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Description</label>
                                <textarea 
                                    rows={3}
                                    placeholder="Agenda items, notes..."
                                    value={newEventForm.description}
                                    onChange={e => setNewEventForm({...newEventForm, description: e.target.value})}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none transition-all"
                                />
                            </div>

                            {/* Attachments Section */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Attachments</label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-transparent hover:border-indigo-100">
                                            <Paperclip size={14} /> Add File
                                        </button>
                                        <button type="button" onClick={startCamera} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-transparent hover:border-indigo-100">
                                            <Camera size={14} /> Photo
                                        </button>
                                    </div>
                                </div>
                                {newEventAttachments.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-3">
                                        {newEventAttachments.map(att => (
                                            <div key={att.id} className="relative group aspect-square bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden hover:border-indigo-300 transition-colors">
                                                {att.type === 'image' ? (
                                                    <img src={att.url} className="w-full h-full object-cover" alt="preview" />
                                                ) : (
                                                    <div className="text-slate-400 flex flex-col items-center gap-2 p-2 text-center">
                                                        <FileIcon size={24} />
                                                        <span className="text-[10px] font-bold uppercase truncate w-full px-1">{att.name.split('.').pop()}</span>
                                                    </div>
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={() => removeAttachment(att.id)}
                                                    className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-rose-600"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50">
                                        <Paperclip size={24} className="opacity-50"/>
                                        <span className="text-xs">No files attached yet.</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: People & Conflict Check */}
                        <div className="px-6 pb-2 md:hidden">
                            <button
                                type="button"
                                onClick={() => setIsInviteSectionOpen((prev) => !prev)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 flex items-center justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Users size={16} className="text-indigo-600" />
                                    Invite attendees and scheduling
                                </span>
                                <ChevronDown size={16} className={`transition-transform ${isInviteSectionOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        <div className={`flex-1 p-6 md:p-8 bg-slate-50/50 flex flex-col border-l border-slate-100/50 ${isCompactViewport && !isInviteSectionOpen ? 'hidden' : ''}`}>
                            <div className="mb-5">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                                    <Users size={18} className="text-indigo-600" /> Invite Attendees
                                </h4>
                                <p className="text-xs text-slate-500">Add participants and check schedule conflicts.</p>
                            </div>

                            {/* Quick Add Groups */}
                            <div className="mb-5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Add Groups</span>
                                    <button type="button" onClick={() => setIsGroupManagerOpen(true)} className="text-[10px] font-bold text-indigo-600 hover:underline">
                                        Manage Groups
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        type="button" 
                                        onClick={handleInviteAllStaff}
                                        className="text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 px-3 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
                                    >
                                        <Briefcase size={14} /> All Staff
                                    </button>
                                    {groups.map(g => (
                                        <button 
                                            key={g.id}
                                            type="button" 
                                            onClick={() => handleInviteGroup(g.id)}
                                            className="text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 px-3 py-2 rounded-lg transition-colors shadow-sm active:scale-95"
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Search User */}
                            <div className="relative mb-4">
                                <input 
                                    type="text" 
                                    placeholder="Search name or role..."
                                    value={inviteSearch}
                                    onChange={(e) => setInviteSearch(e.target.value)}
                                    className="w-full p-3 pl-10 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
                                />
                                <UserPlus size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                {inviteSearch && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto custom-scrollbar p-1">
                                        {STAFF_ROSTER_DATA.filter(s => s.name.toLowerCase().includes(inviteSearch.toLowerCase()) && !selectedInvitees.includes(s.name)).map(s => (
                                            <button 
                                                key={s.id} 
                                                type="button"
                                                onClick={() => handleInviteUser(s.name)}
                                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 rounded-lg flex justify-between items-center transition-colors group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                        {s.name.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-slate-700 group-hover:text-indigo-700">{s.name}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{s.role}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected List */}
                            <div className="flex-1 overflow-y-auto mb-5 pr-1 custom-scrollbar bg-white rounded-xl border border-slate-200 p-2 shadow-inner min-h-[150px]">
                                <div className="space-y-1">
                                    {selectedInvitees.map(name => {
                                        const hasConflict = detectedConflicts.some(c => c.user === name);
                                        return (
                                            <div key={name} className={`flex justify-between items-center p-2.5 rounded-lg border transition-all ${hasConflict ? 'bg-rose-50 border-rose-100' : 'bg-white border-transparent hover:border-slate-100 hover:shadow-sm hover:bg-slate-50'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${hasConflict ? 'bg-rose-400' : 'bg-slate-400'}`}>
                                                        {name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <span className={`text-xs font-bold block ${hasConflict ? 'text-rose-700' : 'text-slate-700'}`}>
                                                            {name} {name === currentUserName && '(You)'}
                                                        </span>
                                                        {hasConflict ? (
                                                            <span className="text-[10px] text-rose-600 flex items-center gap-1 font-medium mt-0.5">
                                                                <AlertCircle size={10} /> Busy at this time
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium mt-0.5">
                                                                <Check size={10} /> Available
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {name !== currentUserName && (
                                                    <button type="button" onClick={() => handleRemoveInvitee(name)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                                                        <X size={14}/>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Conflict & AI Section */}
                            <div className="mt-auto">
                                {detectedConflicts.length > 0 ? (
                                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4 flex items-start gap-3 shadow-sm">
                                        <div className="p-2 bg-rose-100 rounded-full text-rose-600 mt-0.5">
                                            <AlertCircle size={16} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-rose-800 block mb-1">{detectedConflicts.length} Scheduling Conflict(s)</span>
                                            <p className="text-xs text-rose-600 leading-relaxed">
                                                Some required attendees have overlaps. Try adjusting the time or use AI to find a free slot.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4 shadow-sm">
                                        <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                                            <Check size={16} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold block">All clear!</span>
                                            <span className="text-xs opacity-80">Everyone is free at this time.</span>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles size={14} className="text-indigo-500" /> Smart Scheduling
                                        </label>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {[15, 30, 45, 60].map(dur => (
                                            <button
                                                key={dur}
                                                type="button"
                                                onClick={() => setSuggestionDuration(dur)}
                                                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                                                    suggestionDuration === dur 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                {dur}m
                                            </button>
                                        ))}
                                        <div className="relative flex items-center flex-1 min-w-[80px]">
                                             <input 
                                                type="number"
                                                className="w-full p-1.5 pl-2 pr-6 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={suggestionDuration}
                                                onChange={(e) => setSuggestionDuration(Number(e.target.value))}
                                                placeholder="Custom"
                                             />
                                             <span className="absolute right-2 text-[10px] text-slate-400 font-medium">min</span>
                                        </div>
                                    </div>

                                    {!isSuggesting && aiSuggestions.length === 0 ? (
                                        <button 
                                            type="button" 
                                            onClick={handleAiSuggest}
                                            className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow"
                                        >
                                            {detectedConflicts.length > 0 ? 'Find Conflict-Free Slots' : 'Suggest Best Times'}
                                        </button>
                                    ) : isSuggesting ? (
                                        <div className="flex flex-col items-center justify-center gap-2 py-3 text-center bg-slate-50 rounded-lg border border-slate-100">
                                            <Loader2 size={20} className="animate-spin text-indigo-600" /> 
                                            <span className="text-xs font-medium text-slate-500">Analyzing calendars...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Slots</span>
                                                <button onClick={() => setAiSuggestions([])} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium underline">Clear</button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                {aiSuggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleApplySuggestion(s)}
                                                        className="w-full text-left bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 p-2.5 rounded-lg transition-all group shadow-sm flex justify-between items-center"
                                                    >
                                                        <div>
                                                            <div className="text-xs font-bold text-indigo-700">{s.start} - {s.end}</div>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">{s.reason}</p>
                                                        </div>
                                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
      </DraggableModal>

      {/* --- Event Details Modal (Standard centered, not draggable for simplicity but could be wrapped) --- */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header Colored Bar & Title */}
                <div className={`p-6 pb-4 ${getEventTypeStyles(selectedEvent.type).bg.replace('50', '50')} border-b border-slate-100 relative`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${getEventTypeStyles(selectedEvent.type).text} ${getEventTypeStyles(selectedEvent.type).border} bg-white/60 backdrop-blur-sm`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${getEventTypeStyles(selectedEvent.type).dot}`} />
                                {selectedEvent.type}
                            </span>
                            {selectedEvent.recurrence && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 bg-white/60 backdrop-blur-sm flex items-center gap-1">
                                    <Repeat size={10} /> {selectedEvent.recurrence.pattern}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button className="p-2 bg-white/50 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-colors backdrop-blur-sm">
                                <MoreHorizontal size={18} />
                            </button>
                            <button onClick={() => setSelectedEvent(null)} className="p-2 bg-white/50 hover:bg-white rounded-lg text-slate-500 hover:text-rose-600 transition-colors backdrop-blur-sm">
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-900 mb-1 leading-tight">{selectedEvent.title}</h3>
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        Organized by <span className="font-bold text-slate-700">{selectedEvent.organizer}</span>
                    </p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1 group hover:border-indigo-100 transition-colors">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
                                <Clock size={12} /> Time
                            </span>
                            <p className="text-sm font-bold text-slate-800">
                                {new Date(selectedEvent.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                                {selectedEvent.allDay
                                  ? 'All day'
                                  : formatEventTimeRange(selectedEvent.start, selectedEvent.end, userTimeZone)}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1 group hover:border-indigo-100 transition-colors">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
                                <MapPin size={12} /> Location
                            </span>
                            <p className="text-sm font-bold text-slate-800 truncate">{selectedEvent.location || 'Remote'}</p>
                            <p className="text-xs font-medium text-slate-500 truncate">
                                {selectedEvent.location?.includes('Zoom') ? 'Video Conference' : 'On Campus'}
                            </p>
                        </div>
                    </div>

                    {/* Description */}
                    {selectedEvent.description && (
                        <div>
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                                <AlignLeft size={12} /> Description
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                {selectedEvent.description}
                            </p>
                        </div>
                    )}

                    {/* Attachments Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                <Paperclip size={12} /> Attachments
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                                    + Add File
                                </button>
                                <button onClick={startCamera} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                                    + Photo
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3">
                            {selectedEvent.attachments && selectedEvent.attachments.length > 0 ? (
                                selectedEvent.attachments.map((att, idx) => (
                                    <div key={idx} className="relative group aspect-square bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden shadow-sm hover:border-indigo-300 transition-all hover:shadow-md">
                                        {att.type === 'image' ? (
                                            <img src={att.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="attachment" />
                                        ) : (
                                            <div className="text-slate-400 flex flex-col items-center gap-1 p-1 text-center">
                                                <FileIcon size={24} />
                                                <span className="text-[9px] font-bold uppercase truncate w-full px-1">{att.name.split('.').pop()}</span>
                                            </div>
                                        )}
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[1px]">
                                            <button className="text-white hover:text-indigo-200 hover:scale-110 transition-transform"><Download size={16}/></button>
                                            <button onClick={() => removeAttachment(att.id)} className="text-white hover:text-rose-300 hover:scale-110 transition-transform"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-4 p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 bg-slate-50/50">
                                    No attachments.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Attendees */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                <Users size={12} /> Participants ({selectedEvent.attendees.length})
                            </p>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {selectedEvent.attendees.map((att, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-2.5 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shadow-sm">
                                            <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${att.avatarSeed || att.name}&backgroundColor=e0e7ff`} className="w-full h-full object-cover" alt="avatar" />
                                        </div>
                                        <span className={`text-sm ${att.name === currentUserName ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>
                                            {att.name} {att.name === currentUserName && '(You)'}
                                        </span>
                                    </div>
                                    {getStatusBadge(att.status)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions - RSVP */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 z-10 shadow-inner">
                    {myStatus === AttendanceStatus.ORGANIZER ? (
                        <div className="w-full flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Owner</span>
                            <button className="text-xs font-bold text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-4 py-2 rounded-lg transition-colors border border-rose-200 bg-rose-50">Cancel Event</button>
                        </div>
                    ) : (
                        <>
                            <button 
                                onClick={() => handleRSVP(AttendanceStatus.DECLINED)}
                                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${myStatus === AttendanceStatus.DECLINED ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-inner' : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-sm'}`}
                            >
                                Decline
                            </button>
                            <button 
                                onClick={() => handleRSVP(AttendanceStatus.ACCEPTED)}
                                className={`flex-[2] px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${myStatus === AttendanceStatus.ACCEPTED ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-inner' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'}`}
                            >
                                {myStatus === AttendanceStatus.ACCEPTED && <Check size={14} />}
                                {myStatus === AttendanceStatus.ACCEPTED ? 'Attending' : 'Accept Invite'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Main Layout - Full Width Calendar */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[600px]">
            
            {/* Calendar Header with Integrated Filters */}
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white relative z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 lg:hidden">
                        <SidebarToggleButton
                            onClick={onMenuClick}
                            className="p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
                        />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                        {headerTitle}
                    </h2>
                    <div className="flex items-center bg-slate-100/80 rounded-lg p-1 border border-slate-200 ml-2">
                        <button
                            onClick={handlePreviousRange}
                            aria-label="Previous month"
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-indigo-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                            <ChevronLeft size={18}/>
                        </button>
                        <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-md">Today</button>
                        <button
                            onClick={handleNextRange}
                            aria-label="Next month"
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-indigo-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                            <ChevronRight size={18}/>
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                        {(['month', 'week', 'day'] as CalendarViewMode[]).map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                                    viewMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative">
                        <button 
                            ref={filterButtonRef}
                            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                            aria-label="Filter event types"
                            aria-expanded={isFilterDropdownOpen}
                            aria-haspopup="dialog"
                            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-bold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${isFilterDropdownOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                            <Filter size={16} />
                            <span>Filters</span>
                            {hasActiveTypeFilters && (
                                <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                    {selectedTypes.length}
                                </span>
                            )}
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isFilterDropdownOpen && (
                            <div
                                ref={filterPanelRef}
                                role="dialog"
                                aria-label="Filter events by type"
                                className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-30 p-2 animate-in fade-in zoom-in-95 origin-top-right ring-1 ring-black/5"
                            >
                                <div className="px-3 py-2 border-b border-slate-50 mb-2 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event Types</span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={clearTypeFilters}
                                            className="text-[10px] text-indigo-600 hover:underline font-bold"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={() => setIsFilterDropdownOpen(false)}
                                            className="text-[10px] text-slate-500 hover:text-slate-700 font-bold"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar px-1 pb-1">
                                    {ALL_EVENT_TYPES.map(type => {
                                        const styles = getEventTypeStyles(type);
                                        const isSelected = selectedTypes.includes(type);
                                        return (
                                            <label key={type} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                                                <div className={`relative flex items-center justify-center w-5 h-5 rounded border transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                    <input 
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={isSelected}
                                                        onChange={() => toggleTypeFilter(type)}
                                                    />
                                                </div>
                                                <div className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
                                                <span className={`text-sm ${isSelected ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>{type}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Create Event Button */}
                    <button 
                        onClick={() => setIsAddModalOpen(true)} 
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                        <Plus size={18} /> 
                        <span>New Event</span>
                    </button>
                </div>
            </div>

            {hasActiveTypeFilters && (
                <div className="px-6 py-2.5 border-b border-slate-100 bg-indigo-50/40 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-indigo-900">
                        Showing {selectedTypes.length} of {ALL_EVENT_TYPES.length} event types
                    </p>
                    <button
                        onClick={clearTypeFilters}
                        className="text-xs font-bold text-indigo-700 hover:underline"
                    >
                        Reset Filters
                    </button>
                </div>
            )}

            {isCalendarLoading && (
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 text-sm text-slate-600">
                    Loading calendar...
                </div>
            )}

            {calendarLoadError && (
                <div className="px-6 py-3 border-b border-rose-200 bg-rose-50 text-sm text-rose-700" role="alert">
                    {isUnauthorizedCalendarError
                        ? 'Calendar data could not be loaded because your session is not authorized. Sign in again to view saved events.'
                        : `Calendar data could not be loaded: ${calendarLoadError.message}`}
                </div>
            )}

            {viewMode === 'month' ? (
                <>
                    {/* Days Header */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/30">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    {/* Days Grid */}
                    <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-white">
                        {calendarDays.map((dateObj, idx) => {
                            const eventsForDay = getEventsForDay(dateObj.fullDate);
                            const visibleEventsForDay = eventsForDay.slice(0, MAX_VISIBLE_DAY_EVENTS);
                            const remainingEventCount = Math.max(0, eventsForDay.length - visibleEventsForDay.length);
                            const isToday = dateObj.type === 'current' && 
                                            dateObj.day === new Date().getDate() && 
                                            currentDate.getMonth() === new Date().getMonth() && 
                                            currentDate.getFullYear() === new Date().getFullYear();

                            return (
                                <div 
                                    key={idx} 
                                    className={`relative min-h-[140px] p-2 transition-all border-b border-r border-slate-100 group ${
                                        dateObj.type === 'current' 
                                            ? 'bg-white hover:bg-slate-50/30' 
                                            : 'bg-slate-50/40 text-slate-300'
                                    }`}
                                    onClick={() => {
                                        if (dateObj.type !== 'current') return;
                                        if (isCompactViewport) {
                                            openEventComposer(dateObj.fullDate, dayStartMinutes, false);
                                        } else {
                                            setNewEventForm(prev => ({ ...prev, date: toLocalDateInputValue(dateObj.fullDate) }));
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-transform ${
                                            isToday 
                                                ? 'bg-indigo-600 text-white shadow-md scale-110 ring-2 ring-indigo-100' 
                                                : 'text-slate-500'
                                        }`}>
                                            {dateObj.day}
                                        </span>
                                        
                                        {/* Quick Add Button (Visible on Hover) */}
                                        {dateObj.type === 'current' && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEventComposer(dateObj.fullDate, dayStartMinutes, false);
                                                }}
                                                className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all shadow-sm opacity-100 scale-100 sm:opacity-0 sm:scale-90 sm:group-hover:opacity-100 sm:group-hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                                title="Quick Add Event"
                                                aria-label={`Quick add event for ${dateObj.fullDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                                            >
                                                <Plus size={14} strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        {visibleEventsForDay.map(evt => {
                                            const styles = getEventTypeStyles(evt.type);
                                            return (
                                            <button 
                                                key={evt.id}
                                                onClick={(e) => { e.stopPropagation(); handleEventClick(evt); }}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-bold truncate shadow-sm hover:shadow transition-all hover:-translate-y-0.5 flex items-center gap-2 bg-opacity-90 hover:bg-opacity-100 ${styles.bg} ${styles.text} border border-transparent ${styles.hoverBorder} group/evt`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
                                                
                                                <div className="flex-1 truncate flex items-center gap-1.5">
                                                    <span className="opacity-70 font-medium text-[10px] tabular-nums">
                                                        {evt.allDay ? 'all day' : new Date(evt.start).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit', timeZone: userTimeZone}).replace(' ', '').toLowerCase()}
                                                    </span>
                                                    <span className="truncate">{evt.title}</span>
                                                </div>

                                                {(evt.recurrence || (evt.attachments && evt.attachments.length > 0)) && (
                                                    <div className="flex items-center gap-0.5 opacity-50">
                                                        {evt.recurrence && <Repeat size={8} />}
                                                        {evt.attachments && evt.attachments.length > 0 && <Paperclip size={8} />}
                                                    </div>
                                                )}
                                            </button>
                                        )})}
                                        {remainingEventCount > 0 && (
                                            <p className="px-2 text-[10px] font-semibold text-slate-500">
                                                +{remainingEventCount} more
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-auto bg-white">
                    <div className={`${viewMode === 'week' ? 'min-w-[1100px]' : 'min-w-[760px]'}`}>
                        <div
                            className="grid border-b border-slate-200 bg-slate-50/70"
                            style={{ gridTemplateColumns: `76px repeat(${visibleTimeGridDays.length}, minmax(0, 1fr))` }}
                        >
                            <div className="py-3 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200">Time</div>
                            {visibleTimeGridDays.map(day => {
                                const dayKey = toTimeZoneDayKey(day, userTimeZone);
                                const isTodayColumn = dayKey === todayDayKey;
                                return (
                                    <div key={dayKey} className={`px-3 py-2 border-r border-slate-200 ${isTodayColumn ? 'bg-indigo-50/60' : ''}`}>
                                        <p className={`text-xs font-bold uppercase tracking-wide ${isTodayColumn ? 'text-indigo-700' : 'text-slate-500'}`}>
                                            {day.toLocaleDateString('en-US', { weekday: 'short', timeZone: userTimeZone })}
                                        </p>
                                        <p className={`text-sm font-semibold ${isTodayColumn ? 'text-indigo-900' : 'text-slate-800'}`}>
                                            {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: userTimeZone })}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className="grid border-b border-slate-200 bg-white"
                            style={{ gridTemplateColumns: `76px repeat(${visibleTimeGridDays.length}, minmax(0, 1fr))` }}
                        >
                            <div className="px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200">All Day</div>
                            {visibleTimeGridDays.map(day => {
                                const dayKey = toTimeZoneDayKey(day, userTimeZone);
                                const dayAllDayEvents = allDayEventsByDay[dayKey] ?? [];
                                return (
                                    <div key={dayKey} className="min-h-[58px] border-r border-slate-200 px-2 py-2 space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => openEventComposer(day, 0, true)}
                                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-indigo-200 bg-indigo-50/50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"
                                        >
                                            <Plus size={10} />
                                            Add all-day
                                        </button>
                                        {dayAllDayEvents.map(evt => {
                                            const styles = getEventTypeStyles(evt.type);
                                            return (
                                                <button
                                                    key={`${dayKey}-${evt.id}`}
                                                    type="button"
                                                    onClick={() => handleEventClick(evt)}
                                                    className={`w-full truncate rounded-md px-2 py-1 text-left text-[11px] font-semibold border ${styles.bg} ${styles.text} ${styles.border}`}
                                                >
                                                    {evt.title}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className="grid"
                            style={{ gridTemplateColumns: `76px repeat(${visibleTimeGridDays.length}, minmax(0, 1fr))` }}
                        >
                            <div className="relative border-r border-slate-200 bg-slate-50/40" style={{ height: totalGridHeight }}>
                                {hourTicks.map((hour) => (
                                    <div
                                        key={hour}
                                        className="absolute inset-x-0 -translate-y-1/2 px-2 text-[10px] font-semibold text-slate-500"
                                        style={{ top: ((hour * 60 - dayStartMinutes) / CALENDAR_TOTAL_MINUTES) * totalGridHeight }}
                                    >
                                        {new Date(2026, 0, 1, hour, 0).toLocaleTimeString([], { hour: 'numeric' })}
                                    </div>
                                ))}
                            </div>

                            {visibleTimeGridDays.map((day, dayIndex) => {
                                const dayKey = toTimeZoneDayKey(day, userTimeZone);
                                const dayTimedEvents = timedEventsByDay[dayKey] ?? [];
                                const laneLayout = buildLaneLayout(dayTimedEvents, day);
                                return (
                                    <div
                                        key={dayKey}
                                        ref={(element) => {
                                            timeGridColumnRefs.current[dayIndex] = element;
                                        }}
                                        className="relative border-r border-slate-200 bg-white"
                                        style={{ height: totalGridHeight }}
                                        onClick={(event) => {
                                            if ((event.target as HTMLElement).closest('[data-calendar-event-block="true"]')) return;
                                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                            const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
                                            const minute = snapMinutes(dayStartMinutes + ratio * CALENDAR_TOTAL_MINUTES);
                                            openEventComposer(day, minute, false);
                                        }}
                                    >
                                        {Array.from({ length: slotCount + 1 }, (_, lineIndex) => (
                                            <div
                                                key={lineIndex}
                                                className={`absolute left-0 right-0 border-t ${lineIndex % 2 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                                                style={{ top: (lineIndex / slotCount) * totalGridHeight }}
                                            />
                                        ))}

                                        {laneLayout.map((entry) => {
                                            const styles = getEventTypeStyles(entry.event.type);
                                            const laneWidth = 100 / entry.laneCount;
                                            const left = entry.lane * laneWidth;
                                            const showTimeRange = entry.height > 44;
                                            return (
                                                <button
                                                    key={`${dayKey}-${entry.event.id}`}
                                                    type="button"
                                                    data-calendar-event-block="true"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleEventClick(entry.event);
                                                    }}
                                                    onMouseDown={(event) => {
                                                        event.stopPropagation();
                                                        startDragInteraction(entry.event.id, dayIndex, 'move');
                                                    }}
                                                    className={`absolute rounded-md border px-2 py-1 text-left shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${styles.bg} ${styles.text} ${styles.border}`}
                                                    style={{
                                                        top: entry.top,
                                                        height: entry.height,
                                                        left: `calc(${left}% + 2px)`,
                                                        width: `calc(${laneWidth}% - 4px)`,
                                                        zIndex: dragState?.eventId === entry.event.id ? 30 : 10,
                                                    }}
                                                >
                                                    <p className="truncate text-[11px] font-bold">{entry.event.title}</p>
                                                    {showTimeRange ? (
                                                        <p className="text-[10px] opacity-80">
                                                            {formatEventTimeRange(entry.event.start, entry.event.end, userTimeZone)}
                                                        </p>
                                                    ) : null}
                                                    <span
                                                        onMouseDown={(event) => {
                                                            event.stopPropagation();
                                                            startDragInteraction(entry.event.id, dayIndex, 'resize');
                                                        }}
                                                        className="absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center cursor-ns-resize text-slate-400/70 hover:text-slate-500"
                                                        data-calendar-event-block="true"
                                                    >
                                                        <GripVertical size={10} />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
      </div>
    </div>
  );
};
