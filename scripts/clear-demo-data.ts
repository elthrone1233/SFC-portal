import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'saint-francis-db.json');
const BACKUP_FILE = path.join(process.cwd(), 'saint-francis-db.json.backup');

function clearDemoData() {
  console.log('🔄 Starting Demo Data Clearance...');

  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Database file not found at: ${DB_FILE}`);
    return;
  }

  // 1. Create a backup first
  try {
    fs.copyFileSync(DB_FILE, BACKUP_FILE);
    console.log(`💾 Backup successfully created at: ${BACKUP_FILE}`);
  } catch (err: any) {
    console.warn(`⚠️ Warning: Could not create backup file:`, err.message);
  }

  // 2. Load DB contents
  let db: any;
  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(rawData);
  } catch (err: any) {
    console.error(`❌ Failed to read or parse database file:`, err.message);
    return;
  }

  // Track original lengths for logging
  const counts = {
    households: db.households?.length || 0,
    householdMembers: db.householdMembers?.length || 0,
    dependents: db.dependents?.length || 0,
    paidPayrolls: db.paidPayrolls?.length || 0,
    healthRecords: db.healthRecords?.length || 0,
    activityLogs: db.activityLogs?.length || 0,
    notifications: db.notifications?.length || 0,
    timecards: db.timecards?.length || 0,
    itSettledPayrolls: db.itSettledPayrolls?.length || 0,
    pcuFiles: db.pcuFiles?.length || 0,
    drafts: db.drafts?.length || 0,
  };

  // 3. Reset demo/test data tables to empty array
  db.households = [];
  db.householdMembers = [];
  db.dependents = [];
  db.paidPayrolls = [];
  db.healthRecords = [];
  db.activityLogs = [];
  db.notifications = [];
  db.timecards = [];
  db.itSettledPayrolls = [];
  db.pcuFiles = [];
  db.drafts = [];

  // 4. Reset Barangay statistics back to zero
  if (Array.isArray(db.barangays)) {
    db.barangays = db.barangays.map((b: any) => ({
      ...b,
      yakapWillingCount: 0,
      householdProgressBar: 0,
      membersProgressBar: 0,
      pmrfProgressBar: 0
    }));
    console.log(`📌 Reset statistics for ${db.barangays.length} Barangays.`);
  }

  // 5. Reset Purok statistics back to zero
  if (Array.isArray(db.puroks)) {
    db.puroks = db.puroks.map((p: any) => ({
      ...p,
      householdCount: 0,
      memberCount: 0,
      pmrfCount: 0,
      yakapWillingCount: 0
    }));
    console.log(`📌 Reset statistics for ${db.puroks.length} Puroks.`);
  }

  // 6. Save the cleaned database back to the file
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    console.log(`✅ Cleaned database successfully written back to: ${DB_FILE}`);
    console.log('📊 Clearance Summary:');
    console.log(` - Households: Cleared ${counts.households} items`);
    console.log(` - Household Members: Cleared ${counts.householdMembers} items`);
    console.log(` - Dependents: Cleared ${counts.dependents} items`);
    console.log(` - PCU Submission Files: Cleared ${counts.pcuFiles} items`);
    console.log(` - Timecard Registers: Cleared ${counts.timecards} items`);
    console.log(` - Activity Logs: Cleared ${counts.activityLogs} items`);
    console.log(` - System Notifications: Cleared ${counts.notifications} items`);
    console.log(` - Draft Entries: Cleared ${counts.drafts} items`);
    console.log(` - Payroll & Medical Logs: Cleared fully`);
  } catch (err: any) {
    console.error(`❌ Failed to save cleaned database:`, err.message);
  }
}

clearDemoData();
