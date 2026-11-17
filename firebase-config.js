/**
 * AEGIS LEARNING ACADEMY - FIREBASE WEB CONFIGURATION
 *
 * Replace the placeholder values below with your Firebase Web App config
 * from Firebase Console -> Project settings -> Your apps -> Web app.
 *
 * Note: Firebase web configuration values are public by design.
 * Data protection and role access are enforced on the server by
 * Cloud Firestore Security Rules (firebase/firestore.rules).
 */

export const FIREBASE_SDK_VERSION = '13.2.0';

export const firebaseConfig = {
  apiKey: 'AIzaSyD0XotI1hJhhnGzK5oy0Vabr_wrVBrkUrc',
  authDomain: 'podcasts-ad513.firebaseapp.com',
  projectId: 'podcasts-ad513',
  storageBucket: 'podcasts-ad513.firebasestorage.app',
  messagingSenderId: '311567201838',
  appId: '1:311567201838:web:69d8147083d479650711bf'
};

export function isFirebaseConfigured(config = firebaseConfig) {
  if (!config || typeof config !== 'object') return false;
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return requiredKeys.every((key) => {
    const val = String(config[key] || '').trim();
    return (
      val.length > 0 &&
      !val.startsWith('YOUR_') &&
      !val.startsWith('REPLACE_') &&
      !val.includes('YOUR_PROJECT_ID')
    );
  });
}
