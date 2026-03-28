const LEGACY_STORAGE_KEY = "tindahan-tracker-state-v1";
const ACCOUNTS_KEY = "tindahan-tracker-accounts-v1";
const SESSION_KEY = "tindahan-tracker-session-v1";
const STORE_DATA_KEY = "tindahan-tracker-store-data-v1";
const ADMIN_KEY = "tindahan-tracker-admin-v1";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});
const numberFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"];
const cloudConfig = window.TINDAHAN_SUPABASE_CONFIG || {};
const cloudMode = Boolean(window.supabase?.createClient && cloudConfig.url && cloudConfig.anonKey);
const supabaseClient = cloudMode
  ? window.supabase.createClient(cloudConfig.url, cloudConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

let accounts = cloudMode ? [] : loadAccounts();
let adminRecord = cloudMode ? null : loadAdminRecord();
let session = cloudMode ? null : loadSession();
let currentAdmin = cloudMode ? null : resolveCurrentAdmin();
let currentAccount = cloudMode ? null : resolveCurrentAccount();
let state = !cloudMode && currentAccount ? initializeStoreStateForAccount(currentAccount) : buildEmptyState();
let remoteStoreMap = {};
const filters = {
  search: "",
  category: "all",
  stock: "all",
};

let authMode = "login";
let feedbackTimer;
let authMessageTimer;
let adminFeedbackTimer;
let scanStream = null;
let scanDetector = null;
let scanFrameId = 0;
let scanLoopBusy = false;
let lastScannedCode = "";
let lastScannedAt = 0;

const elements = {
  authShell: document.querySelector("#auth-shell"),
  appShell: document.querySelector("#app-shell"),
  adminShell: document.querySelector("#admin-shell"),
  authTabs: document.querySelector("#auth-tabs"),
  loginTab: document.querySelector("#login-tab"),
  signupTab: document.querySelector("#signup-tab"),
  adminTab: document.querySelector("#admin-tab"),
  authTitle: document.querySelector("#auth-title"),
  authSubtitle: document.querySelector("#auth-subtitle"),
  authMessage: document.querySelector("#auth-message"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  signupForm: document.querySelector("#signup-form"),
  signupStoreName: document.querySelector("#signup-store-name"),
  signupOwnerName: document.querySelector("#signup-owner-name"),
  signupEmail: document.querySelector("#signup-email"),
  signupPassword: document.querySelector("#signup-password"),
  signupConfirmPassword: document.querySelector("#signup-confirm-password"),
  adminForm: document.querySelector("#admin-form"),
  adminModeNote: document.querySelector("#admin-mode-note"),
  adminSetupFields: document.querySelector("#admin-setup-fields"),
  adminLoginFields: document.querySelector("#admin-login-fields"),
  adminName: document.querySelector("#admin-name"),
  adminEmail: document.querySelector("#admin-email"),
  adminPassword: document.querySelector("#admin-password"),
  adminConfirmPassword: document.querySelector("#admin-confirm-password"),
  adminLoginEmail: document.querySelector("#admin-login-email"),
  adminLoginPassword: document.querySelector("#admin-login-password"),
  adminSubmit: document.querySelector("#admin-submit"),
  todayLabel: document.querySelector("#today-label"),
  accountBadge: document.querySelector("#account-badge"),
  sessionNote: document.querySelector("#session-note"),
  storeHeading: document.querySelector("#store-heading"),
  storeSubtitle: document.querySelector("#store-subtitle"),
  storeNameDisplay: document.querySelector("#store-name-display"),
  storeOwnerDisplay: document.querySelector("#store-owner-display"),
  logoutButton: document.querySelector("#logout-button"),
  feedbackMessage: document.querySelector("#feedback-message"),
  totalSkus: document.querySelector("#total-skus"),
  totalUnitsFoot: document.querySelector("#total-units-foot"),
  inventoryValue: document.querySelector("#inventory-value"),
  stockValueFoot: document.querySelector("#stock-value-foot"),
  todaySales: document.querySelector("#today-sales"),
  todaySalesFoot: document.querySelector("#today-sales-foot"),
  lowStockCount: document.querySelector("#low-stock-count"),
  lowStockFoot: document.querySelector("#low-stock-foot"),
  inventorySummaryText: document.querySelector("#inventory-summary-text"),
  inventoryValueNote: document.querySelector("#inventory-value-note"),
  searchInput: document.querySelector("#search-input"),
  categoryFilter: document.querySelector("#category-filter"),
  stockFilter: document.querySelector("#stock-filter"),
  inventoryBody: document.querySelector("#inventory-body"),
  productFormTitle: document.querySelector("#product-form-title"),
  productForm: document.querySelector("#product-form"),
  productId: document.querySelector("#product-id"),
  productName: document.querySelector("#product-name"),
  productCategory: document.querySelector("#product-category"),
  productUnit: document.querySelector("#product-unit"),
  productPrice: document.querySelector("#product-price"),
  productStock: document.querySelector("#product-stock"),
  productReorder: document.querySelector("#product-reorder"),
  productSku: document.querySelector("#product-sku"),
  productSubmit: document.querySelector("#product-submit"),
  productClear: document.querySelector("#product-clear"),
  scannerVideo: document.querySelector("#scanner-video"),
  scannerPlaceholder: document.querySelector("#scanner-placeholder"),
  scannerStart: document.querySelector("#scanner-start"),
  scannerStop: document.querySelector("#scanner-stop"),
  scannerStatus: document.querySelector("#scanner-status"),
  scannerManualForm: document.querySelector("#scanner-manual-form"),
  scannerCodeInput: document.querySelector("#scanner-code-input"),
  scannerLastSale: document.querySelector("#scanner-last-sale"),
  saleForm: document.querySelector("#sale-form"),
  saleProduct: document.querySelector("#sale-product"),
  saleQuantity: document.querySelector("#sale-quantity"),
  saleNote: document.querySelector("#sale-note"),
  salePreview: document.querySelector("#sale-preview"),
  restockForm: document.querySelector("#restock-form"),
  restockProduct: document.querySelector("#restock-product"),
  restockQuantity: document.querySelector("#restock-quantity"),
  restockNote: document.querySelector("#restock-note"),
  restockPreview: document.querySelector("#restock-preview"),
  reorderBoard: document.querySelector("#reorder-board"),
  hotSellers: document.querySelector("#hot-sellers"),
  categoryMix: document.querySelector("#category-mix"),
  recentActivity: document.querySelector("#recent-activity"),
  exportData: document.querySelector("#export-data"),
  importTrigger: document.querySelector("#import-trigger"),
  importFile: document.querySelector("#import-file"),
  resetDemo: document.querySelector("#reset-demo"),
  adminTodayLabel: document.querySelector("#admin-today-label"),
  adminCoverageNote: document.querySelector("#admin-coverage-note"),
  adminNameDisplay: document.querySelector("#admin-name-display"),
  adminEmailDisplay: document.querySelector("#admin-email-display"),
  adminFeedbackMessage: document.querySelector("#admin-feedback-message"),
  adminExportButton: document.querySelector("#admin-export-button"),
  adminLogoutButton: document.querySelector("#admin-logout-button"),
  adminTotalUsers: document.querySelector("#admin-total-users"),
  adminUsersFoot: document.querySelector("#admin-users-foot"),
  adminTotalProducts: document.querySelector("#admin-total-products"),
  adminProductsFoot: document.querySelector("#admin-products-foot"),
  adminTotalValue: document.querySelector("#admin-total-value"),
  adminValueFoot: document.querySelector("#admin-value-foot"),
  adminRiskStores: document.querySelector("#admin-risk-stores"),
  adminRiskFoot: document.querySelector("#admin-risk-foot"),
  adminSummaryText: document.querySelector("#admin-summary-text"),
  adminSummaryNote: document.querySelector("#admin-summary-note"),
  adminUsersBody: document.querySelector("#admin-users-body"),
  adminAttentionList: document.querySelector("#admin-attention-list"),
  adminActivityList: document.querySelector("#admin-activity-list"),
  adminOwnerList: document.querySelector("#admin-owner-list"),
};

setupSegmentedTabs();
setupEventListeners();
if (cloudMode) {
  supabaseClient.auth.onAuthStateChange(() => {
    void syncInterface();
  });
}
void syncInterface();

function setupSegmentedTabs() {
  const buttons = document.querySelectorAll("[data-tab-group][data-tab-target]");
  const initializedGroups = new Set();

  buttons.forEach((button) => {
    if (!initializedGroups.has(button.dataset.tabGroup) && button.classList.contains("is-active")) {
      initializedGroups.add(button.dataset.tabGroup);
      activateTab(button.dataset.tabGroup, button.dataset.tabTarget);
    }

    button.addEventListener("click", () => {
      activateTab(button.dataset.tabGroup, button.dataset.tabTarget);
    });
  });
}

function activateTab(group, targetId) {
  if (group === "store-ops" && targetId !== "ops-scan") {
    stopCameraScanner({ silent: true });
  }

  const buttons = document.querySelectorAll(`[data-tab-group="${group}"]`);
  const panels = document.querySelectorAll(`[data-tab-panel="${group}"]`);

  buttons.forEach((button) => {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  panels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function setupEventListeners() {
  elements.authTabs?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-auth-mode]");
    if (!tab) {
      return;
    }

    setAuthMode(tab.dataset.authMode);
  });

  elements.loginTab.addEventListener("click", () => setAuthMode("login"));
  elements.signupTab.addEventListener("click", () => setAuthMode("signup"));
  elements.adminTab.addEventListener("click", () => setAuthMode("admin"));

  elements.loginForm.addEventListener("submit", (event) => {
    void handleLoginSubmit(event);
  });

  elements.signupForm.addEventListener("submit", (event) => {
    void handleSignupSubmit(event);
  });

  elements.adminForm.addEventListener("submit", (event) => {
    void handleAdminSubmit(event);
  });

  elements.searchInput.addEventListener("input", (event) => {
    filters.search = event.target.value.trim().toLowerCase();
    renderInventory();
  });

  elements.categoryFilter.addEventListener("change", (event) => {
    filters.category = event.target.value;
    renderInventory();
  });

  elements.stockFilter.addEventListener("change", (event) => {
    filters.stock = event.target.value;
    renderInventory();
  });

  elements.productForm.addEventListener("submit", handleProductSubmit);
  elements.productClear.addEventListener("click", resetProductForm);
  elements.scannerStart.addEventListener("click", () => {
    void startCameraScanner();
  });
  elements.scannerStop.addEventListener("click", () => {
    stopCameraScanner();
  });
  elements.scannerManualForm.addEventListener("submit", handleScannerManualSubmit);
  elements.saleForm.addEventListener("submit", handleSaleSubmit);
  elements.restockForm.addEventListener("submit", handleRestockSubmit);
  elements.saleProduct.addEventListener("change", updateSalePreview);
  elements.saleQuantity.addEventListener("input", updateSalePreview);
  elements.restockProduct.addEventListener("change", updateRestockPreview);
  elements.restockQuantity.addEventListener("input", updateRestockPreview);
  elements.inventoryBody.addEventListener("click", handleInventoryActions);
  elements.reorderBoard.addEventListener("click", handleReorderActions);
  elements.exportData.addEventListener("click", exportState);
  elements.importTrigger.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importStateFromFile);
  elements.resetDemo.addEventListener("click", resetToDemoState);
  elements.logoutButton.addEventListener("click", logoutCurrentAccount);
  elements.adminExportButton.addEventListener("click", exportAdminReport);
  elements.adminLogoutButton.addEventListener("click", logoutAdmin);
}

function setAuthMode(mode) {
  authMode = ["signup", "admin"].includes(mode) ? mode : "login";
  renderAuthMode();

  if (!currentAccount && !currentAdmin) {
    setAuthMessage(defaultAuthMessage());
  }
}

function renderAuthMode() {
  const isSignup = authMode === "signup";
  const isAdmin = authMode === "admin";

  elements.loginForm.hidden = isSignup || isAdmin;
  elements.signupForm.hidden = !isSignup;
  elements.adminForm.hidden = !isAdmin;
  elements.loginTab.classList.toggle("is-active", authMode === "login");
  elements.signupTab.classList.toggle("is-active", isSignup);
  elements.adminTab.classList.toggle("is-active", isAdmin);
  elements.loginTab.setAttribute("aria-selected", String(authMode === "login"));
  elements.signupTab.setAttribute("aria-selected", String(isSignup));
  elements.adminTab.setAttribute("aria-selected", String(isAdmin));

  if (isSignup) {
    elements.authTitle.textContent = "Create your store account";
    elements.authSubtitle.textContent =
      cloudMode
        ? "Register a shared store account so the same inventory can be used on phone and desktop."
        : "Register a browser-based store account so inventory records remain separate for each business on this device.";
  } else if (isAdmin) {
    renderAdminAuthMode();
  } else {
    elements.authTitle.textContent = "Log in to your store";
    elements.authSubtitle.textContent =
      cloudMode
        ? "Use your registered email address and password to access the shared store workspace."
        : "Use your registered email address and password to access the store workspace on this browser.";
  }
}

function renderVisibility() {
  const hasActiveSession = Boolean(currentAccount || currentAdmin);
  elements.authShell.hidden = hasActiveSession;
  elements.appShell.hidden = !currentAccount;
  elements.adminShell.hidden = !currentAdmin;
}

async function syncInterface() {
  if (cloudMode) {
    await syncCloudInterface();
    return;
  }

  currentAdmin = resolveCurrentAdmin();
  currentAccount = resolveCurrentAccount();
  state = currentAccount ? initializeStoreStateForAccount(currentAccount) : buildEmptyState();
  renderAuthMode();
  renderVisibility();

  if (currentAdmin) {
    stopCameraScanner({ silent: true });
    resetAuthForms();
    renderAdminDashboard();
  } else if (currentAccount) {
    resetAuthForms();
    renderAll();
  } else {
    stopCameraScanner({ silent: true });
    document.title = "Tindahan Tracker | Inventory Management Suite";
    setAuthMessage(defaultAuthMessage());
  }
}

async function syncCloudInterface() {
  renderAuthMode();

  const {
    data: { session: authSession },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Unable to restore Supabase session.", sessionError);
    setAuthMessage("Unable to restore the cloud session right now. Please try again.", "danger");
    return;
  }

  if (!authSession?.user) {
    session = null;
    currentAccount = null;
    currentAdmin = null;
    adminRecord = null;
    accounts = [];
    remoteStoreMap = {};
    state = buildEmptyState();
    stopCameraScanner({ silent: true });
    renderVisibility();
    document.title = "Tindahan Tracker | Inventory Management Suite";
    setAuthMessage(defaultAuthMessage());
    return;
  }

  const profile = await ensureCloudProfile(authSession.user);
  if (!profile) {
    session = null;
    currentAccount = null;
    currentAdmin = null;
    adminRecord = null;
    accounts = [];
    remoteStoreMap = {};
    state = buildEmptyState();
    stopCameraScanner({ silent: true });
    renderVisibility();
    setAuthMessage("Unable to load the cloud account profile right now. Please try again.", "danger");
    return;
  }

  session = {
    role: normalizeCloudRole(profile.role),
    id: profile.user_id,
  };

  if (session.role === "admin") {
    stopCameraScanner({ silent: true });
    currentAccount = null;
    currentAdmin = buildCloudAdmin(profile);
    adminRecord = currentAdmin;
    state = buildEmptyState();
    resetAuthForms();
    await loadCloudAdminWorkspace();
    renderVisibility();
    renderAdminDashboard();
    return;
  }

  currentAdmin = null;
  adminRecord = null;
  currentAccount = buildCloudAccount(profile);
  accounts = [];
  remoteStoreMap = {};
  state = await loadCloudStateForUser(currentAccount.id, currentAccount.storeName);
  if (!state) {
    state = buildEmptyState();
    renderVisibility();
    renderAll();
    setFeedback("Shared data tables are not ready yet. Run supabase-setup.sql in your Supabase project.", "danger");
    return;
  }
  remoteStoreMap[currentAccount.id] = normalizeState(state);
  resetAuthForms();
  renderVisibility();
  renderAll();
}

function normalizeCloudRole(role) {
  return `${role || "store"}`.toLowerCase() === "admin" ? "admin" : "store";
}

function buildCloudAccount(profile) {
  return {
    id: `${profile.user_id}`,
    storeName: `${profile.store_name || "My Store"}`.trim() || "My Store",
    ownerName: `${profile.owner_name || "Store Owner"}`.trim() || "Store Owner",
    email: normalizeEmail(profile.email),
    createdAt: normalizeDate(profile.created_at),
    lastLoginAt: normalizeDate(profile.last_login_at || profile.created_at),
  };
}

function buildCloudAdmin(profile) {
  return {
    id: `${profile.user_id}`,
    name: `${profile.owner_name || "Administrator"}`.trim() || "Administrator",
    email: normalizeEmail(profile.email),
    createdAt: normalizeDate(profile.created_at),
    lastLoginAt: normalizeDate(profile.last_login_at || profile.created_at),
  };
}

async function loadCloudProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("user_id, role, store_name, owner_name, email, created_at, updated_at, last_login_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load Supabase profile.", error);
    return null;
  }

  return data;
}

async function ensureCloudProfile(user) {
  const existingProfile = await loadCloudProfile(user.id);
  const metadata = user.user_metadata || {};
  const preferredRole = existingProfile?.role || normalizeCloudRole(metadata.role);
  const payload = {
    user_id: user.id,
    role: preferredRole,
    store_name: `${existingProfile?.store_name || metadata.store_name || "My Store"}`.trim() || "My Store",
    owner_name:
      `${existingProfile?.owner_name || metadata.owner_name || metadata.display_name || "Store Owner"}`.trim() ||
      "Store Owner",
    email: normalizeEmail(existingProfile?.email || user.email || metadata.email || ""),
    last_login_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, role, store_name, owner_name, email, created_at, updated_at, last_login_at")
    .single();

  if (error) {
    console.error("Unable to upsert Supabase profile.", error);
    return null;
  }

  return data;
}

async function loadCloudStateForUser(userId, storeName) {
  const [productsResult, transactionsResult, activityResult] = await Promise.all([
    supabaseClient
      .from("products")
      .select("id, user_id, sku, name, category, unit, price, stock, reorder_level, updated_at, created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabaseClient
      .from("transactions")
      .select("id, user_id, type, product_id, product_name, quantity, unit, unit_price, total, note, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(160),
    supabaseClient
      .from("activity")
      .select("id, user_id, kind, message, product_id, product_name, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(80),
  ]);

  if (productsResult.error || transactionsResult.error || activityResult.error) {
    console.error("Unable to load shared store data.", {
      productsError: productsResult.error,
      transactionsError: transactionsResult.error,
      activityError: activityResult.error,
    });

    return null;
  }

  const normalized = normalizeState({
    products: (productsResult.data || []).map(mapDatabaseProduct),
    transactions: (transactionsResult.data || []).map(mapDatabaseTransaction),
    activity: (activityResult.data || []).map(mapDatabaseActivity),
  });

  return normalized.activity.length || normalized.products.length || normalized.transactions.length
    ? normalized
    : buildFreshStoreState(storeName);
}

async function loadCloudAdminWorkspace() {
  const [profilesResult, productsResult, transactionsResult, activityResult] = await Promise.all([
    supabaseClient
      .from("profiles")
      .select("user_id, role, store_name, owner_name, email, created_at, updated_at, last_login_at")
      .eq("role", "store")
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("products")
      .select("id, user_id, sku, name, category, unit, price, stock, reorder_level, updated_at, created_at"),
    supabaseClient
      .from("transactions")
      .select("id, user_id, type, product_id, product_name, quantity, unit, unit_price, total, note, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabaseClient
      .from("activity")
      .select("id, user_id, kind, message, product_id, product_name, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(2000),
  ]);

  if (profilesResult.error || productsResult.error || transactionsResult.error || activityResult.error) {
    console.error("Unable to load shared admin workspace.", {
      profilesError: profilesResult.error,
      productsError: productsResult.error,
      transactionsError: transactionsResult.error,
      activityError: activityResult.error,
    });
    accounts = [];
    remoteStoreMap = {};
    setAdminFeedback("Unable to load the shared workspace right now.", "danger");
    return;
  }

  accounts = (profilesResult.data || []).map(buildCloudAccount);
  remoteStoreMap = {};

  accounts.forEach((account) => {
    remoteStoreMap[account.id] = buildEmptyState();
  });

  (productsResult.data || []).forEach((row) => {
    const userId = `${row.user_id}`;
    remoteStoreMap[userId] = remoteStoreMap[userId] || buildEmptyState();
    remoteStoreMap[userId].products.push(mapDatabaseProduct(row));
  });

  (transactionsResult.data || []).forEach((row) => {
    const userId = `${row.user_id}`;
    remoteStoreMap[userId] = remoteStoreMap[userId] || buildEmptyState();
    remoteStoreMap[userId].transactions.push(mapDatabaseTransaction(row));
  });

  (activityResult.data || []).forEach((row) => {
    const userId = `${row.user_id}`;
    remoteStoreMap[userId] = remoteStoreMap[userId] || buildEmptyState();
    remoteStoreMap[userId].activity.push(mapDatabaseActivity(row));
  });

  Object.keys(remoteStoreMap).forEach((userId) => {
    remoteStoreMap[userId] = normalizeState(remoteStoreMap[userId]);
  });
}

function mapDatabaseProduct(row) {
  return {
    id: row.id,
    sku: normalizeCode(row.sku),
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: roundMoney(row.price),
    stock: roundNumber(row.stock),
    reorderLevel: roundNumber(row.reorder_level),
    updatedAt: normalizeDate(row.updated_at),
  };
}

function mapDatabaseTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    productId: `${row.product_id || ""}`,
    productName: row.product_name,
    quantity: roundNumber(row.quantity),
    unit: row.unit,
    unitPrice: roundMoney(row.unit_price),
    total: roundMoney(row.total),
    note: `${row.note || ""}`.trim(),
    occurredAt: normalizeDate(row.occurred_at),
  };
}

function mapDatabaseActivity(row) {
  return {
    id: row.id,
    kind: row.kind,
    message: row.message,
    productId: `${row.product_id || ""}`,
    productName: `${row.product_name || ""}`,
    occurredAt: normalizeDate(row.occurred_at),
  };
}

function loadAccounts() {
  if (cloudMode) {
    return accounts;
  }

  const saved = localStorage.getItem(ACCOUNTS_KEY);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeAccount).filter(Boolean) : [];
  } catch (error) {
    console.warn("Unable to read saved accounts.", error);
    return [];
  }
}

function saveAccounts() {
  if (cloudMode) {
    return;
  }

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function loadAdminRecord() {
  if (cloudMode) {
    return adminRecord;
  }

  const saved = localStorage.getItem(ADMIN_KEY);

  if (!saved) {
    return null;
  }

  try {
    return normalizeAdminRecord(JSON.parse(saved));
  } catch (error) {
    console.warn("Unable to read admin account.", error);
    return null;
  }
}

function saveAdminRecord() {
  if (cloudMode) {
    return;
  }

  if (!adminRecord) {
    localStorage.removeItem(ADMIN_KEY);
    return;
  }

  localStorage.setItem(ADMIN_KEY, JSON.stringify(adminRecord));
}

function loadSession() {
  if (cloudMode) {
    return session;
  }

  const saved = localStorage.getItem(SESSION_KEY);

  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved);
    if (parsed?.role && parsed?.id) {
      return {
        role: parsed.role === "admin" ? "admin" : "store",
        id: `${parsed.id}`,
      };
    }

    if (parsed?.accountId) {
      return { role: "store", id: `${parsed.accountId}` };
    }

    return null;
  } catch (error) {
    console.warn("Unable to read saved session.", error);
    return null;
  }
}

function saveSession(role, id) {
  if (cloudMode) {
    session = { role, id };
    return;
  }

  session = { role, id };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  if (cloudMode) {
    session = null;
    return;
  }

  session = null;
  localStorage.removeItem(SESSION_KEY);
}

function resolveCurrentAccount() {
  if (cloudMode) {
    return currentAccount;
  }

  if (!session?.id || session.role !== "store") {
    return null;
  }

  return accounts.find((account) => account.id === session.id) || null;
}

function resolveCurrentAdmin() {
  if (cloudMode) {
    return currentAdmin;
  }

  if (!session?.id || session.role !== "admin" || !adminRecord) {
    return null;
  }

  return adminRecord.id === session.id ? adminRecord : null;
}

function normalizeAccount(account) {
  if (!account || !account.id || !account.email || !account.passwordHash || !account.passwordSalt) {
    return null;
  }

  return {
    id: `${account.id}`,
    storeName: `${account.storeName || "My Store"}`.trim() || "My Store",
    ownerName: `${account.ownerName || "Store Owner"}`.trim() || "Store Owner",
    email: normalizeEmail(account.email),
    passwordSalt: `${account.passwordSalt}`,
    passwordHash: `${account.passwordHash}`,
    createdAt: normalizeDate(account.createdAt),
    lastLoginAt: normalizeDate(account.lastLoginAt || account.createdAt),
  };
}

function normalizeAdminRecord(admin) {
  if (!admin || !admin.id || !admin.email || !admin.passwordHash || !admin.passwordSalt) {
    return null;
  }

  return {
    id: `${admin.id}`,
    name: `${admin.name || "Admin"}`.trim() || "Admin",
    email: normalizeEmail(admin.email),
    passwordSalt: `${admin.passwordSalt}`,
    passwordHash: `${admin.passwordHash}`,
    createdAt: normalizeDate(admin.createdAt),
    lastLoginAt: normalizeDate(admin.lastLoginAt || admin.createdAt),
  };
}

function loadStoreMap() {
  if (cloudMode) {
    return remoteStoreMap;
  }

  const saved = localStorage.getItem(STORE_DATA_KEY);

  if (!saved) {
    return {};
  }

  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Unable to read saved store data.", error);
    return {};
  }
}

function saveStoreMap(storeMap) {
  if (cloudMode) {
    remoteStoreMap = storeMap;
    return;
  }

  localStorage.setItem(STORE_DATA_KEY, JSON.stringify(storeMap));
}

function initializeStoreStateForAccount(account) {
  if (cloudMode) {
    return normalizeState(remoteStoreMap[account.id] || buildFreshStoreState(account.storeName));
  }

  const storeMap = loadStoreMap();

  if (storeMap[account.id]) {
    return normalizeState(storeMap[account.id]);
  }

  const legacyState = readLegacyState();
  const seededState = legacyState || buildFreshStoreState(account.storeName);
  storeMap[account.id] = seededState;
  saveStoreMap(storeMap);

  if (legacyState) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  return seededState;
}

function readLegacyState() {
  const saved = localStorage.getItem(LEGACY_STORAGE_KEY);

  if (!saved) {
    return null;
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.warn("Unable to migrate legacy inventory state.", error);
    return null;
  }
}

function buildEmptyState() {
  return {
    products: [],
    transactions: [],
    activity: [],
  };
}

function buildFreshStoreState(storeName) {
  return {
    products: [],
    transactions: [],
    activity: [
      buildActivity(
        "snapshot",
        `${storeName} is ready. Add your first products to start tracking inventory.`,
        null,
        0
      ),
    ],
  };
}

function buildDefaultState() {
  const products = [
    buildProduct({
      id: "prod-sardines",
      sku: "CG-001",
      name: "Mega Sardines 155g",
      category: "Canned Goods",
      unit: "can",
      price: 27.5,
      stock: 36,
      reorderLevel: 15,
      minutesAgo: 180,
    }),
    buildProduct({
      id: "prod-noodles",
      sku: "PN-012",
      name: "Lucky Me Pancit Canton",
      category: "Noodles",
      unit: "pack",
      price: 18,
      stock: 52,
      reorderLevel: 20,
      minutesAgo: 140,
    }),
    buildProduct({
      id: "prod-rice",
      sku: "ST-101",
      name: "Premium Rice",
      category: "Staples",
      unit: "kg",
      price: 56,
      stock: 24,
      reorderLevel: 10,
      minutesAgo: 280,
    }),
    buildProduct({
      id: "prod-coffee",
      sku: "BV-018",
      name: "3-in-1 Coffee Mix",
      category: "Beverages",
      unit: "sachet",
      price: 14,
      stock: 64,
      reorderLevel: 24,
      minutesAgo: 50,
    }),
    buildProduct({
      id: "prod-shampoo",
      sku: "PC-032",
      name: "Shampoo Sachet",
      category: "Personal Care",
      unit: "sachet",
      price: 8,
      stock: 18,
      reorderLevel: 22,
      minutesAgo: 24,
    }),
    buildProduct({
      id: "prod-softdrinks",
      sku: "BV-026",
      name: "Soft Drinks 1.5L",
      category: "Beverages",
      unit: "bottle",
      price: 72,
      stock: 12,
      reorderLevel: 8,
      minutesAgo: 95,
    }),
    buildProduct({
      id: "prod-eggs",
      sku: "FR-004",
      name: "Fresh Eggs",
      category: "Fresh Goods",
      unit: "piece",
      price: 9,
      stock: 30,
      reorderLevel: 24,
      minutesAgo: 18,
    }),
  ];

  const transactions = [
    buildTransaction("sale", products[3], 6, "Morning coffee rush", 135),
    buildTransaction("sale", products[6], 12, "Breakfast buyers", 75),
    buildTransaction("sale", products[0], 4, "Lunch items", 55),
    buildTransaction("restock", products[4], 20, "Weekly supplier refill", 26 * 60),
    buildTransaction("restock", products[1], 24, "Added noodle packs", 14 * 60),
  ];

  const activity = [
    buildActivity("snapshot", "Demonstration inventory dataset prepared for review.", null, 5),
    buildActivity("sale", "Logged sale for 6 sachet of 3-in-1 Coffee Mix.", products[3], 135),
    buildActivity("sale", "Logged sale for 12 piece of Fresh Eggs.", products[6], 75),
    buildActivity("restock", "Restocked 20 sachet of Shampoo Sachet.", products[4], 26 * 60),
  ];

  return {
    products,
    transactions,
    activity,
  };
}

function buildProduct(product) {
  return {
    id: product.id || uid("product"),
    sku: normalizeCode(product.sku || ""),
    name: `${product.name || ""}`.trim(),
    category: `${product.category || "General"}`.trim(),
    unit: `${product.unit || "pc"}`.trim(),
    price: roundNumber(product.price),
    stock: roundNumber(product.stock),
    reorderLevel: roundNumber(product.reorderLevel),
    updatedAt: minutesAgoToIso(product.minutesAgo || 0),
  };
}

function buildTransaction(type, product, quantity, note, minutesAgo) {
  return {
    id: uid("txn"),
    type,
    productId: product.id,
    productName: product.name,
    quantity: roundNumber(quantity),
    unit: product.unit,
    unitPrice: roundNumber(product.price),
    total: roundMoney(quantity * product.price),
    note: `${note || ""}`.trim(),
    occurredAt: minutesAgoToIso(minutesAgo),
  };
}

function buildActivity(kind, message, product, minutesAgo) {
  return {
    id: uid("activity"),
    kind,
    message: `${message || ""}`.trim(),
    productId: product?.id || "",
    productName: product?.name || "",
    occurredAt: minutesAgoToIso(minutesAgo || 0),
  };
}

function minutesAgoToIso(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function normalizeState(input) {
  return {
    products: Array.isArray(input?.products)
      ? input.products.map(normalizeProduct).filter(Boolean)
      : [],
    transactions: Array.isArray(input?.transactions)
      ? input.transactions.map(normalizeTransaction).filter(Boolean)
      : [],
    activity: Array.isArray(input?.activity)
      ? input.activity.map(normalizeActivity).filter(Boolean)
      : [],
  };
}

function normalizeProduct(product) {
  if (!product || typeof product.name !== "string" || !product.name.trim()) {
    return null;
  }

  return {
    id: `${product.id || uid("product")}`,
    sku: normalizeCode(product.sku || ""),
    name: product.name.trim(),
    category: `${product.category || "General"}`.trim() || "General",
    unit: `${product.unit || "pc"}`.trim() || "pc",
    price: roundNumber(product.price),
    stock: roundNumber(product.stock),
    reorderLevel: roundNumber(product.reorderLevel),
    updatedAt: normalizeDate(product.updatedAt),
  };
}

function normalizeCode(value) {
  return `${value || ""}`
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeTransaction(transaction) {
  if (!transaction || !transaction.productId || !transaction.type) {
    return null;
  }

  return {
    id: `${transaction.id || uid("txn")}`,
    type: transaction.type === "restock" ? "restock" : "sale",
    productId: `${transaction.productId}`,
    productName: `${transaction.productName || "Unknown product"}`.trim(),
    quantity: roundNumber(transaction.quantity),
    unit: `${transaction.unit || "pc"}`.trim() || "pc",
    unitPrice: roundNumber(transaction.unitPrice),
    total: roundMoney(transaction.total),
    note: `${transaction.note || ""}`.trim(),
    occurredAt: normalizeDate(transaction.occurredAt),
  };
}

function normalizeActivity(activity) {
  if (!activity || typeof activity.message !== "string" || !activity.message.trim()) {
    return null;
  }

  return {
    id: `${activity.id || uid("activity")}`,
    kind: `${activity.kind || "note"}`,
    message: activity.message.trim(),
    productId: `${activity.productId || ""}`,
    productName: `${activity.productName || ""}`,
    occurredAt: normalizeDate(activity.occurredAt),
  };
}

function normalizeDate(value) {
  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
}

function mapSupabaseAuthError(error, fallbackMessage) {
  const message = `${error?.message || fallbackMessage || "Authentication failed."}`.toLowerCase();

  if (message.includes("email not confirmed")) {
    return "Check your email inbox and confirm your account before signing in.";
  }

  if (message.includes("invalid login credentials")) {
    return "That email address or password is incorrect.";
  }

  if (message.includes("user already registered")) {
    return "An account with that email already exists. Log in instead.";
  }

  return error?.message || fallbackMessage || "Authentication failed.";
}

async function handleSignupSubmit(event) {
  event.preventDefault();

  const storeName = elements.signupStoreName.value.trim();
  const ownerName = elements.signupOwnerName.value.trim();
  const email = normalizeEmail(elements.signupEmail.value);
  const password = elements.signupPassword.value;
  const confirmPassword = elements.signupConfirmPassword.value;

  if (!storeName || !ownerName || !email) {
    setAuthMessage("Please complete the account form before continuing.", "danger");
    return;
  }

  if (password.length < 6) {
    setAuthMessage("Use a password with at least 6 characters.", "danger");
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage("The passwords do not match.", "danger");
    return;
  }

  if (cloudMode) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          store_name: storeName,
          owner_name: ownerName,
          role: "store",
        },
      },
    });

    if (error) {
      setAuthMessage(mapSupabaseAuthError(error, "Unable to create the shared account."), "danger");
      return;
    }

    resetAuthForms();

    if (data.session?.user) {
      await syncInterface();
      setFeedback(`Welcome, ${ownerName}. ${storeName} is now available on your shared workspace.`, "success");
    } else {
      setAuthMode("login");
      elements.loginEmail.value = email;
      setAuthMessage(
        "Account created. Confirm the email from Supabase, then sign in on any device.",
        "success"
      );
    }
    return;
  }

  if (accounts.some((account) => account.email === email)) {
    setAuthMode("login");
    elements.loginEmail.value = email;
    setAuthMessage("An account with that email already exists. Log in instead.", "warning");
    return;
  }

  const now = new Date().toISOString();
  const passwordSalt = uid("salt");
  const passwordHash = await hashPassword(password, passwordSalt);

  const account = {
    id: uid("account"),
    storeName,
    ownerName,
    email,
    passwordSalt,
    passwordHash,
    createdAt: now,
    lastLoginAt: now,
  };

  accounts.unshift(account);
  saveAccounts();
  saveSession("store", account.id);
  currentAdmin = null;
  currentAccount = account;
  state = initializeStoreStateForAccount(account);
  resetAuthForms();
  renderVisibility();
  renderAll();
  setFeedback(`Welcome, ${ownerName}. ${storeName} is now available.`, "success");
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const email = normalizeEmail(elements.loginEmail.value);
  const password = elements.loginPassword.value;

  if (cloudMode) {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthMessage(mapSupabaseAuthError(error, "Unable to sign in to the shared workspace."), "danger");
      return;
    }

    elements.loginPassword.value = "";
    await syncInterface();
    if (currentAccount) {
      setFeedback(`Welcome back, ${currentAccount.ownerName}.`, "success");
    } else if (currentAdmin) {
      setAdminFeedback(`Welcome back, ${currentAdmin.name}.`, "success");
    }
    return;
  }

  const account = accounts.find((entry) => entry.email === email);

  if (!account) {
    setAuthMessage("No store account is registered for that email address yet.", "danger");
    return;
  }

  const passwordHash = await hashPassword(password, account.passwordSalt);

  if (passwordHash !== account.passwordHash) {
    setAuthMessage("The password you entered is incorrect. Please try again.", "danger");
    return;
  }

  account.lastLoginAt = new Date().toISOString();
  accounts = accounts.map((entry) => (entry.id === account.id ? account : entry));
  saveAccounts();
  saveSession("store", account.id);
  currentAdmin = null;
  currentAccount = account;
  state = initializeStoreStateForAccount(account);
  renderVisibility();
  renderAll();
  elements.loginPassword.value = "";
  setFeedback(`Welcome back, ${account.ownerName}.`, "success");
}

function renderAdminAuthMode() {
  if (cloudMode) {
    elements.authTitle.textContent = "Administrator sign in";
    elements.authSubtitle.textContent =
      "Use an administrator account connected to the shared Supabase workspace to review all store accounts.";
    elements.adminSetupFields.hidden = true;
    elements.adminLoginFields.hidden = false;
    elements.adminModeNote.querySelector("span").textContent = "Cloud Administrator";
    elements.adminModeNote.querySelector("p").textContent =
      "Administrator access is assigned in Supabase by setting the profile role to admin.";
    elements.adminSubmit.textContent = "Open Administrative Panel";
    return;
  }

  const hasAdmin = Boolean(adminRecord);

  elements.authTitle.textContent = hasAdmin ? "Administrator sign in" : "Administrator setup";
  elements.authSubtitle.textContent = hasAdmin
    ? "Use the administrator credentials assigned to this browser to review all locally stored store accounts."
    : "Create the administrator account for this browser to review all locally stored store accounts.";
  elements.adminSetupFields.hidden = hasAdmin;
  elements.adminLoginFields.hidden = !hasAdmin;
  elements.adminModeNote.querySelector("span").textContent = hasAdmin
    ? "Administrator Sign In"
    : "Administrator Setup";
  elements.adminModeNote.querySelector("p").textContent = hasAdmin
    ? "Only the assigned browser administrator may open the administrative workspace."
    : "This one-time administrator account will oversee all store accounts saved in this browser.";
  elements.adminSubmit.textContent = hasAdmin ? "Open Administrative Panel" : "Create Administrator";
}

function defaultAuthMessage() {
  if (authMode === "signup") {
    return cloudMode
      ? "Register a store account to begin using the shared inventory workspace."
      : "Register a store account to begin using the inventory workspace.";
  }

  if (authMode === "admin") {
    if (cloudMode) {
      return "Sign in with an administrator account to review all shared store accounts.";
    }

    return adminRecord
      ? "Sign in as the browser administrator to review locally stored store accounts."
      : "Create the administrator account for this browser to review locally stored store accounts.";
  }

  return cloudMode
    ? "Use your registered email address and password to access the shared store workspace."
    : "Use your registered email address and password to access the store workspace on this browser.";
}

async function handleAdminSubmit(event) {
  event.preventDefault();

  if (cloudMode) {
    const email = normalizeEmail(elements.adminLoginEmail.value || elements.adminEmail.value);
    const password = elements.adminLoginPassword.value || elements.adminPassword.value;

    if (!email) {
      setAuthMessage("Enter the administrator email before continuing.", "danger");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Administrator password must be at least 6 characters.", "danger");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthMessage(mapSupabaseAuthError(error, "Unable to sign in as administrator."), "danger");
      return;
    }

    const profile = await ensureCloudProfile(data.user || data.session?.user);
    if (!profile || normalizeCloudRole(profile.role) !== "admin") {
      await supabaseClient.auth.signOut();
      setAuthMessage(
        "This account does not have administrator access yet. Set its profile role to admin in Supabase first.",
        "danger"
      );
      return;
    }

    elements.adminLoginPassword.value = "";
    await syncInterface();
    setAdminFeedback(`Welcome back, ${profile.owner_name || "Administrator"}.`, "success");
    return;
  }

  if (!adminRecord) {
    const name = elements.adminName.value.trim();
    const email = normalizeEmail(elements.adminEmail.value);
    const password = elements.adminPassword.value;
    const confirmPassword = elements.adminConfirmPassword.value;

    if (!name || !email) {
      setAuthMessage("Complete the administrator setup form before continuing.", "danger");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Admin password must be at least 6 characters.", "danger");
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage("The administrator passwords do not match.", "danger");
      return;
    }

    const now = new Date().toISOString();
    const passwordSalt = uid("admin-salt");
    const passwordHash = await hashPassword(password, passwordSalt);

    adminRecord = {
      id: uid("admin"),
      name,
      email,
      passwordSalt,
      passwordHash,
      createdAt: now,
      lastLoginAt: now,
    };

    saveAdminRecord();
    saveSession("admin", adminRecord.id);
    currentAccount = null;
    currentAdmin = adminRecord;
    state = buildEmptyState();
    resetAuthForms();
    renderVisibility();
    renderAdminDashboard();
    setAdminFeedback(`Administrator access has been prepared for ${name}.`, "success");
    return;
  }

  const email = normalizeEmail(elements.adminLoginEmail.value);
  const password = elements.adminLoginPassword.value;

  if (email !== adminRecord.email) {
    setAuthMessage("That email address does not match the administrator account saved on this browser.", "danger");
    return;
  }

  const passwordHash = await hashPassword(password, adminRecord.passwordSalt);

  if (passwordHash !== adminRecord.passwordHash) {
    setAuthMessage("The administrator password is incorrect. Please try again.", "danger");
    return;
  }

  adminRecord.lastLoginAt = new Date().toISOString();
  saveAdminRecord();
  saveSession("admin", adminRecord.id);
  currentAccount = null;
  currentAdmin = adminRecord;
  state = buildEmptyState();
  renderVisibility();
  renderAdminDashboard();
  elements.adminLoginPassword.value = "";
  setAdminFeedback(`Welcome back, ${adminRecord.name}.`, "success");
}

function logoutCurrentAccount() {
  stopCameraScanner({ silent: true });

  if (cloudMode) {
    void supabaseClient.auth.signOut();
    currentAccount = null;
    currentAdmin = null;
    state = buildEmptyState();
    accounts = [];
    remoteStoreMap = {};
    resetAppForms();
    renderVisibility();
    setAuthMode("login");
    setAuthMessage("You have signed out of the shared workspace.", "success");
    return;
  }

  clearSession();
  currentAccount = null;
  currentAdmin = null;
  state = buildEmptyState();
  resetAppForms();
  renderVisibility();
  setAuthMode("login");
  setAuthMessage("You have signed out. Another store account may now access this browser.", "success");
}

function logoutAdmin() {
  stopCameraScanner({ silent: true });

  if (cloudMode) {
    void supabaseClient.auth.signOut();
    currentAdmin = null;
    currentAccount = null;
    state = buildEmptyState();
    accounts = [];
    remoteStoreMap = {};
    renderVisibility();
    setAuthMode("admin");
    setAuthMessage("Administrator signed out of the shared workspace.", "success");
    return;
  }

  clearSession();
  currentAdmin = null;
  currentAccount = null;
  state = buildEmptyState();
  renderVisibility();
  setAuthMode("admin");
  setAuthMessage("Administrator signed out. Sign in again to continue monitoring store accounts.", "success");
}

function resetAuthForms() {
  elements.loginForm.reset();
  elements.signupForm.reset();
  elements.adminForm.reset();
}

function resetAppForms() {
  resetProductForm();
  elements.saleForm.reset();
  elements.restockForm.reset();
  updateSalePreview();
  updateRestockPreview();
}

function renderAll() {
  if (!currentAccount) {
    return;
  }

  document.title = `${currentAccount.storeName} | Tindahan Tracker`;
  renderAccountProfile();
  elements.todayLabel.textContent = `Today is ${dayFormatter.format(new Date())}`;
  renderStats();
  populateCategoryFilter();
  populateProductSelectors();
  renderInventory();
  renderReorderBoard();
  renderHotSellers();
  renderCategoryMix();
  renderRecentActivity();
  updateSalePreview();
  updateRestockPreview();
}

function renderAdminDashboard() {
  if (!currentAdmin) {
    return;
  }

  document.title = "Administrative Control Panel | Tindahan Tracker";
  renderAdminProfile();
  renderAdminStats();
  renderAdminUsersTable();
  renderAdminAttentionList();
  renderAdminActivityList();
  renderAdminOwnerList();
}

function renderAccountProfile() {
  elements.storeHeading.textContent = currentAccount.storeName;
  elements.storeSubtitle.textContent =
    `${currentAccount.ownerName} can manage products, sales records, and restock entries from one structured workspace.`;
  elements.accountBadge.textContent = `${currentAccount.ownerName} | ${currentAccount.email}`;
  elements.sessionNote.textContent = cloudMode
    ? "This store account is synced through the shared cloud workspace."
    : "Each store account is maintained separately on this browser.";
  elements.storeNameDisplay.textContent = currentAccount.storeName;
  elements.storeOwnerDisplay.textContent = `${currentAccount.ownerName} | ${currentAccount.email}`;
}

function renderAdminProfile() {
  const summaries = getAdminStoreSummaries();
  elements.adminTodayLabel.textContent = `Today is ${dayFormatter.format(new Date())}`;
  elements.adminCoverageNote.textContent = `Reviewing ${summaries.length} ${
    cloudMode ? "shared" : "locally stored"
  } store account${
    summaries.length === 1 ? "" : "s"
  }.`;
  elements.adminNameDisplay.textContent = currentAdmin.name;
  elements.adminEmailDisplay.textContent = currentAdmin.email;
}

async function saveState() {
  if (!currentAccount) {
    return true;
  }

  const normalized = normalizeState(state);

  if (cloudMode) {
    remoteStoreMap[currentAccount.id] = normalized;
    return persistCloudState(currentAccount.id, normalized);
  }

  const storeMap = loadStoreMap();
  storeMap[currentAccount.id] = normalized;
  saveStoreMap(storeMap);
  return true;
}

async function persistCloudState(userId, storeState) {
  const normalizedState = normalizeState(storeState);
  const productsPayload = normalizedState.products.map((product) => ({
    id: product.id,
    user_id: userId,
    sku: normalizeCode(product.sku),
    name: product.name,
    category: product.category,
    unit: product.unit,
    price: roundMoney(product.price),
    stock: roundNumber(product.stock),
    reorder_level: roundNumber(product.reorderLevel),
    updated_at: normalizeDate(product.updatedAt),
  }));
  const transactionsPayload = normalizedState.transactions.map((transaction) => ({
    id: transaction.id,
    user_id: userId,
    type: transaction.type,
    product_id: transaction.productId || null,
    product_name: transaction.productName,
    quantity: roundNumber(transaction.quantity),
    unit: transaction.unit,
    unit_price: roundMoney(transaction.unitPrice),
    total: roundMoney(transaction.total),
    note: `${transaction.note || ""}`.trim(),
    occurred_at: normalizeDate(transaction.occurredAt),
  }));
  const activityPayload = normalizedState.activity.map((activity) => ({
    id: activity.id,
    user_id: userId,
    kind: activity.kind,
    message: activity.message,
    product_id: activity.productId || null,
    product_name: activity.productName || "",
    occurred_at: normalizeDate(activity.occurredAt),
  }));

  const [deleteProducts, deleteTransactions, deleteActivity] = await Promise.all([
    supabaseClient.from("products").delete().eq("user_id", userId),
    supabaseClient.from("transactions").delete().eq("user_id", userId),
    supabaseClient.from("activity").delete().eq("user_id", userId),
  ]);

  if (deleteProducts.error || deleteTransactions.error || deleteActivity.error) {
    console.error("Unable to clear existing cloud rows before save.", {
      deleteProducts: deleteProducts.error,
      deleteTransactions: deleteTransactions.error,
      deleteActivity: deleteActivity.error,
    });
    return false;
  }

  const writes = [];
  if (productsPayload.length) {
    writes.push(supabaseClient.from("products").insert(productsPayload));
  }
  if (transactionsPayload.length) {
    writes.push(supabaseClient.from("transactions").insert(transactionsPayload));
  }
  if (activityPayload.length) {
    writes.push(supabaseClient.from("activity").insert(activityPayload));
  }

  if (!writes.length) {
    return true;
  }

  const results = await Promise.all(writes);
  const failed = results.find((result) => result.error);
  if (failed) {
    console.error("Unable to write cloud store data.", failed.error);
    return false;
  }

  return true;
}

function renderStats() {
  const totalProducts = state.products.length;
  const totalUnits = sum(state.products.map((product) => product.stock));
  const retailValue = sum(state.products.map((product) => product.stock * product.price));
  const todaySalesTransactions = state.transactions.filter(
    (transaction) => transaction.type === "sale" && isToday(transaction.occurredAt)
  );
  const todaySales = sum(todaySalesTransactions.map((transaction) => transaction.total));
  const lowStockItems = state.products.filter((product) => {
    const status = getProductStatus(product).key;
    return status === "reorder" || status === "out";
  });

  elements.totalSkus.textContent = numberFormatter.format(totalProducts);
  elements.totalUnitsFoot.textContent = `${formatQuantity(totalUnits)} total units on hand`;
  elements.inventoryValue.textContent = currencyFormatter.format(retailValue);
  elements.todaySales.textContent = currencyFormatter.format(todaySales);
  elements.todaySalesFoot.textContent = `${todaySalesTransactions.length} sale${
    todaySalesTransactions.length === 1 ? "" : "s"
  } logged today`;
  elements.lowStockCount.textContent = numberFormatter.format(lowStockItems.length);
  elements.lowStockFoot.textContent = lowStockItems.length
    ? `${lowStockItems.filter((item) => getProductStatus(item).key === "out").length} item(s) are out of stock`
    : "All products are within acceptable stock levels";

  if (totalProducts) {
    const topCategory = getCategorySummaries()[0];
    elements.stockValueFoot.textContent = topCategory
      ? `${topCategory.name} holds the highest stock value`
      : "Calculated from recorded selling prices";
  } else {
    elements.stockValueFoot.textContent = "Add products to calculate stock value";
  }
}

function renderAdminStats() {
  const summaries = getAdminStoreSummaries();
  const totalUsers = summaries.length;
  const totalProducts = sum(summaries.map((summary) => summary.productCount));
  const totalValue = sum(summaries.map((summary) => summary.stockValue));
  const totalTodaySales = sum(summaries.map((summary) => summary.todaySales));
  const riskStores = summaries.filter((summary) => summary.lowStockCount > 0).length;

  elements.adminTotalUsers.textContent = numberFormatter.format(totalUsers);
  elements.adminUsersFoot.textContent = `${totalUsers} store account${totalUsers === 1 ? "" : "s"} ${
    cloudMode ? "registered in the shared workspace" : "registered on this browser"
  }`;
  elements.adminTotalProducts.textContent = numberFormatter.format(totalProducts);
  elements.adminProductsFoot.textContent = `${totalProducts} products recorded across all ${
    cloudMode ? "shared" : "local"
  } stores`;
  elements.adminTotalValue.textContent = currencyFormatter.format(totalValue);
  elements.adminValueFoot.textContent = `Today's combined sales: ${currencyFormatter.format(totalTodaySales)}`;
  elements.adminRiskStores.textContent = numberFormatter.format(riskStores);
  elements.adminRiskFoot.textContent = riskStores
    ? `${riskStores} store${riskStores === 1 ? "" : "s"} need restock attention`
    : "No stores currently require restock attention";
}

function renderAdminUsersTable() {
  const summaries = getAdminStoreSummaries();

  if (!summaries.length) {
    elements.adminUsersBody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            ${cloudMode
              ? "No store accounts have been registered in the shared workspace yet."
              : "No store accounts have been registered on this browser yet."}
          </div>
        </td>
      </tr>
    `;
  } else {
    elements.adminUsersBody.innerHTML = summaries
      .map((summary) => {
        const alertStatus = getAdminRiskStatus(summary);
        return `
          <tr>
            <td>
              <div class="product-cell">
                <span class="product-name">${escapeHtml(summary.storeName)}</span>
                <span class="product-meta">${escapeHtml(summary.email)}</span>
              </div>
            </td>
            <td>
              <div class="product-cell">
                <span>${escapeHtml(summary.ownerName)}</span>
                <span class="product-meta">Created ${dateTimeFormatter.format(new Date(summary.createdAt))}</span>
              </div>
            </td>
            <td>${numberFormatter.format(summary.productCount)}</td>
            <td>${currencyFormatter.format(summary.stockValue)}</td>
            <td>${currencyFormatter.format(summary.todaySales)}</td>
            <td><span class="status-pill ${alertStatus.className}">${escapeHtml(alertStatus.label)}</span></td>
            <td>${dateTimeFormatter.format(new Date(summary.lastLoginAt))}</td>
            <td>${dateTimeFormatter.format(new Date(summary.lastActivityAt))}</td>
          </tr>
        `;
      })
      .join("");
  }

  elements.adminSummaryText.textContent = `Showing ${summaries.length} ${
    cloudMode ? "shared" : "locally stored"
  } store account${
    summaries.length === 1 ? "" : "s"
  }`;
  elements.adminSummaryNote.textContent = cloudMode
    ? "This panel reports on all accounts in the shared Supabase workspace."
    : "This panel reports only on accounts saved on this browser and device.";
}

function renderAdminAttentionList() {
  const flaggedStores = getAdminStoreSummaries()
    .filter((summary) => summary.lowStockCount > 0)
    .sort((left, right) => right.lowStockCount - left.lowStockCount || right.outOfStockCount - left.outOfStockCount);

  if (!flaggedStores.length) {
    elements.adminAttentionList.innerHTML = `
      <div class="empty-state">
        ${cloudMode
          ? "No shared stores are currently below their reorder levels."
          : "No local stores are currently below their reorder levels."}
      </div>
    `;
    return;
  }

  elements.adminAttentionList.innerHTML = flaggedStores
    .slice(0, 6)
    .map((summary) => `
      <article class="list-card">
        <strong>${escapeHtml(summary.storeName)}</strong>
        <div class="list-meta">
          <span>${escapeHtml(summary.ownerName)}</span>
          <span>${summary.lowStockCount} low-stock item${summary.lowStockCount === 1 ? "" : "s"}</span>
        </div>
        <div class="list-meta">
          <span>${summary.outOfStockCount} out of stock</span>
          <span>Value: ${currencyFormatter.format(summary.stockValue)}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderAdminActivityList() {
  const activities = getAdminRecentActivities();

  if (!activities.length) {
    elements.adminActivityList.innerHTML = `
      <div class="empty-state">
        Activity from all store accounts will appear here once users start using the tracker.
      </div>
    `;
    return;
  }

  elements.adminActivityList.innerHTML = activities
    .slice(0, 8)
    .map((activity) => `
      <article class="activity-card">
        <strong>${escapeHtml(activity.message)}</strong>
        <div class="activity-meta">
          <span>${escapeHtml(activity.storeName)}</span>
          <span>${dateTimeFormatter.format(new Date(activity.occurredAt))}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderAdminOwnerList() {
  const summaries = getAdminStoreSummaries();

  if (!summaries.length) {
    elements.adminOwnerList.innerHTML = `
      <div class="empty-state">
        Register store accounts first to populate this administrative view.
      </div>
    `;
    return;
  }

  elements.adminOwnerList.innerHTML = summaries
    .slice()
    .sort((left, right) => new Date(right.lastLoginAt) - new Date(left.lastLoginAt))
    .slice(0, 6)
    .map((summary) => `
      <article class="list-card">
        <strong>${escapeHtml(summary.ownerName)}</strong>
        <div class="list-meta">
          <span>${escapeHtml(summary.storeName)}</span>
          <span>${escapeHtml(summary.email)}</span>
        </div>
        <div class="list-meta">
          <span>Last login: ${dateTimeFormatter.format(new Date(summary.lastLoginAt))}</span>
        </div>
      </article>
    `)
    .join("");
}

function populateCategoryFilter() {
  const currentValue = filters.category;
  const categories = [...new Set(state.products.map((product) => product.category))].sort((left, right) =>
    left.localeCompare(right)
  );

  populateSelect(
    elements.categoryFilter,
    [{ value: "all", label: "All categories" }].concat(
      categories.map((category) => ({ value: category, label: category }))
    ),
    categories.includes(currentValue) || currentValue === "all" ? currentValue : "all"
  );

  filters.category = elements.categoryFilter.value;
}

function populateProductSelectors() {
  const sortedProducts = [...state.products].sort((left, right) => left.name.localeCompare(right.name));
  const options = [{ value: "", label: "Choose a product" }].concat(
    sortedProducts.map((product) => ({
      value: product.id,
      label: `${product.name} (${formatQuantity(product.stock)} ${product.unit} left)`,
    }))
  );

  populateSelect(elements.saleProduct, options, elements.saleProduct.value || "");
  populateSelect(elements.restockProduct, options, elements.restockProduct.value || "");
}

function populateSelect(selectElement, options, selectedValue) {
  selectElement.replaceChildren();

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.value === selectedValue;
    selectElement.append(optionElement);
  });

  if (!Array.from(selectElement.options).some((option) => option.selected)) {
    selectElement.selectedIndex = 0;
  }
}

function renderInventory() {
  if (!currentAccount) {
    return;
  }

  const products = getFilteredProducts();
  const visibleValue = sum(products.map((product) => product.stock * product.price));

  if (!products.length) {
    elements.inventoryBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            No products match your current search. Try another category or add a new item.
          </div>
        </td>
      </tr>
    `;
  } else {
    elements.inventoryBody.innerHTML = products
      .map((product) => {
        const status = getProductStatus(product);
        return `
          <tr>
            <td>
              <div class="product-cell">
                <span class="product-name">${escapeHtml(product.name)}</span>
                <span class="product-meta">${escapeHtml(product.sku ? `Code: ${product.sku}` : "No barcode or code")}</span>
              </div>
            </td>
            <td>
              <div class="product-cell">
                <span>${escapeHtml(product.category)}</span>
                <span class="product-meta">${escapeHtml(product.unit)}</span>
              </div>
            </td>
            <td>${currencyFormatter.format(product.price)}</td>
            <td>
              <div class="product-cell">
                <span>${formatQuantity(product.stock)} ${escapeHtml(product.unit)}</span>
                <span class="product-meta">Reorder at ${formatQuantity(product.reorderLevel)}</span>
              </div>
            </td>
            <td><span class="status-pill ${status.key}">${status.label}</span></td>
            <td>${dateTimeFormatter.format(new Date(product.updatedAt))}</td>
            <td>
              <div class="mini-actions">
                <button class="mini-button" type="button" data-action="edit" data-product-id="${escapeHtml(product.id)}">Edit</button>
                <button class="mini-button warn" type="button" data-action="delete" data-product-id="${escapeHtml(product.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  elements.inventorySummaryText.textContent = `Showing ${products.length} of ${state.products.length} product${
    state.products.length === 1 ? "" : "s"
  }`;
  elements.inventoryValueNote.textContent = `Visible stock value: ${currencyFormatter.format(visibleValue)}`;
}

function renderReorderBoard() {
  const lowStockProducts = [...state.products]
    .filter((product) => {
      const key = getProductStatus(product).key;
      return key === "reorder" || key === "out";
    })
    .sort((left, right) => {
      const scoreDifference = getStatusScore(getProductStatus(left).key) - getStatusScore(getProductStatus(right).key);
      return scoreDifference || left.stock - right.stock || left.name.localeCompare(right.name);
    });

  if (!lowStockProducts.length) {
    elements.reorderBoard.innerHTML = `
      <div class="empty-state">
        No products are currently below their reorder level.
      </div>
    `;
    return;
  }

  elements.reorderBoard.innerHTML = lowStockProducts
    .slice(0, 6)
    .map((product) => {
      const status = getProductStatus(product);
      const suggestedRestock = Math.max(roundNumber(product.reorderLevel * 2 - product.stock), product.reorderLevel);
      return `
        <article class="list-card">
          <strong>${escapeHtml(product.name)}</strong>
          <div class="list-meta">
            <span>${escapeHtml(product.category)}</span>
            <span>${formatQuantity(product.stock)} ${escapeHtml(product.unit)} left</span>
            <span>${status.label}</span>
          </div>
          <div class="list-meta">
            <span>Suggested refill: ${formatQuantity(suggestedRestock)} ${escapeHtml(product.unit)}</span>
            <span>Price: ${currencyFormatter.format(product.price)}</span>
          </div>
          <button class="mini-button" type="button" data-action="edit" data-product-id="${escapeHtml(product.id)}">
            Update Item
          </button>
        </article>
      `;
    })
    .join("");
}

function renderHotSellers() {
  const salesByProduct = new Map();

  state.transactions
    .filter((transaction) => transaction.type === "sale")
    .forEach((transaction) => {
      const current = salesByProduct.get(transaction.productId) || {
        name: transaction.productName,
        unit: transaction.unit,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += transaction.quantity;
      current.revenue += transaction.total;
      salesByProduct.set(transaction.productId, current);
    });

  const topSellers = [...salesByProduct.values()].sort((left, right) => {
    return right.quantity - left.quantity || right.revenue - left.revenue;
  });

  if (!topSellers.length) {
    elements.hotSellers.innerHTML = `
      <div class="empty-state">
        Sales will appear here once you start logging product movement.
      </div>
    `;
    return;
  }

  elements.hotSellers.innerHTML = topSellers
    .slice(0, 5)
    .map(
      (seller) => `
        <article class="list-card">
          <strong>${escapeHtml(seller.name)}</strong>
          <div class="list-meta">
            <span>Sold: ${formatQuantity(seller.quantity)} ${escapeHtml(seller.unit)}</span>
            <span>Revenue: ${currencyFormatter.format(seller.revenue)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderCategoryMix() {
  const categories = getCategorySummaries();

  if (!categories.length) {
    elements.categoryMix.innerHTML = `
      <div class="empty-state">
        Add products to see how your stock value is spread across categories.
      </div>
    `;
    return;
  }

  const highestValue = categories[0].value || 1;

  elements.categoryMix.innerHTML = categories
    .map(
      (category) => `
        <div class="bar-row">
          <div class="bar-header">
            <span>${escapeHtml(category.name)}</span>
            <span>${currencyFormatter.format(category.value)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${(category.value / highestValue) * 100}%"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderRecentActivity() {
  const activities = [...state.activity].sort(
    (left, right) => new Date(right.occurredAt) - new Date(left.occurredAt)
  );

  if (!activities.length) {
    elements.recentActivity.innerHTML = `
      <div class="empty-state">
        Your latest sales, restocks, and product changes will show up here.
      </div>
    `;
    return;
  }

  elements.recentActivity.innerHTML = activities
    .slice(0, 8)
    .map(
      (activity) => `
        <article class="activity-card">
          <strong>${escapeHtml(activity.message)}</strong>
          <div class="activity-meta">
            <span>${dateTimeFormatter.format(new Date(activity.occurredAt))}</span>
            <span>${escapeHtml(formatActivityLabel(activity.kind))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function handleProductSubmit(event) {
  event.preventDefault();

  const productId = elements.productId.value.trim();
  const product = {
    id: productId || uid("product"),
    name: elements.productName.value.trim(),
    category: elements.productCategory.value.trim(),
    unit: elements.productUnit.value.trim(),
    price: roundMoney(elements.productPrice.value),
    stock: roundNumber(elements.productStock.value),
    reorderLevel: roundNumber(elements.productReorder.value),
    sku: normalizeCode(elements.productSku.value),
    updatedAt: new Date().toISOString(),
  };

  if (!product.name || !product.category || !product.unit) {
    setFeedback("Please complete the product form before saving.", "danger");
    return;
  }

  if (product.stock < 0 || product.price < 0 || product.reorderLevel < 0) {
    setFeedback("Stock, price, and reorder level cannot be negative.", "danger");
    return;
  }

  if (product.sku && state.products.some((item) => item.id !== productId && normalizeCode(item.sku) === product.sku)) {
    setFeedback("That barcode or product code is already assigned to another item.", "danger");
    return;
  }

  const existingIndex = state.products.findIndex((item) => item.id === productId);

  if (existingIndex >= 0) {
    state.products[existingIndex] = product;
    addActivity("product-updated", `Updated product details for ${product.name}.`, product);
    if (await saveAndRefresh(`${product.name} was updated.`, "success")) {
      resetProductForm();
    }
  } else {
    state.products.unshift(product);
    addActivity("product-created", `Added ${product.name} to your product list.`, product);
    if (await saveAndRefresh(`${product.name} was added to inventory.`, "success")) {
      resetProductForm();
    }
  }
}

async function recordSale(product, quantity, note, options = {}) {
  if (!product) {
    return { ok: false, message: "Choose a product before recording a sale." };
  }

  if (quantity <= 0) {
    return { ok: false, message: "Sale quantity must be greater than zero." };
  }

  if (product.stock < quantity) {
    return {
      ok: false,
      message: `Only ${formatQuantity(product.stock)} ${product.unit} of ${product.name} are left in stock.`,
    };
  }

  product.stock = roundNumber(product.stock - quantity);
  product.updatedAt = new Date().toISOString();

  state.transactions.unshift({
    id: uid("txn"),
    type: "sale",
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    unitPrice: product.price,
    total: roundMoney(quantity * product.price),
    note,
    occurredAt: new Date().toISOString(),
  });

  addActivity(
    "sale",
    options.activityMessage || `Logged sale for ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
    product
  );
  const saved = await saveAndRefresh(options.feedbackMessage || `${product.name} sale saved.`, "success");
  if (!saved) {
    return { ok: false, message: "The sale could not be synchronized to the shared workspace." };
  }

  return { ok: true, product };
}

async function handleSaleSubmit(event) {
  event.preventDefault();

  const product = getProductById(elements.saleProduct.value);
  const quantity = roundNumber(elements.saleQuantity.value);
  const note = elements.saleNote.value.trim();

  const result = await recordSale(product, quantity, note);
  if (!result.ok) {
    setFeedback(result.message, "danger");
    return;
  }

  elements.saleForm.reset();
  updateSalePreview();
}

async function handleRestockSubmit(event) {
  event.preventDefault();

  const product = getProductById(elements.restockProduct.value);
  const quantity = roundNumber(elements.restockQuantity.value);
  const note = elements.restockNote.value.trim();

  if (!product) {
    setFeedback("Choose a product before recording a restock.", "danger");
    return;
  }

  if (quantity <= 0) {
    setFeedback("Restock quantity must be greater than zero.", "danger");
    return;
  }

  product.stock = roundNumber(product.stock + quantity);
  product.updatedAt = new Date().toISOString();

  state.transactions.unshift({
    id: uid("txn"),
    type: "restock",
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    unitPrice: product.price,
    total: roundMoney(quantity * product.price),
    note,
    occurredAt: new Date().toISOString(),
  });

  addActivity("restock", `Restocked ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`, product);
  if (await saveAndRefresh(`${product.name} restock saved.`, "success")) {
    elements.restockForm.reset();
    updateRestockPreview();
  }
}

function handleInventoryActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;

  if (button.dataset.action === "edit") {
    startEditingProduct(productId);
    return;
  }

  if (button.dataset.action === "delete") {
    void deleteProduct(productId);
  }
}

function handleReorderActions(event) {
  const button = event.target.closest("button[data-action='edit']");
  if (!button) {
    return;
  }

  startEditingProduct(button.dataset.productId);
}

function startEditingProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    setFeedback("That product could not be found anymore.", "warning");
    return;
  }

  activateTab("store-ops", "ops-product");
  elements.productFormTitle.textContent = "Edit product";
  elements.productSubmit.textContent = "Update Product";
  elements.productId.value = product.id;
  elements.productName.value = product.name;
  elements.productCategory.value = product.category;
  elements.productUnit.value = product.unit;
  elements.productPrice.value = product.price;
  elements.productStock.value = product.stock;
  elements.productReorder.value = product.reorderLevel;
  elements.productSku.value = product.sku;
  elements.productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    setFeedback("That product was already removed.", "warning");
    return;
  }

  const confirmed = window.confirm(`Delete ${product.name} from your tracker?`);
  if (!confirmed) {
    return;
  }

  state.products = state.products.filter((item) => item.id !== productId);
  addActivity("product-deleted", `Removed ${product.name} from your product list.`, product);
  const saved = await saveAndRefresh(`${product.name} was deleted.`, "warning");

  if (saved && elements.productId.value === productId) {
    resetProductForm();
  }
}

function resetProductForm() {
  elements.productForm.reset();
  elements.productId.value = "";
  elements.productFormTitle.textContent = "Add a product";
  elements.productSubmit.textContent = "Save Product";
}

function updateSalePreview() {
  const product = getProductById(elements.saleProduct.value);
  const quantity = roundNumber(elements.saleQuantity.value);

  if (!product) {
    elements.salePreview.textContent = "Choose a product to preview the sale amount.";
    return;
  }

  if (quantity <= 0) {
    elements.salePreview.textContent = `${product.name} sells for ${currencyFormatter.format(product.price)} each. ${formatQuantity(product.stock)} ${product.unit} in stock.`;
    return;
  }

  const total = roundMoney(quantity * product.price);
  const remaining = roundNumber(product.stock - quantity);
  elements.salePreview.textContent = `Sale total: ${currencyFormatter.format(total)}. Stock after sale: ${formatQuantity(
    Math.max(remaining, 0)
  )} ${product.unit}.`;
}

function updateRestockPreview() {
  const product = getProductById(elements.restockProduct.value);
  const quantity = roundNumber(elements.restockQuantity.value);

  if (!product) {
    elements.restockPreview.textContent = "Choose a product to preview the new stock level.";
    return;
  }

  if (quantity <= 0) {
    elements.restockPreview.textContent = `${product.name} currently has ${formatQuantity(product.stock)} ${product.unit} in stock.`;
    return;
  }

  elements.restockPreview.textContent = `New stock after restock: ${formatQuantity(product.stock + quantity)} ${
    product.unit
  }. Added value: ${currencyFormatter.format(quantity * product.price)}.`;
}

async function handleScannerManualSubmit(event) {
  event.preventDefault();

  const code = normalizeCode(elements.scannerCodeInput.value);
  if (!code) {
    setScannerStatus("Enter or scan a barcode before selling from code.", "warning");
    return;
  }

  await processScannedCode(code, "manual");
}

function setScannerStatus(message, tone = "default") {
  elements.scannerStatus.textContent = message;

  if (tone === "default") {
    delete elements.scannerStatus.dataset.tone;
  } else {
    elements.scannerStatus.dataset.tone = tone;
  }
}

function updateScannerSurface() {
  const isActive = Boolean(scanStream);
  elements.scannerVideo.hidden = !isActive;
  elements.scannerPlaceholder.hidden = isActive;
  elements.scannerStart.disabled = isActive;
  elements.scannerStop.disabled = !isActive;
}

async function buildScanDetector() {
  if (!("BarcodeDetector" in window)) {
    return null;
  }

  try {
    if (typeof BarcodeDetector.getSupportedFormats === "function") {
      const supportedFormats = await BarcodeDetector.getSupportedFormats();
      const formats = SCAN_FORMATS.filter((format) => supportedFormats.includes(format));
      return formats.length ? new BarcodeDetector({ formats }) : new BarcodeDetector();
    }

    return new BarcodeDetector();
  } catch (error) {
    console.warn("Unable to initialize barcode detector.", error);
    return null;
  }
}

async function startCameraScanner() {
  if (!currentAccount) {
    return;
  }

  activateTab("store-ops", "ops-scan");

  if (scanStream) {
    setScannerStatus("Camera scanner is already active.", "success");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setScannerStatus("This browser cannot open the camera. Use manual barcode entry instead.", "warning");
    return;
  }

  scanDetector = await buildScanDetector();
  if (!scanDetector) {
    setScannerStatus(
      "Live camera scanning is not available on this browser. Use manual barcode entry or a handheld scanner.",
      "warning"
    );
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    elements.scannerVideo.srcObject = scanStream;
    await elements.scannerVideo.play();
    scanLoopBusy = false;
    lastScannedCode = "";
    lastScannedAt = 0;
    updateScannerSurface();
    setScannerStatus("Camera scanner is active. Each recognized code records one sale unit.", "success");
    queueScanFrame();
  } catch (error) {
    console.error("Unable to start barcode scanner.", error);
    stopCameraScanner({ silent: true });
    setScannerStatus("Camera access was not granted. Allow camera access and try again.", "danger");
  }
}

function queueScanFrame() {
  if (!scanStream) {
    return;
  }

  if (scanFrameId) {
    window.cancelAnimationFrame(scanFrameId);
  }

  scanFrameId = window.requestAnimationFrame(() => {
    void scanFrame();
  });
}

async function scanFrame() {
  if (!scanStream) {
    return;
  }

  if (scanLoopBusy || elements.scannerVideo.readyState < 2) {
    queueScanFrame();
    return;
  }

  scanLoopBusy = true;

  try {
    const barcodes = await scanDetector.detect(elements.scannerVideo);
    if (Array.isArray(barcodes) && barcodes.length) {
      const code = normalizeCode(barcodes[0].rawValue);
      const now = Date.now();

      if (code && (code !== lastScannedCode || now - lastScannedAt > 1600)) {
        lastScannedCode = code;
        lastScannedAt = now;
        await processScannedCode(code, "camera");
      }
    }
  } catch (error) {
    console.warn("Barcode detection failed for this frame.", error);
  } finally {
    scanLoopBusy = false;
    queueScanFrame();
  }
}

function stopCameraScanner(options = {}) {
  if (scanFrameId) {
    window.cancelAnimationFrame(scanFrameId);
    scanFrameId = 0;
  }

  scanLoopBusy = false;
  scanDetector = null;
  lastScannedCode = "";
  lastScannedAt = 0;

  if (elements.scannerVideo.srcObject) {
    const mediaStream = elements.scannerVideo.srcObject;
    mediaStream.getTracks().forEach((track) => track.stop());
    elements.scannerVideo.srcObject = null;
  }

  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }

  updateScannerSurface();

  if (!options.silent) {
    setScannerStatus("Camera scanner is off. Start the camera when you are ready to scan again.");
  }
}

async function processScannedCode(rawCode, source) {
  const code = normalizeCode(rawCode);
  if (!code) {
    setScannerStatus("A valid barcode is required before a scan can be recorded.", "warning");
    return;
  }

  const product = getProductByCode(code);
  if (!product) {
    setScannerStatus(
      `No product matches code ${code}. Save that barcode in the product code field first.`,
      "danger"
    );
    elements.scannerLastSale.textContent = `Last scanned code: ${code}. No matching product was found.`;
    elements.scannerCodeInput.value = "";
    return;
  }

  const result = await recordSale(product, 1, `${source === "camera" ? "Camera" : "Manual"} barcode scan: ${code}`, {
    activityMessage: `Recorded barcode sale for 1 ${product.unit} of ${product.name}.`,
    feedbackMessage: `${product.name} was sold from barcode scan.`,
  });

  if (!result.ok) {
    setScannerStatus(result.message, "danger");
    elements.scannerLastSale.textContent = `${product.name} was not sold because the stock is too low.`;
    elements.scannerCodeInput.value = "";
    return;
  }

  setScannerStatus(
    `${product.name} recorded successfully. ${formatQuantity(product.stock)} ${product.unit} remaining.`,
    "success"
  );
  elements.scannerLastSale.textContent = `${product.name} | Code: ${code} | Remaining stock: ${formatQuantity(
    product.stock
  )} ${product.unit}`;
  elements.scannerCodeInput.value = "";
}

function exportState() {
  if (!currentAccount) {
    return;
  }

  const payload = JSON.stringify(
    {
      account: {
        storeName: currentAccount.storeName,
        ownerName: currentAccount.ownerName,
        email: currentAccount.email,
      },
      state,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(currentAccount.storeName)}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setFeedback("Backup downloaded successfully.", "success");
}

function exportAdminReport() {
  if (!currentAdmin) {
    return;
  }

  const payload = JSON.stringify(
    {
      admin: {
        name: currentAdmin.name,
        email: currentAdmin.email,
      },
      summaries: getAdminStoreSummaries(),
      recentActivity: getAdminRecentActivities(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-user-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setAdminFeedback("User report exported successfully.", "success");
}

function importStateFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(`${reader.result || "{}"}`);
      state = normalizeState(parsed.state ?? parsed);
      addActivity("import", "Imported a backup file into the inventory workspace.", null);
      if (await saveAndRefresh("Backup imported successfully.", "success")) {
        resetProductForm();
      }
    } catch (error) {
      console.error("Unable to import backup.", error);
      setFeedback("That backup file could not be imported. Please use a valid JSON export.", "danger");
    } finally {
      elements.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

async function resetToDemoState() {
  const confirmed = window.confirm(
    "Load the demonstration inventory into this store account? This will replace the current saved data."
  );
  if (!confirmed) {
    return;
  }

  state = buildDefaultState();
  addActivity("reset", "Loaded the demonstration inventory dataset.", null);
  if (await saveAndRefresh("Demonstration inventory loaded.", "warning")) {
    resetProductForm();
  }
}

async function saveAndRefresh(message, tone) {
  const saved = await saveState();
  renderAll();
  if (!saved) {
    setFeedback("The change could not be synchronized to the shared workspace. Please try again.", "danger");
    return false;
  }

  setFeedback(message, tone);
  return true;
}

function addActivity(kind, message, product) {
  state.activity.unshift({
    id: uid("activity"),
    kind,
    message,
    productId: product?.id || "",
    productName: product?.name || "",
    occurredAt: new Date().toISOString(),
  });

  state.activity = state.activity.slice(0, 80);
  state.transactions = state.transactions.slice(0, 160);
}

function getFilteredProducts() {
  return [...state.products]
    .filter((product) => {
      const haystack = `${product.name} ${product.category} ${product.sku}`.toLowerCase();
      const matchesSearch = !filters.search || haystack.includes(filters.search);
      const matchesCategory = filters.category === "all" || product.category === filters.category;
      const matchesStatus = filters.stock === "all" || getProductStatus(product).key === filters.stock;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((left, right) => {
      const statusDifference = getStatusScore(getProductStatus(left).key) - getStatusScore(getProductStatus(right).key);
      return statusDifference || right.stock - left.stock || left.name.localeCompare(right.name);
    });
}

function getProductStatus(product) {
  if (product.stock <= 0) {
    return { key: "out", label: "Out of stock" };
  }

  if (product.stock <= product.reorderLevel) {
    return { key: "reorder", label: "Reorder now" };
  }

  if (product.stock <= product.reorderLevel * 1.5) {
    return { key: "watch", label: "Watch closely" };
  }

  return { key: "healthy", label: "Healthy stock" };
}

function getStatusScore(status) {
  return {
    out: 0,
    reorder: 1,
    watch: 2,
    healthy: 3,
  }[status] ?? 4;
}

function getProductById(productId) {
  return state.products.find((product) => product.id === productId);
}

function getProductByCode(code) {
  const normalizedCode = normalizeCode(code);
  return state.products.find((product) => normalizeCode(product.sku) === normalizedCode) || null;
}

function getCategorySummaries() {
  const totals = new Map();

  state.products.forEach((product) => {
    totals.set(product.category, (totals.get(product.category) || 0) + product.price * product.stock);
  });

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value: roundMoney(value) }))
    .sort((left, right) => right.value - left.value);
}

function getAdminStoreSummaries() {
  const storeMap = loadStoreMap();

  return accounts
    .map((account) => {
      const storeState = normalizeState(storeMap[account.id] || buildEmptyState());
      const products = storeState.products;
      const lowStockProducts = products.filter((product) => {
        const status = getProductStatus(product).key;
        return status === "reorder" || status === "out";
      });
      const outOfStockCount = lowStockProducts.filter((product) => getProductStatus(product).key === "out").length;
      const todaySales = sum(
        storeState.transactions
          .filter((transaction) => transaction.type === "sale" && isToday(transaction.occurredAt))
          .map((transaction) => transaction.total)
      );
      const stockValue = sum(products.map((product) => product.stock * product.price));
      const latestActivity = [...storeState.activity]
        .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))[0];

      return {
        id: account.id,
        storeName: account.storeName,
        ownerName: account.ownerName,
        email: account.email,
        createdAt: account.createdAt,
        lastLoginAt: account.lastLoginAt,
        lastActivityAt: latestActivity?.occurredAt || account.createdAt,
        productCount: products.length,
        totalUnits: sum(products.map((product) => product.stock)),
        stockValue,
        todaySales,
        lowStockCount: lowStockProducts.length,
        outOfStockCount,
      };
    })
    .sort((left, right) => new Date(right.lastActivityAt) - new Date(left.lastActivityAt));
}

function getAdminRecentActivities() {
  const storeMap = loadStoreMap();

  return accounts
    .flatMap((account) => {
      const storeState = normalizeState(storeMap[account.id] || buildEmptyState());
      return storeState.activity.map((activity) => ({
        ...activity,
        storeName: account.storeName,
        ownerName: account.ownerName,
        email: account.email,
      }));
    })
    .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));
}

function getAdminRiskStatus(summary) {
  if (summary.outOfStockCount > 0) {
    return {
      className: "admin-danger",
      label: `${summary.outOfStockCount} out`,
    };
  }

  if (summary.lowStockCount > 0) {
    return {
      className: "admin-watch",
      label: `${summary.lowStockCount} low`,
    };
  }

  return {
    className: "admin-good",
    label: "Healthy",
  };
}

function isToday(isoDate) {
  const candidate = new Date(isoDate);
  const today = new Date();
  return (
    candidate.getFullYear() === today.getFullYear() &&
    candidate.getMonth() === today.getMonth() &&
    candidate.getDate() === today.getDate()
  );
}

function formatActivityLabel(kind) {
  return {
    sale: "Sale",
    restock: "Restock",
    "product-created": "New item",
    "product-updated": "Product edit",
    "product-deleted": "Removed item",
    import: "Backup import",
    reset: "Demo reload",
    snapshot: "Store setup",
  }[kind] || "Update";
}

function setAuthMessage(message, tone = "default") {
  window.clearTimeout(authMessageTimer);
  elements.authMessage.textContent = message;

  if (tone === "default") {
    delete elements.authMessage.dataset.tone;
    return;
  }

  elements.authMessage.dataset.tone = tone;
  authMessageTimer = window.setTimeout(() => {
    elements.authMessage.textContent = defaultAuthMessage();
    delete elements.authMessage.dataset.tone;
  }, 4200);
}

function setFeedback(message, tone = "default") {
  window.clearTimeout(feedbackTimer);
  elements.feedbackMessage.textContent = message;

  if (tone === "default") {
    delete elements.feedbackMessage.dataset.tone;
  } else {
    elements.feedbackMessage.dataset.tone = tone;
  }

  feedbackTimer = window.setTimeout(() => {
    elements.feedbackMessage.textContent = "The inventory workspace is ready.";
    delete elements.feedbackMessage.dataset.tone;
  }, 4200);
}

function setAdminFeedback(message, tone = "default") {
  window.clearTimeout(adminFeedbackTimer);
  elements.adminFeedbackMessage.textContent = message;

  if (tone === "default") {
    delete elements.adminFeedbackMessage.dataset.tone;
  } else {
    elements.adminFeedbackMessage.dataset.tone = tone;
  }

  adminFeedbackTimer = window.setTimeout(() => {
    elements.adminFeedbackMessage.textContent = "Administrative monitoring is active.";
    delete elements.adminFeedbackMessage.dataset.tone;
  }, 4200);
}

async function hashPassword(password, salt) {
  const input = `${salt}::${password}`;

  if (window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return fallbackHash(input);
}

function fallbackHash(input) {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `fallback-${(hash >>> 0).toString(16)}`;
}

function normalizeEmail(value) {
  return `${value || ""}`.trim().toLowerCase();
}

function slugify(value) {
  const normalized = `${value || "store"}`.trim().toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "store";
}

function sum(values) {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

function roundMoney(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function roundNumber(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function formatQuantity(value) {
  return numberFormatter.format(roundNumber(value));
}

function escapeHtml(value) {
  return `${value || ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
