import React, { useEffect, useState } from 'react';
import { PlusCircle, Search, Calendar, HeartPulse, ShieldAlert, List, Clock, Activity } from 'lucide-react';
import { HealthRecord, User, Household, hasRole } from '../types';

interface HealthProps {
  currentUser: User;
}

export default function HealthRecords({ currentUser }: HealthProps) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [searchTerm, setSearchTerm] = useState('');

  // Add state
  const [showAdd, setShowAdd] = useState(false);
  const [patientName, setPatientName] = useState(() => localStorage.getItem('saint_francis_hr_patientName') || '');
  const [selectedHHId, setSelectedHHId] = useState(() => localStorage.getItem('saint_francis_hr_selectedHHId') || '');
  const [diagnosis, setDiagnosis] = useState(() => localStorage.getItem('saint_francis_hr_diagnosis') || '');
  const [treatment, setTreatment] = useState(() => localStorage.getItem('saint_francis_hr_treatment') || '');
  const [medications, setMedications] = useState(() => localStorage.getItem('saint_francis_hr_medications') || '');
  const [notes, setNotes] = useState(() => localStorage.getItem('saint_francis_hr_notes') || '');

  useEffect(() => {
    localStorage.setItem('saint_francis_hr_patientName', patientName);
    localStorage.setItem('saint_francis_hr_selectedHHId', selectedHHId);
    localStorage.setItem('saint_francis_hr_diagnosis', diagnosis);
    localStorage.setItem('saint_francis_hr_treatment', treatment);
    localStorage.setItem('saint_francis_hr_medications', medications);
    localStorage.setItem('saint_francis_hr_notes', notes);
  }, [patientName, selectedHHId, diagnosis, treatment, medications, notes]);

  useEffect(() => {
    fetchRecords();
    fetchHouseholds();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/health-records');
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch(e) {}
    finally {
      setLoading(false);
    }
  };

  const fetchHouseholds = async () => {
    try {
      const res = await fetch('/api/households', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        // Only allow approved ones
        setHouseholds(data.filter((h: any) => h.approvalStatus === 'Approved'));
      }
    } catch(e) {}
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !selectedHHId || !diagnosis) return;

    try {
      const res = await fetch('/api/health-records/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          patientName,
          householdId: selectedHHId,
          diagnosis,
          treatment,
          medications,
          notes,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        setShowAdd(false);
        setPatientName('');
        setSelectedHHId('');
        setDiagnosis('');
        setTreatment('');
        setMedications('');
        setNotes('');
        fetchRecords();
      }
    } catch(e) {
      console.error(e);
    }
  };

  const filtered = records.filter(r => {
    const pName = r.patientName || '';
    const diag = r.diagnosis || '';
    const bar = r.barangay || '';
    const query = (searchTerm || '').toLowerCase();
    return pName.toLowerCase().includes(query) || 
           diag.toLowerCase().includes(query) ||
           bar.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-4 font-sans text-xs">
      
      {/* Upper action control container */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
            <HeartPulse className="h-5 w-5 text-red-600 animate-pulse" />
            Clinic Diagnostic logs
          </h2>
          <p className="text-slate-400 text-[10px] mt-1">Track patient diagnosis reports, treatments, prescribed medication tables</p>
        </div>

        <div className="flex items-center gap-2">
          {hasRole(currentUser, ['ADMIN', 'HR', 'IT', 'MANAGER']) && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-3d-primary cursor-pointer text-xs px-3.5 py-2 font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4" /> Add Diagnoses Record
            </button>
          )}

          <div className="flex border border-slate-200 bg-slate-50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-md transition ${viewMode === 'timeline' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced search filter parameters */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Filter logs by Name, diagnosis description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-white text-slate-700 border rounded-lg py-2 pl-8 pr-2 w-full sm:w-64 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 animate-pulse">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center bg-white p-12 border border-slate-100 rounded-xl text-slate-400">
          No diagnostic logs recorded matching selection.
        </div>
      ) : viewMode === 'table' ? (
        
        /* TABLE GRID LAYOUT representation */
        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 h-10 text-[10px] uppercase font-semibold text-slate-500">
                <th className="py-2 pl-4">Patient Citizen Name</th>
                <th className="py-2">Barangay Area</th>
                <th className="py-2">Diagnoses pointer</th>
                <th className="py-2">Treatment regimen</th>
                <th className="py-2">Prescribed Medication</th>
                <th className="py-2">Clinical Notes</th>
                <th className="py-2 pr-4 text-right">Date checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 pl-4 font-bold text-slate-800 text-xs">{item.patientName}</td>
                  <td className="py-3 font-semibold text-slate-600">{item.barangay}</td>
                  <td className="py-3 text-red-700 font-bold font-sans">
                    <span className="bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      {item.diagnosis}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500 font-medium">{item.treatment}</td>
                  <td className="py-3 font-mono text-slate-600">{item.medications}</td>
                  <td className="py-3 text-slate-400 max-w-xs truncate">{item.notes || 'N/A'}</td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-400">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* TIMELINE LAYOUT representation */
        <div className="relative border-l border-blue-200 pl-6 space-y-6 max-w-3xl ml-4 font-sans text-xs">
          {filtered.map((item, idx) => (
            <div key={idx} className="relative bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
              <span className="absolute -left-[31px] top-4 bg-white border-2 border-blue-500 h-4.5 w-4.5 rounded-full flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              </span>

              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-none">{item.patientName}</h3>
                  <span className="text-[10px] text-slate-400 mt-1 block">Barangay Location: {item.barangay}</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 border px-2 py-1 rounded text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="font-mono text-[10px]">{item.date}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-red-700 font-bold">🎯 Diagnoses: {item.diagnosis}</p>
                <div className="p-2.5 bg-slate-50 rounded text-slate-600 leading-normal">
                  <strong className="block text-slate-500 text-[9px] uppercase">Treatment regimen</strong>
                  {item.treatment}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-slate-50 text-[10px]">
                  <div>
                    <span className="block text-slate-400">Prescribed Medications</span>
                    <strong className="text-slate-800 font-mono">{item.medications}</strong>
                  </div>
                  {item.notes && (
                    <div>
                      <span className="block text-slate-400 font-semibold">Special Instructions</span>
                      <p className="text-slate-500">{item.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW DIAGNOSES ENTRY MODAL FRAME */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative border">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5 leading-none">
              <PlusCircle className="h-5 w-5 text-blue-600 animate-spin" style={{ animationDuration: '3s' }} />
              Log Clinical Diagnoses Report
            </h2>
            <button 
              onClick={() => setShowAdd(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
            >
              ✕
            </button>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              
              { (patientName || selectedHHId || diagnosis || treatment || medications || notes) && (
                <div className="text-[10px] text-emerald-800 font-extrabold flex items-center justify-between gap-1.5 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-150 animate-pulse">
                  <span className="flex items-center gap-1">⚡ Live Draft Auto-Saved</span>
                  <span className="font-mono text-[9px] opacity-75">Browser Store</span>
                </div>
              ) }
              
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Select Patient Household File</label>
                <select
                  value={selectedHHId}
                  onChange={(e) => {
                    setSelectedHHId(e.target.value);
                    const matched = households.find(h => h.id === e.target.value);
                    if (matched) setPatientName(matched.householdHead);
                  }}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none focus:ring-1"
                  required
                >
                  <option value="">Choose Approved Household Head...</option>
                  {households.map((h, i) => (
                    <option key={i} value={h.id}>{h.householdHead} ({h.barangay})</option>
                  ))}
                  {households.length === 0 && (
                    <option value="none">No Approved Households yet</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Patient Name</label>
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Diagnosis Description</label>
                <input
                  type="text"
                  placeholder="e.g. Hypertension, Acute Tonsillitis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none focus:ring-1"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Treatment Regimen</label>
                <textarea
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  placeholder="Advise low salt diet..."
                  className="bg-slate-50 border p-2 h-14 w-full rounded focus:outline-none focus:ring-1"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Prescribed Medications</label>
                <input
                  type="text"
                  placeholder="e.g. Losartan 50mg qd, Amoxicillin 500mg tid"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  className="bg-slate-50 border p-2 w-full rounded focus:outline-none focus:ring-1"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Doctor's Clinical Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-50 border p-2 h-12 w-full rounded focus:outline-none focus:ring-1"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2 btn-3d-secondary font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 btn-3d-primary btn-pulse-save font-extrabold text-[11px] uppercase tracking-wider text-center cursor-pointer"
                >
                  Save Diagnostics
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
