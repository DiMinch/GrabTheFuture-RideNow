import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let firebaseApp: admin.app.App | null = null;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/firebaseServiceAccount.json';

try {
  const resolvedPath = path.resolve(serviceAccountPath);
  
  if (fs.existsSync(resolvedPath)) {
    // Trường hợp 1: Có file JSON (Thường dùng cho môi trường Local)
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase] Admin SDK initialized with service account.');
  } else {
    // Trường hợp 2: Không có file JSON (Tự động dùng quyền của Cloud Functions/Service Account mặc định)
    firebaseApp = admin.initializeApp();
    console.log('[Firebase] Admin SDK initialized with default credentials.');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Admin SDK:', error);
}

// Giữ lại các hàm helper của bạn, chúng đã rất ổn!
export const getAuth = () => {
  if (!firebaseApp) throw new Error('Firebase Admin SDK is not initialized.');
  return admin.auth();
};

export const getDb = () => {
  if (!firebaseApp) throw new Error('Firebase Admin SDK is not initialized.');
  return admin.firestore();
};

export default firebaseApp;