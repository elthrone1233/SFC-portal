import React, { useEffect, useState } from 'react';
import { 
  Home, Users, MapPin, ClipboardCheck, Heart, Sparkles, Calendar, 
  TrendingUp, ChevronRight, Clock, Activity, FileText, Database,
  Search, ArrowUpDown, SlidersHorizontal, RefreshCw, CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'motion/react';
import { User } from '../types';
import { CacheSyncService, SFC_CACHE_SYNC_EVENT } from '../utils/cacheSync';

interface DashboardProps {
  userEmail: string;
  currentUser?: User | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="bg-white/95 border border-slate-200 p-3 shadow-lg rounded-xl text-xs font-bold leading-normal min-w-[210px] z-50 pointer-events-none"
      >
        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2 font-mono font-black border-b border-b-slate-100 pb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            let labelName = entry.name;
            if (entry.name === 'households') labelName = 'Households';
            else if (entry.name === 'geotagged') labelName = 'Geotagged';
            else if (entry.name === 'members') labelName = 'Members';
            else if (entry.name === 'philhealth') labelName = 'PhilHealth';
            else if (entry.name === 'pmrf') labelName = 'PMRF';
            else if (entry.name === 'sfc_egov') labelName = 'SFC eGovPH';
            else if (entry.name === 'sfc_manual') labelName = 'SFC Manual';
            else if (entry.name === 'yakap') labelName = 'Other YAKAP (Willing)';
            else if (entry.name === 'fpe') labelName = 'FPE';
            else if (entry.name === 'pcsf') labelName = 'PCSF';

            return (
              <div key={index} className="flex items-center justify-between gap-4 font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.stroke || entry.color }} />
                  <span className="text-slate-600 text-[11px] font-sans font-semibold">{labelName}</span>
                </div>
                <span className="font-mono font-black text-[12px]" style={{ color: entry.stroke || entry.color }}>{entry.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ userEmail, currentUser }: DashboardProps) {
  const [stats, setStats] = useState<any>(() => {
    const cached = CacheSyncService.getCachedState();
    return cached.stats || null;
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(() => {
    const cached = CacheSyncService.getCachedState();
    return !cached.stats || cached.stats.totalApproved === 0;
  });
  const [selectedBarangay, setSelectedBarangay] = useState<string>('');
  const [brgSearch, setBrgSearch] = useState('');
  const [brgSort, setBrgSort] = useState<'highest' | 'lowest' | 'alphabetical'>('highest');

  useEffect(() => {
    // 1. Load initial cache instantly
    const cached = CacheSyncService.getCachedState();
    if (cached.stats) {
      setStats(cached.stats);
      setLoading(false);
    }

    // 2. Refresh stats from database on load
    fetchStats();

    // 3. Listen to background cache sync events to automatically update metrics
    const handleSync = (e: any) => {
      const data = e.detail;
      if (data && data.stats) {
        setStats(data.stats);
        setLoading(false);
      }
    };

    window.addEventListener(SFC_CACHE_SYNC_EVENT, handleSync);

    return () => {
      window.removeEventListener(SFC_CACHE_SYNC_EVENT, handleSync);
    };
  }, [userEmail, selectedBarangay]);

  const fetchStats = async () => {
    try {
      const query = selectedBarangay ? `?barangay=${encodeURIComponent(selectedBarangay)}` : '';
      const [statsRes, logsRes] = await Promise.all([
        fetch(`/api/dashboard/stats${query}`, {
          headers: { 'x-user-email': userEmail }
        }),
        fetch('/api/logs', {
          headers: { 'x-user-email': userEmail }
        })
      ]);
      if (statsRes.ok && logsRes.ok) {
        const statsData = await statsRes.json();
        const logsData = await logsRes.json();
        setStats(statsData);
        setLogs(Array.isArray(logsData) ? logsData.slice(-10).reverse() : []);
      }
    } catch (e) {
      console.error("Failed fetching dashboard metrics", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-xl"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Barangay Coverage Density listing filtering & sorting
  const processedBarangays = [...(stats.activityByBarangay || [])]
    .filter((b: any) => b.name.toLowerCase().includes(brgSearch.toLowerCase()))
    .sort((a: any, b: any) => {
      if (brgSort === 'highest') return b.households - a.households;
      if (brgSort === 'lowest') return a.households - b.households;
      return a.name.localeCompare(b.name);
    });

  const maxBrgVal = Math.max(...(stats.activityByBarangay || []).map((b: any) => b.households), 1);
  const totalBarangaysCount = (stats.activityByBarangay || []).length;

  return (
    <div className="space-y-6 font-sans p-2 select-none">
      {/* 1. Header Hero Card with clean clinic style */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white p-6 rounded-2xl shadow-md border border-emerald-600/20">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-6 translate-x-6">
          <Sparkles className="w-64 h-64" />
        </div>
        <img 
          src="https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png" 
          alt="Saint Francis Background Logo" 
          className="absolute -right-6 -bottom-8 h-48 w-auto object-contain opacity-20 pointer-events-none z-0 mix-blend-overlay rotate-[15deg]"
          referrerPolicy="no-referrer"
        />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full">
                {currentUser?.position || 'Clinician Dashboard'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-100 font-medium">
                <span className="h-2 w-2 rounded-full bg-green-300 animate-ping"></span> Live Analytics
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-2 tracking-tight uppercase">
              Saint Francis Clinic Portal
            </h1>
          </div>

          {/* Barangay Selector Filter Dropdown */}
          <div className="flex items-center gap-2 bg-black/25 hover:bg-black/35 border border-white/20 hover:border-white/40 px-4 py-2.5 rounded-xl backdrop-blur-md transition-all self-start md:self-auto shrink-0 shadow-sm">
            <MapPin className="h-4 w-4 text-emerald-200" />
            <div className="flex flex-col">
              <label htmlFor="barangayFilter" className="text-[9px] font-black uppercase text-emerald-100/90 leading-none mb-1">
                Barangay Selection
              </label>
              <select
                id="barangayFilter"
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="bg-transparent text-white text-xs font-black outline-none border-none cursor-pointer pr-5 uppercase h-5"
                style={{
                  colorScheme: 'dark', // ensures browser drop-down list UI is comfortable to read
                }}
              >
                <option value="" className="text-slate-900 font-extrabold uppercase">ALL BARANGAYS (RESET)</option>
                {(stats?.activityByBarangay || []).map((b: any) => (
                  <option key={b.name} value={b.name} className="text-slate-900 font-extrabold uppercase">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Unified Grid Key Metrics (8 Cards with Ultimate 3D Dimensional Depth & Glowing Neon Accents) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-5">
        
        {/* Card 2: Members (INDIGO/PURPLE Neon Glow - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-indigo-700 border-r-indigo-600/40 shadow-[0_8px_20px_-4px_rgba(79,70,229,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(79,70,229,0.45)] bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white p-4 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <Users className="h-4 w-4 text-indigo-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.254)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">Total Members</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.totalMembers || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-indigo-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailyMembers || 0}
            </span>
          </div>
        </motion.div>

        {/* Card 3: Geotagged (BLUE/CYAN Neon Glow - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-blue-700 border-r-blue-600/40 shadow-[0_8px_20px_-4px_rgba(59,130,246,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(59,130,246,0.45)] bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 text-white p-4 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <MapPin className="h-4 w-4 text-blue-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.255)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">Geotagged Households</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.geotaggedHouseholds || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-blue-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailyGeotagged || 0}
            </span>
          </div>
        </motion.div>

        {/* Card 4: PMRF Status (AMBER/ORANGE Neon Glow - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-amber-700 border-r-amber-600/40 shadow-[0_8px_20px_-4px_rgba(245,158,11,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(245,158,11,0.45)] bg-gradient-to-br from-amber-500 via-amber-600 to-orange-500 text-white p-4 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <ClipboardCheck className="h-4 w-4 text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">PMRF</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.pmrfWilling || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-amber-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailyPmrf || 0}
            </span>
          </div>
        </motion.div>

        {/* Card 5: Yakap Willing (ROSE/RED Neon Glow - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-rose-700 border-r-rose-600/40 shadow-[0_8px_20px_-4px_rgba(244,63,94,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(244,63,94,0.45)] bg-gradient-to-br from-rose-500 via-rose-600 to-red-500 text-white p-4 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <Heart className="h-4 w-4 text-rose-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.253)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">YAKAP</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.yakapWilling || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-rose-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailyYakap || 0}
            </span>
          </div>
        </motion.div>

        {/* Card 6: SFC Enrollment Willing (EMERALD Neon Glow - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-emerald-700 border-r-emerald-600/40 shadow-[0_8px_20px_-4px_rgba(16,185,129,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(16,185,129,0.45)] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500 text-white p-4 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <Activity className="h-4 w-4 text-emerald-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">SFC Enrollment</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.sfcWillingCount || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-emerald-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailySfcWillingCount || 0}
            </span>
          </div>
        </motion.div>

        {/* Card: FPE Approved Counter (CYAN - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-cyan-700 border-r-cyan-600/40 shadow-[0_8px_20px_-4px_rgba(6,182,212,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(6,182,212,0.45)] bg-gradient-to-br from-cyan-500 via-cyan-600 to-teal-550 text-white p-3.5 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <FileText className="h-4 w-4 text-cyan-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">FPE</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.approvedFpeCount || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-cyan-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailyApprovedFpeCount || 0}
            </span>
          </div>
        </motion.div>

        {/* Card: PCSF Approved Counter (SKY - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-sky-700 border-r-sky-600/40 shadow-[0_8px_20px_-4px_rgba(14,165,233,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(14,165,233,0.45)] bg-gradient-to-br from-sky-500 via-sky-600 to-blue-500 text-white p-3.5 flex flex-col justify-between overflow-hidden select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.45)] transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <FileText className="h-4 w-4 text-sky-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">PCSF</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              {stats.approvedPcsfCount || 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold block text-sky-100/90 leading-none font-mono uppercase tracking-wider">
              Daily Count: {stats.dailyApprovedPcsfCount || 0}
            </span>
          </div>
        </motion.div>

        {/* Card 7: Puroks Coverage (SLATE/COBALT Neon Glow - 3D Pressed Deck) */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-32 rounded-2xl border-t border-x border-slate-200/80 border-b-[5px] border-r-[1.5px] border-b-slate-800 border-r-slate-700/40 shadow-[0_8px_20px_-4px_rgba(71,85,105,0.25)] hover:shadow-[0_16px_32px_-4px_rgba(71,85,105,0.45)] bg-gradient-to-br from-white to-slate-50/70 overflow-hidden flex transition-all duration-300"
        >
          {/* Puroks Side - Diagonal Clip-path with high-shimmer gloss */}
          <div 
            className="absolute inset-y-0 left-0 w-[58%] bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white p-3.5 flex flex-col justify-between z-10 select-none shadow-[inset_0_2.5px_5px_rgba(255,255,255,0.35),_4px_0_15px_rgba(71,85,105,0.3)]"
            style={{ clipPath: 'polygon(0 0, 100% 0, 82% 100%, 0 100%)' }}
          >
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-md rounded-lg">
                <Database className="h-3.5 w-3.5 text-slate-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
              </div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">Puroks Listed</span>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-2xl font-black block tracking-tight leading-none text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
                {stats.puroksCount || 0}
              </span>
            </div>
            <div>
              <span className="text-[9.5px] font-extrabold block text-slate-200 leading-none uppercase tracking-wider">
                Puroks Cover
              </span>
            </div>
          </div>

          {/* Barangay Side */}
          <div className="absolute inset-y-0 right-0 w-[47%] p-3.5 flex flex-col justify-between items-end text-right select-none bg-gradient-to-bl from-slate-50 to-slate-100/40">
            <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
              Barangays Listed
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-xl font-black block tracking-tight leading-none text-slate-700 font-mono drop-shadow-[0_1px_3px_rgba(71,85,105,0.1)]">
                {totalBarangaysCount || 0}
              </span>
            </div>
            <div>
              <span className="text-[8px] font-black uppercase block text-slate-400 tracking-wider leading-none">
                Sectors Active
              </span>
            </div>
          </div>
        </motion.div>

      </div>

      {/* 3. Primary Graphics / Trends */}
      <div className="grid grid-cols-1 gap-6 font-sans">
        {/* Daily Field Movement */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5 font-mono">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Daily Field Movement
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Last 7 Days survey & enrollment operational flow</p>
            </div>
            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-2.5 py-1 font-mono font-bold uppercase">
              Operational Flow
            </span>
          </div>

          {/* Premium Dashboard text badges to match the active chart curves exactly */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-5 select-none font-sans">
            {/* MEMBERS BADGE */}
            <div className="bg-gradient-to-br from-indigo-50/45 to-purple-50/45 hover:from-indigo-50 hover:to-purple-50 border border-indigo-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#8b5cf6] shadow-sm" />
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider leading-none">TOTAL MEMBERS</span>
            </div>

            {/* GEOTAGGED BADGE */}
            <div className="bg-gradient-to-br from-blue-50/45 to-cyan-50/45 hover:from-blue-50 hover:to-cyan-50 border border-blue-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#2563eb] shadow-sm" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider leading-none">GEOTAGGED</span>
            </div>

            {/* PMRF BADGE */}
            <div className="bg-gradient-to-br from-amber-50/45 to-orange-50/45 hover:from-amber-50 hover:to-orange-50 border border-amber-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#f59e0b] shadow-sm" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider leading-none">PMRF</span>
            </div>

            {/* YAKAP BADGE */}
            <div className="bg-gradient-to-br from-rose-50/45 to-red-50/45 hover:from-rose-50 hover:to-red-50 border border-rose-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#f43f5e] shadow-sm" />
              <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider leading-none">YAKAP</span>
            </div>

            {/* SFC ENROLLMENT BADGE */}
            <div className="bg-gradient-to-br from-emerald-50/45 to-teal-50/45 hover:from-emerald-50 hover:to-teal-50 border border-emerald-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#10b981] shadow-sm" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider leading-none">SFC ENROLLMENT</span>
            </div>

            {/* FPE BADGE */}
            <div className="bg-gradient-to-br from-cyan-50/45 to-teal-50/45 hover:from-cyan-50 hover:to-teal-50 border border-cyan-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#0891b2] shadow-sm" />
              <span className="text-[10px] font-black text-cyan-700 uppercase tracking-wider leading-none">FPE</span>
            </div>

            {/* PCSF BADGE */}
            <div className="bg-gradient-to-br from-sky-50/45 to-blue-50/45 hover:from-sky-50 hover:to-blue-50 border border-sky-100 rounded-xl p-2 flex items-center justify-center gap-1.5 transition-all shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#0ea5e9] shadow-sm" />
              <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider leading-none">PCSF</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={(stats.dailyMovement || []).map((item: any) => ({
                  ...item,
                  sfc_enrollment: (item.sfc_egov || 0) + (item.sfc_manual || 0)
                }))} 
                margin={{ top: 15, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.005} />
                  </linearGradient>
                  <linearGradient id="colorGeotagged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.005} />
                  </linearGradient>
                  <linearGradient id="colorPmrf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.005} />
                  </linearGradient>
                  <linearGradient id="colorYakap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.005} />
                  </linearGradient>
                  <linearGradient id="colorSfcEnrollment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.005} />
                  </linearGradient>
                  <linearGradient id="colorFpe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0.005} />
                  </linearGradient>
                  <linearGradient id="colorPcsf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.005} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <Tooltip content={<CustomTooltip />} />
                
                <Area type="monotone" name="members" dataKey="members" stroke="#8b5cf6" strokeWidth={2.6} fillOpacity={1} fill="url(#colorMembers)" activeDot={{ r: 5 }} />
                <Area type="monotone" name="geotagged" dataKey="geotagged" stroke="#2563eb" strokeWidth={2.6} fillOpacity={1} fill="url(#colorGeotagged)" activeDot={{ r: 5 }} />
                <Area type="monotone" name="pmrf" dataKey="pmrf" stroke="#f59e0b" strokeWidth={2.6} fillOpacity={1} fill="url(#colorPmrf)" activeDot={{ r: 5 }} />
                <Area type="monotone" name="yakap" dataKey="yakap" stroke="#f43f5e" strokeWidth={2.6} fillOpacity={1} fill="url(#colorYakap)" activeDot={{ r: 5 }} />
                <Area type="monotone" name="sfc_enrollment" dataKey="sfc_enrollment" stroke="#10b981" strokeWidth={2.6} fillOpacity={1} fill="url(#colorSfcEnrollment)" activeDot={{ r: 5 }} />
                <Area type="monotone" name="fpe" dataKey="fpe" stroke="#0891b2" strokeWidth={2.6} fillOpacity={1} fill="url(#colorFpe)" activeDot={{ r: 5 }} />
                <Area type="monotone" name="pcsf" dataKey="pcsf" stroke="#0ea5e9" strokeWidth={2.6} fillOpacity={1} fill="url(#colorPcsf)" activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* HOUSEHOLDS APPROVED CHART */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5 font-mono">
                <Home className="h-4 w-4 text-emerald-600" />
                HOUSEHOLDS APPROVED CHART
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Weekly approved households counts tracking metrics</p>
            </div>
            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-2.5 py-1 font-mono font-bold uppercase">
              Approved Flow
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyApprovedHouseholds || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="glowApprovedHouseholds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#0d9488' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '9px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="approvedCount" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#glowApprovedHouseholds)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Barangay Coverage Density Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Barangay Coverage Density
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Household geographic distribution across registered barangay sectors</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search Barangay..."
                value={brgSearch}
                onChange={(e) => setBrgSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-[11px] border border-slate-200 focus:border-emerald-500 outline-none rounded-lg transition duration-150 font-bold"
              />
            </div>

            {/* Sort Control */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[9px] font-bold gap-0.5 font-mono">
              <button 
                onClick={() => setBrgSort('highest')} 
                className={`px-2 py-1 rounded transition ${brgSort === 'highest' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-450 hover:text-slate-800'}`}
              >
                most
              </button>
              <button 
                onClick={() => setBrgSort('lowest')} 
                className={`px-2 py-1 rounded transition ${brgSort === 'lowest' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-450 hover:text-slate-800'}`}
              >
                least
              </button>
              <button 
                onClick={() => setBrgSort('alphabetical')} 
                className={`px-2 py-1 rounded transition ${brgSort === 'alphabetical' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-450 hover:text-slate-800'}`}
              >
                A-Z
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
          {processedBarangays.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-10 text-center bg-slate-50 rounded-xl p-4">
              <MapPin className="h-7 w-7 text-slate-350 animate-bounce mb-2" />
              <strong className="block text-slate-800 text-[11px] font-black uppercase">No sectors matches your search</strong>
              <p className="text-[10px] text-slate-400 mt-1">Ensure correct names are registered in administrative settings tabs.</p>
            </div>
          ) : (
            processedBarangays.map((b: any, index) => {
              const percentage = maxBrgVal > 0 ? (b.households / maxBrgVal) * 100 : 0;
              return (
                <div 
                  key={b.name} 
                  className="flex items-center justify-between gap-4 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl transition duration-150"
                >
                  <div className="w-1/3 min-w-0">
                    <strong className="block text-slate-800 text-[11px] font-black uppercase truncate" title={b.name}>
                      {b.name}
                    </strong>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5 font-mono">
                      Sector Coverage
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="h-3 w-full bg-slate-200/60 rounded-full overflow-hidden relative shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 through-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, percentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-16 text-right shrink-0">
                    <span className="font-mono font-black text-xs text-slate-800 block">{b.households}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block mt-0.5">Families</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Households Table and Audits logs Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Household Submissions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm xl:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                <Home className="h-4 w-4 text-emerald-600" />
                Recent Household Submissions
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Latest field registration index logs</p>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-755 border border-slate-200 rounded px-2.5 py-1 font-mono font-bold uppercase">
              Indices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold h-9 uppercase tracking-wider text-[10px]">
                  <th className="py-2">Household Head</th>
                  <th className="py-2">Location/Barangay</th>
                  <th className="py-2">Field Encoder</th>
                  <th className="py-2">Date Added</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(stats.recentAdded || []).map((h: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition duration-150 group/row h-11">
                    <td className="py-2.5 font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {h.householdHead}
                    </td>
                    <td className="py-2.5">
                      <span className="px-2.5 py-0.75 bg-slate-100 rounded text-[9px] text-slate-600 font-mono font-bold border border-slate-200/50 uppercase">
                        {h.barangay}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500 font-semibold">{h.addedBy}</td>
                    <td className="py-2.5 text-slate-400 font-mono font-semibold">{h.dateAdded}</td>
                    <td className="py-2.5 text-right">
                      <button className="text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 ml-auto font-black cursor-pointer">
                        View <ChevronRight className="h-3.5 w-3.5 group-hover/row:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Audit Timestream */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
                Real-time Audit Timestream
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Active update logs across all clinical departments</p>
            </div>
            <span className="flex items-center gap-1 text-[8px] bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-extrabold shrink-0 animate-pulse">
              Active
            </span>
          </div>

          <div className="flex-1 max-h-[240px] overflow-y-auto pr-1 space-y-4">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <Clock className="h-6 w-6 text-slate-350 animate-spin mb-2" style={{ animationDuration: '6s' }} />
                <p className="text-[10px] font-bold">Waiting for system logs updates...</p>
              </div>
            ) : (
              logs.map((log, index) => {
                let moduleIcon = <Activity className="h-3.5 w-3.5 text-emerald-500" />;
                let bgGlow = "bg-emerald-50 text-emerald-600 border border-emerald-100";
                
                const actionUpper = (log.action || '').toUpperCase();
                if (log.module === 'ProfileSettings' || log.module === 'Audit' || actionUpper.includes('PROFILE') || actionUpper.includes('BRAND')) {
                  moduleIcon = <Users className="h-3.5 w-3.5 text-sky-500" />;
                  bgGlow = "bg-sky-50 text-sky-600 border border-sky-100";
                } else if (log.module === 'Household' || log.module === 'Households' || actionUpper.includes('HOUSEHOLD') || actionUpper.includes('UPLOAD')) {
                  moduleIcon = <Home className="h-3.5 w-3.5 text-indigo-500" />;
                  bgGlow = "bg-indigo-50 text-indigo-600 border border-indigo-100";
                } else if (log.module === 'HealthRecord' || log.module === 'Patient' || actionUpper.includes('HEALTH') || actionUpper.includes('DIAGNOSIS') || actionUpper.includes('PRESCRIPTION')) {
                  moduleIcon = <Heart className="h-3.5 w-3.5 text-rose-500" />;
                  bgGlow = "bg-rose-50 text-rose-600 border border-rose-100";
                } else if (log.module === 'Purok' || actionUpper.includes('GEOTAG') || actionUpper.includes('COORDINATE') || actionUpper.includes('LOCATION')) {
                  moduleIcon = <MapPin className="h-3.5 w-3.5 text-amber-500" />;
                  bgGlow = "bg-amber-50 text-amber-600 border border-amber-100";
                }

                return (
                  <div key={log.id || index} className="relative group/timeline flex gap-3">
                    {index < logs.length - 1 && (
                      <div className="absolute left-[14px] top-7 bottom-[-14px] w-0.5 bg-slate-100 group-hover/timeline:bg-emerald-150 transition-colors"></div>
                    )}
                    
                    <div className="relative z-10 shrink-0">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${bgGlow} shadow-xs transition-all`}>
                        {moduleIcon}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 bg-slate-50/30 hover:bg-slate-50/60 border border-slate-150 rounded-xl p-2.5 transition duration-150">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider font-mono">
                          {log.module || "System"}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 font-mono bg-white border border-slate-200 rounded px-1.5 py-0.25">
                          {log.time || log.date}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 leading-snug block break-words">
                        {log.action}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[8.5px] font-bold text-slate-450">
                        <span className="h-1 w-1 bg-green-500 rounded-full inline-block"></span>
                        <span className="truncate">by {log.user}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
