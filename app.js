import * as store from "./store.js";
import { CATEGORIES } from "./books-seed.js";
import { PAYSTACK_PUBLIC_KEY, DELIVERY_FEE, FREE_DELIVERY_OVER } from "./firebase-config.js";

/* ------------------------------ tiny helpers ------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const naira = (n) => "₦" + Number(n).toLocaleString("en-NG");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stars = (n) => {
  const full = Math.round(n);
  return `<span class="stars" aria-label="${n} out of 5 stars">${"★".repeat(full)}${"☆".repeat(5 - full)}</span>`;
};

// Local placeholder cover, used when a cover image fails to load.
function placeholder(title) {
  const t = esc(title).slice(0, 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <rect width="400" height="600" fill="#1f4d3a"/><rect x="24" y="24" width="352" height="552" fill="none" stroke="#ffffff" stroke-opacity=".35"/>
    <text x="200" y="300" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="700" text-anchor="middle">${t}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function guardImages(root) {
  $$("img[data-title]", root).forEach((img) => {
    const fix = () => { img.onerror = null; img.src = placeholder(img.dataset.title); };
    img.onerror = fix;
    // Open Library returns a 1x1 gif when it has no cover.
    if (img.complete && img.naturalWidth <= 1) fix();
    else img.addEventListener("load", () => { if (img.naturalWidth <= 1) fix(); });
  });
}

function toast(message, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast-item toast-${type}`;
  el.textContent = message;
  $("#toastWrap").appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3200);
}

const modal = (id) => bootstrap.Modal.getOrCreateInstance($(id));
const isCartPage = document.body.dataset.page === "cart";
const drawer = () => isCartPage ? { show() {}, hide() {} } : bootstrap.Offcanvas.getOrCreateInstance($("#cartDrawer"));

/* ------------------------------ state ------------------------------ */

const state = {
  books: [],
  category: "All",
  query: "",
  sort: "featured",
  cart: store.loadLocalCart(), // [{ id, qty }]
  user: null,
  authMode: "login" // login | signup
};

const bookById = (id) => state.books.find((b) => b.id === id);

/* ------------------------------ books ------------------------------ */

function bookCard(b, { compact = false } = {}) {
  const out = b.stock <= 0;
  return `
    <div class="col-6 col-md-4 col-lg-3">
      <article class="book">
        <button type="button" class="book-cover" data-details="${esc(b.id)}" aria-label="View details for ${esc(b.title)}">
          <img src="${esc(b.cover)}" data-title="${esc(b.title)}" alt="Cover of ${esc(b.title)}" loading="lazy">
          ${b.stock > 0 && b.stock <= 10 ? `<span class="tag tag-warn">Only ${b.stock} left</span>` : ""}
          ${out ? `<span class="tag tag-out">Sold out</span>` : ""}
        </button>
        <h3>${esc(b.title)}</h3>
        <p class="author">${esc(b.author)}</p>
        ${compact ? "" : `<p class="rating">${stars(b.rating)} <span>${esc(b.rating)}</span></p>`}
        <div class="book-row">
          <span class="price">${naira(b.price)}</span>
          <button type="button" class="link-button" data-add="${esc(b.id)}" ${out ? "disabled" : ""}>${out ? "Sold out" : "Add to cart"}</button>
        </div>
      </article>
    </div>`;
}

function renderFilters() {
  $("#filters").innerHTML = CATEGORIES.map(
    (c) => `<li><button type="button" class="filter ${c === state.category ? "is-active" : ""}" data-cat="${esc(c)}">${esc(c)}</button></li>`
  ).join("");
}

function visibleBooks() {
  const q = state.query.trim().toLowerCase();
  let list = state.books.filter(
    (b) =>
      (state.category === "All" || b.category === state.category) &&
      (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
  );
  const sorters = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    title: (a, b) => a.title.localeCompare(b.title),
    featured: (a, b) => Number(!!b.featured) - Number(!!a.featured)
  };
  return list.sort(sorters[state.sort]);
}

function renderShop() {
  const list = visibleBooks();
  $("#bookGrid").innerHTML = list.map((b) => bookCard(b)).join("");
  $("#emptyNote").classList.toggle("d-none", list.length > 0);
  $("#resultCount").textContent = `${list.length} ${list.length === 1 ? "book" : "books"}`;
  guardImages($("#bookGrid"));
}

function renderHome() {
  const featured = state.books.filter((b) => b.featured);
  const picks = (featured.length ? featured : state.books).slice(0, 4);
  $("#featuredGrid").innerHTML = picks.map((b) => bookCard(b, { compact: true })).join("");
  guardImages($("#featuredGrid"));

  const stack = picks.slice(0, 3);
  $("#heroStack").innerHTML = stack
    .map((b, i) => `<img class="stack-${i + 1}" src="${esc(b.cover)}" data-title="${esc(b.title)}" alt="Cover of ${esc(b.title)}">`)
    .join("");
  guardImages($("#heroStack"));
}

function openDetails(id) {
  const b = bookById(id);
  if (!b) return;
  $("#bookModalTitle").textContent = b.title;
  $("#bookModalBody").innerHTML = `
    <div class="row g-4">
      <div class="col-md-5">
        <img class="detail-cover" src="${esc(b.cover)}" data-title="${esc(b.title)}" alt="Cover of ${esc(b.title)}">
      </div>
      <div class="col-md-7">
        <p class="eyebrow">${esc(b.category)}</p>
        <h3 class="detail-title">${esc(b.title)}</h3>
        <p class="author">by ${esc(b.author)}</p>
        <p class="rating mt-2">${stars(b.rating)} <span>${esc(b.rating)}</span></p>
        <p class="body-text mt-3">${esc(b.description)}</p>
        <ul class="detail-meta">
          ${b.pages ? `<li>${esc(b.pages)} pages</li>` : ""}
          ${b.year ? `<li>First published ${esc(b.year)}</li>` : ""}
          <li>${b.stock > 0 ? `${esc(b.stock)} in stock` : "Sold out"}</li>
        </ul>
        <div class="detail-buy">
          <span class="price detail-price">${naira(b.price)}</span>
          <button type="button" class="btn-solid" data-add="${esc(b.id)}" data-close-modal ${b.stock <= 0 ? "disabled" : ""}>Add to cart</button>
        </div>
      </div>
    </div>`;
  guardImages($("#bookModalBody"));
  modal("#bookModal").show();
}

/* ------------------------------ cart ------------------------------ */

function cartLines() {
  return state.cart
    .map((line) => ({ ...line, book: bookById(line.id) }))
    .filter((l) => l.book);
}

function totals() {
  const subtotal = cartLines().reduce((sum, l) => sum + l.book.price * l.qty, 0);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  return { subtotal, delivery, total: subtotal + delivery };
}

function persistCart() {
  store.saveLocalCart(state.cart);
  if (state.user) store.saveRemoteCart(state.user, state.cart);
}

function renderCart() {
  const lines = cartLines();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  $$("[data-cart-count]").forEach((el) => {
    el.textContent = count;
    el.classList.toggle("is-empty", count === 0);
  });

  $("#cartEmpty")?.classList.toggle("d-none", lines.length > 0);
  $("#cartFooter")?.classList.toggle("d-none", lines.length === 0);

  if ($("#cartList")) $("#cartList").innerHTML = lines
    .map(
      (l) => `
      <li class="cart-row">
        <img src="${esc(l.book.cover)}" data-title="${esc(l.book.title)}" alt="" class="cart-thumb">
        <div class="cart-title">
          <h3>${esc(l.book.title)}</h3>
          <p>${esc(l.book.author)}</p>
          <span class="cart-price">${naira(l.book.price * l.qty)}</span>
        </div>
        <div class="qty" role="group" aria-label="Quantity for ${esc(l.book.title)}">
          <button type="button" data-dec="${esc(l.id)}" aria-label="Decrease quantity">−</button>
          <span>${l.qty}</span>
          <button type="button" data-inc="${esc(l.id)}" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="cart-remove" data-remove="${esc(l.id)}" aria-label="Remove ${esc(l.book.title)}">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </li>`
    )
    .join("");
  if ($("#cartList")) guardImages($("#cartList"));

  const t = totals();
  if ($("#cartSubtotal")) $("#cartSubtotal").textContent = naira(t.subtotal);
  if ($("#cartDelivery")) $("#cartDelivery").textContent = t.delivery === 0 ? "Free" : naira(t.delivery);
  if ($("#cartTotal")) $("#cartTotal").textContent = naira(t.total);
  const left = FREE_DELIVERY_OVER - t.subtotal;
  if ($("#freeNote")) $("#freeNote").textContent =
    t.subtotal === 0 ? "" : left > 0 ? `Add ${naira(left)} more for free delivery.` : "You have free delivery.";
}

function addToCart(id) {
  const b = bookById(id);
  if (!b || b.stock <= 0) return;
  const line = state.cart.find((l) => l.id === id);
  if (line) {
    if (line.qty >= b.stock) return toast(`Only ${b.stock} in stock.`, "warn");
    line.qty += 1;
  } else state.cart.push({ id, qty: 1 });
  persistCart();
  renderCart();
  toast(`Added “${b.title}” to your cart.`);
}

function changeQty(id, delta) {
  const line = state.cart.find((l) => l.id === id);
  const b = bookById(id);
  if (!line || !b) return;
  const next = line.qty + delta;
  if (next > b.stock) return toast(`Only ${b.stock} in stock.`, "warn");
  if (next <= 0) state.cart = state.cart.filter((l) => l.id !== id);
  else line.qty = next;
  persistCart();
  renderCart();
}

function mergeCarts(a, b) {
  const map = new Map();
  [...a, ...b].forEach((l) => map.set(l.id, Math.max(map.get(l.id) || 0, l.qty)));
  return [...map].map(([id, qty]) => ({ id, qty }));
}

/* ------------------------------ checkout ------------------------------ */

async function checkout() {
  if (!state.user) {
    toast("Please log in to check out.", "warn");
    if (isCartPage) return openAuth("login");
    const el = $("#cartDrawer");
    el.addEventListener("hidden.bs.offcanvas", () => openAuth("login"), { once: true });
    return drawer().hide();
  }
  const lines = cartLines();
  if (!lines.length) return;
  const t = totals();

  const finish = async (reference) => {
    try {
      const id = await store.createOrder(state.user, {
        items: lines.map((l) => ({ id: l.id, title: l.book.title, author: l.book.author, price: l.book.price, qty: l.qty })),
        subtotal: t.subtotal, delivery: t.delivery, total: t.total, reference
      });
      state.cart = [];
      persistCart();
      renderCart();
      drawer().hide();
      toast(`Payment received. Order ${id} placed.`);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const keyIsSet = PAYSTACK_PUBLIC_KEY && !PAYSTACK_PUBLIC_KEY.includes("xxxx");
  if (window.PaystackPop && keyIsSet) {
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: state.user.email,
      amount: t.total * 100, // Paystack uses kobo
      currency: "NGN",
      callback: (res) => { finish(res.reference); },
      onClose: () => toast("Payment window closed.", "warn")
    });
    handler.openIframe();
  } else {
    // No Paystack key yet: simulate a successful test payment.
    if (confirm(`Test checkout\n\nTotal: ${naira(t.total)}\n\nNo Paystack key is set, so this will simulate a payment. Continue?`)) {
      finish("TEST-" + Date.now());
    }
  }
}

/* ------------------------------ auth UI ------------------------------ */

function setAuthMessage(kind, text) {
  $("#authError").classList.add("d-none");
  $("#authInfo").classList.add("d-none");
  if (!text) return;
  const el = kind === "error" ? $("#authError") : $("#authInfo");
  el.textContent = text;
  el.classList.remove("d-none");
}

function openAuth(mode = "login") {
  state.authMode = mode;
  const signup = mode === "signup";
  $("#authTitle").textContent = signup ? "Create your account" : "Log in";
  $("#authSubmit").textContent = signup ? "Create account" : "Log in";
  $("#nameField").classList.toggle("d-none", !signup);
  $("#authName").required = signup;
  $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("#forgotRow").classList.toggle("d-none", signup);
  $("#switchRow").innerHTML = signup
    ? `Already have an account? <button type="button" class="link-button" data-auth-open="login">Log in</button>`
    : `New here? <button type="button" class="link-button" data-auth-open="signup">Create an account</button>`;
  setAuthMessage();
  modal("#authModal").show();
}

async function submitAuth(e) {
  e.preventDefault();
  setAuthMessage();
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const name = $("#authName").value.trim();
  if (!email || !password) return setAuthMessage("error", "Enter your email and password.");
  if (state.authMode === "signup" && !name) return setAuthMessage("error", "Enter your name.");

  const btn = $("#authSubmit");
  btn.disabled = true;
  try {
    if (state.authMode === "signup") await store.signUp(name, email, password);
    else await store.logIn(email, password);
    $("#authForm").reset();
    modal("#authModal").hide();
  } catch (err) {
    setAuthMessage("error", err.message);
  } finally {
    btn.disabled = false;
  }
}

async function onUserChange(user) {
  const wasLoggedOut = !state.user;
  state.user = user;
  $("#navLoggedOut").classList.toggle("d-none", !!user);
  $("#navLoggedIn").classList.toggle("d-none", !user);
  if (!user) {
    if ($("#adminLink")) $("#adminLink").classList.add("d-none");
  } else {
    $("#navUserName").textContent = (user.name || user.email).split(" ")[0];
    if ($("#adminLink")) {
      store.getRole(user).then((role) => $("#adminLink").classList.toggle("d-none", role !== "admin")).catch(() => {});
    }
    if (wasLoggedOut) {
      const remote = await store.loadRemoteCart(user);
      if (remote) {
        state.cart = mergeCarts(state.cart, remote);
        persistCart();
        renderCart();
      }
      toast(`Welcome, ${(user.name || user.email).split(" ")[0]}.`);
    }
  }
}

async function showOrders() {
  if (!state.user) return;
  const body = $("#ordersBody");
  body.innerHTML = `<p class="body-text">Loading…</p>`;
  modal("#ordersModal").show();
  const orders = await store.getOrders(state.user);
  if (!orders.length) {
    body.innerHTML = `<p class="body-text">No orders yet. When you buy something, it shows up here.</p>`;
    return;
  }
  body.innerHTML = orders
    .map((o) => {
      const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Just now";
      return `
      <article class="order">
        <header>
          <div><strong>Order ${esc(o.id)}</strong><span class="muted"> · ${esc(date)}</span></div>
          <span class="status">${esc(o.status || "paid")}</span>
        </header>
        <ul>
          ${(o.items || []).map((i) => `<li><span>${esc(i.title)} × ${esc(i.qty)}</span><span>${naira(i.price * i.qty)}</span></li>`).join("")}
        </ul>
        <footer><span>Delivery ${o.delivery ? naira(o.delivery) : "free"}</span><strong>Total ${naira(o.total)}</strong></footer>
      </article>`;
    })
    .join("");
}

/* ------------------------------ reviews ------------------------------ */

async function renderReviews() {
  const reviews = await store.getReviews();
  $("#reviewGrid").innerHTML = reviews
    .map(
      (r) => `
      <div class="col-md-4">
        <figure class="review">
          ${stars(r.rating)}
          <blockquote>${esc(r.text)}</blockquote>
          <figcaption>${esc(r.name)}</figcaption>
        </figure>
      </div>`
    )
    .join("");
}

async function submitReview(e) {
  e.preventDefault();
  const text = $("#reviewText").value.trim();
  if (text.length < 5) return toast("Write a little more, please.", "warn");
  try {
    await store.addReview(state.user, Number($("#reviewRating").value), text);
    $("#reviewForm").reset();
    modal("#reviewModal").hide();
    toast("Thanks for your review.");
    renderReviews();
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ------------------------------ events ------------------------------ */

function bindEvents() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;

    if (t.dataset.add) {
      addToCart(t.dataset.add);
      if (t.hasAttribute("data-close-modal")) modal("#bookModal").hide();
    } else if (t.dataset.details) openDetails(t.dataset.details);
    else if (t.dataset.cat) {
      state.category = t.dataset.cat;
      renderFilters();
      renderShop();
    } else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
    else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
    else if (t.dataset.remove) changeQty(t.dataset.remove, -9999);
    else if (t.hasAttribute("data-open-cart")) drawer().show();
    else if (t.dataset.authOpen) openAuth(t.dataset.authOpen);
  });

  $("#cartBrowse")?.addEventListener("click", () => { location.href = "index.html#shop"; });
  $("#searchInput")?.addEventListener("input", (e) => { state.query = e.target.value; renderShop(); });
  $("#sortSelect")?.addEventListener("change", (e) => { state.sort = e.target.value; renderShop(); });
  $("#checkoutBtn")?.addEventListener("click", checkout);

  $("#authForm")?.addEventListener("submit", submitAuth);
  $("#googleBtn")?.addEventListener("click", async () => {
    setAuthMessage();
    try { await store.logInGoogle(); modal("#authModal").hide(); } catch (err) { setAuthMessage("error", err.message); }
  });
  $("#forgotBtn")?.addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    if (!email) return setAuthMessage("error", "Type your email above first, then press this again.");
    try { await store.resetPassword(email); setAuthMessage("info", "Reset link sent. Check your inbox."); }
    catch (err) { setAuthMessage("error", err.message); }
  });
  $("#logoutBtn")?.addEventListener("click", async () => {
    await store.logOut();
    toast("You are logged out.");
  });
  $("#openOrders")?.addEventListener("click", showOrders);

  $("#writeReviewBtn")?.addEventListener("click", () => {
    if (!state.user) { toast("Log in to write a review.", "warn"); return openAuth("login"); }
    modal("#reviewModal").show();
  });
  $("#reviewForm")?.addEventListener("submit", submitReview);

  $("#newsletterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#newsletterEmail");
    if (!input.checkValidity() || !input.value) return toast("Enter a valid email address.", "warn");
    input.value = "";
    toast("You are on the list.");
  });
}

/* ------------------------------ start ------------------------------ */

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
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  elements.forEach((el) => observer.observe(el));
}

async function start() {
  bindEvents();
  if ($("#modeBadge")) $("#modeBadge").textContent = store.mode === "demo" ? "Demo mode: connect Firebase in firebase-config.js." : "";

  try {
    await store.init();
  } catch (e) {
    console.error("Firebase failed to load", e);
    toast("Could not reach Firebase. Check your config.", "error");
  }

  state.books = await store.getBooks();
  if ($("#filters")) renderFilters();
  if ($("#featuredGrid") && $("#heroStack")) renderHome();
  if ($("#bookGrid")) renderShop();
  if ($("#cartList")) renderCart();
  if ($("#reviewGrid")) renderReviews();

  if ($("#navLoggedOut") && $("#navLoggedIn")) store.onAuth(onUserChange);

  initScrollObserver();
}

// Handy from the console once you are an admin: seedBooks()
window.seedBooks = store.seedBooks;

start();
