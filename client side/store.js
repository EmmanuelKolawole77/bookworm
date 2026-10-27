import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { SEED_BOOKS, SEED_REVIEWS } from "./books-seed.js";

const FB = "https://www.gstatic.com/firebasejs/10.14.1";
export const mode = isFirebaseConfigured ? "firebase" : "demo";

let fb = null; // holds the Firebase modules and instances

export async function init() {
  if (mode !== "firebase") return;
  const [app, auth, fs] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`)
  ]);
  const appInstance = app.initializeApp(firebaseConfig);
  fb = { auth, fs, a: auth.getAuth(appInstance), db: fs.getFirestore(appInstance) };
}

/* ------------------------------ helpers ------------------------------ */

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const friendly = (err) => {
  const code = err && err.code ? err.code : "";
  const map = {
    "auth/invalid-credential": "Email or password is not right.",
    "auth/wrong-password": "Email or password is not right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/email-already-in-use": "That email already has an account. Try logging in.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/invalid-email": "That email address does not look right.",
    "auth/popup-closed-by-user": "The Google window was closed before finishing.",
    "auth/too-many-requests": "Too many tries. Please wait a moment and try again.",
    "auth/network-request-failed": "Network problem. Check your connection."
  };
  return new Error(map[code] || err.message || "Something went wrong.");
};

/* ------------------------------ auth ------------------------------ */

const demoListeners = new Set();
const demoSession = () => read("iwe_session", null);
const notifyDemo = () => demoListeners.forEach((cb) => cb(demoSession()));

export function onAuth(callback) {
  if (mode === "firebase") {
    return fb.auth.onAuthStateChanged(fb.a, async (u) => {
      if (!u) return callback(null);
      callback({ uid: u.uid, name: u.displayName || u.email.split("@")[0], email: u.email });
    });
  }
  demoListeners.add(callback);
  callback(demoSession());
  return () => demoListeners.delete(callback);
}

export async function signUp(name, email, password) {
  try {
    if (mode === "firebase") {
      const cred = await fb.auth.createUserWithEmailAndPassword(fb.a, email, password);
      await fb.auth.updateProfile(cred.user, { displayName: name });
      await fb.fs.setDoc(fb.fs.doc(fb.db, "users", cred.user.uid), {
        name, email, role: "customer", cart: [], createdAt: fb.fs.serverTimestamp()
      });
      return { uid: cred.user.uid, name, email };
    }
    const users = read("iwe_users", {});
    const key = email.toLowerCase();
    if (users[key]) throw { code: "auth/email-already-in-use" };
    if (password.length < 6) throw { code: "auth/weak-password" };
    const user = { uid: "demo-" + Date.now(), name, email: key };
    users[key] = { ...user, hash: await sha256(password) };
    write("iwe_users", users);
    write("iwe_session", user);
    notifyDemo();
    return user;
  } catch (e) { throw friendly(e); }
}

export async function logIn(email, password) {
  try {
    if (mode === "firebase") {
      const cred = await fb.auth.signInWithEmailAndPassword(fb.a, email, password);
      return { uid: cred.user.uid, name: cred.user.displayName, email: cred.user.email };
    }
    const users = read("iwe_users", {});
    const record = users[email.toLowerCase()];
    if (!record || record.hash !== (await sha256(password))) throw { code: "auth/invalid-credential" };
    const user = { uid: record.uid, name: record.name, email: record.email };
    write("iwe_session", user);
    notifyDemo();
    return user;
  } catch (e) { throw friendly(e); }
}

export async function logInGoogle() {
  if (mode !== "firebase") throw new Error("Google sign-in needs Firebase. Add your config in js/firebase-config.js.");
  try {
    const provider = new fb.auth.GoogleAuthProvider();
    const cred = await fb.auth.signInWithPopup(fb.a, provider);
    const ref = fb.fs.doc(fb.db, "users", cred.user.uid);
    const snap = await fb.fs.getDoc(ref);
    if (!snap.exists()) {
      await fb.fs.setDoc(ref, {
        name: cred.user.displayName || "", email: cred.user.email,
        role: "customer", cart: [], createdAt: fb.fs.serverTimestamp()
      });
    }
    return { uid: cred.user.uid, name: cred.user.displayName, email: cred.user.email };
  } catch (e) { throw friendly(e); }
}

export async function resetPassword(email) {
  if (mode !== "firebase") throw new Error("Password reset needs Firebase. In demo mode, create a new account instead.");
  try { await fb.auth.sendPasswordResetEmail(fb.a, email); } catch (e) { throw friendly(e); }
}

export async function logOut() {
  if (mode === "firebase") return fb.auth.signOut(fb.a);
  localStorage.removeItem("iwe_session");
  notifyDemo();
}

/* ------------------------------ books ------------------------------ */

export async function getBooks() {
  if (mode === "firebase") {
    try {
      const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, "books"));
      const books = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (books.length) return books;
    } catch (e) { console.warn("Could not read books from Firestore, using starter list.", e); }
  }
  return SEED_BOOKS;
}

export async function seedBooks() {
  if (mode !== "firebase") return console.log("Demo mode: books already come from books-seed.js");
  for (const b of SEED_BOOKS) {
    const { id, ...data } = b;
    await fb.fs.setDoc(fb.fs.doc(fb.db, "books", id), data);
  }
  console.log(`Seeded ${SEED_BOOKS.length} books.`);
}

/* ------------------------------ reviews ------------------------------ */

export async function getReviews() {
  if (mode === "firebase") {
    try {
      const q = fb.fs.query(fb.fs.collection(fb.db, "reviews"), fb.fs.orderBy("createdAt", "desc"), fb.fs.limit(9));
      const snap = await fb.fs.getDocs(q);
      const list = snap.docs.map((d) => d.data());
      if (list.length) return list;
    } catch (e) { console.warn("Could not read reviews.", e); }
    return SEED_REVIEWS;
  }
  return [...read("iwe_reviews", []), ...SEED_REVIEWS].slice(0, 9);
}

export async function addReview(user, rating, text) {
  const review = { uid: user.uid, name: user.name, rating, text };
  if (mode === "firebase") {
    try {
      await fb.fs.addDoc(fb.fs.collection(fb.db, "reviews"), { ...review, createdAt: fb.fs.serverTimestamp() });
    } catch (e) { throw friendly(e); }
    return;
  }
  write("iwe_reviews", [review, ...read("iwe_reviews", [])]);
}

/* ------------------------------ cart ------------------------------ */

// Cart items are stored as [{ id, qty }]. Guests use localStorage.
// Signed-in customers also get a copy in their Firestore profile.
export const loadLocalCart = () => read("iwe_cart", []);
export const saveLocalCart = (cart) => write("iwe_cart", cart);

export async function loadRemoteCart(user) {
  if (mode !== "firebase" || !user) return null;
  try {
    const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, "users", user.uid));
    return snap.exists() ? snap.data().cart || [] : [];
  } catch { return null; }
}

export async function saveRemoteCart(user, cart) {
  if (mode !== "firebase" || !user) return;
  try { await fb.fs.setDoc(fb.fs.doc(fb.db, "users", user.uid), { cart }, { merge: true }); } catch (e) { console.warn(e); }
}

/* ------------------------------ orders ------------------------------ */

export async function createOrder(user, order) {
  const record = { ...order, uid: user.uid, email: user.email, status: "paid" };
  if (mode === "firebase") {
    try {
      const ref = await fb.fs.addDoc(fb.fs.collection(fb.db, "orders"), { ...record, createdAt: fb.fs.serverTimestamp() });
      return ref.id;
    } catch (e) { throw friendly(e); }
  }
  const id = "ORD-" + Date.now().toString(36).toUpperCase();
  const all = read("iwe_orders", []);
  all.unshift({ ...record, id, createdAt: new Date().toISOString() });
  write("iwe_orders", all);
  return id;
}

export async function getOrders(user) {
  if (mode === "firebase") {
    try {
      const q = fb.fs.query(fb.fs.collection(fb.db, "orders"), fb.fs.where("uid", "==", user.uid));
      const snap = await fb.fs.getDocs(q);
      return snap.docs
        .map((d) => {
          const data = d.data();
          const when = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null;
          return { id: d.id, ...data, createdAt: when };
        })
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    } catch (e) { console.warn(e); return []; }
  }
  return read("iwe_orders", []).filter((o) => o.uid === user.uid);
}
