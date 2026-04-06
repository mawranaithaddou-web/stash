'use strict';

/* ═══════════════════════════════════════════════════════════════════
   app.js  — Main dynamic controller for Anon marketplace
   Replaces & extends the original script.js with full API integration
═══════════════════════════════════════════════════════════════════ */

// ─── Utility ─────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
function showToast(message, type = 'success') {
  const t = document.getElementById('app-toast');
  if (!t) return;
  t.querySelector('.toast-message-text').textContent = message;
  t.className = `app-toast app-toast--${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

function formatPrice(n) {
  return '$' + Number(n).toFixed(2);
}


function updateNav() {
  const user = Auth.getUser();
  const loginBtn = document.getElementById('login-btn-nav');
  const userMenu = document.getElementById('user-menu');
  
  if (!user) {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
    return;
  }

  // User is logged in
  if (loginBtn) loginBtn.classList.add('hidden');
  if (userMenu) {
    userMenu.classList.remove('hidden');
    userMenu.classList.add('flex');
  }

  // Update Avatar and Name
  const avatar = document.getElementById('user-avatar-init');
  const nameDisplay = document.getElementById('user-name-nav');
  if (avatar) avatar.textContent = user.name?.charAt(0).toUpperCase() || 'U';
  if (nameDisplay) nameDisplay.textContent = user.name?.split(' ')[0];

  // Show/Hide Role-based links
  const vendorLink = document.getElementById('nav-vendor-link');
  const adminLink = document.getElementById('nav-admin-link');
  if (vendorLink) vendorLink.classList.toggle('hidden', user.role !== 'vendor');
  if (adminLink) adminLink.classList.toggle('hidden', user.role !== 'admin');
}

// Ensure this is called in your DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  refreshBadge(); // For cart count
});


function starHTML(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<ion-icon name="${i < Math.round(rating) ? 'star' : 'star-outline'}"></ion-icon>`
  ).join('');
}

function productCardHTML(p) {
  return `
    <div class="showcase group cursor-pointer reveal" data-product-id="${p._id}">
      <div class="showcase-banner relative aspect-[3/4] overflow-hidden bg-[#f0f0f0]">
        <a href="product.html?id=${p._id}">
          <img src="${p.thumbnail || 'assets/images/placeholder.jpg'}" 
               alt="${p.name}" class="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-[1.5s]">
        </a>
        <div class="absolute bottom-4 left-4 right-4 translate-y-12 group-hover:translate-y-0 transition-transform duration-500">
           <button class="add-to-cart-btn w-full bg-white/90 backdrop-blur text-[9px] font-bold tracking-widest uppercase py-3 hover:bg-black hover:text-white transition-colors" data-pid="${p._id}">
             Quick Add +
           </button>
        </div>
      </div>
      <div class="showcase-content pt-6 text-center">
        <p class="text-[9px] tracking-[0.2em] uppercase text-gray-400 mb-1">${p.vendor?.storeName || 'Anon Collection'}</p>
        <a href="product.html?id=${p._id}">
          <h3 class="serif italic text-lg mb-2">${p.name}</h3>
        </a>
        <p class="text-sm font-light tracking-widest">${formatPrice(p.price)}</p>
      </div>
    </div>`;
}

// ─── Auth state ──────────────────────────────────────────────────────────────
function updateNavForAuth() {
  const user = Auth.getUser();
  const loginBtn = document.getElementById('nav-login-btn');
  const userMenu = document.getElementById('nav-user-menu');
  const userNameEl = document.getElementById('nav-user-name');

  if (user && loginBtn) {
    loginBtn.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      if (userNameEl) userNameEl.textContent = user.name.split(' ')[0];
    }
    // Show role-specific dashboard links
    $$('.nav-vendor-only').forEach(el => el.style.display = user.role === 'vendor' ? '' : 'none');
    $$('.nav-admin-only').forEach(el => el.style.display = user.role === 'admin' ? '' : 'none');
  } else {
    if (loginBtn) loginBtn.style.display = '';
    if (userMenu) userMenu.style.display = 'none';
  }
}

// ─── Cart badge ──────────────────────────────────────────────────────────────
async function refreshCartBadge() {
  if (!Auth.isLoggedIn()) return;
  try {
    const { cart } = await Cart.get();
    const count = cart?.items?.length || 0;
    $$('[data-cart-count]').forEach(el => { el.textContent = count; });
  } catch {}
}

// ─── Add to cart ─────────────────────────────────────────────────────────────
async function addToCart(productId, quantity = 1, variant = '') {
  if (!Auth.isLoggedIn()) {
    openAuthModal('login');
    showToast('Please log in to add items to cart', 'info');
    return;
  }
  try {
    await Cart.add(productId, quantity, variant);
    showToast('Added to cart!', 'success');
    refreshCartBadge();
    openCartSidebar();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Wishlist toggle ─────────────────────────────────────────────────────────
async function toggleWishlist(productId) {
  if (!Auth.isLoggedIn()) { openAuthModal('login'); return; }
  try {
    await Users.toggleWishlist(productId);
    showToast('Wishlist updated', 'success');
    // Toggle heart icon
    const btn = $(`.wishlist-btn[data-pid="${productId}"]`);
    if (btn) {
      const icon = btn.querySelector('ion-icon');
      if (icon) icon.name = icon.name === 'heart' ? 'heart-outline' : 'heart';
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─── Cart Sidebar ─────────────────────────────────────────────────────────────
let cartSidebarOpen = false;

async function openCartSidebar() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  if (!sidebar) return;
  sidebar.classList.add('open');
  if (overlay) overlay.classList.add('active');
  cartSidebarOpen = true;
  await renderCartSidebar();
}

function closeCartSidebar() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  cartSidebarOpen = false;
}

async function renderCartSidebar() {
  const body = document.getElementById('cart-sidebar-body');
  const total = document.getElementById('cart-sidebar-total');
  if (!body) return;

  if (!Auth.isLoggedIn()) {
    body.innerHTML = `<div class="cart-empty"><ion-icon name="bag-outline"></ion-icon><p>Log in to view your cart</p></div>`;
    return;
  }
  body.innerHTML = `<div class="loading-spinner">Loading…</div>`;

  try {
    const { cart, subtotal } = await Cart.get();
    if (!cart || cart.items.length === 0) {
      body.innerHTML = `<div class="cart-empty"><ion-icon name="bag-outline"></ion-icon><p>Your cart is empty</p></div>`;
      if (total) total.textContent = '$0.00';
      return;
    }
    body.innerHTML = cart.items.map(item => `
      <div class="cart-item" data-item-id="${item._id}">
        <img src="${item.product?.thumbnail || ''}" alt="${item.product?.name || ''}" width="64" height="64">
        <div class="cart-item-info">
          <p class="cart-item-name">${item.product?.name || 'Product'}</p>
          <p class="cart-item-vendor">${item.vendor?.storeName || ''}</p>
          <div class="cart-item-qty">
            <button onclick="updateCartItem('${item._id}', ${item.quantity - 1})">−</button>
            <span>${item.quantity}</span>
            <button onclick="updateCartItem('${item._id}', ${item.quantity + 1})">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <p class="cart-item-price">${formatPrice(item.price * item.quantity)}</p>
          <button class="cart-item-remove" onclick="removeCartItem('${item._id}')">
            <ion-icon name="trash-outline"></ion-icon>
          </button>
        </div>
      </div>
    `).join('');
    if (total) total.textContent = formatPrice(subtotal);
  } catch (e) {
    body.innerHTML = `<p class="error-text">Failed to load cart</p>`;
  }
}

async function updateCartItem(itemId, qty) {
  if (qty <= 0) return removeCartItem(itemId);
  try {
    await Cart.update(itemId, qty);
    await renderCartSidebar();
    refreshCartBadge();
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeCartItem(itemId) {
  try {
    await Cart.remove(itemId);
    await renderCartSidebar();
    refreshCartBadge();
    showToast('Item removed', 'info');
  } catch (e) { showToast(e.message, 'error'); }
}

// ─── Auth Modal ──────────────────────────────────────────────────────────────
function openAuthModal(tab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('closed');
  modal.classList.add('open');
  switchAuthTab(tab);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) { modal.classList.remove('open'); modal.classList.add('closed'); }
}

function switchAuthTab(tab) {
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.auth-form').forEach(f => f.classList.toggle('active', f.dataset.form === tab));
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const email = e.target.email.value;
  const password = e.target.password.value;
  btn.textContent = 'Logging in…'; btn.disabled = true;
  try {
    const { token, user } = await Auth.login({ email, password });
    Auth.saveSession(token, user);
    closeAuthModal();
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
    updateNavForAuth();
    refreshCartBadge();
    setTimeout(() => {
      if (user.role === 'admin') window.location.href = 'pages/admin-dashboard.html';
      else if (user.role === 'vendor') window.location.href = 'pages/vendor-dashboard.html';
    }, 600);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = 'Log In'; btn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const name = e.target.fullname.value;
  const email = e.target.email.value;
  const password = e.target.password.value;
  const role = e.target.role?.value || 'buyer';
  btn.textContent = 'Creating account…'; btn.disabled = true;
  try {
    const { token, user } = await Auth.register({ name, email, password, role });
    Auth.saveSession(token, user);
    closeAuthModal();
    showToast(`Account created! Welcome, ${user.name.split(' ')[0]}!`, 'success');
    updateNavForAuth();
    refreshCartBadge();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = 'Create Account'; btn.disabled = false;
  }
}

// ─── Homepage: load featured products ────────────────────────────────────────
async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-products-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner">Loading products…</div>';
  try {
    const { products } = await Products.featured();
    grid.innerHTML = products.length
      ? products.map(productCardHTML).join('')
      : '<p class="no-results">No featured products yet.</p>';
    bindProductCardEvents(grid);
  } catch {
    grid.innerHTML = '<p class="error-text">Failed to load products.</p>';
  }
}

async function loadNewArrivals() {
  const grid = document.getElementById('new-arrivals-grid');
  if (!grid) return;
  try {
    const { products } = await Products.list({ sort: 'newest', limit: 8 });
    grid.innerHTML = products.map(productCardHTML).join('');
    bindProductCardEvents(grid);
  } catch {}
}

async function loadTopRated() {
  const grid = document.getElementById('top-rated-grid');
  if (!grid) return;
  try {
    const { products } = await Products.list({ sort: 'rating', limit: 8 });
    grid.innerHTML = products.map(productCardHTML).join('');
    bindProductCardEvents(grid);
  } catch {}
}

async function loadCategories() {
  const container = document.getElementById('category-list');
  if (!container) return;
  try {
    const { categories } = await Categories.list();
    container.innerHTML = categories.map(c => `
      <li class="menu-category">
        <a href="pages/shop.html?category=${c._id}" class="menu-title">${c.name}</a>
      </li>
    `).join('');
  } catch {}
}

// ─── Search ───────────────────────────────────────────────────────────────────
function initSearch() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = input?.value.trim();
      if (q) window.location.href = `pages/shop.html?q=${encodeURIComponent(q)}`;
    });
  }
}

// ─── Newsletter ───────────────────────────────────────────────────────────────
async function handleNewsletterSubmit(e) {
  e.preventDefault();
  const email = e.target.querySelector('input[type="email"]').value;
  try {
    const res = await Newsletter.subscribe(email);
    showToast(res.message, 'success');
    closeNewsletterModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeNewsletterModal() {
  const modal = document.querySelector('[data-modal]');
  if (modal) modal.classList.add('closed');
}

// ─── Event delegation for product cards ──────────────────────────────────────
function bindProductCardEvents(container) {
  container.addEventListener('click', e => {
    const addBtn = e.target.closest('.add-to-cart-btn');
    const wishBtn = e.target.closest('.wishlist-btn');
    if (addBtn) addToCart(addBtn.dataset.pid);
    if (wishBtn) toggleWishlist(wishBtn.dataset.pid);
  });
}

// ─── Quick View (lightweight product peek) ────────────────────────────────────
async function openQuickView(productId) {
  let modal = document.getElementById('quick-view-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quick-view-modal';
    modal.className = 'quick-view-modal';
    modal.innerHTML = `
      <div class="quick-view-overlay" onclick="closeQuickView()"></div>
      <div class="quick-view-content">
        <button class="quick-view-close" onclick="closeQuickView()">
          <ion-icon name="close-outline"></ion-icon>
        </button>
        <div id="quick-view-body"><div class="loading-spinner">Loading…</div></div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  const body = document.getElementById('quick-view-body');
  try {
    const { product } = await Products.get(productId);
    body.innerHTML = `
      <div class="qv-grid">
        <div class="qv-image">
          <img src="${product.thumbnail}" alt="${product.name}" width="400" height="400">
        </div>
        <div class="qv-details">
          <p class="qv-vendor"><a href="pages/vendor.html?slug=${product.vendor?.slug}">${product.vendor?.storeName}</a></p>
          <h2 class="qv-title">${product.name}</h2>
          <div class="qv-rating">${starHTML(product.rating)} <span>(${product.numReviews} reviews)</span></div>
          <div class="qv-price">
            <span class="qv-current">${formatPrice(product.price)}</span>
            ${product.comparePrice > product.price ? `<del class="qv-old">${formatPrice(product.comparePrice)}</del>` : ''}
          </div>
          <p class="qv-desc">${product.shortDescription || product.description.substring(0, 200)}…</p>
          <p class="qv-stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}">
            ${product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
          </p>
          <div class="qv-actions">
            <div class="qty-control">
              <button id="qv-qty-minus">−</button>
              <input type="number" id="qv-qty" value="1" min="1" max="${product.stock}">
              <button id="qv-qty-plus">+</button>
            </div>
            <button class="btn btn-primary qv-add-btn" onclick="addToCartFromQV('${product._id}')">
              <ion-icon name="bag-add-outline"></ion-icon> Add to Cart
            </button>
          </div>
          <a href="product.html?id=${product._id}" class="qv-full-link">View full details →</a>
        </div>
      </div>`;
    // QV qty controls
    document.getElementById('qv-qty-minus')?.addEventListener('click', () => {
      const inp = document.getElementById('qv-qty');
      if (Number(inp.value) > 1) inp.value = Number(inp.value) - 1;
    });
    document.getElementById('qv-qty-plus')?.addEventListener('click', () => {
      const inp = document.getElementById('qv-qty');
      if (Number(inp.value) < product.stock) inp.value = Number(inp.value) + 1;
    });
  } catch (e) {
    body.innerHTML = `<p class="error-text">Failed to load product: ${e.message}</p>`;
  }
}

function closeQuickView() {
  const modal = document.getElementById('quick-view-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function addToCartFromQV(productId) {
  const qty = Number(document.getElementById('qv-qty')?.value || 1);
  addToCart(productId, qty);
  closeQuickView();
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavForAuth();
  refreshCartBadge();
  loadFeaturedProducts();
  loadNewArrivals();
  loadTopRated();
  loadCategories();
  initSearch();

  // Original modal/accordion/menu behaviour
  const modal = document.querySelector('[data-modal]');
  const modalCloseBtn = document.querySelector('[data-modal-close]');
  const modalCloseOverlay = document.querySelector('[data-modal-overlay]');
  if (modalCloseOverlay) modalCloseOverlay.addEventListener('click', closeNewsletterModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeNewsletterModal);

  // Newsletter form
  const newsletterForm = document.querySelector('.newsletter form');
  if (newsletterForm) newsletterForm.addEventListener('submit', handleNewsletterSubmit);

  // Toast close
  document.querySelector('[data-toast-close]')?.addEventListener('click', () => {
    document.querySelector('[data-toast]')?.classList.add('closed');
  });

  // Auth modal events
  document.getElementById('nav-login-btn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('auth-modal-overlay')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab)));
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);
  document.getElementById('nav-logout-btn')?.addEventListener('click', Auth.logout);

  // Cart sidebar
  document.getElementById('cart-icon-btn')?.addEventListener('click', openCartSidebar);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCartSidebar);
  document.getElementById('cart-sidebar-close')?.addEventListener('click', closeCartSidebar);
  document.getElementById('cart-checkout-btn')?.addEventListener('click', () => {
    closeCartSidebar();
    window.location.href = 'pages/checkout.html';
  });

  // Mobile menu
  const mobileMenuOpenBtns = document.querySelectorAll('[data-mobile-menu-open-btn]');
  const mobileMenus = document.querySelectorAll('[data-mobile-menu]');
  const mobileMenuCloseBtns = document.querySelectorAll('[data-mobile-menu-close-btn]');
  const overlay = document.querySelector('[data-overlay]');
  mobileMenuOpenBtns.forEach((btn, i) => {
    const close = () => { mobileMenus[i]?.classList.remove('active'); overlay?.classList.remove('active'); };
    btn.addEventListener('click', () => { mobileMenus[i]?.classList.add('active'); overlay?.classList.add('active'); });
    mobileMenuCloseBtns[i]?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
  });

  // Accordion
  const accordionBtns = document.querySelectorAll('[data-accordion-btn]');
  const accordions = document.querySelectorAll('[data-accordion]');
  accordionBtns.forEach((btn, i) => {
    btn.addEventListener('click', function () {
      const isActive = this.nextElementSibling.classList.contains('active');
      accordions.forEach((a, j) => { a.classList.remove('active'); accordionBtns[j]?.classList.remove('active'); });
      if (!isActive) { this.nextElementSibling.classList.add('active'); this.classList.add('active'); }
    });
  });
});
