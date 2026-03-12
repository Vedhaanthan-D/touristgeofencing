const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK using service account file
// You can also use environment variables if preferred
let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Use service account file path
  credential = admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
} else if (process.env.FIREBASE_PRIVATE_KEY) {
  // Use environment variables
  const serviceAccount = {
    "type": "service_account",
    "project_id": "sih-tourist-safety-20385",
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
  try {
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    credential = admin.credential.cert(serviceAccountPath);
  } catch (error) {
    console.error('Firebase credential not found. Please set up Firebase service account credentials.');
    console.error('You can either:');
    console.error('1. Set FIREBASE_SERVICE_ACCOUNT_PATH environment variable');
    console.error('2. Set individual Firebase environment variables');
    console.error('3. Place firebase-service-account.json in the backend folder');
    throw error;
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