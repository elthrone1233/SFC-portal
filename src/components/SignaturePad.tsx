import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Lock, Unlock, Check } from 'lucide-react';

interface SignaturePadProps {
  onChange: (base64Img: string | null) => void;
  defaultValue?: string | null;
}

export default function SignaturePad({ onChange, defaultValue }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [isLocked, setIsLocked] = useState(!!defaultValue);
  const lastSelfGeneratedSignatureRef = useRef<string | null>(defaultValue || null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const initCanvas = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.scale(ratio, ratio);

      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Load signature backup if any
      if (defaultValue) {
        if (defaultValue === lastSelfGeneratedSignatureRef.current) {
          return;
        }
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
          ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
          setHasSigned(true);
          setIsLocked(true);
          lastSelfGeneratedSignatureRef.current = defaultValue;
        };
        img.src = defaultValue;
      } else {
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        setHasSigned(false);
        setIsLocked(false);
        lastSelfGeneratedSignatureRef.current = null;
      }
    };

    initCanvas();
    
    // Add small resize handler just in case
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, [defaultValue]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isLocked) return;
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent scrolling on touch screens
    if (e.cancelable) {
      e.preventDefault();
    }

    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    if (isLocked) return;
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Auto-save removed on request. Let patient click the Save button below to save signature.
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    setIsLocked(false);
    lastSelfGeneratedSignatureRef.current = null;
    onChange(null);
  };

  const handleSaveAndLock = () => {
    if (hasSigned) {
      setIsLocked(true);
      const canvas = canvasRef.current;
      if (canvas) {
        const b64 = canvas.toDataURL('image/png');
        lastSelfGeneratedSignatureRef.current = b64;
        onChange(b64);
      }
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  return (
    <div className="space-y-2 w-full max-w-sm">
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase leading-none">
        <span>Patient/Representative Signature Panel</span>
        <div className="flex items-center gap-1.5">
          {hasSigned && (
            <button
              type="button"
              onClick={clear}
              className="text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer font-bold uppercase text-[9px] bg-rose-50 border border-rose-200 px-2 py-1 rounded transition select-none"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Clear Signature
            </button>
          )}
        </div>
      </div>
      <div 
        className="relative border border-slate-350 rounded-lg bg-slate-50 overflow-hidden h-28 touch-none shadow-sm"
        onDoubleClick={handleUnlock}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair bg-white"
        />
        {defaultValue && isLocked && (
          <img 
            src={defaultValue} 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white z-10" 
            alt="Saved signature view"
            referrerPolicy="no-referrer" 
          />
        )}
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 font-bold text-[10px] uppercase tracking-wider">
            🏥 Sign inside this block perimeter
          </div>
        )}
        
        {isLocked && (
          <div 
            className="absolute inset-0 bg-slate-55/90 backdrop-blur-[1px] flex flex-col items-center justify-center text-center select-none cursor-pointer p-4 transition-all duration-200 z-20"
            onClick={handleUnlock}
            title="Click to unlock/edit signature"
          >
            <div className="flex items-center gap-1 bg-emerald-55 flex-wrap justify-center">
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-250">
                <Lock className="h-2.5 w-2.5 shrink-0" /> Signature Saved & Secured
              </span>
            </div>
            <p className="text-[9px] text-slate-550 font-extrabold uppercase tracking-wide mt-1.5">
              💡 Click anyway on pad to unlock & redraw
            </p>
          </div>
        )}
      </div>

      {hasSigned && !isLocked && (
        <button
          type="button"
          onClick={handleSaveAndLock}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-black rounded-lg text-xs tracking-wider uppercase shadow-md flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] transition duration-150 animate-pulse border-2 border-green-800"
        >
          <Check className="h-4 w-4 shrink-0 font-black" /> Click to Save Signature Sworn seal
        </button>
      )}
    </div>
  );
}
