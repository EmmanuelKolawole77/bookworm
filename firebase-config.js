// =====================================================================
// Firebase setup
// 1. Go to https://console.firebase.google.com and create a project.
// 2. Add a Web app (</> icon) and copy the config object it shows you.
// 3. Paste the values below.
// 4. Enable Authentication > Sign-in method > Email/Password (and Google).
// 5. Create a Firestore database, then paste firestore.rules into its Rules tab.
//
// Until you do this, the site runs in DEMO MODE: books come from
// books-seed.js, and accounts, cart and orders are stored in the
// browser only. Nothing breaks.
// =====================================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Paystack PUBLIC test key (starts with pk_test_). Safe to put in the browser.
export const PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxx";

export const DELIVERY_FEE = 2500; // naira
export const FREE_DELIVERY_OVER = 40000; // naira

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");
