const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK using service account file
// You can also use environment variables if preferred
let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Use service account file path
  credential = admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  // Use JSON string or object from environment variable
  try {
    const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT_KEY === 'string'
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    credential = admin.credential.cert(serviceAccount);
  } catch (parseError) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from environment:', parseError.message);
    throw parseError;
  }
} else if (process.env.FIREBASE_PRIVATE_KEY) {
  // Use environment variables
  const serviceAccount = {
    "type": "service_account",
    "project_id": process.env.FIREBASE_PROJECT_ID || "sih-tourist-safety-20385",
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
    "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "client_id": process.env.FIREBASE_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL
  };
  credential = admin.credential.cert(serviceAccount);
} else {
  // Fallback: try to use default service account from firebase-service-account.json location
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    credential = admin.credential.cert(serviceAccountPath);
  } else {
    console.error('\n❌ Firebase credential not found. Please set up Firebase service account credentials.');
    console.error('You can do one of the following:');
    console.error('1. Place "firebase-service-account.json" inside the backend folder:');
    console.error(`   ${serviceAccountPath}`);
    console.error('2. Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env pointing to your service account JSON file');
    console.error('3. Set FIREBASE_SERVICE_ACCOUNT_KEY in backend/.env with your JSON content');
    console.error('4. Set individual Firebase environment variables (FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, etc.) in backend/.env\n');
    throw new Error(`Firebase service account credential file missing. Please add firebase-service-account.json to ${__dirname} or configure .env`);
  }
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: credential,
  projectId: "sih-tourist-safety-20385"
});

// Get Firestore database instance 
const db = admin.firestore();

module.exports = { admin, db };