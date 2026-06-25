import React, { useState, useEffect } from 'react';
import { 
  Home, Plus, Search, Grid, List, MapPin, CheckCircle, 
  XCircle, Trash2, Edit2, Bookmark, Folder, FileText, Activity, Eye, Lock,
  Users, Trash, RotateCcw, AlertTriangle, UploadCloud, Sparkles, Paperclip,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Heart, Stethoscope, Building, Scale,
  FolderPlus, FileHeart, UserPlus, HeartPulse
} from 'lucide-react';
import { Household, User, Barangay, Purok, hasRole, checkActionPermission } from '../types';
import SignaturePad from './SignaturePad';
import { PhilHealthLogo } from './PhilHealthLogo';
import { CacheSyncService, SFC_CACHE_SYNC_EVENT } from '../utils/cacheSync';

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

const BARANGAY_PUROKS_MAP: { [key: string]: string[] } = {
  'San Francisco': ['Purok Mangga', 'Purok Durian', 'Purok Santol'],
  'Santa Lucia': ['Purok Sampaguita', 'Purok Rosal'],
  'Tuburan': ['Purok Bougainvillea'],
  'Lumbia': ['Purok Mahogany', 'Purok Narra'],
  'Balangasan': ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5'],
  'SAN PEDRO': ['Purok Mangga', 'Purok Durian', 'Purok Santol']
};

interface HouseholdsProps {
  currentUser: User;
  initialDraftToEdit?: any;
  onClearActiveDraft?: () => void;
  connectionStatus?: 'online' | 'slow' | 'offline';
}

export default function Households({ 
  currentUser, 
  initialDraftToEdit, 
  onClearActiveDraft, 
  connectionStatus = 'online' 
}: HouseholdsProps) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [barangayList, setBarangayList] = useState<Barangay[]>([]);
  const [puroks, setPuroks] = useState<Purok[]>([]);
  
  // Controls
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedPurok, setSelectedPurok] = useState('');
  const [hhPage, setHhPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'a-z' | 'date-newest' | 'date-oldest'>('date-newest');
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [loading, setLoading] = useState(true);

  const isMasterAdmin = !!(currentUser?.email && ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email.toLowerCase()));

  // Detail Modal
  const [selectedHH, setSelectedHH] = useState<any>(null);
  const [activeTab, setActiveTab ] = useState<'details' | 'members' | 'dependents' | 'attachments' | 'health' | 'logs'>('details');
  const [expandedDependentId, setExpandedDependentId] = useState<string | null>(null);

  // Household editing state
  const [editingHH, setEditingHH] = useState<Household | null>(null);
  const [editHeadName, setEditHeadName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editPurok, setEditPurok] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editPmrf, setEditPmrf] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  const [editYakap, setEditYakap] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');

  // State for image viewer lightbox
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);
  const [complianceIndex, setComplianceIndex] = useState(75);

  // Custom High-Design Confirm Modal state
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

  // Concurrency session lock states
  const [clientId] = useState(() => Math.random().toString(36).substring(3) + Date.now().toString(36));
  const [lockedHHId, setLockedHHId] = useState<string | null>(null);
  const [lockWarningModal, setLockWarningModal] = useState<{ isOpen: boolean; lockedBy: { name: string; email: string } } | null>(null);

  // Add Step-by-Step Modal state
  const [showAddModal, setShowAddModal] = useState(!!initialDraftToEdit);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(initialDraftToEdit?.id || null);
  const [lastAutoSaved, setLastAutoSaved] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [pendingRecoveryDraft, setPendingRecoveryDraft] = useState<any | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Last Saved: Never');
  const [formHeadName, setFormHeadName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formBarangay, setFormBarangay] = useState(currentUser?.address || 'San Francisco');
  const [formPurok, setFormPurok] = useState('Purok Mangga');
  const [formLat, setFormLat] = useState('7.8284');
  const [formLng, setFormLng] = useState('123.4332');
  const [formPmrf, setFormPmrf] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  const [formYakap, setFormYakap] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  const [attachmentsList, setAttachmentsList] = useState<any[]>([]);
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [patientSignature, setPatientSignature] = useState<string | null>(null);
  const [sigType, setSigType] = useState<'draw' | 'thumb'>('draw');
  const [viewedFormTab, setViewedFormTab] = useState<'PMRF' | 'FPE' | 'PCSF'>('PMRF');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionLoadingMsg, setSubmissionLoadingMsg] = useState('Initiating secure packet transmission...');
  const [submissionLoadingTitle, setSubmissionLoadingTitle] = useState('Submitting Household File');
  
  // Custom states for wizard attachment categorization
  const [attachmentType, setAttachmentType] = useState<'Household File' | 'FPE/PCSF'>('Household File');
  const [attachmentOwnerName, setAttachmentOwnerName] = useState('');
  const [tempManualOwnerName, setTempManualOwnerName] = useState('');
  
  // Custom states for details drawer attachment uploads
  const [selectedDrawerAttachmentFile, setSelectedDrawerAttachmentFile] = useState<File | null>(null);
  const [drawerAttachmentType, setDrawerAttachmentType] = useState<'Household File' | 'FPE/PCSF'>('Household File');
  const [drawerAttachmentOwnerName, setDrawerAttachmentOwnerName] = useState('');
  const [drawerTempManualOwnerName, setDrawerTempManualOwnerName] = useState('');
  const [drawerUploadProgress, setDrawerUploadProgress] = useState<number | null>(null);
  
  // Active Form inside Add Modal
  const [activeFormTab, setActiveFormTab] = useState<'PMRF' | 'FPE' | 'PCSF'>(initialDraftToEdit && initialDraftToEdit.isFpePcsfOnly ? 'FPE' : 'PMRF');
  const [pmrfSubTab, setPmrfSubTab] = useState<'FRONT' | 'BACK'>('FRONT');
  const [showFormsDropdown, setShowFormsDropdown] = useState(false);
  const [isFpePcsfOnly, setIsFpePcsfOnly] = useState(initialDraftToEdit ? !!initialDraftToEdit.isFpePcsfOnly : false);
  const [isNewMemberFpe, setIsNewMemberFpe] = useState(initialDraftToEdit ? (!!initialDraftToEdit.isNewMemberFpe || !!initialDraftToEdit.formData?.isNewMemberFpe) : false);
  const [submittedNamesList, setSubmittedNamesList] = useState<any[]>([]);
  const [isDraftOnlyMode, setIsDraftOnlyMode] = useState(!!initialDraftToEdit);

  // Trigger draft restore on initialDraftToEdit prop changes
  useEffect(() => {
    if (initialDraftToEdit) {
      setIsFpePcsfOnly(initialDraftToEdit.isFpePcsfOnly || false);
      setIsNewMemberFpe(initialDraftToEdit.isNewMemberFpe || initialDraftToEdit.formData?.isNewMemberFpe || false);
      setDraftId(initialDraftToEdit.id);
      setIsDraftOnlyMode(true);
      restoreDraftData(initialDraftToEdit);
      setShowAddModal(true);
    }
  }, [initialDraftToEdit]);

  // Backwards synchronizer of draft clearing
  useEffect(() => {
    if (!showAddModal && onClearActiveDraft) {
      onClearActiveDraft();
    }
  }, [showAddModal, onClearActiveDraft]);

  // FPE - Chief Complaint
  const [fpeCcNone, setFpeCcNone] = useState(true);
  const [fpeCcFever, setFpeCcFever] = useState(false);
  const [fpeCcCough, setFpeCcCough] = useState(false);
  const [fpeCcBodyPain, setFpeCcBodyPain] = useState(false);
  const [fpeCcDyspnea, setFpeCcDyspnea] = useState(false);
  const [fpeCcOthers, setFpeCcOthers] = useState('');

  // FPE - Medical History
  const [fpeMhHypertension, setFpeMhHypertension] = useState(false);
  const [fpeMhDiabetes, setFpeMhDiabetes] = useState(false);
  const [fpeMhAstmaCopd, setFpeMhAstmaCopd] = useState(false);
  const [fpeMhHeart, setFpeMhHeart] = useState(false);
  const [fpeMhStroke, setFpeMhStroke] = useState(false);
  const [fpeMhCancer, setFpeMhCancer] = useState(false);
  const [fpeMhTb, setFpeMhTb] = useState(false);
  const [fpeMhKidney, setFpeMhKidney] = useState(false);
  const [fpeMhNone, setFpeMhNone] = useState(true);

  // FPE - Family History
  const [fpeFhHypertension, setFpeFhHypertension] = useState(false);
  const [fpeFhDiabetes, setFpeFhDiabetes] = useState(false);
  const [fpeFhHeart, setFpeFhHeart] = useState(false);
  const [fpeFhCancer, setFpeFhCancer] = useState(false);
  const [fpeFhNone, setFpeFhNone] = useState(true);

  // FPE - Social History
  const [fpeShSmoking, setFpeShSmoking] = useState<'Never' | 'Former' | 'Current'>('Never');
  const [fpeShAlcohol, setFpeShAlcohol] = useState<'None' | 'Occasional' | 'Regular'>('None');
  const [fpeShOccupation, setFpeShOccupation] = useState('');

  // FPE - Current Medications
  const [fpeMedNone, setFpeMedNone] = useState(true);
  const [fpeMedSpecify, setFpeMedSpecify] = useState('');

  // FPE - Vital signs
  const [fpeVitalBp, setFpeVitalBp] = useState('');
  const [fpeVitalWt, setFpeVitalWt] = useState('');
  const [fpeVitalHt, setFpeVitalHt] = useState('');
  const [fpeVitalHr, setFpeVitalHr] = useState('');
  const [fpeVitalRr, setFpeVitalRr] = useState('');
  const [fpeVitalBmi, setFpeVitalBmi] = useState('');
  const [fpeVitalTemp, setFpeVitalTemp] = useState('');
  const [fpeVitalWaist, setFpeVitalWaist] = useState('');
  const [fpeVitalUpperArm, setFpeVitalUpperArm] = useState('');
  const [fpeVitalMidArm, setFpeVitalMidArm] = useState('');

  // FPE - PE and Assessment
  const [fpePhysicalExam, setFpePhysicalExam] = useState('');
  const [fpeAssessmentPlan, setFpeAssessmentPlan] = useState('');

  // PCSF - Fields
  const [pcsfType, setPcsfType] = useState<'MEMBER' | 'DEPENDENT'>('MEMBER');
  const [pcsfDate, setPcsfDate] = useState('');
  const [pcsfFullName, setPcsfFullName] = useState('');
  const [selectedDependentAge, setSelectedDependentAge] = useState<number | null>(null);
  const [fpeHouseholdHead, setFpeHouseholdHead] = useState('');
  const [fpeAddress, setFpeAddress] = useState('');
  const [fpeAddressManuallyEdited, setFpeAddressManuallyEdited] = useState(false);

  // FPE - Vital signs required conditions
  const isFpePartiallyFilled = !!(
    fpeVitalBp.trim() || fpeVitalWt.trim() || fpeVitalHt.trim() ||
    fpeVitalHr.trim() || fpeVitalRr.trim() || fpeVitalTemp.trim() ||
    fpeVitalWaist.trim() || fpeVitalUpperArm.trim() || fpeVitalMidArm.trim() ||
    fpePhysicalExam.trim() || fpeAssessmentPlan.trim() || fpeMedSpecify.trim() ||
    fpeCcOthers.trim() || 
    fpeCcFever || fpeCcCough || fpeCcBodyPain || fpeCcDyspnea ||
    fpeMhHypertension || fpeMhDiabetes || fpeMhAstmaCopd || fpeMhHeart || fpeMhStroke || fpeMhCancer || fpeMhTb || fpeMhKidney ||
    fpeFhHypertension || fpeFhDiabetes || fpeFhHeart || fpeFhCancer ||
    fpeShSmoking || fpeShAlcohol || fpeShOccupation
  );

  const isFpeVitalsInvalid = (isFpePcsfOnly || isFpePartiallyFilled) && (
    !fpeVitalTemp.trim() || !fpeVitalHr.trim() || !fpeVitalRr.trim() || !fpeAddress.trim()
  );
  const [fullNameSearchFocused, setFullNameSearchFocused] = useState(false);
  const [pcsfHouseholdNumber, setPcsfHouseholdNumber] = useState('');
  const [pcsfHouseholdId, setPcsfHouseholdId] = useState('');
  const [pcsfDependentId, setPcsfDependentId] = useState('');
  const [pcsfMemberCategory, setPcsfMemberCategory] = useState('');
  const [fpeSearchLoading, setFpeSearchLoading] = useState(false);
  const [fpeFocusedIndex, setFpeFocusedIndex] = useState(-1);
  const [pcsfAddressBarangay, setPcsfAddressBarangay] = useState('');
  const [pcsfAddressCity, setPcsfAddressCity] = useState('');
  const [pcsfAddressProvince, setPcsfAddressProvince] = useState('');
  const [pcsfContactNo, setPcsfContactNo] = useState('');
  const [pcsfEmail, setPcsfEmail] = useState('');
  const [pcsfRegisterPcc, setPcsfRegisterPcc] = useState(true);
  const [pcsfRegisterDependents, setPcsfRegisterDependents] = useState(false);
  
  const [pcsfPcc1, setPcsfPcc1] = useState('Saint Francis Clinic');
  const [pcsfPcc1Addr, setPcsfPcc1Addr] = useState('San Francisco, Pagadian City, Zamboanga del Sur');
  const [pcsfPcc2, setPcsfPcc2] = useState('');
  const [pcsfPcc2Addr, setPcsfPcc2Addr] = useState('');

  const [pcsfTransfer, setPcsfTransfer] = useState(false);
  const [pcsfPrevPcc, setPcsfPrevPcc] = useState('');
  const [pcsfTransferPcc1, setPcsfTransferPcc1] = useState('');
  const [pcsfTransferPcc1Addr, setPcsfTransferPcc1Addr] = useState('');
  const [pcsfTransferPcc2, setPcsfTransferPcc2] = useState('');
  const [pcsfTransferPcc2Addr, setPcsfTransferPcc2Addr] = useState('');

  // PhilHealth PMRF Form specific hooks
  const [pmrfPurpose, setPmrfPurpose] = useState<'REGISTRATION' | 'UPDATING'>('REGISTRATION');
  const [pmrfKonsulta, setPmrfKonsulta] = useState('Saint Francis Clinic Provider');
  const [pmrfPin, setPmrfPin] = useState('');
  const [pmrfLastName, setPmrfLastName] = useState('');
  const [pmrfFirstName, setPmrfFirstName] = useState('');
  const [pmrfNameExt, setPmrfNameExt] = useState('');
  const [pmrfMiddleName, setPmrfMiddleName] = useState('');
  const [pmrfMotherMaiden, setPmrfMotherMaiden] = useState('');
  const [pmrfSpouseName, setPmrfSpouseName] = useState('');
  
  // Split helper state variables for PMRF Front Form and paper replication
  const [pmrfMotherLastName, setPmrfMotherLastName] = useState('');
  const [pmrfMotherFirstName, setPmrfMotherFirstName] = useState('');
  const [pmrfMotherNameExt, setPmrfMotherNameExt] = useState('');
  const [pmrfMotherMiddleName, setPmrfMotherMiddleName] = useState('');
  const [pmrfMotherNoMiddleName, setPmrfMotherNoMiddleName] = useState(false);
  const [pmrfMotherMononym, setPmrfMotherMononym] = useState(false);

  const [pmrfSpouseLastName, setPmrfSpouseLastName] = useState('');
  const [pmrfSpouseFirstName, setPmrfSpouseFirstName] = useState('');
  const [pmrfSpouseNameExt, setPmrfSpouseNameExt] = useState('');
  const [pmrfSpouseMiddleName, setPmrfSpouseMiddleName] = useState('');
  const [pmrfSpouseNoMiddleName, setPmrfSpouseNoMiddleName] = useState(false);
  const [pmrfSpouseMononym, setPmrfSpouseMononym] = useState(false);

  const [pmrfMemberNoMiddleName, setPmrfMemberNoMiddleName] = useState(false);
  const [pmrfMemberMononym, setPmrfMemberMononym] = useState(false);

  // Mobile responsive PMRF state variables
  const [pmrfSearchQuery, setPmrfSearchQuery] = useState('');
  const pmrfSearchResults = pmrfSearchQuery.trim() === "" ? [] : submittedNamesList.filter(person => {
    const q = pmrfSearchQuery.toUpperCase();
    const name = (person.fullName || `${person.lastName || ""} ${person.firstName || ""}`).toUpperCase();
    const pin = (person.pin || person.pmrfDetails?.pin || "").toUpperCase();
    return name.includes(q) || pin.includes(q);
  });
  const [showAutoFillConfirmation, setShowAutoFillConfirmation] = useState(false);
  const [matchedAutoFillPerson, setMatchedAutoFillPerson] = useState<any | null>(null);
  const [collapsedMobileSecs, setCollapsedMobileSecs] = useState<{ [key: string]: boolean }>({
    reminders: true,
    personal: true,
    spouse: false,
    mother: false,
    address: false,
    dependents: false,
    contributor: false,
  });

  // Synchronized effect to manage household active session editing/viewing lock
  useEffect(() => {
    if (!lockedHHId) return;

    const interval = setInterval(async () => {
      try {
        await fetch(`/api/households/${lockedHHId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, clientId })
        });
      } catch (e) {
        console.error("Lock heartbeat failed:", e);
      }
    }, 15000); // Heartbeat every 15s

    return () => {
      clearInterval(interval);
      // Automatically send unlock request on close/unmount
      fetch(`/api/households/${lockedHHId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, clientId })
      }).catch(e => console.error("Unlock error:", e));
    };
  }, [lockedHHId]);

  // Sync lockedHHId with active modals/panels
  useEffect(() => {
    if (!selectedHH && !editingHH) {
      setLockedHHId(null);
    }
  }, [selectedHH, editingHH]);

  // Sync formBarangay to currentUser address on load, only if not editing (Leader/non-admin synchronization)
  useEffect(() => {
    if (!editingHH && currentUser?.address) {
      setFormBarangay(currentUser.address);
      setPmrfAddressBarangay(currentUser.address.toUpperCase());
    }
  }, [currentUser, editingHH]);

  // Sync effects for Mother, Spouse, and Member names
  useEffect(() => {
    if (pmrfMotherNoMiddleName) {
      setPmrfMotherMiddleName('');
    }
  }, [pmrfMotherNoMiddleName]);

  useEffect(() => {
    if (pmrfSpouseNoMiddleName) {
      setPmrfSpouseMiddleName('');
    }
  }, [pmrfSpouseNoMiddleName]);

  useEffect(() => {
    if (pmrfMemberNoMiddleName) {
      setPmrfMiddleName('');
    }
  }, [pmrfMemberNoMiddleName]);

  useEffect(() => {
    const partsM = [];
    if (pmrfMotherLastName) partsM.push(pmrfMotherLastName);
    if (pmrfMotherFirstName) partsM.push(pmrfMotherFirstName);
    if (pmrfMotherMiddleName) partsM.push(pmrfMotherMiddleName);
    if (pmrfMotherNameExt) partsM.push(pmrfMotherNameExt);
    setPmrfMotherMaiden(partsM.join(', '));
  }, [pmrfMotherLastName, pmrfMotherFirstName, pmrfMotherMiddleName, pmrfMotherNameExt]);

  useEffect(() => {
    const partsS = [];
    if (pmrfSpouseLastName) partsS.push(pmrfSpouseLastName);
    if (pmrfSpouseFirstName) partsS.push(pmrfSpouseFirstName);
    if (pmrfSpouseMiddleName) partsS.push(pmrfSpouseMiddleName);
    if (pmrfSpouseNameExt) partsS.push(pmrfSpouseNameExt);
    setPmrfSpouseName(partsS.join(', '));
  }, [pmrfSpouseLastName, pmrfSpouseFirstName, pmrfSpouseMiddleName, pmrfSpouseNameExt]);

  // Automatic BMI Calculation based on Weight and Height
  useEffect(() => {
    const weight = parseFloat(fpeVitalWt);
    const height = parseFloat(fpeVitalHt);
    if (!isNaN(weight) && !isNaN(height) && height > 0) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      setFpeVitalBmi(bmi.toFixed(2));
    } else {
      setFpeVitalBmi('');
    }
  }, [fpeVitalWt, fpeVitalHt]);

  // Real-time PMRF Validation and Progress calculation helpers
  const getPmrfValidationErrors = () => {
    const errors: { [key: string]: string } = {};
    if (!pmrfLastName.trim()) errors.lastName = "Last Name is required";
    if (!pmrfFirstName.trim()) errors.firstName = "First Name is required";
    if (!pmrfBirthDate) errors.birthDate = "Birth Date is required";
    if (!pmrfAddressSubdivision.trim()) errors.addressSubdivision = "Subdivision (Purok) is required";
    if (!pmrfAddressBarangay.trim()) errors.addressBarangay = "Barangay is required";
    
    if (pmrfPin) {
      const cleanPin = pmrfPin.replace(/-/g, '').trim();
      if (cleanPin.length > 0 && cleanPin.length !== 12) {
        errors.pin = "PhilHealth PIN must be exactly 12 digits";
      } else if (cleanPin.length === 12 && isNaN(Number(cleanPin))) {
        errors.pin = "PhilHealth PIN must contain numbers only";
      }
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (pmrfEmail && !emailRegex.test(pmrfEmail)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (pmrfMobileNo) {
      const mobileClean = pmrfMobileNo.replace(/\D/g, '');
      if (mobileClean.length > 0 && (mobileClean.length < 10 || mobileClean.length > 11)) {
        errors.mobile = "Mobile number should be 10 or 11 digits (e.g. 09XXXXXXXXX)";
      }
    }

    return errors;
  };

  const getPmrfCompletionPercentage = () => {
    const fields = [
      { name: 'Last Name', isFilled: !!pmrfLastName.trim() },
      { name: 'First Name', isFilled: !!pmrfFirstName.trim() },
      { name: 'Birth Date', isFilled: !!pmrfBirthDate },
      { name: 'Sex', isFilled: !!pmrfSex },
      { name: 'Civil Status', isFilled: !!pmrfCivilStatus },
      { name: 'Barangay', isFilled: !!pmrfAddressBarangay.trim() },
      { name: 'Municipality', isFilled: !!pmrfAddressMunicipality.trim() },
      { name: 'Province', isFilled: !!pmrfAddressProvince.trim() },
      { name: 'Member Category', isFilled: !!pmrfContributorCategory },
    ];
    const filled = fields.filter(f => f.isFilled).length;
    return Math.round((filled / fields.length) * 100);
  };

  const handleAutoFillPerson = (person: any) => {
    if (!person) return;
    setMatchedAutoFillPerson(person);
    setShowAutoFillConfirmation(true);
  };

  const confirmAutoFill = () => {
    if (!matchedAutoFillPerson) return;
    const p = matchedAutoFillPerson;
    
    if (p.lastName) setPmrfLastName(p.lastName.toUpperCase());
    if (p.firstName) setPmrfFirstName(p.firstName.toUpperCase());
    if (p.middleName) setPmrfMiddleName(p.middleName.toUpperCase());
    if (p.nameExt) setPmrfNameExt(p.nameExt.toUpperCase());
    if (p.noMiddleName !== undefined) setPmrfMemberNoMiddleName(!!p.noMiddleName);
    if (p.mononym !== undefined) setPmrfMemberMononym(!!p.mononym);
    
    // Auto-fill Birth Date
    if (p.birthdate) {
      setPmrfBirthDate(p.birthdate.split('T')[0]);
    } else if (p.birthDate) {
      setPmrfBirthDate(p.birthDate.split('T')[0]);
    }
    
    // Auto-fill Gender
    if (p.gender) {
      const g = p.gender.toUpperCase();
      if (g.startsWith('M')) setPmrfSex('Male');
      else if (g.startsWith('F')) setPmrfSex('Female');
    } else if (p.sex) {
      const s = p.sex.toUpperCase();
      if (s.startsWith('M')) setPmrfSex('Male');
      else if (s.startsWith('F')) setPmrfSex('Female');
    }
    
    // Auto-fill Civil Status
    if (p.civilStatus) {
      const cs = p.civilStatus.toLowerCase();
      if (cs === 'single') setPmrfCivilStatus('Single');
      else if (cs === 'married') setPmrfCivilStatus('Married');
      else if (cs === 'widowed') setPmrfCivilStatus('Widowed');
      else if (cs === 'annulled') setPmrfCivilStatus('Annulled');
      else if (cs.includes('separated')) setPmrfCivilStatus('Legally Separated');
    }

    // Auto-fill Contact Info
    if (p.contactNo) setPmrfMobileNo(p.contactNo);
    else if (p.contactNumber) setPmrfMobileNo(p.contactNumber);
    else if (p.mobileNo) setPmrfMobileNo(p.mobileNo);

    if (p.email) setPmrfEmail(p.email);

    // Auto-fill PIN
    if (p.pin) setPmrfPin(p.pin);
    else if (p.pmrfDetails?.pin) setPmrfPin(p.pmrfDetails.pin);
    else if (p.pmrfDetails?.pmrfPin) setPmrfPin(p.pmrfDetails.pmrfPin);

    // Auto-fill Address
    if (p.barangay) setPmrfAddressBarangay(p.barangay.toUpperCase());
    if (p.street) setPmrfAddressStreet(p.street.toUpperCase());
    if (p.purok) setPmrfAddressSubdivision(p.purok.toUpperCase());

    // Trigger success notification
    setAlertModal({
      isOpen: true,
      title: "Smart Auto-Fill Applied",
      description: `Successfully imported registration details for ${p.fullName || (p.firstName + ' ' + p.lastName)}. All matching PMRF sections have been pre-populated!`,
      type: "success"
    });

    setPmrfSearchQuery('');
    setMatchedAutoFillPerson(null);
    setShowAutoFillConfirmation(false);
  };

  const [pmrfBirthDate, setPmrfBirthDate ] = useState('');
  const [pmrfBirthPlace, setPmrfBirthPlace] = useState('Pagadian City, Zamboanga del Sur');
  const [pmrfSex, setPmrfSex] = useState<'Male' | 'Female'>('Male');
  const [pmrfCivilStatus, setPmrfCivilStatus] = useState<'Single' | 'Married' | 'Annulled' | 'Widowed' | 'Legally Separated'>('Single');
  const [pmrfCitizenship, setPmrfCitizenship] = useState<'FILIPINO' | 'FOREIGN' | 'DUAL'>('FILIPINO');
  const [pmrfPhilsysNo, setPmrfPhilsysNo] = useState('');
  const [pmrfTin, setPmrfTin] = useState('');

  // PMRF Back specific state hooks
  const [pmrfBackChangeName, setPmrfBackChangeName] = useState(false);
  const [pmrfBackChangeDOB, setPmrfBackChangeDOB] = useState(false);
  const [pmrfBackChangeSex, setPmrfBackChangeSex] = useState(false);
  const [pmrfBackChangeCivilStatus, setPmrfBackChangeCivilStatus] = useState(false);
  const [pmrfBackChangePersonalInfo, setPmrfBackChangePersonalInfo] = useState(false);

  const [pmrfBackFromValueName, setPmrfBackFromValueName] = useState('');
  const [pmrfBackToValueName, setPmrfBackToValueName] = useState('');
  const [pmrfBackFromValueDOB, setPmrfBackFromValueDOB] = useState('');
  const [pmrfBackToValueDOB, setPmrfBackToValueDOB] = useState('');
  const [pmrfBackFromValueSex, setPmrfBackFromValueSex] = useState('');
  const [pmrfBackToValueSex, setPmrfBackToValueSex] = useState('');
  const [pmrfBackFromValueCivil, setPmrfBackFromValueCivil] = useState('');
  const [pmrfBackToValueCivil, setPmrfBackToValueCivil] = useState('');
  const [pmrfBackFromValueInfo, setPmrfBackFromValueInfo] = useState('');
  const [pmrfBackToValueInfo, setPmrfBackToValueInfo] = useState('');

  const [pmrfBackSignature, setPmrfBackSignature] = useState<string | null>(null);
  const [pmrfBackSignatureDate, setPmrfBackSignatureDate] = useState(new Date().toISOString().split('T')[0]);
  const [pmrfBackThumbmark, setPmrfBackThumbmark] = useState<string | null>(null);
  const [pmrfBackSameAsFront, setPmrfBackSameAsFront] = useState(true);

  const [pmrfBackReceivedByFullName, setPmrfBackReceivedByFullName] = useState(currentUser?.fullName || '');
  const [pmrfBackReceivedByBranch, setPmrfBackReceivedByBranch] = useState('PAGADIAN BRANCH');
  const [pmrfBackReceivedByDateTime, setPmrfBackReceivedByDateTime] = useState(new Date().toISOString().substring(0, 16));

  // Permanent Address specifics
  const [pmrfAddressUnit, setPmrfAddressUnit] = useState('');
  const [pmrfAddressStreet, setPmrfAddressStreet] = useState('');
  const [pmrfAddressSubdivision, setPmrfAddressSubdivision] = useState('');
  const [pmrfAddressZip, setPmrfAddressZip] = useState('7016');
  const [pmrfAddressUnitNoFloor, setPmrfAddressUnitNoFloor] = useState('');
  const [pmrfAddressBuildingName, setPmrfAddressBuildingName] = useState('');
  const [pmrfAddressBarangay, setPmrfAddressBarangay] = useState('SAN PEDRO');
  const [pmrfAddressMunicipality, setPmrfAddressMunicipality] = useState('PAGADIAN CITY');
  const [pmrfAddressProvince, setPmrfAddressProvince] = useState('ZAMBOANGA DEL SUR');

  // Mailing Address specifics
  const [pmrfMailSame, setPmrfMailSame] = useState(true);
  const [pmrfMailUnit, setPmrfMailUnit] = useState('');
  const [pmrfMailStreet, setPmrfMailStreet] = useState('');
  const [pmrfMailSubdivision, setPmrfMailSubdivision] = useState('');
  const [pmrfMailZip, setPmrfMailZip] = useState('7016');
  const [pmrfMailUnitNoFloor, setPmrfMailUnitNoFloor] = useState('');
  const [pmrfMailBuildingName, setPmrfMailBuildingName] = useState('');
  const [pmrfMailBarangay, setPmrfMailBarangay] = useState('SAN PEDRO');
  const [pmrfMailMunicipality, setPmrfMailMunicipality] = useState('PAGADIAN CITY');
  const [pmrfMailProvince, setPmrfMailProvince] = useState('ZAMBOANGA DEL SUR');

  // Phone and details
  const [pmrfHomePhone, setPmrfHomePhone] = useState('');
  const [pmrfMobileNo, setPmrfMobileNo] = useState('');
  const [pmrfBusinessDirect, setPmrfBusinessDirect] = useState('');
  const [pmrfEmail, setPmrfEmail] = useState('');

  // Dropdown visibility states for PMRF/FPE Residential Address
  const [showFpePurokDropdown, setShowFpePurokDropdown] = useState(false);
  const [showFpeBarangayDropdown, setShowFpeBarangayDropdown] = useState(false);

// Auto-fill and synchronization effects

  // Automatically fetch Residential Address in FPE from PMRF Form address details: Subdivision (Purok), Barangay, Municipality/City
  useEffect(() => {
    if (fpeAddressManuallyEdited) return;

    const parts = [];
    if (pmrfAddressSubdivision.trim()) {
      parts.push(pmrfAddressSubdivision.trim());
    }
    if (pmrfAddressBarangay.trim()) {
      parts.push(pmrfAddressBarangay.trim());
    }
    if (pmrfAddressMunicipality.trim()) {
      parts.push(pmrfAddressMunicipality.trim());
    }
    const constructed = parts.join(', ');

    if (constructed !== fpeAddress) {
      setFpeAddress(constructed);
    }
  }, [pmrfAddressSubdivision, pmrfAddressBarangay, pmrfAddressMunicipality, fpeAddress, fpeAddressManuallyEdited]);

  // Synchronize name fields to pcsfFullName and fpeHouseholdHead automatically in isNewMemberFpe mode
  useEffect(() => {
    if (isNewMemberFpe) {
      const parts = [];
      if (pmrfLastName.trim()) {
        parts.push(pmrfLastName.trim());
      }
      const firstAndExt = [];
      if (pmrfFirstName.trim()) {
        firstAndExt.push(pmrfFirstName.trim());
      }
      if (pmrfNameExt.trim()) {
        firstAndExt.push(pmrfNameExt.trim());
      }
      
      let compiled = '';
      if (parts.length > 0) {
        compiled = parts[0] + (firstAndExt.length > 0 ? ', ' + firstAndExt.join(' ') : '');
      } else if (firstAndExt.length > 0) {
        compiled = firstAndExt.join(' ');
      }

      if (compiled.trim()) {
        const finalName = compiled.trim();
        if (pcsfFullName !== finalName) {
          setPcsfFullName(finalName);
        }
        if (fpeHouseholdHead !== finalName) {
          setFpeHouseholdHead(finalName);
        }
      }
    }
  }, [pmrfLastName, pmrfFirstName, pmrfNameExt, isNewMemberFpe, pcsfFullName, fpeHouseholdHead]);

  useEffect(() => {
    if (pmrfMailSame) {
      setPmrfMailUnitNoFloor(pmrfAddressUnitNoFloor);
      setPmrfMailBuildingName(pmrfAddressBuildingName);
      setPmrfMailUnit(pmrfAddressUnit);
      setPmrfMailStreet(pmrfAddressStreet);
      setPmrfMailSubdivision(pmrfAddressSubdivision);
      setPmrfMailBarangay(pmrfAddressBarangay);
      setPmrfMailMunicipality(pmrfAddressMunicipality);
      setPmrfMailProvince(pmrfAddressProvince);
      setPmrfMailZip(pmrfAddressZip);
    }
  }, [
    pmrfMailSame,
    pmrfAddressUnitNoFloor,
    pmrfAddressBuildingName,
    pmrfAddressUnit,
    pmrfAddressStreet,
    pmrfAddressSubdivision,
    pmrfAddressBarangay,
    pmrfAddressMunicipality,
    pmrfAddressProvince,
    pmrfAddressZip
  ]);

  // Contributor Types
  const [pmrfContributorCategory, setPmrfContributorCategory] = useState<'DIRECT' | 'INDIRECT'>('DIRECT');
  const [pmrfContributorType, setPmrfContributorType] = useState('Employed Private');
  const [pmrfGroupSchemeName, setPmrfGroupSchemeName] = useState('');
  const [pmrfPraSrrvNo, setPmrfPraSrrvNo] = useState('');
  const [pmrfAcrICardNo, setPmrfAcrICardNo] = useState('');
  const [pmrfPwdIdNo, setPmrfPwdIdNo] = useState('');
  const [pmrfProfession, setPmrfProfession] = useState('Farmer');
  const [pmrfMonthlyIncome, setPmrfMonthlyIncome] = useState('');
  const [pmrfProofOfIncome, setPmrfProofOfIncome] = useState('');

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setEditingHH(null);
    setDraftId(null);
    setIsDraftOnlyMode(false);
    resetPMRFStates();
    if (onClearActiveDraft) {
      onClearActiveDraft();
    }
  };

  const resetPMRFStates = () => {
    setPmrfPurpose('REGISTRATION');
    setPmrfKonsulta('Saint Francis Clinic Provider');
    setPmrfPin('');
    setPmrfLastName('');
    setPmrfFirstName('');
    setPmrfNameExt('');
    setPmrfMiddleName('');
    setPmrfMotherMaiden('');
    setPmrfSpouseName('');
    setPmrfMotherLastName('');
    setPmrfMotherFirstName('');
    setPmrfMotherNameExt('');
    setPmrfMotherMiddleName('');
    setPmrfMotherNoMiddleName(false);
    setPmrfMotherMononym(false);
    setPmrfSpouseLastName('');
    setPmrfSpouseFirstName('');
    setPmrfSpouseNameExt('');
    setPmrfSpouseMiddleName('');
    setPmrfSpouseNoMiddleName(false);
    setPmrfSpouseMononym(false);
    setPmrfMemberNoMiddleName(false);
    setPmrfMemberMononym(false);
    setPmrfBirthDate('');
    setPmrfBirthPlace('Pagadian City, Zamboanga del Sur');
    setPmrfSex('Male');
    setPmrfCivilStatus('Single');
    setPmrfCitizenship('FILIPINO');
    setPmrfPhilsysNo('');
    setPmrfTin('');
    setPmrfAddressUnit('');
    setPmrfAddressStreet('');
    setPmrfAddressSubdivision((formPurok || '').toUpperCase());
    setPmrfAddressBarangay((formBarangay || '').toUpperCase());
    setPmrfAddressZip('7016');
    setPmrfMailSame(true);
    setPmrfMailUnit('');
    setPmrfMailStreet('');
    setPmrfMailSubdivision((formPurok || '').toUpperCase());
    setPmrfMailBarangay((formBarangay || '').toUpperCase());
    setPmrfMailZip('7016');
    setPmrfHomePhone('');
    setPmrfMobileNo('');
    setPmrfBusinessDirect('');
    setPmrfEmail('');
    setPmrfContributorCategory('DIRECT');
    setPmrfContributorType('Employed Private');
    setPmrfGroupSchemeName('');
    setPmrfPraSrrvNo('');
    setPmrfAcrICardNo('');
    setPmrfPwdIdNo('');
    setPmrfProfession('Farmer');
    setPmrfMonthlyIncome('');
    setPmrfProofOfIncome('');

    // Reset PMRF Back states
    setPmrfBackChangeName(false);
    setPmrfBackChangeDOB(false);
    setPmrfBackChangeSex(false);
    setPmrfBackChangeCivilStatus(false);
    setPmrfBackChangePersonalInfo(false);
    setPmrfBackFromValueName('');
    setPmrfBackToValueName('');
    setPmrfBackFromValueDOB('');
    setPmrfBackToValueDOB('');
    setPmrfBackFromValueSex('');
    setPmrfBackToValueSex('');
    setPmrfBackFromValueCivil('');
    setPmrfBackToValueCivil('');
    setPmrfBackFromValueInfo('');
    setPmrfBackToValueInfo('');
    setPmrfBackSignature(null);
    setPmrfBackSignatureDate(new Date().toISOString().split('T')[0]);
    setPmrfBackThumbmark(null);
    setPmrfBackSameAsFront(true);
    setPmrfBackReceivedByFullName(currentUser?.fullName || '');
    setPmrfBackReceivedByBranch('PAGADIAN BRANCH');
    setPmrfBackReceivedByDateTime(new Date().toISOString().substring(0, 16));
    setFormHeadName('');
    setFormContact('');
    setFormPmrf('Willing');
    setFormYakap('Willing');
    setWizardMembers([]);
    setWizardDependents([]);
    setDepLastName('');
    setDepFirstName('');
    setDepMiddleName('');
    setDepNameExt('');
    setDepNoMN(false);
    setDepMononym(false);
    setDepCitizenship('FILIPINO');
    setDepIsDisabled(false);
    setDepBirthDate('');
    setDepRelation('Child');
    setDepSex('Female');
    setDepCivilStatus('Single');
    setHasNewDependentName('');
    setHasNewDependentAge('5');
    setHasNewDependentRelation('Child');
    setHasNewDependentBirthDate('');
    setHasNewDependentGender('Female');
    setHasNewDependentCivilStatus('Single');
    setAttachmentsList([]);
    setPatientSignature(null);
    setSigType('draw');
    
    // Reset FPE & PCSF states
    setActiveFormTab('PMRF');
    setFpeCcNone(true);
    setFpeCcFever(false);
    setFpeCcCough(false);
    setFpeCcBodyPain(false);
    setFpeCcDyspnea(false);
    setFpeCcOthers('');
    setFpeMhHypertension(false);
    setFpeMhDiabetes(false);
    setFpeMhAstmaCopd(false);
    setFpeMhHeart(false);
    setFpeMhStroke(false);
    setFpeMhCancer(false);
    setFpeMhTb(false);
    setFpeMhKidney(false);
    setFpeMhNone(true);
    setFpeFhHypertension(false);
    setFpeFhDiabetes(false);
    setFpeFhHeart(false);
    setFpeFhCancer(false);
    setFpeFhNone(true);
    setFpeShSmoking('Never');
    setFpeShAlcohol('None');
    setFpeShOccupation('');
    setFpeMedNone(true);
    setFpeMedSpecify('');
    setFpeVitalBp('');
    setFpeVitalWt('');
    setFpeVitalHt('');
    setFpeVitalHr('');
    setFpeVitalRr('');
    setFpeVitalBmi('');
    setFpeVitalTemp('');
    setFpeVitalWaist('');
    setFpeVitalUpperArm('');
    setFpeVitalMidArm('');
    setFpePhysicalExam('');
    setFpeAssessmentPlan('');
    setPcsfType('MEMBER');
    setPcsfDate('');
    setPcsfFullName('');
    setPcsfHouseholdNumber('');
    setPcsfHouseholdId('');
    setPcsfDependentId('');
    setSelectedDependentAge(null);
    setPcsfMemberCategory('');
    setFpeSearchLoading(false);
    setFpeFocusedIndex(-1);
    setFpeAddress('');
    setFpeAddressManuallyEdited(false);
    setPcsfAddressBarangay('');
    setPcsfAddressCity('');
    setPcsfAddressProvince('');
    setPcsfContactNo('');
    setPcsfEmail('');
    setPcsfRegisterPcc(true);
    setPcsfRegisterDependents(false);
    setPcsfPcc1('Saint Francis Clinic');
    setPcsfPcc1Addr('San Francisco, Pagadian City, Zamboanga del Sur');
    setPcsfPcc2('');
    setPcsfPcc2Addr('');
    setPcsfTransfer(false);
    setPcsfPrevPcc('');
    setPcsfTransferPcc1('');
    setPcsfTransferPcc1Addr('');
    setPcsfTransferPcc2('');
    setPcsfTransferPcc2Addr('');
    setIsNewMemberFpe(false);
    localStorage.removeItem('saint_francis_household_form_draft');
    setDraftId(null);
    setLastAutoSaved(null);
  };

  const restoreDraftData = (rawDraft: any) => {
    if (!rawDraft) return;
    const draft = rawDraft.formData ? rawDraft.formData : rawDraft;
    try {
      if (draft.formHeadName) setFormHeadName(draft.formHeadName);
      if (draft.formContact) setFormContact(draft.formContact);
      if (draft.formBarangay) setFormBarangay(draft.formBarangay);
      if (draft.formPurok) setFormPurok(draft.formPurok);
      if (draft.formLat) setFormLat(draft.formLat);
      if (draft.formLng) setFormLng(draft.formLng);
      if (draft.formPmrf) setFormPmrf(draft.formPmrf);
      if (draft.formYakap) setFormYakap(draft.formYakap);
      if (draft.isNewMemberFpe !== undefined) setIsNewMemberFpe(!!draft.isNewMemberFpe);

      if (draft.pmrfPurpose) setPmrfPurpose(draft.pmrfPurpose);
      if (draft.pmrfKonsulta) setPmrfKonsulta(draft.pmrfKonsulta);
      if (draft.pmrfPin) setPmrfPin(draft.pmrfPin);
      if (draft.pmrfLastName) setPmrfLastName(draft.pmrfLastName);
      if (draft.pmrfFirstName) setPmrfFirstName(draft.pmrfFirstName);
      if (draft.pmrfNameExt) setPmrfNameExt(draft.pmrfNameExt);
      if (draft.pmrfMiddleName) setPmrfMiddleName(draft.pmrfMiddleName);
      if (draft.pmrfMotherMaiden) setPmrfMotherMaiden(draft.pmrfMotherMaiden);
      if (draft.pmrfSpouseName) setPmrfSpouseName(draft.pmrfSpouseName);
      
      if (draft.pmrfMotherLastName !== undefined) setPmrfMotherLastName(draft.pmrfMotherLastName);
      if (draft.pmrfMotherFirstName !== undefined) setPmrfMotherFirstName(draft.pmrfMotherFirstName);
      if (draft.pmrfMotherNameExt !== undefined) setPmrfMotherNameExt(draft.pmrfMotherNameExt);
      if (draft.pmrfMotherMiddleName !== undefined) setPmrfMotherMiddleName(draft.pmrfMotherMiddleName);
      if (draft.pmrfMotherNoMiddleName !== undefined) setPmrfMotherNoMiddleName(draft.pmrfMotherNoMiddleName);
      if (draft.pmrfMotherMononym !== undefined) setPmrfMotherMononym(draft.pmrfMotherMononym);
      if (draft.pmrfSpouseLastName !== undefined) setPmrfSpouseLastName(draft.pmrfSpouseLastName);
      if (draft.pmrfSpouseFirstName !== undefined) setPmrfSpouseFirstName(draft.pmrfSpouseFirstName);
      if (draft.pmrfSpouseNameExt !== undefined) setPmrfSpouseNameExt(draft.pmrfSpouseNameExt);
      if (draft.pmrfSpouseMiddleName !== undefined) setPmrfSpouseMiddleName(draft.pmrfSpouseMiddleName);
      if (draft.pmrfSpouseNoMiddleName !== undefined) setPmrfSpouseNoMiddleName(draft.pmrfSpouseNoMiddleName);
      if (draft.pmrfSpouseMononym !== undefined) setPmrfSpouseMononym(draft.pmrfSpouseMononym);
      if (draft.pmrfMemberNoMiddleName !== undefined) setPmrfMemberNoMiddleName(draft.pmrfMemberNoMiddleName);
      if (draft.pmrfMemberMononym !== undefined) setPmrfMemberMononym(draft.pmrfMemberMononym);
      if (draft.pmrfBirthDate) setPmrfBirthDate(draft.pmrfBirthDate);
      if (draft.pmrfBirthPlace) setPmrfBirthPlace(draft.pmrfBirthPlace);
      if (draft.pmrfSex) setPmrfSex(draft.pmrfSex);
      if (draft.pmrfCivilStatus) setPmrfCivilStatus(draft.pmrfCivilStatus);
      if (draft.pmrfCitizenship) setPmrfCitizenship(draft.pmrfCitizenship);
      if (draft.pmrfPhilsysNo) setPmrfPhilsysNo(draft.pmrfPhilsysNo);
      if (draft.pmrfTin) setPmrfTin(draft.pmrfTin);
      if (draft.pmrfAddressUnit) setPmrfAddressUnit(draft.pmrfAddressUnit);
      if (draft.pmrfAddressStreet) setPmrfAddressStreet(draft.pmrfAddressStreet);
      if (draft.pmrfAddressSubdivision) setPmrfAddressSubdivision(draft.pmrfAddressSubdivision);
      if (draft.pmrfAddressZip) setPmrfAddressZip(draft.pmrfAddressZip);
      if (draft.pmrfAddressUnitNoFloor !== undefined) setPmrfAddressUnitNoFloor(draft.pmrfAddressUnitNoFloor);
      if (draft.pmrfAddressBuildingName !== undefined) setPmrfAddressBuildingName(draft.pmrfAddressBuildingName);
      if (draft.pmrfAddressBarangay !== undefined) setPmrfAddressBarangay(draft.pmrfAddressBarangay);
      if (draft.pmrfAddressMunicipality !== undefined) setPmrfAddressMunicipality(draft.pmrfAddressMunicipality);
      if (draft.pmrfAddressProvince !== undefined) setPmrfAddressProvince(draft.pmrfAddressProvince);
      if (draft.pmrfMailSame !== undefined) setPmrfMailSame(draft.pmrfMailSame);
      if (draft.pmrfMailUnit) setPmrfMailUnit(draft.pmrfMailUnit);
      if (draft.pmrfMailStreet) setPmrfMailStreet(draft.pmrfMailStreet);
      if (draft.pmrfMailSubdivision) setPmrfMailSubdivision(draft.pmrfMailSubdivision);
      if (draft.pmrfMailZip) setPmrfMailZip(draft.pmrfMailZip);
      if (draft.pmrfMailUnitNoFloor !== undefined) setPmrfMailUnitNoFloor(draft.pmrfMailUnitNoFloor);
      if (draft.pmrfMailBuildingName !== undefined) setPmrfMailBuildingName(draft.pmrfMailBuildingName);
      if (draft.pmrfMailBarangay !== undefined) setPmrfMailBarangay(draft.pmrfMailBarangay);
      if (draft.pmrfMailMunicipality !== undefined) setPmrfMailMunicipality(draft.pmrfMailMunicipality);
      if (draft.pmrfMailProvince !== undefined) setPmrfMailProvince(draft.pmrfMailProvince);
      if (draft.pmrfHomePhone) setPmrfHomePhone(draft.pmrfHomePhone);
      if (draft.pmrfMobileNo) setPmrfMobileNo(draft.pmrfMobileNo);
      if (draft.pmrfBusinessDirect) setPmrfBusinessDirect(draft.pmrfBusinessDirect);
      if (draft.pmrfEmail) setPmrfEmail(draft.pmrfEmail);
      if (draft.pmrfContributorCategory) setPmrfContributorCategory(draft.pmrfContributorCategory);
      if (draft.pmrfContributorType) setPmrfContributorType(draft.pmrfContributorType);
      if (draft.pmrfGroupSchemeName !== undefined) setPmrfGroupSchemeName(draft.pmrfGroupSchemeName);
      if (draft.pmrfPraSrrvNo !== undefined) setPmrfPraSrrvNo(draft.pmrfPraSrrvNo);
      if (draft.pmrfAcrICardNo !== undefined) setPmrfAcrICardNo(draft.pmrfAcrICardNo);
      if (draft.pmrfPwdIdNo !== undefined) setPmrfPwdIdNo(draft.pmrfPwdIdNo);
      if (draft.pmrfProfession) setPmrfProfession(draft.pmrfProfession);
      if (draft.pmrfMonthlyIncome) setPmrfMonthlyIncome(draft.pmrfMonthlyIncome);
      if (draft.pmrfProofOfIncome) setPmrfProofOfIncome(draft.pmrfProofOfIncome);

      if (draft.pmrfBackChangeName !== undefined) setPmrfBackChangeName(draft.pmrfBackChangeName);
      if (draft.pmrfBackChangeDOB !== undefined) setPmrfBackChangeDOB(draft.pmrfBackChangeDOB);
      if (draft.pmrfBackChangeSex !== undefined) setPmrfBackChangeSex(draft.pmrfBackChangeSex);
      if (draft.pmrfBackChangeCivilStatus !== undefined) setPmrfBackChangeCivilStatus(draft.pmrfBackChangeCivilStatus);
      if (draft.pmrfBackChangePersonalInfo !== undefined) setPmrfBackChangePersonalInfo(draft.pmrfBackChangePersonalInfo);
      if (draft.pmrfBackFromValueName !== undefined) setPmrfBackFromValueName(draft.pmrfBackFromValueName);
      if (draft.pmrfBackToValueName !== undefined) setPmrfBackToValueName(draft.pmrfBackToValueName);
      if (draft.pmrfBackFromValueDOB !== undefined) setPmrfBackFromValueDOB(draft.pmrfBackFromValueDOB);
      if (draft.pmrfBackToValueDOB !== undefined) setPmrfBackToValueDOB(draft.pmrfBackToValueDOB);
      if (draft.pmrfBackFromValueSex !== undefined) setPmrfBackFromValueSex(draft.pmrfBackFromValueSex);
      if (draft.pmrfBackToValueSex !== undefined) setPmrfBackToValueSex(draft.pmrfBackToValueSex);
      if (draft.pmrfBackFromValueCivil !== undefined) setPmrfBackFromValueCivil(draft.pmrfBackFromValueCivil);
      if (draft.pmrfBackToValueCivil !== undefined) setPmrfBackToValueCivil(draft.pmrfBackToValueCivil);
      if (draft.pmrfBackFromValueInfo !== undefined) setPmrfBackFromValueInfo(draft.pmrfBackFromValueInfo);
      if (draft.pmrfBackToValueInfo !== undefined) setPmrfBackToValueInfo(draft.pmrfBackToValueInfo);
      if (draft.pmrfBackSignature !== undefined) setPmrfBackSignature(draft.pmrfBackSignature);
      if (draft.pmrfBackSignatureDate !== undefined) setPmrfBackSignatureDate(draft.pmrfBackSignatureDate);
      if (draft.pmrfBackThumbmark !== undefined) setPmrfBackThumbmark(draft.pmrfBackThumbmark);
      if (draft.pmrfBackSameAsFront !== undefined) setPmrfBackSameAsFront(draft.pmrfBackSameAsFront);
      if (draft.pmrfBackReceivedByFullName !== undefined) setPmrfBackReceivedByFullName(draft.pmrfBackReceivedByFullName);
      if (draft.pmrfBackReceivedByBranch !== undefined) setPmrfBackReceivedByBranch(draft.pmrfBackReceivedByBranch);
      if (draft.pmrfBackReceivedByDateTime !== undefined) setPmrfBackReceivedByDateTime(draft.pmrfBackReceivedByDateTime);

      if (draft.fpeCcNone !== undefined) setFpeCcNone(draft.fpeCcNone);
      if (draft.fpeCcFever !== undefined) setFpeCcFever(draft.fpeCcFever);
      if (draft.fpeCcCough !== undefined) setFpeCcCough(draft.fpeCcCough);
      if (draft.fpeCcBodyPain !== undefined) setFpeCcBodyPain(draft.fpeCcBodyPain);
      if (draft.fpeCcDyspnea !== undefined) setFpeCcDyspnea(draft.fpeCcDyspnea);
      if (draft.fpeCcOthers !== undefined) setFpeCcOthers(draft.fpeCcOthers);

      if (draft.fpeMhHypertension !== undefined) setFpeMhHypertension(draft.fpeMhHypertension);
      if (draft.fpeMhDiabetes !== undefined) setFpeMhDiabetes(draft.fpeMhDiabetes);
      if (draft.fpeMhAstmaCopd !== undefined) setFpeMhAstmaCopd(draft.fpeMhAstmaCopd);
      if (draft.fpeMhHeart !== undefined) setFpeMhHeart(draft.fpeMhHeart);
      if (draft.fpeMhStroke !== undefined) setFpeMhStroke(draft.fpeMhStroke);
      if (draft.fpeMhCancer !== undefined) setFpeMhCancer(draft.fpeMhCancer);
      if (draft.fpeMhTb !== undefined) setFpeMhTb(draft.fpeMhTb);
      if (draft.fpeMhKidney !== undefined) setFpeMhKidney(draft.fpeMhKidney);
      if (draft.fpeMhNone !== undefined) setFpeMhNone(draft.fpeMhNone);

      if (draft.fpeFhHypertension !== undefined) setFpeFhHypertension(draft.fpeFhHypertension);
      if (draft.fpeFhDiabetes !== undefined) setFpeFhDiabetes(draft.fpeFhDiabetes);
      if (draft.fpeFhHeart !== undefined) setFpeFhHeart(draft.fpeFhHeart);
      if (draft.fpeFhCancer !== undefined) setFpeFhCancer(draft.fpeFhCancer);
      if (draft.fpeFhNone !== undefined) setFpeFhNone(draft.fpeFhNone);

      if (draft.fpeShSmoking) setFpeShSmoking(draft.fpeShSmoking);
      if (draft.fpeShAlcohol) setFpeShAlcohol(draft.fpeShAlcohol);
      if (draft.fpeShOccupation) setFpeShOccupation(draft.fpeShOccupation);

      if (draft.fpeMedNone !== undefined) setFpeMedNone(draft.fpeMedNone);
      if (draft.fpeMedSpecify) setFpeMedSpecify(draft.fpeMedSpecify);

      if (draft.fpeVitalBp) setFpeVitalBp(draft.fpeVitalBp);
      if (draft.fpeVitalWt) setFpeVitalWt(draft.fpeVitalWt);
      if (draft.fpeVitalHt) setFpeVitalHt(draft.fpeVitalHt);
      if (draft.fpeVitalHr) setFpeVitalHr(draft.fpeVitalHr);
      if (draft.fpeVitalRr) setFpeVitalRr(draft.fpeVitalRr);
      if (draft.fpeVitalBmi) setFpeVitalBmi(draft.fpeVitalBmi);
      if (draft.fpeVitalTemp) setFpeVitalTemp(draft.fpeVitalTemp);
      if (draft.fpeVitalWaist) setFpeVitalWaist(draft.fpeVitalWaist);
      if (draft.fpeVitalUpperArm) setFpeVitalUpperArm(draft.fpeVitalUpperArm);
      if (draft.fpeVitalMidArm) setFpeVitalMidArm(draft.fpeVitalMidArm);

      if (draft.fpePhysicalExam) setFpePhysicalExam(draft.fpePhysicalExam);
      if (draft.fpeAssessmentPlan) setFpeAssessmentPlan(draft.fpeAssessmentPlan);
      if (draft.fpeAddress) setFpeAddress(draft.fpeAddress);
      if (draft.fpeAddressManuallyEdited !== undefined) {
        setFpeAddressManuallyEdited(draft.fpeAddressManuallyEdited);
      } else if (draft.fpeAddress) {
        setFpeAddressManuallyEdited(true);
      }

      if (draft.pcsfType) setPcsfType(draft.pcsfType);
      if (draft.pcsfDate) setPcsfDate(draft.pcsfDate);
      if (draft.pcsfFullName) setPcsfFullName(draft.pcsfFullName);
      if (draft.pcsfHouseholdNumber) setPcsfHouseholdNumber(draft.pcsfHouseholdNumber);
      if (draft.pcsfHouseholdId) setPcsfHouseholdId(draft.pcsfHouseholdId);
      if (draft.pcsfDependentId) setPcsfDependentId(draft.pcsfDependentId);
      if (draft.pcsfMemberCategory) setPcsfMemberCategory(draft.pcsfMemberCategory);
      if (draft.pcsfAddressBarangay) setPcsfAddressBarangay(draft.pcsfAddressBarangay);
      if (draft.pcsfAddressCity) setPcsfAddressCity(draft.pcsfAddressCity);
      if (draft.pcsfAddressProvince) setPcsfAddressProvince(draft.pcsfAddressProvince);
      if (draft.pcsfContactNo) setPcsfContactNo(draft.pcsfContactNo);
      if (draft.pcsfEmail) setPcsfEmail(draft.pcsfEmail);
      if (draft.pcsfRegisterPcc !== undefined) setPcsfRegisterPcc(draft.pcsfRegisterPcc);
      if (draft.pcsfRegisterDependents !== undefined) setPcsfRegisterDependents(draft.pcsfRegisterDependents);

      if (draft.pcsfPcc1) setPcsfPcc1(draft.pcsfPcc1);
      if (draft.pcsfPcc1Addr) setPcsfPcc1Addr(draft.pcsfPcc1Addr);
      if (draft.pcsfPcc2) setPcsfPcc2(draft.pcsfPcc2);
      if (draft.pcsfPcc2Addr) setPcsfPcc2Addr(draft.pcsfPcc2Addr);

      if (draft.pcsfTransfer !== undefined) setPcsfTransfer(draft.pcsfTransfer);
      if (draft.pcsfPrevPcc) setPcsfPrevPcc(draft.pcsfPrevPcc);
      if (draft.pcsfTransferPcc1) setPcsfTransferPcc1(draft.pcsfTransferPcc1);
      if (draft.pcsfTransferPcc1Addr) setPcsfTransferPcc1Addr(draft.pcsfTransferPcc1Addr);
      if (draft.pcsfTransferPcc2) setPcsfTransferPcc2(draft.pcsfTransferPcc2);
      if (draft.pcsfTransferPcc2Addr) setPcsfTransferPcc2Addr(draft.pcsfTransferPcc2Addr);

      if (draft.wizardMembers) setWizardMembers(draft.wizardMembers);
      if (draft.wizardDependents) setWizardDependents(draft.wizardDependents);
      if (draft.attachmentsList) {
        setAttachmentsList(draft.attachmentsList);
      } else {
        setAttachmentsList([]);
      }
      if (draft.patientSignature !== undefined) {
        setPatientSignature(draft.patientSignature);
      } else {
        setPatientSignature(null);
      }
    } catch(e) {
      console.warn('Failed restoring draft:', e);
    }
  };

  const loadHouseholdToPMRFStates = (fullData: any) => {
    const h = fullData.household;
    const pmrf = h.pmrfDetails || {};
    const fpe = h.fpeDetails || pmrf.fpeDetails || {};
    const pcsf = h.pcsfDetails || pmrf.pcsfDetails || {};

    // Standard fields
    setFormHeadName(h.householdHead || '');
    setFormContact(h.contactNumber || '');
    setFormBarangay(h.barangay || '');
    setFormPurok(h.purok || '');
    setFormLat(h.latitude !== undefined && h.latitude !== null ? h.latitude.toString() : '0');
    setFormLng(h.longitude !== undefined && h.longitude !== null ? h.longitude.toString() : '0');
    setFormPmrf(h.pmrfStatus || 'Pending');
    setFormYakap(h.yakapWillingStatus || 'Willing');

    // PMRF values
    setPmrfPurpose(pmrf.purpose || 'REGISTRATION');
    setPmrfKonsulta(pmrf.konsulta || 'Saint Francis Clinic Provider');
    setPmrfPin(pmrf.pin || pmrf.pmrfPin || h.pin || '');
    setPmrfLastName(pmrf.lastName || '');
    setPmrfFirstName(pmrf.firstName || '');
    setPmrfNameExt(pmrf.nameExt || '');
    setPmrfMiddleName(pmrf.middleName || '');

    // Mother Maiden name details
    setPmrfMotherLastName(pmrf.motherLastName || pmrf.pmrfMotherLastName || '');
    setPmrfMotherFirstName(pmrf.motherFirstName || pmrf.pmrfMotherFirstName || '');
    setPmrfMotherMiddleName(pmrf.motherMiddleName || pmrf.pmrfMotherMiddleName || '');
    setPmrfMotherNameExt(pmrf.motherNameExt || pmrf.pmrfMotherNameExt || '');
    setPmrfMotherNoMiddleName(!!(pmrf.motherNoMiddleName || pmrf.pmrfMotherNoMiddleName || pmrf.pmrfMotherNoMN || pmrf.motherNoMN));
    setPmrfMotherMononym(!!(pmrf.motherMononym || pmrf.pmrfMotherMononym));
    setPmrfMotherMaiden(pmrf.motherMaiden || '');

    // Spouse name details
    setPmrfSpouseLastName(pmrf.spouseLastName || pmrf.pmrfSpouseLastName || '');
    setPmrfSpouseFirstName(pmrf.spouseFirstName || pmrf.pmrfSpouseFirstName || '');
    setPmrfSpouseMiddleName(pmrf.spouseMiddleName || pmrf.pmrfSpouseMiddleName || '');
    setPmrfSpouseNameExt(pmrf.spouseNameExt || pmrf.pmrfSpouseNameExt || '');
    setPmrfSpouseNoMiddleName(!!(pmrf.spouseNoMiddleName || pmrf.pmrfSpouseNoMiddleName || pmrf.pmrfSpouseNoMN || pmrf.spouseNoMN));
    setPmrfSpouseMononym(!!(pmrf.spouseMononym || pmrf.pmrfSpouseMononym));
    setPmrfSpouseName(pmrf.spouseName || '');

    // Member No Middle Name & Mononym
    setPmrfMemberNoMiddleName(!!pmrf.pmrfMemberNoMiddleName || pmrf.middleName === 'N/A');
    setPmrfMemberMononym(!!pmrf.pmrfMemberMononym);

    setPmrfBirthDate(pmrf.birthDate || pmrf.birthdate || h.birthdate || h.birthDate || '');
    setPmrfBirthPlace(pmrf.birthPlace || 'Pagadian City, Zamboanga del Sur');
    setPmrfSex(pmrf.sex || h.gender || 'Male');
    setPmrfCivilStatus(pmrf.civilStatus || h.civilStatus || 'Single');
    setPmrfCitizenship(pmrf.citizenship || 'FILIPINO');
    setPmrfPhilsysNo(pmrf.philsysNo || '');
    setPmrfTin(pmrf.tin || '');

    setPmrfAddressUnit(pmrf.addressUnit || '');
    setPmrfAddressStreet(pmrf.addressStreet || '');
    setPmrfAddressSubdivision(pmrf.addressSubdivision || h.purok || '');
    setPmrfAddressBarangay(pmrf.addressBarangay || h.barangay || '');
    setPmrfAddressZip(pmrf.addressZip || '7016');
    setPmrfMailSame(pmrf.mailSame !== undefined ? pmrf.mailSame : true);
    setPmrfMailUnit(pmrf.mailUnit || '');
    setPmrfMailStreet(pmrf.mailStreet || '');
    setPmrfMailSubdivision(pmrf.mailSubdivision || h.purok || '');
    setPmrfMailBarangay(pmrf.pmrfMailBarangay || pmrf.mailBarangay || h.barangay || '');
    setPmrfMailZip(pmrf.mailZip || '7016');

    setPmrfHomePhone(pmrf.homePhone || '');
    setPmrfMobileNo(pmrf.mobileNo || pmrf.pmrfMobileNo || h.contactNumber || '');
    setPmrfBusinessDirect(pmrf.businessDirect || '');
    setPmrfEmail(pmrf.email || '');

    setPmrfContributorCategory(pmrf.contributorCategory || 'DIRECT');
    setPmrfContributorType(pmrf.contributorType || 'Employed Private');
    setPmrfGroupSchemeName(pmrf.pmrfGroupSchemeName || '');
    setPmrfPraSrrvNo(pmrf.pmrfPraSrrvNo || '');
    setPmrfAcrICardNo(pmrf.acrICardNo || pmrf.pmrfAcrICardNo || '');
    setPmrfPwdIdNo(pmrf.pwdIdNo || pmrf.pmrfPwdIdNo || '');
    setPmrfProfession(pmrf.profession || 'Farmer');
    setPmrfMonthlyIncome(pmrf.monthlyIncome || '');
    setPmrfProofOfIncome(pmrf.proofOfIncome || '');

    // PMRF Back variables
    setPmrfBackChangeName(!!pmrf.pmrfBackChangeName);
    setPmrfBackChangeDOB(!!pmrf.pmrfBackChangeDOB);
    setPmrfBackChangeSex(!!pmrf.pmrfBackChangeSex);
    setPmrfBackChangeCivilStatus(!!pmrf.pmrfBackChangeCivilStatus);
    setPmrfBackChangePersonalInfo(!!pmrf.pmrfBackChangePersonalInfo);
    setPmrfBackFromValueName(pmrf.pmrfBackFromValueName || '');
    setPmrfBackToValueName(pmrf.pmrfBackToValueName || '');
    setPmrfBackFromValueDOB(pmrf.pmrfBackFromValueDOB || '');
    setPmrfBackToValueDOB(pmrf.pmrfBackToValueDOB || '');
    setPmrfBackFromValueSex(pmrf.pmrfBackFromValueSex || '');
    setPmrfBackToValueSex(pmrf.pmrfBackToValueSex || '');
    setPmrfBackFromValueCivil(pmrf.pmrfBackFromValueCivil || '');
    setPmrfBackToValueCivil(pmrf.pmrfBackToValueCivil || '');
    setPmrfBackFromValueInfo(pmrf.pmrfBackFromValueInfo || '');
    setPmrfBackToValueInfo(pmrf.pmrfBackToValueInfo || '');
    setPmrfBackSignature(pmrf.pmrfBackSignature || null);
    setPmrfBackSignatureDate(pmrf.pmrfBackSignatureDate || new Date().toISOString().split('T')[0]);
    setPmrfBackThumbmark(pmrf.pmrfBackThumbmark || null);
    setPmrfBackSameAsFront(pmrf.pmrfBackSameAsFront !== undefined ? pmrf.pmrfBackSameAsFront : true);
    setPmrfBackReceivedByFullName(pmrf.pmrfBackReceivedByFullName || currentUser?.fullName || '');
    setPmrfBackReceivedByBranch(pmrf.pmrfBackReceivedByBranch || 'PAGADIAN BRANCH');
    setPmrfBackReceivedByDateTime(pmrf.pmrfBackReceivedByDateTime || new Date().toISOString().substring(0, 16));

    // FPE details components
    setFpeCcNone(!!fpe.ccNone);
    setFpeCcFever(!!fpe.ccFever);
    setFpeCcCough(!!fpe.ccCough);
    setFpeCcBodyPain(!!fpe.ccBodyPain);
    setFpeCcDyspnea(!!fpe.ccDyspnea);
    setFpeCcOthers(fpe.ccOthers || '');
    
    setFpeMhHypertension(!!fpe.mhHypertension);
    setFpeMhDiabetes(!!fpe.mhDiabetes);
    setFpeMhAstmaCopd(!!fpe.mhAstmaCopd);
    setFpeMhHeart(!!fpe.mhHeart);
    setFpeMhStroke(!!fpe.mhStroke);
    setFpeMhCancer(!!fpe.mhCancer);
    setFpeMhTb(!!fpe.mhTb);
    setFpeMhKidney(!!fpe.mhKidney);
    setFpeMhNone(!!fpe.mhNone);

    setFpeFhHypertension(!!fpe.fhHypertension);
    setFpeFhDiabetes(!!fpe.fhDiabetes);
    setFpeFhHeart(!!fpe.fhHeart);
    setFpeFhCancer(!!fpe.fhCancer);
    setFpeFhNone(!!fpe.fhNone);

    setFpeShSmoking(fpe.shSmoking || 'No');
    setFpeShAlcohol(fpe.shAlcohol || 'No');
    setFpeShOccupation(fpe.shOccupation || pmrf.profession || 'Farmer');

    setFpeMedNone(!!fpe.medNone);
    setFpeMedSpecify(fpe.medSpecify || '');

    setFpeVitalBp(fpe.vitalBp || '');
    setFpeVitalWt(fpe.vitalWt || '');
    setFpeVitalHt(fpe.vitalHt || '');
    setFpeVitalHr(fpe.vitalHr || '');
    setFpeVitalRr(fpe.vitalRr || '');
    setFpeVitalBmi(fpe.vitalBmi || '');
    setFpeVitalTemp(fpe.vitalTemp || '');
    setFpeVitalWaist(fpe.vitalWaist || '');
    setFpeVitalUpperArm(fpe.vitalUpperArm || '');
    setFpeVitalMidArm(fpe.vitalMidArm || '');

    setFpePhysicalExam(fpe.physicalExam || '');
    setFpeAssessmentPlan(fpe.assessmentPlan || '');
    setFpeAddress(fpe.address || '');
    setFpeAddressManuallyEdited(!!fpe.address);

    // PCSF details components
    setPcsfType(pcsf.type || 'MEMBER');
    setPcsfDate(pcsf.date || '');
    setPcsfFullName(pcsf.fullName || '');
    setPcsfAddressBarangay(pcsf.addressBarangay || '');
    setPcsfAddressCity(pcsf.addressCity || '');
    setPcsfAddressProvince(pcsf.addressProvince || '');
    setPcsfContactNo(pcsf.contactNo || pmrf.mobileNo || h.contactNumber || '');
    setPcsfEmail(pcsf.email || pmrf.email || '');
    setPcsfRegisterPcc(pcsf.registerPcc || '');
    setPcsfRegisterDependents(!!pcsf.registerDependents);
    setPcsfPcc1(pcsf.pcc1 || 'Saint Francis Clinic');
    setPcsfPcc1Addr(pcsf.pcc1Addr || 'San Francisco, Pagadian City, Zamboanga del Sur');
    setPcsfPcc2(pcsf.pcc2 || '');
    setPcsfPcc2Addr(pcsf.pcc2Addr || '');
    setPcsfTransfer(!!pcsf.transfer);
    setPcsfPrevPcc(pcsf.prevPcc || '');
    setPcsfTransferPcc1(pcsf.transferPcc1 || '');
    setPcsfTransferPcc1Addr(pcsf.transferPcc1Addr || '');
    setPcsfTransferPcc2(pcsf.transferPcc2 || '');
    setPcsfTransferPcc2Addr(pcsf.transferPcc2Addr || '');
    setPcsfHouseholdNumber(pcsf.householdNumber || h.householdNumber || '');
    setPcsfHouseholdId(pcsf.householdId || h.id || '');
    setPcsfDependentId(pcsf.dependentId || '');
    setPcsfMemberCategory(pcsf.memberCategory || 'Direct Contributor');

    // Load members & dependents lists
    setWizardMembers(fullData.members || []);
    setWizardDependents(fullData.dependents || []);
    setAttachmentsList(h.attachments || []);
    setPatientSignature(h.patientSignature || pmrf.patientSignature || null);
  };

  // Wizard arrays
  const [hasNewMemberFirstName, setHasNewMemberFirstName] = useState('');
  const [hasNewMemberLastName, setHasNewMemberLastName] = useState('');
  const [hasNewMemberRelation, setHasNewMemberRelation] = useState<'Spouse' | 'Child' | 'Parent' | 'Sibling' | 'Relative' | 'Other'>('Spouse');
  const [hasNewMemberAge, setHasNewMemberAge] = useState('25');
  const [hasNewMemberGender, setHasNewMemberGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [wizardMembers, setWizardMembers] = useState<any[]>([]);

  const [hasNewDependentName, setHasNewDependentName ] = useState('');
  const [hasNewDependentAge, setHasNewDependentAge] = useState('5');
  const [hasNewDependentRelation, setHasNewDependentRelation] = useState('Child');
  const [hasNewDependentBirthDate, setHasNewDependentBirthDate] = useState('');
  const [hasNewDependentGender, setHasNewDependentGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [hasNewDependentCivilStatus, setHasNewDependentCivilStatus] = useState<'Single' | 'Married' | 'Annulled' | 'Widowed' | 'Legally Separated'>('Single');
  
  // Split input states for high-fidelity adding of dependents
  const [depLastName, setDepLastName] = useState('');
  const [depFirstName, setDepFirstName] = useState('');
  const [depMiddleName, setDepMiddleName] = useState('');
  const [depNameExt, setDepNameExt] = useState('');
  const [depNoMN, setDepNoMN] = useState(false);
  const [depMononym, setDepMononym] = useState(false);
  const [depCitizenship, setDepCitizenship] = useState('FILIPINO');
  const [depIsDisabled, setDepIsDisabled] = useState(false);
  const [depBirthDate, setDepBirthDate] = useState('');
  const [depRelation, setDepRelation] = useState('Child');
  const [depSex, setDepSex] = useState<'Male' | 'Female'>('Female');
  const [depCivilStatus, setDepCivilStatus] = useState<string>('Single');

  const [wizardDependents, setWizardDependents] = useState<any[]>([]);

  // Draft active state restorer on mount (Runs after all dependencies are registered)
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('saint_francis_household_form_draft');
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.accountId && draft.accountId.toLowerCase() !== currentUser.email.toLowerCase()) {
          // Belongs to another user account - do not recover/leak
          return;
        }
        const hasAnyContent = !!(draft.formHeadName || draft.pmrfLastName || draft.pmrfFirstName || draft.pmrfPhilsysNo || draft.pmrfEmail || draft.pmrfMobileNo || draft.pcsfFullName);
        if (hasAnyContent) {
          setPendingRecoveryDraft(draft);
          setShowRecoveryModal(true);
        }
      }
    } catch (e) {
      console.warn('Failed to detect household draft for recovery:', e);
    }
  }, [currentUser]);

  // Outdated silent restorer logic wrapped to prevent duplicate restore runs
  const outdatedRestorerWrapper = (draft: any) => {
    try {
      if (draft) {
        if (draft.formHeadName) setFormHeadName(draft.formHeadName);
        if (draft.formContact) setFormContact(draft.formContact);
        if (draft.formBarangay) setFormBarangay(draft.formBarangay);
        if (draft.formPurok) setFormPurok(draft.formPurok);
        if (draft.formLat) setFormLat(draft.formLat);
        if (draft.formLng) setFormLng(draft.formLng);
        if (draft.formPmrf) setFormPmrf(draft.formPmrf);
        if (draft.formYakap) setFormYakap(draft.formYakap);

        if (draft.pmrfPurpose) setPmrfPurpose(draft.pmrfPurpose);
        if (draft.pmrfKonsulta) setPmrfKonsulta(draft.pmrfKonsulta);
        if (draft.pmrfPin) setPmrfPin(draft.pmrfPin);
        if (draft.pmrfLastName) setPmrfLastName(draft.pmrfLastName);
        if (draft.pmrfFirstName) setPmrfFirstName(draft.pmrfFirstName);
        if (draft.pmrfNameExt) setPmrfNameExt(draft.pmrfNameExt);
        if (draft.pmrfMiddleName) setPmrfMiddleName(draft.pmrfMiddleName);
        if (draft.pmrfMotherMaiden) setPmrfMotherMaiden(draft.pmrfMotherMaiden);
        if (draft.pmrfSpouseName) setPmrfSpouseName(draft.pmrfSpouseName);
        
        // Restore split name states
        if (draft.pmrfMotherLastName !== undefined) setPmrfMotherLastName(draft.pmrfMotherLastName);
        if (draft.pmrfMotherFirstName !== undefined) setPmrfMotherFirstName(draft.pmrfMotherFirstName);
        if (draft.pmrfMotherNameExt !== undefined) setPmrfMotherNameExt(draft.pmrfMotherNameExt);
        if (draft.pmrfMotherMiddleName !== undefined) setPmrfMotherMiddleName(draft.pmrfMotherMiddleName);
        if (draft.pmrfMotherNoMiddleName !== undefined) setPmrfMotherNoMiddleName(draft.pmrfMotherNoMiddleName);
        if (draft.pmrfMotherMononym !== undefined) setPmrfMotherMononym(draft.pmrfMotherMononym);
        if (draft.pmrfSpouseLastName !== undefined) setPmrfSpouseLastName(draft.pmrfSpouseLastName);
        if (draft.pmrfSpouseFirstName !== undefined) setPmrfSpouseFirstName(draft.pmrfSpouseFirstName);
        if (draft.pmrfSpouseNameExt !== undefined) setPmrfSpouseNameExt(draft.pmrfSpouseNameExt);
        if (draft.pmrfSpouseMiddleName !== undefined) setPmrfSpouseMiddleName(draft.pmrfSpouseMiddleName);
        if (draft.pmrfSpouseNoMiddleName !== undefined) setPmrfSpouseNoMiddleName(draft.pmrfSpouseNoMiddleName);
        if (draft.pmrfSpouseMononym !== undefined) setPmrfSpouseMononym(draft.pmrfSpouseMononym);
        if (draft.pmrfMemberNoMiddleName !== undefined) setPmrfMemberNoMiddleName(draft.pmrfMemberNoMiddleName);
        if (draft.pmrfMemberMononym !== undefined) setPmrfMemberMononym(draft.pmrfMemberMononym);
        if (draft.pmrfBirthDate) setPmrfBirthDate(draft.pmrfBirthDate);
        if (draft.pmrfBirthPlace) setPmrfBirthPlace(draft.pmrfBirthPlace);
        if (draft.pmrfSex) setPmrfSex(draft.pmrfSex);
        if (draft.pmrfCivilStatus) setPmrfCivilStatus(draft.pmrfCivilStatus);
        if (draft.pmrfCitizenship) setPmrfCitizenship(draft.pmrfCitizenship);
        if (draft.pmrfPhilsysNo) setPmrfPhilsysNo(draft.pmrfPhilsysNo);
        if (draft.pmrfTin) setPmrfTin(draft.pmrfTin);
        if (draft.pmrfAddressUnit) setPmrfAddressUnit(draft.pmrfAddressUnit);
        if (draft.pmrfAddressStreet) setPmrfAddressStreet(draft.pmrfAddressStreet);
        if (draft.pmrfAddressSubdivision) setPmrfAddressSubdivision(draft.pmrfAddressSubdivision);
        if (draft.pmrfAddressZip) setPmrfAddressZip(draft.pmrfAddressZip);
        if (draft.pmrfAddressUnitNoFloor !== undefined) setPmrfAddressUnitNoFloor(draft.pmrfAddressUnitNoFloor);
        if (draft.pmrfAddressBuildingName !== undefined) setPmrfAddressBuildingName(draft.pmrfAddressBuildingName);
        if (draft.pmrfAddressBarangay !== undefined) setPmrfAddressBarangay(draft.pmrfAddressBarangay);
        if (draft.pmrfAddressMunicipality !== undefined) setPmrfAddressMunicipality(draft.pmrfAddressMunicipality);
        if (draft.pmrfAddressProvince !== undefined) setPmrfAddressProvince(draft.pmrfAddressProvince);
        if (draft.pmrfMailSame !== undefined) setPmrfMailSame(draft.pmrfMailSame);
        if (draft.pmrfMailUnit) setPmrfMailUnit(draft.pmrfMailUnit);
        if (draft.pmrfMailStreet) setPmrfMailStreet(draft.pmrfMailStreet);
        if (draft.pmrfMailSubdivision) setPmrfMailSubdivision(draft.pmrfMailSubdivision);
        if (draft.pmrfMailZip) setPmrfMailZip(draft.pmrfMailZip);
        if (draft.pmrfMailUnitNoFloor !== undefined) setPmrfMailUnitNoFloor(draft.pmrfMailUnitNoFloor);
        if (draft.pmrfMailBuildingName !== undefined) setPmrfMailBuildingName(draft.pmrfMailBuildingName);
        if (draft.pmrfMailBarangay !== undefined) setPmrfMailBarangay(draft.pmrfMailBarangay);
        if (draft.pmrfMailMunicipality !== undefined) setPmrfMailMunicipality(draft.pmrfMailMunicipality);
        if (draft.pmrfMailProvince !== undefined) setPmrfMailProvince(draft.pmrfMailProvince);
        if (draft.pmrfHomePhone) setPmrfHomePhone(draft.pmrfHomePhone);
        if (draft.pmrfMobileNo) setPmrfMobileNo(draft.pmrfMobileNo);
        if (draft.pmrfBusinessDirect) setPmrfBusinessDirect(draft.pmrfBusinessDirect);
        if (draft.pmrfEmail) setPmrfEmail(draft.pmrfEmail);
        if (draft.pmrfContributorCategory) setPmrfContributorCategory(draft.pmrfContributorCategory);
        if (draft.pmrfContributorType) setPmrfContributorType(draft.pmrfContributorType);
        if (draft.pmrfGroupSchemeName !== undefined) setPmrfGroupSchemeName(draft.pmrfGroupSchemeName);
        if (draft.pmrfPraSrrvNo !== undefined) setPmrfPraSrrvNo(draft.pmrfPraSrrvNo);
        if (draft.pmrfAcrICardNo !== undefined) setPmrfAcrICardNo(draft.pmrfAcrICardNo);
        if (draft.pmrfPwdIdNo !== undefined) setPmrfPwdIdNo(draft.pmrfPwdIdNo);
        if (draft.pmrfProfession) setPmrfProfession(draft.pmrfProfession);
        if (draft.pmrfMonthlyIncome) setPmrfMonthlyIncome(draft.pmrfMonthlyIncome);
        if (draft.pmrfProofOfIncome) setPmrfProofOfIncome(draft.pmrfProofOfIncome);

        if (draft.pmrfBackChangeName !== undefined) setPmrfBackChangeName(draft.pmrfBackChangeName);
        if (draft.pmrfBackChangeDOB !== undefined) setPmrfBackChangeDOB(draft.pmrfBackChangeDOB);
        if (draft.pmrfBackChangeSex !== undefined) setPmrfBackChangeSex(draft.pmrfBackChangeSex);
        if (draft.pmrfBackChangeCivilStatus !== undefined) setPmrfBackChangeCivilStatus(draft.pmrfBackChangeCivilStatus);
        if (draft.pmrfBackChangePersonalInfo !== undefined) setPmrfBackChangePersonalInfo(draft.pmrfBackChangePersonalInfo);
        if (draft.pmrfBackFromValueName !== undefined) setPmrfBackFromValueName(draft.pmrfBackFromValueName);
        if (draft.pmrfBackToValueName !== undefined) setPmrfBackToValueName(draft.pmrfBackToValueName);
        if (draft.pmrfBackFromValueDOB !== undefined) setPmrfBackFromValueDOB(draft.pmrfBackFromValueDOB);
        if (draft.pmrfBackToValueDOB !== undefined) setPmrfBackToValueDOB(draft.pmrfBackToValueDOB);
        if (draft.pmrfBackFromValueSex !== undefined) setPmrfBackFromValueSex(draft.pmrfBackFromValueSex);
        if (draft.pmrfBackToValueSex !== undefined) setPmrfBackToValueSex(draft.pmrfBackToValueSex);
        if (draft.pmrfBackFromValueCivil !== undefined) setPmrfBackFromValueCivil(draft.pmrfBackFromValueCivil);
        if (draft.pmrfBackToValueCivil !== undefined) setPmrfBackToValueCivil(draft.pmrfBackToValueCivil);
        if (draft.pmrfBackFromValueInfo !== undefined) setPmrfBackFromValueInfo(draft.pmrfBackFromValueInfo);
        if (draft.pmrfBackToValueInfo !== undefined) setPmrfBackToValueInfo(draft.pmrfBackToValueInfo);
        if (draft.pmrfBackSignature !== undefined) setPmrfBackSignature(draft.pmrfBackSignature);
        if (draft.pmrfBackSignatureDate !== undefined) setPmrfBackSignatureDate(draft.pmrfBackSignatureDate);
        if (draft.pmrfBackThumbmark !== undefined) setPmrfBackThumbmark(draft.pmrfBackThumbmark);
        if (draft.pmrfBackSameAsFront !== undefined) setPmrfBackSameAsFront(draft.pmrfBackSameAsFront);
        if (draft.pmrfBackReceivedByFullName !== undefined) setPmrfBackReceivedByFullName(draft.pmrfBackReceivedByFullName);
        if (draft.pmrfBackReceivedByBranch !== undefined) setPmrfBackReceivedByBranch(draft.pmrfBackReceivedByBranch);
        if (draft.pmrfBackReceivedByDateTime !== undefined) setPmrfBackReceivedByDateTime(draft.pmrfBackReceivedByDateTime);

        if (draft.fpeCcNone !== undefined) setFpeCcNone(draft.fpeCcNone);
        if (draft.fpeCcFever !== undefined) setFpeCcFever(draft.fpeCcFever);
        if (draft.fpeCcCough !== undefined) setFpeCcCough(draft.fpeCcCough);
        if (draft.fpeCcBodyPain !== undefined) setFpeCcBodyPain(draft.fpeCcBodyPain);
        if (draft.fpeCcDyspnea !== undefined) setFpeCcDyspnea(draft.fpeCcDyspnea);
        if (draft.fpeCcOthers !== undefined) setFpeCcOthers(draft.fpeCcOthers);

        if (draft.fpeMhHypertension !== undefined) setFpeMhHypertension(draft.fpeMhHypertension);
        if (draft.fpeMhDiabetes !== undefined) setFpeMhDiabetes(draft.fpeMhDiabetes);
        if (draft.fpeMhAstmaCopd !== undefined) setFpeMhAstmaCopd(draft.fpeMhAstmaCopd);
        if (draft.fpeMhHeart !== undefined) setFpeMhHeart(draft.fpeMhHeart);
        if (draft.fpeMhStroke !== undefined) setFpeMhStroke(draft.fpeMhStroke);
        if (draft.fpeMhCancer !== undefined) setFpeMhCancer(draft.fpeMhCancer);
        if (draft.fpeMhTb !== undefined) setFpeMhTb(draft.fpeMhTb);
        if (draft.fpeMhKidney !== undefined) setFpeMhKidney(draft.fpeMhKidney);
        if (draft.fpeMhNone !== undefined) setFpeMhNone(draft.fpeMhNone);

        if (draft.fpeFhHypertension !== undefined) setFpeFhHypertension(draft.fpeFhHypertension);
        if (draft.fpeFhDiabetes !== undefined) setFpeFhDiabetes(draft.fpeFhDiabetes);
        if (draft.fpeFhHeart !== undefined) setFpeFhHeart(draft.fpeFhHeart);
        if (draft.fpeFhCancer !== undefined) setFpeFhCancer(draft.fpeFhCancer);
        if (draft.fpeFhNone !== undefined) setFpeFhNone(draft.fpeFhNone);

        if (draft.fpeShSmoking) setFpeShSmoking(draft.fpeShSmoking);
        if (draft.fpeShAlcohol) setFpeShAlcohol(draft.fpeShAlcohol);
        if (draft.fpeShOccupation) setFpeShOccupation(draft.fpeShOccupation);

        if (draft.fpeMedNone !== undefined) setFpeMedNone(draft.fpeMedNone);
        if (draft.fpeMedSpecify) setFpeMedSpecify(draft.fpeMedSpecify);

        if (draft.fpeVitalBp) setFpeVitalBp(draft.fpeVitalBp);
        if (draft.fpeVitalWt) setFpeVitalWt(draft.fpeVitalWt);
        if (draft.fpeVitalHt) setFpeVitalHt(draft.fpeVitalHt);
        if (draft.fpeVitalHr) setFpeVitalHr(draft.fpeVitalHr);
        if (draft.fpeVitalRr) setFpeVitalRr(draft.fpeVitalRr);
        if (draft.fpeVitalBmi) setFpeVitalBmi(draft.fpeVitalBmi);
        if (draft.fpeVitalTemp) setFpeVitalTemp(draft.fpeVitalTemp);
        if (draft.fpeVitalWaist) setFpeVitalWaist(draft.fpeVitalWaist);
        if (draft.fpeVitalUpperArm) setFpeVitalUpperArm(draft.fpeVitalUpperArm);
        if (draft.fpeVitalMidArm) setFpeVitalMidArm(draft.fpeVitalMidArm);

        if (draft.fpePhysicalExam) setFpePhysicalExam(draft.fpePhysicalExam);
        if (draft.fpeAssessmentPlan) setFpeAssessmentPlan(draft.fpeAssessmentPlan);
        if (draft.fpeAddress) setFpeAddress(draft.fpeAddress);

        if (draft.pcsfType) setPcsfType(draft.pcsfType);
        if (draft.pcsfDate) setPcsfDate(draft.pcsfDate);
        if (draft.pcsfFullName) setPcsfFullName(draft.pcsfFullName);
        if (draft.pcsfHouseholdNumber) setPcsfHouseholdNumber(draft.pcsfHouseholdNumber);
        if (draft.pcsfHouseholdId) setPcsfHouseholdId(draft.pcsfHouseholdId);
        if (draft.pcsfDependentId) setPcsfDependentId(draft.pcsfDependentId);
        if (draft.pcsfMemberCategory) setPcsfMemberCategory(draft.pcsfMemberCategory);
        if (draft.pcsfAddressBarangay) setPcsfAddressBarangay(draft.pcsfAddressBarangay);
        if (draft.pcsfAddressCity) setPcsfAddressCity(draft.pcsfAddressCity);
        if (draft.pcsfAddressProvince) setPcsfAddressProvince(draft.pcsfAddressProvince);
        if (draft.pcsfContactNo) setPcsfContactNo(draft.pcsfContactNo);
        if (draft.pcsfEmail) setPcsfEmail(draft.pcsfEmail);
        if (draft.pcsfRegisterPcc !== undefined) setPcsfRegisterPcc(draft.pcsfRegisterPcc);
        if (draft.pcsfRegisterDependents !== undefined) setPcsfRegisterDependents(draft.pcsfRegisterDependents);

        if (draft.pcsfPcc1) setPcsfPcc1(draft.pcsfPcc1);
        if (draft.pcsfPcc1Addr) setPcsfPcc1Addr(draft.pcsfPcc1Addr);
        if (draft.pcsfPcc2) setPcsfPcc2(draft.pcsfPcc2);
        if (draft.pcsfPcc2Addr) setPcsfPcc2Addr(draft.pcsfPcc2Addr);

        if (draft.pcsfTransfer !== undefined) setPcsfTransfer(draft.pcsfTransfer);
        if (draft.pcsfPrevPcc) setPcsfPrevPcc(draft.pcsfPrevPcc);
        if (draft.pcsfTransferPcc1) setPcsfTransferPcc1(draft.pcsfTransferPcc1);
        if (draft.pcsfTransferPcc1Addr) setPcsfTransferPcc1Addr(draft.pcsfTransferPcc1Addr);
        if (draft.pcsfTransferPcc2) setPcsfTransferPcc2(draft.pcsfTransferPcc2);
        if (draft.pcsfTransferPcc2Addr) setPcsfTransferPcc2Addr(draft.pcsfTransferPcc2Addr);

        if (draft.wizardMembers) setWizardMembers(draft.wizardMembers);
        if (draft.wizardDependents) setWizardDependents(draft.wizardDependents);
        if (draft.attachmentsList) {
          setAttachmentsList(draft.attachmentsList);
        } else {
          setAttachmentsList([]);
        }
        if (draft.patientSignature !== undefined) {
          setPatientSignature(draft.patientSignature);
        } else {
          setPatientSignature(null);
        }
      }
    } catch (e) {
      console.warn('Failed to restore household draft:', e);
    }
  };


  // Dynamic filtering of Puroks and Barangays for the FPE/PMRF Form dropdowns
  const fpeFilteredPuroks = (puroks || []).filter(p => {
    const search = (pmrfAddressStreet || '').trim().toLowerCase();
    const searchClean = search.replace(/,\s*$/, '').trim();
    
    // Check if Barangay is already specified/selected in the form to narrow down connected Puroks
    const currentBarangay = (pmrfAddressBarangay || '').trim().toLowerCase().replace(/,\s*$/, '').trim();
    if (currentBarangay) {
      const pBarangay = (p.barangay || '').trim().toLowerCase();
      if (pBarangay !== currentBarangay && !pBarangay.includes(currentBarangay)) {
        return false;
      }
    }

    if (!searchClean) return true; // Show all connected/available if nothing is typed yet for street

    const pName = p.name.toLowerCase();
    const bName = (p.barangay || '').toLowerCase();
    const combinedFormat = `${pName}, ${bName}, pagadian city`;

    return pName.includes(searchClean) || bName.includes(searchClean) || combinedFormat.includes(searchClean);
  });

  const fpeFilteredBarangays = (barangayList || []).filter(b => {
    const search = (pmrfAddressBarangay || '').trim().toLowerCase();
    const searchClean = search.replace(/,\s*$/, '').trim();
    if (!searchClean) return true; // Show all if nothing is typed yet
    return b.name.toLowerCase().includes(searchClean);
  });

  // Trigger silent auto saver on state changes
  const triggerSilentAutoSave = () => {
    const hasAnyContent = !!(formHeadName || pmrfLastName || pmrfFirstName || pmrfPhilsysNo || pmrfEmail || pmrfMobileNo || pcsfFullName);
    if (!hasAnyContent || !showAddModal) return;

    setAutoSaveStatus('Saving...');
    
    const draftObj = {
      accountId: currentUser.email,
      isFpePcsfOnly,
      formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
      pmrfPurpose, pmrfKonsulta, pmrfPin, pmrfLastName, pmrfFirstName, pmrfNameExt, pmrfMiddleName,
      pmrfMotherMaiden, pmrfSpouseName, pmrfBirthDate, pmrfBirthPlace, pmrfSex, pmrfCivilStatus,
      pmrfMotherLastName, pmrfMotherFirstName, pmrfMotherNameExt, pmrfMotherMiddleName, pmrfMotherNoMiddleName, pmrfMotherMononym,
      pmrfSpouseLastName, pmrfSpouseFirstName, pmrfSpouseNameExt, pmrfSpouseMiddleName, pmrfSpouseNoMiddleName, pmrfSpouseMononym,
      pmrfMemberNoMiddleName, pmrfMemberMononym,
      pmrfCitizenship, pmrfPhilsysNo, pmrfTin, pmrfAddressUnit, pmrfAddressStreet, pmrfAddressSubdivision,
      pmrfAddressZip, pmrfAddressUnitNoFloor, pmrfAddressBuildingName, pmrfAddressBarangay, pmrfAddressMunicipality, pmrfAddressProvince,
      pmrfMailSame, pmrfMailUnit, pmrfMailStreet, pmrfMailSubdivision, pmrfMailZip,
      pmrfMailUnitNoFloor, pmrfMailBuildingName, pmrfMailBarangay, pmrfMailMunicipality, pmrfMailProvince,
      pmrfHomePhone, pmrfMobileNo, pmrfBusinessDirect, pmrfEmail, pmrfContributorCategory,
      pmrfContributorType, pmrfProfession, pmrfMonthlyIncome, pmrfProofOfIncome,
      pmrfBackChangeName, pmrfBackChangeDOB, pmrfBackChangeSex, pmrfBackChangeCivilStatus, pmrfBackChangePersonalInfo,
      pmrfBackFromValueName, pmrfBackToValueName, pmrfBackFromValueDOB, pmrfBackToValueDOB,
      pmrfBackFromValueSex, pmrfBackToValueSex, pmrfBackFromValueCivil, pmrfBackToValueCivil,
      pmrfBackFromValueInfo, pmrfBackToValueInfo, pmrfBackSignature, pmrfBackSignatureDate,
      pmrfBackThumbmark, pmrfBackSameAsFront, pmrfBackReceivedByFullName, pmrfBackReceivedByBranch,
      pmrfBackReceivedByDateTime,
      fpeCcNone, fpeCcFever, fpeCcCough, fpeCcBodyPain, fpeCcDyspnea, fpeCcOthers,
      fpeMhHypertension, fpeMhDiabetes, fpeMhAstmaCopd, fpeMhHeart, fpeMhStroke, fpeMhCancer,
      fpeMhTb, fpeMhKidney, fpeMhNone, fpeFhHypertension, fpeFhDiabetes, fpeFhHeart, fpeFhCancer,
      fpeFhNone, fpeShSmoking, fpeShAlcohol, fpeShOccupation, fpeMedNone, fpeMedSpecify,
      fpeVitalBp, fpeVitalWt, fpeVitalHt, fpeVitalHr, fpeVitalRr, fpeVitalBmi, fpeVitalTemp,
      fpeVitalWaist, fpeVitalUpperArm, fpeVitalMidArm, fpePhysicalExam, fpeAssessmentPlan, fpeAddress, fpeAddressManuallyEdited,
      pcsfType, pcsfDate, pcsfFullName, pcsfAddressBarangay, pcsfAddressCity, pcsfAddressProvince,
      pcsfContactNo, pcsfEmail, pcsfRegisterPcc, pcsfRegisterDependents, pcsfPcc1, pcsfPcc1Addr,
      pcsfPcc2, pcsfPcc2Addr, pcsfTransfer, pcsfPrevPcc, pcsfTransferPcc1, pcsfTransferPcc1Addr,
      pcsfTransferPcc2, pcsfTransferPcc2Addr, pcsfHouseholdNumber, pcsfHouseholdId, pcsfDependentId,
      pcsfMemberCategory, wizardMembers, wizardDependents, attachmentsList, patientSignature
    };

    try {
      localStorage.setItem('saint_francis_household_form_draft', JSON.stringify(draftObj));
      setTimeout(() => {
        setAutoSaveStatus('Saved');
        setTimeout(() => {
          setAutoSaveStatus('Last Saved: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1500);
      }, 500);
    } catch (e) {
      console.warn('Auto save failure:', e);
      setAutoSaveStatus('Failed to AutoSave');
    }
  };

  // Continuous auto-saver on property alteration
  useEffect(() => {
    triggerSilentAutoSave();
  }, [
    formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
    pmrfPurpose, pmrfLastName, pmrfFirstName, pmrfBirthDate, pmrfMobileNo, pmrfEmail,
    fpeVitalBp, fpeVitalWt, fpeVitalHt, wizardMembers, wizardDependents, attachmentsList, patientSignature
  ]);

  // Periodic Auto Saver every 30 seconds
  useEffect(() => {
    if (!showAddModal) return;
    const interval = setInterval(() => {
      triggerSilentAutoSave();
    }, 30000);
    return () => clearInterval(interval);
  }, [
    showAddModal, formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
    pmrfPurpose, pmrfLastName, pmrfFirstName, pmrfBirthDate, pmrfMobileNo, pmrfEmail,
    fpeVitalBp, fpeVitalWt, fpeVitalHt, wizardMembers, wizardDependents, attachmentsList, patientSignature
  ]);

  // Tab switch, browser close or loss of connection auto-saver
  useEffect(() => {
    const handleBeforeUnload = () => {
      triggerSilentAutoSave();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerSilentAutoSave();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    showAddModal, formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
    pmrfPurpose, pmrfLastName, pmrfFirstName, pmrfBirthDate, pmrfMobileNo, pmrfEmail,
    fpeVitalBp, fpeVitalWt, fpeVitalHt, wizardMembers, wizardDependents, attachmentsList, patientSignature
  ]);

  // Live Auto Saver logic listening to changes of all elements
  useEffect(() => {
    return; // Short-circuit outdated auto-restore save and use our advanced handlers instead
    const draft = {
      formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
      pmrfPurpose, pmrfKonsulta, pmrfPin, pmrfLastName, pmrfFirstName, pmrfNameExt, pmrfMiddleName,
      pmrfMotherMaiden, pmrfSpouseName, pmrfBirthDate, pmrfBirthPlace, pmrfSex, pmrfCivilStatus,
      pmrfMotherLastName, pmrfMotherFirstName, pmrfMotherNameExt, pmrfMotherMiddleName, pmrfMotherNoMiddleName, pmrfMotherMononym,
      pmrfSpouseLastName, pmrfSpouseFirstName, pmrfSpouseNameExt, pmrfSpouseMiddleName, pmrfSpouseNoMiddleName, pmrfSpouseMononym,
      pmrfMemberNoMiddleName, pmrfMemberMononym,
      pmrfCitizenship, pmrfPhilsysNo, pmrfTin, pmrfAddressUnit, pmrfAddressStreet, pmrfAddressSubdivision,
      pmrfAddressZip, pmrfAddressUnitNoFloor, pmrfAddressBuildingName, pmrfAddressBarangay, pmrfAddressMunicipality, pmrfAddressProvince,
      pmrfMailSame, pmrfMailUnit, pmrfMailStreet, pmrfMailSubdivision, pmrfMailZip,
      pmrfMailUnitNoFloor, pmrfMailBuildingName, pmrfMailBarangay, pmrfMailMunicipality, pmrfMailProvince,
      pmrfHomePhone, pmrfMobileNo, pmrfBusinessDirect, pmrfEmail, pmrfContributorCategory,
      pmrfContributorType, pmrfProfession, pmrfMonthlyIncome, pmrfProofOfIncome,
      pmrfBackChangeName, pmrfBackChangeDOB, pmrfBackChangeSex, pmrfBackChangeCivilStatus, pmrfBackChangePersonalInfo,
      pmrfBackFromValueName, pmrfBackToValueName, pmrfBackFromValueDOB, pmrfBackToValueDOB,
      pmrfBackFromValueSex, pmrfBackToValueSex, pmrfBackFromValueCivil, pmrfBackToValueCivil,
      pmrfBackFromValueInfo, pmrfBackToValueInfo, pmrfBackSignature, pmrfBackSignatureDate,
      pmrfBackThumbmark, pmrfBackSameAsFront, pmrfBackReceivedByFullName, pmrfBackReceivedByBranch,
      pmrfBackReceivedByDateTime,
      fpeCcNone, fpeCcFever, fpeCcCough, fpeCcBodyPain, fpeCcDyspnea, fpeCcOthers,
      fpeMhHypertension, fpeMhDiabetes, fpeMhAstmaCopd, fpeMhHeart, fpeMhStroke, fpeMhCancer,
      fpeMhTb, fpeMhKidney, fpeMhNone, fpeFhHypertension, fpeFhDiabetes, fpeFhHeart, fpeFhCancer,
      fpeFhNone, fpeShSmoking, fpeShAlcohol, fpeShOccupation, fpeMedNone, fpeMedSpecify,
      fpeVitalBp, fpeVitalWt, fpeVitalHt, fpeVitalHr, fpeVitalRr, fpeVitalBmi, fpeVitalTemp,
      fpeVitalWaist, fpeVitalUpperArm, fpeVitalMidArm, fpePhysicalExam, fpeAssessmentPlan, fpeAddress,
      pcsfType, pcsfDate, pcsfFullName, pcsfAddressBarangay, pcsfAddressCity, pcsfAddressProvince,
      pcsfContactNo, pcsfEmail, pcsfRegisterPcc, pcsfRegisterDependents, pcsfPcc1, pcsfPcc1Addr,
      pcsfPcc2, pcsfPcc2Addr, pcsfTransfer, pcsfPrevPcc, pcsfTransferPcc1, pcsfTransferPcc1Addr,
      pcsfTransferPcc2, pcsfTransferPcc2Addr, pcsfHouseholdNumber, pcsfHouseholdId, pcsfDependentId,
      pcsfMemberCategory, wizardMembers, wizardDependents
    };
    
    const hasAnyContent = !!(formHeadName || pmrfLastName || pmrfFirstName || pmrfPhilsysNo || pmrfEmail || pmrfMobileNo);
    if (hasAnyContent) {
      localStorage.setItem('saint_francis_household_form_draft', JSON.stringify(draft));
    }
  }, [
    formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
    pmrfPurpose, pmrfKonsulta, pmrfPin, pmrfLastName, pmrfFirstName, pmrfNameExt, pmrfMiddleName,
    pmrfMotherMaiden, pmrfSpouseName, pmrfBirthDate, pmrfBirthPlace, pmrfSex, pmrfCivilStatus,
    pmrfMotherLastName, pmrfMotherFirstName, pmrfMotherNameExt, pmrfMotherMiddleName, pmrfMotherNoMiddleName, pmrfMotherMononym,
    pmrfSpouseLastName, pmrfSpouseFirstName, pmrfSpouseNameExt, pmrfSpouseMiddleName, pmrfSpouseNoMiddleName, pmrfSpouseMononym,
    pmrfMemberNoMiddleName, pmrfMemberMononym,
    pmrfCitizenship, pmrfPhilsysNo, pmrfTin, pmrfAddressUnit, pmrfAddressStreet, pmrfAddressSubdivision,
    pmrfAddressZip, pmrfAddressUnitNoFloor, pmrfAddressBuildingName, pmrfAddressBarangay, pmrfAddressMunicipality, pmrfAddressProvince,
    pmrfMailSame, pmrfMailUnit, pmrfMailStreet, pmrfMailSubdivision, pmrfMailZip,
    pmrfMailUnitNoFloor, pmrfMailBuildingName, pmrfMailBarangay, pmrfMailMunicipality, pmrfMailProvince,
    pmrfHomePhone, pmrfMobileNo, pmrfBusinessDirect, pmrfEmail, pmrfContributorCategory,
    pmrfContributorType, pmrfProfession, pmrfMonthlyIncome, pmrfProofOfIncome,
    pmrfBackChangeName, pmrfBackChangeDOB, pmrfBackChangeSex, pmrfBackChangeCivilStatus, pmrfBackChangePersonalInfo,
    pmrfBackFromValueName, pmrfBackToValueName, pmrfBackFromValueDOB, pmrfBackToValueDOB,
    pmrfBackFromValueSex, pmrfBackToValueSex, pmrfBackFromValueCivil, pmrfBackToValueCivil,
    pmrfBackFromValueInfo, pmrfBackToValueInfo, pmrfBackSignature, pmrfBackSignatureDate,
    pmrfBackThumbmark, pmrfBackSameAsFront, pmrfBackReceivedByFullName, pmrfBackReceivedByBranch,
    pmrfBackReceivedByDateTime,
    fpeCcNone, fpeCcFever, fpeCcCough, fpeCcBodyPain, fpeCcDyspnea, fpeCcOthers,
    fpeMhHypertension, fpeMhDiabetes, fpeMhAstmaCopd, fpeMhHeart, fpeMhStroke, fpeMhCancer,
    fpeMhTb, fpeMhKidney, fpeMhNone, fpeFhHypertension, fpeFhDiabetes, fpeFhHeart, fpeFhCancer,
    fpeFhNone, fpeShSmoking, fpeShAlcohol, fpeShOccupation, fpeMedNone, fpeMedSpecify,
    fpeVitalBp, fpeVitalWt, fpeVitalHt, fpeVitalHr, fpeVitalRr, fpeVitalBmi, fpeVitalTemp,
    fpeVitalWaist, fpeVitalUpperArm, fpeVitalMidArm, fpePhysicalExam, fpeAssessmentPlan, fpeAddress,
    pcsfType, pcsfDate, pcsfFullName, pcsfAddressBarangay, pcsfAddressCity, pcsfAddressProvince,
    pcsfContactNo, pcsfEmail, pcsfRegisterPcc, pcsfRegisterDependents, pcsfPcc1, pcsfPcc1Addr,
    pcsfPcc2, pcsfPcc2Addr, pcsfTransfer, pcsfPrevPcc, pcsfTransferPcc1, pcsfTransferPcc1Addr,
    pcsfTransferPcc2, pcsfTransferPcc2Addr, pcsfHouseholdNumber, pcsfHouseholdId, pcsfDependentId,
    pcsfMemberCategory, wizardMembers, wizardDependents
  ]);

  // Drag-and-drop support
  const [dragActive, setDragActive] = useState(false);

  // Offline connectivity states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('saint_francis_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSaveToOfflineQueue = (payload: any) => {
    const queuedItem = {
      ...payload,
      tempId: Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString()
    };
    const updated = [...offlineQueue, queuedItem];
    setOfflineQueue(updated);
    localStorage.setItem('saint_francis_offline_queue', JSON.stringify(updated));

    setShowAddModal(false);
    resetPMRFStates();
    setAlertModal({
      isOpen: true,
      title: 'Offline Mode Active',
      description: "Registration successfully saved to your browser's local safety storage. It will be synchronized dynamically as soon as internet connection is restored.",
      type: 'info'
    });
  };

  const syncOfflineQueue = async (customQueue?: any[]) => {
    const queueToSync = customQueue || offlineQueue;
    if (queueToSync.length === 0 || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;
    const remainingQueue = [...queueToSync];

    for (const item of queueToSync) {
      try {
        const res = await fetch('/api/households/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': currentUser.email
          },
          body: JSON.stringify(item)
        });

        if (res.ok) {
          successCount++;
          const idx = remainingQueue.findIndex(q => q.tempId === item.tempId);
          if (idx > -1) {
            remainingQueue.splice(idx, 1);
          }
          localStorage.setItem('saint_francis_offline_queue', JSON.stringify(remainingQueue));
          setOfflineQueue([...remainingQueue]);
        } else {
          console.error('[Offline Sync] Failed to sync item:', await res.json());
        }
      } catch (err) {
        console.error('[Offline Sync] Network/Server communication error. Sync paused.', err);
        break;
      }
    }

    setIsSyncing(false);
    if (successCount > 0) {
      setAlertModal({
        isOpen: true,
        title: 'Connection Restored & Synced',
        description: `Successfully synchronized ${successCount} offline registered household files to the Saint Francis Database!`,
        type: 'success'
      });
      fetchHouseholdsAll();
    }
  };

  useEffect(() => {
    const cached = CacheSyncService.getCachedState();
    if (cached.households && cached.households.length > 0) {
      setHouseholds(cached.households);
      setSubmittedNamesList(cached.masterlist || []);
      setBarangayList(cached.barangays || []);
      setPuroks(cached.puroks || []);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Auto trigger sync on reconnect
      try {
        const saved = localStorage.getItem('saint_francis_offline_queue');
        const q = saved ? JSON.parse(saved) : [];
        if (q.length > 0) {
          syncOfflineQueue(q);
        }
      } catch (e) {}
    };
    const goOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Initial load
    fetchHouseholdsAll();

    // Listen to background cache sync events to automatically update Households list reactively
    const handleSync = (e: any) => {
      const data = e.detail;
      if (data) {
        if (data.households) setHouseholds(data.households);
        if (data.masterlist) setSubmittedNamesList(data.masterlist);
        if (data.barangays) setBarangayList(data.barangays);
        if (data.puroks) setPuroks(data.puroks);
        setLoading(false);
      }
    };

    window.addEventListener(SFC_CACHE_SYNC_EVENT, handleSync);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener(SFC_CACHE_SYNC_EVENT, handleSync);
    };
  }, [currentUser]);

  const fetchSubmittedNames = async () => {
    await fetchHouseholdsAll();
  };

  const fetchHouseholdsAll = async () => {
    const cache = CacheSyncService.getCachedState();
    if (!cache.households || cache.households.length === 0) {
      setLoading(true);
    } else {
      setHouseholds(cache.households);
      setSubmittedNamesList(cache.masterlist || []);
      setBarangayList(cache.barangays || []);
      setPuroks(cache.puroks || []);
      setLoading(false);
    }

    try {
      const data = await CacheSyncService.performSync(currentUser.email);
      if (data) {
        setHouseholds(data.households || []);
        setSubmittedNamesList(data.masterlist || []);
        setBarangayList(data.barangays || []);
        setPuroks(data.puroks || []);
      }
    } catch (e) {
      console.error('Failed to consolidated fetch performance sync:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBarangays = async () => {
    // Left as direct no-op fallback redirecting to consolidated update to prevent any broken sub-component dependencies
    await fetchHouseholdsAll();
  };

  const fetchPuroks = async () => {
    // Left as direct no-op fallback redirecting to consolidated update to prevent any broken sub-component dependencies
    await fetchHouseholdsAll();
  };

  // Pre-fill coordinate accurately based on device GPS or selected Purok/Barangay recorded parameters
  const handleRandomCoordinates = () => {
    const fallbackLat = PUROK_COORDS_MAP[formPurok]?.[0] || BARANGAY_COORDS_MAP[formBarangay]?.[0] || 7.8284;
    const fallbackLng = PUROK_COORDS_MAP[formPurok]?.[1] || BARANGAY_COORDS_MAP[formBarangay]?.[1] || 123.4332;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormLat(position.coords.latitude.toFixed(5));
          setFormLng(position.coords.longitude.toFixed(5));
        },
        (error) => {
          console.warn("Geolocation skipped or denied, fallback to recorded coordinates:", error);
          setFormLat(fallbackLat.toFixed(5));
          setFormLng(fallbackLng.toFixed(5));
        },
        { enableHighAccuracy: true, timeout: 3500 }
      );
    } else {
      setFormLat(fallbackLat.toFixed(5));
      setFormLng(fallbackLng.toFixed(5));
    }
  };

  const handleAddMemberToWizard = () => {
    if (!hasNewMemberFirstName || !hasNewMemberLastName) return;

    const candidateName = `${hasNewMemberLastName.trim()}, ${hasNewMemberFirstName.trim()}`.replace(/\s+/g, ' ').toUpperCase();
    const inMembers = wizardMembers.some(m => `${m.lastName}, ${m.firstName}`.replace(/\s+/g, ' ').toUpperCase() === candidateName);
    const inDeps = wizardDependents.some(d => (d.fullName || '').replace(/\s+/g, ' ').toUpperCase() === candidateName);
    const inDB = submittedNamesList.some(item => 
      (item.fullName || '').replace(/\s+/g, ' ').toUpperCase() === candidateName &&
      (!editingHH || item.householdId !== editingHH.id)
    );

    if (inMembers || inDeps || inDB) {
      setAlertModal({
        isOpen: true,
        title: "Duplicate Resident Record",
        description: `The resident '${candidateName}' is already registered in the Citizen Masterlist database, or is currently added under this household. Duplicate entries are strictly prohibited.`,
        type: "error"
      });
      return;
    }

    setWizardMembers([...wizardMembers, {
      firstName: hasNewMemberFirstName,
      middleName: '',
      lastName: hasNewMemberLastName,
      relationship: hasNewMemberRelation,
      age: parseInt(hasNewMemberAge) || 25,
      gender: hasNewMemberGender,
      civilStatus: 'Single',
      occupation: 'Student'
    }]);
    setHasNewMemberFirstName('');
    setHasNewMemberLastName('');
  };

  const handleAddDependentToWizard = () => {
    if (!depLastName.trim() && !depFirstName.trim()) return;
    
    // Calculate Age
    let calcAge = 5;
    if (depBirthDate) {
      calcAge = new Date().getFullYear() - new Date(depBirthDate).getFullYear();
      calcAge = Math.max(0, calcAge);
    }

    const constructedFullName = `${depLastName.trim()}, ${depFirstName.trim()}${depNameExt.trim() ? ' ' + depNameExt.trim() : ''}${!depNoMN && depMiddleName.trim() ? ' ' + depMiddleName.trim() : ''}`.replace(/\s+/g, ' ').toUpperCase();
    const inMembers = wizardMembers.some(m => `${m.lastName}, ${m.firstName}`.replace(/\s+/g, ' ').toUpperCase() === constructedFullName);
    const inDeps = wizardDependents.some(d => (d.fullName || '').replace(/\s+/g, ' ').toUpperCase() === constructedFullName);
    const inDB = submittedNamesList.some(item => 
      (item.fullName || '').replace(/\s+/g, ' ').toUpperCase() === constructedFullName &&
      (!editingHH || item.householdId !== editingHH.id)
    );

    if (inMembers || inDeps || inDB) {
      setAlertModal({
        isOpen: true,
        title: "Duplicate Resident Record",
        description: `The resident '${constructedFullName}' is already registered in the Citizen Masterlist database, or is currently added under this household. Duplicate entries are strictly prohibited.`,
        type: "error"
      });
      return;
    }

    const newDep = {
      fullName: constructedFullName,
      lastName: depLastName.toUpperCase().trim(),
      firstName: depFirstName.toUpperCase().trim(),
      middleName: depNoMN ? '' : depMiddleName.toUpperCase().trim(),
      nameExt: depNameExt.toUpperCase().trim(),
      noMiddleName: depNoMN,
      mononym: depMononym,
      relationship: depRelation,
      birthdate: depBirthDate,
      birthDate: depBirthDate,
      civilStatus: depCivilStatus,
      gender: depSex,
      citizenship: depCitizenship,
      isDisabled: depIsDisabled,
      age: calcAge
    };

    setWizardDependents([...wizardDependents, newDep]);

    // Reset fields
    setDepLastName('');
    setDepFirstName('');
    setDepMiddleName('');
    setDepNameExt('');
    setDepNoMN(false);
    setDepMononym(false);
    setDepCitizenship('FILIPINO');
    setDepIsDisabled(false);
    setDepBirthDate('');
    setDepRelation('Child');
    setDepSex('Female');
    setDepCivilStatus('Single');
  };

  // Convert uploaded image or receipt to base64 with a smooth simulated async progress to prevent submit lag
  const handleUploadAttachment = () => {
    if (!selectedAttachmentFile) return;
    setUploadProgress(10);
    
    // Capture state values immediately at click-time!
    const currentLastName = pmrfLastName;
    const currentFirstName = pmrfFirstName;
    const currentIsFpePcsf = isFpePcsfOnly;
    const currentPcsfName = pcsfFullName;
    const currentHeadName = formHeadName;
    const currentManualOwner = tempManualOwnerName;
    const currentOwnerName = attachmentOwnerName;
    const currentAttachType = attachmentType;
    const currentFile = selectedAttachmentFile;

    let progressValue = 10;
    const interval = setInterval(() => {
      progressValue += Math.floor(Math.random() * 20) + 15;
      if (progressValue >= 100) {
        progressValue = 100;
        setUploadProgress(100);
        clearInterval(interval);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const calculatedHeadName = currentLastName && currentFirstName 
            ? `${currentLastName}, ${currentFirstName}` 
            : (currentIsFpePcsf ? currentPcsfName : currentHeadName);
            
          const owner = currentOwnerName === 'CUSTOM_NAME' || !currentOwnerName 
            ? (currentManualOwner.trim() || calculatedHeadName || 'Unassigned Member') 
            : currentOwnerName;
          
          const newAttachment = {
            fileData: reader.result as string,
            fullName: owner,
            documentType: currentAttachType,
            fileName: currentFile.name
          };
          
          setAttachmentsList(prev => [...prev, newAttachment]);
          setSelectedAttachmentFile(null);
          setUploadProgress(null);
          setTempManualOwnerName('');
          setAttachmentOwnerName('');
        };
        reader.readAsDataURL(currentFile);
      } else {
        setUploadProgress(progressValue);
      }
    }, 120);
  };

  const handleUploadAttachmentDrawer = () => {
    if (!selectedDrawerAttachmentFile || !selectedHH) return;
    setDrawerUploadProgress(10);
    
    // Capture state values immediately at click-time!
    const currentDrawerFile = selectedDrawerAttachmentFile;
    const currentDrawerOwnerName = drawerAttachmentOwnerName;
    const currentDrawerManualOwnerName = drawerTempManualOwnerName;
    const currentDrawerType = drawerAttachmentType;
    const hhRecord = selectedHH;

    let progressValue = 10;
    const interval = setInterval(async () => {
      progressValue += Math.floor(Math.random() * 20) + 15;
      if (progressValue >= 100) {
        progressValue = 100;
        setDrawerUploadProgress(100);
        clearInterval(interval);
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          const defaultOwnerName = hhRecord.household.householdHead || 'Unassigned Member';
          const owner = currentDrawerOwnerName === 'CUSTOM_NAME' || !currentDrawerOwnerName 
            ? (currentDrawerManualOwnerName.trim() || defaultOwnerName) 
            : currentDrawerOwnerName;
          
          const newAttachment = {
            fileData: reader.result as string,
            fullName: owner,
            documentType: currentDrawerType,
            fileName: currentDrawerFile.name
          };
          
          const updatedAttachments = [...(hhRecord.household.attachments || []), newAttachment];
          
          try {
            const res = await fetch('/api/households/edit', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-email': currentUser.email
              },
              body: JSON.stringify({
                id: hhRecord.household.id,
                householdData: {
                  ...hhRecord.household,
                  attachments: updatedAttachments
                },
                membersData: null,
                dependentsData: null
              })
            });
            if (res.ok) {
              // Update selectedHH local state
              setSelectedHH({
                ...hhRecord,
                household: {
                  ...hhRecord.household,
                  attachments: updatedAttachments
                }
              });
              // Also update main list
              setHouseholds(prev => prev.map(item => 
                item.id === hhRecord.household.id 
                  ? { ...item, attachments: updatedAttachments }
                  : item
              ));
              
              setAlertModal({
                isOpen: true,
                title: 'Attachment Uploaded Successfully',
                description: `Successfully attached ${currentDrawerType} file for ${owner}.`,
                type: 'success'
              });
            }
          } catch (err) {
            console.error(err);
          } finally {
            setSelectedDrawerAttachmentFile(null);
            setDrawerUploadProgress(null);
            setDrawerTempManualOwnerName('');
            setDrawerAttachmentOwnerName('');
          }
        };
        reader.readAsDataURL(currentDrawerFile);
      } else {
        setDrawerUploadProgress(progressValue);
      }
    }, 120);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedAttachmentFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedAttachmentFile(e.dataTransfer.files[0]);
    }
  };

  // Save Household Form as a Draft in local and cloud store
  const handleSaveFormAsDraft = async () => {
    const rawHeadName = pmrfLastName && pmrfFirstName 
      ? `${pmrfLastName}, ${pmrfFirstName}` 
      : (isFpePcsfOnly ? pcsfFullName : formHeadName);
    
    const calculatedHeadName = (rawHeadName || '').trim();

    if (!calculatedHeadName) {
      setAlertModal({
        isOpen: true,
        title: 'Draft Identity Required',
        description: isFpePcsfOnly 
          ? "Please fill out at least the Beneficiary Name/Full Name in the PCSF details section to save a draft."
          : "Please fill out at least the Member's Last Name and First Name or Household Head to save a draft.",
        type: 'error'
      });
      return;
    }

    try {
      setSubmissionLoadingTitle('Saving Household Draft');
      setSubmissionLoadingMsg('Optimizing payload data and caching on device memory...');
      setSubmissionLoading(true);

      // Minor delay to show cache preparation loading state
      await new Promise(resolve => setTimeout(resolve, 850));

      const fields = {
        isFpePcsfOnly,
        isNewMemberFpe,
        formHeadName, formContact, formBarangay, formPurok, formLat, formLng, formPmrf, formYakap,
        pmrfPurpose, pmrfKonsulta, pmrfPin, pmrfLastName, pmrfFirstName, pmrfNameExt, pmrfMiddleName,
        pmrfMotherMaiden, pmrfSpouseName, pmrfBirthDate, pmrfBirthPlace, pmrfSex, pmrfCivilStatus,
        pmrfMotherLastName, pmrfMotherFirstName, pmrfMotherNameExt, pmrfMotherMiddleName, pmrfMotherNoMiddleName, pmrfMotherMononym,
        pmrfSpouseLastName, pmrfSpouseFirstName, pmrfSpouseNameExt, pmrfSpouseMiddleName, pmrfSpouseNoMiddleName, pmrfSpouseMononym,
        pmrfMemberNoMiddleName, pmrfMemberMononym,
        pmrfCitizenship, pmrfPhilsysNo, pmrfTin, pmrfAddressUnit, pmrfAddressStreet, pmrfAddressSubdivision,
        pmrfAddressZip, pmrfAddressUnitNoFloor, pmrfAddressBuildingName, pmrfAddressBarangay, pmrfAddressMunicipality, pmrfAddressProvince,
        pmrfMailSame, pmrfMailUnit, pmrfMailStreet, pmrfMailSubdivision, pmrfMailZip,
        pmrfMailUnitNoFloor, pmrfMailBuildingName, pmrfMailBarangay, pmrfMailMunicipality, pmrfMailProvince,
        pmrfHomePhone, pmrfMobileNo, pmrfBusinessDirect, pmrfEmail, pmrfContributorCategory,
        pmrfContributorType, pmrfProfession, pmrfMonthlyIncome, pmrfProofOfIncome,
        pmrfBackChangeName, pmrfBackChangeDOB, pmrfBackChangeSex, pmrfBackChangeCivilStatus, pmrfBackChangePersonalInfo,
        pmrfBackFromValueName, pmrfBackToValueName, pmrfBackFromValueDOB, pmrfBackToValueDOB,
        pmrfBackFromValueSex, pmrfBackToValueSex, pmrfBackFromValueCivil, pmrfBackToValueCivil,
        pmrfBackFromValueInfo, pmrfBackToValueInfo, pmrfBackSignature, pmrfBackSignatureDate,
        pmrfBackThumbmark, pmrfBackSameAsFront, pmrfBackReceivedByFullName, pmrfBackReceivedByBranch,
        pmrfBackReceivedByDateTime,
        fpeCcNone, fpeCcFever, fpeCcCough, fpeCcBodyPain, fpeCcDyspnea, fpeCcOthers,
        fpeMhHypertension, fpeMhDiabetes, fpeMhAstmaCopd, fpeMhHeart, fpeMhStroke, fpeMhCancer,
        fpeMhTb, fpeMhKidney, fpeMhNone, fpeFhHypertension, fpeFhDiabetes, fpeFhHeart, fpeFhCancer,
        fpeFhNone, fpeShSmoking, fpeShAlcohol, fpeShOccupation, fpeMedNone, fpeMedSpecify,
        fpeVitalBp, fpeVitalWt, fpeVitalHt, fpeVitalHr, fpeVitalRr, fpeVitalBmi, fpeVitalTemp,
        fpeVitalWaist, fpeVitalUpperArm, fpeVitalMidArm, fpePhysicalExam, fpeAssessmentPlan, fpeAddress,
        pcsfType, pcsfDate, pcsfFullName, pcsfAddressBarangay, pcsfAddressCity, pcsfAddressProvince,
        pcsfContactNo, pcsfEmail, pcsfRegisterPcc, pcsfRegisterDependents, pcsfPcc1, pcsfPcc1Addr,
        pcsfPcc2, pcsfPcc2Addr, pcsfTransfer, pcsfPrevPcc, pcsfTransferPcc1, pcsfTransferPcc1Addr,
        pcsfTransferPcc2, pcsfTransferPcc2Addr, pcsfHouseholdNumber, pcsfHouseholdId, pcsfDependentId,
        pcsfMemberCategory, wizardMembers, wizardDependents, attachmentsList, patientSignature
      };

      const finalDraftId = draftId || 'draft_' + Math.random().toString(36).substr(2, 9);
      
      const draftObj = {
        id: finalDraftId,
        accountId: currentUser?.email || 'unassigned_account',
        residentialArea: formBarangay || currentUser?.address || 'Unassigned Area',
        lastModified: new Date().toISOString(),
        status: 'Draft',
        syncStatus: (connectionStatus === 'offline' ? 'Local Only' : 'Waiting for Sync'),
        formData: fields
      };

      // 1. Write locally to SFC list of drafts
      let stored: string | null = null;
      try {
        stored = localStorage.getItem('sfc_household_drafts');
      } catch (err) {
        console.warn('Failed to read from localStorage:', err);
      }
      
      let allDrafts: any[] = [];
      if (stored) {
        try {
          allDrafts = JSON.parse(stored);
          if (!Array.isArray(allDrafts)) {
            allDrafts = [];
          }
        } catch (e) {
          allDrafts = [];
        }
      }

      const existingIdx = allDrafts.findIndex((d: any) => d && d.id === finalDraftId);
      if (existingIdx > -1) {
        allDrafts[existingIdx] = draftObj;
      } else {
        allDrafts.push(draftObj);
      }

      try {
        localStorage.setItem('sfc_household_drafts', JSON.stringify(allDrafts));
      } catch (storageErr: any) {
        console.warn('Local storage quota full or restricted. Attempting compact reservation save...', storageErr);
        // Stripping heavy base64 parts from local storage copies to bypass the 5MB browser quota
        const sanitizePayload = (d: any) => {
          if (!d || !d.formData) return d;
          const clone = JSON.parse(JSON.stringify(d));
          if (clone.formData) {
            if (clone.formData.patientSignature) {
              clone.formData.patientSignature = "[Signature Preserved in Cloud Upload]";
            }
            if (clone.formData.pmrfBackSignature) {
              clone.formData.pmrfBackSignature = "[Signature Preserved in Cloud Upload]";
            }
            if (clone.formData.pmrfBackThumbmark) {
              clone.formData.pmrfBackThumbmark = "[Thumbmark Preserved in Cloud Upload]";
            }
            if (Array.isArray(clone.formData.attachmentsList)) {
              clone.formData.attachmentsList = clone.formData.attachmentsList.map((attach: any) => ({
                ...attach,
                fileData: "[File Data Preserved in Cloud Upload]"
              }));
            }
          }
          return clone;
        };

        const compactDrafts = allDrafts.map(sanitizePayload);
        try {
          localStorage.setItem('sfc_household_drafts', JSON.stringify(compactDrafts));
          console.log('[LOCAL CACHE COMPACTED] Saved lightweight drafts metadata successfully.');
        } catch (innerErr: any) {
          console.error('Lightweight caching failed:', innerErr);
        }
      }

      // 2. Clear current transient local draft
      try {
        localStorage.removeItem('saint_francis_household_form_draft');
      } catch (err) {
        // Safe ignore
      }

      // 3. If online, upload to remote drafts endpoint immediately
      if (connectionStatus !== 'offline') {
        setSubmissionLoadingMsg('Establishing cloud registry handshake & uploading secure packet...');
        try {
          const res = await fetch('/api/drafts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser?.email || ''
            },
            body: JSON.stringify(draftObj)
          });
          if (res.ok) {
            // Update syncStatus to Synced locally
            draftObj.syncStatus = 'Synced';
            const updated = allDrafts.map((d: any) => d && d.id === finalDraftId ? draftObj : d);
            try {
              localStorage.setItem('sfc_household_drafts', JSON.stringify(updated));
            } catch (quotaErr) {
              // Ignore or apply compact again
            }
          }
        } catch (err) {
          console.error('Remote draft synchronization failed:', err);
        }
        // Brief pause for visual confirmation of handshake success
        await new Promise(resolve => setTimeout(resolve, 850));
      } else {
        // Safe extra delay offline to ensure loader presence is perceived
        await new Promise(resolve => setTimeout(resolve, 650));
      }

      setSubmissionLoading(false);

      // 4. Modal success feedback & Close modal, reset form states
      setShowAddModal(false);
      setDraftId(null);
      setIsDraftOnlyMode(false);
      resetPMRFStates();
      
      setAlertModal({
        isOpen: true,
        title: 'Draft Saved Successfully',
        description: `Household formulation "${calculatedHeadName}" has been secure-drafted. You can resume editing or submit it for approval from your "Drafts (Offline)" page.`,
        type: 'success'
      });

    } catch (e: any) {
      setSubmissionLoading(false);
      console.error('Failed to save household draft:', e);
      setAlertModal({
        isOpen: true,
        title: 'Draft Saving Aborted',
        description: `An unexpected error occurred while caching draft values: ${e?.message || e}`,
        type: 'error'
      });
    }
  };

  // POST new household
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedHeadName = pmrfLastName && pmrfFirstName 
      ? `${pmrfLastName}, ${pmrfFirstName}` 
      : (isFpePcsfOnly ? pcsfFullName : formHeadName);
    if (!calculatedHeadName) {
      setAlertModal({
        isOpen: true,
        title: 'Form Validation Required',
        description: isFpePcsfOnly 
          ? "Please fill out at least the Beneficiary Name/Full Name in the PCSF details section."
          : "Please fill out at least the Member's Last Name and First Name in the PhilHealth PMRF details section.",
        type: 'error'
      });
      return;
    }

    // Require Signature & Attachment for standard household registration
    if (!isFpePcsfOnly) {
      if (!patientSignature) {
        setAlertModal({
          isOpen: true,
          title: "Patient Sworn Signature Seal Required",
          description: "Please have the patient or authorized representative sign the Patient Sworn Signature Seal under Section II of the form to complete the household registration.",
          type: "error"
        });
        return;
      }

      if (attachmentsList.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "Add Household File Required",
          description: "Please upload and attach at least one proof document under 'Attachments (Dossier Identity Verification Logs)' by selecting a file and clicking 'Attach to Household Files' to complete the household registration.",
          type: "error"
        });
        return;
      }
    }

    // Client-side Duplicate Check for strict full-name unique record matching
    const duplicatesFound: string[] = [];
    
    // Check Head
    const headUpper = calculatedHeadName.replace(/\s+/g, ' ').toUpperCase();
    if (submittedNamesList.some(item => 
      (item.fullName || '').toUpperCase() === headUpper &&
      (!editingHH || item.householdId !== editingHH.id)
    )) {
      duplicatesFound.push(calculatedHeadName);
    }
    
    // Check Members
    if (Array.isArray(wizardMembers)) {
      wizardMembers.forEach(m => {
        const mName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`.replace(/\s+/g, ' ').toUpperCase();
        if (submittedNamesList.some(item => 
          (item.fullName || '').toUpperCase() === mName &&
          (!editingHH || item.householdId !== editingHH.id)
        )) {
          duplicatesFound.push(`${m.lastName}, ${m.firstName}`);
        }
      });
    }

    // Check Dependents
    if (Array.isArray(wizardDependents)) {
      wizardDependents.forEach(d => {
        const dName = (d.fullName || '').replace(/\s+/g, ' ').toUpperCase();
        if (submittedNamesList.some(item => 
          (item.fullName || '').toUpperCase() === dName &&
          (!editingHH || item.householdId !== editingHH.id)
        )) {
          duplicatesFound.push(d.fullName);
        }
      });
    }

    if (duplicatesFound.length > 0) {
      setAlertModal({
        isOpen: true,
        title: 'Duplicate Citizen Record Detected',
        description: `The following resident(s) are already registered in the General Citizen Masterlist Directory: ${duplicatesFound.join(', ')}. Duplicate entries are strictly prohibited to ensure database integrity.`,
        type: 'error'
      });
      return;
    }

    // MOTHER'S MAIDEN NAME validation request
    if (!isFpePcsfOnly) {
      if (!pmrfMotherLastName.trim() || !pmrfMotherFirstName.trim()) {
        setAlertModal({
          isOpen: true,
          title: "Mother's Maiden Name Required",
          description: "Please fill out the Mother's Maiden Name (Last Name and First Name) in Section I of the PhilHealth PMRF details.",
          type: "error"
        });
        return;
      }
      if (!pmrfAddressSubdivision.trim()) {
        setAlertModal({
          isOpen: true,
          title: "Purok/Subdivision Required",
          description: "Please provide the Subdivision (Purok) under 'II. ADDRESS AND CONTACT DETAILS' as this is a required field.",
          type: "error"
        });
        return;
      }
      if (!pmrfAddressBarangay.trim()) {
        setAlertModal({
          isOpen: true,
          title: "Barangay Required",
          description: "Please provide the Barangay under 'II. ADDRESS AND CONTACT DETAILS' as this is a required field.",
          type: "error"
        });
        return;
      }
    }

    // Auto-harvest typed-in but uncommitted dependent record
    let finalDependentsList = [...wizardDependents];
    if (depLastName.trim() || depFirstName.trim()) {
      let calcAge = 5;
      if (depBirthDate) {
        calcAge = new Date().getFullYear() - new Date(depBirthDate).getFullYear();
        calcAge = Math.max(0, calcAge);
      }
      const constructedFullName = `${depLastName.trim()}, ${depFirstName.trim()}${depNameExt.trim() ? ' ' + depNameExt.trim() : ''}${!depNoMN && depMiddleName.trim() ? ' ' + depMiddleName.trim() : ''}`.replace(/\s+/g, ' ').toUpperCase();
      
      const autoDep = {
        fullName: constructedFullName,
        lastName: depLastName.toUpperCase().trim(),
        firstName: depFirstName.toUpperCase().trim(),
        middleName: depNoMN ? '' : depMiddleName.toUpperCase().trim(),
        nameExt: depNameExt.toUpperCase().trim(),
        noMiddleName: depNoMN,
        mononym: depMononym,
        relationship: depRelation,
        birthdate: depBirthDate,
        birthDate: depBirthDate,
        civilStatus: depCivilStatus,
        gender: depSex,
        citizenship: depCitizenship,
        isDisabled: depIsDisabled,
        age: calcAge
      };

      if (!finalDependentsList.some(d => d.fullName === autoDep.fullName)) {
        finalDependentsList.push(autoDep);
      }
    }

    const payload = {
      draftId: draftId,
      isFpePcsfOnly: isFpePcsfOnly,
      isNewMemberFpe: isNewMemberFpe,
      householdData: {
        householdHead: calculatedHeadName,
        contactNumber: pmrfMobileNo || formContact,
        barangay: formBarangay,
        purok: formPurok,
        latitude: parseFloat(formLat),
        longitude: parseFloat(formLng),
        pmrfStatus: formPmrf,
        yakapWillingStatus: formYakap,
        attachments: attachmentsList,
        patientSignature: patientSignature || undefined,
        pmrfDetails: {
          patientSignature: patientSignature || undefined,
          purpose: pmrfPurpose,
          konsulta: pmrfKonsulta,
          pin: pmrfPin,
          lastName: pmrfLastName,
          firstName: pmrfFirstName,
          nameExt: pmrfNameExt,
          middleName: pmrfMiddleName,
          motherMaiden: pmrfMotherMaiden,
          motherLastName: pmrfMotherLastName,
          pmrfMotherLastName,
          motherFirstName: pmrfMotherFirstName,
          pmrfMotherFirstName,
          motherMiddleName: pmrfMotherMiddleName,
          pmrfMotherMiddleName,
          motherNameExt: pmrfMotherNameExt,
          pmrfMotherNameExt,
          motherNoMiddleName: pmrfMotherNoMiddleName,
          pmrfMotherNoMiddleName,
          pmrfMotherNoMN: pmrfMotherNoMiddleName,
          motherNoMN: pmrfMotherNoMiddleName,
          motherMononym: pmrfMotherMononym,
          pmrfMotherMononym,
          
          spouseName: pmrfSpouseName,
          spouseLastName: pmrfSpouseLastName,
          pmrfSpouseLastName,
          spouseFirstName: pmrfSpouseFirstName,
          pmrfSpouseFirstName,
          spouseMiddleName: pmrfSpouseMiddleName,
          pmrfSpouseMiddleName,
          spouseNameExt: pmrfSpouseNameExt,
          pmrfSpouseNameExt,
          spouseNoMiddleName: pmrfSpouseNoMiddleName,
          pmrfSpouseNoMiddleName,
          pmrfSpouseNoMN: pmrfSpouseNoMiddleName,
          spouseNoMN: pmrfSpouseNoMiddleName,
          spouseMononym: pmrfSpouseMononym,
          pmrfSpouseMononym,
          birthDate: pmrfBirthDate,
          birthPlace: pmrfBirthPlace,
          sex: pmrfSex,
          civilStatus: pmrfCivilStatus,
          citizenship: pmrfCitizenship,
          philsysNo: pmrfPhilsysNo,
          tin: pmrfTin,
          addressUnit: pmrfAddressUnit,
          addressStreet: pmrfAddressStreet,
          addressSubdivision: pmrfAddressSubdivision,
          addressZip: pmrfAddressZip,
          addressUnitNoFloor: pmrfAddressUnitNoFloor,
          addressBuildingName: pmrfAddressBuildingName,
          addressBarangay: pmrfAddressBarangay,
          addressMunicipality: pmrfAddressMunicipality,
          addressProvince: pmrfAddressProvince,
          mailSame: pmrfMailSame,
          mailUnit: pmrfMailSame ? pmrfAddressUnit : pmrfMailUnit,
          mailStreet: pmrfMailSame ? pmrfAddressStreet : pmrfMailStreet,
          mailSubdivision: pmrfMailSame ? pmrfAddressSubdivision : pmrfMailSubdivision,
          mailZip: pmrfMailSame ? pmrfAddressZip : pmrfMailZip,
          mailUnitNoFloor: pmrfMailSame ? pmrfAddressUnitNoFloor : pmrfMailUnitNoFloor,
          mailBuildingName: pmrfMailSame ? pmrfAddressBuildingName : pmrfMailBuildingName,
          mailBarangay: pmrfMailSame ? pmrfAddressBarangay : pmrfMailBarangay,
          mailMunicipality: pmrfMailSame ? pmrfAddressMunicipality : pmrfMailMunicipality,
          mailProvince: pmrfMailSame ? pmrfAddressProvince : pmrfMailProvince,
          homePhone: pmrfHomePhone,
          mobileNo: pmrfMobileNo,
          businessDirect: pmrfBusinessDirect,
          email: pmrfEmail,
          contributorCategory: pmrfContributorCategory,
          contributorType: pmrfContributorType,
          pmrfGroupSchemeName,
          pmrfPraSrrvNo,
          pmrfAcrICardNo,
          pmrfPwdIdNo,
          profession: pmrfProfession,
          monthlyIncome: pmrfMonthlyIncome,
          proofOfIncome: pmrfProofOfIncome,
          // PMRF Back variables
          pmrfBackChangeName,
          pmrfBackChangeDOB,
          pmrfBackChangeSex,
          pmrfBackChangeCivilStatus,
          pmrfBackChangePersonalInfo,
          pmrfBackFromValueName,
          pmrfBackToValueName,
          pmrfBackFromValueDOB,
          pmrfBackToValueDOB,
          pmrfBackFromValueSex,
          pmrfBackToValueSex,
          pmrfBackFromValueCivil,
          pmrfBackToValueCivil,
          pmrfBackFromValueInfo,
          pmrfBackToValueInfo,
          pmrfBackSignature,
          pmrfBackSignatureDate,
          pmrfBackThumbmark,
          pmrfBackSameAsFront,
          pmrfBackReceivedByFullName,
          pmrfBackReceivedByBranch,
          pmrfBackReceivedByDateTime,
          // FPE details container
          fpeDetails: {
            ccNone: fpeCcNone,
            ccFever: fpeCcFever,
            ccCough: fpeCcCough,
            ccBodyPain: fpeCcBodyPain,
            ccDyspnea: fpeCcDyspnea,
            ccOthers: fpeCcOthers,
            mhHypertension: fpeMhHypertension,
            mhDiabetes: fpeMhDiabetes,
            mhAstmaCopd: fpeMhAstmaCopd,
            mhHeart: fpeMhHeart,
            mhStroke: fpeMhStroke,
            mhCancer: fpeMhCancer,
            mhTb: fpeMhTb,
            mhKidney: fpeMhKidney,
            mhNone: fpeMhNone,
            fhHypertension: fpeFhHypertension,
            fhDiabetes: fpeFhDiabetes,
            fhHeart: fpeFhHeart,
            fhCancer: fpeFhCancer,
            fhNone: fpeFhNone,
            shSmoking: fpeShSmoking,
            shAlcohol: fpeShAlcohol,
            shOccupation: fpeShOccupation,
            medNone: fpeMedNone,
            medSpecify: fpeMedSpecify,
            vitalBp: fpeVitalBp,
            vitalWt: fpeVitalWt,
            vitalHt: fpeVitalHt,
            vitalHr: fpeVitalHr,
            vitalRr: fpeVitalRr,
            vitalBmi: fpeVitalBmi,
            vitalTemp: fpeVitalTemp,
            vitalWaist: fpeVitalWaist,
            vitalUpperArm: fpeVitalUpperArm,
            vitalMidArm: fpeVitalMidArm,
            physicalExam: fpePhysicalExam,
            assessmentPlan: fpeAssessmentPlan,
            address: fpeAddress
          },
          // PCSF details container
          pcsfDetails: {
            type: pcsfType,
            date: pcsfDate,
            fullName: pcsfFullName,
            addressBarangay: pcsfAddressBarangay,
            addressCity: pcsfAddressCity,
            addressProvince: pcsfAddressProvince,
            contactNo: pcsfContactNo,
            email: pcsfEmail,
            registerPcc: pcsfRegisterPcc,
            registerDependents: pcsfRegisterDependents,
            pcc1: pcsfPcc1,
            pcc1Addr: pcsfPcc1Addr,
            pcc2: pcsfPcc2,
            pcc2Addr: pcsfPcc2Addr,
            transfer: pcsfTransfer,
            prevPcc: pcsfPrevPcc,
            transferPcc1: pcsfTransferPcc1,
            transferPcc1Addr: pcsfTransferPcc1Addr,
            transferPcc2: pcsfTransferPcc2,
            transferPcc2Addr: pcsfTransferPcc2Addr,
            householdNumber: pcsfHouseholdNumber,
            householdId: pcsfHouseholdId,
            dependentId: pcsfDependentId,
            memberCategory: pcsfMemberCategory
          }
        }
      },
      membersData: wizardMembers,
      dependentsData: finalDependentsList
    };

    if (editingHH) {
      if (!navigator.onLine || !isOnline) {
        setAlertModal({
          isOpen: true,
          title: 'Offline Action Restricted',
          description: 'Modifying existing profiles requires an active internet connection to preserve database sync integrity.',
          type: 'error'
        });
        return;
      }

      const editPayload = {
        id: editingHH.id,
        householdData: {
          ...editingHH,
          householdHead: calculatedHeadName,
          contactNumber: pmrfMobileNo || formContact,
          barangay: formBarangay,
          purok: formPurok,
          latitude: parseFloat(formLat) || editingHH.latitude,
          longitude: parseFloat(formLng) || editingHH.longitude,
          pmrfStatus: formPmrf,
          yakapWillingStatus: formYakap,
          attachments: attachmentsList,
          patientSignature: patientSignature || undefined,
          pmrfDetails: {
            ...editingHH.pmrfDetails,
            patientSignature: patientSignature || undefined,
            purpose: pmrfPurpose,
            konsulta: pmrfKonsulta,
            pin: pmrfPin,
            lastName: pmrfLastName,
            firstName: pmrfFirstName,
            nameExt: pmrfNameExt,
            middleName: pmrfMiddleName,
            motherMaiden: pmrfMotherMaiden,
            motherLastName: pmrfMotherLastName,
            pmrfMotherLastName,
            motherFirstName: pmrfMotherFirstName,
            pmrfMotherFirstName,
            motherMiddleName: pmrfMotherMiddleName,
            pmrfMotherMiddleName,
            motherNameExt: pmrfMotherNameExt,
            pmrfMotherNameExt,
            motherNoMiddleName: pmrfMotherNoMiddleName,
            pmrfMotherNoMiddleName,
            pmrfMotherNoMN: pmrfMotherNoMiddleName,
            motherNoMN: pmrfMotherNoMiddleName,
            motherMononym: pmrfMotherMononym,
            pmrfMotherMononym,
            
            spouseName: pmrfSpouseName,
            spouseLastName: pmrfSpouseLastName,
            pmrfSpouseLastName,
            spouseFirstName: pmrfSpouseFirstName,
            pmrfSpouseFirstName,
            spouseMiddleName: pmrfSpouseMiddleName,
            pmrfSpouseMiddleName,
            spouseNameExt: pmrfSpouseNameExt,
            pmrfSpouseNameExt,
            spouseNoMiddleName: pmrfSpouseNoMiddleName,
            pmrfSpouseNoMiddleName,
            spouseNoMN: pmrfSpouseNoMiddleName,
            spouseMononym: pmrfSpouseMononym,
            pmrfSpouseMononym,
            birthDate: pmrfBirthDate,
            birthPlace: pmrfBirthPlace,
            sex: pmrfSex,
            civilStatus: pmrfCivilStatus,
            citizenship: pmrfCitizenship,
            philsysNo: pmrfPhilsysNo,
            tin: pmrfTin,
            addressUnit: pmrfAddressUnit,
            addressStreet: pmrfAddressStreet,
            addressSubdivision: pmrfAddressSubdivision,
            addressZip: pmrfAddressZip,
            addressUnitNoFloor: pmrfAddressUnitNoFloor,
            addressBuildingName: pmrfAddressBuildingName,
            addressBarangay: pmrfAddressBarangay,
            addressMunicipality: pmrfAddressMunicipality,
            addressProvince: pmrfAddressProvince,
            mailSame: pmrfMailSame,
            mailUnit: pmrfMailSame ? pmrfAddressUnit : pmrfMailUnit,
            mailStreet: pmrfMailSame ? pmrfAddressStreet : pmrfMailStreet,
            mailSubdivision: pmrfMailSame ? pmrfAddressSubdivision : pmrfMailSubdivision,
            mailZip: pmrfMailSame ? pmrfAddressZip : pmrfMailZip,
            mailUnitNoFloor: pmrfMailSame ? pmrfAddressUnitNoFloor : pmrfMailUnitNoFloor,
            mailBuildingName: pmrfMailSame ? pmrfAddressBuildingName : pmrfMailBuildingName,
            mailBarangay: pmrfMailSame ? pmrfAddressBarangay : pmrfMailBarangay,
            mailMunicipality: pmrfMailSame ? pmrfAddressMunicipality : pmrfMailMunicipality,
            mailProvince: pmrfMailSame ? pmrfAddressProvince : pmrfMailProvince,
            homePhone: pmrfHomePhone,
            mobileNo: pmrfMobileNo,
            businessDirect: pmrfBusinessDirect,
            email: pmrfEmail,
            contributorCategory: pmrfContributorCategory,
            contributorType: pmrfContributorType,
            pmrfGroupSchemeName,
            pmrfPraSrrvNo,
            pmrfAcrICardNo,
            pmrfPwdIdNo,
            profession: pmrfProfession,
            monthlyIncome: pmrfMonthlyIncome,
            proofOfIncome: pmrfProofOfIncome,
            // PMRF Back variables
            pmrfBackChangeName,
            pmrfBackChangeDOB,
            pmrfBackChangeSex,
            pmrfBackChangeCivilStatus,
            pmrfBackChangePersonalInfo,
            pmrfBackFromValueName,
            pmrfBackToValueName,
            pmrfBackFromValueDOB,
            pmrfBackToValueDOB,
            pmrfBackFromValueSex,
            pmrfBackToValueSex,
            pmrfBackFromValueCivil,
            pmrfBackToValueCivil,
            pmrfBackFromValueInfo,
            pmrfBackToValueInfo,
            pmrfBackSignature,
            pmrfBackSignatureDate,
            pmrfBackThumbmark,
            pmrfBackSameAsFront,
            pmrfBackReceivedByFullName,
            pmrfBackReceivedByBranch,
            pmrfBackReceivedByDateTime,
            // FPE details container
            fpeDetails: {
              ccNone: fpeCcNone,
              ccFever: fpeCcFever,
              ccCough: fpeCcCough,
              ccBodyPain: fpeCcBodyPain,
              ccDyspnea: fpeCcDyspnea,
              ccOthers: fpeCcOthers,
              mhHypertension: fpeMhHypertension,
              mhDiabetes: fpeMhDiabetes,
              mhAstmaCopd: fpeMhAstmaCopd,
              mhHeart: fpeMhHeart,
              mhStroke: fpeMhStroke,
              mhCancer: fpeMhCancer,
              mhTb: fpeMhTb,
              mhKidney: fpeMhKidney,
              mhNone: fpeMhNone,
              fhHypertension: fpeFhHypertension,
              fhDiabetes: fpeFhDiabetes,
              fhHeart: fpeFhHeart,
              fhCancer: fpeFhCancer,
              fhNone: fpeFhNone,
              shSmoking: fpeShSmoking,
              shAlcohol: fpeShAlcohol,
              shOccupation: fpeShOccupation,
              medNone: fpeMedNone,
              medSpecify: fpeMedSpecify,
              vitalBp: fpeVitalBp,
              vitalWt: fpeVitalWt,
              vitalHt: fpeVitalHt,
              vitalHr: fpeVitalHr,
              vitalRr: fpeVitalRr,
              vitalBmi: fpeVitalBmi,
              vitalTemp: fpeVitalTemp,
              vitalWaist: fpeVitalWaist,
              vitalUpperArm: fpeVitalUpperArm,
              vitalMidArm: fpeVitalMidArm,
              physicalExam: fpePhysicalExam,
              assessmentPlan: fpeAssessmentPlan,
              address: fpeAddress
            },
            // PCSF details container
            pcsfDetails: {
              type: pcsfType,
              date: pcsfDate,
              fullName: pcsfFullName,
              addressBarangay: pcsfAddressBarangay,
              addressCity: pcsfAddressCity,
              addressProvince: pcsfAddressProvince,
              contactNo: pcsfContactNo,
              email: pcsfEmail,
              registerPcc: pcsfRegisterPcc,
              registerDependents: pcsfRegisterDependents,
              pcc1: pcsfPcc1,
              pcc1Addr: pcsfPcc1Addr,
              pcc2: pcsfPcc2,
              pcc2Addr: pcsfPcc2Addr,
              transfer: pcsfTransfer,
              prevPcc: pcsfPrevPcc,
              transferPcc1: pcsfTransferPcc1,
              transferPcc1Addr: pcsfTransferPcc1Addr,
              transferPcc2: pcsfTransferPcc2,
              transferPcc2Addr: pcsfTransferPcc2Addr,
              householdNumber: pcsfHouseholdNumber,
              householdId: pcsfHouseholdId,
              dependentId: pcsfDependentId,
              memberCategory: pcsfMemberCategory
            }
          }
        },
        membersData: wizardMembers,
        dependentsData: finalDependentsList
      };

      try {
        setSubmissionLoading(true);
        setSubmissionLoadingMsg('Initiating secure packet transmission...');

        const msgSequence = [
          'Running server-side data integrity handshake...',
          'Executing PhilHealth member category validation...',
          'Finalizing household health-worker verification stamp...'
        ];

        let msgIndex = 0;
        const intervalId = setInterval(() => {
          if (msgIndex < msgSequence.length) {
            setSubmissionLoadingMsg(msgSequence[msgIndex]);
            msgIndex++;
          }
        }, 450);

        const startTime = Date.now();

        const pmrfData = { dependents: editPayload.dependentsData || [] };
        console.log("PMRF Dependents being submitted (edit):", pmrfData.dependents);
        console.log(pmrfData.dependents);

        const res = await fetch('/api/households/edit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': currentUser.email
          },
          body: JSON.stringify(editPayload)
        });

        // Enforce nice minimal loading display time (1500ms) for visual balance and feedback
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500) {
          await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
        }

        clearInterval(intervalId);
        setSubmissionLoading(false);

        if (res.ok) {
          setShowAddModal(false);
          setEditingHH(null);
          resetPMRFStates();
          fetchHouseholdsAll();
          if (selectedHH && selectedHH.household.id === editingHH.id) {
            setSelectedHH(null); // Force reload
          }
          setAlertModal({
            isOpen: true,
            title: 'Household Saved Successfully',
            description: 'The household details and matching PMRF records have been updated successfully.',
            type: 'success'
          });
        } else {
          const errorData = await res.json();
          setAlertModal({
            isOpen: true,
            title: 'Updation Failed',
            description: errorData.error || 'Failed to update household details.',
            type: 'error'
          });
        }
      } catch (err) {
        setSubmissionLoading(false);
        console.error(err);
        setAlertModal({
          isOpen: true,
          title: 'Connection Error',
          description: 'Network handshake error updating household details.',
          type: 'error'
        });
      }
      return;
    }

    if (!navigator.onLine || !isOnline) {
      console.log('[Offline Support] Offline status detected. Saving to browser local queuing storage.');
      handleSaveToOfflineQueue(payload);
      return;
    }

    try {
      setSubmissionLoading(true);
      setSubmissionLoadingMsg('Initiating secure packet transmission...');

      const msgSequence = [
        'Running server-side data integrity handshake...',
        'Executing PhilHealth member category validation...',
        'Finalizing household health-worker verification stamp...'
      ];

      let msgIndex = 0;
      const intervalId = setInterval(() => {
        if (msgIndex < msgSequence.length) {
          setSubmissionLoadingMsg(msgSequence[msgIndex]);
          msgIndex++;
        }
      }, 450);

      const startTime = Date.now();

      const pmrfData = { dependents: payload.dependentsData || [] };
      console.log("PMRF Dependents being submitted (add):", pmrfData.dependents);
      console.log(pmrfData.dependents);

      const res = await fetch('/api/households/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify(payload)
      });

      // Enforce nice minimal loading display time (1500ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
      }

      clearInterval(intervalId);
      setSubmissionLoading(false);

      if (res.ok) {
        setShowAddModal(false);
        resetPMRFStates();
        fetchHouseholdsAll();

        // Clean up draft if this was loaded from a saved draft
        if (draftId) {
          try {
            // Delete from server drafts store background call
            fetch('/api/drafts/delete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-email': currentUser.email
              },
              body: JSON.stringify({ id: draftId })
            }).catch(e => console.warn('Clean server drafts list post ignored.'));

            // Clean up browser drafts storage
            const stored = localStorage.getItem('sfc_household_drafts');
            const allDrafts = stored ? JSON.parse(stored) : [];
            const updated = allDrafts.filter((x: any) => x.id !== draftId);
            localStorage.setItem('sfc_household_drafts', JSON.stringify(updated));
          } catch (e) {
            console.warn('Failed to clear submitted drafts items:', e);
          }
          if (onClearActiveDraft) {
            onClearActiveDraft();
          }
          setDraftId(null);
        }

        setAlertModal({
          isOpen: true,
          title: isFpePcsfOnly ? 'FPE/PCSF Registered Successfully' : 'Household Added Successfully',
          description: isFpePcsfOnly 
            ? 'The FPE/PCSF details have been submitted and successfully added to the database records.'
            : 'The household profile has been registered and queued for verification successfully.',
          type: 'success'
        });
      } else {
        const errorData = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Submission Failed',
          description: errorData.error || 'Failed to submit the household file.',
          type: 'error'
        });
      }
    } catch (e) {
      setSubmissionLoading(false);
      console.warn('[Offline Support] Active communication error. Automatically saving to browser local queuing storage.');
      handleSaveToOfflineQueue(payload);
    }
  };


  // Select household for details tabs
  const handleOpenHHDetail = async (hh: Household) => {
    setSubmissionLoadingTitle('Loading Household Profile');
    setSubmissionLoadingMsg('Establishing secure concurrency lock session...');
    setSubmissionLoading(true);
    try {
      // Concurrency lock check
      const lockRes = await fetch(`/api/households/${hh.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, name: currentUser.fullName, clientId })
      });
      const lockData = await lockRes.json();
      if (!lockRes.ok || !lockData.success) {
        setSubmissionLoading(false);
        setLockWarningModal({
          isOpen: true,
          lockedBy: lockData.lockedBy || { name: 'Another operator', email: 'unknown' }
        });
        return;
      }

      setSubmissionLoadingMsg('Fetching complete demographic & clinical profile registers...');
      const res = await fetch(`/api/households/${hh.id}/all`, {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const fullData = await res.json();
        setSelectedHH(fullData);
        setLockedHHId(hh.id);
        setActiveTab('details');
        
        if (fullData.household?.isNewMemberFpe || fullData.household?.isFpePcsfOnly) {
          setViewedFormTab('FPE');
        } else {
          setViewedFormTab('PMRF');
        }
        
        // Calculate initial compliance score based on data items
        let initialScore = 35;
        if (fullData.household.pmrfStatus === 'Willing') initialScore += 25;
        if (fullData.household.yakapWillingStatus === 'Willing') initialScore += 25;
        if (fullData.household.contactNumber) initialScore += 10;
        if (fullData.members && fullData.members.length > 1) initialScore += 5;
        setComplianceIndex(Math.min(initialScore, 100));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmissionLoading(false);
    }
  };

  // Soft delete action
  const handleSoftDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email)) {
      setAlertModal({
        isOpen: true,
        title: 'Access Denied',
        description: 'Only the Master Admin can archive or delete household records!',
        type: 'error'
      });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Archive Household Record",
      description: "Are you sure you want to move this household profile, including all members and FPE submissions, to the system Recycle Bin? Active personnel can restore this later.",
      onConfirm: async () => {
        setConfirmModal(null);
        setSubmissionLoadingTitle('Deleting/Archiving Household File');
        setSubmissionLoadingMsg('Purging household registers and archiving dependent attachments...');
        setSubmissionLoading(true);
        try {
          const res = await fetch('/api/households/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          fetchHouseholdsAll();
          if (selectedHH && selectedHH.household.id === id) {
            setSelectedHH(null);
          }
          setAlertModal({
            isOpen: true,
            title: 'Household Archived',
            description: 'The household record has been successfully moved to the Recycle Bin.',
            type: 'success'
          });
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Action Failed',
            description: err.message || 'Permission denied or error occurring.',
            type: 'error'
          });
        } finally {
          setSubmissionLoading(false);
        }
      }
    });
  };

  // Restore action (ADMIN API simulator)
  const handleRestoreHousehold = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const target = households.find(h => h.id === id);
      if (!target) return;
      const res = await fetch('/api/households/restore', {
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
          title: 'Household Restored',
          description: 'The household record has been successfully restored to active records.',
          type: 'success'
        });
        fetchHouseholdsAll();
      } else {
        const errData = await res.json().catch(() => ({}));
        setAlertModal({
          isOpen: true,
          title: 'Restore Failed',
          description: errData.error || 'Permission denied or error occurring.',
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error(e);
      setAlertModal({
        isOpen: true,
        title: 'Restore Failed',
        description: e.message || 'Error occurred while contacting server.',
        type: 'error'
      });
    }
  };

  const handleEmptyRecycleBin = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Empty Recycle Bin Permanently?',
      description: 'Are you sure you want to permanently delete all archived household profiles, members, and FPE files in the Recycle Bin? This action is IRREVERSIBLE and cannot be undone.',
      confirmText: 'Empty Permanently',
      onConfirm: async () => {
        setConfirmModal(null);
        setSubmissionLoadingTitle('Emptying Recycle Bin');
        setSubmissionLoadingMsg('Permanently purging archived folders, dependents, and clinical audit traces...');
        setSubmissionLoading(true);
        try {
          const res = await fetch('/api/households/empty-recycle-bin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            }
          });
          if (res.ok) {
            setAlertModal({
              isOpen: true,
              title: 'Recycle Bin Emptied',
              description: 'All archived households, associated members, and FPE structures have been permanently erased from the database.',
              type: 'success'
            });
            fetchHouseholdsAll();
          } else {
            const errData = await res.json().catch(() => ({}));
            setAlertModal({
              isOpen: true,
              title: 'Empty Failed',
              description: errData.error || 'Server error occurred during execution.',
              type: 'error'
            });
          }
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: 'Empty Failed',
            description: err.message || 'Error occurred while contacting server.',
            type: 'error'
          });
        } finally {
          setSubmissionLoading(false);
        }
      }
    } as any);
  };

  const handleOpenEdit = async (h: Household, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Concurrency lock check
      const lockRes = await fetch(`/api/households/${h.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, name: currentUser.fullName, clientId })
      });
      const lockData = await lockRes.json();
      if (!lockRes.ok || !lockData.success) {
        setLockWarningModal({
          isOpen: true,
          lockedBy: lockData.lockedBy || { name: 'Another operator', email: 'unknown' }
        });
        return;
      }

      const res = await fetch(`/api/households/${h.id}/all`, {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const fullData = await res.json();
        setEditingHH(fullData.household);
        setLockedHHId(h.id);
        loadHouseholdToPMRFStates(fullData);
        setIsFpePcsfOnly(false);
        setActiveFormTab('PMRF');
        setShowAddModal(true);
      } else {
        setAlertModal({
          isOpen: true,
          title: 'Retrieval Failed',
          description: 'Could not fetch full household profile records for editing.',
          type: 'error'
        });
      }
    } catch (err) {
      console.error("Failed to fetch full household data for editing:", err);
      setAlertModal({
        isOpen: true,
        title: 'Network Error',
        description: 'Failed to communicate with service to load full data.',
        type: 'error'
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHH) return;
    if (!editBarangay.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Barangay Required",
        description: "Barangay is a required field.",
        type: "error"
      });
      return;
    }
    if (!editPurok.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Purok/Subdivision Required",
        description: "Purok/Subdivision is a required field.",
        type: "error"
      });
      return;
    }
    try {
      const res = await fetch('/api/households/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          id: editingHH.id,
          householdData: {
            ...editingHH,
            householdHead: editHeadName,
            contactNumber: editContact,
            barangay: editBarangay,
            purok: editPurok,
            latitude: parseFloat(editLat) || editingHH.latitude,
            longitude: parseFloat(editLng) || editingHH.longitude,
            pmrfStatus: editPmrf,
            yakapWillingStatus: editYakap,
            completeAddress: `${editPurok}, ${editBarangay}`
          },
          membersData: null,
          dependentsData: null
        })
      });

      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Household Saved Successfully',
          description: 'The household details have been updated successfully.',
          type: 'success'
        });
        setEditingHH(null);
        fetchHouseholdsAll();
        if (selectedHH && selectedHH.household.id === editingHH.id) {
          setSelectedHH(null); // Force reload to reflect fresh data
        }
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Updation Failed',
          description: err.error || 'Failed to update household details.',
          type: 'error'
        });
      }
    } catch (e) {
      setAlertModal({
        isOpen: true,
        title: 'Connection Error',
        description: 'Network handshake error updating household details.',
        type: 'error'
      });
    }
  };

  // Client filtering
  const activeHouseholds = households.filter(h => {
    // Soft deleted filter
    if (showRecycleBin) {
      return !!(h as any).deletedAt;
    } else {
      // Show only Pending and Approved on the Households page (Disapproved are shown in Disapproved Submissions)
      return !(h as any).deletedAt && (h.approvalStatus === 'Approved' || h.approvalStatus === 'Pending');
    }
  });

  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  const filtered = activeHouseholds.filter(h => {
    const bName = h.barangay || '';
    const pName = h.purok || '';
    const matchBarangay = !selectedBarangay || bName === selectedBarangay;
    const matchPurok = !selectedPurok || pName === selectedPurok;

    const headName = h.householdHead || '';
    const headNum = h.householdNumber || '';
    const query = (deferredSearchTerm || '').toLowerCase();
    const matchSearch = !deferredSearchTerm || 
                        headName.toLowerCase().includes(query) || 
                        headNum.toLowerCase().includes(query);
    return matchBarangay && matchPurok && matchSearch;
  });

  // Sort
  if (sortOrder === 'a-z') {
    filtered.sort((a,b) => a.householdHead.localeCompare(b.householdHead));
  } else if (sortOrder === 'date-newest') {
    filtered.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortOrder === 'date-oldest') {
    filtered.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Households Pagination
  const hhPageSize = 30;
  const totalHhPages = Math.ceil(filtered.length / hhPageSize);
  const activeHhPage = Math.min(hhPage, totalHhPages > 0 ? totalHhPages : 1);
  const paginatedHouseholds = filtered.slice((activeHhPage - 1) * hhPageSize, activeHhPage * hhPageSize);

  // Active unique puroks selection for add wizard
  const selectedBarangayObj = barangayList.find(b => b.name === formBarangay);
  const addFormPuroks = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBarangayObj?.id) || p.barangay === formBarangay);

  if (isDraftOnlyMode && !showAddModal) {
    return null;
  }

  return (
    <div className="space-y-4 font-sans">
      
      {/* Offline Status & Local Queue Sync Warning Alert Banner */}
      {!isDraftOnlyMode && !isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-amber-805">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <div>
              <span className="font-extrabold text-[12px] uppercase text-amber-900 tracking-wider">Offline Mode Active</span>
              <p className="text-amber-700 font-bold text-[11px] mt-0.5">You are currently disconnected from Saint Francis network. Registered files will save safely to your browser cache and sync once internet is restored.</p>
            </div>
          </div>
          {offlineQueue.length > 0 && (
            <div className="font-extrabold text-amber-950 bg-amber-100 border border-amber-250 rounded-lg px-2.5 py-1 text-[11px]">
              {offlineQueue.length} Pending Local Registrations
            </div>
          )}
        </div>
      )}

      {/* Sync Active Banner */}
      {!isDraftOnlyMode && isOnline && offlineQueue.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="animate-pulse text-sky-600 font-extrabold text-sm">🔄</div>
            <div>
              <span className="font-extrabold text-[12px] uppercase text-sky-900 tracking-wide">Pending Offline Files Queue</span>
              <p className="text-slate-600 font-bold text-[11px] mt-0.5">You have {offlineQueue.length} registered file entries in your browser database. Please verify and synchronize them now.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => syncOfflineQueue()}
            disabled={isSyncing}
            className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold uppercase text-[10px] py-2 px-3.5 rounded-lg shadow-md transition disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1"
          >
            {isSyncing ? 'Synchronizing Archive...' : 'Synchronize Queue'}
          </button>
        </div>
      )}

      {!isDraftOnlyMode && !showAddModal && (
        <>
          {/* Search and Controllers */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Left indicators & adds */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-add-file"
            onClick={() => {
              if (checkActionPermission(currentUser, 'action-household-create')) {
                setShowAddFileModal(true);
              }
            }}
            disabled={!checkActionPermission(currentUser, 'action-household-create')}
            className={`${
              checkActionPermission(currentUser, 'action-household-create')
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black border-emerald-700 shadow-[0_4px_0_0_#047857] hover:brightness-105 active:shadow-[0_1px_0_0_#047857] active:translate-y-[3px] cursor-pointer' 
                : 'bg-slate-200 text-slate-400 border-slate-300 shadow-[0_4px_0_0_#cbd5e1] cursor-not-allowed'
            } border-b-[4px] flex items-center justify-center gap-2 text-xs px-5 py-3 font-extrabold rounded-xl transition-all duration-75 uppercase tracking-wider`}
            title={!checkActionPermission(currentUser, 'action-household-create') ? "Lacks custom privilege to formulate/create households" : "Add a new Household record"}
          >
            <Plus className="h-4.5 w-4.5 stroke-[3px]" /> ADD FILE
          </button>

          {/* Recycle Bin toggler ONLY AUTHORIZED */}
          {checkActionPermission(currentUser, 'action-household-restore-empty') && (
            <button
              onClick={() => setShowRecycleBin(!showRecycleBin)}
              className={`flex items-center gap-1 border text-xs px-3 py-2 rounded-lg transition ${
                showRecycleBin 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <Trash className="h-4 w-4" />
              <span>{showRecycleBin ? 'Close Recycle Bin' : 'Recycle Bin'}</span>
            </button>
          )}

          <div className="flex border border-slate-200 bg-slate-50 rounded-lg p-0.5">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search file heads..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setHhPage(1); }}
              className="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs py-2 pl-8 pr-2 w-full md:w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedBarangay}
            onChange={(e) => { setSelectedBarangay(e.target.value); setSelectedPurok(''); setHhPage(1); }}
            className="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] py-2 px-1 focus:outline-none cursor-pointer"
          >
            <option value="">All Barangays</option>
            {barangayList.map((b, i) => (
              <option key={i} value={b.name}>{b.name}</option>
            ))}
          </select>

          <select
            value={selectedPurok}
            onChange={(e) => { setSelectedPurok(e.target.value); setHhPage(1); }}
            className="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] py-2 px-1 focus:outline-none cursor-pointer"
          >
            <option value="">All Puroks</option>
            {puroks
              .filter(p => !selectedBarangay || p.barangay === selectedBarangay)
              .map((p, i) => (
                <option key={i} value={p.name}>{p.name} ({p.barangay})</option>
              ))
            }
          </select>

          <select
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value as any); setHhPage(1); }}
            className="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] py-2 px-1 focus:outline-none cursor-pointer"
          >
            <option value="date-newest">Date (Newest)</option>
            <option value="date-oldest">Date (Oldest)</option>
            <option value="a-z">A-Z Name Sort</option>
          </select>
        </div>
      </div>

      {/* RECYCLE BIN WARNING */}
      {showRecycleBin && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-red-900 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse flex-shrink-0" />
            <div>
              <strong className="font-semibold block text-red-800">Recycle Bin Active</strong>
              Viewing soft-deleted files. Only Clinical Administrators can restore or permanently erase database archives.
            </div>
          </div>
          {households.some(h => !!(h as any).deletedAt) && (
            <button
              onClick={handleEmptyRecycleBin}
              className="flex items-center gap-1.5 self-start md:self-auto bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm hover:shadow active:scale-95 cursor-pointer text-[11px] uppercase tracking-wider"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Empty Recycle Bin</span>
            </button>
          )}
        </div>
      )}

      {/* LIST OR GRID VIEW PANEL */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
          <p className="text-sm text-slate-400 mt-2 font-medium">Fetching file coordinates...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
           No matching households found.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
          {paginatedHouseholds.map((h) => (
            <div 
              key={h.id}
              onClick={() => handleOpenHHDetail(h)}
              className={`bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[170px] ${
                h.approvalStatus === 'Approved' ? 'border-l-4 border-l-emerald-500 border-slate-100' :
                h.approvalStatus === 'Disapproved' ? 'border-l-4 border-l-red-500 border-slate-100 bg-red-50/10' :
                'border-l-4 border-l-amber-500 border-slate-100 bg-amber-50/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-400 font-semibold">{h.householdNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                    h.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    h.approvalStatus === 'Disapproved' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {h.approvalStatus}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 mt-2 text-sm leading-tight hover:text-blue-600">{h.householdHead}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  {h.barangay}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                  <div>Contact: <span className="text-slate-600 font-medium">{h.contactNumber || 'N/A'}</span></div>
                  <div>PMRF: <span className="text-slate-600 font-medium">{h.pmrfStatus}</span></div>
                </div>
              </div>

              <div className="border-t border-slate-50 pt-3 mt-3 flex justify-between items-center text-[10px]">
                <span className="text-slate-400">By: {h.createdBy}</span>
                {showRecycleBin ? (
                  <button 
                    onClick={(e) => handleRestoreHousehold(h.id, e)}
                    className="text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 font-bold"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                ) : (
                  <button 
                    onClick={(e) => handleOpenEdit(h, e)}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-bold"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 h-10 text-slate-500 font-semibold uppercase tracking-wider pl-4">
                <th className="py-2 pl-4">HH Number</th>
                <th className="py-2">Head Name</th>
                <th className="py-2">Barangay</th>
                <th className="py-2">Purok</th>
                <th className="py-2">PMRF Status</th>
                <th className="py-2">Approved Status</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedHouseholds.map((h) => (
                <tr 
                  key={h.id} 
                  onClick={() => handleOpenHHDetail(h)}
                  className={`hover:bg-slate-50 transition cursor-pointer border-l-4 ${
                    h.approvalStatus === 'Approved' ? 'border-l-emerald-500 hover:border-l-emerald-600' :
                    h.approvalStatus === 'Disapproved' ? 'border-l-red-500 hover:border-l-red-600' :
                    'border-l-amber-500 hover:border-l-amber-600'
                  }`}
                >
                  <td className="py-3 pl-4 font-mono font-medium text-slate-400">{h.householdNumber}</td>
                  <td className="py-3 font-semibold text-slate-800">{h.householdHead}</td>
                  <td className="py-3 text-slate-600">{h.barangay}</td>
                  <td className="py-3 text-slate-500">{h.purok}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      h.pmrfStatus === 'Willing' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {h.pmrfStatus}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      h.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                      h.approvalStatus === 'Disapproved' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {h.approvalStatus}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {showRecycleBin ? (
                      <button 
                        onClick={(e) => handleRestoreHousehold(h.id, e)}
                        className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center justify-end gap-1 ml-auto"
                      >
                        <RotateCcw className="h-3 w-3" /> Restore
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => handleOpenEdit(h, e)}
                        className="text-blue-600 hover:text-blue-800 font-bold flex items-center justify-end gap-1 ml-auto"
                      >
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Households list/grid pagination navigation controls */}
      {totalHhPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm mt-4">
          <span className="text-[10px] font-medium text-slate-500 font-sans">
            Showing <span className="font-bold text-slate-800">{(activeHhPage - 1) * hhPageSize + 1}-{Math.min(filtered.length, activeHhPage * hhPageSize)}</span> of <span className="font-bold text-slate-800">{filtered.length}</span> household listings
          </span>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activeHhPage === 1}
              onClick={() => setHhPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalHhPages }).map((_, i) => {
              const pageNum = i + 1;
              const isCurrent = pageNum === activeHhPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setHhPage(pageNum)}
                  className={`min-w-7 h-7 flex items-center justify-center text-[10px] font-black rounded-lg border transition cursor-pointer ${
                    isCurrent 
                      ? 'bg-blue-600 font-extrabold border-blue-600 text-white shadow-xs' 
                      : 'border-slate-200 text-slate-500 hover:text-slate-850 hover:bg-slate-50 bg-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={activeHhPage === totalHhPages}
              onClick={() => setHhPage(prev => Math.min(totalHhPages, prev + 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* FULL EXPANSION MODAL DRAWER */}
      {selectedHH && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-[10010] animate-fade-in font-sans">
          <div className="bg-white w-full max-w-4xl h-full flex flex-col p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedHH(null)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-lg font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="font-mono text-xs text-slate-400 font-semibold">{selectedHH.household.householdNumber}</span>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-1.5 leading-tight">
                  <Home className="h-5 w-5 text-blue-600" />
                  {selectedHH.household.householdHead}
                </h2>
                <button
                  type="button"
                  onClick={(e) => handleOpenEdit(selectedHH.household, e)}
                  className="mr-8 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] uppercase flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Edit2 className="h-3 w-3" /> Edit Profile
                </button>
              </div>
              <p className="text-xs text-slate-500">{selectedHH.household.completeAddress}</p>
            </div>

            {/* Expansion Tab Header */}
            <div className="flex border-b border-slate-100 mt-6 text-xs font-semibold text-slate-400 gap-4">
              {[
                { id: 'details', label: 'Details', icon: Bookmark },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'dependents', label: 'Dependents', icon: FileText },
                { id: 'attachments', label: 'Attachments', icon: Folder },
                { id: 'health', label: 'Health DB', icon: Plus },
                { id: 'logs', label: 'Audit Trail', icon: Activity }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 border-b-2 flex items-center gap-1 transition-all duration-200 ${
                    activeTab === tab.id ? 'border-b-2 border-emerald-600 text-emerald-600 font-bold' : 'border-transparent hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTAINER BODY */}
            <div className="flex-1 overflow-y-auto py-4 text-xs">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Dynamic interactive details hover grids with slide markers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-white hover:scale-[1.03] hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-green-400 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300"></div>
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider">Household Identifier</span>
                      <strong className="text-slate-800 text-sm font-mono mt-1 block">{selectedHH.household.householdNumber}</strong>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-white hover:scale-[1.03] hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 to-lime-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300"></div>
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider">Contact Number</span>
                      <strong className="text-slate-800 text-sm mt-1 block">{selectedHH.household.contactNumber || 'No registered contact'}</strong>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-white hover:scale-[1.03] hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-lime-400 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300"></div>
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider">Barangay Zone</span>
                      <strong className="text-slate-800 text-sm mt-1 block">{selectedHH.household.barangay}</strong>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-white hover:scale-[1.03] hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-lime-400 to-emerald-400 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300"></div>
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase tracking-wider">Purok Subdivision</span>
                      <strong className="text-slate-800 text-sm mt-1 block">{selectedHH.household.purok}</strong>
                    </div>
                  </div>

                  {/* Geotag pointer grid with slide scales */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-white hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group relative overflow-hidden space-y-3">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-600 to-lime-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300"></div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white/50 p-1.5 rounded-lg border border-slate-100">
                      <h3 className="font-extrabold text-slate-700 flex items-center gap-1.5 text-[10px] uppercase tracking-wider leading-none">
                        <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                        Geotag Coordinate System
                      </h3>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedHH.household.latitude},${selectedHH.household.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1 px-3 bg-[#111827] hover:bg-emerald-650 hover:scale-[1.02] text-white font-extrabold text-[9px] uppercase tracking-widest flex items-center gap-1 transition-all rounded shadow-sm cursor-pointer select-none"
                        title="Click to view location in Google Maps"
                      >
                        🗺️ Coordinate on Map
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 block font-extrabold text-[8.5px] uppercase">Latitude Pointer</span>
                        <strong className="text-slate-800 font-mono text-sm font-black">{selectedHH.household.latitude}°</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-extrabold text-[8.5px] uppercase">Longitude Pointer</span>
                        <strong className="text-slate-800 font-mono text-sm font-black">{selectedHH.household.longitude}°</strong>
                      </div>
                    </div>
                  </div>

                  {/* HIGH-GRAPHICS GRADIENT ASSESSMENT INDEX BAR & EXPLICIT RATING SLIDER */}
                  <div className="bg-gradient-to-tr from-emerald-50/70 via-green-50/50 to-lime-50/60 p-5 rounded-2xl border border-emerald-100 shadow-sm space-y-3 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                    <div className="absolute right-0 top-0 h-16 w-16 bg-gradient-to-bl from-emerald-200/40 to-transparent rounded-bl-full pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-950 font-extrabold uppercase tracking-widest leading-none">
                        <Sparkles className="h-4 w-4 text-emerald-600 animate-spin" style={{ animationDuration: '6s' }} />
                        <span>Interactive Health Compliance Score</span>
                      </div>
                      <span className="text-[11px] font-black font-mono text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-full select-none shadow-[xs]">
                        {complianceIndex}% SCORE
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                      Leader / Admin sliding rating tool: Adjust the real-time operational compliance score to evaluate food safety protocols and localized sanitation status.
                    </p>

                    <div className="space-y-2 pt-1">
                      {/* High graphics slider */}
                      <div className="relative flex items-center">
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={complianceIndex} 
                          onChange={(e) => setComplianceIndex(parseInt(e.target.value))}
                          className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 active:scale-[0.99] transition"
                        />
                      </div>

                      {/* Volumetric progress preview track that moves with the slider */}
                      <div className="relative w-full h-3 bg-slate-100 rounded-full border border-slate-200 p-[1px] shadow-[inset_0_2px_3px_rgba(0,0,0,0.08)] overflow-hidden">
                        <div 
                          style={{ width: `${complianceIndex}%` }}
                          className="bg-gradient-to-r from-emerald-500 via-green-400 to-lime-500 h-full rounded-full transition-all duration-300"
                        >
                          <div className="absolute inset-0 bg-white/25 rounded-l-full h-[30%]"></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-400 uppercase tracking-wider select-none leading-none pt-1">
                        <span className={complianceIndex < 40 ? 'text-red-600 font-black' : ''}>⚠️ Critical Area</span>
                        <span className={complianceIndex >= 40 && complianceIndex < 80 ? 'text-green-600' : ''}>✔️ Standard Line</span>
                        <span className={complianceIndex >= 80 ? 'text-emerald-700 font-black' : ''}>🌟 Optimal Status</span>
                      </div>
                    </div>
                  </div>

                  {/* Extra hover cards: status lists */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-emerald-200 hover:scale-[1.04] hover:shadow-md transition-all duration-250 cursor-pointer">
                      <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-1 leading-none">PMRF Status</span>
                      <strong className={`font-mono text-[10px] ${selectedHH.household.pmrfStatus === 'Willing' ? 'text-emerald-600' : 'text-slate-750'}`}>{selectedHH.household.pmrfStatus}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-emerald-200 hover:scale-[1.04] hover:shadow-md transition-all duration-250 cursor-pointer">
                      <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-1 leading-none">SFC Enrollment STATUS</span>
                      <strong className="text-slate-700 font-mono text-[10px]">{selectedHH.household.yakapWillingStatus}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-emerald-200 hover:scale-[1.04] hover:shadow-md transition-all duration-250 cursor-pointer">
                      <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-1 leading-none">Operational Status</span>
                      <strong className={`font-mono text-[10px] ${selectedHH.household.approvalStatus === 'Approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedHH.household.approvalStatus}</strong>
                    </div>
                  </div>

                  {/* Interactive Digital Twin PMRF/FPE/PCSF Form Views */}
                  <div className="mt-6 border-t border-slate-200 pt-6 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">📄 Document Dossier / Form Layout Twin</h3>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Viewer only. Click "Edit Profile" at top right to alter information.</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-extrabold text-[10px] uppercase flex items-center gap-1 shadow-sm cursor-pointer ml-auto"
                        >
                          🖨️ Print Active Form
                        </button>
                      </div>
                    </div>

                    {/* Secondary Tabs Selector */}
                    <div className="flex border-b border-slate-200 text-[10px] font-bold gap-2">
                      {[
                        { id: 'PMRF', label: 'PMRF FORM' },
                        { id: 'FPE', label: 'FPE FORM' },
                        { id: 'PCSF', label: 'PCSF FORM' }
                      ].filter(t => {
                        if (t.id === 'PMRF') {
                          return !selectedHH?.household?.isFpePcsfOnly && !selectedHH?.household?.isNewMemberFpe;
                        }
                        return true;
                      }).map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setViewedFormTab(t.id as any)}
                          className={`pb-2 px-1 border-b-2 transition ${
                            viewedFormTab === t.id ? 'border-b-2 border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Visual Scroll Hint for Mobile Screens */}
                    <div className="block lg:hidden text-center bg-blue-50/50 border border-blue-100 text-blue-700 rounded-lg py-2 px-3 text-[10px] font-extrabold uppercase tracking-wide animate-pulse">
                      📱 Tip: Swipe left/right or scroll horizontally to inspect the full document dossier
                    </div>
                    
                    {/* High Fidelity Printable Form Sheet Area */}
                    <div id="printable-form-area" className="bg-white border-2 border-slate-900 p-4 sm:p-6 space-y-5 max-w-full overflow-x-auto pb-4 text-slate-900 print:p-0 print:border-none rounded-xl shadow-inner min-w-full lg:min-w-0">
                      {viewedFormTab === 'PMRF' && (
                        <div className="space-y-4 font-sans text-[10px] uppercase text-slate-900">
                          
                          {/* PMRF Header Banner */}
                          <div className="border border-slate-900 bg-slate-50 p-3 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                              <PhilHealthLogo className="h-10 w-10 md:h-12 md:w-12" />
                              <div className="text-left">
                                <h3 className="font-extrabold text-[10px] leading-tight tracking-wide text-slate-900">Republic of the Philippines</h3>
                                <h4 className="text-[11px] font-black tracking-wider uppercase text-[#1a56db] leading-none">PHILIPPINE HEALTH INSURANCE CORPORATION</h4>
                              </div>
                            </div>
                            <div className="text-center font-bold px-4 py-1.5 border-l border-r border-slate-300">
                              <h2 className="text-[20px] font-black tracking-widest text-slate-900 leading-none">PMRF</h2>
                              <p className="text-[7.5px] text-slate-500 uppercase mt-1 block font-black leading-none">PhilHealth Member Registration Form</p>
                              <span className="text-[6px] text-slate-450 block mt-0.5 tracking-tight font-mono">PHIC-PMRF-2024-V2</span>
                            </div>
                            <div className="text-left w-full md:w-auto">
                              <span className="text-[7.5px] font-black block text-slate-500 mb-1 leading-none">PHILHEALTH IDENTIFICATION NUMBER (PIN)</span>
                              <div className="px-3.5 py-1.5 font-mono tracking-widest text-[#1a56db] font-black border-2 border-[#1a56db] rounded-md bg-blue-50/50 text-center w-full md:w-44 text-sm shadow-sm">
                                {selectedHH.household.pmrfDetails?.pin || '12-005938450-4'}
                              </div>
                            </div>
                          </div>

                          {/* SECTION I: PERSONAL DETAILS (MEMBER) */}
                          <div className="border border-slate-900 bg-white">
                            <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-slate-900">
                              SECTION I: PERSONAL DETAILS OF MEMBER
                            </div>
                            <div className="grid grid-cols-4 border-b border-slate-900">
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">LAST NAME</label>
                                <span className="font-black text-slate-900 text-[11px] leading-none block">{selectedHH.household.pmrfDetails?.lastName || 'REPRESENTATIVE'}</span>
                              </div>
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">FIRST NAME</label>
                                <span className="font-black text-slate-900 text-[11px] leading-none block">{selectedHH.household.pmrfDetails?.firstName || selectedHH.household.householdHead}</span>
                              </div>
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">MIDDLE NAME</label>
                                <span className="font-black text-slate-900 text-[11px] leading-none block">{selectedHH.household.pmrfDetails?.middleName || 'N/A'}</span>
                              </div>
                              <div className="col-span-1 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">NAME EXT (JR/SR/III)</label>
                                <span className="font-black text-slate-900 text-[11px] leading-none block">{selectedHH.household.pmrfDetails?.nameExt || 'NONE'}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 border-b border-slate-900 bg-slate-50/20">
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">MOTHER'S MAIDEN NAME (LAST, FIRST, MIDDLE)</label>
                                <span className="font-black text-slate-800 text-[10px] leading-none block">{selectedHH.household.pmrfDetails?.motherMaiden || 'DE LA CRUZ, MARIA REYES'}</span>
                              </div>
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">SPOUSE NAME (IF MARRIED)</label>
                                <span className="font-black text-slate-800 text-[10px] leading-none block">{selectedHH.household.pmrfDetails?.spouseName || 'N/A'}</span>
                              </div>
                              <div className="col-span-1 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">PHILSYS CARD NUM (PHILIPPINE ID)</label>
                                <span className="font-mono font-black text-slate-800 text-[10px] leading-none block">{selectedHH.household.pmrfDetails?.philsysNo || '6123-4567-8901-2345'}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-4">
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">DATE OF BIRTH</label>
                                <span className="font-mono font-black text-slate-900 text-[10px] leading-none block">{selectedHH.household.pmrfDetails?.birthDate || '06/25/1988'}</span>
                              </div>
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">PLACE OF BIRTH (PROVINCE/CITY)</label>
                                <span className="font-black text-slate-900 text-[10px] leading-none block">{selectedHH.household.pmrfDetails?.birthPlace || 'ZAMBOANGA DEL SUR, PAGADIAN'}</span>
                              </div>
                              <div className="col-span-1 border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">SEX</label>
                                <span className="font-black text-slate-900 text-[10px] leading-none block">
                                  {selectedHH.household.pmrfDetails?.sex === 'Female' ? '☒ FEMALE  ☐ MALE' : '☐ FEMALE  ☒ MALE'}
                                </span>
                              </div>
                              <div className="col-span-1 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">CIVIL STATUS</label>
                                <span className="font-black text-slate-900 text-[9px] leading-none block uppercase">
                                  {selectedHH.household.pmrfDetails?.civilStatus || 'MARRIED'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* SECTION II: ADDRESS AND CONTACT LOGISTICS */}
                          <div className="border border-slate-900 bg-white">
                            <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-slate-900">
                              SECTION II: ADDRESS AND CONTACT LOGISTICS
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-900">
                              <div className="border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">HOME / PERMANENT ADDRESS</label>
                                <span className="font-black text-slate-900 text-[10px] leading-snug block">
                                  {`${selectedHH.household.pmrfDetails?.addressUnit || ''} ${selectedHH.household.pmrfDetails?.addressStreet || ''} ${selectedHH.household.pmrfDetails?.addressSubdivision || ''}, BARANGAY ${selectedHH.household.barangay}, PUROK ${selectedHH.household.purok}, PAGADIAN CITY, ${selectedHH.household.pmrfDetails?.addressZip || '7016'}`.trim()}
                                </span>
                              </div>
                              <div className="p-1.5 bg-slate-50/10">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">MAILING ADDRESS</label>
                                <span className="font-black text-slate-900 text-[10px] leading-snug block">
                                  {selectedHH.household.pmrfDetails?.mailSame ? 'SAME AS PERMANENT ADDRESS' : 
                                    `${selectedHH.household.pmrfDetails?.mailUnit || ''} ${selectedHH.household.pmrfDetails?.mailStreet || ''} ${selectedHH.household.pmrfDetails?.mailSubdivision || ''}, PAGADIAN, ${selectedHH.household.pmrfDetails?.mailZip || '7016'}`.trim()}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3">
                              <div className="border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">MOBILE PHONE NO.</label>
                                <span className="font-mono font-black text-slate-900 text-[11px] block">{selectedHH.household.contactNumber || '0912-345-6789'}</span>
                              </div>
                              <div className="border-r border-slate-900 p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">EMAIL ADDRESS</label>
                                <span className="font-mono font-black text-slate-800 text-[10px] block">{selectedHH.household.pmrfDetails?.email || 'N/A'}</span>
                              </div>
                              <div className="p-1.5">
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">TIN (TAX IDENTIFICATION NUMBER)</label>
                                <span className="font-mono font-black text-slate-900 text-[11px] block">{selectedHH.household.pmrfDetails?.tin || 'XXX-XXX-XXX'}</span>
                              </div>
                            </div>
                          </div>

                          {/* SECTION III: DECLARATION OF DEPENDENTS (GRID EXPLICIT REPLICA) */}
                          <div className="border border-slate-900 bg-white">
                            <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-slate-900">
                              SECTION III: DECLARATION OF DEPENDENTS
                            </div>
                            <div className="overflow-x-auto w-full block">
                              <table className="w-full text-[8px] border-collapse min-w-[780px]">
                                <thead>
                                  <tr className="bg-slate-100 border-b border-slate-900 font-extrabold text-slate-800 text-center uppercase">
                                    <th className="border-r border-slate-900 py-1.5 px-2 text-left w-[12%]">FIRST NAME</th>
                                    <th className="border-r border-slate-900 py-1.5 px-2 text-left w-[12%]">LAST NAME</th>
                                    <th className="border-r border-slate-900 py-1.5 px-1 w-[8%] text-center font-bold">NAME EXT</th>
                                    <th className="border-r border-slate-900 py-1.5 px-2 text-left w-[12%]">MIDDLE NAME</th>
                                    <th className="border-r border-slate-900 py-1.5 px-1.5 w-[11%] text-center">RELATIONSHIP</th>
                                    <th className="border-r border-slate-900 py-1.5 px-1.5 w-[11%] text-center">DATE OF BIRTH</th>
                                    <th className="border-r border-slate-900 py-1.5 px-1 w-[6%] text-center">SEX</th>
                                    <th className="border-r border-slate-900 py-1.5 px-2 text-left w-[12%]">CITIZENSHIP</th>
                                    <th className="border-r border-slate-900 py-1.5 px-1 w-[5%] text-center">NO MN</th>
                                    <th className="border-r border-slate-900 py-1.5 px-1 w-[5%] text-center">MONONYM</th>
                                    <th className="py-1.5 px-1 w-[6%] text-center font-bold">PSWD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const rowsCount = Math.max(4, selectedHH.dependents?.length || 0);
                                    return Array.from({ length: rowsCount }).map((_, idx) => {
                                      const dep = (selectedHH.dependents && selectedHH.dependents.length > 0)
                                        ? selectedHH.dependents[idx]
                                        : null;

                                      let firstName = '';
                                      let lastName = '';
                                      let nameExt = '';
                                      let middleName = '';

                                      if (dep) {
                                        firstName = dep.firstName || '';
                                        lastName = dep.lastName || '';
                                        nameExt = dep.nameExt || '';
                                        middleName = dep.middleName || '';

                                        // Fallback if structured fields are empty but fullName exists
                                        if (!firstName && !lastName && dep.fullName) {
                                          const parts = dep.fullName.split(',');
                                          lastName = parts[0]?.trim() || '';
                                          const rest = parts[1]?.trim() || '';
                                          const restParts = rest.split(' ');
                                          firstName = restParts[0]?.trim() || '';
                                          if (restParts.length > 1) {
                                            middleName = restParts.slice(1).join(' ').trim();
                                          }
                                        }
                                      }

                                      const isNoMN = dep ? (!!dep.noMiddleName || dep.no_mn === 1 || dep.no_mn === true) : false;
                                      const isMononym = dep ? (!!dep.mononym || dep.mononym === 1 || dep.mononym === true) : false;
                                      const isPSWD = dep ? (!!dep.isDisabled || dep.isDisabled === 1 || dep.isDisabled === true) : false;

                                      return (
                                        <tr key={idx} className="border-b border-slate-900 h-7.5 text-center odd:bg-slate-50/20 uppercase text-[8px]">
                                          <td className="border-r border-slate-900 px-2 text-left font-black truncate max-w-[95px]">
                                            {firstName}
                                          </td>
                                          <td className="border-r border-slate-900 px-2 text-left font-black truncate max-w-[95px]">
                                            {lastName}
                                          </td>
                                          <td className="border-r border-slate-900 px-1 text-center font-bold">
                                            {dep && nameExt ? nameExt : ''}
                                          </td>
                                          <td className="border-r border-slate-900 px-2 text-left font-bold truncate max-w-[95px]">
                                            {middleName}
                                          </td>
                                          <td className="border-r border-slate-900 px-1.5 font-bold text-center">
                                            {dep ? (dep.relationship || 'DEPENDENT') : ''}
                                          </td>
                                          <td className="border-r border-slate-900 px-1.5 text-center font-mono font-black">
                                            {dep ? (dep.birthDate || dep.birthdate || dep.date_of_birth || '--/--/----') : ''}
                                          </td>
                                          <td className="border-r border-slate-900 px-1 text-center font-bold">
                                            {dep ? (dep.gender || dep.sex || 'M/F') : ''}
                                          </td>
                                          <td className="border-r border-slate-900 px-2 text-left font-bold truncate max-w-[95px]">
                                            {dep ? (dep.citizenship || 'FILIPINO') : ''}
                                          </td>
                                          <td className="border-r border-slate-900 px-1 text-center font-black text-[9.5px] text-blue-800 select-none">
                                            {dep ? (isNoMN ? '☒' : '☐') : ''}
                                          </td>
                                          <td className="border-r border-slate-900 px-1 text-center font-black text-[9.5px] text-blue-800 select-none">
                                            {dep ? (isMononym ? '☒' : '☐') : ''}
                                          </td>
                                          <td className="px-1 text-center font-black text-[9.5px] text-blue-800 select-none">
                                            {dep ? (isPSWD ? '☒' : '☐') : ''}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* SECTION IV: MEMBER CATEGORY */}
                          <div className="border border-slate-900 bg-white">
                            <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8.5px] uppercase tracking-wider block border-b border-slate-900">
                              SECTION IV: MEMBER CATEGORY (PHILHEALTH ENROLLMENT INDEX)
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <h5 className="font-extrabold text-[8px] text-blue-900">☐ DIRECT CONTRIBUTOR</h5>
                                <div className="pl-3.5 space-y-1 text-[7.5px] font-extrabold text-slate-500">
                                  <p>☐ EMPLOYED: PRIVATE / GOVERNMENT</p>
                                  <p>☐ SELF-EARNING INDIVIDUAL: PROFESSIONS</p>
                                  <p>☐ KASAMBAHAY / OFWS</p>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <h5 className="font-extrabold text-[8px] text-[#1a56db]">☒ INDIRECT CONTRIBUTOR</h5>
                                <div className="pl-3.5 space-y-1 text-[7.5px] font-extrabold text-slate-800">
                                  <p className="font-black">☒ INDIGENT (SUPPORT STATUS: NATIONAL REGISTER)</p>
                                  <p>☐ SPONSORED MEMBER BY LGU</p>
                                  <p>☐ SENIOR CITIZEN PARITY BENEFICIARY</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Section V has been removed i                          {/* PAGE BREAK / SPACE IN PRINTING FOR PMRF BACK SHEET */}
                          <div className="print:page-break-before page-break-after pt-8 mt-8 space-y-4 text-left">
                            <div className="bg-white border-[3px] border-black p-4 text-black font-sans text-[9px] uppercase tracking-normal relative shadow-md">
                              
                              {/* Table Area for UPDATING/AMENDMENT */}
                              <div className="overflow-x-auto select-none">
                                <div className="min-w-[800px] border border-black flex flex-col mt-2">
                                  
                                  {/* Header Title */}
                                  <div className="bg-[#dee5db] border-b border-black text-center font-extrabold text-[12px] py-1.5 tracking-wider uppercase font-sans text-black">
                                    V. UPDATING/AMENDMENT
                                  </div>

                                  {/* Subheadings FROM / TO */}
                                  <div className="grid grid-cols-10 divide-x divide-black border-b border-black font-extrabold text-[10px] bg-white text-black">
                                    <div className="col-span-4 px-2.5 py-1.5 text-left flex items-center select-none font-bold">
                                      Please check:
                                    </div>
                                    <div className="col-span-3 px-2.5 py-1.5 text-center flex items-center justify-center select-none font-extrabold tracking-wide">
                                      FROM
                                    </div>
                                    <div className="col-span-3 px-2.5 py-1.5 text-center flex items-center justify-center select-none font-extrabold tracking-wide">
                                      TO
                                    </div>
                                  </div>

                                  {/* Row 1: Name */}
                                  <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                    <div className="col-span-4 p-2 flex items-start gap-2.5 bg-white select-none">
                                      <div className="h-4 w-4 border border-black flex items-center justify-center bg-white font-mono text-xs text-black shrink-0 mt-0.5">
                                        {selectedHH.household.pmrfDetails?.pmrfBackChangeName ? '✓' : ' '}
                                      </div>
                                      <div className="flex flex-col text-left">
                                        <span className="font-extrabold text-[9px] text-black leading-tight">Change/Correction of Name</span>
                                        <span className="text-[6.5px] text-gray-500 font-bold normal-case tracking-tight leading-normal mt-0.5 font-sans">
                                          (Last Name, First Name, Name Extension (Jr./Sr./III) Middle Name)
                                        </span>
                                      </div>
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] min-h-8">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeName ? (selectedHH.household.pmrfDetails?.pmrfBackFromValueName || 'N/A') : 'N/A'}
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] min-h-8 text-blue-700">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeName ? (selectedHH.household.pmrfDetails?.pmrfBackToValueName || 'N/A') : 'N/A'}
                                    </div>
                                  </div>

                                  {/* Row 2: DOB */}
                                  <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                    <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                                      <div className="h-4 w-4 border border-black flex items-center justify-center bg-white font-mono text-xs text-black shrink-0">
                                        {selectedHH.household.pmrfDetails?.pmrfBackChangeDOB ? '✓' : ' '}
                                      </div>
                                      <span className="font-extrabold text-[9px] text-black leading-none">Correction of Date of Birth</span>
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] h-8">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeDOB ? (selectedHH.household.pmrfDetails?.pmrfBackFromValueDOB || 'N/A') : 'N/A'}
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-blue-700">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeDOB ? (selectedHH.household.pmrfDetails?.pmrfBackToValueDOB || 'N/A') : 'N/A'}
                                    </div>
                                  </div>

                                  {/* Row 3: Sex */}
                                  <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                    <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                                      <div className="h-4 w-4 border border-black flex items-center justify-center bg-white font-mono text-xs text-black shrink-0">
                                        {selectedHH.household.pmrfDetails?.pmrfBackChangeSex ? '✓' : ' '}
                                      </div>
                                      <span className="font-extrabold text-[9px] text-black leading-none">Correction of Sex</span>
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] h-8">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeSex ? (selectedHH.household.pmrfDetails?.pmrfBackFromValueSex || 'N/A') : 'N/A'}
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-blue-700">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeSex ? (selectedHH.household.pmrfDetails?.pmrfBackToValueSex || 'N/A') : 'N/A'}
                                    </div>
                                  </div>

                                  {/* Row 4: Civil Status */}
                                  <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                    <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                                      <div className="h-4 w-4 border border-black flex items-center justify-center bg-white font-mono text-xs text-black shrink-0">
                                        {selectedHH.household.pmrfDetails?.pmrfBackChangeCivilStatus ? '✓' : ' '}
                                      </div>
                                      <span className="font-extrabold text-[9px] text-black leading-none">Change of Civil Status</span>
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] h-8">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeCivilStatus ? (selectedHH.household.pmrfDetails?.pmrfBackFromValueCivil || 'N/A') : 'N/A'}
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-blue-700">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangeCivilStatus ? (selectedHH.household.pmrfDetails?.pmrfBackToValueCivil || 'N/A') : 'N/A'}
                                    </div>
                                  </div>

                                  {/* Row 5: Info/Address */}
                                  <div className="grid grid-cols-10 divide-x divide-black text-black">
                                    <div className="col-span-4 p-2 flex items-start gap-2.5 bg-white select-none">
                                      <div className="h-4 w-4 border border-black flex items-center justify-center bg-white font-mono text-xs text-black shrink-0 mt-0.5">
                                        {selectedHH.household.pmrfDetails?.pmrfBackChangePersonalInfo ? '✓' : ' '}
                                      </div>
                                      <div className="flex flex-col text-left">
                                        <span className="font-extrabold text-[9px] text-black leading-snug font-sans">Updating of Personal Information/Address/</span>
                                        <span className="font-extrabold text-[9px] text-black leading-snug font-sans">Telephone Number/Mobile Number/e-mail Address</span>
                                      </div>
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] min-h-8">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangePersonalInfo ? (selectedHH.household.pmrfDetails?.pmrfBackFromValueInfo || 'N/A') : 'N/A'}
                                    </div>
                                    <div className="col-span-3 p-1.5 flex items-center bg-white font-mono font-bold text-[10px] min-h-8 text-blue-700">
                                      {selectedHH.household.pmrfDetails?.pmrfBackChangePersonalInfo ? (selectedHH.household.pmrfDetails?.pmrfBackToValueInfo || 'N/A') : 'N/A'}
                                    </div>
                                  </div>

                                </div>
                              </div>

                              {/* Attestation Area */}
                              <div className="overflow-x-auto mt-4 select-none">
                                <div className="min-w-[800px] border border-black grid grid-cols-12 divide-x divide-black bg-white">
                                  
                                  {/* Attestation Text */}
                                  <div className="col-span-8 p-3.5 flex flex-col justify-between font-sans">
                                    <div className="text-[7.5px] text-black text-justify leading-relaxed normal-case">
                                      <p className="font-bold">
                                        Under penalty of law, I hereby attest that the information provided, including the documents I have attached to this form, are true and accurate to the best of my knowledge. I agree and authorize PhilHealth for the subsequent validation, verification and for other data sharing purposes only under the following circumstances:
                                      </p>
                                      <ul className="list-disc pl-4 mt-1 space-y-0.5 font-bold">
                                        <li>As necessary for the proper execution of processes related to the legitimate and declared purpose;</li>
                                        <li>The use or disclosure is reasonably necessary, required or authorized by or under the law; and,</li>
                                        <li>Adequate security measures are employed to protect my information.</li>
                                      </ul>
                                    </div>

                                    {/* Signature / Thumb subgrid */}
                                    <div className="grid grid-cols-12 gap-2 mt-4 pt-4 border-t border-dashed border-gray-300">
                                      
                                      {/* Signature Fields */}
                                      <div className="col-span-8 flex flex-col justify-end pb-2 pr-4 text-center">
                                        <div className="flex gap-4">
                                          <div className="flex-1 flex flex-col justify-end items-center">
                                            <div className="w-full border-b border-black pb-0.5 overflow-hidden flex items-center justify-center h-16 bg-white">
                                              {(() => {
                                                const details = selectedHH.household.pmrfDetails || {};
                                                const sameAsFront = details.pmrfBackSameAsFront !== false;
                                                const sig = sameAsFront 
                                                  ? (selectedHH.household.patientSignature || details.patientSignature) 
                                                  : details.pmrfBackSignature;
                                                
                                                if (sig) {
                                                  return <img src={sig} className="max-h-16 w-auto object-contain" alt="Representative Signature" referrerPolicy="no-referrer" />;
                                                }
                                                return <span className="text-[8px] text-gray-400 font-bold italic font-sans normal-case">No Signature</span>;
                                              })()}
                                            </div>
                                            <span className="text-[7.5px] font-black mt-1.5 text-black font-sans leading-none block">
                                              Member's Signature over Printed Name
                                            </span>
                                          </div>

                                          <div className="w-[120px] flex flex-col justify-end items-center">
                                            <div className="w-full border-b border-black text-[10px] font-bold uppercase pb-0.5 text-center text-black h-16 flex items-end justify-center font-mono">
                                              {selectedHH.household.pmrfDetails?.pmrfBackSignatureDate || selectedHH.household.createdAt?.substring(0, 10) || new Date().toISOString().substring(0, 10)}
                                            </div>
                                            <span className="text-[7.5px] font-black mt-1.5 text-black font-sans leading-none block">
                                              Date
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Thumbprint printbox */}
                                      <div className="col-span-4 flex flex-col items-center justify-center">
                                        <div className="w-[110px] h-[75px] border-2 border-black rounded-xl bg-white flex flex-col items-center justify-center relative p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] overflow-hidden">
                                          {(() => {
                                            const details = selectedHH.household.pmrfDetails || {};
                                            const sameAsFront = details.pmrfBackSameAsFront !== false;
                                            const frontThumb = (selectedHH.household.patientSignature || details.patientSignature);
                                            
                                            if (sameAsFront) {
                                              if (frontThumb && frontThumb.includes("thumb")) {
                                                return <img src={frontThumb} className="max-h-[70px] object-contain" alt="Front Biometric thumb" referrerPolicy="no-referrer" />;
                                              }
                                            } else if (details.pmrfBackThumbmark) {
                                              return <img src={details.pmrfBackThumbmark} className="max-h-[70px] object-contain" alt="Back Specific Thumb" referrerPolicy="no-referrer" />;
                                            }
                                            return <div className="opacity-15 text-2xl select-none">&#x270B;</div>;
                                          })()}
                                        </div>
                                        <span className="text-[6.5px] font-bold text-center text-black leading-tight mt-1 max-w-[110px] font-sans normal-case">
                                          Please affix right thumbmark if unable to write
                                        </span>
                                      </div>

                                    </div>
                                  </div>

                                  {/* Right side: Use Only */}
                                  <div className="col-span-4 flex flex-col bg-[#f4f7f4]/40 h-full font-sans">
                                    <div className="bg-[#dee5db] border-b border-black text-center font-extrabold text-[10px] py-1.5 tracking-wider uppercase font-sans text-black select-none">
                                      FOR PHILHEALTH USE ONLY
                                    </div>
                                    <div className="p-3.5 flex flex-col justify-between flex-1 select-none text-black">
                                      <div className="text-[10px] font-extrabold tracking-wide text-black text-left mb-2 underline">
                                        RECEIVED BY:
                                      </div>
                                      <div className="flex flex-col gap-4 mt-1">
                                        <div className="flex flex-col text-left">
                                          <span className="text-[7.5px] font-extrabold text-black uppercase">Full Name:</span>
                                          <span className="border-b border-black text-[9.5px] font-bold uppercase pb-0.5 text-black min-h-5 flex items-end font-mono">
                                            {selectedHH.household.pmrfDetails?.pmrfBackReceivedByFullName || 'OFFICER IN-CHARGE'}
                                          </span>
                                        </div>
                                        <div className="flex flex-col text-left">
                                          <span className="text-[7.5px] font-extrabold text-black uppercase">PRO/LHIO/Branch:</span>
                                          <span className="border-b border-black text-[9.5px] font-bold uppercase pb-0.5 text-black min-h-5 flex items-end font-mono">
                                            {selectedHH.household.pmrfDetails?.pmrfBackReceivedByBranch || 'PAGADIAN BRANCH'}
                                          </span>
                                        </div>
                                        <div className="flex flex-col text-left">
                                          <span className="text-[7.5px] font-extrabold text-black uppercase">Date & Time:</span>
                                          <span className="border-b border-black text-[9.5px] font-bold uppercase pb-0.5 text-black min-h-5 flex items-end font-mono">
                                            {(() => {
                                              const dt = selectedHH.household.pmrfDetails?.pmrfBackReceivedByDateTime;
                                              if (dt) return dt.replace("T", " ");
                                              return selectedHH.household.createdAt?.replace("Z", "").replace("T", " ") || "2026-06-06 12:00";
                                            })()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </div>

                              {/* INSTRUCTIONS */}
                              <div className="mt-8 pt-6 border-t border-black normal-case font-sans text-[9.5px] text-justify text-black leading-relaxed space-y-4 select-none">
                                <div className="text-center font-extrabold text-[12.5px] underline tracking-widest block uppercase mb-5 text-black">
                                  INSTRUCTIONS
                                </div>
                                <ol className="list-none space-y-2.5 text-black">
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">1.</span>
                                    <span>All information should be written in UPPER CASE/CAPITAL LETTERS. If the information is not applicable, write "N/A."</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">2.</span>
                                    <span>All fields are mandatory unless indicated as optional. By affixing your signature, you certify the truthfulness and accuracy of all information provided.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">3.</span>
                                    <span>A properly accomplished PMRF shall be accompanied by a valid proof of identity for first time registrants, and supporting documents to establish relationship between member and dependent/s for updating or request for amendment.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">4.</span>
                                    <span>On the PURPOSE, check the appropriate box if for <span className="font-extrabold underline">Registration</span> or for <span className="font-extrabold underline">Updating/Amendment</span> of information.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">5.</span>
                                    <span>Indicate preferred KonSuLTa provider near the place of work or residence.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">6.</span>
                                    <div className="flex-1 text-left">
                                      <span>For PERSONAL DETAILS, all name entries should follow the format given below. Check the appropriate box if registrant has no middle name and/or with single name (mononym).</span>
                                      <div className="my-6 grid grid-cols-4 gap-4 text-center max-w-3xl mx-auto">
                                        <div className="flex flex-col items-center">
                                          <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans leading-none">LAST NAME</span>
                                          <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans leading-none block">SANTOS</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                          <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans leading-none">FIRST NAME</span>
                                          <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans leading-none block">JUAN ANDRES</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                          <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans leading-none">NAME EXTENSION (Jr./Sr./III)</span>
                                          <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans leading-none block">III</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                          <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans leading-none">MIDDLE NAME</span>
                                          <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans leading-none block">DELA CRUZ</span>
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">7.</span>
                                    <span>Indicate registrant's/member's name as it appears in the birth certificate.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">8.</span>
                                    <span>The full mother's maiden name of registrant/member must be indicated as it appears in the birth certificate.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">9.</span>
                                    <span>Indicate the full name of spouse if registrant/member is married.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">10.</span>
                                    <span>Indicate the complete permanent and mailing addresses and contact numbers.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">11.</span>
                                    <span>For updating/amendment, check the appropriate box to be updated/amended and indicate the correct data.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">12.</span>
                                    <span>For MEMBER TYPE, check the appropriate box which best describes your current membership status.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">13.</span>
                                    <span>For Direct Contributors, except employed, sea-based migrant workers and lifetime members, indicate the profession, monthly income and proof of income to be submitted.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">14.</span>
                                    <span>For Self-earning individuals, Kasambahays and Family Drivers, indicate the actual monthly income in the space provided.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">15.</span>
                                    <span>In declaring dependents, provide the full name of the living spouse, children below 21 years old, and parents who are 60 years old and above totally dependent to the member.</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">16.</span>
                                    <span>Dependents with disability shall be registered as principal members in accordance with Republic Act 11228 on mandatory PhilHealth coverage for all persons with disability (PWD).</span>
                                  </li>
                                  <li className="flex items-start">
                                    <span className="w-5 font-extrabold shrink-0">17.</span>
                                    <span>The registrant must affix his/her signature over printed name (or right thumbmark if unable to write) and indicate the date when the PMRF was signed.</span>
                                  </li>
                                </ol>
                              </div>

                            </div>
                          </div>
                        </div>
                      )}

                      {viewedFormTab === 'FPE' && (() => {
                        const activeFpe = selectedHH.household.fpeDetails || selectedHH.household.pmrfDetails?.fpeDetails || {};
                        return (
                          <div className="space-y-4 font-sans text-[10px] uppercase text-slate-900">
                            
                            {/* FPE Header with official Hospital emblem details */}
                            <div className="border border-slate-900 bg-[#1a56db] p-4 text-center text-white">
                              <h3 className="font-black text-sm tracking-widest text-white leading-none">SAINT FRANCIS HEALTH CLINIC DIGNITY SERVICE</h3>
                              <h4 className="text-[10px] font-extrabold text-blue-105 uppercase tracking-wide mt-1 leading-none">FIRST PATIENT ENCOUNTER (FPE) CLINICAL REPORT</h4>
                              <span className="text-[6.5px] text-blue-200 block mt-1 tracking-tight font-mono">INTEGRATED HEALTH REPORT ARCHIVE</span>
                            </div>

                            {/* Patient profile header */}
                            <div className="border border-slate-900 bg-slate-50 p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">PATIENT / APPLICANT</label>
                                <strong className="text-slate-900 text-[10.5px] font-black">{selectedHH.household.householdHead}</strong>
                              </div>
                              <div>
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">BARANGAY LOCATION</label>
                                <strong className="text-slate-900 text-[10.5px] font-black">{selectedHH.household.barangay}</strong>
                              </div>
                              <div>
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none mb-1">PMRF COMPLIANCE STATUS</label>
                                <strong className="text-emerald-700 text-[10.5px] font-black">{selectedHH.household.pmrfStatus} ENROLLED</strong>
                              </div>
                            </div>

                            {/* Complaints & History grids */}
                            <div className="border border-slate-900">
                              <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8px] uppercase tracking-wider block border-b border-slate-900">
                                Clinical Chief Complaints & Medical History
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 p-3 gap-5">
                                <div className="space-y-2">
                                  <h4 className="font-black text-[8.5px] text-blue-900 uppercase">1. RECORDED COMPLAINTS ON SITE</h4>
                                  <div className="space-y-1.5 font-bold text-slate-800">
                                    {Object.entries({
                                      'ccNone': 'No Acute Complaints',
                                      'ccFever': 'Fever / Pyrexia Symptoms',
                                      'ccCough': 'Persistent Coughing / Bronchial',
                                      'ccBodyPain': 'Body Ache / Myalgia Index',
                                      'ccDyspnea': 'Dyspnea / Chest tightness'
                                    }).map(([key, label]) => {
                                      const checked = activeFpe[key];
                                      return (
                                        <div key={key} className="flex items-center gap-2">
                                          <span>{checked ? '☒' : '☐'}</span> <span>{label}</span>
                                        </div>
                                      );
                                    })}
                                    <div className="font-extrabold text-slate-800 mt-2">
                                      <span>Other indications:</span> <span className="underline">{activeFpe.ccOthers || 'None indicated'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-350 pt-4 md:pt-0 md:pl-5">
                                  <h4 className="font-black text-[8.5px] text-blue-900 uppercase">2. LONG-TERM CLINICAL HISTORY</h4>
                                  <div className="grid grid-cols-2 gap-1.5 font-bold text-slate-850">
                                    {Object.entries({
                                      'mhHypertension': 'Hypertension',
                                      'mhDiabetes': 'Diabetes Mellitus',
                                      'mhAstmaCopd': 'Asthma / COPD',
                                      'mhHeart': 'Heart Disease',
                                      'mhStroke': 'Stroke Index',
                                      'mhCancer': 'Cancer history',
                                      'mhTb': 'Pulmonary TB',
                                      'mhKidney': 'Kidney Disease',
                                      'mhNone': 'No History'
                                    }).map(([key, label]) => {
                                      const checked = activeFpe[key];
                                      return (
                                        <div key={key} className="flex items-center gap-1.5">
                                          <span>{checked ? '☒' : '☐'}</span> <span>{label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Vital signs block */}
                            <div className="border border-slate-900">
                              <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8px] uppercase tracking-wider block border-b border-slate-900">
                                Patient Vitals & Anthropometrics Records
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 p-3 font-bold text-slate-800 bg-white">
                                <div className="border-b sm:border-b-0 border-slate-100 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-2">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">Blood Pressure</span>
                                  <strong className="text-[11px] sm:text-xs text-slate-900">{activeFpe.vitalBp || '120/80'} mmHg</strong>
                                </div>
                                <div className="border-b sm:border-b-0 border-slate-100 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-2">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">Weight scale</span>
                                  <strong className="text-[11px] sm:text-xs text-slate-900">{activeFpe.vitalWt || '65'} kg</strong>
                                </div>
                                <div className="border-b sm:border-b-0 border-slate-100 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-2">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">Height record</span>
                                  <strong className="text-[11px] sm:text-xs text-slate-900">{activeFpe.vitalHt || '168'} cm</strong>
                                </div>
                                <div className="border-b sm:border-b-0 border-slate-100 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-2">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">HR / Pulse</span>
                                  <strong className="text-[11px] sm:text-xs text-slate-900">
                                    {activeFpe.vitalHr ? (activeFpe.vitalHr.toLowerCase().includes('bpm') ? activeFpe.vitalHr : `${activeFpe.vitalHr} bpm`) : '72 bpm'}
                                  </strong>
                                </div>
                                <div className="border-b sm:border-b-0 border-slate-100 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-2">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">Resp Rate</span>
                                  <strong className="text-[11px] sm:text-xs text-slate-900">
                                    {activeFpe.vitalRr ? (activeFpe.vitalRr.toLowerCase().includes('cpm') ? activeFpe.vitalRr : `${activeFpe.vitalRr} cpm`) : '16 cpm'}
                                  </strong>
                                </div>
                                <div className="border-b sm:border-b-0 border-slate-100 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-2">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">Temperature</span>
                                  <strong className="text-[11px] sm:text-xs text-slate-900">
                                    {activeFpe.vitalTemp ? (activeFpe.vitalTemp.toLowerCase().includes('°c') ? activeFpe.vitalTemp : `${activeFpe.vitalTemp} °C`) : '36.5 °C'}
                                  </strong>
                                </div>
                                <div className="col-span-1 sm:col-span-1 pb-2 sm:pb-0">
                                  <span className="text-slate-400 text-[6.5px] block uppercase leading-none mb-1">BMI</span>
                                  <strong className="text-[11px] sm:text-xs text-[#1a56db]">{activeFpe.vitalBmi || '23.03'} (HEALTHY)</strong>
                                </div>
                              </div>
                            </div>

                            {/* Assessment text */}
                            <div className="border border-slate-900 p-3 bg-slate-50">
                              <span className="font-extrabold text-[8px] text-slate-500 uppercase block leading-none mb-1">Clinical Evaluation Plan / Diagnosis</span>
                              <p className="font-serif italic text-slate-900 text-[10.5px] normal-case bg-white border border-slate-300 p-2.5 rounded shadow-sm leading-relaxed">
                                {activeFpe.assessmentPlan || 'Patient received on-site healthcare registration profiling. All physiological vitals checked. Recommended for indigent primary care selection enrollment under Saint Francis clinic.'}
                              </p>
                            </div>

                            {/* Sign area */}
                            <div className="border border-slate-900 bg-slate-100 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase block leading-none">Clinical Staff Consent</span>
                                <p className="text-[9.5px] text-slate-500 leading-snug lowercase tracking-tight font-extrabold mt-1.5 select-none normal-case">
                                  Under sworndocument guidelines, the clinician certifies that the FPE details are properly accounted for under standard clinic inspection parameters.
                                </p>
                              </div>
                              <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-300 pt-4 md:pt-0 md:pl-4 h-full">
                                <div className="border-b border-slate-700 w-full max-w-xs h-16 relative flex items-center justify-center bg-white rounded p-1 shadow-xs">
                                  {(selectedHH.household.patientSignature || selectedHH.household.pmrfDetails?.patientSignature) ? (
                                    <img 
                                      src={selectedHH.household.patientSignature || selectedHH.household.pmrfDetails?.patientSignature} 
                                      className="max-h-16 w-auto object-contain filter contrast-125 saturate-0" 
                                      alt="Patient Signature" 
                                      referrerPolicy="no-referrer" 
                                    />
                                  ) : (
                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider select-none absolute bottom-1">No Signature Captured</span>
                                  )}
                                </div>
                                <span className="text-[8px] font-extrabold text-slate-650 uppercase tracking-wide mt-1.5">Signature of Patient / Parent / Guardian</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {viewedFormTab === 'PCSF' && (
                        <div className="space-y-4 font-sans text-[10px] uppercase text-slate-900 border-4 border-dashed border-slate-350 p-6 rounded-2xl bg-white shadow-lg relative">
                          <div className="absolute top-2 right-2 bg-[#1a56db] text-white text-[8px] font-black px-2 py-0.5 rounded shadow">BENEFICIARY COPY</div>
                          
                          {/* PCSF Header with official coupon design style */}
                          <div className="border-b-2 border-slate-900 pb-3 block">
                            <h3 className="font-black text-xs text-[#1a56db] leading-none">PRIMARY CARE PROVIDER SELECTION FORM (PCSF)</h3>
                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wide mt-1 leading-none">PhilHealth Konsulta Benefit Provider Registration voucher</p>
                          </div>

                          <div className="border border-slate-900">
                            <div className="bg-slate-900 text-white font-extrabold px-2 py-1 text-[8px] uppercase tracking-wider block border-b border-slate-900 col-span-full">
                              Provider Selection slip Details
                            </div>
                            <div className="grid grid-cols-2 p-3 gap-3">
                              <div>
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none">Selected Konsulta Provider</label>
                                <strong className="text-slate-900 font-black text-[11px]">SAINT FRANCIS HEALTH CLINIC PROVIDER</strong>
                              </div>
                              <div>
                                <label className="text-[6.5px] font-extrabold text-slate-400 block leading-none">Konsulta Clinic Location</label>
                                <strong className="text-slate-900 font-black text-[11px]">SAN FRANCISCO, PAGADIAN CITY</strong>
                              </div>
                            </div>
                          </div>

                          <div className="border border-slate-900 p-3 bg-slate-50">
                            <div className="space-y-1.5 text-slate-800 font-bold">
                              <p>☒ I choose Saint Francis Clinic as my primary healthcare clinic.</p>
                              <p>☒ I authorize the clinic staff to process my healthcare claims with PhilHealth Konsulta.</p>
                              <p>☒ I declare all details are synchronized with the national registry.</p>
                            </div>
                          </div>

                          {/* PCSF Sworn sign */}
                          <div className="border border-slate-900 bg-slate-100 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block leading-none">Authorization Accord & Consent</span>
                              <p className="text-[9.5px] text-slate-500 leading-snug normal-case mt-1.5 uppercase font-mono text-left font-extrabold">
                                I choose Saint Francis Clinic as my primary healthcare clinic, and authorize the clinical staffs to utilize my registration profile to secure Konsulta services of PhilHealth on my behalf.
                              </p>
                            </div>
                            <div className="flex flex-col items-center justify-center border-l border-slate-300 pl-4 h-full">
                              <div className="border-b border-slate-700 w-full max-w-xs h-16 relative flex items-center justify-center bg-white rounded p-1 shadow-xs">
                                {(selectedHH.household.patientSignature || selectedHH.household.pmrfDetails?.patientSignature) ? (
                                  <img 
                                    src={selectedHH.household.patientSignature || selectedHH.household.pmrfDetails?.patientSignature} 
                                    className="max-h-16 w-auto object-contain filter contrast-125 saturate-0" 
                                    alt="Patient Signature" 
                                    referrerPolicy="no-referrer" 
                                  />
                                ) : (
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider select-none absolute bottom-1">No Signature Captured</span>
                                )}
                              </div>
                              <span className="text-[8px] font-extrabold text-slate-650 uppercase tracking-wide mt-1.5">Signature over Printed Name of Beneficiary</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1 bg-blue-50 p-2 rounded">
                    <span className="font-semibold text-blue-900">Enrolled Members list</span>
                    <span className="font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">{selectedHH.members.length} registered</span>
                  </div>
                  {selectedHH.members.map((m: any, i: number) => (
                    <div key={i} className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-800">{m.lastName}, {m.firstName}</h4>
                        <div className="grid grid-cols-3 gap-3 text-[10px] text-slate-400 mt-1">
                          <span>Relationship: <strong className="text-slate-600">{m.relationship}</strong></span>
                          <span>Age: <strong className="text-slate-600">{m.age}</strong></span>
                          <span>Gender: <strong className="text-slate-600">{m.gender}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'dependents' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1 bg-amber-50 p-2 rounded">
                    <span className="font-semibold text-amber-900">Enrolled Dependents list</span>
                    <span className="font-mono bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px]">{selectedHH.dependents.length} registered</span>
                  </div>
                  {selectedHH.dependents.length === 0 ? (
                    <p className="text-center text-slate-400 py-6">No dependents reported for this household.</p>
                  ) : (
                    selectedHH.dependents.map((d: any, i: number) => {
                      const isExpanded = expandedDependentId === d.id;
                      
                      // Try to find if there's a registered FPE/PCSF household record for this specific dependent in the system
                      const linkedRecord = households.find((h: any) => 
                        h && h.pcsfDetails && h.pcsfDetails.dependentId === d.id
                      );
                      
                      const fpe = d.fpeDetails || linkedRecord?.fpeDetails || linkedRecord?.pmrfDetails?.fpeDetails;
                      const pcsf = d.pcsfDetails || linkedRecord?.pcsfDetails || linkedRecord?.pmrfDetails?.pcsfDetails;
                      const hasRecords = !!(fpe || pcsf);

                      // Auto calculated BMI
                      const wt = parseFloat(fpe?.vitalWt || d.weight || '48');
                      const ht = parseFloat(fpe?.vitalHt || d.height || '150');
                      const computedBmi = (!isNaN(wt) && !isNaN(ht) && ht > 0) ? (wt / ((ht / 100) * (ht / 100))).toFixed(2) : '21.33';

                      return (
                        <div key={i} className="border border-slate-250/60 rounded-xl overflow-hidden bg-white shadow-xs transition hover:border-amber-400">
                          {/* Header clickable bar to expand */}
                          <div 
                            onClick={() => setExpandedDependentId(isExpanded ? null : d.id)}
                            className="p-3.5 bg-slate-50/60 flex justify-between items-center cursor-pointer select-none hover:bg-slate-50 transition"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-800 text-[12px] sm:text-xs">{d.fullName}</h4>
                                <span className={`text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded ${
                                  hasRecords ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {hasRecords ? '✓ FPE/PCSF Filed' : '⚡ No Direct Forms'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500 mt-1">
                                <span>Relationship: <strong className="text-slate-700 font-extrabold">{d.relationship}</strong></span>
                                <span>Age range: <strong className="text-slate-700 font-extrabold">{d.age} yrs old</strong></span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                            )}
                          </div>

                          {/* Expanded FPE and PCSF files view */}
                          {isExpanded && (
                            <div className="p-4 border-t border-slate-150 bg-white space-y-4 text-[11px] text-slate-700">
                              
                              {/* Header branding info */}
                              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                  <span className="font-mono text-[9px] text-slate-400 uppercase font-black block leading-none">Dependent Dossier ID</span>
                                  <strong className="font-mono text-xs text-slate-700 block mt-0.5">{d.id || `dep-${i}`}</strong>
                                </div>
                                <div>
                                  <span className="font-sans text-[9px] text-slate-400 uppercase font-bold block text-left sm:text-right leading-none">Enrollee Demographic</span>
                                  <span className="text-slate-800 font-bold block mt-0.5">{d.gender || 'Male'} / {d.birthdate || d.birthDate || 'N/A'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* FIRST PATIENT ENCOUNTER (FPE) */}
                                <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/20">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="font-extrabold text-[#111827] text-[10px] uppercase tracking-wider flex items-center gap-1">
                                      <Stethoscope className="h-3.5 w-3.5 text-blue-600" /> Clinical Encounter (FPE)
                                    </span>
                                    <span className="text-[8.5px] font-mono font-bold bg-[#eff6ff] text-[#1e3a8a] px-1.5 py-0.5 rounded">
                                      {fpe ? 'Filing Complete' : 'Profile Template'}
                                    </span>
                                  </div>

                                  {/* Vitals */}
                                  <div className="space-y-2">
                                    <span className="block text-[8.5px] font-black uppercase tracking-widest text-slate-400">Vital Signs Index</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-400 block text-[8px] uppercase">Blood Pressure</span>
                                        <strong className="text-slate-800 font-mono text-[10px]">{fpe?.vitalBp || '115/75'} mmHg</strong>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-400 block text-[8px] uppercase">Thermals</span>
                                        <strong className="text-slate-800 font-mono text-[10px]">{fpe?.vitalTemp || '36.4'} °C</strong>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-400 block text-[8px] uppercase">Heart Rate</span>
                                        <strong className="text-slate-800 font-mono text-[10px]">{fpe?.vitalHr || '78'} bpm</strong>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-400 block text-[8px] uppercase">Weights Scale</span>
                                        <strong className="text-slate-800 font-mono text-[10px]">{fpe?.vitalWt || d.weight || '48'} kg</strong>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-400 block text-[8px] uppercase">Altitude Height</span>
                                        <strong className="text-slate-800 font-mono text-[10px]">{fpe?.vitalHt || d.height || '150'} cm</strong>
                                      </div>
                                      <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100">
                                        <span className="text-indigo-700 block text-[8px] font-bold uppercase">Calculated BMI</span>
                                        <strong className="text-indigo-900 font-mono text-[10px]">{computedBmi}</strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Chief Complaints / History */}
                                  <div className="space-y-1.5">
                                    <span className="block text-[8.5px] font-black uppercase tracking-widest text-slate-400">Chief Complaints</span>
                                    <p className="text-[10.5px] bg-white p-2 rounded border border-slate-100 text-slate-700 italic">
                                      {fpe?.ccOthers || 'Routine Primary Pediatric Checkup / Pediatric screening for indigent program.'}
                                    </p>
                                  </div>

                                  <div className="space-y-1.5">
                                    <span className="block text-[8.5px] font-black uppercase tracking-widest text-slate-400">Clinical History & Medications</span>
                                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                                      <div className="bg-white p-1.5 rounded border border-slate-100">
                                        <span className="text-slate-400 uppercase block font-medium">Family History</span>
                                        <span className="font-bold text-slate-700 block truncate">{fpe?.fhNone !== false ? 'None declared' : 'Hypertension risk factors'}</span>
                                      </div>
                                      <div className="bg-white p-1.5 rounded border border-slate-100">
                                        <span className="text-slate-400 uppercase block font-medium">Prescription Drugs</span>
                                        <span className="font-bold text-slate-700 block truncate">{fpe?.medSpecify || 'None reported'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <span className="block text-[8px] font-black uppercase tracking-widest text-slate-450">Assessment Plan Summary</span>
                                    <p className="text-[9.5px] leading-relaxed text-slate-600 mt-0.5">
                                      {fpe?.assessmentPlan || 'Patient checks out healthy. Keep regular pediatric surveillance under regional primary care physician.'}
                                    </p>
                                  </div>
                                </div>

                                {/* PRIMARY CARE SELECTION FORM (PCSF) */}
                                <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/20">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="font-extrabold text-[#065f46] text-[10px] uppercase tracking-wider flex items-center gap-1">
                                      <Building className="h-3.5 w-3.5 text-emerald-600" /> Provider Selection (PCSF)
                                    </span>
                                    <span className="text-[8.5px] font-mono font-bold bg-[#ecfdf5] text-[#065f46] px-1.5 py-0.5 rounded">
                                      {pcsf ? 'Enrolled Active' : 'Default Facility'}
                                    </span>
                                  </div>

                                  <div className="space-y-2.5">
                                    <div>
                                      <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 block">Assigned Provider Facility</span>
                                      <div className="bg-white p-2 rounded-lg border border-slate-100 mt-1">
                                        <strong className="text-emerald-900 font-extrabold text-xs block">{pcsf?.pcc1 || 'Saint Francis Clinic'}</strong>
                                        <span className="text-[9px] text-slate-500 block leading-tight">{pcsf?.pcc1Addr || 'San Francisco, Pagadian City, Zamboanga del Sur'}</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-405 block text-[8px] font-black uppercase text-slate-400">Registration Date</span>
                                        <strong className="text-slate-755 text-slate-700 font-mono text-[9.5px]">{pcsf?.date || new Date().toLocaleDateString()}</strong>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-100">
                                        <span className="text-slate-405 block text-[8px] font-black uppercase text-slate-400">Consent Level</span>
                                        <strong className="text-emerald-800 font-sans text-[9.5px]">✓ Principal Signed</strong>
                                      </div>
                                    </div>

                                    <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Care Transfer Intent</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase inline-block ${
                                        pcsf?.transfer ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                                      }`}>
                                        {pcsf?.transfer ? 'Transfer Pending Verification' : 'No Transfer Initiated'}
                                      </span>
                                      {pcsf?.transfer && (
                                        <div className="mt-1 text-[9px] text-slate-600 bg-slate-50 p-1.5 rounded">
                                          Prev Provider: <strong className="text-slate-800">{pcsf.prevPcc}</strong>
                                        </div>
                                      )}
                                    </div>

                                    <div className="text-[8.5px] text-slate-400 italic">
                                      * All clinical screenings and services are covered under the PhilHealth Konsulta program.
                                    </div>
                                  </div>
                                </div>

                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'attachments' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">Household Document Archives</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      {selectedHH.household.attachments?.length || 0} FILE(S)
                    </span>
                  </div>

                  {/* Attachment Grid List */}
                  {selectedHH.household.attachments?.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400">
                      No documents associated with this household.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100">
                      {selectedHH.household.attachments.map((img: any, i: number) => {
                        const isObj = img && typeof img === 'object';
                        const fileString = isObj ? img.fileData : img;
                        const fullName = isObj ? img.fullName : 'Identity Verification Scan';
                        const docType = isObj ? img.documentType : 'Verification ID';
                        
                        return (
                          <div key={i} className="border border-slate-200 rounded-xl overflow-hidden group relative bg-white shadow-xs p-1.5 flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition">
                            <div className="relative h-24 w-full rounded-lg overflow-hidden bg-slate-100">
                              {fileString?.startsWith('data:application/pdf') || (img.fileName && img.fileName.toLowerCase().endsWith('.pdf')) ? (
                                <div className="h-full w-full bg-white flex flex-col items-center justify-center p-2 text-center">
                                  <FileText className="h-9 w-9 text-red-500 mb-1 shrink-0" />
                                  <span className="text-[8px] font-bold text-slate-500 truncate max-w-full font-mono">{img.fileName || 'PDF Document'}</span>
                                </div>
                              ) : (
                                <img src={fileString} alt={fullName} className="h-full w-full object-cover" />
                              )}
                              <div className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 p-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewingAttachment(fileString)}
                                  className="px-2 py-1 bg-white text-slate-800 rounded font-extrabold text-[9px] hover:bg-slate-50 shadow select-none cursor-pointer uppercase flex items-center gap-0.5"
                                  title="View Full_screen"
                                >
                                  <Eye className="h-3 w-3 text-blue-600 font-black" /> View
                                </button>
                                {isMasterAdmin && (
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const updated = selectedHH.household.attachments.filter((_, idx) => idx !== i);
                                      try {
                                        const res = await fetch('/api/households/edit', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-email': currentUser.email
                                          },
                                          body: JSON.stringify({
                                            id: selectedHH.household.id,
                                            householdData: {
                                              ...selectedHH.household,
                                              attachments: updated
                                            },
                                            membersData: null,
                                            dependentsData: null
                                          })
                                        });
                                        if (res.ok) {
                                          setSelectedHH({
                                            ...selectedHH,
                                            household: { ...selectedHH.household, attachments: updated }
                                          });
                                          setHouseholds(prev => prev.map(item => 
                                            item.id === selectedHH.household.id 
                                              ? { ...item, attachments: updated }
                                              : item
                                          ));
                                        }
                                      } catch (err) {}
                                    }}
                                    className="px-2 py-1 bg-red-600 font-extrabold text-white rounded text-[9px] hover:bg-red-700 shadow-sm cursor-pointer select-none uppercase"
                                    title="Remove Attachment"
                                  >
                                    ✕ Remove
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-1.5 px-0.5 space-y-0.5 min-w-0">
                              <span className={`text-[7px] font-black uppercase px-1 rounded-sm tracking-widest inline-block ${
                                docType === 'FPE/PCSF' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}>
                                {docType}
                              </span>
                              <span className="text-[10px] font-bold text-slate-800 block truncate" title={fullName}>{fullName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Live Drawer Upload Controls */}
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3 shadow-xs">
                    <span className="block text-[10px] font-extrabold text-slate-555 uppercase tracking-widest">
                      📤 Fast Upload New Dossier Attachment
                    </span>

                    {/* SINGLE UPLOAD BUTTON */}
                    <div className="w-full">
                      <label 
                        htmlFor="drawer-file-upload-input-household"
                        className={`w-full flex items-center justify-center gap-2 border border-dashed py-3 px-3 rounded-xl text-center cursor-pointer font-extrabold uppercase transition text-[10px] ${
                          selectedDrawerAttachmentFile
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-emerald-855 border-slate-300'
                        }`}
                      >
                        <Folder className="h-4 w-4 text-emerald-600" />
                        <span>Add Household File</span>
                      </label>
                      <input 
                        type="file" 
                        id="drawer-file-upload-input-household"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          setDrawerAttachmentType('Household File');
                          if (e.target.files && e.target.files[0]) {
                            setSelectedDrawerAttachmentFile(e.target.files[0]);
                          }
                        }}
                      />
                    </div>

                    {/* Active selected file attachment details and owner name mapper */}
                    {selectedDrawerAttachmentFile && (
                      <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-2.5 shadow-sm">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                          <span className="truncate max-w-[200px] font-mono text-slate-800">📄 {selectedDrawerAttachmentFile.name}</span>
                          <span>({(selectedDrawerAttachmentFile.size / 1024).toFixed(1)} KB)</span>
                        </div>

                        {/* Dropdown list */}
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black uppercase text-slate-455 block tracking-widest leading-none">
                            Assign Attachment Owner (Full Name)
                          </label>
                          <select
                            value={drawerAttachmentOwnerName}
                            onChange={(e) => setDrawerAttachmentOwnerName(e.target.value)}
                            className="bg-white text-slate-850 border border-slate-300 w-full rounded p-1.5 text-[11px] font-semibold focus:outline-emerald-500"
                          >
                            <option value="">-- Choose Member Name --</option>
                            {selectedHH.household.householdHead && (
                              <option value={selectedHH.household.householdHead}>
                                {selectedHH.household.householdHead} (Household Head)
                              </option>
                            )}
                            {selectedHH.dependents && selectedHH.dependents.map((dep: any, idx: number) => {
                              const name = dep.fullName || `${dep.lastName || ''}, ${dep.firstName || ''}`;
                              return (
                                <option key={idx} value={name}>
                                  {name} (Dependent)
                                </option>
                              );
                            })}
                            {selectedHH.members && selectedHH.members.map((mem: any, idx: number) => {
                              const name = mem.fullName || `${mem.lastName || ''}, ${mem.firstName || ''}`;
                              return (
                                <option key={idx} value={name}>
                                  {name} (Member)
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Progress and submit buttons */}
                        {drawerUploadProgress !== null ? (
                          <div className="space-y-1 pt-1">
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${drawerUploadProgress}%` }}></div>
                            </div>
                            <span className="text-[8.5px] font-extrabold text-emerald-800 text-center block uppercase tracking-wider">Uploading verification scan ({drawerUploadProgress}%)</span>
                          </div>
                        ) : (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedDrawerAttachmentFile(null)}
                              className="flex-1 text-[9px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-250 py-1.5 rounded uppercase"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleUploadAttachmentDrawer}
                              className="flex-1 text-[9px] font-black text-white bg-emerald-700 hover:bg-emerald-800 py-1.5 rounded uppercase shadow-sm"
                            >
                              Upload File
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'health' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800 leading-tight">Matched Clinical Medical Diagnoses</h3>
                  {selectedHH.healthRecords?.length === 0 ? (
                    <p className="text-center text-slate-400 py-12 bg-slate-50 rounded-xl border border-dashed">
                      No clinical logs on file for this household's members.
                    </p>
                  ) : (
                    <div className="relative border-l-2 border-blue-100 pl-4 space-y-4">
                      {selectedHH.healthRecords.map((hr: any) => (
                        <div key={hr.id} className="relative bg-white border border-slate-100 rounded-xl p-3.5 shadow-xs">
                          <div className="absolute -left-[23px] top-1.5 bg-blue-600 text-white h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold">
                            +
                          </div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800">{hr.patientName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{hr.date}</span>
                          </div>
                          <p className="font-semibold text-blue-700 text-[11px] mb-1">Diagnosis: {hr.diagnosis}</p>
                          <p className="text-slate-500 mb-2">Treatment: {hr.treatment}</p>
                          <div className="bg-slate-50 p-2 rounded text-[10px] font-medium text-slate-600 font-mono">
                            Medications: {hr.medications}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-3">
                  <h3 className="font-semibold leading-tight">Account Audit trail</h3>
                  {selectedHH.logs?.length === 0 ? (
                    <p className="text-center text-slate-400 py-6">No historical actions logged.</p>
                  ) : (
                    selectedHH.logs.map((log: any, i: number) => (
                      <div key={i} className="p-2 border border-slate-50 rounded bg-slate-50 flex items-center justify-between text-[11px]">
                        <div>
                          <strong className="text-slate-700">{log.user}</strong>
                          <span className="text-slate-500 text-xs ml-1.5">{log.action}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {log.date} {log.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-3">
              <button 
                onClick={() => setSelectedHH(null)}
                className="flex-1 py-1 px-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-700 hover:text-slate-900 font-semibold"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* HIGH-FIDELITY PHILHEALTH PMRF PAPER-STYLE FORM INLINE CONTAINER */}
      {showAddModal && (
        <div id="pmrf-form-wrapper" className={(editingHH || isDraftOnlyMode) ? "fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10025] p-3 sm:p-4 overflow-y-auto font-sans" : "font-sans"}>
          <div className={(editingHH || isDraftOnlyMode) 
            ? "bg-slate-150 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl border border-slate-350 overflow-y-auto text-slate-800 font-sans" 
            : `bg-slate-150 rounded-2xl w-full flex flex-col shadow-2xl border border-slate-350 transition-all duration-300 text-slate-800 font-sans ${activeFormTab === 'PMRF' ? 'max-w-full' : 'max-w-4xl mx-auto'}`
          }>
              
              {/* Header branding bar */}
              <div className="bg-[#1a56db] text-white p-4 rounded-t-xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-white rounded-lg text-lg">🏥</span>
                  <div>
                    <h2 className="text-sm font-extrabold tracking-wider leading-none">
                      {editingHH ? `EDIT PROFILE DETAILS & DIGITAL PMRF: ${pmrfLastName && pmrfFirstName ? `${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.toUpperCase() : formHeadName.toUpperCase()}` : "SAINT FRANCIS CLINIC - BARANGAY REGISTER"}
                    </h2>
                    <p className="text-[10px] text-blue-100 mt-1 uppercase font-semibold">
                      {editingHH ? "Update household profile details and PhilHealth PMRF records" : "Official PhilHealth Member Registration Form (PMRF) Digital Twin"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseAddModal}
                  className="text-white/80 hover:text-white font-extrabold text-sm bg-black/10 hover:bg-black/20 p-1.5 rounded-lg transition cursor-pointer"
                >
                  ✕ Close Form
                </button>
              </div>

            {/* BTN SELECTOR WITH PMRF, FPE, PCSF ON TOP OF THE FORM */}
            <div className="bg-slate-100 border-b p-3 flex flex-wrap gap-2 justify-center shrink-0">
              {[
                { id: 'PMRF', label: '1. PMRF FORM' },
                { id: 'FPE', label: '2. FPE FORM' },
                { id: 'PCSF', label: '3. PCSF FORM' }
              ].filter(t => !isFpePcsfOnly || t.id !== 'PMRF').map((t, idx) => {
                const displayLabel = isFpePcsfOnly 
                  ? (t.id === 'FPE' ? '1. FPE FORM' : '2. PCSF FORM') 
                  : t.label;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      // Pre-populate fields automatically between forms for maximum convenience
                      if (t.id === 'FPE' || t.id === 'PCSF') {
                        if (!pcsfFullName && (pmrfLastName || pmrfFirstName)) {
                          setPcsfFullName(`${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.trim());
                        }
                        if (!pcsfContactNo) {
                          setPcsfContactNo(pmrfMobileNo);
                        }
                        if (!pcsfEmail) {
                          setPcsfEmail(pmrfEmail);
                        }
                        if (!fpeShOccupation) {
                          setFpeShOccupation(pmrfProfession);
                        }
                      }
                      setActiveFormTab(t.id as any);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      activeFormTab === t.id 
                        ? 'bg-blue-600 text-white font-extrabold shadow-md scale-102 border border-blue-700' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-205'
                    }`}
                  >
                    {t.id === 'PMRF' && '📄'}
                    {t.id === 'FPE' && '🩺'}
                    {t.id === 'PCSF' && '✅'}
                    {displayLabel}
                  </button>
                );
              })}
            </div>



            {/* ENTIRE DOCUMENT SHEET - SCROLLABLE COMPONENT */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50">
              
              { (formHeadName || pmrfLastName || pmrfFirstName || pmrfPhilsysNo || pmrfEmail || pmrfMobileNo) && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-xs animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>⚡ Draft Progress Secured (Autosaved to your browser device)</span>
                  </div>
                  <span className="font-mono text-[9px] bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wide">Ready</span>
                </div>
              )}

              {activeFormTab === 'PMRF' && (
                <div className="space-y-4">
                  {/* PMRF SUB-TABS (FRONT AND BACK) */}
                  <div className="flex bg-white hover:bg-slate-50 border border-slate-300 max-w-md mx-auto items-center justify-between shadow-xs select-none gap-2 rounded-xl p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPmrfSubTab('FRONT')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        pmrfSubTab === 'FRONT'
                          ? 'bg-[#1a56db] text-white shadow-xs scale-[1.02]'
                          : 'bg-transparent text-slate-700 hover:text-slate-900 font-extrabold'
                      }`}
                    >
                      PMRF FRONT (Sections I-IV)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPmrfSubTab('BACK')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        pmrfSubTab === 'BACK'
                          ? 'bg-[#1a56db] text-white shadow-xs scale-[1.02]'
                          : 'bg-transparent text-slate-700 hover:text-slate-900 font-extrabold'
                      }`}
                    >
                      PMRF BACK (Section V)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-6 items-start mt-2">
                    {pmrfSubTab === 'FRONT' && (
                      <div className="w-full">
                        {/* MOBILE INTERACTIVE PORT LAYOUT FOR COMPACT VIEW (block md:hidden print:hidden) */}
                        <div className="block md:hidden print:hidden w-full font-sans text-slate-800 space-y-4">
                          
                          {/* Real-time Completion Track & Progress indicator */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-55 border-2 border-slate-950 rounded-xl p-4 shadow-sm text-left">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">PMRF COMPLETION TRACKER</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Helpful guide to ensure form validity</p>
                              </div>
                              <span className="text-lg font-black text-blue-700 bg-white border border-slate-300 px-2.5 py-0.5 rounded-lg font-mono">
                                {getPmrfCompletionPercentage()}%
                              </span>
                            </div>
                            
                            {/* Bar scale */}
                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-350">
                              <div 
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 rounded-full" 
                                style={{ width: `${getPmrfCompletionPercentage()}%` }}
                              />
                            </div>

                            {/* Live Field Validation Checker */}
                            {(() => {
                              const vErrs = getPmrfValidationErrors();
                              const errCount = Object.keys(vErrs).length;
                              if (errCount > 0) {
                                return (
                                  <div className="mt-3 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                                    <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-[10px] uppercase">
                                      <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                                      <span>{errCount} Pending Validation Action Item{errCount > 1 ? 's' : ''}:</span>
                                    </div>
                                    <ul className="mt-1 list-disc list-inside text-[9.5px] text-rose-600 font-bold space-y-0.5 leading-tight">
                                      {Object.values(vErrs).map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="mt-3 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase">
                                    <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                                    <span>All Core PMRF Fields Completed Correctly!</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>

                          {/* SMART AUTO-FILL LOOKUP CONSOLE */}
                          <div className="hidden md:block bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm text-left space-y-3 relative">
                            <div>
                              <div className="flex items-center gap-1.5 text-blue-700">
                                <Sparkles className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                                <h3 className="text-xs font-black tracking-wider uppercase">SMART AUTO-FILL LOOKUP</h3>
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold leading-normal mt-0.5">
                                Search the resident masterlist database or enter an existing PIN to pre-populate all matching fields instantly.
                              </p>
                            </div>

                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                              </div>
                              <input
                                type="text"
                                value={pmrfSearchQuery}
                                onChange={(e) => setPmrfSearchQuery(e.target.value)}
                                placeholder="Type Resident Name or PIN..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                              />
                            </div>

                            {/* Dropdown Suggestions */}
                            {pmrfSearchResults.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-slate-950 rounded-xl shadow-lg z-50 overflow-hidden text-slate-900 divide-y divide-slate-100 font-extrabold max-h-60 overflow-y-auto">
                                <div className="bg-slate-50 p-2 text-[9px] text-slate-400 uppercase tracking-wide">FOUND MATCHES:</div>
                                {pmrfSearchResults.map((person, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleAutoFillPerson(person)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <div className="font-extrabold text-slate-900 uppercase">{person.fullName}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        PIN: {person.pin || person.pmrfDetails?.pin || 'N/A'} • DOB: {person.birthdate || person.birthDate}
                                      </div>
                                    </div>
                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wide">Select</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* SECTION HEADER COLLAPSIBLE TILES */}
                          
                          {/* Group 1: Reminders & Instruction Box */}
                          <div className="bg-white border-2 border-slate-950 rounded-xl overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setCollapsedMobileSecs({ ...collapsedMobileSecs, reminders: !collapsedMobileSecs.reminders })}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between font-black text-xs text-slate-900 uppercase border-b-2 border-slate-950 select-none text-left"
                            >
                              <span className="tracking-wider flex items-center gap-1.5 leading-none">
                                <FileText className="h-4 w-4 text-slate-600 shrink-0" />
                                1. Registration Reminders
                              </span>
                              {collapsedMobileSecs.reminders ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                            </button>
                            {collapsedMobileSecs.reminders && (
                              <div className="p-4 space-y-3 text-left font-bold text-[10px] text-slate-600 leading-normal">
                                <p className="text-red-700 font-black">IMPORTANT REMINDERS:</p>
                                <ul className="list-decimal list-inside space-y-1.5">
                                  <li>ALL INFORMATION MUST BE ENTERED IN UPPERCASE BLOCK LETTERS UNIQUE FROM ACCENTS.</li>
                                  <li>DECLARATION OF ALL DEPENDENTS IS ABSOLUTELY REQUIRED AND MANDATED FOR HEALTH PROGRAM VALIDATION.</li>
                                  <li>PLEASE DOUBLE CHECK BIRTHDATES AND PHILHEALTH IDENTIFICATION NUMBERS (PIN).</li>
                                </ul>
                                
                                <div className="border-t border-slate-100 pt-3">
                                  <label className="text-[10px] font-black text-slate-500 block mb-1">PHILHEALTH IDENTIFICATION NUMBER (PIN)</label>
                                  <input
                                    type="text"
                                    placeholder="12-XXXXXXXXX-X"
                                    value={pmrfPin}
                                    onChange={(e) => setPmrfPin(e.target.value)}
                                    className="w-full px-3 py-2 border-2 border-slate-950 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                                  />
                                  {getPmrfValidationErrors().pin && (
                                    <p className="text-rose-600 text-[9.5px] font-bold mt-1 uppercase leading-tight">{getPmrfValidationErrors().pin}</p>
                                  )}
                                </div>

                                <div className="pt-1">
                                  <label className="text-[10px] font-black text-slate-500 block mb-1">PURPOSE OF REGISTRATION</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPmrfPurpose('REGISTRATION')}
                                      className={`py-2 px-3 border border-slate-950 rounded-lg text-[10px] font-black tracking-wider transition ${
                                        pmrfPurpose === 'REGISTRATION'
                                          ? 'bg-[#1a56db] text-white shadow-xs'
                                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      REGISTRATION
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPmrfPurpose('UPDATING')}
                                      className={`py-2 px-3 border border-slate-950 rounded-lg text-[10px] font-black tracking-wider transition ${
                                        pmrfPurpose === 'UPDATING'
                                          ? 'bg-amber-600 text-white shadow-xs'
                                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      UPDATING
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Group 2: Personal Details Folder */}
                          <div className="bg-white border-2 border-slate-950 rounded-xl overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setCollapsedMobileSecs({ ...collapsedMobileSecs, personal: !collapsedMobileSecs.personal })}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between font-black text-xs text-slate-900 uppercase border-b-2 border-slate-950 select-none text-left"
                            >
                              <span className="tracking-wider flex items-center gap-1.5 leading-none">
                                <Users className="h-4 w-4 text-slate-600 shrink-0" />
                                2. Section I: Personal Details
                              </span>
                              {collapsedMobileSecs.personal ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                            </button>
                            {collapsedMobileSecs.personal && (
                              <div className="p-4 space-y-4 text-left font-bold text-xs">
                                
                                {/* LastName, FirstName */}
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 block mb-1">MEMBER LAST NAME <span className="text-rose-600 font-extrabold">*</span></label>
                                  <input
                                    type="text"
                                    value={pmrfLastName}
                                    onChange={(e) => setPmrfLastName(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs uppercase font-extrabold focus:border-slate-800 outline-none"
                                  />
                                  {getPmrfValidationErrors().lastName && (
                                    <p className="text-rose-600 text-[9.5px] font-bold mt-1 uppercase leading-tight">{getPmrfValidationErrors().lastName}</p>
                                  )}
                                </div>

                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 block mb-1">MEMBER FIRST NAME <span className="text-rose-600 font-extrabold">*</span></label>
                                  <input
                                    type="text"
                                    value={pmrfFirstName}
                                    onChange={(e) => setPmrfFirstName(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs uppercase font-extrabold focus:border-slate-800 outline-none"
                                  />
                                  {getPmrfValidationErrors().firstName && (
                                    <p className="text-rose-600 text-[9.5px] font-bold mt-1 uppercase leading-tight">{getPmrfValidationErrors().firstName}</p>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">MIDDLE NAME</label>
                                    <input
                                      type="text"
                                      value={pmrfMiddleName}
                                      onChange={(e) => setPmrfMiddleName(e.target.value.toUpperCase())}
                                      disabled={pmrfMemberNoMiddleName || pmrfMemberMononym}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs uppercase font-extrabold focus:border-slate-800 outline-none disabled:bg-slate-100"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">NAME EXTENSION</label>
                                    <input
                                      type="text"
                                      value={pmrfNameExt}
                                      onChange={(e) => setPmrfNameExt(e.target.value.toUpperCase())}
                                      placeholder="e.g. JR, SR"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs uppercase font-extrabold text-center focus:border-slate-800 outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-4 py-1">
                                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={pmrfMemberNoMiddleName}
                                      onChange={(e) => {
                                        setPmrfMemberNoMiddleName(e.target.checked);
                                        if (e.target.checked) setPmrfMiddleName('');
                                      }}
                                      className="h-5 w-5 rounded border-slate-350 text-blue-600 focus:ring-blue-500"
                                    />
                                    NO MIDDLE NAME
                                  </label>
                                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={pmrfMemberMononym}
                                      onChange={(e) => {
                                        setPmrfMemberMononym(e.target.checked);
                                        if (e.target.checked) {
                                          setPmrfMiddleName('');
                                          setPmrfMemberNoMiddleName(false);
                                        }
                                      }}
                                      className="h-5 w-5 rounded border-slate-350 text-blue-600 focus:ring-blue-500"
                                    />
                                    MONONYM (SINGLE NAME)
                                  </label>
                                </div>

                                {/* DOB & Sex */}
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">BIRTH DATE <span className="text-rose-600 font-extrabold">*</span></label>
                                    <input
                                      type="date"
                                      value={pmrfBirthDate}
                                      onChange={(e) => setPmrfBirthDate(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs font-mono font-extrabold focus:border-slate-800 outline-none"
                                    />
                                    {getPmrfValidationErrors().birthDate && (
                                      <p className="text-rose-600 text-[9.5px] font-bold mt-1 uppercase leading-tight">{getPmrfValidationErrors().birthDate}</p>
                                    )}
                                  </div>
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">SEX</label>
                                    <select
                                      value={pmrfSex}
                                      onChange={(e) => setPmrfSex(e.target.value as any)}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs font-extrabold outline-none focus:border-slate-800"
                                    >
                                      <option value="Male">MALE</option>
                                      <option value="Female">FEMALE</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">CIVIL STATUS</label>
                                    <select
                                      value={pmrfCivilStatus}
                                      onChange={(e) => setPmrfCivilStatus(e.target.value as any)}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs font-extrabold outline-none focus:border-slate-800"
                                    >
                                      <option value="Single">SINGLE</option>
                                      <option value="Married">MARRIED</option>
                                      <option value="Widowed">WIDOWED / WIDOWER</option>
                                      <option value="Annulled">ANNULLED</option>
                                      <option value="Legally Separated">LEGALLY SEPARATED</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">CITIZENSHIP</label>
                                    <select
                                      value={pmrfCitizenship}
                                      onChange={(e) => setPmrfCitizenship(e.target.value as any)}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs font-extrabold outline-none focus:border-slate-800"
                                    >
                                      <option value="FILIPINO">FILIPINO</option>
                                      <option value="FOREIGN">FOREIGN NATIONAL</option>
                                      <option value="DUAL">DUAL CITIZEN</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">PHILSYS ID NUMBER</label>
                                    <input
                                      type="text"
                                      value={pmrfPhilsysNo}
                                      onChange={(e) => setPmrfPhilsysNo(e.target.value)}
                                      placeholder="PhilSys ID"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs uppercase font-extrabold focus:border-slate-800"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">TAX IDENTIFICATION NO (TIN)</label>
                                    <input
                                      type="text"
                                      value={pmrfTin}
                                      onChange={(e) => setPmrfTin(e.target.value)}
                                      placeholder="TIN No"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs uppercase font-extrabold focus:border-slate-800"
                                    />
                                  </div>
                                </div>

                                {/* Spouse Details */}
                                <div className="border-t border-slate-100 pt-3 mt-1">
                                  <h4 className="text-[10px] font-black text-blue-700 tracking-wider uppercase mb-2">SPOUSE'S DETAILS (IF APPLICABLE)</h4>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1">SPOUSE LAST NAME</label>
                                        <input
                                          type="text"
                                          value={pmrfSpouseLastName}
                                          onChange={(e) => setPmrfSpouseLastName(e.target.value.toUpperCase())}
                                          className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1">SPOUSE FIRST NAME</label>
                                        <input
                                          type="text"
                                          value={pmrfSpouseFirstName}
                                          onChange={(e) => setPmrfSpouseFirstName(e.target.value.toUpperCase())}
                                          className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Mother Maiden Name Details */}
                                <div className="border-t border-slate-100 pt-3 mt-1">
                                  <h4 className="text-[10px] font-black text-blue-700 tracking-wider uppercase mb-2">MOTHER'S MAIDEN NAME (REQUIRED)</h4>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1">MOTHER LAST NAME</label>
                                        <input
                                          type="text"
                                          value={pmrfMotherLastName}
                                          onChange={(e) => setPmrfMotherLastName(e.target.value.toUpperCase())}
                                          className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1">MOTHER FIRST NAME</label>
                                        <input
                                          type="text"
                                          value={pmrfMotherFirstName}
                                          onChange={(e) => setPmrfMotherFirstName(e.target.value.toUpperCase())}
                                          className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 block mb-1">MOTHER MIDDLE NAME</label>
                                      <input
                                        type="text"
                                        value={pmrfMotherMiddleName}
                                        onChange={(e) => setPmrfMotherMiddleName(e.target.value.toUpperCase())}
                                        disabled={pmrfMotherNoMiddleName || pmrfMotherMononym}
                                        className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase disabled:bg-slate-50"
                                      />
                                    </div>
                                    <div className="flex flex-wrap gap-4 py-0.5">
                                      <label className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-650 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={pmrfMotherNoMiddleName}
                                          onChange={(e) => {
                                            setPmrfMotherNoMiddleName(e.target.checked);
                                            if (e.target.checked) setPmrfMotherMiddleName('');
                                          }}
                                          className="h-4.5 w-4.5 text-blue-600 border-slate-300"
                                        />
                                        NO MIDDLE NAME
                                      </label>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>

                          {/* Group 3: Address & Contact Folder */}
                          <div className="bg-white border-2 border-slate-950 rounded-xl overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setCollapsedMobileSecs({ ...collapsedMobileSecs, address: !collapsedMobileSecs.address })}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between font-black text-xs text-slate-900 uppercase border-b-2 border-slate-950 select-none text-left"
                            >
                              <span className="tracking-wider flex items-center gap-1.5 leading-none">
                                <MapPin className="h-4 w-4 text-slate-600 shrink-0" />
                                3. Section II: Address & Contacts
                              </span>
                              {collapsedMobileSecs.address ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                            </button>
                            {collapsedMobileSecs.address && (
                              <div className="p-4 space-y-4 text-left font-bold text-xs">
                                
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black text-blue-700 tracking-wider uppercase">RESIDENTIAL ADDRESS</h4>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 block mb-1">UNIT NO / FLOOR</label>
                                      <input
                                        type="text"
                                        value={pmrfAddressUnitNoFloor}
                                        onChange={(e) => setPmrfAddressUnitNoFloor(e.target.value.toUpperCase())}
                                        className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 block mb-1">BUILDING NAME</label>
                                      <input
                                        type="text"
                                        value={pmrfAddressBuildingName}
                                        onChange={(e) => setPmrfAddressBuildingName(e.target.value.toUpperCase())}
                                        className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                      />
                                    </div>
                                  </div>

                                  <div className="relative">
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">STREET / SUBDIVISION (PUROK) <span className="text-rose-600 font-extrabold">*</span></label>
                                    <input
                                      type="text"
                                      value={pmrfAddressStreet}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setPmrfAddressStreet(val);
                                        setPmrfAddressSubdivision(val);
                                        setFormPurok(val);
                                        if (editingHH) {
                                          setEditPurok(val);
                                        }
                                        setShowFpePurokDropdown(true);
                                      }}
                                      onFocus={() => setShowFpePurokDropdown(true)}
                                      onBlur={() => {
                                        setTimeout(() => setShowFpePurokDropdown(false), 200);
                                      }}
                                      placeholder="Purok or Street Name"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs uppercase outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    {showFpePurokDropdown && fpeFilteredPuroks.length > 0 && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-205 rounded-lg shadow-xl max-h-56 overflow-y-auto left-0 divide-y divide-slate-100">
                                        {fpeFilteredPuroks.map(p => {
                                          const uppercasePurok = p.name.toUpperCase();
                                          const uppercaseBarangay = p.barangay ? p.barangay.toUpperCase() : '';
                                          return (
                                            <div
                                              key={p.id}
                                              onMouseDown={() => {
                                                setPmrfAddressStreet(uppercasePurok);
                                                setPmrfAddressSubdivision(uppercasePurok);
                                                setFormPurok(uppercasePurok);
                                                if (editingHH) {
                                                  setEditPurok(uppercasePurok);
                                                }
                                                if (uppercaseBarangay) {
                                                  setPmrfAddressBarangay(uppercaseBarangay);
                                                  setFormBarangay(uppercaseBarangay);
                                                  if (editingHH) {
                                                    setEditBarangay(uppercaseBarangay);
                                                  }
                                                }
                                                setPmrfAddressMunicipality('PAGADIAN CITY');
                                                setPmrfAddressProvince('ZAMBOANGA DEL SUR');
                                                setShowFpePurokDropdown(false);
                                              }}
                                              className="px-3 py-2.5 hover:bg-blue-50 transition-colors cursor-pointer text-left"
                                            >
                                              <div className="text-xs font-bold text-slate-800">
                                                {uppercasePurok}, {uppercaseBarangay}, PAGADIAN CITY
                                              </div>
                                              <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                Connected Barangay: {uppercaseBarangay} · Pagadian City
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="relative">
                                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">BARANGAY <span className="text-rose-600 font-extrabold">*</span></label>
                                      <input
                                        type="text"
                                        value={pmrfAddressBarangay}
                                        onChange={(e) => {
                                          const val = e.target.value.toUpperCase();
                                          setPmrfAddressBarangay(val);
                                          setFormBarangay(val);
                                          if (editingHH) {
                                            setEditBarangay(val);
                                          }
                                          setShowFpeBarangayDropdown(true);
                                        }}
                                        onFocus={() => setShowFpeBarangayDropdown(true)}
                                        onBlur={() => {
                                          setTimeout(() => setShowFpeBarangayDropdown(false), 200);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs uppercase font-extrabold text-[#1a56db] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                      />
                                      {showFpeBarangayDropdown && fpeFilteredBarangays.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-205 rounded-lg shadow-xl max-h-48 overflow-y-auto left-0">
                                          {fpeFilteredBarangays.map(b => {
                                            const uppercaseBarangay = b.name.toUpperCase();
                                            return (
                                              <div
                                                key={b.id}
                                                onMouseDown={() => {
                                                  setPmrfAddressBarangay(uppercaseBarangay);
                                                  setFormBarangay(uppercaseBarangay);
                                                  if (editingHH) {
                                                    setEditBarangay(uppercaseBarangay);
                                                  }
                                                  setPmrfAddressMunicipality('PAGADIAN CITY');
                                                  setShowFpeBarangayDropdown(false);
                                                }}
                                                className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-xs font-extrabold text-blue-900 text-left border-b border-slate-100 last:border-b-0"
                                              >
                                                {uppercaseBarangay}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">CITY / MUNICIPALITY</label>
                                      <input
                                        type="text"
                                        value={pmrfAddressMunicipality}
                                        onChange={(e) => setPmrfAddressMunicipality(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs uppercase font-extrabold"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">PROVINCE</label>
                                      <input
                                        type="text"
                                        value={pmrfAddressProvince}
                                        onChange={(e) => setPmrfAddressProvince(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs uppercase font-extrabold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">ZIP CODE</label>
                                      <input
                                        type="text"
                                        value={pmrfAddressZip}
                                        onChange={(e) => setPmrfAddressZip(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs font-mono font-extrabold text-center"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[10px] font-black text-blue-700 tracking-wider uppercase">MAILING ADDRESS</h4>
                                    <label className="flex items-center gap-1 text-[9.5px] font-bold text-slate-650 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={pmrfMailSame}
                                        onChange={(e) => setPmrfMailSame(e.target.checked)}
                                        className="h-4.5 w-4.5 text-blue-600 border-slate-300"
                                      />
                                      Same as residence
                                    </label>
                                  </div>

                                  {!pmrfMailSame && (
                                    <div className="space-y-3 pt-1">
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1">MAILING STREET / SUBDIVISION</label>
                                        <input
                                          type="text"
                                          value={pmrfMailStreet}
                                          onChange={(e) => setPmrfMailStreet(e.target.value.toUpperCase())}
                                          className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[9px] font-black text-slate-400 block mb-1">BARANGAY</label>
                                          <input
                                            type="text"
                                            value={pmrfMailBarangay}
                                            onChange={(e) => setPmrfMailBarangay(e.target.value.toUpperCase())}
                                            className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-black text-slate-400 block mb-1">CITY / MUNICIPALITY</label>
                                          <input
                                            type="text"
                                            value={pmrfMailMunicipality}
                                            onChange={(e) => setPmrfMailMunicipality(e.target.value.toUpperCase())}
                                            className="w-full px-2.5 py-1.5 border border-slate-300 bg-white rounded text-xs uppercase"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                  <h4 className="text-[10px] font-black text-blue-700 tracking-wider uppercase">CONTACT TELECOMMUNICATION CHANNELS</h4>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">MOBILE NUMBER</label>
                                      <input
                                        type="text"
                                        value={pmrfMobileNo}
                                        onChange={(e) => setPmrfMobileNo(e.target.value)}
                                        placeholder="09XXXXXXXXX"
                                        className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs font-mono font-extrabold focus:border-slate-800"
                                      />
                                      {getPmrfValidationErrors().mobile && (
                                        <p className="text-rose-600 text-[9px] font-bold mt-1 uppercase leading-tight">{getPmrfValidationErrors().mobile}</p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">LANDLINE PHONE</label>
                                      <input
                                        type="text"
                                        value={pmrfHomePhone}
                                        onChange={(e) => setPmrfHomePhone(e.target.value)}
                                        placeholder="e.g. 062-XXX-XXXX"
                                        className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-905 rounded-lg text-xs font-mono font-extrabold focus:border-slate-800"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">EMAIL ADDRESS</label>
                                    <input
                                      type="email"
                                      value={pmrfEmail}
                                      onChange={(e) => setPmrfEmail(e.target.value)}
                                      placeholder="member@email.com"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white text-slate-900 rounded-lg text-xs font-semibold focus:border-slate-800 outline-none"
                                    />
                                    {getPmrfValidationErrors().email && (
                                      <p className="text-rose-600 text-[9.5px] font-bold mt-1 uppercase leading-tight">{getPmrfValidationErrors().email}</p>
                                    )}
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>

                          {/* Group 4: Dependents Folder */}
                          <div className="bg-white border-2 border-slate-950 rounded-xl overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setCollapsedMobileSecs({ ...collapsedMobileSecs, dependents: !collapsedMobileSecs.dependents })}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between font-black text-xs text-slate-900 uppercase border-b-2 border-slate-950 select-none text-left"
                            >
                              <span className="tracking-wider flex items-center gap-1.5 leading-none">
                                <Users className="h-4 w-4 text-slate-600 shrink-0" />
                                4. Section III: Declaration of Dependents ({wizardDependents.length})
                              </span>
                              {collapsedMobileSecs.dependents ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                            </button>
                            {collapsedMobileSecs.dependents && (
                              <div className="p-4 space-y-4 text-left font-bold text-xs">
                                
                                <div className="space-y-4 divide-y divide-slate-100">
                                  {wizardDependents.map((dep, index) => (
                                    <div key={index} className={`pt-3 ${index === 0 ? 'pt-0' : ''} text-left`}>
                                      <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-[10px] font-black text-blue-700 uppercase">DEPENDENT #{index + 1}</h4>
                                        <button
                                          type="button"
                                          onClick={() => setWizardDependents(wizardDependents.filter((_, dIdx) => dIdx !== index))}
                                          className="text-[10px] font-black text-red-650 hover:text-red-850 px-2 py-1 border border-red-300 rounded hover:bg-rose-50 cursor-pointer min-h-[36px] flex items-center"
                                        >
                                          DELETE CARD
                                        </button>
                                      </div>
                                      <div className="text-xs space-y-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-850">
                                        <div><span className="text-slate-400 font-black tracking-wide text-[9px] mr-1 uppercase">FULL NAME:</span> {dep.fullName}</div>
                                        <div><span className="text-slate-400 font-black tracking-wide text-[9px] mr-1 uppercase">RELATIONSHIP:</span> {dep.relationship}</div>
                                        <div><span className="text-slate-400 font-black tracking-wide text-[9px] mr-1 uppercase">BIRTHDATE:</span> {dep.birthDate || dep.birthdate}</div>
                                        <div><span className="text-slate-400 font-black tracking-wide text-[9px] mr-1 uppercase">CITIZENSHIP:</span> {dep.citizenship}</div>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Mobile inputs to add new dependent */}
                                  <div className="pt-4 space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-855 uppercase tracking-widest bg-slate-100 p-1.5 rounded inline-block">ADD NEW DEPENDENT</h4>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        placeholder="LAST NAME"
                                        value={depLastName}
                                        onChange={(e) => setDepLastName(e.target.value.toUpperCase())}
                                        className="w-full px-2.5 py-2 border border-slate-350 bg-white rounded text-xs uppercase"
                                      />
                                      <input
                                        type="text"
                                        placeholder="FIRST NAME"
                                        value={depFirstName}
                                        onChange={(e) => setDepFirstName(e.target.value.toUpperCase())}
                                        className="w-full px-2.5 py-2 border border-slate-350 bg-white rounded text-xs uppercase"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        placeholder="MIDDLE NAME"
                                        value={depMiddleName}
                                        onChange={(e) => setDepMiddleName(e.target.value.toUpperCase())}
                                        disabled={depNoMN}
                                        className="w-full px-2.5 py-2 border border-slate-350 bg-white rounded text-xs uppercase disabled:bg-slate-50"
                                      />
                                      <input
                                        type="text"
                                        placeholder="SUFFIX"
                                        value={depNameExt}
                                        onChange={(e) => setDepNameExt(e.target.value.toUpperCase())}
                                        className="w-full px-2.5 py-2 border border-slate-350 bg-white rounded text-xs uppercase"
                                      />
                                    </div>

                                    <div className="flex flex-wrap gap-4 py-0.5">
                                      <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={depNoMN}
                                          onChange={(e) => {
                                            setDepNoMN(e.target.checked);
                                            if (e.target.checked) setDepMiddleName('');
                                          }}
                                          className="h-4.5 w-4.5 text-blue-600 border-slate-300"
                                        />
                                        NO MIDDLE NAME
                                      </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1 font-sans">RELATIONSHIP</label>
                                        <select
                                          value={depRelation}
                                          onChange={(e) => setDepRelation(e.target.value)}
                                          className="w-full px-2 py-2 border border-slate-350 bg-white rounded text-xs text-slate-900 font-extrabold"
                                        >
                                          <option value="Spouse">SPOUSE</option>
                                          <option value="Child">CHILD</option>
                                          <option value="Parent">PARENT</option>
                                          <option value="Sibling">SIBLING</option>
                                          <option value="Other">OTHER RELATIVE</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-black text-slate-400 block mb-1 font-sans">BIRTHDATE</label>
                                        <input
                                          type="date"
                                          value={depBirthDate}
                                          onChange={(e) => setDepBirthDate(e.target.value)}
                                          className="w-full px-2 py-1.5 border border-slate-355 bg-white rounded text-xs font-mono"
                                        />
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={handleAddDependentToWizard}
                                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-xs tracking-wider cursor-pointer min-h-[44px] shadow-md border-2 border-green-800 active:scale-95 transition uppercase text-center block"
                                    >
                                      ADD TO DEPENDENTS LIST
                                    </button>
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>

                          {/* Group 5: Contributor Category Folder */}
                          <div className="bg-white border-2 border-slate-950 rounded-xl overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setCollapsedMobileSecs({ ...collapsedMobileSecs, contributor: !collapsedMobileSecs.contributor })}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between font-black text-xs text-slate-900 uppercase border-b-2 border-slate-950 select-none text-left"
                            >
                              <span className="tracking-wider flex items-center gap-1.5 leading-none">
                                <Building className="h-4 w-4 text-slate-600 shrink-0" />
                                5. Section IV: Member Category
                              </span>
                              {collapsedMobileSecs.contributor ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                            </button>
                            {collapsedMobileSecs.contributor && (
                              <div className="p-4 space-y-4 text-left font-bold text-xs text-slate-800">
                                
                                <div>
                                  <label className="text-[10px] font-black text-slate-400 block mb-1 uppercase">PRIMARY CATEGORY</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPmrfContributorCategory('DIRECT');
                                        setPmrfContributorType('Employed Private');
                                      }}
                                      className={`py-2 px-3 border border-slate-950 rounded-lg text-[10px] font-black tracking-wider transition uppercase ${
                                        pmrfContributorCategory === 'DIRECT'
                                          ? 'bg-blue-800 text-white'
                                          : 'bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      DIRECT CONTRIBUTOR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPmrfContributorCategory('INDIRECT');
                                        setPmrfContributorType('Indigent');
                                      }}
                                      className={`py-2 px-3 border border-slate-950 rounded-lg text-[10px] font-black tracking-wider transition uppercase ${
                                        pmrfContributorCategory === 'INDIRECT'
                                          ? 'bg-blue-800 text-white'
                                          : 'bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      INDIRECT CONTRIBUTOR
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] font-black text-slate-400 block mb-1 uppercase">DETAILED MEMBER CONTRIB TYPE</label>
                                  {pmrfContributorCategory === 'DIRECT' ? (
                                    <select
                                      value={pmrfContributorType}
                                      onChange={(e) => setPmrfContributorType(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs font-extrabold"
                                    >
                                      <option value="Employed Private">EMPLOYED PRIVATE</option>
                                      <option value="Employed Government">EMPLOYED GOVERNMENT</option>
                                      <option value="Self-Earning Individual">SELF-EARNING INDIVIDUAL</option>
                                      <option value="Professional Practitioner">PROFESSIONAL PRACTITIONER</option>
                                      <option value="Kasambahay">KASAMBAHAY</option>
                                      <option value="Migrant Worker (Land-based)">MIGRANT WORKER (LAND-BASED)</option>
                                      <option value="Migrant Worker (Sea-based)">MIGRANT WORKER (SEA-BASED)</option>
                                    </select>
                                  ) : (
                                    <select
                                      value={pmrfContributorType}
                                      onChange={(e) => setPmrfContributorType(e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs font-extrabold"
                                    >
                                      <option value="Indigent">LISTAHANAN INDIGENT</option>
                                      <option value="Indigent 4Ps">4PS / PANTAWID PAMILYA</option>
                                      <option value="Senior Citizen">SENIOR CITIZEN</option>
                                      <option value="PWD">PERSON WITH DISABILITY (PWD)</option>
                                      <option value="Lifetime Member">LIFETIME MEMBER</option>
                                    </select>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">PROFESSION</label>
                                    <input
                                      type="text"
                                      value={pmrfProfession}
                                      onChange={(e) => setPmrfProfession(e.target.value.toUpperCase())}
                                      placeholder="e.g. FARMER"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs uppercase"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9.5px] font-black text-slate-500 block mb-1">MONTHLY INCOME</label>
                                    <input
                                      type="text"
                                      value={pmrfMonthlyIncome}
                                      onChange={(e) => setPmrfMonthlyIncome(e.target.value)}
                                      placeholder="e.g. 15000"
                                      className="w-full px-3 py-2 border border-slate-350 bg-white rounded-lg text-xs font-mono font-bold"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 block mb-1">PROOF OF INCOME FILE / REF</label>
                                  <input
                                    type="text"
                                    value={pmrfProofOfIncome}
                                    onChange={(e) => setPmrfProofOfIncome(e.target.value)}
                                    placeholder="Certificate / Payslip Reference No"
                                    className="w-full px-3 py-2 border border-slate-355 bg-white rounded-lg text-xs uppercase"
                                  />
                                </div>

                              </div>
                            )}
                          </div>

                          {/* Progress Consents / SFC Settings Drawer */}
                          <div className="bg-[#f0f4ff] border-2 border-slate-950 rounded-xl p-4 shadow-sm text-left space-y-3">
                            <h4 className="text-[10px] font-black text-[#1a56db] uppercase tracking-wider">FORM ENROLLMENT STATUSES</h4>
                            <div className="grid grid-cols-1 gap-3">
                              <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase">PMRF Status Consent</label>
                                <select
                                  value={formPmrf}
                                  onChange={(e) => setFormPmrf(e.target.value as any)}
                                  className="block w-full bg-white border-2 border-slate-950 p-2 text-xs mt-1 outline-none font-extrabold text-slate-900 rounded-lg"
                                >
                                  <option value="Willing">Willing to Enroll</option>
                                  <option value="Not Willing">Not Willing to Enroll</option>
                                  <option value="Pending">Pending Evaluation Consent</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase">SFC Enrollment Status</label>
                                <select
                                  value={formYakap}
                                  onChange={(e) => setFormYakap(e.target.value as any)}
                                  className="block w-full bg-white border-2 border-slate-950 p-2 text-xs mt-1 outline-none font-extrabold text-[#1a56db] rounded-lg"
                                >
                                  <option value="Willing">Willing to Participate</option>
                                  <option value="Not Willing">Not Willing to Participate</option>
                                  <option value="Pending">Pending Decision</option>
                                </select>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* DESKTOP PRINT DESIGN (hidden md:block print:block) */}
                        <div className="hidden md:block print:block w-full overflow-x-auto pb-4">
                          <div className="bg-white border-[3px] border-black p-4 text-black font-sans text-[10px] uppercase tracking-normal relative shadow-sm min-w-[750px] leading-tight">
                    
                    {/* PMRF Header - Redesigned to strictly match the reference image */}
                    <div className="border-[2.5px] border-black bg-white grid grid-cols-1 md:grid-cols-12 select-none overflow-hidden text-black font-sans leading-tight">
                      
                      {/* Left Section: Logo & Reminders */}
                      <div className="md:col-span-6 p-4 flex flex-col border-b md:border-b-0 md:border-r border-black justify-between">
                        {/* PhilHealth Logo Section */}
                        <div className="flex items-center gap-3">
                          <PhilHealthLogo className="h-16 w-16 shrink-0" />
                          <div className="flex flex-col">
                            <div className="flex items-baseline leading-none">
                              <span className="text-[32px] font-black tracking-tighter text-[#1f2937]" style={{ fontFamily: "Inter, sans-serif" }}>Phil</span>
                              <span className="text-[32px] font-extrabold tracking-tighter text-[#111827]" style={{ fontFamily: "Georgia, serif" }}>Health</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-850 italic mt-0.5 pl-0.5 block leading-none" style={{ fontFamily: "Georgia, serif" }}>
                              Your Partner in Health
                            </span>
                          </div>
                        </div>

                        {/* Horizontal divider */}
                        <div className="border-t border-black my-2.5"></div>

                        {/* Reminders section */}
                        <div className="flex flex-col text-black">
                          <span className="text-[10.5px] font-black underline tracking-wide mb-1.5 uppercase leading-none block">
                            REMINDERS:
                          </span>
                          <ol className="list-decimal list-outside pl-4 space-y-1 text-[8px] font-extrabold text-justify tracking-tight leading-normal uppercase">
                            <li>Your PhilHealth Identification Number (PIN) is your unique and permanent number.</li>
                            <li>Always use your PIN in all transactions with PhilHealth.</li>
                            <li>For Updating/Amendment check the appropriate box and provide details to be accomplished and submit corresponding supporting documents.</li>
                            <li>Please read instructions at the back before filling-out this form.</li>
                          </ol>
                        </div>
                      </div>

                      {/* Right Section: Form titles, PIN, Purpose & Preferred Provider */}
                      <div className="md:col-span-6 p-4 flex flex-col justify-between space-y-4">
                        {/* Centered Document Titles */}
                        <div className="text-center flex flex-col space-y-1">
                          <h2 className="text-[30px] font-extrabold tracking-tighter leading-none text-black uppercase" style={{ fontFamily: "Inter, sans-serif" }}>PMRF</h2>
                          <p className="text-[9.5px] font-black tracking-tight text-black leading-none uppercase">
                            PHILHEALTH MEMBER REGISTRATION FORM
                          </p>
                          <span className="text-[9px] font-extrabold text-black leading-none uppercase">
                            UHC v.1 January 2020
                          </span>
                        </div>

                        {/* Segmented PIN Field (4, 4, 4 grid) */}
                        <div className="flex flex-col items-center select-none">
                          <div className="flex items-center gap-1.5">
                            {/* Segment 1: 4 digits */}
                            <div className="flex border border-black bg-white divide-x divide-black h-7">
                              {Array.from({ length: 4 }).map((_, idx) => {
                                const i = idx;
                                const char = pmrfPin[i] || '';
                                return (
                                  <input
                                    key={i}
                                    id={`pin-input-${i}`}
                                    type="text"
                                    maxLength={1}
                                    value={char}
                                    className="w-[20px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-50 text-black uppercase animate-none p-0 border-0 min-w-0"
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      const chars = pmrfPin.padEnd(12, ' ').split('');
                                      chars[i] = val.slice(-1);
                                      const newVal = chars.join('').replace(/\s+$/, '');
                                      setPmrfPin(newVal);
                                      if (val && i < 11) {
                                        const nextEl = document.getElementById(`pin-input-${i + 1}`);
                                        if (nextEl) (nextEl as HTMLInputElement).focus();
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Backspace' && !char && i > 0) {
                                        const prevEl = document.getElementById(`pin-input-${i - 1}`);
                                        if (prevEl) {
                                          prevEl.focus();
                                          const chars = pmrfPin.split('');
                                          chars[i - 1] = '';
                                          setPmrfPin(chars.join('').replace(/\s+$/, ''));
                                        }
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>

                            {/* Separator block space */}
                            <div className="w-[1px]"></div>

                            {/* Segment 2: 4 digits */}
                            <div className="flex border border-black bg-white divide-x divide-black h-7">
                              {Array.from({ length: 4 }).map((_, idx) => {
                                const i = idx + 4;
                                const char = pmrfPin[i] || '';
                                return (
                                  <input
                                    key={i}
                                    id={`pin-input-${i}`}
                                    type="text"
                                    maxLength={1}
                                    value={char}
                                    className="w-[20px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-50 text-black uppercase animate-none p-0 border-0 min-w-0"
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      const chars = pmrfPin.padEnd(12, ' ').split('');
                                      chars[i] = val.slice(-1);
                                      const newVal = chars.join('').replace(/\s+$/, '');
                                      setPmrfPin(newVal);
                                      if (val && i < 11) {
                                        const nextEl = document.getElementById(`pin-input-${i + 1}`);
                                        if (nextEl) (nextEl as HTMLInputElement).focus();
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Backspace' && !char && i > 0) {
                                        const prevEl = document.getElementById(`pin-input-${i - 1}`);
                                        if (prevEl) {
                                          prevEl.focus();
                                          const chars = pmrfPin.split('');
                                          chars[i - 1] = '';
                                          setPmrfPin(chars.join('').replace(/\s+$/, ''));
                                        }
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>

                            {/* Separator block space */}
                            <div className="w-[1px]"></div>

                            {/* Segment 3: 4 digits */}
                            <div className="flex border border-black bg-white divide-x divide-black h-7">
                              {Array.from({ length: 4 }).map((_, idx) => {
                                const i = idx + 8;
                                const char = pmrfPin[i] || '';
                                return (
                                  <input
                                    key={i}
                                    id={`pin-input-${i}`}
                                    type="text"
                                    maxLength={1}
                                    value={char}
                                    className="w-[20px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-50 text-black uppercase animate-none p-0 border-0 min-w-0"
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      const chars = pmrfPin.padEnd(12, ' ').split('');
                                      chars[i] = val.slice(-1);
                                      const newVal = chars.join('').replace(/\s+$/, '');
                                      setPmrfPin(newVal);
                                      if (val && i < 11) {
                                        const nextEl = document.getElementById(`pin-input-${i + 1}`);
                                        if (nextEl) (nextEl as HTMLInputElement).focus();
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Backspace' && !char && i > 0) {
                                        const prevEl = document.getElementById(`pin-input-${i - 1}`);
                                        if (prevEl) {
                                          prevEl.focus();
                                          const chars = pmrfPin.split('');
                                          chars[i - 1] = '';
                                          setPmrfPin(chars.join('').replace(/\s+$/, ''));
                                        }
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          <span className="text-[8.5px] font-black text-black tracking-tight mt-1 ml-0.5 uppercase select-none block text-center">
                            PHILHEALTH IDENTIFICATION NUMBER (PIN)
                          </span>
                        </div>

                        {/* PURPOSE Block */}
                        <div className="flex flex-col space-y-1">
                          <span className="text-[10px] font-black text-black uppercase select-none">
                            PURPOSE:
                          </span>
                          <div className="flex items-center gap-6">
                            <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer uppercase select-none">
                              <input 
                                type="checkbox" 
                                checked={pmrfPurpose === 'REGISTRATION'}
                                onChange={() => setPmrfPurpose('REGISTRATION')}
                                className="h-4 w-4 border border-black accent-black cursor-pointer"
                              />
                              <span>REGISTRATION</span>
                            </label>
                            <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer uppercase select-none">
                              <input 
                                type="checkbox" 
                                checked={pmrfPurpose === 'UPDATING'}
                                onChange={() => setPmrfPurpose('UPDATING')}
                                className="h-4 w-4 border border-black accent-black cursor-pointer"
                              />
                              <span>UPDATING/AMENDMENT</span>
                            </label>
                          </div>
                        </div>

                        {/* Preferred Provider Input Field */}
                        <div className="w-full flex flex-col space-y-0.5">
                          <label className="text-[10px] font-black text-black block select-none">
                            Preferred KonSuLTa Provider
                          </label>
                          <div className="border border-black bg-white p-0.5">
                            <input 
                              type="text" 
                              value={pmrfKonsulta} 
                              onChange={(e) => setPmrfKonsulta(e.target.value)} 
                              placeholder="Enter provider name"
                              className="w-full bg-white px-2 py-1 font-bold text-[11px] uppercase outline-none text-black tracking-normal placeholder-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section I Header */}
                    <div className="bg-[#dee5db] border-x border-b border-black text-black font-black px-4 py-2 text-[11px] tracking-widest block select-none text-center uppercase font-sans">
                      I. PERSONAL DETAILS
                    </div>

                    {/* Member Information Grid Table */}
                    <div className="overflow-x-auto border-x border-b border-black bg-white select-none">
                      <table className="w-full border-collapse text-[9px] font-sans table-fixed min-w-[750px] text-black">
                        <thead>
                          <tr className="bg-white border-b border-black text-center h-10 text-[7px] font-bold select-none">
                            <th className="border-r border-black w-[13%]"></th>
                            <th className="border-r border-black w-[20%] font-black uppercase tracking-tight text-center">LAST NAME</th>
                            <th className="border-r border-black w-[22%] font-black uppercase tracking-tight text-center">FIRST NAME</th>
                            <th className="border-r border-black w-[11%] font-black tracking-tight leading-none text-center text-[7.2px]">
                              NAME EXTENSION<br/><span className="text-[6.5px] font-semibold">(Jr./Sr./III)</span>
                            </th>
                            <th className="border-r border-black w-[20%] font-black uppercase tracking-tight text-center">MIDDLE NAME</th>
                            <th className="border-r border-black w-[7%] font-black tracking-tight leading-tight text-center text-[6.5px]">
                              NO<br/>MIDDLE<br/>NAME
                              <span className="block text-[5px] font-semibold tracking-tighter mt-[2px] leading-none uppercase text-slate-500">(Check if applicable only)</span>
                            </th>
                            <th className="w-[7%] font-black tracking-tight leading-tight text-center text-[6.5px]">
                              MONONYM
                              <span className="block text-[5px] font-semibold tracking-tighter mt-[2px] leading-none uppercase text-slate-500">(Check if applicable only)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* MEMBER ROW */}
                          <tr className="border-b border-black h-11">
                            <td className="border-r border-black px-2.5 font-black text-[9.5px] text-black bg-slate-50/50 text-left uppercase leading-none select-none">
                              MEMBER
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfLastName} 
                                onChange={(e) => setPmrfLastName(e.target.value)} 
                                placeholder="Enter last name"
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10.5px] font-bold uppercase text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfFirstName} 
                                onChange={(e) => setPmrfFirstName(e.target.value)} 
                                placeholder="Enter first name"
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10.5px] font-bold uppercase text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white text-center">
                              <input 
                                type="text" 
                                value={pmrfNameExt} 
                                onChange={(e) => setPmrfNameExt(e.target.value)} 
                                placeholder="e.g. JR"
                                className="w-full h-[32px] bg-transparent border-0 px-1 text-[10.5px] font-bold uppercase text-center text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfMiddleName} 
                                onChange={(e) => setPmrfMiddleName(e.target.value)} 
                                disabled={pmrfMemberNoMiddleName || pmrfMemberMononym}
                                placeholder={pmrfMemberNoMiddleName ? "N/A" : pmrfMemberMononym ? "N/A" : "Enter middle name"}
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10.5px] font-bold uppercase text-black outline-none disabled:bg-slate-100/80 focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black bg-white text-center p-1 relative">
                              <div className="flex items-center justify-center h-full">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfMemberNoMiddleName} 
                                  onChange={(e) => {
                                    setPmrfMemberNoMiddleName(e.target.checked);
                                    if (e.target.checked) {
                                      setPmrfMiddleName('');
                                      setPmrfMemberMononym(false);
                                    }
                                  }}
                                  className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                                />
                              </div>
                            </td>
                            <td className="bg-white text-center p-1 relative">
                              <div className="flex items-center justify-center h-full">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfMemberMononym} 
                                  onChange={(e) => {
                                    setPmrfMemberMononym(e.target.checked);
                                    if (e.target.checked) {
                                      setPmrfMiddleName('');
                                      setPmrfMemberNoMiddleName(false);
                                    }
                                  }}
                                  className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                                />
                              </div>
                            </td>
                          </tr>

                          {/* MOTHER MAIDEN ROW */}
                          <tr className="border-b border-black h-11">
                            <td className="border-r border-black px-2.5 font-black text-[7px] text-black bg-slate-50/50 text-left uppercase leading-[1.1] select-none">
                              MOTHER's<br/>MAIDEN NAME <span className="text-red-500 font-extrabold text-[9px]">*</span>
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfMotherLastName} 
                                onChange={(e) => setPmrfMotherLastName(e.target.value)} 
                                placeholder="Mother's Last"
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfMotherFirstName} 
                                onChange={(e) => setPmrfMotherFirstName(e.target.value)} 
                                placeholder="Mother's First"
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white text-center">
                              <input 
                                type="text" 
                                value={pmrfMotherNameExt} 
                                onChange={(e) => setPmrfMotherNameExt(e.target.value)} 
                                placeholder="Ext"
                                className="w-full h-[32px] bg-transparent border-0 px-1 text-[10px] font-bold uppercase text-center text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfMotherMiddleName} 
                                onChange={(e) => setPmrfMotherMiddleName(e.target.value)} 
                                disabled={pmrfMotherNoMiddleName || pmrfMotherMononym}
                                placeholder={pmrfMotherNoMiddleName ? "N/A" : pmrfMotherMononym ? "N/A" : "Mother's Middle"}
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10px] font-bold uppercase text-black outline-none disabled:bg-slate-100/80 focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black bg-white text-center p-1 relative">
                              <div className="flex items-center justify-center h-full">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfMotherNoMiddleName} 
                                  onChange={(e) => {
                                    setPmrfMotherNoMiddleName(e.target.checked);
                                    if (e.target.checked) {
                                      setPmrfMotherMiddleName('');
                                      setPmrfMotherMononym(false);
                                    }
                                  }}
                                  className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                                />
                              </div>
                            </td>
                            <td className="bg-white text-center p-1 relative">
                              <div className="flex items-center justify-center h-full">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfMotherMononym} 
                                  onChange={(e) => {
                                    setPmrfMotherMononym(e.target.checked);
                                    if (e.target.checked) {
                                      setPmrfMotherMiddleName('');
                                      setPmrfMotherNoMiddleName(false);
                                    }
                                  }}
                                  className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                                />
                              </div>
                            </td>
                          </tr>

                          {/* SPOUSE ROW */}
                          <tr className="h-11">
                            <td className="border-r border-black px-2.5 font-black text-[7px] text-black bg-slate-50/50 text-left uppercase leading-[1.1] select-none">
                              SPOUSE<br/><span className="text-[5.5px] font-bold text-slate-700 normal-case">(If married)</span>
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfSpouseLastName} 
                                onChange={(e) => setPmrfSpouseLastName(e.target.value)} 
                                placeholder="Spouse's Last"
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfSpouseFirstName} 
                                onChange={(e) => setPmrfSpouseFirstName(e.target.value)} 
                                placeholder="Spouse's First"
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white text-center">
                              <input 
                                type="text" 
                                value={pmrfSpouseNameExt} 
                                onChange={(e) => setPmrfSpouseNameExt(e.target.value)} 
                                placeholder="Ext"
                                className="w-full h-[32px] bg-transparent border-0 px-1 text-[10px] font-bold uppercase text-center text-black outline-none focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black p-0.5 bg-white">
                              <input 
                                type="text" 
                                value={pmrfSpouseMiddleName} 
                                onChange={(e) => setPmrfSpouseMiddleName(e.target.value)} 
                                disabled={pmrfSpouseNoMiddleName || pmrfSpouseMononym}
                                placeholder={pmrfSpouseNoMiddleName ? "N/A" : pmrfSpouseMononym ? "N/A" : "Spouse's Middle"}
                                className="w-full h-[32px] bg-transparent border-0 px-2 text-[10px] font-bold uppercase text-black outline-none disabled:bg-slate-100/80 focus:bg-amber-50/55"
                              />
                            </td>
                            <td className="border-r border-black bg-white text-center p-1 relative">
                              <div className="flex items-center justify-center h-full">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfSpouseNoMiddleName} 
                                  onChange={(e) => {
                                    setPmrfSpouseNoMiddleName(e.target.checked);
                                    if (e.target.checked) {
                                      setPmrfSpouseMiddleName('');
                                      setPmrfSpouseMononym(false);
                                    }
                                  }}
                                  className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                                />
                              </div>
                            </td>
                            <td className="bg-white text-center p-1 relative">
                              <div className="flex items-center justify-center h-full">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfSpouseMononym} 
                                  onChange={(e) => {
                                    setPmrfSpouseMononym(e.target.checked);
                                    if (e.target.checked) {
                                      setPmrfSpouseMiddleName('');
                                      setPmrfSpouseNoMiddleName(false);
                                    }
                                  }}
                                  className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                                />
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* DOB, Place of birth, Sex, Civil status, Citizenship, PhilSys, TIN */}
                    <div className="grid grid-cols-1 md:grid-cols-12 border-x border-b border-black divide-y md:divide-y-0 divide-black bg-white">
                      
                      {/* Left Block (Col Span 8 of 12) - contains DOB/POB and SEX/STATUS/CITIZENSHIP */}
                      <div className="md:col-span-8 flex flex-col divide-y divide-black border-b md:border-b-0 md:border-r border-black">
                        
                        {/* Row A: Date of Birth and Place of Birth */}
                        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
                          
                          {/* Date of Birth (Span 5 of 12) */}
                          <div className="md:col-span-5 p-2 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center">
                                <span className="text-[8.5px] font-black text-black select-none tracking-tight uppercase leading-none">
                                  DATE OF BIRTH
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1 mt-2 mb-1.5 select-none">
                                {/* Month digital segment */}
                                <div className="flex flex-col items-center">
                                  <div className="flex border border-black bg-white divide-x divide-black h-7">
                                    {Array.from({ length: 2 }).map((_, idx) => {
                                      const parts = pmrfBirthDate && pmrfBirthDate.split('-').length === 3 ? pmrfBirthDate.split('-') : ['', '', ''];
                                      const mm = parts[1] || '';
                                      const char = mm[idx] || '';
                                      return (
                                        <input
                                          key={`m-${idx}`}
                                          id={`dob-box-m-${idx}`}
                                          type="text"
                                          maxLength={1}
                                          value={char}
                                          className="w-[18px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            const currentMM = mm.padEnd(2, ' ').split('');
                                            currentMM[idx] = val.slice(-1) || ' ';
                                            const newMM = currentMM.join('');
                                            
                                            let yyyy = parts[0] || '1900';
                                            let currentDD = parts[2] || '01';
                                            setPmrfBirthDate(`${yyyy.padEnd(4, '0')}-${newMM.replace(/\s/g, '0')}-${currentDD.padEnd(2, '0')}`);
                                            
                                            if (val && idx < 1) {
                                              document.getElementById(`dob-box-m-${idx + 1}`)?.focus();
                                            } else if (val && idx === 1) {
                                              document.getElementById(`dob-box-d-0`)?.focus();
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !char) {
                                              if (idx > 0) {
                                                document.getElementById(`dob-box-m-${idx - 1}`)?.focus();
                                              }
                                            }
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="text-[7px] font-extrabold text-black mt-0.5 tracking-widest uppercase select-none leading-none">m m</span>
                                </div>

                                <div className="w-[1px]"></div>

                                {/* Day digital segment */}
                                <div className="flex flex-col items-center">
                                  <div className="flex border border-black bg-white divide-x divide-black h-7">
                                    {Array.from({ length: 2 }).map((_, idx) => {
                                      const parts = pmrfBirthDate && pmrfBirthDate.split('-').length === 3 ? pmrfBirthDate.split('-') : ['', '', ''];
                                      const dd = parts[2] || '';
                                      const char = dd[idx] || '';
                                      return (
                                        <input
                                          key={`d-${idx}`}
                                          id={`dob-box-d-${idx}`}
                                          type="text"
                                          maxLength={1}
                                          value={char}
                                          className="w-[18px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            const currentDD = dd.padEnd(2, ' ').split('');
                                            currentDD[idx] = val.slice(-1) || ' ';
                                            const newDD = currentDD.join('');
                                            
                                            let yyyy = parts[0] || '1900';
                                            let currentMM = parts[1] || '01';
                                            setPmrfBirthDate(`${yyyy.padEnd(4, '0')}-${currentMM.padEnd(2, '0')}-${newDD.replace(/\s/g, '0')}`);
                                            
                                            if (val && idx < 1) {
                                              document.getElementById(`dob-box-d-${idx + 1}`)?.focus();
                                            } else if (val && idx === 1) {
                                              document.getElementById(`dob-box-y-0`)?.focus();
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !char) {
                                              if (idx > 0) {
                                                document.getElementById(`dob-box-d-${idx - 1}`)?.focus();
                                              } else {
                                                document.getElementById(`dob-box-m-1`)?.focus();
                                              }
                                            }
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="text-[7px] font-extrabold text-black mt-0.5 tracking-widest uppercase select-none leading-none">d d</span>
                                </div>

                                <div className="w-[1px]"></div>

                                {/* Year digital segment */}
                                <div className="flex flex-col items-center">
                                  <div className="flex border border-black bg-white divide-x divide-black h-7">
                                    {Array.from({ length: 4 }).map((_, idx) => {
                                      const parts = pmrfBirthDate && pmrfBirthDate.split('-').length === 3 ? pmrfBirthDate.split('-') : ['', '', ''];
                                      const yyyy = parts[0] || '';
                                      const char = yyyy[idx] || '';
                                      return (
                                        <input
                                          key={`y-${idx}`}
                                          id={`dob-box-y-${idx}`}
                                          type="text"
                                          maxLength={1}
                                          value={char}
                                          className="w-[18px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            const currentYY = yyyy.padEnd(4, ' ').split('');
                                            currentYY[idx] = val.slice(-1) || ' ';
                                            const newYY = currentYY.join('');
                                            
                                            let currentMM = parts[1] || '01';
                                            let currentDD = parts[2] || '01';
                                            setPmrfBirthDate(`${newYY.replace(/\s/g, '0')}-${currentMM.padEnd(2, '0')}-${currentDD.padEnd(2, '0')}`);
                                            
                                            if (val && idx < 3) {
                                              document.getElementById(`dob-box-y-${idx + 1}`)?.focus();
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !char) {
                                              if (idx > 0) {
                                                document.getElementById(`dob-box-y-${idx - 1}`)?.focus();
                                              } else {
                                                document.getElementById(`dob-box-d-1`)?.focus();
                                              }
                                            }
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <span className="text-[7px] font-extrabold text-black mt-0.5 tracking-widest uppercase select-none leading-none">y y y y</span>
                                </div>

                                {/* Calendar picker placed right beside the year box and resized bigger */}
                                <div className="relative ml-2 flex items-center justify-center h-7 w-7 self-start mt-0.5">
                                  <input 
                                    type="date" 
                                    id="pmrf-native-dob-picker"
                                    value={pmrfBirthDate} 
                                    onChange={(e) => setPmrfBirthDate(e.target.value)} 
                                    className="absolute inset-0 opacity-0 w-7 h-7 cursor-pointer z-10"
                                  />
                                  <svg className="h-5.5 w-5.5 text-slate-600 hover:text-black hover:scale-105 active:scale-95 cursor-pointer transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            <span className="text-[6.5px] text-slate-400 block leading-none select-none mt-1">Format: MM-DD-YYYY</span>
                          </div>
                          
                          {/* Place of birth (Span 7 of 12) */}
                          <div className="md:col-span-7 p-2 flex flex-col justify-between">
                            <div>
                              <label className="text-[8.5px] font-black text-black leading-tight block mb-0.5 select-none uppercase">
                                PLACE OF BIRTH <span className="text-[7px] font-bold text-slate-750 normal-case">(City/Municipality/Province/Country)</span>
                              </label>
                              <span className="text-[6.5px] text-slate-500 font-bold block leading-none select-none uppercase mb-1.5">
                                (Please indicate country if born outside the Philippines)
                              </span>
                            </div>
                            <input 
                              type="text" 
                              value={pmrfBirthPlace} 
                              onChange={(e) => setPmrfBirthPlace(e.target.value)} 
                              placeholder="e.g. PAGADIAN CITY, ZAMBOANGA DEL SUR"
                              className="w-full bg-white border border-slate-300 p-1 font-bold text-[10px] uppercase outline-none focus:bg-amber-50/55 text-black"
                            />
                          </div>
                        </div>

                        {/* Row B: Sex, Civil Status, Citizenship */}
                        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black grow">
                          
                          {/* SEX (Span 2 of 12) */}
                          <div className="md:col-span-2 p-2 flex flex-col justify-start">
                            <span className="text-[8.5px] font-black text-black leading-none mb-2 select-none uppercase">SEX</span>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfSex === 'Male'}
                                  onChange={() => setPmrfSex('Male')}
                                  className="h-4 w-4 border border-black accent-black cursor-pointer"
                                />
                                <span>Male</span>
                              </label>
                              <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfSex === 'Female'}
                                  onChange={() => setPmrfSex('Female')}
                                  className="h-4 w-4 border border-black accent-black cursor-pointer"
                                />
                                <span>Female</span>
                              </label>
                            </div>
                          </div>

                          {/* CIVIL STATUS (Span 5 of 12) */}
                          <div className="md:col-span-5 p-2 flex flex-col justify-start">
                            <span className="text-[8.5px] font-black text-black leading-none mb-2 select-none uppercase">CIVIL STATUS</span>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[8px] font-extrabold text-black">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCivilStatus === 'Single'}
                                  onChange={() => setPmrfCivilStatus('Single')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Single</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCivilStatus === 'Annulled'}
                                  onChange={() => setPmrfCivilStatus('Annulled')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Annulled</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCivilStatus === 'Married'}
                                  onChange={() => setPmrfCivilStatus('Married')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Married</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCivilStatus === 'Widowed'}
                                  onChange={() => setPmrfCivilStatus('Widowed')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Widow/er</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase col-span-2 leading-none mt-0.5">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCivilStatus === 'Legally Separated'}
                                  onChange={() => setPmrfCivilStatus('Legally Separated')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Legally Separated</span>
                              </label>
                            </div>
                          </div>

                          {/* CITIZENSHIP (Span 5 of 12) */}
                          <div className="md:col-span-5 p-2 flex flex-col justify-start">
                            <span className="text-[8.5px] font-black text-black leading-none mb-2 select-none uppercase">CITIZENSHIP</span>
                            <div className="flex flex-col gap-1.5 text-[8px] font-extrabold text-black">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCitizenship === 'FILIPINO'}
                                  onChange={() => setPmrfCitizenship('FILIPINO')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Filipino</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCitizenship === 'DUAL'}
                                  onChange={() => setPmrfCitizenship('DUAL')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Dual Citizen</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none uppercase leading-none">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfCitizenship === 'FOREIGN'}
                                  onChange={() => setPmrfCitizenship('FOREIGN')}
                                  className="h-3.5 w-3.5 border border-black accent-black cursor-pointer"
                                />
                                <span>Foreign National</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Block (Col Span 4 of 12) - contains ID numbers vertically stacked */}
                      <div className="md:col-span-4 flex flex-col divide-y divide-black bg-white">
                        
                        {/* 1. PhilSys Box */}
                        <div className="p-3 flex flex-col justify-between grow">
                          <div>
                            <span className="text-[8.5px] font-black text-black block mb-1 select-none uppercase leading-none">
                              PHILSYS ID NUMBER <span className="text-[7.5px] font-bold normal-case text-slate-805">(Optional)</span>
                            </span>
                            
                            <div className="flex items-center gap-0.5 mt-2.5 mb-1.5 font-sans">
                              {/* Group 1: 4 digits */}
                              <div className="flex border border-black bg-white divide-x divide-black h-[28px] select-none">
                                {Array.from({ length: 4 }).map((_, idx) => {
                                  const i = idx;
                                  const char = pmrfPhilsysNo[i] || '';
                                  return (
                                    <input
                                      key={i}
                                      id={`philsys-input-${i}`}
                                      type="text"
                                      maxLength={1}
                                      value={char}
                                      className="w-[15px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const chars = pmrfPhilsysNo.padEnd(12, ' ').split('');
                                        chars[i] = val.slice(-1);
                                        const newVal = chars.join('').replace(/\s+$/, '');
                                        setPmrfPhilsysNo(newVal);
                                        if (val && i < 11) {
                                          document.getElementById(`philsys-input-${i + 1}`)?.focus();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !char && i > 0) {
                                          const prevEl = document.getElementById(`philsys-input-${i - 1}`);
                                          if (prevEl) {
                                            prevEl.focus();
                                            const chars = pmrfPhilsysNo.split('');
                                            chars[i - 1] = '';
                                            setPmrfPhilsysNo(chars.join('').replace(/\s+$/, ''));
                                          }
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div className="w-[2px]"></div>

                              {/* Group 2: 4 digits */}
                              <div className="flex border border-black bg-white divide-x divide-black h-[28px] select-none">
                                {Array.from({ length: 4 }).map((_, idx) => {
                                  const i = idx + 4;
                                  const char = pmrfPhilsysNo[i] || '';
                                  return (
                                    <input
                                      key={i}
                                      id={`philsys-input-${i}`}
                                      type="text"
                                      maxLength={1}
                                      value={char}
                                      className="w-[15px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const chars = pmrfPhilsysNo.padEnd(12, ' ').split('');
                                        chars[i] = val.slice(-1);
                                        const newVal = chars.join('').replace(/\s+$/, '');
                                        setPmrfPhilsysNo(newVal);
                                        if (val && i < 11) {
                                          document.getElementById(`philsys-input-${i + 1}`)?.focus();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !char && i > 0) {
                                          const prevEl = document.getElementById(`philsys-input-${i - 1}`);
                                          if (prevEl) {
                                            prevEl.focus();
                                            const chars = pmrfPhilsysNo.split('');
                                            chars[i - 1] = '';
                                            setPmrfPhilsysNo(chars.join('').replace(/\s+$/, ''));
                                          }
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div className="w-[2px]"></div>

                              {/* Group 3: 4 digits */}
                              <div className="flex border border-black bg-white divide-x divide-black h-[28px] select-none">
                                {Array.from({ length: 4 }).map((_, idx) => {
                                  const i = idx + 8;
                                  const char = pmrfPhilsysNo[i] || '';
                                  return (
                                    <input
                                      key={i}
                                      id={`philsys-input-${i}`}
                                      type="text"
                                      maxLength={1}
                                      value={char}
                                      className="w-[15px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const chars = pmrfPhilsysNo.padEnd(12, ' ').split('');
                                        chars[i] = val.slice(-1);
                                        const newVal = chars.join('').replace(/\s+$/, '');
                                        setPmrfPhilsysNo(newVal);
                                        if (val && i < 11) {
                                          document.getElementById(`philsys-input-${i + 1}`)?.focus();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !char && i > 0) {
                                          const prevEl = document.getElementById(`philsys-input-${i - 1}`);
                                          if (prevEl) {
                                            prevEl.focus();
                                            const chars = pmrfPhilsysNo.split('');
                                            chars[i - 1] = '';
                                            setPmrfPhilsysNo(chars.join('').replace(/\s+$/, ''));
                                          }
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <span className="text-[6.5px] text-slate-400 block leading-none select-none">12-digit PhilSys Card Number</span>
                        </div>

                        {/* 2. TIN Box */}
                        <div className="p-3 flex flex-col justify-between grow">
                          <div>
                            <span className="text-[8.5px] font-black text-black block mb-1 select-none uppercase leading-none">
                              TAX PAYER IDENTIFICATION NUMBER (TIN) <span className="text-[7.5px] font-bold normal-case text-slate-805">(Optional)</span>
                            </span>
                            
                            <div className="flex items-center gap-0.5 mt-2.5 mb-1.5 font-sans">
                              {/* Group 1: 3 digits */}
                              <div className="flex border border-black bg-white divide-x divide-black h-[28px] select-none">
                                {Array.from({ length: 3 }).map((_, idx) => {
                                  const i = idx;
                                  const char = pmrfTin[i] || '';
                                  return (
                                    <input
                                      key={i}
                                      id={`tin-input-${i}`}
                                      type="text"
                                      maxLength={1}
                                      value={char}
                                      className="w-[15px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const chars = pmrfTin.padEnd(9, ' ').split('');
                                        chars[i] = val.slice(-1);
                                        const newVal = chars.join('').replace(/\s+$/, '');
                                        setPmrfTin(newVal);
                                        if (val && i < 8) {
                                          document.getElementById(`tin-input-${i + 1}`)?.focus();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !char && i > 0) {
                                          const prevEl = document.getElementById(`tin-input-${i - 1}`);
                                          if (prevEl) {
                                            prevEl.focus();
                                            const chars = pmrfTin.split('');
                                            chars[i - 1] = '';
                                            setPmrfTin(chars.join('').replace(/\s+$/, ''));
                                          }
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div className="w-[2px]"></div>

                              {/* Group 2: 3 digits */}
                              <div className="flex border border-black bg-white divide-x divide-black h-[28px] select-none">
                                {Array.from({ length: 3 }).map((_, idx) => {
                                  const i = idx + 3;
                                  const char = pmrfTin[i] || '';
                                  return (
                                    <input
                                      key={i}
                                      id={`tin-input-${i}`}
                                      type="text"
                                      maxLength={1}
                                      value={char}
                                      className="w-[15px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const chars = pmrfTin.padEnd(9, ' ').split('');
                                        chars[i] = val.slice(-1);
                                        const newVal = chars.join('').replace(/\s+$/, '');
                                        setPmrfTin(newVal);
                                        if (val && i < 8) {
                                          document.getElementById(`tin-input-${i + 1}`)?.focus();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !char && i > 0) {
                                          const prevEl = document.getElementById(`tin-input-${i - 1}`);
                                          if (prevEl) {
                                            prevEl.focus();
                                            const chars = pmrfTin.split('');
                                            chars[i - 1] = '';
                                            setPmrfTin(chars.join('').replace(/\s+$/, ''));
                                          }
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div className="w-[2px]"></div>

                              {/* Group 3: 3 digits */}
                              <div className="flex border border-black bg-white divide-x divide-black h-[28px] select-none">
                                {Array.from({ length: 3 }).map((_, idx) => {
                                  const i = idx + 6;
                                  const char = pmrfTin[i] || '';
                                  return (
                                    <input
                                      key={i}
                                      id={`tin-input-${i}`}
                                      type="text"
                                      maxLength={1}
                                      value={char}
                                      className="w-[15px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-100/60 text-black uppercase animate-none p-0 border-0 min-w-0"
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const chars = pmrfTin.padEnd(9, ' ').split('');
                                        chars[i] = val.slice(-1);
                                        const newVal = chars.join('').replace(/\s+$/, '');
                                        setPmrfTin(newVal);
                                        if (val && i < 8) {
                                          document.getElementById(`tin-input-${i + 1}`)?.focus();
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !char && i > 0) {
                                          const prevEl = document.getElementById(`tin-input-${i - 1}`);
                                          if (prevEl) {
                                            prevEl.focus();
                                            const chars = pmrfTin.split('');
                                            chars[i - 1] = '';
                                            setPmrfTin(chars.join('').replace(/\s+$/, ''));
                                          }
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <span className="text-[6.5px] text-slate-400 block leading-none select-none">Optional 9-digit Taxpayer ID</span>
                        </div>
                      </div>
                    </div>

                    {/* Section II Header */}
                    <div className="bg-[#dee5db] border-x border-b border-black text-black font-black px-4 py-2 text-[11px] tracking-widest block select-none text-center uppercase font-sans">
                      II. ADDRESS and CONTACT DETAILS
                    </div>

                    <div className="border-x border-b border-black p-2 bg-slate-50/50 space-y-3 font-sans text-black">
                      {/* Interactive Barangay, Purok, and Geotag Panel */}
                      <div className="bg-blue-50/55 p-2 rounded-md border border-blue-200 grid grid-cols-1 md:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[8px] font-black text-[#1a56db] uppercase leading-none select-none">BARANGAY SECTOR:</label>
                          <select 
                            value={formBarangay}
                            disabled={!hasRole(currentUser, 'ADMIN') && currentUser?.position !== 'Administrator' && !['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser?.email?.toLowerCase()) && !!currentUser?.address}
                            onChange={(e) => {
                              const newBarangay = e.target.value;
                              setFormBarangay(newBarangay);
                              setPmrfAddressBarangay(newBarangay.toUpperCase());
                              if (pmrfMailSame) {
                                setPmrfMailBarangay(newBarangay.toUpperCase());
                              }
                              const selectedBrg = barangayList.find(b => b.name === newBarangay);
                              const filteredPuroks = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === newBarangay);
                              if (filteredPuroks.length > 0) {
                                const newPurok = filteredPuroks[0].purokName || filteredPuroks[0].name;
                                setFormPurok(newPurok);
                                setPmrfAddressSubdivision(newPurok.toUpperCase());
                                if (pmrfMailSame) {
                                  setPmrfMailSubdivision(newPurok.toUpperCase());
                                }
                              } else {
                                setFormPurok('');
                                setPmrfAddressSubdivision('');
                                if (pmrfMailSame) {
                                  setPmrfMailSubdivision('');
                                }
                              }
                            }}
                            className="w-full bg-white disabled:bg-slate-100 disabled:cursor-not-allowed border border-slate-300 p-1 text-[9.5px] font-bold mt-1 outline-none text-black disabled:text-slate-600"
                          >
                            {currentUser?.address && !barangayList.some(bar => bar.name.toLowerCase() === currentUser.address.toLowerCase()) && (
                              <option value={currentUser.address}>{currentUser.address}</option>
                            )}
                            {barangayList.map(bar => (
                              <option key={bar.id} value={bar.name}>{bar.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[8px] font-black text-[#1a56db] uppercase leading-none select-none">PUROK / SITIO:</label>
                          <select 
                            value={formPurok}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormPurok(val);
                              setPmrfAddressSubdivision(val.toUpperCase());
                              if (pmrfMailSame) {
                                setPmrfMailSubdivision(val.toUpperCase());
                              }
                            }}
                            className="w-full bg-white border border-slate-300 p-1 text-[9.5px] font-bold mt-1 outline-none"
                          >
                            {addFormPuroks.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                            {addFormPuroks.length === 0 && (
                              <option value="">No Puroks Registered</option>
                            )}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[8px] font-black text-slate-600 uppercase leading-none select-none">GEOTAG COORDINATES (LATITUDE, LONGITUDE)</label>
                          <div className="flex flex-col sm:flex-row gap-1.5 mt-1 w-full">
                            <div className="flex gap-1.5 w-full sm:flex-1">
                              <input 
                                type="text" 
                                value={formLat} 
                                onChange={(e) => setFormLat(e.target.value)} 
                                placeholder="Lat"
                                className="w-1/2 bg-white border border-slate-300 p-1.5 text-center font-mono text-[10px] font-black outline-none rounded"
                              />
                              <input 
                                type="text" 
                                value={formLng} 
                                onChange={(e) => setFormLng(e.target.value)} 
                                placeholder="Lng"
                                className="w-1/2 bg-white border border-slate-300 p-1.5 text-center font-mono text-[10px] font-black outline-none rounded"
                              />
                            </div>
                            <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                              <button 
                                type="button" 
                                onClick={handleRandomCoordinates}
                                className="flex-1 sm:flex-initial px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] uppercase flex items-center justify-center gap-1 cursor-pointer transition-colors rounded"
                              >
                                📍 TAG
                              </button>
                              {formLat && formLng ? (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${formLat},${formLng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase flex items-center justify-center gap-1 cursor-pointer transition-colors rounded"
                                  title="Coordinate on Map"
                                >
                                  🗺️ MAP
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-200 text-slate-400 font-bold text-[9px] uppercase flex items-center justify-center gap-1 cursor-not-allowed rounded"
                                  title="Set coordinates to enable map view"
                                >
                                  🗺️ MAP
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* REDESIGNED ADDRESS AND CONTACT DETAILS TABLE GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-12 border border-black bg-white">
                        
                        {/* LEFT SIDE: PERMANENT & MAILING ADDRESSES (Col span 9) */}
                        <div className="md:col-span-9 flex flex-col divide-y divide-black md:border-r border-black font-sans">
                          
                          {/* Permanent Home Address Header + Unit/Block/Street Row */}
                          <div className="p-2.5 flex flex-col justify-between flex-1 bg-white min-h-[64px]">
                            <span className="font-extrabold text-[10.5px] tracking-tight text-black select-none uppercase">
                              PERMANENT HOME ADDRESS
                            </span>
                            
                            <div className="grid grid-cols-4 gap-3 mt-3">
                              {/* Unit/Room No./Floor */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfAddressUnitNoFloor}
                                  onChange={(e) => setPmrfAddressUnitNoFloor(e.target.value)}
                                  placeholder="e.g. Unit 3B"
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Unit/Room No./Floor
                                </span>
                              </div>
                              {/* Building Name */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfAddressBuildingName}
                                  onChange={(e) => setPmrfAddressBuildingName(e.target.value)}
                                  placeholder="e.g. SFC Bldg"
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Building Name
                                </span>
                              </div>
                              {/* Lot/Block/Phase/House Number */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfAddressUnit}
                                  onChange={(e) => setPmrfAddressUnit(e.target.value)}
                                  placeholder="e.g. Lot 15 Block 2"
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Lot/Block/Phase/House Number
                                </span>
                              </div>
                              {/* Street Name */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfAddressStreet}
                                  onChange={(e) => setPmrfAddressStreet(e.target.value.toUpperCase())}
                                  placeholder="e.g. Avocado St"
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Street Name
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Subdivision, Barangay, Municipality, Province, ZIP Code */}
                          <div className="flex-1 grid grid-cols-5 gap-3 p-2.5 bg-white min-h-[48px]">
                            {/* Subdivision */}
                            <div className="flex flex-col justify-end">
                              <select
                                value={pmrfAddressSubdivision}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPmrfAddressSubdivision(val);
                                  if (pmrfMailSame) {
                                    setPmrfMailSubdivision(val);
                                  }
                                  
                                  const matchingPurok = (puroks || []).find(p => (p.purokName || p.name || '').toUpperCase() === val.toUpperCase());
                                  const targetVal = matchingPurok ? (matchingPurok.purokName || matchingPurok.name) : val;
                                  if (targetVal !== formPurok) {
                                    setFormPurok(targetVal);
                                    if (editingHH) {
                                      setEditPurok(targetVal);
                                    }
                                  }
                                }}
                                className={`w-full bg-transparent border-b text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1 ${
                                  getPmrfValidationErrors().addressSubdivision ? 'border-rose-500 bg-rose-50' : 'border-black'
                                }`}
                              >
                                <option value="">-- SELECT PUROK --</option>
                                {puroks
                                  .filter(p => {
                                    const pBar = (p.barangay || '').trim().toLowerCase();
                                    const currentBar = (pmrfAddressBarangay || '').trim().toLowerCase();
                                    return pBar === currentBar;
                                  })
                                  .map(p => {
                                    const nameVal = (p.purokName || p.name || '').toUpperCase();
                                    return (
                                      <option key={p.id} value={nameVal}>
                                        {nameVal}
                                      </option>
                                    );
                                  })}
                                {pmrfAddressSubdivision && !puroks.some(p => (p.purokName || p.name || '').toUpperCase() === pmrfAddressSubdivision.toUpperCase()) && (
                                  <option value={pmrfAddressSubdivision.toUpperCase()}>
                                    {pmrfAddressSubdivision.toUpperCase()}
                                  </option>
                                )}
                              </select>
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Subdivision (Purok) <span className="text-rose-600 font-extrabold">*</span>
                              </span>
                              {getPmrfValidationErrors().addressSubdivision && (
                                <p className="text-rose-600 text-[6.5px] font-bold mt-0.5 leading-none uppercase">{getPmrfValidationErrors().addressSubdivision}</p>
                              )}
                            </div>
                            {/* Barangay */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfAddressBarangay}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setPmrfAddressBarangay(val);
                                  if (pmrfMailSame) {
                                    setPmrfMailBarangay(val);
                                  }
                                  
                                  const matchingBarangay = (barangayList || []).find(b => (b.name || '').toUpperCase() === val);
                                  const targetVal = matchingBarangay ? matchingBarangay.name : val;
                                  if (targetVal !== formBarangay) {
                                    setFormBarangay(targetVal);
                                    if (editingHH) {
                                      setEditBarangay(targetVal);
                                    }
                                  }
                                }}
                                placeholder="e.g. San Pedro"
                                className={`w-full bg-transparent border-b text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1 ${
                                  getPmrfValidationErrors().addressBarangay ? 'border-rose-500 bg-rose-50' : 'border-black'
                                }`}
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Barangay <span className="text-rose-600 font-extrabold">*</span>
                              </span>
                              {getPmrfValidationErrors().addressBarangay && (
                                <p className="text-rose-600 text-[6.5px] font-bold mt-0.5 leading-none uppercase">{getPmrfValidationErrors().addressBarangay}</p>
                              )}
                            </div>
                            {/* Municipality/City */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfAddressMunicipality}
                                onChange={(e) => setPmrfAddressMunicipality(e.target.value)}
                                placeholder="e.g. Pagadian City"
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Municipality/City
                              </span>
                            </div>
                            {/* Province/State/Country (If abroad) */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfAddressProvince}
                                onChange={(e) => setPmrfAddressProvince(e.target.value)}
                                placeholder="e.g. Zamboanga del Sur"
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Province/State/Country <span className="text-[5px] font-medium lowercase italic">(If abroad)</span>
                              </span>
                            </div>
                            {/* ZIP Code */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfAddressZip}
                                onChange={(e) => setPmrfAddressZip(e.target.value)}
                                placeholder="e.g. 7016"
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black outline-none text-center font-mono focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 text-center select-none">
                                ZIP Code
                              </span>
                            </div>
                          </div>

                          {/* MAILING ADDRESS Header (with same as above) */}
                          <div className="p-2.5 flex flex-col justify-between flex-1 bg-white min-h-[64px]">
                            <div className="flex items-center gap-3 select-none">
                              <span className="font-extrabold text-[10.5px] tracking-tight text-black select-none uppercase">
                                MAILING ADDRESS
                              </span>
                              <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-[8.5px] text-black">
                                <input 
                                  type="checkbox" 
                                  checked={pmrfMailSame} 
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setPmrfMailSame(checked);
                                    if (checked) {
                                      setPmrfMailUnitNoFloor(pmrfAddressUnitNoFloor);
                                      setPmrfMailBuildingName(pmrfAddressBuildingName);
                                      setPmrfMailUnit(pmrfAddressUnit);
                                      setPmrfMailStreet(pmrfAddressStreet);
                                      setPmrfMailSubdivision(pmrfAddressSubdivision);
                                      setPmrfMailBarangay(pmrfAddressBarangay);
                                      setPmrfMailMunicipality(pmrfAddressMunicipality);
                                      setPmrfMailProvince(pmrfAddressProvince);
                                      setPmrfMailZip(pmrfAddressZip);
                                    }
                                  }} 
                                  className="h-3.5 w-3.5 accent-black border border-black cursor-pointer align-middle"
                                />
                                <span className="uppercase tracking-tight cursor-pointer">SAME AS ABOVE</span>
                              </label>
                            </div>

                            <div className="grid grid-cols-4 gap-3 mt-3">
                              {/* Mailing Unit/Room No./Floor */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfMailSame ? pmrfAddressUnitNoFloor : pmrfMailUnitNoFloor}
                                  onChange={(e) => !pmrfMailSame && setPmrfMailUnitNoFloor(e.target.value)}
                                  disabled={pmrfMailSame}
                                  placeholder={pmrfMailSame ? (pmrfAddressUnitNoFloor || "Same") : "e.g. Unit 3B"}
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Unit/Room No./Floor
                                </span>
                              </div>
                              {/* Mailing Building Name */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfMailSame ? pmrfAddressBuildingName : pmrfMailBuildingName}
                                  onChange={(e) => !pmrfMailSame && setPmrfMailBuildingName(e.target.value)}
                                  disabled={pmrfMailSame}
                                  placeholder={pmrfMailSame ? (pmrfAddressBuildingName || "Same") : "e.g. SFC Bldg"}
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Building Name
                                </span>
                              </div>
                              {/* Mailing Lot/Block/Phase/House Number */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfMailSame ? pmrfAddressUnit : pmrfMailUnit}
                                  onChange={(e) => !pmrfMailSame && setPmrfMailUnit(e.target.value)}
                                  disabled={pmrfMailSame}
                                  placeholder={pmrfMailSame ? (pmrfAddressUnit || "Same") : "e.g. Lot 15 Block 2"}
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Lot/Block/Phase/House Number
                                </span>
                              </div>
                              {/* Mailing Street Name */}
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={pmrfMailSame ? pmrfAddressStreet : pmrfMailStreet}
                                  onChange={(e) => !pmrfMailSame && setPmrfMailStreet(e.target.value)}
                                  disabled={pmrfMailSame}
                                  placeholder={pmrfMailSame ? (pmrfAddressStreet || "Same") : "e.g. Avocado St"}
                                  className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                                />
                                <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                  Street Name
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Mailing Subdivision, Barangay, Municipality, Province, ZIP */}
                          <div className="flex-1 grid grid-cols-5 gap-3 p-2.5 bg-white min-h-[48px]">
                            {/* Mailing Subdivision */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfMailSame ? pmrfAddressSubdivision : pmrfMailSubdivision}
                                onChange={(e) => !pmrfMailSame && setPmrfMailSubdivision(e.target.value)}
                                disabled={pmrfMailSame}
                                placeholder={pmrfMailSame ? (pmrfAddressSubdivision || "Same") : "e.g. Phase 2"}
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Subdivision
                              </span>
                            </div>
                            {/* Mailing Barangay */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfMailSame ? pmrfAddressBarangay : pmrfMailBarangay}
                                onChange={(e) => !pmrfMailSame && setPmrfMailBarangay(e.target.value)}
                                disabled={pmrfMailSame}
                                placeholder={pmrfMailSame ? (pmrfAddressBarangay || "Same") : "e.g. San Pedro"}
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Barangay
                              </span>
                            </div>
                            {/* Mailing Municipality */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfMailSame ? pmrfAddressMunicipality : pmrfMailMunicipality}
                                onChange={(e) => !pmrfMailSame && setPmrfMailMunicipality(e.target.value)}
                                disabled={pmrfMailSame}
                                placeholder={pmrfMailSame ? (pmrfAddressMunicipality || "Same") : "e.g. Pagadian City"}
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Municipality/City
                              </span>
                            </div>
                            {/* Mailing Province */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfMailSame ? pmrfAddressProvince : pmrfMailProvince}
                                onChange={(e) => !pmrfMailSame && setPmrfMailProvince(e.target.value)}
                                disabled={pmrfMailSame}
                                placeholder={pmrfMailSame ? (pmrfAddressProvince || "Same") : "e.g. Zamboanga del Sur"}
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 select-none">
                                Province/State/Country <span className="text-[5px] font-medium lowercase italic">(If abroad)</span>
                              </span>
                            </div>
                            {/* Mailing ZIP */}
                            <div className="flex flex-col justify-end">
                              <input
                                type="text"
                                value={pmrfMailSame ? pmrfAddressZip : pmrfMailZip}
                                onChange={(e) => !pmrfMailSame && setPmrfMailZip(e.target.value)}
                                disabled={pmrfMailSame}
                                placeholder={pmrfMailSame ? "7016" : "e.g. 7016"}
                                className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black outline-none text-center font-mono disabled:text-slate-500 focus:bg-amber-50/60 h-6 px-1"
                              />
                              <span className="text-[7px] font-semibold text-slate-800 uppercase leading-snug mt-1 text-center select-none">
                                ZIP Code
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT SIDE: CONTACT NUMBERS & EMAIL ADDRESS (Col span 3) */}
                        <div className="md:col-span-3 flex flex-col divide-y divide-black font-sans bg-white">
                          {/* Home Phone Number */}
                          <div className="p-1.5 flex flex-col justify-between flex-1 min-h-[64px] bg-white text-black font-sans">
                            <div className="flex flex-col justify-start">
                              <span className="text-[8.5px] font-black uppercase text-black select-none leading-none">
                                Home Phone Number
                              </span>
                              <input 
                                type="text" 
                                value={pmrfHomePhone} 
                                onChange={(e) => setPmrfHomePhone(e.target.value)} 
                                placeholder="e.g. +63 2 8888 8888"
                                className="w-full h-[22px] bg-white border border-black px-1.5 text-[9.5px] font-bold text-black outline-none font-mono focus:bg-amber-50/50 block mt-1"
                              />
                            </div>
                            <span className="text-[5.5px] font-bold text-slate-800 leading-none select-none tracking-tight block uppercase">
                              (COUNTRY CODE + AREA CODE + TELEPHONE NUMBER)
                            </span>
                          </div>

                          {/* Mobile Number */}
                          <div className="p-1.5 bg-white flex flex-col justify-start flex-1 min-h-[48px] text-black font-sans">
                            <div className="flex flex-col justify-start w-full">
                              <span className="text-[8.5px] font-black uppercase text-black select-none leading-none">
                                Mobile Number <span className="text-rose-700 text-[7.5px] font-semibold">(Required)</span>
                              </span>
                              <input 
                                type="text" 
                                value={pmrfMobileNo} 
                                onChange={(e) => setPmrfMobileNo(e.target.value)} 
                                placeholder="e.g. 0917 123 4567"
                                required
                                className="w-full h-[22px] bg-white border border-black px-1.5 text-[9.5px] font-bold text-black outline-none font-mono focus:bg-amber-50/50 block mt-1"
                              />
                            </div>
                          </div>

                          {/* Business Direct Line */}
                          <div className="p-1.5 bg-white flex flex-col justify-start flex-1 min-h-[64px] text-black font-sans">
                            <div className="flex flex-col justify-start w-full">
                              <span className="text-[8.5px] font-black uppercase text-black select-none leading-none">
                                Business (Direct Line)
                              </span>
                              <input 
                                type="text" 
                                value={pmrfBusinessDirect} 
                                onChange={(e) => setPmrfBusinessDirect(e.target.value)} 
                                placeholder="e.g. +63 2 9999 9999"
                                className="w-full h-[22px] bg-white border border-black px-1.5 text-[9.5px] font-bold text-black outline-none font-mono focus:bg-amber-50/50 block mt-1"
                              />
                            </div>
                          </div>

                          {/* E-mail Address */}
                          <div className="p-1.5 bg-white flex flex-col justify-start flex-1 min-h-[48px] text-black font-sans">
                            <div className="flex flex-col justify-start w-full">
                              <span className="text-[8.5px] font-black uppercase text-black select-none leading-none">
                                E-mail Address <span className="text-[7.5px] font-bold text-slate-700 select-none lowercase italic">(Required for OFW)</span>
                              </span>
                              <input 
                                type="email" 
                                value={pmrfEmail} 
                                onChange={(e) => setPmrfEmail(e.target.value)} 
                                placeholder="e.g. name@domain.com"
                                className="w-full h-[22px] bg-white border border-black px-1.5 text-[9.5px] font-bold text-black outline-none focus:bg-amber-50/50 block mt-1"
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                {/* III. DECLARATION OF DEPENDENTS */}
                <div className="bg-[#dee5db] border-x border-b border-black text-black font-extrabold px-3 py-1.5 text-[9.5px] tracking-wide flex justify-between items-center select-none">
                  <div className="flex-1 text-center font-extrabold uppercase">III. DECLARATION OF DEPENDENTS</div>
                  <div className="text-[7.5px] font-normal lowercase italic text-slate-800 pr-1">(Use additional form if necessary)</div>
                </div>

                <div className="border-x border-b border-black p-2 bg-white space-y-3 font-sans text-black">
                  <span className="block text-[8.5px] text-slate-600 font-bold select-none leading-tight">
                    Add direct family dependents below (spouse, children below 21, or parents over 60) to register them automatically under this household:
                  </span>

                  {/* Queued Dependents table list & live inputs */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[8px] font-sans border border-black bg-white">
                      <thead>
                        <tr className="bg-slate-100 border-b border-black font-black text-center text-black select-none">
                          <th className="border-r border-black p-1 text-left w-[13%]">LAST NAME</th>
                          <th className="border-r border-black p-1 text-left w-[13%]">FIRST NAME</th>
                          <th className="border-r border-black p-1 text-center w-[5%]">NAME EXT</th>
                          <th className="border-r border-black p-1 text-left w-[12%]">MIDDLE NAME</th>
                          <th className="border-r border-black p-1 text-left w-[10%]">RELATIONSHIP</th>
                          <th className="border-r border-black p-1 text-center w-[13%] font-semibold">DATE OF BIRTH</th>
                          <th className="border-r border-black p-1 text-left w-[8%]">SEX</th>
                          <th className="border-r border-black p-1 text-left w-[9%]">CITIZENSHIP</th>
                          <th className="border-r border-black p-1 text-center w-[4%] truncate" title="No Middle Name">NO MN</th>
                          <th className="border-r border-black p-1 text-center w-[4%] truncate">MONONYM</th>
                          <th className="border-r border-black p-1 text-center w-[4%] truncate" title="Check if Person with Disability">PSWD</th>
                          <th className="p-1 text-center w-[5%]">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black font-bold text-black">
                        {/* Saved / queue dependents */}
                        {wizardDependents.map((dep, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/20 text-center text-[8px]">
                            <td className="border-r border-black p-1 text-left uppercase">
                              {dep.lastName || dep.fullName?.split(',')[0]?.trim()}
                            </td>
                            <td className="border-r border-black p-1 text-left uppercase">
                              {dep.firstName || dep.fullName?.split(',')[1]?.split(' ')[0]?.trim()}
                            </td>
                            <td className="border-r border-black p-1 text-center uppercase">
                              {dep.nameExt || ''}
                            </td>
                            <td className="border-r border-black p-1 text-left uppercase">
                              {dep.middleName || ''}
                            </td>
                            <td className="border-r border-black p-1 text-left uppercase">
                              {dep.relationship || 'CHILD'}
                            </td>
                            <td className="border-r border-black p-1 text-center font-mono">
                              {dep.birthDate || dep.birthdate || 'N/A'}
                            </td>
                            <td className="border-r border-black p-1 text-center font-mono uppercase">
                              {dep.gender || 'FEMALE'}
                            </td>
                            <td className="border-r border-black p-1 text-left uppercase">
                              {dep.citizenship || 'FILIPINO'}
                            </td>
                            <td className="border-r border-black p-1 text-center">
                              <input type="checkbox" checked={!!dep.noMiddleName} disabled className="h-3 w-3 accent-blue-600" />
                            </td>
                            <td className="border-r border-black p-1 text-center">
                              <input type="checkbox" checked={!!dep.mononym} disabled className="h-3 w-3 accent-blue-600" />
                            </td>
                            <td className="border-r border-black p-1 text-center">
                              <input type="checkbox" checked={!!dep.isDisabled} disabled className="h-3 w-3 accent-blue-600" />
                            </td>
                            <td className="p-1 text-center">
                              <button 
                                type="button"
                                onClick={() => setWizardDependents(wizardDependents.filter((_, dIdx) => dIdx !== idx))}
                                className="text-[#b91c1c] font-bold text-[8px] hover:underline cursor-pointer uppercase"
                              >
                                remove
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Interactive row at the end with inline textboxes and a primary '+' button as requested */}
                        <tr className="bg-amber-50/10">
                          <td className="border-r border-black p-1">
                            <input 
                              type="text" 
                              placeholder="Last name"
                              value={depLastName}
                              onChange={(e) => setDepLastName(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8.5px] uppercase font-bold outline-none text-black"
                            />
                          </td>
                          <td className="border-r border-black p-1">
                            <input 
                              type="text" 
                              placeholder="First name"
                              value={depFirstName}
                              onChange={(e) => setDepFirstName(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8.5px] uppercase font-bold outline-none text-black"
                            />
                          </td>
                          <td className="border-r border-black p-1">
                            <input 
                              type="text" 
                              placeholder="Jr/Sr"
                              value={depNameExt}
                              onChange={(e) => setDepNameExt(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8.5px] uppercase font-bold text-center outline-none text-black"
                            />
                          </td>
                          <td className="border-r border-black p-1">
                            <input 
                              type="text" 
                              placeholder="Middle"
                              value={depMiddleName}
                              disabled={depNoMN || depMononym}
                              onChange={(e) => setDepMiddleName(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8.5px] uppercase font-bold outline-none text-black disabled:bg-slate-100"
                            />
                          </td>
                          <td className="border-r border-black p-1">
                            <select 
                              value={depRelation}
                              onChange={(e) => setDepRelation(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8px] uppercase font-bold outline-none text-black h-[18px]"
                            >
                              <option value="SPOUSE">SPOUSE</option>
                              <option value="CHILD">CHILD</option>
                              <option value="PARENT">PARENT</option>
                              <option value="SIBLING">SIBLING</option>
                              <option value="RELATIVE">OTHER RELATIVE</option>
                            </select>
                          </td>
                          <td className="border-r border-black p-1">
                            <input 
                              type="date" 
                              value={depBirthDate}
                              onChange={(e) => setDepBirthDate(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8px] font-mono outline-none text-black h-[18px]"
                            />
                          </td>
                          <td className="border-r border-black p-1">
                            <select 
                              value={depSex}
                              onChange={(e) => setDepSex(e.target.value as any)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8px] uppercase font-bold outline-none text-black h-[18px]"
                            >
                              <option value="Female">FEMALE</option>
                              <option value="Male">MALE</option>
                            </select>
                          </td>
                          <td className="border-r border-black p-1">
                            <select 
                              value={depCitizenship}
                              onChange={(e) => setDepCitizenship(e.target.value)}
                              className="w-full bg-white border border-slate-300 p-0.5 text-[8px] uppercase font-bold outline-none text-black h-[18px]"
                            >
                              <option value="FILIPINO">FILIPINO</option>
                              <option value="DUAL CITIZEN">DUAL CITIZEN</option>
                              <option value="FOREIGN NATIONAL">FOREIGN NATIONAL</option>
                            </select>
                          </td>
                          <td className="border-r border-black p-0.5 text-center">
                            <input 
                              type="checkbox" 
                              checked={depNoMN}
                              onChange={(e) => {
                                  setDepNoMN(e.target.checked);
                                  if (e.target.checked) setDepMiddleName('');
                              }}
                              className="h-3 w-3 accent-blue-600 cursor-pointer mx-auto block"
                            />
                          </td>
                          <td className="border-r border-black p-0.5 text-center">
                            <input 
                              type="checkbox" 
                              checked={depMononym}
                              onChange={(e) => {
                                  setDepMononym(e.target.checked);
                                  if (e.target.checked) {
                                    setDepMiddleName('');
                                    setDepNoMN(true);
                                  }
                              }}
                              className="h-3 w-3 accent-blue-600 cursor-pointer mx-auto block"
                            />
                          </td>
                          <td className="border-r border-black p-0.5 text-center">
                            <input 
                              type="checkbox" 
                              checked={depIsDisabled}
                              onChange={(e) => setDepIsDisabled(e.target.checked)}
                              className="h-3 w-3 accent-blue-600 cursor-pointer mx-auto block"
                            />
                          </td>
                          <td className="p-0.5 text-center">
                            <button 
                              type="button"
                              onClick={handleAddDependentToWizard}
                              className="w-full bg-green-700 hover:bg-green-800 text-white font-black py-0.5 px-1.5 rounded text-[11px] hover:shadow-sm cursor-pointer block select-none h-[18px] text-center uppercase"
                              title="Add Dependent"
                            >
                              ＋
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* IV. MEMBER TYPE */}
                {(() => {
                  const renderOption = (value: string, category: 'DIRECT' | 'INDIRECT', labelText: string, extraContent?: React.ReactNode, isSubOption = false) => {
                    const isSelected = pmrfContributorType === value && pmrfContributorCategory === category;
                    const handleSelect = () => {
                      setPmrfContributorCategory(category);
                      setPmrfContributorType(value);
                    };
                    return (
                      <div className={`flex flex-col ${isSubOption ? 'pl-4' : ''}`}>
                        <div className="flex items-start gap-1.5 cursor-pointer" onClick={handleSelect}>
                          <div className="w-3.5 h-3.5 border border-black flex items-center justify-center bg-white mt-0.5 shrink-0 select-none">
                            {isSelected && (
                              <div className="w-2 h-2 bg-black animate-none" />
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-black leading-tight uppercase font-sans select-none tracking-tight">
                            {labelText}
                          </span>
                        </div>
                        {extraContent}
                      </div>
                    );
                  };

                  return (
                    <div className="font-sans">
                      <div className="bg-[#dee5db] border-x border-b border-black text-black font-black px-4 py-2 text-[11px] tracking-widest block select-none text-center uppercase font-sans">
                        IV. MEMBER TYPE
                      </div>

                      <div className="border-x border-b border-black bg-white text-black">
                        {/* Redesigned Grid split into 2 Columns (Direct 8 vs Indirect 4) */}
                        <div className="grid grid-cols-1 md:grid-cols-12 md:divide-x divide-black bg-white">
                          
                          {/* DIRECT CONTRIBUTOR (Left column, col span 8) */}
                          <div className="md:col-span-8 flex flex-col divide-y divide-black font-sans bg-white">
                            <div className="text-center font-black text-[11px] tracking-widest border-b border-black py-1.5 uppercase bg-white text-black">
                              DIRECT CONTRIBUTOR
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-3 bg-white">
                              {/* Track 1: Col-span 5 */}
                              <div className="md:col-span-5 flex flex-col gap-3">
                                {renderOption('Employed Private', 'DIRECT', 'Employed Private')}
                                {renderOption('Employed Government', 'DIRECT', 'Employed Government')}
                                {renderOption('Registered Practitioner', 'DIRECT', 'Professional Practitioner')}
                                {renderOption('Self-Earning Individual', 'DIRECT', 'Self-Earning Individual')}
                                
                                {/* Indented options under Self-Earning Individual */}
                                <div className="pl-4 flex flex-col gap-2.5">
                                  {renderOption('Individual', 'DIRECT', 'Individual')}
                                  {renderOption('Sole Proprietor', 'DIRECT', 'Sole Proprietor')}
                                  
                                  <div className="flex flex-col gap-1">
                                    {renderOption('Group Enrollment Scheme', 'DIRECT', 'Group Enrollment Scheme')}
                                    <div className="pl-5 flex items-center h-5">
                                      <input 
                                        type="text" 
                                        value={pmrfGroupSchemeName}
                                        onChange={(e) => setPmrfGroupSchemeName(e.target.value)}
                                        disabled={pmrfContributorType !== 'Group Enrollment Scheme'}
                                        placeholder="Specify group scheme name..."
                                        className="w-full bg-transparent border-0 border-b border-black text-[9.5px] font-bold p-0 mb-0.5 px-1 outline-none uppercase font-sans h-4 focus:bg-amber-50/50 disabled:border-slate-300 disabled:text-slate-400 text-black placeholder:italic placeholder:font-normal" 
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Track 2: Col-span 4 */}
                              <div className="md:col-span-4 flex flex-col gap-3">
                                {renderOption('Kasambahay', 'DIRECT', 'Kasambahay')}
                                {renderOption('Migrant Worker', 'DIRECT', 'Migrant Worker')}
                                
                                {/* Indented sub-option Land-Based */}
                                <div className="pl-4">
                                  {renderOption('Land-Based', 'DIRECT', 'Land-Based')}
                                </div>

                                {renderOption('Lifetime Member', 'DIRECT', 'Lifetime Member')}
                                {renderOption('Filipinos with Dual Citizenship / Living Abroad', 'DIRECT', 'Filipinos with Dual Citizenship / Living Abroad')}
                                
                                {/* Foreign National info */}
                                <div className="flex flex-col gap-1.5">
                                  {renderOption('Foreign National', 'DIRECT', 'Foreign National')}
                                  <div className="pl-5 flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 h-4">
                                      <span className="text-[7.5px] font-bold text-black uppercase whitespace-nowrap">PRA SRRV No.</span>
                                      <input 
                                        type="text" 
                                        value={pmrfPraSrrvNo}
                                        onChange={(e) => setPmrfPraSrrvNo(e.target.value)}
                                        disabled={pmrfContributorType !== 'Foreign National'}
                                        placeholder="Enter No."
                                        className="flex-1 bg-transparent border-0 border-b border-black text-[9px] font-mono font-bold p-0 mb-0.5 px-0 outline-none uppercase h-4 focus:bg-amber-50/50 disabled:border-slate-300 disabled:text-slate-400 text-black placeholder:font-sans placeholder:font-normal" 
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5 h-4">
                                      <span className="text-[7.5px] font-bold text-black uppercase whitespace-nowrap">ACR I-Card No.</span>
                                      <input 
                                        type="text" 
                                        value={pmrfAcrICardNo}
                                        onChange={(e) => setPmrfAcrICardNo(e.target.value)}
                                        disabled={pmrfContributorType !== 'Foreign National'}
                                        placeholder="Enter No."
                                        className="flex-1 bg-transparent border-0 border-b border-black text-[9px] font-mono font-bold p-0 mb-0.5 px-0 outline-none uppercase h-4 focus:bg-amber-50/50 disabled:border-slate-300 disabled:text-slate-400 text-black placeholder:font-sans placeholder:font-normal" 
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Track 3: Col-span 3 */}
                              <div className="md:col-span-3 flex flex-col justify-between h-full min-h-[160px]">
                                <div className="flex flex-col gap-3">
                                  {renderOption('Family Driver', 'DIRECT', 'Family Driver')}
                                </div>
                                <div className="mb-2">
                                  {renderOption('Sea-Based', 'DIRECT', 'Sea-Based')}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* INDIRECT CONTRIBUTOR (Right column, col span 4) */}
                          <div className="md:col-span-4 flex flex-col divide-y divide-black font-sans bg-white h-full justify-between">
                            <div className="text-center font-black text-[11px] tracking-widest border-b border-black py-1.5 uppercase bg-white text-black">
                              INDIRECT CONTRIBUTOR
                            </div>

                            {/* Main choices */}
                            <div className="grid grid-cols-2 gap-4 p-3 bg-white flex-grow">
                              <div className="flex flex-col gap-3">
                                {renderOption('Listahanan', 'INDIRECT', 'Listahanan')}
                                {renderOption('4Ps Program MCCT', 'INDIRECT', '4Ps/MCCT')}
                                {renderOption('Senior Citizen', 'INDIRECT', 'Senior Citizen')}
                                {renderOption('PAMANA beneficiary', 'INDIRECT', 'PAMANA')}
                                {renderOption('KIA/KIPO', 'INDIRECT', 'KIA/KIPO')}
                                {renderOption('Bangsamoro/Normalization', 'INDIRECT', 'Bangsamoro/Normalization')}
                              </div>
                              <div className="flex flex-col gap-3">
                                {renderOption('Sponsored LGU', 'INDIRECT', 'LGU-sponsored')}
                                {renderOption('NGA-sponsored', 'INDIRECT', 'NGA-sponsored')}
                                {renderOption('Private-sponsored', 'INDIRECT', 'Private-sponsored')}
                                <div className="flex flex-col gap-1">
                                  {renderOption('Person with Disability (PWD)', 'INDIRECT', 'Person with Disability')}
                                  <div className="pl-5 flex flex-col mt-0.5">
                                    <span className="text-[7.5px] font-bold text-black uppercase">PWD ID No.</span>
                                    <input 
                                      type="text" 
                                      value={pmrfPwdIdNo}
                                      onChange={(e) => setPmrfPwdIdNo(e.target.value)}
                                      disabled={pmrfContributorType !== 'Person with Disability (PWD)'}
                                      placeholder="Enter ID No."
                                      className="w-full bg-transparent border-0 border-b border-black text-[9px] font-mono font-bold p-0 mb-0.5 px-0 outline-none uppercase h-4 focus:bg-amber-50/50 disabled:border-slate-300 disabled:text-slate-400 text-black placeholder:font-sans placeholder:font-normal" 
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* PhilHealth Use only */}
                            <div className="p-3 border-t border-black bg-white flex flex-col gap-2 mt-auto">
                              <div className="font-extrabold text-[10px] tracking-tight text-black select-none uppercase">
                                For PhilHealth Use only:
                              </div>
                              <div className="flex flex-col gap-2">
                                {renderOption('Point of Service (POS) Financially Incapable', 'INDIRECT', 'Point of Service (POS) Financially Incapable')}
                                {renderOption('Financially Incapable', 'INDIRECT', 'Financially Incapable')}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Bottom Row: Profession, Income and Proof */}
                        <div className="grid grid-cols-1 md:grid-cols-12 border-t border-black bg-white uppercase font-sans text-black divide-y md:divide-y-0 md:divide-x divide-black">
                          <div className="md:col-span-5 p-2 flex flex-col justify-between min-h-[55px]">
                            <div className="leading-tight">
                              <span className="font-extrabold text-[9.5px]">PROFESSION:</span>{' '}
                              <span className="text-[7px] font-semibold text-slate-800 lowercase italic leading-none block md:inline font-sans normal-case">
                                (Except Employed, Lifetime Members and Sea-based Migrant Worker)
                              </span>
                            </div>
                            <input 
                              type="text" 
                              value={pmrfProfession} 
                              onChange={(e) => setPmrfProfession(e.target.value)} 
                              placeholder="e.g. Farmer / Housewife"
                              className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black uppercase outline-none focus:bg-amber-50/50 h-5 px-1 pb-0.5 mt-1"
                            />
                          </div>

                          <div className="md:col-span-3 p-2 flex flex-col justify-between min-h-[55px]">
                            <span className="font-extrabold text-[9.5px]">MONTHLY INCOME:</span>
                            <input 
                              type="text" 
                              value={pmrfMonthlyIncome} 
                              onChange={(e) => setPmrfMonthlyIncome(e.target.value)} 
                              placeholder="e.g. 15000"
                              className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black outline-none focus:bg-amber-50/50 h-5 px-1 pb-0.5 mt-1 font-mono"
                            />
                          </div>

                          <div className="md:col-span-4 p-2 flex flex-col justify-between min-h-[55px]">
                            <span className="font-extrabold text-[9.5px]">PROOF OF INCOME:</span>
                            <input 
                              type="text" 
                              value={pmrfProofOfIncome} 
                              onChange={(e) => setPmrfProofOfIncome(e.target.value)} 
                              placeholder="e.g. Certificate of Indigency / Payslip"
                              className="w-full bg-transparent border-b border-black text-[10px] font-bold text-black outline-none focus:bg-amber-50/50 h-5 px-1 pb-0.5 mt-1"
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}

                <div className="border-x border-b border-black p-2 bg-slate-50/50 space-y-3 font-sans text-black">
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label className="block text-[8.5px] font-bold text-black uppercase leading-none">PMRF Status Consent</label>
                      <select 
                        value={formPmrf} 
                        onChange={(e) => setFormPmrf(e.target.value as any)}
                        className="block w-full bg-white border border-black p-1 text-xs mt-1 outline-none font-semibold text-black"
                      >
                        <option value="Willing">Willing to Enroll</option>
                        <option value="Not Willing">Not Willing to Enroll</option>
                        <option value="Pending">Pending Evaluation Consent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[8.5px] font-bold text-black uppercase leading-none">SFC Enrollment STATUS</label>
                      <select 
                        value={formYakap} 
                        onChange={(e) => setFormYakap(e.target.value as any)}
                        className="block w-full bg-white border border-black p-1 text-xs mt-1 outline-none font-semibold text-[#1a56db]"
                      >
                        <option value="Willing">Willing to Participate</option>
                        <option value="Not Willing">Not Willing to Participate</option>
                        <option value="Pending">Pending Decision</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

                  {pmrfSubTab === 'BACK' && (
                    <div className="w-full overflow-x-auto pb-4">
                        <div className="bg-white border-2 border-slate-400 p-4 md:p-6 shadow-sm rounded-lg space-y-4 font-sans text-xs min-w-[750px] relative">
                  
                  {/* Title Header */}
                  <div className="border border-slate-900 bg-slate-150 p-2.5 text-center relative rounded">
                    <h3 className="font-extrabold text-sm text-[#111827] uppercase tracking-wide">V. UPDATING / AMENDMENT</h3>
                    <p className="text-[9px] text-slate-500 font-semibold leading-none mt-1">Check appropriate box and provide complete updated details below</p>
                  </div>

                  {/* Table Grid details */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-2 border-slate-900 border-collapse text-[10px] uppercase text-slate-800">
                      <thead>
                        <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                          <th className="border border-slate-900 px-3 py-1.5 text-left w-1/2">Please check indicating updates:</th>
                          <th className="border border-slate-900 px-3 py-1.5 text-center w-1/4">FROM</th>
                          <th className="border border-slate-900 px-3 py-1.5 text-center w-1/4">TO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Name Change Row */}
                        <tr className="border-b border-slate-900">
                          <td className="border border-slate-900 p-2 text-left">
                            <label className="flex items-start gap-2.5 font-bold cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={pmrfBackChangeName}
                                onChange={(e) => setPmrfBackChangeName(e.target.checked)}
                                className="h-4 w-4 text-blue-600 mt-0.5 accent-blue-600 cursor-pointer shrink-0"
                              />
                              <div>
                                <span>Change / Correction of Name</span>
                                <span className="block text-[8px] text-slate-400 capitalize italic leading-tight">(Last name, First name, Name extension, Middle name)</span>
                              </div>
                            </label>
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeName}
                              value={pmrfBackFromValueName}
                              onChange={(e) => setPmrfBackFromValueName(e.target.value)}
                              placeholder="Incorrect Name Record"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeName}
                              value={pmrfBackToValueName}
                              onChange={(e) => setPmrfBackToValueName(e.target.value)}
                              placeholder="Correct Name Record"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                        </tr>

                        {/* BirthDate Row */}
                        <tr className="border-b border-slate-900">
                          <td className="border border-slate-900 p-2 text-left">
                            <label className="flex items-center gap-2.5 font-bold cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={pmrfBackChangeDOB}
                                onChange={(e) => setPmrfBackChangeDOB(e.target.checked)}
                                className="h-4 w-4 text-blue-600 accent-blue-600 cursor-pointer shrink-0"
                              />
                              <span>Correction of Date of Birth</span>
                            </label>
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeDOB}
                              value={pmrfBackFromValueDOB}
                              onChange={(e) => setPmrfBackFromValueDOB(e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeDOB}
                              value={pmrfBackToValueDOB}
                              onChange={(e) => setPmrfBackToValueDOB(e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                        </tr>

                        {/* Sex Row */}
                        <tr className="border-b border-slate-900">
                          <td className="border border-slate-900 p-2 text-left">
                            <label className="flex items-center gap-2.5 font-bold cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={pmrfBackChangeSex}
                                onChange={(e) => setPmrfBackChangeSex(e.target.checked)}
                                className="h-4 w-4 text-blue-600 accent-blue-600 cursor-pointer shrink-0"
                              />
                              <span>Correction of Sex</span>
                            </label>
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeSex}
                              value={pmrfBackFromValueSex}
                              onChange={(e) => setPmrfBackFromValueSex(e.target.value)}
                              placeholder="Incorrect Sex"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeSex}
                              value={pmrfBackToValueSex}
                              onChange={(e) => setPmrfBackToValueSex(e.target.value)}
                              placeholder="Correct Sex"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                        </tr>

                        {/* Civil Status Row */}
                        <tr className="border-b border-slate-900">
                          <td className="border border-slate-900 p-2 text-left">
                            <label className="flex items-center gap-2.5 font-bold cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={pmrfBackChangeCivilStatus}
                                onChange={(e) => setPmrfBackChangeCivilStatus(e.target.checked)}
                                className="h-4 w-4 text-blue-600 accent-blue-600 cursor-pointer shrink-0"
                              />
                              <span>Change of Civil Status</span>
                            </label>
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeCivilStatus}
                              value={pmrfBackFromValueCivil}
                              onChange={(e) => setPmrfBackFromValueCivil(e.target.value)}
                              placeholder="Previous Status"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangeCivilStatus}
                              value={pmrfBackToValueCivil}
                              onChange={(e) => setPmrfBackToValueCivil(e.target.value)}
                              placeholder="New Civil Status"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                        </tr>

                        {/* Personal info / address / contact Row */}
                        <tr className="border-b border-slate-900">
                          <td className="border border-slate-900 p-2 text-left">
                            <label className="flex items-start gap-2.5 font-bold cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={pmrfBackChangePersonalInfo}
                                onChange={(e) => setPmrfBackChangePersonalInfo(e.target.checked)}
                                className="h-4 w-4 text-blue-600 mt-0.5 accent-blue-600 cursor-pointer shrink-0"
                              />
                              <div>
                                <span>Updating of Personal Information</span>
                                <span className="block text-[8px] text-slate-400 capitalize italic leading-tight">(Address, Telephone, Mobile, Email address)</span>
                              </div>
                            </label>
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangePersonalInfo}
                              value={pmrfBackFromValueInfo}
                              onChange={(e) => setPmrfBackFromValueInfo(e.target.value)}
                              placeholder="Previous Information"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                          <td className="border border-slate-900 p-1.5 align-middle">
                            <input 
                              type="text"
                              disabled={!pmrfBackChangePersonalInfo}
                              value={pmrfBackToValueInfo}
                              onChange={(e) => setPmrfBackToValueInfo(e.target.value)}
                              placeholder="Correct Information"
                              className="w-full border border-slate-350 p-1 rounded text-[10px] font-semibold text-center uppercase font-mono bg-blue-50/5 focus:bg-white disabled:opacity-40"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Sworn Declaration paragraph */}
                  <div className="border border-slate-800 p-3 bg-amber-50/10 rounded space-y-2">
                    <p className="text-[9.5px] font-serif text-slate-700 font-semibold leading-relaxed text-justify">
                      Under penalty of law, I hereby attest that the information provided, including the documents I have attached to this form, are true and accurate to the best of my knowledge. I agree and authorize PhilHealth for the subsequent validation, verification and for other data sharing purposes only under the following circumstances: 
                    </p>
                    <ul className="list-disc list-inside text-[9.5px] font-serif text-slate-600 font-semibold space-y-1 pl-1">
                      <li>As necessary for the proper execution of processes related to the legitimate and declared purpose;</li>
                      <li>The use or disclosure is reasonably necessary, required or authorized by or under the law; and,</li>
                      <li>Adequate security measures are employed to protect my information.</li>
                    </ul>
                  </div>

                  {/* Signatures and Thumbmarks double border Box */}
                  <div className="border border-slate-900 divide-y md:divide-y-0 md:divide-x divide-slate-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 bg-slate-50/50 rounded">
                    
                    {/* Col 1: Signature Block */}
                    <div className="p-3 flex flex-col justify-between h-44 relative bg-white">
                      <div>
                        <span className="text-[9px] font-extrabold text-[#111827] uppercase tracking-wider block">Representative Signature</span>
                        <label className="flex items-center gap-1.5 mt-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={pmrfBackSameAsFront}
                            onChange={(e) => setPmrfBackSameAsFront(e.target.checked)}
                            className="h-3.5 w-3.5 text-blue-600 accent-blue-600"
                          />
                          <span className="text-[8.5px] text-slate-500 font-extrabold tracking-tight lowercase first-letter:uppercase">sync front signature</span>
                        </label>
                      </div>

                      <div className="border-b border-slate-700 w-full h-16 relative flex items-center justify-center">
                        {pmrfBackSameAsFront ? (
                          patientSignature ? (
                            <img src={patientSignature} className="max-h-16 w-auto object-contain" alt="Drawn representative signature" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-[8px] text-slate-450 font-semibold uppercase text-center leading-none">Awaiting main patient signature...</span>
                          )
                        ) : (
                          pmrfBackSignature ? (
                            <div className="relative group">
                              <img src={pmrfBackSignature} className="max-h-16 w-auto object-contain" alt="Drawn specific back signature" referrerPolicy="no-referrer" />
                              <button 
                                type="button"
                                onClick={() => setPmrfBackSignature(null)}
                                className="absolute -top-1 -right-4 text-red-500 hover:text-red-700 font-black text-xs"
                                title="Clear Specific Signature"
                              >✕</button>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <SignaturePad 
                                onChange={(sig) => setPmrfBackSignature(sig)} 
                              />
                            </div>
                          )
                        )}
                      </div>
                      
                      <div className="text-center pt-1.5 border-t border-slate-200 mt-1">
                        <span className="text-[8px] font-extrabold text-slate-650 uppercase block">signature over printed name</span>
                        
                        <div className="flex justify-between items-center mt-1 text-[8px] font-mono text-slate-450">
                          <span>DATE:</span>
                          <input 
                            type="date"
                            value={pmrfBackSignatureDate}
                            onChange={(e) => setPmrfBackSignatureDate(e.target.value)}
                            className="bg-transparent text-slate-700 font-bold border-0 outline-none p-0 text-[8.5px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Thumbmark Block */}
                    <div className="p-3 flex flex-col justify-between h-44 items-center bg-white text-center">
                      <span className="text-[9px] font-extrabold text-[#111827] uppercase tracking-wider block w-full text-left">Right Thumbmark Box</span>
                      
                      <div className="h-20 w-16 border border-slate-350 border-dashed rounded flex flex-col items-center justify-center relative bg-slate-50 overflow-hidden">
                        {pmrfBackSameAsFront ? (
                          patientSignature && patientSignature.includes("thumb") ? (
                            <img src={patientSignature} className="max-h-20 object-contain" alt="Thumb seal" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-[7.5px] text-slate-400 p-1 font-semibold leading-tight">
                              <span>Auto-stamped if selected on front</span>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center text-[7px] text-slate-400 p-1 font-semibold leading-tight text-center">
                            <span>Saves with main draw signature</span>
                          </div>
                        )}
                      </div>

                      <span className="text-[8px] font-bold text-slate-500 uppercase block tracking-tighter leading-none mt-1">
                        Affix right thumbmark if any
                      </span>
                    </div>

                    {/* Col 3: PhilHealth Use Only */}
                    <div className="p-3 flex flex-col justify-between h-44 bg-slate-100 font-sans text-[8.5px] text-slate-800 col-span-1 md:col-span-2 lg:col-span-1">
                      <div>
                        <span className="text-[9.5px] font-black text-red-700 uppercase tracking-widest block border-b border-red-200 pb-0.5 mb-1 text-center">FOR PHILHEALTH USE ONLY</span>
                        <div className="space-y-1 mt-1 font-semibold">
                          <span className="block uppercase text-[8px] text-slate-500">RECEIVED BY STATE OFFICER:</span>
                          
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[7px] uppercase leading-none">Full Name:</span>
                            <input 
                              type="text" 
                              value={pmrfBackReceivedByFullName}
                              onChange={(e) => setPmrfBackReceivedByFullName(e.target.value)}
                              className="bg-transparent border-b border-slate-300 font-black text-slate-800 focus:border-red-500 uppercase outline-none text-[8.5px] py-0.5 w-full font-mono"
                            />
                          </div>

                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[7px] uppercase leading-none">Branch / Office:</span>
                            <input 
                              type="text" 
                              value={pmrfBackReceivedByBranch}
                              onChange={(e) => setPmrfBackReceivedByBranch(e.target.value)}
                              className="bg-transparent border-b border-slate-300 font-black text-slate-800 focus:border-red-500 uppercase outline-none text-[8.5px] py-0.5 w-full font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col border-t border-slate-200 pt-1.5 mt-1 font-mono">
                        <span className="text-slate-400 text-[7px] uppercase leading-none font-sans">Date & Time Received:</span>
                        <input 
                          type="datetime-local" 
                          value={pmrfBackReceivedByDateTime}
                          onChange={(e) => setPmrfBackReceivedByDateTime(e.target.value)}
                          className="bg-transparent font-extrabold text-slate-700 outline-none text-[8px] border-none p-0 w-full mt-0.5"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Section VI: Official Legal Instructions */}
                  <div className="border border-black bg-white p-6 rounded-none shadow-sm text-black">
                    <div className="text-center font-bold text-sm tracking-wide block uppercase font-sans mb-5 underline select-none text-black">
                      INSTRUCTIONS
                    </div>
                    
                    <div className="text-[10px] leading-relaxed font-sans space-y-3 select-none text-black">
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">1.</span>
                        <span>All information should be written in UPPER CASE/CAPITAL LETTERS. If the information is not applicable, write "N/A."</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">2.</span>
                        <span>All fields are mandatory unless indicated as optional. By affixing your signature, you certify the truthfulness and accuracy of all information provided.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">3.</span>
                        <span>A properly accomplished PMRF shall be accompanied by a valid proof of identity for first time registrants, and supporting documents to establish relationship between member and dependent/s for updating or request for amendment.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">4.</span>
                        <span>On the PURPOSE, check the appropriate box if for <span className="font-bold underline">Registration</span> or for <span className="font-bold underline">Updating/Amendment</span> of information.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">5.</span>
                        <span>Indicate preferred KonSuLTa provider near the place of work or residence.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">6.</span>
                        <div className="flex-1">
                          <span>For PERSONAL DETAILS, all name entries should follow the format given below. Check the appropriate box if registrant has no middle name and/or with single name (mononym).</span>
                          
                          <div className="my-5 grid grid-cols-4 gap-4 text-center max-w-2xl mx-auto py-1">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-[9.5px] text-black uppercase font-sans">LAST NAME</span>
                              <span className="text-[11px] text-slate-800 mt-2 font-semibold font-sans tracking-wide">SANTOS</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-[9.5px] text-black uppercase font-sans">FIRST NAME</span>
                              <span className="text-[11px] text-slate-800 mt-2 font-semibold font-sans tracking-wide">JUAN ANDRES</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-[9.5px] text-black uppercase font-sans leading-tight">NAME EXTENSION (Jr./Sr./III)</span>
                              <span className="text-[11px] text-slate-800 mt-2 font-semibold font-sans tracking-wide">III</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-[9.5px] text-black uppercase font-sans">MIDDLE NAME</span>
                              <span className="text-[11px] text-slate-800 mt-2 font-semibold font-sans tracking-wide">DELA CRUZ</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">7.</span>
                        <span>Indicate registrant's/member's name as it appears in the birth certificate.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">8.</span>
                        <span>The full mother's maiden name of registrant/member must be indicated as it appears in the birth certificate.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">9.</span>
                        <span>Indicate the full name of spouse if registrant/member is married.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">10.</span>
                        <span>Indicate the complete permanent and mailing addresses and contact numbers.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">11.</span>
                        <span>For updating/amendment, check the appropriate box to be updated/amended and indicate the correct data.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">12.</span>
                        <span>For MEMBER TYPE, check the appropriate box which best describes your current membership status.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">13.</span>
                        <span>For Direct Contributors, except employed, sea-based migrant workers and lifetime members, indicate the profession, monthly income and proof of income to be submitted.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">14.</span>
                        <span>For Self-earning individuals, Kasambahays and Family Drivers, indicate the actual monthly income in the space provided.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">15.</span>
                        <span>In declaring dependents, provide the full name of the living spouse, children below 21 years old, and parents who are 60 years old and above totally dependent to the member.</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">16.</span>
                        <span>Dependents with disability shall be registered as principal members in accordance with Republic Act 11228 on mandatory PhilHealth coverage for all persons with disability (PWD).</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-5 font-bold shrink-0">17.</span>
                        <span>The registrant must affix his/her signature over printed name (or right thumbmark if unable to write) and indicate the date when the PMRF was signed.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

          )}

            </div>
          </div>
        )}

              {/* FPE INTEGRATION */}
              {activeFormTab === 'FPE' && (
                <div className="bg-white border-2 border-slate-400 p-4 md:p-6 shadow-sm rounded-lg space-y-4 font-sans text-xs max-w-full">
                  
                  {/* FPE Banner Header */}
                  <div className="border-b-2 border-slate-400 pb-4 text-center space-y-1 relative">
                    <div className="mx-auto h-12 w-12 bg-slate-100 flex items-center justify-center rounded-full border border-slate-300">
                      <span className="text-xl">🩺</span>
                    </div>
                    <h2 className="font-extrabold text-[15px] text-slate-900 uppercase tracking-tight">SAINT FRANCIS CLINIC</h2>
                    <p className="text-[10px] text-slate-500 font-bold">San Francisco, Pagadian City</p>
                    <h1 className="font-black text-sm text-blue-600 uppercase tracking-wide bg-blue-50 py-1.5 rounded">FIRST PATIENT ENCOUNTER (FPE)</h1>
                    <p className="text-[8.5px] text-slate-400 font-mono">PCP / Konsulta / Yakap + Gamot Program</p>
                  </div>

                  {/* Patient Information Section */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpePatientInfo: !collapsedMobileSecs.fpePatientInfo
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between cursor-pointer md:cursor-default"
                  >
                    <span>PATIENT INFORMATION (Auto-Synchronized)</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpePatientInfo ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpePatientInfo ? 'hidden md:grid' : 'grid'} grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-slate-300 bg-white print:grid`}>
                    <div className="col-span-1 md:col-span-2 relative">
                      {isNewMemberFpe ? (
                        <div>
                          <label className="text-[10px] font-extrabold text-violet-700 uppercase tracking-wider block mb-1">
                            New Member Details <span className="text-rose-600 font-bold ml-0.5">* Manual Fill</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Last Name *</label>
                              <input 
                                type="text"
                                value={pmrfLastName}
                                onChange={(e) => setPmrfLastName(e.target.value)}
                                placeholder="Last Name"
                                className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-violet-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">First Name *</label>
                              <input 
                                type="text"
                                value={pmrfFirstName}
                                onChange={(e) => setPmrfFirstName(e.target.value)}
                                placeholder="First Name"
                                className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-violet-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Middle Name</label>
                              <input 
                                type="text"
                                value={pmrfMiddleName}
                                onChange={(e) => setPmrfMiddleName(e.target.value)}
                                placeholder="Middle Name"
                                className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-violet-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block">Suffix/Extension</label>
                              <input 
                                type="text"
                                value={pmrfNameExt}
                                onChange={(e) => setPmrfNameExt(e.target.value)}
                                placeholder="e.g. Jr., Sr."
                                className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-violet-500 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <label className="text-[9px] font-bold text-slate-500 block">
                            Full Name {isFpePcsfOnly ? '(Select or Search Submitted Names)' : '(Auto-Synced from PMRF)'}
                          </label>
                          {isFpePcsfOnly ? (
                        <div className="relative">
                          <input
                            type="text"
                            id="search-fpe-patient-name"
                            value={pcsfFullName}
                            onChange={(e) => {
                              const term = e.target.value;
                              setPcsfFullName(term);
                              
                              // Parse name and set to pmrfLastName/FirstName to sync
                              const parts = term.split(',');
                              if (parts.length > 1) {
                                setPmrfLastName(parts[0].trim());
                                setPmrfFirstName(parts[1].trim());
                              } else {
                                setPmrfLastName('');
                                setPmrfFirstName(term);
                              }
                              
                              // Restrict database lookups to only PMRF Dependents, household members, and heads
                              const dependentsOnly = submittedNamesList.filter(item => 
                                item.role && typeof item.role === 'string' && (
                                  item.role.toLowerCase().includes('dependent') ||
                                  item.role.toLowerCase().includes('member') ||
                                  item.role.toLowerCase().includes('head')
                                )
                              );

                              // Check if there is an exact match in the dependents database to automatically fill info!
                              const exactMatch = dependentsOnly.find(p => p.fullName.toLowerCase() === term.toLowerCase());
                              if (exactMatch) {
                                const selectedName = exactMatch.fullName;
                                setPcsfFullName(selectedName);
                                if (exactMatch.role && exactMatch.role.toLowerCase().includes('head')) {
                                  setPcsfType('MEMBER');
                                  setPcsfDependentId('');
                                } else {
                                  setPcsfType('DEPENDENT');
                                  setPcsfDependentId(exactMatch.id);
                                }
                                setPcsfHouseholdId(exactMatch.householdId);
                                setPcsfHouseholdNumber(exactMatch.householdNumber || '');
                                
                                if (exactMatch.lastName) {
                                  setPmrfLastName(exactMatch.lastName);
                                } else {
                                  const parts = selectedName.split(',');
                                  if (parts.length > 1) {
                                    setPmrfLastName(parts[0].trim());
                                  } else {
                                    setPmrfLastName('');
                                  }
                                }
                                if (exactMatch.firstName) {
                                  setPmrfFirstName(exactMatch.firstName);
                                } else {
                                  const parts = selectedName.split(',');
                                  if (parts.length > 1) {
                                    setPmrfFirstName(parts[1].trim());
                                  } else {
                                    setPmrfFirstName(selectedName);
                                  }
                                }
                                if (exactMatch.middleName) setPmrfMiddleName(exactMatch.middleName);
                                if (exactMatch.nameExt) setPmrfNameExt(exactMatch.nameExt);
                                if (exactMatch.noMiddleName !== undefined) setPmrfMemberNoMiddleName(!!exactMatch.noMiddleName);
                                if (exactMatch.mononym !== undefined) setPmrfMemberMononym(!!exactMatch.mononym);
                                if (exactMatch.citizenship) setPmrfCitizenship(exactMatch.citizenship as any);
                                
                                if (exactMatch.pmrfDetails?.pin) {
                                  setPmrfPin(exactMatch.pmrfDetails.pin);
                                } else if (exactMatch.pmrfDetails?.pmrfPin) {
                                  setPmrfPin(exactMatch.pmrfDetails.pmrfPin);
                                } else if (exactMatch.pin) {
                                  setPmrfPin(exactMatch.pin);
                                } else {
                                  setPmrfPin('');
                                }
                                
                                if (exactMatch.gender) {
                                  setPmrfSex(exactMatch.gender);
                                } else if (exactMatch.pmrfDetails?.sex) {
                                  setPmrfSex(exactMatch.pmrfDetails.sex);
                                } else {
                                  setPmrfSex('Male');
                                }

                                if (exactMatch.civilStatus) {
                                  setPmrfCivilStatus(exactMatch.civilStatus as any);
                                } else if (exactMatch.pmrfDetails?.civilStatus) {
                                  setPmrfCivilStatus(exactMatch.pmrfDetails.civilStatus as any);
                                } else {
                                  setPmrfCivilStatus('Single');
                                }

                                // Do not auto-fill date of birth on the PMRF form as per request (keep it blank/empty)
                                setPmrfBirthDate('');

                                if (exactMatch.pmrfDetails?.mobileNo) {
                                  setPmrfMobileNo(exactMatch.pmrfDetails.mobileNo);
                                  setPcsfContactNo(exactMatch.pmrfDetails.mobileNo);
                                } else if (exactMatch.pmrfDetails?.pmrfMobileNo) {
                                  setPmrfMobileNo(exactMatch.pmrfDetails.pmrfMobileNo);
                                  setPcsfContactNo(exactMatch.pmrfDetails.pmrfMobileNo);
                                } else if (exactMatch.householdMobile) {
                                  setPmrfMobileNo(exactMatch.householdMobile);
                                  setPcsfContactNo(exactMatch.householdMobile);
                                } else {
                                  setPmrfMobileNo('');
                                  setPcsfContactNo('');
                                }

                                if (exactMatch.pmrfDetails?.email) {
                                  setPmrfEmail(exactMatch.pmrfDetails.email);
                                  setPcsfEmail(exactMatch.pmrfDetails.email);
                                } else {
                                  setPmrfEmail('');
                                  setPcsfEmail('');
                                }

                                if (exactMatch.barangay) {
                                  setFormBarangay(exactMatch.barangay);
                                  setPcsfAddressBarangay(exactMatch.barangay);
                                }
                                if (exactMatch.purok) {
                                  setFormPurok(exactMatch.purok);
                                }
                                if (exactMatch.pmrfDetails?.addressUnit) setPmrfAddressUnit(exactMatch.pmrfDetails.addressUnit);
                                if (exactMatch.pmrfDetails?.addressStreet) setPmrfAddressStreet(exactMatch.pmrfDetails.addressStreet);
                                if (exactMatch.pmrfDetails?.addressSubdivision) setPmrfAddressSubdivision(exactMatch.pmrfDetails.addressSubdivision);
                                if (exactMatch.pmrfDetails?.profession) setFpeShOccupation(exactMatch.pmrfDetails.profession);

                                if (exactMatch.householdHead) {
                                  setFpeHouseholdHead(exactMatch.householdHead);
                                } else {
                                  setFpeHouseholdHead(selectedName);
                                }

                                if (exactMatch.age !== undefined && exactMatch.age !== null) {
                                  setSelectedDependentAge(exactMatch.age);
                                } else if (exactMatch.birthdate || exactMatch.birthDate) {
                                  const parsedDate = exactMatch.birthdate || exactMatch.birthDate;
                                  const compAge = new Date().getFullYear() - new Date(parsedDate).getFullYear();
                                  setSelectedDependentAge(compAge >= 0 ? compAge : 0);
                                } else {
                                  setSelectedDependentAge(null);
                                }
                              } else {
                                setSelectedDependentAge(null);
                              }
                            }}
                            onFocus={() => setFullNameSearchFocused(true)}
                            onBlur={() => {
                              // Simple timeout to allow clicking of suggestion button
                              setTimeout(() => setFullNameSearchFocused(false), 250);
                            }}
                            placeholder="Type or select dependent name..."
                            className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-slate-500 bg-white"
                          />
                          {fullNameSearchFocused && (
                            <div className="absolute left-0 right-0 z-50 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded shadow-lg mt-1 block">
                              {(() => {
                                const dependentsOnly = submittedNamesList.filter(item => 
                                  item.role && typeof item.role === 'string' && (
                                    item.role.toLowerCase().includes('dependent') ||
                                    item.role.toLowerCase().includes('member') ||
                                    item.role.toLowerCase().includes('head')
                                  )
                                );
                                const matching = pcsfFullName 
                                  ? dependentsOnly.filter(item => {
                                      const termLower = pcsfFullName.toLowerCase();
                                      // Support: First Name, Middle Name, Last Name, Full/Partial text matching
                                      return item.fullName.toLowerCase().includes(termLower);
                                    })
                                  : dependentsOnly;
                                  
                                if (matching.length === 0) {
                                  return (
                                    <div className="p-3 text-center text-slate-400 text-[11px] font-semibold">
                                      No matching dependents found.
                                    </div>
                                  );
                                }
                                
                                return matching.slice(0, 30).map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onMouseDown={() => {
                                      const selectedName = item.fullName;
                                      setPcsfFullName(selectedName);
                                      if (item.role && item.role.toLowerCase().includes('head')) {
                                        setPcsfType('MEMBER');
                                        setPcsfDependentId('');
                                      } else {
                                        setPcsfType('DEPENDENT');
                                        setPcsfDependentId(item.id);
                                      }
                                      setPcsfHouseholdId(item.householdId);
                                      setPcsfHouseholdNumber(item.householdNumber || '');
                                      
                                      if (item.lastName) {
                                        setPmrfLastName(item.lastName);
                                      } else {
                                        const parts = selectedName.split(',');
                                        if (parts.length > 1) {
                                          setPmrfLastName(parts[0].trim());
                                        } else {
                                          setPmrfLastName('');
                                        }
                                      }
                                      if (item.firstName) {
                                        setPmrfFirstName(item.firstName);
                                      } else {
                                        const parts = selectedName.split(',');
                                        if (parts.length > 1) {
                                          setPmrfFirstName(parts[1].trim());
                                        } else {
                                          setPmrfFirstName(selectedName);
                                        }
                                      }
                                      if (item.middleName) setPmrfMiddleName(item.middleName);
                                      if (item.nameExt) setPmrfNameExt(item.nameExt);
                                      if (item.noMiddleName !== undefined) setPmrfMemberNoMiddleName(!!item.noMiddleName);
                                      if (item.mononym !== undefined) setPmrfMemberMononym(!!item.mononym);
                                      if (item.citizenship) setPmrfCitizenship(item.citizenship as any);
 
                                      if (item.pmrfDetails?.pin) {
                                        setPmrfPin(item.pmrfDetails.pin);
                                      } else if (item.pmrfDetails?.pmrfPin) {
                                        setPmrfPin(item.pmrfDetails.pmrfPin);
                                      } else if (item.pin) {
                                        setPmrfPin(item.pin);
                                      } else {
                                        setPmrfPin('');
                                      }
                                      
                                      if (item.gender) {
                                        setPmrfSex(item.gender);
                                      } else if (item.pmrfDetails?.sex) {
                                        setPmrfSex(item.pmrfDetails.sex);
                                      } else {
                                        setPmrfSex('Male');
                                      }
 
                                      if (item.civilStatus) {
                                        setPmrfCivilStatus(item.civilStatus as any);
                                      } else if (item.pmrfDetails?.civilStatus) {
                                        setPmrfCivilStatus(item.pmrfDetails.civilStatus as any);
                                      } else {
                                        setPmrfCivilStatus('Single');
                                      }
 
                                      // Do not auto-fill date of birth on the PMRF form as per request (keep it blank/empty)
                                      setPmrfBirthDate('');
 
                                      if (item.pmrfDetails?.mobileNo) {
                                        setPmrfMobileNo(item.pmrfDetails.mobileNo);
                                        setPcsfContactNo(item.pmrfDetails.mobileNo);
                                      } else if (item.pmrfDetails?.pmrfMobileNo) {
                                        setPmrfMobileNo(item.pmrfDetails.pmrfMobileNo);
                                        setPcsfContactNo(item.pmrfDetails.pmrfMobileNo);
                                      } else if (item.householdMobile) {
                                        setPmrfMobileNo(item.householdMobile);
                                        setPcsfContactNo(item.householdMobile);
                                      } else {
                                        setPmrfMobileNo('');
                                        setPcsfContactNo('');
                                      }
 
                                      if (item.pmrfDetails?.email) {
                                        setPmrfEmail(item.pmrfDetails.email);
                                        setPcsfEmail(item.pmrfDetails.email);
                                      } else {
                                        setPmrfEmail('');
                                        setPcsfEmail('');
                                      }
 
                                      if (item.barangay) {
                                        setFormBarangay(item.barangay);
                                        setPcsfAddressBarangay(item.barangay);
                                      }
                                      if (item.purok) {
                                        setFormPurok(item.purok);
                                      }
                                      if (item.pmrfDetails?.addressUnit) setPmrfAddressUnit(item.pmrfDetails.addressUnit);
                                      if (item.pmrfDetails?.addressStreet) setPmrfAddressStreet(item.pmrfDetails.addressStreet);
                                      if (item.pmrfDetails?.addressSubdivision) setPmrfAddressSubdivision(item.pmrfDetails.addressSubdivision);
                                      if (item.pmrfDetails?.profession) setFpeShOccupation(item.pmrfDetails.profession);
 
                                      if (item.householdHead) {
                                        setFpeHouseholdHead(item.householdHead);
                                      } else {
                                        setFpeHouseholdHead(selectedName);
                                      }
 
                                      if (item.age !== undefined && item.age !== null) {
                                        setSelectedDependentAge(item.age);
                                      } else if (item.birthdate || item.birthDate) {
                                        const parsedDate = item.birthdate || item.birthDate;
                                        const compAge = new Date().getFullYear() - new Date(parsedDate).getFullYear();
                                        setSelectedDependentAge(compAge >= 0 ? compAge : 0);
                                      } else {
                                        setSelectedDependentAge(null);
                                      }
                                      setFullNameSearchFocused(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 border-b border-slate-50 last:border-b-0 cursor-pointer text-xs font-semibold text-slate-800 block"
                                  >
                                    <div className="font-bold">{item.fullName}</div>
                                    <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                                      <span>{item.role}</span>
                                      {item.barangay && <span className="opacity-75">{item.barangay}</span>}
                                    </div>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          value={pmrfLastName || pmrfFirstName ? `${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.trim() : ''} 
                          disabled 
                          placeholder="(Please fill out PMRF Beneficiary details first)"
                          className="block w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-700 outline-none" 
                        />
                      )}
                        </>
                      )}
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">PhilHealth PIN</label>
                      <input 
                        type="text" 
                        value={pmrfPin} 
                        onChange={(e) => setPmrfPin(e.target.value)}
                        placeholder="Type PhilHealth PIN"
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-600 bg-white" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Household Head (Primary)</label>
                      <input 
                        type="text" 
                        value={fpeHouseholdHead} 
                        onChange={(e) => setFpeHouseholdHead(e.target.value)}
                        placeholder="Household Head Name"
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-slate-500 bg-white" 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Gender</label>
                      <select
                        value={pmrfSex}
                        onChange={(e) => setPmrfSex(e.target.value as any)}
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-slate-500 bg-white cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Birthdate</label>
                      <input 
                        type="date" 
                        value={pmrfBirthDate || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setPmrfBirthDate(val);
                          if (val) {
                            const compAge = new Date().getFullYear() - new Date(val).getFullYear();
                            setSelectedDependentAge(compAge >= 0 ? compAge : 0);
                          } else {
                            setSelectedDependentAge(null);
                          }
                        }}
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-850 outline-none focus:border-slate-500 bg-white cursor-pointer" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block font-mono">Calculated Age</label>
                      <input 
                        type="text" 
                        value={selectedDependentAge !== null ? `${selectedDependentAge} Yrs Old` : (pmrfBirthDate ? String(new Date().getFullYear() - new Date(pmrfBirthDate).getFullYear()) + ' Yrs Old' : '0 Yrs Old')} 
                        disabled 
                        className="block w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-755 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Mobile No. (PMRF Data)</label>
                      <input 
                        type="text" 
                        value={pmrfMobileNo} 
                        onChange={(e) => {
                          setPmrfMobileNo(e.target.value);
                          setPcsfContactNo(e.target.value);
                        }}
                        placeholder="Mobile Phone No."
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-extrabold font-mono text-slate-800 outline-none focus:border-slate-500 bg-white" 
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-4 font-sans">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-extrabold text-[#1e40af] block uppercase tracking-wide">
                          Residential Address <span className="text-red-500 font-black">*</span>
                        </label>
                      </div>
                      
                      {isFpePcsfOnly ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Purok *</label>
                            <input 
                              type="text" 
                              value={pmrfAddressSubdivision} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setPmrfAddressSubdivision(val);
                                const parts = [];
                                if (val.trim()) parts.push(val.trim());
                                if (pmrfAddressBarangay.trim()) parts.push(pmrfAddressBarangay.trim());
                                if (pmrfAddressMunicipality.trim()) parts.push(pmrfAddressMunicipality.trim());
                                setFpeAddress(parts.join(', '));
                                setFpeAddressManuallyEdited(true);
                              }}
                              placeholder="e.g. Purok Violet"
                              className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-white" 
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Barangay *</label>
                            <input 
                              type="text" 
                              value={pmrfAddressBarangay} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setPmrfAddressBarangay(val);
                                const parts = [];
                                if (pmrfAddressSubdivision.trim()) parts.push(pmrfAddressSubdivision.trim());
                                if (val.trim()) parts.push(val.trim());
                                if (pmrfAddressMunicipality.trim()) parts.push(pmrfAddressMunicipality.trim());
                                setFpeAddress(parts.join(', '));
                                setFpeAddressManuallyEdited(true);
                              }}
                              placeholder="e.g. San Francisco"
                              className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-white" 
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block">Municipality/City *</label>
                            <input 
                              type="text" 
                              value={pmrfAddressMunicipality} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setPmrfAddressMunicipality(val);
                                const parts = [];
                                if (pmrfAddressSubdivision.trim()) parts.push(pmrfAddressSubdivision.trim());
                                if (pmrfAddressBarangay.trim()) parts.push(pmrfAddressBarangay.trim());
                                if (val.trim()) parts.push(val.trim());
                                setFpeAddress(parts.join(', '));
                                setFpeAddressManuallyEdited(true);
                              }}
                              placeholder="e.g. Pagadian City"
                              className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-white" 
                            />
                          </div>
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          value={fpeAddress} 
                          onChange={(e) => {
                            setFpeAddress(e.target.value);
                            setFpeAddressManuallyEdited(true);
                          }}
                          placeholder="Type Complete Address (Format: Purok Name, Barangay name, Pagadian City)"
                          className="block w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-white" 
                        />
                      )}
                      
                      <p className="mt-1 text-[10px] text-amber-600 font-extrabold leading-tight">
                        💡 Guide: Please ensure the Purok, Barangay, and Municipality are correct. (e.g., "Purok Lavender, Banale, Pagadian City")
                      </p>

                      {isFpePcsfOnly && (
                        <div className="mt-3 p-2 bg-blue-50/50 border border-blue-200 rounded-md">
                          <label className="block text-[8.5px] font-black text-blue-700 uppercase tracking-wide mb-1">Geotag Coordinates (Latitude, Longitude) *</label>
                          <div className="flex flex-col sm:flex-row gap-1.5 mt-1 w-full">
                            <div className="flex gap-1.5 w-full sm:flex-1">
                              <input 
                                type="text" 
                                value={formLat} 
                                onChange={(e) => setFormLat(e.target.value)} 
                                placeholder="Latitude"
                                className="w-1/2 bg-white border border-slate-300 p-1.5 text-center font-mono text-[10px] font-black outline-none rounded"
                              />
                              <input 
                                type="text" 
                                value={formLng} 
                                onChange={(e) => setFormLng(e.target.value)} 
                                placeholder="Longitude"
                                className="w-1/2 bg-white border border-slate-300 p-1.5 text-center font-mono text-[10px] font-black outline-none rounded"
                              />
                            </div>
                            <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                              <button 
                                type="button" 
                                onClick={handleRandomCoordinates}
                                className="flex-1 sm:flex-initial px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] uppercase flex items-center justify-center gap-1 cursor-pointer transition-colors rounded"
                              >
                                📍 TAG
                              </button>
                              {formLat && formLng ? (
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${formLat},${formLng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase flex items-center justify-center gap-1 cursor-pointer transition-colors rounded"
                                  title="Coordinate on Map"
                                >
                                  🗺️ MAP
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-200 text-slate-400 font-bold text-[9px] uppercase flex items-center justify-center gap-1 cursor-not-allowed rounded"
                                >
                                  🗺️ MAP
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CHIEF COMPLAINT */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeChiefComplaint: !collapsedMobileSecs.fpeChiefComplaint
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>CHIEF COMPLAINT (Presenting Issues)</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeChiefComplaint ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeChiefComplaint ? 'hidden md:block' : 'block'} p-4 border border-slate-300 bg-white space-y-3 print:block`}>
                    <div className="flex flex-wrap gap-4 font-bold text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={fpeCcNone} 
                          onChange={(e) => {
                            setFpeCcNone(e.target.checked);
                            if (e.target.checked) {
                              setFpeCcFever(false);
                              setFpeCcCough(false);
                              setFpeCcBodyPain(false);
                              setFpeCcDyspnea(false);
                            }
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>None / Routine Consultation Check</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={fpeCcFever} 
                          onChange={(e) => {
                            setFpeCcFever(e.target.checked);
                            if (e.target.checked) setFpeCcNone(false);
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>Fever</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={fpeCcCough} 
                          onChange={(e) => {
                            setFpeCcCough(e.target.checked);
                            if (e.target.checked) setFpeCcNone(false);
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>Cough / Cold</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={fpeCcBodyPain} 
                          onChange={(e) => {
                            setFpeCcBodyPain(e.target.checked);
                            if (e.target.checked) setFpeCcNone(false);
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>Body / Muscle Pain</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={fpeCcDyspnea} 
                          onChange={(e) => {
                            setFpeCcDyspnea(e.target.checked);
                            if (e.target.checked) setFpeCcNone(false);
                          }}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>Difficulty Breathing (Dyspnea)</span>
                      </label>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Others (Specify symptoms/complaints)</label>
                      <input 
                        type="text" 
                        value={fpeCcOthers} 
                        onChange={(e) => {
                          setFpeCcOthers(e.target.value);
                          if (e.target.value) setFpeCcNone(false);
                        }}
                        placeholder="e.g. Chronic headache, skin rashes, joint swelling..."
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-1 text-xs outline-none focus:border-slate-800 font-semibold text-slate-800" 
                      />
                    </div>
                  </div>

                  {/* MEDICAL HISTORY */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeMedicalHistory: !collapsedMobileSecs.fpeMedicalHistory
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>PAST MEDICAL HISTORY</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeMedicalHistory ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeMedicalHistory ? 'hidden md:grid' : 'grid'} p-4 border border-slate-300 bg-white grid-cols-2 md:grid-cols-4 gap-3 font-bold text-xs text-slate-755 print:grid`}>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhHypertension} 
                        onChange={(e) => {
                          setFpeMhHypertension(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Hypertension</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhDiabetes} 
                        onChange={(e) => {
                          setFpeMhDiabetes(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Diabetes Mellitus</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhAstmaCopd} 
                        onChange={(e) => {
                          setFpeMhAstmaCopd(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Asthma / COPD</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhHeart} 
                        onChange={(e) => {
                          setFpeMhHeart(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Ischemic Heart Disease</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhStroke} 
                        onChange={(e) => {
                          setFpeMhStroke(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Prior Stroke / TIA</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhCancer} 
                        onChange={(e) => {
                          setFpeMhCancer(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Cancer Diagnosis</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhTb} 
                        onChange={(e) => {
                          setFpeMhTb(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Pulmonary Tuberculosis</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeMhKidney} 
                        onChange={(e) => {
                          setFpeMhKidney(e.target.checked);
                          if (e.target.checked) setFpeMhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Chronic Kidney Disease</span>
                    </label>
                    
                    <div className="col-span-full border-t border-slate-200 pt-2 flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 text-emerald-800 p-2 rounded border border-emerald-200">
                        <input 
                          type="checkbox" 
                          checked={fpeMhNone}
                          onChange={(e) => {
                            setFpeMhNone(e.target.checked);
                            if (e.target.checked) {
                              setFpeMhHypertension(false);
                              setFpeMhDiabetes(false);
                              setFpeMhAstmaCopd(false);
                              setFpeMhHeart(false);
                              setFpeMhStroke(false);
                              setFpeMhCancer(false);
                              setFpeMhTb(false);
                              setFpeMhKidney(false);
                            }
                          }}
                          className="h-4 w-4 text-emerald-600 rounded"
                        />
                        <span className="text-emerald-950 font-extrabold uppercase text-[10px]">No Prior Medical History (Clinically healthy beneficiary)</span>
                      </label>
                    </div>
                  </div>

                  {/* FAMILY HISTORY */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeFamilyHistory: !collapsedMobileSecs.fpeFamilyHistory
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>FAMILY LINEAGE PATHOLOGIES</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeFamilyHistory ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeFamilyHistory ? 'hidden md:grid' : 'grid'} p-4 border border-slate-300 bg-white grid-cols-2 md:grid-cols-5 gap-3 font-bold text-xs text-slate-750 print:grid`}>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeFhHypertension} 
                        onChange={(e) => {
                          setFpeFhHypertension(e.target.checked);
                          if (e.target.checked) setFpeFhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Family Hypertension</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeFhDiabetes} 
                        onChange={(e) => {
                          setFpeFhDiabetes(e.target.checked);
                          if (e.target.checked) setFpeFhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Family Diabetes</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeFhHeart} 
                        onChange={(e) => {
                          setFpeFhHeart(e.target.checked);
                          if (e.target.checked) setFpeFhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Family Cardiovascular</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={fpeFhCancer} 
                        onChange={(e) => {
                          setFpeFhCancer(e.target.checked);
                          if (e.target.checked) setFpeFhNone(false);
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>Family Cancer Cases</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-slate-100 p-1 rounded font-extrabold text-[10px] text-slate-800">
                      <input 
                        type="checkbox" 
                        checked={fpeFhNone} 
                        onChange={(e) => {
                          setFpeFhNone(e.target.checked);
                          if (e.target.checked) {
                            setFpeFhHypertension(false);
                            setFpeFhDiabetes(false);
                            setFpeFhHeart(false);
                            setFpeFhCancer(false);
                          }
                        }}
                        className="h-4 w-4 text-slate-650 rounded"
                      />
                      <span>None Reported</span>
                    </label>
                  </div>

                  {/* SOCIAL HISTORY */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeSocialHistory: !collapsedMobileSecs.fpeSocialHistory
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>SOCIAL HISTORY (Lifestyle Indicators)</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeSocialHistory ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeSocialHistory ? 'hidden md:grid' : 'grid'} p-4 border border-slate-300 bg-white grid-cols-1 md:grid-cols-3 gap-4 print:grid`}>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Smoking Habit</span>
                      <div className="flex gap-4 font-bold text-xs mt-1.5">
                        {['Never', 'Former', 'Current'].map((st) => (
                          <label key={st} className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name="fpeSmoking" 
                              checked={fpeShSmoking === st}
                              onChange={() => setFpeShSmoking(st as any)}
                              className="h-4 w-4 text-blue-600"
                            />
                            {st}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Alcohol Consumption</span>
                      <div className="flex gap-4 font-bold text-xs mt-1.5">
                        {['None', 'Occasional', 'Regular'].map((al) => (
                          <label key={al} className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name="fpeAlcohol" 
                              checked={fpeShAlcohol === al}
                              onChange={() => setFpeShAlcohol(al as any)}
                              className="h-4 w-4 text-blue-600"
                            />
                            {al}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block">Current Primary Occupation</label>
                      <input 
                        type="text" 
                        value={fpeShOccupation} 
                        onChange={(e) => setFpeShOccupation(e.target.value)} 
                        placeholder="Farmer, Vendor, Teacher..."
                        className="block w-full border border-slate-300 rounded px-2.5 py-1 text-xs mt-1 outline-none font-bold text-slate-805" 
                      />
                    </div>
                  </div>

                  {/* CURRENT MEDICATIONS */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeMedications: !collapsedMobileSecs.fpeMedications
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>REGULAR/MAINTENANCE RX DRUG REGIMEN</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeMedications ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeMedications ? 'hidden md:block' : 'block'} p-4 border border-slate-300 bg-white space-y-3 print:block`}>
                    <label className="flex items-center gap-2 font-bold text-xs cursor-pointer bg-slate-50 p-2.5 rounded border border-slate-200">
                      <input 
                        type="checkbox" 
                        checked={fpeMedNone} 
                        onChange={(e) => {
                          setFpeMedNone(e.target.checked);
                          if (e.target.checked) setFpeMedSpecify('');
                        }}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span>None (Beneficiary is not taking any custom prescription medicines on schedule)</span>
                    </label>
                    {!fpeMedNone && (
                      <div className="pt-1.5 select-all animate-fade-in">
                        <label className="text-[9px] font-bold text-slate-500 block">List Rx Drugs, dose, and frequency:</label>
                        <input 
                          type="text" 
                          value={fpeMedSpecify} 
                          onChange={(e) => {
                            setFpeMedSpecify(e.target.value);
                            if (e.target.value) setFpeMedNone(false);
                          }}
                          placeholder="e.g. Losartan 50mg tab once daily, Metformin 500mg tab twice daily with meals"
                          className="block w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-slate-800 font-bold text-[#1a56db] mt-1" 
                        />
                      </div>
                    )}
                  </div>

                  {/* VITAL SIGNS */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeVitals: !collapsedMobileSecs.fpeVitals
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>CLINICAL VITAL SIGNS INDEX</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeVitals ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeVitals ? 'hidden md:grid' : 'grid'} p-4 border border-slate-300 bg-white grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 print:grid`}>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">BP (systolic/diastolic)</label>
                      <input 
                        type="text" 
                        placeholder="120/80" 
                        value={fpeVitalBp} 
                        onChange={(e) => setFpeVitalBp(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">Body Weight (kg)</label>
                      <input 
                        type="text" 
                        placeholder="60" 
                        value={fpeVitalWt} 
                        onChange={(e) => setFpeVitalWt(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">Height (cm)</label>
                      <input 
                        type="text" 
                        placeholder="165" 
                        value={fpeVitalHt} 
                        onChange={(e) => setFpeVitalHt(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">
                        HR / Pulse (bpm) <span className="text-red-500 font-extrabold">*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="75" 
                        value={fpeVitalHr} 
                        onChange={(e) => setFpeVitalHr(e.target.value)}
                        className={`block w-full border rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800 ${
                          ((isFpePcsfOnly || isFpePartiallyFilled) && !fpeVitalHr.trim()) ? "border-red-400 bg-red-50/15" : "border-slate-300"
                        }`} 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">
                        Resp Rate (/min) <span className="text-red-500 font-extrabold">*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="16" 
                        value={fpeVitalRr} 
                        onChange={(e) => setFpeVitalRr(e.target.value)}
                        className={`block w-full border rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800 ${
                          ((isFpePcsfOnly || isFpePartiallyFilled) && !fpeVitalRr.trim()) ? "border-red-400 bg-red-50/15" : "border-slate-300"
                        }`} 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">
                        Temperature (°C) <span className="text-red-500 font-extrabold">*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="36.5" 
                        value={fpeVitalTemp} 
                        onChange={(e) => setFpeVitalTemp(e.target.value)}
                        className={`block w-full border rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800 ${
                          ((isFpePcsfOnly || isFpePartiallyFilled) && !fpeVitalTemp.trim()) ? "border-red-400 bg-red-50/15" : "border-slate-300"
                        }`} 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">Calculated BMI</label>
                      <input 
                        type="text" 
                        placeholder="22.0" 
                        value={fpeVitalBmi} 
                        onChange={(e) => setFpeVitalBmi(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">Waistline (cm)</label>
                      <input 
                        type="text" 
                        placeholder="80" 
                        value={fpeVitalWaist} 
                        onChange={(e) => setFpeVitalWaist(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">Upper Arm (cm)</label>
                      <input 
                        type="text" 
                        placeholder="30" 
                        value={fpeVitalUpperArm} 
                        onChange={(e) => setFpeVitalUpperArm(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block leading-none">Mid Arm (cm)</label>
                      <input 
                        type="text" 
                        placeholder="28" 
                        value={fpeVitalMidArm} 
                        onChange={(e) => setFpeVitalMidArm(e.target.value)}
                        className="block w-full border border-slate-300 rounded p-1.5 text-center font-mono font-bold mt-1 text-slate-800" 
                      />
                    </div>
                  </div>

                  {/* PHYSICAL EXAM & ASSESSMENT */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      fpeExam: !collapsedMobileSecs.fpeExam
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>PHYSICAL EXAMS & CLINICAL ASSESSMENTS</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.fpeExam ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.fpeExam ? 'hidden md:grid' : 'grid'} grid-cols-1 md:grid-cols-2 gap-4 mt-2 print:grid`}>
                    <div>
                      <div className="border border-slate-300 bg-slate-800 text-white font-bold text-[9px] py-1 px-2.5 uppercase tracking-wider block">
                        PHYSICAL EXAMINATION & SIGNS
                      </div>
                      <textarea 
                        value={fpePhysicalExam} 
                        onChange={(e) => setFpePhysicalExam(e.target.value)} 
                        rows={4} 
                        placeholder="e.g. Chest: Clear breath sounds, no rales/wheezing. Heart: Normal rate, regular rhythm, no murmurs. Abdomen: Soft, non-tender, no organomegaly..."
                        className="w-full border border-slate-300 rounded p-2.5 text-xs font-semibold mt-1 outline-none focus:border-slate-800 text-slate-800"
                      />
                    </div>
                    <div>
                      <div className="border border-slate-300 bg-slate-800 text-white font-bold text-[9px] py-1 px-2.5 uppercase tracking-wider block">
                        CLINICAL PLAN & MANAGEMENT PREPARATION
                      </div>
                      <textarea 
                        value={fpeAssessmentPlan} 
                        onChange={(e) => setFpeAssessmentPlan(e.target.value)} 
                        rows={4} 
                        placeholder="e.g. Prescribed regular daily Losartan 50mg tab. Baseline urine test scheduled. Patient educated on low sodium nutrition plan. Re-check BP in 2 weeks..."
                        className="w-full border border-slate-300 rounded p-2.5 text-xs font-semibold mt-1 outline-none focus:border-slate-800 text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Clinician Signature Disclaimer Line */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 font-medium mt-4">
                    <span>Clinical Staff Practitioner: <strong>{currentUser.fullName} ({currentUser.position})</strong></span>
                    <span className="font-mono mt-1 md:mt-0">FPE Intake Document Twin Series: {new Date().toLocaleDateString()}</span>
                  </div>

                  {/* FPE Patient Signature Block */}
                  <div className="border border-slate-350 bg-slate-50 p-4 rounded-lg mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-slate-550 uppercase tracking-widest block">First Patient Encounter Consent</span>
                      <p className="text-[9px] text-slate-500 leading-snug">
                        I confirm that the physical measurements, current symptoms, and historical health records detailed above were evaluated in my presence, and I consent to the corresponding clinical plan.
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-4 h-full">
                      <div className="border-b border-slate-700 w-full max-w-xs h-16 relative flex items-center justify-center">
                        {patientSignature ? (
                          <img src={patientSignature} className="max-h-16 w-auto object-contain" alt="Patient Signature" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[8px] text-slate-450 font-bold uppercase tracking-wider select-none absolute bottom-1">No Signature Captured (Sign below)</span>
                        )}
                      </div>
                      <span className="text-[8px] font-extrabold text-slate-600 uppercase tracking-wide mt-1.5">Signature of Patient / Parent / Guardian</span>
                    </div>
                  </div>

                </div>
              )}

              {/* PCSF INTEGRATION */}
              {activeFormTab === 'PCSF' && (
                <div className="bg-white border-2 border-slate-400 p-4 md:p-6 shadow-sm rounded-lg space-y-4 font-sans text-xs max-w-full">
                  
                  {/* PCSF Form Header */}
                  <div className="border-b bg-slate-50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 border-slate-300">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🛡️</span>
                      <div>
                        <h2 className="font-black text-sm tracking-wide text-slate-900 leading-none">PhilHealth</h2>
                        <h1 className="font-black text-[13px] text-blue-800 uppercase tracking-tight mt-1 leading-none">Primary Care Selection Form (PCSF)</h1>
                        <p className="text-[8px] text-slate-400 font-bold mt-0.5 font-serif uppercase">Official Konsulta Beneficiary Choice Record</p>
                      </div>
                    </div>
                    <div className="bg-blue-600 text-white font-extrabold px-3 py-1 rounded-full text-[9px] uppercase tracking-wider">
                      Saint Francis Clinic Network
                    </div>
                  </div>

                  {/* Instructions block */}
                  <div className="text-[9.5px] bg-slate-50 border border-slate-250 p-3 rounded-lg text-slate-600 leading-relaxed font-serif">
                    <strong className="block text-slate-800 uppercase mb-1">INSTRUCTIONS & BENEFICIARY CONTEXT</strong>
                    1. Choose your Primary Care clinic intentionally based on location accessibility.<br />
                    2. By choosing Saint Francis Clinic as 1st PCC Choice, your consults, laboratory checks, and essential drugs are secured for subsidized disbursement under PhilHealth Konsulta package protocols.
                  </div>

                  {/* Member Type Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-blue-50/20 border border-blue-200 rounded-lg mt-3">
                    <div>
                      <span className="text-[9.5px] font-bold text-indigo-950 uppercase block">SIGNATORY TYPE</span>
                      <div className="flex gap-6 mt-1.5 font-bold text-xs text-slate-755">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="radio" 
                            name="pcsfType" 
                            checked={pcsfType === 'MEMBER'}
                            onChange={() => setPcsfType('MEMBER')}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span>PRIMARY MEMBER</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="radio" 
                            name="pcsfType" 
                            checked={pcsfType === 'DEPENDENT'}
                            onChange={() => setPcsfType('DEPENDENT')}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span>DECLARED DEPENDENT</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block">PCSF Selection Enrollment Date</label>
                      <input 
                        type="date" 
                        value={pcsfDate || new Date().toISOString().split('T')[0]} 
                        onChange={(e) => setPcsfDate(e.target.value)} 
                        className="block w-full border border-slate-300 rounded px-2.5 py-1 text-xs mt-1 outline-none font-bold text-slate-800" 
                      />
                    </div>
                  </div>

                  {/* Beneficiary Details Section */}
                  <button
                    type="button"
                    onClick={() => setCollapsedMobileSecs({
                      ...collapsedMobileSecs,
                      pcsfBeneficiaryDetails: !collapsedMobileSecs.pcsfBeneficiaryDetails
                    })}
                    className="w-full text-left border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-2 px-3.5 uppercase tracking-wider flex items-center justify-between mt-4 cursor-pointer md:cursor-default"
                  >
                    <span>BENEFICIARY DETAILS (Auto-Filled / Editable Verification)</span>
                    <span className="md:hidden print:hidden text-[9px] bg-white/20 px-2 py-0.5 rounded text-white font-black uppercase">
                      {collapsedMobileSecs.pcsfBeneficiaryDetails ? '＋ EXPAND' : '－ COLLAPSE'}
                    </span>
                  </button>
                  <div className={`${collapsedMobileSecs.pcsfBeneficiaryDetails ? 'hidden md:grid' : 'grid'} grid-cols-1 md:grid-cols-3 gap-3 p-3.5 border border-slate-300 bg-white print:grid`}>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">PHILHEALTH PIN (Auto-Synced/Typeable)</label>
                      <input 
                        type="text" 
                        value={pmrfPin} 
                        onChange={(e) => setPmrfPin(e.target.value)}
                        placeholder="Type PhilHealth PIN"
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-600 bg-white" 
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-[9px] font-bold text-slate-500 block">FULL BENEFICIARY NAME</label>
                      <input 
                        type="text" 
                        value={pcsfFullName || (pmrfLastName || pmrfFirstName ? `${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.trim() : '')} 
                        onChange={(e) => setPcsfFullName(e.target.value)}
                        placeholder="Beneficiary Full Name"
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-600" 
                      />
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="text-[9px] font-bold text-slate-500 block">PERMANENT RESIDENTIAL ADDRESS</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                        <input 
                          type="text" 
                          value={pcsfAddressBarangay} 
                          onChange={(e) => setPcsfAddressBarangay(e.target.value)}
                          placeholder="Barangay"
                          className="border border-slate-300 rounded p-1.5 text-center font-bold text-slate-800 text-xs"
                        />
                        <input 
                          type="text" 
                          value={pcsfAddressCity} 
                          onChange={(e) => setPcsfAddressCity(e.target.value)}
                          placeholder="City/Municipality"
                          className="border border-slate-300 rounded p-1.5 text-center font-bold text-slate-800 text-xs"
                        />
                        <input 
                          type="text" 
                          value={pcsfAddressProvince} 
                          onChange={(e) => setPcsfAddressProvince(e.target.value)}
                          placeholder="Province"
                          className="border border-slate-300 rounded p-1.5 text-center font-bold text-slate-805 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">BENEFICIARY BIRTHPLACE</label>
                      <input 
                        type="text" 
                        value={pmrfBirthPlace || 'Pagadian City'} 
                        disabled 
                        className="block w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 mt-0.5 text-xs font-bold text-slate-700 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">CONTACT NO. (BENEFICIARY)</label>
                      <input 
                        type="text" 
                        value={pcsfContactNo} 
                        onChange={(e) => setPcsfContactNo(e.target.value)}
                        placeholder="e.g. 09171234567"
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-mono font-bold text-slate-805 outline-none focus:border-slate-800" 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">EMAIL ADDRESS (BENEFICIARY)</label>
                      <input 
                        type="email" 
                        value={pcsfEmail} 
                        onChange={(e) => setPcsfEmail(e.target.value)}
                        placeholder="e.g. doctor@sfclinic.com"
                        className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-0.5 text-xs font-semibold text-slate-805 outline-none" 
                      />
                    </div>
                  </div>

                  {/* Primary Care clinic enrollment block */}
                  <div className="border border-slate-300 bg-slate-50 p-4 rounded-xl space-y-4 mt-4">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-extrabold text-xs text-slate-850">
                        <input 
                          type="checkbox" 
                          checked={pcsfRegisterPcc} 
                          onChange={(e) => setPcsfRegisterPcc(e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>REGISTER/AFFILIATE TO PRIMARY CARE FACILITY</span>
                      </label>

                      <label className="inline-flex items-center gap-2 cursor-pointer font-extrabold text-xs text-slate-850">
                        <input 
                          type="checkbox" 
                          checked={pcsfRegisterDependents} 
                          onChange={(e) => setPcsfRegisterDependents(e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                        <span>REGISTER ALL HOUSEHOLD DECLARED DEPENDENTS ALSO</span>
                      </label>
                    </div>

                    {pcsfRegisterPcc && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-white border border-slate-205 rounded-lg animate-fade-in text-slate-850">
                        <div className="space-y-3">
                          <h4 className="font-extrabold text-blue-600 text-[10.5px] border-b pb-1">1ST CHOICE PCC</h4>
                          <div>
                            <label className="text-[8.5px] font-bold text-slate-500 uppercase block">CLINIC NAME</label>
                            <input 
                              type="text" 
                              value={pcsfPcc1} 
                              onChange={(e) => setPcsfPcc1(e.target.value)}
                              className="block w-full border border-slate-300 rounded px-2.5 py-1 text-xs mt-0.5 font-bold text-slate-800 focus:border-slate-800" 
                            />
                          </div>
                          <div>
                            <label className="text-[8.5px] font-bold text-slate-500 uppercase block">CLINIC ADDRESS</label>
                            <input 
                              type="text" 
                              value={pcsfPcc1Addr} 
                              onChange={(e) => setPcsfPcc1Addr(e.target.value)}
                              className="block w-full border border-slate-300 rounded px-2.5 py-1 text-xs mt-0.5 font-semibold text-slate-700" 
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="font-extrabold text-slate-600 text-[10.5px] border-b pb-1">2ND CHOICE PCC</h4>
                          <div>
                            <label className="text-[8.5px] font-bold text-slate-500 uppercase block">CLINIC NAME</label>
                            <input 
                              type="text" 
                              value={pcsfPcc2} 
                              onChange={(e) => setPcsfPcc2(e.target.value)}
                              placeholder="e.g. San Francisco Barangay Health Station"
                              className="block w-full border border-slate-300 rounded px-2.5 py-1 text-xs mt-0.5 font-bold text-slate-800" 
                            />
                          </div>
                          <div>
                            <label className="text-[8.5px] font-bold text-slate-500 uppercase block">CLINIC ADDRESS</label>
                            <input 
                              type="text" 
                              value={pcsfPcc2Addr} 
                              onChange={(e) => setPcsfPcc2Addr(e.target.value)}
                              placeholder="e.g. Pagadian City Health Station, Zamboanga del Sur"
                              className="block w-full border border-slate-300 rounded px-2.5 py-1 text-xs mt-0.5 font-semibold text-slate-700" 
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CLINIC TRANSFER BLOCK */}
                    <div className="border-t pt-4 border-slate-200">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-xs text-orange-950 bg-orange-50 p-2 rounded border border-orange-200">
                        <input 
                          type="checkbox" 
                          checked={pcsfTransfer} 
                          onChange={(e) => setPcsfTransfer(e.target.checked)}
                          className="h-4 w-4 text-orange-700 rounded"
                        />
                        <span>PCC Clinic Transfer / De-enrollment Check</span>
                      </label>

                      {pcsfTransfer && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-yellow-50/15 border border-yellow-205 rounded-lg animate-fade-in text-xs font-semibold">
                          <div className="col-span-3">
                            <label className="text-[9px] font-bold text-slate-500 block">PREVIOUS REGISTERED PCC CLINIC</label>
                            <input 
                              type="text" 
                              value={pcsfPrevPcc} 
                              onChange={(e) => setPcsfPrevPcc(e.target.value)}
                              placeholder="Previous Primary Care Clinic"
                              className="block w-full border border-slate-300 rounded px-2.5 py-1.5 mt-1 text-xs font-bold text-slate-800" 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Privacy details */}
                  <div className="p-3 bg-slate-900 text-slate-100 rounded-lg space-y-1.5 font-serif text-[9px] leading-relaxed mt-4">
                    <strong className="block text-[10px] text-yellow-450 uppercase font-sans font-bold">Privacy Consent Declaration</strong>
                    I hereby declare that this choosing of Saint Francis Clinic is voluntary. I authorize Saint Francis Clinic under PhilHealth rules to process my data to secure treatment under the Konsulta health framework.
                  </div>

                  {/* BOTTOM PRE-DRAFT CONFIRMATION SLIP DIGITAL CARD */}
                  <div className="border-2 border-dashed border-[#1a56db] rounded-xl p-4 bg-blue-50/15 space-y-3 relative overflow-hidden mt-4 text-slate-805">
                    <div className="absolute right-0 top-0 bg-[#1a56db] text-white p-2 text-[8px] font-extrabold rounded-bl uppercase">
                      BENEFICIARY COPY
                    </div>
                    <h3 className="font-extrabold text-[11px] text-blue-900 block border-b pb-1">KONSULTA PRIMARY CARE SELECTION CONFIRMATION SLIP (SF CLINIC)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[10.5px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">Selection ID:</span>
                        <strong className="text-slate-750 font-mono">HH-AUTO-2026-PC</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[9px]">Verified Beneficiary Name:</span>
                        <strong className="text-slate-800 uppercase">{pcsfFullName || (pmrfLastName || pmrfFirstName ? `${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.trim() : 'Juan Dela Cruz')}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Selection Date:</span>
                        <strong className="text-slate-750">{pcsfDate || new Date().toLocaleDateString()}</strong>
                      </div>
                    </div>
                  </div>

                  {/* PCSF Patient Signature Block */}
                  <div className="border border-slate-350 bg-slate-50 p-4 rounded-lg mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-slate-550 uppercase tracking-widest block">Authorization Accord & Consent</span>
                      <p className="text-[9px] text-slate-500 leading-snug">
                        I choose Saint Francis Clinic as my primary healthcare clinic, and authorize the clinical staffs to utilize my registration profile to secure Konsulta services of PhilHealth on my behalf.
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-4 h-full">
                      <div className="border-b border-slate-700 w-full max-w-xs h-16 relative flex items-center justify-center">
                        {patientSignature ? (
                          <img src={patientSignature} className="max-h-16 w-auto object-contain" alt="Patient Signature" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-[8px] text-slate-455 font-bold uppercase tracking-wider select-none absolute bottom-1">No Signature Captured (Sign below)</span>
                        )}
                      </div>
                      <span className="text-[8px] font-extrabold text-slate-600 uppercase tracking-wide mt-1.5">Signature of Patient / Authorized Representative</span>
                    </div>
                  </div>

                </div>
              )}

                {/* UNIFIED SIGNATURE BLOCK */}
                <div className="border border-slate-305 bg-blue-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block mt-4">
                  📝 Unified Patient / Representative Signature (Auto-Stamps on all 3 Forms)
                </div>
                <div className="p-4 border border-slate-300 bg-white space-y-4 shadow-xs mb-4">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm">
                        Patient Sworn Signature Seal <span className="text-rose-600 font-extrabold text-xs ml-1">* Required</span>
                      </h4>
                      <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">
                        Please have the patient or authorized guardian sign inside the pad area. 
                        This digital signature will automatically stamp and propagate to the base of the 
                        <strong> PMRF FORM</strong>, <strong>FPE FORM</strong>, and <strong>PCSF FORM</strong> automatically.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <SignaturePad 
                      onChange={(sig) => setPatientSignature(sig)} 
                      defaultValue={patientSignature}
                    />
                  </div>
                </div>

                {(!isFpePcsfOnly || isNewMemberFpe) && (
                  <>
                    {/* FILE ATTACHMENTS BLOCK - PLACED DIRECTLY UNDER THE PMRF FORM */}
                    <div className="border border-slate-305 bg-emerald-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block mt-4 flex items-center justify-between">
                      <span>📂 Attachments (Dossier Identity Verification Logs)</span>
                      <span className="bg-emerald-950 font-black text-[9px] py-0.5 px-1.5 rounded text-amber-300 border border-emerald-800">Required</span>
                    </div>

                    <div className="p-4 border border-slate-300 bg-emerald-50/10 rounded-b-lg space-y-4">
                      <span className="block text-[10.5px] text-slate-550 font-medium">
                        Upload official proof documents (IDs, paper PMRF, physical documents) and map to family members:
                      </span>

                      {/* SINGLE FILE UPLOAD DESIGN */}
                      <div className="w-full">
                        <label 
                          htmlFor="pmrf-file-upload-input-household" 
                          className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:bg-emerald-50/20 transition bg-white shadow-xs group ${
                            selectedAttachmentFile ? 'border-emerald-600 bg-emerald-50/20' : 'border-slate-305 hover:border-emerald-400'
                          }`}
                        >
                          <Folder className="h-8 w-8 text-emerald-600 mb-1.5 group-hover:scale-110 transition shrink-0" />
                          <span className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wide">Add Household File <span className="text-rose-600 font-black text-xs ml-0.5">* Required</span></span>
                          <span className="text-[8.5px] text-slate-400 mt-0.5 font-medium leading-none">Primary ID, physical PMRF scan, proof doc</span>
                        </label>
                        <input 
                          type="file" 
                          onChange={(e) => {
                            setAttachmentType('Household File');
                            if (e.target.files && e.target.files[0]) {
                              setSelectedAttachmentFile(e.target.files[0]);
                            }
                          }}
                          className="hidden" 
                          id="pmrf-file-upload-input-household" 
                          accept="image/*,application/pdf"
                        />
                      </div>

                      {/* Active selected uploading attachment details, category & dropdown mapping */}
                      {selectedAttachmentFile && (
                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-150 space-y-3.5 shadow-sm">
                          <div className="flex items-center justify-between text-xs text-slate-700 pb-2 border-b border-emerald-100">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="font-bold truncate" id="selected-upload-file-name">{selectedAttachmentFile.name}</span>
                              <span className="text-[10px] text-slate-450 shrink-0 font-mono">({(selectedAttachmentFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            {uploadProgress === null && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAttachmentFile(null);
                                  setTempManualOwnerName('');
                                  setAttachmentOwnerName('');
                                }}
                                className="text-rose-600 hover:text-rose-700 font-extrabold text-[10px] uppercase tracking-wide cursor-pointer p-0.5 select-none"
                              >
                                Cancel
                              </button>
                            )}
                          </div>

                          {/* Dropdown to pick who this belongs to */}
                          <div className="space-y-1 text-slate-700">
                            <label className="text-[9px] font-black uppercase text-slate-500 block tracking-widest leading-none">
                              Identify Attachment Owner Name
                            </label>
                            <select 
                              value={attachmentOwnerName}
                              onChange={(e) => setAttachmentOwnerName(e.target.value)}
                              className="bg-white border border-slate-205 w-full rounded-md p-1.5 text-[11.5px] font-semibold text-slate-850 focus:outline-emerald-500"
                            >
                              <option value="">-- Choose Member Name --</option>
                              {(() => {
                                const calculatedHeadName = pmrfLastName && pmrfFirstName 
                                  ? `${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.trim().toUpperCase()
                                  : (isFpePcsfOnly ? pcsfFullName : formHeadName);
                                return calculatedHeadName ? (
                                  <option value={calculatedHeadName}>{calculatedHeadName} (Household Head)</option>
                                ) : null;
                              })()}
                              {wizardDependents && wizardDependents.map((dep: any, idx: number) => {
                                const name = dep.fullName || `${dep.lastName}, ${dep.firstName}`;
                                return (
                                  <option key={idx} value={name}>
                                    {name} (Dependent)
                                  </option>
                                );
                              })}
                              {wizardMembers && wizardMembers.map((mem: any, idx: number) => {
                                const name = mem.fullName || `${mem.lastName}, ${mem.firstName}`;
                                return (
                                  <option key={idx} value={name}>
                                    {name} (Member)
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {uploadProgress !== null ? (
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[9px] font-black text-emerald-800 uppercase tracking-wider">
                                <span>Uploading securely to SFC Registry...</span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
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
                              className="w-full bg-emerald-600 hover:bg-emerald-500 active:translate-y-[1px] select-none text-[10px] font-black uppercase text-white p-2.5 rounded-lg border-b-[2.5px] border-emerald-850 hover:border-emerald-705 transition cursor-pointer shadow-sm text-center"
                            >
                              Attach to Household Files
                            </button>
                          )}
                        </div>
                      )}

                      {attachmentsList.length > 0 && (
                        <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-205 shadow-sm">
                          <span className="block text-[10.5px] font-extrabold text-slate-550 uppercase tracking-widest pl-0.5 leading-none mb-1">
                            Ready for Submission: {attachmentsList.length} files
                          </span>
                          <div className="flex gap-2.5 flex-wrap overflow-x-auto py-1">
                            {attachmentsList.map((img, idx) => {
                              const isObj = img && typeof img === 'object';
                              const fileData = isObj ? img.fileData : img;
                              const name = isObj ? img.fullName : 'Identity Scan';
                              const docType = isObj ? img.documentType : 'Verification File';
                              
                              const isPdf = fileData?.startsWith('data:application/pdf') || (img.fileName && img.fileName.toLowerCase().endsWith('.pdf'));
                              
                              return (
                                <div key={idx} className="relative group rounded-xl overflow-hidden border border-emerald-305 bg-slate-50 p-1 hover:scale-103 hover:border-emerald-500 transition max-w-[155px] shrink-0 hover:shadow-md">
                                  {isPdf ? (
                                    <div className="h-16 w-[145px] bg-white flex flex-col items-center justify-center rounded-lg border border-slate-200">
                                      <FileText className="h-7 w-7 text-red-500 mb-0.5" />
                                      <span className="text-[7px] font-black text-slate-500 truncate max-w-[130px] font-mono leading-none">{img.fileName || 'PDF Doc'}</span>
                                    </div>
                                  ) : (
                                    <img src={fileData} alt="attached doc scan" className="h-16 w-[145px] object-cover rounded-lg" />
                                  )}
                                  
                                  <div className="absolute inset-x-0 bottom-0 bg-slate-900/90 text-[7px] font-black text-white p-1 text-center truncate uppercase tracking-wider leading-none rounded-b-lg">
                                    {name}
                                  </div>
                                  <span className={`absolute top-1 left-1 text-[6.5px] font-black uppercase text-white px-1 leading-none py-0.5 rounded shadow-xs ${
                                    docType === 'FPE/PCSF' ? 'bg-[#1a56db]' : 'bg-emerald-800'
                                  }`}>
                                    {docType === 'FPE/PCSF' ? 'FPE' : 'HH File'}
                                  </span>
                                  
                                  <button
                                    type="button"
                                    onClick={() => setAttachmentsList(attachmentsList.filter((_, i) => i !== idx))}
                                    className="absolute top-0 right-0 bg-red-650 text-white font-extrabold h-4.5 w-4.5 flex items-center justify-center rounded-bl text-[9px] hover:bg-red-700 shadow shrink-0"
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
                  </>
                )}

            </form>

            {/* Bottom Form Submission Buttons */}
            <div className="p-4 border-t bg-white border-slate-200 rounded-b-xl shadow-inner space-y-3">
              <div className="flex items-center justify-between px-1 select-none">
                <div className="text-[10.5px] font-sans text-slate-500 flex items-center gap-1.5 bg-slate-100/60 px-3 py-1 rounded-full border border-slate-200 select-none">
                  <span className="animate-spin text-xs">⚙️</span>
                  <span className="font-semibold">{autoSaveStatus}</span>
                </div>
              </div>

              {isFpeVitalsInvalid && (
                <div id="fpe-vitals-validation-warning" className="bg-amber-50 border border-amber-305 text-amber-850 rounded-lg p-2.5 flex items-start gap-2 text-[10.5px] font-bold leading-tight select-none">
                  <span className="text-sm select-none">⚠️</span>
                  <span>
                    FPE Form Validation: Please fill out the required fields (<span className="text-red-700">Heart Rate</span>, <span className="text-red-700">Respiratory Rate</span>, <span className="text-red-700">Temperature</span>, and <span className="text-red-700">Residential Address</span>) in the FPE form to enable the submission button.
                  </span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="button"
                  onClick={handleCloseAddModal}
                  className="flex-1 py-3 btn-3d-secondary font-bold text-xs uppercase tracking-wider cursor-pointer font-sans rounded-lg"
                >
                  {editingHH ? "Discard Changes" : "Cancel"}
                </button>
                
                {!editingHH && isDraftOnlyMode && (
                  <button 
                    type="button"
                    onClick={handleSaveFormAsDraft}
                    className="flex-1 py-3 font-extrabold text-xs uppercase tracking-wider text-center bg-amber-500 hover:bg-amber-600 border-b-3 border-amber-700 active:border-b-0 text-white rounded-lg transition-all font-sans cursor-pointer hover:shadow-xs shadow-2xs"
                  >
                    Save as Draft
                  </button>
                )}

                {!isDraftOnlyMode && (
                  <button 
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={isFpeVitalsInvalid}
                    className={`flex-1 py-3 font-extrabold text-xs uppercase tracking-wider text-center transition-all rounded-lg ${
                      isFpeVitalsInvalid
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60 border-b-2 border-slate-400"
                        : "btn-3d-primary btn-pulse-save text-white cursor-pointer"
                    }`}
                  >
                    {editingHH ? "Save Profile & Update PMRF Records" : "Submit for Approval"}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* QUICK CORRECT EDIT MODAL */}
      {editingHH && !showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10030] p-4 text-xs font-sans text-slate-800">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative border overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Edit2 className="h-5 w-5 text-blue-600" />
                  Edit Household Profile Details
                </h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Modify the household coordinates, willingness indications, and registration info.</p>
              </div>
              <button 
                onClick={() => setEditingHH(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
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
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Assign Purok Sector</label>
                  <select
                    value={editPurok}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditPurok(val);
                      setPmrfAddressSubdivision(val.toUpperCase());
                      if (pmrfMailSame) {
                        setPmrfMailSubdivision(val.toUpperCase());
                      }
                    }}
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
                      onClick={() => {
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
                      }}
                      title="Auto Tag Coordinates"
                      className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase rounded shadow-xs shrink-0 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      📍 Tag Coords
                    </button>
                    {editLat && editLng ? (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${editLat},${editLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase rounded shadow-xs shrink-0 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                        title="Coordinate on Map"
                      >
                        🗺️ Map
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-slate-200 text-slate-400 font-bold text-[10px] uppercase rounded shrink-0 flex items-center justify-center gap-1 cursor-not-allowed whitespace-nowrap"
                        title="Set coordinates to enable map view"
                      >
                        🗺️ Map
                      </button>
                    )}
                  </div>
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">SFC Enrollment STATUS</label>
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

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setEditingHH(null)}
                  className="px-4 py-2.5 btn-3d-secondary font-bold uppercase cursor-pointer rounded-xl"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 btn-3d-primary btn-pulse-save text-white font-extrabold uppercase rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  Save Variations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ATTACHMENT LIGHTBOX MODAL */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-[10040] p-4 font-sans text-xs text-white">
          <div className="absolute top-4 right-4 flex gap-3 z-20">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = viewingAttachment;
                link.download = `attachment_scan_${Date.now()}.${viewingAttachment.startsWith('data:application/pdf') ? 'pdf' : 'png'}`;
                link.click();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 py-1.5 px-3 rounded text-[10px] uppercase font-bold text-white transition flex items-center gap-1 shadow cursor-pointer"
            >
              📥 Download Document
            </button>
            <button 
              onClick={() => setViewingAttachment(null)}
              className="bg-red-600 hover:bg-red-700 font-bold p-1 px-3 text-sm rounded cursor-pointer transition text-white"
            >
              ✕ Close
            </button>
          </div>
          <div className="w-full max-w-4xl h-[75vh] flex items-center justify-center relative bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-850">
            {viewingAttachment.startsWith('data:application/pdf') ? (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950/40 rounded-xl max-w-lg">
                <FileText className="h-16 w-16 text-red-500 animate-pulse" />
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-white text-sm">Signed PDF Document Proof Scan</h3>
                  <p className="text-slate-400 text-[10.5px] leading-relaxed">
                    Local browser security sandbox prevents displaying embedded PDF files directly. Click below to download or view the official PDF scan document securely in a new tab:
                  </p>
                </div>
                <div className="flex gap-2 w-full pt-2 justify-center">
                  <a 
                    href={viewingAttachment} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-650 hover:bg-blue-750 text-[10px] font-black uppercase text-white px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow active:translate-y-0.5 transition cursor-pointer select-none"
                  >
                    🔗 Open in New Tab
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = viewingAttachment;
                      link.download = `attachment_scan_${Date.now()}.pdf`;
                      link.click();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase text-white px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow active:translate-y-0.5 transition cursor-pointer select-none"
                  >
                    📥 Download PDF
                  </button>
                </div>
              </div>
            ) : (
              <img 
                referrerPolicy="no-referrer" 
                src={viewingAttachment} 
                alt="Expanded identity document verification attachment scan" 
                className="object-contain max-h-[70vh] max-w-full rounded-lg"
              />
            )}
          </div>
          <p className="mt-3 text-slate-400 font-medium text-[11px]">Identity verification card scan associated with Saint Francis Clinic Household Database ledger.</p>
        </div>
      )}

      {/* LOCK / SESSION CONCURRENCY WARNING POPUP MODAL */}
      {lockWarningModal?.isOpen && (
        <div className="fixed inset-0 z-[10025] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setLockWarningModal(null)}
          ></div>
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative max-w-md w-full overflow-hidden transform transition-all scale-100 duration-300 p-6 space-y-5 z-[10026]">
            <div className="flex items-start gap-4 text-left">
              <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-sm border border-amber-100 mt-1 block">
                <Lock className="h-6 w-6 animate-pulse" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Resource Active & Locked
                </h3>
                <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-50 border border-amber-150 px-2.5 py-0.5 rounded tracking-wider">
                  Data Open on Different Device/Account
                </span>
                <p className="text-slate-500 text-xs leading-relaxed pt-2">
                  The household records you are attempting to access are currently open on another device/account by <strong className="text-slate-850 font-bold">{lockWarningModal.lockedBy.name}</strong> (<span className="font-mono text-[10px]">{lockWarningModal.lockedBy.email}</span>).
                </p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  To protect relational profiles and prevent parallel synchronization collision, this dataset is restricted. Please coordinate with them or wait for them to close their session, after which the data will become available.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLockWarningModal(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all duration-200 shadow-sm"
              >
                Understood & Wait
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-DESIGN CUSTOM CONFIRMATION POPUP MODAL */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
          {/* Backdrop blur with dark glossiness */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setConfirmModal(null)}
          ></div>
          
          {/* Main Modal Card frame */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative max-w-md w-full overflow-hidden transform transition-all scale-100 duration-300 p-6 space-y-5 z-[20001]">
            <div className="flex items-start gap-4 text-left">
              <span className="p-3 bg-red-50 text-red-650 rounded-2xl shadow-sm border border-red-100 mt-1 block">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
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

            {/* Custom High Design hover-effect Buttons list */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all duration-200 hover:shadow-sm"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-red-200/50 hover:shadow-red-300/80 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                {(confirmModal as any).confirmText || 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SUBMISSION LOADING OVERLAY */}
      {submissionLoading && (
        <div className="fixed inset-0 z-[30000] flex flex-col items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl transition-opacity duration-500"></div>
          
          <div className="relative text-center space-y-6 max-w-sm w-full p-8 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl animate-fade-in animate-scale-up">
            {/* Spinning Indicator */}
            <div className="flex justify-center">
              <div className="relative h-20 w-20 flex items-center justify-center">
                {/* External Orbiting Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 border-r-emerald-500 animate-spin"></div>
                {/* Inner Counter Pulse Ring */}
                <div className="absolute inset-2 rounded-full border-4 border-white/5 border-b-emerald-400 border-l-emerald-400 animate-spin duration-1000"></div>
                {/* Central Activity Icon Pulsing */}
                <span className="p-3 bg-emerald-500/15 rounded-full border border-emerald-500/30">
                  <Activity className="h-6 w-6 text-emerald-400 animate-pulse" />
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-white text-base font-black tracking-wide uppercase">
                {submissionLoadingTitle}
              </h3>
              <p className="inline-block text-emerald-400 text-[10px] font-bold tracking-wider uppercase bg-emerald-950/40 border border-[#10b981]/50 px-3 py-1 rounded-full">
                DO NOT CLOSE THIS PAGE
              </p>
            </div>

            {/* Dynamic Status Logs */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 max-h-24 overflow-hidden shadow-inner text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">System Log Trace</span>
              </div>
              <p className="text-white text-xs font-mono font-medium leading-relaxed truncate antialiased">
                &gt; {submissionLoadingMsg}
              </p>
            </div>
            
            <p className="text-[10px] text-slate-400 select-none">
              Securing clinical ledger & index nodes • Saint Francis Clinic
            </p>
          </div>
        </div>
      )}

      {/* UNEXPECTED SHUTDOWN / INTERRUPT RECOVERY POPUP MODAL */}
      {showRecoveryModal && pendingRecoveryDraft && (
        <div className="fixed inset-0 z-[20010] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={() => { setShowRecoveryModal(false); setPendingRecoveryDraft(null); }}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-md w-full overflow-hidden p-6 space-y-5 text-left z-[20011] animate-fade-in animate-scale-up">
            <div className="flex items-start gap-4">
              <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 block shrink-0 mt-1">
                <Bookmark className="h-6 w-6 animate-bounce" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Unsaved Form Detected</h3>
                <span className="text-[9px] font-extrabold text-amber-700 uppercase bg-amber-50 border border-amber-200 px-2 py-0.5 rounded tracking-wider font-sans">
                  Auto-Recovery Registry
                </span>
                <p className="text-slate-500 text-xs leading-relaxed pt-2">
                  We found an unsaved Household draft from an unexpected session interruption or browser refresh. Would you like to continue editing?
                </p>
                <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 mt-2 text-[11px] text-slate-600 font-mono space-y-1 select-none">
                  <div>👤 <strong className="text-slate-700">Form Head:</strong> {pendingRecoveryDraft.formHeadName || pendingRecoveryDraft.pmrfLastName || 'Incomplete Record'}</div>
                  <div>📍 <strong className="text-slate-700">Barangay:</strong> {pendingRecoveryDraft.formBarangay || 'Unassigned'}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  // Discard Draft
                  localStorage.removeItem('saint_francis_household_form_draft');
                  setShowRecoveryModal(false);
                  setPendingRecoveryDraft(null);
                  setAlertModal({
                    isOpen: true,
                    title: 'Draft Discarded',
                    description: 'The temporary recovery draft has been wiped successfully.',
                    type: 'info'
                  });
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-505 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold uppercase tracking-wider text-[10px] select-none text-center cursor-pointer font-sans"
              >
                Discard Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  // Restore values
                  restoreDraftData(pendingRecoveryDraft);
                  setDraftId(null); // Fresh unsaved form
                  setShowAddModal(true);
                  setShowRecoveryModal(false);
                  setPendingRecoveryDraft(null);
                  setAlertModal({
                    isOpen: true,
                    title: 'Form Hydrated',
                    description: 'Your previous session status has been recovered. Feel free to resume editing.',
                    type: 'success'
                  });
                }}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:shadow-md transition uppercase tracking-wide text-[10px] select-none text-center cursor-pointer font-sans"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FILE SELECTION MODAL */}
      {showAddFileModal && (
        <div id="add-file-selection-modal" className="fixed inset-0 z-[19000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setShowAddFileModal(false)}></div>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl relative max-w-lg w-full overflow-hidden p-6 z-[19001] animate-fade-in animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Select Action Mode</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Choose the registration mode you want to proceed with</p>
              </div>
              <button 
                onClick={() => setShowAddFileModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Add Household File square button */}
              <button
                id="btn-modal-add-household-file"
                onClick={() => {
                  setShowAddFileModal(false);
                  resetPMRFStates();
                  setIsFpePcsfOnly(false);
                  setIsNewMemberFpe(false);
                  setShowAddModal(true);
                }}
                className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-400 rounded-2xl transition duration-150 group cursor-pointer text-center space-y-3.5 shadow-sm hover:shadow-md h-[150px] w-full"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition duration-150">
                  <FolderPlus className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">PMRF</span>
                </div>
              </button>

              {/* Add FPE/PCSF square button */}
              <button
                id="btn-modal-add-fpe-pcsf"
                onClick={() => {
                  setShowAddFileModal(false);
                  resetPMRFStates();
                  setIsFpePcsfOnly(true);
                  setIsNewMemberFpe(false);
                  setActiveFormTab('FPE');
                  setShowAddModal(true);
                }}
                className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-400 rounded-2xl transition duration-150 group cursor-pointer text-center space-y-3.5 shadow-sm hover:shadow-md h-[150px] w-full"
              >
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition duration-150">
                  <FileHeart className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">PCSF/FPE Dependents</span>
                </div>
              </button>

              {/* New Member FPE/PCSF square button */}
              <button
                id="btn-modal-new-member-fpe-pcsf"
                onClick={() => {
                  setShowAddFileModal(false);
                  resetPMRFStates();
                  setIsFpePcsfOnly(true);
                  setIsNewMemberFpe(true);
                  setActiveFormTab('FPE');
                  setShowAddModal(true);
                }}
                className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-400 rounded-2xl transition duration-150 group cursor-pointer text-center space-y-3.5 shadow-sm hover:shadow-md h-[150px] w-full"
              >
                <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-105 transition duration-150">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">PCSF/FPE Members</span>
                </div>
              </button>
            </div>
            
            <div className="mt-5 pt-3 border-t border-slate-100 text-center">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Saint Francis Health Center Central Registry Directory</p>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CENTERING ALERT POPUP MODAL */}
      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setAlertModal(null)}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-sm w-full overflow-hidden p-6 space-y-4 text-center z-[20001] animate-fade-in animate-scale-up">
            <div className="flex flex-col items-center gap-3 text-center">
              {alertModal.type === 'success' ? (
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 block">
                  <CheckCircle className="h-8 w-8 animate-bounce" />
                </span>
              ) : alertModal.type === 'info' ? (
                <span className="p-3 bg-blue-50 text-blue-600 rounded-full border border-blue-100 block">
                  <Folder className="h-8 w-8 animate-pulse" />
                </span>
              ) : (
                <span className="p-3 bg-rose-50 text-rose-650 rounded-full border border-rose-100 block">
                  <XCircle className="h-8 w-8 animate-pulse" />
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
