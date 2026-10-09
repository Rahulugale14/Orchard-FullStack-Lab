'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const currency = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(cents) || 0) / 100);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const state = { user: null, products: [], wishlist: new Set(), cart: [], orders: [], returns: [], query: '', category: 'all', sort: 'featured', view: 'store', pendingAction: null, selectedProduct: null, lastResponse: null, responseTimer: null };

async function api(path, options = {}) {
  const config = { method: options.method || 'GET', credentials: 'same-origin', headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } };
  if (options.body !== undefined) config.body = JSON.stringify(options.body);
  const response = await fetch(path, config);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const error = new Error(body.message || `Request failed with HTTP ${response.status}`);
    error.status = response.status; error.payload = body;
    throw error;
  }
  return { status: response.status, body, headers: response.headers };
}
function toast(message, type = 'success') {
  const node = document.createElement('div'); node.className = `toast${type === 'error' ? ' error' : ''}`; node.textContent = message;
  $('#toastRegion').append(node); window.setTimeout(() => node.remove(), 4500);
}
function openModal(id) { const node = document.getElementById(id); if (!node) return; node.classList.remove('hidden'); document.body.style.overflow = 'hidden'; const focusable = $('input,button,select,textarea', node); if (focusable) window.setTimeout(() => focusable.focus({ preventScroll: true }), 30); }
function closeModal(id) { const node = document.getElementById(id); if (node) node.classList.add('hidden'); if (!$('.modal-backdrop:not(.hidden)')) document.body.style.overflow = ''; }
function showMessage(id, message, type = 'success') { const el = document.getElementById(id); if (!el) return; el.textContent = message; el.classList.remove('hidden', 'error'); if (type === 'error') el.classList.add('error'); }
function clearMessage(id) { const el = document.getElementById(id); if (el) { el.textContent = ''; el.classList.add('hidden'); el.classList.remove('error'); } }
function setView(view) {
  const viewMap = { store: 'storeView', orders: 'ordersView', support: 'supportView', 'api-lab': 'apiLabView' };
  if (!viewMap[view]) view = 'store';
  state.view = view;
  $$('.view').forEach((node) => node.classList.toggle('active-view', node.id === viewMap[view]));
  $$('.nav-link').forEach((node) => { const active = node.dataset.view === view; node.classList.toggle('active', active); if (active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  $('.primary-nav').classList.remove('mobile-open');
  if (view === 'orders') loadOrders();
  if (view === 'api-lab') refreshDbSummary();
  if (view === 'support' && state.user) { $('#supportName').value ||= state.user.name; $('#supportEmail').value ||= state.user.email; }
  if (view === 'api-lab') $('#originLabel').textContent = window.location.origin;
  window.location.hash = view === 'store' ? 'store' : view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setUser(user) {
  state.user = user;
  $('#accountLabel').textContent = user ? user.firstName || user.name.split(' ')[0] : 'Sign in';
  $('.avatar-icon').textContent = user ? (user.firstName || user.name || 'R').slice(0, 1).toUpperCase() : 'R';
  $('#accountButton').setAttribute('aria-label', user ? `Account: ${user.name}` : 'Sign in');
  $('#supportName').value = user?.name || '';
  $('#supportEmail').value = user?.email || '';
}
function updateCartBadge() { const count = state.cart.reduce((sum, item) => sum + item.quantity, 0); $('#cartCount').textContent = String(count); }
function updateHealth(isHealthy, text = '') { const pill = $('#apiHealth'); pill.innerHTML = `<span class="status-dot" style="background:${isHealthy ? '#9dda5f' : '#e17b57'}"></span><span>${escapeHtml(text || (isHealthy ? 'API + DB online' : 'Service unavailable'))}</span>`; }
async function checkHealth() {
  try {
    const { body } = await api('/api/health');
    const healthy = body.status === 'ok' && body.database === 'connected';
    updateHealth(healthy, healthy ? 'API + DB online' : 'Check services');
    $('#backendState').textContent = healthy ? 'Operational' : 'Degraded';
    $('#databaseState').textContent = healthy ? 'Connected' : 'Unavailable';
    $('#dbConnectionBanner').innerHTML = `<span class="status-dot" style="background:${healthy ? '#9dda5f' : '#e17b57'}"></span><span>${healthy ? 'SQLite connection established' : 'Database check failed'}</span><span class="mono">${new Date(body.timestamp || Date.now()).toLocaleString()}</span>`;
  } catch (error) { updateHealth(false); $('#backendState').textContent = 'Offline'; $('#databaseState').textContent = 'Unknown'; }
}
async function loadCurrentUser() {
  try { const { body } = await api('/api/auth/me'); setUser(body.user); await Promise.all([loadCart(), loadWishlist()]); }
  catch { setUser(null); state.cart = []; state.wishlist.clear(); updateCartBadge(); }
}
async function loadProducts() {
  const params = new URLSearchParams({ page: '1', limit: '24', sort: state.sort });
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.category !== 'all') params.set('category', state.category);
  try {
    const { body } = await api(`/api/products?${params}`);
    state.products = body.data || [];
    $('#catalogCount').textContent = String(body.pagination?.total ?? state.products.length).padStart(2, '0');
    $('#showingCount').textContent = String(state.products.length); $('#totalCount').textContent = String(body.pagination?.total ?? state.products.length);
    renderProducts();
  } catch (error) { $('#productGrid').innerHTML = `<div class="empty-state"><h3>Catalog could not load.</h3><p>${escapeHtml(error.message)}</p></div>`; toast(error.message, 'error'); }
}
function renderProducts() {
  const grid = $('#productGrid'); $('#emptyProducts').classList.toggle('hidden', state.products.length > 0); grid.classList.toggle('hidden', state.products.length === 0);
  grid.innerHTML = state.products.map((p) => {
    const saved = state.wishlist.has(p.id);
    const tag = p.tag ? `<span class="product-tag${p.tag === 'NEW' ? ' green' : ''}">${escapeHtml(p.tag)}</span>` : '';
    return `<article class="product-card" data-testid="product-card-${escapeHtml(p.id)}"><div class="product-visual">${tag}<button type="button" class="wishlist-button${saved ? ' saved' : ''}" data-wishlist="${escapeHtml(p.id)}" aria-label="${saved ? 'Remove from' : 'Add to'} wishlist: ${escapeHtml(p.name)}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" /></div><div class="product-info"><div class="product-category">${escapeHtml(p.category)} <span>·</span> ${escapeHtml(p.sku)}</div><h3 data-testid="product-name-${escapeHtml(p.id)}">${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-card-bottom"><span class="product-price" data-testid="product-price-${escapeHtml(p.id)}">${currency(p.priceCents)}</span><button type="button" class="add-button" data-add-product="${escapeHtml(p.id)}" aria-label="Add ${escapeHtml(p.name)} to bag" data-testid="add-to-bag-${escapeHtml(p.id)}">+</button></div><button type="button" class="quick-view-button" data-quick-view="${escapeHtml(p.id)}">Quick view product ↗</button></div></article>`;
  }).join('');
}
async function loadWishlist() {
  if (!state.user) return;
  try { const { body } = await api('/api/wishlist'); state.wishlist = new Set((body.data || []).map((p) => p.id)); renderProducts(); }
  catch (error) { if (error.status !== 401) console.warn('Wishlist refresh failed', error); }
}
async function ensureSignedIn(action) {
  if (state.user) { await action(); return; }
  state.pendingAction = action;
  showAuthTab('signin'); openModal('authModal');
  toast('Sign in to save changes to your account.');
}
async function addProduct(productId, quantity = 1) {
  await ensureSignedIn(async () => {
    try { const { body } = await api('/api/cart/items', { method: 'POST', body: { productId, quantity, color: 'Natural Titanium', storage: '128GB' } }); state.cart = body.items || []; updateCartBadge(); toast('Added to your bag.'); }
    catch (error) { toast(error.message, 'error'); }
  });
}
async function toggleWishlist(productId) {
  await ensureSignedIn(async () => {
    try {
      if (state.wishlist.has(productId)) { await api(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' }); state.wishlist.delete(productId); toast('Removed from wishlist.'); }
      else { await api(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'POST', body: {} }); state.wishlist.add(productId); toast('Saved to wishlist.'); }
      renderProducts();
    } catch (error) { toast(error.message, 'error'); }
  });
}
async function loadCart() {
  if (!state.user) { state.cart = []; updateCartBadge(); return; }
  try { const { body } = await api('/api/cart'); state.cart = body.items || []; updateCartBadge(); }
  catch (error) { if (error.status !== 401) toast(error.message, 'error'); }
}
function renderCart() {
  const container = $('#cartItems'); const empty = $('#cartEmpty'); const totals = $('#cartTotals');
  if (!state.cart.length) { container.innerHTML = ''; empty.classList.remove('hidden'); totals.classList.add('hidden'); return; }
  empty.classList.add('hidden'); totals.classList.remove('hidden');
  container.innerHTML = state.cart.map((item) => `<div class="cart-item" data-cart-item="${item.cartItemId}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"/><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.color)} · ${escapeHtml(item.storage)}</small><div class="cart-item-controls"><button type="button" class="qty-button" data-cart-qty="minus" data-id="${item.cartItemId}" aria-label="Decrease ${escapeHtml(item.name)} quantity">−</button><span class="qty-value">${item.quantity}</span><button type="button" class="qty-button" data-cart-qty="plus" data-id="${item.cartItemId}" aria-label="Increase ${escapeHtml(item.name)} quantity">+</button><button type="button" class="remove-button" data-cart-remove="${item.cartItemId}">Remove</button></div></div><div class="cart-item-price">${currency(item.lineTotalCents)}</div></div>`).join('');
  const subtotal = state.cart.reduce((sum, item) => sum + item.lineTotalCents, 0); $('#cartSubtotal').textContent = currency(subtotal); $('#checkoutTotal').textContent = currency(subtotal); updateCartBadge();
}
async function changeCartItem(id, deltaOrRemove) {
  const item = state.cart.find((x) => x.cartItemId === Number(id)); if (!item) return;
  try {
    if (deltaOrRemove === 'remove') await api(`/api/cart/items/${id}`, { method: 'DELETE' });
    else await api(`/api/cart/items/${id}`, { method: 'PATCH', body: { quantity: Math.max(1, Math.min(20, item.quantity + deltaOrRemove)) } });
    await loadCart(); renderCart();
  } catch (error) { toast(error.message, 'error'); }
}
function showAuthTab(tab) {
  const signin = tab === 'signin'; const signup = tab === 'signup';
  $('#signinForm').classList.toggle('hidden', !signin); $('#signupForm').classList.toggle('hidden', !signup); $('#forgotForm').classList.add('hidden'); $('#resetForm').classList.add('hidden');
  $('#signinTab').classList.toggle('active', signin); $('#signupTab').classList.toggle('active', signup); $('#signinTab').setAttribute('aria-selected', String(signin)); $('#signupTab').setAttribute('aria-selected', String(signup));
  $('#authTitle').innerHTML = signin ? 'Welcome back<span class="brand-period">.</span>' : 'Join the orchard<span class="brand-period">.</span>';
  clearMessage('signinMessage'); clearMessage('signupMessage');
}
async function afterAuthentication(user, message) {
  setUser(user); await Promise.all([loadCart(), loadWishlist()]); closeModal('authModal'); toast(message);
  const action = state.pendingAction; state.pendingAction = null;
  if (action) await action();
}
async function loadOrders() {
  const container = $('#ordersList');
  $('#signOutButton').classList.toggle('hidden', !state.user);
  if (!state.user) { container.innerHTML = `<div class="empty-state"><span class="empty-icon">▤</span><h3>Sign in to see your orders.</h3><p>Your order timeline lives in your Orchard ID.</p><button class="button button-primary" id="signinForOrders">Sign in to continue</button></div>`; $('#returnsPanel').classList.add('hidden'); return; }
  try {
    const [{ body: ordersBody }, { body: returnsBody }] = await Promise.all([api('/api/orders'), api('/api/returns')]); state.orders = ordersBody.data || []; state.returns = returnsBody.data || [];
    $('#ordersNavCount').textContent = String(state.orders.length); $('#ordersNavCount').classList.toggle('hidden', !state.orders.length);
    renderOrders(); renderReturns();
  } catch (error) { container.innerHTML = `<div class="empty-state"><h3>We couldn't load your orders.</h3><p>${escapeHtml(error.message)}</p></div>`; }
}
function renderOrders() {
  const container = $('#ordersList');
  if (!state.orders.length) { container.innerHTML = `<div class="empty-state"><span class="empty-icon">▤</span><h3>Your next great find starts here.</h3><p>Place a practice order to see your order history.</p><button class="button button-primary" data-view="store">Browse the collection</button></div>`; return; }
  container.innerHTML = state.orders.map((o) => {
    const status = escapeHtml(o.status); const statusClass = o.status === 'Cancelled' ? ' cancelled' : '';
    const items = o.items.map((item) => `<div class="order-product"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"/><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.color)} · ${escapeHtml(item.storage)} · Qty ${item.quantity}</small><small>${currency(item.unitPriceCents)} each</small></div></div>`).join('');
    const canReturn = o.status !== 'Cancelled' && !state.returns.some((r) => r.orderId === o.id);
    return `<article class="order-card" data-testid="order-card-${escapeHtml(o.id)}"><div class="order-card-head"><div><div class="order-id-label">ORDER ID <strong>${escapeHtml(o.id)}</strong></div><div class="order-id-label" style="margin-top:5px">Placed ${new Date(o.createdAt).toLocaleString()}</div></div><span class="order-status${statusClass}" data-testid="order-status-${escapeHtml(o.id)}"><span class="status-dot" style="background:${o.status === 'Cancelled' ? '#c64c4c' : '#87ba51'}"></span>${status}</span></div><div class="order-card-body"><div class="order-products">${items}<small style="color:#859187;font-size:9px">Payment: ${escapeHtml(o.paymentMethod)} · Address: ${escapeHtml(o.shipping.city || '')}, ${escapeHtml(o.shipping.country || '')}</small></div><div class="order-price"><small>TOTAL PAID (DEMO)</small><strong>${currency(o.totalCents)}</strong><small>${o.items.reduce((sum, x) => sum + x.quantity, 0)} item(s)</small></div></div><div class="order-actions">${o.status !== 'Delivered' && o.status !== 'Cancelled' ? `<button class="small-action" data-advance-order="${escapeHtml(o.id)}">Simulate next status ↗</button>` : ''}${o.status === 'Processing' ? `<button class="small-action danger" data-cancel-order="${escapeHtml(o.id)}">Cancel order</button>` : ''}${canReturn ? `<button class="small-action" data-return-order="${escapeHtml(o.id)}">Request return</button>` : ''}<button class="small-action" data-order-details="${escapeHtml(o.id)}">Inspect API record</button></div></article>`;
  }).join('');
}
function renderReturns() {
  const panel = $('#returnsPanel'); const container = $('#returnsList');
  if (!state.returns.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden'); container.innerHTML = state.returns.map((r) => `<div class="return-row"><div><strong>${escapeHtml(r.id)}</strong><small>Order ${escapeHtml(r.orderId)} · ${escapeHtml(r.reason)}</small></div><span class="order-status">${escapeHtml(r.status)}</span></div>`).join('');
}
async function performOrderAction(orderId, action) {
  try {
    const route = action === 'advance' ? `/api/orders/${orderId}/status` : `/api/orders/${orderId}/cancel`;
    const { body } = await api(route, { method: action === 'advance' ? 'PATCH' : 'POST', body: {} });
    toast(body.message || 'Order updated.'); await loadOrders();
  } catch (error) { toast(error.message, 'error'); }
}
function openReturn(orderId) { $('#returnOrderId').value = orderId; $('#returnReason').value = ''; $('#returnDetails').value = ''; clearMessage('returnMessage'); openModal('returnModal'); }
function showQuickView(productId) {
  const p = state.products.find((x) => x.id === productId); if (!p) return;
  state.selectedProduct = p;
  $('#quickViewContent').innerHTML = `<div class="quick-view-layout"><div class="quick-view-image"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"/></div><div class="quick-view-details"><div class="product-category">${escapeHtml(p.category)} · ${escapeHtml(p.sku)}</div><h2 id="quickViewTitle">${escapeHtml(p.name)}<span class="brand-period">.</span></h2><p>${escapeHtml(p.description)}</p><div class="product-price">${currency(p.priceCents)}</div><div class="quick-view-specs"><div><small>STOCK</small><strong>${p.stock} units</strong></div><div><small>ITEM CLASS</small><strong>${escapeHtml(p.category)}</strong></div><div><small>SKU</small><strong>${escapeHtml(p.sku)}</strong></div><div><small>TEST KEY</small><strong>${escapeHtml(p.id)}</strong></div></div><button class="button button-primary button-full" data-add-product="${escapeHtml(p.id)}">Add to bag <span>↗</span></button><button class="text-button" style="margin-top:13px" data-wishlist="${escapeHtml(p.id)}">♡ Add to wishlist</button></div></div>`;
  openModal('quickViewModal');
}
function endpointPreset(key) {
  const presets = {
    health: ['GET', '/api/health', {}], products: ['GET', '/api/products?limit=8', {}], product: ['GET', '/api/products/phone-15-pro', {}],
    signup: ['POST', '/api/auth/signup', { firstName: 'API', lastName: 'Tester', email: `api.tester.${Date.now()}@example.com`, password: 'Practice123!', acceptTerms: true }],
    signin: ['POST', '/api/auth/signin', { email: 'test14@gmail.com', password: 'Test1454test', rememberMe: true }],
    me: ['GET', '/api/auth/me', {}], cart: ['GET', '/api/cart', {}], orders: ['GET', '/api/orders', {}],
    support: ['POST', '/api/support', { name: 'API Lab Tester', email: 'api.lab@example.com', orderId: '', message: 'Testing support endpoint persistence.' }], db: ['GET', '/api/qa/db-summary', {}]
  };
  const value = presets[key] || presets.health; $('#requestMethod').value = value[0]; $('#requestPath').value = value[1]; $('#requestBody').value = JSON.stringify(value[2], null, 2);
}
async function sendApiRequest() {
  const method = $('#requestMethod').value; const path = $('#requestPath').value.trim(); const output = $('#responseOutput');
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) { toast('Use a same-origin path beginning with /.', 'error'); return; }
  let payload;
  if ($('#requestBody').value.trim()) { try { payload = JSON.parse($('#requestBody').value); } catch { toast('Request body is not valid JSON.', 'error'); return; } }
  const start = performance.now(); const button = $('#sendRequestButton'); button.disabled = true; button.textContent = 'Sending request…';
  try {
    const result = await api(path, { method, ...(method === 'GET' || method === 'HEAD' ? {} : { body: payload ?? {} }) });
    state.lastResponse = result.body; const duration = Math.round(performance.now() - start); const responseText = JSON.stringify(result.body, null, 2); output.textContent = responseText;
    $('#responseMeta').className = 'response-meta success'; $('#responseMeta').innerHTML = `<span class="response-dot"></span> HTTP ${result.status} · Success`;
    $('#responseDuration').textContent = `${duration} ms`; $('#responseBytes').textContent = `${new TextEncoder().encode(responseText).length} bytes`;
    if (path === '/api/auth/signin' || path === '/api/auth/signup') { await loadCurrentUser(); }
    if (path.startsWith('/api/cart')) await loadCart();
    if (path.startsWith('/api/orders')) await loadOrders();
    if (path === '/api/qa/db-summary') renderDbSummary(result.body);
    if (path === '/api/health') checkHealth();
  } catch (error) {
    const result = error.payload || { error: 'REQUEST_FAILED', message: error.message }; const responseText = JSON.stringify(result, null, 2); output.textContent = responseText; state.lastResponse = result;
    $('#responseMeta').className = 'response-meta error'; $('#responseMeta').innerHTML = `<span class="response-dot"></span> HTTP ${error.status || 'ERR'} · ${escapeHtml(result.error || 'Request failed')}`;
    $('#responseDuration').textContent = `${Math.round(performance.now() - start)} ms`; $('#responseBytes').textContent = `${new TextEncoder().encode(responseText).length} bytes`;
  } finally { button.disabled = false; button.innerHTML = 'Send request <span>↗</span>'; }
}
function renderDbSummary(body) {
  const counts = body.counts || {}; const metadata = [
    ['users', 'USER ACCOUNTS', 'Registered practice accounts'], ['products', 'PRODUCT CATALOG', 'Seeded product records'], ['orders', 'ORDERS', 'Persisted purchase orders'], ['order_items', 'ORDER ITEMS', 'Order line items'], ['cart_items', 'CART ITEMS', 'Active cart rows'], ['wishlist_items', 'WISHLIST ITEMS', 'Saved products'], ['return_requests', 'RETURN REQUESTS', 'Aftercare records'], ['support_tickets', 'SUPPORT TICKETS', 'Support requests'], ['sessions', 'SESSIONS', 'Active/expired session rows'], ['password_reset_tokens', 'RESET TOKENS', 'Demo password reset rows']
  ];
  $('#dbStats').innerHTML = metadata.map(([key, label, description]) => `<div class="db-stat"><span class="db-stat-label">${label}</span><strong>${Number(counts[key] || 0).toLocaleString()}</strong><small>${description}</small></div>`).join('');
  $('#dbCheckedAt').textContent = `Last checked ${new Date(body.checkedAt || Date.now()).toLocaleTimeString()}`;
  $('#dbConnectionBanner').innerHTML = `<span class="status-dot"></span><span>SQLite connection established · Aggregate-only access</span><span id="dbCheckedAt" class="mono">Last checked ${new Date(body.checkedAt || Date.now()).toLocaleTimeString()}</span>`;
}
async function refreshDbSummary() {
  try { const { body } = await api('/api/qa/db-summary'); renderDbSummary(body); $('#databaseState').textContent = 'Connected'; }
  catch (error) { $('#dbStats').innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`; $('#databaseState').textContent = 'Unavailable'; }
}
function decodeForm(form) { return Object.fromEntries(new FormData(form).entries()); }

// Delegated UI events keep cards dynamic while preserving stable, testable selectors.
document.addEventListener('click', async (event) => {
  const target = event.target.closest('button, [data-view]'); if (!target) return;
  if (target.dataset.view) { setView(target.dataset.view); return; }
  if (target.dataset.closeModal) { closeModal(target.dataset.closeModal); return; }
  if (target.dataset.addProduct) { const id = target.dataset.addProduct; closeModal('quickViewModal'); await addProduct(id); return; }
  if (target.dataset.wishlist) { await toggleWishlist(target.dataset.wishlist); return; }
  if (target.dataset.quickView) { showQuickView(target.dataset.quickView); return; }
  if (target.id === 'openCartButton') { await loadCart(); renderCart(); openModal('cartModal'); return; }
  if (target.id === 'accountButton') { if (state.user) { setView('orders'); } else { showAuthTab('signin'); openModal('authModal'); } return; }
  if (target.id === 'signinTab') { showAuthTab('signin'); return; }
  if (target.id === 'signupTab') { showAuthTab('signup'); return; }
  if (target.id === 'mobileMenuButton') { $('.primary-nav').classList.toggle('mobile-open'); return; }
  if (target.id === 'exploreProductsButton') { $('#catalog').scrollIntoView({ behavior: 'smooth' }); return; }
  if (target.id === 'checkoutButton') {
    if (!state.user) { closeModal('cartModal'); state.pendingAction = async () => { await loadCart(); renderCart(); openModal('cartModal'); }; showAuthTab('signin'); openModal('authModal'); return; }
    $('#shipFullName').value = state.user.name; closeModal('cartModal'); $('#checkoutMessage').classList.add('hidden'); $('#checkoutTotal').textContent = $('#cartSubtotal').textContent; openModal('checkoutModal'); return;
  }
  if (target.dataset.cartQty) { const id = Number(target.dataset.id); const item = state.cart.find((x) => x.cartItemId === id); if (item) await changeCartItem(id, target.dataset.cartQty === 'plus' ? 1 : -1); return; }
  if (target.dataset.cartRemove) { await changeCartItem(target.dataset.cartRemove, 'remove'); return; }
  if (target.dataset.advanceOrder) { await performOrderAction(target.dataset.advanceOrder, 'advance'); return; }
  if (target.dataset.cancelOrder) { if (window.confirm('Cancel this practice order? Stock will be restored in the database.')) await performOrderAction(target.dataset.cancelOrder, 'cancel'); return; }
  if (target.dataset.returnOrder) { openReturn(target.dataset.returnOrder); return; }
  if (target.dataset.orderDetails) {
    try { const { body } = await api(`/api/orders/${target.dataset.orderDetails}`); setView('api-lab'); $('#responseOutput').textContent = JSON.stringify(body, null, 2); $('#responseMeta').className = 'response-meta success'; $('#responseMeta').innerHTML = '<span class="response-dot"></span> Loaded order record · HTTP 200'; $('#responseDuration').textContent = '— ms'; $('#responseBytes').textContent = `${new TextEncoder().encode(JSON.stringify(body)).length} bytes`; }
    catch (error) { toast(error.message, 'error'); }
    return;
  }
  if (target.id === 'forgotPasswordButton') { $('#signinForm').classList.add('hidden'); $('#signupForm').classList.add('hidden'); $('#forgotForm').classList.remove('hidden'); clearMessage('forgotMessage'); return; }
  if (target.classList.contains('back-to-signin')) { showAuthTab('signin'); return; }
  if (target.id === 'clearFiltersButton') { state.query = ''; state.category = 'all'; state.sort = 'featured'; $('#productSearch').value = ''; $('#productSort').value = 'featured'; $$('.filter-chip').forEach((x) => x.classList.toggle('active', x.dataset.category === 'all')); await loadProducts(); return; }
  if (target.id === 'sendRequestButton') { await sendApiRequest(); return; }
  if (target.id === 'clearRequestButton') { endpointPreset($('#endpointPreset').value); return; }
  if (target.id === 'refreshDbButton') { await Promise.all([refreshDbSummary(), checkHealth()]); toast('Database summary refreshed.'); return; }
  if (target.id === 'copyResponseButton') { try { await navigator.clipboard.writeText($('#responseOutput').textContent); toast('Response JSON copied.'); } catch { toast('Clipboard access is unavailable in this browser context.', 'error'); } return; }
  if (target.id === 'signinForOrders') { showAuthTab('signin'); openModal('authModal'); return; }
  if (target.id === 'signOutButton') { try { await api('/api/auth/signout', { method: 'POST', body: {} }); setUser(null); state.cart = []; state.wishlist.clear(); updateCartBadge(); await loadProducts(); setView('store'); toast('You have signed out.'); } catch (error) { toast(error.message, 'error'); } return; }
  if (target.dataset.togglePassword) { const input = document.getElementById(target.dataset.togglePassword); input.type = input.type === 'password' ? 'text' : 'password'; target.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password'); return; }
});

$('#categoryFilters').addEventListener('click', async (event) => {
  const target = event.target.closest('[data-category]'); if (!target) return; state.category = target.dataset.category;
  $$('.filter-chip').forEach((button) => button.classList.toggle('active', button === target)); await loadProducts();
});
$('#productSort').addEventListener('change', async (event) => { state.sort = event.target.value; await loadProducts(); });
$('#productSearch').addEventListener('input', () => { state.query = $('#productSearch').value; clearTimeout(state.responseTimer); state.responseTimer = window.setTimeout(loadProducts, 180); });
$('#signinForm').addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage('signinMessage'); const body = { email: $('#signinEmail').value.trim(), password: $('#signinPassword').value, rememberMe: $('#rememberMe').checked };
  try { const { body: response } = await api('/api/auth/signin', { method: 'POST', body }); await afterAuthentication(response.user, 'Signed in successfully.'); }
  catch (error) { showMessage('signinMessage', error.message, 'error'); }
});
$('#signupForm').addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage('signupMessage'); const body = { firstName: $('#signupFirstName').value.trim(), lastName: $('#signupLastName').value.trim(), email: $('#signupEmail').value.trim(), password: $('#signupPassword').value, acceptTerms: $('#acceptTerms').checked };
  try { const { body: response } = await api('/api/auth/signup', { method: 'POST', body }); await afterAuthentication(response.user, 'Your Orchard ID is ready.'); }
  catch (error) { showMessage('signupMessage', error.message, 'error'); }
});
$('#forgotForm').addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage('forgotMessage');
  try { const { body } = await api('/api/auth/password/forgot', { method: 'POST', body: { email: $('#forgotEmail').value.trim() } }); showMessage('forgotMessage', body.demoResetToken ? `Demo reset token: ${body.demoResetToken}` : body.message); if (body.demoResetToken) { $('#resetToken').value = body.demoResetToken; $('#forgotForm').classList.add('hidden'); $('#resetForm').classList.remove('hidden'); } }
  catch (error) { showMessage('forgotMessage', error.message, 'error'); }
});
$('#resetForm').addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage('resetMessage');
  try { const { body } = await api('/api/auth/password/reset', { method: 'POST', body: { email: $('#forgotEmail').value.trim(), token: $('#resetToken').value.trim(), newPassword: $('#resetNewPassword').value } }); showMessage('resetMessage', body.message); }
  catch (error) { showMessage('resetMessage', error.message, 'error'); }
});
$('#checkoutForm').addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage('checkoutMessage'); const shipping = { fullName: $('#shipFullName').value.trim(), address: $('#shipAddress').value.trim(), city: $('#shipCity').value.trim(), zip: $('#shipZip').value.trim(), country: $('#shipCountry').value };
  const paymentMethod = $('input[name="paymentMethod"]:checked').value;
  try { const { body } = await api('/api/orders', { method: 'POST', body: { shipping, paymentMethod } }); closeModal('checkoutModal'); state.orders = [body.order, ...state.orders]; toast(`Order ${body.order.id} created and saved to SQLite.`); await loadCart(); setView('orders'); }
  catch (error) { showMessage('checkoutMessage', error.message, 'error'); }
});
$('#returnForm').addEventListener('submit', async (event) => {
  event.preventDefault(); clearMessage('returnMessage');
  try { const { body } = await api('/api/returns', { method: 'POST', body: { orderId: $('#returnOrderId').value, reason: $('#returnReason').value, details: $('#returnDetails').value.trim() } }); showMessage('returnMessage', `Return request ${body.returnRequest.id} submitted.`); await loadOrders(); window.setTimeout(() => closeModal('returnModal'), 700); toast('Return request persisted.'); }
  catch (error) { showMessage('returnMessage', error.message, 'error'); }
});
$('#supportForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; $('#supportResult').classList.add('hidden'); const body = decodeForm(form);
  try { const { body: response } = await api('/api/support', { method: 'POST', body }); $('#supportResult').textContent = `${response.message} Ticket ID: ${response.ticket.id} · Status: ${response.ticket.status}`; $('#supportResult').classList.remove('hidden'); toast(`Support ticket ${response.ticket.id} created.`); form.reset(); if (state.user) { $('#supportName').value = state.user.name; $('#supportEmail').value = state.user.email; } }
  catch (error) { $('#supportResult').textContent = error.message; $('#supportResult').classList.remove('hidden'); $('#supportResult').style.background = '#fff0ee'; $('#supportResult').style.color = '#a34d47'; }
});
$('#endpointPreset').addEventListener('change', (event) => endpointPreset(event.target.value));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { $$('.modal-backdrop:not(.hidden)').forEach((modal) => closeModal(modal.id)); $('.primary-nav').classList.remove('mobile-open'); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#productSearch').focus(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); }
});
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(backdrop.id); }));
window.addEventListener('hashchange', () => { const view = window.location.hash.slice(1); if (['store', 'orders', 'support', 'api-lab'].includes(view) && view !== state.view) setView(view); });

(async function init() {
  const initialHash = window.location.hash.slice(1); state.view = ['store', 'orders', 'support', 'api-lab'].includes(initialHash) ? initialHash : 'store';
  await Promise.all([checkHealth(), loadCurrentUser(), loadProducts()]);
  setView(state.view);
  endpointPreset('health');
  $('#originLabel').textContent = window.location.origin;
  if (state.view === 'api-lab') await refreshDbSummary();
})();
