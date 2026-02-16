
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ 
  value, 
  onChange, 
  label, 
  disabled = false,
  placeholder = "YYYY-MM-DD",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && !isNaN(new Date(value).getTime())) {
      const date = new Date(value);
      // Adjust for timezone to ensure display matches input string YYYY-MM-DD
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
      setViewDate(adjustedDate);
    }
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format as YYYY-MM-DD string directly to avoid timezone shift issues in value
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${year}-${month}-${d}`);
    setIsOpen(false);
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const days: Array<number | null> = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>}
      <div className="relative">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2.5 pl-3 pr-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium transition-shadow"
          placeholder={placeholder}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          readOnly // Prevent manual typing to enforce picker usage for safety, or allow with validation
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); !disabled && setIsOpen(!isOpen); }}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calendar size={16} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-72 animate-in fade-in zoom-in-95 origin-top-left">
          <div className="flex justify-between items-center mb-4">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-sm font-bold text-slate-800">
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
                // Check if this specific day is selected
                const isSelected = day && value === `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = day && new Date().getDate() === day && new Date().getMonth() === viewDate.getMonth() && new Date().getFullYear() === viewDate.getFullYear();

                return (
                <button
                    key={idx}
                    onClick={(e) => { e.preventDefault(); day && handleDayClick(day); }}
                    disabled={!day}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    !day ? 'invisible' :
                    isSelected
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : isToday 
                            ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-200' 
                            : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                    {day}
                </button>
                );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
