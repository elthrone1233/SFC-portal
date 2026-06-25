import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Calendar, Filter, Printer, Download, Search,
  Users, Home, UserCheck, ShieldAlert, FileText, HeartPulse, Sparkles, MapPin
} from 'lucide-react';
import { User as UserType, hasRole } from '../types';

interface DailyAccomplishmentProps {
  currentUser: UserType;
  sharedBarangay: string;
  setSharedBarangay: (b: string) => void;
  sharedCampaignDate: string;
  setSharedCampaignDate: (d: string) => void;
}

export default function DailyAccomplishment({
  currentUser,
  sharedBarangay,
  setSharedBarangay,
  sharedCampaignDate,
  setSharedCampaignDate
}: DailyAccomplishmentProps) {
  // Filters state
  const [filterType, setFilterType] = useState<'single' | 'range'>('single');
  const [startDate, setStartDate] = useState<string>(sharedCampaignDate);
  const [endDate, setEndDate] = useState<string>(sharedCampaignDate);
  const [selectedPosition, setSelectedPosition] = useState<string>('All');
  const [selectedBarangay, setSelectedBarangay] = useState<string>(sharedBarangay);

  // Data states
  const [counts, setCounts] = useState({
    householdCount: 0,
    membersCount: 0,
    pmrfCount: 0,
    ammendCount: 0,
    fpeCount: 0,
    pcsfCount: 0
  });
  const [userBreakdown, setUserBreakdown] = useState<any[]>([]);
  const [barangayList, setBarangayList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userGroup, setUserGroup] = useState<any>(null);
  const [allGroups, setAllGroups] = useState<any[]>([]);

  // Sync back local barangay change to parent states
  useEffect(() => {
    setSharedBarangay(selectedBarangay);
  }, [selectedBarangay, setSharedBarangay]);

  useEffect(() => {
    if (filterType === 'single') {
      setSharedCampaignDate(startDate);
    }
  }, [startDate, filterType, setSharedCampaignDate]);

  // Fetch designated barangays for current user if Leader/Co-Leader
  useEffect(() => {
    const fetchUserDesignation = async () => {
      try {
        const res = await fetch('/api/groups');
        if (res.ok) {
          const groups = await res.json();
          setAllGroups(groups);
          // Find if current user is leader or co-leader of any group
          const matchedGroup = groups.find((g: any) => 
            !g.isArchived && 
            (g.leader?.toLowerCase() === currentUser.fullName?.toLowerCase() || 
             (Array.isArray(g.coLeaders) && g.coLeaders.some((cl: string) => cl.toLowerCase() === currentUser.fullName?.toLowerCase())))
          );
          if (matchedGroup) {
            setUserGroup(matchedGroup);
            // If uploader, and no barangay is selected yet or selectedBarangay is not in designated list, default to first assigned barangay
            if (matchedGroup.assignedBarangays && matchedGroup.assignedBarangays.length > 0) {
              if (selectedBarangay === 'All' || !matchedGroup.assignedBarangays.includes(selectedBarangay)) {
                setSelectedBarangay(matchedGroup.assignedBarangays[0]);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching groups for designation:', err);
      }
    };

    fetchUserDesignation();
  }, [currentUser]);

  // Fetch list of all barangays for dropdown list
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch('/api/barangays');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.barangays || []);
          setBarangayList(list.map((b: any) => b.name));
        }
      } catch (err) {
        console.error('Error fetching barangays:', err);
      }
    };
    fetchBarangays();
  }, []);

  // Fetch report data
  const fetchReportData = async () => {
    try {
      setLoading(true);
      let url = `/api/reports/daily-accomplishments?position=${selectedPosition}&barangay=${selectedBarangay}`;
      if (filterType === 'single') {
        url += `&date=${startDate}`;
      } else {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await fetch(url, {
        headers: {
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts || {
          householdCount: 0,
          membersCount: 0,
          pmrfCount: 0,
          ammendCount: 0,
          fpeCount: 0,
          pcsfCount: 0
        });
        setUserBreakdown(data.userBreakdown || []);
      }
    } catch (err) {
      console.error('Error loading daily achievements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [filterType, startDate, endDate, selectedPosition, selectedBarangay]);

  const filteredUserBreakdown = userBreakdown.filter(user => {
    // Hide Co-Leaders and Members (Only show LEADER which corresponds to Squad Leaders)
    const isSquadLeader = hasRole(user, 'LEADER');
    if (!isSquadLeader) return false;

    // Filter by assigned barangay
    if (selectedBarangay && selectedBarangay !== 'All') {
      const groupLedByThisUser = allGroups.find(g => 
        !g.isArchived && g.leader?.toLowerCase() === user.name?.toLowerCase()
      );
      if (!groupLedByThisUser) return false;
      return Array.isArray(groupLedByThisUser.assignedBarangays) && groupLedByThisUser.assignedBarangays.includes(selectedBarangay);
    }

    return true;
  });

  // Format date for display (e.g. "June 11, 2026")
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handlePrint = () => {
    window.print();
  };

  // Determine which barangays are selectable
  const selectableBarangays = userGroup?.assignedBarangays && !hasRole(currentUser, ['ADMIN', 'MANAGER', 'HR', 'IT'])
    ? userGroup.assignedBarangays 
    : ['All', ...barangayList];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0">
      
      {/* Header section (Hidden on print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <h1 id="page-title" className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
            Daily Accomplishment Report
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time daily submission metrics, citizen registrations and field leader accomplishments digest.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            id="print-report-btn"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-xs cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print Report File
          </button>
        </div>
      </div>

      {/* Dynamic Printing Header (Only visible when printing) */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
        <h2 className="text-2xl font-extrabold uppercase text-slate-900 tracking-wide">Saint Francis Clinic</h2>
        <p className="text-sm font-semibold tracking-wider text-slate-700 mt-0.5">Municipal Health and Geotagging Portal</p>
        <h1 className="text-lg font-bold text-slate-900 mt-3 border-t border-slate-200 pt-2">DAILY ACCOMPLISHMENT REPORT REPORT</h1>
        <p className="text-xs font-mono text-slate-600 mt-1">
          Date Scope Target: {filterType === 'single' ? formatDateDisplay(startDate) : `${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`}
        </p>
        <p className="text-xs font-mono text-slate-600">
          Generated on: {new Date().toLocaleDateString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' })} | By: {currentUser.fullName}
        </p>
      </div>

      {/* Filter Section (Hidden on Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="lg:col-span-3">
          <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Method</label>
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'single' | 'range')}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="single">Single Date View</option>
            <option value="range">Date Range View</option>
          </select>
        </div>

        <div className={filterType === 'single' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {filterType === 'single' ? 'Select Date' : 'From Date'}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {filterType === 'range' && (
          <div className="lg:col-span-2">
            <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <div className="relative font-mono">
              <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        )}

        <div className="lg:col-span-2">
          <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">User Position</label>
          <select 
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Positions</option>
            <option value="LEADER">Leader Only</option>
            <option value="CO-LEADER">Co-Leader Only</option>
            <option value="ADMIN">Clinical Admin</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">Barangay Zone</label>
          <select 
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            {selectableBarangays.map((boro) => (
              <option key={boro} value={boro}>
                {boro === 'All' ? 'All Barangays' : boro}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date banner for active view scope (Always visible) */}
      <div className="bg-slate-100/80 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-slate-600 print:bg-transparent print:border-none print:px-0">
        <div className="flex items-center gap-2 font-semibold text-xs">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span>Active Scope:</span>
          <span className="font-bold text-slate-800">
            {filterType === 'single' ? formatDateDisplay(startDate) : `${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`}
          </span>
          {selectedBarangay !== 'All' && (
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md px-1.5 py-0.5 ml-2">
              📍 Barangay {selectedBarangay}
            </span>
          )}
        </div>
        <div className="text-[10px] font-mono text-slate-400 print:hidden">
          Auto-updated live feed
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-100 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-xs text-slate-400 font-mono">Compiling stats statement ledger...</p>
        </div>
      ) : (
        <>
          {/* Daily Counting boxes */}
          <div id="counting-boxes-panel" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Household Daily', val: counts.householdCount, icon: Home, color: 'bg-indigo-50 text-indigo-700 hover:border-indigo-300' },
              { label: 'Household Member Daily', val: counts.membersCount, icon: Users, color: 'bg-sky-50 text-sky-700 hover:border-sky-300' },
              { label: 'PMRF Registration Daily', val: counts.pmrfCount, icon: UserCheck, color: 'bg-emerald-50 text-emerald-700 hover:border-emerald-300' },
              { label: 'Updating / Amendment Daily', val: counts.ammendCount, icon: Sparkles, color: 'bg-amber-50 text-amber-700 hover:border-amber-300' },
              { label: 'FPE Daily', val: counts.fpeCount, icon: HeartPulse, color: 'bg-rose-50 text-rose-700 hover:border-rose-300' },
              { label: 'PCSF Daily', val: counts.pcsfCount, icon: FileText, color: 'bg-purple-50 text-purple-700 hover:border-purple-300' },
            ].map((stat, idx) => {
              const IconComp = stat.icon;
              return (
                <div key={idx} className={`bg-white p-3.5 rounded-2xl border border-slate-150 transition ${stat.color} flex flex-col justify-between shadow-xs print:p-2 print:border-slate-350`}>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block break-words max-w-[100px] leading-tight">
                      {stat.label}
                    </span>
                    <IconComp className="h-4 w-4 shrink-0 opacity-70" />
                  </div>
                  <div>
                    <span className="text-xl font-black font-mono tracking-tight print:text-lg">
                      {stat.val.toLocaleString()}
                    </span>
                    <span className="text-[9.px] text-slate-400 block font-normal mt-0.5">entries submitted</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* User Breakdown Section */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs print:border-slate-350 print:shadow-none">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:bg-white print:border-b-2 print:border-slate-800 print:px-0">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  User Breakdown - {filterType === 'single' ? formatDateDisplay(startDate) : 'Selected Date Period'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 print:hidden">
                  Account activity summary list for selected date, position and designated Barangay scope.
                </p>
              </div>
              <span className="font-mono text-[10.5px] bg-slate-200/80 text-slate-600 rounded-md py-0.5 px-2 print:hidden font-bold">
                {filteredUserBreakdown.length} Leaders matched
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-450 print:bg-transparent print:border-b-2 print:border-slate-800">
                    <th className="py-2.5 px-4 font-extrabold text-slate-600">Account Name</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-600 text-center">Households</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-600 text-center">Members</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-600 text-center">Geotagged</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-600 text-center">PMRF</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-600 text-center">SFC Enrollment Willing</th>
                    <th className="py-2.5 px-3 font-extrabold text-slate-600 text-center">Registered to other Clinic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-medium font-sans">
                  {filteredUserBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-mono text-xs">
                        No active squad leader ledger counts for selected parameters.
                      </td>
                    </tr>
                  ) : (
                    filteredUserBreakdown.map((user, idx) => {
                      const isHighActivity = user.householdsCount >= 5;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/55 transition print:hover:bg-transparent">
                          <td className="py-2 px-4">
                            <div className="font-bold text-slate-800 text-[11px] print:text-[10.5px]">{user.name}</div>
                            <div className="text-[9px] font-semibold text-slate-400 font-mono mt-0.5 uppercase tracking-wider">{user.position}</div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-mono font-bold text-xs py-0.5 px-2 rounded-md ${isHighActivity ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-700'}`}>
                              {user.householdsCount}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600 font-semibold">{user.membersCount}</td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <MapPin className="h-3 w-3 text-emerald-500" />
                              <span className="font-mono font-bold text-slate-800">{user.geotaggedCount}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-slate-600">{user.pmrfCount}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-mono text-[11px] py-0.5 px-1.5 rounded bg-emerald-50 text-emerald-800 font-bold`}>
                              {user.sfcWillingCount}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-mono text-[11px] py-0.5 px-1.5 rounded bg-amber-50 text-amber-800 font-bold`}>
                              {user.registeredOtherClinicCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-450 print:hidden font-mono">
              <span>This ledger calculates directly from verified Saint Francis patient database submissions.</span>
              <span>Report Ref Code: AC-{startDate.replace(/-/g, '')}</span>
            </div>
          </div>

          {/* Printable visual footer */}
          <div className="hidden print:block text-slate-400 text-[9px] font-mono text-center mt-12 border-t border-slate-200 pt-3">
            Clinic Master Registry Reporting Node (Saint Francis Health & Geotagging System) - Secure Ledger Paper Copy
          </div>
        </>
      )}
    </div>
  );
}
