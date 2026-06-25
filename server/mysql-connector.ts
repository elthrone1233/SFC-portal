import mysql from 'mysql2/promise';

/**
 * Saint Francis Clinic - MySQL Database Connector for cPanel Hosting
 */

let pool: mysql.Pool | null = null;
let isConnected = false;
let lastAttemptTime = 0;
let isOfflineCached = false;
const RETRY_COOLDOWN_MS = 60000; // 60 seconds cooldown before trying to connect again if it failed

export const getMySQLConfig = () => {
  // -----------------------------------------------------------------------------
  // 💾 HARDCODED CPANEL DATABASE CREDENTIALS (FALLBACK ENGINE)
  // If your cPanel Passenger environment variables fail to load correctly from the
  // .env file, fill in your actual MySQL database credentials here.
  // -----------------------------------------------------------------------------
  const CPANEL_FALLBACK_HOST = 'localhost';             // In cPanel, MySQL database is almost always 'localhost'
  const CPANEL_FALLBACK_USER = '';                      // Enter your database user here (e.g., 'youruser_sfcuser')
  const CPANEL_FALLBACK_PASSWORD = '';                  // Enter your database password here
  const CPANEL_FALLBACK_DB = '';                        // Enter your database name here (e.g., 'youruser_sfclinic')
  const CPANEL_FALLBACK_PORT = '3306';                  // MySQL port number (standard 3306)

  return {
    host: process.env.DB_HOST || CPANEL_FALLBACK_HOST,
    user: process.env.DB_USER || CPANEL_FALLBACK_USER,
    password: process.env.DB_PASSWORD || CPANEL_FALLBACK_PASSWORD,
    database: process.env.DB_NAME || CPANEL_FALLBACK_DB,
    port: parseInt(process.env.DB_PORT || CPANEL_FALLBACK_PORT, 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000 // 5 seconds connect timeout to fail-fast if MySQL is unreachable or lagging
  };
};

export function shouldAttemptMySQL(): boolean {
  const config = getMySQLConfig();
  if (!config.database || !config.host) {
    return false;
  }

  // In our development sandbox container running on AI Studio, 
  // any connection to raw local 'localhost' or '127.0.0.1' is guaranteed to fail
  // with ECONNREFUSED since no MySQL runs on the development runner itself.
  //
  // We disable localhost connections inside the AI Studio development container
  // to avoid spammy logs and connection failures, but keep them fully enabled
  // in the user's live production environments (like cPanel or GCP Cloud SQL) where
  // a local MySQL database or proxy is expected and correctly configured.
  const isAISandbox = 
    process.env.K_SERVICE?.includes('ais-dev') || 
    process.env.K_SERVICE?.includes('ais-pre') || 
    process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL?.includes('ais-sandbox') ||
    process.env.APP_URL?.includes('ais-dev') ||
    process.env.APP_URL?.includes('ais-pre');

  if (isAISandbox && (config.host === 'localhost' || config.host === '127.0.0.1')) {
    return false;
  }

  if (isOfflineCached) {
    const now = Date.now();
    if (now - lastAttemptTime < RETRY_COOLDOWN_MS) {
      return false; // Skip to avoid blocking requests when MySQL is offline
    }
  }
  return true;
}

export function markMySQLSuccess() {
  isOfflineCached = false;
  isConnected = true;
}

export function markMySQLFailure() {
  if (!isOfflineCached) {
    isOfflineCached = true;
    lastAttemptTime = Date.now();
  }
  isConnected = false;
}

/**
 * Initializes and retrieves the MySQL connection pool
 */
export function getMySQLPool(): mysql.Pool | null {
  if (!shouldAttemptMySQL()) {
    return null;
  }

  const config = getMySQLConfig();
  
  if (!pool) {
    try {
      pool = mysql.createPool(config);
      console.log('⚡ MySQL Pool client constructed for:', config.host);
    } catch (err) {
      console.warn('⚠️ Note: Could not construct MySQL Pool client (run cPanel Setup Node.js App to connect):', err);
      markMySQLFailure();
      pool = null;
    }
  }

  return pool;
}

/**
 * Tests connection to MySQL and logs state details
 */
export async function testMySQLConnection(): Promise<{ connected: boolean; message: string }> {
  // Let's force check for testing manually on settings page
  const config = getMySQLConfig();
  if (!config.database || !config.host) {
    return { 
      connected: false, 
      message: 'MySQL environment credentials not configured in .env. Falling back to local/JSON persistence system.' 
    };
  }

  // Clear offline cache for manual test request
  isOfflineCached = false;

  let myPool: mysql.Pool | null = null;
  try {
    if (!pool) {
      pool = mysql.createPool(config);
    }
    myPool = pool;
  } catch (err: any) {
    markMySQLFailure();
    return {
      connected: false,
      message: `Database connection configuration failed: ${err.message}`
    };
  }

  try {
    const connection = await myPool.getConnection();
    try {
      // Execute simple query to test connection integrity
      await connection.query('SELECT 1 + 1 AS result');
      markMySQLSuccess();
      console.log('✅ PHPMyAdmin/cPanel MySQL Database tests succeeded fully!');
      return { 
        connected: true, 
        message: `Successfully connected to database '${process.env.DB_NAME}' on host '${process.env.DB_HOST}'.` 
      };
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.log('ℹ️ MySQL database connection is currently unavailable:', err.message);
    markMySQLFailure();
    return { 
      connected: false, 
      message: `Database connection failed: ${err.message}` 
    };
  }
}

/**
 * Custom wrappers showing how standard CRUD updates are made with type-safety
 */
export async function queryMySQL<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const myPool = getMySQLPool();
  if (!myPool) {
    throw new Error('MySQL Database not configured or connected.');
  }

  try {
    const [rows] = await myPool.execute(sql, params);
    markMySQLSuccess();
    return rows as T[];
  } catch (err) {
    markMySQLFailure();
    throw err;
  }
}
