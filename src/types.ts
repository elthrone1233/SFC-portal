/**
 * Saint Francis Clinic Types
 */

export interface User {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  position: string;
  address: string;
  groupAssigned: string | null; // Group ID or name
  status: 'Pending Approval' | 'Approved' | 'Disabled';
  createdAt: string;
  updatedAt?: string;
  profilePicture?: string; // Base64 or image URL
  contactNumber?: string;
  dailyRate?: number;
}

export interface Barangay {
  id: string;
  name: string;
  puroksCount: number;
  yakapWillingCount: number;
  householdProgressBar: number; // Percentage
  membersProgressBar: number; // Percentage
  pmrfProgressBar: number; // Percentage
}

export interface Purok {
  id: string;
  name: string;
  barangay: string; // Barangay Name
  barangay_id?: string;
  householdCount: number;
  memberCount: number;
  pmrfCount: number;
  yakapWillingCount: number;
}

export interface Household {
  id: string;
  householdNumber: string;
  householdHead: string;
  contactNumber: string;
  completeAddress: string;
  barangay: string;
  purok: string;
  latitude: number;
  longitude: number;
  pmrfStatus: 'Willing' | 'Not Willing' | 'Pending';
  yakapWillingStatus: 'Willing' | 'Not Willing' | 'Pending';
  approvalStatus: 'Pending' | 'Approved' | 'Disapproved';
  attachments: string[]; // URLs or base64
  remarks?: string;
  pmrfDetails?: any; // Stores full PMRF Form values (PIN, Personal details, Mother's Maiden, Spouse, citizenship, Contributor types, income etc.)
  fpeDetails?: any;  // Stores full First Patient Encounter medical profile
  pcsfDetails?: any; // Stores full Primary Care Selection Form provider credentials
  patientSignature?: string;
  statusNotes?: string;
  
  createdBy: string; // User Name/Email
  updatedBy?: string;
  createdAt: string;
  updatedAt?: string;
  deletedBy?: string; // For Soft Delete
  deletedAt?: string; // For Soft Delete

  // Disapproved Submissions Access Control & Metadata Fields
  submittedByAccountId?: string;
  submittedByUsername?: string;
  dateSubmitted?: string;
  submissionReferenceNumber?: string;
  isFpePcsfOnly?: boolean;
  isNewMemberFpe?: boolean;

  // New Audit Log & Approval/Disapproval Metadata Fields
  approvedBy?: string;
  approvalDate?: string;
  disapprovedBy?: string;
  disapprovalRemarks?: string;
  resubmissionHistory?: Array<{ date: string; action: string; note?: string; user?: string }>;
  lastModifiedAt?: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: 'Male' | 'Female' | 'Other';
  birthdate: string;
  age: number;
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  occupation: string;
  relationship: 'Head' | 'Spouse' | 'Child' | 'Parent' | 'Sibling' | 'Relative' | 'Other';
}

export interface Dependent {
  id: string;
  householdId: string;
  fullName: string;
  gender: 'Male' | 'Female' | 'Other';
  age: number;
  relationship: string;
  birthdate?: string;
  birthDate?: string;
  civilStatus?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  nameExt?: string;
  noMiddleName?: boolean;
  mononym?: boolean;
  citizenship?: string;
  isDisabled?: boolean;
  pmrfSubmissionId?: string;
  pmrfRecordId?: string;
  memberPin?: string;
  submittedByAccountId?: string;
  createdAt?: string;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  name_ext?: string;
  date_of_birth?: string;
  no_mn?: number;
}

export interface Group {
  id: string;
  name: string;
  leader: string; // Leader user name
  coLeaders: string[]; // Co-Leaders user names
  assignedBarangays: string[]; // Barangay Names
  ratePerPerson: number; // Peso rate
  isArchived?: boolean; // Archived flag
  createdAt?: string;
  status?: string;
  barangayFolderId?: string;
}

export interface Payroll {
  groupId: string;
  groupName: string;
  leaderName: string;
  coLeaders: string[];
  populationCount: number;
  ratePerPerson: number;
  totalPayout: number;
  status?: string;
  createdAt?: string;
}

export interface PaidPayroll {
  id: string;
  groupName: string;
  dateRange: string;
  populationCount: number;
  ratePerPerson: number;
  totalAmountPaid: number;
  paidDate: string;
  settledBy: string;
  remarks?: string;
}

export interface HealthRecord {
  id: string;
  patientName: string;
  householdId: string;
  householdHead: string;
  barangay: string;
  diagnosis: string;
  treatment: string;
  medications: string;
  notes?: string;
  date: string;
}

export interface ActivityLog {
  id: string;
  user: string; // Email or name
  action: string;
  module: string;
  date: string;
  time: string;
}

export interface SiteSettings {
  faviconLogo: string;
  faviconTitle: string;
  websiteTitle: string;
  websiteLogo: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  squadDeleteAction?: 'DELETE' | 'ARCHIVE';
  userPagePermissions?: Record<string, string[]>;
  basePcuRate?: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  read: boolean;
  createdAt: string;
}

export interface Timecard {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: 'IN' | 'OUT';
  timestamp: string;
  photo: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  isOvertime?: boolean;
  otHours?: number;
}

export interface PCUFile {
  id: string;
  fullName: string;
  birthday: string;
  fileName: string;
  fileData: string; // Base64 or metadata
  uploadDate: string;
  uploadedBy: string;
}

export interface HouseholdDraft {
  id: string;
  accountId: string;
  residentialArea: string;
  lastModified: string;
  status: 'Draft';
  syncStatus: 'Local Only' | 'Waiting for Sync' | 'Synced';
  formData: any;
}

export function hasRole(user: any | string | null | undefined, requiredRoles: string | string[]): boolean {
  if (!user) return false;
  const position = typeof user === 'string' ? user : user.position;
  if (!position) return false;
  
  const normalize = (r: string): string => {
    const s = r.toUpperCase().trim();
    if (s === 'CLINICAL ADMIN' || s === 'CLINICAL ADMINISTRATOR' || s === 'ADMINISTRATOR') return 'ADMIN';
    if (s === 'CLINICAL MANAGER' || s === 'GENERAL MANAGER') return 'MANAGER';
    if (s === 'HUMAN RESOURCES') return 'HR';
    if (s === 'IT DEVELOPER' || s === 'IT ADMIN') return 'IT';
    if (s === 'HEALTH LEADER' || s === 'BARANGAY HEALTH LEADER') return 'LEADER';
    if (s === 'BARANGAY CO-LEADER') return 'CO-LEADER';
    return s;
  };

  const userRoles = position.split(',').map((r: string) => normalize(r));
  const reqRoles = (Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]).map((r: string) => normalize(r));

  return userRoles.some(r => reqRoles.includes(r));
}

export function checkActionPermission(currentUser: any, actionId: string): boolean {
  if (!currentUser) return false;
  // Master admin email override
  const emailLower = (currentUser.email || '').toLowerCase().trim();
  if (['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(emailLower)) {
    return true;
  }
  
  // Try retrieving cached site settings
  let settings: any = null;
  try {
    const raw = localStorage.getItem('sfc_settings');
    if (raw) {
      settings = JSON.parse(raw);
    }
  } catch (e) {
    console.error(e);
  }
  
  const position = currentUser.position;
  if (!position) return false;
  
  const roles = position.split(',').map((r: string) => r.trim()).filter(Boolean);
  
  // If custom permissions exist for any of the user's roles
  if (settings?.userPagePermissions) {
    for (const role of roles) {
      const allowed = settings.userPagePermissions[role];
      if (allowed && Array.isArray(allowed)) {
        if (allowed.includes(actionId)) {
          return true;
        }
      }
    }
    // If custom permissions are configured and this actionId isn't allowed, return false
    return false;
  }
  
  // Standard hardcoded fallback defaults
  const normalize = (r: string): string => {
    const s = r.toUpperCase().trim();
    if (s === 'CLINICAL ADMIN' || s === 'CLINICAL ADMINISTRATOR' || s === 'ADMINISTRATOR') return 'ADMIN';
    if (s === 'CLINICAL MANAGER' || s === 'GENERAL MANAGER') return 'MANAGER';
    if (s === 'HUMAN RESOURCES') return 'HR';
    if (s === 'IT DEVELOPER' || s === 'IT ADMIN') return 'IT';
    if (s === 'HEALTH LEADER' || s === 'BARANGAY HEALTH LEADER') return 'LEADER';
    if (s === 'BARANGAY CO-LEADER') return 'CO-LEADER';
    return s;
  };
  
  const userRoles = roles.map(normalize);
  for (const role of userRoles) {
    if (role === 'MANAGER') return true;
    
    if (actionId === 'action-household-create') {
      if (['ADMIN', 'LEADER', 'CO-LEADER'].includes(role)) return true;
    }
    if (actionId === 'action-household-edit') {
      if (['ADMIN', 'LEADER', 'CO-LEADER'].includes(role)) return true;
    }
    if (actionId === 'action-household-archive') {
      if (['ADMIN'].includes(role)) return true;
    }
    if (actionId === 'action-household-restore-empty') {
      if (['ADMIN'].includes(role)) return true;
    }
    if (actionId === 'action-approvals-verify') {
      if (['ADMIN', 'HR', 'IT'].includes(role)) return true;
    }
    if (actionId === 'action-daily-accomplishment-export') {
      if (['ADMIN', 'HR', 'IT', 'LEADER', 'CO-LEADER'].includes(role)) return true;
    }
    if (actionId === 'action-consultation-write') {
      if (['ADMIN'].includes(role)) return true;
    }
    if (actionId === 'action-consultation-delete') {
      if (['ADMIN'].includes(role)) return true;
    }
    if (actionId === 'action-accounts-modify') {
      if (['MANAGER', 'HR'].includes(role)) return true;
    }
    if (actionId === 'action-payroll-settle') {
      if (['MANAGER', 'HR'].includes(role)) return true;
    }
    if (actionId === 'action-attendance-delete') {
      if (['MANAGER', 'IT'].includes(role)) return true;
    }
    if (actionId === 'action-settings-modify') {
      if (['MANAGER'].includes(role)) return true;
    }
  }
  
  return false;
}

