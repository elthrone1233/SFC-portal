import fs from 'fs';
import path from 'path';
import { 
  User, Barangay, Purok, Household, HouseholdMember, Dependent, 
  Group, PaidPayroll, HealthRecord, ActivityLog, SiteSettings, Notification, Timecard 
} from '../src/types';
import { getMySQLPool, shouldAttemptMySQL, markMySQLSuccess, markMySQLFailure } from './mysql-connector';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Ensure data folder exists
const ensureDataFolder = () => {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

interface DBState {
  users: User[];
  barangays: Barangay[];
  puroks: Purok[];
  households: Household[];
  householdMembers: HouseholdMember[];
  dependents: Dependent[];
  groups: Group[];
  paidPayrolls: PaidPayroll[];
  healthRecords: HealthRecord[];
  activityLogs: ActivityLog[];
  settings: SiteSettings;
  notifications: Notification[];
  timecards: Timecard[];
  itSettledPayrolls: any[];
  pcuFiles?: any[];
  drafts?: any[];
}

const defaultSettings: SiteSettings = {
  faviconLogo: 'https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png',
  faviconTitle: 'Saint Francis Portal',
  websiteTitle: 'Saint Francis Portal',
  websiteLogo: 'https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png',
  seoTitle: 'Saint Francis Portal',
  seoDescription: 'Health and Household Management System.',
  seoKeywords: 'health, clinic, management, Pagadian, barangay, geotagging, HR, payroll',
  squadDeleteAction: 'ARCHIVE',
  basePcuRate: 20
};

const getSeedData = (): DBState => {
  const now = new Date().toISOString();
  
  const seedUsers: User[] = [
    {
      id: 'usr_admin',
      fullName: 'System Admin',
      email: 'elthrone1233@gmail.com',
      password: 'rakionista021994',
      position: 'ADMIN',
      address: 'San Francisco',
      groupAssigned: null,
      status: 'Approved',
      createdAt: now
    },
    {
      id: 'usr_admin2',
      fullName: 'Saint Francis Admin',
      email: 'saintfrancisclinic2026@gmail.com',
      password: 'rakionista021994',
      position: 'ADMIN',
      address: 'San Francisco',
      groupAssigned: null,
      status: 'Approved',
      createdAt: now
    }
  ];

  return {
    users: seedUsers,
    barangays: [],
    puroks: [],
    households: [],
    householdMembers: [],
    dependents: [],
    groups: [],
    paidPayrolls: [],
    healthRecords: [],
    activityLogs: [],
    settings: defaultSettings,
    notifications: [],
    timecards: [],
    itSettledPayrolls: [],
    pcuFiles: [],
    drafts: []
  };
};

export class SaintFrancisDB {
  private static state: DBState | null = null;
  private static hasLoadedFromMySQLSuccessfully = false;
  private static hasRunMigrations = false;
  private static lastSyncedSignatures = new Map<string, Map<string, string>>();
  private static lastLoadTime = 0;
  private static lastLocalLoadTime = 0;
  private static loadingPromise: Promise<DBState> | null = null;

  private static getRecordSignature(tableName: string, item: any): string {
    if (!item) return '';
    const id = item.id || '';
    const updatedAt = item.updatedAt || '';
    const createdAt = item.createdAt || '';
    const status = item.status || item.approvalStatus || item.pmrfStatus || item.yakapWillingStatus || '';
    
    let hshSign = '';
    if (tableName === 'households') {
      if (item.attachments) hshSign += `_att:${Array.isArray(item.attachments) ? item.attachments.length : JSON.stringify(item.attachments).length}`;
      if (item.pmrfDetails) hshSign += `_pmrf:${JSON.stringify(item.pmrfDetails).length}`;
      if (item.fpeDetails) hshSign += `_fpe:${JSON.stringify(item.fpeDetails).length}`;
      if (item.pcsfDetails) hshSign += `_pcsf:${JSON.stringify(item.pcsfDetails).length}`;
      hshSign += `_hhHead:${item.householdHead}_addr:${item.completeAddress}_num:${item.householdNumber}_tel:${item.contactNumber}_barg:${item.barangay}_purk:${item.purok}`;
    }
    if (tableName === 'timecards') {
      if (item.photo) hshSign += `_ph:${item.photo.length}`;
      hshSign += `_set:${item.settled ? 1 : 0}_sid:${item.settlementId || ''}`;
    }
    if (tableName === 'users') {
      if (item.password) hshSign += `_pw:${item.password}`;
      if (item.fullName) hshSign += `_name:${item.fullName}`;
      if (item.address) hshSign += `_addr:${item.address}`;
      if (item.profilePicture) hshSign += `_pic:${item.profilePicture.length}`;
      if (item.position) hshSign += `_pos:${item.position}`;
      if (item.groupAssigned) hshSign += `_grp:${item.groupAssigned}`;
      if (item.contactNumber) hshSign += `_con:${item.contactNumber}`;
      if (item.dailyRate !== undefined && item.dailyRate !== null) hshSign += `_rate:${item.dailyRate}`;
    }
    if (tableName === 'groups') {
      hshSign += `_name:${item.name}_ldr:${item.leader}_cols:${JSON.stringify(item.coLeaders || [])}_brgs:${JSON.stringify(item.assignedBarangays || [])}_rate:${item.ratePerPerson}`;
    }
    if (tableName === 'barangays') {
      hshSign += `_name:${item.name}_purk:${item.puroksCount}_yak:${item.yakapWillingCount}_hpb:${item.householdProgressBar}_mpb:${item.membersProgressBar}_ppb:${item.pmrfProgressBar}`;
    }
    if (tableName === 'puroks') {
      hshSign += `_name:${item.name}_brg:${item.barangay}_hh:${item.householdCount}_mem:${item.memberCount}_pmrf:${item.pmrfCount}_yak:${item.yakapWillingCount}`;
    }
    if (tableName === 'health_records') {
      hshSign += `_rec:${item.patientName}_dia:${item.diagnosis}_treat:${item.treatment}_meds:${item.medications}_notes:${item.notes?.length || 0}`;
    }
    if (tableName === 'notifications') {
      hshSign += `_read:${item.read ? 1 : 0}`;
    }
    if (tableName === 'dependents') {
      hshSign += `_name:${item.fullName}_gnd:${item.gender}_age:${item.age}_rel:${item.relationship}_bd:${item.birthDate || item.birthdate}_civ:${item.civilStatus}_ln:${item.lastName}_fn:${item.firstName}_mn:${item.middleName}_ext:${item.nameExt}_nomm:${item.noMiddleName ? 1 : 0}_mono:${item.mononym ? 1 : 0}_cz:${item.citizenship}_dis:${item.isDisabled ? 1 : 0}`;
    }
    return `${id}|${updatedAt}|${createdAt}|${status}|${hshSign}`;
  }

  private static populateAllSignatures(): void {
    if (!this.state) return;
    const tables: Array<{ key: keyof DBState; name: string }> = [
      { key: 'users', name: 'users' },
      { key: 'barangays', name: 'barangays' },
      { key: 'puroks', name: 'puroks' },
      { key: 'households', name: 'households' },
      { key: 'householdMembers', name: 'household_members' },
      { key: 'dependents', name: 'dependents' },
      { key: 'groups', name: 'groups' },
      { key: 'paidPayrolls', name: 'paid_payrolls' },
      { key: 'healthRecords', name: 'health_records' },
      { key: 'activityLogs', name: 'activity_logs' },
      { key: 'notifications', name: 'notifications' },
      { key: 'timecards', name: 'timecards' }
    ];

    for (const tbl of tables) {
      const items = (this.state[tbl.key] || []) as any[];
      const map = new Map<string, string>();
      for (const item of items) {
        map.set(item.id, this.getRecordSignature(tbl.name, item));
      }
      this.lastSyncedSignatures.set(tbl.name, map);
    }
  }

  private static checkAndImportExternalJson(): void {
    const sfcBackupPath = path.join(process.cwd(), 'sfc-backup.json');
    const sfcBackupPathUpper = path.join(process.cwd(), 'SFC-Backup.json');
    const targetBackupPath = fs.existsSync(sfcBackupPath) ? sfcBackupPath : (fs.existsSync(sfcBackupPathUpper) ? sfcBackupPathUpper : null);

    if (targetBackupPath) {
      console.log(`📦 Found user-provided backup ${path.basename(targetBackupPath)}! Proceeding to auto-import...`);
      this.importFromJsonFile(targetBackupPath)
        .then(result => {
          console.log(`✅ Successfully auto-imported user backup ${path.basename(targetBackupPath)}:`, result.stats);
        })
        .catch(err => {
          console.error(`❌ Failed auto-importing user backup ${path.basename(targetBackupPath)}:`, err);
        });
      return;
    }

    let externalPath = path.join(process.cwd(), 'sainajbo_saintfrancisclinic.json');
    let isSfc1 = false;
    let isImportedJson = false;

    if (!fs.existsSync(externalPath)) {
      externalPath = path.join(process.cwd(), 'sainajbo_sfc1.json');
      isSfc1 = true;
    }
    if (!fs.existsSync(externalPath)) {
      externalPath = path.join(process.cwd(), 'sainajbo_saintfrancisclinic_imported.json');
      isSfc1 = false;
      isImportedJson = true;
    }
    if (!fs.existsSync(externalPath)) {
      return;
    }

    try {
      console.log(`📦 Found external database backup at: ${path.basename(externalPath)}! Initiating auto-import...`);
      const rawData = fs.readFileSync(externalPath, 'utf8');
      if (!rawData || rawData.trim().length === 0) {
        console.warn(`⚠️ Backup file is empty. Skipping import.`);
        return;
      }
      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed)) {
        console.warn(`⚠️ Backup root is not an array. Skipping import.`);
        return;
      }

      let activityLogsRaw: any[] = [];
      let barangaysRaw: any[] = [];
      let dependentsRaw: any[] = [];
      let pmrfDependentsRaw: any[] = [];
      let groupsRaw: any[] = [];
      let healthRecordsRaw: any[] = [];
      let householdsRaw: any[] = [];
      let householdMembersRaw: any[] = [];
      let itSettledPayrollsRaw: any[] = [];
      let notificationsRaw: any[] = [];
      let paidPayrollsRaw: any[] = [];
      let puroksRaw: any[] = [];
      let siteSettingsRaw: any[] = [];
      let timecardsRaw: any[] = [];
      let usersRaw: any[] = [];
      let pcuFilesRaw: any[] = [];

      for (const entry of parsed) {
        if (entry && entry.type === 'table' && entry.name && Array.isArray(entry.data)) {
          switch (entry.name) {
            case 'activity_logs': activityLogsRaw = entry.data; break;
            case 'barangays': barangaysRaw = entry.data; break;
            case 'dependents': dependentsRaw = entry.data; break;
            case 'pmrf_dependents': pmrfDependentsRaw = entry.data; break;
            case 'groups': groupsRaw = entry.data; break;
            case 'health_records': healthRecordsRaw = entry.data; break;
            case 'households': householdsRaw = entry.data; break;
            case 'household_members': householdMembersRaw = entry.data; break;
            case 'it_settled_payrolls': itSettledPayrollsRaw = entry.data; break;
            case 'notifications': notificationsRaw = entry.data; break;
            case 'paid_payrolls': paidPayrollsRaw = entry.data; break;
            case 'puroks': puroksRaw = entry.data; break;
            case 'site_settings': siteSettingsRaw = entry.data; break;
            case 'timecards': timecardsRaw = entry.data; break;
            case 'users': usersRaw = entry.data; break;
            case 'pcu_files': pcuFilesRaw = entry.data; break;
          }
        }
      }

      console.log(`📊 Backup Parsed: ${usersRaw.length} users, ${householdsRaw.length} households, ${groupsRaw.length} groups, ${barangaysRaw.length} barangays, ${puroksRaw.length} puroks, ${pcuFilesRaw.length} PCU files.`);

      const users: User[] = usersRaw.map((u: any) => ({
        id: u.id,
        fullName: u.fullName || '',
        email: u.email || '',
        password: u.password || '',
        position: u.position || 'LEADER',
        address: u.address || '',
        groupAssigned: u.groupAssigned || null,
        status: u.status || 'Approved',
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || undefined,
        profilePicture: u.profilePicture || undefined,
        contactNumber: u.contactNumber || undefined,
        dailyRate: u.dailyRate !== undefined && u.dailyRate !== null ? parseFloat(u.dailyRate) : undefined
      }));

      // Ensure that we seed default administrators if they are missing
      const adminEmails = ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'];
      for (const adminEmail of adminEmails) {
        const hasAdmin = users.some(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
        if (!hasAdmin) {
          const isPrimary = adminEmail === 'elthrone1233@gmail.com';
          const adminUser: User = {
            id: isPrimary ? 'usr_admin' : 'usr_admin2',
            fullName: isPrimary ? 'System Admin' : 'Saint Francis Admin',
            email: adminEmail,
            password: 'rakionista021994',
            position: 'ADMIN',
            address: 'San Francisco',
            groupAssigned: null,
            status: 'Approved',
            createdAt: new Date().toISOString()
          };
          users.push(adminUser);
        }
      }

      const barangays: Barangay[] = barangaysRaw.map((b: any) => ({
        id: b.id,
        name: b.name || '',
        puroksCount: parseInt(b.puroksCount) || 0,
        yakapWillingCount: parseInt(b.yakapWillingCount) || 0,
        householdProgressBar: parseInt(b.householdProgressBar) || 0,
        membersProgressBar: parseInt(b.membersProgressBar) || 0,
        pmrfProgressBar: parseInt(b.pmrfProgressBar) || 0
      }));

      const puroks: Purok[] = puroksRaw.map((p: any) => ({
        id: p.id,
        name: p.name || '',
        barangay: p.barangay || '',
        barangay_id: p.barangay_id || null,
        householdCount: parseInt(p.householdCount) || 0,
        memberCount: parseInt(p.memberCount) || 0,
        pmrfCount: parseInt(p.pmrfCount) || 0,
        yakapWillingCount: parseInt(p.yakapWillingCount) || 0
      }));

      const households: Household[] = householdsRaw.map((h: any) => {
        let attachmentsArr: string[] = [];
        if (h.attachments) {
          try {
            attachmentsArr = typeof h.attachments === 'string' ? JSON.parse(h.attachments) : h.attachments;
          } catch (e) {
            attachmentsArr = [];
          }
        }

        let pmrfDetailsObj: any = undefined;
        if (h.pmrfDetails) {
          try {
            pmrfDetailsObj = typeof h.pmrfDetails === 'string' ? JSON.parse(h.pmrfDetails) : h.pmrfDetails;
          } catch (e) {}
        }

        let fpeDetailsObj: any = undefined;
        if (h.fpeDetails) {
          try {
            fpeDetailsObj = typeof h.fpeDetails === 'string' ? JSON.parse(h.fpeDetails) : h.fpeDetails;
          } catch (e) {}
        }

        let pcsfDetailsObj: any = undefined;
        if (h.pcsfDetails) {
          try {
            pcsfDetailsObj = typeof h.pcsfDetails === 'string' ? JSON.parse(h.pcsfDetails) : h.pcsfDetails;
          } catch (e) {}
        }

        return {
          id: h.id,
          householdNumber: h.householdNumber,
          householdHead: h.householdHead,
          contactNumber: h.contactNumber || '',
          completeAddress: h.completeAddress || '',
          barangay: h.barangay,
          purok: h.purok,
          latitude: h.latitude ? parseFloat(h.latitude) : undefined,
          longitude: h.longitude ? parseFloat(h.longitude) : undefined,
          pmrfStatus: h.pmrfStatus || 'Pending',
          yakapWillingStatus: h.yakapWillingStatus || 'Pending',
          approvalStatus: h.approvalStatus || 'Pending',
          attachments: Array.isArray(attachmentsArr) ? attachmentsArr : [],
          remarks: h.remarks || undefined,
          pmrfDetails: pmrfDetailsObj,
          fpeDetails: fpeDetailsObj,
          pcsfDetails: pcsfDetailsObj,
          createdBy: h.createdBy,
          updatedBy: h.updatedBy || undefined,
          createdAt: h.createdAt || new Date().toISOString(),
          updatedAt: h.updatedAt || undefined,
          deletedBy: h.deletedBy || undefined,
          deletedAt: h.deletedAt || undefined
        };
      });

      const householdMembers: HouseholdMember[] = householdMembersRaw.map((m: any) => ({
        id: m.id,
        householdId: m.householdId,
        firstName: m.firstName || '',
        middleName: m.middleName || '',
        lastName: m.lastName || '',
        gender: m.gender || 'Male',
        birthdate: m.birthdate || '',
        age: parseInt(m.age) || 0,
        civilStatus: m.civilStatus || 'Single',
        occupation: m.occupation || '',
        relationship: m.relationship || 'Head'
      }));

      // Combine dependents and pmrf_dependents by unique ID
      const depMap = new Map<string, any>();
      dependentsRaw.forEach((d: any) => { if (d && d.id) depMap.set(d.id, d); });
      pmrfDependentsRaw.forEach((d: any) => {
        if (d && d.id) {
          const existing = depMap.get(d.id);
          depMap.set(d.id, { ...existing, ...d });
        }
      });
      const combinedDepsRaw = Array.from(depMap.values());

      const dependents: Dependent[] = combinedDepsRaw.map((d: any) => {
        const ln = d.last_name !== undefined ? d.last_name : d.lastName;
        const fn = d.first_name !== undefined ? d.first_name : d.firstName;
        const mn = d.middle_name !== undefined ? d.middle_name : d.middleName;
        const ext = d.name_ext !== undefined ? d.name_ext : d.nameExt;
        const dob = d.date_of_birth !== undefined ? d.date_of_birth : (d.birthDate || d.birthdate);
        const noMnVal = d.no_mn !== undefined ? d.no_mn : d.noMiddleName;

        const computedFullName = d.fullName || `${ln || ''}, ${fn || ''}${ext ? ' ' + ext : ''}`.trim().toUpperCase();

        return {
          id: d.id,
          householdId: d.householdId,
          fullName: computedFullName,
          gender: d.gender || d.sex || 'Female',
          age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
          relationship: d.relationship || 'Child',
          birthDate: dob || '',
          birthdate: dob || '',
          civilStatus: d.civilStatus || 'Single',
          lastName: ln || '',
          firstName: fn || '',
          middleName: mn || '',
          nameExt: ext || '',
          noMiddleName: noMnVal === 1 || noMnVal === true,
          mononym: d.mononym === 1 || d.mononym === true,
          citizenship: d.citizenship || 'FILIPINO',
          isDisabled: d.isDisabled === 1 || d.isDisabled === true,
          pmrfSubmissionId: d.pmrfSubmissionId || null,
          pmrfRecordId: d.pmrfRecordId || null,
          memberPin: d.memberPin || null,
          submittedByAccountId: d.submittedByAccountId || null,
          createdAt: d.createdAt || null,
          sex: d.sex || d.gender || 'Female',
          pswd: d.pswd === 1 || d.pswd === true,
          last_name: ln || '',
          first_name: fn || '',
          middle_name: mn || '',
          name_ext: ext || '',
          date_of_birth: dob || '',
          no_mn: noMnVal === 1 || noMnVal === true ? 1 : 0
        };
      });

      const groups: Group[] = groupsRaw.map((g: any) => {
        let coLeadersArr: string[] = [];
        if (g.coLeaders) {
          try {
            coLeadersArr = typeof g.coLeaders === 'string' ? JSON.parse(g.coLeaders) : g.coLeaders;
          } catch (e) {}
        }

        let barArr: string[] = [];
        if (g.assignedBarangays) {
          try {
            barArr = typeof g.assignedBarangays === 'string' ? JSON.parse(g.assignedBarangays) : g.assignedBarangays;
          } catch (e) {}
        }

        return {
          id: g.id,
          name: g.name || '',
          leader: g.leader || '',
          coLeaders: Array.isArray(coLeadersArr) ? coLeadersArr : [],
          assignedBarangays: Array.isArray(barArr) ? barArr : [],
          ratePerPerson: parseFloat(g.ratePerPerson) || 0,
          isArchived: g.isArchived === '1' || g.isArchived === 1 || g.isArchived === true,
          createdAt: g.createdAt || new Date().toISOString(),
          status: g.status || undefined
        };
      });

      const paidPayrolls: PaidPayroll[] = paidPayrollsRaw.map((p: any) => ({
        id: p.id,
        groupName: p.groupName || '',
        dateRange: p.dateRange || '',
        populationCount: parseInt(p.populationCount) || 0,
        ratePerPerson: parseFloat(p.ratePerPerson) || 0,
        totalAmountPaid: parseFloat(p.totalAmountPaid) || 0,
        paidDate: p.paidDate || '',
        settledBy: p.settledBy || '',
        remarks: p.remarks || undefined
      }));

      const healthRecords: HealthRecord[] = healthRecordsRaw.map((h: any) => ({
        id: h.id,
        patientName: h.patientName || '',
        householdId: h.householdId || '',
        householdHead: h.householdHead || '',
        barangay: h.barangay || '',
        diagnosis: h.diagnosis || '',
        treatment: h.treatment || '',
        medications: h.medications || '',
        notes: h.notes || '',
        date: h.date || '',
        bloodPressure: h.bloodPressure || undefined,
        heartRate: h.heartRate || undefined,
        respRate: h.respRate || undefined,
        temperature: h.temperature || undefined,
        weightKg: h.weightKg || undefined,
        heightCm: h.heightCm || undefined,
        bmi: h.bmi || undefined
      }));

      const activityLogs: ActivityLog[] = activityLogsRaw.map((l: any) => ({
        id: l.id,
        user: l.user || '',
        action: l.action || '',
        module: l.module || '',
        date: l.date || '',
        time: l.time || ''
      }));

      const notifications: Notification[] = notificationsRaw.map((n: any) => ({
        id: n.id,
        title: n.title || '',
        message: n.message || '',
        type: (n.type || 'INFO') as any,
        read: n.is_read === '1' || n.is_read === 1 || n.is_read === true || n.read === true,
        createdAt: n.createdAt || new Date().toISOString()
      }));

      const timecards: Timecard[] = timecardsRaw.map((t: any) => ({
        id: t.id,
        userId: t.userId || '',
        userEmail: t.userEmail || '',
        userName: t.userName || '',
        type: t.type || 'IN',
        timestamp: t.timestamp || new Date().toISOString(),
        photo: t.photo || '',
        latitude: t.latitude ? parseFloat(t.latitude) : undefined,
        longitude: t.longitude ? parseFloat(t.longitude) : undefined,
        deviceInfo: t.deviceInfo || undefined,
        settled: t.settled === '1' || t.settled === 1 || t.settled === true,
        settlementId: t.settlementId || null,
        isOvertime: t.isOvertime === '1' || t.isOvertime === 1 || t.isOvertime === true,
        otHours: t.otHours !== null && t.otHours !== undefined ? parseFloat(t.otHours) : undefined
      }));

      const itSettledPayrolls: any[] = itSettledPayrollsRaw.map((itUrl: any) => {
        let bdownObj: any[] = [];
        if (itUrl.breakdown) {
          try {
            bdownObj = typeof itUrl.breakdown === 'string' ? JSON.parse(itUrl.breakdown) : itUrl.breakdown;
          } catch (e) {}
        }
        return {
          id: itUrl.id,
          userId: itUrl.userId || '',
          userEmail: itUrl.userEmail || '',
          userName: itUrl.userName || '',
          dailyRate: parseFloat(itUrl.dailyRate) || 440,
          dateRange: itUrl.dateRange || '',
          daysPresent: parseInt(itUrl.daysPresent) || 0,
          daysAbsent: parseInt(itUrl.daysAbsent) || 0,
          totalLateMinutes: parseInt(itUrl.totalLateMinutes) || 0,
          totalDeductions: parseFloat(itUrl.totalDeductions) || 0,
          totalEarned: parseFloat(itUrl.totalEarned) || 0,
          paidDate: itUrl.paidDate || '',
          settledBy: itUrl.settledBy || '',
          remarks: itUrl.remarks || '',
          breakdown: Array.isArray(bdownObj) ? bdownObj : []
        };
      });

      const pcuFiles: any[] = pcuFilesRaw.map((f: any) => ({
        id: f.id,
        fullName: f.fullName || '',
        birthday: f.birthday || '',
        fileName: f.fileName || '',
        fileData: f.fileData || '',
        uploadDate: f.uploadDate || '',
        uploadedBy: f.uploadedBy || ''
      }));

      let settings = defaultSettings;
      if (siteSettingsRaw.length > 0) {
        const s = siteSettingsRaw[0];
        let pms: any = undefined;
        if (s.userPagePermissions) {
          try {
            pms = typeof s.userPagePermissions === 'string' ? JSON.parse(s.userPagePermissions) : s.userPagePermissions;
          } catch (e) {}
        }
        settings = {
          faviconLogo: s.faviconLogo || defaultSettings.faviconLogo,
          faviconTitle: s.faviconTitle || defaultSettings.faviconTitle,
          websiteTitle: s.websiteTitle || defaultSettings.websiteTitle,
          websiteLogo: s.websiteLogo || defaultSettings.websiteLogo,
          seoTitle: s.seoTitle || defaultSettings.seoTitle,
          seoDescription: s.seoDescription || defaultSettings.seoDescription,
          seoKeywords: s.seoKeywords || defaultSettings.seoKeywords,
          squadDeleteAction: s.squadDeleteAction || defaultSettings.squadDeleteAction,
          userPagePermissions: pms
        };
      }

      // Store in memory state
      this.state = {
        users,
        settings,
        barangays,
        puroks,
        households,
        householdMembers,
        dependents,
        groups,
        paidPayrolls,
        healthRecords,
        activityLogs,
        notifications,
        timecards,
        itSettledPayrolls,
        pcuFiles
      };

      // Write parsed backup instantly to our active JSON db.json file
      ensureDataFolder();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf8');
      console.log(`✅ Successfully imported backup from ${path.basename(externalPath)} into active db.json.`);

      // Rename externalPath so it does not re-import next time
      let processedPathName = isSfc1 ? 'sainajbo_sfc1_imported.json' : 'sainajbo_saintfrancisclinic_imported.json';
      if (isImportedJson) {
        processedPathName = 'sainajbo_saintfrancisclinic_imported_processed.json';
      }
      const processedPath = path.join(process.cwd(), processedPathName);
      if (fs.existsSync(processedPath)) {
        try { fs.unlinkSync(processedPath); } catch (e) {}
      }
      if (externalPath !== processedPath) {
        fs.renameSync(externalPath, processedPath);
      }
      console.log(`🚀 Original file relocated to ${processedPathName}.`);
    } catch (importErr: any) {
      console.error(`❌ Failed auto-importing external json backup file:`, importErr);
    }
  }

  public static async importFromJsonFile(filePath: string): Promise<any> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`The file ${path.basename(filePath)} does not exist on the server.`);
    }

    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      if (!rawData || rawData.trim().length === 0) {
        throw new Error('The file content is empty.');
      }
      const parsed = JSON.parse(rawData);

      let activityLogsRaw: any[] = [];
      let barangaysRaw: any[] = [];
      let dependentsRaw: any[] = [];
      let pmrfDependentsRaw: any[] = [];
      let groupsRaw: any[] = [];
      let healthRecordsRaw: any[] = [];
      let householdsRaw: any[] = [];
      let householdMembersRaw: any[] = [];
      let itSettledPayrollsRaw: any[] = [];
      let notificationsRaw: any[] = [];
      let paidPayrollsRaw: any[] = [];
      let puroksRaw: any[] = [];
      let siteSettingsRaw: any[] = [];
      let timecardsRaw: any[] = [];
      let usersRaw: any[] = [];
      let pcuFilesRaw: any[] = [];

      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && entry.type === 'table' && entry.name && Array.isArray(entry.data)) {
            switch (entry.name) {
              case 'activity_logs': activityLogsRaw = entry.data; break;
              case 'barangays': barangaysRaw = entry.data; break;
              case 'dependents': dependentsRaw = entry.data; break;
              case 'pmrf_dependents': pmrfDependentsRaw = entry.data; break;
              case 'groups': groupsRaw = entry.data; break;
              case 'health_records': healthRecordsRaw = entry.data; break;
              case 'households': householdsRaw = entry.data; break;
              case 'household_members': householdMembersRaw = entry.data; break;
              case 'it_settled_payrolls': itSettledPayrollsRaw = entry.data; break;
              case 'notifications': notificationsRaw = entry.data; break;
              case 'paid_payrolls': paidPayrollsRaw = entry.data; break;
              case 'puroks': puroksRaw = entry.data; break;
              case 'site_settings': siteSettingsRaw = entry.data; break;
              case 'timecards': timecardsRaw = entry.data; break;
              case 'users': usersRaw = entry.data; break;
              case 'pcu_files': pcuFilesRaw = entry.data; break;
            }
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        activityLogsRaw = parsed.activityLogs || parsed.activity_logs || [];
        barangaysRaw = parsed.barangays || [];
        dependentsRaw = parsed.dependents || [];
        pmrfDependentsRaw = parsed.pmrfDependents || parsed.pmrf_dependents || [];
        groupsRaw = parsed.groups || [];
        healthRecordsRaw = parsed.healthRecords || parsed.health_records || [];
        householdsRaw = parsed.households || [];
        householdMembersRaw = parsed.householdMembers || parsed.household_members || [];
        itSettledPayrollsRaw = parsed.itSettledPayrolls || parsed.it_settled_payrolls || [];
        notificationsRaw = parsed.notifications || [];
        paidPayrollsRaw = parsed.paidPayrolls || parsed.paid_payrolls || [];
        puroksRaw = parsed.puroks || [];
        if (parsed.settings) siteSettingsRaw = [parsed.settings];
        else if (parsed.siteSettings) siteSettingsRaw = parsed.siteSettings;
        else if (parsed.site_settings) siteSettingsRaw = parsed.site_settings;
        timecardsRaw = parsed.timecards || [];
        usersRaw = parsed.users || [];
        pcuFilesRaw = parsed.pcuFiles || parsed.pcu_files || [];
      } else {
        throw new Error('Database backup root is not a valid JSON array or object.');
      }

      const users: User[] = usersRaw.map((u: any) => ({
        id: u.id,
        fullName: u.fullName || '',
        email: u.email || '',
        password: u.password || '',
        position: u.position || 'LEADER',
        address: u.address || '',
        groupAssigned: u.groupAssigned || null,
        status: u.status || 'Approved',
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || undefined,
        profilePicture: u.profilePicture || undefined,
        contactNumber: u.contactNumber || undefined,
        dailyRate: u.dailyRate !== undefined && u.dailyRate !== null ? parseFloat(u.dailyRate) : undefined
      }));

      // Ensure that we seed default administrators if they are missing
      const adminEmails = ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'];
      for (const adminEmail of adminEmails) {
        const hasAdmin = users.some(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
        if (!hasAdmin) {
          const isPrimary = adminEmail === 'elthrone1233@gmail.com';
          const adminUser: User = {
            id: isPrimary ? 'usr_admin' : 'usr_admin2',
            fullName: isPrimary ? 'System Admin' : 'Saint Francis Admin',
            email: adminEmail,
            password: 'rakionista021994',
            position: 'ADMIN',
            address: 'San Francisco',
            groupAssigned: null,
            status: 'Approved',
            createdAt: new Date().toISOString()
          };
          users.push(adminUser);
        }
      }

      const barangays: Barangay[] = barangaysRaw.map((b: any) => ({
        id: b.id,
        name: b.name || '',
        puroksCount: parseInt(b.puroksCount) || 0,
        yakapWillingCount: parseInt(b.yakapWillingCount) || 0,
        householdProgressBar: parseInt(b.householdProgressBar) || 0,
        membersProgressBar: parseInt(b.membersProgressBar) || 0,
        pmrfProgressBar: parseInt(b.pmrfProgressBar) || 0
      }));

      const puroks: Purok[] = puroksRaw.map((p: any) => ({
        id: p.id,
        name: p.name || '',
        barangay: p.barangay || '',
        barangay_id: p.barangay_id || null,
        householdCount: parseInt(p.householdCount) || 0,
        memberCount: parseInt(p.memberCount) || 0,
        pmrfCount: parseInt(p.pmrfCount) || 0,
        yakapWillingCount: parseInt(p.yakapWillingCount) || 0
      }));

      const households: Household[] = householdsRaw.map((h: any) => {
        let attachmentsArr: string[] = [];
        if (h.attachments) {
          try {
            attachmentsArr = typeof h.attachments === 'string' ? JSON.parse(h.attachments) : h.attachments;
          } catch (e) {
            attachmentsArr = [];
          }
        }

        let pmrfDetailsObj: any = undefined;
        if (h.pmrfDetails) {
          try {
            pmrfDetailsObj = typeof h.pmrfDetails === 'string' ? JSON.parse(h.pmrfDetails) : h.pmrfDetails;
          } catch (e) {}
        }

        let fpeDetailsObj: any = undefined;
        if (h.fpeDetails) {
          try {
            fpeDetailsObj = typeof h.fpeDetails === 'string' ? JSON.parse(h.fpeDetails) : h.fpeDetails;
          } catch (e) {}
        }

        let pcsfDetailsObj: any = undefined;
        if (h.pcsfDetails) {
          try {
            pcsfDetailsObj = typeof h.pcsfDetails === 'string' ? JSON.parse(h.pcsfDetails) : h.pcsfDetails;
          } catch (e) {}
        }

        return {
          id: h.id,
          householdNumber: h.householdNumber,
          householdHead: h.householdHead,
          contactNumber: h.contactNumber || '',
          completeAddress: h.completeAddress || '',
          barangay: h.barangay,
          purok: h.purok,
          latitude: h.latitude ? parseFloat(h.latitude) : undefined,
          longitude: h.longitude ? parseFloat(h.longitude) : undefined,
          pmrfStatus: h.pmrfStatus || 'Pending',
          yakapWillingStatus: h.yakapWillingStatus || 'Pending',
          approvalStatus: h.approvalStatus || 'Pending',
          attachments: Array.isArray(attachmentsArr) ? attachmentsArr : [],
          remarks: h.remarks || undefined,
          pmrfDetails: pmrfDetailsObj,
          fpeDetails: fpeDetailsObj,
          pcsfDetails: pcsfDetailsObj,
          createdBy: h.createdBy,
          updatedBy: h.updatedBy || undefined,
          createdAt: h.createdAt || new Date().toISOString(),
          updatedAt: h.updatedAt || undefined,
          deletedBy: h.deletedBy || undefined,
          deletedAt: h.deletedAt || undefined
        };
      });

      const householdMembers: HouseholdMember[] = householdMembersRaw.map((m: any) => ({
        id: m.id,
        householdId: m.householdId,
        firstName: m.firstName || '',
        middleName: m.middleName || '',
        lastName: m.lastName || '',
        gender: m.gender || 'Male',
        birthdate: m.birthdate || '',
        age: parseInt(m.age) || 0,
        civilStatus: m.civilStatus || 'Single',
        occupation: m.occupation || '',
        relationship: m.relationship || 'Head'
      }));

      const depMap = new Map<string, any>();
      dependentsRaw.forEach((d: any) => { if (d && d.id) depMap.set(d.id, d); });
      pmrfDependentsRaw.forEach((d: any) => {
        if (d && d.id) {
          const existing = depMap.get(d.id);
          depMap.set(d.id, { ...existing, ...d });
        }
      });
      const combinedDepsRaw = Array.from(depMap.values());

      const dependents: Dependent[] = combinedDepsRaw.map((d: any) => {
        const ln = d.last_name !== undefined ? d.last_name : d.lastName;
        const fn = d.first_name !== undefined ? d.first_name : d.firstName;
        const mn = d.middle_name !== undefined ? d.middle_name : d.middleName;
        const ext = d.name_ext !== undefined ? d.name_ext : d.nameExt;
        const dob = d.date_of_birth !== undefined ? d.date_of_birth : (d.birthDate || d.birthdate);
        const noMnVal = d.no_mn !== undefined ? d.no_mn : d.noMiddleName;

        const computedFullName = d.fullName || `${ln || ''}, ${fn || ''}${ext ? ' ' + ext : ''}`.trim().toUpperCase();

        return {
          id: d.id,
          householdId: d.householdId,
          fullName: computedFullName,
          gender: d.gender || d.sex || 'Female',
          age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
          relationship: d.relationship || 'Child',
          birthDate: dob || '',
          birthdate: dob || '',
          civilStatus: d.civilStatus || 'Single',
          lastName: ln || '',
          firstName: fn || '',
          middleName: mn || '',
          nameExt: ext || '',
          noMiddleName: noMnVal === 1 || noMnVal === true,
          mononym: d.mononym === 1 || d.mononym === true,
          citizenship: d.citizenship || 'FILIPINO',
          isDisabled: d.isDisabled === 1 || d.isDisabled === true,
          pmrfSubmissionId: d.pmrfSubmissionId || null,
          pmrfRecordId: d.pmrfRecordId || null,
          memberPin: d.memberPin || null,
          submittedByAccountId: d.submittedByAccountId || null,
          createdAt: d.createdAt || null,
          sex: d.sex || d.gender || 'Female',
          pswd: d.pswd === 1 || d.pswd === true,
          last_name: ln || '',
          first_name: fn || '',
          middle_name: mn || '',
          name_ext: ext || '',
          date_of_birth: dob || '',
          no_mn: noMnVal === 1 || noMnVal === true ? 1 : 0
        };
      });

      const groups: Group[] = groupsRaw.map((g: any) => {
        let coLeadersArr: string[] = [];
        if (g.coLeaders) {
          try {
            coLeadersArr = typeof g.coLeaders === 'string' ? JSON.parse(g.coLeaders) : g.coLeaders;
          } catch (e) {}
        }

        let barArr: string[] = [];
        if (g.assignedBarangays) {
          try {
            barArr = typeof g.assignedBarangays === 'string' ? JSON.parse(g.assignedBarangays) : g.assignedBarangays;
          } catch (e) {}
        }

        return {
          id: g.id,
          name: g.name || '',
          leader: g.leader || '',
          coLeaders: Array.isArray(coLeadersArr) ? coLeadersArr : [],
          assignedBarangays: Array.isArray(barArr) ? barArr : [],
          ratePerPerson: parseFloat(g.ratePerPerson) || 0,
          isArchived: g.isArchived === '1' || g.isArchived === 1 || g.isArchived === true,
          createdAt: g.createdAt || new Date().toISOString(),
          status: g.status || undefined
        };
      });

      const paidPayrolls: PaidPayroll[] = paidPayrollsRaw.map((p: any) => ({
        id: p.id,
        groupName: p.groupName || '',
        dateRange: p.dateRange || '',
        populationCount: parseInt(p.populationCount) || 0,
        ratePerPerson: parseFloat(p.ratePerPerson) || 0,
        totalAmountPaid: parseFloat(p.totalAmountPaid) || 0,
        paidDate: p.paidDate || '',
        settledBy: p.settledBy || '',
        remarks: p.remarks || undefined
      }));

      const healthRecords: HealthRecord[] = healthRecordsRaw.map((h: any) => ({
        id: h.id,
        patientName: h.patientName || '',
        householdId: h.householdId || '',
        householdHead: h.householdHead || '',
        barangay: h.barangay || '',
        diagnosis: h.diagnosis || '',
        treatment: h.treatment || '',
        medications: h.medications || '',
        notes: h.notes || '',
        date: h.date || '',
        bloodPressure: h.bloodPressure || undefined,
        heartRate: h.heartRate || undefined,
        respRate: h.respRate || undefined,
        temperature: h.temperature || undefined,
        weightKg: h.weightKg || undefined,
        heightCm: h.heightCm || undefined,
        bmi: h.bmi || undefined
      }));

      const activityLogs: ActivityLog[] = activityLogsRaw.map((l: any) => ({
        id: l.id,
        user: l.user || '',
        action: l.action || '',
        module: l.module || '',
        date: l.date || '',
        time: l.time || ''
      }));

      const notifications: Notification[] = notificationsRaw.map((n: any) => ({
        id: n.id,
        title: n.title || '',
        message: n.message || '',
        type: (n.type || 'INFO') as any,
        read: n.is_read === '1' || n.is_read === 1 || n.is_read === true || n.read === true,
        createdAt: n.createdAt || new Date().toISOString()
      }));

      const timecards: Timecard[] = timecardsRaw.map((t: any) => ({
        id: t.id,
        userId: t.userId || '',
        userEmail: t.userEmail || '',
        userName: t.userName || '',
        type: t.type || 'IN',
        timestamp: t.timestamp || new Date().toISOString(),
        photo: t.photo || '',
        latitude: t.latitude ? parseFloat(t.latitude) : undefined,
        longitude: t.longitude ? parseFloat(t.longitude) : undefined,
        deviceInfo: t.deviceInfo || undefined,
        settled: t.settled === '1' || t.settled === 1 || t.settled === true,
        settlementId: t.settlementId || null,
        isOvertime: t.isOvertime === '1' || t.isOvertime === 1 || t.isOvertime === true,
        otHours: t.otHours !== null && t.otHours !== undefined ? parseFloat(t.otHours) : undefined
      }));

      const itSettledPayrolls: any[] = itSettledPayrollsRaw.map((itUrl: any) => {
        let bdownObj: any[] = [];
        if (itUrl.breakdown) {
          try {
            bdownObj = typeof itUrl.breakdown === 'string' ? JSON.parse(itUrl.breakdown) : itUrl.breakdown;
          } catch (e) {}
        }
        return {
          id: itUrl.id,
          userId: itUrl.userId || '',
          userEmail: itUrl.userEmail || '',
          userName: itUrl.userName || '',
          dailyRate: parseFloat(itUrl.dailyRate) || 440,
          dateRange: itUrl.dateRange || '',
          daysPresent: parseInt(itUrl.daysPresent) || 0,
          daysAbsent: parseInt(itUrl.daysAbsent) || 0,
          totalLateMinutes: parseInt(itUrl.totalLateMinutes) || 0,
          totalDeductions: parseFloat(itUrl.totalDeductions) || 0,
          totalEarned: parseFloat(itUrl.totalEarned) || 0,
          paidDate: itUrl.paidDate || '',
          settledBy: itUrl.settledBy || '',
          remarks: itUrl.remarks || '',
          breakdown: Array.isArray(bdownObj) ? bdownObj : []
        };
      });

      const pcuFiles: any[] = pcuFilesRaw.map((f: any) => ({
        id: f.id,
        fullName: f.fullName || '',
        birthday: f.birthday || '',
        fileName: f.fileName || '',
        fileData: f.fileData || '',
        uploadDate: f.uploadDate || '',
        uploadedBy: f.uploadedBy || ''
      }));

      let settings = defaultSettings;
      if (siteSettingsRaw.length > 0) {
        const s = siteSettingsRaw[0];
        let pms: any = undefined;
        if (s.userPagePermissions) {
          try {
            pms = typeof s.userPagePermissions === 'string' ? JSON.parse(s.userPagePermissions) : s.userPagePermissions;
          } catch (e) {}
        }
        settings = {
          faviconLogo: s.faviconLogo || defaultSettings.faviconLogo,
          faviconTitle: s.faviconTitle || defaultSettings.faviconTitle,
          websiteTitle: s.websiteTitle || defaultSettings.websiteTitle,
          websiteLogo: s.websiteLogo || defaultSettings.websiteLogo,
          seoTitle: s.seoTitle || defaultSettings.seoTitle,
          seoDescription: s.seoDescription || defaultSettings.seoDescription,
          seoKeywords: s.seoKeywords || defaultSettings.seoKeywords,
          squadDeleteAction: s.squadDeleteAction || defaultSettings.squadDeleteAction,
          userPagePermissions: pms
        };
      }

      this.state = {
        users,
        settings,
        barangays,
        puroks,
        households,
        householdMembers,
        dependents,
        groups,
        paidPayrolls,
        healthRecords,
        activityLogs,
        notifications,
        timecards,
        itSettledPayrolls,
        pcuFiles
      };

      // Write parsed backup instantly to our active JSON db.json file
      ensureDataFolder();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf8');

      // Sync directly to MySQL database if live active
      const hasMySQL = shouldAttemptMySQL();
      if (hasMySQL) {
        this.hasLoadedFromMySQLSuccessfully = true; 
        const pool = getMySQLPool();
        if (pool) {
          await this.syncAllToMySQL(pool);
        }
      }

      // Rename target file so it does not trigger automatic auto-import repeatedly inside initialize
      const processedPathName = path.basename(filePath, '.json') + '_imported.json';
      const processedPath = path.join(path.dirname(filePath), processedPathName);
      if (fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
      fs.renameSync(filePath, processedPath);

      return {
        success: true,
        stats: {
          users: users.length,
          barangays: barangays.length,
          puroks: puroks.length,
          households: households.length,
          householdMembers: householdMembers.length,
          dependents: dependents.length,
          groups: groups.length,
          paidPayrolls: paidPayrolls.length,
          healthRecords: healthRecords.length,
          activityLogs: activityLogs.length,
          notifications: notifications.length,
          timecards: timecards.length,
          itSettledPayrolls: itSettledPayrolls.length,
          pcuFiles: pcuFiles.length
        }
      };

    } catch (err: any) {
      console.error('❌ Direct importFromJsonFile execution failed:', err);
      throw err;
    }
  }

  public static initialize(): DBState {
    ensureDataFolder();
    this.checkAndImportExternalJson();
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.state = JSON.parse(data);
        
        // Comprehensive check to ensure every state collections array is fully initialized
        if (this.state) {
          if (!this.state.settings) this.state.settings = defaultSettings;
          if (!this.state.users) this.state.users = [];
          if (!this.state.barangays) this.state.barangays = [];
          if (!this.state.puroks) this.state.puroks = [];
          if (!this.state.households) this.state.households = [];
          if (!this.state.householdMembers) this.state.householdMembers = [];
          if (!this.state.dependents) this.state.dependents = [];
          if (!this.state.groups) this.state.groups = [];
          if (!this.state.paidPayrolls) this.state.paidPayrolls = [];
          if (!this.state.healthRecords) this.state.healthRecords = [];
          if (!this.state.activityLogs) this.state.activityLogs = [];
          if (!this.state.notifications) this.state.notifications = [];
          if (!this.state.timecards) this.state.timecards = [];
          if (!this.state.itSettledPayrolls) this.state.itSettledPayrolls = [];
          if (!this.state.pcuFiles) this.state.pcuFiles = [];
          if (!this.state.drafts) this.state.drafts = [];
        }
      } catch (err) {
        console.error('Error loading DB file, building seed data', err);
        this.state = getSeedData();
        this.save();
      }
    } else {
      this.state = getSeedData();
      this.save();
    }
    
    // Safety check on loaded state
    if (this.state) {
      if (!this.state.settings) this.state.settings = defaultSettings;
      if (!this.state.users) this.state.users = [];
      if (!this.state.barangays) this.state.barangays = [];
      if (!this.state.puroks) this.state.puroks = [];
      if (!this.state.households) this.state.households = [];
      if (!this.state.householdMembers) this.state.householdMembers = [];
      if (!this.state.dependents) this.state.dependents = [];
      if (!this.state.groups) this.state.groups = [];
      if (!this.state.paidPayrolls) this.state.paidPayrolls = [];
      if (!this.state.healthRecords) this.state.healthRecords = [];
      if (!this.state.activityLogs) this.state.activityLogs = [];
      if (!this.state.notifications) this.state.notifications = [];
      if (!this.state.timecards) this.state.timecards = [];
      if (!this.state.itSettledPayrolls) this.state.itSettledPayrolls = [];
      if (!this.state.pcuFiles) this.state.pcuFiles = [];
      if (!this.state.drafts) this.state.drafts = [];
    }

    this.runMigrations();
    return this.state!;
  }

  public static getData(): DBState {
    const now = Date.now();
    const shouldReloadLocalFile = !shouldAttemptMySQL() && (!this.state || (this.lastLocalLoadTime && now - this.lastLocalLoadTime > 2000));
    
    if (shouldReloadLocalFile) {
      if (fs.existsSync(DB_FILE)) {
        try {
          const data = fs.readFileSync(DB_FILE, 'utf8');
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object') {
            this.state = parsed;
            this.lastLocalLoadTime = now;
          }
        } catch (err: any) {
          console.warn('[Database Fallback Sync] Quietly skipped file-based reload:', err.message);
        }
      }
    }

    if (!this.state) {
      return this.initialize();
    }

    // Harden state by guaranteeing array instances for all list fields to run completely error-free
    if (!Array.isArray(this.state.users)) this.state.users = [];
    if (!Array.isArray(this.state.barangays)) this.state.barangays = [];
    if (!Array.isArray(this.state.puroks)) this.state.puroks = [];
    if (!Array.isArray(this.state.households)) this.state.households = [];
    if (!Array.isArray(this.state.householdMembers)) this.state.householdMembers = [];
    if (!Array.isArray(this.state.dependents)) this.state.dependents = [];
    if (!Array.isArray(this.state.groups)) this.state.groups = [];
    if (!Array.isArray(this.state.paidPayrolls)) this.state.paidPayrolls = [];
    if (!Array.isArray(this.state.healthRecords)) this.state.healthRecords = [];
    if (!Array.isArray(this.state.activityLogs)) this.state.activityLogs = [];
    if (!Array.isArray(this.state.notifications)) this.state.notifications = [];
    if (!Array.isArray(this.state.timecards)) this.state.timecards = [];
    if (!Array.isArray(this.state.itSettledPayrolls)) this.state.itSettledPayrolls = [];
    if (!Array.isArray(this.state.pcuFiles)) this.state.pcuFiles = [];
    if (!Array.isArray(this.state.drafts)) this.state.drafts = [];

    return this.state;
  }

  private static schemaChecked = false;

  private static async ensureMySQLSchema(connection: any): Promise<void> {
    if (this.schemaChecked) return;
    try {
      const [rows] = await connection.query('SHOW TABLES');
      const tablesCount = (rows as any[]).length;
      if (tablesCount === 0) {
        console.log('📦 Database is empty. Auto-initializing MySQL database schema inside cPanel...');
        const schemaPath = path.join(process.cwd(), 'mysql-schema.sql');
        if (fs.existsSync(schemaPath)) {
          const rawSql = fs.readFileSync(schemaPath, 'utf8');
          const queries = rawSql
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--'));

          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          for (const query of queries) {
            await connection.query(query);
          }
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          console.log('✅ MySQL Database auto-provisioned successfully from mysql-schema.sql!');
        } else {
          console.warn('⚠️ WARNING: mysql-schema.sql not found at ' + schemaPath);
        }
      }

      // Safe hotfixes migration block for existing databases (verifies and applies updates on top of schema)
      try {
        console.log('🔄 Checking and applying hotfixes on existing MySQL database tables...');
          
          // 0. Ensure pmrf_dependents table exists (it might be missing in databases imported from legacy backups like sainajbo_sfc1-1.sql)
          try {
            const [tableCheck] = await connection.query(`SHOW TABLES LIKE 'pmrf_dependents'`);
            if (Array.isArray(tableCheck) && tableCheck.length === 0) {
              console.log('📦 Missing pmrf_dependents table detected. Auto-creating table structure with foreign key relation...');
              await connection.query(`
                CREATE TABLE \`pmrf_dependents\` (
                  \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
                  \`pmrf_id\` VARCHAR(50) NOT NULL,
                  \`submission_id\` VARCHAR(100) DEFAULT NULL,
                  \`fullName\` VARCHAR(150) DEFAULT NULL,
                  \`last_name\` VARCHAR(100) DEFAULT NULL,
                  \`first_name\` VARCHAR(100) DEFAULT NULL,
                  \`middle_name\` VARCHAR(100) DEFAULT NULL,
                  \`name_ext\` VARCHAR(50) DEFAULT NULL,
                  \`relationship\` VARCHAR(50) NOT NULL,
                  \`date_of_birth\` VARCHAR(100) DEFAULT NULL,
                  \`sex\` VARCHAR(50) DEFAULT NULL,
                  \`citizenship\` VARCHAR(100) DEFAULT NULL,
                  \`no_mn\` TINYINT(1) DEFAULT 0,
                  \`mononym\` TINYINT(1) DEFAULT 0,
                  \`pswd\` TINYINT(1) DEFAULT 0,
                  \`age\` INT DEFAULT NULL,
                  \`civilStatus\` VARCHAR(100) DEFAULT NULL,
                  \`isDisabled\` TINYINT(1) DEFAULT 0,
                  \`pmrfSubmissionId\` VARCHAR(100) DEFAULT NULL,
                  \`pmrfRecordId\` VARCHAR(100) DEFAULT NULL,
                  \`memberPin\` VARCHAR(100) DEFAULT NULL,
                  \`submittedByAccountId\` VARCHAR(100) DEFAULT NULL,
                  \`createdAt\` VARCHAR(100) DEFAULT NULL,
                  CONSTRAINT \`fk_pmrf_dependent_household\` FOREIGN KEY (\`pmrf_id\`) REFERENCES \`households\` (\`id\`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
              `);
              console.log('✅ Auto-created missing pmrf_dependents table successfully!');
            }
          } catch (tblErr: any) {
            console.error('⚠️ Could not check or create pmrf_dependents table:', tblErr.message);
          }

          // 1. Ensure position column is VARCHAR(255) to support comma-separated multiple positions
          await connection.query(`
            ALTER TABLE \`users\` 
            MODIFY COLUMN \`position\` VARCHAR(255) NOT NULL DEFAULT 'LEADER'
          `).catch((e: any) => {
            console.log('💡 Note: Users position VARCHAR migration could not be executed:', e.message);
          });

          // 2. Ensure profilePicture is in users table
          await connection.query(`
            ALTER TABLE \`users\` 
            ADD COLUMN \`profilePicture\` LONGTEXT DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column profilePicture check:', e.message);
            }
          });

          // 2b. Ensure contactNumber is in users table
          await connection.query(`
            ALTER TABLE \`users\` 
            ADD COLUMN \`contactNumber\` VARCHAR(100) DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column contactNumber check:', e.message);
            }
          });

          // 2c. Ensure dailyRate is in users table
          await connection.query(`
            ALTER TABLE \`users\` 
            ADD COLUMN \`dailyRate\` DECIMAL(10,2) DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column dailyRate check:', e.message);
            }
          });

          // 3. Ensure site_settings logo/favicon columns are LONGTEXT to accept larger base64 file payloads
          await connection.query(`
            ALTER TABLE \`site_settings\` 
            MODIFY COLUMN \`websiteLogo\` LONGTEXT NOT NULL
          `).catch((e: any) => {
            console.log('💡 Note: Column websiteLogo check:', e.message);
          });

          await connection.query(`
            ALTER TABLE \`site_settings\` 
            MODIFY COLUMN \`faviconLogo\` LONGTEXT NOT NULL
          `).catch((e: any) => {
            console.log('💡 Note: Column faviconLogo check:', e.message);
          });

          // Hotfix: Ensure squadDeleteAction is in site_settings table
          await connection.query(`
            ALTER TABLE \`site_settings\` 
            ADD COLUMN \`squadDeleteAction\` VARCHAR(50) DEFAULT 'ARCHIVE'
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column squadDeleteAction check:', e.message);
            }
          });

          // Hotfix: Ensure verification schema columns are in households table
          const householdExtCols = [
            { name: 'submittedByAccountId', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'submittedByUsername', spec: 'VARCHAR(150) DEFAULT NULL' },
            { name: 'dateSubmitted', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'submissionReferenceNumber', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'isFpePcsfOnly', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'approvedBy', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'approvalDate', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'disapprovedBy', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'disapprovalRemarks', spec: 'TEXT DEFAULT NULL' },
            { name: 'resubmissionHistory', spec: 'LONGTEXT DEFAULT NULL' }
          ];
          for (const col of householdExtCols) {
            await connection.query(`
              ALTER TABLE \`households\` ADD COLUMN \`${col.name}\` ${col.spec}
            `).catch((e: any) => {
              if (!e.message.includes('Duplicate column')) {
                console.log(`💡 Note: households Column ${col.name} check:`, e.message);
              }
            });
          }

          // Hotfix: Force convert attachments, pmrfDetails, fpeDetails, pcsfDetails to LONGTEXT to prevent truncate damage
          const textColsToUpgrade = ['attachments', 'pmrfDetails', 'fpeDetails', 'pcsfDetails', 'resubmissionHistory'];
          for (const colName of textColsToUpgrade) {
            await connection.query(`
              ALTER TABLE \`households\` MODIFY COLUMN \`${colName}\` LONGTEXT DEFAULT NULL
            `).catch((e: any) => {
              console.log(`💡 Note: households Column ${colName} upgrade to LONGTEXT check:`, e.message);
            });
          }

          // Hotfix: Ensure userPagePermissions is in site_settings table
          await connection.query(`
            ALTER TABLE \`site_settings\` 
            ADD COLUMN \`userPagePermissions\` LONGTEXT DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column userPagePermissions check:', e.message);
            }
          });

          // Hotfix: Ensure isArchived is in groups table
          await connection.query(`
            ALTER TABLE \`groups\`
            ADD COLUMN \`isArchived\` INT DEFAULT 0
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column isArchived check:', e.message);
            }
          });

          // Hotfix: Ensure barangayFolderId is in groups table
          await connection.query(`
            ALTER TABLE \`groups\`
            ADD COLUMN \`barangayFolderId\` VARCHAR(50) DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column barangayFolderId check:', e.message);
            }
          });

          // Hotfix: Ensure createdAt is in groups table
          await connection.query(`
            ALTER TABLE \`groups\`
            ADD COLUMN \`createdAt\` VARCHAR(50) DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column createdAt check:', e.message);
            }
          });

          // Hotfix: Ensure status is in groups table
          await connection.query(`
            ALTER TABLE \`groups\`
            ADD COLUMN \`status\` VARCHAR(50) DEFAULT 'Pending'
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column status check:', e.message);
            }
          });

          // 4. Ensure physical exam columns are added inside health_records
          const extHealthCols = [
            { name: 'bloodPressure', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'heartRate', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'respRate', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'temperature', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'weightKg', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'heightCm', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'bmi', spec: 'VARCHAR(50) DEFAULT NULL' }
          ];

          for (const col of extHealthCols) {
            await connection.query(`
              ALTER TABLE \`health_records\` ADD COLUMN \`${col.name}\` ${col.spec}
            `).catch((e: any) => {
              if (!e.message.includes('Duplicate column')) {
                console.log(`💡 Note: health_records Column ${col.name} check:`, e.message);
              }
            });
          }

          // 5. Ensure settled and settlementId columns are added to timecards table
          await connection.query(`
            ALTER TABLE \`timecards\` ADD COLUMN \`settled\` TINYINT(1) DEFAULT 0
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column settled check:', e.message);
            }
          });

          await connection.query(`
            ALTER TABLE \`timecards\` ADD COLUMN \`settlementId\` VARCHAR(50) DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column settlementId check:', e.message);
            }
          });

          await connection.query(`
            ALTER TABLE \`timecards\` ADD COLUMN \`isOvertime\` TINYINT(1) DEFAULT 0
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column isOvertime check:', e.message);
            }
          });

          await connection.query(`
            ALTER TABLE \`timecards\` ADD COLUMN \`otHours\` DECIMAL(5, 2) DEFAULT NULL
          `).catch((e: any) => {
            if (!e.message.includes('Duplicate column')) {
              console.log('💡 Note: Column otHours check:', e.message);
            }
          });

          // 5b. Ensure all fields for PMRF declaration of dependents exist in dependents table
          const extDependentCols = [
            { name: 'birthDate', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'civilStatus', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'lastName', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'firstName', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'middleName', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'nameExt', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'noMiddleName', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'mononym', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'citizenship', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'isDisabled', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'pmrfSubmissionId', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'pmrfRecordId', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'memberPin', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'submittedByAccountId', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'createdAt', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'sex', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'pswd', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'last_name', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'first_name', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'middle_name', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'name_ext', spec: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'date_of_birth', spec: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'no_mn', spec: 'TINYINT(1) DEFAULT 0' }
          ];

          for (const col of extDependentCols) {
            await connection.query(`
              ALTER TABLE \`dependents\` ADD COLUMN \`${col.name}\` ${col.spec}
            `).catch((e: any) => {
              if (!e.message.includes('Duplicate column')) {
                console.log(`💡 Note: dependents Column ${col.name} check:`, e.message);
              }
            });
          }

          // Relax old non-null constraints for existing legacy columns
          const relaxQueries = [
            `ALTER TABLE \`dependents\` MODIFY COLUMN \`fullName\` VARCHAR(100) DEFAULT NULL`,
            `ALTER TABLE \`dependents\` MODIFY COLUMN \`gender\` ENUM('Male', 'Female', 'Other') DEFAULT 'Female'`,
            `ALTER TABLE \`dependents\` MODIFY COLUMN \`age\` INT DEFAULT NULL`
          ];
          for (const q of relaxQueries) {
            await connection.query(q).catch((e: any) => {
              console.log('💡 Note: dependents constraint relaxation check:', e.message);
            });
          }

          // Data Migration for existing dependent records where first_name or last_name is missing but fullName has details
          try {
            const [rows]: any = await connection.query(`
              SELECT id, fullName, lastName, firstName, last_name, first_name 
              FROM dependents 
              WHERE fullName IS NOT NULL AND fullName LIKE '%,%'
            `);
            for (const r of rows) {
              const currentLastName = r.lastName || r.last_name || '';
              const currentFirstName = r.firstName || r.first_name || '';
              if (!currentLastName.trim() || !currentFirstName.trim()) {
                const parts = r.fullName.split(',');
                const splitLastName = parts[0]?.trim() || '';
                const splitFirstName = parts[1]?.trim() || '';
                
                await connection.query(`
                  UPDATE dependents 
                  SET 
                    lastName = ?, firstName = ?, 
                    last_name = ?, first_name = ?
                  WHERE id = ?
                `, [
                  splitLastName, splitFirstName,
                  splitLastName, splitFirstName,
                  r.id
                ]);
                console.log(`[MIGRATION] Migrated dependent ID \${r.id} (\${r.fullName}) to separate first/last name columns.`);
              }
            }
          } catch (migErr: any) {
            console.log('💡 Note: Dependent data migration failed or skipped:', migErr.message);
          }

          // 6. Ensure it_settled_payrolls table is auto-created if missing on existing instances
          await connection.query(`
            CREATE TABLE IF NOT EXISTS \`it_settled_payrolls\` (
              \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
              \`userId\` VARCHAR(50) NOT NULL,
              \`userEmail\` VARCHAR(100) NOT NULL,
              \`userName\` VARCHAR(100) NOT NULL,
              \`dailyRate\` DECIMAL(10, 2) DEFAULT 0.00,
              \`dateRange\` VARCHAR(100) NOT NULL,
              \`daysPresent\` INT DEFAULT 0,
              \`daysAbsent\` INT DEFAULT 0,
              \`totalLateMinutes\` INT DEFAULT 0,
              \`totalDeductions\` DECIMAL(12, 2) DEFAULT 0.00,
              \`totalEarned\` DECIMAL(12, 2) DEFAULT 0.00,
              \`paidDate\` VARCHAR(50) NOT NULL,
              \`settledBy\` VARCHAR(100) NOT NULL,
              \`remarks\` TEXT DEFAULT NULL,
              \`breakdown\` LONGTEXT DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `).catch((e: any) => {
            console.log('💡 Note: it_settled_payrolls Table check:', e.message);
          });

          // 7. Ensure pmrf_dependents table is auto-created if missing on existing instances
          await connection.query(`
            CREATE TABLE IF NOT EXISTS \`pmrf_dependents\` (
              \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
              \`pmrf_id\` VARCHAR(50) NOT NULL,
              \`submission_id\` VARCHAR(100) DEFAULT NULL,
              \`last_name\` VARCHAR(100) DEFAULT NULL,
              \`first_name\` VARCHAR(100) DEFAULT NULL,
              \`middle_name\` VARCHAR(100) DEFAULT NULL,
              \`name_ext\` VARCHAR(50) DEFAULT NULL,
              \`relationship\` VARCHAR(50) NOT NULL,
              \`date_of_birth\` VARCHAR(100) DEFAULT NULL,
              \`sex\` VARCHAR(50) DEFAULT NULL,
              \`citizenship\` VARCHAR(100) DEFAULT NULL,
              \`no_mn\` TINYINT(1) DEFAULT 0,
              \`mononym\` TINYINT(1) DEFAULT 0,
              \`pswd\` TINYINT(1) DEFAULT 0,
              \`age\` INT DEFAULT NULL,
              \`civilStatus\` VARCHAR(100) DEFAULT NULL,
              \`isDisabled\` TINYINT(1) DEFAULT 0,
              \`pmrfSubmissionId\` VARCHAR(100) DEFAULT NULL,
              \`pmrfRecordId\` VARCHAR(100) DEFAULT NULL,
              \`memberPin\` VARCHAR(100) DEFAULT NULL,
              \`submittedByAccountId\` VARCHAR(100) DEFAULT NULL,
              \`createdAt\` VARCHAR(100) DEFAULT NULL,
              CONSTRAINT \`fk_pmrf_dependent_household_direct\` FOREIGN KEY (\`pmrf_id\`) REFERENCES \`households\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `).catch((e: any) => {
            console.log('💡 Note: pmrf_dependents Table check:', e.message);
          });

          // 8. Ensure barangay_id column is present in puroks table and populated
          try {
            await connection.query(`ALTER TABLE \`puroks\` ADD COLUMN \`barangay_id\` VARCHAR(50) DEFAULT NULL`);
            console.log('✅ Added barangay_id column to existing puroks table.');
          } catch (columnErr: any) {
            if (!columnErr.message.includes('Duplicate column')) {
              console.log('💡 Note: Column barangay_id check on puroks table:', columnErr.message);
            }
          }

          try {
            await connection.query(`
              UPDATE puroks p 
              JOIN barangays b ON LOWER(TRIM(p.barangay)) = LOWER(TRIM(b.name)) 
              SET p.barangay_id = b.id 
              WHERE p.barangay_id IS NULL OR p.barangay_id = ''
            `);
            console.log('✅ Synchronized barangay_id in existing puroks records with respective barangay IDs.');
          } catch (syncErr: any) {
            console.warn('⚠️ Could not update barangay_id relations on puroks table:', syncErr.message);
          }

          // High Performance Key Column Indexing for Fast MySQL Search Retrieval
          const indexDefinitions = [
            { table: 'dependents', name: 'idx_dependent_memberPin', col: 'memberPin' },
            { table: 'pmrf_dependents', name: 'idx_pmrfdependent_memberPin', col: 'memberPin' },
            { table: 'households', name: 'idx_household_submissionRef', col: 'submissionReferenceNumber' },
            { table: 'users', name: 'idx_user_fullname', col: 'fullName' },
            { table: 'dependents', name: 'idx_dependent_fullname', col: 'fullName' },
            { table: 'pmrf_dependents', name: 'idx_pmrfdependent_fullname', col: 'fullName' },
            { table: 'households', name: 'idx_household_barangay', col: 'barangay' },
            { table: 'health_records', name: 'idx_health_barangay', col: 'barangay' },
            { table: 'dependents', name: 'idx_dependent_lastName', col: 'last_name' },
            { table: 'dependents', name: 'idx_dependent_firstName', col: 'first_name' },
            { table: 'pmrf_dependents', name: 'idx_pmrfdependent_lastName', col: 'last_name' },
            { table: 'pmrf_dependents', name: 'idx_pmrfdependent_firstName', col: 'first_name' },
            { table: 'household_members', name: 'idx_member_lastName', col: 'lastName' },
            { table: 'household_members', name: 'idx_member_firstName', col: 'firstName' },
            { table: 'households', name: 'idx_household_purok', col: 'purok' },
            { table: 'households', name: 'idx_household_dateSubmitted', col: 'dateSubmitted' },
            { table: 'households', name: 'idx_household_createdAt', col: 'createdAt' },
            { table: 'household_members', name: 'idx_member_householdId', col: 'householdId' }
          ];

          for (const idx of indexDefinitions) {
            try {
              await connection.query(`ALTER TABLE \`${idx.table}\` ADD INDEX \`${idx.name}\` (\`${idx.col}\`)`);
              console.log(`✅ [MySQL Index Tuning] Added index "${idx.name}" on "${idx.table}(${idx.col})".`);
            } catch (idxErr: any) {
              if (!idxErr.message.includes('Duplicate key name') && !idxErr.message.includes('Key column')) {
                console.warn(`⚠️ [MySQL Index Warning] Could not check/add index "${idx.name}":`, idxErr.message);
              }
            }
          }

          console.log('✅ Existing MySQL table structures verified and updated to latest specs.');
        } catch (migrationErr: any) {
          console.warn('⚠️ Table structural migration warnings skipped:', migrationErr.message);
        }
      this.schemaChecked = true;
    } catch (err: any) {
      console.info('❌ Failed to auto-initialize MySQL database schema (expected if offline):', err.message);
    }
  }

  public static async loadFromDB(force: boolean = false): Promise<DBState> {
    const state = this.getData();
    if (!shouldAttemptMySQL()) {
      return state;
    }
    const pool = getMySQLPool();
    if (!pool) {
      return state;
    }

    // Active connection query: Always fetch directly from MySQL, bypassing in-memory caching.
    // If there is an active loading promise from an overlapping thread, we await it
    // to prevent redundant concurrent queries hitting MySQL.
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.revalidateInBackground(pool);
    return this.loadingPromise;
  }

  private static async revalidateInBackground(pool: any): Promise<DBState> {
    const now = Date.now();
    const state = this.getData();
    try {
      const connection = await pool.getConnection();
      try {
        // Auto-provision schema on boot if database is brand new
        await this.ensureMySQLSchema(connection);

        // Run migrations only once per boot
        if (!this.hasRunMigrations) {
          try {
            // Delete San Francisco barangay record
            await connection.query(`DELETE FROM barangays WHERE LOWER(name) IN ('san francisco', 'san fancisco', 'sanfrancisco', 'sanfancisco')`);
            // Delete Puroks belonging to San Francisco
            await connection.query(`DELETE FROM puroks WHERE LOWER(barangay) IN ('san francisco', 'san fancisco', 'sanfrancisco', 'sanfancisco')`);
            // Delete Seed household
            await connection.query(`DELETE FROM households WHERE id = 'hsh_1'`);
            // Migrate any other households with San Francisco address
            await connection.query(`UPDATE households SET barangay = 'SAN PEDRO', completeAddress = REPLACE(completeAddress, 'San Francisco', 'SAN PEDRO') WHERE LOWER(barangay) IN ('san francisco', 'san fancisco', 'sanfrancisco', 'sanfancisco')`);
            // Delete Seed health_records
            await connection.query(`DELETE FROM health_records WHERE id IN ('med_1', 'med_2')`);
            // Migrate other health records
            await connection.query(`UPDATE health_records SET barangay = 'SAN PEDRO' WHERE LOWER(barangay) IN ('san francisco', 'san fancisco', 'sanfrancisco', 'sanfancisco')`);
            // Update user address
            await connection.query(`UPDATE users SET address = 'SAN PEDRO' WHERE LOWER(address) IN ('san francisco', 'san fancisco', 'sanfrancisco', 'sanfancisco')`);
            
            // Permanent SQL removal/rename of "Purok Avocado" to "Purok Mangga"
            try {
              await connection.query(`UPDATE puroks SET name = 'Purok Mangga' WHERE LOWER(name) = 'purok avocado'`);
              await connection.query(`UPDATE households SET purok = 'Purok Mangga', completeAddress = REPLACE(REPLACE(completeAddress, 'Purok Avocado', 'Purok Mangga'), 'purok avocado', 'Purok Mangga') WHERE LOWER(purok) = 'purok avocado'`);
              await connection.query(`DELETE FROM puroks WHERE LOWER(name) = 'purok avocado'`);
              console.log('🧹 [MySQL Migration] Successfully removed and migrated "Purok Avocado" references once.');
            } catch (purokMigrateErr: any) {
              console.warn('⚠️ [MySQL Migration] Could not migrate Purok Avocado:', purokMigrateErr.message);
            }
            
            this.hasRunMigrations = true;
            console.log('🧹 [MySQL Migration] Executed direct cleanup queries for "San Francisco" / "San Fancisco" barangay data once.');
          } catch (dbCleanupErr: any) {
            console.warn('⚠️ [MySQL Migration] Cleanup queries skip:', dbCleanupErr.message);
            this.hasRunMigrations = true;
          }
        }

        const getVal = (obj: any, ...keys: string[]): any => {
          if (!obj) return undefined;
          for (const key of keys) {
            if (obj[key] !== undefined) return obj[key];
            const lowerKey = key.toLowerCase();
            for (const k in obj) {
              if (k.toLowerCase() === lowerKey && obj[k] !== undefined) {
                return obj[k];
              }
            }
          }
          return undefined;
        };

        const runSafeQuery = (sql: string, fallbackVal: any = []) => {
          return pool.query(sql).catch((err: any) => {
            console.warn(`⚠️ Safe Database Engine Warning: Table query failed for "${sql}":`, err.message);
            return [fallbackVal, []];
          });
        };

        // Concurrently query all 16 tables in parallel using the connection pool
        const queries = [
          runSafeQuery('SELECT * FROM users'),
          runSafeQuery('SELECT * FROM site_settings LIMIT 1'),
          runSafeQuery('SELECT * FROM barangays'),
          runSafeQuery('SELECT * FROM puroks'),
          runSafeQuery('SELECT * FROM households'),
          runSafeQuery('SELECT * FROM household_members'),
          runSafeQuery('SELECT * FROM dependents'),
          runSafeQuery('SELECT * FROM pmrf_dependents'),
          runSafeQuery('SELECT * FROM groups'),
          runSafeQuery('SELECT * FROM paid_payrolls'),
          runSafeQuery('SELECT * FROM health_records'),
          runSafeQuery('SELECT * FROM activity_logs'),
          runSafeQuery('SELECT * FROM notifications'),
          runSafeQuery('SELECT * FROM timecards'),
          runSafeQuery('SELECT * FROM it_settled_payrolls'),
          runSafeQuery('SELECT * FROM pcu_files')
        ];

        console.log(`[PERFORMANCE] Initiating fetch for 16 tables concurrently...`);
        const [
          [userRows],
          [settingsRows],
          [barangayRows],
          [purokRows],
          [householdRows],
          [memberRows],
          [dependentRows],
          [pmrfDependentRows],
          [groupRows],
          [payrollRows],
          [healthRows],
          [logRows],
          [notRows],
          [timecardRows],
          [itPayrollRows],
          [pcuRows]
        ] = (await Promise.all(queries)) as any;
        console.log(`[PERFORMANCE] Parallel fetch completed of all tables.`);

        // A. Users
        const users: User[] = (userRows as any[]).map((u: any) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          password: u.password,
          position: u.position,
          address: u.address || '',
          groupAssigned: u.groupAssigned || null,
          status: u.status,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt || undefined,
          profilePicture: u.profilePicture || undefined,
          contactNumber: u.contactNumber || undefined,
          dailyRate: u.dailyRate !== undefined && u.dailyRate !== null ? parseFloat(u.dailyRate) : undefined
        }));

        // Always guarantee that our primary requested administrator accounts are seeded and approved inside MySQL
        const adminEmails = ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'];
        for (const adminEmail of adminEmails) {
          const hasAdmin = users.some(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
          if (!hasAdmin) {
            const isPrimary = adminEmail === 'elthrone1233@gmail.com';
            const adminUser: User = {
              id: isPrimary ? 'usr_admin' : 'usr_admin2',
              fullName: isPrimary ? 'System Admin' : 'Saint Francis Admin',
              email: adminEmail,
              password: 'rakionista021994',
              position: 'ADMIN',
              address: 'San Francisco',
              groupAssigned: null,
              status: 'Approved',
              createdAt: new Date().toISOString()
            };
            users.push(adminUser);
            
            try {
              await connection.query(
                `INSERT INTO users (id, fullName, email, password, position, address, groupAssigned, status, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE fullName=VALUES(fullName), password=VALUES(password), position=VALUES(position), status=VALUES(status)`,
                [
                  adminUser.id, adminUser.fullName, adminUser.email, adminUser.password, 
                  adminUser.position, adminUser.address, adminUser.groupAssigned, 
                  adminUser.status, adminUser.createdAt
                ]
              );
              console.log(`🛡️ Auto-seeded administrator ${adminEmail} directly into MySQL because it was missing.`);
            } catch (err: any) {
              console.error(`Failed to write auto-seeded admin (${adminEmail}) into MySQL:`, err.message);
            }
          }
        }

        // B. Site Settings
        let settings = state.settings;
        if ((settingsRows as any[]).length > 0) {
          const s = (settingsRows as any[])[0];
          settings = {
            faviconLogo: s.faviconLogo,
            faviconTitle: s.faviconTitle,
            websiteTitle: s.websiteTitle,
            websiteLogo: s.websiteLogo,
            seoTitle: s.seoTitle || '',
            seoDescription: s.seoDescription || '',
            seoKeywords: s.seoKeywords || '',
            squadDeleteAction: s.squadDeleteAction || 'ARCHIVE',
            userPagePermissions: (() => {
              try {
                return s.userPagePermissions ? JSON.parse(s.userPagePermissions) : undefined;
              } catch (e) {
                return undefined;
              }
            })()
          };
        }

        // C. Barangays
        const barangays = (barangayRows as any[]).map((b: any) => ({
          id: b.id,
          name: b.name,
          puroksCount: b.puroksCount ?? 0,
          yakapWillingCount: b.yakapWillingCount ?? 0,
          householdProgressBar: b.householdProgressBar ?? 0,
          membersProgressBar: b.membersProgressBar ?? 0,
          pmrfProgressBar: b.pmrfProgressBar ?? 0
        }));

        // D. Puroks
        const puroks = (purokRows as any[]).map((p: any) => ({
          id: p.id,
          name: p.name,
          barangay: p.barangay,
          barangay_id: p.barangay_id ?? null,
          householdCount: p.householdCount ?? 0,
          memberCount: p.memberCount ?? 0,
          pmrfCount: p.pmrfCount ?? 0,
          yakapWillingCount: p.yakapWillingCount ?? 0
        }));

        // E. Households Registry
        const households = (householdRows as any[]).map((h: any) => {
          let attachmentsArr: string[] = [];
          try {
            attachmentsArr = h.attachments ? JSON.parse(h.attachments) : [];
          } catch (e) {
            attachmentsArr = [];
          }

          let pmrfDetailsObj: any = undefined;
          if (h.pmrfDetails) {
            try { pmrfDetailsObj = JSON.parse(h.pmrfDetails); } catch (e) {}
          }

          let fpeDetailsObj: any = undefined;
          if (h.fpeDetails) {
            try { fpeDetailsObj = JSON.parse(h.fpeDetails); } catch (e) {}
          }

          let pcsfDetailsObj: any = undefined;
          if (h.pcsfDetails) {
            try { pcsfDetailsObj = JSON.parse(h.pcsfDetails); } catch (e) {}
          }

          return {
            id: h.id,
            householdNumber: h.householdNumber,
            householdHead: h.householdHead,
            contactNumber: h.contactNumber || '',
            completeAddress: h.completeAddress || '',
            barangay: h.barangay,
            purok: h.purok,
            latitude: h.latitude !== null && h.latitude !== undefined ? parseFloat(h.latitude.toString()) : undefined,
            longitude: h.longitude !== null && h.longitude !== undefined ? parseFloat(h.longitude.toString()) : undefined,
            pmrfStatus: h.pmrfStatus || 'Pending',
            yakapWillingStatus: h.yakapWillingStatus || 'Pending',
            approvalStatus: h.approvalStatus || 'Pending',
            attachments: attachmentsArr,
            remarks: h.remarks || undefined,
            pmrfDetails: pmrfDetailsObj,
            fpeDetails: fpeDetailsObj,
            pcsfDetails: pcsfDetailsObj,
            createdBy: h.createdBy,
            updatedBy: h.updatedBy || undefined,
            createdAt: h.createdAt,
            updatedAt: h.updatedAt || undefined,
            deletedBy: h.deletedBy || undefined,
            deletedAt: h.deletedAt || undefined,
            submittedByAccountId: h.submittedByAccountId || undefined,
            submittedByUsername: h.submittedByUsername || undefined,
            dateSubmitted: h.dateSubmitted || undefined,
            submissionReferenceNumber: h.submissionReferenceNumber || undefined,
            isFpePcsfOnly: h.isFpePcsfOnly === 1 || h.isFpePcsfOnly === true || false,
            isNewMemberFpe: h.isNewMemberFpe === 1 || h.isNewMemberFpe === true || false,
            approvedBy: h.approvedBy || undefined,
            approvalDate: h.approvalDate || undefined,
            disapprovedBy: h.disapprovedBy || undefined,
            disapprovalRemarks: h.disapprovalRemarks || undefined,
            resubmissionHistory: (() => {
              if (!h.resubmissionHistory) return [];
              try {
                return JSON.parse(h.resubmissionHistory);
              } catch (e) {
                return [];
              }
            })()
          };
        });

        // F. Household Members
        const householdMembers = (memberRows as any[]).map((m: any) => ({
          id: getVal(m, 'id'),
          householdId: getVal(m, 'householdId', 'household_id', 'householdid'),
          firstName: getVal(m, 'firstName', 'first_name', 'firstname'),
          middleName: getVal(m, 'middleName', 'middle_name', 'middlename') || '',
          lastName: getVal(m, 'lastName', 'last_name', 'lastname'),
          gender: getVal(m, 'gender', 'sex'),
          birthdate: getVal(m, 'birthdate', 'birthDate', 'date_of_birth'),
          age: getVal(m, 'age'),
          civilStatus: getVal(m, 'civilStatus', 'civilstatus', 'civil_status'),
          occupation: getVal(m, 'occupation') || '',
          relationship: getVal(m, 'relationship')
        }));

        // G. Dependents

        // Merge rows from both dependents and pmrf_dependents by unique ID
        const combinedDependentRows = [...(dependentRows as any[])];
        pmrfDependentRows.forEach((pRow: any) => {
          const pmrfId = getVal(pRow, 'id');
          if (!combinedDependentRows.some(dRow => getVal(dRow, 'id') === pmrfId)) {
            // Map keys back to expected structure
            combinedDependentRows.push({
              id: pmrfId,
              householdId: getVal(pRow, 'pmrf_id', 'pmrfRecordId', 'pmrf_record_id', 'householdId', 'household_id', 'householdid'),
              fullName: getVal(pRow, 'fullName', 'fullname') || `${getVal(pRow, 'last_name') || ''}, ${getVal(pRow, 'first_name') || ''}${getVal(pRow, 'name_ext') ? ' ' + getVal(pRow, 'name_ext') : ''}`.trim().toUpperCase(),
              gender: getVal(pRow, 'sex', 'gender') || 'Female',
              age: getVal(pRow, 'age'),
              relationship: getVal(pRow, 'relationship'),
              birthDate: getVal(pRow, 'date_of_birth', 'birthDate', 'birthdate'),
              birthdate: getVal(pRow, 'date_of_birth', 'birthDate', 'birthdate'),
              civilStatus: getVal(pRow, 'civilStatus', 'civilstatus'),
              lastName: getVal(pRow, 'last_name', 'lastName'),
              firstName: getVal(pRow, 'first_name', 'firstName'),
              middleName: getVal(pRow, 'middle_name', 'middleName'),
              nameExt: getVal(pRow, 'name_ext', 'nameExt'),
              noMiddleName: getVal(pRow, 'no_mn', 'noMiddleName') === 1 || getVal(pRow, 'noMiddleName') === true,
              mononym: getVal(pRow, 'mononym') === 1 || getVal(pRow, 'mononym') === true,
              citizenship: getVal(pRow, 'citizenship') || 'FILIPINO',
              isDisabled: getVal(pRow, 'isDisabled', 'isdisabled') === 1 || getVal(pRow, 'isDisabled') === true,
              pmrfSubmissionId: getVal(pRow, 'submission_id', 'pmrfSubmissionId'),
              pmrfRecordId: getVal(pRow, 'pmrf_id', 'pmrfRecordId'),
              memberPin: getVal(pRow, 'memberPin', 'memberpin'),
              submittedByAccountId: getVal(pRow, 'submittedByAccountId', 'submittedbyaccountid'),
              createdAt: getVal(pRow, 'createdAt', 'createdat'),
              sex: getVal(pRow, 'sex', 'gender') || 'Female',
              pswd: getVal(pRow, 'pswd') === 1 || getVal(pRow, 'pswd') === true,
              last_name: getVal(pRow, 'last_name'),
              first_name: getVal(pRow, 'first_name'),
              middle_name: getVal(pRow, 'middle_name'),
              name_ext: getVal(pRow, 'name_ext'),
              date_of_birth: getVal(pRow, 'date_of_birth'),
              no_mn: getVal(pRow, 'no_mn')
            });
          }
        });

        const dependents = combinedDependentRows.map((d: any) => {
          const ln = getVal(d, 'last_name', 'lastName');
          const fn = getVal(d, 'first_name', 'firstName');
          const mn = getVal(d, 'middle_name', 'middleName');
          const ext = getVal(d, 'name_ext', 'nameExt');
          const dob = getVal(d, 'date_of_birth', 'birthDate', 'birthdate');
          const noMnVal = getVal(d, 'no_mn', 'noMiddleName');

          const computedFullName = getVal(d, 'fullName', 'fullname') || `${ln || ''}, ${fn || ''}${ext ? ' ' + ext : ''}`.trim().toUpperCase();

          return {
            id: getVal(d, 'id'),
            householdId: getVal(d, 'householdId', 'household_id', 'householdid', 'pmrf_id', 'pmrfRecordId'),
            fullName: computedFullName,
            gender: getVal(d, 'gender', 'sex') || 'Female',
            age: getVal(d, 'age') !== undefined && getVal(d, 'age') !== null ? parseInt(getVal(d, 'age') as any) : 0,
            relationship: getVal(d, 'relationship') || 'Child',
            birthDate: dob || '',
            birthdate: dob || '',
            civilStatus: getVal(d, 'civilStatus', 'civilstatus') || 'Single',
            lastName: ln || '',
            firstName: fn || '',
            middleName: mn || '',
            nameExt: ext || '',
            noMiddleName: noMnVal === 1 || noMnVal === true,
            mononym: getVal(d, 'mononym') === 1 || getVal(d, 'mononym') === true,
            citizenship: getVal(d, 'citizenship') || 'FILIPINO',
            isDisabled: getVal(d, 'isDisabled', 'isdisabled') === 1 || getVal(d, 'isDisabled') === true,
            pmrfSubmissionId: getVal(d, 'pmrfSubmissionId', 'submission_id') || null,
            pmrfRecordId: getVal(d, 'pmrfRecordId', 'pmrf_id') || null,
            memberPin: getVal(d, 'memberPin') || null,
            submittedByAccountId: getVal(d, 'submittedByAccountId') || null,
            createdAt: getVal(d, 'createdAt') || null,
            sex: getVal(d, 'sex', 'gender') || 'Female',
            pswd: getVal(d, 'pswd') === 1 || getVal(d, 'pswd') === true,
            last_name: ln || '',
            first_name: fn || '',
            middle_name: mn || '',
            name_ext: ext || '',
            date_of_birth: dob || '',
            no_mn: noMnVal === 1 || noMnVal === true ? 1 : 0
          };
        });

        // H. Groups
        const groups = (groupRows as any[]).map((g: any) => {
          let coLeadersArr: string[] = [];
          try {
            coLeadersArr = g.coLeaders ? JSON.parse(g.coLeaders) : [];
          } catch (e) {}

          let barArr: string[] = [];
          try {
            barArr = g.assignedBarangays ? JSON.parse(g.assignedBarangays) : [];
          } catch (e) {}

          return {
            id: g.id,
            name: g.name,
            leader: g.leader,
            coLeaders: coLeadersArr,
            assignedBarangays: barArr,
            ratePerPerson: g.ratePerPerson !== null ? parseFloat(g.ratePerPerson.toString()) : 0,
            isArchived: g.isArchived === 1,
            barangayFolderId: g.barangayFolderId || null,
            createdAt: g.createdAt || null,
            status: g.status || 'Pending'
          };
        });

        // I. Paid Payrolls
        const paidPayrolls = (payrollRows as any[]).map((p: any) => ({
          id: p.id,
          groupName: p.groupName,
          dateRange: p.dateRange,
          populationCount: p.populationCount ?? 0,
          ratePerPerson: p.ratePerPerson !== null ? parseFloat(p.ratePerPerson.toString()) : 0,
          totalAmountPaid: p.totalAmountPaid !== null ? parseFloat(p.totalAmountPaid.toString()) : 0,
          paidDate: p.paidDate,
          settledBy: p.settledBy,
          remarks: p.remarks || undefined
        }));

        // J. Health Records
        const healthRecords = (healthRows as any[]).map((h: any) => ({
          id: h.id,
          patientName: h.patientName,
          householdId: h.householdId,
          householdHead: h.householdHead,
          barangay: h.barangay,
          diagnosis: h.diagnosis,
          treatment: h.treatment || '',
          medications: h.medications || '',
          notes: h.notes || '',
          date: h.date
        }));

        // K. Logs
        const activityLogs = (logRows as any[]).map((l: any) => ({
          id: l.id,
          user: l.user,
          action: l.action,
          module: l.module,
          date: l.date,
          time: l.time
        }));

        // L. Notifications
        const notifications = (notRows as any[]).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type || 'INFO',
          read: n.is_read === 1,
          createdAt: n.createdAt
        }));

        // M. Timecards
        const timecards = (timecardRows as any[]).map((t: any) => ({
          id: t.id,
          userId: t.userId,
          userEmail: t.userEmail,
          userName: t.userName,
          type: t.type,
          timestamp: t.timestamp,
          photo: t.photo,
          latitude: t.latitude !== null && t.latitude !== undefined ? parseFloat(t.latitude.toString()) : undefined,
          longitude: t.longitude !== null && t.longitude !== undefined ? parseFloat(t.longitude.toString()) : undefined,
          deviceInfo: t.deviceInfo || undefined,
          settled: t.settled === 1,
          settlementId: t.settlementId || null,
          isOvertime: t.isOvertime === 1,
          otHours: t.otHours !== null && t.otHours !== undefined ? parseFloat(t.otHours.toString()) : undefined
        }));

        // N. IT Settled Payrolls
        let itSettledPayrolls: any[] = [];
        try {
          itSettledPayrolls = (itPayrollRows as any[]).map((itUrl: any) => {
            let bdownObj: any[] = [];
            if (itUrl.breakdown) {
              try { bdownObj = JSON.parse(itUrl.breakdown); } catch (e) {}
            }
            return {
              id: itUrl.id,
              userId: itUrl.userId,
              userEmail: itUrl.userEmail,
              userName: itUrl.userName,
              dailyRate: itUrl.dailyRate !== null ? parseFloat(itUrl.dailyRate.toString()) : 440,
              dateRange: itUrl.dateRange,
              daysPresent: itUrl.daysPresent ?? 0,
              daysAbsent: itUrl.daysAbsent ?? 0,
              totalLateMinutes: itUrl.totalLateMinutes ?? 0,
              totalDeductions: itUrl.totalDeductions !== null ? parseFloat(itUrl.totalDeductions.toString()) : 0,
              totalEarned: itUrl.totalEarned !== null ? parseFloat(itUrl.totalEarned.toString()) : 0,
              paidDate: itUrl.paidDate,
              settledBy: itUrl.settledBy,
              remarks: itUrl.remarks || '',
              breakdown: bdownObj
            };
          });
        } catch (e: any) {
          console.warn('⚠️ Missing or corrupt it_settled_payrolls database table loaded fallback:', e.message);
        }

        // O. PCU Files
        let pcuFiles: any[] = [];
        try {
          pcuFiles = (pcuRows as any[]).map((pcu: any) => ({
            id: pcu.id,
            fullName: pcu.fullName,
            birthday: pcu.birthday,
            fileName: pcu.fileName,
            fileData: pcu.fileData,
            uploadDate: pcu.uploadDate,
            uploadedBy: pcu.uploadedBy
          }));
        } catch (e: any) {
          console.warn('⚠️ Missing or corrupt pcu_files database table loaded fallback:', e.message);
        }

        // Check if the loaded MySQL state is completely empty
        const isMySQLCurrentlyEmpty = 
          (users.length === 0 || (users.length === 1 && users[0].email === 'elthrone1233@gmail.com')) &&
          barangays.length === 0 &&
          puroks.length === 0 &&
          households.length === 0 &&
          healthRecords.length === 0;

        // Check if the local state loaded on boot has actual user registrations, barangays, or records
        const hasLocalDataToSeed = 
          state && (
            (state.barangays && state.barangays.length > 0) ||
            (state.puroks && state.puroks.length > 0) ||
            (state.households && state.households.length > 0) ||
            (state.healthRecords && state.healthRecords.length > 0) ||
            (state.users && state.users.filter(u => u.email !== 'elthrone1233@gmail.com').length > 0)
          );

        if (isMySQLCurrentlyEmpty && hasLocalDataToSeed) {
          console.warn('[Database System Safeguard] Connected to MySQL but it is COMPLETELY EMPTY. Local JSON database has data. Overriding empty MySQL with local data to seed remote database and prevent data loss.');
          this.hasLoadedFromMySQLSuccessfully = true;
          // Trigger save which will push local state to MySQL
          this.save();
        } else {
          this.state = {
            users,
            settings,
            barangays,
            puroks,
            households,
            householdMembers,
            dependents,
            groups,
            paidPayrolls,
            healthRecords,
            activityLogs,
            notifications,
            timecards,
            itSettledPayrolls: itSettledPayrolls.length > 0 ? itSettledPayrolls : (state.itSettledPayrolls || []),
            pcuFiles: pcuFiles.length > 0 ? pcuFiles : (state.pcuFiles || [])
          };
          this.hasLoadedFromMySQLSuccessfully = true;
          this.populateAllSignatures();
        }
        markMySQLSuccess();
      } finally {
        connection.release();
      }
        this.lastLoadTime = Date.now();
      } catch (err: any) {
        markMySQLFailure();
        console.info('MySQL load query failed (falling back silently to local state):', err.message);
      } finally {
        this.loadingPromise = null;
      }

      this.runMigrations();
      return this.state!;
  }

  public static async save(): Promise<void> {
    if (!this.state) return;

    const hasMySQL = shouldAttemptMySQL();

    // Always perform local file system writes as an automatic redundant local backup.
    // This ensures that the local data is always kept completely in sync and the server
    // remains fully available/resilient for local exports, offline mode, and failover/backups.
    ensureDataFolder();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf8');
      this.lastLocalLoadTime = Date.now();
      if (!hasMySQL) {
        this.lastLoadTime = Date.now();
      }
      console.log('💾 Automatic JSON backup saved successfully to local file system.');
    } catch (err: any) {
      console.warn('Local file write fallback/backup rejected:', err.message);
    }

    if (hasMySQL) {
      if (!this.hasLoadedFromMySQLSuccessfully) {
        console.warn('[Database System Safeguard] Refusing to sync current memory state to MySQL because we have not successfully completed a read/load query from MySQL yet. Preventing accidental database table overwrites/wipes.');
        return;
      }
      const pool = getMySQLPool();
      if (pool) {
        try {
          await this.syncAllToMySQL(pool);
          this.lastLoadTime = Date.now();
        } catch (err: any) {
          markMySQLFailure();
          console.info('MySQL direct sync failed:', err.message);
        }
      }
    }
  }

  public static async syncAllToMySQL(pool: any): Promise<void> {
    if (!this.state) return;
    const connection = await pool.getConnection();
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      // 1. Site Settings (Always tiny, so upsert in place)
      const s = this.state.settings;
      if (s) {
        await connection.query(
          `INSERT INTO site_settings (id, faviconLogo, faviconTitle, websiteTitle, websiteLogo, seoTitle, seoDescription, seoKeywords, squadDeleteAction, userPagePermissions) 
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             faviconLogo=VALUES(faviconLogo), faviconTitle=VALUES(faviconTitle), websiteTitle=VALUES(websiteTitle), 
             websiteLogo=VALUES(websiteLogo), seoTitle=VALUES(seoTitle), seoDescription=VALUES(seoDescription), 
             seoKeywords=VALUES(seoKeywords), squadDeleteAction=VALUES(squadDeleteAction), userPagePermissions=VALUES(userPagePermissions)`,
          [
            s.faviconLogo, 
            s.faviconTitle, 
            s.websiteTitle, 
            s.websiteLogo, 
            s.seoTitle || '', 
            s.seoDescription || '', 
            s.seoKeywords || '', 
            s.squadDeleteAction || 'ARCHIVE',
            s.userPagePermissions ? JSON.stringify(s.userPagePermissions) : null
          ]
        );
      }

      // Helper function to sync any key-based map cleanly and track row deltas
      const syncTable = async (
        stateKey: keyof DBState,
        dbTableName: string,
        itemUpsertExecutor: (item: any) => Promise<void>
      ) => {
        const prevSigs = this.lastSyncedSignatures.get(dbTableName) || new Map<string, string>();
        const nextSigs = new Map<string, string>();
        const currentList = (this.state![stateKey] || []) as any[];
        
        // Match Deletions
        const currentIds = new Set(currentList.map(item => item.id));
        const deletedIds: string[] = [];
        for (const oldId of prevSigs.keys()) {
          if (!currentIds.has(oldId)) {
            deletedIds.push(oldId);
          }
        }
        
        if (deletedIds.length > 0) {
          // Chunk deletion safely in SQL if there are many rows
          await connection.query(`DELETE FROM ${dbTableName} WHERE id IN (?)`, [deletedIds]);
        }

        // Apply inserts or edits ONLY if key signature has changed
        for (const item of currentList) {
          const sig = this.getRecordSignature(dbTableName, item);
          nextSigs.set(item.id, sig);
          
          if (prevSigs.get(item.id) !== sig) {
            await itemUpsertExecutor(item);
          }
        }
        this.lastSyncedSignatures.set(dbTableName, nextSigs);
      };

      // 2. Users sync
      await syncTable('users', 'users', async (u) => {
        await connection.query(
          `INSERT INTO users (id, fullName, email, password, position, address, groupAssigned, status, createdAt, updatedAt, profilePicture, contactNumber, dailyRate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             fullName=VALUES(fullName), email=VALUES(email), password=VALUES(password), position=VALUES(position), 
             address=VALUES(address), groupAssigned=VALUES(groupAssigned), status=VALUES(status), updatedAt=VALUES(updatedAt), profilePicture=VALUES(profilePicture), contactNumber=VALUES(contactNumber), dailyRate=VALUES(dailyRate)`,
          [
            u.id, u.fullName, u.email, u.password, u.position, u.address || null, u.groupAssigned || null, 
            u.status || 'Pending Approval', u.createdAt, u.updatedAt || null, u.profilePicture || null, 
            u.contactNumber || null, u.dailyRate !== undefined && u.dailyRate !== null ? u.dailyRate : null
          ]
        );
      });

      // 3. Barangays sync
      await syncTable('barangays', 'barangays', async (b) => {
        await connection.query(
          `INSERT INTO barangays (id, name, puroksCount, yakapWillingCount, householdProgressBar, membersProgressBar, pmrfProgressBar)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), puroksCount=VALUES(puroksCount), yakapWillingCount=VALUES(yakapWillingCount), 
             householdProgressBar=VALUES(householdProgressBar), membersProgressBar=VALUES(membersProgressBar), pmrfProgressBar=VALUES(pmrfProgressBar)`,
          [b.id, b.name, b.puroksCount ?? 0, b.yakapWillingCount ?? 0, b.householdProgressBar ?? 0, b.membersProgressBar ?? 0, b.pmrfProgressBar ?? 0]
        );
      });

      // 4. Puroks sync
      await syncTable('puroks', 'puroks', async (p) => {
        const db = this.getData();
        const parentBrg = db.barangays.find(b => b.name === p.barangay);
        const bId = p.barangay_id || parentBrg?.id || null;

        await connection.query(
          `INSERT INTO puroks (id, name, barangay, barangay_id, householdCount, memberCount, pmrfCount, yakapWillingCount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), barangay=VALUES(barangay), barangay_id=VALUES(barangay_id), 
             householdCount=VALUES(householdCount), memberCount=VALUES(memberCount), pmrfCount=VALUES(pmrfCount), 
             yakapWillingCount=VALUES(yakapWillingCount)`,
          [p.id, p.name, p.barangay, bId, p.householdCount ?? 0, p.memberCount ?? 0, p.pmrfCount ?? 0, p.yakapWillingCount ?? 0]
        );
      });

      // 5. Households sync (Contains complex files/signatures, so this optimization is highly critical!)
      await syncTable('households', 'households', async (h) => {
        const attachmentsJson = JSON.stringify(h.attachments || []);
        const pmrfJson = h.pmrfDetails ? JSON.stringify(h.pmrfDetails) : null;
        const fpeJson = h.fpeDetails ? JSON.stringify(h.fpeDetails) : null;
        const pcsfJson = h.pcsfDetails ? JSON.stringify(h.pcsfDetails) : null;
        const resubmissionJson = JSON.stringify(h.resubmissionHistory || []);

        await connection.query(
          `INSERT INTO households (
            id, householdNumber, householdHead, contactNumber, completeAddress, barangay, purok, 
            latitude, longitude, pmrfStatus, yakapWillingStatus, approvalStatus, attachments, remarks, 
            pmrfDetails, fpeDetails, pcsfDetails, createdBy, updatedBy, createdAt, updatedAt, deletedBy, deletedAt,
            submittedByAccountId, submittedByUsername, dateSubmitted, submissionReferenceNumber,
            isFpePcsfOnly, isNewMemberFpe, approvedBy, approvalDate, disapprovedBy, disapprovalRemarks, resubmissionHistory
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            householdNumber=VALUES(householdNumber), householdHead=VALUES(householdHead), contactNumber=VALUES(contactNumber), 
            completeAddress=VALUES(completeAddress), barangay=VALUES(barangay), purok=VALUES(purok), 
            latitude=VALUES(latitude), longitude=VALUES(longitude), pmrfStatus=VALUES(pmrfStatus), 
            yakapWillingStatus=VALUES(yakapWillingStatus), approvalStatus=VALUES(approvalStatus), attachments=VALUES(attachments), 
            remarks=VALUES(remarks), pmrfDetails=VALUES(pmrfDetails), fpeDetails=VALUES(fpeDetails), pcsfDetails=VALUES(pcsfDetails), 
            createdBy=VALUES(createdBy), updatedBy=VALUES(updatedBy), createdAt=VALUES(createdAt), 
            updatedAt=VALUES(updatedAt), deletedBy=VALUES(deletedBy), deletedAt=VALUES(deletedAt),
            submittedByAccountId=VALUES(submittedByAccountId), submittedByUsername=VALUES(submittedByUsername),
            dateSubmitted=VALUES(dateSubmitted), submissionReferenceNumber=VALUES(submissionReferenceNumber),
            isFpePcsfOnly=VALUES(isFpePcsfOnly), isNewMemberFpe=VALUES(isNewMemberFpe), approvedBy=VALUES(approvedBy), approvalDate=VALUES(approvalDate),
            disapprovedBy=VALUES(disapprovedBy), disapprovalRemarks=VALUES(disapprovalRemarks), resubmissionHistory=VALUES(resubmissionHistory)`,
          [
            h.id, h.householdNumber, h.householdHead, h.contactNumber || null, h.completeAddress || null, h.barangay, h.purok,
            h.latitude !== undefined && h.latitude !== null ? h.latitude : null, h.longitude !== undefined && h.longitude !== null ? h.longitude : null, 
            h.pmrfStatus || 'Pending', h.yakapWillingStatus || 'Pending', h.approvalStatus || 'Pending', 
            attachmentsJson, h.remarks || null, pmrfJson, fpeJson, pcsfJson, h.createdBy, h.updatedBy || null, 
            h.createdAt, h.updatedAt || null, h.deletedBy || null, h.deletedAt || null,
            h.submittedByAccountId || null, h.submittedByUsername || null, h.dateSubmitted || null, h.submissionReferenceNumber || null,
            h.isFpePcsfOnly ? 1 : 0, h.isNewMemberFpe ? 1 : 0, h.approvedBy || null, h.approvalDate || null, h.disapprovedBy || null, h.disapprovalRemarks || null, resubmissionJson
          ]
        );
      });

      // 6. Household Members sync
      await syncTable('householdMembers', 'household_members', async (m) => {
        await connection.query(
          `INSERT INTO household_members (id, householdId, firstName, middleName, lastName, gender, birthdate, age, civilStatus, occupation, relationship)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE householdId=VALUES(householdId), firstName=VALUES(firstName), middleName=VALUES(middleName), 
             lastName=VALUES(lastName), gender=VALUES(gender), birthdate=VALUES(birthdate), age=VALUES(age), 
             civilStatus=VALUES(civilStatus), occupation=VALUES(occupation), relationship=VALUES(relationship)`,
          [m.id, m.householdId, m.firstName, m.middleName || null, m.lastName, m.gender, m.birthdate, m.age, m.civilStatus, m.occupation || null, m.relationship]
        );
      });

      // 7. Dependents sync
      await syncTable('dependents', 'dependents', async (d) => {
        // First sync to dependents table
        await connection.query(
          `INSERT INTO dependents (
            id, householdId, last_name, first_name, middle_name, name_ext, relationship, 
            date_of_birth, sex, citizenship, no_mn, mononym, pswd, gender, age, 
            civilStatus, isDisabled, pmrfSubmissionId, pmrfRecordId, memberPin, 
            submittedByAccountId, createdAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            householdId=VALUES(householdId), last_name=VALUES(last_name), first_name=VALUES(first_name), 
            middle_name=VALUES(middle_name), name_ext=VALUES(name_ext), relationship=VALUES(relationship), 
            date_of_birth=VALUES(date_of_birth), sex=VALUES(sex), citizenship=VALUES(citizenship), 
            no_mn=VALUES(no_mn), mononym=VALUES(mononym), pswd=VALUES(pswd), gender=VALUES(gender), 
            age=VALUES(age), civilStatus=VALUES(civilStatus), isDisabled=VALUES(isDisabled),
            pmrfSubmissionId=VALUES(pmrfSubmissionId), pmrfRecordId=VALUES(pmrfRecordId),
            memberPin=VALUES(memberPin), submittedByAccountId=VALUES(submittedByAccountId),
            createdAt=VALUES(createdAt)`,
          [
            d.id,
            d.householdId,
            d.lastName || d.last_name || null,
            d.firstName || d.first_name || null,
            d.middleName || d.middle_name || null,
            d.nameExt || d.name_ext || null,
            d.relationship,
            d.birthDate || d.birthdate || d.date_of_birth || null,
            d.sex || d.gender || null,
            d.citizenship || null,
            d.noMiddleName || d.no_mn ? 1 : 0,
            d.mononym ? 1 : 0,
            d.pswd !== undefined ? (d.pswd ? 1 : 0) : (d.isDisabled ? 1 : 0),
            d.gender || d.sex || 'Female',
            d.age !== undefined && d.age !== null ? parseInt(d.age as any) : null,
            d.civilStatus || null,
            d.isDisabled ? 1 : 0,
            d.pmrfSubmissionId || null,
            d.pmrfRecordId || null,
            d.memberPin || null,
            d.submittedByAccountId || null,
            d.createdAt || null
          ]
        );

        // Also sync to pmrf_dependents table to guarantee alignment
        try {
          await connection.query(
            `INSERT INTO pmrf_dependents (
              id, pmrf_id, submission_id, last_name, first_name, middle_name, name_ext, relationship,
              date_of_birth, sex, citizenship, no_mn, mononym, pswd, age, civilStatus, isDisabled,
              pmrfSubmissionId, pmrfRecordId, memberPin, submittedByAccountId, createdAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              pmrf_id=VALUES(pmrf_id), submission_id=VALUES(submission_id), last_name=VALUES(last_name), first_name=VALUES(first_name), 
              middle_name=VALUES(middle_name), name_ext=VALUES(name_ext), relationship=VALUES(relationship), 
              date_of_birth=VALUES(date_of_birth), sex=VALUES(sex), citizenship=VALUES(citizenship), 
              no_mn=VALUES(no_mn), mononym=VALUES(mononym), pswd=VALUES(pswd), age=VALUES(age), 
              civilStatus=VALUES(civilStatus), isDisabled=VALUES(isDisabled),
              pmrfSubmissionId=VALUES(pmrfSubmissionId), pmrfRecordId=VALUES(pmrfRecordId),
              memberPin=VALUES(memberPin), submittedByAccountId=VALUES(submittedByAccountId),
              createdAt=VALUES(createdAt)`,
            [
              d.id,
              d.householdId, // pmrf_id
              d.pmrfSubmissionId || d.submission_id || null, // submission_id
              d.lastName || d.last_name || null,
              d.firstName || d.first_name || null,
              d.middleName || d.middle_name || null,
              d.nameExt || d.name_ext || null,
              d.relationship,
              d.birthDate || d.birthdate || d.date_of_birth || null,
              d.sex || d.gender || 'Female',
              d.citizenship || null,
              d.noMiddleName || d.no_mn ? 1 : 0,
              d.mononym ? 1 : 0,
              d.pswd !== undefined ? (d.pswd ? 1 : 0) : (d.isDisabled ? 1 : 0),
              d.age !== undefined && d.age !== null ? parseInt(d.age as any) : null,
              d.civilStatus || null,
              d.isDisabled ? 1 : 0,
              d.pmrfSubmissionId || null,
              d.pmrfRecordId || null,
              d.memberPin || null,
              d.submittedByAccountId || null,
              d.createdAt || null
            ]
          );
        } catch (pmrfSyncErr: any) {
          console.error(`[SYNC ERROR] Failed to sync to pmrf_dependents table for ${d.id}:`, pmrfSyncErr);
        }
      });

      // 8. Groups sync
      await syncTable('groups', 'groups', async (g) => {
        await connection.query(
          `INSERT INTO groups (id, name, leader, coLeaders, assignedBarangays, ratePerPerson, isArchived, barangayFolderId, createdAt, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), leader=VALUES(leader), coLeaders=VALUES(coLeaders), 
             assignedBarangays=VALUES(assignedBarangays), ratePerPerson=VALUES(ratePerPerson), isArchived=VALUES(isArchived),
             barangayFolderId=VALUES(barangayFolderId), createdAt=VALUES(createdAt), status=VALUES(status)`,
          [
            g.id, 
            g.name, 
            g.leader, 
            JSON.stringify(g.coLeaders || []), 
            JSON.stringify(g.assignedBarangays || []), 
            g.ratePerPerson ?? 0, 
            g.isArchived ? 1 : 0,
            g.barangayFolderId || null,
            g.createdAt || null,
            g.status || 'Pending'
          ]
        );
      });

      // 9. Paid Payrolls sync
      await syncTable('paidPayrolls', 'paid_payrolls', async (p) => {
        await connection.query(
          `INSERT INTO paid_payrolls (id, groupName, dateRange, populationCount, ratePerPerson, totalAmountPaid, paidDate, settledBy, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE groupName=VALUES(groupName), dateRange=VALUES(dateRange), populationCount=VALUES(populationCount), 
             ratePerPerson=VALUES(ratePerPerson), totalAmountPaid=VALUES(totalAmountPaid), paidDate=VALUES(paidDate), 
             settledBy=VALUES(settledBy), remarks=VALUES(remarks)`,
          [p.id, p.groupName, p.dateRange, p.populationCount ?? 0, p.ratePerPerson ?? 0, p.totalAmountPaid ?? 0, p.paidDate, p.settledBy, p.remarks || null]
        );
      });

      // 10. Health Records sync
      await syncTable('healthRecords', 'health_records', async (hr) => {
        let bloodPressure: string | null = null;
        let heartRate: string | null = null;
        let respRate: string | null = null;
        let temperature: string | null = null;
        let weightKg: string | null = null;
        let heightCm: string | null = null;
        let bmi: string | null = null;

        if (hr.notes) {
          try {
            const parsed = JSON.parse(hr.notes);
            if (parsed.isConsultation && parsed.consultationData && parsed.consultationData.physicalExams) {
              const pe = parsed.consultationData.physicalExams;
              bloodPressure = pe.bloodPressure || null;
              heartRate = pe.heartRate || null;
              respRate = pe.respRate || null;
              temperature = pe.temp || null;
              weightKg = pe.weightKg || null;
              heightCm = pe.heightCm || null;
              bmi = pe.bmi || null;
            }
          } catch (e) {}
        }

        await connection.query(
          `INSERT INTO health_records (
            id, patientName, householdId, householdHead, barangay, diagnosis, treatment, medications, notes, 
            bloodPressure, heartRate, respRate, temperature, weightKg, heightCm, bmi, date
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            patientName=VALUES(patientName), householdId=VALUES(householdId), householdHead=VALUES(householdHead), 
            barangay=VALUES(barangay), diagnosis=VALUES(diagnosis), treatment=VALUES(treatment), medications=VALUES(medications), 
            notes=VALUES(notes), bloodPressure=VALUES(bloodPressure), heartRate=VALUES(heartRate), respRate=VALUES(respRate), 
            temperature=VALUES(temperature), weightKg=VALUES(weightKg), heightCm=VALUES(heightCm), bmi=VALUES(bmi), date=VALUES(date)`,
          [
            hr.id, hr.patientName, hr.householdId, hr.householdHead, hr.barangay, hr.diagnosis, hr.treatment || null, hr.medications || null, hr.notes || null, 
            bloodPressure, heartRate, respRate, temperature, weightKg, heightCm, bmi, hr.date
          ]
        );
      });

      // 11. Activity Logs sync
      await syncTable('activityLogs', 'activity_logs', async (al) => {
        await connection.query(
          `INSERT INTO activity_logs (id, user, action, module, date, time)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE user=VALUES(user), action=VALUES(action), module=VALUES(module), 
             date=VALUES(date), time=VALUES(time)`,
          [al.id, al.user, al.action, al.module, al.date, al.time]
        );
      });

      // 12. Notifications sync
      await syncTable('notifications', 'notifications', async (n) => {
        await connection.query(
          `INSERT INTO notifications (id, title, message, type, is_read, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), message=VALUES(message), type=VALUES(type), 
             is_read=VALUES(is_read), createdAt=VALUES(createdAt)`,
          [n.id, n.title, n.message, n.type || 'INFO', n.read ? 1 : 0, n.createdAt]
        );
      });

      // 13. Timecards sync
      await syncTable('timecards', 'timecards', async (tc) => {
        await connection.query(
          `INSERT INTO timecards (id, userId, userEmail, userName, type, timestamp, photo, latitude, longitude, deviceInfo, settled, settlementId, isOvertime, otHours)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE userId=VALUES(userId), userEmail=VALUES(userEmail), userName=VALUES(userName), 
             type=VALUES(type), timestamp=VALUES(timestamp), photo=VALUES(photo), latitude=VALUES(latitude), 
             longitude=VALUES(longitude), deviceInfo=VALUES(deviceInfo), settled=VALUES(settled), settlementId=VALUES(settlementId),
             isOvertime=VALUES(isOvertime), otHours=VALUES(otHours)`,
          [
            tc.id, tc.userId, tc.userEmail, tc.userName, tc.type, tc.timestamp, tc.photo, 
            tc.latitude !== undefined && tc.latitude !== null ? tc.latitude : null, tc.longitude !== undefined && tc.longitude !== null ? tc.longitude : null, 
            tc.deviceInfo || null, tc.settled ? 1 : 0, tc.settlementId || null,
            tc.isOvertime ? 1 : 0, tc.otHours !== undefined && tc.otHours !== null ? tc.otHours : null
          ]
        );
      });

      // 14. IT Settled Payrolls sync
      await syncTable('itSettledPayrolls', 'it_settled_payrolls', async (itp) => {
        await connection.query(
          `INSERT INTO it_settled_payrolls (id, userId, userEmail, userName, dailyRate, dateRange, daysPresent, daysAbsent, totalLateMinutes, totalDeductions, totalEarned, paidDate, settledBy, remarks, breakdown)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE userId=VALUES(userId), userEmail=VALUES(userEmail), userName=VALUES(userName), dailyRate=VALUES(dailyRate), 
             dateRange=VALUES(dateRange), daysPresent=VALUES(daysPresent), daysAbsent=VALUES(daysAbsent), totalLateMinutes=VALUES(totalLateMinutes), 
             totalDeductions=VALUES(totalDeductions), totalEarned=VALUES(totalEarned), paidDate=VALUES(paidDate), settledBy=VALUES(settledBy), 
             remarks=VALUES(remarks), breakdown=VALUES(breakdown)`,
          [
            itp.id, itp.userId, itp.userEmail, itp.userName, itp.dailyRate ?? 440, itp.dateRange, itp.daysPresent ?? 0, itp.daysAbsent ?? 0,
            itp.totalLateMinutes ?? 0, itp.totalDeductions ?? 0, itp.totalEarned ?? 0, itp.paidDate, itp.settledBy, itp.remarks || '', JSON.stringify(itp.breakdown || [])
          ]
        );
      });

      // 15. PCU Files sync
      await syncTable('pcuFiles', 'pcu_files', async (pcu) => {
        await connection.query(
          `INSERT INTO pcu_files (id, fullName, birthday, fileName, fileData, uploadDate, uploadedBy)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             fullName=VALUES(fullName), birthday=VALUES(birthday), fileName=VALUES(fileName),
             fileData=VALUES(fileData), uploadDate=VALUES(uploadDate), uploadedBy=VALUES(uploadedBy)`,
          [
            pcu.id, pcu.fullName, pcu.birthday, pcu.fileName, pcu.fileData, pcu.uploadDate, pcu.uploadedBy
          ]
        );
      });

      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      markMySQLSuccess();
    } finally {
      connection.release();
    }
  }

  public static runMigrations(): void {
    if (!this.state) return;
    
    // Ensure "SAN PEDRO" barangay exists
    if (!this.state.barangays) this.state.barangays = [];
    const hasSanPedro = this.state.barangays.some(b => b.name === 'SAN PEDRO');
    if (!hasSanPedro) {
      this.state.barangays.push({
        id: `brgy_mig_${Date.now()}_sanpedro`,
        name: 'SAN PEDRO',
        puroksCount: 0,
        yakapWillingCount: 0,
        householdProgressBar: 0,
        membersProgressBar: 0,
        pmrfProgressBar: 0
      });
    }

    // WIPE OUT SAN FRANCISCO / SAN FANCISCO PERMANENTLY AS REQUESTED
    const badNames = ['san francisco', 'san fancisco', 'sanfrancisco', 'sanfancisco', 'san francisco, pagadian city'];
    const isBadBarangay = (str: string | undefined): boolean => {
      if (!str) return false;
      const clean = str.trim().toLowerCase();
      return badNames.includes(clean);
    };

    // Filter out San Francisco from barangays
    this.state.barangays = this.state.barangays.filter(b => !isBadBarangay(b.name));
    
    // Filter out Puroks under San Francisco
    if (this.state.puroks) {
      this.state.puroks = this.state.puroks.filter(p => !isBadBarangay(p.barangay));
    }

    // Migrate or remove households belonging to San Francisco
    if (this.state.households) {
      const seedHHIds = ['hsh_1'];
      this.state.households = this.state.households.filter(h => {
        if (seedHHIds.includes(h.id)) return false;
        if (isBadBarangay(h.barangay)) {
          h.barangay = 'SAN PEDRO';
          h.completeAddress = h.completeAddress ? h.completeAddress.replace(/San Francisco/gi, 'SAN PEDRO') : 'SAN PEDRO';
        }
        return true;
      });
    }

    // Clean up dependent members/children for deleted households
    if (this.state.householdMembers && this.state.households) {
      const activeHHIds = new Set(this.state.households.map(h => h.id));
      this.state.householdMembers = this.state.householdMembers.filter(m => activeHHIds.has(m.householdId));
    }

    if (this.state.dependents && this.state.households) {
      const activeHHIds = new Set(this.state.households.map(h => h.id));
      this.state.dependents = this.state.dependents.filter(d => activeHHIds.has(d.householdId));
    }

    // Clean up health records
    if (this.state.healthRecords) {
      const seedHealthIds = ['med_1', 'med_2'];
      this.state.healthRecords = this.state.healthRecords.filter(hr => {
        if (seedHealthIds.includes(hr.id)) return false;
        if (isBadBarangay(hr.barangay)) {
          hr.barangay = 'SAN PEDRO';
        }
        return true;
      });
    }

    // Clean up group assignedBarangays array
    if (this.state.groups) {
      this.state.groups.forEach(g => {
        if (g.assignedBarangays) {
          g.assignedBarangays = g.assignedBarangays.filter(name => !isBadBarangay(name));
          if (g.assignedBarangays.length === 0) {
            g.assignedBarangays = ['SAN PEDRO'];
          }
        }
      });
    }

    // Clean up user address
    if (this.state.users) {
      this.state.users.forEach(u => {
        if (isBadBarangay(u.address)) {
          u.address = 'SAN PEDRO';
        }
      });
    }

    // Move unassigned groups (the 5 teams or any others) to "SAN PEDRO"
    if (!this.state.groups) this.state.groups = [];
    let migratedCount = 0;
    this.state.groups.forEach(g => {
      if (!g.assignedBarangays || g.assignedBarangays.length === 0 || g.assignedBarangays.includes('Unassigned') || g.assignedBarangays.includes('')) {
        g.assignedBarangays = ['SAN PEDRO'];
        migratedCount++;
      }
    });

    if (migratedCount > 0 || !hasSanPedro) {
      console.log(`[Migration] Configured "SAN PEDRO" folder and moved ${migratedCount} unassigned squads/teams there.`);
      this.save();
    }

    // Backfill household submission metadata to guarantee access control and data validation
    let backfillCount = 0;
    if (this.state.households) {
      this.state.households.forEach(h => {
        let dirty = false;
        if (!h.submittedByUsername) {
          h.submittedByUsername = h.createdBy || 'System Admin';
          dirty = true;
        }
        if (!h.submittedByAccountId) {
          const userObj = this.state.users?.find(u => u.fullName && u.fullName.toLowerCase() === (h.submittedByUsername || '').toLowerCase());
          h.submittedByAccountId = userObj ? userObj.id : 'usr_admin';
          dirty = true;
        }
        if (!h.dateSubmitted) {
          h.dateSubmitted = h.createdAt || new Date().toISOString();
          dirty = true;
        }
        if (!h.submissionReferenceNumber) {
          h.submissionReferenceNumber = h.householdNumber;
          dirty = true;
        }
        if (dirty) {
          backfillCount++;
        }
      });
    }
    if (backfillCount > 0) {
      console.log(`[Migration] Backfilled ${backfillCount} households with submission metadata.`);
      this.save();
    }

    // Real-time automatic routing migration: Route all Households to the folder matching their submitter's Account Residential Area
    let routingMigratedCount = 0;
    if (this.state.households && this.state.users) {
      this.state.households.forEach(h => {
        const submitterId = h.submittedByAccountId;
        if (!submitterId) return;

        const submitter = this.state.users.find(u => u.id === submitterId);
        if (submitter && submitter.address) {
          const correctArea = submitter.address.trim();
          const correctAreaLower = correctArea.toLowerCase();
          const currentBarangayLower = (h.barangay || '').trim().toLowerCase();

          if (correctArea && currentBarangayLower !== correctAreaLower) {
            console.log(`[Household Migration] Routing Household #${h.householdNumber} (${h.householdHead}) to correct Barangay folder "${correctArea}" based on Submitter "${submitter.fullName}"'s Account Residential Area (was in wrong folder "${h.barangay}")`);
            
            // Move/assign to the correct folder/barangay:
            h.barangay = correctArea;
            
            // Also ensure complete address reflects the correct barangay
            if (h.completeAddress) {
              const purokPart = h.purok || 'Purok';
              h.completeAddress = `${purokPart}, ${correctArea}`;
            } else {
              h.completeAddress = `${h.purok || 'Purok'}, ${correctArea}`;
            }

            // Ensure correctArea folder/barangay is represented in db.barangays list so the virtual folders are instantiated
            const brgExists = this.state.barangays.some(b => b.name.toUpperCase() === correctArea.toUpperCase());
            if (!brgExists) {
              this.state.barangays.push({
                id: `brgy_mig_${Date.now()}_${correctArea.replace(/\s+/g, '_').toLowerCase()}`,
                name: correctArea,
                puroksCount: 0,
                yakapWillingCount: 0,
                householdProgressBar: 0,
                membersProgressBar: 0,
                pmrfProgressBar: 0
              });
              console.log(`[Barangay Folders Auto-Created] Created missing destination folder "${correctArea}" during migration.`);
            }

            routingMigratedCount++;
          }
        }
      });
    }

    if (routingMigratedCount > 0) {
      console.log(`[Migration] Automatically routed and moved ${routingMigratedCount} households to their correct submitter Barangay folders.`);
      this.save();
    }
  }

  // Helper log action
  public static log(user: string, action: string, module: string): void {
    const state = this.getData();
    if (!state.activityLogs) {
      state.activityLogs = [];
    }
    if (!state.notifications) {
      state.notifications = [];
    }
    
    const d = new Date();
    const logItem: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      user: user || 'System Admin',
      action,
      module,
      date: d.toISOString().split('T')[0],
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.activityLogs.unshift(logItem);
    
    // Check if we should auto add a notification
    // "on Clinical Action Audit Logs only Approved and Disapproved household will be in real-time server messages and system notifications."
    const isHouseholdRelated = module === 'Households' || module === 'Household Approval' || module === 'Draft Migration' || action.toLowerCase().includes('household');
    const isApprovedOrDisapproved = action.toLowerCase().includes('approved') || action.toLowerCase().includes('disapproved');
    
    if (isHouseholdRelated && !isApprovedOrDisapproved) {
      this.save();
      return;
    }
    
    // Auto add a notification
    const notification: Notification = {
      id: `not_${Date.now()}`,
      title: `${module} Update`,
      message: action,
      type: 'SUCCESS',
      read: false,
      createdAt: d.toISOString()
    };
    state.notifications.unshift(notification);
    
    this.save();
  }
}
