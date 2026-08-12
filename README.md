# Tourist Safety & Digital Tourist ID (DTID) Geofencing System

A production-ready Node.js/Express + Firebase Admin backend and React/Vite frontend application for registering tourists, issuing Digital Tourist IDs (DTID), real-time geofence safety monitoring, and emergency response management.

## 🚀 Key Features

- **DTID Registration & Verification**: Secure traveler registration with full Aadhaar/Passport PII hashing (`HMAC-SHA256`) and masked display (`•••• •••• 1234`).
- **Zero-Trust Security**: Server-side request validation using **Zod** schema enforcement and Firebase Auth JWT token authentication for administrative routes.
- **Real-time SOS Alert System**: Instant emergency notification triggers using Firebase Firestore `onSnapshot` real-time listeners (no HTTP polling overhead).
- **Spark Plan Optimized Data Pipeline**: Centralized state management via `DataContext` with query limits (`limit(50)`) and cursor pagination to preserve cloud quota limits.
- **Geofence Safety Dashboard**: Interactive regional map grids, active traveler status tracking, and automated overdue check-out detection.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS Design System, Firebase Auth & Firestore Client SDK.
- **Backend**: Node.js, Express.js, Firebase Admin SDK, Zod, Crypto (HMAC-SHA256), Express Rate Limit.
- **Authentication**: Firebase Auth with JWT bearer tokens for secure official/admin access.

---

## 📋 Prerequisites & Setup

### 1. Environment Configuration

Create a `.env` file in `/backend`:
```env
PORT=3000
AADHAAR_HMAC_SECRET=your_secure_random_hmac_secret_key
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

Create a `.env` file in `/frontend`:
```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

### 2. Installation

In `/backend`:
```bash
npm install
npm run dev
```

In `/frontend`:
```bash
npm install
npm run dev
```

---

## 🔒 Security Architecture Highlights

1. **PII Data Protection**: Sensitive Aadhaar and Passport numbers are hashed with server-side `HMAC-SHA256` secrets prior to database persistence. Only masked last-4 digits are retained for display.
2. **Server-Side Input Sanitization**: All registration payloads are validated against strict Zod schemas on the backend API prior to processing.
3. **Restricted CORS Policy**: Wildcard (`*`) origin access is disallowed; strict origin whitelisting is required for cross-domain requests.
4. **Token-Gated Routes**: Critical admin endpoints (`/api/tourists`, `/api/panic-alerts`, `/api/safety-alerts`) enforce Firebase Auth Bearer token verification.
