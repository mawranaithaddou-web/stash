/* api.js */

// 1. Define the base request logic FIRST
// api.js
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8080/api' 
  : '/api'; // On Firebase, this automatically points to your backend service
const getToken = () => localStorage.getItem('anon_token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

async function request(method, path, body, isFormData = false) {
  const opts = { method, headers: isFormData ? { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) } : headers() };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  // Handle HTML 404 pages being returned instead of JSON
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Server returned HTML/404. Check route registration.");
  }
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
  upload: (path, fd)     => request('POST',   path, fd, true),
  uploadPut: (path, fd)  => request('PUT',    path, fd, true),
};

const Site = {
  getContent: () => api.get('/content'), // Calls the PUBLIC route
};
// 2. Define Delivery SECOND (now 'api' is available)
const Delivery = {
  getOrders: (status) => api.get('/delivery/orders' + (status ? `?status=${status}` : '')),
  updateStatus: (id, data) => api.put(`/delivery/orders/${id}/status`, data),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
const Auth = {
  register: (data)   => api.post('../auth/register', data),
  login:    (data)   => api.post('../auth/login', data),
  me:       ()       => api.get('../auth/me'),
  updatePassword: (data) => api.put('../auth/updatepassword', data),
  logout: () => {
    localStorage.removeItem('anon_token');
    localStorage.removeItem('anon_user');
    window.location.href = '../';
  },
  isLoggedIn: () => !!getToken(),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('anon_user')); } catch { return null; }
  },
  saveSession: (token, user) => {
    localStorage.setItem('anon_token', token);
    localStorage.setItem('anon_user', JSON.stringify(user));
  },
};

// ─── Products ─────────────────────────────────────────────────────────────────
const Products = {
  list:        (params = {}) => api.get('/products?' + new URLSearchParams(params)),
  featured:    ()            => api.get('/products/featured'),
  get:         (id)          => api.get(`/products/${id}`),
  myProducts:  (params = {}) => api.get('/products/vendor/my?' + new URLSearchParams(params)),
  create:      (fd)          => api.upload('/products', fd),
  update:      (id, fd)      => api.uploadPut(`/products/${id}`, fd),
  delete:      (id)          => api.delete(`/products/${id}`),
};

// ─── Categories ───────────────────────────────────────────────────────────────
const Categories = {
  list: () => api.get('/categories'),
  get:  (slug) => api.get(`/categories/${slug}`),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────
const Cart = {
  get:    ()                       => api.get('/cart'),
  add:    (productId, quantity, variant) => api.post('/cart', { productId, quantity, variant }),
  update: (itemId, quantity)       => api.put(`/cart/${itemId}`, { quantity }),
  remove: (itemId)                 => api.delete(`/cart/${itemId}`),
  clear:  ()                       => api.delete('/cart'),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
const Orders = {
  create:    (data)    => api.post('/orders', data),
  myOrders:  (params)  => api.get('/orders/my?' + new URLSearchParams(params)),
  getOrder:  (id)      => api.get(`/orders/my/${id}`),
  cancel:    (id)      => api.put(`/orders/my/${id}/cancel`),
};

// ─── Vendors ──────────────────────────────────────────────────────────────────
const Vendors = {
  list:        (params = {}) => api.get('/vendors?' + new URLSearchParams(params)),
  get:         (slug)        => api.get(`/vendors/${slug}`),
  apply:       (data)        => api.post('/vendors/apply', data),
  myProfile:   ()            => api.get('/vendors/my'),
  updateProfile: (data)      => api.put('/vendors/my', data),
  dashboard:   ()            => api.get('/vendors/my/dashboard'),
  myOrders:    (params = {}) => api.get('/vendors/my/orders?' + new URLSearchParams(params)),
  updateOrderStatus: (orderId, data) => api.put(`/vendors/my/orders/${orderId}/status`, data),
};

// ─── Users ────────────────────────────────────────────────────────────────────
const Users = {
  profile:        ()           => api.get('/users/profile'),
  updateProfile:  (data)       => api.put('/users/profile', data),
  wishlist:       ()           => api.get('/users/wishlist'),
  toggleWishlist: (productId)  => api.post(`/users/wishlist/${productId}`),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
const Payments = {
  createIntent:   (orderId)  => api.post('/payments/create-intent', { orderId }),
  vendorOnboard:  ()         => api.post('/payments/vendor/onboard'),
  vendorStatus:   ()         => api.get('/payments/vendor/status'),
};

// ─── Newsletter ───────────────────────────────────────────────────────────────
const Newsletter = {
  subscribe:   (email) => api.post('/newsletter/subscribe', { email }),
  unsubscribe: (email) => api.post('/newsletter/unsubscribe', { email }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
const Admin = {
  dashboard:           ()                    => api.get('/admin/dashboard'),
  vendors:             (params)              => api.get('/admin/vendors?' + new URLSearchParams(params)),
  updateVendorStatus:  (id, status)          => api.put(`/admin/vendors/${id}/status`, { status }),
  users:               (params)              => api.get('/admin/users?' + new URLSearchParams(params)),
  toggleUserStatus:    (id, isActive)        => api.put(`/admin/users/${id}/status`, { isActive }),
  products:            (params)              => api.get('/admin/products?' + new URLSearchParams(params)),
  toggleFeatured:      (id, isFeatured)      => api.put(`/admin/products/${id}/featured`, { isFeatured }),
  orders:              (params)              => api.get('/admin/orders?' + new URLSearchParams(params)),
  // ── Content management (CMS) ──────────────────────────────────────────────
  getContent:          ()                    => api.get('/content'),
  updateContent:       (data)                => api.put('/content', data),
};

// Public route for website conten


const Notifications = {
  getMine: () => api.get('/users/notifications'),
  markAsRead: (id) => api.put(`/users/notifications/${id}/read`),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
const Reviews = {
  add:    (productId, data) => api.post(`/reviews/${productId}`, data),
  delete: (productId, reviewId) => api.delete(`/reviews/${productId}/${reviewId}`),
};