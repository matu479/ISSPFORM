import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedServices: ReturnType<typeof createServices> | undefined;

function createServices() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Falta configurar Firebase: ${missing.join(', ')}. Revisá las variables NEXT_PUBLIC_FIREBASE_*.`,
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  return {
    app,
    db: getFirestore(app),
    auth: getAuth(app),
  };
}

export function getFirebaseServices() {
  cachedServices ??= createServices();
  return cachedServices;
}
