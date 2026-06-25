import React, { useState, useEffect } from 'react';
import { PhilHealthLogo } from './PhilHealthLogo';
import { FileDown, Loader2, RotateCcw, ChevronDown, FileText, Camera } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface BlankFormsProps {
  currentUser: any;
}

export default function BlankForms({ currentUser }: BlankFormsProps) {
  const [activeFormTab, setActiveFormTab] = useState<'PMRF' | 'FPE' | 'PCSF'>('PMRF');
  const [pmrfSubTab, setPmrfSubTab] = useState<'FRONT' | 'BACK'>('FRONT');
  const [showFormsDropdown, setShowFormsDropdown] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isCapturingImages, setIsCapturingImages] = useState(false);

  // Intelligent lookup and duplicate prevention states
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' | '' }>({ text: '', type: '' });
  const [matchingRecords, setMatchingRecords] = useState<any[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [skipSearch, setSkipSearch] = useState(false);
  const [autoSaveRef, setAutoSaveRef] = useState<any>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateRecord, setDuplicateRecord] = useState<any>(null);

  // PMRF States
  const [pmrfPin, setPmrfPin] = useState('');
  const [pmrfPurpose, setPmrfPurpose] = useState<'REGISTRATION' | 'UPDATING' | ''>('');
  const [pmrfKonsulta, setPmrfKonsulta] = useState('');
  
  // Section I - Personal
  const [pmrfLastName, setPmrfLastName] = useState('');
  const [pmrfFirstName, setPmrfFirstName] = useState('');
  const [pmrfNameExt, setPmrfNameExt] = useState('');
  const [pmrfMiddleName, setPmrfMiddleName] = useState('');
  const [pmrfNoMiddleName, setPmrfNoMiddleName] = useState(false);
  const [pmrfMononym, setPmrfMononym] = useState(false);

  // Mother details
  const [pmrfMotherLastName, setPmrfMotherLastName] = useState('');
  const [pmrfMotherFirstName, setPmrfMotherFirstName] = useState('');
  const [pmrfMotherNameExt, setPmrfMotherNameExt] = useState('');
  const [pmrfMotherMiddleName, setPmrfMotherMiddleName] = useState('');
  const [pmrfMotherNoMN, setPmrfMotherNoMN] = useState(false);
  const [pmrfMotherMononym, setPmrfMotherMononym] = useState(false);

  // Spouse details
  const [pmrfSpouseLastName, setPmrfSpouseLastName] = useState('');
  const [pmrfSpouseFirstName, setPmrfSpouseFirstName] = useState('');
  const [pmrfSpouseNameExt, setPmrfSpouseNameExt] = useState('');
  const [pmrfSpouseMiddleName, setPmrfSpouseMiddleName] = useState('');
  const [pmrfSpouseNoMN, setPmrfSpouseNoMN] = useState(false);
  const [pmrfSpouseMononym, setPmrfSpouseMononym] = useState(false);

  // Personal Info Extras
  const [pmrfBirthDate, setPmrfBirthDate] = useState('');
  const [pmrfBirthPlace, setPmrfBirthPlace] = useState('');
  const [pmrfSex, setPmrfSex] = useState<'MALE' | 'FEMALE' | ''>('');
  const [pmrfCivilStatus, setPmrfCivilStatus] = useState<'SINGLE' | 'MARRIED' | 'ANNULLED' | 'WIDOWER' | 'LEGALLY_SEPARATED' | ''>('');
  const [pmrfCitizenship, setPmrfCitizenship] = useState<'FILIPINO' | 'FOREIGN_NATIONAL' | 'DUAL_CITIZEN' | ''>('');
  const [pmrfPhilsysNo, setPmrfPhilsysNo] = useState('');
  const [pmrfTin, setPmrfTin] = useState('');

  // Section II - Contact
  const [pmrfAddressUnit, setPmrfAddressUnit] = useState('');
  const [pmrfAddressBuilding, setPmrfAddressBuilding] = useState('');
  const [pmrfAddressLot, setPmrfAddressLot] = useState('');
  const [pmrfAddressStreet, setPmrfAddressStreet] = useState('');
  const [pmrfAddressSubdivision, setPmrfAddressSubdivision] = useState('');
  const [pmrfAddressBarangay, setPmrfAddressBarangay] = useState(currentUser?.address || 'San Francisco');
  const [pmrfAddressMunicipality, setPmrfAddressMunicipality] = useState('Pagadian City');
  const [pmrfAddressProvince, setPmrfAddressProvince] = useState('Zamboanga del Sur');
  const [pmrfAddressZip, setPmrfAddressZip] = useState('7016');
  const [pmrfHomePhone, setPmrfHomePhone] = useState('');
  const [pmrfMobileNo, setPmrfMobileNo] = useState('');
  const [pmrfBusinessPhone, setPmrfBusinessPhone] = useState('');
  const [pmrfEmail, setPmrfEmail] = useState('');

  // Mailing address (if different)
  const [pmrfMailingSame, setPmrfMailingSame] = useState(true);
  const [pmrfMailingUnit, setPmrfMailingUnit] = useState('');
  const [pmrfMailingBuilding, setPmrfMailingBuilding] = useState('');
  const [pmrfMailingLot, setPmrfMailingLot] = useState('');
  const [pmrfMailingStreet, setPmrfMailingStreet] = useState('');
  const [pmrfMailingSubdivision, setPmrfMailingSubdivision] = useState('');
  const [pmrfMailingBarangay, setPmrfMailingBarangay] = useState('');
  const [pmrfMailingMunicipality, setPmrfMailingMunicipality] = useState('');
  const [pmrfMailingProvince, setPmrfMailingProvince] = useState('');
  const [pmrfMailingZip, setPmrfMailingZip] = useState('');

  // Section III - Dependents List
  const [pmrfDependents, setPmrfDependents] = useState<any[]>([
    { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
    { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
    { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
    { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false }
  ]);

  // Section IV - Member Type
  const [pmrfMemberType, setPmrfMemberType] = useState<any>({
    category: '', // 'DIRECT' | 'INDIRECT'
    subCategory: '', // 'EMPLOYED_PRIVATE', 'EMPLOYED_GOV', 'PROF_PRACTITIONER', 'SELF_EARNING', 'KASAMBAHAY', 'MIGRANT_LAND', 'MIGRANT_SEA', 'LIFETIME', 'FILIPINO_DUAL', 'FOREIGN', 'FAMILY_DRIVER', 'LISTAHANAN', 'FOURPS', 'SENIOR', 'PAMANA', 'KIA_KIPO', 'BANGSAMORO', 'LGU_SPONSORED', 'NGA_SPONSORED', 'PRIVATE_SPONSORED', 'PWD'
    profession: '',
    monthlyIncome: '',
    proofOfIncome: '',
    pwdIdNo: ''
  });

  // Section V - Updating / Amendment
  const [pmrfAmendments, setPmrfAmendments] = useState<any>({
    name: { checked: false, from: '', to: '' },
    dob: { checked: false, from: '', to: '' },
    sex: { checked: false, from: '', to: '' },
    civilStatus: { checked: false, from: '', to: '' },
    personalInfo: { checked: false, from: '', to: '' }
  });

  // Section V - Under penalty / Attestation signature and dates
  const [pmrfAttestSignature, setPmrfAttestSignature] = useState('');
  const [pmrfAttestDate, setPmrfAttestDate] = useState('');
  const [pmrfSignatureImage, setPmrfSignatureImage] = useState('');

  // Section V - Received By
  const [pmrfReceivedBy, setPmrfReceivedBy] = useState({
    fullName: '',
    proLhioBranch: '',
    dateTime: ''
  });

  // FPE States
  const [fpeDateOfEncounter, setFpeDateOfEncounter] = useState('');
  const [fpePatientName, setFpePatientName] = useState('');
  const [fpeFamilyRole, setFpeFamilyRole] = useState<'HEAD' | 'SPOUSE' | 'DEPENDENT' | ''>('');
  const [fpeAge, setFpeAge] = useState('');
  const [fpeBirthDate, setFpeBirthDate] = useState('');
  const [fpeSex, setFpeSex] = useState<'MALE' | 'FEMALE' | ''>('');
  const [fpeCivilStatus, setFpeCivilStatus] = useState('');
  const [fpePhilhealthNo, setFpePhilhealthNo] = useState('');
  const [fpeCitizenship, setFpeCitizenship] = useState('Filipino');
  const [fpeContactNo, setFpeContactNo] = useState('');
  const [fpeAddress, setFpeAddress] = useState('');
  
  // FPE Medical History
  const [fpeChiefComplaint, setFpeChiefComplaint] = useState('');
  const [fpeBloodPressure, setFpeBloodPressure] = useState('');
  const [fpeTemperature, setFpeTemperature] = useState('');
  const [fpeHeartRate, setFpeHeartRate] = useState('');
  const [fpeRespiratoryRate, setFpeRespiratoryRate] = useState('');
  const [fpeWeight, setFpeWeight] = useState('');
  const [fpeHeight, setFpeHeight] = useState('');
  const [fpeBmi, setFpeBmi] = useState('');

  // Medical Histories checked
  const [fpeHistoryAsthma, setFpeHistoryAsthma] = useState(false);
  const [fpeHistoryHypertension, setFpeHistoryHypertension] = useState(false);
  const [fpeHistoryDiabetes, setFpeHistoryDiabetes] = useState(false);
  const [fpeHistoryCancer, setFpeHistoryCancer] = useState(false);
  const [fpeHistoryHeartDisease, setFpeHistoryHeartDisease] = useState(false);
  const [fpeHistoryOthers, setFpeHistoryOthers] = useState('');

  // PCSF States
  const [pcsfHeadName, setPcsfHeadName] = useState('');
  const [pcsfPatientName, setPcsfPatientName] = useState('');
  const [pcsfRelationToHead, setPcsfRelationToHead] = useState('');
  const [pcsfBirthDate, setPcsfBirthDate] = useState('');
  const [pcsfSex, setPcsfSex] = useState<'MALE' | 'FEMALE' | ''>('');
  const [pcsfPhilhealthNo, setPcsfPhilhealthNo] = useState('');
  const [pcsfBarangay, setPcsfBarangay] = useState(currentUser?.address || 'San Francisco');
  const [pcsfPurok, setPcsfPurok] = useState('');
  const [pcsfAddress, setPcsfAddress] = useState('');
  const [pcsfProviderName, setPcsfProviderName] = useState('SAINT FRANCIS CLINIC');
  const [pcsfEnrollDate, setPcsfEnrollDate] = useState('');
  const [pcsfContactNo, setPcsfContactNo] = useState('');
  const [pcsfEmail, setPcsfEmail] = useState('');

  useEffect(() => {
    if (currentUser?.address) {
      setPmrfAddressBarangay(currentUser.address);
      setPcsfBarangay(currentUser.address);
    }
  }, [currentUser]);

  // -------------------------------------------------------------------------
  // INTELLIGENT LOOKUP, AUTO-FILL, AND DUPLICATE PREVENTION LOGIC
  // -------------------------------------------------------------------------
  const autoFillFromRecord = (record: any) => {
    const details = record.pmrfDetails || {};

    setSkipSearch(true);
    if (details.pin) setPmrfPin(details.pin);
    setPmrfPurpose(details.purpose || 'REGISTRATION');
    setPmrfKonsulta(details.konsulta || '');

    // Parse and resolve LastName, FirstName, MiddleName, and NameExt
    let calculatedLastName = details.lastName || record.lastName || '';
    let calculatedFirstName = details.firstName || record.firstName || '';
    let calculatedMiddleName = details.middleName || record.middleName || '';
    let calculatedNameExt = details.nameExt || record.nameExt || '';

    if (!calculatedLastName && !calculatedFirstName && record.householdHead) {
      const rawHead = record.householdHead;
      if (rawHead.includes(',')) {
        const commaParts = rawHead.split(',');
        calculatedLastName = commaParts[0].trim();
        const firstAndRest = commaParts[1].trim();
        const spaceParts = firstAndRest.split(/\s+/);
        if (spaceParts.length === 1) {
          calculatedFirstName = spaceParts[0];
        } else if (spaceParts.length === 2) {
          calculatedFirstName = spaceParts[0];
          calculatedMiddleName = spaceParts[1];
        } else {
          const potentialSuffix = spaceParts[spaceParts.length - 1];
          const suffixes = ['JR', 'SR', 'I', 'II', 'III', 'IV', 'V', 'JR.', 'SR.', 'PHD', 'MD'];
          if (suffixes.includes(potentialSuffix.toUpperCase())) {
            calculatedNameExt = potentialSuffix;
            calculatedMiddleName = spaceParts.slice(1, spaceParts.length - 1).join(' ');
            calculatedFirstName = spaceParts[0];
          } else {
            calculatedFirstName = spaceParts[0];
            calculatedMiddleName = spaceParts.slice(1).join(' ');
          }
        }
      } else {
        const spaceParts = rawHead.split(/\s+/);
        if (spaceParts.length === 1) {
          calculatedFirstName = spaceParts[0];
        } else if (spaceParts.length === 2) {
          calculatedFirstName = spaceParts[0];
          calculatedLastName = spaceParts[1];
        } else {
          calculatedLastName = spaceParts[spaceParts.length - 1];
          calculatedFirstName = spaceParts[0];
          calculatedMiddleName = spaceParts.slice(1, spaceParts.length - 1).join(' ');
        }
      }
    }

    setPmrfLastName(calculatedLastName);
    setPmrfFirstName(calculatedFirstName);
    setPmrfNameExt(calculatedNameExt);
    setPmrfMiddleName(calculatedMiddleName);
    setPmrfNoMiddleName(details.noMiddleName || !calculatedMiddleName);
    setPmrfMononym(details.mononym || false);

    // Mother's Maiden
    if (details.pmrfMotherLastName) {
      setPmrfMotherLastName(details.pmrfMotherLastName);
      setPmrfMotherFirstName(details.pmrfMotherFirstName || '');
      setPmrfMotherMiddleName(details.pmrfMotherMiddleName || '');
      setPmrfMotherNameExt(details.pmrfMotherNameExt || '');
      setPmrfMotherNoMN(details.pmrfMotherNoMN || false);
      setPmrfMotherMononym(details.pmrfMotherMononym || false);
    } else if (details.motherMaiden) {
      const parts = (details.motherMaiden || '').split(',').map((p: string) => p.trim());
      if (parts.length >= 2) {
        setPmrfMotherLastName(parts[0]);
        setPmrfMotherFirstName(parts[1]);
        setPmrfMotherMiddleName(parts[2] || '');
        setPmrfMotherNameExt(parts[3] || '');
      } else {
        setPmrfMotherLastName(details.motherMaiden);
      }
    }

    // Spouse Name
    if (details.pmrfSpouseLastName) {
      setPmrfSpouseLastName(details.pmrfSpouseLastName);
      setPmrfSpouseFirstName(details.pmrfSpouseFirstName || '');
      setPmrfSpouseMiddleName(details.pmrfSpouseMiddleName || '');
      setPmrfSpouseNameExt(details.pmrfSpouseNameExt || '');
      setPmrfSpouseNoMN(details.pmrfSpouseNoMN || false);
      setPmrfSpouseMononym(details.pmrfSpouseMononym || false);
    } else if (details.spouseName) {
      const parts = (details.spouseName || '').split(',').map((p: string) => p.trim());
      if (parts.length >= 2) {
        setPmrfSpouseLastName(parts[0]);
        setPmrfSpouseFirstName(parts[1]);
        setPmrfSpouseMiddleName(parts[2] || '');
        setPmrfSpouseNameExt(parts[3] || '');
      } else {
        setPmrfSpouseLastName(details.spouseName);
      }
    }

    setPmrfBirthDate(details.birthDate || details.pmrfBirthDate || '');
    setPmrfBirthPlace(details.birthPlace || '');
    
    const s = (details.sex || '').toUpperCase();
    setPmrfSex(s === 'MALE' || s === 'FEMALE' ? s : '');

    const cs = (details.civilStatus || '').toUpperCase().replace(' ', '_');
    const validCS = ['SINGLE', 'MARRIED', 'ANNULLED', 'WIDOWER', 'WIDOWED', 'LEGALLY_SEPARATED'];
    if (validCS.includes(cs)) {
      setPmrfCivilStatus(cs === 'WIDOWED' ? 'WIDOWER' : cs as any);
    } else {
      setPmrfCivilStatus('');
    }

    const cit = (details.citizenship || '').toUpperCase().replace(' ', '_');
    const validCit = ['FILIPINO', 'FOREIGN_NATIONAL', 'DUAL_CITIZEN'];
    if (validCit.includes(cit)) {
      setPmrfCitizenship(cit as any);
    } else {
      setPmrfCitizenship('');
    }

    setPmrfPhilsysNo(details.philsysNo || '');
    setPmrfTin(details.tin || '');

    // Permanent Address
    setPmrfAddressUnit(details.addressUnit || details.unitRoomFloor || '');
    setPmrfAddressBuilding(details.addressBuilding || details.buildingName || '');
    setPmrfAddressLot(details.addressLot || details.lotBlockPhase || '');
    setPmrfAddressStreet(details.addressStreet || details.streetName || '');
    setPmrfAddressSubdivision(details.addressSubdivision || details.subdivisionName || '');
    setPmrfAddressBarangay(details.addressBarangay || record.barangay || 'San Francisco');
    setPmrfAddressMunicipality(details.addressMunicipality || record.purok || 'Pagadian City');
    setPmrfAddressProvince(details.addressProvince || 'Zamboanga del Sur');
    setPmrfAddressZip(details.addressZip || '7016');

    // Contact Numbers
    setPmrfHomePhone(details.homePhone || '');
    setPmrfMobileNo(details.mobileNo || details.pmrfMobileNo || record.contactNumber || '');
    setPmrfBusinessPhone(details.businessPhone || details.businessDirect || '');
    setPmrfEmail(details.email || '');

    // Mailing Same / Mailing address
    const same = details.mailSame !== false && details.pmrfMailingSame !== false;
    setPmrfMailingSame(same);
    setPmrfMailingUnit(details.mailUnit || '');
    setPmrfMailingBuilding(details.mailBuilding || '');
    setPmrfMailingLot(details.mailLot || '');
    setPmrfMailingStreet(details.mailStreet || '');
    setPmrfMailingSubdivision(details.mailSubdivision || '');
    setPmrfMailingBarangay(details.mailBarangay || '');
    setPmrfMailingMunicipality(details.mailMunicipality || '');
    setPmrfMailingProvince(details.mailProvince || '');
    setPmrfMailingZip(details.mailZip || '');

    // Dependents array loading
    if (record.dependents && Array.isArray(record.dependents)) {
      const formatted = record.dependents.map((d: any) => ({
        lastName: d.lastName || '',
        firstName: d.firstName || '',
        nameExt: d.nameExt || '',
        middleName: d.middleName || '',
        noMn: d.noMiddleName || d.noMn || false,
        mononym: d.mononym || false,
        relationship: d.relationship || '',
        birthDate: d.birthDate || d.birthdate || '',
        citizenship: d.citizenship || 'FILIPINO',
        disabled: d.isDisabled || d.disabled || false
      }));
      while (formatted.length < 4) {
        formatted.push({ lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false });
      }
      setPmrfDependents(formatted.slice(0, 4));
    } else if (details.dependents && Array.isArray(details.dependents)) {
      const formatted = details.dependents.map((d: any) => ({
        lastName: d.lastName || '',
        firstName: d.firstName || '',
        nameExt: d.nameExt || '',
        middleName: d.middleName || '',
        noMn: d.noMiddleName || d.noMn || false,
        mononym: d.mononym || false,
        relationship: d.relationship || '',
        birthDate: d.birthDate || d.birthdate || '',
        citizenship: d.citizenship || 'FILIPINO',
        disabled: d.isDisabled || d.disabled || false
      }));
      while (formatted.length < 4) {
        formatted.push({ lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false });
      }
      setPmrfDependents(formatted.slice(0, 4));
    }

    // Member Type Category
    if (details.contributorCategory || details.category) {
      setPmrfMemberType({
        category: details.contributorCategory || details.category || '',
        subCategory: details.contributorType || details.subCategory || '',
        profession: details.profession || '',
        monthlyIncome: details.monthlyIncome || '',
        proofOfIncome: details.proofOfIncome || '',
        pwdIdNo: details.pwdIdNo || ''
      });
    }

    // Populate Section V / PMRF BACK states
    if (details.pmrfAmendments) {
      setPmrfAmendments(details.pmrfAmendments);
    } else {
      setPmrfAmendments({
        name: { checked: false, from: '', to: '' },
        dob: { checked: false, from: '', to: '' },
        sex: { checked: false, from: '', to: '' },
        civilStatus: { checked: false, from: '', to: '' },
        personalInfo: { checked: false, from: '', to: '' }
      });
    }

    const calculatedFullName = `${calculatedFirstName} ${calculatedMiddleName ? calculatedMiddleName + ' ' : ''}${calculatedLastName}${calculatedNameExt ? ' ' + calculatedNameExt : ''}`.trim().toUpperCase();
    
    setPmrfAttestSignature(details.pmrfAttestSignature || calculatedFullName);
    setPmrfSignatureImage(record.patientSignature || details.patientSignature || record.signature || '');
    setPmrfAttestDate(details.pmrfAttestDate || new Date().toISOString().split('T')[0]);

    setPmrfReceivedBy(details.pmrfReceivedBy || {
      fullName: details.receivedByFullName || '',
      proLhioBranch: details.receivedByBranch || '',
      dateTime: details.receivedByDateTime || ''
    });

    // Set auto-save reference audit metadata
    setAutoSaveRef({
      sourceRecordId: record.id || '',
      pinNumber: details.pin || '',
      memberId: record.id || '',
      dateRetrieved: new Date().toISOString(),
      userRetrievedBy: currentUser?.fullName || currentUser?.email || 'Officer'
    });

    // Populate FPE & PCSF states
    const fpePurokPart = record.purok || '';
    const fpeBarangayPart = record.barangay || '';
    const constructedAddr = [
      details.addressUnit || details.unitRoomFloor || '',
      details.addressLot || details.lotBlockPhase || '',
      details.addressStreet || details.streetName || '',
      details.addressSubdivision || details.subdivisionName || '',
      details.addressBarangay || fpeBarangayPart,
      details.purok || details.addressMunicipality || fpePurokPart || 'Pagadian City',
      details.addressProvince || 'Zamboanga del Sur'
    ].map(s => s && typeof s === 'string' ? s.trim() : '').filter(Boolean).join(', ');

    setFpePatientName(calculatedFullName);
    setFpeBirthDate(details.birthDate || details.pmrfBirthDate || '');
    const validFpeSex = s === 'MALE' || s === 'FEMALE' ? s : '';
    setFpeSex(validFpeSex);
    setFpeCivilStatus(cs || details.civilStatus || '');
    setFpePhilhealthNo(details.pin || pmrfPin || '');
    setFpeContactNo(details.mobileNo || details.pmrfMobileNo || record.contactNumber || '');
    setFpeAddress(constructedAddr);

    if (record.age) {
      setFpeAge(String(record.age));
    } else if (details.birthDate || details.pmrfBirthDate) {
      const bDate = new Date(details.birthDate || details.pmrfBirthDate);
      if (!isNaN(bDate.getTime())) {
        const diffMs = Date.now() - bDate.getTime();
        const ageDate = new Date(diffMs);
        setFpeAge(String(Math.abs(ageDate.getUTCFullYear() - 1970)));
      }
    }

    setPcsfHeadName(record.householdHead || calculatedFullName);
    setPcsfPatientName(calculatedFullName);
    setPcsfRelationToHead(record.relationToHead || 'SELF');
    setPcsfBirthDate(details.birthDate || details.pmrfBirthDate || '');
    setPcsfSex(validFpeSex);
    setPcsfPhilhealthNo(details.pin || pmrfPin || '');
    setPcsfContactNo(details.mobileNo || details.pmrfMobileNo || record.contactNumber || '');
    setPcsfEmail(details.email || '');
    setPcsfAddress(constructedAddr);
  };

  const clearFormAfterNoMatch = () => {
    setPmrfPurpose('');
    setPmrfKonsulta('');
    setPmrfNameExt('');
    setPmrfNoMiddleName(false);
    setPmrfMononym(false);

    // Mother's Maiden
    setPmrfMotherLastName('');
    setPmrfMotherFirstName('');
    setPmrfMotherMiddleName('');
    setPmrfMotherNameExt('');
    setPmrfMotherNoMN(false);
    setPmrfMotherMononym(false);

    // Spouse Name
    setPmrfSpouseLastName('');
    setPmrfSpouseFirstName('');
    setPmrfSpouseMiddleName('');
    setPmrfSpouseNameExt('');
    setPmrfSpouseNoMN(false);
    setPmrfSpouseMononym(false);

    setPmrfBirthDate('');
    setPmrfBirthPlace('');
    setPmrfSex('');
    setPmrfCivilStatus('');
    setPmrfCitizenship('');
    setPmrfPhilsysNo('');
    setPmrfTin('');

    // Permanent Address
    setPmrfAddressUnit('');
    setPmrfAddressBuilding('');
    setPmrfAddressLot('');
    setPmrfAddressStreet('');
    setPmrfAddressSubdivision('');
    setPmrfAddressBarangay('San Francisco');
    setPmrfAddressMunicipality('Pagadian City');
    setPmrfAddressProvince('Zamboanga del Sur');
    setPmrfAddressZip('7016');

    // Contact Numbers
    setPmrfHomePhone('');
    setPmrfMobileNo('');
    setPmrfBusinessPhone('');
    setPmrfEmail('');

    // Mailing Same / Mailing address
    setPmrfMailingSame(true);
    setPmrfMailingUnit('');
    setPmrfMailingBuilding('');
    setPmrfMailingLot('');
    setPmrfMailingStreet('');
    setPmrfMailingSubdivision('');
    setPmrfMailingBarangay('');
    setPmrfMailingMunicipality('');
    setPmrfMailingProvince('');
    setPmrfMailingZip('');

    // Dependents array loading
    setPmrfDependents([
      { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
      { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
      { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
      { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false }
    ]);

    // Member Type Category
    setPmrfMemberType({
      category: '',
      subCategory: '',
      profession: '',
      monthlyIncome: '',
      proofOfIncome: '',
      pwdIdNo: ''
    });

    setPmrfAttestSignature('');
    setPmrfSignatureImage('');
    setPmrfAttestDate('');

    setPmrfReceivedBy({
      fullName: '',
      proLhioBranch: '',
      dateTime: ''
    });

    setAutoSaveRef(null);
    setFpeAddress('');
    setPcsfAddress('');
    setPcsfPurok('');
  };

  useEffect(() => {
    // If we are on mobile, completely disable/skip Smart Auto-Fill Lookup as requested
    if (window.innerWidth < 768) {
      return;
    }

    if (skipSearch) {
      setSkipSearch(false);
      return;
    }

    const pinClean = pmrfPin.replace(/[^0-9]/g, '');
    const nameClean = (pmrfLastName + pmrfFirstName).trim();

    if (pinClean.length < 3 && nameClean.length < 3) {
      setLookupMessage({ text: '', type: '' });
      setMatchingRecords([]);
      return;
    }

    setSearchLoading(true);
    setLookupMessage({ text: 'Searching PMRF database and household registry...', type: 'info' });

    const delayDebounceFn = setTimeout(async () => {
      try {
        let url = `/api/pmrf/search?`;
        if (pinClean.length >= 3) {
          url += `pin=${encodeURIComponent(pmrfPin)}`;
        } else if (nameClean.length >= 3) {
          const fullNameQuery = `${pmrfLastName} ${pmrfFirstName}`.trim();
          url += `name=${encodeURIComponent(fullNameQuery)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to search records');
        const data = await res.json();

        setSearchLoading(false);

        if (data && data.length > 0) {
          setMatchingRecords(data);
          
          if (pinClean.length >= 10 || (pinClean.length >= 3 && data.length === 1)) {
            const exactMatch = data[0]; 
            setLookupMessage({ text: 'Record Found', type: 'success' });
            setSkipSearch(true);
            autoFillFromRecord(exactMatch);
          } else {
            if (data.length === 1) {
              setLookupMessage({ text: 'Record Found', type: 'success' });
              setSkipSearch(true);
              autoFillFromRecord(data[0]);
            } else {
              setLookupMessage({ text: `Multiple matching members found (${data.length}). Please select correct record.`, type: 'info' });
              setShowMatchModal(true);
            }
          }
        } else {
          setMatchingRecords([]);
          setLookupMessage({ text: 'No Record Found', type: 'error' });
          clearFormAfterNoMatch();
        }
      } catch (err) {
        console.error('Lookup search error:', err);
        setSearchLoading(false);
        setLookupMessage({ text: 'Network offline. Manual registration entry mode active.', type: 'info' });
      }
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [pmrfPin, pmrfLastName, pmrfFirstName, pmrfMiddleName]);

  const handleSavePMRF = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!pmrfLastName || !pmrfFirstName) {
      alert("Please enter at least the Member's Last Name and First Name.");
      return;
    }

    try {
      const checkRes = await fetch('/api/pmrf/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pmrfPin,
          lastName: pmrfLastName,
          firstName: pmrfFirstName,
          birthDate: pmrfBirthDate
        })
      });

      if (!checkRes.ok) throw new Error('Duplicate checking failed');
      const checkResult = await checkRes.json();

      if (checkResult.exists) {
        setDuplicateRecord(checkResult);
        setShowDuplicateModal(true);
        return;
      }

      await performCommitPMRF(null);
    } catch (err) {
      console.error('Duplicate checking error:', err);
      await performCommitPMRF(null);
    }
  };

  const performCommitPMRF = async (existingId: string | null) => {
    try {
      const pmrfDetailsPayload: any = {
        purpose: pmrfPurpose,
        konsulta: pmrfKonsulta,
        pin: pmrfPin,
        lastName: pmrfLastName,
        firstName: pmrfFirstName,
        nameExt: pmrfNameExt,
        middleName: pmrfMiddleName,
        motherMaiden: `${pmrfMotherLastName}, ${pmrfMotherFirstName} ${pmrfMotherMiddleName}`.trim(),
        pmrfMotherLastName,
        pmrfMotherFirstName,
        pmrfMotherMiddleName,
        pmrfMotherNameExt,
        pmrfMotherNoMN,
        pmrfMotherMononym,
        spouseName: `${pmrfSpouseLastName}, ${pmrfSpouseFirstName} ${pmrfSpouseMiddleName}`.trim(),
        pmrfSpouseLastName,
        pmrfSpouseFirstName,
        pmrfSpouseMiddleName,
        pmrfSpouseNameExt,
        pmrfSpouseNoMN,
        pmrfSpouseMononym,
        birthDate: pmrfBirthDate,
        birthPlace: pmrfBirthPlace,
        sex: pmrfSex,
        civilStatus: pmrfCivilStatus,
        citizenship: pmrfCitizenship,
        philsysNo: pmrfPhilsysNo,
        tin: pmrfPin, // map to PIN if needed
        addressUnit: pmrfAddressUnit,
        addressBuilding: pmrfAddressBuilding,
        addressLot: pmrfAddressLot,
        addressStreet: pmrfAddressStreet,
        addressSubdivision: pmrfAddressSubdivision,
        addressBarangay: pmrfAddressBarangay,
        addressMunicipality: pmrfAddressMunicipality,
        addressProvince: pmrfAddressProvince,
        addressZip: pmrfAddressZip,
        mailSame: pmrfMailingSame,
        mailUnit: pmrfMailingSame ? pmrfAddressUnit : pmrfMailingUnit,
        mailBuilding: pmrfMailingSame ? pmrfAddressBuilding : pmrfMailingBuilding,
        mailLot: pmrfMailingSame ? pmrfAddressLot : pmrfMailingLot,
        mailStreet: pmrfMailingSame ? pmrfAddressStreet : pmrfMailingStreet,
        mailSubdivision: pmrfMailingSame ? pmrfAddressSubdivision : pmrfMailingSubdivision,
        mailZip: pmrfMailingSame ? pmrfAddressZip : pmrfMailingZip,
        homePhone: pmrfHomePhone,
        mobileNo: pmrfMobileNo,
        businessPhone: pmrfBusinessPhone,
        email: pmrfEmail,
        contributorCategory: pmrfMemberType.category,
        contributorType: pmrfMemberType.subCategory,
        profession: pmrfMemberType.profession,
        monthlyIncome: pmrfMemberType.monthlyIncome,
        proofOfIncome: pmrfMemberType.proofOfIncome,
        pwdIdNo: pmrfMemberType.pwdIdNo,
        pmrfAmendments,
        pmrfAttestSignature,
        pmrfAttestDate,
        pmrfReceivedBy,
        autoSaveReference: autoSaveRef || {
          sourceRecordId: 'NEW_RECORD',
          pinNumber: pmrfPin || 'N/A',
          memberId: 'NEW_MEMBER_RECORD',
          dateRetrieved: new Date().toISOString(),
          userRetrievedBy: currentUser?.fullName || currentUser?.email || 'Officer'
        }
      };

      const householdHeadName = `${pmrfLastName}, ${pmrfFirstName} ${pmrfNameExt}`.trim();

      const householdDataPayload = {
        householdHead: householdHeadName,
        contactNumber: pmrfMobileNo,
        barangay: pmrfAddressBarangay,
        purok: 'Purok 1',
        latitude: 7.828,
        longitude: 123.433,
        pmrfStatus: 'Willing',
        yakapWillingStatus: 'Willing',
        pmrfDetails: pmrfDetailsPayload
      };

      const dependentsPayload = pmrfDependents
        .filter(d => d.lastName.trim() || d.firstName.trim())
        .map(d => ({
          fullName: `${d.lastName}, ${d.firstName} ${d.nameExt}`.trim(),
          gender: d.disabled ? 'Female' : 'Male',
          relationship: d.relationship || 'Child',
          birthDate: d.birthDate,
          lastName: d.lastName,
          firstName: d.firstName,
          middleName: d.middleName,
          nameExt: d.nameExt,
          noMiddleName: d.noMn,
          mononym: d.mononym,
          citizenship: d.citizenship,
          isDisabled: d.disabled
        }));

      let apiURL = '/api/households/add';
      let requestBody: any = {
        householdData: householdDataPayload,
        membersData: [],
        dependentsData: dependentsPayload
      };

      // 1. Client-Side Validation Rule: Check that logged-in user has valid Residential Area
      const userResArea = (currentUser?.address || '').trim();
      if (!userResArea) {
        alert("Unable to submit. Your account does not have an assigned Residential Area. Please contact your Administrator.");
        return;
      }

      if (existingId) {
        apiURL = '/api/households/edit';
        requestBody = {
          id: existingId,
          ...requestBody
        };
      }

      const saveRes = await fetch(apiURL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': currentUser?.email || ''
        },
        body: JSON.stringify(requestBody)
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveResult.error || 'Save operation failed');
      }

      alert(existingId ? 'PMRF Form record updated successfully!' : 'New PMRF Form record created successfully!');
      
      setShowDuplicateModal(false);
      setSkipSearch(true);
      
      if (saveResult && saveResult.household) {
        autoFillFromRecord(saveResult.household);
      }
    } catch (err: any) {
      console.error('Commit PMRF Error:', err);
      alert(err.message || 'Error saving PMRF record: Please verify connection.');
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear this blank form draft?")) {
      setLookupMessage({ text: '', type: '' });
      setAutoSaveRef(null);
      setMatchingRecords([]);
      // Clear PMRF
      setPmrfPin('');
      setPmrfPurpose('');
      setPmrfKonsulta('');
      setPmrfLastName('');
      setPmrfFirstName('');
      setPmrfNameExt('');
      setPmrfMiddleName('');
      setPmrfNoMiddleName(false);
      setPmrfMononym(false);
      setPmrfMotherLastName('');
      setPmrfMotherFirstName('');
      setPmrfMotherMiddleName('');
      setPmrfMotherNoMN(false);
      setPmrfSpouseLastName('');
      setPmrfSpouseFirstName('');
      setPmrfSpouseMiddleName('');
      setPmrfSpouseNoMN(false);
      setPmrfBirthDate('');
      setPmrfBirthPlace('');
      setPmrfSex('');
      setPmrfCivilStatus('');
      setPmrfCitizenship('');
      setPmrfPhilsysNo('');
      setPmrfTin('');
      setPmrfAddressUnit('');
      setPmrfAddressBuilding('');
      setPmrfAddressLot('');
      setPmrfAddressStreet('');
      setPmrfAddressSubdivision('');
      setPmrfAddressBarangay('San Francisco');
      setPmrfAddressMunicipality('Pagadian City');
      setPmrfAddressProvince('Zamboanga del Sur');
      setPmrfAddressZip('7016');
      setPmrfHomePhone('');
      setPmrfMobileNo('');
      setPmrfBusinessPhone('');
      setPmrfEmail('');
      setPmrfMailingSame(true);
      setPmrfMailingUnit('');
      setPmrfMailingBuilding('');
      setPmrfMailingLot('');
      setPmrfMailingStreet('');
      setPmrfMailingSubdivision('');
      setPmrfMailingBarangay('');
      setPmrfMailingMunicipality('');
      setPmrfMailingProvince('');
      setPmrfMailingZip('');
      setPmrfDependents([
        { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
        { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
        { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false },
        { lastName: '', firstName: '', nameExt: '', middleName: '', noMn: false, mononym: false, relationship: '', birthDate: '', citizenship: '', disabled: false }
      ]);
      setPmrfMemberType({
        category: '',
        subCategory: '',
        profession: '',
        monthlyIncome: '',
        proofOfIncome: '',
        pwdIdNo: ''
      });
      setPmrfAmendments({
        name: { checked: false, from: '', to: '' },
        dob: { checked: false, from: '', to: '' },
        sex: { checked: false, from: '', to: '' },
        civilStatus: { checked: false, from: '', to: '' },
        personalInfo: { checked: false, from: '', to: '' }
      });
      setPmrfAttestSignature('');
      setPmrfAttestDate('');
      setPmrfReceivedBy({
        fullName: '',
        proLhioBranch: '',
        dateTime: ''
      });

      // Clear FPE
      setFpeDateOfEncounter('');
      setFpePatientName('');
      setFpeFamilyRole('');
      setFpeAge('');
      setFpeBirthDate('');
      setFpeSex('');
      setFpeCivilStatus('');
      setFpePhilhealthNo('');
      setFpeContactNo('');
      setFpeAddress('');
      setFpeChiefComplaint('');
      setFpeBloodPressure('');
      setFpeTemperature('');
      setFpeHeartRate('');
      setFpeRespiratoryRate('');
      setFpeWeight('');
      setFpeHeight('');
      setFpeBmi('');
      setFpeHistoryAsthma(false);
      setFpeHistoryHypertension(false);
      setFpeHistoryDiabetes(false);
      setFpeHistoryCancer(false);
      setFpeHistoryHeartDisease(false);
      setFpeHistoryOthers('');

      // Clear PCSF
      setPcsfHeadName('');
      setPcsfPatientName('');
      setPcsfRelationToHead('');
      setPcsfBirthDate('');
      setPcsfSex('');
      setPcsfPhilhealthNo('');
      setPcsfBarangay('San Francisco');
      setPcsfPurok('');
      setPcsfAddress('');
      setPcsfProviderName('SAINT FRANCIS CLINIC');
      setPcsfEnrollDate('');
      setPcsfContactNo('');
      setPcsfEmail('');
    }
  };

  const isFormBlank = () => {
    if (activeFormTab === 'PMRF') {
      return !pmrfLastName.trim() && !pmrfFirstName.trim();
    } else if (activeFormTab === 'FPE') {
      return !fpePatientName.trim();
    } else if (activeFormTab === 'PCSF') {
      return !pcsfPatientName.trim();
    }
    return true;
  };

  const handleDownloadPDF = async () => {
    setIsDownloadingPdf(true);

    const cleanColorFunction = (colorStr: string): string => {
      if (!colorStr) return colorStr;
      return colorStr.replace(/(oklch|oklab)\s*\(([^)]+)\)/gi, (match, type, content) => {
        const cleanContent = content.replace(/\//g, ' ').trim();
        const parts = cleanContent.split(/\s+/);
        const lightness = parseFloat(parts[0]);
        const alphaPart = parts[3] ? parseFloat(parts[3]) : 1.0;
        const alpha = isNaN(alphaPart) ? 1.0 : alphaPart;
        
        if (type.toLowerCase() === 'oklch') {
          const chroma = parseFloat(parts[1]) || 0;
          const hue = parseFloat(parts[2]) || 0;
          if (lightness > 0.85) {
            if (hue > 200 && hue < 280) return `rgba(239, 246, 255, ${alpha})`;
            if (hue > 100 && hue < 160) return `rgba(240, 253, 244, ${alpha})`;
            return `rgba(248, 250, 252, ${alpha})`;
          }
          if (lightness < 0.25) return `rgba(15, 23, 42, ${alpha})`;
          if (chroma < 0.04) {
            if (lightness > 0.6) return `rgba(148, 163, 184, ${alpha})`;
            return `rgba(71, 85, 105, ${alpha})`;
          }
          if (hue > 200 && hue < 280) return `rgba(26, 86, 219, ${alpha})`;
          if (hue > 100 && hue < 160) return `rgba(5, 150, 105, ${alpha})`;
          if (hue > 10 && hue < 70) return `rgba(220, 38, 38, ${alpha})`;
          return `rgba(71, 85, 105, ${alpha})`;
        } else {
          if (lightness > 0.85) return `rgba(248, 250, 252, ${alpha})`;
          if (lightness < 0.3) return `rgba(15, 23, 42, ${alpha})`;
          return `rgba(71, 85, 105, ${alpha})`;
        }
      });
    };

    const sanitizeStyleRulesOfSheet = (sheet: CSSStyleSheet) => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        rules.forEach((rule) => {
          if ('style' in rule) {
            const styleRule = rule as CSSStyleRule;
            const style = styleRule.style;
            if (style) {
              for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                const val = style.getPropertyValue(prop);
                if (val && (val.includes('oklch') || val.includes('oklab'))) {
                  try {
                    style.setProperty(prop, cleanColorFunction(val), style.getPropertyPriority(prop));
                  } catch (e) {}
                }
              }
            }
          }
        });
      } catch (e) {}
    };

    const sanitizeAllSheetsOfDocument = (doc: Document) => {
      try {
        const sheets = Array.from(doc.styleSheets);
        sheets.forEach((sheet) => {
          sanitizeStyleRulesOfSheet(sheet as CSSStyleSheet);
        });
      } catch (e) {}
    };

    // Backup and temporarily strip oklch/oklab color functions from active stylesheet rules to bypass html2canvas parsing crash
    const styleElements = Array.from(document.querySelectorAll('style'));
    const originalStyleContents: string[] = [];
    
    styleElements.forEach((style) => {
      originalStyleContents.push(style.textContent || '');
      if (style.textContent) {
        style.textContent = cleanColorFunction(style.textContent);
      }
    });

    sanitizeAllSheetsOfDocument(document);

    // Override parent document getComputedStyle to bypass direct wide-gamut lookups
    const originalParentGCS = window.getComputedStyle;
    const parentProxiedGCS = (element: Element, pseudoElement?: string) => {
      const style = originalParentGCS.call(window, element, pseudoElement);
      if (!style) return style;
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              return typeof val === 'string' ? cleanColorFunction(val) : val;
            };
          }
          const value = Reflect.get(target, prop);
          if (typeof value === 'function') {
            return value.bind(target);
          }
          if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
            return cleanColorFunction(value);
          }
          return value;
        }
      }) as any;
    };
    (window as any).getComputedStyle = parentProxiedGCS;

    try {
      // Common html2canvas configuration options
      const captureOptions = {
        scale: 2, // High resolution for text readability
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Fixed capturing viewport width to guarantee consistent high-fidelity layout
        onclone: (clonedDoc: Document) => {
          // Process and substitute oklch/oklab colors in all style elements to prevent parsing crashes
          const clonedWin = clonedDoc.defaultView;
          if (clonedWin) {
            const originalGCS = clonedWin.getComputedStyle;
            clonedWin.getComputedStyle = (element: Element, pseudoElement?: string) => {
              const style = originalGCS.call(clonedWin, element, pseudoElement);
              if (!style) return style;
              return new Proxy(style, {
                get(target, prop) {
                  if (prop === 'getPropertyValue') {
                    return function(propertyName: string) {
                      const val = target.getPropertyValue(propertyName);
                      return typeof val === 'string' ? cleanColorFunction(val) : val;
                    };
                  }
                  const value = Reflect.get(target, prop);
                  if (typeof value === 'function') {
                    return value.bind(target);
                  }
                  if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
                    return cleanColorFunction(value);
                  }
                  return value;
                }
              }) as any;
            };
          }

          const clonedStyles = clonedDoc.querySelectorAll('style');
          clonedStyles.forEach((style) => {
            if (style.textContent) {
              style.textContent = cleanColorFunction(style.textContent);
            }
          });

          // SYNC AND DECORATE INPUTS & SELECTS IN CLONED DOM WITH HIGH FIDELITY
          // This guarantees that all data remains visually fully intact (no missed data).
          // Replaces HTML inputs with CSS styled spans/divs to bypass html2canvas native rendering issues.
          const originalArea = document.getElementById('printable-form-area');
          const clonedArea = clonedDoc.getElementById('printable-form-area');
          if (originalArea && clonedArea) {
            // First, process checkboxes & radios to render with high fidelity in cloned DOM
            const originalCheckboxes = Array.from(originalArea.querySelectorAll('input[type="checkbox"], input[type="radio"]'));
            const clonedCheckboxes = Array.from(clonedArea.querySelectorAll('input[type="checkbox"], input[type="radio"]'));

            originalCheckboxes.forEach((origCheck, idx) => {
              const clonedCheck = clonedCheckboxes[idx] as HTMLInputElement;
              if (!clonedCheck) return;

              const isChecked = (origCheck as HTMLInputElement).checked;
              const isRadio = (origCheck as HTMLInputElement).type === 'radio';

              // Create a styled div replacement
              const replacement = clonedDoc.createElement('div');
              replacement.className = "inline-flex items-center justify-center select-none font-sans font-bold text-black border border-black";
              
              // Copy size from original check element
              const rect = origCheck.getBoundingClientRect();
              const w = rect.width ? `${rect.width}px` : '12px';
              const h = rect.height ? `${rect.height}px` : '12px';
              
              replacement.style.width = w;
              replacement.style.height = h;
              replacement.style.minWidth = w;
              replacement.style.minHeight = h;
              replacement.style.display = 'inline-flex';
              replacement.style.alignItems = 'center';
              replacement.style.justifyContent = 'center';
              replacement.style.border = '1px solid #000000';
              replacement.style.fontSize = isRadio ? '8px' : '9px';
              replacement.style.lineHeight = '1';
              replacement.style.padding = '0';
              replacement.style.margin = '0 2px';
              replacement.style.backgroundColor = isChecked ? '#dee5db' : '#ffffff';

              if (isRadio) {
                replacement.style.borderRadius = '50%';
                replacement.innerHTML = isChecked ? '●' : '';
              } else {
                replacement.innerHTML = isChecked ? '✓' : '';
                if (origCheck.className.includes('rounded')) {
                  replacement.style.borderRadius = '2px';
                }
              }

              if (clonedCheck.parentNode) {
                clonedCheck.parentNode.replaceChild(replacement, clonedCheck);
              }
            });

            // Second, find all text inputs, selects, and textareas
            const originalTexts = Array.from(originalArea.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea'));
            const clonedTexts = Array.from(clonedArea.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea'));

            originalTexts.forEach((origInput, idx) => {
              const clonedInput = clonedTexts[idx] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              if (!clonedInput) return;

              // Extract clean value
              let val = '';
              if (origInput instanceof HTMLSelectElement) {
                val = origInput.options[origInput.selectedIndex]?.text || origInput.value || '';
                // If it's a default placeholder choice like "- Select -", render it empty/blank
                if (val.toLowerCase().includes('select') || val.trim() === '—') {
                  val = '';
                }
              } else {
                val = (origInput as HTMLInputElement | HTMLTextAreaElement).value || '';
              }

              // Create a span replacement
              const replacement = clonedDoc.createElement('span');
              replacement.className = origInput.className;
              if (origInput.id) {
                replacement.id = origInput.id;
              }
              replacement.style.display = 'inline-flex';
              replacement.style.alignItems = 'center';
              replacement.style.background = 'transparent';
              replacement.style.color = '#000000';
              replacement.style.fontWeight = 'bold';
              replacement.style.fontSize = '10px';
              replacement.style.whiteSpace = 'pre-wrap';
              replacement.style.overflow = 'hidden';
              replacement.style.minHeight = '14px';
              replacement.style.outline = 'none';

              // If it's a signature line or custom styled element, we keep its sizing
              const rect = origInput.getBoundingClientRect();
              const hasWFull = origInput.className.includes('w-full') || (origInput as HTMLElement).style?.width === '100%';
              if (rect.width && !hasWFull) {
                replacement.style.width = `${rect.width}px`;
                replacement.style.minWidth = `${rect.width}px`;
              } else if (hasWFull) {
                replacement.style.width = '100%';
              }
              if (rect.height) {
                replacement.style.height = `${rect.height}px`;
              }

              // Check if original text was styled center, right etc. 
              const origHtml = origInput as HTMLElement;
              if (origInput.classList.contains('text-center') || origHtml.style?.textAlign === 'center') {
                replacement.style.justifyContent = 'center';
                replacement.style.textAlign = 'center';
              } else if (origInput.classList.contains('text-right') || origHtml.style?.textAlign === 'right') {
                replacement.style.justifyContent = 'flex-end';
                replacement.style.textAlign = 'right';
              } else {
                replacement.style.justifyContent = 'flex-start';
                replacement.style.textAlign = 'left';
              }

              // No "N/A" replacements inside fields for pure blank forms or accurate un-altered data forms!
              replacement.textContent = val.trim() === '' ? '\u00A0' : val;

              if (clonedInput.parentNode) {
                clonedInput.parentNode.replaceChild(replacement, clonedInput);
              }
            });
          }

          sanitizeAllSheetsOfDocument(clonedDoc);
        }
      };

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const addPageToPdf = (canvas: HTMLCanvasElement, isNewPage: boolean = false) => {
        if (isNewPage) {
          pdf.addPage();
        }
        const imgData = canvas.toDataURL('image/png', 1.0);
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight > pageHeight) {
          const scaleFactor = pageHeight / imgHeight;
          const finalWidth = imgWidth * scaleFactor;
          const xOffset = (imgWidth - finalWidth) / 2;
          pdf.addImage(imgData, 'PNG', xOffset, 0, finalWidth, pageHeight);
        } else {
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }
      };

      if (activeFormTab === 'PMRF') {
        const originalSubTab = pmrfSubTab;

        // 1. Render and capture PMRF FRONT
        setPmrfSubTab('FRONT');
        await new Promise((r) => setTimeout(r, 650));
        const elementFront = document.getElementById('printable-form-area');
        if (!elementFront) throw new Error('Front element not found');
        const canvasFront = await html2canvas(elementFront, captureOptions);
        addPageToPdf(canvasFront, false);

        // 2. Render and capture PMRF BACK
        setPmrfSubTab('BACK');
        await new Promise((r) => setTimeout(r, 650));
        const elementBack = document.getElementById('printable-form-area');
        if (!elementBack) throw new Error('Back element not found');
        const canvasBack = await html2canvas(elementBack, captureOptions);
        addPageToPdf(canvasBack, true);

        // 3. Restore original sub-tab selection
        setPmrfSubTab(originalSubTab);
        await new Promise((r) => setTimeout(r, 300));

        pdf.save('PhilHealth_PMRF_Form.pdf');
      } else {
        // Standard flow for FPE and PCSF (single sheet forms)
        await new Promise((r) => setTimeout(r, 500));
        const element = document.getElementById('printable-form-area');
        if (!element) return;

        const canvas = await html2canvas(element, captureOptions);
        addPageToPdf(canvas, false);

        const filename = activeFormTab === 'FPE'
          ? 'First_Patient_Encounter_FPE_Form.pdf'
          : 'Primary_Care_Selection_PCSF_Form.pdf';

        pdf.save(filename);
      }
    } catch (error) {
      console.error('Error generating PDF download:', error);
    } finally {
      // Restore CSSStyleDeclaration behavior
      (window as any).getComputedStyle = originalParentGCS;
      // Restore CSS content on active page style tags
      styleElements.forEach((style, index) => {
        style.textContent = originalStyleContents[index];
      });
      setIsDownloadingPdf(false);
    }
  };

  const handleCapturePMRFImages = async () => {
    setIsCapturingImages(true);

    const cleanColorFunction = (colorStr: string): string => {
      if (!colorStr) return colorStr;
      return colorStr.replace(/(oklch|oklab)\s*\(([^)]+)\)/gi, (match, type, content) => {
        const cleanContent = content.replace(/\//g, ' ').trim();
        const parts = cleanContent.split(/\s+/);
        const lightness = parseFloat(parts[0]);
        const alphaPart = parts[3] ? parseFloat(parts[3]) : 1.0;
        const alpha = isNaN(alphaPart) ? 1.0 : alphaPart;
        
        if (type.toLowerCase() === 'oklch') {
          const chroma = parseFloat(parts[1]) || 0;
          const hue = parseFloat(parts[2]) || 0;
          if (lightness > 0.85) {
            if (hue > 200 && hue < 280) return `rgba(239, 246, 255, ${alpha})`;
            if (hue > 100 && hue < 160) return `rgba(240, 253, 244, ${alpha})`;
            return `rgba(248, 250, 252, ${alpha})`;
          }
          if (lightness < 0.25) return `rgba(15, 23, 42, ${alpha})`;
          if (chroma < 0.04) {
            if (lightness > 0.6) return `rgba(148, 163, 184, ${alpha})`;
            return `rgba(71, 85, 105, ${alpha})`;
          }
          if (hue > 200 && hue < 280) return `rgba(26, 86, 219, ${alpha})`;
          if (hue > 100 && hue < 160) return `rgba(5, 150, 105, ${alpha})`;
          if (hue > 10 && hue < 70) return `rgba(220, 38, 38, ${alpha})`;
          return `rgba(71, 85, 105, ${alpha})`;
        } else {
          if (lightness > 0.85) return `rgba(248, 250, 252, ${alpha})`;
          if (lightness < 0.3) return `rgba(15, 23, 42, ${alpha})`;
          return `rgba(71, 85, 105, ${alpha})`;
        }
      });
    };

    const sanitizeStyleRulesOfSheet = (sheet: CSSStyleSheet) => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules);
        rules.forEach((rule) => {
          if ('style' in rule) {
            const styleRule = rule as CSSStyleRule;
            const style = styleRule.style;
            if (style) {
              for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                const val = style.getPropertyValue(prop);
                if (val && (val.includes('oklch') || val.includes('oklab'))) {
                   try {
                     style.setProperty(prop, cleanColorFunction(val), style.getPropertyPriority(prop));
                   } catch (e) {}
                }
              }
            }
          }
        });
      } catch (e) {}
    };

    const sanitizeAllSheetsOfDocument = (doc: Document) => {
      try {
        const sheets = Array.from(doc.styleSheets);
        sheets.forEach((sheet) => {
          sanitizeStyleRulesOfSheet(sheet as CSSStyleSheet);
        });
      } catch (e) {}
    };

    // Backup and temporarily strip oklch/oklab color functions from active stylesheet rules to bypass html2canvas parsing crash
    const styleElements = Array.from(document.querySelectorAll('style'));
    const originalStyleContents: string[] = [];
    
    styleElements.forEach((style) => {
      originalStyleContents.push(style.textContent || '');
      if (style.textContent) {
        style.textContent = cleanColorFunction(style.textContent);
      }
    });

    sanitizeAllSheetsOfDocument(document);

    // Override parent document getComputedStyle to bypass direct wide-gamut lookups
    const originalParentGCS = window.getComputedStyle;
    const parentProxiedGCS = (element: Element, pseudoElement?: string) => {
      const style = originalParentGCS.call(window, element, pseudoElement);
      if (!style) return style;
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              return typeof val === 'string' ? cleanColorFunction(val) : val;
            };
          }
          const value = Reflect.get(target, prop);
          if (typeof value === 'function') {
            return value.bind(target);
          }
          if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
            return cleanColorFunction(value);
          }
          return value;
        }
      }) as any;
    };
    (window as any).getComputedStyle = parentProxiedGCS;

    try {
      // Common html2canvas configuration options
      const captureOptions = {
        scale: 2, // High resolution for text readability
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Fixed capturing viewport width to guarantee consistent high-fidelity layout
        onclone: (clonedDoc: Document) => {
          // Process and substitute oklch/oklab colors in all style elements to prevent parsing crashes
          const clonedWin = clonedDoc.defaultView;
          if (clonedWin) {
            const originalGCS = clonedWin.getComputedStyle;
            clonedWin.getComputedStyle = (element: Element, pseudoElement?: string) => {
              const style = originalGCS.call(clonedWin, element, pseudoElement);
              if (!style) return style;
              return new Proxy(style, {
                get(target, prop) {
                  if (prop === 'getPropertyValue') {
                    return function(propertyName: string) {
                      const val = target.getPropertyValue(propertyName);
                      return typeof val === 'string' ? cleanColorFunction(val) : val;
                    };
                  }
                  const value = Reflect.get(target, prop);
                  if (typeof value === 'function') {
                    return value.bind(target);
                  }
                  if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
                    return cleanColorFunction(value);
                  }
                  return value;
                }
              }) as any;
            };
          }

          const clonedStyles = clonedDoc.querySelectorAll('style');
          clonedStyles.forEach((style) => {
            if (style.textContent) {
              style.textContent = cleanColorFunction(style.textContent);
            }
          });

          // SYNC AND DECORATE INPUTS & SELECTS IN CLONED DOM WITH HIGH FIDELITY
          // This guarantees that all data remains visually fully intact (no missed data).
          // Replaces HTML inputs with CSS styled spans/divs to bypass html2canvas native rendering issues.
          const originalArea = document.getElementById('printable-form-area');
          const clonedArea = clonedDoc.getElementById('printable-form-area');
          if (originalArea && clonedArea) {
            // First, process checkboxes & radios to render with high fidelity in cloned DOM
            const originalCheckboxes = Array.from(originalArea.querySelectorAll('input[type="checkbox"], input[type="radio"]'));
            const clonedCheckboxes = Array.from(clonedArea.querySelectorAll('input[type="checkbox"], input[type="radio"]'));

            originalCheckboxes.forEach((origCheck, idx) => {
              const clonedCheck = clonedCheckboxes[idx] as HTMLInputElement;
              if (!clonedCheck) return;

              const isChecked = (origCheck as HTMLInputElement).checked;
              const isRadio = (origCheck as HTMLInputElement).type === 'radio';

              // Create a styled div replacement
              const replacement = clonedDoc.createElement('div');
              replacement.className = "inline-flex items-center justify-center select-none font-sans font-bold text-black border border-black";
              
              // Copy size from original check element
              const rect = origCheck.getBoundingClientRect();
              const w = rect.width ? `${rect.width}px` : '12px';
              const h = rect.height ? `${rect.height}px` : '12px';
              
              replacement.style.width = w;
              replacement.style.height = h;
              replacement.style.minWidth = w;
              replacement.style.minHeight = h;
              replacement.style.display = 'inline-flex';
              replacement.style.alignItems = 'center';
              replacement.style.justifyContent = 'center';
              replacement.style.border = '1px solid #000000';
              replacement.style.fontSize = isRadio ? '8px' : '9px';
              replacement.style.lineHeight = '1';
              replacement.style.padding = '0';
              replacement.style.margin = '0 2px';
              replacement.style.backgroundColor = isChecked ? '#dee5db' : '#ffffff';

              if (isRadio) {
                replacement.style.borderRadius = '50%';
                replacement.innerHTML = isChecked ? '●' : '';
              } else {
                replacement.innerHTML = isChecked ? '✓' : '';
                if (origCheck.className.includes('rounded')) {
                  replacement.style.borderRadius = '2px';
                }
              }

              if (clonedCheck.parentNode) {
                clonedCheck.parentNode.replaceChild(replacement, clonedCheck);
              }
            });

            // Second, find all text inputs, selects, and textareas
            const originalTexts = Array.from(originalArea.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea'));
            const clonedTexts = Array.from(clonedArea.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select, textarea'));

            originalTexts.forEach((origInput, idx) => {
              const clonedInput = clonedTexts[idx] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              if (!clonedInput) return;

              // Extract clean value
              let val = '';
              if (origInput instanceof HTMLSelectElement) {
                val = origInput.options[origInput.selectedIndex]?.text || origInput.value || '';
                // If it's a default placeholder choice like "- Select -", render it empty/blank
                if (val.toLowerCase().includes('select') || val.trim() === '—') {
                  val = '';
                }
              } else {
                val = (origInput as HTMLInputElement | HTMLTextAreaElement).value || '';
              }

              // Create a span replacement
              const replacement = clonedDoc.createElement('span');
              replacement.className = origInput.className;
              if (origInput.id) {
                replacement.id = origInput.id;
              }
              replacement.style.display = 'inline-flex';
              replacement.style.alignItems = 'center';
              replacement.style.background = 'transparent';
              replacement.style.color = '#000000';
              replacement.style.fontWeight = 'bold';
              replacement.style.fontSize = '10px';
              replacement.style.whiteSpace = 'pre-wrap';
              replacement.style.overflow = 'hidden';
              replacement.style.minHeight = '14px';
              replacement.style.outline = 'none';

              // If it's a signature line or custom styled element, we keep its sizing
              const rect = origInput.getBoundingClientRect();
              const hasWFull = origInput.className.includes('w-full') || (origInput as HTMLElement).style?.width === '100%';
              if (rect.width && !hasWFull) {
                replacement.style.width = `${rect.width}px`;
                replacement.style.minWidth = `${rect.width}px`;
              } else if (hasWFull) {
                replacement.style.width = '100%';
              }
              if (rect.height) {
                replacement.style.height = `${rect.height}px`;
              }

              // Check if original text was styled center, right etc. 
              const origHtml = origInput as HTMLElement;
              if (origInput.classList.contains('text-center') || origHtml.style?.textAlign === 'center') {
                replacement.style.justifyContent = 'center';
                replacement.style.textAlign = 'center';
              } else if (origInput.classList.contains('text-right') || origHtml.style?.textAlign === 'right') {
                replacement.style.justifyContent = 'flex-end';
                replacement.style.textAlign = 'right';
              } else {
                replacement.style.justifyContent = 'flex-start';
                replacement.style.textAlign = 'left';
              }

              // No "N/A" replacements inside fields for pure blank forms or accurate un-altered data forms!
              replacement.textContent = val.trim() === '' ? '\u00A0' : val;

              if (clonedInput.parentNode) {
                clonedInput.parentNode.replaceChild(replacement, clonedInput);
              }
            });
          }

          sanitizeAllSheetsOfDocument(clonedDoc);
        }
      };

      const originalSubTab = pmrfSubTab;

      // 1. Render and capture PMRF FRONT
      setPmrfSubTab('FRONT');
      await new Promise((r) => setTimeout(r, 650));
      const elementFront = document.getElementById('printable-form-area');
      if (!elementFront) throw new Error('Front element not found');
      const canvasFront = await html2canvas(elementFront, captureOptions);
      
      const namePrefix = pmrfLastName ? `${pmrfLastName}_` : '';
      const dataUrlFront = canvasFront.toDataURL('image/png', 1.0);
      const linkFront = document.createElement('a');
      linkFront.download = `${namePrefix}PMRF_Front_${Date.now()}.png`;
      linkFront.href = dataUrlFront;
      linkFront.click();

      // 2. Render and capture PMRF BACK
      setPmrfSubTab('BACK');
      await new Promise((r) => setTimeout(r, 650));
      const elementBack = document.getElementById('printable-form-area');
      if (!elementBack) throw new Error('Back element not found');
      const canvasBack = await html2canvas(elementBack, captureOptions);

      const dataUrlBack = canvasBack.toDataURL('image/png', 1.0);
      const linkBack = document.createElement('a');
      linkBack.download = `${namePrefix}PMRF_Back_${Date.now()}.png`;
      linkBack.href = dataUrlBack;
      linkBack.click();

      // Restore original subtab
      setPmrfSubTab(originalSubTab);
      await new Promise((r) => setTimeout(r, 300));
    } catch (error) {
      console.error('Error capturing PMRF images:', error);
    } finally {
      // Restore CSSStyleDeclaration behavior
      (window as any).getComputedStyle = originalParentGCS;
      // Restore CSS content on active page style tags
      styleElements.forEach((style, index) => {
        style.textContent = originalStyleContents[index];
      });
      setIsCapturingImages(false);
    }
  };

  const updateDependentField = (index: number, field: string, value: any) => {
    setPmrfDependents(prev => prev.map((dep, idx) => {
      if (idx === index) {
        return { ...dep, [field]: value };
      }
      return dep;
    }));
  };

  // Helpers for PMRF's Segmented Birth Date MM-DD-YYYY
  const getDobDigits = () => {
    if (!pmrfBirthDate) return Array(8).fill('');
    const parts = pmrfBirthDate.split('-');
    if (parts.length !== 3) return Array(8).fill('');
    const [yyyy, mm, dd] = parts;
    return [
      mm[0] || ' ', mm[1] || ' ',
      dd[0] || ' ', dd[1] || ' ',
      yyyy[0] || ' ', yyyy[1] || ' ', yyyy[2] || ' ', yyyy[3] || ' '
    ];
  };

  const updateDobFromDigits = (digits: string[]) => {
    const mm = ((digits[0] || '').trim() + (digits[1] || '').trim()).padEnd(2, '0');
    const dd = ((digits[2] || '').trim() + (digits[3] || '').trim()).padEnd(2, '0');
    const yyyy = ((digits[4] || '').trim() + (digits[5] || '').trim() + (digits[6] || '').trim() + (digits[7] || '').trim()).padEnd(4, '0');
    setPmrfBirthDate(`${yyyy}-${mm}-${dd}`);
  };

  return (
    <div className="space-y-6 font-sans pb-16">
      
      {/* HEADER SECTION - HIDE ON PRINT */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between print:hidden">
        <div>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 leading-none">
            <FileText className="h-5 w-5 text-blue-600 animate-pulse" />
            Blank Forms Template Center
          </h1>
          <p className="text-[10.5px] text-slate-500 font-bold mt-1">
            Access pristine paper-style layouts for PMRF, FPE, & PCSF. Fill out, adjust, and print directly.
          </p>
        </div>

        {/* Templates Dropdown Switcher */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          <div className="relative inline-block text-left w-full sm:w-64">
            <div>
              <button
                type="button"
                onClick={() => setShowFormsDropdown(!showFormsDropdown)}
                className="inline-flex justify-between items-center gap-2 w-full rounded-xl border border-slate-300 shadow-xs px-4 py-2 bg-slate-50 text-xs font-black text-slate-800 hover:bg-slate-100 focus:outline-none transition cursor-pointer"
              >
                <span>
                  {activeFormTab === 'PMRF' ? '📄 PMRF (PhilHealth Member)' : 
                   activeFormTab === 'FPE' ? '🩺 FPE Form (Patient Encounter)' : 
                   '✅ PCSF Form (Provider Selection)'}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {showFormsDropdown && (
              <div className="origin-top-right absolute right-0 mt-1.5 w-full rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-[100] border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {[
                  { id: 'PMRF', label: '📄 PhilHealth PMRF Form', desc: 'Member Registration Paper-Style Form' },
                  { id: 'FPE', label: '🩺 First Patient Encounter (FPE)', desc: 'Clinical intake and health logs' },
                  { id: 'PCSF', label: '✅ Primary Care selection (PCSF)', desc: 'Konsulta/Primary provider select' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveFormTab(item.id as any);
                      setShowFormsDropdown(false);
                    }}
                    className={`flex flex-col text-left w-full px-4 py-2.5 text-xs transition duration-150 ${
                      activeFormTab === item.id ? 'bg-blue-50 text-blue-950 font-extrabold border-l-4 border-blue-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-extrabold">{item.label}</span>
                    <span className="text-[9.5px] text-slate-400 font-medium leading-none mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>



          {!isFormBlank() && (
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-350 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95 print:hidden"
              title="Download Form Layout as PDF"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span>{isDownloadingPdf ? 'Downloading PDF...' : 'Download PDF'}</span>
            </button>
          )}

          {activeFormTab === 'PMRF' && (
            <button
              type="button"
              onClick={handleCapturePMRFImages}
              disabled={isCapturingImages}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-350 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95 print:hidden"
              title="Capture PMRF Pages as PNG Images"
            >
              {isCapturingImages ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              <span>{isCapturingImages ? 'Capturing...' : 'Capture'}</span>
            </button>
          )}

          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
            title="Reset Form Details"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Form</span>
          </button>
        </div>
      </div>

      {/* FORM ACTIONS FOR PMRF (FRONT / BACK) - HIDE ON PRINT */}
      {activeFormTab === 'PMRF' && (
        <div className="flex bg-white hover:bg-slate-50 border border-slate-200 max-w-sm mx-auto items-center justify-between shadow-xs select-none gap-2 rounded-xl p-1 shrink-0 print:hidden">
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
      )}

      {/* PRINT STYLING SHEET OVERRIDE */}
      <style>{`
        @media print {
          /* Force page margins and hide header/footer browser additions if possible */
          @page {
            size: 8.5in 13in;
            margin: 6mm 6mm 6mm 6mm; /* Narrow margin */
          }
          /* Reset overflow and height on all parent levels to prevent clipping/single-page cutoff */
          html, body, #root, div, main, section, article {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            position: static !important;
          }
          /* Hide other app components like sidebar, navbar from the print layout */
          body {
            visibility: hidden !important;
          }
          #printable-form-area {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            z-index: 9999999 !important;
          }
          #printable-form-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Ensure form input elements show clearly with crisp value texts */
          #printable-form-area input, 
          #printable-form-area select, 
          #printable-form-area textarea {
            color: black !important;
            font-weight: 700 !important;
            background: transparent !important;
            border-color: #64748b !important; /* Force input borders visible */
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Force checkbox icons to render natively and accurately */
          #printable-form-area input[type="checkbox"] {
            -webkit-appearance: checkbox !important;
            -moz-appearance: checkbox !important;
            appearance: checkbox !important;
            display: inline-block !important;
            width: 13px !important;
            height: 13px !important;
            border: 1.5px solid black !important;
            vertical-align: middle !important;
            cursor: pointer !important;
            accent-color: black !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          /* Ensure grid boxes and lines remain sharp in grayscale */
          #printable-form-area .border-black {
            border-color: #000000 !important;
            border-width: 1px !important;
          }
          #printable-form-area .border-[3px] {
            border-width: 3px !important;
          }
          #printable-form-area .border-slate-300 {
            border-color: #94a3b8 !important;
          }
          #printable-form-area .border-slate-400 {
            border-color: #64748b !important;
          }
          /* Hide interactive/editing overlays on printed papers */
          #printable-form-area button, 
          #printable-form-area .print\\:hidden, 
          #printable-form-area .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          /* Keep header color branding visible but clean */
          #printable-form-area .bg-slate-900 {
            background-color: #0f172a !important;
            color: white !important;
          }
          #printable-form-area .bg-[#dee5db] {
            background-color: #dee5db !important;
            color: black !important;
          }
          #printable-form-area .bg-[#eff6ff] {
            background-color: #eff6ff !important;
            color: black !important;
          }
          #printable-form-area .bg-blue-50 {
            background-color: #eff6ff !important;
            color: #1e40af !important;
          }
          #printable-form-area .text-[#1a56db] {
            color: #1e40af !important;
          }
        }

        /* PMRF Capture Adjustment Custom Rules (Applies both to screen and html2canvas captures) */
        .pmrf-health-text {
          position: relative !important;
          top: -3.5px !important;
        }
        .pmrf-konsulta-label,
        .pmrf-dob-label,
        .pmrf-home-phone-label,
        .pmrf-mobile-label,
        .pmrf-business-label,
        .pmrf-email-label {
          position: relative !important;
          top: -3px !important;
        }
        .pmrf-konsulta-input,
        .pmrf-home-phone-input,
        .pmrf-mobile-input,
        .pmrf-business-input,
        .pmrf-email-input {
          position: relative !important;
          top: -1.5px !important;
        }
        .pmrf-section-header {
          position: relative !important;
          top: -2.5px !important;
          line-height: normal !important;
        }
        .pmrf-dob-digit-box,
        [id^="blank-dob-input-"] {
          position: relative !important;
          top: -2px !important;
        }
        .pmrf-address-data,
        [id^="pmrf-addr-"],
        [id^="pmrf-mail-"] {
          position: relative !important;
          top: -1.5px !important;
        }
        .pmrf-dependent-data {
          position: relative !important;
          top: -1.5px !important;
        }
      `}</style>

      {/* MAIN SHEETS FOR THE DIFFERENT DOCUMENTS */}
      <div id="printable-form-area" className="print-form-sheet mx-auto w-full transition bg-slate-50/20 max-w-5xl rounded-2xl">
        
        {/* --- 1. PHILHEALTH PMRF FRONT FORM --- */}
        {activeFormTab === 'PMRF' && pmrfSubTab === 'FRONT' && (
          <>
            {/* DESKTOP PRINT DESIGN (Visible on md+ screens and when printing) */}
            <div className="hidden md:block print:block w-full overflow-x-auto pb-4">
              <div className="bg-white border-[3px] border-black p-4 text-black font-sans text-[9px] uppercase tracking-normal relative shadow-md min-w-[850px]">
            
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
                      <span className="text-[32px] font-extrabold tracking-tighter text-[#111827] pmrf-health-text" style={{ fontFamily: "Georgia, serif" }}>Health</span>
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
                            id={`blank-pin-input-${i}`}
                            type="text"
                            maxLength={1}
                            value={char}
                            className="w-[20px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-50 text-black uppercase animate-none"
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const chars = pmrfPin.padEnd(12, ' ').split('');
                              chars[i] = val.slice(-1);
                              const newVal = chars.join('').replace(/\s+$/, '');
                              setPmrfPin(newVal);
                              if (val && i < 11) {
                                const nextEl = document.getElementById(`blank-pin-input-${i + 1}`);
                                if (nextEl) (nextEl as HTMLInputElement).focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !char && i > 0) {
                                const prevEl = document.getElementById(`blank-pin-input-${i - 1}`);
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
                            id={`blank-pin-input-${i}`}
                            type="text"
                            maxLength={1}
                            value={char}
                            className="w-[20px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-50 text-black uppercase animate-none"
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const chars = pmrfPin.padEnd(12, ' ').split('');
                              chars[i] = val.slice(-1);
                              const newVal = chars.join('').replace(/\s+$/, '');
                              setPmrfPin(newVal);
                              if (val && i < 11) {
                                const nextEl = document.getElementById(`blank-pin-input-${i + 1}`);
                                if (nextEl) (nextEl as HTMLInputElement).focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !char && i > 0) {
                                const prevEl = document.getElementById(`blank-pin-input-${i - 1}`);
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
                            id={`blank-pin-input-${i}`}
                            type="text"
                            maxLength={1}
                            value={char}
                            className="w-[20px] h-full text-center font-mono font-black text-xs bg-transparent outline-none focus:bg-amber-50 text-black uppercase animate-none"
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const chars = pmrfPin.padEnd(12, ' ').split('');
                              chars[i] = val.slice(-1);
                              const newVal = chars.join('').replace(/\s+$/, '');
                              setPmrfPin(newVal);
                              if (val && i < 11) {
                                const nextEl = document.getElementById(`blank-pin-input-${i + 1}`);
                                if (nextEl) (nextEl as HTMLInputElement).focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !char && i > 0) {
                                const prevEl = document.getElementById(`blank-pin-input-${i - 1}`);
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
                  <label className="text-[10px] font-black text-black block select-none pmrf-konsulta-label">
                    Preferred KonSuLTa Provider
                  </label>
                  <div className="border border-black bg-white p-0.5">
                    <input 
                      type="text" 
                      value={pmrfKonsulta} 
                      onChange={(e) => setPmrfKonsulta(e.target.value)} 
                      placeholder="Enter provider name"
                      className="w-full bg-white px-2 py-1 font-bold text-[11px] uppercase outline-none text-black tracking-normal placeholder-slate-400 pmrf-konsulta-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time PMRF Search Feedback Banner */}
            {lookupMessage.text && (
              <div className={`hidden md:flex px-4 py-2 border-x border-b border-black font-semibold text-[11px] items-center justify-between transition-all select-none print:hidden ${
                lookupMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800' :
                lookupMessage.type === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'
              }`}>
                <div className="flex items-center gap-2">
                  {searchLoading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                  <span>{lookupMessage.text}</span>
                </div>
                
                {matchingRecords.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowMatchModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                  >
                    Select Matching Member ({matchingRecords.length})
                  </button>
                )}
              </div>
            )}

            {/* Section I Header */}
            <div className="bg-[#dee5db] border-x border-b border-black text-black font-extrabold px-3 py-1 text-[10.5px] tracking-wide block select-none text-center uppercase font-sans pmrf-section-header">
              I. PERSONAL DETAILS
            </div>

            {/* Member Information Grid Table - Redesigned to look like a high-fidelity paper layout */}
            <div className="overflow-x-auto border-x border-b border-black bg-white">
              <table className="w-full border-collapse text-[9px] font-sans table-fixed min-w-[700px]">
                <thead>
                  <tr className="bg-white border-b border-black text-center select-none h-9 text-[7.5px] font-bold">
                    <th className="border-r border-black w-[13%]"></th>
                    <th className="border-r border-black w-[20%] font-black uppercase tracking-tight">LAST NAME</th>
                    <th className="border-r border-black w-[22%] font-black uppercase tracking-tight">FIRST NAME</th>
                    <th className="border-r border-black w-[11%] font-black tracking-tight leading-none text-center text-[7.2px]">
                      NAME<br/>EXTENSION<br/>(Jr./Sr./III)
                    </th>
                    <th className="border-r border-black w-[20%] font-black uppercase tracking-tight">MIDDLE NAME</th>
                    <th className="border-r border-black w-[7%] font-black tracking-tight leading-tight text-center text-[6.5px]">
                      NO<br/>MIDDLE<br/>NAME
                    </th>
                    <th className="w-[7%] font-black tracking-tight leading-none text-center text-[6.5px]">
                      MONONYM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* MEMBER ROW */}
                  <tr className="border-b border-black h-10">
                    <td className="border-r border-black px-2 font-black text-[9px] text-black bg-white text-left uppercase leading-none select-none">
                      MEMBER
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfLastName} 
                        onChange={(e) => setPmrfLastName(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/50"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfFirstName} 
                        onChange={(e) => setPmrfFirstName(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/50"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white text-center">
                      <input 
                        type="text" 
                        value={pmrfNameExt} 
                        onChange={(e) => setPmrfNameExt(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1 text-[10px] font-bold uppercase text-center text-black outline-none"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfMiddleName} 
                        onChange={(e) => setPmrfMiddleName(e.target.value)} 
                        disabled={pmrfNoMiddleName || pmrfMononym}
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none disabled:bg-slate-100"
                      />
                    </td>
                    <td className="border-r border-black bg-white text-center p-1 relative">
                      <div className="flex items-center justify-center h-full">
                        <input 
                          type="checkbox" 
                          checked={pmrfNoMiddleName} 
                          onChange={(e) => {
                            setPmrfNoMiddleName(e.target.checked);
                            if (e.target.checked) {
                              setPmrfMiddleName('');
                              setPmrfMononym(false);
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
                          checked={pmrfMononym} 
                          onChange={(e) => {
                            setPmrfMononym(e.target.checked);
                            if (e.target.checked) {
                              setPmrfMiddleName('');
                              setPmrfNoMiddleName(false);
                            }
                          }}
                          className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* MOTHER'S MAIDEN NAME ROW */}
                  <tr className="border-b border-black h-10">
                    <td className="border-r border-black px-2 font-black text-[7.5px] text-black bg-white text-left uppercase leading-tight select-none">
                      MOTHER'S<br/>MAIDEN NAME
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfMotherLastName} 
                        onChange={(e) => setPmrfMotherLastName(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/50"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfMotherFirstName} 
                        onChange={(e) => setPmrfMotherFirstName(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/50"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white text-center">
                      <input 
                        type="text" 
                        value={pmrfMotherNameExt} 
                        onChange={(e) => setPmrfMotherNameExt(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1 text-[10px] font-bold uppercase text-center text-black outline-none"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfMotherMiddleName} 
                        onChange={(e) => setPmrfMotherMiddleName(e.target.value)} 
                        disabled={pmrfMotherNoMN || pmrfMotherMononym}
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none disabled:bg-slate-100"
                      />
                    </td>
                    <td className="border-r border-black bg-white text-center p-1 relative">
                      <div className="flex items-center justify-center h-full">
                        <input 
                          type="checkbox" 
                          checked={pmrfMotherNoMN} 
                          onChange={(e) => {
                            setPmrfMotherNoMN(e.target.checked);
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
                              setPmrfMotherNoMN(false);
                            }
                          }}
                          className="h-4.5 w-4.5 accent-black border border-black cursor-pointer"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* SPOUSE ROW */}
                  <tr className="h-10">
                    <td className="border-r border-black px-2 font-black text-[7.5px] text-black bg-white text-left uppercase leading-tight select-none">
                      SPOUSE<br/><span className="text-[5.5px] font-bold text-slate-700 normal-case">(If married)</span>
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfSpouseLastName} 
                        onChange={(e) => setPmrfSpouseLastName(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/50"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfSpouseFirstName} 
                        onChange={(e) => setPmrfSpouseFirstName(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none focus:bg-amber-50/50"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white text-center">
                      <input 
                        type="text" 
                        value={pmrfSpouseNameExt} 
                        onChange={(e) => setPmrfSpouseNameExt(e.target.value)} 
                        className="w-full h-[32px] bg-transparent border-0 px-1 text-[10px] font-bold uppercase text-center text-black outline-none"
                      />
                    </td>
                    <td className="border-r border-black p-0.5 bg-white">
                      <input 
                        type="text" 
                        value={pmrfSpouseMiddleName} 
                        onChange={(e) => setPmrfSpouseMiddleName(e.target.value)} 
                        disabled={pmrfSpouseNoMN || pmrfSpouseMononym}
                        className="w-full h-[32px] bg-transparent border-0 px-1.5 text-[10px] font-bold uppercase text-black outline-none disabled:bg-slate-100"
                      />
                    </td>
                    <td className="border-r border-black bg-white text-center p-1 relative">
                      <div className="flex items-center justify-center h-full">
                        <input 
                          type="checkbox" 
                          checked={pmrfSpouseNoMN} 
                          onChange={(e) => {
                            setPmrfSpouseNoMN(e.target.checked);
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
                              setPmrfSpouseNoMN(false);
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

            {/* LOWER GRID: Date of birth, Sex, Civil status, Place of birth, Citizenship, PhilSys, TIN */}
            <div className="grid grid-cols-1 md:grid-cols-12 border-x border-b border-black divide-y md:divide-y-0 md:divide-x divide-black bg-white">
              
              {/* Left Segment (Col-span 3): DOB, Sex, Civil Status */}
              <div className="col-span-12 md:col-span-3 flex flex-col justify-between divide-y divide-black">
                
                {/* Date of Birth Group */}
                <div className="p-2 flex-1">
                  <span className="text-[7.5px] font-bold tracking-tight text-black mb-1.5 uppercase select-none font-sans block leading-none pmrf-dob-label">
                    DATE OF BIRTH
                  </span>
                  
                  {/* Segmented Inputs for Date of Birth MM-DD-YYYY */}
                  <div className="flex flex-col mt-1.5">
                    <div className="flex items-center gap-0.5">
                      
                      {/* Month Segment (2 slots) */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none">
                        {Array.from({ length: 2 }).map((_, idx) => {
                          const i = idx;
                          const currentDigits = getDobDigits();
                          const char = currentDigits[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-dob-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char.trim()}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase pmrf-dob-digit-box"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char.trim() && i > 0) {
                                  const prevEl = document.getElementById(`blank-dob-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const dobDigitsArr = getDobDigits();
                                dobDigitsArr[i] = val.slice(-1) || ' ';
                                updateDobFromDigits(dobDigitsArr);
                                if (val) {
                                  const nextEl = document.getElementById(`blank-dob-input-${i + 1}`);
                                  if (nextEl) (nextEl as HTMLInputElement).focus();
                                }
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Spacer / Hyphen */}
                      <span className="text-black font-semibold text-[8px] mx-0.5">-</span>

                      {/* Day Segment (2 slots) */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none">
                        {Array.from({ length: 2 }).map((_, idx) => {
                          const i = idx + 2;
                          const currentDigits = getDobDigits();
                          const char = currentDigits[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-dob-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char.trim()}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase pmrf-dob-digit-box"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char.trim()) {
                                  const prevEl = document.getElementById(`blank-dob-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const dobDigitsArr = getDobDigits();
                                dobDigitsArr[i] = val.slice(-1) || ' ';
                                updateDobFromDigits(dobDigitsArr);
                                if (val) {
                                  const nextEl = document.getElementById(`blank-dob-input-${i + 1}`);
                                  if (nextEl) (nextEl as HTMLInputElement).focus();
                                }
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Spacer / Hyphen */}
                      <span className="text-black font-semibold text-[8px] mx-0.5">-</span>

                      {/* Year Segment (4 slots) */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none">
                        {Array.from({ length: 4 }).map((_, idx) => {
                          const i = idx + 4;
                          const currentDigits = getDobDigits();
                          const char = currentDigits[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-dob-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char.trim()}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase pmrf-dob-digit-box"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char.trim()) {
                                  const prevEl = document.getElementById(`blank-dob-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const dobDigitsArr = getDobDigits();
                                dobDigitsArr[i] = val.slice(-1) || ' ';
                                updateDobFromDigits(dobDigitsArr);
                                if (val && i < 7) {
                                  const nextEl = document.getElementById(`blank-dob-input-${i + 1}`);
                                  if (nextEl) (nextEl as HTMLInputElement).focus();
                                }
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Calendar Picker Trigger icon */}
                      <div className="relative ml-1 shrink-0 print:hidden">
                        <input 
                          type="date"
                          value={pmrfBirthDate}
                          onChange={(e) => setPmrfBirthDate(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-5 h-5 z-10"
                        />
                        <span className="text-[11px] p-0.5 select-none border border-slate-300 rounded hover:bg-slate-50 cursor-pointer block leading-none">📅</span>
                      </div>

                    </div>

                    {/* Beneath Labels: m m / d d / y y y y */}
                    <div className="flex select-none font-sans text-[6.5px] text-slate-800 uppercase tracking-tight mt-0.5 pl-1 leading-none">
                      <span className="w-[14px] text-center">m</span>
                      <span className="w-[14px] text-center">m</span>
                      <span className="w-[14px] text-center"></span>
                      <span className="w-[14px] text-center">d</span>
                      <span className="w-[14px] text-center">d</span>
                      <span className="w-[14px] text-center"></span>
                      <span className="w-[14px] text-center">y</span>
                      <span className="w-[14px] text-center">y</span>
                      <span className="w-[14px] text-center">y</span>
                      <span className="w-[14px] text-center">y</span>
                    </div>
                  </div>
                </div>

                {/* Sex & Civil Status Split Box */}
                <div className="grid grid-cols-12 divide-x divide-black bg-white">
                  
                  {/* SEX */}
                  <div className="col-span-4 p-1.5">
                    <span className="text-[7.5px] font-black text-black select-none block uppercase font-sans leading-none">
                      SEX
                    </span>
                    <div className="flex flex-col gap-1 mt-1.5">
                      <label className="flex items-center gap-1 font-bold text-[7px] text-black cursor-pointer leading-none">
                        <input 
                          type="checkbox" 
                          checked={pmrfSex === 'MALE'}
                          onChange={() => setPmrfSex('MALE')}
                          className="h-3.2 w-3.2 accent-black cursor-pointer"
                        />
                        <span>Male</span>
                      </label>
                      <label className="flex items-center gap-1 font-bold text-[7px] text-black cursor-pointer leading-none">
                        <input 
                          type="checkbox" 
                          checked={pmrfSex === 'FEMALE'}
                          onChange={() => setPmrfSex('FEMALE')}
                          className="h-3.2 w-3.2 accent-black cursor-pointer"
                        />
                        <span>Female</span>
                      </label>
                    </div>
                  </div>

                  {/* CIVIL STATUS */}
                  <div className="col-span-8 p-1.5 bg-white">
                    <span className="text-[7.5px] font-black text-black select-none block uppercase font-sans leading-none">
                      CIVIL STATUS
                    </span>
                    <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-1.5">
                      <label className="flex items-center gap-0.5 font-bold text-[6.5px] text-black cursor-pointer leading-none">
                        <input type="checkbox" checked={pmrfCivilStatus === 'SINGLE'} onChange={() => setPmrfCivilStatus('SINGLE')} className="h-3 w-3 accent-black cursor-pointer" />
                        <span>Single</span>
                      </label>
                      <label className="flex items-center gap-0.5 font-bold text-[6.5px] text-black cursor-pointer leading-none">
                        <input type="checkbox" checked={pmrfCivilStatus === 'ANNULLED'} onChange={() => setPmrfCivilStatus('ANNULLED')} className="h-3 w-3 accent-black cursor-pointer" />
                        <span>Annulled</span>
                      </label>
                      <label className="flex items-center gap-0.5 font-bold text-[6.5px] text-black cursor-pointer leading-none">
                        <input type="checkbox" checked={pmrfCivilStatus === 'MARRIED'} onChange={() => setPmrfCivilStatus('MARRIED')} className="h-3 w-3 accent-black cursor-pointer" />
                        <span>Married</span>
                      </label>
                      <label className="flex items-center gap-0.5 font-bold text-[6.5px] text-black cursor-pointer leading-none">
                        <input type="checkbox" checked={pmrfCivilStatus === 'WIDOWER'} onChange={() => setPmrfCivilStatus('WIDOWER')} className="h-3 w-3 accent-black cursor-pointer" />
                        <span>Widow/er</span>
                      </label>
                      <label className="flex items-center gap-0.5 font-bold text-[6.5px] text-black cursor-pointer leading-none col-span-2">
                        <input type="checkbox" checked={pmrfCivilStatus === 'LEGALLY_SEPARATED'} onChange={() => setPmrfCivilStatus('LEGALLY_SEPARATED')} className="h-3 w-3 accent-black cursor-pointer" />
                        <span>Legally Separated</span>
                      </label>
                    </div>
                  </div>

                </div>

              </div>

              {/* Middle Segment (Col-span 4): Place of Birth & Citizenship */}
              <div className="col-span-12 md:col-span-4 flex flex-col justify-between divide-y divide-black">
                
                {/* Place of Birth */}
                <div className="p-2 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[7.5px] font-extrabold text-black uppercase leading-tight block font-sans">
                      PLACE OF BIRTH <span className="text-[6px] text-slate-800 font-medium normal-case">(City/Municipality/Province/Country)</span>
                    </span>
                    <span className="text-[5.5px] text-slate-750 font-semibold normal-case block leading-tight mt-0.5">
                      (Please indicate country if born outside the Philippines)
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={pmrfBirthPlace} 
                    onChange={(e) => setPmrfBirthPlace(e.target.value)} 
                    placeholder="e.g., Pagadian City"
                    className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase mt-1.5 pb-0.5 outline-none focus:bg-amber-50/50"
                  />
                </div>

                {/* Citizenship */}
                <div className="p-2">
                  <span className="text-[7.5px] font-black text-black uppercase leading-none block select-none font-sans">
                    CITIZENSHIP
                  </span>
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                      <input type="checkbox" checked={pmrfCitizenship === 'FILIPINO'} onChange={() => setPmrfCitizenship('FILIPINO')} className="h-3 w-3 accent-black cursor-pointer" />
                      <span>FILIPINO</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                      <input type="checkbox" checked={pmrfCitizenship === 'DUAL_CITIZEN'} onChange={() => setPmrfCitizenship('DUAL_CITIZEN')} className="h-3 w-3 accent-black cursor-pointer" />
                      <span>DUAL CITIZEN</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                      <input type="checkbox" checked={pmrfCitizenship === 'FOREIGN_NATIONAL'} onChange={() => setPmrfCitizenship('FOREIGN_NATIONAL')} className="h-3 w-3 accent-black cursor-pointer" />
                      <span>FOREIGN NATIONAL</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Right Segment (Col-span 5): PhilSys card number & TIN */}
              <div className="col-span-12 md:col-span-5 flex flex-col justify-between divide-y divide-black bg-white">
                
                {/* PhilSys */}
                <div className="p-2 flex-1">
                  <span className="text-[7.5px] font-black text-black uppercase block leading-none select-none font-sans">
                    PHILSYS D NUMBER (Optional)
                  </span>
                  
                  {/* Segmented 12 boxes matching PhilSys exactly */}
                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none text-[8px]">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const rawNo = pmrfPhilsysNo.replace(/\D/g, '');
                        const char = rawNo[i] || '';
                        return (
                          <input
                            key={i}
                            id={`blank-philsys-input-${i}`}
                            type="text"
                            maxLength={1}
                            value={char}
                            className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase"
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !char && i > 0) {
                                const prevEl = document.getElementById(`blank-philsys-input-${i - 1}`);
                                if (prevEl) (prevEl as HTMLInputElement).focus();
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              const chars = rawNo.padEnd(12, ' ').split('');
                              chars[i] = val.slice(-1);
                              const newVal = chars.join('').replace(/\s+$/, '');
                              setPmrfPhilsysNo(newVal);
                              if (val && i < 11) {
                                const nextEl = document.getElementById(`blank-philsys-input-${i + 1}`);
                                if (nextEl) (nextEl as HTMLInputElement).focus();
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* TIN */}
                <div className="p-2">
                  <span className="text-[7.5px] font-black text-black uppercase block leading-none select-none font-sans">
                    TAX PAYER IDENTIFICATION NUMBER (TIN) (Optional)
                  </span>
                  
                  {/* Segmented boxes divided into 4 groups of 3 with hyphen indicators */}
                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex gap-0.5 items-center">
                      
                      {/* Group 1 */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none font-sans">
                        {Array.from({ length: 3 }).map((_, idx) => {
                          const i = idx;
                          const rawNo = pmrfTin.replace(/\D/g, '');
                          const char = rawNo[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-tin-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char && i > 0) {
                                  const prevEl = document.getElementById(`blank-tin-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const chars = rawNo.padEnd(12, ' ').split('');
                                chars[i] = val.slice(-1);
                                const newVal = chars.join('').replace(/\s+$/, '');
                                setPmrfTin(newVal);
                                if (val && i < 11) {
                                  const nextEl = document.getElementById(`blank-tin-input-${i + 1}`);
                                  if (nextEl) (nextEl as HTMLInputElement).focus();
                                }
                              }}
                            />
                          );
                        })}
                      </div>

                      <span className="text-black font-semibold text-[8px] mx-0.2 select-none">-</span>

                      {/* Group 2 */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none font-sans">
                        {Array.from({ length: 3 }).map((_, idx) => {
                          const i = idx + 3;
                          const rawNo = pmrfTin.replace(/\D/g, '');
                          const char = rawNo[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-tin-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char) {
                                  const prevEl = document.getElementById(`blank-tin-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const chars = rawNo.padEnd(12, ' ').split('');
                                chars[i] = val.slice(-1);
                                const newVal = chars.join('').replace(/\s+$/, '');
                                setPmrfTin(newVal);
                                if (val && i < 11) {
                                  const nextEl = document.getElementById(`blank-tin-input-${i + 1}`);
                                  if (nextEl) (nextEl as HTMLInputElement).focus();
                                }
                              }}
                            />
                          );
                        })}
                      </div>

                      <span className="text-black font-semibold text-[8px] mx-0.2 select-none">-</span>

                      {/* Group 3 */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none font-sans">
                        {Array.from({ length: 3 }).map((_, idx) => {
                          const i = idx + 6;
                          const rawNo = pmrfTin.replace(/\D/g, '');
                          const char = rawNo[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-tin-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char) {
                                  const prevEl = document.getElementById(`blank-tin-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const chars = rawNo.padEnd(12, ' ').split('');
                                chars[i] = val.slice(-1);
                                const newVal = chars.join('').replace(/\s+$/, '');
                                setPmrfTin(newVal);
                                if (val && i < 11) {
                                  const nextEl = document.getElementById(`blank-tin-input-${i + 1}`);
                                  if (nextEl) (nextEl as HTMLInputElement).focus();
                                }
                              }}
                            />
                          );
                        })}
                      </div>

                      <span className="text-black font-semibold text-[8px] mx-0.2 select-none">-</span>

                      {/* Group 4 */}
                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none font-sans">
                        {Array.from({ length: 3 }).map((_, idx) => {
                          const i = idx + 9;
                          const rawNo = pmrfTin.replace(/\D/g, '');
                          const char = rawNo[i] || '';
                          return (
                            <input
                              key={i}
                              id={`blank-tin-input-${i}`}
                              type="text"
                              maxLength={1}
                              value={char}
                              className="w-[14px] h-5 text-center font-mono font-black text-[10px] bg-transparent outline-none focus:bg-amber-50 text-black uppercase"
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !char) {
                                  const prevEl = document.getElementById(`blank-tin-input-${i - 1}`);
                                  if (prevEl) (prevEl as HTMLInputElement).focus();
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                const chars = rawNo.padEnd(12, ' ').split('');
                                chars[i] = val.slice(-1);
                                const newVal = chars.join('').replace(/\s+$/, '');
                                setPmrfTin(newVal);
                              }}
                            />
                          );
                        })}
                      </div>

                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Section II Header */}
            <div className="bg-[#dee5db] border-x border-b border-black text-black font-extrabold px-3 py-1 text-[10.5px] tracking-wide block select-none text-center uppercase font-sans pmrf-section-header">
              II. ADDRESS and CONTACT DETAILS
            </div>

            {/* Address & Contact Details Block */}
            <div className="overflow-x-auto">
              <div className="min-w-[750px] border-x border-b border-black bg-white flex flex-col divide-y divide-black">
                
                {/* ROW 1: Permanent Address Header + Row 1 inputs (left 8 columns) and Home Phone (right 4 columns) */}
                <div className="grid grid-cols-12 divide-x divide-black min-h-[64px]">
                  {/* Left Side: col-span-8 */}
                  <div className="col-span-8 p-1.5 flex flex-col justify-between bg-white font-sans">
                    <span className="text-[10px] font-black text-black select-none uppercase tracking-tight block leading-none mb-1">
                      PERMANENT HOME ADDRESS
                    </span>
                    <div className="grid grid-cols-12 gap-2 mt-1">
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Unit/Room No./Floor</label>
                        <input 
                          id="pmrf-addr-unit"
                          type="text" 
                          value={pmrfAddressUnit} 
                          onChange={(e) => {
                            const v = e.target.value;
                            setPmrfAddressUnit(v);
                            if (pmrfMailingSame) {
                              setPmrfMailingUnit(v);
                            }
                          }} 
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Building Name</label>
                        <input 
                          id="pmrf-addr-building"
                          type="text" 
                          value={pmrfAddressBuilding} 
                          onChange={(e) => {
                            const v = e.target.value;
                            setPmrfAddressBuilding(v);
                            if (pmrfMailingSame) {
                              setPmrfMailingBuilding(v);
                            }
                          }} 
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Lot/Block/Phase/House Number</label>
                        <input 
                          id="pmrf-addr-lot"
                          type="text" 
                          value={pmrfAddressLot} 
                          onChange={(e) => {
                            const v = e.target.value;
                            setPmrfAddressLot(v);
                            if (pmrfMailingSame) {
                              setPmrfMailingLot(v);
                            }
                          }} 
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Street Name</label>
                        <input 
                          id="pmrf-addr-street"
                          type="text" 
                          value={pmrfAddressStreet} 
                          onChange={(e) => {
                            const v = e.target.value;
                            setPmrfAddressStreet(v);
                            if (pmrfMailingSame) {
                              setPmrfMailingStreet(v);
                            }
                          }} 
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Right Side: col-span-4 (Home phone) */}
                  <div className="col-span-4 p-1.5 flex flex-col justify-between bg-white text-black font-sans">
                    <div className="flex flex-col justify-start">
                      <label className="text-[8.5px] font-black text-black block mb-0.5 select-none leading-none uppercase md:normal-case pmrf-home-phone-label">
                        Home Phone Number
                      </label>
                      <input 
                        id="pmrf-phone-home"
                        type="text" 
                        value={pmrfHomePhone} 
                        onChange={(e) => setPmrfHomePhone(e.target.value)} 
                        placeholder="+63 (2) 123-4567"
                        className="w-full h-[22px] border border-black px-1.5 text-[9.5px] font-bold font-mono outline-none bg-white text-black pmrf-home-phone-input"
                      />
                    </div>
                    <span className="text-[5.5px] font-extrabold text-slate-800 block tracking-tighter mt-0.5 select-none leading-none">
                      (COUNTRY CODE + AREA CODE + TELEPHONE NUMBER)
                    </span>
                  </div>
                </div>

                {/* ROW 2: Permanent Address Row 2 inputs (left 8 columns) and Mobile Number (right 4 columns) */}
                <div className="grid grid-cols-12 divide-x divide-black min-h-[46px]">
                  {/* Left Side: col-span-8 */}
                  <div className="col-span-8 p-1.5 grid grid-cols-12 gap-2 bg-white font-sans">
                    <div className="col-span-2 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans font-sans">Subdivision</label>
                      <input 
                        id="pmrf-addr-subdivision"
                        type="text" 
                        value={pmrfAddressSubdivision} 
                        onChange={(e) => {
                          const v = e.target.value;
                          setPmrfAddressSubdivision(v);
                          if (pmrfMailingSame) {
                            setPmrfMailingSubdivision(v);
                          }
                        }} 
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-3 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Barangay</label>
                      <input 
                        id="pmrf-addr-barangay"
                        type="text" 
                        value={pmrfAddressBarangay} 
                        readOnly={true}
                        title="Destination Barangay is locked to your assigned Account Residential Area"
                        className="w-full bg-amber-50/20 border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none text-slate-700 cursor-not-allowed select-none"
                      />
                    </div>
                    <div className="col-span-3 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Municipality/City</label>
                      <input 
                        id="pmrf-addr-municipality"
                        type="text" 
                        value={pmrfAddressMunicipality} 
                        onChange={(e) => {
                          const v = e.target.value;
                          setPmrfAddressMunicipality(v);
                          if (pmrfMailingSame) {
                            setPmrfMailingMunicipality(v);
                          }
                        }} 
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-3 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Province/State/Country <span className="text-[5.5px] text-slate-800 font-medium normal-case">(if abroad)</span></label>
                      <input 
                        id="pmrf-addr-province"
                        type="text" 
                        value={pmrfAddressProvince} 
                        onChange={(e) => {
                          const v = e.target.value;
                          setPmrfAddressProvince(v);
                          if (pmrfMailingSame) {
                            setPmrfMailingProvince(v);
                          }
                        }} 
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-1 flex flex-col justify-end font-sans">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case text-center">ZIP Code</label>
                      <input 
                        id="pmrf-addr-zip"
                        type="text" 
                        value={pmrfAddressZip} 
                        onChange={(e) => {
                          const v = e.target.value;
                          setPmrfAddressZip(v);
                          if (pmrfMailingSame) {
                            setPmrfMailingZip(v);
                          }
                        }} 
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold text-center uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  {/* Right Side: col-span-4 (Mobile Number) */}
                  <div className="col-span-4 p-1.5 flex flex-col justify-center bg-white text-black font-sans">
                    <label className="text-[8.5px] font-black text-black block mb-0.5 select-none leading-none uppercase md:normal-case pmrf-mobile-label">
                      Mobile Number (Required)
                    </label>
                    <input 
                      id="pmrf-phone-mobile"
                      type="text" 
                      value={pmrfMobileNo} 
                      onChange={(e) => setPmrfMobileNo(e.target.value)} 
                      placeholder="+63 912 345 6789"
                      className="w-full h-[22px] border border-black px-1.5 text-[9.5px] font-bold font-mono outline-none bg-white text-black focus:bg-amber-50/50 pmrf-mobile-input"
                    />
                  </div>
                </div>

                {/* ROW 3: Mailing Address Header + Row 1 inputs (left 8 columns) and Business Direct (right 4 columns) */}
                <div className="grid grid-cols-12 divide-x divide-black min-h-[64px]">
                  {/* Left Side: col-span-8 */}
                  <div className="col-span-8 p-1.5 flex flex-col justify-between bg-white font-sans">
                    <div className="flex items-center gap-4 select-none mb-1">
                      <span className="text-[10px] font-black text-black uppercase tracking-tight block leading-none">
                        MAILING ADDRESS
                      </span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input 
                          id="pmrf-mailing-same-toggle"
                          type="checkbox" 
                          checked={pmrfMailingSame} 
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPmrfMailingSame(checked);
                            if (checked) {
                              setPmrfMailingUnit(pmrfAddressUnit);
                              setPmrfMailingBuilding(pmrfAddressBuilding);
                              setPmrfMailingLot(pmrfAddressLot);
                              setPmrfMailingStreet(pmrfAddressStreet);
                              setPmrfMailingSubdivision(pmrfAddressSubdivision);
                              setPmrfMailingBarangay(pmrfAddressBarangay);
                              setPmrfMailingMunicipality(pmrfAddressMunicipality);
                              setPmrfMailingProvince(pmrfAddressProvince);
                              setPmrfMailingZip(pmrfAddressZip);
                            }
                          }} 
                          className="h-3.5 w-3.5 border border-black accent-black cursor-pointer align-middle" 
                        />
                        <span className="text-[8.5px] font-black text-black uppercase tracking-tight">SAME AS ABOVE</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-12 gap-2 mt-1">
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Unit/Room No./Floor</label>
                        <input 
                          id="pmrf-mail-unit"
                          type="text" 
                          value={pmrfMailingSame ? pmrfAddressUnit : pmrfMailingUnit} 
                          onChange={(e) => setPmrfMailingUnit(e.target.value)} 
                          disabled={pmrfMailingSame}
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Building Name</label>
                        <input 
                          id="pmrf-mail-building"
                          type="text" 
                          value={pmrfMailingSame ? pmrfAddressBuilding : pmrfMailingBuilding} 
                          onChange={(e) => setPmrfMailingBuilding(e.target.value)} 
                          disabled={pmrfMailingSame}
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Lot/Block/Phase/House Number</label>
                        <input 
                          id="pmrf-mail-lot"
                          type="text" 
                          value={pmrfMailingSame ? pmrfAddressLot : pmrfMailingLot} 
                          onChange={(e) => setPmrfMailingLot(e.target.value)} 
                          disabled={pmrfMailingSame}
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                        />
                      </div>
                      <div className="col-span-3 flex flex-col justify-end">
                        <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Street Name</label>
                        <input 
                          id="pmrf-mail-street"
                          type="text" 
                          value={pmrfMailingSame ? pmrfAddressStreet : pmrfMailingStreet} 
                          onChange={(e) => setPmrfMailingStreet(e.target.value)} 
                          disabled={pmrfMailingSame}
                          className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Right Side: col-span-4 (Business direct line) */}
                  <div className="col-span-4 p-1.5 flex flex-col justify-center bg-white text-black font-sans">
                    <label className="text-[8.5px] font-black text-black block mb-0.5 select-none leading-none uppercase md:normal-case pmrf-business-label">
                      Business (Direct Line)
                    </label>
                    <input 
                      id="pmrf-phone-business"
                      type="text" 
                      value={pmrfBusinessPhone} 
                      onChange={(e) => setPmrfBusinessPhone(e.target.value)} 
                      placeholder="+63 (2) 888-8888"
                      className="w-full h-[22px] border border-black px-1.5 text-[9.5px] font-bold font-mono outline-none bg-white text-black pmrf-business-input"
                    />
                  </div>
                </div>

                {/* ROW 4: Mailing Address Row 2 inputs (left 8 columns) and Email Address (right 4 columns) */}
                <div className="grid grid-cols-12 divide-x divide-black min-h-[46px]">
                  {/* Left Side: col-span-8 */}
                  <div className="col-span-8 p-1.5 grid grid-cols-12 gap-2 bg-white font-sans">
                    <div className="col-span-2 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Subdivision</label>
                      <input 
                        id="pmrf-mail-subdivision"
                        type="text" 
                        value={pmrfMailingSame ? pmrfAddressSubdivision : pmrfMailingSubdivision} 
                        onChange={(e) => setPmrfMailingSubdivision(e.target.value)} 
                        disabled={pmrfMailingSame}
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-3 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Barangay</label>
                      <input 
                        id="pmrf-mail-barangay"
                        type="text" 
                        value={pmrfMailingSame ? pmrfAddressBarangay : pmrfMailingBarangay} 
                        onChange={(e) => setPmrfMailingBarangay(e.target.value)} 
                        disabled={pmrfMailingSame}
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-3 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Municipality/City</label>
                      <input 
                        id="pmrf-mail-municipality"
                        type="text" 
                        value={pmrfMailingSame ? pmrfAddressMunicipality : pmrfMailingMunicipality} 
                        onChange={(e) => setPmrfMailingMunicipality(e.target.value)} 
                        disabled={pmrfMailingSame}
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-3 flex flex-col justify-end">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case font-sans">Province/State/Country <span className="text-[5.5px] text-slate-800 font-medium normal-case">(if abroad)</span></label>
                      <input 
                        id="pmrf-mail-province"
                        type="text" 
                        value={pmrfMailingSame ? pmrfAddressProvince : pmrfMailingProvince} 
                        onChange={(e) => setPmrfMailingProvince(e.target.value)} 
                        disabled={pmrfMailingSame}
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="col-span-1 flex flex-col justify-end font-sans">
                      <label className="text-[7.5px] font-bold text-black leading-none mb-0.5 select-none uppercase lg:normal-case text-center">ZIP Code</label>
                      <input 
                        id="pmrf-mail-zip"
                        type="text" 
                        value={pmrfMailingSame ? pmrfAddressZip : pmrfMailingZip} 
                        onChange={(e) => setPmrfMailingZip(e.target.value)} 
                        disabled={pmrfMailingSame}
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold text-center uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black disabled:bg-slate-50/50 disabled:text-gray-600 placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  {/* Right Side: col-span-4 (Email Address) */}
                  <div className="col-span-4 p-1.5 flex flex-col justify-center bg-white text-black font-sans">
                    <label className="text-[8.5px] font-black text-black block mb-0.5 select-none leading-none uppercase md:normal-case pmrf-email-label">
                      E-mail Address (Required for OFW)
                    </label>
                    <input 
                      id="pmrf-email-address"
                      type="email" 
                      value={pmrfEmail} 
                      onChange={(e) => setPmrfEmail(e.target.value)} 
                      placeholder="example@domain.com"
                      className="w-full h-[22px] border border-black px-1.5 text-[9.5px] font-bold outline-none bg-white text-black tracking-tight lowercase focus:bg-amber-50/50 pmrf-email-input"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Section III Header */}
            <div className="bg-[#dee5db] border-x border-b border-black text-black font-extrabold px-3 py-1.5 text-[9.5px] tracking-wide block select-none text-center uppercase pmrf-section-header">
              III. DECLARATION OF DEPENDENTS
            </div>

            {/* Section III Dependents list table */}
            <div className="overflow-x-auto border-x border-b border-black bg-white">
              <table className="w-full border-collapse text-[7.5px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-black font-black text-slate-800 text-center select-none">
                    <th className="border-r border-black py-1 px-1 text-center w-[4%]">#</th>
                    <th className="border-r border-black py-1 px-1 w-[20%] text-left">LAST NAME</th>
                    <th className="border-r border-black py-1 px-1 w-[20%] text-left">FIRST NAME</th>
                    <th className="border-r border-black py-1 px-0.5 w-[6%]">EXT</th>
                    <th className="border-r border-black py-1 px-1 w-[16%] text-left">MIDDLE NAME</th>
                    <th className="border-r border-black py-1 px-0.5 w-[8%]">RELATIONSHIP</th>
                    <th className="border-r border-black py-1 px-1 w-[12%] text-center">BIRTHDATE</th>
                    <th className="border-r border-black py-1 px-1 w-[10%]">CITIZENSHIP</th>
                    <th className="py-1 px-0.5 w-[4%]">DISABLED?</th>
                  </tr>
                </thead>
                <tbody>
                  {pmrfDependents.map((dep, index) => (
                    <tr key={index} className="border-b last:border-b-0 border-black">
                      <td className="border-r border-black px-1.5 py-1.5 font-bold bg-slate-50 text-center select-none">{index + 1}</td>
                      <td className="border-r border-black p-0.5">
                        <input type="text" value={dep.lastName} onChange={(e) => updateDependentField(index, 'lastName', e.target.value)} className="w-full border-0 p-0.5 text-[8.5px] font-bold uppercase outline-none bg-transparent pmrf-dependent-data" placeholder="Last Name" />
                      </td>
                      <td className="border-r border-black p-0.5">
                        <input type="text" value={dep.firstName} onChange={(e) => updateDependentField(index, 'firstName', e.target.value)} className="w-full border-0 p-0.5 text-[8.5px] font-bold uppercase outline-none bg-transparent pmrf-dependent-data" placeholder="First Name" />
                      </td>
                      <td className="border-r border-black p-0.5 text-center">
                        <input type="text" value={dep.nameExt} onChange={(e) => updateDependentField(index, 'nameExt', e.target.value)} className="w-full border-0 p-0.5 text-[8.5px] font-bold uppercase text-center outline-none bg-transparent pmrf-dependent-data" placeholder="Jr/Sr" />
                      </td>
                      <td className="border-r border-black p-0.5">
                        <input type="text" value={dep.middleName} onChange={(e) => updateDependentField(index, 'middleName', e.target.value)} className="w-full border-0 p-0.5 text-[8.5px] font-bold uppercase outline-none bg-transparent pmrf-dependent-data" placeholder="Middle" />
                      </td>
                      <td className="border-r border-black p-0.5">
                        <input type="text" value={dep.relationship} onChange={(e) => updateDependentField(index, 'relationship', e.target.value)} className="w-full border-0 p-0.5 text-[8px] font-bold uppercase outline-none bg-transparent pmrf-dependent-data" placeholder="e.g. CHILD" />
                      </td>
                      <td className="border-r border-black p-0.5 text-center">
                        <input type="date" value={dep.birthDate} onChange={(e) => updateDependentField(index, 'birthDate', e.target.value)} className="w-full border-0 p-0.5 text-[8.5px] font-bold outline-none bg-transparent pmrf-dependent-data" />
                      </td>
                      <td className="border-r border-black p-0.5 text-center">
                        <input type="text" value={dep.citizenship} onChange={(e) => updateDependentField(index, 'citizenship', e.target.value)} className="w-full border-0 p-0.5 text-[8px] font-bold uppercase outline-none bg-transparent pmrf-dependent-data" placeholder="FILIPINO" />
                      </td>
                      <td className="p-0.5 text-center">
                        <input type="checkbox" checked={dep.disabled} onChange={(e) => updateDependentField(index, 'disabled', e.target.checked)} className="h-3 w-3 accent-blue-700" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section IV Header */}
            <div className="bg-[#dee5db] border-x border-b border-black text-black font-extrabold px-3 py-1 text-[10.5px] tracking-wide block select-none text-center uppercase font-sans pmrf-section-header">
              IV. MEMBER TYPE
            </div>

            {/* Section IV Member Type Block */}
            <div className="overflow-x-auto">
              <div className="min-w-[780px] border-x border-b border-black bg-white grid grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
                
                {/* Left Column: DIRECT CONTRIBUTOR (col-span-7) */}
                <div className="col-span-12 md:col-span-7 flex flex-col justify-between">
                  
                  {/* Top Part: Title and Checkboxes */}
                  <div className="p-2 flex flex-col flex-1">
                    <span className="text-[10.5px] font-black text-black select-none uppercase tracking-wider block text-center mb-1 bg-[#f4f7f4]/40 py-0.5 font-sans">
                      DIRECT CONTRIBUTOR
                    </span>
                    
                    <div className="flex gap-2 mt-1">
                      
                      {/* Column 1 of DIRECT (w-[42%]) */}
                      <div className="w-[42%] flex flex-col gap-1 pr-1 border-r border-dashed border-gray-200">
                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-dir-employed-private"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'EMPLOYED_PRIVATE'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'EMPLOYED_PRIVATE';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'EMPLOYED_PRIVATE'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Employed Private</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-dir-employed-gov"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'EMPLOYED_GOV'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'EMPLOYED_GOV';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'EMPLOYED_GOV'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Employed Government</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-dir-prof"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'PROF_PRACTITIONER'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'PROF_PRACTITIONER';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'PROF_PRACTITIONER'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Professional Practitioner</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-dir-self-earning"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'SELF_EARNING'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Self-Earning Individual</span>
                        </label>

                        {/* Indented Subcategories for Self-Earning */}
                        <div className="pl-4 flex flex-col gap-1 border-l border-gray-200 ml-1.5 mt-0.5">
                          <label className="flex items-center gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                            <input 
                              id="pmrf-dir-self-individual"
                              type="checkbox" 
                              checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING_INDIVIDUAL'}
                              onChange={() => {
                                const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING_INDIVIDUAL';
                                setPmrfMemberType({
                                  ...pmrfMemberType,
                                  category: active ? '' : 'DIRECT',
                                  subCategory: active ? '' : 'SELF_EARNING_INDIVIDUAL'
                                });
                              }} 
                              className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0" 
                            />
                            <span>Individual</span>
                          </label>

                          <label className="flex items-center gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                            <input 
                              id="pmrf-dir-self-sole"
                              type="checkbox" 
                              checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING_SOLE'}
                              onChange={() => {
                                const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING_SOLE';
                                setPmrfMemberType({
                                  ...pmrfMemberType,
                                  category: active ? '' : 'DIRECT',
                                  subCategory: active ? '' : 'SELF_EARNING_SOLE'
                                });
                              }} 
                              className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0" 
                            />
                            <span>Sole Proprietor</span>
                          </label>

                          <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                            <input 
                              id="pmrf-dir-self-group"
                              type="checkbox" 
                              checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING_GROUP'}
                              onChange={() => {
                                const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'SELF_EARNING_GROUP';
                                setPmrfMemberType({
                                  ...pmrfMemberType,
                                  category: active ? '' : 'DIRECT',
                                  subCategory: active ? '' : 'SELF_EARNING_GROUP'
                                });
                              }} 
                              className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                            />
                            <span className="leading-tight">Group Enrollment Scheme</span>
                          </label>
                        </div>
                      </div>

                      {/* Column 2 & 3 of DIRECT (w-[58%]) */}
                      <div className="w-[58%] flex flex-col gap-1 pl-1">
                        
                        {/* Kasambahay & Family Driver Row */}
                        <div className="flex items-start">
                          <div className="w-[68%]">
                            <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                              <input 
                                id="pmrf-dir-kasambahay"
                                type="checkbox" 
                                checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'KASAMBAHAY'}
                                onChange={() => {
                                  const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'KASAMBAHAY';
                                  setPmrfMemberType({
                                    ...pmrfMemberType,
                                    category: active ? '' : 'DIRECT',
                                    subCategory: active ? '' : 'KASAMBAHAY'
                                  });
                                }} 
                                className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                              />
                              <span className="leading-tight">Kasambahay</span>
                            </label>
                          </div>
                          <div className="w-[32%] pl-1">
                            <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                              <input 
                                id="pmrf-dir-driver"
                                type="checkbox" 
                                checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'FAMILY_DRIVER'}
                                onChange={() => {
                                  const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'FAMILY_DRIVER';
                                  setPmrfMemberType({
                                    ...pmrfMemberType,
                                    category: active ? '' : 'DIRECT',
                                    subCategory: active ? '' : 'FAMILY_DRIVER'
                                  });
                                }} 
                                className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                              />
                              <span className="leading-tight">Family Driver</span>
                            </label>
                          </div>
                        </div>

                        {/* Migrant Worker label and Land/Sea subcategory checks */}
                        <div className="text-[8.5px] font-black uppercase text-black select-none mt-0.5 mb-0.5 leading-none font-sans">
                          Migrant Worker
                        </div>

                        <div className="flex items-center">
                          <div className="w-[68%] pl-3">
                            <label className="flex items-center gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                              <input 
                                id="pmrf-dir-migrant-land"
                                type="checkbox" 
                                checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'MIGRANT_LAND'}
                                onChange={() => {
                                  const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'MIGRANT_LAND';
                                  setPmrfMemberType({
                                    ...pmrfMemberType,
                                    category: active ? '' : 'DIRECT',
                                    subCategory: active ? '' : 'MIGRANT_LAND'
                                  });
                                }} 
                                className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0" 
                              />
                              <span>Land-Based</span>
                            </label>
                          </div>
                          <div className="w-[32%] pl-1">
                            <label className="flex items-center gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                              <input 
                                id="pmrf-dir-migrant-sea"
                                type="checkbox" 
                                checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'MIGRANT_SEA'}
                                onChange={() => {
                                  const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'MIGRANT_SEA';
                                  setPmrfMemberType({
                                    ...pmrfMemberType,
                                    category: active ? '' : 'DIRECT',
                                    subCategory: active ? '' : 'MIGRANT_SEA'
                                  });
                                }} 
                                className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0" 
                              />
                              <span>Sea-Based</span>
                            </label>
                          </div>
                        </div>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none mt-0.5">
                          <input 
                            id="pmrf-dir-lifetime"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'LIFETIME'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'LIFETIME';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'LIFETIME'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Lifetime Member</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-dir-dual"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'FILIPINO_DUAL'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'FILIPINO_DUAL';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'FILIPINO_DUAL'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Filipinos with Dual Citizenship / Living Abroad</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-dir-foreign"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'FOREIGN'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'DIRECT' && pmrfMemberType.subCategory === 'FOREIGN';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'DIRECT',
                                subCategory: active ? '' : 'FOREIGN'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Foreign National</span>
                        </label>

                        {/* Special Number fields for Foreign / PRA */}
                        <div className="flex flex-col gap-1 pl-4 mt-0.5">
                          <div className="flex items-center gap-1.5 h-5">
                            <span className="text-[7.5px] font-bold text-black uppercase whitespace-nowrap select-none font-sans">
                              PRA SRRV No.
                            </span>
                            <input 
                              id="pmrf-pra-no"
                              type="text" 
                              value={pmrfMemberType.praSrrvNo || ''} 
                              onChange={(e) => setPmrfMemberType({ ...pmrfMemberType, praSrrvNo: e.target.value })} 
                              className="flex-1 bg-transparent border-0 border-b border-black text-[9px] font-bold p-0 mb-0.5 px-1 outline-none uppercase font-mono tracking-wider h-4 focus:bg-amber-50/50 text-black" 
                            />
                          </div>

                          <div className="flex items-center gap-1.5 h-5">
                            <span className="text-[7.5px] font-bold text-black uppercase whitespace-nowrap select-none font-sans">
                              ACR I-Card No.
                            </span>
                            <input 
                              id="pmrf-acr-no"
                              type="text" 
                              value={pmrfMemberType.acrICardNo || ''} 
                              onChange={(e) => setPmrfMemberType({ ...pmrfMemberType, acrICardNo: e.target.value })} 
                              className="flex-1 bg-transparent border-0 border-b border-black text-[9px] font-bold p-0 mb-0.5 px-1 outline-none uppercase font-mono tracking-wider h-4 focus:bg-amber-50/50 text-black" 
                            />
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>

                  {/* Bottom Part: Profession, Income and Proof */}
                  <div className="border-t border-black bg-white grid grid-cols-12 divide-x divide-black select-none">
                    
                    {/* Profession Cell (col-span-6) */}
                    <div className="col-span-6 p-1.5 flex flex-col justify-between min-h-[58px]">
                      <span className="text-[8px] font-black text-black leading-tight">
                        PROFESSION: <span className="text-[6.5px] font-bold text-slate-800 tracking-tight lowercase normal-case leading-normal font-sans">(Except Employed, Lifetime Members and Sea-based Migrant Worker)</span>
                      </span>
                      <input 
                        id="pmrf-prof-input"
                        type="text" 
                        value={pmrfMemberType.profession || ''} 
                        onChange={(e) => setPmrfMemberType({ ...pmrfMemberType, profession: e.target.value })} 
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 mt-1 text-black"
                      />
                    </div>

                    {/* Monthly Income Cell (col-span-3) */}
                    <div className="col-span-3 p-1.5 flex flex-col justify-between min-h-[58px]">
                      <span className="text-[8px] font-black text-black leading-tight">
                        MONTHLY INCOME:
                      </span>
                      <input 
                        id="pmrf-income-input"
                        type="text" 
                        value={pmrfMemberType.monthlyIncome || ''} 
                        onChange={(e) => setPmrfMemberType({ ...pmrfMemberType, monthlyIncome: e.target.value })} 
                        placeholder="PHP"
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 mt-1 placeholder:text-gray-200 text-black"
                      />
                    </div>

                    {/* Proof of Income Cell (col-span-3) */}
                    <div className="col-span-3 p-1.5 flex flex-col justify-between min-h-[58px]">
                      <span className="text-[8px] font-black text-black leading-tight">
                        PROOF OF INCOME:
                      </span>
                      <input 
                        id="pmrf-proof-input"
                        type="text" 
                        value={pmrfMemberType.proofOfIncome || ''} 
                        onChange={(e) => setPmrfMemberType({ ...pmrfMemberType, proofOfIncome: e.target.value })} 
                        className="w-full bg-transparent border-0 border-b border-dashed border-gray-400 p-0 text-[10px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 mt-1 text-black"
                      />
                    </div>

                  </div>

                </div>

                {/* Right Column: INDIRECT CONTRIBUTOR (col-span-5) */}
                <div className="col-span-12 md:col-span-5 flex flex-col justify-between">
                  
                  {/* Top Part: Title and Checkboxes */}
                  <div className="p-2 flex flex-col flex-1">
                    <span className="text-[10.5px] font-black text-black select-none uppercase tracking-wider block text-center mb-1 bg-[#f4f7f4]/40 py-0.5 font-sans">
                      INDIRECT CONTRIBUTOR
                    </span>

                    <div className="flex gap-2 mt-1">
                      
                      {/* Left sub-column of Indirect (w-[48%]) */}
                      <div className="w-[48%] flex flex-col gap-1 pr-1 border-r border-dashed border-gray-200">
                        
                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-listahanan"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'LISTAHANAN'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'LISTAHANAN';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'LISTAHANAN'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Listahanan</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-4ps"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'FOURPS'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'FOURPS';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'FOURPS'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">4Ps/MCCT</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-senior"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'SENIOR'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'SENIOR';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'SENIOR'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Senior Citizen</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-pamana"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'PAMANA'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'PAMANA';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'PAMANA'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">PAMANA</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-kia"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'KIA_KIPO'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'KIA_KIPO';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'KIA_KIPO'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">KIA/KIPO</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-bangsamoro"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'BANGSAMORO'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'BANGSAMORO';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'BANGSAMORO'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Bangsamoro/Normalization</span>
                        </label>

                      </div>

                      {/* Right sub-column of Indirect (w-[52%]) */}
                      <div className="w-[52%] flex flex-col gap-1 pl-1">
                        
                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-lgu"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'LGU_SPONSORED'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'LGU_SPONSORED';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'LGU_SPONSORED'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">LGU-sponsored</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-nga"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'NGA_SPONSORED'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'NGA_SPONSORED';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'NGA_SPONSORED'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">NGA-sponsored</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-private"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'PRIVATE_SPONSORED'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'PRIVATE_SPONSORED';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'PRIVATE_SPONSORED'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Private-sponsored</span>
                        </label>

                        <label className="flex items-start gap-1 cursor-pointer text-[8px] font-bold text-black select-none">
                          <input 
                            id="pmrf-ind-pwd"
                            type="checkbox" 
                            checked={pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'PWD'}
                            onChange={() => {
                              const active = pmrfMemberType.category === 'INDIRECT' && pmrfMemberType.subCategory === 'PWD';
                              setPmrfMemberType({
                                ...pmrfMemberType,
                                category: active ? '' : 'INDIRECT',
                                subCategory: active ? '' : 'PWD'
                              });
                            }} 
                            className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                          />
                          <span className="leading-tight">Person with Disability</span>
                        </label>

                        {/* Special ID input details for PWD */}
                        <div className="flex items-center gap-1.5 h-5 pl-4 mt-1">
                          <span className="text-[7.5px] font-bold text-black uppercase whitespace-nowrap select-none font-sans">
                            PWD ID No.
                          </span>
                          <input 
                            id="pmrf-pwd-no-input"
                            type="text" 
                            value={pmrfMemberType.pwdIdNo || ''} 
                            onChange={(e) => setPmrfMemberType({ ...pmrfMemberType, pwdIdNo: e.target.value })} 
                            className="flex-1 bg-transparent border-0 border-b border-black text-[9px] font-bold p-0 mb-0.5 px-1 outline-none uppercase font-mono tracking-wider h-4 focus:bg-amber-50/50 text-black" 
                          />
                        </div>

                      </div>

                    </div>

                  </div>

                  {/* Bottom Part: For PhilHealth Use Only Box */}
                  <div className="border-t border-black bg-[#f4f7f4]/60 p-1.5 flex flex-col justify-between min-h-[58px]">
                    <span className="text-[8.5px] font-extrabold text-black block tracking-tight text-center uppercase select-none italic font-sans leading-none mb-1">
                      For PhilHealth Use only:
                    </span>
                    
                    <div className="grid grid-cols-1 gap-1.5 px-1.5 pb-0.5 select-none">
                      <label className="flex items-start gap-1.5 cursor-pointer text-[8px] font-bold text-black select-none">
                        <input 
                          id="pmrf-official-pos"
                          type="checkbox" 
                          checked={pmrfMemberType.philhealthUse === 'POS_INCAPABLE'}
                          onChange={() => {
                            const active = pmrfMemberType.philhealthUse === 'POS_INCAPABLE';
                            setPmrfMemberType({
                              ...pmrfMemberType,
                              philhealthUse: active ? '' : 'POS_INCAPABLE'
                            });
                          }} 
                          className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                        />
                        <span className="leading-tight">Point of Service (POS) Financially Incapable</span>
                      </label>

                      <label className="flex items-start gap-1.5 cursor-pointer text-[8px] font-bold text-black select-none">
                        <input 
                          id="pmrf-official-incapable"
                          type="checkbox" 
                          checked={pmrfMemberType.philhealthUse === 'INCAPABLE'}
                          onChange={() => {
                            const active = pmrfMemberType.philhealthUse === 'INCAPABLE';
                            setPmrfMemberType({
                              ...pmrfMemberType,
                              philhealthUse: active ? '' : 'INCAPABLE'
                            });
                          }} 
                          className="h-3.5 w-3.5 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                        />
                        <span className="leading-tight">Financially Incapable</span>
                      </label>
                    </div>
                  </div>

                </div>

              </div>
            </div>

             {/* Official Footer bar */}
            <div className="text-[6.5px] text-slate-500 font-extrabold flex justify-between items-center border border-black p-2 bg-slate-50 select-none mt-2">
              <span>THIS FORM MAY BE REPRODUCED AND IS NOT FOR SALE</span>
              <span>CONTINUE AT THE BACK FOR SECTION V</span>
            </div>

            </div>
          </div>

          {/* MOBILE LAYOUT DESIGN (Visible on mobile viewports under 768px, elegant, single-column, touch-optimized, print:hidden) */}
          <div className="block md:hidden print:hidden w-full space-y-4 px-1 pb-6 text-slate-800">
            {/* Header card */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <PhilHealthLogo className="h-10 w-10 shrink-0" />
                <div className="text-left">
                  <h3 className="font-extrabold text-[12px] leading-tight text-slate-900 uppercase">PhilHealth PMRF Form</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Member Registration Form (Front)</p>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-3">
                <label className="text-[10px] font-black text-slate-500 block mb-1">PHILHEALTH IDENTIFICATION NUMBER (PIN)</label>
                <input
                  type="text"
                  placeholder="12-XXXXXXXXX-X"
                  value={pmrfPin}
                  onChange={(e) => setPmrfPin(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-950 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none text-black"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">PURPOSE OF REGISTRATION</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPmrfPurpose('REGISTRATION')}
                    className={`py-2 px-3 border border-slate-950 rounded-lg text-[10px] font-black tracking-wider transition ${
                      pmrfPurpose === 'REGISTRATION'
                        ? 'bg-[#1a56db] text-white'
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
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    UPDATING/AMENDMENT
                  </button>
                </div>
              </div>
            </div>

            {/* Section I: Personal Details */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-[#1a56db] text-white text-[11px] font-black px-2.5 py-1.5 rounded-md tracking-wider uppercase">
                SECTION I: PERSONAL DETAILS
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">MEMBER LAST NAME</label>
                  <input
                    type="text"
                    value={pmrfLastName}
                    onChange={(e) => setPmrfLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">MEMBER FIRST NAME</label>
                  <input
                    type="text"
                    value={pmrfFirstName}
                    onChange={(e) => setPmrfFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">MIDDLE NAME</label>
                    <input
                      type="text"
                      value={pmrfMiddleName}
                      onChange={(e) => setPmrfMiddleName(e.target.value)}
                      disabled={pmrfNoMiddleName || pmrfMononym}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400 text-black"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">NAME EXTENSION</label>
                    <input
                      type="text"
                      value={pmrfNameExt}
                      onChange={(e) => setPmrfNameExt(e.target.value)}
                      placeholder="e.g. JR, SR, III"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold text-center focus:border-slate-800 outline-none text-black"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pmrfNoMiddleName}
                      onChange={(e) => setPmrfNoMiddleName(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    NO MIDDLE NAME
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pmrfMononym}
                      onChange={(e) => setPmrfMononym(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    MONONYM (SINGLE NAME)
                  </label>
                </div>
              </div>
            </div>

            {/* Mother's Maiden Name Card */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-slate-800 text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase">
                MOTHER'S MAIDEN NAME
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">MOTHER LAST NAME</label>
                  <input
                    type="text"
                    value={pmrfMotherLastName}
                    onChange={(e) => setPmrfMotherLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">MOTHER FIRST NAME</label>
                  <input
                    type="text"
                    value={pmrfMotherFirstName}
                    onChange={(e) => setPmrfMotherFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">MOTHER MIDDLE NAME</label>
                  <input
                    type="text"
                    value={pmrfMotherMiddleName}
                    onChange={(e) => setPmrfMotherMiddleName(e.target.value)}
                    disabled={pmrfMotherNoMN || pmrfMotherMononym}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none disabled:bg-slate-100 text-black"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pmrfMotherNoMN}
                      onChange={(e) => setPmrfMotherNoMN(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    NO MIDDLE NAME
                  </label>
                </div>
              </div>
            </div>

            {/* Spouse's Name Card */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-slate-800 text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase">
                SPOUSE'S NAME (IF MARRIED)
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">SPOUSE LAST NAME</label>
                  <input
                    type="text"
                    value={pmrfSpouseLastName}
                    onChange={(e) => setPmrfSpouseLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold outline-none text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">SPOUSE FIRST NAME</label>
                  <input
                    type="text"
                    value={pmrfSpouseFirstName}
                    onChange={(e) => setPmrfSpouseFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold outline-none text-black"
                  />
                </div>
              </div>
            </div>

            {/* Personal Extra Info Card */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-slate-800 text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase">
                PERSONAL EXTRA INFO
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">DATE OF BIRTH</label>
                  <input
                    type="date"
                    value={pmrfBirthDate}
                    onChange={(e) => setPmrfBirthDate(e.target.value)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">SEX</label>
                  <select
                    value={pmrfSex}
                    onChange={(e) => setPmrfSex(e.target.value as any)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white text-black"
                  >
                    <option value="">SELECT</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">CIVIL STATUS</label>
                  <select
                    value={pmrfCivilStatus}
                    onChange={(e) => setPmrfCivilStatus(e.target.value as any)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white text-black"
                  >
                    <option value="">SELECT</option>
                    <option value="SINGLE">SINGLE</option>
                    <option value="MARRIED">MARRIED</option>
                    <option value="WIDOWER">WIDOWER</option>
                    <option value="LEGALLY_SEPARATED">SEPARATED</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">CITIZENSHIP</label>
                  <select
                    value={pmrfCitizenship}
                    onChange={(e) => setPmrfCitizenship(e.target.value as any)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white text-black"
                  >
                    <option value="FILIPINO">FILIPINO</option>
                    <option value="FOREIGN_NATIONAL">FOREIGN</option>
                    <option value="DUAL_CITIZEN">DUAL CITIZEN</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">PHILSYS NO</label>
                  <input
                    type="text"
                    value={pmrfPhilsysNo}
                    onChange={(e) => setPmrfPhilsysNo(e.target.value)}
                    placeholder="PhilSys ID"
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">TIN NO</label>
                  <input
                    type="text"
                    value={pmrfTin}
                    onChange={(e) => setPmrfTin(e.target.value)}
                    placeholder="TIN No"
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none text-black"
                  />
                </div>
              </div>
            </div>

            {/* Section II: Address & Contacts */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-[#1a56db] text-white text-[11px] font-black px-2.5 py-1.5 rounded-md tracking-wider uppercase">
                SECTION II: ADDRESS & CONTACTS
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">STREET / SUBDIVISION</label>
                  <input
                    type="text"
                    value={pmrfAddressStreet}
                    onChange={(e) => setPmrfAddressStreet(e.target.value)}
                    placeholder="Purok or Street Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">BARANGAY</label>
                    <input
                      type="text"
                      value={pmrfAddressBarangay}
                      onChange={(e) => setPmrfAddressBarangay(e.target.value)}
                      readOnly={!['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser?.email?.toLowerCase()) && currentUser?.position !== 'ADMIN' && currentUser?.position !== 'Administrator' && !!currentUser?.address}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black read-only:bg-slate-100 read-only:text-slate-600 read-only:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">PROVINCE</label>
                    <input
                      type="text"
                      value={pmrfAddressProvince}
                      onChange={(e) => setPmrfAddressProvince(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">MOBILE NO</label>
                    <input
                      type="text"
                      value={pmrfMobileNo}
                      onChange={(e) => setPmrfMobileNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">EMAIL ADDRESS</label>
                    <input
                      type="email"
                      value={pmrfEmail}
                      onChange={(e) => setPmrfEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-bold focus:border-slate-800 outline-none text-black"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section III: Dependents */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-[#1a56db] text-white text-[11px] font-black px-2.5 py-1.5 rounded-md tracking-wider uppercase">
                SECTION III: DEPENDENTS (MAX 4)
              </div>
              <div className="space-y-4 divide-y divide-slate-100">
                {pmrfDependents.map((dep, index) => (
                  <div key={index} className={`pt-3 ${index === 0 ? 'pt-0' : ''} text-left`}>
                    <h4 className="text-[10px] font-black text-[#1a56db] mb-2 uppercase">Dependent Registrant #{index + 1}</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[8px] font-black text-slate-400 block">LAST NAME</label>
                        <input
                          type="text"
                          value={dep.lastName}
                          onChange={(e) => {
                            const newList = [...pmrfDependents];
                            newList[index].lastName = e.target.value;
                            setPmrfDependents(newList);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase font-bold text-black"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-400 block">FIRST NAME</label>
                        <input
                          type="text"
                          value={dep.firstName}
                          onChange={(e) => {
                            const newList = [...pmrfDependents];
                            newList[index].firstName = e.target.value;
                            setPmrfDependents(newList);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase font-bold text-black"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] font-black text-slate-400 block">RELATIONSHIP</label>
                        <input
                          type="text"
                          value={dep.relationship}
                          onChange={(e) => {
                            const newList = [...pmrfDependents];
                            newList[index].relationship = e.target.value;
                            setPmrfDependents(newList);
                          }}
                          placeholder="e.g. SON, DAUGHTER"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase font-bold text-black"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-slate-400 block">BIRTH DATE</label>
                        <input
                          type="date"
                          value={dep.birthDate}
                          onChange={(e) => {
                            const newList = [...pmrfDependents];
                            newList[index].birthDate = e.target.value;
                            setPmrfDependents(newList);
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-black"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section IV: Contributor Category */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-[#1a56db] text-white text-[11px] font-black px-2.5 py-1.5 rounded-md tracking-wider uppercase">
                SECTION IV: MEMBER CATEGORY
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">PRIMARY CATEGORY</label>
                  <select
                    value={pmrfMemberType.category}
                    onChange={(e) => setPmrfMemberType({
                      ...pmrfMemberType,
                      category: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white text-black"
                  >
                    <option value="">SELECT CATEGORY</option>
                    <option value="DIRECT">DIRECT CONTRIBUTOR</option>
                    <option value="INDIRECT">INDIRECT CONTRIBUTOR</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">SUB-CATEGORY</label>
                  <select
                    value={pmrfMemberType.subCategory}
                    onChange={(e) => setPmrfMemberType({
                      ...pmrfMemberType,
                      subCategory: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white text-black"
                  >
                    <option value="">SELECT SUB-CATEGORY</option>
                    <option value="EMPLOYED_PRIVATE">EMPLOYED - PRIVATE</option>
                    <option value="EMPLOYED_GOV">EMPLOYED - GOVERNMENT</option>
                    <option value="PROF_PRACTITIONER">PROFESSIONAL PRACTITIONER</option>
                    <option value="SELF_EARNING">SELF-EARNING INDIVIDUAL</option>
                    <option value="KASAMBAHAY">KASAMBAHAY</option>
                    <option value="MIGRANT_LAND">MIGRANT WORKER (LAND-BASED)</option>
                    <option value="MIGRANT_SEA">MIGRANT WORKER (SEA-BASED)</option>
                    <option value="LIFETIME">LIFETIME MEMBER</option>
                    <option value="SENIOR">SENIOR CITIZEN</option>
                    <option value="LISTAHANAN">LISTAHANAN INDIGENT</option>
                    <option value="FOURPS">4PS / Pantawid Pamilya</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">PROFESSION</label>
                    <input
                      type="text"
                      value={pmrfMemberType.profession}
                      onChange={(e) => setPmrfMemberType({
                        ...pmrfMemberType,
                        profession: e.target.value
                      })}
                      placeholder="e.g. Teacher"
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold text-black"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 block mb-1">MONTHLY INCOME</label>
                    <input
                      type="text"
                      value={pmrfMemberType.monthlyIncome}
                      onChange={(e) => setPmrfMemberType({
                        ...pmrfMemberType,
                        monthlyIncome: e.target.value
                      })}
                      placeholder="e.g. 15000"
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold text-black"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

        {/* --- 2. PHILHEALTH PMRF BACK FORM (SECTION V) --- */}
        {activeFormTab === 'PMRF' && pmrfSubTab === 'BACK' && (
          <>
            {/* DESKTOP PRINT DESIGN (Visible on md+ screens and when printing) */}
            <div className="hidden md:block print:block w-full overflow-x-auto pb-4">
              <div className="bg-white border-[3px] border-black p-4 text-black font-sans text-[9px] uppercase tracking-normal relative shadow-md min-w-[850px]">
            
            {/* Table Area for UPDATING/AMENDMENT */}
            <div className="overflow-x-auto select-none">
              <div className="min-w-[800px] border border-black flex flex-col">
                
                {/* Header Title */}
                <div className="bg-[#dee5db] border-b border-black text-center font-extrabold text-[12px] py-1.5 tracking-wider uppercase font-sans text-black">
                  V. UPDATING/AMENDMENT
                </div>

                {/* Subheadings FROM / TO */}
                <div className="grid grid-cols-10 divide-x divide-black border-b border-black font-extrabold text-[10px] bg-white text-black">
                  <div className="col-span-4 px-2.5 py-1.5 text-left flex items-center select-none">
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
                    <input 
                      id="pmrf-amend-name-chk"
                      type="checkbox" 
                      checked={pmrfAmendments.name.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        name: { ...pmrfAmendments.name, checked: e.target.checked }
                      })}
                      className="h-4 w-4 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-extrabold text-[9px] text-black leading-tight">Change/Correction of Name</span>
                      <span className="text-[6.5px] text-gray-500 font-bold normal-case tracking-tight leading-normal mt-0.5 font-sans">
                        (Last Name, First Name, Name Extension (Jr./Sr./III) Middle Name)
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <textarea 
                      id="pmrf-amend-name-from"
                      rows={2}
                      value={pmrfAmendments.name.from}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        name: { ...pmrfAmendments.name, from: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black leading-tight resize-none"
                      placeholder=""
                    />
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <textarea 
                      id="pmrf-amend-name-to"
                      rows={2}
                      value={pmrfAmendments.name.to}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        name: { ...pmrfAmendments.name, to: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black leading-tight resize-none"
                      placeholder=""
                    />
                  </div>
                </div>

                {/* Row 2: DOB */}
                <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                  <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                    <input 
                      id="pmrf-amend-dob-chk"
                      type="checkbox" 
                      checked={pmrfAmendments.dob.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        dob: { ...pmrfAmendments.dob, checked: e.target.checked }
                      })}
                      className="h-4 w-4 border border-black bg-white accent-black cursor-pointer shrink-0" 
                    />
                    <span className="font-extrabold text-[9px] text-black leading-none">Correction of Date of Birth</span>
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <input 
                      id="pmrf-amend-dob-from"
                      type="text"
                      value={pmrfAmendments.dob.from}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        dob: { ...pmrfAmendments.dob, from: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black h-8"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <input 
                      id="pmrf-amend-dob-to"
                      type="text"
                      value={pmrfAmendments.dob.to}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        dob: { ...pmrfAmendments.dob, to: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black h-8"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                {/* Row 3: Sex */}
                <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                  <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                    <input 
                      id="pmrf-amend-sex-chk"
                      type="checkbox" 
                      checked={pmrfAmendments.sex.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        sex: { ...pmrfAmendments.sex, checked: e.target.checked }
                      })}
                      className="h-4 w-4 border border-black bg-white accent-black cursor-pointer shrink-0" 
                    />
                    <span className="font-extrabold text-[9px] text-black leading-none">Correction of Sex</span>
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <input 
                      id="pmrf-amend-sex-from"
                      type="text"
                      value={pmrfAmendments.sex.from}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        sex: { ...pmrfAmendments.sex, from: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black h-8"
                      placeholder=""
                    />
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <input 
                      id="pmrf-amend-sex-to"
                      type="text"
                      value={pmrfAmendments.sex.to}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        sex: { ...pmrfAmendments.sex, to: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black h-8"
                      placeholder=""
                    />
                  </div>
                </div>

                {/* Row 4: Civil Status */}
                <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                  <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                    <input 
                      id="pmrf-amend-civil-chk"
                      type="checkbox" 
                      checked={pmrfAmendments.civilStatus.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        civilStatus: { ...pmrfAmendments.civilStatus, checked: e.target.checked }
                      })}
                      className="h-4 w-4 border border-black bg-white accent-black cursor-pointer shrink-0" 
                    />
                    <span className="font-extrabold text-[9px] text-black leading-none">Change of Civil Status</span>
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <input 
                      id="pmrf-amend-civil-from"
                      type="text"
                      value={pmrfAmendments.civilStatus.from}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        civilStatus: { ...pmrfAmendments.civilStatus, from: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black h-8"
                      placeholder=""
                    />
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <input 
                      id="pmrf-amend-civil-to"
                      type="text"
                      value={pmrfAmendments.civilStatus.to}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        civilStatus: { ...pmrfAmendments.civilStatus, to: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[10px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black h-8"
                      placeholder=""
                    />
                  </div>
                </div>

                {/* Row 5: Info/Address/Phone/Email */}
                <div className="grid grid-cols-10 divide-x divide-black text-black">
                  <div className="col-span-4 p-2 flex items-start gap-2.5 bg-white select-none">
                    <input 
                      id="pmrf-amend-info-chk"
                      type="checkbox" 
                      checked={pmrfAmendments.personalInfo.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        personalInfo: { ...pmrfAmendments.personalInfo, checked: e.target.checked }
                      })}
                      className="h-4 w-4 border border-black bg-white accent-black cursor-pointer shrink-0 mt-0.5" 
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-extrabold text-[9px] text-black leading-snug">Updating of Personal Information/Address/</span>
                      <span className="font-extrabold text-[9px] text-black leading-snug">Telephone Number/Mobile Number/e-mail Address</span>
                    </div>
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <textarea 
                      id="pmrf-amend-info-from"
                      rows={3}
                      value={pmrfAmendments.personalInfo.from}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        personalInfo: { ...pmrfAmendments.personalInfo, from: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[9.5px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black leading-snug resize-none"
                      placeholder=""
                    />
                  </div>
                  <div className="col-span-3 p-1.5 flex items-center bg-white">
                    <textarea 
                      id="pmrf-amend-info-to"
                      rows={3}
                      value={pmrfAmendments.personalInfo.to}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        personalInfo: { ...pmrfAmendments.personalInfo, to: e.target.value }
                      })}
                      className="w-full bg-transparent border-0 p-1 text-[9.5px] font-bold uppercase outline-none focus:bg-amber-50/50 text-black leading-snug resize-none"
                      placeholder=""
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Part: Attestation & Received By */}
            <div className="overflow-x-auto mt-4 select-none">
              <div className="min-w-[800px] border border-black grid grid-cols-12 divide-x divide-black bg-white">
                
                {/* Left Side: Attestation (col-span-8) */}
                <div className="col-span-8 p-3.5 flex flex-col justify-between">
                  
                  {/* Attestation Text */}
                  <div className="text-[7.5px] text-black text-justify leading-relaxed font-sans normal-case">
                    <p className="font-bold">
                      Under penalty of law, I hereby attest that the information provided, including the documents I have attached to this form, are true and accurate to the best of my knowledge. I agree and authorize PhilHealth for the subsequent validation, verification and for other data sharing purposes only under the following circumstances:
                    </p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 font-bold">
                      <li>As necessary for the proper execution of processes related to the legitimate and declared purpose;</li>
                      <li>The use or disclosure is reasonably necessary, required or authorized by or under the law; and,</li>
                      <li>Adequate security measures are employed to protect my information.</li>
                    </ul>
                  </div>

                  {/* Signature and Thumbmark Sub-grid */}
                  <div className="grid grid-cols-12 gap-2 mt-4 pt-4 border-t border-dashed border-gray-300">
                    
                    {/* Signatures Column (col-span-8) */}
                    <div className="col-span-8 flex flex-col justify-end pb-2 pr-4">
                      <div className="flex gap-4">
                        
                        {/* Member Signature Column */}
                        <div className="flex-1 flex flex-col justify-end relative">
                          {pmrfSignatureImage && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-[24px] h-[38px] w-48 flex items-center justify-center pointer-events-none select-none z-10">
                              <img 
                                src={pmrfSignatureImage} 
                                alt="Member Signature" 
                                className="max-h-full max-w-full object-contain mix-blend-darken filter contrast-125 brightness-95"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <input 
                            id="pmrf-attest-sig"
                            type="text"
                            value={pmrfAttestSignature}
                            onChange={(e) => setPmrfAttestSignature(e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-black text-[10px] font-bold uppercase pb-0.5 outline-none text-center text-black focus:bg-amber-50/50 relative z-0"
                          />
                          <span className="text-[7.5px] font-black text-center mt-1.5 text-black font-sans leading-none block">
                            Member's Signature over Printed Name
                          </span>
                        </div>

                        {/* Date Column */}
                        <div className="w-[120px] flex flex-col justify-end">
                          <input 
                            id="pmrf-attest-date-input"
                            type="text"
                            value={pmrfAttestDate}
                            onChange={(e) => setPmrfAttestDate(e.target.value)}
                            placeholder="YYYY-MM-DD"
                            className="w-full bg-transparent border-0 border-b border-black text-[10px] font-bold uppercase pb-0.5 outline-none text-center text-black focus:bg-amber-50/50 placeholder:text-gray-300"
                          />
                          <span className="text-[7.5px] font-black text-center mt-1.5 text-black font-sans leading-none block">
                            Date
                          </span>
                        </div>

                      </div>
                    </div>

                    {/* Right Thumbprint Area (col-span-4) */}
                    <div className="col-span-4 flex flex-col items-center justify-center">
                      <div className="w-[110px] h-[75px] border-2 border-black rounded-xl bg-white flex flex-col items-center justify-center relative p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">
                        {/* Render simple concentric curves representing fingerprint lines or hand icon */}
                        <div className="opacity-15 text-2xl select-none">&#x270B;</div>
                      </div>
                      <span className="text-[6.5px] font-bold text-center text-black leading-tight mt-1 max-w-[110px] font-sans">
                        Please affix right thumbmark if unable to write
                      </span>
                    </div>

                  </div>

                </div>

                {/* Right Side: FOR PHILHEALTH USE ONLY (col-span-4) */}
                <div className="col-span-4 flex flex-col bg-[#f4f7f4]/40 h-full">
                  
                  {/* Received Header */}
                  <div className="bg-[#dee5db] border-b border-black text-center font-extrabold text-[10px] py-1.5 tracking-wider uppercase font-sans text-black select-none">
                    FOR PHILHEALTH USE ONLY
                  </div>

                  {/* Form fields */}
                  <div className="p-3.5 flex flex-col justify-between flex-1 select-none font-sans text-black">
                    <div className="text-[10px] font-extrabold tracking-wide font-sans text-black text-left mb-2 underline">
                      RECEIVED BY:
                    </div>

                    <div className="flex flex-col gap-4 mt-1">
                      
                      {/* Full Name */}
                      <div className="flex flex-col">
                        <span className="text-[7.5px] font-extrabold text-black uppercase">Full Name:</span>
                        <input 
                          id="pmrf-rcv-name-input"
                          type="text"
                          value={pmrfReceivedBy.fullName}
                          onChange={(e) => setPmrfReceivedBy({ ...pmrfReceivedBy, fullName: e.target.value })}
                          className="w-full bg-transparent border-0 border-b border-black text-[9.5px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black mt-1"
                        />
                      </div>

                      {/* PRO/LHIO/Branch */}
                      <div className="flex flex-col">
                        <span className="text-[7.5px] font-extrabold text-black uppercase">PRO/LHIO/Branch:</span>
                        <input 
                          id="pmrf-rcv-branch-input"
                          type="text"
                          value={pmrfReceivedBy.proLhioBranch}
                          onChange={(e) => setPmrfReceivedBy({ ...pmrfReceivedBy, proLhioBranch: e.target.value })}
                          className="w-full bg-transparent border-0 border-b border-black text-[9.5px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black mt-1"
                        />
                      </div>

                      {/* Date & Time */}
                      <div className="flex flex-col">
                        <span className="text-[7.5px] font-extrabold text-black uppercase">Date & Time:</span>
                        <input 
                          id="pmrf-rcv-datetime-input"
                          type="text"
                          value={pmrfReceivedBy.dateTime}
                          onChange={(e) => setPmrfReceivedBy({ ...pmrfReceivedBy, dateTime: e.target.value })}
                          className="w-full bg-transparent border-0 border-b border-black text-[9.5px] font-bold uppercase pb-0.5 outline-none focus:bg-amber-50/50 text-black mt-1"
                        />
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            </div>

            {/* INSTRUCTIONS */}
            <div className="mt-8 pt-6 border-t border-black normal-case font-sans text-[9.5px] text-justify text-black leading-relaxed space-y-4 select-none">
              <div className="text-center font-extrabold text-[12.5px] underline tracking-widest block uppercase font-sans mb-5 text-black">
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
                  <div className="flex-1">
                    <span>For PERSONAL DETAILS, all name entries should follow the format given below. Check the appropriate box if registrant has no middle name and/or with single name (mononym).</span>
                    
                    <div className="my-6 grid grid-cols-4 gap-4 text-center max-w-3xl mx-auto">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans">LAST NAME</span>
                        <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans">SANTOS</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans">FIRST NAME</span>
                        <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans">JUAN ANDRES</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans justify-center">NAME EXTENSION (Jr./Sr./III)</span>
                        <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans">III</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-[10px] text-black tracking-wider uppercase font-sans">MIDDLE NAME</span>
                        <span className="text-[11.5px] text-gray-700 mt-2 font-medium tracking-wide font-sans">DELA CRUZ</span>
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

          {/* MOBILE LAYOUT DESIGN (Visible on mobile viewports under 768px, elegant, single-column, touch-optimized, print:hidden) */}
          <div className="block md:hidden print:hidden w-full space-y-4 px-1 pb-6 text-slate-800">
            {/* Header card */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <PhilHealthLogo className="h-10 w-10 shrink-0" />
                <div className="text-left">
                  <h3 className="font-extrabold text-[12px] leading-tight text-slate-900 uppercase animate-fade-in">PhilHealth PMRF Form</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Updating / Amendment (Back)</p>
                </div>
              </div>
            </div>

            {/* Checkbox lists for updates */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-[#1a56db] text-white text-[11px] font-black px-2.5 py-1.5 rounded-md tracking-wider uppercase">
                V. UPDATING AND AMENDMENT
              </div>
              
              <div className="space-y-4 divide-y divide-slate-100">
                {/* Amend Name */}
                <div className="space-y-2 pt-2">
                  <label className="flex items-start gap-2 text-xs font-black cursor-pointer text-slate-900">
                    <input
                      type="checkbox"
                      checked={pmrfAmendments.name.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        name: { ...pmrfAmendments.name, checked: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 mt-0.5"
                    />
                    CHANGE OR CORRECTION OF NAME
                  </label>
                  <p className="text-[9px] text-slate-500">Last Name, First Name, Middle Name, Extension</p>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">FROM:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.name.from}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          name: { ...pmrfAmendments.name, from: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase text-black"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">TO:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.name.to}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          name: { ...pmrfAmendments.name, to: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase text-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Amend DOB */}
                <div className="space-y-2 pt-3">
                  <label className="flex items-start gap-2 text-xs font-black cursor-pointer text-slate-900">
                    <input
                      type="checkbox"
                      checked={pmrfAmendments.dob.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        dob: { ...pmrfAmendments.dob, checked: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 mt-0.5"
                    />
                    CORRECTION OF DATE OF BIRTH
                  </label>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">FROM:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.dob.from}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          dob: { ...pmrfAmendments.dob, from: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-black"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">TO:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.dob.to}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          dob: { ...pmrfAmendments.dob, to: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Amend Sex */}
                <div className="space-y-2 pt-3">
                  <label className="flex items-start gap-2 text-xs font-black cursor-pointer text-slate-900">
                    <input
                      type="checkbox"
                      checked={pmrfAmendments.sex.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        sex: { ...pmrfAmendments.sex, checked: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 mt-0.5"
                    />
                    CORRECTION OF SEX
                  </label>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">FROM:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.sex.from}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          sex: { ...pmrfAmendments.sex, from: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-black"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">TO:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.sex.to}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          sex: { ...pmrfAmendments.sex, to: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Amend Civil Status */}
                <div className="space-y-2 pt-3">
                  <label className="flex items-start gap-2 text-xs font-black cursor-pointer text-slate-900">
                    <input
                      type="checkbox"
                      checked={pmrfAmendments.civilStatus.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        civilStatus: { ...pmrfAmendments.civilStatus, checked: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 mt-0.5"
                    />
                    CHANGE OF CIVIL STATUS
                  </label>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">FROM:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.civilStatus.from}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          civilStatus: { ...pmrfAmendments.civilStatus, from: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-black"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">TO:</span>
                      <input
                        type="text"
                        value={pmrfAmendments.civilStatus.to}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          civilStatus: { ...pmrfAmendments.civilStatus, to: e.target.value }
                        })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Amend Other Personal Info */}
                <div className="space-y-2 pt-3">
                  <label className="flex items-start gap-2 text-xs font-black cursor-pointer text-slate-900">
                    <input
                      type="checkbox"
                      checked={pmrfAmendments.personalInfo.checked}
                      onChange={(e) => setPmrfAmendments({
                        ...pmrfAmendments,
                        personalInfo: { ...pmrfAmendments.personalInfo, checked: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 mt-0.5"
                    />
                    OTHER AMENDMENTS / INFORMATION
                  </label>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">FROM:</span>
                      <textarea
                        value={pmrfAmendments.personalInfo.from}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          personalInfo: { ...pmrfAmendments.personalInfo, from: e.target.value }
                        })}
                        rows={2}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase resize-none text-black animate-fade-in"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 block">TO:</span>
                      <textarea
                        value={pmrfAmendments.personalInfo.to}
                        onChange={(e) => setPmrfAmendments({
                          ...pmrfAmendments,
                          personalInfo: { ...pmrfAmendments.personalInfo, to: e.target.value }
                        })}
                        rows={2}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs uppercase resize-none text-black animate-fade-in"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attestation Details */}
            <div className="bg-white border-2 border-slate-950 rounded-xl p-4 shadow-sm space-y-4">
              <div className="bg-[#1a56db] text-white text-[11px] font-black px-2.5 py-1.5 rounded-md tracking-wider uppercase">
                ATTESTATION / SIGNATURE
              </div>
              <div className="space-y-3">
                <p className="text-[10px] text-slate-500 text-justify">
                  I HEREBY ATTEST THAT ALL INFORMATION PROVIDED HEREIN ARE TRUE, ACCURATE AND COMPLETE TO THE BEST OF MY KNOWLEDGE.
                </p>
                <div>
                  <label className="text-[9px] font-black text-slate-500 block mb-1">SIGNATURE DATE</label>
                  <input
                    type="date"
                    value={pmrfAttestDate}
                    onChange={(e) => setPmrfAttestDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-black"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

        {/* --- 3. FIRST PATIENT ENCOUNTER (FPE) DOCUMENT --- */}
        {activeFormTab === 'FPE' && (
          <div className="bg-white border-2 border-slate-400 p-6 md:p-8 shadow-md rounded-xl space-y-4 font-sans text-xs max-w-full">
            
            {/* FPE Header branding */}
            <div className="border-b-2 border-slate-400 pb-4 text-center space-y-1 relative">
              <div className="mx-auto h-12 w-12 bg-slate-100 flex items-center justify-center rounded-full border border-slate-300">
                <span className="text-xl">🩺</span>
              </div>
              <h2 className="font-extrabold text-[15px] text-slate-900 uppercase tracking-tight">SAINT FRANCIS CLINIC</h2>
              <p className="text-[10px] text-slate-500 font-bold">San Francisco, Pagadian City</p>
              <h1 className="font-black text-sm text-blue-600 uppercase tracking-wide bg-blue-50 py-1.5 rounded">FIRST PATIENT ENCOUNTER (FPE)</h1>
              <p className="text-[8.5px] text-slate-400 font-mono">PCP / Konsulta / Yakap + Gamot Program</p>
            </div>

            {/* Patient Information block */}
            <div className="border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block">
              PATIENT CLINICAL INFORMATION
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 p-4 border border-slate-300 bg-white">
              <div className="col-span-2">
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Patient's Full Name</label>
                <input 
                  type="text" 
                  value={fpePatientName} 
                  onChange={(e) => setFpePatientName(e.target.value)} 
                  placeholder="Enter patient full name"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase focus:bg-amber-50 outline-none" 
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Family Member Position / Role</label>
                <select 
                  value={fpeFamilyRole} 
                  onChange={(e) => setFpeFamilyRole(e.target.value as any)} 
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase outline-none"
                >
                  <option value="">-Select-</option>
                  <option value="HEAD">HEAD OF HOUSEHOLD</option>
                  <option value="SPOUSE">SPOUSE</option>
                  <option value="DEPENDENT">DEPENDENT</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Age</label>
                <input 
                  type="number" 
                  value={fpeAge} 
                  onChange={(e) => setFpeAge(e.target.value)} 
                  placeholder="e.g. 35"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold font-mono outline-none" 
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">BirthDate (YYYY-MM-DD)</label>
                <input 
                  type="date" 
                  value={fpeBirthDate} 
                  onChange={(e) => setFpeBirthDate(e.target.value)} 
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold outline-none" 
                />
              </div>

              <div>
                <span className="text-[9px] font-bold text-slate-500 block uppercase">Sex</span>
                <div className="flex gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={fpeSex === 'MALE'} onChange={() => setFpeSex('MALE')} className="h-4.5 w-4.5 accent-blue-600" />
                    <span className="font-bold">MALE</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={fpeSex === 'FEMALE'} onChange={() => setFpeSex('FEMALE')} className="h-4.5 w-4.5 accent-blue-600" />
                    <span className="font-bold">FEMALE</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Civil Status</label>
                <input 
                  type="text" 
                  value={fpeCivilStatus} 
                  onChange={(e) => setFpeCivilStatus(e.target.value)} 
                  placeholder="SINGLE / MARRIED"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase outline-none" 
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">PhilHealth Id Number (PIN)</label>
                <input 
                  type="text" 
                  value={fpePhilhealthNo} 
                  onChange={(e) => setFpePhilhealthNo(e.target.value)} 
                  placeholder="12-345678901-2"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold font-mono outline-none" 
                />
              </div>

              <div className="col-span-2">
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[9px] font-bold text-slate-500 block uppercase">Complete Residential Address</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const constructed = [
                        pmrfAddressUnit || pmrfAddressLot,
                        pmrfAddressStreet,
                        pmrfAddressSubdivision,
                        pmrfAddressBarangay,
                        pmrfAddressMunicipality,
                        pmrfAddressProvince
                      ].map(s => s && typeof s === 'string' ? s.trim() : '').filter(Boolean).join(', ');
                      setFpeAddress(constructed || 'San Francisco, Pagadian City');
                    }}
                    className="text-[8px] bg-blue-50 text-blue-700 hover:bg-blue-100 font-extrabold px-1.5 py-0.5 rounded cursor-pointer transition select-none print:hidden border border-blue-200"
                  >
                    Fetch from PMRF
                  </button>
                </div>
                <input 
                  type="text" 
                  value={fpeAddress} 
                  onChange={(e) => setFpeAddress(e.target.value)} 
                  placeholder="Purok / Barangay / Municipality / Province"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase outline-none focus:bg-amber-50" 
                />
              </div>

              <div className="col-span-2">
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Contact Number</label>
                <input 
                  type="text" 
                  value={fpeContactNo} 
                  onChange={(e) => setFpeContactNo(e.target.value)} 
                  placeholder="+63 900 000 0000"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold font-mono outline-none" 
                />
              </div>
            </div>

            {/* Vital Signs Block */}
            <div className="border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block">
              PHYSICAL ENCOUNTER VITAL SIGNS
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border border-slate-300 bg-white">
              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Blood Pressure (mmHg)</label>
                <input type="text" value={fpeBloodPressure} onChange={(e) => setFpeBloodPressure(e.target.value)} placeholder="e.g. 120/80" className="w-full border border-slate-300 p-1.5 text-xs font-bold text-center font-mono outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Temperature (°C)</label>
                <input type="text" value={fpeTemperature} onChange={(e) => setFpeTemperature(e.target.value)} placeholder="e.g. 36.5" className="w-full border border-slate-300 p-1.5 text-xs font-bold text-center font-mono outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Pulse Rate (bpm)</label>
                <input type="text" value={fpeHeartRate} onChange={(e) => setFpeHeartRate(e.target.value)} placeholder="e.g. 72" className="w-full border border-slate-300 p-1.5 text-xs font-bold text-center font-mono outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Resp Rate (cpm)</label>
                <input type="text" value={fpeRespiratoryRate} onChange={(e) => setFpeRespiratoryRate(e.target.value)} placeholder="e.g. 18" className="w-full border border-slate-300 p-1.5 text-xs font-bold text-center font-mono outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Weight (kg)</label>
                <input type="text" value={fpeWeight} onChange={(e) => setFpeWeight(e.target.value)} placeholder="e.g. 60" className="w-full border border-slate-300 p-1.5 text-xs font-bold text-center font-mono outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Height (cm)</label>
                <input type="text" value={fpeHeight} onChange={(e) => setFpeHeight(e.target.value)} placeholder="e.g. 165" className="w-full border border-slate-300 p-1.5 text-xs font-bold text-center font-mono outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-bold text-slate-500 block uppercase">Chief clinical Complaint</label>
                <input type="text" value={fpeChiefComplaint} onChange={(e) => setFpeChiefComplaint(e.target.value)} placeholder="e.g. Cough, Mild Fever, Hypertension Check" className="w-full border border-slate-300 p-1.5 text-xs font-bold outline-none uppercase" />
              </div>
            </div>

            {/* Medical History checkbox matrix */}
            <div className="border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block">
              CLINICAL HISTORY & COMMUNICABLE DISEASES MAP
            </div>

            <div className="p-4 border border-slate-300 bg-slate-50/50 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border rounded hover:bg-slate-50">
                  <input type="checkbox" checked={fpeHistoryAsthma} onChange={(e) => setFpeHistoryAsthma(e.target.checked)} className="h-4.5 w-4.5 accent-blue-600" />
                  <span className="font-bold text-[9.5px]">BRONCHIAL ASTHMA</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border rounded hover:bg-slate-50">
                  <input type="checkbox" checked={fpeHistoryHypertension} onChange={(e) => setFpeHistoryHypertension(e.target.checked)} className="h-4.5 w-4.5 accent-blue-600" />
                  <span className="font-bold text-[9.5px]">CHRONIC HYPERTENSION</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border rounded hover:bg-slate-50">
                  <input type="checkbox" checked={fpeHistoryDiabetes} onChange={(e) => setFpeHistoryDiabetes(e.target.checked)} className="h-4.5 w-4.5 accent-blue-600" />
                  <span className="font-bold text-[9.5px]">DIABETES MELLITUS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border rounded hover:bg-slate-50">
                  <input type="checkbox" checked={fpeHistoryCancer} onChange={(e) => setFpeHistoryCancer(e.target.checked)} className="h-4.5 w-4.5 accent-blue-600" />
                  <span className="font-bold text-[9.5px]">CANCER / MALIGNANCY</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 border rounded hover:bg-slate-50">
                  <input type="checkbox" checked={fpeHistoryHeartDisease} onChange={(e) => setFpeHistoryHeartDisease(e.target.checked)} className="h-4.5 w-4.5 accent-blue-600" />
                  <span className="font-bold text-[9.5px]">ISCHEMIC HEART DISEASE</span>
                </label>
                <div className="col-span-full">
                  <label className="text-[9px] font-bold text-slate-500 block uppercase mb-1">Other Histories / Allergies:</label>
                  <input type="text" value={fpeHistoryOthers} onChange={(e) => setFpeHistoryOthers(e.target.value)} placeholder="Specify other conditions..." className="w-full bg-white border border-slate-300 p-1.5 font-bold uppercase text-[10px] outline-none" />
                </div>
              </div>
            </div>

            {/* Officer signatures Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 border-slate-300">
              <div className="p-3 border rounded-lg bg-slate-50 flex flex-col items-center justify-between min-h-[90px]">
                <div className="w-40 h-0.5 bg-slate-700 mt-8"></div>
                <span className="text-[9px] font-black text-slate-800 tracking-wide mt-2">PATIENT / COUNTERPART SIGNATURE</span>
              </div>
              <div className="p-3 border rounded-lg bg-slate-50 flex flex-col items-center justify-between min-h-[90px]">
                <div className="w-40 h-0.5 bg-slate-700 mt-8"></div>
                <span className="text-[9px] font-black text-slate-800 tracking-wide mt-2">EXAMINING CLINIC OFFICER / NURSE</span>
              </div>
            </div>

          </div>
        )}

        {/* --- 4. PRIMARY CARE PROVIDER SELECTION FORM (PCSF) --- */}
        {activeFormTab === 'PCSF' && (
          <div className="bg-white border-2 border-slate-400 p-6 md:p-8 shadow-md rounded-xl space-y-4 font-sans text-xs max-w-full">
            
            {/* PCSF Branding Header */}
            <div className="border-b bg-slate-50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 border-slate-300">
              <div className="flex items-center gap-3">
                <PhilHealthLogo className="h-12 w-12" />
                <div>
                  <h2 className="font-black text-[10.5px] text-slate-900 leading-none">PHILIPPINE HEALTH INSURANCE CORPORATION</h2>
                  <h1 className="font-black text-[13px] text-blue-800 uppercase tracking-tight mt-1 leading-none">Primary Care Selection Form (PCSF)</h1>
                  <p className="text-[9px] text-[#1a56db] font-bold mt-1 uppercase tracking-wide">PhilHealth Konsulta Benefit Enrollment Certificate</p>
                </div>
              </div>
              <div className="bg-white p-2 border border-slate-300 text-center font-mono font-bold text-[8.5px] text-slate-750">
                <span>FORM VERSION</span>
                <p className="font-black text-black">KC-CSF.01-2022</p>
              </div>
            </div>

            {/* PCSF Form info and details */}
            <div className="border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block">
              PRIMARY BENEFICIARY & KONSULTA DESIGNEES
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 border border-slate-300 bg-white">
              
              <div className="col-span-2">
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Head of Household Name</label>
                <input 
                  type="text" 
                  value={pcsfHeadName} 
                  onChange={(e) => setPcsfHeadName(e.target.value)} 
                  placeholder="Enter householder head full name"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase focus:bg-amber-50 outline-none" 
                />
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Relationship to Patient</label>
                <input 
                  type="text" 
                  value={pcsfRelationToHead} 
                  onChange={(e) => setPcsfRelationToHead(e.target.value)} 
                  placeholder="e.g. SELF / CHILD / SPOUSE"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase outline-none focus:bg-amber-50" 
                />
              </div>

              <div className="col-span-2">
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Beneficiary / Patient Name</label>
                <input 
                  type="text" 
                  value={pcsfPatientName} 
                  onChange={(e) => setPcsfPatientName(e.target.value)} 
                  placeholder="Enter Patient Full Name"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase focus:bg-amber-50 outline-none" 
                />
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">PhilHealth Identification No (PIN)</label>
                <input 
                  type="text" 
                  value={pcsfPhilhealthNo} 
                  onChange={(e) => setPcsfPhilhealthNo(e.target.value)} 
                  placeholder="e.g. 12-345678901-2"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold font-mono outline-none" 
                />
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">BirthDate (YYYY-MM-DD)</label>
                <input 
                  type="date" 
                  value={pcsfBirthDate} 
                  onChange={(e) => setPcsfBirthDate(e.target.value)} 
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold outline-none" 
                />
              </div>

              <div>
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Sex</span>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={pcsfSex === 'MALE'} onChange={() => setPcsfSex('MALE')} className="h-4 w-4 accent-[#1a56db]" />
                    <span className="font-bold text-xs">MALE</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={pcsfSex === 'FEMALE'} onChange={() => setPcsfSex('FEMALE')} className="h-4 w-4 accent-[#1a56db]" />
                    <span className="font-bold text-xs">FEMALE</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Barangay Location</label>
                <input 
                  type="text" 
                  value={pcsfBarangay} 
                  readOnly={true}
                  title="Barangay is locked to your assigned Account Residential Area"
                  className="w-full border border-slate-300 bg-slate-50 p-1.5 text-xs font-bold uppercase outline-none text-slate-500 cursor-not-allowed select-none" 
                />
              </div>

              <div className="col-span-2">
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Permanent Residential Address</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const constructed = [
                        pmrfAddressUnit || pmrfAddressLot,
                        pmrfAddressStreet,
                        pmrfAddressSubdivision,
                        pmrfAddressBarangay,
                        pmrfAddressMunicipality,
                        pmrfAddressProvince
                      ].map(s => s && typeof s === 'string' ? s.trim() : '').filter(Boolean).join(', ');
                      setPcsfAddress(constructed || 'San Francisco, Pagadian City');
                    }}
                    className="text-[8px] bg-blue-50 text-blue-700 hover:bg-blue-100 font-extrabold px-1.5 py-0.5 rounded cursor-pointer transition select-none print:hidden border border-blue-200"
                  >
                    Fetch from PMRF
                  </button>
                </div>
                <input 
                  type="text" 
                  value={pcsfAddress} 
                  onChange={(e) => setPcsfAddress(e.target.value)} 
                  placeholder="Enter complete permanent residential address"
                  className="w-full border border-slate-300 p-1.5 text-xs font-bold uppercase focus:bg-amber-50 outline-none" 
                />
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Mobile No</label>
                <input type="text" value={pcsfContactNo} onChange={(e) => setPcsfContactNo(e.target.value)} className="w-full border border-slate-300 p-1.5 text-xs font-bold font-mono outline-none" placeholder="+63 900 000 0000" />
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Email Address</label>
                <input type="email" value={pcsfEmail} onChange={(e) => setPcsfEmail(e.target.value)} className="w-full border border-slate-300 p-1.5 text-xs font-bold lowercase tracking-tight outline-none" placeholder="name@domain.com" />
              </div>

              <div>
                <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Date Selected / Enrolled</label>
                <input type="date" value={pcsfEnrollDate} onChange={(e) => setPcsfEnrollDate(e.target.value)} className="w-full border border-slate-300 p-1.5 text-xs font-bold outline-none" />
              </div>

            </div>

            {/* Provider Section */}
            <div className="border border-slate-300 bg-slate-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block">
              PREFERRED PRIMARY CARE CLINIC/PROVIDER (PCP)
            </div>

            <div className="p-4 border border-slate-300 bg-[#eff6ff] rounded-lg text-slate-800">
              <label className="text-[9.5px] font-black text-blue-900 uppercase block mb-1">PREFERRED KONSULTA ENCOUNTER PROVIDER NAME:</label>
              <input 
                type="text" 
                value={pcsfProviderName} 
                onChange={(e) => setPcsfProviderName(e.target.value)} 
                className="w-full bg-white border border-slate-300 p-2 font-black text-sm uppercase text-blue-950 rounded shadow-inner" 
                placeholder="SAINT FRANCIS CLINIC" 
              />
              <p className="text-[8.5px] text-slate-505 font-bold mt-2">
                * Note: Under Universal Health Care (UHC) Benefit guidelines, select only accredited provider hospitals/centers.
              </p>
            </div>

            {/* Patient declaration Sworn statements */}
            <div className="bg-slate-50 border p-4 rounded-lg space-y-2 text-slate-800 border-slate-300 leading-relaxed text-[10px]">
              <h3 className="font-bold text-blue-800 uppercase tracking-wide">Sworn Statement & Enrollment Authorization:</h3>
              <p>
                I hereby select/enroll <strong>{pcsfProviderName || 'SAINT FRANCIS CLINIC'}</strong> as my official Primary Care Provider for the PhilHealth Konsulta program. 
                I agree that the medical encounters, patient registration profiles, diagnosis histories, and drug prescriptions may be securely shared with PhilHealth 
                for package benefit claims in full compliance with the Philippine Data Privacy Act (RA 10173).
              </p>
            </div>

            {/* Signatures block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 border-slate-300">
              <div className="p-4 border rounded-lg bg-slate-50/50 flex flex-col items-center justify-between min-h-[100px]">
                <div className="w-40 h-0.5 bg-slate-700 mt-10"></div>
                <span className="text-[9.5px] font-black text-slate-800 tracking-wide mt-2">MEMBERS / BENEFICIARY SIGNATURE</span>
              </div>
              <div className="p-4 border rounded-lg bg-slate-50/50 flex flex-col items-center justify-between min-h-[100px]">
                <div className="w-24 h-24 border border-dashed border-slate-300 bg-white rounded flex items-center justify-center">
                  <span className="text-[8px] text-slate-350">Right Thumbprint</span>
                </div>
                <span className="text-[9.5px] font-black text-slate-800 tracking-wide mt-2">THUMBPRINT SPECIMEN SPECIFICATION</span>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Multiple Match Electing Overlays */}
      {showMatchModal && matchingRecords.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Select Matching Member Record</h3>
                <p className="text-slate-500 text-xs mt-1">Found multiple registered members with similar names. Please pick one below to populate details:</p>
              </div>
              <button 
                onClick={() => setShowMatchModal(false)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-lg p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto divide-y divide-slate-100 flex-1">
              {matchingRecords.map((item, idx) => {
                const det = item.pmrfDetails || {};
                return (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => {
                      autoFillFromRecord(item);
                      setShowMatchModal(false);
                      setLookupMessage({ text: 'Record Found', type: 'success' });
                      setSkipSearch(true);
                    }}
                    className="w-full text-left p-3.5 hover:bg-slate-50 transition rounded-xl flex items-center justify-between focus:outline-none group"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-slate-800 uppercase group-hover:text-[#1a56db] transition">
                        {det.lastName}, {det.firstName} {det.middleName || ''} {det.nameExt || ''}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-bold">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">PIN: {det.pin || 'N/A'}</span>
                        <span>•</span>
                        <span>{item.purok}, {item.barangay}</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-black ${
                          item.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                          item.approvalStatus === 'Archived' ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-50 text-amber-600'
                        }`}>{item.approvalStatus}</span>
                      </div>
                    </div>
                    <ChevronDown className="-rotate-90 h-4 w-4 text-slate-350 group-hover:text-[#1a56db] transition" />
                  </button>
                );
              })}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMatchModal(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Record Notification Modal */}
      {showDuplicateModal && duplicateRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-rose-100">
            <div className="p-5 border-b border-rose-50 bg-rose-50/50 flex items-center gap-3">
              <div className="bg-rose-100 p-2 rounded-xl text-rose-600 shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-rose-955 text-base">Record Found</h3>
                <p className="text-rose-700/80 text-xs mt-0.5 font-bold">This PMRF record already exists in Saint Francis Clinic.</p>
              </div>
            </div>
            
            <div className="p-5 text-slate-650 text-xs shadow-inner">
              <p className="leading-relaxed">
                An existing PMRF entry was identified in the database matching your input 
                <strong className="text-slate-800"> PIN ({duplicateRecord.pmrfDetails?.pin || 'N/A'})</strong> or 
                <strong className="text-slate-800"> Name + Date of Birth combination</strong>.
              </p>
              
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 mt-4">
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Matched Record Profile</div>
                <div className="mt-1.5 font-black text-xs text-slate-850 uppercase">
                  {duplicateRecord.householdHead || 'Unknown Name'}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-bold font-mono">
                  <span>ID: {duplicateRecord.householdNumber || 'N/A'}</span>
                  <span>•</span>
                  <span className="text-rose-600 font-extrabold">PIN: {duplicateRecord.pmrfDetails?.pin || 'N/A'}</span>
                </div>
              </div>
              
              <p className="text-[11px] text-slate-400 mt-4 leading-normal italic">
                Would you like to overwrite/update this existing database copy, load this exact record for viewing, or cancel?
              </p>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-650 font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer order-last sm:order-first"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/households/${duplicateRecord.householdId}/all`);
                    if (res.ok) {
                      const fullItem = await res.json();
                      autoFillFromRecord(fullItem);
                      setShowDuplicateModal(false);
                      setLookupMessage({ text: 'Record Found', type: 'success' });
                    } else {
                      autoFillFromRecord(duplicateRecord);
                      setShowDuplicateModal(false);
                    }
                  } catch (err) {
                    autoFillFromRecord(duplicateRecord);
                    setShowDuplicateModal(false);
                  }
                }}
                className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer opacity-90 hover:opacity-100"
              >
                View Existing Record
              </button>
              <button
                type="button"
                onClick={() => {
                  performCommitPMRF(duplicateRecord.householdId);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm active:scale-95"
              >
                Update Existing Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
