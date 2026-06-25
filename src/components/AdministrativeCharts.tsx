import React, { useState } from 'react';
import { Search, MapPin, Sparkles, SlidersHorizontal, BarChart2, Grid, Layers, ArrowUpDown } from 'lucide-react';

interface BarangayType {
  id: string;
  name: string;
  puroksCount: number;
  householdProgressBar: number;
  membersProgressBar: number;
  pmrfProgressBar: number;
  yakapWillingCount: number;
}

interface PurokType {
  id: string;
  name: string;
  barangay: string;
  householdCount: number;
  pmrfCount: number;
  yakapWillingCount: number;
}

export function BarangayActivityChart({ barangays }: { barangays: BarangayType[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!barangays || barangays.length === 0) {
    return (
      <div className="bg-slate-900 text-slate-400 p-6 rounded-2xl border border-slate-800 text-center text-[11px] font-mono shadow-inner">
        No Barangay data registered for 3D Activity Mapping projections.
      </div>
    );
  }

  // Use a subset or all for display, let's display up to 8 barangays
  const displayData = barangays.slice(0, 8);
  const chartHeight = 160;
  const paddingX = 40;
  const paddingY = 30;
  const svgWidth = 600;
  const svgHeight = 240;

  const barWidth = 24;
  const colGap = (svgWidth - paddingX * 2 - barWidth * displayData.length) / (displayData.length - 1 || 1);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
      {/* Dynamic Grid Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent pointer-events-none" />

      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            📊 Barangay 3D Activity Cuboid Engine
          </h3>
          <p className="text-[10px] text-slate-400 font-medium">Real-time biometric & household onboarding ratios mapped onto 3D isometric vectors</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] font-mono text-slate-300">
            <span className="w-2.5 h-2.5 rounded bg-gradient-to-br from-emerald-400 to-teal-600 block"></span> Member Progress
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[500px]" style={{ overflow: 'visible' }}>
          {/* Grid lines in back perspective */}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = paddingY + (chartHeight / 4) * i;
            const val = 100 - i * 25;
            return (
              <g key={i} opacity="0.15">
                <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                <text x={paddingX - 10} y={y + 3} fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">{val}%</text>
              </g>
            );
          })}

          {/* 3D Base Area */}
          <polygon
            points={`${paddingX - 15},${paddingY + chartHeight + 10} ${svgWidth - paddingX + 15},${paddingY + chartHeight + 10} ${svgWidth - paddingX + 5},${paddingY + chartHeight} ${paddingX - 5},${paddingY + chartHeight}`}
            fill="#1e293b"
            opacity="0.4"
            stroke="#475569"
            strokeWidth="1"
          />

          {displayData.map((b, idx) => {
            const barHeight = (b.membersProgressBar / 100) * chartHeight || 10;
            const x = paddingX + idx * (barWidth + colGap);
            const yBase = paddingY + chartHeight;
            const yTop = yBase - barHeight;

            const isHovered = hoveredIdx === idx;

            // Define 3D Projection coordinates for isometric illusion
            const dFactor = 8; // Depth skew factor
            const p1 = `${x},${yTop}`; // Left Front-Top
            const p2 = `${x + barWidth},${yTop}`; // Right Front-Top
            const p3 = `${x + barWidth},${yBase}`; // Right Front-Bottom
            const p4 = `${x},${yBase}`; // Left Front-Bottom

            const p5 = `${x + dFactor},${yTop - dFactor}`; // Left Back-Top
            const p6 = `${x + barWidth + dFactor},${yTop - dFactor}`; // Right Back-Top
            const p7 = `${x + barWidth + dFactor},${yBase - dFactor}`; // Right Back-Bottom
            const p8 = `${x + dFactor},${yBase - dFactor}`; // Left Back-Bottom

            return (
              <g 
                key={b.id} 
                className="cursor-pointer transition-all duration-300"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* 3D Drop Shadow behind */}
                <polygon
                  points={`${x + dFactor + 2},${yBase} ${x + barWidth + dFactor + 4},${yBase} ${x + barWidth + dFactor + 14},${yBase - dFactor - 1} ${x + dFactor + 4},${yBase - dFactor - 1}`}
                  fill="#000000"
                  opacity={isHovered ? "0.6" : "0.3"}
                  className="transition-opacity duration-300"
                />

                {/* FRONT FACE (Main surface) */}
                <polygon
                  points={`${p1} ${p2} ${p3} ${p4}`}
                  fill={`url(#frontGrad-${idx})`}
                  stroke={isHovered ? "#34d399" : "#059669"}
                  strokeWidth="0.5"
                />

                {/* SIDE FACE (Adds depth perspective) */}
                <polygon
                  points={`${p2} ${p6} ${p7} ${p3}`}
                  fill={`url(#sideGrad-${idx})`}
                  stroke={isHovered ? "#10b981" : "#047857"}
                  strokeWidth="0.5"
                />

                {/* TOP FACE (Highlights cylinder block cap) */}
                <polygon
                  points={`${p1} ${p5} ${p6} ${p2}`}
                  fill={isHovered ? "#34d399" : "#059669"}
                  stroke={isHovered ? "#6ee7b7" : "#10b981"}
                  strokeWidth="0.5"
                />

                {/* Labels */}
                <text
                  x={x + barWidth / 2}
                  y={yBase + 24}
                  fill={isHovered ? "#34d399" : "#94a3b8"}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                  transform={`rotate(-15, ${x + barWidth / 2}, ${yBase + 24})`}
                >
                  {b.name.length > 9 ? `${b.name.substring(0, 8)}.` : b.name}
                </text>

                {/* Tooltip Overlay Indicator */}
                {isHovered && (
                  <g opacity="0.95" className="pointer-events-none" style={{ pointerEvents: 'none' }}>
                    {/* Glowing marker pin */}
                    <circle cx={x + barWidth / 2 + dFactor / 2} cy={yTop - dFactor - 8} r="3" fill="#10b981" />
                    <line x1={x + barWidth / 2 + dFactor / 2} y1={yTop - dFactor - 5} x2={x + barWidth / 2 + dFactor / 2} y2={yTop} stroke="#10b981" strokeWidth="1" />
                    
                    {/* Tooltip box */}
                    <rect x={Math.min(x - 30, svgWidth - 110)} y={yTop - 52} width="95" height="40" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                    <text x={Math.min(x - 30, svgWidth - 110) + 47} y={yTop - 40} fill="#ffffff" fontSize="7.5" fontWeight="black" textAnchor="middle">{b.name}</text>
                    <text x={Math.min(x - 30, svgWidth - 110) + 47} y={yTop - 29} fill="#34d399" fontSize="7" fontFamily="monospace" textAnchor="middle">Enrollment: {b.membersProgressBar}%</text>
                    <text x={Math.min(x - 30, svgWidth - 110) + 47} y={yTop - 19} fill="#a7f3d0" fontSize="7.5" textAnchor="middle">PMRF: {b.pmrfProgressBar}%</text>
                  </g>
                )}

                {/* Definitions for Gradients in this block iteration */}
                <defs>
                  <linearGradient id={`frontGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isHovered ? "#10b981" : "#047857"} />
                    <stop offset="100%" stopColor="#064e3b" />
                  </linearGradient>
                  <linearGradient id={`sideGrad-${idx}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#064e3b" />
                    <stop offset="100%" stopColor="#022c22" />
                  </linearGradient>
                </defs>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function PurokActivityChart({ puroks }: { puroks: PurokType[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [sortBy, setSortBy] = useState<'highest' | 'lowest' | 'alphabetical'>('highest');
  const [viewMode, setViewMode] = useState<'svg' | 'capsule'>('svg');

  if (!puroks || puroks.length === 0) {
    return (
      <div className="bg-slate-900 text-slate-450 p-6 rounded-2xl border border-slate-800 text-center text-[11px] font-mono shadow-inner">
        No Purok indices captured for 3D Activity projection mapping.
      </div>
    );
  }

  // Extract unique barangays represented in matching set
  const uniqueBarangays = Array.from(new Set(puroks.map(p => p.barangay).filter(Boolean)));

  // Interactive filtering and sorting
  const processedPuroks = [...puroks]
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBarangay = selectedBarangay === 'ALL' || p.barangay === selectedBarangay;
      return matchesSearch && matchesBarangay;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') return (b.householdCount || 0) - (a.householdCount || 0);
      if (sortBy === 'lowest') return (a.householdCount || 0) - (b.householdCount || 0);
      return a.name.localeCompare(b.name);
    });

  const maxVolume = Math.max(...puroks.map(p => p.householdCount || 1), 1);
  const totalCoveredPurokHouseholds = processedPuroks.reduce((sum, p) => sum + (p.householdCount || 0), 0);
  const activeSectorsCount = processedPuroks.length;

  // Sliced for vertical 3D SVG cylinders to prevent crushing
  const svgPuroks = processedPuroks.slice(0, 10);
  
  const chartHeight = 135;
  const paddingX = 40;
  const paddingY = 35;
  const svgWidth = 600;
  const svgHeight = 220;

  const widthUnit = svgPuroks.length > 0 ? (svgWidth - paddingX * 2) / svgPuroks.length : 1;
  const barWidth = Math.min(24, widthUnit * 0.55);
  const colGap = widthUnit - barWidth;

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 rounded-2xl border border-slate-800/80 shadow-xl relative overflow-hidden">
      {/* Light ray design */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(30,58,138,0.12),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent pointer-events-none" />

      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5 pb-3 border-b border-slate-800/60">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <span className="p-1 bg-blue-950/80 border border-blue-800/40 rounded text-blue-400">
              <Layers className="h-3.5 w-3.5 animate-pulse" />
            </span>
            Purok Demographic 3D Cylinder Projections
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">High-fidelity biometric mapping reflecting actual purok coverage & household volumes</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-blue-950/80 border border-blue-900/40 px-2.5 py-1 rounded-lg text-[9px] font-mono text-blue-300 font-black tracking-wide shrink-0">
            {activeSectorsCount} matched / {puroks.length} sectors active
          </span>
        </div>
      </div>

      {/* Interactive Controls Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-5 p-3.5 bg-slate-900/60 border border-slate-800/60 rounded-xl">
        {/* Search */}
        <div className="sm:col-span-4 relative">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
            <Search className="h-3 w-3" />
          </span>
          <input
            type="text"
            placeholder="Search Purok sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-[10px] pl-7.5 pr-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none rounded-lg text-slate-200 transition placeholder:text-slate-600 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-[8px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md"
            >
              clear
            </button>
          )}
        </div>

        {/* Barangay Filter */}
        <div className="sm:col-span-3 relative">
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="w-full bg-slate-950 border border-slate-805 text-[10px] px-2.5 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none rounded-lg text-slate-300 font-bold cursor-pointer"
          >
            <option value="ALL">All Barangays</option>
            {uniqueBarangays.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Sort Options */}
        <div className="sm:col-span-3 flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[9px] font-black">
          <button
            type="button"
            onClick={() => setSortBy('highest')}
            className={`flex-1 py-1.5 rounded-md transition whitespace-nowrap text-center ${sortBy === 'highest' ? 'bg-blue-600/90 text-white font-extrabold shadow-sm' : 'text-slate-450 hover:text-slate-200'}`}
          >
            Most
          </button>
          <button
            type="button"
            onClick={() => setSortBy('lowest')}
            className={`flex-1 py-1.5 rounded-md transition whitespace-nowrap text-center ${sortBy === 'lowest' ? 'bg-blue-600/90 text-white font-extrabold shadow-sm' : 'text-slate-450 hover:text-slate-200'}`}
          >
            Least
          </button>
          <button
            type="button"
            onClick={() => setSortBy('alphabetical')}
            className={`flex-1 py-1.5 rounded-md transition whitespace-nowrap text-center ${sortBy === 'alphabetical' ? 'bg-blue-600/90 text-white font-extrabold shadow-sm' : 'text-slate-450 hover:text-slate-200'}`}
          >
            A-Z
          </button>
        </div>

        {/* Display Mode Switcher */}
        <div className="sm:col-span-2 flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[9px]">
          <button
            type="button"
            onClick={() => setViewMode('svg')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition ${viewMode === 'svg' ? 'bg-blue-600/90 text-white font-black' : 'text-slate-450 hover:text-slate-200'}`}
            title="3D Column Chart View"
          >
            <BarChart2 className="h-3 w-3" />
            <span>Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('capsule')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition ${viewMode === 'capsule' ? 'bg-blue-600/90 text-white font-black' : 'text-slate-450 hover:text-slate-200'}`}
            title="3D Capsule Row Matrix"
          >
            <Grid className="h-3 w-3" />
            <span>Matrix</span>
          </button>
        </div>
      </div>

      {processedPuroks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-6">
          <MapPin className="h-8 w-8 text-blue-500 animate-pulse mb-2" />
          <h4 className="font-bold text-slate-300 text-xs">No matching Purok sub-sectors</h4>
          <p className="text-[9.5px] text-slate-500 mt-1 max-w-sm leading-relaxed">No registered puroks match your filter preferences. Review coordinates or write fresh sectors inside the Admin operating boundaries ledger.</p>
        </div>
      ) : viewMode === 'svg' ? (
        <div className="relative">
          {processedPuroks.length > 10 && (
            <div className="absolute top-1 right-1 flex items-center gap-1 bg-blue-950/65 border border-blue-800/40 px-2 py-0.5 rounded text-[8px] font-bold text-blue-300 z-10 font-mono">
              <Sparkles className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '6s' }} /> Showing top 10 of {processedPuroks.length} sectors
            </div>
          )}
          
          <div className="relative w-full overflow-x-auto select-none">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[500px]" style={{ overflow: 'visible' }}>
              <defs>
                {/* Unified Cylinder Gradients */}
                <linearGradient id="cyberCylinder-default" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#172554" />
                  <stop offset="25%" stopColor="#1d4ed8" />
                  <stop offset="65%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>

                <linearGradient id="cyberCylinder-hovered" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="25%" stopColor="#3b82f6" />
                  <stop offset="65%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>

                {/* Soft ground diffuse shadow */}
                <radialGradient id="base-shadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#000000" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Backdrop grid rings or levels */}
              {Array.from({ length: 4 }).map((_, i) => {
                const y = paddingY + (chartHeight / 3) * i;
                return (
                  <g key={i} opacity="0.1">
                    <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
                  </g>
                );
              })}

              {/* 3D Base grid perspective platform */}
              <polygon
                points={`${paddingX - 15},${paddingY + chartHeight + 10} ${svgWidth - paddingX + 15},${paddingY + chartHeight + 10} ${svgWidth - paddingX + 5},${paddingY + chartHeight} ${paddingX - 5},${paddingY + chartHeight}`}
                fill="#020617"
                opacity="0.8"
                stroke="#1e3a8a"
                strokeWidth="1.5"
              />

              {svgPuroks.map((p, idx) => {
                const normalizedHeight = ((p.householdCount || 0) / maxVolume) * chartHeight;
                const barHeight = Math.max(12, normalizedHeight);
                
                const x = paddingX + idx * widthUnit + colGap/2;
                const yBase = paddingY + chartHeight;
                const yTop = yBase - barHeight;

                const isHovered = hoveredIdx === idx;
                const rx = barWidth / 2;
                const ry = 4.5;

                return (
                  <g 
                    key={p.id}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Shadow base ellipse on floor */}
                    <ellipse
                      cx={x + rx}
                      cy={yBase}
                      rx={rx + 2.5}
                      ry={ry + 1}
                      fill="url(#base-shadow)"
                    />

                    {/* CYLINDER BACK BODY */}
                    <path
                      d={`M ${x},${yTop} A ${rx},${ry} 0 0,0 ${x + barWidth},${yTop} L ${x + barWidth},${yBase} A ${rx},${ry} 0 0,1 ${x},${yBase} Z`}
                      fill={isHovered ? "url(#cyberCylinder-hovered)" : "url(#cyberCylinder-default)"}
                      stroke={isHovered ? "#93c5fd" : "#3b82f6"}
                      strokeWidth="0.5"
                      className="transition-all duration-300"
                    />

                    {/* CYLINDER GLOW EMBOSS SHINE SLIT */}
                    <line
                      x1={x + rx * 0.4}
                      y1={yTop + ry}
                      x2={x + rx * 0.4}
                      y2={yBase}
                      stroke="#ffffff"
                      strokeWidth="1"
                      opacity={isHovered ? "0.6" : "0.25"}
                      className="transition-all duration-300"
                    />

                    {/* CYLINDER TOP CAP FLUID */}
                    <ellipse
                      cx={x + rx}
                      cy={yTop}
                      rx={rx}
                      ry={ry}
                      fill={isHovered ? "#a5f3fc" : "#60a5fa"}
                      stroke={isHovered ? "#ffffff" : "#3b82f6"}
                      strokeWidth="0.55"
                      className="transition-all duration-300"
                    />

                    {/* Label at bottom base angled skew */}
                    <text
                      x={x + rx}
                      y={yBase + 20}
                      fill={isHovered ? "#60a5fa" : "#94a3b8"}
                      fontSize="7.5"
                      fontWeight="black"
                      textAnchor="middle"
                      transform={`rotate(-15, ${x + rx}, ${yBase + 20})`}
                      className="transition-colors uppercase tracking-tight duration-150 font-sans"
                    >
                      {p.name.length > 8 ? `${p.name.substring(0, 7)}.` : p.name}
                    </text>

                    {/* Tooltip Overlay Indicator inside SVG */}
                    {isHovered && (
                      <g opacity="0.98" className="pointer-events-none" style={{ pointerEvents: 'none' }}>
                        <rect x={Math.min(x - 45, svgWidth - 130)} y={yTop - 56} width="115" height="44" rx="6" fill="#020617" stroke="#3b82f6" strokeWidth="1.5" />
                        <text x={Math.min(x - 45, svgWidth - 130) + 57} y={yTop - 44} fill="#ffffff" fontSize="7.5" fontWeight="black" textAnchor="middle">{p.name}</text>
                        <text x={Math.min(x - 45, svgWidth - 130) + 57} y={yTop - 34} fill="#93c5fd" fontSize="7" textAnchor="middle">Barangay: {p.barangay}</text>
                        <text x={Math.min(x - 45, svgWidth - 130) + 57} y={yTop - 24} fill="#60a5fa" fontSize="7" fontFamily="monospace" textAnchor="middle">Households: {p.householdCount || 0} fields</text>
                        <text x={Math.min(x - 45, svgWidth - 130) + 57} y={yTop - 14} fill="#34d399" fontSize="6.5" textAnchor="middle">PMRF Consent: {p.pmrfCount || 0} willing</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        /* High-fidelity 3D Capsule Matrix list grid */
        <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {processedPuroks.map((p) => {
              const proportion = maxVolume > 0 ? ((p.householdCount || 0) / maxVolume) * 100 : 0;
              return (
                <div 
                  key={p.id}
                  className="bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 p-3.5 rounded-2xl transition duration-150 flex flex-col justify-between gap-3 relative overflow-hidden group/capsule"
                >
                  <div className="flex justify-between items-start gap-2 min-w-0">
                    <div className="min-w-0">
                      <strong className="block text-[11px] font-black text-slate-100 uppercase tracking-tight truncate" title={p.name}>
                        {p.name}
                      </strong>
                      <span className="text-[8.5px] font-bold text-slate-500 uppercase block mt-0.5 whitespace-nowrap">
                        Barangay {p.barangay}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11.5px] font-mono font-black text-blue-400 block leading-none">
                        {p.householdCount || 0}
                      </span>
                      <span className="text-[7.5px] text-slate-500 uppercase block mt-1 font-bold">
                        Households
                      </span>
                    </div>
                  </div>

                  {/* Glassmorphic 3D Horizontal Cylinder Progress Tube */}
                  <div className="relative h-4.5 w-full bg-slate-950 rounded-full border border-slate-800/80 p-0.5 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] flex items-center">
                    {/* Left Endcap metallic shiny seal */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-700 rounded-l-full border-r border-slate-900 z-10" />

                    {/* Progress Liquid fill with medical capsule lighting reflection */}
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-500 relative"
                      style={{ width: `${Math.max(4, proportion)}%` }}
                    >
                      {/* Sub-cylinder inner specular shimmer */}
                      <div className="absolute inset-x-1 top-0.5 h-[35%] bg-white/20 rounded-t-full" />
                      {/* Pulse overlay inside tube */}
                      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-60 rounded-full" />
                    </div>

                    {/* Right Endcap metallic shiny seal */}
                    <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-l from-slate-600 via-slate-400 to-slate-700 rounded-r-full border-l border-slate-900 z-10" />

                    {/* Total capsule outer glare sheet overlay */}
                    <div className="absolute inset-x-1 top-0.5 h-[20%] bg-white/5 rounded-t-full pointer-events-none" />
                  </div>

                  {/* Sub text metrics */}
                  <div className="flex justify-between items-center text-[8.5px] font-bold text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse-slow" />
                      PMRF App Consent: <span className="font-mono text-emerald-400">{p.pmrfCount || 0} willing</span>
                    </span>
                    <span className="font-mono text-[8px] text-slate-500">
                      {Math.round(proportion)}% Density
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
