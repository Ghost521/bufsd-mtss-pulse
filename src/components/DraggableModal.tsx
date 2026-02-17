
import React, { useState, useEffect, useRef, useId } from 'react';
import { X, GripHorizontal, Scaling } from 'lucide-react';

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  headerClassName?: string;
  className?: string;
  titleId?: string;
  descriptionId?: string;
  showResizeHandle?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    return element.offsetParent !== null || element === document.activeElement;
  });

export const DraggableModal: React.FC<DraggableModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  initialWidth = 600,
  initialHeight,
  minWidth = 400,
  minHeight = 300,
  headerClassName = '',
  className = '',
  titleId,
  descriptionId,
  showResizeHandle = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const resolvedDescriptionId = descriptionId ?? generatedDescriptionId;
  
  // Track position and size in refs
  const position = useRef({ x: 0, y: 0 });
  const size = useRef({ w: initialWidth, h: initialHeight || 0 });
  
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Initialize position
  useEffect(() => {
    if (isOpen && modalRef.current) {
      previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const w = initialWidth;
      const h = initialHeight || 0; 
      
      const x = Math.max(0, (window.innerWidth - w) / 2);
      const y = Math.max(0, (window.innerHeight - (h || 600)) / 2);

      position.current = { x, y };
      size.current = { w, h };

      // Reset transform and set initial position using translate3d for performance
      modalRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Ensure top/left are 0 so transform works from top-left origin
      modalRef.current.style.top = '0px';
      modalRef.current.style.left = '0px';
      
      modalRef.current.style.width = `${w}px`;
      modalRef.current.style.height = h ? `${h}px` : 'auto';
      modalRef.current.style.maxHeight = '95vh';
      modalRef.current.style.maxWidth = '95vw';

      window.setTimeout(() => {
        if (!modalRef.current) return;
        const focusable = getFocusableElements(modalRef.current);
        const autofocusTarget = modalRef.current.querySelector<HTMLElement>('[data-autofocus="true"]');
        const focusTarget = autofocusTarget ?? focusable[0] ?? modalRef.current;
        focusTarget.focus();
      }, 0);
    }
  }, [isOpen, initialWidth, initialHeight]);

  useEffect(() => {
    if (isOpen) return;
    if (!previouslyFocusedElementRef.current) return;
    previouslyFocusedElementRef.current.focus();
    previouslyFocusedElementRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!modalRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeInsideModal = Boolean(active && modalRef.current.contains(active));

      if (event.shiftKey) {
        if (!activeInsideModal || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeInsideModal || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isResizing) return;
      if (!modalRef.current) return;

      // Direct update in event loop removes the "lag behind cursor" feel
      // caused by requestAnimationFrame latency
      if (isDragging) {
        let newX = e.clientX - dragOffset.current.x;
        let newY = e.clientY - dragOffset.current.y;
        
        // Bounds checking
        const maxX = window.innerWidth - modalRef.current.offsetWidth;
        const maxY = window.innerHeight - modalRef.current.offsetHeight;

        // Clamp values
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        position.current = { x: newX, y: newY };
        modalRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        
        // Calculate new dimensions
        let newW = Math.max(minWidth, resizeStart.current.w + deltaX);
        let newH = Math.max(minHeight, resizeStart.current.h + deltaY);
        
        // Bound resizing to window dimensions
        const currentX = position.current.x;
        const currentY = position.current.y;
        
        if (currentX + newW > window.innerWidth) {
            newW = window.innerWidth - currentX;
        }
        if (currentY + newH > window.innerHeight) {
            newH = window.innerHeight - currentY;
        }

        size.current = { w: newW, h: newH };
        modalRef.current.style.width = `${newW}px`;
        modalRef.current.style.height = `${newH}px`;
      }
    };

    const onMouseUp = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizing ? 'nwse-resize' : 'grabbing';
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isResizing, minWidth, minHeight]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return; // Prevent dragging when clicking buttons in header
    
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: rect.width,
        h: rect.height
      };
      setIsResizing(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300 animate-in fade-in" 
        onClick={onClose} 
      />

      <div
        ref={modalRef}
        className={`absolute bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 pointer-events-auto animate-in zoom-in-95 duration-200 will-change-transform ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? resolvedTitleId : undefined}
        aria-describedby={resolvedDescriptionId}
        tabIndex={-1}
        style={{ 
            width: initialWidth,
            height: initialHeight || 'auto',
            top: 0,
            left: 0,
        }}
      >
        {/* Header */}
        <div
          className={`flex justify-between items-center p-4 border-b border-slate-100 bg-white select-none transition-colors ${isDragging ? 'cursor-grabbing bg-slate-50' : 'cursor-grab'} ${headerClassName}`}
          onMouseDown={handleDragStart}
        >
          <div id={resolvedTitleId} className="flex items-center gap-2 font-bold text-slate-800 text-lg truncate pr-4 pointer-events-none">
            <GripHorizontal size={20} className="text-slate-300 shrink-0" />
            {title}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors pointer-events-auto"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div id={resolvedDescriptionId} className="flex-1 overflow-auto relative flex flex-col bg-white">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
            {footer}
          </div>
        )}

        {/* Resize Handle */}
        {showResizeHandle ? (
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center z-20 hover:bg-slate-100 rounded-tl transition-colors group"
            onMouseDown={handleResizeStart}
          >
            <Scaling size={14} className="text-slate-300 group-hover:text-indigo-500" />
          </div>
        ) : null}
      </div>
    </div>
  );
};
