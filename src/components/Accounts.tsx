import React, { useEffect, useState } from 'react';
import { UserCheck, Edit, Trash2, XCircle, Shield, Mail, Map, Users, AlertTriangle, CheckCircle2, Search, Eye, EyeOff } from 'lucide-react';
import { User, Barangay, hasRole } from '../types';

interface AccountsProps {
  currentUser: User;
}

export default function Accounts({ currentUser }: AccountsProps) {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);

  // Master Admin status check
  const isMasterAdmin = !!(currentUser.email && ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email.toLowerCase()));
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [addressFilter, setAddressFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit states
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editPosition, setEditPosition] = useState<any>('LEADER');
  const [editAddress, setEditAddress] = useState('San Francisco');
  const [editGroup, setEditGroup] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<any>('Approved');

  const isRoleSelected = (roleKey: string) => {
    const roles = editPosition ? String(editPosition).split(',').map((r: string) => r.trim()) : [];
    return roles.includes(roleKey);
  };

  const toggleRole = (roleKey: string) => {
    const roles = editPosition ? String(editPosition).split(',').map((r: string) => r.trim()).filter(Boolean) : [];
    let newRoles;
    if (roles.includes(roleKey)) {
      newRoles = roles.filter((r: string) => r !== roleKey);
    } else {
      newRoles = [...roles, roleKey];
    }
    setEditPosition(newRoles.join(', '));
  };

  // Custom High-Design Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchGroups();
    fetchBarangays();
  }, []);

  const fetchBarangays = async () => {
    try {
      const res = await fetch('/api/barangays');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.barangays || []);
        setBarangays(list);
      }
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/accounts', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch(e) {}
    finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch(e) {}
  };

  const handleStatusAction = async (userId: string, action: 'Approve' | 'Disable' | 'Enable') => {
    try {
      const res = await fetch('/api/accounts/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ userId, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      fetchUsers();
      setAlertModal({
        isOpen: true,
        title: 'Account Status Transited',
        description: `Personnel registry status has been successfully updated as: ${action}d!`,
        type: 'success'
      });
    } catch(err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Operation Disallowed',
        description: err.message || 'Permission denied. Restricted to Clinical Administrative accounts.',
        type: 'error'
      });
    }
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditFullName(user.fullName || '');
    setEditPosition(user.position || 'LEADER');
    setEditAddress(user.address || 'San Francisco');
    setEditGroup(user.groupAssigned || null);
    setEditStatus(user.status || 'Approved');
    setEditContactNumber((user as any).contactNumber || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await fetch('/api/accounts/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: editFullName,
          position: editPosition,
          address: editAddress,
          groupAssigned: editGroup,
          status: editStatus,
          contactNumber: editContactNumber
        })
      });

      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
        setAlertModal({
          isOpen: true,
          title: 'Profile Updated Correctly',
          description: 'The operator details have been successfully saved to the active directory registry.',
          type: 'success'
        });
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Revision Error',
          description: err.error || 'Failed to apply registration modifications.',
          type: 'error'
        });
      }
    } catch(e) {
      setAlertModal({
        isOpen: true,
        title: 'Network Handshake Error',
        description: 'Failed to communicate with Saint Francis Database to update account.',
        type: 'error'
      });
    }
  };

  const handleDeleteUser = (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke Access & Delete Account",
      description: "Are you absolutely sure you want to permanently delete this team account? This will revoke all credentials, clear active session variables, and lock the operator out of Saint Francis Clinic databases. This action cannot be undone!",
      onConfirm: async () => {
        try {
          const res = await fetch('/api/accounts/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ userId })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          setConfirmModal(null);
          fetchUsers();
          setAlertModal({
            isOpen: true,
            title: 'Operator Expunged',
            description: 'The user profile has been successfully expunged from the Clinic Database directory.',
            type: 'success'
          });
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Removal Blocked',
            description: err.message || 'Permission denied. Restricted to Admin operators.',
            type: 'error'
          });
        }
      }
    });
  };

  const filteredUsers = usersList.filter((user) => {
    const nameStr = user.fullName || '';
    const emailStr = user.email || '';
    const contactStr = (user as any).contactNumber || '';
    const posStr = user.position || '';
    const addrStr = user.address || '';
    const query = searchTerm.trim().toLowerCase();
    
    const matchSearch = !query || 
      nameStr.toLowerCase().includes(query) ||
      emailStr.toLowerCase().includes(query) ||
      contactStr.toLowerCase().includes(query) ||
      posStr.toLowerCase().includes(query) ||
      addrStr.toLowerCase().includes(query);
      
    const matchRole = roleFilter === 'all' || hasRole(user, roleFilter);
    const matchAddress = addressFilter === 'all' || user.address === addressFilter;
    const matchStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchSearch && matchRole && matchAddress && matchStatus;
  });

  return (
    <div className="space-y-4 font-sans text-xs">
      
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
          <Shield className="h-5 w-5 text-blue-600" />
          Roster of Assigned Operators
        </h2>
        <p className="text-slate-400 text-[10px] mt-1">Review team registrations, edit security roles, approve access codes</p>
      </div>

      {/* Search and Filters Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search operators by name, email, role, or address..."
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-xs font-semibold"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-450 hover:text-slate-650 cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 md:w-auto md:flex md:items-center">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="ADMIN">Clinical Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="IT">IT Support</option>
              <option value="HR">HR Team</option>
              <option value="LEADER">Field Leader</option>
              <option value="CO-LEADER">Field Co-Leader</option>
            </select>

            {/* Barangay Filter */}
            <select
              value={addressFilter}
              onChange={(e) => setAddressFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Barangays</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
              {barangays.length === 0 && (
                <>
                  <option value="San Francisco">San Francisco</option>
                  <option value="Santa Lucia">Santa Lucia</option>
                  <option value="Tuburan">Tuburan</option>
                  <option value="Lumbia">Lumbia</option>
                  <option value="Balangasan">Balangasan</option>
                </>
              )}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending Approval">Pending</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 h-10 uppercase text-[10px] font-semibold text-slate-500">
                <th className="py-2 pl-4">Full operating Name</th>
                <th className="py-2">Email login</th>
                {isMasterAdmin && <th className="py-2">Password</th>}
                <th className="py-2">Residential Area</th>
                <th className="py-2">System Position</th>
                <th className="py-2">Assigned group</th>
                <th className="py-2">System Access Status</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isMasterAdmin ? 8 : 7} className="text-center py-8 text-slate-400 font-semibold text-xs bg-slate-50/20">
                    No operating personnel match your search or filter specifications.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 pl-4 font-bold text-slate-800 text-xs">
                      {user.fullName}
                      {user.id === currentUser.id && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1 py-0.5 rounded ml-1">You</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-slate-500">{user.email}</td>
                    {isMasterAdmin && (
                      <td className="py-3 font-mono text-slate-500">
                        <div className="flex items-center gap-1.5 min-w-[125px]">
                          <span className="font-semibold text-slate-700 text-xs">
                            {visiblePasswords[user.id] ? (user.password || 'N/A') : '••••••••'}
                          </span>
                          {user.password ? (
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 hover:bg-slate-100 rounded cursor-pointer transition"
                              title={visiblePasswords[user.id] ? 'Hide Password' : 'Show Password'}
                            >
                              {visiblePasswords[user.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">(unspecified)</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-3 font-semibold text-slate-600">{user.address}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-bold font-mono rounded">
                        {user.position}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-500">
                      {(() => {
                        const matched = groups.filter(g => {
                          const isLeader = g.leader === user.fullName;
                          const isCoLeader = Array.isArray(g.coLeaders) && g.coLeaders.includes(user.fullName);
                          return isLeader || isCoLeader;
                        });
                        if (matched.length > 0) {
                          return matched.map(g => g.name).join(', ');
                        }
                        const direct = groups.find(g => g.id === user.groupAssigned || g.name === user.groupAssigned);
                        return direct ? direct.name : 'Not assigned';
                      })()}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                        user.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                        user.status === 'Disabled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        
                        {/* Approve Button for pending accounts */}
                        {user.status === 'Pending Approval' && (
                          <button
                            onClick={() => {
                              handleOpenEdit(user);
                              setEditStatus('Approved');
                            }}
                            className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded transition"
                          >
                            Approve Staff
                          </button>
                        )}

                        {/* Disable Active Account buttons */}
                        {user.status === 'Approved' && user.id !== currentUser.id && (
                          <button
                            onClick={() => handleStatusAction(user.id, 'Disable')}
                            className="text-amber-600 hover:text-amber-800 font-semibold text-[10px]"
                          >
                            Disable account
                          </button>
                        )}

                        {/* Enable Disabled Account */}
                        {user.status === 'Disabled' && (
                          <button
                            onClick={() => handleStatusAction(user.id, 'Enable')}
                            className="text-emerald-600 hover:text-emerald-800 font-semibold"
                          >
                            Re-Enable
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        {['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email) && user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL DIALOG POPUP */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative border">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5 border-b pb-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Adjust Operator Parameters
            </h2>
            <button 
              onClick={() => setEditingUser(null)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
            >
              ✕
            </button>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Full operating Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Number</label>
                <input
                  type="text"
                  placeholder="e.g., 09123456789"
                  value={editContactNumber}
                  onChange={(e) => setEditContactNumber(e.target.value)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5 border border-slate-150 p-3 rounded-xl bg-slate-50/40">
                  <span className="block text-slate-700 font-bold mb-1 text-[11px]">
                    System Security Positions / Account Access Designation <span className="text-[10px] text-slate-400 font-normal">(Select multiple)</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'ADMIN', label: 'Clinical Admin' },
                      { key: 'MANAGER', label: 'Manager' },
                      { key: 'HR', label: 'HR Team' },
                      { key: 'IT', label: 'IT Support' },
                      { key: 'LEADER', label: 'Field Leader' },
                      { key: 'CO-LEADER', label: 'Field Co-Leader' },
                    ].map((role) => {
                      const isSelected = isRoleSelected(role.key);
                      const isDisabled = !hasRole(currentUser, ['ADMIN', 'MANAGER']);
                      return (
                        <label 
                          key={role.key} 
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-[11px] font-semibold select-none ${
                            isSelected 
                              ? 'bg-blue-50 border-blue-250 text-blue-800' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-650'
                          } ${isDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => toggleRole(role.key)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span>{role.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Home Barangay</label>
                  <select
                    value={editAddress}
                    disabled={!hasRole(currentUser, ['ADMIN', 'MANAGER'])}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className={`border p-2 w-full rounded focus:outline-none text-xs transition-all ${
                      !hasRole(currentUser, ['ADMIN', 'MANAGER'])
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 shadow-inner' 
                        : 'bg-slate-50 text-slate-900 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {barangays.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                    {barangays.length === 0 && (
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
              </div>

              {!hasRole(currentUser, ['ADMIN', 'MANAGER']) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded text-[10px] leading-tight">
                  ℹ️ Only Clinical Admins and Managers can assign or alter "System Position" roles and "Home Barangay" boundaries.
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Assign operating group</label>
                <select
                  value={editGroup || ''}
                  onChange={(e) => setEditGroup(e.target.value || null)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                >
                  <option value="">Not Assigned To Any Group</option>
                  {groups.map((g, i) => (
                    <option key={i} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Login Status permissions</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                >
                  <option value="Approved">Approved / Active Access</option>
                  <option value="Disabled">Disabled / Revoked</option>
                  <option value="Pending Approval">Pending Approval Queue</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 btn-3d-secondary font-bold text-xs cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 btn-3d-primary btn-pulse-save font-extrabold text-xs cursor-pointer uppercase tracking-wider text-center"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* HIGH-DESIGN CUSTOM CONFIRMATION POPUP MODAL */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop blur with dark glossiness */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setConfirmModal(null)}
          ></div>
          
          {/* Main Modal Card frame */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative max-w-md w-full overflow-hidden transform transition-all scale-100 duration-300 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <span className="p-3 bg-red-50 text-red-600 rounded-2xl shadow-sm border border-red-100 mt-1 block">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </span>
              <div className="space-y-1 text-left">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmModal.title}
                </h3>
                <span className="text-[10px] font-bold text-red-650 uppercase bg-red-50 border border-red-100 px-2.5 py-0.5 rounded tracking-wider">
                  Critical Action Required
                </span>
                <p className="text-slate-500 text-xs leading-relaxed pt-2">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            {/* Custom High Design hover-effect Buttons list */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all duration-200 hover:shadow-sm"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-red-200/50 hover:shadow-red-300/80 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CENTERING ALERT POPUP MODAL */}
      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setAlertModal(null)}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-sm w-full overflow-hidden p-6 space-y-4 text-center z-[10001] animate-fade-in animate-scale-up">
            <div className="flex flex-col items-center gap-3 text-center">
              {alertModal.type === 'success' ? (
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 block">
                  <CheckCircle2 className="h-8 w-8 animate-bounce" />
                </span>
              ) : (
                <span className="p-3 bg-rose-50 text-rose-650 rounded-full border border-rose-100 block">
                  <XCircle className="h-8 w-8 animate-pulse" />
                </span>
              )}
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{alertModal.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{alertModal.description}</p>
            </div>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-850 hover:shadow-md transition duration-150 cursor-pointer text-xs uppercase tracking-wide font-sans text-center"
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
