import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, Save, HeartPulse, Globe, Sparkles, 
  CheckCircle, Database, FileText, Check, Copy, Download, 
  RefreshCw, Server, Terminal, HelpCircle, Upload, Image as ImageIcon, Trash2,
  BookOpen, Info, AlertTriangle, ArrowRight, AlertCircle,
  KeyRound, ShieldCheck, Lock, User, Users, ChevronRight, Search
} from 'lucide-react';
import { SiteSettings, User as UserType, hasRole } from '../types';

interface SettingsProps {
  currentUser: UserType;
  onSettingsUpdate: (settings: SiteSettings) => void;
}

const DEFAULT_ROLE_PAGES: Record<string, string[]> = {
  HR: [
    'dashboard', 
    'geomap', 
    'barangays', 
    'puroks', 
    'households', 
    'pcu-file',
    'approvals', 
    'masterlist', 
    'daily-accomplishment',
    'daily-attachment',
    'consultation', 
    'payroll', 
    'it-payroll',
    'attendance-monitoring', 
    'audit',
    'blank-forms',
    'action-daily-accomplishment-export',
    'action-payroll-settle',
    'action-approvals-verify'
  ],
  IT: [
    'dashboard', 
    'geomap', 
    'barangays', 
    'puroks', 
    'households', 
    'pcu-file',
    'approvals', 
    'masterlist', 
    'daily-accomplishment',
    'daily-attachment',
    'consultation', 
    'it-payroll',
    'audit',
    'blank-forms',
    'action-daily-accomplishment-export',
    'action-attendance-delete',
    'action-approvals-verify'
  ],
  LEADER: [
    'dashboard', 
    'geomap', 
    'households', 
    'pcu-file',
    'masterlist',
    'daily-accomplishment',
    'daily-attachment',
    'disapproved-submitted',
    'blank-forms',
    'action-household-create',
    'action-household-edit',
    'action-daily-accomplishment-export'
  ],
  'CO-LEADER': [
    'dashboard', 
    'geomap', 
    'households', 
    'pcu-file',
    'masterlist',
    'daily-accomplishment',
    'daily-attachment',
    'disapproved-submitted',
    'blank-forms',
    'action-household-create',
    'action-household-edit',
    'action-daily-accomplishment-export'
  ],
  ADMIN: [
    'dashboard', 
    'geomap', 
    'barangays', 
    'puroks', 
    'households', 
    'pcu-file',
    'masterlist', 
    'daily-accomplishment',
    'daily-attachment',
    'consultation', 
    'it-payroll',
    'audit',
    'blank-forms',
    'action-household-create',
    'action-household-edit',
    'action-household-archive',
    'action-household-restore-empty',
    'action-daily-accomplishment-export',
    'action-consultation-write',
    'action-consultation-delete',
    'action-approvals-verify'
  ],
  MANAGER: [
    'dashboard', 
    'geomap', 
    'barangays', 
    'puroks', 
    'households', 
    'pcu-file',
    'approvals', 
    'disapproved-submitted', 
    'groups', 
    'masterlist', 
    'daily-accomplishment',
    'daily-attachment',
    'consultation', 
    'accounts', 
    'payroll', 
    'it-payroll', 
    'attendance-monitoring', 
    'audit', 
    'settings',
    'blank-forms',
    'action-household-create',
    'action-household-edit',
    'action-household-archive',
    'action-household-restore-empty',
    'action-approvals-verify',
    'action-daily-accomplishment-export',
    'action-consultation-write',
    'action-consultation-delete',
    'action-accounts-modify',
    'action-payroll-settle',
    'action-attendance-delete',
    'action-settings-modify'
  ]
};

const PAGE_OPTIONS = [
  { id: 'dashboard', label: 'Executive Dashboard', desc: 'Main clinical overview widgets and metrics' },
  { id: 'geomap', label: 'Geographic Map Page', desc: 'Geotagged household maps and regional distribution' },
  { id: 'barangays', label: 'Barangays Management', desc: 'Barangay directory and status progress tracker' },
  { id: 'puroks', label: 'Puroks Directory', desc: 'Puroks list nested under different Barangays' },
  { id: 'households', label: 'Households Directory', desc: 'Registering and managing patient profiles for households' },
  { id: 'pcu-file', label: 'PCU File Manager', desc: 'Schedules, tracks, uploads and search PCU physical document databases' },
  { id: 'approvals', label: 'Household Approvals', desc: 'Reviewing and approving raw household registrations' },
  { id: 'disapproved-submitted', label: 'Disapproved Submissions', desc: 'Correcting and resubmitting failed household requests' },
  { id: 'groups', label: 'Group Management', desc: 'Registering operational field squads and assignments' },
  { id: 'masterlist', label: 'Citizen Masterlist', desc: 'Consolidated clinical registry of all members/residents' },
  { id: 'daily-accomplishment', label: 'Daily Accomplishment', desc: 'Daily counting boxes, User Breakdown and PMRF status' },
  { id: 'daily-attachment', label: 'Daily Attachment', desc: 'Display all proof document scans uploaded by field leaders' },
  { id: 'consultation', label: 'Patient Consultation', desc: 'Patient clinical triage, registration logs and general cases' },
  { id: 'accounts', label: 'Account Management', desc: 'Approve, Disable, or configure registered staff member profiles' },
  { id: 'payroll', label: 'Field Squad Payroll', desc: 'Ledgers, settlements, and payouts for operational squads' },
  { id: 'it-payroll', label: 'IT Staff Payroll', desc: 'Timesheets, punch card ledgers, and rate configurations for developers' },
  { id: 'attendance-monitoring', label: 'Attendance Monitoring', desc: 'Review timecard stamp check-ins/outs with photo verification' },
  { id: 'audit', label: 'Audit Trail Logs', desc: 'System-wide activity logging and action histories trace' },
  { id: 'blank-forms', label: 'Blank Forms Catalog', desc: 'Access, print, and download printable clinical and registration documents' },
  { id: 'settings', label: 'System Settings', desc: 'System title, branding logos, Favicon assets, and privileges' }
];

const ACTION_OPTIONS = [
  { id: 'action-household-create', label: 'Formulate & Create Household', desc: 'Authorized to register new households and encode initial member registers' },
  { id: 'action-household-edit', label: 'Modify Household & PMRF details', desc: 'Authorized to edit residential coordinates, patient profiles, and upload attachments' },
  { id: 'action-household-archive', label: 'Archive to Recycle Bin', desc: 'Authorized to safely discard registered house records into the recycle bin' },
  { id: 'action-household-restore-empty', label: 'Restore & Empty Garbage', desc: 'Authorized to retrieve records from garbage bin or execute permanent wipes' },
  { id: 'action-approvals-verify', label: 'Review & Verify Registrations', desc: 'Authorized to approve or reject fresh household formulations within approvals queue' },
  { id: 'action-daily-accomplishment-export', label: 'Export Operations Log Sheets', desc: 'Authorized to print, copy, and export daily output count indices and CSV data' },
  { id: 'action-consultation-write', label: 'Write Triage & Consultation Log', desc: 'Authorized to encode physical diagnoses, symptoms and clinician prescriptions' },
  { id: 'action-consultation-delete', label: 'Delete Clinical History Log', desc: 'Authorized to clean up clinical archives or delete errant case consultation logs' },
  { id: 'action-accounts-modify', label: 'Modify Staff Users Accounts', desc: 'Authorized to handle clinician onboarding, activate roster positions, or block profiles' },
  { id: 'action-payroll-settle', label: 'Settle Salaries & Squad Payroll', desc: 'Authorized to compute hours, verify punch logs, pay operational field groups, and IT' },
  { id: 'action-attendance-delete', label: 'Clear Timecard Stamp Registers', desc: 'Authorized to reset timecards, override punch discrepancies, and purge logs' },
  { id: 'action-settings-modify', label: 'Manage Global Clinic Configurations', desc: 'Authorized to configure organization titles, upload custom letterheads and save access rules' }
];

const ACCOUNT_POSITIONS = [
  { key: 'MANAGER', label: 'Manager / Owner', desc: 'Full root access to all screens, ledgers, security configurations, and logs.' },
  { key: 'HR', label: 'HR Team', desc: 'Handles staff records, payroll checks, attendance monitors, and clinical profiles.' },
  { key: 'IT', label: 'IT Support', desc: 'System integrations, developer timesheet logs, and platform operations.' },
  { key: 'LEADER', label: 'Field Squad Leader', desc: 'In charge of household encoding entry, geographical mapping and citizen verification.' },
  { key: 'CO-LEADER', label: 'Field Squad Co-Leader', desc: 'Assists leader in encoding entries and sub-regions validation.' },
  { key: 'ADMIN', label: 'Clinical Admin', desc: 'Oversees patient triage, case histories, clinical consultations and medical books.' }
];

export default function Settings({ currentUser, onSettingsUpdate }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'brand' | 'mysql' | 'guide' | 'permissions' | 'export' | 'cache'>('brand');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Online/Offline Connection Sync States
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Ensure online synchronization with database status
      try {
        await fetch('/api/mysql-status');
      } catch (err) {}
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache Clearing Handlers
  const handleClearStandardCache = async () => {
    try {
      let ServiceWorkerCount = 0;

      // 1. Clear CacheStorage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }

      // 2. Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          ServiceWorkerCount++;
        }
      }

      // 3. Clear session storage
      sessionStorage.clear();

      setAlertModal({
        isOpen: true,
        title: 'Browser Cache Cleared',
        description: 'Successfully deleted browser CacheStorage caches, unregistered ' + (ServiceWorkerCount ? ServiceWorkerCount.toString() : 'active') + ' Service Worker instances, and cleared SessionStorage context. The browser will now initiate a complete hard page refresh to load newly compiled scripts and assets from cPanel!',
        type: 'success'
      });

      // Reload window after delay
      setTimeout(() => {
        window.location.reload();
      }, 3500);

    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Cache Clearance Aborted',
        description: 'Failed to fully execute browser clearance routines: ' + (err.message || err),
        type: 'error'
      });
    }
  };

  const handleClearPMRFDraft = () => {
    localStorage.removeItem('saint_francis_household_form_draft');
    setAlertModal({
      isOpen: true,
      title: 'Local Form Draft Cleared',
      description: 'The locally saved PhilHealth PMRF Household file registration form draft snapshot has been deleted from localStorage cleanly. All current inputs have been reset to blank.',
      type: 'success'
    });
  };

  const handleClearOfflineSyncQueue = () => {
    localStorage.removeItem('saint_francis_offline_queue');
    setAlertModal({
      isOpen: true,
      title: 'Offline Queue Purged',
      description: 'The local browser-side offline synchronization queue containing unsaved household packets has been purged completely from localStorage.',
      type: 'success'
    });
  };

  // Export States
  const [exportedData, setExportedData] = useState<{ sql: string; json: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [excludeBinaries, setExcludeBinaries] = useState(false);

  const handleTriggerExport = async () => {
    setExportLoading(true);
    setExportSuccess(false);
    try {
      const res = await fetch(`/api/export-data?exclude_binaries=${excludeBinaries}`);
      if (res.ok) {
        const data = await res.json();
        setExportedData(data);
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
        setAlertModal({
          isOpen: true,
          title: 'Database Export Synthesized',
          description: 'All system schemas, indices, and actual records have been fetched successfully and compiled into separate SQL and JSON dumps!',
          type: 'success'
        });
      } else {
        throw new Error('Export service returned error status');
      }
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        title: 'Export Failed',
        description: 'Failed to access export engine API. Please make sure the service is online.',
        type: 'error'
      });
    } finally {
      setExportLoading(false);
    }
  };

  const downloadJSONDump = () => {
    if (!exportedData?.json) return;
    const element = document.createElement("a");
    const file = new Blob([exportedData.json], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `saint-francis-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadSQLDump = () => {
    if (!exportedData?.sql) return;
    const element = document.createElement("a");
    const file = new Blob([exportedData.sql], { type: 'text/sql' });
    element.href = URL.createObjectURL(file);
    element.download = `saint-francis-mysql-dump-${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Import / Restore backup states
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoreStats, setRestoreStats] = useState<any | null>(null);

  const fetchDiscoveredBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await fetch('/api/import-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser?.email ? { 'x-user-email': currentUser.email } : {})
        }
      });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.backups) {
          setBackups(body.backups);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleRestoreFromFile = async (fileName: string) => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/import-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser?.email ? { 'x-user-email': currentUser.email } : {})
        },
        body: JSON.stringify({ filePath: fileName })
      });
      
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response. Status: ${res.status}. ${text.substring(0, 100)}`);
      }

      const body = await res.json();
      if (res.ok && body.success) {
        setRestoreStats(body.stats);
        setAlertModal({
          isOpen: true,
          title: 'Database Restored Successfully',
          description: `All application schemas and files have been successfully restored from ${fileName}. Your system pages are now fully populated!`,
          type: 'success'
        });
        fetchDiscoveredBackups();
      } else {
        throw new Error(body.error || 'Failed to trigger backup import');
      }
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        title: 'Restoration Failed',
        description: err.message || 'Failed to restore database from backup file on server.',
        type: 'error'
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleRawJSONUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExportLoading(true);
    setUploadProgress('Preparing file segments for chunked upload...');
    try {
      const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5MB chunks to easily bypass any 413 ingress/GFE limit
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = 'backup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        setUploadProgress(`Uploading segment ${i + 1} of ${totalChunks} (${Math.round(((i + 1) / totalChunks) * 100)}%)...`);

        const res = await fetch('/api/import-data/upload-chunk', {
          method: 'POST',
          headers: {
            'X-Upload-ID': uploadId,
            'X-Chunk-Index': String(i),
            'X-Total-Chunks': String(totalChunks),
            'Content-Type': 'application/octet-stream',
            ...(currentUser?.email ? { 'x-user-email': currentUser.email } : {})
          },
          body: chunk
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to upload file segment ${i + 1}. Server status: ${res.status}. ${text}`);
        }
      }

      setUploadProgress('Stitching and restoring database records on the server (please wait)...');

      // Request server to stitch/assemble file chunks together and restore database
      const assembleRes = await fetch('/api/import-data/assemble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser?.email ? { 'x-user-email': currentUser.email } : {})
        },
        body: JSON.stringify({ uploadId, totalChunks })
      });

      const contentType = assembleRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await assembleRes.text();
        throw new Error(`Database assembly returned non-JSON response: ${text.substring(0, 100)}`);
      }

      const body = await assembleRes.json();
      if (assembleRes.ok && body.success) {
        setRestoreStats(body.stats);
        setAlertModal({
          isOpen: true,
          title: 'Direct JSON Upload Restored',
          description: `All application schemas have been parsed, validated and fully restored from direct JSON file upload (${(file.size / (1024 * 1024)).toFixed(2)} MB uploaded in ${totalChunks} secure segments with no size limits)!`,
          type: 'success'
        });
        fetchDiscoveredBackups();
      } else {
        throw new Error(body.error || 'Failed to complete database restoration.');
      }
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        title: 'JSON Parse or Restore Failed',
        description: err.message || 'The selected file is not a valid JSON structure backup, or database restoration failed.',
        type: 'error'
      });
    } finally {
      setExportLoading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (activeTab === 'export') {
      fetchDiscoveredBackups();
    }
  }, [activeTab]);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Form states
  const [webTitle, setWebTitle] = useState('');
  const [webLogo, setWebLogo] = useState('');
  const [faviconTitle, setFaviconTitle] = useState('');
  const [faviconLogo, setFaviconLogo] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [squadDeleteAction, setSquadDeleteAction] = useState<'DELETE' | 'ARCHIVE'>('ARCHIVE');

  // Master Access Override Permissions Manager States
  const isMasterAdmin = ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser?.email);
  const [selectedPosition, setSelectedPosition] = useState<string>('HR');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (settings) {
      const customPerms = settings.userPagePermissions?.[selectedPosition];
      if (customPerms && Array.isArray(customPerms)) {
        setSelectedPages(customPerms);
      } else {
        const defaults = DEFAULT_ROLE_PAGES[selectedPosition] || ['dashboard'];
        setSelectedPages(defaults);
      }
    }
  }, [selectedPosition, settings]);

  const handleSelectPosition = (posKey: string) => {
    setSelectedPosition(posKey);
  };

  const handleTogglePage = (pageId: string) => {
    setSelectedPages(prev => {
      if (prev.includes(pageId)) {
        return prev.filter(p => p !== pageId);
      } else {
        return [...prev, pageId];
      }
    });
  };

  const selectAllPages = () => {
    const all = [
      ...PAGE_OPTIONS.map(p => p.id),
      ...ACTION_OPTIONS.map(a => a.id)
    ];
    setSelectedPages(all);
  };

  const deselectAllPages = () => {
    setSelectedPages([]);
  };

  const invertPageSelection = () => {
    const allIds = [
      ...PAGE_OPTIONS.map(p => p.id),
      ...ACTION_OPTIONS.map(a => a.id)
    ];
    setSelectedPages(prev => allIds.filter(id => !prev.includes(id)));
  };

  const resetToRoleDefaults = () => {
    const defaults = DEFAULT_ROLE_PAGES[selectedPosition] || ['dashboard'];
    setSelectedPages(defaults);
  };

  const handleSavePermissions = async () => {
    if (!selectedPosition) return;
    setUpdatingPermissions(true);

    const updatedPermissions = {
      ...(settings?.userPagePermissions || {})
    };

    updatedPermissions[selectedPosition] = selectedPages;

    const updatedSettingsData: SiteSettings = {
      faviconLogo,
      faviconTitle,
      websiteTitle: webTitle,
      websiteLogo: webLogo,
      seoTitle,
      seoDescription,
      seoKeywords,
      squadDeleteAction,
      userPagePermissions: updatedPermissions
    };

    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify(updatedSettingsData)
      });
      if (res.ok) {
        setSettings(updatedSettingsData);
        onSettingsUpdate(updatedSettingsData);
        localStorage.setItem('sfc_settings', JSON.stringify(updatedSettingsData));
        setAlertModal({
          isOpen: true,
          title: 'Access List Synchronized',
          description: `Custom page access privileges for position ${selectedPosition} have been successfully updated.`,
          type: 'success'
        });
      } else {
        throw new Error('Server returned an error');
      }
    } catch (e) {
      setAlertModal({
        isOpen: true,
        title: 'Designation Failed',
        description: 'Failed to record updated page access configurations in the Saint Francis database.',
        type: 'error'
      });
    } finally {
      setUpdatingPermissions(false);
    }
  };

  // MySQL Integration States
  const [mysqlStatus, setMysqlStatus] = useState<{
    connected: boolean;
    message: string;
    config?: { host: string; user: string; database: string; port: number };
  } | null>(null);
  const [mysqlLoading, setMysqlLoading] = useState(false);
  const [sqlSchema, setSqlSchema] = useState('');
  const [copied, setCopied] = useState(false);

  const [webLogoMode, setWebLogoMode] = useState<'upload' | 'text'>('upload');
  const [faviconLogoMode, setFaviconLogoMode] = useState<'upload' | 'text'>('upload');

  const [troubleTab, setTroubleTab] = useState<'local' | 'cpanel'>('local');
  const [envCopied, setEnvCopied] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'web' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        if (target === 'web') {
          setWebLogo(event.target.result);
        } else {
          setFaviconLogo(event.target.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchSettings();
    fetchMySQLStatus();
    fetchSQLSchema();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setWebTitle(data.websiteTitle || '');
        setWebLogo(data.websiteLogo || 'https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png');
        setFaviconTitle(data.faviconTitle || '');
        setFaviconLogo(data.faviconLogo || '');
        setSeoTitle(data.seoTitle || '');
        setSeoDescription(data.seoDescription || '');
        setSeoKeywords(data.seoKeywords || '');
        setSquadDeleteAction(data.squadDeleteAction || 'ARCHIVE');
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMySQLStatus = async () => {
    setMysqlLoading(true);
    try {
      const res = await fetch('/api/mysql-status');
      if (res.ok) {
        const data = await res.json();
        setMysqlStatus(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMysqlLoading(false);
    }
  };

  const fetchSQLSchema = async () => {
    try {
      const res = await fetch('/api/mysql-schema');
      if (res.ok) {
        const data = await res.json();
        setSqlSchema(data.sql);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasRole(currentUser, ['ADMIN', 'MANAGER'])) {
      setAlertModal({
        isOpen: true,
        title: 'Access Restricted',
        description: 'Only Clinical Administrative accounts or Managers can adjust general preferences!',
        type: 'error'
      });
      return;
    }

    const updatedData: SiteSettings = {
      websiteTitle: webTitle,
      websiteLogo: webLogo,
      faviconTitle,
      faviconLogo,
      seoTitle,
      seoDescription,
      seoKeywords,
      squadDeleteAction,
      userPagePermissions: settings?.userPagePermissions || {}
    };

    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        onSettingsUpdate(updatedData);
        setAlertModal({
          isOpen: true,
          title: 'Preferences Updated',
          description: 'Your clinical identity variations under Saint Francis have been successfully saved.',
          type: 'success'
        });
      }
    } catch(e) {
      setAlertModal({
        isOpen: true,
        title: 'Action Failed',
        description: 'Failed to synchronize updated preferences with Saint Francis Database.',
        type: 'error'
      });
    }
  };

  const handleCopyToClipboard = () => {
    if (!sqlSchema) return;
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!sqlSchema) return;
    const element = document.createElement("a");
    const file = new Blob([sqlSchema], { type: 'text/sql' });
    element.href = URL.createObjectURL(file);
    element.download = "mysql-schema.sql";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 flex-wrap">
        <button
          onClick={() => setActiveTab('brand')}
          className={`py-3 px-6 font-bold uppercase tracking-wider text-[11px] border-b-2 flex items-center gap-2 transition cursor-pointer select-none ${
            activeTab === 'brand' 
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/30' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          General Brand Settings
        </button>
        <button
          onClick={() => setActiveTab('mysql')}
          className={`py-3 px-6 font-bold uppercase tracking-wider text-[11px] border-b-2 flex items-center gap-2 transition cursor-pointer select-none ${
            activeTab === 'mysql' 
              ? 'border-blue-600 text-blue-800 bg-blue-50/20' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Database className="h-4 w-4 text-blue-600" />
          cPanel & MySQL Integration
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`py-3 px-6 font-bold uppercase tracking-wider text-[11px] border-b-2 flex items-center gap-2 transition cursor-pointer select-none ${
            activeTab === 'guide' 
              ? 'border-indigo-600 text-indigo-800 bg-indigo-50/20' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <BookOpen className="h-4 w-4 text-indigo-600" />
          cPanel & MySQL Deployment Guide
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`py-3 px-6 font-bold uppercase tracking-wider text-[11px] border-b-2 flex items-center gap-2 transition cursor-pointer select-none ${
            activeTab === 'export' 
              ? 'border-rose-600 text-rose-800 bg-rose-50/20' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Download className="h-4 w-4 text-rose-600" />
          Export All Data
        </button>
        <button
          onClick={() => setActiveTab('cache')}
          className={`py-3 px-6 font-bold uppercase tracking-wider text-[11px] border-b-2 flex items-center gap-2 transition cursor-pointer select-none ${
            activeTab === 'cache' 
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/20' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <RefreshCw className="h-4 w-4 text-emerald-600" />
          Cache & Force Updates
        </button>
        {isMasterAdmin && (
          <button
            onClick={() => setActiveTab('permissions')}
            className={`py-3 px-6 font-bold uppercase tracking-wider text-[11px] border-b-2 flex items-center gap-2 transition cursor-pointer select-none ${
              activeTab === 'permissions' 
                ? 'border-amber-600 text-amber-805 bg-amber-50/20' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <KeyRound className="h-4 w-4 text-amber-600" />
            Account Page & Access Designation
          </button>
        )}
      </div>

      {activeTab === 'brand' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Parameters form panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="border-b pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                  <SettingsIcon className="h-5 w-5 text-emerald-600 animate-spin" style={{ animationDuration: '6s' }} />
                  Clinic Brand Parameters
                </h2>
                <p className="text-slate-400 text-[10px] mt-1">Configure workspace logos, custom headings, and search indexing credentials</p>
              </div>
              
              {saveSuccess && (
                <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-full flex items-center gap-1 text-[10px] animate-bounce">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Settled!
                </span>
              )}
            </div>

            {!hasRole(currentUser, ['ADMIN', 'MANAGER']) ? (
              <div className="bg-amber-50 p-4 border border-amber-200 rounded text-amber-900 text-xs text-center font-medium leading-normal">
                ⚠️ Restricted view. System configuration sliders can only be adjusted by full ADMIN/MANAGER operators.
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Website Title header</label>
                    <input
                      type="text"
                      value={webTitle}
                      onChange={(e) => setWebTitle(e.target.value)}
                      className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Favicon Window title</label>
                    <input
                      type="text"
                      value={faviconTitle}
                      onChange={(e) => setFaviconTitle(e.target.value)}
                      className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                  {/* Website Logo Upload */}
                  <div className="space-y-2 p-3 bg-slate-50/50 border rounded-xl shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="block text-slate-750 font-extrabold text-[10px] uppercase tracking-wider">Website Header Logo</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setWebLogoMode('upload')}
                          className={`px-2 py-0.5 text-[9px] rounded font-bold cursor-pointer transition ${webLogoMode === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-205 text-slate-600'}`}
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebLogoMode('text')}
                          className={`px-2 py-0.5 text-[9px] rounded font-bold cursor-pointer transition ${webLogoMode === 'text' ? 'bg-emerald-600 text-white' : 'bg-slate-205 text-slate-600'}`}
                        >
                          Manual Code
                        </button>
                      </div>
                    </div>

                    {webLogoMode === 'upload' ? (
                      <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-white transition flex flex-col items-center justify-center min-h-[90px] cursor-pointer group bg-slate-50">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'web')}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        {webLogo && (webLogo.startsWith('data:image/') || webLogo.startsWith('http://') || webLogo.startsWith('https://')) ? (
                          <div className="flex flex-col items-center gap-1.5 z-10 pointer-events-none">
                            <img src={webLogo} alt="Web Logo preview" className="h-10 w-auto object-contain bg-slate-800 rounded p-1 shadow-sm" />
                            <span className="text-[9px] text-emerald-600 font-extrabold">✓ Loaded File Successfully</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 z-10 pointer-events-none text-slate-400 group-hover:text-slate-600">
                            <Upload className="h-5 w-5 text-slate-600 animate-bounce" />
                            <span className="text-[10px] font-extrabold">Select or drag logo</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={webLogo}
                        onChange={(e) => setWebLogo(e.target.value)}
                        placeholder="🏥"
                        className="bg-white border p-2 w-full rounded focus:outline-none font-bold"
                      />
                    )}
                  </div>

                  {/* Favicon Logo Upload */}
                  <div className="space-y-2 p-3 bg-slate-50/50 border rounded-xl shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="block text-slate-750 font-extrabold text-[10px] uppercase tracking-wider">Favicon Graphic Logo</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setFaviconLogoMode('upload')}
                          className={`px-2 py-0.5 text-[9px] rounded font-bold cursor-pointer transition ${faviconLogoMode === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-205 text-slate-600'}`}
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setFaviconLogoMode('text')}
                          className={`px-2 py-0.5 text-[9px] rounded font-bold cursor-pointer transition ${faviconLogoMode === 'text' ? 'bg-emerald-600 text-white' : 'bg-slate-205 text-slate-600'}`}
                        >
                          Manual Code
                        </button>
                      </div>
                    </div>

                    {faviconLogoMode === 'upload' ? (
                      <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-white transition flex flex-col items-center justify-center min-h-[90px] cursor-pointer group bg-slate-50">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'favicon')}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        {faviconLogo && (faviconLogo.startsWith('data:image/') || faviconLogo.startsWith('http://') || faviconLogo.startsWith('https://')) ? (
                          <div className="flex flex-col items-center gap-1.5 z-10 pointer-events-none">
                            <img src={faviconLogo} alt="Favicon preview" className="h-10 w-auto object-contain bg-slate-800 rounded p-1 shadow-sm" />
                            <span className="text-[9px] text-emerald-600 font-extrabold">✓ Loaded File Successfully</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 z-10 pointer-events-none text-slate-400 group-hover:text-slate-600">
                            <Upload className="h-5 w-5 text-slate-600 animate-bounce" />
                            <span className="text-[10px] font-extrabold">Select or drag favicon</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={faviconLogo}
                        onChange={(e) => setFaviconLogo(e.target.value)}
                        placeholder="https://icon-url.com"
                        className="bg-white border p-2 w-full rounded focus:outline-none font-semibold"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="font-bold text-blue-700 block uppercase tracking-wider text-[11px]">Search Engine Optimization (SEO) parameters</span>
                  
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">SEO Title Tag</label>
                    <input
                      type="text"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">SEO Meta Description</label>
                    <textarea
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      className="bg-slate-50 border p-2 h-16 w-full rounded focus:outline-none leading-normal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">SEO Search Keywords (Comma separate)</label>
                    <input
                      type="text"
                      value={seoKeywords}
                      onChange={(e) => setSeoKeywords(e.target.value)}
                      className="bg-slate-50 border p-2 w-full rounded focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 my-2">
                  <span className="block text-slate-700 font-bold mb-1 text-xs">Squad Deletion Global Rule Settings</span>
                  <p className="text-[10px] text-slate-550 mb-2.5 leading-snug">Choose what happens to the linked Payroll folders when a Squad is deleted in the Group Management module.</p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="squadDeleteAction"
                        value="ARCHIVE"
                        checked={squadDeleteAction === 'ARCHIVE'}
                        onChange={() => setSquadDeleteAction('ARCHIVE')}
                        className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      Archive linked Payroll folders (Recommend)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="squadDeleteAction"
                        value="DELETE"
                        checked={squadDeleteAction === 'DELETE'}
                        onChange={() => setSquadDeleteAction('DELETE')}
                        className="text-rose-600 focus:ring-rose-500 h-4 w-4"
                      />
                      Permanently Delete linked Payroll folders
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full btn-3d-primary btn-pulse-save font-extrabold uppercase text-xs flex items-center justify-center gap-1.5 py-3 cursor-pointer select-none tracking-wider text-center"
                >
                  <Save className="h-4 w-4" /> Save active Site Parameters
                </button>

              </form>
            )}
          </div>

          {/* 2. Visual card preview panel */}
          <div className="bg-slate-50 p-5 rounded-xl border ring-1 ring-slate-100 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-700 flex items-center gap-1 text-xs mb-4">
                <Globe className="h-4 w-4 text-sky-600 animate-spin" style={{ animationDuration: '5s' }} /> Live Visual Card Preview
              </h3>

              <div className="space-y-4">
                {/* Browser Preview tab mock */}
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden text-[11px]">
                  <div className="bg-slate-100 p-2 border-b flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-400"></span>
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-400"></span>
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-400"></span>
                    
                    <div className="bg-white rounded px-3 py-0.5 text-[10px] text-slate-500 font-mono w-48 truncate ml-3 border">
                      {faviconLogo || 'https://domain.com'}
                    </div>
                  </div>

                  <div className="p-3.5 flex items-center gap-2 border-b bg-slate-50/50">
                    {faviconLogo && (faviconLogo.startsWith('http://') || faviconLogo.startsWith('https://') || faviconLogo.startsWith('data:image/')) ? (
                      <img src={faviconLogo} alt="Favicon preview" className="h-5 w-5 rounded object-cover" />
                    ) : (
                      <span className="text-sm">{faviconLogo || '🏥'}</span>
                    )}
                    <span className="font-bold text-slate-800 font-sans truncate">{faviconTitle || 'Saint Francis Portal'}</span>
                  </div>
                </div>

                {/* Google Search Result card mock */}
                <div className="bg-white border p-4 rounded-lg shadow-sm space-y-1 text-xs">
                  <span className="text-[10px] text-slate-400 block font-mono">Google search citation: https://saintfrancisclinic.gov</span>
                  <strong className="text-blue-700 text-sm font-sans hover:underline cursor-pointer block">
                    {seoTitle || 'Saint Francis Portal'}
                  </strong>
                  <p className="text-slate-600 leading-normal text-[11px]">
                    {seoDescription || 'Enterprise-grade clinic information and field operation mapping system dedicated to local Puroks.'}
                  </p>
                  <div className="flex gap-1.5 flex-wrap pt-2">
                    {seoKeywords.split(',').map((kw, i) => (
                      <span key={i} className="bg-slate-100 text-[9px] text-slate-500 px-1.5 py-0.5 rounded font-mono font-medium">
                        {kw.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Website logo header visualization mock */}
                <div className="bg-blue-900 border-2 border-dashed border-blue-950/40 text-white rounded-lg p-3.5 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2">
                    {webLogo && (webLogo.startsWith('http://') || webLogo.startsWith('https://') || webLogo.startsWith('data:image/')) ? (
                      <img src={webLogo} alt="Web logo preview" className="h-6 w-auto object-contain max-w-[40px] rounded" />
                    ) : (
                      <span className="text-base">{webLogo || '🏥'}</span>
                    )}
                    <span className="font-bold text-xs tracking-wide uppercase">{webTitle}</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold uppercase text-amber-300">ADMIN VIEW ONLY</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-blue-900 leading-normal mt-6 text-[11px] font-medium flex items-start gap-2">
              <Sparkles className="h-4.5 w-4.5 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <span> Adjusting credentials triggers document header updates inside Google metadata registries, rendering instant logo changes at the top navigation sidebar.</span>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'mysql' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-6 shadow-sm border border-indigo-950 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="bg-sky-500/20 text-sky-300 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">cPanel hosting module is armed</span>
              <h2 className="text-xl font-bold font-sans tracking-tight">Active phpMyAdmin database schema is generated!</h2>
              <p className="text-indigo-200 max-w-xl text-[11px] leading-relaxed">
                We have fully optimized the clinic database records schema structure specifically for MySQL deployment. 
                Below you can review the live database status, copy the ready-to-run DDL sql script syntax, or download the direct `.sql` file to import into cPanel.
              </p>
            </div>
            
            <button
              onClick={handleDownloadFile}
              className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition text-[11px] uppercase tracking-wider shrink-0"
            >
              <Download className="h-4 w-4" /> Download config mysql-schema.sql
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* cPanel Connection Status Panel */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Server className="h-4 w-4 text-slate-600" /> Connection test
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">Live handshake status overview</p>
                </div>
                <button
                  onClick={fetchMySQLStatus}
                  title="Refresh Test"
                  disabled={mysqlLoading}
                  className="bg-slate-100 text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${mysqlLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {mysqlStatus ? (
                <div className="space-y-4 text-[11px]">
                  <div className={`p-3.5 rounded-lg border flex items-start gap-2 ${
                    mysqlStatus.connected 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-amber-50 border-amber-100 text-amber-800'
                  }`}>
                    <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${mysqlStatus.connected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                    <div className="space-y-1">
                      <strong className="font-bold text-xs">
                        {mysqlStatus.connected ? 'MySQL Host Connected!' : 'Local / JSON DB Fallback'}
                      </strong>
                      <p className="opacity-90 leading-relaxed text-[10px]">{mysqlStatus.message}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2.5">
                    <strong className="text-slate-700 block text-[10px] uppercase tracking-wider">Connection Parameters:</strong>
                    
                    <div className="space-y-1.5 font-mono text-[10px]">
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-400">DB_HOST:</span>
                        <span className="font-bold text-slate-700">{mysqlStatus.config?.host || 'Not Set'}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-400">DB_USER:</span>
                        <span className="font-bold text-slate-700">{mysqlStatus.config?.user || 'Not Set'}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-400">DB_NAME:</span>
                        <span className="font-bold text-slate-700">{mysqlStatus.config?.database || 'Not Set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">DB_PORT:</span>
                        <span className="font-bold text-slate-700">{mysqlStatus.config?.port || '3306'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border text-slate-500 leading-normal text-[10px] space-y-1">
                    <div className="flex items-center gap-1 font-bold text-slate-700">
                      <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
                      <span>How to switch database?</span>
                    </div>
                    <p>
                      Add database keys into your project's `.env` file on cPanel. The node backend is built with <strong>mysql2</strong> to auto-connect upon startup.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                  <span className="text-slate-400 font-mono text-[10px]">Evaluating handshake checks...</span>
                </div>
              )}
            </div>

            {/* DDL SQL Schema Viewer Section */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <FileText className="h-4 w-4 text-emerald-600" /> SQL DDL schema syntax script
                    </h3>
                    <p className="text-slate-400 text-[10px] mt-0.5">phpMyAdmin direct import compatible structures</p>
                  </div>

                  <button
                    onClick={handleCopyToClipboard}
                    className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border text-slate-700 py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer select-none font-bold text-[10px] transition"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-slate-500" /> Copy SQL Code
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-900 text-slate-300 font-mono text-[9px] p-4 rounded-xl border border-slate-950 h-72 overflow-y-auto leading-relaxed relative">
                  <div className="absolute top-2 right-2 bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-sans font-bold tracking-wider">MYSQL SCHEMA</div>
                  <pre>{sqlSchema || '-- Loading database SQL script...'}</pre>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-blue-950 leading-relaxed text-[11px] font-medium mt-4">
                <strong className="text-blue-900 block mb-1 text-xs uppercase font-extrabold">📌 Quick Setup Instruction sequence:</strong>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Download the file above or copy the contents.</li>
                  <li>Enter your cPanel account, create a new MySQL database name in <strong>MySQL Databases wizard</strong>.</li>
                  <li>Open <strong>phpMyAdmin</strong>, select your target database, and navigate to the <strong>Import</strong> tab.</li>
                  <li>Upload the SQL script, and hit <strong>Import / Go</strong> to seamlessly create 12 tables and inject standard diagnostic baseline seeds instantly!</li>
                </ol>
              </div>

            </div>
          </div>
        </div>
      )}

      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl p-6 shadow-md border border-indigo-950 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="bg-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-full text-[10px] uppercase font-extrabold tracking-wider border border-indigo-500/20">cPanel & MySQL Checklist Master</span>
              <h2 className="text-xl font-extrabold font-sans tracking-tight">cPanel Web Hosting Deployment Handbook</h2>
              <p className="text-slate-305 max-w-2xl text-[11px] leading-relaxed">
                Follow this interactive handbook step-by-step to bind this React SPA and customized Node.js Express API server directly inside standard Linux cPanel environments with zero CLI overhead.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDownloadFile}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition text-[10px] uppercase tracking-wider shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> Download Script
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Step Walkthrough Cards */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Part 1: Setting up MySQL on cPanel */}
              <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b pb-3">
                  <div className="bg-blue-100 text-blue-700 font-extrabold text-sm h-6 w-6 rounded-full flex items-center justify-center">1</div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Part 1: Create & Register MySQL Database on cPanel</h3>
                    <p className="text-slate-405 text-[10px]">Create databases, users, and configure read/write permissions</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-600 leading-relaxed font-semibold">
                  <div className="space-y-3 p-3.5 bg-slate-50 border rounded-lg">
                    <strong className="text-slate-700 block text-[10px] uppercase tracking-wider font-extrabold">🚨 Database Credentials Wizard:</strong>
                    <ol className="list-decimal pl-4.5 space-y-1.5 text-slate-650">
                      <li>Log in to your <strong>cPanel</strong> service panel.</li>
                      <li>Find and click the <strong>MySQL® Database Wizard</strong>.</li>
                      <li>Define a unique suffix name (e.g., <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-700 font-bold">yourusername_sfclinic</code>).</li>
                      <li>Click <strong>Next Step</strong>.</li>
                    </ol>
                  </div>

                  <div className="space-y-3 p-3.5 bg-slate-50 border rounded-lg">
                    <strong className="text-slate-700 block text-[10px] uppercase tracking-wider font-extrabold">🔐 Bind Database & User Accounts:</strong>
                    <ol className="list-decimal pl-4.5 space-y-1.5 text-slate-650">
                      <li>Create a database user account (e.g., <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-700 font-bold">yourusername_sfcuser</code>) with a secure password.</li>
                      <li>On the Privileges page, enable <strong>ALL PRIVILEGES</strong>.</li>
                      <li>Tick <strong>Make Changes</strong> to secure connection rights.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Part 2: Import SQL Script with phpMyAdmin */}
              <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b pb-3">
                  <div className="bg-emerald-100 text-emerald-700 font-extrabold text-sm h-6 w-6 rounded-full flex items-center justify-center">2</div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Part 2: Database Migration with phpMyAdmin</h3>
                    <p className="text-slate-405 text-[10px]">Establish tables, indices, and setup baseline dataset feeds</p>
                  </div>
                </div>

                <div className="space-y-3 text-[11px] font-semibold leading-relaxed">
                  <p className="text-slate-650">
                    Use cPanel's built-in phpMyAdmin interface to import the SQL schemas into your database easily:
                  </p>
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2.5">
                    <ol className="list-decimal pl-4.5 space-y-1.5 text-emerald-900">
                      <li>Launch <strong>phpMyAdmin</strong> from your cPanel dashboard workspace.</li>
                      <li>Select your newly provisioned database from the left sidebar tree.</li>
                      <li>Click the <strong>Import</strong> utility tab in the top menu bar.</li>
                      <li>Click <strong>Browse</strong> or <strong>Choose File</strong> and navigate to select your <strong className="font-bold underline">mysql-schema.sql</strong> file.</li>
                      <li>Set format settings as <strong>SQL</strong> and click the <strong>Import</strong> / <strong>Go</strong> button to instantiate tables and seed baseline data!</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Part 3: Environment Variable Variables */}
              <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b pb-3">
                  <div className="bg-amber-100 text-amber-700 font-extrabold text-sm h-6 w-6 rounded-full flex items-center justify-center">3</div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Part 3: Swapping Node Connection Details</h3>
                    <p className="text-slate-405 text-[10px]">Mount custom credentials inside .env secrets file</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-50 p-2 border rounded-lg">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block">Root environment secrets template (.env):</span>
                    <button
                      type="button"
                      onClick={() => {
                        const envPlaceholder = `# MySQL Configuration Details\nDB_HOST=localhost\nDB_USER=yourusername_sfcuser\nDB_PASSWORD=your_secure_password\nDB_NAME=yourusername_sfclinic\nDB_PORT=3306`;
                        navigator.clipboard.writeText(envPlaceholder);
                        setEnvCopied(true);
                        setTimeout(() => setEnvCopied(false), 2000);
                      }}
                      className="bg-slate-205 text-slate-705 hover:bg-slate-300 font-bold px-2 py-1 rounded transition text-[9px] flex items-center gap-1 cursor-pointer"
                    >
                      {envCopied ? <Check className="h-3 w-3 text-emerald-600 font-bold" /> : <Copy className="h-3 w-3" />}
                      {envCopied ? 'Copied' : 'Copy Values'}
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-950 p-3.5 rounded-xl text-slate-300 font-mono text-[10px] leading-relaxed">
                    <span className="text-slate-500 block select-none"># Change these placeholders to real cPanel details:</span>
                    <div>DB_HOST=<span className="text-emerald-400 font-bold">localhost</span></div>
                    <div>DB_USER=<span className="text-amber-400 font-bold">yourusername_sfcuser</span></div>
                    <div>DB_PASSWORD=<span className="text-pink-400 font-bold">your_secure_passcode</span></div>
                    <div>DB_NAME=<span className="text-sky-400 font-bold">yourusername_sfclinic</span></div>
                    <div>DB_PORT=<span className="text-teal-400 font-bold">3306</span></div>
                  </div>
                  
                  <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl leading-relaxed text-[11px] text-amber-900 font-semibold">
                    💡 NOTE: Keep "DB_HOST" set to "localhost" because cPanel typically serves MySQL databases and Node.js instances inside the same server node.
                  </div>
                </div>
              </div>

              {/* Part 4: Deploying Node App via cPanel */}
              <div className="bg-white p-5 rounded-xl border border-slate-150 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b pb-3">
                  <div className="bg-purple-105 text-purple-700 font-extrabold text-sm h-6 w-6 rounded-full flex items-center justify-center">4</div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Part 4: Launching Node App on cPanel Web Interface</h3>
                    <p className="text-slate-405 text-[10px]">Create virtual environment context inside standard virtual hosts</p>
                  </div>
                </div>

                <div className="space-y-4 text-[11px] text-slate-650 leading-relaxed font-semibold">
                  <p>
                    Follow these step sequences inside cPanel's Setup Node.js app tab:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border rounded-xl divide-y space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-indigo-700 font-extrabold block uppercase tracking-wider">1. CREATE APP INSTANCE</span>
                        <p className="text-[10px] text-slate-500 leading-normal">Locate and click <strong>"Setup Node.js App"</strong>. Hit <strong>"Create Application"</strong> in the top right.</p>
                      </div>
                      <div className="pt-2 flex flex-col gap-1">
                        <span className="text-[10px] text-indigo-700 font-extrabold block uppercase tracking-wider">2. NODE VERSION</span>
                        <p className="text-[10px] text-slate-505 leading-normal">Select version <strong>18.x</strong> or <strong>20.x</strong> from standard parameters list.</p>
                      </div>
                      <div className="pt-2 flex flex-col gap-1.5">
                        <span className="text-[10px] text-indigo-700 font-extrabold block uppercase tracking-wider">3. ENVIRONMENT MODE</span>
                        <div>
                          <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[9px] font-mono font-bold">production</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border rounded-xl divide-y space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-indigo-700 font-extrabold block uppercase tracking-wider">4. APPLICATION ROOT</span>
                        <p className="text-[10px] text-slate-505 leading-normal">Enter folder directory location (e.g., <code className="bg-slate-200 px-1 rounded text-red-700 font-mono text-[9px]">public_html/sfclinic</code>).</p>
                      </div>
                      <div className="pt-2 flex flex-col gap-1">
                        <span className="text-[10px] text-indigo-700 font-extrabold block uppercase tracking-wider">5. APPLICATION URL</span>
                        <p className="text-[10px] text-slate-505 leading-normal">Bind it to your primary domain (e.g., <code className="text-slate-700 font-mono text-[9px]">clinic.yourdomain.com</code>).</p>
                      </div>
                      <div className="pt-2 flex flex-col gap-1">
                        <span className="text-[10px] text-indigo-700 font-extrabold block uppercase tracking-wider">6. STARTUP FILE ENTRY</span>
                        <p className="text-[10px] text-slate-505 leading-normal">Provide the compiled server script file: <code className="bg-slate-205 px-1 rounded text-emerald-800 font-mono text-[9px]">dist/server.cjs</code>.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Part 5: Side panel - Interactive Troubleshooting and Error Handling */}
            <div className="space-y-6">
              
              <div className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-2 border-b border-amber-200 pb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 animate-bounce mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider leading-none">Part 5: Troubleshooting Build Errors</h3>
                    <span className="text-amber-800 text-[10px] mt-1 block">Quick fixes for "vite: command not found" & terminal issues</span>
                  </div>
                </div>

                <div className="bg-white/90 p-3.5 rounded-xl border border-amber-100 shadow-inner font-semibold text-[11px] leading-relaxed text-slate-700">
                  <strong className="text-amber-950 block mb-1 text-xs font-extrabold">❌ Common Error Scenario:</strong>
                  <div className="bg-slate-900 text-red-500 p-2 rounded font-mono text-[9.5px] mb-2 border border-slate-950 shadow-inner break-all select-all font-bold">
                    'vite' is not recognised as an internal or external command, operable program or batch file...
                  </div>
                  <p className="text-slate-650 text-[10.5px]">
                    <strong>Why it happens:</strong> This error occurs because the project's dependencies are missing. Meaning the <code className="bg-slate-100 px-1 text-amber-700 rounded text-[9.5px] font-mono">npm install</code> step was skipped, so the computer cannot find the <code className="text-slate-800 font-bold">vite</code> tool to compile the assets.
                  </p>
                </div>

                {/* Sub tabs for local computer vs cpanel fixes */}
                <div className="space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-500 block uppercase tracking-wider">Select your Environment to fix:</span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setTroubleTab('local')}
                      className={`py-1.5 px-3 font-extrabold rounded-md text-[10px] uppercase tracking-wide cursor-pointer text-center select-none shadow-sm transition ${troubleTab === 'local' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-850'}`}
                    >
                      💻 On Local PC/Mac
                    </button>
                    <button
                      type="button"
                      onClick={() => setTroubleTab('cpanel')}
                      className={`py-1.5 px-3 font-extrabold rounded-md text-[10px] uppercase tracking-wide cursor-pointer text-center select-none shadow-sm transition ${troubleTab === 'cpanel' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-850'}`}
                    >
                      🌐 On cPanel Admin
                    </button>
                  </div>

                  {troubleTab === 'local' ? (
                    <div className="bg-white p-3.5 border border-amber-100 rounded-xl space-y-2.5 text-[11px]">
                      <strong className="text-slate-800 font-bold block text-[10px] uppercase tracking-wider">💻 How to fix on your personal computer:</strong>
                      <p className="text-slate-600 font-medium">If compiling the code locally on your computer before uploading folders to host server files:</p>
                      
                      <ol className="list-decimal pl-4.5 space-y-2 text-slate-650 font-semibold">
                        <li>Open your command shell prompt (e.g. <code>Command Prompt</code> or <code>Terminal</code>).</li>
                        <li>Navigate into the project root directory folder containing <code className="bg-slate-100 px-1 rounded text-slate-700 font-mono text-[10px]">package.json</code>:
                          <pre className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[9.5px] mt-1 overflow-x-auto">cd path/to/your/project-folder</pre>
                        </li>
                        <li>Force pull dependencies to download and deploy vite suite tools:
                          <pre className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[9.5px] mt-1 overflow-x-auto">npm install</pre>
                        </li>
                        <li>Re-run the compile production command scripts:
                          <pre className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[9.5px] mt-1 overflow-x-auto">npm run build</pre>
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="bg-white p-3.5 border border-slate-200 rounded-xl space-y-4 text-[11px]">
                      <div className="space-y-2">
                        <strong className="text-slate-800 font-bold block text-[10px] uppercase tracking-wider text-indigo-750">Method A: Web Panel (No CLI needed)</strong>
                        <ol className="list-decimal pl-4.5 space-y-1 text-slate-650 font-semibold">
                          <li>Access <strong>"Setup Node.js App"</strong> inside cPanel app.</li>
                          <li>Click the <strong>Edit Action Gear/pencil</strong> next to your active clinic application.</li>
                          <li>Find and click the <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 border border-emerald-250 rounded">"Run NPM Install"</strong> button on settings page.</li>
                          <li>Under the JS Scripts run selector, select <strong className="italic font-bold">build</strong> and click the run button.</li>
                          <li>Hit <strong>"Restart"</strong> at the top of Setup page!</li>
                        </ol>
                      </div>

                      <div className="space-y-2 pt-3 border-t font-semibold">
                        <strong className="text-slate-800 font-bold block text-[10px] uppercase tracking-wider text-indigo-750">Method B: SSH / Terminal commands line</strong>
                        <ol className="list-decimal pl-4.5 space-y-1.5 text-slate-650 font-semibold">
                          <li>Copy the <strong>venv activation command link</strong> at the top of your Node settings page (starts with <code>source /home/...</code>).</li>
                          <li>Open terminal inside cPanel or login through SSH.</li>
                          <li>Run that activation command, then execute standard script lines:
                            <pre className="bg-slate-900 text-slate-100 p-2 rounded font-mono text-[9.5px] mt-1 overflow-x-auto">cd public_html/sfclinic{"\n"}npm install{"\n"}npm run build</pre>
                          </li>
                          <li>Go back to cPanel Setup Page and tap <strong>"Restart"</strong>.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-indigo-900 text-indigo-150 rounded-xl p-4.5 border border-indigo-950 space-y-3 shadow-inner">
                <span className="flex items-center gap-1 font-extrabold text-white uppercase tracking-widest text-[9.5px]">
                  <Terminal className="h-4 w-4 text-sky-400" /> Bundle deployment tip
                </span>
                <p className="text-[10.5px] leading-relaxed opacity-90 font-semibold">
                  Once compilation finishes locally, you don't need upload anything except <code className="text-teal-300">dist</code>, <code className="text-teal-300">server</code> and configuration scripts files to keep root folders lean!
                </p>
              </div>

            </div>

          </div>
        </div>
      )}

      {activeTab === 'permissions' && isMasterAdmin && (
        <div className="space-y-6 animate-fade-in text-[11px]">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-white rounded-xl p-5 shadow-sm border border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="bg-amber-500/30 text-amber-100 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-amber-500/20">Shield Authorized Override</span>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">System Position Page Access & Account Access Designation</h2>
              <p className="text-amber-100/90 text-[10px] leading-relaxed max-w-xl">
                Tweak and customize access privileges directly on a per-Position/Role basis. Changes instantly regulate workspace privileges for all active staff of the selected System Position.
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl border border-white/15 flex items-center gap-2 max-w-xs shrink-0 backdrop-blur-xs">
              <Lock className="h-5 w-5 text-amber-200 shrink-0" />
              <div className="text-[9px] leading-tight text-white/95">
                <span className="font-extrabold text-white block">Secured Session</span>
                Master Admin permission modifier holds immediate execution status.
              </div>
            </div>
          </div>

          {/* Master layout grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Position List Panel (4/12 width or stack) */}
            <div className="md:col-span-4 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px] sm:h-[500px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    Account System Positions ({ACCOUNT_POSITIONS.length})
                  </h3>
                </div>
                {/* Visual context info */}
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Select a role/position below to custom design authorized access pages across the whole portal.
                </p>
              </div>

              {/* Positions scroll container */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80 p-1.5 space-y-1">
                {ACCOUNT_POSITIONS.map(pos => {
                  const isSelected = selectedPosition === pos.key;
                  const hasCustomPerms = settings?.userPagePermissions?.[pos.key];
                  return (
                    <button
                      key={pos.key}
                      onClick={() => handleSelectPosition(pos.key)}
                      className={`w-full text-left p-2.5 rounded-lg transition duration-150 flex items-center justify-between cursor-pointer select-none border ${
                        isSelected 
                          ? 'bg-amber-500/10 border-amber-500/25 shadow-xs font-bold' 
                          : 'bg-white hover:bg-slate-50/55 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center bg-slate-100 shrink-0 overflow-hidden font-extrabold text-slate-700 font-mono text-[10px]">
                          {pos.key.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 leading-tight">
                          <span className={`font-extrabold block text-[11px] sm:text-[11.5px] truncate ${isSelected ? 'text-amber-805' : 'text-slate-700'}`}>
                            {pos.label}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium block truncate">
                            {pos.desc}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="bg-slate-100 text-slate-600 font-extrabold text-[8px] px-1 rounded uppercase tracking-wider">
                              {pos.key}
                            </span>
                            {hasCustomPerms && (
                              <span className="bg-emerald-50 text-emerald-600 font-extrabold text-[8px] px-1 rounded uppercase tracking-wider flex items-center gap-0.5 font-mono">
                                <ShieldCheck className="h-2 w-2" /> Custom Access
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-amber-600 translate-x-0.5' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permissions Checkbox Grid (8/12 width or stack) */}
            <div className="md:col-span-8 bg-white rounded-xl border border-slate-105 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              {selectedPosition ? (
                <>
                  {/* Selected Position Details Bar */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight flex items-center gap-1.5">
                        <User className="h-4 w-4 text-amber-600" />
                        Access Matrix for {ACCOUNT_POSITIONS.find(p => p.key === selectedPosition)?.label} ({selectedPosition})
                      </h3>
                      <p className="text-slate-400 text-[10.5px] mt-0.5">
                        Select screens and performable actions authorized for this position
                      </p>
                    </div>

                    {/* Quick helper buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllPages}
                        className="py-1 px-2 text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-707 rounded transition cursor-pointer"
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllPages}
                        className="py-1 px-2 text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-707 rounded transition cursor-pointer"
                      >
                        Revoke All
                      </button>
                      <button
                        type="button"
                        onClick={invertPageSelection}
                        className="py-1 px-2 text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-707 rounded transition cursor-pointer"
                      >
                        Invert Choice
                      </button>
                      <button
                        type="button"
                        onClick={resetToRoleDefaults}
                        className="py-1 px-2 text-[9px] font-bold bg-slate-100 hover:bg-slate-202 text-slate-707 rounded transition cursor-pointer"
                      >
                        Role Default
                      </button>
                    </div>
                  </div>

                  {/* Search and Clone Bar */}
                  <div className="p-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-3 justify-between">
                    <div className="relative w-full sm:max-w-xs">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                        <Search className="h-3.5 w-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search pages and actions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-[10.5px] border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500/35 focus:border-amber-500"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 font-extrabold text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <span className="text-[9.5px] text-slate-400 font-medium whitespace-nowrap">Clone From:</span>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const customPerms = settings?.userPagePermissions?.[val];
                            if (customPerms) {
                              setSelectedPages(customPerms);
                            } else {
                              setSelectedPages(DEFAULT_ROLE_PAGES[val] || []);
                            }
                            e.target.value = '';
                          }
                        }}
                        className="py-1 px-1.5 text-[9.5px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg cursor-pointer max-w-[140px] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        defaultValue=""
                      >
                        <option value="" disabled>Select Role...</option>
                        {ACCOUNT_POSITIONS.filter(p => p.key !== selectedPosition).map(p => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes list */}
                  <div className="flex-1 overflow-y-auto p-4 max-h-[440px] space-y-6">
                    {/* Section 1: Page Screens */}
                    {PAGE_OPTIONS.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1.5">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Page / App Screen Authorizations
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                          {PAGE_OPTIONS.filter(o => 
                            o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            o.desc.toLowerCase().includes(searchTerm.toLowerCase())
                          ).map((opt) => {
                            const isChecked = selectedPages.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={`p-2.5 rounded-lg border transition-all duration-150 cursor-pointer flex items-start gap-2.5 relative select-none hover:shadow-2xs ${
                                  isChecked 
                                    ? 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/35 shadow-3xs' 
                                    : 'bg-white hover:bg-slate-50 border-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePage(opt.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 shrink-0 mt-0.5 cursor-pointer"
                                />
                                <div className="leading-tight min-w-0">
                                  <span className={`font-bold block text-[10.5px] sm:text-[11px] ${isChecked ? 'text-amber-900 font-extrabold' : 'text-slate-700'}`}>
                                    {opt.label}
                                  </span>
                                  <span className="text-[9px] text-slate-450 mt-0.5 font-medium block leading-normal">
                                    {opt.desc}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 2: Action Options */}
                    {ACTION_OPTIONS.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1.5">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Performable Clinical & Administrative Actions
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                          {ACTION_OPTIONS.filter(o => 
                            o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            o.desc.toLowerCase().includes(searchTerm.toLowerCase())
                          ).map((opt) => {
                            const isChecked = selectedPages.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={`p-2.5 rounded-lg border transition-all duration-150 cursor-pointer flex items-start gap-2.5 relative select-none hover:shadow-2xs ${
                                  isChecked 
                                    ? 'bg-blue-500/[0.03] border-blue-500/20 hover:border-blue-500/35 shadow-3xs' 
                                    : 'bg-white hover:bg-slate-50 border-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePage(opt.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 shrink-0 mt-0.5 cursor-pointer"
                                />
                                <div className="leading-tight min-w-0">
                                  <span className={`font-bold block text-[10.5px] sm:text-[11px] ${isChecked ? 'text-blue-900 font-extrabold' : 'text-slate-700'}`}>
                                    {opt.label}
                                  </span>
                                  <span className="text-[9px] text-slate-450 mt-0.5 font-medium block leading-normal">
                                    {opt.desc}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Permissions Actions Footer */}
                  <div className="p-4 border-t border-slate-105 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2.5">
                    <div className="text-[10px] text-slate-400 font-medium">
                      Selected <strong className="text-amber-750 font-extrabold">{selectedPages.length}</strong> of {PAGE_OPTIONS.length + ACTION_OPTIONS.length} specifications
                    </div>
                    
                    <button
                      onClick={handleSavePermissions}
                      disabled={updatingPermissions}
                      className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-extrabold px-5 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md transition text-[10px] uppercase tracking-wider"
                    >
                      {updatingPermissions ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Updating...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" /> Save custom permissions
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 flex-1 text-center h-full text-slate-450 space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-dashed text-slate-300">
                    <User className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="max-w-xs space-y-1">
                    <span className="font-extrabold text-slate-800 text-xs block">No position selected</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                      Select an Account System Position on the left panel to begin allocating customized page authorization matrices!
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="space-y-6 animate-fade-in text-[11px]">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-rose-600 to-rose-800 text-white rounded-xl p-6 shadow-sm border border-rose-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-rose-500/30 text-rose-100 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">System Export & Migration Center</span>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isOnline ? 'bg-emerald-500/30 text-emerald-100 border-emerald-500/20' : 'bg-rose-900/40 text-rose-200 border-rose-900/30'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-455'}`}></span>
                  {isOnline ? 'Online • synced to DB' : 'Offline'}
                </span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight font-sans">Convert & Migrate Application Databases</h2>
              <p className="text-rose-100/90 text-xs leading-relaxed max-w-2xl">
                Generate complete structural SQL migration DDL/DML tables and full nested JSON schema representations of the local database. 
                All export records compile live at transaction instance to prevent any data loss during migration.
              </p>
            </div>
            
            <button
              onClick={handleTriggerExport}
              disabled={exportLoading}
              className="bg-white text-rose-800 hover:bg-rose-50 disabled:opacity-55 active:bg-rose-100 font-extrabold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition text-[11px] uppercase tracking-wider shrink-0"
            >
              {exportLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Compiling live snapshot...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 text-rose-655" /> Synthesize Fresh Export
                </>
              )}
            </button>
          </div>

          {/* Export Mode / Optimization Settings */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="font-extrabold text-slate-700 block">Performance Optimization Toggle</span>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                By default, this is unchecked to guarantee a 100% complete, uncensored backup of all clinical photos and file attachments. Check this box if you want a lightweight database script without large binary assets.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border rounded-lg select-none hover:bg-slate-105 transition shrink-0">
              <input
                type="checkbox"
                checked={excludeBinaries}
                onChange={(e) => setExcludeBinaries(e.target.checked)}
                className="h-4 w-4 text-rose-600 rounded focus:ring-rose-500 border-slate-300 cursor-pointer"
              />
              <span className="font-extrabold text-slate-705">Exclude Large Files (Speed Optimization)</span>
            </label>
          </div>

          {!exportedData ? (
            <div className="bg-white rounded-2xl border p-12 text-center text-slate-400 space-y-4 max-w-2xl mx-auto flex flex-col items-center shadow-xs">
              <div className="h-16 w-16 rounded-3xl bg-rose-50 border border-dashed border-rose-200 flex items-center justify-center text-rose-500">
                <Database className="h-8 w-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <span className="font-extrabold text-slate-800 text-sm block">Database Export is Ready for Compilation</span>
                <p className="text-xs text-slate-400 leading-relaxed max-w-md font-semibold">
                  Click the "Synthesize Fresh Export" button above to pull the latest entries from the live MySQL/JSON files and convert them into standard compliant SQL DDL and JSON relational tables.
                </p>
              </div>
              <button
                onClick={handleTriggerExport}
                disabled={exportLoading}
                className="py-2.5 px-6 bg-slate-900 hover:bg-slate-805 text-white font-extrabold rounded-xl transition duration-150 cursor-pointer text-[10px] uppercase tracking-wider shadow-sm"
              >
                Trigger live migration build
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Card 1: SQL Format */}
              <div className="bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-sm space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-extrabold font-mono text-[11px] border border-blue-105">
                        .SQL
                      </div>
                      <div className="leading-tight">
                        <strong className="text-slate-800 text-xs uppercase font-extrabold block">MySQL DDL/DML Migration Script</strong>
                        <span className="text-[10px] text-slate-400 font-semibold block">Fully formatted with Drop/Creates, Indexes, and INSERT rows</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold uppercase border border-blue-100">
                      phpMyAdmin Ready
                    </span>
                  </div>

                  <p className="text-slate-505 leading-normal text-[10.5px]">
                    Perfect for deploying directly into production hosting providers (like cPanel, VPS, or AWS MySQL RDS). It handles table generation structures, unique indexing constraints, and populates 16 operational tables with all the application's actual data.
                  </p>

                  <div className="bg-slate-900 text-slate-350 font-mono text-[9px] p-3 rounded-xl h-44 overflow-y-auto leading-relaxed border border-slate-950/40 relative">
                    <div className="absolute top-2 right-2 bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-sans font-bold tracking-wider">SQL PREVIEW</div>
                    <pre>{exportedData.sql.slice(0, 3000) + (exportedData.sql.length > 3000 ? '\n\n-- ... [Content Truncated for Preview. Full file is compiled and ready for download] ...' : '')}</pre>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={downloadSQLDump}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md transition text-[10px] uppercase tracking-wider text-center"
                  >
                    <Download className="h-4 w-4" /> Download MySQL Migration SQL
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exportedData.sql);
                      setAlertModal({
                        isOpen: true,
                        title: 'SQL Copied!',
                        description: 'The entire compiled SQL insert script has been copied to your clipboard.',
                        type: 'success'
                      });
                    }}
                    className="bg-slate-100 hover:bg-slate-205 border text-slate-850 font-extrabold py-3 px-4 rounded-xl cursor-pointer transition text-[10px] uppercase tracking-wider flex items-center justify-center"
                    title="Copy Code"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Card 2: JSON Format */}
              <div className="bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-sm space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-extrabold font-mono text-[11px] border border-indigo-105">
                        .JSON
                      </div>
                      <div className="leading-tight">
                        <strong className="text-slate-800 text-xs uppercase font-extrabold block">Single-File JSON Schema Dump</strong>
                        <span className="text-[10px] text-slate-400 font-semibold block">Complete state representation object of SaintFrancisDB</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-bold uppercase border border-indigo-100">
                      Standard Backups
                    </span>
                  </div>

                  <p className="text-slate-505 leading-normal text-[10.5px]">
                    Recommended for local application backups, restoration, and API diagnostics. It exports the complete internal object state, ensuring that configurations, users, medical books, and timecards can be parsed or restored under any JSON-compatible framework instantly.
                  </p>

                  <div className="bg-slate-900 text-slate-350 font-mono text-[9px] p-3 rounded-xl h-44 overflow-y-auto leading-relaxed border border-slate-950/40 relative">
                    <div className="absolute top-2 right-2 bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-sans font-bold tracking-wider">JSON PREVIEW</div>
                    <pre>{exportedData.json.slice(0, 3000) + (exportedData.json.length > 3000 ? '\n\n... [Content Truncated for Preview. Full file is compiled and ready for download] ...' : '')}</pre>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={downloadJSONDump}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md transition text-[10px] uppercase tracking-wider text-center"
                  >
                    <Download className="h-4 w-4" /> Download State JSON Dump
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exportedData.json);
                      setAlertModal({
                        isOpen: true,
                        title: 'JSON Copied!',
                        description: 'The entire serialized JSON database state object has been copied to your clipboard.',
                        type: 'success'
                      });
                    }}
                    className="bg-slate-100 hover:bg-slate-205 border text-slate-850 font-extrabold py-3 px-4 rounded-xl cursor-pointer transition text-[10px] uppercase tracking-wider flex items-center justify-center"
                    title="Copy Code"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HIGH PERFORMANCE / LARGE FILES DOWNLOAD CENTER */}
          <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-6 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-800">
                <div className="bg-rose-100 text-rose-700 h-7 w-7 rounded-lg flex items-center justify-center">
                  <Database className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider">Advanced Direct Server Backup (Recommended for Large Files)</h3>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                If your database holds massive camera files, payroll snapshots, or pcu attachments, downloading via standard browser memory fetch can cause browser crashes or 504 gateway timeouts. Use the direct streaming endpoints below to fetch backups directly from Node.js with native gzip compression. All data is preserved intact.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href={`/api/export-data/download?format=sql&exclude_binaries=${excludeBinaries}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-rose-300 transition duration-150 shadow-xs cursor-pointer group text-left"
              >
                <div>
                  <span className="font-extrabold text-slate-700 text-[10px] uppercase tracking-wide block">Direct MySQL Backup</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5 leading-relaxed">Streams entire set of MySQL drop/create commands and inserts.</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-600 font-extrabold text-[9px] uppercase mt-3.5 group-hover:translate-x-1 transition-transform">
                  <Download className="h-3 w-3" /> Download .SQL Stream
                </div>
              </a>

              <a
                href={`/api/export-data/download?format=json&exclude_binaries=${excludeBinaries}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-rose-300 transition duration-150 shadow-xs cursor-pointer group text-left"
              >
                <div>
                  <span className="font-extrabold text-slate-700 text-[10px] uppercase tracking-wide block">Direct JSON Backup</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5 leading-relaxed">Streams the raw state definition directly into a JSON file format.</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-600 font-extrabold text-[9px] uppercase mt-3.5 group-hover:translate-x-1 transition-transform">
                  <Download className="h-3 w-3" /> Download .JSON Stream
                </div>
              </a>

              <a
                href={`/api/export-data/download?format=sql&exclude_binaries=${excludeBinaries}&gzip=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl flex flex-col justify-between transition duration-150 shadow-xs cursor-pointer group text-left"
              >
                <div>
                  <span className="font-black text-rose-400 text-[10px] uppercase tracking-wide block">GZIP Compressed Backup (.gz)</span>
                  <span className="text-[9px] text-slate-300 block mt-0.5 leading-relaxed">Uses server-side zlib to squeeze massive 30MB dumps down to 2MB instantly.</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-300 font-extrabold text-[9px] uppercase mt-3.5 group-hover:translate-x-1 transition-transform">
                  <Download className="h-3 w-3 animate-bounce" /> Stream Compressed .SQL.GZ
                </div>
              </a>
            </div>
          </div>

          {/* DISCOVERED WORKSPACE BACKUPS & RESTORE CENTER */}
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-rose-700">
                  <Database className="h-4.5 w-4.5 text-rose-600" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Database Restoration Uplink</h3>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Upload a previously exported JSON database snapshot file to migrate or restore your records safely
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="bg-slate-950 hover:bg-slate-850 text-white font-extrabold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition text-[10px] uppercase tracking-wider select-none shrink-0">
                  <Upload className="h-3.5 w-3.5" /> Upload JSON file
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRawJSONUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {restoreStats && (
              <div className="bg-emerald-50/50 border border-emerald-250 p-5 rounded-2xl animate-fade-in space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-600 animate-pulse" />
                    <strong className="text-xs uppercase tracking-tight font-extrabold">System Restored Successfully!</strong>
                  </div>
                  <button
                    onClick={() => setRestoreStats(null)}
                    className="text-emerald-700 hover:text-emerald-950 text-[10px] tracking-wider uppercase font-bold cursor-pointer"
                  >
                    Clear stats
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center">
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Users</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.users}</strong>
                  </div>
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Barangays</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.barangays}</strong>
                  </div>
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Puroks</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.puroks}</strong>
                  </div>
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Households</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.households}</strong>
                  </div>
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Members</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.householdMembers}</strong>
                  </div>
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Dependents</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.dependents}</strong>
                  </div>
                  <div className="bg-white border rounded-xl p-2 shadow-xs">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider text-ellipsis overflow-hidden">Health Recs</span>
                    <strong className="text-sm font-mono font-extrabold text-slate-805">{restoreStats.healthRecords}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Interactive File Upload Dragzone Area */}
            <div className="border-2 border-dashed border-slate-200 hover:border-rose-450 rounded-2xl p-8 text-center bg-slate-50/40 hover:bg-slate-50/80 transition-all cursor-pointer relative group">
              <input
                type="file"
                accept=".json"
                onChange={handleRawJSONUpload}
                disabled={exportLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 transition-transform group-hover:scale-110">
                  {exportLoading ? (
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <span className="font-extrabold text-slate-700 text-xs block">
                    {exportLoading ? (uploadProgress || 'Processing database migrations...') : 'Drag and drop your exported JSON database file here'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Or click anywhere on this card to select a .json database. Only compatible backup files are supported.
                  </p>
                </div>
              </div>
            </div>

            {/* Server-Side Discovery Backup Files */}
            {backups && backups.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-800">
                  <Database className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <h4 className="text-xs font-black uppercase tracking-wider">Discovered Server Backup Files</h4>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  These compatible database backup files were detected directly inside the server workspace directory. Tapping "Restore" triggers instantaneous restoration.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {backups.map((bk) => (
                    <div key={bk.fileName} className="bg-slate-50/70 border border-slate-200/85 hover:border-rose-400 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between transition gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                          <Database className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 leading-normal">
                          <span className="font-extrabold text-slate-700 text-xs truncate block" title={bk.fileName}>
                            {bk.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                            {bk.stats ? `${(bk.stats.sizeBytes / (1024 * 1024)).toFixed(2)} MB • Modified ${new Date(bk.stats.mtime).toLocaleString()}` : 'Located on server'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreFromFile(bk.fileName)}
                        disabled={exportLoading}
                        className="py-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] uppercase font-extrabold tracking-wider rounded-lg border-0 cursor-pointer disabled:opacity-50 transition shrink-0 self-start sm:self-center"
                      >
                        {exportLoading ? 'Restoring...' : 'Restore Server File'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-rose-955 leading-relaxed text-[11px] font-medium">
            <strong className="text-rose-900 block mb-1 text-xs uppercase font-extrabold">🚨 Safety Migration Notice:</strong>
            <p>
              Please safeguard your exported databases. The `.sql` files contain sensitive plain-text configurations, user profiles, credentials, and medical books. Ensure any database system import has foreign key checks temporarily disabled (<code className="bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">SET FOREIGN_KEY_CHECKS = 0;</code>) before running to prevent relational constraint mismatches during mapping transitions.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'cache' && (
        <div className="space-y-6 animate-fade-in text-[11px]">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-emerald-600 to-green-800 text-white rounded-xl p-6 shadow-sm border border-emerald-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <span className="bg-emerald-500/30 text-emerald-100 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">System Performance & Updates Clearing Center</span>
              <h2 className="text-xl font-bold font-sans tracking-tight leading-none uppercase pt-1">Clear Browser Cache & Live Updates</h2>
              <p className="text-emerald-100/80 leading-relaxed font-medium">
                Browsers deployed on cPanel environments cache JavaScript packages, assets, and templates aggressively. If you perform an update but see empty screens, outdated validation rules, or execution mismatches, use this dashboard to purge the internal browser local storage buffers safely.
              </p>
            </div>
            <button
              onClick={handleClearStandardCache}
              className="py-3 px-6 bg-white text-emerald-800 hover:bg-emerald-50 hover:shadow-lg transition font-extrabold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer self-start md:self-center shrink-0 border border-emerald-200"
            >
              <RefreshCw className="h-4 w-4 text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} /> Fast Force Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action Cards Panel */}
            <div className="space-y-6">
                          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <div className="border-b pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <RefreshCw className="h-4 w-4 text-emerald-600 animate-none" /> Complete CacheStorage & Service Workers Purge
                    </h3>
                    <p className="text-slate-400 text-[10px] mt-0.5">Safely removes registered scripts, service workers, and static files</p>
                  </div>
                </div>

                <div className="space-y-3.5 leading-relaxed text-slate-505">
                  <p>
                    This is the **absolute most effective way** to enforce freshly compiled update assets. It wipes out all assets registered in your browser's <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800 text-[9.5px]">CacheStorage</code> API (which is where PWAs, offline layers, and cPanel bundles live) and removes any legacy Service Workers dynamically.
                  </p>
                  <p className="font-semibold text-amber-700 bg-amber-50 rounded-xl p-3 border border-amber-100/50 flex gap-2">
                    <Info className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                    <span><strong>Note:</strong> Executing this routine will clear temporary memory structures and automatically execute a full browser reload immediately to request the latest cPanel node scripts.</span>
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleClearStandardCache}
                    className="w-full py-3 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 hover:shadow-md transition cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border-0"
                  >
                    <RefreshCw className="h-4 w-4 text-white" /> Purge CacheStorage & Force Server Request
                  </button>
                </div>
              </div>
            </div>

            {/* Instruction Column */}
            <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-850 shadow-inner space-y-5 flex flex-col justify-between font-mono">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Terminal className="h-5 w-5 text-emerald-400" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-white select-none">Cache & deployment documentation</h4>
                </div>

                <div className="space-y-3 text-[10.5px] leading-relaxed text-slate-400">
                  <p className="font-bold text-white text-[11px] uppercase tracking-normal">
                    💡 How does browser caching work on cPanel?
                  </p>
                  <p>
                    cPanel web servers use built-in compression configurations (such as <code className="text-emerald-300">mod_deflate</code> or server-side cache headers) to optimize speeds. The browser stores bundled JavaScript (<code className="text-emerald-300">index.html</code> / compiled assets) so it doesn't need to download them on every single visit.
                  </p>
                  <p className="font-bold text-white text-[11px] uppercase tracking-normal mt-2">
                    💡 Why can this cause function errors?
                  </p>
                  <p>
                    When hotfixes or database schema updates (like the new PMRF Dependent fields structure) are deployed, the backend API gets updated first. However, if the browser keeps loading a cached, stale client script, it might send old payload schemas (such as sending a single concatenated <code className="text-emerald-300">fullName</code> column instead of the required new columns <code className="text-emerald-300">last_name</code>, <code className="text-emerald-300">first_name</code>, etc.). This mismatch causes database errors during inserts.
                  </p>
                  <p className="font-bold text-white text-[11px] uppercase tracking-normal mt-2">
                    💡 What is the exact function of the clearance routine?
                  </p>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>
                      <strong className="text-white">CacheStorage:</strong> Completely releases memory buffers, forcing browsers to re-request compile structures from scratch.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 mt-4 text-[9.5px] text-slate-500 leading-normal flex items-start gap-2">
                <Info className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="select-none">By executing a force clear, you guarantee that 100% of the active clinicians are speaking to the database in identical data structures with zero obsolete code artifacts trailing.</span>
              </div>
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
                  <CheckCircle className="h-8 w-8 animate-bounce" />
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
