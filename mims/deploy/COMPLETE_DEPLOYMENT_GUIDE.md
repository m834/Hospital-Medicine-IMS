# M-IMS — Complete Deployment Guide
### Hospital Medicine Inventory Management System
**Version 1.0 · February 2026**

---

> **Who is this guide for?**
> This guide is written assuming you have **never done this before**. Every command is explained. Every step tells you what it does, why you are doing it, and what the screen should look like when it works. Read every word before typing anything.

---

## 📋 Table of Contents

1. [Understanding the System](#1-understanding-the-system)
2. [What You Need — Two Machines Explained](#2-what-you-need--two-machines-explained)
3. [Setting Up Your Development Machine](#3-setting-up-your-development-machine)
4. [Running the System in Development Mode](#4-running-the-system-in-development-mode)
5. [Building a Protected Production Package](#5-building-a-protected-production-package)
6. [Going to the Client Server — Collecting Machine Info](#6-going-to-the-client-server--collecting-machine-info)
7. [Generating the License Key](#7-generating-the-license-key)
8. [Installing Docker on the Client Server](#8-installing-docker-on-the-client-server)
9. [Deploying to the Client Server](#9-deploying-to-the-client-server)
10. [Starting the System for the First Time](#10-starting-the-system-for-the-first-time)
11. [Verifying Everything Works](#11-verifying-everything-works)
12. [First Login and Initial Hospital Setup](#12-first-login-and-initial-hospital-setup)
13. [Daily Operations — How to Manage the Running System](#13-daily-operations--how-to-manage-the-running-system)
14. [Troubleshooting — When Something Goes Wrong](#14-troubleshooting--when-something-goes-wrong)
15. [Security Checklist Before You Leave the Client Site](#15-security-checklist-before-you-leave-the-client-site)

**Appendix A** — [Alternative: Deploying Without Docker (Native / Bare-Metal)](#appendix-a--alternative-deployment-without-docker-native--bare-metal)
- [A.1 How This Differs](#a1--how-this-differs-from-the-docker-deployment)
- [A.2 Server Requirements](#a2--server-requirements-native)
- [A.3 What Gets Installed](#a3--what-gets-installed-by-the-script)
- [A.4 Building the Native Package](#a4--building-the-native-package-on-your-development-machine)
- [A.5 Collecting Machine Info](#a5--collecting-machine-information-same-as-docker-deployment)
- [A.6 Installing on the Client Server](#a6--installing-on-the-client-server-native)
- [A.7 Verifying the Installation](#a7--verifying-the-installation-native)
- [A.8 Daily Operations (PM2)](#a8--daily-operations-native--pm2)
- [A.9 Database Backup](#a9--database-backup-native)
- [A.10 Updating the Application](#a10--updating-the-application-native)
- [A.11 Troubleshooting](#a11--troubleshooting-native)
- [A.12 Quick Command Reference](#a12--quick-command-reference-card-native)

**Appendix B** — [Windows Deployment (No Docker, No Linux)](#appendix-b--windows-deployment-no-docker-no-linux)
- [B.1 Two Options for Windows](#b1--two-options-for-windows)
- [B.2 Option 1 — WSL2 (Recommended)](#b2--option-1-wsl2-recommended-for-windows)
- [B.3 Option 2 — Native Windows](#b3--option-2-native-windows-powershell-installer)
- [B.4 Daily Operations (Windows)](#b4--daily-operations-windows)
- [B.5 Database Backup (Windows)](#b5--database-backup-windows)
- [B.6 Troubleshooting (Windows)](#b6--troubleshooting-windows)
- [B.7 Quick Reference Card (Windows)](#b7--quick-reference-card-windows)

---

## 1. Understanding the System

Before you touch any computer, understand what this system is and how it works.

### What is M-IMS?

M-IMS is a web application for hospitals to manage medicine inventory, attendance, patients, pharmacy, and reports. It runs **entirely on the hospital's own local server** — no internet connection is needed after installation.

### What runs on the server?

The system has **5 parts**, all running inside Docker containers:

| Part | What it does | Port |
|------|-------------|------|
| **Frontend** | The website that users see in their browser | 3000 (internal) |
| **Backend** | The API that handles all logic and data | 3001 (internal) |
| **PostgreSQL** | The database that stores all hospital data | 5432 (internal only) |
| **Redis** | A fast memory cache for performance | 6379 (internal only) |
| **Nginx** | The web server that users connect to | **80 (public)** |

> **Important:** Users only connect to port **80**. They open a browser and type `http://192.168.1.100/` (the server's IP address). All other ports are hidden inside Docker and are never accessible from outside.

### What is Docker?

Docker is like a box. Each part of the system runs inside its own box. These boxes are called **containers**. You do not install Node.js or PostgreSQL directly on the server — Docker handles all of that inside containers.

### What is a License Key?

The system has a built-in protection that ties it to a specific machine. When the application starts, it reads a file called `license.key` and checks if the **current machine's hardware matches** what is stored in that key. If it does not match, the system refuses to start.

This means:
- The system runs on the client's server ✅
- If someone copies it to another server — it will not start ❌
- If someone steals the USB drive — they cannot run the system ❌

---

## 2. What You Need — Two Machines Explained

There are two separate machines involved in this process.

### Machine 1 — Your Development Mac (Vendor Machine)

This is your personal MacBook or workstation where:
- The source code lives
- You write code and test changes
- You build the production package
- You generate license keys

**This machine is YOURS. The client never touches it.**

Path to the project on your Mac:
```
/Users/mapmac/Hospital-Medicine-IMS/mims/
```

### Machine 2 — The Client Server

This is the hospital's server computer where:
- The system runs permanently
- Hospital staff access it from their browsers
- No source code exists — only the compiled, obfuscated application

**The client manages this machine.**

Application will live at:
```
/opt/mims/
```

---

## 3. Setting Up Your Development Machine

> **Do this section only once.** If you have already done this, skip to Section 4.

### Step 3.1 — Open Terminal on Your Mac

Press `Command + Space`, type `Terminal`, press `Enter`.

A black or white window opens with a blinking cursor. This is where you will type all commands.

### Step 3.2 — Install Homebrew (Mac Package Manager)

Homebrew is a tool that lets you install software on Mac with simple commands.

Check if it is already installed:
```bash
brew --version
```

If you see `Homebrew 4.x.x` — it is already installed. Skip to Step 3.3.

If you see `command not found` — install it:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> This will take 2–5 minutes. It will ask for your Mac password. Type it (nothing appears on screen — that is normal). Press Enter.

### Step 3.3 — Install Node.js

Node.js is the engine that runs JavaScript on the server. The backend and build tools need it.

Check if already installed:
```bash
node --version
```

If you see `v18.x.x` or `v20.x.x` — already installed. Skip to Step 3.4.

If not installed or version is below 18:
```bash
brew install node@20
```

After it installs, verify:
```bash
node --version
```
You should see: `v20.x.x`

Also verify npm (the package installer):
```bash
npm --version
```
You should see: `10.x.x`

### Step 3.4 — Install Docker Desktop for Mac

Docker runs the database, backend, and frontend in containers.

Check if already installed:
```bash
docker --version
```

If you see `Docker version 20.x.x` or higher — already installed. Skip to Step 3.5.

If not installed:
1. Go to: **https://www.docker.com/products/docker-desktop/**
2. Click **Download Docker Desktop for Mac**
3. Open the downloaded `.dmg` file
4. Drag Docker to Applications
5. Open Docker from Applications
6. Wait for Docker to fully start (whale icon in menu bar stops animating)

Verify Docker is running:
```bash
docker --version
docker compose version
```

You should see versions for both.

### Step 3.5 — Navigate to the Project Folder

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend
```

> `cd` means "change directory" — it moves you into a folder. Think of it like double-clicking a folder.

### Step 3.6 — Install All Backend Dependencies

Dependencies are packages (libraries) the backend needs to work.

```bash
npm install
```

> `npm install` reads the `package.json` file and downloads everything listed in it. This takes 1–3 minutes. You will see a lot of text scrolling — that is normal.

When it finishes you will see something like:
```
added 847 packages in 45s
```

### Step 3.7 — Install All Frontend Dependencies

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/frontend
npm install
```

Wait for it to finish. Same process as above.

### Step 3.8 — Set Up the Backend Environment File

The backend needs a configuration file called `.env` to know things like the database password, which port to run on, etc.

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend
cp .env.example .env
```

> `cp` means "copy". This copies the example file to create your actual `.env` file.

Now open it to check:
```bash
cat .env
```

The default settings work for local development. You do not need to change anything for development.

### Step 3.9 — Start Docker Services for Development

The backend needs a PostgreSQL database and Redis cache running locally. Start them:

```bash
cd /Users/mapmac/Hospital-Medicine-IMS
docker-compose up -d postgres redis
```

> `-d` means "detached" — the containers run in the background.

Verify they are running:
```bash
docker ps
```

You should see two containers listed: one for `postgres` and one for `redis`.

### Step 3.10 — Run Database Migrations

Migrations create all the database tables.

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend
npx prisma migrate dev
```

Wait for it to finish. You will see lines like:
```
✔ Generated Prisma Client
✔ Applied migration `20251220060014`
...
```

### Step 3.11 — Seed the Database with Initial Data

This creates the default admin user and basic data:

```bash
npx ts-node prisma/seed.ts
```

---

## 4. Running the System in Development Mode

> **Development mode** = for testing and making changes. The code runs from source files directly. Do NOT use this on a client server.

### Step 4.1 — Start the Backend

Open a terminal and run:

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend
npm run start:dev
```

> `start:dev` starts the backend with **watch mode** — it automatically restarts whenever you save a file.

Wait until you see:
```
🚀 M-IMS Backend API running on: http://localhost:3001
```

> **Important for development:** The license check is active. To bypass it during local development, add this line to your `.env` file:
> ```
> SKIP_LICENSE_CHECK=true
> ```
> This is already set to `true` in `.env.example` so it works out of the box after `cp .env.example .env`.
> ⚠️ **Never set this in production.** Even if the variable is present, the license check always runs when `NODE_ENV=production`.

**Leave this terminal open.** The backend runs in it.

### Step 4.2 — Start the Frontend

Open a **new terminal window** (`Command + T` or `Command + N`):

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/frontend
npm run dev
```

Wait until you see:
```
▲ Next.js 15.x.x
- Local: http://localhost:3000
✓ Ready in 3.2s
```

**Leave this terminal open too.**

### Step 4.3 — Open in Browser

Open Safari or Chrome and go to:
```
http://localhost:3000
```

You should see the M-IMS login page.

**Default login credentials:**
- Email: `admin@hospital.local`
- Password: `Admin@123456`

### Step 4.4 — Stopping Development Mode

To stop the backend: go to its terminal → press `Ctrl + C`
To stop the frontend: go to its terminal → press `Ctrl + C`
To stop Docker: `docker-compose down`

---

## 5. Building a Protected Production Package

> This is what you do **before going to the client**. You create a package that has no readable source code and locks to one machine.

### Understanding What "Build" Means

When you develop, the code is in TypeScript (`.ts` files). Computers cannot run TypeScript directly — you must compile it to JavaScript (`.js` files) first. On top of that, for production, we **obfuscate** the JavaScript — this scrambles the code so it cannot be read or copied.

Think of it like this:
- Raw source code = a recipe written in plain English
- Compiled code = the recipe translated to another language
- Obfuscated code = the recipe scrambled so it looks like random letters — impossible to understand

### Step 5.1 — Make Sure Docker is Running

```bash
docker --version
```

Docker Desktop must be open on your Mac (check the whale icon in the menu bar).

### Step 5.2 — Install the Obfuscation Tool

This should already be installed from before. Verify:

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend
ls node_modules/javascript-obfuscator
```

If you see files listed — it is installed. Skip to Step 5.3.

If you see `No such file or directory`:
```bash
npm install --save-dev javascript-obfuscator
```

Wait for it to finish.

### Step 5.3 — Build the Protected Backend

This single command does everything: compiles TypeScript, obfuscates JavaScript, removes source maps, and packs everything into `dist-protected/`:

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend
npm run build:prod
```

> This takes **3–8 minutes**. You will see a lot of progress text.

When it is done, you will see:
```
╔══════════════════════════════════════════════╗
║       ✅ Protected Build Complete!            ║
╚══════════════════════════════════════════════╝

📁 Output directory: /Users/mapmac/.../dist-protected/
```

Verify it was created:
```bash
ls dist-protected/
```

You should see:
```
app/          ← obfuscated JavaScript files
prisma/       ← database schema
package.json  ← production dependencies list
start.sh      ← startup script
```

### Step 5.4 — Build the Protected Frontend

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/frontend
NODE_ENV=production npm run build
```

> This takes **2–5 minutes**.

When done you will see:
```
✓ Compiled successfully
Route (app) ...
```

### Step 5.5 — Create the Output Folder

This folder will contain everything you carry to the client:

```bash
mkdir -p /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output
```

### Step 5.6 — Build the Backend Docker Image

A Docker image is like a sealed box containing the obfuscated application. You build it once and ship it to the client.

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims

docker build \
  --no-cache \
  -f deploy/Dockerfile.backend \
  -t mims-backend:1.0.0 \
  -t mims-backend:latest \
  .
```

> The `.` at the end is important — it tells Docker to look in the current folder.
> `--no-cache` means start fresh, do not reuse any old build steps.
> `-t mims-backend:1.0.0` gives the image a name and version number.

This takes **5–10 minutes**. You will see lines like:
```
[+] Building 42.3s (15/15) FINISHED
```

### Step 5.7 — Build the Frontend Docker Image

```bash
docker build \
  --no-cache \
  -f deploy/Dockerfile.frontend \
  -t mims-frontend:1.0.0 \
  -t mims-frontend:latest \
  .
```

This also takes **5–10 minutes**.

### Step 5.8 — Save the Docker Images as Files

Now export the images into files you can carry on a USB drive:

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output

echo "Saving backend image... (this may take a few minutes)"
docker save mims-backend:1.0.0 | gzip > mims-backend-1.0.0.tar.gz

echo "Saving frontend image..."
docker save mims-frontend:1.0.0 | gzip > mims-frontend-1.0.0.tar.gz

echo "Saving database image..."
docker pull postgres:16-alpine
docker save postgres:16-alpine | gzip > postgres-16-alpine.tar.gz

echo "Saving cache image..."
docker pull redis:7-alpine
docker save redis:7-alpine | gzip > redis-7-alpine.tar.gz

echo "Saving web server image..."
docker pull nginx:alpine
docker save nginx:alpine | gzip > nginx-alpine.tar.gz

echo "All images saved!"
```

> Each `docker save` command converts a Docker image to a `.tar.gz` file (a compressed archive).

### Step 5.9 — Copy the Configuration Files to Output

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output

cp ../docker-compose.prod.yml ./docker-compose.yml
cp ../nginx.conf ./nginx.conf
```

### Step 5.10 — Create the Environment File Template

Create the `.env` file that will go on the client server:

```bash
nano /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output/.env
```

> `nano` is a simple text editor inside the terminal. You type, then save with `Ctrl+O` and exit with `Ctrl+X`.

Type exactly this (you will fill in the passwords later):

```env
# M-IMS Production Environment
NODE_ENV=production
APP_VERSION=1.0.0

# Database
DB_USERNAME=mims_user
DB_PASSWORD=M1ms@H0sp!t@l#2026$Secure
DB_NAME=mims_db

# Redis
REDIS_PASSWORD=M1ms@H0sp!t@l#2026$Secure

# JWT Secrets (fill in after generating below)
JWT_SECRET=FILL_IN_AFTER_GENERATING
JWT_REFRESH_SECRET=FILL_IN_AFTER_GENERATING

# NextAuth
NEXTAUTH_SECRET=FILL_IN_AFTER_GENERATING

# License (DO NOT share this with the client)
LICENSE_MASTER_KEY=M1MS-H05P1T4L-PR0T3CT3D-2026-K3Y
```

Save: press `Ctrl+O` → press `Enter` → press `Ctrl+X`

### Step 5.11 — Generate Strong Passwords

Run this command **3 separate times**. Each time it gives you a random 128-character password. Use each one for a different field in the `.env` file.

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it once → copy the output → paste it as `JWT_SECRET=`
Run it again → paste as `JWT_REFRESH_SECRET=`
Run it a third time → paste as `NEXTAUTH_SECRET=`

Also create strong passwords for `DB_PASSWORD` and `REDIS_PASSWORD`. Use something like:
```
DB_PASSWORD=M1ms@H0sp!t@l#2026$Secure
REDIS_PASSWORD=R3d!s@H0sp!t@l#2026$Cache
```

Open the .env file and fill in all the values:
```bash
nano /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output/.env
```

### Step 5.12 — Verify the Output Folder is Complete

```bash
ls -lh /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output/
```

You must see **all of these files** before continuing:

```
mims-backend-1.0.0.tar.gz     ← backend application image
mims-frontend-1.0.0.tar.gz    ← frontend application image
postgres-16-alpine.tar.gz     ← database image
redis-7-alpine.tar.gz         ← cache image
nginx-alpine.tar.gz           ← web server image
docker-compose.yml            ← how to start all containers
nginx.conf                    ← web server routing rules
.env                          ← all passwords and settings
```

One file is **missing on purpose** — `license.key`. You cannot generate it until you have the client's machine information (next section).

### Step 5.13 — Copy Everything to a USB Drive

Plug in a USB drive and copy:

```bash
# Check what the USB drive is called (look for your drive name)
ls /Volumes/

# Copy the output folder (replace USB_NAME with your actual drive name)
cp -r /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output/ /Volumes/USB_NAME/mims-deployment/
```

Verify:
```bash
ls /Volumes/USB_NAME/mims-deployment/
```

You should see the same files as in Step 5.12.

---

## 6. Going to the Client Server — Collecting Machine Info

> You need to be **physically at the client server** or have **SSH remote access** for this section.
> The goal is to collect the server's unique hardware identity so you can generate a license key locked to it.

### Step 6.1 — Connect to the Client Server

**Option A — Physical access:** Sit at the server. Open a terminal (on Linux: right-click desktop → Open Terminal, or press `Ctrl+Alt+T`).

**Option B — Remote SSH access** (from your Mac):
```bash
ssh username@SERVER_IP_ADDRESS
# Example:
ssh admin@192.168.1.100
```

When asked "Are you sure you want to continue connecting?" type `yes` and press Enter.
Enter the server password when prompted.

### Step 6.2 — Get the Machine ID

The machine ID is a unique number that identifies this specific computer.

```bash
cat /etc/machine-id
```

You will see something like:
```
d8f3a1b2c4e5f6a7b8c9d0e1f2a3b4c5
```

**Write this down or copy it to a notes app.** You will need it later.

If that file does not exist, try:
```bash
cat /var/lib/dbus/machine-id
```

### Step 6.3 — Get the MAC Addresses

A MAC address is a unique identifier for each network card. It looks like `aa:bb:cc:dd:ee:ff`.

```bash
ip link show | grep "link/ether"
```

You will see output like:
```
    link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff
    link/ether 11:22:33:44:55:66 brd ff:ff:ff:ff:ff:ff
```

**Write down all MAC addresses shown.** Ignore any that show `00:00:00:00:00:00` — those are virtual.

### Step 6.4 — Get the Server IP Address

```bash
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

You will see something like:
```
    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0
```

**Write down: `192.168.1.100`** — this is the hospital LAN IP address. Hospital staff will type this into their browser.

### Step 6.5 — Write Down Everything in This Form

Fill this in carefully:

```
┌────────────────────────────────────────────────────────────┐
│  HOSPITAL SERVER FINGERPRINT FORM                          │
├────────────────────────────────────────────────────────────┤
│  Hospital Name     : ______________________________        │
│  Server Hostname   : ______________________________        │
│  Server IP Address : ______________________________        │
│  Operating System  : ______________________________        │
│  Machine ID        : ______________________________        │
│  MAC Address 1     : ______________________________        │
│  MAC Address 2     : ______________________________ (opt)  │
│  Date Collected    : ______________________________        │
└────────────────────────────────────────────────────────────┘
```

---

## 7. Generating the License Key

> Go back to **your development Mac** for this step.

### Step 7.1 — Run the License Generator

Open a terminal on your Mac and run this command. **Replace the values with what you wrote down from the client server:**

```bash
cd /Users/mapmac/Hospital-Medicine-IMS/mims/backend

npx ts-node scripts/generate-license.ts \
  --client-name="HOSPITAL NAME HERE" \
  --licensed-to="CONTACT PERSON NAME" \
  --machine-id="PASTE MACHINE ID HERE" \
  --mac="PASTE FIRST MAC ADDRESS HERE" \
  --mac="PASTE SECOND MAC ADDRESS HERE" \
  --expires="2027-12-31"
```

**Real example:**
```bash
npx ts-node scripts/generate-license.ts \
  --client-name="Al-Noor General Hospital" \
  --licensed-to="Dr. Ahmed Al-Rashidi" \
  --machine-id="d8f3a1b2c4e5f6a7b8c9d0e1f2a3b4c5" \
  --mac="aa:bb:cc:dd:ee:ff" \
  --mac="11:22:33:44:55:66" \
  --expires="2027-12-31"
```

> Notes:
> - `--expires` is optional. Leave it out for a license that never expires.
> - Add as many `--mac` lines as there are network cards.
> - The `--client-name` and `--licensed-to` can include spaces — just keep the quotes.

### Step 7.2 — Understand the Output

When it succeeds you will see:
```
╔══════════════════════════════════════════════╗
║        M-IMS License Key Generator           ║
╚══════════════════════════════════════════════╝

✅ License generated successfully!

   📄 License file  : .../dist-protected/license.key
   📋 License info  : .../dist-protected/license.info

📦 DEPLOYMENT INSTRUCTIONS:
   1. Copy license.key to the client server...
```

Two files are created:
- **`license.key`** → This is the encrypted license. **You give this to the client** (copy it to the USB drive).
- **`license.info`** → This is your vendor record. **Keep this on your Mac**. Never give it to the client.

### Step 7.3 — Copy license.key to the USB Drive

```bash
cp /Users/mapmac/Hospital-Medicine-IMS/mims/backend/dist-protected/license.key \
   /Volumes/USB_NAME/mims-deployment/license.key
```

### Step 7.4 — Save Your Vendor Record

```bash
mkdir -p /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/vendor-records

cp /Users/mapmac/Hospital-Medicine-IMS/mims/backend/dist-protected/license.info \
   "/Users/mapmac/Hospital-Medicine-IMS/mims/deploy/vendor-records/license-HOSPITAL_NAME-$(date +%Y-%m-%d).info"
```

### Step 7.5 — Verify the USB Drive is Ready

```bash
ls /Volumes/USB_NAME/mims-deployment/
```

You must now see **all 9 files**:

```
mims-backend-1.0.0.tar.gz
mims-frontend-1.0.0.tar.gz
postgres-16-alpine.tar.gz
redis-7-alpine.tar.gz
nginx-alpine.tar.gz
docker-compose.yml
nginx.conf
.env
license.key                 ← now present!
```

**The USB drive is ready. Proceed to the client server.**

---

## 8. Installing Docker on the Client Server

> **Do this on the CLIENT SERVER.**
> If Docker is already installed (run `docker --version` to check), skip this section.

### Step 8.1 — Check the Operating System

```bash
cat /etc/os-release
```

Look for the `NAME=` line. Common options:
- `Ubuntu 22.04` → use Ubuntu instructions below
- `Ubuntu 20.04` → use Ubuntu instructions below
- `Debian GNU/Linux` → use Ubuntu instructions below
- `CentOS` or `Red Hat` → contact your IT team for OS-specific commands

### Step 8.2 — Install Docker on Ubuntu/Debian

Run these commands **one at a time**. Wait for each to finish before typing the next one.

```bash
# Step 1: Update the package list
sudo apt-get update
```

```bash
# Step 2: Install required tools
sudo apt-get install -y ca-certificates curl gnupg lsb-release
```

```bash
# Step 3: Create a folder for security keys
sudo install -m 0755 -d /etc/apt/keyrings
```

```bash
# Step 4: Download Docker's security key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

```bash
# Step 5: Add Docker's software source
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
# Step 6: Update package list again (now with Docker source)
sudo apt-get update
```

```bash
# Step 7: Install Docker
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

```bash
# Step 8: Start Docker and make it start on boot
sudo systemctl start docker
sudo systemctl enable docker
```

```bash
# Step 9: Allow your user to run Docker without typing sudo every time
sudo usermod -aG docker $USER
newgrp docker
```

```bash
# Step 10: Verify Docker is working
docker --version
docker compose version
```

You should see something like:
```
Docker version 27.x.x, build xxxxx
Docker Compose version v2.x.x
```

> **If the server has NO internet:** You cannot run the commands above. You need Docker offline packages (`.deb` files) on a USB drive. Ask your server IT team to pre-download the Docker packages for the exact Ubuntu version and install them manually.

---

## 9. Deploying to the Client Server

> **Do this on the CLIENT SERVER.**

### Step 9.1 — Create the Application Directory

This is the permanent home of the application on the server:

```bash
sudo mkdir -p /opt/mims
sudo chown $USER:$USER /opt/mims
cd /opt/mims
```

> `mkdir -p` creates the folder and any parent folders needed.
> `chown $USER:$USER` makes your user the owner so you can write files without sudo.

### Step 9.2 — Copy Files from USB Drive to the Server

Plug in the USB drive. Find its name:

```bash
ls /media/$USER/
```

You will see something like `USB_DRIVE` or a long name. Copy:

```bash
cp -r /media/$USER/USB_DRIVE_NAME/mims-deployment/* /opt/mims/
```

If you are using SCP from your Mac (remote transfer):

```bash
# Run this on YOUR Mac, not the server:
scp -r /Users/mapmac/Hospital-Medicine-IMS/mims/deploy/output/* \
  username@192.168.1.100:/opt/mims/
```

Verify files arrived:

```bash
ls -lh /opt/mims/
```

### Step 9.3 — Load Docker Images into Docker

This installs the application images into Docker on the server.
**No internet is needed for this step.**

```bash
cd /opt/mims

echo "Loading web server (nginx)..."
docker load < nginx-alpine.tar.gz

echo "Loading database (PostgreSQL)..."
docker load < postgres-16-alpine.tar.gz

echo "Loading cache (Redis)..."
docker load < redis-7-alpine.tar.gz

echo "Loading backend..."
docker load < mims-backend-1.0.0.tar.gz

echo "Loading frontend..."
docker load < mims-frontend-1.0.0.tar.gz

echo "All images loaded!"
```

> Each command reads a `.tar.gz` file and installs it into Docker's internal storage. It is like "installing" a program.

Verify all images are loaded:

```bash
docker images
```

You should see all 5 images listed:

```
REPOSITORY        TAG           IMAGE ID       CREATED        SIZE
mims-backend      1.0.0         abc123def456   2 hours ago    380MB
mims-frontend     1.0.0         bcd234ef5678   2 hours ago    150MB
mims-backend      latest        abc123def456   2 hours ago    380MB
mims-frontend     latest        bcd234ef5678   2 hours ago    150MB
postgres          16-alpine     ...
redis             7-alpine      ...
nginx             alpine        ...
```

### Step 9.4 — Fill In the Environment File

The `.env` file was created on your Mac with placeholder values. Now fill in the actual passwords on the server:

```bash
nano /opt/mims/.env
```

The file already has passwords from Step 5.11 that you generated. Review it and confirm all `FILL_IN_...` placeholders have been replaced with actual values.

It should look like this when done (with real values, not these examples):

```env
NODE_ENV=production
APP_VERSION=1.0.0

DB_USERNAME=mims_user
DB_PASSWORD=M1ms@H0sp!t@l#2026$Secure
DB_NAME=mims_db

REDIS_PASSWORD=R3d!s@H0sp!t@l#2026$Cache

JWT_SECRET=a3f5b2c1d8e7f4a6b9c0d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8
JWT_REFRESH_SECRET=b4c6d1e9f2a5b8c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2
NEXTAUTH_SECRET=c5d8e2f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5

LICENSE_MASTER_KEY=M1MS-H05P1T4L-PR0T3CT3D-2026-K3Y
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

Protect the file (so only the owner can read it):

```bash
chmod 600 /opt/mims/.env
```

### Step 9.5 — Protect the License Key File

```bash
chmod 444 /opt/mims/license.key
```

> `444` means read-only for everyone — no one can accidentally delete or overwrite it.

Verify:
```bash
ls -la /opt/mims/license.key
```

You should see: `-r--r--r-- 1 ...` at the start — that means read-only.

### Step 9.6 — Create the Logs Directory

```bash
mkdir -p /opt/mims/logs
chmod 755 /opt/mims/logs
```

### Step 9.7 — Set Up Auto-Start on Boot (systemd)

This makes the system automatically start when the server reboots — so the hospital never needs to manually start it.

Create the service file:

```bash
sudo nano /etc/systemd/system/mims.service
```

Type exactly this:

```ini
[Unit]
Description=M-IMS Hospital Management System
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/mims
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
User=root

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mims.service
```

You should see:
```
Created symlink /etc/systemd/system/multi-user.target.wants/mims.service → /etc/systemd/system/mims.service.
```

### Step 9.8 — Configure the Firewall

Open only port 80 (web access). Keep all other ports closed.

Check if the firewall (`ufw`) is active:

```bash
sudo ufw status
```

If it says `Status: active`, add the rules:

```bash
sudo ufw allow 22/tcp comment 'SSH - remote access'
sudo ufw allow 80/tcp comment 'M-IMS Web'
sudo ufw reload
```

If it says `Status: inactive`, enable it:

```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'M-IMS Web'
sudo ufw enable
```

> **Warning:** Always allow port 22 (SSH) before enabling the firewall — otherwise you will lock yourself out.

Verify the rules:

```bash
sudo ufw status
```

You should see:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
```

---

## 10. Starting the System for the First Time

> **Do this on the CLIENT SERVER.**

### Step 10.1 — Navigate to the App Directory

```bash
cd /opt/mims
```

### Step 10.2 — Start All Containers

```bash
docker compose up -d
```

> `-d` runs everything in the background.

You will see Docker pulling and starting containers:

```
[+] Running 5/5
 ✔ Container mims-postgres-1   Started    0.8s
 ✔ Container mims-redis-1      Started    0.9s
 ✔ Container mims-backend-1    Started    2.1s
 ✔ Container mims-frontend-1   Started    3.4s
 ✔ Container mims-nginx-1      Started    4.2s
```

### Step 10.3 — Watch the License Validation

The most important moment — the backend validates the license. Watch the logs:

```bash
docker compose logs -f backend
```

> `-f` means "follow" — keep showing new log lines as they appear.

**If the license is valid**, you will see:
```
[LICENSE] ✅ License valid — client: "Al-Noor General Hospital", expires: 2027-12-31
🚀 M-IMS Backend API running on: http://localhost:3001
📚 API Documentation: http://localhost:3001/api/docs
```

**If the license fails** (machine mismatch), you will see:
```
╔══════════════════════════════════════════════════╗
║           M-IMS LICENSE VALIDATION FAILED         ║
╠══════════════════════════════════════════════════╣
║  Status  : MACHINE_MISMATCH                       ║
```

If it fails → go to [Section 14 — Troubleshooting](#14-troubleshooting--when-something-goes-wrong).

Press `Ctrl+C` to stop watching logs (the containers keep running).

### Step 10.4 — Wait for the Database to Set Up

The very first startup also runs database migrations (creates all tables). This can take **1–2 minutes**. Check that it completed:

```bash
docker compose logs backend | grep -E "migration|database|ready|running"
```

You should eventually see the application is running.

---

## 11. Verifying Everything Works

### Step 11.1 — Check All Containers Are Running

```bash
docker compose ps
```

**Expected output — every container should say `Up` or `running`:**

```
NAME                  IMAGE                  COMMAND              STATUS
mims-nginx-1          nginx:alpine           ...                  Up 3 minutes
mims-frontend-1       mims-frontend:1.0.0    ...                  Up 3 minutes (healthy)
mims-backend-1        mims-backend:1.0.0     ...                  Up 3 minutes (healthy)
mims-postgres-1       postgres:16-alpine     ...                  Up 3 minutes (healthy)
mims-redis-1          redis:7-alpine         ...                  Up 3 minutes (healthy)
```

If any show `Exiting` or `Error` — check the logs:
```bash
docker compose logs CONTAINER_NAME
# Example:
docker compose logs backend
```

### Step 11.2 — Test the Backend API

```bash
curl http://localhost:3001/api/v1/health
```

> `curl` is a tool that sends a web request. Think of it as a browser that works in the terminal.

Expected response:
```json
{"status":"ok","timestamp":"2026-02-22T..."}
```

### Step 11.3 — Test the Frontend

```bash
curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/
```

Expected response:
```
200
```

`200` means the page loaded successfully.

### Step 11.4 — Test Nginx (the Main Entry Point)

```bash
curl -o /dev/null -s -w "%{http_code}\n" http://localhost/
```

Expected response:
```
200
```

### Step 11.5 — Test from a Hospital Workstation

Go to any computer on the hospital's local network. Open a web browser and type:

```
http://192.168.1.100/
```

(Replace `192.168.1.100` with the actual server IP address you noted in Step 6.4.)

You should see the **M-IMS login page**.

---

## 12. First Login and Initial Hospital Setup

### Step 12.1 — Log In as Administrator

Open a browser on any hospital computer and go to: `http://SERVER_IP/`

Use these default credentials:
- **Email:** `admin@hospital.local`
- **Password:** `Admin@123456`

### Step 12.2 — Change the Default Admin Password IMMEDIATELY

This is critical for security. Default passwords are known and must be changed.

1. Click on the admin name (top right corner)
2. Click **Profile** or **Settings**
3. Find **Change Password**
4. Enter the old password: `Admin@123456`
5. Enter a new strong password (at least 12 characters, mix of letters, numbers, symbols)
6. Save

**Write the new password down and keep it in a secure place.**

### Step 12.3 — Set Up the Hospital Profile

1. Go to **Settings** → **Hospital Configuration**
2. Fill in:
   - Hospital Name
   - Address
   - Phone Number
   - Email
   - Timezone (e.g., `Asia/Riyadh`, `Asia/Dubai`, `UTC`)
3. Click **Save**

### Step 12.4 — Create Departments

1. Go to **Settings** → **Departments**
2. Click **Add Department**
3. Add all hospital departments, for example:
   - Main Pharmacy
   - Emergency Department
   - General Ward
   - ICU
   - Laboratory
   - OPD (Outpatient)
4. Save each one

### Step 12.5 — Create Staff User Accounts

1. Go to **Users** → **Add User**
2. For each staff member, fill in:
   - Full Name
   - Email address
   - Role (Admin / Pharmacist / Doctor / Nurse / etc.)
   - Department
   - Password (temporary — they should change it on first login)
3. Save

### Step 12.6 — Import Initial Medicine Inventory

1. Go to **Inventory** → **Import**
2. Download the Excel template
3. Fill in the medicine list (name, unit, quantity, etc.)
4. Upload the filled template
5. Review and confirm the import

---

## 13. Daily Operations — How to Manage the Running System

> This section is for the **hospital IT person** who maintains the system after handover.

### How to Check if the System is Running

```bash
cd /opt/mims
docker compose ps
```

All containers should show `Up`.

### How to See the Logs (What the System is Doing)

Show the last 50 lines of all logs:
```bash
docker compose logs --tail=50
```

Follow live logs (watch in real-time, press `Ctrl+C` to stop):
```bash
docker compose logs -f
```

See only backend logs:
```bash
docker compose logs backend --tail=100
```

### How to Restart the System

Restart everything (use after a configuration change):
```bash
cd /opt/mims
docker compose restart
```

Restart only the backend:
```bash
docker compose restart backend
```

### How to Stop the System

```bash
cd /opt/mims
docker compose down
```

> **Note:** Stopping the system does NOT delete any data. All hospital data is stored in Docker volumes which persist even when containers stop.

### How to Start the System Again After Stopping

```bash
cd /opt/mims
docker compose up -d
```

### How to Update to a New Version

When the vendor provides a new version:

1. Copy the new `.tar.gz` image files to `/opt/mims/`
2. Load the new images:
   ```bash
   docker load < mims-backend-NEW_VERSION.tar.gz
   docker load < mims-frontend-NEW_VERSION.tar.gz
   ```
3. Update the version number in `.env`:
   ```bash
   nano /opt/mims/.env
   # Change APP_VERSION=1.0.0 to APP_VERSION=NEW_VERSION
   ```
4. Restart with the new version:
   ```bash
   docker compose up -d
   ```

### How to Back Up the Database

Set up automatic daily backups.

First, create the backup script:
```bash
nano /opt/mims/backup.sh
```

Type exactly this:

```bash
#!/bin/bash
BACKUP_DIR=/opt/mims/backups
DATE=$(date +%Y-%m-%d_%H-%M)
mkdir -p $BACKUP_DIR

# Load environment variables
export $(grep -v '^#' /opt/mims/.env | xargs)

# Create backup
docker compose -f /opt/mims/docker-compose.yml exec -T postgres \
  pg_dump -U $DB_USERNAME $DB_NAME \
  | gzip > $BACKUP_DIR/mims_backup_$DATE.sql.gz

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup done: mims_backup_$DATE.sql.gz"
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

Make it executable:
```bash
chmod +x /opt/mims/backup.sh
```

Schedule it to run every day at 2:00 AM:
```bash
crontab -e
```

This opens a text editor. Add this line at the bottom:
```
0 2 * * * /opt/mims/backup.sh >> /opt/mims/logs/backup.log 2>&1
```

Save and exit (if it opens `vim`: press `i` to type, then `Esc`, then `:wq` to save).

Test the backup works right now:
```bash
/opt/mims/backup.sh
ls /opt/mims/backups/
```

You should see a `.sql.gz` file.

### How to Restore the Database from a Backup

```bash
cd /opt/mims

# Step 1: Stop the application (keep database running)
docker compose stop backend frontend nginx

# Step 2: Restore from backup (replace the date with your backup filename)
gunzip < /opt/mims/backups/mims_backup_2026-02-22_02-00.sql.gz | \
  docker compose exec -T postgres psql -U mims_user mims_db

# Step 3: Start everything again
docker compose start backend frontend nginx
```

### How to Free Up Disk Space

Check current disk usage:
```bash
df -h /opt/mims/
```

Remove old Docker images and containers (safe to run periodically):
```bash
docker system prune -f
```

Delete old backup files manually:
```bash
ls /opt/mims/backups/
rm /opt/mims/backups/mims_backup_OLD_DATE.sql.gz
```

---

## 14. Troubleshooting — When Something Goes Wrong

### Problem: "MACHINE_MISMATCH" in the logs

**What it means:** The `license.key` file was generated for a different machine.

**How to fix:**

1. On the server, collect the current machine info:
   ```bash
   cat /etc/machine-id
   ip link show | grep "link/ether"
   ```

2. Contact the vendor with this information.

3. Vendor generates a new `license.key` with the correct machine info (see Section 7).

4. Vendor sends the new `license.key` file.

5. Replace the old file on the server:
   ```bash
   cp /path/to/new/license.key /opt/mims/license.key
   chmod 444 /opt/mims/license.key
   docker compose restart backend
   ```

6. Watch the logs to confirm it works:
   ```bash
   docker compose logs -f backend
   ```

---

### Problem: "NOT_FOUND" in the logs

**What it means:** The `license.key` file is missing.

**How to fix:**

Check if the file exists:
```bash
ls -la /opt/mims/license.key
```

If it is missing, copy it from the USB drive or re-generate it (Section 7), then:
```bash
docker compose restart backend
```

Also verify the `docker-compose.yml` has the right volume mount. Look for this line:
```bash
grep "license.key" /opt/mims/docker-compose.yml
```

You should see:
```
- ./license.key:/app/license.key:ro
```

---

### Problem: "EXPIRED" in the logs

**What it means:** The license validity date has passed.

**How to fix:** Contact the vendor. The vendor will generate a new `license.key` with a new expiry date and send it to you.

---

### Problem: Backend container keeps restarting

Check the logs:
```bash
docker compose logs backend --tail=30
```

Common causes:
- License problem (see above)
- Database not ready → wait 1 minute and try again
- Wrong password in `.env` → check `DB_PASSWORD` matches what PostgreSQL expects

---

### Problem: Cannot open the website from a browser

Check step by step:

```bash
# 1. Are containers running?
docker compose ps

# 2. Is nginx running?
docker compose logs nginx

# 3. Test locally on the server itself
curl http://localhost/

# 4. Check firewall
sudo ufw status

# 5. Get server IP
ip addr show | grep "inet "
```

Make sure you are typing `http://` (not `https://`) in the browser.

---

### Problem: System did not start after server reboot

Check the service status:
```bash
sudo systemctl status mims.service
```

If it shows `failed` or `inactive`:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mims.service
sudo systemctl start mims.service
```

---

### Problem: "No space left on device"

Check disk:
```bash
df -h
```

If disk is full:
```bash
# Remove unused Docker data
docker system prune -f

# Remove old backups
ls /opt/mims/backups/
rm /opt/mims/backups/mims_backup_2026-01-*.sql.gz

# Check what is using space
du -sh /opt/mims/* | sort -h
```

---

### Problem: Forgot the admin password

Connect to the server and reset it directly:
```bash
cd /opt/mims

docker compose exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();
argon2.hash('NewPassword@123').then(hash => {
  return prisma.user.update({
    where: { email: 'admin@hospital.local' },
    data: { password: hash }
  });
}).then(() => { console.log('Password reset!'); process.exit(0); });
"
```

Then log in with: `admin@hospital.local` / `NewPassword@123` and immediately change it.

---

## 15. Security Checklist Before You Leave the Client Site

Go through this list **before handing over the system** to the hospital.

| # | Check | Status |
|---|-------|--------|
| 1 | `license.key` is in place and system starts with "License valid" message | ☐ |
| 2 | Default admin password has been changed (not `Admin@123456` anymore) | ☐ |
| 3 | All passwords in `.env` are strong (no `FILL_IN_...` text remains) | ☐ |
| 4 | `.env` file permissions are `600` → run: `ls -la /opt/mims/.env` → shows `-rw-------` | ☐ |
| 5 | `license.key` permissions are `444` → `ls -la /opt/mims/license.key` → shows `-r--r--r--` | ☐ |
| 6 | Only port 80 is open in the firewall → `sudo ufw status` | ☐ |
| 7 | Ports 3000, 3001, 5432, 6379 are **NOT** accessible from outside the server | ☐ |
| 8 | Database backup is scheduled and tested → `ls /opt/mims/backups/` shows a `.sql.gz` file | ☐ |
| 9 | System auto-starts on reboot → `sudo systemctl status mims.service` shows `enabled` | ☐ |
| 10 | System survives a reboot → reboot the server → wait 2 min → open browser → website loads | ☐ |
| 11 | Hospital IT person has been trained to check logs and restart containers | ☐ |
| 12 | Vendor has saved `license.info` in their records | ☐ |
| 13 | USB drive is taken back (do not leave source files with the client) | ☐ |

### What the Client Receives

✅ **Give to client:**
- USB drive with only the `output/` folder (images + config files)
- `license.key` (already on server)
- This deployment guide (the `.txt` version in the output folder)
- Admin username and the new password (written on paper, sealed envelope)

❌ **Never give to client:**
- The `src/` folder (source code)
- Any `.ts` TypeScript files
- The `scripts/` folder
- Your development `.env` file
- The `license.info` file (your vendor record)
- Git repository access
- The `obfuscator.config.js` file

---

## Quick Command Reference Card

> Print this page and keep it at the server.

```
START SYSTEM:        cd /opt/mims && docker compose up -d
STOP SYSTEM:         cd /opt/mims && docker compose down
RESTART SYSTEM:      cd /opt/mims && docker compose restart
CHECK STATUS:        cd /opt/mims && docker compose ps
VIEW LOGS:           cd /opt/mims && docker compose logs --tail=50
FOLLOW LIVE LOGS:    cd /opt/mims && docker compose logs -f backend
RUN BACKUP NOW:      /opt/mims/backup.sh
CHECK DISK SPACE:    df -h /opt/mims/
SERVER IP ADDRESS:   ip addr show | grep "inet "
```

---

*M-IMS Deployment Guide · Version 1.0 · February 2026*
*For vendor support, contact your system provider.*

---

# Appendix A — Alternative Deployment: Without Docker (Native / Bare-Metal)

> **Use this section when:** The client server cannot run Docker (no hardware virtualisation support, restricted OS policy, very old kernel, or shared hosting environment).

---

## A.1 — How This Differs from the Docker Deployment

| Topic | Docker deployment | Native deployment |
|-------|------------------|-------------------|
| Containers | Yes — isolated | No — processes run directly |
| Process manager | Docker Compose | **PM2** (Node.js process manager) |
| PostgreSQL | Docker container | Installed via `apt` |
| Redis | Docker container | Installed via `apt` |
| Nginx | Docker container | Installed via `apt` |
| App files | Inside images | In `/opt/mims/` directory |
| Auto-start on reboot | Docker restart policy | PM2 + systemd service |
| Security / isolation | Container namespace | OS user permissions |
| Difficulty | Lower | Slightly higher |

---

## A.2 — Server Requirements (Native)

| Requirement | Minimum |
|------------|---------|
| **OS** | Ubuntu 22.04 LTS or Debian 12 (64-bit) |
| **CPU** | 2 cores |
| **RAM** | 4 GB |
| **Disk** | 40 GB free |
| **Network** | Internet access for `apt install` (one time only) |
| **Kernel** | 5.x or newer (`uname -r` to check) |
| **Root access** | Required (`sudo` or logged in as root) |

> Docker is NOT needed.

---

## A.3 — What Gets Installed by the Script

The installer (`install-native.sh`) automatically installs all of the following:

| Software | Version | What it does |
|---------|---------|-------------|
| **Node.js** | 20 LTS | Runs the backend and frontend servers |
| **PM2** | Latest | Keeps backend and frontend alive 24/7 |
| **PostgreSQL** | 16 | Database (stores all hospital data) |
| **Redis** | 7 | Cache (sessions, queues) |
| **Nginx** | Latest stable | Web server / reverse proxy on port 80 |
| **UFW** | System | Firewall (allows only ports 22, 80, 443) |

---

## A.4 — Building the Native Package (On Your Development Machine)

Before going to the client site, prepare the package on your build machine.

### Step A.4.1 — Build the backend (obfuscated)

Open a terminal and go to the `backend/` folder:

```
cd mims/backend
npm run build:prod
```

Wait for it to finish. You will see `dist-protected/` appear.

### Step A.4.2 — Build the frontend (standalone)

```
cd mims/frontend
NODE_ENV=production npm run build
```

Wait for it to finish. You will see `.next/standalone/` appear.

### Step A.4.3 — Run the native package script

```
cd mims/deploy
bash package-native.sh
```

This creates a folder called `deploy/output-native/` containing:

```
output-native/
├── backend-dist.tar.gz       ← obfuscated backend (~40 MB)
├── frontend-dist.tar.gz      ← standalone frontend (~60 MB)
├── install-native.sh         ← automated installer
├── nginx-native.conf         ← nginx config for native
└── .env.template             ← environment variables template
```

Copy this entire `output-native/` folder to a USB drive.

---

## A.5 — Collecting Machine Information (Same as Docker Deployment)

Go to the client server. Get the MAC address and hostname exactly as described in **Section 6** of this guide. Come back and generate the `license.key` using the steps in **Section 7**. Bring the `license.key` to the client on your next visit (or transfer it securely).

---

## A.6 — Installing on the Client Server (Native)

### Step A.6.1 — Connect to the server

SSH into the server or open a terminal directly:

```
ssh admin@SERVER_IP
```

Switch to root:

```
sudo -i
```

### Step A.6.2 — Copy the USB contents to the server

Plug in the USB drive. The USB usually mounts at `/media/usb/` or `/mnt/usb/`.

```
cp -r /media/usb/output-native/ /root/mims-install/
cd /root/mims-install/
```

### Step A.6.3 — Create the `.env` file

```
cp .env.template .env
nano .env
```

Fill in all values. Important ones:

```
DATABASE_URL=postgresql://mims_user:YOUR_STRONG_PASSWORD@localhost:5432/mims_db
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
JWT_SECRET=<paste 64 random characters here>
NEXTAUTH_SECRET=<paste 32 random characters here>
NEXTAUTH_URL=http://YOUR_SERVER_IP
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
```

> **How to generate random secrets:**
> ```
> openssl rand -hex 32      ← for JWT_SECRET (gives 64 chars)
> openssl rand -hex 16      ← for NEXTAUTH_SECRET (gives 32 chars)
> openssl rand -base64 24   ← for passwords
> ```

Save the file: press `Ctrl+O`, then `Enter`, then `Ctrl+X`.

### Step A.6.4 — Run the installer

```
chmod +x install-native.sh
bash install-native.sh
```

The script will take 5–10 minutes. You will see coloured messages as each step completes. 

**What a successful run looks like at the end:**

```
[OK]   Backend is online.
[OK]   Frontend is online.
[OK]   Nginx configured and reloaded.
[OK]   PM2 startup configured.

============================================================
  M-IMS Installation Complete!
============================================================

  Access the app at:
    http://192.168.1.50

  ⚠  Place your license.key into:
       /opt/mims/backend/license.key
     then restart the backend:
       pm2 restart mims-backend
```

### Step A.6.5 — Place the license key

Copy the `license.key` file to the server (USB, SCP, or type the contents manually):

```
cp /media/usb/license.key /opt/mims/backend/license.key
chmod 600 /opt/mims/backend/license.key
pm2 restart mims-backend
```

Wait 5 seconds, then check it started:

```
pm2 status
```

You should see both `mims-backend` and `mims-frontend` with status **online**.

---

## A.7 — Verifying the Installation (Native)

These checks are the same as Section 11, but you use PM2 instead of `docker compose`.

### Check PM2 processes are running

```
pm2 status
```

Expected output:

```
┌────┬──────────────────┬─────────┬───────┬──────────┐
│ id │ name             │ status  │ cpu   │ memory   │
├────┼──────────────────┼─────────┼───────┼──────────┤
│  0 │ mims-backend     │ online  │ 0.3%  │ 140 MB   │
│  1 │ mims-frontend    │ online  │ 0.1%  │ 90 MB    │
└────┴──────────────────┴─────────┴───────┴──────────┘
```

### Check backend API is responding

```
curl -s http://localhost:3001/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Check frontend is responding

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200`

### Check Nginx is serving on port 80

```
curl -s -o /dev/null -w "%{http_code}" http://localhost
```

Expected: `200`

### Open browser

On the hospital's internal network, open a web browser and go to:

```
http://SERVER_IP_ADDRESS
```

The M-IMS login screen should appear.

---

## A.8 — Daily Operations (Native — PM2)

These commands replace the `docker compose` commands from Section 13.

### Check what is running

```
pm2 status
```

### View logs (last 50 lines)

```
pm2 logs mims-backend  --lines 50
pm2 logs mims-frontend --lines 50
```

### Follow live logs

```
pm2 logs
```

Press `Ctrl+C` to stop following.

### Restart one service

```
pm2 restart mims-backend
pm2 restart mims-frontend
```

### Restart both services

```
pm2 restart all
```

### Stop everything (maintenance)

```
pm2 stop all
```

### Start everything again

```
pm2 start all
```

### Reload without downtime (zero-downtime restart)

```
pm2 reload all
```

### Check memory and CPU usage

```
pm2 monit
```

Press `Ctrl+C` to exit.

---

## A.9 — Database Backup (Native)

Run this command at any time to take a database backup:

```
sudo -u postgres pg_dump mims_db \
  | gzip > /opt/mims/backups/backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

Create the backup folder first if it does not exist:

```
mkdir -p /opt/mims/backups
```

### Set up automatic nightly backup

```
crontab -e
```

Add this line at the bottom:

```
0 2 * * * sudo -u postgres pg_dump mims_db | gzip > /opt/mims/backups/backup-$(date +\%Y\%m\%d).sql.gz
```

This runs a backup every night at 2:00 AM.

### Restore from backup

```
gunzip -c /opt/mims/backups/backup-20260101-020000.sql.gz \
  | sudo -u postgres psql mims_db
```

---

## A.10 — Updating the Application (Native)

When you release a new version:

1. Build new `backend-dist.tar.gz` and `frontend-dist.tar.gz` on your machine
2. Copy them to the server
3. Stop the running apps:
   ```
   pm2 stop all
   ```
4. Back up the old files:
   ```
   mv /opt/mims/backend /opt/mims/backend-old
   mv /opt/mims/frontend /opt/mims/frontend-old
   ```
5. Extract new files:
   ```
   mkdir -p /opt/mims/backend /opt/mims/frontend
   tar -xzf backend-dist.tar.gz  -C /opt/mims/backend/
   tar -xzf frontend-dist.tar.gz -C /opt/mims/frontend/
   ```
6. Copy the `.env` from the old backend:
   ```
   cp /opt/mims/backend-old/.env  /opt/mims/backend/.env
   cp /opt/mims/backend-old/license.key /opt/mims/backend/license.key
   ```
7. Start everything:
   ```
   pm2 start all
   ```
8. Verify it is working:
   ```
   pm2 status
   curl http://localhost:3001/api/health
   ```
9. If it works, remove the old folders:
   ```
   rm -rf /opt/mims/backend-old /opt/mims/frontend-old
   ```

---

## A.11 — Troubleshooting (Native)

### Backend crashes on start — "license.key not found"

```
pm2 logs mims-backend --lines 20
```

If you see `license.key not found`: the license file is missing.

```
ls /opt/mims/backend/license.key
```

If it doesn't exist, copy it there and restart:

```
cp /media/usb/license.key /opt/mims/backend/license.key
pm2 restart mims-backend
```

---

### Backend crashes — "Cannot connect to database"

Check PostgreSQL is running:

```
systemctl status postgresql
```

If it says `inactive` or `failed`:

```
systemctl start postgresql
pm2 restart mims-backend
```

Check the `DATABASE_URL` in `.env` matches the password you set:

```
cat /opt/mims/backend/.env | grep DATABASE_URL
```

---

### Frontend shows blank page or crashes

```
pm2 logs mims-frontend --lines 30
```

Most common cause: `NEXTAUTH_URL` or `NEXT_PUBLIC_API_URL` is wrong.

Edit the frontend env file:

```
nano /opt/mims/frontend/.env
```

Change `NEXTAUTH_URL` and `NEXT_PUBLIC_API_URL` to the correct server IP, then:

```
pm2 restart mims-frontend
```

---

### Port 80 shows "502 Bad Gateway"

Nginx is running but the app behind it is not responding.

Check both apps are online:

```
pm2 status
```

If any app shows `stopped` or `errored`:

```
pm2 restart all
pm2 logs
```

---

### After reboot, apps don't start automatically

PM2 startup was not saved, or the systemd service was not enabled.

Run these commands:

```
pm2 resurrect
pm2 save
pm2 startup systemd
```

Copy the command PM2 prints and run it, then:

```
systemctl enable pm2-root
```

---

### Check disk space

```
df -h /opt/mims/
```

If disk is more than 80% full, remove old backups:

```
ls -lh /opt/mims/backups/
rm /opt/mims/backups/backup-2025*.sql.gz
```

---

## A.12 — Quick Command Reference Card (Native)

> Print this page and keep it at the server.

```
CHECK STATUS:         pm2 status
START ALL:            pm2 start all
STOP ALL:             pm2 stop all
RESTART ALL:          pm2 restart all
RESTART BACKEND:      pm2 restart mims-backend
RESTART FRONTEND:     pm2 restart mims-frontend
VIEW LOGS (BACKEND):  pm2 logs mims-backend --lines 50
VIEW LOGS (FRONTEND): pm2 logs mims-frontend --lines 50
LIVE LOG STREAM:      pm2 logs
CPU / MEMORY USAGE:   pm2 monit
RUN BACKUP NOW:       sudo -u postgres pg_dump mims_db | gzip > /opt/mims/backups/manual-backup.sql.gz
CHECK DISK SPACE:     df -h /opt/mims/
SERVER IP ADDRESS:    ip addr show | grep "inet "
HEALTH CHECK API:     curl http://localhost:3001/api/health
```

---

# Appendix B — Windows Deployment (No Docker, No Linux)

> **Use this section when:** The client server runs **Windows** and Docker is not available.

---

## B.1 — Two Options for Windows

You have two paths. Read both, then choose the one that fits the server.

| | Option 1 — WSL2 | Option 2 — Native Windows |
|--|----------------|--------------------------|
| **What it is** | Runs Ubuntu *inside* Windows — no dual-boot | Installs all software directly on Windows |
| **Difficulty** | ⭐ Easy | ⭐⭐ Medium |
| **Recommended** | ✅ Yes — use this if possible | Use if WSL2 is blocked |
| **Works on** | Windows 10 (v2004+), Windows 11, Server 2019, Server 2022 | Windows 10 (v1803+), Windows Server 2016/2019/2022 |
| **Install script** | `install-native.sh` (same Linux script) | `install-windows.ps1` (new PowerShell script) |
| **Replaces Windows?** | No — runs alongside Windows | No — installs as Windows services |

> **How to check your Windows version:**
> Press `Win + R`, type `winver`, press Enter.
> If it says Version 2004 or higher → use **Option 1 (WSL2)**.

---

## B.2 — Option 1: WSL2 (Recommended for Windows)

WSL2 lets you run a full Ubuntu environment directly inside Windows. No dual-boot, no virtual machine software, no extra hardware. The M-IMS app then runs inside Ubuntu exactly as described in Appendix A.

### Step B.2.1 — Enable WSL2

Open **PowerShell as Administrator** (right-click the Start button → Windows PowerShell (Admin)):

```
wsl --install -d Ubuntu-22.04
```

Windows will download and install Ubuntu 22.04. When it finishes it will ask you to **restart the computer**. Restart.

After restarting, a black Ubuntu terminal window opens automatically. It will ask you to:
- Choose a username (e.g. `mims`)
- Choose a password (type it twice — nothing shows on screen, that is normal)

Write down the username and password you chose.

### Step B.2.2 — Copy files from USB into Ubuntu

After WSL2 is set up, open the Ubuntu terminal. Your Windows drives are available under `/mnt/c/`, `/mnt/d/`, etc.

If the USB is drive `E:`, copy the files like this:

```
cp -r /mnt/e/output-native/ ~/mims-install/
cd ~/mims-install/
```

### Step B.2.3 — Follow the Linux installation steps

From this point, follow **Appendix A, starting at Section A.6.3** (Create the .env file).

The script and all commands are identical:

```
cp .env.template .env
nano .env
# Fill in all values, save with Ctrl+O then Ctrl+X
sudo bash install-native.sh
```

### Step B.2.4 — Access the app

The app runs on port 80 inside WSL2. To reach it from other computers on the network, find the Windows IP address (not the WSL2 IP):

Open Windows Command Prompt and run:
```
ipconfig
```

Look for the IP address next to **"Ethernet adapter"** or **"Wi-Fi"** (e.g. `192.168.1.50`). Users on the network open `http://192.168.1.50` in their browser.

> **Note:** If the app is not reachable from other computers, you may need to add a Windows Firewall rule. Open PowerShell as Administrator and run:
> ```
> New-NetFirewallRule -DisplayName "M-IMS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
> ```

### Step B.2.5 — Make WSL2 start automatically on Windows boot

By default, WSL2 does not start automatically. To fix this:

1. Open Notepad and paste this content:
   ```
   @echo off
   wsl -d Ubuntu-22.04 -u root service postgresql start
   wsl -d Ubuntu-22.04 -u root service redis-server start
   wsl -d Ubuntu-22.04 -u root service nginx start
   wsl -d Ubuntu-22.04 -u root pm2 resurrect
   ```

2. Save the file as `C:\mims-startup.bat`

3. Press `Win + R`, type `shell:startup`, press Enter — this opens the Windows Startup folder

4. Create a shortcut to `C:\mims-startup.bat` in that folder

Now every time Windows starts, the app starts automatically.

---

## B.3 — Option 2: Native Windows (PowerShell Installer)

Use this only if WSL2 is not available (older Windows Server 2016, or WSL2 is blocked by IT policy).

### What gets installed

| Software | How | Purpose |
|---------|-----|---------|
| Chocolatey | PowerShell (auto) | Windows package manager |
| Node.js 20 | via Chocolatey | Runs backend and frontend |
| PM2 | via npm | Keeps apps running 24/7 |
| PostgreSQL 16 | via Chocolatey | Database |
| Redis for Windows | Downloaded from GitHub | Cache / sessions |
| Nginx | Downloaded from nginx.org | Web server on port 80 |
| NSSM | via Chocolatey | Runs Nginx as a Windows service |

All app files go to `C:\mims\`.

### Step B.3.1 — Copy USB files to the server

Plug in the USB. Copy the `output-native\` folder to `C:\mims-install\`.

You can use File Explorer (drag and drop) or a Command Prompt:
```
xcopy E:\output-native C:\mims-install\ /E /I
```

(Replace `E:` with your USB drive letter.)

### Step B.3.2 — Create the .env file

Open `C:\mims-install\` in File Explorer. Find `.env.template`.

Copy it and rename the copy to `.env` (no extension — just `.env`).

Open `.env` with Notepad and fill in all the values:

```
DATABASE_URL=postgresql://mims_user:YOUR_STRONG_PASSWORD@localhost:5432/mims_db
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
JWT_SECRET=<64 random characters>
NEXTAUTH_SECRET=<32 random characters>
NEXTAUTH_URL=http://YOUR_SERVER_IP
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
```

> **How to generate random secrets on Windows:**
> Open PowerShell and run:
> ```
> -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
> ```
> Copy the output and paste it as your JWT_SECRET.

Save the file.

### Step B.3.3 — Run the installer

Open **PowerShell as Administrator**:

```
Set-ExecutionPolicy Bypass -Scope Process -Force
cd C:\mims-install
.\install-windows.ps1
```

The script takes 5–15 minutes. You will see coloured messages. When it finishes you will see:

```
============================================================
  M-IMS Windows Installation Complete!
============================================================

  Access the app at:
    http://192.168.1.50
```

### Step B.3.4 — Place the license key

Copy `license.key` to the backend folder:

```
copy E:\license.key C:\mims\backend\license.key
```

Then restart the backend:

```
pm2 restart mims-backend
```

Wait 5 seconds and check status:

```
pm2 status
```

Both `mims-backend` and `mims-frontend` should show **online**.

---

## B.4 — Daily Operations (Windows)

The PM2 commands are the same on Windows as on Linux. Open **PowerShell** (does NOT need to be Administrator for PM2 commands):

### Check what is running

```
pm2 status
```

### View logs

```
pm2 logs mims-backend  --lines 50
pm2 logs mims-frontend --lines 50
```

### Restart a service

```
pm2 restart mims-backend
pm2 restart mims-frontend
pm2 restart all
```

### Stop everything

```
pm2 stop all
```

### Start everything again

```
pm2 start all
```

### Check Nginx service (Option 2 / Native Windows only)

Open **Services** (`Win + R` → type `services.msc` → Enter):
- Find `mims-nginx` — it should be **Running**
- Right-click → Start / Stop / Restart

Or from PowerShell:
```
Get-Service mims-nginx
Restart-Service mims-nginx
```

### Check PostgreSQL service

```
Get-Service postgresql*
```

### Check Redis service

```
Get-Service Redis
```

---

## B.5 — Database Backup (Windows)

### Manual backup (Option 2 — Native Windows)

Open PowerShell and run:

```
$date = Get-Date -Format "yyyyMMdd-HHmmss"
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
& "$pgBin\pg_dump.exe" -U mims_user -d mims_db -F c -f "C:\mims\backups\backup-$date.dump"
```

When prompted for a password, enter the `mims_user` password from your `.env` file.

Create the backups folder first if it doesn't exist:
```
New-Item -ItemType Directory -Path C:\mims\backups -Force
```

### Automatic nightly backup (Windows Task Scheduler)

1. Create a file `C:\mims\backup.ps1`:
   ```
   $date = Get-Date -Format "yyyyMMdd"
   $pgBin = "C:\Program Files\PostgreSQL\16\bin"
   $env:PGPASSWORD = "YOUR_MIMS_USER_PASSWORD"
   & "$pgBin\pg_dump.exe" -U mims_user -d mims_db -F c -f "C:\mims\backups\backup-$date.dump"
   ```

2. Open Task Scheduler (`Win + R` → `taskschd.msc`)
3. Click **Create Basic Task**
4. Name: `M-IMS Daily Backup`
5. Trigger: **Daily**, at 2:00 AM
6. Action: **Start a program** → `powershell.exe`
7. Arguments: `-NonInteractive -File "C:\mims\backup.ps1"`
8. Click Finish

### Manual backup (Option 1 — WSL2)

Open the Ubuntu terminal and run:
```
sudo -u postgres pg_dump mims_db | gzip > /opt/mims/backups/backup-$(date +%Y%m%d).sql.gz
```

---

## B.6 — Troubleshooting (Windows)

### "Running scripts is disabled on this system"

This means PowerShell execution policy is blocking the script. Run this first:

```
Set-ExecutionPolicy Bypass -Scope Process -Force
```

Then run the installer again.

---

### Backend crashes — "license.key not found"

```
pm2 logs mims-backend --lines 20
```

If you see `license.key not found`:

```
# Check if the file exists
Test-Path C:\mims\backend\license.key

# If it says False, copy it:
copy E:\license.key C:\mims\backend\license.key
pm2 restart mims-backend
```

---

### Port 80 not accessible from other computers

Check Windows Firewall:

```
Get-NetFirewallRule -DisplayName "M-IMS HTTP" -ErrorAction SilentlyContinue
```

If nothing is returned, add the rule:

```
New-NetFirewallRule -DisplayName "M-IMS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

---

### 502 Bad Gateway in browser

Nginx is running but the app is not. Check PM2:

```
pm2 status
pm2 restart all
```

---

### "npm is not recognised" or "node is not recognised" after install

The PATH was not refreshed. Close PowerShell and open a new one. If still not found:

```
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
```

---

### After Windows reboot, apps don't start

WSL2 path: Check that the `C:\mims-startup.bat` shortcut is in the Windows Startup folder (see Step B.2.5).

Native Windows path: PM2 startup may not be configured. Open PowerShell as Administrator:

```
pm2 resurrect
pm2 save
pm2-startup install
```

---

## B.7 — Quick Reference Card (Windows)

> Print this page and keep it at the server.

**PM2 commands (works in any PowerShell window):**
```
CHECK STATUS:         pm2 status
START ALL:            pm2 start all
STOP ALL:             pm2 stop all
RESTART ALL:          pm2 restart all
RESTART BACKEND:      pm2 restart mims-backend
RESTART FRONTEND:     pm2 restart mims-frontend
VIEW LOGS (BACKEND):  pm2 logs mims-backend --lines 50
VIEW LOGS (FRONTEND): pm2 logs mims-frontend --lines 50
LIVE LOG STREAM:      pm2 logs
CPU / MEMORY USAGE:   pm2 monit
```

**Windows service commands (PowerShell as Administrator):**
```
CHECK NGINX:          Get-Service mims-nginx
RESTART NGINX:        Restart-Service mims-nginx
CHECK POSTGRES:       Get-Service postgresql*
CHECK REDIS:          Get-Service Redis
```

**Other:**
```
SERVER IP ADDRESS:    ipconfig
HEALTH CHECK API:     Invoke-WebRequest http://localhost:3001/api/health
BACKUP DATABASE:      See Section B.5
APP FILES LOCATION:   C:\mims\
LOG FILES:            C:\mims\logs\
```
