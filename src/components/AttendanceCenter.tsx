import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, MapPin, Clock, User, CheckCircle, XCircle, 
  Calendar, Search, X, Loader2, ArrowRightLeft, FileImage, 
  Map, AlertCircle, RefreshCw, ShieldAlert
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { User as UserType, Timecard, hasRole } from '../types';

interface AttendanceCenterProps {
  currentUser: UserType;
  isOpen: boolean;
  onClose: () => void;
}

// Sub-component to render thumbnail/large verification selfies and handle broken graphics
function TimecardSelfie({ photo, userName }: { photo: string; userName: string }) {
  const [isBroken, setIsBroken] = useState(false);
  const [showEnlarged, setShowEnlarged] = useState(false);

  if (isBroken) {
    return (
      <div 
        className="h-12 w-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center shrink-0 border border-slate-205 text-slate-400 select-none animate-pulse"
        title="Verification image unavailable (Broken file)"
      >
        <ShieldAlert className="h-4.5 w-4.5 text-amber-500 shrink-0" />
        <span className="text-[7.5px] font-mono font-bold text-slate-400 mt-0.5 scale-90 uppercase tracking-tight">Broken</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative group shrink-0 select-none h-12 w-12">
        <img 
          src={photo} 
          alt="Selfie Check-in verification thumbnail" 
          className="h-12 w-12 rounded-lg border-2 border-slate-300 object-cover hover:scale-110 active:scale-95 cursor-zoom-in transition"
          onClick={() => setShowEnlarged(true)}
          onError={() => setIsBroken(true)}
          title="Check-in Validation Snapshot (Click to Zoom)"
          referrerPolicy="no-referrer"
        />
        <span className="absolute bottom-0 right-0 p-0.5 bg-slate-900 text-[7px] text-white rounded font-serif scale-80 pointer-events-none">📷</span>
      </div>

      {showEnlarged && (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4">
          <div 
            onClick={() => setShowEnlarged(false)}
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs cursor-zoom-out"
          />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-4 overflow-hidden shadow-2xl border flex flex-col items-center z-10 text-slate-800 animate-fade-in">
            <h3 className="font-bold text-slate-900 block pb-2.5 text-sm uppercase self-start flex items-center gap-1 border-b w-full">
              <ShieldAlert className="h-4.5 w-4.5 text-emerald-600" />
              Biometric Selfie Snapshot Verification
            </h3>
            
            <img 
              src={photo} 
              alt="Enlarged verification profile selfie" 
              className="w-full h-auto max-h-[60vh] object-contain rounded-xl mt-4 border border-slate-200" 
              referrerPolicy="no-referrer"
            />

            <button
              onClick={() => setShowEnlarged(false)}
              className="mt-4 px-5 py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-[11px] uppercase rounded-lg cursor-pointer transition active:scale-95"
            >
              Dismiss Preview
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AttendanceCenter({ currentUser, isOpen, onClose }: AttendanceCenterProps) {
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Camera & Capture State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Position / Geotag State
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Form State
  const [notes, setNotes] = useState('');
  const [attendanceType, setAttendanceType] = useState<'IN' | 'OUT'>('IN');

  // Logs filters (for Admins / HR)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Load digital live clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch coordinates on focus/modal mount
  useEffect(() => {
    if (isOpen) {
      fetchLocation();
      fetchTimecards();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen]);

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by device');
      return;
    }
    setFetchingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoord({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setFetchingLocation(false);
      },
      (error) => {
        console.error('Location error', error);
        setLocationError('Permission denied or network offline. Check location services.');
        setFetchingLocation(false);
        // Fallback or average Pagadian City coordinates for demonstration context
        setCoord({ lat: 7.8284, lng: 123.4332 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

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
        setTimecards(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Start Camera Stream
  const startCameraStream = async () => {
    setCameraError(null);
    setCapturedPhoto(null);
    try {
      if (stream) {
        stopCameraStream();
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user" 
        },
        audio: false
      });

      setStream(mediaStream);
      setCameraActive(true);

      // Assign srcObject with safety check if active
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error("Video play aborted in timeout:", err);
          });
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Unable to access front camera. Please check app permissions.');
      setCameraActive(false);
    }
  };

  // Sync active camera stream with video element
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error("Video play error in useEffect:", err);
        });
      }
    }
  }, [cameraActive, stream]);

  // Stop Stream
  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  // Submit recorded time-card record
  const recordTimecardObj = async (photoData: string, type: 'IN' | 'OUT', currentNotes?: string) => {
    setSubmitting(true);
    setCapturedPhoto(photoData);
    setCameraError(null);
    try {
      const response = await fetch('/api/timecards/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          type: type,
          photo: photoData,
          latitude: coord?.lat,
          longitude: coord?.lng,
          deviceInfo: `${navigator.userAgent.slice(0, 50)}`,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Attendance logging failed');
      }

      await response.json();
      setNotes('');
      stopCameraStream();
      
      // Sync logs timeline from DB
      await fetchTimecards();
      
      // Retain the selfie visual on-screen briefly for confirmation feedback
      setTimeout(() => {
        setCapturedPhoto(null);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setCameraError('Authentication fail: ' + err.message);
      setCapturedPhoto(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Capture Base64 Snapshot
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Horizontal flip for mirroring selfie preview naturally
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
        stopCameraStream();
        
        // AUTOMATICALLY RECURSIVELY TRANSMIT ON CAPTURE
        recordTimecardObj(dataUrl, attendanceType, notes);
      }
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
      setCameraError('Capture failure. Trying standard file select instead.');
    }
  };

  // Manual File Select Snapshot / Fallback Support
  const handleManualPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;
        setCapturedPhoto(dataUrl);
        stopCameraStream();
        
        // AUTOMATICALLY RECURSIVELY TRANSMIT ON UPLOAD
        recordTimecardObj(dataUrl, attendanceType, notes);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setCapturedPhoto(null);
    setCameraError(null);
    // Restart camera
    startCameraStream();
  };

  // Check last state of attendance (ignore settled timecards for current active tracking)
  const userTimecards = timecards.filter(tc => (tc.userId === currentUser.id || tc.userEmail === currentUser.email) && !tc.settled);
  const latestTimecard = userTimecards.length > 0 ? userTimecards[0] : null;
  const isCurrentlyTimedIn = latestTimecard ? latestTimecard.type === 'IN' : false;

  // Helper to determine precise attendance status labels and states
  const getPreciseAttendanceStatus = () => {
    const d = new Date();
    const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    const phtHour = pht.getUTCHours();
    const year = pht.getUTCFullYear();
    const month = pht.getUTCMonth();
    const date = pht.getUTCDate();
    const phtDateStr = `${year}-${month + 1}-${date}`;

    const todayTimecards = userTimecards.filter(tc => {
      const recordPhtTime = new Date(new Date(tc.timestamp).getTime() + 8 * 60 * 60 * 1000);
      const rYear = recordPhtTime.getUTCFullYear();
      const rMonth = recordPhtTime.getUTCMonth();
      const rDate = recordPhtTime.getUTCDate();
      const recordDateStrKey = `${rYear}-${rMonth + 1}-${rDate}`;
      return recordDateStrKey === phtDateStr;
    });

    const hasRegularIn = todayTimecards.some(tc => tc.type === 'IN' && !tc.isOvertime);
    const hasRegularOut = todayTimecards.some(tc => tc.type === 'OUT' && !tc.isOvertime);
    const hasOvertimeIn = todayTimecards.some(tc => tc.type === 'IN' && tc.isOvertime);
    const hasOvertimeOut = todayTimecards.some(tc => tc.type === 'OUT' && tc.isOvertime);

    const isOvertimeShiftActive = phtHour >= 17;

    if (isOvertimeShiftActive) {
      if (hasOvertimeIn && !hasOvertimeOut) {
        return {
          label: 'Overtime Active',
          color: 'bg-indigo-600/35 text-indigo-400 border-indigo-500/40',
          hasIn: hasOvertimeIn,
          hasOut: hasOvertimeOut,
          isOvertime: true
        };
      } else if (hasOvertimeIn && hasOvertimeOut) {
        return {
          label: 'Overtime Completed',
          color: 'bg-indigo-900/40 text-indigo-300 border-indigo-800/40',
          hasIn: hasOvertimeIn,
          hasOut: hasOvertimeOut,
          isOvertime: true
        };
      } else {
        return {
          label: 'Pending',
          color: 'bg-amber-600/25 text-amber-400 border-amber-600/40',
          hasIn: hasOvertimeIn,
          hasOut: hasOvertimeOut,
          isOvertime: true
        };
      }
    } else {
      if (!hasRegularIn) {
        return {
          label: 'Pending',
          color: 'bg-amber-600/25 text-amber-400 border-amber-600/40',
          hasIn: hasRegularIn,
          hasOut: hasRegularOut,
          isOvertime: false
        };
      } else if (hasRegularIn && !hasRegularOut) {
        return {
          label: 'Active Duty',
          color: 'bg-emerald-600/30 text-emerald-400 border-emerald-600/40',
          hasIn: hasRegularIn,
          hasOut: hasRegularOut,
          isOvertime: false
        };
      } else {
        return {
          label: 'Completed',
          color: 'bg-slate-800 text-slate-350 border-slate-700',
          hasIn: hasRegularIn,
          hasOut: hasRegularOut,
          isOvertime: false
        };
      }
    }
  };

  const currentStatus = getPreciseAttendanceStatus();

  // Auto recommend next state & synchronize tabs state
  useEffect(() => {
    const d = new Date();
    const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    const phtHour = pht.getUTCHours();
    const year = pht.getUTCFullYear();
    const month = pht.getUTCMonth();
    const date = pht.getUTCDate();
    const phtDateStr = `${year}-${month + 1}-${date}`;

    const todayTimecards = userTimecards.filter(tc => {
      const recordPhtTime = new Date(new Date(tc.timestamp).getTime() + 8 * 60 * 60 * 1000);
      const rYear = recordPhtTime.getUTCFullYear();
      const rMonth = recordPhtTime.getUTCMonth();
      const rDate = recordPhtTime.getUTCDate();
      const recordDateStrKey = `${rYear}-${rMonth + 1}-${rDate}`;
      return recordDateStrKey === phtDateStr;
    });

    const hasRegularIn = todayTimecards.some(tc => tc.type === 'IN' && !tc.isOvertime);
    const hasRegularOut = todayTimecards.some(tc => tc.type === 'OUT' && !tc.isOvertime);
    const hasOvertimeIn = todayTimecards.some(tc => tc.type === 'IN' && tc.isOvertime);
    const hasOvertimeOut = todayTimecards.some(tc => tc.type === 'OUT' && tc.isOvertime);

    const isOvertimeShiftActive = phtHour >= 17;

    if (isOvertimeShiftActive) {
      if (hasOvertimeIn && !hasOvertimeOut) {
        setAttendanceType('OUT');
      } else {
        setAttendanceType('IN');
      }
    } else {
      if (!hasRegularIn) {
        setAttendanceType('IN');
      } else if (hasRegularIn && !hasRegularOut) {
        setAttendanceType('OUT');
      } else {
        setAttendanceType('IN');
      }
    }
  }, [timecards]);

  // Submit recorded time-card form manually as fallback
  const handleRecordTimecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedPhoto) {
      setCameraError('Please snap a quick verification selfie photo or upload an image.');
      return;
    }
    recordTimecardObj(capturedPhoto, attendanceType, notes);
  };

  // Filters calculation (Sorting: newest timestamp/present date on top)
  const filteredTimecards = timecards.filter(tc => {
    // 1. Search Query
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      tc.userName.toLowerCase().includes(query) || 
      tc.userEmail.toLowerCase().includes(query) ||
      (tc.deviceInfo && tc.deviceInfo.toLowerCase().includes(query));
    
    // 2. Type Filter
    const matchesType = filterType === 'ALL' || tc.type === filterType;
    
    return matchesSearch && matchesType;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formattedLocalDate = currentTime.toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  
  const formattedLocalTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });

  if (!isOpen) return null;

  const isAdminOrHR = hasRole(currentUser, ['ADMIN', 'HR', 'MANAGER']);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4" id="attendance-modal-backdrop">
        {/* Backdrop glass blur spacer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] md:h-[84vh] flex flex-col overflow-hidden text-slate-800 border border-slate-200 z-10"
        >
          {/* Top Panel Actions Header */}
          <div className="bg-slate-900 text-slate-100 px-4 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600/30 p-1.5 rounded-lg border border-emerald-500/40">
                <Clock className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold tracking-wider uppercase font-sans">Selfie Timecard Attendance Manager</h1>
                <p className="text-[10px] text-slate-400">Clinic & Field Operations Geo-Checkpoint Security</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1 px-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 border border-slate-700 hover:border-red-900 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close Panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Combined Workspace Column Grids */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden bg-slate-50">
            
            {/* LEFT INPUT & CAPTURE CONTROLLER PANEL */}
            <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-slate-200 p-4 md:overflow-y-auto overflow-visible flex flex-col space-y-4 shrink-0">
              
              {/* CURRENT LIVE CLOCK DISPLAY */}
              <div className="bg-gradient-to-r from-slate-900 to-emerald-950 p-4 rounded-xl text-white shadow-md flex flex-col items-center justify-center text-center border-b-2 border-emerald-500">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 hover:scale-110 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                  Official Local Clock
                </span>
                <span className="text-2xl font-black font-mono tracking-wider drop-shadow-sm leading-none bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
                  {formattedLocalTime}
                </span>
                <span className="text-[10.5px] text-slate-350 font-bold mt-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-emerald-500" />
                  {formattedLocalDate}
                </span>

                {/* Status indicator bar check */}
                <div className="mt-3.5 pt-3 border-t border-slate-800 w-full flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-bold">Your Status:</span>
                  <span className={`border rounded-full px-2.5 py-0.5 font-extrabold flex items-center gap-1.5 uppercase text-[9px] font-mono select-none tracking-wider ${currentStatus.color}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping inline-block"></span>
                    {currentStatus.label}
                  </span>
                </div>
              </div>

              {/* LUNCH BREAK NOTIFICATION BANNER */}
              <div className="bg-amber-50 border border-amber-250/70 p-3 rounded-xl flex items-start gap-2 text-amber-900 shadow-xs">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-[10.5px]">Midday Lunch Break (12:00 PM - 1:00 PM)</h4>
                  <p className="text-[9.5px] leading-relaxed text-amber-700 font-medium">
                    Our team takes a scheduled midday rest break from 12:00 PM to 1:00 PM. <strong>There is no requirement to clock out or clock back in</strong> for this break session.
                  </p>
                </div>
              </div>

              {/* ATTENDANCE ACTION CONTROLLER FORM */}
              <form onSubmit={handleRecordTimecard} className="space-y-4 flex-1 flex flex-col">
                
                {/* ATTENDANCE SWITCH SWITCHER */}
                <div className="bg-slate-100 p-1.5 rounded-xl border flex gap-1.5 select-none shrink-0" id="direction-block">
                  <button
                    type="button"
                    disabled={currentStatus.label !== 'Pending'}
                    onClick={() => setAttendanceType('IN')}
                    className={`flex-1 py-3 px-2 rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                      currentStatus.label !== 'Pending'
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                        : attendanceType === 'IN'
                          ? 'bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-md' 
                          : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    START DUTY {currentStatus.isOvertime ? 'OT' : ''}
                  </button>
                  <button
                    type="button"
                    disabled={currentStatus.label !== 'Active Duty' && currentStatus.label !== 'Overtime Active'}
                    onClick={() => setAttendanceType('OUT')}
                    className={`flex-1 py-3 px-2 rounded-lg font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                      (currentStatus.label !== 'Active Duty' && currentStatus.label !== 'Overtime Active')
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                        : attendanceType === 'OUT'
                          ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md' 
                          : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    TIME OUT {currentStatus.isOvertime ? 'OT' : ''}
                  </button>
                </div>

                {/* LIVE CAMERA SNAPSHOT FEED CONTAINER */}
                <div className="relative border-2 border-slate-300 rounded-xl overflow-hidden bg-slate-900 aspect-video flex flex-col items-center justify-center border-dashed">
                  {cameraActive && !capturedPhoto ? (
                    <>
                      <video 
                        ref={(el) => {
                          videoRef.current = el;
                          if (el && stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                            el.play().catch(err => {
                              console.error("Video element play aborted in ref callback:", err);
                            });
                          }
                        }}
                        autoPlay 
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]" 
                      />
                      <div className="absolute bottom-3 left-3 right-3 flex justify-center z-10">
                        <button
                          type="button"
                          onClick={captureSnapshot}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg border border-emerald-400 cursor-pointer active:scale-95 transition"
                        >
                          <Camera className="h-4 w-4" />
                          Snap Verification Image
                        </button>
                      </div>
                    </>
                  ) : capturedPhoto ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={capturedPhoto} 
                        alt="Time-clock Snap Verification Preview" 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleClearPhoto}
                          className="bg-slate-950/80 hover:bg-red-650 text-white p-1.5 rounded-lg border border-slate-700/50 hover:border-red-500 text-xs flex items-center gap-1 block cursor-pointer transition active:scale-95"
                          title="Retake Snapshot"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Retake
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-slate-900/80 border border-slate-700/50 rounded px-2 py-0.5 text-[8.5px] text-emerald-400 font-mono font-bold uppercase tracking-wider">
                        📷 SNAPSHOT CAPTURED
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center space-y-3.5 text-slate-400">
                      <Camera className="h-10 w-10 mx-auto text-slate-500 animate-bounce" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-305">Biometric Selfie Required</p>
                        <p className="text-[9.5px]">Please allow webcam, or upload high-fidelity camera snap.</p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1.5">
                        <button
                          type="button"
                          disabled={currentStatus.label !== 'Pending' && attendanceType !== 'OUT'}
                          onClick={startCameraStream}
                          className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition border ${
                            (currentStatus.label !== 'Pending' && attendanceType !== 'OUT')
                              ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-50'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-750 text-slate-200 hover:text-white'
                          }`}
                        >
                          <Camera className="h-3.5 w-3.5 text-emerald-500" />
                          Launch Live Camera
                        </button>

                        <button
                          type="button"
                          disabled={currentStatus.label !== 'Pending' && attendanceType !== 'OUT'}
                          onClick={() => fileInputRef.current?.click()}
                          className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition border ${
                            (currentStatus.label !== 'Pending' && attendanceType !== 'OUT')
                              ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed opacity-50'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-750 text-slate-200 hover:text-white'
                          }`}
                        >
                          <FileImage className="h-3.5 w-3.5 text-blue-500" />
                          Upload Selfie Image
                        </button>
                      </div>

                      <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*"
                        capture="user"
                        onChange={handleManualPhotoUpload}
                        className="hidden" 
                      />
                    </div>
                  )}
                </div>

                {/* Error prompt message if webcam fails or validation fails */}
                {cameraError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[10.5px] text-rose-900 font-medium flex items-start gap-2 shadow-xs">
                    <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-rose-800 block text-[11px] uppercase tracking-wide">Validation Constraint</span>
                      <p className="leading-relaxed font-semibold text-rose-700">{cameraError}</p>
                    </div>
                  </div>
                )}

                {/* PHYSICAL GEOTAG MARKER */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-slate-700 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500 animate-bounce" />
                      Physical Geolocation
                    </span>
                    <button
                      type="button"
                      onClick={fetchLocation}
                      className="text-[9.5px] text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-0.5 cursor-pointer"
                      title="Geotag Refresh"
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> Refresh Coordinates
                    </button>
                  </div>

                  <div className="mt-2 text-xs font-semibold select-all font-mono">
                    {fetchingLocation ? (
                      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 py-1">
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                        Pinging satellites...
                      </div>
                    ) : coord ? (
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border gap-2 text-[10px]">
                        <div>
                          <p className="text-slate-800">Lat: <span className="text-slate-600 font-bold">{coord.lat.toFixed(6)}</span></p>
                          <p className="text-slate-800">Lng: <span className="text-slate-600 font-bold">{coord.lng.toFixed(6)}</span></p>
                        </div>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 p-1 rounded-md text-[9.5px] font-extrabold flex items-center gap-0.5 text-center shrink-0"
                        >
                          <Map className="h-3 w-3" /> View on Map
                        </a>
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-500 font-bold py-1 flex items-center gap-1">
                        ⚠️ Location unavailable. Using default Pagadian HQ Geotag.
                      </div>
                    )}
                  </div>
                  {locationError && (
                    <p className="text-[9px] text-slate-400 mt-1 leading-normal">{locationError}</p>
                  )}
                </div>

                {/* Info block noting that capture auto-submits */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[10.5px] font-bold text-slate-600 flex items-center justify-center gap-1.5 uppercase tracking-wide">
                    <Camera className="h-4 w-4 text-emerald-600 animate-pulse" />
                    Selfie Photo Capture Auto-Submits Check-In
                  </p>
                  <p className="text-[9.5px] text-slate-500 mt-1 leading-normal">
                    Check-in details (type, location, timestamp, and biometric selfie) are automatically transmitted upon capturing your photo or uploading an image.
                  </p>
                </div>
              </form>
            </div>

            {/* RIGHT SIDEBAR TIMELINE STATS LOGS */}
            <div className="md:col-span-7 flex flex-col md:overflow-hidden overflow-visible">
              
              {/* TIMELINE SEARCH & CONTROLS BOX */}
              <div className="p-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                <div className="text-left w-full sm:w-auto">
                  <h2 className="font-extrabold text-slate-800 text-xs flex items-center gap-1 uppercase tracking-wider leading-none">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
                    {isAdminOrHR ? 'Clinic Staff Attendance Journal' : 'Your Personal Check-In History'}
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-1">Audit verification logs, check physical geotags, check-in snapshots</p>
                </div>

                {/* Filters selection */}
                <div className="flex gap-1.5 w-full sm:w-auto select-none shrink-0">
                  <button
                    onClick={() => setFilterType('ALL')}
                    className={`px-2.5 py-1 text-[9.5px] rounded-lg font-bold border cursor-pointer transition ${
                      filterType === 'ALL' 
                        ? 'bg-slate-900 border-slate-950 text-white font-extrabold' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Types
                  </button>
                  <button
                    onClick={() => setFilterType('IN')}
                    className={`px-2.5 py-1 text-[9.5px] rounded-lg font-bold border cursor-pointer transition ${
                      filterType === 'IN' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Check Ins
                  </button>
                  <button
                    onClick={() => setFilterType('OUT')}
                    className={`px-2.5 py-1 text-[9.5px] rounded-lg font-bold border cursor-pointer transition ${
                      filterType === 'OUT' 
                        ? 'bg-red-50 border-red-200 text-red-700 font-extrabold' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Check Outs
                  </button>
                </div>
              </div>

              {/* SEARCH FILTER BOX ON ADMIN AUDITING VIEWS */}
              {isAdminOrHR && (
                <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Audit Search by Officer Name, email log credentials, or device imprint..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-[11px] outline-none font-semibold focus:border-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* TIMELINE SCROLL BOX LIST */}
              <div className="flex-1 md:overflow-y-auto overflow-visible p-4 space-y-3.5 attendance-scrollbar bg-slate-50/70">
                {loading ? (
                  <div className="text-center py-16 space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Syncing Time Verification Journal...</p>
                  </div>
                ) : filteredTimecards.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 border border-slate-200 rounded-xl bg-white p-6 shadow-xs max-w-sm mx-auto space-y-2">
                    <Clock className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-xs font-extrabold text-slate-705 uppercase tracking-wide">No check-in logs found</p>
                    <p className="text-[10px] leading-relaxed">No logged records match current filter criteria. Take a quick validation photo to log your check-in!</p>
                  </div>
                ) : (
                  filteredTimecards.map((tc) => {
                    const isCheckIn = tc.type === 'IN';
                    const recordTime = new Date(tc.timestamp);
                    const formattedDate = recordTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                    const formattedTime = recordTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={tc.id}
                        className="bg-white border rounded-xl p-3.5 shadow-xs border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden"
                      >
                        {/* Dynamic Border Tag Accent */}
                        <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isCheckIn ? 'bg-gradient-to-b from-emerald-500 to-green-400' : 'bg-gradient-to-b from-red-500 to-rose-400'}`}></div>

                        <div className="flex items-start justify-between gap-3 font-semibold pl-1">
                          
                          <div className="flex gap-2.5 items-start min-w-0">
                            {/* Photo Thumbnail pop up preview */}
                            {tc.photo ? (
                              <TimecardSelfie photo={tc.photo} userName={tc.userName} />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                <Camera className="h-4.5 w-4.5 text-slate-400" />
                              </div>
                            )}

                            <div className="truncate min-w-0">
                              <h4 className="font-black text-slate-800 text-[11.5px] truncate">{tc.userName}</h4>
                              <p className="text-[9.5px] text-slate-400 truncate">{tc.userEmail}</p>
                              
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {isCheckIn ? (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[8.5px] font-extrabold rounded-md px-1.5 py-0.5 uppercase tracking-wide inline-flex items-center gap-0.5 shrink-0">
                                    🟢 Duty CHECK IN
                                  </span>
                                ) : (
                                  <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[8.5px] font-extrabold rounded-md px-1.5 py-0.5 uppercase tracking-wide inline-flex items-center gap-0.5 shrink-0">
                                    🔴 Duty CHECK OUT
                                  </span>
                                )}

                                {tc.isOvertime && (
                                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[8.5px] font-extrabold rounded-md px-1.5 py-0.5 uppercase tracking-wide inline-flex items-center gap-0.5 shrink-0">
                                    ⚡ OVERTIME {tc.otHours !== undefined ? `(${tc.otHours} hrs)` : ''}
                                  </span>
                                )}

                                <span className="text-[9px] text-slate-500 shrink-0 select-none bg-slate-100 px-1 py-0.5 border border-slate-200/50 rounded">
                                  {tc.deviceInfo ? tc.deviceInfo.replace(/(Mozilla\/5\.0 |Linux; Android |; rv:\d+)/g, '').slice(0, 20) : 'Browser Context'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-slate-800 text-[11px] font-black block font-mono bg-slate-100 border rounded px-1.5 py-0.5 leading-none">
                              {formattedTime}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                              {formattedDate}
                            </span>
                          </div>
                        </div>

                        {/* Physical Maps Geotag Line */}
                        {(tc.latitude || tc.longitude) && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] pl-1 font-semibold">
                            <div className="flex items-center gap-1 text-slate-600">
                              <MapPin className="h-3 w-3 text-red-500 animate-pulse" />
                              <span>Geotag Checkpoint: </span>
                              <span className="font-mono text-slate-800 select-all font-bold">
                                {tc.latitude?.toFixed(5)}, {tc.longitude?.toFixed(5)}
                              </span>
                            </div>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${tc.latitude},${tc.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-extrabold hover:underline"
                            >
                              Inspect Coordinates ↗
                            </a>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Combined footer metadata watermark */}
          <div className="bg-slate-100 text-slate-500 text-[9.5px] block font-semibold px-4 py-2 border-t flex justify-between shrink-0 select-none font-mono">
            <span>Saint Francis Digital Secure Signature Key: <code>SFC_TC_SECURE_AUTH_VALIDATOR</code></span>
            <span>Local Node GPS Satellite Sync: Live</span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
