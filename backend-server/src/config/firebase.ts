import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let firebaseApp: admin.app.App | null = null;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/firebaseServiceAccount.json';

try {
  const resolvedPath = path.resolve(serviceAccountPath);
  if (fs.existsSync(resolvedPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase] Admin SDK initialized successfully.');
  } else {
    console.warn(`[Firebase] Service account file not found at ${resolvedPath}. Backend running in mock auth mode.`);
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Admin SDK:', error);
}

export const getAuth = () => {
  if (!firebaseApp) throw new Error('Firebase Admin SDK is not initialized.');
  return admin.auth();
};

export const getDb = () => {
  if (!firebaseApp) throw new Error('Firebase Admin SDK is not initialized.');
  return admin.firestore();
};

export default firebaseApp;
