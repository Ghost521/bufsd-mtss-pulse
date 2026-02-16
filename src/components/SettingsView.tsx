
import React, { useState, useRef } from 'react';
import { UserRole } from '../types';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Database, 
  Smartphone, 
  Mail, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Camera,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  CreditCard,
  School
} from 'lucide-react';

interface SettingsViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  currentSchoolName: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  currentUserRole, 
  currentUserName,
  currentSchoolName: _currentSchoolName
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Profile State
  const [displayName, setDisplayName] = useState(currentUserName);
  const [email, setEmail] = useState(`${currentUserName.toLowerCase().replace(/\s/g, '.')}@bufsd.org`);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security State
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);

  // Notification State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [digestFreq, setDigestFreq] = useState('Daily');

  const handleSave = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMsg('Settings saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }, 1000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const menuItems = [
    { id: 'profile', label: 'My Profile', icon: User, roles: ['All'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['All'] },
    { id: 'security', label: 'Security', icon: Shield, roles: ['All'] },
    { id: 'preferences', label: 'Preferences', icon: Globe, roles: ['All'] },
    { id: 'classroom', label: 'Classroom', icon: School, roles: [UserRole.TEACHER] },
    { id: 'billing', label: 'Billing & Plans', icon: CreditCard, roles: [UserRole.DISTRICT] },
    { id: 'system', label: 'System & Integrations', icon: Database, roles: [UserRole.DISTRICT, UserRole.PRINCIPAL] },
  ];

  const filteredItems = menuItems.filter(item => 
    item.roles.includes('All') || item.roles.includes(currentUserRole)
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your profile, preferences, and system configurations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 shrink-0">
          <nav className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 text-sm font-medium transition-colors border-l-4 ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-600' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
             <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                    {currentUserName.substring(0,2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-800 truncate">{currentUserName}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUserRole}</p>
                </div>
             </div>
             <button className="w-full py-2 text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <LogOut size={14} /> Sign Out
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
               <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-6">Public Profile</h2>
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                     <div className="flex flex-col items-center gap-3">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden ring-1 ring-slate-200">
                                <img 
                                    src={avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUserName.replace(/\s/g,'')}&backgroundColor=e0e7ff`} 
                                    alt="avatar" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white"
                            >
                                <Camera size={24} />
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                        </div>
                        <p className="text-xs text-slate-400">Allowed *.jpeg, *.jpg, *.png</p>
                     </div>
                     
                     <div className="flex-1 w-full space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                                <input 
                                    type="text" 
                                    value={currentUserRole}
                                    disabled
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bio / Status</label>
                            <textarea 
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-24 resize-none"
                                placeholder="Brief description for your colleagues..."
                            />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">Notifications</h2>
                    <p className="text-sm text-slate-500 mb-6">Manage how you receive updates and alerts.</p>
                    
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white border border-slate-200 rounded-lg text-indigo-600">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Email Notifications</p>
                                    <p className="text-xs text-slate-500">Receive daily summaries and critical alerts via email.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={emailNotifs} onChange={() => setEmailNotifs(!emailNotifs)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white border border-slate-200 rounded-lg text-indigo-600">
                                    <Smartphone size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Push Notifications</p>
                                    <p className="text-xs text-slate-500">Real-time alerts on your mobile device.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={pushNotifs} onChange={() => setPushNotifs(!pushNotifs)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 mb-3">Alert Preferences</h3>
                            <div className="space-y-3">
                                {['New Message Received', 'MTSS Meeting Scheduled', 'Intervention Plan Goal Met', 'Student Flagged (At-Risk)'].map((alert, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                        <span className="text-sm text-slate-600">{alert}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Digest Frequency</label>
                            <select 
                                value={digestFreq}
                                onChange={(e) => setDigestFreq(e.target.value)}
                                className="w-full md:w-64 p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            >
                                <option>Instant</option>
                                <option>Daily</option>
                                <option>Weekly</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Login & Security</h2>
                    
                    <div className="space-y-6 max-w-md">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Password</label>
                            <input type="password" value="password123" disabled className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500" />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                                <button 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Two-Factor Authentication</p>
                                    <p className="text-xs text-slate-500">Add an extra layer of security.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <div className="flex gap-3">
                                <Lock size={20} className="text-indigo-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-indigo-900">Security Log</p>
                                    <p className="text-xs text-indigo-700 mt-1">Last login: Today at 8:45 AM from Chrome (Windows).</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* System Settings (District/Principal) */}
          {activeTab === 'system' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">System Integrations</h2>
                    <p className="text-sm text-slate-500 mb-6">Manage data sync and external service connections.</p>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-lg">IC</div>
                                <div>
                                    <h4 className="font-bold text-slate-800">Infinite Campus</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <span className="text-xs text-emerald-600 font-medium">Connected • Synced 10m ago</span>
                                    </div>
                                </div>
                            </div>
                            <button className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">Configure</button>
                        </div>

                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-lg">C</div>
                                <div>
                                    <h4 className="font-bold text-slate-800">Clever</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span className="text-xs text-emerald-600 font-medium">Connected</span>
                                    </div>
                                </div>
                            </div>
                            <button className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">Configure</button>
                        </div>

                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl opacity-60">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-700 font-bold text-lg">P</div>
                                <div>
                                    <h4 className="font-bold text-slate-800">PowerSchool</h4>
                                    <p className="text-xs text-slate-500 mt-1">Not configured</p>
                                </div>
                            </div>
                            <button className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100">Connect</button>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* Parent Preferences */}
          {activeTab === 'preferences' && currentUserRole === UserRole.PARENT && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Family Preferences</h2>
                    <div className="space-y-6 max-w-md">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Preferred Language</label>
                            <select className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                                <option>English</option>
                                <option>Spanish</option>
                                <option>Mandarin</option>
                                <option>Arabic</option>
                            </select>
                            <p className="text-xs text-slate-400 mt-1">All communications will be translated to this language.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contact Method Priority</label>
                            <select className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                                <option>Email first, then Phone</option>
                                <option>Phone first, then Email</option>
                                <option>SMS Only</option>
                            </select>
                        </div>
                    </div>
                </div>
             </div>
          )}

          {/* Teacher Classroom Settings */}
          {activeTab === 'classroom' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Classroom Defaults</h2>
                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 rounded-xl">
                            <label className="flex items-center justify-between cursor-pointer mb-2">
                                <span className="font-bold text-slate-700 text-sm">Auto-flag low attendance</span>
                                <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                            </label>
                            <p className="text-xs text-slate-500">Automatically create an action item if attendance drops below 85%.</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-xl">
                            <label className="flex items-center justify-between cursor-pointer mb-2">
                                <span className="font-bold text-slate-700 text-sm">Weekly Parent Summary</span>
                                <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                            </label>
                            <p className="text-xs text-slate-500">Send automated weekly behavior/academic summaries to parents.</p>
                        </div>
                    </div>
                </div>
             </div>
          )}

          {/* Save Bar */}
          <div className="mt-6 flex justify-end items-center gap-4">
             {successMsg && (
                 <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-right-2">
                     <CheckCircle2 size={16} /> {successMsg}
                 </div>
             )}
             <button 
                onClick={handleSave}
                disabled={isLoading}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-70 transition-all flex items-center gap-2"
             >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};
