import React, { useEffect, useState } from 'react';
import { User, Household } from '../types';
import { 
  ShieldAlert, Edit3, CheckCircle2, MessageSquare, AlertTriangle, 
  RefreshCw, MapPin, Phone, User as UserIcon, Calendar, Check, X, ClipboardList, AlertCircle, Paperclip, FileText
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import { PhilHealthLogo } from './PhilHealthLogo';

const BARANGAY_COORDS_MAP: { [key: string]: [number, number] } = {
  'San Francisco': [7.8284, 123.4332],
  'Santa Lucia': [7.8320, 123.4410],
  'Tuburan': [7.8150, 123.4280],
  'Lumbia': [7.8420, 123.4250],
  'Balangasan': [7.8240, 123.4450]
};

const PUROK_COORDS_MAP: { [key: string]: [number, number] } = {
  'Purok Mangga': [7.8290, 123.4310],
  'Purok Durian': [7.8275, 123.4350],
  'Purok Santol': [7.8300, 123.4340],
  'Purok Sampaguita': [7.8330, 123.4420],
  'Purok Rosal': [7.8310, 123.4390],
  'Purok Bougainvillea': [7.8160, 123.4290],
  'Purok Mahogany': [7.8440, 123.4240],
  'Purok Narra': [7.8400, 123.4260]
};

interface DisapprovedProps {
  currentUser: User;
}

export default function DisapprovedSubmitted({ currentUser }: DisapprovedProps) {
  const [items, setItems] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const isRealMasterAdmin = currentUser && currentUser.email && (
    currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
    currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
  );

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const handleDeleteDisapproved = (id: string, headName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Disapproved Record?',
      description: `Caution: This will permanently delete the disapproved household record for "${headName}" and send it to the Recycle Bin. This action cannot be easily undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/households/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            setAlertModal({
              isOpen: true,
              title: 'Record Deleted Successfully',
              description: `Household record for "${headName}" has been successfully deleted.`,
              type: 'success'
            });
            fetchDisapproved();
          } else {
            const err = await res.json();
            setAlertModal({
              isOpen: true,
              title: 'Deletion Failed',
              description: err.error || 'Failed to delete the disapproved record.',
              type: 'error'
            });
          }
        } catch (e: any) {
          setAlertModal({
            isOpen: true,
            title: 'Communication Error',
            description: e.message || 'Handshake failed with database.',
            type: 'error'
          });
        }
      }
    });
  };
  
  // Edit form states
  const [editingItem, setEditingItem] = useState<Household | null>(null);
  const [editHeadName, setEditHeadName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editPurok, setEditPurok] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editPmrf, setEditPmrf] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  const [editYakap, setEditYakap] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  
  // PMRF details nested edit
  const [editPurpose, setEditPurpose] = useState<'REGISTRATION' | 'UPDATING'>('REGISTRATION');
  const [editPin, setEditPin] = useState('');
  const [editMotherMaiden, setEditMotherMaiden] = useState('');
  const [editSpouseName, setEditSpouseName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editBirthPlace, setEditBirthPlace] = useState('');
  const [editSex, setEditSex] = useState<'Male' | 'Female'>('Male');
  const [editCivilStatus, setEditCivilStatus] = useState<'Single' | 'Married' | 'Annulled' | 'Widowed' | 'Legally Separated'>('Single');
  const [editCitizenship, setEditCitizenship] = useState<'FILIPINO' | 'FOREIGN' | 'DUAL'>('FILIPINO');
  const [editSignature, setEditSignature] = useState<string | null>(null);
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Preview form states
  const [previewItem, setPreviewItem] = useState<Household | null>(null);
  const [previewTab, setPreviewTab] = useState<'PMRF' | 'PMRF_BACK' | 'FPE' | 'PCSF'>('PMRF');
  
  const [puroks, setPuroks] = useState<any[]>([]);
  const [barangayList, setBarangayList] = useState<any[]>([]);

  const fetchPuroksAndBarangays = async () => {
    try {
      const resP = await fetch('/api/puroks');
      if (resP.ok) {
        const dataP = await resP.json();
        setPuroks(dataP);
      }
      const resB = await fetch('/api/barangays');
      if (resB.ok) {
        const dataB = await resB.json();
        setBarangayList(dataB.barangays || []);
      }
    } catch (e) {
      console.warn('Failed to load locations', e);
    }
  };

  const fetchDisapproved = async () => {
    if (!currentUser || !currentUser.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/households/disapproved', {
        headers: {
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to fetch disapproved submissions.');
      }
    } catch (e) {
      setErrorMsg('Network error checking disapproved logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisapproved();
    fetchPuroksAndBarangays();
  }, [currentUser]);

  const handleRandomCoordinates = () => {
    const fallbackLat = PUROK_COORDS_MAP[editPurok]?.[0] || BARANGAY_COORDS_MAP[editBarangay]?.[0] || 7.8284;
    const fallbackLng = PUROK_COORDS_MAP[editPurok]?.[1] || BARANGAY_COORDS_MAP[editBarangay]?.[1] || 123.4332;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEditLat(position.coords.latitude.toFixed(5));
          setEditLng(position.coords.longitude.toFixed(5));
        },
        (error) => {
          console.warn("Geolocation skipped or denied, fallback to recorded coordinates:", error);
          setEditLat(fallbackLat.toFixed(5));
          setEditLng(fallbackLng.toFixed(5));
        },
        { enableHighAccuracy: true, timeout: 3500 }
      );
    } else {
      setEditLat(fallbackLat.toFixed(5));
      setEditLng(fallbackLng.toFixed(5));
    }
  };

  const handleOpenEdit = (h: Household) => {
    setEditingItem(h);
    setEditHeadName(h.householdHead);
    setEditContact(h.contactNumber);
    setEditBarangay(h.barangay);
    setEditPurok(h.purok);
    setEditLat(h.latitude.toString());
    setEditLng(h.longitude.toString());
    setEditPmrf(h.pmrfStatus);
    setEditYakap(h.yakapWillingStatus);

    // Load nested details
    const det = h.pmrfDetails || {};
    setEditPurpose(det.purpose || 'REGISTRATION');
    setEditPin(det.pin || '');
    setEditMotherMaiden(det.motherMaiden || '');
    setEditSpouseName(det.spouseName || '');
    setEditBirthDate(det.birthDate || '');
    setEditBirthPlace(det.birthPlace || 'Pagadian City');
    setEditSex(det.sex || 'Male');
    setEditCivilStatus(det.civilStatus || 'Single');
    setEditCitizenship(det.citizenship || 'FILIPINO');
    setEditSignature((h as any).patientSignature || det.patientSignature || null);
    setEditAttachments(h.attachments || []);
  };

  const handleUploadAttachment = () => {
    if (!selectedAttachmentFile) return;
    setUploadProgress(10);
    
    let progressValue = 10;
    const interval = setInterval(() => {
      progressValue += Math.floor(Math.random() * 20) + 15;
      if (progressValue >= 100) {
        progressValue = 100;
        setUploadProgress(100);
        clearInterval(interval);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditAttachments(prev => [...prev, reader.result as string]);
          setSelectedAttachmentFile(null);
          setUploadProgress(null);
        };
        reader.readAsDataURL(selectedAttachmentFile);
      } else {
        setUploadProgress(progressValue);
      }
    }, 120);
  };

  const handleSaveAndResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.isFpePcsfOnly && !editMotherMaiden.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Mother's Maiden Name Required",
        description: "Please fill out the Mother's Maiden Name in the PMRF details section before resubmitting.",
        type: "error"
      });
      return;
    }

    try {
      const updatedData = {
        householdHead: editHeadName,
        contactNumber: editContact,
        barangay: editBarangay,
        purok: editPurok,
        latitude: parseFloat(editLat) || editingItem.latitude,
        longitude: parseFloat(editLng) || editingItem.longitude,
        pmrfStatus: editPmrf,
        yakapWillingStatus: editYakap,
        patientSignature: editSignature || undefined,
        attachments: editAttachments,
        pmrfDetails: {
          ...(editingItem.pmrfDetails || {}),
          patientSignature: editSignature || undefined,
          purpose: editPurpose,
          pin: editPin,
          motherMaiden: editMotherMaiden,
          spouseName: editSpouseName,
          birthDate: editBirthDate,
          birthPlace: editBirthPlace,
          sex: editSex,
          civilStatus: editCivilStatus,
          citizenship: editCitizenship
        }
      };

      const res = await fetch('/api/households/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          id: editingItem.id,
          householdData: updatedData,
          // keep existing members & dependents
          membersData: null,
          dependentsData: null
        })
      });

      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Resubmitted Successfully',
          description: 'The household data has been updated and successfully resubmitted to the Verification Queue!',
          type: 'success'
        });
        setEditingItem(null);
        fetchDisapproved();
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Resubmission Failed',
          description: err.error || 'Failed to resubmit the corrected file details.',
          type: 'error'
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Communication Error',
        description: 'Network communication handshake error with the Saint Francis Database.',
        type: 'error'
      });
    }
  };

  const renderCheckboxHelper = (label: string, checked: boolean, indent: boolean = false, subtext: string = '') => (
    <div className={`flex items-start gap-1 select-none ${indent ? 'pl-4' : ''}`}>
      <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none mt-0.5 select-none shrink-0">
        {checked ? 'X' : ''}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-[8.5px] font-extrabold text-black uppercase leading-tight select-none">
          {label}
        </span>
        {subtext && (
          <span className="text-[5.5px] text-slate-500 font-bold leading-none uppercase mt-0.5 select-none font-sans">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );

  const renderFpeForm = (h: Household) => {
    const fpe = h.fpeDetails || {};
    let details = h.pmrfDetails || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (e) { details = {}; }
    }
    return (
      <div className="max-w-[900px] mx-auto border-[3px] border-black bg-white p-6 font-sans text-xs text-black uppercase space-y-4 shadow-xl select-text leading-tight animate-fade-in relative">
        {/* FPE Header */}
        <div className="border-[2px] border-black bg-[#16a34a] p-4 text-center text-white flex flex-col md:flex-row items-center justify-center relative gap-3">
          <div className="md:absolute md:left-4 top-1/2 md:-translate-y-1/2 flex items-center shrink-0">
            <PhilHealthLogo className="h-14 w-14 shrink-0 bg-white p-1 rounded-lg border border-emerald-300" />
          </div>
          <div className="text-center md:pl-16">
            <h3 className="font-black text-[9px] tracking-widest text-emerald-100 leading-none">REPUBLIC OF THE PHILIPPINES</h3>
            <h2 className="text-xs font-black text-white uppercase mt-1 tracking-tight leading-none">PHILIPPINE HEALTH INSURANCE CORPORATION</h2>
            <h4 className="text-[11px] font-black text-white uppercase tracking-wider mt-1.5 leading-none">FIRST PATIENT ENCOUNTER (FPE) CLINICAL FORM</h4>
            <span className="text-[7.5px] text-emerald-100 block mt-1.5 tracking-tight font-mono uppercase">PhilHealth Konsulta Benefit Program Registration System</span>
          </div>
        </div>

        {/* PART I: PATIENT GENERAL CLINICAL RECORD */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART I: PATIENT GENERAL CLINICAL RECORD
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
            <div className="md:col-span-4 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">PATIENT ID NO (PIN)</label>
              <strong className="text-slate-900 text-[11px] font-mono tracking-wider">
                {details.pin || h.id || 'NOT ENROLLED / PENDING'}
              </strong>
            </div>
            <div className="md:col-span-5 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">FULL NAME (LAST, FIRST, MIDDLE, SUFFIX)</label>
              <strong className="text-slate-900 text-[11px] font-black">
                {h.householdHead}
              </strong>
            </div>
            <div className="md:col-span-3 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">SEX / GENDER</label>
              <strong className="text-slate-900 text-[11px] font-black uppercase">
                {details.sex || 'MALE'}
              </strong>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black border-t border-black">
            <div className="md:col-span-4 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">DATE OF BIRTH</label>
              <strong className="text-slate-900 text-[11px] font-black">
                {details.birthDate || 'N/A'}
              </strong>
            </div>
            <div className="md:col-span-4 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">CIVIL STATUS</label>
              <strong className="text-slate-900 text-[11px] font-black uppercase">
                {details.civilStatus || 'SINGLE'}
              </strong>
            </div>
            <div className="md:col-span-4 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">CONTACT NUMBER</label>
              <strong className="text-slate-900 text-[11px] font-mono">
                {h.contactNumber || 'N/A'}
              </strong>
            </div>
          </div>
          <div className="p-2 border-t border-black bg-slate-50">
            <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">PERMANENT RESIDENCE ADDRESS</label>
            <strong className="text-slate-900 text-[10.5px] font-black">
              BARANGAY {h.barangay || 'N/A'}, PAGADIAN CITY, ZAMBOANGA DEL SUR
            </strong>
          </div>
        </div>

        {/* PART II: CLINICAL ENCOUNTER FINDINGS */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART II: CLINICAL ENCOUNTER FINDINGS (VITAL SIGNS & ANTHROPOMETRICS)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-black text-center bg-white">
            <div className="p-2 flex flex-col justify-between">
              <span className="text-slate-500 text-[7px] font-black block leading-none mb-1">BP (MMHG)</span>
              <strong className="text-[11px] text-slate-900 font-mono">{fpe.vitalBp || '120/80'}</strong>
            </div>
            <div className="p-2 flex flex-col justify-between">
              <span className="text-slate-500 text-[7px] font-black block leading-none mb-1">BODY TEMP (°C)</span>
              <strong className="text-[11px] text-slate-900 font-mono">{fpe.vitalTemp || '36.5'}</strong>
            </div>
            <div className="p-2 flex flex-col justify-between">
              <span className="text-slate-500 text-[7px] font-black block leading-none mb-1">HEART RATE (BPM)</span>
              <strong className="text-[11px] text-slate-900 font-mono">{fpe.vitalHr || '72'}</strong>
            </div>
            <div className="p-2 flex flex-col justify-between">
              <span className="text-slate-500 text-[7px] font-black block leading-none mb-1">RESP RATE (CPM)</span>
              <strong className="text-[11px] text-slate-900 font-mono">{fpe.vitalRr || '16'}</strong>
            </div>
            <div className="p-2 flex flex-col justify-between">
              <span className="text-slate-500 text-[7px] font-black block leading-none mb-1">WEIGHT & HEIGHT</span>
              <strong className="text-[11px] text-slate-900 font-mono">{fpe.vitalWt || '65'} KG / {fpe.vitalHt || '165'} CM</strong>
            </div>
            <div className="p-2 flex flex-col justify-between bg-emerald-50">
              <span className="text-emerald-800 text-[7px] font-black block leading-none mb-1">CALCULATED BMI</span>
              <strong className="text-xs text-emerald-950 font-black">{fpe.vitalBmi || '23.88'}</strong>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-black border-t border-black bg-slate-50 text-center text-[10px]">
            <div className="p-1.5">WAIST: <strong className="text-slate-900 font-mono">{fpe.vitalWaist || '32'} IN</strong></div>
            <div className="p-1.5">UPPER ARM: <strong className="text-slate-900 font-mono">{fpe.vitalUpperArm || '28'} CM</strong></div>
            <div className="p-1.5">MID ARM: <strong className="text-slate-900 font-mono">{fpe.vitalMidArm || '27'} CM</strong></div>
          </div>
        </div>

        {/* PART III: PRESENT CLINICAL CHIEF COMPLAINTS */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART III: PRESENT CLINICAL CHIEF COMPLAINTS
          </div>
          <div className="p-3 bg-white grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries({
              'ccNone': 'No Acute Complaints (Asymptomatic)',
              'ccFever': 'Fever / Pyrexia Symptoms',
              'ccCough': 'Persistent Cough / Respiratory',
              'ccBodyPain': 'Body Pain / Generalized Myalgia',
              'ccDyspnea': 'Dyspnea / Shortness of Breath'
            }).map(([key, label]) => {
              const checked = fpe[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-sm leading-none">{checked ? '☒' : '☐'}</span>
                  <span className="font-black text-slate-800 text-[10px] leading-tight">{label}</span>
                </div>
              );
            })}
            <div className="col-span-full border-t border-dashed border-slate-300 pt-2 flex items-center gap-2">
              <span className="font-black text-slate-650 text-[10px]">OTHER COMPLAINTS / SYMPTOMS:</span>
              <span className="underline font-mono text-[11px] text-indigo-900 font-black">{fpe.ccOthers || 'NONE DECLARED'}</span>
            </div>
          </div>
        </div>

        {/* PART IV: MEDICAL HISTORY */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART IV: MEDICAL HISTORY, GENETIC BACKGROUND & LIFESTYLE SUMMARY
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black bg-white">
            <div className="p-3 space-y-2">
              <h4 className="font-black text-[9px] text-[#16a34a] uppercase">1. CHRONIC HEALTH MEDICAL HISTORY</h4>
              <div className="grid grid-cols-2 gap-2 font-black text-slate-850">
                {Object.entries({
                  'mhHypertension': 'Hypertension',
                  'mhDiabetes': 'Diabetes Mellitus',
                  'mhAstmaCopd': 'Asthma / COPD',
                  'mhHeart': 'Heart Disease',
                  'mhStroke': 'Stroke Index',
                  'mhCancer': 'Cancer / Malignancy',
                  'mhTb': 'Pulmonary TB',
                  'mhKidney': 'Kidney Disease',
                  'mhNone': 'No Past History'
                }).map(([key, label]) => {
                  const checked = fpe[key];
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="font-mono text-sm leading-none">{checked ? '☒' : '☐'}</span>
                      <span className="text-[10px] font-bold">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <h4 className="font-black text-[9px] text-[#16a34a] uppercase mb-1.5">2. FAMILY HEREDITARY HISTORY</h4>
                <div className="grid grid-cols-2 gap-2 font-black text-slate-850">
                  {Object.entries({
                    'fhHypertension': 'Hypertension',
                    'fhDiabetes': 'Diabetes Mellitus',
                    'fhHeart': 'Heart Disease',
                    'fhCancer': 'Cancer',
                    'fhNone': 'No Hereditary History'
                  }).map(([key, label]) => {
                    const checked = fpe[key];
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <span className="font-mono text-sm leading-none">{checked ? '☒' : '☐'}</span>
                        <span className="text-[10px] font-bold">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2">
                <h4 className="font-black text-[9px] text-[#16a34a] uppercase mb-1.5">3. SOCIAL & LIFESTYLE PROFILE</h4>
                <div className="space-y-1.5 text-[10px] font-bold">
                  <div className="flex justify-between items-center bg-slate-50 p-1 px-2 rounded border">
                    <span>ACTIVE TOBACCO SMOKER:</span>
                    <strong className="font-mono uppercase text-slate-805 bg-white px-1.5 py-0.5 rounded border text-[9.5px]">
                      {fpe.shSmoking === 'Current' ? 'YES ☒ (CURRENT)' : fpe.shSmoking === 'Former' ? 'NO ☐ (FORMER)' : fpe.shSmoking === 'Never' ? 'NO ☐ (NEVER)' : (fpe.shSmoking ? 'YES ☒' : 'NO ☐')}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-1 px-2 rounded border">
                    <span>FREQUENT ALCOHOL CONSUMER:</span>
                    <strong className="font-mono uppercase text-slate-805 bg-white px-1.5 py-0.5 rounded border text-[9.5px]">
                      {fpe.shAlcohol === 'Regular' ? 'YES ☒ (REGULAR)' : fpe.shAlcohol === 'Occasional' ? 'NO ☐ (OCCASIONAL)' : fpe.shAlcohol === 'None' ? 'NO ☐ (NONE)' : (fpe.shAlcohol ? 'YES ☒' : 'NO ☐')}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-1 px-2 rounded border">
                    <span>PRIMARY OCCUPATION:</span>
                    <strong className="font-mono uppercase text-slate-805 bg-white px-1.5 py-0.5 rounded border text-[9.5px]">
                      {fpe.shOccupation || 'NONE SPECIFIED'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PART V: PHYSICAL EXAMINATION */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART V: CLINICAL PHYSICAL EXAMINATION FINDINGS, DIAGNOSIS & PLAN
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black bg-white">
            <div className="p-3">
              <label className="text-[7.5px] font-black text-slate-500 block leading-none mb-1.5">PHYSICAL EXAMINATION SPECS</label>
              <div className="font-sans text-[10.5px] text-slate-900 border border-slate-300 p-2.5 rounded h-24 overflow-y-auto bg-slate-50 font-medium leading-relaxed normal-case">
                {fpe.physicalExam || 'COMPLETED ON SITE. ALL PHYSIOLOGICAL SYSTEMS NORMAL WITH ZERO ACUTE FINDINGS.'}
              </div>
            </div>
            <div className="p-3">
              <label className="text-[7.5px] font-black text-slate-500 block leading-none mb-1.5">DIAGNOSIS, MEDICATION & REVALUATION PLAN</label>
              <div className="font-sans text-[10.5px] text-slate-900 border border-slate-300 p-2.5 rounded h-24 overflow-y-auto bg-slate-50 font-medium leading-relaxed normal-case">
                {fpe.assessmentPlan || 'PRIMARY HEALTHCARE ENROLLMENT UNDER PHILHEALTH KONSULTA BENEFIT ASSIGNED.'}
              </div>
            </div>
          </div>
        </div>

        {/* PART VI: CLINICAL ATTESTATION & SWORN CONSENT */}
        <div className="border-[2px] border-black text-left bg-slate-50">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART VI: CLINICAL ATTESTATION & SWORN CONSENT
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black">
            <div className="p-3 flex flex-col justify-between">
              <p className="text-[9.5px] text-slate-505 leading-normal font-bold normal-case text-justify">
                Under PhilHealth sworn document guidelines, the clinical verifier certifies that all first patient encounter clinical details declared above are properly recorded under standard healthcare inspection parameters.
              </p>
              <div className="mt-4 flex flex-col items-center">
                <div className="border-b border-black w-full max-w-[250px] h-16 relative flex items-center justify-center bg-white rounded p-1 shadow-sm">
                  {h.patientSignature ? (
                    <img 
                      src={h.patientSignature} 
                      className="max-h-16 w-auto object-contain filter contrast-125 saturate-0" 
                      alt="Patient Signature" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider select-none absolute bottom-1">NO SIGNATURE CAPTURED</span>
                  )}
                </div>
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-wide mt-1.5">SIGNATURE OVER PRINTED NAME OF PATIENT</span>
              </div>
            </div>
            <div className="p-3 flex flex-col justify-between">
              <p className="text-[9.5px] text-slate-550 leading-normal font-bold normal-case text-justify">
                I certify that I have conducted standard first-patient encounter verification on the registrant named herein.
              </p>
              <div className="mt-4 flex flex-col items-center">
                <div className="border-b border-black w-full max-w-[250px] h-16 relative flex items-center justify-center bg-white rounded p-1 shadow-sm font-serif italic text-blue-900 font-bold text-center">
                  DR. DICKY FERNANDEZ, MD
                </div>
                <div className="text-center text-[7px] text-slate-500 font-black uppercase mt-1">
                  <span>ATTENDING PHYSICIAN / MEDICAL OFFICER</span>
                  <div className="font-mono text-[8px] text-slate-800 font-bold">LICENSE NO: 34912-A | PTR NO: PTR-8293122</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPcsfForm = (h: Household) => {
    const pcsf = h.pcsfDetails || {};
    let details = h.pmrfDetails || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (e) { details = {}; }
    }
    return (
      <div className="max-w-[900px] mx-auto border-[3px] border-black bg-white p-6 font-sans text-xs text-black uppercase space-y-4 shadow-xl select-text leading-tight animate-fade-in relative">
        <div className="absolute top-2 right-2 bg-[#1a56db] text-white text-[8px] font-black px-2 py-0.5 rounded shadow">BENEFICIARY COPY</div>
        
        {/* PCSF Header */}
        <div className="border-[2px] border-black bg-[#1e40af] p-4 text-center text-white flex flex-col md:flex-row items-center justify-center relative gap-3">
          <div className="md:absolute md:left-4 top-1/2 md:-translate-y-1/2 flex items-center shrink-0">
            <PhilHealthLogo className="h-14 w-14 shrink-0 bg-white p-1 rounded-lg border border-indigo-300" />
          </div>
          <div className="text-center md:pl-16">
            <h3 className="font-black text-[9px] tracking-widest text-indigo-100 leading-none">REPUBLIC OF THE PHILIPPINES</h3>
            <h2 className="text-xs font-black text-white uppercase mt-1 tracking-tight leading-none">PHILIPPINE HEALTH INSURANCE CORPORATION</h2>
            <h4 className="text-[11px] font-black text-white uppercase tracking-wider mt-1.5 leading-none">PRIMARY CARE PROVIDER SELECTION FORM (PCSF)</h4>
            <span className="text-[7.5px] text-indigo-100 block mt-1.5 tracking-tight font-mono uppercase">PhilHealth Konsulta Benefit Provider Registration voucher</span>
          </div>
        </div>

        {/* PART I: MEMBER IDENTIFICATION */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART I: MEMBER / BENEFICIARY PERSONAL DETAILS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
            <div className="md:col-span-4 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">MEMBER PIN</label>
              <strong className="text-slate-900 text-[11px] font-mono tracking-wider">
                {details.pin || h.id || 'NOT ENROLLED / PENDING'}
              </strong>
            </div>
            <div className="md:col-span-5 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">FULL NAME (LAST, FIRST, MIDDLE, SUFFIX)</label>
              <strong className="text-slate-900 text-[11px] font-black">
                {pcsf.fullName || h.householdHead}
              </strong>
            </div>
            <div className="md:col-span-3 p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">MEMBER TYPE</label>
              <strong className="text-slate-900 text-[11px] font-black uppercase">
                {pcsf.type || 'MEMBER'}
              </strong>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black border-t border-black bg-slate-50">
            <div className="p-2 md:col-span-12">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">COMPLETE MAILING ADDRESS RECORDS</label>
              <strong className="text-slate-900 text-[10.5px] font-black">
                BARANGAY {pcsf.addressBarangay || h.barangay || 'N/A'}, {pcsf.addressCity || 'PAGADIAN CITY'}, {pcsf.addressProvince || 'ZAMBOANGA DEL SUR'}
              </strong>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black border-t border-black text-xs">
            <div className="p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">REGISTERED CONTACT NO</label>
              <strong className="text-slate-900 font-mono text-[11px]">
                {pcsf.contactNo || h.contactNumber || 'N/A'}
              </strong>
            </div>
            <div className="p-2">
              <label className="text-[7px] font-black text-slate-500 block leading-none mb-1">REGISTERED EMAIL</label>
              <strong className="text-slate-900 font-semibold lowercase text-[11px]">
                {pcsf.email || 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        {/* PART II: PRIMARY CARE PROVIDER SELECTION PREFERENCES */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART II: PREFERRED PRIMARY CARE KONSULTA PROVIDER
          </div>
          <div className="p-3 bg-white space-y-3">
            {pcsf.registerPcc !== false ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5 text-left">
                <span className="text-[9px] font-black uppercase text-blue-950 tracking-wider">PRIORITY CHOICE 1: (PRIMARY CARE CENTER)</span>
                <strong className="text-blue-900 block text-xs font-black">☒ {pcsf.pcc1 || 'SAINT FRANCIS HEALTH CLINIC PROVIDER'}</strong>
                <span className="text-[10px] text-slate-500 block font-bold">ADDRESS: {pcsf.pcc1Addr || 'SAN FRANCISCO, PAGADIAN CITY, ZAMBOANGA DEL SUR'}</span>
              </div>
            ) : (
              <div className="p-3 bg-red-50 text-red-800 border rounded-lg font-bold">
                ⚠️ NO PRIMARY CARE CENTER SELECTED!
              </div>
            )}

            {pcsf.pcc2 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-left">
                <span className="text-[9px] font-black uppercase text-slate-650 tracking-wider">PRIORITY CHOICE 2: (BACK-UP SECONDARY CLINIC)</span>
                <strong className="text-slate-850 block text-xs">☒ {pcsf.pcc2}</strong>
                <span className="text-[10px] text-slate-500 block">ADDRESS: {pcsf.pcc2Addr || 'N/A'}</span>
              </div>
            )}

            <div className="flex items-center gap-2 p-2 bg-slate-50 border rounded-lg text-[10.5px] text-slate-605 font-extrabold">
              <span>INCLUDE DECLARED HOUSEHOLD FAMILY DEPENDENTS UNDER THIS PCC SELECTION?</span>
              <strong className="uppercase font-mono text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded">
                {pcsf.registerDependents ? 'YES ☒' : 'NO ☐'}
              </strong>
            </div>
          </div>
        </div>

        {/* PART III: PORTABILITY & TRANSFER */}
        <div className="border-[2px] border-black text-left">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART III: PORTABILITY & INTER-CLINIC PROVIDER TRANSFER REVIEWS
          </div>
          <div className="p-3 bg-white space-y-3">
            {pcsf.transfer ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-white p-2.5 border border-slate-300 rounded">
                    <span className="text-slate-500 block text-[8px] font-black mb-1">PREVIOUS CLINICAL PROVIDER</span>
                    <strong className="text-red-700 font-black block">{pcsf.prevPcc || 'N/A'}</strong>
                  </div>
                  <div className="bg-white p-2.5 border border-slate-300 rounded">
                    <span className="text-slate-500 block text-[8px] font-black mb-1">REASON FOR CLINICAL TRANSFER</span>
                    <strong className="text-slate-800 font-black block">CHANGE OF RESIDENCE / PROXIMITY INDEX</strong>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 leading-normal font-bold text-justify">
                REGISTRANT IS ESTABLISHING A FRESH PRIMARY HEALTH CARE COORDINATE RECORD AT SFC WITHOUT MOVING FROM ANOTHER PROVIDER. NO HISTORICAL REGISTRATION TRANSFERS OR INTER-CLINIC RELOCATIONS HAVE BEEN RECORDED ON THIS FILE.
              </p>
            )}
          </div>
        </div>

        {/* PART IV: ACKNOWLEDGEMENT AND CONSENT */}
        <div className="border-[2px] border-black text-left bg-slate-50">
          <div className="bg-black text-white font-black px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-black">
            PART IV: AUTHORIZATION ACCORD, ACKNOWLEDGEMENT & CONSENT
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
            <div className="md:col-span-7 p-3 flex flex-col justify-between">
              <p className="text-[9.5px] text-slate-505 leading-normal normal-case font-extrabold text-justify">
                I CHOOSE SAINT FRANCIS CLINIC AS MY PRIMARY HEALTHCARE PROVIDER AND AUTHORIZE CLINIC STAFFS TO UTILIZE MY REGISTRATION PROFILE TO SECURE KONSULTA BENEFIT SERVICES PROCLAIMED BY PHILHEALTH ON MY BEHALF. I DECLARE UNDER PENALTY OF LAW THAT ALL STATEMENTS MADE IN THIS SELECTION VOUCHER ARE TRUE, VERIFIED, AND COMPLIANT.
              </p>
              <div className="text-[7.5px] text-slate-400 block font-mono mt-3 leading-tight uppercase font-black">
                <span>Voucher Timestamp: {pcsf.date || new Date().toLocaleDateString()}</span>
              </div>
            </div>
            <div className="md:col-span-5 p-3 flex flex-col items-center justify-center">
              <div className="border-b border-black w-full max-w-[250px] h-16 relative flex items-center justify-center bg-white rounded p-1 shadow-sm">
                {h.patientSignature ? (
                  <img 
                    src={h.patientSignature} 
                    className="max-h-16 w-auto object-contain filter contrast-125 saturate-0" 
                    alt="Patient Signature" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider select-none absolute bottom-1">NO SIGNATURE CAPTURED</span>
                )}
              </div>
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-wide mt-1.5 text-center">SIGNATURE OF REGISTERED BENEFICIARY / REPRESENTATIVE</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPmrfForm = (h: Household) => {
    let details = h.pmrfDetails || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (e) { details = {}; }
    }
    return (
      <div className="max-w-[900px] mx-auto border-[3px] border-black bg-white p-6 font-sans text-xs text-black uppercase space-y-4 shadow-xl select-text leading-tight animate-fade-in relative">
        <div className="border-[2px] border-black bg-white grid grid-cols-1 md:grid-cols-12 text-black font-sans leading-tight overflow-hidden rounded-lg mb-4 select-none">
          {/* Left Section: Logo & Reminders */}
          <div className="md:col-span-6 p-4 flex flex-col border-b md:border-b-0 md:border-r border-black justify-between bg-white text-black text-left">
            <div className="flex items-center gap-3">
              <PhilHealthLogo className="h-12 w-12 shrink-0 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200" />
              <div className="flex flex-col text-left">
                <div className="flex items-baseline leading-none">
                  <span className="text-[25px] font-black tracking-tighter text-[#1f2937]" style={{ fontFamily: "Inter, sans-serif" }}>Phil</span>
                  <span className="text-[25px] font-extrabold tracking-tighter text-[#111827]" style={{ fontFamily: "Georgia, serif" }}>Health</span>
                </div>
                <span className="text-[9px] font-bold text-slate-800 italic mt-0.5 pl-0.5 block leading-none" style={{ fontFamily: "Georgia, serif" }}>
                  Your Partner in Health
                </span>
              </div>
            </div>
            <div className="border-t border-black my-2.5"></div>
            <div className="flex flex-col text-black text-left">
              <span className="text-[9.5px] font-black underline tracking-wide mb-1.5 uppercase leading-none block text-left">
                REMINDERS:
              </span>
              <ol className="list-decimal list-outside pl-4 space-y-1 text-[7.5px] font-bold text-justify tracking-tight leading-normal uppercase">
                <li>Your PhilHealth Identification Number (PIN) is your unique and permanent number.</li>
                <li>Always use your PIN in all transactions with PhilHealth.</li>
                <li>For Updating/Amendment check the appropriate box and provide details to be accomplished and submit corresponding supporting documents.</li>
                <li>Please read instructions at the back before filling-out this form.</li>
              </ol>
            </div>
          </div>

          {/* Right Section: Form titles, PIN, Purpose */}
          <div className="md:col-span-6 p-4 flex flex-col justify-between space-y-4 bg-white text-black text-left">
            <div className="text-center flex flex-col space-y-1">
              <h2 className="text-[24px] font-black tracking-tighter leading-none text-black uppercase" style={{ fontFamily: "Inter, sans-serif" }}>PMRF</h2>
              <p className="text-[9px] font-black tracking-tight text-black leading-none uppercase">
                PHILHEALTH MEMBER REGISTRATION FORM
              </p>
              <span className="text-[8.5px] font-bold text-black leading-none uppercase">
                UHC v.1 January 2020
              </span>
            </div>

            {/* PIN field */}
            <div className="flex flex-col items-center">
              <div className="flex border border-black divide-x divide-black h-7 bg-white">
                {Array.from({ length: 12 }).map((_, idx) => {
                  const pinTrimmed = (details.pin || '').replace(/\D/g, '');
                  const pinPadded = pinTrimmed.padEnd(12, ' ');
                  const char = pinPadded[idx] || '';
                  return (
                    <div key={idx} className="w-[20px] h-full flex items-center justify-center font-mono font-black text-xs text-black bg-white select-none">
                      {char.trim()}
                    </div>
                  );
                })}
              </div>
              <span className="text-[8px] font-black text-black tracking-tight mt-1 ml-0.5 uppercase select-none block text-center">
                PHILHEALTH IDENTIFICATION NUMBER (PIN)
              </span>
            </div>

            {/* PURPOSE Block */}
            <div className="grid grid-cols-12 gap-1 items-center bg-white">
              <span className="col-span-3 text-[9px] font-black text-black uppercase select-none text-left">
                PURPOSE:
              </span>
              <div className="col-span-9 flex items-center gap-6">
                <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer uppercase select-none">
                  <input type="checkbox" readOnly checked={!details.purpose || details.purpose.toUpperCase() === 'REGISTRATION'} className="h-3.5 w-3.5 text-black border-black focus:ring-0 accent-black pointer-events-none" />
                  <span>REGISTRATION</span>
                </label>
                <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer uppercase select-none">
                  <input type="checkbox" readOnly checked={!!details.purpose && details.purpose.toUpperCase() !== 'REGISTRATION'} className="h-3.5 w-3.5 text-black border-black focus:ring-0 accent-black pointer-events-none" />
                  <span>UPDATING/AMENDMENT</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* I. PERSONAL DETAILS */}
        <div className="space-y-1">
          <div className="bg-[#dee5db] border border-black text-black font-extrabold px-3 py-1 text-[11px] block select-none text-center uppercase font-sans">
            I. PERSONAL DETAILS
          </div>
          <div className="overflow-x-auto border-x border-b border-black bg-white select-none">
            <table className="w-full border-collapse text-[9px] font-sans table-fixed min-w-[700px]">
              <thead>
                <tr className="bg-white border-b border-black text-center text-[7.5px] font-black">
                  <th className="border-r border-black w-[13%]"></th>
                  <th className="border-r border-black w-[20%] font-black uppercase">LAST NAME</th>
                  <th className="border-r border-black w-[22%] font-black uppercase">FIRST NAME</th>
                  <th className="border-r border-black w-[11%] font-black tracking-tight">NAME EXTENSION</th>
                  <th className="border-r border-black w-[20%] font-black uppercase">MIDDLE NAME</th>
                  <th className="border-r border-black w-[7%] text-center text-[6.5px]">NO MIDDLE NAME</th>
                  <th className="w-[7%] text-center text-[6.5px]">MONONYM</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-black h-9">
                  <td className="border-r border-black px-2 font-black text-[9px] text-black bg-white uppercase leading-none select-none">
                    MEMBER
                  </td>
                  <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                    {details.lastName || h.householdHead.split(',')[0]}
                  </td>
                  <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                    {details.firstName || h.householdHead.split(',')[1] || h.householdHead}
                  </td>
                  <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-center text-black bg-white">
                    {details.nameExt || ''}
                  </td>
                  <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                    {details.middleName || ''}
                  </td>
                  <td className="border-r border-black bg-white text-center p-1">
                    <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black mx-auto">
                      {!details.middleName ? 'X' : ''}
                    </div>
                  </td>
                  <td className="bg-white text-center p-1">
                    <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black mx-auto">
                      {details.mononym ? 'X' : ''}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* II. ADDRESS AND CONTACT DETAILS */}
        <div className="space-y-1">
          <div className="bg-[#dee5db] border border-black text-black font-extrabold px-3 py-1 text-[11px] block select-none text-center uppercase font-sans">
            II. ADDRESS AND CONTACT DETAILS
          </div>
          <div className="border border-black p-3 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div>
              <span className="text-[8px] font-bold block text-slate-500">COMPLETE MAILING ADDRESS</span>
              <strong className="text-slate-900 text-xs font-black uppercase">
                BARANGAY {h.purok}, {h.barangay}, PAGADIAN CITY, ZAMBOANGA DEL SUR
              </strong>
            </div>
            <div>
              <span className="text-[8px] font-bold block text-slate-500">REGISTERED CONTACT / MOBILE</span>
              <strong className="text-slate-900 text-xs font-mono font-black">
                {h.contactNumber || 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        {/* III. MEMBER TYPE */}
        <div className="space-y-1">
          <div className="bg-[#dee5db] border border-black text-black font-extrabold px-3 py-1 text-[11px] block select-none text-center uppercase font-sans">
            III. MEMBER TYPE
          </div>
          <div className="border border-black p-3 bg-white text-left grid grid-cols-2 md:grid-cols-4 gap-3">
            {renderCheckboxHelper('Direct Contributor', true, false, 'Employed / Self-Employed')}
            {renderCheckboxHelper('Indirect Contributor', false, false, 'Senior Citizen / Indigent')}
            {renderCheckboxHelper('Lifetime Member', false, false, 'Retired / 120+ contributions')}
            {renderCheckboxHelper('Dependent Holder', false, false, 'Assigned relative link')}
          </div>
        </div>

        {/* SIGNATURE ATTESTATION */}
        <div className="border-[2px] border-black text-left bg-slate-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <p className="text-[9.5px] text-slate-505 leading-normal normal-case font-extrabold text-justify flex flex-col justify-between">
            <span>I DECLARE UNDER PENALTY OF LAW THAT THE RECOLLECTIONS DISCLOSED HEREIN ARE TRUE AND VALID COMPLIANT RECORDS CAPTURED PURSUANT TO THE PHILHEALTH HEALTH REGISTRATION CHARTER.</span>
            <span className="text-[8px] text-slate-400 block font-mono mt-4">PMRF TIMELINE VOUCHER INDEX: {new Date().toLocaleDateString()}</span>
          </p>
          <div className="flex flex-col items-center justify-center">
            <div className="border-b border-black w-full max-w-[250px] h-16 relative flex items-center justify-center bg-white rounded p-1 shadow-sm">
              {h.patientSignature ? (
                <img src={h.patientSignature} className="max-h-16 w-auto object-contain filter contrast-125 saturate-0" alt="Patient Signature" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider select-none absolute bottom-1">NO SIGNATURE CAPTURED</span>
              )}
            </div>
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-wide mt-1.5 text-center">SIGNATURE OF REGISTERED MEMBER / REPRESENTATIVE</span>
          </div>
        </div>
      </div>
    );
  };

  const renderPmrfBackForm = (h: Household) => {
    let details = h.pmrfDetails || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (e) { details = {}; }
    }
    return (
      <div className="max-w-[900px] mx-auto border-[3px] border-black bg-white p-6 font-sans text-xs text-black uppercase space-y-4 shadow-xl select-text leading-tight animate-fade-in relative text-black">
        <div className="bg-[#dee5db] border border-black text-center font-extrabold text-[12px] py-2 tracking-wider uppercase font-sans text-black">
          V. UPDATING/AMENDMENT (PMRF PAGE 2)
        </div>
        <div className="border border-black">
          <div className="grid grid-cols-10 divide-x divide-black border-b border-black font-extrabold text-[9px] bg-white text-black h-8 items-center text-left">
            <div className="col-span-4 px-3 py-1 font-black text-black select-none uppercase tracking-wide">
              PLEASE CHECK:
            </div>
            <div className="col-span-3 px-3 py-1 text-center font-black text-black select-none uppercase tracking-wide">
              FROM
            </div>
            <div className="col-span-3 px-3 py-1 text-center font-black text-black select-none uppercase tracking-wide">
              TO
            </div>
          </div>

          {/* Row 1: Name */}
          <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
            <div className="col-span-4 p-2 flex items-start gap-2.5 bg-white select-none">
              <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none mt-0.5 select-none shrink-0">
                {details.pmrfBackChangeName ? 'X' : ''}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-[9px] text-black leading-tight uppercase font-sans">Change/Correction of Name</span>
              </div>
            </div>
            <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] min-h-10 text-slate-800 text-left">
              {details.pmrfBackChangeName ? (details.pmrfBackFromValueName || '—') : '—'}
            </div>
            <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] min-h-10 text-blue-700 text-left">
              {details.pmrfBackChangeName ? (details.pmrfBackToValueName || '—') : '—'}
            </div>
          </div>

          {/* Row 2: DOB */}
          <div className="grid grid-cols-10 divide-x divide-black text-black">
            <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
              <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none shrink-0">
                {details.pmrfBackChangeDOB ? 'X' : ''}
              </div>
              <span className="font-extrabold text-[9px] text-black leading-none uppercase font-sans text-left">Correction of Date of Birth</span>
            </div>
            <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-left">
              {details.pmrfBackChangeDOB ? (details.pmrfBackFromValueDOB || '—') : 'YYYY-MM-DD'}
            </div>
            <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-left">
              {details.pmrfBackChangeDOB ? (details.pmrfBackToValueDOB || '—') : 'YYYY-MM-DD'}
            </div>
          </div>
        </div>
      </div>
    );
  };

    return (
    <div className="space-y-6 font-sans text-xs">
      {/* Dynamic Header banner */}
      <div className="bg-gradient-to-r from-red-900 to-slate-900 p-6 rounded-2xl text-white shadow-md border border-red-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
            Disapproved Submissions Portal
          </h2>
          <p className="text-slate-350 text-[10px] mt-1 font-medium">
            Active view of submitted household profiles sent back by evaluators due to missing data, incorrect attachments, or invalid formats.
          </p>
        </div>
        <button 
          onClick={fetchDisapproved}
          className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 p-3 rounded-lg flex items-center gap-1.5 transition active:scale-95 text-[10px] uppercase cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Force Sync
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-red-650 border-r-transparent mb-1.5"></div>
          <p className="text-slate-400 font-medium">Scanning disapproved files and synchronizing records...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 text-red-700 border-l-4 border-red-500 p-4 rounded-xl font-medium shadow-xs">
          {errorMsg}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">No records found.</h3>
          <p className="text-[10px] text-slate-500 mt-1 max-w-sm mx-auto">
            All submissions are either pending validation, successfully verified in Saint Francis Database, or belong to other users.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {items.map((h) => {
            const hasAttachment = h.attachments && h.attachments.length > 0;
            return (
              <div 
                key={h.id} 
                className="bg-white border-2 border-red-100 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition relative overflow-hidden"
              >
                {/* Visual red tag in top corners */}
                <div className="absolute top-0 right-0 bg-red-600 text-white font-extrabold uppercase text-[8px] font-mono tracking-widest px-3 py-1 rounded-bl-xl shadow-xs">
                  DISAPPROVED
                </div>

                <div className="flex items-start gap-3.5 border-b pb-3">
                  <div className="h-11 w-11 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                    🏠
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono bg-red-100 text-red-800 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                        {h.householdNumber}
                      </span>
                      <span className="text-slate-400 font-mono text-[9.5px]">
                        Created: {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-base mt-1">
                      {h.householdHead}
                    </h3>
                  </div>
                </div>

                {/* CRITICAL REASON DISAPPROVED INSIDE HIGH VISIBILITY CARD */}
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3.5 space-y-1">
                  <span className="text-red-550 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Feedbacks on Lacking / Missing items:
                  </span>
                  <p className="text-red-900 font-extrabold text-[11px] leading-snug">
                    {h.remarks || 'No detailed review log provided yet.'}
                  </p>
                </div>

                {/* Key metadata */}
                <div className="bg-slate-50/70 border rounded-xl p-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> Loc: <strong>{h.barangay}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone: <strong className="font-mono">{h.contactNumber || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Field Personnel: <strong>{h.createdBy}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> Submitter: <strong className="text-slate-700">{h.createdBy}</strong>
                  </span>
                </div>

                {/* Action buttons */}
                <div className="pt-2 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-[10px]">
                    {hasAttachment ? (
                      <span className="text-emerald-600 font-bold">📎 ID Scans Attached</span>
                    ) : (
                      <span className="text-red-600 font-bold animate-pulse">⚠️ Missing Scanned ID Attachments</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    {isRealMasterAdmin && (
                      <button
                        onClick={() => handleDeleteDisapproved(h.id, h.householdHead)}
                        className="bg-red-600 text-white font-bold px-3 py-2.5 rounded-lg active:scale-95 transition cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                        title="Delete this disapproved submission permanently"
                      >
                        🗑️ Delete
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setPreviewItem(h);
                        const hasFpePcsf = h.isFpePcsfOnly || h.isNewMemberFpe;
                        setPreviewTab(hasFpePcsf ? 'FPE' : 'PMRF');
                      }}
                      className="bg-emerald-600 text-white font-bold px-3 py-2.5 rounded-lg active:scale-95 transition cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                      title="Preview full layouts of PMRF, FPE, and PCSF forms"
                    >
                      👁️ View Forms Layout
                    </button>
                    <button
                      onClick={() => handleOpenEdit(h)}
                      className="btn-3d-primary font-bold px-4 py-2.5 flex items-center gap-1 cursor-pointer text-[10px] uppercase tracking-wider shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Correct & Resubmit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK CORRECT MODAL DIALOG */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans text-slate-800">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative border overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Edit3 className="h-5 w-5 text-blue-600" />
                  Revise Submission Details
                </h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Solve discrepancies to stamp record clear of gaps and resubmit.</p>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Prominent Disapproval details metadata audit trail card */}
            <div className="bg-slate-50 border-2 border-red-200 rounded-xl p-4.5 mb-5 space-y-3 text-xs leading-relaxed">
              <div className="border-b pb-2 mb-2 flex items-center justify-between">
                <span className="text-red-700 font-extrabold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Official Disapproval Audit Trail Dossier
                </span>
                <span className="text-[10px] bg-red-100 text-red-800 font-mono font-bold px-2 py-0.5 rounded-full">
                  {editingItem.submissionReferenceNumber || editingItem.householdNumber}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-755 font-sans">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Submission Ref Number</span>
                  <strong className="font-mono text-slate-900 mt-1 block">{editingItem.submissionReferenceNumber || editingItem.householdNumber}</strong>
                </div>
                
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Household Name</span>
                  <strong className="text-slate-900 mt-1 block">{editingItem.householdHead}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Date Submitted</span>
                  <strong className="text-slate-950 mt-1 block">
                    {editingItem.dateSubmitted ? new Date(editingItem.dateSubmitted).toLocaleString() : (editingItem.createdAt ? new Date(editingItem.createdAt).toLocaleString() : 'N/A')}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Date Disapproved</span>
                  <strong className="text-slate-950 mt-1 block">
                    {editingItem.updatedAt ? new Date(editingItem.updatedAt).toLocaleString() : 'N/A'}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Disapproved By</span>
                  <strong className="text-slate-900 mt-1 block">{editingItem.updatedBy || 'Clinical Evaluator'}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Attached Files</span>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {editingItem.attachments && editingItem.attachments.length > 0 ? (
                      editingItem.attachments.map((img: any, idx: number) => {
                        const isObj = img && typeof img === 'object';
                        const fileData = isObj ? img.fileData : img;
                        const fileName = isObj ? (img.fileName || img.fullName || `File ${idx + 1}`) : `File ${idx + 1}`;
                        return (
                          <a 
                            key={idx} 
                            href={fileData} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[9.5px] text-blue-600 hover:underline flex items-center gap-0.5 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 font-semibold"
                          >
                            📎 {fileName}
                          </a>
                        );
                      })
                    ) : (
                      <span className="text-red-650 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100 text-[9.5px]">No files attached</span>
                    )}
                  </div>
                </div>
                
                <div className="sm:col-span-2 bg-white border border-red-100 rounded-lg p-2.5 mt-1">
                  <span className="text-red-750 font-bold uppercase tracking-wider text-[8.5px] block leading-none mb-1">Reason for Disapproval</span>
                  <p className="text-red-950 font-semibold leading-relaxed text-[11px]">
                    {editingItem.remarks || 'No detailed review feedback log provided yet.'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveAndResubmit} className="space-y-4">
              <span className="font-bold text-blue-800 block uppercase tracking-wider text-[10px] border-b pb-1">1. Demographics & Geotag</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Household Head Name</label>
                  <input
                    type="text"
                    value={editHeadName}
                    onChange={(e) => setEditHeadName(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Contact Phone Number</label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 bg-slate-50 font-mono"
                    placeholder="e.g. 09123456789"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Select Barangay Position</label>
                  <select
                    value={editBarangay}
                    onChange={(e) => {
                      const newBarangay = e.target.value;
                      setEditBarangay(newBarangay);
                      const selectedBrg = barangayList.find(b => b.name === newBarangay);
                      const filteredPuroks = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === newBarangay);
                      if (filteredPuroks.length > 0) {
                        setEditPurok(filteredPuroks[0].purokName || filteredPuroks[0].name);
                      } else {
                        setEditPurok('');
                      }
                    }}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none bg-white focus:border-blue-500"
                    required
                  >
                    {barangayList.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                    {barangayList.length === 0 && (
                      ['San Francisco', 'Santa Lucia', 'Tuburan', 'Lumbia', 'Balangasan'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Assign Purok Sector</label>
                  <select
                    value={editPurok}
                    onChange={(e) => setEditPurok(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none bg-white focus:border-blue-500"
                    required
                  >
                    {(() => {
                      const selectedBrg = barangayList.find(b => b.name === editBarangay);
                      const filtered = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === editBarangay);
                      return filtered.map(p => {
                        const pName = p.purokName || p.name;
                        return <option key={p.id} value={pName}>{pName}</option>;
                      });
                    })()}
                    {(() => {
                      const selectedBrg = barangayList.find(b => b.name === editBarangay);
                      const filtered = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === editBarangay);
                      if (filtered.length === 0) {
                        return <option value="">No Puroks Registered</option>;
                      }
                      return null;
                    })()}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none mb-1.5">Geotag Coordinates (Lat & Lng Index)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                      <input 
                        type="text" 
                        value={editLat} 
                        onChange={(e) => setEditLat(e.target.value)} 
                        placeholder="Latitude"
                        className="w-full bg-white border p-2 border-slate-300 rounded text-center text-[10px] font-mono outline-none focus:border-blue-500"
                      />
                      <input 
                        type="text" 
                        value={editLng} 
                        onChange={(e) => setEditLng(e.target.value)} 
                        placeholder="Longitude"
                        className="w-full bg-white border p-2 border-slate-300 rounded text-center text-[10px] font-mono outline-none font-semibold focus:border-blue-500"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRandomCoordinates}
                      title="Auto Tag Coordinates"
                      className="btn-3d-primary w-full sm:w-auto px-4 py-2 sm:py-1.5 text-white font-bold text-[10px] uppercase rounded-lg shrink-0 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      📍 Tag Coords
                    </button>
                  </div>
                </div>
              </div>

              <span className="font-bold text-blue-800 block uppercase tracking-wider text-[10px] border-b pb-1 pt-2">2. PhilHealth PMRF Duplicate Form fields</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Filing Purpose</label>
                  <select
                    value={editPurpose}
                    onChange={(e: any) => setEditPurpose(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none font-semibold bg-white"
                  >
                    <option value="REGISTRATION">REGISTRATION</option>
                    <option value="UPDATING">UPDATING</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">PIN Identification No.</label>
                  <input
                    type="text"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="PhilHealth PIN"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Spouse Full Name</label>
                  <input
                    type="text"
                    value={editSpouseName}
                    onChange={(e) => setEditSpouseName(e.target.value)}
                    placeholder="Spouse Name"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Mother's Maiden Name <span className="text-red-500 font-extrabold">*</span></label>
                  <input
                    type="text"
                    value={editMotherMaiden}
                    onChange={(e) => setEditMotherMaiden(e.target.value)}
                    placeholder="Mother's Maiden"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Date of Birth</label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Sex</label>
                  <select
                    value={editSex}
                    onChange={(e: any) => setEditSex(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Civil Status</label>
                  <select
                    value={editCivilStatus}
                    onChange={(e: any) => setEditCivilStatus(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Annulled">Annulled</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Legally Separated">Legally Separated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Citizenship</label>
                  <select
                    value={editCitizenship}
                    onChange={(e: any) => setEditCitizenship(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
                  >
                    <option value="FILIPINO">FILIPINO</option>
                    <option value="FOREIGN">FOREIGN</option>
                    <option value="DUAL">DUAL CITIZEN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Birth Place</label>
                  <input
                    type="text"
                    value={editBirthPlace}
                    onChange={(e) => setEditBirthPlace(e.target.value)}
                    placeholder="City or Municipality"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2 border-t">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">PhilHealth Program Willingness</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editPmrfVal" 
                        checked={editPmrf === 'Willing'} 
                        onChange={() => setEditPmrf('Willing')} 
                      />
                      <span className="font-bold text-emerald-600">Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editPmrfVal" 
                        checked={editPmrf === 'Not Willing'} 
                        onChange={() => setEditPmrf('Not Willing')} 
                      />
                      <span className="font-bold text-red-600">Not Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editPmrfVal" 
                        checked={editPmrf === 'Pending'} 
                        onChange={() => setEditPmrf('Pending')} 
                      />
                      <span className="font-bold text-slate-500">Pending</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Yakap Willingness Status</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editYakapVal" 
                        checked={editYakap === 'Willing'} 
                        onChange={() => setEditYakap('Willing')} 
                      />
                      <span className="font-bold text-emerald-600">Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editYakapVal" 
                        checked={editYakap === 'Not Willing'} 
                        onChange={() => setEditYakap('Not Willing')} 
                      />
                      <span className="font-bold text-red-600">Not Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editYakapVal" 
                        checked={editYakap === 'Pending'} 
                        onChange={() => setEditYakap('Pending')} 
                      />
                      <span className="font-bold text-slate-500">Pending</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* UNIFIED SIGNATURE BLOCK IN DISAPPROVED/REVISE DIALOG */}
              <div className="border border-slate-305 bg-blue-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block mt-4">
                📝 Unified Patient / Representative Signature (Auto-Stamps on all 3 Forms)
              </div>
              <div className="p-4 border border-slate-300 bg-white flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs mb-4 rounded-b-lg">
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Patient Sworn Signature Seal</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    The patient signature is required to authorize PhilHealth PMRF, clinical FPE intake, and PCSF provider selection. Review or re-draw a clean signature if the previous one was rejected or is missing.
                  </p>
                </div>
                <div className="shrink-0">
                  <SignaturePad 
                    onChange={(sig) => setEditSignature(sig)} 
                    defaultValue={editSignature}
                  />
                </div>
              </div>

              {/* ATTACHMENT SECTION - HIGH EMPHASIS IF NONE WAS ATTACHED PREVIOUSLY */}
              <div className="border border-slate-305 bg-emerald-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block mt-4">
                📂 Attachments (Dossier Identity Verification Logs)
              </div>
              <div className="p-4 border border-slate-300 bg-slate-50/50 rounded-b-lg space-y-3">
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Provide verified ID card scans or document proofs to complete requirements.
                  {(!editingItem.attachments || editingItem.attachments.length === 0) ? (
                    <span className="block mt-1.5 font-bold text-red-650 animate-pulse bg-red-50 p-2 rounded border border-red-200">
                      ⚠️ Crucial: This submission has NO ID attachments. If you do not attach a clear scan of the primary ID now, verification may be delayed.
                    </span>
                  ) : (
                    <span className="block mt-1.5 text-emerald-600 font-bold bg-emerald-50 p-2 rounded border border-emerald-100">
                      📎 Current record contains {editingItem.attachments.length} attachment(s). You may add additional documents below if needed.
                    </span>
                  )}
                </p>
                
                <div className="flex items-center justify-center p-5 border-2 border-dashed border-slate-300 bg-white hover:border-emerald-500 rounded-xl hover:bg-slate-50/70 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedAttachmentFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="text-center space-y-1">
                    <span className="text-slate-600 text-xs font-bold block">Click or Drag & Drop local image here to select</span>
                    <span className="text-[9px] text-slate-400 block font-medium">PNG, JPG, JPEG, WEBP files</span>
                  </div>
                </div>

                {selectedAttachmentFile && (
                  <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-bold truncate" id="disapproved-selected-upload-file-name">{selectedAttachmentFile.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({(selectedAttachmentFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      {uploadProgress === null && (
                        <button
                          type="button"
                          onClick={() => setSelectedAttachmentFile(null)}
                          className="text-rose-600 hover:text-rose-700 font-extrabold text-[10px] uppercase tracking-wide cursor-pointer p-0.5"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {uploadProgress !== null ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-emerald-800">
                          <span>Uploading to Secure Server...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-600 transition-all duration-120 ease-out rounded-full" 
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUploadAttachment}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:translate-y-[1px] select-none text-[10px] font-black uppercase text-white p-2 rounded-lg border-b-[2.5px] border-emerald-850 hover:border-emerald-705 transition cursor-pointer shadow-sm shadow-emerald-950/20 text-center"
                      >
                        Upload Attachment
                      </button>
                    )}
                  </div>
                )}

                {editAttachments.length > 0 && (
                  <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                    <span className="block text-[9.5px] font-bold text-slate-600 uppercase tracking-widest">Selected Attachments ({editAttachments.length}):</span>
                    <div className="flex gap-2.5 flex-wrap">
                      {editAttachments.map((img, idx) => {
                        const isObj = img && typeof img === 'object';
                        const fileData = isObj ? img.fileData : img;
                        const fileName = isObj ? (img.fileName || img.fullName || `File ${idx + 1}`) : `File ${idx + 1}`;
                        const isPdf = fileData?.startsWith('data:application/pdf') || (isObj && img.fileName && img.fileName.toLowerCase().endsWith('.pdf'));

                        return (
                          <div key={idx} className="relative h-16 w-[110px] rounded-lg overflow-hidden border-2 border-emerald-500 hover:scale-103 transition bg-slate-50 flex items-center justify-center p-0.5 group">
                            {isPdf ? (
                              <div className="h-full w-full bg-white flex flex-col items-center justify-center p-1 text-center font-mono">
                                <FileText className="h-6 w-6 text-red-500 mb-0.5" />
                                <span className="text-[6.5px] text-slate-500 truncate max-w-full font-bold leading-none">{fileName}</span>
                              </div>
                            ) : (
                              <img src={fileData} alt={fileName} className="h-full w-full object-cover rounded" />
                            )}
                            <button
                              type="button"
                              onClick={() => setEditAttachments(editAttachments.filter((_, i) => i !== idx))}
                              className="absolute top-0 right-0 bg-red-650 hover:bg-red-700 text-white font-extrabold h-4.5 w-4.5 flex items-center justify-center rounded-bl text-[9px] shadow cursor-pointer transition opacity-90 hover:opacity-100"
                              title="Delete Attachment"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2.5 pt-3.5 border-t border-slate-100 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 btn-3d-secondary font-bold uppercase cursor-pointer text-[10px] rounded-xl"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 btn-3d-primary btn-pulse-save text-white font-extrabold uppercase rounded-xl flex items-center gap-1.5 cursor-pointer text-[10px]"
                >
                  <Check className="h-4 w-4" /> Save Variations & Resubmit File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL FORMS PREVIEW MODAL */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10010] p-4 text-xs font-sans text-slate-800">
          <div className="bg-slate-100 rounded-3xl w-full max-w-5xl p-6 shadow-2xl relative border overflow-y-auto max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-4 mb-4 bg-white -mx-6 -mt-6 p-6 rounded-t-3xl">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                  View Submitted Forms Layout
                </h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Previewing actual multi-document registration forms of this disapproved profile.</p>
              </div>
              <button 
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-2 transition hover:scale-110 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* TAB CONTROLLERS */}
            <div className="flex border-b border-slate-200 pb-2 overflow-x-auto scrollbar-hide gap-1 md:gap-2 mb-4 bg-white p-2 rounded-xl">
              {!(previewItem.isFpePcsfOnly || previewItem.isNewMemberFpe) && (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('PMRF')}
                    className={`px-4 py-2 text-[10px] font-black transition duration-150 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap cursor-pointer ${
                      previewTab === 'PMRF'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    📄 PhilHealth PMRF (Page 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('PMRF_BACK')}
                    className={`px-4 py-2 text-[10px] font-black transition duration-150 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap cursor-pointer ${
                      previewTab === 'PMRF_BACK'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    📄 PMRF Updating (Page 2)
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setPreviewTab('FPE')}
                className={`px-4 py-2 text-[10px] font-black transition duration-150 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap cursor-pointer ${
                  previewTab === 'FPE'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                🩺 Patient Encounter (FPE)
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('PCSF')}
                className={`px-4 py-2 text-[10px] font-black transition duration-150 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap cursor-pointer ${
                  previewTab === 'PCSF'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                🏢 Provider Selection (PCSF)
              </button>
            </div>

            {/* FORM CONTAINER */}
            <div className="bg-slate-200/50 p-4 rounded-2xl border overflow-y-auto overflow-x-auto flex-1 min-h-[40vh] max-h-[55vh]">
              {previewTab === 'PMRF' && renderPmrfForm(previewItem)}
              {previewTab === 'PMRF_BACK' && renderPmrfBackForm(previewItem)}
              {previewTab === 'FPE' && renderFpeForm(previewItem)}
              {previewTab === 'PCSF' && renderPcsfForm(previewItem)}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 mt-4 border-t border-slate-100 text-[10px] text-slate-400 gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500 text-left"></span>
                <span className="text-left">All captured data and signatures are embedded in real time.</span>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-DESIGN CUSTOM CONFIRMATION POPUP MODAL */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setConfirmModal(null)}
          ></div>
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative max-w-md w-full overflow-hidden transform transition-all scale-100 duration-300 p-6 space-y-5">
            <div className="flex items-start gap-4 text-left">
              <span className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-sm border border-rose-100 mt-1 block">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmModal.title}
                </h3>
                <span className="text-[10px] font-bold text-red-650 uppercase bg-red-50 border border-red-100 px-2.5 py-0.5 rounded tracking-wider">
                  Critical Action Required
                </span>
                <p className="text-slate-500 text-xs leading-relaxed pt-2">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-605 hover:text-slate-905 hover:bg-slate-50 hover:border-slate-305 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all duration-200 hover:shadow-sm"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-red-200/50 hover:shadow-red-300/80 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CENTERING ALERT POPUP MODAL */}
      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setAlertModal(null)}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-sm w-full overflow-hidden p-6 space-y-4 text-center z-[10001] animate-fade-in animate-scale-up">
            <div className="flex flex-col items-center gap-3 text-center">
              {alertModal.type === 'success' ? (
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 block">
                  <CheckCircle2 className="h-8 w-8 animate-bounce" />
                </span>
              ) : (
                <span className="p-3 bg-rose-50 text-rose-650 rounded-full border border-rose-100 block">
                  <AlertCircle className="h-8 w-8 animate-pulse" />
                </span>
              )}
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{alertModal.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{alertModal.description}</p>
            </div>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-850 hover:shadow-md transition duration-150 cursor-pointer text-xs uppercase tracking-wide font-sans text-center"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
