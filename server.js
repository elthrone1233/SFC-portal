/**
 * cPanel Node.js Application Startup File
 * 
 * This file serves as the main entry point for Phusion Passenger in cPanel.
 * It imports and runs the compiled bundle located inside the 'dist' directory.
 */

const http = require('http');

try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional in production if server-level env variables are configured
}

let loaded = false;
let rootError = null;
let distError = null;

function bootstrap() {
  try {
    console.log("Saint Francis Clinic Launcher: Attempting to initialize backend bundle from root (./server.cjs)...");
    require('./server.cjs');
    loaded = true;
    console.log("✅ Successfully loaded server.cjs from root!");
  } catch (err) {
    rootError = err;
    console.log("ℹ️ Could not find or load server.cjs from root, trying dist (./dist/server.cjs)... Reason:", err.message);
    try {
      require('./dist/server.cjs');
      loaded = true;
      console.log("✅ Successfully loaded server.cjs from dist!");
    } catch (err2) {
      distError = err2;
      console.error("\n========================================================");
      console.error("CRITICAL ERROR: Unable to load production server bundle from either root or dist folder!");
      console.error("========================================================");
      console.error("Error (Root Path ./server.cjs):", err.message);
      console.error("Error (Dist Path ./dist/server.cjs):", err2.message);
      console.error("\nPossibilities:");
      console.error("1. The application has not been compiled yet.");
      console.error("   -> Action: Run 'npm run build' from your terminal or cPanel JS Runner.");
      console.error("2. Node modules are not fully installed.");
      console.error("   -> Action: Run 'npm install' or click 'Run NPM Install' in cPanel.");
      console.error("========================================================\n");
    }
  }

  if (!loaded) {
    // Return a friendly fallback page if accessed before build
    const server = http.createServer((req, res) => {
      const fs = require('fs');
      const path = require('path');
      const rootExists = fs.existsSync(path.join(__dirname, 'server.cjs'));
      const distExists = fs.existsSync(path.join(__dirname, 'dist', 'server.cjs'));
      
      if (rootExists || distExists) {
        // Build is detected now!
        // Touch tmp/restart.txt to tell Phusion Passenger to reload, then terminate the stale process cleanly.
        try {
          const tmpDir = path.join(__dirname, 'tmp');
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }
          fs.writeFileSync(path.join(tmpDir, 'restart.txt'), String(Date.now()));
        } catch (e) {
          console.error("Could not write restart.txt:", e.message);
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Restarting Server...</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #334155; padding: 40px; text-align: center; }
              .card { max-width: 500px; margin: 80px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
              .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #059669; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>🔄 Production Build Detected!</h2>
              <p>The Saint Francis Clinic Portal has been successfully compiled.</p>
              <p>We are automatically restarting the server to launch the live dashboard. This will resolve the 503 pending state.</p>
              <div class="spinner"></div>
              <p style="font-size: 14px; color: #64748b;">Please wait, reloading automatically in <span id="countdown">4</span> seconds...</p>
            </div>
            <script>
              var seconds = 4;
              var countdownEl = document.getElementById('countdown');
              var timer = setInterval(function() {
                seconds--;
                countdownEl.textContent = seconds;
                if (seconds <= 0) {
                  clearInterval(timer);
                  window.location.reload(true);
                }
              }, 1000);
            </script>
          </body>
          </html>
        `);
        
        // Terimate worker process after a brief delay so passenger spawns a fresh worker that requires() server.cjs
        setTimeout(() => {
          process.exit(0);
        }, 1000);
        return;
      }

      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      
      const rootErrorMsg = rootError ? rootError.message : "None";
      const rootErrorStack = rootError ? rootError.stack : "";
      const distErrorMsg = distError ? distError.message : "None";
      const distErrorStack = distError ? distError.stack : "";
      
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Application Compilation Pending</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #334155; padding: 40px; text-align: center; }
            .card { max-width: 680px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; text-align: left; }
            h2 { color: #0f172a; margin-top: 0; text-align: center; }
            p { line-height: 1.5; }
            code { background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; word-break: break-all; }
            .btn-group { margin-top: 25px; text-align: center; }
            .btn { display: inline-block; padding: 10px 20px; background: #059669; color: white; border-radius: 6px; text-decoration: none; font-weight: bold; }
            .debug-box { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; }
            pre { background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 11px; text-align: left; max-height: 250px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🩺 Saint Francis Clinic Portal</h2>
            <p>The application files have been uploaded, but the <strong>Production Build is pending</strong> or there is a startup configuration error.</p>
            <p>Please enter your cPanel Node.js interface and complete these steps:</p>
            <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1;">
              <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                <li>Click <strong>"Run NPM Install"</strong> in cPanel to load dependencies.</li>
                <li>Go to the **"Run JS Script"** dropdown, select <strong>"build"</strong>, and click run.</li>
                <li>Click <strong>"Restart"</strong> at the top of the Setup Node.js App page.</li>
              </ol>
            </div>
            
            <div class="debug-box">
              <strong style="font-size: 15px;">🔍 Live cPanel Startup Diagnostic Details:</strong>
              <p style="margin: 8px 0 4px 0;">This diagnostic info helps identify exactly what is preventing the app from launching in your hosting setup.</p>
              
              <details open style="margin-top: 10px; cursor: pointer;">
                <summary><strong>Error loading ./server.cjs (Root)</strong></summary>
                <p><strong>Message:</strong> <code>${rootErrorMsg}</code></p>
                ${rootErrorStack ? `<pre>${rootErrorStack}</pre>` : ''}
              </details>
              
              <details style="margin-top: 10px; cursor: pointer;">
                <summary><strong>Error loading ./dist/server.cjs (Dist)</strong></summary>
                <p><strong>Message:</strong> <code>${distErrorMsg}</code></p>
                ${distErrorStack ? `<pre>${distErrorStack}</pre>` : ''}
              </details>
            </div>
          </div>
        </body>
        </html>
      `);
    });
    
    const port = process.env.PORT || 3000;
    server.listen(port);
  }
}

bootstrap();
