import React, { useState, useEffect } from 'react';
import { PlusCircle, Search, Printer, Edit2, Check, ArrowLeft, HeartPulse, User, Calendar, FileText, ChevronRight, CheckSquare, Square, QrCode, Camera } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { User as UserType, Household, HealthRecord } from '../types';
import SignaturePad from './SignaturePad';

interface ConsultationProps {
  currentUser: UserType;
}

// Complex clinical details schema stored inside the record's "notes" field
interface ConsultationDetails {
  isConsultation: boolean;
  
  // Section A: PMRF BACK - Updating Alignment (Image 1)
  pmrfUpdating: {
    changeName: boolean;
    changeDOB: boolean;
    changeSex: boolean;
    changeCivilStatus: boolean;
    changePersonalInfo: boolean;
    fromValue: string;
    toValue: string;
    memberSignature: string; // Base64
    memberSignatureDate: string;
    memberThumbmark: string; // Base64
    receivedByFullName: string;
    receivedByBranch: string;
    receivedByDateTime: string;
  };

  // Section B: Medical History (Image 2)
  pastMedical: {
    allergy: boolean; allergySpec: string;
    asthma: boolean;
    cancer: boolean; cancerSpec: string;
    cerebrovascular: boolean;
    coronary: boolean;
    diabetes: boolean;
    emphysema: boolean;
    epilepsy: boolean;
    hepatitis: boolean; hepatitisSpec: string;
    hyperlipidemia: boolean;
    hypertension: boolean;
    pepticUlcer: boolean;
    pneumonia: boolean; pneumoniaHighestBP: string;
    thyroid: boolean;
    ptb: boolean; ptbCat: string;
    extraPtb: boolean; extraPtbCat: string;
    uti: boolean;
    mentalIllness: boolean;
    others: boolean; othersSpec: string;
    none: boolean;
  };
  familyHistory: {
    allergy: boolean; allergySpec: string;
    asthma: boolean;
    cancer: boolean; cancerSpec: string;
    cerebrovascular: boolean;
    coronary: boolean;
    diabetes: boolean;
    emphysema: boolean;
    epilepsy: boolean;
    hepatitis: boolean; hepatitisSpec: string;
    hyperlipidemia: boolean;
    hypertension: boolean;
    pepticUlcer: boolean;
    pneumonia: boolean; pneumoniaHighestBP: string;
    thyroid: boolean;
    ptb: boolean; ptbCat: string;
    extraPtb: boolean; extraPtbCat: string;
    uti: boolean;
    mentalIllness: boolean;
    others: boolean; othersSpec: string;
    none: boolean;
  };
  pastSurgical: Array<{ operation: string; date: string }>;
  personalSocial: {
    smoking: 'Yes' | 'No' | 'Quit'; smokingPacks: string;
    alcohol: 'Yes' | 'No' | 'Quit'; alcoholBottles: string;
    drugs: 'Yes' | 'No';
    sexScreening: 'Yes' | 'No';
  };
  immunizations: {
    children: string[]; // BCG, OPV1, OPV2, OPV3, DPT1, DPT2, DPT3, Measles, HepB1, HepB2, HepB3, HepA, Varicella, None
    adult: string[]; // HPV, MMR, None
    pregnant: string[]; // Tetanus, None
    elderly: string[]; // Pneumococcal, Flu, None
    othersSpecific: string;
  };
  familyPlanning: {
    accessCounselling: 'Yes' | 'No';
  };
  menstrualHistory: {
    menarcheAge: string;
    onsetSexAge: string;
    lastPeriodDate: string;
    birthControlMethod: string;
    durationDays: string;
    intervalDays: string;
    padsPerDay: string;
    menopause: 'Yes' | 'No';
    menopauseAge: string;
  };
  pregnancyHistory: {
    applicable: 'Yes' | 'No';
    gravidity: string;
    fullTerm: string;
    deliveryType: 'Normal' | 'C-Section' | 'None';
    parity: string;
    premature: string;
    abortion: string;
    livingChildren: string;
  };

  // Section C: Physical Examinations Findings (Image 3)
  physicalExams: {
    clientType: 'Member' | 'Dependent';
    caseNumber: string;
    phicNumber: string;
    memberCategory: string;
    lastName: string;
    firstName: string;
    middleName: string;
    extName: string;
    address: string;
    dob: string;
    sex: string;
    
    bloodPressure: string;
    heightCm: string;
    heartRate: string;
    weightKg: string;
    respRate: string;
    bmi: string;
    visualAcuity: string;
    temp: string;

    pediatricLength: string;
    pediatricHeadCirc: string;
    pediatricSkinfold: string;
    
    waist: string;
    hip: string;
    limbs: string;
    midArm: string;
    
    pediatricZScore: string;
    generalAwareAlert: 'Yes' | 'No';
    generalAlteredSensorium: 'Yes' | 'No';
    bloodType: 'A+' | 'B+' | 'AB+' | 'O+' | 'A-' | 'B-' | 'AB-' | 'O-' | 'None';
  };

  findingsPerSystem: {
    heent: string[]; // essentially normal, abnormal pupil, cervical lymph, dry mucus, icteric sclera, pale conj, sunken eye, sunken fontanelle, others
    heentOthers: string;
    chest: string[]; // essentially normal, asymmetrical chest, decreased breath, wheezes, lumps, crackles, retractions, others
    chestOthers: string;
    heart: string[]; // essentially normal, displaced apex, heaves, irregular, muffled, murmurs, pericardial, others
    heartOthers: string;
    abdomen: string[]; // essentially normal, rigidity, tenderness, hyperactive bowel, palpable mass, tympatinic, uterine, others
    abdomenOthers: string;
    genitourinary: string[]; // essentially normal, blood stained, cervical dilatation, abnormal discharge, others
    genitourinaryOthers: string;
    rectal: string[]; // essentially normal, prostate, mass, hemorrhoids, pus, n/a, others
    rectalOthers: string;
    skin: string[]; // essentially normal, clubbing, cold clammy, cyanosis, edema, decreased mobility, pale nailbed, poor turgor, rashes, weak pulse, others
    skinOthers: string;
    neurological: string[]; // essentially normal, abnormal gait, abnormal position, abnormal sensation, abnormal reflex, poor memory, poor tone, poor coord, others
    neurologicalOthers: string;
  };
}

const defaultConsultationDetails = (patientName = '', hhAddress = '', hhBarangay = ''): ConsultationDetails => {
  return {
    isConsultation: true,
    pmrfUpdating: {
      changeName: false,
      changeDOB: false,
      changeSex: false,
      changeCivilStatus: false,
      changePersonalInfo: false,
      fromValue: '',
      toValue: '',
      memberSignature: '',
      memberSignatureDate: new Date().toISOString().split('T')[0],
      memberThumbmark: '',
      receivedByFullName: '',
      receivedByBranch: '',
      receivedByDateTime: ''
    },
    pastMedical: {
      allergy: false, allergySpec: '',
      asthma: false,
      cancer: false, cancerSpec: '',
      cerebrovascular: false,
      coronary: false,
      diabetes: false,
      emphysema: false,
      epilepsy: false,
      hepatitis: false, hepatitisSpec: '',
      hyperlipidemia: false,
      hypertension: false,
      pepticUlcer: false,
      pneumonia: false, pneumoniaHighestBP: '',
      thyroid: false,
      ptb: false, ptbCat: '',
      extraPtb: false, extraPtbCat: '',
      uti: false,
      mentalIllness: false,
      others: false, othersSpec: '',
      none: true
    },
    familyHistory: {
      allergy: false, allergySpec: '',
      asthma: false,
      cancer: false, cancerSpec: '',
      cerebrovascular: false,
      coronary: false,
      diabetes: false,
      emphysema: false,
      epilepsy: false,
      hepatitis: false, hepatitisSpec: '',
      hyperlipidemia: false,
      hypertension: false,
      pepticUlcer: false,
      pneumonia: false, pneumoniaHighestBP: '',
      thyroid: false,
      ptb: false, ptbCat: '',
      extraPtb: false, extraPtbCat: '',
      uti: false,
      mentalIllness: false,
      others: false, othersSpec: '',
      none: true
    },
    pastSurgical: [
      { operation: '', date: '' },
      { operation: '', date: '' },
      { operation: '', date: '' }
    ],
    personalSocial: {
      smoking: 'No', smokingPacks: '',
      alcohol: 'No', alcoholBottles: '',
      drugs: 'No',
      sexScreening: 'No'
    },
    immunizations: {
      children: [],
      adult: [],
      pregnant: [],
      elderly: [],
      othersSpecific: ''
    },
    familyPlanning: {
      accessCounselling: 'No'
    },
    menstrualHistory: {
      menarcheAge: '',
      onsetSexAge: '',
      lastPeriodDate: '',
      birthControlMethod: '',
      durationDays: '',
      intervalDays: '',
      padsPerDay: '',
      menopause: 'No',
      menopauseAge: ''
    },
    pregnancyHistory: {
      applicable: 'No',
      gravidity: '',
      fullTerm: '',
      deliveryType: 'None',
      parity: '',
      premature: '',
      abortion: '',
      livingChildren: ''
    },
    physicalExams: {
      clientType: 'Member',
      caseNumber: '',
      phicNumber: '',
      memberCategory: '',
      lastName: patientName.split(',')[0]?.trim() || '',
      firstName: patientName.split(',')[1]?.trim() || patientName,
      middleName: '',
      extName: '',
      address: `${hhAddress}, ${hhBarangay}`.trim().replace(/^,\s*/, ''),
      dob: '',
      sex: 'Male',
      bloodPressure: '',
      heightCm: '',
      heartRate: '',
      weightKg: '',
      respRate: '',
      bmi: '',
      visualAcuity: '',
      temp: '',
      pediatricLength: '',
      pediatricHeadCirc: '',
      pediatricSkinfold: '',
      waist: '',
      hip: '',
      limbs: '',
      midArm: '',
      pediatricZScore: '',
      generalAwareAlert: 'Yes',
      generalAlteredSensorium: 'No',
      bloodType: 'None'
    },
    findingsPerSystem: {
      heent: ['Essentially Normal'], heentOthers: '',
      chest: ['Essentially Normal'], chestOthers: '',
      heart: ['Essentially Normal'], heartOthers: '',
      abdomen: ['Essentially Normal'], abdomenOthers: '',
      genitourinary: ['Essentially Normal'], genitourinaryOthers: '',
      rectal: ['Essentially Normal'], rectalOthers: '',
      skin: ['Essentially Normal'], skinOthers: '',
      neurological: ['Essentially Normal'], neurologicalOthers: ''
    }
  };
};

export default function Consultation({ currentUser }: ConsultationProps) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [citizens, setCitizens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mode controllers
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'detail' | 'print'>('list');
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [printFormType, setPrintFormType] = useState<'pmrf' | 'medical' | 'findings' | 'consultation' | 'prescription'>('pmrf');

  // QR Scanner hook states
  const [showScanner, setShowScanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // New Record Form state
  const [patientName, setPatientName] = useState('');
  const [selectedHHId, setSelectedHHId] = useState('');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [prescribedMeds, setPrescribedMeds] = useState('');
  const [consultDate, setConsultDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Tab within Add Form
  const [formStep, setFormStep] = useState<number>(0); // 0: Patient History, 1: System findings & exams
  
  // Questionnaire responses state
  const [consultDetails, setConsultDetails] = useState<ConsultationDetails>(defaultConsultationDetails());

  useEffect(() => {
    fetchRecords();
    fetchHouseholds();
    fetchCitizens();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/health-records');
      if (res.ok) {
        const data = await res.json();
        // Filter health records containing isConsultation flag inside the notes JSON
        setRecords(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
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
        setHouseholds(data.filter((h: any) => h.approvalStatus === 'Approved'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCitizens = async () => {
    try {
      const res = await fetch('/api/masterlist');
      if (res.ok) {
        const data = await res.json();
        setCitizens(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch patient medical history matching selected patient
  const getPatientHistory = (name: string) => {
    if (!name) return [];
    return records.filter(r => r.patientName.toLowerCase() === name.toLowerCase())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (showScanner) {
      try {
        scanner = new Html5QrcodeScanner(
          "qr-reader-container",
          { fps: 10, qrbox: { width: 220, height: 220 } },
          /* verbose= */ false
        );
        scanner.render(
          (decodedText) => handleScanSuccess(decodedText),
          (err) => {
            // Silence frame miss log spam in sandbox console
            console.debug("Searching for QR frame...", err);
          }
        );
      } catch (err: any) {
        console.error("Camera scanner instantiation error:", err);
        setErrorMessage("Webcam integration is blocked or unsupported in this preview session.");
      }
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(e => console.warn("Failed clearing html5-qrcode scanner:", e));
      }
    };
  }, [showScanner]);

  const handleScanSuccess = (decodedText: string, exactCitizen?: any) => {
    // Attempt audio tone beep feedback for success
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1300, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.debug("Audio scan beep skipped:", e);
    }

    try {
      let matched = exactCitizen;
      if (!matched) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(decodedText);
        } catch (e) {}

        if (parsed && parsed.fullName) {
          matched = citizens.find(c => c.fullName.toLowerCase() === parsed.fullName.toLowerCase());
        }

        if (!matched) {
          const pinMatch = decodedText.match(/\d{12}/);
          if (pinMatch) {
            const scanPin = pinMatch[0];
            matched = citizens.find(c => 
              (c.pmrfDetails?.pin === scanPin) || 
              (c.pmrfDetails?.phicNumber === scanPin)
            );
          }
        }

        if (!matched) {
          matched = citizens.find(c => 
            c.fullName && (
              decodedText.toLowerCase().includes(c.fullName.toLowerCase()) || 
              c.fullName.toLowerCase().includes(decodedText.toLowerCase())
            )
          );
        }
      }

      if (matched) {
        handleSelectPatient(matched);
        if (matched.pmrfDetails?.pin) {
          setConsultDetails(prev => ({
            ...prev,
            physicalExams: {
              ...prev.physicalExams,
              phicNumber: matched.pmrfDetails.pin
            }
          }));
        }
        setShowScanner(false);
      } else {
        alert(`Decoded value: "${decodedText}". We found no matches for any citizen with this PhilHealth ID in the clinic list.`);
      }
    } catch (err) {
      console.error(err);
      alert("Error processing scanner decoded result.");
    }
  };

  // When patient is selected, fill default details
  const handleSelectPatient = (citizen: any) => {
    const matchedHH = households.find(h => h.barangay === citizen.barangay && h.householdHead === (citizen.householdHead || citizen.fullName));
    const hhId = matchedHH?.id || households[0]?.id || '';
    const hhAddr = matchedHH?.completeAddress || citizen.address || '';
    const hhBar = matchedHH?.barangay || citizen.barangay || '';
    
    setPatientName(citizen.fullName);
    setSelectedHHId(hhId);
    
    // Setup detailed clinical fields
    const updatedDetails = defaultConsultationDetails(citizen.fullName, hhAddr, hhBar);
    
    // Guess DOB and Gender
    if (citizen.age) {
      const birthYear = new Date().getFullYear() - citizen.age;
      updatedDetails.physicalExams.dob = `${birthYear}-01-01`;
    }
    if (citizen.gender) {
      updatedDetails.physicalExams.sex = citizen.gender;
    }
    
    setConsultDetails(updatedDetails);
  };

  // Add customized logic to save a clean health diagnostic & consultation record
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !selectedHHId || !primaryDiagnosis) {
      alert('Please select a patient, a primary household reference, and input a formal Diagnosis.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Serialize the clinical structures into "notes"
      const serializedNotes = JSON.stringify({
        isConsultation: true,
        consultationData: consultDetails
      });

      const res = await fetch('/api/health-records/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          patientName,
          householdId: selectedHHId,
          diagnosis: primaryDiagnosis,
          treatment: treatmentPlan,
          medications: prescribedMeds,
          notes: serializedNotes,
          date: consultDate
        })
      });

      if (res.ok) {
        setViewMode('list');
        // Reset states
        setPatientName('');
        setSelectedHHId('');
        setPrimaryDiagnosis('');
        setTreatmentPlan('');
        setPrescribedMeds('');
        setConsultDate(new Date().toISOString().split('T')[0]);
        setConsultDetails(defaultConsultationDetails());
        setFormStep(0);
        fetchRecords();
      } else {
        const errData = await res.json();
        alert(`Failed to save record: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving the consultation record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDetails = (record: HealthRecord): ConsultationDetails | null => {
    if (!record.notes) return null;
    try {
      const parsed = JSON.parse(record.notes);
      if (parsed.isConsultation) {
        return parsed.consultationData as ConsultationDetails;
      }
    } catch (e) {}
    return null;
  };

  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  const filtered = records.filter(r => {
    const isConsult = r.notes?.includes('"isConsultation":true');
    const pName = r.patientName || '';
    const diag = r.diagnosis || '';
    const bar = r.barangay || '';
    const query = (deferredSearchTerm || '').toLowerCase();
    const matchesSearch = pName.toLowerCase().includes(query) ||
                          diag.toLowerCase().includes(query) ||
                          bar.toLowerCase().includes(query);
    return isConsult && matchesSearch;
  });

  // Printing trigger
  const handlePrint = (type: 'pmrf' | 'medical' | 'findings' | 'consultation' | 'prescription') => {
    setPrintFormType(type);
    setViewMode('print');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Helper toggle functions for checkboxes
  const togglePastMedical = (field: keyof typeof consultDetails.pastMedical) => {
    setConsultDetails(prev => ({
      ...prev,
      pastMedical: {
        ...prev.pastMedical,
        [field]: !prev.pastMedical[field],
        // If selecting none, uncheck others. If selecting others, uncheck none
        none: field === 'none' ? !prev.pastMedical.none : false
      }
    }));
  };

  const toggleFamilyHistory = (field: keyof typeof consultDetails.familyHistory) => {
    setConsultDetails(prev => ({
      ...prev,
      familyHistory: {
        ...prev.familyHistory,
        [field]: !prev.familyHistory[field],
        none: field === 'none' ? !prev.familyHistory.none : false
      }
    }));
  };

  const toggleFindingList = (system: keyof typeof consultDetails.findingsPerSystem, item: string) => {
    setConsultDetails(prev => {
      const current = prev.findingsPerSystem[system];
      let updated: string[];
      if (item === 'Essentially Normal') {
        updated = ['Essentially Normal'];
      } else {
        const filteredNormal = current.filter(i => i !== 'Essentially Normal');
        if (filteredNormal.includes(item)) {
          updated = filteredNormal.filter(i => i !== item);
          if (updated.length === 0) updated = ['Essentially Normal'];
        } else {
          updated = [...filteredNormal, item];
        }
      }
      return {
        ...prev,
        findingsPerSystem: {
          ...prev.findingsPerSystem,
          [system]: updated
        }
      };
    });
  };

  const toggleImmList = (category: 'children' | 'adult' | 'pregnant' | 'elderly', item: string) => {
    setConsultDetails(prev => {
      let list = [...prev.immunizations[category]];
      if (item === 'None') {
        if (list.includes('None')) {
          list = [];
        } else {
          list = ['None'];
        }
      } else {
        list = list.filter(x => x !== 'None');
        if (list.includes(item)) {
          list = list.filter(x => x !== item);
        } else {
          list.push(item);
        }
      }
      return {
        ...prev,
        immunizations: {
          ...prev.immunizations,
          [category]: list
        }
      };
    });
  };

  const getBtnClass = (isSelected: boolean) => 
    isSelected 
      ? 'px-3 py-1.5 rounded-xl border text-[10px] font-bold bg-emerald-600 text-white border-emerald-600 transition'
      : 'px-3 py-1.5 rounded-xl border text-[10px] font-bold bg-white text-slate-700 border-slate-200 hover:text-emerald-600 hover:border-emerald-500 transition-all';

  if (viewMode === 'print' && selectedRecord) {
    const detail = getDetails(selectedRecord);
    if (!detail) return <div>Invalid Record details.</div>;

    return (
      <div id="printable-form-area" className="bg-white text-slate-900 p-2 min-h-screen font-serif text-[10px] uppercase leading-none print-container">
        
        {/* Print Back controller button - hidden during real layout print */}
        <div className="print:hidden fixed top-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg border border-slate-700 font-sans font-bold text-xs flex gap-2 z-50">
          <button onClick={() => setViewMode('detail')} className="hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to View Details
          </button>
          <span className="text-slate-500">|</span>
          <button onClick={() => window.print()} className="hover:underline flex items-center gap-1 text-emerald-400">
            <Printer className="h-3 w-3" /> Execute Printer
          </button>
        </div>

        {/* =========================================================================
            IMAGE 1: PMRF BACK - UPDATING/AMENDMENT
            ========================================================================= */}
        {printFormType === 'pmrf' && (
          <div className="border-[2px] border-black p-2 max-w-[800px] mx-auto space-y-4 print-page">
            <div className="bg-slate-200 border-b-2 border-black p-1 text-center font-extrabold text-sm tracking-widest text-black">
              V. UPDATING/AMENDMENT
            </div>
            
            <table className="w-full border-collapse border-b border-black text-[9px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-black p-1.5 w-1/3 text-left">PLEASE CHECK:</th>
                  <th className="border border-black p-1.5 text-center">FROM</th>
                  <th className="border border-black p-1.5 text-center">TO</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1.5 flex items-start gap-1">
                    <span className="font-bold border border-black px-1 mr-1">{detail.pmrfUpdating.changeName ? 'X' : ' '}</span>
                    <div>
                      <strong>CHANGE/CORRECTION OF NAME</strong>
                      <p className="text-[7.5px] lowercase text-slate-550 leading-tight">(Last Name, First Name, Name Extension (Jr./Sr./III) Middle Name)</p>
                    </div>
                  </td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeName ? detail.pmrfUpdating.fromValue : 'N/A'}</td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeName ? detail.pmrfUpdating.toValue : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">
                    <span className="font-bold border border-black px-1 mr-2">{detail.pmrfUpdating.changeDOB ? 'X' : ' '}</span>
                    <strong>CORRECTION OF DATE OF BIRTH</strong>
                  </td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeDOB ? detail.pmrfUpdating.fromValue : 'N/A'}</td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeDOB ? detail.pmrfUpdating.toValue : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">
                    <span className="font-bold border border-black px-1 mr-2">{detail.pmrfUpdating.changeSex ? 'X' : ' '}</span>
                    <strong>CORRECTION OF SEX</strong>
                  </td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeSex ? detail.pmrfUpdating.fromValue : 'N/A'}</td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeSex ? detail.pmrfUpdating.toValue : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">
                    <span className="font-bold border border-black px-1 mr-2">{detail.pmrfUpdating.changeCivilStatus ? 'X' : ' '}</span>
                    <strong>CHANGE OF CIVIL STATUS</strong>
                  </td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeCivilStatus ? detail.pmrfUpdating.fromValue : 'N/A'}</td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changeCivilStatus ? detail.pmrfUpdating.toValue : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">
                    <span className="font-bold border border-black px-1 mr-2">{detail.pmrfUpdating.changePersonalInfo ? 'X' : ' '}</span>
                    <strong>UPDATING OF PERSONAL INFO/ADDRESS/PHONE/EMAIL</strong>
                  </td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changePersonalInfo ? detail.pmrfUpdating.fromValue : 'N/A'}</td>
                  <td className="border border-black p-1.5 align-middle font-mono">{detail.pmrfUpdating.changePersonalInfo ? detail.pmrfUpdating.toValue : 'N/A'}</td>
                </tr>
              </tbody>
            </table>

            {/* Bottom attest and Signature container */}
            <div className="grid grid-cols-3 border-2 border-black divide-x divide-black text-[8.5px] tracking-normal leading-normal">
              <div className="col-span-2 p-2 space-y-2">
                <p className="text-[8px] leading-tight text-justify">
                  Under penalty of law, I hereby attest that the information provided, including the documents I have attached to this form, are true and accurate to the best of my knowledge. I agree and authorize PhilHealth for the subsequent validation, verification and for other data sharing purposes only under the following circumstances:
                </p>
                <p className="text-[7.5px] leading-tight text-slate-700 text-justify">
                  • As necessary for the proper execution of processes related to the legitimate and declared purpose;<br/>
                  • The use or disclosure is reasonably necessary, required or authorized by or under the law; and,<br/>
                  • Adequate security measures are employed to protect my information.
                </p>
                <div className="pt-4 flex items-end justify-between gap-2">
                  <div className="text-center w-2/3">
                    {detail.pmrfUpdating.memberSignature ? (
                      <img src={detail.pmrfUpdating.memberSignature} className="h-8 max-w-[200px] object-contain mx-auto border-b border-black" alt="Signature" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-8 border-b border-black"></div>
                    )}
                    <span className="text-[7px] font-bold block pt-1">MEMBER'S SIGNATURE OVER PRINTED NAME</span>
                  </div>
                  <div className="text-center w-1/3">
                    <div className="h-8 border-b border-black font-mono flex items-end justify-center text-xs">{detail.pmrfUpdating.memberSignatureDate}</div>
                    <span className="text-[7.5px] font-bold block pt-1">DATE</span>
                  </div>
                  <div className="border border-black h-14 w-12 flex flex-col items-center justify-center relative shrink-0 p-1 text-center">
                    {detail.pmrfUpdating.memberThumbmark ? (
                      <img src={detail.pmrfUpdating.memberThumbmark} className="h-full w-full object-cover" alt="Thumbmark" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[5.5px] leading-none text-slate-400">RIGHT THUMBMARK</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-1 bg-slate-50/50">
                <strong className="block text-center font-bold text-[9px] border-b border-black pb-1">FOR PHILHEALTH USE ONLY</strong>
                <p className="font-extrabold pt-1">RECEIVED BY:</p>
                <div className="pt-1">
                  <span className="text-[7.5px] text-slate-500">FULL NAME:</span>
                  <div className="border-b border-black font-mono py-0.5 text-[10px]">{detail.pmrfUpdating.receivedByFullName || currentUser.fullName}</div>
                </div>
                <div className="pt-1">
                  <span className="text-[7.5px] text-slate-500">PRO/LHIO/BRANCH:</span>
                  <div className="border-b border-black font-mono py-0.5 text-[10px]">{detail.pmrfUpdating.receivedByBranch || 'PAGADIAN BRANCH'}</div>
                </div>
                <div className="pt-1">
                  <span className="text-[7.5px] text-slate-500">DATE & TIME:</span>
                  <div className="border-b border-black font-mono py-0.5 text-[10px]">{detail.pmrfUpdating.receivedByDateTime || new Date().toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* INSTRUCTIONS SEC (PMRF Page 1 Instructions matching scan) */}
            <div className="border border-black p-2 leading-tight uppercase font-sans text-[7.5px] space-y-1">
              <strong className="block text-center text-[10px] underline tracking-widest font-extrabold">INSTRUCTIONS</strong>
              <p>1. All information should be written in UPPER CASE/CAPITAL LETTERS. If the information is not applicable, write "N/A."</p>
              <p>2. All fields are mandatory unless indicated as optional. By affixing your signature, you certify the truthfulness and accuracy of all information provided.</p>
              <p>3. A properly accomplished PMRF shall be accompanied by a valid proof of identity for first time registrants, and supporting documents to establish relationship between member and dependent/s for updating or request for amendment.</p>
              <p>4. On the PURPOSE, check the appropriate box if for Registration or for Updating/Amendment of information.</p>
              <p>5. Indicate preferred KonSulta provider near the place of work or residence.</p>
              <p>6. For PERSONAL DETAILS, all name entries should follow the format given below:</p>
              <div className="grid grid-cols-4 text-center font-bold border border-slate-300 p-1 my-1 bg-slate-100 text-[7px]">
                <div>
                  <p>LAST NAME</p>
                  <p className="text-blue-700">{detail.physicalExams.lastName || 'SANTOS'}</p>
                </div>
                <div>
                  <p>FIRST NAME</p>
                  <p className="text-blue-700">{detail.physicalExams.firstName || 'JUAN ANDRES'}</p>
                </div>
                <div>
                  <p>NAME EXTENSION</p>
                  <p className="text-blue-700">{detail.physicalExams.extName || 'III'}</p>
                </div>
                <div>
                  <p>MIDDLE NAME</p>
                  <p className="text-blue-700">{detail.physicalExams.middleName || 'DELA CRUZ'}</p>
                </div>
              </div>
              <p>7. Indicate registrant's/member's name as it appears in the birth certificate.</p>
              <p>8. The full mother's maiden name of registrant/member must be indicated as it appears in the birth certificate.</p>
              <p>9. Indicate the full name of spouse if registrant/member is married.</p>
              <p>10. Indicate the complete permanent and mailing addresses and contact numbers.</p>
              <p>11. For updating/amendment, check the appropriate box to be updated/amended and indicate the correct data.</p>
              <p>12. For MEMBER TYPE, check the appropriate box which best describes your current membership status.</p>
              <p>13. For Direct Contributors, except employed, sea-based migrant workers and lifetime members, indicate the profession, monthly income and proof of Income to be submitted.</p>
              <p>14. For Self-earning individuals, Kasambahays and Family Drivers, indicate the actual monthly income in the space provided.</p>
              <p>15. In declaring dependents, provide the full name of the living spouse, children below 21 years old, and parents who are 60 years old and above totally dependent to the member.</p>
              <p>16. Dependents with disability shall be registered as principal members in accordance with Republic Act 11228 on mandatory PhilHealth coverage for all persons with disability (PWD).</p>
              <p>17. The registrant must affix his/her signature over printed name (or right thumbmark if unable to write) and indicate the date when the PMRF was signed.</p>
            </div>
          </div>
        )}

        {/* =========================================================================
            IMAGE 2: DETAILED PAST MEDICAL / FAMILY & SURVEY QUESTIONS
            ========================================================================= */}
        {printFormType === 'medical' && (
          <div className="border-[2px] border-black p-3 max-w-[850px] mx-auto space-y-4 print-page">
            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-3">
              {/* PAST MEDICAL */}
              <div className="border border-black p-2 space-y-1">
                <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px] tracking-wide">PAST MEDICAL HISTORY</div>
                <div className="grid grid-cols-12 gap-0.5 text-[7px] font-semibold leading-relaxed">
                  {Object.keys(detail.pastMedical).filter(k => typeof (detail.pastMedical as any)[k] === 'boolean' && k !== 'none').map(key => (
                    <React.Fragment key={key}>
                      <span className="col-span-1 border border-black font-extrabold text-center pb-0.5">{(detail.pastMedical as any)[key] ? 'X' : ' '}</span>
                      <span className="col-span-4 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="col-span-7 border-b border-slate-350 font-mono text-[6.5px]">
                        {key === 'allergy' && detail.pastMedical.allergySpec}
                        {key === 'cancer' && detail.pastMedical.cancerSpec}
                        {key === 'hepatitis' && detail.pastMedical.hepatitisSpec}
                        {key === 'pneumonia' && detail.pastMedical.pneumoniaHighestBP}
                        {key === 'ptb' && detail.pastMedical.ptbCat}
                        {key === 'extraPtb' && detail.pastMedical.extraPtbCat}
                        {key === 'others' && detail.pastMedical.othersSpec}
                      </span>
                    </React.Fragment>
                  ))}
                  <span className="col-span-1 border border-black font-extrabold text-center">{(detail.pastMedical.none) ? 'X' : ' '}</span>
                  <span className="col-span-11 capitalize font-bold">None (No significant past medical illness history flags)</span>
                </div>
              </div>

              {/* FAMILY HISTORY */}
              <div className="border border-black p-2 space-y-1">
                <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px] tracking-wide">FAMILY HISTORY</div>
                <div className="grid grid-cols-12 gap-0.5 text-[7px] font-semibold leading-relaxed">
                  {Object.keys(detail.familyHistory).filter(k => typeof (detail.familyHistory as any)[k] === 'boolean' && k !== 'none').map(key => (
                    <React.Fragment key={key}>
                      <span className="col-span-1 border border-black font-extrabold text-center pb-0.5">{(detail.familyHistory as any)[key] ? 'X' : ' '}</span>
                      <span className="col-span-4 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="col-span-7 border-b border-slate-350 font-mono text-[6.5px]">
                        {key === 'allergy' && detail.familyHistory.allergySpec}
                        {key === 'cancer' && detail.familyHistory.cancerSpec}
                        {key === 'hepatitis' && detail.familyHistory.hepatitisSpec}
                        {key === 'pneumonia' && detail.familyHistory.pneumoniaHighestBP}
                        {key === 'ptb' && detail.familyHistory.ptbCat}
                        {key === 'extraPtb' && detail.familyHistory.extraPtbCat}
                        {key === 'others' && detail.familyHistory.othersSpec}
                      </span>
                    </React.Fragment>
                  ))}
                  <span className="col-span-1 border border-black font-extrabold text-center">{(detail.familyHistory.none) ? 'X' : ' '}</span>
                  <span className="col-span-11 capitalize font-bold">None (No significant family medical history flags)</span>
                </div>
              </div>
            </div>

            {/* Past Surgical and Personal Social */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-black p-2 space-y-1.5">
                <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px]">PAST SURGICAL HISTORY</div>
                <table className="w-full border-collapse border border-black text-[7.5px]">
                  <thead>
                    <tr className="bg-slate-50 font-bold border-b border-black">
                      <th className="border-r border-black p-1 text-left w-2/3">OPERATION / SURGICAL PROCEDURE</th>
                      <th className="p-1 text-center">DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.pastSurgical.map((s, idx) => (
                      <tr key={idx} className="border-b border-black last:border-0 h-5">
                        <td className="border-r border-black p-1 font-mono">{s.operation || 'N/A'}</td>
                        <td className="p-1 text-center font-mono">{s.date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border border-black p-2 space-y-1 text-[8px] leading-relaxed">
                <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px] mb-1">PERSONAL/SOCIAL HISTORY</div>
                <div className="space-y-1 text-[7.5px]">
                  <p><strong>SMOKING:</strong> <span className="border border-black px-1.5 font-extrabold">{detail.personalSocial.smoking === 'Yes' ? 'X' : ' '} YES</span> <span className="border border-black px-1.5 font-extrabold ml-1">{detail.personalSocial.smoking === 'No' ? 'X' : ' '} NO</span> <span className="border border-black px-1.5 font-extrabold ml-1">{detail.personalSocial.smoking === 'Quit' ? 'X' : ' '} QUIT</span>  <span className="border-b border-black font-mono ml-1 px-1">{detail.personalSocial.smokingPacks || '0'} Packs/Yr</span></p>
                  <p><strong>ALCOHOL:</strong> <span className="border border-black px-1.5 font-extrabold">{detail.personalSocial.alcohol === 'Yes' ? 'X' : ' '} YES</span> <span className="border border-black px-1.5 font-extrabold ml-1">{detail.personalSocial.alcohol === 'No' ? 'X' : ' '} NO</span> <span className="border border-black px-1.5 font-extrabold ml-1">{detail.personalSocial.alcohol === 'Quit' ? 'X' : ' '} QUIT</span>  <span className="border-b border-black font-mono ml-1 px-1">{detail.personalSocial.alcoholBottles || '0'} Bottles/Day</span></p>
                  <p><strong>ILLICIT DRUG DRUGS:</strong> <span className="border border-black px-1.5 font-extrabold">{detail.personalSocial.drugs === 'Yes' ? 'X' : ' '} YES</span> <span className="border border-black px-1.5 font-extrabold ml-1">{detail.personalSocial.drugs === 'No' ? 'X' : ' '} NO</span></p>
                  <p><strong>SEXUALLY ACTIVE / HISTORY SCREENING:</strong> <span className="border border-black px-1.5 font-extrabold">{detail.personalSocial.sexScreening === 'Yes' ? 'X' : ' '} YES</span> <span className="border border-black px-1.5 font-extrabold ml-1">{detail.personalSocial.sexScreening === 'No' ? 'X' : ' '} NO</span></p>
                </div>
              </div>
            </div>

            {/* IMMUNIZATION SECTION */}
            <div className="border border-black p-2 space-y-1.5">
              <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px]">IMMUNIZATION LOG RECORD DETAILS</div>
              <div className="grid grid-cols-4 gap-2 text-[7px] leading-relaxed uppercase">
                <div className="border-r border-slate-250 pr-1">
                  <strong>FOR CHILDREN:</strong>
                  {['BCG', 'OPV1', 'OPV2', 'OPV3', 'DPT1', 'DPT2', 'DPT3', 'Measles', 'Hepatitis B1', 'Hepatitis B2', 'Hepatitis B3', 'Hepatitis A', 'Varicella'].map(imm => (
                    <div key={imm} className="flex items-center gap-1">
                      <span className="border border-black px-1 scale-75 font-extrabold">{detail.immunizations.children.includes(imm) ? 'X' : ' '}</span>
                      <span>{imm}</span>
                    </div>
                  ))}
                </div>
                <div className="border-r border-slate-250 pr-1">
                  <strong>FOR ADULT:</strong>
                  {['HPV', 'MMR', 'None'].map(imm => (
                    <div key={imm} className="flex items-center gap-1">
                      <span className="border border-black px-1 scale-75 font-extrabold">{detail.immunizations.adult.includes(imm) ? 'X' : ' '}</span>
                      <span>{imm}</span>
                    </div>
                  ))}
                </div>
                <div className="border-r border-slate-250 pr-1 col-span-2">
                  <strong>FOR PREGNANT & IMMUNOCOMPROMISED:</strong>
                  {['Tetanus Toxoid', 'Pneumococcal Vaccine', 'Flu Vaccine'].map(imm => (
                    <div key={imm} className="flex items-center gap-1">
                      <span className="border border-black px-1 scale-75 font-extrabold">{(detail.immunizations.pregnant.includes(imm) || detail.immunizations.elderly.includes(imm)) ? 'X' : ' '}</span>
                      <span>{imm}</span>
                    </div>
                  ))}
                  <div className="mt-2">
                    <strong>OTHERS, PLEASE SPECIFY:</strong>
                    <div className="border-b border-black font-mono mt-1 text-[8px] h-4 leading-normal">{detail.immunizations.othersSpecific || 'None'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Family Planning, Menarche & Pregnancy */}
            <div className="border border-black p-2 space-y-2 text-[7.5px] leading-normal uppercase">
              <div className="grid grid-cols-2 divide-x divide-black">
                <div className="pr-2 space-y-2">
                  <div className="bg-slate-200 p-0.5 text-center font-bold text-[8.5px] border-b border-black mb-1">FAMILY PLANNING & MENSTRUAL HISTORY</div>
                  <p><strong>Counselling Access?</strong> <span className="border border-black px-1.5 font-bold">{detail.familyPlanning.accessCounselling === 'Yes' ? 'X' : ' '} YES</span> <span className="border border-black px-1.5 font-bold ml-1">{detail.familyPlanning.accessCounselling === 'No' ? 'X' : ' '} NO</span></p>
                  <p><strong>MENARCHE AGE:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.menarcheAge || 'N/A'}</span> Yrs Old | <strong>SEX ONSET AGE:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.onsetSexAge || 'N/A'}</span> Yrs Old</p>
                  <p><strong>LAST LMP DATE:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.lastPeriodDate || '—'}</span> | <strong>BIRTH CONTROL METHOD:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.birthControlMethod || 'None'}</span></p>
                  <p><strong>DURATION:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.durationDays || '0'}</span> Days | <strong>INTERVAL CYCLE:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.intervalDays || '0'}</span> Days</p>
                  <p><strong>PADS / DAY:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.padsPerDay || '0'}</span> | <strong>MENOPAUSE:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.menstrualHistory.menopause === 'Yes' ? detail.menstrualHistory.menopauseAge + ' yrs old' : 'No'}</span></p>
                </div>
                <div className="pl-2 space-y-2">
                  <div className="bg-slate-200 p-0.5 text-center font-bold text-[8.5px] border-b border-black mb-1">PREGNANCY HISTORY</div>
                  <p><strong>APPLICABLE?</strong> <span className="border border-black px-1.5 font-bold">{detail.pregnancyHistory.applicable === 'Yes' ? 'X' : ' '} APPLICABLE</span> <span className="border border-black px-1.5 font-bold ml-1">{detail.pregnancyHistory.applicable === 'No' ? 'X' : ' '} NOT APPLICABLE</span></p>
                  <p><strong>GRAVIDITY (PREGNANCIES):</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.pregnancyHistory.gravidity || '0'}</span> | <strong>FULL TERM:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.pregnancyHistory.fullTerm || '0'}</span></p>
                  <p><strong>DELIVERY TYPE:</strong> <span className="border border-black px-1.5 font-bold">{detail.pregnancyHistory.deliveryType === 'Normal' ? 'X' : ' '} NORMAL</span> <span className="border border-black px-1.5 font-bold ml-1">{detail.pregnancyHistory.deliveryType === 'C-Section' ? 'X' : ' '} C-SECTION</span></p>
                  <p><strong>PARITY:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.pregnancyHistory.parity || '0'}</span> | <strong>PREMATURE:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.pregnancyHistory.premature || '0'}</span> | <strong>ABORTION:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.pregnancyHistory.abortion || '0'}</span> | <strong>LIVING CHILDREN:</strong> <span className="border-b border-black px-2 font-mono mx-1">{detail.pregnancyHistory.livingChildren || '0'}</span></p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            IMAGE 3: PHYSICAL EXAMINATIONS & PERTINENT SYSTEM FINDINGS
            ========================================================================= */}
        {printFormType === 'findings' && (
          <div className="border-[2px] border-black p-3 max-w-[850px] mx-auto space-y-4 print-page">
            
            {/* Header Demographic block */}
            <div className="border border-black p-2 space-y-1.5 text-[8px] uppercase leading-none">
              <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-350">
                <span className="font-extrabold text-[10px] tracking-widest text-black">CLINICAL EXAMS & PHYSICAL FINDINGS</span>
                <span>DATE: <strong className="font-mono">{selectedRecord.date}</strong></span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <strong>CLIENT TYPE:</strong>
                  <span className="block pt-1"><span className="border border-black px-1 text-xs">{detail.physicalExams.clientType === 'Member' ? 'X' : ' '}</span> MEMBER</span>
                  <span className="block pt-1"><span className="border border-black px-1 text-xs">{detail.physicalExams.clientType === 'Dependent' ? 'X' : ' '}</span> DEPENDENT</span>
                </div>
                <div>
                  <strong>CASE NUMBER:</strong>
                  <div className="border-b border-black font-mono pt-1 text-[9px]">{detail.physicalExams.caseNumber || 'N/A'}</div>
                </div>
                <div>
                  <strong>PHIC NUMBER:</strong>
                  <div className="border-b border-black font-mono pt-1 text-[9px]">{detail.physicalExams.phicNumber || 'N/A'}</div>
                </div>
                <div>
                  <strong>MEMBER CATEGORY:</strong>
                  <div className="border-b border-black font-mono pt-1 text-[9px]">{detail.physicalExams.memberCategory || 'N/A'}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100">
                <div className="col-span-2">
                  <strong>PATIENT NAME / LAST, FIRST, MIDDLE, EXT:</strong>
                  <div className="border-b border-black font-mono pt-1 text-[9px]">{selectedRecord.patientName} {detail.physicalExams.extName || ''}</div>
                </div>
                <div>
                  <strong>D.O.B.:</strong>
                  <div className="border-b border-black font-mono pt-1 text-[9px]">{detail.physicalExams.dob || '—'}</div>
                </div>
                <div>
                  <strong>SEX:</strong>
                  <div className="border-b border-black font-mono pt-1 text-[9px]">{detail.physicalExams.sex}</div>
                </div>
              </div>
              <div>
                <strong>COMPLETE ADDRESS:</strong>
                <div className="border-b border-black font-mono pt-1 text-[9px]">{detail.physicalExams.address || selectedRecord.barangay}</div>
              </div>
            </div>

            {/* Vitals stats and Pediatrics */}
            <div className="grid grid-cols-2 gap-4">
              {/* Pertinent Physical Findings */}
              <div className="border border-black p-2 space-y-1.5 text-[8.5px]">
                <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px]">PERTINENT PHYSICAL MEDICAL FINDINGS</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">BLOOD PRESSURE:</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.bloodPressure || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">HEIGHT (CM/IN):</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.heightCm || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">HEART RATE (BPM):</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.heartRate || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">WEIGHT (KG/LB):</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.weightKg || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">RESPIRATORY RATE:</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.respRate || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">B.M.I. RATIO:</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.bmi || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">VISUAL ACUITY:</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.visualAcuity || '—'}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">BODY TEMP (°C):</span>
                    <span className="border-b border-black w-20 text-center font-mono">{detail.physicalExams.temp || '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <strong>PEDIATRIC (0-24 MONTHS):</strong>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[7.5px]">
                    <div>LENGTH: {detail.physicalExams.pediatricLength || '—'}</div>
                    <div>HEAD CIRC: {detail.physicalExams.pediatricHeadCirc || '—'}</div>
                    <div>SKINFOLD: {detail.physicalExams.pediatricSkinfold || '—'}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <strong>BODY CIRCUMFERENCES (CM):</strong>
                  <div className="grid grid-cols-4 gap-1 font-mono text-[7.5px]">
                    <div>WAIST: {detail.physicalExams.waist || '—'}</div>
                    <div>HIP: {detail.physicalExams.hip || '—'}</div>
                    <div>LIMBS: {detail.physicalExams.limbs || '—'}</div>
                    <div>MID-ARM: {detail.physicalExams.midArm || '—'}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[7.5px]">
                  <div><strong>PEDIATRIC Z-SCORE:</strong> <span className="font-mono">{detail.physicalExams.pediatricZScore || '—'}</span></div>
                  <div><strong>BLOOD TYPE:</strong> <span className="font-extrabold border border-black px-1 font-mono ml-1">{detail.physicalExams.bloodType}</span></div>
                </div>
              </div>

              {/* General Survey */}
              <div className="border border-black p-2 space-y-2 text-[8px]">
                <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px]">CLINICAL SURVEY GENERAL STATUS</div>
                <div>
                  <p className="font-bold">AWARE AND ALERT SURGICAL STATUS:</p>
                  <p className="pt-1"><span className="border border-black px-1">{detail.physicalExams.generalAwareAlert === 'Yes' ? 'X' : ' '}</span> YES <span className="border border-black px-1 ml-2">{detail.physicalExams.generalAwareAlert === 'No' ? 'X' : ' '}</span> NO</p>
                </div>
                <div>
                  <p className="font-bold">ALTERED SENSORIUM / DELIRIUM:</p>
                  <p className="pt-1"><span className="border border-black px-1">{detail.physicalExams.generalAlteredSensorium === 'Yes' ? 'X' : ' '}</span> YES <span className="border border-black px-1 ml-2">{detail.physicalExams.generalAlteredSensorium === 'No' ? 'X' : ' '}</span> NO</p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="font-bold text-[8.5px] text-blue-800">PRIMARY EXAMINER DIAGNOSIS:</p>
                  <p className="font-mono text-[9.5px] normal-case border-b border-black pb-1 leading-normal pt-1">{selectedRecord.diagnosis}</p>
                </div>
                <div className="pt-1">
                  <p className="font-bold text-[8.5px] text-emerald-800">TREATMENT RECONSTRUCTIVE PLAN & THERAPY:</p>
                  <p className="font-mono text-[9px] normal-case border-b border-black pb-1 leading-normal pt-1">{selectedRecord.treatment || 'See clinical diagnostic notes'}</p>
                </div>
              </div>
            </div>

            {/* Pertinent Findings per System */}
            <div className="border border-black p-2 text-[7px] leading-relaxed select-none">
              <div className="bg-slate-200 p-1 text-center font-bold border-b border-black text-[9px] mb-2 tracking-wide">PERTINENT FINDINGS PER CLINICAL SYSTEM</div>
              <div className="grid grid-cols-2 gap-4">
                {/* HEENT & CHEST */}
                <div className="space-y-1.5 pr-2 border-r border-slate-250">
                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">A. HEENT (HEAD, EYE, EAR, NOSE, THROAT)</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Abnormally pupillary reaction', 'Cervical Lymphadenopathy', 'Dry mucous membrane', 'Icteric sclera', 'Pale conjunctivae', 'Sunken eyeballs', 'Sunken fontanelle'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.heent.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">B. CHEST / BREAST / LUNGS</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Asymmetrical chest expansion', 'Decreased breath sound', 'Wheezes', 'Lumps over breast (s)', 'Crackles/rales', 'Retractions'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.chest.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">C. HEART</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Displaced Apex beat', 'Heaves/thrills', 'Irregular rhythm', 'Muffled heart sounds', 'Murmurs', 'Pericardial bilge'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.heart.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">D. ABDOMEN</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Abdominal rigidity', 'Abdominal tenderness', 'Hyperactive bowel sounds', 'Palpable mass(es)', 'Tympatinic/dull abdomen', 'Uterine Contraction'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.abdomen.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Others */}
                <div className="space-y-1.5 pl-1">
                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">E. GENITOURINARY</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Blood stained in exam finger', 'Cervical dilatation', 'Presence of abnormal discharges'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.genitourinary.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">F. DIGITAL RECTAL EXAMINATIONS</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Enlarge Prostate', 'Mass', 'Hemorrhoids', 'Pus', 'Not applicable'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.rectal.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">G. SKIN / EXTREMITIES</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Clubbing', 'Cold clammy', 'Cyanosis/mottled skin', 'Edema/swelling', 'Decreased Mobility', 'Pale nailbeds', 'Poor skin turgor', 'Rashes/Petechiae', 'Weak pulses'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.skin.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <strong className="block border-b border-black font-extrabold text-[7.5px] text-slate-800 bg-slate-50 px-1">H. NEUROLOGICAL EXAMINATION</strong>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['Essentially Normal', 'Abnormal gait', 'Abnormal position sense', 'Abnormal sensation', 'Abnormal reflex(es)', 'Poor/altered memory', 'Poor muscle tone/strength', 'Poor coordination'].map(i => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="border border-black px-0.5 scale-75 font-bold">{detail.findingsPerSystem.neurological.includes(i) ? 'X' : ' '}</span>
                          <span>{i}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            IMAGE 4: CLINICAL CONSULTATION & TREATMENT RECORD (SOAP / PRESCRIPTION Rx)
            ========================================================================= */}
        {printFormType === 'consultation' && (
          <div className="border-[2px] border-black p-4 max-w-[850px] mx-auto space-y-4 bg-white print-page text-black">
            
            {/* Header / Republic of the Philippines / Clinic Info */}
            <div className="text-center space-y-1 border-b-2 border-black pb-3 relative">
              <div className="text-[9px] font-bold tracking-widest text-slate-800">REPUBLIKA NG PILIPINAS • REGIONAL HEALTH OFFICE IX</div>
              <h1 className="text-sm font-black tracking-widest text-blue-900 uppercase leading-none">SAINT FRANCIS HEALTH CLINIC DIGNITY SERVICE</h1>
              <p className="text-[8px] font-extrabold tracking-wider text-slate-600 uppercase">OFFICIAL CLINICAL CONSULTATION RECORD & TREATMENT REGISTER</p>
              
              <div className="flex justify-between text-[7.5px] text-slate-500 font-mono font-extrabold uppercase pt-1 px-1">
                <span>Pagadian City, Zamboanga del Sur</span>
                <span>Case No: SF-CONS-{selectedRecord.id.substring(0, 8).toUpperCase()}</span>
                <span>Tel: (062) 214-3838</span>
              </div>
            </div>

            {/* Document Index Info */}
            <div className="flex justify-between items-center text-[8px] font-bold border-b border-black pb-1.5 uppercase">
              <span>Required Clinical Document Page Reference</span>
              <span>Date: <strong className="font-mono">{selectedRecord.date}</strong></span>
            </div>

            {/* Patient Profile / Demographics Container */}
            <div className="border border-black p-2 bg-slate-50/50 space-y-2">
              <span className="text-[7.5px] font-black block tracking-widest text-slate-700">PATIENT DEMOGRAPHIC PROFILE</span>
              <div className="grid grid-cols-12 gap-x-3 gap-y-1.5 uppercase text-[8px]">
                <div className="col-span-6 border-b border-dashed border-black/50 pb-0.5">
                  <span className="text-slate-500 font-bold block text-[6.5px] leading-none">PATIENT NAME (LAST, FIRST, MIDDLE, EXT):</span>
                  <strong className="text-[9.5px] font-black text-black">{selectedRecord.patientName} {detail.physicalExams?.extName || ''}</strong>
                </div>
                <div className="col-span-3 border-b border-dashed border-black/50 pb-0.5">
                  <span className="text-slate-500 font-bold block text-[6.5px] leading-none">DATE OF BIRTH:</span>
                  <strong className="text-[8.5px] font-mono text-black">{detail.physicalExams?.dob || '—'}</strong>
                </div>
                <div className="col-span-3 border-b border-dashed border-black/50 pb-0.5">
                  <span className="text-slate-500 font-bold block text-[6.5px] leading-none">SEX / GENDER:</span>
                  <strong className="text-[8.5px] text-black">{detail.physicalExams?.sex || 'N/A'}</strong>
                </div>

                <div className="col-span-8 border-b border-dashed border-black/50 pb-0.5">
                  <span className="text-slate-500 font-bold block text-[6.5px] leading-none">COMPLETE CLINIC/HOME ADDRESS:</span>
                  <strong className="text-[8.5px] text-black">
                    {detail.physicalExams?.address || `${selectedRecord.barangay}, Pagadian City`}
                  </strong>
                </div>
                <div className="col-span-4 border-b border-dashed border-black/50 pb-0.5">
                  <span className="text-slate-500 font-bold block text-[6.5px] leading-none">PHILHEALTH ID (PIN) / MEMBER CLASS:</span>
                  <strong className="text-[8.5px] font-mono text-black">
                    {detail.physicalExams?.phicNumber || 'N/A'} • {detail.physicalExams?.memberCategory || 'INDIGENT'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Vital Signs / Telemetry Panel */}
            <div className="border border-black p-2 space-y-1">
              <span className="text-[7.5px] font-black block tracking-widest text-indigo-900 border-b border-slate-200 pb-0.5 uppercase">I. OBJECTIVE OUTCOME: PRIMARY CLINICAL VITALS</span>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-x-2 gap-y-1 text-center font-bold text-[8px] pt-1">
                <div className="border border-slate-300 p-1 rounded bg-white">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">BP RATIO</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.bloodPressure || '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">HEART RATE</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.heartRate ? `${detail.physicalExams.heartRate} BPM` : '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">RESP RATE</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.respRate ? `${detail.physicalExams.respRate} CPM` : '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">BODY TEMP</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.temp ? `${detail.physicalExams.temp} °C` : '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white font-serif">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">WEIGHT</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.weightKg ? `${detail.physicalExams.weightKg} KG` : '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white font-serif">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">HEIGHT</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.heightCm ? `${detail.physicalExams.heightCm} CM` : '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">CALC B.M.I</span>
                  <span className="text-[9px] font-mono font-black text-black">{detail.physicalExams?.bmi || '—'}</span>
                </div>
                <div className="border border-slate-300 p-1 rounded bg-white">
                  <span className="text-[6px] text-slate-500 block leading-none font-sans">BLOOD TYPE</span>
                  <span className="text-[9px] font-mono font-black text-black uppercase">{detail.physicalExams?.bloodType || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Subjective Medical History & Clinical Diagnostics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* LEFT: MEDICAL SURVEY BRIEF */}
              <div className="border border-black p-2 space-y-2 text-[7.5px] uppercase flex flex-col justify-between">
                <div>
                  <span className="text-[7.5px] font-black block tracking-wider text-slate-700 border-b border-black pb-0.5 mb-1.5">II. SUBJECTIVE: BRIEF CLINICAL METRICS</span>
                  
                  <div className="space-y-1 mb-2">
                    <strong className="text-slate-650">Checked Past Medical Illnesses:</strong>
                    <div className="flex flex-wrap gap-1 leading-tight font-mono text-[6px] pt-0.5">
                      {detail.pastMedical && Object.keys(detail.pastMedical).filter(k => typeof (detail.pastMedical as any)[k] === 'boolean' && (detail.pastMedical as any)[k] === true && k !== 'none').map(k => (
                        <span key={k} className="px-1 py-0.5 bg-slate-100 border rounded font-bold">{k.replace(/([A-Z])/g, ' $1')}</span>
                      ))}
                      {(!detail.pastMedical || detail.pastMedical.none) && <span className="text-slate-400 italic">No past medical illnesses flagged.</span>}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <strong className="text-slate-650">Checked Family History Flags:</strong>
                    <div className="flex flex-wrap gap-1 leading-tight font-mono text-[6px] pt-0.5">
                      {detail.familyHistory && Object.keys(detail.familyHistory).filter(k => typeof (detail.familyHistory as any)[k] === 'boolean' && (detail.familyHistory as any)[k] === true && k !== 'none').map(k => (
                        <span key={k} className="px-1 py-0.5 bg-slate-100 border rounded font-bold">{k.replace(/([A-Z])/g, ' $1')}</span>
                      ))}
                      {(!detail.familyHistory || detail.familyHistory.none) && <span className="text-slate-400 italic">No family history flags recorded.</span>}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <strong className="text-slate-650 block pb-1">System Status Overview:</strong>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[6px]">
                    {detail.findingsPerSystem && Object.keys(detail.findingsPerSystem).filter(sys => !sys.endsWith('Others')).map(sys => {
                      const items = (detail.findingsPerSystem as any)[sys] as string[];
                      const isNormal = items.includes('Essentially Normal') || items.includes('essentially normal') || items.length === 0;
                      return (
                        <div key={sys} className="flex justify-between border-b border-slate-100 pb-0.5">
                          <span className="text-slate-400 font-bold uppercase">{sys}:</span>
                          <span className={isNormal ? "text-emerald-700 font-bold" : "text-red-700 font-black"}>
                            {isNormal ? "✓ NORMAL" : "✗ ABNORMAL"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT: CHIEF COMPLAINT AND DIAGNOSIS */}
              <div className="border border-black p-2 space-y-3 uppercase flex flex-col justify-between">
                <div>
                  <span className="text-[7.5px] font-black block tracking-wider text-blue-950 border-b border-black pb-0.5 mb-2 uppercase">III. ASSESSMENT: COMPLAINT & PRIMARY CASE DIAGNOSIS</span>
                  <span className="text-slate-500 font-bold block text-[6.5px] leading-none uppercase">PRIMARY INDICATION / DIAGNOSIS DIAGNOSTIC INDEX:</span>
                  <div className="font-mono text-[9px] font-black text-red-905 leading-normal border border-dashed border-red-200 p-2 rounded bg-red-50/40 normal-case mt-1.5 h-20 overflow-y-auto">
                    {selectedRecord.diagnosis}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[6.5px] text-slate-500 font-mono leading-relaxed lowercase">
                  <p className="font-bold uppercase text-[6px] text-slate-600 mb-0.5">Subject Habits / Status Flags:</p>
                  <span>tobacco smoking: {detail.personalSocial?.smoking || 'no'} • </span>
                  <span>alcohol consumption: {detail.personalSocial?.alcohol || 'no'} • </span>
                  <span>general sensorium: {detail.physicalExams?.generalAlteredSensorium === 'Yes' ? 'altered' : 'essentially normal/alert'} • </span>
                  <span>immunizations: {detail.immunizations?.adult?.length + detail.immunizations?.children?.length > 0 ? 'immunization records saved' : 'not logged'}</span>
                </div>
              </div>

            </div>

            {/* RX MEDICATIONS AND TREATMENT PLAN */}
            <div className="border-2 border-black p-3 space-y-2 bg-white text-black relative">
              <div className="absolute top-2 right-4 font-serif font-black text-blue-900/10 text-8xl select-none leading-none">℞</div>
              <span className="text-[8px] font-black block tracking-widest text-[#1a56db] border-b-2 border-black pb-0.5 uppercase">IV. THERAPY & CLINICAL Rx PRESCRIPTION ORDER (℞)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                {/* Posology Medications */}
                <div className="md:col-span-7 space-y-1 md:border-r border-dashed border-slate-350 md:pr-4">
                  <div className="flex items-center gap-1.5 pb-1 select-none">
                    <span className="font-serif font-black text-sm text-[#1a56db]">℞</span>
                    <span className="font-extrabold uppercase text-[7px] text-slate-500 font-sans">Prescribed Posology & Meds List:</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-900 normal-case bg-blue-50/10 p-2.5 border border-slate-200 rounded leading-relaxed min-h-[100px] whitespace-pre-wrap">
                    {selectedRecord.medications || 'No specific medication prescribed. Observational recovery & bedrest advised.'}
                  </div>
                </div>

                {/* Treatment / Instructions */}
                <div className="md:col-span-5 space-y-1">
                  <span className="font-extrabold uppercase text-[7px] text-slate-500 block pb-1.5 select-none font-sans">CLINICAL TREATMENT INSTRUCTIONS / THERAPY PLAN:</span>
                  <div className="font-mono text-[9px] text-slate-800 normal-case bg-slate-50/40 p-2.5 border border-slate-200 rounded leading-snug min-h-[100px] whitespace-pre-wrap">
                    {selectedRecord.treatment || 'Ensure adherence to follow-up visits. Maintain hydrated status & report any symptoms changes.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Official Signatures / Thumbmarks block */}
            <div className="border border-black p-3 bg-slate-50/60 rounded grid grid-cols-2 gap-6 relative text-[8px]">
              
              {/* LEFT: PRACTITIONER */}
              <div className="flex flex-col justify-end items-center text-center pt-6 border-r border-slate-200 pr-3">
                <div className="w-48 border-b-2 border-black/80 font-bold text-[9px] uppercase tracking-wide text-slate-900 pb-0.5">
                  DR. FRANCES S. MENDOZA, MD
                </div>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mt-1">Attending Clinical Specialist</span>
                <span className="text-[6px] font-mono text-slate-400 animate-pulse">Lic No: 01047285 • PTR No: 2026-PAG-993</span>
              </div>

              {/* RIGHT: PATIENT ATTESTATION */}
              <div className="flex flex-col justify-end items-center text-center pt-6">
                {detail.pmrfUpdating?.memberSignature ? (
                  <img src={detail.pmrfUpdating.memberSignature} alt="Patient Signature" className="h-8 object-contain max-w-[120px] mb-1 bg-transparent" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-9 flex items-center justify-center text-[7px] text-slate-400 italic font-mono select-none">
                    (Patient / Guardian Signature Slot)
                  </div>
                )}
                <div className="w-48 border-b border-black/80 font-extrabold text-[8.5px] uppercase tracking-wide text-slate-900 pb-0.5">
                  {selectedRecord.patientName}
                </div>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mt-1">Beneficiary Patient Signature</span>
                <span className="text-[6px] font-mono text-slate-400">Verification Date: {selectedRecord.date}</span>
              </div>

              {/* Optional thumbmark indicator */}
              {detail.pmrfUpdating?.memberThumbmark && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 bg-white p-1 border rounded shadow-xs select-none">
                  <img src={detail.pmrfUpdating.memberThumbmark} alt="Citizen Thumb Signature" className="h-5 w-4 object-contain" referrerPolicy="no-referrer" />
                  <span className="text-[4px] text-slate-500 font-bold uppercase leading-none">Thumbmark</span>
                </div>
              )}

            </div>

          </div>
        )}

        {/* =========================================================================
            PRESCRIPTION Rx: OFFICIAL GERIATRIC & GENERAL Rx THERAPY Prescription Slip
            ========================================================================= */}
        {printFormType === 'prescription' && (
          <div className="border-[3px] border-black p-6 max-w-[650px] mx-auto bg-white print-page text-black space-y-6 select-text relative font-sans leading-normal">
            
            {/* Header section with Clinic Identity */}
            <div className="text-center space-y-1 pb-4 border-b-2 border-black/80">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-600">REPUBLIKA NG PILIPINAS • REGIONAL HEALTH OFFICE IX</div>
              <h1 className="text-lg font-black tracking-wide text-blue-980 uppercase leading-none">SAINT FRANCIS HEALTH CLINIC</h1>
              <p className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-900">Official Patient Care Benefits Center & Konsulta Services</p>
              
              <div className="grid grid-cols-3 text-[8.5px] font-bold text-slate-500 uppercase pt-1 max-w-[500px] mx-auto border-t border-slate-100 mt-1 font-mono">
                <span>Purok Bagong Silang, Pagadian Clinic</span>
                <span>Tel: (062) 214-3838</span>
                <span>Email: sfhc2026@gmail.com</span>
              </div>
            </div>

            {/* Doctor Info details card */}
            <div className="flex justify-between items-start text-[9.5px] border-b border-dashed border-slate-300 pb-2 bg-slate-50 p-2 rounded-lg">
              <div className="text-left">
                <strong className="block text-slate-800 text-[11px] font-black uppercase">DR. FRANCES S. MENDOZA, MD</strong>
                <span className="text-slate-500 font-bold block text-[8px] uppercase">Specialist in Family and Community Medicine</span>
                <span className="text-[8px] font-mono text-slate-400 block pt-0.5">License No: 01047285 • PTR No: 2026-PAG-993</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-bold block text-[8px] uppercase">Consultation Case Reference</span>
                <strong className="font-mono text-slate-800 block">CASE-RX-{selectedRecord.id.substring(0, 8).toUpperCase()}</strong>
                <span className="text-[8.5px] text-slate-550 block font-mono">Date: <strong className="font-mono text-black">{selectedRecord.date}</strong></span>
              </div>
            </div>

            {/* Patient Credentials panel */}
            <div className="grid grid-cols-12 gap-x-4 gap-y-2 text-[9px] uppercase bg-white p-2.5 border border-black rounded-lg text-left">
              <div className="col-span-6">
                <span className="text-slate-400 font-bold block text-[7px] leading-none">PATIENT CLIENT:</span>
                <strong className="text-[10px] text-slate-900">{selectedRecord.patientName}</strong>
              </div>
              <div className="col-span-3">
                <span className="text-slate-400 font-bold block text-[7px] leading-none">DOB:</span>
                <strong className="font-mono">{detail.physicalExams?.dob || 'N/A'}</strong>
              </div>
              <div className="col-span-3">
                <span className="text-slate-400 font-bold block text-[7px] leading-none">SEX:</span>
                <strong>{detail.physicalExams?.sex || 'N/A'}</strong>
              </div>
              
              <div className="col-span-8">
                <span className="text-slate-400 font-bold block text-[7px] leading-none font-sans">HOME RESIDENCE ADDRESS:</span>
                <strong className="truncate block font-semibold text-slate-800">{detail.physicalExams?.address || `${selectedRecord.barangay}, Pagadian City`}</strong>
              </div>
              <div className="col-span-4">
                <span className="text-slate-400 font-bold block text-[7px] leading-none">PHILHEALTH NUMBER (PIN):</span>
                <strong className="font-mono text-emerald-700">{detail.physicalExams?.phicNumber || 'N/A'}</strong>
              </div>
            </div>

            {/* Huge Rx Watermark + Prescribed Posologies */}
            <div className="min-h-[220px] relative border-2 border-slate-150 p-4 rounded-xl bg-slate-50/10 flex flex-col justify-between text-left">
              
              {/* Giant watermarked Latin Recipe symbol "℞" */}
              <div className="absolute top-2 left-6 font-serif select-none pointer-events-none text-slate-200/40 font-extrabold text-[150px] leading-none">
                ℞
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-1.5 border-b pb-1 select-none">
                  <span className="font-serif font-black text-lg text-blue-900/80">℞</span>
                  <span className="font-extrabold uppercase text-[8px] text-slate-500 font-sans tracking-wider">MEDICATIONS & PHARMACOLOGICAL ORDER:</span>
                </div>

                {/* Main dynamic medications posology instructions text */}
                <div className="font-mono text-[11px] font-bold text-slate-900 leading-relaxed whitespace-pre-wrap pl-6 normal-case">
                  {selectedRecord.medications ? selectedRecord.medications : (
                    <span className="text-slate-400 italic font-sans font-normal">No specific medications itemized. Supportive resting recovery recommended.</span>
                  )}
                </div>

                <div className="pt-2">
                  <span className="font-extrabold uppercase text-[7px] text-slate-400 block leading-none pb-1">SPECIAL CARE / USE ADVICE INSTRUCTIONS:</span>
                  <div className="font-mono text-[9px] text-slate-700 leading-snug whitespace-pre-wrap pl-6 normal-case">
                    {selectedRecord.treatment || 'Ensure proper hydration status. Return to clinic if complications or fever persists.'}
                  </div>
                </div>
              </div>

              {/* Sub prescription disclaimer footer text */}
              <div className="relative z-10 text-[6.5px] text-slate-400 uppercase font-bold border-t border-dashed mt-4 pt-2 font-mono">
                NOTICE: Take medicines exactly as scheduled. Do not duplicate doses. This order is valid for 30 days from date of execution.
              </div>
            </div>

            {/* Doctor seal signature block */}
            <div className="flex justify-between items-end pt-10 px-4 relative">
              <div className="flex flex-col items-start gap-1 text-left">
                <div className="border border-indigo-200 rounded p-1 text-center bg-indigo-50/20 max-w-[120px] select-none">
                  <span className="text-[5px] text-indigo-600 font-extrabold block uppercase tracking-tight leading-none">SFHC OFFICIAL SEAL</span>
                  <span className="text-[6.5px] font-black text-rose-600 block uppercase font-mono mt-0.5 border border-dashed border-rose-300 px-1">✓ PRESCRIPTION Rx</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-end text-center relative">
                {/* Clean signature overlay */}
                <div className="absolute -top-10 w-32 h-14 pointer-events-none opacity-90 select-none">
                  <svg className="w-full h-full text-indigo-600" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 32C25 22 45 10 52 18C59 26 31 43 45 35C59 27 82 12 90 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="50" cy="20" r="1.5" fill="currentColor"/>
                  </svg>
                </div>
                
                <div className="w-48 border-b-2 border-black font-extrabold text-[10px] uppercase text-slate-900 pb-0.5 tracking-wide font-sans">
                  Dr. Frances S. Mendoza, MD
                </div>
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider mt-1 font-sans">Attending Physician • General Consultant</span>
                <span className="text-[6px] font-mono text-slate-400">Lic No: 01047285 • PTR No: 2026-PAG-993</span>
              </div>
            </div>

          </div>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-xs pb-12">
      
      {/* Search Header toolbar */}
      {viewMode === 'list' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-50 text-red-600 animate-pulse">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight leading-tight">Patient Consultation Center</h1>
              <p className="text-slate-450 text-[10px]">Record Clinical Histories, PMRF forms, Physical Examinations & System Diagnostics logs</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450 pointer-events-none">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search patient consultations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-red-500 rounded-xl font-medium outline-none transition"
              />
            </div>
            
            <button
              onClick={() => {
                setViewMode('add');
                setPatientName('');
                setConsultDetails(defaultConsultationDetails());
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase text-[10px] tracking-wide rounded-xl shadow-lg hover:shadow-red-500/20 active:scale-95 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" /> consult Patient
            </button>
          </div>
        </div>
      )}

      {/* Patient consultation table listings */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-3xl border border-slate-150/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400">Loading diagnostic consultation data...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-16 flex flex-col items-center justify-center gap-2">
              <HeartPulse className="h-10 w-10 text-slate-250" />
              <p className="font-extrabold text-slate-700 text-sm">No recorded medical consultations matching queries</p>
              <p className="text-[10px] text-slate-400 max-w-sm">Use the "Consult Patient" button to open the PhilHealth medical & clinical diagnostic examination forms wizard tool.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-extrabold select-none text-[10px] tracking-wide uppercase">
                    <th className="p-4 pl-6">Consult Patient Details</th>
                    <th className="p-4">Primary Diagnosis</th>
                    <th className="p-4">Barangay Reference</th>
                    <th className="p-4">Admitted Diagnostic Date</th>
                    <th className="p-4 text-right pr-6">Forms actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-650">
                  {filtered.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/40 transition">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-black text-slate-800 text-sm block leading-none">{record.patientName}</span>
                            <span className="text-[10px] text-slate-400 block pt-1">Ref: {record.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 max-w-xs truncate font-semibold text-slate-755">{record.diagnosis}</td>
                      <td className="p-4 text-slate-550">{record.barangay}</td>
                      <td className="p-4 text-slate-500 font-mono text-[10px]">{record.date}</td>
                      <td className="p-4 text-right pr-6">
                        <button
                          onClick={() => {
                            setSelectedRecord(record);
                            setViewMode('detail');
                          }}
                          className="px-3.5 py-1.5 hover:bg-slate-900 border border-slate-200 hover:border-slate-900 hover:text-white rounded-xl transition font-extrabold text-[10px] uppercase cursor-pointer"
                        >
                          Review All Forms
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: DETAIL PREVIEW OF CONSTITUENT FORMS
          ========================================================================= */}
      {viewMode === 'detail' && selectedRecord && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-100 font-extrabold uppercase text-[10px] tracking-wide"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to listings
            </button>
            <div className="text-center sm:text-right">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wide leading-none">{selectedRecord.patientName}</h2>
              <p className="text-[10px] text-slate-400 pt-1">Clinical Record Diagnostics Index Case File</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Form A Box: PMRF BACK */}
            <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-xs flex flex-col justify-between gap-4 hover:shadow transition">
              <div>
                <span className="text-[9.5px] uppercase tracking-wider text-emerald-600 font-black">PHILHEALTH PMRF FB</span>
                <h3 className="text-md font-bold text-slate-800 pt-1">V. UPDATING PROFILE</h3>
                <p className="text-slate-450 text-[10px] pt-1">Form index containing requested personal amendment changes and attestation signatures.</p>
              </div>
              <button
                onClick={() => handlePrint('pmrf')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl font-extrabold uppercase text-[9.5px] tracking-wide cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> PMRF Back
              </button>
            </div>

            {/* Form B Box: MEDICAL HISTORY */}
            <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-xs flex flex-col justify-between gap-4 hover:shadow transition">
              <div>
                <span className="text-[9.5px] uppercase tracking-wider text-blue-600 font-black font-sans">HISTORY FORM</span>
                <h3 className="text-md font-bold text-slate-800 pt-1">PAST MEDICAL STATIONS</h3>
                <p className="text-slate-450 text-[10px] pt-1">Contains checkboxes for past medical issues, family background medical flags and operations.</p>
              </div>
              <button
                onClick={() => handlePrint('medical')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold uppercase text-[9.5px] tracking-wide cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> History Form
              </button>
            </div>

            {/* Form C Box: CLINICAL FINDINGS */}
            <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-xs flex flex-col justify-between gap-4 hover:shadow transition">
              <div>
                <span className="text-[9.5px] uppercase tracking-wider text-red-650 font-black">CLINICAL EXAMS</span>
                <h3 className="text-md font-bold text-slate-800 pt-1">PHYSICAL EXAM CARD</h3>
                <p className="text-slate-450 text-[10px] pt-1">Vitals overview, pediatric calculations, physical status and deep system examinations findings.</p>
              </div>
              <button
                onClick={() => handlePrint('findings')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold uppercase text-[9.5px] tracking-wide cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Findings Card
              </button>
            </div>

            {/* Form D Box: CLINICAL CONSULTATION RECORD */}
            <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-xs flex flex-col justify-between gap-4 hover:shadow transition">
              <div>
                <span className="text-[9.5px] uppercase tracking-wider text-violet-655 font-black">REQUIRED CLINIC FB</span>
                <h3 className="text-md font-bold text-slate-800 pt-1">SOAP CONSULT & Rx</h3>
                <p className="text-slate-450 text-[10px] pt-1">Generates and prints the official consolidated SOAP medical record summary, treatment plans and orders.</p>
              </div>
              <button
                onClick={() => handlePrint('consultation')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-605 hover:bg-violet-750 text-white rounded-xl font-extrabold uppercase text-[9.5px] tracking-wide cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> SOAP Record
              </button>
            </div>

            {/* Form E Box: Rx STANDALONE PRESCRIPTION ORDER */}
            <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-xs flex flex-col justify-between gap-4 hover:shadow transition">
              <div>
                <span className="text-[9.5px] uppercase tracking-wider text-rose-650 font-black">Rx PRESCRIPTION</span>
                <h3 className="text-md font-bold text-slate-800 pt-1">STANDALONE PRESCRIPTION</h3>
                <p className="text-slate-450 text-[10px] pt-1">Generates standalone recipe ℞ prescriptions containing medication, dosage, instructions, and seals.</p>
              </div>
              <button
                onClick={() => handlePrint('prescription')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold uppercase text-[9.5px] tracking-wide cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Standalone Rx
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: NEW CONSULTATION PATIENT FORM WIZARD
          ========================================================================= */}
      {viewMode === 'add' && (
        <form onSubmit={handleAddSubmit} className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-150 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h1 className="text-base font-extrabold uppercase tracking-wide">Patient Consultation Electronic Wizard</h1>
            <span className="text-[10px] font-mono select-none px-2 py-0.5 bg-red-50 text-red-600 border rounded font-black uppercase">PART {formStep + 1} OF 2</span>
          </div>

          {/* Quick Selector for Active Patient */}
          {!patientName && (
            <div className="space-y-4">
              {showScanner ? (
                <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-700 shadow-md space-y-4 transition-all duration-300">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Camera className="h-5 w-5 text-emerald-400 animate-pulse" />
                      <div>
                        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-105">Live camera QR/Barcode scanner</h3>
                        <p className="text-[9px] text-slate-400">Position the citizen's PhilHealth ID QR code inside the viewfinder</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScanner(false)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 font-extrabold uppercase text-[8.5px] tracking-wider text-slate-300 cursor-pointer"
                    >
                      Close Camera
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="relative border-4 border-slate-800 rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center max-w-[340px] mx-auto shadow-inner">
                        <div id="qr-reader-container" className="absolute inset-0 w-full h-full"></div>
                        <div className="absolute inset-0 border border-emerald-500/20 flex items-center justify-center pointer-events-none select-none z-10">
                          <div className="w-36 h-36 border-2 border-dashed border-emerald-400 rounded-xl relative flex items-center justify-center shadow-lg">
                            <div className="absolute top-0 left-0 w-3 h-3 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 animate-pulse"></div>
                            <div className="absolute top-0 right-0 w-3 h-3 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 animate-pulse"></div>
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 animate-pulse"></div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 animate-pulse"></div>
                            <div className="absolute left-0 right-0 h-1 bg-emerald-400 animate-bounce shadow-[0_0_8px_#10b981]"></div>
                          </div>
                        </div>
                      </div>
                      {errorMessage && (
                        <p className="text-red-400 text-[9px] text-center font-mono uppercase font-bold">{errorMessage}</p>
                      )}
                    </div>
                    
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[10px] space-y-2 max-h-[220px] overflow-y-auto">
                      <strong className="block text-indigo-400 font-extrabold uppercase tracking-widest border-b border-indigo-950 pb-1 font-mono">Sandbox Demo QR presets (Quick Click)</strong>
                      <p className="text-[9px] text-slate-400 leading-relaxed">Select any registered citizen below to trigger a mock scan event:</p>
                      <div className="space-y-1.5 pt-1">
                        {citizens.length === 0 ? (
                          <div className="text-slate-605 text-[9px] py-2">No masterlist citizens loaded yet.</div>
                        ) : (
                          citizens.slice(0, 8).map(c => {
                            const cPin = c.pmrfDetails?.pin || c.pmrfDetails?.phicNumber || '1204' + Math.floor(100000 + Math.random() * 900000);
                            return (
                              <button
                                key={c.fullName}
                                type="button"
                                onClick={() => handleScanSuccess(JSON.stringify({ fullName: c.fullName, pin: cPin }), c)}
                                className="w-full text-left p-2 border border-slate-800 rounded-xl bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500 transition text-[9px] cursor-pointer flex items-center justify-between"
                              >
                                <div>
                                  <strong className="block text-slate-200">{c.fullName}</strong>
                                  <span className="text-slate-500 font-mono text-[8px]">PIN: {cPin}</span>
                                </div>
                                <span className="text-[8px] bg-slate-800 text-emerald-400 font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-tight shrink-0">Scan →</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-5 rounded-3xl border border-slate-150 text-slate-700 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
                    <strong className="block text-sm font-extrabold text-slate-850">Select consultation patient context:</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage('');
                        setShowScanner(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold uppercase text-[9px] tracking-wider transition cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Scan PhilHealth ID Card QR
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 p-2 border border-dashed rounded-2xl flex flex-wrap gap-2 max-h-52 overflow-y-auto">
                    {citizens.length === 0 ? (
                      <p className="text-slate-400 p-4 shrink-0 text-center w-full select-none">No active citizen records in local masterlist. Add household members first.</p>
                    ) : (
                      citizens.map(c => (
                        <button
                          key={c.fullName}
                          type="button"
                          onClick={() => handleSelectPatient(c)}
                          className="px-3 py-2 border rounded-xl hover:bg-red-50 hover:border-red-300 transition duration-150 cursor-pointer text-[10px] text-left shrink-0 bg-white"
                        >
                          <strong className="block text-slate-800 text-[11px]">{c.fullName}</strong>
                          <span className="text-[9px] text-slate-400 capitalize block pt-0.5">{c.gender} • {c.age} Yrs • {c.barangay}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {patientName && (
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <strong className="text-red-600 block text-xs tracking-wide uppercase">ACTIVE PATIENT TARGET:</strong>
                <span className="text-base font-black text-slate-800">{patientName}</span>
              </div>
              <button
                type="button"
                onClick={() => setPatientName('')}
                className="text-[9.5px] uppercase font-bold text-blue-600 hover:underline"
              >
                Change Patient Reference
              </button>
            </div>
          )}

          {/* Form sequence indicators */}
          <div className="flex border border-slate-200 bg-white rounded-2xl p-1 shadow-xs font-bold text-[10px] uppercase select-none text-center">
            <button
              type="button"
              onClick={() => setFormStep(0)}
              className={`flex-1 py-2.5 rounded-xl transition ${formStep === 0 ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              1. Surveys & History questionnaire (Image 2)
            </button>
            <button
              type="button"
              onClick={() => setFormStep(1)}
              className={`flex-1 py-2.5 rounded-xl transition ${formStep === 1 ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              2. Clinical Record Card (Image 3)
            </button>
          </div>

          <div className={patientName ? "grid grid-cols-1 lg:grid-cols-12 gap-6" : ""}>
            <div className={patientName ? "lg:col-span-8 space-y-6" : "space-y-6"}>

          {/* =========================================================================
              PART 1: DETAILED PAST MEDICAL / FAMILY HISTORY QUESTIONNAIRE WIZARD
              ========================================================================= */}
          {formStep === 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800">Patient Diagnostic History (Image 2)</h3>
                <p className="text-slate-450 text-[10px]">Track allergy lists, surgeries, smoking frequency and clinical history flags.</p>
              </div>

              {/* Past Medical History checkboxes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* PAST MEDICAL */}
                <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/40 text-slate-700 space-y-3">
                  <strong className="block text-xs font-black uppercase text-slate-800 border-b pb-1">Past Medical Illness Checklist:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-bold">
                    {Object.keys(consultDetails.pastMedical).filter(k => typeof (consultDetails.pastMedical as any)[k] === 'boolean' && k !== 'none').map(key => (
                      <div key={key} className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(consultDetails.pastMedical as any)[key]}
                            onChange={() => togglePastMedical(key as any)}
                            className="h-3.5 w-3.5 accent-red-600 rounded"
                          />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                        {(consultDetails.pastMedical as any)[key] && key === 'allergy' && (
                          <input type="text" placeholder="Specify Allergy" value={consultDetails.pastMedical.allergySpec} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, allergySpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700 outline-none" />
                        )}
                        {(consultDetails.pastMedical as any)[key] && key === 'cancer' && (
                          <input type="text" placeholder="Organ name" value={consultDetails.pastMedical.cancerSpec} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, cancerSpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.pastMedical as any)[key] && key === 'hepatitis' && (
                          <input type="text" placeholder="A/B/C/etc" value={consultDetails.pastMedical.hepatitisSpec} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, hepatitisSpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.pastMedical as any)[key] && key === 'pneumonia' && (
                          <input type="text" placeholder="BP check state" value={consultDetails.pastMedical.pneumoniaHighestBP} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, pneumoniaHighestBP: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.pastMedical as any)[key] && key === 'ptb' && (
                          <input type="text" placeholder="Category" value={consultDetails.pastMedical.ptbCat} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, ptbCat: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.pastMedical as any)[key] && key === 'extraPtb' && (
                          <input type="text" placeholder="Category" value={consultDetails.pastMedical.extraPtbCat} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, extraPtbCat: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.pastMedical as any)[key] && key === 'others' && (
                          <input type="text" placeholder="Others specifier" value={consultDetails.pastMedical.othersSpec} onChange={(e) => setConsultDetails({...consultDetails, pastMedical: {...consultDetails.pastMedical, othersSpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700 font-mono" />
                        )}
                      </div>
                    ))}
                    <label className="col-span-2 flex items-center gap-2 cursor-pointer border-t pt-2 mt-2">
                      <input
                        type="checkbox"
                        checked={consultDetails.pastMedical.none}
                        onChange={() => togglePastMedical('none')}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="font-bold text-slate-800 border border-transparent">No Significant past medical illness history flags (None)</span>
                    </label>
                  </div>
                </div>

                {/* FAMILY HISTORY */}
                <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/40 text-slate-700 space-y-3">
                  <strong className="block text-xs font-black uppercase text-slate-800 border-b pb-1">Family Medical Illness History:</strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-bold">
                    {Object.keys(consultDetails.familyHistory).filter(k => typeof (consultDetails.familyHistory as any)[k] === 'boolean' && k !== 'none').map(key => (
                      <div key={key} className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(consultDetails.familyHistory as any)[key]}
                            onChange={() => toggleFamilyHistory(key as any)}
                            className="h-3.5 w-3.5 accent-blue-600 rounded"
                          />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        </label>
                        {(consultDetails.familyHistory as any)[key] && key === 'allergy' && (
                          <input type="text" placeholder="Specify Allergy" value={consultDetails.familyHistory.allergySpec} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, allergySpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700 outline-none" />
                        )}
                        {(consultDetails.familyHistory as any)[key] && key === 'cancer' && (
                          <input type="text" placeholder="Organ name" value={consultDetails.familyHistory.cancerSpec} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, cancerSpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.familyHistory as any)[key] && key === 'hepatitis' && (
                          <input type="text" placeholder="A/B/C/etc" value={consultDetails.familyHistory.hepatitisSpec} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, hepatitisSpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.familyHistory as any)[key] && key === 'pneumonia' && (
                          <input type="text" placeholder="BP check state" value={consultDetails.familyHistory.pneumoniaHighestBP} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, pneumoniaHighestBP: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.familyHistory as any)[key] && key === 'ptb' && (
                          <input type="text" placeholder="Category" value={consultDetails.familyHistory.ptbCat} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, ptbCat: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.familyHistory as any)[key] && key === 'extraPtb' && (
                          <input type="text" placeholder="Category" value={consultDetails.familyHistory.extraPtbCat} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, extraPtbCat: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700" />
                        )}
                        {(consultDetails.familyHistory as any)[key] && key === 'others' && (
                          <input type="text" placeholder="Others specifier" value={consultDetails.familyHistory.othersSpec} onChange={(e) => setConsultDetails({...consultDetails, familyHistory: {...consultDetails.familyHistory, othersSpec: e.target.value}})} className="w-full border rounded-lg p-1 text-[8.5px] bg-white text-slate-700 font-mono" />
                        )}
                      </div>
                    ))}
                    <label className="col-span-2 flex items-center gap-2 cursor-pointer border-t pt-2 mt-2">
                      <input
                        type="checkbox"
                        checked={consultDetails.familyHistory.none}
                        onChange={() => toggleFamilyHistory('none')}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="font-bold text-slate-800 border border-transparent">No Significant family medical history flags (None)</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Past Surgical and Personal Social */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-3">
                  <strong className="block text-slate-700 font-black text-xs uppercase leading-none">Past Surgical/Operation Table (Up to 3 inputs):</strong>
                  {consultDetails.pastSurgical.map((operationRow, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={`Surgical Operation ${idx+1} name`}
                        className="flex-1 border rounded-xl p-2 bg-slate-50/50 hover:bg-slate-50 outline-none"
                        value={operationRow.operation}
                        onChange={(e) => {
                          const updated = [...consultDetails.pastSurgical];
                          updated[idx].operation = e.target.value;
                          setConsultDetails({ ...consultDetails, pastSurgical: updated });
                        }}
                      />
                      <input
                        type="text"
                        placeholder="MM/YYYY or Date"
                        className="w-28 border rounded-xl p-2 bg-slate-50/50 hover:bg-slate-50 text-center outline-none"
                        value={operationRow.date}
                        onChange={(e) => {
                          const updated = [...consultDetails.pastSurgical];
                          updated[idx].date = e.target.value;
                          setConsultDetails({ ...consultDetails, pastSurgical: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <strong className="block text-slate-705 font-black text-xs uppercase leading-none">Personal & Social status indicators:</strong>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-bold">
                    <div className="border p-3.5 rounded-3xl bg-slate-50/40 text-slate-700 space-y-1.5">
                      <span>Smoking frequency:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['Yes', 'No', 'Quit'].map(s => (
                          <button key={s} type="button" onClick={() => setConsultDetails({...consultDetails, personalSocial: {...consultDetails.personalSocial, smoking: s as any}})} className={getBtnClass(consultDetails.personalSocial.smoking === s)}>{s}</button>
                        ))}
                      </div>
                      {consultDetails.personalSocial.smoking === 'Yes' && (
                        <input type="text" placeholder="No. of Packs/year?" value={consultDetails.personalSocial.smokingPacks} onChange={(e) => setConsultDetails({...consultDetails, personalSocial: {...consultDetails.personalSocial, smokingPacks: e.target.value}})} className="w-full border rounded-xl p-2 text-[10px] bg-white outline-none" />
                      )}
                    </div>

                    <div className="border p-3.5 rounded-3xl bg-slate-50/40 text-slate-700 space-y-1.5">
                      <span>Alcohol frequency:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['Yes', 'No', 'Quit'].map(s => (
                          <button key={s} type="button" onClick={() => setConsultDetails({...consultDetails, personalSocial: {...consultDetails.personalSocial, alcohol: s as any}})} className={getBtnClass(consultDetails.personalSocial.alcohol === s)}>{s}</button>
                        ))}
                      </div>
                      {consultDetails.personalSocial.alcohol === 'Yes' && (
                        <input type="text" placeholder="No. of bottles/day?" value={consultDetails.personalSocial.alcoholBottles} onChange={(e) => setConsultDetails({...consultDetails, personalSocial: {...consultDetails.personalSocial, alcoholBottles: e.target.value}})} className="w-full border rounded-xl p-2 text-[10px] bg-white outline-none" />
                      )}
                    </div>

                    <div className="border p-3.5 rounded-3xl bg-slate-50/40 text-slate-700 space-y-1.5">
                      <span>Illicit Drug Use:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['Yes', 'No'].map(s => (
                          <button key={s} type="button" onClick={() => setConsultDetails({...consultDetails, personalSocial: {...consultDetails.personalSocial, drugs: s as any}})} className={getBtnClass(consultDetails.personalSocial.drugs === s)}>{s}</button>
                        ))}
                      </div>
                    </div>

                    <div className="border p-3.5 rounded-3xl bg-slate-50/40 text-slate-700 space-y-1.5">
                      <span>Sexually Active:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['Yes', 'No'].map(s => (
                          <button key={s} type="button" onClick={() => setConsultDetails({...consultDetails, personalSocial: {...consultDetails.personalSocial, sexScreening: s as any}})} className={getBtnClass(consultDetails.personalSocial.sexScreening === s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* IMMUNIZATION SECTION (Image 2) */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#1a365d] text-[11px] uppercase tracking-wider block font-serif">IMMUNIZATION STATUS CHECKLIST</span>
                  <div className="h-[1px] bg-slate-200 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* FOR CHILDREN */}
                  <div className="border p-3 rounded-2xl bg-slate-50/30 space-y-2 text-[10px]">
                    <span className="block font-black text-slate-700 uppercase text-[9px] border-b pb-1">For Children:</span>
                    <div className="grid grid-cols-1 gap-1.5 pt-1.5 font-bold">
                      {["BCG", "OPV1", "OPV2", "OPV3", "DPT1", "DPT2", "DPT3", "Measles", "Hepatitis B1", "Hepatitis B2", "Hepatitis B3", "Hepatitis A", "Varicella (Chicken Pox)", "None"].map(item => {
                        const checked = consultDetails.immunizations.children.includes(item);
                        return (
                          <label key={item} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleImmList('children', item)}
                              className="h-3.5 w-3.5 rounded accent-emerald-600"
                            />
                            <span className={checked ? "text-emerald-700 font-extrabold" : "text-slate-655"}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* FOR ADULT */}
                  <div className="border p-3 rounded-2xl bg-slate-50/30 space-y-2 text-[10px]">
                    <span className="block font-black text-slate-700 uppercase text-[9px] border-b pb-1">For Adult:</span>
                    <div className="grid grid-cols-1 gap-1.5 pt-1.5 font-bold">
                      {["HPV", "MMR", "None"].map(item => {
                        const checked = consultDetails.immunizations.adult.includes(item);
                        return (
                          <label key={item} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleImmList('adult', item)}
                              className="h-3.5 w-3.5 rounded accent-emerald-600"
                            />
                            <span className={checked ? "text-emerald-700 font-extrabold" : "text-slate-655"}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* FOR PREGNANT */}
                  <div className="border p-3 rounded-2xl bg-slate-50/30 space-y-2 text-[10px]">
                    <span className="block font-black text-slate-700 uppercase text-[9px] border-b pb-1">For Pregnant:</span>
                    <div className="grid grid-cols-1 gap-1.5 pt-1.5 font-bold">
                      {["Tetanus Toxoid", "None"].map(item => {
                        const checked = consultDetails.immunizations.pregnant.includes(item);
                        return (
                          <label key={item} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleImmList('pregnant', item)}
                              className="h-3.5 w-3.5 rounded accent-emerald-600"
                            />
                            <span className={checked ? "text-emerald-700 font-extrabold" : "text-slate-655"}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* FOR ELDERLY & IMMUNOCOMPROMISED */}
                  <div className="border p-3 rounded-2xl bg-slate-50/30 space-y-2 text-[10px]">
                    <span className="block font-black text-slate-700 uppercase text-[9px] border-b pb-1">For Elderly & Immuno:</span>
                    <div className="grid grid-cols-1 gap-1.5 pt-1.5 font-bold">
                      {["Pneumococcal Vaccine", "Flu Vaccine", "None"].map(item => {
                        const checked = consultDetails.immunizations.elderly.includes(item);
                        return (
                          <label key={item} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleImmList('elderly', item)}
                              className="h-3.5 w-3.5 rounded accent-emerald-600"
                            />
                            <span className={checked ? "text-emerald-700 font-extrabold" : "text-slate-655"}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* OTHERS INDICATION */}
                <div className="border p-4 rounded-2xl bg-slate-50/10 text-[10px] font-bold">
                  <label className="block text-slate-700 mb-1 leading-none uppercase text-[8.5px]">Others (Please Specify):</label>
                  <input
                    type="text"
                    placeholder="Provide details on any other vaccines or clinical therapies received"
                    value={consultDetails.immunizations.othersSpecific}
                    onChange={(e) => setConsultDetails({
                      ...consultDetails,
                      immunizations: { ...consultDetails.immunizations, othersSpecific: e.target.value }
                    })}
                    className="w-full border rounded-xl p-2.5 bg-white text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* FAMILY PLANNING SECTION (Image 2) */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#1a365d] text-[11px] uppercase tracking-wider block font-serif">FAMILY PLANNING & REPRODUCTIVE HEALTH</span>
                  <div className="h-[1px] bg-slate-200 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT BLOCK: counselling & Menstrual history (cols-span-7) */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Access to Counselling */}
                    <div className="border p-4 rounded-3xl bg-slate-50/40 space-y-2 text-[10px] font-bold flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <span className="block font-black text-slate-800 uppercase text-[9px] leading-tight">Access to Family Planning Counselling?</span>
                        <p className="text-[8px] text-slate-400 font-medium leading-tight">Are reproductive health and counselling indicators accessible/active?</p>
                      </div>
                      <div className="flex gap-2">
                        {['Yes', 'No'].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setConsultDetails({
                              ...consultDetails,
                              familyPlanning: { accessCounselling: v as any }
                            })}
                            className={getBtnClass(consultDetails.familyPlanning.accessCounselling === v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Menstrual History Block */}
                    <div className="border p-4 rounded-3xl bg-white space-y-3">
                      <strong className="block text-slate-800 uppercase text-[9.5px] border-b pb-1 font-black">Menstrual Cycle History Log:</strong>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-bold">
                        <div>
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Menarche Age:</label>
                          <input type="text" placeholder="e.g. 13 yrs old" value={consultDetails.menstrualHistory.menarcheAge} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, menarcheAge: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Onset Sexual Intercourse Age:</label>
                          <input type="text" placeholder="e.g. 18 yrs old" value={consultDetails.menstrualHistory.onsetSexAge} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, onsetSexAge: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Last Menstrual Period (MM/DD/YY):</label>
                          <input type="text" placeholder="MM/DD/YYYY" value={consultDetails.menstrualHistory.lastPeriodDate} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, lastPeriodDate: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Birth Control Method Used:</label>
                          <input type="text" placeholder="e.g. Pills, Condom, IUD, None" value={consultDetails.menstrualHistory.birthControlMethod} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, birthControlMethod: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Period Duration (Days):</label>
                          <input type="text" placeholder="e.g. 5 days" value={consultDetails.menstrualHistory.durationDays} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, durationDays: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Interval Cycle (Days):</label>
                          <input type="text" placeholder="e.g. 28 days" value={consultDetails.menstrualHistory.intervalDays} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, intervalDays: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Nº of pads/day during menstruation:</label>
                          <input type="text" placeholder="e.g. 3 pads" value={consultDetails.menstrualHistory.padsPerDay} onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, padsPerDay: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                        </div>
                      </div>

                      {/* Menopause indicator */}
                      <div className="border p-3 rounded-2xl bg-slate-50/30 flex justify-between items-center text-[10px] font-bold mt-2 pt-2.5">
                        <div>
                          <span className="block text-slate-800 text-[8.5px] uppercase leading-none">Menopause Indicators:</span>
                          <span className="text-[7.5px] text-slate-400 font-medium font-mono leading-none">Applicable menopause status & onset age</span>
                        </div>
                        <div className="flex gap-2 items-center font-bold">
                          <div className="flex gap-1.5">
                            {['Yes', 'No'].map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setConsultDetails({
                                  ...consultDetails,
                                  menstrualHistory: { ...consultDetails.menstrualHistory, menopause: m as any, menopauseAge: m === 'No' ? '' : consultDetails.menstrualHistory.menopauseAge }
                                })}
                                className={getBtnClass(consultDetails.menstrualHistory.menopause === m)}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          {consultDetails.menstrualHistory.menopause === 'Yes' && (
                            <input
                              type="text"
                              placeholder="Age"
                              value={consultDetails.menstrualHistory.menopauseAge}
                              onChange={(e) => setConsultDetails({...consultDetails, menstrualHistory: {...consultDetails.menstrualHistory, menopauseAge: e.target.value}})}
                              className="w-14 border rounded-xl p-2 text-center bg-white outline-none"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT BLOCK: pregnancy/obstetric history (cols-span-5) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="border p-4 rounded-3xl bg-white space-y-3 h-full">
                      <div className="flex justify-between items-center border-b pb-1 font-bold">
                        <strong className="block text-slate-800 w-full uppercase text-[9.5px] font-black">Obstetric/Pregnancy History:</strong>
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {['Yes', 'No'].map(y => (
                            <button
                              key={y}
                              type="button"
                              onClick={() => setConsultDetails({
                                ...consultDetails,
                                pregnancyHistory: {
                                  ...consultDetails.pregnancyHistory,
                                  applicable: y as any
                                }
                              })}
                              className={getBtnClass(consultDetails.pregnancyHistory.applicable === y)}
                            >
                              {y === 'Yes' ? 'Active' : 'N/A'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {consultDetails.pregnancyHistory.applicable === 'Yes' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-bold">
                          <div>
                            <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Gravidity (no. of pregnancy):</label>
                            <input type="text" placeholder="G" value={consultDetails.pregnancyHistory.gravidity} onChange={(e) => setConsultDetails({...consultDetails, pregnancyHistory: {...consultDetails.pregnancyHistory, gravidity: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Parity (no. of delivery):</label>
                            <input type="text" placeholder="P" value={consultDetails.pregnancyHistory.parity} onChange={(e) => setConsultDetails({...consultDetails, pregnancyHistory: {...consultDetails.pregnancyHistory, parity: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Nº of Full Term:</label>
                            <input type="text" placeholder="FT" value={consultDetails.pregnancyHistory.fullTerm} onChange={(e) => setConsultDetails({...consultDetails, pregnancyHistory: {...consultDetails.pregnancyHistory, fullTerm: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Nº of Premature:</label>
                            <input type="text" placeholder="PT" value={consultDetails.pregnancyHistory.premature} onChange={(e) => setConsultDetails({...consultDetails, pregnancyHistory: {...consultDetails.pregnancyHistory, premature: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Nº of Abortion:</label>
                            <input type="text" placeholder="A" value={consultDetails.pregnancyHistory.abortion} onChange={(e) => setConsultDetails({...consultDetails, pregnancyHistory: {...consultDetails.pregnancyHistory, abortion: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 leading-none text-[8.5px]">Nº of Living Children:</label>
                            <input type="text" placeholder="L" value={consultDetails.pregnancyHistory.livingChildren} onChange={(e) => setConsultDetails({...consultDetails, pregnancyHistory: {...consultDetails.pregnancyHistory, livingChildren: e.target.value}})} className="w-full border rounded-xl p-2 bg-slate-50/50 outline-none" />
                          </div>
                          <div className="col-span-1 sm:col-span-2 border-t pt-2.5 space-y-1.5 font-bold">
                            <label className="block text-slate-600 leading-none text-[8px] uppercase">Primary Type of Delivery:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {['Normal', 'C-Section'].map(dt => (
                                <button
                                  key={dt}
                                  type="button"
                                  onClick={() => setConsultDetails({
                                    ...consultDetails,
                                    pregnancyHistory: {
                                      ...consultDetails.pregnancyHistory,
                                      deliveryType: dt as any
                                    }
                                  })}
                                  className={getBtnClass(consultDetails.pregnancyHistory.deliveryType === dt)}
                                >
                                  {dt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-56 flex flex-col items-center justify-center border border-dashed rounded-3xl bg-slate-50/40 text-center p-4">
                          <span className="font-bold text-slate-400 block text-[9.5px] uppercase font-serif">Obstetric History Disabled</span>
                          <span className="text-[8px] text-slate-400 mt-1 leading-tight">Select "Active" at the top-right of this card to activate obstetric fields.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sequencing controls */}
              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-extrabold uppercase text-[10.5px] tracking-wide"
                >
                  Enter Form Card Findings <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              PART 2: CLINICAL RECORD CARD VITAL SIGNS & SYSTEM FINDINGS WIZARD
              ========================================================================= */}
          {formStep === 1 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-6">
              
              <div>
                <h3 className="text-base font-bold text-slate-800">Physical Examinations & System findings (Image 3)</h3>
                <p className="text-slate-400">Fill exact medical vitals check and HEENT/Chest/Abdomen/Skin findings checklists.</p>
              </div>

              {/* vitals grid */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-550/5 text-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[10px] font-bold">
                  <div>
                    <label className="block text-slate-600 mb-1">Blood Pressure:</label>
                    <input type="text" placeholder="e.g. 120/80 mmHg" value={consultDetails.physicalExams.bloodPressure} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, bloodPressure: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Heart Rate (BPM):</label>
                    <input type="text" placeholder="e.g. 72 bpm" value={consultDetails.physicalExams.heartRate} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, heartRate: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Weight:</label>
                    <input type="text" placeholder="e.g. 68 kg" value={consultDetails.physicalExams.weightKg} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, weightKg: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Height:</label>
                    <input type="text" placeholder="e.g. 170 cm" value={consultDetails.physicalExams.heightCm} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, heightCm: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Respiratory Rate:</label>
                    <input type="text" placeholder="e.g. 18 /min" value={consultDetails.physicalExams.respRate} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, respRate: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">BMI Value:</label>
                    <input type="text" placeholder="e.g. 23.5 kg/m²" value={consultDetails.physicalExams.bmi} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, bmi: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Temperature (°C):</label>
                    <input type="text" placeholder="e.g. 36.5 °C" value={consultDetails.physicalExams.temp} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, temp: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Visual Acuity:</label>
                    <input type="text" placeholder="e.g. 20/20" value={consultDetails.physicalExams.visualAcuity} onChange={(e) => setConsultDetails({...consultDetails, physicalExams: {...consultDetails.physicalExams, visualAcuity: e.target.value}})} className="w-full border rounded-xl p-2 bg-white" />
                  </div>
                </div>
              </div>

              {/* Pertinent findings per clinical systems checklist checkboxes */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50 text-slate-705 space-y-4">
                <strong className="block text-xs font-black uppercase text-slate-800 border-b pb-1">Pertinent Findings per clinical systems checklist:</strong>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* HEENT CHECK */}
                  <div className="space-y-1.5 p-3.5 border bg-white rounded-2xl">
                    <span className="block font-bold text-slate-800 uppercase border-b pb-1 text-[10.5px]">Head, Eye, Ear, Nose, Throat (HEENT):</span>
                    <div className="flex flex-wrap gap-1.5 pt-1 font-semibold text-[9.5px]">
                      {['Essentially Normal', 'Abnormally pupillary reaction', 'Cervical Lymphadenopathy', 'Dry mucous membrane', 'Icteric sclera', 'Pale conjunctivae', 'Sunken eyeballs', 'Sunken fontanelle'].map(item => (
                        <button key={item} type="button" onClick={() => toggleFindingList('heent', item)} className={`px-2 py-1 rounded-xl border transition ${consultDetails.findingsPerSystem.heent.includes(item) ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50'}`}>{item}</button>
                      ))}
                    </div>
                  </div>

                  {/* CHEST CHECK */}
                  <div className="space-y-1.5 p-3.5 border bg-white rounded-2xl">
                    <span className="block font-bold text-slate-800 uppercase border-b pb-1 text-[10.5px]">Chest/Breast/Lungs:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1 font-semibold text-[9.5px]">
                      {['Essentially Normal', 'Asymmetrical chest expansion', 'Decreased breath sound', 'Wheezes', 'Lumps over breast (s)', 'Crackles/rales', 'Retractions'].map(item => (
                        <button key={item} type="button" onClick={() => toggleFindingList('chest', item)} className={`px-2 py-1 rounded-xl border transition ${consultDetails.findingsPerSystem.chest.includes(item) ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50'}`}>{item}</button>
                      ))}
                    </div>
                  </div>

                  {/* HEART CHECK */}
                  <div className="space-y-1.5 p-3.5 border bg-white rounded-2xl">
                    <span className="block font-bold text-slate-800 uppercase border-b pb-1 text-[10.5px]">Heart:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1 font-semibold text-[9.5px]">
                      {['Essentially Normal', 'Displaced Apex beat', 'Heaves/thrills', 'Irregular rhythm', 'Muffled heart sounds', 'Murmurs', 'Pericardial bilge'].map(item => (
                        <button key={item} type="button" onClick={() => toggleFindingList('heart', item)} className={`px-2 py-1 rounded-xl border transition ${consultDetails.findingsPerSystem.heart.includes(item) ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50'}`}>{item}</button>
                      ))}
                    </div>
                  </div>

                  {/* ABDOMEN CHECK */}
                  <div className="space-y-1.5 p-3.5 border bg-white rounded-2xl">
                    <span className="block font-bold text-slate-800 uppercase border-b pb-1 text-[10.5px]">Abdomen:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1 font-semibold text-[9.5px]">
                      {['Essentially Normal', 'Abdominal rigidity', 'Abdominal tenderness', 'Hyperactive bowel sounds', 'Palpable mass(es)', 'Tympatinic/dull abdomen', 'Uterine Contraction'].map(item => (
                        <button key={item} type="button" onClick={() => toggleFindingList('abdomen', item)} className={`px-2 py-1 rounded-xl border transition ${consultDetails.findingsPerSystem.abdomen.includes(item) ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50'}`}>{item}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CORE MEDICAL DIAGNOSES SPECIFIERS (Direct text fields for standard persistence schema in cPanel) */}
              <div className="space-y-4 pt-4 border-t border-slate-150">
                <strong className="block text-slate-800 uppercase text-xs font-black">Core Diagnosis & Therapeutic Treatments Plan (Required):</strong>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Primary Clinical Diagnosis:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hypertension Stage I, Acute Pharyngitis"
                      className="w-full border rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 outline-none text-slate-800 font-bold focus:border-red-500"
                      value={primaryDiagnosis}
                      onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Consultation & Form filing Date:</label>
                    <input
                      type="date"
                      required
                      className="w-full border rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 outline-none font-medium focus:border-red-500 font-mono"
                      value={consultDate}
                      onChange={(e) => setConsultDate(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-700 font-bold mb-1">Treatment Recommendation, Advice & Therapy Plan:</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Maintain low sodium diet, avoid greasy foods, return for review evaluation exam check on next month."
                      className="w-full border rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 outline-none font-medium focus:border-red-500 leading-normal"
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-700 font-bold mb-1">Prescribed Medical Prescription Tables & Medications:</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Amlodipine 5mg once daily tabs; Paracetamol 500mg as needed for pain reliever."
                      className="w-full border rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 outline-none font-medium focus:border-red-500 leading-normal"
                      value={prescribedMeds}
                      onChange={(e) => setPrescribedMeds(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Form saving controller buttons */}
              <div className="pt-4 flex justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormStep(0)}
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-705 px-4 py-2.5 rounded-xl font-bold"
                >
                  <ArrowLeft className="h-4 w-4" /> Go back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-wider shadow hover:shadow-red-500/20 active:scale-95 transition"
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent mr-1"></span>
                  ) : <Check className="h-4 w-4" />}
                  Submit and Save Consultation Record
                </button>
              </div>

            </div>
          )}

            </div>

            {patientName && (
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm sticky top-4 select-text">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 select-none">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                      <HeartPulse className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-extrabold text-xs uppercase text-slate-800 leading-none">Prior Medical History</h3>
                      <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider block pt-0.5">Consultation Ledger Index</p>
                    </div>
                  </div>

                  {getPatientHistory(patientName).length === 0 ? (
                    <div className="text-center py-10 px-4 border-2 border-dashed border-slate-100 rounded-2xl select-none">
                      <span className="text-[32px] block pb-2">🗂️</span>
                      <strong className="text-slate-700 block text-[10px] uppercase">First-time Case Patient</strong>
                      <p className="text-slate-450 text-[10px] mt-1 leading-normal">No prior electronic consultation records found for this patient in the master logs.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
                      {getPatientHistory(patientName).map((hRec, hIdx) => {
                        return (
                          <div key={hRec.id} className="p-3 border border-slate-150 rounded-2xl bg-slate-50/60 hover:bg-slate-50 transition duration-150 space-y-2 text-left">
                            <div className="flex justify-between items-center text-[9px] select-none font-mono">
                              <span className="font-bold text-slate-500 bg-white border px-1.5 py-0.5 rounded-lg">{hRec.date}</span>
                              <span className="text-indigo-650 font-black text-[8px] uppercase">CASE #{getPatientHistory(patientName).length - hIdx}</span>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-[7.5px] text-slate-400 font-extrabold uppercase leading-none block">DIAGNOSIS log:</span>
                              <strong className="text-[11px] text-slate-800 font-bold block leading-snug normal-case">{hRec.diagnosis}</strong>
                            </div>

                            {hRec.medications && (
                              <div className="space-y-0.5 border-t border-dashed border-slate-100 pt-1.5 mt-1">
                                <span className="text-[7.5px] text-slate-400 font-extrabold uppercase leading-none block">MEDICATIONS Rx:</span>
                                <p className="text-[10px] text-slate-600 font-mono leading-normal whitespace-pre-wrap normal-case">{hRec.medications}</p>
                              </div>
                            )}

                            {hRec.treatment && (
                              <div className="space-y-0.5 border-t border-dashed border-slate-100 pt-1.5 mt-1">
                                <span className="text-[7.5px] text-slate-400 font-extrabold uppercase leading-none block">TREATMENT PLAN:</span>
                                <p className="text-[9.5px] text-slate-655 font-mono leading-normal whitespace-pre-wrap normal-case">{hRec.treatment}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </form>
      )}

    </div>
  );
}
