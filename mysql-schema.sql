-- =============================================================================
-- Saint Francis Clinic Database Schema for MySQL / phpMyAdmin (cPanel)
-- Generated: 2026-06-02
-- Compatibility: MySQL 5.7+ / MariaDB 10.3+
-- Description: Direct-import script to initialize all operational tables 
--              with complete structural relations, indexes, and initial seeds.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. DROP EXISTING TABLES (Replay Safe)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pcu_files`;
DROP TABLE IF EXISTS `it_settled_payrolls`;
DROP TABLE IF EXISTS `timecards`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `health_records`;
DROP TABLE IF EXISTS `paid_payrolls`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `dependents`;
DROP TABLE IF EXISTS `household_members`;
DROP TABLE IF EXISTS `households`;
DROP TABLE IF EXISTS `puroks`;
DROP TABLE IF EXISTS `barangays`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `site_settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 2. CREATE TABLE STRUCTURES
-- -----------------------------------------------------------------------------

-- A. SITE SETTINGS
CREATE TABLE `site_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `faviconLogo` LONGTEXT NOT NULL,
  `faviconTitle` VARCHAR(100) NOT NULL,
  `websiteTitle` VARCHAR(100) NOT NULL,
  `websiteLogo` LONGTEXT NOT NULL,
  `seoTitle` VARCHAR(150),
  `seoDescription` TEXT,
  `seoKeywords` TEXT,
  `squadDeleteAction` VARCHAR(50) DEFAULT 'ARCHIVE',
  `userPagePermissions` LONGTEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- B. USERS / ACCOUNTS
CREATE TABLE `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `fullName` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `position` VARCHAR(50) NOT NULL,
  `address` TEXT,
  `groupAssigned` VARCHAR(150) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Pending Approval',
  `createdAt` VARCHAR(50) NOT NULL,
  `updatedAt` VARCHAR(50) DEFAULT NULL,
  `profilePicture` LONGTEXT DEFAULT NULL,
  `contactNumber` VARCHAR(50) DEFAULT NULL,
  `dailyRate` DECIMAL(10, 2) DEFAULT NULL,
  INDEX `idx_user_email` (`email`),
  INDEX `idx_user_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- C. BARANGAYS
CREATE TABLE `barangays` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) UNIQUE NOT NULL,
  `puroksCount` INT DEFAULT 0,
  `yakapWillingCount` INT DEFAULT 0,
  `householdProgressBar` INT DEFAULT 0,
  `membersProgressBar` INT DEFAULT 0,
  `pmrfProgressBar` INT DEFAULT 0,
  INDEX `idx_barangay_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- D. PUROKS
CREATE TABLE `puroks` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `barangay` VARCHAR(100) NOT NULL,
  `barangay_id` VARCHAR(50) DEFAULT NULL,
  `householdCount` INT DEFAULT 0,
  `memberCount` INT DEFAULT 0,
  `pmrfCount` INT DEFAULT 0,
  `yakapWillingCount` INT DEFAULT 0,
  CONSTRAINT `fk_purok_barangay` FOREIGN KEY (`barangay`) REFERENCES `barangays` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E. HOUSEHOLDS REGISTRY
CREATE TABLE `households` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `householdNumber` VARCHAR(50) UNIQUE NOT NULL,
  `householdHead` VARCHAR(100) NOT NULL,
  `contactNumber` VARCHAR(50) DEFAULT NULL,
  `completeAddress` TEXT DEFAULT NULL,
  `barangay` VARCHAR(100) NOT NULL,
  `purok` VARCHAR(100) NOT NULL,
  `latitude` DECIMAL(10, 8) DEFAULT NULL,
  `longitude` DECIMAL(11, 8) DEFAULT NULL,
  `pmrfStatus` VARCHAR(50) DEFAULT 'Pending',
  `yakapWillingStatus` VARCHAR(50) DEFAULT 'Pending',
  `approvalStatus` VARCHAR(50) DEFAULT 'Pending',
  `attachments` LONGTEXT DEFAULT NULL, -- Stored as Serialized JSON Array
  `remarks` TEXT DEFAULT NULL,
  `pmrfDetails` LONGTEXT DEFAULT NULL, -- Fully Serialized PMRF JSON Data block
  `fpeDetails` LONGTEXT DEFAULT NULL,  -- First Patient Encounter JSON Data block
  `pcsfDetails` LONGTEXT DEFAULT NULL, -- Primary Care Selection Form JSON Data block
  `createdBy` VARCHAR(100) NOT NULL,
  `updatedBy` VARCHAR(100) DEFAULT NULL,
  `createdAt` VARCHAR(50) NOT NULL,
  `updatedAt` VARCHAR(50) DEFAULT NULL,
  `deletedBy` VARCHAR(100) DEFAULT NULL,
  `deletedAt` VARCHAR(50) DEFAULT NULL,
  `submittedByAccountId` VARCHAR(100) DEFAULT NULL,
  `submittedByUsername` VARCHAR(150) DEFAULT NULL,
  `dateSubmitted` VARCHAR(100) DEFAULT NULL,
  `submissionReferenceNumber` VARCHAR(100) DEFAULT NULL,
  `isFpePcsfOnly` TINYINT(1) DEFAULT 0,
  `isNewMemberFpe` TINYINT(1) DEFAULT 0,
  `approvedBy` VARCHAR(100) DEFAULT NULL,
  `approvalDate` VARCHAR(100) DEFAULT NULL,
  `disapprovedBy` VARCHAR(100) DEFAULT NULL,
  `disapprovalRemarks` TEXT DEFAULT NULL,
  `resubmissionHistory` LONGTEXT DEFAULT NULL,
  INDEX `idx_household_num` (`householdNumber`),
  INDEX `idx_household_head` (`householdHead`),
  INDEX `idx_household_approval` (`approvalStatus`),
  CONSTRAINT `fk_household_barangay` FOREIGN KEY (`barangay`) REFERENCES `barangays` (`name`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- F. HOUSEHOLD MEMBERS
CREATE TABLE `household_members` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `householdId` VARCHAR(50) NOT NULL,
  `firstName` VARCHAR(50) NOT NULL,
  `middleName` VARCHAR(50) DEFAULT NULL,
  `lastName` VARCHAR(50) NOT NULL,
  `gender` VARCHAR(50) NOT NULL DEFAULT 'Male',
  `birthdate` VARCHAR(50) NOT NULL,
  `age` INT NOT NULL,
  `civilStatus` VARCHAR(50) NOT NULL DEFAULT 'Single',
  `occupation` VARCHAR(100) DEFAULT NULL,
  `relationship` VARCHAR(50) NOT NULL DEFAULT 'Child',
  CONSTRAINT `fk_member_household` FOREIGN KEY (`householdId`) REFERENCES `households` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- G. DEPENDENTS (Underage/Seniors)
CREATE TABLE `dependents` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `householdId` VARCHAR(50) NOT NULL,
  `fullName` VARCHAR(150) DEFAULT NULL,
  `last_name` VARCHAR(100) DEFAULT NULL,
  `first_name` VARCHAR(100) DEFAULT NULL,
  `middle_name` VARCHAR(100) DEFAULT NULL,
  `name_ext` VARCHAR(50) DEFAULT NULL,
  `relationship` VARCHAR(50) NOT NULL,
  `date_of_birth` VARCHAR(100) DEFAULT NULL,
  `sex` VARCHAR(50) DEFAULT NULL,
  `citizenship` VARCHAR(100) DEFAULT NULL,
  `no_mn` TINYINT(1) DEFAULT 0,
  `mononym` TINYINT(1) DEFAULT 0,
  `pswd` TINYINT(1) DEFAULT 0,
  `gender` VARCHAR(50) DEFAULT 'Female',
  `age` INT DEFAULT NULL,
  `civilStatus` VARCHAR(100) DEFAULT NULL,
  `isDisabled` TINYINT(1) DEFAULT 0,
  `pmrfSubmissionId` VARCHAR(100) DEFAULT NULL,
  `pmrfRecordId` VARCHAR(100) DEFAULT NULL,
  `memberPin` VARCHAR(100) DEFAULT NULL,
  `submittedByAccountId` VARCHAR(100) DEFAULT NULL,
  `createdAt` VARCHAR(100) DEFAULT NULL,
  CONSTRAINT `fk_dependent_household` FOREIGN KEY (`householdId`) REFERENCES `households` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- G2. PMRF DEPENDENTS COPY
CREATE TABLE `pmrf_dependents` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `pmrf_id` VARCHAR(50) NOT NULL,
  `submission_id` VARCHAR(100) DEFAULT NULL,
  `fullName` VARCHAR(150) DEFAULT NULL,
  `last_name` VARCHAR(100) DEFAULT NULL,
  `first_name` VARCHAR(100) DEFAULT NULL,
  `middle_name` VARCHAR(100) DEFAULT NULL,
  `name_ext` VARCHAR(50) DEFAULT NULL,
  `relationship` VARCHAR(50) NOT NULL,
  `date_of_birth` VARCHAR(100) DEFAULT NULL,
  `sex` VARCHAR(50) DEFAULT NULL,
  `citizenship` VARCHAR(100) DEFAULT NULL,
  `no_mn` TINYINT(1) DEFAULT 0,
  `mononym` TINYINT(1) DEFAULT 0,
  `pswd` TINYINT(1) DEFAULT 0,
  `age` INT DEFAULT NULL,
  `civilStatus` VARCHAR(100) DEFAULT NULL,
  `isDisabled` TINYINT(1) DEFAULT 0,
  `pmrfSubmissionId` VARCHAR(100) DEFAULT NULL,
  `pmrfRecordId` VARCHAR(100) DEFAULT NULL,
  `memberPin` VARCHAR(100) DEFAULT NULL,
  `submittedByAccountId` VARCHAR(100) DEFAULT NULL,
  `createdAt` VARCHAR(100) DEFAULT NULL,
  CONSTRAINT `fk_pmrf_dependent_household` FOREIGN KEY (`pmrf_id`) REFERENCES `households` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- H. OPERATIONS GROUPS
CREATE TABLE `groups` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) UNIQUE NOT NULL,
  `leader` VARCHAR(100) NOT NULL,
  `coLeaders` TEXT NOT NULL, -- JSON Serialized Array of emails/names
  `assignedBarangays` TEXT NOT NULL, -- JSON Serialized Array of barangay names
  `ratePerPerson` DECIMAL(10, 2) DEFAULT 0.00,
  `isArchived` TINYINT(1) DEFAULT 0,
  `barangayFolderId` VARCHAR(50) DEFAULT NULL,
  `createdAt` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- I. PAID PAYROLLS
CREATE TABLE `paid_payrolls` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `groupName` VARCHAR(100) NOT NULL,
  `dateRange` VARCHAR(100) NOT NULL,
  `populationCount` INT DEFAULT 0,
  `ratePerPerson` DECIMAL(10, 2) DEFAULT 0.00,
  `totalAmountPaid` DECIMAL(12, 2) DEFAULT 0.00,
  `paidDate` VARCHAR(50) NOT NULL,
  `settledBy` VARCHAR(100) NOT NULL,
  `remarks` TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- J. HEALTH / DIAGNOSTIC RECORDS
CREATE TABLE `health_records` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `patientName` VARCHAR(100) NOT NULL,
  `householdId` VARCHAR(50) NOT NULL,
  `householdHead` VARCHAR(100) NOT NULL,
  `barangay` VARCHAR(100) NOT NULL,
  `diagnosis` TEXT NOT NULL,
  `treatment` TEXT DEFAULT NULL,
  `medications` TEXT DEFAULT NULL,
  `notes` LONGTEXT DEFAULT NULL, -- Serialized clinical consultation, PMRF back update structure, signature, and system markings
  `bloodPressure` VARCHAR(50) DEFAULT NULL,
  `heartRate` VARCHAR(50) DEFAULT NULL,
  `respRate` VARCHAR(50) DEFAULT NULL,
  `temperature` VARCHAR(50) DEFAULT NULL,
  `weightKg` VARCHAR(50) DEFAULT NULL,
  `heightCm` VARCHAR(50) DEFAULT NULL,
  `bmi` VARCHAR(50) DEFAULT NULL,
  `date` VARCHAR(50) NOT NULL,
  CONSTRAINT `fk_health_household` FOREIGN KEY (`householdId`) REFERENCES `households` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- K. SYSTEM AUDIT LOGS
CREATE TABLE `activity_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user` VARCHAR(100) NOT NULL,
  `action` TEXT NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `date` VARCHAR(50) NOT NULL,
  `time` VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- L. REAL-TIME NOTIFICATIONS
CREATE TABLE `notifications` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'INFO',
  `is_read` TINYINT(1) DEFAULT 0,
  `createdAt` VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- M. STAFF TIMECARDS / ATTENDANCE
CREATE TABLE `timecards` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(50) NOT NULL,
  `userEmail` VARCHAR(100) NOT NULL,
  `userName` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `timestamp` VARCHAR(50) NOT NULL,
  `photo` LONGTEXT NOT NULL,
  `latitude` DECIMAL(10, 8) DEFAULT NULL,
  `longitude` DECIMAL(11, 8) DEFAULT NULL,
  `deviceInfo` TEXT DEFAULT NULL,
  `settled` TINYINT(1) DEFAULT 0,
  `settlementId` VARCHAR(50) DEFAULT NULL,
  `isOvertime` TINYINT(1) DEFAULT 0,
  `otHours` DECIMAL(5, 2) DEFAULT NULL,
  INDEX `idx_timecard_userId` (`userId`),
  INDEX `idx_timecard_type` (`type`),
  CONSTRAINT `fk_timecard_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- N. IT SETTLED PAYROLLS
CREATE TABLE `it_settled_payrolls` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(50) NOT NULL,
  `userEmail` VARCHAR(100) NOT NULL,
  `userName` VARCHAR(100) NOT NULL,
  `dailyRate` DECIMAL(10, 2) DEFAULT 0.00,
  `dateRange` VARCHAR(100) NOT NULL,
  `daysPresent` INT DEFAULT 0,
  `daysAbsent` INT DEFAULT 0,
  `totalLateMinutes` INT DEFAULT 0,
  `totalDeductions` DECIMAL(12, 2) DEFAULT 0.00,
  `totalEarned` DECIMAL(12, 2) DEFAULT 0.00,
  `paidDate` VARCHAR(50) NOT NULL,
  `settledBy` VARCHAR(100) NOT NULL,
  `remarks` TEXT DEFAULT NULL,
  `breakdown` LONGTEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- O. PCU REGISTERED FILES
CREATE TABLE `pcu_files` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `fullName` VARCHAR(150) NOT NULL,
  `birthday` VARCHAR(50) NOT NULL,
  `fileName` VARCHAR(255) NOT NULL,
  `fileData` LONGTEXT NOT NULL,
  `uploadDate` VARCHAR(50) NOT NULL,
  `uploadedBy` VARCHAR(100) NOT NULL,
  INDEX `idx_pcu_fullname` (`fullName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 3. INITIAL SEED INJECTIONS (Matches SaintFrancisDB getSeedData)
-- -------------------------------------------------------------

-- Inject settings
INSERT INTO `site_settings` (`id`, `faviconLogo`, `faviconTitle`, `websiteTitle`, `websiteLogo`, `seoTitle`, `seoDescription`, `seoKeywords`, `squadDeleteAction`, `userPagePermissions`) VALUES 
(1, 'https://cdn-icons-png.flaticon.com/512/809/809957.png', 'Saint Francis Clinic', 'SAINT FRANCIS CLINIC', 'https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png', 'Saint Francis Clinic Management System', 'Enterprise-grade clinic information and field operation mapping system', 'health, clinic, management, Pagadian, barangay, geotagging, HR, payroll', 'ARCHIVE', NULL);

-- Inject default users
-- Note: clear-text login comparison is supported for testing, passwords matched exactly.
INSERT INTO `users` (`id`, `fullName`, `email`, `password`, `position`, `address`, `groupAssigned`, `status`, `createdAt`) VALUES
('usr_admin', 'System Admin', 'elthrone1233@gmail.com', 'rakionista021994', 'ADMIN', 'SAN PEDRO', NULL, 'Approved', '2026-06-02T16:00:00Z'),
('usr_admin_legacy', 'Dr. Jane Smith', 'admin@stfrancis.com', 'admin', 'ADMIN', 'SAN PEDRO', NULL, 'Approved', '2026-06-02T16:00:00Z'),
('usr_it', 'John IT Developer', 'it@stfrancis.com', 'it', 'IT', 'Santa Lucia', NULL, 'Approved', '2026-06-02T16:00:00Z'),
('usr_hr', 'Sarah HR Professional', 'hr@stfrancis.com', 'hr', 'HR', 'Tuburan', NULL, 'Approved', '2026-06-02T16:00:00Z'),
('usr_leader', 'Marc Rubio', 'leader@stfrancis.com', 'leader', 'LEADER', 'Lumbia', 'grp_team_alpha', 'Approved', '2026-06-02T16:00:00Z'),
('usr_coleader', 'Elisa Lopez', 'coleader@stfrancis.com', 'coleader', 'CO-LEADER', 'Balangasan', 'grp_team_alpha', 'Approved', '2026-06-02T16:00:00Z'),
('usr_pending', 'Peter Parker', 'pete@stfrancis.com', 'pete', 'LEADER', 'Tuburan', NULL, 'Pending Approval', '2026-06-02T16:00:00Z');

-- Inject Barangays
INSERT INTO `barangays` (`id`, `name`, `puroksCount`, `yakapWillingCount`, `householdProgressBar`, `membersProgressBar`, `pmrfProgressBar`) VALUES
('brg_1', 'SAN PEDRO', 3, 15, 75, 80, 70),
('brg_2', 'Santa Lucia', 4, 12, 60, 50, 55),
('brg_3', 'Tuburan', 3, 9, 45, 40, 35),
('brg_4', 'Lumbia', 5, 20, 90, 85, 88),
('brg_5', 'Balangasan', 3, 14, 80, 75, 70);

-- Inject Puroks
INSERT INTO `puroks` (`id`, `name`, `barangay`, `barangay_id`, `householdCount`, `memberCount`, `pmrfCount`, `yakapWillingCount`) VALUES
('prk_1', 'Purok Mangga', 'SAN PEDRO', 'brg_1', 20, 65, 15, 10),
('prk_2', 'Purok Durian', 'SAN PEDRO', 'brg_1', 15, 45, 10, 5),
('prk_3', 'Purok Santol', 'SAN PEDRO', 'brg_1', 12, 34, 8, 0),
('prk_4', 'Purok Sampaguita', 'Santa Lucia', 'brg_2', 25, 80, 20, 12),
('prk_5', 'Purok Rosal', 'Santa Lucia', 'brg_2', 18, 55, 12, 0),
('prk_6', 'Purok Bougainvillea', 'Tuburan', 'brg_3', 30, 110, 25, 9),
('prk_7', 'Purok Mahogany', 'Lumbia', 'brg_4', 22, 74, 18, 14),
('prk_8', 'Purok Narra', 'Lumbia', 'brg_4', 18, 52, 15, 6);

-- Inject Households default seed
INSERT INTO `households` (`id`, `householdNumber`, `householdHead`, `contactNumber`, `completeAddress`, `barangay`, `purok`, `latitude`, `longitude`, `pmrfStatus`, `yakapWillingStatus`, `approvalStatus`, `attachments`, `remarks`, `createdBy`, `createdAt`) VALUES
('hsh_1', 'HH-2026-0001', 'Delos Reyes, Juan', '09171234567', 'Purok Mangga, Barangay SAN PEDRO', 'SAN PEDRO', 'Purok Mangga', 7.82840000, 123.43320000, 'Willing', 'Willing', 'Approved', '[]', NULL, 'Marc Rubio', '2026-06-02T16:10:00Z'),
('hsh_2', 'HH-2026-0002', 'Cruz, Maria', '09087654321', 'Purok Sampaguita, Barangay Santa Lucia', 'Santa Lucia', 'Purok Sampaguita', 7.82110000, 123.42850000, 'Willing', 'Willing', 'Approved', '[]', NULL, 'Marc Rubio', '2026-06-02T16:12:00Z'),
('hsh_3', 'HH-2026-0003', 'Santos, Rodrigo', '09228889999', 'Purok Mahogany, Barangay Lumbia', 'Lumbia', 'Purok Mahogany', 7.81540000, 123.43910000, 'Pending', 'Willing', 'Pending', '[\"https://images.unsplash.com/photo-1543269865-cbf427effbad?w=500\"]', 'Submitted health documentation attachment', 'Elisa Lopez', '2026-06-02T16:14:00Z'),
('hsh_4', 'HH-2026-0004', 'Alvarez, Fernando', '09351111222', 'Purok Narra, Barangay Lumbia', 'Lumbia', 'Purok Narra', 7.83410000, 123.41940000, 'Willing', 'Willing', 'Approved', '[]', NULL, 'Marc Rubio', '2026-06-02T16:16:00Z');

-- Inject Members
INSERT INTO `household_members` (`id`, `householdId`, `firstName`, `middleName`, `lastName`, `gender`, `birthdate`, `age`, `civilStatus`, `occupation`, `relationship`) VALUES
('mem_1', 'hsh_1', 'Juan', 'Gomez', 'Delos Reyes', 'Male', '1980-05-15', 46, 'Married', 'Barangay Health Worker', 'Head'),
('mem_2', 'hsh_1', 'Juana', 'Santos', 'Delos Reyes', 'Female', '1982-08-20', 43, 'Married', 'Teacher', 'Spouse'),
('mem_3', 'hsh_1', 'Juanito', 'Santos', 'Delos Reyes', 'Male', '2010-02-10', 16, 'Single', 'Student', 'Child'),
('mem_4', 'hsh_2', 'Maria', 'Villar', 'Cruz', 'Female', '1975-01-01', 51, 'Widowed', 'Sari-Sari Store Owner', 'Head'),
('mem_5', 'hsh_4', 'Fernando', 'Mercado', 'Alvarez', 'Male', '1985-11-30', 40, 'Married', 'Jeepney Driver', 'Head');

-- Inject Dependents
INSERT INTO `dependents` (`id`, `householdId`, `fullName`, `gender`, `age`, `relationship`) VALUES
('dep_1', 'hsh_1', 'Lola Remedios Delos Reyes', 'Female', 72, 'Parent'),
('dep_2', 'hsh_2', 'Baby Jasmine Cruz', 'Female', 3, 'Child');

-- Inject Groups
INSERT INTO `groups` (`id`, `name`, `leader`, `coLeaders`, `assignedBarangays`, `ratePerPerson`) VALUES
('grp_team_alpha', 'Team Alpha Pagadian', 'Marc Rubio', '[\"Elisa Lopez\"]', '[\"SAN PEDRO\", \"Lumbia\"]', 150.00),
('grp_team_beta', 'Team Beta Operations', 'Sarah HR Professional', '[]', '[\"Santa Lucia\", \"Tuburan\"]', 180.00);

-- Inject Health diagnostics records
INSERT INTO `health_records` (`id`, `patientName`, `householdId`, `householdHead`, `barangay`, `diagnosis`, `treatment`, `medications`, `notes`, `date`) VALUES
('med_1', 'Delos Reyes, Juan', 'hsh_1', 'Delos Reyes, Juan', 'SAN PEDRO', 'Hypertension Stage I', 'Low-sodium diet, regular monitoring', 'Amlodipine 5mg once daily', 'Advised to return in 1 month for blood pressure checkup.', '2026-05-10'),
('med_2', 'Lola Remedios Delos Reyes', 'hsh_1', 'Delos Reyes, Juan', 'SAN PEDRO', 'Osteoarthritis Keloids', 'Physical therapy exercises, cold compress', 'Paracetamol 500mg as needed for pain', 'Wants a home visit next week.', '2026-05-18');

-- Inject Activities Logs
INSERT INTO `activity_logs` (`id`, `user`, `action`, `module`, `date`, `time`) VALUES
('log_1', 'Dr. Jane Smith', 'Approved newly registered account: Marc Rubio', 'Account Management', '2026-06-01', '10:15 AM'),
('log_2', 'Marc Rubio', 'Created new Household head: Delos Reyes, Juan', 'Households', '2026-06-01', '11:22 AM'),
('log_3', 'Dr. Jane Smith', 'Approved Household HH-2026-0001', 'Household Approval', '2026-06-01', '11:45 AM'),
('log_4', 'Dr. Jane Smith', 'Created Health Record for Delos Reyes, Juan', 'Health Records', '2026-06-01', '02:30 PM');

-- Inject Default notifications
INSERT INTO `notifications` (`id`, `title`, `message`, `type`, `is_read`, `createdAt`) VALUES
('not_1', 'Household Registry Update', 'Elisa Lopez added Santos, Rodrigo under review.', 'INFO', 0, '2026-06-02T16:20:00Z'),
('not_2', 'Account Management Update', 'Peter Parker registered as LEADER and is pending approval.', 'WARNING', 0, '2026-06-02T16:20:00Z');

-- =============================================================================
-- INSTRUCTIONS FOR PHP-MYADMIN IMPORT
-- -----------------------------------------------------------------------------
-- 1. Create a database in your cPanel (e.g. `sfc_database`).
-- 2. Open phpMyAdmin, select your newly created database.
-- 3. Click the 'Import' tab on the top menu.
-- 4. Click 'Choose File' and select this file: `mysql-schema.sql`.
-- 5. Click the 'Go' button at the bottom of the page.
-- 6. Done! All tables are constructed and seed data is fully injected.
-- =============================================================================
