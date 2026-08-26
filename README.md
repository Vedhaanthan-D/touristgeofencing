# Praesidia: Intelligent Tourist Safety & Emergency Management Portal

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-v5.1-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-v13+-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite-v7-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Praesidia** is an enterprise-grade, proactive tourist safety and emergency response web portal and backend API service. Designed specifically for high-risk, forest, remote, and ecologically sensitive tourist destinations, Praesidia equips government officials (Police Officers, Forest Officials, Immigration Officers, and Platform Administrators) with real-time geo-spatial monitoring, deterministic idle anomaly detection, dynamic geofence management, and automated Electronic First Information Report (E-FIR) generation.

---

## 📑 Table of Contents

- [Executive Summary](#-executive-summary)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Role-Based Access Control (RBAC) Matrix](#-role-based-access-control-rbac-matrix)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Environment Configuration](#-environment-configuration)
- [Getting Started](#-getting-started)
- [Provisioning Official Accounts](#-provisioning-official-accounts)
- [API Endpoints Overview](#-api-endpoints-overview)
- [Firestore Security Rules](#-firestore-security-rules)
- [Authors & Acknowledgments](#-authors--acknowledgments)

---

## 📌 Executive Summary

Tourist safety in remote and forested regions relies heavily on manual check-ins and phone-based SOS alerts. If a tourist becomes lost, incapacitated, or enters an unmapped high-risk zone without cellular network access, emergency response times degrade significantly.

**Praesidia** solves this through a multi-tier safety architecture:
1. **Digital Tourist Identity (DTID):** Secure UUIDv4 identifier linked to a privacy-preserving HMAC-SHA256 hashed Aadhaar key—zero plain-text identity storage in database collections.
2. **Deterministic Geofencing Engine:** Real-time Point-in-Polygon (Ray-Casting) spatial boundary monitoring.
3. **Stay-Point Idle Anomaly Detector:** Bounding-box and sliding-centroid distance checking to filter canopy-induced GPS jitter while catching true missing-person conditions.
4. **Role-Gated Authority Web Portal:** Dedicated React web interface tailored strictly for authorized law enforcement and government agencies.
5. **Automated E-FIR Pipeline:** Immediate legal case registration (`MIS/ALERT_ID/YEAR`) for unacknowledged critical safety incidents.

---

## ✨ Key Features

- 🛡️ **Defense-in-Depth RBAC:** Access rights strictly governed at three layers (Express API Middleware, Firestore Database Rules, and React Route Guards).
- 📍 **Dynamic Geofence Polygon Management:** Administrators can visually construct and modify low, medium, and high-risk restricted zone polygons on interactive satellite maps.
- 🚨 **Real-Time SOS & Panic Incident Triage:** Live Firestore stream integration pushes manual SOS alerts and automatic geofence/idle breaches instantly to police and forest dashboards.
- 🆔 **Immigration Tourist Check-In Registration:** Secure portal workflow enabling Immigration/Admin officers to onboard visiting tourists and issue Digital Tourist ID passes.
- 📑 **Automated E-FIR PDF Generation:** Instant generation of pre-populated emergency reports featuring tourist itinerary data, emergency contact details, and historical GPS centroid coordinates.

---

## 🏗 System Architecture

```
                                  +---------------------------------------+
                                  |    Tourist Mobile App (Flutter)       |
                                  +-------------------+-------------------+
                                                      |
                                                      | GPS Telemetry & SOS
                                                      v
+-----------------------------------------------------+-----------------------------------------------------+
|                                          FIREBASE INFRASTRUCTURE                                         |
|                                                                                                           |
|  +-----------------------------------+    +----------------------------------+    +--------------------+  |
|  |     Firebase Authentication       |    |         Cloud Firestore          |    |  Cloud Messaging   |  |
|  | (Custom Claims: role, dtid)       |    | (Real-time Live Operational DB)  |    |  (Push Alerts)     |  |
|  +-----------------+-----------------+    +----------------+-----------------+    +---------+----------+  |
+--------------------|---------------------------------------|--------------------------------|-------------+
                     |                                       |                                |
                     | ID Tokens & Claims                    | Live Listeners & Data          | Notifications
                     v                                       v                                v
+--------------------+---------------------------------------+--------------------------------+-------------+
|                                    PRAESIDIA AUTHORITY WEB PORTAL                                         |
|                                                                                                           |
|   +------------------------------------+                +---------------------------------------------+   |
|   |         Express REST API           |                |             React Web Dashboard             |   |
|   |  - Role Middlewares (Zod Validated)|                |  - Ocean-Travel Glassmorphism Design Theme  |   |
|   |  - HMAC-SHA256 DTID Generator      |                |  - Interactive Map & Polygon Geofencing     |   |
|   |  - Auto E-FIR Incident Pipeline    |                |  - Role-gated Route Views (AuthContext)     |   |
|   +------------------------------------+                +---------------------------------------------+   |
+-----------------------------------------------------------------------------------------------------------+
```

---

## 🔐 Role-Based Access Control (RBAC) Matrix

Praesidia enforces strict operational separation of duty:

| Endpoint / Feature Scope | Administrator | Police Officer | Forest Officer | Immigration Officer |
| :--- | :---: | :---: | :---: | :---: |
| **Register New Tourist (`/api/register`)** | ✅ | ❌ | ❌ | ✅ |
| **View Tourist Registry (`/api/tourists`)** | ✅ | ✅ | ✅ | ❌ |
| **Manage Restricted Zones (`/api/restricted-zones`)** | ✅ | ❌ | ❌ | ❌ |
| **View Restricted Zones** | ✅ | ✅ | ✅ | ❌ |
| **Real-Time SOS & Idle Incident Queue** | ✅ | ✅ | ✅ | ❌ |
| **Escalate Incident & File E-FIR** | ✅ | ✅ | ✅ | ❌ |
| **Assign Officer Roles (`/api/admin/set-role`)** | ✅ | ❌ | ❌ | ❌ |

---

## 📁 Repository Structure

```
touristgeofencing/
├── backend/
│   ├── firebase-config.js      # Firebase Admin SDK initialization & credentials setup
│   ├── index.js                # Express app entry point & REST route definitions
│   ├── middleware/
│   │   ├── authenticateToken.js # Firebase ID Token verification middleware
│   │   └── requireRole.js       # Express RBAC role validation middleware
│   ├── models/                 # Data schema validators (Zod) & helpers
│   ├── scripts/
│   │   └── setUserRole.js      # CLI utility to provision Custom User Claims for officers
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/                 # Static brand assets & logos
│   ├── src/
│   │   ├── components/         # Reusable glassmorphic UI components (Navbar, Cards, Alerts)
│   │   ├── context/            # AuthContext & DataContext state providers
│   │   ├── pages/              # Role-gated views (Dashboard, PanicAlerts, Registration, etc.)
│   │   ├── App.jsx             # Main router configuration & protected routes
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── README.md
└── firestore.rules             # Production security rules for Cloud Firestore
```

---

## ⚙️ Prerequisites

Before running the project locally, ensure you have the following installed:

- **Node.js**: `v18.x` or later
- **npm**: `v9.x` or later
- **Firebase Project**: An active Firebase project with **Firebase Authentication** and **Cloud Firestore** enabled.
- **Firebase Service Account Credentials**: Private key JSON file generated from Firebase Console (`Project Settings -> Service Accounts`).

---

## 🌐 Environment Configuration

### 1. Backend Environment Setup (`backend/.env`)

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
NODE_ENV=development

# HMAC Identity Salt (Required for Aadhaar DTID hashing)
HMAC_SECRET_KEY=your_super_secret_hmac_salt_key_here

# Firebase Admin Service Account Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-firebase-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### 2. Frontend Environment Setup (`frontend/.env`)

Create a `.env` file inside the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:5000/api

# Firebase Web App SDK Configuration
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

---

## 🚀 Getting Started

### 1. Install Backend Dependencies & Start Server

```bash
cd backend
npm install
npm run dev
```

The REST API server will launch at `http://localhost:5000`.

### 2. Install Frontend Dependencies & Start Dashboard

Open a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

The web portal application will launch at `http://localhost:5173`.

---

## 👤 Provisioning Official Accounts

Official accounts (Police, Forest, Immigration, Admin) cannot self-register. To provision official accounts:

1. Create the user's email & password in the **Firebase Console** (`Authentication -> Users -> Add User`).
2. Run the manual role assignment script from the `backend` directory:

```bash
cd backend
node scripts/setUserRole.js officer@police.gov.in police
```

Supported role options: `admin`, `police`, `forest`, `immigration`.

---

## 🔌 API Endpoints Overview

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tourist-login` | Public | Validates Email + DTID and returns short-lived custom token |
| `POST` | `/api/register` | Admin, Immigration | Registers tourist, hashes Aadhaar, issues Digital Tourist ID (DTID) |
| `GET` | `/api/tourists` | Admin, Police, Forest | Retrieves registered tourist registry |
| `GET` | `/api/panic-alerts` | Admin, Police, Forest | Retrieves active panic button emergency records |
| `GET` | `/api/safety-alerts` | Admin, Police, Forest | Retrieves automated geofence/idle safety breach alerts |
| `POST` | `/api/safety-alerts/:id/report-missing` | Admin, Police, Forest | Escalates alert to missing complaint and auto-generates E-FIR |
| `POST` | `/api/admin/set-role` | Admin | Admin endpoint to set/update custom claims for official accounts |

---

## 🔒 Firestore Security Rules

Deploy the included `firestore.rules` file to enforce database-level authorization:

```bash
firebase deploy --only firestore:rules
```

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOfficial() {
      return request.auth != null && 
             request.auth.token.role in ['admin', 'police', 'forest'];
    }

    function isAdmin() {
      return request.auth != null && request.auth.token.role == 'admin';
    }

    match /tourists/{dtid} {
      allow read: if isOfficial();
      allow write: if false; // Writes strictly executed via Backend Admin SDK
    }

    match /panic_alert_emergencies/{docId} {
      allow read: if isOfficial();
      allow create: if request.auth != null &&
                       request.auth.token.role == 'tourist' &&
                       request.resource.data.dtid == request.auth.token.dtid;
      allow update, delete: if false;
    }

    match /safety_alerts/{docId} {
      allow read: if isOfficial();
      allow create: if request.auth != null &&
                       request.auth.token.role == 'tourist' &&
                       request.resource.data.dtid == request.auth.token.dtid;
      allow update, delete: if false;
    }

    match /restricted_zones/{docId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

---

## 👥 Authors & Acknowledgments

**Development Team:**
- **Vedhaanthan D**
- **Kamalesh K**
