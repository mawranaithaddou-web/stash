/* ─── Helpers ────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const t = document.getElementById('app-toast');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  msgEl.textContent = msg;
  const styles = {
    success: ['bg-ink text-white', 'checkmark-circle-outline'],
    error:   ['bg-red-600 text-white', 'alert-circle-outline'],
    info:    ['bg-accent text-white', 'information-circle-outline'],
    warning: ['bg-amber-500 text-white', 'warning-outline'],
  };
  const [cls, ico] = styles[type] || styles.success;
  t.className = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium max-w-xs ${cls}`;
  icon.name = ico;
  t.style.cssText = 'opacity:1;transform:translateY(0);pointer-events:auto;transition:all .3s';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.cssText = 'opacity:0;transform:translateY(1rem);pointer-events:none;transition:all .3s'; }, 3200);
}

function formatPrice(n) { return '$' + Number(n || 0).toFixed(2); }

function starHTML(r) {
  const full = Math.floor(r), half = r % 1 >= 0.5;
  return Array.from({length:5}, (_,i) =>
    `<ion-icon name="${i < full ? 'star' : (i === full && half ? 'star-half' : 'star-outline')}" class="text-accent text-xs"></ion-icon>`
  ).join('');
}

function productCardHTML(p) {
  const disc = p.comparePrice > p.price ? Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100) : 0;
  return `
  <div class="product-card group bg-white rounded-2xl overflow-hidden border border-stone-mid/50 hover:border-stone-mid hover:shadow-lg transition-all duration-300 cursor-pointer" onclick="goProduct('${p._id}')">
    <div class="relative overflow-hidden aspect-square bg-stone-light">
      <img src="${p.thumbnail || 'https://placehold.co/400x400/f5f5f4/a8a29e?text=Product'}"
           alt="${p.name}" class="product-thumb w-full h-full object-cover">
      ${disc ? `<span class="absolute top-3 left-3 bg-accent text-white text-[10px] font-bold px-2 py-1 rounded-full">-${disc}%</span>` : ''}
      <div class="absolute inset-0 bg-ink/0 group-hover:bg-ink/5 transition-colors duration-300"></div>
      <div class="absolute bottom-3 inset-x-3 flex gap-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <button onclick="event.stopPropagation();addToCart('${p._id}')"
          class="flex-1 bg-ink text-white text-xs font-medium py-2.5 rounded-xl hover:bg-ink/80 transition-colors flex items-center justify-center gap-1.5">
          <ion-icon name="bag-add-outline"></ion-icon> Add to Cart
        </button>
        <button onclick="event.stopPropagation();toggleWishlist('${p._id}', this)"
          class="bg-white text-ink w-10 rounded-xl flex items-center justify-center hover:bg-stone-light transition-colors">
          <ion-icon name="heart-outline"></ion-icon>
        </button>
      </div>
    </div>
    <div class="p-4">
      <p class="text-[11px] uppercase tracking-wider text-accent font-medium mb-1">${p.category?.name || ''}</p>
      <h3 class="text-sm font-medium leading-snug mb-1.5 line-clamp-2 group-hover:text-accent transition-colors">${p.name}</h3>
      <div class="flex items-center gap-1 mb-2">${starHTML(p.rating || 0)}<span class="text-[11px] text-ink/40 ml-1">(${p.numReviews || 0})</span></div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-display text-lg">${formatPrice(p.price)}</span>
          ${p.comparePrice > p.price ? `<span class="text-xs text-ink/30 line-through">${formatPrice(p.comparePrice)}</span>` : ''}
        </div>
        <p class="text-[11px] text-ink/40 truncate max-w-[80px]">${p.vendor?.storeName || ''}</p>
      </div>
    </div>
  </div>`;
}

function goProduct(id) { window.location.href = `pages/product.html?id=${id}`; }

/* ─── Cart ───────────────────────────────────────────────────── */
async function refreshBadge() {
  if (!Auth.isLoggedIn()) return;
  try {
    const { cart } = await Cart.get();
    const n = cart?.items?.length || 0;
    const b = document.getElementById('cart-badge');
    b.textContent = n;
    b.classList.toggle('opacity-0', n === 0);
    document.getElementById('cart-count-badge').textContent = `(${n})`;
  } catch {}
}

async function openCart() {
  document.getElementById('cart-sidebar').classList.remove('translate-x-full');
  document.getElementById('cart-overlay-bg').classList.remove('opacity-0', 'pointer-events-none');
  await renderCart();
}
function closeCart() {
  document.getElementById('cart-sidebar').classList.add('translate-x-full');
  document.getElementById('cart-overlay-bg').classList.add('opacity-0', 'pointer-events-none');
}

async function renderCart() {
  const body = document.getElementById('cart-body');
  const sub = document.getElementById('cart-subtotal');
  if (!Auth.isLoggedIn()) {
    body.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-4 text-ink/40 py-16">
      <ion-icon name="bag-outline" class="text-5xl"></ion-icon>
      <p class="text-sm">Log in to view your cart</p>
      <button onclick="closeCart();openAuth('login')" class="bg-ink text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-ink/80 transition-colors">Log In</button>
    </div>`;
    return;
  }
  body.innerHTML = `<div class="text-center py-8 text-ink/30 text-sm">Loading…</div>`;
  try {
    const { cart, subtotal } = await Cart.get();
    if (!cart?.items?.length) {
      body.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-3 text-ink/40 py-16">
        <ion-icon name="bag-outline" class="text-5xl"></ion-icon>
        <p class="text-sm">Your cart is empty</p>
        <a href="pages/shop.html" onclick="closeCart()" class="text-ink text-sm font-medium hover:underline">Start shopping →</a>
      </div>`;
      if (sub) sub.textContent = '$0.00';
      return;
    }
    body.innerHTML = cart.items.map(item => `
      <div class="flex gap-4 items-start">
        <img src="${item.product?.thumbnail || ''}" alt="${item.product?.name || ''}"
          class="w-20 h-20 rounded-xl object-cover bg-stone-light flex-shrink-0">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium leading-snug mb-0.5 truncate">${item.product?.name || 'Product'}</p>
          <p class="text-xs text-ink/40 mb-2">${item.vendor?.storeName || ''}</p>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 border border-stone-mid rounded-full px-1">
              <button onclick="updateItem('${item._id}',${item.quantity-1})" class="w-6 h-6 flex items-center justify-center text-ink/60 hover:text-ink text-base leading-none transition-colors">−</button>
              <span class="text-sm w-5 text-center">${item.quantity}</span>
              <button onclick="updateItem('${item._id}',${item.quantity+1})" class="w-6 h-6 flex items-center justify-center text-ink/60 hover:text-ink text-base leading-none transition-colors">+</button>
            </div>
            <span class="font-display text-base ml-auto">${formatPrice(item.price * item.quantity)}</span>
          </div>
        </div>
        <button onclick="removeItem('${item._id}')" class="text-ink/25 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5">
          <ion-icon name="trash-outline" class="text-base"></ion-icon>
        </button>
      </div>`).join('');
    if (sub) sub.textContent = formatPrice(subtotal);
  } catch(e) { body.innerHTML = `<p class="text-sm text-red-500 text-center py-8">${e.message}</p>`; }
}

async function addToCart(pid, qty=1, variant='') {
  if (!Auth.isLoggedIn()) { openAuth('login'); showToast('Please log in to add to cart', 'info'); return; }
  try {
    await Cart.add(pid, qty, variant);
    showToast('Added to cart!');
    refreshBadge();
    openCart();
  } catch(e) { showToast(e.message, 'error'); }
}

async function updateItem(id, qty) {
  if (qty <= 0) return removeItem(id);
  try { await Cart.update(id, qty); await renderCart(); refreshBadge(); } catch(e) { showToast(e.message, 'error'); }
}
async function removeItem(id) {
  try { await Cart.remove(id); await renderCart(); refreshBadge(); showToast('Removed from cart', 'info'); } catch(e) { showToast(e.message, 'error'); }
}

async function toggleWishlist(pid, btn) {
  if (!Auth.isLoggedIn()) { openAuth('login'); return; }
  try {
    await Users.toggleWishlist(pid);
    const icon = btn.querySelector('ion-icon');
    if (icon) icon.name = icon.name === 'heart' ? 'heart-outline' : 'heart';
    showToast('Wishlist updated');
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─── Auth Modal ─────────────────────────────────────────────── */
function openAuth(tab = 'login') {
  const m = document.getElementById('auth-modal');
  m.classList.remove('opacity-0', 'pointer-events-none');
  switchAuthTab(tab);
}
function closeAuth() {
  const m = document.getElementById('auth-modal');
  m.classList.add('opacity-0', 'pointer-events-none');
}
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    const active = t.dataset.tab === tab;
    t.classList.toggle('border-ink', active);
    t.classList.toggle('border-transparent', !active);
    t.classList.toggle('text-ink/40', !active);
  });
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Logging in…'; btn.disabled = true;
  try {
    const { token, user } = await Auth.login({ email: e.target.email.value, password: e.target.password.value });
    Auth.saveSession(token, user);
    updateNav(); refreshBadge(); closeAuth();
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`);
    setTimeout(() => {
      if (user.role === 'admin') window.location.href = 'pages/admin-dashboard.html';
      else if (user.role === 'vendor') window.location.href = 'pages/vendor-dashboard.html';
    }, 800);
  } catch(err) { showToast(err.message, 'error'); }
  finally { btn.textContent = 'Log In'; btn.disabled = false; }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  btn.textContent = 'Creating…'; btn.disabled = true;
  try {
    const { token, user } = await Auth.register({
      name: e.target.fullname.value, email: e.target.email.value,
      password: e.target.password.value, role: e.target.role.value,
    });
    Auth.saveSession(token, user);
    updateNav(); refreshBadge(); closeAuth();
    showToast(`Welcome, ${user.name.split(' ')[0]}!`);
  } catch(err) { showToast(err.message, 'error'); }
  finally { btn.textContent = 'Create Account'; btn.disabled = false; }
});

/* ─── Nav ────────────────────────────────────────────────────── */
function updateNav() {
  const user = Auth.getUser();
  document.getElementById('login-btn-nav').classList.toggle('hidden', !!user);
  const um = document.getElementById('user-menu');
  um.classList.toggle('hidden', !user);
  um.classList.toggle('flex', !!user);
  if (user) {
    const init = user.name?.charAt(0)?.toUpperCase() || 'U';
    document.getElementById('user-avatar-init').textContent = init;
    document.getElementById('user-name-nav').textContent = user.name?.split(' ')[0];
    document.getElementById('nav-vendor-link').classList.toggle('hidden', user.role !== 'vendor');
    document.getElementById('nav-admin-link').classList.toggle('hidden', user.role !== 'admin');
  }
}

/* ─── Page data loaders ──────────────────────────────────────── */
async function loadCategories() {
  try {
    const { categories } = await Categories.list();
    const grid = document.getElementById('categories-grid');
    const navCats = document.getElementById('nav-categories');
    const icons = ['shirt-outline','phone-portrait-outline','diamond-outline','color-palette-outline','footprint-outline','grid-outline'];
    grid.innerHTML = categories.map((c, i) => `
      <a href="pages/shop.html?category=${c._id}" class="group aspect-square bg-stone-light rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-accent/10 hover:border-accent/30 border border-transparent transition-all duration-300">
        <ion-icon name="${icons[i] || 'grid-outline'}" class="text-3xl text-ink/40 group-hover:text-accent transition-colors"></ion-icon>
        <span class="text-xs font-medium text-ink/70 group-hover:text-accent transition-colors">${c.name}</span>
      </a>`).join('');
    navCats.innerHTML = categories.map(c =>
      `<a href="pages/shop.html?category=${c._id}" class="block px-3 py-2 text-sm rounded-lg hover:bg-stone-light transition-colors">${c.name}</a>`
    ).join('');
  } catch {}
}

async function loadProductSection(endpoint, gridId, params = {}) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  try {
    let data;
    if (endpoint === 'featured') data = await Products.featured();
    else data = await Products.list({ limit: 8, ...params });
    grid.innerHTML = (data.products || []).map(productCardHTML).join('');
  } catch(e) {
    if (grid) grid.innerHTML = `<p class="col-span-full text-center text-ink/30 py-8 text-sm">${e.message}</p>`;
  }
}

async function loadVendors() {
  try {
    const { vendors } = await Vendors.list({ limit: 4 });
    const grid = document.getElementById('vendors-grid');
    if (!grid) return;
    grid.innerHTML = vendors.map(v => `
      <a href="pages/vendor.html?slug=${v.slug}" class="group bg-white rounded-2xl p-6 border border-stone-mid/50 hover:border-stone-mid hover:shadow-md transition-all text-center">
        <div class="w-16 h-16 rounded-full bg-stone-light overflow-hidden mx-auto mb-4 ring-2 ring-stone-mid group-hover:ring-accent transition-all">
          <img src="${v.logo || 'https://placehold.co/64x64/f5f5f4/a8a29e?text=V'}" class="w-full h-full object-cover" alt="${v.storeName}">
        </div>
        <h3 class="text-sm font-medium mb-1">${v.storeName}</h3>
        <p class="text-xs text-ink/40">${v.numReviews || 0} reviews</p>
      </a>`).join('');
  } catch {}
}

/* ─── Search ─────────────────────────────────────────────────── */
['search-form','search-form-mobile'].forEach(id => {
  document.getElementById(id)?.addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById(id === 'search-form' ? 'search-input' : 'search-input-mobile')?.value?.trim();
    if (q) window.location.href = `pages/shop.html?q=${encodeURIComponent(q)}`;
  });
});

/* ─── Newsletter ─────────────────────────────────────────────── */
document.getElementById('newsletter-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('nl-email').value;
  try {
    const res = await Newsletter.subscribe(email);
    showToast(res.message);
    e.target.reset();
  } catch(err) { showToast(err.message, 'error'); }
});

/* ─── Mobile menu ────────────────────────────────────────────── */
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('hidden');
});

/* ─── Wire up buttons ────────────────────────────────────────── */
document.getElementById('login-btn-nav').addEventListener('click', () => openAuth('login'));
document.getElementById('auth-overlay').addEventListener('click', closeAuth);
document.getElementById('auth-close').addEventListener('click', closeAuth);
document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
document.getElementById('cart-btn').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-overlay-bg').addEventListener('click', closeCart);
document.getElementById('logout-btn').addEventListener('click', Auth.logout);
document.getElementById('checkout-btn').addEventListener('click', () => { closeCart(); window.location.href = 'pages/checkout.html'; });

/* ─── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  refreshBadge();
  loadCategories();
  loadProductSection('featured', 'featured-grid');
  loadProductSection('new', 'new-arrivals-grid', { sort: 'newest', limit: 8 });
  loadProductSection('top', 'top-rated-grid', { sort: 'rating', limit: 8 });
  loadVendors();
});
