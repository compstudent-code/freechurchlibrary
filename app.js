import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailLink,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const STORAGE_KEYS = {
  email: "church-library-signin-email",
  name: "church-library-signin-name",
  phone: "church-library-signin-phone"
};
const screens = [
  "loading-screen", "config-screen", "auth-screen", "pending-screen",
  "denied-screen", "member-screen", "admin-screen"
];
const colorPattern = /^#[0-9a-fA-F]{6}$/;

let firebaseConfig;
let auth;
let db;
let signedInUser;
let currentMember;
let books = [];
let activeLoans = [];
let accessRequests = [];
let churchSettings = {};

const byId = (id) => document.getElementById(id);
const notice = byId("notice");

function showScreen(name) {
  for (const id of screens) byId(id).classList.toggle("hidden", id !== name);
  byId("sign-out-button").classList.toggle("hidden", !signedInUser);
  byId("footer-change-church").classList.toggle("hidden", !firebaseConfig || Boolean(signedInUser));
}

function showNotice(message, type = "info") {
  notice.textContent = message;
  notice.className = `notice ${type}`;
}

function clearNotice() {
  notice.textContent = "";
  notice.className = "notice hidden";
}

function userMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication. Add it in the Firebase console and try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled for this church's Firebase project.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before sign-in finished.",
    "auth/network-request-failed": "A network error interrupted the request. Check your connection and try again.",
    "permission-denied": "Firebase blocked this action. Check that the Firestore rules are deployed and your account has the required access.",
    "unavailable": "Firebase is temporarily unavailable. Please try again."
  };
  return messages[code] || error?.message || "Something went wrong. Please try again.";
}

async function runAction(action) {
  clearNotice();
  try {
    await action();
  } catch (error) {
    console.error(error);
    showNotice(userMessage(error), "error");
  }
}

function clearProfileDraft() {
  localStorage.removeItem(STORAGE_KEYS.email);
  localStorage.removeItem(STORAGE_KEYS.name);
  localStorage.removeItem(STORAGE_KEYS.phone);
}

function validFirebaseConfig(config) {
  if (!config || typeof config !== "object") return false;
  const { apiKey, authDomain, projectId, appId } = config;
  if (typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 256) return false;
  if (typeof authDomain !== "string" ||
      !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))+$/.test(authDomain)) return false;
  if (typeof projectId !== "string" || !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return false;
  if (typeof appId !== "string" ||
      !/^\d+:[\w-]+:(?:web|ios|android):[\w-]+$/.test(appId) || appId.length > 256) return false;
  for (const [key, value] of Object.entries(config)) {
    if (value == null || value === "") continue;
    const maxLength = key === "databaseURL" ? 2048 : 256;
    if (typeof value !== "string" || value !== value.trim() || value.length > maxLength ||
        /[\u0000-\u0020\u007f]/.test(value)) return false;
  }
  if (config.messagingSenderId && !/^\d+$/.test(config.messagingSenderId)) return false;
  if (config.databaseURL) {
    try {
      const url = new URL(config.databaseURL);
      if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    } catch {
      return false;
    }
  }
  return true;
}

function readFirebaseConfigFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const config = {};
  for (const key of ["apiKey", "authDomain", "projectId", "appId", "storageBucket", "messagingSenderId", "measurementId", "databaseURL"]) {
    const value = params.get(key);
    if (value) config[key] = value.trim();
  }
  return config;
}

function showFirebaseConfigForm(config = {}) {
  for (const key of ["projectId", "apiKey", "authDomain", "appId", "storageBucket", "messagingSenderId", "measurementId", "databaseURL"]) {
    const input = byId(`firebase-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    if (input) input.value = config[key] || "";
  }
  showScreen("config-screen");
}

function setBranding(settings) {
  const name = typeof settings.name === "string" && settings.name.trim()
    ? settings.name.trim().slice(0, 100)
    : "Church Library";
  byId("church-name").textContent = name;
  document.title = `${name} | Church Library`;
  const theme = settings.theme && typeof settings.theme === "object" ? settings.theme : {};
  const root = document.documentElement;
  if (colorPattern.test(theme.primary || "")) root.style.setProperty("--primary", theme.primary);
  if (colorPattern.test(theme.accent || "")) root.style.setProperty("--accent", theme.accent);
  if (colorPattern.test(theme.background || "")) root.style.setProperty("--page", theme.background);
  if (colorPattern.test(theme.surface || "")) root.style.setProperty("--surface", theme.surface);
  if (colorPattern.test(theme.text || "")) root.style.setProperty("--ink", theme.text);
}

async function connectToChurch(config) {
  if (!validFirebaseConfig(config)) throw new Error("Enter a valid Firebase API key, auth domain, project ID, and app ID.");
  firebaseConfig = { ...config };
  showScreen("loading-screen");
  const appName = `church-library-${config.projectId}`;
  const app = getApps().find((candidate) => candidate.name === appName) || initializeApp(config, appName);
  auth = getAuth(app);
  db = getFirestore(app);
  await setPersistence(auth, browserLocalPersistence);

  try {
    const settingsSnapshot = await getDoc(doc(db, "settings", "public"));
    if (settingsSnapshot.exists()) {
      churchSettings = settingsSnapshot.data();
      setBranding(churchSettings);
    } else {
      showNotice("This church project is connected, but its public settings document is not set up. See README.md for setup.", "error");
    }
  } catch (error) {
    console.error(error);
    showNotice(`Connected to ${config.projectId}, but could not load church details. Verify the Firestore database and deployed rules. ${userMessage(error)}`, "error");
  }

  await completeEmailLinkIfPresent();
  auth.onAuthStateChanged((user) => {
    signedInUser = user;
    if (!user) {
      showScreen("auth-screen");
      return;
    }
    void runAction(() => loadAccount(user));
  });
}

async function completeEmailLinkIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;
  let email = localStorage.getItem(STORAGE_KEYS.email);
  if (!email) email = window.prompt("Enter the email address where you received the sign-in link:");
  if (!email) {
    showNotice("Enter the same email address that received the sign-in link to finish signing in.", "error");
    return;
  }
  const credential = await signInWithEmailLink(auth, email, window.location.href);
  localStorage.removeItem(STORAGE_KEYS.email);
  const returnUrl = new URL(window.location.pathname, window.location.origin);
  for (const [key, value] of Object.entries(firebaseConfig || {})) returnUrl.searchParams.set(key, value);
  window.history.replaceState({}, document.title, returnUrl);
  const name = localStorage.getItem(STORAGE_KEYS.name) ||
    credential.user.displayName ||
    window.prompt("What name should the library use for your account?") ||
    "";
  await submitAccessRequest(credential.user, {
    name,
    phone: localStorage.getItem(STORAGE_KEYS.phone) || ""
  });
  clearProfileDraft();
}

function collectFormProfile() {
  const phone = byId("member-phone").value.trim();
  if (!/^[0-9+(). -]{0,32}$/.test(phone)) {
    throw new Error("Enter a valid phone number, or leave this field blank.");
  }
  return {
    name: byId("member-name").value.trim(),
    email: byId("member-email").value.trim(),
    phone
  };
}

async function submitAccessRequest(user, profile) {
  if (!user.email || !user.emailVerified) {
    throw new Error("A verified email address is required to request library access.");
  }
  const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
  if (adminSnapshot.exists()) return;
  const accessRef = doc(db, "access", user.uid);
  const accessSnapshot = await getDoc(accessRef);
  if (accessSnapshot.exists()) return;

  const requestRef = doc(db, "accessRequests", user.uid);
  const requestSnapshot = await getDoc(requestRef);
  if (requestSnapshot.exists()) return;

  const name = (profile.name || user.displayName || "").trim();
  if (!name) throw new Error("Please provide your name before continuing.");
  await setDoc(requestRef, {
    uid: user.uid,
    displayName: name.slice(0, 100),
    email: user.email.slice(0, 254),
    phone: (profile.phone || "").trim().slice(0, 32),
    status: "pending",
    requestedAt: serverTimestamp()
  });
}

async function loadAccount(user) {
  if (!user.emailVerified) {
    showNotice("This library requires a verified email address. Sign in with Google or use the email link sent to your inbox.", "error");
    await signOut(auth);
    return;
  }
  const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
  if (adminSnapshot.exists()) {
    clearProfileDraft();
    byId("admin-greeting").textContent = `Welcome, ${adminSnapshot.data().displayName || user.displayName || "Administrator"}`;
    showScreen("admin-screen");
    await loadAdminData();
    return;
  }

  await submitAccessRequest(user, {
    name: localStorage.getItem(STORAGE_KEYS.name) || user.displayName || "",
    phone: localStorage.getItem(STORAGE_KEYS.phone) || ""
  });
  clearProfileDraft();
  const accessSnapshot = await getDoc(doc(db, "access", user.uid));
  if (!accessSnapshot.exists()) {
    showScreen("pending-screen");
    return;
  }
  const access = accessSnapshot.data();
  if (access.status === "denied") {
    showScreen("denied-screen");
    return;
  }
  if (access.status !== "approved") {
    showScreen("pending-screen");
    return;
  }
  const memberSnapshot = await getDoc(doc(db, "members", user.uid));
  if (!memberSnapshot.exists()) throw new Error("Your approved member profile is missing. Ask a library administrator to check the account.");
  currentMember = memberSnapshot.data();
  byId("member-greeting").textContent = `Welcome, ${currentMember.displayName}`;
  byId("profile-name").value = currentMember.displayName || "";
  byId("profile-phone").value = currentMember.phone || "";
  showScreen("member-screen");
  await loadCatalog();
}

async function loadCatalog() {
  const snapshot = await getDocs(collection(db, "books"));
  books = snapshot.docs.map((book) => ({ id: book.id, ...book.data() }))
    .filter((book) => book.active !== false)
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  renderCatalog();
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderCatalog() {
  const list = byId("catalog-list");
  list.replaceChildren();
  const term = byId("catalog-search").value.trim().toLowerCase();
  const shown = books.filter((book) =>
    `${book.title || ""} ${book.author || ""}`.toLowerCase().includes(term));
  for (const book of shown) {
    const card = createElement("article", "book-card");
    const cover = createElement("div", "book-cover", (book.title || "?").slice(0, 1).toUpperCase());
    cover.setAttribute("aria-hidden", "true");
    const title = createElement("h2", "", book.title || "Untitled");
    const author = createElement("p", "book-author", book.author ? `by ${book.author}` : "Author not listed");
    const meta = createElement("div", "book-meta");
    const available = Number.isInteger(book.availableCopies) ? book.availableCopies : 0;
    const stock = createElement("span", `availability${available < 1 ? " unavailable" : ""}`, available > 0 ? `${available} available` : "All checked out");
    const checkout = createElement("button", "button button-primary", "Check out");
    checkout.type = "button";
    checkout.disabled = available < 1;
    checkout.addEventListener("click", () => void runAction(() => checkoutBook(book)));
    meta.append(stock, checkout);
    card.append(cover, title, author, meta);
    list.append(card);
  }
  byId("catalog-empty").classList.toggle("hidden", shown.length > 0);
  byId("member-count").textContent = `${books.length} ${books.length === 1 ? "book" : "books"} in the catalog`;
}

async function checkoutBook(book) {
  const checkoutId = `${book.id}_${signedInUser.uid}`;
  const bookRef = doc(db, "books", book.id);
  const checkoutRef = doc(db, "checkouts", checkoutId);
  await runTransaction(db, async (transaction) => {
    const [bookSnapshot, checkoutSnapshot] = await Promise.all([
      transaction.get(bookRef), transaction.get(checkoutRef)
    ]);
    if (!bookSnapshot.exists()) throw new Error("This book is no longer in the catalog.");
    const current = bookSnapshot.data();
    const previous = checkoutSnapshot.exists() ? checkoutSnapshot.data() : null;
    if (!Number.isInteger(current.availableCopies) || current.availableCopies < 1) {
      throw new Error("This book has just been checked out by someone else.");
    }
    if (previous?.status === "active") throw new Error("You already have this book checked out.");
    transaction.update(bookRef, { availableCopies: current.availableCopies - 1, updatedAt: serverTimestamp() });
    transaction.set(checkoutRef, {
      bookId: book.id,
      bookTitle: current.title || "Untitled",
      uid: signedInUser.uid,
      memberName: currentMember.displayName,
      memberEmail: signedInUser.email,
      status: "active",
      checkedOutAt: serverTimestamp(),
      returnedAt: null,
      memberPhone: currentMember.phone || ""
    });
  });
  showNotice(`“${book.title || "Book"}” has been checked out to you.`, "success");
  await loadCatalog();
}

async function saveProfile(event) {
  event.preventDefault();
  const displayName = byId("profile-name").value.trim();
  const phone = byId("profile-phone").value.trim();
  if (!displayName) throw new Error("Enter your name.");
  if (!/^[0-9+(). -]{0,32}$/.test(phone)) throw new Error("Enter a valid phone number, or leave this field blank.");
  await updateDoc(doc(db, "members", signedInUser.uid), {
    displayName: displayName.slice(0, 100),
    phone: phone.slice(0, 32),
    updatedAt: serverTimestamp()
  });
  currentMember.displayName = displayName;
  currentMember.phone = phone;
  byId("member-greeting").textContent = `Welcome, ${displayName}`;
  showNotice("Your contact information has been saved.", "success");
}

function createAdminCard(title, description) {
  const card = createElement("article", "admin-card");
  card.append(createElement("h2", "", title));
  if (description) card.append(createElement("p", "muted", description));
  return card;
}

function renderRequests() {
  const panel = byId("admin-requests-panel");
  panel.replaceChildren();
  byId("request-count").textContent = String(accessRequests.filter((item) => item.status === "pending").length);
  const pending = accessRequests.filter((item) => item.status === "pending");
  if (!pending.length) {
    panel.append(createAdminCard("No pending requests", "New member access requests will appear here."));
    return;
  }
  for (const request of pending) {
    const card = createAdminCard("", "");
    card.firstElementChild.remove();
    const row = createElement("div", "request-row");
    const info = createElement("div", "request-info");
    info.append(createElement("h2", "", request.displayName || "Name not provided"));
    info.append(createElement("p", "", request.email || "No email"));
    if (request.phone) info.append(createElement("p", "", `Phone: ${request.phone}`));
    const actions = createElement("div", "action-row");
    const approve = createElement("button", "button button-primary", "Approve");
    const deny = createElement("button", "button button-danger", "Decline");
    approve.type = "button";
    deny.type = "button";
    approve.addEventListener("click", () => void runAction(() => approveRequest(request)));
    deny.addEventListener("click", () => void runAction(() => denyRequest(request)));
    actions.append(approve, deny);
    row.append(info, actions);
    card.append(row);
    panel.append(card);
  }
}

async function denyRequest(request) {
  const batch = writeBatch(db);
  batch.set(doc(db, "access", request.uid), {
    status: "denied",
    reviewedAt: serverTimestamp(),
    reviewedBy: signedInUser.uid
  });
  batch.update(doc(db, "accessRequests", request.uid), {
    status: "denied", reviewedAt: serverTimestamp(), reviewedBy: signedInUser.uid
  });
  await batch.commit();
  await loadAdminData();
}

async function approveRequest(request) {
  const batch = writeBatch(db);
  batch.set(doc(db, "members", request.uid), {
    displayName: request.displayName,
    email: request.email,
    phone: request.phone || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, "access", request.uid), {
    status: "approved",
    approvedAt: serverTimestamp(),
    approvedBy: signedInUser.uid
  });
  batch.update(doc(db, "accessRequests", request.uid), {
    status: "approved", reviewedAt: serverTimestamp(), reviewedBy: signedInUser.uid
  });
  await batch.commit();
  await loadAdminData();
}

function renderAdminBooks() {
  const panel = byId("admin-books-panel");
  panel.replaceChildren();
  const card = createAdminCard("Add a book", "Add books to the catalog. Availability begins at the number of copies entered.");
  const form = createElement("form", "add-book-form");
  const fields = [
    ["title", "Book title", "text"],
    ["author", "Author", "text"],
    ["isbn", "ISBN (optional)", "text"],
    ["copies", "Number of copies", "number"]
  ];
  for (const [name, labelText, type] of fields) {
    const label = createElement("label", "", labelText);
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    input.required = name === "title" || name === "copies";
    input.maxLength = name === "copies" ? 3 : name === "isbn" ? 32 : 120;
    if (name === "copies") {
      input.min = "1";
      input.max = "500";
      input.value = "1";
    }
    label.append(input);
    form.append(label);
  }
  const add = createElement("button", "button button-primary", "Add to catalog");
  add.type = "submit";
  form.append(add);
  form.addEventListener("submit", (event) => void runAction(async () => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const author = String(data.get("author") || "").trim();
    const isbn = String(data.get("isbn") || "").trim();
    const copies = Number(data.get("copies"));
    if (!title || !Number.isInteger(copies) || copies < 1 || copies > 500) throw new Error("Enter a title and a whole number of copies from 1 to 500.");
    const bookId = crypto.randomUUID();
    await setDoc(doc(db, "books", bookId), {
      title: title.slice(0, 160),
      author: author.slice(0, 120),
      isbn: isbn.slice(0, 32),
      totalCopies: copies,
      availableCopies: copies,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    form.reset();
    form.elements.copies.value = "1";
    await loadAdminData();
    showNotice("The book was added to the catalog.", "success");
  }));
  card.append(form);

  const catalogCard = createAdminCard("Catalog", "");
  const list = createElement("div", "catalog-admin-list");
  if (!books.length) list.append(createElement("p", "muted", "No books have been added yet."));
  for (const book of books) {
    const row = createElement("div", "catalog-admin-row");
    const info = document.createElement("div");
    info.append(createElement("strong", "", book.title || "Untitled"));
    info.append(createElement("span", "", `${book.author || "Author not listed"} · ${book.availableCopies || 0} of ${book.totalCopies || 0} available`));
    const remove = createElement("button", "button button-danger", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => void runAction(async () => {
      await updateDoc(doc(db, "books", book.id), { active: false, updatedAt: serverTimestamp() });
      await loadAdminData();
      showNotice("The book was removed from the catalog. Checkout records are retained.", "success");
    }));
    row.append(info, remove);
    list.append(row);
  }
  catalogCard.append(list);
  panel.append(card, catalogCard);
}

function renderAdminLoans() {
  const panel = byId("admin-loans-panel");
  panel.replaceChildren();
  const loans = activeLoans.filter((loan) => loan.status === "active");
  if (!loans.length) {
    panel.append(createAdminCard("No active checkouts", "Books currently checked out will appear here."));
    return;
  }
  for (const loan of loans) {
    const card = createAdminCard("", "");
    card.firstElementChild.remove();
    const row = createElement("div", "loan-row");
    const info = createElement("div", "loan-info");
    info.append(createElement("h2", "", loan.bookTitle || "Book"));
    info.append(createElement("p", "", `${loan.memberName || "Member"} · ${loan.memberEmail || "No email"}${loan.memberPhone ? ` · ${loan.memberPhone}` : ""}`));
    const returned = createElement("button", "button button-outline", "Mark returned");
    returned.type = "button";
    returned.addEventListener("click", () => void runAction(() => returnBook(loan)));
    row.append(info, returned);
    card.append(row);
    panel.append(card);
  }
}

async function returnBook(loan) {
  await runTransaction(db, async (transaction) => {
    const checkoutRef = doc(db, "checkouts", loan.id);
    const bookRef = doc(db, "books", loan.bookId);
    const [checkoutSnapshot, bookSnapshot] = await Promise.all([
      transaction.get(checkoutRef), transaction.get(bookRef)
    ]);
    if (!checkoutSnapshot.exists() || checkoutSnapshot.data().status !== "active") {
      throw new Error("This checkout is already marked returned.");
    }
    if (!bookSnapshot.exists()) throw new Error("The catalog record for this checkout is missing; the return was not recorded.");
    const book = bookSnapshot.data();
    const total = Number.isInteger(book.totalCopies) ? book.totalCopies : 0;
    const available = Number.isInteger(book.availableCopies) ? book.availableCopies : 0;
    transaction.update(bookRef, { availableCopies: Math.min(total, available + 1), updatedAt: serverTimestamp() });
    transaction.update(checkoutRef, { status: "returned", returnedAt: serverTimestamp(), returnedBy: signedInUser.uid });
  });
  await loadAdminData();
  showNotice("The book has been marked returned.", "success");
}

function renderAdminSettings() {
  const panel = byId("admin-settings-panel");
  panel.replaceChildren();
  const card = createAdminCard("Church details and colors", "These details are shown to library visitors connected to this Firebase project.");
  const form = createElement("form", "settings-form");
  const nameLabel = createElement("label", "", "Church name");
  const nameInput = document.createElement("input");
  nameInput.name = "name";
  nameInput.maxLength = 100;
  nameInput.required = true;
  nameInput.value = churchSettings.name || "";
  nameLabel.append(nameInput);
  form.append(nameLabel);
  const theme = churchSettings.theme || {};
  for (const [key, labelText, defaultValue] of [
    ["primary", "Primary color", "#315b4b"],
    ["accent", "Accent color", "#c9944a"],
    ["background", "Page background", "#f5f4ef"],
    ["surface", "Card background", "#fffefa"],
    ["text", "Text color", "#23322b"]
  ]) {
    const label = createElement("label", "", labelText);
    const row = createElement("div", "color-input-row");
    const input = document.createElement("input");
    input.type = "color";
    input.name = key;
    input.value = colorPattern.test(theme[key] || "") ? theme[key] : defaultValue;
    const value = createElement("span", "", input.value);
    input.addEventListener("input", () => { value.textContent = input.value; });
    row.append(input, value);
    label.append(row);
    form.append(label);
  }
  const save = createElement("button", "button button-primary", "Save church details");
  save.type = "submit";
  form.append(save);
  form.addEventListener("submit", (event) => void runAction(async () => {
    event.preventDefault();
    const data = new FormData(form);
    const next = {
      name: String(data.get("name") || "").trim().slice(0, 100),
      theme: Object.fromEntries(["primary", "accent", "background", "surface", "text"].map((key) => [key, String(data.get(key))]))
    };
    if (!next.name || Object.values(next.theme).some((color) => !colorPattern.test(color))) {
      throw new Error("Enter a church name and valid colors.");
    }
    await setDoc(doc(db, "settings", "public"), next);
    churchSettings = next;
    setBranding(next);
    showNotice("Church details and colors have been saved.", "success");
  }));
  card.append(form);
  panel.append(card);
}

async function loadAdminData() {
  const [requestsSnapshot, booksSnapshot, checkoutsSnapshot] = await Promise.all([
    getDocs(collection(db, "accessRequests")),
    getDocs(collection(db, "books")),
    getDocs(collection(db, "checkouts"))
  ]);
  accessRequests = requestsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  books = booksSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((book) => book.active !== false)
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  activeLoans = checkoutsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const activeMemberIds = [...new Set(activeLoans
    .filter((loan) => loan.status === "active")
    .map((loan) => loan.uid))];
  const memberSnapshots = await Promise.all(activeMemberIds.map((uid) => getDoc(doc(db, "members", uid))));
  const membersById = new Map(memberSnapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => [snapshot.id, snapshot.data()]));
  activeLoans = activeLoans.map((loan) => {
    const member = membersById.get(loan.uid);
    return member && loan.status === "active"
      ? { ...loan, memberName: member.displayName, memberEmail: member.email, memberPhone: member.phone }
      : loan;
  });
  renderRequests();
  renderAdminBooks();
  renderAdminLoans();
  renderAdminSettings();
}

async function sendEmailLink(event) {
  event.preventDefault();
  const profile = collectFormProfile();
  if (!profile.name || !profile.email) throw new Error("Enter your name and email address.");
  localStorage.setItem(STORAGE_KEYS.email, profile.email);
  localStorage.setItem(STORAGE_KEYS.name, profile.name);
  localStorage.setItem(STORAGE_KEYS.phone, profile.phone);
  const returnUrl = new URL(window.location.pathname, window.location.origin);
  if (firebaseConfig) {
    for (const key of ["apiKey", "authDomain", "projectId", "appId", "storageBucket", "messagingSenderId", "measurementId", "databaseURL"]) {
      if (firebaseConfig[key]) returnUrl.searchParams.set(key, firebaseConfig[key]);
    }
  }
  await sendSignInLinkToEmail(auth, profile.email, {
    url: returnUrl.toString(),
    handleCodeInApp: true
  });
  showNotice(`A secure sign-in link was sent to ${profile.email}. Open that email on this device to continue.`, "success");
}

async function signInWithGoogle() {
  const profile = collectFormProfile();
  if (profile.name) localStorage.setItem(STORAGE_KEYS.name, profile.name);
  if (profile.phone) localStorage.setItem(STORAGE_KEYS.phone, profile.phone);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  await submitAccessRequest(credential.user, {
    name: profile.name || credential.user.displayName || "",
    phone: profile.phone
  });
  clearProfileDraft();
}

async function clearChurchSelection() {
  if (auth?.currentUser) await signOut(auth);
  clearProfileDraft();
  firebaseConfig = undefined;
  auth = undefined;
  db = undefined;
  currentMember = undefined;
  showFirebaseConfigForm();
}

function bindEvents() {
  byId("firebase-config-form").addEventListener("submit", (event) => void runAction(async () => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const config = {};
    for (const key of ["apiKey", "authDomain", "projectId", "appId", "storageBucket", "messagingSenderId", "measurementId", "databaseURL"]) {
      const value = String(data.get(key) || "").trim();
      if (value) config[key] = value;
    }
    if (!validFirebaseConfig(config)) throw new Error("Check the Firebase API key, auth domain, project ID, and app ID.");
    await connectToChurch(config);
  }));
  byId("email-form").addEventListener("submit", (event) => void runAction(sendEmailLink));
  byId("google-button").addEventListener("click", () => void runAction(signInWithGoogle));
  byId("change-church-button").addEventListener("click", () => void runAction(clearChurchSelection));
  byId("footer-change-church").addEventListener("click", () => void runAction(clearChurchSelection));
  byId("sign-out-button").addEventListener("click", () => void runAction(() => signOut(auth)));
  byId("pending-sign-out-button").addEventListener("click", () => void runAction(() => signOut(auth)));
  byId("denied-sign-out-button").addEventListener("click", () => void runAction(() => signOut(auth)));
  byId("catalog-search").addEventListener("input", renderCatalog);
  byId("show-profile-button").addEventListener("click", () => byId("profile-panel").classList.remove("hidden"));
  byId("catalog-profile-button").addEventListener("click", () => byId("profile-panel").classList.remove("hidden"));
  byId("close-profile-button").addEventListener("click", () => byId("profile-panel").classList.add("hidden"));
  byId("profile-form").addEventListener("submit", (event) => void runAction(() => saveProfile(event)));
  byId("browse-catalog-button").addEventListener("click", () => {
    byId("catalog-heading").textContent = "Browse the catalog";
    byId("member-actions").classList.add("hidden");
    byId("member-catalog").classList.remove("hidden");
    byId("catalog-search").value = "";
    renderCatalog();
  });
  byId("start-checkout-button").addEventListener("click", () => {
    byId("catalog-heading").textContent = "Check out a book";
    byId("member-actions").classList.add("hidden");
    byId("member-catalog").classList.remove("hidden");
    byId("catalog-search").value = "";
    renderCatalog();
  });
  byId("back-to-actions-button").addEventListener("click", () => {
    byId("member-catalog").classList.add("hidden");
    byId("member-actions").classList.remove("hidden");
  });
  for (const button of document.querySelectorAll("[data-admin-tab]")) {
    button.addEventListener("click", () => {
      const tab = button.dataset.adminTab;
      for (const candidate of document.querySelectorAll("[data-admin-tab]")) {
        const active = candidate === button;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-selected", String(active));
      }
      for (const panel of document.querySelectorAll(".admin-panel")) {
        panel.classList.toggle("hidden", panel.id !== `admin-${tab}-panel`);
      }
    });
  }
}

async function start() {
  bindEvents();
  const urlConfig = readFirebaseConfigFromUrl();
  const hasUrlConfig = Object.keys(urlConfig).length > 0;
  if (hasUrlConfig && validFirebaseConfig(urlConfig)) {
    try {
      await connectToChurch(urlConfig);
    } catch (error) {
      console.error(error);
      showFirebaseConfigForm(urlConfig);
      showNotice(userMessage(error), "error");
    }
    return;
  }
  showFirebaseConfigForm(urlConfig);
  showNotice(hasUrlConfig
    ? "Some Firebase URL parameters are missing or invalid. Complete the settings below."
    : "Enter the Firebase settings from your church’s web app, or open a complete Firebase URL.", "info");
}

void start();
