const LEGACY_STORAGE_KEY = "tindahan-tracker-state-v1";
const ACCOUNTS_KEY = "tindahan-tracker-accounts-v1";
const SESSION_KEY = "tindahan-tracker-session-v1";
const STORE_DATA_KEY = "tindahan-tracker-store-data-v1";
const ADMIN_KEY = "tindahan-tracker-admin-v1";
const RECOVERY_KEY = "tindahan-tracker-recovery-v1";

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
const CLOUD_SYNC_INTERVAL_MS = 8000;
const APP_VERSION = "20260329k";
const cloudConfig = window.TINDAHAN_SUPABASE_CONFIG || {};
const cloudMode = Boolean(window.supabase?.createClient && cloudConfig.url && cloudConfig.anonKey);
const emailRedirectTo = new URL("/", window.location.href).toString();
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
const cloudTableStatus = {
  debts: null,
  expenses: null,
};
const cloudColumnSupport = {
  products: {
    cost_price: true,
    image_url: true,
  },
  transactions: {
    unit_cost: true,
    cost_total: true,
    profit_amount: true,
    customer_name: true,
    receipt_number: true,
  },
};
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
let activeScannerContext = null;
let scanFrameId = 0;
let scanLoopBusy = false;
let lastScannedCode = "";
let lastScannedAt = 0;
let recoveryCandidate = null;
let cloudSyncPollId = 0;
let cloudSyncInFlight = false;
let lastCloudSyncMarker = "";
let lastCloudSaveErrorMessage = "";
let deferredInstallPrompt = null;

const elements = {
  authShell: document.querySelector("#auth-shell"),
  appShell: document.querySelector("#app-shell"),
  adminShell: document.querySelector("#admin-shell"),
  busyOverlay: document.querySelector("#busy-overlay"),
  busyLabel: document.querySelector("#busy-label"),
  authTabs: document.querySelector("#auth-tabs"),
  loginTab: document.querySelector("#login-tab"),
  signupTab: document.querySelector("#signup-tab"),
  adminTab: document.querySelector("#admin-tab"),
  authTitle: document.querySelector("#auth-title"),
  authSubtitle: document.querySelector("#auth-subtitle"),
  authMessage: document.querySelector("#auth-message"),
  installPanels: document.querySelectorAll("[data-install-panel]"),
  installPanelNotes: document.querySelectorAll("[data-install-note]"),
  installButtons: document.querySelectorAll("[data-install-button]"),
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
  recoveryBanner: document.querySelector("#recovery-banner"),
  recoveryBannerText: document.querySelector("#recovery-banner-text"),
  recoveryAction: document.querySelector("#recovery-action"),
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
  productCostPrice: document.querySelector("#product-cost-price"),
  productStock: document.querySelector("#product-stock"),
  productReorder: document.querySelector("#product-reorder"),
  productSku: document.querySelector("#product-sku"),
  productSubmit: document.querySelector("#product-submit"),
  productClear: document.querySelector("#product-clear"),
  productScanMode: document.querySelector("#product-scan-mode"),
  productScanQuantity: document.querySelector("#product-scan-quantity"),
  productScanStatus: document.querySelector("#product-scan-status"),
  productScannerVideo: document.querySelector("#product-scanner-video"),
  productScannerPlaceholder: document.querySelector("#product-scanner-placeholder"),
  productScannerStart: document.querySelector("#product-scanner-start"),
  productScannerStop: document.querySelector("#product-scanner-stop"),
  productScannerManualForm: document.querySelector("#product-scanner-manual-form"),
  productScannerCodeInput: document.querySelector("#product-scanner-code-input"),
  productScannerLastResult: document.querySelector("#product-scanner-last-result"),
  scannerVideo: document.querySelector("#scanner-video"),
  scannerPlaceholder: document.querySelector("#scanner-placeholder"),
  scannerStart: document.querySelector("#scanner-start"),
  scannerStop: document.querySelector("#scanner-stop"),
  scannerStatus: document.querySelector("#scanner-status"),
  scannerAction: document.querySelector("#scanner-action"),
  scannerModeButtons: document.querySelectorAll("[data-scanner-mode]"),
  scannerQuantity: document.querySelector("#scanner-quantity"),
  scannerManualForm: document.querySelector("#scanner-manual-form"),
  scannerCodeInput: document.querySelector("#scanner-code-input"),
  scannerLastSale: document.querySelector("#scanner-last-sale"),
  saleForm: document.querySelector("#sale-form"),
  saleProduct: document.querySelector("#sale-product"),
  saleQuantity: document.querySelector("#sale-quantity"),
  saleCustomerName: document.querySelector("#sale-customer-name"),
  saleNote: document.querySelector("#sale-note"),
  salePreview: document.querySelector("#sale-preview"),
  salePrintLatest: document.querySelector("#sale-print-latest"),
  saleLatestReceiptNumber: document.querySelector("#sale-latest-receipt-number"),
  saleLatestReceiptCustomer: document.querySelector("#sale-latest-receipt-customer"),
  saleLatestReceiptTotal: document.querySelector("#sale-latest-receipt-total"),
  saleLatestReceiptProfit: document.querySelector("#sale-latest-receipt-profit"),
  restockForm: document.querySelector("#restock-form"),
  restockProduct: document.querySelector("#restock-product"),
  restockQuantity: document.querySelector("#restock-quantity"),
  restockNote: document.querySelector("#restock-note"),
  restockPreview: document.querySelector("#restock-preview"),
  debtForm: document.querySelector("#debt-form"),
  debtCustomerName: document.querySelector("#debt-customer-name"),
  debtCustomerOptions: document.querySelector("#debt-customer-options"),
  debtType: document.querySelector("#debt-type"),
  debtAmount: document.querySelector("#debt-amount"),
  debtNote: document.querySelector("#debt-note"),
  debtPreview: document.querySelector("#debt-preview"),
  debtTotalBalance: document.querySelector("#debt-total-balance"),
  debtActiveCustomers: document.querySelector("#debt-active-customers"),
  debtLastPayment: document.querySelector("#debt-last-payment"),
  debtCustomerList: document.querySelector("#debt-customer-list"),
  expenseForm: document.querySelector("#expense-form"),
  expenseCategory: document.querySelector("#expense-category"),
  expenseAmount: document.querySelector("#expense-amount"),
  expenseNote: document.querySelector("#expense-note"),
  expensePreview: document.querySelector("#expense-preview"),
  expenseTodayTotal: document.querySelector("#expense-today-total"),
  expenseMonthTotal: document.querySelector("#expense-month-total"),
  expenseLastCategory: document.querySelector("#expense-last-category"),
  expenseRecentList: document.querySelector("#expense-recent-list"),
  reorderUrgentCount: document.querySelector("#reorder-urgent-count"),
  reorderSuggestedValue: document.querySelector("#reorder-suggested-value"),
  reorderPriorityItem: document.querySelector("#reorder-priority-item"),
  smartInsightsList: document.querySelector("#smart-insights-list"),
  reorderBoard: document.querySelector("#reorder-board"),
  hotSellers: document.querySelector("#hot-sellers"),
  profitLeaders: document.querySelector("#profit-leaders"),
  categoryMix: document.querySelector("#category-mix"),
  weeklySalesTrend: document.querySelector("#weekly-sales-trend"),
  financeTodayProfit: document.querySelector("#finance-today-profit"),
  financeTodaySales: document.querySelector("#finance-today-sales"),
  financeTodayExpenses: document.querySelector("#finance-today-expenses"),
  financeMonthProfit: document.querySelector("#finance-month-profit"),
  financeMonthSales: document.querySelector("#finance-month-sales"),
  financeMonthExpenses: document.querySelector("#finance-month-expenses"),
  financeOutstandingBalance: document.querySelector("#finance-outstanding-balance"),
  financeActiveDebtors: document.querySelector("#finance-active-debtors"),
  financeExpenseCount: document.querySelector("#finance-expense-count"),
  expenseCategoryMix: document.querySelector("#expense-category-mix"),
  financeDebtOverview: document.querySelector("#finance-debt-overview"),
  reportDailyProfit: document.querySelector("#report-daily-profit"),
  reportDailySales: document.querySelector("#report-daily-sales"),
  reportDailyExpenses: document.querySelector("#report-daily-expenses"),
  reportDailyUnits: document.querySelector("#report-daily-units"),
  reportWeeklyProfit: document.querySelector("#report-weekly-profit"),
  reportWeeklySales: document.querySelector("#report-weekly-sales"),
  reportWeeklyExpenses: document.querySelector("#report-weekly-expenses"),
  reportWeeklyUnits: document.querySelector("#report-weekly-units"),
  reportMonthlyProfit: document.querySelector("#report-monthly-profit"),
  reportMonthlySales: document.querySelector("#report-monthly-sales"),
  reportMonthlyExpenses: document.querySelector("#report-monthly-expenses"),
  reportMonthlyUnits: document.querySelector("#report-monthly-units"),
  reportWeeklyTrend: document.querySelector("#report-weekly-trend"),
  reportMonthlyTrend: document.querySelector("#report-monthly-trend"),
  receiptList: document.querySelector("#receipt-list"),
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
setupPwaSupport();
if (cloudMode) {
  supabaseClient.auth.onAuthStateChange(() => {
    void syncInterface();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshCloudAccountState();
    }
  });
  window.addEventListener("focus", () => {
    void refreshCloudAccountState();
  });
  startCloudSyncWatcher();
}
void syncInterface();

function setupPwaSupport() {
  if (elements.installButtons.length) {
    elements.installButtons.forEach((button) => {
      button.addEventListener("click", () => {
        void handleInstallButtonClick();
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refreshInstallPanels();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    refreshInstallPanels();
    announceInstallMessage(
      "Tindahan Tracker is now installed. Open it from your home screen for faster store access.",
      "success"
    );
  });

  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", () => {
    refreshInstallPanels();
  });

  void handleRequestedCacheFlush();
  void registerServiceWorker();
  refreshInstallPanels();
}

async function handleRequestedCacheFlush() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("flush") !== "1") {
    return;
  }

  try {
    if ("serviceWorker" in window.navigator) {
      const registrations = await window.navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    params.delete("flush");
    params.set("refreshed", APP_VERSION);
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.location.replace(nextUrl);
  } catch (error) {
    console.warn("Unable to clear the installed app cache automatically.", error);
    announceInstallMessage(
      "The app cache could not be cleared automatically. Use your browser site settings to clear stored data for this site.",
      "warning"
    );
  }
}

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
  if (group === "store-ops" && scanStream) {
    const activeTab = activeScannerContext === "product" ? "ops-product" : "ops-scan";
    if (targetId !== activeTab) {
      stopCameraScanner({ silent: true });
    }
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
  elements.productScanMode.addEventListener("change", updateProductScanGuidance);
  elements.productScanQuantity.addEventListener("input", updateProductScanGuidance);
  elements.productScannerStart.addEventListener("click", () => {
    void startCameraScanner("product");
  });
  elements.productScannerStop.addEventListener("click", () => {
    stopCameraScanner();
  });
  elements.productScannerManualForm.addEventListener("submit", handleProductScannerManualSubmit);
  elements.scannerStart.addEventListener("click", () => {
    void startCameraScanner("inventory");
  });
  elements.scannerStop.addEventListener("click", () => {
    stopCameraScanner();
  });
  elements.scannerModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setScannerMode(button.dataset.scannerMode);
    });
  });
  elements.scannerQuantity.addEventListener("input", updateScannerGuidance);
  elements.scannerManualForm.addEventListener("submit", handleScannerManualSubmit);
  elements.saleForm.addEventListener("submit", handleSaleSubmit);
  elements.restockForm.addEventListener("submit", handleRestockSubmit);
  elements.debtForm.addEventListener("submit", handleDebtSubmit);
  elements.expenseForm.addEventListener("submit", handleExpenseSubmit);
  elements.saleProduct.addEventListener("change", updateSalePreview);
  elements.saleQuantity.addEventListener("input", updateSalePreview);
  elements.saleCustomerName.addEventListener("input", updateSalePreview);
  elements.restockProduct.addEventListener("change", updateRestockPreview);
  elements.restockQuantity.addEventListener("input", updateRestockPreview);
  elements.inventoryBody.addEventListener("click", handleInventoryActions);
  elements.reorderBoard.addEventListener("click", handleReorderActions);
  elements.salePrintLatest.addEventListener("click", printLatestReceipt);
  elements.receiptList.addEventListener("click", handleReceiptActions);
  elements.exportData.addEventListener("click", exportState);
  elements.importTrigger.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importStateFromFile);
  elements.resetDemo.addEventListener("click", resetToDemoState);
  elements.logoutButton.addEventListener("click", logoutCurrentAccount);
  elements.recoveryAction?.addEventListener("click", () => {
    void handleRecoveryImport();
  });
  elements.adminExportButton.addEventListener("click", exportAdminReport);
  elements.adminLogoutButton.addEventListener("click", logoutAdmin);
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIosInstallableDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function refreshInstallPanels() {
  if (!elements.installPanels.length) {
    return;
  }

  if (isStandaloneApp()) {
    elements.installPanels.forEach((panel) => {
      panel.hidden = true;
      delete panel.dataset.installMode;
    });
    return;
  }

  let installMode = "manual";
  let buttonLabel = "View Install Steps";
  let note =
    "Use your browser menu or address-bar install icon to add Tindahan Tracker like a phone app.";

  if (deferredInstallPrompt) {
    installMode = "prompt";
    buttonLabel = "Install App";
    note =
      "Install Tindahan Tracker for one-tap access, faster loading, and a full-screen workspace on this device.";
  } else if (isIosInstallableDevice()) {
    installMode = "ios";
    buttonLabel = "Home Screen Steps";
    note = 'On iPhone or iPad, tap Share, then choose "Add to Home Screen" to install Tindahan Tracker.';
  }

  elements.installPanels.forEach((panel) => {
    panel.hidden = false;
    panel.dataset.installMode = installMode;
  });

  elements.installPanelNotes.forEach((installNote) => {
    installNote.textContent = note;
  });

  elements.installButtons.forEach((button) => {
    button.textContent = buttonLabel;
  });
}

async function handleInstallButtonClick() {
  if (isStandaloneApp()) {
    announceInstallMessage("Tindahan Tracker is already installed on this device.", "success");
    return;
  }

  if (deferredInstallPrompt) {
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;

      if (choice?.outcome === "accepted") {
        announceInstallMessage("Install accepted. Tindahan Tracker will be added to this device.", "success");
      } else {
        announceInstallMessage("Install can still be completed later from this same screen.", "warning");
      }
    } catch (error) {
      console.error("Unable to prompt for PWA install.", error);
      announceInstallMessage("The install prompt could not be opened right now. Please try again.", "danger");
    } finally {
      deferredInstallPrompt = null;
      refreshInstallPanels();
    }
    return;
  }

  if (isIosInstallableDevice()) {
    announceInstallMessage(
      'On iPhone or iPad, tap Share and choose "Add to Home Screen" to install Tindahan Tracker.',
      "warning"
    );
    return;
  }

  announceInstallMessage(
    "Open your browser menu or the install icon in the address bar, then choose Install App or Add to Home Screen. If the option is missing, refresh once after the page finishes loading.",
    "warning"
  );
}

function announceInstallMessage(message, tone = "default") {
  if (currentAccount) {
    setFeedback(message, tone);
    return;
  }

  if (currentAdmin) {
    setAdminFeedback(message, tone);
    return;
  }

  setAuthMessage(message, tone);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in window.navigator)) {
    return;
  }

  try {
    await window.navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`);
  } catch (error) {
    console.warn("Unable to register the service worker.", error);
  }
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
  setBusyState(true, "Loading workspace...");
  if (cloudMode) {
    try {
      await syncCloudInterface();
    } finally {
      setBusyState(false);
    }
    return;
  }

  try {
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
  } finally {
    setBusyState(false);
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
    lastCloudSyncMarker = "";
    accounts = [];
    remoteStoreMap = {};
    state = buildEmptyState();
    stopCameraScanner({ silent: true });
    renderVisibility();
    document.title = "Tindahan Tracker | Inventory Management Suite";
    setAuthMessage(defaultAuthMessage());
    return;
  }

  await syncCloudInterfaceForUser(authSession.user);
}

async function syncCloudInterfaceForUser(user) {
  const profile = await ensureCloudProfile(user);
  if (!profile) {
    session = null;
    currentAccount = null;
    currentAdmin = null;
    adminRecord = null;
    lastCloudSyncMarker = "";
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
    lastCloudSyncMarker = "";
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
  lastCloudSyncMarker = getCloudSyncMarker(profile);
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

function getCloudSyncMarker(profile) {
  return normalizeDate(profile?.updated_at || profile?.last_login_at || profile?.created_at);
}

function startCloudSyncWatcher() {
  if (cloudSyncPollId || !cloudMode) {
    return;
  }

  cloudSyncPollId = window.setInterval(() => {
    void refreshCloudAccountState();
  }, CLOUD_SYNC_INTERVAL_MS);
}

async function refreshCloudAccountState(options = {}) {
  if (!cloudMode || !currentAccount || currentAdmin || session?.role !== "store") {
    return false;
  }

  if (!options.force && document.visibilityState !== "visible") {
    return false;
  }

  if (cloudSyncInFlight) {
    return false;
  }

  cloudSyncInFlight = true;

  try {
    const profile = await loadCloudProfile(currentAccount.id);
    if (!profile) {
      return false;
    }

    const nextMarker = getCloudSyncMarker(profile);
    if (!options.force && nextMarker === lastCloudSyncMarker) {
      return false;
    }

    const latestState = await loadCloudStateForUser(currentAccount.id, profile.store_name);
    if (!latestState) {
      return false;
    }

    lastCloudSyncMarker = nextMarker;
    currentAccount = buildCloudAccount(profile);
    state = normalizeState(latestState);
    remoteStoreMap[currentAccount.id] = state;
    renderVisibility();
    renderAll();
    return true;
  } finally {
    cloudSyncInFlight = false;
  }
}

async function loadCloudStateForUser(userId, storeName) {
  const [productsResult, transactionsResult, activityResult, debtsResult, expensesResult] = await Promise.all([
    supabaseClient
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabaseClient
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(160),
    supabaseClient
      .from("activity")
      .select("id, user_id, kind, message, product_id, product_name, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(80),
    supabaseClient
      .from("debts")
      .select("id, user_id, entry_type, customer_name, amount, note, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(180),
    supabaseClient
      .from("expenses")
      .select("id, user_id, category, amount, note, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(180),
  ]);

  if (productsResult.error || transactionsResult.error || activityResult.error) {
    console.error("Unable to load shared store data.", {
      productsError: productsResult.error,
      transactionsError: transactionsResult.error,
      activityError: activityResult.error,
    });

    return null;
  }

  const debtRows = resolveOptionalCloudRows(debtsResult, "debts", "debt records");
  const expenseRows = resolveOptionalCloudRows(expensesResult, "expenses", "expense records");
  if (debtRows === null || expenseRows === null) {
    return null;
  }

  const normalized = normalizeState({
    products: (productsResult.data || []).map(mapDatabaseProduct),
    transactions: (transactionsResult.data || []).map(mapDatabaseTransaction),
    debts: debtRows.map(mapDatabaseDebtEntry),
    expenses: expenseRows.map(mapDatabaseExpense),
    activity: (activityResult.data || []).map(mapDatabaseActivity),
  });

  return normalized.activity.length ||
    normalized.products.length ||
    normalized.transactions.length ||
    normalized.debts.length ||
    normalized.expenses.length
    ? normalized
    : buildFreshStoreState(storeName);
}

async function loadCloudAdminWorkspace() {
  const [profilesResult, productsResult, transactionsResult, activityResult, debtsResult, expensesResult] =
    await Promise.all([
    supabaseClient
      .from("profiles")
      .select("user_id, role, store_name, owner_name, email, created_at, updated_at, last_login_at")
      .eq("role", "store")
      .order("created_at", { ascending: false }),
    supabaseClient
      .from("products")
      .select("*"),
    supabaseClient
      .from("transactions")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabaseClient
      .from("activity")
      .select("id, user_id, kind, message, product_id, product_name, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabaseClient
      .from("debts")
      .select("id, user_id, entry_type, customer_name, amount, note, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabaseClient
      .from("expenses")
      .select("id, user_id, category, amount, note, occurred_at")
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

  const debtRows = resolveOptionalCloudRows(debtsResult, "debts", "admin debt records");
  const expenseRows = resolveOptionalCloudRows(expensesResult, "expenses", "admin expense records");
  if (debtRows === null || expenseRows === null) {
    accounts = [];
    remoteStoreMap = {};
    setAdminFeedback("Unable to load the shared finance records right now.", "danger");
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

  debtRows.forEach((row) => {
    const userId = `${row.user_id}`;
    remoteStoreMap[userId] = remoteStoreMap[userId] || buildEmptyState();
    remoteStoreMap[userId].debts.push(mapDatabaseDebtEntry(row));
  });

  expenseRows.forEach((row) => {
    const userId = `${row.user_id}`;
    remoteStoreMap[userId] = remoteStoreMap[userId] || buildEmptyState();
    remoteStoreMap[userId].expenses.push(mapDatabaseExpense(row));
  });

  Object.keys(remoteStoreMap).forEach((userId) => {
    remoteStoreMap[userId] = normalizeState(remoteStoreMap[userId]);
  });
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || message.includes("does not exist");
}

function resolveOptionalCloudRows(result, statusKey, contextLabel) {
  if (!result?.error) {
    cloudTableStatus[statusKey] = true;
    return result.data || [];
  }

  if (isMissingTableError(result.error)) {
    cloudTableStatus[statusKey] = false;
    return [];
  }

  console.error(`Unable to load shared ${contextLabel}.`, result.error);
  return null;
}

function mapDatabaseProduct(row) {
  return {
    id: row.id,
    sku: normalizeCode(row.sku),
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: roundMoney(row.price),
    costPrice: resolveCostPrice(row.cost_price, row.price),
    stock: roundNumber(row.stock),
    reorderLevel: roundNumber(row.reorder_level),
    imageUrl: sanitizeImageUrl(row.image_url),
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
    unitCost: resolveCostPrice(row.unit_cost, row.unit_price),
    costTotal: roundMoney(row.cost_total ?? roundNumber(row.quantity) * resolveCostPrice(row.unit_cost, row.unit_price)),
    profitAmount: roundMoney(
      row.profit_amount ??
        roundMoney(row.total) - roundMoney(row.cost_total ?? roundNumber(row.quantity) * resolveCostPrice(row.unit_cost, row.unit_price))
    ),
    total: roundMoney(row.total),
    customerName: `${row.customer_name || ""}`.trim(),
    receiptNumber: `${row.receipt_number || ""}`.trim(),
    note: `${row.note || ""}`.trim(),
    occurredAt: normalizeDate(row.occurred_at),
  };
}

function mapDatabaseDebtEntry(row) {
  return {
    id: row.id,
    type: row.entry_type === "payment" ? "payment" : "charge",
    customerName: row.customer_name,
    amount: roundMoney(row.amount),
    note: `${row.note || ""}`.trim(),
    occurredAt: normalizeDate(row.occurred_at),
  };
}

function mapDatabaseExpense(row) {
  return {
    id: row.id,
    category: row.category,
    amount: roundMoney(row.amount),
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

function readBrowserStorageJson(key, fallbackValue) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) {
      return fallbackValue;
    }

    return JSON.parse(saved);
  } catch (error) {
    console.warn(`Unable to read browser storage for ${key}.`, error);
    return fallbackValue;
  }
}

function loadBrowserAccountsSnapshot() {
  const parsed = readBrowserStorageJson(ACCOUNTS_KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalizeAccount).filter(Boolean) : [];
}

function loadBrowserStoreMapSnapshot() {
  const parsed = readBrowserStorageJson(STORE_DATA_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function readLegacyStateSnapshot() {
  const parsed = readBrowserStorageJson(LEGACY_STORAGE_KEY, null);
  return parsed ? normalizeState(parsed) : null;
}

function loadRecoveryRegistry() {
  const parsed = readBrowserStorageJson(RECOVERY_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function saveRecoveryRegistry(registry) {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(registry));
  } catch (error) {
    console.warn("Unable to save recovery registry.", error);
  }
}

function getRecoveryCandidateForCurrentAccount() {
  if (!cloudMode || !currentAccount) {
    return null;
  }

  const browserAccounts = loadBrowserAccountsSnapshot();
  const browserStoreMap = loadBrowserStoreMapSnapshot();
  const recoveryCandidates = [];
  const singleBrowserAccount = browserAccounts.length === 1;
  const currentStoreKey = normalizeLookupKey(currentAccount.storeName);

  browserAccounts.forEach((account) => {
    const accountState = normalizeState(browserStoreMap[account.id] || buildEmptyState());
    if (!hasRecoverableRecords(accountState)) {
      return;
    }

    const matchesEmail = account.email === currentAccount.email;
    const matchesStore = normalizeLookupKey(account.storeName) === currentStoreKey;
    if (!matchesEmail && !matchesStore && !singleBrowserAccount) {
      return;
    }

    const summary = summarizeStoreState(accountState);
    recoveryCandidates.push({
      kind: "browser-account",
      sourceId: account.id,
      label: account.storeName,
      accountEmail: account.email,
      state: accountState,
      summary,
      signature: buildRecoverySignature("browser-account", account.id, summary),
      score: (matchesEmail ? 120 : 0) + (matchesStore ? 35 : 0) + (singleBrowserAccount ? 10 : 0) + summary.totalRecords,
      updatedAt: account.lastLoginAt || account.createdAt,
    });
  });

  const unmatchedStoreEntries = Object.entries(browserStoreMap).filter(([storeId]) => {
    return !browserAccounts.some((account) => account.id === storeId);
  });

  if (!browserAccounts.length && unmatchedStoreEntries.length === 1) {
    const [storeId, storeValue] = unmatchedStoreEntries[0];
    const fallbackState = normalizeState(storeValue);
    if (hasRecoverableRecords(fallbackState)) {
      const summary = summarizeStoreState(fallbackState);
      recoveryCandidates.push({
        kind: "browser-store",
        sourceId: storeId,
        label: "Saved browser workspace",
        accountEmail: "",
        state: fallbackState,
        summary,
        signature: buildRecoverySignature("browser-store", storeId, summary),
        score: 25 + summary.totalRecords,
        updatedAt: latestStateTimestamp(fallbackState),
      });
    }
  }

  const legacyState = readLegacyStateSnapshot();
  if (hasRecoverableRecords(legacyState)) {
    const summary = summarizeStoreState(legacyState);
    recoveryCandidates.push({
      kind: "legacy-state",
      sourceId: "legacy",
      label: "Legacy browser backup",
      accountEmail: "",
      state: legacyState,
      summary,
      signature: buildRecoverySignature("legacy-state", "legacy", summary),
      score: (browserAccounts.length ? 6 : 28) + summary.totalRecords,
      updatedAt: latestStateTimestamp(legacyState),
    });
  }

  const bestCandidate = recoveryCandidates
    .filter((candidate) => !isRecoveryAlreadyImported(currentAccount, candidate))
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference) {
        return scoreDifference;
      }

      return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
    })[0];

  return bestCandidate || null;
}

function hasRecoverableRecords(storeState) {
  if (!storeState) {
    return false;
  }

  const summary = summarizeStoreState(storeState);
  return summary.totalRecords > 0;
}

function summarizeStoreState(storeState) {
  const normalizedState = normalizeState(storeState);
  const products = normalizedState.products.length;
  const transactions = normalizedState.transactions.length;
  const debts = normalizedState.debts.length;
  const expenses = normalizedState.expenses.length;

  return {
    products,
    transactions,
    debts,
    expenses,
    totalRecords: products + transactions + debts + expenses,
  };
}

function formatRecoverySummary(summary) {
  const parts = [];

  if (summary.products) {
    parts.push(`${summary.products} product${summary.products === 1 ? "" : "s"}`);
  }

  if (summary.transactions) {
    parts.push(`${summary.transactions} transaction${summary.transactions === 1 ? "" : "s"}`);
  }

  if (summary.debts) {
    parts.push(`${summary.debts} utang entr${summary.debts === 1 ? "y" : "ies"}`);
  }

  if (summary.expenses) {
    parts.push(`${summary.expenses} expense${summary.expenses === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}

function isMeaningfullyEmptyState(storeState) {
  return !hasRecoverableRecords(storeState);
}

function buildRecoverySignature(kind, sourceId, summary) {
  return `${kind}:${sourceId}:${summary.products}:${summary.transactions}:${summary.debts}:${summary.expenses}`;
}

function isRecoveryAlreadyImported(account, candidate) {
  if (!account || !candidate) {
    return false;
  }

  const registry = loadRecoveryRegistry();
  return registry[account.id] === candidate.signature;
}

function markRecoveryImported(account, candidate) {
  if (!account || !candidate) {
    return;
  }

  const registry = loadRecoveryRegistry();
  registry[account.id] = candidate.signature;
  saveRecoveryRegistry(registry);
}

function latestStateTimestamp(storeState) {
  const timestamps = [];
  const normalizedState = normalizeState(storeState);

  normalizedState.products.forEach((product) => timestamps.push(product.updatedAt));
  normalizedState.transactions.forEach((transaction) => timestamps.push(transaction.occurredAt));
  normalizedState.debts.forEach((entry) => timestamps.push(entry.occurredAt));
  normalizedState.expenses.forEach((expense) => timestamps.push(expense.occurredAt));
  normalizedState.activity.forEach((activity) => timestamps.push(activity.occurredAt));

  return timestamps.sort((left, right) => new Date(right) - new Date(left))[0] || new Date(0).toISOString();
}

function normalizeLookupKey(value) {
  return `${value || ""}`.trim().toLowerCase();
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
    debts: [],
    expenses: [],
    activity: [],
  };
}

function buildFreshStoreState(storeName) {
  return {
    products: [],
    transactions: [],
    debts: [],
    expenses: [],
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
      costPrice: 19.5,
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
      costPrice: 11.5,
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
      costPrice: 43,
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
      costPrice: 8.5,
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
      costPrice: 4.75,
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
      costPrice: 53,
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
      costPrice: 6,
      stock: 30,
      reorderLevel: 24,
      minutesAgo: 18,
    }),
  ];

  const transactions = [
    buildTransaction("sale", products[3], 6, "Morning coffee rush", 135, { customerName: "Walk-in customer" }),
    buildTransaction("sale", products[6], 12, "Breakfast buyers", 75, { customerName: "Mang Jose" }),
    buildTransaction("sale", products[0], 4, "Lunch items", 55, { customerName: "Aling Rosa" }),
    buildTransaction("restock", products[4], 20, "Weekly supplier refill", 26 * 60),
    buildTransaction("restock", products[1], 24, "Added noodle packs", 14 * 60),
  ];

  const debts = [
    buildDebtEntry("charge", "Mang Jose", 145, "Rice and canned goods", 210),
    buildDebtEntry("payment", "Mang Jose", 60, "Partial payment", 55),
    buildDebtEntry("charge", "Aling Rosa", 90, "Neighborhood delivery", 95),
  ];

  const expenses = [
    buildExpense("Electricity", 520, "Weekly power allocation", 980),
    buildExpense("Delivery", 140, "Supplier pickup fare", 320),
    buildExpense("Packaging", 85, "Small plastic bags and tape", 150),
  ];

  const activity = [
    buildActivity("snapshot", "Demonstration inventory dataset prepared for review.", null, 5),
    buildActivity("sale", "Logged sale for 6 sachet of 3-in-1 Coffee Mix.", products[3], 135),
    buildActivity("sale", "Logged sale for 12 piece of Fresh Eggs.", products[6], 75),
    buildActivity("restock", "Restocked 20 sachet of Shampoo Sachet.", products[4], 26 * 60),
    buildActivity("utang-payment", "Recorded payment of PHP 60.00 from Mang Jose.", null, 55),
    buildActivity("expense", "Saved delivery expense worth PHP 140.00.", null, 320),
  ];

  return {
    products,
    transactions,
    debts,
    expenses,
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
    costPrice: resolveCostPrice(product.costPrice, product.price),
    stock: roundNumber(product.stock),
    reorderLevel: roundNumber(product.reorderLevel),
    imageUrl: sanitizeImageUrl(product.imageUrl),
    updatedAt: minutesAgoToIso(product.minutesAgo || 0),
  };
}

function buildTransaction(type, product, quantity, note, minutesAgo, options = {}) {
  const unitCost = resolveCostPrice(options.unitCost, product.costPrice ?? product.price);
  const total = roundMoney(quantity * product.price);
  const costTotal = roundMoney(quantity * unitCost);
  return {
    id: uid("txn"),
    type,
    productId: product.id,
    productName: product.name,
    quantity: roundNumber(quantity),
    unit: product.unit,
    unitPrice: roundNumber(product.price),
    unitCost,
    costTotal,
    profitAmount: roundMoney(total - costTotal),
    total,
    customerName: `${options.customerName || ""}`.trim(),
    receiptNumber: type === "sale" ? `${options.receiptNumber || buildReceiptNumber(minutesAgoToIso(minutesAgo || 0))}` : "",
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

function buildDebtEntry(type, customerName, amount, note, minutesAgo) {
  return {
    id: uid("debt"),
    type: type === "payment" ? "payment" : "charge",
    customerName: `${customerName || ""}`.trim(),
    amount: roundMoney(amount),
    note: `${note || ""}`.trim(),
    occurredAt: minutesAgoToIso(minutesAgo || 0),
  };
}

function buildExpense(category, amount, note, minutesAgo) {
  return {
    id: uid("expense"),
    category: `${category || "General"}`.trim() || "General",
    amount: roundMoney(amount),
    note: `${note || ""}`.trim(),
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
    debts: Array.isArray(input?.debts)
      ? input.debts.map(normalizeDebtEntry).filter(Boolean)
      : [],
    expenses: Array.isArray(input?.expenses)
      ? input.expenses.map(normalizeExpense).filter(Boolean)
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
    costPrice: resolveCostPrice(product.costPrice, product.price),
    stock: roundNumber(product.stock),
    reorderLevel: roundNumber(product.reorderLevel),
    imageUrl: sanitizeImageUrl(product.imageUrl),
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
    unitCost: resolveCostPrice(transaction.unitCost, transaction.unitPrice),
    costTotal: roundMoney(
      transaction.costTotal ?? roundNumber(transaction.quantity) * resolveCostPrice(transaction.unitCost, transaction.unitPrice)
    ),
    profitAmount: roundMoney(
      transaction.profitAmount ??
        roundMoney(transaction.total) -
          roundMoney(
            transaction.costTotal ??
              roundNumber(transaction.quantity) * resolveCostPrice(transaction.unitCost, transaction.unitPrice)
          )
    ),
    total: roundMoney(transaction.total),
    customerName: `${transaction.customerName || ""}`.trim(),
    receiptNumber: `${transaction.receiptNumber || ""}`.trim(),
    note: `${transaction.note || ""}`.trim(),
    occurredAt: normalizeDate(transaction.occurredAt),
  };
}

function normalizeDebtEntry(entry) {
  if (!entry || typeof entry.customerName !== "string" || !entry.customerName.trim()) {
    return null;
  }

  const amount = roundMoney(entry.amount);
  if (amount <= 0) {
    return null;
  }

  return {
    id: `${entry.id || uid("debt")}`,
    type: entry.type === "payment" ? "payment" : "charge",
    customerName: entry.customerName.trim(),
    amount,
    note: `${entry.note || ""}`.trim(),
    occurredAt: normalizeDate(entry.occurredAt),
  };
}

function normalizeExpense(expense) {
  if (!expense || typeof expense.category !== "string" || !expense.category.trim()) {
    return null;
  }

  const amount = roundMoney(expense.amount);
  if (amount <= 0) {
    return null;
  }

  return {
    id: `${expense.id || uid("expense")}`,
    category: expense.category.trim(),
    amount,
    note: `${expense.note || ""}`.trim(),
    occurredAt: normalizeDate(expense.occurredAt),
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
        emailRedirectTo,
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
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthMessage(mapSupabaseAuthError(error, "Unable to sign in to the shared workspace."), "danger");
      return;
    }

    elements.loginPassword.value = "";
    if (data?.user || data?.session?.user) {
      await syncCloudInterfaceForUser(data.user || data.session.user);
    } else {
      await syncInterface();
    }
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
    if (data?.user || data?.session?.user) {
      await syncCloudInterfaceForUser(data.user || data.session.user);
    } else {
      await syncInterface();
    }
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
  elements.salePrintLatest.disabled = true;
  elements.restockForm.reset();
  elements.debtForm.reset();
  elements.expenseForm.reset();
  elements.productScanMode.value = "fill";
  elements.productScanQuantity.value = "1";
  elements.productScannerCodeInput.value = "";
  elements.scannerAction.value = "sale";
  elements.scannerQuantity.value = "1";
  elements.scannerCodeInput.value = "";
  updateSalePreview();
  updateRestockPreview();
  updateProductScanGuidance();
  updateScannerGuidance();
}

function renderAll() {
  if (!currentAccount) {
    return;
  }

  document.title = `${currentAccount.storeName} | Tindahan Tracker`;
  renderAccountProfile();
  renderRecoveryBanner();
  elements.todayLabel.textContent = `Today is ${dayFormatter.format(new Date())}`;
  populateDebtCustomerSuggestions();
  renderStats();
  populateCategoryFilter();
  populateProductSelectors();
  renderInventory();
  renderReorderBoard();
  renderHotSellers();
  renderProfitLeaders();
  renderCategoryMix();
  renderWeeklySalesTrend();
  renderDebtPanel();
  renderExpensePanel();
  renderFinanceInsights();
  renderReportInsights();
  renderReceiptInsights();
  renderRecentActivity();
  updateSalePreview();
  updateRestockPreview();
  updateProductScanGuidance();
  updateScannerGuidance();
}

function renderAdminDashboard() {
  if (!currentAdmin) {
    return;
  }

  document.title = "Administrative Dashboard | Tindahan Tracker";
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
    `${currentAccount.ownerName} can manage products, sales records, restock entries, utang balances, and expenses from one structured workspace.`;
  elements.accountBadge.textContent = `${currentAccount.ownerName} | ${currentAccount.email}`;
  elements.sessionNote.textContent = cloudMode
    ? "This store account is synced through the shared cloud workspace."
    : "Each store account is maintained separately on this browser.";
  elements.storeNameDisplay.textContent = currentAccount.storeName;
  elements.storeOwnerDisplay.textContent = `${currentAccount.ownerName} | ${currentAccount.email}`;
}

function renderRecoveryBanner() {
  if (!elements.recoveryBanner || !elements.recoveryBannerText) {
    return;
  }

  recoveryCandidate = getRecoveryCandidateForCurrentAccount();
  if (!cloudMode || !currentAccount || !recoveryCandidate) {
    elements.recoveryBanner.hidden = true;
    return;
  }

  const sourceLabel =
    recoveryCandidate.accountEmail && recoveryCandidate.accountEmail !== currentAccount.email
      ? `${recoveryCandidate.label} (${recoveryCandidate.accountEmail})`
      : recoveryCandidate.label;

  elements.recoveryBannerText.textContent =
    `Older browser-saved records were found for ${sourceLabel}: ${formatRecoverySummary(
      recoveryCandidate.summary
    )}. Import them into this shared store workspace.`;
  elements.recoveryBanner.hidden = false;
}

async function handleRecoveryImport() {
  if (!cloudMode || !currentAccount) {
    return;
  }

  const candidate = recoveryCandidate || getRecoveryCandidateForCurrentAccount();
  if (!candidate) {
    renderRecoveryBanner();
    setFeedback("No browser-saved store records were found for recovery on this device.", "warning");
    return;
  }

  const currentState = normalizeState(state);
  const replaceMode = isMeaningfullyEmptyState(currentState);
  const sourceLabel =
    candidate.accountEmail && candidate.accountEmail !== currentAccount.email
      ? `${candidate.label} (${candidate.accountEmail})`
      : candidate.label;
  const shouldContinue = window.confirm(
    `Recover ${formatRecoverySummary(candidate.summary)} from ${sourceLabel} into ${currentAccount.storeName}? ` +
      (replaceMode
        ? "This will restore the older browser-saved records into the current shared workspace."
        : "This will merge the older browser-saved records with the current shared workspace.")
  );

  if (!shouldContinue) {
    return;
  }

  const previousState = normalizeState(state);
  const nextState = buildRecoveredStoreState(previousState, candidate);

  setBusyState(true, replaceMode ? "Restoring browser-saved records..." : "Merging browser-saved records...");
  state = nextState;
  const saved = await saveState();
  setBusyState(false);

  if (!saved) {
    state = previousState;
    renderAll();
    setFeedback("The browser-saved records could not be synchronized to Supabase. Please try again.", "danger");
    return;
  }

  remoteStoreMap[currentAccount.id] = normalizeState(nextState);
  markRecoveryImported(currentAccount, candidate);
  renderAll();
  setFeedback(
    `${replaceMode ? "Restored" : "Merged"} ${formatRecoverySummary(candidate.summary).toLowerCase()} from browser storage.`,
    "success"
  );
}

function buildRecoveredStoreState(currentState, candidate) {
  const importedState = normalizeState(candidate.state);
  const recoveryActivity = buildRecoveryActivityEntry(candidate);

  if (isMeaningfullyEmptyState(currentState)) {
    return normalizeState({
      ...importedState,
      activity: mergeRecordsById(importedState.activity, [recoveryActivity]),
    });
  }

  return normalizeState({
    products: mergeRecordsById(currentState.products, importedState.products),
    transactions: mergeRecordsById(currentState.transactions, importedState.transactions),
    debts: mergeRecordsById(currentState.debts, importedState.debts),
    expenses: mergeRecordsById(currentState.expenses, importedState.expenses),
    activity: mergeRecordsById(currentState.activity, [...importedState.activity, recoveryActivity]),
  });
}

function buildRecoveryActivityEntry(candidate) {
  return normalizeActivity({
    id: uid("activity"),
    kind: "recovery",
    message: `Recovered ${formatRecoverySummary(candidate.summary).toLowerCase()} from ${candidate.label}.`,
    occurredAt: new Date().toISOString(),
  });
}

function mergeRecordsById(currentRecords, importedRecords) {
  const merged = Array.isArray(currentRecords) ? [...currentRecords] : [];
  const seen = new Set(merged.map((record) => `${record?.id || ""}`));

  (importedRecords || []).forEach((record) => {
    const recordId = `${record?.id || ""}`;
    if (!record || (recordId && seen.has(recordId))) {
      return;
    }

    merged.push(record);
    if (recordId) {
      seen.add(recordId);
    }
  });

  return merged;
}

function renderAdminProfile() {
  const summaries = getAdminStoreSummaries();
  elements.adminTodayLabel.textContent = `Today is ${dayFormatter.format(new Date())}`;
  elements.adminCoverageNote.textContent = `Coverage: ${summaries.length} ${
    cloudMode ? "shared" : "locally stored"
  } store account${
    summaries.length === 1 ? "" : "s"
  } under review.`;
  elements.adminNameDisplay.textContent = currentAdmin.name;
  elements.adminEmailDisplay.textContent = currentAdmin.email;
}

async function saveState(options = {}) {
  if (!currentAccount) {
    return true;
  }

  const normalized = normalizeState(state);

  if (cloudMode) {
    remoteStoreMap[currentAccount.id] = normalized;
    return persistCloudState(currentAccount.id, normalized, options);
  }

  const storeMap = loadStoreMap();
  storeMap[currentAccount.id] = normalized;
  saveStoreMap(storeMap);
  return true;
}

function buildCloudSavePlan(scope = "all") {
  if (scope === "product") {
    return {
      products: true,
      transactions: false,
      debts: false,
      expenses: false,
      activity: true,
    };
  }

  if (scope === "inventory-transaction") {
    return {
      products: true,
      transactions: true,
      debts: false,
      expenses: false,
      activity: true,
    };
  }

  if (scope === "debt") {
    return {
      products: false,
      transactions: false,
      debts: true,
      expenses: false,
      activity: true,
    };
  }

  if (scope === "expense") {
    return {
      products: false,
      transactions: false,
      debts: false,
      expenses: true,
      activity: true,
    };
  }

  return {
    products: true,
    transactions: true,
    debts: true,
    expenses: true,
    activity: true,
  };
}

function buildCompatibleCloudRows(tableName, rows) {
  const support = cloudColumnSupport[tableName];
  if (!support) {
    return rows;
  }

  return rows.map((row) => {
    const nextRow = { ...row };
    Object.entries(support).forEach(([columnName, isSupported]) => {
      if (isSupported === false) {
        delete nextRow[columnName];
      }
    });
    return nextRow;
  });
}

function applyMissingColumnFallback(tableName, error) {
  const support = cloudColumnSupport[tableName];
  if (!support) {
    return false;
  }

  const errorText = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  if (!errorText.includes("column") && !errorText.includes("schema cache")) {
    return false;
  }

  const missingColumn = Object.keys(support).find((columnName) => {
    return support[columnName] !== false && errorText.includes(columnName.toLowerCase());
  });

  if (!missingColumn) {
    return false;
  }

  support[missingColumn] = false;
  return true;
}

function describeCloudSaveError(error, fallbackMessage) {
  const errorText = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (isMissingTableError(error)) {
    return "Your Supabase tables are incomplete for this feature. Run the latest supabase-setup.sql, then try again.";
  }

  if (errorText.includes("schema cache") || errorText.includes("column")) {
    return "Your Supabase database schema is outdated for this feature. Run the latest supabase-setup.sql, then try again.";
  }

  if (error?.code === "42501" || errorText.includes("row-level security")) {
    return "This store account does not have permission to update the shared workspace right now.";
  }

  if (errorText.includes("duplicate key")) {
    return "A shared record with the same ID already exists. Refresh once, then try again.";
  }

  return fallbackMessage || error?.message || "The shared workspace rejected the update.";
}

function rememberCloudSaveError(error, fallbackMessage, logContext) {
  if (logContext) {
    console.error(logContext, error);
  }
  lastCloudSaveErrorMessage = describeCloudSaveError(error, fallbackMessage);
}

async function replaceCloudTableRows(tableName, userId, rows, options = {}) {
  const { optionalStatusKey = "" } = options;

  if (optionalStatusKey && cloudTableStatus[optionalStatusKey] === false && !rows.length) {
    return true;
  }

  if (optionalStatusKey && cloudTableStatus[optionalStatusKey] === false && rows.length) {
    lastCloudSaveErrorMessage = `Your Supabase workspace is still missing the ${tableName} table for this feature. Run the latest supabase-setup.sql, then try again.`;
    return false;
  }

  const deleteResult = await supabaseClient.from(tableName).delete().eq("user_id", userId);
  if (deleteResult.error) {
    if (optionalStatusKey && isMissingTableError(deleteResult.error)) {
      cloudTableStatus[optionalStatusKey] = false;
      if (!rows.length) {
        return true;
      }
      lastCloudSaveErrorMessage = `Your Supabase workspace is still missing the ${tableName} table for this feature. Run the latest supabase-setup.sql, then try again.`;
      return false;
    }

    rememberCloudSaveError(
      deleteResult.error,
      `The shared ${tableName} records could not be cleared before saving.`,
      `Unable to clear shared ${tableName} rows before save.`
    );
    return false;
  }

  if (optionalStatusKey) {
    cloudTableStatus[optionalStatusKey] = true;
  }

  if (!rows.length) {
    return true;
  }

  let compatibleRows = buildCompatibleCloudRows(tableName, rows);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const insertResult = await supabaseClient.from(tableName).insert(compatibleRows);
    if (!insertResult.error) {
      return true;
    }

    if (optionalStatusKey && isMissingTableError(insertResult.error)) {
      cloudTableStatus[optionalStatusKey] = false;
      lastCloudSaveErrorMessage = `Your Supabase workspace is still missing the ${tableName} table for this feature. Run the latest supabase-setup.sql, then try again.`;
      return false;
    }

    if (applyMissingColumnFallback(tableName, insertResult.error)) {
      compatibleRows = buildCompatibleCloudRows(tableName, rows);
      continue;
    }

    rememberCloudSaveError(
      insertResult.error,
      `The shared ${tableName} records could not be saved.`,
      `Unable to write shared ${tableName} rows.`
    );
    return false;
  }

  lastCloudSaveErrorMessage = `The shared ${tableName} records could not be saved with the current Supabase schema. Run the latest supabase-setup.sql, then try again.`;
  return false;
}

async function persistCloudState(userId, storeState, options = {}) {
  lastCloudSaveErrorMessage = "";
  const syncPlan = buildCloudSavePlan(options.scope);
  const normalizedState = normalizeState(storeState);
  const productsPayload = normalizedState.products.map((product) => ({
    id: product.id,
    user_id: userId,
    sku: normalizeCode(product.sku),
    name: product.name,
    category: product.category,
    unit: product.unit,
    price: roundMoney(product.price),
    cost_price: resolveCostPrice(product.costPrice, product.price),
    stock: roundNumber(product.stock),
    reorder_level: roundNumber(product.reorderLevel),
    image_url: sanitizeImageUrl(product.imageUrl),
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
    unit_cost: resolveCostPrice(transaction.unitCost, transaction.unitPrice),
    cost_total: roundMoney(transaction.costTotal),
    profit_amount: roundMoney(transaction.profitAmount),
    total: roundMoney(transaction.total),
    customer_name: `${transaction.customerName || ""}`.trim(),
    receipt_number: `${transaction.receiptNumber || ""}`.trim(),
    note: `${transaction.note || ""}`.trim(),
    occurred_at: normalizeDate(transaction.occurredAt),
  }));
  const debtsPayload = normalizedState.debts.map((entry) => ({
    id: entry.id,
    user_id: userId,
    entry_type: entry.type,
    customer_name: entry.customerName,
    amount: roundMoney(entry.amount),
    note: `${entry.note || ""}`.trim(),
    occurred_at: normalizeDate(entry.occurredAt),
  }));
  const expensesPayload = normalizedState.expenses.map((expense) => ({
    id: expense.id,
    user_id: userId,
    category: expense.category,
    amount: roundMoney(expense.amount),
    note: `${expense.note || ""}`.trim(),
    occurred_at: normalizeDate(expense.occurredAt),
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

  if (syncPlan.debts) {
    const debtWrite = await syncOptionalCloudTable("debts", "debts", userId, debtsPayload);
    if (!debtWrite) {
      return false;
    }
  }

  if (syncPlan.expenses) {
    const expenseWrite = await syncOptionalCloudTable("expenses", "expenses", userId, expensesPayload);
    if (!expenseWrite) {
      return false;
    }
  }

  if (syncPlan.products) {
    const productWrite = await replaceCloudTableRows("products", userId, productsPayload);
    if (!productWrite) {
      return false;
    }
  }

  if (syncPlan.transactions) {
    const transactionWrite = await replaceCloudTableRows("transactions", userId, transactionsPayload);
    if (!transactionWrite) {
      return false;
    }
  }

  if (syncPlan.activity) {
    const activityWrite = await replaceCloudTableRows("activity", userId, activityPayload);
    if (!activityWrite) {
      return false;
    }
  }

  await updateCloudSyncMarker(userId);
  return true;
}

async function updateCloudSyncMarker(userId) {
  const syncStamp = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("profiles")
    .update({ updated_at: syncStamp })
    .eq("user_id", userId)
    .select("updated_at, last_login_at, created_at")
    .maybeSingle();

  if (error) {
    console.warn("Unable to update the shared sync marker.", error);
    return false;
  }

  lastCloudSyncMarker = getCloudSyncMarker(data || { updated_at: syncStamp });
  return true;
}

async function syncOptionalCloudTable(tableName, statusKey, userId, rows) {
  return replaceCloudTableRows(tableName, userId, rows, { optionalStatusKey: statusKey });
}

function renderStats() {
  const totalProducts = state.products.length;
  const totalUnits = sum(state.products.map((product) => product.stock));
  const retailValue = sum(state.products.map((product) => product.stock * product.price));
  const todaySalesTransactions = state.transactions.filter(
    (transaction) => transaction.type === "sale" && isToday(transaction.occurredAt)
  );
  const todaySales = sum(todaySalesTransactions.map((transaction) => transaction.total));
  const todayGrossProfit = sum(todaySalesTransactions.map((transaction) => transaction.profitAmount ?? 0));
  const todayExpenses = getFinancialSummary(isToday).expenses;
  const todayNetProfit = roundMoney(todayGrossProfit - todayExpenses);
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
  } logged today · Gross profit ${currencyFormatter.format(todayGrossProfit)}`;
  elements.lowStockCount.textContent = currencyFormatter.format(todayNetProfit);
  elements.lowStockFoot.textContent = lowStockItems.length
    ? `${lowStockItems.length} low-stock alert${lowStockItems.length === 1 ? "" : "s"} need review`
    : "No urgent low-stock alerts today";

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
  elements.adminUsersFoot.textContent = `${totalUsers} registered store account${totalUsers === 1 ? "" : "s"} ${
    cloudMode ? "in the shared workspace" : "on this device"
  }`;
  elements.adminTotalProducts.textContent = numberFormatter.format(totalProducts);
  elements.adminProductsFoot.textContent = `${totalProducts} products recorded across all ${
    cloudMode ? "shared store workspaces" : "local store workspaces"
  }`;
  elements.adminTotalValue.textContent = currencyFormatter.format(totalValue);
  elements.adminValueFoot.textContent = `Combined sales today: ${currencyFormatter.format(totalTodaySales)}`;
  elements.adminRiskStores.textContent = numberFormatter.format(riskStores);
  elements.adminRiskFoot.textContent = riskStores
    ? `${riskStores} store${riskStores === 1 ? "" : "s"} require inventory review`
    : "No stores currently require inventory review";
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

  elements.adminSummaryText.textContent = `Showing ${summaries.length} registered ${
    cloudMode ? "shared" : "local"
  } store account${
    summaries.length === 1 ? "" : "s"
  }`;
  elements.adminSummaryNote.textContent = cloudMode
    ? "Coverage includes all accounts in the shared Supabase workspace."
    : "Coverage includes only the accounts saved on this browser and device.";
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
        Register store accounts first to populate the administrative sign-in view.
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
        const suggestedRestock = getSuggestedRestockQuantity(product);
        return `
          <tr>
            <td>
              <div class="product-row-head">
                ${renderProductPhoto(product, "small")}
                <div class="product-cell">
                  <span class="product-name">${escapeHtml(product.name)}</span>
                  <span class="product-meta">${escapeHtml(product.sku ? `Code: ${product.sku}` : "No barcode or code")}</span>
                  <span class="product-meta">${escapeHtml(
                    suggestedRestock > 0 ? `Suggested reorder: ${formatQuantity(suggestedRestock)} ${product.unit}` : "Stock is above the reorder target"
                  )}</span>
                </div>
              </div>
            </td>
            <td>
              <div class="product-cell">
                <span>${escapeHtml(product.category)}</span>
                <span class="product-meta">${escapeHtml(product.unit)}</span>
              </div>
            </td>
            <td>
              <div class="product-cell">
                <span>${currencyFormatter.format(product.price)}</span>
                <span class="product-meta">Cost: ${currencyFormatter.format(product.costPrice)}</span>
                <span class="product-meta">Margin: ${currencyFormatter.format(getProductMargin(product))}</span>
              </div>
            </td>
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
  renderSmartInsights();
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
    elements.reorderUrgentCount.textContent = "0";
    elements.reorderSuggestedValue.textContent = currencyFormatter.format(0);
    elements.reorderPriorityItem.textContent = "No alerts";
    elements.reorderBoard.innerHTML = `
      <div class="empty-state">
        No products are currently below their reorder level.
      </div>
    `;
    return;
  }

  const suggestedValue = sum(
    lowStockProducts.map((product) => getSuggestedRestockQuantity(product) * resolveCostPrice(product.costPrice, product.price))
  );
  elements.reorderUrgentCount.textContent = numberFormatter.format(lowStockProducts.length);
  elements.reorderSuggestedValue.textContent = currencyFormatter.format(suggestedValue);
  elements.reorderPriorityItem.textContent = lowStockProducts[0].name;

  elements.reorderBoard.innerHTML = lowStockProducts
    .slice(0, 6)
    .map((product) => {
      const status = getProductStatus(product);
      const suggestedRestock = getSuggestedRestockQuantity(product);
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
            <span>Reorder cost: ${currencyFormatter.format(
              suggestedRestock * resolveCostPrice(product.costPrice, product.price)
            )}</span>
          </div>
          <button class="mini-button" type="button" data-action="edit" data-product-id="${escapeHtml(product.id)}">
            Update Item
          </button>
        </article>
      `;
    })
    .join("");
}

function renderSmartInsights() {
  const insights = getSmartInsights();
  if (!insights.length) {
    elements.smartInsightsList.innerHTML = `
      <div class="empty-state">
        Smart guidance will appear here after the tracker collects a bit more store activity.
      </div>
    `;
    return;
  }

  elements.smartInsightsList.innerHTML = insights
    .map(
      (insight) => `
        <article class="list-card insight-card">
          <strong>${escapeHtml(insight.title)}</strong>
          <div class="list-meta">
            <span>${escapeHtml(insight.badge)}</span>
          </div>
          <div class="list-meta">
            <span>${escapeHtml(insight.message)}</span>
          </div>
        </article>
      `
    )
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

function renderDebtPanel() {
  const debtSummaries = getDebtCustomerSummaries();
  const latestPayment = [...state.debts]
    .filter((entry) => entry.type === "payment")
    .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))[0];
  const totalReceivables = sum(debtSummaries.filter((summary) => summary.balance > 0).map((summary) => summary.balance));

  elements.debtTotalBalance.textContent = currencyFormatter.format(totalReceivables);
  elements.debtActiveCustomers.textContent = numberFormatter.format(
    debtSummaries.filter((summary) => summary.balance > 0).length
  );
  elements.debtLastPayment.textContent = latestPayment
    ? `${latestPayment.customerName} · ${currencyFormatter.format(latestPayment.amount)}`
    : "No payments yet";
  elements.debtPreview.textContent = totalReceivables
    ? `Outstanding receivables currently total ${currencyFormatter.format(totalReceivables)}.`
    : "No active utang balances yet. Record a charge to begin tracking customer credit.";

  if (!debtSummaries.length) {
    elements.debtCustomerList.innerHTML = `
      <div class="empty-state">
        Customer balances will appear here once you record utang or payment entries.
      </div>
    `;
    return;
  }

  elements.debtCustomerList.innerHTML = debtSummaries
    .slice(0, 8)
    .map(
      (summary) => `
        <article class="list-card">
          <strong>${escapeHtml(summary.customerName)}</strong>
          <div class="list-meta">
            <span>Outstanding: ${currencyFormatter.format(summary.balance)}</span>
            <span>Last entry: ${dateTimeFormatter.format(new Date(summary.lastOccurredAt))}</span>
          </div>
          <div class="list-meta">
            <span>Charged: ${currencyFormatter.format(summary.charged)}</span>
            <span>Paid: ${currencyFormatter.format(summary.paid)}</span>
          </div>
          <div class="history-stack">
            ${summary.recentEntries
              .map(
                (entry) => `
                  <div class="history-row">
                    <span>${escapeHtml(entry.type === "payment" ? "Payment" : "Charge")}</span>
                    <span>${currencyFormatter.format(entry.amount)}</span>
                    <span>${dateTimeFormatter.format(new Date(entry.occurredAt))}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderExpensePanel() {
  const todaySummary = getFinancialSummary(isToday);
  const monthSummary = getFinancialSummary(isThisMonth);
  const recentExpenses = [...state.expenses].sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));

  elements.expenseTodayTotal.textContent = currencyFormatter.format(todaySummary.expenses);
  elements.expenseMonthTotal.textContent = currencyFormatter.format(monthSummary.expenses);
  elements.expenseLastCategory.textContent = recentExpenses[0]
    ? `${recentExpenses[0].category} · ${currencyFormatter.format(recentExpenses[0].amount)}`
    : "No expenses yet";
  elements.expensePreview.textContent = monthSummary.expenseCount
    ? `${monthSummary.expenseCount} expense entr${monthSummary.expenseCount === 1 ? "y" : "ies"} recorded this month.`
    : "Expenses will feed directly into your daily and monthly profit summaries.";

  if (!recentExpenses.length) {
    elements.expenseRecentList.innerHTML = `
      <div class="empty-state">
        Expense entries will appear here once you begin recording store costs.
      </div>
    `;
    return;
  }

  elements.expenseRecentList.innerHTML = recentExpenses
    .slice(0, 8)
    .map(
      (expense) => `
        <article class="list-card">
          <strong>${escapeHtml(expense.category)}</strong>
          <div class="list-meta">
            <span>${currencyFormatter.format(expense.amount)}</span>
            <span>${dateTimeFormatter.format(new Date(expense.occurredAt))}</span>
          </div>
          <div class="list-meta">
            <span>${escapeHtml(expense.note || "No note recorded")}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderFinanceInsights() {
  const todaySummary = getFinancialSummary(isToday);
  const monthSummary = getFinancialSummary(isThisMonth);
  const debtSummaries = getDebtCustomerSummaries().filter((summary) => summary.balance > 0);
  const expenseCategories = getExpenseCategorySummaries();

  elements.financeTodayProfit.textContent = currencyFormatter.format(todaySummary.profit);
  elements.financeTodaySales.textContent = `Sales: ${currencyFormatter.format(todaySummary.sales)}`;
  elements.financeTodayExpenses.textContent = `Expenses: ${currencyFormatter.format(todaySummary.expenses)}`;
  elements.financeMonthProfit.textContent = currencyFormatter.format(monthSummary.profit);
  elements.financeMonthSales.textContent = `Sales: ${currencyFormatter.format(monthSummary.sales)}`;
  elements.financeMonthExpenses.textContent = `Expenses: ${currencyFormatter.format(monthSummary.expenses)}`;
  elements.financeOutstandingBalance.textContent = currencyFormatter.format(
    sum(debtSummaries.map((summary) => summary.balance))
  );
  elements.financeActiveDebtors.textContent = `${debtSummaries.length} active debtor${debtSummaries.length === 1 ? "" : "s"}`;
  elements.financeExpenseCount.textContent = `${monthSummary.expenseCount} expense entr${
    monthSummary.expenseCount === 1 ? "y" : "ies"
  } this month`;

  if (!expenseCategories.length) {
    elements.expenseCategoryMix.innerHTML = `
      <div class="empty-state">
        Expense categories will appear here once costs are recorded.
      </div>
    `;
  } else {
    const highestValue = expenseCategories[0].value || 1;
    elements.expenseCategoryMix.innerHTML = expenseCategories
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

  if (!debtSummaries.length) {
    elements.financeDebtOverview.innerHTML = `
      <div class="empty-state">
        Active customer balances will appear here once utang entries are recorded.
      </div>
    `;
    return;
  }

  elements.financeDebtOverview.innerHTML = debtSummaries
    .slice(0, 5)
    .map(
      (summary) => `
        <article class="list-card">
          <strong>${escapeHtml(summary.customerName)}</strong>
          <div class="list-meta">
            <span>Outstanding: ${currencyFormatter.format(summary.balance)}</span>
            <span>Last update: ${dateTimeFormatter.format(new Date(summary.lastOccurredAt))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderReportInsights() {
  const daily = getFinancialSummary(isToday);
  const weekly = getFinancialSummary((isoDate) => isWithinLastDays(isoDate, 7));
  const monthly = getFinancialSummary(isThisMonth);

  elements.reportDailyProfit.textContent = currencyFormatter.format(daily.profit);
  elements.reportDailySales.textContent = `Sales: ${currencyFormatter.format(daily.sales)}`;
  elements.reportDailyExpenses.textContent = `Expenses: ${currencyFormatter.format(daily.expenses)}`;
  elements.reportDailyUnits.textContent = `Units sold: ${formatQuantity(daily.unitsSold)}`;
  elements.reportWeeklyProfit.textContent = currencyFormatter.format(weekly.profit);
  elements.reportWeeklySales.textContent = `Sales: ${currencyFormatter.format(weekly.sales)}`;
  elements.reportWeeklyExpenses.textContent = `Expenses: ${currencyFormatter.format(weekly.expenses)}`;
  elements.reportWeeklyUnits.textContent = `Units sold: ${formatQuantity(weekly.unitsSold)}`;
  elements.reportMonthlyProfit.textContent = currencyFormatter.format(monthly.profit);
  elements.reportMonthlySales.textContent = `Sales: ${currencyFormatter.format(monthly.sales)}`;
  elements.reportMonthlyExpenses.textContent = `Expenses: ${currencyFormatter.format(monthly.expenses)}`;
  elements.reportMonthlyUnits.textContent = `Units sold: ${formatQuantity(monthly.unitsSold)}`;

  renderTrendBars(elements.reportWeeklyTrend, getDailySalesTrend(7), {
    emptyMessage: "Daily sales movement will appear here after your first week of recorded sales.",
    valueLabel: "Sales",
  });
  renderTrendBars(elements.reportMonthlyTrend, getCurrentMonthSalesTrend(), {
    emptyMessage: "Monthly sales movement will appear here once this month has recorded sales.",
    valueLabel: "Sales",
  });
}

function renderProfitLeaders() {
  const profitLeaders = [...getProductPerformanceSummaries()]
    .sort((left, right) => right.profit - left.profit || right.revenue - left.revenue)
    .slice(0, 5);

  if (!profitLeaders.length) {
    elements.profitLeaders.innerHTML = `
      <div class="empty-state">
        Profit leaders will appear here once you start recording sales with cost prices.
      </div>
    `;
    return;
  }

  elements.profitLeaders.innerHTML = profitLeaders
    .map(
      (entry) => `
        <article class="list-card">
          <strong>${escapeHtml(entry.name)}</strong>
          <div class="list-meta">
            <span>Gross profit: ${currencyFormatter.format(entry.profit)}</span>
            <span>Revenue: ${currencyFormatter.format(entry.revenue)}</span>
          </div>
          <div class="list-meta">
            <span>Units sold: ${formatQuantity(entry.quantity)} ${escapeHtml(entry.unit)}</span>
            <span>Margin: ${currencyFormatter.format(entry.marginPerUnit)} per ${escapeHtml(entry.unit)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderWeeklySalesTrend() {
  renderTrendBars(elements.weeklySalesTrend, getDailySalesTrend(7), {
    emptyMessage: "Weekly sales trend will appear here after you start logging sales.",
    valueLabel: "Sales",
  });
}

function renderReceiptInsights() {
  const sales = getSaleTransactions();
  const latestSale = sales[0];

  if (!latestSale) {
    elements.saleLatestReceiptNumber.textContent = "No sale receipt yet";
    elements.saleLatestReceiptCustomer.textContent = "Customer: Walk-in";
    elements.saleLatestReceiptTotal.textContent = "Total: PHP 0.00";
    elements.saleLatestReceiptProfit.textContent = "Gross profit: PHP 0.00";
    elements.salePrintLatest.disabled = true;
    elements.receiptList.innerHTML = `
      <div class="empty-state">
        Receipts will appear here as soon as you start recording sales.
      </div>
    `;
    return;
  }

  elements.saleLatestReceiptNumber.textContent = latestSale.receiptNumber || "Pending receipt number";
  elements.saleLatestReceiptCustomer.textContent = `Customer: ${latestSale.customerName || "Walk-in customer"}`;
  elements.saleLatestReceiptTotal.textContent = `Total: ${currencyFormatter.format(latestSale.total)}`;
  elements.saleLatestReceiptProfit.textContent = `Gross profit: ${currencyFormatter.format(latestSale.profitAmount)}`;
  elements.salePrintLatest.disabled = false;

  elements.receiptList.innerHTML = sales
    .slice(0, 10)
    .map(
      (transaction) => `
        <article class="list-card receipt-card">
          <div class="receipt-card-head">
            <strong>${escapeHtml(transaction.receiptNumber || "Pending receipt number")}</strong>
            <button class="mini-button" type="button" data-receipt-id="${escapeHtml(transaction.id)}">Print Receipt</button>
          </div>
          <div class="list-meta">
            <span>${escapeHtml(transaction.customerName || "Walk-in customer")}</span>
            <span>${dateTimeFormatter.format(new Date(transaction.occurredAt))}</span>
          </div>
          <div class="list-meta">
            <span>${escapeHtml(transaction.productName)}</span>
            <span>${formatQuantity(transaction.quantity)} ${escapeHtml(transaction.unit)}</span>
          </div>
          <div class="list-meta">
            <span>Total: ${currencyFormatter.format(transaction.total)}</span>
            <span>Gross profit: ${currencyFormatter.format(transaction.profitAmount)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function handleReceiptActions(event) {
  const button = event.target.closest("button[data-receipt-id]");
  if (!button) {
    return;
  }

  printReceiptById(button.dataset.receiptId);
}

function printLatestReceipt() {
  const latestSale = getSaleTransactions()[0];
  if (!latestSale) {
    return;
  }

  printReceiptById(latestSale.id);
}

function printReceiptById(transactionId) {
  const transaction = state.transactions.find((entry) => entry.id === transactionId && entry.type === "sale");
  if (!transaction || !currentAccount) {
    setFeedback("That receipt is no longer available.", "warning");
    return;
  }

  const receiptWindow = window.open("", "_blank", "width=760,height=900");
  if (!receiptWindow) {
    setFeedback("The browser blocked the receipt window. Allow pop-ups and try again.", "warning");
    return;
  }

  receiptWindow.document.write(buildReceiptDocument(transaction));
  receiptWindow.document.close();
  receiptWindow.focus();
  receiptWindow.print();
}

function populateDebtCustomerSuggestions() {
  const customerNames = [...new Set(state.debts.map((entry) => entry.customerName.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );

  if (!elements.debtCustomerOptions) {
    return;
  }

  elements.debtCustomerOptions.replaceChildren();
  customerNames.forEach((customerName) => {
    const option = document.createElement("option");
    option.value = customerName;
    elements.debtCustomerOptions.append(option);
  });
}

function renderProductPhoto(product, size = "small") {
  const className = size === "large" ? "product-photo-thumb large" : "product-photo-thumb";
  const imageUrl = sanitizeImageUrl(product.imageUrl);
  if (!imageUrl) {
    return `<div class="${className}" aria-hidden="true">${escapeHtml(getProductInitials(product.name))}</div>`;
  }

  return `<div class="${className} has-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}"></div>`;
}

function buildReceiptDocument(transaction) {
  const storeName = escapeHtml(currentAccount.storeName);
  const ownerName = escapeHtml(currentAccount.ownerName);
  const customerName = escapeHtml(transaction.customerName || "Walk-in customer");
  const productName = escapeHtml(transaction.productName);
  const unit = escapeHtml(transaction.unit);
  const note = escapeHtml(transaction.note || "No note recorded");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(transaction.receiptNumber || "Sale receipt")} | ${storeName}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 32px; color: #172334; background: #f4f7fb; }
      .receipt-shell { max-width: 760px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 32px; box-shadow: 0 16px 40px rgba(23, 35, 52, 0.12); }
      .receipt-head { display: flex; justify-content: space-between; gap: 24px; align-items: start; margin-bottom: 24px; }
      .receipt-title { font: 700 32px Cambria, Georgia, serif; margin: 0 0 8px; }
      .receipt-label { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #204f86; font-weight: 700; }
      .receipt-meta { display: grid; gap: 6px; color: #5a6778; font-size: 14px; }
      .receipt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
      .receipt-card { border: 1px solid rgba(23, 35, 52, 0.08); border-radius: 18px; padding: 16px; background: #f8fbff; }
      .receipt-card strong { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #5a6778; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th, td { padding: 14px 12px; border-bottom: 1px solid rgba(23, 35, 52, 0.08); text-align: left; }
      th { background: #edf3f9; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #5a6778; }
      .receipt-total { display: grid; gap: 8px; margin-left: auto; max-width: 320px; }
      .receipt-total div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(23, 35, 52, 0.08); }
      .receipt-total div:last-child { font-weight: 700; color: #173c67; border-bottom: 0; font-size: 18px; }
      .receipt-note { margin-top: 24px; padding: 16px; border-radius: 16px; background: #f6f8fb; color: #5a6778; }
      @media print { body { background: #fff; padding: 0; } .receipt-shell { box-shadow: none; border-radius: 0; max-width: none; } }
    </style>
  </head>
  <body>
    <main class="receipt-shell">
      <section class="receipt-head">
        <div>
          <div class="receipt-label">Store receipt</div>
          <h1 class="receipt-title">${storeName}</h1>
          <div class="receipt-meta">
            <span>Owner: ${ownerName}</span>
            <span>Receipt no.: ${escapeHtml(transaction.receiptNumber || "Pending receipt number")}</span>
            <span>Issued: ${escapeHtml(dateTimeFormatter.format(new Date(transaction.occurredAt)))}</span>
          </div>
        </div>
        <div class="receipt-meta">
          <span>Customer: ${customerName}</span>
          <span>Recorded via Tindahan Tracker</span>
        </div>
      </section>
      <section class="receipt-grid">
        <div class="receipt-card">
          <strong>Customer</strong>
          <span>${customerName}</span>
        </div>
        <div class="receipt-card">
          <strong>Gross profit</strong>
          <span>${escapeHtml(currencyFormatter.format(transaction.profitAmount))}</span>
        </div>
      </section>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Unit price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${productName}</td>
            <td>${escapeHtml(formatQuantity(transaction.quantity))} ${unit}</td>
            <td>${escapeHtml(currencyFormatter.format(transaction.unitPrice))}</td>
            <td>${escapeHtml(currencyFormatter.format(transaction.total))}</td>
          </tr>
        </tbody>
      </table>
      <section class="receipt-total">
        <div><span>Cost of goods</span><span>${escapeHtml(currencyFormatter.format(transaction.costTotal))}</span></div>
        <div><span>Gross profit</span><span>${escapeHtml(currencyFormatter.format(transaction.profitAmount))}</span></div>
        <div><span>Amount due</span><span>${escapeHtml(currencyFormatter.format(transaction.total))}</span></div>
      </section>
      <div class="receipt-note">Note: ${note}</div>
    </main>
  </body>
</html>`;
}

function renderRecentActivity() {
  const activities = [...state.activity].sort(
    (left, right) => new Date(right.occurredAt) - new Date(left.occurredAt)
  );

  if (!activities.length) {
    elements.recentActivity.innerHTML = `
      <div class="empty-state">
        Your latest sales, restocks, utang updates, and expense entries will show up here.
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

async function handleProductSubmit(event) {
  event.preventDefault();

  const productId = elements.productId.value.trim();
  const previousState = normalizeState(state);
  const existingProduct = productId ? getProductById(productId) : null;
  const product = {
    id: productId || uid("product"),
    name: elements.productName.value.trim(),
    category: elements.productCategory.value.trim(),
    unit: elements.productUnit.value.trim(),
    price: roundMoney(elements.productPrice.value),
    costPrice: resolveCostPrice(elements.productCostPrice.value, elements.productPrice.value),
    stock: roundNumber(elements.productStock.value),
    reorderLevel: roundNumber(elements.productReorder.value),
    sku: normalizeCode(elements.productSku.value),
    imageUrl: sanitizeImageUrl(existingProduct?.imageUrl),
    updatedAt: new Date().toISOString(),
  };

  if (!product.name || !product.category || !product.unit) {
    setFeedback("Please complete the product form before saving.", "danger");
    return;
  }

  if (product.stock < 0 || product.price < 0 || product.costPrice < 0 || product.reorderLevel < 0) {
    setFeedback("Stock, selling price, cost price, and reorder level cannot be negative.", "danger");
    return;
  }

  if (product.costPrice > product.price) {
    setFeedback("Cost price should not be higher than the selling price for profit tracking.", "danger");
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
    if (await saveAndRefresh(`${product.name} was updated.`, "success", { scope: "product" })) {
      resetProductForm();
    } else {
      state = previousState;
      renderAll();
    }
  } else {
    state.products.unshift(product);
    addActivity("product-created", `Added ${product.name} to your product list.`, product);
    if (await saveAndRefresh(`${product.name} was added to inventory.`, "success", { scope: "product" })) {
      resetProductForm();
    } else {
      state = previousState;
      renderAll();
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
  const receiptNumber = `${options.receiptNumber || buildReceiptNumber()}`;
  const customerName = `${options.customerName || ""}`.trim();
  const unitCost = resolveCostPrice(product.costPrice, product.price);
  const costTotal = roundMoney(quantity * unitCost);
  const total = roundMoney(quantity * product.price);
  const profitAmount = roundMoney(total - costTotal);

  state.transactions.unshift({
    id: uid("txn"),
    type: "sale",
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    unitPrice: product.price,
    unitCost,
    costTotal,
    profitAmount,
    total,
    customerName,
    receiptNumber,
    note,
    occurredAt: new Date().toISOString(),
  });

  addActivity(
    "sale",
    options.activityMessage || `Logged sale for ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
    product
  );
  const saved = await saveAndRefresh(options.feedbackMessage || `${product.name} sale saved.`, "success", {
    scope: "inventory-transaction",
  });
  if (!saved) {
    return { ok: false, message: "The sale could not be synchronized to the shared workspace." };
  }

  return { ok: true, product, receiptNumber };
}

async function recordRestock(product, quantity, note, options = {}) {
  if (!product) {
    return { ok: false, message: "Choose a product before recording a restock." };
  }

  if (quantity <= 0) {
    return { ok: false, message: "Restock quantity must be greater than zero." };
  }

  product.stock = roundNumber(product.stock + quantity);
  product.updatedAt = new Date().toISOString();
  const unitCost = resolveCostPrice(product.costPrice, product.price);
  const costTotal = roundMoney(quantity * unitCost);

  state.transactions.unshift({
    id: uid("txn"),
    type: "restock",
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    unitPrice: product.price,
    unitCost,
    costTotal,
    profitAmount: 0,
    total: roundMoney(quantity * product.price),
    customerName: "",
    receiptNumber: "",
    note,
    occurredAt: new Date().toISOString(),
  });

  addActivity(
    "restock",
    options.activityMessage || `Restocked ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
    product
  );
  const saved = await saveAndRefresh(options.feedbackMessage || `${product.name} restock saved.`, "success", {
    scope: "inventory-transaction",
  });
  if (!saved) {
    return { ok: false, message: "The restock could not be synchronized to the shared workspace." };
  }

  return { ok: true, product };
}

async function handleSaleSubmit(event) {
  event.preventDefault();

  const product = getProductById(elements.saleProduct.value);
  const quantity = roundNumber(elements.saleQuantity.value);
  const customerName = elements.saleCustomerName.value.trim();
  const note = elements.saleNote.value.trim();

  const result = await recordSale(product, quantity, note, { customerName });
  if (!result.ok) {
    setFeedback(result.message, "danger");
    return;
  }

  elements.saleForm.reset();
  elements.salePrintLatest.disabled = false;
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

  const result = await recordRestock(product, quantity, note);
  if (!result.ok) {
    setFeedback(result.message, "danger");
    return;
  }

  if (result.ok) {
    elements.restockForm.reset();
    updateRestockPreview();
  }
}

async function handleDebtSubmit(event) {
  event.preventDefault();

  const customerName = elements.debtCustomerName.value.trim();
  const type = elements.debtType.value === "payment" ? "payment" : "charge";
  const amount = roundMoney(elements.debtAmount.value);
  const note = elements.debtNote.value.trim();

  if (!customerName) {
    setFeedback("Enter the customer name before saving a utang entry.", "danger");
    return;
  }

  if (amount <= 0) {
    setFeedback("Utang and payment amounts must be greater than zero.", "danger");
    return;
  }

  const previousState = normalizeState(state);
  state.debts.unshift({
    id: uid("debt"),
    type,
    customerName,
    amount,
    note,
    occurredAt: new Date().toISOString(),
  });
  state.debts = state.debts.slice(0, 180);

  addActivity(
    type === "payment" ? "utang-payment" : "utang-charge",
    type === "payment"
      ? `Recorded payment of ${currencyFormatter.format(amount)} from ${customerName}.`
      : `Added utang of ${currencyFormatter.format(amount)} for ${customerName}.`,
    null
  );

  const saved = await saveState({ scope: "debt" });
  if (!saved) {
    state = previousState;
    renderAll();
    setFeedback(
      cloudMode
        ? lastCloudSaveErrorMessage || "The utang entry could not be synchronized. Run the updated Supabase SQL before using this feature online."
        : "The utang entry could not be saved right now.",
      "danger"
    );
    return;
  }

  renderAll();
  elements.debtForm.reset();
  setFeedback(
    type === "payment"
      ? `${customerName}'s payment was recorded successfully.`
      : `${customerName}'s utang entry was recorded successfully.`,
    "success"
  );
}

async function handleExpenseSubmit(event) {
  event.preventDefault();

  const category = elements.expenseCategory.value.trim();
  const amount = roundMoney(elements.expenseAmount.value);
  const note = elements.expenseNote.value.trim();

  if (!category) {
    setFeedback("Enter an expense category before saving.", "danger");
    return;
  }

  if (amount <= 0) {
    setFeedback("Expense amount must be greater than zero.", "danger");
    return;
  }

  const previousState = normalizeState(state);
  state.expenses.unshift({
    id: uid("expense"),
    category,
    amount,
    note,
    occurredAt: new Date().toISOString(),
  });
  state.expenses = state.expenses.slice(0, 180);

  addActivity("expense", `Saved ${category} expense worth ${currencyFormatter.format(amount)}.`, null);

  const saved = await saveState({ scope: "expense" });
  if (!saved) {
    state = previousState;
    renderAll();
    setFeedback(
      cloudMode
        ? lastCloudSaveErrorMessage || "The expense entry could not be synchronized. Run the updated Supabase SQL before using this feature online."
        : "The expense entry could not be saved right now.",
      "danger"
    );
    return;
  }

  renderAll();
  elements.expenseForm.reset();
  setFeedback(`${category} expense saved successfully.`, "success");
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

function startEditingProduct(productId, options = {}) {
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
  elements.productCostPrice.value = product.costPrice;
  elements.productStock.value = product.stock;
  elements.productReorder.value = product.reorderLevel;
  elements.productSku.value = product.sku;
  elements.productScannerLastResult.textContent = `Editing ${product.name}. Scan a new barcode to update its code, or switch the product-tab scanner to restock mode to add more stock here.`;

  if (options.scroll !== false) {
    elements.productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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

  const previousState = normalizeState(state);
  state.products = state.products.filter((item) => item.id !== productId);
  addActivity("product-deleted", `Removed ${product.name} from your product list.`, product);
  const saved = await saveAndRefresh(`${product.name} was deleted.`, "warning", { scope: "product" });

  if (saved && elements.productId.value === productId) {
    resetProductForm();
  }

  if (!saved) {
    state = previousState;
    renderAll();
  }
}

function resetProductForm() {
  elements.productForm.reset();
  elements.productId.value = "";
  elements.productFormTitle.textContent = "Add a product";
  elements.productSubmit.textContent = "Save Product";
  elements.productScanMode.value = "fill";
  elements.productScanQuantity.value = "1";
  elements.productScannerCodeInput.value = "";
  elements.productScannerLastResult.textContent = "No product-tab barcode action has been recorded yet.";
  updateProductScanGuidance();
}

function updateSalePreview() {
  const product = getProductById(elements.saleProduct.value);
  const quantity = roundNumber(elements.saleQuantity.value);
  const customerName = elements.saleCustomerName.value.trim();

  if (!product) {
    elements.salePreview.textContent = "Choose a product to preview the sale amount.";
    return;
  }

  if (quantity <= 0) {
    elements.salePreview.textContent = `${product.name} sells for ${currencyFormatter.format(product.price)} each with estimated gross profit of ${currencyFormatter.format(
      getProductMargin(product)
    )} per ${product.unit}. ${formatQuantity(product.stock)} ${product.unit} in stock.`;
    return;
  }

  const total = roundMoney(quantity * product.price);
  const grossProfit = roundMoney(quantity * getProductMargin(product));
  const remaining = roundNumber(product.stock - quantity);
  elements.salePreview.textContent = `Receipt total: ${currencyFormatter.format(total)}. Gross profit: ${currencyFormatter.format(
    grossProfit
  )}. ${customerName ? `${customerName} will appear on the receipt.` : "Walk-in customer will be used on the receipt."} Stock after sale: ${formatQuantity(
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

  const addedCost = roundMoney(quantity * product.costPrice);
  const addedRetail = roundMoney(quantity * product.price);
  elements.restockPreview.textContent = `New stock after restock: ${formatQuantity(product.stock + quantity)} ${
    product.unit
  }. Added capital: ${currencyFormatter.format(addedCost)}. Added retail value: ${currencyFormatter.format(addedRetail)}.`;
}

async function handleScannerManualSubmit(event) {
  event.preventDefault();

  const code = normalizeCode(elements.scannerCodeInput.value);
  if (!code) {
    setScannerStatus("Enter or scan a barcode before processing the code.", "warning", "inventory");
    return;
  }

  await processScannedCode(code, "manual", "inventory");
}

async function handleProductScannerManualSubmit(event) {
  event.preventDefault();

  const code = normalizeCode(elements.productScannerCodeInput.value);
  if (!code) {
    setScannerStatus("Enter or scan a barcode before processing the code.", "warning", "product");
    return;
  }

  await processScannedCode(code, "manual", "product");
}

function getScannerContext(contextName = activeScannerContext || "inventory") {
  if (contextName === "product") {
    return {
      name: "product",
      video: elements.productScannerVideo,
      placeholder: elements.productScannerPlaceholder,
      startButton: elements.productScannerStart,
      stopButton: elements.productScannerStop,
      status: elements.productScanStatus,
      codeInput: elements.productScannerCodeInput,
      lastResult: elements.productScannerLastResult,
    };
  }

  return {
    name: "inventory",
    video: elements.scannerVideo,
    placeholder: elements.scannerPlaceholder,
    startButton: elements.scannerStart,
    stopButton: elements.scannerStop,
    status: elements.scannerStatus,
    codeInput: elements.scannerCodeInput,
    lastResult: elements.scannerLastSale,
  };
}

function getScannerSettings() {
  return {
    mode: elements.scannerAction.value === "restock" ? "restock" : "sale",
    quantity: roundNumber(elements.scannerQuantity.value || 1),
  };
}

function setScannerMode(mode) {
  elements.scannerAction.value = mode === "restock" ? "restock" : "sale";
  updateScannerGuidance();
}

function getProductScanSettings() {
  return {
    mode: elements.productScanMode.value === "restock" ? "restock" : "fill",
    quantity: roundNumber(elements.productScanQuantity.value || 1),
  };
}

function updateScannerGuidance() {
  const { mode, quantity } = getScannerSettings();
  const isRestock = mode === "restock";
  const quantityLabel = formatQuantity(Math.max(quantity, 0));
  const context = getScannerContext("inventory");
  elements.scannerModeButtons.forEach((button) => {
    const isActive = button.dataset.scannerMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  context.status.textContent = isRestock
    ? `Every recognized barcode will restock ${quantityLabel} item(s). Save the product barcode first, then scan to add stock automatically.`
    : `Every recognized barcode will record ${quantityLabel} item(s) sold. Save the product barcode first, then scan to reduce stock automatically.`;
  delete context.status.dataset.tone;
}

function updateProductScanGuidance() {
  const { mode, quantity } = getProductScanSettings();
  const quantityLabel = formatQuantity(Math.max(quantity, 0));
  const context = getScannerContext("product");
  context.status.textContent =
    mode === "restock"
      ? `Every recognized barcode will restock ${quantityLabel} item(s) for the matching saved product and refresh the form above with the updated stock.`
      : "Every recognized barcode will fill the Barcode or product code field in the product form above.";
  delete context.status.dataset.tone;
}

function setScannerStatus(message, tone = "default", contextName = activeScannerContext || "inventory") {
  const context = getScannerContext(contextName);
  context.status.textContent = message;

  if (tone === "default") {
    delete context.status.dataset.tone;
  } else {
    context.status.dataset.tone = tone;
  }
}

function updateScannerSurfaces() {
  ["inventory", "product"].forEach((contextName) => {
    const context = getScannerContext(contextName);
    const isActive = Boolean(scanStream) && activeScannerContext === contextName;

    context.video.hidden = !isActive;
    context.placeholder.hidden = isActive;
    context.startButton.disabled = Boolean(scanStream);
    context.stopButton.disabled = !isActive;
  });
}

function getScannerStartMessage(contextName) {
  if (contextName === "product") {
    const { mode, quantity } = getProductScanSettings();
    return mode === "restock"
      ? `Product scanner is active. Each recognized code will restock ${formatQuantity(quantity)} item(s) for the matching saved product.`
      : "Product scanner is active. Each recognized code will fill the Barcode or product code field above.";
  }

  const { mode, quantity } = getScannerSettings();
  return `Camera scanner is active. Each recognized code will ${mode === "restock" ? "restock" : "sell"} ${formatQuantity(
    quantity
  )} item(s).`;
}

function getScannerStopMessage(contextName) {
  return contextName === "product"
    ? "Product-tab scanner is off. Start the camera when you are ready to scan another barcode from this form."
    : "Camera scanner is off. Start the camera when you are ready to scan again.";
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

async function startCameraScanner(contextName = "inventory") {
  if (!currentAccount) {
    return;
  }

  activateTab("store-ops", contextName === "product" ? "ops-product" : "ops-scan");

  if (scanStream && activeScannerContext === contextName) {
    setScannerStatus("Camera scanner is already active.", "success", contextName);
    return;
  }

  if (scanStream) {
    stopCameraScanner({ silent: true });
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setScannerStatus("This browser cannot open the camera. Use manual barcode entry instead.", "warning", contextName);
    return;
  }

  scanDetector = await buildScanDetector();
  if (!scanDetector) {
    setScannerStatus(
      "Live camera scanning is not available on this browser. Use manual barcode entry or a handheld scanner.",
      "warning",
      contextName
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

    activeScannerContext = contextName;
    const context = getScannerContext(contextName);
    context.video.srcObject = scanStream;
    await context.video.play();
    scanLoopBusy = false;
    lastScannedCode = "";
    lastScannedAt = 0;
    updateScannerSurfaces();
    setScannerStatus(getScannerStartMessage(contextName), "success", contextName);
    queueScanFrame();
  } catch (error) {
    console.error("Unable to start barcode scanner.", error);
    stopCameraScanner({ silent: true });
    setScannerStatus("Camera access was not granted. Allow camera access and try again.", "danger", contextName);
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

  const context = getScannerContext(activeScannerContext || "inventory");
  if (scanLoopBusy || context.video.readyState < 2) {
    queueScanFrame();
    return;
  }

  scanLoopBusy = true;

  try {
    const barcodes = await scanDetector.detect(context.video);
    if (Array.isArray(barcodes) && barcodes.length) {
      const code = normalizeCode(barcodes[0].rawValue);
      const now = Date.now();

      if (code && (code !== lastScannedCode || now - lastScannedAt > 1600)) {
        lastScannedCode = code;
        lastScannedAt = now;
        await processScannedCode(code, "camera", context.name);
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
  const previousContext = activeScannerContext || "inventory";

  if (scanFrameId) {
    window.cancelAnimationFrame(scanFrameId);
    scanFrameId = 0;
  }

  scanLoopBusy = false;
  scanDetector = null;
  lastScannedCode = "";
  lastScannedAt = 0;
  activeScannerContext = null;

  ["inventory", "product"].forEach((contextName) => {
    const context = getScannerContext(contextName);
    if (context.video.srcObject) {
      context.video.srcObject = null;
    }
  });

  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }

  updateScannerSurfaces();

  if (!options.silent) {
    setScannerStatus(getScannerStopMessage(previousContext), "default", previousContext);
  }
}

async function processScannedCode(rawCode, source, contextName = activeScannerContext || "inventory") {
  const code = normalizeCode(rawCode);
  if (!code) {
    setScannerStatus("A valid barcode is required before a scan can be recorded.", "warning", contextName);
    return;
  }

  if (contextName === "product") {
    await processProductTabCode(code, source);
    return;
  }

  const { mode, quantity } = getScannerSettings();
  if (quantity <= 0) {
    setScannerStatus("Quantity per scan must be greater than zero before scanning.", "warning", "inventory");
    return;
  }

  const product = getProductByCode(code);
  if (!product) {
    setScannerStatus(
      `No product matches code ${code}. Save that barcode in the product code field first.`,
      "danger",
      "inventory"
    );
    elements.scannerLastSale.textContent = `Last scanned code: ${code}. No matching product was found.`;
    elements.scannerCodeInput.value = "";
    return;
  }

  const entryLabel = `${source === "camera" ? "Camera" : "Manual"} barcode scan: ${code}`;
  const result =
    mode === "restock"
      ? await recordRestock(product, quantity, entryLabel, {
          activityMessage: `Recorded barcode restock for ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
          feedbackMessage: `${product.name} was restocked from barcode scan.`,
        })
      : await recordSale(product, quantity, entryLabel, {
          activityMessage: `Recorded barcode sale for ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
          feedbackMessage: `${product.name} was sold from barcode scan.`,
        });

  if (!result.ok) {
    setScannerStatus(result.message, "danger", "inventory");
    elements.scannerLastSale.textContent =
      mode === "restock"
        ? `${product.name} was not restocked. Review the scanner settings and try again.`
        : `${product.name} was not sold because the stock is too low.`;
    elements.scannerCodeInput.value = "";
    return;
  }

  setScannerStatus(
    mode === "restock"
      ? `${product.name} restocked successfully. ${formatQuantity(product.stock)} ${product.unit} now on hand.`
      : `${product.name} recorded successfully. ${formatQuantity(product.stock)} ${product.unit} remaining.`,
    "success",
    "inventory"
  );
  elements.scannerLastSale.textContent =
    mode === "restock"
      ? `${product.name} | Code: ${code} | Added: ${formatQuantity(quantity)} ${product.unit} | New stock: ${formatQuantity(
          product.stock
        )} ${product.unit}`
      : `${product.name} | Code: ${code} | Sold: ${formatQuantity(quantity)} ${product.unit} | Remaining stock: ${formatQuantity(
          product.stock
        )} ${product.unit}`;
  elements.scannerCodeInput.value = "";
}

async function processProductTabCode(code, source) {
  const { mode, quantity } = getProductScanSettings();
  const currentProductId = elements.productId.value.trim();

  if (mode === "fill") {
    const matchingProduct = getProductByCode(code);
    elements.productSku.value = code;
    elements.productScannerCodeInput.value = "";

    if (matchingProduct && matchingProduct.id !== currentProductId) {
      setScannerStatus(
        `${code} already belongs to ${matchingProduct.name}. Review that item before saving another product with the same barcode.`,
        "warning",
        "product"
      );
      elements.productScannerLastResult.textContent = `Barcode ${code} matches existing product ${matchingProduct.name}.`;
      return;
    }

    setScannerStatus(`Barcode ${code} was added to the product form.`, "success", "product");
    elements.productScannerLastResult.textContent =
      source === "camera"
        ? `Camera scan captured ${code} and placed it in the product code field.`
        : `Manual code ${code} was placed in the product code field.`;
    return;
  }

  if (quantity <= 0) {
    setScannerStatus("Restock quantity per scan must be greater than zero before scanning.", "warning", "product");
    return;
  }

  const product = getProductByCode(code);
  if (!product) {
    setScannerStatus(
      `No saved product matches code ${code}. Save the product first, then use restock mode.`,
      "danger",
      "product"
    );
    elements.productScannerLastResult.textContent = `Last scanned code: ${code}. No matching saved product was found.`;
    elements.productScannerCodeInput.value = "";
    return;
  }

  const entryLabel = `${source === "camera" ? "Camera" : "Manual"} product-tab barcode scan: ${code}`;
  const result = await recordRestock(product, quantity, entryLabel, {
    activityMessage: `Recorded product-tab barcode restock for ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
    feedbackMessage: `${product.name} was restocked from the product tab.`,
  });

  if (!result.ok) {
    setScannerStatus(result.message, "danger", "product");
    elements.productScannerLastResult.textContent = `${product.name} was not restocked. Review the scanner settings and try again.`;
    elements.productScannerCodeInput.value = "";
    return;
  }

  startEditingProduct(product.id, { scroll: false });
  setScannerStatus(
    `${product.name} restocked successfully. ${formatQuantity(product.stock)} ${product.unit} now on hand.`,
    "success",
    "product"
  );
  elements.productScannerLastResult.textContent = `${product.name} | Code: ${code} | Added: ${formatQuantity(
    quantity
  )} ${product.unit} | New stock: ${formatQuantity(product.stock)} ${product.unit}`;
  elements.productScannerCodeInput.value = "";
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
      const previousState = normalizeState(state);
      const parsed = JSON.parse(`${reader.result || "{}"}`);
      state = normalizeState(parsed.state ?? parsed);
      addActivity("import", "Imported a backup file into the inventory workspace.", null);
      if (await saveAndRefresh("Backup imported successfully.", "success")) {
        resetProductForm();
      } else {
        state = previousState;
        renderAll();
        setFeedback(
          cloudMode
            ? "The backup needs the updated Supabase SQL before finance and utang records can be synchronized."
            : "The backup could not be saved right now.",
          "danger"
        );
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

  const previousState = normalizeState(state);
  state = buildDefaultState();
  addActivity("reset", "Loaded the demonstration inventory dataset.", null);
  if (await saveAndRefresh("Demonstration inventory loaded.", "warning")) {
    resetProductForm();
  } else {
    state = previousState;
    renderAll();
    setFeedback(
      cloudMode
        ? "The demonstration dataset needs the updated Supabase SQL before finance and utang records can be synchronized."
        : "The demonstration dataset could not be saved right now.",
      "danger"
    );
  }
}

async function saveAndRefresh(message, tone, options = {}) {
  setBusyState(true, "Saving store updates...");
  const saved = await saveState(options);
  renderAll();
  setBusyState(false);
  if (!saved) {
    setFeedback(
      cloudMode
        ? lastCloudSaveErrorMessage || "The change could not be synchronized to the shared workspace. Please try again."
        : "The change could not be saved on this browser right now. Please try again.",
      "danger"
    );
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

function getProductMargin(product) {
  return roundMoney(roundMoney(product.price) - resolveCostPrice(product.costPrice, product.price));
}

function getSuggestedRestockQuantity(product) {
  return Math.max(roundNumber(product.reorderLevel * 2 - product.stock), product.reorderLevel);
}

function getSaleTransactions() {
  return [...state.transactions]
    .filter((transaction) => transaction.type === "sale")
    .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));
}

function getProductPerformanceSummaries() {
  const summaries = new Map();

  getSaleTransactions().forEach((transaction) => {
    const current = summaries.get(transaction.productId) || {
      id: transaction.productId,
      name: transaction.productName,
      unit: transaction.unit,
      quantity: 0,
      revenue: 0,
      profit: 0,
      marginPerUnit: roundMoney(roundMoney(transaction.unitPrice) - resolveCostPrice(transaction.unitCost, transaction.unitPrice)),
    };

    current.quantity += transaction.quantity;
    current.revenue += transaction.total;
    current.profit += transaction.profitAmount ?? 0;
    summaries.set(transaction.productId, current);
  });

  return [...summaries.values()].map((entry) => ({
    ...entry,
    quantity: roundNumber(entry.quantity),
    revenue: roundMoney(entry.revenue),
    profit: roundMoney(entry.profit),
  }));
}

function getSmartInsights() {
  const insights = [];
  const salesToday = getFinancialSummary(isToday);
  const salesYesterday = getFinancialSummary((isoDate) => isWithinDayOffset(isoDate, 1));
  const lowStockProducts = state.products.filter((product) => {
    const status = getProductStatus(product).key;
    return status === "reorder" || status === "out";
  });
  const staleProducts = state.products.filter((product) => {
    const soldRecently = state.transactions.some((transaction) => {
      return transaction.type === "sale" && transaction.productId === product.id && isWithinLastDays(transaction.occurredAt, 14);
    });
    return !soldRecently && product.stock > product.reorderLevel;
  });
  const topProfitProduct = [...getProductPerformanceSummaries()].sort(
    (left, right) => right.profit - left.profit || right.quantity - left.quantity
  )[0];

  if (salesToday.sales > 0 || salesYesterday.sales > 0) {
    const difference = roundMoney(salesToday.sales - salesYesterday.sales);
    const direction = difference >= 0 ? "up" : "down";
    const percentage = salesYesterday.sales > 0 ? Math.abs((difference / salesYesterday.sales) * 100) : 100;
    insights.push({
      title: "Sales pulse",
      badge: `Today ${direction === "up" ? "up" : "down"} ${numberFormatter.format(percentage)}%`,
      message: `You sold ${currencyFormatter.format(salesToday.sales)} today, ${direction === "up" ? "up" : "down"} ${currencyFormatter.format(
        Math.abs(difference)
      )} versus yesterday.`,
    });
  }

  if (lowStockProducts.length) {
    const priorityProduct = lowStockProducts[0];
    insights.push({
      title: "Restock priority",
      badge: `${lowStockProducts.length} alert${lowStockProducts.length === 1 ? "" : "s"}`,
      message: `${priorityProduct.name} should be reordered soon. Suggested refill: ${formatQuantity(
        getSuggestedRestockQuantity(priorityProduct)
      )} ${priorityProduct.unit}.`,
    });
  }

  if (staleProducts.length) {
    insights.push({
      title: "Slow-moving stock",
      badge: `${staleProducts.length} item${staleProducts.length === 1 ? "" : "s"} quiet`,
      message: `${staleProducts[0].name} has stock on hand but no sale in the last 14 days. Consider promo pricing or reduced reorder plans.`,
    });
  }

  if (topProfitProduct) {
    insights.push({
      title: "Top profit item",
      badge: `${currencyFormatter.format(topProfitProduct.profit)} gross profit`,
      message: `${topProfitProduct.name} leads current profit contribution with ${formatQuantity(topProfitProduct.quantity)} ${topProfitProduct.unit} sold.`,
    });
  }

  return insights.slice(0, 4);
}

function getDailySalesTrend(days) {
  const trend = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const sales = state.transactions.filter((transaction) => {
      if (transaction.type !== "sale") {
        return false;
      }

      const occurred = new Date(transaction.occurredAt);
      return occurred >= date && occurred < nextDate;
    });

    trend.push({
      label: date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      value: roundMoney(sum(sales.map((transaction) => transaction.total))),
      subtitle: `${sales.length} sale${sales.length === 1 ? "" : "s"}`,
    });
  }

  return trend;
}

function getCurrentMonthSalesTrend() {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const trend = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    const nextDate = new Date(today.getFullYear(), today.getMonth(), day + 1);
    const sales = state.transactions.filter((transaction) => {
      if (transaction.type !== "sale") {
        return false;
      }

      const occurred = new Date(transaction.occurredAt);
      return occurred >= date && occurred < nextDate;
    });

    trend.push({
      label: `${day}`,
      value: roundMoney(sum(sales.map((transaction) => transaction.total))),
      subtitle: `${sales.length} sale${sales.length === 1 ? "" : "s"}`,
    });
  }

  return trend.filter((entry) => entry.value > 0).slice(-12);
}

function renderTrendBars(container, entries, options = {}) {
  const meaningfulEntries = entries.filter((entry) => entry.value > 0);
  if (!meaningfulEntries.length) {
    container.innerHTML = `
      <div class="empty-state">
        ${escapeHtml(options.emptyMessage || "Trend data will appear here once you record more activity.")}
      </div>
    `;
    return;
  }

  const highestValue = meaningfulEntries[0]
    ? Math.max(...meaningfulEntries.map((entry) => entry.value), 1)
    : 1;

  container.innerHTML = meaningfulEntries
    .map(
      (entry) => `
        <div class="bar-row">
          <div class="bar-header">
            <span>${escapeHtml(entry.label)}</span>
            <span>${currencyFormatter.format(entry.value)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${(entry.value / highestValue) * 100}%"></div>
          </div>
          <div class="trend-meta">${escapeHtml(entry.subtitle || `${options.valueLabel || "Value"} logged`)}</div>
        </div>
      `
    )
    .join("");
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

function getDebtCustomerSummaries() {
  const summaries = new Map();

  state.debts.forEach((entry) => {
    const key = entry.customerName.trim().toLowerCase();
    const current = summaries.get(key) || {
      customerName: entry.customerName.trim(),
      charged: 0,
      paid: 0,
      balance: 0,
      lastOccurredAt: entry.occurredAt,
      recentEntries: [],
    };

    if (entry.type === "payment") {
      current.paid += entry.amount;
      current.balance -= entry.amount;
    } else {
      current.charged += entry.amount;
      current.balance += entry.amount;
    }

    if (new Date(entry.occurredAt) > new Date(current.lastOccurredAt)) {
      current.lastOccurredAt = entry.occurredAt;
    }

    current.recentEntries.push({
      type: entry.type,
      amount: roundMoney(entry.amount),
      note: entry.note,
      occurredAt: entry.occurredAt,
    });

    summaries.set(key, current);
  });

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      charged: roundMoney(summary.charged),
      paid: roundMoney(summary.paid),
      balance: roundMoney(Math.max(summary.balance, 0)),
      recentEntries: summary.recentEntries
        .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt))
        .slice(0, 3),
    }))
    .sort((left, right) => right.balance - left.balance || new Date(right.lastOccurredAt) - new Date(left.lastOccurredAt));
}

function getExpenseCategorySummaries() {
  const totals = new Map();

  state.expenses.forEach((expense) => {
    totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount);
  });

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value: roundMoney(value) }))
    .sort((left, right) => right.value - left.value);
}

function getFinancialSummary(filterFn) {
  const sales = state.transactions.filter((transaction) => transaction.type === "sale" && filterFn(transaction.occurredAt));
  const expenses = state.expenses.filter((expense) => filterFn(expense.occurredAt));
  const grossProfit = sum(sales.map((transaction) => transaction.profitAmount ?? 0));
  const totalSales = sum(sales.map((transaction) => transaction.total));
  const totalExpenses = sum(expenses.map((expense) => expense.amount));

  return {
    sales: totalSales,
    expenses: totalExpenses,
    grossProfit: roundMoney(grossProfit),
    profit: roundMoney(grossProfit - totalExpenses),
    unitsSold: sum(sales.map((transaction) => transaction.quantity)),
    saleCount: sales.length,
    expenseCount: expenses.length,
  };
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

function isThisMonth(isoDate) {
  const candidate = new Date(isoDate);
  const today = new Date();
  return candidate.getFullYear() === today.getFullYear() && candidate.getMonth() === today.getMonth();
}

function isWithinDayOffset(isoDate, daysBack) {
  const candidate = new Date(isoDate);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysBack);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return candidate >= start && candidate < end;
}

function isWithinLastDays(isoDate, days) {
  const candidate = new Date(isoDate);
  const now = new Date();
  const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  cutoff.setHours(0, 0, 0, 0);
  return candidate >= cutoff && candidate <= now;
}

function formatActivityLabel(kind) {
  return {
    sale: "Sale",
    restock: "Restock",
    expense: "Expense",
    "utang-charge": "Utang added",
    "utang-payment": "Utang payment",
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
    elements.feedbackMessage.textContent = "The store workspace is ready.";
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

function setBusyState(isBusy, message = "Loading workspace...") {
  if (!elements.busyOverlay || !elements.busyLabel) {
    return;
  }

  elements.busyLabel.textContent = message;
  elements.busyOverlay.hidden = !isBusy;
  document.body.classList.toggle("is-busy", isBusy);
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

function sanitizeImageUrl(value) {
  const candidate = `${value || ""}`.trim();
  if (!candidate) {
    return "";
  }

  if (/^(https?:\/\/|data:image\/)/i.test(candidate)) {
    return candidate;
  }

  return "";
}

function resolveCostPrice(value, fallbackPrice = 0) {
  const numeric = roundMoney(value);
  if (numeric > 0) {
    return numeric;
  }

  const fallback = roundMoney(fallbackPrice);
  return fallback > 0 ? roundMoney(fallback * 0.7) : 0;
}

function buildReceiptNumber(isoDate = new Date().toISOString()) {
  const stamp = new Date(isoDate);
  const yyyy = stamp.getFullYear();
  const mm = String(stamp.getMonth() + 1).padStart(2, "0");
  const dd = String(stamp.getDate()).padStart(2, "0");
  const hh = String(stamp.getHours()).padStart(2, "0");
  const min = String(stamp.getMinutes()).padStart(2, "0");
  const ss = String(stamp.getSeconds()).padStart(2, "0");
  return `RCPT-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function getProductInitials(name) {
  const words = `${name || "Product"}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]).join("").toUpperCase() || "PR";
}

function uid(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
