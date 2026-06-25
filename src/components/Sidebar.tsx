import React, { useEffect, useState } from 'react';
import { 
  Home, MapPin, Users, Settings, LogOut, Bell, User, Map, Mail, 
  ChevronRight, ChevronLeft, Sparkles, HeartPulse, ShieldAlert, KeyRound, ClipboardCheck, Coins, Clock,
  ChevronDown, ChevronUp, Facebook, FileText
} from 'lucide-react';
import { User as UserType, SiteSettings, hasRole } from '../types';

interface SidebarProps {
  currentUser: UserType;
  currentTab: string;
  onChangeTab: (tab: string) => void;
  onLogout: () => void;
  siteSettings: SiteSettings;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  onUpdateUser: (user: UserType) => void;
}

export default function Sidebar({ 
  currentUser, 
  currentTab, 
  onChangeTab, 
  onLogout, 
  siteSettings, 
  mobileOpen, 
  setMobileOpen,
  minimized = false,
  onToggleMinimize,
  onUpdateUser
}: SidebarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [mongoConnected, setMongoConnected] = useState(false);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'barangays-group': currentTab === 'barangays' || currentTab === 'puroks',
    'households-group': currentTab === 'households' || currentTab === 'drafts' || currentTab === 'approvals' || currentTab === 'disapproved-submitted' || currentTab === 'pcu-file',
    'salary-group': currentTab === 'payroll' || currentTab === 'it-payroll'
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach(key => {
        if (key === groupId) {
          next[key] = !prev[key];
        } else {
          next[key] = false;
        }
      });
      return next;
    });
  };

  useEffect(() => {
    if (currentTab === 'barangays' || currentTab === 'puroks') {
      setOpenGroups({ 'barangays-group': true, 'households-group': false, 'salary-group': false });
    } else if (currentTab === 'households' || currentTab === 'drafts' || currentTab === 'approvals' || currentTab === 'disapproved-submitted' || currentTab === 'pcu-file') {
      setOpenGroups({ 'barangays-group': false, 'households-group': true, 'salary-group': false });
    } else if (currentTab === 'payroll' || currentTab === 'it-payroll') {
      setOpenGroups({ 'barangays-group': false, 'households-group': false, 'salary-group': true });
    } else {
      setOpenGroups({ 'barangays-group': false, 'households-group': false, 'salary-group': false });
    }
  }, [currentTab]);

  // Profile fields editing
  const [editName, setEditName] = useState(currentUser.fullName);
  const [editAddress, setEditAddress] = useState(currentUser.address);
  const [editProfilePicture, setEditProfilePicture] = useState(currentUser.profilePicture || '');
  const [editContact, setEditContact] = useState(currentUser.contactNumber || '');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');
  const [dbBarangays, setDbBarangays] = useState<any[]>([]);

  useEffect(() => {
    setEditName(currentUser.fullName);
    setEditAddress(currentUser.address);
    setEditProfilePicture(currentUser.profilePicture || '');
    setEditContact(currentUser.contactNumber || '');
  }, [currentUser, showProfile]);

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch('/api/barangays');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.barangays || []);
          setDbBarangays(list);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBarangays();
  }, []);

  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        const res = await fetch('/api/db-status');
        if (res.ok) {
          const data = await res.json();
          setMongoConnected(data.connected);
        }
      } catch (err) {}
    };
    fetchDbStatus();
    const dbInterval = setInterval(fetchDbStatus, 30000);
    return () => clearInterval(dbInterval);
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    setPassErr('');

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          fullName: editName,
          address: editAddress,
          profilePicture: editProfilePicture,
          contactNumber: editContact
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPassMsg('Profile data updated successfully!');
        if (data.user) {
          onUpdateUser(data.user);
          localStorage.setItem('sfc_user', JSON.stringify(data.user));
        } else {
          const updatedUser = { ...currentUser, fullName: editName, address: editAddress, profilePicture: editProfilePicture, contactNumber: editContact };
          onUpdateUser(updatedUser);
          localStorage.setItem('sfc_user', JSON.stringify(updatedUser));
        }
      } else {
        const data = await res.json();
        setPassErr(data.error || 'Failed to update profile details.');
      }
    } catch(err: any) {
      setPassErr(err.message || 'An error occurred during communication.');
    }
  };

  const handlePassChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassErr('');
    setPassMsg('');

    if (!oldPass || !newPass) {
      setPassErr('Please fill in password fields');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPassMsg('Security password updated successfully!');
      setOldPass('');
      setNewPass('');
    } catch(err: any) {
      setPassErr(err.message || 'Error updating password.');
    }
  };

  // Role Access Control boundaries mapping
  // HR Team - "Dashboard, Geographic Map Page, Barangays, Purok, Household, Household Approval, Masterlist, Health Record, Payroll, Attendance Monitoring, Audit Trail Logs". 
  // IT Support – “Dashboard, Geographic Map Page, Barangays, Purok, Household, Household Approval, Masterlist, Health Record, Audit Trail Logs”.
  // Field Leader – “Dashboard, Geographic Map Page, Household, Masterlist”.
  // Field Co-Leader - “Dashboard, Geographic Map Page, Household, Masterlist”.
  // Clinical Admin – “Dashboard, Geographic Map Page, Barangays, Purok, Household, Masterlist, Health Record, Audit Trail Logs”.
  // Manager – “All Page can access”.
  const checkAccess = (tab: string) => {
    // Master Admin override to access all pages
    if (['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email)) {
      return true;
    }

    if (tab === 'pcu-file') {
      return checkAccess('households');
    }

    if (tab === 'drafts') {
      return true;
    }

    const roles = currentUser.position ? currentUser.position.split(',').map(r => r.trim()).filter(Boolean) : [];

    const hasRoleAccess = (role: string) => {
      // Check custom designations for system position first
      if (siteSettings?.userPagePermissions) {
        const allowedPages = siteSettings.userPagePermissions[role];
        if (allowedPages && Array.isArray(allowedPages)) {
          if (allowedPages.includes(tab)) return true;
        }
      }

      if (role === 'MANAGER') {
        return true;
      }

      if (role === 'HR') {
        const HR_PAGES = [
          'dashboard', 
          'geomap', 
          'barangays', 
          'puroks', 
          'households', 
          'pcu-file',
          'approvals', 
          'masterlist', 
          'daily-accomplishment',
          'daily-attachment',
          'consultation', 
          'payroll', 
          'it-payroll',
          'attendance-monitoring', 
          'audit',
          'blank-forms'
        ];
        return HR_PAGES.includes(tab);
      }

      if (role === 'IT') {
        const IT_PAGES = [
          'dashboard', 
          'geomap', 
          'barangays', 
          'puroks', 
          'households', 
          'pcu-file',
          'approvals', 
          'masterlist', 
          'daily-accomplishment',
          'daily-attachment',
          'consultation', 
          'it-payroll',
          'audit',
          'blank-forms'
        ];
        return IT_PAGES.includes(tab);
      }

      if (role === 'LEADER' || role === 'CO-LEADER') {
        const LEADER_PAGES = [
          'dashboard', 
          'geomap', 
          'households', 
          'pcu-file',
          'masterlist',
          'daily-accomplishment',
          'daily-attachment',
          'disapproved-submitted', // Sub-page for disapproved submissions
          'blank-forms'
        ];
        return LEADER_PAGES.includes(tab);
      }

      if (role === 'ADMIN') {
        // Clinical Admin
        const ADMIN_PAGES = [
          'dashboard', 
          'geomap', 
          'barangays', 
          'puroks', 
          'households', 
          'pcu-file',
          'approvals',
          'masterlist', 
          'daily-accomplishment',
          'daily-attachment',
          'consultation', 
          'it-payroll',
          'audit',
          'blank-forms'
        ];
        return ADMIN_PAGES.includes(tab);
      }

      return false;
    };

    return roles.some(hasRoleAccess);
  };

  interface NavItem {
    type: 'single' | 'group';
    id: string;
    label: string;
    icon: any;
    children?: { id: string; label: string; icon: any }[];
  }

  const navItems: NavItem[] = [
    { type: 'single', id: 'dashboard', label: 'Executive Dashboard', icon: Home },
    { type: 'single', id: 'geomap', label: 'Geographic Map Page', icon: Map },
    { 
      type: 'group', 
      id: 'barangays-group', 
      label: 'Barangays', 
      icon: MapPin, 
      children: [
        { id: 'barangays', label: 'Barangays', icon: MapPin },
        { id: 'puroks', label: 'Puroks', icon: MapPin }
      ]
    },
    { 
      type: 'group', 
      id: 'households-group', 
      label: 'Households', 
      icon: ClipboardCheck, 
      children: [
        { id: 'households', label: 'Households', icon: ClipboardCheck },
        { id: 'drafts', label: 'Drafts (Offline)', icon: FileText },
        { id: 'approvals', label: 'Household Approval', icon: ShieldAlert },
        { id: 'disapproved-submitted', label: 'Disapproved Submissions', icon: ShieldAlert },
        { id: 'pcu-file', label: 'PCU File', icon: FileText }
      ]
    },
    { type: 'single', id: 'groups', label: 'Group Management', icon: Users },
    { type: 'single', id: 'masterlist', label: 'Citizen Masterlist', icon: ClipboardCheck },
    { type: 'single', id: 'daily-accomplishment', label: 'Daily Accomplishment', icon: ClipboardCheck },
    { type: 'single', id: 'daily-attachment', label: 'Daily Attachment', icon: FileText },
    { type: 'single', id: 'consultation', label: 'Consultation', icon: HeartPulse },
    { type: 'single', id: 'accounts', label: 'Account Management', icon: User },
    { 
      type: 'group', 
      id: 'salary-group', 
      label: 'Salary', 
      icon: Coins, 
      children: [
        { id: 'payroll', label: 'Payroll', icon: Coins },
        { id: 'it-payroll', label: 'IT Staff Payroll', icon: Coins }
      ]
    },
    { type: 'single', id: 'attendance-monitoring', label: 'Attendance Monitoring', icon: Clock },
    { type: 'single', id: 'audit', label: 'Audit Trail Logs', icon: Clock },
    { type: 'single', id: 'blank-forms', label: 'Forms', icon: FileText }
  ];

  return (
    <>
      <div className={`fixed md:sticky top-0 bottom-0 left-0 z-[9999] bg-gradient-to-b from-slate-950 via-emerald-950/80 to-slate-950 text-slate-100 h-screen flex flex-col justify-between font-sans text-xs border-r border-emerald-900/40 transition-all duration-300 md:translate-x-0 print:hidden ${minimized ? 'md:w-16 w-64' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      
      {/* Branding and Alerts Header */}
      <div>
        <div className="p-3.5 border-b border-emerald-900/40 flex items-center justify-between gap-1.5 overflow-hidden">
          <div className="flex items-center gap-2 max-w-[170px] overflow-hidden">
            {siteSettings.websiteLogo && (siteSettings.websiteLogo.startsWith('http://') || siteSettings.websiteLogo.startsWith('https://') || siteSettings.websiteLogo.startsWith('data:image/')) ? (
              <img src={siteSettings.websiteLogo} className="h-8 w-auto object-contain max-w-[32px] animate-pulse shrink-0" alt="Logo" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-lg shrink-0">{siteSettings.websiteLogo || '🏥'}</span>
            )}
            {!minimized && (
              <span className="font-extrabold text-white tracking-widest text-[9.5px] uppercase leading-tight select-none animate-fade-in block truncate">
                {siteSettings.websiteTitle || 'Saint Francis Portal'}
              </span>
            )}
          </div>
          
          {/* Toggle minimize navigation block button */}
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              title={minimized ? "Expand Navigation Panel" : "Minimize Navigation Panel"}
              className="hidden md:flex p-1 rounded-md text-slate-305 hover:text-white bg-emerald-900/30 hover:bg-emerald-900/60 border border-emerald-900/40 cursor-pointer transition active:scale-95 items-center justify-center shrink-0"
            >
              {minimized ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
          )}

        </div>
      </div>

      {/* Logged user profile cards triggers within a styled container box */}
      <div className={`border-b border-emerald-900/40 text-slate-200 transition-all ${minimized ? 'p-2' : 'p-3.5'}`}>
        <div className={`flex flex-col transition-all duration-300 ${minimized ? 'items-center gap-2.5 p-1 bg-gradient-to-br from-emerald-950/30 via-zinc-950/80 to-cyan-950/40 border border-emerald-500/35 rounded-xl shadow-[0_0_10px_rgba(16,185,129,0.25)]' : 'items-stretch gap-3 p-3.5 bg-gradient-to-br from-zinc-950 via-emerald-950/30 to-cyan-950/50 border border-cyan-500/30 ring-1 ring-emerald-500/20 rounded-2xl shadow-[0_0_18px_rgba(6,182,212,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]'}`}>
          <div 
            onClick={() => setShowProfile(true)}
            title="Update Officer Profile"
            className={`flex items-center ${minimized ? 'justify-center w-9 h-9' : 'gap-3'} p-1 rounded-xl hover:bg-emerald-900/20 active:scale-95 cursor-pointer border border-transparent hover:border-emerald-500/5 transition-all duration-200 min-w-0`}
          >
            {currentUser.profilePicture ? (
              <img 
                src={currentUser.profilePicture} 
                className="h-8 w-8 rounded-full object-cover border border-emerald-400 shadow shrink-0" 
                alt="Profile" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 text-white font-extrabold flex items-center justify-center border border-emerald-400 shrink-0 text-xs text-center shadow">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            
            {!minimized && (
              <div className="truncate flex-1 min-w-0">
                <h4 className="font-bold text-white text-[11px] truncate leading-tight">{currentUser.fullName}</h4>
                <p className="text-[9.5px] text-amber-500 font-bold tracking-wider font-mono mt-0.5">{currentUser.position} Badge</p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            title="Logout"
            className={`flex items-center justify-center ${minimized ? 'h-9 w-9 p-0 rounded-xl' : 'gap-1.5 py-1.5 px-3 rounded-xl w-full'} border border-rose-900/35 text-rose-300 hover:text-white bg-rose-950/15 hover:bg-rose-950/45 hover:border-rose-700/55 transition duration-155 font-bold cursor-pointer shadow-xs`}
          >
            <LogOut className="h-3 w-3 shrink-0 animate-pulse" />
            {!minimized && <span className="text-[9.5px] uppercase tracking-wider">Logout Officer</span>}
          </button>
        </div>
      </div>

        {/* Sidebar menu items navigation rail */}
        <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[70vh] sidebar-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            
            if (item.type === 'single') {
              if (!checkAccess(item.id)) return null;
              const isActive = currentTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => { 
                    onChangeTab(item.id); 
                    if (setMobileOpen) setMobileOpen(false);
                  }}
                  title={item.label}
                  className={`w-full flex items-center ${minimized ? 'justify-center px-1' : 'justify-between px-3'} py-2.5 rounded-xl text-left transition font-semibold group cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 text-white shadow shadow-emerald-500/20' 
                      : 'hover:bg-emerald-900/20 text-slate-200 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden shrink-0 ${
                      isActive 
                        ? 'bg-gradient-to-b from-white/30 to-white/5 border border-white/40 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.45),_inset_0_-1.5px_2px_rgba(0,0,0,0.25),_0_2px_4px_rgba(0,0,0,0.2)]' 
                        : 'bg-gradient-to-b from-slate-900 to-emerald-950 border border-emerald-900/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),_inset_0_-1px_1.5px_rgba(0,0,0,0.45),_0_1.5px_2px_rgba(0,0,0,0.15)] group-hover:border-emerald-500/50 group-hover:scale-105'
                    }`}>
                      <div className={`absolute top-0 inset-x-0 h-[30%] ${isActive ? 'bg-white/20' : 'bg-white/5'}`}></div>
                      <Icon className={`h-3.5 w-3.5 relative z-10 transition-all duration-500 ${
                        isActive 
                          ? 'text-white scale-110 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.45)]' 
                          : 'text-slate-300 group-hover:text-emerald-300 group-hover:drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]'
                      }`} />
                    </div>
                    {!minimized && <span className="truncate">{item.label}</span>}
                  </div>
                  {!minimized && isActive && <ChevronRight className="h-3 w-3 text-white shrink-0" />}
                </button>
              );
            } else {
              // Group Item
              const allowedChildren = (item.children || []).filter(child => checkAccess(child.id));
              if (allowedChildren.length === 0) return null;
              
              const isGroupActive = allowedChildren.some(child => child.id === currentTab);
              const isExpanded = openGroups[item.id];
              
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.id)}
                    title={item.label}
                    className={`w-full flex items-center ${minimized ? 'justify-center px-1' : 'justify-between px-3'} py-2.5 rounded-xl text-left transition font-semibold group cursor-pointer ${
                      isGroupActive 
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40' 
                        : 'hover:bg-emerald-900/20 text-slate-200 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden shrink-0 ${
                        isGroupActive
                          ? 'bg-gradient-to-b from-white/10 to-white/5 border border-emerald-500/30' 
                          : 'bg-gradient-to-b from-slate-900 to-emerald-950 border border-emerald-900/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),_inset_0_-1px_1.5px_rgba(0,0,0,0.45),_0_1.5px_2px_rgba(0,0,0,0.15)]'
                      }`}>
                        <div className="absolute top-0 inset-x-0 h-[30%] bg-white/5"></div>
                        <Icon className={`h-3.5 w-3.5 relative z-10 transition-all duration-500 ${
                          isGroupActive ? 'text-emerald-400' : 'text-slate-300 group-hover:text-emerald-300'
                        }`} />
                      </div>
                      {!minimized && <span className="truncate">{item.label}</span>}
                    </div>
                    {!minimized && (isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    ))}
                  </button>
                  
                  {isExpanded && (
                    <div className={minimized ? 'space-y-1 py-1 flex flex-col items-center' : 'pl-4 ml-3.5 border-l border-emerald-900/35 space-y-1 py-1'}>
                      {allowedChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = currentTab === child.id;
                        
                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              onChangeTab(child.id);
                              if (setMobileOpen) setMobileOpen(false);
                            }}
                            title={child.label}
                            className={`w-full flex items-center ${minimized ? 'justify-center px-0.5 py-2 w-8 h-8 rounded-full' : 'justify-between px-2.5 py-2 rounded-lg'} text-left transition font-semibold group cursor-pointer ${
                              isChildActive
                                ? 'bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 text-white shadow shadow-emerald-500/20'
                                : 'hover:bg-emerald-900/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`h-5.5 w-5.5 rounded-md flex items-center justify-center transition-all duration-300 relative overflow-hidden shrink-0 ${
                                isChildActive
                                  ? 'bg-white/20 border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]'
                                  : 'bg-slate-900 border border-emerald-900/20 group-hover:border-emerald-500/35'
                              }`}>
                                <ChildIcon className="h-2.5 w-2.5" />
                              </div>
                              {!minimized && <span className="truncate text-[11px] font-medium">{child.label}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
          })}
        </nav>

      {/* Logged user profile cards triggers (Simplified bottom) */}
      <div className={minimized ? 'p-2 border-t border-emerald-900/40 bg-zinc-950/40 text-slate-200' : 'p-3.5 border-t border-emerald-900/40 bg-zinc-950/40 text-slate-200'}>
        <div className={`flex items-center ${minimized ? 'flex-col justify-center' : 'justify-start'} gap-2`}>
          {checkAccess('settings') && (
            <button
              onClick={() => {
                onChangeTab('settings');
                if (setMobileOpen) setMobileOpen(false);
              }}
              title="System Settings"
              className={`p-1 rounded-lg hover:bg-emerald-900/25 cursor-pointer transition shrink-0 group ${
                currentTab === 'settings' ? 'scale-105' : ''
              }`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
                currentTab === 'settings' 
                  ? 'bg-gradient-to-b from-emerald-500 to-green-600 border border-emerald-400 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.45),_inset_0_-1.5px_2px_rgba(0,0,0,0.25),_0_2px_4px_rgba(16,185,129,0.3)]' 
                  : 'bg-gradient-to-b from-slate-900 to-emerald-950 border border-emerald-900/50 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),_inset_0_-1px_1.5px_rgba(0,0,0,0.45),_0_1.5px_2px_rgba(0,0,0,0.15)] group-hover:border-emerald-500 group-hover:scale-105'
              }`}>
                {/* Skeuomorphic glossy ray reflection */}
                <div className={`absolute top-0 inset-x-0 h-[30%] ${currentTab === 'settings' ? 'bg-white/20' : 'bg-white/5'}`}></div>
                <Settings className={`h-4 w-4 relative z-10 transition-transform duration-500 ${
                  currentTab === 'settings' 
                    ? 'text-white scale-110 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.45)]' 
                    : 'text-slate-300 group-hover:text-emerald-400'
                }`} />
              </div>
            </button>
          )}

          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Clinic Facebook Page"
            className="p-1 rounded-lg hover:bg-emerald-900/20 cursor-pointer transition shrink-0 group hover:scale-105"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden bg-gradient-to-b from-slate-900 to-emerald-950 border border-emerald-900/50 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.08),_inset_0_-1px_1.5px_rgba(0,0,0,0.45),_0_1.5px_2px_rgba(0,0,0,0.15)] group-hover:border-blue-500/80">
              <div className="absolute top-0 inset-x-0 h-[30%] bg-white/5"></div>
              <Facebook className="h-4 w-4 relative z-10 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </a>
        </div>
      </div>
    </div>

      {/* USER PROFILE & SETTINGS MODAL */}
      {showProfile && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 text-xs font-sans text-slate-800">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative border">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5 border-b pb-2">
              <User className="h-5 w-5 text-blue-600" />
              Field Officer profile settings
            </h2>
            <button 
              onClick={() => setShowProfile(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
            >
              ✕
            </button>

            {/* Error notifications and outputs */}
            {passMsg && <div className="mb-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-2.5 rounded font-medium">{passMsg}</div>}
            {passErr && <div className="mb-3 bg-red-50 border-l-4 border-red-500 text-red-700 p-2.5 rounded font-medium">{passErr}</div>}

            <div className="space-y-4">
              
              {/* Box 1: Update name/address */}
              <form onSubmit={handleProfileSubmit} className="space-y-3.5 pb-4 border-b">
                {/* Profile Picture Section */}
                <div className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3 mb-2">
                  <span className="block text-slate-500 font-bold text-[9px] uppercase tracking-wider self-start">Officer Avatar Snapshot</span>
                  <div className="relative">
                    {editProfilePicture ? (
                      <img 
                        src={editProfilePicture} 
                        className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500 shadow-md" 
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 text-white font-extrabold flex items-center justify-center border-2 border-emerald-400 shrink-0 text-lg shadow-inner">
                        {editName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    {editProfilePicture && (
                      <button
                        type="button"
                        onClick={() => setEditProfilePicture('')}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center font-bold text-[9px] shadow cursor-pointer transition-colors"
                        title="Remove Avatar"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="w-full">
                    <label className="flex flex-col items-center justify-center w-full h-10 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-blue-50/50 hover:border-blue-400 transition-colors">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                        <span>📂</span>
                        <span className="font-semibold text-blue-600 text-[10px]">Upload photo file</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1.5 * 1024 * 1024) {
                              setPassErr("Image is too large. Choose under 1.5MB.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditProfilePicture(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="w-full">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1 text-center">Or pick an illustration</span>
                    <div className="flex gap-1.5 justify-center">
                      {[
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
                        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
                        'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&q=80&w=150'
                      ].map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setEditProfilePicture(preset)}
                          className={`h-6.5 w-6.5 rounded-full overflow-hidden border transition active:scale-90 cursor-pointer ${
                            editProfilePicture === preset ? 'ring-2 ring-emerald-500 border-transparent scale-105' : 'border-slate-200 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img src={preset} className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Operating Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Home address Barangay</label>
                  <select
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                  >
                    {dbBarangays.map((b, i) => (
                      <option key={i} value={b.name}>{b.name}</option>
                    ))}
                    {dbBarangays.length === 0 && (
                      <>
                        <option value="San Francisco">San Francisco</option>
                        <option value="Santa Lucia">Santa Lucia</option>
                        <option value="Tuburan">Tuburan</option>
                        <option value="Lumbia">Lumbia</option>
                        <option value="Balangasan">Balangasan</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                    placeholder="e.g., +639123456789"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-slate-900 border-b-2 border-slate-950 hover:bg-slate-950 text-white font-extrabold uppercase text-[10px] tracking-wide flex items-center justify-center p-2 rounded-xl transition w-full shadow-xs cursor-pointer active:translate-y-[1px]"
                >
                  Adjust Profile
                </button>
              </form>

              {/* Box 2: Password adjustments */}
              <form onSubmit={handlePassChange} className="space-y-3.5">
                <span className="font-bold text-red-700 block uppercase tracking-wider text-[10px]">Alter Password Credentials</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Old Password</label>
                    <input
                      type="password"
                      placeholder="••••"
                      value={oldPass}
                      onChange={(e) => setOldPass(e.target.value)}
                      className="bg-slate-50 border p-2 w-full rounded focus:outline-none placeholder-slate-400 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="•••••"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className="bg-slate-50 border p-2 w-full rounded focus:outline-none placeholder-slate-400 font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center p-1.5 rounded transition w-full"
                >
                  Confirm password Update
                </button>
              </form>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
