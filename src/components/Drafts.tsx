import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Search, PlusCircle, Trash2, Edit3, Copy, Send, 
  RefreshCw, AlertTriangle, Wifi, WifiOff, Calendar, MapPin, 
  CheckCircle, ArrowUpDown, Shield, Clock, Database, Users, 
  FolderOpen, Activity, XCircle, FolderPlus, FileHeart, UserPlus
} from 'lucide-react';
import { User, HouseholdDraft } from '../types';

interface DraftsProps {
  currentUser: User;
  onEditDraft: (draft: any) => void;
  connectionStatus: 'online' | 'slow' | 'offline';
  refreshTrigger?: number;
}

export default function Drafts({ 
  currentUser, 
  onEditDraft, 
  connectionStatus,
  refreshTrigger
}: DraftsProps) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncFilter, setSyncFilter] = useState<'All' | 'Local Only' | 'Waiting for Sync' | 'Synced'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatusMsg, setSubmissionStatusMsg] = useState('Initiating secure packet transmission...');
  const [submissionTitle, setSubmissionTitle] = useState('Submitting Draft File');
  const [showAddDraftFileModal, setShowAddDraftFileModal] = useState(false);
  
  // Alert Modals / Toast Notification States
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    syncStatus: string;
    headName: string;
  } | null>(null);

  // Load and refresh drafts isolated strictly by current logged-in Account ID
  const fetchLocalDrafts = async () => {
    try {
      const stored = localStorage.getItem('sfc_household_drafts');
      let allDrafts = stored ? JSON.parse(stored) : [];

      if (connectionStatus !== 'offline') {
        try {
          const res = await fetch('/api/drafts', {
            headers: {
              'x-user-email': currentUser.email
            }
          });
          if (res.ok) {
            const serverDrafts = await res.json();
            if (Array.isArray(serverDrafts)) {
              // Merge server drafts into local drafts
              serverDrafts.forEach((sd: any) => {
                const localIdx = allDrafts.findIndex((ld: any) => ld.id === sd.id);
                if (localIdx > -1) {
                  // Only update if local is Synced (to prevent overwriting modified local unsynced drafts)
                  if (allDrafts[localIdx].syncStatus === 'Synced') {
                    allDrafts[localIdx] = { ...sd, syncStatus: 'Synced' };
                  }
                } else {
                  allDrafts.push({ ...sd, syncStatus: 'Synced' });
                }
              });
              localStorage.setItem('sfc_household_drafts', JSON.stringify(allDrafts));
            }
          }
        } catch (serverErr) {
          console.error('Failed fetching remote drafts:', serverErr);
        }
      }

      // STRICT OWNER-VISIBLE-ONLY ENFORCEMENT: Isolate by account ID (email)
      const filtered = allDrafts.filter(
        (d: any) => d.accountId && d.accountId.toLowerCase() === currentUser.email.toLowerCase()
      );
      setDrafts(filtered);
    } catch (e) {
      console.error('Failed to read sfc_household_drafts:', e);
    }
  };

  useEffect(() => {
    fetchLocalDrafts();
  }, [currentUser, connectionStatus, refreshTrigger]);

  // Synchronize drafts with backend server
  const handleBulkSync = async () => {
    if (connectionStatus === 'offline') {
      showAlert('Sync Restricted', 'Your connection is currently offline. Please reconnect to sync drafts.', 'error');
      return;
    }
    
    setIsSyncing(true);
    setSyncStatusMsg('Establishing secure endpoint handshake...');
    
    try {
      const stored = localStorage.getItem('sfc_household_drafts');
      const allDrafts = stored ? JSON.parse(stored) : [];
      
      const pendingDrafts = allDrafts.filter(
        (d: any) => d.accountId.toLowerCase() === currentUser.email.toLowerCase() && 
                    (d.syncStatus === 'Local Only' || d.syncStatus === 'Waiting for Sync')
      );

      if (pendingDrafts.length === 0) {
        setIsSyncing(false);
        showAlert('Up to date', 'All local drafts are already synchronized with the server database.', 'info');
        return;
      }

      let successCount = 0;
      const updatedList = [...allDrafts];

      for (const d of pendingDrafts) {
        try {
          const res = await fetch('/api/drafts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify(d)
          });

          if (res.ok) {
            successCount++;
            const foundIdx = updatedList.findIndex(x => x.id === d.id);
            if (foundIdx > -1) {
              updatedList[foundIdx].syncStatus = 'Synced';
            }
          } else {
            const foundIdx = updatedList.findIndex(x => x.id === d.id);
            if (foundIdx > -1) {
              updatedList[foundIdx].syncStatus = 'Waiting for Sync';
            }
          }
        } catch (err) {
          console.error('Failed syncing single draft ID:', d.id, err);
          const foundIdx = updatedList.findIndex(x => x.id === d.id);
          if (foundIdx > -1) {
            updatedList[foundIdx].syncStatus = 'Waiting for Sync';
          }
        }
      }

      localStorage.setItem('sfc_household_drafts', JSON.stringify(updatedList));
      fetchLocalDrafts();
      
      if (successCount > 0) {
        showAlert('Synchronization Complete', 'Your drafts have been synchronized successfully.', 'success');
      } else {
        showAlert('Sync Idle', 'Handshake completed with server, but pending drafts failed to push.', 'error');
      }
    } catch (e) {
      console.error('Bulk sync failed:', e);
      showAlert('Sync Handshake Error', 'A protocol socket error occurred. Please retry shortly.', 'error');
    } finally {
      setIsSyncing(false);
      setSyncStatusMsg('');
    }
  };

  // Helper to trigger custom alerts
  const showAlert = (title: string, description: string, type: 'success' | 'error' | 'info') => {
    setAlertState({ isOpen: true, title, description, type });
  };

  // Delete draft helper to open confirmation modal instead of blocking window.confirm
  const handleDeleteDraft = (id: string, syncStatus: string, headName: string) => {
    setDeleteConfirm({ id, syncStatus, headName });
  };

  // Actual execution of draft deletion once confirmed
  const executeDeleteDraft = async (id: string, syncStatus: string) => {
    try {
      // 1. Delete on Server if synced and online
      if (syncStatus === 'Synced' && connectionStatus !== 'offline') {
        const res = await fetch('/api/drafts/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': currentUser.email
          },
          body: JSON.stringify({ id })
        });
        if (!res.ok) {
          console.warn('Backend draft deletion failed or rejected.');
        }
      }

      // 2. Delete locally
      const stored = localStorage.getItem('sfc_household_drafts');
      const allDrafts = stored ? JSON.parse(stored) : [];
      const updated = allDrafts.filter((d: any) => d.id !== id);
      localStorage.setItem('sfc_household_drafts', JSON.stringify(updated));
      
      fetchLocalDrafts();
      showAlert('Draft Discarded', 'The household draft record has been discarded and cleared successfully.', 'info');
    } catch (e) {
      console.error('Delete draft failed:', e);
      showAlert('Deletion failed', 'Failed to properly clean references for this draft.', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Duplicate Draft
  const handleDuplicateDraft = (draft: any) => {
    try {
      const stored = localStorage.getItem('sfc_household_drafts');
      const allDrafts = stored ? JSON.parse(stored) : [];
      
      const fd = draft.formData || {};
      const origLastName = fd.pmrfLastName || '';
      const origHead = fd.formHeadName || 'Untitled Head';
      
      // Clone formData and modify names slightly to show it's a clone
      const clonedFormData = {
        ...fd,
        pmrfLastName: origLastName ? `${origLastName} (Copy)` : '',
        formHeadName: origHead ? `${origHead} (Copy)` : 'Untitled Head (Copy)'
      };

      const clonedDraft: any = {
        id: 'draft_' + Math.random().toString(36).substr(2, 9),
        accountId: currentUser.email,
        residentialArea: draft.residentialArea || currentUser.address || 'Unassigned Area',
        lastModified: new Date().toISOString(),
        status: 'Draft',
        syncStatus: 'Local Only',
        formData: clonedFormData
      };

      allDrafts.push(clonedDraft);
      localStorage.setItem('sfc_household_drafts', JSON.stringify(allDrafts));
      fetchLocalDrafts();
      showAlert('Draft Duplicated', 'Cloned draft created successfully. Form fields have been populated.', 'success');
    } catch (e) {
      console.error('Failed to duplicate draft:', e);
      showAlert('Cloning Failed', 'Unable to duplicate draft structure.', 'error');
    }
  };

  // Explicit draft Submission directly from drafts page
  const handleSubmitDraft = async (draft: any) => {
    if (connectionStatus === 'offline') {
      showAlert('Submission Blocked', 'You are currently offline. Please reconnect to submit drafts for clinic approval.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmissionTitle('Submitting Draft for Verification');
      setSubmissionStatusMsg('Preparing database submission payload & verifying attachments...');

      await new Promise(resolve => setTimeout(resolve, 850));

      // Build payload exactly corresponding to Households form submit
      const fd = draft.formData || {};
      const isFpePcsfOnly = fd.isFpePcsfOnly || false;
      const calculatedHeadName = fd.pmrfLastName && fd.pmrfFirstName 
        ? `${fd.pmrfLastName}, ${fd.pmrfFirstName}` 
        : (isFpePcsfOnly ? fd.pcsfFullName : fd.formHeadName);

      if (!calculatedHeadName) {
        setIsSubmitting(false);
        showAlert('Missing Crucial Information', 'This draft must have a Household Head or PhilHealth Beneficiary Name before submission.', 'error');
        return;
      }

      if (!isFpePcsfOnly) {
        // Validation: Mother's Maiden Name (Last Name and First Name)
        if (!(fd.pmrfMotherLastName || '').trim() || !(fd.pmrfMotherFirstName || '').trim()) {
          setIsSubmitting(false);
          showAlert("Mother's Maiden Name Required", "Please fill out the Mother's Maiden Name (Last Name and First Name) in the PMRF details of this draft before submitting for approval.", 'error');
          return;
        }

        // Validation: Patient Sworn Signature Seal
        if (!fd.patientSignature) {
          setIsSubmitting(false);
          showAlert("Patient Sworn Signature Seal Required", "Please ensure the patient or authorized representative has signed the Patient Sworn Signature Seal under Section II of this draft before submitting.", 'error');
          return;
        }

        // Validation: Attachments Dossier List
        const finalAttachments = fd.attachmentsList || fd.attachments || [];
        if (finalAttachments.length === 0) {
          setIsSubmitting(false);
          showAlert("Add Household File Required", "Please upload and attach at least one proof document under 'Attachments' in this draft before submitting it for approval.", 'error');
          return;
        }
      }

      setSubmissionStatusMsg('Establishing clinical registry security handshake...');
      await new Promise(resolve => setTimeout(resolve, 650));
      setSubmissionStatusMsg('Registering household formulation & patient health ledger...');

      const payload = {
        draftId: draft.id,
        isFpePcsfOnly: isFpePcsfOnly,
        householdData: {
          householdNumber: fd.pcsfHouseholdNumber || fd.formHeadName || 'HH-' + Date.now().toString().slice(-6),
          householdHead: calculatedHeadName,
          contactNumber: fd.pmrfMobileNo || fd.formContact || '',
          completeAddress: `${fd.pmrfAddressStreet || ''} ${fd.pmrfAddressSubdivision || ''}`.trim() || 'No complete address provided',
          barangay: draft.residentialArea || fd.formBarangay || currentUser.address || '',
          purok: fd.formPurok || 'Unspecified Purok',
          latitude: parseFloat(fd.formLat) || 7.828,
          longitude: parseFloat(fd.formLng) || 123.433,
          pmrfStatus: fd.formPmrf || 'Pending',
          yakapWillingStatus: fd.formYakap || 'Willing',
          approvalStatus: 'Pending',
          attachments: fd.attachmentsList || [],
          remarks: 'Submitted from Offline Draft Storage Page',
          pmrfDetails: {
            patientSignature: fd.patientSignature || undefined,
            purpose: fd.pmrfPurpose || 'REGISTRATION',
            konsulta: fd.pmrfKonsulta || 'Saint Francis Clinic Provider',
            pin: fd.pmrfPin || '',
            lastName: fd.pmrfLastName || '',
            firstName: fd.pmrfFirstName || '',
            nameExt: fd.pmrfNameExt || '',
            middleName: fd.pmrfMiddleName || '',
            motherMaiden: fd.pmrfMotherMaiden || '',
            motherLastName: fd.pmrfMotherLastName || '',
            motherFirstName: fd.pmrfMotherFirstName || '',
            motherMiddleName: fd.pmrfMiddleName || '',
            motherNameExt: fd.pmrfMotherNameExt || '',
            motherNoMiddleName: fd.pmrfMotherNoMiddleName || false,
            motherMononym: fd.pmrfMotherMononym || false,
            spouseName: fd.pmrfSpouseName || '',
            spouseLastName: fd.pmrfSpouseLastName || '',
            spouseFirstName: fd.pmrfSpouseFirstName || '',
            spouseMiddleName: fd.pmrfSpouseMiddleName || '',
            spouseNameExt: fd.pmrfSpouseNameExt || '',
            spouseNoMiddleName: fd.pmrfSpouseNoMiddleName || false,
            spouseMononym: fd.pmrfSpouseMononym || false,
            birthDate: fd.pmrfBirthDate || '',
            birthPlace: fd.pmrfBirthPlace || '',
            sex: fd.pmrfSex || 'Male',
            civilStatus: fd.pmrfCivilStatus || 'Single',
            citizenship: fd.pmrfCitizenship || 'FILIPINO',
            philsysNo: fd.pmrfPhilsysNo || '',
            tin: fd.pmrfTin || '',
            addressUnit: fd.pmrfAddressUnit || '',
            addressStreet: fd.pmrfAddressStreet || '',
            addressSubdivision: fd.pmrfAddressSubdivision || '',
            addressZip: fd.pmrfAddressZip || '7016',
            addressUnitNoFloor: fd.pmrfAddressUnitNoFloor || '',
            addressBuildingName: fd.pmrfAddressBuildingName || '',
            addressBarangay: fd.pmrfAddressBarangay || '',
            addressMunicipality: fd.pmrfAddressMunicipality || '',
            addressProvince: fd.pmrfAddressProvince || '',
            mailSame: fd.pmrfMailSame !== undefined ? fd.pmrfMailSame : true,
            mailUnit: fd.pmrfMailUnit || '',
            mailStreet: fd.pmrfMailStreet || '',
            mailSubdivision: fd.pmrfMailSubdivision || '',
            mailZip: fd.pmrfMailZip || '7016',
            mailUnitNoFloor: fd.pmrfMailUnitNoFloor || '',
            mailBuildingName: fd.pmrfMailBuildingName || '',
            mailBarangay: fd.pmrfMailBarangay || '',
            mailMunicipality: fd.pmrfMailMunicipality || '',
            mailProvince: fd.pmrfMailProvince || '',
            homePhone: fd.pmrfHomePhone || '',
            mobileNo: fd.pmrfMobileNo || '',
            businessDirect: fd.pmrfBusinessDirect || '',
            email: fd.pmrfEmail || '',
            contributorCategory: fd.pmrfContributorCategory || 'DIRECT',
            contributorType: fd.pmrfContributorType || 'Employed Private',
            pmrfGroupSchemeName: fd.pmrfGroupSchemeName || '',
            pmrfPraSrrvNo: fd.pmrfPraSrrvNo || '',
            pmrfAcrICardNo: fd.pmrfAcrICardNo || '',
            pmrfPwdIdNo: fd.pmrfPwdIdNo || '',
            profession: fd.pmrfProfession || '',
            monthlyIncome: fd.pmrfMonthlyIncome || '',
            proofOfIncome: fd.pmrfProofOfIncome || '',
            pmrfBackChangeName: fd.pmrfBackChangeName || false,
            pmrfBackChangeDOB: fd.pmrfBackChangeDOB || false,
            pmrfBackChangeSex: fd.pmrfBackChangeSex || false,
            pmrfBackChangeCivilStatus: fd.pmrfBackChangeCivilStatus || false,
            pmrfBackChangePersonalInfo: fd.pmrfBackChangePersonalInfo || false,
            pmrfBackFromValueName: fd.pmrfBackFromValueName || '',
            pmrfBackToValueName: fd.pmrfBackToValueName || '',
            pmrfBackFromValueDOB: fd.pmrfBackFromValueDOB || '',
            pmrfBackToValueDOB: fd.pmrfBackToValueDOB || '',
            pmrfBackFromValueSex: fd.pmrfBackFromValueSex || '',
            pmrfBackToValueSex: fd.pmrfBackToValueSex || '',
            pmrfBackFromValueCivil: fd.pmrfBackFromValueCivil || '',
            pmrfBackToValueCivil: fd.pmrfBackToValueCivil || '',
            pmrfBackFromValueInfo: fd.pmrfBackFromValueInfo || '',
            pmrfBackToValueInfo: fd.pmrfBackToValueInfo || '',
            pmrfBackSignature: fd.pmrfBackSignature || null,
            pmrfBackSignatureDate: fd.pmrfBackSignatureDate || '',
            pmrfBackThumbmark: fd.pmrfBackThumbmark || null,
            pmrfBackSameAsFront: fd.pmrfBackSameAsFront !== undefined ? fd.pmrfBackSameAsFront : true,
            pmrfBackReceivedByFullName: fd.pmrfBackReceivedByFullName || '',
            pmrfBackReceivedByBranch: fd.pmrfBackReceivedByBranch || 'PAGADIAN BRANCH',
            pmrfBackReceivedByDateTime: fd.pmrfBackReceivedByDateTime || ''
          },
          fpeDetails: fd.fpeDetails || {
            ccNone: fd.fpeCcNone || false,
            ccFever: fd.fpeCcFever || false,
            ccCough: fd.fpeCcCough || false,
            ccBodyPain: fd.fpeCcBodyPain || false,
            ccDyspnea: fd.fpeCcDyspnea || false,
            ccOthers: fd.fpeCcOthers || '',
            mhHypertension: fd.fpeMhHypertension || false,
            mhDiabetes: fd.fpeMhDiabetes || false,
            mhAstmaCopd: fd.fpeMhAstmaCopd || false,
            mhHeart: fd.fpeMhHeart || false,
            mhStroke: fd.fpeMhStroke || false,
            mhCancer: fd.fpeMhCancer || false,
            mhTb: fd.fpeMhTb || false,
            mhKidney: fd.fpeMhKidney || false,
            mhNone: fd.fpeMhNone || false,
            fhHypertension: fd.fpeFhHypertension || false,
            fhDiabetes: fd.fpeFhDiabetes || false,
            fhHeart: fd.fpeFhHeart || false,
            fhCancer: fd.fpeFhCancer || false,
            fhNone: fd.fpeFhNone || false,
            shSmoking: fd.fpeShSmoking || 'No',
            shAlcohol: fd.fpeShAlcohol || 'No',
            shOccupation: fd.fpeShOccupation || '',
            medNone: fd.fpeMedNone || false,
            medSpecify: fd.fpeMedSpecify || '',
            vitalBp: fd.fpeVitalBp || '',
            vitalWt: fd.fpeVitalWt || '',
            vitalHt: fd.fpeVitalHt || '',
            vitalHr: fd.fpeVitalHr || '',
            vitalRr: fd.fpeVitalRr || '',
            vitalBmi: fd.fpeVitalBmi || '',
            vitalTemp: fd.fpeVitalTemp || '',
            vitalWaist: fd.fpeVitalWaist || '',
            vitalUpperArm: fd.fpeVitalUpperArm || '',
            vitalMidArm: fd.fpeVitalMidArm || '',
            physicalExam: fd.fpePhysicalExam || '',
            assessmentPlan: fd.fpeAssessmentPlan || ''
          },
          pcsfDetails: fd.pcsfDetails || {
            type: fd.pcsfType || 'MEMBER',
            date: fd.pcsfDate || '',
            fullName: fd.pcsfFullName || '',
            addressBarangay: fd.pcsfAddressBarangay || '',
            addressCity: fd.pcsfAddressCity || '',
            addressProvince: fd.pcsfAddressProvince || '',
            contactNo: fd.pcsfContactNo || '',
            email: fd.pcsfEmail || '',
            registerPcc: fd.pcsfRegisterPcc || '',
            registerDependents: fd.pcsfRegisterDependents || false,
            pcc1: fd.pcsfPcc1 || 'Saint Francis Clinic',
            pcc1Addr: fd.pcsfPcc1Addr || 'San Francisco, Pagadian City, Zamboanga del Sur',
            pcc2: fd.pcsfPcc2 || '',
            pcc2Addr: fd.pcsfPcc2Addr || '',
            transfer: fd.pcsfTransfer || false,
            prevPcc: fd.prevPcc || '',
            transferPcc1: fd.pcsfTransferPcc1 || '',
            transferPcc1Addr: fd.pcsfTransferPcc1Addr || '',
            transferPcc2: fd.pcsfTransferPcc2 || '',
            transferPcc2Addr: fd.pcsfTransferPcc2Addr || '',
            householdNumber: fd.pcsfHouseholdNumber || '',
            householdId: fd.pcsfHouseholdId || '',
            dependentId: fd.pcsfDependentId || '',
            memberCategory: fd.pcsfMemberCategory || 'Direct Contributor'
          }
        },
        membersData: fd.wizardMembers || [],
        dependentsData: fd.wizardDependents || []
      };

      // Send to server Add endpoint
      const res = await fetch('/api/households/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSubmissionStatusMsg('Synchronizing cloud index and cleaning disk caches...');

        // Success! Remove draft status and remove from local and server list
        if (draft.syncStatus === 'Synced') {
          // Delete from server drafts store
          await fetch('/api/drafts/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id: draft.id })
          }).catch(err => console.warn('Clean server drafts list post ignored.'));
        }

        const stored = localStorage.getItem('sfc_household_drafts');
        const allDrafts = stored ? JSON.parse(stored) : [];
        const updated = allDrafts.filter((x: any) => x.id !== draft.id);
        localStorage.setItem('sfc_household_drafts', JSON.stringify(updated));
        
        fetchLocalDrafts();
        await new Promise(resolve => setTimeout(resolve, 850));
        setIsSubmitting(false);
        showAlert('Registration Uploaded', `Household "${calculatedHeadName}" has been submitted for approval successfully into the Verification Queue.`, 'success');
      } else {
        setIsSubmitting(false);
        const errObj = await res.json();
        showAlert('Upload Failed', errObj.error || 'Failed to submit the household record to the database queue.', 'error');
      }
    } catch (e) {
      setIsSubmitting(false);
      console.error('Failed submitting draft:', e);
      showAlert('Connection Handshake Failed', 'An error occurred during communication. Check your local connection status.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewDraft = (type: 'PMRF' | 'DEPENDENTS' | 'MEMBERS') => {
    setShowAddDraftFileModal(false);
    
    const newDraftId = 'draft_' + Math.random().toString(36).substr(2, 9);
    const isFpePcsfOnly = (type !== 'PMRF');
    const isNewMemberFpe = (type === 'MEMBERS');
    
    const draftObj: any = {
      id: newDraftId,
      accountId: currentUser.email,
      residentialArea: currentUser.address || 'Unassigned Area',
      lastModified: new Date().toISOString(),
      status: 'Draft',
      syncStatus: 'Local Only',
      isFpePcsfOnly: isFpePcsfOnly,
      isNewMemberFpe: isNewMemberFpe,
      formData: {
        isFpePcsfOnly: isFpePcsfOnly,
        isNewMemberFpe: isNewMemberFpe,
        formHeadName: '',
        formContact: '',
        formBarangay: currentUser.address || '',
        formPurok: '',
        formLat: '7.828',
        formLng: '123.433',
        formPmrf: 'Pending',
        formYakap: 'Willing',
        pmrfPurpose: 'REGISTRATION',
        pmrfKonsulta: 'Saint Francis Clinic Provider',
        pmrfPin: '',
        pmrfLastName: '',
        pmrfFirstName: '',
        pmrfNameExt: '',
        pmrfMiddleName: '',
        pmrfMotherMaiden: '',
        pmrfSpouseName: '',
        pmrfBirthDate: '',
        pmrfBirthPlace: 'Pagadian City, Zamboanga del Sur',
        pmrfSex: 'Male',
        pmrfCivilStatus: 'Single',
        pmrfCitizenship: 'FILIPINO',
        pmrfPhilsysNo: '',
        pmrfTin: '',
        pmrfAddressUnit: '',
        pmrfAddressStreet: '',
        pmrfAddressSubdivision: '',
        pmrfAddressZip: '7016',
        pmrfMailSame: true,
        pmrfMailUnit: '',
        pmrfMailStreet: '',
        pmrfMailSubdivision: '',
        pmrfMailZip: '7016',
        pmrfHomePhone: '',
        pmrfMobileNo: '',
        pmrfBusinessDirect: '',
        pmrfEmail: '',
        pmrfContributorCategory: 'DIRECT',
        pmrfContributorType: 'Employed Private',
        pmrfProfession: 'Farmer',
        pmrfMonthlyIncome: '',
        pmrfProofOfIncome: '',
        wizardMembers: [],
        wizardDependents: [],
        attachmentsList: [],
        patientSignature: null
      }
    };

    onEditDraft(draftObj);
  };

  // Filter & Search Draft logic
  const filteredDrafts = drafts.filter((d: any) => {
    const fd = d.formData || {};
    const matchesSync = syncFilter === 'All' ? true : d.syncStatus === syncFilter;
    
    const headName = (fd.pmrfLastName && fd.pmrfFirstName 
      ? `${fd.pmrfLastName}, ${fd.pmrfFirstName}` 
      : (fd.pcsfFullName || fd.formHeadName || '')).toLowerCase();
    
    const hhNum = (fd.pcsfHouseholdNumber || '').toLowerCase();
    
    const street = (fd.pmrfAddressStreet || '').toLowerCase();
    const subdv = (fd.pmrfAddressSubdivision || '').toLowerCase();
    const address = `${street} ${subdv} ${d.residentialArea || ''}`.toLowerCase();

    const matchesSearch = 
      headName.includes(searchQuery.toLowerCase()) ||
      hhNum.includes(searchQuery.toLowerCase()) ||
      address.includes(searchQuery.toLowerCase());

    return matchesSync && matchesSearch;
  });

  // Sort Drafts
  const sortedAndFiltered = [...filteredDrafts].sort((a: any, b: any) => {
    const timeA = new Date(a.lastModified).getTime();
    const timeB = new Date(b.lastModified).getTime();
    return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
  });

  // Display connection indicator
  const getConnectionBadge = () => {
    if (connectionStatus === 'offline') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200">
          <WifiOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> 
          🔴 Offline
        </span>
      );
    } else if (connectionStatus === 'slow') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> 
          🟡 Slow Connection
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200">
          <Wifi className="w-3.5 h-3.5 text-emerald-500" /> 
          🟢 Online
        </span>
      );
    }
  };

  return (
    <div id="drafts-page-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      
      {/* TITLE HERO BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-xl border border-slate-800">
        {/* Subtle decorative spots background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))]" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-inner">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight font-sans text-white md:text-3xl">
                  Offline Draft Archive
                </h1>
                <p className="text-indigo-400 text-[10px] font-bold tracking-widest font-mono">
                  SECURED LOCAL ENCOUNTERS
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Household records, patient encounter details, and uploaded files are saved locally on this machine under your account ID: <strong className="text-indigo-300 font-mono select-all bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/30 break-all">{currentUser.email}</strong>. Once fully online, click sync to upload drafts to the main database.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex justify-center sm:justify-start">
              {getConnectionBadge()}
            </div>
            <button 
              id="add-drafts-button"
              onClick={() => setShowAddDraftFileModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 transition duration-150 shadow-md cursor-pointer w-full sm:w-auto hover:scale-102 active:scale-98"
            >
              <PlusCircle className="w-4 h-4 animate-bounce" />
              <span>Add Drafts</span>
            </button>
            <button 
              id="bulk-sync-button"
              onClick={handleBulkSync}
              disabled={isSyncing || connectionStatus === 'offline'}
              className="group flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 shadow-md shadow-indigo-950/25 cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
              <span>{isSyncing ? 'Synchronizing drafts...' : 'Sync Pending Drafts'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STATISTICS SUMMARY DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Drafts */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-slate-300 transition duration-150 flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Total Draft Profiles</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 font-sans">{drafts.length}</span>
              <span className="text-xs text-slate-400">stored</span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-500 block font-mono truncate">sfc_household_drafts</span>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 border border-slate-100 flex-shrink-0">
            <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
        </div>

        {/* Metric 2: Synced to Server */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-emerald-200 transition duration-150 flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Synced to Cloud</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-sans">
                {drafts.filter((d: any) => d.syncStatus === 'Synced').length}
              </span>
              <span className="text-xs text-emerald-500/80">active</span>
            </div>
            <span className="text-[10px] text-emerald-500 font-medium block truncate">Ready to submit</span>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 flex-shrink-0">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Metric 3: Pending Sync */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-amber-200 transition duration-150 flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Waiting to Sync</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-600 font-sans">
                {drafts.filter((d: any) => d.syncStatus !== 'Synced').length}
              </span>
              <span className="text-xs text-amber-600/80">pending</span>
            </div>
            <span className="text-[10px] text-amber-500 font-medium block truncate">Requires sync click</span>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100 flex-shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          </div>
        </div>

        {/* Metric 4: Members with Complete details */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:border-indigo-200 transition duration-150 flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate font-sans">Complete PMRF Members</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-indigo-600 font-sans">
                {drafts.filter((d: any) => {
                  const fd = d.formData || {};
                  return (fd.pmrfLastName?.trim() || fd.pmrfFirstName?.trim());
                }).length}
              </span>
              <span className="text-xs text-indigo-400">with details</span>
            </div>
            <span className="text-[10px] text-indigo-500 font-medium block truncate">Personal details completed</span>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 flex-shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & OPTION WORKSPACE */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Beautiful Search Input Field */}
        <div className="relative w-full lg:flex-1 lg:max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 text-slate-400" />
          <input
            id="drafts-search-input"
            type="text"
            placeholder="Search by Head, Number, Address or Barangay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 border border-slate-200/70 rounded-xl focus:outline-hidden focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150"
          />
        </div>
  
        {/* Filter & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          
          {/* Option Filters Group - Overflow swipe target on very narrow screens */}
          <div className="flex items-center bg-slate-50 border border-slate-200/70 rounded-xl p-1 text-xs overflow-x-auto whitespace-nowrap scrollbar-none w-full sm:w-auto max-w-full">
            {(['All', 'Local Only', 'Waiting for Sync', 'Synced'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSyncFilter(status)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-lg font-bold transition duration-100 cursor-pointer ${
                  syncFilter === status 
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-100' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Toggle Date Sort order */}
          <button
            id="toggle-sort-order"
            type="button"
            onClick={() => setSortBy(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition duration-150 w-full sm:w-auto text-center"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {sortBy === 'newest' ? 'NEWEST MODIFIED' : 'OLDEST MODIFIED'}
            </span>
          </button>

        </div>
      </div>

      {/* SYNC PROGRESS STATUS LOADER BAR */}
      {isSyncing && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 text-indigo-800 rounded-xl border border-indigo-100 animate-pulse shadow-2xs">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
          <p className="text-xs font-bold tracking-wide uppercase">
            {syncStatusMsg || 'Pushing local encounters online... Please wait.'}
          </p>
        </div>
      )}

      {/* DRAFTS LIST STAGE */}
      {sortedAndFiltered.length === 0 ? (
        <div className="bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 p-10 sm:p-16 text-center shadow-inner">
          <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-xs mx-auto mb-5">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-slate-300" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">No Draft Records Discovered</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            {searchQuery 
              ? 'We couldn\'t find any active drafts matching your query. Try broadening your terms or resetting status filter buttons.'
              : 'You do not have any pending household drafts logged. Created drafts are automatically secured on your local device.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {sortedAndFiltered.map((d) => {
              const fd = d.formData || {};
              const isFpePcsfOnly = fd.isFpePcsfOnly || false;
              const calculatedHeadName = fd.pmrfLastName && fd.pmrfFirstName 
                ? `${fd.pmrfLastName}, ${fd.pmrfFirstName}` 
                : (isFpePcsfOnly ? fd.pcsfFullName : fd.formHeadName) || 'Unnamed Head';

              const hhNum = fd.pcsfHouseholdNumber || 'Draft ID ' + d.id.slice(-6);
              const totalMembers = (fd.pmrfLastName?.trim() || fd.pmrfFirstName?.trim()) ? 1 : 0;
              const totalDependents = (fd.wizardDependents || []).length;
              const attCount = (fd.attachmentsList || []).length;

              // Render Sync status tag badge
              const getSyncStatusBadge = (status: string) => {
                switch(status) {
                  case 'Synced':
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-1 border border-emerald-100">
                        <CheckCircle className="w-3 h-3 text-emerald-500" /> Synced
                      </span>
                    );
                  case 'Waiting for Sync':
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-md px-2 py-1 border border-amber-100 animate-pulse">
                        <Clock className="w-3 h-3 text-amber-500" /> Waiting to Sync
                      </span>
                    );
                  default:
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-md px-2 py-1 border border-slate-200">
                        <Shield className="w-3 h-3 text-slate-500" /> Local Only
                      </span>
                    );
                }
              };

              // Top aesthetic border hover shadow styling
              const borderStyles = d.syncStatus === 'Synced' 
                ? 'hover:border-emerald-250 hover:shadow-emerald-50/50 hover:shadow-md' 
                : 'hover:border-indigo-250 hover:shadow-indigo-50/50 hover:shadow-md';

              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-white rounded-2.5xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-305 flex flex-col justify-between overflow-hidden relative ${borderStyles}`}
                >
                  
                  {/* Category Side Strip and Content Wrapper */}
                  <div className="p-4 sm:p-5 flex-1 space-y-4">
                    
                    {/* Header Row: Name & Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className={`inline-flex items-center text-[9px] font-mono tracking-wide px-2 py-0.5 rounded-md uppercase font-bold ${
                          isFpePcsfOnly 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {isFpePcsfOnly ? 'FPE / PCSF ONLY' : 'COMPLETE PMRF'}
                        </span>
                        <h2 className="text-base font-black text-slate-800 line-clamp-1 truncate select-all" title={calculatedHeadName}>
                          {calculatedHeadName}
                        </h2>
                        <span className="text-xs text-slate-400 font-mono block select-all truncate">
                          {hhNum}
                        </span>
                      </div>
                      
                      <div className="flex-shrink-0">
                        {getSyncStatusBadge(d.syncStatus)}
                      </div>
                    </div>

                    {/* Meta row: Location of registration & Last updated timestamp */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                      
                      <div className="flex items-center gap-1.5 text-slate-500 overflow-hidden">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium truncate" title={d.residentialArea || 'Unassigned Area'}>
                          {d.residentialArea || 'Unassigned Area'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 overflow-hidden justify-end">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-mono truncate text-right">
                          {new Date(d.lastModified).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>

                    </div>

                    {/* Stats Metrics for family & elements of draft */}
                    <div className="grid grid-cols-3 gap-1 p-2.5 sm:p-3 rounded-2xl bg-slate-50 text-xs text-slate-600 font-bold border border-slate-100 text-center">
                      
                      <div className="border-r border-slate-200">
                        <span className="block text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold truncate">PMRF Member</span>
                        <strong className="text-slate-800 text-xs sm:text-sm mt-0.5 block">{totalMembers}</strong>
                      </div>

                      <div className="border-r border-slate-200">
                        <span className="block text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold truncate">Dependents</span>
                        <strong className="text-slate-800 text-xs sm:text-sm mt-0.5 block">{totalDependents}</strong>
                      </div>

                      <div>
                        <span className="block text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold font-sans truncate">Files</span>
                        <strong className={`text-xs sm:text-sm mt-0.5 block truncate ${attCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          📎 {attCount}
                        </strong>
                      </div>

                    </div>

                  </div>

                  {/* Actions Drawer Bar */}
                  <div className="bg-slate-50 border-t border-slate-100 px-3 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between gap-2.5 sm:gap-3 text-xs">
                    
                    {/* Discard & Duplicate */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(d.id, d.syncStatus, calculatedHeadName)}
                        className="p-2 sm:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                        title="Permanently discard local draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleDuplicateDraft(d)}
                        className="p-2 sm:p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                        title="Clone draft profile"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Continue Form Completion or Sync & Submit validation */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial justify-end">
                      <button
                        type="button"
                        onClick={() => onEditDraft(d)}
                        className="flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-2 font-bold text-slate-705 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition duration-150 shadow-2xs hover:shadow-xs cursor-pointer text-[11px] sm:text-xs flex-1 sm:flex-initial"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Continue</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleSubmitDraft(d)}
                        disabled={connectionStatus === 'offline'}
                        className="flex items-center justify-center gap-1 px-3 sm:px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-55 disabled:cursor-not-allowed rounded-xl transition duration-150 shadow-sm shadow-emerald-900/10 cursor-pointer text-[11px] sm:text-xs flex-1 sm:flex-initial"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit</span>
                      </button>
                    </div>

                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Alert modal portal portal code */}
      {alertState && alertState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-100 text-center space-y-4">
            
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 border">
              {alertState.type === 'success' && <CheckCircle className="h-6 w-6 text-emerald-500" />}
              {alertState.type === 'error' && <AlertTriangle className="h-6 w-6 text-red-500" />}
              {alertState.type === 'info' && <FileText className="h-6 w-6 text-indigo-500" />}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800">{alertState.title}</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{alertState.description}</p>
            </div>

            <button
              onClick={() => setAlertState(null)}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Draft Deletion Confirmation Modal Overlay */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="mx-auto sm:mx-0 flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-rose-50 border border-rose-100">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div className="space-y-1.5 flex-1 text-left">
                <h3 className="text-base font-extrabold text-slate-900">Delete Household Draft?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to permanently delete the draft record for <strong className="text-slate-800 font-bold">{deleteConfirm.headName || 'Unnamed Head'}</strong>. This action cannot be undone and will erase all associated form progress.
                </p>
              </div>
            </div>

            {deleteConfirm.syncStatus === 'Synced' && (
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 flex gap-2 text-[11px] text-amber-801 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> This draft has already been synchronized to the cloud. Deleting it will also remove its corresponding remote reference securely.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="w-full sm:w-1/2 py-2.5 px-4 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-center"
              >
                Cancel, Keep Draft
              </button>
              <button
                type="button"
                onClick={() => executeDeleteDraft(deleteConfirm.id, deleteConfirm.syncStatus)}
                className="w-full sm:w-1/2 py-2.5 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition duration-150 cursor-pointer shadow-sm shadow-rose-900/15 text-center"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN SUBMISSION LOADING OVERLAY */}
      {isSubmitting && (
        <div id="draft-submission-loader" className="fixed inset-0 z-[9999] bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-100 rounded-full blur-xl animate-pulse"></div>
              <div className="relative w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Activity className="w-8 h-8 text-white animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                <RefreshCw className="w-2.5 h-2.5 text-white animate-spin" />
              </div>
            </div>
            
            <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">
              {submissionTitle || 'Submitting Draft File'}
            </h3>
            
            <p className="text-slate-500 text-xs leading-relaxed max-w-[240px] mb-4">
              Please keep this window open and do not close or refresh your browser while we sync.
            </p>
 
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-4 relative">
              <div className="bg-indigo-600 h-full rounded-full animate-pulse" style={{ width: '75%' }}></div>
            </div>
 
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 py-1 px-3 rounded-full border border-indigo-100">
              {submissionStatusMsg}
            </span>
          </div>
        </div>
      )}

      {/* ADD DRAFT FILE SELECTION MODAL */}
      {showAddDraftFileModal && (
        <div id="add-draft-file-selection-modal" className="fixed inset-0 z-[19000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setShowAddDraftFileModal(false)}></div>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl relative max-w-lg w-full overflow-hidden p-6 z-[19001] animate-fade-in animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Select Draft Action Mode</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Choose the registration mode you want to start as a local draft</p>
              </div>
              <button 
                onClick={() => setShowAddDraftFileModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* PMRF square button */}
              <button
                id="btn-modal-add-draft-pmrf"
                onClick={() => handleCreateNewDraft('PMRF')}
                className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-400 rounded-2xl transition duration-150 group cursor-pointer text-center space-y-3.5 shadow-sm hover:shadow-md h-[150px] w-full animate-pulse-light"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition duration-150">
                  <FolderPlus className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">PMRF</span>
                </div>
              </button>
 
              {/* PCSF/FPE Dependents square button */}
              <button
                id="btn-modal-add-draft-dependents"
                onClick={() => handleCreateNewDraft('DEPENDENTS')}
                className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-400 rounded-2xl transition duration-150 group cursor-pointer text-center space-y-3.5 shadow-sm hover:shadow-md h-[150px] w-full animate-pulse-light"
              >
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition duration-150">
                  <FileHeart className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">PCSF/FPE Dependents</span>
                </div>
              </button>
 
              {/* PCSF/FPE Members square button */}
              <button
                id="btn-modal-add-draft-members"
                onClick={() => handleCreateNewDraft('MEMBERS')}
                className="flex flex-col items-center justify-center p-5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-400 rounded-2xl transition duration-150 group cursor-pointer text-center space-y-3.5 shadow-sm hover:shadow-md h-[150px] w-full animate-pulse-light"
              >
                <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-105 transition duration-150">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">PCSF/FPE Members</span>
                </div>
              </button>
            </div>
            
            <div className="mt-5 pt-3 border-t border-slate-100 text-center flex items-center justify-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Saint Francis Health Center Offline Storage</p>
            </div>
          </div>
        </div>
      )}
 
    </div>
  );
}
