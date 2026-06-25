# cPanel deployment & MySQL Integration Guide - Saint Francis Clinic 🩺

This guide provides step-by-step instructions for uploading the Saint Francis Clinic management application to cPanel and establishing a connection to a MySQL database using phpMyAdmin.

---

## 📅 Part 1: Setting up MySQL in cPanel

1. **Log in to cPanel**: Access your hosting file manager and database controls.
2. **Create a MySQL Database**:
   - Locate the **MySQL® Database Wizard** or **MySQL® Databases** in cPanel.
   - Enter a database name (e.g., `yourusername_sfclinic`) and click **Next Step**.
3. **Create a Database User**:
   - Provide a username (e.g., `yourusername_sfcuser`) and a secure password. Keep this password safe!
   - Click **Create User**.
4. **Link User to Database**:
   - Assign the user to the database with **All Privileges** enabled.
   - Click **Make Changes**.

---

## 🗄️ Part 2: Importing the SQL Schema via phpMyAdmin

1. Locate **phpMyAdmin** in your cPanel dashboard.
2. Select your newly created database (`yourusername_sfclinic`) from the left sidebar.
3. Click the **Import** tab on the top menu bar.
4. Click **Choose File** / **Browse** and upload the `mysql-schema.sql` (or `schema.sql`) from the root folder of this project.
5. Ensure the format is set to **SQL** and click **Import** or **Go** at the bottom.
6. The database tables, structural constraints (foreign keys), and initial seed data will be instantly created!

---

## ⚡ Part 3: Switching Node.js Backend to MySQL

To link this Node.js Express server to your MySQL database, set your configuration environment variables:

1. Create or edit your `.env` file in the application's root directory:
   ```env
   # MySQL Configuration Details
   DB_HOST=localhost
   DB_USER=yourusername_sfcuser
   DB_PASSWORD=your_secure_password
   DB_NAME=yourusername_sfclinic
   DB_PORT=3306
   ```

2. The application uses these variables to initialize a pool connection.
3. Alternatively, if no `.env` credentials are set, the application runs in stable fallback mode which persists data safely within a local JSON file (`data/db.json`).

---

## 🚀 Part 4: Deploying Node.js App on cPanel

cPanel supports Node.js applications natively via the **Setup Node.js App** module:

1. Click **Setup Node.js App** in cPanel.
2. Click **Create Application**.
3. Fill in the parameters:
   - **Node.js version**: Select `18.x` or higher.
   - **Application Mode**: `production`
   - **Application root**: The directory path where you uploaded your project code (e.g. `public_html/sfclinic` or `sfclinic`).
   - **Application URL**: Your domain (e.g. `clinic.yourdomain.com`).
   - **Application startup file**: `server.js` (We've added a custom root-level launcher that redirects execution automatically to the production compiled output).
4. After creating, scroll down to the Command Line section, copy the virtualenv source entry command, access your server via SSH, and run:
   ```bash
   npm install
   npm run build
   ```
5. Click **Restart application**. Your app is live!

---

## 🛠️ Part 5: Troubleshooting & Common Build Errors

### ❌ Error 1: `sh: vite: command not found` (or `'vite' is not recognized...`)

**Why this happens:**
There are **two critical reasons** why this happens on cPanel:

1. **You are using Node.js 14**: Your logs indicate you are using Node.js version `14`. Modern development tools like **Vite 6** and **ESBuild** require **Node.js 18.x or higher** (Vite 6 requires Node 18+). Under Node 14, installing Vite will fail to execute or get skipped.
2. **cPanel's "Production" Mode Skips Development Dependencies**: In cPanel's Setup Node.js App interface, if the **Application Mode** is set to **`production`**, running `npm install` tells Node to skip all packages listed in `"devDependencies"` (which includes `vite`, `esbuild`, `typescript`, etc.). Since they are skipped, the command `vite` will not exist when you run `npm run build`.

---

### 📂 How to Solve the Deployment Issues (Choose Option A or B)

Both options will connect your application and database correctly!

#### 💡 Option A (Easiest & Highly Recommended): Build Locally / inside AI Studio and upload pre-compiled files
Instead of running complex builds on your low-powered cPanel Node.js 14 environment, you can prepare the build here in AI Studio (or on your computer) and upload the ready files.

1. **Step 1: Download your ready-assembled ZIP**
   - In **AI Studio**, download the project as a ZIP (via the settings menu or the export option).
2. **Step 2: Generate the Build**
   - The files in your project are **already built successfully on AI Studio**.
   - Make sure your zip file includes the `dist` folder containing `server.cjs` and the other static files.
3. **Step 3: Transfer to cPanel**
   - Upload the entire set of project files to your cPanel application root folder (e.g., `/home/username/public_html/sfclinic` or `/home/username/sfclinic`).
   - Specifically make sure you have:
     - `dist/` directory (your compiled files)
     - `package.json`
     - `server.js` (our root launcher redirecting to `dist/server.cjs`)
     - `.env` (configured with your Database credentials)
4. **Step 4: Run NPM Install & Start on cPanel**
   - Go to **Setup Node.js App** in cPanel.
   - Set **Node.js version** to **`18.x` or `20.x`** (Crucial).
   - Click **Run NPM Install** (since `dist/` is already compiled, Node will only install runtime dependencies like `express` and `mysql2`, which doesn't require compiling anything!).
   - Click **Restart** on your application.

---

---

#### 🛠️ Option B: Build Directly inside cPanel (Fixing the Environment)
If you want cPanel to compile the script itself, copy the files but follow these exact configurations:

1. **Step 1: Upgrade Node.js Version**
   - In cPanel, go to **Setup Node.js App**.
   - Select **Node.js version: 18.x or higher** (e.g., `20.x`). Do NOT use `14.x`.
2. **Step 2: Change Mode to Development**
   - Temporarily change your **Application Mode** from `production` to **`development`**.
   - Save your changes.
3. **Step 3: Install all packages**
   - Click **"Run NPM Install"** in your cPanel dashboard (now it will successfully download `vite`, `esbuild`, and all necessary compilers).
4. **Step 4: Compile the build**
   - In the **"Run JS Script"** dropdown, select **`build`**, and click Run. (This compiles everything to `/dist/` successfully).
5. **Step 5: Switch back to Production**
   - Change your **Application Mode** back to **`production`**.
   - Click **"Restart"** at the top of your Setup Node.js App page.

---

### ❌ Error 2: "I uploaded/updated files but NO changes happened!"

If you updated the application but still see the old login screen or no updates are reflected, there are **three distinct system-level caching layers** causing this:

#### 1. Crucial: The `/dist` Directory Was Not Overwritten
- **Why this happens:** The "social login buttons" and general layouts reside in the **frontend React code**. This frontend code compiles entirely into the static `/dist` directory.
- **Action:** You must download the newly compiled ZIP from AI Studio, and **upload & overwrite the entire `/dist` directory** in your cPanel. If you only uploaded `server.cjs` or some root files, the webpage files inside `/dist` will remain obsolete!

#### 2. Phusion Passenger cached the Node.js process in RAM
- **Why this happens:** cPanel uses **Phusion Passenger** to keep Node.js apps extremely fast by caching loaded modules in server RAM. Clicking "Restart" in cPanel is historically buggy and often doesn't actually release the old running Node.js process.
- **Action (Guaranteed Passenger Reload):**
  1. In your cPanel File Manager, go to the application's root directory.
  2. Create a folder named **`tmp`** if it does not exist already.
  3. Inside the `tmp` folder, create a new empty file named **`restart.txt`** (i.e. `tmp/restart.txt`). 
  4. If the file already exists, open it, edit/add any character, and save it to change its modification timestamp.
  5. Passenger checks this file's timestamp, terminates the old cache process immediately, and reloads your new `server.cjs` from disk.

#### 3. Browser disk caching
- **Why this happens:** Chrome, Edge, and Safari store HTML and Javascript pages on your physical computer to speed up web loads, bypassing new server downloads.
- **Action:** Open your application in a completely private **Incognito Window** to test. Alternatively, do a force-reload:
  - **Windows/Linux:** Press `Ctrl` + `F5` or `Ctrl` + `Shift` + `R`.
  - **Mac:** Press `Cmd` + `Shift` + `R`.

---

## 🔌 Part 6: Why Static Files (dist inside public_html) Cannot Connect to MySQL

If you only upload static files into your `public_html` directory:
- Your application will look like it works (it will load the web pages), but **it is running entirely client-side inside the user's web browser**.
- **A web browser cannot connect directly to MySQL**. It has no way to run server queries or keep database passwords secure. 
- For database connectivity, the web pages must speak to an intermediate backend server (our **Express/Node.js** app).
- Therefore, you **MUST** run the complete application as a **Setup Node.js App** on cPanel (with the `.env` configuration file) instead of just dropping static files inside `public_html`. When configured properly, the frontend automatically makes secure requests to `/api/` endpoints on your Node server, which queries the MySQL database and presents the data back safely!

