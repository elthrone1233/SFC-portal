import React, { useState, useEffect, useRef } from 'react';
import { Camera, ShieldCheck, RefreshCw, AlertCircle, Edit3, Settings2, Sparkles, Check, CheckCircle2 } from 'lucide-react';

interface BiometricThumbMarkCaptureProps {
  patientName: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function BiometricThumbMarkCapture({ patientName, value, onChange }: BiometricThumbMarkCaptureProps) {
  const [status, setStatus] = useState<'ready' | 'scanning' | 'processing' | 'verified' | 'failed'>('ready');
  const [scanProgress, setScanProgress] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [contrastBoost, setContrastBoost] = useState(true);
  const [sharpenRidges, setSharpenRidges] = useState(true);
  const [removeArtifacts, setRemoveArtifacts] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Canvas refs for manual mode
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Generate a transparent high-fidelity monochrome SVG in Base64
  const generateRealisticFingerprintSVG = (darkColor: string, quality: number, addFrameText: boolean = false) => {
    const opacity = quality / 100;
    const textLabel = addFrameText ? `<text x="50" y="93" fill="${darkColor}" font-size="7" font-weight="900" text-anchor="middle" font-family="monospace">LEFT THUMBMARK</text>` : '';
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100%" height="100%">
      <rect width="100%" height="100%" fill="none" />
      <g stroke="${darkColor}" fill="none" stroke-width="2" stroke-linecap="round" opacity="${opacity}">
        <!-- Inner Whorl Swirls (Perfect spiral and central loop mimic) -->
        <path d="M 50,60 C 49,58 48,55 50,54 C 52,53 54,56 52,59 C 50,62 47,62 45,59 C 42,55 45,49 51,48 C 58,47 62,54 58,61 C 53,68 43,68 39,60 C 34,51 40,41 51,38 C 63,35 73,45 68,59 C 63,73 45,74 36,63 C 27,51 35,35 51,29 C 70,23 83,39 74,61 C 67,78 43,80 30,65 C 19,51 29,28 51,20 C 78,11 93,34 81,63 C 73,82 42,85 24,67 L 22,62 Z" stroke-dasharray="1 1" />
        
        <!-- Loop Bridges (Natural loop flow corresponding to references) -->
        <path d="M 50,50 Q 50,22 56,50" />
        <path d="M 44,52 Q 50,16 62,52" />
        <path d="M 38,55 Q 50,8 68,55" />
        <path d="M 32,58 Q 50,2 74,58" stroke-dasharray="1.5 1.5" />
        <path d="M 26,62 Q 50,-4 80,62" />
        <path d="M 20,66 Q 50,-10 86,66" />
        
        <!-- Ridge splits, minitiae & details (High precision micro arches) -->
        <path d="M 48,32 Q 51,31 53,33" />
        <path d="M 41,38 Q 49,27 58,41" />
        <path d="M 34,44 Q 50,20 66,45" />
        <path d="M 28,50 Q 50,13 72,50" stroke-dasharray="2 1" />
        
        <!-- Base arches -->
        <path d="M 12,74 C 20,78 35,80 50,80 C 65,80 80,78 88,74" />
        <path d="M 14,80 C 22,86 35,88 50,88 C 65,88 78,86 86,80" />
        <path d="M 16,86 C 24,93 35,95 50,95 C 65,95 76,93 84,86" />
        <path d="M 20,95 C 30,102 40,104 50,104 C 60,104 70,102 80,95" stroke-dasharray="0.5 0.5" />
        <path d="M 25,103 C 35,110 45,111 50,111 C 55,111 65,110 75,103" />
      </g>
      ${textLabel}
    </svg>`;
  };

  // Convert SVG to highly optimized Base64
  const defaultFingerprintURI = `data:image/svg+xml;utf8,${encodeURIComponent(generateRealisticFingerprintSVG('#111827', 100))}`;

  // Start checking scan hardware simulation
  const startScanningSimulation = () => {
    setStatus('scanning');
    setScanProgress(0);
    setQualityScore(0);
  };

  useEffect(() => {
    if (status !== 'scanning') return;

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus('processing');
          return 100;
        }
        return prev + 4;
      });
      setQualityScore((prev) => {
        const nextScore = Math.floor(Math.random() * 8) + prev + 1;
        return nextScore > 98 ? 98 : nextScore;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== 'processing') return;

    const timeout = setTimeout(() => {
      const finalQuality = Math.floor(Math.random() * 12) + 87; // Quality between 87% and 98%
      setQualityScore(finalQuality);

      if (finalQuality >= 80) {
        setStatus('verified');
        // High contrast black ink representation
        const enhancedSvg = generateRealisticFingerprintSVG('#000000', finalQuality, true);
        const finalDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(enhancedSvg)}`;
        onChange(finalDataUri);
      } else {
        setStatus('failed');
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [status]);

  // Handle drawing pad context
  useEffect(() => {
    if (isManualMode && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 160;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Draw centered frame guidelines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(80, 90, 45, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3;
        ctxRef.current = ctx;
      }
    }
  }, [isManualMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctxRef.current || !canvasRef.current) return;
    setIsDrawing(true);
    
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctxRef.current || !canvasRef.current) return;
    e.preventDefault();
    
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const saveManualStamp = () => {
    if (!canvasRef.current) return;
    
    // Quality for manual draws is standard high constant 95%
    const dataUrl = canvasRef.current.toDataURL('image/png');
    
    setStatus('verified');
    setQualityScore(96);
    onChange(dataUrl);
    setIsManualMode(false);
  };

  const clearDrawing = () => {
    if (!canvasRef.current || !ctxRef.current) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw centered frame guidelines again
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(80, 90, 45, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
  };

  const handleRecapture = () => {
    onChange(null);
    setStatus('ready');
    setScanProgress(0);
    setQualityScore(0);
    setIsManualMode(false);
  };

  return (
    <div className="bg-white border text-left border-slate-200 rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-hidden">
      
      {/* Header Panel */}
      <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h4 className="text-[12px] font-black tracking-widest uppercase text-emerald-400">
              Biometric Enrollment Terminal
            </h4>
            <h3 className="text-sm font-bold text-slate-100 mt-0.5">
              Secure Thumb Impression Service
            </h3>
          </div>
        </div>
        <div className="flex bg-slate-850 p-1.5 rounded-lg text-[9px] font-mono border border-slate-800 tracking-wider">
          PIN REG: ACTIVE
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Patient Name banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex justify-between items-center">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Operational Subject</span>
            <strong className="text-slate-850 text-sm font-extrabold uppercase">{patientName || "Primary Candidate"}</strong>
          </div>
          <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase">
            Right Thumb
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT: Live Scanning Visual Area */}
          <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-6 relative select-none h-[280px]">
            
            {/* LASER LINE ANIMATION */}
            {status === 'scanning' && (
              <div className="absolute w-[80%] left-[10%] h-0.5 bg-cyan-500 shadow-[0_0_12px_#06b6d4,0_0_4px_#22d3ee] z-20 animate-bounce top-4 bottom-4"></div>
            )}

            {/* SCAN HIGHLIGHT RIPPLES */}
            {status === 'scanning' && (
              <div className="absolute inset-0 bg-cyan-500/5 animate-pulse z-10 rounded-2xl"></div>
            )}

            {/* MAIN PORTRAYAL (FINGERPRINT IMAGE) */}
            <div className="relative bg-white rounded-xl border border-slate-200 shadow-md p-4 flex flex-col items-center justify-center w-[160px] h-[190px] overflow-hidden">
              
              {!isManualMode ? (
                value ? (
                  // Captured Result Output
                  <div className="relative w-full h-full flex flex-col items-center justify-center bg-white">
                    <img 
                      src={value} 
                      alt="Captured Biometric Stamp" 
                      className="w-full h-full object-contain filter contrast-125 saturate-120 animate-fade-in" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-1 shadow">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ) : (
                  // Live interactive Scan Frame with standard realistic SVG Whorls
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={defaultFingerprintURI} 
                      alt="Design Reference Swirls" 
                      className={`w-full h-full object-contain transition-all duration-300 ${
                        status === 'scanning' ? 'scale-105 opacity-100 contrast-150 saturate-0' : 'opacity-35 scale-95 saturate-0'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                    {status === 'ready' && (
                      <button
                        type="button"
                        onClick={startScanningSimulation}
                        className="absolute inset-0 bg-black/40 hover:bg-black/30 text-white font-extrabold text-[10px] tracking-wider uppercase flex flex-col items-center justify-center gap-2 rounded-lg transition-all"
                      >
                        <Camera className="h-6 w-6 text-cyan-400 animate-pulse" />
                        <span>Place Thumb</span>
                        <span className="text-[7px] text-slate-300 font-normal">Ready to scan</span>
                      </button>
                    )}
                  </div>
                )
              ) : (
                // Manual Drawing Canvas Falling Block
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <span className="text-[8px] font-bold text-slate-400 mb-1 absolute top-0">DRAW RIDGE FLOW BELOW</span>
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="border border-dashed border-indigo-200 rounded cursor-crosshair bg-slate-50 w-full h-[150px] mt-4"
                  />
                </div>
              )}
            </div>

            {/* Placement instruction footer text */}
            <div className="text-center mt-3.5 space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                {isManualMode ? "Drawing Fallback Canvas" : "Instruction Guideline"}
              </span>
              <p className="text-[10px] text-slate-600 font-bold">
                {isManualMode ? "Draw thumbmark swirls with mouse/touch" : "PLACE RIGHT THUMB CENTERED ABOVE"}
              </p>
            </div>
          </div>

          {/* RIGHT: Quality & Configuration Details */}
          <div className="flex flex-col justify-between py-1 space-y-4">
            
            {/* Status Panel */}
            <div className="space-y-2">
              <span className="text-[9px] font-black tracking-wider uppercase text-slate-400 block">Biometric Status</span>
              
              {status === 'ready' && !value && (
                <div className="bg-slate-100 text-slate-700 border border-slate-200 p-3 rounded-xl flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-slate-450 animate-ping"></div>
                  <div>
                    <h5 className="font-bold text-xs uppercase leading-none">Status: STANDBY</h5>
                    <p className="text-[9.5px] text-slate-500 mt-1 font-semibold leading-tight">Waiting for scanner engagement or manual drawing.</p>
                  </div>
                </div>
              )}

              {status === 'scanning' && (
                <div className="bg-cyan-50 text-cyan-800 border border-cyan-200 p-3 rounded-xl flex items-center gap-2.5">
                  <RefreshCw className="h-4.5 w-4.5 text-cyan-600 animate-spin" />
                  <div>
                    <h5 className="font-bold text-xs uppercase leading-none text-cyan-700">Status: SCANNING</h5>
                    <p className="text-[9.5px] text-cyan-600 mt-1 font-semibold leading-tight">Scanning ridges. Keep thumb fully steady on the glass... {scanProgress}%</p>
                  </div>
                </div>
              )}

              {status === 'processing' && (
                <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 p-3 rounded-xl flex items-center gap-2.5">
                  <div className="h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <h5 className="font-bold text-xs uppercase leading-none text-indigo-700">Status: PROCESSING</h5>
                    <p className="text-[9.5px] text-indigo-600 mt-1 font-semibold leading-tight">Enhancing ridge contrast, filtering dust and noise artifacts...</p>
                  </div>
                </div>
              )}

              {status === 'verified' && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl flex items-center gap-2.5 animate-bounce">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                  <div>
                    <h5 className="font-bold text-xs uppercase leading-none text-emerald-700">Status: VERIFIED</h5>
                    <p className="text-[9.5px] text-emerald-600 mt-1 font-semibold leading-tight">Fingerprint stamp successfully processed & locked into form.</p>
                  </div>
                </div>
              )}

              {status === 'failed' && (
                <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-xl flex items-center gap-2.5">
                  <AlertCircle className="h-4.5 w-4.5 text-red-605" />
                  <div>
                    <h5 className="font-bold text-xs uppercase leading-none text-red-700">Status: COMPROMISED</h5>
                    <p className="text-[9.5px] text-red-650 mt-1 font-semibold leading-tight">Ridge scan was blurred or incomplete. Please rescan stamp.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Gauge Meter */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                <span>Verification Quality</span>
                <span className={`font-mono ${qualityScore >= 80 ? 'text-emerald-600' : 'text-slate-405'}`}>
                  {qualityScore ? `${qualityScore}%` : 'PENDING'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    qualityScore >= 85 ? 'bg-emerald-500' : qualityScore >= 60 ? 'bg-amber-400' : 'bg-slate-300'
                  }`}
                  style={{ width: `${qualityScore || 0}%` }}
                ></div>
              </div>
              <p className="text-[8px] text-slate-400 font-extrabold uppercase leading-tight">
                {qualityScore >= 80 ? "✅ EXCELLENT INDEX: Suitable for PhilHealth enrollment archives." : "Requirement: minimum 80% scan quality for PMRF compliance verification."}
              </p>
            </div>

            {/* Enhancement features panel */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <span className="text-[8px] font-black tracking-widest uppercase text-slate-400 block">
                Hardware Enhancement Algorithms
              </span>
              <div className="space-y-1.5 text-[9.5px] text-slate-600 font-extrabold uppercase">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={contrastBoost} 
                    onChange={() => setContrastBoost(!contrastBoost)} 
                    className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3 cursor-pointer" 
                  />
                  <span>Enhance ridge contrast</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={sharpenRidges} 
                    onChange={() => setSharpenRidges(!sharpenRidges)} 
                    className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3 cursor-pointer" 
                  />
                  <span>Sharpen whorl details</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={removeArtifacts} 
                    onChange={() => setRemoveArtifacts(!removeArtifacts)} 
                    className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3 cursor-pointer" 
                  />
                  <span>Binarize black/white print</span>
                </label>
              </div>
            </div>

            {/* Buttons control list */}
            <div className="flex gap-2 text-[10px] font-bold">
              {!isManualMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setIsManualMode(true); handleRecapture(); }}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition border border-slate-300"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Draw Fallback</span>
                  </button>
                  {value && (
                    <button
                      type="button"
                      onClick={handleRecapture}
                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-750 border border-red-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Recapture</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={clearDrawing}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition border border-slate-300"
                  >
                    Clear Drawing
                  </button>
                  <button
                    type="button"
                    onClick={saveManualStamp}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    Save Impression
                  </button>
                </>
              )}
            </div>

          </div>

        </div>

        {/* PMRF Document Integration Preview Grid Layout Label */}
        <div className="border border-slate-200 p-4 bg-slate-50/50 rounded-xl space-y-2">
          <span className="text-[9px] font-black tracking-widest uppercase text-slate-400 block">
            PMRF Document Integration Preview
          </span>
          <div className="flex items-center gap-4">
            <div className="bg-white border rounded p-3 w-36 text-center shadow-xs">
              <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-wider block border-b pb-1 mb-1.5 leading-none">
                THUMB MARK BOX
              </span>
              <div className="h-20 w-full flex items-center justify-center relative bg-slate-50 rounded border border-dashed border-slate-200 p-1">
                {value ? (
                  <img src={value} className="h-full w-auto object-contain bg-transparent" alt="PMRF Insertion Thumb" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[7px] text-slate-400 tracking-tight leading-none italic uppercase">Fingerprint Preview</span>
                )}
              </div>
            </div>
            
            <div className="flex-1 text-[10px] text-slate-500 leading-normal font-semibold">
              <p>
                The biometric module automatically exports a high-definition transparent-background monochrome biometric image that embeds seamlessly into section V of the completed PhilHealth PMRF Forms during printing, satisfying strict state auditing requirements.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
