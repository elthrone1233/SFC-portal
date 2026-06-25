import React, { useEffect, useState } from 'react';
import { Users, Plus, Shield, User, MapPin, Search, Folder, FolderOpen, ArrowLeft } from 'lucide-react';
import { Group, User as UserType, hasRole } from '../types';

interface GroupsProps {
  currentUser: UserType;
}

export default function Groups({ currentUser }: GroupsProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [dbBarangays, setDbBarangays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [rateFilter, setRateFilter] = useState<'all' | 'under-150' | '150-or-more'>('all');
  const [popFilter, setPopFilter] = useState<'all' | 'active' | 'empty'>('all');
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'rate-desc' | 'rate-asc' | 'pop-desc' | 'pop-asc'>('name-asc');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // New Group Modal Fields
  const [showAdd, setShowAdd] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [leader, setLeader] = useState('');
  const [coLeadersChecked, setCoLeadersChecked] = useState<string[]>([]);
  const [rate, setRate] = useState('150');
  
  // Selection
  const [barangaysChecked, setBarangaysChecked] = useState<string[]>([]);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');

  const [showRenameFolder, setShowRenameFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderRenameNameInput, setFolderRenameNameInput] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  const handleAddFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput || folderNameInput.trim() === '') return;

    try {
      const res = await fetch('/api/barangays/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ name: folderNameInput.trim() })
      });

      if (res.ok) {
        setShowAddFolder(false);
        setFolderNameInput('');
        fetchBarangays();
        showFeedback('Barangay folder created successfully!', 'success');
      } else {
        const err = await res.json();
        showFeedback(err.error || 'Failed to create Barangay folder', 'error');
      }
    } catch(err) {
      console.error(err);
      showFeedback('An error occurred while creating directory.', 'error');
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderRenameNameInput || folderRenameNameInput.trim() === '' || !editingFolderId) return;

    try {
      const res = await fetch('/api/barangays/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ 
          id: editingFolderId, 
          newName: folderRenameNameInput.trim() 
        })
      });

      if (res.ok) {
        setShowRenameFolder(false);
        const newName = folderRenameNameInput.trim().toUpperCase();
        setSelectedFolder(newName);
        setEditingFolderId(null);
        setFolderRenameNameInput('');
        fetchBarangays();
        fetchGroups();
        showFeedback(`Folder renamed successfully to "${newName}"! Both Group and Payroll directories have been synced.`, 'success');
      } else {
        const err = await res.json();
        showFeedback(err.error || 'Failed to rename Barangay folder', 'error');
      }
    } catch(err) {
      console.error(err);
      showFeedback('An error occurred while renaming directory.', 'error');
    }
  };

  const handleToggleCoLeader = (name: string) => {
    if (coLeadersChecked.includes(name)) {
      setCoLeadersChecked(coLeadersChecked.filter(item => item !== name));
    } else {
      setCoLeadersChecked([...coLeadersChecked, name]);
    }
  };

  useEffect(() => {
    fetchBarangays();
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchBarangays = async () => {
    try {
      const res = await fetch('/api/barangays');
      if (res.ok) {
        const data = await res.json();
        setDbBarangays(data.barangays || []);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups?includeArchived=true', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch(e) {}
    finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/accounts', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.filter((u: any) => u.status === 'Approved'));
      }
    } catch(e) {}
  };

  const handleToggleBarangay = (b: string) => {
    if (barangaysChecked.includes(b)) {
      setBarangaysChecked(barangaysChecked.filter(item => item !== b));
    } else {
      setBarangaysChecked([...barangaysChecked, b]);
    }
  };

  const handleDeleteGroup = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeleteGroup = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch('/api/groups/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ id: deleteConfirmId })
      });

      const rawText = await res.text();
      let isJson = false;
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(rawText);
        isJson = true;
      } catch (parseErr) {
        // Handled below
      }

      const isHtmlResponse = rawText.trim().startsWith('<') || rawText.trim().toLowerCase().startsWith('<!doctype');
      if (!isJson || isHtmlResponse) {
        console.error('Non-JSON/HTML error response raw text for debugging during group deletion:', rawText);
      }

      if (res.ok) {
        setDeleteConfirmId(null);
        showFeedback('Operational group deleted successfully!', 'success');
        fetchGroups();
      } else {
        let errorMsg = 'Failed to delete operational group.';
        if (isJson && parsedData && parsedData.error) {
          errorMsg = parsedData.error;
        } else {
          // Fallback display if server returns HTML error pages: strip tags and truncate
          const cleanText = rawText.replace(/<\/?[^>]+(>|$)/g, " ").trim();
          const truncated = cleanText.length > 180 ? cleanText.substring(0, 180) + '...' : cleanText;
          errorMsg = truncated ? `Server Error: ${truncated}` : `Server returned status code ${res.status}.`;
        }
        showFeedback(errorMsg, 'error');
      }
    } catch(e: any) {
      console.error('Connection catch block error during squad deletion:', e);
      showFeedback(e.message || 'An error occurred during communication.', 'error');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !leader) return;

    try {
      const isEdit = !!editingGroupId;
      const url = isEdit ? '/api/groups/edit' : '/api/groups/add';
      const bodyPayload = isEdit ? {
        id: editingGroupId,
        name: groupName,
        leader,
        coLeaders: coLeadersChecked,
        assignedBarangays: barangaysChecked,
        ratePerPerson: parseFloat(rate) || 120
      } : {
        name: groupName,
        leader,
        coLeaders: coLeadersChecked,
        assignedBarangays: barangaysChecked,
        ratePerPerson: parseFloat(rate) || 120
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify(bodyPayload)
      });

      const rawText = await res.text();
      let isJson = false;
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(rawText);
        isJson = true;
      } catch (parseErr) {
        // Handled below
      }

      const isHtmlResponse = rawText.trim().startsWith('<') || rawText.trim().toLowerCase().startsWith('<!doctype');
      if (!isJson || isHtmlResponse) {
        console.error('Non-JSON/HTML error response raw text for debugging during group edit/add:', rawText);
      }

      if (res.ok) {
        setShowAdd(false);
        setEditingGroupId(null);
        // Reset states
        setGroupName('');
        setLeader('');
        setCoLeadersChecked([]);
        setBarangaysChecked([]);
        fetchGroups();
        showFeedback(isEdit ? 'Operational group updated successfully!' : 'Operational group created successfully!', 'success');
      } else {
        let errorMsg = 'Failed to save operational group.';
        if (isJson && parsedData && parsedData.error) {
          errorMsg = parsedData.error;
        } else {
          // Fallback display if server returns HTML error pages: strip tags and truncate
          const cleanText = rawText.replace(/<\/?[^>]+(>|$)/g, " ").trim();
          const truncated = cleanText.length > 180 ? cleanText.substring(0, 180) + '...' : cleanText;
          errorMsg = truncated ? `Server Error: ${truncated}` : `Server returned status code ${res.status}.`;
        }
        showFeedback(errorMsg, 'error');
      }
    } catch(e: any) {
      console.error('Connection catch block error during squad edit/add:', e);
      showFeedback(e.message || 'An error occurred during communication.', 'error');
    }
  };

  const getUserAssignment = (u: UserType) => {
    // Find any ACTIVE (non-archived) group/squad where this user is assigned
    const assignedGroup = groups.find(g => {
      if (g.isArchived) return false;
      if (editingGroupId && g.id === editingGroupId) return false;
      return g.leader === u.fullName || (Array.isArray(g.coLeaders) && g.coLeaders.includes(u.fullName));
    });
    return assignedGroup ? assignedGroup.name : null;
  };

  const teamLeaders = users.filter(u => {
    if (leader && u.fullName === leader) return true;
    if (u.position !== 'LEADER') return false;
    
    // Filter by the selected Barangay folder if chosen
    const selectedBarangay = barangaysChecked[0] || selectedFolder;
    if (selectedBarangay && selectedBarangay !== 'Unassigned' && selectedBarangay !== 'Archived Operational Squads') {
      if (!u.address || u.address.toLowerCase().trim() !== selectedBarangay.toLowerCase().trim()) {
        return false;
      }
    }
    return true;
  });

  const teamCoLeaders = users.filter(u => {
    if (coLeadersChecked.includes(u.fullName)) return true;
    if (u.position !== 'CO-LEADER') return false;
    
    // Filter by the selected Barangay folder if chosen
    const selectedBarangay = barangaysChecked[0] || selectedFolder;
    if (selectedBarangay && selectedBarangay !== 'Unassigned' && selectedBarangay !== 'Archived Operational Squads') {
      if (!u.address || u.address.toLowerCase().trim() !== selectedBarangay.toLowerCase().trim()) {
        return false;
      }
    }
    return true;
  });

  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  const filteredGroups = groups.filter(g => {
    // Exclude archived/soft-deleted squads from standard directory list operations
    if (g.isArchived) return false;
    const gName = g.name || '';
    const gLeader = g.leader || '';
    const query = (deferredSearchTerm || '').toLowerCase();
    const matchSearch = gName.toLowerCase().includes(query) ||
                        gLeader.toLowerCase().includes(query);
    const matchBarangay = selectedFolder ? true : (
      !barangayFilter || 
      (g.assignedBarangays || []).map((x: string) => x.toLowerCase().trim()).includes(barangayFilter.toLowerCase().trim())
    );
    
    // Rate Filter
    let matchRate = true;
    if (rateFilter === 'under-150') {
      matchRate = (g.ratePerPerson || 0) < 150;
    } else if (rateFilter === '150-or-more') {
      matchRate = (g.ratePerPerson || 0) >= 150;
    }
    
    // Population Filter
    let matchPop = true;
    const pop = g.populationCount || 0;
    if (popFilter === 'active') {
      matchPop = pop > 0;
    } else if (popFilter === 'empty') {
      matchPop = pop === 0;
    }

    return matchSearch && matchBarangay && matchRate && matchPop;
  });

  const sortedAndFilteredGroups = [...filteredGroups].sort((a, b) => {
    if (sortOrder === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortOrder === 'name-desc') {
      return b.name.localeCompare(a.name);
    }
    if (sortOrder === 'rate-desc') {
      return (b.ratePerPerson || 0) - (a.ratePerPerson || 0);
    }
    if (sortOrder === 'rate-asc') {
      return (a.ratePerPerson || 0) - (b.ratePerPerson || 0);
    }
    if (sortOrder === 'pop-desc') {
      return (b.populationCount || 0) - (a.populationCount || 0);
    }
    if (sortOrder === 'pop-asc') {
      return (a.populationCount || 0) - (b.populationCount || 0);
    }
    return 0;
  });

  const renderGroupCard = (g: any, idx: number) => (
    <div key={idx} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1">
            <Shield className="h-4 w-4 text-blue-600" />
            {g.name}
          </h3>
          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
            Rate: ₱{g.ratePerPerson}/Person Enrolled
          </span>
        </div>

        <div className="space-y-2 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100/50">
          <div className="flex items-center gap-1.5 text-slate-600">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>Leader: <strong>{g.leader}</strong></span>
          </div>
          {g.coLeaders && g.coLeaders.length > 0 && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Co-Leaders: <strong className="text-slate-500">{g.coLeaders.join(', ')}</strong></span>
            </div>
          )}
          <div className="flex items-start gap-1.5 text-slate-600 mt-1">
            <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="block text-slate-400 text-[10px]">Assigned Barangays</span>
              <strong className="text-slate-700">{g.assignedBarangays?.join(', ') || 'None assigned'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Group live indicators */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs mt-6 border-t border-slate-50 pt-4">
        <div className="p-1 px-1.5 border border-slate-100 rounded">
          <span className="text-slate-400 block text-[9px] font-medium leading-none">Households</span>
          <strong className="text-slate-800 text-sm font-bold block mt-1">{g.approvedHouseholdsCount || 0}</strong>
        </div>
        <div className="p-1 px-1.5 border border-slate-100 rounded">
          <span className="text-slate-400 block text-[9px] font-medium leading-none">Members</span>
          <strong className="text-slate-800 text-sm font-bold block mt-1">{g.approvedMembersCount || 0}</strong>
        </div>
        <div className="p-1 px-1.5 border border-slate-100 rounded">
          <span className="text-slate-400 block text-[9px] font-medium leading-none">Dependents</span>
          <strong className="text-slate-800 text-sm font-bold block mt-1">{g.approvedDependentsCount || 0}</strong>
        </div>
        <div className="p-1 px-1.5 bg-blue-50/50 border border-blue-100 rounded">
          <span className="text-blue-500 block text-[9px] font-bold leading-none">Total Pop</span>
          <strong className="text-blue-700 text-sm font-bold block mt-1">{g.populationCount || 0}</strong>
        </div>
      </div>

      {hasRole(currentUser, ['ADMIN', 'HR', 'IT', 'MANAGER']) && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingGroupId(g.id);
              setGroupName(g.name);
              setLeader(g.leader);
              setCoLeadersChecked(g.coLeaders || []);
              setRate((g.ratePerPerson || 150).toString());
              const assigned = (g.assignedBarangays || []).map(bName => {
                const found = dbBarangays.find(x => x.name.toLowerCase().trim() === bName.toLowerCase().trim());
                return found ? found.name : bName;
              });
              setBarangaysChecked(assigned);
              setShowAdd(true);
            }}
            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition text-center text-[10px] uppercase tracking-wider"
          >
            Edit Squad Profile
          </button>
          <button
            type="button"
            onClick={() => handleDeleteGroup(g.id)}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-150 text-red-650 hover:text-red-755 font-bold rounded-lg cursor-pointer transition text-[10px] uppercase tracking-wider"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 font-sans text-xs">
      
      {/* Top action controller */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
            <Users className="h-5 w-5 text-blue-600 animate-pulse" />
            Field Operational Groups
          </h2>
          <p className="text-slate-400 text-[10px] mt-1">Setup operational boundaries, allocate team rates, and track statistics</p>
        </div>
        
        {/* Removed Create Barangay Folder button as they are auto-created when registering a new Barangay */}
      </div>

      {/* Interactive Search and Filter Controls */}
      <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-slate-150 shadow-inner">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search group name or leader..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs px-2.5 py-2 pl-7.5 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
            />
          </div>
          
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-705 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[200px]"
          >
            <option value="name-asc">Sort: Alphabetical (A-Z)</option>
            <option value="name-desc">Sort: Alphabetical (Z-A)</option>
            <option value="rate-desc">Sort: Rate (Highest First)</option>
            <option value="rate-asc">Sort: Rate (Lowest First)</option>
            <option value="pop-desc">Sort: Population (Highest First)</option>
            <option value="pop-asc">Sort: Population (Lowest First)</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 pt-1.5 border-t border-slate-100 items-center text-[11px] text-slate-500">
          <span className="font-semibold text-slate-400 mr-1">Filters:</span>
          
          <select
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-[11px] px-2.5 py-1.5 rounded-lg text-slate-705 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Barangays</option>
            {Array.from(new Set(groups.flatMap(g => g.assignedBarangays || []))).map((b, i) => (
              <option key={i} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={rateFilter}
            onChange={(e) => setRateFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-[11px] px-2.5 py-1.5 rounded-lg text-slate-705 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Payment Rates</option>
            <option value="under-150">Below ₱150/Person</option>
            <option value="150-or-more">₱150 or Higher</option>
          </select>

          <select
            value={popFilter}
            onChange={(e) => setPopFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-[11px] px-2.5 py-1.5 rounded-lg text-slate-705 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Population Statuses</option>
            <option value="active">Active (Has Members)</option>
            <option value="empty">Empty (0 Members)</option>
          </select>

          {(barangayFilter || rateFilter !== 'all' || popFilter !== 'all' || searchTerm) && (
            <button
               type="button"
               onClick={() => {
                 setBarangayFilter('');
                 setRateFilter('all');
                 setPopFilter('all');
                 setSearchTerm('');
               }}
               className="text-[10px] text-red-650 hover:text-red-755 hover:underline font-bold transition ml-auto cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
        </div>
      ) : (
        (() => {          // Split into active and archived groups
          const activeGroups = groups.filter(g => !g.isArchived);
          const archivedGroups = groups.filter(g => g.isArchived);

          // Dynamic calculation of directories
          const folderNamesMap = new Map<string, string>();
          // Add from dbBarangays first to preserve original config casing
          dbBarangays.forEach(b => {
            if (b.name && b.name.trim()) {
              const nameTrimmed = b.name.trim();
              folderNamesMap.set(nameTrimmed.toLowerCase(), nameTrimmed);
            }
          });
          // Add remaining assignedBarangays from groups
          activeGroups.flatMap(g => g.assignedBarangays || []).forEach(b => {
            if (b && b.trim()) {
              const nameTrimmed = b.trim();
              const key = nameTrimmed.toLowerCase();
              if (key !== 'unassigned' && !folderNamesMap.has(key)) {
                folderNamesMap.set(key, nameTrimmed);
              }
            }
          });
          const allFolders = Array.from(folderNamesMap.values()).sort((a, b) => a.localeCompare(b));

          const getGroupsInFolder = (fName: string) => {
            const target = fName.toLowerCase().trim();
            return sortedAndFilteredGroups.filter(g => {
              const assigned = (g.assignedBarangays || []).map((b: string) => b.toLowerCase().trim());
              return assigned.includes(target);
            });
          };

          // If a search is input by the user, we display a global flat view to search easily
          if (searchTerm.trim() !== '') {
            return (
              <div className="space-y-3 animate-fade-in animate-scale-up">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2.5 rounded-lg text-blue-800 text-[11px] font-semibold">
                  <span>Searching for "{searchTerm}" across all directory folders:</span>
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedAndFilteredGroups.map((g, idx) => renderGroupCard(g, idx))}
                </div>
                {sortedAndFilteredGroups.length === 0 && (
                  <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                    No field operational groups match your search criteria.
                  </div>
                )}
              </div>
            );
          }

          // If a specific folder has been selected by clicking
          if (selectedFolder !== null) {
            const isArchivedFolder = selectedFolder === 'Archived Operational Squads';
            const folderGroups = isArchivedFolder ? archivedGroups : getGroupsInFolder(selectedFolder);
            return (
              <div className="space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFolder(null)}
                      className="p-1.5 px-3 bg-white hover:bg-slate-200 text-slate-705 font-bold rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to folders
                    </button>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                      <FolderOpen className={isArchivedFolder ? "h-4 w-4 text-rose-600 animate-pulse" : "h-4 w-4 text-emerald-600 animate-pulse"} />
                      <span>{isArchivedFolder ? 'Trash Bin & Archive' : 'Barangays Directory'}</span>
                      <span className="text-slate-400 font-normal">/</span>
                      <span className={isArchivedFolder ? "text-rose-800 uppercase font-extrabold" : "text-blue-800 uppercase font-extrabold"}>{selectedFolder}</span>
                    </div>

                    {!isArchivedFolder && hasRole(currentUser, ['ADMIN', 'HR', 'IT', 'MANAGER']) && selectedFolder !== 'Unassigned' && (
                      <button
                        onClick={() => {
                          const originalFolder = dbBarangays.find(b => b.name === selectedFolder);
                          if (originalFolder) {
                            setEditingFolderId(originalFolder.id);
                            setFolderRenameNameInput(originalFolder.name);
                            setShowRenameFolder(true);
                          } else {
                            showFeedback('Folder details not found or cannot be modified.', 'error');
                          }
                        }}
                        className="bg-white hover:bg-slate-50 border text-slate-600 font-extrabold px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs hover:border-slate-300 transition"
                        title="Rename Group and Payroll Folder"
                      >
                        ✏️ Rename Folder
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span className={`px-2.5 py-1 ${isArchivedFolder ? 'bg-rose-850' : 'bg-slate-800'} text-white font-bold rounded-full text-[10px] font-mono tracking-wide`}>
                      {folderGroups.length} {folderGroups.length === 1 ? 'Squad' : 'Squads'} {isArchivedFolder ? 'Soft-Deleted' : 'Active'}
                    </span>

                    {!isArchivedFolder && hasRole(currentUser, ['ADMIN', 'HR', 'IT', 'MANAGER']) && (
                      <button 
                        onClick={() => {
                          setEditingGroupId(null);
                          setGroupName('');
                          setLeader('');
                          setCoLeadersChecked([]);
                          setRate('150');
                          const folderToUse = selectedFolder || '';
                          const matchedFolder = dbBarangays.find(b => b.name.toLowerCase().trim() === folderToUse.toLowerCase().trim());
                          const canonicalFolder = matchedFolder ? matchedFolder.name : folderToUse;
                          setBarangaysChecked(canonicalFolder && canonicalFolder !== 'Unassigned' ? [canonicalFolder] : []);
                          setShowAdd(true);
                        }}
                        className="btn-3d-primary text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition uppercase tracking-wider shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" /> CREATE GROUP
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {folderGroups.map((g, idx) => {
                    if (isArchivedFolder) {
                      return (
                        <div key={idx} className="bg-rose-50/10 rounded-xl p-5 border border-dashed border-rose-200 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-bold text-rose-900 text-xs uppercase leading-tight flex items-center gap-1">
                                <Shield className="h-4 w-4 text-rose-600" />
                                {g.name}
                              </h3>
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-850 font-bold rounded text-[8px] uppercase tracking-wider">
                                Soft-Deleted / Recoverable
                              </span>
                            </div>

                            <div className="space-y-2 mt-4 bg-white/60 p-3 rounded-lg border border-rose-100">
                              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                <User className="h-3.5 w-3.5 text-rose-450" />
                                <span>Squad Leader: <strong className="text-slate-800">{g.leader || 'Unassigned'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                <Users className="h-3.5 w-3.5 text-rose-450" />
                                <span>Co-Leaders: <strong className="text-slate-800">{Array.isArray(g.coLeaders) && g.coLeaders.length > 0 ? g.coLeaders.join(', ') : 'None'}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                <MapPin className="h-3.5 w-3.5 text-rose-455" />
                                <span>Designations: <strong className="text-slate-800 uppercase">{Array.isArray(g.assignedBarangays) && g.assignedBarangays.length > 0 ? g.assignedBarangays.join(', ') : 'None'}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end border-t border-rose-100 pt-3 mt-4">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/groups/restore', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Accept': 'application/json',
                                      'x-user-email': currentUser.email
                                    },
                                    body: JSON.stringify({ id: g.id })
                                  });
                                  if (res.ok) {
                                    showFeedback(`Successfully restored operational squad "${g.name}"!`, 'success');
                                    fetchGroups();
                                    fetchUsers();
                                  } else {
                                    const err = await res.json();
                                    showFeedback(err.error || 'Failed to restore operational squad', 'error');
                                  }
                                } catch (err: any) {
                                  showFeedback(err.message, 'error');
                                }
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer shadow hover:-translate-y-[1px] transition"
                            >
                              🔄 RESTORE SQUAD PROFILE
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return renderGroupCard(g, idx);
                  })}
                </div>

                {folderGroups.length === 0 && (
                  <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed font-medium text-xs">
                    {isArchivedFolder ? 'No soft-deleted squads currently inside the bin.' : `No operational group/squad matches the filter properties inside ${selectedFolder}.`}
                  </div>
                )}

                {/* REGISTERED BARANGAY ACCOUNTS LIST - Based on Barangay Home Address boundary */}
                {!isArchivedFolder && selectedFolder !== 'Unassigned' && (
                  <div className="mt-8 pt-6 border-t border-slate-105">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 leading-none">
                          <Users className="h-4.5 w-4.5 text-blue-600 animate-pulse" />
                          Registered Barangay Operators & Personnel
                        </h3>
                        <p className="text-slate-400 text-[10px] mt-1">Personnel accounts whose home assignment boundary is set to {selectedFolder}</p>
                      </div>
                      <span className="bg-blue-50 text-blue-700 font-mono font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                        {users.filter(u => u.address && u.address.toLowerCase().trim() === selectedFolder.toLowerCase().trim()).length} Members
                      </span>
                    </div>

                    {users.filter(u => u.address && u.address.toLowerCase().trim() === selectedFolder.toLowerCase().trim()).length === 0 ? (
                      <div className="text-center py-8 text-slate-400 bg-slate-50/30 rounded-xl border border-dashed text-xs">
                        No assigned system personnel/operators listed for this Barangay home address boundary.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.filter(u => u.address && u.address.toLowerCase().trim() === selectedFolder.toLowerCase().trim()).map((u, oIdx) => {
                          const initials = u.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                          return (
                            <div key={oIdx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-3 shadow-2xs hover:shadow-sm transition">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-105 text-blue-700 flex items-center justify-center font-extrabold text-xs flex-shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <span className="block font-bold text-slate-800 text-xs truncate leading-tight">{u.fullName}</span>
                                  <span className="block text-[10px] uppercase font-bold text-blue-600 mt-1">{u.position || 'OPERATOR'}</span>
                                  <span className="block text-slate-400 text-[9px] truncate">{u.email}</span>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono flex-shrink-0 ${u.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'bg-amber-50 text-amber-600 border border-amber-150'}`}>
                                {u.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Default view: Manila folders structure representation
          return (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50 border p-3 rounded-xl flex items-center gap-2 text-slate-600 font-medium text-[11px]">
                <Folder className="h-4 w-4 text-emerald-600 animate-bounce" />
                <span>Double-click or click any Barangay directory folder below to explore designated squads:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {allFolders.map((f) => {
                  const squads = getGroupsInFolder(f);
                  return (
                    <div 
                      key={f}
                      onClick={() => setSelectedFolder(f)}
                      className="group flex flex-col items-center justify-between p-4 bg-white hover:bg-emerald-50/10 border border-slate-150/60 rounded-2xl cursor-pointer hover:shadow-md hover:border-emerald-250 transition duration-200 text-center relative"
                    >
                      {/* Stylized Folder Graphic at Top */}
                      <div className="relative w-16 h-12 my-2 flex items-center justify-center">
                        {/* Tab Background */}
                        <div className="absolute top-0 left-1 w-6 h-2 bg-emerald-600 rounded-t-sm group-hover:bg-yellow-500 transition-colors"></div>
                        {/* Folder front pocket / cardboard backing */}
                        <div className="absolute bottom-0 left-0 w-full h-10 bg-emerald-500 rounded-md shadow-2xs group-hover:bg-yellow-400 transition-colors border-t border-emerald-400 group-hover:border-yellow-300">
                          {/* Inner badge of squad/team count inside the folder */}
                          <div className="absolute top-1 right-1 px-1.5 bg-white/95 text-emerald-900 border border-emerald-200 text-[8px] font-mono font-bold rounded-sm leading-none flex items-center justify-center scale-90">
                            {squads.length}
                          </div>
                        </div>
                      </div>

                      {/* Folder Label/Name Bellow the Folder visual representation */}
                      <div className="mt-2 w-full text-center">
                        <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-emerald-700 transition">
                          {f}
                        </span>
                        <div className="text-[9px] text-slate-400 font-bold font-mono mt-0.5 uppercase">
                          {squads.length} {squads.length === 1 ? 'Squad' : 'Squads'}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* TRASH / SOFT-DELETED SQUADS FOLDER REPRESENTATIVE (ADMIN VISUAL ONLY) */}
                {hasRole(currentUser, ['ADMIN', 'HR', 'IT', 'MANAGER']) && archivedGroups.length > 0 && (
                  <div 
                    onClick={() => setSelectedFolder('Archived Operational Squads')}
                    className="group flex flex-col items-center justify-between p-4 bg-rose-50/10 hover:bg-rose-50/25 border border-dashed border-rose-250 rounded-2xl cursor-pointer hover:shadow-md hover:border-rose-450 transition duration-200 text-center relative"
                  >
                    {/* Stylized Folder Graphic at Top */}
                    <div className="relative w-16 h-12 my-2 flex items-center justify-center">
                      {/* Tab Background */}
                      <div className="absolute top-0 left-1 w-6 h-2 bg-rose-600 rounded-t-sm group-hover:bg-red-400 transition-colors"></div>
                      {/* Folder front pocket / cardboard backing */}
                      <div className="absolute bottom-0 left-0 w-full h-10 bg-rose-500 rounded-md shadow-2xs group-hover:bg-red-350 transition-colors border-t border-rose-400 group-hover:border-red-300">
                        {/* Inner badge of count */}
                        <div className="absolute top-1 right-1 px-1.5 bg-white/95 text-rose-950 border border-rose-200 text-[8px] font-mono font-bold rounded-sm leading-none flex items-center justify-center scale-90 animate-pulse">
                          {archivedGroups.length}
                        </div>
                      </div>
                    </div>

                    {/* Folder Label */}
                    <div className="mt-2 w-full text-center">
                      <span className="font-extrabold text-rose-800 text-[11px] uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-rose-950 transition">
                        Archived Squads
                      </span>
                      <div className="text-[9px] text-rose-400 font-bold font-mono mt-0.5 uppercase">
                        {archivedGroups.length} {archivedGroups.length === 1 ? 'Squad' : 'Squads'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* CREATE GROUP MODAL */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 font-sans text-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-fade-in">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5 animate-pulse">
              <Users className="h-5 w-5 text-blue-600" />
              {editingGroupId ? 'Edit Operation Squad Profile' : 'Create Operation Squad Profile'}
            </h2>
            <button 
              onClick={() => setShowAdd(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
            >
              ✕
            </button>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Group Operational Name</label>
                <input
                  type="text"
                  placeholder="e.g. Team Gamma Pagadian"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="bg-slate-50 border p-2 w-full rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Squad Leader</label>
                  <select
                    value={leader}
                    onChange={(e) => setLeader(e.target.value)}
                    className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                    required
                  >
                    <option value="">Select LEADER</option>
                    {teamLeaders.map((u, i) => {
                      const assignedSquad = getUserAssignment(u);
                      return (
                        <option key={i} value={u.fullName} disabled={!!assignedSquad}>
                          {u.fullName}{assignedSquad ? ` (Assigned to ${assignedSquad})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Squad Co-Leaders (Selection)</label>
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !coLeadersChecked.includes(val)) {
                        setCoLeadersChecked([...coLeadersChecked, val]);
                      }
                      e.target.value = ''; // reset selection
                    }}
                    className="bg-slate-55 border p-2 w-full rounded focus:outline-none text-xs"
                  >
                    <option value="">-- Add Co-Leader from Database --</option>
                    {teamCoLeaders
                      .filter(u => !coLeadersChecked.includes(u.fullName))
                      .map((u, i) => {
                        const assignedSquad = getUserAssignment(u);
                        return (
                          <option key={i} value={u.fullName} disabled={!!assignedSquad}>
                            {u.fullName}{assignedSquad ? ` (Assigned to ${assignedSquad})` : ''}
                          </option>
                        );
                    })}
                  </select>

                  {/* Selected badges list representing database records */}
                  <div className="flex flex-wrap gap-1 mt-1.5 min-h-[1.75rem] p-1 bg-slate-50 border border-slate-150 rounded items-center">
                    {coLeadersChecked.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                        {name}
                        <button
                          type="button"
                          onClick={() => setCoLeadersChecked(coLeadersChecked.filter(n => n !== name))}
                          className="hover:text-red-500 font-extrabold cursor-pointer ml-0.5 focus:outline-none text-[11px]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {coLeadersChecked.length === 0 && (
                      <span className="text-[9px] text-slate-400 italic pl-1">No Co-Leaders selected</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Payment Ratio (₱ per person)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-600 font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="bg-slate-50 border p-2 pl-7.5 w-full rounded focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Selected Folder selection */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Target Folder (Designated Barangay)</label>
                <select
                  value={(() => {
                    const currentVal = barangaysChecked[0] || '';
                    if (!currentVal) return '';
                    const match = dbBarangays.find(b => b.name.toLowerCase().trim() === currentVal.toLowerCase().trim());
                    return match ? match.name : currentVal;
                  })()}
                  onChange={(e) => {
                    const val = e.target.value;
                    const match = dbBarangays.find(b => b.name.toLowerCase().trim() === (val || '').toLowerCase().trim());
                    const canonicalName = match ? match.name : val;
                    setBarangaysChecked(canonicalName ? [canonicalName] : []);
                  }}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                  required
                >
                  <option value="">-- Select Folder --</option>
                  {dbBarangays.map((b, i) => (
                    <option key={i} value={b.name}>{b.name} Barangay Folder</option>
                  ))}
                </select>
                {dbBarangays.length === 0 && (
                  <p className="text-red-500 font-bold text-[9px] mt-1">
                    ⚠️ No folders available. Click "Create Barangay Folder" first!
                  </p>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAdd(false);
                    setEditingGroupId(null);
                    setGroupName('');
                    setLeader('');
                    setCoLeadersChecked([]);
                    setBarangaysChecked([]);
                  }}
                  className="flex-1 py-2 btn-3d-secondary font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 btn-3d-primary btn-pulse-save font-extrabold text-[11px] uppercase tracking-wider text-center cursor-pointer"
                >
                  Save Group
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {showAddFolder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10020] p-4 font-sans text-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-fade-in font-sans">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5">
              <Folder className="h-5 w-5 text-amber-500" />
              Create Barangay Folder
            </h2>
            <button 
              onClick={() => {
                setShowAddFolder(false);
                setFolderNameInput('');
              }}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
              type="button"
            >
              ✕
            </button>

            <form onSubmit={handleAddFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-[11px]">Barangay Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  className="bg-slate-55 border border-slate-200 p-2.5 w-full rounded focus:ring-1 focus:ring-blue-500 focus:outline-none uppercase font-black tracking-tight"
                  maxLength={100}
                  required
                />
                <p className="text-slate-400 text-[10px] mt-1.5 leading-relaxed font-medium">
                  Creating this folder registers a designated Barangay folder in both Field Operational Groups and the Payroll page directories list.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddFolder(false);
                    setFolderNameInput('');
                  }}
                  className="flex-1 py-2 btn-3d-secondary font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider text-center cursor-pointer rounded-lg shadow-md hover:-translate-y-[1px] transition duration-150"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME FOLDER MODAL */}
      {showRenameFolder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10020] p-4 font-sans text-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative animate-fade-in font-sans">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5">
              <Folder className="h-5 w-5 text-blue-600" />
              Rename Barangay Folder
            </h2>
            <button 
              onClick={() => {
                setShowRenameFolder(false);
                setEditingFolderId(null);
                setFolderRenameNameInput('');
              }}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
              type="button"
            >
              ✕
            </button>

            <form onSubmit={handleRenameFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-[11px]">New Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. SAN ROQUE"
                  value={folderRenameNameInput}
                  onChange={(e) => setFolderRenameNameInput(e.target.value)}
                  className="bg-slate-55 border border-slate-200 p-2.5 w-full rounded focus:ring-1 focus:ring-blue-500 focus:outline-none uppercase font-black tracking-tight"
                  maxLength={100}
                  required
                />
                <p className="text-slate-400 text-[10px] mt-1.5 leading-relaxed font-semibold text-rose-600">
                  ⚠️ WARNING: This will automatically update all associated Puroks, Households, Operational Groups and Payroll records in the database to use the new name.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowRenameFolder(false);
                    setEditingFolderId(null);
                    setFolderRenameNameInput('');
                  }}
                  className="flex-1 py-1.5 btn-3d-secondary font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-1.5 bg-blue-650 hover:bg-blue-750 active:bg-blue-800 text-white font-extrabold text-[10px] uppercase tracking-wider text-center cursor-pointer rounded-lg shadow-md hover:-translate-y-[1px] transition duration-150"
                >
                  Rename Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BEAUTIFUL STATE-GUIDED FEEDBACK TOAST BANNER */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm animate-fade-in">
          <div className={`p-4 rounded-xl shadow-xl flex items-center gap-3 border ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
              : 'bg-rose-50 border-rose-250 text-rose-800'
          }`}>
            <span className="text-base">{feedbackMsg.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-extrabold text-[11px] uppercase tracking-wide">{feedbackMsg.text}</span>
          </div>
        </div>
      )}

      {/* CUSTOM DESIGN DELETION CONFIRMATION DIALOG MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10030] p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative border border-slate-100">
            <h3 className="text-sm font-black text-rose-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              ⚠️ Confirm Destructive Deletion
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed mb-5 font-semibold">
              Are you sure you want to delete this Operational Group/Squad? This action cannot be easily undone and will clear and clean up active group assignments.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer"
              >
                No, Keep Squad
              </button>
              <button
                type="button"
                onClick={executeDeleteGroup}
                className="flex-1 py-2 bg-red-650 hover:bg-red-755 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-md shadow-red-200"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
