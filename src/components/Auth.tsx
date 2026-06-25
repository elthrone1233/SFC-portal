import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Shield, Eye, EyeOff, Lock, Mail, UserPlus, HeartPulse, ChevronRight, Check, Database, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Key } from 'lucide-react';

interface AuthProps {
  onLoginSuccess: (user: User) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position] = useState<'ADMIN' | 'HR' | 'IT' | 'LEADER' | 'CO-LEADER' | 'MANAGER'>('LEADER');
  const [address, setAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [barangays, setBarangays] = useState<any[]>([]);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [dbConfigMessage, setDbConfigMessage] = useState<string>('');
  const [dbDetails, setDbDetails] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('sfc_remember_me') === 'true';
  });
  const [autoLogin, setAutoLogin] = useState(() => {
    return localStorage.getItem('sfc_auto_login') === 'true';
  });

  // Prefill remembered email on initialization
  useEffect(() => {
    if (rememberMe) {
      const savedEmail = localStorage.getItem('sfc_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

  // Fetch active barangays for the dropdown selector
  useEffect(() => {
    const loadBarangays = async () => {
      try {
        const res = await fetch('/api/barangays');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.barangays || []);
          setBarangays(list);
          if (list && list.length > 0) {
            setAddress(list[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to pre-fetch active clinic barangays:', err);
      }
    };
    loadBarangays();
  }, []);

  // Poll database connectivity status for live visual status light
  useEffect(() => {
    const checkDbStatus = async () => {
      try {
        const res = await fetch('/api/mysql-status');
        if (res.ok) {
          const data = await res.json();
          setDbConnected(!!data.connected);
          setDbConfigMessage(data.message || '');
          setDbDetails(data.config || null);
        } else {
          setDbConnected(false);
          setDbConfigMessage(`Status check returned response code ${res.status}`);
        }
      } catch (err: any) {
        setDbConnected(false);
        setDbConfigMessage(err.message || 'Error executing heartbeat request to DB.');
      }
    };
    
    checkDbStatus();
    // Poll every 8 seconds to reflect instantaneous state transitions (such as cPanel reboots)
    const interval = setInterval(checkDbStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }
    setError('');
    setLoading(true);

    // Diagnostics: Outgoing request validation
    console.group('%c🚀 [SF_DIAGNOSTIC] Handshake Initiation & Payload Audit', 'color: #0d9488; font-weight: bold; font-size: 12px;');
    console.log('📬 Checking Outgoing Payload integrity:');
    console.log('- Endpoint Address: /api/auth/login');
    console.log('- Operator Email Input:', email);
    console.log('- Password Length:', password.length, 'characters');
    console.log('- Format Check (Valid Email):', email.includes('@') ? 'PASS (Contains @)' : 'FAIL (Missing @)');
    console.groupEnd();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const contentType = res.headers.get('content-type') || '';
      console.log(`📥 [SF_DIAGNOSTIC] Response Handshake Headers -> HTTP ${res.status} [${res.statusText}]`);
      console.log(`📥 [SF_DIAGNOSTIC] Response Payload Content-Type:`, contentType);

      let data: any = {};
      
      if (contentType.includes('application/json')) {
        data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Login failed');
        }
      } else {
        // Unexpected format (e.g. Server returned HTML instead of JSON due to 500 error or Passenger crash)
        const rawText = await res.text();
        console.group('%c🚨 [SF_DIAGNOSTIC_FATAL] Unexpected HTML/Text Received instead of JSON!', 'color: #e11d48; font-weight: bold;');
        console.error('This typically happens when the cPanel hosting environment fails due to an uncaught crash, missing environment variables, or a database connection failure.');
        console.log('RAW SERVER RESPONSE PREVIEW (First 2000 chars):');
        console.log('%c' + rawText.substring(0, 2000), 'color: #b91c1c; font-family: monospace; font-size: 11px; background: #fef2f2; padding: 8px; border-radius: 6px; border: 1px solid #fee2e2;');
        console.groupEnd();

        let diagnosticHint = 'Server returned HTML instead of a valid JSON response. ';
        if (rawText.includes('Passenger') || rawText.includes('Phusion')) {
          diagnosticHint += 'cPanel Phusion Passenger gateway has crashed or has stale application files. ';
        }
        if (rawText.toLowerCase().includes('mysql') || rawText.toLowerCase().includes('connect econrefused')) {
          diagnosticHint += 'Database host environment is unreachable or credentials are misconfigured. ';
        }

        throw new Error(`${diagnosticHint}Please open the browser developer console (F12) to view the complete HTML server trace.`);
      }

      console.log('✅ [SF_DIAGNOSTIC] Authentication success! Active user logged in:', data.user);
      
      if (rememberMe) {
        localStorage.setItem('sfc_remember_me', 'true');
        localStorage.setItem('sfc_remembered_email', email);
      } else {
        localStorage.removeItem('sfc_remember_me');
        localStorage.removeItem('sfc_remembered_email');
      }

      if (autoLogin) {
        localStorage.setItem('sfc_auto_login', 'true');
      } else {
        localStorage.removeItem('sfc_auto_login');
      }

      localStorage.setItem('sfc_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err: any) {
      // Diagnostic Logging on Failure
      console.group('%c🚨 [SF_DIAGNOSTIC_OUTCOME] Authentication handshaking failed!', 'color: #e11d48; font-weight: bold; font-size: 13px;');
      console.error('Triggering Error details:', err);
      console.error('Error Message Summary:', err.message);
      
      // Attempt to immediately pull current database configuration state to help user verify credentials
      console.log('🧪 Diagnosing live server-side database configuration parameters...');
      try {
        const diagnosticsRes = await fetch('/api/mysql-status');
        if (diagnosticsRes.ok) {
          const diagResult = await diagnosticsRes.json();
          console.group('🔑 Server Database Configuration Verification (cPanel .env)');
          console.log('- MySQL Connect Status:', diagResult.connected ? 'Connected ✅' : 'Disconnected ❌');
          console.log('- Connected DB message:', diagResult.message);
          console.log('- Configured Database Host:', diagResult.config?.host || 'Empty / Missing');
          console.log('- Configured Database User:', diagResult.config?.user || 'Empty / Missing');
          console.log('- Configured Database Name:', diagResult.config?.database || 'Empty / Missing');
          console.log('- Configured Port:', diagResult.config?.port || '3306');
          console.groupEnd();
          
          if (!diagResult.connected) {
            console.warn('💡 ACTION REQUIRED: The application remains disconnected from MySQL. This is most likely caused by incorrect credentials or port configuration in the cPanel .env file.');
          } else {
            console.log('💡 DATABASE STACK IS UP: The database connection is working fine. The authentication failure is likely due to wrong login email/password or unapproved team registrations.');
          }
        } else {
          console.error('❌ Could not query DB status endpoint. Status returned:', diagnosticsRes.status);
        }
      } catch (dbDiagErr: any) {
        console.error('❌ Failed to poll DB configuration details in fail-safe diagnostic path:', dbDiagErr.message);
      }
      console.groupEnd();

      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, position, address })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      setMessage(data.message || 'Registered successfully! Awaiting review.');
      setIsLogin(true);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Error creating account.');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (userEmail: string, pass: string) => {
    setEmail(userEmail);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden select-none">
      
      {/* Absolute floating 3D graphic backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-emerald-100/40 to-blue-200/40 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-sky-100/40 to-emerald-200/30 blur-3xl pointer-events-none"></div>

      {/* Grid crosshair 3D tech lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <div className="w-full max-w-sm sm:max-w-md z-10 space-y-6">
        
        {/* Animated 3D Header Emblem */}
        <div className="text-center space-y-3">
          <div className="inline-flex relative p-0.5 rounded-full bg-gradient-to-br from-slate-200 via-white to-slate-300 shadow-[0_8px_16px_-4px_rgba(16,185,129,0.2),_0_3px_0_#94a3b8] transition transform hover:scale-105 active:translate-y-0.5">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner overflow-hidden">
              <img src="https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png" className="h-12 w-auto object-contain" alt="Logo" referrerPolicy="no-referrer" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase font-display flex items-center justify-center gap-1.5 leading-none">
              Saint Francis Portal
            </h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">
              Field Operations & Record Directory System
            </p>
          </div>
        </div>

        {/* Core 3D Glass Card Container */}
        <div className="bg-white/95 rounded-2xl border-2 border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.12),_0_6px_0_#cbd5e1] p-6 sm:p-8 relative ring-1 ring-slate-100/50">
          
          {/* Custom 3D Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100/80 p-1 rounded-xl border shadow-inner">
            <button
              onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}
              className={`py-2 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                isLogin 
                  ? 'bg-white text-emerald-700 shadow-[0_2px_4px_rgba(0,0,0,0.06)] border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}
              className={`py-2 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                !isLogin 
                  ? 'bg-white text-emerald-700 shadow-[0_2px_4px_rgba(0,0,0,0.06)] border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-850'
              }`}
            >
              Register Team
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border-2 border-rose-100 p-3.5 text-[11px] text-rose-700 rounded-xl leading-normal font-medium shadow-xs">
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div className="mb-4 bg-emerald-50 border-2 border-emerald-100 p-3.5 text-[11px] text-emerald-800 rounded-xl leading-normal font-bold shadow-xs">
              🎉 {message}
            </div>
          )}

          {isLogin ? (
            <div className="space-y-5">
              
              {/* Form implementation */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Operator Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      required
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@stfrancis.com"
                      className="block w-full pl-9 pr-3 py-2.5 border-2 border-slate-200/80 rounded-xl text-slate-800 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white text-xs font-semibold shadow-[inner_0_2px_4px_rgba(0,0,0,0.05)]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Security Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      required
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-10 py-2.5 border-2 border-slate-200/80 rounded-xl text-slate-800 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white text-xs font-semibold shadow-[inner_0_2px_4px_rgba(0,0,0,0.05)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 text-[11px] font-semibold text-slate-500">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="cursor-pointer h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Remember me</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoLogin}
                      onChange={(e) => setAutoLogin(e.target.checked)}
                      className="cursor-pointer h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Auto Login</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-3d-primary btn-pulse-save text-white uppercase text-xs font-black tracking-wider py-3.5 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl select-none"
                >
                  {loading ? 'Performing Handshake...' : 'Sign In To Panel'}
                </button>


              </form>

              
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Full Operating Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    required
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Arthur Pendelton"
                    className="block w-full pl-9 pr-3 py-2 border-2 border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white text-xs font-semibold shadow-[inner_0_2px_4px_rgba(0,0,0,0.05)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@domain.com"
                    className="block w-full pl-9 pr-3 py-2 border-2 border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white text-xs font-semibold shadow-[inner_0_2px_4px_rgba(0,0,0,0.05)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Personal Security Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="block w-full pl-9 pr-10 py-2 border-2 border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white text-xs font-semibold shadow-[inner_0_2px_4px_rgba(0,0,0,0.05)]"
                  />
                </div>
              </div>



              <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-3 text-[10px] text-amber-900 leading-normal font-bold">
                ⚠️ Your requested account will remain "Pending Review" until authorized and assigned an active roster position by a Clinical Admin operator.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-3d-secondary text-white uppercase text-xs font-black tracking-wider py-3 cursor-pointer select-none"
              >
                {loading ? 'Submitting Registration...' : 'Request Credentials'}
              </button>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}
