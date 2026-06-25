import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Filter, Layers, Navigation, Home, Landmark } from 'lucide-react';
import { Household, Barangay, Purok } from '../types';

interface GeoMapProps {
  userEmail: string;
}

declare let L: any; // Leaflet global

// Predefined center coordinates for realistic Pagadian City coordinates projection
const BARANGAY_COORDS: { [key: string]: [number, number] } = {
  'San Francisco': [7.8284, 123.4332],
  'Santa Lucia': [7.8320, 123.4410],
  'Tuburan': [7.8150, 123.4280],
  'Lumbia': [7.8420, 123.4250],
  'Balangasan': [7.8240, 123.4450]
};

const PUROK_COORDS: { [key: string]: [number, number] } = {
  'Purok Mangga': [7.8290, 123.4310],
  'Purok Durian': [7.8275, 123.4350],
  'Purok Santol': [7.8300, 123.4340],
  'Purok Sampaguita': [7.8330, 123.4420],
  'Purok Rosal': [7.8310, 123.4390],
  'Purok Bougainvillea': [7.8160, 123.4290],
  'Purok Mahogany': [7.8440, 123.4240],
  'Purok Narra': [7.8400, 123.4260]
};

export default function GeoMap({ userEmail }: GeoMapProps) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [puroks, setPuroks] = useState<Purok[]>([]);
  
  const [barangayFilter, setBarangayFilter] = useState('');
  const [purokFilter, setPurokFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLayer, setActiveLayer] = useState<'all' | 'pmrf' | 'yakap'>('all');
  
  const [loading, setLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  // Pagadian City center coordinates
  const PAGADIAN_LAT = 7.8284;
  const PAGADIAN_LNG = 123.4332;

  // Memoized filters for 100% accurate coordinates and filtered totals synchronization
  const validGeotaggedHouseholds = React.useMemo(() => {
    return households.filter(h => {
      const lat = parseFloat(h.latitude as any);
      const lng = parseFloat(h.longitude as any);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [households]);

  const filteredHH = React.useMemo(() => {
    return validGeotaggedHouseholds.filter(h => {
      const matchBarangay = !barangayFilter || h.barangay === barangayFilter;
      const matchPurok = !purokFilter || h.purok === purokFilter;
      
      const matchLayer = 
        activeLayer === 'all' ||
        (activeLayer === 'pmrf' && h.pmrfStatus === 'Willing') ||
        (activeLayer === 'yakap' && h.yakapWillingStatus === 'Willing');

      const matchSearch = !searchTerm || h.householdHead.toLowerCase().includes(searchTerm.toLowerCase());
      return matchBarangay && matchPurok && matchLayer && matchSearch;
    });
  }, [validGeotaggedHouseholds, barangayFilter, purokFilter, activeLayer, searchTerm]);

  // Dynamically load Leaflet and Leaflet.markercluster CDN assets
  useEffect(() => {
    // 1. Load Leaflet CSS
    let cssLink = document.getElementById('leaflet-css-link');
    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.id = 'leaflet-css-link';
      cssLink.setAttribute('rel', 'stylesheet');
      cssLink.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      document.head.appendChild(cssLink);
    }

    // 2. Load MarkerCluster CSS files
    let mcCss1 = document.getElementById('markercluster-css-1');
    if (!mcCss1) {
      mcCss1 = document.createElement('link');
      mcCss1.id = 'markercluster-css-1';
      mcCss1.setAttribute('rel', 'stylesheet');
      mcCss1.setAttribute('href', 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css');
      document.head.appendChild(mcCss1);
    }
    let mcCss2 = document.getElementById('markercluster-css-2');
    if (!mcCss2) {
      mcCss2 = document.createElement('link');
      mcCss2.id = 'markercluster-css-2';
      mcCss2.setAttribute('rel', 'stylesheet');
      mcCss2.setAttribute('href', 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css');
      document.head.appendChild(mcCss2);
    }

    // 3. Load Leaflet JS, then MarkerCluster JS sequentially
    const loadScripts = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          let leafScript = document.getElementById('leaflet-js-script') as HTMLScriptElement;
          if (!leafScript) {
            leafScript = document.createElement('script');
            leafScript.id = 'leaflet-js-script';
            leafScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            leafScript.onload = () => resolve();
            leafScript.onerror = (err) => reject(err);
            document.body.appendChild(leafScript);
          } else if ((window as any).L) {
            resolve();
          } else {
            leafScript.addEventListener('load', () => resolve());
            leafScript.addEventListener('error', (err) => reject(err));
          }
        });

        await new Promise<void>((resolve, reject) => {
          let clusterScript = document.getElementById('leaflet-markercluster-script') as HTMLScriptElement;
          if (!clusterScript) {
            clusterScript = document.createElement('script');
            clusterScript.id = 'leaflet-markercluster-script';
            clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js';
            clusterScript.onload = () => resolve();
            clusterScript.onerror = (err) => reject(err);
            document.body.appendChild(clusterScript);
          } else if ((window as any).L && (window as any).L.markerClusterGroup) {
            resolve();
          } else {
            clusterScript.addEventListener('load', () => resolve());
            clusterScript.addEventListener('error', (err) => reject(err));
          }
        });

        setLeafletLoaded(true);
      } catch (err) {
        console.error('Failed to load Map scripts:', err);
      }
    };

    loadScripts();

    // Fetch all required data in parallel
    fetchAllMapData();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const fetchAllMapData = async () => {
    setLoading(true);
    try {
      const [hRes, bRes, pRes] = await Promise.all([
        fetch('/api/households?all=true', { headers: { 'x-user-email': userEmail } }),
        fetch('/api/barangays'),
        fetch('/api/puroks')
      ]);

      if (hRes.ok) {
        const hData = await hRes.json();
        // Keep approved ones for display on the map
        setHouseholds(hData.filter((h: any) => !h.deletedAt));
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBarangays(bData.barangays || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPuroks(pData || []);
      }
    } catch (e) {
      console.error('Error fetching map data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Plot and update active map markers
  useEffect(() => {
    if (!leafletLoaded || !window.hasOwnProperty('L') || !document.getElementById('leaflet-map-div')) return;

    if (!mapRef.current) {
      mapRef.current = L.map('leaflet-map-div', {
        center: [PAGADIAN_LAT, PAGADIAN_LNG],
        zoom: 13,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      // Create a Marker Cluster Group if available, otherwise fallback to standard LayerGroup
      if (L.markerClusterGroup) {
        markersGroupRef.current = L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          disableClusteringAtZoom: 18,
          maxClusterRadius: 50
        }).addTo(mapRef.current);
      } else {
        markersGroupRef.current = L.layerGroup().addTo(mapRef.current);
      }
    }

    plotMarkers();

    // Invalidate size immediately and with small timeouts to secure the container dimension scanning
    if (mapRef.current) {
      mapRef.current.invalidateSize();
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
      return () => clearTimeout(timer);
    }

  }, [leafletLoaded, households, barangays, puroks, barangayFilter, purokFilter, searchTerm, activeLayer, loading]);

  const plotMarkers = () => {
    if (!markersGroupRef.current || !mapRef.current) return;

    // Clear previous elements
    markersGroupRef.current.clearLayers();

    const allPositions: [number, number][] = [];

    const getHouseholdIcon = (h: Household) => {
      // 3D Color grading representing respective statuses:
      // Red Purple: PMRF Status Consent AND Yakap Willing
      // Emerald Green: PMRF Willing Consent
      // Cyan Teal: Yakap Willing
      // Royal Blue: Basic Geotag

      let gradientClasses = "from-sky-600 via-blue-500 to-cyan-300 border-sky-400";
      let shadowColor = "rgba(30,58,138,0.45)";
      let iconEmoji = "📍";

      if (h.pmrfStatus === 'Willing' && h.yakapWillingStatus === 'Willing') {
        gradientClasses = "from-purple-600 via-indigo-600 to-violet-400 border-purple-400";
        shadowColor = "rgba(109,40,217,0.45)";
        iconEmoji = "❇️";
      } else if (h.pmrfStatus === 'Willing') {
        gradientClasses = "from-emerald-600 via-green-500 to-emerald-300 border-emerald-400";
        shadowColor = "rgba(16,185,129,0.45)";
        iconEmoji = "📑";
      } else if (h.yakapWillingStatus === 'Willing') {
        gradientClasses = "from-teal-600 via-cyan-500 to-teal-300 border-teal-400";
        shadowColor = "rgba(20,184,166,0.45)";
        iconEmoji = "🤝";
      }

      return L.divIcon({
        html: `
          <div class="map-icon-3d-household relative flex items-center justify-center animate-fade-in" style="width: 28px; height: 28px;">
            <div class="absolute inset-0 rounded-full bg-gradient-to-tr ${gradientClasses} shadow-[0_4px_10px_${shadowColor},inset_-2.5px_-2.5px_6px_rgba(0,0,0,0.55),inset_2.5px_2.5px_6px_rgba(255,255,255,0.6)] flex items-center justify-center">
              <span class="text-[12px]" style="filter: drop-shadow(0px 1px 1px rgba(0,0,0,0.85));">${iconEmoji}</span>
            </div>
            <div class="absolute -bottom-1.5 w-4 h-1.5 bg-black/25 rounded-full blur-[1.5px]"></div>
          </div>
        `,
        className: 'custom-household-3dicon',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
      });
    };

    filteredHH.forEach(h => {
      const lat = parseFloat(h.latitude as any);
      const lng = parseFloat(h.longitude as any);

      // Build household members text beautifully
      const dependentsCount = h.dependents ? h.dependents.length : 0;
      const dependentsNames = h.dependents && h.dependents.length > 0
        ? h.dependents.map((dep: any) => `${dep.firstName || ''} ${dep.lastName || ''}`).join(', ')
        : 'None registered';

      const popupHtml = `
        <div style="font-family: Arial, sans-serif; font-size: 11px; padding: 2px;">
          <p style="margin:0; font-size:10px; text-transform:uppercase; font-weight:700; color:#475569;">${h.householdNumber}</p>
          <h4 style="margin: 0 0 6px 0; color: #1e3a8a; font-size:13px; font-weight:bold;">${h.householdHead}</h4>
          <p style="margin: 2px 0;"><strong>Barangay:</strong> ${h.barangay}</p>
          <p style="margin: 2px 0;"><strong>Purok:</strong> ${h.purok || 'N/A'}</p>
          <p style="margin: 2px 0;"><strong>Active Coordinates:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
          <p style="margin: 2px 0;"><strong>Contact:</strong> ${h.contactNumber || 'N/A'}</p>
          <p style="margin: 2.5px 0;"><strong>Household Members (${dependentsCount}):</strong> <span style="color:#2563eb; font-weight:600;">${dependentsNames}</span></p>
          <p style="margin: 2px 0;"><strong>PhilHealth PIN:</strong> <span style="font-family:monospace; font-weight:bold; color: #475569;">${h.pmrfDetails?.philhealthId || 'N/A'}</span></p>
          <p style="margin: 2px 0;"><strong>PMRF Consent:</strong> <span style="color: ${h.pmrfStatus === 'Willing' ? '#10b981' : '#ef4444'}; font-weight:700;">${h.pmrfStatus === 'Willing' ? 'Consent Agreed' : 'Pending/No'}</span></p>
          <p style="margin: 2px 0;"><strong>Yakap Willing:</strong> <span style="color: ${h.yakapWillingStatus === 'Willing' ? '#14b8a6' : '#94a3b8'}; font-weight:700;">${h.yakapWillingStatus}</span></p>
          <p style="margin: 2px 0;"><strong>Verification:</strong> <span style="font-weight:700; color:${h.approvalStatus === 'Approved' ? '#10b981' : '#f59e0b'}">${h.approvalStatus}</span></p>
          <div style="border-top:1px solid #e1e8f0; margin-top:6px; padding-top:4px; font-size:9px; color:#64748b;">
            Logged by: ${h.createdBy}
          </div>
        </div>
      `;

      L.marker([lat, lng], { icon: getHouseholdIcon(h) })
        .bindPopup(popupHtml)
        .addTo(markersGroupRef.current);

      allPositions.push([lat, lng]);
    });

    // Set bounds automatically to accommodate all mapped items
    const validPositions = allPositions.filter(pos => 
      Array.isArray(pos) && 
      pos.length === 2 && 
      typeof pos[0] === 'number' && !isNaN(pos[0]) &&
      typeof pos[1] === 'number' && !isNaN(pos[1])
    );

    if (validPositions.length > 0 && mapRef.current) {
      try {
        const bounds = L.latLngBounds(validPositions);
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { maxZoom: 15, padding: [40, 40] });
        }
      } catch (err) {
        console.warn('Fit bounds error safely suppressed:', err);
      }
    }
  };

  const getFilteredPuroksList = () => {
    if (!barangayFilter) return puroks;
    return puroks.filter(p => p.barangay === barangayFilter);
  };

  const uniqueBarangays = Array.from(new Set(barangays.map(b => b.name)));

  return (
    <div className="space-y-4 font-sans bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Navigation className="h-4.5 w-4.5 text-blue-600 animate-bounce" />
            Pagadian Geo-Spatial Population Mapping Portal
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Geotag overlay mapping featuring active marker clustering with smart PMRF Status Consent and Yakap Willing parameters
          </p>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Active Layer View Selector */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border mr-1">
            <button
              onClick={() => setActiveLayer('all')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                activeLayer === 'all' ? 'bg-white shadow-xs text-blue-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🌐 All Geotags
            </button>
            <button
              onClick={() => setActiveLayer('pmrf')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                activeLayer === 'pmrf' ? 'bg-white shadow-xs text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 PMRF Consent
            </button>
            <button
              onClick={() => setActiveLayer('yakap')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                activeLayer === 'yakap' ? 'bg-white shadow-xs text-teal-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🤝 Yakap Willing
            </button>
          </div>

          {/* Search (only relevant for households profile search) */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search head name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-[11px] px-2 py-1.5 pl-6.5 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
            />
          </div>

          {/* Barangay filter dropdown */}
          <select
            value={barangayFilter}
            onChange={(e) => { setBarangayFilter(e.target.value); setPurokFilter(''); }}
            className="bg-slate-50 border border-slate-200 text-[11px] px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Barangays</option>
            {uniqueBarangays.map((b, i) => (
              <option key={i} value={b}>{b}</option>
            ))}
          </select>

          {/* Purok filter dropdown */}
          <select
            value={purokFilter}
            onChange={(e) => setPurokFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-[11px] px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Puroks</option>
            {getFilteredPuroksList().map((p, i) => (
              <option key={i} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative w-full h-[520px] rounded-xl border border-slate-200 shadow-inner overflow-hidden">
        <div
          id="leaflet-map-div"
          className="w-full h-full"
        ></div>

        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex justify-center items-center z-20">
            <div className="text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-blue-600 border-r-transparent mr-2"></div>
              <p className="text-xs font-semibold text-slate-600 mt-2 animate-pulse">Loading all Geographic elements...</p>
            </div>
          </div>
        )}

        {!loading && !leafletLoaded && (
          <div className="absolute inset-0 bg-slate-50 flex justify-center items-center z-20 border border-dashed border-red-200">
            <p className="text-sm font-semibold text-slate-600 animate-pulse">Connecting Leaflet map layers...</p>
          </div>
        )}
      </div>

      {/* Aesthetic Map Legend Footer */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg gap-2 border">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-3.5 w-3.5 rounded-full bg-blue-500 inline-block text-center text-[8px] leading-3 text-white">📍</span>
            Plotted Geotags: <strong className="text-slate-800 font-bold">{filteredHH.length}</strong> <span className="text-slate-400">({validGeotaggedHouseholds.length} total)</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 inline-block text-center text-[8px] leading-3 text-white">📑</span>
            PMRF Consents Plotted: <strong className="text-slate-800 font-bold">{filteredHH.filter(h => h.pmrfStatus === 'Willing').length}</strong> <span className="text-slate-400">({validGeotaggedHouseholds.filter(h => h.pmrfStatus === 'Willing').length} total)</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-3.5 w-3.5 rounded-full bg-teal-500 inline-block text-center text-[8px] leading-3 text-white font-extrabold">🤝</span>
            Yakap Willing Plotted: <strong className="text-slate-800 font-bold">{filteredHH.filter(h => h.yakapWillingStatus === 'Willing').length}</strong> <span className="text-slate-400">({validGeotaggedHouseholds.filter(h => h.yakapWillingStatus === 'Willing').length} total)</span>
          </span>
        </div>
        <span className="font-mono text-[9px] text-slate-400">ACTIVE BASIN: Pagadian City Boundaries (Lat: 7.8284°, Lng: 123.4332°)</span>
      </div>
    </div>
  );
}
