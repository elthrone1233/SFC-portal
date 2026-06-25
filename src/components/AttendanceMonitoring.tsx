import React, { useState, useEffect } from 'react';
import { 
  Clock, MapPin, Search, Calendar, RefreshCw, Eye, 
  CheckCircle, XCircle, ArrowDown, ArrowUp, CalendarDays,
  User, Image, Map, Download, ShieldAlert, Laptop
} from 'lucide-react';
import { User as UserType, Timecard } from '../types';

interface AttendanceMonitoringProps {
  currentUser: UserType;
}

// Sub-component to gracefully render selfies and handle missing/broken image files
function TimecardSelfie({ photo, userName, onSelect }: { photo: string; userName: string; onSelect: (url: string) => void }) {
  const [isBroken, setIsBroken] = useState(false);

  if (isBroken) {
    return (
      <div 
        className="h-7 w-7 md:h-12 md:w-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center shrink-0 border border-slate-200 text-slate-400 select-none"
        title="Verification image unavailable (Broken file)"
      >
        <ShieldAlert className="h-3.5 w-3.5 md:h-5 md:w-5 text-amber-500 animate-pulse shrink-0" />
        <span className="text-[6px] md:text-[8px] font-mono font-bold text-slate-400 mt-0.5 scale-90 uppercase truncate max-w-full px-0.5">Broken</span>
      </div>
    );
  }

  return (
    <div className="relative group shrink-0 w-7 h-7 md:w-12 md:h-12">
      <img 
        src={photo} 
        alt="Biometric snap alignment preview" 
        className="h-7 w-7 md:h-12 md:w-12 rounded-lg border-2 border-slate-205 object-cover hover:scale-105 active:scale-95 cursor-zoom-in transition"
        onClick={() => onSelect(photo)}
        onError={() => setIsBroken(true)}
        title="Click to Enlarge Snapshot Verification"
      />
      <div className="absolute top-0 right-0 group-hover:scale-110 transition bg-slate-900 p-0.5 rounded text-[8px] text-white pointer-events-none">
        <Eye className="h-2 w-2" />
      </div>
    </div>
  );
}

export default function AttendanceMonitoring({ currentUser }: AttendanceMonitoringProps) {
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchTimecards();
  }, []);

  const fetchTimecards = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/timecards', {
        headers: {
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTimecards(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse dates to local PHT YYYY-MM-DD for list comparison
  const getLocalDateString = (isoString: string) => {
    try {
      const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
      if (isNaN(d.getTime())) return '';
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Compute stats
  const totalLogs = timecards.length;
  const insCount = timecards.filter(tc => tc && tc.type === 'IN').length;
  const outsCount = timecards.filter(tc => tc && tc.type === 'OUT').length;
  
  // Today's logs specifically using local PHT YYYY-MM-DD format
  const todayStr = getLocalDateString(new Date().toISOString());
  const todaysLogs = timecards.filter(tc => tc && tc.timestamp && typeof tc.timestamp === 'string' && getLocalDateString(tc.timestamp) === todayStr);
  const todaysIns = todaysLogs.filter(tc => tc && tc.type === 'IN').length;
  const todaysOuts = todaysLogs.filter(tc => tc && tc.type === 'OUT').length;
  
  // Unique officers clocked-in today
  const uniqueOfficersToday = Array.from(new Set(todaysLogs.map(tc => tc ? (tc.userId || tc.userEmail || '') : ''))).filter(Boolean).length;

  // Filters calculation
  const filteredTimecards = timecards.filter(tc => {
    if (!tc) return false;
    // Search Query (Officer name, email, or device)
    const uName = tc.userName || '';
    const uEmail = tc.userEmail || '';
    const dInfo = tc.deviceInfo || '';
    const matchesSearch = 
      uName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      uEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dInfo.toLowerCase().includes(searchQuery.toLowerCase());

    // Attendance Type In vs Out
    const matchesType = filterType === 'ALL' || tc.type === filterType;

    // Date selection filter (comparing PHT local date string)
    const matchesDate = !filterDate || (tc.timestamp && getLocalDateString(tc.timestamp) === filterDate);

    return matchesSearch && matchesType && matchesDate;
  });

  const sortedFilteredTimecards = [...filteredTimecards].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const exportCSV = () => {
    const headers = ['ID', 'Officer Name', 'Officer Email', 'Type', 'Timestamp', 'Latitude', 'Longitude', 'Device Info'];
    const rows = filteredTimecards.map(tc => [
      tc.id,
      tc.userName,
      tc.userEmail,
      tc.type,
      tc.timestamp,
      tc.latitude || '',
      tc.longitude || '',
      tc.deviceInfo || ''
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SFC_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="attendance-monitoring-panel">
      {/* Upper header segment and summary counts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-200">
        <div>
          <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
            <Clock className="w-5 h-5 text-emerald-600" />
            Field Operations Attendance Hub
          </h1>
          <p className="text-slate-400 text-[10.5px]">Monitor clinical and field officer active check-ins, biometric snapshots, and live geotags.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTimecards}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
            title="Reload Timesheet Logs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Logs
          </button>
          
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-md"
            title="Download CSV report of currently filtered attendance logs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* METRIC BENTO STATS SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border rounded-xl p-4 shadow-xs border-slate-200/80 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Today's Total Scans</span>
            <span className="text-2xl font-black text-slate-900 font-mono inline-block">{todaysLogs.length}</span>
            <span className="text-[9px] text-slate-400 block">Actions recorded since midnight</span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-150">
            <Clock className="h-5 w-5 text-emerald-600 animate-pulse" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500"></div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border rounded-xl p-4 shadow-xs border-slate-200/80 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Active Today (IN)</span>
            <span className="text-2xl font-black text-slate-900 font-mono inline-block">{todaysIns}</span>
            <span className="text-[9px] text-emerald-600 font-bold block">✓ Officers currently active</span>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-150">
            <CheckCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500"></div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border rounded-xl p-4 shadow-xs border-slate-200/80 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Duty Completed (OUT)</span>
            <span className="text-2xl font-black text-slate-900 font-mono inline-block">{todaysOuts}</span>
            <span className="text-[9px] text-slate-440 block">Finished shifts logged</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-150">
            <XCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500"></div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border rounded-xl p-4 shadow-xs border-slate-200/80 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Unique Officers</span>
            <span className="text-2xl font-black text-slate-900 font-mono inline-block">{uniqueOfficersToday}</span>
            <span className="text-[9px] text-purple-650 font-bold block">Logged online today</span>
          </div>
          <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-150">
            <User className="h-5 w-5 text-purple-600" />
          </div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-purple-500"></div>
        </div>
      </div>

      {/* FILTER SEARCH CRITERIA ROW BOX */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search input bar */}
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, email or device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none font-semibold focus:border-slate-800 focus:bg-white placeholder-slate-400 text-slate-800"
          />
        </div>

        {/* Selection toggles for IN / OUT vs ALL */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider pr-1">Logs Filter:</span>
          
          <div className="bg-slate-100 p-1 rounded-lg border flex gap-1 text-[10px] select-none text-slate-700">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${filterType === 'ALL' ? 'bg-white shadow text-slate-900' : 'hover:bg-white/50'}`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType('IN')}
              className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${filterType === 'IN' ? 'bg-emerald-600 text-white shadow' : 'hover:bg-white/50'}`}
            >
              Check-In (IN)
            </button>
            <button
              onClick={() => setFilterType('OUT')}
              className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${filterType === 'OUT' ? 'bg-red-650 text-white shadow' : 'hover:bg-white/50'}`}
            >
              Check-Out (OUT)
            </button>
          </div>

          {/* Date Picker Filter */}
          <div className="relative">
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-50 border border-slate-305 rounded-lg px-2 py-1.5 text-[10.5px] font-bold outline-none focus:border-slate-800 text-slate-700 text-right cursor-pointer"
            />
          </div>

          {/* Clear Filter if loaded */}
          {(filterDate || searchQuery || filterType !== 'ALL') && (
            <button
              onClick={() => {
                setFilterDate('');
                setSearchQuery('');
                setFilterType('ALL');
              }}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* HISTORIC TIMESHEETS TABLE LIST */}
      <div className="bg-white border text-slate-800 rounded-xl shadow-xs overflow-hidden border-slate-200">
        <div className="p-3 bg-slate-50 border-b flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <span className="font-extrabold text-[10px] tracking-wider uppercase flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-emerald-400" />
            Verification Journal Roll ({filteredTimecards.length} Records)
          </span>
          <span className="text-[10px] font-bold text-slate-300 font-mono">Official Clock Database Sync: Active</span>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-emerald-650 border-r-transparent mb-2"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Syncing staff records database...</p>
          </div>
        ) : filteredTimecards.length === 0 ? (
          <div className="text-center py-16 text-slate-400 p-6 space-y-2">
            <Clock className="h-10 w-10 mx-auto text-slate-300 animate-bounce" />
            <p className="text-xs font-black text-slate-700 uppercase">No logged timecards found</p>
            <p className="text-[10px] max-w-sm mx-auto leading-relaxed">No biometric check-ins or out-records match current filter criteria. Ask field team to snap verification checkpoints in the web panel!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[9.5px] tracking-wider text-slate-500">
                  <th className="py-1 px-1.5 md:py-3 md:px-4">Verification Selfie</th>
                  <th className="py-1 px-1.5 md:py-3 md:px-4">Field Officer info</th>
                  <th className="py-1 px-1.5 md:py-3 md:px-4">Type</th>
                  <th className="py-1 px-1.5 md:py-3 md:px-4">Official Timestamp</th>
                  <th className="py-1 px-1.5 md:py-3 md:px-4">Geotag Coordinates</th>
                  <th className="py-1 px-1.5 md:py-3 md:px-4">Client Imprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sortedFilteredTimecards.map((tc) => {
                  const isCheckIn = tc.type === 'IN';
                  const recordTime = new Date(tc.timestamp);
                  const formattedDate = recordTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                  const formattedTime = recordTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <tr key={tc.id} className="hover:bg-slate-50/70 transition">
                      
                      {/* Photo preview Column */}
                      <td className="py-0.5 px-1 md:py-3 md:px-4 whitespace-nowrap">
                        {tc.photo ? (
                          <TimecardSelfie photo={tc.photo} userName={tc.userName} onSelect={setSelectedPhoto} />
                        ) : (
                          <div className="h-7 w-7 md:h-12 md:w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border">
                            <Image className="h-3 w-3 text-slate-400" />
                          </div>
                        )}
                      </td>

                      {/* Username and position info profile */}
                      <td className="py-0.5 px-1 md:py-3 md:px-4">
                        <div>
                          <p className="font-extrabold text-slate-800 text-[10px] md:text-[11px] leading-tight flex items-center gap-1">
                            <User className="h-2.5 w-2.5 text-slate-500 shrink-0" />
                            {tc.userName}
                          </p>
                          <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 font-sans truncate max-w-[100px] md:max-w-xs">{tc.userEmail}</p>
                        </div>
                      </td>

                      {/* Action Type check state tab */}
                      <td className="py-0.5 px-1 md:py-3 md:px-4 whitespace-nowrap">
                        {isCheckIn ? (
                          <span className="bg-emerald-50 text-emerald-800 border-2 border-emerald-150 text-[8px] md:text-[10px] font-extrabold rounded-lg px-2 py-0.5 uppercase tracking-wider inline-flex items-center gap-0.5 md:gap-1 shrink-0 animate-pulse">
                            <ArrowUp className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                            Check In
                          </span>
                        ) : (
                          <span className="bg-rose-50 text-rose-800 border-2 border-rose-150 text-[8px] md:text-[10px] font-extrabold rounded-lg px-2 py-0.5 uppercase tracking-wider inline-flex items-center gap-0.5 md:gap-1 shrink-0">
                            <ArrowDown className="h-2.5 w-2.5 text-rose-600 shrink-0 select-none" />
                            Check Out
                          </span>
                        )}
                      </td>

                      {/* Date & Time parameters column */}
                      <td className="py-0.5 px-1 md:py-3 md:px-4 whitespace-nowrap">
                        <div>
                          <p className="text-slate-800 font-extrabold font-mono bg-slate-100 border rounded px-1 md:px-1.5 py-0.5 inline-block text-[9px] md:text-[10.5px]">
                            {formattedTime}
                          </p>
                          <p className="text-[8px] md:text-[9.5px] text-slate-400 mt-0.5 font-bold">
                            {formattedDate}
                          </p>
                        </div>
                      </td>

                      {/* Geotag maps parameters coordinates */}
                      <td className="py-0.5 px-1 md:py-3 md:px-4 whitespace-nowrap font-mono text-[9px] md:text-[10px]">
                        {tc.latitude || tc.longitude ? (
                          <div className="space-y-0.5 md:space-y-1">
                            <p className="font-bold text-slate-700 leading-none">
                              Lat: <span className="text-slate-530 font-semibold">{tc.latitude?.toFixed(4)}</span>
                            </p>
                            <p className="font-bold text-slate-700 leading-none">
                              Lng: <span className="text-slate-530 font-semibold">{tc.longitude?.toFixed(4)}</span>
                            </p>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${tc.latitude},${tc.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-extrabold hover:underline flex items-center gap-0.5 mt-0.5 md:mt-1.5 leading-none"
                            >
                              <Map className="h-2.5 w-2.5 text-slate-500" /> Map ↗
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-semibold text-[8px] md:text-[10px]">Missing</span>
                        )}
                      </td>

                      {/* Device signature model specs details */}
                      <td className="py-0.5 px-1 md:py-3 md:px-4 text-[9px] md:text-[10px]">
                        <div className="flex items-start gap-1 p-0.5 md:p-1 bg-slate-50 border border-slate-200/50 rounded-lg max-w-[80px] md:max-w-xs truncate" title={tc.deviceInfo}>
                          <Laptop className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                          <span className="text-slate-650 font-mono whitespace-normal leading-tight font-semibold break-all text-[8px] md:text-[9.5px]">
                            {tc.deviceInfo || 'Secure Client'}
                          </span>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FULL SCREEN PHOTO ENLARGED VIEW OVERLAY LIGHTBOX */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
          <div 
            onClick={() => setSelectedPhoto(null)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs cursor-zoom-out"
          />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-4 overflow-hidden shadow-2xl border flex flex-col items-center">
            <h3 className="font-bold text-slate-905 block pb-2.5 text-sm uppercase self-start flex items-center gap-1 border-b w-full">
              <ShieldAlert className="h-4.5 w-4.5 text-emerald-600" />
              Biometric Selfie Snapshot Verification
            </h3>
            
            <img 
              src={selectedPhoto} 
              alt="Enlarged verification profile selfie" 
              className="w-full h-auto max-h-[60vh] object-contain rounded-xl mt-4 border border-slate-200" 
            />

            <button
              onClick={() => setSelectedPhoto(null)}
              className="mt-4 px-5 py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-[11px] uppercase rounded-lg cursor-pointer"
            >
              Dismiss Preview
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
