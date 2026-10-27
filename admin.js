import * as store from "./store.js";
import { CATEGORIES } from "./books-seed.js";

/* ------------------------------ helpers ------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Just now");
const coverFor = (b) => b.cover || (b.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg?default=false` : "");
const modal = (id) => bootstrap.Modal.getOrCreateInstance($(id));

const STATUSES = ["paid", "processing", "shipped", "delivered", "cancelled"];
const LOW_STOCK = 5;

function toast(message, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast-item toast-${type}`;
  el.textContent = message;
  $("#toastWrap").appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3200);
}

function placeholder(title) {
  const t = esc(title).slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#1f4d3a"/><text x="100" y="150" fill="#fff" font-family="Arial" font-size="16" text-anchor="middle">${t}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function guardImages(root) {
  $$("img[data-title]", root).forEach((img) => {
    const fix = () => { img.onerror = null; img.src = placeholder(img.dataset.title); };
    img.onerror = fix;
    if (img.complete && img.naturalWidth <= 1) fix();
    else img.addEventListener("load", () => { if (img.naturalWidth <= 1) fix(); });
  });
}

/* ------------------------------ state ------------------------------ */

const data = { books: [], orders: [], reviews: [], customers: [] };
let user = null;
let editingId = null;

/* ------------------------------ gate ------------------------------ */

function showGate(message) {
  $("#gate").classList.remove("d-none");
  $("#dash").classList.add("d-none");
  if (message) { $("#gateError").textContent = message; $("#gateError").classList.remove("d-none"); }
}

async function onUser(u) {
  user = u;
  if (!u) return showGate();
  const role = await store.getRole(u);
  if (role !== "admin") {
    await store.logOut();
    return showGate("That account is not an admin. In Firestore, set its role to admin (see the README).");
  }
  $("#gate").classList.add("d-none");
  $("#dash").classList.remove("d-none");
  $("#adminWho").textContent = u.email;
  $("#demoBanner").classList.toggle("d-none", store.mode !== "demo");
  await loadAll();
}

async function loadAll() {
  try {
    const [books, orders, reviews, customers] = await Promise.all([
      store.getBooksAdmin(), store.getAllOrders(), store.getAllReviews(), store.getCustomers()
    ]);
    Object.assign(data, { books, orders, reviews, customers });
    renderAll();
  } catch (e) {
    console.error(e);
    toast("Could not load data. Check your Firestore rules and that your role is admin.", "error");
  }
}

function renderAll() {
  renderOverview();
  renderBooks();
  renderOrders();
  renderReviews();
  renderCustomers();
}

/* ------------------------------ overview ------------------------------ */

const countsAsSale = (o) => o.status !== "cancelled";

function renderOverview() {
  const sales = data.orders.filter(countsAsSale);
  const revenue = sales.reduce((n, o) => n + (o.total || 0), 0);
  const pending = data.orders.filter((o) => o.status === "paid" || o.status === "processing").length;
  const low = data.books.filter((b) => b.stock <= LOW_STOCK);
  const avg = sales.length ? Math.round(revenue / sales.length) : 0;

  $("#stats").innerHTML = [
    ["Revenue", naira(revenue), `${sales.length} ${sales.length === 1 ? "order" : "orders"}`],
    ["Average order", naira(avg), ""],
    ["To fulfil", pending, "paid or processing"],
    ["Books in catalogue", data.books.length, `${low.length} low on stock`],
    ["Customers", data.customers.filter((c) => c.role !== "admin").length, ""]
  ].map(([label, value, note]) => `<div class="stat"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("");

  // Last 7 days revenue
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    days.push({ key: d.toDateString(), label: d.toLocaleDateString("en-NG", { weekday: "short" }), total: 0 });
  }
  sales.forEach((o) => {
    if (!o.createdAt) return;
    const day = days.find((d) => d.key === new Date(o.createdAt).toDateString());
    if (day) day.total += o.total || 0;
  });
  const max = Math.max(...days.map((d) => d.total), 1);
  $("#bars").innerHTML = days.map((d) => `
    <div class="bar-col">
      <span class="bar-val">${d.total ? naira(d.total) : ""}</span>
      <div class="bar ${d.total ? "" : "is-zero"}" style="height:${Math.max((d.total / max) * 100, 2)}%" title="${esc(d.label)}: ${naira(d.total)}"></div>
      <span class="bar-label">${esc(d.label)}</span>
    </div>`).join("");

  // Top sellers
  const sold = new Map();
  sales.forEach((o) => (o.items || []).forEach((i) => sold.set(i.title, (sold.get(i.title) || 0) + i.qty)));
  const top = [...sold].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("#topSellers").innerHTML = top.length
    ? top.map(([title, qty]) => `<li>${esc(title)}<span>${qty} sold</span></li>`).join("")
    : `<li class="empty" style="list-style:none">No sales yet.</li>`;

  // Needs attention
  const items = [];
  low.sort((a, b) => a.stock - b.stock).forEach((b) =>
    items.push(`<li><span><strong class="low">${b.stock <= 0 ? "Sold out" : b.stock + " left"}</strong> · ${esc(b.title)}</span><button type="button" class="link-button" data-edit="${esc(b.id)}">Restock</button></li>`));
  data.orders.filter((o) => o.status === "paid").slice(0, 5).forEach((o) =>
    items.push(`<li><span>New order <strong>${esc(o.id)}</strong> · ${naira(o.total)}</span><button type="button" class="link-button" data-goto="orders">Open orders</button></li>`));
  $("#attention").innerHTML = items.length ? items.join("") : `<li class="empty">All clear.</li>`;
}

/* ------------------------------ books ------------------------------ */

function renderBooks() {
  const q = $("#bookSearch").value.trim().toLowerCase();
  const list = data.books
    .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));

  $("#seedNote").classList.toggle("d-none", !(store.mode === "firebase" && data.books.length === 0));
  $("#booksBody").innerHTML = list.length
    ? list.map((b) => `
      <tr>
        <td><img class="thumb" src="${esc(coverFor(b))}" data-title="${esc(b.title)}" alt=""></td>
        <td><strong>${esc(b.title)}</strong><span class="sub">${esc(b.author)}</span></td>
        <td>${esc(b.category)}</td>
        <td class="num">${naira(b.price)}</td>
        <td class="num ${b.stock <= LOW_STOCK ? "low" : ""}">${esc(b.stock)}</td>
        <td>${b.featured ? "Yes" : "No"}</td>
        <td class="row-actions">
          <button type="button" class="link-button" data-edit="${esc(b.id)}">Edit</button>
          <button type="button" class="link-button danger" data-delete="${esc(b.id)}">Delete</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty">No books found.</td></tr>`;
  guardImages($("#booksBody"));
}

function updateCoverPreview() {
  const url = $("#fCover").value.trim() || ($("#fIsbn").value.trim() ? `https://covers.openlibrary.org/b/isbn/${$("#fIsbn").value.trim()}-L.jpg?default=false` : "");
  $("#coverPreview").innerHTML = url ? `<img src="${esc(url)}" data-title="${esc($("#fTitle").value || "Cover")}" alt="Cover preview">` : "";
  guardImages($("#coverPreview"));
}

function openBookForm(id) {
  editingId = id || null;
  const b = id ? data.books.find((x) => x.id === id) : null;
  $("#bookFormTitle").textContent = b ? "Edit book" : "Add book";
  $("#bookError").classList.add("d-none");
  $("#fCategory").innerHTML = CATEGORIES.filter((c) => c !== "All").map((c) => `<option>${esc(c)}</option>`).join("");
  $("#fTitle").value = b?.title || "";
  $("#fAuthor").value = b?.author || "";
  $("#fPrice").value = b?.price ?? "";
  $("#fStock").value = b?.stock ?? 10;
  $("#fRating").value = b?.rating ?? 4.5;
  $("#fCategory").value = b?.category || "Fiction";
  $("#fIsbn").value = b?.isbn || "";
  $("#fPages").value = b?.pages || "";
  $("#fYear").value = b?.year || "";
  $("#fCover").value = b?.cover && !b.cover.includes("covers.openlibrary.org") ? b.cover : "";
  $("#fDesc").value = b?.description || "";
  $("#fFeatured").checked = !!b?.featured;
  updateCoverPreview();
  modal("#bookFormModal").show();
}

async function submitBook(e) {
  e.preventDefault();
  const err = (m) => { $("#bookError").textContent = m; $("#bookError").classList.remove("d-none"); };
  const title = $("#fTitle").value.trim();
  const author = $("#fAuthor").value.trim();
  const price = Number($("#fPrice").value);
  const stock = Number($("#fStock").value);
  if (!title || !author) return err("Title and author are required.");
  if (!(price > 0)) return err("Enter a price above zero.");
  if (!(stock >= 0) || !Number.isInteger(stock)) return err("Stock must be a whole number, zero or more.");

  const isbn = $("#fIsbn").value.trim();
  const book = {
    id: editingId || slug(title) || "book-" + Date.now(),
    title, author, price, stock,
    rating: Math.min(5, Math.max(0, Number($("#fRating").value) || 0)),
    category: $("#fCategory").value,
    isbn,
    cover: $("#fCover").value.trim() || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : ""),
    pages: Number($("#fPages").value) || 0,
    year: Number($("#fYear").value) || 0,
    description: $("#fDesc").value.trim(),
    featured: $("#fFeatured").checked
  };
  if (!editingId && data.books.some((b) => b.id === book.id)) return err("A book with this title already exists. Edit it instead.");

  const btn = $("#bookSave");
  btn.disabled = true;
  try {
    await store.saveBook(book);
    modal("#bookFormModal").hide();
    toast(editingId ? "Book updated." : "Book added.");
    data.books = await store.getBooksAdmin();
    renderBooks(); renderOverview();
  } catch (e2) { err(e2.message); } finally { btn.disabled = false; }
}

async function removeBook(id) {
  const b = data.books.find((x) => x.id === id);
  if (!b || !confirm(`Delete “${b.title}”? This cannot be undone.`)) return;
  try {
    await store.deleteBook(id);
    data.books = await store.getBooksAdmin();
    renderBooks(); renderOverview();
    toast("Book deleted.");
  } catch (e) { toast(e.message, "error"); }
}

/* ------------------------------ orders ------------------------------ */

function renderOrders() {
  const filter = $("#orderFilter").value;
  const list = data.orders.filter((o) => filter === "all" || (o.status || "paid") === filter);
  $("#ordersList").innerHTML = list.length
    ? list.map((o) => {
        const status = o.status || "paid";
        return `
        <article class="order-card">
          <header>
            <div><strong>Order ${esc(o.id)}</strong> <span class="pill pill-${esc(status)}">${esc(status)}</span></div>
            <span class="who">${esc(fmtDate(o.createdAt))} · ${esc(o.email || "")}</span>
          </header>
          <ul>${(o.items || []).map((i) => `<li><span>${esc(i.title)} × ${esc(i.qty)}</span><span>${naira(i.price * i.qty)}</span></li>`).join("")}</ul>
          <footer>
            <span class="who">Delivery ${o.delivery ? naira(o.delivery) : "free"}${o.reference ? " · Ref " + esc(o.reference) : ""}</span>
            <strong>${naira(o.total)}</strong>
            <label>Status
              <select data-status="${esc(o.id)}" aria-label="Order status">
                ${STATUSES.map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </label>
          </footer>
        </article>`;
      }).join("")
    : `<p class="empty">No orders${filter === "all" ? " yet" : " with that status"}.</p>`;
}

async function changeStatus(id, status) {
  try {
    await store.updateOrderStatus(id, status);
    const o = data.orders.find((x) => x.id === id);
    if (o) o.status = status;
    renderOrders(); renderOverview();
    toast(`Order marked ${status}.`);
  } catch (e) { toast(e.message, "error"); renderOrders(); }
}

function exportOrders() {
  if (!data.orders.length) return toast("No orders to export.", "warn");
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Order", "Date", "Email", "Status", "Items", "Subtotal", "Delivery", "Total", "Reference"]];
  data.orders.forEach((o) => rows.push([
    o.id, o.createdAt || "", o.email || "", o.status || "paid",
    (o.items || []).map((i) => `${i.title} x${i.qty}`).join("; "), o.subtotal, o.delivery, o.total, o.reference || ""
  ]));
  const blob = new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "iwe-orders.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------ reviews + customers ------------------------------ */

function renderReviews() {
  $("#reviewsList").innerHTML = data.reviews.length
    ? data.reviews.map((r) => `
      <div class="review-row">
        <div>
          <span class="stars" aria-label="${esc(r.rating)} out of 5">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
          <p>${esc(r.text)}</p>
          <span class="muted">${esc(r.name)}</span>
        </div>
        <button type="button" class="link-button danger" data-del-review="${esc(r.id)}">Delete</button>
      </div>`).join("")
    : `<p class="empty">No reader reviews yet.</p>`;
}

function renderCustomers() {
  const byUser = new Map();
  data.orders.filter(countsAsSale).forEach((o) => {
    const c = byUser.get(o.uid) || { n: 0, total: 0 };
    c.n += 1; c.total += o.total || 0;
    byUser.set(o.uid, c);
  });
  $("#customersBody").innerHTML = data.customers.length
    ? data.customers.map((c) => {
        const s = byUser.get(c.uid) || { n: 0, total: 0 };
        return `<tr><td>${esc(c.name || "-")}</td><td>${esc(c.email)}</td><td>${esc(c.role || "customer")}</td><td class="num">${s.n}</td><td class="num">${naira(s.total)}</td></tr>`;
      }).join("")
    : `<tr><td colspan="5" class="empty">No customers yet.</td></tr>`;
}

/* ------------------------------ tabs + events ------------------------------ */

function showTab(name) {
  $$("[data-panel]").forEach((p) => p.classList.toggle("d-none", p.dataset.panel !== name));
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  try { history.replaceState(null, "", "#" + name); } catch {}
}

function bind() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) showTab(t.dataset.tab);
    else if (t.dataset.goto) showTab(t.dataset.goto);
    else if (t.dataset.edit) { showTab("books"); openBookForm(t.dataset.edit); }
    else if (t.dataset.delete) removeBook(t.dataset.delete);
    else if (t.dataset.delReview) {
      if (!t.dataset.delReview || t.dataset.delReview === "undefined") return toast("Starter reviews can't be deleted.", "warn");
      if (confirm("Delete this review?")) store.deleteReview(t.dataset.delReview).then(async () => {
        data.reviews = await store.getAllReviews(); renderReviews(); toast("Review deleted.");
      }).catch((err) => toast(err.message, "error"));
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.dataset.status) changeStatus(e.target.dataset.status, e.target.value);
  });

  $("#addBookBtn").addEventListener("click", () => openBookForm(null));
  $("#bookForm").addEventListener("submit", submitBook);
  $("#bookSearch").addEventListener("input", renderBooks);
  $("#orderFilter").addEventListener("change", renderOrders);
  $("#exportOrders").addEventListener("click", exportOrders);
  ["#fCover", "#fIsbn"].forEach((s) => $(s).addEventListener("change", updateCoverPreview));
  $("#seedBtn").addEventListener("click", async () => {
    try { await store.seedBooks(); data.books = await store.getBooksAdmin(); renderBooks(); renderOverview(); toast("Starter books loaded."); }
    catch (err) { toast(err.message, "error"); }
  });

  $("#adminLogout").addEventListener("click", () => store.logOut());
  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#gateError").classList.add("d-none");
    try { await store.logIn($("#gateEmail").value.trim(), $("#gatePassword").value); $("#gateForm").reset(); }
    catch (err) { $("#gateError").textContent = err.message; $("#gateError").classList.remove("d-none"); }
  });
}

function initScrollObserver() {
  const elements = $$(".reveal");
  if (!elements.length) return;
  if (!("IntersectionObserver" in window)) {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  elements.forEach((el) => observer.observe(el));
}

async function start() {
  bind();
  if (store.mode === "demo") $("#gateNote").textContent = "Demo mode: create an account on the shop first, then sign in here with it.";
  try { await store.init(); } catch (e) { console.error(e); showGate("Could not reach Firebase. Check firebase-config.js."); return; }
  store.onAuth(onUser);
  const hash = location.hash.slice(1);
  if (["overview", "books", "orders", "reviews", "customers"].includes(hash)) showTab(hash);
  initScrollObserver();
}

start();
