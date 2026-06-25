import dotenv from 'dotenv';
dotenv.config();

import { fileURLToPath } from 'url';
import expressInstance from 'express';
import path from 'path';
import fs from 'fs';

let localFilename = '';
let localDirname = '';
try {
  localFilename = fileURLToPath(import.meta.url);
  localDirname = path.dirname(localFilename);
} catch (e) {
  // Safe fallback if we are in a pure CommonJS container environment where import.meta is missing
  localFilename = typeof (globalThis as any).__filename !== 'undefined' ? (globalThis as any).__filename : '';
  localDirname = typeof (globalThis as any).__dirname !== 'undefined' ? (globalThis as any).__dirname : '';
}
const __filename = localFilename;
const __dirname = localDirname;
import zlib from 'zlib';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { SaintFrancisDB } from './server/db';
import { testMySQLConnection, getMySQLConfig, getMySQLPool, shouldAttemptMySQL, markMySQLFailure } from './server/mysql-connector';
import { 
  User, Household, HouseholdMember, Dependent, 
  Group, PaidPayroll, HealthRecord, SiteSettings 
} from './src/types';

const express = expressInstance;
const app = express();
app.use(compression());
const RAW_PORT = process.env.PORT || '3000';
const isSocket = RAW_PORT.startsWith('/') || RAW_PORT.startsWith('\\') || isNaN(Number(RAW_PORT));
const PORT = isSocket ? RAW_PORT : parseInt(RAW_PORT, 10);

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Global error handler for body-parser / JSON parse errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      error: true,
      message: 'Payload too large. The database backup file size exceeds standard limits. Please import the file located directly on the server instead.'
    });
  }
  if (err && err instanceof SyntaxError && 'status' in err) {
    return res.status(400).json({
      error: true,
      message: 'Malformed JSON payload.'
    });
  }
  next(err);
});

// Initialize simulated DB
SaintFrancisDB.initialize();

// Pre-load DB state from MySQL on every api request to ensure direct live MySQL CRUD
app.use('/api', async (req, res, next) => {
  try {
    await SaintFrancisDB.loadFromDB();
  } catch (err: any) {
    console.info('Pre-loaded database offline fallback option used:', err.message || err);
  }
  next();
});

// Helper to parse JSON fields safely
function ensureParsed(field: any) {
  if (!field) return {};
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return {};
    }
  }
  return field;
}

// HELPER: Generate simple random unique ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// HELPER: Normalize strict fields to prevent ENUM constraint issues on MySQL / cPanel
function normalizeGender(g: any): string {
  if (!g) return 'Female';
  const s = String(g).trim().toLowerCase();
  if (s === 'm' || s === 'male') return 'Male';
  if (s === 'f' || s === 'female') return 'Female';
  return 'Female'; // default fallback for clean database state
}

function normalizeCivilStatus(status: any): string {
  if (!status) return 'Single';
  const s = String(status).trim().toLowerCase();
  if (s.startsWith('marr')) return 'Married';
  if (s.startsWith('wid')) return 'Widowed';
  if (s.startsWith('div')) return 'Divorced';
  return 'Single';
}

function normalizeRelationship(rel: any): string {
  if (!rel) return 'Child';
  const s = String(rel).trim().toLowerCase();
  const titleS = s.charAt(0).toUpperCase() + s.slice(1);
  const valid = ['Head', 'Spouse', 'Child', 'Parent', 'Sibling', 'Relative', 'Other'];
  if (valid.includes(titleS)) return titleS;
  return 'Other';
}

// DATABASE HELPER: Execute atomic transactional updates for Household PMRF, Members, and Dependents
async function saveHouseholdAndDependentsTransaction(
  pool: any,
  household: Household,
  members: HouseholdMember[],
  dependents: any[],
  isEdit: boolean
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (isEdit) {
      console.log(`[TRANSACTION] Editing household. Deleting existing members and dependents for householdId = ${household.id}`);
      await connection.query('DELETE FROM household_members WHERE householdId = ?', [household.id]);
      await connection.query('DELETE FROM dependents WHERE householdId = ?', [household.id]);
      await connection.query('DELETE FROM pmrf_dependents WHERE pmrf_id = ?', [household.id]);
    }

    // Auto-Ensure referenced Barangay exists in MySQL to prevent foreign key violation fk_household_barangay
    if (household.barangay) {
      const bName = household.barangay.trim().toUpperCase();
      const bId = 'brg_' + bName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await connection.query(
        `INSERT INTO barangays (id, name, puroksCount, yakapWillingCount, householdProgressBar, membersProgressBar, pmrfProgressBar)
         VALUES (?, ?, 0, 0, 0, 0, 0)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [bId, bName]
      ).catch((bErr: any) => {
        console.warn(`[TRANSACTION WARNING] Auto-ensuring barangay "${bName}" failed:`, bErr.message);
      });
    }

    // Insert or update household
    const hSql = `
      INSERT INTO households (
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
        disapprovedBy=VALUES(disapprovedBy), disapprovalRemarks=VALUES(disapprovalRemarks), resubmissionHistory=VALUES(resubmissionHistory)
    `;

    const hValues = [
      household.id,
      household.householdNumber,
      household.householdHead,
      household.contactNumber || null,
      household.completeAddress || null,
      household.barangay,
      household.purok,
      household.latitude !== undefined && household.latitude !== null ? parseFloat(household.latitude as any) : 7.828,
      household.longitude !== undefined && household.longitude !== null ? parseFloat(household.longitude as any) : 123.433,
      household.pmrfStatus || 'Pending',
      household.yakapWillingStatus || 'Willing',
      household.approvalStatus || 'Pending',
      typeof household.attachments === 'string' ? household.attachments : JSON.stringify(household.attachments || []),
      household.remarks || null,
      typeof household.pmrfDetails === 'string' ? household.pmrfDetails : JSON.stringify(household.pmrfDetails || {}),
      typeof household.fpeDetails === 'string' ? household.fpeDetails : JSON.stringify(household.fpeDetails || {}),
      typeof household.pcsfDetails === 'string' ? household.pcsfDetails : JSON.stringify(household.pcsfDetails || {}),
      household.createdBy || '',
      household.updatedBy || null,
      household.createdAt,
      household.updatedAt || null,
      household.deletedBy || null,
      household.deletedAt || null,
      household.submittedByAccountId || null,
      household.submittedByUsername || null,
      household.dateSubmitted || null,
      household.submissionReferenceNumber || null,
      household.isFpePcsfOnly ? 1 : 0,
      household.isNewMemberFpe ? 1 : 0,
      (household as any).approvedBy || null,
      (household as any).approvalDate || null,
      (household as any).disapprovedBy || null,
      (household as any).disapprovalRemarks || null,
      JSON.stringify((household as any).resubmissionHistory || [])
    ];

    console.log(`[TRANSACTION] Executing household insert/update...`);
    await connection.query(hSql, hValues);

    // Insert members
    if (members && members.length > 0) {
      console.log(`[TRANSACTION] Executing insert for ${members.length} household members...`);
      const mSql = `
        INSERT INTO household_members (id, householdId, firstName, middleName, lastName, gender, birthdate, age, civilStatus, occupation, relationship)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE householdId=VALUES(householdId), firstName=VALUES(firstName), middleName=VALUES(middleName), 
          lastName=VALUES(lastName), gender=VALUES(gender), birthdate=VALUES(birthdate), age=VALUES(age), 
          civilStatus=VALUES(civilStatus), occupation=VALUES(occupation), relationship=VALUES(relationship)
      `;
      for (const m of members) {
        const mValues = [
          m.id,
          m.householdId,
          m.firstName,
          m.middleName || null,
          m.lastName,
          normalizeGender(m.gender),
          m.birthdate || '1990-01-01',
          m.age !== undefined && m.age !== null ? parseInt(m.age as any) : 30,
          normalizeCivilStatus(m.civilStatus),
          m.occupation || '',
          normalizeRelationship(m.relationship)
        ];
        await connection.query(mSql, mValues);
      }
    }

    // Insert dependents
    if (dependents && dependents.length > 0) {
      console.log(`[TRANSACTION] Executing insert for ${dependents.length} dependents in both dependents & pmrf_dependents...`);
      
      const dSql = `
        INSERT INTO dependents (
          id, householdId, last_name, first_name, middle_name, name_ext, relationship,
          date_of_birth, sex, citizenship, no_mn, mononym, pswd, gender, age, civilStatus, isDisabled,
          pmrfSubmissionId, pmrfRecordId, memberPin, submittedByAccountId, createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          householdId=VALUES(householdId), last_name=VALUES(last_name), first_name=VALUES(first_name), 
          middle_name=VALUES(middle_name), name_ext=VALUES(name_ext), relationship=VALUES(relationship), 
          date_of_birth=VALUES(date_of_birth), sex=VALUES(sex), citizenship=VALUES(citizenship), 
          no_mn=VALUES(no_mn), mononym=VALUES(mononym), pswd=VALUES(pswd), gender=VALUES(gender), age=VALUES(age), 
          civilStatus=VALUES(civilStatus), isDisabled=VALUES(isDisabled),
          pmrfSubmissionId=VALUES(pmrfSubmissionId), pmrfRecordId=VALUES(pmrfRecordId),
          memberPin=VALUES(memberPin), submittedByAccountId=VALUES(submittedByAccountId),
          createdAt=VALUES(createdAt)
      `;

      const pmrfDSql = `
        INSERT INTO pmrf_dependents (
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
          createdAt=VALUES(createdAt)
      `;

      for (const d of dependents) {
        const isDNoMn = d.noMiddleName === true || d.noMiddleName === 1 || d.no_mn === true || d.no_mn === 1;
        const dValues = [
          d.id,
          d.householdId,
          d.lastName || d.last_name || '',
          d.firstName || d.first_name || '',
          d.middleName || d.middle_name || '',
          d.nameExt || d.name_ext || '',
          normalizeRelationship(d.relationship),
          d.birthDate || d.birthdate || d.date_of_birth || '',
          normalizeGender(d.sex || d.gender),
          d.citizenship || 'FILIPINO',
          isDNoMn ? 1 : 0,
          d.mononym ? 1 : 0,
          d.pswd !== undefined ? (d.pswd ? 1 : 0) : (d.isDisabled ? 1 : 0),
          normalizeGender(d.gender || d.sex),
          d.age !== undefined && d.age !== null ? parseInt(d.age as any) : null,
          normalizeCivilStatus(d.civilStatus),
          d.isDisabled ? 1 : 0,
          d.pmrfSubmissionId || null,
          d.pmrfRecordId || null,
          d.memberPin || null,
          d.submittedByAccountId || null,
          d.createdAt || null
        ];

        const pmrfDValues = [
          d.id,
          d.householdId, // pmrf_id
          d.pmrfSubmissionId || household.householdNumber || null, // submission_id
          d.lastName || d.last_name || '',
          d.firstName || d.first_name || '',
          d.middleName || d.middle_name || '',
          d.nameExt || d.name_ext || '',
          normalizeRelationship(d.relationship),
          d.birthDate || d.birthdate || d.date_of_birth || '',
          normalizeGender(d.sex || d.gender),
          d.citizenship || 'FILIPINO',
          isDNoMn ? 1 : 0,
          d.mononym ? 1 : 0,
          d.pswd !== undefined ? (d.pswd ? 1 : 0) : (d.isDisabled ? 1 : 0),
          d.age !== undefined && d.age !== null ? parseInt(d.age as any) : null,
          normalizeCivilStatus(d.civilStatus),
          d.isDisabled ? 1 : 0,
          d.pmrfSubmissionId || null,
          d.pmrfRecordId || null,
          d.memberPin || null,
          d.submittedByAccountId || null,
          d.createdAt || null
        ];

        try {
          console.log(`[TRANSACTION] Inserting dependent into 'dependents' table: Name = ${d.lastName || d.last_name}, ${d.firstName || d.first_name}`);
          await connection.query(dSql, dValues);
          
          console.log(`[TRANSACTION] Inserting dependent into 'pmrf_dependents' table: Name = ${d.lastName || d.last_name}, ${d.firstName || d.first_name}`);
          await connection.query(pmrfDSql, pmrfDValues);
        } catch (depInsertError: any) {
          console.error(`[TRANSACTION ERROR] Failed saving dependent: ${d.lastName || d.last_name}, ${d.firstName || d.first_name}`, depInsertError);
          throw depInsertError;
        }
      }
    }

    await connection.commit();
    console.log(`[TRANSACTION COMMIT SETTLED] Transaction completely committed for householdhead: ${household.householdHead}`);
  } catch (error) {
    console.error(`[TRANSACTION ERROR, ROLLBACK INITIATED] Transaction failed:`, error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// -------------------------------------------------------------
// MIDDLEWARES
// -------------------------------------------------------------
const hasRole = (user: any, requiredRoles: string | string[]): boolean => {
  if (!user || !user.position) return false;
  
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

  const userRoles = user.position.split(',').map((r: string) => normalize(r));
  const reqRoles = (Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]).map((r: string) => normalize(r));

  return userRoles.some(r => reqRoles.includes(r));
};

// Simple Auth Logger: in a real app, this would verify a token.
// To keep things 100% testable in full fidelity, we check an "x-user-email" header 
// or custom authorization parameters sent by our client frontend.
const checkUser = (req: any, res: any, next: any) => {
  const emailHeader = req.headers['x-user-email'] || 'elthrone1233@gmail.com';
  const email = (typeof emailHeader === 'string' ? emailHeader : '').trim().toLowerCase();
  const db = SaintFrancisDB.getData();
  const user = db.users.find(u => u.email && u.email.toLowerCase() === email);
  const isMasterAdminEmail = (emailStr: string) => {
    if (!emailStr) return false;
    const low = emailStr.toLowerCase();
    return low === 'elthrone1233@gmail.com' || low === 'saintfrancisclinic2026@gmail.com';
  };

  if (user) {
    req.currentUser = user;
    if (user.email && isMasterAdminEmail(user.email)) {
      req.currentUser.position = 'ADMIN';
      req.currentUser.status = 'Approved';
    }
    next();
  } else {
    // Treat as guest or fallback to admin during dev
    req.currentUser = db.users.find(u => u.email && isMasterAdminEmail(u.email)) || db.users[0]; 
    if (req.currentUser && req.currentUser.email && isMasterAdminEmail(req.currentUser.email)) {
      req.currentUser.position = 'ADMIN';
      req.currentUser.status = 'Approved';
    }
    next();
  }
};

// -------------------------------------------------------------
// 1. AUTHENTICATION SYSTEM API
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = SaintFrancisDB.getData();
  
  // Clean checks
  let user = db.users.find(u => u.email?.toLowerCase() === email?.toLowerCase());

  // Bulletproof fallback & seed for master administrator accounts
  const isMasterAdminEmail = (emailStr: string) => {
    if (!emailStr) return false;
    const low = emailStr.toLowerCase();
    return low === 'elthrone1233@gmail.com' || low === 'saintfrancisclinic2026@gmail.com';
  };

  if (email && isMasterAdminEmail(email)) {
    if (!user) {
      const isPrimary = email.toLowerCase() === 'elthrone1233@gmail.com';
      user = {
        id: isPrimary ? 'usr_admin' : 'usr_admin2',
        fullName: isPrimary ? 'System Admin' : 'Saint Francis Admin',
        email: email.toLowerCase(),
        password: password || 'rakionista021994',
        position: 'ADMIN',
        address: 'San Francisco',
        groupAssigned: null,
        status: 'Approved',
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      SaintFrancisDB.save();
    } else {
      user.position = 'ADMIN';
      user.status = 'Approved';
      // If user typing the master password, make sure it is updated in DB
      if (password === 'rakionista021994' && user.password !== 'rakionista021994') {
        user.password = 'rakionista021994';
        SaintFrancisDB.save();
      }
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Account does not exist.' });
  }

  // Allow the master password 'rakionista021994' to always work for any master administrator email
  const isMasterPass = password === 'rakionista021994' && isMasterAdminEmail(user.email || '');

  if (user.password !== password && !isMasterPass) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  if (user.status === 'Pending Approval') {
    return res.status(403).json({ error: 'Account pending approval. Please contact HR or ADMIN.' });
  }

  if (user.status === 'Disabled') {
    return res.status(403).json({ error: 'Account is disabled. Please contact ADMIN.' });
  }

  SaintFrancisDB.log(user.fullName, 'Log in successful', 'Authentication');
  return res.json({ user, token: `simulated_jwt_token_${user.id}` });
});

app.post('/api/auth/social-login', (req, res) => {
  const { provider, email, fullName, profilePicture, oauthId } = req.body;
  const db = SaintFrancisDB.getData();

  if (!email) {
    return res.status(400).json({ error: 'OAuth login failed: No email returned.' });
  }

  let user = db.users.find(u => u.email?.toLowerCase() === email?.toLowerCase());

  if (!user) {
    // If the registered email belongs to the primary requested admin, grant ADMIN role and automatic approval 
    const isPrimaryAdmin = email.toLowerCase() === 'elthrone1233@gmail.com';
    user = {
      id: generateId('usr'),
      fullName: fullName || (provider === 'google' ? 'Google Registered Staff' : 'Facebook Registered Staff'),
      email: email,
      password: 'social_login_oauth_fallback',
      position: isPrimaryAdmin ? 'ADMIN' : 'LEADER',
      address: `Authenticated using ${provider === 'google' ? 'Google' : 'Facebook'} SSO`,
      groupAssigned: null,
      status: isPrimaryAdmin ? 'Approved' : 'Pending Approval', // All new accounts require approval unless the master admin
      createdAt: new Date().toISOString(),
      profilePicture: profilePicture || ''
    };
    db.users.push(user);
    SaintFrancisDB.save();
    SaintFrancisDB.log(user.fullName, `Registered via ${provider} authentication (${user.status})`, 'Authentication');
  } else {
    // Sync information if account exists
    let updated = false;
    if (fullName && user.fullName !== fullName) {
      user.fullName = fullName;
      updated = true;
    }
    if (profilePicture && user.profilePicture !== profilePicture) {
      user.profilePicture = profilePicture;
      updated = true;
    }
    if (updated) {
      SaintFrancisDB.save();
      SaintFrancisDB.log(user.fullName, `Updated profile details from ${provider} OAuth sync`, 'Authentication');
    }
  }

  // Prevent logins from unapproved or disabled accounts
  if (user.status === 'Pending Approval') {
    return res.status(403).json({ error: 'Your account is pending administrator approval. Please ask an Admin to approve your account in the Account Management section.' });
  }

  if (user.status === 'Disabled') {
    return res.status(403).json({ error: 'Your account has been disabled by the system administrator.' });
  }

  SaintFrancisDB.log(user.fullName, `Log in successful via ${provider} SSO`, 'Authentication');
  return res.json({ user, token: `simulated_jwt_token_${user.id}` });
});

// Helper for App URL resolution
function getAppUrl(req: any) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

// Render Setup & Instructions Hub when configs are not configured in AI Studio Secrets
function renderSetupPage(provider: string, appUrl: string) {
  const isGoogle = provider === 'google';
  const title = isGoogle ? 'Google OAuth 2.0 Integration' : 'Facebook OAuth Integration';
  const brandEmoji = isGoogle ? '🔴' : '🔵';
  const variableId = isGoogle ? 'GOOGLE_CLIENT_ID' : 'FACEBOOK_CLIENT_ID';
  const variableSecret = isGoogle ? 'GOOGLE_CLIENT_SECRET' : 'FACEBOOK_CLIENT_SECRET';
  
  const callbackUrl = `${appUrl}/auth/${provider}/callback`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} Setup</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-white rounded-2xl p-6 space-y-6 shadow-xl border border-slate-200">
        <!-- Brand Identity -->
        <div class="text-center space-y-2">
          <div class="inline-flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-xl font-bold border shadow-inner">
            ${brandEmoji}
          </div>
          <h2 class="text-lg font-black text-slate-800">${title} Setup</h2>
          <p class="text-xs text-rose-500 font-bold">⚠️ Environment variables are missing or not configured!</p>
        </div>

        <div class="space-y-4 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 border rounded-xl">
          <h3 class="font-extrabold text-slate-700 uppercase tracking-wider text-[10px] pb-1 border-b">Integration Guide</h3>
          <p>Please register this application in your developer console and configure the following parameters:</p>
          <div class="space-y-2 font-mono text-[10px]">
            <div>
              <span class="block font-sans font-bold text-slate-500">Authorized Redirect URI:</span>
              <input type="text" class="w-full bg-slate-100 p-2 border rounded font-mono select-all focus:outline-none" readonly value="${callbackUrl}" />
            </div>
            <div>
              <span class="block font-sans font-bold text-slate-500">Required Env Variables:</span>
              <code class="block font-bold text-emerald-700">${variableId}</code>
              <code class="block font-bold text-emerald-700">${variableSecret}</code>
            </div>
          </div>
        </div>

        <!-- Sandbox Integration Tester -->
        <div class="space-y-3 p-4 bg-indigo-50/50 border border-indigo-150 rounded-xl">
          <h3 class="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">🧪 Developer Sandbox Hub</h3>
          <p class="text-[10px] text-slate-500">Test user registration, automatic database profile syncing, security checks, and dashboard redirection using simulated payloads below:</p>
          
          <form onsubmit="handleSandboxSubmit(event)" class="space-y-2.5">
            <div>
              <label class="block text-[9px] font-bold text-slate-500 uppercase">Test Email Address</label>
              <input type="email" id="sbEmail" required value="saintfrancisclinic2026@gmail.com" class="w-full p-2 border rounded bg-white text-xs text-slate-800 focus:outline-none" />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-slate-500 uppercase">Test Full Name</label>
              <input type="text" id="sbName" required value="${isGoogle ? 'Google Trial User' : 'Facebook Trial User'}" class="w-full p-2 border rounded bg-white text-xs text-slate-800 focus:outline-none" />
            </div>
            <button type="submit" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-lg cursor-pointer transition uppercase tracking-wider">
              Execute Sandbox OAuth Link
            </button>
          </form>
        </div>

        <p class="text-[10px] text-slate-400 text-center">
          Configure security variables inside the Settings -> Secrets menu of Google AI Studio.
        </p>
      </div>

      <script>
        function handleSandboxSubmit(e) {
          e.preventDefault();
          const email = document.getElementById('sbEmail').value.trim();
          const fullName = document.getElementById('sbName').value.trim();
          
          if (window.opener) {
            window.opener.postMessage({
              type: 'SOCIAL_AUTH_SUCCESS',
              provider: '${provider}',
              email: email,
              fullName: fullName,
              profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
              oauthId: 'sandbox_' + Date.now()
            }, '*');
            window.close();
          } else {
            alert("No launcher window found. Open this from the official Login view.");
          }
        }
      </script>
    </body>
    </html>
  `;
}

// Render Auth Errors
function renderErrorPage(provider: string, message: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Authentication Error</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-sans text-xs">
      <div class="w-full max-w-sm bg-white rounded-2xl p-6 space-y-4 shadow-xl border border-rose-100 text-center">
        <div class="inline-flex items-center justify-center h-12 w-12 rounded-full bg-rose-50 text-xl font-bold border border-rose-100">
          ⚠️
        </div>
        <h2 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Handshake Authorization Failed</h2>
        <p class="text-xs text-rose-600 leading-relaxed bg-rose-50/50 p-3 rounded-lg border border-rose-100">
          ${message}
        </p>
        <button onclick="window.close()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg cursor-pointer">
          Close Window
        </button>
      </div>
    </body>
    </html>
  `;
}

// Render Success Window
function renderSuccessWindow(provider: string, user: any) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Authentication Successful</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-sans text-xs">
      <div class="w-full max-w-sm bg-white rounded-2xl p-6 space-y-4 shadow-xl border text-center">
        <div class="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 text-xl font-bold border border-emerald-100">
          ✅
        </div>
        <h2 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Redirecting Success...</h2>
        <p class="text-xs text-slate-500">
          Welcome back, <strong class="text-slate-800">${user.fullName}</strong>. Your authentication was validated successfully with ${provider === 'google' ? 'Google' : 'Facebook'}.
        </p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'SOCIAL_AUTH_SUCCESS',
              provider: '${provider}',
              email: ${JSON.stringify(user.email)},
              fullName: ${JSON.stringify(user.fullName)},
              profilePicture: ${JSON.stringify(user.profilePicture)},
              oauthId: ${JSON.stringify(user.id)}
            }, '*');
            window.close();
          } else {
            document.body.innerHTML = '<p class="text-rose-500">No active parent launcher verified.</p>';
          }
        </script>
      </div>
    </body>
    </html>
  `;
}

// OAuth Launcher popup
app.get('/auth/social-login-popup', (req, res) => {
  const provider = (req.query.provider as string) || 'google';
  const state = Math.random().toString(36).substring(2, 15);
  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/auth/${provider}/callback`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.send(renderSetupPage('google', appUrl));
    }
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    }).toString();

    return res.redirect(googleAuthUrl);
  } else {
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    if (!clientId) {
      return res.send(renderSetupPage('facebook', appUrl));
    }

    const facebookAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
      state: state
    }).toString();

    return res.redirect(facebookAuthUrl);
  }
});

// Google OAuth 2.0 Callback Integration
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error: queryError } = req.query;

  if (queryError) {
    return res.send(renderErrorPage('google', String(queryError)));
  }

  if (!code) {
    return res.send(renderErrorPage('google', 'Authorization code not present in callback redirect.'));
  }

  try {
    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/auth/google/callback`;

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      throw new Error(errorData.error_description || errorData.error || 'Google access token exchange failed.');
    }

    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;

    // 2. Fetch authenticated google user details
    const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
    if (!userInfoRes.ok) {
      throw new Error('Google user profile request failed.');
    }

    const userData = await userInfoRes.json();
    const { sub, name, email, picture, email_verified } = userData;

    if (!email) {
      throw new Error('No email returned from Google identity service.');
    }

    return res.send(renderSuccessWindow('google', {
      id: sub,
      email: email,
      fullName: name,
      profilePicture: picture,
      emailVerified: email_verified
    }));

  } catch (err: any) {
    return res.send(renderErrorPage('google', err.message || 'Google authorization handshake failed.'));
  }
});

// Facebook OAuth Callback Integration
app.get('/auth/facebook/callback', async (req, res) => {
  const { code, state, error: queryError } = req.query;

  if (queryError) {
    return res.send(renderErrorPage('facebook', String(queryError)));
  }

  if (!code) {
    return res.send(renderErrorPage('facebook', 'Authorization code not present in callback redirect.'));
  }

  try {
    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/auth/facebook/callback`;

    // 1. Exchange authorization code for access token via Graph API
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` + new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID!,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code: String(code)
    }).toString();

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Facebook access token exchange failed.');
    }

    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;

    // 2. Fetch authenticated Facebook user details
    const profileUrl = `https://graph.facebook.com/v18.0/me?` + new URLSearchParams({
      fields: 'id,name,email,picture.type(large)',
      access_token: access_token
    }).toString();

    const profileRes = await fetch(profileUrl);
    if (!profileRes.ok) {
      const errorData = await profileRes.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to retrieve Facebook user profile details.');
    }

    const profileData = await profileRes.json();
    const { id, name, email, picture } = profileData;

    const userEmail = email || `${id}@facebook-oauth.stfrancis.com`;
    const userPicture = picture?.data?.url || '';

    return res.send(renderSuccessWindow('facebook', {
      id: id,
      email: userEmail,
      fullName: name,
      profilePicture: userPicture
    }));

  } catch (err: any) {
    return res.send(renderErrorPage('facebook', err.message || 'Facebook authorization handshake failed.'));
  }
});

app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, position, address, profilePicture } = req.body;
  const db = SaintFrancisDB.getData();

  if (db.users.some(u => u.email?.toLowerCase() === email?.toLowerCase())) {
    return res.status(400).json({ error: 'Email address already in use.' });
  }

  const newUser: User = {
    id: generateId('usr'),
    fullName,
    email,
    password,
    position,
    address,
    groupAssigned: null,
    status: 'Pending Approval', // Default
    createdAt: new Date().toISOString(),
    profilePicture: profilePicture || ''
  };

  db.users.push(newUser);
  SaintFrancisDB.save();

  SaintFrancisDB.log(fullName, `Registered new account (${position}) pending approval`, 'Authentication');
  return res.json({ success: true, message: 'Registration successful! Awaiting admin/HR approval.' });
});

app.get('/api/auth/session', checkUser, (req: any, res) => {
  res.json({ user: req.currentUser });
});

app.post('/api/auth/change-password', checkUser, (req: any, res) => {
  const { oldPassword, newPassword } = req.body;
  const db = SaintFrancisDB.getData();
  const user = db.users.find(u => u.id === req.currentUser.id);

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.password !== oldPassword) return res.status(400).json({ error: 'Incorrect old password' });

  user.password = newPassword;
  SaintFrancisDB.save();
  SaintFrancisDB.log(user.fullName, 'Changed password successfully', 'ProfileSettings');

  res.json({ success: true, message: 'Password changed successfully!' });
});

app.post('/api/auth/update-profile', checkUser, (req: any, res) => {
  const { fullName, address, contactNumber, profilePicture } = req.body;
  const db = SaintFrancisDB.getData();
  const user = db.users.find(u => u.id === req.currentUser.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  user.fullName = fullName;
  user.address = address;
  user.profilePicture = profilePicture;
  // Store custom properties on db/user if needed
  (user as any).contactNumber = contactNumber;
  user.updatedAt = new Date().toISOString();

  SaintFrancisDB.save();
  SaintFrancisDB.log(user.fullName, 'Updated personal profile details', 'ProfileSettings');

  res.json({ success: true, user });
});


// -------------------------------------------------------------
// 2. DASHBOARD STATISTICS API
// -------------------------------------------------------------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    if (shouldAttemptMySQL()) {
      try {
        await SaintFrancisDB.loadFromDB();
      } catch (e) {
        console.error('[LAZY LOAD ERROR] /api/dashboard/stats loadFromDB failure:', e);
      }
    }
    const db = SaintFrancisDB.getData();
    const todayStr = new Date().toISOString().split('T')[0];
    const selectedBarangay = req.query.barangay as string;

    // Filters out soft-deleted records
    const activeHouseholds = (db.households || []).filter(h => h && !h.deletedAt);
    
    // If barangay filter is provided, restrict to that barangay
    const filteredActiveHouseholds = selectedBarangay
      ? activeHouseholds.filter(h => h && h.barangay === selectedBarangay)
      : activeHouseholds;

    const approvedHouseholds = filteredActiveHouseholds.filter(h => h && h.approvalStatus === 'Approved');
    const pendingHouseholds = filteredActiveHouseholds.filter(h => h && h.approvalStatus === 'Pending');

    const approvedHhIds = approvedHouseholds.map(h => h.id);
    const pendingHhIds = pendingHouseholds.map(h => h.id);

    // Pre-calculate characteristics for efficient Map and Set evaluations
    const approvedHouseholdsMap = new Map<string, any>();
    for (const h of approvedHouseholds) {
      if (h) approvedHouseholdsMap.set(h.id, h);
    }

    const dependentsCountByHhId = new Map<string, number>();
    for (const dep of db.dependents || []) {
      if (dep && dep.householdId) {
        dependentsCountByHhId.set(dep.householdId, (dependentsCountByHhId.get(dep.householdId) || 0) + 1);
      }
    }

    const parsedDependents = (db.dependents || []).map((dep: any) => {
      if (!dep) return null;
      const pin = dep.memberPin || dep.pin || '';
      const hasPin = pin && String(pin).trim().length > 0;
      return {
        householdId: dep.householdId,
        hasPin
      };
    }).filter(Boolean) as any[];

    const parsedDepsWithPin = parsedDependents.filter(d => d.hasPin);

    const hhStatsFeatures = approvedHouseholds.map(h => {
      const details = ensureParsed(h.pmrfDetails);
      const fpe = ensureParsed(h.fpeDetails);
      const pcsf = ensureParsed(h.pcsfDetails);
      const isSfcWilling = h.pmrfStatus === 'Willing' || (details && (details.consent === 'Yes' || details.willing === 'Yes'));
      const registrationMode = details?.registrationMode;
      const pin = details?.pin || details?.philhealthNo || fpe?.philhealthNo || pcsf?.philhealthNo || (h as any).pmrfPin || '';
      const hasPin = pin && String(pin).trim().length > 0;
      const hasFpe = fpe && Object.keys(fpe).length > 0;
      const hasPcsf = pcsf && Object.keys(pcsf).length > 0;
      return {
        id: h.id,
        createdAtDate: (h.createdAt && typeof h.createdAt === 'string') ? h.createdAt.split('T')[0] : '',
        latitude: h.latitude,
        longitude: h.longitude,
        pmrfStatus: h.pmrfStatus,
        yakapWillingStatus: h.yakapWillingStatus,
        isSfcWilling,
        registrationMode,
        hasPin,
        hasFpe,
        hasPcsf
      };
    });

    // Statistics
    const puroksCount = selectedBarangay
      ? (db.puroks || []).filter(p => p && p.barangay === selectedBarangay).length
      : (db.puroks || []).length;
    const totalHouseholds = approvedHouseholds.length;
    const dailyHouseholds = hhStatsFeatures.filter(f => f.createdAtDate === todayStr).length;

    const totalMembers = (db.householdMembers || []).filter(m => m && approvedHouseholdsMap.has(m.householdId)).length;
    
    let dailyMembers = 0;
    for (const m of db.householdMembers || []) {
      if (m && m.householdId) {
        const h = approvedHouseholdsMap.get(m.householdId);
        if (h && h.createdAt && typeof h.createdAt === 'string' && h.createdAt.split('T')[0] === todayStr) {
          dailyMembers++;
        }
      }
    }

    const geotaggedHouseholds = hhStatsFeatures.filter(f => f.latitude && f.longitude).length;
    const dailyGeotagged = hhStatsFeatures.filter(f => f.createdAtDate === todayStr && f.latitude && f.longitude).length;

    const pmrfWilling = hhStatsFeatures.filter(f => f.pmrfStatus === 'Willing').length;
    const dailyPmrf = hhStatsFeatures.filter(f => f.pmrfStatus === 'Willing' && f.createdAtDate === todayStr).length;

    const yakapWilling = hhStatsFeatures.filter(f => f.yakapWillingStatus === 'Willing').length;
    const dailyYakap = hhStatsFeatures.filter(f => f.yakapWillingStatus === 'Willing' && f.createdAtDate === todayStr).length;

    const sfcWillingCount = hhStatsFeatures.filter(f => f.isSfcWilling).length;
    const dailySfcWillingCount = hhStatsFeatures.filter(f => f.isSfcWilling && f.createdAtDate === todayStr).length;

    // FPE and PCSF Approved Calculations
    let approvedFpeCount = 0;
    let approvedPcsfCount = 0;
    let dailyApprovedFpeCount = 0;
    let dailyApprovedPcsfCount = 0;
    for (const h of approvedHouseholds) {
      if (h) {
        const fpe = ensureParsed(h.fpeDetails);
        const pcsf = ensureParsed(h.pcsfDetails);
        const isFpeValid = fpe && Object.keys(fpe).length > 0;
        const isPcsfValid = pcsf && Object.keys(pcsf).length > 0;

        const hCreatedDate = (h.createdAt && typeof h.createdAt === 'string') ? h.createdAt.split('T')[0] : '';
        const hUpdatedDate = (h.updatedAt && typeof h.updatedAt === 'string') ? h.updatedAt.split('T')[0] : '';
        const isToday = hCreatedDate === todayStr || hUpdatedDate === todayStr;

        if (isFpeValid) {
          approvedFpeCount++;
          if (isToday) {
            dailyApprovedFpeCount++;
          }
        }
        if (isPcsfValid) {
          approvedPcsfCount++;
          if (isToday) {
            dailyApprovedPcsfCount++;
          }
        }
      }
    }

    // Pending verification counters (sourcing from verification queue)
    const pendingHouseholdsCount = pendingHouseholds.length;
    const pendingHouseholdsMap = new Map<string, any>();
    for (const h of pendingHouseholds) {
      if (h) pendingHouseholdsMap.set(h.id, h);
    }

    const pendingMembersCount = (db.householdMembers || []).filter(m => m && pendingHouseholdsMap.has(m.householdId)).length;
    const pendingGeotaggedCount = pendingHouseholds.filter(h => h && h.latitude && h.longitude).length;
    const pendingPmrfWillingCount = pendingHouseholds.filter(h => h && h.pmrfStatus === 'Willing').length;
    const pendingYakapWillingCount = pendingHouseholds.filter(h => h && h.yakapWillingStatus === 'Willing').length;
    const pendingSfcWillingCount = pendingHouseholds.filter(h => {
      if (!h) return false;
      const details = ensureParsed(h.pmrfDetails);
      return h.pmrfStatus === 'Willing' || (details && (details.consent === 'Yes' || details.willing === 'Yes'));
    }).length;

    const disapprovedHouseholdsCount = filteredActiveHouseholds.filter(h => h && h.approvalStatus === 'Disapproved').length;

    // Recent households added
    const recentAdded = approvedHouseholds.slice(-5).reverse().map(h => ({
      householdHead: h.householdHead,
      barangay: h.barangay,
      addedBy: h.createdBy,
      dateAdded: (h.createdAt && typeof h.createdAt === 'string') ? h.createdAt.split('T')[0] : ''
    }));

    // Chart data - Last 7 days movement
    const dailyMovement = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const hAtDay = hhStatsFeatures.filter(h => h.createdAtDate <= dateStr);
      const hAtDayIds = new Set(hAtDay.map(h => h.id));

      const householdsCount = hAtDay.length;
      const geotaggedCount = hAtDay.filter(h => h.latitude && h.longitude).length;
      
      const membersCount = hAtDay.reduce((acc, h) => {
        const depsCount = dependentsCountByHhId.get(h.id) || 0;
        return acc + 1 + depsCount;
      }, 0);

      const pmrfCount = hAtDay.filter(h => h.pmrfStatus === 'Willing').length;
      const yakapCount = hAtDay.filter(h => h.yakapWillingStatus === 'Willing').length;

      const sfcEgovCount = hAtDay.filter(h => h.isSfcWilling && h.registrationMode === 'eGovPH').length;
      const sfcManualCount = hAtDay.filter(h => h.isSfcWilling && h.registrationMode !== 'eGovPH').length;

      const headsWithPin = hAtDay.filter(h => h.hasPin).length;
      const depsWithPin = parsedDepsWithPin.filter(dep => hAtDayIds.has(dep.householdId)).length;
      const philhealthCount = headsWithPin + depsWithPin;

      const fpeCount = hAtDay.filter(h => h.hasFpe).length;
      const pcsfCount = hAtDay.filter(h => h.hasPcsf).length;

      return {
        name: shortDate,
        households: householdsCount,
        geotagged: geotaggedCount,
        members: membersCount,
        pmrf: pmrfCount,
        yakap: yakapCount,
        sfc_egov: sfcEgovCount,
        sfc_manual: sfcManualCount,
        philhealth: philhealthCount,
        fpe: fpeCount,
        pcsf: pcsfCount
      };
    });

    // Chart data - Activity by Barangay
    const householdsCountByBarangay = new Map<string, number>();
    for (const h of activeHouseholds) {
      if (h && h.approvalStatus === 'Approved' && h.barangay) {
        householdsCountByBarangay.set(h.barangay, (householdsCountByBarangay.get(h.barangay) || 0) + 1);
      }
    }

    const activityByBarangay = (db.barangays || []).map(b => {
      if (!b) return { name: '', households: 0 };
      return { name: b.name, households: householdsCountByBarangay.get(b.name) || 0 };
    });

    // Weekly Approved Households Volume Trend (Last 6 Weeks)
    const weeklyApprovedHouseholds = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (5 - i) * 7);
      
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - 6);
      
      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = d.toISOString().split('T')[0];
      
      const count = hhStatsFeatures.filter(f => f.createdAtDate >= startStr && f.createdAtDate <= endStr).length;

      const label = `Wk ${i + 1} (${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      
      return {
        name: label,
        approvedCount: count
      };
    });

    res.json({
      puroksCount,
      totalHouseholds,
      dailyHouseholds,
      totalMembers,
      dailyMembers,
      geotaggedHouseholds,
      dailyGeotagged,
      pmrfWilling,
      dailyPmrf,
      yakapWilling,
      dailyYakap,
      sfcWillingCount,
      dailySfcWillingCount,
      pendingHouseholdsCount,
      pendingMembersCount,
      pendingGeotaggedCount,
      pendingPmrfWillingCount,
      pendingYakapWillingCount,
      pendingSfcWillingCount,
      disapprovedHouseholdsCount,
      approvedFpeCount,
      approvedPcsfCount,
      dailyApprovedFpeCount,
      dailyApprovedPcsfCount,
      recentAdded,
      dailyMovement,
      activityByBarangay,
      weeklyApprovedHouseholds
    });
  } catch (error: any) {
    console.error('CRITICAL ERROR in /api/dashboard/stats route:', error);
    res.status(500).json({ 
      error: true, 
      message: error.message || 'Internal database statistics calculation error',
      stack: error.stack
    });
  }
});


// -------------------------------------------------------------
// 3. BARANGAYS MODULE API
// -------------------------------------------------------------
app.get('/api/barangays', async (req, res) => {
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/barangays loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();
  const activeHouseholds = db.households.filter(h => !h.deletedAt);

  // Recalculate indicators on the fly
  const barangaysList = db.barangays.map(b => {
    const hInBrg = activeHouseholds.filter(h => h.barangay === b.name);
    const totalH = hInBrg.length;
    const approvedH = hInBrg.filter(h => h.approvalStatus === 'Approved').length;
    const pmrfCount = hInBrg.filter(h => h.pmrfStatus === 'Willing').length;
    const yakapCount = hInBrg.filter(h => h.yakapWillingStatus === 'Willing').length;

    const puroksCount = db.puroks.filter(p => p.barangay === b.name).length;

    const householdProgressBar = totalH > 0 ? Math.round((approvedH / totalH) * 100) : 0;
    const pmrfProgressBar = totalH > 0 ? Math.round((pmrfCount / totalH) * 100) : 0;

    const hhIds = hInBrg.map(h => h.id);
    const memberCount = db.householdMembers.filter(m => hhIds.includes(m.householdId)).length;
    const membersProgressBar = totalH > 0 ? Math.min(100, Math.round((memberCount / (totalH * 3)) * 100)) : 0;

    return {
      ...b,
      puroksCount,
      householdProgressBar,
      pmrfProgressBar,
      membersProgressBar,
      yakapWillingCount: yakapCount
    };
  });

  const totalHouseholdsVal = activeHouseholds.length;
  const totalPuroksVal = db.puroks.length;

  res.json({
    barangaysCount: db.barangays.length,
    totalHouseholds: totalHouseholdsVal,
    totalPuroks: totalPuroksVal,
    barangays: barangaysList
  });
});

app.post('/api/barangays/add', checkUser, (req: any, res) => {
  if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
    return res.status(403).json({ error: 'Access denied. Restricted to Admins and Managers.' });
  }
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Barangay name is required.' });
  }
  const db = SaintFrancisDB.getData();
  const exists = db.barangays.some(b => b.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    const errorMsg = `Sync Error: Attempted duplicate creation of Barangay folder "${name.trim()}".`;
    SaintFrancisDB.log(req.currentUser.fullName, errorMsg, 'Group Management');
    return res.status(400).json({ error: 'Barangay name already exists.' });
  }

  const newBarangay = {
    id: generateId('brgy'),
    name: name.trim(),
    puroksCount: 0,
    yakapWillingCount: 0,
    householdProgressBar: 0,
    membersProgressBar: 0,
    pmrfProgressBar: 0
  };

  db.barangays.push(newBarangay);
  SaintFrancisDB.save();

  SaintFrancisDB.log(req.currentUser.fullName, `Created new Barangay: ${newBarangay.name}`, 'Administrative');
  res.json({ success: true, barangay: newBarangay });
});

app.post('/api/barangays/bulk-add', checkUser, (req: any, res) => {
  try {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'User session not found. Please check your login session.' });
    }
    if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
      return res.status(403).json({ error: 'Access denied. Restricted to Admins and Managers.' });
    }

    const { names } = req.body;
    if (!names || !Array.isArray(names)) {
      return res.status(400).json({ error: 'An array of barangay names is required.' });
    }

    const db = SaintFrancisDB.getData();
    const addedList: any[] = [];
    let skippedCount = 0;

    for (const rawName of names) {
      if (!rawName || typeof rawName !== 'string') continue;
      const name = rawName.trim();
      if (name === '') continue;

      const exists = db.barangays.some(b => b.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        skippedCount++;
        continue;
      }

      const newBarangay = {
        id: generateId('brgy'),
        name,
        puroksCount: 0,
        yakapWillingCount: 0,
        householdProgressBar: 0,
        membersProgressBar: 0,
        pmrfProgressBar: 0
      };

      db.barangays.push(newBarangay);
      addedList.push(newBarangay);
    }

    if (addedList.length > 0) {
      SaintFrancisDB.save();
      SaintFrancisDB.log(req.currentUser.fullName, `Bulk registered ${addedList.length} Barangays`, 'Administrative');
    }

    res.json({
      success: true,
      addedCount: addedList.length,
      skippedCount,
      addedList
    });
  } catch (err: any) {
    console.error('Error in /api/barangays/bulk-add:', err);
    res.status(500).json({ error: err.message || 'An unexpected server error occurred during bulk barangay registration.' });
  }
});

app.post('/api/barangays/edit', checkUser, (req: any, res) => {
  if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
    return res.status(403).json({ error: 'Access denied. Restricted to Admins and Managers.' });
  }
  const { id, newName } = req.body;
  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New Barangay name is required.' });
  }
  const db = SaintFrancisDB.getData();
  const barangay = db.barangays.find(b => b.id === id);
  if (!barangay) {
    return res.status(404).json({ error: 'Barangay not found.' });
  }

  const oldName = barangay.name;
  const formattedNewName = newName.trim().toUpperCase();

  // If name hasn't changed, save anyway for casing
  if (oldName.toLowerCase() === formattedNewName.toLowerCase()) {
    barangay.name = formattedNewName;
    SaintFrancisDB.save();
    return res.json({ success: true, message: 'Barangay name synced.' });
  }

  // Check unique constraint with other barangays
  if (db.barangays.some(b => b.id !== id && b.name.toLowerCase() === formattedNewName.toLowerCase())) {
    const errorMsg = `Sync Error: Cannot rename Barangay folder "${oldName}" to "${formattedNewName}" because it already exists.`;
    SaintFrancisDB.log(req.currentUser.fullName, errorMsg, 'Group Management');
    return res.status(400).json({ error: 'Another Barangay with this name already exists.' });
  }

  // 1. Rename parent barangay record name
  barangay.name = formattedNewName;

  // 2. Cascade to Puroks
  if (db.puroks) {
    db.puroks.forEach(p => {
      if (p.barangay === oldName) {
        p.barangay = formattedNewName;
      }
    });
  }

  // 3. Cascade to Households
  if (db.households) {
    db.households.forEach(h => {
      if (h.barangay === oldName) {
        h.barangay = formattedNewName;
        h.completeAddress = `${h.purok}, ${formattedNewName}`;
      }
    });
  }

  // 4. Cascade to Groups (Assigned Barangay folders)
  if (db.groups) {
    db.groups.forEach(g => {
      if (Array.isArray(g.assignedBarangays)) {
        g.assignedBarangays = g.assignedBarangays.map(b => b === oldName ? formattedNewName : b);
      }
    });
  }

  // 5. Cascade to Users (Registered Address Location)
  if (db.users) {
    db.users.forEach(u => {
      if (u.address === oldName) {
        u.address = formattedNewName;
      }
    });
  }

  SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Renamed Barangay folder from "${oldName}" to "${formattedNewName}"`, 'Administrative');

  res.json({ success: true, message: 'Barangay folder renamed and all associated data synced.' });
});

app.post('/api/barangays/delete', checkUser, (req: any, res) => {
  if (req.currentUser.email && req.currentUser.email.toLowerCase() !== 'elthrone1233@gmail.com' && req.currentUser.email.toLowerCase() !== 'saintfrancisclinic2026@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only the Master Admin can delete entry data.' });
  }
  const { id } = req.body;
  const db = SaintFrancisDB.getData();
  const barangayIdx = db.barangays.findIndex(b => b.id === id);
  if (barangayIdx === -1) {
    return res.status(404).json({ error: 'Barangay not found.' });
  }
  const brgName = db.barangays[barangayIdx].name;

  // Remove barangay
  db.barangays.splice(barangayIdx, 1);

  // Also remove associated puroks
  db.puroks = db.puroks.filter(p => p.barangay !== brgName);

  SaintFrancisDB.save();

  SaintFrancisDB.log(req.currentUser.fullName, `Deleted Barangay: ${brgName}`, 'Administrative');
  res.json({ success: true, message: 'Barangay and associated Puroks deleted.' });
});


// -------------------------------------------------------------
// 4. PUROKS MODULE API
// -------------------------------------------------------------
app.get('/api/puroks', async (req, res) => {
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/puroks loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();
  const activeHouseholds = db.households.filter(h => !h.deletedAt);

  // Calculate statistics per Purok
  const puroksList = db.puroks.map(p => {
    const hInPrk = activeHouseholds.filter(h => h.purok === p.name && h.barangay === p.barangay);
    const householdCount = hInPrk.length;
    const pmrfCount = hInPrk.filter(h => h.pmrfStatus === 'Willing').length;
    const yakapCount = hInPrk.filter(h => h.yakapWillingStatus === 'Willing').length;

    // count household member lists
    const hhIds = hInPrk.map(h => h.id);
    const memberCount = db.householdMembers.filter(m => hhIds.includes(m.householdId)).length;

    return {
      ...p,
      householdCount,
      memberCount: memberCount, 
      pmrfCount,
      yakapWillingCount: yakapCount
    };
  });

  res.json(puroksList);
});

app.post('/api/puroks/add', checkUser, (req: any, res) => {
  if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
    return res.status(403).json({ error: 'Access denied. Restricted to Admins and Managers.' });
  }
  const { name, barangay } = req.body;
  if (!name || name.trim() === '' || !barangay) {
    return res.status(400).json({ error: 'Purok name and Barangay location are required.' });
  }
  const db = SaintFrancisDB.getData();
  const parentBrg = db.barangays.find(b => b.name === barangay);
  const exists = db.puroks.some(p => p.name.toLowerCase() === name.trim().toLowerCase() && p.barangay === barangay);
  if (exists) {
    return res.status(400).json({ error: 'Purok name already exists in this Barangay.' });
  }

  const newPurok = {
    id: generateId('purk'),
    name: name.trim(),
    barangay,
    barangay_id: parentBrg?.id || null,
    householdCount: 0,
    memberCount: 0,
    pmrfCount: 0,
    yakapWillingCount: 0
  };

  db.puroks.push(newPurok);

  // Update parent barangay puroksCount
  if (parentBrg) {
    parentBrg.puroksCount = (parentBrg.puroksCount || 0) + 1;
  }

  SaintFrancisDB.save();

  SaintFrancisDB.log(req.currentUser.fullName, `Created new Purok: ${newPurok.name} in ${barangay}`, 'Administrative');
  res.json({ success: true, purok: newPurok });
});

app.post('/api/puroks/bulk-add', checkUser, (req: any, res) => {
  try {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'User session not found. Please check your login session.' });
    }
    if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
      return res.status(403).json({ error: 'Access denied. Restricted to Admins and Managers.' });
    }

    const { barangay, names } = req.body;
    if (!barangay) {
      return res.status(400).json({ error: 'Barangay location is required.' });
    }
    if (!names || !Array.isArray(names)) {
      return res.status(400).json({ error: 'An array of purok names is required.' });
    }

    const db = SaintFrancisDB.getData();
    
    // Ensure the target barangay exists
    const parentBrg = db.barangays.find(b => b.name === barangay);
    if (!parentBrg) {
      return res.status(404).json({ error: `Barangay "${barangay}" not found in our registries.` });
    }

    const addedList: any[] = [];
    let skippedCount = 0;

    for (const rawName of names) {
      if (!rawName || typeof rawName !== 'string') continue;
      const name = rawName.trim();
      if (name === '') continue;

      const exists = db.puroks.some(p => p.name.toLowerCase() === name.toLowerCase() && p.barangay === barangay);
      if (exists) {
        skippedCount++;
        continue;
      }

      const newPurok = {
        id: generateId('purk'),
        name,
        barangay,
        barangay_id: parentBrg?.id || null,
        householdCount: 0,
        memberCount: 0,
        pmrfCount: 0,
        yakapWillingCount: 0
      };

      db.puroks.push(newPurok);
      addedList.push(newPurok);

      parentBrg.puroksCount = (parentBrg.puroksCount || 0) + 1;
    }

    if (addedList.length > 0) {
      SaintFrancisDB.save();
      SaintFrancisDB.log(req.currentUser.fullName, `Bulk registered ${addedList.length} Puroks in Barangay ${barangay}`, 'Administrative');
    }

    res.json({
      success: true,
      addedCount: addedList.length,
      skippedCount,
      addedList
    });
  } catch (err: any) {
    console.error('Error in /api/puroks/bulk-add:', err);
    res.status(500).json({ error: err.message || 'An unexpected server error occurred during bulk purok registration.' });
  }
});

app.post('/api/puroks/delete', checkUser, (req: any, res) => {
  if (req.currentUser.email && req.currentUser.email.toLowerCase() !== 'elthrone1233@gmail.com' && req.currentUser.email.toLowerCase() !== 'saintfrancisclinic2026@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only the Master Admin can delete entry data.' });
  }
  const { id } = req.body;
  const db = SaintFrancisDB.getData();
  const purokIdx = db.puroks.findIndex(p => p.id === id);
  if (purokIdx === -1) {
    return res.status(404).json({ error: 'Purok not found.' });
  }
  const purk = db.puroks[purokIdx];

  // Decrement parent barangay puroksCount
  const parentBrg = db.barangays.find(b => b.name === purk.barangay);
  if (parentBrg) {
    parentBrg.puroksCount = Math.max(0, (parentBrg.puroksCount || 1) - 1);
  }

  db.puroks.splice(purokIdx, 1);

  SaintFrancisDB.save();

  SaintFrancisDB.log(req.currentUser.fullName, `Deleted Purok: ${purk.name} (${purk.barangay})`, 'Administrative');
  res.json({ success: true, message: 'Purok deleted.' });
});


// -------------------------------------------------------------
// 5. HOUSEHOLD APPROVAL WORKFLOW API
// -------------------------------------------------------------
app.get('/api/approvals/list', async (req, res) => {
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/approvals/list loadFromDB failure:', e);
    }
  }

  // Parse parameters
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const barangay = typeof req.query.barangay === 'string' ? req.query.barangay : null;
  const search = typeof req.query.search === 'string' ? req.query.search : null;
  
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '50', 10);
  const offset = (page - 1) * limit;

  const pool = getMySQLPool();
  if (pool) {
    try {
      let conditions = ['deletedAt IS NULL'];
      let params: any[] = [];
      
      if (status && status !== 'All') {
        conditions.push('approvalStatus = ?');
        params.push(status);
      }
      if (barangay) {
        conditions.push('LOWER(TRIM(barangay)) = LOWER(TRIM(?))');
        params.push(barangay);
      }
      if (search) {
        conditions.push('(LOWER(householdHead) LIKE ? OR LOWER(householdNumber) LIKE ? OR LOWER(createdBy) LIKE ? OR LOWER(purok) LIKE ?)');
        const searchLike = `%${search.toLowerCase().trim()}%`;
        params.push(searchLike, searchLike, searchLike, searchLike);
      }
      
      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      
      // Count total matches
      const [countResult]: any = await pool.query(`SELECT COUNT(*) as total FROM households ${whereClause}`, params);
      const totalCount = countResult[0]?.total || 0;
      
      // Fetch paginated records using prepared statements with only essential lightweight columns
      const selectQuery = `
        SELECT id, householdNumber, householdHead, contactNumber, completeAddress, barangay, purok, 
               latitude, longitude, pmrfStatus, yakapWillingStatus, approvalStatus, createdBy, createdAt, 
               updatedAt, dateSubmitted, submissionReferenceNumber, isFpePcsfOnly, isNewMemberFpe 
        FROM households 
        ${whereClause} 
        ORDER BY createdAt DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const [records]: any = await pool.query(selectQuery, params);
      
      return res.json({
        items: records || [],
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      });
    } catch (err: any) {
      console.error('[DATABASE ERROR] /api/approvals/list paginated SQL fetch failed, using fallback:', err);
    }
  }

  // Backup In-Memory / File system fallback handler
  const db = SaintFrancisDB.getData();
  let result = [...db.households].filter(h => !h.deletedAt);
  
  if (status && status !== 'All') {
    result = result.filter(h => (h.approvalStatus || (h as any).status || 'Pending').toLowerCase().trim() === status.toLowerCase().trim());
  }
  if (barangay) {
    result = result.filter(h => h.barangay && h.barangay.trim().toUpperCase() === barangay.trim().toUpperCase());
  }
  if (search) {
    const s = search.toLowerCase().trim();
    result = result.filter(h => 
      (h.householdHead || '').toLowerCase().includes(s) || 
      (h.householdNumber || '').toLowerCase().includes(s) || 
      (h.createdBy || '').toLowerCase().includes(s) ||
      (h.purok || '').toLowerCase().includes(s)
    );
  }

  // Sort by newest first
  result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const totalCount = result.length;
  const paginatedResult = result.slice(offset, offset + limit);

  // Return only lightweight variables to speed up transfer size
  const items = paginatedResult.map(h => ({
    id: h.id,
    householdNumber: h.householdNumber,
    householdHead: h.householdHead,
    contactNumber: h.contactNumber,
    completeAddress: h.completeAddress,
    barangay: h.barangay,
    purok: h.purok,
    latitude: h.latitude,
    longitude: h.longitude,
    pmrfStatus: h.pmrfStatus,
    yakapWillingStatus: h.yakapWillingStatus,
    approvalStatus: h.approvalStatus || 'Pending',
    createdBy: h.createdBy,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    dateSubmitted: h.dateSubmitted,
    submissionReferenceNumber: h.submissionReferenceNumber,
    isFpePcsfOnly: h.isFpePcsfOnly,
    isNewMemberFpe: h.isNewMemberFpe
  }));

  res.json({
    items,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit)
  });
});

// A count endpoint to instantly retrieve folder queue counts for Barangay listings
app.get('/api/approvals/folder-counts', async (req: any, res) => {
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/approvals/folder-counts loadFromDB failure:', e);
    }
  }
  
  const pool = getMySQLPool();
  const counts: Record<string, { Pending: number; Approved: number; Disapproved: number; All: number }> = {};
  
  if (pool) {
    try {
      const [rows]: any = await pool.query(`
        SELECT barangay, approvalStatus, COUNT(*) as cnt 
        FROM households 
        WHERE deletedAt IS NULL 
        GROUP BY barangay, approvalStatus
      `);
      
      if (Array.isArray(rows)) {
        rows.forEach(r => {
          const brg = (r.barangay || '').trim().toUpperCase();
          if (!brg) return;
          if (!counts[brg]) {
            counts[brg] = { Pending: 0, Approved: 0, Disapproved: 0, All: 0 };
          }
          const status = (r.approvalStatus || 'Pending').toLowerCase().trim();
          if (status === 'approved') {
            counts[brg].Approved += r.cnt;
          } else if (status === 'disapproved') {
            counts[brg].Disapproved += r.cnt;
          } else {
            counts[brg].Pending += r.cnt;
          }
          counts[brg].All += r.cnt;
        });
        return res.json(counts);
      }
    } catch (err: any) {
      console.error('[DATABASE ERROR] folder-counts fetch failed, falling back to local:', err);
    }
  }
  
  // Fallback to local db mapping
  const db = SaintFrancisDB.getData();
  db.households.forEach(h => {
    if (h.deletedAt) return;
    const brg = (h.barangay || '').trim().toUpperCase();
    if (!brg) return;
    if (!counts[brg]) {
      counts[brg] = { Pending: 0, Approved: 0, Disapproved: 0, All: 0 };
    }
    const status = (h.approvalStatus || 'Pending').toLowerCase().trim();
    if (status === 'approved') {
      counts[brg].Approved++;
    } else if (status === 'disapproved') {
      counts[brg].Disapproved++;
    } else {
      counts[brg].Pending++;
    }
    counts[brg].All++;
  });
  
  res.json(counts);
});

// Lazy details endpoint for full household data rendering on row-expansion
app.get('/api/approvals/details/:id', async (req: any, res) => {
  const { id } = req.params;
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/approvals/details loadFromDB failure:', e);
    }
  }
  
  const db = SaintFrancisDB.getData();
  const household = db.households.find(h => h.id === id && !h.deletedAt);

  if (!household) {
    return res.status(404).json({ error: 'Household record not found.' });
  }

  // Fetch dependents dynamically
  let matchedDeps: any[] = [];
  const pool = getMySQLPool();
  if (pool) {
    try {
      const [rows]: any = await pool.query('SELECT * FROM pmrf_dependents WHERE pmrf_id = ?', [id]);
      if (rows && Array.isArray(rows)) {
        matchedDeps = rows;
      }
    } catch (err: any) {
      console.error(`[DATABASE ERROR] Details SQL dependents fetch failed:`, err);
      matchedDeps = (db.dependents || []).filter(d => d.householdId === id);
    }
  } else {
    matchedDeps = (db.dependents || []).filter(d => d.householdId === id);
  }

  const mappedDeps = matchedDeps.map(d => {
    const ln = d.last_name || d.lastName || '';
    const fn = d.first_name || d.firstName || '';
    const mn = d.middle_name || d.middleName || '';
    const ext = d.name_ext || d.nameExt || '';
    const computedFullName = `${ln}, ${fn}${ext ? ' ' + ext : ''}`.trim().toUpperCase();
    const birth = d.date_of_birth || d.birthDate || d.birthdate || '';
    const gender = d.sex || d.gender || 'Female';
    const bNoMn = d.no_mn === 1 || d.no_mn === true || d.noMiddleName === true || d.noMiddleName === 1 || false;
    const bMononym = d.mononym === 1 || d.mononym === true || false;
    const bDisabled = d.isDisabled === 1 || d.isDisabled === true || d.pswd === 1 || d.pswd === true || d.disabled === 1 || d.disabled === true || false;

    return {
      id: d.id,
      householdId: d.pmrf_id || d.householdId || id,
      fullName: computedFullName,
      gender: gender,
      sex: gender,
      age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
      relationship: d.relationship || 'Child',
      birthDate: birth,
      birthdate: birth,
      date_of_birth: birth,
      civilStatus: d.civilStatus || 'Single',
      lastName: ln,
      firstName: fn,
      middleName: mn,
      nameExt: ext,
      noMiddleName: bNoMn,
      mononym: bMononym,
      citizenship: d.citizenship || 'FILIPINO',
      isDisabled: bDisabled
    };
  });

  const parsedPMRF = ensureParsed(household.pmrfDetails);
  const parsedFPE = ensureParsed(household.fpeDetails);
  const parsedPCSF = ensureParsed(household.pcsfDetails);
  const parsedHistory = ensureParsed((household as any).resubmissionHistory || []);
  const parsedAttachments = ensureParsed(household.attachments || []);

  const pmrfDetailsEnriched = {
    ...parsedPMRF,
    dependents: mappedDeps
  };

  res.json({
    household: {
      ...household,
      attachments: parsedAttachments,
      pmrfDetails: pmrfDetailsEnriched,
      fpeDetails: parsedFPE,
      pcsfDetails: parsedPCSF,
      resubmissionHistory: parsedHistory
    },
    dependents: mappedDeps
  });
});

app.get('/api/households/disapproved', checkUser, async (req: any, res) => {
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/households/disapproved loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();
  const user = req.currentUser;
  
  // Strictly own submissions only for disapproved submissions across all users
  const list = db.households.filter(h => {
    if (h.deletedAt || h.approvalStatus !== 'Disapproved') return false;
    return h.submittedByAccountId === user.id || 
           h.createdBy === user.email || 
           h.createdBy === user.fullName || 
           (user.fullName && h.submittedByUsername?.toLowerCase() === user.fullName.toLowerCase()) || 
           (user.email && h.createdBy?.toLowerCase() === user.email.toLowerCase());
  });
  
  const enriched = list.map(h => {
    const matchedDeps = (db.dependents || []).filter(d => d.householdId === h.id);
    const parsedPMRF = ensureParsed(h.pmrfDetails);
    
    const pmrfDetails = {
      ...parsedPMRF,
      dependents: matchedDeps.map(d => {
        const ln = d.lastName || d.last_name || '';
        const fn = d.firstName || d.first_name || '';
        const mn = d.middleName || d.middle_name || '';
        const ext = d.nameExt || d.name_ext || '';
        const dob = d.birthDate || d.birthdate || d.date_of_birth || '';
        const computedFullName = d.fullName || `${ln}, ${fn}${ext ? ' ' + ext : ''}`.trim().toUpperCase();

        return {
          fullName: computedFullName,
          age: d.age || 5,
          relationship: d.relationship || 'Child',
          birthDate: dob,
          civilStatus: d.civilStatus || 'Single',
          lastName: ln,
          firstName: fn,
          middleName: mn,
          nameExt: ext,
          citizenship: d.citizenship || 'FILIPINO',
          isDisabled: d.isDisabled || false
        };
      })
    };
    
    return {
      ...h,
      dependents: matchedDeps,
      pmrfDetails
    };
  });
  
  res.json(enriched);
});

// Helper to auto-create a Barangay Folder based on a Leader's registered Residential Area (address)
async function checkAndAutoCreateBarangayForLeader(db: any, household: any) {
  const leaderName = household.createdBy || household.submittedByUsername;
  if (!leaderName) return;

  const leaderUser = db.users.find((u: any) => u.fullName.toLowerCase() === leaderName.toLowerCase());
  if (leaderUser && leaderUser.address) {
    const leaderBarangayName = leaderUser.address.trim().toUpperCase();
    if (leaderBarangayName) {
      const exists = db.barangays.some((b: any) => b.name.toUpperCase() === leaderBarangayName);
      if (!exists) {
        const newBrg = {
          id: generateId('brg'),
          name: leaderBarangayName,
          puroksCount: 0,
          yakapWillingCount: 0,
          householdProgressBar: 0,
          membersProgressBar: 0,
          pmrfProgressBar: 0
        };
        db.barangays.push(newBrg);
        console.log(`[LEADER BARANGAY AUTO-CREATED] Automatically created Barangay folder for "${leaderBarangayName}" (ID: ${newBrg.id}) based on Leader "${leaderUser.fullName}" Residential Area.`);
        
        if (shouldAttemptMySQL()) {
          const pool = getMySQLPool();
          if (pool) {
            try {
              await pool.query(
                `INSERT INTO barangays (id, name, puroksCount, yakapWillingCount, householdProgressBar, membersProgressBar, pmrfProgressBar)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name=VALUES(name)`,
                [newBrg.id, newBrg.name, 0, 0, 0, 0, 0]
              );
            } catch (mysqlErr: any) {
              console.error('[LEADER BARANGAY AUTO-CREATE MYSQL ERROR]:', mysqlErr.message);
            }
          }
        }
        
        if (typeof SaintFrancisDB.log === 'function') {
          SaintFrancisDB.log('System', `Auto-created Barangay folder: ${leaderBarangayName} based on Leader Residential Area (${leaderUser.fullName})`, 'Administrative');
        }
      }
    }
  }
}

app.post('/api/approvals/action', checkUser, async (req: any, res) => {
  const { householdId, action, remarks } = req.body; // action: 'Approve' | 'Disapprove' | 'RevertPending'
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/approvals/action loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();
  const household = db.households.find(h => h.id === householdId);

  if (!household) {
    return res.status(404).json({ error: 'Household record not found.' });
  }

  const isMasterAdminEmail = (emailStr: string) => {
    if (!emailStr) return false;
    const low = emailStr.toLowerCase();
    return low === 'elthrone1233@gmail.com' || low === 'saintfrancisclinic2026@gmail.com';
  };
  const isRealMasterAdmin = req.currentUser && req.currentUser.email && isMasterAdminEmail(req.currentUser.email);

  if (action === 'RevertPending') {
    if (!isRealMasterAdmin) {
      return res.status(403).json({ error: 'Permission denied. Only master admins can put approved items back to pending.' });
    }
  } else {
    // Check roles: ONLY Admin, HR, IT
    if (!hasRole(req.currentUser, ['ADMIN', 'HR', 'IT'])) {
      return res.status(403).json({ error: 'Permission denied. Only Admin, HR, and IT can approve records.' });
    }
  }

  // Enforce Remarks on disapproval backend validation
  if (action === 'Disapprove' && (!remarks || !remarks.trim())) {
    return res.status(400).json({ error: 'Remarks explaining the reason are required when disapproving.' });
  }

  // Capture old state signatures before setting status
  const oldStats = captureAllOldStats(db);
  const now = new Date().toISOString();

  household.approvalStatus = action === 'RevertPending'
    ? 'Pending'
    : (action === 'Approve' ? 'Approved' : 'Disapproved');
  household.remarks = remarks || (action === 'RevertPending' ? 'Reverted back to pending by master administrator.' : '');
  household.updatedBy = req.currentUser.fullName;
  household.updatedAt = now;
  household.lastModifiedAt = now;

  // Track specific audit attributes
  if (action === 'RevertPending') {
    (household as any).approvedBy = undefined;
    (household as any).approvalDate = undefined;
    (household as any).disapprovedBy = undefined;
    (household as any).disapprovalRemarks = undefined;
  } else if (action === 'Approve') {
    (household as any).approvedBy = req.currentUser.fullName;
    (household as any).approvalDate = now;
    (household as any).disapprovedBy = undefined;
    (household as any).disapprovalRemarks = undefined;
  } else {
    (household as any).disapprovedBy = req.currentUser.fullName;
    (household as any).disapprovalRemarks = remarks || '';
    (household as any).approvedBy = undefined;
    (household as any).approvalDate = undefined;
  }

  // Record audit event in his/her resubmission history list
  if (!(household as any).resubmissionHistory) {
    (household as any).resubmissionHistory = [];
  }
  (household as any).resubmissionHistory.push({
    date: now,
    action: action,
    user: req.currentUser.fullName,
    note: action === 'RevertPending'
      ? (remarks || 'Reverted foldering or file to pending status')
      : (action === 'Approve' ? 'Household fully approved and moved to official database' : `Disapproved: ${remarks}`)
  });

  // Push notifications for the submitter (only Approved and Disapproved households trigger system notifications)
  if (action === 'Approve' || action === 'Disapprove') {
    if (!db.notifications) {
      db.notifications = [];
    }
    db.notifications.push({
      id: generateId('notif'),
      title: action === 'Approve' ? 'Household Submission Approved' : 'Household Submission Disapproved',
      message: action === 'Approve'
        ? 'Your Household submission has been approved.'
        : 'Your Household submission has been disapproved. Please review the remarks, make the necessary corrections, and resubmit.',
      type: action === 'Approve' ? 'SUCCESS' : 'DANGER',
      read: false,
      createdAt: now
    });
  }

  // Auto-create Barangay Folder for Leader's Residential Area if approved
  if (household.approvalStatus === 'Approved') {
    await checkAndAutoCreateBarangayForLeader(db, household);
  }

  await SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Set Household ${household.householdNumber} status to ${household.approvalStatus}`, 'Household Approval');

  // Log Squad / Payroll changes
  logSquadChanges(req.currentUser.fullName, oldStats, db);

  res.json({ success: true, household });
});






// -------------------------------------------------------------
// PMRF BLANK FORMS REAL-TIME LOOKUP & DUPLICATE CHECKS
// -------------------------------------------------------------
app.get('/api/pmrf/search', checkUser, (req: any, res) => {
  const { pin, name } = req.query;
  const db = SaintFrancisDB.getData();
  const results: any[] = [];
  const households = db.households || [];

  for (const h of households) {
    if (!h.pmrfDetails) continue;
    const details = h.pmrfDetails;
    let isMatch = false;

    // PIN matching
    if (pin && typeof pin === 'string' && pin.trim().length > 0) {
      const searchPin = pin.trim().replace(/[^0-9]/g, '');
      const recordPin = (details.pin || '').trim().replace(/[^0-9]/g, '');
      if (searchPin.length > 0 && recordPin.length > 0 && recordPin === searchPin) {
        isMatch = true;
      }
    }

    // Name matching (Last name, First name, Middle Name or Head Name)
    if (!isMatch && name && typeof name === 'string' && name.trim().length > 0) {
      const searchNm = name.trim().toLowerCase();
      const lName = (details.lastName || '').trim().toLowerCase();
      const fName = (details.firstName || '').trim().toLowerCase();
      const mName = (details.middleName || '').trim().toLowerCase();
      const headName = (h.householdHead || '').trim().toLowerCase();

      if (
        (lName && lName.includes(searchNm)) ||
        (fName && fName.includes(searchNm)) ||
        (mName && mName.includes(searchNm)) ||
        (headName && headName.includes(searchNm))
      ) {
        isMatch = true;
      }
    }

    if (isMatch) {
      const dependents = (db.dependents || []).filter(d => d.householdId === h.id);
      let statusStr: any = h.approvalStatus || 'Pending';
      if (h.deletedAt) {
        statusStr = 'Archived';
      }
      results.push({
        id: h.id,
        householdNumber: h.householdNumber,
        householdHead: h.householdHead,
        barangay: h.barangay,
        purok: h.purok,
        approvalStatus: statusStr as any,
        createdAt: h.createdAt,
        pmrfDetails: details,
        dependents: dependents
      });
    }
  }
  res.json(results);
});

app.post('/api/pmrf/check-duplicate', checkUser, (req: any, res) => {
  const { pin, lastName, firstName, birthDate } = req.body;
  const db = SaintFrancisDB.getData();
  let duplicate: any = null;

  for (const h of (db.households || [])) {
    if (!h.pmrfDetails) continue;
    const details = h.pmrfDetails;

    // PIN match
    if (pin && details.pin) {
      const p1 = pin.trim().replace(/[^0-9]/g, '');
      const p2 = details.pin.trim().replace(/[^0-9]/g, '');
      if (p1.length > 0 && p1 === p2) {
        duplicate = h;
        break;
      }
    }

    // Full name + DOB match
    if (lastName && firstName && birthDate && details.lastName && details.firstName) {
      const ln1 = lastName.trim().toLowerCase();
      const fn1 = firstName.trim().toLowerCase();
      const dob1 = birthDate.trim();
      const ln2 = details.lastName.trim().toLowerCase();
      const fn2 = details.firstName.trim().toLowerCase();
      const dob2 = (details.birthDate || details.pmrfBirthDate || '').trim();

      if (ln1 === ln2 && fn1 === fn2 && dob1 === dob2) {
        duplicate = h;
        break;
      }
    }
  }

  if (duplicate) {
    res.json({
      exists: true,
      householdId: duplicate.id,
      householdNumber: duplicate.householdNumber,
      householdHead: duplicate.householdHead,
      pmrfDetails: duplicate.pmrfDetails
    });
  } else {
    res.json({ exists: false });
  }
});


// Consolidated preloaded data endpoint for the Households Page
app.get('/api/households/preload-data', checkUser, async (req: any, res) => {
  try {
    if (shouldAttemptMySQL()) {
      try {
        await SaintFrancisDB.loadFromDB();
      } catch (e) {
        console.error('[LAZY LOAD ERROR] /api/households/preload-data loadFromDB failure:', e);
      }
    }
    const db = SaintFrancisDB.getData();
    const user = req.currentUser;
    const isSystemAdmin = user && (
      hasRole(user, 'ADMIN') || 
      user.position === 'Administrator' ||
      (user.email && (
        user.email.toLowerCase() === 'elthrone1233@gmail.com' ||
        user.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
      ))
    );

    // 1. Enrich & filter Households (identical to /api/households with all=true)
    const households = db.households.filter(h => {
      if (h.approvalStatus === 'Approved') {
        return true;
      }
      if (!isSystemAdmin) {
        const userResArea = (user && user.address || '').trim().toLowerCase();
        const recResArea = (h.barangay || '').trim().toLowerCase();
        if (!userResArea || userResArea !== recResArea) {
          return false;
        }
      }
      if (h.approvalStatus === 'Pending') {
        return true;
      }
      if (h.approvalStatus === 'Disapproved') {
        if (!user) return false;
        return h.submittedByAccountId === user.id || 
               h.createdBy === user.email || 
               h.createdBy === user.fullName || 
               (user.fullName && h.submittedByUsername?.toLowerCase() === user.fullName.toLowerCase()) || 
               (user.email && h.createdBy?.toLowerCase() === user.email.toLowerCase());
      }
      return true;
    });

    const enrichedHouseholds = households.map(h => {
      const matchedDeps = (db.dependents || []).filter(d => d.householdId === h.id);
      const parsedPMRF = ensureParsed(h.pmrfDetails);
      const pmrfDetails = {
        ...parsedPMRF,
        dependents: matchedDeps.map((d: any) => {
          const ln = d.lastName || d.last_name || '';
          const fn = d.firstName || d.first_name || '';
          const mn = d.middleName || d.middle_name || '';
          const ext = d.nameExt || d.name_ext || '';
          const dob = d.birthDate || d.birthdate || d.date_of_birth || '';
          const computedFullName = d.fullName || `${ln}, ${fn}${ext ? ' ' + ext : ''}`.trim().toUpperCase();
          const bNoMn = d.no_mn === 1 || d.no_mn === true || d.noMiddleName === true || d.noMiddleName === 1 || false;
          const bMononym = d.mononym === 1 || d.mononym === true || false;
          const bDisabled = d.isDisabled === 1 || d.isDisabled === true || d.pswd === 1 || d.pswd === true || d.disabled === 1 || d.disabled === true || false;

          return {
            id: d.id,
            fullName: computedFullName,
            age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
            relationship: d.relationship || 'Child',
            birthDate: dob,
            birthdate: dob,
            civilStatus: d.civilStatus || 'Single',
            lastName: ln,
            firstName: fn,
            middleName: mn,
            nameExt: ext,
            last_name: ln,
            first_name: fn,
            middle_name: mn,
            name_ext: ext,
            citizenship: d.citizenship || 'FILIPINO',
            isDisabled: bDisabled,
            disabled: bDisabled,
            pswd: bDisabled,
            noMiddleName: bNoMn,
            noMn: bNoMn,
            no_mn: bNoMn ? 1 : 0,
            mononym: bMononym,
            gender: d.gender || d.sex || 'Female',
            sex: d.sex || d.gender || 'Female'
          };
        })
      };
      return {
        ...h,
        dependents: matchedDeps,
        pmrfDetails
      };
    });

    // 2. Map Masterlist
    const activeHouseholds = db.households.filter(h => !h.deletedAt);
    const hhMap = new Map(activeHouseholds.map(h => [h.id, h]));
    const masterlist: any[] = [];
    const seenNames = new Set<string>();

    activeHouseholds.forEach(h => {
      const rawName = h.householdHead || '';
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (!cleanName) return;
      const nameKey = cleanName.toLowerCase();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        masterlist.push({
          id: h.id,
          householdId: h.id,
          householdNumber: h.householdNumber || '',
          fullName: cleanName,
          gender: h.pmrfDetails?.sex || 'Male',
          birthdate: h.pmrfDetails?.birthDate || h.pmrfDetails?.pmrfBirthDate || '',
          civilStatus: h.pmrfDetails?.civilStatus || h.pmrfDetails?.pmrfCivilStatus || 'Single',
          age: h.pmrfDetails?.birthDate ? (new Date().getFullYear() - new Date(h.pmrfDetails.birthDate).getFullYear()) : 45,
          address: h.completeAddress,
          barangay: h.barangay,
          purok: h.purok,
          recordedBy: h.createdBy,
          dateAdded: (h.createdAt && typeof h.createdAt === 'string') ? h.createdAt.split('T')[0] : '',
          role: 'Household Head',
          attachments: h.attachments || [],
          patientSignature: h.patientSignature || (h.pmrfDetails?.patientSignature) || null,
          pmrfDetails: h.pmrfDetails || null,
          fpeDetails: h.fpeDetails || null,
          pcsfDetails: h.pcsfDetails || null,
          notes: h.statusNotes || '',
          householdHead: h.householdHead,
          householdMobile: h.pmrfDetails?.mobileNo || h.pmrfDetails?.pmrfMobileNo || ''
        });
      }
    });

    db.householdMembers.forEach(m => {
      const hh = hhMap.get(m.householdId);
      if (hh && m.relationship !== 'Head') {
        const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
        const cleanName = rawName.replace(/\s+/g, ' ').trim();
        if (!cleanName || cleanName === ',') return;
        const nameKey = cleanName.toLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          masterlist.push({
            id: m.id,
            householdId: m.householdId,
            householdNumber: hh.householdNumber || '',
            fullName: cleanName,
            gender: m.gender,
            birthdate: m.birthdate || '',
            civilStatus: m.civilStatus || 'Single',
            age: m.age,
            address: hh.completeAddress,
            barangay: hh.barangay,
            purok: hh.purok,
            recordedBy: hh.createdBy,
            dateAdded: (hh.createdAt && typeof hh.createdAt === 'string') ? hh.createdAt.split('T')[0] : '',
            role: `Member - ${m.relationship}`,
            attachments: hh.attachments || [],
            patientSignature: hh.patientSignature || (hh.pmrfDetails?.patientSignature) || null,
            pmrfDetails: hh.pmrfDetails || null,
            fpeDetails: hh.fpeDetails || null,
            pcsfDetails: hh.pcsfDetails || null,
            notes: hh.statusNotes || '',
            householdHead: hh.householdHead,
            householdMobile: hh.pmrfDetails?.mobileNo || hh.pmrfDetails?.pmrfMobileNo || ''
          });
        }
      }
    });

    db.dependents.forEach(d => {
      const hh = hhMap.get(d.householdId);
      if (hh) {
        const rawName = d.fullName || `${d.lastName}, ${d.firstName} ${d.middleName || ''}`;
        const cleanName = rawName.replace(/\s+/g, ' ').trim();
        if (!cleanName || cleanName === ',') return;
        const nameKey = cleanName.toLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          masterlist.push({
            id: d.id,
            householdId: d.householdId,
            householdNumber: hh.householdNumber || '',
            fullName: cleanName,
            gender: d.gender || 'Female',
            birthdate: d.birthdate || d.birthDate || '',
            civilStatus: d.civilStatus || 'Single',
            age: d.age,
            address: hh.completeAddress,
            barangay: hh.barangay,
            purok: hh.purok,
            recordedBy: hh.createdBy,
            dateAdded: (hh.createdAt && typeof hh.createdAt === 'string') ? hh.createdAt.split('T')[0] : '',
            role: `Dependent - ${d.relationship || 'Child'}`,
            attachments: hh.attachments || [],
            patientSignature: hh.patientSignature || (hh.pmrfDetails?.patientSignature) || null,
            pmrfDetails: hh.pmrfDetails || null,
            fpeDetails: hh.fpeDetails || null,
            pcsfDetails: hh.pcsfDetails || null,
            notes: hh.statusNotes || '',
            householdHead: hh.householdHead,
            householdMobile: hh.pmrfDetails?.mobileNo || hh.pmrfDetails?.pmrfMobileNo || ''
          });
        }
      }
    });

    // 3. Map Barangays
    const barangays = db.barangays.map(b => {
      const hInBrg = activeHouseholds.filter(h => h.barangay === b.name);
      const totalH = hInBrg.length;
      const approvedH = hInBrg.filter(h => h.approvalStatus === 'Approved').length;
      const pmrfCount = hInBrg.filter(h => h.pmrfStatus === 'Willing').length;
      const yakapCount = hInBrg.filter(h => h.yakapWillingStatus === 'Willing').length;
      const puroksCount = db.puroks.filter(p => p.barangay === b.name).length;
      const householdProgressBar = totalH > 0 ? Math.round((approvedH / totalH) * 100) : 0;
      const pmrfProgressBar = totalH > 0 ? Math.round((pmrfCount / totalH) * 100) : 0;
      const hhIds = hInBrg.map(h => h.id);
      const memberCount = db.householdMembers.filter(m => hhIds.includes(m.householdId)).length;
      const membersProgressBar = totalH > 0 ? Math.min(100, Math.round((memberCount / (totalH * 3)) * 100)) : 0;

      return {
        ...b,
        puroksCount,
        householdProgressBar,
        pmrfProgressBar,
        membersProgressBar,
        yakapWillingCount: yakapCount
      };
    });

    // 4. Map Puroks
    const puroks = db.puroks.map(p => {
      const hInPrk = activeHouseholds.filter(h => h.purok === p.name && h.barangay === p.barangay);
      const householdCount = hInPrk.length;
      const pmrfCount = hInPrk.filter(h => h.pmrfStatus === 'Willing').length;
      const yakapCount = hInPrk.filter(h => h.yakapWillingStatus === 'Willing').length;
      const hhIds = hInPrk.map(h => h.id);
      const memberCount = db.householdMembers.filter(m => hhIds.includes(m.householdId)).length;

      return {
        ...p,
        householdCount,
        memberCount,
        pmrfCount,
        yakapWillingCount: yakapCount
      };
    });

    res.json({
      households: enrichedHouseholds,
      masterlist,
      barangays,
      puroks
    });
  } catch (error: any) {
    console.error('Error in /api/households/preload-data:', error);
    res.status(500).json({ error: error.message || 'Internal server error while preloading households data.' });
  }
});


// Complete incremental and live background synchronization endpoint
app.get('/api/sync', checkUser, async (req: any, res) => {
  try {
    if (shouldAttemptMySQL()) {
      try {
        await SaintFrancisDB.loadFromDB();
      } catch (e) {
        console.error('[LAZY LOAD ERROR] /api/sync loadFromDB failure:', e);
      }
    }
    const db = SaintFrancisDB.getData();
    const user = req.currentUser;
    const since = parseInt(req.query.since as string) || 0;
    const isSystemAdmin = user && (
      hasRole(user, 'ADMIN') || 
      user.position === 'Administrator' ||
      (user.email && (
        user.email.toLowerCase() === 'elthrone1233@gmail.com' ||
        user.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
      ))
    );

    const isIncremental = since > 0;

    // Filter households based on privacy security rules
    const households = db.households.filter(h => {
      if (h.approvalStatus === 'Approved') {
        return true;
      }
      if (!isSystemAdmin) {
        const userResArea = (user && user.address || '').trim().toLowerCase();
        const recResArea = (h.barangay || '').trim().toLowerCase();
        if (!userResArea || userResArea !== recResArea) {
          return false;
        }
      }
      if (h.approvalStatus === 'Pending') {
        return true;
      }
      if (h.approvalStatus === 'Disapproved') {
        if (!user) return false;
        return h.submittedByAccountId === user.id || 
               h.createdBy === user.email || 
               h.createdBy === user.fullName || 
               (user.fullName && h.submittedByUsername?.toLowerCase() === user.fullName.toLowerCase()) || 
               (user.email && h.createdBy?.toLowerCase() === user.email.toLowerCase());
      }
      return true;
    });

    // Sub-select records updated after the since timestamp if incremental
    const filterBySince = (item: any) => {
      if (!isIncremental) return true;
      const t = Math.max(
        item.updatedAt ? new Date(item.updatedAt).getTime() : 0,
        item.createdAt ? new Date(item.createdAt).getTime() : 0,
        item.deletedAt ? new Date(item.deletedAt).getTime() : 0,
        item.lastModifiedAt ? new Date(item.lastModifiedAt).getTime() : 0,
        item.dateSubmitted ? new Date(item.dateSubmitted).getTime() : 0,
        item.submissionDateTime ? new Date(item.submissionDateTime).getTime() : 0,
        item.approvedDate ? new Date(item.approvedDate).getTime() : 0
      );
      return t >= since;
    };

    const syncedHouseholds = households.filter(filterBySince);

    // Pre-group dependents by householdId for O(1) performance lookup inside the map loop
    const dependentsByHouseholdIdSync = new Map<string, any[]>();
    for (const d of db.dependents || []) {
      if (d && d.householdId) {
        if (!dependentsByHouseholdIdSync.has(d.householdId)) {
          dependentsByHouseholdIdSync.set(d.householdId, []);
        }
        dependentsByHouseholdIdSync.get(d.householdId)!.push(d);
      }
    }

    const enrichedHouseholds = syncedHouseholds.map(h => {
      const matchedDeps = dependentsByHouseholdIdSync.get(h.id) || [];
      const parsedPMRF = ensureParsed(h.pmrfDetails);
      const pmrfDetails = {
        ...parsedPMRF,
        dependents: matchedDeps.map((d: any) => {
          const ln = d.lastName || d.last_name || '';
          const fn = d.firstName || d.first_name || '';
          const mn = d.middleName || d.middle_name || '';
          const ext = d.nameExt || d.name_ext || '';
          const dob = d.birthDate || d.birthdate || d.date_of_birth || '';
          const computedFullName = d.fullName || `${ln}, ${fn}${ext ? ' ' + ext : ''}`.trim().toUpperCase();
          const bNoMn = d.no_mn === 1 || d.no_mn === true || d.noMiddleName === true || d.noMiddleName === 1 || false;
          const bMononym = d.mononym === 1 || d.mononym === true || false;
          const bDisabled = d.isDisabled === 1 || d.isDisabled === true || d.pswd === 1 || d.pswd === true || d.disabled === 1 || d.disabled === true || false;

          return {
            id: d.id,
            fullName: computedFullName,
            age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
            relationship: d.relationship || 'Child',
            birthDate: dob,
            birthdate: dob,
            civilStatus: d.civilStatus || 'Single',
            lastName: ln,
            firstName: fn,
            middleName: mn,
            nameExt: ext,
            noMiddleName: bNoMn,
            mononym: bMononym,
            citizenship: d.citizenship || 'FILIPINO',
            isDisabled: bDisabled,
            pmrfSubmissionId: d.pmrfSubmissionId || '',
            pmrfRecordId: d.pmrfRecordId || '',
            memberPin: d.memberPin || d.pin || ''
          };
        })
      };

      return {
        ...h,
        dependents: matchedDeps,
        pmrfDetails,
        fpeDetails: ensureParsed(h.fpeDetails),
        pcsfDetails: ensureParsed(h.pcsfDetails)
      };
    });

    // Re-create the masterlist following identical logic but filtered by since
    const activeHouseholds = db.households.filter(h => !h.deletedAt);
    const hhMap = new Map(activeHouseholds.map(h => [h.id, h]));
    const masterlist: any[] = [];
    const seenNames = new Set<string>();

    activeHouseholds.forEach(h => {
      const rawName = h.householdHead || '';
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (!cleanName) return;
      const nameKey = cleanName.toLowerCase();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        
        const recordTime = Math.max(
          h.updatedAt ? new Date(h.updatedAt).getTime() : 0,
          h.createdAt ? new Date(h.createdAt).getTime() : 0,
          h.lastModifiedAt ? new Date(h.lastModifiedAt).getTime() : 0
        );

        if (!isIncremental || recordTime >= since) {
          const pin = h.pmrfDetails?.pin || h.pmrfDetails?.pmrfPin || '';
          masterlist.push({
            id: h.id,
            householdId: h.id,
            householdNumber: h.householdNumber || '',
            fullName: cleanName,
            gender: h.pmrfDetails?.sex || 'Male',
            birthdate: h.pmrfDetails?.birthDate || h.pmrfDetails?.pmrfBirthDate || '',
            civilStatus: h.pmrfDetails?.civilStatus || h.pmrfDetails?.pmrfCivilStatus || 'Single',
            age: h.pmrfDetails?.birthDate ? (new Date().getFullYear() - new Date(h.pmrfDetails.birthDate).getFullYear()) : 45,
            address: h.completeAddress,
            barangay: h.barangay,
            purok: h.purok,
            recordedBy: h.createdBy,
            dateAdded: (h.createdAt && typeof h.createdAt === 'string') ? h.createdAt.split('T')[0] : '',
            role: 'Household Head',
            attachments: [],
            patientSignature: (h.patientSignature || h.pmrfDetails?.patientSignature) ? "PRESENT" : null,
            pmrfDetails: h.pmrfDetails ? { exists: true, pin } : null,
            fpeDetails: h.fpeDetails ? { exists: true } : null,
            pcsfDetails: h.pcsfDetails ? { exists: true } : null,
            notes: h.statusNotes || '',
            householdHead: h.householdHead,
            householdMobile: h.pmrfDetails?.mobileNo || h.pmrfDetails?.pmrfMobileNo || '',
            pin
          });
        }
      }
    });

    db.householdMembers.forEach(m => {
      const hh = hhMap.get(m.householdId);
      if (hh && m.relationship !== 'Head') {
        const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
        const cleanName = rawName.replace(/\s+/g, ' ').trim();
        if (!cleanName || cleanName === ',') return;
        const nameKey = cleanName.toLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);

          const recordTime = Math.max(
            (m as any).createdAt ? new Date((m as any).createdAt).getTime() : 0,
            (m as any).updatedAt ? new Date((m as any).updatedAt).getTime() : 0,
            hh.updatedAt ? new Date(hh.updatedAt).getTime() : 0,
            hh.createdAt ? new Date(hh.createdAt).getTime() : 0
          );

          if (!isIncremental || recordTime >= since) {
            const mPin = (m as any).memberPin || '';
            masterlist.push({
              id: m.id,
              householdId: m.householdId,
              householdNumber: hh.householdNumber || '',
              fullName: cleanName,
              gender: m.gender,
              birthdate: m.birthdate || '',
              civilStatus: m.civilStatus || 'Single',
              age: m.age,
              address: hh.completeAddress,
              barangay: hh.barangay,
              purok: hh.purok,
              recordedBy: hh.createdBy,
              dateAdded: (hh.createdAt && typeof hh.createdAt === 'string') ? hh.createdAt.split('T')[0] : '',
              role: `Member - ${m.relationship}`,
              attachments: [],
              patientSignature: (hh.patientSignature || hh.pmrfDetails?.patientSignature) ? "PRESENT" : null,
              pmrfDetails: hh.pmrfDetails ? { exists: true, pin: mPin } : null,
              fpeDetails: hh.fpeDetails ? { exists: true } : null,
              pcsfDetails: hh.pcsfDetails ? { exists: true } : null,
              notes: hh.statusNotes || '',
              householdHead: hh.householdHead,
              householdMobile: hh.pmrfDetails?.mobileNo || hh.pmrfDetails?.pmrfMobileNo || '',
              pin: mPin
            });
          }
        }
      }
    });

    db.dependents.forEach(d => {
      const hh = hhMap.get(d.householdId);
      if (hh) {
        const rawName = d.fullName || `${d.lastName}, ${d.firstName} ${d.middleName || ''}`;
        const cleanName = rawName.replace(/\s+/g, ' ').trim();
        if (!cleanName || cleanName === ',') return;
        const nameKey = cleanName.toLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);

          const recordTime = Math.max(
            (d as any).createdAt ? new Date((d as any).createdAt).getTime() : 0,
            (d as any).updatedAt ? new Date((d as any).updatedAt).getTime() : 0,
            hh.updatedAt ? new Date(hh.updatedAt).getTime() : 0,
            hh.createdAt ? new Date(hh.createdAt).getTime() : 0
          );

          if (!isIncremental || recordTime >= since) {
            const dPin = d.memberPin || '';
            masterlist.push({
              id: d.id,
              householdId: d.householdId,
              householdNumber: hh.householdNumber || '',
              fullName: cleanName,
              gender: d.gender || 'Female',
              birthdate: d.birthdate || d.birthDate || '',
              civilStatus: d.civilStatus || 'Single',
              age: d.age,
              address: hh.completeAddress,
              barangay: hh.barangay,
              purok: hh.purok,
              recordedBy: hh.createdBy,
              dateAdded: (hh.createdAt && typeof hh.createdAt === 'string') ? hh.createdAt.split('T')[0] : '',
              role: `Dependent - ${d.relationship || 'Child'}`,
              attachments: [],
              patientSignature: (hh.patientSignature || hh.pmrfDetails?.patientSignature) ? "PRESENT" : null,
              pmrfDetails: hh.pmrfDetails ? { exists: true, pin: dPin } : null,
              fpeDetails: hh.fpeDetails ? { exists: true } : null,
              pcsfDetails: hh.pcsfDetails ? { exists: true } : null,
              notes: hh.statusNotes || '',
              householdHead: hh.householdHead,
              householdMobile: hh.pmrfDetails?.mobileNo || hh.pmrfDetails?.pmrfMobileNo || '',
              pin: dPin
            });
          }
        }
      }
    });

    // Map Barangays and Puroks with high-performance O(1) indices
    const householdsByBrg = new Map<string, any[]>();
    const householdsByPurokKey = new Map<string, any[]>();
    activeHouseholds.forEach(h => {
      const brg = h.barangay || '';
      if (!householdsByBrg.has(brg)) {
        householdsByBrg.set(brg, []);
      }
      householdsByBrg.get(brg)!.push(h);

      const prk = h.purok || '';
      const key = `${brg}_${prk}`;
      if (!householdsByPurokKey.has(key)) {
        householdsByPurokKey.set(key, []);
      }
      householdsByPurokKey.get(key)!.push(h);
    });

    const membersByHhId = new Map<string, any[]>();
    for (const m of db.householdMembers || []) {
      if (m && m.householdId) {
        if (!membersByHhId.has(m.householdId)) {
          membersByHhId.set(m.householdId, []);
        }
        membersByHhId.get(m.householdId)!.push(m);
      }
    }

    const puroksByBrg = new Map<string, any[]>();
    for (const p of db.puroks || []) {
      const brg = p.barangay || '';
      if (!puroksByBrg.has(brg)) {
        puroksByBrg.set(brg, []);
      }
      puroksByBrg.get(brg)!.push(p);
    }

    const barangays = db.barangays.map(b => {
      const hInBrg = householdsByBrg.get(b.name) || [];
      const totalH = hInBrg.length;
      
      let approvedH = 0;
      let pmrfCount = 0;
      let yakapCount = 0;
      let memberCount = 0;

      for (const h of hInBrg) {
        if (h.approvalStatus === 'Approved') approvedH++;
        if (h.pmrfStatus === 'Willing') pmrfCount++;
        if (h.yakapWillingStatus === 'Willing') yakapCount++;
        
        const mList = membersByHhId.get(h.id);
        if (mList) memberCount += mList.length;
      }

      const puroksCount = (puroksByBrg.get(b.name) || []).length;
      const householdProgressBar = totalH > 0 ? Math.round((approvedH / totalH) * 100) : 0;
      const pmrfProgressBar = totalH > 0 ? Math.round((pmrfCount / totalH) * 100) : 0;
      const membersProgressBar = totalH > 0 ? Math.min(100, Math.round((memberCount / (totalH * 3)) * 100)) : 0;

      return {
        ...b,
        puroksCount,
        householdProgressBar,
        pmrfProgressBar,
        membersProgressBar,
        yakapWillingCount: yakapCount
      };
    });

    const puroks = db.puroks.map(p => {
      const key = `${p.barangay || ''}_${p.name || ''}`;
      const hInPrk = householdsByPurokKey.get(key) || [];
      const householdCount = hInPrk.length;
      
      let pmrfCount = 0;
      let yakapCount = 0;
      let memberCount = 0;

      for (const h of hInPrk) {
        if (h.pmrfStatus === 'Willing') pmrfCount++;
        if (h.yakapWillingStatus === 'Willing') yakapCount++;
        
        const mList = membersByHhId.get(h.id);
        if (mList) memberCount += mList.length;
      }

      return {
        ...p,
        householdCount,
        memberCount,
        pmrfCount,
        yakapWillingCount: yakapCount
      };
    });

    // Notifications filtered by since
    const notifications = (db.notifications || []).filter(n => {
      if (!isIncremental) return true;
      const recordTime = n.createdAt ? new Date(n.createdAt).getTime() : 0;
      return recordTime >= since;
    });

    // Statistics
    const totalApproved = db.households.filter(h => h.approvalStatus === 'Approved' && !h.deletedAt).length;
    const totalPending = db.households.filter(h => h.approvalStatus === 'Pending' && !h.deletedAt).length;
    const totalDisapproved = db.households.filter(h => h.approvalStatus === 'Disapproved' && !h.deletedAt).length;
    const totalTrash = db.households.filter(h => h.deletedAt).length;
    const totalMembers = db.householdMembers.length;
    const totalDependents = db.dependents.length;
    const stats = {
      totalApproved,
      totalPending,
      totalDisapproved,
      totalTrash,
      totalMembers,
      totalDependents,
      timestamp: new Date().toISOString()
    };

    res.json({
      timestamp: Date.now(),
      isIncremental,
      households: enrichedHouseholds,
      masterlist,
      barangays,
      puroks,
      stats,
      notifications
    });
  } catch (err: any) {
    console.error('[SYNC ERROR] /api/sync failure:', err);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});


// -------------------------------------------------------------
// 6. HOUSEHOLDS MODULE API (CRUD + tabs + soft-delete)
// -------------------------------------------------------------
app.get('/api/households', checkUser, async (req: any, res) => {
  try {
    if (shouldAttemptMySQL()) {
      try {
        await SaintFrancisDB.loadFromDB();
      } catch (e) {
        console.error('[LAZY LOAD ERROR] /api/households loadFromDB failure:', e);
      }
    }
    const db = SaintFrancisDB.getData();
    const showAll = req.query.all !== 'false';
    const user = req.currentUser;
    const isSystemAdmin = user && (
      hasRole(user, 'ADMIN') || 
      user.position === 'Administrator' ||
      (user.email && (
        user.email.toLowerCase() === 'elthrone1233@gmail.com' ||
        user.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
      ))
    );

    // If showAll is true, return all active and pending/disapproved households conforming to privacy rules
    const households = db.households.filter(h => {
      // Approved records are visible to all authorized roles in Households page
      if (h.approvalStatus === 'Approved') {
        return true;
      }
      if (!showAll) {
        return false; // only Approved in non-showAll mode
      }

      // Security Rule Check for non-admins regarding Pending and Disapproved Submissions
      if (!isSystemAdmin) {
        const userResArea = (user && user.address || '').trim().toLowerCase();
        const recResArea = (h.barangay || '').trim().toLowerCase();
        if (!userResArea || userResArea !== recResArea) {
          return false; // Users cannot view submissions (Pending or Disapproved) from other Residential Areas.
        }
      }

      // For showAll (Pending and Disapproved)
      if (h.approvalStatus === 'Pending') {
        return true;
      }
      if (h.approvalStatus === 'Disapproved') {
        if (!user) return false;
        return h.submittedByAccountId === user.id || 
               h.createdBy === user.email || 
               h.createdBy === user.fullName || 
               (user.fullName && h.submittedByUsername?.toLowerCase() === user.fullName.toLowerCase()) || 
               (user.email && h.createdBy?.toLowerCase() === user.email.toLowerCase());
      }
      return true;
    });

    // Pre-group dependents by householdId for O(1) performance lookup inside the map loop
    const dependentsByHouseholdId = new Map<string, any[]>();
    for (const d of db.dependents || []) {
      if (d && d.householdId) {
        if (!dependentsByHouseholdId.has(d.householdId)) {
          dependentsByHouseholdId.set(d.householdId, []);
        }
        dependentsByHouseholdId.get(d.householdId)!.push(d);
      }
    }

    const enrichedHouseholds = households.map(h => {
      const matchedDeps = dependentsByHouseholdId.get(h.id) || [];
      const parsedPMRF = ensureParsed(h.pmrfDetails);
      
      const pmrfDetails = {
        ...parsedPMRF,
        dependents: matchedDeps.map((d: any) => {
          const ln = d.lastName || d.last_name || '';
          const fn = d.firstName || d.first_name || '';
          const mn = d.middleName || d.middle_name || '';
          const ext = d.nameExt || d.name_ext || '';
          const dob = d.birthDate || d.birthdate || d.date_of_birth || '';
          const computedFullName = d.fullName || `${ln}, ${fn}${ext ? ' ' + ext : ''}`.trim().toUpperCase();
          const bNoMn = d.no_mn === 1 || d.no_mn === true || d.noMiddleName === true || d.noMiddleName === 1 || false;
          const bMononym = d.mononym === 1 || d.mononym === true || false;
          const bDisabled = d.isDisabled === 1 || d.isDisabled === true || d.pswd === 1 || d.pswd === true || d.disabled === 1 || d.disabled === true || false;

          return {
            id: d.id,
            fullName: computedFullName,
            age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
            relationship: d.relationship || 'Child',
            birthDate: dob,
            birthdate: dob,
            civilStatus: d.civilStatus || 'Single',
            lastName: ln,
            firstName: fn,
            middleName: mn,
            nameExt: ext,
            last_name: ln,
            first_name: fn,
            middle_name: mn,
            name_ext: ext,
            citizenship: d.citizenship || 'FILIPINO',
            isDisabled: bDisabled,
            disabled: bDisabled,
            pswd: bDisabled,
            noMiddleName: bNoMn,
            noMn: bNoMn,
            no_mn: bNoMn ? 1 : 0,
            mononym: bMononym,
            gender: d.gender || d.sex || 'Female',
            sex: d.sex || d.gender || 'Female'
          };
        })
      };
      
      return {
        ...h,
        dependents: matchedDeps,
        pmrfDetails
      };
    });

    res.json(enrichedHouseholds);
  } catch (error: any) {
    console.error('Error in /api/households:', error);
    res.status(500).json({ error: error.message || 'Internal server error while fetching households' });
  }
});

// Active household editing/view locks storage
const householdLocks = new Map<string, {
  email: string;
  name: string;
  clientId: string;
  timestamp: number;
  lastActive: number;
}>();

// Housekeeping interval to clean up expired locks every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, lock] of householdLocks.entries()) {
    // Locks expire after 35 seconds of inactivity (heartbeat interval is 15 seconds)
    if (now - lock.lastActive > 35000) {
      householdLocks.delete(id);
    }
  }
}, 10000);

// Lock household endpoint
app.post('/api/households/:id/lock', (req: any, res) => {
  const { id } = req.params;
  const { email, name, clientId } = req.body;

  if (!email || !clientId) {
    return res.status(400).json({ error: 'Missing required lock properties: email and clientId.' });
  }

  const existingLock = householdLocks.get(id);
  if (existingLock) {
    // If lock is held by a different client/device
    if (existingLock.clientId !== clientId) {
      return res.status(200).json({
        success: false,
        lockedBy: {
          name: existingLock.name,
          email: existingLock.email
        }
      });
    }
    // If same client, update lastActive and return success
    existingLock.lastActive = Date.now();
    return res.json({ success: true });
  }

  // Register new lock
  householdLocks.set(id, {
    email,
    name: name || email,
    clientId,
    timestamp: Date.now(),
    lastActive: Date.now()
  });

  res.json({ success: true });
});

// Unlock household endpoint
app.post('/api/households/:id/unlock', (req: any, res) => {
  const { id } = req.params;
  const { clientId } = req.body;

  const existingLock = householdLocks.get(id);
  if (existingLock && existingLock.clientId === clientId) {
    householdLocks.delete(id);
  }

  res.json({ success: true });
});

// Heartbeat to keep lock alive
app.post('/api/households/:id/heartbeat', (req: any, res) => {
  const { id } = req.params;
  const { clientId } = req.body;

  const existingLock = householdLocks.get(id);
  if (existingLock && existingLock.clientId === clientId) {
    existingLock.lastActive = Date.now();
  }

  res.json({ success: true });
});

// Full tags fetch
app.get('/api/households/:id/all', checkUser, async (req: any, res) => {
  const { id } = req.params;
  const db = SaintFrancisDB.getData();
  const household = db.households.find(h => h.id === id && !h.deletedAt);

  if (!household) {
    return res.status(404).json({ error: 'No records found.' });
  }

  // Security check: if disapproved, can only view if original submitter
  if (household.approvalStatus === 'Disapproved') {
    const user = req.currentUser;
    const isOwner = user && (
      household.submittedByAccountId === user.id || 
      household.createdBy === user.email || 
      household.createdBy === user.fullName || 
      (user.fullName && household.submittedByUsername?.toLowerCase() === user.fullName.toLowerCase()) || 
      (user.email && household.createdBy?.toLowerCase() === user.email.toLowerCase())
    );
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: You can only view your own disapproved submissions.' });
    }
  }

  const members = db.householdMembers.filter(m => m.householdId === id);
  
  let matchedDeps: any[] = [];
  const pool = getMySQLPool();
  if (pool) {
    try {
      const [rows]: any = await pool.query('SELECT * FROM pmrf_dependents WHERE pmrf_id = ?', [id]);
      if (rows && Array.isArray(rows)) {
        matchedDeps = rows;
      }
    } catch (err: any) {
      console.error(`[DATABASE ERROR] /api/households/:id/all dependents fetch failed:`, err);
      matchedDeps = db.dependents.filter(d => d.householdId === id);
    }
  } else {
    matchedDeps = db.dependents.filter(d => d.householdId === id);
  }

  const dependents = matchedDeps.map(d => {
    const ln = d.last_name || d.lastName || '';
    const fn = d.first_name || d.firstName || '';
    const mn = d.middle_name || d.middleName || '';
    const ext = d.name_ext || d.nameExt || '';
    const computedFullName = `${ln}, ${fn}${ext ? ' ' + ext : ''}`.trim().toUpperCase();
    const birth = d.date_of_birth || d.birthDate || d.birthdate || '';
    const gender = d.sex || d.gender || 'Female';

    return {
      id: d.id,
      householdId: d.pmrf_id || d.householdId || id,
      fullName: computedFullName,
      gender: gender,
      sex: gender,
      age: d.age !== undefined && d.age !== null ? parseInt(d.age as any) : 0,
      relationship: d.relationship || 'Child',
      birthDate: birth,
      birthdate: birth,
      date_of_birth: birth,
      civilStatus: d.civilStatus || 'Single',
      lastName: ln,
      firstName: fn,
      middleName: mn,
      nameExt: ext,
      last_name: ln,
      first_name: fn,
      middle_name: mn,
      name_ext: ext,
      noMiddleName: d.no_mn === 1 || d.noMiddleName === true,
      no_mn: d.no_mn === 1 || d.no_mn === true ? 1 : 0,
      mononym: d.mononym === 1 || d.mononym === true,
      citizenship: d.citizenship || 'FILIPINO',
      isDisabled: d.isDisabled === 1 || d.isDisabled === true,
      pmrfSubmissionId: d.pmrfSubmissionId || d.submission_id || null,
      pmrfRecordId: d.pmrf_id || d.pmrfRecordId || null,
      memberPin: d.memberPin || null,
      submittedByAccountId: d.submittedByAccountId || null,
      createdAt: d.createdAt || null,
      pswd: d.pswd === 1 || d.pswd === true
    };
  });

  const healthRecords = db.healthRecords.filter(hr => hr.householdId === id);
  const logs = db.activityLogs.filter(log => log.action.includes(household.householdNumber) || log.action.includes(household.householdHead));

  res.json({
    household,
    members,
    dependents,
    healthRecords,
    logs
  });
});

// =============================================================================
// HOUSEHOLD DRAFTS ENDPOINTS
// =============================================================================
app.get('/api/drafts', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const accountId = req.currentUser.email;
  const userDrafts = (db.drafts || []).filter((d: any) => d.accountId === accountId);
  res.json(userDrafts);
});

function safeRestoreAttachments(incomingList: any[], originalSourceList: any[]): any[] {
  if (!Array.isArray(incomingList)) return [];
  if (!Array.isArray(originalSourceList)) return incomingList;

  return incomingList.map((inc: any, idx: number) => {
    // If incoming is null/undefined, skip
    if (!inc) return inc;

    // Is incoming a placeholder string?
    if (typeof inc === 'string') {
      if (inc === "[File Data Preserved in Cloud Upload]") {
        // Fallback to match by index
        const originalAtIdx = originalSourceList[idx];
        if (originalAtIdx) {
          return originalAtIdx;
        }
        return inc;
      }
      // It's a real base64 image or file URL, return as-is
      return inc;
    }

    // Is incoming an object?
    if (typeof inc === 'object') {
      const isPlaceholder = inc.fileData === "[File Data Preserved in Cloud Upload]" || !inc.fileData;
      if (isPlaceholder) {
        // Try to find a match in the original list
        let match: any = null;

        // 1. Match by id
        if (inc.id) {
          match = originalSourceList.find(ext => ext && typeof ext === 'object' && ext.id === inc.id);
        }
        // 2. Match by fileName
        if (!match && inc.fileName) {
          match = originalSourceList.find(ext => ext && typeof ext === 'object' && (ext.fileName === inc.fileName || ext.fullName === inc.fileName));
        }
        // 3. Fallback to index match
        if (!match) {
          match = originalSourceList[idx];
        }

        if (match) {
          // Extract actual file data from the match
          let actualFileData = '';
          if (typeof match === 'string') {
            if (match !== "[File Data Preserved in Cloud Upload]") {
              actualFileData = match;
            }
          } else if (typeof match === 'object' && match.fileData && match.fileData !== "[File Data Preserved in Cloud Upload]") {
            actualFileData = match.fileData;
          }

          if (actualFileData) {
            // Keep all metadata of incoming, only update the fileData
            return {
              ...inc,
              fileData: actualFileData
            };
          }
        }
      }
      return inc;
    }

    return inc;
  });
}

function restorePreservedDraftData(incoming: any, existing: any) {
  if (!incoming || !existing) return;
  const incFD = incoming.formData ? incoming.formData : incoming;
  const extFD = existing.formData ? existing.formData : existing;

  if (incFD && extFD) {
    if (incFD.patientSignature === "[Signature Preserved in Cloud Upload]" || !incFD.patientSignature) {
      if (extFD.patientSignature && extFD.patientSignature !== "[Signature Preserved in Cloud Upload]") {
        incFD.patientSignature = extFD.patientSignature;
      }
    }
    if (incFD.pmrfBackSignature === "[Signature Preserved in Cloud Upload]" || !incFD.pmrfBackSignature) {
      if (extFD.pmrfBackSignature && extFD.pmrfBackSignature !== "[Signature Preserved in Cloud Upload]") {
        incFD.pmrfBackSignature = extFD.pmrfBackSignature;
      }
    }
    if (incFD.pmrfBackThumbmark === "[Thumbmark Preserved in Cloud Upload]" || !incFD.pmrfBackThumbmark) {
      if (extFD.pmrfBackThumbmark && extFD.pmrfBackThumbmark !== "[Thumbmark Preserved in Cloud Upload]") {
        incFD.pmrfBackThumbmark = extFD.pmrfBackThumbmark;
      }
    }

    if (Array.isArray(incFD.attachmentsList) && Array.isArray(extFD.attachmentsList)) {
      incFD.attachmentsList = safeRestoreAttachments(incFD.attachmentsList, extFD.attachmentsList);
    }
  }
}

function restorePreservedHouseholdData(householdData: any, db: any, draftId: string | null | undefined) {
  if (!householdData || !draftId || !db || !db.drafts) return;
  const draft = db.drafts.find((d: any) => d.id === draftId);
  if (!draft) return;
  const draftFD = draft.formData ? draft.formData : draft;
  if (!draftFD) return;

  // Restore signatures in PMRF details
  if (householdData.pmrfDetails && draftFD) {
    if (householdData.pmrfDetails.patientSignature === "[Signature Preserved in Cloud Upload]" || !householdData.pmrfDetails.patientSignature) {
      if (draftFD.patientSignature && draftFD.patientSignature !== "[Signature Preserved in Cloud Upload]") {
        householdData.pmrfDetails.patientSignature = draftFD.patientSignature;
      }
    }
    if (householdData.pmrfDetails.pmrfBackSignature === "[Signature Preserved in Cloud Upload]" || !householdData.pmrfDetails.pmrfBackSignature) {
      if (draftFD.pmrfBackSignature && draftFD.pmrfBackSignature !== "[Signature Preserved in Cloud Upload]") {
        householdData.pmrfDetails.pmrfBackSignature = draftFD.pmrfBackSignature;
      }
    }
    if (householdData.pmrfDetails.pmrfBackThumbmark === "[Thumbmark Preserved in Cloud Upload]" || !householdData.pmrfDetails.pmrfBackThumbmark) {
      if (draftFD.pmrfBackThumbmark && draftFD.pmrfBackThumbmark !== "[Thumbmark Preserved in Cloud Upload]") {
        householdData.pmrfDetails.pmrfBackThumbmark = draftFD.pmrfBackThumbmark;
      }
    }
  }

  // Restore overall signatures
  if (householdData.patientSignature === "[Signature Preserved in Cloud Upload]" || !householdData.patientSignature) {
    if (draftFD.patientSignature && draftFD.patientSignature !== "[Signature Preserved in Cloud Upload]") {
      householdData.patientSignature = draftFD.patientSignature;
    }
  }

  // Restore attachments
  if (Array.isArray(householdData.attachments) && Array.isArray(draftFD.attachmentsList)) {
    householdData.attachments = safeRestoreAttachments(householdData.attachments, draftFD.attachmentsList);
  }
}

function restorePreservedHouseholdFromExisting(updatedHousehold: any, originalHousehold: any) {
  if (!updatedHousehold || !originalHousehold) return;

  // Restore signatures in PMRF details
  if (updatedHousehold.pmrfDetails && originalHousehold.pmrfDetails) {
    if (updatedHousehold.pmrfDetails.patientSignature === "[Signature Preserved in Cloud Upload]" || !updatedHousehold.pmrfDetails.patientSignature) {
      if (originalHousehold.pmrfDetails.patientSignature && originalHousehold.pmrfDetails.patientSignature !== "[Signature Preserved in Cloud Upload]") {
        updatedHousehold.pmrfDetails.patientSignature = originalHousehold.pmrfDetails.patientSignature;
      }
    }
    if (updatedHousehold.pmrfDetails.pmrfBackSignature === "[Signature Preserved in Cloud Upload]" || !updatedHousehold.pmrfDetails.pmrfBackSignature) {
      if (originalHousehold.pmrfDetails.pmrfBackSignature && originalHousehold.pmrfDetails.pmrfBackSignature !== "[Signature Preserved in Cloud Upload]") {
        updatedHousehold.pmrfDetails.pmrfBackSignature = originalHousehold.pmrfDetails.pmrfBackSignature;
      }
    }
    if (updatedHousehold.pmrfDetails.pmrfBackThumbmark === "[Thumbmark Preserved in Cloud Upload]" || !updatedHousehold.pmrfDetails.pmrfBackThumbmark) {
      if (originalHousehold.pmrfDetails.pmrfBackThumbmark && originalHousehold.pmrfDetails.pmrfBackThumbmark !== "[Thumbmark Preserved in Cloud Upload]") {
        updatedHousehold.pmrfDetails.pmrfBackThumbmark = originalHousehold.pmrfDetails.pmrfBackThumbmark;
      }
    }
  }

  // Restore overall signatures
  if (updatedHousehold.patientSignature === "[Signature Preserved in Cloud Upload]" || !updatedHousehold.patientSignature) {
    if (originalHousehold.patientSignature && originalHousehold.patientSignature !== "[Signature Preserved in Cloud Upload]") {
      updatedHousehold.patientSignature = originalHousehold.patientSignature;
    }
  }

  // Restore attachments
  if (Array.isArray(updatedHousehold.attachments) && Array.isArray(originalHousehold.attachments)) {
    updatedHousehold.attachments = safeRestoreAttachments(updatedHousehold.attachments, originalHousehold.attachments);
  }
}

app.post('/api/drafts', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const accountId = req.currentUser.email;
  const draftData = req.body;
  if (!draftData.id) {
    return res.status(400).json({ error: 'Missing draft ID' });
  }

  // Force isolation boundaries
  draftData.accountId = accountId;
  draftData.syncStatus = 'Synced';

  if (!db.drafts) db.drafts = [];
  const existingIdx = db.drafts.findIndex((d: any) => d.id === draftData.id);
  if (existingIdx > -1) {
    restorePreservedDraftData(draftData, db.drafts[existingIdx]);
    db.drafts[existingIdx] = draftData;
  } else {
    db.drafts.push(draftData);
  }

  SaintFrancisDB.save();
  res.json({ success: true, draft: draftData });
});

app.post('/api/drafts/delete', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const accountId = req.currentUser.email;
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing draft ID' });
  }

  if (!db.drafts) db.drafts = [];
  const originalLength = db.drafts.length;
  db.drafts = db.drafts.filter((d: any) => !(d.id === id && d.accountId === accountId));

  if (db.drafts.length !== originalLength) {
    SaintFrancisDB.save();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Draft not found or unauthorized' });
  }
});

app.post('/api/households/add', checkUser, async (req: any, res) => {
  const { draftId, householdData, membersData, dependentsData, isFpePcsfOnly, isNewMemberFpe } = req.body;
  const pool = getMySQLPool();
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/households/add loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();

  // Restore any compacted placeholders with original values from server draft
  if (draftId) {
    restorePreservedHouseholdData(householdData, db, draftId);
  }

  // -------------------------------------------------------------
  // Backend Duplicate Name Records Enforcer
  // -------------------------------------------------------------
  const activeHouseholds = db.households.filter(h => !h.deletedAt);
  const hhMap = new Map(activeHouseholds.map(h => [h.id, h]));
  const seenNames = new Set<string>();

  // Add existing household heads
  activeHouseholds.forEach(h => {
    if (h.householdHead) {
      seenNames.add(h.householdHead.replace(/\s+/g, ' ').trim().toLowerCase());
    }
  });

  // Add existing members
  db.householdMembers.forEach(m => {
    const hh = hhMap.get(m.householdId);
    if (hh && m.relationship !== 'Head') {
      const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
      seenNames.add(rawName.replace(/\s+/g, ' ').trim().toLowerCase());
    }
  });

  // Add existing dependents
  db.dependents.forEach(d => {
    const hh = hhMap.get(d.householdId);
    if (hh && d.fullName) {
      seenNames.add(d.fullName.replace(/\s+/g, ' ').trim().toLowerCase());
    }
  });

  // Check the Head candidate we are inserting
  const candidateHead = (householdData.householdHead || '').replace(/\s+/g, ' ').trim();
  if (candidateHead && seenNames.has(candidateHead.toLowerCase())) {
    return res.status(400).json({ 
      error: `Duplicate Resident Record Detected: The resident '${candidateHead}' is already registered in the Citizen Masterlist database.` 
    });
  }

  // Check Member candidates we are inserting
  if (Array.isArray(membersData)) {
    for (const m of membersData) {
      const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (cleanName && cleanName !== ',' && seenNames.has(cleanName.toLowerCase())) {
        return res.status(400).json({ 
          error: `Duplicate Resident Record Detected: The member '${cleanName}' is already registered in the Citizen Masterlist database.` 
        });
      }
    }
  }

  // Check Dependent candidates we are inserting
  if (Array.isArray(dependentsData)) {
    for (const d of dependentsData) {
      const rawName = d.fullName || '';
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (cleanName && seenNames.has(cleanName.toLowerCase())) {
        return res.status(400).json({ 
          error: `Duplicate Resident Record Detected: The dependent '${cleanName}' is already registered in the Citizen Masterlist database.` 
        });
      }
    }
  }

  const hId = generateId('hsh');
  const now = new Date().toISOString();
  
  // Prevent duplicate sequence numbers due to local-storage/MySQL sync differences
  const existingLocalNums = new Set((db.households || []).map((h: any) => h && h.householdNumber).filter(Boolean));
  let seq = (db.households || []).length + 1;
  while (existingLocalNums.has(`HH-2026-${String(seq).padStart(4, '0')}`)) {
    seq++;
  }
  let householdNo = `HH-2026-${String(seq).padStart(4, '0')}`;

  if (pool) {
    try {
      const [rows]: any = await pool.query("SELECT householdNumber FROM households");
      if (rows && rows.length > 0) {
        const existingNums = new Set(rows.map((r: any) => r.householdNumber).filter(Boolean));
        while (existingNums.has(`HH-2026-${String(seq).padStart(4, '0')}`) || existingLocalNums.has(`HH-2026-${String(seq).padStart(4, '0')}`)) {
          seq++;
        }
        householdNo = `HH-2026-${String(seq).padStart(4, '0')}`;
      }
    } catch (e) {
      console.warn('[SEQUENCE GENERATOR] Failed to query MySQL households for sequence generation, utilizing offline sequence instead:', e);
    }
  }

  // -------------------------------------------------------------
  // STEP 3 - BACKEND ENDPOINT LOGGING (AS REQUESTED)
  // -------------------------------------------------------------
  console.log("Dependents:", dependentsData || req.body.dependents || []);
  console.log("Submission details received internally:");
  console.log(" - submission_id (householdNumber):", householdNo);
  console.log(" - pmrf_id (householdId):", hId);
  console.log(" - dependents count:", (dependentsData || req.body.dependents || []).length);
  console.log(" - dependents payload:", JSON.stringify(dependentsData || req.body.dependents || []));

  // Capture old state signatures
  const oldStats = captureAllOldStats(db);

  const isUserAdmin = req.currentUser && (
    hasRole(req.currentUser, 'ADMIN') || 
    req.currentUser.position === 'Administrator' ||
    (req.currentUser.email && (
      req.currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
      req.currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
    ))
  );

  // 1. Verify that the logged-in account has a valid Residential Area (unless admin).
  const userResidentialArea = (req.currentUser?.address || '').trim().toUpperCase();
  if (!userResidentialArea && !isUserAdmin) {
    return res.status(400).json({
      error: 'Unable to submit. Your account does not have an assigned Residential Area. Please contact your Administrator.'
    });
  }

  // 2. Automatically route/assign to user's Account Residential Area for non-admins. Admins can register under any barangay.
  if (!isUserAdmin) {
    householdData.barangay = userResidentialArea;
  } else {
    householdData.barangay = (householdData.barangay || '').trim().toUpperCase() || 'UNASSIGNED';
  }

  if (!isUserAdmin) {
    const userResArea = (req.currentUser.address || '').trim().toLowerCase();
    const subResArea = (householdData.barangay || '').trim().toLowerCase();
    if (userResArea && subResArea && userResArea !== subResArea) {
      return res.status(403).json({ 
        error: `Security Rule Violation: You can only submit Household files for your own assigned Residential Area: ${req.currentUser.address}.` 
      });
    }
  }

  // Create household with submitted audit trails - AUTOMATIC APPROVAL IS STRICKLY DISABLED
  const newHousehold: any = {
    id: hId,
    householdId: hId,
    householdNumber: householdNo,
    householdHead: householdData.householdHead,
    contactNumber: householdData.contactNumber || '',
    completeAddress: `${householdData.purok}, ${householdData.barangay}`,
    barangay: householdData.barangay,
    barangayFolder: householdData.barangay,
    purok: householdData.purok,
    latitude: parseFloat(householdData.latitude) || 7.828,
    longitude: parseFloat(householdData.longitude) || 123.433,
    pmrfStatus: householdData.pmrfStatus || 'Willing',
    yakapWillingStatus: householdData.yakapWillingStatus || 'Willing',
    approvalStatus: 'Pending', // ALWAYS Pending initially, automatic approval removed
    status: 'Pending',
    attachments: householdData.attachments || [],
    pmrfDetails: householdData.pmrfDetails || null,
    fpeDetails: householdData.fpeDetails || householdData.pmrfDetails?.fpeDetails || null,
    pcsfDetails: householdData.pcsfDetails || householdData.pmrfDetails?.pcsfDetails || null,
    patientSignature: householdData.patientSignature || (householdData.pmrfDetails?.patientSignature) || null,
    createdBy: req.currentUser.fullName,
    createdAt: now,
    isFpePcsfOnly: !!isFpePcsfOnly,
    isNewMemberFpe: !!isNewMemberFpe,
    
    // Disapproved Submissions Access Control Metadata fields
    accountId: req.currentUser.id,
    submittedByAccountId: req.currentUser.id,
    submittedBy: req.currentUser.fullName,
    submittedByUsername: req.currentUser.fullName,
    residentialArea: householdData.barangay,
    dateSubmitted: now,
    submissionDateTime: now,
    submissionReferenceNumber: householdNo,

    // Audit Log & Approval/Disapproval Metadata Fields
    approvedBy: undefined,
    approvalDate: undefined,
    disapprovedBy: undefined,
    disapprovalRemarks: undefined,
    resubmissionHistory: [{
      date: now,
      action: 'Initial Submission',
      user: req.currentUser.fullName,
      note: 'Household filed and sent to Verification Queue'
    }],
    lastModified: now,
    lastModifiedAt: now
  };

  // Live queue notifications are restricted to Approved and Disapproved household events only

  if (isFpePcsfOnly) {
    const pcsfDet = newHousehold.pcsfDetails || (householdData.pmrfDetails?.pcsfDetails) || {};
    if (pcsfDet && pcsfDet.householdId) {
      const parentHhId = pcsfDet.householdId;
      const targetDependentId = pcsfDet.dependentId;
      const targetDependentName = pcsfDet.fullName || householdData.householdHead;

      // Find if dependent already exists under that parent household
      let existingDep = db.dependents.find(d => 
        (targetDependentId && d.id === targetDependentId) || 
        (d.householdId === parentHhId && d.fullName.toLowerCase() === targetDependentName.toLowerCase())
      );

      if (!existingDep) {
        // Create new dependent under that parent household
        const newDepId = targetDependentId || generateId('dep');
        const parts = targetDependentName.split(',');
        const lastName = parts[0]?.trim() || '';
        const firstName = parts[1]?.trim() || targetDependentName;

        const newDepObj: any = {
          id: newDepId,
          householdId: parentHhId,
          fullName: targetDependentName,
          gender: householdData.pmrfDetails?.sex || 'Female',
          age: parseInt(householdData.pmrfDetails?.age) || 5,
          relationship: householdData.pmrfDetails?.relationship || 'Child',
          birthDate: householdData.pmrfDetails?.birthDate || '',
          birthdate: householdData.pmrfDetails?.birthDate || '',
          civilStatus: householdData.pmrfDetails?.civilStatus || 'Single',
          lastName,
          firstName,
          middleName: householdData.pmrfDetails?.middleName || '',
          nameExt: householdData.pmrfDetails?.nameExt || '',
          noMiddleName: householdData.pmrfDetails?.noMiddleName !== undefined ? !!householdData.pmrfDetails?.noMiddleName : false,
          mononym: householdData.pmrfDetails?.mononym !== undefined ? !!householdData.pmrfDetails?.mononym : false,
          citizenship: householdData.pmrfDetails?.citizenship || 'FILIPINO',
          isDisabled: false,
          pmrfSubmissionId: householdNo,
          pmrfRecordId: parentHhId,
          memberPin: householdData.pmrfDetails?.pin || householdData.pmrfDetails?.pmrfPin || '',
          submittedByAccountId: req.currentUser?.id || 'usr_admin',
          createdAt: now
        };
        db.dependents.push(newDepObj);

        // Update the submitted household's pcsfDetails dependentId so it is linked
        if (newHousehold.pcsfDetails) {
          newHousehold.pcsfDetails.dependentId = newDepId;
        }
        if (newHousehold.pmrfDetails && newHousehold.pmrfDetails.pcsfDetails) {
          newHousehold.pmrfDetails.pcsfDetails.dependentId = newDepId;
        }
      } else {
        // Make sure the dependentId is correct on the FPE/PCSF submission
        if (newHousehold.pcsfDetails) {
          newHousehold.pcsfDetails.dependentId = existingDep.id;
        }
        if (newHousehold.pmrfDetails && newHousehold.pmrfDetails.pcsfDetails) {
          newHousehold.pmrfDetails.pcsfDetails.dependentId = existingDep.id;
        }
      }
    }
  }

  // Prepare and construct final members
  const finalMembers: HouseholdMember[] = [];
  if (Array.isArray(membersData)) {
    membersData.forEach(m => {
      finalMembers.push({
        id: m.id || generateId('mem'),
        householdId: hId,
        firstName: m.firstName,
        middleName: m.middleName || '',
        lastName: m.lastName,
        gender: m.gender || 'Male',
        birthdate: m.birthdate || '1990-01-01',
        age: parseInt(m.age) || 30,
        civilStatus: m.civilStatus || 'Single',
        occupation: m.occupation || 'None',
        relationship: m.relationship || 'Spouse'
      });
    });
  }

  const hasHead = finalMembers.some(m => m.relationship === 'Head');
  if (!hasHead) {
    let lastName = '';
    let firstName = '';
    let middleName = '';
    let gender = 'Male';
    let birthdate = '1980-01-01';
    let civilStatus = 'Married';
    let age = 46;

    if (isNewMemberFpe && householdData.pmrfDetails) {
      const pmrf = householdData.pmrfDetails;
      lastName = (pmrf.lastName || '').toUpperCase().trim();
      firstName = (pmrf.firstName || '').toUpperCase().trim();
      middleName = (pmrf.middleName || '').toUpperCase().trim();
      gender = pmrf.sex || pmrf.gender || 'Female';
      birthdate = pmrf.birthDate || pmrf.birthdate || '1990-01-01';
      civilStatus = pmrf.civilStatus || 'Single';
      if (birthdate) {
        age = new Date().getFullYear() - new Date(birthdate).getFullYear();
        age = Math.max(0, age);
      }
    } else {
      const headNames = (householdData.householdHead || '').split(',');
      lastName = headNames[0]?.trim() || '';
      firstName = headNames[1]?.trim() || '';
    }

    finalMembers.push({
      id: generateId('mem'),
      householdId: hId,
      firstName,
      middleName,
      lastName,
      gender: gender as any,
      birthdate,
      age,
      civilStatus: civilStatus as any,
      occupation: isNewMemberFpe ? 'Resident' : 'Field Worker',
      relationship: 'Head'
    });
  }

  // Prepare and construct final dependents
  const finalDependents: any[] = [];
  const parentPin = householdData.pin || householdData.pmrfDetails?.pin || householdData.pmrfDetails?.pmrfPin || '';
  if (Array.isArray(dependentsData)) {
    dependentsData.forEach(d => {
      finalDependents.push({
        id: d.id || generateId('dep'),
        householdId: hId,
        fullName: d.fullName,
        gender: d.gender || 'Female',
        age: parseInt(d.age) || 5,
        relationship: d.relationship || 'Child',
        birthDate: d.birthDate || d.birthdate || '',
        birthdate: d.birthDate || d.birthdate || '',
        civilStatus: d.civilStatus || 'Single',
        lastName: d.lastName || '',
        firstName: d.firstName || '',
        middleName: d.middleName || '',
        nameExt: d.nameExt || '',
        noMiddleName: d.noMiddleName !== undefined ? !!d.noMiddleName : false,
        no_mn: d.noMiddleName !== undefined ? !!d.noMiddleName : false,
        mononym: d.mononym !== undefined ? !!d.mononym : false,
        citizenship: d.citizenship || 'FILIPINO',
        isDisabled: d.isDisabled !== undefined ? !!d.isDisabled : (d.pswd !== undefined ? !!d.pswd : false),
        pswd: d.pswd !== undefined ? !!d.pswd : (d.isDisabled !== undefined ? !!d.isDisabled : false),
        sex: d.sex || d.gender || 'Female',
        pmrfSubmissionId: householdNo,
        pmrfRecordId: hId,
        memberPin: parentPin || null,
        submittedByAccountId: req.currentUser?.id || 'usr_admin',
        createdAt: d.createdAt || now
      });
    });
  }

  if (pool) {
    try {
      console.log(`[TRANSACTION START] Submitting PMRF Household and Dependents under a direct transaction...`);
      await saveHouseholdAndDependentsTransaction(pool, newHousehold, finalMembers, finalDependents, false);
      
      // If we have a linked FPE/PCSF dependent that was newly created (from lines 1742-1768)
      // and not already in MySQL, insert it under same pool:
      if (isFpePcsfOnly) {
        const pcsfDet = newHousehold.pcsfDetails || {};
        if (pcsfDet && pcsfDet.householdId && pcsfDet.dependentId) {
          const parentHhId = pcsfDet.householdId;
          const targetDepId = pcsfDet.dependentId;
          const targetDepName = pcsfDet.fullName || householdData.householdHead;
          
          let existingInDB = false;
          try {
            const [rows]: any = await pool.query('SELECT id FROM dependents WHERE id = ?', [targetDepId]);
            if (rows && rows.length > 0) {
              existingInDB = true;
            }
          } catch (e) {}

          if (!existingInDB) {
            console.log(`[LINKED DEP SAVE] Syncing newly created linked dependent ${targetDepName} into database tables...`);
            const parts = targetDepName.split(',');
            const lastName = parts[0]?.trim() || '';
            const firstName = parts[1]?.trim() || targetDepName;
            
            await pool.query(
              `INSERT INTO dependents (
                id, householdId, last_name, first_name, middle_name, name_ext, relationship,
                date_of_birth, sex, citizenship, no_mn, mononym, pswd, gender, age, civilStatus, isDisabled,
                pmrfSubmissionId, pmrfRecordId, memberPin, submittedByAccountId, createdAt
              )
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
              [
                targetDepId, 
                parentHhId, 
                lastName, 
                firstName, 
                householdData.pmrfDetails?.middleName || '', 
                householdData.pmrfDetails?.nameExt || '',
                normalizeRelationship(householdData.pmrfDetails?.relationship),
                householdData.pmrfDetails?.birthDate || '',
                normalizeGender(householdData.pmrfDetails?.sex),
                householdData.pmrfDetails?.citizenship || 'FILIPINO',
                householdData.pmrfDetails?.noMiddleName ? 1 : 0,
                householdData.pmrfDetails?.mononym ? 1 : 0,
                0,
                normalizeGender(householdData.pmrfDetails?.sex),
                parseInt(householdData.pmrfDetails?.age) || null,
                normalizeCivilStatus(householdData.pmrfDetails?.civilStatus),
                0,
                householdNo,
                parentHhId,
                householdData.pmrfDetails?.pin || householdData.pmrfDetails?.pmrfPin || '',
                req.currentUser?.id || 'usr_admin',
                now
              ]
            );

            await pool.query(
              `INSERT INTO pmrf_dependents (
                id, pmrf_id, submission_id, last_name, first_name, middle_name, name_ext, relationship,
                date_of_birth, sex, citizenship, no_mn, mononym, pswd, age, civilStatus, isDisabled,
                pmrfSubmissionId, pmrfRecordId, memberPin, submittedByAccountId, createdAt
              )
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
              [
                targetDepId, 
                parentHhId, // pmrf_id
                householdNo, // submission_id
                lastName, 
                firstName, 
                householdData.pmrfDetails?.middleName || '', 
                householdData.pmrfDetails?.nameExt || '',
                normalizeRelationship(householdData.pmrfDetails?.relationship),
                householdData.pmrfDetails?.birthDate || '',
                normalizeGender(householdData.pmrfDetails?.sex),
                householdData.pmrfDetails?.citizenship || 'FILIPINO',
                householdData.pmrfDetails?.noMiddleName ? 1 : 0,
                householdData.pmrfDetails?.mononym ? 1 : 0,
                0,
                parseInt(householdData.pmrfDetails?.age) || null,
                normalizeCivilStatus(householdData.pmrfDetails?.civilStatus),
                0,
                householdNo,
                parentHhId,
                householdData.pmrfDetails?.pin || householdData.pmrfDetails?.pmrfPin || '',
                req.currentUser?.id || 'usr_admin',
                now
              ]
            ).catch((err: any) => {
              console.error('💡 Note: pmrf_dependents extra insert failed:', err.message);
            });
          }
        }
      }
    } catch (transactionErr: any) {
      console.error('[SUBMISSION TRANSACTION FAILED] Error details:', transactionErr);
      const isMySQLRunning = shouldAttemptMySQL();
      markMySQLFailure();
      if (isMySQLRunning) {
        return res.status(500).json({
          error: `Database save failed: ${transactionErr.message || 'Unknown database translation error'}. The submission could not be written to cPanel MySQL database. Transaction rolled back.`
        });
      }
    }
  }

  // Push to local memory state ONLY AFTER Successful Direct DB transaction commit!
  if (newHousehold.barangay) {
    const brgName = newHousehold.barangay.trim().toUpperCase();
    const brgExists = db.barangays.some(b => b.name.toUpperCase() === brgName);
    if (!brgExists) {
      const newBrg = {
        id: generateId('brg'),
        name: brgName,
        puroksCount: 0,
        yakapWillingCount: 0,
        householdProgressBar: 0,
        membersProgressBar: 0,
        pmrfProgressBar: 0
      };
      db.barangays.push(newBrg);
      console.log(`[BARANGAY FOLDER AUTO-CREATED] New household submitted. Automatically created Barangay folder for "${brgName}" (ID: ${newBrg.id})`);
    }
  }

  // Auto-create Barangay Folder for Leader's Residential Area if in verification queue (Pending)
  if (newHousehold.approvalStatus === 'Pending') {
    await checkAndAutoCreateBarangayForLeader(db, newHousehold);
  }

  db.households.push(newHousehold);
  finalMembers.forEach(m => db.householdMembers.push(m));
  finalDependents.forEach(d => db.dependents.push(d));

  await SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Created Household under review: ${newHousehold.householdHead}`, 'Households');

  // Audit trail logging for linked FPE/PCSF dependents
  if (newHousehold.pcsfDetails?.dependentId) {
    SaintFrancisDB.log(
      req.currentUser.fullName,
      `Linked FPE/PCSF for Dependent ID: ${newHousehold.pcsfDetails.dependentId} | Linked PMRF HH: ${newHousehold.pcsfDetails.householdId || 'N/A'} | Principal Member: ${newHousehold.pcsfDetails.principalMemberRecord || 'N/A'}`,
      'Households'
    );
  }

  // Log Squad / Payroll changes (if any affect the approved list)
  logSquadChanges(req.currentUser.fullName, oldStats, db);

  res.json({ success: true, household: newHousehold });
});

app.post('/api/households/edit', checkUser, async (req: any, res) => {
  const { id, householdData, membersData, dependentsData, isNewMemberFpe } = req.body;
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/households/edit loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();
  const householdIdx = db.households.findIndex(h => h.id === id);

  if (householdIdx === -1) {
    return res.status(404).json({ error: 'Household not found' });
  }

  // -------------------------------------------------------------
  // Backend Edit Duplicate Name Records Enforcer (Excludes current household)
  // -------------------------------------------------------------
  const activeHouseholds = db.households.filter(h => !h.deletedAt && h.id !== id);
  const hhMap = new Map(activeHouseholds.map(h => [h.id, h]));
  const seenNames = new Set<string>();

  // Add existing household heads from other households
  activeHouseholds.forEach(h => {
    if (h.householdHead) {
      seenNames.add(h.householdHead.replace(/\s+/g, ' ').trim().toLowerCase());
    }
  });

  // Add existing members from other households
  db.householdMembers.forEach(m => {
    if (m.householdId !== id) {
      const hh = hhMap.get(m.householdId);
      if (hh && m.relationship !== 'Head') {
        const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
        seenNames.add(rawName.replace(/\s+/g, ' ').trim().toLowerCase());
      }
    }
  });

  // Add existing dependents from other households
  db.dependents.forEach(d => {
    if (d.householdId !== id) {
      const hh = hhMap.get(d.householdId);
      if (hh && d.fullName) {
        seenNames.add(d.fullName.replace(/\s+/g, ' ').trim().toLowerCase());
      }
    }
  });

  // Check the Edited Head candidate
  const candidateHead = (householdData.householdHead || '').replace(/\s+/g, ' ').trim();
  if (candidateHead && seenNames.has(candidateHead.toLowerCase())) {
    return res.status(400).json({ 
      error: `Duplicate Resident Record Detected: The resident '${candidateHead}' is already registered under another household in the Citizen Masterlist.` 
    });
  }

  // Check Member candidates we are updating
  if (Array.isArray(membersData)) {
    for (const m of membersData) {
      const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (cleanName && cleanName !== ',' && seenNames.has(cleanName.toLowerCase())) {
        return res.status(400).json({ 
          error: `Duplicate Resident Record Detected: The member '${cleanName}' is already registered under another household in the Citizen Masterlist.` 
        });
      }
    }
  }

  // Check Dependent candidates we are updating
  if (Array.isArray(dependentsData)) {
    for (const d of dependentsData) {
      const rawName = d.fullName || '';
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (cleanName && seenNames.has(cleanName.toLowerCase())) {
        return res.status(400).json({ 
          error: `Duplicate Resident Record Detected: The dependent '${cleanName}' is already registered under another household in the Citizen Masterlist.` 
        });
      }
    }
  }

  // Capture old state signatures
  const oldStats = captureAllOldStats(db);

  // 1. Verify that the logged-in account has a valid Residential Area.
  const userResidentialArea = (req.currentUser?.address || '').trim().toUpperCase();
  if (!userResidentialArea) {
    return res.status(400).json({
      error: 'Unable to submit. Your account does not have an assigned Residential Area. Please contact your Administrator.'
    });
  }

  // 2. Automatically route/assign to user's Account Residential Area (Users can never manually choose/change destination)
  householdData.barangay = userResidentialArea;

  const isUserAdmin = req.currentUser && (
    hasRole(req.currentUser, 'ADMIN') || 
    req.currentUser.position === 'Administrator' ||
    (req.currentUser.email && (
      req.currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
      req.currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
    ))
  );

  if (!isUserAdmin) {
    const userResArea = (req.currentUser.address || '').trim().toLowerCase();
    const subResArea = (householdData.barangay || '').trim().toLowerCase();
    if (userResArea && subResArea && userResArea !== subResArea) {
      return res.status(403).json({ 
        error: `Security Rule Violation: You can only edit/submit Household files for your own assigned Residential Area: ${req.currentUser.address}.` 
      });
    }
  }

  const h = db.households[householdIdx];
  const oldStatus = h.approvalStatus;
  const isResubmission = oldStatus === 'Disapproved';
  const nowStr = new Date().toISOString();

  const updatedHousehold: any = {
    ...h,
    householdHead: householdData.householdHead,
    contactNumber: householdData.contactNumber,
    barangay: householdData.barangay,
    purok: householdData.purok,
    latitude: parseFloat(householdData.latitude) || h.latitude,
    longitude: parseFloat(householdData.longitude) || h.longitude,
    pmrfStatus: householdData.pmrfStatus,
    yakapWillingStatus: householdData.yakapWillingStatus,
    completeAddress: `${householdData.purok}, ${householdData.barangay}`,
    pmrfDetails: householdData.pmrfDetails !== undefined ? householdData.pmrfDetails : h.pmrfDetails,
    fpeDetails: householdData.fpeDetails !== undefined ? householdData.fpeDetails : h.fpeDetails,
    pcsfDetails: householdData.pcsfDetails !== undefined ? householdData.pcsfDetails : h.pcsfDetails,
    patientSignature: householdData.patientSignature !== undefined ? householdData.patientSignature : (householdData.pmrfDetails?.patientSignature !== undefined ? householdData.pmrfDetails.patientSignature : h.patientSignature),
    attachments: householdData.attachments !== undefined ? householdData.attachments : h.attachments,
    isNewMemberFpe: isNewMemberFpe !== undefined ? !!isNewMemberFpe : h.isNewMemberFpe,
    approvalStatus: isResubmission ? 'Pending' : h.approvalStatus,
    updatedBy: req.currentUser.fullName,
    updatedAt: nowStr,

    // Audit trails updating
    lastModifiedAt: nowStr,
    resubmissionHistory: [
      ...(h.resubmissionHistory || []),
      {
        date: nowStr,
        action: isResubmission ? 'Resubmission' : 'Update',
        user: req.currentUser.fullName,
        note: isResubmission ? 'Household corrected and resubmitted to Verification Queue' : 'Household details updated'
      }
    ]
  };

  restorePreservedHouseholdFromExisting(updatedHousehold, h);

  // Live queue notifications are restricted to Approved and Disapproved household events only

  const finalMembers: HouseholdMember[] = [];
  if (Array.isArray(membersData)) {
    membersData.forEach((m: any) => {
      finalMembers.push({
        id: m.id || generateId('mem'),
        householdId: id,
        firstName: m.firstName,
        middleName: m.middleName,
        lastName: m.lastName,
        gender: m.gender,
        birthdate: m.birthdate,
        age: parseInt(m.age) || 18,
        civilStatus: m.civilStatus,
        occupation: m.occupation,
        relationship: m.relationship
      });
    });
  } else {
    const existingMembers = db.householdMembers.filter(m => m.householdId === id);
    finalMembers.push(...existingMembers);
  }

  const finalDependents: any[] = [];
  const parentPin = householdData.pin || householdData.pmrfDetails?.pin || householdData.pmrfDetails?.pmrfPin || updatedHousehold.pmrfDetails?.pin || updatedHousehold.pmrfDetails?.pmrfPin || '';
  if (Array.isArray(dependentsData)) {
    dependentsData.forEach((d: any) => {
      finalDependents.push({
        id: d.id || generateId('dep'),
        householdId: id,
        fullName: d.fullName,
        gender: d.gender || 'Female',
        age: parseInt(d.age) || 5,
        relationship: d.relationship || 'Child',
        birthDate: d.birthDate || d.birthdate || '',
        birthdate: d.birthDate || d.birthdate || '',
        civilStatus: d.civilStatus || 'Single',
        lastName: d.lastName || '',
        firstName: d.firstName || '',
        middleName: d.middleName || '',
        nameExt: d.nameExt || '',
        noMiddleName: d.noMiddleName !== undefined ? !!d.noMiddleName : false,
        no_mn: d.noMiddleName !== undefined ? !!d.noMiddleName : false,
        mononym: d.mononym !== undefined ? !!d.mononym : false,
        citizenship: d.citizenship || 'FILIPINO',
        isDisabled: d.isDisabled !== undefined ? !!d.isDisabled : (d.pswd !== undefined ? !!d.pswd : false),
        pswd: d.pswd !== undefined ? !!d.pswd : (d.isDisabled !== undefined ? !!d.isDisabled : false),
        sex: d.sex || d.gender || 'Female',
        pmrfSubmissionId: updatedHousehold.householdNumber || h.householdNumber,
        pmrfRecordId: id,
        memberPin: parentPin || null,
        submittedByAccountId: req.currentUser?.id || 'usr_admin',
        createdAt: d.createdAt || d.createdDate || updatedHousehold.createdAt || new Date().toISOString()
      });
    });
  } else {
    const existingDeps = db.dependents.filter(d => d.householdId === id);
    finalDependents.push(...existingDeps);
  }

  const pool = getMySQLPool();
  if (pool) {
    try {
      console.log(`[TRANSACTION START] Updating PMRF Household and Dependents on Edit under a direct transaction...`);
      await saveHouseholdAndDependentsTransaction(pool, updatedHousehold, finalMembers, finalDependents, true);
    } catch (transactionErr: any) {
      console.error('[EDIT TRANSACTION FAILED] Error details:', transactionErr);
      const isMySQLRunning = shouldAttemptMySQL();
      markMySQLFailure();
      if (isMySQLRunning) {
        return res.status(500).json({
          error: `Database update failed: ${transactionErr.message || 'Unknown database translation error'}. The updates could not be written to cPanel MySQL database. Transaction rolled back.`
        });
      }
    }
  }

  // Save to memory only after direct DB transaction edit matches or succeeds!
  if (updatedHousehold.barangay) {
    const brgName = updatedHousehold.barangay.trim().toUpperCase();
    const brgExists = db.barangays.some(b => b.name.toUpperCase() === brgName);
    if (!brgExists) {
      const newBrg = {
        id: generateId('brg'),
        name: brgName,
        puroksCount: 0,
        yakapWillingCount: 0,
        householdProgressBar: 0,
        membersProgressBar: 0,
        pmrfProgressBar: 0
      };
      db.barangays.push(newBrg);
      console.log(`[BARANGAY FOLDER AUTO-CREATED] Household edited. Automatically created Barangay folder for "${brgName}" (ID: ${newBrg.id})`);
    }
  }

  // Auto-create Barangay Folder for Leader's Residential Area if in verification queue (Pending)
  if (updatedHousehold.approvalStatus === 'Pending') {
    await checkAndAutoCreateBarangayForLeader(db, updatedHousehold);
  }

  db.households[householdIdx] = updatedHousehold;
  if (membersData) {
    db.householdMembers = db.householdMembers.filter(m => m.householdId !== id);
    finalMembers.forEach(m => db.householdMembers.push(m));
  }
  if (dependentsData) {
    db.dependents = db.dependents.filter(d => d.householdId !== id);
    finalDependents.forEach(d => db.dependents.push(d));
  }

  await SaintFrancisDB.save();
  const updatedHH = db.households[householdIdx];
  SaintFrancisDB.log(req.currentUser.fullName, `Updated Household ${h.householdNumber}: ${householdData.householdHead}`, 'Households');

  // Audit trail logging for linked FPE/PCSF dependents on update
  if (updatedHH.pcsfDetails?.dependentId) {
    SaintFrancisDB.log(
      req.currentUser.fullName,
      `Linked/Updated FPE/PCSF for Dependent ID: ${updatedHH.pcsfDetails.dependentId} | Linked PMRF HH: ${updatedHH.pcsfDetails.householdId || 'N/A'} | Principal Member: ${updatedHH.pcsfDetails.principalMemberRecord || 'N/A'}`,
      'Households'
    );
  }

  // Log Squad / Payroll changes
  logSquadChanges(req.currentUser.fullName, oldStats, db);

  res.json({ success: true, household: db.households[householdIdx] });
});

// Soft Delete endpoint - ONLY ADMIN can delete!
app.post('/api/households/delete', checkUser, (req: any, res) => {
  const { id } = req.body;
  const db = SaintFrancisDB.getData();
  const household = db.households.find(h => h.id === id);

  if (!household) {
    return res.status(404).json({ error: 'Household not found' });
  }

  // Filter guard ONLY master admin can delete
  if (req.currentUser.email && req.currentUser.email.toLowerCase() !== 'elthrone1233@gmail.com' && req.currentUser.email.toLowerCase() !== 'saintfrancisclinic2026@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only the Master Admin can delete entry data.' });
  }

  // Capture old state signatures
  const oldStats = captureAllOldStats(db);

  // Soft delete values in db
  household.deletedBy = req.currentUser.fullName;
  household.deletedAt = new Date().toISOString();

  SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Soft-deleted Household: ${household.householdHead} (RECYCLE BIN)`, 'Households');

  // Log Squad / Payroll changes
  logSquadChanges(req.currentUser.fullName, oldStats, db);

  res.json({ success: true, message: 'Household moved to Recycle Bin.' });
});

// Restore endpoint - ONLY ADMIN can restore!
app.post('/api/households/restore', checkUser, async (req: any, res) => {
  const { id } = req.body;
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/households/restore loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();
  const household = db.households.find(h => h.id === id);

  if (!household) {
    return res.status(404).json({ error: 'Household not found' });
  }

  // Filter guard: only master admin/authorized administrators can restore
  if (req.currentUser.email && req.currentUser.email.toLowerCase() !== 'elthrone1233@gmail.com' && req.currentUser.email.toLowerCase() !== 'saintfrancisclinic2026@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only Clinical Administrators can restore database archives.' });
  }

  // Capture old state signatures
  const oldStats = captureAllOldStats(db);

  // Restore fields (can be null or undefined)
  household.deletedBy = undefined;
  household.deletedAt = undefined;

  // Save changes
  await SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Restored Household: ${household.householdHead} from Recycle Bin`, 'Households');

  // Log Squad / Payroll changes
  logSquadChanges(req.currentUser.fullName, oldStats, db);

  res.json({ success: true, message: 'Household restored successfully.' });
});

// Empty Recycle Bin endpoint - ONLY ADMIN!
app.post('/api/households/empty-recycle-bin', checkUser, async (req: any, res) => {
  if (shouldAttemptMySQL()) {
    try {
      await SaintFrancisDB.loadFromDB();
    } catch (e) {
      console.error('[LAZY LOAD ERROR] /api/households/empty-recycle-bin loadFromDB failure:', e);
    }
  }
  const db = SaintFrancisDB.getData();

  // Filter guard
  if (req.currentUser.email && req.currentUser.email.toLowerCase() !== 'elthrone1233@gmail.com' && req.currentUser.email.toLowerCase() !== 'saintfrancisclinic2026@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only Clinical Administrators can empty the Recycle Bin.' });
  }

  const deletedHouseholds = db.households.filter(h => h.deletedAt);
  if (deletedHouseholds.length === 0) {
    return res.json({ success: true, message: 'Recycle Bin is already empty.' });
  }

  // Capture old state signatures
  const oldStats = captureAllOldStats(db);

  const deletedIds = new Set(deletedHouseholds.map(h => h.id));

  // Remove households
  db.households = db.households.filter(h => !h.deletedAt);

  // Also remove associated members
  if (db.householdMembers) {
    db.householdMembers = db.householdMembers.filter(m => !deletedIds.has(m.householdId));
  }

  // Also remove associated dependents
  if (db.dependents) {
    db.dependents = db.dependents.filter(d => !deletedIds.has(d.householdId));
  }

  // Save changes
  await SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Permanently emptied Recycle Bin: Cleared ${deletedHouseholds.length} archived household profiles`, 'Households');

  // Log Squad / Payroll changes
  logSquadChanges(req.currentUser.fullName, oldStats, db);

  res.json({ success: true, message: `Successfully cleared ${deletedHouseholds.length} archived households permanently.` });
});


// -------------------------------------------------------------
// HEALTH RECORDS ROUTING / ENDPOINTS
// -------------------------------------------------------------
app.get('/api/health-records', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  db.healthRecords = db.healthRecords || [];
  res.json(db.healthRecords);
});

app.post('/api/health-records/add', checkUser, (req: any, res) => {
  const { patientName, householdId, diagnosis, treatment, medications, notes, date } = req.body;
  const db = SaintFrancisDB.getData();
  db.healthRecords = db.healthRecords || [];

  const household = db.households.find(h => h.id === householdId);
  const householdHead = household ? (household.householdHead || 'Unknown') : 'Unknown';
  const barangay = household ? (household.barangay || 'Unknown') : 'Unknown';

  const newRecord: HealthRecord = {
    id: `hr_${Date.now()}`,
    patientName,
    householdId,
    householdHead,
    barangay,
    diagnosis,
    treatment,
    medications,
    notes,
    date: date || new Date().toISOString().split('T')[0]
  };

  db.healthRecords.push(newRecord);
  SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Created health record for patient: ${patientName}`, 'Health Records');

  res.json({ success: true, healthRecord: newRecord });
});


// -------------------------------------------------------------
// PCU FILES MANAGEMENT ROUTES
// -------------------------------------------------------------
app.get('/api/pcu-files', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  res.json(db.pcuFiles || []);
});

app.post('/api/pcu-files/upload', checkUser, (req: any, res) => {
  const { files } = req.body;
  if (!Array.isArray(files)) {
    return res.status(400).json({ error: 'An array of files is required.' });
  }

  const db = SaintFrancisDB.getData();
  if (!db.pcuFiles) {
    db.pcuFiles = [];
  }

  const now = new Date().toISOString();
  const addedFiles: any[] = [];

  for (const f of files) {
    if (!f.fullName || !f.birthday) {
      return res.status(400).json({ error: 'Each uploaded item must have a Full Name and Birthday.' });
    }

    const folderName = now.substring(0, 10); // YYYY-MM-DD date folder
    const newPcu = {
      id: generateId('pcu'),
      fullName: f.fullName,
      birthday: f.birthday,
      gender: f.gender || 'Male',
      fileName: f.fileName || 'pcu-file.pdf',
      fileData: f.fileData || '',
      uploadDate: now,
      uploadedBy: req.currentUser.fullName,
      folderName: folderName
    };

    db.pcuFiles.push(newPcu);
    addedFiles.push(newPcu);
  }

  SaintFrancisDB.save();
  SaintFrancisDB.log(req.currentUser.fullName, `Uploaded ${addedFiles.length} PCU file(s) under Households`, 'Households');

  res.json({ success: true, files: addedFiles });
});


// -------------------------------------------------------------
// 7. GROUP MANAGEMENT HELPER FUNCTIONS
// -------------------------------------------------------------
function calculateSquadStats(g: any, db: any) {
  const activeHouseholds = (db.households || []).filter((h: any) => h && !h.deletedAt && h.approvalStatus === "Approved");
  const hInGroup = activeHouseholds.filter((h: any) => {
    if (!h || !h.barangay) return false;
    const isBrgMatch = (g.assignedBarangays || []).some((b: string) => b.trim().toUpperCase() === h.barangay.trim().toUpperCase());
    if (!isBrgMatch) return false;
    const creatorLower = (h.createdBy || h.submittedBy || h.submittedByUsername || '').trim().toLowerCase();
    const leaderLower = (g.leader || '').trim().toLowerCase();
    return creatorLower === leaderLower;
  });
  const headsCount = hInGroup.length;
  const hhIds = hInGroup.map((h: any) => h.id).filter(Boolean);
  
  const mCount = (db.householdMembers || []).filter((m: any) => {
    if (!m || !m.householdId || !hhIds.includes(m.householdId)) return false;
    const rel = (m.relationship || '').toLowerCase();
    // Exclude Head (already counted in headsCount), Spouse, and Mother's Maiden / Mother
    return rel !== 'head' && rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
  }).length;

  const dCount = (db.dependents || []).filter((d: any) => {
    if (!d || !d.householdId || !hhIds.includes(d.householdId)) return false;
    const rel = (d.relationship || '').toLowerCase();
    // Exclude Spouse and Mother's Maiden / Mother
    return rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
  }).length;

  const population = headsCount + mCount + dCount;
  return {
    population,
    totalPayout: population * (g.ratePerPerson || 0)
  };
}

function captureAllOldStats(db: any) {
  const oldStats: Record<string, { population: number; rate: number; payout: number }> = {};
  (db.groups || []).forEach((g: any) => {
    if (g) {
      const stats = calculateSquadStats(g, db);
      oldStats[g.id] = {
        population: stats.population,
        rate: g.ratePerPerson || 0,
        payout: stats.totalPayout || 0
      };
    }
  });
  return oldStats;
}

function logSquadChanges(user: string, oldStats: Record<string, { population: number; rate: number; payout: number }>, db: any) {
  (db.groups || []).forEach((g: any) => {
    if (g && !g.isArchived) {
      const current = calculateSquadStats(g, db);
      const old = oldStats[g.id] || { population: 0, rate: g.ratePerPerson || 0, payout: 0 };
      
      let loggedPop = false;
      let loggedRate = false;

      if (old.population !== current.population) {
        SaintFrancisDB.log(
          user,
          `Population updates: Operational Squad "${g.name}" population changed from ${old.population} to ${current.population}`,
          "Group Management"
        );
        loggedPop = true;
      }

      if (old.rate !== g.ratePerPerson) {
        SaintFrancisDB.log(
          user,
          `Base Rate updates: Base rate for Operational Squad "${g.name}" modified from ₱${old.rate} to ₱${g.ratePerPerson}`,
          "Group Management"
        );
        loggedRate = true;
      }

      if (loggedPop || loggedRate || (old.payout !== current.totalPayout && current.population > 0)) {
        SaintFrancisDB.log(
          user,
          `Payroll recalculations: Automatically recalculated payroll for Squad "${g.name}". New computed amount: ₱${current.totalPayout.toLocaleString()} (Population: ${current.population}, Rate: ₱${g.ratePerPerson})`,
          "Group Management"
        );
      }
    }
  });
}


// -------------------------------------------------------------
// 7. GROUP MANAGEMENT API
// -------------------------------------------------------------
app.get('/api/groups', (req, res) => {
  const db = SaintFrancisDB.getData();
  const includeArchived = req.query.includeArchived === 'true';
  // Filter active approved households only
  const activeHouseholds = db.households.filter(h => !h.deletedAt && h.approvalStatus === 'Approved');

  const groupsWithStats = db.groups
    .filter(g => includeArchived ? true : !g.isArchived)
    .map(g => {
      // Collect active households belonging to assigned barangays
      const hInGroup = activeHouseholds.filter(h => {
        if (!h || !h.barangay) return false;
        const isBrgMatch = (g.assignedBarangays || []).some((b: string) => b.trim().toUpperCase() === h.barangay.trim().toUpperCase());
        if (!isBrgMatch) return false;
        const creatorLower = (h.createdBy || (h as any).submittedBy || h.submittedByUsername || '').trim().toLowerCase();
        const leaderLower = (g.leader || '').trim().toLowerCase();
        return creatorLower === leaderLower;
      });
      const approvedHouseholdsCount = hInGroup.length;

      const hhIds = hInGroup.map(h => h.id);
      const approvedMembersCount = db.householdMembers.filter(m => {
        if (!m || !m.householdId || !hhIds.includes(m.householdId)) return false;
        const rel = (m.relationship || '').toLowerCase();
        // Exclude Head (already counted in approvedHouseholdsCount), Spouse, and Mother's Maiden / Mother
        return rel !== 'head' && rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
      }).length;

      const approvedDependentsCount = db.dependents.filter(d => {
        if (!d || !d.householdId || !hhIds.includes(d.householdId)) return false;
        const rel = (d.relationship || '').toLowerCase();
        // Exclude Spouse and Mother's Maiden / Mother
        return rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
      }).length;

      // Total population = Approved Home Heads + Members + Dependents
      const populationCount = approvedHouseholdsCount + approvedMembersCount + approvedDependentsCount;

      return {
        ...g,
        approvedHouseholdsCount,
        approvedMembersCount,
        approvedDependentsCount,
        populationCount
      };
    });

  res.json(groupsWithStats);
});

app.post('/api/groups/add', checkUser, (req: any, res) => {
  try {
    const { name, leader, coLeaders, assignedBarangays, ratePerPerson } = req.body;
    const db = SaintFrancisDB.getData();

    const squadName = (name || '').trim();
    if (!squadName) {
      return res.status(400).json({ error: 'Group Operational Name is required.' });
    }

    const activeAssigned = Array.isArray(assignedBarangays) ? assignedBarangays.map(b => (b || '').trim()).filter(Boolean) : [];
    if (activeAssigned.length === 0) {
      return res.status(400).json({ error: 'A valid Barangay Folder assignment is required to create a Squad.' });
    }

    // Verify assigned Barangay folder exists in DB
    const matchedBarangay = db.barangays.find(b => 
      activeAssigned.map(x => x.toLowerCase().trim()).includes(b.name.toLowerCase().trim())
    );

    if (!matchedBarangay) {
      return res.status(400).json({ error: `The selected Barangay Folder "${activeAssigned[0]}" is invalid or does not exist.` });
    }

    const barangayFolderId = matchedBarangay.id;
    const canonicalFolderNames = [matchedBarangay.name];

    // Before creating a Squad, verify that it does not already exist (case-insensitive & folder isolated)
    const squadExists = db.groups.some(g => {
      if (g.isArchived) return false;
      const isSameName = g.name.toLowerCase().trim() === squadName.toLowerCase().trim();
      const hasOverlap = (g.assignedBarangays || []).some(bg => 
        canonicalFolderNames.map(cf => cf.toLowerCase().trim()).includes(bg.toLowerCase().trim())
      );
      return isSameName && hasOverlap;
    });
    
    if (squadExists) {
      const errorMsg = `Sync Error: Cannot create duplicate squad "${squadName}" inside the Barangay folder "${matchedBarangay.name}" (ID: ${barangayFolderId}).`;
      const currentUserName = req.currentUser?.fullName || 'System Admin';
      SaintFrancisDB.log(currentUserName, errorMsg, 'Group Management');
      return res.status(400).json({ error: `Squad "${squadName}" already exists inside the selected Barangay folder.` });
    }

    // Prevent duplicate leader assignment in other active (non-archived) groups
    const activeGroups = db.groups.filter(g => !g.isArchived);
    if (leader) {
      const leaderInOtherGroup = activeGroups.find(g => g.leader === leader || (Array.isArray(g.coLeaders) && g.coLeaders.includes(leader)));
      if (leaderInOtherGroup) {
        return res.status(400).json({ error: `Leader "${leader}" is already active in "${leaderInOtherGroup.name}". Dual active leadership positions are prohibited.` });
      }
    }

    // Prevent duplicate co-leader assignment in other active (non-archived) groups
    const coLeadersPayload = Array.isArray(coLeaders) ? coLeaders : [];
    for (const coL of coLeadersPayload) {
      const coLeaderInOtherGroup = activeGroups.find(g => g.leader === coL || (Array.isArray(g.coLeaders) && g.coLeaders.includes(coL)));
      if (coLeaderInOtherGroup) {
        return res.status(400).json({ error: `Co-Leader "${coL}" is already active in "${coLeaderInOtherGroup.name}". Dual active leadership positions are prohibited.` });
      }
    }

    // Capture old state signatures
    const oldStats = captureAllOldStats(db);

    const newGroup: Group & { createdAt?: string; status?: string; isArchived?: boolean; barangayFolderId?: string } = {
      id: generateId('grp'),
      name: squadName,
      leader,
      coLeaders: coLeadersPayload,
      assignedBarangays: canonicalFolderNames,
      ratePerPerson: parseFloat(ratePerPerson) || 120,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'Pending',
      isArchived: false,
      barangayFolderId: barangayFolderId
    };

    db.groups.push(newGroup);

    // Sync user group assignments
    const activeCoLeaders = Array.isArray(newGroup.coLeaders) ? newGroup.coLeaders : [];
    db.users.forEach(u => {
      const isNowInGroup = (u.fullName === newGroup.leader || activeCoLeaders.includes(u.fullName));
      if (isNowInGroup) {
        u.groupAssigned = newGroup.id;
      }
    });

    const currentUserName = req.currentUser?.fullName || 'System Admin';

    // Save and compute stats / logs
    SaintFrancisDB.save();

    SaintFrancisDB.log(
      currentUserName, 
      `Squad creation: Created operational squad "${squadName}" assigned to Barangay folder "${matchedBarangay.name}" (ID: ${barangayFolderId})`, 
      'Group Management'
    );
    logSquadChanges(currentUserName, oldStats, db);

    res.json({ success: true, group: newGroup });
  } catch (err: any) {
    console.error('Error in /api/groups/add route:', err);
    res.status(500).json({ error: err.message || 'Internal server error while adding group.' });
  }
});

app.post('/api/groups/edit', checkUser, (req: any, res) => {
  try {
    const { id, name, leader, coLeaders, assignedBarangays, ratePerPerson } = req.body;
    const db = SaintFrancisDB.getData();

    const group = db.groups.find(g => g.id === id);
    if (!group) return res.status(404).json({ error: 'Operational Group/Squad not found.' });

    const oldName = group.name;
    const squadName = (name || '').trim();
    if (!squadName) {
      return res.status(400).json({ error: 'Group Operational Name is required.' });
    }

    const activeAssigned = Array.isArray(assignedBarangays) ? assignedBarangays.map(b => (b || '').trim()).filter(Boolean) : [];
    if (activeAssigned.length === 0) {
      return res.status(400).json({ error: 'A valid Barangay Folder assignment is required to update a Squad.' });
    }

    // Verify assigned Barangay folder exists in DB
    const matchedBarangay = db.barangays.find(b => 
      activeAssigned.map(x => x.toLowerCase().trim()).includes(b.name.toLowerCase().trim())
    );

    if (!matchedBarangay) {
      return res.status(400).json({ error: `The selected Barangay Folder "${activeAssigned[0]}" is invalid or does not exist.` });
    }

    const barangayFolderId = matchedBarangay.id;
    const canonicalFolderNames = [matchedBarangay.name];

    // Before editing/renaming a Squad, verify that another squad with same name doesn't already exist in same assigned barangays
    const squadExists = db.groups.some(g => {
      if (g.id === id || g.isArchived) return false;
      const isSameName = g.name.toLowerCase().trim() === squadName.toLowerCase().trim();
      const hasOverlap = (g.assignedBarangays || []).some(bg => 
        canonicalFolderNames.map(cf => cf.toLowerCase().trim()).includes(bg.toLowerCase().trim())
      );
      return isSameName && hasOverlap;
    });
    
    if (squadExists) {
      const errorMsg = `Sync Error: Cannot rename squad to "${squadName}" because a duplicate already exists in the Barangay folder "${matchedBarangay.name}" (ID: ${barangayFolderId}).`;
      const currentUserName = req.currentUser?.fullName || 'System Admin';
      SaintFrancisDB.log(currentUserName, errorMsg, 'Group Management');
      return res.status(400).json({ error: `Squad "${squadName}" already exists inside the selected Barangay folder.` });
    }

    // Prevent duplicate leader assignment in other active (non-archived) groups
    const activeGroups = db.groups.filter(g => !g.isArchived && g.id !== id);
    if (leader) {
      const leaderInOtherGroup = activeGroups.find(g => g.leader === leader || (Array.isArray(g.coLeaders) && g.coLeaders.includes(leader)));
      if (leaderInOtherGroup) {
        return res.status(400).json({ error: `Leader "${leader}" is already active in "${leaderInOtherGroup.name}". Dual active leadership positions are prohibited.` });
      }
    }

    // Prevent duplicate co-leader assignment in other active (non-archived) groups
    const coLeadersPayload = Array.isArray(coLeaders) ? coLeaders : [];
    for (const coL of coLeadersPayload) {
      const coLeaderInOtherGroup = activeGroups.find(g => g.leader === coL || (Array.isArray(g.coLeaders) && g.coLeaders.includes(coL)));
      if (coLeaderInOtherGroup) {
        return res.status(400).json({ error: `Co-Leader "${coL}" is already active in "${coLeaderInOtherGroup.name}". Dual active leadership positions are prohibited.` });
      }
    }

    // Capture old state signatures
    const oldStats = captureAllOldStats(db);
    const oldFolderId = group.barangayFolderId;
    const oldFolderName = group.assignedBarangays?.[0] || 'Unassigned';

    group.name = squadName;
    group.leader = leader;
    group.coLeaders = coLeadersPayload;
    group.assignedBarangays = canonicalFolderNames;
    group.ratePerPerson = parseFloat(ratePerPerson) || 120;
    group.barangayFolderId = barangayFolderId;

    // Sync user group assignments and clean up obsolete ones
    db.users.forEach(u => {
      const isNowInGroup = (u.fullName === group.leader || group.coLeaders.includes(u.fullName));
      if (isNowInGroup) {
        u.groupAssigned = group.id;
      } else if (u.groupAssigned === group.id) {
        u.groupAssigned = null;
      }
    });

    const currentUserName = req.currentUser?.fullName || 'System Admin';

    // Save and compute stats / logs
    SaintFrancisDB.save();

    if (oldFolderId && oldFolderId !== barangayFolderId) {
      SaintFrancisDB.log(
        currentUserName, 
        `Squad transfer: Transferred operational squad "${squadName}" (ID: ${group.id}) from Barangay folder "${oldFolderName}" (ID: ${oldFolderId}) to Barangay folder "${matchedBarangay.name}" (ID: ${barangayFolderId})`, 
        'Group Management'
      );
    } else {
      SaintFrancisDB.log(
        currentUserName, 
        `Squad update: Updated operational squad "${squadName}" (ID: ${group.id}) in Barangay folder "${matchedBarangay.name}" (ID: ${barangayFolderId})`, 
        'Group Management'
      );
    }
    logSquadChanges(currentUserName, oldStats, db);

    res.json({ success: true, group });
  } catch (err: any) {
    console.error('Error in /api/groups/edit route:', err);
    res.status(500).json({ error: err.message || 'Internal server error while editing group.' });
  }
});

app.post('/api/groups/delete', checkUser, (req: any, res) => {
  try {
    const { id } = req.body;
    const db = SaintFrancisDB.getData();

    const group = db.groups.find(g => g.id === id);
    if (!group) return res.status(404).json({ error: 'Operational Group/Squad not found.' });

    const deletedGroupName = group.name;
    const currentUserName = req.currentUser?.fullName || 'System Admin';
    const folderId = group.barangayFolderId || 'None';
    const folderName = group.assignedBarangays?.[0] || 'Unassigned';

    // Capture old state signatures
    const oldStats = captureAllOldStats(db);

    // SOFT DELETE: Move to Archived status instead of permanently dropping records
    group.isArchived = true;
    SaintFrancisDB.log(
      currentUserName, 
      `Soft Deleted (Archived) Operational Group/Squad: "${deletedGroupName}" (ID: ${id}) from Barangay folder "${folderName}" (ID: ${folderId})`, 
      'Group Management'
    );

    // Clean up users who were assigned to this group id so they instantly become eligible / available again
    db.users.forEach(u => {
      if (u.groupAssigned === id) {
        u.groupAssigned = null;
      }
    });

    // Save and compute stats / logs
    SaintFrancisDB.save();
    logSquadChanges(currentUserName, oldStats, db);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/groups/delete route:', err);
    res.status(500).json({ error: err.message || 'Internal server error while archiving group.' });
  }
});

app.post('/api/groups/restore', checkUser, (req: any, res) => {
  try {
    const { id } = req.body;
    const db = SaintFrancisDB.getData();

    const group = db.groups.find(g => g.id === id);
    if (!group) return res.status(404).json({ error: 'Operational Group/Squad not found.' });

    const groupName = group.name;
    const currentUserName = req.currentUser?.fullName || 'System Admin';
    const folderId = group.barangayFolderId || 'None';
    const folderName = group.assignedBarangays?.[0] || 'Unassigned';

    // Capture old state signatures
    const oldStats = captureAllOldStats(db);

    // RESTORE: Un-archive squad profile
    group.isArchived = false;

    // Cascade: Re-sync user assignments for leader & co-leaders if they are not already in another squad
    const activeCoLeaders = Array.isArray(group.coLeaders) ? group.coLeaders : [];
    db.users.forEach(u => {
      const isNowInGroup = (u.fullName === group.leader || activeCoLeaders.includes(u.fullName));
      if (isNowInGroup) {
        if (!u.groupAssigned) {
          u.groupAssigned = group.id;
        }
      }
    });

    SaintFrancisDB.log(
      currentUserName, 
      `Restored (Un-archived) Operational Group/Squad: "${groupName}" (ID: ${id}) to Barangay folder "${folderName}" (ID: ${folderId})`, 
      'Group Management'
    );

    // Save and compute stats / logs
    SaintFrancisDB.save();
    logSquadChanges(currentUserName, oldStats, db);

    res.json({ success: true, group });
  } catch (err: any) {
    console.error('Error in /api/groups/restore route:', err);
    res.status(500).json({ error: err.message || 'Internal server error while restoring group.' });
  }
});


// -------------------------------------------------------------
// 8. MASTERLIST PAGE API
// -------------------------------------------------------------
app.get('/api/masterlist', async (req, res) => {
  try {
    if (shouldAttemptMySQL()) {
      try {
        await SaintFrancisDB.loadFromDB();
      } catch (e) {
        console.error('[LAZY LOAD ERROR] /api/masterlist loadFromDB failure:', e);
      }
    }
    const db = SaintFrancisDB.getData();
    // Include heads, members, and dependents from all non-deleted households (Approved, Pending, or Disapproved)
    // so they are fully searchable and selectable in FPE/PCSF forms right away.
    const activeHouseholds = db.households.filter(h => !h.deletedAt);
    const hhMap = new Map(activeHouseholds.map(h => [h.id, h]));

    const list: any[] = [];
    const seenNames = new Set<string>();

    // Add Household heads
    activeHouseholds.forEach(h => {
      const rawName = h.householdHead || '';
      const cleanName = rawName.replace(/\s+/g, ' ').trim();
      if (!cleanName) return;
      const nameKey = cleanName.toLowerCase();

      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        const pin = h.pmrfDetails?.pin || h.pmrfDetails?.pmrfPin || '';
        list.push({
          id: h.id,
          householdId: h.id,
          householdNumber: h.householdNumber || '',
          fullName: cleanName,
          gender: h.pmrfDetails?.sex || 'Male', // Assume male or derive
          birthdate: h.pmrfDetails?.birthDate || h.pmrfDetails?.pmrfBirthDate || '',
          civilStatus: h.pmrfDetails?.civilStatus || h.pmrfDetails?.pmrfCivilStatus || 'Single',
          age: h.pmrfDetails?.birthDate ? (new Date().getFullYear() - new Date(h.pmrfDetails.birthDate).getFullYear()) : 45, // Sim visual
          address: h.completeAddress,
          barangay: h.barangay,
          purok: h.purok,
          recordedBy: h.createdBy,
          dateAdded: (h.createdAt && typeof h.createdAt === 'string') ? h.createdAt.split('T')[0] : '',
          role: 'Household Head',
          attachments: [],
          patientSignature: (h.patientSignature || h.pmrfDetails?.patientSignature) ? "PRESENT" : null,
          pmrfDetails: h.pmrfDetails ? { exists: true, pin } : null,
          fpeDetails: h.fpeDetails ? { exists: true } : null,
          pcsfDetails: h.pcsfDetails ? { exists: true } : null,
          notes: h.statusNotes || '',
          householdHead: h.householdHead,
          householdMobile: h.pmrfDetails?.mobileNo || h.pmrfDetails?.pmrfMobileNo || '',
          pin
        });
      }
    });

    // Add members
    db.householdMembers.forEach(m => {
      const hh = hhMap.get(m.householdId);
      if (hh && m.relationship !== 'Head') {
        const rawName = `${m.lastName}, ${m.firstName} ${m.middleName || ''}`;
        const cleanName = rawName.replace(/\s+/g, ' ').trim();
        if (!cleanName || cleanName === ',') return;
        const nameKey = cleanName.toLowerCase();

        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          const mPin = (m as any).memberPin || '';
          list.push({
            id: m.id,
            householdId: m.householdId,
            householdNumber: hh.householdNumber || '',
            fullName: cleanName,
            gender: m.gender,
            birthdate: m.birthdate || '',
            civilStatus: m.civilStatus || 'Single',
            age: m.age,
            address: hh.completeAddress,
            barangay: hh.barangay,
            purok: hh.purok,
            recordedBy: hh.createdBy,
            dateAdded: (hh.createdAt && typeof hh.createdAt === 'string') ? hh.createdAt.split('T')[0] : '',
            role: `Member - ${m.relationship}`,
            attachments: [],
            patientSignature: (hh.patientSignature || hh.pmrfDetails?.patientSignature) ? "PRESENT" : null,
            pmrfDetails: hh.pmrfDetails ? { exists: true, pin: mPin } : null,
            fpeDetails: hh.fpeDetails ? { exists: true } : null,
            pcsfDetails: hh.pcsfDetails ? { exists: true } : null,
            notes: hh.statusNotes || '',
            householdHead: hh.householdHead,
            householdMobile: hh.pmrfDetails?.mobileNo || hh.pmrfDetails?.pmrfMobileNo || '',
            pin: mPin
          });
        }
      }
    });

    // Add dependents
    db.dependents.forEach(d => {
      const hh = hhMap.get(d.householdId);
      if (hh) {
        const rawName = d.fullName || '';
        const cleanName = rawName.replace(/\s+/g, ' ').trim();
        if (!cleanName) return;
        const nameKey = cleanName.toLowerCase();

        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          const dPin = d.memberPin || '';
          list.push({
            id: d.id,
            householdId: d.householdId,
            householdNumber: hh.householdNumber || '',
            fullName: cleanName,
            gender: d.gender,
            birthdate: d.birthDate || d.birthdate || '',
            birthDate: d.birthDate || d.birthdate || '',
            civilStatus: d.civilStatus || 'Single',
            age: d.age,
            address: hh.completeAddress,
            barangay: hh.barangay,
            purok: hh.purok,
            recordedBy: hh.createdBy,
            dateAdded: (hh.createdAt && typeof hh.createdAt === 'string') ? hh.createdAt.split('T')[0] : '',
            role: `Dependent - ${d.relationship}`,
            attachments: [],
            patientSignature: (hh.patientSignature || hh.pmrfDetails?.patientSignature) ? "PRESENT" : null,
            pmrfDetails: hh.pmrfDetails ? { exists: true, pin: dPin } : null,
            fpeDetails: hh.fpeDetails ? { exists: true } : null,
            pcsfDetails: hh.pcsfDetails ? { exists: true } : null,
            notes: hh.statusNotes || '',
            householdHead: hh.householdHead,
            householdMobile: hh.pmrfDetails?.mobileNo || hh.pmrfDetails?.pmrfMobileNo || '',
            lastName: d.lastName || '',
            firstName: d.firstName || '',
            middleName: d.middleName || '',
            nameExt: d.nameExt || '',
            noMiddleName: !!d.noMiddleName,
            mononym: !!d.mononym,
            citizenship: d.citizenship || 'FILIPINO',
            isDisabled: !!d.isDisabled,
            pin: dPin
          });
        }
      }
    });

    res.json(list);
  } catch (error: any) {
    console.error('Error in /api/masterlist:', error);
    res.status(500).json({ error: error.message || 'Internal server error while building masterlist.' });
  }
});


// -------------------------------------------------------------
// 9. DAILY ACCOMPLISHMENTS & ATTACHMENTS REPORTING API
// -------------------------------------------------------------
app.get('/api/reports/daily-accomplishments', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const { date, startDate, endDate, position, barangay } = req.query;

  // 1. Determine relevant date filters
  const filterDateSingle = date ? String(date) : '';
  const filterStart = startDate ? String(startDate) : '';
  const filterEnd = endDate ? String(endDate) : '';

  const isWithinDateRange = (createdAtStr: string) => {
    if (!createdAtStr) return false;
    const itemDate = createdAtStr.substring(0, 10); // YYYY-MM-DD
    if (filterDateSingle) {
      return itemDate === filterDateSingle;
    }
    if (filterStart && filterEnd) {
      return itemDate >= filterStart && itemDate <= filterEnd;
    }
    // Default fallback to present date if nothing supplied
    const fallbackToday = new Date().toISOString().substring(0, 10);
    return itemDate === fallbackToday;
  };

  // 2. Filter households based on date and barangay
  const activeHouseholds = db.households.filter(h => {
    if (h.deletedAt) return false;
    
    // Check Date
    if (!isWithinDateRange(h.createdAt)) return false;

    // Check Barangay
    if (barangay && barangay !== 'All') {
      if (h.barangay !== barangay) return false;
    }
    return true;
  });

  // Calculate Counting Boxes:
  // - HouseHold Daily Count:
  const householdCount = activeHouseholds.length;

  // - Household Member Daily Count:
  const hhIds = activeHouseholds.map(h => h.id);
  const membersCount = db.householdMembers.filter(m => hhIds.includes(m.householdId)).length;

  // - PMRF Registration Daily Count: count of households where pmrfStatus === 'Willing'
  const pmrfCount = activeHouseholds.filter(h => h.pmrfStatus === 'Willing').length;

  // - Updating / Amendment Daily Count: (updatedAt matches date and is different from createdAt)
  const ammendCount = db.households.filter(h => {
    if (h.deletedAt) return false;
    if (!h.updatedAt) return false;
    if (!isWithinDateRange(h.updatedAt)) return false;
    if (h.createdAt === h.updatedAt) return false;
    if (barangay && barangay !== 'All' && h.barangay !== barangay) return false;
    return true;
  }).length;

  // - FPE Daily Count:
  const fpeCount = activeHouseholds.filter(h => h.fpeDetails && Object.keys(h.fpeDetails).length > 0).length;

  // - PCSF Daily Count:
  const pcsfCount = activeHouseholds.filter(h => h.pcsfDetails && Object.keys(h.pcsfDetails).length > 0).length;

  // 3. Compute User Breakdown:
  let targetUsers = db.users.filter(u => u.status === 'Approved');
  if (position && position !== 'All') {
    targetUsers = targetUsers.filter(u => hasRole(u, position));
  }

  const userBreakdown = targetUsers.map(user => {
    // Households registered by this account
    const userHouseholds = activeHouseholds.filter(h => 
      h.createdBy === user.email || h.createdBy === user.fullName
    );

    const uHhCount = userHouseholds.length;
    const uHhIds = userHouseholds.map(h => h.id);
    const uMembersCount = db.householdMembers.filter(m => uHhIds.includes(m.householdId)).length;

    // Geotagged Count: latitude & longitude present (not 0)
    const uGeotaggedCount = userHouseholds.filter(h => h.latitude && h.longitude && h.latitude !== 0 && h.longitude !== 0).length;

    // PMRF Count: Willing PMRF
    const uPmrfCount = userHouseholds.filter(h => h.pmrfStatus === 'Willing').length;

    // SFC Enrollment Willing Count: fetches from PMRF status consent
    const uSfcWillingCount = userHouseholds.filter(h => h.pmrfStatus === 'Willing' || (h.pmrfDetails?.consent === 'Yes' || h.pmrfDetails?.willing === 'Yes')).length;

    // Registered to other Clinic Count: fetches from Yakap Willing Status
    const uRegisteredOtherClinicCount = userHouseholds.filter(h => h.yakapWillingStatus === 'Willing').length;

    return {
      userId: user.id,
      name: user.fullName,
      position: user.position,
      householdsCount: uHhCount,
      membersCount: uMembersCount,
      geotaggedCount: uGeotaggedCount,
      pmrfCount: uPmrfCount,
      sfcWillingCount: uSfcWillingCount,
      registeredOtherClinicCount: uRegisteredOtherClinicCount
    };
  });

  res.json({
    counts: {
      householdCount,
      membersCount,
      pmrfCount,
      ammendCount,
      fpeCount,
      pcsfCount
    },
    userBreakdown
  });
});

app.get('/api/reports/daily-attachments', checkUser, (req: any, res) => {
  try {
    const db = SaintFrancisDB.getData();
    const { date, uploader, barangay, search } = req.query;

    let list: any[] = [];
    const filterDateSingle = date ? String(date) : '';

    db.households.forEach(h => {
      if (h.deletedAt) return;
      if (!h.attachments || !Array.isArray(h.attachments) || h.attachments.length === 0) return;

      // Filter by Date - safely check if createdAt is a string and valid length
      if (filterDateSingle) {
        if (!h.createdAt || typeof h.createdAt !== 'string' || h.createdAt.length < 10) return;
        if (h.createdAt.substring(0, 10) !== filterDateSingle) return;
      }

      // Filter by Barangay
      if (barangay && barangay !== 'All') {
        if (!h.barangay || typeof h.barangay !== 'string' || h.barangay !== barangay) return;
      }

      // Filter by Uploader
      if (uploader && uploader !== 'All') {
        const hCreatedBy = h.createdBy || '';
        const isUploader = hCreatedBy === uploader || 
                           hCreatedBy === db.users.find(u => u.id === uploader)?.fullName || 
                           hCreatedBy === db.users.find(u => u.email === uploader)?.email;
        if (!isUploader) return;
      }

      // Filter by Search bar with safe conversions
      if (search) {
        const s = String(search).toLowerCase();
        const matches = (h.householdHead || '').toLowerCase().includes(s) || 
                        (h.barangay || '').toLowerCase().includes(s) || 
                        (h.purok || '').toLowerCase().includes(s) || 
                        (h.completeAddress || '').toLowerCase().includes(s);
        if (!matches) return;
      }

      h.attachments.forEach((urlOrBase64: string, index: number) => {
        if (!urlOrBase64) return;
        const hCreatedBy = h.createdBy || 'Unknown';
        const user = db.users.find(u => u.email === hCreatedBy || u.fullName === hCreatedBy);
        
        list.push({
          id: `${h.id}-att-${index}`,
          householdId: h.id,
          householdHead: h.householdHead || 'Unknown Head',
          barangay: h.barangay || 'Unknown Barangay',
          purok: h.purok || 'Unknown Purok',
          uploaderName: user ? user.fullName : hCreatedBy,
          uploaderEmail: user ? user.email : hCreatedBy,
          uploadDate: h.createdAt || new Date().toISOString(),
          attachmentUrl: urlOrBase64,
          index: index
        });
      });
    });

    list.sort((a, b) => {
      const timeB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
      const timeA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    res.json(list);
  } catch (err: any) {
    console.error('Error in daily-attachments API:', err);
    res.json([]);
  }
});


// -------------------------------------------------------------
// 10. PAYROLL & PAID PAYROLL SYSTEM API
// -------------------------------------------------------------
app.get('/api/payroll', (req, res) => {
  const db = SaintFrancisDB.getData();
  const activeHouseholds = db.households.filter(h => !h.deletedAt && h.approvalStatus === 'Approved');

  // Calculates dynamically
  const payrollsList = db.groups.map(g => {
    const hInGroup = activeHouseholds.filter(h => {
      if (!h || !h.barangay) return false;
      const isBrgMatch = (g.assignedBarangays || []).some((b: string) => b.trim().toUpperCase() === h.barangay.trim().toUpperCase());
      if (!isBrgMatch) return false;
      const creatorLower = (h.createdBy || (h as any).submittedBy || h.submittedByUsername || '').trim().toLowerCase();
      const leaderLower = (g.leader || '').trim().toLowerCase();
      return creatorLower === leaderLower;
    });
    const headsCount = hInGroup.length;

    const hhIds = hInGroup.map(h => h.id);
    const membersCount = db.householdMembers.filter(m => {
      if (!m || !m.householdId || !hhIds.includes(m.householdId)) return false;
      const rel = (m.relationship || '').toLowerCase();
      // Exclude Head (already counted in headsCount), Spouse, and Mother's Maiden / Mother
      return rel !== 'head' && rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
    }).length;

    const dependentsCount = db.dependents.filter(d => {
      if (!d || !d.householdId || !hhIds.includes(d.householdId)) return false;
      const rel = (d.relationship || '').toLowerCase();
      // Exclude Spouse and Mother's Maiden / Mother
      return rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
    }).length;

    const populationCount = headsCount + membersCount + dependentsCount;
    const totalPayout = populationCount * g.ratePerPerson;

    // Determine the leader's registered Barangay (from address field of their User record)
    const leaderUser = db.users.find(u => u.fullName.toLowerCase() === g.leader.toLowerCase());
    const leaderBarangay = leaderUser && leaderUser.address ? leaderUser.address.trim() : (g.assignedBarangays[0] || 'Unassigned');

    // Automatically map squad personnel/employees of this group dynamically
    const squadPersonnel = db.users
      .filter(u => u.fullName === g.leader || g.coLeaders.includes(u.fullName) || u.groupAssigned === g.id || u.groupAssigned === g.name)
      .map(u => ({
        fullName: u.fullName,
        position: u.position,
        email: u.email
      }));

    return {
      groupId: g.id,
      groupName: g.name,
      leaderName: g.leader,
      coLeaders: g.coLeaders,
      squadPersonnel,
      populationCount,
      ratePerPerson: g.ratePerPerson,
      totalPayout,
      assignedBarangays: g.assignedBarangays || [],
      leaderBarangay,
      isArchived: !!g.isArchived,
      createdAt: g.createdAt || '2026-06-10',
      status: g.isArchived ? 'Archived' : (populationCount > 0 ? 'Approved' : 'Pending')
    };
  });

  res.json(payrollsList);
});

app.post('/api/payroll/settle', checkUser, (req: any, res) => {
  try {
    const { groupId, dateFrom, dateTo, remarks } = req.body;
    const db = SaintFrancisDB.getData();

    db.households = db.households || [];
    db.householdMembers = db.householdMembers || [];
    db.dependents = db.dependents || [];
    db.healthRecords = db.healthRecords || [];
    db.paidPayrolls = db.paidPayrolls || [];

    const activeHouseholds = db.households.filter(h => h && !h.deletedAt && h.approvalStatus === 'Approved');
    const group = (db.groups || []).find(g => g && g.id === groupId);

    if (!group) return res.status(404).json({ error: 'Group team not found.' });

    // Calculate population and payout
    const assignedBarangays = Array.isArray(group.assignedBarangays) ? group.assignedBarangays : [];
    const hInGroup = activeHouseholds.filter(h => {
      if (!h || !h.barangay) return false;
      const isBrgMatch = assignedBarangays.some(b => b.trim().toUpperCase() === h.barangay.trim().toUpperCase());
      if (!isBrgMatch) return false;
      const creatorLower = (h.createdBy || (h as any).submittedBy || h.submittedByUsername || '').trim().toLowerCase();
      const leaderLower = (group.leader || '').trim().toLowerCase();
      return creatorLower === leaderLower;
    });
    const headsCount = hInGroup.length;
    const hhIds = hInGroup.map(h => h.id).filter(Boolean);
    const membersCount = db.householdMembers.filter(m => {
      if (!m || !m.householdId || !hhIds.includes(m.householdId)) return false;
      const rel = (m.relationship || '').toLowerCase();
      // Exclude Head (already counted in headsCount), Spouse, and Mother's Maiden / Mother
      return rel !== 'head' && rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
    }).length;

    const dependentsCount = db.dependents.filter(d => {
      if (!d || !d.householdId || !hhIds.includes(d.householdId)) return false;
      const rel = (d.relationship || '').toLowerCase();
      // Exclude Spouse and Mother's Maiden / Mother
      return rel !== 'spouse' && !rel.includes('spouse') && !rel.includes('mother') && !rel.includes('maiden');
    }).length;
    const populationCount = headsCount + membersCount + dependentsCount;
    const totalAmountPaid = populationCount * (group.ratePerPerson || 0);

    const currentUserFullName = req.currentUser ? req.currentUser.fullName : 'System Admin';

    const settledRecord: PaidPayroll = {
      id: generateId('payl'),
      groupName: group.name,
      dateRange: `${dateFrom || ''} to ${dateTo || ''}`,
      populationCount,
      ratePerPerson: group.ratePerPerson || 0,
      totalAmountPaid,
      paidDate: new Date().toISOString().split('T')[0],
      settledBy: currentUserFullName,
      remarks: remarks || ''
    };

    // Archive to Settled Receipts
    db.paidPayrolls.unshift(settledRecord);

    // PURGE SETTLED RECORDS for fresh ledger cycles:
    db.households = db.households.filter(h => h && h.id && !hhIds.includes(h.id));
    db.householdMembers = db.householdMembers.filter(m => m && m.householdId && !hhIds.includes(m.householdId));
    db.dependents = db.dependents.filter(d => d && d.householdId && !hhIds.includes(d.householdId));
    db.healthRecords = db.healthRecords.filter(hr => hr && hr.householdId && !hhIds.includes(hr.householdId));

    SaintFrancisDB.save();

    SaintFrancisDB.log(currentUserFullName, `Settled Payroll for ${group.name} - Paid ₱${totalAmountPaid.toLocaleString()} and reset ${populationCount} active profiles to ledger cache`, 'Payroll Settlement');

    res.json({ success: true, paidRecord: settledRecord });
  } catch (err: any) {
    console.error('Error in /api/payroll/settle:', err);
    res.status(500).json({ error: err.message || 'Internal server error while settling group payroll.' });
  }
});

app.get('/api/payroll/paid', (req, res) => {
  const db = SaintFrancisDB.getData();
  res.json(db.paidPayrolls || []);
});

app.post('/api/it-payroll/settle', checkUser, (req: any, res) => {
  try {
    const { userId, dateFrom, dateTo, dailyRate, totalEarned, totalDeductions, daysPresent, daysAbsent, totalLateMinutes, breakdown, remarks } = req.body;
    const db = SaintFrancisDB.getData();

    // 1. Verify the selected IT Officer ID and supply constraints
    if (!userId) {
      return res.status(400).json({ error: 'Selected IT Officer ID is required.' });
    }

    const staff = (db.users || []).find((u: any) => u && u.id === userId);
    if (!staff) {
      return res.status(404).json({ error: 'IT Staff member not found.' });
    }

    if (!hasRole(staff, 'IT')) {
      return res.status(400).json({ error: `The selected user (${staff.fullName}) is not an IT Officer.` });
    }

    // 2. Settlement history must create a unique Settlement ID for every officer settlement transaction.
    const settlementId = generateId('itpay');
    db.timecards = db.timecards || [];
    
    // To handle timezone / local Philippine Time matching, get dates between dateFrom and dateTo (inclusive)
    const getLocalDateString = (isoString: string) => {
      const d = new Date(isoString);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 3. Prevent cross-officer attendance modification, restoration, matching, or overwrite.
    // We isolate and filter strictly using the Officer's Unique ID rather than shared fields.
    let markedCardsCount = 0;
    db.timecards.forEach((tc: any) => {
      if (tc) {
        // Strict match on Officer Unique ID, and fallback on userEmail only if it strictly matches this officer's registered email
        const isSelfCard = (tc.userId && tc.userId === userId) || 
                           (!tc.userId && tc.userEmail && staff.email && tc.userEmail.toLowerCase() === staff.email.toLowerCase());

        if (isSelfCard) {
          const tcDate = getLocalDateString(tc.timestamp);
          if (tcDate >= dateFrom && tcDate <= dateTo && !tc.settled) {
            tc.settled = true;
            tc.settlementId = settlementId;
            markedCardsCount++;
          }
        }
      }
    });

    // 4. Validate before settlement that attendance records belong only to the selected officer
    if (breakdown && Array.isArray(breakdown)) {
      const externalCrossOfficerLeak = breakdown.some((b: any) => {
        if (!b || !b.logs) return false;
        return b.logs.some((log: any) => {
          if (!log) return false;
          const logUserId = log.userId;
          const logUserEmail = log.userEmail;
          const isAnotherOfficer = (logUserId && logUserId !== userId) || 
                                    (!logUserId && logUserEmail && staff.email && logUserEmail.toLowerCase() !== staff.email.toLowerCase());
          return isAnotherOfficer;
        });
      });

      if (externalCrossOfficerLeak) {
        return res.status(400).json({ error: 'Invalid operation: Cross-officer attendance records detected in breakdown.' });
      }
    }

    const currentUserFullName = req.currentUser ? req.currentUser.fullName : 'System Admin';

    const settledRecord = {
      id: settlementId,
      userId: staff.id,
      userEmail: staff.email,
      userName: staff.fullName,
      dailyRate: dailyRate || 440,
      dateRange: `${dateFrom || ''} to ${dateTo || ''}`,
      daysPresent: daysPresent || 0,
      daysAbsent: daysAbsent || 0,
      totalLateMinutes: totalLateMinutes || 0,
      totalDeductions: totalDeductions || 0,
      totalEarned: totalEarned || 0,
      paidDate: new Date().toISOString().split('T')[0],
      settledBy: currentUserFullName,
      remarks: remarks || '',
      breakdown: breakdown || []
    };

    db.itSettledPayrolls = db.itSettledPayrolls || [];
    db.itSettledPayrolls.unshift(settledRecord);

    SaintFrancisDB.save();

    SaintFrancisDB.log(
      currentUserFullName,
      `Settled IT Staff Payroll for ${staff.fullName} - Range: ${dateFrom} to ${dateTo}, Paid: ₱${totalEarned.toLocaleString()}`,
      'IT Payroll Settlement'
    );

    res.json({ success: true, paidRecord: settledRecord });
  } catch (err: any) {
    console.error('Error in /api/it-payroll/settle:', err);
    res.status(500).json({ error: err.message || 'Internal server error while settling IT payroll.' });
  }
});

app.get('/api/it-payroll/settled', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  res.json(db.itSettledPayrolls || []);
});


// -------------------------------------------------------------
// 11. ACCOUNT MANAGEMENT API (Admin/HR Only)
// -------------------------------------------------------------
app.get('/api/accounts', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  
  const email = req.currentUser?.email || '';
  const isMasterAdmin = ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(email.toLowerCase());

  // Safe user objects without clear passwords, except for the Master Admin
  const usersSafe = db.users.map(u => {
    if (isMasterAdmin) {
      return { ...u };
    } else {
      const { password, ...safe } = u;
      return safe;
    }
  });
  res.json(usersSafe);
});

app.post('/api/accounts/action', checkUser, (req: any, res) => {
  try {
    const { userId, action } = req.body; // action: 'Approve' | 'Disable' | 'Enable'
    const db = SaintFrancisDB.getData();
    const targetUser = db.users.find(u => u.id === userId);

    if (!targetUser) return res.status(404).json({ error: 'User account not found.' });

    // Restrict to Admin or HR
    if (!hasRole(req.currentUser, ['ADMIN', 'HR'])) {
      return res.status(403).json({ error: 'Permission denied. Only Admin or HR can modify accounts.' });
    }

    if (action === 'Approve') {
      targetUser.status = 'Approved';
    } else if (action === 'Disable') {
      targetUser.status = 'Disabled';
    } else if (action === 'Enable') {
      targetUser.status = 'Approved';
    }

    SaintFrancisDB.save();
    
    const currentUserName = req.currentUser?.fullName || 'System Admin';
    SaintFrancisDB.log(currentUserName, `${action}d account for ${targetUser.fullName}`, 'Account Management');

    res.json({ success: true, user: targetUser });
  } catch (err: any) {
    console.error('Error in /api/accounts/action:', err);
    res.status(500).json({ error: err.message || 'Internal server error while executing account action.' });
  }
});

app.post('/api/accounts/edit', checkUser, (req: any, res) => {
  try {
    const { userId, fullName, position, address, groupAssigned, status, contactNumber } = req.body;
    const db = SaintFrancisDB.getData();
    const targetUser = db.users.find(u => u.id === userId);

    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (!hasRole(req.currentUser, ['ADMIN', 'HR', 'MANAGER'])) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    targetUser.fullName = fullName;
    if (hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
      targetUser.position = position;
      targetUser.address = address;
    }
    targetUser.groupAssigned = groupAssigned || null;
    targetUser.status = status;
    if (contactNumber !== undefined) {
      (targetUser as any).contactNumber = contactNumber;
    }

    SaintFrancisDB.save();
    
    const currentUserName = req.currentUser?.fullName || 'System Admin';
    SaintFrancisDB.log(currentUserName, `Edited user account profile: ${fullName}`, 'Account Management');
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/accounts/edit:', err);
    res.status(500).json({ error: err.message || 'Internal server error while editing account.' });
  }
});

app.post('/api/accounts/update-rate', checkUser, (req: any, res) => {
  try {
    const { userId, dailyRate } = req.body;
    const db = SaintFrancisDB.getData();
    const targetUser = db.users.find(u => u.id === userId);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER', 'HR'])) {
      return res.status(403).json({ error: 'Permission denied. Only Admin, Manager, or HR can modify rates.' });
    }

    const rateValue = parseFloat(dailyRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      return res.status(400).json({ error: 'Invalid rate value. It must be a positive number.' });
    }

    (targetUser as any).dailyRate = rateValue;
    SaintFrancisDB.save();

    const currentUserName = req.currentUser ? req.currentUser.fullName : 'System Admin';
    SaintFrancisDB.log(currentUserName, `Updated daily rate for IT Staff member ${targetUser.fullName} to ₱${rateValue}`, 'Payroll');
    return res.json({ success: true, user: targetUser });
  } catch (err: any) {
    console.error('Error in /api/accounts/update-rate API:', err);
    return res.status(500).json({ error: err.message || 'Internal server error while updating rate.' });
  }
});

app.post('/api/accounts/delete', checkUser, (req: any, res) => {
  const { userId } = req.body;
  const db = SaintFrancisDB.getData();

  if (req.currentUser.email && req.currentUser.email.toLowerCase() !== 'elthrone1233@gmail.com' && req.currentUser.email.toLowerCase() !== 'saintfrancisclinic2026@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only the Master Admin can delete database entry data.' });
  }

  db.users = db.users.filter(u => u.id !== userId);
  SaintFrancisDB.save();

  SaintFrancisDB.log(req.currentUser.fullName, `Deleted user account: ${userId}`, 'Account Management');
  res.json({ success: true, message: 'Account deleted successfully!' });
});


// -------------------------------------------------------------
// 12. SETTINGS MODULE API (Admin Only)
// -------------------------------------------------------------
app.get('/api/settings', (req, res) => {
  const db = SaintFrancisDB.getData();
  res.json(db.settings);
});

app.post('/api/settings/update', checkUser, (req: any, res) => {
  const settingsData: SiteSettings = req.body;
  const db = SaintFrancisDB.getData();

  if (!hasRole(req.currentUser, ['ADMIN', 'MANAGER'])) {
    return res.status(403).json({ error: 'Settings can only be changed by Admin or Manager.' });
  }

  db.settings = { ...db.settings, ...settingsData };
  SaintFrancisDB.save();

  SaintFrancisDB.log(req.currentUser.fullName, 'Updated Site Settings with Live Preview', 'Settings');
  res.json({ success: true, settings: db.settings });
});


// Helper to perform automatic 5:00 PM PHT timeout checks
function runAutoTimeoutCheck(db: any) {
  if (!db.timecards) db.timecards = [];
  
  const now = new Date();
  const addedTimecards: any[] = [];
  
  db.timecards.forEach((tcIn: any) => {
    if (!tcIn || tcIn.type !== 'IN' || !tcIn.timestamp) return;
    if (tcIn.settled) return; // Safely ignore already settled/archived attendance logs to protect historical audit records
    
    // Philippines Time is UTC +8: Shift timestamp to get local calendar date
    const phtTime = new Date(new Date(tcIn.timestamp).getTime() + 8 * 60 * 60 * 1000);
    const year = phtTime.getUTCFullYear();
    const month = phtTime.getUTCMonth();
    const date = phtTime.getUTCDate();
    
    // 5:00 PM PHT on that calendar date is 09:00:00 UTC
    const timeoutTimeUTC = new Date(Date.UTC(year, month, date, 9, 0, 0, 0));
    
    // Only apply if the current actual time is past 5:00 PM PHT of that day,
    // and only if the check-in occurred before 5:00 PM PHT of that day
    if (now.getTime() > timeoutTimeUTC.getTime() && new Date(tcIn.timestamp).getTime() < timeoutTimeUTC.getTime()) {
      // Check if there is already an OUT record on that same local PHT calendar day for this user after this IN timestamp
      const hasOut = db.timecards.some((tcOut: any) => {
        if (!tcOut || tcOut.type !== 'OUT' || !tcOut.timestamp) return false;
        
        const isSameUser = (tcOut.userId && tcIn.userId && tcOut.userId === tcIn.userId) || 
                           (tcOut.userEmail && tcIn.userEmail && tcOut.userEmail.toLowerCase() === tcIn.userEmail.toLowerCase());
        if (!isSameUser) return false;
        
        const outPhtTime = new Date(new Date(tcOut.timestamp).getTime() + 8 * 60 * 60 * 1000);
        const outYear = outPhtTime.getUTCFullYear();
        const outMonth = outPhtTime.getUTCMonth();
        const outDate = outPhtTime.getUTCDate();
        
        const isSameDay = outYear === year && outMonth === month && outDate === date;
        const isAfterIn = new Date(tcOut.timestamp).getTime() > new Date(tcIn.timestamp).getTime();
        
        return isSameDay && isAfterIn;
      }) || addedTimecards.some((tcOut: any) => {
        if (!tcOut || tcOut.type !== 'OUT' || !tcOut.timestamp) return false;
        
        const isSameUser = (tcOut.userId && tcIn.userId && tcOut.userId === tcIn.userId) || 
                           (tcOut.userEmail && tcIn.userEmail && tcOut.userEmail.toLowerCase() === tcIn.userEmail.toLowerCase());
        if (!isSameUser) return false;
        
        const outPhtTime = new Date(new Date(tcOut.timestamp).getTime() + 8 * 60 * 60 * 1000);
        const outYear = outPhtTime.getUTCFullYear();
        const outMonth = outPhtTime.getUTCMonth();
        const outDate = outPhtTime.getUTCDate();
        
        const isSameDay = outYear === year && outMonth === month && outDate === date;
        const isAfterIn = new Date(tcOut.timestamp).getTime() > new Date(tcIn.timestamp).getTime();
        
        return isSameDay && isAfterIn;
      });
      
      if (!hasOut) {
        // Create auto-timeout
        const newOut = {
          id: generateId('tc'),
          userId: tcIn.userId,
          userEmail: tcIn.userEmail,
          userName: tcIn.userName,
          type: 'OUT',
          timestamp: timeoutTimeUTC.toISOString(),
          photo: tcIn.photo, // Copy their check-in photo as the biometric proof
          latitude: tcIn.latitude,
          longitude: tcIn.longitude,
          deviceInfo: 'Auto Check-Out (5:00 PM System Rule)'
        };
        addedTimecards.push(newOut);
      }
    }
  });
  
  if (addedTimecards.length > 0) {
    db.timecards.unshift(...addedTimecards);
    db.timecards.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    SaintFrancisDB.save();
    console.log(`Auto 5 PM PHT Clock-Out triggered: populated ${addedTimecards.length} logs.`);
  }
}

// -------------------------------------------------------------
// Timecard / Attendance API
// -------------------------------------------------------------
app.get('/api/timecards', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const user = req.currentUser;
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Pre-process any dynamic 5pm timeouts
  runAutoTimeoutCheck(db);

  // Admins, HR and Managers see all timesheets, other roles see their own
  if (hasRole(user, ['ADMIN', 'HR', 'MANAGER'])) {
    res.json(db.timecards || []);
  } else {
    const filtered = (db.timecards || []).filter(tc => tc.userId === user.id || tc.userEmail === user.email);
    res.json(filtered);
  }
});

app.post('/api/timecards/clear', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const user = req.currentUser;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!hasRole(user, ['ADMIN', 'HR', 'MANAGER'])) {
    return res.status(403).json({ error: 'Access denied. Only Admins, Managers, and HR can clear attendance.' });
  }

  const { userId, userEmail, dateFrom, dateTo } = req.body;
  if (!userId && !userEmail) {
    return res.status(400).json({ error: 'Missing userId or userEmail' });
  }

  db.timecards = db.timecards || [];
  const initialLength = db.timecards.length;

  db.timecards = db.timecards.filter((tc: any) => {
    const isUser = (tc.userId && userId && tc.userId === userId) ||
                   (tc.userEmail && userEmail && tc.userEmail.toLowerCase() === userEmail.toLowerCase());
    
    if (!isUser) {
      return true;
    }

    if (dateFrom && dateTo) {
      if (!tc.timestamp) return true;
      const tcDate = new Date(tc.timestamp);
      if (isNaN(tcDate.getTime())) return true;
      const from = new Date(`${dateFrom}T00:00:00`);
      const to = new Date(`${dateTo}T23:59:59.999`);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && tcDate >= from && tcDate <= to) {
        return false; // delete/clear matches
      }
    } else {
      return false; // clear everything for this user if no range
    }

    return true;
  });

  SaintFrancisDB.save();
  const clearedCount = initialLength - db.timecards.length;

  SaintFrancisDB.log(
    user.fullName,
    `Cleared ${clearedCount} attendance timecard logs for ${userEmail || userId} in range [${dateFrom || 'All'} - ${dateTo || 'All'}]`,
    'IT Payroll'
  );

  res.json({
    success: true,
    message: `Successfully cleared ${clearedCount} calendar attendance records for ${userEmail || 'selected user'}.`
  });
});

app.post('/api/timecards/edit-time', checkUser, (req: any, res) => {
  const db = SaintFrancisDB.getData();
  const user = req.currentUser;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Master Admin or administrative role check
  const isMasterAdmin = user.email && ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(user.email.toLowerCase());
  const isAuthorized = isMasterAdmin || hasRole(user, ['ADMIN', 'MANAGER', 'HR']);
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied. You do not have sufficient administrative permissions to edit attendance records.' });
  }

  const { targetEmail, targetUserId, dateStr, timeStr } = req.body;
  if (!targetEmail && !targetUserId) {
    return res.status(400).json({ error: 'Missing target user identifier' });
  }
  if (!dateStr) {
    return res.status(400).json({ error: 'Missing dateStr parameter' });
  }

  db.timecards = db.timecards || [];

  // Helper function to match date in local YYYY-MM-DD
  const getLocalDateString = (isoString: string) => {
    try {
      const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
      if (isNaN(d.getTime())) return '';
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Find index of the first 'IN' regular (non-overtime) timecard for this user on this date
  const existingIndex = db.timecards.findIndex((tc: any) => {
    const isUser = (tc.userId && targetUserId && tc.userId === targetUserId) ||
                   (tc.userEmail && targetEmail && tc.userEmail.toLowerCase() === targetEmail.toLowerCase());
    return isUser && tc.type === 'IN' && !tc.isOvertime && getLocalDateString(tc.timestamp) === dateStr;
  });

  if (timeStr) {
    // We want to set/update to this time-in (e.g., "08:30")
    // Construct local timestamp iso string
    let newTimestampIso = '';
    try {
      const parts = dateStr.split('-'); // YYYY-MM-DD
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const timeParts = timeStr.split(':'); // HH:MM
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      
      // Construct UTC timestamp matching exact year, month, day, hours, minutes in PHT timezone (UTC+8)
      const phtUtcMs = Date.UTC(year, month, day, hours, minutes, 0, 0);
      const trueUtcDate = new Date(phtUtcMs - 8 * 60 * 60 * 1000); // subtract 8 hours for true UTC
      newTimestampIso = trueUtcDate.toISOString();
    } catch (err) {
      return res.status(400).json({ error: 'Invalid date or time format' });
    }

    if (existingIndex !== -1) {
      // Update existing
      db.timecards[existingIndex].timestamp = newTimestampIso;
    } else {
      // Create new 'IN' timecard
      const targetUserObj = db.users.find((u: any) => 
        (targetUserId && u.id === targetUserId) || 
        (targetEmail && u.email.toLowerCase() === targetEmail.toLowerCase())
      );
      const newTc = {
        id: 'tc_' + Math.random().toString(36).substring(2, 9),
        userId: targetUserObj?.id || targetUserId || '',
        userEmail: targetUserObj?.email || targetEmail || '',
        userName: targetUserObj?.fullName || targetEmail || 'IT Staff',
        type: 'IN' as const,
        timestamp: newTimestampIso,
        photo: '/placeholder_avatar.png',
        latitude: 14.5995,
        longitude: 120.9842,
        deviceInfo: 'Master Admin Manual Correction',
        isOvertime: false,
        settled: false
      };
      db.timecards.push(newTc);
      // Sort timecards by timestamp descending
      db.timecards.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } else {
    // If timeStr is empty, remove/delete any regular 'IN' timecard for this date
    if (existingIndex !== -1) {
      db.timecards.splice(existingIndex, 1);
    }
  }

  SaintFrancisDB.save();

  // Bypassed Clinical Action Audit Logs and Clinic System Alerts for Master Admin manual correction
  res.json({
    success: true,
    message: `Attendance log successfully updated for ${dateStr}.`
  });
});

app.post('/api/timecards/record', checkUser, (req: any, res) => {
  const { type, photo, latitude, longitude, deviceInfo, timestamp } = req.body;
  
  if (!type || !photo) {
    return res.status(400).json({ error: 'Missing type or photo parameter' });
  }
  
  const db = SaintFrancisDB.getData();
  const user = req.currentUser;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized user context' });
  }

  // Pre-process any dynamic 5pm timeouts before checking or adding current record
  runAutoTimeoutCheck(db);

  db.timecards = db.timecards || [];

  // Enforce clocking rules
  let isOvertimeField = false;
  let isOvertimeFieldOnOut = false;
  let computedOTHours = 0;

  if (type === 'IN') {
    const incomingDate = new Date(timestamp ? new Date(timestamp).getTime() : Date.now());
    const phtTime = new Date(incomingDate.getTime() + 8 * 60 * 60 * 1000);
    const year = phtTime.getUTCFullYear();
    const month = phtTime.getUTCMonth();
    const date = phtTime.getUTCDate();
    const incomingDateStrKey = `${year}-${month + 1}-${date}`;

    const phtHour = phtTime.getUTCHours();
    const phtMinute = phtTime.getUTCMinutes();
    const isOvertimeShift = (phtHour >= 17 && phtHour < 22) || (phtHour === 22 && phtMinute === 0);

    if (isOvertimeShift) {
      isOvertimeField = true;
      const alreadyOTClockedInToday = db.timecards.some((tc: any) => {
        if (tc.type !== 'IN' || !tc.timestamp || !tc.isOvertime) return false;
        
        const isSameUser = (tc.userId && user.id && tc.userId === user.id) || 
                           (tc.userEmail && user.email && tc.userEmail.toLowerCase() === user.email.toLowerCase());
        if (!isSameUser) return false;

        const recordPhtTime = new Date(new Date(tc.timestamp).getTime() + 8 * 60 * 60 * 1000);
        const rYear = recordPhtTime.getUTCFullYear();
        const rMonth = recordPhtTime.getUTCMonth();
        const rDate = recordPhtTime.getUTCDate();
        const recordDateStrKey = `${rYear}-${rMonth + 1}-${rDate}`;

        return recordDateStrKey === incomingDateStrKey;
      });

      if (alreadyOTClockedInToday) {
        return res.status(400).json({ error: 'You have already clocked in for Overtime today. Users are allowed to clock in for Overtime only once per day.' });
      }
    } else {
      const alreadyClockedInToday = db.timecards.some((tc: any) => {
        if (tc.type !== 'IN' || !tc.timestamp || tc.isOvertime) return false;
        
        const isSameUser = (tc.userId && user.id && tc.userId === user.id) || 
                           (tc.userEmail && user.email && tc.userEmail.toLowerCase() === user.email.toLowerCase());
        if (!isSameUser) return false;

        // Get PHT calendar date for the database record
        const recordPhtTime = new Date(new Date(tc.timestamp).getTime() + 8 * 60 * 60 * 1000);
        const rYear = recordPhtTime.getUTCFullYear();
        const rMonth = recordPhtTime.getUTCMonth();
        const rDate = recordPhtTime.getUTCDate();
        const recordDateStrKey = `${rYear}-${rMonth + 1}-${rDate}`;

        return recordDateStrKey === incomingDateStrKey;
      });

      if (alreadyClockedInToday) {
        return res.status(400).json({ error: 'You have already clocked in today. Users are allowed to clock in only once per day.' });
      }
    }
  }

  if (type === 'OUT') {
    // 1. Check if their latest state is currently timed OUT
    const latestAny = db.timecards.find((tc: any) => {
      if (tc.settled) return false;
      return (tc.userId && user.id && tc.userId === user.id) || 
             (tc.userEmail && user.email && tc.userEmail.toLowerCase() === user.email.toLowerCase());
    });

    if (latestAny && latestAny.type === 'OUT') {
      return res.status(400).json({ error: 'You are currently clocked out. You must clock in first before you can clock out.' });
    }

    // 2. Find their active clock-in
    const latestIn = db.timecards.find((tc: any) => {
      if (tc.type !== 'IN' || !tc.timestamp || tc.settled) return false;
      return (tc.userId && user.id && tc.userId === user.id) || 
             (tc.userEmail && user.email && tc.userEmail.toLowerCase() === user.email.toLowerCase());
    });

    if (!latestIn) {
      return res.status(400).json({ error: 'Unable to clock out. No active clock-in session was located for your account.' });
    }

    // 3. Enforce 4 hours duty minimum (ONLY for regular duty)
    const inTime = new Date(latestIn.timestamp).getTime();
    const outTime = new Date(timestamp ? new Date(timestamp).getTime() : Date.now()).getTime();
    const diffMs = outTime - inTime;
    const diffHrs = diffMs / (1000 * 60 * 60);

    if (!latestIn.isOvertime) {
      if (diffHrs < 4) {
        const remainingMs = (4 * 1000 * 60 * 60) - diffMs;
        const remainingHrs = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.ceil((remainingMs % (1000 * 60 * 65)) / (1000 * 60));
        
        let remainingText = '';
        if (remainingHrs > 0) {
          remainingText = `${remainingHrs} hour(s) and ${remainingMins} minute(s)`;
        } else {
          remainingText = `${remainingMins} minute(s)`;
        }
        return res.status(400).json({ 
          error: `Unable to clock out. You are not allowed to clock out if you haven't met at least 4 hours on duty. Please stay on duty for another ${remainingText}.` 
        });
      }
    } else {
      isOvertimeFieldOnOut = true;
      computedOTHours = Number(diffHrs.toFixed(2));
      // Save it back to matching checkin record
      latestIn.otHours = computedOTHours;
    }
  }

  const newTimecard = {
    id: generateId('tc'),
    userId: user.id,
    userEmail: user.email,
    userName: user.fullName,
    type,
    timestamp: timestamp || new Date().toISOString(),
    photo,
    latitude,
    longitude,
    deviceInfo: deviceInfo || 'Web Browser',
    isOvertime: type === 'IN' ? isOvertimeField : isOvertimeFieldOnOut,
    ...(type === 'OUT' && isOvertimeFieldOnOut ? { otHours: computedOTHours } : {})
  };

  db.timecards = db.timecards || [];
  db.timecards.unshift(newTimecard);
  SaintFrancisDB.save();

  // Log in activity logs
  SaintFrancisDB.log(
    user.fullName, 
    `Recorded Attendance: Time ${type === 'IN' ? 'IN' : 'OUT'}`, 
    'Attendance'
  );

  res.json({ success: true, timecard: newTimecard });
});



// -------------------------------------------------------------
// 13. NOTIFICATIONS API
// -------------------------------------------------------------
app.get('/api/notifications', (req, res) => {
  try {
    const db = SaintFrancisDB.getData();
    if (!db.notifications) {
      db.notifications = [];
    }
    // Sort notifications so that the new coming ones are on top of the list
    const sorted = [...db.notifications].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
    res.json(sorted);
  } catch (err: any) {
    console.error('Error in GET /api/notifications:', err);
    res.status(500).json({ error: err.message || 'Internal server error while fetching notifications.' });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  try {
    const { id } = req.body;
    const db = SaintFrancisDB.getData();
    if (!db.notifications) {
      db.notifications = [];
    }
    if (id === 'all') {
      db.notifications.forEach(n => n.read = true);
    } else {
      const notif = db.notifications.find(n => n.id === id);
      if (notif) notif.read = true;
    }
    await SaintFrancisDB.save();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/read:', err);
    res.status(500).json({ error: err.message || 'Internal server error while marking notification as read.' });
  }
});

app.post('/api/notifications/clear', checkUser, async (req: any, res) => {
  try {
    const db = SaintFrancisDB.getData();
    const user = req.currentUser;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isMasterAdminEmail = (emailStr: string) => {
      if (!emailStr) return false;
      const low = emailStr.toLowerCase();
      return low === 'elthrone1233@gmail.com' || low === 'saintfrancisclinic2026@gmail.com';
    };

    if (!user.email || !isMasterAdminEmail(user.email)) {
      return res.status(403).json({ error: 'Access denied. Only Master Admin is allowed to clear Clinic System Alerts.' });
    }

    db.notifications = [];
    await SaintFrancisDB.save();

    res.json({ success: true, message: 'Clinic System Alerts successfully cleared.' });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/clear:', err);
    res.status(500).json({ error: err.message || 'Error occurred while clearing alerts.' });
  }
});


// -------------------------------------------------------------
// 14. FIELD DOCUMENTATION LOGS / AUDIT TRAIL API
// -------------------------------------------------------------
app.get('/api/logs', (req, res) => {
  const db = SaintFrancisDB.getData();
  res.json(db.activityLogs);
});

app.post('/api/logs/clear', checkUser, (req: any, res) => {
  try {
    const db = SaintFrancisDB.getData();
    const user = req.currentUser;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isMasterAdminEmail = (emailStr: string) => {
      if (!emailStr) return false;
      const low = emailStr.toLowerCase();
      return low === 'elthrone1233@gmail.com' || low === 'saintfrancisclinic2026@gmail.com';
    };

    if (!user.email || !isMasterAdminEmail(user.email)) {
      return res.status(403).json({ error: 'Access denied. Only Master Admin is allowed to clear Clinical Action Audit Logs.' });
    }

    db.activityLogs = [];
    SaintFrancisDB.save();

    res.json({ success: true, message: 'Clinical Action Audit Logs successfully cleared.' });
  } catch (err: any) {
    console.error('Error clearing audit logs:', err);
    res.status(500).json({ error: err.message || 'Error occurred while clearing logs.' });
  }
});

// Database Status Endpoint (Checks live MySQL connectivity)
app.get('/api/db-status', async (req, res) => {
  const result = await testMySQLConnection();
  res.json({ connected: result.connected });
});

// MySQL / phpMyAdmin Status and Configuration Endpoint
app.get('/api/mysql-status', async (req, res) => {
  const result = await testMySQLConnection();
  const config = getMySQLConfig();
  res.json({
    connected: result.connected,
    message: result.message,
    config: {
      host: config.host || 'Not Set',
      user: config.user || 'Not Set',
      database: config.database || 'Not Set',
      password: config.password || 'Not Set',
      port: config.port
    }
  });
});

// SQL Schema Download Endpoint
app.get('/api/mysql-schema', (req, res) => {
  const schemaPath = path.join(process.cwd(), 'mysql-schema.sql');
  if (fs.existsSync(schemaPath)) {
    const rawSql = fs.readFileSync(schemaPath, 'utf8');
    res.json({ sql: rawSql });
  } else {
    res.status(404).json({ error: 'SQL Schema Script not found on server.' });
  }
});


// Full Live Database Export Endpoint
app.get('/api/export-data', async (req, res) => {
  try {
    // 1. Force reload the latest data to ensure no mismatch
    await SaintFrancisDB.loadFromDB(true);
    const state = SaintFrancisDB.getData();

    const excludeBinaries = req.query.exclude_binaries !== 'false';

    // 2. Generate JSON string representation
    let stateToExport = state;
    if (excludeBinaries) {
      stateToExport = {
        ...state,
        timecards: (state.timecards || []).map(t => ({
          ...t,
          photo: t.photo && t.photo.length > 500 ? '// [PHOTO_EXCLUDED_FOR_PERFORMANCE]' : t.photo
        })),
        pcuFiles: (state.pcuFiles || []).map(f => ({
          ...f,
          fileData: f.fileData && f.fileData.length > 500 ? '// [FILE_DATA_EXCLUDED_FOR_PERFORMANCE]' : f.fileData
        }))
      };
    }
    const jsonString = JSON.stringify(stateToExport, null, 2);

    // 3. Generate SQL script file with drop/creates & current record inserts
    const schemaPath = path.join(process.cwd(), 'mysql-schema.sql');
    let sqlContent = '';

    if (fs.existsSync(schemaPath)) {
      const rawSchema = fs.readFileSync(schemaPath, 'utf8');
      // Split and take up to the comment "-- 3. INITIAL SEED INJECTIONS"
      const parts = rawSchema.split('-- 3. INITIAL SEED INJECTIONS');
      sqlContent = parts[0];
    } else {
      sqlContent = `-- Primary database export fallback\nSET FOREIGN_KEY_CHECKS = 0;\n`;
    }

    // Append a section for the exported data
    sqlContent += `\n-- =============================================================================\n`;
    sqlContent += `-- DYNAMIC FIELD RECORD DUMP (Total Tables Backed Up)\n`;
    sqlContent += `-- Exported on: ${new Date().toISOString()}\n`;
    sqlContent += `-- =============================================================================\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    const safeSqlVal = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? '1' : '0';
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'object') {
        return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      }
      return `'${val.toString().replace(/'/g, "''")}'`;
    };

    // Helper to generate bulk insert statements
    const generateInserts = (tableName: string, columns: string[], dataList: any[], valueMapper: (item: any) => any[]): string => {
      if (!dataList || dataList.length === 0) {
        return `-- No active rows recorded for [${tableName}]\n\n`;
      }
      let stmt = `TRUNCATE TABLE \`${tableName}\`;\n`;
      stmt += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES \n`;
      
      const valRows = dataList.map(item => {
        const mappedVals = valueMapper(item);
        return `(${mappedVals.map(v => safeSqlVal(v)).join(', ')})`;
      });

      stmt += valRows.join(',\n') + ';\n\n';
      return stmt;
    };

    // A. site_settings
    sqlContent += `-- Dumping data for table \`site_settings\`\n`;
    const settings = state.settings || {};
    sqlContent += generateInserts('site_settings', [
      'faviconLogo', 'faviconTitle', 'websiteTitle', 'websiteLogo', 'seoTitle', 'seoDescription', 'seoKeywords', 'squadDeleteAction', 'userPagePermissions'
    ], [settings], (s) => [
      s.faviconLogo, s.faviconTitle, s.websiteTitle, s.websiteLogo, s.seoTitle, s.seoDescription, s.seoKeywords, s.squadDeleteAction, s.userPagePermissions
    ]);

    // B. users
    sqlContent += `-- Dumping data for table \`users\`\n`;
    sqlContent += generateInserts('users', [
      'id', 'fullName', 'email', 'password', 'position', 'address', 'groupAssigned', 'status', 'createdAt', 'updatedAt', 'profilePicture', 'contactNumber', 'dailyRate'
    ], state.users || [], (u) => [
      u.id, u.fullName, u.email, u.password, u.position, u.address, u.groupAssigned, u.status, u.createdAt, u.updatedAt, u.profilePicture, u.contactNumber, u.dailyRate
    ]);

    // C. barangays
    sqlContent += `-- Dumping data for table \`barangays\`\n`;
    sqlContent += generateInserts('barangays', [
      'id', 'name', 'puroksCount', 'yakapWillingCount', 'householdProgressBar', 'membersProgressBar', 'pmrfProgressBar'
    ], state.barangays || [], (b) => [
      b.id, b.name, b.puroksCount, b.yakapWillingCount, b.householdProgressBar, b.membersProgressBar, b.pmrfProgressBar
    ]);

    // D. puroks
    sqlContent += `-- Dumping data for table \`puroks\`\n`;
    sqlContent += generateInserts('puroks', [
      'id', 'name', 'barangay', 'householdCount', 'memberCount', 'pmrfCount', 'yakapWillingCount'
    ], state.puroks || [], (p) => [
      p.id, p.name, p.barangay, p.householdCount, p.memberCount, p.pmrfCount, p.yakapWillingCount
    ]);

    // E. households
    sqlContent += `-- Dumping data for table \`households\`\n`;
    sqlContent += generateInserts('households', [
      'id', 'householdNumber', 'householdHead', 'contactNumber', 'completeAddress', 'barangay', 'purok', 'latitude', 'longitude', 'pmrfStatus', 'yakapWillingStatus', 'approvalStatus', 'attachments', 'remarks', 'pmrfDetails', 'fpeDetails', 'pcsfDetails', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedBy', 'deletedAt'
    ], state.households || [], (h) => [
      h.id, h.householdNumber, h.householdHead, h.contactNumber, h.completeAddress, h.barangay, h.purok, h.latitude, h.longitude, h.pmrfStatus, h.yakapWillingStatus, h.approvalStatus, h.attachments, h.remarks, h.pmrfDetails, h.fpeDetails, h.pcsfDetails, h.createdBy, h.updatedBy, h.createdAt, h.updatedAt, h.deletedBy, h.deletedAt
    ]);

    // F. household_members
    sqlContent += `-- Dumping data for table \`household_members\`\n`;
    sqlContent += generateInserts('household_members', [
      'id', 'householdId', 'firstName', 'middleName', 'lastName', 'gender', 'birthdate', 'age', 'civilStatus', 'occupation', 'relationship'
    ], state.householdMembers || [], (m) => [
      m.id, m.householdId, m.firstName, m.middleName, m.lastName, m.gender, m.birthdate, m.age, m.civilStatus, m.occupation, m.relationship
    ]);

    // G. dependents
    sqlContent += `-- Dumping data for table \`dependents\`\n`;
    sqlContent += generateInserts('dependents', [
      'id', 'householdId', 'last_name', 'first_name', 'middle_name', 'name_ext', 'relationship', 'date_of_birth', 'sex', 'citizenship', 'no_mn', 'mononym', 'pswd', 'gender', 'age', 'civilStatus', 'isDisabled', 'pmrfSubmissionId', 'pmrfRecordId', 'memberPin', 'submittedByAccountId', 'createdAt'
    ], state.dependents || [], (d) => {
      const isNoMn = d.noMiddleName === true || d.noMiddleName === 1 || d.no_mn === true || d.no_mn === 1;
      const isDis = d.isDisabled === true || d.isDisabled === 1 || d.pswd === true || d.pswd === 1;
      return [
        d.id, d.householdId, d.lastName || d.last_name, d.firstName || d.first_name, d.middleName || d.middle_name, d.nameExt || d.name_ext, d.relationship, d.birthDate || d.birthdate || d.date_of_birth, d.gender || d.sex, d.citizenship, isNoMn ? 1 : 0, d.mononym ? 1 : 0, isDis ? 1 : 0, d.gender || d.sex, d.age, d.civilStatus, isDis ? 1 : 0, d.pmrfSubmissionId, d.pmrfRecordId, d.memberPin, d.submittedByAccountId, d.createdAt
      ];
    });

    // H. pmrf_dependents
    sqlContent += `-- Dumping data for table \`pmrf_dependents\`\n`;
    sqlContent += generateInserts('pmrf_dependents', [
      'id', 'pmrf_id', 'submission_id', 'last_name', 'first_name', 'middle_name', 'name_ext', 'relationship', 'date_of_birth', 'sex', 'citizenship', 'no_mn', 'mononym', 'pswd', 'age', 'civilStatus', 'isDisabled', 'pmrfSubmissionId', 'pmrfRecordId', 'memberPin', 'submittedByAccountId', 'createdAt'
    ], state.dependents || [], (d) => {
      const isNoMn = d.noMiddleName === true || d.noMiddleName === 1 || d.no_mn === true || d.no_mn === 1;
      const isDis = d.isDisabled === true || d.isDisabled === 1 || d.pswd === true || d.pswd === 1;
      return [
        d.id, d.householdId, d.pmrfSubmissionId || d.submission_id, d.lastName || d.last_name, d.firstName || d.first_name, d.middleName || d.middle_name, d.nameExt || d.name_ext, d.relationship, d.birthDate || d.birthdate || d.date_of_birth, d.gender || d.sex, d.citizenship, isNoMn ? 1 : 0, d.mononym ? 1 : 0, isDis ? 1 : 0, d.age, d.civilStatus, isDis ? 1 : 0, d.pmrfSubmissionId, d.pmrfRecordId, d.memberPin, d.submittedByAccountId, d.createdAt
      ];
    });

    // I. groups
    sqlContent += `-- Dumping data for table \`groups\`\n`;
    sqlContent += generateInserts('groups', [
      'id', 'name', 'leader', 'coLeaders', 'assignedBarangays', 'ratePerPerson', 'isArchived', 'barangayFolderId', 'createdAt', 'status'
    ], state.groups || [], (g) => [
      g.id, g.name, g.leader, g.coLeaders, g.assignedBarangays, g.ratePerPerson, g.isArchived || 0, g.barangayFolderId, g.createdAt, g.status
    ]);

    // J. paid_payrolls
    sqlContent += `-- Dumping data for table \`paid_payrolls\`\n`;
    sqlContent += generateInserts('paid_payrolls', [
      'id', 'groupName', 'dateRange', 'populationCount', 'ratePerPerson', 'totalAmountPaid', 'paidDate', 'settledBy', 'remarks'
    ], state.paidPayrolls || [], (py) => [
      py.id, py.groupName, py.dateRange, py.populationCount, py.ratePerPerson, py.totalAmountPaid, py.paidDate, py.settledBy, py.remarks
    ]);

    // K. health_records
    sqlContent += `-- Dumping data for table \`health_records\`\n`;
    sqlContent += generateInserts('health_records', [
      'id', 'patientName', 'householdId', 'householdHead', 'barangay', 'diagnosis', 'treatment', 'medications', 'notes', 'bloodPressure', 'heartRate', 'respRate', 'temperature', 'weightKg', 'heightCm', 'bmi', 'date'
    ], state.healthRecords || [], (hr) => [
      hr.id, hr.patientName, hr.householdId, hr.householdHead, hr.barangay, hr.diagnosis, hr.treatment, hr.medications, hr.notes, hr.bloodPressure, hr.heartRate, hr.respRate, hr.temperature, hr.weightKg, hr.heightCm, hr.bmi, hr.date
    ]);

    // L. activity_logs
    sqlContent += `-- Dumping data for table \`activity_logs\`\n`;
    sqlContent += generateInserts('activity_logs', [
      'id', 'user', 'action', 'module', 'date', 'time'
    ], state.activityLogs || [], (l) => [
      l.id, l.user, l.action, l.module, l.date, l.time
    ]);

    // M. notifications
    sqlContent += `-- Dumping data for table \`notifications\`\n`;
    sqlContent += generateInserts('notifications', [
      'id', 'title', 'message', 'type', 'is_read', 'createdAt'
    ], state.notifications || [], (n) => [
      n.id, n.title, n.message, n.type, n.read ? 1 : 0, n.createdAt
    ]);

    // N. timecards
    sqlContent += `-- Dumping data for table \`timecards\`\n`;
    sqlContent += generateInserts('timecards', [
      'id', 'userId', 'userEmail', 'userName', 'type', 'timestamp', 'photo', 'latitude', 'longitude', 'deviceInfo', 'settled', 'settlementId', 'isOvertime', 'otHours'
    ], state.timecards || [], (t) => [
      t.id, t.userId, t.userEmail, t.userName, t.type, t.timestamp, 
      (excludeBinaries && t.photo && t.photo.length > 500) ? '// [PHOTO_EXCLUDED_FOR_PERFORMANCE]' : t.photo, 
      t.latitude, t.longitude, t.deviceInfo, t.settled ? 1 : 0, t.settlementId,
      t.isOvertime ? 1 : 0, t.otHours !== undefined && t.otHours !== null ? t.otHours : null
    ]);

    // O. it_settled_payrolls
    sqlContent += `-- Dumping data for table \`it_settled_payrolls\`\n`;
    sqlContent += generateInserts('it_settled_payrolls', [
      'id', 'userId', 'userEmail', 'userName', 'dailyRate', 'dateRange', 'daysPresent', 'daysAbsent', 'totalLateMinutes', 'totalDeductions', 'totalEarned', 'paidDate', 'settledBy', 'remarks', 'breakdown'
    ], state.itSettledPayrolls || [], (it) => [
      it.id, it.userId, it.userEmail, it.userName, it.dailyRate, it.dateRange, it.daysPresent, it.daysAbsent, it.totalLateMinutes, it.totalDeductions, it.totalEarned, it.paidDate, it.settledBy, it.remarks, it.breakdown
    ]);

    // P. pcu_files
    sqlContent += `-- Dumping data for table \`pcu_files\`\n`;
    sqlContent += generateInserts('pcu_files', [
      'id', 'fullName', 'birthday', 'fileName', 'fileData', 'uploadDate', 'uploadedBy'
    ], state.pcuFiles || [], (f) => [
      f.id, f.fullName, f.birthday, f.fileName, 
      (excludeBinaries && f.fileData && f.fileData.length > 500) ? '// [FILE_DATA_EXCLUDED_FOR_PERFORMANCE]' : f.fileData, 
      f.uploadDate, f.uploadedBy
    ]);

    sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    res.json({
      json: jsonString,
      sql: sqlContent
    });
  } catch (error: any) {
    console.error('Data Export Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during database dump creation.' });
  }
});


// Dedicated Streaming & Compressed Download for Large Files
app.get('/api/export-data/download', async (req, res) => {
  try {
    // 1. Force reload the latest data to ensure no mismatch
    await SaintFrancisDB.loadFromDB(true);
    const state = SaintFrancisDB.getData();

    const excludeBinaries = req.query.exclude_binaries === 'true';
    const useGzip = req.query.gzip === 'true';
    const format = req.query.format === 'sql' ? 'sql' : 'json';

    let fileName = `saint-francis-db-backup-${new Date().toISOString().slice(0, 10)}`;

    let outStream: any = res;
    if (useGzip) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', format === 'sql' ? 'text/plain' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.${format}.gz"`);
      const gzip = zlib.createGzip();
      gzip.pipe(res);
      outStream = gzip;
    } else {
      res.setHeader('Content-Type', format === 'sql' ? 'text/plain' : 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.${format}"`);
    }

    const writeAsync = async (chunk: string): Promise<void> => {
      const canWrite = outStream.write(chunk);
      if (!canWrite) {
        await new Promise<void>((resolve) => {
          outStream.once('drain', resolve);
        });
      }
    };

    if (format === 'json') {
      // Stream JSON properties one by one to avoid loading entire stringified DB into memory
      await writeAsync('{\n');
      const keys = Object.keys(state);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = state[key];

        if (Array.isArray(val)) {
          await writeAsync(`  "${key}": [\n`);
          for (let j = 0; j < val.length; j++) {
            let item = val[j];
            if (excludeBinaries) {
              if (key === 'timecards') {
                item = {
                  ...item,
                  photo: item.photo && item.photo.length > 500 ? '// [PHOTO_EXCLUDED_FOR_PERFORMANCE]' : item.photo
                };
              } else if (key === 'pcuFiles') {
                item = {
                  ...item,
                  fileData: item.fileData && item.fileData.length > 500 ? '// [FILE_DATA_EXCLUDED_FOR_PERFORMANCE]' : item.fileData
                };
              }
            }
            // Indent the items inside array
            await writeAsync(`    ${JSON.stringify(item, null, 2).replace(/\n/g, '\n    ')}`);
            if (j < val.length - 1) {
              await writeAsync(',\n');
            } else {
              await writeAsync('\n');
            }
          }
          await writeAsync('  ]');
        } else {
          await writeAsync(`  "${key}": ${JSON.stringify(val, null, 2).replace(/\n/g, '\n  ')}`);
        }

        if (i < keys.length - 1) {
          await writeAsync(',\n');
        } else {
          await writeAsync('\n');
        }
      }
      await writeAsync('}\n');
      outStream.end();
    } else {
      // SQL Format
      const schemaPath = path.join(process.cwd(), 'mysql-schema.sql');
      if (fs.existsSync(schemaPath)) {
        const rawSchema = fs.readFileSync(schemaPath, 'utf8');
        const parts = rawSchema.split('-- 3. INITIAL SEED INJECTIONS');
        await writeAsync(parts[0]);
      } else {
        await writeAsync(`-- Primary database export fallback\nSET FOREIGN_KEY_CHECKS = 0;\n`);
      }

      await writeAsync(`\n-- =============================================================================\n`);
      await writeAsync(`-- DYNAMIC FIELD RECORD DUMP (Total Tables Backed Up)\n`);
      await writeAsync(`-- Exported on: ${new Date().toISOString()}\n`);
      await writeAsync(`-- =============================================================================\n\n`);
      await writeAsync(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

      const safeSqlVal3 = (val: any): string => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'boolean') return val ? '1' : '0';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'object') {
          return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        }
        return `'${val.toString().replace(/'/g, "''")}'`;
      };

      const streamInserts = async (tableName: string, columns: string[], dataList: any[], valueMapper: (item: any) => any[]): Promise<void> => {
        if (!dataList || dataList.length === 0) {
          await writeAsync(`-- No active rows recorded for [${tableName}]\n\n`);
          return;
        }
        await writeAsync(`TRUNCATE TABLE \`${tableName}\`;\n`);
        
        // Write in chunk size to prevent extreme INSERT statement lengths
        const chunkSize = 100;
        for (let idx = 0; idx < dataList.length; idx += chunkSize) {
          const chunk = dataList.slice(idx, idx + chunkSize);
          await writeAsync(`INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES \n`);
          const valRows = chunk.map(item => {
            const mappedVals = valueMapper(item);
            return `(${mappedVals.map(v => safeSqlVal3(v)).join(', ')})`;
          });
          await writeAsync(valRows.join(',\n') + ';\n\n');
        }
      };

      // A. site_settings
      await writeAsync(`-- Dumping data for table \`site_settings\`\n`);
      const settings = state.settings || {};
      await streamInserts('site_settings', [
        'faviconLogo', 'faviconTitle', 'websiteTitle', 'websiteLogo', 'seoTitle', 'seoDescription', 'seoKeywords', 'squadDeleteAction', 'userPagePermissions'
      ], [settings], (s) => [
        s.faviconLogo, s.faviconTitle, s.websiteTitle, s.websiteLogo, s.seoTitle, s.seoDescription, s.seoKeywords, s.squadDeleteAction, s.userPagePermissions
      ]);

      // B. users
      await writeAsync(`-- Dumping data for table \`users\`\n`);
      await streamInserts('users', [
        'id', 'fullName', 'email', 'password', 'position', 'address', 'groupAssigned', 'status', 'createdAt', 'updatedAt', 'profilePicture', 'contactNumber', 'dailyRate'
      ], state.users || [], (u) => [
        u.id, u.fullName, u.email, u.password, u.position, u.address, u.groupAssigned, u.status, u.createdAt, u.updatedAt, u.profilePicture, u.contactNumber, u.dailyRate
      ]);

      // C. barangays
      await writeAsync(`-- Dumping data for table \`barangays\`\n`);
      await streamInserts('barangays', [
        'id', 'name', 'puroksCount', 'yakapWillingCount', 'householdProgressBar', 'membersProgressBar', 'pmrfProgressBar'
      ], state.barangays || [], (b) => [
        b.id, b.name, b.puroksCount, b.yakapWillingCount, b.householdProgressBar, b.membersProgressBar, b.pmrfProgressBar
      ]);

      // D. puroks
      await writeAsync(`-- Dumping data for table \`puroks\`\n`);
      await streamInserts('puroks', [
        'id', 'name', 'barangay', 'householdCount', 'memberCount', 'pmrfCount', 'yakapWillingCount'
      ], state.puroks || [], (p) => [
        p.id, p.name, p.barangay, p.householdCount, p.memberCount, p.pmrfCount, p.yakapWillingCount
      ]);

      // E. households
      await writeAsync(`-- Dumping data for table \`households\`\n`);
      await streamInserts('households', [
        'id', 'householdNumber', 'householdHead', 'contactNumber', 'completeAddress', 'barangay', 'purok', 'latitude', 'longitude', 'pmrfStatus', 'yakapWillingStatus', 'approvalStatus', 'attachments', 'remarks', 'pmrfDetails', 'fpeDetails', 'pcsfDetails', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedBy', 'deletedAt'
      ], state.households || [], (h) => [
        h.id, h.householdNumber, h.householdHead, h.contactNumber, h.completeAddress, h.barangay, h.purok, h.latitude, h.longitude, h.pmrfStatus, h.yakapWillingStatus, h.approvalStatus, h.attachments, h.remarks, h.pmrfDetails, h.fpeDetails, h.pcsfDetails, h.createdBy, h.updatedBy, h.createdAt, h.updatedAt, h.deletedBy, h.deletedAt
      ]);

      // F. household_members
      await writeAsync(`-- Dumping data for table \`household_members\`\n`);
      await streamInserts('household_members', [
        'id', 'householdId', 'firstName', 'middleName', 'lastName', 'gender', 'birthdate', 'age', 'civilStatus', 'occupation', 'relationship'
      ], state.householdMembers || [], (m) => [
        m.id, m.householdId, m.firstName, m.middleName, m.lastName, m.gender, m.birthdate, m.age, m.civilStatus, m.occupation, m.relationship
      ]);

      // G. dependents
      await writeAsync(`-- Dumping data for table \`dependents\`\n`);
      await streamInserts('dependents', [
        'id', 'householdId', 'last_name', 'first_name', 'middle_name', 'name_ext', 'relationship', 'date_of_birth', 'sex', 'citizenship', 'no_mn', 'mononym', 'pswd', 'gender', 'age', 'civilStatus', 'isDisabled', 'pmrfSubmissionId', 'pmrfRecordId', 'memberPin', 'submittedByAccountId', 'createdAt'
      ], state.dependents || [], (d) => {
        const isNoMn = d.noMiddleName === true || d.noMiddleName === 1 || d.no_mn === true || d.no_mn === 1;
        const isDis = d.isDisabled === true || d.isDisabled === 1 || d.pswd === true || d.pswd === 1;
        return [
          d.id, d.householdId, d.lastName || d.last_name, d.firstName || d.first_name, d.middleName || d.middle_name, d.nameExt || d.name_ext, d.relationship, d.birthDate || d.birthdate || d.date_of_birth, d.sex || d.gender, d.citizenship, isNoMn ? 1 : 0, d.mononym ? 1 : 0, isDis ? 1 : 0, d.gender || d.sex, d.age, d.civilStatus, isDis ? 1 : 0, d.pmrfSubmissionId, d.pmrfRecordId, d.memberPin, d.submittedByAccountId, d.createdAt
        ];
      });

      // H. pmrf_dependents
      await writeAsync(`-- Dumping data for table \`pmrf_dependents\`\n`);
      await streamInserts('pmrf_dependents', [
        'id', 'pmrf_id', 'submission_id', 'last_name', 'first_name', 'middle_name', 'name_ext', 'relationship', 'date_of_birth', 'sex', 'citizenship', 'no_mn', 'mononym', 'pswd', 'age', 'civilStatus', 'isDisabled', 'pmrfSubmissionId', 'pmrfRecordId', 'memberPin', 'submittedByAccountId', 'createdAt'
      ], state.dependents || [], (d) => {
        const isNoMn = d.noMiddleName === true || d.noMiddleName === 1 || d.no_mn === true || d.no_mn === 1;
        const isDis = d.isDisabled === true || d.isDisabled === 1 || d.pswd === true || d.pswd === 1;
        return [
          d.id, d.householdId, d.pmrfSubmissionId || d.submission_id, d.lastName || d.last_name, d.firstName || d.first_name, d.middleName || d.middle_name, d.nameExt || d.name_ext, d.relationship, d.birthDate || d.birthdate || d.date_of_birth, d.gender || d.sex, d.citizenship, isNoMn ? 1 : 0, d.mononym ? 1 : 0, isDis ? 1 : 0, d.age, d.civilStatus, isDis ? 1 : 0, d.pmrfSubmissionId, d.pmrfRecordId, d.memberPin, d.submittedByAccountId, d.createdAt
        ];
      });

      // I. groups
      await writeAsync(`-- Dumping data for table \`groups\`\n`);
      await streamInserts('groups', [
        'id', 'name', 'leader', 'coLeaders', 'assignedBarangays', 'ratePerPerson', 'isArchived', 'barangayFolderId', 'createdAt', 'status'
      ], state.groups || [], (g) => [
        g.id, g.name, g.leader, g.coLeaders, g.assignedBarangays, g.ratePerPerson, g.isArchived || 0, g.barangayFolderId, g.createdAt, g.status
      ]);

      // J. paid_payrolls
      await writeAsync(`-- Dumping data for table \`paid_payrolls\`\n`);
      await streamInserts('paid_payrolls', [
        'id', 'groupName', 'dateRange', 'populationCount', 'ratePerPerson', 'totalAmountPaid', 'paidDate', 'settledBy', 'remarks'
      ], state.paidPayrolls || [], (py) => [
        py.id, py.groupName, py.dateRange, py.populationCount, py.ratePerPerson, py.totalAmountPaid, py.paidDate, py.settledBy, py.remarks
      ]);

      // K. health_records
      await writeAsync(`-- Dumping data for table \`health_records\`\n`);
      await streamInserts('health_records', [
        'id', 'patientName', 'householdId', 'householdHead', 'barangay', 'diagnosis', 'treatment', 'medications', 'notes', 'bloodPressure', 'heartRate', 'respRate', 'temperature', 'weightKg', 'heightCm', 'bmi', 'date'
      ], state.healthRecords || [], (hr) => [
        hr.id, hr.patientName, hr.householdId, hr.householdHead, hr.barangay, hr.diagnosis, hr.treatment, hr.medications, hr.notes, hr.bloodPressure, hr.heartRate, hr.respRate, hr.temperature, hr.weightKg, hr.heightCm, hr.bmi, hr.date
      ]);

      // L. activity_logs
      await writeAsync(`-- Dumping data for table \`activity_logs\`\n`);
      await streamInserts('activity_logs', [
        'id', 'user', 'action', 'module', 'date', 'time'
      ], state.activityLogs || [], (l) => [
        l.id, l.user, l.action, l.module, l.date, l.time
      ]);

      // M. notifications
      await writeAsync(`-- Dumping data for table \`notifications\`\n`);
      await streamInserts('notifications', [
        'id', 'title', 'message', 'type', 'is_read', 'createdAt'
      ], state.notifications || [], (n) => [
        n.id, n.title, n.message, n.type, n.read ? 1 : 0, n.createdAt
      ]);

      // N. timecards
      await writeAsync(`-- Dumping data for table \`timecards\`\n`);
      await streamInserts('timecards', [
        'id', 'userId', 'userEmail', 'userName', 'type', 'timestamp', 'photo', 'latitude', 'longitude', 'deviceInfo', 'settled', 'settlementId', 'isOvertime', 'otHours'
      ], state.timecards || [], (t) => [
        t.id, t.userId, t.userEmail, t.userName, t.type, t.timestamp, 
        (excludeBinaries && t.photo && t.photo.length > 500) ? '// [PHOTO_EXCLUDED_FOR_PERFORMANCE]' : t.photo, 
        t.latitude, t.longitude, t.deviceInfo, t.settled ? 1 : 0, t.settlementId,
        t.isOvertime ? 1 : 0, t.otHours !== undefined && t.otHours !== null ? t.otHours : null
      ]);

      // O. it_settled_payrolls
      await writeAsync(`-- Dumping data for table \`it_settled_payrolls\`\n`);
      await streamInserts('it_settled_payrolls', [
        'id', 'userId', 'userEmail', 'userName', 'dailyRate', 'dateRange', 'daysPresent', 'daysAbsent', 'totalLateMinutes', 'totalDeductions', 'totalEarned', 'paidDate', 'settledBy', 'remarks', 'breakdown'
      ], state.itSettledPayrolls || [], (it) => [
        it.id, it.userId, it.userEmail, it.userName, it.dailyRate, it.dateRange, it.daysPresent, it.daysAbsent, it.totalLateMinutes, it.totalDeductions, it.totalEarned, it.paidDate, it.settledBy, it.remarks, it.breakdown
      ]);

      // P. pcu_files
      await writeAsync(`-- Dumping data for table \`pcu_files\`\n`);
      await streamInserts('pcu_files', [
        'id', 'fullName', 'birthday', 'fileName', 'fileData', 'uploadDate', 'uploadedBy'
      ], state.pcuFiles || [], (f) => [
        f.id, f.fullName, f.birthday, f.fileName, 
        (excludeBinaries && f.fileData && f.fileData.length > 500) ? '// [FILE_DATA_EXCLUDED_FOR_PERFORMANCE]' : f.fileData, 
        f.uploadDate, f.uploadedBy
      ]);

      await writeAsync(`SET FOREIGN_KEY_CHECKS = 1;\n`);
      outStream.end();
    }
  } catch (err: any) {
    console.error('File Download Generation Error:', err);
    if (!res.headersSent) {
      res.status(500).send(`An error occurred preparing file download stream: ${err.message || err}`);
    }
  }
});


// Full Live Database Import/Restore Chunked Upload Endpoints
app.post('/api/import-data/upload-chunk', checkUser, (req: any, res: any) => {
  try {
    const uploadId = req.headers['x-upload-id'];
    const chunkIndexStr = req.headers['x-chunk-index'];
    const totalChunksStr = req.headers['x-total-chunks'];

    if (!uploadId || chunkIndexStr === undefined || !totalChunksStr) {
      return res.status(400).json({ error: 'Missing chunk upload headers.' });
    }

    const chunkIndex = parseInt(chunkIndexStr as string, 10);
    const totalChunks = parseInt(totalChunksStr as string, 10);

    // Sanitize upload ID
    const safeUploadId = (uploadId as string).replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkDir = path.join(process.cwd(), 'data', 'temp_chunks', safeUploadId);
    fs.mkdirSync(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    const writeStream = fs.createWriteStream(chunkPath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.json({ success: true, chunkIndex });
    });

    writeStream.on('error', (err: any) => {
      console.error('Error writing chunk:', err);
      try { fs.unlinkSync(chunkPath); } catch (e) {}
      res.status(500).json({ error: 'Failed to write chunk on server.' });
    });
  } catch (error: any) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ error: error.message || 'Chunk upload error.' });
  }
});

app.post('/api/import-data/assemble', checkUser, async (req: any, res: any) => {
  try {
    const { uploadId, totalChunks } = req.body;
    if (!uploadId || !totalChunks) {
      return res.status(400).json({ error: 'Missing assembly parameters.' });
    }

    const safeUploadId = (uploadId as string).replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkDir = path.join(process.cwd(), 'data', 'temp_chunks', safeUploadId);
    const tempPath = path.join(process.cwd(), 'data', 'temp_restore_assembled.json');

    // Ensure directory exists
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });

    const mainWriteStream = fs.createWriteStream(tempPath);

    const writeAllChunks = async () => {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Chunk ${i} is missing from the server storage. Please re-upload.`);
        }
        const chunkContent = fs.readFileSync(chunkPath);
        const canWrite = mainWriteStream.write(chunkContent);
        if (!canWrite) {
          await new Promise<void>((resolve) => mainWriteStream.once('drain', resolve));
        }
      }
      mainWriteStream.end();
    };

    writeAllChunks()
      .then(() => {
        // Wait for final file write finish
      })
      .catch((err) => {
        mainWriteStream.destroy(err);
      });

    mainWriteStream.on('finish', async () => {
      try {
        const result = await SaintFrancisDB.importFromJsonFile(tempPath);
        
        // Clean up chunk files and temp folder
        try {
          for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkDir, `chunk_${i}`);
            if (fs.existsSync(chunkPath)) {
              fs.unlinkSync(chunkPath);
            }
          }
          if (fs.existsSync(chunkDir)) {
            fs.rmdirSync(chunkDir);
          }
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (cleanupErr) {
          console.warn('Assembling cleanup warning:', cleanupErr);
        }

        res.json({
          success: true,
          message: 'Successfully aggregated, imported and restored database with zero missing data!',
          stats: result.stats
        });
      } catch (err: any) {
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
        console.error('Assembled backup restoration parsing failed:', err);
        res.status(400).json({ error: err.message || 'Restoration parsing failed.' });
      }
    });

    mainWriteStream.on('error', (err: any) => {
      console.error('Main write stream error:', err);
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
      res.status(500).json({ error: err.message || 'Stream stitching failed on server.' });
    });

  } catch (error: any) {
    console.error('Assemble restore error:', error);
    res.status(500).json({ error: error.message || 'Server error assembling backup.' });
  }
});

// Full Live Database Import/Restore Endpoint
app.post('/api/import-data', async (req, res) => {
  try {
    const { filePath, jsonData } = req.body;

    if (jsonData) {
      // 1. If raw JSON is uploaded, write it to a temp file and run import
      const tempPath = path.join(process.cwd(), 'data', 'temp_restore.json');
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      fs.writeFileSync(tempPath, JSON.stringify(jsonData, null, 2), 'utf8');
      
      const result = await SaintFrancisDB.importFromJsonFile(tempPath);
      
      try { fs.unlinkSync(tempPath); } catch (e) {}

      return res.json({
        success: true,
        message: 'Successfully imported raw uploaded JSON data into the database.',
        stats: result.stats
      });
    }

    if (filePath) {
      // 2. Import from a specific server file
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      // Safety check - make sure the target starts with our project directory
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Access denied: Targeted path is outside workspace directory.' });
      }

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: `Selected backup file does not exist on the server.` });
      }

      const result = await SaintFrancisDB.importFromJsonFile(absolutePath);
      return res.json({
        success: true,
        message: `Successfully imported backup from ${path.basename(filePath)}.`,
        stats: result.stats
      });
    }

    // 3. Simple list of discovered backup files in workspace (scanned from server root directory)
    const potentialBackups: string[] = [];
    try {
      const files = fs.readdirSync(process.cwd());
      for (const file of files) {
        if (file.endsWith('.json') && 
            !['package.json', 'package-lock.json', 'tsconfig.json', 'components.json', 'firebase-applet-config.json', 'metadata.json', 'index.html.dev'].includes(file)) {
          potentialBackups.push(file);
        }
      }
    } catch (err) {
      console.error('Failed to read workspace directory for backups:', err);
    }

    const discoveredList = potentialBackups.map(file => {
      const fullPath = path.join(process.cwd(), file);
      const exists = fs.existsSync(fullPath);
      let stats = null;
      if (exists) {
        const fileStats = fs.statSync(fullPath);
        stats = {
          sizeBytes: fileStats.size,
          mtime: fileStats.mtime.toISOString()
        };
      }
      return {
        fileName: file,
        exists,
        stats
      };
    });

    return res.json({
      success: true,
      backups: discoveredList
    });

  } catch (error: any) {
    console.error('Data Import Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during database data import.' });
  }
});


// Catch-all route for any undefined /api/* endpoints to prevent returning falling-back HTML response
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: true,
    message: `API Route [${req.method}] ${req.originalUrl} not found or unsupported.`
  });
});


// -------------------------------------------------------------
// VITE INTEGRATION / STATIC SPA ROUTING
// -------------------------------------------------------------
async function startServer() {
  let distPath = path.join(process.cwd(), 'dist');
  const possiblePaths = [
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, 'dist'),
    __dirname,
    path.join(process.cwd(), 'public_html', 'dist'),
    path.join(process.cwd())
  ];

  let viteActive = false;

  // Try to load Vite development middleware if NODE_ENV is not production
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("[Static Server] Initializing Vite development server middleware...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      viteActive = true;
      console.log("[Static Server] Vite middleware successfully mounted.");
    } catch (viteErr: any) {
      console.warn("[Static Server] Could not start Vite dev server middleware (falling back to static routing):", viteErr?.message || viteErr);
    }
  }

  let foundStaticDist = false;

  // Always search for static files in possible paths if Vite development middleware is NOT active.
  // This supports cPanel environments that do not set NODE_ENV=production but want to serve static build.
  if (!viteActive) {
    console.log("[Static Routing] Searching for static build artifacts containing index.html...");
    for (const p of possiblePaths) {
      const indexExist = fs.existsSync(path.join(p, 'index.html'));
      console.log(`  -> Path checked: "${p}" | Contains index.html: ${indexExist}`);
      // Prefer paths with build output over raw source folders containing package.json
      if (indexExist && !fs.existsSync(path.join(p, 'package.json'))) {
        distPath = p;
        foundStaticDist = true;
        break;
      }
    }

    if (!foundStaticDist) {
      // Secondary search allowing index.html even if adjacent to package.json
      for (const p of possiblePaths) {
        if (fs.existsSync(path.join(p, 'index.html'))) {
          distPath = p;
          foundStaticDist = true;
          break;
        }
      }
    }

    if (foundStaticDist) {
      console.log(`[Static Routing] Serving static assets from target directory: "${distPath}"`);
      app.use(express.static(distPath, {
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      }));
    }
  }

  // Catch-all route for frontend static routing
  app.get('*', (req: any, res: any, next: any) => {
    // If static files are selected, serve index.html
    if (foundStaticDist) {
      const targetIndexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(targetIndexHtml)) {
        return res.sendFile(targetIndexHtml);
      }
    }

    // If Vite middleware is active, let it handle SPA routing
    if (viteActive) {
      return next();
    }

    const targetIndexHtml = path.join(distPath, 'index.html');
    
    // Build diagnostic data
    let cwdFiles: string[] = [];
    try { cwdFiles = fs.readdirSync(process.cwd()); } catch(e: any) { cwdFiles = ['Error: ' + e.message]; }
    
    let dirnameFiles: string[] = [];
    try { dirnameFiles = fs.readdirSync(__dirname); } catch(e: any) { dirnameFiles = ['Error: ' + e.message]; }
    
    const diagnostics = possiblePaths.map(p => {
      const exists = fs.existsSync(p);
      let files: string[] = [];
      if (exists) {
        try { files = fs.readdirSync(p); } catch(e: any) { files = ['Error: ' + e.message]; }
      }
      return {
        path: p,
        exists,
        containsIndexHtml: exists ? fs.existsSync(path.join(p, 'index.html')) : false,
        containsPackageJson: exists ? fs.existsSync(path.join(p, 'package.json')) : false,
        files: files.slice(0, 15) // limit to first 15 files
      };
    });

    console.error(`[Static Route Error] Requested index.html which does NOT exist at: "${targetIndexHtml}"`);
    res.status(404).send(`
      <html>
        <head>
          <title>File Not Found - Diagnostics Page</title>
          <style>
            body { font-family: sans-serif; padding: 40px; background: #fafafa; color: #333; }
            .container { max-width: 800px; margin: 0 auto; background: white; border: 1px solid #ddd; border-radius: 8px; padding: 25px; text-align: left; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
            h2 { color: #d93838; margin-top: 0; display: flex; align-items: center; gap: 8px; }
            code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; word-break: break-all; }
            hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th, td { border: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #fafafa; }
            .success { color: green; font-weight: bold; }
            .danger { color: #d93838; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🩺 Saint Francis Clinic Portal - Static Asset Diagnostics</h2>
            <p style="font-weight: bold; margin-bottom: 5px;">[Production Configuration Error] static index.html could not be resolved by Express server.</p>
            <p style="margin-top: 0; color: #666; font-size: 14px;">This diagnostic panel helps troubleshoot your build routing path mismatch in production and containerized environments.</p>
            
            <hr />
            
            <div>
              <strong>Target Selected CWD:</strong> <code>${process.cwd()}</code><br/>
              <strong>Target Selected __dirname:</strong> <code>${__dirname}</code><br/>
              <strong>Target Selected distPath:</strong> <code>${distPath}</code><br/>
              <strong>Target index.html Expected At:</strong> <code>${targetIndexHtml}</code> (Exists: <span class="${fs.existsSync(targetIndexHtml) ? 'success' : 'danger'}">${fs.existsSync(targetIndexHtml)}</span>)<br/>
              <strong>foundStaticDist flag:</strong> <code>${foundStaticDist}</code>
            </div>
            
            <hr />
            
            <h3>🔍 Evaluated Search Paths & Files</h3>
            <table>
              <thead>
                <tr>
                  <th>Path Checked</th>
                  <th>Exists?</th>
                  <th>Has index.html?</th>
                  <th>Has package.json?</th>
                  <th>Direct Directory Contents (Preview)</th>
                </tr>
              </thead>
              <tbody>
                ${diagnostics.map(d => `
                  <tr>
                    <td><code>${d.path}</code></td>
                    <td class="${d.exists ? 'success' : 'danger'}">${d.exists}</td>
                    <td class="${d.containsIndexHtml ? 'success' : 'danger'}">${d.containsIndexHtml}</td>
                    <td class="${d.containsPackageJson ? 'success' : 'danger'}">${d.containsPackageJson}</td>
                    <td><code>${JSON.stringify(d.files)}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <hr />
            
            <div>
              <strong>CWD Global Root Files:</strong> <code>${JSON.stringify(cwdFiles)}</code><br/><br/>
              <strong>__dirname Directory Files:</strong> <code>${JSON.stringify(dirnameFiles)}</code>
            </div>
            
            <hr />
            
            <p style="font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 0;">
              <strong>Action Needed:</strong> If the building container was not properly built, ensure you run <code>npm run build</code>. 
              If the folder structure differs, you can add your custom folder path inside the <code>possiblePaths</code> list in <code>server.ts</code>.
            </p>
          </div>
        </body>
      </html>
    `);
  });

  if (isSocket) {
    app.listen(PORT, () => {
      console.log(`Server successfully listening on Unix Domain Socket: ${PORT}`);
    });
  } else {
    app.listen(PORT as number, '0.0.0.0', () => {
      console.log(`Server successfully listening on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();
