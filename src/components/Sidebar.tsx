
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  BarChart2, 
  Settings,
  LogOut,
  GraduationCap,
  BookOpen,
  School,
  MessageCircle,
  ClipboardList,
  X,
  Database,
  HardDriveUpload,
  BookCopy
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  userName: string;
  schoolName: string;
  isOpen: boolean;
  onClose: () => void;
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentRole, 
  onRoleChange, 
  userName, 
  schoolName, 
  isOpen, 
  onClose,
  activePage,
  onNavigate
}) => {
  
  const getMenuItems = (role: UserRole) => {
    // Common items can be added here if needed, but keeping role specific structure
    const knowledgeBaseItem = { id: 'documents', icon: Database, label: 'Knowledge Base' };
    const messagesItem = { id: 'messages', icon: MessageCircle, label: 'Messages' };
    const calendarItem = { id: 'calendar', icon: Calendar, label: 'Calendar' };
    const importItem = { id: 'import', icon: HardDriveUpload, label: 'Data Import' };
    const lessonPlansItem = { id: 'lesson_plans', icon: BookCopy, label: 'Lesson Plans' };

    switch(role) {
      case UserRole.PRINCIPAL:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'Command Center' },
          { id: 'rosters', icon: Users, label: 'Rosters' },
          lessonPlansItem,
          { id: 'interventions', icon: FileText, label: 'Intervention Plans' },
          calendarItem,
          { id: 'reports', icon: BarChart2, label: 'District Reports' },
          messagesItem,
          knowledgeBaseItem,
          importItem
        ];
      case UserRole.TEACHER:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'My Classroom' },
          { id: 'class_roster', icon: Users, label: 'Roster' },
          { id: 'gradebook', icon: BookOpen, label: 'Gradebook' },
          lessonPlansItem,
          { id: 'interventions', icon: FileText, label: 'Interventions' },
          calendarItem,
          messagesItem,
          knowledgeBaseItem,
          importItem
        ];
      case UserRole.DISTRICT:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'District Pulse' },
          { id: 'map', icon: School, label: 'Schools Map' },
          { id: 'reports', icon: BarChart2, label: 'System Reports' },
          { id: 'staffing', icon: Users, label: 'Staffing' },
          calendarItem,
          messagesItem,
          knowledgeBaseItem,
          importItem
        ];
      case UserRole.PARENT:
        return [
          { id: 'dashboard', icon: LayoutDashboard, label: 'My Child' },
          { id: 'assignments', icon: ClipboardList, label: 'Assignments' },
          { id: 'reports', icon: FileText, label: 'Report Cards' },
          calendarItem,
          messagesItem,
          knowledgeBaseItem
        ];
      default: return [];
    }
  };

  const menuItems = getMenuItems(currentRole);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-lg">
               <GraduationCap size={24} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg leading-tight whitespace-nowrap">BUFSD MTSS</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide truncate max-w-[140px]">{schoolName}</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.label}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {/* Role Switcher for Demo */}
          <div className="mb-4">
            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">View As</label>
            <select 
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-2 focus:outline-none focus:border-brand-500"
            >
              {Object.values(UserRole).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => { onNavigate('settings'); onClose(); }}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-colors mb-2 ${activePage === 'settings' ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          
          <div className="flex items-center gap-3 mt-2 p-3 bg-slate-800/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold shadow-md shrink-0">
              {userName.substring(0,2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-slate-400 truncate">{currentRole}</p>
            </div>
            <LogOut size={16} className="text-slate-500 hover:text-white cursor-pointer" />
          </div>
        </div>
      </div>
    </>
  );
};
