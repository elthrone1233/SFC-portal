import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, Filter, Search, Download, Eye, ExternalLink,
  Users, Home, Image as ImageIcon, MapPin, X, ArrowUpRight, 
  ChevronDown, ChevronUp, Clock, FileCheck, RefreshCw, FileCode, CheckCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType } from '../types';

interface DailyAttachmentProps {
  currentUser: UserType;
  sharedBarangay: string;
  setSharedBarangay: (b: string) => void;
  sharedCampaignDate: string;
  setSharedCampaignDate: (d: string) => void;
}

// Sub-component for individual lazy-loaded attachment thumbnails
interface ImageThumbnailProps {
  url: string;
  alt: string;
  className?: string;
}

function ImageThumbnail({ url, alt, className = "h-44" }: ImageThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!url);

  return (
    <div className={`relative w-full bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200/60 shadow-inner ${className}`}>
      {!loaded && !error && url && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-1"></div>
          <span className="text-[9px] font-mono">Loading thumb...</span>
        </div>
      )}
      {error || !url ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-2 text-center">
          <ImageIcon className="h-6 w-6 mb-1 text-slate-300" />
          <span className="text-[10px] font-semibold leading-none text-slate-450">Preview Unavailable</span>
        </div>
      ) : (
        <img 
          src={url} 
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`object-cover w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

export default function DailyAttachment({
  currentUser,
  sharedBarangay,
  setSharedBarangay,
  sharedCampaignDate,
  setSharedCampaignDate
}: DailyAttachmentProps) {
  // Advanced Filter state
  const [selectedUploader, setSelectedUploader] = useState<string>('All');
  
  // Custom client-side search & filtering fields
  const [uploaderSearch, setUploaderSearch] = useState<string>('');
  const [squadSearch, setSquadSearch] = useState<string>('');
  const [barangaySearch, setBarangaySearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('newest'); // 'newest', 'oldest', 'uploader-az', 'barangay', 'squad'
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 5;

  // Data state
  const [attachments, setAttachments] = useState<any[]>([]);
  const [barangayList, setBarangayList] = useState<string[]>([]);
  const [uploadersList, setUploadersList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Zoomed Image modal
  const [zoomedAttachment, setZoomedAttachment] = useState<any | null>(null);

  // Fetch all barangays for filter dropdown with auth header
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch('/api/barangays', {
          headers: { 'x-user-email': currentUser.email }
        });
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
  }, [currentUser.email]);

  // Fetch all user accounts with auth header
  useEffect(() => {
    const fetchUploaders = async () => {
      try {
        const res = await fetch('/api/accounts', {
          headers: { 'x-user-email': currentUser.email }
        });
        if (res.ok) {
          const data = await res.json();
          setUploadersList(Array.isArray(data) ? data.filter((u: any) => u.status === 'Approved') : []);
        }
      } catch (err) {
        console.error('Error fetching accounts:', err);
      }
    };
    fetchUploaders();
  }, [currentUser.email]);

  // Fetch Attachment logs based on query filters
  const fetchAttachments = async () => {
    try {
      setLoading(true);
      // Query raw list for this date & basic barangay/uploader parameters
      let url = `/api/reports/daily-attachments?date=${sharedCampaignDate}&barangay=${sharedBarangay}&uploader=${selectedUploader}`;
      
      const res = await fetch(url, {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setAttachments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching attachment list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
    // Restart to page 1 whenever database dependency filters change
    setCurrentPage(1);
  }, [sharedCampaignDate, sharedBarangay, selectedUploader, currentUser.email]);

  // Reset pagination when clientside search options edit
  useEffect(() => {
    setCurrentPage(1);
  }, [uploaderSearch, squadSearch, barangaySearch, selectedType, sortBy]);

  // Calendar date display helper
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatUploadDate = (dateVal: any, type: 'date' | 'time' | 'full') => {
    if (!dateVal) return type === 'date' ? 'Date Unknown' : (type === 'time' ? 'Time Unknown' : 'Date Unknown');
    const parsed = new Date(dateVal);
    if (isNaN(parsed.getTime())) {
      return type === 'date' ? 'Date Unknown' : (type === 'time' ? 'Time Unknown' : 'Date Unknown');
    }
    if (type === 'date') {
      return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (type === 'time') {
      return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' });
    }
    return parsed.toLocaleString();
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const clean = name.trim();
    if (!clean) return '??';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
  };

  const getMockFileSize = (id: string) => {
    if (!id) return '450 KB';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const size = Math.abs((hash % 1300) + 150);
    if (size >= 1000) {
      return (size / 1000).toFixed(1) + ' MB';
    }
    return size + ' KB';
  };

  const getFileExtensionFromUrl = (url: any): string => {
    if (!url || typeof url !== 'string') return 'png';
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);/);
      if (match && match[1]) {
        const mime = match[1].toLowerCase();
        if (mime.includes('pdf')) return 'pdf';
        if (mime.includes('png')) return 'png';
        if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
        if (mime.includes('webp')) return 'webp';
        if (mime.includes('gif')) return 'gif';
        if (mime.includes('svg')) return 'svg';
        if (mime.includes('csv')) return 'csv';
        if (mime.includes('text/plain') || mime.includes('text/')) return 'txt';
        if (mime.includes('word') || mime.includes('msword')) return 'docx';
        if (mime.includes('excel') || mime.includes('spreadsheet')) return 'xlsx';
      }
    } else {
      try {
        const pathname = new URL(url).pathname;
        const index = pathname.lastIndexOf('.');
        if (index !== -1) {
          return pathname.substring(index + 1).toLowerCase();
        }
      } catch (e) {
        // ignore
      }
    }
    return 'png';
  };

  const getFileMeta = (url: any) => {
    if (!url || typeof url !== 'string') return { type: 'unknown', label: 'FILE', mime: '', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);/);
      if (match && match[1]) {
        const mime = match[1].toLowerCase();
        if (mime.startsWith('image/')) {
          return { type: 'image', label: 'IMAGE', mime, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
        }
        if (mime === 'application/pdf') {
          return { type: 'pdf', label: 'PDF DOCUMENT', mime, color: 'bg-rose-50 text-rose-700 border-rose-200' };
        }
        if (mime.includes('csv') || mime.includes('excel') || mime.includes('spreadsheet')) {
          return { type: 'spreadsheet', label: 'SPREADSHEET', mime, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        }
        if (mime.includes('text/')) {
          return { type: 'text', label: 'TEXT FILE', mime, color: 'bg-amber-50 text-amber-700 border-amber-200' };
        }
        return { type: 'document', label: 'DOCUMENT', mime, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      }
    } else {
      const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
      if (cleanUrl.endsWith('.pdf')) {
        return { type: 'pdf', label: 'PDF DOCUMENT', mime: 'application/pdf', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      }
      if (cleanUrl.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) {
        return { type: 'image', label: 'IMAGE', mime: 'image/png', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      }
      if (cleanUrl.match(/\.(csv|xls|xlsx)$/)) {
        return { type: 'spreadsheet', label: 'SPREADSHEET', mime: 'application/vnd.ms-excel', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      if (cleanUrl.match(/\.(txt|md|json)$/)) {
        return { type: 'text', label: 'TEXT FILE', mime: 'text/plain', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
    }
    return { type: 'document', label: 'DOCUMENT', mime: '', color: 'bg-purple-50 text-purple-700 border-purple-200' };
  };

  const handleDownloadFile = (item: any) => {
    const ext = getFileExtensionFromUrl(item.attachmentUrl);
    const link = document.createElement('a');
    link.href = item.attachmentUrl;
    link.download = `SFC_PCU_Attachment_${item.householdHead}_${item.barangay}.${ext}`.replace(/\s+/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CLIENT SIDE FILTERING PROCESS
  const filteredAttachments = attachments.filter(item => {
    // Search by Uploader Name
    if (uploaderSearch.trim()) {
      const uploaderLower = (item.uploaderName || '').toLowerCase();
      if (!uploaderLower.includes(uploaderSearch.toLowerCase())) return false;
    }

    // Search by Barangay
    if (barangaySearch.trim()) {
      const bLower = (item.barangay || '').toLowerCase();
      if (!bLower.includes(barangaySearch.toLowerCase())) return false;
    }

    // Search by Squad name
    const uploaderUser = uploadersList.find(u => u.email === item.uploaderEmail || u.fullName === item.uploaderName);
    const squadName = (uploaderUser?.groupAssigned || 'No Squad');
    if (squadSearch.trim()) {
      if (!squadName.toLowerCase().includes(squadSearch.toLowerCase())) return false;
    }

    // Filter by type
    if (selectedType !== 'All') {
      const meta = getFileMeta(item.attachmentUrl);
      if (meta.type !== selectedType) return false;
    }

    return true;
  });

  // GROUP ATTACHMENTS BY UPLOADER
  const groupsMap = new Map<string, {
    uploaderName: string;
    uploaderEmail: string;
    squadName: string;
    barangay: string;
    lastSubmitted: string;
    attachments: any[];
  }>();

  filteredAttachments.forEach(item => {
    const key = item.uploaderEmail || item.uploaderName || 'Anonymous';
    if (!groupsMap.has(key)) {
      const uploaderUser = uploadersList.find(u => u.email === item.uploaderEmail || u.fullName === item.uploaderName);
      groupsMap.set(key, {
        uploaderName: item.uploaderName || 'Anonymous Uploader',
        uploaderEmail: item.uploaderEmail || '',
        squadName: uploaderUser?.groupAssigned || 'General Field Unit',
        barangay: item.barangay || '',
        lastSubmitted: item.uploadDate,
        attachments: []
      });
    }

    const grp = groupsMap.get(key)!;
    grp.attachments.push(item);

    // Track latest submission time safely
    const itemTime = item.uploadDate ? new Date(item.uploadDate).getTime() : 0;
    const grTime = grp.lastSubmitted ? new Date(grp.lastSubmitted).getTime() : 0;
    if (!isNaN(itemTime) && (isNaN(grTime) || itemTime > grTime)) {
      grp.lastSubmitted = item.uploadDate || grp.lastSubmitted;
    }

    // Add novel barangays if uploader spans multiple zones
    if (item.barangay && !grp.barangay.includes(item.barangay)) {
      grp.barangay = grp.barangay ? `${grp.barangay}, ${item.barangay}` : item.barangay;
    }
  });

  const uploadersGroupList = Array.from(groupsMap.values());

  // SORT THE GROUPS SAFELY WITH FALLBACK SEEDS
  uploadersGroupList.sort((a, b) => {
    if (sortBy === 'newest') {
      const timeA = a.lastSubmitted ? new Date(a.lastSubmitted).getTime() : 0;
      const timeB = b.lastSubmitted ? new Date(b.lastSubmitted).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    }
    if (sortBy === 'oldest') {
      const timeA = a.lastSubmitted ? new Date(a.lastSubmitted).getTime() : 0;
      const timeB = b.lastSubmitted ? new Date(b.lastSubmitted).getTime() : 0;
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    }
    if (sortBy === 'uploader-az') {
      return (a.uploaderName || '').localeCompare(b.uploaderName || '');
    }
    if (sortBy === 'barangay') {
      return (a.barangay || '').localeCompare(b.barangay || '');
    }
    if (sortBy === 'squad') {
      return (a.squadName || '').localeCompare(b.squadName || '');
    }
    return 0;
  });

  // PAGINATION CALCULATIONS
  const totalItems = uploadersGroupList.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const paginatedGroups = uploadersGroupList.slice(indexOfFirstItem, indexOfLastItem);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Page Title & Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 id="page-title" className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2.5 font-mono uppercase">
            <ImageIcon className="h-6 w-6 text-indigo-600" />
            Daily Attachment Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Highly organized list layout categorized by verified field uploader. Inspect image proofs, scans, and documents submitted on-site.
          </p>
        </div>

        {/* Current counters */}
        <div id="attachment-count-badge" className="flex items-center gap-3">
          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex flex-col justify-center min-w-[140px] shadow-sm">
            <span className="text-[9px] font-black text-indigo-650 uppercase tracking-widest leading-none">Target Campaign</span>
            <span className="font-sans text-[11px] font-bold text-slate-650 mt-1">{formatDateDisplay(sharedCampaignDate)}</span>
          </div>

          <div className="bg-slate-900 text-white p-3 rounded-2xl flex flex-col justify-center min-w-[110px] shadow-md border border-slate-800">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Recordings</span>
            <span className="font-mono text-base font-black text-teal-400 mt-0.5">
              {filteredAttachments.length} <span className="text-[10px] font-sans font-bold text-slate-350">files</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modern Filter Suite */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Search & Advanced Filters</span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => {
                setUploaderSearch('');
                setSquadSearch('');
                setBarangaySearch('');
                setSelectedType('All');
                setSortBy('newest');
                setSharedBarangay('All');
                setSharedCampaignDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition shadow-2xs"
            >
              <RefreshCw className="h-3 w-3" />
              Reset All
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition shadow-sm"
            >
              <span>{showFilters ? 'Hide Panel' : 'Show Advanced'}</span>
              {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Calendar query is essential, always visible */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Campaign Date Source</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input 
                type="date"
                value={sharedCampaignDate}
                onChange={(e) => setSharedCampaignDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 hover:bg-slate-100 transition outline-none"
              />
            </div>
          </div>

          {/* Unified search bar */}
          <div className="md:col-span-5 relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Uploader Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input 
                type="text"
                placeholder="Search uploader full name..."
                value={uploaderSearch}
                onChange={(e) => setUploaderSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 hover:bg-slate-100 transition outline-none"
              />
            </div>
          </div>

          {/* Zone Selector */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Barangay Zone Select</label>
            <select 
              value={sharedBarangay}
              onChange={(e) => setSharedBarangay(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 hover:bg-slate-100 transition outline-none cursor-pointer"
            >
              <option value="All">All Barangays</option>
              {barangayList.map((boro) => (
                <option key={boro} value={boro}>Barangay {boro}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Collapsible advanced filters matching specifications */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-200 bg-slate-50/50 overflow-hidden"
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Search Barangay */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Barangay</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      placeholder="e.g. Balulang..."
                      value={barangaySearch}
                      onChange={(e) => setBarangaySearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Search Squad */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Squad / Unit</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      placeholder="e.g. Squad Alpha..."
                      value={squadSearch}
                      onChange={(e) => setSquadSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Filter Attachment Type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 border-indigo-200">Attachment File Type</label>
                  <select 
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="All">All Formats</option>
                    <option value="image">Images (PNG/JPG)</option>
                    <option value="pdf">PDF Documents</option>
                    <option value="spreadsheet">Excel/Spreadsheets</option>
                    <option value="text">Raw Text Files</option>
                    <option value="document">Other Documents</option>
                  </select>
                </div>

                {/* Sort dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sort Submissions</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="newest">Newest Submission</option>
                    <option value="oldest">Oldest Submission</option>
                    <option value="uploader-az">Uploader Name (A-Z)</option>
                    <option value="barangay">Group Barangay (A-Z)</option>
                    <option value="squad">Squad Name (A-Z)</option>
                  </select>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Response Grid Area */}
      {loading ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 flex flex-col items-center justify-center space-y-4">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-xs"></div>
          <p className="text-xs text-slate-400 font-mono tracking-tight">Syncing imagery and client-side records tree...</p>
        </div>
      ) : uploadersGroupList.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3.5 shadow-sm">
          <ImageIcon className="h-12 w-12 text-slate-300 stroke-1" />
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider font-mono">No Organized Attachments</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              No matching submission records or on-site file proof of work uploaded by field staff matches your parameters. Try modifying the date picker.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* List display starting. Elements grouped by uploader */}
          <AnimatePresence mode="popLayout">
            {paginatedGroups.map((group, groupIdx) => {
              const initials = getInitials(group.uploaderName);
              
              return (
                <motion.div 
                  key={group.uploaderEmail || group.uploaderName} 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, delay: groupIdx * 0.05 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  
                  {/* Outer List Container HEADER SECTION - Uploader Identity & Meta */}
                  <div className="p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {/* Avatar design */}
                      <div className="h-11 w-11 rounded-2xl bg-linear-to-tr from-indigo-600 to-indigo-800 text-white font-black text-xs font-mono flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 select-none">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-black text-slate-850 truncate leading-none">
                            {group.uploaderName}
                          </h2>
                          <span className="text-[9px] bg-indigo-50 border border-indigo-100/50 text-indigo-700 rounded-md px-2 py-0.5 font-bold uppercase tracking-wider">
                            Field Officer
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-1.5 font-mono">{group.uploaderEmail}</p>
                      </div>
                    </div>

                    {/* Meta badges for administrative status */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-650 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        <span>Barangay: <strong className="text-slate-800 font-extrabold">{group.barangay || 'Not Specified'}</strong></span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-650 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Squad: <strong className="text-slate-800 font-extrabold">{group.squadName}</strong></span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 rounded-xl px-3 py-1.5">
                        <FileCheck className="h-3.5 w-3.5" />
                        <span>Submitted: <strong className="font-extrabold">{group.attachments.length} files</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* List item children container - Stacks all attachments underneath same uploader */}
                  <div className="p-5 bg-white space-y-4">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-3">
                      <CheckCircle className="h-3.5 w-3.5 text-teal-600" />
                      Campaign records for this account ({group.attachments.length})
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {group.attachments.map((item, idx) => {
                        const meta = getFileMeta(item.attachmentUrl);
                        const fileSize = getMockFileSize(item.id);
                        
                        return (
                          <div 
                            key={item.id}
                            className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex gap-4.5 group/item hover:border-indigo-200/70 hover:bg-slate-50/60 transition-all duration-200"
                          >
                            {/* Left part: compact thumbnail/file-icon */}
                            <div className="w-24 sm:w-28 shrink-0 flex flex-col gap-2">
                              {meta.type === 'image' ? (
                                <ImageThumbnail url={item.attachmentUrl} alt={item.householdHead} className="h-24 sm:h-28" />
                              ) : (
                                <div className="w-full h-24 sm:h-28 bg-linear-to-b from-slate-900 to-slate-950 text-slate-300 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-2 text-center">
                                  {meta.type === 'pdf' ? (
                                    <FileCode className="h-8 w-8 text-rose-400 mb-1 animate-pulse" />
                                  ) : (
                                    <FileText className="h-8 w-8 text-emerald-400 mb-1" />
                                  )}
                                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-mono leading-none">
                                    {meta.label}
                                  </span>
                                  <span className="text-[8px] text-slate-500 truncate max-w-full font-mono mt-1">
                                    {meta.mime && meta.mime.split('/')[1] || 'DOC'}
                                  </span>
                                </div>
                              )}
                              <span className={`text-[8px] font-black uppercase text-center tracking-wider py-1 rounded-md border ${meta.color}`}>
                                {meta.label} Type
                              </span>
                            </div>

                            {/* Right part: detailed compact information and metadata */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-650 bg-indigo-55 border border-indigo-150 px-2 py-0.5 rounded-lg">
                                    Attachment #{idx + 1}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 font-mono uppercase bg-slate-200/75 px-1.5 py-0.5 rounded-md">
                                    {fileSize}
                                  </span>
                                </div>

                                <h3 className="text-xs font-black text-slate-800 leading-snug truncate mt-1" title={item.householdHead}>
                                  {item.householdHead}
                                </h3>

                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate">
                                  <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                                  <span>Barangay {item.barangay}, {item.purok}</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px] font-semibold text-slate-450 border-t border-slate-100 pt-1.5 mt-1">
                                  <span className="flex items-center gap-1 text-slate-500 font-mono truncate">
                                    <Calendar className="h-3 w-3 text-slate-400 inline shrink-0" />
                                    {formatUploadDate(item.uploadDate, 'date')}
                                  </span>
                                  <span className="flex items-center gap-1 text-slate-500 font-mono truncate">
                                    <Clock className="h-3 w-3 text-slate-400 inline shrink-0" />
                                    {formatUploadDate(item.uploadDate, 'time')}
                                  </span>
                                </div>
                              </div>

                              <div className="border-t border-slate-150/50 pt-1.5 mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-[8px] font-mono text-slate-400 truncate max-w-full sm:max-w-[80px]">
                                  ID: {item.id.replace('att-', '').substring(0, 10)}...
                                </span>
                                <div className="flex items-center gap-1.5 justify-end">
                                  <button 
                                    onClick={() => setZoomedAttachment(item)}
                                    className="px-2.5 py-1 bg-white border border-slate-250 hover:bg-slate-100 hover:text-indigo-650 text-slate-705 rounded-lg text-[9.5px] font-semibold transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="h-3 w-3 text-indigo-500" />
                                    View
                                  </button>
                                  <button 
                                    onClick={() => handleDownloadFile(item)}
                                    className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Download className="h-3 w-3" />
                                    Download
                                  </button>
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-5 mt-4">
              <span className="text-xs text-slate-500 font-mono">
                Showing <strong className="text-slate-700 font-semibold">{indexOfFirstItem + 1}</strong> to{' '}
                <strong className="text-slate-700 font-semibold">{Math.min(indexOfLastItem, totalItems)}</strong> of{' '}
                <strong className="text-slate-700 font-semibold">{totalItems}</strong> uploaders
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  disabled={currentPage === 1}
                  onClick={handlePrevPage}
                  className={`p-2 rounded-xl border border-slate-250 text-slate-600 font-semibold flex items-center gap-1 text-xs transition select-none ${
                    currentPage === 1 
                      ? 'opacity-40 cursor-not-allowed bg-slate-50' 
                      : 'hover:bg-slate-50 hover:text-indigo-650 active:scale-95 cursor-pointer bg-white'
                  }`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-8 w-8 rounded-xl font-bold font-mono text-xs flex items-center justify-center transition cursor-pointer select-none ${
                        currentPage === i + 1
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white hover:bg-slate-50 border border-slate-250 text-slate-600'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={handleNextPage}
                  className={`p-2 rounded-xl border border-slate-250 text-slate-600 font-semibold flex items-center gap-1 text-xs transition select-none ${
                    currentPage === totalPages 
                      ? 'opacity-40 cursor-not-allowed bg-slate-50' 
                      : 'hover:bg-slate-50 hover:text-indigo-650 active:scale-95 cursor-pointer bg-white'
                  }`}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* High-quality Zoom Modal popup */}
      {zoomedAttachment && (() => {
        const meta = getFileMeta(zoomedAttachment.attachmentUrl);
        const isWide = ['pdf', 'spreadsheet', 'text'].includes(meta.type);
        return (
          <div className="fixed inset-0 z-[10010] bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className={`bg-white rounded-3xl overflow-hidden ${isWide ? 'max-w-4xl h-[85vh]' : 'max-w-2xl'} w-full border border-slate-250 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-between`}>
              
              {/* Modal header details */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Expanded Proof of Work Scan</h3>
                    <span className={`text-[8.5px] font-black px-2.5 py-0.5 rounded-full border ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-0.5">{zoomedAttachment.householdHead} (Barangay {zoomedAttachment.barangay}, {zoomedAttachment.purok})</h2>
                </div>
                <button 
                  onClick={() => setZoomedAttachment(null)}
                  className="p-1 px-[5px] text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal content body */}
              <div className="bg-slate-900 flex-1 flex items-center justify-center p-2 relative min-h-0">
                {meta.type === 'image' ? (
                  <img 
                    src={zoomedAttachment.attachmentUrl} 
                    alt={zoomedAttachment.householdHead}
                    referrerPolicy="no-referrer"
                    className="max-h-[70vh] max-w-full object-contain rounded-xl"
                  />
                ) : ['pdf', 'text', 'spreadsheet'].includes(meta.type) ? (
                  <iframe
                    src={zoomedAttachment.attachmentUrl}
                    title={zoomedAttachment.householdHead}
                    className="w-full h-full border-0 bg-white rounded-xl shadow-inner"
                  />
                ) : (
                  <div className="text-slate-300 text-center p-6 bg-slate-950 rounded-xl border border-slate-800">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-indigo-400" />
                    <p className="text-xs font-mono font-bold">RAW RECORD FILE DATA</p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-xs justify-center font-mono">This contains data uploaded directly into Saint Francis clinical registry system.</p>
                  </div>
                )}
              </div>

              {/* Modal footer details */}
              <div className="p-4 bg-slate-50 border-t border-slate-150 flex flex-wrap justify-between items-center gap-3 text-xs shrink-0">
                <div className="space-y-1">
                  <p className="text-slate-550 font-bold">Uploader: <strong className="text-slate-800 font-bold">{zoomedAttachment.uploaderName}</strong> ({zoomedAttachment.uploaderEmail})</p>
                  <p className="text-slate-400 text-[10px] font-mono">Uploaded Date: {formatUploadDate(zoomedAttachment.uploadDate, 'full')}</p>
                </div>

                <div className="flex gap-2">
                  <a 
                    href={zoomedAttachment.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-slate-200 border border-slate-300 text-slate-700 hover:bg-slate-300 rounded-xl transition flex items-center gap-1.5 md:text-xs text-[11px] font-bold cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in New Tab
                  </a>
                  <button 
                    onClick={() => handleDownloadFile(zoomedAttachment)}
                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 md:text-xs text-[11px] font-bold cursor-pointer shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </button>
                  <button 
                    onClick={() => setZoomedAttachment(null)}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-250 text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition md:text-xs text-[11px] font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
