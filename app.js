/**
 * Saint Francis Clinic - cPanel Passenger Application Startup File
 * 
 * This file is executed by cPanel's Node.js Passenger service on boot.
 * It directly boots the compiled production server.
 */

try {
  require('./server.cjs');
} catch (err) {
  console.error('[cPanel Startup Error] Failed to require server.cjs wrapper:', err);
}
